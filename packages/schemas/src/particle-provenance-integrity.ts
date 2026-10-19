import { isDeclaredTargetDefeatedMiss } from "./target-health-integrity";
import type { RefinementCtx } from "zod";
import { EnergyReplayRandom, replayFavoniusParticleSpawns } from "./energy-replay-integrity";
import { actionEventPriority, actionOwner, isActionHitSelected } from "./action-condition-integrity";
import { replayPeriodicEntities } from "./periodic-entity-replay";
import { replayWeaponProcOccurrences } from "./weapon-proc-replay";
import { resolveTimelineCommandAbilityId } from "./source-normal-chain";
import type {
  ActorPoseDefinition,
  HitDefinition,
  HitGeometry,
  HitTargeting,
  ParticleCount,
  ParticleElement,
  ParticleKind,
  ResolvedWorldHitGeometry,
  SimulationResult
} from "./types";

type IssuePath = Array<string | number>;
type ActionLogEntry = SimulationResult["actionLog"][number];
type HitResolutionLogEntry =
  SimulationResult["hitResolutionLog"][number];
type ConfiguredHitElementResolver = (
  action: ActionLogEntry,
  hitIndex: number,
  frame: number,
  timeSeconds: number,
  configuredElement: HitResolutionLogEntry["element"]
) => HitResolutionLogEntry["element"];

const FLOAT_TOLERANCE = 1e-9;
const GEOMETRY_EPSILON = 1e-9;
const FPS = 60;
const MAX_ROW_ISSUES = 32;

interface NormalizedHitBlueprint {
  id: string | undefined;
  offsetSeconds: number;
  label: string | undefined;
  element: HitDefinition["element"];
  scalingOwnerId: string | undefined;
  targeting: HitDefinition["targeting"];
  geometry: HitDefinition["geometry"];
}

interface NormalizedParticleTrigger {
  hitIds: readonly string[];
  probability: number | undefined;
  internalCooldownKey: string | null;
  internalCooldownDurationFrames: number | null;
}

interface NormalizedParticleBlueprint {
  index: number;
  id: string | undefined;
  source: string | undefined;
  element: ParticleElement;
  kind: ParticleKind;
  count: ParticleCount;
  spawnOffsetSeconds: number | null;
  travelTimeSeconds: number;
  trigger: NormalizedParticleTrigger | null;
}

interface NormalizedActionBlueprint {
  priority: number;
  actorId: string;
  definitionId: string;
  name: string;
  hits: NormalizedHitBlueprint[];
  periodicHitIds: ReadonlySet<string>;
  particles: NormalizedParticleBlueprint[];
  configPath: IssuePath;
}

interface BoundAction {
  logIndex: number;
  log: Pick<ActionLogEntry, "time" | "frame" | "actorId" | "actionId" | "action" | "cycle">;
  blueprint: NormalizedActionBlueprint;
  /** Configured action order, or the independently validated triggering callback's sequence. */
  executionOrder: number;
  timelineCommandIndex: number | undefined;
  sourceAbilityId: string | undefined;
  weaponProcOccurrence?: ReturnType<typeof replayWeaponProcOccurrences>[number];
}

interface IndexedHitResolution {
  index: number;
  row: HitResolutionLogEntry;
}

interface IndexedDirectDamageEvent {
  index: number;
  event: SimulationResult["damageEvents"][number];
}

interface ExpectedHitGroup {
  priority: number;
  action: BoundAction;
  hit: NormalizedHitBlueprint & { id: string };
  hitIndex: number;
  frame: number;
  timeSeconds: number;
  hitGroupId: string;
  enqueueFrame: number;
  enqueueTimeSeconds: number;
  enqueuePriority: number;
  enqueueOrder: number;
  targetPlans: ExpectedDirectTargetPlan[];
  rows: IndexedHitResolution[];
}

interface ConfiguredEnemyTarget {
  id: string;
  name: string;
  position: { x: number; y: number } | null;
  hitboxRadius: number;
}

interface ExpectedDirectTargetPlan {
  targetId: string;
  targetName: string;
  targetingSource: "default" | "scripted" | "geometry";
  targetPosition: { x: number; y: number } | null;
  sourceActorPosition: { x: number; y: number } | null;
  sourceActorFacingDegrees: number | null;
  geometryKind: HitGeometry["kind"] | null;
  geometryCoordinateSpace: "world" | "actor-local" | null;
  geometryOrigin: { x: number; y: number } | null;
  geometryStart: { x: number; y: number } | null;
  geometryEnd: { x: number; y: number } | null;
  geometryRadius: number | null;
  geometryHalfWidth: number | null;
  geometryHalfHeight: number | null;
  geometryRotationDegrees: number | null;
  geometryDirectionDegrees: number | null;
  geometryAngleDegrees: number | null;
  geometryDistance: number | null;
  geometryThreshold: number | null;
  outcome: "landed" | "miss";
  landed: boolean;
  reason: string | null;
  targetEffectSource: "normal" | "hit" | "target-phase";
  targetPhaseId: string | null;
  damageAllowed: boolean;
  auraAllowed: boolean;
  hitConfirmAllowed: boolean;
}

interface ExpectedTrigger {
  index: number;
  action: BoundAction;
  particle: NormalizedParticleBlueprint;
  group: ExpectedHitGroup;
  source: string;
  particleId: string;
  checkedTargetIds: string[];
  confirmedTargetIds: string[];
  triggered: boolean;
  blockedReason:
    | "INTERNAL_COOLDOWN"
    | "TARGET_MISS"
    | "TARGET_HIT_CONFIRM_BLOCKED"
    | "PROBABILITY_FAILED"
    | null;
  internalCooldownReadyFrame: number | null;
  probability?: number;
  roll?: number | null;
  drawIndex?: number | null;
  rngStream?: "particle-trigger-v1";
}

interface ExpectedParticleOccurrence {
  priority: number;
  action: BoundAction;
  particle: NormalizedParticleBlueprint;
  source: string;
  particleId: string;
  spawnFrame: number;
  spawnTimeSeconds: number;
  cycle: number;
  triggerLogId: number | null;
  triggerHitId: string | null;
  enqueueKind: "scheduled" | "hit-confirm" | "favonius";
  enqueueOrder: number;
  callbackResolutionIndex?: number | undefined;
}

function addIssue(
  context: RefinementCtx,
  path: IssuePath,
  message: string
): void {
  context.addIssue({
    code: "custom",
    path,
    message
  });
}

function nearlyEqual(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    FLOAT_TOLERANCE *
      Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function expectEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    addIssue(
      context,
      path,
      `${label} must equal ${String(expected)}; received ${String(actual)}`
    );
  }
}

function expectNearlyEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: number,
  expected: number,
  label: string
): void {
  if (!nearlyEqual(actual, expected)) {
    addIssue(
      context,
      path,
      `${label} must equal ${expected}; received ${actual}`
    );
  }
}

function expectStringArray(
  context: RefinementCtx,
  path: IssuePath,
  actual: readonly string[],
  expected: readonly string[],
  label: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    addIssue(
      context,
      path,
      `${label} must equal [${expected.join(", ")}]; received [${actual.join(", ")}]`
    );
  }
}

function toFrame(timeSeconds: number): number {
  return Math.round(timeSeconds * FPS);
}

function tupleKey(
  ...values: ReadonlyArray<string | number>
): string {
  return JSON.stringify(values);
}

function outputTime(
  frameNative: boolean,
  rawTimeSeconds: number
): number {
  return frameNative
    ? toFrame(rawTimeSeconds) / FPS
    : rawTimeSeconds;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distancePointToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared =
    segmentX * segmentX + segmentY * segmentY;
  const fromStartX = point.x - start.x;
  const fromStartY = point.y - start.y;
  const projection =
    segmentLengthSquared === 0
      ? 0
      : clamp(
          (fromStartX * segmentX + fromStartY * segmentY) /
            segmentLengthSquared,
          0,
          1
        );
  return Math.hypot(
    point.x - (start.x + segmentX * projection),
    point.y - (start.y + segmentY * projection)
  );
}

function normalizeSignedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function transformActorLocalPoint(
  point: { x: number; y: number },
  actorPosition: { x: number; y: number },
  actorFacingDegrees: number
): { x: number; y: number } {
  const radians = (actorFacingDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x:
      actorPosition.x +
      point.x * cosine -
      point.y * sine,
    y:
      actorPosition.y +
      point.x * sine +
      point.y * cosine
  };
}

function resolveWorldHitGeometry(
  geometry: HitGeometry,
  actorPose:
    | {
        position: { x: number; y: number };
        facingDegrees: number;
      }
    | undefined
): ResolvedWorldHitGeometry {
  if ((geometry.coordinateSpace ?? "world") === "world") {
    return {
      ...geometry,
      coordinateSpace: "world"
    } as ResolvedWorldHitGeometry;
  }
  if (actorPose === undefined) {
    throw new Error(
      "Actor-local geometry passed Schema validation without an actor pose."
    );
  }
  if (geometry.kind === "circle") {
    return {
      ...geometry,
      coordinateSpace: "world",
      origin: transformActorLocalPoint(
        geometry.origin,
        actorPose.position,
        actorPose.facingDegrees
      )
    };
  }
  if (geometry.kind === "rectangle") {
    return {
      ...geometry,
      coordinateSpace: "world",
      origin: transformActorLocalPoint(
        geometry.origin,
        actorPose.position,
        actorPose.facingDegrees
      ),
      rotationDegrees: normalizeSignedDegrees(
        geometry.rotationDegrees + actorPose.facingDegrees
      )
    };
  }
  if (geometry.kind === "capsule") {
    return {
      ...geometry,
      coordinateSpace: "world",
      start: transformActorLocalPoint(
        geometry.start,
        actorPose.position,
        actorPose.facingDegrees
      ),
      end: transformActorLocalPoint(
        geometry.end,
        actorPose.position,
        actorPose.facingDegrees
      )
    };
  }
  return {
    ...geometry,
    coordinateSpace: "world",
    origin: transformActorLocalPoint(
      geometry.origin,
      actorPose.position,
      actorPose.facingDegrees
    ),
    directionDegrees: normalizeSignedDegrees(
      geometry.directionDegrees + actorPose.facingDegrees
    )
  };
}

function resolveHitGeometry(
  geometry: ResolvedWorldHitGeometry,
  targetPosition: { x: number; y: number },
  hitboxRadius: number
): {
  landed: boolean;
  distance: number;
  threshold: number;
  missReason: string;
} {
  if (geometry.kind === "circle") {
    const distance = Math.hypot(
      targetPosition.x - geometry.origin.x,
      targetPosition.y - geometry.origin.y
    );
    const threshold = geometry.radius + hitboxRadius;
    return {
      landed: distance <= threshold + GEOMETRY_EPSILON,
      distance,
      threshold,
      missReason: "OUTSIDE_CIRCLE_GEOMETRY"
    };
  }
  if (geometry.kind === "rectangle") {
    const radians = (geometry.rotationDegrees * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const deltaX = targetPosition.x - geometry.origin.x;
    const deltaY = targetPosition.y - geometry.origin.y;
    const localX = deltaX * cosine + deltaY * sine;
    const localY = -deltaX * sine + deltaY * cosine;
    const closestX = clamp(
      localX,
      -geometry.halfWidth,
      geometry.halfWidth
    );
    const closestY = clamp(
      localY,
      -geometry.halfHeight,
      geometry.halfHeight
    );
    const distance = Math.hypot(
      localX - closestX,
      localY - closestY
    );
    return {
      landed: distance <= hitboxRadius + GEOMETRY_EPSILON,
      distance,
      threshold: hitboxRadius,
      missReason: "OUTSIDE_RECTANGLE_GEOMETRY"
    };
  }
  if (geometry.kind === "sector") {
    const deltaX = targetPosition.x - geometry.origin.x;
    const deltaY = targetPosition.y - geometry.origin.y;
    const centerDistance = Math.hypot(deltaX, deltaY);
    const threshold = hitboxRadius;
    if (geometry.angleDegrees === 360) {
      const distance = Math.max(0, centerDistance - geometry.radius);
      return {
        landed: distance <= threshold + GEOMETRY_EPSILON,
        distance,
        threshold,
        missReason: "OUTSIDE_SECTOR_GEOMETRY"
      };
    }
    const targetDirectionDegrees =
      (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
    const angularDifference = Math.abs(
      normalizeSignedDegrees(
        targetDirectionDegrees - geometry.directionDegrees
      )
    );
    const halfAngleDegrees = geometry.angleDegrees / 2;
    const centerInside =
      centerDistance <= geometry.radius + GEOMETRY_EPSILON &&
      angularDifference <= halfAngleDegrees + GEOMETRY_EPSILON;
    let distance = 0;
    if (!centerInside) {
      const boundaryAngles = [
        geometry.directionDegrees - halfAngleDegrees,
        geometry.directionDegrees + halfAngleDegrees
      ];
      distance = Math.min(
        ...boundaryAngles.map((angleDegrees) => {
          const angleRadians = (angleDegrees * Math.PI) / 180;
          return distancePointToSegment(
            targetPosition,
            geometry.origin,
            {
              x:
                geometry.origin.x +
                geometry.radius * Math.cos(angleRadians),
              y:
                geometry.origin.y +
                geometry.radius * Math.sin(angleRadians)
            }
          );
        })
      );
      if (
        angularDifference <=
        halfAngleDegrees + GEOMETRY_EPSILON
      ) {
        distance = Math.min(
          distance,
          Math.abs(centerDistance - geometry.radius)
        );
      }
    }
    return {
      landed: distance <= threshold + GEOMETRY_EPSILON,
      distance,
      threshold,
      missReason: "OUTSIDE_SECTOR_GEOMETRY"
    };
  }
  const distance = distancePointToSegment(
    targetPosition,
    geometry.start,
    geometry.end
  );
  const threshold = geometry.radius + hitboxRadius;
  return {
    landed: distance <= threshold + GEOMETRY_EPSILON,
    distance,
    threshold,
    missReason: "OUTSIDE_CAPSULE_GEOMETRY"
  };
}

function expectPoint(
  context: RefinementCtx,
  path: IssuePath,
  actual: { x: number; y: number } | null,
  expected: { x: number; y: number } | null,
  label: string
): void {
  if (actual === null || expected === null) {
    expectEqual(context, path, actual, expected, label);
    return;
  }
  expectNearlyEqual(context, [...path, "x"], actual.x, expected.x, label);
  expectNearlyEqual(context, [...path, "y"], actual.y, expected.y, label);
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Frozen 1.42 particle-count PRNG. This intentionally lives in the Schema
 * package as a replay implementation rather than importing sim-core.
 */
class ParticleReplayRandom {
  private state: number;

  constructor(seed: string) {
    this.state = fnv1a32(seed);
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^=
      value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

function resolveParticleCount(
  count: ParticleCount,
  random: ParticleReplayRandom
): number {
  if (typeof count === "number") return count;
  const step = count.step ?? 1;
  const stepCount = Math.floor(
    (count.max - count.min) / step + 1e-9
  );
  return Number(
    (
      count.min +
      random.integer(stepCount + 1) * step
    ).toFixed(12)
  );
}

function normalizeLegacyAction(
  action: SimulationResult["config"]["rotation"][number],
  actionIndex: number
): NormalizedActionBlueprint {
  return {
    priority: actionEventPriority(action),
    actorId: action.actorId,
    definitionId: action.id,
    name: action.name,
    periodicHitIds: new Set((action.periodicEntities ?? []).flatMap(entity => entity.hitIds)),
    hits: (action.hits ?? []).map((hit) => ({
      id: hit.id,
      offsetSeconds: hit.offset,
      label: hit.label,
      element: hit.element,
      scalingOwnerId: hit.scalingOwnerId,
      targeting: hit.targeting,
      geometry: hit.geometry
    })),
    particles: (action.particles ?? []).map(
      (particle, particleIndex) => ({
        index: particleIndex,
        id: particle.id,
        source: particle.source,
        element: particle.element,
        kind: particle.kind ?? "particle",
        count: particle.count,
        spawnOffsetSeconds:
          particle.trigger === undefined
            ? (particle.spawnOffset ?? 0)
            : null,
        travelTimeSeconds: particle.travelTime,
        trigger:
          particle.trigger === undefined
            ? null
            : {
                hitIds: particle.trigger.hitIds,
                probability: particle.trigger.probability,
                internalCooldownKey:
                  particle.trigger.internalCooldown?.key ?? null,
                internalCooldownDurationFrames:
                  particle.trigger.internalCooldown === undefined
                    ? null
                    : Math.max(
                        1,
                        toFrame(
                          particle.trigger.internalCooldown.duration
                        )
                      )
              }
      })
    ),
    configPath: ["config", "rotation", actionIndex]
  };
}

function normalizeTimelineAbility(
  ability: NonNullable<
    SimulationResult["config"]["timeline"]
  >["abilities"][number],
  abilityIndex: number
): NormalizedActionBlueprint {
  return {
    priority: actionEventPriority(ability),
    actorId: ability.actorId,
    definitionId: ability.id,
    name: ability.name,
    periodicHitIds: new Set((ability.periodicEntities ?? []).flatMap(entity => entity.hitIds)),
    hits: (ability.hits ?? []).map((hit) => ({
      id: hit.id,
      offsetSeconds: hit.frame / FPS,
      label: hit.label,
      element: hit.element,
      scalingOwnerId: hit.scalingOwnerId,
      targeting: hit.targeting,
      geometry: hit.geometry
    })),
    particles: (ability.particles ?? []).map(
      (particle, particleIndex) => ({
        index: particleIndex,
        id: particle.id,
        source: particle.source,
        element: particle.element,
        kind: particle.kind ?? "particle",
        count: particle.count,
        spawnOffsetSeconds:
          particle.trigger === undefined
            ? (particle.spawnFrame ?? 0) / FPS
            : null,
        travelTimeSeconds: particle.travelFrames / FPS,
        trigger:
          particle.trigger === undefined
            ? null
            : {
                hitIds: particle.trigger.hitIds,
                probability: particle.trigger.probability,
                internalCooldownKey:
                  particle.trigger.internalCooldown?.key ?? null,
                internalCooldownDurationFrames:
                  particle.trigger.internalCooldown === undefined
                    ? null
                    : Math.max(
                        1,
                        particle.trigger.internalCooldown
                          .durationFrames
                      )
              }
      })
    ),
    configPath: [
      "config",
      "timeline",
      "abilities",
      abilityIndex
    ]
  };
}

function validateActionIdentity(
  result: SimulationResult,
  context: RefinementCtx,
  bound: BoundAction,
  expectedActionId: string,
  expectedFrame: number,
  expectedTimeSeconds: number,
  expectedCycle: number
): void {
  const path = ["actionLog", bound.logIndex] satisfies IssuePath;
  expectEqual(
    context,
    [...path, "actorId"],
    bound.log.actorId,
    bound.blueprint.actorId,
    "particle action actorId"
  );
  expectEqual(
    context,
    [...path, "actionId"],
    bound.log.actionId,
    expectedActionId,
    "particle action actionId"
  );
  expectEqual(
    context,
    [...path, "action"],
    bound.log.action,
    bound.blueprint.name,
    "particle action name"
  );
  expectEqual(
    context,
    [...path, "frame"],
    bound.log.frame,
    expectedFrame,
    "particle action frame"
  );
  expectNearlyEqual(
    context,
    [...path, "time"],
    bound.log.time,
    expectedTimeSeconds,
    "particle action time"
  );
  expectEqual(
    context,
    [...path, "cycle"],
    bound.log.cycle,
    expectedCycle,
    "particle action cycle"
  );

  if (
    bound.blueprint.particles.length > 0 &&
    !result.config.characters.some(
      (character) => character.id === bound.log.actorId
    )
  ) {
    addIssue(
      context,
      [...path, "actorId"],
      `particle action references missing actor ${bound.log.actorId}`
    );
  }
}

function bindLegacyActions(
  result: SimulationResult,
  context: RefinementCtx
): BoundAction[] {
  const frameNative =
    result.compatibilityMode === "legal-frame-v1";
  const definitionKeyCounts = new Map<string, number>();
  for (const action of result.config.rotation) {
    const key = tupleKey(action.actorId, action.id);
    definitionKeyCounts.set(
      key,
      (definitionKeyCounts.get(key) ?? 0) + 1
    );
  }
  for (const [actionIndex, action] of
    result.config.rotation.entries()) {
    const key = tupleKey(action.actorId, action.id);
    if ((definitionKeyCounts.get(key) ?? 0) <= 1) continue;
    addIssue(
      context,
      ["config", "rotation", actionIndex, "id"],
      "particle provenance is ambiguous because multiple rotation actions share actorId and actionId"
    );
  }

  const actionLogByOccurrence = new Map<
    string,
    Array<{ log: ActionLogEntry; logIndex: number }>
  >();
  for (const [logIndex, log] of result.actionLog.entries()) {
    const key = tupleKey(log.actorId, log.actionId, log.cycle);
    const rows = actionLogByOccurrence.get(key) ?? [];
    rows.push({ log, logIndex });
    actionLogByOccurrence.set(key, rows);
  }
  const skippedByOccurrence = new Map<
    string,
    Array<{
      row: SimulationResult["skippedActions"][number];
      index: number;
    }>
  >();
  for (const [index, row] of result.skippedActions.entries()) {
    const key = tupleKey(row.actorId, row.actionId, row.cycle);
    const rows = skippedByOccurrence.get(key) ?? [];
    rows.push({ row, index });
    skippedByOccurrence.set(key, rows);
  }

  const consumedActionLogIndexes = new Set<number>();
  const consumedSkippedIndexes = new Set<number>();
  const boundActions: BoundAction[] = [];
  const missingOccurrencesByDefinition = new Map<number, number>();
  const ambiguousOccurrencesByDefinition = new Map<number, number>();
  let executionOrder = 0;
  const cycleCount = Math.ceil(
    result.config.duration / result.config.cycleLength
  );
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    for (const [actionIndex, action] of
      result.config.rotation.entries()) {
      if (action.once && cycle > 0) continue;
      if (action.cycles?.includes(cycle) === false) continue;
      if (
        action.everyNCycles !== undefined &&
        cycle % action.everyNCycles !==
          (action.cycleRemainder ?? 0)
      ) {
        continue;
      }
      const rawTime =
        cycle * result.config.cycleLength + action.at;
      if (rawTime > result.config.duration) continue;
      if (
        frameNative &&
        toFrame(rawTime) / FPS >
          result.config.duration + FLOAT_TOLERANCE
      ) {
        continue;
      }
      const occurrenceExecutionOrder = executionOrder++;
      const key = tupleKey(action.actorId, action.id, cycle);
      const actionRows = actionLogByOccurrence.get(key) ?? [];
      const skippedRows = skippedByOccurrence.get(key) ?? [];
      const definitionKey = tupleKey(action.actorId, action.id);
      if ((definitionKeyCounts.get(definitionKey) ?? 0) !== 1) {
        continue;
      }
      if (actionRows.length + skippedRows.length !== 1) {
        const bucket =
          actionRows.length + skippedRows.length === 0
            ? missingOccurrencesByDefinition
            : ambiguousOccurrencesByDefinition;
        bucket.set(actionIndex, (bucket.get(actionIndex) ?? 0) + 1);
        continue;
      }
      const expectedFrame = toFrame(rawTime);
      const expectedTime = frameNative
        ? expectedFrame / FPS
        : rawTime;
      const skipped = skippedRows[0];
      if (skipped !== undefined) {
        consumedSkippedIndexes.add(skipped.index);
        const path = [
          "skippedActions",
          skipped.index
        ] satisfies IssuePath;
        for (const [field, expected] of [
          ["actorId", action.actorId],
          ["actionId", action.id],
          ["action", action.name],
          ["frame", expectedFrame],
          ["cycle", cycle]
        ] as const) {
          expectEqual(
            context,
            [...path, field],
            skipped.row[field],
            expected,
            `scheduled skipped action ${field}`
          );
        }
        expectNearlyEqual(
          context,
          [...path, "time"],
          skipped.row.time,
          expectedTime,
          "scheduled skipped action time"
        );
        continue;
      }
      const executed = actionRows[0];
      if (executed === undefined) continue;
      consumedActionLogIndexes.add(executed.logIndex);
      const blueprint = normalizeLegacyAction(
        action,
        actionIndex
      );
      const bound = {
        logIndex: executed.logIndex,
        log: executed.log,
        blueprint,
        executionOrder: occurrenceExecutionOrder,
        timelineCommandIndex: undefined,
        sourceAbilityId: undefined
      };
      validateActionIdentity(
        result,
        context,
        bound,
        blueprint.definitionId,
        expectedFrame,
        expectedTime,
        cycle
      );
      expectEqual(
        context,
        ["actionLog", executed.logIndex, "timelineCommandIndex"],
        executed.log.timelineCommandIndex,
        undefined,
        "legacy action timelineCommandIndex"
      );
      expectEqual(
        context,
        ["actionLog", executed.logIndex, "sourceAbilityId"],
        executed.log.sourceAbilityId,
        undefined,
        "legacy action sourceAbilityId"
      );
      boundActions.push(bound);
    }
  }

  let occurrenceIssues = 0;
  let omittedOccurrenceDefinitions = 0;
  let omittedOccurrences = 0;
  for (const [
    actionIndex,
    count
  ] of missingOccurrencesByDefinition) {
    if (occurrenceIssues < MAX_ROW_ISSUES) {
      addIssue(
        context,
        ["config", "rotation", actionIndex],
        `${count} scheduled action occurrence(s) are missing their executed or energy-skipped row`
      );
      occurrenceIssues += 1;
    } else {
      omittedOccurrenceDefinitions += 1;
      omittedOccurrences += count;
    }
  }
  for (const [
    actionIndex,
    count
  ] of ambiguousOccurrencesByDefinition) {
    if (occurrenceIssues < MAX_ROW_ISSUES) {
      addIssue(
        context,
        ["config", "rotation", actionIndex],
        `${count} scheduled action occurrence(s) own multiple executed or energy-skipped rows`
      );
      occurrenceIssues += 1;
    } else {
      omittedOccurrenceDefinitions += 1;
      omittedOccurrences += count;
    }
  }
  if (omittedOccurrenceDefinitions > 0) {
    addIssue(
      context,
      ["config", "rotation"],
      `${omittedOccurrences} additional invalid scheduled occurrence(s) across ${omittedOccurrenceDefinitions} action definition(s) omitted by the integrity issue budget`
    );
  }

  let orphanActionIssues = 0;
  let orphanActionCount = 0;
  for (const [logIndex] of result.actionLog.entries()) {
    if (consumedActionLogIndexes.has(logIndex)) continue;
    orphanActionCount += 1;
    if (orphanActionIssues < MAX_ROW_ISSUES) {
      addIssue(
        context,
        ["actionLog", logIndex],
        "executed legacy action is not owned by a configured scheduled occurrence"
      );
      orphanActionIssues += 1;
    }
  }
  if (orphanActionCount > orphanActionIssues) {
    addIssue(
      context,
      ["actionLog"],
      `${orphanActionCount - orphanActionIssues} additional orphan legacy action row(s) omitted by the integrity issue budget`
    );
  }
  let orphanSkippedIssues = 0;
  let orphanSkippedCount = 0;
  for (const [skippedIndex, skipped] of
    result.skippedActions.entries()) {
    if (
      skipped.timelineCommandIndex !== undefined ||
      consumedSkippedIndexes.has(skippedIndex)
    ) {
      continue;
    }
    orphanSkippedCount += 1;
    if (orphanSkippedIssues < MAX_ROW_ISSUES) {
      addIssue(
        context,
        ["skippedActions", skippedIndex],
        "energy-skipped legacy action is not owned by a configured scheduled occurrence"
      );
      orphanSkippedIssues += 1;
    }
  }
  if (orphanSkippedCount > orphanSkippedIssues) {
    addIssue(
      context,
      ["skippedActions"],
      `${orphanSkippedCount - orphanSkippedIssues} additional orphan skipped-action row(s) omitted by the integrity issue budget`
    );
  }
  return boundActions;
}

function bindTimelineActions(
  result: SimulationResult,
  context: RefinementCtx
): BoundAction[] {
  const timeline = result.config.timeline;
  const execution = result.timelineExecution;
  if (timeline === undefined || execution === undefined) {
    addIssue(
      context,
      ["timelineExecution"],
      "timeline particle provenance requires both config.timeline and timelineExecution"
    );
    return [];
  }

  const abilitiesById = new Map<
    string,
    NormalizedActionBlueprint[]
  >();
  timeline.abilities.forEach((ability, abilityIndex) => {
    const blueprint = normalizeTimelineAbility(
      ability,
      abilityIndex
    );
    const definitions = abilitiesById.get(ability.id) ?? [];
    definitions.push(blueprint);
    abilitiesById.set(ability.id, definitions);
  });

  const actionLogsByTimelineCommand = new Map<
    string,
    Array<{ log: ActionLogEntry; logIndex: number }>
  >();
  result.actionLog.forEach((log, logIndex) => {
    if (
      log.timelineCommandIndex === undefined ||
      log.sourceAbilityId === undefined
    ) {
      return;
    }
    const key = tupleKey(
      log.timelineCommandIndex,
      log.sourceAbilityId
    );
    const rows = actionLogsByTimelineCommand.get(key) ?? [];
    rows.push({ log, logIndex });
    actionLogsByTimelineCommand.set(key, rows);
  });

  const consumedActionLogIndexes = new Set<number>();
  const boundActions: BoundAction[] = [];
  for (const [
    commandResultIndex,
    commandResult
  ] of execution.commandResults.entries()) {
    if (
      commandResult.abilityId === null ||
      commandResult.status === "rejected"
    ) {
      continue;
    }
    const commandIndex = commandResult.commandIndex;
    const command = timeline.commands[commandIndex];
    if (
      command === undefined ||
      !("abilityId" in command) ||
      resolveTimelineCommandAbilityId(command, commandResult.abilityId, result.config.sourceAbilityBindings) !== commandResult.abilityId
    ) {
      addIssue(
        context,
        [
          "timelineExecution",
          "commandResults",
          commandResultIndex,
          "abilityId"
        ],
        "executed particle ability must backlink the configured command"
      );
      continue;
    }
    const definitions =
      abilitiesById.get(commandResult.abilityId) ?? [];
    if (definitions.length !== 1) {
      addIssue(
        context,
        [
          "timelineExecution",
          "commandResults",
          commandResultIndex,
          "abilityId"
        ],
        definitions.length === 0
          ? "cannot bind particle provenance to a configured ability"
          : "particle provenance is ambiguous because ability IDs are duplicated"
      );
      continue;
    }
    const blueprint = definitions[0];
    if (blueprint === undefined) continue;
    const startFrame = commandResult.startFrame;
    if (startFrame === null) {
      addIssue(
        context,
        [
          "timelineExecution",
          "commandResults",
          commandResultIndex,
          "startFrame"
        ],
        "executed particle ability requires a startFrame"
      );
      continue;
    }
    // Timeline actions are first materialized as compiled rotation rows; that
    // outer action scheduling gate is exact (no event-queue epsilon).
    if (startFrame / FPS > result.config.duration) {
      continue;
    }
    const candidates =
      actionLogsByTimelineCommand.get(
        tupleKey(commandIndex, commandResult.abilityId)
      ) ?? [];
    if (candidates.length !== 1) {
      addIssue(
        context,
        [
          "timelineExecution",
          "commandResults",
          commandResultIndex
        ],
        `executed ability must own exactly one actionLog row; received ${candidates.length}`
      );
      continue;
    }
    const candidate = candidates[0];
    if (candidate === undefined) continue;
    consumedActionLogIndexes.add(candidate.logIndex);
    const bound = {
      logIndex: candidate.logIndex,
      log: candidate.log,
      blueprint,
      executionOrder: commandResultIndex,
      timelineCommandIndex: commandIndex,
      sourceAbilityId: blueprint.definitionId
    };
    validateActionIdentity(
      result,
      context,
      bound,
      `${blueprint.definitionId}#${commandIndex}`,
      startFrame,
      startFrame / FPS,
      0
    );
    expectEqual(
      context,
      ["actionLog", candidate.logIndex, "timelineCommandIndex"],
      candidate.log.timelineCommandIndex,
      commandIndex,
      "particle action timelineCommandIndex"
    );
    expectEqual(
      context,
      ["actionLog", candidate.logIndex, "sourceAbilityId"],
      candidate.log.sourceAbilityId,
      blueprint.definitionId,
      "particle action sourceAbilityId"
    );
    boundActions.push(bound);
  }

  for (const [logIndex, log] of result.actionLog.entries()) {
    if (
      log.sourceAbilityId !== undefined &&
      !consumedActionLogIndexes.has(logIndex)
    ) {
      addIssue(
        context,
        ["actionLog", logIndex, "sourceAbilityId"],
        "ability-backed action is not owned by an executed timeline command"
      );
    }
  }

  return boundActions;
}

function bindActions(
  result: SimulationResult,
  context: RefinementCtx
): BoundAction[] {
  if (
    (result.config.timeline === undefined) !==
    (result.timelineExecution === undefined)
  ) {
    addIssue(
      context,
      ["timelineExecution"],
      "config.timeline and timelineExecution must be jointly present for particle replay"
    );
  }
  return result.config.timeline === undefined
    ? bindLegacyActions(result, context)
    : bindTimelineActions(result, context);
}

/** Proc actions are callback-owned occurrences, never additional actionLog rows. */
function bindWeaponProcActions(result: SimulationResult): BoundAction[] {
  return replayWeaponProcOccurrences(result).map(occurrence => ({
    logIndex: -1,
    log: {
      time: occurrence.action.at,
      frame: occurrence.snapshotFrame,
      actorId: occurrence.actorId,
      actionId: occurrence.actionId,
      action: occurrence.action.name,
      cycle: occurrence.cycle
    },
    blueprint: {
      ...normalizeLegacyAction(occurrence.action, -1),
      priority: occurrence.snapshotPriority,
      configPath: ["config", "weaponProcModel", "actors",
        result.config.weaponProcModel!.actors.findIndex(actor => actor.actorId === occurrence.actorId)]
    },
    executionOrder: occurrence.snapshotEventSequence ?? occurrence.callbackEventSequence ?? occurrence.parent.eventSequence,
    timelineCommandIndex: undefined,
    sourceAbilityId: undefined,
    weaponProcOccurrence: occurrence
  }));
}

function particleIdentity(
  action: BoundAction,
  particle: NormalizedParticleBlueprint
): { particleId: string; source: string } {
  const particleId =
    particle.id ??
    `${action.log.actionId}:particle-${particle.index}`;
  return {
    particleId,
    source:
      particle.source ??
      `${action.log.action}:${particleId}`
  };
}

function resolveConfiguredEnemyTargets(
  result: SimulationResult
): ConfiguredEnemyTarget[] {
  return (
    result.config.enemy.targets ?? [
      {
        id: "enemy-0",
        name: "敌人 0"
      }
    ]
  ).map((target) => ({
    id: target.id,
    name: target.name,
    position:
      target.position === undefined ? null : { ...target.position },
    hitboxRadius: target.hitboxRadius ?? 0
  }));
}

function createTargetPositionResolver(
  result: SimulationResult,
  targets: readonly ConfiguredEnemyTarget[]
): (
  targetId: string,
  frame: number
) => { x: number; y: number } | null {
  const initialPositionByTarget = new Map(
    targets.map((target) => [target.id, target.position])
  );
  const lastPositionByTarget = new Map(initialPositionByTarget);
  const motionsByTarget = new Map<
    string,
    Array<{
      startFrame: number;
      endFrame: number;
      startPosition: { x: number; y: number };
      endPosition: { x: number; y: number };
    }>
  >();
  for (const motion of result.config.enemy.targetMotions ?? []) {
    const startPosition = lastPositionByTarget.get(motion.targetId);
    if (startPosition === null || startPosition === undefined) {
      throw new Error(
        `Target motion "${motion.id}" passed Schema validation without an initial position.`
      );
    }
    const resolved = {
      startFrame: motion.startFrame,
      endFrame: motion.endFrame,
      startPosition: { ...startPosition },
      endPosition: { ...motion.endPosition }
    };
    const motions = motionsByTarget.get(motion.targetId) ?? [];
    motions.push(resolved);
    motionsByTarget.set(motion.targetId, motions);
    lastPositionByTarget.set(motion.targetId, {
      ...motion.endPosition
    });
  }

  return (targetId, frame) => {
    const initialPosition =
      initialPositionByTarget.get(targetId) ?? null;
    if (initialPosition === null) return null;
    let position = initialPosition;
    for (const motion of motionsByTarget.get(targetId) ?? []) {
      if (frame < motion.startFrame) break;
      if (frame >= motion.endFrame) {
        position = motion.endPosition;
        continue;
      }
      const progress =
        (frame - motion.startFrame) /
        (motion.endFrame - motion.startFrame);
      return {
        x:
          motion.startPosition.x +
          (motion.endPosition.x - motion.startPosition.x) *
            progress,
        y:
          motion.startPosition.y +
          (motion.endPosition.y - motion.startPosition.y) *
            progress
      };
    }
    return { ...position };
  };
}

function resolveExpectedDirectTargetPlan({
  result,
  actorPose,
  frame,
  target,
  targeting,
  targetingSource,
  targetPosition,
  resolvedGeometry,
  geometryCoordinateSpace,
  geometryResolution
}: {
  result: SimulationResult;
  actorPose: ActorPoseDefinition | undefined;
  frame: number;
  target: ConfiguredEnemyTarget;
  targeting: HitTargeting | undefined;
  targetingSource: "default" | "scripted" | "geometry";
  targetPosition: { x: number; y: number } | null;
  resolvedGeometry: ResolvedWorldHitGeometry | null;
  geometryCoordinateSpace: "world" | "actor-local" | null;
  geometryResolution:
    | ReturnType<typeof resolveHitGeometry>
    | null;
}): ExpectedDirectTargetPlan {
  const outcome =
    geometryResolution === null
      ? (targeting?.outcome ?? "landed")
      : geometryResolution.landed
        ? "landed"
        : "miss";
  const activePhase = result.config.enemy.targetPhases?.find(
    (phase) =>
      phase.targetId === target.id &&
      frame >= phase.startFrame &&
      frame < phase.endFrame
  );
  const effects = targeting?.effects ?? activePhase?.effects;
  const targetEffectSource =
    targeting?.effects !== undefined || outcome === "miss"
      ? ("hit" as const)
      : activePhase === undefined
        ? ("normal" as const)
        : ("target-phase" as const);
  const landed = outcome === "landed";
  const reason =
    targeting?.reason ??
    (geometryResolution?.landed === false
      ? geometryResolution.missReason
      : targetEffectSource === "target-phase"
        ? activePhase?.reason ?? null
        : null);

  return {
    targetId: target.id,
    targetName: target.name,
    targetingSource,
    targetPosition,
    sourceActorPosition:
      actorPose === undefined ? null : { ...actorPose.position },
    sourceActorFacingDegrees: actorPose?.facingDegrees ?? null,
    geometryKind: resolvedGeometry?.kind ?? null,
    geometryCoordinateSpace,
    geometryOrigin:
      resolvedGeometry === null ||
      resolvedGeometry.kind === "capsule"
        ? null
        : { ...resolvedGeometry.origin },
    geometryStart:
      resolvedGeometry?.kind === "capsule"
        ? { ...resolvedGeometry.start }
        : null,
    geometryEnd:
      resolvedGeometry?.kind === "capsule"
        ? { ...resolvedGeometry.end }
        : null,
    geometryRadius:
      resolvedGeometry?.kind === "circle" ||
      resolvedGeometry?.kind === "capsule" ||
      resolvedGeometry?.kind === "sector"
        ? resolvedGeometry.radius
        : null,
    geometryHalfWidth:
      resolvedGeometry?.kind === "rectangle"
        ? resolvedGeometry.halfWidth
        : null,
    geometryHalfHeight:
      resolvedGeometry?.kind === "rectangle"
        ? resolvedGeometry.halfHeight
        : null,
    geometryRotationDegrees:
      resolvedGeometry?.kind === "rectangle"
        ? resolvedGeometry.rotationDegrees
        : null,
    geometryDirectionDegrees:
      resolvedGeometry?.kind === "sector"
        ? resolvedGeometry.directionDegrees
        : null,
    geometryAngleDegrees:
      resolvedGeometry?.kind === "sector"
        ? resolvedGeometry.angleDegrees
        : null,
    geometryDistance: geometryResolution?.distance ?? null,
    geometryThreshold: geometryResolution?.threshold ?? null,
    outcome,
    landed,
    reason,
    targetEffectSource,
    targetPhaseId: activePhase?.id ?? null,
    damageAllowed:
      landed && effects?.damage !== "immune",
    auraAllowed: landed && effects?.aura !== "blocked",
    hitConfirmAllowed:
      landed && effects?.hitConfirm !== "blocked"
  };
}

function buildExpectedTargetPlans(
  result: SimulationResult,
  hit: NormalizedHitBlueprint,
  frame: number,
  targets: readonly ConfiguredEnemyTarget[],
  resolveTargetPosition: (
    targetId: string,
    frame: number
  ) => { x: number; y: number } | null,
  poseActorId: string | undefined
): ExpectedDirectTargetPlan[] {
  const actorPose = result.config.actorPoses?.find(
    (pose) => pose.actorId === poseActorId
  );
  const geometry = hit.geometry;
  if (geometry !== undefined) {
    const resolvedGeometry = resolveWorldHitGeometry(
      geometry,
      actorPose
    );
    return targets.map((target) => {
      const targetPosition = resolveTargetPosition(target.id, frame);
      if (targetPosition === null) {
        throw new Error(
          `Target "${target.id}" passed Schema validation without a position.`
        );
      }
      const geometryResolution = resolveHitGeometry(
        resolvedGeometry,
        targetPosition,
        target.hitboxRadius
      );
      return resolveExpectedDirectTargetPlan({
        result,
        actorPose,
        frame,
        target,
        targeting: {
          targetId: target.id,
          outcome: geometryResolution.landed ? "landed" : "miss",
          ...(geometryResolution.landed
            ? {}
            : { reason: geometryResolution.missReason })
        },
        targetingSource: "geometry",
        targetPosition,
        resolvedGeometry,
        geometryCoordinateSpace:
          geometry.coordinateSpace ?? "world",
        geometryResolution
      });
    });
  }

  const configuredTargeting =
    hit.targeting === undefined
      ? [undefined]
      : "mode" in hit.targeting
        ? hit.targeting.targets
        : [hit.targeting];
  const targetById = new Map(
    targets.map((target) => [target.id, target])
  );
  return configuredTargeting.map((targeting) => {
    const targetId = targeting?.targetId ?? "enemy-0";
    const target = targetById.get(targetId);
    if (target === undefined) {
      throw new Error(
        `Target "${targetId}" passed Schema validation but was not resolved.`
      );
    }
    return resolveExpectedDirectTargetPlan({
      result,
      actorPose,
      frame,
      target,
      targeting,
      targetingSource:
        targeting === undefined ? "default" : "scripted",
      targetPosition: resolveTargetPosition(target.id, frame),
      resolvedGeometry: null,
      geometryCoordinateSpace: null,
      geometryResolution: null
    });
  });
}

function validateDirectTargetRow(
  context: RefinementCtx,
  indexed: IndexedHitResolution,
  action: BoundAction,
  hit: NormalizedHitBlueprint & { id: string },
  expectedElement: HitResolutionLogEntry["element"],
  hitGroupId: string,
  frame: number,
  timeSeconds: number,
  targetIndex: number,
  targetCount: number,
  plan: ExpectedDirectTargetPlan
): void {
  const { row, index } = indexed;
  const path = ["hitResolutionLog", index] satisfies IssuePath;
  for (const [field, expected] of [
    ["sourceActorId", action.log.actorId],
    ["sourceActionId", action.log.actionId],
    ["actionName", action.log.action],
    ["hitId", hit.id],
    ["hitGroupId", hitGroupId],
    ["cycle", action.log.cycle],
    ["frame", frame],
    ["targetIndex", targetIndex],
    ["targetCount", targetCount],
    ["targetId", plan.targetId],
    ["targetName", plan.targetName],
    ["hitLabel", hit.label ?? "命中"],
    ["element", expectedElement],
    ["targetingSource", plan.targetingSource],
    ["sourceActorFacingDegrees", plan.sourceActorFacingDegrees],
    ["geometryKind", plan.geometryKind],
    ["geometryCoordinateSpace", plan.geometryCoordinateSpace],
    ["geometryRadius", plan.geometryRadius],
    ["geometryHalfWidth", plan.geometryHalfWidth],
    ["geometryHalfHeight", plan.geometryHalfHeight],
    ["geometryRotationDegrees", plan.geometryRotationDegrees],
    ["geometryDirectionDegrees", plan.geometryDirectionDegrees],
    ["geometryAngleDegrees", plan.geometryAngleDegrees],
    ["outcome", plan.outcome],
    ["landed", plan.landed],
    ["reason", plan.reason],
    ["targetEffectSource", plan.targetEffectSource],
    ["targetPhaseId", plan.targetPhaseId],
    ["damageAllowed", plan.damageAllowed],
    ["auraAllowed", plan.auraAllowed],
    ["hitConfirmAllowed", plan.hitConfirmAllowed]
  ] as const) {
    expectEqual(
      context,
      [...path, field],
      row[field],
      expected,
      `configured direct hit ${field}`
    );
  }
  expectNearlyEqual(
    context,
    [...path, "timeSeconds"],
    row.timeSeconds,
    timeSeconds,
    "configured direct hit timeSeconds"
  );
  for (const [field, expected] of [
    ["geometryDistance", plan.geometryDistance],
    ["geometryThreshold", plan.geometryThreshold]
  ] as const) {
    if (expected === null || row[field] === null) {
      expectEqual(
        context,
        [...path, field],
        row[field],
        expected,
        `configured direct hit ${field}`
      );
    } else {
      expectNearlyEqual(
        context,
        [...path, field],
        row[field],
        expected,
        `configured direct hit ${field}`
      );
    }
  }
  for (const [field, expected] of [
    ["targetPosition", plan.targetPosition],
    ["sourceActorPosition", plan.sourceActorPosition],
    ["geometryOrigin", plan.geometryOrigin],
    ["geometryStart", plan.geometryStart],
    ["geometryEnd", plan.geometryEnd]
  ] as const) {
    expectPoint(
      context,
      [...path, field],
      row[field],
      expected,
      `configured direct hit ${field}`
    );
  }
  expectEqual(
    context,
    [...path, "timelineCommandIndex"],
    row.timelineCommandIndex,
    action.timelineCommandIndex,
    "configured direct hit timelineCommandIndex"
  );
  expectEqual(
    context,
    [...path, "sourceAbilityId"],
    row.sourceAbilityId,
    action.sourceAbilityId,
    "configured direct hit sourceAbilityId"
  );
}

function validateDirectTargetDamageCompleteness(
  result: SimulationResult,
  context: RefinementCtx,
  indexed: IndexedHitResolution,
  plan: ExpectedDirectTargetPlan,
  directDamageEventsByResolutionId: ReadonlyMap<
    number,
    readonly IndexedDirectDamageEvent[]
  >
): void {
  const { row, index } = indexed;
  const path = ["hitResolutionLog", index] satisfies IssuePath;
  const matchingDamageEvents =
    directDamageEventsByResolutionId.get(index) ?? [];

  if (!plan.landed) {
    expectEqual(
      context,
      [...path, "damageEventId"],
      row.damageEventId,
      null,
      "configured missed direct hit damageEventId"
    );
    expectNearlyEqual(
      context,
      [...path, "potentialDamage"],
      row.potentialDamage,
      0,
      "configured missed direct hit potentialDamage"
    );
    expectNearlyEqual(
      context,
      [...path, "finalDamage"],
      row.finalDamage,
      0,
      "configured missed direct hit finalDamage"
    );
    expectEqual(
      context,
      [...path, "displayDamage"],
      row.displayDamage,
      0,
      "configured missed direct hit displayDamage"
    );
    if (matchingDamageEvents.length !== 0) {
      addIssue(
        context,
        [...path, "damageEventId"],
        `configured missed direct hit must not own a direct damage event; received ${matchingDamageEvents.length}`
      );
    }
    return;
  }

  if (matchingDamageEvents.length !== 1) {
    addIssue(
      context,
      [...path, "damageEventId"],
      `configured landed direct hit must own exactly one direct damage event; received ${matchingDamageEvents.length}`
    );
  }
  const matchingDamageEvent = matchingDamageEvents[0];
  if (matchingDamageEvent === undefined) return;

  expectEqual(
    context,
    [...path, "damageEventId"],
    row.damageEventId,
    matchingDamageEvent.index,
    "configured landed direct hit damage-event backlink"
  );
  const backlink =
    row.damageEventId === null
      ? undefined
      : result.damageEvents[row.damageEventId];
  if (
    backlink === undefined ||
    backlink !== matchingDamageEvent.event ||
    backlink.kind !== "direct" ||
    backlink.targetResolutionId !== index
  ) {
    addIssue(
      context,
      [...path, "damageEventId"],
      "configured landed direct hit must backlink its matching direct damage event"
    );
  }
}

function buildExpectedHitGroups(
  result: SimulationResult,
  context: RefinementCtx,
  actions: readonly BoundAction[],
  resolveConfiguredHitElement?: ConfiguredHitElementResolver
): ExpectedHitGroup[] {
  const frameNative =
    result.compatibilityMode === "legal-frame-v1";
  const rowsByGroupId = new Map<
    string,
    IndexedHitResolution[]
  >();
  result.hitResolutionLog.forEach((row, index) => {
    if (row.resolutionKind !== "direct") return;
    const rows = rowsByGroupId.get(row.hitGroupId) ?? [];
    rows.push({ row, index });
    rowsByGroupId.set(row.hitGroupId, rows);
  });
  const directDamageEventsByResolutionId = new Map<
    number,
    IndexedDirectDamageEvent[]
  >();
  result.damageEvents.forEach((event, index) => {
    if (event.kind !== "direct") return;
    const events =
      directDamageEventsByResolutionId.get(
        event.targetResolutionId
      ) ?? [];
    events.push({ event, index });
    directDamageEventsByResolutionId.set(
      event.targetResolutionId,
      events
    );
  });

  const claimedGroupIds = new Set<string>();
  const consumedDirectRowIndexes = new Set<number>();
  const expectedGroups: ExpectedHitGroup[] = [];
  const configuredTargets = resolveConfiguredEnemyTargets(result);
  const resolveTargetPosition = createTargetPositionResolver(
    result,
    configuredTargets
  );
  const periodicTicks = replayPeriodicEntities(result).filter(row => row.operation === "tick");
  // Action events select the active actor before their energy check, including
  // skipped actions. Periodic entities capture that actor's static pose at the
  // tick; a swap during the later hit delay must not move the queued geometry.
  const activeAttempts = periodicTicks.length === 0 ? [] : [...result.actionLog, ...result.skippedActions].sort((left, right) =>
    left.frame - right.frame || actionEventPriority(actionOwner(result.config, left)) - actionEventPriority(actionOwner(result.config, right)) || left.cycle - right.cycle ||
    (left.timelineCommandIndex ?? result.config.rotation.findIndex(action => action.id === left.actionId && action.actorId === left.actorId)) -
    (right.timelineCommandIndex ?? result.config.rotation.findIndex(action => action.id === right.actionId && action.actorId === right.actorId)));
  const activeAt = (frame: number, priority: number): string | undefined => {
    let actorId = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id;
    for (const attempt of activeAttempts) {
      if (attempt.frame > frame || attempt.frame === frame && actionEventPriority(actionOwner(result.config, attempt)) > priority) break;
      actorId = attempt.actorId;
    }
    return actorId;
  };
  for (const action of actions) {
    const actionTicks = periodicTicks.filter(tick => tick.actionLogIndex === action.logIndex);
    const hitOccurrences = action.blueprint.hits.flatMap((hit, hitIndex) => {
      if (action.weaponProcOccurrence === undefined &&
          !isActionHitSelected(result, action.logIndex, hit.id ?? `${action.log.actionId}:hit-${hitIndex}`)) return [];
      if (hit.id !== undefined && action.blueprint.periodicHitIds.has(hit.id)) {
        return actionTicks.filter(tick => tick.definition.hitIds.includes(hit.id!)).map(tick => ({
          hit, hitIndex, rawTimeSeconds: (tick.frame + tick.definition.hitDelayFrames) / FPS,
          enqueueFrame: tick.frame, enqueueTimeSeconds: tick.frame / FPS, enqueuePriority: tick.eventPriority, enqueueOrder: tick.order,
          poseActorId: action.weaponProcOccurrence === undefined ? activeAt(tick.frame, tick.eventPriority) ?? action.log.actorId : undefined
        }));
      }
      return [{ hit, hitIndex, rawTimeSeconds: action.log.time + hit.offsetSeconds,
        enqueueFrame: action.weaponProcOccurrence?.snapshotFrame ?? action.log.frame,
        enqueueTimeSeconds: action.weaponProcOccurrence?.snapshotTimeSeconds ?? action.log.time,
        enqueuePriority: action.weaponProcOccurrence?.snapshotPriority ?? action.blueprint.priority, enqueueOrder: action.executionOrder,
        poseActorId: action.weaponProcOccurrence === undefined ? action.log.actorId : undefined }];
    });
    hitOccurrences.forEach(({ hit, hitIndex, rawTimeSeconds, enqueueFrame, enqueueTimeSeconds, enqueuePriority, enqueueOrder, poseActorId }) => {
      const hitId =
        hit.id ?? `${action.log.actionId}:hit-${hitIndex}`;
      const normalizedHit = { ...hit, id: hitId };
      const scalingOwnerId =
        hit.scalingOwnerId ?? action.log.actorId;
      const scalingOwner = result.config.characters.find(
        (character) => character.id === scalingOwnerId
      );
      if (scalingOwner === undefined) {
        throw new Error(
          `Hit "${hitId}" passed Schema validation without scaling owner "${scalingOwnerId}".`
        );
      }
      const configuredElement = hit.element ?? scalingOwner.element;
      if (
        rawTimeSeconds >
        result.config.duration + FLOAT_TOLERANCE
      ) {
        return;
      }
      const frame = toFrame(rawTimeSeconds);
      if (
        frameNative &&
        frame / FPS >
          result.config.duration + FLOAT_TOLERANCE
      ) {
        return;
      }
      const timeSeconds = frameNative
        ? frame / FPS
        : rawTimeSeconds;
      const priority = 3 + (enqueuePriority >= 8 && frame === enqueueFrame ? 10 : 0);
      const expectedElement = action.weaponProcOccurrence !== undefined ? configuredElement : resolveConfiguredHitElement?.(
        result.actionLog[action.logIndex]!, hitIndex, frame, timeSeconds, configuredElement
      ) ?? configuredElement;
      const hitGroupId =
        `${action.log.actionId}:${action.log.cycle}:` +
        `${hitIndex}:${frame}`;
      if (claimedGroupIds.has(hitGroupId)) {
        addIssue(
          context,
          ["hitResolutionLog"],
          `particle trigger group ${hitGroupId} has ambiguous action ownership`
        );
        return;
      }
      claimedGroupIds.add(hitGroupId);
      const rows = rowsByGroupId.get(hitGroupId) ?? [];
      const targetPlans = buildExpectedTargetPlans(
        result,
        hit,
        frame,
        configuredTargets,
        resolveTargetPosition,
        poseActorId
      );
      if (rows.length !== targetPlans.length) {
        addIssue(
          context,
          ["hitResolutionLog"],
          `direct hit group ${hitGroupId} must contain exactly ${targetPlans.length} configured target row(s); received ${rows.length}`
        );
      }
      const rowsByTargetIndex = new Map<
        number,
        IndexedHitResolution[]
      >();
      for (const indexed of rows) {
        const matches =
          rowsByTargetIndex.get(indexed.row.targetIndex) ?? [];
        matches.push(indexed);
        rowsByTargetIndex.set(indexed.row.targetIndex, matches);
      }
      const claimedRows: IndexedHitResolution[] = [];
      targetPlans.forEach((plan, targetIndex) => {
        const matches = rowsByTargetIndex.get(targetIndex) ?? [];
        if (matches.length !== 1) {
          addIssue(
            context,
            ["hitResolutionLog"],
            `direct hit group ${hitGroupId} targetIndex ${targetIndex} must own exactly one row; received ${matches.length}`
          );
        }
        const indexed = matches[0];
        if (indexed === undefined) return;
        if (isDeclaredTargetDefeatedMiss(result, indexed.row)) {
          plan.outcome = "miss";
          plan.landed = false;
          plan.reason = "TARGET_DEFEATED";
          plan.targetEffectSource = "hit";
          plan.damageAllowed = false;
          plan.auraAllowed = false;
          plan.hitConfirmAllowed = false;
        }
        consumedDirectRowIndexes.add(indexed.index);
        claimedRows.push(indexed);
        validateDirectTargetRow(
          context,
          indexed,
          action,
          normalizedHit,
          expectedElement,
          hitGroupId,
          frame,
          timeSeconds,
          targetIndex,
          targetPlans.length,
          plan
        );
        const damage = indexed.row.damageEventId === null ? undefined : result.damageEvents[indexed.row.damageEventId];
        if (damage !== undefined) {
          expectEqual(context, ["damageEvents", damage.id, "eventPriority"],
            damage.eventPriority, priority, "configured direct hit priority");
          expectEqual(context, ["damageEvents", damage.id, "weaponProcLogId"],
            damage.weaponProcLogId, action.weaponProcOccurrence?.logId, "configured direct hit weapon proc owner");
          expectEqual(context, ["damageEvents", damage.id, "parentDamageEventId"],
            damage.parentDamageEventId, action.weaponProcOccurrence?.parent.id ?? null, "configured direct hit callback parent");
        }
        validateDirectTargetDamageCompleteness(
          result,
          context,
          indexed,
          plan,
          directDamageEventsByResolutionId
        );
      });
      expectedGroups.push({
        priority,
        action,
        hit: normalizedHit,
        hitIndex,
        frame,
        timeSeconds,
        hitGroupId,
        enqueueFrame,
        enqueueTimeSeconds,
        enqueuePriority,
        enqueueOrder,
        targetPlans,
        rows: claimedRows
      });
    });
  }

  for (const action of actions) {
    const occurrence = action.weaponProcOccurrence;
    if (occurrence !== undefined && !consumedDirectRowIndexes.has(occurrence.parent.targetResolutionId)) {
      addIssue(context, ["weaponProcLog", occurrence.logId, "parentDamageEventId"],
        "weapon proc parent must belong to an independently replayed executed direct hit target");
    }
  }

  let orphanIssues = 0;
  let orphanCount = 0;
  result.hitResolutionLog.forEach((row, index) => {
    if (
      row.resolutionKind !== "direct" ||
      consumedDirectRowIndexes.has(index)
    ) {
      return;
    }
    orphanCount += 1;
    if (orphanIssues < MAX_ROW_ISSUES) {
      addIssue(
        context,
        ["hitResolutionLog", index],
        "direct hit row is not owned one-to-one by a configured executed hit target"
      );
      orphanIssues += 1;
    }
  });
  if (orphanCount > orphanIssues) {
    addIssue(
      context,
      ["hitResolutionLog"],
      `${orphanCount - orphanIssues} additional orphan direct-hit row(s) omitted by the integrity issue budget`
    );
  }

  // Sword's delayed task is queued by the actual parent hit, then creates its
  // own immediate hit when it runs. Authenticate the task ID against every
  // independently bound hit enqueue, so a forged task ID cannot move its hit
  // across another weapon's deferred callback in the same frame.
  const delayedTasks = new Map(actions.flatMap(action => {
    const proc = action.weaponProcOccurrence;
    return proc?.snapshotEventSequence === undefined ? [] : [[proc.logId, proc] as const];
  }));
  for (const proc of delayedTasks.values()) {
    for (const group of expectedGroups) {
      const creationOrder = (frameNative ? group.enqueueFrame - proc.parent.frame
        : group.enqueueTimeSeconds - proc.parent.timeSeconds) ||
        group.enqueuePriority - proc.parent.eventPriority || group.enqueueOrder - proc.parent.eventSequence;
      if (creationOrder === 0) continue;
      for (const { row } of group.rows) {
        if (creationOrder < 0 ? row.eventSequence! >= proc.snapshotEventSequence! : row.eventSequence! <= proc.snapshotEventSequence!) {
          addIssue(context, ["weaponProcLog", proc.logId, "snapshotEventSequence"],
            "delayed weapon task sequence must follow independently replayed hit enqueue order");
        }
      }
    }
  }

  const sortedGroups = expectedGroups.sort((left, right) => {
    const hitClockOrder = frameNative
      ? left.frame - right.frame
      : left.timeSeconds - right.timeSeconds;
    if (hitClockOrder !== 0) return hitClockOrder;
    if (left.priority !== right.priority) return left.priority - right.priority;
    const enqueueClockOrder = frameNative
      ? left.enqueueFrame - right.enqueueFrame
      : left.enqueueTimeSeconds - right.enqueueTimeSeconds;
    return (
      enqueueClockOrder ||
      left.enqueuePriority - right.enqueuePriority ||
      left.enqueueOrder - right.enqueueOrder ||
      left.hitIndex - right.hitIndex
    );
  });
  const canonicalDirectRowOrder = sortedGroups.flatMap((group) =>
    group.rows.map(({ index }) => index)
  );
  const actualDirectRowOrder = result.hitResolutionLog.flatMap(
    (row, index) => (row.resolutionKind === "direct" ? [index] : [])
  );
  if (
    canonicalDirectRowOrder.length === actualDirectRowOrder.length &&
    canonicalDirectRowOrder.some(
      (index, order) => index !== actualDirectRowOrder[order]
    )
  ) {
    addIssue(
      context,
      ["hitResolutionLog"],
      "direct hit rows must follow configuration-derived clock, action enqueue, hitIndex, and target completion order"
    );
  }
  return sortedGroups;
}

function buildExpectedTriggers(
  result: SimulationResult,
  context: RefinementCtx,
  groups: readonly ExpectedHitGroup[]
): ExpectedTrigger[] {
  const cooldownReadyFrames = new Map<string, number>();
  const probabilityRandom = new EnergyReplayRandom(`${result.resolvedRuntimeOptions.randomSeed}\u0000particle-trigger-v1`);
  let probabilityDrawCount = 0;
  const expected: ExpectedTrigger[] = [];
  const particlesByActionAndHitId = new Map<
    BoundAction,
    Map<string, NormalizedParticleBlueprint[]>
  >();
  for (const group of groups) {
    if (particlesByActionAndHitId.has(group.action)) continue;
    const byHitId = new Map<
      string,
      NormalizedParticleBlueprint[]
    >();
    for (const particle of group.action.blueprint.particles) {
      for (const hitId of particle.trigger?.hitIds ?? []) {
        const particles = byHitId.get(hitId) ?? [];
        particles.push(particle);
        byHitId.set(hitId, particles);
      }
    }
    particlesByActionAndHitId.set(group.action, byHitId);
  }

  for (const group of groups) {
    const checkedTargetIds = group.targetPlans.map(
      (plan) => plan.targetId
    );
    const confirmedTargetIds = group.targetPlans
      .filter((plan) => plan.landed && plan.hitConfirmAllowed)
      .map((plan) => plan.targetId);
    const landed = group.targetPlans.some((plan) => plan.landed);
    for (const particle of
      particlesByActionAndHitId
        .get(group.action)
        ?.get(group.hit.id) ?? []) {
      const trigger = particle.trigger;
      if (trigger === null) continue;
      const scopedKey =
        trigger.internalCooldownKey === null
          ? null
          : // Frozen 1.42 mirrors sim-core exactly, including its NUL
            // delimiter. A future wire version may replace both sides with
            // an unambiguous tuple representation.
            `${group.action.log.actorId}\u0000${trigger.internalCooldownKey}`;
      const previousReadyFrame =
        scopedKey === null
          ? null
          : (cooldownReadyFrames.get(scopedKey) ?? 0);
      const hitConfirmAllowed =
        confirmedTargetIds.length > 0;
      const blockedByInternalCooldown =
        hitConfirmAllowed &&
        previousReadyFrame !== null &&
        group.frame < previousReadyFrame;
      const internalCooldownReadyFrame =
        trigger.internalCooldownDurationFrames === null
          ? null
          : !hitConfirmAllowed
            ? previousReadyFrame !== null &&
              previousReadyFrame > group.frame
              ? previousReadyFrame
              : null
            : blockedByInternalCooldown
              ? previousReadyFrame
              : group.frame +
                trigger.internalCooldownDurationFrames;
      if (
        scopedKey !== null &&
        internalCooldownReadyFrame !== null &&
        hitConfirmAllowed &&
        !blockedByInternalCooldown
      ) {
        cooldownReadyFrames.set(
          scopedKey,
          internalCooldownReadyFrame
        );
      }
      // The configured trigger commits its ICD before its independent chance
      // check, including a failed roll; miss/blocked callbacks draw nothing.
      let roll: number | null = null;
      let drawIndex: number | null = null;
      if (trigger.probability !== undefined && hitConfirmAllowed && !blockedByInternalCooldown) {
        roll = probabilityRandom.next();
        drawIndex = probabilityDrawCount++;
      }
      const blockedReason = !landed
        ? ("TARGET_MISS" as const)
        : !hitConfirmAllowed
          ? ("TARGET_HIT_CONFIRM_BLOCKED" as const)
          : blockedByInternalCooldown
            ? ("INTERNAL_COOLDOWN" as const)
            : trigger.probability !== undefined && roll !== null && roll >= trigger.probability
              ? ("PROBABILITY_FAILED" as const)
              : null;
      const identity = particleIdentity(group.action, particle);
      expected.push({
        index: expected.length,
        action: group.action,
        particle,
        group,
        source: identity.source,
        particleId: identity.particleId,
        checkedTargetIds,
        confirmedTargetIds,
        triggered: blockedReason === null,
        blockedReason,
        internalCooldownReadyFrame,
        ...(trigger.probability === undefined ? {} : {
          probability: trigger.probability, roll, drawIndex, rngStream: "particle-trigger-v1" as const
        })
      });
    }
  }

  expectEqual(
    context,
    ["particleTriggerLog", "length"],
    result.particleTriggerLog.length,
    expected.length,
    "particle trigger log length"
  );
  expected.forEach((trigger, index) => {
    const actual = result.particleTriggerLog[index];
    if (actual === undefined) return;
    const path = ["particleTriggerLog", index] satisfies IssuePath;
    for (const [field, expectedValue] of [
      ["id", index],
      ["frame", trigger.group.frame],
      ["cycle", trigger.action.log.cycle],
      ["sourceActorId", trigger.action.log.actorId],
      ["sourceActionId", trigger.action.log.actionId],
      ["source", trigger.source],
      ["particleId", trigger.particleId],
      ["hitId", trigger.group.hit.id],
      ["hitGroupId", trigger.group.hitGroupId],
      ["triggered", trigger.triggered],
      ["blockedReason", trigger.blockedReason],
      ["probability", trigger.probability],
      ["roll", trigger.roll],
      ["drawIndex", trigger.drawIndex],
      ["rngStream", trigger.rngStream],
      [
        "internalCooldownKey",
        trigger.particle.trigger?.internalCooldownKey ?? null
      ],
      [
        "internalCooldownDurationFrames",
        trigger.particle.trigger
          ?.internalCooldownDurationFrames ?? null
      ],
      [
        "internalCooldownReadyFrame",
        trigger.internalCooldownReadyFrame
      ]
    ] as const) {
      expectEqual(
        context,
        [...path, field],
        actual[field],
        expectedValue,
        `particle trigger ${field}`
      );
    }
    expectNearlyEqual(
      context,
      [...path, "timeSeconds"],
      actual.timeSeconds,
      trigger.group.timeSeconds,
      "particle trigger timeSeconds"
    );
    expectStringArray(
      context,
      [...path, "checkedTargetIds"],
      actual.checkedTargetIds,
      trigger.checkedTargetIds,
      "particle trigger checkedTargetIds"
    );
    expectStringArray(
      context,
      [...path, "confirmedTargetIds"],
      actual.confirmedTargetIds,
      trigger.confirmedTargetIds,
      "particle trigger confirmedTargetIds"
    );
  });

  return expected;
}

function scheduledOccurrences(
  result: SimulationResult,
  actions: readonly BoundAction[]
): ExpectedParticleOccurrence[] {
  const frameNative =
    result.compatibilityMode === "legal-frame-v1";
  const occurrences: ExpectedParticleOccurrence[] = [];
  for (const action of actions) {
    for (const particle of action.blueprint.particles) {
      if (particle.spawnOffsetSeconds === null) continue;
      const rawSpawnTimeSeconds =
        action.log.time + particle.spawnOffsetSeconds;
      if (
        rawSpawnTimeSeconds >
        result.config.duration + FLOAT_TOLERANCE
      ) {
        continue;
      }
      const spawnFrame = toFrame(rawSpawnTimeSeconds);
      if (
        frameNative &&
        spawnFrame / FPS >
          result.config.duration + FLOAT_TOLERANCE
      ) {
        continue;
      }
      const identity = particleIdentity(action, particle);
      occurrences.push({
        priority: 2 + (action.blueprint.priority === 8 && spawnFrame === action.log.frame ? 10 : 0),
        action,
        particle,
        source: identity.source,
        particleId: identity.particleId,
        spawnFrame,
        spawnTimeSeconds: frameNative
          ? spawnFrame / FPS
          : rawSpawnTimeSeconds,
        cycle: action.log.cycle,
        triggerLogId: null,
        triggerHitId: null,
        enqueueKind: "scheduled",
        enqueueOrder: action.executionOrder
      });
    }
  }
  return occurrences;
}

function triggeredOccurrences(
  triggers: readonly ExpectedTrigger[]
): ExpectedParticleOccurrence[] {
  return triggers
    .filter((trigger) => trigger.triggered)
    .map((trigger) => ({
      priority: 2 + (trigger.group.priority >= 10 ? 10 : 0),
      action: trigger.action,
      particle: trigger.particle,
      source: trigger.source,
      particleId: trigger.particleId,
      spawnFrame: trigger.group.frame,
      spawnTimeSeconds: trigger.group.timeSeconds,
      cycle: trigger.action.log.cycle,
      triggerLogId: trigger.index,
      triggerHitId: trigger.group.hit.id,
      enqueueKind: "hit-confirm" as const,
      enqueueOrder: trigger.index,
      callbackResolutionIndex: trigger.group.rows.at(-1)?.index
    }));
}

function favoniusOccurrences(
  result: SimulationResult,
  context: RefinementCtx,
  actions: readonly BoundAction[]
): ExpectedParticleOccurrence[] {
  return replayFavoniusParticleSpawns(result, context).flatMap(spawn => {
    const event = spawn.producerDamageEventId === undefined ? undefined : result.damageEvents[spawn.producerDamageEventId];
    if (event === undefined) return [];
    const action = actions.find(candidate => candidate.log.actorId === spawn.actorId && candidate.log.actionId === spawn.actionId &&
      candidate.log.cycle === spawn.cycle && candidate.timelineCommandIndex === event.timelineCommandIndex && candidate.sourceAbilityId === event.sourceAbilityId);
    if (action === undefined) {
      addIssue(context, ["favoniusLog"], "Favonius particle producer must bind the independently checked action occurrence");
      return [];
    }
    return [{
      priority: spawn.priority,
      action,
      particle: { index: spawn.particle.index, id: spawn.particleId, source: spawn.source, element: spawn.particle.element,
        kind: spawn.particle.kind, count: spawn.particle.count, spawnOffsetSeconds: null, travelTimeSeconds: spawn.particle.travelTime, trigger: null },
      source: spawn.source, particleId: spawn.particleId, spawnFrame: spawn.spawnFrame, spawnTimeSeconds: spawn.spawnTimeSeconds,
      cycle: spawn.cycle, triggerLogId: null, triggerHitId: null,
      enqueueKind: "favonius" as const, enqueueOrder: event.id, callbackResolutionIndex: event.targetResolutionId
    }];
  });
}

function sortOccurrences(
  frameNative: boolean,
  occurrences: ExpectedParticleOccurrence[]
): ExpectedParticleOccurrence[] {
  return occurrences.sort((left, right) => {
    const timeOrder = frameNative
      ? left.spawnFrame - right.spawnFrame
      : left.spawnTimeSeconds - right.spawnTimeSeconds;
    if (timeOrder !== 0) return timeOrder;
    if (left.priority !== right.priority) return left.priority - right.priority;
    if ((left.enqueueKind === "scheduled") !== (right.enqueueKind === "scheduled")) {
      // Within either event phase, scheduled particles run before the
      // hit callbacks which enqueue same-frame triggered particles.
      return left.enqueueKind === "scheduled" ? -1 : 1;
    }
    if (
      left.enqueueKind === "scheduled" &&
      right.enqueueKind === "scheduled"
    ) {
      const actionClockOrder = frameNative
        ? left.action.log.frame - right.action.log.frame
        : left.action.log.time - right.action.log.time;
      return (
        actionClockOrder ||
        left.action.blueprint.priority - right.action.blueprint.priority ||
        left.action.executionOrder -
          right.action.executionOrder ||
        left.particle.index - right.particle.index
      );
    }
    if (left.callbackResolutionIndex !== undefined && right.callbackResolutionIndex !== undefined) {
      const callbackOrder = left.callbackResolutionIndex - right.callbackResolutionIndex;
      if (callbackOrder !== 0) return callbackOrder;
      // The direct OnEnemyDamage callback enqueues Favonius before the final
      // target completes its hit group's configured hit-confirm callbacks.
      if (left.enqueueKind !== right.enqueueKind) return left.enqueueKind === "favonius" ? -1 : 1;
    }
    return (
      left.enqueueOrder - right.enqueueOrder ||
      left.particle.index - right.particle.index
    );
  });
}

function validateParticleEvents(
  result: SimulationResult,
  context: RefinementCtx,
  occurrences: readonly ExpectedParticleOccurrence[]
): void {
  const frameNative =
    result.compatibilityMode === "legal-frame-v1";
  const characterParticles = result.particleEvents.map((event, index) => ({ event, index })).filter(({ event }) => event.origin === undefined);
  expectEqual(
    context,
    ["particleEvents", "length"],
    characterParticles.length,
    occurrences.length,
    "particle event length"
  );
  const random = new ParticleReplayRandom(result.randomSeed);
  occurrences.forEach((occurrence, index) => {
    const particleCount = resolveParticleCount(
      occurrence.particle.count,
      random
    );
    const rawReceiveTimeSeconds =
      occurrence.spawnTimeSeconds +
      Math.max(0, occurrence.particle.travelTimeSeconds);
    const receiveFrame = toFrame(rawReceiveTimeSeconds);
    const receiveTimeSeconds = frameNative
      ? receiveFrame / FPS
      : rawReceiveTimeSeconds;
    const receivedWithinSimulation =
      rawReceiveTimeSeconds <=
      result.config.duration + FLOAT_TOLERANCE;
    const indexed = characterParticles[index];
    if (indexed === undefined) return;
    const actual = indexed.event;
    const path = ["particleEvents", indexed.index] satisfies IssuePath;
    for (const [field, expectedValue] of [
      ["id", indexed.index],
      ["sourceActorId", occurrence.action.log.actorId],
      ["sourceActionId", occurrence.action.log.actionId],
      ["source", occurrence.source],
      ["particleId", occurrence.particleId],
      ["spawnFrame", occurrence.spawnFrame],
      ["receiveFrame", receiveFrame],
      ["particleElement", occurrence.particle.element],
      ["particleKind", occurrence.particle.kind],
      ["receivedWithinSimulation", receivedWithinSimulation],
      ["cycle", occurrence.cycle],
      ["triggerLogId", occurrence.triggerLogId],
      ["triggerHitId", occurrence.triggerHitId]
    ] as const) {
      expectEqual(
        context,
        [...path, field],
        actual[field],
        expectedValue,
        `particle event ${field}`
      );
    }
    expectNearlyEqual(
      context,
      [...path, "spawnTimeSeconds"],
      actual.spawnTimeSeconds,
      occurrence.spawnTimeSeconds,
      "particle event spawnTimeSeconds"
    );
    expectNearlyEqual(
      context,
      [...path, "receiveTimeSeconds"],
      actual.receiveTimeSeconds,
      receiveTimeSeconds,
      "particle event receiveTimeSeconds"
    );
    expectNearlyEqual(
      context,
      [...path, "particleCount"],
      actual.particleCount,
      particleCount,
      "frozen 1.42 particle count replay"
    );
  });
}

/**
 * Replays the complete configured particle provenance chain without importing
 * sim-core or trusting the particle output itself:
 *
 * configured action/ability -> executed action -> direct hit group ->
 * hit-confirm attempt + actor-scoped ICD -> particle spawn + seeded count.
 *
 * This function is intended to be called from the SimulationResult
 * `superRefine` boundary after the structural 1.42 Schema has succeeded.
 */
export function validateParticleProvenanceIntegrity(
  result: SimulationResult,
  context: RefinementCtx,
  resolveConfiguredHitElement?: ConfiguredHitElementResolver
): void {
  const actions = [...bindActions(result, context), ...bindWeaponProcActions(result)];
  const groups = buildExpectedHitGroups(
    result,
    context,
    actions,
    resolveConfiguredHitElement
  );
  const triggers = buildExpectedTriggers(
    result,
    context,
    groups
  );
  const occurrences = sortOccurrences(
    result.compatibilityMode === "legal-frame-v1",
    [
      ...scheduledOccurrences(result, actions),
      ...triggeredOccurrences(triggers),
      ...favoniusOccurrences(result, context, actions)
    ]
  );
  validateParticleEvents(result, context, occurrences);
}
