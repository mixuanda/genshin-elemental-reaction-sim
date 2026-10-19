import type { LunarArtifactRuntime } from "./lunar-artifact-runtime";
import type { MoonlightArtifactProjection } from "./moonlight-artifact-runtime";
import type { AuraStateEntry, CharacterStats, CritMode, LunarMixedExecutionOptions, LunarMixedV2ExecutionOptions, ResolvedEnemyTargetProfile, SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import { AuraEngine, type LunarMixedGeoResolution } from "./aura";
import { createSpecialReactionState, resolveSpecialConversion, SPECIAL_STATE_PROFILE_ID, transitionSpecialState, type SpecialDamageIntent, type SpecialStateLog, type SpecialStateTransition, type SpecialStateContext } from "./special-reaction-state";
import { calculateLunarChargedIntent, type LunarChargedContributorSnapshot } from "./lunar-charged-calculation";
import { calculateLunarCrystallizeIntent } from "./lunar-crystallize-calculation";
import { lunarAuraOwners, type LunarChargedDamageEvent } from "./lunar-charged-runtime";
import { CALCULATOR_RULE_VERSION, CALCULATOR_SCHEMA_VERSION, calculatorDocumentSchema, type CalculatorDocument } from "./calculator-model";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { SPECIAL_CRITICAL_RANDOM_PROFILE, specialExecutionDamage, type SpecialCriticalExecution, type SpecialCriticalSampler, type SpecialRuntimeRandomness } from "./special-random";

export interface LunarMixedQueueTask { kind: "state-wake" | "delivery"; frame: number; intentId?: number; }
export interface LunarMixedExecutionOrder { frame: number; priority: number; sequence: number; }
export interface LunarMixedDamageEvent extends LunarChargedDamageEvent { executionOrder: LunarMixedExecutionOrder; }
export interface LunarMixedConversionEvent {
  id: number; frame: number; sourceActorId: string; sourceEventId: string; attackId: string;
  reaction: "lunar-charged" | "lunar-crystallize" | "geo-budget-only";
  auraBefore: AuraStateEntry[]; auraAfter: AuraStateEntry[];
  geoResolution?: LunarMixedGeoResolution;
}
export interface LunarMixedSimulationResult extends SpecialRuntimeRandomness, MoonlightArtifactProjection {
  schemaVersion: "lunar-mixed-simulation-v1";
  profile: { id: "lunar-mixed-reference-v1"; stateProfileId: typeof SPECIAL_STATE_PROFILE_ID; evidence: "fixed-source-provisional"; assumptions: string[] };
  baseResult: SimulationResult;
  specialDamageEvents: LunarMixedDamageEvent[];
  conversionEvents: LunarMixedConversionEvent[];
  executionLog: SpecialStateLog[];
  totalDamage: number; totalDps: number; classicDamage: number; lunarChargedDamage: number; lunarCrystallizeDamage: number;
}

export function validateLunarMixedProfile(config: SimConfig, options: LunarMixedExecutionOptions): void {
  if (options.party.length !== config.characters.length || new Set(options.party.map(member => member.actorId)).size !== options.party.length || options.party.some(member => !config.characters.some(character => character.id === member.actorId))) throw new Error("混合 Lunar party 必须与模拟角色一一对应。");
  for (const reaction of ["electroCharged", "crystallizeHydro"] as const) if (resolveSpecialConversion(options.party, reaction).normalFallback) throw new Error(`混合 Lunar 缺少 ${reaction} 的固定来源转换资格；两个分支分别检查，不能以一个分支的资格替代另一个。`);
  if (config.reactionEngine?.mode !== "aura-v3") throw new Error("混合 Lunar 参考配置要求 aura-v3 逐角色附着所有权。");
  if (config.reactionEngine.initialAura?.length || config.enemy.targets?.some(target => target.initialAura?.length)) throw new Error("混合 Lunar 初始附着须由实际命中建立，不能猜测初始参与者。");
  if ((config.enemy.targets?.length ?? 1) !== 1 || config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) throw new Error("混合 Lunar 参考配置仅支持单个静止、范围内目标。");
  if (config.timeline?.mode !== "legal-frame-v1" || config.timeline.fps !== 60 || config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1" || config.playerDamageModel.mode !== "disabled") throw new Error("混合 Lunar 要求 legal-frame-v1、60 FPS、无卡肉、legacy-event-heap-v1，不接玩家伤害反馈。");
  for (const action of config.timeline.abilities) for (const hit of action.hits ?? []) {
    const actor = config.characters.find(character => character.id === action.actorId)!;
    const element = hit.element ?? actor.element;
    if (!["hydro", "electro", "geo", "physical"].includes(element)) throw new Error(`混合 Lunar 尚未实现 ${element} 的完整反应顺序；本配置仅允许水、雷、岩、物理，不能将独立月绽放或 Stellar 直接叠加。`);
    if ((hit.reaction && hit.reaction !== "none") || (hit.reactionOverride && hit.reactionOverride !== "none")) throw new Error("混合 Lunar 自动转换不接受手工反应覆写。");
  }
}

/** One state, one live Aura, and the host's actual queue for both Lunar branches. */
export class LunarMixedRuntime {
  readonly damageEvents: LunarMixedDamageEvent[] = [];
  readonly conversionEvents: LunarMixedConversionEvent[] = [];
  readonly log: SpecialStateLog[] = [];
  protected state = createSpecialReactionState();
  private nextWakeFrame: number | undefined;
  private readonly queuedWakeFrames = new Set<number>();
  private readonly pending = new Map<number, { intent: SpecialDamageIntent; snapshots: LunarChargedContributorSnapshot[]; criticalExecution?: SpecialCriticalExecution }>();
  protected readonly context: SpecialStateContext;
  constructor(protected readonly inputs: {
    config: SimConfig; options: LunarMixedExecutionOptions | LunarMixedV2ExecutionOptions; target: ResolvedEnemyTargetProfile; aura: AuraEngine; critMode: CritMode;
    criticalSampler?: SpecialCriticalSampler;
    artifactRuntime?: LunarArtifactRuntime;
    snapshot: (actorId: string, frame: number) => CharacterStats;
    resistance: (element: "electro" | "geo", frame: number) => number;
    beforeWake: (frame: number) => void;
    scheduleTask: (task: LunarMixedQueueTask) => void;
    consumption: (order: LunarMixedExecutionOrder, mutation: ReturnType<AuraEngine["consumeLunarChargedGaugeAt"]>) => void;
  }) {
    this.context = { party: inputs.options.party, profileId: SPECIAL_STATE_PROFILE_ID, spatialProfile: "single-stationary-target-in-range" as const, targetId: inputs.target.id, auraAt: (frame: number) => lunarAuraOwners(inputs.aura.getAuraStateAt(frame)) };
  }
  protected accept(transition: SpecialStateTransition, order?: LunarMixedExecutionOrder): void {
    if (transition.blockedMechanics.length) throw new Error(transition.blockedMechanics.map(entry => `${entry.field}: ${entry.reason}`).join("; "));
    this.state = transition.state; this.nextWakeFrame = transition.nextWakeFrame;
    for (const entry of transition.log) this.log.push({ ...entry, id: this.log.length });
    for (const intent of transition.damageIntents) {
      const snapshots = intent.contributorIds.map(actorId => {
        const actor = this.inputs.config.characters.find(character => character.id === actorId)!;
        const stats = this.inputs.snapshot(actorId, intent.snapshotFrame);
        return { actorId, level: actor.level, elementalMastery: stats.em, critRate: stats.critRate, critDamage: stats.critDmg, ...this.inputs.artifactRuntime?.snapshotFields(actorId, intent.snapshotFrame, intent.branch) };
      });
      // Lunar-Crystallize rolls at the per-projectile character snapshot, not ten frames later on delivery.
      const criticalExecution = this.inputs.criticalSampler?.sample(snapshots.map(snapshot => ({ id: snapshot.actorId, critRate: snapshot.critRate })), `${intent.branch}:${intent.id}`, intent.snapshotFrame);
      if (intent.branch === "lunar-charged-reaction") {
        if (order === undefined || intent.snapshotFrame !== order.frame || intent.deliveryFrame !== order.frame) throw new Error("混合雷云伤害必须在实际扫描任务即时完成。");
        const calculation = calculateLunarChargedIntent(intent, snapshots, this.inputs.resistance("electro", order.frame), this.inputs.critMode, criticalExecution);
        const mutation = this.inputs.aura.consumeLunarChargedGaugeAt(order.frame);
        this.inputs.consumption(order, mutation);
        this.damageEvents.push({ id: this.damageEvents.length, frame: order.frame, timeSeconds: order.frame / 60, ownerId: intent.ownerId, targetId: intent.targetId, intent, ...calculation, ...mutation, executionOrder: { ...order } });
        this.inputs.artifactRuntime?.moonlight?.onEnemyDamage(order.frame, intent.ownerId, intent.element);
      } else if (intent.branch === "lunar-crystallize-reaction" && intent.onDelivery.length === 0) {
        this.pending.set(intent.id, { intent, snapshots, ...(criticalExecution === undefined ? {} : { criticalExecution }) });
        this.inputs.scheduleTask({ kind: "delivery", frame: intent.deliveryFrame, intentId: intent.id });
      } else throw new Error(`混合 Lunar 未接入分支 ${intent.branch}`);
    }
    if (this.nextWakeFrame !== undefined && !this.queuedWakeFrames.has(this.nextWakeFrame)) {
      this.queuedWakeFrames.add(this.nextWakeFrame);
      this.inputs.scheduleTask({ kind: "state-wake", frame: this.nextWakeFrame });
    }
  }
  runScheduledTask(task: LunarMixedQueueTask, order: LunarMixedExecutionOrder): void {
    this.inputs.beforeWake(task.frame);
    if (task.kind === "state-wake") {
      this.queuedWakeFrames.delete(task.frame);
      if (task.frame !== this.nextWakeFrame || task.frame < this.state.frame) return;
      this.accept(transitionSpecialState(this.state, { kind: "advance", frame: task.frame }, this.context), order);
      return;
    }
    const pending = this.pending.get(task.intentId!);
    if (pending === undefined) throw new Error("月结晶投射缺少已经执行的逐弹取样任务。");
    this.pending.delete(task.intentId!);
    const { intent, snapshots, criticalExecution } = pending;
    const calculation = calculateLunarCrystallizeIntent(intent, snapshots, this.inputs.resistance("geo", task.frame), this.inputs.critMode, criticalExecution);
    const aura = this.inputs.aura.getAuraStateAt(task.frame);
    this.damageEvents.push({ id: this.damageEvents.length, frame: task.frame, timeSeconds: task.frame / 60, ownerId: intent.ownerId, targetId: intent.targetId, intent, ...calculation, auraBefore: aura, auraConsumed: [], auraAfter: structuredClone(aura), executionOrder: { ...order } });
    this.inputs.artifactRuntime?.moonlight?.onEnemyDamage(task.frame, intent.ownerId, intent.element);
  }
  application(event: { frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: "hydro" | "electro" | "geo"; gaugeUnits: number; auraBefore: AuraStateEntry[]; auraAfter: AuraStateEntry[]; lunarCharged: boolean; lunarCrystallize: boolean; geoResolution?: LunarMixedGeoResolution }): void {
    if (event.lunarCharged || event.lunarCrystallize || event.geoResolution !== undefined) this.conversionEvents.push({ id: this.conversionEvents.length, frame: event.frame, sourceActorId: event.sourceActorId, sourceEventId: event.sourceEventId, attackId: event.attackId, reaction: event.lunarCharged ? "lunar-charged" : event.lunarCrystallize ? "lunar-crystallize" : "geo-budget-only", auraBefore: structuredClone(event.auraBefore), auraAfter: structuredClone(event.auraAfter), ...(event.geoResolution === undefined ? {} : { geoResolution: event.geoResolution }) });
    this.accept(transitionSpecialState(this.state, { ...event, kind: "application", actualIcdAllowed: true, resolutionOrigin: "aura-engine", auraBefore: lunarAuraOwners(event.geoResolution?.hydroAuraBefore ?? event.auraBefore), ...(event.lunarCharged ? { ordinaryReaction: "electroCharged" as const } : event.lunarCrystallize ? { ordinaryReaction: "crystallizeHydro" as const } : {}) }, this.context));
  }
  result(baseResult: SimulationResult): LunarMixedSimulationResult {
    const lunarChargedDamage = this.damageEvents.filter(event => event.intent.branch === "lunar-charged-reaction").reduce((sum, event) => sum + event.damage, 0);
    const lunarCrystallizeDamage = this.damageEvents.filter(event => event.intent.branch === "lunar-crystallize-reaction").reduce((sum, event) => sum + event.damage, 0);
    const totalDamage = baseResult.totalDamage + lunarChargedDamage + lunarCrystallizeDamage;
    return { schemaVersion: "lunar-mixed-simulation-v1", baseResult, specialDamageEvents: this.damageEvents, conversionEvents: this.conversionEvents, executionLog: this.log, ...this.inputs.artifactRuntime?.moonlight?.resultFields(Math.round(baseResult.config.duration * 60)), totalDamage, totalDps: totalDamage / baseResult.config.duration, classicDamage: baseResult.totalDamage, lunarChargedDamage, lunarCrystallizeDamage,
      ...(this.inputs.criticalSampler === undefined ? {} : { specialCriticalPolicy: SPECIAL_CRITICAL_RANDOM_PROFILE }),
      profile: { id: "lunar-mixed-reference-v1", stateProfileId: SPECIAL_STATE_PROFILE_ID, evidence: "fixed-source-provisional", assumptions: [...(this.inputs.artifactRuntime?.assumptions ?? []), "单个静止范围内目标，60 FPS、无卡肉；仅水、雷、岩、物理输入。", "队伍分别满足月感电、月结晶的固定来源转换资格；不由角色名字推定技能和面板。", "同一 Aura 和同一主事件堆：状态取样任务 priority 2.5，普通命中及月结晶投射 priority 3；各自同优先级按实际入队顺序。", "岩命中先尝试普通雷结晶，剩余岩量再尝试月结晶；保留雷晶片，抑制普通感电和水晶片。", "雷云扫描即时读取参与者并扣每人水、雷各最多 0.4U；月笼锁定参与者，逐弹取样并于 10 帧后读取抗性投递。", "除显式选择的月曜圣遗物条款外，特殊基础提升、增伤、加算、擢升和额外攻击为本参考配置显式 0／1；未自动补未建模角色天赋。", "固定源码参考配置尚未声明当前游戏实测完成；Dendro、冻结、Stellar 及多目标混合未纳入。"] } };
  }
}

export function lunarMixedEventToCalculatorDocument(result: LunarMixedSimulationResult, eventId: number): CalculatorDocument {
  const event = result.specialDamageEvents.find(candidate => candidate.id === eventId);
  if (!event) throw new Error(`Unknown mixed Lunar event ${eventId}`);
  const replay = calculateSpecialCalculatorHit(event.context), mode = result.baseResult.resolvedRuntimeOptions.critMode;
  const damage = specialExecutionDamage(replay, mode);
  if (damage === undefined || !Number.isFinite(event.damage) || !Number.isFinite(damage) || Math.abs(damage - event.damage) > 1e-10 * Math.max(1, Math.abs(event.damage))) throw new Error("Mixed Lunar captured context does not reproduce its event");
  const first = event.context.contributors[0]!;
  return calculatorDocumentSchema.parse({ schemaVersion: CALCULATOR_SCHEMA_VERSION, ruleVersion: CALCULATOR_RULE_VERSION, id: `lunar-mixed-event-${event.id}`, label: `混合 Lunar ${event.intent.branch} #${event.id} · 第 ${event.frame} 帧`, scope: "single-hit", characterLevel: first.base.kind === "level-base" ? first.base.characterLevel : 90,
    build: { mode: "imported-final", source: "使用实际共享队列事件的全部贡献者快照；此面板不进入特殊公式。", stats: { atk: 0, hp: 0, def: 0, em: first.elementalMastery, critRate: first.critRate, critDamage: first.critDamage } }, enemy: { level: result.baseResult.enemyTargets[0]!.level, resistance: event.context.effectiveResistance, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ kind: "special", id: "captured-special", label: "混合状态实际 Lunar 命中", context: event.context, sourceRefs: event.intent.sourceRefs, dependencies: ["lunar-mixed-reference-profile"] }], selectedHitIds: ["captured-special"], assumptions: [...result.profile.assumptions, `原始事件 ${event.damage}；模式 ${mode}；主队列 ${JSON.stringify(event.executionOrder)}。`], dependencies: [{ id: "lunar-mixed-reference-profile", status: "provisional", reason: "固定来源共享状态参考配置，精确复现不等于官服机制验证。", sourceRefs: event.intent.sourceRefs }], dataIdentity: { datasetId: result.baseResult.reproducibilityKey, gameVersion: "Luna VI reference", releaseStatus: "unknown", evidenceStatus: "provisional" } });
}
