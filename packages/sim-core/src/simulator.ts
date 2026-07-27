import {
  CURRENT_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationRunManifest,
  migrateConfig,
  simulationRunManifestSchema,
  type AdditiveReactionFactors,
  type AmplifyingReaction,
  type ActionDefinition,
  type ActiveStatusSnapshot,
  type AuraElement,
  type BloomReactionAudit,
  type BuffDefinition,
  type BuffStat,
  type CharacterStats,
  type CrystallizeReaction,
  type CrystallizeReactionAudit,
  type DamageEvent,
  type DamagePluginManifestEntry,
  type DebuffDefinition,
  type DendroCoreReaction,
  type Element,
  type ElementalApplication,
  type EnergySummary,
  type HitGeometry,
  type HitDefinition,
  type HitTargeting,
  type ParticleDefinition,
  type ReactionAudit,
  type ReactionADamageGroupAudit,
  type ReactionBDamageGroupAudit,
  type ResolvedWorldHitGeometry,
  type ResolvedSimulationRuntimeOptions,
  type ShatterReactionAudit,
  type SwirlDamageGroupAudit,
  type SwirlReaction,
  type SwirlReactionAudit,
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
  calcAdditiveReactionDamage,
  calcAmplifyingReactionMultiplier,
  calcTransformativeReactionDamage,
  calcTotalStat,
  clamp,
  type DamageCalculationInput
} from "./formulas";
import { MinHeap } from "./min-heap";
import type {
  DamageFlatComponents,
  DamageModifierPlugin,
  DamagePluginChanges,
  DamageModifierPluginRuntime
} from "./plugins";
import {
  compileLegalTimeline,
  type RuntimeEnergyFailure
} from "./legal-timeline";
import {
  calcCrystallizeShield,
  CRYSTALLIZE_CONSTANTS,
  type CrystallizeShieldCalculation
} from "./crystallize";
import {
  auraStateSnapshotsEqual,
  TargetStateTimelineRecorder
} from "./target-state-timeline";
import { ReactionALimiter } from "./reaction-a";
import { ReactionBLimiter } from "./reaction-b";
import {
  DENDRO_CORE_CONSTANTS,
  DendroCoreManager,
  selectNearestDendroCoreTarget,
  type DendroCoreRemovalDecision,
  type DendroCoreReservation
} from "./dendro-core";
import {
  absorbPlayerDamageWithCrystallizeShield,
  applyPlayerHpDamage,
  calcPlayerMaxHp,
  calcPlayerReactionSelfDamage,
  PLAYER_REACTION_SELF_DAMAGE_RADII,
  resolveCircularPlayerHit,
  type PlayerReactionSelfDamageKind
} from "./player-damage";

export const EVENT_PRIORITY = {
  action: 0,
  buff: 1,
  debuff: 1,
  energy: 2,
  particleSpawn: 2,
  particleReceive: 2,
  hit: 3,
  periodicReactionExpiry: 2,
  burningFuelExpiry: 2,
  frozenExpiry: 2,
  quickenExpiry: 2,
  crystallizeShardSpawn: 2,
  crystallizeShardExpiry: 2,
  crystallizeShieldExpiry: 2,
  dendroCoreSpawn: 2,
  dendroCoreExpiry: 2,
  periodicReactionTick: 4,
  burningTick: 4,
  reactionDamage: 5,
  periodicReactionWane: 6,
  crystallizePickup: 7
} as const;

export interface SimulationRuntimeOptions extends SimulationOptions {
  plugins?: readonly DamageModifierPlugin[];
}

export function projectBloomBurningFuelExpiry(
  mutation: BloomReactionAudit["burningFuelStateMutation"]
): Readonly<{
  generation: number;
  expiryFrame: number;
}> | null {
  if (
    mutation.operation === "none" ||
    mutation.generation === null ||
    mutation.expiresAtFrameAfter === null
  ) {
    return null;
  }
  return {
    generation: mutation.generation,
    expiryFrame: mutation.expiresAtFrameAfter
  };
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
): ResolvedWorldHitGeometry {
  if ((geometry.coordinateSpace ?? "world") === "world") {
    return {
      ...geometry,
      coordinateSpace: "world"
    } as ResolvedWorldHitGeometry;
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
  resolvedGeometry: ResolvedWorldHitGeometry | null;
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
  triggerDamageEventId: number | null;
  sourceTargetId: string;
  targetingMode:
    | "radius"
    | "single-target"
    | "nearest-target-radius";
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
  application?: ElementalApplication;
  excludedTargetIds?: string[];
  swirlContext?: {
    scheduleKind: "swirl-self" | "swirl-propagation";
    reaction: SwirlReaction;
    /**
     * Per-hit/event reaction bonus that travels with the queued Swirl attack.
     * Character reaction bonus is intentionally read again if propagation
     * triggers a delayed amplifying reaction.
     */
    reactionBonusDelta: number;
  };
  periodicContext?: {
    generation: number;
    tickIndex: number;
    periodicReactionLogId: number;
    waneEligible: boolean;
  };
  burningContext?: {
    generation: number;
    tickIndex: number;
    burningStateLogId: number;
  };
  dendroCoreContext?: {
    reaction: DendroCoreReaction;
    coreId: number;
    removalLogId: number;
    reactionBonusDelta: number;
    selectionRadius: number | null;
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

interface BurningSourceSnapshot {
  generation: number;
  actorId: string;
  action: ActionDefinition;
  triggerHitId: string;
  triggerHitGroupId: string;
  triggerDamageEventId: number;
  triggerFrame: number;
  triggerElement: "pyro" | "dendro";
  fuelSourceActorId: string | null;
  fuelDecayPerFrame: number;
  fuelExpiresAtFrame: number | null;
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

interface QuickenStateSource {
  generation: number;
  actorId: string;
  triggerDamageEventId: number;
}

interface SwirlDamageIcdState {
  windowStartFrame: number;
  hitCount: number;
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

interface BurningTickEventPayload {
  targetId: string;
  generation: number;
  /** One-based counter from the fixed Burning task chain. */
  tickIndex: number;
}

interface BurningFuelExpiryEventPayload {
  targetId: string;
  generation: number;
  expectedExpiryFrame: number;
}

interface FrozenExpiryEventPayload {
  targetId: string;
  generation: number;
  expectedExpiryFrame: number;
}

interface QuickenExpiryEventPayload {
  targetId: string;
  generation: number;
  expectedExpiryFrame: number;
}

interface DendroCoreSpawnEventPayload {
  reservation: DendroCoreReservation;
}

interface DendroCoreExpiryEventPayload {
  coreId: number;
  expectedExpiryFrame: number;
}

interface DendroCoreRuntimeSource {
  reservation: DendroCoreReservation;
  action: ActionDefinition;
  triggerHitId: string;
  triggerHitGroupId: string;
  reactionBonusDelta: number;
  cycle: number;
}

interface CrystallizeShardSpawnEventPayload {
  audit: CrystallizeReactionAudit;
  actorId: string;
  sourceTargetId: string;
  triggerDamageEventId: number;
  triggerFrame: number;
}

interface CrystallizeShardExpiryEventPayload {
  shardId: number;
  expectedExpiryFrame: number;
}

interface CrystallizePickupEventPayload {
  commandIndex: number;
  element: AuraElement | "any";
}

interface CrystallizeShieldExpiryEventPayload {
  shieldId: number;
  expectedExpiryFrame: number;
}

interface ActiveCrystallizeShard {
  id: number;
  reaction: CrystallizeReaction;
  element: AuraElement;
  sourceActorId: string;
  sourceTargetId: string;
  triggerDamageEventId: number;
  triggerFrame: number;
  spawnedAtFrame: number;
  earliestPickupFrame: number;
  expiresAtFrame: number;
  position: { x: number; y: number } | null;
  spawnRadius: number;
  spawnAngleDegrees: number;
  sourceCharacterLevel: number;
  sourceElementalMastery: number;
}

interface ActiveCrystallizeShield {
  id: number;
  shardId: number;
  element: AuraElement;
  sourceActorId: string;
  pickedUpByActorId: string;
  sourceCharacterLevel: number;
  sourceElementalMastery: number;
  calculation: CrystallizeShieldCalculation;
  currentBaseHp: number;
  expiresAtFrame: number;
}

interface PlayerHpRuntimeState {
  actorId: string;
  maxHp: number;
  initialHp: number;
  currentHp: number;
  totalIncomingDamage: number;
  totalAbsorbedDamage: number;
  totalHpDamage: number;
  hitCount: number;
  zeroHpReached: boolean;
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
  | SimulationEvent<BurningTickEventPayload>
  | SimulationEvent<BurningFuelExpiryEventPayload>
  | SimulationEvent<FrozenExpiryEventPayload>
  | SimulationEvent<QuickenExpiryEventPayload>
  | SimulationEvent<DendroCoreSpawnEventPayload>
  | SimulationEvent<DendroCoreExpiryEventPayload>
  | SimulationEvent<CrystallizeShardSpawnEventPayload>
  | SimulationEvent<CrystallizeShardExpiryEventPayload>
  | SimulationEvent<CrystallizePickupEventPayload>
  | SimulationEvent<CrystallizeShieldExpiryEventPayload>;

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
  burning: "燃烧",
  shatter: "碎冰",
  swirlPyro: "火扩散",
  swirlHydro: "水扩散",
  swirlCryo: "冰扩散",
  swirlElectro: "雷扩散",
  bloom: "绽放",
  burgeon: "烈绽放",
  hyperbloom: "超绽放"
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

function createPluginManifest(
  plugins: readonly DamageModifierPlugin[]
): DamagePluginManifestEntry[] {
  return plugins.map((plugin, index) => ({
    order: index,
    index,
    id: plugin.descriptor.id,
    version: plugin.descriptor.version,
    kind: plugin.descriptor.kind,
    contentHash: plugin.descriptor.contentHash
  }));
}

interface ActiveDamageModifierPlugin {
  descriptor: DamageModifierPlugin["descriptor"];
  runtime: DamageModifierPluginRuntime;
}

function instantiateDamagePlugins(
  plugins: readonly DamageModifierPlugin[]
): ActiveDamageModifierPlugin[] {
  return plugins.map((plugin) => {
    const runtime = plugin.createRuntime();
    if (
      runtime === null ||
      typeof runtime !== "object" ||
      typeof runtime.modifyDamage !== "function"
    ) {
      throw new Error(
        `Damage plugin "${plugin.descriptor.id}" returned an invalid runtime.`
      );
    }
    return {
      descriptor: plugin.descriptor,
      runtime
    };
  });
}

interface AppliedDamagePluginChanges {
  damageInput: DamageCalculationInput;
  flatDamageComponents: DamageFlatComponents;
}

function hasOwn(
  value: object,
  key: PropertyKey
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireFinitePluginNumber(
  pluginId: string,
  field: string,
  value: unknown
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Damage plugin "${pluginId}" returned a non-finite ${field} override.`
    );
  }
  return value;
}

function applyPluginChanges(
  input: DamageCalculationInput,
  flatDamageComponents: DamageFlatComponents,
  changes: DamagePluginChanges | void,
  pluginId: string,
  hasAdditiveReaction: boolean
): AppliedDamagePluginChanges {
  if (!changes) {
    return {
      damageInput: input,
      flatDamageComponents
    };
  }

  const hasLegacyFlat = hasOwn(changes, "flatDamage");
  const hasOrdinaryFlat = hasOwn(
    changes,
    "ordinaryFlatDamage"
  );
  const hasAdditiveFlat = hasOwn(
    changes,
    "additiveReactionFlatDamage"
  );

  if (
    hasLegacyFlat &&
    (hasOrdinaryFlat || hasAdditiveFlat)
  ) {
    throw new Error(
      `Damage plugin "${pluginId}" returned flatDamage together with explicit flat-damage components.`
    );
  }
  if (hasLegacyFlat && hasAdditiveReaction) {
    throw new Error(
      `Damage plugin "${pluginId}" returned ambiguous flatDamage for a Catalyze hit; return ordinaryFlatDamage and/or additiveReactionFlatDamage instead.`
    );
  }
  if (hasAdditiveFlat && !hasAdditiveReaction) {
    throw new Error(
      `Damage plugin "${pluginId}" returned additiveReactionFlatDamage for a hit without Aggravate or Spread.`
    );
  }

  const {
    flatDamage: legacyFlatDamage,
    ordinaryFlatDamage,
    additiveReactionFlatDamage,
    ...inputChanges
  } = changes;
  let nextOrdinaryFlatDamage =
    flatDamageComponents.ordinaryFlatDamage;
  let nextAdditiveReactionFlatDamage =
    flatDamageComponents.additiveReactionFlatDamage;

  if (hasLegacyFlat) {
    nextOrdinaryFlatDamage = requireFinitePluginNumber(
      pluginId,
      "flatDamage",
      legacyFlatDamage
    );
  }
  if (hasOrdinaryFlat) {
    nextOrdinaryFlatDamage = requireFinitePluginNumber(
      pluginId,
      "ordinaryFlatDamage",
      ordinaryFlatDamage
    );
  }
  if (hasAdditiveFlat) {
    nextAdditiveReactionFlatDamage =
      requireFinitePluginNumber(
        pluginId,
        "additiveReactionFlatDamage",
        additiveReactionFlatDamage
      );
    if (nextAdditiveReactionFlatDamage < 0) {
      throw new Error(
        `Damage plugin "${pluginId}" returned a negative additiveReactionFlatDamage override.`
      );
    }
  }

  const nextFlatDamageComponents = {
    ordinaryFlatDamage: nextOrdinaryFlatDamage,
    additiveReactionFlatDamage:
      nextAdditiveReactionFlatDamage
  };
  return {
    damageInput: {
      ...input,
      ...inputChanges,
      flatDamage:
        nextFlatDamageComponents.ordinaryFlatDamage +
        nextFlatDamageComponents.additiveReactionFlatDamage
    },
    flatDamageComponents: nextFlatDamageComponents
  };
}

function simulateConfig(
  config: SimConfig,
  runtimeOptions: SimulationRuntimeOptions = {},
  resultConfig: SimConfig = config,
  timelineExecution?: TimelineExecution
): SimulationResult {
  const options: ResolvedSimulationRuntimeOptions = {
    energyMode: runtimeOptions.energyMode ?? "configured",
    critMode: runtimeOptions.critMode ?? "average",
    compatibilityMode:
      runtimeOptions.compatibilityMode ??
      (timelineExecution ? "legal-frame-v1" : "legacy-v0.1"),
    randomSeed: runtimeOptions.randomSeed ?? config.randomSeed
  };
  const pluginDefinitions = runtimeOptions.plugins ?? [];
  const pluginManifest = createPluginManifest(
    pluginDefinitions
  );
  const runManifest = simulationRunManifestSchema.parse(
    createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: config.engineVersion,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(resultConfig),
      resolvedRuntimeOptions: options,
      plugins: pluginManifest
    })
  );
  const plugins = instantiateDamagePlugins(pluginDefinitions);
  const random = new SeededRandom(options.randomSeed);
  const crystallizeRandom = new SeededRandom(
    `${options.randomSeed}:crystallize-shard-position-v1`
  );
  const dendroCoreManager = new DendroCoreManager(
    new SeededRandom(
      `${options.randomSeed}:dendro-core-position-v1`
    )
  );
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
  const enemyTargetOrderById = new Map(
    enemyTargets.map((target, index) => [target.id, index])
  );
  const burningAtomicPriorityStride =
    1 / (enemyTargets.length * 2 + 1);
  const burningTickPriorityForTarget = (
    targetId: string
  ): number =>
    EVENT_PRIORITY.burningTick +
    (enemyTargetOrderById.get(targetId) ?? 0) *
      2 *
      burningAtomicPriorityStride;
  const burningDamagePriorityForTarget = (
    targetId: string
  ): number =>
    burningTickPriorityForTarget(targetId) +
    burningAtomicPriorityStride;
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
    config.reactionEngine?.mode === "aura-v2" ||
    config.reactionEngine?.mode === "aura-v3" ||
    config.reactionEngine?.mode === "aura-v4" ||
    config.reactionEngine?.mode === "aura-v5"
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
  const auraInitialStates: SimulationResult["auraInitialStates"] =
    enemyTargets.map((target) => ({
      targetId: target.id,
      targetName: target.name,
      frame: 0,
      timeSeconds: 0,
      aura: deepClone(
        auraEngines?.get(target.id)?.getAuraStateAt(0) ?? []
      )
    }));
  const targetStateTimelineRecorder =
    new TargetStateTimelineRecorder();
  for (const initialState of auraInitialStates) {
    targetStateTimelineRecorder.recordBoundary({
      frame: initialState.frame,
      timeSeconds: initialState.timeSeconds,
      targetId: initialState.targetId,
      targetName: initialState.targetName,
      cause: "simulation-start",
      aura: initialState.aura
    });
  }
  const ordinaryAuraElements = new Set([
    "pyro",
    "hydro",
    "cryo",
    "electro",
    "dendro"
  ]);
  const ordinaryExpiryFrameScratch = new Array<number>(
    enemyTargets.length
  ).fill(Number.POSITIVE_INFINITY);
  const recordNaturalAuraExpiries = (
    limitFrame: number,
    includeLimit: boolean
  ): void => {
    if (auraEngines === null) return;
    while (true) {
      let nextExpiryFrame = Number.POSITIVE_INFINITY;
      ordinaryExpiryFrameScratch.fill(
        Number.POSITIVE_INFINITY
      );
      for (
        let targetIndex = 0;
        targetIndex < enemyTargets.length;
        targetIndex += 1
      ) {
        const target = enemyTargets[targetIndex]!;
        const currentFrame =
          targetStateTimelineRecorder.latestFrame(target.id);
        let targetExpiryFrame = Number.POSITIVE_INFINITY;
        for (const aura of targetStateTimelineRecorder.latestAuraView(
          target.id
        )) {
          const expiryFrame = aura.expiresAtFrame;
          if (
            !ordinaryAuraElements.has(aura.element) ||
            expiryFrame === null ||
            expiryFrame <= currentFrame ||
            (includeLimit
              ? expiryFrame > limitFrame
              : expiryFrame >= limitFrame)
          ) {
            continue;
          }
          targetExpiryFrame = Math.min(
            targetExpiryFrame,
            expiryFrame
          );
        }
        if (!Number.isFinite(targetExpiryFrame)) continue;
        ordinaryExpiryFrameScratch[targetIndex] =
          targetExpiryFrame;
        nextExpiryFrame = Math.min(
          nextExpiryFrame,
          targetExpiryFrame
        );
      }
      if (!Number.isFinite(nextExpiryFrame)) return;

      for (
        let targetIndex = 0;
        targetIndex < enemyTargets.length;
        targetIndex += 1
      ) {
        if (ordinaryExpiryFrameScratch[targetIndex] !== nextExpiryFrame) {
          continue;
        }
        const target = enemyTargets[targetIndex]!;
        const auraEngine = auraEngines.get(target.id);
        if (auraEngine === undefined) continue;
        const auraEngineFrame = auraEngine.getCurrentFrame();
        if (auraEngineFrame >= nextExpiryFrame) {
          const auraBefore =
            targetStateTimelineRecorder.latestAuraView(target.id);
          const auraAfter =
            auraEngine.getAuraStateAt(auraEngineFrame);
          if (auraStateSnapshotsEqual(auraBefore, auraAfter)) {
            targetStateTimelineRecorder.synchronize(
              target.id,
              auraEngineFrame,
              auraAfter
            );
            continue;
          }
          targetStateTimelineRecorder.recordNaturalExpiry({
            frame: nextExpiryFrame,
            timeSeconds: nextExpiryFrame / 60,
            targetId: target.id,
            targetName: target.name,
            auraBefore,
            auraAfter
          });
          if (auraEngineFrame > nextExpiryFrame) {
            targetStateTimelineRecorder.synchronize(
              target.id,
              auraEngineFrame,
              auraAfter
            );
          }
          continue;
        }
        const beforeFrame = Math.max(
          auraEngineFrame,
          nextExpiryFrame - 1
        );
        const auraBefore = auraEngine.getAuraStateAt(beforeFrame);
        const auraAfter = auraEngine.getAuraStateAt(nextExpiryFrame);
        if (auraStateSnapshotsEqual(auraBefore, auraAfter)) {
          targetStateTimelineRecorder.synchronize(
            target.id,
            nextExpiryFrame,
            auraAfter
          );
          continue;
        }
        targetStateTimelineRecorder.recordNaturalExpiry({
          frame: nextExpiryFrame,
          timeSeconds: nextExpiryFrame / 60,
          targetId: target.id,
          targetName: target.name,
          auraBefore,
          auraAfter
        });
      }
    }
  };
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
      hitResolutionLogIds: number[];
      triggerDamageEventIds: number[];
      resolvedGeometry: ResolvedWorldHitGeometry | null;
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
    payload: TPayload,
    priorityOverride?: number
  ): void => {
    if (timeSeconds <= config.duration + 1e-9) {
      const frame = toFrame(timeSeconds);
      queue.push({
        timeSeconds: frameNative ? frame / 60 : timeSeconds,
        frame,
        priority: priorityOverride ?? EVENT_PRIORITY[type],
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
  if (timelineExecution !== undefined && resultConfig.timeline !== undefined) {
    for (const commandResult of timelineExecution.commandResults) {
      if (
        commandResult.commandType !== "pickUpCrystallize" ||
        commandResult.startFrame === null ||
        commandResult.status === "rejected"
      ) {
        continue;
      }
      const command =
        resultConfig.timeline.commands[commandResult.commandIndex];
      if (command?.type !== "pickUpCrystallize") continue;
      push(
        commandResult.startFrame / 60,
        "crystallizePickup",
        {
          commandIndex: commandResult.commandIndex,
          element: command.element
        } satisfies CrystallizePickupEventPayload
      );
    }
  }

  const activeBuffs: ActiveBuff[] = [];
  const activeDebuffs: ActiveDebuff[] = [];
  const activeTargetDebuffs: ActiveTargetDebuff[] = [];
  const damageEvents: DamageEvent[] = [];
  const hitResolutionLog: SimulationResult["hitResolutionLog"] = [];
  const targetMechanicsTruncationLog: SimulationResult["targetMechanicsTruncationLog"] =
    [];
  const reactionDamageLog: SimulationResult["reactionDamageLog"] = [];
  const reactionStatusLog: SimulationResult["reactionStatusLog"] = [];
  const periodicReactionLog: SimulationResult["periodicReactionLog"] =
    [];
  const frozenStateLog: SimulationResult["frozenStateLog"] = [];
  const quickenStateLog: SimulationResult["quickenStateLog"] = [];
  const burningStateLog: SimulationResult["burningStateLog"] = [];
  const dendroCoreLog: SimulationResult["dendroCoreLog"] = [];
  const dendroCoreContactLog: SimulationResult["dendroCoreContactLog"] =
    [];
  const dendroCoreTimeline: SimulationResult["dendroCoreTimeline"] = {
    version: "1.0.0",
    points: []
  };
  const dendroCoreRuntimeSources = new Map<
    number,
    DendroCoreRuntimeSource
  >();
  const crystallizeShardLog: SimulationResult["crystallizeShardLog"] =
    [];
  const crystallizeShieldLog: SimulationResult["crystallizeShieldLog"] =
    [];
  const crystallizeShieldTimeline: SimulationResult["crystallizeShieldTimeline"] =
    [];
  const playerHitResolutionLog: SimulationResult["playerHitResolutionLog"] =
    [];
  const playerDamageEvents: SimulationResult["playerDamageEvents"] =
    [];
  const playerHpTimeline: SimulationResult["playerHpTimeline"] = {
    version: "1.0.0",
    points: []
  };
  const enabledPlayerDamageModel =
    config.playerDamageModel.mode === "reaction-self-v1"
      ? config.playerDamageModel
      : null;
  const playerSelfDamageStatus =
    enabledPlayerDamageModel === null
      ? ("unsupported-player-damage-model" as const)
      : ("modeled-player-reaction-damage" as const);
  const projectPlayerSelfDamageStatus = (
    audit: ReactionAudit
  ): ReactionAudit => ({
    ...audit,
    burningReaction:
      audit.burningReaction === null
        ? null
        : {
            ...audit.burningReaction,
            selfDamageStatus: playerSelfDamageStatus
          },
    bloomReactions: audit.bloomReactions.map((reaction) => ({
      ...reaction,
      selfDamageStatus: playerSelfDamageStatus
    }))
  });
  const configuredPlayerStateByActorId = new Map(
    (enabledPlayerDamageModel?.characters ?? []).map((state) => [
      state.actorId,
      state
    ])
  );
  const playerHpStateByActorId = new Map<
    string,
    PlayerHpRuntimeState
  >();
  if (enabledPlayerDamageModel !== null) {
    for (const character of config.characters) {
      const configuredState = configuredPlayerStateByActorId.get(
        character.id
      );
      if (configuredState === undefined) {
        throw new Error(
          `Missing player damage state for character "${character.id}".`
        );
      }
      const maxHpCalculation = calcPlayerMaxHp({
        baseHp: character.stats.baseHp,
        hpPct: character.stats.hpPct,
        flatHp: character.stats.flatHp
      });
      if (maxHpCalculation.maxHp <= 0) {
        throw new Error(
          `Player reaction self-damage requires positive Max HP for character "${character.id}".`
        );
      }
      const initialHp =
        maxHpCalculation.maxHp * configuredState.initialHpRatio;
      playerHpStateByActorId.set(character.id, {
        actorId: character.id,
        maxHp: maxHpCalculation.maxHp,
        initialHp,
        currentHp: initialHp,
        totalIncomingDamage: 0,
        totalAbsorbedDamage: 0,
        totalHpDamage: 0,
        hitCount: 0,
        zeroHpReached: initialHp === 0
      });
      playerHpTimeline.points.push({
        id: playerHpTimeline.points.length,
        frame: 0,
        timeSeconds: 0,
        eventPriority: null,
        eventSequence: null,
        intraEventSequence: null,
        operation: "initial",
        actorId: character.id,
        playerDamageEventId: null,
        maxHp: maxHpCalculation.maxHp,
        hpBefore: initialHp,
        hpAfter: initialHp,
        hpRatioAfter: initialHp / maxHpCalculation.maxHp
      });
    }
  }
  const activeCrystallizeShards = new Map<
    number,
    ActiveCrystallizeShard
  >();
  let nextCrystallizeShardId = 0;
  let nextCrystallizeShieldId = 0;
  let activeCrystallizeShield: ActiveCrystallizeShield | null = null;
  const activePeriodicReactionSources = new Map<
    string,
    PeriodicReactionSourceSnapshot
  >();
  const periodicReactionExpiryScheduleKeys = new Set<string>();
  const activeBurningSources = new Map<
    string,
    BurningSourceSnapshot
  >();
  const burningFuelExpiryScheduleKeys = new Set<string>();
  const activeFrozenStateSources = new Map<
    string,
    FrozenStateSource
  >();
  const frozenExpiryScheduleKeys = new Set<string>();
  const activeQuickenStateSources = new Map<
    string,
    QuickenStateSource
  >();
  const quickenExpiryScheduleKeys = new Set<string>();
  const swirlDamageIcdStates = new Map<
    string,
    SwirlDamageIcdState
  >();
  const dendroCoreReactionALimiter = new ReactionALimiter();
  const playerDendroCoreReactionALimiter =
    new ReactionALimiter();
  const shatterReactionALimiter = new ReactionALimiter();
  const superconductReactionALimiter = new ReactionALimiter();
  const overloadAndElectroChargedReactionBLimiter =
    new ReactionBLimiter();
  const recordTargetMechanicsTruncation = ({
    audit,
    targetId,
    targetName,
    sourceActorId,
    sourceActionId,
    hitId,
    triggerDamageEventId,
    frame,
    timeSeconds,
    eventPriority,
    eventSequence
  }: {
    audit: ReactionAudit;
    targetId: string;
    targetName: string;
    sourceActorId: string;
    sourceActionId: string;
    hitId: string;
    triggerDamageEventId: number;
    frame: number;
    timeSeconds: number;
    eventPriority: number;
    eventSequence: number;
  }): void => {
    const truncation = audit.mechanicsTruncation;
    if (
      truncation === null ||
      truncation.operation !== "trigger" ||
      targetMechanicsTruncationLog.some(
        (entry) => entry.targetId === targetId
      )
    ) {
      return;
    }
    targetMechanicsTruncationLog.push({
      id: targetMechanicsTruncationLog.length,
      targetId,
      targetName,
      frame,
      timeSeconds,
      sourceActorId,
      sourceActionId,
      hitId,
      triggerDamageEventId,
      unsupportedReactions: [
        ...truncation.unsupportedReactions
      ],
      discardedAura: deepClone(truncation.discardedAura),
      reason: truncation.reason
    });
    const burningSource = activeBurningSources.get(targetId);
    if (burningSource !== undefined) {
      const burningGaugeUnitsBefore =
        truncation.discardedAura.find(
          (entry) => entry.element === "burning"
        )?.gaugeUnits ?? 0;
      const fuelGaugeUnitsBefore =
        truncation.discardedAura.find(
          (entry) => entry.element === "burningFuel"
        )?.gaugeUnits ?? 0;
      burningStateLog.push({
        id: burningStateLog.length,
        reaction: "burning",
        generation: burningSource.generation,
        operation: "stop",
        frame,
        timeSeconds,
        eventPriority,
        eventSequence,
        targetId,
        targetName,
        triggerElement: null,
        damageSourceActorId: burningSource.actorId,
        fuelSourceActorId: burningSource.fuelSourceActorId,
        triggerDamageEventId,
        reactionDamageLogId: null,
        damageEventIds: [],
        playerHitResolutionLogId: null,
        playerDamageEventId: null,
        tickIndex: null,
        tickSkipped: false,
        skipReason: null,
        damageAllowed: null,
        burningGaugeUnitsBefore,
        burningGaugeUnitsAfter: 0,
        fuelGaugeUnitsBefore,
        fuelGaugeUnitsAfter: 0,
        fuelDecayPerFrame: burningSource.fuelDecayPerFrame,
        fuelExpiresAtFrame: null,
        auraBefore: deepClone(truncation.discardedAura),
        auraApplied: [],
        auraConsumed: [],
        auraAfter: [],
        nextTickFrame: null,
        clockModel: "target-local-no-hitlag",
        hitlagStatus: "unsupported-enemy-hitlag",
        icdGroup: "burning",
        icdTag: "burning-application",
        icdScope: "global-target",
        icdWindowStartFrame: null,
        icdHitIndex: null,
        icdResetFrames:
          AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
        icdApplicationSequence:
          AURA_ENGINE_CONSTANTS.burningIcdSequence,
        applicationAllowed: null,
        applicationBlockedReason: null,
        selfDamageStatus: playerSelfDamageStatus,
        reason: "TARGET_MECHANICS_TRUNCATION"
      });
      activeBurningSources.delete(targetId);
    }
    activePeriodicReactionSources.delete(targetId);
    activeFrozenStateSources.delete(targetId);
    activeQuickenStateSources.delete(targetId);
  };
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

  const scheduleBurningFuelExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const scheduleKey = `${targetId}\u0000${generation}\u0000${expiryFrame}`;
    if (burningFuelExpiryScheduleKeys.has(scheduleKey)) return;
    burningFuelExpiryScheduleKeys.add(scheduleKey);
    push(expiryFrame / 60, "burningFuelExpiry", {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies BurningFuelExpiryEventPayload);
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

  const scheduleQuickenExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const scheduleKey = `${targetId}\u0000${generation}\u0000${expiryFrame}`;
    if (quickenExpiryScheduleKeys.has(scheduleKey)) return;
    quickenExpiryScheduleKeys.add(scheduleKey);
    push(expiryFrame / 60, "quickenExpiry", {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies QuickenExpiryEventPayload);
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
      triggerHitGroupId: null,
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
      sourceCoreId: null,
      sourceCoreLogId: null,
      selectionRadius: null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits: null,
      excludedTargetIds: [],
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
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

  const scheduleBurningDamage = ({
    frame,
    targetId,
    generation,
    tickIndex,
    source,
    burningStateLogId,
    nextTickFrame
  }: {
    frame: number;
    targetId: string;
    generation: number;
    tickIndex: number;
    source: BurningSourceSnapshot;
    burningStateLogId: number;
    nextTickFrame: number | null;
  }): void => {
    const reactionDamageLogId = reactionDamageLog.length;
    const withinSimulation =
      frame <= Math.round(config.duration * 60);
    reactionDamageLog.push({
      id: reactionDamageLogId,
      reaction: "burning",
      triggerDamageEventId: source.triggerDamageEventId,
      triggerHitGroupId: null,
      sourceActorId: source.actorId,
      sourceTargetId: targetId,
      triggerFrame: source.triggerFrame,
      damageFrame: frame,
      scheduled: true,
      withinSimulation,
      blockedReason: null,
      nextAvailableFrame: nextTickFrame,
      scheduleKind: "burning-tick",
      targetingMode: "radius",
      centerPosition: resolveTargetPosition(targetId, frame),
      radius: AURA_ENGINE_CONSTANTS.burningRadius,
      sourceCoreId: null,
      sourceCoreLogId: null,
      selectionRadius: null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits:
        AURA_ENGINE_CONSTANTS.burningApplicationGaugeUnits,
      excludedTargetIds: [],
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    });
    const burningLog = burningStateLog[burningStateLogId];
    if (burningLog !== undefined) {
      burningLog.reactionDamageLogId = reactionDamageLogId;
    }
    if (!withinSimulation) return;
    push(
      frame / 60,
      "reactionDamage",
      {
        reaction: "burning",
      damageElement: "pyro",
      strikeType: "default",
      poiseDamage: 0,
      statusEffect: null,
      actorId: source.actorId,
      action: source.action,
      triggerHitId: source.triggerHitId,
      triggerHitGroupId: source.triggerHitGroupId,
      triggerDamageEventId: source.triggerDamageEventId,
      sourceTargetId: targetId,
      targetingMode: "radius",
      centerPosition: resolveTargetPosition(targetId, frame),
      radius: AURA_ENGINE_CONSTANTS.burningRadius,
      baseMultiplier:
        AURA_ENGINE_CONSTANTS.burningBaseMultiplier,
      stats: deepClone(source.stats),
      elementalMastery: source.elementalMastery,
      reactionBonus: source.reactionBonus,
      sourceBuffStatuses: deepClone(source.sourceBuffStatuses),
      snapshot: source.snapshot,
      cycle: source.cycle,
      reactionDamageLogId,
      application: {
        gaugeUnits:
          AURA_ENGINE_CONSTANTS.burningApplicationGaugeUnits,
        icdTag: "burning-application",
        icdGroup: "burning"
      },
        burningContext: {
          generation,
          tickIndex,
          burningStateLogId
        }
      } satisfies ReactionDamageEventPayload,
      burningDamagePriorityForTarget(targetId)
    );
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

  const resolvePlayerReactionSelfDamage = ({
    reaction,
    damageElement,
    sourceActorId,
    sourceTargetId,
    reactionDamageLogId,
    burningStateLogId,
    dendroCoreRemovalLogId,
    damageCenter,
    sourcePreResistanceDamage,
    frame,
    timeSeconds,
    eventPriority,
    eventSequence,
    nextIntraEventSequence
  }: {
    reaction: PlayerReactionSelfDamageKind;
    damageElement: Element;
    sourceActorId: string;
    sourceTargetId: string;
    reactionDamageLogId: number;
    burningStateLogId: number | null;
    dendroCoreRemovalLogId: number | null;
    damageCenter: { x: number; y: number };
    sourcePreResistanceDamage: number;
    frame: number;
    timeSeconds: number;
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    if (enabledPlayerDamageModel === null) return;
    if (activeCharacterId === null) {
      throw new Error(
        `Player reaction self-damage at frame ${frame} has no active character.`
      );
    }
    const targetActorId = activeCharacterId;
    const configuredState =
      configuredPlayerStateByActorId.get(targetActorId);
    const hpState = playerHpStateByActorId.get(targetActorId);
    const reactionLog =
      reactionDamageLog[reactionDamageLogId];
    if (
      configuredState === undefined ||
      hpState === undefined ||
      reactionLog === undefined
    ) {
      throw new Error(
        `Player reaction self-damage could not resolve state for active character "${targetActorId}".`
      );
    }

    const damageRadius =
      PLAYER_REACTION_SELF_DAMAGE_RADII[reaction];
    const geometry = resolveCircularPlayerHit({
      damageCenter,
      damageRadius,
      playerCenter: enabledPlayerDamageModel.position,
      playerRadius: enabledPlayerDamageModel.hitboxRadius
    });
    const playerHitResolutionLogId =
      playerHitResolutionLog.length;
    const playerHit: SimulationResult["playerHitResolutionLog"][number] =
      {
        id: playerHitResolutionLogId,
        frame,
        timeSeconds,
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction,
        element: damageElement,
        sourceActorId,
        sourceTargetId,
        targetActorId,
        reactionDamageLogId,
        burningStateLogId,
        dendroCoreRemovalLogId,
        damageCenter: deepClone(damageCenter),
        damageRadius,
        playerCenter: deepClone(
          enabledPlayerDamageModel.position
        ),
        playerRadius: enabledPlayerDamageModel.hitboxRadius,
        distance: geometry.distance,
        distanceSquared: geometry.distanceSquared,
        combinedRadius: geometry.combinedRadius,
        combinedRadiusSquared: geometry.combinedRadiusSquared,
        outcome: geometry.hit ? "landed" : "miss",
        blockedReason: geometry.hit ? null : "OUT_OF_RANGE",
        playerDamageEventId: null
      };
    playerHitResolutionLog.push(playerHit);
    reactionLog.playerHitResolutionLogIds.push(
      playerHitResolutionLogId
    );

    const burningLog =
      burningStateLogId === null
        ? undefined
        : burningStateLog[burningStateLogId];
    if (burningLog !== undefined) {
      burningLog.playerHitResolutionLogId =
        playerHitResolutionLogId;
    }
    const coreRemovalLog =
      dendroCoreRemovalLogId === null
        ? undefined
        : dendroCoreLog[dendroCoreRemovalLogId];
    if (
      coreRemovalLog !== undefined &&
      (coreRemovalLog.operation === "expire" ||
        coreRemovalLog.operation === "evict" ||
        coreRemovalLog.operation === "consume")
    ) {
      coreRemovalLog.playerHitResolutionLogId =
        playerHitResolutionLogId;
    }
    if (!geometry.hit) return;

    const playerReactionA =
      reaction === "burning"
        ? null
        : playerDendroCoreReactionALimiter.decide({
            targetId: "player-avatar",
            actorId: sourceActorId,
            reactionTag: reaction,
            frame
          });
    const damageGroupDecision:
      | ReactionADamageGroupAudit
      | null =
      playerReactionA === null
        ? null
        : {
            reaction: playerReactionA.reactionTag,
            sourceActorId,
            targetId: "player-avatar",
            windowStartFrame:
              playerReactionA.windowStartFrame,
            hitIndex: playerReactionA.hitIndex,
            resetFrames: 30,
            sequence: [true, true, false],
            damageAllowed: playerReactionA.damageAllowed,
            blockedReason: playerReactionA.blockedReason
          };
    const damageGroupMultiplier =
      damageGroupDecision?.damageAllowed === false
        ? (0 as const)
        : (1 as const);
    const baseDamageFactors =
      calcPlayerReactionSelfDamage({
        reaction,
        sourcePreResistanceDamage,
        effectiveResistance:
          configuredState.resistances[damageElement]
      });
    const incomingDamage =
      baseDamageFactors.finalDamage *
      damageGroupMultiplier;
    const damageFactors: SimulationResult["playerDamageEvents"][number]["damageFactors"] =
      {
        ...baseDamageFactors,
        damageGroupMultiplier,
        damageGroupDecision,
        finalDamage: incomingDamage
      };
    const playerDamageEventId = playerDamageEvents.length;
    const shieldAtHit = activeCrystallizeShield;
    let shieldResolution: SimulationResult["playerDamageEvents"][number]["shieldResolution"];
    if (shieldAtHit === null) {
      shieldResolution = {
        mode: "crystallize-v1",
        shieldId: null,
        shieldElement: null,
        incomingDamage,
        incomingElement: damageElement,
        elementalMasteryBonus: 0,
        shieldStrengthBonus: 0,
        absorptionMultiplier: 1,
        effectiveAbsorptionMultiplier: 1,
        baseHpBefore: 0,
        baseHpConsumed: 0,
        baseHpAfter: 0,
        absorptionCapacity: 0,
        absorbedDamage: 0,
        damageAfterShield: incomingDamage,
        shieldBroken: false
      };
    } else {
      const absorption =
        absorbPlayerDamageWithCrystallizeShield({
          incomingDamage,
          incomingElement: damageElement,
          shieldElement: shieldAtHit.element,
          currentBaseHp: shieldAtHit.currentBaseHp,
          elementalMasteryBonus:
            shieldAtHit.calculation.elementalMasteryBonus
        });
      shieldResolution = {
        mode: "crystallize-v1",
        shieldId: shieldAtHit.id,
        shieldElement: shieldAtHit.element,
        incomingDamage,
        incomingElement: damageElement,
        elementalMasteryBonus:
          absorption.elementalMasteryBonus,
        shieldStrengthBonus:
          absorption.shieldStrengthBonus,
        absorptionMultiplier:
          absorption.absorptionMultiplier,
        effectiveAbsorptionMultiplier:
          absorption.effectiveAbsorptionMultiplier,
        baseHpBefore: absorption.baseHpBefore,
        baseHpConsumed: absorption.baseHpConsumed,
        baseHpAfter: absorption.baseHpAfter,
        absorptionCapacity: absorption.absorptionCapacity,
        absorbedDamage: absorption.absorbedDamage,
        damageAfterShield: absorption.damageAfterShield,
        shieldBroken: absorption.shieldBroken
      };
      if (incomingDamage > 0) {
        shieldAtHit.currentBaseHp = absorption.baseHpAfter;
        const shieldOperation = absorption.shieldBroken
          ? ("break" as const)
          : ("absorb" as const);
        crystallizeShieldLog.push({
          id: crystallizeShieldLog.length,
          operation: shieldOperation,
          frame,
          timeSeconds,
          eventPriority,
          eventSequence,
          intraEventSequence: nextIntraEventSequence(),
          shieldId: shieldAtHit.id,
          shardId: shieldAtHit.shardId,
          element: shieldAtHit.element,
          sourceActorId: shieldAtHit.sourceActorId,
          pickedUpByActorId:
            shieldAtHit.pickedUpByActorId,
          sourceCharacterLevel:
            shieldAtHit.sourceCharacterLevel,
          sourceElementalMastery:
            shieldAtHit.sourceElementalMastery,
          baseHp: shieldAtHit.calculation.baseHp,
          elementalMasteryBonus:
            shieldAtHit.calculation.elementalMasteryBonus,
          generalAbsorption:
            shieldAtHit.calculation.generalAbsorption,
          matchingElementAbsorption:
            shieldAtHit.calculation.matchingElementAbsorption,
          geoDamageAbsorption:
            shieldAtHit.calculation.geoDamageAbsorption,
          currentBaseHp: absorption.baseHpAfter,
          expiresAtFrame: shieldAtHit.expiresAtFrame,
          previousShieldId: null,
          playerDamageEventId,
          incomingElement: damageElement,
          baseHpBeforeAbsorption: absorption.baseHpBefore,
          baseHpConsumed: absorption.baseHpConsumed,
          baseHpAfterAbsorption: absorption.baseHpAfter,
          absorbedDamage: absorption.absorbedDamage,
          damageAfterShield: absorption.damageAfterShield
        });
        const remainingGeneralAbsorption =
          absorption.baseHpAfter *
          (1 +
            shieldAtHit.calculation
              .elementalMasteryBonus);
        crystallizeShieldTimeline.push({
          id: crystallizeShieldTimeline.length,
          frame,
          timeSeconds,
          eventPriority,
          eventSequence,
          intraEventSequence: nextIntraEventSequence(),
          operation: shieldOperation,
          shieldId: absorption.shieldBroken
            ? null
            : shieldAtHit.id,
          element: absorption.shieldBroken
            ? null
            : shieldAtHit.element,
          generalAbsorption: absorption.shieldBroken
            ? 0
            : remainingGeneralAbsorption,
          expiresAtFrame: absorption.shieldBroken
            ? null
            : shieldAtHit.expiresAtFrame,
          playerDamageEventId,
          baseHpBeforeAbsorption: absorption.baseHpBefore,
          baseHpAfterAbsorption: absorption.baseHpAfter,
          absorbedDamage: absorption.absorbedDamage,
          damageAfterShield: absorption.damageAfterShield
        });
        if (absorption.shieldBroken) {
          activeCrystallizeShield = null;
        }
      }
    }

    const hpResolutionBase = applyPlayerHpDamage({
      currentHp: hpState.currentHp,
      maxHp: hpState.maxHp,
      incomingDamage: shieldResolution.damageAfterShield
    });
    const hpResolution: SimulationResult["playerDamageEvents"][number]["hpResolution"] =
      {
        zeroHpPolicy: "clamp-and-continue",
        ...hpResolutionBase
      };
    const playerDamageEvent: SimulationResult["playerDamageEvents"][number] =
      {
        id: playerDamageEventId,
        frame,
        timeSeconds,
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction,
        element: damageElement,
        sourceActorId,
        sourceTargetId,
        targetActorId,
        reactionDamageLogId,
        playerHitResolutionLogId,
        burningStateLogId,
        dendroCoreRemovalLogId,
        damageFactors,
        shieldResolution,
        hpResolution,
        finalDamage: hpResolution.actualLoss,
        displayDamage: Math.round(hpResolution.actualLoss)
      };
    playerDamageEvents.push(playerDamageEvent);
    playerHit.playerDamageEventId = playerDamageEventId;
    reactionLog.playerDamageEventIds.push(
      playerDamageEventId
    );
    if (burningLog !== undefined) {
      burningLog.playerDamageEventId =
        playerDamageEventId;
    }
    if (
      coreRemovalLog !== undefined &&
      (coreRemovalLog.operation === "expire" ||
        coreRemovalLog.operation === "evict" ||
        coreRemovalLog.operation === "consume")
    ) {
      coreRemovalLog.playerDamageEventId =
        playerDamageEventId;
    }

    hpState.currentHp = hpResolution.currentHpAfter;
    hpState.totalIncomingDamage += incomingDamage;
    hpState.totalAbsorbedDamage +=
      shieldResolution.absorbedDamage;
    hpState.totalHpDamage += hpResolution.actualLoss;
    hpState.hitCount += 1;
    hpState.zeroHpReached ||= hpResolution.currentHpAfter === 0;
    playerHpTimeline.points.push({
      id: playerHpTimeline.points.length,
      frame,
      timeSeconds,
      eventPriority,
      eventSequence,
      intraEventSequence: nextIntraEventSequence(),
      operation: "damage",
      actorId: targetActorId,
      playerDamageEventId,
      maxHp: hpState.maxHp,
      hpBefore: hpResolution.currentHpBefore,
      hpAfter: hpResolution.currentHpAfter,
      hpRatioAfter: hpResolution.hpRatioAfter
    });
  };

  const dendroCoreSnapshots =
    (): SimulationResult["dendroCoreTimeline"]["points"][number]["activeCores"] =>
      dendroCoreManager.snapshots().map((core) => ({
        coreId: core.coreId,
        sourceActorId: core.sourceActorId,
        sourceTargetId: core.sourceTargetId,
        spawnedAtFrame: core.spawnedAtFrame,
        expiresAtFrame: core.expiresAtFrame,
        position: deepClone(core.position),
        hitboxRadius: DENDRO_CORE_CONSTANTS.hitboxRadius
      }));

  const appendDendroCoreTimelinePoint = ({
    frame,
    eventType,
    eventPriority,
    eventSequence,
    intraEventSequence,
    operation,
    dendroCoreLogId,
    coreId,
    activeCores = dendroCoreSnapshots()
  }: {
    frame: number;
    eventType:
      | "dendroCoreSpawn"
      | "dendroCoreExpiry"
      | "hit"
      | "reactionDamage";
    eventPriority: number;
    eventSequence: number;
    intraEventSequence: number;
    operation: "spawn" | "expire" | "evict" | "consume";
    dendroCoreLogId: number;
    coreId: number;
    activeCores?: SimulationResult["dendroCoreTimeline"]["points"][number]["activeCores"];
  }): void => {
    dendroCoreTimeline.points.push({
      id: dendroCoreTimeline.points.length,
      frame,
      timeSeconds: frame / 60,
      eventType,
      eventPriority,
      eventSequence,
      intraEventSequence,
      operation,
      dendroCoreLogId,
      coreId,
      activeCores: deepClone(activeCores)
    });
  };

  const scheduleDendroCoreDamage = ({
    decision,
    damageSourceActorId,
    action,
    triggerHitId,
    triggerHitGroupId,
    triggerDamageEventId,
    reactionBonusDelta,
    cycle,
    contactLogId,
    contactEventType,
    removalFrame,
    eventPriority,
    eventSequence,
    intraEventSequence
  }: {
    decision: DendroCoreRemovalDecision;
    damageSourceActorId: string;
    action: ActionDefinition;
    triggerHitId: string;
    triggerHitGroupId: string;
    triggerDamageEventId: number | null;
    reactionBonusDelta: number;
    cycle: number;
    contactLogId: number | null;
    contactEventType: "hit" | "reactionDamage" | null;
    removalFrame: number;
    eventPriority: number;
    eventSequence: number;
    intraEventSequence: number;
  }): {
    removalLogId: number;
    reactionDamageLogId: number;
  } => {
    const sourceActor = characters.get(damageSourceActorId);
    if (sourceActor === undefined) {
      throw new Error(
        `Dendro-core damage source "${damageSourceActorId}" could not be resolved.`
      );
    }
    const removalLogId = dendroCoreLog.length;
    const reactionDamageLogId = reactionDamageLog.length;
    const withinSimulation =
      decision.damageFrame <= Math.round(config.duration * 60);
    const eventType =
      decision.operation === "expire"
        ? ("dendroCoreExpiry" as const)
        : decision.operation === "evict"
          ? ("dendroCoreSpawn" as const)
          : contactEventType;
    if (eventType === null) {
      throw new Error(
        "Dendro-core consumption requires a contact event type."
      );
    }
    dendroCoreLog.push({
      id: removalLogId,
      coreId: decision.core.coreId,
      operation: decision.operation,
      eventType,
      frame: removalFrame,
      timeSeconds: removalFrame / 60,
      eventPriority,
      eventSequence,
      intraEventSequence,
      sourceActorId: decision.core.sourceActorId,
      sourceTargetId: decision.core.sourceTargetId,
      originDamageEventId: decision.core.originDamageEventId,
      triggerFrame: decision.core.triggerFrame,
      coreDurationFrames: DENDRO_CORE_CONSTANTS.durationFrames,
      hitboxRadius: DENDRO_CORE_CONSTANTS.hitboxRadius,
      maxActiveCores: DENDRO_CORE_CONSTANTS.maxActiveCores,
      clockModel: "global-frame-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      mechanicsDataStatus:
        DENDRO_CORE_CONSTANTS.mechanicsDataStatus,
      selfDamageStatus: playerSelfDamageStatus,
      reaction: decision.reaction,
      reactionDamageLogId,
      playerHitResolutionLogId: null,
      playerDamageEventId: null,
      contactLogId,
      damageFrame: decision.damageFrame,
      withinSimulation,
      reason: decision.reason
    });
    const targetingMode =
      decision.reaction === "hyperbloom"
        ? ("nearest-target-radius" as const)
        : ("radius" as const);
    const radius =
      decision.reaction === "bloom"
        ? DENDRO_CORE_CONSTANTS.bloomRadius
        : decision.reaction === "burgeon"
          ? DENDRO_CORE_CONSTANTS.burgeonRadius
          : DENDRO_CORE_CONSTANTS.hyperbloomDamageRadius;
    reactionDamageLog.push({
      id: reactionDamageLogId,
      reaction: decision.reaction,
      triggerDamageEventId,
      triggerHitGroupId:
        contactLogId === null ? null : triggerHitGroupId,
      sourceActorId: damageSourceActorId,
      sourceTargetId: decision.core.sourceTargetId,
      triggerFrame: removalFrame,
      damageFrame: decision.damageFrame,
      scheduled: true,
      withinSimulation,
      blockedReason: null,
      nextAvailableFrame: null,
      scheduleKind:
        decision.reaction === "bloom"
          ? "dendro-core-bloom"
          : decision.reaction === "burgeon"
            ? "dendro-core-burgeon"
            : "dendro-core-hyperbloom",
      targetingMode,
      centerPosition: deepClone(decision.core.position),
      radius,
      sourceCoreId: decision.core.coreId,
      sourceCoreLogId: removalLogId,
      selectionRadius:
        decision.reaction === "hyperbloom"
          ? DENDRO_CORE_CONSTANTS.hyperbloomSelectionRadius
          : null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits: null,
      excludedTargetIds: [],
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    });
    if (withinSimulation) {
      push(decision.damageFrame / 60, "reactionDamage", {
        reaction: decision.reaction,
        damageElement: "dendro",
        strikeType: "default",
        poiseDamage: 0,
        statusEffect: null,
        actorId: damageSourceActorId,
        action,
        triggerHitId,
        triggerHitGroupId,
        triggerDamageEventId,
        sourceTargetId: decision.core.sourceTargetId,
        targetingMode,
        centerPosition: deepClone(decision.core.position),
        radius,
        baseMultiplier:
          decision.reaction === "bloom"
            ? DENDRO_CORE_CONSTANTS.bloomMultiplier
            : decision.reaction === "burgeon"
              ? DENDRO_CORE_CONSTANTS.burgeonMultiplier
              : DENDRO_CORE_CONSTANTS.hyperbloomMultiplier,
        // These values are deliberately replaced by live values when the
        // queued explosion resolves.
        stats: deepClone(sourceActor.stats),
        elementalMastery: sourceActor.stats.em,
        reactionBonus:
          sourceActor.stats.reactionBonus + reactionBonusDelta,
        sourceBuffStatuses: [],
        snapshot: "hit",
        cycle,
        reactionDamageLogId,
        dendroCoreContext: {
          reaction: decision.reaction,
          coreId: decision.core.coreId,
          removalLogId,
          reactionBonusDelta,
          selectionRadius:
            decision.reaction === "hyperbloom"
              ? DENDRO_CORE_CONSTANTS.hyperbloomSelectionRadius
              : null
        }
      } satisfies ReactionDamageEventPayload);
    }
    return { removalLogId, reactionDamageLogId };
  };

  const scheduleBloomCoreSpawns = ({
    audits,
    actorId,
    action,
    triggerHitId,
    triggerHitGroupId,
    triggerDamageEventId,
    sourceTargetId,
    reactionBonusDelta,
    cycle,
    eventType,
    eventPriority,
    eventSequence,
    nextIntraEventSequence
  }: {
    audits: readonly BloomReactionAudit[];
    actorId: string;
    action: ActionDefinition;
    triggerHitId: string;
    triggerHitGroupId: string;
    triggerDamageEventId: number;
    sourceTargetId: string;
    reactionBonusDelta: number;
    cycle: number;
    eventType: "hit" | "reactionDamage";
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    audits.forEach((audit, bloomReactionIndex) => {
      if (!audit.scheduled || audit.coreSpawnFrame === null) return;
      const reservation = dendroCoreManager.reserve({
        sourceActorId: actorId,
        sourceTargetId,
        originDamageEventId: triggerDamageEventId,
        triggerFrame: audit.triggerFrame,
        bloomReactionIndex
      });
      if (reservation.spawnFrame !== audit.coreSpawnFrame) {
        throw new Error(
          `Bloom core ${reservation.coreId} spawn frame disagrees with its Aura audit.`
        );
      }
      dendroCoreRuntimeSources.set(reservation.coreId, {
        reservation,
        action,
        triggerHitId,
        triggerHitGroupId,
        reactionBonusDelta,
        cycle
      });
      const withinSimulation =
        reservation.spawnFrame <=
        Math.round(config.duration * 60);
      dendroCoreLog.push({
        id: dendroCoreLog.length,
        coreId: reservation.coreId,
        operation: "spawn-scheduled",
        eventType,
        frame: audit.triggerFrame,
        timeSeconds: audit.triggerFrame / 60,
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence(),
        sourceActorId: actorId,
        sourceTargetId,
        originDamageEventId: triggerDamageEventId,
        triggerFrame: audit.triggerFrame,
        coreDurationFrames: DENDRO_CORE_CONSTANTS.durationFrames,
        hitboxRadius: DENDRO_CORE_CONSTANTS.hitboxRadius,
        maxActiveCores: DENDRO_CORE_CONSTANTS.maxActiveCores,
        clockModel: "global-frame-no-hitlag",
        hitlagStatus: "unsupported-enemy-hitlag",
        mechanicsDataStatus:
          DENDRO_CORE_CONSTANTS.mechanicsDataStatus,
        selfDamageStatus: playerSelfDamageStatus,
        bloomReactionIndex,
        spawnFrame: reservation.spawnFrame,
        withinSimulation,
        reason: "BLOOM_TRIGGERED"
      });
      if (withinSimulation) {
        push(reservation.spawnFrame / 60, "dendroCoreSpawn", {
          reservation
        } satisfies DendroCoreSpawnEventPayload);
      }
    });
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

  const recordQuickenState = ({
    audit,
    targetId,
    targetName,
    sourceActorId,
    triggerDamageEventId,
    frame,
    timeSeconds
  }: {
    audit: ReactionAudit;
    targetId: string;
    targetName: string;
    sourceActorId: string;
    triggerDamageEventId: number;
    frame: number;
    timeSeconds: number;
  }): void => {
    const quicken = audit.catalyzeReaction?.quicken;
    if (quicken !== null && quicken !== undefined) {
      quickenStateLog.push({
        id: quickenStateLog.length,
        reaction: "quicken",
        generation: quicken.generation,
        operation: quicken.operation,
        frame,
        timeSeconds,
        targetId,
        targetName,
        sourceActorId,
        triggerDamageEventId,
        triggerElement: quicken.triggerElement,
        consumedAuraElement: quicken.consumedAuraElement,
        candidateGaugeUnits: quicken.candidateGaugeUnits,
        quickenGaugeUnitsBefore:
          quicken.quickenGaugeUnitsBefore,
        quickenGaugeUnitsAfter:
          quicken.quickenGaugeUnitsAfter,
        decayPerFrameBefore: quicken.decayPerFrameBefore,
        decayPerFrameAfter: quicken.decayPerFrame,
        expiresAtFrameBefore: quicken.expiresAtFrameBefore,
        auraBefore: deepClone(quicken.operationAuraBefore),
        auraAfter: deepClone(quicken.operationAuraAfter),
        expiresAtFrame: quicken.expiresAtFrame,
        endCauseBefore: quicken.endCauseBefore,
        endCauseAfter: quicken.endCause,
        reason:
          quicken.operation === "unchanged"
            ? "WEAKER_QUICKEN_DID_NOT_REFRESH"
            : quicken.operation === "start"
              ? "QUICKEN_STARTED"
              : "QUICKEN_REFRESHED"
      });
      if (
        quicken.operation === "start" ||
        quicken.operation === "refresh"
      ) {
        activeQuickenStateSources.set(targetId, {
          generation: quicken.generation,
          actorId: sourceActorId,
          triggerDamageEventId
        });
      }
      if (quicken.endCause === "QUICKEN_DECAY") {
        scheduleQuickenExpiry(
          targetId,
          quicken.generation,
          quicken.expiresAtFrame
        );
      }
    }

    for (const bloom of audit.bloomReactions) {
      const fuelExpiry = projectBloomBurningFuelExpiry(
        bloom.burningFuelStateMutation
      );
      if (fuelExpiry !== null) {
        scheduleBurningFuelExpiry(
          targetId,
          fuelExpiry.generation,
          fuelExpiry.expiryFrame
        );
      }
      const mutation = bloom.quickenStateMutation;
      if (mutation.operation === "none") continue;
      const existingSource =
        activeQuickenStateSources.get(targetId);
      const lifecycleSourceActorId =
        existingSource?.actorId ?? sourceActorId;
      quickenStateLog.push({
        id: quickenStateLog.length,
        reaction: "quicken",
        generation: mutation.generationAfter,
        operation: mutation.operation,
        frame,
        timeSeconds,
        targetId,
        targetName,
        sourceActorId: lifecycleSourceActorId,
        triggerDamageEventId,
        triggerElement: null,
        consumedAuraElement: null,
        candidateGaugeUnits: 0,
        quickenGaugeUnitsBefore:
          bloom.quickenGaugeUnitsBefore,
        quickenGaugeUnitsAfter:
          bloom.quickenGaugeUnitsAfter,
        decayPerFrameBefore: mutation.decayPerFrameBefore,
        decayPerFrameAfter: mutation.decayPerFrameAfter,
        expiresAtFrameBefore: mutation.expiresAtFrameBefore,
        auraBefore: deepClone(mutation.operationAuraBefore),
        auraAfter: deepClone(mutation.operationAuraAfter),
        expiresAtFrame: mutation.expiresAtFrameAfter,
        endCauseBefore: mutation.endCauseBefore,
        endCauseAfter: mutation.endCauseAfter,
        reason:
          mutation.operation === "partial-consume"
            ? "BLOOM_PARTIALLY_CONSUMED_QUICKEN"
            : mutation.operation === "decay-rebase"
              ? "BLOOM_REBASED_QUICKEN_DECAY"
              : "BLOOM_REMOVED_QUICKEN"
      });
      if (
        mutation.operation === "partial-consume" ||
        mutation.operation === "decay-rebase"
      ) {
        const lifecycleTriggerDamageEventId =
          mutation.operation === "decay-rebase"
            ? existingSource?.triggerDamageEventId ??
              triggerDamageEventId
            : triggerDamageEventId;
        activeQuickenStateSources.set(targetId, {
          generation: mutation.generationAfter,
          actorId: lifecycleSourceActorId,
          triggerDamageEventId:
            lifecycleTriggerDamageEventId
        });
        if (mutation.endCauseAfter === "QUICKEN_DECAY") {
          scheduleQuickenExpiry(
            targetId,
            mutation.generationAfter,
            mutation.expiresAtFrameAfter
          );
        }
      } else {
        activeQuickenStateSources.delete(targetId);
      }
    }
  };

  const projectedQuickenDecayRebaseLogIds = (
    audit: ReactionAudit
  ): number[] => {
    let nextLogId = quickenStateLog.length;
    const projectedIds: number[] = [];
    if (audit.catalyzeReaction?.quicken != null) {
      nextLogId += 1;
    }
    for (const bloom of audit.bloomReactions) {
      const operation = bloom.quickenStateMutation.operation;
      if (operation === "none") continue;
      if (operation === "decay-rebase") {
        projectedIds.push(nextLogId);
      }
      nextLogId += 1;
    }
    const burningMutation =
      audit.burningReaction?.quickenStateMutation;
    if (
      burningMutation !== undefined &&
      burningMutation.operation !== "none"
    ) {
      if (burningMutation.operation === "decay-rebase") {
        projectedIds.push(nextLogId);
      }
    }
    return projectedIds;
  };

  const recordBurningQuickenStateMutation = ({
    audit,
    targetId,
    targetName,
    fallbackSourceActorId,
    fallbackTriggerDamageEventId,
    frame,
    timeSeconds
  }: {
    audit: ReactionAudit;
    targetId: string;
    targetName: string;
    fallbackSourceActorId: string;
    fallbackTriggerDamageEventId: number;
    frame: number;
    timeSeconds: number;
  }): number | null => {
    const mutation =
      audit.burningReaction?.quickenStateMutation;
    if (
      mutation === undefined ||
      mutation.operation === "none"
    ) {
      return null;
    }
    const existingSource =
      activeQuickenStateSources.get(targetId);
    const sourceActorId =
      existingSource?.actorId ?? fallbackSourceActorId;
    const triggerDamageEventId =
      existingSource?.triggerDamageEventId ??
      fallbackTriggerDamageEventId;
    const logId = quickenStateLog.length;
    quickenStateLog.push({
      id: logId,
      reaction: "quicken",
      generation: mutation.generationAfter,
      operation: mutation.operation,
      frame,
      timeSeconds,
      targetId,
      targetName,
      sourceActorId,
      triggerDamageEventId,
      triggerElement: null,
      consumedAuraElement: null,
      candidateGaugeUnits: 0,
      quickenGaugeUnitsBefore:
        mutation.quickenGaugeUnitsBefore,
      quickenGaugeUnitsAfter:
        mutation.quickenGaugeUnitsAfter,
      decayPerFrameBefore: mutation.decayPerFrameBefore,
      decayPerFrameAfter: mutation.decayPerFrameAfter,
      expiresAtFrameBefore: mutation.expiresAtFrameBefore,
      auraBefore: deepClone(mutation.operationAuraBefore),
      auraAfter: deepClone(mutation.operationAuraAfter),
      expiresAtFrame: mutation.expiresAtFrameAfter,
      endCauseBefore: mutation.endCauseBefore,
      endCauseAfter: mutation.endCauseAfter,
      reason:
        mutation.operation === "decay-rebase"
          ? "BURNING_REBASED_QUICKEN_DECAY"
          : "BURNING_REMOVED_QUICKEN"
    });
    if (mutation.operation === "decay-rebase") {
      activeQuickenStateSources.set(targetId, {
        generation: mutation.generationAfter,
        actorId: sourceActorId,
        triggerDamageEventId
      });
      if (mutation.endCauseAfter === "QUICKEN_DECAY") {
        scheduleQuickenExpiry(
          targetId,
          mutation.generationAfter,
          mutation.expiresAtFrameAfter
        );
      }
    } else {
      activeQuickenStateSources.delete(targetId);
    }
    return logId;
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
      triggerHitGroupId: null,
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
      sourceCoreId: null,
      sourceCoreLogId: null,
      selectionRadius: null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits: null,
      excludedTargetIds: [],
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
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

  const resolveSwirlDamageGroup = ({
    targetId,
    actorId,
    reaction,
    frame
  }: {
    targetId: string;
    actorId: string;
    reaction: SwirlReaction;
    frame: number;
  }): SwirlDamageGroupAudit => {
    const key = `${targetId}\u0000${actorId}\u0000${reaction}`;
    const previous = swirlDamageIcdStates.get(key);
    const state =
      previous === undefined ||
      frame - previous.windowStartFrame >= 30
        ? { windowStartFrame: frame, hitCount: 0 }
        : previous;
    const hitIndex = state.hitCount;
    const damageAllowed = hitIndex < 2;
    state.hitCount += 1;
    swirlDamageIcdStates.set(key, state);
    return {
      reaction,
      windowStartFrame: state.windowStartFrame,
      hitIndex,
      resetFrames: 30,
      sequence: [true, true, false],
      damageAllowed,
      blockedReason: damageAllowed
        ? null
        : "REACTION_A_DAMAGE_ICD"
    };
  };

  const scheduleSwirlAttacks = ({
    audits,
    actorId,
    action,
    triggerHitId,
    triggerHitGroupId,
    triggerDamageEventId,
    sourceTargetId,
    centerPosition,
    stats,
    reactionBonus,
    sourceBuffStatuses,
    snapshot,
    cycle,
    triggerFrame
  }: {
    audits: SwirlReactionAudit[];
    actorId: string;
    action: ActionDefinition;
    triggerHitId: string;
    triggerHitGroupId: string;
    triggerDamageEventId: number;
    sourceTargetId: string;
    centerPosition: { x: number; y: number } | null;
    stats: CharacterStats;
    reactionBonus: number;
    sourceBuffStatuses: ActiveStatusSnapshot[];
    snapshot: DamageEvent["snapshot"];
    cycle: number;
    triggerFrame: number;
  }): void => {
    for (const audit of audits) {
      const attacks = [
        {
          scheduleKind: "swirl-self" as const,
          damageFrame: audit.selfDamageFrame,
          targetingMode: "single-target" as const,
          centerPosition: null,
          radius: 0,
          baseMultiplier: audit.selfBaseMultiplier,
          application: undefined,
          excludedTargetIds: [] as string[]
        },
        {
          scheduleKind: "swirl-propagation" as const,
          damageFrame: audit.propagationDamageFrame,
          targetingMode: "radius" as const,
          centerPosition: deepClone(centerPosition),
          radius: audit.radius,
          baseMultiplier: audit.propagationBaseMultiplier,
          application: {
            gaugeUnits: audit.propagatedGaugeUnits,
            icdTag: audit.reaction,
            icdGroup: "no-icd"
          } satisfies ElementalApplication,
          excludedTargetIds: [sourceTargetId]
        }
      ];
      for (const attack of attacks) {
        const reactionDamageLogId = reactionDamageLog.length;
        const withinSimulation =
          audit.scheduled &&
          attack.damageFrame <= Math.round(config.duration * 60);
        reactionDamageLog.push({
          id: reactionDamageLogId,
          reaction: audit.reaction,
          triggerDamageEventId,
          triggerHitGroupId: null,
          sourceActorId: actorId,
          sourceTargetId,
          triggerFrame,
          damageFrame: attack.damageFrame,
          scheduled: audit.scheduled,
          withinSimulation,
          blockedReason: audit.blockedReason,
          nextAvailableFrame: audit.nextAvailableFrame,
          scheduleKind: attack.scheduleKind,
          targetingMode: attack.targetingMode,
          centerPosition: deepClone(attack.centerPosition),
          radius: attack.radius,
          sourceCoreId: null,
          sourceCoreLogId: null,
          selectionRadius: null,
          selectedTargetId: null,
          resolutionReason: null,
          applicationGaugeUnits:
            attack.application?.gaugeUnits ?? null,
          excludedTargetIds: deepClone(attack.excludedTargetIds),
          checkedTargetIds: [],
          hitTargetIds: [],
          unresolvedTargetIds: [],
          damageGroupBlockedTargetIds: [],
          damageEventIds: [],
          playerHitResolutionLogIds: [],
          playerDamageEventIds: [],
          reactionStatusLogIds: [],
          damageGroupDecisions: []
        });
        if (!withinSimulation) continue;
        push(attack.damageFrame / 60, "reactionDamage", {
          reaction: audit.reaction,
          damageElement: audit.swirledElement,
          strikeType: "default",
          poiseDamage: 0,
          statusEffect: null,
          actorId,
          action,
          triggerHitId,
          triggerHitGroupId,
          triggerDamageEventId,
          sourceTargetId,
          targetingMode: attack.targetingMode,
          centerPosition: deepClone(attack.centerPosition),
          radius: attack.radius,
          baseMultiplier: attack.baseMultiplier,
          stats: deepClone(stats),
          elementalMastery: stats.em,
          reactionBonus,
          sourceBuffStatuses: deepClone(sourceBuffStatuses),
          snapshot,
          cycle,
          reactionDamageLogId,
          ...(attack.application === undefined
            ? {}
            : { application: deepClone(attack.application) }),
          excludedTargetIds: deepClone(attack.excludedTargetIds),
          swirlContext: {
            scheduleKind: attack.scheduleKind,
            reaction: audit.reaction,
            reactionBonusDelta:
              reactionBonus - stats.reactionBonus
          }
        } satisfies ReactionDamageEventPayload);
      }
    }
  };

  const scheduleCrystallizeShard = ({
    audit,
    actorId,
    sourceTargetId,
    triggerDamageEventId,
    triggerFrame
  }: {
    audit: CrystallizeReactionAudit;
    actorId: string;
    sourceTargetId: string;
    triggerDamageEventId: number;
    triggerFrame: number;
  }): void => {
    if (!audit.scheduled) return;
    push(audit.shardSpawnFrame / 60, "crystallizeShardSpawn", {
      audit: deepClone(audit),
      actorId,
      sourceTargetId,
      triggerDamageEventId,
      triggerFrame
    } satisfies CrystallizeShardSpawnEventPayload);
  };

  const processBurningConsequences = ({
    audit,
    damageEventId,
    actorId,
    action,
    hitId,
    hitGroupId,
    targetId,
    targetName,
    stats,
    reactionBonus,
    sourceBuffStatuses,
    snapshot,
    cycle,
    frame,
    timeSeconds,
    eventPriority,
    eventSequence
  }: {
    audit: ReactionAudit;
    damageEventId: number;
    actorId: string;
    action: ActionDefinition;
    hitId: string;
    hitGroupId: string;
    targetId: string;
    targetName: string;
    stats: CharacterStats | undefined;
    reactionBonus: number;
    sourceBuffStatuses: ActiveStatusSnapshot[];
    snapshot: DamageEvent["snapshot"];
    cycle: number;
    frame: number;
    timeSeconds: number;
    eventPriority: number;
    eventSequence: number;
  }): void => {
    const burningReaction = audit.burningReaction;
    if (burningReaction !== null) {
      recordBurningQuickenStateMutation({
        audit,
        targetId,
        targetName,
        fallbackSourceActorId: actorId,
        fallbackTriggerDamageEventId: damageEventId,
        frame,
        timeSeconds
      });
      if (burningReaction.operation === "stop") {
        const activeSource = activeBurningSources.get(targetId);
        burningStateLog.push({
          id: burningStateLog.length,
          reaction: "burning",
          generation:
            activeSource?.generation ?? burningReaction.generation,
          operation: "stop",
          frame,
          timeSeconds,
          eventPriority,
          eventSequence,
          targetId,
          targetName,
          triggerElement: burningReaction.triggerElement,
          damageSourceActorId:
            activeSource?.actorId ??
            burningReaction.damageSourceActorId,
          fuelSourceActorId:
            activeSource?.fuelSourceActorId ??
            burningReaction.fuelSourceActorId,
          triggerDamageEventId: damageEventId,
          reactionDamageLogId: null,
          damageEventIds: [],
          playerHitResolutionLogId: null,
          playerDamageEventId: null,
          tickIndex: null,
          tickSkipped: false,
          skipReason: null,
          damageAllowed: null,
          burningGaugeUnitsBefore:
            burningReaction.burningGaugeUnitsBefore,
          burningGaugeUnitsAfter:
            burningReaction.burningGaugeUnitsAfter,
          fuelGaugeUnitsBefore:
            burningReaction.fuelGaugeUnitsBefore,
          fuelGaugeUnitsAfter:
            burningReaction.fuelGaugeUnitsAfter,
          fuelDecayPerFrame:
            burningReaction.fuelDecayPerFrame,
          fuelExpiresAtFrame:
            burningReaction.fuelExpiresAtFrame,
          auraBefore: deepClone(audit.auraBefore ?? []),
          auraApplied: deepClone(audit.auraApplied ?? []),
          auraConsumed: deepClone(audit.auraConsumed ?? []),
          auraAfter: deepClone(audit.auraAfter ?? []),
          nextTickFrame: null,
          clockModel: "target-local-no-hitlag",
          hitlagStatus: "unsupported-enemy-hitlag",
          icdGroup: "burning",
          icdTag: "burning-application",
          icdScope: "global-target",
          icdWindowStartFrame: null,
          icdHitIndex: null,
          icdResetFrames:
            AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
          icdApplicationSequence:
            AURA_ENGINE_CONSTANTS.burningIcdSequence,
          applicationAllowed: null,
          applicationBlockedReason: null,
          selfDamageStatus: playerSelfDamageStatus,
          reason:
            burningReaction.stopReason ??
            "BURNING_AURA_CONSUMED"
        });
        activeBurningSources.delete(targetId);
        return;
      }
      if (stats === undefined) {
        throw new Error(
          `Burning source stats for "${actorId}" could not be resolved.`
        );
      }
      if (
        burningReaction.triggerElement !== "pyro" &&
        burningReaction.triggerElement !== "dendro"
      ) {
        throw new Error(
          `Burning ${burningReaction.operation} requires a Pyro or Dendro trigger; got "${burningReaction.triggerElement}".`
        );
      }
      const burningSource: BurningSourceSnapshot = {
        generation: burningReaction.generation,
        actorId,
        action,
        triggerHitId: hitId,
        triggerHitGroupId: hitGroupId,
        triggerDamageEventId: damageEventId,
        triggerFrame: frame,
        triggerElement: burningReaction.triggerElement,
        fuelSourceActorId: burningReaction.fuelSourceActorId,
        fuelDecayPerFrame: burningReaction.fuelDecayPerFrame,
        fuelExpiresAtFrame: burningReaction.fuelExpiresAtFrame,
        stats: deepClone(stats),
        elementalMastery: stats.em,
        reactionBonus,
        sourceBuffStatuses: deepClone(sourceBuffStatuses),
        // Burning always snapshots the triggering frame's live stats. It must
        // not inherit an action-snapshot mode from the attack that started or
        // refreshed the stream.
        snapshot: "hit",
        cycle
      };
      activeBurningSources.set(targetId, burningSource);
      burningStateLog.push({
        id: burningStateLog.length,
        reaction: "burning",
        generation: burningReaction.generation,
        operation: burningReaction.operation,
        frame,
        timeSeconds,
        eventPriority,
        eventSequence,
        targetId,
        targetName,
        triggerElement: burningReaction.triggerElement,
        damageSourceActorId: actorId,
        fuelSourceActorId: burningReaction.fuelSourceActorId,
        triggerDamageEventId: damageEventId,
        reactionDamageLogId: null,
        damageEventIds: [],
        playerHitResolutionLogId: null,
        playerDamageEventId: null,
        tickIndex: null,
        tickSkipped: false,
        skipReason: null,
        damageAllowed: null,
        burningGaugeUnitsBefore:
          burningReaction.burningGaugeUnitsBefore,
        burningGaugeUnitsAfter:
          burningReaction.burningGaugeUnitsAfter,
        fuelGaugeUnitsBefore:
          burningReaction.fuelGaugeUnitsBefore,
        fuelGaugeUnitsAfter:
          burningReaction.fuelGaugeUnitsAfter,
        fuelDecayPerFrame: burningReaction.fuelDecayPerFrame,
        fuelExpiresAtFrame:
          burningReaction.fuelExpiresAtFrame,
        auraBefore: deepClone(audit.auraBefore ?? []),
        auraApplied: deepClone(audit.auraApplied ?? []),
        auraConsumed: deepClone(audit.auraConsumed ?? []),
        auraAfter: deepClone(audit.auraAfter ?? []),
        nextTickFrame: burningReaction.nextTickFrame,
        clockModel: "target-local-no-hitlag",
        hitlagStatus: "unsupported-enemy-hitlag",
        icdGroup: "burning",
        icdTag: "burning-application",
        icdScope: "global-target",
        icdWindowStartFrame: null,
        icdHitIndex: null,
        icdResetFrames:
          AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
        icdApplicationSequence:
          AURA_ENGINE_CONSTANTS.burningIcdSequence,
        // The application ICD belongs to the originating Burning tick and is
        // recorded on that tick row (and the per-target reaction audit).
        // Start/refresh rows only describe the resulting stream state.
        applicationAllowed: null,
        applicationBlockedReason: null,
        selfDamageStatus: playerSelfDamageStatus,
        reason: null
      });
      scheduleBurningFuelExpiry(
        targetId,
        burningReaction.generation,
        burningReaction.fuelExpiresAtFrame
      );
      if (
        burningReaction.operation === "start" &&
        burningReaction.firstTickFrame !== null
      ) {
        push(
          burningReaction.firstTickFrame / 60,
          "burningTick",
          {
            targetId,
            generation: burningReaction.generation,
            tickIndex: 1
          } satisfies BurningTickEventPayload,
          burningTickPriorityForTarget(targetId)
        );
      }
      return;
    }

    const activeSource = activeBurningSources.get(targetId);
    if (activeSource === undefined) return;
    const auraAfter = audit.auraAfter ?? [];
    const burningStillPresent = auraAfter.some(
      (entry) => entry.element === "burning"
    );
    const fuelStillPresent = auraAfter.some(
      (entry) => entry.element === "burningFuel"
    );
    if (burningStillPresent && fuelStillPresent) return;

    const auraBefore = audit.auraBefore ?? [];
    burningStateLog.push({
      id: burningStateLog.length,
      reaction: "burning",
      generation: activeSource.generation,
      operation: "stop",
      frame,
      timeSeconds,
      eventPriority,
      eventSequence,
      targetId,
      targetName,
      triggerElement: null,
      damageSourceActorId: activeSource.actorId,
      fuelSourceActorId: activeSource.fuelSourceActorId,
      triggerDamageEventId: damageEventId,
      reactionDamageLogId: null,
      damageEventIds: [],
      playerHitResolutionLogId: null,
      playerDamageEventId: null,
      tickIndex: null,
      tickSkipped: false,
      skipReason: null,
      damageAllowed: null,
      burningGaugeUnitsBefore:
        auraBefore.find((entry) => entry.element === "burning")
          ?.gaugeUnits ?? 0,
      burningGaugeUnitsAfter:
        auraAfter.find((entry) => entry.element === "burning")
          ?.gaugeUnits ?? 0,
      fuelGaugeUnitsBefore:
        auraBefore.find(
          (entry) => entry.element === "burningFuel"
        )?.gaugeUnits ?? 0,
      fuelGaugeUnitsAfter:
        auraAfter.find(
          (entry) => entry.element === "burningFuel"
        )?.gaugeUnits ?? 0,
      fuelDecayPerFrame: activeSource.fuelDecayPerFrame,
      fuelExpiresAtFrame: null,
      auraBefore: deepClone(auraBefore),
      auraApplied: deepClone(audit.auraApplied ?? []),
      auraConsumed: deepClone(audit.auraConsumed ?? []),
      auraAfter: deepClone(auraAfter),
      nextTickFrame: null,
      clockModel: "target-local-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      icdGroup: "burning",
      icdTag: "burning-application",
      icdScope: "global-target",
      icdWindowStartFrame: null,
      icdHitIndex: null,
      icdResetFrames:
        AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
      icdApplicationSequence:
        AURA_ENGINE_CONSTANTS.burningIcdSequence,
      applicationAllowed: null,
      applicationBlockedReason: null,
      selfDamageStatus: playerSelfDamageStatus,
      reason: "BURNING_AURA_CONSUMED"
    });
    activeBurningSources.delete(targetId);
  };

  const processNestedAuraReactionConsequences = ({
    audit,
    damageEventId,
    actorId,
    action,
    hitId,
    hitGroupId,
    targetId,
    targetName,
    targetPosition,
    stats,
    reactionBonus,
    sourceBuffStatuses,
    snapshot,
    cycle,
    frame,
    timeSeconds,
    freezeResistance,
    eventPriority,
    eventSequence,
    nextIntraEventSequence
  }: {
    audit: ReactionAudit;
    damageEventId: number;
    actorId: string;
    action: ActionDefinition;
    hitId: string;
    hitGroupId: string;
    targetId: string;
    targetName: string;
    targetPosition: { x: number; y: number } | null;
    stats: CharacterStats;
    reactionBonus: number;
    sourceBuffStatuses: ActiveStatusSnapshot[];
    snapshot: DamageEvent["snapshot"];
    cycle: number;
    frame: number;
    timeSeconds: number;
    freezeResistance: number;
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    const liveBurningStats =
      audit.burningReaction !== null &&
      audit.burningReaction.operation !== "stop"
        ? (computeStats(actorId, timeSeconds) ?? stats)
        : stats;
    const burningReactionBonusDelta =
      reactionBonus - stats.reactionBonus;
    const liveBurningReactionBonus =
      liveBurningStats.reactionBonus + burningReactionBonusDelta;
    const liveBurningSourceBuffStatuses =
      audit.burningReaction !== null &&
      audit.burningReaction.operation !== "stop"
        ? activeBuffs
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
            }))
        : sourceBuffStatuses;
    if (
      audit.catalyzeReaction?.quicken != null ||
      audit.bloomReactions.length > 0
    ) {
      recordQuickenState({
        audit,
        targetId,
        targetName,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        frame,
        timeSeconds
      });
    }
    if (audit.bloomReactions.length > 0) {
      scheduleBloomCoreSpawns({
        audits: audit.bloomReactions,
        actorId,
        action,
        triggerHitId: hitId,
        triggerHitGroupId: hitGroupId,
        triggerDamageEventId: damageEventId,
        sourceTargetId: targetId,
        reactionBonusDelta: reactionBonus - stats.reactionBonus,
        cycle,
        eventType: "reactionDamage",
        eventPriority,
        eventSequence,
        nextIntraEventSequence
      });
    }
    processBurningConsequences({
      audit,
      damageEventId,
      actorId,
      action,
      hitId,
      hitGroupId,
      targetId,
      targetName,
      stats: liveBurningStats,
      reactionBonus: liveBurningReactionBonus,
      sourceBuffStatuses: liveBurningSourceBuffStatuses,
      snapshot: "hit",
      cycle,
      frame,
      timeSeconds,
      eventPriority,
      eventSequence
    });
    const transformativeReaction = audit.transformativeReaction;
    if (transformativeReaction !== null) {
      const liveReactionStats = computeStats(
        actorId,
        timeSeconds
      );
      if (liveReactionStats === undefined) {
        throw new Error(
          `Nested reaction source stats for "${actorId}" could not be resolved at frame ${frame}.`
        );
      }
      const reactionBonusDelta =
        reactionBonus - stats.reactionBonus;
      const liveReactionBonus =
        liveReactionStats.reactionBonus + reactionBonusDelta;
      const liveReactionSourceBuffStatuses = activeBuffs
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
      const reactionDamageLogId = reactionDamageLog.length;
      const withinSimulation =
        transformativeReaction.scheduled &&
        transformativeReaction.damageFrame <=
          Math.round(config.duration * 60);
      reactionDamageLog.push({
        id: reactionDamageLogId,
        reaction: transformativeReaction.reaction,
        triggerDamageEventId: damageEventId,
        triggerHitGroupId: null,
        sourceActorId: actorId,
        sourceTargetId: targetId,
        triggerFrame: frame,
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
        sourceCoreId: null,
        sourceCoreLogId: null,
        selectionRadius: null,
        selectedTargetId: null,
        resolutionReason: null,
        applicationGaugeUnits: null,
        excludedTargetIds: [],
        checkedTargetIds: [],
        hitTargetIds: [],
        unresolvedTargetIds: [],
        damageGroupBlockedTargetIds: [],
        damageEventIds: [],
        playerHitResolutionLogIds: [],
        playerDamageEventIds: [],
        reactionStatusLogIds: [],
        damageGroupDecisions: []
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
            baseMultiplier:
              transformativeReaction.baseMultiplier,
            stats: deepClone(liveReactionStats),
            elementalMastery: liveReactionStats.em,
            reactionBonus: liveReactionBonus,
            sourceBuffStatuses:
              deepClone(liveReactionSourceBuffStatuses),
            snapshot: "hit",
            cycle,
            reactionDamageLogId
          } satisfies ReactionDamageEventPayload
        );
      }
    }

    const frozenReaction = audit.frozenReaction;
    if (frozenReaction !== null) {
      const frozenConsumptionExtent =
        frozenReaction.frozenGaugeAfter <= 0
          ? "FROZEN_CONSUMED"
          : "FROZEN_PARTIALLY_CONSUMED";
      const reason =
        frozenReaction.operation === "immune"
          ? "FREEZE_RESISTANCE_IMMUNE"
          : frozenReaction.operation === "consume"
            ? audit.reaction === "swirlCryo"
              ? `${frozenConsumptionExtent}_BY_SWIRL`
              : `${frozenConsumptionExtent}_BY_${
                  audit.reaction === "melt"
                    ? "MELT"
                    : "SUPERCONDUCT"
                }`
            : null;
      frozenStateLog.push({
        id: frozenStateLog.length,
        reaction:
          audit.reaction === "melt"
            ? "melt"
            : audit.reaction === "superconduct"
              ? "superconduct"
              : audit.reaction === "swirlCryo"
                ? "swirlCryo"
                : "freeze",
        generation: frozenReaction.generation,
        operation: frozenReaction.operation,
        frame,
        timeSeconds,
        targetId,
        targetName,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        freezeResistance: frozenReaction.freezeResistance,
        generatedGaugeUnits:
          frozenReaction.generatedGaugeUnits,
        consumedGaugeUnits:
          frozenReaction.consumedGaugeUnits,
        auraBefore: deepClone(audit.auraBefore ?? []),
        auraAfter: deepClone(audit.auraAfter ?? []),
        expiresAtFrame: frozenReaction.expiresAtFrame,
        reason
      });
      if (
        frozenReaction.operation === "start" ||
        frozenReaction.operation === "refresh"
      ) {
        activeFrozenStateSources.set(targetId, {
          generation: frozenReaction.generation,
          actorId,
          triggerDamageEventId: damageEventId
        });
      } else if (frozenReaction.operation === "consume") {
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

    const periodicReaction = audit.periodicReaction;
    if (periodicReaction === null) return;
    if (periodicReaction.operation === "stop") {
      periodicReactionLog.push({
        id: periodicReactionLog.length,
        reaction: periodicReaction.reaction,
        generation: periodicReaction.generation,
        operation: "stop",
        frame,
        timeSeconds,
        targetId,
        targetName,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        reactionDamageLogId: null,
        damageEventId: null,
        tickIndex: null,
        auraBefore: deepClone(audit.auraBefore ?? []),
        auraConsumed: deepClone(audit.auraConsumed ?? []),
        auraAfter: deepClone(audit.auraAfter ?? []),
        nextTickFrame: null,
        coexistenceExpiresAtFrame: null,
        waneFrame: null,
        reason: "COEXISTING_AURA_REMOVED_BY_HIT"
      });
      const activeSource =
        activePeriodicReactionSources.get(targetId);
      if (
        activeSource?.generation === periodicReaction.generation
      ) {
        activePeriodicReactionSources.delete(targetId);
      }
      return;
    }

    const livePeriodicStats = computeStats(
      actorId,
      timeSeconds
    );
    if (livePeriodicStats === undefined) {
      throw new Error(
        `Nested periodic reaction source stats for "${actorId}" could not be resolved at frame ${frame}.`
      );
    }
    const periodicReactionBonusDelta =
      reactionBonus - stats.reactionBonus;
    const livePeriodicSourceBuffStatuses = activeBuffs
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
      triggerFrame: frame,
      stats: deepClone(livePeriodicStats),
      elementalMastery: livePeriodicStats.em,
      reactionBonus:
        livePeriodicStats.reactionBonus +
        periodicReactionBonusDelta,
      sourceBuffStatuses: deepClone(
        livePeriodicSourceBuffStatuses
      ),
      snapshot: "hit",
      cycle
    };
    activePeriodicReactionSources.set(targetId, periodicSource);
    const periodicReactionLogId = periodicReactionLog.length;
    periodicReactionLog.push({
      id: periodicReactionLogId,
      reaction: periodicReaction.reaction,
      generation: periodicReaction.generation,
      operation: periodicReaction.operation,
      frame,
      timeSeconds,
      targetId,
      targetName,
      sourceActorId: actorId,
      triggerDamageEventId: damageEventId,
      reactionDamageLogId: null,
      damageEventId: null,
      tickIndex: null,
      auraBefore: deepClone(audit.auraBefore ?? []),
      auraConsumed: [],
      auraAfter: deepClone(audit.auraAfter ?? []),
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

  const processDendroCoreContacts = ({
    actorId,
    action,
    hitId,
    hitGroupId,
    element,
    application,
    reactionBonusDelta,
    hitResolutionLogIds,
    triggerDamageEventIds,
    triggerReactionDamageLogId,
    resolvedGeometry,
    cycle,
    frame,
    eventType,
    eventPriority,
    eventSequence,
    nextIntraEventSequence
  }: {
    actorId: string;
    action: ActionDefinition;
    hitId: string;
    hitGroupId: string;
    element: Element;
    application: ElementalApplication | undefined;
    reactionBonusDelta: number;
    hitResolutionLogIds: number[];
    triggerDamageEventIds: number[];
    triggerReactionDamageLogId: number | null;
    resolvedGeometry: ResolvedWorldHitGeometry | null;
    cycle: number;
    frame: number;
    eventType: "hit" | "reactionDamage";
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    if (
      config.reactionEngine?.mode !== "aura-v5" ||
      (element !== "pyro" && element !== "electro") ||
      application === undefined ||
      application.gaugeUnits <= 0
    ) {
      return;
    }
    const activeCores = dendroCoreManager.snapshots();
    if (activeCores.length === 0) return;

    const contactLogId = dendroCoreContactLog.length;
    const checkedCoreIds = activeCores.map((core) => core.coreId);
    const contactedCores =
      resolvedGeometry === null
        ? []
        : activeCores.filter((core) =>
            resolveHitGeometry(
              resolvedGeometry,
              core.position,
              core.hitboxRadius
            ).landed
          );
    const contactedCoreIds: number[] = [];
    const removalLogIds: number[] = [];
    const reactionDamageLogIds: number[] = [];
    for (const core of contactedCores) {
      const removalDecision = dendroCoreManager.consume(
        core.coreId,
        frame,
        element
      );
      if (removalDecision === null) continue;
      const scheduled = scheduleDendroCoreDamage({
        decision: removalDecision,
        damageSourceActorId: actorId,
        action,
        triggerHitId: hitId,
        triggerHitGroupId: hitGroupId,
        triggerDamageEventId:
          triggerDamageEventIds[0] ?? null,
        reactionBonusDelta,
        cycle,
        contactLogId,
        contactEventType: eventType,
        removalFrame: frame,
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence()
      });
      contactedCoreIds.push(core.coreId);
      removalLogIds.push(scheduled.removalLogId);
      reactionDamageLogIds.push(
        scheduled.reactionDamageLogId
      );
      appendDendroCoreTimelinePoint({
        frame,
        eventType,
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence(),
        operation: "consume",
        dendroCoreLogId: scheduled.removalLogId,
        coreId: core.coreId
      });
      dendroCoreRuntimeSources.delete(core.coreId);
    }
    dendroCoreContactLog.push({
      id: contactLogId,
      frame,
      timeSeconds: frame / 60,
      eventType,
      eventPriority,
      eventSequence,
      intraEventSequence: nextIntraEventSequence(),
      sourceActorId: actorId,
      sourceActionId: action.id,
      hitId,
      hitGroupId,
      triggerElement: element,
      reaction: element === "pyro" ? "burgeon" : "hyperbloom",
      hitResolutionLogIds: [...hitResolutionLogIds],
      triggerDamageEventIds: [...triggerDamageEventIds],
      triggerReactionDamageLogId,
      resolvedGeometry:
        resolvedGeometry === null
          ? null
          : deepClone(resolvedGeometry),
      checkedCoreIds,
      contactedCoreIds,
      removalLogIds,
      reactionDamageLogIds,
      blockedReason:
        resolvedGeometry === null
          ? "MISSING_EXPLICIT_GEOMETRY"
          : null
    });
  };

  const completeHitTarget = ({
    actorId,
    action,
    hit,
    hitId,
    hitGroupId,
    element,
    cycle,
    frame,
    timeSeconds,
    targetId,
    targetResolutionId,
    damageEventId,
    targetIndex,
    targetCount,
    landed,
    hitConfirmAllowed,
    resolvedGeometry,
    eventSequence,
    nextIntraEventSequence
  }: {
    actorId: string;
    action: ActionDefinition;
    hit: HitDefinition;
    hitId: string;
    hitGroupId: string;
    element: Element;
    cycle: number;
    frame: number;
    timeSeconds: number;
    targetId: string;
    targetResolutionId: number;
    damageEventId: number | null;
    targetIndex: number;
    targetCount: number;
    landed: boolean;
    hitConfirmAllowed: boolean;
    resolvedGeometry: ResolvedWorldHitGeometry | null;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    const aggregate = hitCallbackAggregates.get(hitGroupId) ?? {
      checkedTargetIds: [],
      confirmedTargetIds: [],
      hitResolutionLogIds: [],
      triggerDamageEventIds: [],
      resolvedGeometry,
      landed: false
    };
    aggregate.checkedTargetIds.push(targetId);
    aggregate.hitResolutionLogIds.push(targetResolutionId);
    if (damageEventId !== null) {
      aggregate.triggerDamageEventIds.push(damageEventId);
    }
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
    if (config.reactionEngine?.mode === "aura-v5") {
      processDendroCoreContacts({
        actorId,
        action,
        hitId,
        hitGroupId,
        element,
        application: hit.application,
        reactionBonusDelta: safeNumber(hit.reactionBonus),
        hitResolutionLogIds: aggregate.hitResolutionLogIds,
        triggerDamageEventIds: aggregate.triggerDamageEventIds,
        triggerReactionDamageLogId: null,
        resolvedGeometry: aggregate.resolvedGeometry,
        cycle,
        frame,
        eventType: "hit",
        eventPriority: EVENT_PRIORITY.hit,
        eventSequence,
        nextIntraEventSequence
      });
    }
    hitCallbackAggregates.delete(hitGroupId);
  };

  while (queue.size > 0) {
    const event = queue.pop();
    if (!event) break;
    const timeSeconds = event.timeSeconds;
    if (timeSeconds > config.duration + 1e-9) break;
    const preservesDedicatedAuraExpiryBoundary =
      event.type === "frozenExpiry" ||
      event.type === "quickenExpiry" ||
      event.type === "periodicReactionExpiry" ||
      event.type === "burningFuelExpiry";
    // Priority 0..2 events run before target-local Aura expiry boundaries.
    // Advancing the shared Aura engine through the current frame for an
    // action/buff/energy event could otherwise consume Quicken, Fuel, or
    // Frozen before its authoritative priority-2 lifecycle event records it.
    // By the time a hit (priority 3) or damage tick runs, current-frame
    // ordinary Aura expiries are materialized at their exact frame.
    const includeCurrentFrameNaturalAuraExpiry =
      !preservesDedicatedAuraExpiryBoundary &&
      event.priority > EVENT_PRIORITY.quickenExpiry;
    recordNaturalAuraExpiries(
      event.frame,
      includeCurrentFrameNaturalAuraExpiry
    );
    cleanup(timeSeconds);
    let intraEventSequence = 0;
    const nextIntraEventSequence = (): number =>
      intraEventSequence++;

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
          resolvedGeometry: ResolvedWorldHitGeometry | null;
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
                geometryThreshold: null,
                resolvedGeometry: null
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
                  geometryThreshold: geometryResolution.threshold,
                  resolvedGeometry: deepClone(resolvedGeometry)
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

    if (event.type === "dendroCoreSpawn") {
      const { reservation } =
        event.payload as DendroCoreSpawnEventPayload;
      const runtimeSource = dendroCoreRuntimeSources.get(
        reservation.coreId
      );
      const target = enemyTargetById.get(
        reservation.sourceTargetId
      );
      const targetPosition = resolveTargetPosition(
        reservation.sourceTargetId,
        event.frame
      );
      if (
        runtimeSource === undefined ||
        target === undefined ||
        targetPosition === null
      ) {
        throw new Error(
          `Dendro core ${reservation.coreId} could not resolve its source target at spawn.`
        );
      }
      const spawnDecision = dendroCoreManager.spawn({
        reservation,
        frame: event.frame,
        targetPosition,
        targetHitboxRadius: target.hitboxRadius
      });
      const postSpawnSnapshots = dendroCoreSnapshots();
      const preSpawnSnapshots = postSpawnSnapshots.filter(
        (snapshot) =>
          snapshot.coreId !== spawnDecision.spawned.coreId
      );
      for (const evictedCore of spawnDecision.evicted) {
        const evictedRuntimeSource =
          dendroCoreRuntimeSources.get(evictedCore.coreId);
        if (evictedRuntimeSource === undefined) {
          throw new Error(
            `Evicted Dendro core ${evictedCore.coreId} lost its runtime source.`
          );
        }
        const removalDecision =
          dendroCoreManager.makeEvictionDecision(
            evictedCore,
            event.frame
          );
        const scheduled = scheduleDendroCoreDamage({
          decision: removalDecision,
          damageSourceActorId: evictedCore.sourceActorId,
          action: evictedRuntimeSource.action,
          triggerHitId: evictedRuntimeSource.triggerHitId,
          triggerHitGroupId:
            evictedRuntimeSource.triggerHitGroupId,
          triggerDamageEventId:
            evictedCore.originDamageEventId,
          reactionBonusDelta:
            evictedRuntimeSource.reactionBonusDelta,
          cycle: evictedRuntimeSource.cycle,
          contactLogId: null,
          contactEventType: null,
          removalFrame: event.frame,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: nextIntraEventSequence()
        });
        appendDendroCoreTimelinePoint({
          frame: event.frame,
          eventType: "dendroCoreSpawn",
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: nextIntraEventSequence(),
          operation: "evict",
          dendroCoreLogId: scheduled.removalLogId,
          coreId: evictedCore.coreId,
          activeCores: preSpawnSnapshots
        });
        dendroCoreRuntimeSources.delete(evictedCore.coreId);
      }
      const spawnLogId = dendroCoreLog.length;
      dendroCoreLog.push({
        id: spawnLogId,
        coreId: spawnDecision.spawned.coreId,
        operation: "spawn",
        eventType: "dendroCoreSpawn",
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        sourceActorId: spawnDecision.spawned.sourceActorId,
        sourceTargetId: spawnDecision.spawned.sourceTargetId,
        originDamageEventId:
          spawnDecision.spawned.originDamageEventId,
        triggerFrame: spawnDecision.spawned.triggerFrame,
        coreDurationFrames: DENDRO_CORE_CONSTANTS.durationFrames,
        hitboxRadius: DENDRO_CORE_CONSTANTS.hitboxRadius,
        maxActiveCores: DENDRO_CORE_CONSTANTS.maxActiveCores,
        clockModel: "global-frame-no-hitlag",
        hitlagStatus: "unsupported-enemy-hitlag",
        mechanicsDataStatus:
          DENDRO_CORE_CONSTANTS.mechanicsDataStatus,
        selfDamageStatus: playerSelfDamageStatus,
        spawnedAtFrame: spawnDecision.spawned.spawnedAtFrame,
        expiresAtFrame: spawnDecision.spawned.expiresAtFrame,
        position: deepClone(spawnDecision.spawned.position),
        spawnRadius: spawnDecision.spawned.spawnRadius,
        spawnAngleDegrees:
          spawnDecision.spawned.spawnAngleDegrees,
        positionRandomRoll:
          spawnDecision.spawned.positionRandomRoll,
        rngStream: "dendro-core-position-v1",
        reason: "SPAWNED"
      });
      appendDendroCoreTimelinePoint({
        frame: event.frame,
        eventType: "dendroCoreSpawn",
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        operation: "spawn",
        dendroCoreLogId: spawnLogId,
        coreId: spawnDecision.spawned.coreId
      });
      push(
        spawnDecision.spawned.expiresAtFrame / 60,
        "dendroCoreExpiry",
        {
          coreId: spawnDecision.spawned.coreId,
          expectedExpiryFrame:
            spawnDecision.spawned.expiresAtFrame
        } satisfies DendroCoreExpiryEventPayload
      );
      continue;
    }

    if (event.type === "dendroCoreExpiry") {
      const { coreId, expectedExpiryFrame } =
        event.payload as DendroCoreExpiryEventPayload;
      if (event.frame !== expectedExpiryFrame) {
        throw new Error(
          `Dendro core ${coreId} expiry event resolved at the wrong frame.`
        );
      }
      const runtimeSource = dendroCoreRuntimeSources.get(coreId);
      const removalDecision = dendroCoreManager.expire(
        coreId,
        event.frame
      );
      if (removalDecision === null) continue;
      if (runtimeSource === undefined) {
        throw new Error(
          `Expired Dendro core ${coreId} lost its runtime source.`
        );
      }
      const scheduled = scheduleDendroCoreDamage({
        decision: removalDecision,
        damageSourceActorId:
          removalDecision.core.sourceActorId,
        action: runtimeSource.action,
        triggerHitId: runtimeSource.triggerHitId,
        triggerHitGroupId: runtimeSource.triggerHitGroupId,
        triggerDamageEventId:
          removalDecision.core.originDamageEventId,
        reactionBonusDelta: runtimeSource.reactionBonusDelta,
        cycle: runtimeSource.cycle,
        contactLogId: null,
        contactEventType: null,
        removalFrame: event.frame,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence()
      });
      appendDendroCoreTimelinePoint({
        frame: event.frame,
        eventType: "dendroCoreExpiry",
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        operation: "expire",
        dendroCoreLogId: scheduled.removalLogId,
        coreId
      });
      dendroCoreRuntimeSources.delete(coreId);
      continue;
    }

    if (event.type === "crystallizeShardSpawn") {
      const {
        audit,
        actorId,
        sourceTargetId,
        triggerDamageEventId,
        triggerFrame
      } = event.payload as CrystallizeShardSpawnEventPayload;
      const actor = characters.get(actorId);
      const target = enemyTargetById.get(sourceTargetId);
      const stats = computeStats(actorId, timeSeconds);
      if (!actor || !target || !stats) continue;

      while (
        activeCrystallizeShards.size >=
        CRYSTALLIZE_CONSTANTS.maxActiveShards
      ) {
        const oldest = [...activeCrystallizeShards.values()].sort(
          (left, right) =>
            left.spawnedAtFrame - right.spawnedAtFrame ||
            left.id - right.id
        )[0];
        if (oldest === undefined) break;
        activeCrystallizeShards.delete(oldest.id);
        crystallizeShardLog.push({
          id: crystallizeShardLog.length,
          operation: "evict",
          frame: event.frame,
          timeSeconds,
          shardId: oldest.id,
          reaction: oldest.reaction,
          element: oldest.element,
          sourceActorId: oldest.sourceActorId,
          sourceTargetId: oldest.sourceTargetId,
          triggerDamageEventId: oldest.triggerDamageEventId,
          triggerFrame: oldest.triggerFrame,
          spawnedAtFrame: oldest.spawnedAtFrame,
          earliestPickupFrame: oldest.earliestPickupFrame,
          expiresAtFrame: oldest.expiresAtFrame,
          position: deepClone(oldest.position),
          spawnRadius: oldest.spawnRadius,
          spawnAngleDegrees: oldest.spawnAngleDegrees,
          sourceCharacterLevel: oldest.sourceCharacterLevel,
          sourceElementalMastery:
            oldest.sourceElementalMastery,
          pickupCommandIndex: null,
          pickedUpByActorId: null,
          shieldLogId: null,
          success: true,
          reason: "ACTIVE_SHARD_LIMIT"
        });
      }

      const centerPosition = resolveTargetPosition(
        sourceTargetId,
        event.frame
      );
      const spawnRadius = target.hitboxRadius + 0.5;
      const spawnAngleDegrees = crystallizeRandom.next() * 360;
      const radians = (spawnAngleDegrees * Math.PI) / 180;
      const position =
        centerPosition === null
          ? null
          : {
              x: centerPosition.x + Math.cos(radians) * spawnRadius,
              y: centerPosition.y + Math.sin(radians) * spawnRadius
            };
      const shard: ActiveCrystallizeShard = {
        id: nextCrystallizeShardId++,
        reaction: audit.reaction,
        element: audit.crystallizedElement,
        sourceActorId: actorId,
        sourceTargetId,
        triggerDamageEventId,
        triggerFrame,
        spawnedAtFrame: event.frame,
        earliestPickupFrame: audit.earliestPickupFrame,
        expiresAtFrame: audit.shardExpiresAtFrame,
        position,
        spawnRadius,
        spawnAngleDegrees,
        sourceCharacterLevel: actor.level,
        sourceElementalMastery: stats.em
      };
      activeCrystallizeShards.set(shard.id, shard);
      crystallizeShardLog.push({
        id: crystallizeShardLog.length,
        operation: "spawn",
        frame: event.frame,
        timeSeconds,
        shardId: shard.id,
        reaction: shard.reaction,
        element: shard.element,
        sourceActorId: shard.sourceActorId,
        sourceTargetId: shard.sourceTargetId,
        triggerDamageEventId: shard.triggerDamageEventId,
        triggerFrame: shard.triggerFrame,
        spawnedAtFrame: shard.spawnedAtFrame,
        earliestPickupFrame: shard.earliestPickupFrame,
        expiresAtFrame: shard.expiresAtFrame,
        position: deepClone(shard.position),
        spawnRadius: shard.spawnRadius,
        spawnAngleDegrees: shard.spawnAngleDegrees,
        sourceCharacterLevel: shard.sourceCharacterLevel,
        sourceElementalMastery: shard.sourceElementalMastery,
        pickupCommandIndex: null,
        pickedUpByActorId: null,
        shieldLogId: null,
        success: true,
        reason: "SPAWNED"
      });
      push(shard.expiresAtFrame / 60, "crystallizeShardExpiry", {
        shardId: shard.id,
        expectedExpiryFrame: shard.expiresAtFrame
      } satisfies CrystallizeShardExpiryEventPayload);
      continue;
    }

    if (event.type === "crystallizeShardExpiry") {
      const { shardId, expectedExpiryFrame } =
        event.payload as CrystallizeShardExpiryEventPayload;
      const shard = activeCrystallizeShards.get(shardId);
      if (
        shard === undefined ||
        shard.expiresAtFrame !== expectedExpiryFrame
      ) {
        continue;
      }
      activeCrystallizeShards.delete(shard.id);
      crystallizeShardLog.push({
        id: crystallizeShardLog.length,
        operation: "expire",
        frame: event.frame,
        timeSeconds,
        shardId: shard.id,
        reaction: shard.reaction,
        element: shard.element,
        sourceActorId: shard.sourceActorId,
        sourceTargetId: shard.sourceTargetId,
        triggerDamageEventId: shard.triggerDamageEventId,
        triggerFrame: shard.triggerFrame,
        spawnedAtFrame: shard.spawnedAtFrame,
        earliestPickupFrame: shard.earliestPickupFrame,
        expiresAtFrame: shard.expiresAtFrame,
        position: deepClone(shard.position),
        spawnRadius: shard.spawnRadius,
        spawnAngleDegrees: shard.spawnAngleDegrees,
        sourceCharacterLevel: shard.sourceCharacterLevel,
        sourceElementalMastery: shard.sourceElementalMastery,
        pickupCommandIndex: null,
        pickedUpByActorId: null,
        shieldLogId: null,
        success: true,
        reason: "EXPIRED"
      });
      continue;
    }

    if (event.type === "crystallizePickup") {
      const { commandIndex, element } =
        event.payload as CrystallizePickupEventPayload;
      const pickupActorId = activeCharacterId;
      if (pickupActorId === null) continue;
      const matchingShards = [...activeCrystallizeShards.values()]
        .filter(
          (shard) => element === "any" || shard.element === element
        )
        .sort((left, right) => left.id - right.id);
      let pickedUp = false;
      for (const shard of matchingShards) {
        if (event.frame < shard.earliestPickupFrame) {
          crystallizeShardLog.push({
            id: crystallizeShardLog.length,
            operation: "pickup-attempt",
            frame: event.frame,
            timeSeconds,
            shardId: shard.id,
            reaction: shard.reaction,
            element: shard.element,
            sourceActorId: shard.sourceActorId,
            sourceTargetId: shard.sourceTargetId,
            triggerDamageEventId: shard.triggerDamageEventId,
            triggerFrame: shard.triggerFrame,
            spawnedAtFrame: shard.spawnedAtFrame,
            earliestPickupFrame: shard.earliestPickupFrame,
            expiresAtFrame: shard.expiresAtFrame,
            position: deepClone(shard.position),
            spawnRadius: shard.spawnRadius,
            spawnAngleDegrees: shard.spawnAngleDegrees,
            sourceCharacterLevel: shard.sourceCharacterLevel,
            sourceElementalMastery:
              shard.sourceElementalMastery,
            pickupCommandIndex: commandIndex,
            pickedUpByActorId: pickupActorId,
            shieldLogId: null,
            success: false,
            reason: "TOO_EARLY"
          });
          continue;
        }

        activeCrystallizeShards.delete(shard.id);
        const calculation = calcCrystallizeShield(
          shard.sourceCharacterLevel,
          shard.sourceElementalMastery
        );
        const previousShieldId =
          activeCrystallizeShield?.id ?? null;
        const shield: ActiveCrystallizeShield = {
          id: nextCrystallizeShieldId++,
          shardId: shard.id,
          element: shard.element,
          sourceActorId: shard.sourceActorId,
          pickedUpByActorId: pickupActorId,
          sourceCharacterLevel: shard.sourceCharacterLevel,
          sourceElementalMastery:
            shard.sourceElementalMastery,
          calculation,
          currentBaseHp: calculation.baseHp,
          expiresAtFrame:
            event.frame +
            CRYSTALLIZE_CONSTANTS.shieldDurationFrames
        };
        activeCrystallizeShield = shield;
        const shieldLogId = crystallizeShieldLog.length;
        crystallizeShieldLog.push({
          id: shieldLogId,
          operation:
            previousShieldId === null ? "add" : "overwrite",
          frame: event.frame,
          timeSeconds,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: nextIntraEventSequence(),
          shieldId: shield.id,
          shardId: shield.shardId,
          element: shield.element,
          sourceActorId: shield.sourceActorId,
          pickedUpByActorId: shield.pickedUpByActorId,
          sourceCharacterLevel: shield.sourceCharacterLevel,
          sourceElementalMastery:
            shield.sourceElementalMastery,
          baseHp: calculation.baseHp,
          elementalMasteryBonus:
            calculation.elementalMasteryBonus,
          generalAbsorption: calculation.generalAbsorption,
          matchingElementAbsorption:
            calculation.matchingElementAbsorption,
          geoDamageAbsorption: calculation.geoDamageAbsorption,
          currentBaseHp: calculation.baseHp,
          expiresAtFrame: shield.expiresAtFrame,
          previousShieldId,
          playerDamageEventId: null,
          incomingElement: null,
          baseHpBeforeAbsorption: 0,
          baseHpConsumed: 0,
          baseHpAfterAbsorption: 0,
          absorbedDamage: 0,
          damageAfterShield: 0
        });
        crystallizeShieldTimeline.push({
          id: crystallizeShieldTimeline.length,
          frame: event.frame,
          timeSeconds,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: nextIntraEventSequence(),
          operation:
            previousShieldId === null ? "add" : "overwrite",
          shieldId: shield.id,
          element: shield.element,
          generalAbsorption: calculation.generalAbsorption,
          expiresAtFrame: shield.expiresAtFrame,
          playerDamageEventId: null,
          baseHpBeforeAbsorption: 0,
          baseHpAfterAbsorption: 0,
          absorbedDamage: 0,
          damageAfterShield: 0
        });
        crystallizeShardLog.push({
          id: crystallizeShardLog.length,
          operation: "pickup",
          frame: event.frame,
          timeSeconds,
          shardId: shard.id,
          reaction: shard.reaction,
          element: shard.element,
          sourceActorId: shard.sourceActorId,
          sourceTargetId: shard.sourceTargetId,
          triggerDamageEventId: shard.triggerDamageEventId,
          triggerFrame: shard.triggerFrame,
          spawnedAtFrame: shard.spawnedAtFrame,
          earliestPickupFrame: shard.earliestPickupFrame,
          expiresAtFrame: shard.expiresAtFrame,
          position: deepClone(shard.position),
          spawnRadius: shard.spawnRadius,
          spawnAngleDegrees: shard.spawnAngleDegrees,
          sourceCharacterLevel: shard.sourceCharacterLevel,
          sourceElementalMastery:
            shard.sourceElementalMastery,
          pickupCommandIndex: commandIndex,
          pickedUpByActorId: pickupActorId,
          shieldLogId,
          success: true,
          reason: "PICKED_UP"
        });
        push(
          shield.expiresAtFrame / 60,
          "crystallizeShieldExpiry",
          {
            shieldId: shield.id,
            expectedExpiryFrame: shield.expiresAtFrame
          } satisfies CrystallizeShieldExpiryEventPayload
        );
        pickedUp = true;
        break;
      }
      if (!pickedUp && matchingShards.length === 0) {
        crystallizeShardLog.push({
          id: crystallizeShardLog.length,
          operation: "pickup-attempt",
          frame: event.frame,
          timeSeconds,
          shardId: null,
          reaction: null,
          element,
          sourceActorId: null,
          sourceTargetId: null,
          triggerDamageEventId: null,
          triggerFrame: null,
          spawnedAtFrame: null,
          earliestPickupFrame: null,
          expiresAtFrame: null,
          position: null,
          spawnRadius: null,
          spawnAngleDegrees: null,
          sourceCharacterLevel: null,
          sourceElementalMastery: null,
          pickupCommandIndex: commandIndex,
          pickedUpByActorId: pickupActorId,
          shieldLogId: null,
          success: false,
          reason: "NO_MATCHING_SHARD"
        });
      }
      continue;
    }

    if (event.type === "crystallizeShieldExpiry") {
      const { shieldId, expectedExpiryFrame } =
        event.payload as CrystallizeShieldExpiryEventPayload;
      const shield = activeCrystallizeShield;
      if (
        shield === null ||
        shield.id !== shieldId ||
        shield.expiresAtFrame !== expectedExpiryFrame
      ) {
        continue;
      }
      crystallizeShieldLog.push({
        id: crystallizeShieldLog.length,
        operation: "expire",
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        shieldId: shield.id,
        shardId: shield.shardId,
        element: shield.element,
        sourceActorId: shield.sourceActorId,
        pickedUpByActorId: shield.pickedUpByActorId,
        sourceCharacterLevel: shield.sourceCharacterLevel,
        sourceElementalMastery: shield.sourceElementalMastery,
        baseHp: shield.calculation.baseHp,
        elementalMasteryBonus:
          shield.calculation.elementalMasteryBonus,
        generalAbsorption: shield.calculation.generalAbsorption,
        matchingElementAbsorption:
          shield.calculation.matchingElementAbsorption,
        geoDamageAbsorption:
          shield.calculation.geoDamageAbsorption,
        currentBaseHp: 0,
        expiresAtFrame: shield.expiresAtFrame,
        previousShieldId: null,
        playerDamageEventId: null,
        incomingElement: null,
        baseHpBeforeAbsorption: 0,
        baseHpConsumed: 0,
        baseHpAfterAbsorption: 0,
        absorbedDamage: 0,
        damageAfterShield: 0
      });
      crystallizeShieldTimeline.push({
        id: crystallizeShieldTimeline.length,
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        operation: "expire",
        shieldId: null,
        element: null,
        generalAbsorption: 0,
        expiresAtFrame: null,
        playerDamageEventId: null,
        baseHpBeforeAbsorption: 0,
        baseHpAfterAbsorption: 0,
        absorbedDamage: 0,
        damageAfterShield: 0
      });
      activeCrystallizeShield = null;
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
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "frozen-expiry",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        primaryDamageEventId: null,
        links:
          result.operation === "stale"
            ? []
            : [
                {
                  kind: "frozen-state-log",
                  id: frozenStateLog.length
                }
              ],
        auraBefore: result.auraBefore,
        auraAfter: result.auraAfter
      });
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

    if (event.type === "quickenExpiry") {
      const {
        targetId,
        generation,
        expectedExpiryFrame
      } = event.payload as QuickenExpiryEventPayload;
      quickenExpiryScheduleKeys.delete(
        `${targetId}\u0000${generation}\u0000${expectedExpiryFrame}`
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const result = auraEngine.expireQuicken(
        event.frame,
        generation,
        expectedExpiryFrame
      );
      const source = activeQuickenStateSources.get(targetId);
      // The Aura engine may already have reduced Quicken to numeric zero
      // while Burning is winding down. The simulator-owned source generation
      // remains the authoritative lifecycle gate for queued expiry events.
      const isCurrentLifecycleExpiry =
        result.operation !== "stale" &&
        source?.generation === generation;
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "quicken-expiry",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        primaryDamageEventId: null,
        links:
          !isCurrentLifecycleExpiry
            ? []
            : [
                {
                  kind: "quicken-state-log",
                  id: quickenStateLog.length
                }
              ],
        auraBefore: result.auraBefore,
        auraAfter: result.auraAfter
      });
      if (!isCurrentLifecycleExpiry) continue;
      quickenStateLog.push({
        id: quickenStateLog.length,
        reaction: "quicken",
        generation,
        operation: "expire",
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        sourceActorId: source?.actorId ?? null,
        triggerDamageEventId:
          source?.triggerDamageEventId ?? null,
        triggerElement: null,
        consumedAuraElement: null,
        candidateGaugeUnits: 0,
        quickenGaugeUnitsBefore:
          result.quickenGaugeUnitsBefore,
        quickenGaugeUnitsAfter:
          result.quickenGaugeUnitsAfter,
        decayPerFrameBefore:
          result.decayPerFrameBefore,
        decayPerFrameAfter: result.decayPerFrameAfter,
        expiresAtFrameBefore:
          result.expiresAtFrameBefore,
        auraBefore: result.auraBefore,
        auraAfter: result.auraAfter,
        expiresAtFrame: result.expiresAtFrame,
        endCauseBefore: result.endCauseBefore,
        endCauseAfter: result.endCauseAfter,
        reason: result.reason
      });
      if (source?.generation === generation) {
        activeQuickenStateSources.delete(targetId);
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
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "electro-charged-expiry",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: "electroCharged",
        reactions: ["electroCharged"],
        primaryDamageEventId: null,
        links:
          result.operation === "stale"
            ? []
            : [
                {
                  kind: "periodic-reaction-log",
                  id: periodicReactionLog.length
                }
              ],
        auraBefore: result.auraBefore,
        auraConsumed: result.auraConsumed,
        auraAfter: result.auraAfter
      });
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

    if (event.type === "burningFuelExpiry") {
      const {
        targetId,
        generation,
        expectedExpiryFrame
      } = event.payload as BurningFuelExpiryEventPayload;
      burningFuelExpiryScheduleKeys.delete(
        `${targetId}\u0000${generation}\u0000${expectedExpiryFrame}`
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const result = auraEngine.expireBurningFuel(
        event.frame,
        generation,
        expectedExpiryFrame
      );
      const quickenSource =
        activeQuickenStateSources.get(targetId);
      const quickenMutation = result.quickenStateMutation;
      const quickenWasRemoved =
        result.operation !== "stale" &&
        quickenSource !== undefined &&
        quickenMutation.operation === "remove";
      const burningStateLogId = burningStateLog.length;
      const quickenStateLogId = quickenWasRemoved
        ? quickenStateLog.length
        : null;
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "burning-fuel-expiry",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: "burning",
        reactions: ["burning"],
        primaryDamageEventId: null,
        links:
          result.operation === "stale"
            ? []
            : [
                {
                  kind: "burning-state-log",
                  id: burningStateLogId
                },
                ...(quickenStateLogId === null
                  ? []
                  : [
                      {
                        kind: "quicken-state-log" as const,
                        id: quickenStateLogId
                      }
                    ])
              ],
        auraBefore: result.auraBefore,
        auraAfter: result.auraAfter
      });
      if (result.operation === "stale") continue;
      const source = activeBurningSources.get(targetId);
      const removedAura = result.auraBefore
        .filter(
          (before) =>
            !result.auraAfter.some(
              (after) => after.element === before.element
            )
        )
        .map((entry) => ({
          element: entry.element,
          gaugeUnits: entry.gaugeUnits
        }));
      burningStateLog.push({
        id: burningStateLog.length,
        reaction: "burning",
        generation,
        operation: "fuel-expire",
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        targetId,
        targetName: target.name,
        triggerElement: null,
        damageSourceActorId:
          result.damageSourceActorId ?? source?.actorId ?? null,
        fuelSourceActorId:
          result.fuelSourceActorId ??
          source?.fuelSourceActorId ??
          null,
        triggerDamageEventId:
          source?.triggerDamageEventId ?? null,
        reactionDamageLogId: null,
        damageEventIds: [],
        playerHitResolutionLogId: null,
        playerDamageEventId: null,
        tickIndex: null,
        tickSkipped: false,
        skipReason: null,
        damageAllowed: null,
        burningGaugeUnitsBefore:
          result.burningGaugeUnitsBefore,
        burningGaugeUnitsAfter:
          result.burningGaugeUnitsAfter,
        fuelGaugeUnitsBefore: result.fuelGaugeUnitsBefore,
        fuelGaugeUnitsAfter: result.fuelGaugeUnitsAfter,
        fuelDecayPerFrame: result.fuelDecayPerFrame,
        fuelExpiresAtFrame: result.fuelExpiresAtFrame,
        auraBefore: deepClone(result.auraBefore),
        auraApplied: [],
        auraConsumed: removedAura,
        auraAfter: deepClone(result.auraAfter),
        nextTickFrame: result.nextTickFrame,
        clockModel: "target-local-no-hitlag",
        hitlagStatus: "unsupported-enemy-hitlag",
        icdGroup: "burning",
        icdTag: "burning-application",
        icdScope: "global-target",
        icdWindowStartFrame: null,
        icdHitIndex: null,
        icdResetFrames:
          AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
        icdApplicationSequence:
          AURA_ENGINE_CONSTANTS.burningIcdSequence,
        applicationAllowed: null,
        applicationBlockedReason: null,
        selfDamageStatus: playerSelfDamageStatus,
        reason: "FUEL_EXPIRED"
      });
      if (quickenWasRemoved) {
        quickenStateLog.push({
          id: quickenStateLog.length,
          reaction: "quicken",
          generation: quickenMutation.generationAfter,
          operation: "remove",
          frame: event.frame,
          timeSeconds,
          targetId,
          targetName: target.name,
          sourceActorId: quickenSource.actorId,
          triggerDamageEventId:
            quickenSource.triggerDamageEventId,
          triggerElement: null,
          consumedAuraElement: null,
          candidateGaugeUnits: 0,
          quickenGaugeUnitsBefore:
            quickenMutation.quickenGaugeUnitsBefore,
          quickenGaugeUnitsAfter:
            quickenMutation.quickenGaugeUnitsAfter,
          decayPerFrameBefore:
            quickenMutation.decayPerFrameBefore,
          decayPerFrameAfter:
            quickenMutation.decayPerFrameAfter,
          expiresAtFrameBefore:
            quickenMutation.expiresAtFrameBefore,
          auraBefore: deepClone(
            quickenMutation.operationAuraBefore
          ),
          auraAfter: deepClone(
            quickenMutation.operationAuraAfter
          ),
          expiresAtFrame: null,
          endCauseBefore: quickenMutation.endCauseBefore,
          endCauseAfter: quickenMutation.endCauseAfter,
          reason: "BURNING_FUEL_EXPIRED"
        });
        activeQuickenStateSources.delete(targetId);
      }
      if (source?.generation === generation) {
        activeBurningSources.delete(targetId);
      }
      continue;
    }

    if (event.type === "burningTick") {
      const {
        targetId,
        generation,
        tickIndex
      } = event.payload as BurningTickEventPayload;
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      const source = activeBurningSources.get(targetId);
      if (
        !auraEngine ||
        !target ||
        !source ||
        source.generation !== generation ||
        auraEngine.isMechanicsTruncated()
      ) {
        continue;
      }
      const prepared = auraEngine.prepareBurningTick(
        event.frame,
        generation,
        tickIndex
      );
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "burning-tick",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: "burning",
        reactions: ["burning"],
        primaryDamageEventId: null,
        links:
          prepared.operation === "stale"
            ? []
            : [
                {
                  kind: "burning-state-log",
                  id: burningStateLog.length
                }
              ],
        auraBefore: prepared.auraBefore,
        auraAfter: prepared.auraAfter
      });
      if (prepared.operation === "stale") continue;
      if (prepared.operation === "stop") {
        burningStateLog.push({
          id: burningStateLog.length,
          reaction: "burning",
          generation,
          operation: "stop",
          frame: event.frame,
          timeSeconds,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          targetId,
          targetName: target.name,
          triggerElement: null,
          damageSourceActorId:
            prepared.damageSourceActorId ?? source.actorId,
          fuelSourceActorId:
            prepared.fuelSourceActorId ??
            source.fuelSourceActorId,
          triggerDamageEventId: source.triggerDamageEventId,
          reactionDamageLogId: null,
          damageEventIds: [],
          playerHitResolutionLogId: null,
          playerDamageEventId: null,
          tickIndex,
          tickSkipped: false,
          skipReason: null,
          damageAllowed: null,
          burningGaugeUnitsBefore:
            prepared.burningGaugeUnitsBefore,
          burningGaugeUnitsAfter:
            prepared.burningGaugeUnitsAfter,
          fuelGaugeUnitsBefore:
            prepared.fuelGaugeUnitsBefore,
          fuelGaugeUnitsAfter:
            prepared.fuelGaugeUnitsAfter,
          fuelDecayPerFrame: prepared.fuelDecayPerFrame,
          fuelExpiresAtFrame: prepared.fuelExpiresAtFrame,
          auraBefore: deepClone(prepared.auraBefore),
          auraApplied: [],
          auraConsumed: [],
          auraAfter: deepClone(prepared.auraAfter),
          nextTickFrame: null,
          clockModel: "target-local-no-hitlag",
          hitlagStatus: "unsupported-enemy-hitlag",
          icdGroup: "burning",
          icdTag: "burning-application",
          icdScope: "global-target",
          icdWindowStartFrame: null,
          icdHitIndex: null,
          icdResetFrames:
            AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
          icdApplicationSequence:
            AURA_ENGINE_CONSTANTS.burningIcdSequence,
          applicationAllowed: null,
          applicationBlockedReason: null,
          selfDamageStatus: playerSelfDamageStatus,
          reason:
            prepared.reason === "BURNING_AURA_CONSUMED"
              ? "BURNING_AURA_CONSUMED"
              : "FUEL_EXPIRED"
        });
        activeBurningSources.delete(targetId);
        continue;
      }

      const burningStateLogId = burningStateLog.length;
      burningStateLog.push({
        id: burningStateLogId,
        reaction: "burning",
        generation,
        operation: prepared.operation,
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        targetId,
        targetName: target.name,
        triggerElement: null,
        damageSourceActorId: source.actorId,
        fuelSourceActorId:
          prepared.fuelSourceActorId ??
          source.fuelSourceActorId,
        triggerDamageEventId: source.triggerDamageEventId,
        reactionDamageLogId: null,
        damageEventIds: [],
        playerHitResolutionLogId: null,
        playerDamageEventId: null,
        tickIndex,
        tickSkipped: prepared.operation === "tick-skipped",
        skipReason: prepared.skipReason,
        damageAllowed:
          prepared.operation === "tick-skipped" ? false : null,
        burningGaugeUnitsBefore:
          prepared.burningGaugeUnitsBefore,
        burningGaugeUnitsAfter:
          prepared.burningGaugeUnitsAfter,
        fuelGaugeUnitsBefore:
          prepared.fuelGaugeUnitsBefore,
        fuelGaugeUnitsAfter:
          prepared.fuelGaugeUnitsAfter,
        fuelDecayPerFrame: prepared.fuelDecayPerFrame,
        fuelExpiresAtFrame: prepared.fuelExpiresAtFrame,
        auraBefore: deepClone(prepared.auraBefore),
        auraApplied: [],
        auraConsumed: [],
        auraAfter: deepClone(prepared.auraAfter),
        nextTickFrame: prepared.nextTickFrame,
        clockModel: "target-local-no-hitlag",
        hitlagStatus: "unsupported-enemy-hitlag",
        icdGroup: "burning",
        icdTag: "burning-application",
        icdScope: "global-target",
        icdWindowStartFrame: null,
        icdHitIndex: null,
        icdResetFrames:
          AURA_ENGINE_CONSTANTS.burningIcdResetFrames,
        icdApplicationSequence:
          AURA_ENGINE_CONSTANTS.burningIcdSequence,
        applicationAllowed: null,
        applicationBlockedReason: null,
        selfDamageStatus: playerSelfDamageStatus,
        reason: null
      });
      if (prepared.operation === "tick") {
        scheduleBurningDamage({
          frame: event.frame,
          targetId,
          generation,
          tickIndex,
          source,
          burningStateLogId,
          nextTickFrame: prepared.nextTickFrame
        });
      }
      if (prepared.nextTickFrame !== null) {
        push(
          prepared.nextTickFrame / 60,
          "burningTick",
          {
            targetId,
            generation,
            tickIndex: tickIndex + 1
          } satisfies BurningTickEventPayload,
          burningTickPriorityForTarget(targetId)
        );
      }
      scheduleBurningFuelExpiry(
        targetId,
        generation,
        prepared.fuelExpiresAtFrame
      );
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
      if (
        !auraEngine ||
        !target ||
        auraEngine.isMechanicsTruncated()
      ) {
        continue;
      }

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
        targetStateTimelineRecorder.recordEvent({
          frame: event.frame,
          timeSeconds,
          targetId,
          targetName: target.name,
          cause: "electro-charged-tick",
          eventType: event.type,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: nextIntraEventSequence(),
          reaction: "electroCharged",
          reactions: ["electroCharged"],
          primaryDamageEventId: null,
          links:
            source === undefined
              ? []
              : [
                  {
                    kind: "periodic-reaction-log",
                    id: periodicReactionLog.length
                  }
                ],
          auraBefore,
          auraAfter
        });
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
        targetStateTimelineRecorder.recordEvent({
          frame: event.frame,
          timeSeconds,
          targetId,
          targetName: target.name,
          cause: "electro-charged-tick",
          eventType: event.type,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: nextIntraEventSequence(),
          reaction: "electroCharged",
          reactions: ["electroCharged"],
          primaryDamageEventId: null,
          links:
            prepared.operation === "stale"
              ? []
              : [
                  {
                    kind: "periodic-reaction-log",
                    id: periodicReactionLog.length
                  }
                ],
          auraBefore: prepared.auraBefore,
          auraConsumed: prepared.auraConsumed,
          auraAfter: prepared.auraAfter
        });
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
      if (
        !auraEngine ||
        !target ||
        auraEngine.isMechanicsTruncated()
      ) {
        continue;
      }
      const result = auraEngine.waneElectroCharged(
        event.frame,
        damageApplied
      );
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "electro-charged-wane",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: "electroCharged",
        reactions: ["electroCharged"],
        primaryDamageEventId: damageEventId,
        links: [
          { kind: "damage-event", id: damageEventId },
          {
            kind: "periodic-reaction-log",
            id: periodicReactionLog.length
          }
        ],
        auraBefore: result.auraBefore,
        auraConsumed: result.auraConsumed,
        auraAfter: result.auraAfter
      });
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
        stats: scheduledStats,
        elementalMastery: scheduledElementalMastery,
        reactionBonus: scheduledReactionBonus,
        sourceBuffStatuses: scheduledSourceBuffStatuses,
        snapshot,
        cycle,
        reactionDamageLogId,
        periodicContext,
        burningContext,
        application,
        excludedTargetIds = [],
        swirlContext,
        dendroCoreContext
      } = event.payload as ReactionDamageEventPayload;
      const sourceActor = characters.get(actorId);
      const reactionLog = reactionDamageLog[reactionDamageLogId];
      if (!sourceActor || !reactionLog) continue;
      const stats =
        dendroCoreContext === undefined
          ? scheduledStats
          : computeStats(actorId, timeSeconds);
      if (stats === undefined) {
        throw new Error(
          `Dendro-core reaction source stats for "${actorId}" could not be resolved at frame ${event.frame}.`
        );
      }
      const elementalMastery =
        dendroCoreContext === undefined
          ? scheduledElementalMastery
          : stats.em;
      const reactionBonus =
        dendroCoreContext === undefined
          ? scheduledReactionBonus
          : stats.reactionBonus +
            dendroCoreContext.reactionBonusDelta;
      const sourceBuffStatuses =
        dendroCoreContext === undefined
          ? scheduledSourceBuffStatuses
          : activeBuffs
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
      const reactionLabel =
        TRANSFORMATIVE_REACTION_LABELS[reaction];
      const dendroCoreReactionInstanceSuffix =
        dendroCoreContext === undefined
          ? ""
          : `:core-${dendroCoreContext.coreId}:log-${reactionDamageLogId}`;
      const reactionHitId = `${triggerHitId}:${reaction}`;
      const resolvedReactionHitId =
        `${reactionHitId}${dendroCoreReactionInstanceSuffix}`;
      const reactionHitGroupId =
        `${triggerHitGroupId}:${reaction}:${triggerDamageEventId}`;
      const resolvedReactionHitGroupId =
        `${reactionHitGroupId}${dendroCoreReactionInstanceSuffix}`;
      const reactionActionName =
        `${action.name} · ${reactionLabel}`;
      let resolvedReactionCenterPosition = centerPosition;
      if (targetingMode === "nearest-target-radius") {
        if (
          centerPosition === null ||
          dendroCoreContext?.selectionRadius === null ||
          dendroCoreContext?.selectionRadius === undefined
        ) {
          throw new Error(
            "Hyperbloom targeting requires a source-core position and selection radius."
          );
        }
        const selection = selectNearestDendroCoreTarget(
          centerPosition,
          enemyTargets.map((target) => ({
            targetId: target.id,
            position: resolveTargetPosition(target.id, event.frame),
            hitboxRadius: target.hitboxRadius
          })),
          DENDRO_CORE_CONSTANTS.hyperbloomSelectionRadius
        );
        reactionLog.selectedTargetId = selection.selectedTargetId;
        reactionLog.resolutionReason =
          selection.reason === "NO_TARGET_IN_RANGE"
            ? "NO_TARGET_IN_RANGE"
            : null;
        if (selection.selectedPosition === null) {
          reactionLog.centerPosition = null;
          continue;
        }
        resolvedReactionCenterPosition = deepClone(
          selection.selectedPosition
        );
        reactionLog.centerPosition = deepClone(
          selection.selectedPosition
        );
      }

      const spatialPlans: Array<{
        targetId: string;
        targetPosition: { x: number; y: number } | null;
        landed: boolean;
        reason: string | null;
        distance: number | null;
        threshold: number | null;
        targetingSource: "reaction-source" | "reaction-geometry";
      }> = [];
      const excludedTargetIdSet = new Set(excludedTargetIds);
      if (targetingMode === "single-target") {
        if (!excludedTargetIdSet.has(sourceTargetId)) {
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
        }
      } else if (resolvedReactionCenterPosition === null) {
        if (!excludedTargetIdSet.has(sourceTargetId)) {
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
        }
        reactionLog.unresolvedTargetIds.push(
          ...enemyTargets
            .filter(
              (target) =>
                target.id !== sourceTargetId &&
                !excludedTargetIdSet.has(target.id)
            )
            .map((target) => target.id)
        );
      } else {
        for (const target of enemyTargets) {
          if (excludedTargetIdSet.has(target.id)) continue;
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
              origin: resolvedReactionCenterPosition,
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
      const reactionHitResolutionLogIds: number[] = [];
      const reactionTriggerDamageEventIds: number[] = [];
      spatialPlans.forEach((plan, targetIndex) => {
        const targetProfile = enemyTargetById.get(plan.targetId);
        if (!targetProfile) return;
        const targetAuraEngine =
          auraEngines?.get(plan.targetId) ?? null;
        const mechanicsTruncatedBefore =
          targetAuraEngine?.isMechanicsTruncated() ?? false;
        const mechanicsStatus: DamageEvent["mechanicsStatus"] =
          mechanicsTruncatedBefore
            ? "mechanics-truncated"
            : "authoritative";
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
        const propagatedReactionAudit =
          plan.landed &&
          reactionDamageAuraAllowed &&
          targetAuraEngine !== null &&
          (application !== undefined || mechanicsTruncatedBefore)
            ? projectPlayerSelfDamageStatus(
                targetAuraEngine.processHit({
                  frame: event.frame,
                  sourceActorId: actorId,
                  element: damageElement,
                  ...(application === undefined
                    ? {}
                    : { application })
                })
              )
            : null;
        const pendingReactionDamageEventId = damageEvents.length;
        if (propagatedReactionAudit !== null) {
          targetStateTimelineRecorder.recordEvent({
            frame: event.frame,
            timeSeconds,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            cause: "reaction-damage-application",
            eventType: event.type,
            eventPriority: event.priority,
            eventSequence: event.sequence,
            intraEventSequence: nextIntraEventSequence(),
            reaction: propagatedReactionAudit.reaction,
            reactions: propagatedReactionAudit.reactions,
            primaryDamageEventId: pendingReactionDamageEventId,
            links: [
              {
                kind: "damage-event",
                id: pendingReactionDamageEventId
              },
              {
                kind: "reaction-damage-log",
                id: reactionDamageLogId
              },
              ...(propagatedReactionAudit.mechanicsTruncation ===
              null
                ? projectedQuickenDecayRebaseLogIds(
                    propagatedReactionAudit
                  ).map((id) => ({
                    kind: "quicken-state-log" as const,
                    id
                  }))
                : [])
            ],
            auraBefore: propagatedReactionAudit.auraBefore ?? [],
            auraApplied: propagatedReactionAudit.auraApplied ?? [],
            auraConsumed: propagatedReactionAudit.auraConsumed ?? [],
            auraAfter: propagatedReactionAudit.auraAfter ?? []
          });
        }
        const burningApplicationIcdDecision =
          application?.icdGroup === "burning" &&
          propagatedReactionAudit?.icdGroup === "burning"
            ? targetAuraEngine?.getLastBurningApplicationIcdDecision() ??
              null
            : null;
        const swirlDamageGroup =
          plan.landed && swirlContext !== undefined
            ? resolveSwirlDamageGroup({
                targetId: plan.targetId,
                actorId,
                reaction: swirlContext.reaction,
                frame: event.frame
              })
            : null;
        if (swirlDamageGroup !== null) {
          reactionLog.damageGroupDecisions.push({
            reaction: swirlDamageGroup.reaction,
            sourceActorId: actorId,
            targetId: plan.targetId,
            windowStartFrame: swirlDamageGroup.windowStartFrame,
            hitIndex: swirlDamageGroup.hitIndex,
            resetFrames: 30,
            sequence: [true, true, false],
            damageAllowed: swirlDamageGroup.damageAllowed,
            blockedReason: swirlDamageGroup.blockedReason
          });
          if (!swirlDamageGroup.damageAllowed) {
            reactionLog.damageGroupBlockedTargetIds.push(plan.targetId);
          }
        }
        const dendroCoreDamageGroupDecision =
          plan.landed && dendroCoreContext !== undefined
            ? dendroCoreReactionALimiter.decide({
                targetId: plan.targetId,
                actorId,
                reactionTag: dendroCoreContext.reaction,
                frame: event.frame
              })
            : null;
        const dendroCoreDamageGroupAudit:
          | ReactionADamageGroupAudit
          | null =
          dendroCoreDamageGroupDecision === null
            ? null
            : {
                reaction:
                  dendroCoreDamageGroupDecision.reactionTag,
                sourceActorId: actorId,
                targetId: plan.targetId,
                windowStartFrame:
                  dendroCoreDamageGroupDecision.windowStartFrame,
                hitIndex:
                  dendroCoreDamageGroupDecision.hitIndex,
                resetFrames: 30,
                sequence: [true, true, false],
                damageAllowed:
                  dendroCoreDamageGroupDecision.damageAllowed,
                blockedReason:
                  dendroCoreDamageGroupDecision.blockedReason
              };
        if (dendroCoreDamageGroupAudit !== null) {
          reactionLog.damageGroupDecisions.push(
            dendroCoreDamageGroupAudit
          );
          if (!dendroCoreDamageGroupAudit.damageAllowed) {
            reactionLog.damageGroupBlockedTargetIds.push(
              plan.targetId
            );
          }
        }
        const shatterDamageGroupDecision =
          plan.landed && reaction === "shatter"
            ? shatterReactionALimiter.decide({
                targetId: plan.targetId,
                actorId,
                reactionTag: "shatter",
                frame: event.frame
              })
            : null;
        const shatterDamageGroupAudit:
          | ReactionADamageGroupAudit
          | null =
          shatterDamageGroupDecision === null
            ? null
            : {
                reaction: "shatter",
                sourceActorId: actorId,
                targetId: plan.targetId,
                windowStartFrame:
                  shatterDamageGroupDecision.windowStartFrame,
                hitIndex: shatterDamageGroupDecision.hitIndex,
                resetFrames: 30,
                sequence: [true, true, false],
                damageAllowed:
                  shatterDamageGroupDecision.damageAllowed,
                blockedReason:
                  shatterDamageGroupDecision.blockedReason
              };
        const superconductDamageGroupDecision =
          plan.landed && reaction === "superconduct"
            ? superconductReactionALimiter.decide({
                targetId: plan.targetId,
                actorId,
                reactionTag: "superconduct",
                frame: event.frame
              })
            : null;
        const superconductDamageGroupAudit:
          | ReactionADamageGroupAudit
          | null =
          superconductDamageGroupDecision === null
            ? null
            : {
                reaction: "superconduct",
                sourceActorId: actorId,
                targetId: plan.targetId,
                windowStartFrame:
                  superconductDamageGroupDecision.windowStartFrame,
                hitIndex:
                  superconductDamageGroupDecision.hitIndex,
                resetFrames: 30,
                sequence: [true, true, false],
                damageAllowed:
                  superconductDamageGroupDecision.damageAllowed,
                blockedReason:
                  superconductDamageGroupDecision.blockedReason
              };
        const reactionBDamageGroupDecision =
          plan.landed &&
          (reaction === "overload" ||
            reaction === "electroCharged")
            ? overloadAndElectroChargedReactionBLimiter.decide({
                targetId: plan.targetId,
                actorId,
                reactionTag: reaction,
                frame: event.frame
              })
            : null;
        const reactionBDamageGroupAudit:
          | ReactionBDamageGroupAudit
          | null =
          reactionBDamageGroupDecision === null
            ? null
            : {
                reaction:
                  reactionBDamageGroupDecision.reactionTag,
                sourceActorId: actorId,
                targetId: plan.targetId,
                windowStartFrame:
                  reactionBDamageGroupDecision.windowStartFrame,
                hitIndex:
                  reactionBDamageGroupDecision.hitIndex,
                resetFrames: 30,
                sequence: [true, false],
                damageAllowed:
                  reactionBDamageGroupDecision.damageAllowed,
                blockedReason:
                  reactionBDamageGroupDecision.blockedReason
              };
        for (const groupAudit of [
          shatterDamageGroupAudit,
          superconductDamageGroupAudit,
          reactionBDamageGroupAudit
        ]) {
          if (groupAudit === null) continue;
          reactionLog.damageGroupDecisions.push(groupAudit);
          if (!groupAudit.damageAllowed) {
            reactionLog.damageGroupBlockedTargetIds.push(
              plan.targetId
            );
          }
        }
        const shatterCheckAllowed =
          plan.landed &&
          reactionDamageAuraAllowed &&
          !mechanicsTruncatedBefore &&
          targetAuraEngine !== null;
        const nestedShatterState =
          shatterCheckAllowed
            ? targetAuraEngine.processShatterHit({
                  frame: event.frame,
                  element: damageElement,
                  strikeType,
                  poiseDamage
                })
            : null;
        nestedShatterState?.mutations.forEach((mutation) => {
          const shatterTriggered =
            mutation.operation === "shatter-consume";
          targetStateTimelineRecorder.recordEvent({
            frame: event.frame,
            timeSeconds,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            cause: "reaction-damage-shatter",
            eventType: event.type,
            eventPriority: event.priority,
            eventSequence: event.sequence,
            intraEventSequence: nextIntraEventSequence(),
            reaction: shatterTriggered ? "shatter" : "none",
            reactions: shatterTriggered ? ["shatter"] : [],
            primaryDamageEventId: pendingReactionDamageEventId,
            links: [
              {
                kind: "damage-event",
                id: pendingReactionDamageEventId
              },
              {
                kind: "reaction-damage-log",
                id: reactionDamageLogId
              }
            ],
            auraBefore: mutation.auraBefore,
            auraConsumed: [
              {
                element: "frozen",
                gaugeUnits: mutation.consumedGaugeUnits
              }
            ],
            auraAfter: mutation.auraAfter
          });
        });
        if (
          shatterCheckAllowed &&
          propagatedReactionAudit === null &&
          (nestedShatterState?.mutations.length ?? 0) === 0
        ) {
          targetStateTimelineRecorder.synchronize(
            plan.targetId,
            event.frame,
            targetAuraEngine.getAuraStateAt(event.frame)
          );
        }
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
            hitId: resolvedReactionHitId,
            hitGroupId: resolvedReactionHitGroupId,
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
                ? deepClone(resolvedReactionCenterPosition)
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
            mechanicsStatus,
            auraAllowed:
              plan.landed &&
              application !== undefined &&
              reactionDamageAuraAllowed,
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
        reactionHitResolutionLogIds.push(targetResolutionId);
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
        let additiveReactionFactors: AdditiveReactionFactors | null =
          null;
        const additiveReaction =
          propagatedReactionAudit?.catalyzeReaction?.additive;
        if (
          additiveReaction !== null &&
          additiveReaction !== undefined
        ) {
          const scheduledReactionBonusDelta =
            scheduledReactionBonus -
            scheduledStats.reactionBonus;
          const liveReactionStats = computeStats(
            actorId,
            timeSeconds
          );
          if (liveReactionStats === undefined) {
            throw new Error(
              `Missing live stats for nested Catalyze source "${actorId}".`
            );
          }
          const additiveCalculation =
            calcAdditiveReactionDamage({
              reaction: additiveReaction.reaction,
              characterLevel: sourceActor.level,
              elementalMastery: liveReactionStats.em,
              reactionBonus:
                liveReactionStats.reactionBonus +
                scheduledReactionBonusDelta
            });
          additiveReactionFactors = {
            reaction: additiveCalculation.reaction,
            sourceActorId: actorId,
            characterLevel: sourceActor.level,
            levelBaseDamage:
              additiveCalculation.levelBaseDamage,
            baseMultiplier:
              additiveCalculation.baseMultiplier,
            elementalMastery: liveReactionStats.em,
            elementalMasteryBonus:
              additiveCalculation.elementalMasteryBonus,
            reactionBonus:
              additiveCalculation.reactionBonus,
            flatDamage: additiveCalculation.flatDamage,
            appliedFlatDamage: additiveCalculation.flatDamage,
            snapshotMode: "hit-time"
          };
        }
        const additiveFlatDamage =
          additiveReactionFactors?.appliedFlatDamage ?? 0;
        const combinedPreResistanceDamage =
          calculation.preResistanceDamage + additiveFlatDamage;
        const secondaryReaction = propagatedReactionAudit?.reaction;
        const amplifyingReaction: AmplifyingReaction =
          secondaryReaction === "melt" ||
          secondaryReaction === "reverseMelt" ||
          secondaryReaction === "vaporize" ||
          secondaryReaction === "reverseVaporize"
            ? secondaryReaction
            : "none";
        let amplifyingReactionBonus = reactionBonus;
        if (
          amplifyingReaction !== "none" &&
          swirlContext?.scheduleKind === "swirl-propagation"
        ) {
          const liveReactionStats = computeStats(
            actorId,
            timeSeconds
          );
          if (liveReactionStats === undefined) {
            throw new Error(
              `Missing live stats for nested amplifying-reaction source "${actorId}".`
            );
          }
          // The queued Swirl attack owns trigger-frame EM, while ReactBonus is
          // evaluated when its F+5 propagation damage lands. Keep any
          // hit/event-local delta attached to the queued attack.
          amplifyingReactionBonus =
            liveReactionStats.reactionBonus +
            swirlContext.reactionBonusDelta;
        }
        const amplifyingFactors =
          calcAmplifyingReactionMultiplier({
            reaction: amplifyingReaction,
            elementalMastery,
            reactionBonus: amplifyingReactionBonus
          });
        const reactionDamageGroupMultiplier =
          swirlDamageGroup?.damageAllowed === false ||
          dendroCoreDamageGroupAudit?.damageAllowed === false ||
          shatterDamageGroupAudit?.damageAllowed === false ||
          superconductDamageGroupAudit?.damageAllowed === false ||
          reactionBDamageGroupAudit?.damageAllowed === false
            ? 0
            : 1;
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
        const targetDamageMultiplier =
          damageAllowed && !mechanicsTruncatedBefore ? 1 : 0;
        const potentialDamage =
          combinedPreResistanceDamage *
          calculation.resistanceMultiplier *
          amplifyingFactors.total *
          reactionDamageGroupMultiplier;
        const finalDamage =
          potentialDamage * targetDamageMultiplier;
        const displayDamage = Math.round(finalDamage);
        const additiveReactionContribution =
          combinedPreResistanceDamage === 0
            ? 0
            : finalDamage *
              (additiveFlatDamage / combinedPreResistanceDamage);
        const damageComposition: DamageEvent["damageComposition"] = {
          direct: 0,
          additiveReaction: additiveReactionContribution,
          transformativeReaction:
            finalDamage - additiveReactionContribution
        };
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
          flatDamage: additiveFlatDamage,
          baseDamage: combinedPreResistanceDamage,
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
          amplifyingReactionMultiplier: amplifyingFactors.total,
          groupMultiplier: reactionDamageGroupMultiplier
        };
        const reactionAudit: ReactionAudit = {
          ...(propagatedReactionAudit ?? {
            model: "reaction-damage" as const,
            triggered: true,
            reaction,
            reactions: [reaction],
            unsupportedReactions: [],
            mechanicsTruncation: null,
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
            swirlReactions: [],
            swirlDamageGroup: null,
            crystallizeReaction: null,
            catalyzeReaction: null,
            burningReaction: null,
            bloomReactions: []
          }),
          shatterReaction: nestedShatterState?.audit ?? null,
          swirlDamageGroup,
          note:
            application === undefined
              ? `${reactionLabel}自身伤害：不暴击、忽略防御且不附着元素；应用目标元素抗性、伤害策略与对应反应伤害组 ICD。`
              : reactionDamageAuraAllowed
                ? `${reactionLabel}范围传播：先以 ${application.gaugeUnits}U 附着处理目标 Aura 与二次反应，再结算不暴击、无视防御的扩散伤害。`
                : `${reactionLabel}范围传播命中，但目标阶段阻止了元素附着；扩散伤害仍按目标伤害策略结算。`
        };
        damageEvents.push({
          id: damageEventId,
          kind: "transformative-reaction",
          eventPriority: event.priority,
          eventSequence: event.sequence,
          parentDamageEventId: triggerDamageEventId,
          sourceActorId: actorId,
          scalingOwnerId: actorId,
          creditOwnerId: actorId,
          actionId: action.id,
          hitId: resolvedReactionHitId,
          hitGroupId: resolvedReactionHitGroupId,
          targetIndex,
          targetCount: spatialPlans.length,
          targetResolutionId,
          targetId: plan.targetId,
          targetName: targetProfile.name,
          targetDamagePolicy: damageAllowed
            ? "normal"
            : "immune",
          targetDamageMultiplier,
          mechanicsStatus,
          potentialDamage,
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
          additiveReactionFactors,
          damageComposition,
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
          flat: additiveFlatDamage,
          baseDamage: combinedPreResistanceDamage,
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
              calculation.reactionBonus) *
            amplifyingFactors.total,
          groupMultiplier: reactionDamageGroupMultiplier,
          buffs: buffLabels,
          debuffs: debuffLabels
        });
        reactionTriggerDamageEventIds.push(damageEventId);
        reactionLog.damageEventIds.push(damageEventId);
        targetResolution.damageEventId = damageEventId;
        targetResolution.potentialDamage = potentialDamage;
        targetResolution.finalDamage = finalDamage;
        targetResolution.displayDamage = displayDamage;
        if (burningContext !== undefined) {
          const burningLog =
            burningStateLog[
              burningContext.burningStateLogId
            ];
          if (burningLog !== undefined) {
            burningLog.damageEventIds.push(damageEventId);
            if (plan.targetId === sourceTargetId) {
              burningLog.damageAllowed =
                damageAllowed && !mechanicsTruncatedBefore;
              if (
                application?.icdGroup === "burning" &&
                !reactionDamageAuraAllowed
              ) {
                burningLog.applicationAllowed = null;
                burningLog.applicationBlockedReason =
                  "TARGET_AURA_BLOCKED";
                burningLog.icdWindowStartFrame = null;
                burningLog.icdHitIndex = null;
              }
              if (propagatedReactionAudit !== null) {
                burningLog.auraBefore = deepClone(
                  propagatedReactionAudit.auraBefore ?? []
                );
                burningLog.auraApplied = deepClone(
                  propagatedReactionAudit.auraApplied ?? []
                );
                burningLog.auraConsumed = deepClone(
                  propagatedReactionAudit.auraConsumed ?? []
                );
                burningLog.auraAfter = deepClone(
                  propagatedReactionAudit.auraAfter ?? []
                );
                burningLog.applicationAllowed =
                  propagatedReactionAudit.icdAllowed;
                burningLog.applicationBlockedReason =
                  propagatedReactionAudit.icdAllowed === false
                    ? "BURNING_APPLICATION_ICD"
                    : null;
                burningLog.icdWindowStartFrame =
                  burningApplicationIcdDecision?.windowStartFrame ??
                  null;
                burningLog.icdHitIndex =
                  burningApplicationIcdDecision?.hitIndex ?? null;
              }
            }
          }
        }
        recordTargetMechanicsTruncation({
          audit: reactionAudit,
          targetId: plan.targetId,
          targetName: targetProfile.name,
          sourceActorId: actorId,
          sourceActionId: action.id,
          hitId: resolvedReactionHitId,
          triggerDamageEventId: damageEventId,
          frame: event.frame,
          timeSeconds,
          eventPriority: event.priority,
          eventSequence: event.sequence
        });
        if (
          reactionAudit.mechanicsTruncation === null &&
          nestedShatterState !== null
        ) {
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
            // A Shatter triggered by reaction damage also snapshots this
            // nested trigger frame rather than the parent reaction payload.
            const shatterSourceStats = computeStats(
              actorId,
              timeSeconds
            );
            if (shatterSourceStats === undefined) {
              throw new Error(
                `Shatter source stats for "${actorId}" could not be resolved at frame ${event.frame}.`
              );
            }
            const shatterReactionBonusDelta =
              scheduledReactionBonus -
              scheduledStats.reactionBonus;
            scheduleShatterDamage({
              audit: nestedShatterState.audit,
              actorId,
              action,
              triggerHitId: resolvedReactionHitId,
              triggerHitGroupId: resolvedReactionHitGroupId,
              triggerDamageEventId: damageEventId,
              sourceTargetId: plan.targetId,
              stats: shatterSourceStats,
              reactionBonus:
                shatterSourceStats.reactionBonus +
                shatterReactionBonusDelta,
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
              snapshot: "hit",
              cycle,
              triggerFrame: event.frame
            });
          }
        }
        if (
          propagatedReactionAudit !== null &&
          propagatedReactionAudit.mechanicsTruncation === null
        ) {
          processNestedAuraReactionConsequences({
            audit: propagatedReactionAudit,
            damageEventId,
            actorId,
            action,
            hitId: resolvedReactionHitId,
            hitGroupId: resolvedReactionHitGroupId,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            targetPosition: plan.targetPosition,
            stats,
            reactionBonus,
            sourceBuffStatuses,
            snapshot,
            cycle,
            frame: event.frame,
            timeSeconds,
            freezeResistance: targetProfile.freezeResistance,
            eventPriority: event.priority,
            eventSequence: event.sequence,
            nextIntraEventSequence
          });
        }
        if (
          periodicContext !== undefined &&
          plan.targetId === sourceTargetId
        ) {
          periodicDamageEventId = damageEventId;
          periodicActualDamage = finalDamage;
        }
        if (
          statusEffect !== null &&
          mechanicsStatus === "authoritative"
        ) {
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
      const playerSelfDamageReaction:
        | PlayerReactionSelfDamageKind
        | null =
        reaction === "burning" ||
        reaction === "bloom" ||
        reaction === "burgeon" ||
        reaction === "hyperbloom"
          ? reaction
          : null;
      if (
        enabledPlayerDamageModel !== null &&
        playerSelfDamageReaction !== null
      ) {
        if (resolvedReactionCenterPosition === null) {
          throw new Error(
            `${playerSelfDamageReaction} player self-damage at frame ${event.frame} requires an explicit damage center.`
          );
        }
        const playerSourceDamage =
          calcTransformativeReactionDamage({
            characterLevel: sourceActor.level,
            elementalMastery,
            reactionBonus,
            baseMultiplier,
            effectiveResistance: 0
          }).preResistanceDamage;
        resolvePlayerReactionSelfDamage({
          reaction: playerSelfDamageReaction,
          damageElement,
          sourceActorId: actorId,
          sourceTargetId,
          reactionDamageLogId,
          burningStateLogId:
            burningContext?.burningStateLogId ?? null,
          dendroCoreRemovalLogId:
            dendroCoreContext?.removalLogId ?? null,
          damageCenter: resolvedReactionCenterPosition,
          sourcePreResistanceDamage: playerSourceDamage,
          frame: event.frame,
          timeSeconds,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          nextIntraEventSequence
        });
      }
      if (config.reactionEngine?.mode === "aura-v5") {
        processDendroCoreContacts({
          actorId,
          action,
          // A periodic reaction stream can reuse its originating hit identity
          // across multiple queued attacks. Core contact is once per reaction
          // attack event, so give this contact-only identity the stable
          // reaction-damage log id without changing legacy DamageEvent ids.
          hitId: `${resolvedReactionHitId}:reaction-damage-log-${reactionDamageLogId}`,
          hitGroupId: `${resolvedReactionHitGroupId}:reaction-damage-log-${reactionDamageLogId}`,
          element: damageElement,
          application,
          reactionBonusDelta:
            reactionBonus - stats.reactionBonus,
          hitResolutionLogIds: reactionHitResolutionLogIds,
          triggerDamageEventIds:
            reactionTriggerDamageEventIds,
          triggerReactionDamageLogId: reactionDamageLogId,
          resolvedGeometry:
            targetingMode === "radius" &&
            resolvedReactionCenterPosition !== null
              ? {
                  kind: "circle",
                  coordinateSpace: "world",
                  origin: deepClone(
                    resolvedReactionCenterPosition
                  ),
                  radius
                }
              : null,
          cycle,
          frame: event.frame,
          eventType: "reactionDamage",
          eventPriority: event.priority,
          eventSequence: event.sequence,
          nextIntraEventSequence
        });
      }
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
          if (triggerDamageEventId === null) {
            throw new Error(
              "Periodic reaction damage requires a trigger damage event."
            );
          }
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

    if (event.type !== "hit") {
      throw new Error(
        `Unhandled simulation event type "${event.type}".`
      );
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
      resolvedGeometry,
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
    const mechanicsTruncatedBefore =
      auraEngine?.isMechanicsTruncated() ?? false;
    const mechanicsStatus: DamageEvent["mechanicsStatus"] =
      mechanicsTruncatedBefore
        ? "mechanics-truncated"
        : "authoritative";
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
      mechanicsStatus,
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
        hit,
        hitId,
        hitGroupId,
        element,
        cycle,
        frame: event.frame,
        timeSeconds,
        targetId,
        targetResolutionId,
        damageEventId: null,
        targetIndex,
        targetCount,
        landed: false,
        hitConfirmAllowed: false,
        resolvedGeometry,
        eventSequence: event.sequence,
        nextIntraEventSequence
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
    const pendingDirectDamageEventId = damageEvents.length;
    const shatterState =
      auraEngine !== null &&
      auraAllowed &&
      !mechanicsTruncatedBefore
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
    shatterState?.mutations.forEach((mutation) => {
      const shatterTriggered =
        mutation.operation === "shatter-consume";
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: targetProfile.name,
        cause: "direct-hit-shatter",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: shatterTriggered ? "shatter" : "none",
        reactions: shatterTriggered ? ["shatter"] : [],
        primaryDamageEventId: pendingDirectDamageEventId,
        links: [
          {
            kind: "damage-event",
            id: pendingDirectDamageEventId
          }
        ],
        auraBefore: mutation.auraBefore,
        auraConsumed: [
          {
            element: "frozen",
            gaugeUnits: mutation.consumedGaugeUnits
          }
        ],
        auraAfter: mutation.auraAfter
      });
    });
    const manualReaction = auraAllowed ? (hit.reaction ?? "none") : "none";
    const rawReactionAudit: ReactionAudit =
      auraEngine === null
        ? {
            model:
              manualReaction === "none" ? "none" : "manual-override",
            triggered: manualReaction !== "none",
            reaction: manualReaction,
            reactions:
              manualReaction === "none" ? [] : [manualReaction],
            unsupportedReactions: [],
            mechanicsTruncation: null,
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
            swirlReactions: [],
            swirlDamageGroup: null,
            crystallizeReaction: null,
            catalyzeReaction: null,
            burningReaction: null,
            bloomReactions: [],
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
    const reactionAudit =
      projectPlayerSelfDamageStatus(rawReactionAudit);
    if (auraEngine !== null) {
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: targetProfile.name,
        cause: "direct-hit-application",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: reactionAudit.reaction,
        reactions: reactionAudit.reactions,
        primaryDamageEventId: pendingDirectDamageEventId,
        links: [
          {
            kind: "damage-event",
            id: pendingDirectDamageEventId
          },
          ...(reactionAudit.mechanicsTruncation === null
            ? projectedQuickenDecayRebaseLogIds(
                reactionAudit
              ).map((id) => ({
                kind: "quicken-state-log" as const,
                id
              }))
            : [])
        ],
        auraBefore: reactionAudit.auraBefore ?? [],
        auraApplied: reactionAudit.auraApplied ?? [],
        auraConsumed: reactionAudit.auraConsumed ?? [],
        auraAfter: reactionAudit.auraAfter ?? []
      });
    }
    reactionAudit.shatterReaction =
      shatterState?.audit ?? null;
    if (
      reactionAudit.mechanicsTruncation !== null &&
      reactionAudit.shatterReaction?.scheduled === true
    ) {
      reactionAudit.shatterReaction = {
        ...reactionAudit.shatterReaction,
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION"
      };
    }
    const reaction = reactionAudit.reaction;
    let additiveReactionFactors: AdditiveReactionFactors | null =
      null;
    const additiveReaction =
      reactionAudit.catalyzeReaction?.additive;
    if (additiveReaction !== null && additiveReaction !== undefined) {
      const reactionSourceStats = computeStats(
        actorId,
        timeSeconds
      );
      if (reactionSourceStats === undefined) {
        throw new Error(
          `Missing live stats for Catalyze source "${actorId}".`
        );
      }
      const additiveCalculation =
        calcAdditiveReactionDamage({
          reaction: additiveReaction.reaction,
          characterLevel: sourceActor.level,
          elementalMastery: reactionSourceStats.em,
          reactionBonus:
            reactionSourceStats.reactionBonus +
            safeNumber(hit.reactionBonus)
        });
      additiveReactionFactors = {
        reaction: additiveCalculation.reaction,
        sourceActorId: actorId,
        characterLevel: sourceActor.level,
        levelBaseDamage:
          additiveCalculation.levelBaseDamage,
        baseMultiplier: additiveCalculation.baseMultiplier,
        elementalMastery: reactionSourceStats.em,
        elementalMasteryBonus:
          additiveCalculation.elementalMasteryBonus,
        reactionBonus: additiveCalculation.reactionBonus,
        flatDamage: additiveCalculation.flatDamage,
        appliedFlatDamage: additiveCalculation.flatDamage,
        snapshotMode: "hit-time"
      };
    }
    let flatDamageComponents: DamageFlatComponents = {
      ordinaryFlatDamage: flatDamage,
      additiveReactionFlatDamage:
        additiveReactionFactors?.appliedFlatDamage ?? 0
    };
    const amplifyingReaction =
      reaction === "melt" ||
      reaction === "reverseMelt" ||
      reaction === "vaporize" ||
      reaction === "reverseVaporize"
        ? reaction
        : "none";
    let amplifyingElementalMastery = stats.em;
    let amplifyingReactionBonus =
      stats.reactionBonus + safeNumber(hit.reactionBonus);
    if (amplifyingReaction !== "none") {
      const liveReactionSourceStats = computeStats(
        actorId,
        timeSeconds
      );
      const reactionSourceSnapshot =
        hit.snapshot === "action"
          ? snapshots[actorId]
          : liveReactionSourceStats;
      if (
        liveReactionSourceStats === undefined ||
        reactionSourceSnapshot === undefined
      ) {
        throw new Error(
          `Missing amplifying-reaction stats for source "${actorId}".`
        );
      }
      // gcsim's AttackInfo.ActorIndex owns both parts of an amplifying
      // reaction, but they intentionally use different clocks: EM comes from
      // the attack snapshot while reaction bonus is evaluated when damage
      // lands. scalingOwnerId only selects the ordinary direct-damage panel.
      amplifyingElementalMastery = reactionSourceSnapshot.em;
      amplifyingReactionBonus =
        liveReactionSourceStats.reactionBonus +
        safeNumber(hit.reactionBonus);
    }
    let damageInput: DamageCalculationInput = {
      scaling: hit.scaling,
      scalingStat,
      scalingValue,
      flatDamage:
        flatDamageComponents.ordinaryFlatDamage +
        flatDamageComponents.additiveReactionFlatDamage,
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
      elementalMastery: amplifyingElementalMastery,
      reactionBonus: amplifyingReactionBonus,
      // Formal Aura runs derive their amplifying base from the audited
      // reaction. ampBase remains available only to legacy/manual debug runs.
      ...(hit.ampBase === undefined ||
          (auraEngine !== null &&
            reactionAudit.model !== "manual-override")
        ? {}
        : { explicitReactionBase: hit.ampBase }),
      groupMultiplier: safeNumber(hit.groupMultiplier, 1)
    };
    for (const plugin of plugins) {
      const pluginChanges = plugin.runtime.modifyDamage({
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
        reactionAudit,
        additiveReactionFactors:
          additiveReactionFactors === null
            ? null
            : Object.freeze({
                ...additiveReactionFactors,
                appliedFlatDamage:
                  flatDamageComponents.additiveReactionFlatDamage
              }),
        flatDamageComponents: Object.freeze({
          ...flatDamageComponents
        }),
        damageInput: Object.freeze({ ...damageInput })
      });
      const appliedChanges = applyPluginChanges(
        damageInput,
        flatDamageComponents,
        pluginChanges,
        plugin.descriptor.id,
        additiveReactionFactors !== null
      );
      damageInput = appliedChanges.damageInput;
      flatDamageComponents =
        appliedChanges.flatDamageComponents;
    }
    if (additiveReactionFactors !== null) {
      additiveReactionFactors.appliedFlatDamage =
        flatDamageComponents.additiveReactionFlatDamage;
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
    const targetDamageMultiplier =
      damageAllowed && !mechanicsTruncatedBefore ? 1 : 0;
    const finalDamage =
      calculation.finalDamage * targetDamageMultiplier;
    const displayDamage = Math.round(finalDamage);
    const sharedDirectDamageMultiplier =
      factors.damageBonusMultiplier *
      factors.defenseMultiplier *
      factors.resistanceMultiplier *
      factors.critMultiplier *
      factors.amplifyingReactionMultiplier *
      factors.groupMultiplier *
      targetDamageMultiplier;
    const additiveReactionContribution =
      (additiveReactionFactors?.appliedFlatDamage ?? 0) *
      sharedDirectDamageMultiplier;
    const damageComposition: DamageEvent["damageComposition"] = {
      direct: finalDamage - additiveReactionContribution,
      additiveReaction: additiveReactionContribution,
      transformativeReaction: 0
    };
    damageEvents.push({
      id: damageEventId,
      kind: "direct",
      eventPriority: event.priority,
      eventSequence: event.sequence,
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
      mechanicsStatus,
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
      additiveReactionFactors,
      damageComposition,
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
    recordTargetMechanicsTruncation({
      audit: reactionAudit,
      targetId,
      targetName: targetProfile.name,
      sourceActorId: actorId,
      sourceActionId: action.id,
      hitId,
      triggerDamageEventId: damageEventId,
      frame: event.frame,
      timeSeconds,
      eventPriority: event.priority,
      eventSequence: event.sequence
    });
    if (reactionAudit.mechanicsTruncation === null) {
      if (reactionAudit.bloomReactions.length > 0) {
        scheduleBloomCoreSpawns({
          audits: reactionAudit.bloomReactions,
          actorId,
          action,
          triggerHitId: hitId,
          triggerHitGroupId: hitGroupId,
          triggerDamageEventId: damageEventId,
          sourceTargetId: targetId,
          reactionBonusDelta: safeNumber(hit.reactionBonus),
          cycle,
          eventType: "hit",
          eventPriority: event.priority,
          eventSequence: event.sequence,
          nextIntraEventSequence
        });
      }
      if (
        reactionAudit.catalyzeReaction?.quicken != null ||
        reactionAudit.bloomReactions.length > 0
      ) {
        recordQuickenState({
          audit: reactionAudit,
          targetId,
          targetName: targetProfile.name,
          sourceActorId: actorId,
          triggerDamageEventId: damageEventId,
          frame: event.frame,
          timeSeconds
        });
      }
      const burningSourceStats = computeStats(actorId, timeSeconds);
      processBurningConsequences({
        audit: reactionAudit,
        damageEventId,
        actorId,
        action,
        hitId,
        hitGroupId,
        targetId,
        targetName: targetProfile.name,
        stats: burningSourceStats,
        reactionBonus:
          (burningSourceStats?.reactionBonus ?? 0) +
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
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence
      });
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
        // Shatter freezes its own trigger-frame reaction snapshot; it must not
        // inherit the triggering attack's action snapshot.
        const shatterSourceStats = computeStats(
          actorId,
          timeSeconds
        );
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
          snapshot: "hit",
          cycle,
          triggerFrame: event.frame
        });
      }
    }
    if (reactionAudit.swirlReactions.length > 0) {
      const swirlSourceStats = computeStats(actorId, timeSeconds);
      if (swirlSourceStats === undefined) {
        throw new Error(
          `Swirl source stats for "${actorId}" could not be resolved.`
        );
      }
      scheduleSwirlAttacks({
        audits: reactionAudit.swirlReactions,
        actorId,
        action,
        triggerHitId: hitId,
        triggerHitGroupId: hitGroupId,
        triggerDamageEventId: damageEventId,
        sourceTargetId: targetId,
        centerPosition: targetPosition,
        stats: swirlSourceStats,
        reactionBonus:
          swirlSourceStats.reactionBonus +
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
    if (reactionAudit.crystallizeReaction !== null) {
      scheduleCrystallizeShard({
        audit: reactionAudit.crystallizeReaction,
        actorId,
        sourceTargetId: targetId,
        triggerDamageEventId: damageEventId,
        triggerFrame: event.frame
      });
    }
    const transformativeReaction =
      reactionAudit.transformativeReaction;
    if (transformativeReaction !== null) {
      const reactionSourceStats = computeStats(
        actorId,
        timeSeconds
      );
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
        triggerHitGroupId: null,
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
        sourceCoreId: null,
        sourceCoreLogId: null,
        selectionRadius: null,
        selectedTargetId: null,
        resolutionReason: null,
        applicationGaugeUnits: null,
        excludedTargetIds: [],
        checkedTargetIds: [],
        hitTargetIds: [],
        unresolvedTargetIds: [],
        damageGroupBlockedTargetIds: [],
        damageEventIds: [],
        playerHitResolutionLogIds: [],
        playerDamageEventIds: [],
        reactionStatusLogIds: [],
        damageGroupDecisions: []
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
            snapshot: "hit",
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
        reaction === "melt"
          ? "MELT"
          : reaction === "swirlCryo"
            ? "SWIRL"
            : reaction === "crystallizeCryo"
              ? "CRYSTALLIZE"
            : "SUPERCONDUCT";
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
              : reaction === "swirlCryo"
                ? "swirlCryo"
                : reaction === "crystallizeCryo"
                  ? "crystallizeCryo"
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
        const reactionSourceStats = computeStats(
          actorId,
          timeSeconds
        );
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
          snapshot: "hit",
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
    }
    completeHitTarget({
      actorId,
      action,
      hit,
      hitId,
      hitGroupId,
      element,
      cycle,
      frame: event.frame,
      timeSeconds,
      targetId,
      targetResolutionId,
      damageEventId,
      targetIndex,
      targetCount,
      landed: true,
      hitConfirmAllowed,
      resolvedGeometry,
      eventSequence: event.sequence,
      nextIntraEventSequence
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
  const cumulativeByComponent = {
    direct: 0,
    additiveReaction: 0,
    transformativeReaction: 0
  };
  const cumulativeByReaction: Partial<
    Record<TransformativeReaction, number>
  > = {};
  const damageCurve = damageEvents.map((event) => {
    cumulativeDamage += event.finalDamage;
    cumulativeByCharacter[event.creditOwnerId] =
      (cumulativeByCharacter[event.creditOwnerId] ?? 0) + event.finalDamage;
    cumulativeByComponent.direct += event.damageComposition.direct;
    cumulativeByComponent.additiveReaction +=
      event.damageComposition.additiveReaction;
    cumulativeByComponent.transformativeReaction +=
      event.damageComposition.transformativeReaction;
    const transformativeReaction =
      event.transformativeReactionFactors?.reaction;
    if (transformativeReaction !== undefined) {
      cumulativeByReaction[transformativeReaction] =
        (cumulativeByReaction[transformativeReaction] ?? 0) +
        event.damageComposition.transformativeReaction;
    }
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
      cumulativeByCharacter: { ...cumulativeByCharacter },
      cumulativeByComponent: { ...cumulativeByComponent },
      cumulativeByReaction: { ...cumulativeByReaction }
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
          eventPriority: event.eventPriority,
          eventSequence: event.eventSequence,
          targetId: event.targetId,
          targetName: event.targetName,
          frame: event.frame,
          timeSeconds: event.timeSeconds,
          sourceActorId: event.sourceActorId,
          actionId: event.actionId,
          hitId: event.hitId,
          incomingElement: event.element,
          icdAllowed: audit.icdAllowed,
          reaction: audit.reaction,
          reactions: [...audit.reactions],
          unsupportedReactions: [...audit.unsupportedReactions],
          mechanicsTruncation:
            audit.mechanicsTruncation === null
              ? null
              : deepClone(audit.mechanicsTruncation),
          auraBefore: audit.auraBefore,
          auraApplied: audit.auraApplied,
          auraConsumed: audit.auraConsumed,
          auraAfter: audit.auraAfter
        }
      ];
    }
  );
  const durationFrame = Math.round(config.duration * 60);
  const playerHpSummaries: SimulationResult["playerHpSummaries"] =
    [];
  if (enabledPlayerDamageModel !== null) {
    for (const character of config.characters) {
      const hpState = playerHpStateByActorId.get(character.id);
      if (hpState === undefined) {
        throw new Error(
          `Missing final player HP state for character "${character.id}".`
        );
      }
      playerHpTimeline.points.push({
        id: playerHpTimeline.points.length,
        frame: durationFrame,
        timeSeconds: durationFrame / 60,
        eventPriority: null,
        eventSequence: null,
        intraEventSequence: null,
        operation: "simulation-end",
        actorId: character.id,
        playerDamageEventId: null,
        maxHp: hpState.maxHp,
        hpBefore: hpState.currentHp,
        hpAfter: hpState.currentHp,
        hpRatioAfter: hpState.currentHp / hpState.maxHp
      });
      playerHpSummaries.push({
        actorId: character.id,
        maxHp: hpState.maxHp,
        initialHp: hpState.initialHp,
        finalHp: hpState.currentHp,
        totalIncomingDamage:
          hpState.totalIncomingDamage,
        totalAbsorbedDamage:
          hpState.totalAbsorbedDamage,
        totalHpDamage: hpState.totalHpDamage,
        hitCount: hpState.hitCount,
        zeroHpReached: hpState.currentHp === 0
      });
    }
  }
  const totalPlayerDamageTaken = playerDamageEvents.reduce(
    (sum, playerDamageEvent) =>
      sum + playerDamageEvent.finalDamage,
    0
  );
  const totalReactionSelfDamageTaken =
    totalPlayerDamageTaken;
  recordNaturalAuraExpiries(durationFrame, true);
  const auraEndStates: SimulationResult["auraEndStates"] =
    enemyTargets.map((target) => ({
      targetId: target.id,
      targetName: target.name,
      frame: durationFrame,
      timeSeconds: durationFrame / 60,
      aura: deepClone(
        auraEngines?.get(target.id)?.getAuraStateAt(durationFrame) ??
          []
      )
    }));
  for (const endState of auraEndStates) {
    targetStateTimelineRecorder.recordBoundary({
      frame: endState.frame,
      timeSeconds: endState.timeSeconds,
      targetId: endState.targetId,
      targetName: endState.targetName,
      cause: "simulation-end",
      aura: endState.aura
    });
  }
  const targetStateTimeline = targetStateTimelineRecorder.result();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: config.engineVersion,
    dataVersion: config.dataVersion,
    randomSeed: options.randomSeed,
    runManifest,
    resolvedRuntimeOptions:
      runManifest.resolvedRuntimeOptions,
    pluginManifest: runManifest.plugins,
    reproducibilityKey: runManifest.reproducibilityKey,
    compatibilityMode: options.compatibilityMode,
    mechanicsStatus:
      targetMechanicsTruncationLog.length === 0
        ? "complete"
        : "partial",
    config: resultConfig,
    actorPoses,
    enemyTargets,
    damageEvents,
    hitEvents: damageEvents,
    hitResolutionLog,
    targetMechanicsTruncationLog,
    reactionDamageLog,
    reactionStatusLog,
    periodicReactionLog,
    frozenStateLog,
    quickenStateLog,
    burningStateLog,
    dendroCoreLog,
    dendroCoreContactLog,
    dendroCoreTimeline,
    crystallizeShardLog,
    crystallizeShieldLog,
    crystallizeShieldTimeline,
    playerHitResolutionLog,
    playerDamageEvents,
    playerHpTimeline,
    playerHpSummaries,
    playerSelfDamageStatus,
    totalPlayerDamageTaken,
    totalReactionSelfDamageTaken,
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
    targetStateTimeline,
    auraInitialStates,
    auraEndStates,
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
