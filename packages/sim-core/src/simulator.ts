import {
  CURRENT_SCHEMA_VERSION,
  migrateConfig,
  type ActionDefinition,
  type ActiveStatusSnapshot,
  type BuffDefinition,
  type BuffStat,
  type CharacterStats,
  type DamageEvent,
  type DebuffDefinition,
  type Element,
  type EnergySummary,
  type HitGeometry,
  type HitDefinition,
  type HitTargeting,
  type ParticleDefinition,
  type ReactionAudit,
  type ShatterReactionAudit,
  type ReactionStatusEffectDefinition,
  type TransformativeReactionFactors,
  type TransformativeReaction,
  type SimConfig,
  type SimulationEvent,
  type SimulationOptions,
  type SimulationResult,
  type TimelineExecution
} from "@genshin-dps-lab/schemas";
import {
  AURA_ENGINE_CONSTANTS,
  AuraEngine,
  type ShatterStateResult
} from "./aura";
import {
  calculateParticleEnergy,
  resolveParticleCount,
  SeededRandom
} from "./energy";
import {
  calcDamage,
  calcTransformativeReactionDamage,
  calcTotalStat,
  clamp,
  type DamageCalculationInput
} from "./formulas";
import { MinHeap } from "./min-heap";
import type { DamageModifierPlugin } from "./plugins";
import {
  compileLegalTimeline,
  type RuntimeEnergyFailure
} from "./legal-timeline";

export const EVENT_PRIORITY = {
  action: 0,
  buff: 1,
  debuff: 1,
  energy: 2,
  particleSpawn: 2,
  particleReceive: 2,
  hit: 3,
  periodicReactionExpiry: 2,
  frozenExpiry: 2,
  periodicReactionTick: 4,
  reactionDamage: 5,
  periodicReactionWane: 6
} as const;

export interface SimulationRuntimeOptions extends SimulationOptions {
  plugins?: readonly DamageModifierPlugin[];
}

const GEOMETRY_EPSILON = 1e-9;

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
): HitGeometry {
  if ((geometry.coordinateSpace ?? "world") === "world") {
    return geometry;
  }
  if (actorPose === undefined) {
    throw new Error(
      "Actor-local geometry passed schema validation without an actor pose."
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
  geometry: NonNullable<HitDefinition["geometry"]>,
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
      const radialDistances = boundaryAngles.map((angleDegrees) => {
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
      });
      distance = Math.min(...radialDistances);
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

interface ActionEventPayload {
  action: ActionDefinition;
  cycle: number;
}

interface BuffEventPayload {
  actorId: string;
  buff: BuffDefinition;
}

interface DebuffEventPayload {
  actorId: string;
  debuff: DebuffDefinition;
}

interface EnergyEventPayload {
  actorId: string;
  actionId: string;
  gain: NonNullable<ActionDefinition["energyGains"]>[number];
  cycle: number;
}

interface ParticleSpawnEventPayload {
  actorId: string;
  actionId: string;
  actionName: string;
  particle: ParticleDefinition;
  particleIndex: number;
  cycle: number;
  triggerLogId?: number;
  triggerHitId?: string;
}

interface ParticleReceiveEventPayload {
  particleEventId: number;
}

interface HitEventPayload {
  actorId: string;
  action: ActionDefinition;
  hit: HitDefinition;
  hitIndex: number;
  targeting?: HitTargeting;
  targetingSource: "default" | "scripted" | "geometry";
  targetPosition: { x: number; y: number } | null;
  sourceActorPosition: { x: number; y: number } | null;
  sourceActorFacingDegrees: number | null;
  geometryKind:
    | "circle"
    | "rectangle"
    | "capsule"
    | "sector"
    | null;
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
  targetIndex: number;
  targetCount: number;
  hitGroupId: string;
  snapshots: Record<string, CharacterStats | undefined>;
  cycle: number;
}

interface ReactionDamageEventPayload {
  reaction: TransformativeReaction;
  damageElement: Element;
  strikeType: "default" | "blunt";
  poiseDamage: number;
  statusEffect: ReactionStatusEffectDefinition | null;
  actorId: string;
  action: ActionDefinition;
  triggerHitId: string;
  triggerHitGroupId: string;
  triggerDamageEventId: number;
  sourceTargetId: string;
  targetingMode: "radius" | "single-target";
  centerPosition: { x: number; y: number } | null;
  radius: number;
  baseMultiplier: number;
  stats: CharacterStats;
  elementalMastery: number;
  reactionBonus: number;
  sourceBuffStatuses: ActiveStatusSnapshot[];
  snapshot: DamageEvent["snapshot"];
  cycle: number;
  reactionDamageLogId: number;
  periodicContext?: {
    generation: number;
    tickIndex: number;
    periodicReactionLogId: number;
    waneEligible: boolean;
  };
}

interface PeriodicReactionSourceSnapshot {
  generation: number;
  actorId: string;
  action: ActionDefinition;
  triggerHitId: string;
  triggerHitGroupId: string;
  triggerDamageEventId: number;
  triggerFrame: number;
  stats: CharacterStats;
  elementalMastery: number;
  reactionBonus: number;
  sourceBuffStatuses: ActiveStatusSnapshot[];
  snapshot: DamageEvent["snapshot"];
  cycle: number;
}

interface FrozenStateSource {
  generation: number;
  actorId: string;
  triggerDamageEventId: number;
}

interface PeriodicReactionTickEventPayload {
  targetId: string;
  generation: number;
  tickIndex: number;
  firstTick: boolean;
  pinnedSource?: PeriodicReactionSourceSnapshot;
}

interface PeriodicReactionWaneEventPayload {
  targetId: string;
  sourceActorId: string;
  triggerDamageEventId: number;
  damageEventId: number;
  tickIndex: number;
  damageApplied: boolean;
}

interface PeriodicReactionExpiryEventPayload {
  targetId: string;
  generation: number;
  expectedExpiryFrame: number;
}

interface FrozenExpiryEventPayload {
  targetId: string;
  generation: number;
  expectedExpiryFrame: number;
}

type InternalEvent =
  | SimulationEvent<ActionEventPayload>
  | SimulationEvent<BuffEventPayload>
  | SimulationEvent<DebuffEventPayload>
  | SimulationEvent<EnergyEventPayload>
  | SimulationEvent<ParticleSpawnEventPayload>
  | SimulationEvent<ParticleReceiveEventPayload>
  | SimulationEvent<HitEventPayload>
  | SimulationEvent<ReactionDamageEventPayload>
  | SimulationEvent<PeriodicReactionTickEventPayload>
  | SimulationEvent<PeriodicReactionWaneEventPayload>
  | SimulationEvent<PeriodicReactionExpiryEventPayload>
  | SimulationEvent<FrozenExpiryEventPayload>;

interface ActiveBuff {
  key: string;
  actorId: string;
  targetId: string;
  stat: BuffStat;
  value: number;
  start: number;
  end: number;
  label: string;
}

interface ActiveDebuff {
  key: string;
  actorId: string;
  element: Element | "all";
  resShred: number;
  defReduction: number;
  start: number;
  end: number;
  label: string;
}

interface ActiveTargetDebuff extends ActiveDebuff {
  targetId: string;
  startFrame: number;
  endFrame: number;
  reaction: TransformativeReaction;
  reactionDamageEventId: number;
  reactionStatusLogId: number;
}

const TRANSFORMATIVE_REACTION_LABELS: Record<
  TransformativeReaction,
  string
> = {
  overload: "超载",
  superconduct: "超导",
  electroCharged: "感电",
  shatter: "碎冰"
};

const BUFF_STATS = new Set<BuffStat>([
  "atkFlat",
  "atkPct",
  "hpFlat",
  "hpPct",
  "defFlat",
  "defPct",
  "dmgBonus",
  "critRate",
  "critDmg",
  "em",
  "defIgnore",
  "reactionBonus",
  "energyRecharge"
]);

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function toFrame(timeSeconds: number): number {
  return Math.round(timeSeconds * 60);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeReproducibilityKey(
  config: SimConfig,
  options: Required<
    Pick<
      SimulationRuntimeOptions,
      "energyMode" | "critMode" | "compatibilityMode" | "randomSeed"
    >
  >,
  plugins: readonly DamageModifierPlugin[]
): string {
  return `gdl-${fnv1a(
    stableStringify({
      config,
      options,
      plugins: plugins.map((plugin) => plugin.id)
    })
  )}`;
}

function applyPluginChanges(
  input: DamageCalculationInput,
  changes: Partial<DamageCalculationInput> | void
): DamageCalculationInput {
  if (!changes) return input;
  return { ...input, ...changes };
}

function simulateConfig(
  config: SimConfig,
  runtimeOptions: SimulationRuntimeOptions = {},
  resultConfig: SimConfig = config,
  timelineExecution?: TimelineExecution
): SimulationResult {
  const options = {
    energyMode: runtimeOptions.energyMode ?? "configured",
    critMode: runtimeOptions.critMode ?? "average",
    compatibilityMode:
      runtimeOptions.compatibilityMode ??
      (timelineExecution ? "legal-frame-v1" : "legacy-v0.1"),
    randomSeed: runtimeOptions.randomSeed ?? config.randomSeed
  } as const;
  const plugins = runtimeOptions.plugins ?? [];
  const random = new SeededRandom(options.randomSeed);
  const actorPoses = deepClone(config.actorPoses ?? []);
  const actorPoseById = new Map(
    actorPoses.map((pose) => [pose.actorId, pose])
  );
  const enemyTargets: SimulationResult["enemyTargets"] = (
    config.enemy.targets ?? [
      {
        id: "enemy-0",
        name: "敌人 0"
      }
    ]
  ).map((target) => ({
    id: target.id,
    name: target.name,
    level: target.level ?? config.enemy.level,
    resistance: target.resistance ?? config.enemy.resistance,
    defReduction: target.defReduction ?? config.enemy.defReduction,
    freezeResistance:
      target.freezeResistance ??
      config.enemy.freezeResistance ??
      0,
    initialAura: deepClone(
      target.initialAura ?? config.reactionEngine?.initialAura ?? []
    ),
    position: target.position === undefined ? null : deepClone(target.position),
    hitboxRadius: target.hitboxRadius ?? 0
  }));
  const enemyTargetById = new Map(
    enemyTargets.map((target) => [target.id, target])
  );
  const lastMotionPositionByTarget = new Map(
    enemyTargets.map((target) => [
      target.id,
      target.position === null ? null : deepClone(target.position)
    ])
  );
  const targetMotionTimeline: SimulationResult["targetMotionTimeline"] = (
    config.enemy.targetMotions ?? []
  ).map((motion) => {
    const startPosition = lastMotionPositionByTarget.get(motion.targetId);
    if (startPosition === null || startPosition === undefined) {
      throw new Error(
        `Target motion "${motion.id}" passed schema validation without an initial position.`
      );
    }
    const resolved = {
      ...motion,
      startPosition: deepClone(startPosition),
      endPosition: deepClone(motion.endPosition),
      startTimeSeconds: motion.startFrame / 60,
      endTimeSeconds: motion.endFrame / 60
    };
    lastMotionPositionByTarget.set(
      motion.targetId,
      deepClone(motion.endPosition)
    );
    return resolved;
  });
  const targetMotionsByTarget = new Map<
    string,
    SimulationResult["targetMotionTimeline"]
  >();
  for (const motion of targetMotionTimeline) {
    const motions = targetMotionsByTarget.get(motion.targetId) ?? [];
    motions.push(motion);
    targetMotionsByTarget.set(motion.targetId, motions);
  }
  const resolveTargetPosition = (
    targetId: string,
    frame: number
  ): { x: number; y: number } | null => {
    const initialPosition = enemyTargetById.get(targetId)?.position ?? null;
    if (initialPosition === null) return null;
    let position = initialPosition;
    for (const motion of targetMotionsByTarget.get(targetId) ?? []) {
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
          (motion.endPosition.x - motion.startPosition.x) * progress,
        y:
          motion.startPosition.y +
          (motion.endPosition.y - motion.startPosition.y) * progress
      };
    }
    return deepClone(position);
  };
  const auraEngines =
    config.reactionEngine?.mode === "aura-v1" ||
    config.reactionEngine?.mode === "aura-v2"
      ? new Map(
          enemyTargets.map((target) => [
            target.id,
            new AuraEngine({
              ...config.reactionEngine!,
              initialAura: deepClone(target.initialAura),
              freezeResistance: target.freezeResistance
            })
          ])
        )
      : null;
  const characters = new Map(
    config.characters.map((character) => [character.id, character])
  );
  const energies = new Map<string, number>();
  const energyStats = new Map<string, EnergySummary>();
  const fixedEnergyCooldownReadyFrames = new Map<string, number>();
  const particleCooldownReadyFrames = new Map<string, number>();
  const hitCallbackAggregates = new Map<
    string,
    {
      checkedTargetIds: string[];
      confirmedTargetIds: string[];
      landed: boolean;
    }
  >();

  for (const character of config.characters) {
    const initial =
      options.energyMode === "zero"
        ? 0
        : options.energyMode === "full"
          ? character.energyMax
          : character.initialEnergy;
    energies.set(character.id, initial);
    energyStats.set(character.id, {
      initial,
      gained: 0,
      fixedGained: 0,
      particleGained: 0,
      wasted: 0,
      spent: 0,
      skipped: 0,
      final: initial
    });
  }

  const frameNative = options.compatibilityMode === "legal-frame-v1";
  const queue = new MinHeap<InternalEvent>((left, right) => {
    const timeOrder = frameNative
      ? left.frame - right.frame
      : left.timeSeconds - right.timeSeconds;
    return (
      timeOrder ||
      left.priority - right.priority ||
      left.sequence - right.sequence
    );
  });
  let sequence = 0;
  const push = <TPayload>(
    timeSeconds: number,
    type: InternalEvent["type"],
    payload: TPayload
  ): void => {
    if (timeSeconds <= config.duration + 1e-9) {
      const frame = toFrame(timeSeconds);
      queue.push({
        timeSeconds: frameNative ? frame / 60 : timeSeconds,
        frame,
        priority: EVENT_PRIORITY[type],
        type,
        payload,
        sequence: sequence++
      } as InternalEvent);
    }
  };

  const cycleCount = Math.ceil(config.duration / config.cycleLength);
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const cycleStart = cycle * config.cycleLength;
    for (const action of config.rotation) {
      if (action.once && cycle > 0) continue;
      if (action.cycles?.includes(cycle) === false) continue;
      if (
        action.everyNCycles !== undefined &&
        cycle % action.everyNCycles !== (action.cycleRemainder ?? 0)
      ) {
        continue;
      }
      const timeSeconds = cycleStart + action.at;
      if (timeSeconds <= config.duration) {
        push(timeSeconds, "action", { action, cycle });
      }
    }
  }

  const activeBuffs: ActiveBuff[] = [];
  const activeDebuffs: ActiveDebuff[] = [];
  const activeTargetDebuffs: ActiveTargetDebuff[] = [];
  const damageEvents: DamageEvent[] = [];
  const hitResolutionLog: SimulationResult["hitResolutionLog"] = [];
  const reactionDamageLog: SimulationResult["reactionDamageLog"] = [];
  const reactionStatusLog: SimulationResult["reactionStatusLog"] = [];
  const periodicReactionLog: SimulationResult["periodicReactionLog"] =
    [];
  const frozenStateLog: SimulationResult["frozenStateLog"] = [];
  const activePeriodicReactionSources = new Map<
    string,
    PeriodicReactionSourceSnapshot
  >();
  const periodicReactionExpiryScheduleKeys = new Set<string>();
  const activeFrozenStateSources = new Map<
    string,
    FrozenStateSource
  >();
  const frozenExpiryScheduleKeys = new Set<string>();
  const skippedActions: SimulationResult["skippedActions"] = [];
  const actionLog: SimulationResult["actionLog"] = [];
  const energyLog: SimulationResult["energyLog"] = [];
  const particleEvents: SimulationResult["particleEvents"] = [];
  const particleTriggerLog: SimulationResult["particleTriggerLog"] = [];
  const energyCurve: SimulationResult["energyCurve"] = [];
  const targetPhaseTimeline: SimulationResult["targetPhaseTimeline"] = (
    config.enemy.targetPhases ?? []
  ).map((phase) => ({
    ...phase,
    startTimeSeconds: phase.startFrame / 60,
    endTimeSeconds: phase.endFrame / 60
  }));
  let activeCharacterId =
    resultConfig.timeline?.initialActiveCharacterId ??
    config.characters[0]?.id ??
    null;
  const recordEnergyCurve = (
    frame: number,
    timeSeconds: number,
    kind: SimulationResult["energyCurve"][number]["kind"],
    receiverId: string | null,
    source: string
  ): void => {
    energyCurve.push({
      id: energyCurve.length,
      frame,
      timeSeconds,
      kind,
      receiverId,
      source,
      energyByCharacter: Object.fromEntries(energies)
    });
  };
  recordEnergyCurve(0, 0, "initial", null, "initial-energy");

  const schedulePeriodicReactionExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const scheduleKey = `${targetId}\u0000${generation}\u0000${expiryFrame}`;
    if (periodicReactionExpiryScheduleKeys.has(scheduleKey)) return;
    periodicReactionExpiryScheduleKeys.add(scheduleKey);
    push(expiryFrame / 60, "periodicReactionExpiry", {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies PeriodicReactionExpiryEventPayload);
  };

  const scheduleFrozenExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const scheduleKey = `${targetId}\u0000${generation}\u0000${expiryFrame}`;
    if (frozenExpiryScheduleKeys.has(scheduleKey)) return;
    frozenExpiryScheduleKeys.add(scheduleKey);
    push(expiryFrame / 60, "frozenExpiry", {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies FrozenExpiryEventPayload);
  };

  const scheduleElectroChargedDamage = ({
    frame,
    targetId,
    generation,
    tickIndex,
    source,
    periodicReactionLogId,
    nextTickFrame,
    waneEligible
  }: {
    frame: number;
    targetId: string;
    generation: number;
    tickIndex: number;
    source: PeriodicReactionSourceSnapshot;
    periodicReactionLogId: number;
    nextTickFrame: number | null;
    waneEligible: boolean;
  }): void => {
    const reactionDamageLogId = reactionDamageLog.length;
    const withinSimulation =
      frame <= Math.round(config.duration * 60);
    reactionDamageLog.push({
      id: reactionDamageLogId,
      reaction: "electroCharged",
      triggerDamageEventId: source.triggerDamageEventId,
      sourceActorId: source.actorId,
      sourceTargetId: targetId,
      triggerFrame: source.triggerFrame,
      damageFrame: frame,
      scheduled: true,
      withinSimulation,
      blockedReason: null,
      nextAvailableFrame: nextTickFrame,
      scheduleKind: "periodic-tick",
      targetingMode: "single-target",
      centerPosition: null,
      radius: 0,
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageEventIds: [],
      reactionStatusLogIds: []
    });
    const periodicLog = periodicReactionLog[periodicReactionLogId];
    if (periodicLog !== undefined) {
      periodicLog.reactionDamageLogId = reactionDamageLogId;
    }
    if (!withinSimulation) return;
    push(frame / 60, "reactionDamage", {
      reaction: "electroCharged",
      damageElement: "electro",
      strikeType: "default",
      poiseDamage: 0,
      statusEffect: null,
      actorId: source.actorId,
      action: source.action,
      triggerHitId: source.triggerHitId,
      triggerHitGroupId: source.triggerHitGroupId,
      triggerDamageEventId: source.triggerDamageEventId,
      sourceTargetId: targetId,
      targetingMode: "single-target",
      centerPosition: null,
      radius: 0,
      baseMultiplier:
        AURA_ENGINE_CONSTANTS.electroChargedBaseMultiplier,
      stats: deepClone(source.stats),
      elementalMastery: source.elementalMastery,
      reactionBonus: source.reactionBonus,
      sourceBuffStatuses: deepClone(source.sourceBuffStatuses),
      snapshot: source.snapshot,
      cycle: source.cycle,
      reactionDamageLogId,
      periodicContext: {
        generation,
        tickIndex,
        periodicReactionLogId,
        waneEligible
      }
    } satisfies ReactionDamageEventPayload);
  };

  const cleanup = (timeSeconds: number): void => {
    for (let index = activeBuffs.length - 1; index >= 0; index -= 1) {
      const buff = activeBuffs[index];
      if (buff !== undefined && buff.end <= timeSeconds + 1e-9) {
        activeBuffs.splice(index, 1);
      }
    }
    for (let index = activeDebuffs.length - 1; index >= 0; index -= 1) {
      const debuff = activeDebuffs[index];
      if (debuff !== undefined && debuff.end <= timeSeconds + 1e-9) {
        activeDebuffs.splice(index, 1);
      }
    }
    for (
      let index = activeTargetDebuffs.length - 1;
      index >= 0;
      index -= 1
    ) {
      const debuff = activeTargetDebuffs[index];
      if (
        debuff !== undefined &&
        debuff.end <= timeSeconds + 1e-9
      ) {
        activeTargetDebuffs.splice(index, 1);
      }
    }
  };

  const computeStats = (
    characterId: string,
    timeSeconds: number
  ): CharacterStats | undefined => {
    cleanup(timeSeconds);
    const character = characters.get(characterId);
    if (!character) return undefined;
    const stats = deepClone(character.stats);
    for (const buff of activeBuffs) {
      if (buff.targetId !== characterId || !BUFF_STATS.has(buff.stat)) continue;
      const compatibilityStats = stats as CharacterStats &
        Partial<Record<BuffStat, number>>;
      compatibilityStats[buff.stat] =
        safeNumber(compatibilityStats[buff.stat]) + buff.value;
    }
    stats.critRate = clamp(stats.critRate, 0, 1);
    stats.defIgnore = clamp(stats.defIgnore, 0, 1);
    return stats;
  };

  const recordShatterFrozenState = ({
    result,
    targetId,
    targetName,
    sourceActorId,
    triggerDamageEventId,
    frame,
    timeSeconds,
    freezeResistance
  }: {
    result: ShatterStateResult;
    targetId: string;
    targetName: string;
    sourceActorId: string;
    triggerDamageEventId: number;
    frame: number;
    timeSeconds: number;
    freezeResistance: number;
  }): void => {
    for (const mutation of result.mutations) {
      frozenStateLog.push({
        id: frozenStateLog.length,
        reaction: "shatter",
        generation: result.audit.generation,
        operation: mutation.operation,
        frame,
        timeSeconds,
        targetId,
        targetName,
        sourceActorId,
        triggerDamageEventId,
        freezeResistance,
        generatedGaugeUnits: 0,
        consumedGaugeUnits: mutation.consumedGaugeUnits,
        auraBefore: deepClone(mutation.auraBefore),
        auraAfter: deepClone(mutation.auraAfter),
        expiresAtFrame: result.audit.expiresAtFrame,
        reason: mutation.reason
      });
    }
    if (result.mutations.length === 0) return;
    const existingSource = activeFrozenStateSources.get(targetId);
    if (result.audit.frozenGaugeAfter > 0) {
      activeFrozenStateSources.set(targetId, {
        generation: result.audit.generation,
        actorId: existingSource?.actorId ?? sourceActorId,
        triggerDamageEventId:
          existingSource?.triggerDamageEventId ??
          triggerDamageEventId
      });
      scheduleFrozenExpiry(
        targetId,
        result.audit.generation,
        result.audit.expiresAtFrame
      );
    } else {
      activeFrozenStateSources.delete(targetId);
    }
  };

  const scheduleShatterDamage = ({
    audit,
    actorId,
    action,
    triggerHitId,
    triggerHitGroupId,
    triggerDamageEventId,
    sourceTargetId,
    stats,
    reactionBonus,
    sourceBuffStatuses,
    snapshot,
    cycle,
    triggerFrame
  }: {
    audit: ShatterReactionAudit;
    actorId: string;
    action: ActionDefinition;
    triggerHitId: string;
    triggerHitGroupId: string;
    triggerDamageEventId: number;
    sourceTargetId: string;
    stats: CharacterStats;
    reactionBonus: number;
    sourceBuffStatuses: ActiveStatusSnapshot[];
    snapshot: DamageEvent["snapshot"];
    cycle: number;
    triggerFrame: number;
  }): void => {
    if (!audit.triggered) return;
    const reactionDamageLogId = reactionDamageLog.length;
    const withinSimulation =
      audit.scheduled &&
      audit.damageFrame <= Math.round(config.duration * 60);
    reactionDamageLog.push({
      id: reactionDamageLogId,
      reaction: "shatter",
      triggerDamageEventId,
      sourceActorId: actorId,
      sourceTargetId,
      triggerFrame,
      damageFrame: audit.damageFrame,
      scheduled: audit.scheduled,
      withinSimulation,
      blockedReason: audit.scheduled
        ? null
        : "REACTION_DAMAGE_GCD",
      nextAvailableFrame: audit.nextAvailableFrame,
      scheduleKind: "one-shot",
      targetingMode: "single-target",
      centerPosition: null,
      radius: 0,
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageEventIds: [],
      reactionStatusLogIds: []
    });
    if (!withinSimulation) return;
    push(audit.damageFrame / 60, "reactionDamage", {
      reaction: "shatter",
      damageElement: "physical",
      strikeType: "default",
      poiseDamage: 0,
      statusEffect: null,
      actorId,
      action,
      triggerHitId,
      triggerHitGroupId,
      triggerDamageEventId,
      sourceTargetId,
      targetingMode: "single-target",
      centerPosition: null,
      radius: 0,
      baseMultiplier: audit.baseMultiplier,
      stats: deepClone(stats),
      elementalMastery: stats.em,
      reactionBonus,
      sourceBuffStatuses: deepClone(sourceBuffStatuses),
      snapshot,
      cycle,
      reactionDamageLogId
    } satisfies ReactionDamageEventPayload);
  };

  const addBuff = (
    timeSeconds: number,
    actorId: string,
    buff: BuffDefinition
  ): void => {
    const targets =
      buff.target === "team"
        ? config.characters.map((character) => character.id)
        : buff.target === "self"
          ? [actorId]
          : Array.isArray(buff.target)
            ? buff.target
            : [buff.target ?? actorId];
    for (const targetId of targets) {
      const key = `${buff.key ?? buff.stat ?? "buff"}:${targetId}`;
      for (let index = activeBuffs.length - 1; index >= 0; index -= 1) {
        if (activeBuffs[index]?.key === key) activeBuffs.splice(index, 1);
      }
      activeBuffs.push({
        key,
        actorId,
        targetId,
        stat: buff.stat,
        value: buff.value,
        start: timeSeconds,
        end: timeSeconds + buff.duration,
        label: buff.label ?? buff.key ?? buff.stat
      });
    }
  };

  const addDebuff = (
    timeSeconds: number,
    actorId: string,
    debuff: DebuffDefinition
  ): void => {
    const key = debuff.key ?? `${debuff.element ?? "all"}-debuff`;
    for (let index = activeDebuffs.length - 1; index >= 0; index -= 1) {
      if (activeDebuffs[index]?.key === key) activeDebuffs.splice(index, 1);
    }
    activeDebuffs.push({
      key,
      actorId,
      element: debuff.element ?? "all",
      resShred: safeNumber(debuff.resShred),
      defReduction: safeNumber(debuff.defReduction),
      start: timeSeconds,
      end: timeSeconds + debuff.duration,
      label: debuff.label ?? key
    });
  };

  const getDebuffState = (
    timeSeconds: number,
    element: Element,
    baseDefenseReduction: number,
    targetId: string
  ): {
    resShred: number;
    defReduction: number;
    relevantDebuffs: Array<ActiveDebuff | ActiveTargetDebuff>;
  } => {
    cleanup(timeSeconds);
    let resShred = 0;
    let defReduction = baseDefenseReduction;
    const relevantDebuffs: ActiveDebuff[] = [];
    for (const debuff of activeDebuffs) {
      const affectsResistance =
        debuff.element === "all" || debuff.element === element;
      if (affectsResistance) resShred += debuff.resShred;
      defReduction += debuff.defReduction;
      if (affectsResistance || debuff.defReduction !== 0) {
        relevantDebuffs.push(debuff);
      }
    }
    for (const debuff of activeTargetDebuffs) {
      if (debuff.targetId !== targetId) continue;
      const affectsResistance =
        debuff.element === "all" || debuff.element === element;
      if (affectsResistance) resShred += debuff.resShred;
      defReduction += debuff.defReduction;
      if (affectsResistance || debuff.defReduction !== 0) {
        relevantDebuffs.push(debuff);
      }
    }
    return {
      resShred,
      defReduction: clamp(defReduction, -1, 0.9),
      relevantDebuffs
    };
  };

  const processHitConfirmedParticles = ({
    actorId,
    action,
    hitId,
    hitGroupId,
    checkedTargetIds,
    confirmedTargetIds,
    cycle,
    frame,
    timeSeconds,
    landed,
    hitConfirmAllowed
  }: {
    actorId: string;
    action: ActionDefinition;
    hitId: string;
    hitGroupId: string;
    checkedTargetIds: string[];
    confirmedTargetIds: string[];
    cycle: number;
    frame: number;
    timeSeconds: number;
    landed: boolean;
    hitConfirmAllowed: boolean;
  }): void => {
    (action.particles ?? []).forEach((particle, particleIndex) => {
      const trigger = particle.trigger;
      if (
        trigger === undefined ||
        !trigger.hitIds.includes(hitId)
      ) {
        return;
      }
      const internalCooldown = trigger.internalCooldown;
      const internalCooldownDurationFrames =
        internalCooldown === undefined
          ? null
          : Math.max(1, toFrame(internalCooldown.duration));
      const scopedInternalCooldownKey =
        internalCooldown === undefined
          ? null
          : `${actorId}\u0000${internalCooldown.key}`;
      const previousReadyFrame =
        scopedInternalCooldownKey === null
          ? null
          : (particleCooldownReadyFrames.get(
              scopedInternalCooldownKey
            ) ?? 0);
      const blockedByInternalCooldown =
        hitConfirmAllowed &&
        previousReadyFrame !== null &&
        frame < previousReadyFrame;
      const internalCooldownReadyFrame =
        internalCooldownDurationFrames === null
          ? null
          : !hitConfirmAllowed
            ? previousReadyFrame !== null && previousReadyFrame > frame
              ? previousReadyFrame
              : null
            : blockedByInternalCooldown
              ? previousReadyFrame
              : frame + internalCooldownDurationFrames;
      if (
        hitConfirmAllowed &&
        scopedInternalCooldownKey !== null &&
        internalCooldownReadyFrame !== null &&
        !blockedByInternalCooldown
      ) {
        particleCooldownReadyFrames.set(
          scopedInternalCooldownKey,
          internalCooldownReadyFrame
        );
      }
      const particleId =
        particle.id ?? `${action.id}:particle-${particleIndex}`;
      const source = particle.source ?? `${action.name}:${particleId}`;
      const triggerLogId = particleTriggerLog.length;
      const blockedReason = !landed
        ? ("TARGET_MISS" as const)
        : !hitConfirmAllowed
          ? ("TARGET_HIT_CONFIRM_BLOCKED" as const)
        : blockedByInternalCooldown
          ? ("INTERNAL_COOLDOWN" as const)
          : null;
      particleTriggerLog.push({
        id: triggerLogId,
        frame,
        timeSeconds,
        cycle,
        sourceActorId: actorId,
        sourceActionId: action.id,
        source,
        particleId,
        hitId,
        hitGroupId,
        checkedTargetIds: [...checkedTargetIds],
        confirmedTargetIds: [...confirmedTargetIds],
        triggered: blockedReason === null,
        blockedReason,
        internalCooldownKey: internalCooldown?.key ?? null,
        internalCooldownDurationFrames,
        internalCooldownReadyFrame
      });
      if (blockedReason === null) {
        push(timeSeconds, "particleSpawn", {
          actorId,
          actionId: action.id,
          actionName: action.name,
          particle,
          particleIndex,
          cycle,
          triggerLogId,
          triggerHitId: hitId
        });
      }
    });
  };

  const completeHitTarget = ({
    actorId,
    action,
    hitId,
    hitGroupId,
    cycle,
    frame,
    timeSeconds,
    targetId,
    targetIndex,
    targetCount,
    landed,
    hitConfirmAllowed
  }: {
    actorId: string;
    action: ActionDefinition;
    hitId: string;
    hitGroupId: string;
    cycle: number;
    frame: number;
    timeSeconds: number;
    targetId: string;
    targetIndex: number;
    targetCount: number;
    landed: boolean;
    hitConfirmAllowed: boolean;
  }): void => {
    const aggregate = hitCallbackAggregates.get(hitGroupId) ?? {
      checkedTargetIds: [],
      confirmedTargetIds: [],
      landed: false
    };
    aggregate.checkedTargetIds.push(targetId);
    if (landed) aggregate.landed = true;
    if (landed && hitConfirmAllowed) {
      aggregate.confirmedTargetIds.push(targetId);
    }
    hitCallbackAggregates.set(hitGroupId, aggregate);
    if (targetIndex !== targetCount - 1) return;
    processHitConfirmedParticles({
      actorId,
      action,
      hitId,
      hitGroupId,
      checkedTargetIds: aggregate.checkedTargetIds,
      confirmedTargetIds: aggregate.confirmedTargetIds,
      cycle,
      frame,
      timeSeconds,
      landed: aggregate.landed,
      hitConfirmAllowed: aggregate.confirmedTargetIds.length > 0
    });
    hitCallbackAggregates.delete(hitGroupId);
  };

  while (queue.size > 0) {
    const event = queue.pop();
    if (!event) break;
    const timeSeconds = event.timeSeconds;
    if (timeSeconds > config.duration + 1e-9) break;
    cleanup(timeSeconds);

    if (event.type === "action") {
      const { action, cycle } = event.payload as ActionEventPayload;
      const actor = characters.get(action.actorId);
      if (!actor) continue;
      activeCharacterId = actor.id;
      const energyCost = Math.max(0, safeNumber(action.energyCost));
      const currentEnergy = energies.get(actor.id) ?? 0;
      if (energyCost > currentEnergy + 1e-9) {
        skippedActions.push({
          time: timeSeconds,
          frame: event.frame,
          actorId: actor.id,
          actionId: action.id,
          action: action.name,
          reason: `能量不足 ${round(currentEnergy, 1)}/${energyCost}`,
          reasonCode: "INSUFFICIENT_ENERGY",
          energyBefore: currentEnergy,
          energyCost,
          cycle,
          ...(action.timelineCommandIndex === undefined
            ? {}
            : { timelineCommandIndex: action.timelineCommandIndex }),
          ...(action.sourceAbilityId === undefined
            ? {}
            : { sourceAbilityId: action.sourceAbilityId })
        });
        const summary = energyStats.get(actor.id);
        if (summary) summary.skipped += 1;
        continue;
      }

      const energyAfterCost = round(currentEnergy - energyCost, 12);
      energies.set(actor.id, energyAfterCost);
      const energySummary = energyStats.get(actor.id);
      if (energySummary) {
        energySummary.spent = round(energySummary.spent + energyCost, 12);
      }
      if (energyCost > 0) {
        recordEnergyCurve(
          event.frame,
          timeSeconds,
          "spend",
          actor.id,
          `${action.id}:energy-cost`
        );
      }
      actionLog.push({
        time: timeSeconds,
        frame: event.frame,
        actorId: actor.id,
        actionId: action.id,
        action: action.name,
        cycle,
        energyBefore: currentEnergy,
        energyAfter: energyAfterCost,
        ...(action.timelineCommandIndex === undefined
          ? {}
          : { timelineCommandIndex: action.timelineCommandIndex }),
        ...(action.sourceAbilityId === undefined
          ? {}
          : { sourceAbilityId: action.sourceAbilityId }),
        ...(action.cancelFrame === undefined
          ? {}
          : { cancelFrame: action.cancelFrame }),
        ...(action.animationEndFrame === undefined
          ? {}
          : { animationEndFrame: action.animationEndFrame })
      });

      const snapshotIds = new Set([actor.id]);
      for (const hit of action.hits ?? []) {
        snapshotIds.add(hit.scalingOwnerId ?? actor.id);
        for (const source of hit.flatSources ?? []) {
          snapshotIds.add(source.ownerId ?? actor.id);
        }
      }
      const snapshots: Record<string, CharacterStats | undefined> = {};
      for (const characterId of snapshotIds) {
        snapshots[characterId] = computeStats(characterId, timeSeconds);
      }

      for (const gain of action.energyGains ?? []) {
        push(timeSeconds + safeNumber(gain.offset), "energy", {
          actorId: actor.id,
          actionId: action.id,
          gain,
          cycle
        });
      }
      (action.particles ?? []).forEach((particle, particleIndex) => {
        if (particle.trigger !== undefined) return;
        push(
          timeSeconds + safeNumber(particle.spawnOffset),
          "particleSpawn",
          {
            actorId: actor.id,
            actionId: action.id,
            actionName: action.name,
            particle,
            particleIndex,
            cycle
          }
        );
      });
      for (const buff of action.buffs ?? []) {
        push(timeSeconds + safeNumber(buff.offset), "buff", {
          actorId: actor.id,
          buff
        });
      }
      for (const debuff of action.debuffs ?? []) {
        push(timeSeconds + safeNumber(debuff.offset), "debuff", {
          actorId: actor.id,
          debuff
        });
      }
      (action.hits ?? []).forEach((hit, hitIndex) => {
        const hitTimeSeconds = timeSeconds + hit.offset;
        const hitFrame = toFrame(hitTimeSeconds);
        const geometry = hit.geometry;
        const sourceActorPose = actorPoseById.get(actor.id);
        const resolvedGeometry =
          geometry === undefined
            ? undefined
            : resolveWorldHitGeometry(geometry, sourceActorPose);
        const targetPlans: Array<{
          targeting?: HitTargeting;
          targetingSource: "default" | "scripted" | "geometry";
          targetPosition: { x: number; y: number } | null;
          sourceActorPosition: { x: number; y: number } | null;
          sourceActorFacingDegrees: number | null;
          geometryKind:
            | "circle"
            | "rectangle"
            | "capsule"
            | "sector"
            | null;
          geometryCoordinateSpace:
            | "world"
            | "actor-local"
            | null;
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
        }> =
          geometry === undefined
            ? (
                hit.targeting === undefined
                  ? [undefined]
                  : "mode" in hit.targeting
                    ? hit.targeting.targets
                    : [hit.targeting]
              ).map((targeting) => ({
                ...(targeting === undefined ? {} : { targeting }),
                targetingSource:
                  targeting === undefined ? "default" : "scripted",
                targetPosition: resolveTargetPosition(
                  targeting?.targetId ?? "enemy-0",
                  hitFrame
                ),
                sourceActorPosition:
                  sourceActorPose === undefined
                    ? null
                    : deepClone(sourceActorPose.position),
                sourceActorFacingDegrees:
                  sourceActorPose?.facingDegrees ?? null,
                geometryKind: null,
                geometryCoordinateSpace: null,
                geometryOrigin: null,
                geometryStart: null,
                geometryEnd: null,
                geometryRadius: null,
                geometryHalfWidth: null,
                geometryHalfHeight: null,
                geometryRotationDegrees: null,
                geometryDirectionDegrees: null,
                geometryAngleDegrees: null,
                geometryDistance: null,
                geometryThreshold: null
              }))
            : enemyTargets.map((target) => {
                if (resolvedGeometry === undefined) {
                  throw new Error(
                    "Geometry resolution unexpectedly lost its shape."
                  );
                }
                const targetPosition = resolveTargetPosition(
                  target.id,
                  hitFrame
                );
                if (targetPosition === null) {
                  throw new Error(
                    `Target "${target.id}" passed geometry schema validation without a position.`
                  );
                }
                const geometryResolution = resolveHitGeometry(
                  resolvedGeometry,
                  targetPosition,
                  target.hitboxRadius
                );
                return {
                  targeting: {
                    targetId: target.id,
                    outcome: geometryResolution.landed
                      ? "landed"
                      : "miss",
                    ...(geometryResolution.landed
                      ? {}
                      : { reason: geometryResolution.missReason })
                  },
                  targetingSource: "geometry",
                  targetPosition,
                  sourceActorPosition:
                    sourceActorPose === undefined
                      ? null
                      : deepClone(sourceActorPose.position),
                  sourceActorFacingDegrees:
                    sourceActorPose?.facingDegrees ?? null,
                  geometryKind: resolvedGeometry.kind,
                  geometryCoordinateSpace:
                    geometry.coordinateSpace ?? "world",
                  geometryOrigin:
                    resolvedGeometry.kind === "capsule"
                      ? null
                      : deepClone(resolvedGeometry.origin),
                  geometryStart:
                    resolvedGeometry.kind === "capsule"
                      ? deepClone(resolvedGeometry.start)
                      : null,
                  geometryEnd:
                    resolvedGeometry.kind === "capsule"
                      ? deepClone(resolvedGeometry.end)
                      : null,
                  geometryRadius:
                    resolvedGeometry.kind === "circle" ||
                    resolvedGeometry.kind === "capsule" ||
                    resolvedGeometry.kind === "sector"
                      ? resolvedGeometry.radius
                      : null,
                  geometryHalfWidth:
                    resolvedGeometry.kind === "rectangle"
                      ? resolvedGeometry.halfWidth
                      : null,
                  geometryHalfHeight:
                    resolvedGeometry.kind === "rectangle"
                      ? resolvedGeometry.halfHeight
                      : null,
                  geometryRotationDegrees:
                    resolvedGeometry.kind === "rectangle"
                      ? resolvedGeometry.rotationDegrees
                      : null,
                  geometryDirectionDegrees:
                    resolvedGeometry.kind === "sector"
                      ? resolvedGeometry.directionDegrees
                      : null,
                  geometryAngleDegrees:
                    resolvedGeometry.kind === "sector"
                      ? resolvedGeometry.angleDegrees
                      : null,
                  geometryDistance: geometryResolution.distance,
                  geometryThreshold: geometryResolution.threshold
                };
              });
        const hitGroupId = `${action.id}:${cycle}:${hitIndex}:${toFrame(hitTimeSeconds)}`;
        targetPlans.forEach((targetPlan, targetIndex) => {
          push(hitTimeSeconds, "hit", {
            actorId: actor.id,
            action,
            hit,
            hitIndex,
            ...targetPlan,
            targetIndex,
            targetCount: targetPlans.length,
            hitGroupId,
            snapshots,
            cycle
          });
        });
      });
      continue;
    }

    if (event.type === "energy") {
      const { actorId, actionId, gain } =
        event.payload as EnergyEventPayload;
      const internalCooldown = gain.internalCooldown;
      const internalCooldownDurationFrames =
        internalCooldown === undefined
          ? null
          : Math.max(1, toFrame(internalCooldown.duration));
      const scopedInternalCooldownKey =
        internalCooldown === undefined
          ? null
          : `${actorId}\u0000${internalCooldown.key}`;
      const previousReadyFrame =
        scopedInternalCooldownKey === null
          ? null
          : (fixedEnergyCooldownReadyFrames.get(
              scopedInternalCooldownKey
            ) ?? 0);
      const blockedByInternalCooldown =
        previousReadyFrame !== null && event.frame < previousReadyFrame;
      const internalCooldownReadyFrame =
        internalCooldownDurationFrames === null
          ? null
          : blockedByInternalCooldown
            ? previousReadyFrame
            : event.frame + internalCooldownDurationFrames;
      if (
        scopedInternalCooldownKey !== null &&
        internalCooldownReadyFrame !== null &&
        !blockedByInternalCooldown
      ) {
        fixedEnergyCooldownReadyFrames.set(
          scopedInternalCooldownKey,
          internalCooldownReadyFrame
        );
      }
      const targets =
        gain.target === "team"
          ? config.characters.map((character) => character.id)
          : Array.isArray(gain.target)
            ? gain.target
            : [gain.target ?? actorId];
      for (const targetId of targets) {
        const character = characters.get(targetId);
        if (!character) continue;
        const before = energies.get(targetId) ?? 0;
        const source = gain.source ?? `${actionId}:fixed-energy`;
        if (blockedByInternalCooldown) {
          energyLog.push({
            id: energyLog.length,
            kind: "fixed",
            frame: event.frame,
            timeSeconds,
            sourceActorId: actorId,
            sourceActionId: actionId,
            source,
            receiverId: targetId,
            activeCharacterId,
            isOnField: activeCharacterId === targetId,
            energyBefore: before,
            rawEnergy: gain.amount,
            finalEnergy: gain.amount,
            gainedEnergy: 0,
            wastedEnergy: 0,
            energyAfter: before,
            spawnFrame: null,
            receiveFrame: event.frame,
            particleElement: null,
            particleKind: null,
            particleCount: null,
            isSameElement: null,
            energyRecharge: 1,
            fieldMultiplier: 1,
            baseEnergyPerParticle: null,
            applied: false,
            blockedReason: "INTERNAL_COOLDOWN",
            internalCooldownKey: internalCooldown?.key ?? null,
            internalCooldownDurationFrames,
            internalCooldownReadyFrame
          });
          recordEnergyCurve(
            event.frame,
            timeSeconds,
            "fixed-blocked",
            targetId,
            source
          );
          continue;
        }
        const after = round(
          clamp(before + gain.amount, 0, character.energyMax),
          12
        );
        const gainedEnergy = round(after - before, 12);
        const wastedEnergy =
          gain.amount > 0
            ? round(Math.max(0, gain.amount - gainedEnergy), 12)
            : 0;
        energies.set(targetId, after);
        const summary = energyStats.get(targetId);
        if (summary) {
          summary.gained = round(summary.gained + gainedEnergy, 12);
          summary.fixedGained = round(
            summary.fixedGained + gainedEnergy,
            12
          );
          summary.wasted = round(summary.wasted + wastedEnergy, 12);
        }
        energyLog.push({
          id: energyLog.length,
          kind: "fixed",
          frame: event.frame,
          timeSeconds,
          sourceActorId: actorId,
          sourceActionId: actionId,
          source,
          receiverId: targetId,
          activeCharacterId,
          isOnField: activeCharacterId === targetId,
          energyBefore: before,
          rawEnergy: gain.amount,
          finalEnergy: gain.amount,
          gainedEnergy,
          wastedEnergy,
          energyAfter: after,
          spawnFrame: null,
          receiveFrame: event.frame,
          particleElement: null,
          particleKind: null,
          particleCount: null,
          isSameElement: null,
          energyRecharge: 1,
          fieldMultiplier: 1,
          baseEnergyPerParticle: null,
          applied: true,
          blockedReason: null,
          internalCooldownKey: internalCooldown?.key ?? null,
          internalCooldownDurationFrames,
          internalCooldownReadyFrame
        });
        recordEnergyCurve(
          event.frame,
          timeSeconds,
          "fixed",
          targetId,
          source
        );
      }
      continue;
    }

    if (event.type === "particleSpawn") {
      const {
        actorId,
        actionId,
        actionName,
        particle,
        particleIndex,
        cycle,
        triggerLogId,
        triggerHitId
      } = event.payload as ParticleSpawnEventPayload;
      const particleCount = resolveParticleCount(particle.count, random);
      const receiveTimeSeconds =
        timeSeconds + Math.max(0, particle.travelTime);
      const receiveFrame = toFrame(receiveTimeSeconds);
      const particleEventId = particleEvents.length;
      const particleId =
        particle.id ?? `${actionId}:particle-${particleIndex}`;
      const source = particle.source ?? `${actionName}:${particleId}`;
      const receivedWithinSimulation =
        receiveTimeSeconds <= config.duration + 1e-9;
      particleEvents.push({
        id: particleEventId,
        sourceActorId: actorId,
        sourceActionId: actionId,
        source,
        particleId,
        spawnFrame: event.frame,
        receiveFrame,
        spawnTimeSeconds: timeSeconds,
        receiveTimeSeconds: frameNative
          ? receiveFrame / 60
          : receiveTimeSeconds,
        particleElement: particle.element,
        particleKind: particle.kind ?? "particle",
        particleCount,
        receivedWithinSimulation,
        cycle,
        triggerLogId: triggerLogId ?? null,
        triggerHitId: triggerHitId ?? null
      });
      if (receivedWithinSimulation) {
        push(receiveTimeSeconds, "particleReceive", { particleEventId });
      }
      continue;
    }

    if (event.type === "particleReceive") {
      const { particleEventId } =
        event.payload as ParticleReceiveEventPayload;
      const particle = particleEvents[particleEventId];
      if (!particle) continue;
      for (const character of config.characters) {
        const before = energies.get(character.id) ?? 0;
        const stats = computeStats(character.id, timeSeconds);
        const energyRecharge = stats?.energyRecharge ?? 1;
        const calculation = calculateParticleEnergy({
          particleElement: particle.particleElement,
          particleKind: particle.particleKind,
          particleCount: particle.particleCount,
          receiverElement: character.element,
          isOnField: activeCharacterId === character.id,
          partySize: config.characters.length,
          energyRecharge
        });
        const after = round(
          clamp(
            before + calculation.finalEnergy,
            0,
            character.energyMax
          ),
          12
        );
        const gainedEnergy = round(after - before, 12);
        const wastedEnergy = round(
          Math.max(0, calculation.finalEnergy - gainedEnergy),
          12
        );
        energies.set(character.id, after);
        const summary = energyStats.get(character.id);
        if (summary) {
          summary.gained = round(summary.gained + gainedEnergy, 12);
          summary.particleGained = round(
            summary.particleGained + gainedEnergy,
            12
          );
          summary.wasted = round(summary.wasted + wastedEnergy, 12);
        }
        energyLog.push({
          id: energyLog.length,
          kind: "particle",
          frame: event.frame,
          timeSeconds,
          sourceActorId: particle.sourceActorId,
          sourceActionId: particle.sourceActionId,
          source: particle.source,
          receiverId: character.id,
          activeCharacterId,
          isOnField: activeCharacterId === character.id,
          energyBefore: before,
          rawEnergy: calculation.rawEnergy,
          finalEnergy: calculation.finalEnergy,
          gainedEnergy,
          wastedEnergy,
          energyAfter: after,
          spawnFrame: particle.spawnFrame,
          receiveFrame: event.frame,
          particleElement: particle.particleElement,
          particleKind: particle.particleKind,
          particleCount: particle.particleCount,
          isSameElement: calculation.isSameElement,
          energyRecharge: calculation.energyRecharge,
          fieldMultiplier: calculation.fieldMultiplier,
          baseEnergyPerParticle: calculation.baseEnergyPerParticle,
          applied: true,
          blockedReason: null,
          internalCooldownKey: null,
          internalCooldownDurationFrames: null,
          internalCooldownReadyFrame: null
        });
        recordEnergyCurve(
          event.frame,
          timeSeconds,
          "particle",
          character.id,
          particle.source
        );
      }
      continue;
    }

    if (event.type === "buff") {
      const { actorId, buff } = event.payload as BuffEventPayload;
      addBuff(timeSeconds, actorId, buff);
      continue;
    }

    if (event.type === "debuff") {
      const { actorId, debuff } = event.payload as DebuffEventPayload;
      addDebuff(timeSeconds, actorId, debuff);
      continue;
    }

    if (event.type === "frozenExpiry") {
      const {
        targetId,
        generation,
        expectedExpiryFrame
      } = event.payload as FrozenExpiryEventPayload;
      frozenExpiryScheduleKeys.delete(
        `${targetId}\u0000${generation}\u0000${expectedExpiryFrame}`
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const result = auraEngine.expireFrozen(
        event.frame,
        generation,
        expectedExpiryFrame
      );
      if (result.operation === "stale") continue;
      const source = activeFrozenStateSources.get(targetId);
      frozenStateLog.push({
        id: frozenStateLog.length,
        reaction: "freeze",
        generation,
        operation: "expire",
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        sourceActorId: source?.actorId ?? null,
        triggerDamageEventId:
          source?.triggerDamageEventId ?? null,
        freezeResistance: target.freezeResistance,
        generatedGaugeUnits: 0,
        consumedGaugeUnits: 0,
        auraBefore: result.auraBefore,
        auraAfter: result.auraAfter,
        expiresAtFrame: null,
        reason: result.reason
      });
      if (source?.generation === generation) {
        activeFrozenStateSources.delete(targetId);
      }
      continue;
    }

    if (event.type === "periodicReactionExpiry") {
      const {
        targetId,
        generation,
        expectedExpiryFrame
      } = event.payload as PeriodicReactionExpiryEventPayload;
      periodicReactionExpiryScheduleKeys.delete(
        `${targetId}\u0000${generation}\u0000${expectedExpiryFrame}`
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const result = auraEngine.expireElectroCharged(
        event.frame,
        generation,
        expectedExpiryFrame
      );
      if (result.operation === "stale") continue;
      const source = activePeriodicReactionSources.get(targetId);
      periodicReactionLog.push({
        id: periodicReactionLog.length,
        reaction: "electroCharged",
        generation,
        operation: "stop",
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        sourceActorId: source?.actorId ?? null,
        triggerDamageEventId:
          source?.triggerDamageEventId ?? null,
        reactionDamageLogId: null,
        damageEventId: null,
        tickIndex: null,
        auraBefore: result.auraBefore,
        auraConsumed: result.auraConsumed,
        auraAfter: result.auraAfter,
        nextTickFrame: null,
        coexistenceExpiresAtFrame: null,
        waneFrame: null,
        reason: result.reason
      });
      if (source?.generation === generation) {
        activePeriodicReactionSources.delete(targetId);
      }
      continue;
    }

    if (event.type === "periodicReactionTick") {
      const {
        targetId,
        generation,
        tickIndex,
        firstTick,
        pinnedSource
      } = event.payload as PeriodicReactionTickEventPayload;
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;

      let source: PeriodicReactionSourceSnapshot | undefined;
      let auraBefore: SimulationResult["periodicReactionLog"][number]["auraBefore"];
      let auraAfter: SimulationResult["periodicReactionLog"][number]["auraAfter"];
      let nextTickFrame: number | null;
      let coexistenceExpiresAtFrame: number | null;
      let waneEligible = true;
      let tickReason: string | null = null;
      if (firstTick) {
        source = pinnedSource;
        const auraState = auraEngine.getAuraStateAt(event.frame);
        auraBefore = auraState;
        auraAfter = deepClone(auraState);
        const activeSource =
          activePeriodicReactionSources.get(targetId);
        const coexistencePresent =
          auraState.some((aura) => aura.element === "hydro") &&
          auraState.some((aura) => aura.element === "electro");
        const streamContinues =
          activeSource?.generation === generation &&
          coexistencePresent;
        nextTickFrame = streamContinues
          ? event.frame +
            AURA_ENGINE_CONSTANTS.electroChargedTickIntervalFrames
          : null;
        waneEligible = coexistencePresent;
        tickReason = streamContinues
          ? null
          : activeSource === undefined
            ? "QUEUED_FIRST_TICK_AFTER_STREAM_STOP"
            : "QUEUED_FIRST_TICK_AFTER_STREAM_REPLACED";
        coexistenceExpiresAtFrame = coexistencePresent
          ? (auraState
              .filter(
                (aura) =>
                  aura.element === "hydro" ||
                  aura.element === "electro"
              )
              .map((aura) => aura.expiresAtFrame)
              .filter((frame): frame is number => frame !== null)
              .sort((left, right) => left - right)[0] ?? null)
          : null;
      } else {
        const activeSource =
          activePeriodicReactionSources.get(targetId);
        if (
          !activeSource ||
          activeSource.generation !== generation
        ) {
          continue;
        }
        const prepared = auraEngine.prepareElectroChargedTick(
          event.frame,
          generation
        );
        if (prepared.operation === "stale") continue;
        if (prepared.operation === "stop") {
          periodicReactionLog.push({
            id: periodicReactionLog.length,
            reaction: "electroCharged",
            generation,
            operation: "stop",
            frame: event.frame,
            timeSeconds,
            targetId,
            targetName: target.name,
            sourceActorId: activeSource?.actorId ?? null,
            triggerDamageEventId:
              activeSource?.triggerDamageEventId ?? null,
            reactionDamageLogId: null,
            damageEventId: null,
            tickIndex,
            auraBefore: prepared.auraBefore,
            auraConsumed: prepared.auraConsumed,
            auraAfter: prepared.auraAfter,
            nextTickFrame: null,
            coexistenceExpiresAtFrame: null,
            waneFrame: null,
            reason: prepared.reason
          });
          if (activeSource?.generation === generation) {
            activePeriodicReactionSources.delete(targetId);
          }
          continue;
        }
        source = activeSource;
        auraBefore = prepared.auraBefore;
        auraAfter = prepared.auraAfter;
        nextTickFrame = prepared.nextTickFrame;
        coexistenceExpiresAtFrame =
          prepared.coexistenceExpiresAtFrame;
      }
      if (!source) continue;

      const periodicReactionLogId = periodicReactionLog.length;
      periodicReactionLog.push({
        id: periodicReactionLogId,
        reaction: "electroCharged",
        generation,
        operation: "tick",
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        sourceActorId: source.actorId,
        triggerDamageEventId: source.triggerDamageEventId,
        reactionDamageLogId: null,
        damageEventId: null,
        tickIndex,
        auraBefore,
        auraConsumed: [],
        auraAfter,
        nextTickFrame,
        coexistenceExpiresAtFrame,
        waneFrame: null,
        reason: tickReason
      });
      scheduleElectroChargedDamage({
        frame: event.frame,
        targetId,
        generation,
        tickIndex,
        source,
        periodicReactionLogId,
        nextTickFrame,
        waneEligible
      });
      if (nextTickFrame !== null) {
        push(nextTickFrame / 60, "periodicReactionTick", {
          targetId,
          generation,
          tickIndex: tickIndex + 1,
          firstTick: false
        } satisfies PeriodicReactionTickEventPayload);
      }
      if (nextTickFrame !== null) {
        schedulePeriodicReactionExpiry(
          targetId,
          generation,
          coexistenceExpiresAtFrame
        );
      }
      continue;
    }

    if (event.type === "periodicReactionWane") {
      const {
        targetId,
        sourceActorId,
        triggerDamageEventId,
        damageEventId,
        tickIndex,
        damageApplied
      } = event.payload as PeriodicReactionWaneEventPayload;
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const result = auraEngine.waneElectroCharged(
        event.frame,
        damageApplied
      );
      periodicReactionLog.push({
        id: periodicReactionLog.length,
        reaction: "electroCharged",
        generation: result.generation,
        operation:
          result.operation === "stale" ||
          result.operation === "tick"
            ? "stop"
            : result.operation,
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        sourceActorId,
        triggerDamageEventId,
        reactionDamageLogId: null,
        damageEventId,
        tickIndex,
        auraBefore: result.auraBefore,
        auraConsumed: result.auraConsumed,
        auraAfter: result.auraAfter,
        nextTickFrame: result.nextTickFrame,
        coexistenceExpiresAtFrame:
          result.coexistenceExpiresAtFrame,
        waneFrame: event.frame,
        reason: result.reason
      });
      if (
        result.operation === "stop" ||
        (result.operation === "wane" &&
          result.coexistenceExpiresAtFrame === null)
      ) {
        activePeriodicReactionSources.delete(targetId);
      } else {
        schedulePeriodicReactionExpiry(
          targetId,
          result.generation,
          result.coexistenceExpiresAtFrame
        );
      }
      continue;
    }

    if (event.type === "reactionDamage") {
      const {
        reaction,
        damageElement,
        strikeType,
        poiseDamage,
        statusEffect,
        actorId,
        action,
        triggerHitId,
        triggerHitGroupId,
        triggerDamageEventId,
        sourceTargetId,
        targetingMode,
        centerPosition,
        radius,
        baseMultiplier,
        stats,
        elementalMastery,
        reactionBonus,
        sourceBuffStatuses,
        snapshot,
        cycle,
        reactionDamageLogId,
        periodicContext
      } = event.payload as ReactionDamageEventPayload;
      const sourceActor = characters.get(actorId);
      const reactionLog = reactionDamageLog[reactionDamageLogId];
      if (!sourceActor || !reactionLog) continue;
      const reactionLabel =
        TRANSFORMATIVE_REACTION_LABELS[reaction];
      const reactionHitId = `${triggerHitId}:${reaction}`;
      const reactionHitGroupId =
        `${triggerHitGroupId}:${reaction}:${triggerDamageEventId}`;
      const reactionActionName =
        `${action.name} · ${reactionLabel}`;

      const spatialPlans: Array<{
        targetId: string;
        targetPosition: { x: number; y: number } | null;
        landed: boolean;
        reason: string | null;
        distance: number | null;
        threshold: number | null;
        targetingSource: "reaction-source" | "reaction-geometry";
      }> = [];
      if (
        targetingMode === "single-target" ||
        centerPosition === null
      ) {
        spatialPlans.push({
          targetId: sourceTargetId,
          targetPosition: resolveTargetPosition(
            sourceTargetId,
            event.frame
          ),
          landed: true,
          reason: null,
          distance: null,
          threshold: null,
          targetingSource: "reaction-source"
        });
        if (targetingMode === "radius") {
          reactionLog.unresolvedTargetIds.push(
            ...enemyTargets
              .filter((target) => target.id !== sourceTargetId)
              .map((target) => target.id)
          );
        }
      } else {
        for (const target of enemyTargets) {
          const targetPosition = resolveTargetPosition(
            target.id,
            event.frame
          );
          if (targetPosition === null) {
            reactionLog.unresolvedTargetIds.push(target.id);
            continue;
          }
          const geometryResolution = resolveHitGeometry(
            {
              kind: "circle",
              coordinateSpace: "world",
              origin: centerPosition,
              radius
            },
            targetPosition,
            target.hitboxRadius
          );
          spatialPlans.push({
            targetId: target.id,
            targetPosition,
            landed: geometryResolution.landed,
            reason: geometryResolution.landed
              ? null
              : geometryResolution.missReason,
            distance: geometryResolution.distance,
            threshold: geometryResolution.threshold,
            targetingSource: "reaction-geometry"
          });
        }
      }

      let periodicDamageEventId: number | null = null;
      let periodicActualDamage = 0;
      spatialPlans.forEach((plan, targetIndex) => {
        const targetProfile = enemyTargetById.get(plan.targetId);
        if (!targetProfile) return;
        reactionLog.checkedTargetIds.push(plan.targetId);
        if (plan.landed) reactionLog.hitTargetIds.push(plan.targetId);

        const activeTargetPhase = targetPhaseTimeline.find(
          (phase) =>
            phase.targetId === plan.targetId &&
            event.frame >= phase.startFrame &&
            event.frame < phase.endFrame
        );
        const reactionDamageAuraAllowed =
          activeTargetPhase?.effects.aura !== "blocked";
        const nestedShatterState =
          reactionDamageAuraAllowed
            ? (auraEngines
                ?.get(plan.targetId)
                ?.processShatterHit({
                  frame: event.frame,
                  element: damageElement,
                  strikeType,
                  poiseDamage
                }) ?? null)
            : null;
        const damageAllowed =
          plan.landed &&
          activeTargetPhase?.effects.damage !== "immune";
        const targetResolutionId = hitResolutionLog.length;
        const targetResolution: SimulationResult["hitResolutionLog"][number] =
          {
            id: targetResolutionId,
            frame: event.frame,
            timeSeconds,
            cycle,
            sourceActorId: actorId,
            sourceActionId: action.id,
            actionName: reactionActionName,
            hitId: reactionHitId,
            hitGroupId: reactionHitGroupId,
            targetIndex,
            targetCount: spatialPlans.length,
            hitLabel: `${reactionLabel}反应伤害`,
            element: damageElement,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            targetingSource: plan.targetingSource,
            resolutionKind: "reaction-damage",
            targetPosition: deepClone(plan.targetPosition),
            sourceActorPosition: null,
            sourceActorFacingDegrees: null,
            geometryKind:
              plan.targetingSource === "reaction-geometry"
                ? "circle"
                : null,
            geometryCoordinateSpace:
              plan.targetingSource === "reaction-geometry"
                ? "world"
                : null,
            geometryOrigin:
              plan.targetingSource === "reaction-geometry"
                ? deepClone(centerPosition)
                : null,
            geometryStart: null,
            geometryEnd: null,
            geometryRadius:
              plan.targetingSource === "reaction-geometry"
                ? radius
                : null,
            geometryHalfWidth: null,
            geometryHalfHeight: null,
            geometryRotationDegrees: null,
            geometryDirectionDegrees: null,
            geometryAngleDegrees: null,
            geometryDistance: plan.distance,
            geometryThreshold: plan.threshold,
            outcome: plan.landed ? "landed" : "miss",
            landed: plan.landed,
            reason:
              plan.reason ??
              (activeTargetPhase === undefined
                ? null
                : activeTargetPhase.reason),
            targetEffectSource:
              activeTargetPhase === undefined
                ? "normal"
                : "target-phase",
            targetPhaseId: activeTargetPhase?.id ?? null,
            damageAllowed,
            auraAllowed: false,
            hitConfirmAllowed: false,
            damageEventId: null,
            potentialDamage: 0,
            finalDamage: 0,
            displayDamage: 0,
            ...(action.timelineCommandIndex === undefined
              ? {}
              : {
                  timelineCommandIndex:
                    action.timelineCommandIndex
                }),
            ...(action.sourceAbilityId === undefined
              ? {}
              : { sourceAbilityId: action.sourceAbilityId })
          };
        hitResolutionLog.push(targetResolution);
        if (!plan.landed) return;

        const debuffState = getDebuffState(
          timeSeconds,
          damageElement,
          targetProfile.defReduction,
          plan.targetId
        );
        const effectiveResistance =
          targetProfile.resistance - debuffState.resShred;
        const effectiveDefenseReduction = clamp(
          debuffState.defReduction,
          -1,
          0.9
        );
        const activeStatuses: ActiveStatusSnapshot[] = [
          ...sourceBuffStatuses.map((status) =>
            deepClone(status)
          ),
          ...debuffState.relevantDebuffs.map((debuff) => ({
            key: debuff.key,
            kind: "debuff" as const,
            sourceActorId: debuff.actorId,
            ...("targetId" in debuff
              ? { targetId: debuff.targetId }
              : {}),
            element: debuff.element,
            resShred: debuff.resShred,
            defReduction: debuff.defReduction,
            startTimeSeconds: debuff.start,
            endTimeSeconds: debuff.end,
            label: debuff.label
          }))
        ];
        const calculation = calcTransformativeReactionDamage({
          characterLevel: sourceActor.level,
          elementalMastery,
          reactionBonus,
          baseMultiplier,
          effectiveResistance
        });
        const transformativeReactionFactors: TransformativeReactionFactors =
          {
            reaction,
            characterLevel: sourceActor.level,
            levelBaseDamage: calculation.levelBaseDamage,
            baseMultiplier,
            elementalMastery,
            elementalMasteryBonus:
              calculation.elementalMasteryBonus,
            reactionBonus: calculation.reactionBonus,
            preResistanceDamage:
              calculation.preResistanceDamage,
            effectiveResistance,
            resistanceMultiplier:
              calculation.resistanceMultiplier
          };
        const targetDamageMultiplier = damageAllowed ? 1 : 0;
        const finalDamage =
          calculation.finalDamage * targetDamageMultiplier;
        const displayDamage = Math.round(finalDamage);
        const damageEventId = damageEvents.length;
        const buffLabels = sourceBuffStatuses.map(
          (status) => status.label
        );
        const debuffLabels = debuffState.relevantDebuffs.map(
          (debuff) => debuff.label
        );
        const damageFactors: DamageEvent["damageFactors"] = {
          scaling: 0,
          scalingStat: "em",
          scalingValue: elementalMastery,
          flatDamage: 0,
          baseDamage: calculation.preResistanceDamage,
          damageBonus: 0,
          damageBonusMultiplier: 1,
          defenseIgnore: 1,
          defenseReduction: effectiveDefenseReduction,
          defenseMultiplier: 1,
          effectiveResistance,
          resistanceMultiplier:
            calculation.resistanceMultiplier,
          critRate: 0,
          critDamage: 0,
          critMultiplier: 1,
          reactionBase: baseMultiplier,
          elementalMasteryBonus:
            calculation.elementalMasteryBonus,
          reactionBonus: calculation.reactionBonus,
          amplifyingReactionMultiplier: 1,
          groupMultiplier: 1
        };
        const reactionAudit: ReactionAudit = {
          model: "reaction-damage",
          triggered: true,
          reaction,
          icdAllowed: null,
          icdTag: null,
          icdGroup: null,
          applicationGaugeUnits: null,
          auraBefore: null,
          auraApplied: null,
          auraConsumed: null,
          auraAfter: null,
          transformativeReaction: null,
          periodicReaction: null,
          frozenReaction: null,
          shatterReaction:
            nestedShatterState?.audit ?? null,
          note:
            `${reactionLabel}独立伤害：不暴击、忽略防御，不附着元素且不触发命中回调；仅应用${damageElement === "pyro" ? "火" : damageElement === "cryo" ? "冰" : damageElement === "electro" ? "雷" : damageElement === "physical" ? "物理" : damageElement}抗性与目标伤害策略。`
        };
        damageEvents.push({
          id: damageEventId,
          kind: "transformative-reaction",
          parentDamageEventId: triggerDamageEventId,
          sourceActorId: actorId,
          scalingOwnerId: actorId,
          creditOwnerId: actorId,
          actionId: action.id,
          hitId: reactionHitId,
          hitGroupId: reactionHitGroupId,
          targetIndex,
          targetCount: spatialPlans.length,
          targetResolutionId,
          targetId: plan.targetId,
          targetName: targetProfile.name,
          targetDamagePolicy: damageAllowed
            ? "normal"
            : "immune",
          targetDamageMultiplier,
          potentialDamage: calculation.finalDamage,
          frame: event.frame,
          timeSeconds,
          activeCharacterId,
          statsBeforeDamage: deepClone(stats),
          activeStatuses,
          enemyStateBeforeHit: {
            level: targetProfile.level,
            baseResistance: targetProfile.resistance,
            resistanceShred: debuffState.resShred,
            effectiveResistance,
            baseDefenseReduction: targetProfile.defReduction,
            effectiveDefenseReduction
          },
          reactionAudit,
          damageFactors,
          transformativeReactionFactors,
          finalDamage,
          displayDamage,
          sourceActorName: sourceActor.name,
          scalingOwnerName: sourceActor.name,
          creditOwnerName: sourceActor.name,
          actionName: reactionActionName,
          hitLabel: `${reactionLabel}反应伤害`,
          element: damageElement,
          reaction,
          snapshot,
          cycle,
          flatDetails: [],
          ...(action.timelineCommandIndex === undefined
            ? {}
            : {
                timelineCommandIndex:
                  action.timelineCommandIndex
              }),
          ...(action.sourceAbilityId === undefined
            ? {}
            : { sourceAbilityId: action.sourceAbilityId }),
          ...(action.startFrame === undefined
            ? {}
            : { actionStartFrame: action.startFrame }),
          ...(action.cancelFrame === undefined
            ? {}
            : { actionCancelFrame: action.cancelFrame }),
          ...(action.animationEndFrame === undefined
            ? {}
            : {
                actionAnimationEndFrame:
                  action.animationEndFrame
              }),
          time: timeSeconds,
          second: Math.floor(timeSeconds),
          actorId,
          creditId: actorId,
          actorName: sourceActor.name,
          activeId: activeCharacterId,
          scaling: 0,
          scalingStat: "em",
          scalingValue: elementalMastery,
          flat: 0,
          baseDamage: calculation.preResistanceDamage,
          dmgBonus: 0,
          bonusFactor: 1,
          defIgnore: 1,
          defReduction: effectiveDefenseReduction,
          defenseFactor: 1,
          effectiveRes: effectiveResistance,
          resFactor: calculation.resistanceMultiplier,
          critRate: 0,
          critDmg: 0,
          critFactor: 1,
          em: elementalMastery,
          reactionBase: baseMultiplier,
          emBonus: calculation.elementalMasteryBonus,
          reactionBonus: calculation.reactionBonus,
          reactionFactor:
            baseMultiplier *
            (1 +
              calculation.elementalMasteryBonus +
              calculation.reactionBonus),
          groupMultiplier: 1,
          buffs: buffLabels,
          debuffs: debuffLabels
        });
        reactionLog.damageEventIds.push(damageEventId);
        targetResolution.damageEventId = damageEventId;
        targetResolution.potentialDamage =
          calculation.finalDamage;
        targetResolution.finalDamage = finalDamage;
        targetResolution.displayDamage = displayDamage;
        if (nestedShatterState !== null) {
          recordShatterFrozenState({
            result: nestedShatterState,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            sourceActorId: actorId,
            triggerDamageEventId: damageEventId,
            frame: event.frame,
            timeSeconds,
            freezeResistance: targetProfile.freezeResistance
          });
          if (nestedShatterState.audit.triggered) {
            scheduleShatterDamage({
              audit: nestedShatterState.audit,
              actorId,
              action,
              triggerHitId: reactionHitId,
              triggerHitGroupId: reactionHitGroupId,
              triggerDamageEventId: damageEventId,
              sourceTargetId: plan.targetId,
              stats,
              reactionBonus,
              sourceBuffStatuses,
              snapshot,
              cycle,
              triggerFrame: event.frame
            });
          }
        }
        if (
          periodicContext !== undefined &&
          plan.targetId === sourceTargetId
        ) {
          periodicDamageEventId = damageEventId;
          periodicActualDamage = finalDamage;
        }
        if (statusEffect !== null) {
          const existingIndex = activeTargetDebuffs.findIndex(
            (debuff) =>
              debuff.targetId === plan.targetId &&
              debuff.key === statusEffect.key
          );
          const operation =
            existingIndex === -1 ? "apply" : "refresh";
          if (existingIndex !== -1) {
            const existing =
              activeTargetDebuffs[existingIndex];
            const existingLog =
              existing === undefined
                ? undefined
                : reactionStatusLog[
                    existing.reactionStatusLogId
                  ];
            if (existingLog !== undefined) {
              existingLog.endFrame = event.frame;
              existingLog.endTimeSeconds = timeSeconds;
              existingLog.supersededAtFrame = event.frame;
            }
            activeTargetDebuffs.splice(existingIndex, 1);
          }
          const endFrame =
            event.frame + statusEffect.durationFrames;
          const reactionStatusLogId = reactionStatusLog.length;
          activeTargetDebuffs.push({
            key: statusEffect.key,
            actorId,
            targetId: plan.targetId,
            element: statusEffect.element,
            resShred: statusEffect.resShred,
            defReduction: 0,
            start: timeSeconds,
            end: endFrame / 60,
            label: statusEffect.label,
            startFrame: event.frame,
            endFrame,
            reaction,
            reactionDamageEventId: damageEventId,
            reactionStatusLogId
          });
          reactionStatusLog.push({
            id: reactionStatusLogId,
            reaction,
            reactionDamageEventId: damageEventId,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            key: statusEffect.key,
            label: statusEffect.label,
            element: statusEffect.element,
            resShred: statusEffect.resShred,
            startFrame: event.frame,
            endFrame,
            startTimeSeconds: timeSeconds,
            endTimeSeconds: endFrame / 60,
            operation,
            supersededAtFrame: null
          });
          reactionLog.reactionStatusLogIds.push(
            reactionStatusLogId
          );
        }
      });
      if (
        periodicContext !== undefined &&
        periodicDamageEventId !== null
      ) {
        const periodicLog =
          periodicReactionLog[
            periodicContext.periodicReactionLogId
          ];
        if (periodicLog !== undefined) {
          periodicLog.damageEventId = periodicDamageEventId;
          periodicLog.waneFrame = periodicContext.waneEligible
            ? event.frame +
              AURA_ENGINE_CONSTANTS.electroChargedWaneDelayFrames
            : null;
        }
        if (periodicContext.waneEligible) {
          push(
            (event.frame +
              AURA_ENGINE_CONSTANTS.electroChargedWaneDelayFrames) /
              60,
            "periodicReactionWane",
            {
              targetId: sourceTargetId,
              sourceActorId: actorId,
              triggerDamageEventId,
              damageEventId: periodicDamageEventId,
              tickIndex: periodicContext.tickIndex,
              damageApplied: periodicActualDamage > 0
            } satisfies PeriodicReactionWaneEventPayload
          );
        }
      }
      continue;
    }

    const {
      actorId,
      action,
      hit,
      hitIndex,
      targeting,
      targetingSource,
      targetPosition,
      sourceActorPosition,
      sourceActorFacingDegrees,
      geometryKind,
      geometryCoordinateSpace,
      geometryOrigin,
      geometryStart,
      geometryEnd,
      geometryRadius,
      geometryHalfWidth,
      geometryHalfHeight,
      geometryRotationDegrees,
      geometryDirectionDegrees,
      geometryAngleDegrees,
      geometryDistance,
      geometryThreshold,
      targetIndex,
      targetCount,
      hitGroupId,
      snapshots,
      cycle
    } = event.payload as HitEventPayload;
    const scalingOwnerId = hit.scalingOwnerId ?? actorId;
    const creditOwnerId = hit.creditId ?? actorId;
    const sourceActor = characters.get(actorId);
    const scalingOwner = characters.get(scalingOwnerId);
    const creditOwner = characters.get(creditOwnerId);
    if (!sourceActor || !scalingOwner || !creditOwner) continue;
    const hitId = hit.id ?? `${action.id}:hit-${hitIndex}`;
    const element = hit.element ?? scalingOwner.element;
    const targetId = targeting?.targetId ?? "enemy-0";
    const targetProfile = enemyTargetById.get(targetId);
    if (!targetProfile) {
      throw new Error(
        `Target "${targetId}" passed schema validation but was not resolved.`
      );
    }
    const auraEngine = auraEngines?.get(targetId) ?? null;
    const targetOutcome = targeting?.outcome ?? "landed";
    const activeTargetPhase = targetPhaseTimeline.find(
      (phase) =>
        phase.targetId === targetId &&
        event.frame >= phase.startFrame &&
        event.frame < phase.endFrame
    );
    const targetEffects =
      targeting?.effects ?? activeTargetPhase?.effects;
    const targetEffectSource =
      targeting?.effects !== undefined ||
      targetOutcome === "miss"
        ? ("hit" as const)
        : activeTargetPhase === undefined
          ? ("normal" as const)
          : ("target-phase" as const);
    const landed = targetOutcome === "landed";
    const damageAllowed =
      landed && targetEffects?.damage !== "immune";
    const auraAllowed =
      landed && targetEffects?.aura !== "blocked";
    const hitConfirmAllowed =
      landed && targetEffects?.hitConfirm !== "blocked";
    const targetResolutionId = hitResolutionLog.length;
    const targetResolution: SimulationResult["hitResolutionLog"][number] = {
      id: targetResolutionId,
      frame: event.frame,
      timeSeconds,
      cycle,
      sourceActorId: actorId,
      sourceActionId: action.id,
      actionName: action.name,
      hitId,
      hitGroupId,
      targetIndex,
      targetCount,
      hitLabel: hit.label ?? "命中",
      element,
      targetId,
      targetName: targetProfile.name,
      targetingSource,
      resolutionKind: "direct",
      targetPosition,
      sourceActorPosition,
      sourceActorFacingDegrees,
      geometryKind,
      geometryCoordinateSpace,
      geometryOrigin,
      geometryStart,
      geometryEnd,
      geometryRadius,
      geometryHalfWidth,
      geometryHalfHeight,
      geometryRotationDegrees,
      geometryDirectionDegrees,
      geometryAngleDegrees,
      geometryDistance,
      geometryThreshold,
      outcome: targetOutcome,
      landed,
      reason:
        targeting?.reason ??
        (targetEffectSource === "target-phase"
          ? activeTargetPhase?.reason ?? null
          : null),
      targetEffectSource,
      targetPhaseId: activeTargetPhase?.id ?? null,
      damageAllowed,
      auraAllowed,
      hitConfirmAllowed,
      damageEventId: null,
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0,
      ...(action.timelineCommandIndex === undefined
        ? {}
        : { timelineCommandIndex: action.timelineCommandIndex }),
      ...(action.sourceAbilityId === undefined
        ? {}
        : { sourceAbilityId: action.sourceAbilityId })
    };
    hitResolutionLog.push(targetResolution);
    if (!targetResolution.landed) {
      completeHitTarget({
        actorId,
        action,
        hitId,
        hitGroupId,
        cycle,
        frame: event.frame,
        timeSeconds,
        targetId,
        targetIndex,
        targetCount,
        landed: false,
        hitConfirmAllowed: false
      });
      continue;
    }

    const stats =
      hit.snapshot === "action"
        ? deepClone(
            snapshots[scalingOwnerId] ??
              computeStats(scalingOwnerId, timeSeconds)
          )
        : computeStats(scalingOwnerId, timeSeconds);
    if (!stats) continue;

    const scalingStat = hit.scalingStat ?? "atk";
    const scalingValue = calcTotalStat(stats, scalingStat);
    let flatDamage = safeNumber(hit.flat);
    const flatDetails: DamageEvent["flatDetails"] = [];
    for (const source of hit.flatSources ?? []) {
      const sourceId = source.ownerId ?? scalingOwnerId;
      const sourceStats =
        hit.snapshot === "action"
          ? deepClone(
              snapshots[sourceId] ?? computeStats(sourceId, timeSeconds)
            )
          : computeStats(sourceId, timeSeconds);
      if (!sourceStats) continue;
      const sourceStat = source.stat ?? "atk";
      const sourceValue = calcTotalStat(sourceStats, sourceStat);
      const amount = sourceValue * source.multiplier;
      flatDamage += amount;
      flatDetails.push({
        ownerId: sourceId,
        stat: sourceStat,
        multiplier: source.multiplier,
        sourceValue,
        amount
      });
    }

    const debuffState = getDebuffState(
      timeSeconds,
      element,
      targetProfile.defReduction,
      targetId
    );
    const effectiveResistance =
      targetProfile.resistance -
      debuffState.resShred -
      safeNumber(hit.resShred);
    const effectiveDefenseReduction = clamp(
      debuffState.defReduction + safeNumber(hit.defReduction),
      -1,
      0.9
    );
    const activeStatuses: ActiveStatusSnapshot[] = [
      ...activeBuffs
        .filter((buff) => buff.targetId === scalingOwnerId)
        .map((buff) => ({
          key: buff.key,
          kind: "buff" as const,
          sourceActorId: buff.actorId,
          targetId: buff.targetId,
          stat: buff.stat,
          value: buff.value,
          startTimeSeconds: buff.start,
          endTimeSeconds: buff.end,
          label: buff.label
        })),
      ...debuffState.relevantDebuffs.map((debuff) => ({
        key: debuff.key,
        kind: "debuff" as const,
        sourceActorId: debuff.actorId,
        ...("targetId" in debuff
          ? { targetId: debuff.targetId }
          : {}),
        element: debuff.element,
        resShred: debuff.resShred,
        defReduction: debuff.defReduction,
        startTimeSeconds: debuff.start,
        endTimeSeconds: debuff.end,
        label: debuff.label
      }))
    ];
    const enemyStateBeforeHit = {
      level: targetProfile.level,
      baseResistance: targetProfile.resistance,
      resistanceShred: debuffState.resShred + safeNumber(hit.resShred),
      effectiveResistance,
      baseDefenseReduction: targetProfile.defReduction,
      effectiveDefenseReduction
    };
    const shatterState =
      auraEngine !== null && auraAllowed
        ? auraEngine.processShatterHit({
            frame: event.frame,
            element,
            ...(hit.strikeType === undefined
              ? {}
              : { strikeType: hit.strikeType }),
            ...(hit.poiseDamage === undefined
              ? {}
              : { poiseDamage: hit.poiseDamage })
          })
        : null;
    const manualReaction = auraAllowed ? (hit.reaction ?? "none") : "none";
    const reactionAudit: ReactionAudit =
      auraEngine === null
        ? {
            model:
              manualReaction === "none" ? "none" : "manual-override",
            triggered: manualReaction !== "none",
            reaction: manualReaction,
            icdAllowed: null,
            icdTag: null,
            icdGroup: null,
            applicationGaugeUnits: null,
            auraBefore: null,
            auraApplied: null,
            auraConsumed: null,
            auraAfter: null,
            transformativeReaction: null,
            periodicReaction: null,
            frozenReaction: null,
            shatterReaction: null,
            note:
              !auraAllowed
                ? "目标效果策略阻止了本段附着与手工反应标签。"
                : manualReaction === "none"
                ? "兼容模式未运行 Aura/ICD 引擎。"
                : "反应由命中配置手工指定；未运行 Aura/ICD 合法性判断。"
          }
        : auraAllowed
          ? auraEngine.processHit({
              frame: event.frame,
              sourceActorId: actorId,
              element,
              ...(hit.application === undefined
                ? {}
                : { application: hit.application }),
              ...(hit.reactionOverride === undefined
                ? {}
                : { reactionOverride: hit.reactionOverride })
            })
          : {
              ...auraEngine.processHit({
                frame: event.frame,
                sourceActorId: actorId,
                element
              }),
              note:
                "目标效果策略阻止了本段元素附着与反应；Aura 仅按当前帧衰减。"
            };
    reactionAudit.shatterReaction =
      shatterState?.audit ?? null;
    const reaction = reactionAudit.reaction;
    const amplifyingReaction =
      reaction === "melt" ||
      reaction === "reverseMelt" ||
      reaction === "vaporize" ||
      reaction === "reverseVaporize"
        ? reaction
        : "none";
    let damageInput: DamageCalculationInput = {
      scaling: hit.scaling,
      scalingStat,
      scalingValue,
      flatDamage,
      damageBonus: stats.dmgBonus + safeNumber(hit.dmgBonus),
      characterLevel: scalingOwner.level,
      enemyLevel: targetProfile.level,
      defenseReduction: effectiveDefenseReduction,
      defenseIgnore: stats.defIgnore + safeNumber(hit.defIgnore),
      effectiveResistance,
      critRate: stats.critRate + safeNumber(hit.critRate),
      critDamage: stats.critDmg + safeNumber(hit.critDmg),
      critMode: options.critMode,
      reaction: amplifyingReaction,
      elementalMastery: stats.em,
      reactionBonus:
        stats.reactionBonus + safeNumber(hit.reactionBonus),
      ...(hit.ampBase === undefined
        ? {}
        : { explicitReactionBase: hit.ampBase }),
      groupMultiplier: safeNumber(hit.groupMultiplier, 1)
    };
    for (const plugin of plugins) {
      damageInput = applyPluginChanges(
        damageInput,
        plugin.modifyDamage({
          config,
          action,
          hit,
          cycle,
          timeSeconds,
          sourceActor,
          scalingOwner,
          creditOwner,
          statsBeforeDamage: stats,
          enemyStateBeforeHit,
          damageInput
        })
      );
    }

    const calculation = calcDamage(damageInput);
    const factors = calculation.factors;
    const buffLabels = activeStatuses
      .filter((status) => status.kind === "buff")
      .map((status) => status.label);
    const debuffLabels = activeStatuses
      .filter((status) => status.kind === "debuff")
      .map((status) => status.label);
    const snapshot = hit.snapshot ?? "hit";
    const damageEventId = damageEvents.length;
    const targetDamageMultiplier = damageAllowed ? 1 : 0;
    const finalDamage =
      calculation.finalDamage * targetDamageMultiplier;
    const displayDamage = Math.round(finalDamage);
    damageEvents.push({
      id: damageEventId,
      kind: "direct",
      parentDamageEventId: null,
      sourceActorId: actorId,
      scalingOwnerId,
      creditOwnerId,
      actionId: action.id,
      hitId,
      hitGroupId,
      targetIndex,
      targetCount,
      targetResolutionId,
      targetId,
      targetName: targetProfile.name,
      targetDamagePolicy: damageAllowed ? "normal" : "immune",
      targetDamageMultiplier,
      potentialDamage: calculation.finalDamage,
      frame: event.frame,
      timeSeconds,
      activeCharacterId,
      statsBeforeDamage: deepClone(stats),
      activeStatuses,
      enemyStateBeforeHit,
      reactionAudit,
      damageFactors: factors,
      transformativeReactionFactors: null,
      finalDamage,
      displayDamage,
      sourceActorName: sourceActor.name,
      scalingOwnerName: scalingOwner.name,
      creditOwnerName: creditOwner.name,
      actionName: action.name,
      hitLabel: hit.label ?? "命中",
      element,
      reaction,
      snapshot,
      cycle,
      flatDetails,
      ...(action.timelineCommandIndex === undefined
        ? {}
        : { timelineCommandIndex: action.timelineCommandIndex }),
      ...(action.sourceAbilityId === undefined
        ? {}
        : { sourceAbilityId: action.sourceAbilityId }),
      ...(action.startFrame === undefined
        ? {}
        : { actionStartFrame: action.startFrame }),
      ...(action.cancelFrame === undefined
        ? {}
        : { actionCancelFrame: action.cancelFrame }),
      ...(action.animationEndFrame === undefined
        ? {}
        : { actionAnimationEndFrame: action.animationEndFrame }),
      time: timeSeconds,
      second: Math.floor(timeSeconds),
      actorId,
      creditId: creditOwnerId,
      actorName: creditOwner.name,
      activeId: activeCharacterId,
      scaling: factors.scaling,
      scalingStat: factors.scalingStat,
      scalingValue: factors.scalingValue,
      flat: factors.flatDamage,
      baseDamage: factors.baseDamage,
      dmgBonus: factors.damageBonus,
      bonusFactor: factors.damageBonusMultiplier,
      defIgnore: factors.defenseIgnore,
      defReduction: factors.defenseReduction,
      defenseFactor: factors.defenseMultiplier,
      effectiveRes: factors.effectiveResistance,
      resFactor: factors.resistanceMultiplier,
      critRate: factors.critRate,
      critDmg: factors.critDamage,
      critFactor: factors.critMultiplier,
      em: damageInput.elementalMastery,
      reactionBase: factors.reactionBase,
      emBonus: factors.elementalMasteryBonus,
      reactionBonus: factors.reactionBonus,
      reactionFactor: factors.amplifyingReactionMultiplier,
      groupMultiplier: factors.groupMultiplier,
      buffs: buffLabels,
      debuffs: debuffLabels
    });
    targetResolution.damageEventId = damageEventId;
    targetResolution.potentialDamage = calculation.finalDamage;
    targetResolution.finalDamage = finalDamage;
    targetResolution.displayDamage = displayDamage;
    if (shatterState !== null) {
      recordShatterFrozenState({
        result: shatterState,
        targetId,
        targetName: targetProfile.name,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        frame: event.frame,
        timeSeconds,
        freezeResistance: targetProfile.freezeResistance
      });
      if (shatterState.audit.triggered) {
        const shatterSourceStats =
          hit.snapshot === "action"
            ? deepClone(
                snapshots[actorId] ??
                  computeStats(actorId, timeSeconds)
              )
            : computeStats(actorId, timeSeconds);
        if (shatterSourceStats === undefined) {
          throw new Error(
            `Shatter source stats for "${actorId}" could not be resolved.`
          );
        }
        scheduleShatterDamage({
          audit: shatterState.audit,
          actorId,
          action,
          triggerHitId: hitId,
          triggerHitGroupId: hitGroupId,
          triggerDamageEventId: damageEventId,
          sourceTargetId: targetId,
          stats: shatterSourceStats,
          reactionBonus:
            shatterSourceStats.reactionBonus +
            safeNumber(hit.reactionBonus),
          sourceBuffStatuses: activeBuffs
            .filter((buff) => buff.targetId === actorId)
            .map((buff) => ({
              key: buff.key,
              kind: "buff" as const,
              sourceActorId: buff.actorId,
              targetId: buff.targetId,
              stat: buff.stat,
              value: buff.value,
              startTimeSeconds: buff.start,
              endTimeSeconds: buff.end,
              label: buff.label
            })),
          snapshot,
          cycle,
          triggerFrame: event.frame
        });
      }
    }
    const transformativeReaction =
      reactionAudit.transformativeReaction;
    if (transformativeReaction !== null) {
      const reactionSourceStats =
        hit.snapshot === "action"
          ? deepClone(
              snapshots[actorId] ??
                computeStats(actorId, timeSeconds)
            )
          : computeStats(actorId, timeSeconds);
      if (reactionSourceStats === undefined) {
        throw new Error(
          `Reaction source stats for "${actorId}" could not be resolved.`
        );
      }
      const reactionDamageLogId = reactionDamageLog.length;
      const withinSimulation =
        transformativeReaction.scheduled &&
        transformativeReaction.damageFrame <=
          Math.round(config.duration * 60);
      reactionDamageLog.push({
        id: reactionDamageLogId,
        reaction: transformativeReaction.reaction,
        triggerDamageEventId: damageEventId,
        sourceActorId: actorId,
        sourceTargetId: targetId,
        triggerFrame: event.frame,
        damageFrame: transformativeReaction.damageFrame,
        scheduled: transformativeReaction.scheduled,
        withinSimulation,
        blockedReason: transformativeReaction.blockedReason,
        nextAvailableFrame:
          transformativeReaction.nextAvailableFrame,
        scheduleKind: "one-shot",
        targetingMode: "radius",
        centerPosition: deepClone(targetPosition),
        radius: transformativeReaction.radius,
        checkedTargetIds: [],
        hitTargetIds: [],
        unresolvedTargetIds: [],
        damageEventIds: [],
        reactionStatusLogIds: []
      });
      if (withinSimulation) {
        push(
          transformativeReaction.damageFrame / 60,
          "reactionDamage",
          {
            reaction: transformativeReaction.reaction,
            damageElement:
              transformativeReaction.damageElement,
            strikeType:
              transformativeReaction.reaction === "overload"
                ? "blunt"
                : "default",
            poiseDamage:
              transformativeReaction.reaction === "overload"
                ? 90
                : 0,
            statusEffect:
              transformativeReaction.statusEffect === null
                ? null
                : deepClone(
                    transformativeReaction.statusEffect
                  ),
            actorId,
            action,
            triggerHitId: hitId,
            triggerHitGroupId: hitGroupId,
            triggerDamageEventId: damageEventId,
            sourceTargetId: targetId,
            targetingMode: "radius",
            centerPosition: deepClone(targetPosition),
            radius: transformativeReaction.radius,
            baseMultiplier: transformativeReaction.baseMultiplier,
            stats: deepClone(reactionSourceStats),
            elementalMastery: reactionSourceStats.em,
            reactionBonus:
              reactionSourceStats.reactionBonus +
              safeNumber(hit.reactionBonus),
            sourceBuffStatuses: activeBuffs
              .filter((buff) => buff.targetId === actorId)
              .map((buff) => ({
                key: buff.key,
                kind: "buff" as const,
                sourceActorId: buff.actorId,
                targetId: buff.targetId,
                stat: buff.stat,
                value: buff.value,
                startTimeSeconds: buff.start,
                endTimeSeconds: buff.end,
                label: buff.label
              })),
            snapshot,
            cycle,
            reactionDamageLogId
          }
        );
      }
    }
    const frozenReaction = reactionAudit.frozenReaction;
    if (frozenReaction !== null) {
      const operation = frozenReaction.operation;
      const frozenConsumptionReaction =
        reaction === "melt" ? "MELT" : "SUPERCONDUCT";
      const frozenConsumptionExtent =
        frozenReaction.frozenGaugeAfter <= 0
          ? "FROZEN_CONSUMED"
          : "FROZEN_PARTIALLY_CONSUMED";
      const reason =
        operation === "immune"
          ? "FREEZE_RESISTANCE_IMMUNE"
          : operation === "consume"
            ? `${frozenConsumptionExtent}_BY_${frozenConsumptionReaction}`
            : null;
      frozenStateLog.push({
        id: frozenStateLog.length,
        reaction:
          reaction === "melt"
            ? "melt"
            : reaction === "superconduct"
              ? "superconduct"
              : "freeze",
        generation: frozenReaction.generation,
        operation,
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: targetProfile.name,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        freezeResistance: frozenReaction.freezeResistance,
        generatedGaugeUnits:
          frozenReaction.generatedGaugeUnits,
        consumedGaugeUnits:
          frozenReaction.consumedGaugeUnits,
        auraBefore: deepClone(
          reactionAudit.auraBefore ?? []
        ),
        auraAfter: deepClone(
          reactionAudit.auraAfter ?? []
        ),
        expiresAtFrame: frozenReaction.expiresAtFrame,
        reason
      });
      if (
        operation === "start" ||
        operation === "refresh"
      ) {
        activeFrozenStateSources.set(targetId, {
          generation: frozenReaction.generation,
          actorId,
          triggerDamageEventId: damageEventId
        });
      } else if (operation === "consume") {
        const existingSource =
          activeFrozenStateSources.get(targetId);
        if (frozenReaction.frozenGaugeAfter > 0) {
          activeFrozenStateSources.set(targetId, {
            generation: frozenReaction.generation,
            actorId: existingSource?.actorId ?? actorId,
            triggerDamageEventId:
              existingSource?.triggerDamageEventId ??
              damageEventId
          });
        } else {
          activeFrozenStateSources.delete(targetId);
        }
      }
      scheduleFrozenExpiry(
        targetId,
        frozenReaction.generation,
        frozenReaction.expiresAtFrame
      );
    }
    const periodicReaction = reactionAudit.periodicReaction;
    if (periodicReaction !== null) {
      if (periodicReaction.operation === "stop") {
        periodicReactionLog.push({
          id: periodicReactionLog.length,
          reaction: periodicReaction.reaction,
          generation: periodicReaction.generation,
          operation: "stop",
          frame: event.frame,
          timeSeconds,
          targetId,
          targetName: targetProfile.name,
          sourceActorId: actorId,
          triggerDamageEventId: damageEventId,
          reactionDamageLogId: null,
          damageEventId: null,
          tickIndex: null,
          auraBefore: deepClone(
            reactionAudit.auraBefore ?? []
          ),
          auraConsumed: deepClone(
            reactionAudit.auraConsumed ?? []
          ),
          auraAfter: deepClone(
            reactionAudit.auraAfter ?? []
          ),
          nextTickFrame: null,
          coexistenceExpiresAtFrame: null,
          waneFrame: null,
          reason: "COEXISTING_AURA_REMOVED_BY_HIT"
        });
        const activeSource =
          activePeriodicReactionSources.get(targetId);
        if (
          activeSource?.generation ===
          periodicReaction.generation
        ) {
          activePeriodicReactionSources.delete(targetId);
        }
      } else {
        const reactionSourceStats =
          hit.snapshot === "action"
            ? deepClone(
                snapshots[actorId] ??
                  computeStats(actorId, timeSeconds)
              )
            : computeStats(actorId, timeSeconds);
        if (reactionSourceStats === undefined) {
          throw new Error(
            `Periodic reaction source stats for "${actorId}" could not be resolved.`
          );
        }
        const sourceBuffStatuses = activeBuffs
          .filter((buff) => buff.targetId === actorId)
          .map((buff) => ({
            key: buff.key,
            kind: "buff" as const,
            sourceActorId: buff.actorId,
            targetId: buff.targetId,
            stat: buff.stat,
            value: buff.value,
            startTimeSeconds: buff.start,
            endTimeSeconds: buff.end,
            label: buff.label
          }));
        const periodicSource: PeriodicReactionSourceSnapshot = {
          generation: periodicReaction.generation,
          actorId,
          action,
          triggerHitId: hitId,
          triggerHitGroupId: hitGroupId,
          triggerDamageEventId: damageEventId,
          triggerFrame: event.frame,
          stats: deepClone(reactionSourceStats),
          elementalMastery: reactionSourceStats.em,
          reactionBonus:
            reactionSourceStats.reactionBonus +
            safeNumber(hit.reactionBonus),
          sourceBuffStatuses,
          snapshot,
          cycle
        };
        activePeriodicReactionSources.set(
          targetId,
          periodicSource
        );
        periodicReactionLog.push({
          id: periodicReactionLog.length,
          reaction: periodicReaction.reaction,
          generation: periodicReaction.generation,
          operation: periodicReaction.operation,
          frame: event.frame,
          timeSeconds,
          targetId,
          targetName: targetProfile.name,
          sourceActorId: actorId,
          triggerDamageEventId: damageEventId,
          reactionDamageLogId: null,
          damageEventId: null,
          tickIndex: null,
          auraBefore: deepClone(
            reactionAudit.auraBefore ?? []
          ),
          auraConsumed: [],
          auraAfter: deepClone(
            reactionAudit.auraAfter ?? []
          ),
          nextTickFrame: periodicReaction.nextTickFrame,
          coexistenceExpiresAtFrame:
            periodicReaction.coexistenceExpiresAtFrame,
          waneFrame: null,
          reason: null
        });
        schedulePeriodicReactionExpiry(
          targetId,
          periodicReaction.generation,
          periodicReaction.coexistenceExpiresAtFrame
        );
        if (periodicReaction.firstDamageFrame !== null) {
          push(
            periodicReaction.firstDamageFrame / 60,
            "periodicReactionTick",
            {
              targetId,
              generation: periodicReaction.generation,
              tickIndex: 0,
              firstTick: true,
              pinnedSource: deepClone(periodicSource)
            } satisfies PeriodicReactionTickEventPayload
          );
        }
      }
    }
    completeHitTarget({
      actorId,
      action,
      hitId,
      hitGroupId,
      cycle,
      frame: event.frame,
      timeSeconds,
      targetId,
      targetIndex,
      targetCount,
      landed: true,
      hitConfirmAllowed
    });
  }

  for (const character of config.characters) {
    const summary = energyStats.get(character.id);
    if (summary) summary.final = energies.get(character.id) ?? 0;
  }

  const totalDamage = damageEvents.reduce(
    (sum, event) => sum + event.finalDamage,
    0
  );
  const byCharacter: Record<string, number> = {};
  const bySkill = new Map<
    string,
    Omit<SimulationResult["bySkill"][number], "dps" | "share">
  >();
  const hitCountByCharacter: Record<string, number> = {};
  const perSecond: SimulationResult["perSecond"] = Array.from(
    { length: Math.ceil(config.duration) },
    () => ({})
  );
  for (const event of damageEvents) {
    byCharacter[event.creditOwnerId] =
      (byCharacter[event.creditOwnerId] ?? 0) + event.finalDamage;
    hitCountByCharacter[event.creditOwnerId] =
      (hitCountByCharacter[event.creditOwnerId] ?? 0) + 1;
    const skillKey = `${event.creditOwnerId}::${event.actionName}`;
    const skill = bySkill.get(skillKey) ?? {
      creditId: event.creditOwnerId,
      actionName: event.actionName,
      damage: 0,
      hits: 0
    };
    skill.damage += event.finalDamage;
    skill.hits += 1;
    bySkill.set(skillKey, skill);
    const bucket = perSecond[event.second];
    if (bucket) {
      bucket[event.creditOwnerId] =
        (bucket[event.creditOwnerId] ?? 0) + event.finalDamage;
    }
  }
  const characterSummaries = config.characters
    .map((character) => {
      const damage = byCharacter[character.id] ?? 0;
      return {
        characterId: character.id,
        damage,
        hits: hitCountByCharacter[character.id] ?? 0,
        dps: damage / config.duration,
        share: totalDamage ? damage / totalDamage : 0
      };
    })
    .sort((left, right) => right.damage - left.damage);
  const targetSummaries: SimulationResult["targetSummaries"] =
    enemyTargets.map((target) => {
      const events = damageEvents.filter(
        (event) => event.targetId === target.id
      );
      const checks = hitResolutionLog.filter(
        (entry) => entry.targetId === target.id
      );
      const damage = events.reduce(
        (sum, event) => sum + event.finalDamage,
        0
      );
      return {
        targetId: target.id,
        targetName: target.name,
        damage,
        potentialDamage: events.reduce(
          (sum, event) => sum + event.potentialDamage,
          0
        ),
        damageEvents: events.length,
        landedChecks: checks.filter((entry) => entry.landed).length,
        missedChecks: checks.filter((entry) => !entry.landed).length,
        immuneDamageEvents: events.filter(
          (event) => event.targetDamagePolicy === "immune"
        ).length,
        dps: damage / config.duration,
        share: totalDamage ? damage / totalDamage : 0
      };
    });
  const skillSummaries = [...bySkill.values()]
    .map((skill) => ({
      ...skill,
      dps: skill.damage / config.duration,
      share: totalDamage ? skill.damage / totalDamage : 0
    }))
    .sort((left, right) => right.damage - left.damage);
  let cumulativeDamage = 0;
  const cumulativeByCharacter: Record<string, number> = {};
  const damageCurve = damageEvents.map((event) => {
    cumulativeDamage += event.finalDamage;
    cumulativeByCharacter[event.creditOwnerId] =
      (cumulativeByCharacter[event.creditOwnerId] ?? 0) + event.finalDamage;
    return {
      damageEventId: event.id,
      targetId: event.targetId,
      targetName: event.targetName,
      frame: event.frame,
      timeSeconds: event.timeSeconds,
      sourceActorId: event.sourceActorId,
      creditOwnerId: event.creditOwnerId,
      finalDamage: event.finalDamage,
      cumulativeDamage,
      cumulativeByCharacter: { ...cumulativeByCharacter }
    };
  });
  const auraTimeline: SimulationResult["auraTimeline"] = damageEvents.flatMap(
    (event) => {
      const audit = event.reactionAudit;
      if (
        audit.auraBefore === null ||
        audit.auraApplied === null ||
        audit.auraConsumed === null ||
        audit.auraAfter === null
      ) {
        return [];
      }
      return [
        {
          damageEventId: event.id,
          targetId: event.targetId,
          targetName: event.targetName,
          frame: event.frame,
          timeSeconds: event.timeSeconds,
          sourceActorId: event.sourceActorId,
          actionId: event.actionId,
          hitId: event.hitId,
          incomingElement: event.element,
          icdAllowed: audit.icdAllowed,
          reaction: event.reaction,
          auraBefore: audit.auraBefore,
          auraApplied: audit.auraApplied,
          auraConsumed: audit.auraConsumed,
          auraAfter: audit.auraAfter
        }
      ];
    }
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: config.engineVersion,
    dataVersion: config.dataVersion,
    randomSeed: options.randomSeed,
    reproducibilityKey: makeReproducibilityKey(
      resultConfig,
      options,
      plugins
    ),
    compatibilityMode: options.compatibilityMode,
    config: resultConfig,
    actorPoses,
    enemyTargets,
    damageEvents,
    hitEvents: damageEvents,
    hitResolutionLog,
    reactionDamageLog,
    reactionStatusLog,
    periodicReactionLog,
    frozenStateLog,
    targetPhaseTimeline,
    targetMotionTimeline,
    skippedActions,
    actionLog,
    energyStats: Object.fromEntries(energyStats),
    energyLog,
    particleEvents,
    particleTriggerLog,
    energyCurve,
    totalDamage,
    dps: totalDamage / config.duration,
    reactedHits: damageEvents.filter(
      (event) =>
        event.kind === "direct" &&
        event.reaction !== "none"
    ).length,
    byCharacter,
    characterSummaries,
    targetSummaries,
    bySkill: skillSummaries,
    perSecond,
    damageCurve,
    auraTimeline,
    ...(timelineExecution === undefined ? {} : { timelineExecution })
  };
}

function simulateLegalTimeline(
  config: SimConfig,
  runtimeOptions: SimulationRuntimeOptions
): SimulationResult {
  const timeline = config.timeline;
  if (!timeline) {
    throw new Error("simulateLegalTimeline requires config.timeline");
  }

  const runtimeEnergyFailures = new Map<number, RuntimeEnergyFailure>();
  const skippedByCommand = new Map<
    number,
    SimulationResult["skippedActions"][number]
  >();
  const abilities = new Map(
    timeline.abilities.map((ability) => [ability.id, ability])
  );
  const legalRuntimeOptions: SimulationRuntimeOptions = {
    ...runtimeOptions,
    compatibilityMode: "legal-frame-v1"
  };

  for (
    let commandIndex = 0;
    commandIndex < timeline.commands.length;
    commandIndex += 1
  ) {
    const command = timeline.commands[commandIndex];
    if (
      command === undefined ||
      command.type === "wait" ||
      !("abilityId" in command)
    ) {
      continue;
    }
    const ability = abilities.get(command.abilityId);
    if (!ability || (ability.energyCost ?? 0) <= 0) continue;

    const prefix = compileLegalTimeline(config, {
      runtimeEnergyFailures,
      stopAfterCommandIndex: commandIndex
    });
    const probe = simulateConfig(
      prefix.config,
      legalRuntimeOptions,
      config,
      prefix.execution
    );
    const skipped = probe.skippedActions.find(
      (entry) => entry.timelineCommandIndex === commandIndex
    );
    if (!skipped) continue;

    runtimeEnergyFailures.set(commandIndex, {
      commandIndex,
      energyBefore: skipped.energyBefore,
      energyCost: skipped.energyCost
    });
    skippedByCommand.set(commandIndex, skipped);
  }

  const compiled = compileLegalTimeline(config, {
    runtimeEnergyFailures
  });
  const result = simulateConfig(
    compiled.config,
    legalRuntimeOptions,
    config,
    compiled.execution
  );
  for (const skipped of skippedByCommand.values()) {
    result.skippedActions.push(skipped);
    const summary = result.energyStats[skipped.actorId];
    if (summary) summary.skipped += 1;
  }
  result.skippedActions.sort(
    (left, right) =>
      left.frame - right.frame ||
      (left.timelineCommandIndex ?? Number.MAX_SAFE_INTEGER) -
        (right.timelineCommandIndex ?? Number.MAX_SAFE_INTEGER) ||
      left.actionId.localeCompare(right.actionId)
  );
  return result;
}

export function simulate(
  rawConfig: unknown,
  runtimeOptions: SimulationRuntimeOptions = {}
): SimulationResult {
  const config = migrateConfig(rawConfig);
  if (!config.timeline) {
    return simulateConfig(config, runtimeOptions);
  }
  return simulateLegalTimeline(config, runtimeOptions);
}
