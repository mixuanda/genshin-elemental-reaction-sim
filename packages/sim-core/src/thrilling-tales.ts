import { THRILLING_TALES, thrillingTalesCoefficient } from "@genshin-dps-lab/reaction-formulas";
import type { ThrillingTalesModel } from "@genshin-dps-lab/schemas";

export const THRILLING_TALES_PROFILE = {
  ...THRILLING_TALES,
  id: "gcsim-thrilling-tales-v1",
  sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  evidence: "fixed-source-assumed",
  cooldownClock: "global-frame-assumes-no-character-hitlag",
  cooldownBoundary: "expiry-frame-inclusive",
  recipientPresenceBoundary: "expiry-frame-inclusive",
  statsSamplingBoundary: "delete-when-expiry-at-or-before-frame",
  callbackScope: "ordinary-character-swap",
  assumptions: [
    "仅在讨龙持有者实际切换给另一角色时尝试触发；切入持有者或角色未改变不触发。",
    "持有者冷却到期帧仍阻塞；冷却可用时先开始新的冷却，再检查接收者已有的共享 ttds 增益，不因接收者已有增益而退还冷却或刷新增益。",
    "接收者增益的状态存在性检查在到期帧仍成立；固定源码 Stats() 面板取样会删除到期帧及更早的属性增益，因此必须保留真实取样顺序。",
    "只有宿主实际执行 Stats() 对应取样时调用 markStatsSample；只读面板计算和状态捕获不能清理接收者状态。",
    "源码冷却与增益都受角色卡肉延长；本配置使用全局帧并明确假设无角色卡肉。",
    "实际完成的切人回调与普通命中共用；月曜／星辉贡献者读取同一实时属性，但当前已实现的独立特殊伤害只使用HP或EM／暴击，不会虚构讨龙ATK增伤。固定来源行为未经当前游戏实测。",
  ],
} as const;

export interface ThrillingTalesDecision {
  ownerId: string;
  recipientId: string;
  refinement: number;
  coefficient: number;
  sourceProfileId: typeof THRILLING_TALES_PROFILE.id;
  sourceRef: string;
  outcome: "applied" | "owner-cooldown" | "recipient-already-buffed";
  cooldownExpiresFrameBefore: number | null;
  cooldownExpiresFrameAfter: number | null;
  /** Null on an owner-cooldown decision: the recipient was not queried. */
  recipientExpiresFrameBefore: number | null;
  recipientExpiresFrameAfter: number | null;
}

export interface ThrillingTalesCapturedState {
  actors: ThrillingTalesModel["actors"];
  ownerExpiry: ReadonlyMap<string, number>;
  recipientExpiry: ReadonlyMap<string, number>;
}

export class ThrillingTalesRuntime {
  private readonly actors: Map<string, ThrillingTalesModel["actors"][number]>;
  private readonly ownerExpiry = new Map<string, number>();
  private readonly recipientExpiry = new Map<string, number>();

  constructor(model: ThrillingTalesModel) {
    this.actors = new Map(model.actors.map(actor => [actor.actorId, { ...actor }]));
  }

  onSwap(input: { frame: number; previousActorId: string | null; nextActorId: string }): ThrillingTalesDecision | undefined {
    if (input.previousActorId === null || input.previousActorId === input.nextActorId) return undefined;
    const owner = this.actors.get(input.previousActorId);
    if (owner === undefined) return undefined;

    const cooldownExpiresFrameBefore = this.ownerExpiry.get(owner.actorId) ?? null;
    const source = {
      ownerId: owner.actorId,
      recipientId: input.nextActorId,
      refinement: owner.refinement,
      coefficient: thrillingTalesCoefficient(owner.refinement),
      sourceProfileId: THRILLING_TALES_PROFILE.id,
      sourceRef: THRILLING_TALES.sourceRef,
    };
    if (cooldownExpiresFrameBefore !== null && cooldownExpiresFrameBefore >= input.frame) {
      return { ...source, outcome: "owner-cooldown", cooldownExpiresFrameBefore,
        cooldownExpiresFrameAfter: cooldownExpiresFrameBefore,
        recipientExpiresFrameBefore: null, recipientExpiresFrameAfter: null };
    }

    const cooldownExpiresFrameAfter = input.frame + THRILLING_TALES.cooldownFrames;
    this.ownerExpiry.set(owner.actorId, cooldownExpiresFrameAfter);
    const recipientExpiresFrameBefore = this.recipientExpiry.get(input.nextActorId) ?? null;
    if (recipientExpiresFrameBefore !== null && recipientExpiresFrameBefore < input.frame) {
      this.recipientExpiry.delete(input.nextActorId);
    }
    const alreadyBuffed = this.recipientExpiry.has(input.nextActorId);
    if (!alreadyBuffed) this.recipientExpiry.set(input.nextActorId, input.frame + THRILLING_TALES.durationFrames);
    return { ...source, outcome: alreadyBuffed ? "recipient-already-buffed" : "applied",
      cooldownExpiresFrameBefore, cooldownExpiresFrameAfter, recipientExpiresFrameBefore,
      recipientExpiresFrameAfter: this.recipientExpiry.get(input.nextActorId)! };
  }

  /** Mirrors the mutation made by a real Stats() call, not a read-only panel lookup. */
  markStatsSample(actorId: string, frame: number): void {
    const expiresFrame = this.recipientExpiry.get(actorId);
    if (expiresFrame !== undefined && expiresFrame <= frame) this.recipientExpiry.delete(actorId);
  }

  captureState(): ThrillingTalesCapturedState {
    return { actors: [...this.actors.values()].map(actor => ({ ...actor })),
      ownerExpiry: new Map(this.ownerExpiry), recipientExpiry: new Map(this.recipientExpiry) };
  }
}
