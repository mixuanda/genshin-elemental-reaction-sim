import type { LunarArtifactRuntime } from "./lunar-artifact-runtime";
import type { MoonlightArtifactProjection } from "./moonlight-artifact-runtime";
import type { LunarArtifactExecutionOptions, AbilityDefinition, CharacterStats, CritMode, ResolvedEnemyTargetProfile, SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import { CALCULATOR_RULE_VERSION, CALCULATOR_SCHEMA_VERSION, calculatorDocumentSchema, type CalculatorDocument } from "./calculator-model";
import { calculateMoondewCleanseHit, MOONDEW_CLEANSE, type MoondewCleanseHit } from "./lunar-bloom-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { calcTotalStat } from "./formulas";
import { createSpecialReactionState, resolveSpecialConversion, SPECIAL_STATE_PROFILE_ID, VERDANT_DEW_RULE_ID, transitionSpecialState, type SpecialPartyMember, type SpecialStateLog, type SpecialStateTransition } from "./special-reaction-state";
import { SPECIAL_CRITICAL_RANDOM_PROFILE, specialExecutionDamage, type SpecialCriticalSampler, type SpecialRuntimeCriticalOutcome, type SpecialRuntimeRandomness } from "./special-random";

export interface LunarBloomAbilityDeclaration {
  sourceAbilityId: string; actorId: string; abilityKey: typeof MOONDEW_CLEANSE.key; talentLevel: number; ascension: number; constellation: 0;
}
export interface LunarBloomRuntimeOptions extends LunarArtifactExecutionOptions {
  profileId: "lunar-bloom-reference-v1"; party: SpecialPartyMember[];
  abilities?: LunarBloomAbilityDeclaration[];
}

/**
 * The source defines a 124-frame full animation. This bounded profile deliberately
 * disallows its earlier cancels; 124 is the profile lock, not an asserted earliest
 * game cancel. The runtime supplies all three sourced hits and consumes real Dew.
 */
export function createMoondewCleanseAbility(actorId: string, abilityId: string): AbilityDefinition {
  return { id: abilityId, actorId, name: "月露涤荡 · 完整闲置起手", kind: "charge", cancelFrame: MOONDEW_CLEANSE.animationFrames, animationEndFrame: MOONDEW_CLEANSE.animationFrames, cooldownFrames: 0, hits: [] };
}
export interface LunarBloomDamageEvent extends SpecialRuntimeCriticalOutcome {
  id: number; frame: number; timeSeconds: number; ownerId: string; targetId: string;
  abilityKey: typeof MOONDEW_CLEANSE.key; sourceEventId: string; hitIndex: 0 | 1 | 2;
  context: ReturnType<typeof calculateMoondewCleanseHit>["context"];
  trace: ReturnType<typeof calculateMoondewCleanseHit>["trace"]; damage: number;
  resourceConsumption: MoondewCleanseHit["resourceConsumption"];
}
export interface LunarBloomSimulationResult extends SpecialRuntimeRandomness, MoonlightArtifactProjection {
  schemaVersion: "lunar-bloom-simulation-v1";
  profile: { id: "lunar-bloom-reference-v1"; stateProfileId: typeof SPECIAL_STATE_PROFILE_ID; evidence: "fixed-source-provisional"; assumptions: string[] };
  baseResult: SimulationResult; specialDamageEvents: LunarBloomDamageEvent[]; executionLog: SpecialStateLog[];
  verdantDew: { ruleId: typeof VERDANT_DEW_RULE_ID; full: number; partialFrames: number; activeFrom: number; activeUntil: number; frame: number };
  totalDamage: number; totalDps: number; classicDamage: number; lunarBloomDamage: number;
}

export function validateLunarBloomProfile(config: SimConfig, options: LunarBloomRuntimeOptions): void {
  if (options.party.length !== config.characters.length || options.party.some(member => !config.characters.some(actor => actor.id === member.actorId)) || new Set(options.party.map(member => member.actorId)).size !== options.party.length) throw new Error("月绽放 party 必须与实际角色一一对应。");
  if (resolveSpecialConversion(options.party, "bloom").normalFallback) throw new Error("月绽放模式需要菈乌玛、奈芙尔或哥伦比娅的已映射转换被动。");
  if (config.reactionEngine?.mode !== "aura-v5") throw new Error("月绽放参考配置要求 aura-v5 的真实普通绽放与草原核。");
  if ((config.enemy.targets?.length ?? 1) !== 1 || config.enemy.targetMotions?.length || config.enemy.targetPhases?.length) throw new Error("月绽放参考配置仅支持一个静止且位于范围内的目标。");
  if (config.targetClockModel.mode !== "disabled" || config.targetTaskModel.mode !== "legacy-event-heap-v1" || config.playerDamageModel.mode !== "disabled") throw new Error("月绽放参考配置要求 60 FPS、无卡肉、legacy-event-heap-v1，且暂不接玩家伤害反馈。");
  const definitions = config.timeline ? config.timeline.abilities : config.rotation;
  for (const action of definitions) for (const hit of action.hits ?? []) {
    const actor = config.characters.find(candidate => candidate.id === action.actorId)!;
    const element = hit.element ?? actor.element;
    if (!["hydro", "dendro", "physical"].includes(element)) throw new Error(`月绽放参考配置未实现 ${element} 混合反应。`);
    if ((hit.reaction && hit.reaction !== "none") || (hit.reactionOverride && hit.reactionOverride !== "none")) throw new Error("月绽放自动模式不接受手工反应覆写。");
  }
  validateLunarBloomAbilityDeclarations(config, options);
}

/** Same sourced action contract for standalone LB and the shared mixed runner. */
export function validateLunarBloomAbilityDeclarations(config: SimConfig, options: Pick<LunarBloomRuntimeOptions, "party" | "abilities">): void {
  const ids = new Set<string>();
  for (const declaration of options.abilities ?? []) {
    if (ids.has(declaration.sourceAbilityId)) throw new Error("同一 sourceAbilityId 只能声明一个真实月绽放能力。");
    ids.add(declaration.sourceAbilityId);
    if (declaration.abilityKey !== MOONDEW_CLEANSE.key || options.party.find(member => member.actorId === declaration.actorId)?.characterKey !== "columbina") throw new Error("目前唯一已接入的直接月绽放能力是哥伦比娅从闲置状态开始的月露涤荡。");
    if (!Number.isInteger(declaration.talentLevel) || declaration.talentLevel < 1 || declaration.talentLevel > 15) throw new Error("月露涤荡的普通攻击天赋等级必须为 1 至 15。");
    if (!Number.isInteger(declaration.ascension) || declaration.ascension < 0 || declaration.ascension > 6 || declaration.constellation !== 0) throw new Error("月露涤荡需明确给出 0 至 6 突破与 C0；不从角色等级推定。");
    // The public runner validates the original timeline first. Its runtime is
    // subsequently constructed with compiled rotation data, without definitions.
    if (!config.timeline) continue;
    const ability = config.timeline?.abilities.find(candidate => candidate.id === declaration.sourceAbilityId);
    const sourceAbility = createMoondewCleanseAbility(declaration.actorId, declaration.sourceAbilityId);
    if (!ability || ability.actorId !== sourceAbility.actorId || ability.kind !== sourceAbility.kind || ability.cancelFrame !== sourceAbility.cancelFrame || ability.animationEndFrame !== sourceAbility.animationEndFrame || ability.cooldownFrames !== sourceAbility.cooldownFrames) throw new Error("月露涤荡声明必须绑定同角色、完整 124 帧、无冷却的来源重击时间轴能力。");
    if (ability.hits?.length || ability.buffs?.length || ability.debuffs?.length || ability.energyGains?.length || ability.particles?.length || ability.energyCost !== undefined || ability.maxCharges !== undefined || ability.chargeRecoveryFrames !== undefined || ability.timelineState !== undefined || Object.keys(ability.cancelFrames ?? {}).length) throw new Error("月露涤荡来源动作不能附带普通命中、额外效果、消耗或取消覆盖；三段与草露均由专用运行器执行。");
  }
}

type AbilityTask = { frame: number; kind: "consume" | "hit"; declaration: LunarBloomAbilityDeclaration; sourceEventId: string; hitIndex?: 0 | 1 | 2 };

/**
 * A real resource/ability executor. The host retains ordinary Bloom cores and
 * calls application only after actual ICD-allowed Bloom resolution. It invokes
 * startDeclaredAbility at the selected action start; no ability is inferred from
 * a name or generic hit. Direct LB never creates a second ordinary attack.
 */
export class LunarBloomRuntime {
  readonly damageEvents: LunarBloomDamageEvent[] = [];
  readonly log: SpecialStateLog[] = [];
  private state = createSpecialReactionState();
  private nextWakeFrame: number | undefined;
  private pending: AbilityTask[] = [];
  private readonly consumptions = new Map<string, MoondewCleanseHit["resourceConsumption"]>();
  private readonly startedEvents = new Set<string>();
  private animationUntil = 0;
  private readonly context;
  constructor(private readonly inputs: {
    config: SimConfig; options: LunarBloomRuntimeOptions; target: ResolvedEnemyTargetProfile; critMode: CritMode;
    criticalSampler?: SpecialCriticalSampler;
    artifactRuntime?: LunarArtifactRuntime;
    snapshot: (actorId: string, frame: number) => CharacterStats;
    resistance: (frame: number) => number;
    beforeWake: (frame: number) => void;
  }) {
    validateLunarBloomProfile(inputs.config, inputs.options);
    this.context = { party: inputs.options.party, profileId: SPECIAL_STATE_PROFILE_ID, spatialProfile: "single-stationary-target-in-range" as const, targetId: inputs.target.id, auraAt: () => ({}) };
  }
  private accept(transition: SpecialStateTransition): void {
    if (transition.blockedMechanics.length || transition.damageIntents.length) throw new Error("月绽放资源转换不得伪造即时反应伤害或混入其他反应状态。");
    this.state = transition.state; this.nextWakeFrame = transition.nextWakeFrame;
    for (const entry of transition.log) this.log.push({ ...entry, id: this.log.length });
  }
  private record(frame: number, type: string, details: SpecialStateLog["details"]): void {
    this.log.push({ id: this.log.length, frame, type, ruleId: MOONDEW_CLEANSE.key, details, sourceRefs: [...MOONDEW_CLEANSE.sourceRefs] });
  }
  get verdantDew(): LunarBloomSimulationResult["verdantDew"] {
    const { full, partialFrames, activeFrom, activeUntil } = this.state.dew;
    return { ruleId: VERDANT_DEW_RULE_ID, full, partialFrames, activeFrom, activeUntil, frame: this.state.frame };
  }
  /** Host must not insert a cancelled/overlapping action into this full-idle-animation profile. */
  get declaredAnimationUntil(): number { return this.animationUntil; }
  advanceThrough(frame: number): void {
    if (!Number.isSafeInteger(frame) || frame < this.state.frame) throw new Error("月绽放执行帧必须单调递增。");
    while (true) {
      const due = Math.min(this.nextWakeFrame ?? Infinity, ...this.pending.map(task => task.frame));
      if (due > frame) break;
      this.inputs.beforeWake(due);
      // Source order: VerdantDewTick -> character task consumption -> global attack.
      this.accept(transitionSpecialState(this.state, { kind: "advance", frame: due }, this.context));
      const tasks = this.pending.filter(task => task.frame === due).sort((a, b) => Number(a.kind === "hit") - Number(b.kind === "hit"));
      this.pending = this.pending.filter(task => task.frame !== due);
      for (const task of tasks) {
        if (task.kind === "consume") {
          if (this.state.dew.full < 1) throw new Error("月露涤荡资源在实际消费前被其他操作耗尽；该并行资源竞争不在此配置中。");
          this.accept(transitionSpecialState(this.state, { kind: "consume-verdant-dew", frame: due, amount: 1, actorId: task.declaration.actorId, sourceEventId: task.sourceEventId }, this.context));
          this.consumptions.set(task.sourceEventId, { frame: due, sourceEventId: task.sourceEventId, consumed: 1 });
          this.record(due, "ability-resource-consumed", { actorId: task.declaration.actorId, sourceEventId: task.sourceEventId, abilityKey: task.declaration.abilityKey, consumed: 1 });
        } else {
          const resourceConsumption = this.consumptions.get(task.sourceEventId);
          if (!resourceConsumption) throw new Error("月露涤荡命中缺少真实草露消费记录。");
          const stats = this.inputs.snapshot(task.declaration.actorId, due);
          const artifactFields = this.inputs.artifactRuntime?.snapshotFields(task.declaration.actorId, due, "lunar-bloom-direct");
          const criticalExecution = this.inputs.criticalSampler?.sample([{ id: task.declaration.actorId, critRate: stats.critRate }], `moondew:${task.sourceEventId}:${task.hitIndex}`, due);
          const calculation = calculateMoondewCleanseHit({ actorId: task.declaration.actorId, targetId: this.inputs.target.id, sourceEventId: task.sourceEventId, frame: due, talentLevel: task.declaration.talentLevel, ascension: task.declaration.ascension, constellation: task.declaration.constellation, hitIndex: task.hitIndex!, resourceConsumption }, { hp: calcTotalStat(stats, "hp"), elementalMastery: stats.em, critRate: stats.critRate, critDamage: stats.critDmg, ...artifactFields }, this.inputs.resistance(due), this.inputs.critMode, criticalExecution);
          this.damageEvents.push({ id: this.damageEvents.length, frame: due, timeSeconds: due / 60, ownerId: task.declaration.actorId, targetId: this.inputs.target.id, abilityKey: task.declaration.abilityKey, sourceEventId: task.sourceEventId, hitIndex: task.hitIndex!, resourceConsumption, ...calculation });
          this.inputs.artifactRuntime?.moonlight?.onEnemyDamage(due, task.declaration.actorId, "dendro");
          this.record(due, "direct-ability-hit", { actorId: task.declaration.actorId, sourceEventId: task.sourceEventId, abilityKey: task.declaration.abilityKey, hitIndex: task.hitIndex!, damage: calculation.damage, appliesElement: false });
        }
      }
    }
    this.accept(transitionSpecialState(this.state, { kind: "advance", frame }, this.context));
  }
  application(event: { frame: number; sourceActorId: string; sourceEventId: string; attackId: string; targetId: string; element: "hydro" | "dendro"; gaugeUnits: number; actualIcdAllowed: boolean; ordinaryBloomCreated: boolean }): void {
    this.advanceThrough(event.frame);
    if (!event.actualIcdAllowed || !event.ordinaryBloomCreated) return;
    this.accept(transitionSpecialState(this.state, { ...event, kind: "application", resolutionOrigin: "aura-engine", ordinaryReaction: "bloom" }, this.context));
  }
  startDeclaredAbility(event: { frame: number; actorId: string; sourceAbilityId: string; sourceEventId: string; fromState: "idle" }): void {
    this.advanceThrough(event.frame);
    const declaration = this.inputs.options.abilities?.find(entry => entry.sourceAbilityId === event.sourceAbilityId && entry.actorId === event.actorId);
    if (!declaration || event.fromState !== "idle") throw new Error("月绽放直接伤害必须匹配显式来源能力声明与已解析的闲置前置状态。");
    if (event.frame < this.animationUntil) throw new Error("本月露涤荡配置要求完整闲置起手，尚不模拟取消或连携帧。");
    if (this.startedEvents.has(event.sourceEventId)) throw new Error("同一动作事件不能重复启动直接月绽放能力。");
    // AnimationHandler chooses the CA variant before this frame's Dew tick.
    const sameFrameGain = this.log.filter(entry => entry.frame === event.frame && entry.type === "resource-gain").length;
    if (this.state.dew.full - sameFrameGain < 1) throw new Error("月露涤荡在动作开始时必须已有草露；本帧稍后产生的草露不能倒用于选择重击类型。");
    this.startedEvents.add(event.sourceEventId); this.animationUntil = event.frame + MOONDEW_CLEANSE.animationFrames;
    this.pending.push({ frame: event.frame + MOONDEW_CLEANSE.consumeOffsetFrames, kind: "consume", declaration, sourceEventId: event.sourceEventId });
    for (const [hitIndex, offset] of MOONDEW_CLEANSE.hitOffsetsFrames.entries()) this.pending.push({ frame: event.frame + offset, kind: "hit", declaration, sourceEventId: event.sourceEventId, hitIndex: hitIndex as 0 | 1 | 2 });
    this.record(event.frame, "direct-ability-start", { actorId: event.actorId, sourceAbilityId: event.sourceAbilityId, sourceEventId: event.sourceEventId, abilityKey: declaration.abilityKey, talentLevel: declaration.talentLevel, animationUntil: this.animationUntil });
  }
  result(baseResult: SimulationResult): LunarBloomSimulationResult {
    const lunarBloomDamage = this.damageEvents.reduce((sum, event) => sum + event.damage, 0);
    const totalDamage = baseResult.totalDamage + lunarBloomDamage;
    return { schemaVersion: "lunar-bloom-simulation-v1", baseResult, specialDamageEvents: this.damageEvents, executionLog: this.log, ...this.inputs.artifactRuntime?.moonlight?.resultFields(Math.round(baseResult.config.duration * 60)), verdantDew: this.verdantDew, totalDamage, totalDps: totalDamage / baseResult.config.duration, classicDamage: baseResult.totalDamage, lunarBloomDamage,
      ...(this.inputs.criticalSampler === undefined ? {} : { specialCriticalPolicy: SPECIAL_CRITICAL_RANDOM_PROFILE }),
      profile: { id: "lunar-bloom-reference-v1", stateProfileId: SPECIAL_STATE_PROFILE_ID, evidence: "fixed-source-provisional", assumptions: [...(this.inputs.artifactRuntime?.assumptions ?? []), "普通绽放与草原核完整保留；月绽放转换本身不添加即时伤害。", "草露规则 verdant-dew-fixed-core-order-v2：实际绽放在 +1 全局任务刷新窗口，当帧先按旧窗口生产；新窗口首累计 +2，146 个有效帧后首枚 +147，截止 +149，上限 3，保留部分进度。", "仅显式声明的哥伦比娅闲置起手月露涤荡可消费草露；+55 消费 1，+62/+70/+92 三段独立取样，完整动画 124 帧，不猜取消或连携。", "月兆基础提升已实际执行；领域、月岭露、Gravity、命座与其他角色直接月绽放能力未接入。", "单个静止范围内目标；60 FPS、无卡肉；水／草／物理输入；当前固定来源为 provisional，未声明当前游戏实测。"] } };
  }
}

export function lunarBloomEventToCalculatorDocument(result: LunarBloomSimulationResult, eventId: number): CalculatorDocument {
  const event = result.specialDamageEvents.find(candidate => candidate.id === eventId);
  if (!event) throw new Error(`Unknown Lunar-Bloom event ${eventId}`);
  const replay = calculateSpecialCalculatorHit(event.context);
  const mode = result.baseResult.resolvedRuntimeOptions.critMode;
  const damage = specialExecutionDamage(replay, mode);
  if (damage === undefined || !Number.isFinite(event.damage) || Math.abs(damage - event.damage) > 1e-10 * Math.max(1, Math.abs(event.damage))) throw new Error("Lunar-Bloom captured context does not reproduce its event");
  const contributor = event.context.contributors[0]!;
  return calculatorDocumentSchema.parse({ schemaVersion: CALCULATOR_SCHEMA_VERSION, ruleVersion: CALCULATOR_RULE_VERSION, id: `lunar-bloom-event-${event.id}`, label: `月露涤荡 #${event.id} · 第 ${event.frame} 帧`, scope: "single-hit", characterLevel: result.baseResult.config.characters.find(actor => actor.id === event.ownerId)!.level,
    build: { mode: "imported-final", source: "月露涤荡完整人物与被动快照保存在本命中特殊上下文。", stats: { atk: 0, hp: contributor.base.kind === "direct-stat-talent" ? contributor.base.statValue : 0, def: 0, em: contributor.elementalMastery, critRate: contributor.critRate, critDamage: contributor.critDamage } },
    enemy: { level: result.baseResult.enemyTargets[0]!.level, resistance: event.context.effectiveResistance, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ kind: "special", id: "captured-special", label: "实际草露驱动月露涤荡", context: event.context, sourceRefs: [...MOONDEW_CLEANSE.sourceRefs], dependencies: ["lunar-bloom-reference-profile"] }], selectedHitIds: ["captured-special"], assumptions: [...result.profile.assumptions, `原始事件 ${event.damage}；模式 ${mode}。`], dependencies: [{ id: "lunar-bloom-reference-profile", status: "provisional", reason: "来源固定的单能力与资源执行；未声称完整角色或当前游戏验证。", sourceRefs: [...MOONDEW_CLEANSE.sourceRefs] }], dataIdentity: { datasetId: result.baseResult.reproducibilityKey, gameVersion: "Luna VI reference", releaseStatus: "unknown", evidenceStatus: "provisional" } });
}
