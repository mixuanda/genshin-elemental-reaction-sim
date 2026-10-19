import type { RefinementCtx } from "zod";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import type { CharacterStats, PlayerHpDamageResolution, PlayerShieldDecision, PlayerShieldInputEvent, PlayerShieldState, SimulationResult } from "./types";

type Point = { frame: number; timeSeconds: number; priority: number };
const clone = (state: PlayerShieldState): PlayerShieldState => ({ nextInstanceId: state.nextInstanceId,
  shields: state.shields.map(shield => ({ ...shield, target: { ...shield.target } })), bonuses: state.bonuses.map(bonus => ({ ...bonus })) });
const totalStat = (stats: CharacterStats, stat: "atk" | "hp" | "def" | "em"): number => stat === "em" ? stats.em
  : stat === "atk" ? stats.baseAtk * (1 + stats.atkPct) + stats.flatAtk
    : stat === "hp" ? stats.baseHp * (1 + stats.hpPct) + stats.flatHp : stats.baseDef * (1 + stats.defPct) + stats.flatDef;
const empty = (state: PlayerShieldState, operation: PlayerShieldDecision["operation"]): PlayerShieldDecision => ({
  operation, inputEventId: null, inputEvent: null, ownerStats: null, targetActorId: null, activeCharacterId: null,
  incomingDamage: null, incomingElement: null, crystallizeDamageAfter: null, capacity: null, strengthBonus: null,
  absorbedDamage: null, damageAfterShield: null, shieldDetails: [], callbacks: [], stateBefore: clone(state), stateAfter: clone(state)
});
const same = (a: unknown, b: unknown): boolean => {
  if (typeof a === "number" && typeof b === "number") return Number.isFinite(a) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left).sort(), expected = Object.keys(right).sort();
    return same(keys, expected) && expected.every(key => same(left[key], right[key]));
  }
  return a === b;
};

/** Replays the explicit generic template from config events and authenticated
 * self-damage hooks. Captured shield/HP before-state never seeds this ledger. */
export function validatePlayerShieldIntegrity(result: SimulationResult, context: RefinementCtx,
  statsAt: (actorId: string, point: Point) => CharacterStats | undefined): void {
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const equal = (path: Array<string | number>, actual: unknown, expected: unknown, message = "must match independent player-shield replay"): void => {
    if (!same(actual, expected)) issue(path, message);
  };
  const model = result.config.playerShieldModel;
  const rows = result.playerShieldLog ?? [];
  if (model === undefined) {
    if (result.playerShieldLog !== undefined || result.playerShieldState !== undefined) issue(["playerShieldLog"], "shield output requires its explicit template model");
    for (const event of result.playerDamageEvents) if (event.playerShieldLogId !== undefined) issue(["playerDamageEvents", event.id, "playerShieldLogId"], "shield provenance requires its explicit model");
    for (const point of result.playerHpTimeline.points) if (point.operation === "shield-hit" || point.playerShieldLogId !== undefined) issue(["playerHpTimeline", "points", point.id], "shield HP transitions require their explicit model");
    for (const [index, checkpoint] of (result.executionAudit?.phaseCheckpoints ?? []).entries()) {
      const resources = checkpoint.state.resourcesAndHp as { playerShields?: unknown } | null;
      const pending = checkpoint.state.pendingEvents as { inFlight?: Array<{ type?: string }> } | null;
      if (resources?.playerShields !== undefined || pending?.inFlight?.some(event => event.type === "playerShieldInput" || event.type === "playerShieldExpiry")) {
        issue(["executionAudit", "phaseCheckpoints", index], "shield checkpoint state and tasks require their explicit model");
      }
    }
    return;
  }
  if (result.playerShieldLog === undefined || result.playerShieldState === undefined) issue(["playerShieldLog"], "an enabled shield model requires its complete log and final state");
  if (result.config.playerDamageModel.mode !== "reaction-self-v1") { issue(["config", "playerDamageModel"], "player shields require the shared player HP model"); return; }
  const hp = new Map(result.config.characters.map(actor => {
    const maxHp = totalStat(actor.stats, "hp");
    const ratio = result.config.playerDamageModel.mode === "reaction-self-v1"
      ? result.config.playerDamageModel.characters.find(state => state.actorId === actor.id)?.initialHpRatio ?? 0 : 0;
    const state = { maxHp, currentHp: maxHp * ratio, initialHp: maxHp * ratio,
      totalIncomingDamage: 0, totalAbsorbedDamage: 0, totalHpDamage: 0, hitCount: 0 };
    return [actor.id, state] as const;
  }));
  const attempts = [...result.actionLog, ...result.skippedActions].sort((a, b) => a.time - b.time ||
    actionEventPriority(actionOwner(result.config, a)) - actionEventPriority(actionOwner(result.config, b)) || a.cycle - b.cycle ||
    (a.timelineCommandIndex ?? result.config.rotation.findIndex(owner => owner.id === a.actionId)) -
    (b.timelineCommandIndex ?? result.config.rotation.findIndex(owner => owner.id === b.actionId)));
  const activeAt = (frame: number, priority: number): string | null => {
    let actorId = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
    for (const action of attempts) if (action.frame < frame || action.frame === frame && actionEventPriority(actionOwner(result.config, action)) < priority) actorId = action.actorId;
    return actorId;
  };
  type Task = { frame: number; priority: number; sequence: number; intra: number } & (
    { kind: "input"; event: PlayerShieldInputEvent } | { kind: "expire" } |
    { kind: "reaction"; event: SimulationResult["playerDamageEvents"][number] } |
    { kind: "health"; event: NonNullable<SimulationResult["playerHealthEvents"]>[number] } |
    { kind: "max-hp"; event: NonNullable<SimulationResult["playerMaxHpEvents"]>[number] });
  const endFrame = Math.round(result.config.duration * 60);
  const tasks: Task[] = [];
  let priorInputSequence = -1;
  const inputSequences = new Set<number>();
  const expiryFrames = new Set<number>();
  for (const event of model.events) {
    if (event.frame > endFrame) continue;
    const matches = rows.filter(row => row.inputEventId === event.id);
    if (matches.length !== 1) issue(["playerShieldLog"], "every in-duration configured shield event requires exactly one declaration row");
    const sequence = matches[0]?.eventSequence ?? Number.MAX_SAFE_INTEGER;
    if (sequence <= priorInputSequence) issue(["playerShieldLog"], "global shield declarations must retain config registration order in their queue sequences");
    priorInputSequence = sequence;
    inputSequences.add(sequence);
    tasks.push({ kind: "input", event, frame: event.frame, priority: 2, sequence, intra: 0 });
    if (event.kind === "grant" && event.frame + event.durationFrames <= endFrame) expiryFrames.add(event.frame + event.durationFrames);
  }
  for (const frame of expiryFrames) tasks.push({ kind: "expire", frame, priority: -0.5,
    sequence: rows.find(row => row.operation === "expire" && row.frame === frame)?.eventSequence ?? 0, intra: 0 });
  for (const event of result.playerDamageEvents) tasks.push({ kind: "reaction", event, frame: event.frame,
    priority: event.eventPriority, sequence: event.eventSequence, intra: event.intraEventSequence - 1 });
  for (const event of result.playerHealthEvents ?? []) tasks.push({ kind: "health", event, frame: event.frame,
    priority: event.eventPriority, sequence: event.eventSequence, intra: event.intraEventSequence });
  for (const event of result.playerMaxHpEvents ?? []) tasks.push({ kind: "max-hp", event, frame: event.frame,
    priority: event.eventPriority, sequence: event.eventSequence, intra: event.intraEventSequence });
  // Declared inputs are registered before actions can enqueue their health or
  // reaction children. This proves their same-priority FIFO instead of sorting
  // solely by a mutable shield log.
  for (const event of [...(result.playerHealthEvents ?? []), ...result.playerDamageEvents]) {
    if (event.eventPriority === 2 && [...inputSequences].some(sequence => sequence >= event.eventSequence)) issue(["playerShieldLog"],
      "initial shield declarations must be enqueued before dynamic priority-2 health and reaction tasks");
  }
  tasks.sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.sequence - b.sequence || a.intra - b.intra);
  let state: PlayerShieldState = { nextInstanceId: 0, shields: [], bonuses: [] };
  const initialState = clone(state);
  const snapshots: Array<{ frame: number; state: PlayerShieldState }> = [];
  let logIndex = 0;
  const hpDamage = (actorId: string, damage: number): PlayerHpDamageResolution | undefined => {
    const actor = hp.get(actorId);
    if (actor === undefined) { issue(["playerShieldLog"], "shield damage target must be configured in the player HP ledger"); return undefined; }
    const before = Math.min(actor.maxHp, Math.max(0, actor.currentHp));
    const actualLoss = Math.min(before, damage);
    return { zeroHpPolicy: "clamp-and-continue", inputCurrentHp: actor.currentHp, currentHpBefore: before,
      currentHpAfter: before - actualLoss, maxHp: actor.maxHp, attemptedLoss: damage, actualLoss,
      overkill: damage - actualLoss, hpRatioBefore: before / actor.maxHp, hpRatioAfter: (before - actualLoss) / actor.maxHp };
  };
  for (const task of tasks) {
    if (task.kind === "health") {
      const actor = hp.get(task.event.targetActorId);
      if (actor !== undefined) {
        equal(["playerHealthEvents", task.event.id, "hpBefore"], task.event.hpBefore, actor.currentHp, "health changes must use the HP ledger including shield hits");
        const change = task.event.operation === "heal" ? task.event.actualChange : -task.event.actualChange;
        actor.currentHp += change;
        equal(["playerHealthEvents", task.event.id, "hpAfter"], task.event.hpAfter, actor.currentHp);
      }
      continue;
    }
    if (task.kind === "max-hp") {
      const actor = hp.get(task.event.actorId);
      if (actor !== undefined) {
        equal(["playerMaxHpEvents", task.event.id, "hpBefore"], task.event.hpBefore, actor.currentHp);
        equal(["playerMaxHpEvents", task.event.id, "maxHpBefore"], task.event.maxHpBefore, actor.maxHp);
        actor.currentHp = actor.currentHp / actor.maxHp * task.event.maxHpAfter;
        actor.maxHp = task.event.maxHpAfter;
        equal(["playerMaxHpEvents", task.event.id, "hpAfter"], task.event.hpAfter, actor.currentHp);
      }
      continue;
    }
    const operation = task.kind === "input" ? task.event.kind : task.kind === "reaction" ? "reaction-hit" : "expire";
    const decision = empty(state, operation);
    const after = decision.stateAfter;
    let hpResolution: PlayerHpDamageResolution | undefined;
    let playerDamageEventId: number | null = null;
    if (task.kind === "expire") {
      const expired = after.shields.filter(shield => shield.expiresAtFrame === task.frame);
      if (expired.length === 0) continue;
      after.shields = after.shields.filter(shield => shield.expiresAtFrame !== task.frame);
      decision.callbacks = [...expired.map(shield => ({ kind: "OnExpire" as const, instanceId: shield.instanceId, reason: "expire" as const })),
        ...expired.map(shield => ({ kind: "OnShieldBreak" as const, instanceId: shield.instanceId, reason: "expire" as const }))];
    } else if (task.kind === "input" && task.event.kind === "bonus") {
      const event = task.event;
      decision.inputEventId = event.id; decision.inputEvent = event;
      const bonus = { key: event.key, value: event.value, expiresAtFrame: event.durationFrames === null ? null : event.frame + event.durationFrames, consumeOnRead: event.consumeOnRead };
      const index = after.bonuses.findIndex(candidate => candidate.key === event.key);
      if (index < 0) after.bonuses.push(bonus); else after.bonuses[index] = bonus;
    } else if (task.kind === "input" && task.event.kind === "grant") {
      const event = task.event;
      decision.inputEventId = event.id; decision.inputEvent = event;
      const stats = statsAt(event.ownerId, { frame: task.frame, timeSeconds: task.frame / 60, priority: task.priority });
      decision.ownerStats = stats ?? null;
      if (stats === undefined) issue(["playerShieldLog", logIndex, "ownerStats"], "shield generation requires independently replayed owner stats");
      const capacity = event.hp.flat + (event.hp.stat === undefined || stats === undefined ? 0 : totalStat(stats, event.hp.stat) * (event.hp.coefficient ?? 0));
      if (!(capacity > 0)) issue(["playerShieldLog", logIndex, "capacity"], "the actual generation snapshot must produce positive shield HP");
      decision.capacity = capacity;
      const shield = { instanceId: after.nextInstanceId++, definitionId: event.id, ownerId: event.ownerId,
        typeKey: event.typeKey, label: event.label, element: event.element, target: { ...event.target }, hp: capacity,
        expiresAtFrame: event.frame + event.durationFrames };
      const index = after.shields.findIndex(candidate => candidate.typeKey === event.typeKey && same(candidate.target, event.target));
      if (index < 0) after.shields.push(shield);
      else { decision.callbacks.push({ kind: "OnOverwrite", instanceId: after.shields[index]!.instanceId, reason: "overwrite" }); after.shields[index] = shield; }
      decision.callbacks.push({ kind: "OnShielded", instanceId: shield.instanceId, reason: "grant" });
    } else if (task.kind === "reaction" || task.kind === "input" && task.event.kind === "incoming-hit") {
      const active = activeAt(task.frame, task.priority);
      const input = task.kind === "input" && task.event.kind === "incoming-hit" ? task.event : undefined;
      const reaction = task.kind === "reaction" ? task.event : undefined;
      const targetId = input === undefined ? reaction!.targetActorId : input.target.kind === "active" ? active : input.target.actorId;
      decision.inputEventId = input?.id ?? null; decision.inputEvent = input ?? null;
      decision.targetActorId = targetId; decision.activeCharacterId = active;
      decision.incomingDamage = input?.incomingDamage ?? reaction!.damageFactors.finalDamage;
      decision.incomingElement = input?.element ?? reaction!.element;
      decision.crystallizeDamageAfter = input?.incomingDamage ?? reaction!.shieldResolution.damageAfterShield;
      if (reaction !== undefined) playerDamageEventId = reaction.id;
      const bonuses = after.bonuses.filter(bonus => bonus.expiresAtFrame === null || bonus.expiresAtFrame > task.frame);
      decision.strengthBonus = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
      if (reaction !== undefined) equal(["playerDamageEvents", reaction.id, "shieldResolution", "shieldStrengthBonus"],
        reaction.shieldResolution.shieldStrengthBonus, reaction.shieldResolution.shieldId === null ? 0 : decision.strengthBonus,
        "parallel crystallize absorption must use the same once-read global shield bonus");
      after.bonuses = bonuses.filter(bonus => !bonus.consumeOnRead);
      const survivors: PlayerShieldState["shields"] = [];
      for (const shield of after.shields) {
        const applies = shield.target.kind === "active" ? targetId === active : shield.target.actorId === targetId;
        if (!applies) { survivors.push(shield); continue; }
        const absorptionMultiplier = decision.incomingElement === "geo" ? 1.5 : decision.incomingElement === shield.element ? 2.5 : 1;
        const effectiveAbsorptionMultiplier = absorptionMultiplier * (1 + decision.strengthBonus);
        const capacity = shield.hp * absorptionMultiplier * (1 + decision.strengthBonus);
        const hpAfter = Math.max(0, shield.hp - shield.hp * (decision.incomingDamage / capacity));
        const damageAfterShield = Math.max(0, decision.incomingDamage - capacity);
        const broken = hpAfter === 0;
        decision.shieldDetails.push({ instanceId: shield.instanceId, hpBefore: shield.hp, absorptionMultiplier, effectiveAbsorptionMultiplier,
          capacity, hpAfter, absorbedDamage: decision.incomingDamage - damageAfterShield, damageAfterShield, broken });
        shield.hp = hpAfter;
        if (broken) decision.callbacks.push({ kind: "OnShieldBreak", instanceId: shield.instanceId, reason: "damage" });
        else survivors.push(shield);
      }
      after.shields = survivors;
      decision.damageAfterShield = Math.min(decision.incomingDamage, decision.crystallizeDamageAfter, ...decision.shieldDetails.map(detail => detail.damageAfterShield));
      decision.absorbedDamage = decision.incomingDamage - decision.damageAfterShield;
      if (targetId !== null) hpResolution = hpDamage(targetId, decision.damageAfterShield);
      if (hpResolution !== undefined) {
        const actor = hp.get(targetId!)!;
        actor.currentHp = hpResolution.currentHpAfter;
        actor.totalIncomingDamage += decision.incomingDamage; actor.totalAbsorbedDamage += decision.absorbedDamage;
        actor.totalHpDamage += hpResolution.actualLoss; actor.hitCount++;
      }
    }
    const row = rows[logIndex];
    const path: Array<string | number> = ["playerShieldLog", logIndex];
    if (row === undefined) issue(path, "every actual shield decision requires its ordered result row");
    else {
      for (const [field, value] of Object.entries(decision)) equal([...path, field], row[field as keyof PlayerShieldDecision], value);
      equal([...path, "id"], row.id, logIndex);
      equal([...path, "frame"], row.frame, task.frame);
      equal([...path, "timeSeconds"], row.timeSeconds, task.frame / 60);
      equal([...path, "eventPriority"], row.eventPriority, task.priority);
      equal([...path, "eventSequence"], row.eventSequence, task.sequence);
      if (task.kind === "expire") {
        const firstGrant = model.events.find(event => event.kind === "grant" && event.frame + event.durationFrames === task.frame);
        const grantSequence = firstGrant === undefined ? undefined : rows.find(candidate => candidate.inputEventId === firstGrant.id)?.eventSequence;
        if (grantSequence !== undefined && row.eventSequence <= grantSequence || inputSequences.has(row.eventSequence)) issue([...path, "eventSequence"],
          "expiry tasks must follow their granting task and cannot reuse an input sequence");
      }
      equal([...path, "intraEventSequence"], row.intraEventSequence, task.intra);
      equal([...path, "playerDamageEventId"], row.playerDamageEventId, playerDamageEventId);
      equal([...path, "hpResolution"], row.hpResolution, hpResolution);
      if (task.kind === "reaction") {
        equal(["playerDamageEvents", task.event.id, "playerShieldLogId"], task.event.playerShieldLogId, logIndex);
        equal(["playerDamageEvents", task.event.id, "hpResolution"], task.event.hpResolution, hpResolution);
      }
      if (task.kind === "input" && task.event.kind === "incoming-hit" && hpResolution !== undefined) {
        const points = result.playerHpTimeline.points.filter(point => point.playerShieldLogId === logIndex);
        if (points.length !== 1) issue(path, "an explicit incoming shield hit requires one reciprocal HP timeline point");
        const point = points[0];
        if (point !== undefined) {
          for (const [field, value] of Object.entries({ operation: "shield-hit", actorId: decision.targetActorId,
            frame: task.frame, timeSeconds: task.frame / 60, eventPriority: task.priority, eventSequence: task.sequence,
            intraEventSequence: task.intra + 1, playerDamageEventId: null, maxHp: hpResolution.maxHp,
            hpBefore: hpResolution.currentHpBefore, hpAfter: hpResolution.currentHpAfter, hpRatioAfter: hpResolution.hpRatioAfter })) {
            equal(["playerHpTimeline", "points", point.id, field], point[field as keyof typeof point], value);
          }
        }
      }
    }
    state = clone(after);
    snapshots.push({ frame: task.frame, state: clone(state) });
    logIndex++;
  }
  equal(["playerShieldLog", "length"], rows.length, logIndex);
  equal(["playerShieldState"], result.playerShieldState, state);
  for (const [index, checkpoint] of (result.executionAudit?.phaseCheckpoints ?? []).entries()) {
    // Capture precedes every event at tick, including the negative-priority
    // expiry task. Replay history, rather than a result row's before-state,
    // determines which shields and lazy-expiring bonuses still exist.
    const captured = snapshots.filter(snapshot => snapshot.frame < checkpoint.tick).at(-1)?.state ?? initialState;
    const path: Array<string | number> = ["executionAudit", "phaseCheckpoints", index, "state"];
    const resources = checkpoint.state.resourcesAndHp as { playerShields?: unknown } | null;
    if (resources !== null) equal([...path, "resourcesAndHp", "playerShields"], resources.playerShields, {
      mode: model.mode,
      shields: captured.shields.map(({ instanceId: _instanceId, expiresAtFrame, ...shield }) => ({ ...shield,
        remainingTicks: expiresAtFrame - checkpoint.tick })),
      bonuses: captured.bonuses.map(({ expiresAtFrame, ...bonus }) => ({ ...bonus,
        remainingTicks: expiresAtFrame === null ? null : Math.max(0, expiresAtFrame - checkpoint.tick) }))
    });
    const pending = checkpoint.state.pendingEvents as { inFlight?: Array<{ type: string; remainingTicks: number; priority: number; payload: unknown }> } | null;
    if (pending !== null) {
      const inputs = model.events.filter(event => event.frame >= checkpoint.tick).map((event, order) => {
        const { frame, ...input } = event;
        return { type: "playerShieldInput", remainingTicks: frame - checkpoint.tick, priority: 2, payload: { input }, order };
      });
      // Expiry tasks are scheduled by grants that have actually executed.
      // Overwrite and break never cancel the task; one task serves each frame.
      const expiries = [...new Set(model.events.flatMap(event => event.kind === "grant" && event.frame < checkpoint.tick &&
        event.frame + event.durationFrames >= checkpoint.tick ? [event.frame + event.durationFrames] : []))]
        .map(frame => ({ type: "playerShieldExpiry", remainingTicks: frame - checkpoint.tick, priority: -0.5, payload: {}, order: 0 }));
      const expected = [...inputs, ...expiries].sort((a, b) => a.remainingTicks - b.remainingTicks || a.priority - b.priority || a.order - b.order)
        .map(({ order: _order, ...event }) => event);
      equal([...path, "pendingEvents", "inFlight"], pending.inFlight?.filter(event => event.type === "playerShieldInput" || event.type === "playerShieldExpiry"), expected,
        "checkpoint must preserve all future shield inputs and every executed grant's deduplicated expiry task");
    }
  }
  for (const point of result.playerHpTimeline.points) if (point.operation === "shield-hit" || point.playerShieldLogId !== undefined) {
    const row = point.playerShieldLogId === undefined ? undefined : rows[point.playerShieldLogId];
    if (row?.operation !== "incoming-hit" || point.operation !== "shield-hit") issue(["playerHpTimeline", "points", point.id], "shield HP point must reference an explicit incoming hit");
  }
  for (const [index, summary] of result.playerHpSummaries.entries()) {
    const actor = hp.get(summary.actorId);
    if (actor === undefined) continue;
    for (const field of ["initialHp", "totalIncomingDamage", "totalAbsorbedDamage", "totalHpDamage", "hitCount"] as const) equal(["playerHpSummaries", index, field], summary[field], actor[field]);
    equal(["playerHpSummaries", index, "finalHp"], summary.finalHp, actor.currentHp);
    equal(["playerHpSummaries", index, "zeroHpReached"], summary.zeroHpReached, actor.currentHp === 0);
  }
  equal(["totalPlayerDamageTaken"], result.totalPlayerDamageTaken, [...hp.values()].reduce((sum, actor) => sum + actor.totalHpDamage, 0));
  equal(["totalReactionSelfDamageTaken"], result.totalReactionSelfDamageTaken, result.playerDamageEvents.reduce((sum, event) => sum + event.finalDamage, 0));
}
