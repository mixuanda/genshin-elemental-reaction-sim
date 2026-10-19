import type { RefinementCtx } from "zod";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { actualFullStatReadPoints } from "./thrilling-tales-replay";
import { replayWeaponProcOccurrences } from "./weapon-proc-replay";
import { replayPeriodicEntities } from "./periodic-entity-replay";
import { sourceSnapshotReplayPoint } from "./source-snapshot-integrity";
import { canonicalStringify } from "./reproducibility";
import { getWeaponHitStackRule, WEAPON_HIT_STACK_PROFILE_ID, WEAPON_HIT_STACK_SOURCE,
  type WeaponHitStackActor, type WeaponHitStackCapturedState, type WeaponHitStackDecision,
  type WeaponHitStackEvent, type WeaponHitStackState, type WeaponHitStackValues, type WeaponHitStackLogEntry } from "./weapon-hit-stack-model";
import type { DamageEvent, HitDefinition, SimulationResult } from "./types";

export interface WeaponHitStackReplayPoint {
  frame: number; timeSeconds: number; priority: number; eventSequence?: number;
  actionOrder?: number; parentDamageEventId?: number; intraEventSequence?: number;
}
type ImportedRow = WeaponHitStackDecision & { id: number; frame: number; timeSeconds: number;
  eventPriority: number; eventSequence: number; intraEventSequence: number; trace: unknown[] };
type Hook = { event: WeaponHitStackEvent; priority: number; sequence: number | undefined; actionOrder?: number; order: number };
type ReplayedRow = { decision: WeaponHitStackDecision; hook: Hook; index: number };
type Replay = { rows: ReplayedRow[]; state: WeaponHitStackCapturedState;
  issues: Array<{ path: Array<string | number>; message: string }> };
const cache = new WeakMap<SimulationResult, Replay>();
const emptyState = (): WeaponHitStackState => ({ stacks: 0, effectExpiresFrame: null, cooldownExpiresFrame: null });
const emptyValues = (): WeaponHitStackValues => ({ atkPct: 0, defPct: 0, critRate: 0, dmgBonus: 0 });
const same = (a: unknown, b: unknown): boolean => a === undefined || b === undefined ? a === b : canonicalStringify(a) === canonicalStringify(b);
const importedRows = (result: SimulationResult): ImportedRow[] => result.weaponHitStackLog ?? [];

function actionSequence(result: SimulationResult, index: number): number | undefined {
  return result.energyCostLog?.find(row => row.operation === "reserve" && row.actionLogIndex === index)?.eventSequence
    ?? result.actionConditionLog?.find(row => row.actionLogIndex === index)?.eventSequence
    ?? result.statConversionLog?.find(row => row.actionLogIndex === index)?.eventSequence
    ?? result.artifactBuffLog?.find(row => row.actionLogIndex === index)?.eventSequence;
}
function activeAt(result: SimulationResult, point: WeaponHitStackReplayPoint): string | null {
  let active = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
  const actions = [
    ...result.actionLog.map((action, index) => ({ ...action, index, sequence: actionSequence(result, index) })),
    ...result.skippedActions.map(action => ({ ...action, index: -1, sequence: undefined })),
  ].map(action => ({ ...action, priority: actionEventPriority(actionOwner(result.config, action)),
    ordinal: action.timelineCommandIndex ?? result.config.rotation.findIndex(owner => owner.id === action.actionId && owner.actorId === action.actorId) }))
    .sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.cycle - b.cycle || a.ordinal - b.ordinal);
  const pointActionOrder = point.actionOrder === undefined ? undefined : actions.findIndex(action => action.index === point.actionOrder);
  for (const [attemptOrder, action] of actions.entries()) {
    if (action.frame > point.frame || action.frame === point.frame && action.priority > point.priority) continue;
    if (action.frame === point.frame && action.priority === point.priority) {
      if (pointActionOrder !== undefined && pointActionOrder >= 0 && attemptOrder > pointActionOrder) continue;
      if (point.eventSequence !== undefined && action.sequence !== undefined && action.sequence > point.eventSequence) continue;
    }
    active = action.actorId;
  }
  return active;
}
function beforePoint(row: { frame: number; eventPriority: number; eventSequence: number; intraEventSequence: number }, point: WeaponHitStackReplayPoint): boolean {
  if (row.frame !== point.frame) return row.frame < point.frame;
  if (row.eventPriority !== point.priority) return row.eventPriority < point.priority;
  if (point.eventSequence !== undefined && row.eventSequence !== point.eventSequence) return row.eventSequence < point.eventSequence;
  return point.intraEventSequence === undefined || row.intraEventSequence < point.intraEventSequence;
}
/** Shield lifecycles are independently validated by their own result gates.
 * Only surviving, applicable shields at this read can double Golden Majesty. */
export function weaponHitStackShieldedAt(result: SimulationResult, actorId: string, point: WeaponHitStackReplayPoint): boolean {
  const active = activeAt(result, point);
  const shields = (result.playerShieldLog ?? []).filter(row => beforePoint(row, point)).at(-1)?.stateAfter.shields ?? [];
  if (shields.some(shield => shield.hp > 0 && shield.expiresAtFrame > point.frame &&
    (shield.target.kind === "active" ? actorId === active : shield.target.actorId === actorId))) return true;
  const crystal = result.crystallizeShieldTimeline.filter(row => beforePoint(row, point)).at(-1);
  return actorId === active && crystal !== undefined && crystal.shieldId !== null && crystal.generalAbsorption > 0 &&
    crystal.expiresAtFrame !== null && point.frame < crystal.expiresAtFrame;
}
function actionIndexForDamage(result: SimulationResult, damage: DamageEvent): number {
  return result.actionLog.findIndex(action => action.actorId === damage.sourceActorId && action.actionId === damage.actionId &&
    action.cycle === damage.cycle && action.timelineCommandIndex === damage.timelineCommandIndex && action.sourceAbilityId === damage.sourceAbilityId);
}
function periodicTickForDamage(result: SimulationResult, damage: DamageEvent, hit: HitDefinition) {
  const actionIndex = actionIndexForDamage(result, damage);
  const offset = "frame" in hit && typeof hit.frame === "number" ? hit.frame : Math.round(hit.offset * 60);
  return replayPeriodicEntities(result).find(tick => tick.operation === "tick" && tick.actionLogIndex === actionIndex &&
    tick.frame + tick.definition.hitDelayFrames + offset === damage.frame && tick.definition.hitIds.includes(damage.hitId));
}
function configuredHit(result: SimulationResult, damage: DamageEvent): HitDefinition | undefined {
  if (damage.kind !== "direct") return undefined;
  if (damage.weaponProcLogId !== undefined) return replayWeaponProcOccurrences(result)
    .find(proc => proc.logId === damage.weaponProcLogId && proc.actionId === damage.actionId && proc.hitId === damage.hitId)?.hit;
  const owner = actionOwner(result.config, damage);
  const prefix = `${damage.actionId}:${damage.cycle}:`, suffix = `:${damage.frame}`;
  const index = damage.hitGroupId.startsWith(prefix) && damage.hitGroupId.endsWith(suffix)
    ? damage.hitGroupId.slice(prefix.length, -suffix.length) : "";
  const hit = /^(0|[1-9]\d*)$/.test(index) ? owner?.hits?.[Number(index)] : undefined;
  if (hit !== undefined && (hit.id ?? `${damage.actionId}:hit-${index}`) === damage.hitId) return hit as HitDefinition;
  // A generated periodic action may retain the source hit ID while selecting a
  // smaller hit list. Its exact accepted entity tick still has to own delivery.
  const periodic = owner?.hits?.find(candidate => candidate.id === damage.hitId) as HitDefinition | undefined;
  return periodic !== undefined && periodicTickForDamage(result, damage, periodic) !== undefined ? periodic : undefined;
}
function hitTag(result: SimulationResult, damage: DamageEvent): string | undefined {
  if (damage.kind === "transformative-reaction") return "reaction";
  const hit = configuredHit(result, damage);
  return hit === undefined ? undefined : hit.attackTag ?? "none";
}
/** The shared presence-only entitlement deliberately deduplicates owners.
 * Weapon numeric traces retain every real main/flat sample instead. */
function weaponFullStatReads(result: SimulationResult): ReturnType<typeof actualFullStatReadPoints> {
  const reads = actualFullStatReadPoints(result);
  const live = result.damageEvents.flatMap(damage => {
    const hit = configuredHit(result, damage);
    return hit === undefined || hit.snapshot === "action" || hit.snapshotFrame !== undefined ? [] : [{ damage, hit }];
  });
  const directTuples = new Set(live.map(({ damage }) => `${damage.frame}:${damage.eventPriority}:${damage.eventSequence}`));
  const expanded = reads.filter(read => read.eventSequence === undefined || !directTuples.has(`${read.frame}:${read.priority}:${read.eventSequence}`));
  for (const { damage, hit } of live) {
    const scalingOwner = hit.scalingOwnerId ?? damage.sourceActorId;
    const periodic = periodicTickForDamage(result, damage, hit);
    expanded.push({ frame: damage.frame, time: damage.timeSeconds, priority: damage.eventPriority, eventSequence: damage.eventSequence,
      actionLogIndex: null, owners: [scalingOwner, ...(periodic === undefined ? (hit.flatSources ?? [])
        .filter(flat => flat.snapshotFrame === undefined).map(flat => flat.ownerId ?? scalingOwner) : [])] });
  }
  return expanded.sort((a, b) => a.frame - b.frame || a.priority - b.priority || (a.eventSequence ?? -1) - (b.eventSequence ?? -1));
}

// This verifier constructs the expected small AST independently of the runtime
// TraceBuilder. Numerical decisions below never execute an imported expression.
type Expression = { kind: "constant"; value: number } | { kind: "variable"; key: string }
  | { kind: "add" | "multiply" | "min"; terms: Expression[] }
  | { kind: "condition"; operator: "equal" | "lte"; left: Expression; right: Expression; whenTrue: Expression; whenFalse: Expression };
const c = (value: number): Expression => ({ kind: "constant", value });
const v = (key: string): Expression => ({ kind: "variable", key });
const add = (...terms: Expression[]): Expression => ({ kind: "add", terms });
const mul = (...terms: Expression[]): Expression => ({ kind: "multiply", terms });
const cond = (operator: "equal" | "lte", left: Expression, right: Expression, whenTrue: Expression, whenFalse: Expression): Expression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse });
function formula(expression: Expression, values?: Record<string, number>): string {
  const number = (value: number) => value < 0 || Object.is(value, -0) ? `(${Object.is(value, -0) ? "-0" : value})` : String(value);
  switch (expression.kind) {
    case "constant": return number(expression.value);
    case "variable": return values === undefined ? expression.key : number(values[expression.key]!);
    case "add": return `(${expression.terms.map(term => formula(term, values)).join(" + ")})`;
    case "multiply": return `(${expression.terms.map(term => formula(term, values)).join(" × ")})`;
    case "min": return `min(${expression.terms.map(term => formula(term, values)).join(", ")})`;
    case "condition": return `(if ${formula(expression.left, values)} ${expression.operator === "equal" ? "=" : "≤"} ${formula(expression.right, values)} then ${formula(expression.whenTrue, values)} else ${formula(expression.whenFalse, values)})`;
  }
}
function independentDecision(actor: WeaponHitStackActor, before: WeaponHitStackState, event: WeaponHitStackEvent): { decision: WeaponHitStackDecision; trace: unknown[] } {
  const rule = getWeaponHitStackRule(actor.weaponId), state = { ...before }, trace: unknown[] = [];
  const node = (id: string, expression: Expression, values: Record<string, number>, value: number, unit = "ratio") => {
    trace.push({ id: `weapon.stack.${id}`, ruleId: `weapon.stack.${id}`, titleKey: `stage.weaponStack.${id}`,
      explanationKey: `explain.weaponStack.${id}`, status: "assumed", expression,
      inputs: Object.entries(values).map(([key, input]) => ({ key, value: input,
        unit: key.includes("Frame") ? "frames" : key.includes("Stack") || key === "stacks" || key === "refinement" ? "count" :
          ["shielded", "hasExpiry", "windowPresent"].includes(key) ? "boolean" : "ratio",
        origin: "actual-weapon-event", meaningKey: `input.weaponStack.${key}` })),
      result: { value, display: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(value), unit },
      childIds: [], sourceRefs: [rule.sourceRef, ...WEAPON_HIT_STACK_SOURCE.sourceRefs.slice(-3)], warnings: [],
      symbolicFormula: formula(expression), substitution: formula(expression, values) });
  };
  const present = (id: string, expiry: number | null): boolean => {
    const yes = expiry !== null && event.frame <= expiry;
    node(id, cond("equal", v("hasExpiry"), c(1), cond("lte", v("eventFrame"), v("expiryFrame"), c(1), c(0)), c(0)),
      { hasExpiry: Number(expiry !== null), eventFrame: event.frame, expiryFrame: expiry ?? 0 }, Number(yes), "boolean");
    return yes;
  };
  const decision: WeaponHitStackDecision = { sourceProfileId: WEAPON_HIT_STACK_PROFILE_ID, sourceRef: rule.sourceRef,
    actor: { ...actor }, event, outcome: "stats-read", stateBefore: { ...before }, stateAfter: state, values: null };
  if (event.kind === "stats-sample") {
    if (state.effectExpiresFrame !== null) {
      const expired = state.effectExpiresFrame <= event.frame;
      node("expiresOnRead", cond("lte", v("expiryFrame"), v("eventFrame"), c(1), c(0)),
        { expiryFrame: state.effectExpiresFrame, eventFrame: event.frame }, Number(expired), "boolean");
      if (expired) { state.effectExpiresFrame = null; decision.outcome = "expired-on-read"; }
    }
    decision.values = valuesFor(actor, state, event.frame, event.shielded, node);
  } else if (event.sourceActorId !== actor.actorId) decision.outcome = "wrong-owner";
  else if (rule.nonzeroDamageOnly && event.damage === 0) decision.outcome = "zero-damage";
  else if (rule.onFieldOnly && event.activeCharacterId !== actor.actorId) decision.outcome = "off-field";
  else if (rule.normalChargedOnly && event.attackTag !== "normal" && event.attackTag !== "charged") decision.outcome = "ineligible-tag";
  else if (rule.elementalOnly && event.element === "physical") decision.outcome = "physical-damage";
  else if (rule.family === "royal" && event.critical === null) decision.outcome = "actual-critical-required";
  else if (rule.family === "royal" && event.critical) {
    state.stacks = 0; decision.outcome = "critical-reset"; node("criticalReset", c(0), {}, 0, "count");
  } else if (present("cooldownPresence", state.cooldownExpiresFrame)) decision.outcome = "cooldown-blocked";
  else {
    const window = rule.family === "royal" || present("windowPresence", state.effectExpiresFrame);
    const base = window ? state.stacks : 0;
    node("stackBase", cond("equal", v("windowPresent"), c(1), v("stacks"), c(0)), { windowPresent: Number(window), stacks: state.stacks }, base, "count");
    state.stacks = Math.min(rule.cap, base + 1);
    node("stacksAfter", { kind: "min", terms: [v("maximumStacks"), add(v("previousStacks"), c(1))] }, { maximumStacks: rule.cap, previousStacks: base }, state.stacks, "count");
    state.cooldownExpiresFrame = event.frame + rule.cooldownFrames;
    node("cooldownExpiry", add(v("eventFrame"), v("durationFrames")), { eventFrame: event.frame, durationFrames: rule.cooldownFrames }, state.cooldownExpiresFrame, "frames");
    if (rule.durationFrames !== null) {
      state.effectExpiresFrame = event.frame + rule.durationFrames;
      node("effectExpiry", add(v("eventFrame"), v("durationFrames")), { eventFrame: event.frame, durationFrames: rule.durationFrames }, state.effectExpiresFrame, "frames");
    }
    decision.outcome = base >= rule.cap ? "cap-refreshed" : "stack-gained";
  }
  return { decision, trace };
}
function valuesFor(actor: WeaponHitStackActor, state: WeaponHitStackState, frame: number, shielded: boolean,
  node: (id: string, expression: Expression, inputs: Record<string, number>, value: number, unit?: string) => void = () => {}): WeaponHitStackValues {
  const rule = getWeaponHitStackRule(actor.weaponId), values = emptyValues();
  const window = rule.family === "royal" || state.effectExpiresFrame !== null && frame < state.effectExpiresFrame;
  const stacks = window ? state.stacks : 0;
  node("effectiveStacks", mul(v("stacks"), v("windowPresent")), { stacks: state.stacks, windowPresent: Number(window) }, stacks, "count");
  const refine = (base: number, step: number): number => {
    const coefficient = base + actor.refinement * step;
    node("perStack", add(v("baseCoefficient"), mul(v("refinement"), v("refinementStep"))),
      { baseCoefficient: base, refinement: actor.refinement, refinementStep: step }, coefficient);
    return coefficient;
  };
  if (rule.family === "royal") {
    const perStack = refine(.06, .02); values.critRate = stacks * perStack;
    node("critRate", mul(v("stacks"), v("perStack")), { stacks, perStack }, values.critRate);
  } else if (rule.family === "golden-majesty") {
    const perStack = refine(.03, .01); values.atkPct = stacks * perStack * (1 + Number(shielded));
    node("shieldedAttack", mul(v("stacks"), v("perStack"), add(c(1), v("shielded"))), { stacks, perStack, shielded: Number(shielded) }, values.atkPct);
  } else if (rule.family === "rancour" || rule.family === "whiteblind") {
    const perStack = rule.family === "rancour" ? refine(.03, .01) : refine(.045, .015);
    values.atkPct = stacks * perStack; values.defPct = values.atkPct;
    node("attackAndDefense", mul(v("stacks"), v("perStack")), { stacks, perStack }, values.atkPct);
  } else if (rule.family === "primordial") {
    const perStack = refine(.025, .007); values.atkPct = stacks * perStack;
    node("attack", mul(v("stacks"), v("perStack")), { stacks, perStack }, values.atkPct);
    values.dmgBonus = stacks === rule.cap ? .09 + actor.refinement * .03 : 0;
    node("maximumStackDamage", cond("equal", v("stacks"), v("maximumStacks"), add(v("baseCoefficient"), mul(v("refinement"), v("refinementStep"))), c(0)),
      { stacks, maximumStacks: rule.cap, baseCoefficient: .09, refinement: actor.refinement, refinementStep: .03 }, values.dmgBonus);
  } else {
    const perStack = refine(.045, .015); values.dmgBonus = stacks * perStack;
    node("damage", mul(v("stacks"), v("perStack")), { stacks, perStack }, values.dmgBonus);
  }
  return values;
}

/** Replay actual source callbacks and actual full Stats reads. Imported stack
 * counts, output values and traces cannot grant an event or drive the state. */
export function replayWeaponHitStacks(result: SimulationResult): Replay {
  const cached = cache.get(result); if (cached !== undefined) return cached;
  const replay: Replay = { rows: [], state: { profileId: WEAPON_HIT_STACK_PROFILE_ID, actors: [] }, issues: [] };
  cache.set(result, replay);
  const model = result.config.weaponHitStackModel;
  if (model === undefined) return replay;
  replay.state.actors = model.actors.map(actor => ({ ...actor, state: emptyState() }));
  const imported = importedRows(result), hooks: Hook[] = [];
  const issue = (path: Array<string | number>, message: string) => replay.issues.push({ path, message });
  const callbackOwners = new Map<number, number>();
  const previousCallbacks = new Map<string, number>();
  const occupiedSequences = new Set([...result.damageEvents, ...result.hitResolutionLog, ...(result.sourceSnapshotLog ?? []),
    ...(result.playerShieldLog ?? []), ...(result.playerHealthEvents ?? []), ...(result.energyCostLog ?? []),
    ...imported.filter(row => row.event.kind === "stats-sample")].map(row => row.eventSequence));
  for (const damage of result.damageEvents) {
    if (damage.mechanicsStatus === "mechanics-truncated" || damage.reactionAudit.mechanicsTruncation !== null) continue;
    const captured = result.executionAudit?.hits.find(hit => hit.eventId === damage.id);
    const tag = hitTag(result, damage);
    if (tag === undefined) issue(["damageEvents", damage.id], "weapon callback requires an independently configured executed hit");
    const callback = imported.find(row => row.event.kind === "enemy-damage" && row.event.parentDamageEventId === damage.id);
    const sequence = callback?.eventSequence;
    if (sequence === undefined || sequence <= damage.eventSequence) issue(["weaponHitStackLog"], `damage ${damage.id} requires its actual same-frame deferred callback after the producer queue event`);
    if (sequence !== undefined) {
      const group = `${damage.frame}:${damage.eventPriority}`, previous = previousCallbacks.get(group);
      if (previous !== undefined && sequence <= previous) issue(["weaponHitStackLog", callback!.id, "eventSequence"], "zero-delay callbacks must preserve same-priority producer FIFO");
      if (callbackOwners.has(sequence) || occupiedSequences.has(sequence)) issue(["weaponHitStackLog", callback!.id, "eventSequence"], "a deferred callback must have its own queue identity, distinct from reads and other producers");
      previousCallbacks.set(group, sequence); callbackOwners.set(sequence, damage.id);
    }
    const critical = damage.kind === "transformative-reaction" ? false : captured?.critical.outcome === "expected" ? null :
      captured === undefined ? null : captured.critical.outcome === "critical";
    if (captured === undefined) issue(["executionAudit", "hits"], `weapon callback ${damage.id} requires its actual captured formula and critical decision`);
    const point = { frame: damage.frame, timeSeconds: damage.timeSeconds, priority: damage.eventPriority,
      ...(sequence === undefined ? {} : { eventSequence: sequence }) };
    hooks.push({ event: { kind: "enemy-damage", frame: damage.frame, sourceActorId: damage.sourceActorId,
      activeCharacterId: activeAt(result, point), parentDamageEventId: damage.id, targetId: damage.targetId,
      attackTag: tag ?? "none", element: damage.element, damage: damage.finalDamage, critical },
      priority: damage.eventPriority, sequence, order: damage.id });
  }
  const readClaims = new Set<number>();
  for (const read of weaponFullStatReads(result)) for (const actorId of read.owners) {
    if (!model.actors.some(actor => actor.actorId === actorId)) continue;
    const index = imported.findIndex((row, index) => !readClaims.has(index) && row.event.kind === "stats-sample" &&
      row.event.actorId === actorId && row.frame === read.frame && row.eventPriority === read.priority &&
      (read.eventSequence === undefined || row.eventSequence === read.eventSequence));
    if (index >= 0) readClaims.add(index);
    const sequence = read.eventSequence ?? (read.actionLogIndex === null ? undefined : actionSequence(result, read.actionLogIndex)) ?? imported[index]?.eventSequence;
    const point: WeaponHitStackReplayPoint = { frame: read.frame, timeSeconds: read.time, priority: read.priority,
      ...(sequence === undefined ? {} : { eventSequence: sequence }),
      ...(read.actionLogIndex === null ? {} : { actionOrder: read.actionLogIndex }),
      ...(imported[index] === undefined ? {} : { intraEventSequence: imported[index]!.intraEventSequence }) };
    hooks.push({ event: { kind: "stats-sample", frame: read.frame, actorId, shielded: weaponHitStackShieldedAt(result, actorId, point) },
      priority: read.priority, sequence, ...(read.actionLogIndex === null ? {} : { actionOrder: read.actionLogIndex }), order: -1 });
  }
  hooks.sort((a, b) => a.event.frame - b.event.frame || a.priority - b.priority || (a.sequence ?? -1) - (b.sequence ?? -1) || a.order - b.order);
  const used = new Set<number>();
  for (const hook of hooks) for (const actor of replay.state.actors) {
    if (hook.event.kind === "stats-sample" && actor.actorId !== hook.event.actorId) continue;
    const { state: _privateState, ...identity } = actor;
    const expected = independentDecision(identity, actor.state, hook.event);
    actor.state = expected.decision.stateAfter;
    const index = imported.findIndex((row, index) => !used.has(index) && row.actor.actorId === actor.actorId &&
      row.event.kind === hook.event.kind && (hook.event.kind === "enemy-damage" ? row.event.kind === "enemy-damage" && row.event.parentDamageEventId === hook.event.parentDamageEventId :
        row.event.kind === "stats-sample" && row.event.actorId === hook.event.actorId && row.frame === hook.event.frame) &&
      (hook.sequence === undefined || row.eventSequence === hook.sequence));
    const row = imported[index];
    if (row === undefined) issue(["weaponHitStackLog"], `missing actual ${hook.event.kind} callback for ${actor.actorId} at ${hook.event.frame}f`);
    else {
      used.add(index);
      const actual: WeaponHitStackDecision = { sourceProfileId: row.sourceProfileId, sourceRef: row.sourceRef, actor: row.actor,
        event: row.event, outcome: row.outcome, stateBefore: row.stateBefore, stateAfter: row.stateAfter, values: row.values };
      if (!same(actual, expected.decision)) issue(["weaponHitStackLog", index], "must equal independently replayed source event, state transition and numerical values");
      if (!same(row.trace, expected.trace)) issue(["weaponHitStackLog", index, "trace"], "must preserve the executed source AST, actual inputs, substitution and unrounded results");
      if (row.id !== index || row.frame !== hook.event.frame || row.timeSeconds !== hook.event.frame / 60 || row.eventPriority !== hook.priority ||
        hook.sequence !== undefined && row.eventSequence !== hook.sequence) issue(["weaponHitStackLog", index], "must retain its actual callback/read queue tuple");
    }
    if (expected.decision.outcome === "actual-critical-required") issue(["weaponHitStackLog", index], "Royal cannot advance from an averaged critical expectation");
    replay.rows.push({ decision: expected.decision, hook, index });
  }
  imported.forEach((_, index) => { if (!used.has(index)) issue(["weaponHitStackLog", index], "has no actual damage callback or full Stats read entitlement"); });
  return replay;
}
function reached(row: ReplayedRow, point: WeaponHitStackReplayPoint): boolean {
  const { hook } = row;
  if (hook.event.frame !== point.frame) return hook.event.frame < point.frame;
  if (hook.priority !== point.priority) return hook.priority < point.priority;
  if (point.actionOrder !== undefined && hook.actionOrder !== undefined && hook.actionOrder > point.actionOrder) return false;
  if (point.eventSequence !== undefined && hook.sequence !== undefined) return hook.sequence <= point.eventSequence;
  // Without an opaque queue ID a producing hit must not see its own deferred
  // callback, nor later producers at the same tick and event phase.
  if (hook.event.kind === "enemy-damage") return point.parentDamageEventId !== undefined && hook.event.parentDamageEventId < point.parentDamageEventId;
  return true;
}
export function weaponHitStackStateAt(result: SimulationResult, actorId: string, point: WeaponHitStackReplayPoint):
  { actor: WeaponHitStackActor; state: WeaponHitStackState; shielded: boolean } | undefined {
  const actor = result.config.weaponHitStackModel?.actors.find(actor => actor.actorId === actorId);
  if (actor === undefined) return undefined;
  let state = emptyState();
  for (const row of replayWeaponHitStacks(result).rows) if (row.decision.actor.actorId === actorId && reached(row, point)) state = row.decision.stateAfter;
  return { actor: { ...actor }, state: { ...state }, shielded: weaponHitStackShieldedAt(result, actorId, point) };
}
export function weaponHitStackValuesAt(result: SimulationResult, actorId: string, point: WeaponHitStackReplayPoint): WeaponHitStackValues {
  const captured = weaponHitStackStateAt(result, actorId, point);
  return captured === undefined ? emptyValues() : valuesFor(captured.actor, captured.state, point.frame, captured.shielded);
}
export interface WeaponHitStackSnapshotContext {
  role: "main" | "flat"; ownerId: string; flatSourceIndex?: number; sourceSnapshotLogId?: number;
  point: WeaponHitStackReplayPoint;
}
/** Actual producer clocks, including readonly periodic caches. This lookup
 * grants no Stats read and never mutates source modifier expiry. */
export function weaponHitStackSnapshotContextsForDamageEvent(result: SimulationResult, damage: DamageEvent): WeaponHitStackSnapshotContext[] {
  if (result.config.weaponHitStackModel === undefined || damage.kind !== "direct") return [];
  const hit = configuredHit(result, damage); if (hit === undefined) return [];
  const actionIndex = actionIndexForDamage(result, damage), action = result.actionLog[actionIndex];
  const periodic = periodicTickForDamage(result, damage, hit);
  const periodicRow = periodic === undefined ? undefined : result.periodicEntityLog?.find(row => row.operation === "tick" &&
    row.actionLogIndex === periodic.actionLogIndex && row.frame === periodic.frame && row.instanceId === periodic.instanceId && row.tickIndex === periodic.tickIndex);
  const proc = damage.weaponProcLogId === undefined ? undefined : replayWeaponProcOccurrences(result)
    .find(row => row.logId === damage.weaponProcLogId && row.actionId === damage.actionId);
  const summon = result.summonLog?.find(row => row.operation === "spawn" && row.actorId === damage.sourceActorId &&
    row.actionId === damage.actionId && row.cycle === damage.cycle && row.hitIds.includes(damage.hitId));
  const contexts: WeaponHitStackSnapshotContext[] = [];
  const link = (ownerId: string, role: "main" | "flat", flatSourceIndex?: number, explicitFrame?: number): void => {
    if (!result.config.weaponHitStackModel!.actors.some(actor => actor.actorId === ownerId)) return;
    let point: WeaponHitStackReplayPoint;
    let snapshotId: number | undefined;
    if (explicitFrame !== undefined && action !== undefined) {
      const snapshot = result.sourceSnapshotLog?.find(row => row.actionLogIndex === actionIndex && row.ownerId === ownerId &&
        row.relativeFrame === explicitFrame && row.status === "sampled");
      if (snapshot === undefined || snapshot.eventSequence === null) return;
      snapshotId = snapshot.id;
      point = { ...sourceSnapshotReplayPoint(result, { actionLogIndex: actionIndex, actionId: action.actionId,
        sourceActorId: action.actorId, ownerId, cycle: action.cycle, relativeFrame: explicitFrame,
        frame: action.frame + explicitFrame, timeSeconds: (action.frame + explicitFrame) / 60 }), eventSequence: snapshot.eventSequence };
    } else if (periodic !== undefined && (role === "flat" || hit.snapshot === "action")) {
      point = { frame: periodic.frame, timeSeconds: periodic.frame / 60, priority: periodic.eventPriority,
        ...(periodicRow === undefined ? {} : { eventSequence: periodicRow.eventSequence }) };
    } else if (hit.snapshot === "action") {
      if (proc !== undefined) point = { frame: proc.snapshotFrame, timeSeconds: proc.snapshotTimeSeconds,
        priority: proc.snapshotPriority, eventSequence: proc.snapshotEventSequence ?? proc.callbackEventSequence ?? proc.parent.eventSequence };
      else if (summon !== undefined) point = { frame: summon.frame, timeSeconds: summon.timeSeconds,
        priority: summon.eventPriority, eventSequence: summon.eventSequence };
      else if (action !== undefined) {
        const sequence = actionSequence(result, actionIndex);
        point = { frame: action.frame, timeSeconds: action.time, priority: actionEventPriority(actionOwner(result.config, action)),
          actionOrder: actionIndex, ...(sequence === undefined ? {} : { eventSequence: sequence }) };
      } else return;
    } else point = { frame: damage.frame, timeSeconds: damage.timeSeconds, priority: damage.eventPriority,
      eventSequence: damage.eventSequence, parentDamageEventId: damage.id };
    contexts.push({ role, ownerId, point, ...(flatSourceIndex === undefined ? {} : { flatSourceIndex }),
      ...(snapshotId === undefined ? {} : { sourceSnapshotLogId: snapshotId }) });
  };
  const scalingOwner = hit.scalingOwnerId ?? damage.sourceActorId;
  link(scalingOwner, "main", undefined, hit.snapshotFrame);
  (hit.flatSources ?? []).forEach((flat, index) => link(flat.ownerId ?? scalingOwner, "flat", index, flat.snapshotFrame ?? hit.snapshotFrame));
  return contexts;
}
export type WeaponHitStackDamageRead = WeaponHitStackLogEntry & {
  snapshotContext: { role: "main" | "flat"; ownerId: string; flatSourceIndex?: number;
    sourceSnapshotLogId?: number; frame: number; eventSequence: number };
};
/** Only actual full Stats reads receive callback ledger links. A readonly
 * periodic cache has a context above, but cannot borrow a prior read row. */
export function weaponHitStackReadsForDamageEvent(result: SimulationResult, damage: DamageEvent): WeaponHitStackDamageRead[] {
  const hit = configuredHit(result, damage); if (hit === undefined) return [];
  const contexts = weaponHitStackSnapshotContextsForDamageEvent(result, damage);
  const periodic = periodicTickForDamage(result, damage, hit);
  const authenticated = replayWeaponHitStacks(result).rows.filter(row => row.hook.event.kind === "stats-sample" && row.index >= 0);
  const linked: WeaponHitStackDamageRead[] = [], consumedLive = new Set<number>();
  for (const context of contexts) {
    const { ownerId, role, point, flatSourceIndex, sourceSnapshotLogId } = context;
    if (sourceSnapshotLogId === undefined && periodic !== undefined && (role === "flat" || hit.snapshot === "action")) continue;
    const live = sourceSnapshotLogId === undefined && hit.snapshot !== "action";
    const candidates = authenticated.filter(row => row.decision.actor.actorId === ownerId && row.hook.event.frame === point.frame &&
      row.hook.priority === point.priority && (point.eventSequence === undefined || row.hook.sequence === point.eventSequence) &&
      (point.actionOrder === undefined || row.hook.actionOrder === point.actionOrder) && (!live || !consumedLive.has(row.index)));
    const priorTargets = live ? result.damageEvents.filter(previous => previous.id < damage.id && previous.kind === "direct" &&
      previous.frame === damage.frame && previous.eventSequence === damage.eventSequence && previous.hitGroupId === damage.hitGroupId).length : 0;
    const mainCount = (hit.scalingOwnerId ?? damage.sourceActorId) === ownerId ? 1 : 0;
    const flatCount = periodic === undefined ? (hit.flatSources ?? []).filter(flat => flat.snapshotFrame === undefined &&
      (flat.ownerId ?? hit.scalingOwnerId ?? damage.sourceActorId) === ownerId).length : 0;
    const selected = candidates[priorTargets * (mainCount + flatCount)];
    if (selected === undefined) continue;
    if (live) consumedLive.add(selected.index);
    const row = result.weaponHitStackLog![selected.index]!;
    linked.push({ ...row, snapshotContext: { role, ownerId, frame: row.frame, eventSequence: row.eventSequence,
      ...(flatSourceIndex === undefined ? {} : { flatSourceIndex }), ...(sourceSnapshotLogId === undefined ? {} : { sourceSnapshotLogId }) } });
  }
  return linked;
}

export function validateWeaponHitStackIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string) => context.addIssue({ code: "custom", path, message });
  if (result.config.weaponHitStackModel === undefined) {
    if (result.weaponHitStackLog !== undefined || result.weaponHitStackState !== undefined) issue(["weaponHitStackLog"], "weapon stack outputs require their explicit source model");
    return;
  }
  if (result.weaponHitStackLog === undefined || result.weaponHitStackState === undefined) issue(["weaponHitStackLog"], "weapon stack model requires complete callback and captured final-state records");
  if (result.compatibilityMode !== "legal-frame-v1") issue(["config", "weaponHitStackModel"], "source weapon stacks require the legal 60-frame host");
  const execution = result.resolvedRuntimeOptions.execution;
  if (result.executionAudit === undefined) issue(["executionAudit"], "weapon stack callbacks require a complete captured-hit audit");
  if (result.config.weaponHitStackModel.actors.some(actor => getWeaponHitStackRule(actor.weaponId).family === "royal") &&
    result.resolvedRuntimeOptions.critMode === "average" && execution?.criticalSampling !== "seeded-random-v1")
    issue(["config", "weaponHitStackModel"], "Royal requires actual forced or seeded critical decisions, not expectation-mode averages");
  const replay = replayWeaponHitStacks(result);
  for (const entry of replay.issues) issue(entry.path, entry.message);
  if (!same(result.weaponHitStackState, replay.state)) issue(["weaponHitStackState"], "must equal the private state reconstructed from actual callbacks and full Stats reads");
  let previous: ImportedRow | undefined;
  for (const [index, row] of importedRows(result).entries()) {
    if (previous !== undefined && (row.frame < previous.frame || row.frame === previous.frame &&
      (row.eventPriority < previous.eventPriority || row.eventPriority === previous.eventPriority &&
        (row.eventSequence < previous.eventSequence || row.eventSequence === previous.eventSequence && row.intraEventSequence <= previous.intraEventSequence))))
      issue(["weaponHitStackLog", index], "actual weapon callback tuples must be strictly ordered");
    previous = row;
  }
}
