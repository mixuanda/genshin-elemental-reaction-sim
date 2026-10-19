import { LUNAR_ARTIFACT_BONUS_RULES, type LunarArtifactBonus, type MoonlightArtifactBonusSnapshot, type SpecialBranch } from "@genshin-dps-lab/reaction-formulas";
import type { LunarArtifactExecutionOptions } from "@genshin-dps-lab/schemas";
import type { MoonlightArtifactRuntime } from "./moonlight-artifact-runtime";

type FlowerState = { stacks: number; expiresAt?: number; cooldownUntil?: number };

/** Only the selected Lunar four-piece clause; supplied final panels own all ordinary stats. */
export class LunarArtifactRuntime {
  private readonly selections = new Map<string, LunarArtifactBonus["kind"]>();
  private readonly flowers = new Map<string, FlowerState>();
  private readonly returnedUntil = new Map<string, number>();
  private activeActorId: string | null;
  private readonly moonsignLevel: 0 | 1 | 2 | undefined;
  readonly assumptions: string[];
  readonly moonlight: MoonlightArtifactRuntime | undefined;

  constructor(options: LunarArtifactExecutionOptions, actorIds: readonly string[], initialActiveActorId: string | null, moonlight?: MoonlightArtifactRuntime) {
    this.moonlight = moonlight;
    this.activeActorId = initialActiveActorId;
    this.moonsignLevel = options.moonsignLevel;
    for (const artifact of options.artifacts ?? []) {
      if (!actorIds.includes(artifact.actorId) || this.selections.has(artifact.actorId)) throw new Error("月曜圣遗物声明须绑定实际角色，且每名角色只能选择一套四件套。");
      if (!(artifact.kind in LUNAR_ARTIFACT_BONUS_RULES)) throw new Error("未支持的月曜圣遗物条款。");
      this.selections.set(artifact.actorId, artifact.kind);
      if (artifact.kind === "flower-of-paradise-lost-4pc") this.flowers.set(artifact.actorId, { stacks: 0 });
    }
    if (this.hasAubade && options.moonsignLevel === undefined) throw new Error("晓歌运行时需要显式月兆等级，不从角色名字推断。");
    this.assumptions = this.selections.size === 0 ? [] : [
      `已启用所选月曜四件套条款：${[...this.selections].map(([actorId, kind]) => `${actorId} · ${LUNAR_ARTIFACT_BONUS_RULES[kind].name}`).join("；")}。二件套与普通面板效果由输入最终面板承担，不重复增加；其余特殊加成仍按参考配置显式关闭。`,
      "乐园由真实绽放／月绽放／超绽放／烈绽放触发；共享冷却在+60帧仍有效，整组层数期限刷新600帧；ReactBonus读取在到期帧清理加成，状态检查在到期帧仍有效。普通快照不清理反应加成。",
      "晓歌以实际完成换人为界，初始前台没有残留；换入后的180帧含到期帧有效。显式月兆等级在初始化固定。仅60 FPS、无卡肉的固定来源参考，仍为provisional。",
    ];
    this.assumptions.push(...(moonlight?.assumptions ?? []));
  }

  get hasAubade(): boolean { return [...this.selections.values()].includes("aubade-4pc"); }
  get needsCompletedSwap(): boolean { return this.hasAubade || this.moonlight?.hasNight === true; }
  hasSelection(actorId: string): boolean { return this.selections.has(actorId); }

  /** Invoke at the completed swap event, never at command start or an ordinary snapshot. */
  completedSwap(nextActorId: string, frame: number): void {
    if (nextActorId === this.activeActorId) return;
    if (this.activeActorId !== null) this.returnedUntil.delete(this.activeActorId);
    this.activeActorId = nextActorId;
    this.moonlight?.completedSwap(nextActorId);
    if (this.selections.get(nextActorId) === "aubade-4pc") this.returnedUntil.set(nextActorId, frame + 180);
  }

  /** Both Bloom subscriptions share this one status; same-frame double notification cannot add two stacks. */
  reactionTriggered(actorId: string, frame: number, reaction: "bloom" | "hyperbloom" | "burgeon"): boolean {
    void reaction;
    const state = this.flowers.get(actorId);
    if (state === undefined || (state.cooldownUntil !== undefined && frame <= state.cooldownUntil)) return false;
    if (state.expiresAt === undefined || state.expiresAt < frame) state.stacks = 0;
    state.stacks = Math.min(4, state.stacks + 1);
    state.expiresAt = frame + 600;
    state.cooldownUntil = frame + 60;
    return true;
  }

  /** Source ReactBonus removes expired ReactBonusMods even when this attack receives no Flower bonus. */
  ordinaryReactionRead(actorId: string, frame: number): void {
    const state = this.flowers.get(actorId);
    if (state?.expiresAt !== undefined && state.expiresAt <= frame) {
      state.stacks = 0;
      delete state.expiresAt;
    }
  }

  snapshot(actorId: string, frame: number): LunarArtifactBonus | undefined {
    const kind = this.selections.get(actorId);
    if (kind === undefined) return undefined;
    this.ordinaryReactionRead(actorId, frame);
    if (kind === "thundering-fury-4pc") return { kind };
    if (kind === "flower-of-paradise-lost-4pc") return { kind, stacks: this.flowers.get(actorId)!.stacks };
    return { kind, offField: actorId !== this.activeActorId, returnGraceActive: (this.returnedUntil.get(actorId) ?? -1) >= frame, moonsignLevel: this.moonsignLevel! };
  }

  snapshotFields(actorId: string, frame: number, branch: SpecialBranch): { artifactBonus?: LunarArtifactBonus; moonlightArtifactBonus?: MoonlightArtifactBonusSnapshot } {
    const artifactBonus = this.snapshot(actorId, frame);
    const moonlightArtifactBonus = this.moonlight?.reactionBonus(actorId, frame, branch).snapshot;
    return { ...(artifactBonus === undefined ? {} : { artifactBonus }), ...(moonlightArtifactBonus === undefined ? {} : { moonlightArtifactBonus }) };
  }
}
