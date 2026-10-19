import type { LunarArtifactRuntime } from "./lunar-artifact-runtime";
import type { MoonlightArtifactProjection } from "./moonlight-artifact-runtime";
import type { AuraStateEntry, CharacterStats, CritMode, LunarMixedV2ExecutionOptions, ResolvedEnemyTargetProfile, SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import type { AuraEngine } from "./aura";
import { LunarMixedRuntime, type LunarMixedQueueTask, type LunarMixedExecutionOrder, type LunarMixedDamageEvent, type LunarMixedConversionEvent } from "./lunar-mixed-runtime";
import { validateLunarBloomAbilityDeclarations, type LunarBloomAbilityDeclaration, type LunarBloomDamageEvent, type LunarBloomSimulationResult } from "./lunar-bloom-runtime";
import { calculateMoondewCleanseHit, MOONDEW_CLEANSE } from "./lunar-bloom-calculation";
import { resolveSpecialConversion, SPECIAL_STATE_PROFILE_ID, VERDANT_DEW_RULE_ID, transitionSpecialState, type SpecialStateLog } from "./special-reaction-state";
import { calcTotalStat } from "./formulas";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { CALCULATOR_RULE_VERSION, CALCULATOR_SCHEMA_VERSION, calculatorDocumentSchema, type CalculatorDocument } from "./calculator-model";
import { specialExecutionDamage, type SpecialCriticalSampler, type SpecialRuntimeRandomness } from "./special-random";

export type LunarMixedV2QueueTask = LunarMixedQueueTask | { kind: "ability-consume" | "ability-hit"; frame: number; taskId: number };
export type LunarMixedV2DamageEvent = ({ kind: "reaction" } & LunarMixedDamageEvent) | ({ kind: "direct-ability"; executionOrder: LunarMixedExecutionOrder } & LunarBloomDamageEvent);
export interface LunarMixedV2SimulationResult extends SpecialRuntimeRandomness, MoonlightArtifactProjection {
  schemaVersion: "lunar-mixed-simulation-v2";
  profile: { id: "lunar-mixed-reference-v2"; stateProfileId: typeof SPECIAL_STATE_PROFILE_ID; evidence: "fixed-source-provisional"; assumptions: string[] };
  baseResult: SimulationResult; specialDamageEvents: LunarMixedV2DamageEvent[];
  conversionEvents: LunarMixedConversionEvent[]; executionLog: SpecialStateLog[];
  verdantDew: LunarBloomSimulationResult["verdantDew"];
  totalDamage: number; totalDps: number; classicDamage: number; lunarChargedDamage: number; lunarCrystallizeDamage: number; lunarBloomDamage: number;
}

export function validateLunarMixedV2Profile(config: SimConfig, options: LunarMixedV2ExecutionOptions): void {
  if (options.party.length !== config.characters.length || new Set(options.party.map(member => member.actorId)).size !== options.party.length || options.party.some(member => !config.characters.some(character => character.id === member.actorId))) throw new Error("混合 Lunar v2 party 必须与角色一一对应。");
  for (const reaction of ["electroCharged", "crystallizeHydro", "bloom"] as const) if (resolveSpecialConversion(options.party, reaction).normalFallback) throw new Error(`混合 Lunar v2 缺少 ${reaction} 的独立转换资格。`);
  if (config.reactionEngine?.mode !== "aura-v7") throw new Error("混合 Lunar v2 必须使用 aura-v7 的真实队列化 Quicken→Bloom，不能改用内联近似。");
  if (config.reactionEngine.initialAura?.length || config.enemy.targets?.some(target => target.initialAura?.length)) throw new Error("混合 Lunar v2 初始附着须由真实角色命中建立。");
  if ((config.enemy.targets?.length ?? 1) !== 1 || config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) throw new Error("混合 Lunar v2 仅支持单个静止范围内目标。");
  if (config.timeline?.mode !== "legal-frame-v1" || config.timeline.fps !== 60 || config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1" || config.playerDamageModel.mode !== "disabled") throw new Error("混合 Lunar v2 要求合法60帧时间轴、无卡肉、legacy-event-heap-v1，不接玩家受伤反馈。");
  for (const action of config.timeline.abilities) for (const hit of action.hits ?? []) {
    const actor = config.characters.find(character => character.id === action.actorId)!;
    if (!["hydro", "electro", "dendro", "geo", "physical"].includes(hit.element ?? actor.element)) throw new Error("混合 Lunar v2 仅支持水、雷、草、岩、物理；火冰风、冻结及Stellar混合未实现。");
    if ((hit.reaction && hit.reaction !== "none") || (hit.reactionOverride && hit.reactionOverride !== "none")) throw new Error("混合 Lunar v2 不接受手工反应覆写。");
  }
  validateLunarBloomAbilityDeclarations(config, { party: options.party, ...(options.abilities === undefined ? {} : { abilities: options.abilities }) });
}

/** Inherits the ONE cloud/moondrift/Dew state; only source ability tasks are added. */
export class LunarMixedV2Runtime extends LunarMixedRuntime {
  private readonly directEvents: Array<LunarBloomDamageEvent & { executionOrder: LunarMixedExecutionOrder }> = [];
  private readonly abilityTasks = new Map<number, { declaration: LunarBloomAbilityDeclaration; sourceEventId: string; hitIndex?: 0 | 1 | 2 }>();
  private readonly receipts = new Map<string, LunarBloomDamageEvent["resourceConsumption"]>();
  private nextAbilityTaskId = 0;
  private animationUntil = 0;
  constructor(private readonly v2: {
    config: SimConfig; options: LunarMixedV2ExecutionOptions; target: ResolvedEnemyTargetProfile; aura: AuraEngine; critMode: CritMode;
    criticalSampler?: SpecialCriticalSampler;
    artifactRuntime?: LunarArtifactRuntime;
    snapshot: (actorId: string, frame: number) => CharacterStats;
    resistance: (element: "electro" | "geo" | "dendro", frame: number) => number;
    beforeWake: (frame: number) => void; scheduleTask: (task: LunarMixedV2QueueTask) => void;
    consumption: (order: LunarMixedExecutionOrder, mutation: ReturnType<AuraEngine["consumeLunarChargedGaugeAt"]>) => void;
  }) { super(v2); }
  get declaredAnimationUntil(): number { return this.animationUntil; }
  get verdantDew(): LunarBloomSimulationResult["verdantDew"] {
    const { full, partialFrames, activeFrom, activeUntil } = this.state.dew;
    return { ruleId: VERDANT_DEW_RULE_ID, full, partialFrames, activeFrom, activeUntil, frame: this.state.frame };
  }
  private record(frame: number, type: string, details: SpecialStateLog["details"]): void { this.log.push({ id: this.log.length, frame, type, ruleId: MOONDEW_CLEANSE.key, details, sourceRefs: [...MOONDEW_CLEANSE.sourceRefs] }); }
  /** Called only for a real ordinary Bloom, including a successful queued Electro follow-up. */
  bloom(event: { frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: "hydro" | "dendro" | "electro"; gaugeUnits: number }): void {
    this.accept(transitionSpecialState(this.state, { ...event, kind: "application", actualIcdAllowed: true, resolutionOrigin: "aura-engine", ordinaryReaction: "bloom" }, this.context));
  }
  startDeclaredAbility(event: { frame: number; actorId: string; sourceAbilityId: string; sourceEventId: string; fromState: "idle" }): void {
    const declaration = this.v2.options.abilities?.find(entry => entry.actorId === event.actorId && entry.sourceAbilityId === event.sourceAbilityId);
    if (!declaration || event.fromState !== "idle" || event.frame < this.animationUntil) throw new Error("月露涤荡必须匹配显式能力和完整闲置起手。");
    // actionStart precedes the player's current-frame production wake: no
    // advanceThrough here, and no borrowing Dew generated later this frame.
    if (this.state.dew.full < 1) throw new Error("月露涤荡动作选择时必须已有草露，不能使用本帧稍后生成的资源。");
    this.animationUntil = event.frame + MOONDEW_CLEANSE.animationFrames;
    const consumeTask = this.nextAbilityTaskId++;
    this.abilityTasks.set(consumeTask, { declaration, sourceEventId: event.sourceEventId });
    this.v2.scheduleTask({ kind: "ability-consume", frame: event.frame + MOONDEW_CLEANSE.consumeOffsetFrames, taskId: consumeTask });
    for (const [index, offset] of MOONDEW_CLEANSE.hitOffsetsFrames.entries()) {
      const taskId = this.nextAbilityTaskId++;
      this.abilityTasks.set(taskId, { declaration, sourceEventId: event.sourceEventId, hitIndex: index as 0 | 1 | 2 });
      this.v2.scheduleTask({ kind: "ability-hit", frame: event.frame + offset, taskId });
    }
    this.record(event.frame, "direct-ability-start", { actorId: event.actorId, sourceAbilityId: event.sourceAbilityId, sourceEventId: event.sourceEventId, abilityKey: declaration.abilityKey, talentLevel: declaration.talentLevel, animationUntil: this.animationUntil });
  }
  override runScheduledTask(task: LunarMixedV2QueueTask, order: LunarMixedExecutionOrder): void {
    if (!("taskId" in task)) { super.runScheduledTask(task, order); return; }
    this.v2.beforeWake(task.frame);
    this.accept(transitionSpecialState(this.state, { kind: "advance", frame: task.frame }, this.context), order);
    const pending = this.abilityTasks.get(task.taskId);
    if (!pending) throw new Error("月露涤荡主队列任务缺少来源动作。");
    this.abilityTasks.delete(task.taskId);
    const { declaration, sourceEventId } = pending;
    if (task.kind === "ability-consume") {
      if (this.state.dew.full < 1) throw new Error("月露涤荡实际消费时草露不足。");
      this.accept(transitionSpecialState(this.state, { kind: "consume-verdant-dew", frame: task.frame, amount: 1, actorId: declaration.actorId, sourceEventId }, this.context), order);
      this.receipts.set(sourceEventId, { frame: task.frame, sourceEventId, consumed: 1 });
      this.record(task.frame, "ability-resource-consumed", { actorId: declaration.actorId, sourceEventId, consumed: 1 });
      return;
    }
    const resourceConsumption = this.receipts.get(sourceEventId);
    if (!resourceConsumption) throw new Error("月露涤荡命中缺少真实消费收据。");
    const stats = this.v2.snapshot(declaration.actorId, task.frame);
    const artifactFields = this.v2.artifactRuntime?.snapshotFields(declaration.actorId, task.frame, "lunar-bloom-direct");
    const criticalExecution = this.v2.criticalSampler?.sample([{ id: declaration.actorId, critRate: stats.critRate }], `moondew:${sourceEventId}:${pending.hitIndex}`, task.frame);
    const calculation = calculateMoondewCleanseHit({ actorId: declaration.actorId, targetId: this.v2.target.id, sourceEventId, frame: task.frame, talentLevel: declaration.talentLevel, ascension: declaration.ascension, constellation: declaration.constellation, hitIndex: pending.hitIndex!, resourceConsumption }, { hp: calcTotalStat(stats, "hp"), elementalMastery: stats.em, critRate: stats.critRate, critDamage: stats.critDmg, ...artifactFields }, this.v2.resistance("dendro", task.frame), this.v2.critMode, criticalExecution);
    this.directEvents.push({ id: this.directEvents.length, frame: task.frame, timeSeconds: task.frame / 60, ownerId: declaration.actorId, targetId: this.v2.target.id, abilityKey: declaration.abilityKey, sourceEventId, hitIndex: pending.hitIndex!, resourceConsumption, ...calculation, executionOrder: { ...order } });
    this.v2.artifactRuntime?.moonlight?.onEnemyDamage(task.frame, declaration.actorId, "dendro");
    this.record(task.frame, "direct-ability-hit", { actorId: declaration.actorId, sourceEventId, hitIndex: pending.hitIndex!, damage: calculation.damage, appliesElement: false });
  }
  /** Materialize only the final resource projection; all damage was delivered by the heap. */
  finish(frame: number): void { this.accept(transitionSpecialState(this.state, { kind: "advance", frame }, this.context)); }
  resultV2(baseResult: SimulationResult): LunarMixedV2SimulationResult {
    const base = super.result(baseResult);
    const specialDamageEvents: LunarMixedV2DamageEvent[] = [...this.damageEvents.map(event => ({ ...event, kind: "reaction" as const })), ...this.directEvents.map(event => ({ ...event, kind: "direct-ability" as const }))].sort((a, b) => a.frame - b.frame || a.executionOrder.priority - b.executionOrder.priority || a.executionOrder.sequence - b.executionOrder.sequence).map((event, id) => ({ ...event, id }));
    const lunarBloomDamage = this.directEvents.reduce((sum, event) => sum + event.damage, 0), totalDamage = base.totalDamage + lunarBloomDamage;
    return { ...base, schemaVersion: "lunar-mixed-simulation-v2", specialDamageEvents, lunarBloomDamage, totalDamage, totalDps: totalDamage / baseResult.config.duration, verdantDew: this.verdantDew,
      profile: { id: "lunar-mixed-reference-v2", stateProfileId: SPECIAL_STATE_PROFILE_ID, evidence: "fixed-source-provisional", assumptions: [...(this.v2.artifactRuntime?.assumptions ?? []), "aura-v7，水雷草岩物理，单个静止目标、60 FPS、无卡肉。", "普通Bloom、Q→Bloom零延迟任务、草原核与实际Electro接触Hyperbloom保留，三类Lunar共用Aura和主队列。", "草露采用verdant-dew-fixed-core-order-v2：先当帧旧窗口生产，再+1全局刷新；新窗首累计+2/首枚+147。", "显式Moondew闲置动作锁124帧，+55真实消费1草露，+62/+70/+92实时人物与抗性三段；不附着，不另造普通草命中。", "特殊状态wake2.5、角色消费2.75、攻击3；同优先级依主堆真实sequence。", "除显式选择的月曜圣遗物条款外，LC/LCrys专属加成为显式0/1；Moondew执行来源月兆HP提升，其他未建模角色效果不自动启用。", "固定来源参考，未声明当前游戏实测；火冰风/Stellar、多目标、玩家受伤与特殊暴击后的被动反馈未接入。"] } };
  }
}

export function lunarMixedV2EventToCalculatorDocument(result: LunarMixedV2SimulationResult, eventId: number): CalculatorDocument {
  const event = result.specialDamageEvents.find(candidate => candidate.id === eventId);
  if (!event) throw new Error(`Unknown mixed Lunar v2 event ${eventId}`);
  const replay = calculateSpecialCalculatorHit(event.context), mode = result.baseResult.resolvedRuntimeOptions.critMode;
  const damage = specialExecutionDamage(replay, mode);
  if (damage === undefined || !Number.isFinite(event.damage) || !Number.isFinite(damage) || Math.abs(damage - event.damage) > 1e-10 * Math.max(1, Math.abs(event.damage))) throw new Error("Mixed Lunar v2 captured context does not reproduce its event");
  const first = event.context.contributors[0]!, refs = event.kind === "reaction" ? event.intent.sourceRefs : [...MOONDEW_CLEANSE.sourceRefs];
  return calculatorDocumentSchema.parse({ schemaVersion: CALCULATOR_SCHEMA_VERSION, ruleVersion: CALCULATOR_RULE_VERSION, id: `lunar-mixed-v2-event-${event.id}`, label: `混合 Lunar v2 #${event.id} · ${event.context.branch} · 第 ${event.frame} 帧`, scope: "single-hit", characterLevel: result.baseResult.config.characters.find(actor => actor.id === event.ownerId)!.level,
    build: { mode: "imported-final", source: "使用同次实际共享队列的完整特殊上下文。", stats: { atk: 0, hp: first.base.kind === "direct-stat-talent" ? first.base.statValue : 0, def: 0, em: first.elementalMastery, critRate: first.critRate, critDamage: first.critDamage } }, enemy: { level: result.baseResult.enemyTargets[0]!.level, resistance: event.context.effectiveResistance, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ kind: "special", id: "captured-special", label: "混合状态实际命中", context: event.context, sourceRefs: refs, dependencies: ["lunar-mixed-reference-v2"] }], selectedHitIds: ["captured-special"], assumptions: [...result.profile.assumptions, `原事件 ${event.damage}；模式 ${mode}；队列 ${JSON.stringify(event.executionOrder)}。`], dependencies: [{ id: "lunar-mixed-reference-v2", status: "provisional", reason: "来源参考共享状态与真实资源执行，非官服实测声明。", sourceRefs: refs }], dataIdentity: { datasetId: result.baseResult.reproducibilityKey, gameVersion: "Luna VI reference", releaseStatus: "unknown", evidenceStatus: "provisional" } });
}
