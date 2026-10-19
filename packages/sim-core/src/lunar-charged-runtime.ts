import type { LunarArtifactRuntime } from "./lunar-artifact-runtime";
import type { MoonlightArtifactProjection } from "./moonlight-artifact-runtime";
import type { AuraStateEntry, CharacterStats, CritMode, LunarChargedExecutionOptions, ResolvedEnemyTargetProfile, SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import { AuraEngine } from "./aura";
import { createSpecialReactionState, resolveSpecialConversion, SPECIAL_STATE_PROFILE_ID, transitionSpecialState, type SpecialAuraSnapshot, type SpecialDamageIntent, type SpecialStateLog, type SpecialStateTransition } from "./special-reaction-state";
import { calculateLunarChargedIntent } from "./lunar-charged-calculation";
import { CALCULATOR_RULE_VERSION, CALCULATOR_SCHEMA_VERSION, calculatorDocumentSchema, type CalculatorDocument } from "./calculator-model";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { SPECIAL_CRITICAL_RANDOM_PROFILE, specialExecutionDamage, type SpecialCriticalSampler, type SpecialRuntimeCriticalOutcome, type SpecialRuntimeRandomness } from "./special-random";

export interface LunarChargedDamageEvent extends SpecialRuntimeCriticalOutcome {
  id: number; frame: number; timeSeconds: number; ownerId: string; targetId: string;
  intent: SpecialDamageIntent;
  context: ReturnType<typeof calculateLunarChargedIntent>["context"];
  trace: ReturnType<typeof calculateLunarChargedIntent>["trace"];
  damage: number;
  auraBefore: AuraStateEntry[];
  auraConsumed: ReturnType<AuraEngine["consumeLunarChargedGaugeAt"]>["auraConsumed"];
  auraAfter: AuraStateEntry[];
}
export interface LunarChargedSimulationResult extends SpecialRuntimeRandomness, MoonlightArtifactProjection {
  schemaVersion: "lunar-charged-simulation-v1";
  profile: { id: "lunar-charged-reference-v1"; stateProfileId: typeof SPECIAL_STATE_PROFILE_ID; evidence: "fixed-source-provisional"; assumptions: string[] };
  baseResult: SimulationResult;
  specialDamageEvents: LunarChargedDamageEvent[];
  executionLog: SpecialStateLog[];
  totalDamage: number; totalDps: number; classicDamage: number; lunarChargedDamage: number;
}

export function lunarAuraOwners(aura: readonly AuraStateEntry[]): SpecialAuraSnapshot {
  const owners = (element: "hydro" | "electro"): string[] | undefined => {
    const entries = aura.filter(entry => entry.element === element && entry.gaugeUnits > 0);
    if (entries.some(entry => entry.sourceSlots === undefined)) return undefined;
    return [...new Set(entries.flatMap(entry => entry.sourceSlots!.filter(slot => slot.gaugeUnits > 0).map(slot => slot.sourceActorId)))];
  };
  const hydro = owners("hydro"), electro = owners("electro");
  return { ...(hydro === undefined ? {} : { hydro }), ...(electro === undefined ? {} : { electro }), cryo: [], frozen: aura.some(entry => entry.element === "frozen" && entry.gaugeUnits > 0) };
}

/** Validate the actual selected scope before any simulation mutations. */
export function validateLunarChargedProfile(config: SimConfig, options: LunarChargedExecutionOptions): void {
  if (options.party.length !== config.characters.length || options.party.some(member => !config.characters.some(character => character.id === member.actorId)) || new Set(options.party.map(member => member.actorId)).size !== options.party.length) throw new Error("月感电模式的 party 必须与模拟角色一一对应。");
  if (resolveSpecialConversion(options.party, "electroCharged").normalFallback) throw new Error("当前队伍没有来源已映射的月感电转换角色（伊涅芙／菲林斯／哥伦比娅）。");
  if (config.reactionEngine?.mode !== "aura-v3") throw new Error("月感电参考模式要求 aura-v3 逐角色元素量；不会隐式替换已选择的反应版本。");
  if (config.reactionEngine.initialAura?.length || config.enemy.targets?.some(target => target.initialAura?.length)) throw new Error("月感电模式的初始元素量必须由实际角色命中建立，初始无归属附着不可推定参与者。");
  if ((config.enemy.targets?.length ?? 1) !== 1 || config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) throw new Error("月感电参考模式只支持一个静止、可受击且位于范围内的目标。");
  if (config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1") throw new Error("月感电参考模式固定 60 FPS、无目标卡肉，使用 legacy-event-heap-v1 调度。");
  if (config.playerDamageModel.mode !== "disabled") throw new Error("月感电参考模式尚未接入玩家伤害反馈。");
  const definitions = config.timeline ? config.timeline.abilities : config.rotation;
  for (const action of definitions) for (const hit of action.hits ?? []) {
    const character = config.characters.find(actor => actor.id === action.actorId)!;
    const element = hit.element ?? character.element;
    if (!["hydro", "electro", "physical"].includes(element)) throw new Error(`月感电参考模式未实现与 ${element} 的混合反应；请移除该段或使用普通模式。`);
    if ((hit.reaction && hit.reaction !== "none") || (hit.reactionOverride && hit.reactionOverride !== "none")) throw new Error("月感电自动模式不接受手工反应覆写。");
  }
}

export class LunarChargedRuntime {
  readonly damageEvents: LunarChargedDamageEvent[] = [];
  readonly log: SpecialStateLog[] = [];
  private state = createSpecialReactionState();
  private nextWakeFrame: number | undefined;
  private readonly context;
  constructor(private readonly inputs: {
    config: SimConfig; options: LunarChargedExecutionOptions; target: ResolvedEnemyTargetProfile; aura: AuraEngine; critMode: CritMode;
    criticalSampler?: SpecialCriticalSampler;
    artifactRuntime?: LunarArtifactRuntime;
    snapshot: (actorId: string, frame: number) => CharacterStats;
    resistance: (frame: number) => number;
    beforeWake: (frame: number) => void;
    consumption: (frame: number, mutation: ReturnType<AuraEngine["consumeLunarChargedGaugeAt"]>) => void;
  }) {
    this.context = { party: inputs.options.party, profileId: SPECIAL_STATE_PROFILE_ID, spatialProfile: "single-stationary-target-in-range" as const, targetId: inputs.target.id,
      auraAt: (frame: number) => lunarAuraOwners(inputs.aura.getAuraStateAt(frame)) };
  }
  private accept(transition: SpecialStateTransition): void {
    if (transition.blockedMechanics.length) throw new Error(transition.blockedMechanics.map(entry => `${entry.field}: ${entry.reason}`).join("; "));
    this.state = transition.state; this.log.push(...transition.log); this.nextWakeFrame = transition.nextWakeFrame;
    for (const intent of transition.damageIntents) {
      if (intent.deliveryFrame !== intent.snapshotFrame) throw new Error("LC reference delivery must occur at the live snapshot frame");
      const snapshots = intent.contributorIds.map(actorId => {
        const stats = this.inputs.snapshot(actorId, intent.snapshotFrame);
        const actor = this.inputs.config.characters.find(character => character.id === actorId)!;
        return { actorId, level: actor.level, elementalMastery: stats.em, critRate: stats.critRate, critDamage: stats.critDmg, ...this.inputs.artifactRuntime?.snapshotFields(actorId, intent.snapshotFrame, intent.branch) };
      });
      const criticalExecution = this.inputs.criticalSampler?.sample(snapshots.map(snapshot => ({ id: snapshot.actorId, critRate: snapshot.critRate })), `lunar-charged:${intent.id}`, intent.snapshotFrame);
      const calculation = calculateLunarChargedIntent(intent, snapshots, this.inputs.resistance(intent.deliveryFrame), this.inputs.critMode, criticalExecution);
      const mutation = this.inputs.aura.consumeLunarChargedGaugeAt(intent.deliveryFrame);
      this.inputs.consumption(intent.deliveryFrame, mutation);
      this.damageEvents.push({ id: this.damageEvents.length, frame: intent.deliveryFrame, timeSeconds: intent.deliveryFrame / 60, ownerId: intent.ownerId, targetId: intent.targetId, intent, ...calculation, ...mutation });
      this.inputs.artifactRuntime?.moonlight?.onEnemyDamage(intent.deliveryFrame, intent.ownerId, intent.element);
    }
  }
  advanceThrough(frame: number): void {
    while (this.nextWakeFrame !== undefined && this.nextWakeFrame <= frame) {
      // Materialize each exact natural expiry before a scan advances the Aura
      // clock, otherwise two distinct deadlines can collapse into one log.
      this.inputs.beforeWake(this.nextWakeFrame);
      this.accept(transitionSpecialState(this.state, { kind: "advance", frame: this.nextWakeFrame }, this.context));
    }
  }
  application(event: { frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: "hydro" | "electro"; gaugeUnits: number; auraBefore: AuraStateEntry[]; converted: boolean }): void {
    this.accept(transitionSpecialState(this.state, { ...event, kind: "application", actualIcdAllowed: true, resolutionOrigin: "aura-engine", auraBefore: lunarAuraOwners(event.auraBefore), ...(event.converted ? { ordinaryReaction: "electroCharged" as const } : {}) }, this.context));
  }
  result(baseResult: SimulationResult): LunarChargedSimulationResult {
    const lunarChargedDamage = this.damageEvents.reduce((sum, event) => sum + event.damage, 0);
    const totalDamage = baseResult.totalDamage + lunarChargedDamage;
    return { schemaVersion: "lunar-charged-simulation-v1", baseResult, specialDamageEvents: this.damageEvents, executionLog: this.log, ...this.inputs.artifactRuntime?.moonlight?.resultFields(Math.round(baseResult.config.duration * 60)), totalDamage, totalDps: totalDamage / baseResult.config.duration, classicDamage: baseResult.totalDamage, lunarChargedDamage,
      ...(this.inputs.criticalSampler === undefined ? {} : { specialCriticalPolicy: SPECIAL_CRITICAL_RANDOM_PROFILE }),
      profile: { id: "lunar-charged-reference-v1", stateProfileId: SPECIAL_STATE_PROFILE_ID, evidence: "fixed-source-provisional", assumptions: [...(this.inputs.artifactRuntime?.assumptions ?? []), "单个静止范围内目标；60 FPS、无卡肉；水／雷／物理攻击。", "当前配置的面板、增益、减抗与能量照常执行；只启用实际映射的月感电转换被动，不自动补角色未建模天赋。", "除显式选择的月曜圣遗物条款外，月感电专属基础提升、增伤、加算与擢升均为本参考配置显式 0／1；普通增伤和普通反应加成不移植。", "雷云初次扫描 +9 帧，后续每 6 帧，目标间隔 120 帧，存在时间 330 帧；同帧雷云任务先于下一次普通事件。", "公式与状态来自锁定来源版本，尚未声明当前游戏实测完成。"] } };
  }
}

export function lunarChargedEventToCalculatorDocument(result: LunarChargedSimulationResult, eventId: number): CalculatorDocument {
  const event = result.specialDamageEvents.find(candidate => candidate.id === eventId);
  if (!event) throw new Error(`Unknown Lunar-Charged event ${eventId}`);
  const replay = calculateSpecialCalculatorHit(event.context);
  const damage = specialExecutionDamage(replay, result.baseResult.resolvedRuntimeOptions.critMode);
  if (damage === undefined) throw new Error("Captured LC calculation is blocked");
  if (!Number.isFinite(event.damage) || !Number.isFinite(damage) || Math.abs(damage - event.damage) > 1e-10 * Math.max(1, Math.abs(event.damage))) throw new Error("Lunar-Charged captured context does not reproduce its event");
  const first = event.context.contributors[0]!;
  return calculatorDocumentSchema.parse({ schemaVersion: CALCULATOR_SCHEMA_VERSION, ruleVersion: CALCULATOR_RULE_VERSION, id: `lunar-event-${event.id}`, label: `月感电 #${event.id} · 第 ${event.frame} 帧`, scope: "single-hit", characterLevel: first.base.kind === "level-base" ? first.base.characterLevel : 90,
    build: { mode: "imported-final", source: "月感电使用每名参与者的完整上下文；此面板不进入特殊公式。", stats: { atk: 0, hp: 0, def: 0, em: first.elementalMastery, critRate: first.critRate, critDamage: first.critDamage } },
    enemy: { level: result.baseResult.enemyTargets[0]!.level, resistance: event.context.effectiveResistance, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ kind: "special", id: "captured-special", label: "状态驱动月感电", context: event.context, sourceRefs: event.intent.sourceRefs, dependencies: ["lunar-reference-profile"] }], selectedHitIds: ["captured-special"], assumptions: [...result.profile.assumptions, `原始事件数值 ${event.damage}；模式 ${result.baseResult.resolvedRuntimeOptions.critMode}。`], dependencies: [{ id: "lunar-reference-profile", status: "provisional", reason: "锁定来源公式与状态参考配置，未声称当前游戏逐帧实测。", sourceRefs: event.intent.sourceRefs }], dataIdentity: { datasetId: result.baseResult.reproducibilityKey, gameVersion: "Luna VI reference", releaseStatus: "unknown", evidenceStatus: "provisional" } });
}
