import type { CapturedStellarConductAdjustment, Element, SimConfig, SimulationResult, StellarConductExecutionOptions } from "@genshin-dps-lab/schemas";
import { expr, traceInput, TraceBuilder } from "./calculation-trace";
import { createSpecialReactionState, resolveSpecialConversion, SPECIAL_STATE_PROFILE_ID, SPECIAL_STATE_REGISTRY, transitionSpecialState, type SpecialStateLog, type SpecialStateTransition } from "./special-reaction-state";
import { STELLAR_ARTIFACT_SOURCE, type StellarArtifactCapturedState, type StellarArtifactLogEntry, type StellarArtifactRuntime } from "./stellar-artifact-runtime";

const sources = [...SPECIAL_STATE_REGISTRY["stellar-conduct"].sourceRefs];
export interface StellarConductPanelSnapshot { frame: number; activeCount: number; damageBonus: number; expiresAtFrame: number; }
export interface StellarConductSimulationResult {
  schemaVersion: "stellar-conduct-simulation-v1";
  profile: { id: "stellar-conduct-reference-v1"; stateProfileId: typeof SPECIAL_STATE_PROFILE_ID; evidence: "fixed-source-provisional"; assumptions: string[] };
  baseResult: SimulationResult; totalDamage: number; totalDps: number; executionLog: SpecialStateLog[];
  fieldInfluences: Array<CapturedStellarConductAdjustment & { eventId: number; frame: number; element: Element }>;
  blockers: Array<{ mechanic: string; field: string; reason: string; sourceRefs: string[] }>;
  stellarArtifactLog?: StellarArtifactLogEntry[];
  stellarArtifactState?: StellarArtifactCapturedState;
}
export function validateStellarConductProfile(config: SimConfig, options: StellarConductExecutionOptions): void {
  if (options.party.length !== config.characters.length || new Set(options.party.map(member => member.actorId)).size !== options.party.length || options.party.some(member => !config.characters.some(actor => actor.id === member.actorId))) throw new Error("星导 party 必须与实际角色一一对应。");
  if (resolveSpecialConversion(options.party, "superconduct").normalFallback) throw new Error("星导需要明确的转换身份：Sandrone、Odette 或 travelercryo；身份不提供缺失面板与能力。");
  if (config.reactionEngine?.mode !== "aura-v3") throw new Error("星导参考配置要求 aura-v3。");
  if (config.reactionEngine.initialAura?.length || config.enemy.targets?.some(target => target.initialAura?.length)) throw new Error("星导参考配置要求由实际命中建立初始元素附着。");
  if ((config.enemy.targets?.length ?? 1) !== 1 || config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) throw new Error("星导参考配置限单个静止且位于领域内的目标与队伍。");
  if (config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1" || config.playerDamageModel.mode !== "disabled") throw new Error("星导参考配置要求 60 FPS、无卡肉、legacy-event-heap-v1，暂不接玩家伤害反馈。");
  for (const action of config.timeline ? config.timeline.abilities : config.rotation) for (const hit of action.hits ?? []) {
    const element = hit.element ?? config.characters.find(actor => actor.id === action.actorId)!.element;
    if (!["cryo", "electro", "physical"].includes(element)) throw new Error(`星导参考配置未实现 ${element} 混合反应。`);
    if ((hit.reaction && hit.reaction !== "none") || (hit.reactionOverride && hit.reactionOverride !== "none")) throw new Error("星导自动模式不接受手工反应覆写。");
  }
}
/** The executed arithmetic also powers restoration, so field provenance cannot diverge from damage factors. */
export function executeStellarConductAdjustment(context: CapturedStellarConductAdjustment) {
  const trace = new TraceBuilder(context.sourceRefs);
  const input = (key: string, value: number, meaning: string) => traceInput(key, value, "ratio", "actual-stellar-conduct-field", meaning);
  const bonuses = [0.2, 0.29, 0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4];
  let lookup = expr.value(bonuses[12]!);
  for (let count = 11; count >= 0; count--) lookup = expr.condition("equal", expr.input("applicationCount"), expr.value(count), expr.value(bonuses[count]!), lookup);
  const selectedBonus = trace.add("stellarConductCountBonus", "领域公布计数对应冰雷增伤", expr.condition("equal", expr.input("eligibleElement"), expr.value(1), lookup, expr.value(0)), [traceInput("applicationCount", context.activeCount, "count", "actual-field-publication", "本次领域发布的有效附着计数，上限 12"), traceInput("eligibleElement", context.damageBonus > 0 ? 1 : 0, "indicator", "actual-hit-element", "本段为冰或雷时为 1，否则为 0")], { explanationKey: "固定来源增伤表：0 次为 20%，1 次为 29%，其后逐次增加 1%，12 次为 40%；普通物理伤害不获得此增伤。" });
  if (selectedBonus !== context.damageBonus) throw new Error("星导捕获增伤与实际发布计数不一致。");
  const damageBonus = trace.add("stellarConductDamageBonus", "星导领域与普通增伤合计", expr.add(expr.input("ordinaryBonus"), expr.input("fieldBonus")), [input("ordinaryBonus", context.baseDamageBonus, "领域外的普通伤害加成"), input("fieldBonus", selectedBonus, "实际发布且按本段快照规则取得的冰雷增伤")], { explanationKey: `领域公布计数 ${context.activeCount}；角色增伤取样于第 ${context.snapshotFrame} 帧。` });
  const effectiveResistance = trace.add("stellarConductResistance", "星导领域后的有效抗性", expr.sub(expr.sub(expr.input("baseResistance"), expr.input("ordinaryShred")), expr.input("fieldShred")), [input("baseResistance", context.baseResistance, "目标基础抗性"), input("ordinaryShred", context.ordinaryResistanceShred, "其他来源与本段减抗"), input("fieldShred", context.physicalResistanceReduction, "命中时仍有效的星导物理减抗")], { explanationKey: "目标抗性在实际命中时读取；来源配置的领域物理减抗为 40%。" });
  return { damageBonus, effectiveResistance, trace: trace.nodes };
}
export class StellarConductRuntime {
  readonly log: SpecialStateLog[] = [];
  readonly fieldInfluences: StellarConductSimulationResult["fieldInfluences"] = [];
  private state = createSpecialReactionState();
  private nextWakeFrame: number | undefined;
  private issued: StellarConductPanelSnapshot = { frame: 0, activeCount: 0, damageBonus: 0, expiresAtFrame: 0 };
  private readonly context;
  constructor(private readonly inputs: { config: SimConfig; options: StellarConductExecutionOptions; targetId: string; beforeWake: (frame: number) => void; artifactRuntime?: StellarArtifactRuntime }) {
    validateStellarConductProfile(inputs.config, inputs.options);
    this.context = { party: inputs.options.party, profileId: SPECIAL_STATE_PROFILE_ID, spatialProfile: "single-stationary-target-in-range" as const, targetId: inputs.targetId, auraAt: () => ({}) };
  }
  private accept(transition: SpecialStateTransition): void {
    if (transition.blockedMechanics.length || transition.damageIntents.length) throw new Error("星导领域配置不得推定未声明的直接星导能力伤害。");
    this.state = transition.state; this.nextWakeFrame = transition.nextWakeFrame;
    for (const entry of transition.log) {
      this.log.push({ ...entry, id: this.log.length });
      if (entry.type === "field-buffs") this.issued = { frame: entry.frame, activeCount: Number(entry.details.applicationCount), damageBonus: Number(entry.details.cryoAndElectroBonus), expiresAtFrame: Number(entry.details.expiresAt) };
    }
  }
  advanceThrough(frame: number): void {
    while (this.nextWakeFrame !== undefined && this.nextWakeFrame <= frame) {
      const due = this.nextWakeFrame; this.inputs.beforeWake(due);
      this.accept(transitionSpecialState(this.state, { kind: "advance", frame: due }, this.context));
    }
  }
  application(event: { frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: "cryo" | "electro"; gaugeUnits: number; converted: boolean }): void {
    this.accept(transitionSpecialState(this.state, { ...event, kind: "application", actualIcdAllowed: true, resolutionOrigin: "aura-engine", ...(event.converted ? { ordinaryReaction: "superconduct" as const } : {}) }, this.context));
    if (event.converted) this.inputs.artifactRuntime?.onReaction(event.frame, event.sourceActorId, "stellar-conduct");
  }
  panelSnapshot(frame: number): StellarConductPanelSnapshot {
    return this.issued.expiresAtFrame > frame ? { ...this.issued, frame } : { frame, activeCount: 0, damageBonus: 0, expiresAtFrame: 0 };
  }
  adjustment(frame: number, element: Element, panel: StellarConductPanelSnapshot, baseDamageBonus: number, baseResistance: number, ordinaryResistanceShred: number): CapturedStellarConductAdjustment | undefined {
    const damageBonus = element === "cryo" || element === "electro" ? panel.damageBonus : 0;
    const physicalResistanceReduction = element === "physical" && this.issued.expiresAtFrame > frame ? 0.4 : 0;
    if (!damageBonus && !physicalResistanceReduction) return undefined;
    return { snapshotFrame: panel.frame, activeCount: physicalResistanceReduction ? this.issued.activeCount : panel.activeCount, fieldPresent: (this.state.polestar?.expiresAt ?? 0) > frame, buffExpiresAtFrame: physicalResistanceReduction ? this.issued.expiresAtFrame : panel.expiresAtFrame, baseDamageBonus, damageBonus, baseResistance, ordinaryResistanceShred, physicalResistanceReduction, sourceRefs: [...sources] };
  }
  result(baseResult: SimulationResult): StellarConductSimulationResult {
    return { schemaVersion: "stellar-conduct-simulation-v1", baseResult, totalDamage: baseResult.totalDamage, totalDps: baseResult.totalDamage / baseResult.config.duration, executionLog: this.log, fieldInfluences: this.fieldInfluences,
      ...(this.inputs.artifactRuntime === undefined ? {} : { stellarArtifactLog: this.inputs.artifactRuntime.log, stellarArtifactState: this.inputs.artifactRuntime.stateAt(Math.ceil(baseResult.config.duration * 60)) }),
      profile: { id: "stellar-conduct-reference-v1", stateProfileId: SPECIAL_STATE_PROFILE_ID, evidence: "fixed-source-provisional", assumptions: ["单个静止目标与队伍均在领域范围内；60 FPS、无卡肉；冰／雷／物理输入。", "真实 ICD 后冰雷按 1:1 消耗对方附着，取代普通超导伤害及其 12 秒减抗。", "领域 360 帧；创建即时发布、每 240 帧发布累计计数，增益维持 241 帧；刷新领域不重置发布相位。", "每角色 6 帧计数间隔、同一攻击去重、上限 12；创建该领域的攻击不计数。", "冰雷增伤遵循本段动作／命中快照；物理减抗在实际命中时读取。", "固定来源参考实现，未声明当前游戏实测完成。", ...(this.inputs.artifactRuntime === undefined ? [] : [`仅执行已声明固定a7星辉圣遗物的动态四件套，静态二件套攻击已由基线提供；星导本身无独立特殊伤害。来源：${STELLAR_ARTIFACT_SOURCE.heart}；${STELLAR_ARTIFACT_SOURCE.scarlet}。`])] },
      blockers: [{ mechanic: "stellar-conduct-direct", field: "sourceAbilityDefinitions", reason: "本配置已执行领域对普通命中的作用；没有根据角色名字推定直接星导能力、倍率或附着。", sourceRefs: [...sources] }] };
  }
}
