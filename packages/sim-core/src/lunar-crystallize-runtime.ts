import type { LunarArtifactRuntime } from "./lunar-artifact-runtime";
import type { MoonlightArtifactProjection } from "./moonlight-artifact-runtime";
import type { AuraStateEntry, CharacterStats, CritMode, LunarCrystallizeExecutionOptions, ResolvedEnemyTargetProfile, SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import { AuraEngine } from "./aura";
import { createSpecialReactionState, resolveSpecialConversion, SPECIAL_STATE_PROFILE_ID, transitionSpecialState, type SpecialDamageIntent, type SpecialStateLog, type SpecialStateTransition } from "./special-reaction-state";
import { calculateLunarCrystallizeIntent } from "./lunar-crystallize-calculation";
import { lunarAuraOwners, type LunarChargedDamageEvent } from "./lunar-charged-runtime";
import { CALCULATOR_RULE_VERSION, CALCULATOR_SCHEMA_VERSION, calculatorDocumentSchema, type CalculatorDocument } from "./calculator-model";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import type { LunarChargedContributorSnapshot } from "./lunar-charged-calculation";
import { SPECIAL_CRITICAL_RANDOM_PROFILE, specialExecutionDamage, type SpecialCriticalExecution, type SpecialCriticalSampler, type SpecialRuntimeRandomness } from "./special-random";

export type LunarCrystallizeDamageEvent = LunarChargedDamageEvent;
export interface LunarCrystallizeSimulationResult extends SpecialRuntimeRandomness, MoonlightArtifactProjection {
  schemaVersion: "lunar-crystallize-simulation-v1";
  profile: { id: "lunar-crystallize-reference-v1"; stateProfileId: typeof SPECIAL_STATE_PROFILE_ID; evidence: "fixed-source-provisional"; assumptions: string[] };
  baseResult: SimulationResult;
  specialDamageEvents: LunarCrystallizeDamageEvent[];
  executionLog: SpecialStateLog[];
  totalDamage: number; totalDps: number; classicDamage: number; lunarCrystallizeDamage: number;
}

export function validateLunarCrystallizeProfile(config: SimConfig, options: LunarCrystallizeExecutionOptions): void {
  if (options.party.length !== config.characters.length || options.party.some(member => !config.characters.some(character => character.id === member.actorId)) || new Set(options.party.map(member => member.actorId)).size !== options.party.length) throw new Error("月结晶模式的 party 必须与模拟角色一一对应。");
  if (resolveSpecialConversion(options.party, "crystallizeHydro").normalFallback) throw new Error("当前队伍没有来源已映射的月结晶转换角色（兹白／哥伦比娅／莉奈娅）。");
  if (config.reactionEngine?.mode !== "aura-v3") throw new Error("月结晶参考模式要求 aura-v3 逐角色元素量；不会隐式替换已选择的反应版本。");
  if (config.reactionEngine.initialAura?.length || config.enemy.targets?.some(target => target.initialAura?.length)) throw new Error("月结晶模式的初始元素量必须由实际角色命中建立，初始无归属附着不可推定参与者。");
  if ((config.enemy.targets?.length ?? 1) !== 1 || config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) throw new Error("月结晶参考模式只支持一个静止、可受击且位于范围内的目标。");
  if (config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1") throw new Error("月结晶参考模式固定 60 FPS、无目标卡肉，使用 legacy-event-heap-v1 调度。");
  if (config.playerDamageModel.mode !== "disabled") throw new Error("月结晶参考模式尚未接入玩家伤害反馈。");
  const definitions = config.timeline ? config.timeline.abilities : config.rotation;
  for (const action of definitions) for (const hit of action.hits ?? []) {
    const actor = config.characters.find(character => character.id === action.actorId)!;
    const element = hit.element ?? actor.element;
    if (!["hydro", "geo", "physical"].includes(element)) throw new Error(`月结晶参考模式未实现与 ${element} 的混合反应；请移除该段或使用普通模式。`);
    if ((hit.reaction && hit.reaction !== "none") || (hit.reactionOverride && hit.reactionOverride !== "none")) throw new Error("月结晶自动模式不接受手工反应覆写。");
  }
}

/** Snapshot tasks and projectile deliveries are distinct queues with shared live host state. */
export class LunarCrystallizeRuntime {
  readonly damageEvents: LunarCrystallizeDamageEvent[] = [];
  readonly log: SpecialStateLog[] = [];
  private state = createSpecialReactionState();
  private nextWakeFrame: number | undefined;
  private pending: Array<{ intent: SpecialDamageIntent; snapshots: LunarChargedContributorSnapshot[]; criticalExecution?: SpecialCriticalExecution }> = [];
  private readonly context;
  constructor(private readonly inputs: {
    config: SimConfig; options: LunarCrystallizeExecutionOptions; target: ResolvedEnemyTargetProfile; aura: AuraEngine; critMode: CritMode;
    criticalSampler?: SpecialCriticalSampler;
    artifactRuntime?: LunarArtifactRuntime;
    snapshot: (actorId: string, frame: number) => CharacterStats;
    resistance: (frame: number) => number;
    beforeWake: (frame: number) => void;
  }) {
    this.context = { party: inputs.options.party, profileId: SPECIAL_STATE_PROFILE_ID, spatialProfile: "single-stationary-target-in-range" as const, targetId: inputs.target.id,
      auraAt: (frame: number) => lunarAuraOwners(inputs.aura.getAuraStateAt(frame)) };
  }
  private accept(transition: SpecialStateTransition): void {
    if (transition.blockedMechanics.length) throw new Error(transition.blockedMechanics.map(entry => `${entry.field}: ${entry.reason}`).join("; "));
    this.state = transition.state; this.log.push(...transition.log); this.nextWakeFrame = transition.nextWakeFrame;
    for (const intent of transition.damageIntents) {
      if (intent.branch !== "lunar-crystallize-reaction" || intent.onDelivery.length) throw new Error("Unsupported Lunar-Crystallize delivery operation");
      const snapshots = intent.contributorIds.map(actorId => {
        const stats = this.inputs.snapshot(actorId, intent.snapshotFrame);
        const actor = this.inputs.config.characters.find(character => character.id === actorId)!;
        return { actorId, level: actor.level, elementalMastery: stats.em, critRate: stats.critRate, critDamage: stats.critDmg, ...this.inputs.artifactRuntime?.snapshotFields(actorId, intent.snapshotFrame, intent.branch) };
      });
      const criticalExecution = this.inputs.criticalSampler?.sample(snapshots.map(snapshot => ({ id: snapshot.actorId, critRate: snapshot.critRate })), `lunar-crystallize:${intent.id}`, intent.snapshotFrame);
      this.pending.push({ intent, snapshots, ...(criticalExecution === undefined ? {} : { criticalExecution }) });
    }
  }
  advanceThrough(frame: number): void {
    while (true) {
      const due = Math.min(this.nextWakeFrame ?? Infinity, ...this.pending.map(task => task.intent.deliveryFrame));
      if (due > frame) return;
      this.inputs.beforeWake(due);
      if (this.nextWakeFrame === due) this.accept(transitionSpecialState(this.state, { kind: "advance", frame: due }, this.context));
      const deliveries = this.pending.filter(task => task.intent.deliveryFrame === due);
      this.pending = this.pending.filter(task => task.intent.deliveryFrame !== due);
      for (const { intent, snapshots, criticalExecution } of deliveries) {
        const calculation = calculateLunarCrystallizeIntent(intent, snapshots, this.inputs.resistance(due), this.inputs.critMode, criticalExecution);
        const aura = this.inputs.aura.getAuraStateAt(due);
        this.damageEvents.push({ id: this.damageEvents.length, frame: due, timeSeconds: due / 60, ownerId: intent.ownerId, targetId: intent.targetId, intent, ...calculation, auraBefore: aura, auraConsumed: [], auraAfter: structuredClone(aura) });
        this.inputs.artifactRuntime?.moonlight?.onEnemyDamage(due, intent.ownerId, intent.element);
      }
    }
  }
  application(event: { frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: "hydro" | "geo"; gaugeUnits: number; auraBefore: AuraStateEntry[]; converted: boolean }): void {
    this.accept(transitionSpecialState(this.state, { ...event, kind: "application", actualIcdAllowed: true, resolutionOrigin: "aura-engine", auraBefore: lunarAuraOwners(event.auraBefore), ...(event.converted ? { ordinaryReaction: "crystallizeHydro" as const } : {}) }, this.context));
  }
  result(baseResult: SimulationResult): LunarCrystallizeSimulationResult {
    const lunarCrystallizeDamage = this.damageEvents.reduce((sum, event) => sum + event.damage, 0);
    const totalDamage = baseResult.totalDamage + lunarCrystallizeDamage;
    return { schemaVersion: "lunar-crystallize-simulation-v1", baseResult, specialDamageEvents: this.damageEvents, executionLog: this.log, ...this.inputs.artifactRuntime?.moonlight?.resultFields(Math.round(baseResult.config.duration * 60)), totalDamage, totalDps: totalDamage / baseResult.config.duration, classicDamage: baseResult.totalDamage, lunarCrystallizeDamage,
      ...(this.inputs.criticalSampler === undefined ? {} : { specialCriticalPolicy: SPECIAL_CRITICAL_RANDOM_PROFILE }),
      profile: { id: "lunar-crystallize-reference-v1", stateProfileId: SPECIAL_STATE_PROFILE_ID, evidence: "fixed-source-provisional", assumptions: [...(this.inputs.artifactRuntime?.assumptions ?? []), "单个静止范围内目标；60 FPS、无卡肉；水／岩／物理攻击。", "实际岩附着按 0.5 倍入射量消耗水；普通水结晶晶片与晶片全局间隔已被替换。", "队伍每轮水附着与岩触发参与者的并集在谐律触发时锁定，属性逐弹取样；投射期间的减抗在实际交付时读取。", "除显式选择的月曜圣遗物条款外，月结晶专属基础提升、增伤、加算、擢升和额外攻击均为本参考配置显式 0／1；不自动补角色未建模天赋。", "同帧特殊队列先于下一普通事件；超出模拟时限的投射仍未交付，不加入总伤害。", "公式与状态来自锁定来源版本，尚未声明当前游戏实测完成。"] } };
  }
}

export function lunarCrystallizeEventToCalculatorDocument(result: LunarCrystallizeSimulationResult, eventId: number): CalculatorDocument {
  const event = result.specialDamageEvents.find(candidate => candidate.id === eventId);
  if (!event) throw new Error(`Unknown Lunar-Crystallize event ${eventId}`);
  const replay = calculateSpecialCalculatorHit(event.context);
  const critMode = result.baseResult.resolvedRuntimeOptions.critMode;
  const damage = specialExecutionDamage(replay, critMode);
  if (damage === undefined || !Number.isFinite(event.damage) || !Number.isFinite(damage) || Math.abs(damage - event.damage) > 1e-10 * Math.max(1, Math.abs(event.damage))) throw new Error("Lunar-Crystallize captured context does not reproduce its event");
  const first = event.context.contributors[0]!;
  return calculatorDocumentSchema.parse({ schemaVersion: CALCULATOR_SCHEMA_VERSION, ruleVersion: CALCULATOR_RULE_VERSION, id: `lunar-crystallize-event-${event.id}`, label: `月结晶 #${event.id} · 第 ${event.frame} 帧`, scope: "single-hit", characterLevel: first.base.kind === "level-base" ? first.base.characterLevel : 90,
    build: { mode: "imported-final", source: "月结晶使用每名参与者的完整上下文；此面板不进入特殊公式。", stats: { atk: 0, hp: 0, def: 0, em: first.elementalMastery, critRate: first.critRate, critDamage: first.critDamage } },
    enemy: { level: result.baseResult.enemyTargets[0]!.level, resistance: event.context.effectiveResistance, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ kind: "special", id: "captured-special", label: "状态驱动月结晶", context: event.context, sourceRefs: event.intent.sourceRefs, dependencies: ["lunar-crystallize-reference-profile"] }], selectedHitIds: ["captured-special"], assumptions: [...result.profile.assumptions, `原始事件数值 ${event.damage}；模式 ${critMode}。`], dependencies: [{ id: "lunar-crystallize-reference-profile", status: "provisional", reason: "锁定来源公式与状态参考配置，未声称当前游戏逐帧实测。", sourceRefs: event.intent.sourceRefs }], dataIdentity: { datasetId: result.baseResult.reproducibilityKey, gameVersion: "Luna VI reference", releaseStatus: "unknown", evidenceStatus: "provisional" } });
}
