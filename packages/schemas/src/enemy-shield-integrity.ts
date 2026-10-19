import type { RefinementCtx } from "zod";
import { ENEMY_SHIELD_FORMULA_PROFILE, settleStandardForceShield } from "@genshin-dps-lab/reaction-formulas";
import { ordinaryFactors } from "./execution-audit-integrity";
import { canonicalStringify } from "./reproducibility";
import { validateEnemyShieldTrace, type ExpectedEnemyShieldTraceNode } from "./enemy-shield-trace-integrity";
import type { CapturedOrdinaryDamageInput, DamageEvent, HitDefinition, SimulationResult } from "./types";
import type { EnemyShieldHostLogEntry, EnemyShieldLogEntry, EnemyShieldModel, EnemyShieldState } from "./enemy-shield-schema";

export type EnemyShieldSourceHit = Pick<HitDefinition, "element" | "application" | "strikeType" | "reaction" | "reactionOverride" | "ampBase" | "defIgnore" | "critRate" | "critDmg" | "reactionBonus" | "critEligible" | "hitWeakPoint" | "normalHitEnergyTag" | "attackTag">;
type IssuePath = Array<string | number>;
const refs = [...ENEMY_SHIELD_FORMULA_PROFILE.sourceRefs];
const poiseRef = refs[2]!;
const n = (value: number) => ({ kind: "constant", value });
const v = (key: string) => ({ kind: "variable", key });
const add = (...terms: unknown[]) => ({ kind: "add", terms });
const mul = (...terms: unknown[]) => ({ kind: "multiply", terms });
const sub = (left: unknown, right: unknown) => ({ kind: "subtract", left, right });
const div = (left: unknown, right: unknown) => ({ kind: "divide", left, right });
const clamp = (value: unknown, min: unknown, max: unknown) => ({ kind: "clamp", value, min, max });
const condition = (operator: "lt" | "equal", left: unknown, right: unknown, whenTrue: unknown, whenFalse: unknown) => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
const same = (actual: unknown, expected: unknown): boolean => {
  if (actual === undefined || expected === undefined) return actual === expected;
  try { return canonicalStringify(actual) === canonicalStringify(expected); } catch { return false; }
};

function shieldTrace(
  values: ReturnType<typeof settleStandardForceShield>,
  input: Parameters<typeof settleStandardForceShield>[0], origin: string, sources: string[],
): ExpectedEnemyShieldTraceNode[] {
  const node = (id: string, expression: unknown, bindings: Array<[string, number, string]>, result: number,
    unit = "GU", children: string[] = []): ExpectedEnemyShieldTraceNode => ({ id: `enemyShield.${id}`, expression,
    values: Object.fromEntries(bindings.map(([key, value, unit]) => [key, { value, unit, origin }])),
    result, unit, childIds: children.map(key => `enemyShield.${key}`), sourceRefs: sources });
  const p = ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage;
  return [
    node("reaction", mul(v("reactionCoefficient"), v("gaugeReachingShield")), [["reactionCoefficient", values.reactionCoefficient, "ratio"], ["gaugeReachingShield", values.gaugeReachingShield, "GU"]], values.reactionCost),
    node("damageBasis", condition("equal", v("immuneSameElement"), n(1), n(0), v("unamplifiedDamage")), [["immuneSameElement", Number(values.immuneSameElement), "boolean"], ["unamplifiedDamage", input.unamplifiedDamage, "damage"]], values.damageBasis, "damage"),
    node("damage", div(mul(v("damageConversionRatio"), v("damageBasis"), v("maxShieldGauge")), mul(v("shieldHpRatio"), v("targetMaxHp"))), [["damageConversionRatio", p.damageConversionRatio, "ratio"], ["damageBasis", values.damageBasis, "damage"], ["maxShieldGauge", input.maxGaugeUnits, "GU"], ["shieldHpRatio", p.shieldHpRatio, "ratio"], ["targetMaxHp", input.targetMaxHp, "HP"]], values.damageCost, "GU", ["damageBasis"]),
    node("poise", mul(v("initialPoise"), v("poiseConversionRatio")), [["initialPoise", 0, "poise"], ["poiseConversionRatio", 0, "GU/poise"]], 0),
    node("total", add(v("reactionCost"), v("damageCost"), v("poiseCost")), [["reactionCost", values.reactionCost, "GU"], ["damageCost", values.damageCost, "GU"], ["poiseCost", 0, "GU"]], values.totalGaugeCost, "GU", ["reaction", "damage", "poise"]),
    node("effective", { kind: "min", terms: [v("before"), v("total")] }, [["before", input.gaugeBefore, "GU"], ["total", values.totalGaugeCost, "GU"]], values.effectiveGaugeCost, "GU", ["total"]),
    node("remaining", sub(v("before"), v("effective")), [["before", input.gaugeBefore, "GU"], ["effective", values.effectiveGaugeCost, "GU"]], values.gaugeAfter, "GU", ["effective"]),
    node("excess", sub(v("total"), v("effective")), [["total", values.totalGaugeCost, "GU"], ["effective", values.effectiveGaugeCost, "GU"]], values.excessGaugeCost),
    node("broken", condition("equal", v("remaining"), n(0), n(1), n(0)), [["remaining", values.gaugeAfter, "GU"]], Number(values.broken), "boolean", ["remaining"]),
  ];
}

/** The existing independent formula audit supplies numerical factors. These
 * fixed graph descriptions only bind the exported explanation to those inputs. */
function ordinaryTrace(input: CapturedOrdinaryDamageInput): { value: number; nodes: ExpectedEnemyShieldTraceNode[] } {
  const f = ordinaryFactors(input), nodes: ExpectedEnemyShieldTraceNode[] = [], previous = new Map<string, string>();
  const sources = ["https://library.keqingmains.com/combat-mechanics/damage/damage-formula", "gcsim:b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541:pkg/core/combat/reaction.dm.go"];
  const weakSource = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go";
  const damageInputs = new Set(["talentDamage", "flatDamage", "baseDamage", "afterBonus", "afterDefense", "afterResistance", "afterCritical", "afterReaction"]);
  const unitOf = (key: string) => key === "hitWeakPoint" ? "boolean" : /Level$/.test(key) ? "level" : key === "scalingValue" || key === "elementalMastery" ? "stat" : damageInputs.has(key) ? "damage" : "ratio";
  const step = (id: string, expression: unknown, inputs: Record<string, number>, result: number, unit = "ratio", status = "applied", sourceRefs = sources, childIds?: string[]) => {
    nodes.push({ id, expression, values: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, { value, unit: unitOf(key), origin: previous.has(key) ? { kind: "previous-step", reference: previous.get(key)! } : "calculation-context" }])), result, unit, status, sourceRefs,
      childIds: childIds ?? [...new Set(Object.keys(inputs).flatMap(key => previous.has(key) ? [previous.get(key)!] : []))] });
    previous.set(id, id);
    if (["expectedMultiplier", "criticalMultiplier", "nonCriticalMultiplier"].includes(id)) previous.set("critMultiplier", id);
    return result;
  };
  const talentDamage = step("talentDamage", mul(v("scaling"), v("scalingValue")), { scaling: input.scaling, scalingValue: input.scalingValue }, input.scaling * input.scalingValue, "damage");
  step("baseDamage", add(v("talentDamage"), v("flatDamage")), { talentDamage, flatDamage: input.flatDamage }, f.baseDamage, "damage");
  step("damageBonusMultiplier", add(n(1), v("damageBonus")), { damageBonus: input.damageBonus }, f.damageBonusMultiplier);
  const afterBonus = step("afterBonus", mul(v("baseDamage"), v("damageBonusMultiplier")), { baseDamage: f.baseDamage, damageBonusMultiplier: f.damageBonusMultiplier }, f.baseDamage * f.damageBonusMultiplier, "damage");
  step("defenseIgnore", clamp(v("defenseIgnore"), n(0), n(1)), { defenseIgnore: input.defenseIgnore }, f.defenseIgnore);
  step("defenseAdjustment", clamp(v("defenseAdjustment"), n(-1), n(0.9)), { defenseAdjustment: input.defenseReduction }, f.defenseReduction);
  step("defenseMultiplier", div(add(v("characterLevel"), n(100)), add(add(v("characterLevel"), n(100)), mul(add(v("enemyLevel"), n(100)), add(n(1), v("defenseAdjustment")), sub(n(1), v("defenseIgnore"))))), { characterLevel: input.characterLevel, enemyLevel: input.enemyLevel, defenseAdjustment: f.defenseReduction, defenseIgnore: f.defenseIgnore }, f.defenseMultiplier);
  const afterDefense = step("afterDefense", mul(v("afterBonus"), v("defenseMultiplier")), { afterBonus, defenseMultiplier: f.defenseMultiplier }, afterBonus * f.defenseMultiplier, "damage");
  step("resistanceMultiplier", condition("lt", v("resistance"), n(0), sub(n(1), div(v("resistance"), n(2))), condition("lt", v("resistance"), n(0.75), sub(n(1), v("resistance")), div(n(1), add(mul(n(4), v("resistance")), n(1))))), { resistance: input.effectiveResistance }, f.resistanceMultiplier);
  const afterResistance = step("afterResistance", mul(v("afterDefense"), v("resistanceMultiplier")), { afterDefense, resistanceMultiplier: f.resistanceMultiplier }, afterDefense * f.resistanceMultiplier, "damage");
  step("critRate", clamp(v("critRate"), n(0), n(1)), { critRate: input.critRate }, f.critRate);
  step("critDamage", { kind: "max", terms: [n(0), v("critDamage")] }, { critDamage: input.critDamage }, f.critDamage);
  const weak = input.hitWeakPoint !== undefined;
  if (weak) step("weakPointGuaranteedCritical", v("hitWeakPoint"), { hitWeakPoint: Number(input.hitWeakPoint) }, Number(input.hitWeakPoint), "boolean", "applied", [weakSource]);
  const critExpression = input.critMode === "average" ? add(n(1), mul(v("critRate"), v("critDamage"))) : input.critMode === "allCrit" ? add(n(1), v("critDamage")) : n(1);
  const critId = input.critMode === "average" ? "expectedMultiplier" : input.critMode === "allCrit" ? "criticalMultiplier" : "nonCriticalMultiplier";
  step(critId, weak ? condition("equal", v("hitWeakPoint"), n(1), add(n(1), v("critDamage")), critExpression) : critExpression,
    { critRate: f.critRate, critDamage: f.critDamage, ...(weak ? { hitWeakPoint: Number(input.hitWeakPoint) } : {}) }, f.critMultiplier, "ratio", "applied", weak ? [...sources, weakSource] : sources, weak ? ["critRate", "critDamage", "weakPointGuaranteedCritical"] : undefined);
  step("amplifyingEmBonus", n(0), { elementalMastery: Math.max(0, input.elementalMastery) }, 0, "ratio", "not-applicable");
  step("reactionMultiplier", mul(v("reactionBase"), add(n(1), v("elementalMasteryBonus"), v("reactionBonus"))), { reactionBase: 1, elementalMasteryBonus: 0, reactionBonus: 0 }, 1, "ratio", "not-applicable");
  const afterCritical = step("afterCritical", mul(v("afterResistance"), v("critMultiplier")), { afterResistance, critMultiplier: f.critMultiplier }, afterResistance * f.critMultiplier, "damage");
  const afterReaction = step("afterReaction", mul(v("afterCritical"), v("reactionMultiplier")), { afterCritical, reactionMultiplier: 1 }, afterCritical, "damage", "not-applicable");
  const value = step("finalDamage", mul(v("afterReaction"), v("groupMultiplier")), { afterReaction, groupMultiplier: input.groupMultiplier }, afterReaction * input.groupMultiplier, "damage");
  return { value, nodes };
}

/** A narrow reciprocal link gate. Complete state, source and arithmetic proof is
 * performed below; this predicate never authenticates shield GU or reaction. */
export function hasEnemyShieldDamageLink(result: SimulationResult, event: DamageEvent): boolean {
  const row = event.enemyShieldLogId === undefined ? undefined : result.enemyShieldLog?.[event.enemyShieldLogId];
  return result.config.enemyShieldModel !== undefined && row !== undefined && row.id === event.enemyShieldLogId && row.operation === "direct-hit" &&
    row.damageEventId === event.id && row.hitResolutionLogId === event.targetResolutionId && row.sourceActorId === event.sourceActorId &&
    row.sourceActionId === event.actionId && row.hitId === event.hitId && row.frame === event.frame && row.eventPriority === event.eventPriority &&
    row.eventSequence === event.eventSequence && row.shield?.damageEventId === event.id && row.shield.targetId === event.targetId;
}

/** Rebuild state from declared phase tasks and actual delivered hits. Imported
 * shield before/after GU, reset claims, and trace results never enter the state. */
export function validateEnemyShieldIntegrity(
  result: SimulationResult, context: RefinementCtx,
  sourceHit: (event: DamageEvent) => EnemyShieldSourceHit | undefined,
): void {
  const issue = (path: IssuePath, message: string) => context.addIssue({ code: "custom", path, message });
  const equal = (path: IssuePath, actual: unknown, expected: unknown) => {
    if (!same(actual, expected)) issue(path, "must match independently replayed enemy-shield source events and calculation context");
  };
  const model = result.config.enemyShieldModel;
  if (model === undefined) {
    for (const key of ["enemyShieldLog", "enemyShieldState", "totalPotentialDamage"] as const) if (result[key] !== undefined) issue([key], "requires the explicit enemy shield model");
    for (const event of result.damageEvents) if (event.enemyShieldLogId !== undefined) issue(["damageEvents", event.id, "enemyShieldLogId"], "requires the explicit enemy shield model");
    return;
  }
  if (result.enemyShieldLog === undefined) issue(["enemyShieldLog"], "requires a complete enemy-shield event log");
  if (result.enemyShieldState === undefined) issue(["enemyShieldState"], "requires independently reproducible final shield state");
  equal(["totalPotentialDamage"], result.totalPotentialDamage, result.damageEvents.reduce((sum, event) => sum + event.potentialDamage, 0));
  const execution = result.resolvedRuntimeOptions.execution;
  if (execution !== undefined && [execution.lunarCharged, execution.lunarCrystallize, execution.lunarMixed, execution.lunarMixedV2, execution.stellarConduct, execution.stellarSwirl, execution.lunarBloom].some(value => value !== undefined)) {
    issue(["config", "enemyShieldModel"], "the ordinary enemy shield host does not certify special reaction hosts");
  }
  const definitions = new Map(model.definitions.map(definition => [definition.id, definition]));
  const states = new Map<string, EnemyShieldState>();
  const consumed: string[] = [];
  let hostIndex = 0, shieldIndex = 0;
  type ReplayEvent = { kind: "phase"; input: EnemyShieldModel["events"][number]; index: number; frame: number; priority: number; order: number } |
    { kind: "damage"; damage: DamageEvent; frame: number; priority: number; order: number };
  const events: ReplayEvent[] = [
    ...model.events.flatMap((input, index) => input.frame / 60 <= result.config.duration + 1e-9 ? [{ kind: "phase" as const, input, index, frame: input.frame, priority: -2, order: index }] : []),
    ...result.damageEvents.map(damage => ({ kind: "damage" as const, damage, frame: damage.frame, priority: damage.eventPriority, order: damage.eventSequence })),
  ].sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.order - b.order || (a.kind === "damage" && b.kind === "damage" ? a.damage.targetIndex - b.damage.targetIndex : 0));
  const phaseSequences = new Map<number, number>();
  const record = (expected: Omit<EnemyShieldHostLogEntry, "id" | "unamplifiedDamageTrace">, expectedTrace: ExpectedEnemyShieldTraceNode[], ordinary: ExpectedEnemyShieldTraceNode[] = []) => {
    const index = hostIndex++, actual = result.enemyShieldLog?.[index];
    if (actual === undefined) return;
    for (const [key, value] of Object.entries({ id: index, ...expected })) {
      if (key !== "shield") equal(["enemyShieldLog", index, key], actual[key as keyof typeof actual], value);
    }
    if (expected.shield === null) equal(["enemyShieldLog", index, "shield"], actual.shield, null);
    else if (actual.shield === null) issue(["enemyShieldLog", index, "shield"], "requires the independently derived shield transition");
    else {
      for (const [key, value] of Object.entries(expected.shield)) if (key !== "trace") equal(["enemyShieldLog", index, "shield", key], actual.shield[key as keyof typeof actual.shield], value);
      validateEnemyShieldTrace(actual.shield.trace, expectedTrace, (path, message) => issue(["enemyShieldLog", index, "shield", "trace", ...path], message));
    }
    validateEnemyShieldTrace(actual.unamplifiedDamageTrace, ordinary, (path, message) => issue(["enemyShieldLog", index, "unamplifiedDamageTrace", ...path], message));
  };
  for (const event of events) {
    if (event.kind === "phase") {
      const input = event.input, definition = definitions.get(input.definitionId);
      if (definition === undefined) continue;
      const actual = result.enemyShieldLog?.[hostIndex];
      // Absolute heap IDs are opaque; the independently known phase and authored
      // enqueue order constrain them without treating a log's state as an input.
      const sequence = actual?.eventSequence ?? 0;
      phaseSequences.set(event.index, sequence);
      if (result.damageEvents.some(damage => damage.eventSequence === sequence)) issue(["enemyShieldLog", hostIndex, "eventSequence"], "a declared phase is a separate queue event from damage delivery");
      const point = { frame: input.frame, eventPriority: -2, eventSequence: sequence, intraEventSequence: 0, sourceEventId: `enemy-shield-phase:${input.id}` };
      let liveAura = result.auraInitialStates.find(row => row.targetId === definition.targetId)?.aura ?? [];
      for (const observation of result.targetStateTimeline.points) {
        if (observation.targetId !== definition.targetId || observation.frame > input.frame) continue;
        if (observation.frame === input.frame) {
          if (observation.cause === "simulation-end") continue;
          if (observation.eventPriority !== null && (observation.eventPriority > -2 || observation.eventPriority === -2 && (observation.eventSequence ?? 0) >= sequence)) continue;
        }
        liveAura = observation.auraAfter;
      }
      if (liveAura.some(aura => aura.gaugeUnits > 0 && (aura.expiresAtFrame === null || aura.expiresAtFrame > input.frame))) {
        issue(["enemyShieldLog", hostIndex], "phase generation and removal cannot erase an actual external Aura");
      }
      const before = states.get(definition.targetId), sources = [...refs, ...refs, definition.scenarioSourceRef];
      let shield: EnemyShieldLogEntry | null = null, trace: ExpectedEnemyShieldTraceNode[] = [];
      let outcome: EnemyShieldHostLogEntry["outcome"];
      if (input.kind === "create") {
        const after: EnemyShieldState = { definitionId: definition.id, targetId: definition.targetId, generation: (before?.generation ?? 0) + 1,
          active: true, gaugeUnits: ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage.baseGaugeUnits * definition.shieldGaugeMultiplier,
          createdFrame: input.frame, removedFrame: null, phaseId: definition.activePhaseId };
        outcome = before?.active ? "replaced" : "created";
        shield = { ...point, id: shieldIndex++, kind: before?.active ? "replace" : "create", definitionId: definition.id, targetId: definition.targetId,
          damageEventId: null, before: before === undefined ? null : { ...before }, after, reactionCost: 0, damageCost: 0, poiseCost: 0, totalGaugeCost: 0, effectiveGaugeCost: 0, excessGaugeCost: 0, broken: false, hpDisposition: null, input: null, sourceRefs: sources, trace: [] };
        trace = [{ id: "enemyShield.abyssMage.maximum", expression: mul(v("baseShieldGauge"), v("scenarioMultiplier")),
          values: { baseShieldGauge: { value: ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage.baseGaugeUnits, unit: "GU", origin: poiseRef }, scenarioMultiplier: { value: definition.shieldGaugeMultiplier, unit: "ratio", origin: definition.scenarioSourceRef } },
          result: after.gaugeUnits, unit: "GU", status: "assumed", sourceRefs: [...refs, definition.scenarioSourceRef] },
          { id: "enemyShield.created", expression: v("actualInitialGauge"), values: { actualInitialGauge: { value: after.gaugeUnits, unit: "GU", origin: point.sourceEventId } }, result: after.gaugeUnits, unit: "GU", status: "assumed", sourceRefs: sources }];
        states.set(definition.targetId, after);
      } else if (!before?.active) outcome = "already-inactive";
      else if (before.definitionId !== definition.id) outcome = "different-definition-active";
      else {
        outcome = "removed";
        const after = { ...before, active: false, removedFrame: input.frame, phaseId: input.nextPhaseId };
        shield = { ...point, id: shieldIndex++, kind: "remove", definitionId: definition.id, targetId: definition.targetId, damageEventId: null,
          before: { ...before }, after, reactionCost: 0, damageCost: 0, poiseCost: 0, totalGaugeCost: 0, effectiveGaugeCost: 0, excessGaugeCost: 0, broken: false, hpDisposition: null, input: null, sourceRefs: sources, trace: [] };
        states.set(definition.targetId, after);
      }
      consumed.push(input.id);
      record({ ...point, operation: "phase", inputEventId: input.id, sourceActorId: null, sourceActionId: null, hitId: null, damageEventId: null,
        hitResolutionLogId: null, elementalApplicationIcdLogId: null, applicationDecision: null, outcome, shield, sourceRefs: [...refs, input.sourceRef, definition.scenarioSourceRef] }, trace);
      continue;
    }
    const damage = event.damage, before = states.get(damage.targetId), capture = result.executionAudit?.hits[damage.id];
    if (!before?.active) {
      equal(["damageEvents", damage.id, "enemyShieldLogId"], damage.enemyShieldLogId, undefined);
      continue;
    }
    const definition = definitions.get(before.definitionId)!;
    if (damage.kind !== "direct") { issue(["damageEvents", damage.id], "the active ordinary shield host does not certify non-direct damage delivery"); continue; }
    const hit = sourceHit(damage), resolution = result.hitResolutionLog[damage.targetResolutionId];
    const scalingOwner = result.config.characters.find(actor => actor.id === damage.scalingOwnerId);
    if (hit === undefined || resolution === undefined || scalingOwner === undefined) { issue(["damageEvents", damage.id], "requires an independently resolved configured or source-owned hit and scaling owner"); continue; }
    const action = damage.sourceAbilityId === undefined
      ? result.config.rotation.find(owner => owner.actorId === damage.sourceActorId && owner.id === damage.actionId)
      : result.config.timeline?.abilities.find(owner => owner.actorId === damage.sourceActorId && owner.id === damage.sourceAbilityId);
    const point = { frame: damage.frame, eventPriority: damage.eventPriority, eventSequence: damage.eventSequence, intraEventSequence: damage.targetIndex, sourceEventId: `damage:${damage.id}` };
    equal(["damageEvents", damage.id, "enemyShieldLogId"], damage.enemyShieldLogId, hostIndex);
    for (const key of ["damageAllowed", "auraAllowed", "hitConfirmAllowed"] as const) equal(["hitResolutionLog", resolution.id, key], resolution[key], true);
    equal(["damageEvents", damage.id, "mechanicsStatus"], damage.mechanicsStatus, "authoritative");
    equal(["damageEvents", damage.id, "element"], damage.element, hit.element ?? scalingOwner.element);
    if (hit.reactionOverride !== undefined || hit.ampBase !== undefined || hit.reaction !== undefined && hit.reaction !== "none") issue(["damageEvents", damage.id], "shield application cannot use manual reaction or amplification overrides");
    const inert = damage.element === "physical" || damage.element === (definition.element === "frozen" ? "cryo" : "pyro") || hit.application === undefined;
    const supported = definition.element === "pyro" && ["hydro", "cryo"].includes(damage.element) || definition.element === "frozen" && damage.element === "pyro";
    if (!inert && !supported) issue(["damageEvents", damage.id, "element"], "this host has no verified side-effect execution for that shield reaction");
    if (definition.element === "frozen") equal(["damageEvents", damage.id, "hitId"], hit.strikeType, "default");
    const audit = damage.reactionAudit;
    for (const [key, value] of Object.entries({ reaction: "none", reactions: [], triggered: false, icdAllowed: null, icdTag: null, icdGroup: null, applicationGaugeUnits: null, auraBefore: [], auraApplied: [], auraConsumed: [], auraAfter: [] })) {
      equal(["damageEvents", damage.id, "reactionAudit", key], audit[key as keyof typeof audit], value);
    }
    equal(["damageEvents", damage.id, "reaction"], damage.reaction, "none");
    const factors = damage.damageFactors;
    // Without optional execution capture, the existing source/stat/factor facet
    // already authenticates these raw panel and configured hit inputs.
    const formulaInput: CapturedOrdinaryDamageInput = capture?.inputKind === "ordinary" ? capture.input : {
      scaling: factors.scaling, scalingStat: factors.scalingStat, scalingValue: factors.scalingValue, flatDamage: factors.flatDamage,
      damageBonus: factors.damageBonus, characterLevel: scalingOwner.level,
      enemyLevel: damage.enemyStateBeforeHit.level, defenseReduction: damage.enemyStateBeforeHit.effectiveDefenseReduction,
      defenseIgnore: damage.statsBeforeDamage.defIgnore + (hit.defIgnore ?? 0), effectiveResistance: damage.enemyStateBeforeHit.effectiveResistance,
      critRate: damage.statsBeforeDamage.critRate + (hit.critRate ?? 0), critDamage: damage.statsBeforeDamage.critDmg + (hit.critDmg ?? 0),
      critMode: hit.hitWeakPoint === true ? "allCrit" : hit.critEligible === false ? "noCrit" : result.resolvedRuntimeOptions.critMode,
      ...(hit.hitWeakPoint === undefined ? {} : { hitWeakPoint: hit.hitWeakPoint }), reaction: "none",
      elementalMastery: damage.statsBeforeDamage.em, reactionBonus: damage.statsBeforeDamage.reactionBonus + (hit.reactionBonus ?? 0),
      groupMultiplier: factors.groupMultiplier,
    };
    equal(["damageEvents", damage.id, "reactionBase"], factors.reactionBase, 1);
    equal(["damageEvents", damage.id, "reactionFactor"], factors.amplifyingReactionMultiplier, 1);
    if (capture?.inputKind === "ordinary") {
      equal(["executionAudit", "hits", damage.id, "input", "reaction"], formulaInput.reaction, "none");
      equal(["executionAudit", "hits", damage.id, "input", "explicitReactionBase"], formulaInput.explicitReactionBase, undefined);
    }
    const unamplifiedInput = { ...formulaInput, reaction: "none" as const };
    delete unamplifiedInput.explicitReactionBase;
    const ordinary = ordinaryTrace(unamplifiedInput);
    equal(["damageEvents", damage.id, "potentialDamage"], damage.potentialDamage, ordinary.value);
    const icd = hit.application === undefined || damage.elementalApplicationIcdLogId === null ? undefined : result.elementalApplicationIcdLog[damage.elementalApplicationIcdLogId];
    let decision: EnemyShieldHostLogEntry["applicationDecision"] = null, applicationAllowed = false, applicationGauge = 0;
    if (hit.application !== undefined) {
      if (damage.element === "physical") issue(["damageEvents", damage.id], "physical shield hits cannot have elemental applications");
      if (icd?.sourceKind !== "configured-direct-hit" || !icd.decision.evaluated) issue(["damageEvents", damage.id, "elementalApplicationIcdLogId"], "requires the independently replayed shared direct-hit ICD decision");
      else {
        equal(["elementalApplicationIcdLog", icd.id, "damageEventId"], icd.damageEventId, damage.id);
        equal(["elementalApplicationIcdLog", icd.id, "hitResolutionLogId"], icd.hitResolutionLogId, resolution.id);
        equal(["elementalApplicationIcdLog", icd.id, "selector"], icd.selector, hit.application.icd);
        equal(["elementalApplicationIcdLog", icd.id, "nominalGaugeUnits"], icd.nominalGaugeUnits, hit.application.gaugeUnits);
        decision = icd.decision; applicationAllowed = icd.decision.allowed;
        applicationGauge = hit.application.gaugeUnits * icd.decision.applicationMultiplier;
      }
    } else equal(["damageEvents", damage.id, "elementalApplicationIcdLogId"], damage.elementalApplicationIcdLogId, null);
    if (result.config.weaponHitStackModel?.actors.some(actor => actor.actorId === damage.sourceActorId) ||
        result.config.weaponProcModel?.actors.some(actor => actor.actorId === damage.sourceActorId) ||
        hit.attackTag === "skill" && result.config.sacrificialModel?.actors.some(actor => actor.actorId === damage.sourceActorId) ||
        result.config.normalHitEnergyModel !== undefined && hit.normalHitEnergyTag !== undefined ||
        damage.element !== "physical" && result.config.nightsoulBurstModel !== undefined || result.config.artifactDamageModel !== undefined ||
        applicationAllowed && supported && result.config.artifactBuffModel?.actors.some(actor => actor.actorId === damage.sourceActorId && ["instructor-4pc", "gilded-4pc"].includes(actor.effectId)) ||
        result.pluginManifest.length > 0 || action?.particles?.some(particle => particle.trigger?.kind === "hit-confirm" && particle.trigger.hitIds.includes(damage.hitId))) {
      issue(["damageEvents", damage.id], "an unresolved contact callback cannot be inferred from zero HP damage against a force shield");
    }
    const input = { shieldElement: definition.element, maxGaugeUnits: ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage.baseGaugeUnits * definition.shieldGaugeMultiplier,
      targetMaxHp: definition.targetMaxHp, gaugeBefore: before.gaugeUnits, damageElement: damage.element, unamplifiedDamage: ordinary.value, applicationGauge, applicationAllowed };
    // Unknown coefficients remain unsupported, never an assumed zero.
    let values: ReturnType<typeof settleStandardForceShield>;
    try { values = settleStandardForceShield(input); } catch { issue(["damageEvents", damage.id], "shield reaction coefficient is not source-verified"); continue; }
    if (values.broken) issue(["damageEvents", damage.id], "this host cannot certify a shield-breaking hit without independent HP-transfer source execution");
    const after = { ...before, gaugeUnits: values.gaugeAfter, ...(values.broken ? { active: false, removedFrame: damage.frame, phaseId: definition.brokenPhaseId } : {}) };
    const sources = [...refs, ...refs, definition.scenarioSourceRef, poiseRef];
    const shieldInput: NonNullable<EnemyShieldLogEntry["input"]> = { ...point, targetId: damage.targetId, damageEventId: damage.id, damageElement: damage.element,
      finalDamage: ordinary.value, damageWithoutAmplifyingReaction: ordinary.value,
      reaction: applicationAllowed ? { kind: "standard-force-application", element: damage.element, gaugeUnitsReachingShield: applicationGauge, applicationEventId: point.sourceEventId } : { kind: "none", reason: hit.application === undefined ? "no-elemental-application" : "icd-blocked" },
      poise: { attackType: "none", strikeType: "default", initialDamage: 0, sourceRef: poiseRef } };
    const shield: EnemyShieldLogEntry = { ...point, id: shieldIndex++, kind: "hit", targetId: damage.targetId, definitionId: definition.id, damageEventId: damage.id,
      before: { ...before }, after, reactionCost: values.reactionCost, damageCost: values.damageCost, poiseCost: 0, totalGaugeCost: values.totalGaugeCost,
      effectiveGaugeCost: values.effectiveGaugeCost, excessGaugeCost: values.excessGaugeCost, broken: values.broken,
      hpDisposition: values.broken ? { kind: "breaking-hit-unresolved", damage: null } : { kind: "shield-blocked", damage: 0 }, input: shieldInput, sourceRefs: sources, trace: [] };
    equal(["damageEvents", damage.id, "finalDamage"], damage.finalDamage, 0);
    equal(["damageEvents", damage.id, "targetDamageMultiplier"], damage.targetDamageMultiplier, 0);
    record({ ...point, operation: "direct-hit", inputEventId: null, sourceActorId: damage.sourceActorId, sourceActionId: damage.actionId, hitId: damage.hitId,
      damageEventId: damage.id, hitResolutionLogId: resolution.id, elementalApplicationIcdLogId: icd?.id ?? null, applicationDecision: decision,
      outcome: values.broken ? "shield-broken" : "shield-damaged", shield, sourceRefs: refs }, shieldTrace(values, input, point.sourceEventId, sources), ordinary.nodes);
    states.set(damage.targetId, after);
  }
  const authoredPhases = [...phaseSequences.entries()].sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < authoredPhases.length; index++) if (authoredPhases[index]![1] <= authoredPhases[index - 1]![1]) {
    issue(["enemyShieldLog"], "phase task heap IDs must preserve authored enqueue order, including inputs declared out of frame order");
  }
  equal(["enemyShieldLog", "length"], result.enemyShieldLog?.length, hostIndex);
  equal(["enemyShieldState"], result.enemyShieldState, { states: [...states.values()], consumedPhaseInputIds: consumed });
}
