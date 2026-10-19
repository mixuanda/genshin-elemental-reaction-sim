import type { AmplifyingReaction, AuraStateEntry, Element, ElementalApplication, ElementalApplicationIcdDecisionV147, HitDefinition } from "@genshin-dps-lab/schemas";
import { calculateDamageTrace } from "./calculator-formula";
import type { CalculationTraceNode } from "./calculation-trace";
import type { DamageCalculationInput } from "./formulas";
import { ENEMY_SHIELD_PHASE_PRIORITY, enemyShieldModelSchema, type EnemyShieldModel } from "./enemy-shield-context";
import { ENEMY_SHIELD_PROFILE, EnemyShieldRuntime, createStandardAbyssMageShieldDefinition, type EnemyShieldEventPoint, type EnemyShieldHitResult, type EnemyShieldLogEntry, type EnemyShieldReactionInput, type EnemyShieldState } from "./enemy-shield-runtime";

export const ENEMY_SHIELD_HOST_PROFILE = {
  id: "kqm-standard-force-ordinary-host-v1", status: "provisional", sourceRefs: ENEMY_SHIELD_PROFILE.sourceRefs,
  supported: ["标准火／Frozen 深渊法师参数；明确帧边界生成／移除事件", "普通直伤；实际共享 ICD 放行的 Hydro→Pyro、Cryo→Pyro、Pyro→Frozen 增幅削盾", "物理、同元素和明确不带元素附着的命中；不相关削韧项为 0"],
  blockers: ["盾外存在其他实际 Aura", "超载、超导、扩散、结晶、感电、燃烧、草核等副作用未接敌盾宿主", "Frozen 盾上的 Blunt 碎冰，或缺明确 strikeType 的命中", "特殊反应、伤害插件与未提供真实击破一击生命转移依据"],
} as const;

export interface EnemyShieldApplicationRequest { frame: number; sourceActorId: string; targetId: string; application: ElementalApplication }
export interface EnemyShieldHostHooks {
  /** Must consume the target's EXISTING Aura ICD state once, without attaching the element to ordinary Aura. */
  consumeApplication: (input: EnemyShieldApplicationRequest) => Readonly<ElementalApplicationIcdDecisionV147>;
}
export interface EnemyShieldPhaseTask { type: "enemyShieldPhase"; frame: number; priority: typeof ENEMY_SHIELD_PHASE_PRIORITY; inputIndex: number; inputEventId: string }
export interface EnemyShieldDirectHitSource extends EnemyShieldEventPoint {
  sourceActorId: string; sourceActionId: string; hitId: string; damageEventId: number; hitResolutionLogId: number;
  targetId: string; element: Element; hit: Readonly<HitDefinition>;
  sourceRefs: readonly string[];
  /** Real target state after its current phase decay. No nominal configuration Aura is accepted here. */
  liveAura: readonly AuraStateEntry[];
  targetEffects: { damageAllowed: boolean; auraAllowed: boolean; hitConfirmAllowed: boolean };
}
export interface EnemyShieldPreparedDirectHit {
  source: EnemyShieldDirectHitSource;
  definitionId: string;
  generation: number;
  /** Actual source event; this does not itself ask ordinary Aura to apply a reaction. */
  reaction: AmplifyingReaction;
  shieldReaction: EnemyShieldReactionInput;
  applicationDecision: Readonly<ElementalApplicationIcdDecisionV147> | null;
}
export interface EnemyShieldHostLogEntry extends EnemyShieldEventPoint {
  id: number; operation: "phase" | "direct-hit"; inputEventId: string | null;
  sourceActorId: string | null; sourceActionId: string | null; hitId: string | null; damageEventId: number | null; hitResolutionLogId: number | null;
  elementalApplicationIcdLogId: number | null; applicationDecision: Readonly<ElementalApplicationIcdDecisionV147> | null;
  outcome: "created" | "replaced" | "removed" | "already-inactive" | "different-definition-active" | "shield-damaged" | "shield-broken";
  shield: EnemyShieldLogEntry | null; unamplifiedDamageTrace: CalculationTraceNode[]; sourceRefs: string[];
}
export interface EnemyShieldHostState { states: EnemyShieldState[]; consumedPhaseInputIds: string[] }
export interface EnemyShieldDirectSettlement extends EnemyShieldHitResult { hostLog: EnemyShieldHostLogEntry; damageWithoutAmplifyingReaction: number }

/** Host adapter uses ordinary core damage and the one target-owned ICD; it does not implement another combat loop. */
export class EnemyShieldHost {
  readonly log: EnemyShieldHostLogEntry[] = [];
  readonly model: EnemyShieldModel;
  readonly runtime: EnemyShieldRuntime;
  readonly definitionTraces: ReadonlyMap<string, readonly CalculationTraceNode[]>;
  private readonly consumedPhaseInputs = new Set<string>();

  constructor(model: EnemyShieldModel, private readonly hooks: EnemyShieldHostHooks) {
    this.model = enemyShieldModelSchema.parse(model);
    const compiled = this.model.definitions.map(input => createStandardAbyssMageShieldDefinition(input));
    this.runtime = new EnemyShieldRuntime(compiled.map(row => row.definition));
    this.definitionTraces = new Map(compiled.map(row => [row.definition.id, row.trace]));
  }

  /** Put these actual tasks on the main queue in authored order; do not execute future tasks at construction. */
  tasks(): EnemyShieldPhaseTask[] { return this.model.events.map((event, inputIndex) => ({ type: "enemyShieldPhase", frame: event.frame, priority: ENEMY_SHIELD_PHASE_PRIORITY, inputIndex, inputEventId: event.id })); }

  handlePhase(task: EnemyShieldPhaseTask, point: EnemyShieldEventPoint, liveAura: readonly AuraStateEntry[]): EnemyShieldHostLogEntry {
    const input = this.model.events[task.inputIndex];
    if (!input || input.id !== task.inputEventId || input.frame !== point.frame || point.eventPriority !== ENEMY_SHIELD_PHASE_PRIORITY) throw new Error("敌盾阶段任务与其真实声明帧／身份／主队列相位不符。");
    if (this.consumedPhaseInputs.has(input.id)) throw new Error(`敌盾阶段任务已执行：${input.id}`);
    const definition = this.model.definitions.find(row => row.id === input.definitionId)!;
    if (liveAura.some(entry => entry.gaugeUnits > 0)) throw new Error("当前敌盾宿主尚未处理外来 Aura 与护盾的生成／移除交互；不能删除实际 Aura 以假装支持。");
    const before = this.runtime.captureState().find(row => row.targetId === definition.targetId);
    let shield: EnemyShieldLogEntry | null = null;
    let outcome: EnemyShieldHostLogEntry["outcome"];
    if (input.kind === "create") {
      shield = this.runtime.create(input.definitionId, point);
      shield.trace.unshift(...structuredClone(this.definitionTraces.get(input.definitionId) ?? []));
      outcome = shield.kind === "replace" ? "replaced" : "created";
    } else if (!before?.active) outcome = "already-inactive";
    else if (before.definitionId !== input.definitionId) outcome = "different-definition-active";
    else { shield = this.runtime.remove(definition.targetId, input.nextPhaseId, point); outcome = "removed"; }
    this.consumedPhaseInputs.add(input.id);
    return this.record({ ...point, operation: "phase", inputEventId: input.id, sourceActorId: null, sourceActionId: null, hitId: null, damageEventId: null, hitResolutionLogId: null, elementalApplicationIcdLogId: null, applicationDecision: null, outcome, shield, unamplifiedDamageTrace: [], sourceRefs: [...ENEMY_SHIELD_PROFILE.sourceRefs, input.sourceRef, definition.scenarioSourceRef] });
  }

  /** This check precedes Shatter and processConfiguredHit; do not mutate ordinary Aura first. */
  prepareDirectHit(source: EnemyShieldDirectHitSource): EnemyShieldPreparedDirectHit | null {
    const state = this.runtime.captureState().find(row => row.targetId === source.targetId);
    if (!state?.active) return null;
    const definition = this.model.definitions.find(row => row.id === state.definitionId)!;
    if (!source.targetEffects.damageAllowed || !source.targetEffects.auraAllowed || !source.targetEffects.hitConfirmAllowed) throw new Error("敌盾当前宿主仅支持正常目标效果策略；不把额外伤害免疫或命中禁用合并成护盾。");
    if (source.liveAura.some(entry => entry.gaugeUnits > 0)) throw new Error("目标存在真实外来 Aura；必须先实现其对盾反应预算的消费顺序，不能直接用名义附着削盾。");
    if (source.hit.reactionOverride !== undefined || (source.hit.reaction !== undefined && source.hit.reaction !== "none") || source.hit.ampBase !== undefined) throw new Error("敌盾反应必须由本次实际附着与盾元素决定，不能采用手工反应或增幅倍率。");
    const inert = source.element === "physical" || source.element === (definition.element === "frozen" ? "cryo" : "pyro") || source.hit.application === undefined;
    const supportedAmplification = definition.element === "pyro" && (source.element === "hydro" || source.element === "cryo") || definition.element === "frozen" && source.element === "pyro";
    if (!inert && !supportedAmplification) throw new Error(`${source.element} 对 ${definition.element} 盾的实际反应副作用尚未接入宿主；不能只削盾而漏掉反应伤害／状态。`);
    if (definition.element === "frozen" && source.hit.strikeType !== "default") throw new Error(source.hit.strikeType === "blunt" ? "Frozen 盾上的 Blunt 需要实际碎冰副作用；当前普通增幅宿主未接入。" : "Frozen 盾命中缺少真实 strikeType，不能把未知削韧／碎冰条件当作 0。");
    let applicationDecision: Readonly<ElementalApplicationIcdDecisionV147> | null = null;
    let reaction: AmplifyingReaction = "none", shieldReaction: EnemyShieldReactionInput = { kind: "none", reason: "no-elemental-application" };
    if (source.hit.application !== undefined) {
      if (source.element === "physical") throw new Error("物理命中不能声明元素附着。");
      applicationDecision = this.hooks.consumeApplication({ frame: source.frame, sourceActorId: source.sourceActorId, targetId: source.targetId, application: source.hit.application });
      if (!applicationDecision.evaluated) throw new Error("当前正常敌盾命中缺少实际共享 ICD 执行结果；不能将跳过判定当作已放行。");
      if (!applicationDecision.allowed) shieldReaction = { kind: "none", reason: "icd-blocked" };
      else {
        shieldReaction = { kind: "standard-force-application", element: source.element, gaugeUnitsReachingShield: source.hit.application.gaugeUnits * applicationDecision.applicationMultiplier, applicationEventId: source.sourceEventId };
        if (supportedAmplification) reaction = definition.element === "frozen" ? "melt" : source.element === "hydro" ? "vaporize" : "reverseMelt";
      }
    }
    return { source: structuredClone(source), definitionId: state.definitionId, generation: state.generation, reaction, shieldReaction, applicationDecision: applicationDecision === null ? null : structuredClone(applicationDecision) };
  }

  /** The caller has already sampled CRIT once. Re-evaluation is pure and consumes no random stream. */
  settleDirect(prepared: EnemyShieldPreparedDirectHit, input: DamageCalculationInput, actualPotentialDamage: number, options: { elementalApplicationIcdLogId?: number; breakingHitTransfer?: { hpDamage: number; sourceRef: string } } = {}): EnemyShieldDirectSettlement {
    const { source } = prepared;
    const state = this.runtime.captureState().find(row => row.targetId === source.targetId);
    if (!state?.active || state.definitionId !== prepared.definitionId || state.generation !== prepared.generation) throw new Error("本击取用的敌盾代次已经变化；不能对其他盾复用旧附着结果。");
    if (input.reaction !== "none") throw new Error("敌盾不伪造普通 Aura 增幅；削盾基数必须使用同次暴击的无增幅伤害。");
    const unamplifiedInput: DamageCalculationInput = { ...input, reaction: "none" };
    delete unamplifiedInput.explicitReactionBase;
    const unamplified = calculateDamageTrace(unamplifiedInput);
    const result = this.runtime.settle({ frame: source.frame, eventPriority: source.eventPriority, eventSequence: source.eventSequence, intraEventSequence: source.intraEventSequence, sourceEventId: source.sourceEventId, targetId: source.targetId, damageEventId: source.damageEventId, damageElement: source.element, finalDamage: actualPotentialDamage, damageWithoutAmplifyingReaction: unamplified.finalDamage, reaction: prepared.shieldReaction,
      poise: { attackType: "none", strikeType: "default", initialDamage: 0, sourceRef: "https://docs.google.com/document/d/1SUc9A7O5C7CX0qYHmCqB44uhpHYY-Txgv6rdibM8Jw4/edit" },
      ...(options.breakingHitTransfer === undefined ? {} : { breakingHitTransfer: options.breakingHitTransfer }) });
    // This narrow host knows poise is inapplicable (Pyro or explicitly non-Blunt Frozen), not an unknown 0.
    if (result.hpDisposition.damage === null) throw new Error(`敌盾 ${prepared.definitionId} 已在本击实际归零，但击破一击生命伤害转移尚缺来源；停止本场，不能将未知伤害写成 0。`);
    const hostLog = this.record({ frame: source.frame, eventPriority: source.eventPriority, eventSequence: source.eventSequence, intraEventSequence: source.intraEventSequence, sourceEventId: source.sourceEventId, operation: "direct-hit", inputEventId: null, sourceActorId: source.sourceActorId, sourceActionId: source.sourceActionId, hitId: source.hitId, damageEventId: source.damageEventId, hitResolutionLogId: source.hitResolutionLogId, elementalApplicationIcdLogId: options.elementalApplicationIcdLogId ?? null, applicationDecision: prepared.applicationDecision, outcome: result.log!.broken ? "shield-broken" : "shield-damaged", shield: result.log, unamplifiedDamageTrace: unamplified.trace, sourceRefs: [...ENEMY_SHIELD_PROFILE.sourceRefs, ...source.sourceRefs] });
    return { ...result, hostLog, damageWithoutAmplifyingReaction: unamplified.finalDamage };
  }

  /** The existing ICD ledger may be appended after ordinary event creation; bind its actual index then. */
  linkApplicationLog(hostLogId: number, elementalApplicationIcdLogId: number): void {
    const row = this.log[hostLogId];
    if (!row || row.applicationDecision === null || row.elementalApplicationIcdLogId !== null) throw new Error("敌盾命中不存在待绑定的真实 ICD 结果。");
    row.elementalApplicationIcdLogId = elementalApplicationIcdLogId;
  }
  assertSupportedDelivery(targetId: string, kind: string): void {
    if (kind !== "direct" && this.runtime.targetPolicy(targetId) !== null) throw new Error(`敌盾宿主尚未接入 ${kind} 的实际盾反应与生命转移，不能穿过盾静默扣血。`);
  }
  captureState(): EnemyShieldHostState { return { states: this.runtime.captureState(), consumedPhaseInputIds: [...this.consumedPhaseInputs] }; }
  private record(entry: Omit<EnemyShieldHostLogEntry, "id">): EnemyShieldHostLogEntry { const recorded = { id: this.log.length, ...entry }; this.log.push(recorded); return recorded; }
}

/** Caller derives these from model input tasks + independently validated hit/ICD/capture ledgers, NEVER shield logs. */
export type EnemyShieldReplayEvent =
  | { kind: "phase"; task: EnemyShieldPhaseTask; point: EnemyShieldEventPoint; liveAura: readonly AuraStateEntry[] }
  | { kind: "direct-hit"; source: EnemyShieldDirectHitSource; calculationInput: DamageCalculationInput; potentialDamage: number;
      application: { logId: number; request: EnemyShieldApplicationRequest; decision: Readonly<ElementalApplicationIcdDecisionV147> } | null;
      breakingHitTransfer?: { hpDamage: number; sourceRef: string } };

/** Shared state transition replay with independent input provenance; neither output state nor output GU is an input. */
export function replayEnemyShieldHost(model: EnemyShieldModel, events: readonly EnemyShieldReplayEvent[]): { log: EnemyShieldHostLogEntry[]; state: EnemyShieldHostState } {
  let currentApplication: Extract<EnemyShieldReplayEvent, { kind: "direct-hit" }>["application"] = null;
  const host = new EnemyShieldHost(model, { consumeApplication: request => {
    const actual = currentApplication?.request;
    const selector = request.application.icd, expectedSelector = actual?.application.icd;
    const sameSelector = expectedSelector !== undefined && selector.mode === expectedSelector.mode &&
      (selector.mode === "no-icd-v1" || expectedSelector.mode !== "no-icd-v1" && selector.icdTag === expectedSelector.icdTag &&
        (selector.mode === "legacy-boolean-profile-v1" ? expectedSelector.mode === "legacy-boolean-profile-v1" && selector.profileId === expectedSelector.profileId
          : expectedSelector.mode === "fixed-gcsim-application-v1" && selector.groupId === expectedSelector.groupId));
    if (currentApplication === null || actual === undefined || request.frame !== actual.frame || request.sourceActorId !== actual.sourceActorId || request.targetId !== actual.targetId || request.application.gaugeUnits !== actual.application.gaugeUnits || !sameSelector) throw new Error("敌盾结果回放缺少与真实命中相同的已校验 ICD 来源。");
    return currentApplication.decision;
  } });
  const pointOf = (event: EnemyShieldReplayEvent) => event.kind === "phase" ? event.point : event.source;
  const ordered = [...events].sort((a, b) => { const x = pointOf(a), y = pointOf(b); return x.frame - y.frame || x.eventPriority - y.eventPriority || x.eventSequence - y.eventSequence || x.intraEventSequence - y.intraEventSequence; });
  for (const event of ordered) {
    if (event.kind === "phase") { host.handlePhase(event.task, event.point, event.liveAura); continue; }
    currentApplication = event.application;
    const prepared = host.prepareDirectHit(event.source);
    if (prepared !== null) host.settleDirect(prepared, event.calculationInput, event.potentialDamage, {
      ...(event.application === null ? {} : { elementalApplicationIcdLogId: event.application.logId }),
      ...(event.breakingHitTransfer === undefined ? {} : { breakingHitTransfer: event.breakingHitTransfer }),
    });
    currentApplication = null;
  }
  return { log: host.log, state: host.captureState() };
}
