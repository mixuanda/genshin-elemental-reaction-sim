import type { RefinementCtx } from "zod";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { replayWeaponProcOccurrences } from "./weapon-proc-replay";
import { ARTIFACT_DAMAGE_PROFILE_ID, ARTIFACT_DAMAGE_SOURCE_REFS } from "./artifact-damage-schema";
import type { ArtifactDamageCapturedState, ArtifactDamageLogEntry, ArtifactDamageState, CharacterStats, DamageEvent, HitDefinition, PlayerHealthEvent, SimulationResult } from "./types";

type Point = { frame: number; timeSeconds: number; priority: number };
type Creation = { frame: number; priority: number; sequence: number; slot: number };
type Input = { frame: number; priority: number; sequence: number; slot: number } & (
  | { kind: "enemy-hit"; damage: DamageEvent; hit: HitDefinition }
  | { kind: "heal"; health: PlayerHealthEvent; creation: Creation }
  | { kind: "song-convert"; actorId: string; parentLogId: number; creation: Creation }
);
const cloneState = (state: ArtifactDamageState): ArtifactDamageState => ({ echoes: state.echoes.map(actor => ({ ...actor })), song: { ...state.song } });
const compareCreation = (a: Creation, b: Creation) => a.frame - b.frame || a.priority - b.priority || a.sequence - b.sequence || a.slot - b.slot;

/** Independent source RNG; capture preserves the unwrapped JS accumulator. */
function replayRandom(seed: string) {
  let accumulator = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) accumulator = Math.imul(accumulator ^ seed.charCodeAt(i), 0x01000193);
  accumulator >>>= 0;
  let drawCount = 0;
  return {
    next(): number {
      let value = (accumulator += 0x6d2b79f5);
      drawCount++;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    capture(): NonNullable<ArtifactDamageCapturedState["random"]> {
      return { algorithm: "fnv1a32-mulberry32-v1", state: accumulator >>> 0, accumulator, drawCount };
    }
  };
}

function healthCreation(result: SimulationResult, health: PlayerHealthEvent): Creation {
  if (health.periodicEntityLogId !== undefined) {
    const tick = result.periodicEntityLog?.[health.periodicEntityLogId];
    const parent = tick === undefined ? undefined : result.periodicEntityLog?.find(row => row.instanceId === tick.instanceId &&
      (tick.tickIndex === 0 ? row.operation === "spawn" || row.operation === "replace" : row.operation === "tick" && row.tickIndex === tick.tickIndex! - 1));
    if (parent !== undefined) return { frame: parent.frame, priority: parent.eventPriority, sequence: parent.eventSequence, slot: Number.MAX_SAFE_INTEGER };
  }
  const action = result.actionLog[health.actionLogIndex];
  return { frame: action?.frame ?? -1, priority: actionEventPriority(action === undefined ? undefined : actionOwner(result.config, action)),
    sequence: health.actionLogIndex, slot: 0 };
}

/** Source-owned flat additions are derived from actual hit/heal inputs. Output
 * rows provide only opaque heap/intra-event IDs, constrained by source causality. */
export function validateArtifactDamageIntegrity(result: SimulationResult, context: RefinementCtx,
  statsAt: (actorId: string, point: Point) => CharacterStats | undefined): ReadonlyMap<number, number> {
  const flatByDamageId = new Map<number, number>();
  const issue = (path: Array<string | number>, message: string) => context.addIssue({ code: "custom", path, message });
  const matches = (a: unknown, b: unknown): boolean => {
    if (typeof a === "number" && typeof b === "number") return Number.isInteger(a) && Number.isInteger(b) ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
    const left = Object.keys(a).sort(), right = Object.keys(b).sort();
    return left.length === right.length && left.every((key, i) => key === right[i] && matches((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  };
  const equal = (path: Array<string | number>, actual: unknown, expected: unknown) => {
    if (!matches(actual, expected)) issue(path, "must match independently replayed artifact damage source state and callbacks");
  };
  const model = result.config.artifactDamageModel;
  if (model === undefined) {
    if (result.artifactDamageLog !== undefined) issue(["artifactDamageLog"], "requires the explicit artifact damage model");
    if (result.artifactDamageState !== undefined) issue(["artifactDamageState"], "requires the explicit artifact damage model");
    for (const [index, checkpoint] of (result.executionAudit?.phaseCheckpoints ?? []).entries()) {
      const history = checkpoint.state.icdAndTriggerHistory as { artifactDamage?: unknown; randomExecution?: { streams?: Record<string, unknown> } } | null;
      const pending = checkpoint.state.pendingEvents as { inFlight?: Array<{ type?: string }> } | null;
      if (history?.artifactDamage !== undefined || history?.randomExecution?.streams?.artifactDamage !== undefined ||
          pending?.inFlight?.some(event => event.type === "artifactSongConvert")) issue(["executionAudit", "phaseCheckpoints", index], "artifact state and conversion tasks require their explicit damage model");
    }
    return flatByDamageId;
  }
  if (result.compatibilityMode !== "legal-frame-v1" || result.config.timeline === undefined) issue(["compatibilityMode"], "artifact damage callbacks require the explicit legal frame timeline");
  if (result.executionAudit === undefined) issue(["executionAudit"], "artifact damage requires captured ordinary formula inputs");
  const execution = result.resolvedRuntimeOptions.execution;
  if (model.actors.some(actor => actor.effectId === "song-of-days-past-4pc") && execution !== undefined &&
    [execution.lunarCharged, execution.lunarCrystallize, execution.lunarMixed, execution.lunarMixedV2,
      execution.lunarBloom, execution.stellarConduct, execution.stellarSwirl].some(value => value !== undefined)) {
    issue(["resolvedRuntimeOptions", "execution"], "Song of Days Past needs verified OnEnemyHit tags for special direct abilities");
  }
  // Echoes still uses the ordinary Normal OnEnemyHit stream in special
  // profiles. Song is gated above until direct special attack tags are known.
  const holders = result.config.characters.flatMap(character => model.actors.filter(actor => actor.actorId === character.id));
  const state: ArtifactDamageState = { echoes: holders.filter(actor => actor.effectId === "echoes-4pc").map(actor => ({
    actorId: actor.actorId, probability: .36, cooldownExpiresFrame: 0, riteExpiresFrame: 0 })),
    song: { healingPool: 0, yearningExpiresFrame: 0, waveHealing: 0, wavesExpiresFrame: 0, charges: 0 } };
  const random = state.echoes.length === 0 ? undefined : replayRandom(`${result.resolvedRuntimeOptions.randomSeed}:artifact-damage:echoes`);
  const capture = (): ArtifactDamageCapturedState => ({ state: cloneState(state), ...(random === undefined ? {} : { random: random.capture() }) });
  const initial = capture();
  const snapshots: Array<{ frame: number; captured: ArtifactDamageCapturedState }> = [];
  const rows: ArtifactDamageLogEntry[] = [];
  const tasks: Array<Extract<Input, { kind: "song-convert" }>> = [];
  const allHeals: Array<Extract<Input, { kind: "heal" }>> = [];
  const queue: Input[] = [];
  const procs = new Map(replayWeaponProcOccurrences(result).map(proc => [proc.actionId, proc]));
  const configuredHit = (damage: DamageEvent): HitDefinition | undefined => {
    const proc = procs.get(damage.actionId);
    if (proc !== undefined) return proc.hit;
    const owner = actionOwner(result.config, { actorId: damage.sourceActorId, actionId: damage.actionId,
      ...(damage.sourceAbilityId === undefined ? {} : { sourceAbilityId: damage.sourceAbilityId }) });
    const prefix = `${damage.actionId}:${damage.cycle}:`, suffix = `:${damage.frame}`;
    const index = damage.hitGroupId.startsWith(prefix) && damage.hitGroupId.endsWith(suffix) ? damage.hitGroupId.slice(prefix.length, -suffix.length) : "";
    return /^(0|[1-9]\d*)$/.test(index) ? owner?.hits?.[Number(index)] as HitDefinition | undefined : undefined;
  };
  for (const damage of result.damageEvents) {
    if (damage.kind !== "direct") continue;
    const hit = configuredHit(damage);
    const resolution = result.hitResolutionLog[damage.targetResolutionId];
    const group = result.directDamageGroupLog.find(row => row.damageEventId === damage.id);
    if (hit === undefined || resolution?.landed !== true || !resolution.hitConfirmAllowed ||
        (hit.groupMultiplier ?? 1) * (group?.sequenceMultiplier ?? 1) <= 0) continue;
    queue.push({ kind: "enemy-hit", damage, hit, frame: damage.frame, priority: damage.eventPriority, sequence: damage.eventSequence, slot: damage.targetIndex });
  }
  for (const health of result.playerHealthEvents ?? []) {
    if (health.operation !== "heal" || !holders.some(actor => actor.effectId === "song-of-days-past-4pc" && actor.actorId === health.sourceActorId)) continue;
    const input: Extract<Input, { kind: "heal" }> = { kind: "heal", health, creation: healthCreation(result, health),
      frame: health.frame, priority: health.eventPriority, sequence: health.eventSequence, slot: health.intraEventSequence };
    queue.push(input); allHeals.push(input);
  }
  const actions = [...result.actionLog, ...result.skippedActions].map(action => ({ actorId: action.actorId, frame: action.frame,
    priority: actionEventPriority(actionOwner(result.config, action)), order: action.timelineCommandIndex ?? 0 }))
    .sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.order - b.order);
  const activeAt = (input: Input): string | null => {
    let active = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
    for (const action of actions) {
      if (action.frame > input.frame || action.frame === input.frame && action.priority > input.priority) break;
      active = action.actorId;
    }
    return active;
  };
  const emit = (input: Input, actor: typeof holders[number], before: ArtifactDamageState,
    fields: Pick<ArtifactDamageLogEntry, "outcome"> & Partial<ArtifactDamageLogEntry>): ArtifactDamageLogEntry => {
    const row: ArtifactDamageLogEntry = { id: rows.length, sourceProfileId: ARTIFACT_DAMAGE_PROFILE_ID,
      sourceRef: ARTIFACT_DAMAGE_SOURCE_REFS[actor.effectId], effectId: actor.effectId, actorId: actor.actorId,
      frame: input.frame, timeSeconds: input.frame / 60, eventPriority: input.priority, eventSequence: input.sequence,
      intraEventSequence: result.artifactDamageLog?.[rows.length]?.intraEventSequence ?? -1,
      kind: input.kind, parentDamageEventId: null, hitResolutionLogId: null, playerHealthEventId: null, parentLogId: null,
      sourceActorId: actor.actorId, targetId: null, activeCharacterId: activeAt(input), attackTag: null, currentAttack: null,
      requestedHealing: null, random: null, flatDamage: 0, stateBefore: before, stateAfter: cloneState(state), ...fields };
    rows.push(row); snapshots.push({ frame: input.frame, captured: capture() });
    return row;
  };
  const endFrame = Math.round(result.config.duration * 60);
  while (queue.length > 0) {
    queue.sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.sequence - b.sequence || a.slot - b.slot);
    const input = queue.shift()!;
    if (input.frame > endFrame) continue;
    if (input.kind === "song-convert") {
      const actor = holders.find(actor => actor.actorId === input.actorId && actor.effectId === "song-of-days-past-4pc")!;
      const before = cloneState(state);
      state.song.waveHealing = state.song.healingPool; state.song.healingPool = 0;
      state.song.wavesExpiresFrame = input.frame + 600; state.song.charges = 5;
      emit(input, actor, before, { outcome: "waves-created", parentLogId: input.parentLogId });
      continue;
    }
    if (input.kind === "heal") {
      const actor = holders.find(actor => actor.actorId === input.health.sourceActorId && actor.effectId === "song-of-days-past-4pc")!;
      const before = cloneState(state);
      state.song.healingPool = Math.min(15000, state.song.healingPool + input.health.requestedAmount);
      const start = state.song.yearningExpiresFrame <= input.frame;
      if (start) state.song.yearningExpiresFrame = input.frame + 360;
      const row = emit(input, actor, before, { outcome: "recorded-healing", playerHealthEventId: input.health.id,
        sourceActorId: input.health.sourceActorId, targetId: input.health.targetActorId, requestedHealing: input.health.requestedAmount });
      if (start) {
        const actual = result.artifactDamageLog?.find(candidate => candidate.kind === "song-convert" && candidate.parentLogId === row.id);
        const task: Extract<Input, { kind: "song-convert" }> = { kind: "song-convert", actorId: actor.actorId,
          parentLogId: row.id, frame: input.frame + 360, priority: 2, sequence: actual?.eventSequence ?? Number.MAX_SAFE_INTEGER,
          slot: 0, creation: { frame: input.frame, priority: input.priority, sequence: input.sequence, slot: row.intraEventSequence } };
        tasks.push(task); queue.push(task);
      }
      continue;
    }
    const active = activeAt(input);
    for (const actor of holders) {
      const before = cloneState(state);
      const common = { sourceActorId: input.damage.sourceActorId, targetId: input.damage.targetId,
        parentDamageEventId: input.damage.id, hitResolutionLogId: input.damage.targetResolutionId, attackTag: input.hit.attackTag ?? null };
      let flatDamage = 0, currentAttack: number | null = null, draw: ArtifactDamageLogEntry["random"] = null;
      let outcome: ArtifactDamageLogEntry["outcome"];
      if (actor.effectId === "echoes-4pc") {
        const actorState = state.echoes.find(entry => entry.actorId === actor.actorId)!;
        if (active !== actor.actorId) outcome = "off-field";
        else if (input.damage.sourceActorId !== actor.actorId) outcome = "wrong-owner";
        else if (input.hit.attackTag !== "normal") outcome = "ineligible-tag";
        else {
          const stats = statsAt(actor.actorId, { frame: input.frame, timeSeconds: input.frame / 60, priority: input.priority });
          if (stats === undefined) issue(["artifactDamageLog", rows.length, "currentAttack"], "requires independently replayable live ATK");
          currentAttack = stats === undefined ? 0 : stats.baseAtk * (1 + stats.atkPct) + stats.flatAtk;
          if (input.frame < actorState.riteExpiresFrame) { outcome = "rite-active"; flatDamage = .7 * currentAttack; }
          else if (input.frame < actorState.cooldownExpiresFrame) outcome = "cooldown-blocked";
          else {
            const probability = actorState.probability, drawIndex = random!.capture().drawCount, roll = random!.next();
            draw = { probability, drawIndex, roll };
            actorState.cooldownExpiresFrame = input.frame + 12;
            if (roll > probability) { outcome = "roll-failed"; actorState.probability += .2; }
            else { outcome = "rite-triggered"; actorState.probability = .36; actorState.riteExpiresFrame = input.frame + 3; flatDamage = .7 * currentAttack; }
          }
        }
      } else if (!["normal", "charged", "plunge", "skill", "burst"].includes(input.hit.attackTag ?? "")) outcome = "ineligible-tag";
      else if (state.song.wavesExpiresFrame <= input.frame) outcome = "waves-inactive";
      else if (input.damage.sourceActorId !== active) outcome = "off-field";
      else {
        outcome = "waves-consumed"; flatDamage = .08 * state.song.waveHealing;
        state.song.charges--;
        if (state.song.charges === 0) state.song.wavesExpiresFrame = 0;
      }
      emit(input, actor, before, { ...common, outcome, flatDamage, currentAttack, random: draw });
      flatByDamageId.set(input.damage.id, (flatByDamageId.get(input.damage.id) ?? 0) + flatDamage);
    }
  }
  equal(["artifactDamageLog", "length"], result.artifactDamageLog?.length, rows.length);
  let previous: ArtifactDamageLogEntry | undefined;
  for (const expected of rows) {
    const actual = result.artifactDamageLog?.[expected.id];
    if (actual === undefined) continue;
    const path: Array<string | number> = ["artifactDamageLog", expected.id];
    equal(path, actual, expected);
    if (previous !== undefined && compareCreation({ frame: actual.frame, priority: actual.eventPriority, sequence: actual.eventSequence, slot: actual.intraEventSequence },
        { frame: previous.frame, priority: previous.eventPriority, sequence: previous.eventSequence, slot: previous.intraEventSequence }) <= 0) issue(path, "artifact callbacks must preserve actual event and holder order");
    previous = actual;
    if (actual.kind === "enemy-hit") {
      const resolution = result.hitResolutionLog[expected.hitResolutionLogId!];
      if (resolution?.intraEventSequence !== undefined && actual.intraEventSequence <= resolution.intraEventSequence) issue([...path, "intraEventSequence"], "OnEnemyHit must follow the actual target hit resolution");
    } else if (actual.kind === "heal") {
      const health = result.playerHealthEvents?.[expected.playerHealthEventId!];
      if (health !== undefined && actual.intraEventSequence !== health.intraEventSequence + 2) issue([...path, "intraEventSequence"], "OnHeal must follow this target's health event and HP point");
    }
  }
  for (const task of tasks.filter(task => task.frame <= endFrame)) {
    const actual = rows.find(row => row.kind === "song-convert" && row.parentLogId === task.parentLogId)!;
    const path = ["artifactDamageLog", actual.id, "eventSequence"];
    if (task.sequence <= task.creation.sequence) issue(path, "conversion must be queued by its actual starting heal");
    for (const heal of allHeals) {
      const order = compareCreation(heal.creation, task.creation);
      if (order < 0 ? heal.sequence >= task.sequence : order > 0 && heal.sequence <= task.sequence) issue(path, "conversion sequence must follow independently derived health-task enqueue order");
    }
    for (const other of tasks.filter(other => other.frame <= endFrame && other !== task)) {
      const order = compareCreation(other.creation, task.creation);
      if (order < 0 && other.sequence >= task.sequence) issue(path, "conversion tasks must retain their actual heal-callback FIFO order");
    }
  }
  equal(["artifactDamageState"], result.artifactDamageState, capture());
  for (const [index, checkpoint] of (result.executionAudit?.phaseCheckpoints ?? []).entries()) {
    const captured = snapshots.filter(snapshot => snapshot.frame < checkpoint.tick).at(-1)?.captured ?? initial;
    const history = checkpoint.state.icdAndTriggerHistory as { artifactDamage?: unknown; randomExecution?: { streams?: Record<string, unknown> } } | null;
    const path: Array<string | number> = ["executionAudit", "phaseCheckpoints", index, "state"];
    if (history !== null) {
      equal([...path, "icdAndTriggerHistory", "artifactDamage"], history.artifactDamage, {
        mode: model.mode, actors: model.actors,
        echoes: [...captured.state.echoes].sort((a, b) => a.actorId.localeCompare(b.actorId)).map(actor => ({ actorId: actor.actorId,
          probability: actor.probability, cooldownRemainingTicks: Math.max(0, actor.cooldownExpiresFrame - checkpoint.tick),
          riteRemainingTicks: Math.max(0, actor.riteExpiresFrame - checkpoint.tick) })),
        song: { healingPool: captured.state.song.healingPool, yearningRemainingTicks: Math.max(0, captured.state.song.yearningExpiresFrame - checkpoint.tick),
          waveHealing: captured.state.song.waveHealing, wavesRemainingTicks: Math.max(0, captured.state.song.wavesExpiresFrame - checkpoint.tick), charges: captured.state.song.charges }
      });
      equal([...path, "icdAndTriggerHistory", "randomExecution", "streams", "artifactDamage"], history.randomExecution?.streams?.artifactDamage, captured.random);
    }
    const pending = checkpoint.state.pendingEvents as { inFlight?: Array<{ type: string; remainingTicks: number; priority: number; payload: unknown }> } | null;
    if (pending !== null) equal([...path, "pendingEvents", "inFlight"], pending.inFlight?.filter(event => event.type === "artifactSongConvert"),
      tasks.filter(task => task.creation.frame < checkpoint.tick && task.frame >= checkpoint.tick).sort((a, b) => a.frame - b.frame || a.sequence - b.sequence).map(task => ({
        type: "artifactSongConvert", remainingTicks: task.frame - checkpoint.tick, priority: 2,
        payload: { actorId: task.actorId, sourceAgeTicks: checkpoint.tick - task.creation.frame }
      })));
  }
  return flatByDamageId;
}
