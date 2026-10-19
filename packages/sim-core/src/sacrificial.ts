import { SACRIFICIAL, sacrificialCooldownFrames, sacrificialCooldownIsActive, sacrificialProbability } from "@genshin-dps-lab/reaction-formulas";
import type { HitDefinition, SacrificialModel } from "@genshin-dps-lab/schemas";
import { SeededRandom, type SeededRandomState } from "./energy";

export const SACRIFICIAL_PROFILE = {
  ...SACRIFICIAL,
  id: "gcsim-sacrificial-v1",
  evidence: "fixed-source-assumed",
  rngStream: "sacrificial-v1",
  rngAlgorithm: "fnv1a32-mulberry32-v1",
  matchesGcsimRandomSequence: false,
  cooldownClock: "global-frame-assumes-no-character-hitlag",
  cooldownBoundary: "expiry-frame-inclusive",
  callbackScope: "ordinary-enemy-damage",
  assumptions: [
    "仅检查已配置祭礼武器持有者本人的实际伤害回调；持有者必须在场，且命中必须明确标记为元素战技，不能从动作名称推断。",
    "按源码顺序检查在场状态、攻击标签、祭礼冷却、元素战技剩余冷却及非零实际伤害，全部通过后才消耗一次随机抽样。",
    "仅当抽样值严格小于触发概率时成功；失败不开始祭礼冷却，成功由宿主重置真实元素战技冷却队列。",
    "祭礼冷却到期帧仍阻塞；源码状态受角色卡肉延长，本配置使用全局帧并明确假设无角色卡肉。",
    "使用独立命名种子流保证本地复现；gcsim 使用共享随机流，相同 seed 不代表相同抽样序列。",
    "本运行时覆盖普通伤害回调，不声明月曜／星辉特殊宿主已接入；固定来源行为未经当前游戏实测。",
  ],
} as const;

export interface SacrificialDamageInput {
  actorId: string;
  frame: number;
  damageEventId: number;
  activeCharacterId: string | null;
  attackTag: NonNullable<HitDefinition["attackTag"]> | null;
  damage: number;
  getSkillCooldown: () => number;
}

export interface SacrificialDecision extends Omit<SacrificialDamageInput, "getSkillCooldown"> {
  sourceProfileId: typeof SACRIFICIAL_PROFILE.id;
  sourceRef: string;
  rngStream: typeof SACRIFICIAL_PROFILE.rngStream;
  weaponId: SacrificialModel["actors"][number]["weaponId"];
  refinement: number;
  probability: number;
  cooldownFrames: number;
  cooldownExpiresFrameBefore: number | null;
  cooldownExpiresFrameAfter: number | null;
  /** Null when an earlier guard prevented the source Cooldown(E) query. */
  skillCooldownBefore: number | null;
  outcome: "off-field" | "attack-tag-blocked" | "cooldown-blocked" | "skill-ready" | "zero-damage" | "failed-roll" | "triggered";
  roll: number | null;
  drawIndex: number | null;
  drawCountBefore: number;
  drawCountAfter: number;
}

export interface SacrificialCheckpointState {
  actors: SacrificialModel["actors"];
  cooldownExpiresFrames: ReadonlyMap<string, number>;
  drawCount: number;
  random: SeededRandomState;
}

export class SacrificialRuntime {
  private readonly actors: Map<string, SacrificialModel["actors"][number]>;
  private readonly cooldownExpiry = new Map<string, number>();
  private readonly random: SeededRandom;
  private drawCount = 0;

  constructor(seed: string, model: SacrificialModel) {
    this.actors = new Map(model.actors.map(actor => [actor.actorId, { ...actor }]));
    this.random = new SeededRandom(`${seed}\u0000${SACRIFICIAL_PROFILE.rngStream}`);
  }

  actor(actorId: string): SacrificialModel["actors"][number] | undefined { return this.actors.get(actorId); }

  captureState(): SacrificialCheckpointState {
    return { actors: structuredClone([...this.actors.values()]), cooldownExpiresFrames: new Map(this.cooldownExpiry),
      drawCount: this.drawCount, random: this.random.captureState() };
  }

  /** The host supplies a configured owner and resets its real skill queue only on success. */
  onDamage(input: SacrificialDamageInput): SacrificialDecision {
    const actor = this.actors.get(input.actorId)!;
    const probability = sacrificialProbability(actor.refinement);
    const cooldownFrames = sacrificialCooldownFrames(actor.refinement);
    const cooldownExpiresFrameBefore = this.cooldownExpiry.get(input.actorId) ?? null;
    const drawCountBefore = this.drawCount;
    let skillCooldownBefore: number | null = null;
    let outcome: SacrificialDecision["outcome"];
    let roll: number | null = null;
    let drawIndex: number | null = null;

    if (input.activeCharacterId !== input.actorId) outcome = "off-field";
    else if (input.attackTag !== "skill") outcome = "attack-tag-blocked";
    else if (sacrificialCooldownIsActive(cooldownExpiresFrameBefore, input.frame)) outcome = "cooldown-blocked";
    else {
      skillCooldownBefore = input.getSkillCooldown();
      if (skillCooldownBefore === 0) outcome = "skill-ready";
      else if (input.damage === 0) outcome = "zero-damage";
      else {
        drawIndex = this.drawCount++;
        roll = this.random.next();
        outcome = roll < probability ? "triggered" : "failed-roll";
        if (outcome === "triggered") this.cooldownExpiry.set(input.actorId, input.frame + cooldownFrames);
      }
    }

    const { getSkillCooldown: _getSkillCooldown, ...context } = input;
    return { ...context, sourceProfileId: SACRIFICIAL_PROFILE.id, sourceRef: SACRIFICIAL.sourceRef,
      rngStream: SACRIFICIAL_PROFILE.rngStream, weaponId: actor.weaponId, refinement: actor.refinement,
      probability, cooldownFrames, cooldownExpiresFrameBefore,
      cooldownExpiresFrameAfter: this.cooldownExpiry.get(input.actorId) ?? null,
      skillCooldownBefore, outcome, roll, drawIndex, drawCountBefore, drawCountAfter: this.drawCount };
  }
}
