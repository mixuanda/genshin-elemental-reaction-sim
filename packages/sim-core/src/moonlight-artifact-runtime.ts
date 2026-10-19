import type { MoonlightArtifactModel } from "@genshin-dps-lab/schemas";
import { MOONLIGHT_ARTIFACT_BONUS_SOURCES, moonlightArtifactBonusStages, type MoonlightArtifactBonusSnapshot, type SpecialBranch } from "@genshin-dps-lab/reaction-formulas";
import { expr, traceInput, TraceBuilder, type CalculationTraceNode } from "./calculation-trace";

export type MoonlightReaction = "lunarCharged" | "lunarCrystallize" | "lunarBloom";
export interface MoonlightArtifactLogEntry {
  id: number; frame: number;
  /** Ordinary damage-event backlink; special owner deliveries are certified by full-result re-execution. */
  triggerDamageEventId?: number;
  event: "OnLunarCharged" | "OnLunarCrystallize" | "OnLunarBloom" | "OnEnemyDamage";
  triggerActorId: string; wearerActorId: string; setId: MoonlightArtifactModel["actors"][number]["setId"];
  sourceRef: string;
  applications: Array<{ receiverActorId: string; key: string; value: number; stat: "critRate" | "em" | "reactionBonus"; expiresAtFrame: number; replacedSourceActorId: string | null }>;
  trace: CalculationTraceNode[];
}
export interface MoonlightArtifactReactionRead {
  id: number; frame: number; actorId: string; tag: "lunar-charged-reaction" | "lunar-crystallize-reaction" | "lunar-bloom-direct";
  nightBonus: number; silkenBonus: number; totalBonus: number; sourceRefs: string[]; trace: CalculationTraceNode[];
}
export interface MoonlightArtifactCapturedState {
  frame: number; activeActorId: string | null;
  nightWindows: MoonlightArtifactBonusSnapshot["nightWindows"];
  silkenWindows: MoonlightArtifactBonusSnapshot["silkenWindows"];
}
export interface MoonlightArtifactProjection {
  moonlightArtifactLog?: MoonlightArtifactLogEntry[];
  moonlightArtifactReactionReads?: MoonlightArtifactReactionRead[];
  moonlightArtifactState?: MoonlightArtifactCapturedState;
}

type Window = { sourceActorId: string; expiresAtFrame: number };
const elemental = new Set(["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro"]);
const inputDescription: Record<string, { unit: "frame" | "indicator"; description: string }> = {
  snapshotFrame: { unit: "frame", description: "实际特殊贡献者属性取样帧" },
  expiryFrame: { unit: "frame", description: "同名状态到期帧" },
};

/** Two fixed-source four-piece callbacks, with per-character stat-mod removal. */
export class MoonlightArtifactRuntime {
  readonly log: MoonlightArtifactLogEntry[] = [];
  readonly reactionReads: MoonlightArtifactReactionRead[] = [];
  readonly assumptions: string[];
  private activeActorId: string | null;
  private readonly night = new Map<string, Window>();
  private readonly silken = new Map<string, Window>();
  constructor(readonly model: MoonlightArtifactModel, private readonly partyActorIds: readonly string[], initialActiveActorId: string | null) {
    this.activeActorId = initialActiveActorId;
    this.assumptions = ["固定a7穹境示现之夜／纺月的夜歌四件套回调已实际运行；静态二件套须已计入输入最终面板。a7四件套与本地月曜宿主合用仍为固定源码参考，未声明当前游戏实测。", "穹境只在佩戴者处于真实前台时由实际月曜转换刷新240帧CR窗口；月兆0仍登记0暴击率状态并可令全队获得10%月曜反应加成。纺月月兆0不注册回调；月兆1/2由佩戴者真实非物理元素敌人伤害刷新全队同名EM状态480帧，10%团队月曜加成不按佩戴者叠加。"];
  }
  get hasNight(): boolean { return this.model.actors.some(actor => actor.setId === "artifact-set:15041"); }
  completedSwap(nextActorId: string): void { this.activeActorId = nextActorId; }
  onLunarReaction(frame: number, reaction: MoonlightReaction, sourceActorId: string, triggerDamageEventId?: number): void {
    const event = reaction === "lunarCharged" ? "OnLunarCharged" : reaction === "lunarCrystallize" ? "OnLunarCrystallize" : "OnLunarBloom";
    for (const wearer of this.model.actors) {
      if (wearer.setId !== "artifact-set:15041" || wearer.actorId !== this.activeActorId) continue;
      const sourceRef = MOONLIGHT_ARTIFACT_BONUS_SOURCES.night, trace = new TraceBuilder([sourceRef]);
      const durationFrames = trace.add("moonlightArtifact.durationFrames", "穹境四秒换算为帧", expr.mul(expr.input("seconds"), expr.value(60)), [traceInput("seconds", 4, "seconds", sourceRef, "固定源码穹境持续秒数")], { status: "assumed", unit: "frame" });
      const expiresAtFrame = trace.add("moonlightArtifact.expiresAtFrame", "穹境触发帧加持续帧", expr.add(expr.input("triggerFrame"), expr.input("durationFrames")), [traceInput("triggerFrame", frame, "frame", sourceRef, "实际月曜反应帧"), traceInput("durationFrames", durationFrames, "frame", sourceRef, "持续帧数")], { status: "assumed", unit: "frame", childIds: ["moonlightArtifact.durationFrames"] });
      const critRate = trace.add("moonlightArtifact.critRate", "穹境月兆对应暴击率",
        expr.condition("equal", expr.input("moonsign"), expr.value(0), expr.value(0), expr.condition("equal", expr.input("moonsign"), expr.value(1), expr.value(0.15), expr.value(0.3))),
        [traceInput("moonsign", this.model.moonsignLevel, "count", sourceRef, "初始化时明确的月兆等级：0未激活、1初辉、2满辉")],
        { status: "assumed", unit: "ratio", explanationKey: "固定来源按初始化月兆选择0%、15%或30%暴击率；0%也登记该状态窗口。" });
      const previous = this.night.get(wearer.actorId);
      this.night.set(wearer.actorId, { sourceActorId: wearer.actorId, expiresAtFrame });
      this.log.push({ id: this.log.length, frame, ...(triggerDamageEventId === undefined ? {} : { triggerDamageEventId }), event, triggerActorId: sourceActorId, wearerActorId: wearer.actorId, setId: wearer.setId, sourceRef,
        applications: [{ receiverActorId: wearer.actorId, key: "gleaming-moon-intent-cr", value: critRate, stat: "critRate", expiresAtFrame, replacedSourceActorId: previous?.expiresAtFrame !== undefined && previous.expiresAtFrame > frame ? previous.sourceActorId : null }], trace: trace.nodes });
    }
  }
  /** OnEnemyDamage follows actual enemy damage delivery and reads AttackInfo.ActorIndex. */
  onEnemyDamage(frame: number, sourceActorId: string, element: string, triggerDamageEventId?: number): void {
    if (!elemental.has(element) || this.model.moonsignLevel === 0) return;
    const wearer = this.model.actors.find(actor => actor.actorId === sourceActorId && actor.setId === "artifact-set:15042");
    if (wearer === undefined) return;
    const sourceRef = MOONLIGHT_ARTIFACT_BONUS_SOURCES.silken, trace = new TraceBuilder([sourceRef]);
    const durationFrames = trace.add("moonlightArtifact.durationFrames", "纺月八秒换算为帧", expr.mul(expr.input("seconds"), expr.value(60)), [traceInput("seconds", 8, "seconds", sourceRef, "固定源码纺月持续秒数")], { status: "assumed", unit: "frame" });
    const expiresAtFrame = trace.add("moonlightArtifact.expiresAtFrame", "纺月命中帧加持续帧", expr.add(expr.input("triggerFrame"), expr.input("durationFrames")), [traceInput("triggerFrame", frame, "frame", sourceRef, "实际敌人伤害帧"), traceInput("durationFrames", durationFrames, "frame", sourceRef, "持续帧数")], { status: "assumed", unit: "frame", childIds: ["moonlightArtifact.durationFrames"] });
    const em = trace.add("moonlightArtifact.em", "纺月月兆对应全队元素精通",
      expr.condition("equal", expr.input("moonsign"), expr.value(1), expr.value(60), expr.value(120)),
      [traceInput("moonsign", this.model.moonsignLevel, "count", sourceRef, "初始化时明确的月兆等级：1初辉、2满辉；0未注册本回调")],
      { status: "assumed", unit: "stat", explanationKey: "固定来源初辉给予60精通、满辉给予120精通；同名团队窗口覆盖而不相加。" });
    const applications: MoonlightArtifactLogEntry["applications"] = [];
    for (const receiverActorId of this.partyActorIds) {
      const previous = this.silken.get(receiverActorId);
      this.silken.set(receiverActorId, { sourceActorId, expiresAtFrame });
      applications.push({ receiverActorId, key: "gleaming-moon-devotion-em", value: em, stat: "em", expiresAtFrame,
        replacedSourceActorId: previous !== undefined && previous.expiresAtFrame > frame ? previous.sourceActorId : null });
    }
    this.log.push({ id: this.log.length, frame, ...(triggerDamageEventId === undefined ? {} : { triggerDamageEventId }), event: "OnEnemyDamage", triggerActorId: sourceActorId, wearerActorId: wearer.actorId, setId: wearer.setId, sourceRef, applications, trace: trace.nodes });
  }
  /** A Stats read removes this character's expired StatMods before ReactBonus lookup. */
  statBonuses(actorId: string, frame: number): { critRate: number; em: number } {
    const night = this.night.get(actorId), silken = this.silken.get(actorId);
    if (night !== undefined && night.expiresAtFrame <= frame) this.night.delete(actorId);
    if (silken !== undefined && silken.expiresAtFrame <= frame) this.silken.delete(actorId);
    return { critRate: this.night.has(actorId) ? this.model.moonsignLevel === 0 ? 0 : this.model.moonsignLevel === 1 ? 0.15 : 0.3 : 0,
      em: this.silken.has(actorId) ? this.model.moonsignLevel === 1 ? 60 : 120 : 0 };
  }
  private snapshot(frame: number): MoonlightArtifactBonusSnapshot {
    for (const [actorId, row] of this.night) if (row.expiresAtFrame < frame) this.night.delete(actorId);
    for (const [actorId, row] of this.silken) if (row.expiresAtFrame < frame) this.silken.delete(actorId);
    return { sourceProfileId: this.model.mode, snapshotFrame: frame,
      nightWindows: [...this.night].map(([receiverActorId, row]) => ({ receiverActorId, ...row })),
      silkenWindows: [...this.silken].map(([receiverActorId, row]) => ({ receiverActorId, ...row })) };
  }
  reactionBonus(actorId: string, frame: number, branch: SpecialBranch): { value: number; snapshot: MoonlightArtifactBonusSnapshot; sourceRefs: string[] } {
    const snapshot = this.snapshot(frame), trace = new TraceBuilder([MOONLIGHT_ARTIFACT_BONUS_SOURCES.night, MOONLIGHT_ARTIFACT_BONUS_SOURCES.silken]);
    const values: Record<string, number> = {};
    for (const term of moonlightArtifactBonusStages(snapshot, branch)) {
      const inputs = { ...term.values, ...Object.fromEntries(term.dependencies.map(key => [key, values[key]!])) };
      values[term.suffix] = trace.add(`moonlightArtifact.${term.suffix}`, term.titleKey, term.expression,
        Object.entries(inputs).map(([key, value]) => traceInput(key, value, inputDescription[key]?.unit ?? term.unit,
          "actual-moonlight-contributor-snapshot", inputDescription[key]?.description ?? `${term.titleKey}中间量`)),
        { status: "assumed", unit: term.unit, explanationKey: term.explanationKey, sourceRefs: term.sourceRefs,
          childIds: term.dependencies.map(key => `moonlightArtifact.${key}`) });
    }
    const nightBonus = values.nightBonus!, silkenBonus = values.silkenBonus!, value = values.bonus!;
    const sourceRefs = [ ...(nightBonus > 0 ? [MOONLIGHT_ARTIFACT_BONUS_SOURCES.night] : []), ...(silkenBonus > 0 ? [MOONLIGHT_ARTIFACT_BONUS_SOURCES.silken] : []) ];
    this.reactionReads.push({ id: this.reactionReads.length, frame, actorId, tag: branch as MoonlightArtifactReactionRead["tag"], nightBonus, silkenBonus, totalBonus: value, sourceRefs, trace: trace.nodes });
    return { value, snapshot, sourceRefs };
  }
  stateAt(frame: number): MoonlightArtifactCapturedState {
    return { frame, activeActorId: this.activeActorId, nightWindows: this.snapshot(frame).nightWindows, silkenWindows: this.snapshot(frame).silkenWindows };
  }
  resultFields(frame: number): MoonlightArtifactProjection {
    return { moonlightArtifactLog: this.log, moonlightArtifactReactionReads: this.reactionReads, moonlightArtifactState: this.stateAt(frame) };
  }
}
