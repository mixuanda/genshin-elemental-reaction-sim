import { eventStepProtocol, verifiedStepPositions, directHitStepWitnessSink, type PropagationStepEvent, type DirectHitStepSite, type DirectHitStepEvent, type DirectHitStepObserverOptions } from './direct-hit-step-witness';
import { EnemyShieldHost, type EnemyShieldPhaseTask } from "./enemy-shield-host";
import { weaponHitStackTraceForDamageEvent } from "./weapon-hit-stack-trace";
import { WeaponHitStackRuntime, type WeaponHitStackRuntimeDecision } from "./weapon-hit-stack-runtime";
import { getWeaponHitStackRule, type WeaponHitStackEvent } from "./weapon-hit-stack-model";
import { SourceNormalChainRuntime, sourceNormalChainDefinitions, type SourceNormalChainDecision } from "./source-normal-chain";
import type { SourceNormalChainLogEntry } from "@genshin-dps-lab/schemas";
import { ArtifactBuffRuntime, type ArtifactBuffRuntimeDecision } from "./artifact-buff-runtime";
import { ARTIFACT_BUFF_ORDINARY_REACTIONS, type ArtifactBuffEvent, type ArtifactBuffDelayedApplication, type ArtifactBuffOrdinaryReaction } from "@genshin-dps-lab/reaction-formulas";
import { PlayerShieldRuntime, playerShieldStrengthBonus, calculatePlayerShieldHpDamage } from "./player-shield-runtime";
import { LunarArtifactRuntime } from "./lunar-artifact-runtime";
import { MoonlightArtifactRuntime } from "./moonlight-artifact-runtime";
import type { LunarArtifactExecutionOptions } from "@genshin-dps-lab/schemas";
import { calculateActionCondition } from "./action-condition";
import { PeriodicEntityRuntime, calculatePeriodicHealing, type LivePeriodicEntity } from "./periodic-entity";
import type { PeriodicEntityDefinition, PeriodicEntityLogEntry, ActionConditionLogEntry } from "@genshin-dps-lab/schemas";
import { calculateHealthChange } from "./player-health";
import { calculatePlayerMaxHpChange } from "./player-max-hp";
import type { HealthChangeDefinition, PlayerHealthEvent } from "@genshin-dps-lab/schemas";
import { StaminaRuntime } from "./stamina";
import { FavoniusRuntime } from "./favonius";
import { IndependentWeaponProcRuntime, hasRandomWeaponProc, hasStatefulWeaponProc, hasMessengerWeaponProc, hasDelayedWeaponProc, type PendingWeaponProcContext } from "./weapon-proc";
import { ThrillingTalesRuntime, THRILLING_TALES_PROFILE } from "./thrilling-tales";
import { SacrificialRuntime } from "./sacrificial";
import { createSerialSkillCooldown, startSerialSkillCooldown, resetSerialSkillCooldown, recoverSerialSkillCooldown, serialSkillCooldownRemaining, serialSkillCooldownWorker, type SerialSkillCooldownState } from "@genshin-dps-lab/reaction-formulas";
import { getWeaponProcDefinition } from "@genshin-dps-lab/reaction-formulas";
import { calculateStatConversion } from "./stat-conversion";
import { NormalHitEnergyRuntime, type NormalHitEnergyDamageInput } from "./normal-hit-energy";
import { LunarMixedRuntime, validateLunarMixedProfile, type LunarMixedQueueTask, type LunarMixedSimulationResult } from "./lunar-mixed-runtime";
import { LunarMixedV2Runtime, validateLunarMixedV2Profile, type LunarMixedV2QueueTask, type LunarMixedV2SimulationResult } from "./lunar-mixed-v2-runtime";
import { StellarSwirlRuntime, validateStellarSwirlProfile, type StellarSwirlQueueTask, type StellarSwirlExecutionOrder, type StellarSwirlSimulationResult } from "./stellar-swirl-runtime";
import { StellarConductRuntime, validateStellarConductProfile, executeStellarConductAdjustment, type StellarConductPanelSnapshot, type StellarConductSimulationResult } from "./stellar-conduct-runtime";
import { StellarArtifactRuntime } from "./stellar-artifact-runtime";
import { LunarBloomRuntime, validateLunarBloomProfile, type LunarBloomRuntimeOptions, type LunarBloomSimulationResult } from "./lunar-bloom-runtime";
import { SpecialCriticalSampler } from "./special-random";
import {
  actionEventPriority,
  getRuntimeSkillCooldownActors,
  assertTrustedReactionDeliveryResultReferences,
  assertTrustedSimulationResult,
  CALLBACK_SUBSCRIBER_OUTCOME_VERIFICATION,
  CURRENT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationRunManifest,
  dendroCoreResultReferencesSchema,
  electroChargedCleanupResultReferencesSchema,
  migrateConfig,
  playerDamageResultReferencesSchema,
  simulationRunManifestSchema,
  targetClockAuditSchema,
  targetClockLogSchema,
  targetClockResultReferencesSchema,
  targetHitlagLogSchema,
  targetPhaseV2LogSchema,
  targetPhaseV2ResultReferencesSchema,
  targetPhaseV3LogV148Schema,
  targetPhaseV3ResultReferencesSchema,
  targetTaskPhaseLogSchema,
  targetTaskPhaseResultReferencesSchema,
  type AdditiveReactionFactors,
  type AmplifyingReaction,
  type ActionDefinition,
  type ActorPoseDefinition,
  type SummonDefinition,
  type ActiveStatusSnapshot,
  type AnyElementalApplication,
  type AuraElement,
  type AuraStateEntry,
  type BloomReactionAudit,
  type BuffDefinition,
  type BuffStat,
  type CallbackBusEventKindV153,
  type CallbackDeliveryLogEntryV153,
  type CallbackSubscriberAttemptV153,
  type CallbackSubscriberOutcomeV153,
  type CharacterStats,
  type SourceSnapshotLogEntry,
  type PlayerShieldInputEvent,
  type PlayerShieldDecision,
  type CrystallizeReaction,
  type CrystallizeReactionAudit,
  type DamageEvent,
  type DamagePluginDescriptor,
  type DamagePluginManifestEntry,
  type DebuffDefinition,
  type DendroCoreReaction,
  type Element,
  type ElementalApplication,
  type ElementalApplicationIcdDecisionV147,
  type ReactionOwnedElementalApplicationIcdDecisionV149,
  type ElectroChargedCleanupAudit,
  type ElectroChargedPropagationAudit,
  type ElectroChargedPropagationCandidateAudit,
  type EnergySummary,
  type HitGeometry,
  type HitDefinition,
  type HitTargeting,
  type ParticleDefinition,
  type PluginCapabilityV153,
  type ReactionAudit,
  type ReactionADamageGroupDecisionAuditV150,
  type ReactionBDamageGroupDecisionAuditV150,
  type ReactionDamageGroupAuditV149,
  type ReactionDamageGroupDecisionAuditV150,
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
  type SimulationExecutionAudit,
  type SimulationResult,
  type SimulationRunManifest,
  type TargetClockLogEntry,
  type TargetClockSummary,
  type TargetHitlagLogEntry,
  type TargetLifecycleTransition,
  type TargetPhaseV2LogEntry,
  type TargetPhaseV2TargetTask,
  type TargetPhaseV3Delivery,
  type TargetPhaseV3DeliveryAttempt,
  type TargetPhaseV3LogEntry,
  type TargetPhaseV3TargetTask,
  type TimelineExecution,
  type TrustedReactionElementalApplicationChannel
} from "@genshin-dps-lab/schemas";
import { CLASSIC_REACTION_FORMULA_ROOT } from "@genshin-dps-lab/reaction-formulas";
import {
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  resolveBasicReactionSchedulerPolicyRoot,
  resolveCallbackBusPolicyRoot,
  resolveFreezeBrokenAttackPolicyRoot,
  resolveReactionDamageGroupPolicyRoot,
  resolveReactionOwnedApplicationPolicyRoot,
} from "@genshin-dps-lab/icd-profiles";
import {
  AURA_ENGINE_CONSTANTS,
  AuraEngine,
  type DeferredReactionOwnedAttachmentToken,
  type ElectroChargedCleanupResult,
  type ShatterStateResult
} from "./aura";
import {
  calculateParticleEnergy,
  ENERGY_COMPARISON_EPSILON,
  quantizeEnergy,
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
import { calculateDamageTrace, calculateTransformativeDamageTrace } from "./calculator-formula";
import { capturePhaseCheckpoint, phaseCheckpointBlockers } from "./phase-checkpoint";
import { particleRandomness, type RandomExecutionCapturedState } from "./random-checkpoint";
import { ordinaryReactionFeatures } from "./ordinary-aura-checkpoint";
import type { PeriodicReactionHostState } from "./periodic-reaction-checkpoint";
import { TargetHealthRuntime } from "./target-health";
import { ArtifactEventRuntime, NightsoulBurstRuntime, ARTIFACT_EVENT_PROFILE, type ArtifactEventDecision, type ArtifactEnergyTickPayload } from "./artifact-runtime";
import { ArtifactDamageRuntime, artifactDamageTrace, type ArtifactDamageDecision, type ArtifactSongConvertPayload } from "./artifact-damage-runtime";
import { captureTargetPhaseV2State } from "./target-phase-checkpoint";
import { LunarChargedRuntime, validateLunarChargedProfile, type LunarChargedSimulationResult } from "./lunar-charged-runtime";
import { LunarCrystallizeRuntime, validateLunarCrystallizeProfile, type LunarCrystallizeSimulationResult } from "./lunar-crystallize-runtime";
import { MinHeap } from "./min-heap";
import type {
  DamageFlatComponents,
  DamageModifierPlugin,
  DamagePluginChanges,
  DamageModifierPluginRuntime
} from "./plugins";
import {
  assertFormulaBoundDamagePluginChanges,
  defineDamageModifierPlugin,
} from "./plugins";
import {
  compileLegalTimeline,
  type RuntimeEnergyFailure
} from "./legal-timeline";
import { assertSourceActionContract, assertSourceActionExecution } from "./source-action-library";
import {
  calcCrystallizeShield,
  CRYSTALLIZE_CONSTANTS,
  type CrystallizeShieldCalculation
} from "./crystallize";
import {
  auraStateSnapshotsEqual,
  TargetStateTimelineRecorder
} from "./target-state-timeline";
import { copyGeneratedAuraStates } from "./aura-state-copy";
import {
  ReactionDamageGroupTaskEngine,
  type ReactionDamageGroupAttemptResult,
  type ReactionDamageGroupResetExecution,
  type ReactionDamageGroupResetTask,
  type ReactionDamageGroupResetTaskDraft,
} from "./reaction-damage-group";
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
import {
  calculateEnemyHitlagExtension,
  TargetLocalClock,
  type TargetLocalClockState
} from "./target-clock";
import { DirectDamageGroupEngine } from "./direct-damage-group";
import {
  skippedConfiguredElementalApplicationDecision,
  skippedReactionOwnedElementalApplicationDecision
} from "./elemental-application-decision";
import {
  buildFreezeBrokenAttackLogEntry,
  classifyFreezeBrokenAttackTransition,
} from "./freeze-broken-attack";
import { FreezeBrokenCallbackAuditBuffer } from "./freeze-broken-callback-log";
import {
  TypedCallbackBus,
  type CallbackBusCompletedDeliveryAttempt,
} from "./callback-bus";
import {
  defineCallbackSubscriberPluginV153,
  isCallbackSubscriberPluginV153,
  isDamageModifierPluginV153,
  type CallbackSubscriberPluginContextV153,
  type CallbackSubscriberPluginRuntimeV153,
  type FreezeBrokenCallbackPayloadMapV153,
  type SimulationRuntimePluginV153,
} from "./callback-plugins";

export const EVENT_PRIORITY = {
  enemyShieldPhase: -2,
  sourceNormalChainSwapStart: 8,
  playerMaxHpExpiry: -1,
  playerShieldExpiry: -0.5,
  playerShieldInput: 2,
  artifactEnergyTick: 2,
  artifactSongConvert: 2,
  artifactBuffApply: 2,
  nightsoulBurstCallback: 3,
  skillCooldownStart: -1,
  skillCooldownRecover: -1,
  weaponHitStackCallback: 3,
  weaponProcCallback: 3,
  weaponProcDelayedSnapshot: 3,
  action: 0,
  energyCost: 2,
  healthChange: 2,
  periodicEntitySpawn: 2,
  periodicEntityTick: 2,
  normalHitEnergy: 3.5,
  summonSpawn: 2,
  summonExpiry: 2,
  targetTask: 0.5,
  targetDecay: 0.75,
  buff: 1,
  debuff: 1,
  energy: 2,
  particleSpawn: 2,
  particleReceive: 2,
  sourceSnapshot: 2.5,
  hit: 3,
  stellarSwirlTask: 3,
  lunarMixedTask: 3,
  lunarMixedV2Task: 3,
  quickenBloomFollowup: 3,
  periodicReactionExpiry: 2,
  electroChargedCleanup: 2,
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
  reactionDamageGroupReset: 5,
  reactionAuraAttachment: 5,
  freezeBrokenCallback: 5.5,
  periodicReactionWane: 6,
  crystallizePickup: 7
} as const;

const lunarChargedRuntimeSink = Symbol("lunar-charged-runtime-sink");
const lunarCrystallizeRuntimeSink = Symbol("lunar-crystallize-runtime-sink");
const stellarConductRuntimeSink = Symbol("stellar-conduct-runtime-sink");
const lunarBloomRuntimeSink = Symbol("lunar-bloom-runtime-sink");
const stellarSwirlRuntimeSink = Symbol("stellar-swirl-runtime-sink");
const lunarMixedRuntimeSink = Symbol("lunar-mixed-runtime-sink");
const lunarMixedV2RuntimeSink = Symbol("lunar-mixed-v2-runtime-sink");

export interface SimulationRuntimeOptions extends SimulationOptions, DirectHitStepObserverOptions {
  plugins?: readonly SimulationRuntimePluginV153[];
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

function resolveEnemyBaseResistance(
  target: SimulationResult["enemyTargets"][number],
  element: Element
): number {
  return target.resistances?.[element] ?? target.resistance;
}

function readReactionApplicationAura(
  auraEngine: AuraEngine | null,
  eventFrame: number,
  preserveCurrentTargetState: boolean
): AuraStateEntry[] {
  if (auraEngine === null) return [];
  return auraEngine.getAuraStateAt(
    preserveCurrentTargetState
      ? auraEngine.getCurrentFrame()
      : eventFrame
  );
}

const ENEMY_RESISTANCE_ELEMENTS = [
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "anemo",
  "geo",
  "dendro",
  "physical"
] as const satisfies readonly Element[];

/**
 * Lightweight equivalent of the enemy-target projection that the public
 * target-clock reference Schema applies even when target-local clocks are
 * disabled. This intentionally avoids reparsing the complete SimulationResult
 * on the hot compatibility path while retaining every resolved-target and
 * per-damage-event base-resistance invariant.
 */
export function validateEnemyTargetOutputProjection(
  result: Pick<
    SimulationResult,
    "config" | "enemyTargets" | "damageEvents"
  >
): void {
  const configuredTargets = result.config.enemy.targets ?? [
    {
      id: "enemy-0",
      name: "敌人 0"
    }
  ];
  if (result.enemyTargets.length !== configuredTargets.length) {
    throw new Error(
      "enemyTargets must contain exactly one resolved row for each configured target."
    );
  }

  for (const [index, configuredTarget] of
    configuredTargets.entries()) {
    const resolvedTarget = result.enemyTargets[index]!;
    const expectedScalarResistance =
      configuredTarget.resistance ??
      result.config.enemy.resistance;
    const expectedResistances =
      configuredTarget.resistance !== undefined
        ? undefined
        : configuredTarget.resistances ??
          result.config.enemy.resistances;
    const expectedInitialAura =
      configuredTarget.initialAura ??
      result.config.reactionEngine?.initialAura ??
      [];
    const expectedPosition = configuredTarget.position ?? null;
    const issue = (field: string): never => {
      throw new Error(
        `enemyTargets[${index}].${field} does not match its configured target projection.`
      );
    };

    if (resolvedTarget.id !== configuredTarget.id) issue("id");
    if (resolvedTarget.name !== configuredTarget.name) issue("name");
    if (
      resolvedTarget.level !==
      (configuredTarget.level ?? result.config.enemy.level)
    ) {
      issue("level");
    }
    if (
      resolvedTarget.resistance !== expectedScalarResistance
    ) {
      issue("resistance");
    }
    if (expectedResistances === undefined) {
      if (
        Object.prototype.hasOwnProperty.call(
          resolvedTarget,
          "resistances"
        )
      ) {
        issue("resistances");
      }
    } else if (
      resolvedTarget.resistances === undefined ||
      ENEMY_RESISTANCE_ELEMENTS.some(
        (element) =>
          resolvedTarget.resistances?.[element] !==
          expectedResistances[element]
      )
    ) {
      issue("resistances");
    }
    if (
      resolvedTarget.defReduction !==
      (configuredTarget.defReduction ??
        result.config.enemy.defReduction)
    ) {
      issue("defReduction");
    }
    if (
      resolvedTarget.freezeResistance !==
      (configuredTarget.freezeResistance ??
        result.config.enemy.freezeResistance ??
        0)
    ) {
      issue("freezeResistance");
    }
    if (
      JSON.stringify(resolvedTarget.initialAura) !==
      JSON.stringify(expectedInitialAura)
    ) {
      issue("initialAura");
    }
    if (
      JSON.stringify(resolvedTarget.position) !==
      JSON.stringify(expectedPosition)
    ) {
      issue("position");
    }
    if (
      resolvedTarget.hitboxRadius !==
      (configuredTarget.hitboxRadius ?? 0)
    ) {
      issue("hitboxRadius");
    }
  }

  const resolvedTargetById = new Map(
    result.enemyTargets.map((target) => [target.id, target])
  );
  for (const [eventIndex, event] of
    result.damageEvents.entries()) {
    const resolvedTarget = resolvedTargetById.get(event.targetId);
    if (resolvedTarget === undefined) {
      throw new Error(
        `damageEvents[${eventIndex}].targetId does not reference a resolved enemy target.`
      );
    }
    if (
      event.enemyStateBeforeHit.baseResistance !==
      resolveEnemyBaseResistance(resolvedTarget, event.element)
    ) {
      throw new Error(
        `damageEvents[${eventIndex}].enemyStateBeforeHit.baseResistance does not match the resolved target resistance.`
      );
    }
  }
}

/**
 * Disabled player damage cannot retain references to logs that are required to
 * be empty. Kept separate so the simulator hot path and forged-output tests use
 * the same linear check.
 */
export function validateDisabledPlayerDamageBackReferences(
  result: Pick<SimulationResult, "reactionDamageLog">
): void {
  for (const [index, entry] of
    result.reactionDamageLog.entries()) {
    if (
      entry.playerHitResolutionLogIds.length !== 0 ||
      entry.playerDamageEventIds.length !== 0
    ) {
      throw new Error(
        `reactionDamageLog[${index}] must have empty player back-references while player damage is disabled.`
      );
    }
  }
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

interface DelayedEnergyCostPayload { actorId: string; actionId: string; actionLogIndex: number; energyCost: number; }
interface SummonSpawnPayload extends ActionEventPayload { summon: SummonDefinition; actionTimeSeconds: number; }
interface ActiveTimedSummon extends SummonSpawnPayload { instanceId: string; spawnFrame: number; expiresAtFrame: number; attackFrame: number; snapshots: Record<string, CharacterStats | undefined>; actorPose: ActorPoseDefinition | undefined; thrillingTalesSnapshotStatuses?: Record<string, ActiveStatusSnapshot[]>; }

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
  favoniusLogId?: number;
  origin?: NonNullable<SimulationResult["particleEvents"][number]["origin"]>;
}

interface ParticleReceiveEventPayload {
  particleEventId: number;
  declaredDrop?: true;
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
  sourceSnapshots?: { main?: number; reaction?: number; flatSources?: Record<number, number> };
  periodicFlatSnapshots?: Record<string, CharacterStats | undefined>;
  periodicEntityContext?: { entity: LivePeriodicEntity; tickIndex: number; tickFrame: number };
  weaponProcLogId?: number;
  weaponProcContext?: PendingWeaponProcContext;
  thrillingTalesSnapshotStatuses?: Record<string, ActiveStatusSnapshot[]>;
  cycle: number;
}

interface QuickenBloomFollowupEventPayload {
  targetId: string;
  sourceActorId: string;
  action: ActionDefinition;
  triggerHitId: string;
  triggerHitGroupId: string;
  triggerDamageEventId: number;
  triggerElement: "dendro" | "electro";
  reactionBonusDelta: number;
  cycle: number;
  triggerEventType: "hit" | "reactionDamage";
  triggerEventPriority: number;
  triggerEventSequence: number;
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
    | "nearest-target-radius"
    | "electro-charged-nearby-wet";
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
  /** Closed, engine-owned reaction application channel. */
  reactionApplication?: {
    channel: TrustedReactionElementalApplicationChannel;
    nominalGaugeUnits: number;
  };
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

interface ReactionDamageGroupResetEventPayload {
  resetLogId: number;
  task: Readonly<ReactionDamageGroupResetTask>;
}

interface ReactionAuraAttachmentEventPayload {
  token: DeferredReactionOwnedAttachmentToken;
  attackSchedulerLogId: number;
  parentEventSequence: number;
  reactionDamageLogId: number;
  hitResolutionLogId: number;
  elementalApplicationIcdLogId: number;
  sourceActorId: string;
  targetId: string;
  element: "pyro" | "hydro" | "cryo" | "electro";
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

interface PeriodicReactionTickEventPayload {
  targetId: string;
  generation: number;
  tickIndex: number;
  firstTick: boolean;
  pinnedSource?: PeriodicReactionSourceSnapshot;
}

interface PeriodicReactionWaneEventPayload {
  targetId: string;
  generation: number;
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

interface ElectroChargedCleanupEventPayload {
  targetId: string;
  generation: number;
  reactionTaskLogId: number;
  deadlineTargetFrame: number;
}

interface BurningTickEventPayload {
  targetId: string;
  generation: number;
  /** One-based counter from the fixed Burning task chain. */
  tickIndex: number;
}

interface TargetDecayEventPayload {
  targetId: string;
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

interface FreezeBrokenCallbackEventPayload {
  freezeBrokenAttackLogId: number;
}

interface FreezeBrokenCallbackDispatchSource {
  freezeBrokenAttackLogId: number;
  frozenStateEntry: SimulationResult["frozenStateLog"][number];
  depletionDamageEventId: number | null;
  sourceFreezeDamageEventId: number | null;
  triggerEventType: SimulationEvent["type"];
  triggerEventPriority: number;
  triggerEventSequence: number;
  triggerIntraEventSequence: number;
}

interface PendingFreezeBrokenCallback {
  source: FreezeBrokenCallbackDispatchSource;
  syncCallbackDeliveryLogIds: [number, number, number];
  taskSequence: number;
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
  initialMaxHp: number;
  totalMaxHpAdjustment: number;
  initialHp: number;
  currentHp: number;
  initialBondOfLife?: number;
  currentBondOfLife?: number;
  totalIncomingDamage: number;
  totalAbsorbedDamage: number;
  totalHpDamage: number;
  totalHealing: number;
  totalOverheal: number;
  totalHpConsumed: number;
  hitCount: number;
  zeroHpReached: boolean;
}

interface HealthChangePayload { change: HealthChangeDefinition; sourceActorId: string; actionLogIndex: number; }

interface PeriodicSpawnPayload { action: ActionDefinition; actionLogIndex: number; cycle: number; definition: PeriodicEntityDefinition; }
interface PeriodicTickPayload { entity: LivePeriodicEntity; tickIndex: number; }
interface SkillCooldownTaskPayload { actorId: string; actionId: string; abilityId: string; timelineCommandIndex: number; recoveryFrames: number; workerGeneration?: number; }
interface WeaponProcCallbackPayload { actorId: string; parentDamageEventId: number; targetId: string; attackTag: NonNullable<HitDefinition["attackTag"]> | null; damage: number; cycle: number;
  hitWeakPoint?: boolean;
  sourceActionId?: string; sourceHitId?: string; parentHitFrame?: number; parentEventPriority?: number; parentEventSequence?: number; }
interface WeaponProcDelayedSnapshotPayload {
  actorId: string; targetId: string; parentDamageEventId: number; cycle: number; weaponProcLogId: number;
  triggerFrame: number; coefficient: number; sourceActionId: string; sourceHitId: string;
  parentEventPriority: number; parentHitFrame: number;
}
interface NightsoulBurstCallbackPayload { parentDamageEventId: number; sourceActorId: string; sourceActionId: string; sourceHitId: string; targetId: string; parentHitFrame: number; parentEventPriority: number; parentEventSequence: number; element: Element; cycle: number; }

interface SourceSnapshotPayload { action: ActionDefinition; cycle: number; actionLogIndex: number; ownerId: string; relativeFrame: number; snapshotLogId: number; }

type InternalEventBase =
  | { type: "enemyShieldPhase"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: EnemyShieldPhaseTask }
  | { type: "weaponHitStackCallback"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: { input: Extract<WeaponHitStackEvent, {kind:"enemy-damage"}> } }
  | { type: "sourceNormalChainSwapStart"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: { actorId: string; timelineCommandIndex: number } }
  | { type: "artifactBuffApply"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: { task: ArtifactBuffDelayedApplication; parentArtifactBuffLogId: number } }
  | { type: "playerShieldInput"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: { input: PlayerShieldInputEvent } }
  | { type: "playerShieldExpiry"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: Record<string, never> }
  | { type: "sourceSnapshot"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: SourceSnapshotPayload }
  | { type: "playerMaxHpExpiry"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: Record<string, never> }
  | { type: "artifactEnergyTick"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: ArtifactEnergyTickPayload }
  | { type: "artifactSongConvert"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: ArtifactSongConvertPayload }
  | { type: "nightsoulBurstCallback"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: NightsoulBurstCallbackPayload }
  | { type: "weaponProcDelayedSnapshot"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: WeaponProcDelayedSnapshotPayload }
  | { type: "weaponProcCallback"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: WeaponProcCallbackPayload }
  | { type: "skillCooldownStart" | "skillCooldownRecover"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: SkillCooldownTaskPayload }
  | { type: "periodicEntitySpawn"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: PeriodicSpawnPayload }
  | { type: "periodicEntityTick"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: PeriodicTickPayload }
  | { type: "healthChange"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: HealthChangePayload }
  | { type: "normalHitEnergy"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: NormalHitEnergyDamageInput }
  | { type: "energyCost"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: DelayedEnergyCostPayload }
  | { type: "summonSpawn"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: SummonSpawnPayload }
  | { type: "summonExpiry"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: { instanceId: string } }
  | { type: "stellarSwirlTask"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: StellarSwirlQueueTask }
  | { type: "lunarMixedTask"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: LunarMixedQueueTask }
  | { type: "lunarMixedV2Task"; timeSeconds: number; frame: number; priority: number; sequence: number; payload: LunarMixedV2QueueTask }
  | SimulationEvent<ActionEventPayload>
  | SimulationEvent<BuffEventPayload>
  | SimulationEvent<DebuffEventPayload>
  | SimulationEvent<EnergyEventPayload>
  | SimulationEvent<ParticleSpawnEventPayload>
  | SimulationEvent<ParticleReceiveEventPayload>
  | SimulationEvent<HitEventPayload>
  | SimulationEvent<QuickenBloomFollowupEventPayload>
  | SimulationEvent<ReactionDamageEventPayload>
  | SimulationEvent<ReactionDamageGroupResetEventPayload>
  | SimulationEvent<ReactionAuraAttachmentEventPayload>
  | SimulationEvent<PeriodicReactionTickEventPayload>
  | SimulationEvent<PeriodicReactionWaneEventPayload>
  | SimulationEvent<PeriodicReactionExpiryEventPayload>
  | SimulationEvent<ElectroChargedCleanupEventPayload>
  | SimulationEvent<BurningTickEventPayload>
  | SimulationEvent<BurningFuelExpiryEventPayload>
  | SimulationEvent<FrozenExpiryEventPayload>
  | SimulationEvent<QuickenExpiryEventPayload>
  | SimulationEvent<DendroCoreSpawnEventPayload>
  | SimulationEvent<DendroCoreExpiryEventPayload>
  | SimulationEvent<CrystallizeShardSpawnEventPayload>
  | SimulationEvent<CrystallizeShardExpiryEventPayload>
  | SimulationEvent<CrystallizePickupEventPayload>
  | SimulationEvent<CrystallizeShieldExpiryEventPayload>
  | {
      type: "freezeBrokenCallback";
      timeSeconds: number;
      frame: number;
      priority: number;
      sequence: number;
      payload: FreezeBrokenCallbackEventPayload;
    }
  | {
      type: "targetDecay";
      timeSeconds: number;
      frame: number;
      priority: number;
      sequence: number;
      payload: TargetDecayEventPayload;
    };

interface TargetLocalTaskDeadline {
  targetId: string;
  targetFrame: number;
}

type InternalEvent = InternalEventBase & {
  /** Internal-only heap order; public/audit eventSequence remains unchanged. */
  queueOrderSequence?: number;
  /**
   * Immutable target-local deadline for the logical task. `frame` is only the
   * current global wake-up projection and may move after later Hitlag.
   */
  targetLocalDeadline?: TargetLocalTaskDeadline;
};

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

function assertNonNegativeFixedEnergyGains(config: SimConfig): void {
  type FixedEnergyGainSource = Readonly<{
    id: string;
    energyGains?: readonly Readonly<{ amount: number }>[];
  }>;
  const actionGroups: ReadonlyArray<
    readonly [
      source: "rotation action" | "timeline ability",
      actions: readonly FixedEnergyGainSource[]
    ]
  > = [
    ["rotation action", config.rotation],
    ["timeline ability", config.timeline?.abilities ?? []]
  ];

  for (const [source, actions] of actionGroups) {
    for (const action of actions) {
      for (const [gainIndex, gain] of (
        action.energyGains ?? []
      ).entries()) {
        if (gain.amount >= 0) continue;
        throw new Error(
          `Invalid fixed energy gain in ${source} "${action.id}" at energyGains[${gainIndex}]: amount must be non-negative; energyGains cannot represent energy drains (received ${gain.amount}).`
        );
      }
    }
  }
}

function toFrame(timeSeconds: number): number {
  return Math.round(timeSeconds * 60);
}

function requireOwnDataProperty(
  value: object,
  key: PropertyKey,
  label: string,
): unknown {
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (property === undefined || !("value" in property)) {
    throw new TypeError(`${label} must be an own data property.`);
  }
  return property.value;
}

function normalizeRuntimePluginDescriptor(
  value: unknown,
  pluginIndex: number,
): DamagePluginDescriptor {
  if (value === null || typeof value !== "object") {
    throw new TypeError(
      `Runtime plugin ${pluginIndex} descriptor must be an object.`,
    );
  }
  return Object.freeze({
    id: requireOwnDataProperty(
      value,
      "id",
      `Runtime plugin ${pluginIndex} descriptor.id`,
    ) as string,
    version: requireOwnDataProperty(
      value,
      "version",
      `Runtime plugin ${pluginIndex} descriptor.version`,
    ) as string,
    kind: requireOwnDataProperty(
      value,
      "kind",
      `Runtime plugin ${pluginIndex} descriptor.kind`,
    ) as DamagePluginDescriptor["kind"],
    contentHash: requireOwnDataProperty(
      value,
      "contentHash",
      `Runtime plugin ${pluginIndex} descriptor.contentHash`,
    ) as string,
  });
}

/**
 * Takes one immutable authority snapshot before any manifest or runtime work.
 *
 * Executable plugin objects are untrusted inputs. Re-reading an accessor-backed
 * `capability` could otherwise let one object declare callback-only authority
 * in the reproducibility identity and later execute as a damage modifier.
 */
function normalizeRuntimePlugins(
  plugins: readonly SimulationRuntimePluginV153[],
): readonly SimulationRuntimePluginV153[] {
  return Object.freeze(
    plugins.map((plugin, pluginIndex) => {
      if (plugin === null || typeof plugin !== "object") {
        throw new TypeError(`Runtime plugin ${pluginIndex} must be an object.`);
      }
      const capabilityProperty = Object.getOwnPropertyDescriptor(
        plugin,
        "capability",
      );
      if (
        capabilityProperty === undefined &&
        "capability" in plugin
      ) {
        throw new TypeError(
          `Runtime plugin ${pluginIndex} capability must not be inherited.`,
        );
      }
      if (
        capabilityProperty !== undefined &&
        !("value" in capabilityProperty)
      ) {
        throw new TypeError(
          `Runtime plugin ${pluginIndex} capability must be an own data property.`,
        );
      }

      const descriptor = normalizeRuntimePluginDescriptor(
        requireOwnDataProperty(
          plugin,
          "descriptor",
          `Runtime plugin ${pluginIndex} descriptor`,
        ),
        pluginIndex,
      );
      const createRuntime = requireOwnDataProperty(
        plugin,
        "createRuntime",
        `Runtime plugin ${pluginIndex} createRuntime`,
      );
      if (typeof createRuntime !== "function") {
        throw new TypeError(
          `Runtime plugin ${pluginIndex} createRuntime must be a function.`,
        );
      }

      if (capabilityProperty === undefined) {
        return defineDamageModifierPlugin(
          descriptor,
          createRuntime as () => DamageModifierPluginRuntime,
        );
      }
      if (capabilityProperty.value !== "callback-subscriber") {
        throw new TypeError(
          `Runtime plugin ${pluginIndex} has unsupported capability ${String(capabilityProperty.value)}.`,
        );
      }
      const subscriptions = requireOwnDataProperty(
        plugin,
        "subscriptions",
        `Runtime plugin ${pluginIndex} subscriptions`,
      );
      if (!Array.isArray(subscriptions)) {
        throw new TypeError(
          `Runtime plugin ${pluginIndex} subscriptions must be an array.`,
        );
      }
      const normalizedSubscriptions = subscriptions.map(
        (subscription, subscriptionIndex) => {
          if (subscription === null || typeof subscription !== "object") {
            throw new TypeError(
              `Runtime plugin ${pluginIndex} subscription ${subscriptionIndex} must be an object.`,
            );
          }
          return Object.freeze({
            eventKind: requireOwnDataProperty(
              subscription,
              "eventKind",
              `Runtime plugin ${pluginIndex} subscription ${subscriptionIndex}.eventKind`,
            ) as CallbackBusEventKindV153,
            subscriberKey: requireOwnDataProperty(
              subscription,
              "subscriberKey",
              `Runtime plugin ${pluginIndex} subscription ${subscriptionIndex}.subscriberKey`,
            ) as string,
          });
        },
      );
      return defineCallbackSubscriberPluginV153(
        descriptor,
        normalizedSubscriptions,
        createRuntime as () => CallbackSubscriberPluginRuntimeV153,
      );
    }),
  );
}

function createPluginManifest(
  plugins: readonly SimulationRuntimePluginV153[]
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

function createPluginCapabilities(
  plugins: readonly SimulationRuntimePluginV153[]
): PluginCapabilityV153[] {
  return plugins.map((plugin) =>
    isCallbackSubscriberPluginV153(plugin)
      ? "callback-subscriber"
      : "damage-modifier"
  );
}

function createPluginCallbackSubscriptions(
  plugins: readonly SimulationRuntimePluginV153[]
): SimulationRunManifest["pluginCallbackSubscriptions"] {
  return plugins.map((plugin) =>
    isCallbackSubscriberPluginV153(plugin)
      ? plugin.subscriptions.map((subscription) => ({
          eventKind: subscription.eventKind,
          subscriberKey: subscription.subscriberKey
        }))
      : []
  );
}

interface ActiveDamageModifierPlugin {
  pluginManifestIndex: number;
  descriptor: DamageModifierPlugin["descriptor"];
  runtime: DamageModifierPluginRuntime;
}

function instantiateDamagePlugins(
  plugins: readonly SimulationRuntimePluginV153[]
): ActiveDamageModifierPlugin[] {
  return plugins.flatMap((plugin, pluginManifestIndex) => {
    if (!isDamageModifierPluginV153(plugin)) return [];
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
    return [{
      pluginManifestIndex,
      descriptor: plugin.descriptor,
      runtime
    }];
  });
}

interface FreezeBrokenCallbackDispatchContext {
  eventIndex: 0 | 1 | 2 | 3 | 4;
  eventKind: CallbackBusEventKindV153;
  frame: number;
  targetFrame: number | null;
  timeSeconds: number;
  targetId: SimulationResult["frozenStateLog"][number]["targetId"];
  targetName: string;
  generation: number;
  sourceFrozenStateLogId: number;
  freezeBrokenAttackLogId: number;
  payload: Readonly<
    FreezeBrokenCallbackPayloadMapV153[CallbackBusEventKindV153]
  >;
}

type FreezeBrokenCallbackDispatchPayloads = {
  [Kind in CallbackBusEventKindV153]: FreezeBrokenCallbackDispatchContext;
};

type FreezeBrokenCallbackOutcomes = {
  [Kind in CallbackBusEventKindV153]: CallbackSubscriberOutcomeV153;
};

interface FreezeBrokenCallbackEventIndexByKind {
  "on-aura-durability-depleted-frozen": 0;
  "on-apply-attack-freeze-broken": 1;
  "on-enemy-hit-freeze-broken": 2;
  "on-enemy-damage-freeze-broken-zero": 3;
  "attack-callback-freeze-broken": 4;
}

interface CallbackPluginSource {
  pluginManifestIndex: number;
  pluginId: string;
}

interface ActiveCallbackBus {
  bus: TypedCallbackBus<
    FreezeBrokenCallbackDispatchPayloads,
    FreezeBrokenCallbackOutcomes
  >;
  registrationSourceByLogId: Map<number, CallbackPluginSource>;
  subscriptionSourceById: Map<number, CallbackPluginSource>;
}

function exactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function validateCallbackSubscriberOutcome(
  value: unknown,
  context: CallbackSubscriberPluginContextV153,
  pluginId: string,
): CallbackSubscriberOutcomeV153 {
  if (
    value === null ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error(
      `Callback plugin "${pluginId}" must return a plain structured outcome.`,
    );
  }
  const record = value as Record<string, unknown>;
  if (
    record.kind === "no-side-effect" &&
    exactObjectKeys(record, ["kind"])
  ) {
    return Object.freeze({ kind: "no-side-effect" });
  }
  if (
    record.kind === "freeze-broken-audit" &&
    exactObjectKeys(record, [
      "kind",
      "freezeBrokenAttackLogId",
      "sourceFrozenStateLogId",
    ]) &&
    record.freezeBrokenAttackLogId === context.freezeBrokenAttackLogId &&
    record.sourceFrozenStateLogId === context.sourceFrozenStateLogId
  ) {
    return Object.freeze({
      kind: "freeze-broken-audit",
      freezeBrokenAttackLogId: context.freezeBrokenAttackLogId,
      sourceFrozenStateLogId: context.sourceFrozenStateLogId,
    });
  }
  throw new Error(
    `Callback plugin "${pluginId}" returned an invalid outcome for ${context.eventKind}; audit references must match the current Freeze Broken context exactly.`,
  );
}

function instantiateCallbackBus(
  plugins: readonly SimulationRuntimePluginV153[],
  enabled: boolean,
): ActiveCallbackBus {
  const bus = new TypedCallbackBus<
    FreezeBrokenCallbackDispatchPayloads,
    FreezeBrokenCallbackOutcomes
  >();
  const registrationSourceByLogId = new Map<number, CallbackPluginSource>();
  const subscriptionSourceById = new Map<number, CallbackPluginSource>();

  for (const [pluginManifestIndex, plugin] of plugins.entries()) {
    if (!isCallbackSubscriberPluginV153(plugin)) continue;
    if (!enabled) {
      throw new Error(
        `Callback plugin "${plugin.descriptor.id}" requires callbackBusModel fixed-gcsim-versioned-callback-bus-v2.`,
      );
    }
    const runtime = plugin.createRuntime();
    if (
      runtime === null ||
      typeof runtime !== "object" ||
      typeof runtime.handleCallback !== "function"
    ) {
      throw new Error(
        `Callback plugin "${plugin.descriptor.id}" returned an invalid runtime.`,
      );
    }
    const source = {
      pluginManifestIndex,
      pluginId: plugin.descriptor.id,
    };
    for (const subscription of plugin.subscriptions) {
      const registration = bus.subscribe(
        subscription.eventKind,
        subscription.subscriberKey,
        (dispatchContext) => {
          const context = Object.freeze({
            ...dispatchContext,
            payload: Object.freeze({ ...dispatchContext.payload }),
            subscriberKey: subscription.subscriberKey,
          }) as CallbackSubscriberPluginContextV153;
          return validateCallbackSubscriberOutcome(
            runtime.handleCallback(context),
            context,
            plugin.descriptor.id,
          );
        },
      );
      registrationSourceByLogId.set(registration.id, source);
      if (registration.currentSubscriptionId === null) {
        throw new Error(
          `Callback plugin "${plugin.descriptor.id}" produced an inactive subscription.`,
        );
      }
      subscriptionSourceById.set(registration.currentSubscriptionId, source);
    }
  }

  return {
    bus,
    registrationSourceByLogId,
    subscriptionSourceById,
  };
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
      `Damage plugin "${pluginId}" returned an invalid numeric ${field} override; expected a finite number.`
    );
  }
  return value;
}

const DAMAGE_PLUGIN_NUMERIC_CHANGE_FIELDS = [
  "scaling",
  "scalingValue",
  "flatDamage",
  "ordinaryFlatDamage",
  "additiveReactionFlatDamage",
  "damageBonus",
  "characterLevel",
  "enemyLevel",
  "defenseReduction",
  "defenseIgnore",
  "effectiveResistance",
  "critRate",
  "critDamage",
  "elementalMastery",
  "reactionBonus",
  "explicitReactionBase",
  "groupMultiplier"
] as const;

const DAMAGE_PLUGIN_ALLOWED_CHANGE_FIELDS = new Set<string>([
  ...DAMAGE_PLUGIN_NUMERIC_CHANGE_FIELDS,
  "scalingStat",
  "critMode",
  "reaction"
]);

function assertPlainDamagePluginChanges(
  changes: unknown,
  pluginId: string
): asserts changes is DamagePluginChanges {
  if (
    changes === null ||
    typeof changes !== "object" ||
    Array.isArray(changes) ||
    Object.getPrototypeOf(changes) !== Object.prototype
  ) {
    throw new Error(
      `Damage plugin "${pluginId}" must return undefined or a plain object of supported overrides.`
    );
  }
  for (const key of Reflect.ownKeys(changes)) {
    if (
      typeof key !== "string" ||
      !DAMAGE_PLUGIN_ALLOWED_CHANGE_FIELDS.has(key)
    ) {
      throw new Error(
        `Damage plugin "${pluginId}" returned unknown override field "${String(key)}".`
      );
    }
  }
}

function requirePluginEnumValue<const Value extends string>(
  pluginId: string,
  field: string,
  value: unknown,
  allowed: readonly Value[]
): Value {
  if (
    typeof value !== "string" ||
    !allowed.includes(value as Value)
  ) {
    throw new Error(
      `Damage plugin "${pluginId}" returned an invalid ${field} override; expected one of ${allowed.join(", ")}.`
    );
  }
  return value as Value;
}

function applyPluginChanges(
  input: DamageCalculationInput,
  flatDamageComponents: DamageFlatComponents,
  changes: DamagePluginChanges | void,
  pluginId: string,
  hasAdditiveReaction: boolean,
  schemaVersion: string
): AppliedDamagePluginChanges {
  if (changes === undefined) {
    return {
      damageInput: input,
      flatDamageComponents
    };
  }
  assertPlainDamagePluginChanges(changes, pluginId);

  if (
    schemaVersion === REACTION_FORMULA_ROOT_SCHEMA_VERSION ||
    schemaVersion === DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION
  ) {
    assertFormulaBoundDamagePluginChanges(
      changes,
      pluginId
    );
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

  for (const field of DAMAGE_PLUGIN_NUMERIC_CHANGE_FIELDS) {
    if (!hasOwn(changes, field)) continue;
    requireFinitePluginNumber(pluginId, field, changes[field]);
  }
  if (hasOwn(changes, "scalingStat")) {
    requirePluginEnumValue(
      pluginId,
      "scalingStat",
      changes.scalingStat,
      ["atk", "hp", "def", "em"] as const
    );
  }
  if (hasOwn(changes, "critMode")) {
    requirePluginEnumValue(
      pluginId,
      "critMode",
      changes.critMode,
      ["average", "allCrit", "noCrit"] as const
    );
  }
  if (hasOwn(changes, "reaction")) {
    requirePluginEnumValue(
      pluginId,
      "reaction",
      changes.reaction,
      [
        "none",
        "melt",
        "reverseMelt",
        "vaporize",
        "reverseVaporize"
      ] as const
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
    nextOrdinaryFlatDamage = legacyFlatDamage as number;
  }
  if (hasOrdinaryFlat) {
    nextOrdinaryFlatDamage = ordinaryFlatDamage as number;
  }
  if (hasAdditiveFlat) {
    nextAdditiveReactionFlatDamage =
      additiveReactionFlatDamage as number;
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
  const normalChainDefinitions = sourceNormalChainDefinitions(resultConfig.sourceAbilityBindings);
  const sourceNormalChainRuntime = normalChainDefinitions.length ? new SourceNormalChainRuntime(normalChainDefinitions) : undefined;
  const sourceNormalChainLog: SourceNormalChainLogEntry[] = [];
  const periodicEntitiesEnabled = [...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => (action.periodicEntities?.length ?? 0) > 0);
  const healthChangesEnabled = periodicEntitiesEnabled || [...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => (action.healthChanges?.length ?? 0) > 0);
  const actionConditionsEnabled = [...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => action.conditionalHitGroups?.length);
  const explicitSourceSnapshotsEnabled = [...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => action.hits?.some(hit => hit.snapshotFrame !== undefined || hit.flatSources?.some(source => source.snapshotFrame !== undefined)));
  const explicitActionPhasesEnabled = [...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => action.actionPhase !== undefined);
  const actionConditionLog: ActionConditionLogEntry[] = [];
  const periodicEntityRuntime = new PeriodicEntityRuntime();
  const periodicEntityLog: PeriodicEntityLogEntry[] = [];
  const staminaRuntime = config.staminaModel === undefined ? undefined : new StaminaRuntime(config.staminaModel);
  const hasExplicitCriticalIneligibility = config.rotation.some((action) => action.hits?.some((hit) => hit.critEligible === false));
  const hasExplicitWeakPoint = config.rotation.some(action => action.hits?.some(hit => hit.hitWeakPoint !== undefined));
  const requestedExecution = explicitSourceSnapshotsEnabled || hasExplicitCriticalIneligibility || hasExplicitWeakPoint || config.favoniusModel !== undefined || config.weaponProcModel !== undefined || config.thrillingTalesModel !== undefined || config.sacrificialModel !== undefined || config.artifactDamageModel !== undefined || config.weaponHitStackModel !== undefined || config.stellarArtifactModel !== undefined || config.moonlightArtifactModel !== undefined
    ? { ...runtimeOptions.execution, captureHits: true }
    : runtimeOptions.execution;
  const options: ResolvedSimulationRuntimeOptions = {
    energyMode: runtimeOptions.energyMode ?? "configured",
    critMode: runtimeOptions.critMode ?? "average",
    compatibilityMode:
      runtimeOptions.compatibilityMode ??
      (healthChangesEnabled || actionConditionsEnabled || explicitActionPhasesEnabled || timelineExecution || hasRandomWeaponProc(config.weaponProcModel) || hasStatefulWeaponProc(config.weaponProcModel) || hasMessengerWeaponProc(config.weaponProcModel) || hasDelayedWeaponProc(config.weaponProcModel) ||
      config.targetTaskModel.mode === "target-phase-v1" ||
      config.targetTaskModel.mode === "target-phase-v2" ||
      config.targetTaskModel.mode === "target-phase-v3"
        ? "legal-frame-v1"
        : "legacy-v0.1"),
    randomSeed: runtimeOptions.randomSeed ?? config.randomSeed,
    ...(requestedExecution === undefined ? {} : { execution: deepClone(requestedExecution) })
  };
  if (config.playerShieldModel !== undefined && options.compatibilityMode !== "legal-frame-v1") throw new Error("Player shields require compatibilityMode legal-frame-v1.");
  if (explicitSourceSnapshotsEnabled && options.compatibilityMode !== "legal-frame-v1") throw new Error("Explicit source snapshots require compatibilityMode legal-frame-v1.");
  if (options.compatibilityMode === "legal-frame-v1") options.flatStatBuffSemantics = "canonical-v1";
  if (
    (config.targetTaskModel.mode === "target-phase-v1" ||
      config.targetTaskModel.mode === "target-phase-v2" ||
      config.targetTaskModel.mode === "target-phase-v3") &&
    options.compatibilityMode !== "legal-frame-v1"
  ) {
    throw new Error(
      `targetTaskModel ${config.targetTaskModel.mode} requires compatibilityMode legal-frame-v1.`
    );
  }
  const pluginDefinitions = normalizeRuntimePlugins(
    runtimeOptions.plugins ?? [],
  );
  const pluginManifest = createPluginManifest(
    pluginDefinitions
  );
  const pluginCapabilities = createPluginCapabilities(pluginDefinitions);
  const pluginCallbackSubscriptions = createPluginCallbackSubscriptions(
    pluginDefinitions
  );
  const runManifest = simulationRunManifestSchema.parse(
    createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: config.engineVersion,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(resultConfig),
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        resolveReactionOwnedApplicationPolicyRoot(
          config.reactionOwnedElementalApplicationModel.policyId
        ),
      reactionDamageGroupRoot: resolveReactionDamageGroupPolicyRoot(
        config.reactionDamageGroupModel.policyId,
      ),
      basicReactionSchedulerRoot:
        resolveBasicReactionSchedulerPolicyRoot(
          config.basicReactionSchedulerModel.policyId,
        ),
      freezeBrokenAttackRoot: resolveFreezeBrokenAttackPolicyRoot(
        config.freezeBrokenAttackModel.policyId,
      ),
      callbackBusRoot: resolveCallbackBusPolicyRoot(
        config.callbackBusModel.policyId,
      ),
      resolvedRuntimeOptions: options,
      plugins: pluginManifest,
      pluginCapabilities,
      pluginCallbackSubscriptions
    })
  ) as unknown as SimulationRunManifest;
  const damagePluginsByManifestIndex = new Map(
    instantiateDamagePlugins(pluginDefinitions).map((plugin) => [
      plugin.pluginManifestIndex,
      plugin,
    ]),
  );
  const callbackBusEnabled =
    config.callbackBusModel.mode ===
    "fixed-gcsim-versioned-callback-bus-v2";
  if (
    config.freezeBrokenAttackModel.mode ===
      "fixed-gcsim-freeze-broken-callback-dispatch-v3" &&
    !callbackBusEnabled
  ) {
    throw new Error(
      "Freeze Broken V3 requires callbackBusModel fixed-gcsim-versioned-callback-bus-v2.",
    );
  }
  const callbackRuntime = instantiateCallbackBus(
    pluginDefinitions,
    callbackBusEnabled,
  );
  const random = new SeededRandom(options.randomSeed);
  const particleTriggerRandom = new SeededRandom(`${options.randomSeed}\u0000particle-trigger-v1`);
  let particleTriggerDrawCount = 0;
  const criticalRandomSeed = `${options.randomSeed}:critical-hit-v1`;
  const criticalRandom = new SeededRandom(criticalRandomSeed);
  let criticalDrawCount = 0;
  const executionOptions = options.execution;
  const specialHost = executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed ||
    executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom;
  if (config.stellarArtifactModel !== undefined) {
    if (!executionOptions?.stellarConduct && !executionOptions?.stellarSwirl) throw new Error("固定a7星辉圣遗物只可接入已实现的星导／星扩散特殊宿主。");
    if (executionOptions?.stellarSwirl && config.stellarArtifactModel.allowGuideSourceConflict !== true) throw new Error("星扩散指南宿主与固定a7源码冲突；启用星辉圣遗物混合参考配置必须显式确认来源冲突。");
  }
  if (config.moonlightArtifactModel !== undefined && !executionOptions?.lunarCharged && !executionOptions?.lunarCrystallize && !executionOptions?.lunarBloom && !executionOptions?.lunarMixed && !executionOptions?.lunarMixedV2) throw new Error("固定a7月曜圣遗物仅支持五个月曜特殊宿主。");
  if ((executionOptions?.stellarConduct || executionOptions?.stellarSwirl) && config.artifactBuffModel?.actors.some(actor => actor.effectId === "instructor-4pc" || actor.effectId === "gilded-4pc")) {
    throw new Error("教官／饰金的星辉特殊反应回调尚无来源时序认证。");
  }
  if ((executionOptions?.lunarBloom || executionOptions?.lunarMixedV2) && config.artifactBuffModel?.actors.some(actor => actor.effectId === "paradise-4pc")) {
    throw new Error("乐园普通绽放与月绽放的反应加成不同；当前普通圣遗物回调尚不能认证月绽放条款。");
  }
  if (specialHost && config.artifactDamageModel?.actors.some(actor => actor.effectId === "song-of-days-past-4pc")) {
    throw new Error("昔时之歌的五次伤害加成尚未认证月曜／星辉直接能力的 OnEnemyHit 标签。");
  }
  if (config.enemyShieldModel !== undefined && (executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom)) throw new Error("当前敌盾宿主仅接入普通直接伤害；特殊反应尚无削盾、生命伤害和接触回调的完整宿主。");
  if (config.weaponHitStackModel !== undefined) {
    if (options.compatibilityMode !== "legal-frame-v1") throw new Error("武器叠层需要实际合法帧时间线。");
    if (config.weaponHitStackModel.actors.some(actor => getWeaponHitStackRule(actor.weaponId).family === "royal") && options.critMode === "average" && executionOptions?.criticalSampling !== "seeded-random-v1") throw new Error("宗室叠层需要实际暴击反馈：使用带种子随机暴击、全部暴击或全部不暴击。");
  }
  if (config.targetHealthModel !== undefined &&
      (executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom)) {
    throw new Error("声明敌人生命尚未接入月曜／星辉独立伤害管线；不能只扣除普通命中的生命而忽略特殊伤害。");
  }
  if (config.favoniusModel !== undefined) {
    if (options.critMode === "average" && executionOptions?.criticalSampling !== "seeded-random-v1") {
      throw new Error("西风触发需要实际二元暴击结果：请选择随机暴击、全部暴击或全部不暴击；平均伤害不能代替触发事件。");
    }
    if (executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom) {
      throw new Error("西风触发尚未接入月曜／星辉特殊宿主回调；请使用普通团队模拟。");
    }
  }
  if (config.weaponProcModel !== undefined &&
      (executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom)) {
    throw new Error("独立武器追击仅接入普通伤害回调，尚未接入月曜／星辉特殊宿主。");
  }
  if ((hasRandomWeaponProc(config.weaponProcModel) || hasStatefulWeaponProc(config.weaponProcModel) || hasMessengerWeaponProc(config.weaponProcModel) || hasDelayedWeaponProc(config.weaponProcModel)) && options.compatibilityMode !== "legal-frame-v1") {
    throw new Error("随机／状态／弱点武器追击的实际同相位 FIFO 回调需要 legal-frame-v1 帧时钟。");
  }
  if (config.sacrificialModel !== undefined &&
      (executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom)) {
    throw new Error("祭礼技能重置仅接入普通合法轮转与普通伤害回调。");
  }
  const captureResolvedHits = executionOptions !== undefined &&
    (executionOptions.captureHits !== false || executionOptions.detailedTraces === true || executionOptions.criticalSampling !== undefined);
  const resolvedHitContexts = new Map<number, SimulationExecutionAudit["hits"][number]>();
  const crystallizeRandom = new SeededRandom(
    `${options.randomSeed}:crystallize-shard-position-v1`
  );
  const dendroCoreRandom = new SeededRandom(`${options.randomSeed}:dendro-core-position-v1`);
  const dendroCoreManager = new DendroCoreManager(dendroCoreRandom);
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
  ).map((target) => {
    const resolvedResistances =
      target.resistance !== undefined
        ? undefined
        : target.resistances ?? config.enemy.resistances;
    return {
      id: target.id,
      name: target.name,
      level: target.level ?? config.enemy.level,
      resistance: target.resistance ?? config.enemy.resistance,
      ...(resolvedResistances === undefined
        ? {}
        : { resistances: deepClone(resolvedResistances) }),
      defReduction: target.defReduction ?? config.enemy.defReduction,
      freezeResistance:
        target.freezeResistance ??
        config.enemy.freezeResistance ??
        0,
      initialAura: deepClone(
        target.initialAura ?? config.reactionEngine?.initialAura ?? []
      ),
      position:
        target.position === undefined
          ? null
          : deepClone(target.position),
      hitboxRadius: target.hitboxRadius ?? 0
    };
  });
  const enemyTargetById = new Map(
    enemyTargets.map((target) => [target.id, target])
  );
  const directDamageGroupEngines = new Map(
    enemyTargets.map((target) => [
      target.id,
      new DirectDamageGroupEngine()
    ])
  );
  const enemyTargetOrderById = new Map(
    enemyTargets.map((target, index) => [target.id, index])
  );
  const targetPhaseV1Enabled =
    config.targetTaskModel.mode === "target-phase-v1";
  const targetPhaseV2Enabled =
    config.targetTaskModel.mode === "target-phase-v2" ||
    config.targetTaskModel.mode === "target-phase-v3";
  const targetPhaseV3Enabled =
    config.targetTaskModel.mode === "target-phase-v3";
  const auraV9Enabled = config.reactionEngine?.mode === "aura-v9";
  const electroChargedV9Fields = (
    cadenceStatus: "scheduled" | "dormant" | "stopped" | undefined,
    waneListenerActive: boolean | undefined,
  ):
    | {
        cadenceStatus: "scheduled" | "dormant" | "stopped";
        waneListenerActive: boolean;
      }
    | Record<string, never> => {
    if (!auraV9Enabled) return {};
    if (cadenceStatus === undefined || waneListenerActive === undefined) {
      throw new Error(
        "Aura-v9 Electro-Charged output is missing global-cadence state.",
      );
    }
    return { cadenceStatus, waneListenerActive };
  };
  // Pinned gcsim delivers a zero-delay Shatter inside its parent core task;
  // V2 reset reconciliation therefore uses that parent's task sequence.
  const recursiveShatterDeliveryEnabled =
    config.reactionDeliveryModel.mode ===
    "shatter-recursive-zero-delay-v1";
  const deferredSwirlAuraAttachmentEnabled =
    config.basicReactionSchedulerModel.mode ===
    "fixed-gcsim-basic-reaction-scheduler-v2";
  const targetPhaseEnabled = targetPhaseV1Enabled;
  const targetPhaseAuditEnabled =
    targetPhaseV1Enabled || targetPhaseV2Enabled;
  const burningAtomicPriorityStride =
    1 / (enemyTargets.length * 2 + 1);
  const targetPhasePriorityStride =
    0.5 / (enemyTargets.length + 1);
  const targetPhaseV2TaskPriorityForTarget = (
    targetId: string
  ): number =>
    EVENT_PRIORITY.targetTask +
    (enemyTargetOrderById.get(targetId) ?? 0) *
      targetPhasePriorityStride;
  const targetPhaseV2DecayPriorityForTarget = (
    targetId: string
  ): number =>
    targetPhaseV2TaskPriorityForTarget(targetId) +
    targetPhasePriorityStride * 0.5;
  const targetPhaseV2LifecyclePriorityForTarget = (
    targetId: string,
    kind:
      | "burningFuelExpiry"
      | "quickenExpiry"
      | "frozenExpiry"
      | "periodicReactionExpiry"
      | "electroChargedCleanup"
  ): number => {
    const lifecycleOrder = {
      burningFuelExpiry: 0,
      quickenExpiry: 1,
      frozenExpiry: 2,
      periodicReactionExpiry: 3,
      electroChargedCleanup: 4
    } as const;
    return (
      targetPhaseV2TaskPriorityForTarget(targetId) +
      targetPhasePriorityStride *
        (0.6 + lifecycleOrder[kind] * 0.08)
    );
  };
  const burningTickPriorityForTarget = (
    targetId: string
  ): number =>
    targetPhaseV2Enabled
      ? targetPhaseV2TaskPriorityForTarget(targetId)
      : targetPhaseEnabled
      ? EVENT_PRIORITY.targetTask +
        (enemyTargetOrderById.get(targetId) ?? 0) *
          targetPhasePriorityStride
      : EVENT_PRIORITY.burningTick +
        (enemyTargetOrderById.get(targetId) ?? 0) *
          2 *
          burningAtomicPriorityStride;
  const burningDamagePriorityForTarget = (
    targetId: string
  ): number =>
    targetPhaseV3Enabled
      // A v3 Burning root is a zero-delay child of this target's callback:
      // later than the owner task, earlier than its Reactable.Tick decay.
      ? targetPhaseV2TaskPriorityForTarget(targetId) +
        targetPhasePriorityStride * 0.25
      : targetPhaseAuditEnabled
        ? EVENT_PRIORITY.reactionDamage +
          (enemyTargetOrderById.get(targetId) ?? 0) *
            targetPhasePriorityStride
        : burningTickPriorityForTarget(targetId) +
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
  const targetClockEnabled =
    config.targetClockModel.mode ===
    "target-local-hitlag-v1";
  const targetClocks = targetClockEnabled
    ? new Map(
        enemyTargets.map((target) => [
          target.id,
          new TargetLocalClock()
        ])
      )
    : null;
  const burningClockModel = targetClockEnabled
    ? ("target-local-hitlag-v1" as const)
    : ("target-local-no-hitlag" as const);
  const enemyHitlagStatus = targetClockEnabled
    ? ("modeled-enemy-hitlag" as const)
    : ("unsupported-enemy-hitlag" as const);
  const dendroCoreClockModel = targetClockEnabled
    ? ("global-frame-gadget-v1" as const)
    : ("global-frame-no-hitlag" as const);
  const dendroCoreHitlagStatus = targetClockEnabled
    ? ("not-affected-by-enemy-hitlag" as const)
    : ("unsupported-enemy-hitlag" as const);
  const projectedTargetDeadline = (
    targetId: string,
    globalDeadline: number | null
  ): number | null | undefined => {
    const clock = targetClocks?.get(targetId);
    if (clock === undefined) return undefined;
    return globalDeadline === null
      ? null
      : clock.projectLocalFrameAtGlobalFrame(globalDeadline);
  };
  const targetLifecycleFields = (
    targetId: string,
    globalFrame: number,
    expiresAtFrame: number | null
  ):
    | {
        targetFrame: number;
        expiresAtTargetFrame: number | null;
      }
    | Record<string, never> =>
    targetClocks === null
      ? targetPhaseV2Enabled
        ? {
            targetFrame: globalFrame,
            expiresAtTargetFrame: expiresAtFrame
          }
        : {}
      : {
          targetFrame:
            targetClocks
              .get(targetId)!
              .projectLocalFrameAtGlobalFrame(globalFrame),
          expiresAtTargetFrame:
            projectedTargetDeadline(
              targetId,
              expiresAtFrame
            ) ?? null
        };
  const targetQuickenLifecycleFields = (
    targetId: string,
    globalFrame: number,
    expiresAtFrameBefore: number | null,
    expiresAtFrameAfter: number | null
  ):
    | {
        targetFrame: number;
        expiresAtTargetFrameBefore: number | null;
        expiresAtTargetFrame: number | null;
      }
    | Record<string, never> =>
    targetClocks === null
      ? targetPhaseV2Enabled
        ? {
            targetFrame: globalFrame,
            expiresAtTargetFrameBefore:
              expiresAtFrameBefore,
            expiresAtTargetFrame: expiresAtFrameAfter
          }
        : {}
      : {
          targetFrame:
            targetClocks
              .get(targetId)!
              .projectLocalFrameAtGlobalFrame(globalFrame),
          expiresAtTargetFrameBefore:
            projectedTargetDeadline(
              targetId,
              expiresAtFrameBefore
            ) ?? null,
          expiresAtTargetFrame:
            projectedTargetDeadline(
              targetId,
              expiresAtFrameAfter
            ) ?? null
        };
  const targetBurningLifecycleFields = (
    targetId: string,
    globalFrame: number,
    fuelExpiresAtFrame: number | null,
    nextTickFrame: number | null
  ):
    | {
        targetFrame: number;
        fuelExpiresAtTargetFrame: number | null;
        nextTickTargetFrame: number | null;
      }
    | { targetFrame: number }
    | Record<string, never> =>
    targetClocks === null
      ? targetPhaseV2Enabled
        ? {
            targetFrame: globalFrame
          }
        : {}
      : {
          targetFrame:
            targetClocks
              .get(targetId)!
              .projectLocalFrameAtGlobalFrame(globalFrame),
          fuelExpiresAtTargetFrame:
            projectedTargetDeadline(
              targetId,
              fuelExpiresAtFrame
            ) ?? null,
          nextTickTargetFrame:
            projectedTargetDeadline(
              targetId,
              nextTickFrame
            ) ?? null
        };
  const auraEngines =
    config.reactionEngine?.mode === "aura-v1" ||
    config.reactionEngine?.mode === "aura-v2" ||
    config.reactionEngine?.mode === "aura-v3" ||
    config.reactionEngine?.mode === "aura-v4" ||
    config.reactionEngine?.mode === "aura-v5" ||
    config.reactionEngine?.mode === "aura-v6" ||
    config.reactionEngine?.mode === "aura-v7" ||
    config.reactionEngine?.mode === "aura-v8" ||
    config.reactionEngine?.mode === "aura-v9"
      ? new Map(
          enemyTargets.map((target) => [
            target.id,
            new AuraEngine({
              ...config.reactionEngine!,
              ...(options.execution?.lunarCharged === undefined ? {} : { lunarChargedConversion: true }),
              ...(options.execution?.lunarCrystallize === undefined ? {} : { lunarCrystallizeConversion: true }),
              ...(options.execution?.stellarConduct === undefined ? {} : { stellarConductConversion: true }),
              ...(options.execution?.stellarSwirl === undefined ? {} : { stellarSwirlConversion: true }),
              ...(options.execution?.lunarMixed === undefined ? {} : { lunarChargedConversion: true, lunarCrystallizeConversion: true, lunarMixedConversion: true }),
              ...(options.execution?.lunarMixedV2 === undefined ? {} : { lunarChargedConversion: true, lunarCrystallizeConversion: true, lunarMixedConversion: true, lunarDendroConversion: true }),
              reactionOwnedElementalApplicationModel:
                config.reactionOwnedElementalApplicationModel,
              ...(targetPhaseV2Enabled
                ? {
                    reactableTickModel:
                      "cached-boundary-v2" as const
                  }
                : {}),
              initialAura: deepClone(target.initialAura),
              freezeResistance: target.freezeResistance,
              ...(targetClocks?.get(target.id) === undefined
                ? {}
                : {
                    targetClock: targetClocks.get(target.id)!
                  })
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
    new TargetStateTimelineRecorder(
      targetClocks === null
        ? targetPhaseV2Enabled
          ? (_targetId, globalFrame) => globalFrame
          : undefined
        : (targetId, globalFrame) => {
            const clock = targetClocks.get(targetId);
            if (clock === undefined) {
              throw new Error(
                `Missing target clock for target-state point "${targetId}".`
              );
            }
            return clock.projectLocalFrameAtGlobalFrame(
              globalFrame
            );
          }
    );
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
  const isolateNaturalAuraExpiry = (
    auraBefore: readonly AuraStateEntry[],
    auraAfter: readonly AuraStateEntry[],
    frame: number
  ): {
    auraBefore: AuraStateEntry[];
    auraAfter: AuraStateEntry[];
  } => {
    const specialBoundaryElements = new Set<
      AuraStateEntry["element"]
    >();
    const burningFuelExpiresNow = auraBefore.some(
      (entry) =>
        entry.element === "burningFuel" &&
        entry.expiresAtFrame === frame
    );
    if (burningFuelExpiresNow) {
      for (const element of [
        "burningFuel",
        "burning",
        "dendro",
        "quicken"
      ] as const) {
        specialBoundaryElements.add(element);
      }
    } else if (
      auraBefore.some(
        (entry) =>
          entry.element === "quicken" &&
          entry.expiresAtFrame === frame
      )
    ) {
      specialBoundaryElements.add("quicken");
    }
    if (
      auraBefore.some(
        (entry) =>
          entry.element === "frozen" &&
          entry.expiresAtFrame === frame
      )
    ) {
      specialBoundaryElements.add("frozen");
    }
    const expiringOrdinaryElements = new Set(
      auraBefore
        .filter(
          (entry) =>
            ordinaryAuraElements.has(entry.element) &&
            entry.expiresAtFrame === frame &&
            !specialBoundaryElements.has(entry.element)
        )
        .map((entry) => entry.element)
    );
    const pointBefore = [
      ...auraAfter.filter(
        (entry) =>
          !expiringOrdinaryElements.has(entry.element) &&
          !specialBoundaryElements.has(entry.element)
      ),
      ...auraBefore.filter(
        (entry) =>
          expiringOrdinaryElements.has(entry.element) ||
          specialBoundaryElements.has(entry.element)
      )
    ].sort((left, right) =>
      left.element.localeCompare(right.element)
    );
    const pointAfter = [
      ...auraAfter.filter(
        (entry) =>
          !specialBoundaryElements.has(entry.element)
      ),
      ...auraBefore.filter((entry) =>
        specialBoundaryElements.has(entry.element)
      )
    ].sort((left, right) =>
      left.element.localeCompare(right.element)
    );
    return {
      auraBefore: pointBefore,
      auraAfter: pointAfter
    };
  };
  const ordinaryExpiryFrameScratch = new Array<number>(
    enemyTargets.length
  ).fill(Number.POSITIVE_INFINITY);
  let recordTargetPhaseV2NaturalExpiry: (input: {
    targetId: string;
    targetName: string;
    globalFrame: number;
    auraBefore: readonly AuraStateEntry[];
    auraAfter: readonly AuraStateEntry[];
    targetStateTimelinePointId: number;
  }) => void = () => {};
  const recordNaturalAuraExpiries = (
    limitFrame: number,
    includeLimit: boolean,
    targetOrderExclusive = enemyTargets.length
  ): void => {
    if (auraEngines === null) return;
    while (true) {
      let nextExpiryFrame = Number.POSITIVE_INFINITY;
      ordinaryExpiryFrameScratch.fill(
        Number.POSITIVE_INFINITY
      );
      for (
        let targetIndex = 0;
        targetIndex < targetOrderExclusive;
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
        targetIndex < targetOrderExclusive;
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
          const naturalBoundary = targetPhaseV2Enabled
            ? isolateNaturalAuraExpiry(
                deepClone(auraBefore),
                deepClone(auraAfter),
                nextExpiryFrame
              )
            : {
                auraBefore: deepClone(auraBefore),
                auraAfter: deepClone(auraAfter)
              };
          const targetStateTimelinePointId =
            targetStateTimelineRecorder.result().points.length;
          targetStateTimelineRecorder.recordNaturalExpiry({
            frame: nextExpiryFrame,
            timeSeconds: nextExpiryFrame / 60,
            targetId: target.id,
            targetName: target.name,
            auraBefore: naturalBoundary.auraBefore,
            auraAfter: naturalBoundary.auraAfter
          });
          recordTargetPhaseV2NaturalExpiry({
            targetId: target.id,
            targetName: target.name,
            globalFrame: nextExpiryFrame,
            auraBefore: naturalBoundary.auraBefore,
            auraAfter: naturalBoundary.auraAfter,
            targetStateTimelinePointId
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
        const naturalBoundary = targetPhaseV2Enabled
          ? isolateNaturalAuraExpiry(
              deepClone(auraBefore),
              deepClone(auraAfter),
              nextExpiryFrame
            )
          : {
              auraBefore: deepClone(auraBefore),
              auraAfter: deepClone(auraAfter)
            };
        const targetStateTimelinePointId =
          targetStateTimelineRecorder.result().points.length;
        targetStateTimelineRecorder.recordNaturalExpiry({
          frame: nextExpiryFrame,
          timeSeconds: nextExpiryFrame / 60,
          targetId: target.id,
          targetName: target.name,
          auraBefore: naturalBoundary.auraBefore,
          auraAfter: naturalBoundary.auraAfter
        });
        recordTargetPhaseV2NaturalExpiry({
          targetId: target.id,
          targetName: target.name,
          globalFrame: nextExpiryFrame,
          auraBefore: naturalBoundary.auraBefore,
          auraAfter: naturalBoundary.auraAfter,
          targetStateTimelinePointId
        });
      }
    }
  };
  const characters = new Map(
    config.characters.map((character) => [character.id, character])
  );
  const normalHitEnergyRuntime = config.normalHitEnergyModel === undefined ? undefined : new NormalHitEnergyRuntime({ seed: options.randomSeed, actors: config.normalHitEnergyModel.actors });
  const favoniusRuntime = config.favoniusModel === undefined ? undefined : new FavoniusRuntime(options.randomSeed, config.favoniusModel);
  const weaponProcRuntime = config.weaponProcModel === undefined ? undefined : new IndependentWeaponProcRuntime(config.weaponProcModel, options.randomSeed);
  const thrillingTalesRuntime = config.thrillingTalesModel === undefined ? undefined : new ThrillingTalesRuntime(config.thrillingTalesModel);
  const sacrificialRuntime = config.sacrificialModel === undefined ? undefined : new SacrificialRuntime(options.randomSeed, config.sacrificialModel);
  const artifactEventRuntime = config.artifactEventModel === undefined ? undefined : new ArtifactEventRuntime(config.artifactEventModel, config.characters.map(character => character.id));
  const weaponHitStackRuntime = config.weaponHitStackModel === undefined ? undefined : new WeaponHitStackRuntime(config.weaponHitStackModel);
  const artifactBuffRuntime = config.artifactBuffModel === undefined ? undefined : new ArtifactBuffRuntime(config.artifactBuffModel, config.characters);
  const stellarArtifactRuntime = config.stellarArtifactModel === undefined ? undefined : new StellarArtifactRuntime(config.stellarArtifactModel, config.characters.map(character => character.id));
  const artifactDamageRuntime = config.artifactDamageModel === undefined ? undefined : new ArtifactDamageRuntime(config.artifactDamageModel, config.characters.map(character => character.id), options.randomSeed);
  const nightsoulBurstRuntime = config.nightsoulBurstModel === undefined ? undefined : new NightsoulBurstRuntime(config.nightsoulBurstModel);
  const sourceAbilityById = new Map((resultConfig.timeline?.abilities ?? []).map(ability => [ability.id, ability]));
  const runtimeSkillActors = getRuntimeSkillCooldownActors(resultConfig);
  const runtimeSkillAbilities = new Map((resultConfig.timeline?.abilities ?? []).filter(ability => ability.kind === "skill" && runtimeSkillActors.has(ability.actorId)).map(ability => [ability.id, ability]));
  const skillCooldownStates = new Map<string, SerialSkillCooldownState>();
  for (const ability of runtimeSkillAbilities.values()) if (!skillCooldownStates.has(ability.actorId)) skillCooldownStates.set(ability.actorId, createSerialSkillCooldown(ability.maxCharges ?? 1));
  const thrillingTalesSnapshots = new WeakMap<Record<string, CharacterStats | undefined>, Record<string, ActiveStatusSnapshot[]>>();
  const energies = new Map<string, number>();
  const reservedEnergy = new Map<string, number>();
  const activeTimedSummons = new Map<string, ActiveTimedSummon>();
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
  // Preserve only tasks actually scheduled by the supported ordinary runtime.
  // The execution loop still stops at duration; public withinSimulation remains
  // an observation flag, including false for retained future tasks.
  const retainedOrdinaryReactionQueue = config.schemaVersion === CURRENT_SCHEMA_VERSION && frameNative &&
    config.reactionEngine !== undefined && config.targetClockModel.mode === "disabled" &&
    (config.targetTaskModel.mode === "target-phase-v2" || config.targetTaskModel.mode === "legacy-event-heap-v1") &&
    !(executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom);
  const retainedReactionTaskTypes = new Set<InternalEvent["type"]>([
    "periodicReactionTick", "periodicReactionWane", "periodicReactionExpiry", "electroChargedCleanup",
    "burningTick", "burningFuelExpiry", "dendroCoreSpawn", "dendroCoreExpiry", "crystallizeShardSpawn",
    "crystallizeShardExpiry", "crystallizeShieldExpiry", "reactionDamage", "quickenBloomFollowup",
    "frozenExpiry", "quickenExpiry", "reactionDamageGroupReset", "targetDecay",
  ]);
  const periodicCheckpointRuntimeBlockers = new Set<string>();
  const queue = new MinHeap<InternalEvent>((left, right) => {
    const timeOrder = frameNative
      ? left.frame - right.frame
      : left.timeSeconds - right.timeSeconds;
    return (
      timeOrder ||
      left.priority - right.priority ||
      (left.queueOrderSequence ?? left.sequence) -
        (right.queueOrderSequence ?? right.sequence)
    );
  });
  let sequence = 0;
  let executingEvent: Pick<InternalEvent, "frame" | "priority" | "sequence"> | undefined;
  const directHitStepEvents: DirectHitStepEvent[] = [];
  const propagationStepEvents: PropagationStepEvent[] = [];
  let nextExecutionIntraSequence = (_site?: DirectHitStepSite): number => 0;
  let freezeBrokenCallbackTaskSequence = 1_000_000_000;
  const freezeBrokenCallbackCountByTriggerSequence = new Map<number, number>();
  const push = <TPayload>(
    timeSeconds: number,
    type: InternalEvent["type"],
    payload: TPayload,
    priorityOverride?: number
  ): number | null => {
    // Deterministic shared E checkpoints retain the real future worker. Keep the
    // existing Sacrificial stream's truncated audit sequence unchanged; its RNG
    // still independently prevents a complete deterministic checkpoint.
    const preserveFutureSkillTask = (type === "skillCooldownStart" || type === "skillCooldownRecover") &&
      sacrificialRuntime?.actor((payload as SkillCooldownTaskPayload).actorId) === undefined;
    const preserveDeclaredDrop = (type === "particleSpawn" && (payload as ParticleSpawnEventPayload).origin !== undefined) ||
      (type === "particleReceive" && (payload as ParticleReceiveEventPayload).declaredDrop === true);
    if (timeSeconds <= config.duration + 1e-9 || (retainedOrdinaryReactionQueue && retainedReactionTaskTypes.has(type)) || preserveFutureSkillTask || preserveDeclaredDrop || type === "artifactEnergyTick" || type === "artifactSongConvert" || type === "artifactBuffApply" || type === "playerMaxHpExpiry" || type === "sourceSnapshot" || type === "sourceNormalChainSwapStart" || type === "playerShieldInput" || type === "playerShieldExpiry" || type === "enemyShieldPhase") {
      const frame = toFrame(timeSeconds);
      const eventSequence = sequence++;
      const basePriority = priorityOverride ?? EVENT_PRIORITY[type];
      // Selected action acceptance follows existing frame tasks. Its own zero-offset
      // effects (and their same-frame descendants) retain a separate later phase.
      const priority = executingEvent !== undefined && frame === executingEvent.frame && executingEvent.priority >= 8 && basePriority < 8
        ? basePriority + 10 : basePriority;
      queue.push({
        timeSeconds: frameNative ? frame / 60 : timeSeconds,
        frame,
        priority,
        type,
        payload,
        sequence: eventSequence
      } as InternalEvent);
      return eventSequence;
    }
    return null;
  };
  const pushFreezeBrokenCallback = (
    timeSeconds: number,
    payload: FreezeBrokenCallbackEventPayload,
    priority: number,
    triggerEventSequence: number,
  ): number | null => {
    if (timeSeconds > config.duration + 1e-9) return null;
    const frame = toFrame(timeSeconds);
    const taskSequence = freezeBrokenCallbackTaskSequence++;
    const sameTriggerIndex =
      freezeBrokenCallbackCountByTriggerSequence.get(triggerEventSequence) ?? 0;
    if (sameTriggerIndex >= 500_000) {
      throw new Error(
        `Freeze Broken callback trigger ${triggerEventSequence} exceeded its local FIFO capacity.`,
      );
    }
    freezeBrokenCallbackCountByTriggerSequence.set(
      triggerEventSequence,
      sameTriggerIndex + 1,
    );
    queue.push({
      timeSeconds: frameNative ? frame / 60 : timeSeconds,
      frame,
      priority,
      type: "freezeBrokenCallback",
      payload,
      sequence: taskSequence,
      queueOrderSequence:
        triggerEventSequence + 0.5 + sameTriggerIndex / 1_000_000,
    });
    return taskSequence;
  };
  const pushTargetLocal = <TPayload>(
    projectedGlobalFrame: number,
    type:
      | "periodicReactionExpiry"
      | "burningFuelExpiry"
      | "frozenExpiry"
      | "quickenExpiry"
      | "electroChargedCleanup"
      | "burningTick",
    payload: TPayload,
    targetLocalDeadline: TargetLocalTaskDeadline,
    priorityOverride?: number
  ): void => {
    if (
      projectedGlobalFrame >
      Math.round(config.duration * 60)
    ) {
      return;
    }
    queue.push({
      timeSeconds: projectedGlobalFrame / 60,
      frame: projectedGlobalFrame,
      priority: priorityOverride ?? EVENT_PRIORITY[type],
      type,
      payload,
      sequence: sequence++,
      targetLocalDeadline
    } as InternalEvent);
  };
  const requeueTargetLocalEvent = (
    event: InternalEvent,
    projectedGlobalFrame: number,
    payload: unknown = event.payload
  ): void => {
    if (
      projectedGlobalFrame >
      Math.round(config.duration * 60)
    ) {
      return;
    }
    queue.push({
      ...event,
      frame: projectedGlobalFrame,
      timeSeconds: projectedGlobalFrame / 60,
      payload
    } as InternalEvent);
  };
  const scheduledTargetDecayKeys = new Set<string>();
  const completedTargetDecayKeys = new Set<string>();
  const targetDecayKey = (
    globalFrame: number,
    targetId: string
  ): string => `${globalFrame}\u0000${targetId}`;
  const scheduleTargetDecay = (
    globalFrame: number,
    targetId: string
  ): void => {
    if (
      !targetPhaseV2Enabled ||
      (!retainedOrdinaryReactionQueue && globalFrame > Math.round(config.duration * 60))
    ) {
      return;
    }
    const key = targetDecayKey(globalFrame, targetId);
    if (
      scheduledTargetDecayKeys.has(key) ||
      completedTargetDecayKeys.has(key)
    ) {
      return;
    }
    scheduledTargetDecayKeys.add(key);
    queue.push({
      timeSeconds: globalFrame / 60,
      frame: globalFrame,
      priority: targetPhaseV2DecayPriorityForTarget(targetId),
      type: "targetDecay",
      payload: { targetId } satisfies TargetDecayEventPayload,
      sequence: sequence++
    });
  };
  const scheduleTargetDecayThroughOrder = (
    globalFrame: number,
    targetOrderInclusive: number
  ): void => {
    if (!targetPhaseV2Enabled) return;
    for (
      let targetOrder = 0;
      targetOrder <= targetOrderInclusive;
      targetOrder += 1
    ) {
      const target = enemyTargets[targetOrder];
      if (target !== undefined) {
        scheduleTargetDecay(globalFrame, target.id);
      }
    }
  };
  const scheduleAllTargetDecays = (
    globalFrame: number
  ): boolean => {
    if (!targetPhaseV2Enabled) return false;
    let scheduled = false;
    for (const target of enemyTargets) {
      const key = targetDecayKey(globalFrame, target.id);
      if (
        !scheduledTargetDecayKeys.has(key) &&
        !completedTargetDecayKeys.has(key)
      ) {
        scheduleTargetDecay(globalFrame, target.id);
        scheduled = true;
      }
    }
    return scheduled;
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
      const chainSwap = sourceNormalChainRuntime === undefined || action.timelineCommandIndex === undefined ? undefined
        : timelineExecution?.commandResults.find(row => row.commandIndex === action.timelineCommandIndex && row.commandType === "swap" && row.status !== "rejected");
      if (chainSwap?.startFrame !== null && chainSwap?.startFrame !== undefined) {
        push(chainSwap.startFrame / 60, "sourceNormalChainSwapStart", { actorId: action.actorId, timelineCommandIndex: action.timelineCommandIndex! });
      }
      if (timeSeconds <= config.duration) {
        push(timeSeconds, "action", { action, cycle }, actionEventPriority(action));
      }
    }
  }
  for (const input of config.playerShieldModel?.events ?? []) push(input.frame / 60, "playerShieldInput", { input });
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
  const targetHealthRuntime = config.targetHealthModel === undefined ? undefined : new TargetHealthRuntime(config.targetHealthModel);
  const enemyShieldHost = config.enemyShieldModel === undefined ? undefined : new EnemyShieldHost(config.enemyShieldModel, {
    consumeApplication: ({ frame, sourceActorId, targetId, application }) => {
      const engine = auraEngines?.get(targetId);
      if (engine === undefined) throw new Error("敌盾必须使用该目标已有的实际附着 ICD 引擎。");
      return engine.consumeConfiguredApplicationOnly(frame, sourceActorId, application);
    },
  });
  for (const task of enemyShieldHost?.tasks() ?? []) push(task.frame / 60, "enemyShieldPhase", task, task.priority);

  const scheduleDeclaredDrop = (
    drop: { id: string; element: ParticleDefinition["element"]; kind: NonNullable<ParticleDefinition["kind"]>; count: number; travelFrames: number; sourceRef: string },
    origin: NonNullable<SimulationResult["particleEvents"][number]["origin"]>,
    spawnTimeSeconds: number,
    cycle: number,
  ): void => {
    push(spawnTimeSeconds, "particleSpawn", {
      actorId: origin.kind === "external" ? `external:${drop.id}` : `enemy:${origin.targetId}`,
      actionId: `declared-drop:${drop.id}`, actionName: drop.sourceRef,
      particle: { id: drop.id, element: drop.element, kind: drop.kind, count: drop.count, spawnOffset: 0,
        travelTime: drop.travelFrames / 60, source: drop.sourceRef },
      particleIndex: 0, cycle, origin,
    } satisfies ParticleSpawnEventPayload);
  };
  const settleTargetHealth = (damageEvent: DamageEvent, attackTag = "reaction"): void => {
    enemyShieldHost?.assertSupportedDelivery(damageEvent.targetId, damageEvent.kind);
    if (weaponHitStackRuntime !== undefined && damageEvent.mechanicsStatus !== "mechanics-truncated" && damageEvent.reactionAudit.mechanicsTruncation === null) {
      const captured = resolvedHitContexts.get(damageEvent.id);
      const critical = damageEvent.kind === "transformative-reaction" ? false : captured?.critical.outcome === "expected" ? null : captured?.critical.outcome === "critical";
      push(damageEvent.timeSeconds, "weaponHitStackCallback", { input: { kind: "enemy-damage", frame: damageEvent.frame, sourceActorId: damageEvent.sourceActorId, activeCharacterId: damageEvent.activeCharacterId, parentDamageEventId: damageEvent.id, targetId: damageEvent.targetId, attackTag, element: damageEvent.element, damage: damageEvent.finalDamage, critical } }, damageEvent.eventPriority);
    }
    const healthLogCount = targetHealthRuntime?.log.length ?? 0;
    for (const drop of targetHealthRuntime?.settle(damageEvent) ?? []) {
      scheduleDeclaredDrop(drop.definition, drop.origin, drop.timeSeconds, drop.cycle);
    }
    const health = targetHealthRuntime?.log[healthLogCount];
    if (health?.defeated) recordArtifactKill(damageEvent, health.id);
    if (nightsoulBurstRuntime !== undefined && damageEvent.element !== "physical" && damageEvent.mechanicsStatus !== "mechanics-truncated" && damageEvent.reactionAudit.mechanicsTruncation === null) {
      push(damageEvent.timeSeconds, "nightsoulBurstCallback", { parentDamageEventId: damageEvent.id, sourceActorId: damageEvent.sourceActorId,
        sourceActionId: damageEvent.actionId, sourceHitId: damageEvent.hitId, targetId: damageEvent.targetId,
        parentHitFrame: damageEvent.frame, parentEventPriority: damageEvent.eventPriority, parentEventSequence: damageEvent.eventSequence,
        element: damageEvent.element, cycle: damageEvent.cycle } satisfies NightsoulBurstCallbackPayload, damageEvent.eventPriority);
    }
  };
  for (const drop of config.targetHealthModel?.externalDrops ?? []) {
    scheduleDeclaredDrop(drop, { kind: "external", dropId: drop.id, targetId: null,
      targetHealthLogId: null, damageEventId: null, sourceRef: drop.sourceRef }, drop.frame / 60, 0);
  }
  const directDamageGroupLog: SimulationResult["directDamageGroupLog"] = [];
  const elementalApplicationIcdLog:
    SimulationResult["elementalApplicationIcdLog"] = [];
  const hitResolutionLog: SimulationResult["hitResolutionLog"] = [];
  const appendElementalApplicationIcdLog = ({
    hitResolutionLogId,
    damageEventId,
    frame,
    sourceActorId,
    targetId,
    hitId,
    hitGroupId,
    element,
    application,
    decision
  }: {
    hitResolutionLogId: number;
    damageEventId: number | null;
    frame: number;
    sourceActorId: string;
    targetId: string;
    hitId: string;
    hitGroupId: string;
    element: Element;
    application: ElementalApplication;
    decision: Readonly<ElementalApplicationIcdDecisionV147>;
  }): number => {
    if (element === "physical") {
      throw new Error(
        `Configured elemental application "${hitGroupId}" cannot use physical damage.`
      );
    }
    const id = elementalApplicationIcdLog.length;
    elementalApplicationIcdLog.push({
      id,
      sourceKind: "configured-direct-hit",
      hitResolutionLogId,
      damageEventId,
      frame,
      sourceActorId,
      targetId,
      hitId,
      hitGroupId,
      element,
      selector: { ...application.icd },
      nominalGaugeUnits: application.gaugeUnits,
      effectiveGaugeUnits:
        application.gaugeUnits * decision.applicationMultiplier,
      decision: { ...decision }
    });
    return id;
  };
  const appendReactionOwnedElementalApplicationIcdLog = ({
    reactionDamageLogId,
    hitResolutionLogId,
    damageEventId,
    frame,
    eventPriority,
    eventSequence,
    attemptIndex,
    attemptCount,
    deliveryPhase,
    sourceActorId,
    targetId,
    hitId,
    hitGroupId,
    damageElement,
    reactionApplication,
    decision
  }: {
    reactionDamageLogId: number;
    hitResolutionLogId: number;
    damageEventId: number | null;
    frame: number;
    eventPriority: number;
    eventSequence: number;
    attemptIndex: number;
    attemptCount: number;
    deliveryPhase:
      | "reaction-damage-event"
      | "before-reactable-tick"
      | "after-reactable-tick";
    sourceActorId: string;
    targetId: string;
    hitId: string;
    hitGroupId: string;
    damageElement: Element;
    reactionApplication: NonNullable<
      ReactionDamageEventPayload["reactionApplication"]
    >;
    decision: Readonly<ReactionOwnedElementalApplicationIcdDecisionV149>;
  }): number => {
    const runtimeDecision = decision as unknown as {
      kind?: unknown;
      reason?: unknown;
    };
    if (
      runtimeDecision.kind !== "skipped" &&
      runtimeDecision.kind !== "reaction-fixed-gcsim"
    ) {
      throw new Error(
        `Reaction-owned application "${hitGroupId}" returned the direct-only decision kind "${String(runtimeDecision.kind)}".`
      );
    }
    if (
      runtimeDecision.kind === "skipped" &&
      runtimeDecision.reason !== "miss" &&
      runtimeDecision.reason !== "target-aura-blocked" &&
      runtimeDecision.reason !== "mechanics-truncated"
    ) {
      throw new Error(
        `Reaction-owned application "${hitGroupId}" returned the impossible skip reason "${String(runtimeDecision.reason)}".`
      );
    }
    const expectedElement =
      reactionApplication.channel.kind === "burning-tick"
        ? "pyro"
        : reactionApplication.channel.element;
    if (damageElement !== expectedElement) {
      throw new Error(
        `Reaction-owned application "${hitGroupId}" expected ${expectedElement} damage but received ${damageElement}.`
      );
    }
    if (
      reactionApplication.channel.kind === "burning-tick" &&
      reactionApplication.nominalGaugeUnits !==
        AURA_ENGINE_CONSTANTS.burningApplicationGaugeUnits
    ) {
      throw new Error(
        "Reaction-owned Burning application Gauge must remain fixed by the policy."
      );
    }

    const id = elementalApplicationIcdLog.length;
    if (reactionApplication.channel.kind === "burning-tick") {
      elementalApplicationIcdLog.push({
        id,
        sourceKind: "burning-tick",
        reactionDamageLogId,
        hitResolutionLogId,
        damageEventId,
        frame,
        eventPriority,
        eventSequence,
        attemptIndex,
        attemptCount,
        deliveryPhase,
        sourceActorId,
        targetId,
        hitId,
        hitGroupId,
        element: "pyro",
        selector: {
          ...config.reactionOwnedElementalApplicationModel,
          channel: { kind: "burning-tick" }
        },
        nominalGaugeUnits: reactionApplication.nominalGaugeUnits,
        effectiveGaugeUnits:
          reactionApplication.nominalGaugeUnits *
          decision.applicationMultiplier,
        decision: { ...decision }
      });
    } else {
      elementalApplicationIcdLog.push({
        id,
        sourceKind: "swirl-propagation",
        reactionDamageLogId,
        hitResolutionLogId,
        damageEventId,
        frame,
        eventPriority,
        eventSequence,
        attemptIndex,
        attemptCount,
        deliveryPhase,
        sourceActorId,
        targetId,
        hitId,
        hitGroupId,
        element: reactionApplication.channel.element,
        selector: {
          ...config.reactionOwnedElementalApplicationModel,
          channel: deepClone(reactionApplication.channel)
        },
        nominalGaugeUnits: reactionApplication.nominalGaugeUnits,
        effectiveGaugeUnits:
          reactionApplication.nominalGaugeUnits *
          decision.applicationMultiplier,
        decision: { ...decision }
      });
    }
    const reactionLog = reactionDamageLog[reactionDamageLogId];
    if (reactionLog === undefined) {
      throw new Error(
        `Reaction-owned application ${id} references missing reaction-damage log ${reactionDamageLogId}.`
      );
    }
    reactionLog.elementalApplicationIcdLogIds.push(id);
    return id;
  };
  const targetClockLog: SimulationResult["targetClockLog"] = [];
  const targetHitlagLog: SimulationResult["targetHitlagLog"] = [];
  const targetTaskPhaseLog: SimulationResult["targetTaskPhaseLog"] =
    [];
  const targetTaskPhaseByKey = new Map<
    string,
    SimulationResult["targetTaskPhaseLog"][number]
  >();
  let targetTaskPhaseSnapshotFrame: number | null = null;
  const targetTaskPhaseAuraBeforeByTarget = new Map<
    string,
    SimulationResult["targetTaskPhaseLog"][number]["auraBeforeTasks"]
  >();
  const targetTaskPhaseKey = (
    globalFrame: number,
    targetId: string
  ): string => `${globalFrame}\u0000${targetId}`;
  const captureTargetTaskPhaseAuraBefore = (
    globalFrame: number
  ): void => {
    if (
      !targetPhaseEnabled ||
      targetTaskPhaseSnapshotFrame === globalFrame
    ) {
      return;
    }
    targetTaskPhaseSnapshotFrame = globalFrame;
    targetTaskPhaseAuraBeforeByTarget.clear();
    for (const target of enemyTargets) {
      const auraEngine = auraEngines?.get(target.id);
      const auraBefore =
        auraEngine === undefined
          ? []
          : auraEngine.getAuraStateAt(
              Math.max(0, globalFrame - 1)
            );
      if (auraEngine !== undefined) {
        targetStateTimelineRecorder.synchronize(
          target.id,
          Math.max(0, globalFrame - 1),
          auraBefore
        );
      }
      targetTaskPhaseAuraBeforeByTarget.set(
        target.id,
        deepClone(auraBefore)
      );
    }
  };
  const ensureTargetTaskPhase = (
    input:
      | {
          targetId: string;
          globalFrame: number;
          wakeKind: "burning-tick";
          eventType: "burningTick";
          eventPriority: number;
          eventSequence: number;
          intraEventSequence: number;
          auraBeforeTasks: SimulationResult["targetTaskPhaseLog"][number]["auraBeforeTasks"];
          auraAfterTasks: SimulationResult["targetTaskPhaseLog"][number]["auraAfterTasks"];
          auraAfterDecay: SimulationResult["targetTaskPhaseLog"][number]["auraAfterDecay"];
        }
      | {
          targetId: string;
          globalFrame: number;
          wakeKind: "incoming";
          eventType: "hit" | "reactionDamage";
          eventPriority: number;
          eventSequence: number;
          intraEventSequence: number;
        }
  ): SimulationResult["targetTaskPhaseLog"][number] | null => {
    if (!targetPhaseEnabled) return null;
    const key = targetTaskPhaseKey(
      input.globalFrame,
      input.targetId
    );
    const existing = targetTaskPhaseByKey.get(key);
    if (existing !== undefined) return existing;

    const target = enemyTargetById.get(input.targetId);
    if (target === undefined) {
      throw new Error(
        `Target task phase could not resolve target "${input.targetId}".`
      );
    }
    const auraEngine = auraEngines?.get(input.targetId);
    const auraBeforeTasks =
      input.wakeKind === "burning-tick"
        ? input.auraBeforeTasks
        : targetTaskPhaseAuraBeforeByTarget.get(
            input.targetId
          ) ??
          (auraEngine === undefined
            ? []
            : auraEngine.getAuraStateAt(
                Math.max(0, input.globalFrame - 1)
              ));
    const auraAfterTasks =
      input.wakeKind === "burning-tick"
        ? input.auraAfterTasks
        : auraBeforeTasks;
    const auraAfterDecay =
      input.wakeKind === "burning-tick"
        ? input.auraAfterDecay
        : auraEngine === undefined
          ? []
          : auraEngine.getAuraStateAt(input.globalFrame);
    const targetFrame =
      targetClocks
        ?.get(input.targetId)
        ?.projectLocalFrameAtGlobalFrame(
          input.globalFrame
        ) ?? input.globalFrame;
    const base = {
      id: targetTaskPhaseLog.length,
      targetId: input.targetId,
      targetName: target.name,
      globalFrame: input.globalFrame,
      timeSeconds: input.globalFrame / 60,
      targetFrame,
      targetOrder:
        enemyTargetOrderById.get(input.targetId) ?? 0,
      eventPriority: input.eventPriority,
      eventSequence: input.eventSequence,
      intraEventSequence: input.intraEventSequence,
      auraBeforeTasks: deepClone(auraBeforeTasks),
      auraAfterTasks: deepClone(auraAfterTasks),
      auraAfterDecay: deepClone(auraAfterDecay),
      burningStateLogIds: [],
      hitResolutionLogIds: [],
      reactionTaskLogIds: []
    };
    const entry: SimulationResult["targetTaskPhaseLog"][number] =
      input.wakeKind === "burning-tick"
        ? {
            ...base,
            wakeKind: "burning-tick",
            eventType: "burningTick"
          }
        : {
            ...base,
            wakeKind: "incoming",
            eventType: input.eventType
          };
    targetTaskPhaseLog.push(entry);
    targetTaskPhaseByKey.set(key, entry);
    return entry;
  };
  const appendTargetTaskPhaseReference = (
    entry: SimulationResult["targetTaskPhaseLog"][number] | null,
    field:
      | "burningStateLogIds"
      | "hitResolutionLogIds"
      | "reactionTaskLogIds",
    id: number
  ): void => {
    if (entry === null) return;
    const ids = entry[field];
    if (ids[ids.length - 1] !== id) ids.push(id);
  };
  const targetPhaseLog: SimulationResult["targetPhaseLog"] = [];
  type TargetPhaseEntry =
    | TargetPhaseV2LogEntry
    | TargetPhaseV3LogEntry;
  interface TargetPhaseV2RuntimeState {
    entry: TargetPhaseEntry;
    emitted: boolean;
    decayMaterialized: boolean;
    hasBeforeReactableInlineDelivery: boolean;
  }
  type TargetLifecycleTransitionInput =
    TargetLifecycleTransition extends infer TTransition
      ? TTransition extends { order: number }
        ? Omit<TTransition, "order">
        : never
      : never;
  const targetPhaseV2StateByKey = new Map<
    string,
    TargetPhaseV2RuntimeState
  >();
  const lastEmittedTargetPhaseV2ByTarget = new Map<
    string,
    TargetPhaseEntry
  >();
  const emitTargetPhaseV2State = (
    state: TargetPhaseV2RuntimeState
  ): void => {
    if (state.emitted) return;
    const previous =
      lastEmittedTargetPhaseV2ByTarget.get(
        state.entry.targetId
      );
    state.entry.reactableTick.fromTargetFrame =
      previous?.reactableTick.toTargetFrame ?? 0;
    state.entry.id = targetPhaseLog.length;
    targetPhaseLog.push(state.entry);
    state.emitted = true;
    lastEmittedTargetPhaseV2ByTarget.set(
      state.entry.targetId,
      state.entry
    );
  };
  const resolveTargetFrameAt = (
    targetId: string,
    globalFrame: number
  ): number =>
    targetClocks
      ?.get(targetId)
      ?.projectLocalFrameAtGlobalFrame(globalFrame) ??
    globalFrame;
  const ensureTargetPhaseV2State = ({
    targetId,
    globalFrame,
    emit,
    auraBeforeOverride
  }: {
    targetId: string;
    globalFrame: number;
    emit: boolean;
    auraBeforeOverride?: TargetPhaseEntry["auraBeforeTargetTasks"];
  }): TargetPhaseV2RuntimeState | null => {
    if (!targetPhaseV2Enabled) return null;
    const key = targetTaskPhaseKey(globalFrame, targetId);
    const existing = targetPhaseV2StateByKey.get(key);
    if (existing !== undefined) {
      if (emit) emitTargetPhaseV2State(existing);
      return existing;
    }
    const target = enemyTargetById.get(targetId);
    if (target === undefined) {
      throw new Error(
        `Target phase v2 could not resolve target "${targetId}".`
      );
    }
    const auraEngine = auraEngines?.get(targetId);
    const engineGlobalFrame =
      auraEngine?.getCurrentFrame() ?? Math.max(0, globalFrame - 1);
    const auraBefore =
      auraBeforeOverride ??
      (auraEngine === undefined
        ? []
        : auraEngine.getAuraStateAt(engineGlobalFrame));
    const fromTargetFrame =
      targetClocks?.get(targetId)?.getState().localFrame ??
      engineGlobalFrame;
    const toTargetFrame = resolveTargetFrameAt(
      targetId,
      globalFrame
    );
    const entry: TargetPhaseEntry = {
      model: targetPhaseV3Enabled
        ? "target-phase-v3"
        : "target-phase-v2",
      id: -1,
      targetId,
      targetName: target.name,
      globalFrame,
      timeSeconds: globalFrame / 60,
      targetFrame: toTargetFrame,
      targetOrder: enemyTargetOrderById.get(targetId) ?? 0,
      auraBeforeTargetTasks: deepClone(auraBefore),
      targetTasks: [],
      auraAfterTargetTasks: deepClone(auraBefore),
      reactableTick: {
        fromTargetFrame,
        toTargetFrame,
        auraBefore: deepClone(auraBefore),
        transitions: [],
        auraAfter: deepClone(auraBefore)
      },
      hitResolutionLogIds: [],
      reactionTaskLogIds: []
    };
    const state: TargetPhaseV2RuntimeState = {
      entry,
      emitted: false,
      decayMaterialized: false,
      hasBeforeReactableInlineDelivery: false
    };
    targetPhaseV2StateByKey.set(key, state);
    if (emit) emitTargetPhaseV2State(state);
    return state;
  };
  const appendTargetPhaseV2Reference = (
    entry: TargetPhaseEntry | null,
    field: "hitResolutionLogIds" | "reactionTaskLogIds",
    id: number
  ): void => {
    if (entry === null) return;
    const ids = entry[field];
    if (ids[ids.length - 1] !== id) ids.push(id);
  };
  const appendTargetPhaseV2Transition = (
    state: TargetPhaseV2RuntimeState,
    transition: TargetLifecycleTransitionInput,
    auraAfter: TargetPhaseEntry["reactableTick"]["auraAfter"]
  ): void => {
    emitTargetPhaseV2State(state);
    if (state.entry.reactableTick.transitions.length === 0) {
      const transitionPoint =
        targetStateTimelineRecorder.result().points[
          transition.targetStateTimelinePointId
        ];
      if (
        transitionPoint === undefined ||
        transitionPoint.targetId !== state.entry.targetId ||
        transitionPoint.frame !== state.entry.globalFrame
      ) {
        throw new Error(
          `Target phase v2 transition could not resolve timeline point ${transition.targetStateTimelinePointId}.`
        );
      }
      if (state.entry.targetTasks.length === 0) {
        // With no same-frame callback there is no target-task boundary to
        // preserve. Any decay since the prior wake belongs to the sparse
        // target-clock advance, so start this phase at the first typed
        // Reactable transition instead of inventing an unbridgeable
        // same-frame durability gap.
        state.entry.auraBeforeTargetTasks = deepClone(
          transitionPoint.auraBefore
        );
        state.entry.auraAfterTargetTasks = deepClone(
          transitionPoint.auraBefore
        );
      }
      // Ordinary durability loss that does not remove an Aura is implicit.
      // The first explicit lifecycle transition owns the canonical
      // pre-transition snapshot; without a transition, materializeDecay keeps
      // both snapshots at the post-decay Aura instead.
      state.entry.reactableTick.auraBefore = deepClone(
        transitionPoint.auraBefore
      );
      state.entry.reactableTick.auraAfter = deepClone(
        transitionPoint.auraBefore
      );
    }
    state.entry.reactableTick.transitions.push({
      ...transition,
      order: state.entry.reactableTick.transitions.length
    } as TargetLifecycleTransition);
    state.entry.reactableTick.auraAfter = deepClone(auraAfter);
  };
  recordTargetPhaseV2NaturalExpiry = ({
    targetId,
    globalFrame,
    auraBefore,
    auraAfter,
    targetStateTimelinePointId
  }): void => {
    if (!targetPhaseV2Enabled) return;
    const state = ensureTargetPhaseV2State({
      targetId,
      globalFrame,
      emit: true,
      auraBeforeOverride: deepClone([...auraBefore])
    });
    if (state === null) return;
    appendTargetPhaseV2Transition(
      state,
      {
        stage: "reactable-tick",
        kind: "aura-natural-expiry",
        deadlineTargetFrame: resolveTargetFrameAt(
          targetId,
          globalFrame
        ),
        targetStateTimelinePointId
      },
      deepClone([...auraAfter])
    );
  };
  const lastLoggedTargetClockState = new Map<
    string,
    TargetLocalClockState
  >(
    enemyTargets.map((target) => [
      target.id,
      {
        globalFrame: 0,
        localFrame: 0,
        frozenFrames: 0,
        isFrozen: false,
        nextLocalAdvanceGlobalFrame: 1
      }
    ])
  );
  const totalTargetHitlagExtensionById = new Map<string, number>();
  const targetHitlagApplicationCountById = new Map<string, number>();
  const targetMechanicsTruncationLog: SimulationResult["targetMechanicsTruncationLog"] =
    [];
  const reactionDamageLog: SimulationResult["reactionDamageLog"] = [];
  const reactionDamageGroupResetLog: SimulationResult["reactionDamageGroupResetLog"] =
    [];
  const basicReactionSchedulerLog: SimulationResult["basicReactionSchedulerLog"] =
    [];
  const burningRootInlineDeliveryByReactionDamageLogId = new Map<
    number,
    {
      ownerTargetOrder: number;
      delivery: TargetPhaseV3Delivery;
    }
  >();
  const reactionTaskLog: SimulationResult["reactionTaskLog"] = [];
  const syncPendingElectroChargedCleanupCadence = ({
    targetId,
    generation,
    cadenceStatus,
    nextTickFrame,
    waneListenerActive,
    lastCallbackFrame,
  }: {
    targetId: string;
    generation: number;
    cadenceStatus: "scheduled" | "dormant" | "stopped" | undefined;
    nextTickFrame: number | null;
    waneListenerActive: boolean | undefined;
    lastCallbackFrame: number | null | undefined;
  }): void => {
    if (!auraV9Enabled) return;
    if (
      cadenceStatus === undefined ||
      waneListenerActive === undefined ||
      lastCallbackFrame === undefined
    ) {
      throw new Error(
        `Aura-v9 generation ${generation} is missing cadence state while synchronizing pending cleanup.`,
      );
    }
    for (const task of reactionTaskLog) {
      const cleanup = task.electroChargedCleanup;
      if (
        task.targetId !== targetId ||
        cleanup === null ||
        cleanup.outcome !== "pending-at-end" ||
        cleanup.generation !== generation
      ) {
        continue;
      }
      cleanup.cadence = {
        status: cadenceStatus,
        nextTickFrame: cadenceStatus === "scheduled" ? nextTickFrame : null,
        waneListenerActive,
        lastCallbackFrame,
      };
    }
  };
  const reactionStatusLog: SimulationResult["reactionStatusLog"] = [];
  const periodicReactionLog: SimulationResult["periodicReactionLog"] =
    [];
  const frozenStateLog: SimulationResult["frozenStateLog"] = [];
  const freezeBrokenAttackLog: SimulationResult["freezeBrokenAttackLog"] = [];
  const freezeBrokenCallbackAuditBuffer =
    new FreezeBrokenCallbackAuditBuffer();
  const callbackDeliveryLog: SimulationResult["callbackDeliveryLog"] = [];
  const callbackDeliveryLogIdByEmissionId = new Map<number, number>();
  const pendingFreezeBrokenCallbacks = new Map<
    number,
    PendingFreezeBrokenCallback
  >();
  const emittedFreezeBrokenTerminalRows = new Set<number>();

  const appendFreezeBrokenCallbackDelivery = <
    Kind extends CallbackBusEventKindV153,
  >({
    eventKind,
    eventIndex,
    payload,
    source,
    eventPriority,
    eventSequence,
    intraEventSequence,
    parentCallbackDeliveryLogId,
    phase,
  }: {
    eventKind: Kind;
    eventIndex: FreezeBrokenCallbackEventIndexByKind[Kind];
    payload: FreezeBrokenCallbackPayloadMapV153[Kind];
    source: FreezeBrokenCallbackDispatchSource;
    eventPriority: number;
    eventSequence: number;
    intraEventSequence: number;
    parentCallbackDeliveryLogId: number | null;
    phase: CallbackDeliveryLogEntryV153["phase"];
  }): number => {
    if (!callbackBusEnabled) {
      throw new Error(
        "Freeze Broken callback dispatch requires the versioned callback bus.",
      );
    }
    const frozenStateEntry = source.frozenStateEntry;
    const frozenPayload = Object.freeze({ ...payload });
    const dispatchContext = Object.freeze({
      eventKind,
      eventIndex,
      frame: frozenStateEntry.frame,
      targetFrame: frozenStateEntry.targetFrame ?? null,
      timeSeconds: frozenStateEntry.timeSeconds,
      targetId: frozenStateEntry.targetId,
      targetName: frozenStateEntry.targetName,
      generation: frozenStateEntry.generation,
      sourceFrozenStateLogId: frozenStateEntry.id,
      freezeBrokenAttackLogId: source.freezeBrokenAttackLogId,
      payload: frozenPayload,
    }) as unknown as FreezeBrokenCallbackDispatchPayloads[Kind];
    const dispatch = callbackRuntime.bus.dispatch(eventKind, dispatchContext);
    const callbackDeliveryLogId = callbackDeliveryLog.length;
    callbackDeliveryLogIdByEmissionId.set(
      dispatch.emissionId,
      callbackDeliveryLogId,
    );
    const subscriberAttempts: CallbackSubscriberAttemptV153[] =
      dispatch.attempts.map(
        (
          attempt: CallbackBusCompletedDeliveryAttempt<
            Kind,
            CallbackSubscriberOutcomeV153
          >,
        ) => {
          const pluginSource =
            callbackRuntime.subscriptionSourceById.get(
              attempt.subscriptionId,
            );
          return {
            index: attempt.attemptIndex,
            slotIndex: attempt.slotIndex,
            registrationLogId: attempt.registrationLogId,
            subscriptionId: attempt.subscriptionId,
            subscriberKey: attempt.subscriberKey,
            pluginManifestIndex:
              pluginSource?.pluginManifestIndex ?? null,
            pluginId: pluginSource?.pluginId ?? null,
            status: "completed",
            outcomeVerification:
              CALLBACK_SUBSCRIBER_OUTCOME_VERIFICATION,
            outcome: attempt.outcome,
          };
        },
      );
    const row = {
      id: callbackDeliveryLogId,
      eventIndex,
      eventKind,
      registryRevision: dispatch.registryRevision,
      frame: frozenStateEntry.frame,
      ...(frozenStateEntry.targetFrame === undefined
        ? {}
        : { targetFrame: frozenStateEntry.targetFrame }),
      timeSeconds: frozenStateEntry.timeSeconds,
      targetId: frozenStateEntry.targetId,
      targetName: frozenStateEntry.targetName,
      generation: frozenStateEntry.generation,
      sourceFrozenStateLogId: frozenStateEntry.id,
      freezeBrokenAttackLogId: source.freezeBrokenAttackLogId,
      triggerEventType: source.triggerEventType,
      triggerEventPriority: source.triggerEventPriority,
      triggerEventSequence: source.triggerEventSequence,
      triggerIntraEventSequence: source.triggerIntraEventSequence,
      eventPriority,
      eventSequence,
      intraEventSequence,
      parentCallbackDeliveryLogId,
      phase,
      payload: frozenPayload,
      subscriberAttempts,
    } as unknown as CallbackDeliveryLogEntryV153;
    callbackDeliveryLog.push(row);
    return callbackDeliveryLogId;
  };

  const projectCallbackRegistrationLog =
    (): SimulationResult["callbackRegistrationLog"] =>
      callbackRuntime.bus.getRegistrationLog().map((entry) => {
        const pluginSource =
          callbackRuntime.registrationSourceByLogId.get(entry.id);
        return {
          id: entry.id,
          registryRevision: entry.registryRevision,
          eventKind: entry.eventKind,
          subscriberKey: entry.subscriberKey,
          slotIndex: entry.slotIndex,
          operation: entry.operation,
          previousSubscriptionId: entry.previousSubscriptionId,
          currentSubscriptionId: entry.currentSubscriptionId,
          sourceKind: pluginSource === undefined ? "core" : "plugin",
          pluginManifestIndex:
            pluginSource?.pluginManifestIndex ?? null,
          pluginId: pluginSource?.pluginId ?? null,
          subscriberAttemptRefs: entry.subscriberAttemptRefs.map(
            (reference) => {
              const callbackDeliveryLogId =
                callbackDeliveryLogIdByEmissionId.get(
                  reference.emissionId,
                );
              if (callbackDeliveryLogId === undefined) {
                throw new Error(
                  `Callback emission ${reference.emissionId} is missing its delivery audit row.`,
                );
              }
              return {
                callbackDeliveryLogId,
                attemptIndex: reference.attemptIndex,
              };
            },
          ),
        };
      });

  const appendFreezeBrokenAttackAudit = ({
    frozenStateEntry,
    depletionDamageEventId,
    sourceFreezeDamageEventId,
    triggerEventType,
    triggerEventPriority,
    triggerEventSequence,
    nextIntraEventSequence,
  }: {
    frozenStateEntry: SimulationResult["frozenStateLog"][number];
    depletionDamageEventId: number | null;
    sourceFreezeDamageEventId: number | null;
    triggerEventType: SimulationEvent["type"];
    triggerEventPriority: number;
    triggerEventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    const classification = classifyFreezeBrokenAttackTransition(
      config.freezeBrokenAttackModel.mode,
      frozenStateEntry,
    );
    if (
      classification === null ||
      emittedFreezeBrokenTerminalRows.has(
        classification.terminalFrozenStateLogId,
      )
    ) {
      return;
    }
    emittedFreezeBrokenTerminalRows.add(
      classification.terminalFrozenStateLogId,
    );
    const triggerIntraEventSequence = nextIntraEventSequence();
    if (
      config.freezeBrokenAttackModel.mode ===
      "fixed-gcsim-freeze-broken-callback-dispatch-v3"
    ) {
      const freezeBrokenAttackLogId =
        freezeBrokenCallbackAuditBuffer.reserve();
      const source: FreezeBrokenCallbackDispatchSource = {
        freezeBrokenAttackLogId,
        frozenStateEntry: deepClone(frozenStateEntry),
        depletionDamageEventId,
        sourceFreezeDamageEventId,
        triggerEventType,
        triggerEventPriority,
        triggerEventSequence,
        triggerIntraEventSequence,
      };
      const auraDepletedDeliveryLogId =
        appendFreezeBrokenCallbackDelivery({
          eventKind: "on-aura-durability-depleted-frozen",
          eventIndex: 0,
          payload: {
            kind: "frozen-durability-depleted",
            element: "frozen",
          },
          source,
          eventPriority: triggerEventPriority,
          eventSequence: triggerEventSequence,
          intraEventSequence: 0,
          parentCallbackDeliveryLogId: null,
          phase: { kind: "same-call-stack-immediate" },
        });
      const applyAttackDeliveryLogId =
        appendFreezeBrokenCallbackDelivery({
          eventKind: "on-apply-attack-freeze-broken",
          eventIndex: 1,
          payload: {
            kind: "freeze-broken-attack",
            ability: "Freeze Broken",
          },
          source,
          eventPriority: triggerEventPriority,
          eventSequence: triggerEventSequence,
          intraEventSequence: 1,
          parentCallbackDeliveryLogId: auraDepletedDeliveryLogId,
          phase: { kind: "same-call-stack-immediate" },
        });
      const enemyHitDeliveryLogId =
        appendFreezeBrokenCallbackDelivery({
          eventKind: "on-enemy-hit-freeze-broken",
          eventIndex: 2,
          payload: {
            kind: "freeze-broken-attack",
            ability: "Freeze Broken",
          },
          source,
          eventPriority: triggerEventPriority,
          eventSequence: triggerEventSequence,
          intraEventSequence: 2,
          parentCallbackDeliveryLogId: applyAttackDeliveryLogId,
          phase: { kind: "same-call-stack-immediate" },
        });
      const taskSequence = pushFreezeBrokenCallback(
        frozenStateEntry.timeSeconds,
        { freezeBrokenAttackLogId },
        triggerEventPriority,
        triggerEventSequence,
      );
      if (taskSequence === null) {
        throw new Error(
          `Freeze Broken callback task ${freezeBrokenAttackLogId} fell outside the simulation duration.`,
        );
      }
      pendingFreezeBrokenCallbacks.set(freezeBrokenAttackLogId, {
        source,
        syncCallbackDeliveryLogIds: [
          auraDepletedDeliveryLogId,
          applyAttackDeliveryLogId,
          enemyHitDeliveryLogId,
        ],
        taskSequence,
      });
      return;
    }
    const auditEntry = buildFreezeBrokenAttackLogEntry({
      id: freezeBrokenAttackLog.length,
      mode: config.freezeBrokenAttackModel.mode,
      frozenStateEntry,
      resolvedActorId: config.characters[0]!.id,
      depletionDamageEventId,
      sourceFreezeDamageEventId,
      triggerEventType,
      triggerEventPriority,
      triggerEventSequence,
      intraEventSequence: triggerIntraEventSequence,
    });
    if (auditEntry === null) {
      throw new Error(
        `Freeze Broken terminal row ${frozenStateEntry.id} changed classification while building its audit.`,
      );
    }
    freezeBrokenAttackLog.push(auditEntry);
  };
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
  const playerHealthEvents: PlayerHealthEvent[] = [];
  const playerMaxHpEvents: NonNullable<SimulationResult["playerMaxHpEvents"]> = [];
  const scheduledMaxHpExpiryFrames = new Set<number>();
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
        initialMaxHp: maxHpCalculation.maxHp,
        totalMaxHpAdjustment: 0,
        initialHp,
        currentHp: initialHp,
        ...(config.bondOfLifeModel === undefined ? {} : {
          initialBondOfLife: maxHpCalculation.maxHp * config.bondOfLifeModel.characters.find(actor => actor.actorId === character.id)!.initialRatio,
          currentBondOfLife: maxHpCalculation.maxHp * config.bondOfLifeModel.characters.find(actor => actor.actorId === character.id)!.initialRatio,
        }),
        totalIncomingDamage: 0,
        totalAbsorbedDamage: 0,
        totalHpDamage: 0,
        totalHealing: 0,
        totalOverheal: 0,
        totalHpConsumed: 0,
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
  const reactionDamageGroupEngine = new ReactionDamageGroupTaskEngine(
    config.reactionDamageGroupModel,
  );
  const resetLogIdByTask = new WeakMap<object, number>();
  const executedResetAwaitingSameFrameAttempt = new Map<string, number>();
  const recordReactionDamageGroupResetExecution = (
    execution: Readonly<ReactionDamageGroupResetExecution>,
    expectedResetLogId?: number,
  ): void => {
    const resetLogId = resetLogIdByTask.get(execution.task);
    if (
      resetLogId === undefined ||
      (expectedResetLogId !== undefined && resetLogId !== expectedResetLogId)
    ) {
      throw new Error(
        "Reaction damage-group reset execution references an unlogged or mismatched task.",
      );
    }
    const resetLog = reactionDamageGroupResetLog[resetLogId];
    if (
      resetLog === undefined ||
      resetLog.executed ||
      execution.invalidatedReason === "ALREADY_EXECUTED"
    ) {
      throw new Error(
        `Reaction damage-group reset execution ${resetLogId} is missing or duplicated.`,
      );
    }
    resetLog.executed = true;
    resetLog.executionFrame = execution.executionFrame;
    resetLog.stale = execution.stale;
    resetLog.invalidatedReason = execution.invalidatedReason;
    if (execution.applied) {
      executedResetAwaitingSameFrameAttempt.set(
        execution.task.scopeKey,
        resetLogId,
      );
    }
  };
  const consumeReactionDamageGroup = ({
    targetId,
    actorId,
    reaction,
    damageSourceId,
    frame,
    taskSequence,
  }: {
    targetId: string;
    actorId: string;
    reaction: ReactionDamageGroupDecisionAuditV150["reaction"];
    damageSourceId: string | null;
    frame: number;
    taskSequence: number;
  }): ReactionDamageGroupDecisionAuditV150 => {
    if (
      config.reactionDamageGroupModel.mode ===
      "fixed-gcsim-reaction-damage-task-order-v2"
    ) {
      for (const execution of reactionDamageGroupEngine.executeResetsBefore({
        frame,
        taskSequence,
      })) {
        recordReactionDamageGroupResetExecution(execution);
      }
    }
    const result: Readonly<ReactionDamageGroupAttemptResult> =
      config.reactionDamageGroupModel.mode ===
      "fixed-gcsim-reaction-damage-task-order-v2"
        ? reactionDamageGroupEngine.consumeAttempt(
            {
              targetId,
              actorId,
              reactionTag: reaction,
              damageSourceId,
              frame,
              taskSequence,
            },
            (draft: Readonly<ReactionDamageGroupResetTaskDraft>) => ({
              // Reset tasks share the simulation's global insertion ordinal
              // even when their deadline is outside this run.
              taskSequence: sequence++,
              withinSimulation:
                draft.resetAtFrame / 60 <= config.duration + 1e-9,
            }),
          )
        : reactionDamageGroupEngine.consumeAttempt({
            targetId,
            actorId,
            reactionTag: reaction,
            damageSourceId,
            frame,
            taskSequence,
          });

    if (result.scheduledResetTask !== null) {
      const task = result.scheduledResetTask;
      const resetLogId = reactionDamageGroupResetLog.length;
      reactionDamageGroupResetLog.push({
        id: resetLogId,
        policyId: task.policyId,
        sourceActorId: task.actorId,
        targetId: task.targetId,
        scopeKey: task.scopeKey,
        reaction: task.reactionTag,
        icdTag: task.icdTag,
        icdGroup: task.icdGroup,
        windowGeneration: task.windowGeneration,
        windowStartFrame: task.windowStartFrame,
        resetAtFrame: task.resetAtFrame,
        taskSequence: task.taskSequence,
        withinSimulation: task.withinSimulation,
        executed: false,
        executedBeforeAttemptTaskSequence: null,
        executionFrame: null,
        stale: false,
        invalidatedReason: null,
      });
      resetLogIdByTask.set(task, resetLogId);
      if (task.withinSimulation || retainedOrdinaryReactionQueue) {
        queue.push({
          type: "reactionDamageGroupReset",
          timeSeconds: task.resetAtFrame / 60,
          frame: task.resetAtFrame,
          priority: EVENT_PRIORITY.reactionDamageGroupReset,
          sequence: task.taskSequence,
          payload: { resetLogId, task },
        } as InternalEvent);
      }
    }

    const decision = result.decision;
    const resetTaskLogId =
      decision.resetTask === null
        ? null
        : resetLogIdByTask.get(decision.resetTask);
    if (decision.resetTask !== null && resetTaskLogId === undefined) {
      throw new Error(
        `Reaction damage-group decision for ${decision.scopeKey} references an unlogged reset task.`,
      );
    }
    const precedingResetLogId = executedResetAwaitingSameFrameAttempt.get(
      decision.scopeKey,
    );
    if (precedingResetLogId !== undefined) {
      const precedingReset = reactionDamageGroupResetLog[precedingResetLogId];
      if (
        precedingReset !== undefined &&
        precedingReset.executionFrame === frame
      ) {
        precedingReset.executedBeforeAttemptTaskSequence = taskSequence;
      }
      executedResetAwaitingSameFrameAttempt.delete(decision.scopeKey);
    }

    return {
      policyId: decision.policyId,
      profileId: decision.profileId,
      icdTag: decision.icdTag,
      icdGroup: decision.icdGroup,
      reaction: decision.reactionTag,
      sourceActorId: actorId,
      targetId,
      scopeKey: decision.scopeKey,
      frame,
      damageGroupTaskSequence: taskSequence,
      windowGeneration: decision.windowGeneration,
      windowStartFrame: decision.windowStartFrame,
      resetAtFrame: decision.resetAtFrame,
      resetTaskLogId: resetTaskLogId ?? null,
      resetTaskSequence: decision.resetTask?.taskSequence ?? null,
      hitIndex: decision.hitIndex,
      sequenceIndex: decision.sequenceIndex,
      sequenceMultiplier: decision.sequenceMultiplier,
      damageAllowed: decision.damageAllowed,
      blockedReason: decision.blockedReason,
    } as ReactionDamageGroupDecisionAuditV150;
  };
  type ReactionDamageGroupAttemptInput = {
    targetId: string;
    actorId: string;
    damageSourceId: string | null;
    frame: number;
    taskSequence: number;
  };
  const consumeReactionADamageGroup = (
    input: ReactionDamageGroupAttemptInput & {
      reaction: ReactionADamageGroupDecisionAuditV150["reaction"];
    },
  ): ReactionADamageGroupDecisionAuditV150 => {
    const decision = consumeReactionDamageGroup(input);
    if (decision.icdGroup !== "reaction-a") {
      throw new Error(
        `Reaction ${input.reaction} unexpectedly resolved to ${decision.icdGroup}.`,
      );
    }
    return decision;
  };
  const consumeReactionBDamageGroup = (
    input: ReactionDamageGroupAttemptInput & {
      reaction: ReactionBDamageGroupDecisionAuditV150["reaction"];
    },
  ): ReactionBDamageGroupDecisionAuditV150 => {
    const decision = consumeReactionDamageGroup(input);
    if (decision.icdGroup !== "reaction-b") {
      throw new Error(
        `Reaction ${input.reaction} unexpectedly resolved to ${decision.icdGroup}.`,
      );
    }
    return decision;
  };
  const projectSwirlDamageGroupAudit = (
    decision: ReactionADamageGroupDecisionAuditV150,
  ): SwirlDamageGroupAudit => {
    if (!decision.reaction.startsWith("swirl")) {
      throw new Error(
        `Cannot project non-Swirl reaction ${decision.reaction} into a Swirl audit.`,
      );
    }
    return {
      reaction: decision.reaction as SwirlReaction,
      windowStartFrame: decision.windowStartFrame,
      hitIndex: decision.hitIndex,
      resetFrames: 30,
      sequence: [true, true, false],
      damageAllowed: decision.damageAllowed,
      blockedReason: decision.blockedReason,
    };
  };
  const projectReactionDamageGroupAuditV149 = (
    decision: ReactionDamageGroupDecisionAuditV150,
  ): ReactionDamageGroupAuditV149 => {
    if (decision.icdGroup === "reaction-a") {
      return {
        reaction: decision.reaction,
        sourceActorId: decision.sourceActorId,
        targetId: decision.targetId,
        windowStartFrame: decision.windowStartFrame,
        hitIndex: decision.hitIndex,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: decision.damageAllowed,
        blockedReason: decision.blockedReason,
      };
    }
    return {
      reaction: decision.reaction,
      sourceActorId: decision.sourceActorId,
      targetId: decision.targetId,
      windowStartFrame: decision.windowStartFrame,
      hitIndex: decision.hitIndex,
      resetFrames: 30,
      sequence: [true, false],
      damageAllowed: decision.damageAllowed,
      blockedReason: decision.blockedReason,
    };
  };
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
        ...targetBurningLifecycleFields(
          targetId,
          frame,
          null,
          null
        ),
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
        clockModel: burningClockModel,
        hitlagStatus: enemyHitlagStatus,
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
  const playerShieldRuntime = config.playerShieldModel === undefined ? undefined : new PlayerShieldRuntime();
  const playerShieldLog: NonNullable<SimulationResult["playerShieldLog"]> = [];
  const playerShieldExpiryFrames = new Set<number>();
  const recordPlayerShieldDecision = (event: { frame: number; timeSeconds: number; priority: number; sequence: number }, intraEventSequence: number, decision: PlayerShieldDecision, playerDamageEventId: number | null = null): number => {
    const id = playerShieldLog.length;
    playerShieldLog.push({ ...decision, id, frame: event.frame, timeSeconds: event.timeSeconds, eventPriority: event.priority,
      eventSequence: event.sequence, intraEventSequence, playerDamageEventId });
    return id;
  };
  const sourceSnapshotLog: SourceSnapshotLogEntry[] = [];
  const sourceSnapshotIds = new Map<string, number>();
  const statConversionLog: NonNullable<SimulationResult["statConversionLog"]> = [];
  const favoniusLog: NonNullable<SimulationResult["favoniusLog"]> = [];
  const weaponProcLog: NonNullable<SimulationResult["weaponProcLog"]> = [];
  const thrillingTalesLog: NonNullable<SimulationResult["thrillingTalesLog"]> = [];
  const sacrificialLog: NonNullable<SimulationResult["sacrificialLog"]> = [];
  const skillCooldownLog: NonNullable<SimulationResult["skillCooldownLog"]> = [];
  const weaponProcLifecycleLog: NonNullable<SimulationResult["weaponProcLifecycleLog"]> = [];
  const artifactEventLog: NonNullable<SimulationResult["artifactEventLog"]> = [];
  const weaponHitStackLog: NonNullable<SimulationResult["weaponHitStackLog"]> = [];
  const artifactBuffLog: NonNullable<SimulationResult["artifactBuffLog"]> = [];
  const artifactDamageLog: NonNullable<SimulationResult["artifactDamageLog"]> = [];
  const nightsoulBurstLog: NonNullable<SimulationResult["nightsoulBurstLog"]> = [];
  const normalHitEnergyLog: NonNullable<SimulationResult["normalHitEnergyLog"]> = [];
  const liveConversions = new Map<string, NonNullable<SimulationResult["statConversionLog"]>[number]>();
  const energyCostLog: NonNullable<SimulationResult["energyCostLog"]> = [];
  const summonLog: NonNullable<SimulationResult["summonLog"]> = [];
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
  const appendWeaponHitStackDecisions = (decisions: WeaponHitStackRuntimeDecision[]): void => {
    const queueEvent = executingEvent!;
    for (const decision of decisions) {
      if (decision.outcome === "actual-critical-required") throw new Error("宗室回调缺少实际暴击结果，不能使用期望伤害推进叠层。");
      weaponHitStackLog.push({ ...decision, id: weaponHitStackLog.length, frame: queueEvent.frame, timeSeconds: queueEvent.frame / 60,
        eventPriority: queueEvent.priority, eventSequence: queueEvent.sequence, intraEventSequence: nextExecutionIntraSequence() });
    }
  };
  const weaponStackShielded = (actorId: string, frame: number): boolean =>
    (playerShieldRuntime?.captureState().shields.some(shield => shield.hp > 0 && frame < shield.expiresAtFrame &&
      (shield.target.kind === "actor" ? shield.target.actorId === actorId : activeCharacterId === actorId)) ?? false) ||
    (activeCharacterId === actorId && activeCrystallizeShield !== null && activeCrystallizeShield.currentBaseHp > 0 && frame < activeCrystallizeShield.expiresAtFrame);
  type ArtifactBuffLinks = Partial<Pick<NonNullable<SimulationResult["artifactBuffLog"]>[number], "actionLogIndex" | "parentDamageEventId" | "playerHealthEventId" | "reactionTaskLogId" | "parentArtifactBuffLogId">>;
  const appendArtifactBuffDecisions = (decisions: ArtifactBuffRuntimeDecision[], links: ArtifactBuffLinks = {}, next = nextExecutionIntraSequence): void => {
    if (decisions.length === 0) return;
    const event = executingEvent!;
    for (const decision of decisions) {
      const id = artifactBuffLog.length;
      for (const removal of decision.removals) {
        for (let index = activeBuffs.length - 1; index >= 0; index--) {
          const buff = activeBuffs[index]!;
          if (buff.targetId === removal.receiverId && buff.key === `${removal.key}:${removal.receiverId}`) activeBuffs.splice(index, 1);
        }
      }
      for (const application of decision.applications) {
        const key = `${application.key}:${application.receiverId}`;
        const existing = activeBuffs.find(buff => buff.key === key && buff.stat === application.stat);
        if (application.operation === "update" && existing !== undefined) existing.value = application.value;
        else {
          for (let index = activeBuffs.length - 1; index >= 0; index--) if (activeBuffs[index]!.key === key && activeBuffs[index]!.stat === application.stat) activeBuffs.splice(index, 1);
          activeBuffs.push({ key, actorId: application.sourceActorId, targetId: application.receiverId,
            stat: application.stat, value: application.value, start: application.startFrame / 60,
            end: application.expiresFrame / 60, label: application.key });
        }
      }
      artifactBuffLog.push({ ...decision, id, frame: event.frame, timeSeconds: event.frame / 60,
        eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: next({kind:'artifact-buff',id}),
        actionLogIndex: null, parentDamageEventId: null, playerHealthEventId: null, reactionTaskLogId: null,
        parentArtifactBuffLogId: null, ...links });
      for (const task of decision.delayedApplications) push(task.applyFrame / 60, "artifactBuffApply", { task, parentArtifactBuffLogId: id });
    }
  };
  const handleArtifactBuff = (event: ArtifactBuffEvent, links: ArtifactBuffLinks = {}, next = nextExecutionIntraSequence): void => {
    appendArtifactBuffDecisions(artifactBuffRuntime?.handle(event) ?? [], links, next);
  };
  const artifactReactionBonus = (actorId: string, reaction: string, frame: number): number => {
    const read = artifactBuffRuntime?.reactionBonus(actorId, reaction, frame);
    if (read === undefined) return 0;
    appendArtifactBuffDecisions(read.decisions);
    return read.value;
  };
  const handleArtifactReactions = (reactions: readonly string[], sourceActorId: string, frame: number, links: ArtifactBuffLinks, targetIsEnemy = true): void => {
    for (const reaction of reactions) if (ARTIFACT_BUFF_ORDINARY_REACTIONS.includes(reaction as ArtifactBuffOrdinaryReaction)) {
      handleArtifactBuff({ kind: "reaction", frame, sourceActorId, activeCharacterId, reaction: reaction as ArtifactBuffOrdinaryReaction, targetIsEnemy }, links);
    }
  };
  const lunarArtifactOptions = executionOptions?.lunarCharged ?? executionOptions?.lunarCrystallize ?? executionOptions?.lunarBloom ?? executionOptions?.lunarMixed ?? executionOptions?.lunarMixedV2;
  if (config.moonlightArtifactModel !== undefined && lunarArtifactOptions?.moonsignLevel !== undefined && lunarArtifactOptions.moonsignLevel !== config.moonlightArtifactModel.moonsignLevel) throw new Error("月曜四件套的月兆等级必须一致。");
  if (config.moonlightArtifactModel?.actors.some(actor => lunarArtifactOptions?.artifacts?.some(other => other.actorId === actor.actorId))) throw new Error("同一角色不能同时佩戴两套已建模月曜四件套。");
  const moonlightArtifactRuntime = config.moonlightArtifactModel === undefined ? undefined : new MoonlightArtifactRuntime(config.moonlightArtifactModel, config.characters.map(actor => actor.id), activeCharacterId);
  const effectiveLunarMoonsign = lunarArtifactOptions?.moonsignLevel ?? config.moonlightArtifactModel?.moonsignLevel;
  const lunarArtifactRuntime = lunarArtifactOptions?.artifacts?.length || moonlightArtifactRuntime !== undefined
    ? new LunarArtifactRuntime({ ...lunarArtifactOptions, ...(effectiveLunarMoonsign === undefined ? {} : { moonsignLevel: effectiveLunarMoonsign }) }, config.characters.map(actor => actor.id), activeCharacterId, moonlightArtifactRuntime) : undefined;
  if (lunarArtifactRuntime?.needsCompletedSwap && resultConfig.timeline === undefined) throw new Error("月曜前台／换人条款需要显式合法时间轴，以实际完成换人为准。");
  // Source Player.Tick completes swaps before the same-frame global Lunar tasks.
  const pendingLunarSwapFrames = new Set(lunarArtifactRuntime?.needsCompletedSwap
    ? timelineExecution!.commandResults.filter(row => row.commandType === "swap" && row.status !== "rejected" && row.endFrame !== null).map(row => row.endFrame!) : []);
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

  const resolveTargetLocalTaskDeadline = (
    targetId: string,
    projectedGlobalFrame: number
  ): TargetLocalTaskDeadline | null => {
    const clock = targetClocks?.get(targetId);
    if (clock === undefined) return null;
    return {
      targetId,
      targetFrame:
        clock.projectLocalFrameAtGlobalFrame(
          projectedGlobalFrame
        )
    };
  };
  const lifecycleScheduleKey = (
    targetId: string,
    generation: number,
    projectedGlobalFrame: number,
    targetLocalDeadline: TargetLocalTaskDeadline | null
  ): string =>
    `${targetId}\u0000${generation}\u0000${
      targetLocalDeadline?.targetFrame ??
      projectedGlobalFrame
    }`;

  const schedulePeriodicReactionExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const targetLocalDeadline =
      resolveTargetLocalTaskDeadline(targetId, expiryFrame);
    const scheduleKey = lifecycleScheduleKey(
      targetId,
      generation,
      expiryFrame,
      targetLocalDeadline
    );
    if (periodicReactionExpiryScheduleKeys.has(scheduleKey)) return;
    periodicReactionExpiryScheduleKeys.add(scheduleKey);
    const payload = {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies PeriodicReactionExpiryEventPayload;
    const priority = targetPhaseV2Enabled
      ? targetPhaseV2LifecyclePriorityForTarget(
          targetId,
          "periodicReactionExpiry"
        )
      : undefined;
    if (targetLocalDeadline === null) {
      push(
        expiryFrame / 60,
        "periodicReactionExpiry",
        payload,
        priority
      );
    } else {
      pushTargetLocal(
        expiryFrame,
        "periodicReactionExpiry",
        payload,
        targetLocalDeadline,
        priority
      );
    }
    scheduleTargetDecayThroughOrder(
      expiryFrame,
      enemyTargetOrderById.get(targetId) ?? 0
    );
  };

  const scheduleElectroChargedGlobalCadence = (
    targetId: string,
    generation: number,
    operation: "start" | "refresh",
    nextTickFrame: number | null,
  ): void => {
    if (!auraV9Enabled || operation !== "start" || nextTickFrame === null) {
      return;
    }
    push(nextTickFrame / 60, "periodicReactionTick", {
      targetId,
      generation,
      tickIndex: 1,
      firstTick: false,
    } satisfies PeriodicReactionTickEventPayload);
  };

  const scheduleElectroChargedCleanup = ({
    targetId,
    generation,
    reactionTaskLogId,
    deadlineTargetFrame,
    projectedGlobalFrame
  }: {
    targetId: string;
    generation: number;
    reactionTaskLogId: number;
    deadlineTargetFrame: number;
    projectedGlobalFrame: number;
  }): void => {
    const payload = {
      targetId,
      generation,
      reactionTaskLogId,
      deadlineTargetFrame
    } satisfies ElectroChargedCleanupEventPayload;
    const targetLocalDeadline =
      targetClocks?.has(targetId) === true
        ? {
            targetId,
            targetFrame: deadlineTargetFrame
          }
        : null;
    const priority = targetPhaseV2LifecyclePriorityForTarget(
      targetId,
      "electroChargedCleanup"
    );
    if (targetLocalDeadline === null) {
      push(
        projectedGlobalFrame / 60,
        "electroChargedCleanup",
        payload,
        priority
      );
    } else {
      pushTargetLocal(
        projectedGlobalFrame,
        "electroChargedCleanup",
        payload,
        targetLocalDeadline,
        priority
      );
    }
    scheduleTargetDecayThroughOrder(
      projectedGlobalFrame,
      enemyTargetOrderById.get(targetId) ?? 0
    );
  };

  const scheduleBurningFuelExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const targetLocalDeadline =
      resolveTargetLocalTaskDeadline(targetId, expiryFrame);
    const scheduleKey = lifecycleScheduleKey(
      targetId,
      generation,
      expiryFrame,
      targetLocalDeadline
    );
    if (burningFuelExpiryScheduleKeys.has(scheduleKey)) return;
    burningFuelExpiryScheduleKeys.add(scheduleKey);
    const payload = {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies BurningFuelExpiryEventPayload;
    const priority = targetPhaseV2Enabled
      ? targetPhaseV2LifecyclePriorityForTarget(
          targetId,
          "burningFuelExpiry"
        )
      : undefined;
    if (targetLocalDeadline === null) {
      push(
        expiryFrame / 60,
        "burningFuelExpiry",
        payload,
        priority
      );
    } else {
      pushTargetLocal(
        expiryFrame,
        "burningFuelExpiry",
        payload,
        targetLocalDeadline,
        priority
      );
    }
    scheduleTargetDecayThroughOrder(
      expiryFrame,
      enemyTargetOrderById.get(targetId) ?? 0
    );
  };

  const scheduleFrozenExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const targetLocalDeadline =
      resolveTargetLocalTaskDeadline(targetId, expiryFrame);
    const scheduleKey = lifecycleScheduleKey(
      targetId,
      generation,
      expiryFrame,
      targetLocalDeadline
    );
    if (frozenExpiryScheduleKeys.has(scheduleKey)) return;
    frozenExpiryScheduleKeys.add(scheduleKey);
    const payload = {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies FrozenExpiryEventPayload;
    const priority = targetPhaseV2Enabled
      ? targetPhaseV2LifecyclePriorityForTarget(
          targetId,
          "frozenExpiry"
        )
      : undefined;
    if (targetLocalDeadline === null) {
      push(
        expiryFrame / 60,
        "frozenExpiry",
        payload,
        priority
      );
    } else {
      pushTargetLocal(
        expiryFrame,
        "frozenExpiry",
        payload,
        targetLocalDeadline,
        priority
      );
    }
    scheduleTargetDecayThroughOrder(
      expiryFrame,
      enemyTargetOrderById.get(targetId) ?? 0
    );
  };

  const scheduleQuickenExpiry = (
    targetId: string,
    generation: number,
    expiryFrame: number | null
  ): void => {
    if (expiryFrame === null) return;
    const targetLocalDeadline =
      resolveTargetLocalTaskDeadline(targetId, expiryFrame);
    const scheduleKey = lifecycleScheduleKey(
      targetId,
      generation,
      expiryFrame,
      targetLocalDeadline
    );
    if (quickenExpiryScheduleKeys.has(scheduleKey)) return;
    quickenExpiryScheduleKeys.add(scheduleKey);
    const payload = {
      targetId,
      generation,
      expectedExpiryFrame: expiryFrame
    } satisfies QuickenExpiryEventPayload;
    const priority = targetPhaseV2Enabled
      ? targetPhaseV2LifecyclePriorityForTarget(
          targetId,
          "quickenExpiry"
        )
      : undefined;
    if (targetLocalDeadline === null) {
      push(
        expiryFrame / 60,
        "quickenExpiry",
        payload,
        priority
      );
    } else {
      pushTargetLocal(
        expiryFrame,
        "quickenExpiry",
        payload,
        targetLocalDeadline,
        priority
      );
    }
    scheduleTargetDecayThroughOrder(
      expiryFrame,
      enemyTargetOrderById.get(targetId) ?? 0
    );
  };

  const scheduleBurningTickEvent = (
    targetId: string,
    generation: number,
    tickIndex: number,
    projectedGlobalFrame: number
  ): void => {
    const payload = {
      targetId,
      generation,
      tickIndex
    } satisfies BurningTickEventPayload;
    const targetLocalDeadline =
      resolveTargetLocalTaskDeadline(
        targetId,
        projectedGlobalFrame
      );
    if (targetLocalDeadline === null) {
      push(
        projectedGlobalFrame / 60,
        "burningTick",
        payload,
        burningTickPriorityForTarget(targetId)
      );
    } else {
      pushTargetLocal(
        projectedGlobalFrame,
        "burningTick",
        payload,
        targetLocalDeadline,
        burningTickPriorityForTarget(targetId)
      );
    }
    scheduleTargetDecayThroughOrder(
      projectedGlobalFrame,
      enemyTargetOrderById.get(targetId) ?? 0
    );
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
    const propagationModel =
      config.electroChargedPropagationModel;
    const targetingMode =
      propagationModel.mode === "nearby-wet-radius-v1"
        ? ("electro-charged-nearby-wet" as const)
        : ("single-target" as const);
    const propagationRadius =
      propagationModel.mode === "nearby-wet-radius-v1"
        ? propagationModel.radius
        : 0;
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
      targetingMode,
      centerPosition: null,
      radius: propagationRadius,
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
      hitResolutionLogIds: [],
      elementalApplicationIcdLogIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    });
    const periodicLog = periodicReactionLog[periodicReactionLogId];
    if (periodicLog !== undefined) {
      periodicLog.reactionDamageLogId = reactionDamageLogId;
    }
    if (!withinSimulation && !retainedOrdinaryReactionQueue) return;
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
      targetingMode,
      centerPosition: null,
      radius: propagationRadius,
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
  }): {
    reactionDamageLogId: number;
    eventPriority: number;
    eventSequence: number | null;
  } => {
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
      hitResolutionLogIds: [],
      elementalApplicationIcdLogIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    });
    const burningLog = burningStateLog[burningStateLogId];
    if (burningLog !== undefined) {
      burningLog.reactionDamageLogId = reactionDamageLogId;
    }
    const eventPriority = burningDamagePriorityForTarget(targetId);
    if (!withinSimulation && !retainedOrdinaryReactionQueue) {
      return {
        reactionDamageLogId,
        eventPriority,
        eventSequence: null
      };
    }
    const eventSequence = push(
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
        reactionApplication: {
          channel: { kind: "burning-tick" },
          nominalGaugeUnits: AURA_ENGINE_CONSTANTS.burningApplicationGaugeUnits
        },
        burningContext: {
          generation,
          tickIndex,
          burningStateLogId
        }
      } satisfies ReactionDamageEventPayload,
      eventPriority
    );
    return {
      reactionDamageLogId,
      eventPriority,
      eventSequence
    };
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

  const recordTargetClockAdvance = (
    targetId: string,
    cause: Extract<
      TargetClockLogEntry["cause"],
      "target-local-task" | "simulation-end"
    >
  ): void => {
    const clock = targetClocks?.get(targetId);
    if (clock === undefined) return;
    const before = lastLoggedTargetClockState.get(targetId);
    const after = clock.getState();
    if (before === undefined) {
      throw new Error(
        `Missing target clock replay state for "${targetId}".`
      );
    }
    const globalDelta =
      after.globalFrame - before.globalFrame;
    if (globalDelta === 0) return;
    const consumedFrozenFrames = Math.min(
      globalDelta,
      before.frozenFrames
    );
    const entry: TargetClockLogEntry = {
      id: targetClockLog.length,
      targetId,
      targetName:
        enemyTargetById.get(targetId)?.name ?? targetId,
      operation: "advance",
      globalFrameBefore: before.globalFrame,
      globalFrameAfter: after.globalFrame,
      targetFrameBefore: before.localFrame,
      targetFrameAfter: after.localFrame,
      frozenFramesBefore: before.frozenFrames,
      consumedFrozenFrames,
      addedFrozenFrames: 0,
      frozenFramesAfter: after.frozenFrames,
      targetHitlagLogId: null,
      cause
    };
    targetClockLog.push(entry);
    lastLoggedTargetClockState.set(targetId, {
      ...after
    });
  };
  const materializeTargetPhaseV2Decay = (
    globalFrame: number,
    targetId: string
  ): TargetPhaseV2RuntimeState | null => {
    if (!targetPhaseV2Enabled) return null;
    const state = ensureTargetPhaseV2State({
      targetId,
      globalFrame,
      emit: false
    });
    if (state === null || state.decayMaterialized) {
      return state;
    }
    const targetOrder = enemyTargetOrderById.get(targetId);
    if (targetOrder === undefined) {
      throw new Error(
        `Target phase v2 decay could not resolve target order for "${targetId}".`
      );
    }
    const auraEngine = auraEngines?.get(targetId);
    const auraBefore = deepClone(
      state.entry.auraAfterTargetTasks
    );
    const burningFuelExpiresNow = auraBefore.some(
      (entry) =>
        entry.element === "burningFuel" &&
        entry.expiresAtFrame === globalFrame
    );
    const ordinaryExpiresNow = auraBefore.some(
      (entry) =>
        ordinaryAuraElements.has(entry.element) &&
        entry.expiresAtFrame === globalFrame &&
        !(
          burningFuelExpiresNow &&
          entry.element === "dendro"
        )
    );
    const auraAfter =
      auraEngine === undefined
        ? []
        : auraEngine.getAuraStateAt(globalFrame);
    const hasExactLifecycleBoundary = auraBefore.some(
      (entry) =>
        entry.expiresAtFrame === globalFrame &&
        (ordinaryAuraElements.has(entry.element) ||
          entry.element === "burningFuel" ||
          entry.element === "frozen" ||
          entry.element === "quicken")
    );
    // A sparse incoming/core wake has no same-frame target-task timeline
    // point that could serve as the left endpoint of an ordinary-decay
    // bridge. Canonicalize that task-less/no-expiry phase at the post-decay
    // observation instead: the preceding authoritative point still proves
    // the sparse clock advance, while an exact natural/Reactable expiry keeps
    // its pre-boundary snapshot for the typed transition below.
    if (
      state.entry.targetTasks.length === 0 &&
      !state.hasBeforeReactableInlineDelivery &&
      !hasExactLifecycleBoundary
    ) {
      state.entry.auraBeforeTargetTasks =
        deepClone(auraAfter);
      state.entry.auraAfterTargetTasks =
        deepClone(auraAfter);
    }
    // `reactableTick.auraBefore` is the first explicit transition boundary.
    // In the common sparse case there is no explicit lifecycle transition, so
    // both sides are the materialized post-decay Aura. If a transition is
    // appended later, appendTargetPhaseV2Transition replaces this with that
    // transition point's authoritative auraBefore.
    state.entry.reactableTick.auraBefore =
      deepClone(auraAfter);
    state.entry.reactableTick.auraAfter =
      deepClone(auraAfter);
    if (auraEngine === undefined) {
      targetClocks?.get(targetId)?.advanceTo(globalFrame);
    }
    recordTargetClockAdvance(targetId, "target-local-task");
    if (ordinaryExpiresNow) {
      const specialBoundaryElements = new Set<
        (typeof auraBefore)[number]["element"]
      >();
      if (burningFuelExpiresNow) {
        for (const element of [
          "burningFuel",
          "burning",
          "dendro",
          "quicken"
        ] as const) {
          specialBoundaryElements.add(element);
        }
      } else if (
        auraBefore.some(
          (entry) =>
            entry.element === "quicken" &&
            entry.expiresAtFrame === globalFrame
        )
      ) {
        specialBoundaryElements.add("quicken");
      }
      if (
        auraBefore.some(
          (entry) =>
            entry.element === "frozen" &&
            entry.expiresAtFrame === globalFrame
        )
      ) {
        specialBoundaryElements.add("frozen");
      }
      const expiringOrdinaryElements = new Set(
        auraBefore
          .filter(
            (entry) =>
              ordinaryAuraElements.has(entry.element) &&
              entry.expiresAtFrame === globalFrame &&
              !specialBoundaryElements.has(entry.element)
          )
          .map((entry) => entry.element)
      );
      const ordinaryAuraBefore = [
        ...auraAfter.filter(
          (entry) =>
            !expiringOrdinaryElements.has(entry.element) &&
            !specialBoundaryElements.has(entry.element)
        ),
        ...auraBefore.filter(
          (entry) =>
            expiringOrdinaryElements.has(entry.element) ||
            specialBoundaryElements.has(entry.element)
        )
      ].sort((left, right) =>
        left.element.localeCompare(right.element)
      );
      const ordinaryAuraAfter = [
        ...auraAfter.filter(
          (entry) =>
            !specialBoundaryElements.has(entry.element)
        ),
        ...auraBefore.filter((entry) =>
          specialBoundaryElements.has(entry.element)
        )
      ].sort((left, right) =>
        left.element.localeCompare(right.element)
      );
      const targetStateTimelinePointId =
        targetStateTimelineRecorder.result().points.length;
      targetStateTimelineRecorder.recordNaturalExpiry({
        frame: globalFrame,
        timeSeconds: globalFrame / 60,
        targetId,
        targetName:
          enemyTargetById.get(targetId)?.name ?? targetId,
        auraBefore: ordinaryAuraBefore,
        auraAfter: ordinaryAuraAfter
      });
      recordTargetPhaseV2NaturalExpiry({
        targetId,
        targetName:
          enemyTargetById.get(targetId)?.name ?? targetId,
        globalFrame,
        auraBefore: ordinaryAuraBefore,
        auraAfter: ordinaryAuraAfter,
        targetStateTimelinePointId
      });
    }
    if (
      (state.entry.targetTasks.length > 0 ||
        state.hasBeforeReactableInlineDelivery) &&
      state.entry.reactableTick.transitions.length === 0 &&
      !hasExactLifecycleBoundary &&
      !auraStateSnapshotsEqual(
        state.entry.auraAfterTargetTasks,
        auraAfter
      )
    ) {
      targetStateTimelineRecorder.recordReactableTickDecay({
        frame: globalFrame,
        timeSeconds: globalFrame / 60,
        targetId,
        targetName:
          enemyTargetById.get(targetId)?.name ?? targetId,
        aura: auraAfter
      });
    }
    state.entry.targetFrame = resolveTargetFrameAt(
      targetId,
      globalFrame
    );
    state.entry.reactableTick.toTargetFrame =
      state.entry.targetFrame;
    if (state.entry.reactableTick.transitions.length === 0) {
      state.entry.reactableTick.auraBefore =
        deepClone(auraAfter);
      state.entry.reactableTick.auraAfter =
        deepClone(auraAfter);
    }
    state.decayMaterialized = true;
    completedTargetDecayKeys.add(
      targetDecayKey(globalFrame, targetId)
    );
    scheduledTargetDecayKeys.delete(
      targetDecayKey(globalFrame, targetId)
    );
    return state;
  };

  const extendHitlagAffectedReactionStatuses = (
    targetId: string,
    frame: number,
    extensionFrames: number
  ): number[] => {
    if (extensionFrames <= 0) return [];
    const extendedLogIds: number[] = [];
    for (const debuff of activeTargetDebuffs) {
      if (
        debuff.targetId !== targetId ||
        debuff.key !== "superconduct-phys-shred" ||
        debuff.reaction !== "superconduct" ||
        debuff.endFrame <= frame
      ) {
        continue;
      }
      debuff.endFrame += extensionFrames;
      debuff.end = debuff.endFrame / 60;
      const statusLog =
        reactionStatusLog[debuff.reactionStatusLogId];
      if (statusLog === undefined) {
        throw new Error(
          `Missing reaction status log ${debuff.reactionStatusLogId} for active target debuff.`
        );
      }
      statusLog.endFrame = debuff.endFrame;
      statusLog.endTimeSeconds = debuff.end;
      extendedLogIds.push(debuff.reactionStatusLogId);
    }
    return extendedLogIds;
  };

  const applyConfiguredTargetHitlag = ({
    targetId,
    targetName,
    actorId,
    actionId,
    hit,
    hitId,
    hitGroupId,
    hitResolutionLogId,
    frame,
    landed,
    eventPriority,
    eventSequence,
    intraEventSequence
  }: {
    targetId: string;
    targetName: string;
    actorId: string;
    actionId: string;
    hit: HitDefinition;
    hitId: string;
    hitGroupId: string;
    hitResolutionLogId: number;
    frame: number;
    landed: boolean;
    eventPriority: number;
    eventSequence: number;
    intraEventSequence: number;
  }): void => {
    const definition = hit.targetHitlag;
    if (definition === undefined) return;
    const clock = targetClocks?.get(targetId);
    if (clock === undefined) {
      throw new Error(
        `Hit "${hitId}" configured target Hitlag while target clock is disabled.`
      );
    }

    const auraEngine = auraEngines?.get(targetId);
    if (auraEngine === undefined) {
      clock.advanceTo(frame);
    } else {
      auraEngine.getAuraStateAt(frame);
    }
    recordTargetClockAdvance(
      targetId,
      "target-local-task"
    );

    const stateBefore = clock.getState();
    const roundedHaltFrames = Math.ceil(
      definition.haltFrames
    );
    const extensionFrames =
      calculateEnemyHitlagExtension(
        definition.haltFrames,
        definition.factor
      );
    const targetHitlagLogId = targetHitlagLog.length;

    let stateAfter = stateBefore;
    let pausedGlobalFrameStart: number | null = null;
    let nextTargetAdvanceGlobalFrame: number | null = null;
    let extendedReactionStatusLogIds: number[] = [];
    const applied = landed && extensionFrames > 0;
    if (applied) {
      const audit =
        auraEngine === undefined
          ? clock.applyHitlag({
              globalFrame: frame,
              haltFrames: definition.haltFrames,
              factor: definition.factor
            })
          : auraEngine.applyTargetHitlag({
              globalFrame: frame,
              haltFrames: definition.haltFrames,
              factor: definition.factor
            });
      stateAfter = clock.getState();
      pausedGlobalFrameStart =
        audit.pausedGlobalFrameStart;
      nextTargetAdvanceGlobalFrame =
        audit.projectedResumeGlobalFrame;
      extendedReactionStatusLogIds =
        extendHitlagAffectedReactionStatuses(
          targetId,
          frame,
          extensionFrames
        );
      if (auraEngine !== undefined) {
        targetStateTimelineRecorder.synchronize(
          targetId,
          frame,
          auraEngine.getAuraStateAt(frame)
        );
      }
    }

    const hitlagEntry: TargetHitlagLogEntry = {
      id: targetHitlagLogId,
      globalFrame: frame,
      timeSeconds: frame / 60,
      targetFrame: stateBefore.localFrame,
      eventPriority,
      eventSequence,
      intraEventSequence,
      targetId,
      targetName,
      sourceActorId: actorId,
      sourceActionId: actionId,
      hitId,
      hitGroupId,
      hitResolutionLogId,
      haltFrames: definition.haltFrames,
      factor: definition.factor,
      roundedHaltFrames,
      extensionFrames,
      frozenFramesBefore: stateBefore.frozenFrames,
      frozenFramesAfter: stateAfter.frozenFrames,
      pausedGlobalFrameStart,
      nextTargetAdvanceGlobalFrame,
      applied,
      blockedReason: applied
        ? null
        : landed
          ? "ZERO_EXTENSION"
          : "TARGET_MISS",
      extendedReactionStatusLogIds,
      mechanicsDataStatus: "fixed-gcsim-provisional"
    };
    targetHitlagLog.push(hitlagEntry);

    if (!applied) return;
    targetClockLog.push({
      id: targetClockLog.length,
      targetId,
      targetName,
      operation: "apply-hitlag",
      globalFrameBefore: stateBefore.globalFrame,
      globalFrameAfter: stateAfter.globalFrame,
      targetFrameBefore: stateBefore.localFrame,
      targetFrameAfter: stateAfter.localFrame,
      frozenFramesBefore: stateBefore.frozenFrames,
      consumedFrozenFrames: 0,
      addedFrozenFrames: extensionFrames,
      frozenFramesAfter: stateAfter.frozenFrames,
      targetHitlagLogId,
      cause: "hit"
    });
    lastLoggedTargetClockState.set(targetId, {
      ...stateAfter
    });
    totalTargetHitlagExtensionById.set(
      targetId,
      (totalTargetHitlagExtensionById.get(targetId) ?? 0) +
        extensionFrames
    );
    targetHitlagApplicationCountById.set(
      targetId,
      (targetHitlagApplicationCountById.get(targetId) ?? 0) +
        1
    );
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
      const stat = options.flatStatBuffSemantics === "canonical-v1"
        ? buff.stat === "atkFlat" ? "flatAtk" : buff.stat === "hpFlat" ? "flatHp" : buff.stat === "defFlat" ? "flatDef" : buff.stat
        : buff.stat;
      compatibilityStats[stat] = safeNumber(compatibilityStats[stat]) + buff.value;
    }
    for (const conversion of liveConversions.values()) {
      if (actionLog[conversion.actionLogIndex]?.actorId === characterId && toFrame(timeSeconds) < conversion.expiresAtFrame) stats.flatAtk += conversion.appliedValue;
    }
    const weaponStackValues = weaponHitStackRuntime?.peekValues(characterId, toFrame(timeSeconds), weaponStackShielded(characterId, toFrame(timeSeconds))).values;
    if (weaponStackValues !== undefined) {
      stats.atkPct += weaponStackValues.atkPct; stats.defPct += weaponStackValues.defPct;
      stats.critRate += weaponStackValues.critRate; stats.dmgBonus += weaponStackValues.dmgBonus;
    }
    const stellarArtifactStats = stellarArtifactRuntime?.statBonuses(characterId, toFrame(timeSeconds));
    if (stellarArtifactStats !== undefined) {
      stats.atkPct += stellarArtifactStats.atkPct;
      stats.critRate += stellarArtifactStats.critRate;
    }
    const moonlightArtifactStats = moonlightArtifactRuntime?.statBonuses(characterId, toFrame(timeSeconds));
    if (moonlightArtifactStats !== undefined) {
      stats.critRate += moonlightArtifactStats.critRate;
      stats.em += moonlightArtifactStats.em;
    }
    stats.critRate = clamp(stats.critRate, 0, 1);
    stats.defIgnore = clamp(stats.defIgnore, 0, 1);
    return stats;
  };
  const sampleStats = (actorId: string, timeSeconds: number): CharacterStats | undefined => {
    appendWeaponHitStackDecisions(weaponHitStackRuntime?.handle({kind:"stats-sample",frame:toFrame(timeSeconds),actorId,shielded:weaponStackShielded(actorId,toFrame(timeSeconds))}) ?? []);
    thrillingTalesRuntime?.markStatsSample(actorId, toFrame(timeSeconds));
    appendArtifactBuffDecisions(artifactBuffRuntime?.markStatsSample(actorId, toFrame(timeSeconds)) ?? []);
    return computeStats(actorId, timeSeconds);
  };
  const syncPlayerMaxHp = (event: { frame: number; timeSeconds: number; priority: number; sequence: number }, cause: "buff-apply" | "buff-expire"): void => {
    if (config.playerMaxHpModel === undefined) return;
    for (const [actorIndex, actor] of config.characters.entries()) {
      const state = playerHpStateByActorId.get(actor.id)!;
      const stats = computeStats(actor.id, event.timeSeconds)!;
      const maxHpAfter = calcPlayerMaxHp({ baseHp: stats.baseHp, hpPct: stats.hpPct, flatHp: stats.flatHp }).maxHp;
      if (state.maxHp === maxHpAfter) continue;
      const calculation = calculatePlayerMaxHpChange({ hpBefore: state.currentHp, maxHpBefore: state.maxHp, maxHpAfter,
        statsAfter: { baseHp: stats.baseHp, hpPct: stats.hpPct, flatHp: stats.flatHp },
        ...(state.currentBondOfLife === undefined ? {} : { bondOfLifeBefore: state.currentBondOfLife }) });
      const id = playerMaxHpEvents.length;
      playerMaxHpEvents.push({ id, frame: event.frame, timeSeconds: event.timeSeconds, eventPriority: event.priority,
        eventSequence: event.sequence, intraEventSequence: actorIndex * 2, actorId: actor.id, cause, ...calculation });
      state.maxHp = maxHpAfter;
      state.currentHp = calculation.hpAfter;
      state.totalMaxHpAdjustment += calculation.hpAdjustment;
      playerHpTimeline.points.push({ id: playerHpTimeline.points.length, frame: event.frame, timeSeconds: event.timeSeconds,
        eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: actorIndex * 2 + 1,
        operation: "max-hp-change", actorId: actor.id, playerDamageEventId: null, playerMaxHpEventId: id,
        maxHp: maxHpAfter, hpBefore: calculation.hpBefore, hpAfter: calculation.hpAfter, hpRatioAfter: calculation.hpRatioAfter });
    }
  };
  const currentThrillingTalesStatuses = (actorId: string): ActiveStatusSnapshot[] => activeBuffs
    .filter(buff => buff.targetId === actorId && buff.key === `ttds:${actorId}`)
    .map(buff => ({ key: buff.key, kind: "buff", sourceActorId: buff.actorId, targetId: buff.targetId,
      stat: buff.stat, value: buff.value, startTimeSeconds: buff.start, endTimeSeconds: buff.end, label: buff.label }));

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
        : consumeReactionADamageGroup({
            targetId: "player-avatar",
            actorId: sourceActorId,
            reaction,
            damageSourceId: sourceTargetId,
            frame,
            taskSequence: eventSequence,
          });
    const damageGroupDecision: ReactionADamageGroupDecisionAuditV150 | null =
      playerReactionA;
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
          ...(playerShieldRuntime === undefined ? {} : { shieldStrengthBonus: playerShieldStrengthBonus(playerShieldRuntime.captureState(), frame) }),
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

    const genericShieldDecision = playerShieldRuntime?.absorb({ frame, operation: "reaction-hit", targetActorId,
      activeCharacterId: activeCharacterId!, incomingDamage, incomingElement: damageElement, crystallizeDamageAfter: shieldResolution.damageAfterShield });
    const playerShieldLogId = genericShieldDecision === undefined ? undefined : recordPlayerShieldDecision(
      { frame, timeSeconds, priority: eventPriority, sequence: eventSequence }, nextIntraEventSequence(), genericShieldDecision, playerDamageEventId);
    const hpResolution: SimulationResult["playerDamageEvents"][number]["hpResolution"] = playerShieldRuntime === undefined
      ? { zeroHpPolicy: "clamp-and-continue", ...applyPlayerHpDamage({ currentHp: hpState.currentHp, maxHp: hpState.maxHp, incomingDamage: shieldResolution.damageAfterShield }) }
      : calculatePlayerShieldHpDamage({ currentHp: hpState.currentHp, maxHp: hpState.maxHp, incomingDamage: genericShieldDecision!.damageAfterShield! }).resolution;
    if (playerShieldLogId !== undefined) playerShieldLog[playerShieldLogId]!.hpResolution = hpResolution;
    const playerDamageEvent: SimulationResult["playerDamageEvents"][number] =
      {
        id: playerDamageEventId,
        ...(playerShieldLogId === undefined ? {} : { playerShieldLogId }),
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
      genericShieldDecision?.absorbedDamage ?? shieldResolution.absorbedDamage;
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
    if (decision.reaction === "hyperbloom" || decision.reaction === "burgeon") lunarArtifactRuntime?.reactionTriggered(damageSourceActorId, removalFrame, decision.reaction);
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
      clockModel: dendroCoreClockModel,
      hitlagStatus: dendroCoreHitlagStatus,
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
      hitResolutionLogIds: [],
      elementalApplicationIcdLogIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    });
    if (withinSimulation || retainedOrdinaryReactionQueue) {
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
    reactionTaskLogId,
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
    eventType:
      | "hit"
      | "reactionDamage"
      | "quickenBloomFollowup";
    eventPriority: number;
    eventSequence: number;
    reactionTaskLogId?: number;
    nextIntraEventSequence: () => number;
  }): {
    dendroCoreLogIds: number[];
    dendroCoreIds: number[];
  } => {
    const dendroCoreLogIds: number[] = [];
    const dendroCoreIds: number[] = [];
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
      const dendroCoreLogId = dendroCoreLog.length;
      dendroCoreLog.push({
        id: dendroCoreLogId,
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
        clockModel: dendroCoreClockModel,
        hitlagStatus: dendroCoreHitlagStatus,
        mechanicsDataStatus:
          DENDRO_CORE_CONSTANTS.mechanicsDataStatus,
        selfDamageStatus: playerSelfDamageStatus,
        ...(reactionTaskLogId === undefined
          ? {}
          : { reactionTaskLogId }),
        bloomReactionIndex,
        spawnFrame: reservation.spawnFrame,
        withinSimulation,
        reason: "BLOOM_TRIGGERED"
      });
      dendroCoreLogIds.push(dendroCoreLogId);
      dendroCoreIds.push(reservation.coreId);
      if (withinSimulation || retainedOrdinaryReactionQueue) {
        push(reservation.spawnFrame / 60, "dendroCoreSpawn", {
          reservation
        } satisfies DendroCoreSpawnEventPayload);
      }
    });
    return { dendroCoreLogIds, dendroCoreIds };
  };

  const scheduleQuickenBloomFollowup = ({
    audit,
    actorId,
    action,
    triggerHitId,
    triggerHitGroupId,
    triggerDamageEventId,
    sourceTargetId,
    reactionBonusDelta,
    cycle,
    frame,
    triggerEventType,
    triggerEventPriority,
    triggerEventSequence
  }: {
    audit: ReactionAudit;
    actorId: string;
    action: ActionDefinition;
    triggerHitId: string;
    triggerHitGroupId: string;
    triggerDamageEventId: number;
    sourceTargetId: string;
    reactionBonusDelta: number;
    cycle: number;
    frame: number;
    triggerEventType: "hit" | "reactionDamage";
    triggerEventPriority: number;
    triggerEventSequence: number;
  }): void => {
    const quicken = audit.catalyzeReaction?.quicken;
    if (
      (config.reactionEngine?.mode !== "aura-v7" &&
        config.reactionEngine?.mode !== "aura-v8" &&
        config.reactionEngine?.mode !== "aura-v9") ||
      quicken?.pendingHydroBloomFollowup !== true
    ) {
      return;
    }
    push(
      frame / 60,
      "quickenBloomFollowup",
      {
        targetId: sourceTargetId,
        sourceActorId: actorId,
        action,
        triggerHitId,
        triggerHitGroupId,
        triggerDamageEventId,
        triggerElement: quicken.triggerElement,
        reactionBonusDelta,
        cycle,
        triggerEventType,
        triggerEventPriority,
        triggerEventSequence
      } satisfies QuickenBloomFollowupEventPayload,
      triggerEventPriority
    );
  };

  const recordShatterFrozenState = ({
    result,
    targetId,
    targetName,
    sourceActorId,
    triggerDamageEventId,
    frame,
    timeSeconds,
    freezeResistance,
    triggerEventType,
    triggerEventPriority,
    triggerEventSequence,
    nextIntraEventSequence,
  }: {
    result: ShatterStateResult;
    targetId: string;
    targetName: string;
    sourceActorId: string;
    triggerDamageEventId: number;
    frame: number;
    timeSeconds: number;
    freezeResistance: number;
    triggerEventType: SimulationEvent["type"];
    triggerEventPriority: number;
    triggerEventSequence: number;
    nextIntraEventSequence: () => number;
  }): void => {
    const existingSource = activeFrozenStateSources.get(targetId);
    for (const mutation of result.mutations) {
      const frozenStateEntry: SimulationResult["frozenStateLog"][number] = {
        id: frozenStateLog.length,
        reaction: "shatter",
        generation: result.audit.generation,
        operation: mutation.operation,
        frame,
        ...targetLifecycleFields(
          targetId,
          frame,
          result.audit.expiresAtFrame
        ),
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
      };
      frozenStateLog.push(frozenStateEntry);
      appendFreezeBrokenAttackAudit({
        frozenStateEntry,
        depletionDamageEventId: triggerDamageEventId,
        sourceFreezeDamageEventId:
          existingSource?.triggerDamageEventId ?? null,
        triggerEventType,
        triggerEventPriority,
        triggerEventSequence,
        nextIntraEventSequence,
      });
    }
    if (result.mutations.length === 0) return;
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
    audit: Pick<
      ReactionAudit,
      "catalyzeReaction" | "bloomReactions"
    >;
    targetId: string;
    targetName: string;
    sourceActorId: string;
    triggerDamageEventId: number;
    frame: number;
    timeSeconds: number;
  }): number[] => {
    const recordedLogIds: number[] = [];
    const quicken = audit.catalyzeReaction?.quicken;
    if (quicken !== null && quicken !== undefined) {
      const quickenStateLogId = quickenStateLog.length;
      quickenStateLog.push({
        id: quickenStateLogId,
        reaction: "quicken",
        generation: quicken.generation,
        operation: quicken.operation,
        frame,
        ...targetQuickenLifecycleFields(
          targetId,
          frame,
          quicken.expiresAtFrameBefore,
          quicken.expiresAtFrame
        ),
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
      recordedLogIds.push(quickenStateLogId);
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
      const quickenStateLogId = quickenStateLog.length;
      quickenStateLog.push({
        id: quickenStateLogId,
        reaction: "quicken",
        generation: mutation.generationAfter,
        operation: mutation.operation,
        frame,
        ...targetQuickenLifecycleFields(
          targetId,
          frame,
          mutation.expiresAtFrameBefore,
          mutation.expiresAtFrameAfter
        ),
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
      recordedLogIds.push(quickenStateLogId);
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
    return recordedLogIds;
  };

  const projectedQuickenDecayRebaseLogIds = (
    audit: ReactionAudit
  ): number[] => {
    let nextLogId = quickenStateLog.length;
    const projectedIds: number[] = [];
    if (audit.catalyzeReaction?.quicken != null) {
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
      ...targetQuickenLifecycleFields(
        targetId,
        frame,
        mutation.expiresAtFrameBefore,
        mutation.expiresAtFrameAfter
      ),
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

  const recordOrderedQuickenState = ({
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
  }): number[] => {
    // Aura mutates Quicken in this exact order for a single application:
    // Quicken attachment, Burning decay rebase/removal, then synchronous
    // Bloom consumption. Serializing the same order keeps the active source
    // generation aligned with the authoritative Aura lifecycle.
    const catalyzeLogIds = recordQuickenState({
      audit: {
        catalyzeReaction: audit.catalyzeReaction,
        bloomReactions: []
      },
      targetId,
      targetName,
      sourceActorId,
      triggerDamageEventId,
      frame,
      timeSeconds
    });
    const burningLogId = recordBurningQuickenStateMutation({
      audit,
      targetId,
      targetName,
      fallbackSourceActorId: sourceActorId,
      fallbackTriggerDamageEventId: triggerDamageEventId,
      frame,
      timeSeconds
    });
    const bloomLogIds = recordQuickenState({
      audit: {
        catalyzeReaction: null,
        bloomReactions: audit.bloomReactions
      },
      targetId,
      targetName,
      sourceActorId,
      triggerDamageEventId,
      frame,
      timeSeconds
    });
    return [
      ...catalyzeLogIds,
      ...(burningLogId === null ? [] : [burningLogId]),
      ...bloomLogIds
    ];
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
    triggerFrame,
    eventPriority,
    eventSequence,
    nextIntraEventSequence
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
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): number | null => {
    if (!audit.triggered) return null;
    if (audit.scheduled) reactionBonus += artifactReactionBonus(actorId, "shatter", triggerFrame);
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
      hitResolutionLogIds: [],
      elementalApplicationIcdLogIds: [],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    });
    if (!withinSimulation && (!retainedOrdinaryReactionQueue || !audit.scheduled)) return null;
    if (recursiveShatterDeliveryEnabled && !withinSimulation) {
      periodicCheckpointRuntimeBlockers.add("递归碎冰的源内联伤害落在观察窗外，尚未导出可继续的内联任务状态。");
      return null;
    }
    if (recursiveShatterDeliveryEnabled) {
      return settleRecursiveShatterDamage({
        actorId,
        action,
        triggerHitId,
        triggerHitGroupId,
        parentDamageEventId: triggerDamageEventId,
        sourceTargetId,
        baseMultiplier: audit.baseMultiplier,
        stats,
        elementalMastery: stats.em,
        reactionBonus,
        sourceBuffStatuses,
        snapshot,
        cycle,
        reactionDamageLogId,
        frame: audit.damageFrame,
        eventPriority,
        eventSequence,
        nextIntraEventSequence
      });
    }
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
    return null;
  };

  const resolveSwirlDamageGroup = ({
    targetId,
    actorId,
    reaction,
    damageSourceId,
    frame,
    taskSequence,
  }: {
    targetId: string;
    actorId: string;
    reaction: SwirlReaction;
    damageSourceId: string;
    frame: number;
    taskSequence: number;
  }): ReactionADamageGroupDecisionAuditV150 =>
    consumeReactionADamageGroup({
      targetId,
      actorId,
      reaction,
      damageSourceId,
      frame,
      taskSequence,
    });

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
      const sampledReactionBonus = reactionBonus + (audit.scheduled ? artifactReactionBonus(actorId, audit.reaction, triggerFrame) : 0);
      const attacks = [
        {
          scheduleKind: "swirl-self" as const,
          damageFrame: audit.selfDamageFrame,
          targetingMode: "single-target" as const,
          centerPosition: null,
          radius: 0,
          baseMultiplier: audit.selfBaseMultiplier,
          reactionApplication: undefined,
          excludedTargetIds: [] as string[]
        },
        {
          scheduleKind: "swirl-propagation" as const,
          damageFrame: audit.propagationDamageFrame,
          targetingMode: "radius" as const,
          centerPosition: deepClone(centerPosition),
          radius: audit.radius,
          baseMultiplier: audit.propagationBaseMultiplier,
          reactionApplication: {
            channel: {
              kind: "swirl-propagation" as const,
              element: audit.swirledElement
            },
            nominalGaugeUnits: audit.propagatedGaugeUnits
          },
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
            attack.reactionApplication?.nominalGaugeUnits ?? null,
          excludedTargetIds: deepClone(attack.excludedTargetIds),
          checkedTargetIds: [],
          hitTargetIds: [],
          unresolvedTargetIds: [],
          damageGroupBlockedTargetIds: [],
          damageEventIds: [],
          hitResolutionLogIds: [],
          elementalApplicationIcdLogIds: [],
          playerHitResolutionLogIds: [],
          playerDamageEventIds: [],
          reactionStatusLogIds: [],
          damageGroupDecisions: []
        });
        if (!withinSimulation && (!retainedOrdinaryReactionQueue || !audit.scheduled)) continue;
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
          reactionBonus: sampledReactionBonus,
          sourceBuffStatuses: deepClone(sourceBuffStatuses),
          snapshot,
          cycle,
          reactionDamageLogId,
          ...(attack.reactionApplication === undefined
            ? {}
            : {
                reactionApplication: deepClone(attack.reactionApplication)
              }),
          excludedTargetIds: deepClone(attack.excludedTargetIds),
          swirlContext: {
            scheduleKind: attack.scheduleKind,
            reaction: audit.reaction,
            reactionBonusDelta:
              sampledReactionBonus - stats.reactionBonus
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
      if (burningReaction.operation === "stop") {
        const activeSource = activeBurningSources.get(targetId);
        burningStateLog.push({
          id: burningStateLog.length,
          reaction: "burning",
          generation:
            activeSource?.generation ?? burningReaction.generation,
          operation: "stop",
          frame,
          ...targetBurningLifecycleFields(
            targetId,
            frame,
            burningReaction.fuelExpiresAtFrame,
            null
          ),
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
          clockModel: burningClockModel,
          hitlagStatus: enemyHitlagStatus,
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
        reactionBonus: reactionBonus + artifactReactionBonus(actorId, "burning", frame),
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
        ...targetBurningLifecycleFields(
          targetId,
          frame,
          burningReaction.fuelExpiresAtFrame,
          burningReaction.nextTickFrame
        ),
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
        clockModel: burningClockModel,
        hitlagStatus: enemyHitlagStatus,
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
        scheduleBurningTickEvent(
          targetId,
          burningReaction.generation,
          1,
          burningReaction.firstTickFrame
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
      ...targetBurningLifecycleFields(
        targetId,
        frame,
        null,
        null
      ),
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
      clockModel: burningClockModel,
      hitlagStatus: enemyHitlagStatus,
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
    recordOrderedQuickenState({
      audit,
      targetId,
      targetName,
      sourceActorId: actorId,
      triggerDamageEventId: damageEventId,
      frame,
      timeSeconds
    });
    scheduleQuickenBloomFollowup({
      audit,
      actorId,
      action,
      triggerHitId: hitId,
      triggerHitGroupId: hitGroupId,
      triggerDamageEventId: damageEventId,
      sourceTargetId: targetId,
      reactionBonusDelta: reactionBonus - stats.reactionBonus,
      cycle,
      frame,
      triggerEventType: "reactionDamage",
      triggerEventPriority: eventPriority,
      triggerEventSequence: eventSequence
    });
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
    const transformativeReactions =
      audit.transformativeReactions ??
      (audit.transformativeReaction === null
        ? []
        : [audit.transformativeReaction]);
    for (const transformativeReaction of transformativeReactions) {
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
        liveReactionStats.reactionBonus + reactionBonusDelta + (transformativeReaction.scheduled ? artifactReactionBonus(actorId, transformativeReaction.reaction, frame) : 0);
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
        hitResolutionLogIds: [],
        elementalApplicationIcdLogIds: [],
        playerHitResolutionLogIds: [],
        playerDamageEventIds: [],
        reactionStatusLogIds: [],
        damageGroupDecisions: []
      });
      if (withinSimulation || (retainedOrdinaryReactionQueue && transformativeReaction.scheduled)) {
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
      const existingSource = activeFrozenStateSources.get(targetId);
      const consumedByFrozenSwirl =
        frozenReaction.operation === "consume" &&
        audit.swirlReactions.some(
          (entry) =>
            entry.reaction === "swirlCryo" &&
            entry.consumedAuraElement === "frozen",
        );
      const consumedBySuperconduct =
        frozenReaction.operation === "consume" &&
        audit.reactions.includes("superconduct");
      const frozenConsumptionExtent =
        frozenReaction.frozenGaugeAfter <= 0
          ? "FROZEN_CONSUMED"
          : "FROZEN_PARTIALLY_CONSUMED";
      const reason =
        frozenReaction.operation === "immune"
          ? "FREEZE_RESISTANCE_IMMUNE"
          : frozenReaction.operation === "consume"
            ? consumedByFrozenSwirl
              ? `${frozenConsumptionExtent}_BY_SWIRL`
              : `${frozenConsumptionExtent}_BY_${
                  audit.reaction === "melt"
                    ? "MELT"
                    : "SUPERCONDUCT"
                }`
            : null;
      const frozenStateEntry: SimulationResult["frozenStateLog"][number] = {
        id: frozenStateLog.length,
        reaction:
          audit.reaction === "melt"
            ? "melt"
            : consumedBySuperconduct
              ? "superconduct"
              : consumedByFrozenSwirl
                ? "swirlCryo"
                : "freeze",
        generation: frozenReaction.generation,
        operation: frozenReaction.operation,
        frame,
        ...targetLifecycleFields(
          targetId,
          frame,
          frozenReaction.expiresAtFrame
        ),
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
      };
      frozenStateLog.push(frozenStateEntry);
      appendFreezeBrokenAttackAudit({
        frozenStateEntry,
        depletionDamageEventId: damageEventId,
        sourceFreezeDamageEventId:
          existingSource?.triggerDamageEventId ?? null,
        triggerEventType: "reactionDamage",
        triggerEventPriority: eventPriority,
        triggerEventSequence: eventSequence,
        nextIntraEventSequence,
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
        reason: "COEXISTING_AURA_REMOVED_BY_HIT",
        ...electroChargedV9Fields(
          periodicReaction.cadenceStatus,
          periodicReaction.waneListenerActive
        )
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
        periodicReactionBonusDelta + artifactReactionBonus(actorId, "electroCharged", frame),
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
      reason: null,
      ...electroChargedV9Fields(
        periodicReaction.cadenceStatus,
        periodicReaction.waneListenerActive
      )
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
    scheduleElectroChargedGlobalCadence(
      targetId,
      periodicReaction.generation,
      periodicReaction.operation,
      periodicReaction.nextTickFrame,
    );
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
    if (config.playerMaxHpModel !== undefined) {
      if ((buff.stat === "hpPct" || buff.stat === "hpFlat") && buff.duration > 0) {
        const expiryFrame = toFrame(timeSeconds + buff.duration);
        if (!scheduledMaxHpExpiryFrames.has(expiryFrame)) {
          scheduledMaxHpExpiryFrames.add(expiryFrame);
          push(expiryFrame / 60, "playerMaxHpExpiry", {});
        }
      }
      syncPlayerMaxHp({ ...executingEvent!, timeSeconds }, "buff-apply");
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

  function settleRecursiveShatterDamage({
    actorId,
    action,
    triggerHitId,
    triggerHitGroupId,
    parentDamageEventId,
    sourceTargetId,
    baseMultiplier,
    stats,
    elementalMastery,
    reactionBonus,
    sourceBuffStatuses,
    snapshot,
    cycle,
    reactionDamageLogId,
    frame,
    eventPriority,
    eventSequence,
    nextIntraEventSequence
  }: {
    actorId: string;
    action: ActionDefinition;
    triggerHitId: string;
    triggerHitGroupId: string;
    parentDamageEventId: number;
    sourceTargetId: string;
    baseMultiplier: number;
    stats: CharacterStats;
    elementalMastery: number;
    reactionBonus: number;
    sourceBuffStatuses: ActiveStatusSnapshot[];
    snapshot: DamageEvent["snapshot"];
    cycle: number;
    reactionDamageLogId: number;
    frame: number;
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: () => number;
  }): number {
    const sourceActor = characters.get(actorId);
    const targetProfile =
      enemyTargetById.get(sourceTargetId);
    const reactionLog =
      reactionDamageLog[reactionDamageLogId];
    if (
      sourceActor === undefined ||
      targetProfile === undefined ||
      reactionLog === undefined
    ) {
      throw new Error(
        `Recursive Shatter settlement could not resolve actor "${actorId}", target "${sourceTargetId}", or reaction log ${reactionDamageLogId}.`
      );
    }
    if (
      parentDamageEventId !== damageEvents.length + 1 ||
      reactionLog.reaction !== "shatter" ||
      !reactionLog.scheduled ||
      !reactionLog.withinSimulation ||
      reactionLog.triggerDamageEventId !==
        parentDamageEventId ||
      reactionLog.sourceActorId !== actorId ||
      reactionLog.sourceTargetId !== sourceTargetId ||
      reactionLog.triggerFrame !== frame ||
      reactionLog.damageFrame !== frame
    ) {
      throw new Error(
        `Recursive Shatter log ${reactionDamageLogId} does not own the expected same-frame forward parent ${parentDamageEventId}.`
      );
    }

    const timeSeconds = frame / 60;
    const reactionLabel =
      TRANSFORMATIVE_REACTION_LABELS.shatter;
    const reactionHitId = `${triggerHitId}:shatter`;
    const reactionHitGroupId =
      `${triggerHitGroupId}:shatter:${parentDamageEventId}`;
    const reactionActionName =
      `${action.name} · ${reactionLabel}`;
    const targetAuraEngine =
      auraEngines?.get(sourceTargetId) ?? null;
    const targetTaskPhaseEntry = ensureTargetTaskPhase({
      targetId: sourceTargetId,
      globalFrame: frame,
      wakeKind: "incoming",
      eventType: "reactionDamage",
      eventPriority,
      eventSequence,
      intraEventSequence: targetPhaseEnabled
        ? nextIntraEventSequence()
        : 0
    });
    const targetPhaseV2Entry =
      ensureTargetPhaseV2State({
        targetId: sourceTargetId,
        globalFrame: frame,
        emit: true
      })?.entry ?? null;
    const mechanicsTruncatedBefore =
      targetAuraEngine?.isMechanicsTruncated() ?? false;
    const mechanicsStatus: DamageEvent["mechanicsStatus"] =
      mechanicsTruncatedBefore
        ? "mechanics-truncated"
        : "authoritative";
    const activeTargetPhase = targetPhaseTimeline.find(
      (phase) =>
        phase.targetId === sourceTargetId &&
        frame >= phase.startFrame &&
        frame < phase.endFrame
    );
    const damageAllowed =
      activeTargetPhase?.effects.damage !== "immune";
    const childDamageEventId = damageEvents.length;

    reactionLog.checkedTargetIds.push(sourceTargetId);
    reactionLog.hitTargetIds.push(sourceTargetId);
    if (
      targetPhaseAuditEnabled &&
      targetAuraEngine !== null
    ) {
      const aura = targetAuraEngine.getAuraStateAt(frame);
      targetStateTimelineRecorder.recordEvent({
        frame,
        timeSeconds,
        targetId: sourceTargetId,
        targetName: targetProfile.name,
        cause: "reaction-damage-application",
        eventType: "reactionDamage",
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: "none",
        reactions: [],
        primaryDamageEventId: childDamageEventId,
        links: [
          {
            kind: "damage-event",
            id: childDamageEventId
          },
          {
            kind: "reaction-damage-log",
            id: reactionDamageLogId
          }
        ],
        auraBefore: aura,
        auraAfter: aura
      });
    }

    const shatterDamageGroupAudit = consumeReactionADamageGroup({
      targetId: sourceTargetId,
      actorId,
      reaction: "shatter",
      damageSourceId: sourceTargetId,
      frame,
      taskSequence: eventSequence,
    });
    reactionLog.damageGroupDecisions.push(shatterDamageGroupAudit);
    if (!shatterDamageGroupAudit.damageAllowed) {
      reactionLog.damageGroupBlockedTargetIds.push(
        sourceTargetId
      );
    }

    const targetResolutionId = hitResolutionLog.length;
    const targetPosition = resolveTargetPosition(sourceTargetId, frame);
    const targetResolution: SimulationResult["hitResolutionLog"][number] = {
      id: targetResolutionId,
      reactionDamageLogId,
      elementalApplicationIcdLogId: null,
      frame,
      timeSeconds,
      eventPriority,
      eventSequence,
      intraEventSequence: nextIntraEventSequence(),
      cycle,
      sourceActorId: actorId,
      sourceActionId: action.id,
        actionName: reactionActionName,
        hitId: reactionHitId,
        hitGroupId: reactionHitGroupId,
        targetIndex: 0,
        targetCount: 1,
        hitLabel: `${reactionLabel}反应伤害`,
        element: "physical",
        targetId: sourceTargetId,
        targetName: targetProfile.name,
        targetingSource: "reaction-source",
        resolutionKind: "reaction-damage",
        targetPosition: deepClone(targetPosition),
        sourceActorPosition: null,
        sourceActorFacingDegrees: null,
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
        outcome: "landed",
        landed: true,
        reason: activeTargetPhase?.reason ?? null,
        targetEffectSource:
          activeTargetPhase === undefined
            ? "normal"
            : "target-phase",
        targetPhaseId: activeTargetPhase?.id ?? null,
        damageAllowed,
        mechanicsStatus,
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
    reactionLog.hitResolutionLogIds.push(targetResolutionId);
    if (
      targetTaskPhaseEntry?.wakeKind === "incoming" &&
      targetTaskPhaseEntry.eventType === "reactionDamage"
    ) {
      appendTargetTaskPhaseReference(
        targetTaskPhaseEntry,
        "hitResolutionLogIds",
        targetResolutionId
      );
    }
    appendTargetPhaseV2Reference(
      targetPhaseV2Entry,
      "hitResolutionLogIds",
      targetResolutionId
    );

    const debuffState = getDebuffState(
      timeSeconds,
      "physical",
      targetProfile.defReduction,
      sourceTargetId
    );
    const baseResistance = resolveEnemyBaseResistance(
      targetProfile,
      "physical"
    );
    const effectiveResistance =
      baseResistance - debuffState.resShred;
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
    const reactionDamageGroupMultiplier =
      shatterDamageGroupAudit.damageAllowed ? 1 : 0;
    const transformativeReactionFactors: TransformativeReactionFactors =
      {
        reaction: "shatter",
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
      calculation.finalDamage *
      reactionDamageGroupMultiplier;
    const finalDamage =
      potentialDamage * targetDamageMultiplier;
    const displayDamage = Math.round(finalDamage);
    const damageComposition: DamageEvent["damageComposition"] =
      {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: finalDamage
      };
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
      groupMultiplier: reactionDamageGroupMultiplier
    };
    const reactionAudit: ReactionAudit = {
      model: "reaction-damage",
      triggered: true,
      reaction: "shatter",
      reactions: ["shatter"],
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
        `${reactionLabel}自身伤害：不暴击、忽略防御且不附着元素；应用目标元素抗性、伤害策略与对应反应伤害组 ICD。`
    };
    const buffLabels = sourceBuffStatuses.map(
      (status) => status.label
    );
    const debuffLabels = debuffState.relevantDebuffs.map(
      (debuff) => debuff.label
    );
    damageEvents.push({
      id: childDamageEventId,
      elementalApplicationIcdLogId: null,
      kind: "transformative-reaction",
      eventPriority,
      eventSequence,
      parentDamageEventId,
      sourceActorId: actorId,
      scalingOwnerId: actorId,
      creditOwnerId: actorId,
      actionId: action.id,
      hitId: reactionHitId,
      hitGroupId: reactionHitGroupId,
      targetIndex: 0,
      targetCount: 1,
      targetResolutionId,
      targetId: sourceTargetId,
      targetName: targetProfile.name,
      targetDamagePolicy: damageAllowed
        ? "normal"
        : "immune",
      targetDamageMultiplier,
      mechanicsStatus,
      potentialDamage,
      frame,
      timeSeconds,
      activeCharacterId,
      statsBeforeDamage: deepClone(stats),
      activeStatuses,
      enemyStateBeforeHit: {
        level: targetProfile.level,
        baseResistance,
        resistanceShred: debuffState.resShred,
        effectiveResistance,
        baseDefenseReduction: targetProfile.defReduction,
        effectiveDefenseReduction
      },
      reactionAudit,
      damageFactors,
      transformativeReactionFactors,
      additiveReactionFactors: null,
      damageComposition,
      finalDamage,
      displayDamage,
      sourceActorName: sourceActor.name,
      scalingOwnerName: sourceActor.name,
      creditOwnerName: sourceActor.name,
      actionName: reactionActionName,
      hitLabel: `${reactionLabel}反应伤害`,
      element: "physical",
      reaction: "shatter",
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
      groupMultiplier: reactionDamageGroupMultiplier,
      buffs: buffLabels,
      debuffs: debuffLabels
    });
    settleTargetHealth(damageEvents[childDamageEventId]!);
    reactionLog.damageEventIds.push(childDamageEventId);
    targetResolution.damageEventId = childDamageEventId;
    targetResolution.potentialDamage = potentialDamage;
    targetResolution.finalDamage = finalDamage;
    targetResolution.displayDamage = displayDamage;
    recordTargetMechanicsTruncation({
      audit: reactionAudit,
      targetId: sourceTargetId,
      targetName: targetProfile.name,
      sourceActorId: actorId,
      sourceActionId: action.id,
      hitId: reactionHitId,
      triggerDamageEventId: childDamageEventId,
      frame,
      timeSeconds,
      eventPriority,
      eventSequence
    });
    return childDamageEventId;
  }

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
      const probability = trigger.probability;
      const roll = probability !== undefined && hitConfirmAllowed && !blockedByInternalCooldown ? particleTriggerRandom.next() : null;
      const drawIndex = roll === null ? null : particleTriggerDrawCount++;
      const blockedReason = !landed
        ? ("TARGET_MISS" as const)
        : !hitConfirmAllowed
          ? ("TARGET_HIT_CONFIRM_BLOCKED" as const)
        : blockedByInternalCooldown
          ? ("INTERNAL_COOLDOWN" as const)
          : roll !== null && probability !== undefined && roll >= probability ? ("PROBABILITY_FAILED" as const) : null;
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
        ...(probability === undefined ? {} : { probability, roll, drawIndex, rngStream: "particle-trigger-v1" as const }),
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
    applicationGaugeUnits,
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
    applicationGaugeUnits: number | null;
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
      (config.reactionEngine?.mode !== "aura-v5" &&
        config.reactionEngine?.mode !== "aura-v6" &&
        config.reactionEngine?.mode !== "aura-v7" &&
        config.reactionEngine?.mode !== "aura-v8" &&
        config.reactionEngine?.mode !== "aura-v9") ||
      (element !== "pyro" && element !== "electro") ||
      applicationGaugeUnits === null ||
      applicationGaugeUnits <= 0
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
      handleArtifactReactions([element === "electro" ? "hyperbloom" : "burgeon"], actorId, frame, { parentDamageEventId: triggerDamageEventIds[0] ?? null }, false);
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
    eventPriority,
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
    eventPriority: number;
    eventSequence: number;
    nextIntraEventSequence: (site?: DirectHitStepSite) => number;
  }): void => {
    if (hit.targetHitlag !== undefined) {
      applyConfiguredTargetHitlag({
        targetId,
        targetName:
          enemyTargetById.get(targetId)?.name ?? targetId,
        actorId,
        actionId: action.id,
        hit,
        hitId,
        hitGroupId,
        hitResolutionLogId: targetResolutionId,
        frame,
        landed,
        eventPriority,
        eventSequence,
        intraEventSequence: nextIntraEventSequence({kind:'hitlag',hitResolutionLogId:targetResolutionId})
      });
    }
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
    if (
      config.reactionEngine?.mode === "aura-v5" ||
      config.reactionEngine?.mode === "aura-v6" ||
      config.reactionEngine?.mode === "aura-v7" ||
      config.reactionEngine?.mode === "aura-v8" ||
      config.reactionEngine?.mode === "aura-v9"
    ) {
      processDendroCoreContacts({
        actorId,
        action,
        hitId,
        hitGroupId,
        element,
        applicationGaugeUnits: hit.application?.gaugeUnits ?? null,
        reactionBonusDelta: safeNumber(hit.reactionBonus),
        hitResolutionLogIds: aggregate.hitResolutionLogIds,
        triggerDamageEventIds: aggregate.triggerDamageEventIds,
        triggerReactionDamageLogId: null,
        resolvedGeometry: aggregate.resolvedGeometry,
        cycle,
        frame,
        eventType: "hit",
        eventPriority,
        eventSequence,
        nextIntraEventSequence
      });
    }
    hitCallbackAggregates.delete(hitGroupId);
  };

  const reprojectStaleTargetLocalEvent = (
    event: InternalEvent
  ): boolean => {
    const targetLocalDeadline = event.targetLocalDeadline;
    if (targetLocalDeadline === undefined) return false;
    const clock = targetClocks?.get(
      targetLocalDeadline.targetId
    );
    if (clock === undefined) {
      throw new Error(
        `Target-local event "${event.type}" has no clock for target "${targetLocalDeadline.targetId}".`
      );
    }
    const targetFrameAtWake =
      clock.projectLocalFrameAtGlobalFrame(event.frame);
    if (
      targetFrameAtWake >= targetLocalDeadline.targetFrame
    ) {
      return false;
    }
    const nextProjectedGlobalFrame =
      clock.projectGlobalFrameForLocalDeadline(
        targetLocalDeadline.targetFrame
      );
    if (nextProjectedGlobalFrame <= event.frame) {
      throw new Error(
        `Target-local event "${event.type}" failed to move beyond stale wake-up frame ${event.frame}.`
      );
    }
    const reprojectedPayload =
      event.type === "periodicReactionExpiry" ||
      event.type === "burningFuelExpiry" ||
      event.type === "frozenExpiry" ||
      event.type === "quickenExpiry"
        ? {
            ...(event.payload as {
              targetId: string;
              generation: number;
              expectedExpiryFrame: number;
            }),
            expectedExpiryFrame: nextProjectedGlobalFrame
          }
        : event.payload;
    if (targetPhaseV2Enabled) {
      scheduleTargetDecayThroughOrder(
        nextProjectedGlobalFrame,
        enemyTargetOrderById.get(
          targetLocalDeadline.targetId
        ) ?? 0
      );
    }
    requeueTargetLocalEvent(
      event,
      nextProjectedGlobalFrame,
      reprojectedPayload
    );
    return true;
  };

  const phaseCheckpoints: SimulationExecutionAudit["phaseCheckpoints"] = [];
  const requestedCheckpointFrames = [...new Set(executionOptions?.checkpointFrames ?? [])].sort((left, right) => left - right);
  let nextCheckpointIndex = 0;
  const randomParticles = particleRandomness({ ...config, ...(resultConfig.timeline === undefined ? {} : { timeline: resultConfig.timeline }) });
  const reactionCheckpointFeatures = ordinaryReactionFeatures({ ...config, ...(resultConfig.timeline === undefined ? {} : { timeline: resultConfig.timeline }) });
  const captureRandomExecution = (): RandomExecutionCapturedState => ({
    ...(retainedOrdinaryReactionQueue && reactionCheckpointFeatures.dendroCore ? { dendroCorePosition: dendroCoreRandom.captureState() } : {}),
    ...(retainedOrdinaryReactionQueue && reactionCheckpointFeatures.crystallize ? { crystallizePosition: crystallizeRandom.captureState() } : {}),
    ...(randomParticles.count ? { particleCount: random.captureState() } : {}),
    ...(randomParticles.trigger ? { particleTrigger: particleTriggerRandom.captureState() } : {}),
    ...(executionOptions?.criticalSampling === undefined ? {} : { critical: criticalRandom.captureState() }),
    ...(normalHitEnergyRuntime === undefined ? {} : { normalHitEnergy: normalHitEnergyRuntime.captureState() }),
    ...(favoniusRuntime === undefined ? {} : { favonius: favoniusRuntime.captureState() }),
    ...(sacrificialRuntime === undefined ? {} : { sacrificial: sacrificialRuntime.captureState() }),
    ...(hasRandomWeaponProc(config.weaponProcModel) ? { weaponProc: weaponProcRuntime!.captureState().random! } : {}),
    ...(config.artifactDamageModel?.actors.some(actor => actor.effectId === "echoes-4pc") ? { artifactDamage: artifactDamageRuntime!.captureState().random! } : {}),
  });
  const checkpointBlockers = new Set(phaseCheckpointBlockers({ ...config, ...(resultConfig.timeline === undefined ? {} : { timeline: resultConfig.timeline }) }, {
    randomState: captureRandomExecution(),
    sourceNormalChainStateAvailable: sourceNormalChainRuntime !== undefined,
    auraEnginePresent: auraEngines !== null,
    ordinaryAuraStateAvailable: auraEngines !== null,
    directDamageGroupStateAvailable: true,
    targetPhaseV2StateAvailable: config.targetTaskModel.mode === "target-phase-v2",
    targetClockPresent: targetClocks !== null,
    pluginsPresent: pluginDefinitions.length > 0,
    nonPeriodicReactionStateAvailable: auraEngines !== null,
    periodicReactionStateAvailable: auraEngines !== null && retainedOrdinaryReactionQueue,
    delayedEnergyStateAvailable: true,
    timedSummonStateAvailable: true,
    statConversionStateAvailable: true,
    staminaStateAvailable: staminaRuntime !== undefined,
    healthActionStateAvailable: true,
    periodicEntityStateAvailable: true,
    actionConditionStateAvailable: true,
    weaponProcStateAvailable: weaponProcRuntime !== undefined,
    thrillingTalesStateAvailable: thrillingTalesRuntime !== undefined,
    skillCooldownStateAvailable: runtimeSkillActors.size > 0,
    artifactEventStateAvailable: artifactEventRuntime !== undefined,
    artifactDamageStateAvailable: artifactDamageRuntime !== undefined,
    weaponHitStackStateAvailable: weaponHitStackRuntime !== undefined,
    artifactBuffStateAvailable: artifactBuffRuntime !== undefined,
    playerShieldStateAvailable: playerShieldRuntime !== undefined,
    nightsoulBurstStateAvailable: nightsoulBurstRuntime !== undefined,
  }));
  if (executionOptions?.lunarCharged || executionOptions?.lunarCrystallize || executionOptions?.lunarMixed || executionOptions?.lunarMixedV2 || executionOptions?.stellarConduct || executionOptions?.stellarSwirl || executionOptions?.lunarBloom) checkpointBlockers.add("特殊反应注入与其私有运行时尚未纳入完整检查点。");
  if (stellarArtifactRuntime !== undefined) checkpointBlockers.add("星辉圣遗物动态窗口尚未纳入相位检查点；完整特殊结果只能从初态重执行。");
  if (moonlightArtifactRuntime !== undefined) checkpointBlockers.add("月曜圣遗物动态窗口尚未纳入相位检查点；完整特殊结果只能从初态重执行。");
  const checkpointCapabilityBlockers = [...checkpointBlockers];
  const capturePendingCheckpointsThrough = (frame: number): void => {
    while (nextCheckpointIndex < requestedCheckpointFrames.length && requestedCheckpointFrames[nextCheckpointIndex]! <= frame) {
      const tick = requestedCheckpointFrames[nextCheckpointIndex++]!;
      const captured = capturePhaseCheckpoint({
        tick,
        randomState: captureRandomExecution(),
        ...(sourceNormalChainRuntime === undefined ? {} : { sourceNormalChainState: sourceNormalChainRuntime.captureState() }),
        ...(staminaRuntime === undefined ? {} : { staminaState: staminaRuntime.captureBefore(tick) }),
        cumulativeDamage: damageEvents.reduce((sum, damageEvent) => sum + damageEvent.finalDamage, 0),
        config,
        ...(timelineExecution === undefined || resultConfig.timeline === undefined ? {} : { timelineExecution, timelineConfig: resultConfig.timeline }),
        energies,
        reservedEnergy,
        activeTimedSummons,
        periodicEntityState: periodicEntityRuntime.captureState(),
        actionConditionLog,
        ...(weaponProcRuntime === undefined ? {} : { weaponProcState: weaponProcRuntime.captureState() }),
        ...(thrillingTalesRuntime === undefined ? {} : { thrillingTalesState: thrillingTalesRuntime.captureState() }),
        ...(runtimeSkillActors.size === 0 ? {} : { skillCooldownState: skillCooldownStates }),
        ...(artifactEventRuntime === undefined ? {} : { artifactEventState: artifactEventRuntime.captureState() }),
        ...(weaponHitStackRuntime === undefined ? {} : { weaponHitStackState: weaponHitStackRuntime.captureState() }),
        ...(artifactBuffRuntime === undefined ? {} : { artifactBuffState: artifactBuffRuntime.captureState() }),
        ...(artifactDamageRuntime === undefined ? {} : { artifactDamageState: artifactDamageRuntime.captureState() }),
        ...(playerShieldRuntime === undefined ? {} : { playerShieldState: playerShieldRuntime.captureState() }),
        ...(nightsoulBurstRuntime === undefined ? {} : { nightsoulBurstState: nightsoulBurstRuntime.captureState() }),
        ...(config.targetTaskModel.mode === "target-phase-v2" ? {
          targetPhaseV2State: captureTargetPhaseV2State({ lastProcessedFrame: executingEvent?.frame ?? null,
            scheduledDecayKeys: scheduledTargetDecayKeys, completedDecayKeys: completedTargetDecayKeys,
            states: targetPhaseV2StateByKey.values() }),
        } : {}),
        ...(auraEngines === null ? {} : {
          ordinaryAuraState: new Map([...auraEngines].map(([targetId, engine]) => [targetId, engine.captureOrdinaryState(true, retainedOrdinaryReactionQueue)])),
          auraObservationState: targetStateTimelineRecorder.captureObservationState(),
          ...(retainedOrdinaryReactionQueue ? { periodicReactionState: {
            periodicSources: activePeriodicReactionSources, burningSources: activeBurningSources,
            periodicExpiryKeys: periodicReactionExpiryScheduleKeys, burningExpiryKeys: burningFuelExpiryScheduleKeys,
            cleanupTasks: reactionTaskLog, periodicHistory: periodicReactionLog,
            dendroCore: dendroCoreManager.captureState(), dendroSources: dendroCoreRuntimeSources,
            shards: activeCrystallizeShards, shield: activeCrystallizeShield,
            nextShardId: nextCrystallizeShardId, nextShieldId: nextCrystallizeShieldId,
            inlineBurningDeliveries: burningRootInlineDeliveryByReactionDamageLogId.size,
          } satisfies PeriodicReactionHostState } : {}),
          nonPeriodicReactionState: { frozenSources: activeFrozenStateSources, quickenSources: activeQuickenStateSources, frozenExpiryScheduleKeys, quickenExpiryScheduleKeys, damageGroups: reactionDamageGroupEngine.captureState(), pendingFreezeBrokenCallbacks: pendingFreezeBrokenCallbacks.size },
        }),
        ...([...config.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(source => source.hits?.some(hit => hit.directDamageGroup !== undefined)) ? {
          directDamageGroupState: new Map([...directDamageGroupEngines].map(([targetId, engine]) => [targetId, engine.captureState()])),
        } : {}),
        liveConversions,
        sourceSnapshotLog,
        actionLog,
        fixedEnergyCooldownReadyFrames,
        particleCooldownReadyFrames,
        activeBuffs,
        activeDebuffs,
        activeTargetDebuffs,
        activeCharacterId,
        pendingEvents: queue.snapshot(),
        particleEvents,
        playerHpStateByActorId,
        unsupportedState: [...checkpointCapabilityBlockers, ...periodicCheckpointRuntimeBlockers]
      });
      if (captured.checkpoint !== null) phaseCheckpoints.push(captured.checkpoint);
      for (const reason of captured.blockers) checkpointBlockers.add(reason);
    }
  };
  const lunarMixedV2Options = options.execution?.lunarMixedV2;
  const specialCriticalSampler = executionOptions?.criticalSampling === "seeded-random-v1" &&
    (executionOptions.lunarCharged || executionOptions.lunarCrystallize || executionOptions.lunarBloom || executionOptions.lunarMixed || executionOptions.lunarMixedV2)
    ? new SpecialCriticalSampler(options.randomSeed) : undefined;
  const specialCriticalInputs = specialCriticalSampler === undefined ? {} : { criticalSampler: specialCriticalSampler };
  const lunarMixedV2Runtime = lunarMixedV2Options === undefined ? undefined : new LunarMixedV2Runtime({
    ...specialCriticalInputs,
    ...(lunarArtifactRuntime === undefined ? {} : { artifactRuntime: lunarArtifactRuntime }),
    config, options: lunarMixedV2Options, target: enemyTargets[0]!, aura: auraEngines!.get(enemyTargets[0]!.id)!, critMode: options.critMode,
    snapshot: (actorId, frame) => {
      const stats = computeStats(actorId, frame / 60);
      if (stats === undefined) throw new Error(`Missing mixed Lunar v2 contribution stats for ${actorId}`);
      return stats;
    },
    resistance: (element, frame) => resolveEnemyBaseResistance(enemyTargets[0]!, element) - getDebuffState(frame / 60, element, 0, enemyTargets[0]!.id).resShred,
    beforeWake: frame => recordNaturalAuraExpiries(frame, true),
    scheduleTask: task => { push(task.frame / 60, "lunarMixedV2Task", task, task.kind === "state-wake" ? 2.5 : task.kind === "ability-consume" ? 2.75 : 3); },
    consumption: (order, mutation) => {
      targetStateTimelineRecorder.recordEvent({ frame: order.frame, timeSeconds: order.frame / 60, targetId: enemyTargets[0]!.id, targetName: enemyTargets[0]!.name,
        cause: "lunar-charged-consumption", eventType: "hit", eventPriority: order.priority, eventSequence: order.sequence, intraEventSequence: 0,
        reaction: "none", reactions: [], primaryDamageEventId: null, links: [], ...mutation });
    }
  });
  const lunarMixedOptions = options.execution?.lunarMixed;
  const lunarMixedRuntime = lunarMixedOptions === undefined ? undefined : new LunarMixedRuntime({
    ...specialCriticalInputs,
    ...(lunarArtifactRuntime === undefined ? {} : { artifactRuntime: lunarArtifactRuntime }),
    config, options: lunarMixedOptions, target: enemyTargets[0]!, aura: auraEngines!.get(enemyTargets[0]!.id)!, critMode: options.critMode,
    snapshot: (actorId, frame) => {
      const stats = computeStats(actorId, frame / 60);
      if (stats === undefined) throw new Error(`Missing mixed Lunar contribution stats for ${actorId}`);
      return stats;
    },
    resistance: (element, frame) => resolveEnemyBaseResistance(enemyTargets[0]!, element) - getDebuffState(frame / 60, element, 0, enemyTargets[0]!.id).resShred,
    beforeWake: frame => recordNaturalAuraExpiries(frame, true),
    scheduleTask: task => { push(task.frame / 60, "lunarMixedTask", task, task.kind === "state-wake" ? 2.5 : 3); },
    consumption: (order, mutation) => {
      targetStateTimelineRecorder.recordEvent({ frame: order.frame, timeSeconds: order.frame / 60, targetId: enemyTargets[0]!.id, targetName: enemyTargets[0]!.name,
        cause: "lunar-charged-consumption", eventType: "hit", eventPriority: order.priority, eventSequence: order.sequence, intraEventSequence: 0,
        reaction: "none", reactions: [], primaryDamageEventId: null, links: [], ...mutation });
    }
  });
  const lunarOptions = options.execution?.lunarCharged;
  const lunarRuntime = lunarOptions === undefined ? undefined : new LunarChargedRuntime({
    ...specialCriticalInputs,
    ...(lunarArtifactRuntime === undefined ? {} : { artifactRuntime: lunarArtifactRuntime }),
    config, options: lunarOptions, target: enemyTargets[0]!, aura: auraEngines!.get(enemyTargets[0]!.id)!, critMode: options.critMode,
    snapshot: (actorId, frame) => {
      const stats = computeStats(actorId, frame / 60);
      if (stats === undefined) throw new Error(`Missing LC contribution stats for ${actorId}`);
      return stats;
    },
    resistance: (frame) => resolveEnemyBaseResistance(enemyTargets[0]!, "electro") - getDebuffState(frame / 60, "electro", 0, enemyTargets[0]!.id).resShred,
    beforeWake: (frame) => recordNaturalAuraExpiries(frame, true),
    consumption: (frame, mutation) => {
      targetStateTimelineRecorder.recordEvent({
        frame, timeSeconds: frame / 60, targetId: enemyTargets[0]!.id, targetName: enemyTargets[0]!.name,
        cause: "lunar-charged-consumption", eventType: "hit", eventPriority: -1, eventSequence: sequence++, intraEventSequence: 0,
        reaction: "none", reactions: [], primaryDamageEventId: null, links: [], ...mutation
      });
    }
  });
  const lunarCrystallizeOptions = options.execution?.lunarCrystallize;
  const lunarCrystallizeRuntime = lunarCrystallizeOptions === undefined ? undefined : new LunarCrystallizeRuntime({
    ...specialCriticalInputs,
    ...(lunarArtifactRuntime === undefined ? {} : { artifactRuntime: lunarArtifactRuntime }),
    config, options: lunarCrystallizeOptions, target: enemyTargets[0]!, aura: auraEngines!.get(enemyTargets[0]!.id)!, critMode: options.critMode,
    snapshot: (actorId, frame) => {
      const stats = computeStats(actorId, frame / 60);
      if (stats === undefined) throw new Error(`Missing Lunar-Crystallize contribution stats for ${actorId}`);
      return stats;
    },
    resistance: (frame) => resolveEnemyBaseResistance(enemyTargets[0]!, "geo") - getDebuffState(frame / 60, "geo", 0, enemyTargets[0]!.id).resShred,
    beforeWake: (frame) => recordNaturalAuraExpiries(frame, true)
  });
  const stellarConductOptions = options.execution?.stellarConduct;
  const stellarConductRuntime = stellarConductOptions === undefined ? undefined : new StellarConductRuntime({ config, options: stellarConductOptions, targetId: enemyTargets[0]!.id, beforeWake: (frame) => recordNaturalAuraExpiries(frame, true), ...(stellarArtifactRuntime === undefined ? {} : { artifactRuntime: stellarArtifactRuntime }) });
  let lastLunarBloomActionAnimationUntil = 0;
  const stellarActionPanels = new WeakMap<Record<string, CharacterStats | undefined>, StellarConductPanelSnapshot>();
  const lunarBloomOptions = options.execution?.lunarBloom;
  const lunarBloomRuntime = lunarBloomOptions === undefined ? undefined : new LunarBloomRuntime({
    ...specialCriticalInputs,
    ...(lunarArtifactRuntime === undefined ? {} : { artifactRuntime: lunarArtifactRuntime }),
    config, options: { ...lunarBloomOptions, ...(lunarBloomOptions.abilities === undefined ? { abilities: [] } : { abilities: lunarBloomOptions.abilities }) }, target: enemyTargets[0]!, critMode: options.critMode,
    snapshot: (actorId, frame) => {
      const stats = computeStats(actorId, frame / 60);
      if (stats === undefined) throw new Error(`Missing Lunar-Bloom contribution stats for ${actorId}`);
      return stats;
    },
    resistance: (frame) => resolveEnemyBaseResistance(enemyTargets[0]!, "dendro") - getDebuffState(frame / 60, "dendro", 0, enemyTargets[0]!.id).resShred,
    beforeWake: (frame) => recordNaturalAuraExpiries(frame, true)
  });
  const stellarSwirlOptions = options.execution?.stellarSwirl;
  let stellarSwirlExecutionOrder: StellarSwirlExecutionOrder | undefined;
  const stellarSwirlRuntime = stellarSwirlOptions === undefined ? undefined : new StellarSwirlRuntime({
    config, options: stellarSwirlOptions, target: enemyTargets[0]!, critMode: options.critMode,
    ...(stellarArtifactRuntime === undefined ? {} : { artifactRuntime: stellarArtifactRuntime }),
    snapshot: (actorId, frame) => {
      const stats = computeStats(actorId, frame / 60);
      if (stats === undefined) throw new Error(`Missing Stellar-Swirl contribution stats for ${actorId}`);
      return stats;
    },
    resistance: (element, frame) => resolveEnemyBaseResistance(enemyTargets[0]!, element) - getDebuffState(frame / 60, element, 0, enemyTargets[0]!.id).resShred,
    auraAt: (frame) => auraEngines!.get(enemyTargets[0]!.id)!.getAuraStateAt(frame),
    beforeWake: (frame) => recordNaturalAuraExpiries(frame, true),
    scheduleTask: (task) => { push(task.frame / 60, "stellarSwirlTask", task, task.kind === "state-wake" ? 2.5 : 3); },
    applyCryo: (intent) => {
      const target = enemyTargets[0]!;
      const mutation = auraEngines!.get(target.id)!.applyStellarSwirlCryoAt(intent.deliveryFrame, intent.ownerId);
      if (stellarSwirlExecutionOrder === undefined) throw new Error("Stellar-Swirl Cryo delivery requires its current main-heap task");
      targetStateTimelineRecorder.recordEvent({
        frame: intent.deliveryFrame, timeSeconds: intent.deliveryFrame / 60, targetId: target.id, targetName: target.name,
        cause: "stellar-swirl-attachment", eventType: "hit", eventPriority: stellarSwirlExecutionOrder.priority, eventSequence: stellarSwirlExecutionOrder.sequence, intraEventSequence: 0,
        reaction: "none", reactions: [], primaryDamageEventId: null, links: [], ...mutation
      });
      return { frame: intent.deliveryFrame, ownerId: intent.ownerId, targetId: target.id, applied: true, element: "cryo", gaugeUnits: 1, auraBefore: mutation.auraBefore, auraAfter: mutation.auraAfter };
    }
  });
  const snapshotAction = (action: ActionDefinition, timeSeconds: number, sampledHits: readonly HitDefinition[] = []): Record<string, CharacterStats | undefined> => {
    const snapshotIds = new Set([action.actorId]);
    for (const hit of action.hits ?? []) {
      snapshotIds.add(hit.scalingOwnerId ?? action.actorId);
      for (const source of hit.flatSources ?? []) snapshotIds.add(source.ownerId ?? action.actorId);
    }
    const snapshots: Record<string, CharacterStats | undefined> = {};
    const sampledIds = new Set(sampledHits.length ? [action.actorId] : []);
    for (const hit of sampledHits) {
      sampledIds.add(hit.scalingOwnerId ?? action.actorId);
      for (const source of hit.flatSources ?? []) if (source.snapshotFrame === undefined) sampledIds.add(source.ownerId ?? action.actorId);
    }
    const thrillingTalesStatuses: Record<string, ActiveStatusSnapshot[]> = {};
    if (stellarConductRuntime) stellarActionPanels.set(snapshots, stellarConductRuntime.panelSnapshot(toFrame(timeSeconds)));
    for (const characterId of snapshotIds) {
      snapshots[characterId] = sampledIds.has(characterId) ? sampleStats(characterId, timeSeconds) : computeStats(characterId, timeSeconds);
      if (thrillingTalesRuntime !== undefined) thrillingTalesStatuses[characterId] = currentThrillingTalesStatuses(characterId);
    }
    if (thrillingTalesRuntime !== undefined) thrillingTalesSnapshots.set(snapshots, thrillingTalesStatuses);
    return snapshots;
  };
  const scheduleSourceSnapshot = (action: ActionDefinition, cycle: number, timeSeconds: number, ownerId: string, relativeFrame: number): number => {
    const actionLogIndex = actionLog.length - 1;
    const acceptedAction = actionLog[actionLogIndex];
    if (acceptedAction?.actionId !== action.id || acceptedAction.actorId !== action.actorId || acceptedAction.cycle !== cycle) throw new Error("Source sampling must be scheduled by its accepted action.");
    if (actionLogIndex < 0) throw new Error("Source sampling requires an accepted action instance.");
    const key = JSON.stringify([actionLogIndex, ownerId, relativeFrame]);
    const existing = sourceSnapshotIds.get(key);
    if (existing !== undefined) return existing;
    const id = sourceSnapshotLog.length;
    const frame = toFrame(timeSeconds) + relativeFrame;
    const eventPriority = relativeFrame === 0 && action.actionPhase === "after-frame-tasks-v1" ? 12.5 : EVENT_PRIORITY.sourceSnapshot;
    sourceSnapshotLog.push({ id, actionLogIndex, actionId: action.id, sourceActorId: action.actorId, ownerId, cycle, relativeFrame,
      frame, timeSeconds: frame / 60, status: "pending", eventPriority, eventSequence: null, stats: null, activeBuffs: [] });
    sourceSnapshotIds.set(key, id);
    push(frame / 60, "sourceSnapshot", { action, cycle, actionLogIndex, ownerId, relativeFrame, snapshotLogId: id } satisfies SourceSnapshotPayload);
    return id;
  };
  const sampledSource = (id: number): SourceSnapshotLogEntry & { stats: CharacterStats } => {
    const row = sourceSnapshotLog[id];
    if (row?.status !== "sampled" || row.stats === null) throw new Error(`Source sample ${id} was not executed before delivery.`);
    return row as SourceSnapshotLogEntry & { stats: CharacterStats };
  };
  const scheduleActionHits = (
    action: ActionDefinition, cycle: number, timeSeconds: number,
    snapshots: Record<string, CharacterStats | undefined>, sourceActorPose: ActorPoseDefinition | undefined,
    includeHit: (hit: HitDefinition) => boolean,
    periodicTick: HitEventPayload["periodicEntityContext"] = undefined,
    weaponProcLogId?: number,
    weaponProcContext?: PendingWeaponProcContext,
  ): void => {
    (action.hits ?? []).forEach((hit, hitIndex) => {
      if (!includeHit(hit)) return;
        const sourceSnapshots: NonNullable<HitEventPayload["sourceSnapshots"]> = {};
        if (hit.snapshotFrame !== undefined) {
          sourceSnapshots.main = scheduleSourceSnapshot(action, cycle, timeSeconds, hit.scalingOwnerId ?? action.actorId, hit.snapshotFrame);
          sourceSnapshots.reaction = scheduleSourceSnapshot(action, cycle, timeSeconds, action.actorId, hit.snapshotFrame);
        }
        for (const [sourceIndex, source] of (hit.flatSources ?? []).entries()) {
          const relativeFrame = source.snapshotFrame ?? hit.snapshotFrame;
          if (relativeFrame === undefined) continue;
          (sourceSnapshots.flatSources ??= {})[sourceIndex] = scheduleSourceSnapshot(action, cycle, timeSeconds, source.ownerId ?? hit.scalingOwnerId ?? action.actorId, relativeFrame);
        }
        const hitTimeSeconds = timeSeconds + hit.offset;
        const hitFrame = toFrame(hitTimeSeconds);
        const geometry = hit.geometry;

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
            actorId: action.actorId,
            action,
            hit,
            hitIndex,
            ...targetPlan,
            targetIndex,
            targetCount: targetPlans.length,
            hitGroupId,
            snapshots,
            ...(Object.keys(sourceSnapshots).length ? { sourceSnapshots } : {}),
            ...(periodicTick === undefined ? {} : { periodicFlatSnapshots: snapshots, periodicEntityContext: periodicTick }),
            ...(weaponProcLogId === undefined ? {} : { weaponProcLogId }),
            ...(weaponProcContext === undefined ? {} : { weaponProcContext }),
            ...(hit.snapshot === "action" && thrillingTalesSnapshots.has(snapshots) ? { thrillingTalesSnapshotStatuses: thrillingTalesSnapshots.get(snapshots)! } : {}),
            cycle
          });
        });
      });
  };
  const appendArtifactDamageDecision = (event: Pick<InternalEvent, "frame" | "timeSeconds" | "priority" | "sequence">,
    intraEventSequence: number, decision: ArtifactDamageDecision,
    source: { sourceActorId: string; targetId: string | null; parentDamageEventId?: number; hitResolutionLogId?: number; playerHealthEventId?: number; parentLogId?: number }): number => {
    const id = artifactDamageLog.length;
    artifactDamageLog.push({ ...decision, id, frame: event.frame, timeSeconds: event.timeSeconds,
      eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence, activeCharacterId,
      parentDamageEventId: null, hitResolutionLogId: null, playerHealthEventId: null, parentLogId: null, ...source });
    return id;
  };
  const applyPlayerHealth = (payload: HealthChangePayload, event: { frame: number; timeSeconds: number; priority: number; sequence: number },
    derived?: { periodicEntityLogId: number; trace: unknown[] }): void => {
      let healthIntraEventSequence = 0;
      const nextIntraEventSequence = () => healthIntraEventSequence++;
      const { change, sourceActorId, actionLogIndex } = payload;
      const targets = change.target.kind === "party" ? config.characters.map(actor => actor.id)
        : [change.target.kind === "self" ? sourceActorId : change.target.kind === "actor" ? change.target.actorId : activeCharacterId!];
      for (const targetActorId of targets) {
        const hpState = playerHpStateByActorId.get(targetActorId)!;
        const calculation = calculateHealthChange(change, hpState.currentHp, hpState.maxHp,
          config.bondOfLifeModel === undefined ? undefined : { mode: config.bondOfLifeModel.mode, debtBefore: hpState.currentBondOfLife! });
        const playerHealthEventId = playerHealthEvents.length;
        playerHealthEvents.push({ id: playerHealthEventId, frame: event.frame, timeSeconds: event.timeSeconds,
          eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: nextIntraEventSequence(),
          actionLogIndex, sourceActorId, targetActorId, changeId: change.id, operation: change.operation, ...calculation,
          ...(derived === undefined ? {} : { periodicEntityLogId: derived.periodicEntityLogId, trace: [...derived.trace, ...calculation.trace] }) });
        hpState.currentHp = calculation.hpAfter;
        if (calculation.bondOfLife !== undefined) hpState.currentBondOfLife = calculation.bondOfLife.debtAfter;
        if (change.operation === "heal") {
          hpState.totalHealing += calculation.actualChange;
          hpState.totalOverheal += calculation.overheal;
        } else if (change.operation === "consume") hpState.totalHpConsumed += calculation.actualChange;
        hpState.zeroHpReached ||= calculation.hpAfter === 0;
        playerHpTimeline.points.push({ id: playerHpTimeline.points.length, frame: event.frame, timeSeconds: event.timeSeconds,
          eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: nextIntraEventSequence(),
          operation: change.operation, actorId: targetActorId, playerDamageEventId: null, playerHealthEventId,
          maxHp: hpState.maxHp, hpBefore: calculation.hpBefore, hpAfter: calculation.hpAfter,
          hpRatioAfter: calculation.hpAfter / hpState.maxHp });
        if (calculation.bondOfLife?.sourceEventEmitted) handleArtifactBuff({ kind: "bond-of-life-change", frame: event.frame,
          actorId: targetActorId, amount: calculation.bondOfLife.sourceCallbackAmount }, { playerHealthEventId }, nextIntraEventSequence);
        if (change.operation === "consume") handleArtifactBuff({ kind: "hp-drain", frame: event.frame,
          amount: calculation.requestedAmount }, { playerHealthEventId }, nextIntraEventSequence);
        if (change.operation === "heal") {
          const recorded = artifactDamageRuntime?.onHeal(event.frame, sourceActorId, calculation.requestedAmount);
          if (recorded !== undefined) {
            const parentLogId = appendArtifactDamageDecision(event, nextIntraEventSequence(), recorded.decision,
              { sourceActorId, targetId: targetActorId, playerHealthEventId });
            if (recorded.startsWindow) push((event.frame + 360) / 60, "artifactSongConvert",
              { actorId: sourceActorId, sourceFrame: event.frame, parentLogId } satisfies ArtifactSongConvertPayload);
          }
        }
      }
  };
  const snapshotWeaponDelivery = (
    event: Pick<InternalEvent, "frame" | "timeSeconds" | "priority" | "sequence">,
    payload: { actorId: string; targetId: string; cycle: number; weaponProcLogId: number; triggerFrame: number; coefficient: number },
    deliveryIndex = 0,
  ): void => {
    const { actorId, targetId, cycle, weaponProcLogId, triggerFrame, coefficient } = payload;
    const actor = weaponProcRuntime!.actor(actorId)!;
    const definition = getWeaponProcDefinition(actor.weaponId)!;
    const snapshot = deepClone(sampleStats(actorId, event.timeSeconds)!);
    const buffs: ActiveStatusSnapshot[] = activeBuffs.filter(buff => buff.targetId === actorId).map(buff => ({
      key: buff.key, kind: "buff", sourceActorId: buff.actorId, targetId: buff.targetId, stat: buff.stat,
      value: buff.value, startTimeSeconds: buff.start, endTimeSeconds: buff.end, label: buff.label,
    }));
    const origin = definition.targetMode === "circle" ? resolveTargetPosition(targetId, event.frame) : null;
    if (definition.targetMode === "circle" && origin === null) throw new Error("武器范围追击缺少实际取样目标位置。");
    const log = weaponProcLog[weaponProcLogId]!;
    if (deliveryIndex === 0) {
      if (definition.snapshotTiming === "delivery") log.snapshotEventSequence = event.sequence;
      log.triggerSnapshot = deepClone(snapshot);
      log.triggerBuffStatuses = deepClone(buffs);
      log.origin = origin === null ? null : deepClone(origin);
    }
    const deliveryOffset = definition.damageOffsetsFrames?.[deliveryIndex] ?? definition.damageDelayFrames;
    const actionId = `weapon-proc:${actorId}:${weaponProcLogId}${deliveryIndex === 0 ? "" : `:tick-${deliveryIndex}`}`;
    const delayedSnapshot = definition.snapshotTiming === "delivery";
    const procHit: HitDefinition = { id: `${actionId}:hit`, label: `${definition.weaponName}追击`,
      offset: delayedSnapshot ? 0 : deliveryOffset / 60,
      scaling: coefficient, scalingStat: definition.scalingStat, element: "physical", attackTag: "proc",
      snapshot: "action", dmgBonus: actor.physicalDamageBonus,
      ...(definition.forcedCrit ? { hitWeakPoint: true } : {}),
      ...(definition.targetMode === "circle"
        ? { geometry: { kind: "circle", coordinateSpace: "world", origin: origin!, radius: definition.radius! } }
        : { targeting: { targetId, outcome: "landed" } }),
    };
    const action: ActionDefinition = { id: actionId, actorId, name: `${definition.weaponName}追击`,
      at: event.timeSeconds, once: true, hits: [procHit] };
    scheduleActionHits(action, cycle, event.timeSeconds, { [actorId]: snapshot }, undefined, () => true, undefined, weaponProcLogId,
      { actor: deepClone(actor), triggerFrame, triggerBuffStatuses: deepClone(buffs),
        ...(definition.damageOffsetsFrames === undefined && !delayedSnapshot ? {} : {
          deliveryIndex, deliveryFrame: triggerFrame + deliveryOffset, snapshotFrame: event.frame }),
        ...(log.random === undefined ? {} : { random: deepClone(log.random), selectedCoefficient: coefficient,
          cooldownFrames: log.cooldownFrames, cooldownExpiresFrameAfter: log.cooldownExpiresFrameAfter,
          ...(log.triggerAura === undefined ? {} : { triggerAura: deepClone(log.triggerAura) }) }),
        ...(log.stateBefore === undefined ? {} : { stateBefore: deepClone(log.stateBefore), stateAfter: deepClone(log.stateAfter!),
          selectedCoefficient: coefficient, cooldownFrames: log.cooldownFrames, cooldownExpiresFrameAfter: log.cooldownExpiresFrameAfter }) });
  };
  // The archived perception implementation keeps one snapshot for the entire
  // ball and selects a new target only after an actual enemy damage callback.
  const eyeProcSnapshots = new Map<number, { stats: CharacterStats; buffs: ActiveStatusSnapshot[] }>();
  const eyeBounceUntil = new Map<string, number>();
  const eyeAdvancedActions = new Set<string>();
  const selectEyeTarget = (center: { x: number; y: number }, frame: number): string | null => {
    let nearest: { id: string; distanceSquared: number } | null = null;
    for (const target of enemyTargets) {
      if (targetHealthRuntime?.isDefeated(target.id)) continue;
      if ((eyeBounceUntil.get(target.id) ?? -1) >= frame) continue;
      const position = resolveTargetPosition(target.id, frame);
      if (position === null) continue;
      const distanceSquared = (position.x - center.x) ** 2 + (position.y - center.y) ** 2;
      if (distanceSquared > (8 + target.hitboxRadius) ** 2) continue;
      if (nearest === null || distanceSquared < nearest.distanceSquared) nearest = { id: target.id, distanceSquared };
    }
    return nearest?.id ?? null;
  };
  const scheduleEyeBounce = (event: Pick<InternalEvent, "frame" | "timeSeconds" | "priority" | "sequence">,
    payload: { actorId: string; targetId: string; cycle: number; weaponProcLogId: number; triggerFrame: number; coefficient: number },
    bounceIndex: number): void => {
    const selected = payload.targetId;
    eyeBounceUntil.set(selected, event.frame + 36);
    const actor = weaponProcRuntime!.actor(payload.actorId)!;
    const snapshot = eyeProcSnapshots.get(payload.weaponProcLogId)!;
    const impactFrame = event.frame + 10;
    const origin = resolveTargetPosition(selected, event.frame);
    if (origin === null) throw new Error("昭心弹射目标缺少实际选中帧位置。");
    const actionId = `weapon-proc:${payload.actorId}:${payload.weaponProcLogId}${bounceIndex === 0 ? "" : `:bounce-${bounceIndex}`}`;
    const hit: HitDefinition = { id: `${actionId}:hit`, label: "昭心追击", offset: 10 / 60,
      scaling: payload.coefficient, scalingStat: "atk", element: "physical", attackTag: "proc", snapshot: "action",
      dmgBonus: actor.physicalDamageBonus, geometry: { kind: "circle", coordinateSpace: "world", origin, radius: .6 } };
    const action: ActionDefinition = { id: actionId, actorId: payload.actorId, name: "昭心追击", at: event.timeSeconds, once: true, hits: [hit] };
    const log = weaponProcLog[payload.weaponProcLogId]!;
    if (bounceIndex === 0) {
      log.triggerSnapshot = deepClone(snapshot.stats);
      log.triggerBuffStatuses = deepClone(snapshot.buffs);
      log.origin = deepClone(origin);
    }
    scheduleActionHits(action, payload.cycle, event.timeSeconds, { [payload.actorId]: snapshot.stats }, undefined, () => true,
      undefined, payload.weaponProcLogId, { actor: deepClone(actor), triggerFrame: payload.triggerFrame,
        deliveryIndex: bounceIndex, deliveryFrame: impactFrame, snapshotFrame: payload.triggerFrame,
        triggerBuffStatuses: deepClone(snapshot.buffs), selectedCoefficient: payload.coefficient,
        cooldownFrames: log.cooldownFrames, cooldownExpiresFrameAfter: log.cooldownExpiresFrameAfter });
  };
  const executeWeaponProcCallback = (event: Pick<InternalEvent, "frame" | "timeSeconds" | "priority" | "sequence">, payload: WeaponProcCallbackPayload): void => {
    const { actorId, parentDamageEventId, targetId, attackTag, damage, cycle } = payload;
    const actor = weaponProcRuntime!.actor(actorId)!;
    const decision = weaponProcRuntime!.onDamage({ actorId, frame: event.frame, parentDamageEventId, targetId,
      activeCharacterId, attackTag, damage, ...(payload.hitWeakPoint === undefined ? {} : { hitWeakPoint: payload.hitWeakPoint }) }, () => {
      const aura = auraEngines!.get(targetId)!.getAuraStateAt(event.frame);
      return { cryo: aura.some(entry => entry.element === "cryo"), frozen: aura.some(entry => entry.element === "frozen") };
    });
    const definition = getWeaponProcDefinition(actor.weaponId)!;
    const id = weaponProcLog.length;
    const triggered = decision.outcome === "triggered";
    const delayedSnapshot = definition.snapshotTiming === "delivery";
    const procActionId = triggered ? `weapon-proc:${actorId}:${id}` : null;
    weaponProcLog.push({ ...decision, id, timeSeconds: event.timeSeconds, eventPriority: event.priority, eventSequence: event.sequence,
      procActionId, procHitId: procActionId === null ? null : `${procActionId}:hit`,
      damageFrame: triggered ? event.frame + definition.damageDelayFrames : null,
      ...(definition.damageOffsetsFrames === undefined && !delayedSnapshot ? {} : {
        snapshotFrame: triggered ? event.frame + (delayedSnapshot ? definition.damageDelayFrames : 0) : null }),
      ...(delayedSnapshot ? { snapshotEventSequence: null } : {}),
      triggerSnapshot: null, triggerBuffStatuses: [], origin: null, radius: definition.radius, damageEventIds: [], hitResolutionIds: [],
    });
    if (!triggered) return;
    const delivery = { actorId, targetId, cycle, weaponProcLogId: id, triggerFrame: event.frame, coefficient: decision.coefficient };
    if (actor.weaponId === "eyeofperception") {
      const activePose = activeCharacterId === null ? undefined : actorPoseById.get(activeCharacterId);
      if (activePose === undefined) throw new Error("昭心初击选敌缺少当前前台角色位置。");
      eyeProcSnapshots.set(id, { stats: deepClone(sampleStats(actorId, event.timeSeconds)!),
        buffs: activeBuffs.filter(buff => buff.targetId === actorId).map(buff => ({ key: buff.key, kind: "buff", sourceActorId: buff.actorId,
          targetId: buff.targetId, stat: buff.stat, value: buff.value, startTimeSeconds: buff.start, endTimeSeconds: buff.end, label: buff.label })) });
      const initialTarget = selectEyeTarget(activePose.position, event.frame);
      if (initialTarget !== null) scheduleEyeBounce(event, { ...delivery, targetId: initialTarget }, 0);
      else { weaponProcLog[id]!.procActionId = null; weaponProcLog[id]!.procHitId = null; weaponProcLog[id]!.damageFrame = null; }
      return;
    }
    if (delayedSnapshot) {
      push((event.frame + definition.damageDelayFrames) / 60, "weaponProcDelayedSnapshot", { ...delivery,
        parentDamageEventId, sourceActionId: payload.sourceActionId!, sourceHitId: payload.sourceHitId!,
        parentHitFrame: event.frame, parentEventPriority: event.priority });
    } else {
      // Each source QueueAttack(..., snapshotDelay=0, ...) samples here, even
      // when its delivery is several seconds later. Geometry is fixed here too.
      for (let index = 0; index < (definition.damageOffsetsFrames?.length ?? 1); index++) snapshotWeaponDelivery(event, delivery, index);
    }
  };
  const recordNormalChain = (event: Pick<InternalEvent,"frame"|"timeSeconds"|"priority"|"sequence">,
    decision: SourceNormalChainDecision | undefined, timelineCommandIndex: number,
    action?: ActionDefinition, actionLogIndex: number | null = null): void => {
    if (!decision) return;
    sourceNormalChainLog.push({ ...decision, id: sourceNormalChainLog.length, frame: event.frame, timeSeconds: event.timeSeconds,
      eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: 0,
      actionId: action?.id ?? null, sourceAbilityId: action?.sourceAbilityId ?? null, timelineCommandIndex, actionLogIndex });
  };
  const recordSkillCooldown = (
    event: Pick<InternalEvent, "frame" | "timeSeconds" | "priority" | "sequence">,
    actorId: string,
    operation: "start" | "recover" | "reset" | "stale-worker",
    stateAfter: SerialSkillCooldownState,
    task: SkillCooldownTaskPayload | null,
    sacrificialLogId: number | null = null,
    artifactEventLogId?: number,
  ): number => {
    const stateBefore = skillCooldownStates.get(actorId)!;
    const id = skillCooldownLog.length;
    skillCooldownLog.push({ id, actorId, actionId: task?.actionId ?? null, abilityId: task?.abilityId ?? null,
      timelineCommandIndex: task?.timelineCommandIndex ?? null, frame: event.frame, timeSeconds: event.timeSeconds,
      eventPriority: event.priority, eventSequence: event.sequence, operation,
      workerGeneration: task?.workerGeneration ?? null, sacrificialLogId,
      ...(artifactEventLogId === undefined ? {} : { artifactEventLogId }),
      stateBefore: deepClone(stateBefore), stateAfter: deepClone(stateAfter) });
    skillCooldownStates.set(actorId, stateAfter);
    const worker = serialSkillCooldownWorker(stateAfter);
    if (worker !== null && stateBefore.workerGeneration !== stateAfter.workerGeneration) {
      const head = stateAfter.queue[0]!;
      const sourceAction = config.rotation.find(action => action.id === head.castId)!;
      push(worker.frame / 60, "skillCooldownRecover", { actorId, actionId: head.castId, abilityId: head.abilityId,
        timelineCommandIndex: sourceAction.timelineCommandIndex!, recoveryFrames: head.recoveryFrames, workerGeneration: worker.generation });
    }
    return id;
  };
  type ArtifactSource = Pick<NonNullable<SimulationResult["artifactEventLog"]>[number],
    "kind" | "sourceActionId" | "actionLogIndex" | "particleEventId" | "targetHealthLogId" | "nightsoulBurstLogId" | "parentArtifactEventLogId" | "receiverId" | "tickIndex">;
  const artifactSource = (kind: ArtifactSource["kind"], sourceActionId: string | null, extra: Partial<ArtifactSource> = {}): ArtifactSource => ({
    kind, sourceActionId, actionLogIndex: null, particleEventId: null, targetHealthLogId: null, nightsoulBurstLogId: null,
    parentArtifactEventLogId: null, receiverId: null, tickIndex: null, ...extra,
  });
  const appendArtifactDecision = (event: Pick<InternalEvent, "frame" | "timeSeconds" | "priority" | "sequence">,
    decision: ArtifactEventDecision, source: ArtifactSource): number => {
    const id = artifactEventLog.length;
    const { gains, ...audit } = decision;
    const row: NonNullable<SimulationResult["artifactEventLog"]>[number] = { ...audit, ...source, id,
      frame: event.frame, timeSeconds: event.timeSeconds, eventPriority: event.priority, eventSequence: event.sequence,
      activeCharacterId, energyLogIds: [], skillCooldownLogId: null };
    artifactEventLog.push(row);
    for (const gain of gains) {
      const character = characters.get(gain.receiverId)!;
      const before = energies.get(gain.receiverId) ?? 0;
      const after = round(clamp(before + gain.amount, 0, character.energyMax), 12);
      const gainedEnergy = round(after - before, 12);
      const wastedEnergy = round(gain.amount - gainedEnergy, 12);
      energies.set(gain.receiverId, after);
      const summary = energyStats.get(gain.receiverId)!;
      summary.gained = round(summary.gained + gainedEnergy, 12);
      summary.fixedGained = round(summary.fixedGained + gainedEnergy, 12);
      summary.wasted = round(summary.wasted + wastedEnergy, 12);
      const energyLogId = energyLog.length;
      const energySource = `artifact:${decision.effectId}`;
      energyLog.push({ id: energyLogId, artifactEventLogId: id, kind: "fixed", frame: event.frame, timeSeconds: event.timeSeconds,
        sourceActorId: decision.actorId, sourceActionId: source.sourceActionId!, source: energySource,
        receiverId: gain.receiverId, activeCharacterId, isOnField: activeCharacterId === gain.receiverId,
        energyBefore: before, rawEnergy: gain.amount, finalEnergy: gain.amount, gainedEnergy, wastedEnergy, energyAfter: after,
        spawnFrame: null, receiveFrame: event.frame, particleElement: null, particleKind: null, particleCount: null,
        isSameElement: null, energyRecharge: 1, fieldMultiplier: 1, baseEnergyPerParticle: null,
        applied: true, blockedReason: null, internalCooldownKey: null, internalCooldownDurationFrames: null, internalCooldownReadyFrame: null });
      row.energyLogIds.push(energyLogId);
      recordEnergyCurve(event.frame, event.timeSeconds, "fixed", gain.receiverId, energySource);
    }
    if (decision.outcome === "skill-reset") {
      row.skillCooldownLogId = recordSkillCooldown(event, decision.actorId, "reset",
        resetSerialSkillCooldown(skillCooldownStates.get(decision.actorId)!, event.frame), null, null, id);
    }
    return id;
  };
  const recordArtifactKill = (damage: DamageEvent, healthLogId: number): void => {
    const event = { frame: damage.frame, timeSeconds: damage.timeSeconds, priority: damage.eventPriority, sequence: damage.eventSequence };
    for (const decision of artifactEventRuntime?.onTargetDied(damage.frame, activeCharacterId, damage.sourceActorId) ?? []) {
      appendArtifactDecision(event, decision, artifactSource("target-died", damage.actionId, { targetHealthLogId: healthLogId }));
    }
  };
  while (queue.size > 0) {
    const lunarHorizon = Math.min(queue.peek()!.frame, Math.round(config.duration * 60));
    const beforePendingSwap = lunarHorizon - Number(pendingLunarSwapFrames.has(lunarHorizon));
    if (beforePendingSwap >= 0) {
      lunarRuntime?.advanceThrough(beforePendingSwap);
      lunarBloomRuntime?.advanceThrough(beforePendingSwap);
      lunarCrystallizeRuntime?.advanceThrough(beforePendingSwap);
    }
    stellarConductRuntime?.advanceThrough(lunarHorizon);
    capturePendingCheckpointsThrough(Math.min(queue.peek()!.frame, Math.round(config.duration * 60)));
    const event = queue.pop();
    if (!event) break;
    executingEvent = event;
    const timeSeconds = event.timeSeconds;
    if (timeSeconds > config.duration + 1e-9) break;
    let intraEventSequence = 0;
    let observedPropagation: PropagationStepEvent | undefined;
    const observedSteps: DirectHitStepEvent | undefined = (runtimeOptions[directHitStepWitnessSink] !== undefined || runtimeOptions[eventStepProtocol]) && event.type === "hit"
      ? {frame:event.frame,eventPriority:event.priority,eventSequence:event.sequence,allocationCount:0,steps:[]} : undefined;
    if (observedSteps) directHitStepEvents.push(observedSteps);
    const nextIntraEventSequence = (site?: DirectHitStepSite): number => {
      const allocated = intraEventSequence++;
      if(observedPropagation) { observedPropagation.operations.push({operation:'allocate',sequence:allocated,site:site ?? {kind:'unclassified'}}); observedPropagation.allocationCount=intraEventSequence; }
      if (observedSteps) { if(site?.kind==='hit-resolution') observedSteps.hitResolutionLogId=site.id; observedSteps.steps.push({sequence:allocated,site:site ?? {kind:'unclassified'}}); observedSteps.allocationCount=intraEventSequence; }
      return allocated;
    };
    nextExecutionIntraSequence = nextIntraEventSequence;
    if (event.type === "artifactBuffApply") {
      handleArtifactBuff({ kind: "delayed-buff", frame: event.frame, task: event.payload.task }, { parentArtifactBuffLogId: event.payload.parentArtifactBuffLogId });
      continue;
    }
    if (event.type === "playerShieldExpiry") {
      playerShieldExpiryFrames.delete(event.frame);
      const decision = playerShieldRuntime!.expire(event.frame);
      if (decision.callbacks.length) recordPlayerShieldDecision(event, nextIntraEventSequence(), decision);
      continue;
    }
    if (event.type === "playerShieldInput") {
      const { input } = event.payload;
      if (input.kind === "incoming-hit") {
        const targetActorId = input.target.kind === "actor" ? input.target.actorId : activeCharacterId!;
        const hpState = playerHpStateByActorId.get(targetActorId)!;
        const decision = playerShieldRuntime!.absorb({ frame: event.frame, operation: "incoming-hit", inputEvent: input,
          targetActorId, activeCharacterId: activeCharacterId!, incomingDamage: input.incomingDamage,
          incomingElement: input.element, crystallizeDamageAfter: input.incomingDamage });
        const id = recordPlayerShieldDecision(event, nextIntraEventSequence(), decision);
        const hp = calculatePlayerShieldHpDamage({ currentHp: hpState.currentHp, maxHp: hpState.maxHp, incomingDamage: decision.damageAfterShield! }).resolution;
        playerShieldLog[id]!.hpResolution = hp;
        hpState.currentHp = hp.currentHpAfter;
        hpState.totalIncomingDamage += input.incomingDamage;
        hpState.totalAbsorbedDamage += decision.absorbedDamage!;
        hpState.totalHpDamage += hp.actualLoss;
        hpState.hitCount += 1;
        hpState.zeroHpReached ||= hp.currentHpAfter === 0;
        playerHpTimeline.points.push({ id: playerHpTimeline.points.length, frame: event.frame, timeSeconds,
          eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: nextIntraEventSequence(),
          operation: "shield-hit", actorId: targetActorId, playerShieldLogId: id, playerDamageEventId: null,
          maxHp: hp.maxHp, hpBefore: hp.currentHpBefore, hpAfter: hp.currentHpAfter, hpRatioAfter: hp.hpRatioAfter });
      } else {
        const decision = playerShieldRuntime!.apply(input, event.frame, input.kind === "grant" ? computeStats(input.ownerId, timeSeconds) : undefined);
        recordPlayerShieldDecision(event, nextIntraEventSequence(), decision);
        if (input.kind === "grant") {
          const expiryFrame = event.frame + input.durationFrames;
          if (!playerShieldExpiryFrames.has(expiryFrame)) {
            playerShieldExpiryFrames.add(expiryFrame);
            push(expiryFrame / 60, "playerShieldExpiry", {});
          }
        }
      }
      continue;
    }
    if (event.type === "sourceSnapshot") {
      const { ownerId, snapshotLogId } = event.payload;
      const stats = sampleStats(ownerId, timeSeconds);
      if (stats === undefined) throw new Error(`Source sample owner "${ownerId}" is missing.`);
      const row = sourceSnapshotLog[snapshotLogId]!;
      row.status = "sampled";
      row.eventPriority = event.priority;
      row.eventSequence = event.sequence;
      row.stats = deepClone(stats);
      row.activeBuffs = activeBuffs.filter(buff => buff.targetId === ownerId).map(buff => ({
        key: buff.key, kind: "buff", sourceActorId: buff.actorId, targetId: buff.targetId, stat: buff.stat,
        value: buff.value, startTimeSeconds: buff.start, endTimeSeconds: buff.end, label: buff.label
      }));
      continue;
    }
    if (event.type === "playerMaxHpExpiry") {
      cleanup(timeSeconds);
      syncPlayerMaxHp(event, "buff-expire");
      continue;
    }
    if (event.type === "artifactSongConvert") {
      const { actorId, parentLogId } = event.payload;
      appendArtifactDamageDecision(event, nextIntraEventSequence(), artifactDamageRuntime!.convert(event.frame, actorId),
        { sourceActorId: actorId, targetId: null, parentLogId });
      continue;
    }
    if (event.type === "artifactEnergyTick") {
      const task = event.payload;
      appendArtifactDecision(event, { actorId: task.actorId, effectId: task.effectId,
        sourceProfileId: ARTIFACT_EVENT_PROFILE.id, sourceRef: ARTIFACT_EVENT_PROFILE.sourceRefs[task.effectId],
        outcome: "energy-granted", cooldownExpiresFrameBefore: null, cooldownExpiresFrameAfter: null, exileRecipients: [],
        gains: [{ receiverId: task.receiverId, amount: task.amount }] },
        artifactSource("exile-tick", task.sourceActionId, { parentArtifactEventLogId: task.parentArtifactEventLogId,
          receiverId: task.receiverId, tickIndex: task.tickIndex }));
      continue;
    }
    if (event.type === "nightsoulBurstCallback") {
      const payload = event.payload;
      const id = nightsoulBurstLog.length;
      const decision = nightsoulBurstRuntime!.onElementalDamage(event.frame);
      nightsoulBurstLog.push({ ...decision, natlanActorIds: [...decision.natlanActorIds], id, frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence,
        parentDamageEventId: payload.parentDamageEventId, sourceActorId: payload.sourceActorId, targetId: payload.targetId, activeCharacterId });
      if (decision.outcome === "triggered") for (const artifactDecision of artifactEventRuntime?.onNightsoulBurst() ?? []) {
        appendArtifactDecision(event, artifactDecision, artifactSource("nightsoul-burst", payload.sourceActionId, { nightsoulBurstLogId: id }));
      }
      continue;
    }
    if (event.type === "weaponHitStackCallback") { appendWeaponHitStackDecisions(weaponHitStackRuntime!.handle({ ...event.payload.input, activeCharacterId })); continue; }
    if (event.type === "weaponProcCallback") { executeWeaponProcCallback(event, event.payload); continue; }
    if (event.type === "weaponProcDelayedSnapshot") { snapshotWeaponDelivery(event, event.payload); continue; }
    if (event.type === "skillCooldownStart" || event.type === "skillCooldownRecover") {
      const task = event.payload;
      const state = skillCooldownStates.get(task.actorId)!;
      const next = event.type === "skillCooldownStart"
        ? startSerialSkillCooldown(state, event.frame, { castId: task.actionId, abilityId: task.abilityId, recoveryFrames: task.recoveryFrames })
        : recoverSerialSkillCooldown(state, event.frame, task.workerGeneration!);
      recordSkillCooldown(event, task.actorId, event.type === "skillCooldownStart" ? "start" : next === state ? "stale-worker" : "recover", next, task);
      continue;
    }
    staminaRuntime?.advanceThrough(event.frame);
    if (event.type === "healthChange") { applyPlayerHealth(event.payload, event); continue; }

    if (event.type === "normalHitEnergy") {
      const decision = normalHitEnergyRuntime!.onDamage(event.payload);
      const actor = characters.get(decision.actorId)!;
      const energyBefore = quantizeEnergy(energies.get(actor.id) ?? 0);
      const energyAfter = quantizeEnergy(Math.min(actor.energyMax, energyBefore + decision.energyRequested));
      const gainedEnergy = quantizeEnergy(energyAfter - energyBefore);
      const wastedEnergy = quantizeEnergy(decision.energyRequested - gainedEnergy);
      energies.set(actor.id, energyAfter);
      const summary = energyStats.get(actor.id)!;
      summary.gained = quantizeEnergy(summary.gained + gainedEnergy);
      summary.fixedGained = quantizeEnergy(summary.fixedGained + gainedEnergy);
      summary.wasted = quantizeEnergy(summary.wasted + wastedEnergy);
      normalHitEnergyLog.push({ ...decision, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, energyBefore, energyAfter, gainedEnergy, wastedEnergy });
      if (decision.energyRequested > 0) recordEnergyCurve(event.frame, timeSeconds, "fixed", actor.id, `normal-hit-energy:${decision.damageEventId}`);
      continue;
    }
    if (event.type === "energyCost") {
      const { actorId, actionId, actionLogIndex, energyCost } = event.payload;
      const energyBefore = quantizeEnergy(energies.get(actorId) ?? 0);
      const energyAfter = quantizeEnergy(Math.max(0, energyBefore - energyCost));
      const reservedBefore = quantizeEnergy(reservedEnergy.get(actorId) ?? 0);
      const reservedAfter = quantizeEnergy(Math.max(0, reservedBefore - energyCost));
      energies.set(actorId, energyAfter);
      reservedEnergy.set(actorId, reservedAfter);
      const summary = energyStats.get(actorId)!;
      summary.spent = quantizeEnergy(summary.spent + energyBefore - energyAfter);
      energyCostLog.push({ operation: "debit", actionLogIndex, frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, energyCost, energyBefore, energyAfter, reservedBefore, reservedAfter });
      recordEnergyCurve(event.frame, timeSeconds, "spend", actorId, `${actionId}:energy-cost`);
      continue;
    }
    if (event.type === "periodicEntitySpawn") {
      const { action, actionLogIndex, cycle, definition } = event.payload;
      const { entity, replaced } = periodicEntityRuntime.spawn(action, actionLogIndex, cycle, definition, event.frame);
      periodicEntityLog.push({ id: periodicEntityLog.length, operation: replaced === undefined ? "spawn" : "replace",
        instanceId: entity.instanceId, definitionId: definition.id, actorId: action.actorId, actionLogIndex,
        frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence,
        generation: entity.generation, spawnFrame: entity.spawnFrame, expiresAtFrame: entity.expiresAtFrame,
        ...(replaced === undefined ? {} : { replacedInstanceId: replaced.instanceId }) });
      push((event.frame + definition.firstTickDelayFrames) / 60, "periodicEntityTick", { entity, tickIndex: 0 });
      continue;
    }
    if (event.type === "periodicEntityTick") {
      cleanup(timeSeconds);
      const { entity, tickIndex } = event.payload;
      const { definition, action, actionLogIndex, cycle } = entity;
      const baseLog = { instanceId: entity.instanceId, definitionId: definition.id, actorId: action.actorId, actionLogIndex,
        frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence,
        generation: entity.generation, spawnFrame: entity.spawnFrame, expiresAtFrame: entity.expiresAtFrame, tickIndex };
      if (!periodicEntityRuntime.isLive(entity)) {
        periodicEntityLog.push({ id: periodicEntityLog.length, ...baseLog, operation: "cancelled-tick" });
        continue;
      }
      const owner = playerHpStateByActorId.get(action.actorId)!;
      const ownerStats = computeStats(action.actorId, timeSeconds)!;
      const healing = calculatePeriodicHealing(definition, { maxHp: owner.maxHp, currentHp: owner.currentHp, em: ownerStats.em });
      const periodicEntityLogId = periodicEntityLog.length;
      periodicEntityLog.push({ id: periodicEntityLogId, ...baseLog, operation: "tick", healing, healthEventId: playerHealthEvents.length });
      const change: HealthChangeDefinition = { id: `${definition.id}:heal:${tickIndex}`, label: `${definition.label}治疗`, frameOffset: event.frame - actionLog[actionLogIndex]!.frame,
        target: { kind: "active" }, source: { kind: "source", refs: definition.sourceRefs }, operation: "heal", amount: { basis: "fixed", value: healing.baseHealing },
        healingBonus: healing.healingBonus, incomingHealingBonus: healing.incomingHealingBonus };
      const snapshots = snapshotAction(action, timeSeconds);
      applyPlayerHealth({ change, sourceActorId: action.actorId, actionLogIndex }, event, { periodicEntityLogId, trace: healing.trace });
      const hitIds = new Set(definition.hitIds);
      scheduleActionHits(action, cycle, (event.frame + definition.hitDelayFrames) / 60, snapshots, actorPoseById.get(activeCharacterId ?? action.actorId),
        hit => hit.id !== undefined && hitIds.has(hit.id), { entity, tickIndex, tickFrame: event.frame });
      if (periodicEntityRuntime.finishTick(entity, event.frame)) {
        periodicEntityLog.push({ id: periodicEntityLog.length, ...baseLog, operation: "expire" });
      } else push((event.frame + definition.intervalFrames) / 60, "periodicEntityTick", { entity, tickIndex: tickIndex + 1 });
      continue;
    }
    if (event.type === "summonSpawn") {
      cleanup(timeSeconds);
      const { action, cycle, summon, actionTimeSeconds } = event.payload;
      const instanceId = `${action.id}:${cycle}:${summon.id}:${toFrame(actionTimeSeconds)}`;
      const snapshots = snapshotAction(action, timeSeconds, (action.hits ?? []).filter(hit => hit.snapshotFrame === undefined && hit.snapshot === "action" && summon.hitIds.includes(hit.id ?? "")));
      const actorPose = actorPoseById.get(action.actorId);
      const entity: ActiveTimedSummon = { ...event.payload, instanceId, spawnFrame: event.frame, expiresAtFrame: event.frame + summon.lifetimeFrames, attackFrame: event.frame + summon.lifetimeFrames + summon.expiryAttackDelayFrames, snapshots, actorPose: actorPose === undefined ? undefined : deepClone(actorPose),
        ...(thrillingTalesSnapshots.has(snapshots) ? { thrillingTalesSnapshotStatuses: thrillingTalesSnapshots.get(snapshots)! } : {}) };
      activeTimedSummons.set(instanceId, entity);
      summonLog.push({ id: summonLog.length, instanceId, summonId: summon.id, actorId: action.actorId, actionId: action.id, cycle, operation: "spawn", frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, spawnFrame: entity.spawnFrame, expiresAtFrame: entity.expiresAtFrame, attackFrame: entity.attackFrame, snapshotFrame: entity.spawnFrame, hitIds: [...summon.hitIds], snapshot: deepClone(snapshots[action.actorId]!) });
      push(entity.expiresAtFrame / 60, "summonExpiry", { instanceId });
      continue;
    }
    if (event.type === "summonExpiry") {
      const entity = activeTimedSummons.get(event.payload.instanceId)!;
      const { action, cycle, summon } = entity;
      activeTimedSummons.delete(entity.instanceId);
      summonLog.push({ id: summonLog.length, instanceId: entity.instanceId, summonId: summon.id, actorId: action.actorId, actionId: action.id, cycle, operation: "expire", frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, spawnFrame: entity.spawnFrame, expiresAtFrame: entity.expiresAtFrame, attackFrame: entity.attackFrame, snapshotFrame: entity.spawnFrame, hitIds: [...summon.hitIds], snapshot: deepClone(entity.snapshots[action.actorId]!) });
      const hitIds = new Set(summon.hitIds);
      scheduleActionHits(action, cycle, entity.actionTimeSeconds, entity.snapshots, entity.actorPose, hit => hit.id !== undefined && hitIds.has(hit.id));
      continue;
    }
    if (event.type === "lunarMixedV2Task") {
      cleanup(timeSeconds);
      lunarMixedV2Runtime!.runScheduledTask(event.payload, { frame: event.frame, priority: event.priority, sequence: event.sequence });
      continue;
    }
    if (event.type === "lunarMixedTask") {
      cleanup(timeSeconds);
      lunarMixedRuntime!.runScheduledTask(event.payload, { frame: event.frame, priority: event.priority, sequence: event.sequence });
      continue;
    }
    if (event.type === "stellarSwirlTask") {
      cleanup(timeSeconds);
      stellarSwirlExecutionOrder = { frame: event.frame, priority: event.priority, sequence: event.sequence };
      stellarSwirlRuntime!.runScheduledTask(event.payload, stellarSwirlExecutionOrder);
      stellarSwirlExecutionOrder = undefined;
      continue;
    }
    if (event.type === "freezeBrokenCallback") {
      const { freezeBrokenAttackLogId } =
        event.payload as FreezeBrokenCallbackEventPayload;
      const pending = pendingFreezeBrokenCallbacks.get(
        freezeBrokenAttackLogId,
      );
      if (
        pending === undefined ||
        pending.taskSequence !== event.sequence ||
        pending.source.frozenStateEntry.frame !== event.frame ||
        pending.source.frozenStateEntry.timeSeconds !== event.timeSeconds ||
        pending.source.triggerEventPriority !== event.priority
      ) {
        throw new Error(
          `Freeze Broken callback task ${freezeBrokenAttackLogId} is missing or mismatched.`,
        );
      }
      const scheduledAfterCallbackDeliveryLogId =
        pending.syncCallbackDeliveryLogIds[2];
      const referenceRelativeToTriggerEnemyDamage =
        pending.source.depletionDamageEventId === null
          ? "not-applicable"
          : "before";
      const enemyDamageDeliveryLogId =
        appendFreezeBrokenCallbackDelivery({
          eventKind: "on-enemy-damage-freeze-broken-zero",
          eventIndex: 3,
          payload: {
            kind: "freeze-broken-zero-damage",
            ability: "Freeze Broken",
            actualDamage: 0,
            crit: null,
            rngDisposition: "not-consumed",
          },
          source: pending.source,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: 0,
          parentCallbackDeliveryLogId:
            scheduledAfterCallbackDeliveryLogId,
          phase: {
            kind: "zero-delay-core-task",
            scheduledAfterCallbackDeliveryLogId,
            taskSequence: event.sequence,
            delayFrames: 0,
            referenceRelativeToTriggerEnemyDamage,
            localExecutionRelativeToTriggerEvent: "after-current-event",
          },
        });
      const attackCallbackDeliveryLogId =
        appendFreezeBrokenCallbackDelivery({
          eventKind: "attack-callback-freeze-broken",
          eventIndex: 4,
          payload: {
            kind: "freeze-broken-attack-callback",
            ability: "Freeze Broken",
            suppliedCallbackCount: 0,
          },
          source: pending.source,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: 1,
          parentCallbackDeliveryLogId: enemyDamageDeliveryLogId,
          phase: {
            kind: "zero-delay-core-task",
            scheduledAfterCallbackDeliveryLogId,
            taskSequence: event.sequence,
            delayFrames: 0,
            referenceRelativeToTriggerEnemyDamage,
            localExecutionRelativeToTriggerEvent: "after-current-event",
          },
        });
      const auditEntry = buildFreezeBrokenAttackLogEntry({
        id: freezeBrokenAttackLogId,
        mode: config.freezeBrokenAttackModel.mode,
        frozenStateEntry: pending.source.frozenStateEntry,
        resolvedActorId: config.characters[0]!.id,
        depletionDamageEventId:
          pending.source.depletionDamageEventId,
        sourceFreezeDamageEventId:
          pending.source.sourceFreezeDamageEventId,
        triggerEventType: pending.source.triggerEventType,
        triggerEventPriority: pending.source.triggerEventPriority,
        triggerEventSequence: pending.source.triggerEventSequence,
        intraEventSequence:
          pending.source.triggerIntraEventSequence,
        callbackDeliveryLogIds: {
          sync: pending.syncCallbackDeliveryLogIds,
          endOfFrame: [
            enemyDamageDeliveryLogId,
            attackCallbackDeliveryLogId,
          ],
        },
      });
      if (
        auditEntry === null ||
        auditEntry.executionStatus !==
          "callback-bus-dispatched-normalized"
      ) {
        throw new Error(
          `Freeze Broken callback task ${freezeBrokenAttackLogId} failed to build its V3 audit row.`,
        );
      }
      freezeBrokenCallbackAuditBuffer.settle(
        freezeBrokenAttackLogId,
        auditEntry,
      );
      pendingFreezeBrokenCallbacks.delete(freezeBrokenAttackLogId);
      // This zero-delay callback task is audit-only. It must not wake Aura
      // decay, target clocks, target cleanup, damage, hit, or RNG machinery.
      continue;
    }
    if (event.type === "reactionDamageGroupReset") {
      const { resetLogId, task } =
        event.payload as ReactionDamageGroupResetEventPayload;
      const resetLog = reactionDamageGroupResetLog[resetLogId];
      if (
        resetLog === undefined ||
        resetLog.taskSequence !== event.sequence ||
        resetLog.resetAtFrame !== event.frame ||
        resetLogIdByTask.get(task) !== resetLogId
      ) {
        throw new Error(
          `Reaction damage-group reset event ${resetLogId} is missing or mismatched.`,
        );
      }
      const execution = reactionDamageGroupEngine.executeReset(task);
      if (resetLog.executed) {
        if (
          execution.applied ||
          !execution.stale ||
          execution.invalidatedReason !== "ALREADY_EXECUTED"
        ) {
          throw new Error(
            `Reaction damage-group reset event ${resetLogId} did not deterministically no-op after inline execution.`,
          );
        }
      } else {
        recordReactionDamageGroupResetExecution(execution, resetLogId);
      }
      // Damage-counter resets are core bookkeeping tasks. They must not wake
      // Aura decay or target-local clock machinery merely by existing.
      continue;
    }
    // The fixed-reference target phase checks a target-local wake before
    // advancing Aura. A stale wake must be reprojected without consuming a
    // target frame or triggering an Aura expiry on the abandoned frame.
    if (
      targetPhaseAuditEnabled &&
      reprojectStaleTargetLocalEvent(event)
    ) {
      continue;
    }
    if (
      targetPhaseV2Enabled &&
      (event.type === "hit" ||
        event.type === "reactionDamage" ||
        event.type === "quickenBloomFollowup" ||
        event.type === "periodicReactionTick" ||
        event.type === "periodicReactionWane") &&
      scheduleAllTargetDecays(event.frame)
    ) {
      queue.push(event);
      continue;
    }
    const preservesDedicatedAuraExpiryBoundary =
      event.type === "frozenExpiry" ||
      event.type === "quickenExpiry" ||
      event.type === "periodicReactionExpiry" ||
      event.type === "electroChargedCleanup" ||
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
    if (targetPhaseEnabled) {
      // First settle every target through the previous frame so the replay
      // row can preserve the exact pre-task/pre-decay state. Current-frame
      // decay is still delayed until after target-owned priority work.
      recordNaturalAuraExpiries(event.frame, false);
      captureTargetTaskPhaseAuraBefore(event.frame);
      if (event.type === "burningTick") {
        const { targetId } =
          event.payload as BurningTickEventPayload;
        const targetOrder =
          enemyTargetOrderById.get(targetId);
        if (targetOrder === undefined) {
          throw new Error(
            `Burning target task could not resolve target order for "${targetId}".`
          );
        }
        // Before target N runs its owned callback, targets 0..N-1 have
        // already completed the current-frame Aura-decay portion of their
        // phases. The current target itself is advanced only after its
        // callback has inspected the pre-decay state.
        recordNaturalAuraExpiries(
          event.frame,
          true,
          targetOrder
        );
      } else if (includeCurrentFrameNaturalAuraExpiry) {
        recordNaturalAuraExpiries(event.frame, true);
      }
    } else if (targetPhaseV2Enabled) {
      // v2 owns the current-frame Reactable.Tick through one synthetic
      // targetDecay event per target. Settling only prior boundaries here
      // prevents an action or stale target-local wake from stealing that
      // target-owned decay.
      recordNaturalAuraExpiries(event.frame, false);
    } else {
      recordNaturalAuraExpiries(
        event.frame,
        includeCurrentFrameNaturalAuraExpiry
      );
    }
    if (
      !targetPhaseAuditEnabled &&
      reprojectStaleTargetLocalEvent(event)
    ) {
      continue;
    }
    cleanup(timeSeconds);

    if (event.type === "enemyShieldPhase") {
      const definition = config.enemyShieldModel!.definitions.find(row => row.id === config.enemyShieldModel!.events[event.payload.inputIndex]!.definitionId)!;
      enemyShieldHost!.handlePhase(event.payload, { frame: event.frame, eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: 0, sourceEventId: `enemy-shield-phase:${event.payload.inputEventId}` }, auraEngines!.get(definition.targetId)!.getAuraStateAt(event.frame));
      continue;
    }

    if (event.type === "sourceNormalChainSwapStart") {
      const { timelineCommandIndex } = event.payload;
      recordNormalChain(event, sourceNormalChainRuntime!.reset(activeCharacterId!, "swap-start-reset"), timelineCommandIndex);
      continue;
    }

    if (event.type === "targetDecay") {
      const { targetId } =
        event.payload as TargetDecayEventPayload;
      materializeTargetPhaseV2Decay(event.frame, targetId);
      continue;
    }

    if (event.type === "action") {
      const { action, cycle } = event.payload as ActionEventPayload;
      const actor = characters.get(action.actorId);
      if (!actor) continue;
      const previousActiveCharacterId = activeCharacterId;
      if (normalHitEnergyRuntime !== undefined && activeCharacterId !== null && activeCharacterId !== actor.id) {
        normalHitEnergyLog.push({ ...normalHitEnergyRuntime.onSwap(event.frame, actor.id), timeSeconds, eventPriority: event.priority, eventSequence: event.sequence });
      }
      activeCharacterId = actor.id;
      if (previousActiveCharacterId !== actor.id) handleArtifactBuff({ kind: "swap", frame: event.frame, previousActorId: previousActiveCharacterId, nextActorId: actor.id }, { actionLogIndex: actionLog.length });
      if (lunarArtifactRuntime !== undefined && previousActiveCharacterId !== actor.id) {
        if (lunarArtifactRuntime.needsCompletedSwap) {
          const command = timelineExecution?.commandResults.find(row => row.commandIndex === action.timelineCommandIndex);
          if (command?.commandType !== "swap" || command.status === "rejected" || command.endFrame !== event.frame) throw new Error("月曜前台／换人状态变化缺少实际完成的换人指令。");
        }
        lunarArtifactRuntime.completedSwap(actor.id, event.frame);
        pendingLunarSwapFrames.delete(event.frame);
        // Materialize the deferred global task after actual swap completion,
        // while preserving its captured state for later projectile delivery.
        lunarRuntime?.advanceThrough(event.frame);
        lunarBloomRuntime?.advanceThrough(event.frame);
        lunarCrystallizeRuntime?.advanceThrough(event.frame);
      }
      const energyCost = quantizeEnergy(
        Math.max(0, safeNumber(action.energyCost))
      );
      const currentEnergy = quantizeEnergy(
        Math.max(0, energies.get(actor.id) ?? 0)
      );
      const availableEnergy = quantizeEnergy(Math.max(0, currentEnergy - (reservedEnergy.get(actor.id) ?? 0)));
      const thrillingTalesDecision = thrillingTalesRuntime?.onSwap({ frame: event.frame,
        previousActorId: previousActiveCharacterId, nextActorId: actor.id });
      if (thrillingTalesDecision !== undefined) {
        const command = action.timelineCommandIndex === undefined ? undefined : timelineExecution?.commandResults.find(row => row.commandIndex === action.timelineCommandIndex);
        if (resultConfig.timeline !== undefined && (command?.commandType !== "swap" || command.status === "rejected" || command.endFrame !== event.frame)) {
          throw new Error("讨龙合法轮转切换缺少实际完成的换人指令。");
        }
        const energyRejected = energyCost > availableEnergy + ENERGY_COMPARISON_EPSILON;
        thrillingTalesLog.push({ ...thrillingTalesDecision, id: thrillingTalesLog.length, frame: event.frame, timeSeconds,
          eventPriority: event.priority, eventSequence: event.sequence, actionId: action.id, cycle,
          timelineCommandIndex: action.timelineCommandIndex ?? null, actionLogIndex: energyRejected ? null : actionLog.length,
          skippedActionIndex: energyRejected ? skippedActions.length : null,
          swapKind: resultConfig.timeline === undefined ? "legacy-implicit" : "legal-completed" });
        if (thrillingTalesDecision.outcome === "applied") addBuff(event.frame / 60, thrillingTalesDecision.ownerId,
          { key: "ttds", label: "讨龙英杰谭", target: thrillingTalesDecision.recipientId, stat: "atkPct",
            value: thrillingTalesDecision.coefficient, duration: THRILLING_TALES_PROFILE.durationFrames / 60 });
      }
      if (
        energyCost >
        availableEnergy + ENERGY_COMPARISON_EPSILON
      ) {
        skippedActions.push({
          time: timeSeconds,
          frame: event.frame,
          actorId: actor.id,
          actionId: action.id,
          action: action.name,
          reason: `能量不足 ${round(availableEnergy, 1)}/${energyCost}`,
          reasonCode: "INSUFFICIENT_ENERGY",
          energyBefore: availableEnergy,
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

      if (action.staminaCost !== undefined && staminaRuntime !== undefined) {
        if (staminaRuntime.available < action.staminaCost.amount) throw new Error(`合法时间线与实际体力状态不一致：${action.id}`);
        staminaRuntime.accept(action.staminaCost, event.frame, actor.id, action.timelineCommandIndex ?? null, action.id);
      }

      if (stellarSwirlRuntime !== undefined && action.timelineCommandIndex !== undefined) {
        const command = resultConfig.timeline?.commands[action.timelineCommandIndex];
        if (stellarSwirlRuntime.highJump.airborne !== null && command?.type !== "plunge") {
          throw new Error(`星旋腾空与合法时间线不一致：${action.id} 不是下落动作。`);
        }
        const airborneAction = { frame: event.frame, actorId: actor.id,
          sourceEventId: `action:${action.id}:${cycle}:${event.sequence}`, timelineCommandIndex: action.timelineCommandIndex,
          executionOrder: { frame: event.frame, priority: event.priority, sequence: event.sequence } };
        if (command?.type === "jump") stellarSwirlRuntime.jump(airborneAction);
        if (command?.type === "plunge") stellarSwirlRuntime.plunge(airborneAction);
      }

      const lunarAbilityRuntime = lunarBloomRuntime ?? lunarMixedV2Runtime;
      const lunarAbilityDeclarations = lunarBloomOptions?.abilities ?? lunarMixedV2Options?.abilities;
      if (lunarAbilityRuntime !== undefined) {
        if (event.frame < lunarAbilityRuntime.declaredAnimationUntil) throw new Error("月露涤荡完整 124 帧动画期间不可切换或启动其他动作。");
        if (lunarAbilityDeclarations?.some(declaration => declaration.sourceAbilityId === action.sourceAbilityId && declaration.actorId === actor.id)) {
          if (event.frame < lastLunarBloomActionAnimationUntil) throw new Error("月露涤荡此来源配置要求上一动作完整结束后的闲置起手，不能推定取消连携。");
          lunarAbilityRuntime.startDeclaredAbility({ frame: event.frame, actorId: actor.id, sourceAbilityId: action.sourceAbilityId!, sourceEventId: `action:${action.id}:${cycle}:${event.sequence}`, fromState: "idle" });
        }
        lastLunarBloomActionAnimationUntil = Math.max(lastLunarBloomActionAnimationUntil, action.animationEndFrame ?? event.frame);
      }

      // Costs within the explicit comparison tolerance are legal, but their
      // floating-point excess must never create negative energy. Account for
      // the amount actually removed so actionLog and energyStats remain an
      // exact replay pair.
      const deferredCost = energyCost > 0 && (action.energyCostFrame ?? 0) > 0;
      const energyAfterCost = quantizeEnergy(
        Math.max(0, currentEnergy - (deferredCost ? 0 : energyCost))
      );
      const energySpent = quantizeEnergy(
        currentEnergy - energyAfterCost
      );
      energies.set(actor.id, energyAfterCost);
      const energySummary = energyStats.get(actor.id);
      if (energySummary) {
        energySummary.spent = quantizeEnergy(
          energySummary.spent + energySpent
        );
      }
      if (energyCost > 0 && !deferredCost) {
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

      if (sourceNormalChainRuntime !== undefined && action.timelineCommandIndex !== undefined) {
        const command = resultConfig.timeline!.commands[action.timelineCommandIndex]!;
        const decision = command.type === "swap" ? sourceNormalChainRuntime.reset(actor.id, "swap-complete-reset")
          : sourceNormalChainRuntime.acceptAction({ actorId: actor.id, kind: command.type,
            ...(action.sourceAbilityId === undefined ? {} : { sourceAbilityId: action.sourceAbilityId }) });
        recordNormalChain(event, decision, action.timelineCommandIndex, action, actionLog.length - 1);
      }

      if (action.sourceAbilityId !== undefined && sourceAbilityById.get(action.sourceAbilityId)?.kind === "burst") {
        handleArtifactBuff({ kind: "burst", frame: event.frame, sourceActorId: actor.id, activeCharacterId }, { actionLogIndex: actionLog.length - 1 });
        for (const decision of artifactEventRuntime?.onBurst(event.frame, activeCharacterId) ?? []) {
          const id = appendArtifactDecision(event, decision, artifactSource("burst", action.id, { actionLogIndex: actionLog.length - 1 }));
          if (decision.outcome !== "activated") continue;
          // Queue the actual receiver tasks, including work beyond observation.
          // Their final F+360 energy arrives even though the effect is expiring.
          for (const recipient of decision.exileRecipients) for (const [index, delay] of ARTIFACT_EVENT_PROFILE.exile.tickFrames.entries()) {
            push((event.frame + delay) / 60, "artifactEnergyTick", { actorId: decision.actorId, effectId: "exile-4pc",
              receiverId: recipient.actorId, amount: ARTIFACT_EVENT_PROFILE.exile.energy,
              sourceActionId: action.id, sourceFrame: event.frame, parentArtifactEventLogId: id, tickIndex: index + 1, cycle } satisfies ArtifactEnergyTickPayload);
          }
        }
      }
      if (action.sourceAbilityId !== undefined && sourceAbilityById.get(action.sourceAbilityId)?.kind === "skill") {
        for (const decision of weaponProcRuntime?.onLifecycle("skill", event.frame, activeCharacterId) ?? []) {
          weaponProcLifecycleLog.push({ ...decision, id: weaponProcLifecycleLog.length, timeSeconds, eventPriority: event.priority,
            eventSequence: event.sequence, actionLogIndex: actionLog.length - 1, particleEventId: null });
        }
      }

      const skillAbility = action.sourceAbilityId === undefined ? undefined : runtimeSkillAbilities.get(action.sourceAbilityId);
      if (skillAbility !== undefined) {
        const state = skillCooldownStates.get(actor.id)!;
        if (state.availableCharges <= 0) throw new Error(`实际共享战技充能与合法前缀反馈不一致：${action.id}`);
        const task: SkillCooldownTaskPayload = { actorId: actor.id, actionId: action.id, abilityId: skillAbility.id,
          timelineCommandIndex: action.timelineCommandIndex!, recoveryFrames: skillAbility.chargeRecoveryFrames ?? skillAbility.cooldownFrames };
        if ((skillAbility.cooldownStartFrame ?? 0) > 0) push((event.frame + skillAbility.cooldownStartFrame!) / 60, "skillCooldownStart", task);
        else recordSkillCooldown(event, actor.id, "start", startSerialSkillCooldown(state, event.frame,
          { castId: task.actionId, abilityId: task.abilityId, recoveryFrames: task.recoveryFrames }), task);
      }

      const excludedConditionalHitIds = new Set<string>();
      for (const group of action.conditionalHitGroups ?? []) {
        const hp = playerHpStateByActorId.get(actor.id)!;
        const decision = calculateActionCondition(group, hp);
        actionConditionLog.push({ id: actionConditionLog.length, actionLogIndex: actionLog.length - 1,
          actorId: actor.id, actionId: action.id, groupId: group.id,
          frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence,
          ownerCurrentHp: hp.currentHp, ownerMaxHp: hp.maxHp, thresholdRatio: group.thresholdRatio,
          selected: decision.selected, hitIds: [...group.hitIds], trace: decision.trace });
        if (!decision.selected) for (const hitId of group.hitIds) excludedConditionalHitIds.add(hitId);
      }

      if (deferredCost) {
        const reservedBefore = quantizeEnergy(reservedEnergy.get(actor.id) ?? 0);
        const reservedAfter = quantizeEnergy(reservedBefore + energyCost);
        reservedEnergy.set(actor.id, reservedAfter);
        const actionLogIndex = actionLog.length - 1;
        energyCostLog.push({ operation: "reserve", actionLogIndex, frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, energyCost, energyBefore: currentEnergy, energyAfter: currentEnergy, reservedBefore, reservedAfter });
        push(timeSeconds + action.energyCostFrame! / 60, "energyCost", { actorId: actor.id, actionId: action.id, actionLogIndex, energyCost });
      }
      for (const definition of action.statConversions ?? []) {
        const snapshot = computeStats(actor.id, timeSeconds)!;
        const converted = calculateStatConversion(definition, snapshot);
        const row = { id: statConversionLog.length, actionLogIndex: actionLog.length - 1, key: definition.key, frame: event.frame, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, expiresAtFrame: event.frame + definition.durationFrames, sourceValue: converted.sourceValue, appliedValue: converted.appliedValue, snapshot: deepClone(snapshot) };
        statConversionLog.push(row);
        liveConversions.set(`${actor.id}:${definition.key}`, row);
      }
      const boundSnapshotHits = new Set([...(action.summons ?? []).flatMap(summon => summon.hitIds), ...(action.periodicEntities ?? []).flatMap(entity => entity.hitIds)]);
      const snapshots = snapshotAction(action, timeSeconds, (action.hits ?? []).filter(hit => hit.snapshotFrame === undefined && hit.snapshot === "action" &&
        (hit.id === undefined || !boundSnapshotHits.has(hit.id) && !excludedConditionalHitIds.has(hit.id))));

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
      for (const change of action.healthChanges ?? []) {
        push(timeSeconds + change.frameOffset / 60, "healthChange", { change, sourceActorId: actor.id, actionLogIndex: actionLog.length - 1 });
      }
      const boundSummonHits = new Set([...(action.summons ?? []).flatMap(summon => summon.hitIds), ...(action.periodicEntities ?? []).flatMap(entity => entity.hitIds)]);
      scheduleActionHits(action, cycle, timeSeconds, snapshots, actorPoseById.get(actor.id), hit => hit.id === undefined || (!boundSummonHits.has(hit.id) && !excludedConditionalHitIds.has(hit.id)));
      for (const definition of action.periodicEntities ?? []) {
        push(timeSeconds + definition.spawnFrame / 60, "periodicEntitySpawn", { action, cycle, definition, actionLogIndex: actionLog.length - 1 });
      }
      for (const summon of action.summons ?? []) {
        push(timeSeconds + summon.spawnFrame / 60, "summonSpawn", { action, cycle, summon, actionTimeSeconds: timeSeconds });
      }
      continue;
    }

    if (event.type === "quickenBloomFollowup") {
      const {
        targetId,
        sourceActorId,
        action,
        triggerHitId,
        triggerHitGroupId,
        triggerDamageEventId,
        triggerElement,
        reactionBonusDelta,
        cycle,
        triggerEventType,
        triggerEventPriority,
        triggerEventSequence
      } = event.payload as QuickenBloomFollowupEventPayload;
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (auraEngine === undefined || target === undefined) {
        throw new Error(
          `Quicken→Bloom task could not resolve target "${targetId}".`
        );
      }
      const reactionTaskLogId = reactionTaskLog.length;
      const targetPhaseV2Entry =
        ensureTargetPhaseV2State({
          targetId,
          globalFrame: event.frame,
          emit: true
        })?.entry ?? null;
      const taskResult = auraEngine.processQuickenBloomFollowup({
        frame: event.frame,
        sourceActorId,
        triggerElement,
        originReactionTaskId: reactionTaskLogId
      });
      const electroChargedCleanupResults =
        auraEngine.drainElectroChargedCleanupResults();
      const prematureCleanup = electroChargedCleanupResults.find(
        (result) => result.outcome !== "armed"
      );
      if (prematureCleanup !== undefined) {
        throw new Error(
          `Aura-v8 EC cleanup for reaction task ${prematureCleanup.originReactionTaskId ?? "unknown"} resolved before its scheduled target Tick.`
        );
      }
      const armedCleanupResults = electroChargedCleanupResults.filter(
        (result) =>
          result.outcome === "armed" &&
          result.originReactionTaskId === reactionTaskLogId
      );
      if (
        electroChargedCleanupResults.length !== armedCleanupResults.length ||
        armedCleanupResults.length > 1
      ) {
        throw new Error(
          `Quicken→Bloom task ${reactionTaskLogId} produced an invalid Aura-v8 EC cleanup arm set.`
        );
      }
      const armedCleanup = armedCleanupResults[0] ?? null;
      const electroChargedCleanup: ElectroChargedCleanupAudit | null =
        armedCleanup === null
          ? null
          : {
              generation: armedCleanup.generation,
              requestedTargetFrame: armedCleanup.armedAtTargetFrame,
              deadlineTargetFrame: armedCleanup.deadlineTargetFrame,
              requestReason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO",
              outcome: "pending-at-end",
              resolutionReason: null,
              resolvedGlobalFrame: null,
              resolvedTargetFrame: null,
              targetPhaseLogId: null,
              periodicReactionLogId: null,
              targetStateTimelinePointId: null,
              ...(auraV9Enabled
                ? {
                    cadence: (() => {
                      if (armedCleanup.cadence === undefined) {
                        throw new Error(
                          `Aura-v9 EC cleanup arm for reaction task ${reactionTaskLogId} is missing cadence state.`
                        );
                      }
                      return deepClone(armedCleanup.cadence);
                    })()
                  }
                : {})
            };
      if (armedCleanup !== null) {
        if (
          armedCleanup.reason !== "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO" ||
          armedCleanup.resolvedAtFrame !== null ||
          armedCleanup.resolvedAtTargetFrame !== null ||
          armedCleanup.deadlineTargetFrame !==
            armedCleanup.armedAtTargetFrame + 1
        ) {
          throw new Error(
            `Quicken→Bloom task ${reactionTaskLogId} produced an invalid Aura-v8 EC cleanup arm.`
          );
        }
        scheduleElectroChargedCleanup({
          targetId,
          generation: armedCleanup.generation,
          reactionTaskLogId,
          deadlineTargetFrame: armedCleanup.deadlineTargetFrame,
          projectedGlobalFrame: auraEngine.projectTargetFrame(
            armedCleanup.deadlineTargetFrame
          )
        });
      }
      const bloomReaction =
        taskResult.bloomReaction === null
          ? null
          : {
              ...taskResult.bloomReaction,
              selfDamageStatus: playerSelfDamageStatus
            };
      if (bloomReaction !== null) handleArtifactReactions(["bloom"], sourceActorId, event.frame, { parentDamageEventId: triggerDamageEventId, reactionTaskLogId });
      if (bloomReaction !== null) lunarArtifactRuntime?.reactionTriggered(sourceActorId, event.frame, "bloom");
      if (bloomReaction !== null && lunarMixedV2Runtime !== undefined) moonlightArtifactRuntime?.onLunarReaction(event.frame, "lunarBloom", sourceActorId, triggerDamageEventId);
      if (lunarMixedV2Runtime !== undefined && bloomReaction !== null) {
        lunarMixedV2Runtime.bloom({ frame: event.frame, sourceActorId, sourceEventId: `reaction-task:${reactionTaskLogId}`, attackId: triggerHitGroupId, targetId, element: triggerElement, gaugeUnits: bloomReaction.sourceGaugeUnitsBefore });
      }
      const taskIntraEventSequence =
        nextIntraEventSequence();
      const quickenStateLogIds =
        bloomReaction === null
          ? []
          : recordQuickenState({
              audit: {
                catalyzeReaction: null,
                bloomReactions: [bloomReaction]
              },
              targetId,
              targetName: target.name,
              sourceActorId,
              triggerDamageEventId,
              frame: event.frame,
              timeSeconds
            });
      const coreReferences =
        bloomReaction === null
          ? { dendroCoreLogIds: [], dendroCoreIds: [] }
          : scheduleBloomCoreSpawns({
              audits: [bloomReaction],
              actorId: sourceActorId,
              action,
              triggerHitId,
              triggerHitGroupId,
              triggerDamageEventId,
              sourceTargetId: targetId,
              reactionBonusDelta,
              cycle,
              eventType: "quickenBloomFollowup",
              eventPriority: event.priority,
              eventSequence: event.sequence,
              reactionTaskLogId,
              nextIntraEventSequence
            });
      reactionTaskLog.push({
        id: reactionTaskLogId,
        kind: "quicken-bloom-followup",
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        sourceActorId,
        sourceActionId: action.id,
        triggerHitId,
        triggerHitGroupId,
        triggerDamageEventId,
        triggerElement,
        triggerEventType,
        triggerEventPriority,
        triggerEventSequence,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: taskIntraEventSequence,
        status: taskResult.status,
        blockedReason: taskResult.blockedReason,
        auraBefore: deepClone(taskResult.auraBefore),
        auraConsumed: deepClone(taskResult.auraConsumed),
        auraAfter: deepClone(taskResult.auraAfter),
        bloomReaction:
          bloomReaction === null ? null : deepClone(bloomReaction),
        quickenStateLogIds,
        dendroCoreLogIds: coreReferences.dendroCoreLogIds,
        dendroCoreIds: coreReferences.dendroCoreIds,
        electroChargedCleanup,
        mechanicsDataStatus: "fixed-gcsim-provisional"
      });
      appendTargetTaskPhaseReference(
        targetTaskPhaseByKey.get(
          targetTaskPhaseKey(event.frame, targetId)
        ) ?? null,
        "reactionTaskLogIds",
        reactionTaskLogId
      );
      appendTargetPhaseV2Reference(
        targetPhaseV2Entry,
        "reactionTaskLogIds",
        reactionTaskLogId
      );
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "quicken-bloom-followup",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction:
          taskResult.status === "triggered" ? "bloom" : "none",
        reactions:
          taskResult.status === "triggered" ? ["bloom"] : [],
        primaryDamageEventId: triggerDamageEventId,
        links: [
          { kind: "damage-event", id: triggerDamageEventId },
          {
            kind: "reaction-task-log",
            id: reactionTaskLogId
          },
          ...quickenStateLogIds.map((id) => ({
            kind: "quicken-state-log" as const,
            id
          }))
        ],
        auraBefore: taskResult.auraBefore,
        auraConsumed: taskResult.auraConsumed,
        auraAfter: taskResult.auraAfter
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
        clockModel: dendroCoreClockModel,
        hitlagStatus: dendroCoreHitlagStatus,
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
        triggerHitId,
        favoniusLogId,
        origin
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
        ...(origin === undefined ? {} : { origin }),
        triggerLogId: triggerLogId ?? null,
        triggerHitId: triggerHitId ?? null
      });
      if (favoniusLogId !== undefined) favoniusLog[favoniusLogId]!.particleEventId = particleEventId;
      if (receivedWithinSimulation || origin !== undefined) {
        push(receiveTimeSeconds, "particleReceive", { particleEventId, ...(origin === undefined ? {} : { declaredDrop: true as const }) });
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
      for (const decision of weaponProcRuntime?.onLifecycle("particle-received", event.frame, activeCharacterId) ?? []) {
        weaponProcLifecycleLog.push({ ...decision, id: weaponProcLifecycleLog.length, timeSeconds, eventPriority: event.priority,
          eventSequence: event.sequence, actionLogIndex: null, particleEventId });
      }
      for (const decision of artifactEventRuntime?.onParticleReceived(event.frame, activeCharacterId) ?? []) {
        appendArtifactDecision(event, decision, artifactSource("particle-received", particle.sourceActionId, { particleEventId }));
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
        lifecycleScheduleKey(
          targetId,
          generation,
          expectedExpiryFrame,
          event.targetLocalDeadline ?? null
        )
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const targetPhaseV2State =
        materializeTargetPhaseV2Decay(
          event.frame,
          targetId
        );
      const result = auraEngine.expireFrozen(
        event.frame,
        generation,
        expectedExpiryFrame
      );
      if (
        targetPhaseV2Enabled &&
        result.operation === "stale"
      ) {
        // Refresh, consumption, or a before-Reactable callback can invalidate
        // a queued expiry. Stale V2/V3 wakes own no Aura boundary or Tick transition.
        continue;
      }
      const targetStateTimelinePointId =
        targetStateTimelineRecorder.result().points.length;
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
      const frozenStateLogId = frozenStateLog.length;
      frozenStateLog.push({
        id: frozenStateLogId,
        reaction: "freeze",
        generation,
        operation: "expire",
        frame: event.frame,
        ...targetLifecycleFields(
          targetId,
          event.frame,
          null
        ),
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
      appendFreezeBrokenAttackAudit({
        frozenStateEntry: frozenStateLog[frozenStateLogId]!,
        depletionDamageEventId: null,
        sourceFreezeDamageEventId:
          source?.triggerDamageEventId ?? null,
        triggerEventType: event.type,
        triggerEventPriority: event.priority,
        triggerEventSequence: event.sequence,
        nextIntraEventSequence,
      });
      if (targetPhaseV2State !== null) {
        appendTargetPhaseV2Transition(
          targetPhaseV2State,
          {
            stage: "reactable-tick",
            kind: "frozen-expiry",
            generation,
            deadlineTargetFrame:
              event.targetLocalDeadline?.targetFrame ??
              resolveTargetFrameAt(
                targetId,
                expectedExpiryFrame
              ),
            frozenStateLogId,
            targetStateTimelinePointId
          },
          result.auraAfter
        );
      }
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
        lifecycleScheduleKey(
          targetId,
          generation,
          expectedExpiryFrame,
          event.targetLocalDeadline ?? null
        )
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const targetPhaseV2State =
        materializeTargetPhaseV2Decay(
          event.frame,
          targetId
        );
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
      const targetStateTimelinePointId =
        targetStateTimelineRecorder.result().points.length;
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
      const quickenStateLogId = quickenStateLog.length;
      quickenStateLog.push({
        id: quickenStateLogId,
        reaction: "quicken",
        generation,
        operation: "expire",
        frame: event.frame,
        ...targetQuickenLifecycleFields(
          targetId,
          event.frame,
          result.expiresAtFrameBefore,
          result.expiresAtFrame
        ),
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
      if (targetPhaseV2State !== null) {
        appendTargetPhaseV2Transition(
          targetPhaseV2State,
          {
            stage: "reactable-tick",
            kind: "quicken-expiry",
            generation,
            deadlineTargetFrame:
              event.targetLocalDeadline?.targetFrame ??
              resolveTargetFrameAt(
                targetId,
                expectedExpiryFrame
              ),
            quickenStateLogId,
            targetStateTimelinePointId
          },
          result.auraAfter
        );
      }
      if (source?.generation === generation) {
        activeQuickenStateSources.delete(targetId);
      }
      continue;
    }

    if (event.type === "electroChargedCleanup") {
      const { targetId, generation, reactionTaskLogId, deadlineTargetFrame } =
        event.payload as ElectroChargedCleanupEventPayload;
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      const wakeReactionTask = reactionTaskLog[reactionTaskLogId];
      if (
        auraEngine === undefined ||
        target === undefined ||
        wakeReactionTask === undefined ||
        wakeReactionTask.targetId !== targetId ||
        wakeReactionTask.electroChargedCleanup === null
      ) {
        throw new Error(
          `Aura-v8 EC cleanup could not resolve reaction task ${reactionTaskLogId} for target "${targetId}".`
        );
      }
      const wakeAudit = wakeReactionTask.electroChargedCleanup;
      if (wakeAudit.outcome !== "pending-at-end") {
        // Multiple generations can share one target-Tick deadline. The first
        // wake drains and resolves every terminal Aura result; later queued
        // wakes for those tasks are deterministic no-ops.
        continue;
      }
      if (
        wakeAudit.generation !== generation ||
        wakeAudit.deadlineTargetFrame !== deadlineTargetFrame
      ) {
        throw new Error(
          `Aura-v8 EC cleanup wake disagrees with reaction task ${reactionTaskLogId}.`
        );
      }
      const targetPhaseV2State = materializeTargetPhaseV2Decay(
        event.frame,
        targetId
      );
      if (targetPhaseV2State === null) {
        throw new Error("Aura-v8 EC cleanup requires target-phase-v2.");
      }
      const cleanupResults = auraEngine.drainElectroChargedCleanupResults();
      if (
        cleanupResults.length === 0 ||
        cleanupResults.some((result) => result.outcome === "armed")
      ) {
        throw new Error(
          `Aura-v8 EC cleanup reaction task ${reactionTaskLogId} did not produce terminal results at its target Tick.`
        );
      }
      let resolvedWakeTask = false;
      for (const cleanupResult of cleanupResults) {
        const originReactionTaskId = cleanupResult.originReactionTaskId;
        if (originReactionTaskId === null) {
          throw new Error(
            "Simulator-owned Aura-v8 EC cleanup result is missing its reaction task id."
          );
        }
        const reactionTask = reactionTaskLog[originReactionTaskId];
        const pendingAudit = reactionTask?.electroChargedCleanup;
        const resolvedGlobalFrame = cleanupResult.resolvedAtFrame;
        const resolvedTargetFrame = cleanupResult.resolvedAtTargetFrame;
        if (
          reactionTask === undefined ||
          reactionTask.targetId !== targetId ||
          pendingAudit === undefined ||
          pendingAudit === null ||
          pendingAudit.outcome !== "pending-at-end" ||
          pendingAudit.generation !== cleanupResult.generation ||
          pendingAudit.deadlineTargetFrame !==
            cleanupResult.deadlineTargetFrame ||
          resolvedGlobalFrame === null ||
          resolvedTargetFrame === null ||
          resolvedGlobalFrame !== event.frame ||
          resolvedTargetFrame !== resolveTargetFrameAt(targetId, event.frame) ||
          resolvedTargetFrame < cleanupResult.deadlineTargetFrame
        ) {
          throw new Error(
            `Aura-v8 EC cleanup reaction task ${originReactionTaskId} produced an inconsistent terminal result.`
          );
        }
        const source = activePeriodicReactionSources.get(targetId);
        let outcome:
          | "stop"
          | "retain"
          | "superseded"
          | "natural-expiry"
          | "ended-before-deadline";
        let periodicReactionLogId: number | null = null;
        let targetStateTimelinePointId: number | null = null;
        if (auraV9Enabled && cleanupResult.cadence === undefined) {
          throw new Error(
            `Aura-v9 EC cleanup for reaction task ${originReactionTaskId} is missing cadence state.`,
          );
        }
        if (cleanupResult.outcome === "stopped") {
          if (
            cleanupResult.reason !==
              "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM" ||
            cleanupResult.nextTickFrame !== null ||
            source?.generation !== cleanupResult.generation
          ) {
            throw new Error(
              `Aura-v8 EC cleanup stop for reaction task ${originReactionTaskId} does not own active generation ${cleanupResult.generation}.`
            );
          }
          outcome = "stop";
          periodicReactionLogId = periodicReactionLog.length;
          periodicReactionLog.push({
            id: periodicReactionLogId,
            reaction: "electroCharged",
            generation: cleanupResult.generation,
            operation: "stop",
            frame: event.frame,
            targetFrame: resolvedTargetFrame,
            timeSeconds,
            targetId,
            targetName: target.name,
            sourceActorId: source.actorId,
            triggerDamageEventId: source.triggerDamageEventId,
            reactionTaskLogId: originReactionTaskId,
            reactionDamageLogId: null,
            damageEventId: null,
            tickIndex: null,
            auraBefore: deepClone(cleanupResult.auraAfter),
            auraConsumed: [],
            auraAfter: deepClone(cleanupResult.auraAfter),
            nextTickFrame: null,
            coexistenceExpiresAtFrame: null,
            waneFrame: null,
            reason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
            ...electroChargedV9Fields(
              cleanupResult.cadence?.status === "superseded"
                ? undefined
                : cleanupResult.cadence?.status,
              cleanupResult.cadence?.waneListenerActive
            )
          });
          activePeriodicReactionSources.delete(targetId);
        } else if (cleanupResult.outcome === "retained") {
          if (
            cleanupResult.reason !==
              "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK" ||
            source?.generation !== cleanupResult.generation
          ) {
            throw new Error(
              `Aura-v8 EC cleanup retain for reaction task ${originReactionTaskId} lost active generation ${cleanupResult.generation}.`
            );
          }
          outcome = "retain";
        } else if (cleanupResult.outcome === "superseded") {
          if (
            cleanupResult.reason !== "ELECTRO_CHARGED_GENERATION_SUPERSEDED" ||
            source === undefined ||
            source.generation === cleanupResult.generation
          ) {
            throw new Error(
              `Aura-v8 EC cleanup supersession for reaction task ${originReactionTaskId} has no replacement stream.`
            );
          }
          outcome = "superseded";
        } else if (cleanupResult.outcome === "ended-before-deadline") {
          if (
            !auraV9Enabled ||
            cleanupResult.reason !==
              "ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP" ||
            cleanupResult.nextTickFrame !== null ||
            source !== undefined
          ) {
            throw new Error(
              `Aura-v9 EC cleanup ended-before-deadline for reaction task ${originReactionTaskId} has inconsistent stream ownership.`,
            );
          }
          const terminalMatches = periodicReactionLog.filter(
            (entry) =>
              entry.reaction === "electroCharged" &&
              entry.generation === cleanupResult.generation &&
              entry.targetId === targetId &&
              entry.frame < event.frame &&
              entry.nextTickFrame === null &&
              (entry.operation === "wane" || entry.operation === "stop"),
          );
          const terminal = terminalMatches.at(-1);
          if (terminal === undefined) {
            throw new Error(
              `Aura-v9 EC cleanup ended-before-deadline for reaction task ${originReactionTaskId} cannot find its terminal periodic row.`,
            );
          }
          if (
            terminal.reactionTaskLogId !== undefined &&
            terminal.reactionTaskLogId !== originReactionTaskId
          ) {
            throw new Error(
              `Aura-v9 EC cleanup terminal row ${terminal.id} already belongs to another reaction task.`,
            );
          }
          terminal.reactionTaskLogId = originReactionTaskId;
          outcome = "ended-before-deadline";
          periodicReactionLogId = terminal.id;
        } else if (cleanupResult.outcome === "natural-expiry") {
          if (
            cleanupResult.reason !== "AURA_DECAY_EXPIRED_BEFORE_CLEANUP" ||
            cleanupResult.nextTickFrame !== null ||
            source !== undefined
          ) {
            throw new Error(
              `Aura-v8 EC cleanup natural-expiry for reaction task ${originReactionTaskId} did not follow ownership deletion for generation ${cleanupResult.generation}.`
            );
          }
          const naturalStopMatches = periodicReactionLog.filter(
            (entry) =>
              entry.reaction === "electroCharged" &&
              entry.generation === cleanupResult.generation &&
              entry.operation === "stop" &&
              entry.frame === event.frame &&
              entry.targetFrame === resolvedTargetFrame &&
              entry.reason === "AURA_DECAY_EXPIRED"
          );
          if (naturalStopMatches.length !== 1) {
            throw new Error(
              `Aura-v8 EC cleanup natural-expiry for reaction task ${originReactionTaskId} requires exactly one same-frame natural stop; found ${naturalStopMatches.length}.`
            );
          }
          const naturalStop = naturalStopMatches[0]!;
          if (
            naturalStop.id < 0 ||
            periodicReactionLog[naturalStop.id] !== naturalStop ||
            (naturalStop.reactionTaskLogId !== undefined &&
              naturalStop.reactionTaskLogId !== originReactionTaskId)
          ) {
            throw new Error(
              `Aura-v8 EC cleanup natural-expiry for reaction task ${originReactionTaskId} resolved an invalid natural stop backlink.`
            );
          }
          const naturalTransitions =
            targetPhaseV2State.entry.reactableTick.transitions.filter(
              (transition) =>
                transition.kind === "electro-charged-expiry" &&
                transition.generation === cleanupResult.generation &&
                transition.periodicReactionLogId === naturalStop.id
            );
          if (naturalTransitions.length !== 1) {
            throw new Error(
              `Aura-v8 EC cleanup natural-expiry for reaction task ${originReactionTaskId} requires exactly one same-frame expiry transition; found ${naturalTransitions.length}.`
            );
          }
          const naturalTransition = naturalTransitions[0]!;
          const naturalPoint =
            targetStateTimelineRecorder.result().points[
              naturalTransition.targetStateTimelinePointId
            ];
          const naturalPeriodicLinks =
            naturalPoint?.links.filter(
              (link) =>
                link.kind === "periodic-reaction-log" &&
                link.id === naturalStop.id
            ) ?? [];
          if (
            naturalPoint === undefined ||
            naturalPoint.targetId !== targetId ||
            naturalPoint.frame !== event.frame ||
            (naturalPoint.targetFrame ?? naturalPoint.frame) !==
              resolvedTargetFrame ||
            naturalPoint.cause !== "electro-charged-expiry" ||
            naturalPoint.eventType !== "periodicReactionExpiry" ||
            naturalPeriodicLinks.length !== 1
          ) {
            throw new Error(
              `Aura-v8 EC cleanup natural-expiry for reaction task ${originReactionTaskId} could not reuse the unique natural-expiry timeline point.`
            );
          }
          naturalStop.reactionTaskLogId = originReactionTaskId;
          outcome = "natural-expiry";
          periodicReactionLogId = naturalStop.id;
          targetStateTimelinePointId =
            naturalTransition.targetStateTimelinePointId;
        } else {
          throw new Error(
            `Aura-v8 EC cleanup reaction task ${originReactionTaskId} produced unsupported outcome "${cleanupResult.outcome}".`
          );
        }

        if (targetStateTimelinePointId === null) {
          targetStateTimelinePointId =
            targetStateTimelineRecorder.result().points.length;
          targetStateTimelineRecorder.recordEvent({
            frame: event.frame,
            timeSeconds,
            targetId,
            targetName: target.name,
            cause: "electro-charged-cleanup",
            eventType: event.type,
            eventPriority: event.priority,
            eventSequence: event.sequence,
            intraEventSequence: nextIntraEventSequence(),
            reaction: "electroCharged",
            reactions: ["electroCharged"],
            primaryDamageEventId: null,
            links:
              (outcome !== "stop" && outcome !== "ended-before-deadline") ||
              periodicReactionLogId === null
                ? []
                : [
                    {
                      kind: "periodic-reaction-log",
                      id: periodicReactionLogId
                    }
                  ],
            // Reactable.Tick already performed ordinary Aura decay. Cleanup
            // only changes EC stream ownership, so this point must not
            // misrepresent passive gauge loss as a cleanup mutation.
            auraBefore: cleanupResult.auraAfter,
            auraAfter: cleanupResult.auraAfter
          });
        }
        const cleanupTransitionBase = {
          stage: "reactable-tick" as const,
          kind: "electro-charged-cleanup" as const,
          deadlineTargetFrame: cleanupResult.deadlineTargetFrame,
          generation: cleanupResult.generation,
          reactionTaskLogId: originReactionTaskId,
          targetStateTimelinePointId
        };
        appendTargetPhaseV2Transition(
          targetPhaseV2State,
          outcome === "stop" ||
            outcome === "natural-expiry" ||
            outcome === "ended-before-deadline"
            ? {
                ...cleanupTransitionBase,
                outcome,
                periodicReactionLogId: periodicReactionLogId!
              }
            : {
                ...cleanupTransitionBase,
                outcome,
                periodicReactionLogId: null
              },
          cleanupResult.auraAfter
        );
        const targetPhaseLogId = targetPhaseV2State.entry.id;
        const resolvedTimelinePoint =
          targetStateTimelineRecorder.result().points[
            targetStateTimelinePointId
          ];
        if (resolvedTimelinePoint === undefined) {
          throw new Error(
            `Aura-v8 EC cleanup reaction task ${originReactionTaskId} resolved missing timeline point ${targetStateTimelinePointId}.`
          );
        }
        const existingTargetPhaseLink = resolvedTimelinePoint.links.find(
          (link) => link.kind === "target-phase-log"
        );
        if (existingTargetPhaseLink === undefined) {
          resolvedTimelinePoint.links.push({
            kind: "target-phase-log",
            id: targetPhaseLogId
          });
        } else if (existingTargetPhaseLink.id !== targetPhaseLogId) {
          throw new Error(
            `Aura-v8 EC cleanup reaction task ${originReactionTaskId} cannot reuse timeline point ${targetStateTimelinePointId} from another target phase.`
          );
        }
        const resolvedBase = {
          generation: cleanupResult.generation,
          requestedTargetFrame: pendingAudit.requestedTargetFrame,
          deadlineTargetFrame: cleanupResult.deadlineTargetFrame,
          requestReason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO" as const,
          resolvedGlobalFrame,
          resolvedTargetFrame,
          targetPhaseLogId,
          periodicReactionLogId,
          targetStateTimelinePointId,
          ...(auraV9Enabled
            ? {
                cadence: deepClone(cleanupResult.cadence!)
              }
            : {})
        };
        reactionTask.electroChargedCleanup =
          outcome === "stop"
            ? {
                ...resolvedBase,
                outcome,
                resolutionReason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
                periodicReactionLogId: periodicReactionLogId!
              }
            : outcome === "retain"
              ? {
                  ...resolvedBase,
                  outcome,
                  resolutionReason: "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK",
                  periodicReactionLogId: null
                }
              : outcome === "superseded"
                ? {
                    ...resolvedBase,
                    outcome,
                    resolutionReason: "ELECTRO_CHARGED_GENERATION_SUPERSEDED",
                    periodicReactionLogId: null
                  }
                : outcome === "natural-expiry"
                  ? {
                      ...resolvedBase,
                      outcome,
                      resolutionReason: "AURA_DECAY_EXPIRED_BEFORE_CLEANUP",
                      periodicReactionLogId: periodicReactionLogId!
                    }
                  : {
                      ...resolvedBase,
                      outcome,
                      resolutionReason:
                        "ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP",
                      periodicReactionLogId: periodicReactionLogId!
                    };
        if (originReactionTaskId === reactionTaskLogId) {
          resolvedWakeTask = true;
        }
      }
      if (!resolvedWakeTask) {
        throw new Error(
          `Aura-v8 EC cleanup wake for reaction task ${reactionTaskLogId} did not resolve its owning task.`
        );
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
        lifecycleScheduleKey(
          targetId,
          generation,
          expectedExpiryFrame,
          event.targetLocalDeadline ?? null
        )
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (
        !auraEngine ||
        !target ||
        auraEngine.isMechanicsTruncated()
      ) {
        continue;
      }
      const targetPhaseV2State =
        materializeTargetPhaseV2Decay(
          event.frame,
          targetId
        );
      const result = auraEngine.expireElectroCharged(
        event.frame,
        generation,
        expectedExpiryFrame
      );
      if (targetPhaseV2Enabled && result.operation === "stale") {
        // Wane, refresh, or an earlier expiry can invalidate this queued token.
        // A stale wake changes no EC state and owns no Reactable.Tick boundary.
        continue;
      }
      const targetStateTimelinePointId =
        targetStateTimelineRecorder.result().points.length;
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
      const periodicReactionLogId = periodicReactionLog.length;
      periodicReactionLog.push({
        id: periodicReactionLogId,
        reaction: "electroCharged",
        generation,
        operation: "stop",
        frame: event.frame,
        ...(targetPhaseV2Enabled
          ? {
              targetFrame: resolveTargetFrameAt(
                targetId,
                event.frame
              )
            }
          : {}),
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
        reason: result.reason,
        ...electroChargedV9Fields(
          result.cadenceStatus,
          result.waneListenerActive
        )
      });
      if (targetPhaseV2State !== null) {
        appendTargetPhaseV2Transition(
          targetPhaseV2State,
          {
            stage: "reactable-tick",
            kind: "electro-charged-expiry",
            generation,
            deadlineTargetFrame:
              event.targetLocalDeadline?.targetFrame ??
              resolveTargetFrameAt(
                targetId,
                expectedExpiryFrame
              ),
            periodicReactionLogId,
            targetStateTimelinePointId
          },
          result.auraAfter
        );
      }
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
        lifecycleScheduleKey(
          targetId,
          generation,
          expectedExpiryFrame,
          event.targetLocalDeadline ?? null
        )
      );
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (!auraEngine || !target) continue;
      const targetPhaseV2State =
        materializeTargetPhaseV2Decay(
          event.frame,
          targetId
        );
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
      const targetStateTimelinePointId =
        targetStateTimelineRecorder.result().points.length;
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
        ...targetBurningLifecycleFields(
          targetId,
          event.frame,
          result.fuelExpiresAtFrame,
          result.nextTickFrame
        ),
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
        clockModel: burningClockModel,
        hitlagStatus: enemyHitlagStatus,
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
          ...targetQuickenLifecycleFields(
            targetId,
            event.frame,
            quickenMutation.expiresAtFrameBefore,
            null
          ),
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
      if (targetPhaseV2State !== null) {
        appendTargetPhaseV2Transition(
          targetPhaseV2State,
          {
            stage: "reactable-tick",
            kind: "burning-fuel-expiry",
            generation,
            deadlineTargetFrame:
              event.targetLocalDeadline?.targetFrame ??
              resolveTargetFrameAt(
                targetId,
                expectedExpiryFrame
              ),
            burningStateLogId,
            quickenStateLogIds:
              quickenStateLogId === null
                ? []
                : [quickenStateLogId],
            targetStateTimelinePointId
          },
          result.auraAfter
        );
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
        (!targetPhaseV2Enabled &&
          (!source || source.generation !== generation)) ||
        auraEngine.isMechanicsTruncated()
      ) {
        continue;
      }
      const prepared = targetPhaseAuditEnabled
        ? auraEngine.prepareBurningTickBeforeDecay(
            event.frame,
            generation,
            tickIndex
          )
        : auraEngine.prepareBurningTick(
            event.frame,
            generation,
            tickIndex
          );
      if (
        targetClockEnabled &&
        prepared.operation === "stale" &&
        prepared.reason === "UNEXPECTED_TICK_FRAME" &&
        prepared.nextTickFrame !== null &&
        prepared.nextTickFrame > event.frame
      ) {
        if (targetPhaseV2Enabled) {
          scheduleTargetDecayThroughOrder(
            prepared.nextTickFrame,
            enemyTargetOrderById.get(targetId) ?? 0
          );
        }
        requeueTargetLocalEvent(
          event,
          prepared.nextTickFrame
        );
        continue;
      }
      // Enemy-owned tasks run before Reactable.Tick in the fixed reference.
      // The callback above decides whether to queue Burning damage from the
      // previous-frame state; only then may current-frame Aura decay run.
      const auraAfterTargetDecay = targetPhaseEnabled
        ? auraEngine.getAuraStateAt(event.frame)
        : prepared.auraAfter;
      const targetTaskPhaseEntry = ensureTargetTaskPhase({
        targetId,
        globalFrame: event.frame,
        wakeKind: "burning-tick",
        eventType: "burningTick",
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: targetPhaseEnabled
          ? nextIntraEventSequence()
          : 0,
        auraBeforeTasks: prepared.auraBefore,
        auraAfterTasks: prepared.auraAfter,
        auraAfterDecay: auraAfterTargetDecay
      });
      const targetPhaseV2State =
        ensureTargetPhaseV2State({
          targetId,
          globalFrame: event.frame,
          emit: true,
          auraBeforeOverride: prepared.auraBefore
        });
      if (targetPhaseV2State !== null) {
        targetPhaseV2State.entry.auraAfterTargetTasks =
          deepClone(prepared.auraAfter);
        targetPhaseV2State.entry.reactableTick.auraBefore =
          deepClone(prepared.auraAfter);
      }
      const targetStateTimelinePointId =
        targetStateTimelineRecorder.result().points.length;
      const targetTaskIntraEventSequence =
        targetPhaseV2Enabled
          ? nextIntraEventSequence()
          : null;
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: target.name,
        cause: "burning-tick",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence:
          targetTaskIntraEventSequence ??
          nextIntraEventSequence(),
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
        auraAfter: targetPhaseV2Enabled
          ? prepared.auraAfter
          : auraAfterTargetDecay
      });
      const targetTaskTimelinePoint =
        targetStateTimelineRecorder.result().points[
          targetStateTimelinePointId
        ];
      if (targetTaskTimelinePoint === undefined) {
        throw new Error(
          `Burning target task could not resolve timeline point ${targetStateTimelinePointId}.`
        );
      }
      const callbackAuraProvenance = targetPhaseV2Enabled
        ? {
            callbackAuraBefore: deepClone(
              targetTaskTimelinePoint.auraBefore
            ),
            callbackAuraAfter: deepClone(
              targetTaskTimelinePoint.auraAfter
            )
          }
        : {};
      const targetPhaseTaskBase: TargetPhaseV2TargetTask | null =
        targetPhaseV2State === null
          ? null
          : {
              stage: "target-task" as const,
              kind: "burning-tick" as const,
              order:
                targetPhaseV2State.entry.targetTasks.length,
              eventType: "burningTick" as const,
              eventPriority: event.priority,
              eventSequence: event.sequence,
              intraEventSequence:
                targetTaskIntraEventSequence ?? 0,
              generation,
              tickIndex,
              deadlineTargetFrame:
                event.targetLocalDeadline?.targetFrame ??
                resolveTargetFrameAt(targetId, event.frame),
              status:
                prepared.operation === "stale"
                  ? ("stale" as const)
                  : ("applied" as const),
              burningStateLogId: null,
              targetStateTimelinePointId
            };
      let targetPhaseV2Task: TargetPhaseV2TargetTask | null = null;
      let targetPhaseV3Task: TargetPhaseV3TargetTask | null = null;
      if (
        targetPhaseV2State !== null &&
        targetPhaseTaskBase !== null
      ) {
        if (targetPhaseV2State.entry.model === "target-phase-v3") {
          targetPhaseV3Task = {
            ...targetPhaseTaskBase,
            delivery: null
          };
          targetPhaseV2State.entry.targetTasks.push(
            targetPhaseV3Task
          );
        } else {
          targetPhaseV2Task = targetPhaseTaskBase;
          targetPhaseV2State.entry.targetTasks.push(
            targetPhaseV2Task
          );
        }
      }
      if (prepared.operation === "stale") continue;
      if (prepared.operation === "stop") {
        const burningStateLogId = burningStateLog.length;
        burningStateLog.push({
          id: burningStateLogId,
          reaction: "burning",
          generation,
          operation: "stop",
          frame: event.frame,
          ...targetBurningLifecycleFields(
            targetId,
            event.frame,
            prepared.fuelExpiresAtFrame,
            null
          ),
          timeSeconds,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          targetId,
          targetName: target.name,
          triggerElement: null,
          damageSourceActorId:
            prepared.damageSourceActorId ??
            source?.actorId ??
            null,
          fuelSourceActorId:
            prepared.fuelSourceActorId ??
            source?.fuelSourceActorId ??
            null,
          triggerDamageEventId:
            source?.triggerDamageEventId ?? null,
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
          ...callbackAuraProvenance,
          auraBefore: deepClone(prepared.auraBefore),
          auraApplied: [],
          auraConsumed: [],
          auraAfter: deepClone(prepared.auraAfter),
          nextTickFrame: null,
          clockModel: burningClockModel,
          hitlagStatus: enemyHitlagStatus,
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
        appendTargetTaskPhaseReference(
          targetTaskPhaseEntry,
          "burningStateLogIds",
          burningStateLogId
        );
        const targetPhaseTask =
          targetPhaseV3Task ?? targetPhaseV2Task;
        if (targetPhaseTask !== null) {
          targetPhaseTask.burningStateLogId = burningStateLogId;
        }
        activeBurningSources.delete(targetId);
        continue;
      }

      if (source === undefined) {
        throw new Error(
          `Applied Burning callback for target "${targetId}" has no source snapshot.`
        );
      }
      const burningStateLogId = burningStateLog.length;
      burningStateLog.push({
        id: burningStateLogId,
        reaction: "burning",
        generation,
        operation: prepared.operation,
        frame: event.frame,
        ...targetBurningLifecycleFields(
          targetId,
          event.frame,
          prepared.fuelExpiresAtFrame,
          prepared.nextTickFrame
        ),
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
        ...callbackAuraProvenance,
        auraBefore: copyGeneratedAuraStates(prepared.auraBefore),
        auraApplied: [],
        auraConsumed: [],
        auraAfter: copyGeneratedAuraStates(prepared.auraAfter),
        nextTickFrame: prepared.nextTickFrame,
        clockModel: burningClockModel,
        hitlagStatus: enemyHitlagStatus,
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
      appendTargetTaskPhaseReference(
        targetTaskPhaseEntry,
        "burningStateLogIds",
        burningStateLogId
      );
      const targetPhaseTask =
        targetPhaseV3Task ?? targetPhaseV2Task;
      if (targetPhaseTask !== null) {
        targetPhaseTask.burningStateLogId = burningStateLogId;
      }
      if (prepared.operation === "tick") {
        const scheduledDelivery = scheduleBurningDamage({
          frame: event.frame,
          targetId,
          generation,
          tickIndex,
          source,
          burningStateLogId,
          nextTickFrame: prepared.nextTickFrame
        });
        if (targetPhaseV3Task !== null) {
          if (scheduledDelivery.eventSequence === null) {
            throw new Error(
              `Inline Burning callback at frame ${event.frame} failed to queue its zero-delay delivery.`
            );
          }
          const ownerTargetOrder =
            enemyTargetOrderById.get(targetId);
          if (ownerTargetOrder === undefined) {
            throw new Error(
              `Burning callback delivery could not resolve owner target order for "${targetId}".`
            );
          }
          const delivery: TargetPhaseV3Delivery = {
            model: "burning-callback-zero-delay-v1",
            reactionDamageLogId:
              scheduledDelivery.reactionDamageLogId,
            eventPriority: scheduledDelivery.eventPriority,
            eventSequence: scheduledDelivery.eventSequence,
            attempts: []
          };
          targetPhaseV3Task.delivery = delivery;
          burningRootInlineDeliveryByReactionDamageLogId.set(
            scheduledDelivery.reactionDamageLogId,
            { ownerTargetOrder, delivery }
          );
        }
      }
      if (prepared.nextTickFrame !== null) {
        scheduleBurningTickEvent(
          targetId,
          generation,
          tickIndex + 1,
          prepared.nextTickFrame
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
      let cadenceStatus: "scheduled" | "dormant" | "stopped" | undefined;
      let waneListenerActive: boolean | undefined;
      if (firstTick) {
        source = pinnedSource;
        const firstDamageState = auraV9Enabled
          ? auraEngine.prepareElectroChargedFirstDamage(event.frame, generation)
          : null;
        const auraState =
          firstDamageState?.auraAfter ?? auraEngine.getAuraStateAt(event.frame);
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
        const streamOwnsGeneration = activeSource?.generation === generation;
        const streamContinues = streamOwnsGeneration && coexistencePresent;
        const cleanupPending =
          (config.reactionEngine?.mode === "aura-v8" ||
            config.reactionEngine?.mode === "aura-v9") &&
          activeSource?.generation === generation &&
          reactionTaskLog.some(
            (task) =>
              task.targetId === targetId &&
              task.electroChargedCleanup?.outcome === "pending-at-end" &&
              task.electroChargedCleanup.generation === generation
          );
        nextTickFrame = auraV9Enabled
          ? streamOwnsGeneration
            ? (firstDamageState?.nextTickFrame ?? null)
            : null
          : streamContinues
            ? event.frame +
              AURA_ENGINE_CONSTANTS.electroChargedTickIntervalFrames
            : null;
        // A pinned first tick may outlive its original stream. It must never
        // wane a replacement generation in aura-v8. Historical Aura modes
        // retain their frozen coexistence-only Wane contract.
        waneEligible = auraV9Enabled
          ? streamOwnsGeneration &&
            coexistencePresent &&
            firstDamageState?.waneListenerActive === true
          : config.reactionEngine?.mode === "aura-v8"
            ? streamContinues
            : coexistencePresent;
        tickReason = streamContinues
          ? null
          : activeSource === undefined
            ? "QUEUED_FIRST_TICK_AFTER_STREAM_STOP"
            : activeSource.generation !== generation
              ? "QUEUED_FIRST_TICK_AFTER_STREAM_REPLACED"
              : cleanupPending
                ? "QUEUED_FIRST_TICK_WHILE_CLEANUP_PENDING"
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
        cadenceStatus = auraV9Enabled
          ? streamOwnsGeneration
            ? firstDamageState?.cadenceStatus
            : "stopped"
          : undefined;
        waneListenerActive = auraV9Enabled
          ? streamOwnsGeneration
            ? firstDamageState?.waneListenerActive
            : false
          : undefined;
        if (auraV9Enabled && streamOwnsGeneration) {
          syncPendingElectroChargedCleanupCadence({
            targetId,
            generation,
            cadenceStatus: firstDamageState?.cadenceStatus,
            nextTickFrame,
            waneListenerActive: firstDamageState?.waneListenerActive,
            lastCallbackFrame: firstDamageState?.lastCallbackFrame,
          });
        }
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
        if (auraV9Enabled && prepared.operation !== "stale") {
          syncPendingElectroChargedCleanupCadence({
            targetId,
            generation,
            cadenceStatus: prepared.cadenceStatus,
            nextTickFrame: prepared.nextTickFrame,
            waneListenerActive: prepared.waneListenerActive,
            lastCallbackFrame: prepared.lastCallbackFrame,
          });
        }
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
            tickIndex: null,
            auraBefore: prepared.auraBefore,
            auraConsumed: prepared.auraConsumed,
            auraAfter: prepared.auraAfter,
            nextTickFrame: null,
            coexistenceExpiresAtFrame: null,
            waneFrame: null,
            reason: prepared.reason,
            ...electroChargedV9Fields(
              prepared.cadenceStatus,
              prepared.waneListenerActive
            )
          });
          if (activeSource?.generation === generation) {
            activePeriodicReactionSources.delete(targetId);
          }
          continue;
        }
        if (prepared.operation === "tick-skipped") {
          periodicReactionLog.push({
            id: periodicReactionLog.length,
            reaction: "electroCharged",
            generation,
            operation: "tick-skipped",
            frame: event.frame,
            timeSeconds,
            targetId,
            targetName: target.name,
            sourceActorId: activeSource.actorId,
            triggerDamageEventId: activeSource.triggerDamageEventId,
            reactionDamageLogId: null,
            damageEventId: null,
            tickIndex,
            auraBefore: prepared.auraBefore,
            auraConsumed: prepared.auraConsumed,
            auraAfter: prepared.auraAfter,
            nextTickFrame: null,
            coexistenceExpiresAtFrame: null,
            waneFrame: null,
            reason: prepared.reason,
            ...electroChargedV9Fields(
              prepared.cadenceStatus,
              prepared.waneListenerActive,
            ),
          });
          continue;
        }
        source = activeSource;
        auraBefore = prepared.auraBefore;
        auraAfter = prepared.auraAfter;
        nextTickFrame = prepared.nextTickFrame;
        coexistenceExpiresAtFrame =
          prepared.coexistenceExpiresAtFrame;
        tickReason = prepared.reason;
        cadenceStatus = prepared.cadenceStatus;
        waneListenerActive =
          prepared.waneListenerActive;
        waneEligible = auraV9Enabled
          ? prepared.waneListenerActive === true
          : true;
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
        reason: tickReason,
        ...electroChargedV9Fields(
          cadenceStatus,
          waneListenerActive
        )
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
      if (nextTickFrame !== null && !(auraV9Enabled && firstTick)) {
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
        generation,
        sourceActorId,
        triggerDamageEventId,
        damageEventId,
        tickIndex,
        damageApplied
      } = event.payload as PeriodicReactionWaneEventPayload;
      const generationBoundWane =
        config.reactionEngine?.mode === "aura-v8" ||
        config.reactionEngine?.mode === "aura-v9";
      if (generationBoundWane) {
        const activeSource =
          activePeriodicReactionSources.get(targetId);
        if (activeSource?.generation !== generation) {
          continue;
        }
      }
      const auraEngine = auraEngines?.get(targetId);
      const target = enemyTargetById.get(targetId);
      if (
        !auraEngine ||
        !target ||
        auraEngine.isMechanicsTruncated()
      ) {
        continue;
      }
      const result = generationBoundWane
        ? auraEngine.waneElectroCharged(
            event.frame,
            generation,
            damageApplied
          )
        : auraEngine.waneElectroCharged(
            event.frame,
            damageApplied
          );
      if (
        generationBoundWane &&
        result.operation === "stale"
      ) {
        continue;
      }
      if (auraV9Enabled) {
        syncPendingElectroChargedCleanupCadence({
          targetId,
          generation,
          cadenceStatus: result.cadenceStatus,
          nextTickFrame: result.nextTickFrame,
          waneListenerActive: result.waneListenerActive,
          lastCallbackFrame: result.lastCallbackFrame,
        });
      }
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
        reason: result.reason,
        ...electroChargedV9Fields(
          result.cadenceStatus,
          result.waneListenerActive
        )
      });
      if (
        result.operation === "stop" ||
        (result.operation === "wane" &&
          result.coexistenceExpiresAtFrame === null)
      ) {
        if (!generationBoundWane) {
          activePeriodicReactionSources.delete(targetId);
        } else if (
          activePeriodicReactionSources.get(targetId)
            ?.generation === generation
        ) {
          activePeriodicReactionSources.delete(targetId);
        }
      } else {
        schedulePeriodicReactionExpiry(
          targetId,
          result.generation,
          result.coexistenceExpiresAtFrame
        );
      }
      continue;
    }

    if (event.type === "reactionAuraAttachment") {
      if (!deferredSwirlAuraAttachmentEnabled) {
        throw new Error(
          "A deferred Swirl Aura attachment escaped the basic reaction scheduler v2 boundary."
        );
      }
      const {
        token,
        attackSchedulerLogId,
        parentEventSequence,
        reactionDamageLogId,
        hitResolutionLogId,
        elementalApplicationIcdLogId,
        sourceActorId,
        targetId,
        element
      } = event.payload as ReactionAuraAttachmentEventPayload;
      const targetProfile = enemyTargetById.get(targetId);
      const targetAuraEngine = auraEngines?.get(targetId);
      const attackLog = basicReactionSchedulerLog[attackSchedulerLogId];
      if (
        targetProfile === undefined ||
        targetAuraEngine === undefined ||
        attackLog === undefined ||
        attackLog.kind !== "swirl-attack-resolution" ||
        attackLog.disposition !== "deferred" ||
        attackLog.pairedLogId !== -1 ||
        attackLog.eventSequence !== parentEventSequence ||
        attackLog.parentEventSequence !== parentEventSequence ||
        attackLog.reactionDamageLogId !== reactionDamageLogId ||
        attackLog.hitResolutionLogId !== hitResolutionLogId ||
        attackLog.elementalApplicationIcdLogId !==
          elementalApplicationIcdLogId ||
        attackLog.sourceActorId !== sourceActorId ||
        attackLog.targetId !== targetId ||
        attackLog.element !== element ||
        attackLog.frame !== event.frame ||
        event.sequence <= parentEventSequence
      ) {
        throw new Error(
          `Deferred Swirl Aura attachment for scheduler log ${attackSchedulerLogId} is missing or mismatched.`
        );
      }

      const attachment =
        targetAuraEngine.commitDeferredReactionOwnedAttachment(token);
      if (
        attachment.frame !== event.frame ||
        attachment.sourceActorId !== sourceActorId ||
        attachment.element !== element
      ) {
        throw new Error(
          `Deferred Swirl Aura attachment for scheduler log ${attackSchedulerLogId} returned mismatched Aura ownership.`
        );
      }
      const attachmentLogId = basicReactionSchedulerLog.length;
      basicReactionSchedulerLog.push({
        id: attachmentLogId,
        kind: "deferred-aura-attachment",
        frame: event.frame,
        timeSeconds,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        parentEventSequence,
        reactionDamageLogId,
        hitResolutionLogId,
        elementalApplicationIcdLogId,
        sourceActorId,
        targetId,
        element,
        reaction: "none",
        reactions: [],
        auraBefore: deepClone(attachment.auraBefore),
        auraApplied: deepClone(attachment.auraApplied),
        auraConsumed: [],
        auraAfter: deepClone(attachment.auraAfter),
        pairedLogId: attackSchedulerLogId,
        disposition: "committed"
      });
      attackLog.pairedLogId = attachmentLogId;
      targetStateTimelineRecorder.recordEvent({
        frame: event.frame,
        timeSeconds,
        targetId,
        targetName: targetProfile.name,
        cause: "reaction-aura-attachment",
        eventType: event.type,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        intraEventSequence: nextIntraEventSequence(),
        reaction: "none",
        reactions: [],
        primaryDamageEventId: null,
        links: [
          {
            kind: "basic-reaction-scheduler-log",
            id: attachmentLogId
          }
        ],
        auraBefore: attachment.auraBefore,
        auraApplied: attachment.auraApplied,
        auraConsumed: [],
        auraAfter: attachment.auraAfter
      });
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
        reactionApplication,
        excludedTargetIds = [],
        swirlContext,
        dendroCoreContext
      } = event.payload as ReactionDamageEventPayload;
      const sourceActor = characters.get(actorId);
      const reactionLog = reactionDamageLog[reactionDamageLogId];
      if (!sourceActor || !reactionLog) continue;
      if((runtimeOptions[directHitStepWitnessSink] !== undefined || runtimeOptions[eventStepProtocol]) && targetingMode === 'electro-charged-nearby-wet') {
        observedPropagation={frame:event.frame,eventPriority:event.priority,eventSequence:event.sequence,
          reactionDamageLogId,sourceActorId:actorId,sourceTargetId,triggerDamageEventId,
          allocationCount:intraEventSequence,operations:[]};
        propagationStepEvents.push(observedPropagation);
      }
      const burningRootInlineDeliveryState =
        burningRootInlineDeliveryByReactionDamageLogId.get(
          reactionDamageLogId
        );
      if (
        burningRootInlineDeliveryState !== undefined &&
        (!targetPhaseV3Enabled ||
          reaction !== "burning" ||
          burningContext === undefined)
      ) {
        throw new Error(
          `Inline Burning delivery ${reactionDamageLogId} escaped its target-phase-v3 root callback.`
        );
      }
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
      if (dendroCoreContext !== undefined) lunarArtifactRuntime?.ordinaryReactionRead(actorId, event.frame);
      const reactionBonus =
        dendroCoreContext === undefined
          ? scheduledReactionBonus
          : stats.reactionBonus +
            dendroCoreContext.reactionBonusDelta + artifactReactionBonus(actorId, reaction, event.frame);
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
      let electroChargedPropagationAudit:
        | ElectroChargedPropagationAudit
        | null = null;
      let electroChargedPropagationCandidateByTargetId:
        | Map<
            string,
            ElectroChargedPropagationCandidateAudit
          >
        | null = null;
      if (targetingMode === "electro-charged-nearby-wet") {
        if (
          reaction !== "electroCharged" ||
          periodicContext === undefined ||
          config.electroChargedPropagationModel.mode !==
            "nearby-wet-radius-v1" ||
          config.electroChargedPropagationModel.radius !== radius
        ) {
          throw new Error(
            "Electro-Charged nearby-Wet targeting requires a matching periodic context and configured propagation radius."
          );
        }

        const sourcePosition = resolveTargetPosition(
          sourceTargetId,
          event.frame
        );
        resolvedReactionCenterPosition =
          sourcePosition === null
            ? null
            : deepClone(sourcePosition);
        reactionLog.centerPosition =
          sourcePosition === null
            ? null
            : deepClone(sourcePosition);

        const orderedTargets = [
          enemyTargetById.get(sourceTargetId),
          ...enemyTargets.filter(
            (target) => target.id !== sourceTargetId
          )
        ].filter(
          (
            target
          ): target is SimulationResult["enemyTargets"][number] =>
            target !== undefined
        );
        const candidates: ElectroChargedPropagationCandidateAudit[] =
          orderedTargets.map((target) => {
            // The P5 propagation read is an incoming observation. Settle the
            // target-owned v2 lifecycle first so an exact-frame natural expiry
            // is logged rather than silently disappearing inside getAuraStateAt.
            materializeTargetPhaseV2Decay(
              event.frame,
              target.id
            );
            const aura =
              auraEngines
                ?.get(target.id)
                ?.getAuraStateAt(event.frame) ?? [];
            const hydroGaugeUnits =
              aura.find(
                (entry) => entry.element === "hydro"
              )?.gaugeUnits ?? 0;
            const auraObservationTimelinePointId =
              targetStateTimelineRecorder.recordEvent({
                frame: event.frame,
                timeSeconds,
                targetId: target.id,
                targetName: target.name,
                cause:
                  "electro-charged-propagation-candidate",
                eventType: "reactionDamage",
                eventPriority: event.priority,
                eventSequence: event.sequence,
                intraEventSequence:
                  nextIntraEventSequence({kind:'propagation-candidate',reactionDamageLogId,targetId:target.id}),
                reaction: "electroCharged",
                reactions: ["electroCharged"],
                primaryDamageEventId: null,
                links: [
                  {
                    kind: "reaction-damage-log",
                    id: reactionDamageLogId
                  }
                ],
                auraBefore: aura,
                auraAfter: aura
              });
            const position = resolveTargetPosition(
              target.id,
              event.frame
            );
            const base = {
              targetId: target.id,
              targetName: target.name,
              targetOrder:
                enemyTargetOrderById.get(target.id) ?? 0,
              hydroGaugeUnits,
              position:
                position === null
                  ? null
                  : deepClone(position),
              auraObservationTimelinePointId,
              hitResolutionLogId: null,
              damageEventId: null
            };

            if (target.id === sourceTargetId) {
              return {
                ...base,
                distance: null,
                threshold: null,
                selected: true,
                reason: "SOURCE_STREAM_TARGET"
              };
            }
            if (hydroGaugeUnits <= 1e-10) {
              return {
                ...base,
                distance: null,
                threshold: null,
                selected: false,
                reason: "NO_HYDRO_AURA"
              };
            }
            if (sourcePosition === null) {
              reactionLog.unresolvedTargetIds.push(target.id);
              return {
                ...base,
                distance: null,
                threshold: null,
                selected: false,
                reason: "SOURCE_POSITION_UNRESOLVED"
              };
            }
            if (position === null) {
              reactionLog.unresolvedTargetIds.push(target.id);
              return {
                ...base,
                distance: null,
                threshold: null,
                selected: false,
                reason: "POSITION_UNRESOLVED"
              };
            }

            const geometryResolution = resolveHitGeometry(
              {
                kind: "circle",
                coordinateSpace: "world",
                origin: sourcePosition,
                radius
              },
              position,
              target.hitboxRadius
            );
            return {
              ...base,
              distance: geometryResolution.distance,
              threshold: geometryResolution.threshold,
              selected: geometryResolution.landed,
              reason: geometryResolution.landed
                ? "NEARBY_WET_IN_RANGE"
                : "OUT_OF_RANGE"
            };
          });
        const audit: ElectroChargedPropagationAudit = {
          model: "nearby-wet-radius-v1",
          verificationStatus: "provisional",
          mechanicsDataStatus: "community-provisional",
          generation: periodicContext.generation,
          tickIndex: periodicContext.tickIndex,
          evaluationFrame: event.frame,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          radius,
          selectionMode:
            "all-in-range-registration-order-v1",
          sourcePosition:
            sourcePosition === null
              ? null
              : deepClone(sourcePosition),
          candidates
        };
        electroChargedPropagationAudit = audit;
        electroChargedPropagationCandidateByTargetId =
          new Map(
            candidates.map((candidate) => [
              candidate.targetId,
              candidate
            ])
          );
        reactionLog.electroChargedPropagation = audit;
      }
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
          enemyTargets.filter(target => !targetHealthRuntime?.isDefeated(target.id)).map((target) => ({
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
      if (
        targetingMode === "electro-charged-nearby-wet"
      ) {
        if (electroChargedPropagationAudit === null) {
          throw new Error(
            "Electro-Charged nearby-Wet targeting is missing its P5 candidate audit."
          );
        }
        for (const candidate of
          electroChargedPropagationAudit.candidates) {
          if (!candidate.selected) continue;
          spatialPlans.push({
            targetId: candidate.targetId,
            targetPosition:
              candidate.position === null
                ? null
                : deepClone(candidate.position),
            landed: true,
            reason: null,
            distance: candidate.distance,
            threshold: candidate.threshold,
            targetingSource:
              candidate.targetId === sourceTargetId
                ? "reaction-source"
                : "reaction-geometry"
          });
        }
      } else if (targetingMode === "single-target") {
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

      const inlineDeliveryLinksByTargetId =
        burningRootInlineDeliveryState === undefined
          ? null
          : new Map<
              string,
              {
                hitResolutionLogId: number;
                damageEventId: number | null;
                elementalApplicationIcdLogId: number | null;
                targetStateTimelinePointId: number | null;
              }
            >();
      let periodicDamageEventId: number | null = null;
      let periodicActualDamage = 0;
      const reactionHitResolutionLogIds: number[] = [];
      const reactionTriggerDamageEventIds: number[] = [];
      spatialPlans.forEach((plan, targetIndex) => {
        const targetProfile = enemyTargetById.get(plan.targetId);
        if (!targetProfile) return;
        if (targetHealthRuntime?.isDefeated(plan.targetId)) {
          plan.landed = false;
          plan.reason = "TARGET_DEFEATED";
        }
        const targetAuraEngine =
          auraEngines?.get(plan.targetId) ?? null;
        const targetTaskPhaseEntry = ensureTargetTaskPhase({
          targetId: plan.targetId,
          globalFrame: event.frame,
          wakeKind: "incoming",
          eventType: "reactionDamage",
          eventPriority: event.priority,
          eventSequence: event.sequence,
          intraEventSequence: targetPhaseEnabled
            ? nextIntraEventSequence()
            : 0
        });
        const targetPhaseV2State =
          ensureTargetPhaseV2State({
            targetId: plan.targetId,
            globalFrame: event.frame,
            emit: true
          });
        const targetPhaseV2Entry =
          targetPhaseV2State?.entry ?? null;
        let inlineApplicationPhase:
          | "before-reactable-tick"
          | "after-reactable-tick"
          | null = null;
        if (burningRootInlineDeliveryState !== undefined) {
          const planTargetOrder =
            enemyTargetOrderById.get(plan.targetId);
          if (planTargetOrder === undefined) {
            throw new Error(
              `Reaction damage could not resolve target order for "${plan.targetId}".`
            );
          }
          inlineApplicationPhase =
            planTargetOrder <
            burningRootInlineDeliveryState.ownerTargetOrder
              ? "after-reactable-tick"
              : "before-reactable-tick";
        }
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
        const damageAllowed =
          plan.landed &&
          activeTargetPhase?.effects.damage !== "immune";
        const appendParentReactionHitResolution =
          (): SimulationResult["hitResolutionLog"][number] => {
            const targetResolutionId =
              hitResolutionLog.length;
            const targetResolution: SimulationResult["hitResolutionLog"][number] =
              {
                id: targetResolutionId,
                reactionDamageLogId,
                elementalApplicationIcdLogId: null,
                frame: event.frame,
                timeSeconds,
                eventPriority: event.priority,
                eventSequence: event.sequence,
                intraEventSequence,
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
                targetPosition: deepClone(
                  plan.targetPosition
                ),
                sourceActorPosition: null,
                sourceActorFacingDegrees: null,
                geometryKind:
                  plan.targetingSource ===
                  "reaction-geometry"
                    ? "circle"
                    : null,
                geometryCoordinateSpace:
                  plan.targetingSource ===
                  "reaction-geometry"
                    ? "world"
                    : null,
                geometryOrigin:
                  plan.targetingSource ===
                  "reaction-geometry"
                    ? deepClone(
                        resolvedReactionCenterPosition
                      )
                    : null,
                geometryStart: null,
                geometryEnd: null,
                geometryRadius:
                  plan.targetingSource ===
                  "reaction-geometry"
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
                targetPhaseId:
                  activeTargetPhase?.id ?? null,
                damageAllowed,
                mechanicsStatus,
                auraAllowed:
                  plan.landed &&
                  reactionApplication !== undefined &&
                  reactionDamageAuraAllowed,
                hitConfirmAllowed: false,
                damageEventId: null,
                potentialDamage: 0,
                finalDamage: 0,
                displayDamage: 0,
                ...(action.timelineCommandIndex ===
                undefined
                  ? {}
                  : {
                      timelineCommandIndex:
                        action.timelineCommandIndex
                    }),
                ...(action.sourceAbilityId === undefined
                  ? {}
                  : {
                      sourceAbilityId:
                        action.sourceAbilityId
                    })
              };
            if(observedPropagation) observedPropagation.operations.push({operation:'observe-hit',sequence:intraEventSequence,hitResolutionLogId:targetResolutionId,targetId:plan.targetId});
            hitResolutionLog.push(targetResolution);
            reactionHitResolutionLogIds.push(targetResolutionId);
            reactionLog.hitResolutionLogIds.push(targetResolutionId);
            if (
              targetTaskPhaseEntry?.wakeKind === "incoming" &&
              targetTaskPhaseEntry.eventType === "reactionDamage"
            ) {
              appendTargetTaskPhaseReference(
                targetTaskPhaseEntry,
                "hitResolutionLogIds",
                targetResolutionId
              );
            }
            if (burningRootInlineDeliveryState === undefined) {
              appendTargetPhaseV2Reference(
                targetPhaseV2Entry,
                "hitResolutionLogIds",
                targetResolutionId
              );
            }
            return targetResolution;
          };
        let targetResolution:
          | SimulationResult["hitResolutionLog"][number]
          | null = recursiveShatterDeliveryEnabled
          ? appendParentReactionHitResolution()
          : null;
        let pendingDeferredSwirlAttachment:
          | DeferredReactionOwnedAttachmentToken
          | null = null;
        const resolvePropagatedReactionAudit =
          (): ReactionAudit | null => {
            if (
              !plan.landed ||
              !reactionDamageAuraAllowed ||
              targetAuraEngine === null ||
              reactionApplication === undefined ||
              mechanicsTruncatedBefore
            ) {
              return null;
            }
            if (
              deferredSwirlAuraAttachmentEnabled &&
              burningRootInlineDeliveryState === undefined &&
              reactionApplication.channel.kind === "swirl-propagation"
            ) {
              const deferred =
                targetAuraEngine.processReactionOwnedHitWithDeferredNonReactedAttachment(
                  {
                    frame: event.frame,
                    sourceActorId: actorId,
                    channel: reactionApplication.channel,
                    nominalGaugeUnits:
                      reactionApplication.nominalGaugeUnits
                  }
                );
              pendingDeferredSwirlAttachment =
                deferred.pendingAttachment;
              return projectPlayerSelfDamageStatus(
                deferred.reactionAudit
              );
            }
            return projectPlayerSelfDamageStatus(
              burningRootInlineDeliveryState === undefined
                ? targetAuraEngine.processReactionOwnedHit(
                    reactionApplication.channel.kind === "burning-tick"
                      ? {
                          frame: event.frame,
                          sourceActorId: actorId,
                          channel: reactionApplication.channel
                        }
                      : {
                          frame: event.frame,
                          sourceActorId: actorId,
                          channel: reactionApplication.channel,
                          nominalGaugeUnits:
                            reactionApplication.nominalGaugeUnits
                        }
                  )
                : targetAuraEngine.processReactionOwnedHitAtCurrentTargetState(
                    reactionApplication.channel.kind === "burning-tick"
                      ? {
                          frame: event.frame,
                          sourceActorId: actorId,
                          channel: reactionApplication.channel
                        }
                      : {
                          frame: event.frame,
                          sourceActorId: actorId,
                          channel: reactionApplication.channel,
                          nominalGaugeUnits:
                            reactionApplication.nominalGaugeUnits
                        }
                  )
            );
          };
        let propagatedReactionAudit = recursiveShatterDeliveryEnabled
          ? null
          : resolvePropagatedReactionAudit();
        const readReactionApplicationIcdDecision =
          (): Readonly<ReactionOwnedElementalApplicationIcdDecisionV149> | null => {
            if (reactionApplication === undefined) return null;
            if (targetAuraEngine === null) {
              throw new Error(
                `Reaction-owned application "${resolvedReactionHitGroupId}" cannot be delivered on target "${plan.targetId}" without an Aura engine.`
              );
            }
            if (!plan.landed) {
              return skippedReactionOwnedElementalApplicationDecision("miss");
            }
            if (!reactionDamageAuraAllowed) {
              return skippedReactionOwnedElementalApplicationDecision(
                "target-aura-blocked"
              );
            }
            if (mechanicsTruncatedBefore) {
              return skippedReactionOwnedElementalApplicationDecision(
                "mechanics-truncated"
              );
            }
            const decision =
              targetAuraEngine.getLastReactionOwnedElementalApplicationIcdDecision();
            if (decision === null) {
              throw new Error(
                `Aura engine did not expose a reaction-owned elemental-application ICD decision for "${resolvedReactionHitGroupId}" on target "${plan.targetId}".`
              );
            }
            return decision;
          };
        let reactionApplicationIcdDecision = recursiveShatterDeliveryEnabled
          ? null
          : readReactionApplicationIcdDecision();
        const synchronizeInlinePreReactableAura = (): void => {
          if (
            inlineApplicationPhase !== "before-reactable-tick" ||
            targetPhaseV2State === null ||
            !plan.landed ||
            targetAuraEngine === null
          ) {
            return;
          }
          if (targetPhaseV2State.decayMaterialized) {
            throw new Error(
              `Inline Burning delivery reached target "${plan.targetId}" after its Reactable.Tick boundary.`
            );
          }
          const auraAfterInlineApplication =
            propagatedReactionAudit?.auraAfter ??
            readReactionApplicationAura(
              targetAuraEngine,
              event.frame,
              true
            );
          if (
            targetPhaseV2State.entry.targetTasks.length === 0 &&
            !targetPhaseV2State.hasBeforeReactableInlineDelivery
          ) {
            const auraBeforeInlineApplication =
              propagatedReactionAudit?.auraBefore ??
              readReactionApplicationAura(
                targetAuraEngine,
                event.frame,
                true
              );
            targetPhaseV2State.entry.auraBeforeTargetTasks =
              deepClone(auraBeforeInlineApplication);
          }
          targetPhaseV2State.entry.auraAfterTargetTasks =
            deepClone(auraAfterInlineApplication);
          targetPhaseV2State.entry.reactableTick.auraBefore =
            deepClone(auraAfterInlineApplication);
          targetPhaseV2State.hasBeforeReactableInlineDelivery =
            true;
        };
        if (!recursiveShatterDeliveryEnabled) {
          synchronizeInlinePreReactableAura();
        }
        let pendingReactionDamageEventId =
          damageEvents.length;
        let reactionDamageApplicationTimelinePointId: number | null =
          null;
        const recordReactionDamageApplication = (): void => {
          if (propagatedReactionAudit !== null) {
            reactionDamageApplicationTimelinePointId =
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
                primaryDamageEventId:
                  pendingReactionDamageEventId,
                links: [
                  {
                    kind: "damage-event",
                    id: pendingReactionDamageEventId
                  },
                  {
                    kind: "reaction-damage-log",
                    id: reactionDamageLogId
                  },
                  ...(propagatedReactionAudit
                    .mechanicsTruncation === null
                    ? projectedQuickenDecayRebaseLogIds(
                        propagatedReactionAudit
                      ).map((id) => ({
                        kind: "quicken-state-log" as const,
                        id
                      }))
                    : [])
                ],
                auraBefore:
                  propagatedReactionAudit.auraBefore ?? [],
                auraApplied:
                  propagatedReactionAudit.auraApplied ?? [],
                auraConsumed:
                  propagatedReactionAudit.auraConsumed ?? [],
                auraAfter:
                  propagatedReactionAudit.auraAfter ?? []
              });
          } else if (
            targetPhaseAuditEnabled &&
            plan.landed &&
            targetAuraEngine !== null
          ) {
            const aura =
              readReactionApplicationAura(
                targetAuraEngine,
                event.frame,
                burningRootInlineDeliveryState !== undefined
              );
            reactionDamageApplicationTimelinePointId =
              targetStateTimelineRecorder.recordEvent({
                frame: event.frame,
                timeSeconds,
                targetId: plan.targetId,
                targetName: targetProfile.name,
                cause: "reaction-damage-application",
                eventType: event.type,
                eventPriority: event.priority,
                eventSequence: event.sequence,
                intraEventSequence: nextIntraEventSequence(electroChargedPropagationAudit !== null ? {kind:'propagation-application',reactionDamageLogId,targetId:plan.targetId,damageEventId:pendingReactionDamageEventId} : undefined),
                reaction:
                  electroChargedPropagationAudit !== null
                    ? "electroCharged"
                    : "none",
                reactions:
                  electroChargedPropagationAudit !== null
                    ? ["electroCharged"]
                    : [],
                primaryDamageEventId:
                  pendingReactionDamageEventId,
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
                auraBefore: aura,
                auraAfter: aura
              });
          }
        };
        if (!recursiveShatterDeliveryEnabled) {
          recordReactionDamageApplication();
        }
        const swirlDamageGroup =
          plan.landed && swirlContext !== undefined
            ? resolveSwirlDamageGroup({
                targetId: plan.targetId,
                actorId,
                reaction: swirlContext.reaction,
                damageSourceId: sourceTargetId,
                frame: event.frame,
                taskSequence: event.sequence,
              })
            : null;
        if (swirlDamageGroup !== null) {
          reactionLog.damageGroupDecisions.push(swirlDamageGroup);
          if (!swirlDamageGroup.damageAllowed) {
            reactionLog.damageGroupBlockedTargetIds.push(plan.targetId);
          }
        }
        const dendroCoreDamageGroupDecision =
          plan.landed && dendroCoreContext !== undefined
            ? consumeReactionADamageGroup({
                targetId: plan.targetId,
                actorId,
                reaction: dendroCoreContext.reaction,
                damageSourceId: `dendro-core-${dendroCoreContext.coreId}`,
                frame: event.frame,
                taskSequence: event.sequence,
              })
            : null;
        const dendroCoreDamageGroupAudit = dendroCoreDamageGroupDecision;
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
            ? consumeReactionADamageGroup({
                targetId: plan.targetId,
                actorId,
                reaction: "shatter",
                damageSourceId: sourceTargetId,
                frame: event.frame,
                taskSequence: event.sequence,
              })
            : null;
        const shatterDamageGroupAudit = shatterDamageGroupDecision;
        const superconductDamageGroupDecision =
          plan.landed && reaction === "superconduct"
            ? consumeReactionADamageGroup({
                targetId: plan.targetId,
                actorId,
                reaction: "superconduct",
                damageSourceId: sourceTargetId,
                frame: event.frame,
                taskSequence: event.sequence,
              })
            : null;
        const superconductDamageGroupAudit = superconductDamageGroupDecision;
        const reactionBDamageGroupDecision =
          plan.landed &&
          (reaction === "overload" || reaction === "electroCharged")
            ? consumeReactionBDamageGroup({
                targetId: plan.targetId,
                actorId,
                reaction,
                damageSourceId: sourceTargetId,
                frame: event.frame,
                taskSequence: event.sequence,
              })
            : null;
        const reactionBDamageGroupAudit = reactionBDamageGroupDecision;
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
          targetAuraEngine !== null &&
          // The v3 root is fixed Pyro/default-strike damage and therefore
          // cannot Shatter. Avoid the legacy helper's time-aware Aura advance
          // before this callback-owned microstep reaches Reactable.Tick.
          burningRootInlineDeliveryState === undefined;
        const nestedShatterState =
          shatterCheckAllowed
            ? targetAuraEngine.processShatterHit({
                  frame: event.frame,
                  element: damageElement,
                  strikeType,
                  poiseDamage
                })
            : null;
        if (
          recursiveShatterDeliveryEnabled &&
          nestedShatterState?.audit.triggered === true &&
          nestedShatterState.audit.scheduled &&
          nestedShatterState.audit.damageFrame <=
            Math.round(config.duration * 60)
        ) {
          pendingReactionDamageEventId =
            damageEvents.length + 1;
        }
        if (nestedShatterState?.audit.triggered) handleArtifactReactions(["shatter"], actorId, event.frame, { parentDamageEventId: pendingReactionDamageEventId });
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
            readReactionApplicationAura(
              targetAuraEngine,
              event.frame,
              burningRootInlineDeliveryState !== undefined
            )
          );
        }
        if (
          recursiveShatterDeliveryEnabled &&
          nestedShatterState !== null
        ) {
          recordShatterFrozenState({
            result: nestedShatterState,
            targetId: plan.targetId,
            targetName: targetProfile.name,
            sourceActorId: actorId,
            triggerDamageEventId:
              pendingReactionDamageEventId,
            frame: event.frame,
            timeSeconds,
            freezeResistance:
              targetProfile.freezeResistance,
            triggerEventType: event.type,
            triggerEventPriority: event.priority,
            triggerEventSequence: event.sequence,
            nextIntraEventSequence,
          });
          if (nestedShatterState.audit.triggered) {
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
              triggerHitGroupId:
                resolvedReactionHitGroupId,
              triggerDamageEventId:
                pendingReactionDamageEventId,
              sourceTargetId: plan.targetId,
              stats: shatterSourceStats,
              reactionBonus:
                shatterSourceStats.reactionBonus +
                shatterReactionBonusDelta,
              sourceBuffStatuses: activeBuffs
                .filter(
                  (buff) => buff.targetId === actorId
                )
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
              triggerFrame: event.frame,
              eventPriority: event.priority,
              eventSequence: event.sequence,
              nextIntraEventSequence
            });
          }
          if (
            damageEvents.length !==
            pendingReactionDamageEventId
          ) {
            throw new Error(
              `Recursive Shatter reserved parent damage event ${pendingReactionDamageEventId}, but the next damage event id is ${damageEvents.length}.`
            );
          }
        }
        if (recursiveShatterDeliveryEnabled) {
          propagatedReactionAudit =
            resolvePropagatedReactionAudit();
          synchronizeInlinePreReactableAura();
          if (
            nestedShatterState?.audit.triggered === true &&
            propagatedReactionAudit !== null &&
            propagatedReactionAudit.mechanicsTruncation !== null
          ) {
            throw new Error(
              "Recursive Shatter cannot cross a newly triggered target-mechanics truncation boundary."
            );
          }
          recordReactionDamageApplication();
          reactionApplicationIcdDecision = readReactionApplicationIcdDecision();
        }
        targetResolution ??= appendParentReactionHitResolution();
        const targetResolutionId = targetResolution.id;
        const appendReactionOwnedApplicationForTarget = (
          damageEventId: number | null
        ): number | null => {
          if (reactionApplication === undefined) return null;
          if (reactionApplicationIcdDecision === null) {
            throw new Error(
              `Reaction-owned application "${resolvedReactionHitGroupId}" is missing its decision on target "${plan.targetId}".`
            );
          }
          const elementalApplicationIcdLogId =
            appendReactionOwnedElementalApplicationIcdLog({
              reactionDamageLogId,
              hitResolutionLogId: targetResolutionId,
              damageEventId,
              frame: event.frame,
              eventPriority: event.priority,
              eventSequence: event.sequence,
              attemptIndex: targetIndex,
              attemptCount: spatialPlans.length,
              deliveryPhase: inlineApplicationPhase ?? "reaction-damage-event",
              sourceActorId: actorId,
              targetId: plan.targetId,
              hitId: resolvedReactionHitId,
              hitGroupId: resolvedReactionHitGroupId,
              damageElement,
              reactionApplication,
              decision: reactionApplicationIcdDecision
            });
          targetResolution.elementalApplicationIcdLogId =
            elementalApplicationIcdLogId;
          if (damageEventId !== null) {
            const damageEvent = damageEvents[damageEventId];
            if (damageEvent === undefined) {
              throw new Error(
                `Reaction-owned application ${elementalApplicationIcdLogId} references missing damage event ${damageEventId}.`
              );
            }
            damageEvent.elementalApplicationIcdLogId =
              elementalApplicationIcdLogId;
          }
          const inlineDeliveryLinks = inlineDeliveryLinksByTargetId?.get(
            plan.targetId
          );
          if (inlineDeliveryLinks !== undefined) {
            inlineDeliveryLinks.elementalApplicationIcdLogId =
              elementalApplicationIcdLogId;
          }
          if (
            swirlContext?.scheduleKind === "swirl-propagation" &&
            reactionApplication.channel.kind === "swirl-propagation"
          ) {
            const legacyImmediateNonReactedAttachment =
              !deferredSwirlAuraAttachmentEnabled &&
              propagatedReactionAudit?.model === "aura-engine" &&
              propagatedReactionAudit.icdAllowed === true &&
              propagatedReactionAudit.triggered === false &&
              propagatedReactionAudit.reaction === "none" &&
              propagatedReactionAudit.reactions.length === 0 &&
              propagatedReactionAudit.unsupportedReactions.length === 0 &&
              propagatedReactionAudit.mechanicsTruncation === null &&
              (propagatedReactionAudit.applicationGaugeUnits ?? 0) > 0 &&
              propagatedReactionAudit.auraApplied?.length === 1 &&
              (propagatedReactionAudit.auraConsumed?.length ?? 0) === 0 &&
              propagatedReactionAudit.transformativeReaction === null &&
              (propagatedReactionAudit.transformativeReactions?.length ??
                0) === 0 &&
              propagatedReactionAudit.periodicReaction === null &&
              propagatedReactionAudit.frozenReaction === null &&
              propagatedReactionAudit.shatterReaction === null &&
              propagatedReactionAudit.swirlReactions.length === 0 &&
              propagatedReactionAudit.swirlDamageGroup === null &&
              propagatedReactionAudit.crystallizeReaction === null &&
              propagatedReactionAudit.catalyzeReaction === null &&
              propagatedReactionAudit.burningReaction === null &&
              propagatedReactionAudit.bloomReactions.length === 0;
            if (
              !deferredSwirlAuraAttachmentEnabled &&
              !legacyImmediateNonReactedAttachment
            ) {
              return elementalApplicationIcdLogId;
            }
            const mustDeferNonReactedAttachment =
              deferredSwirlAuraAttachmentEnabled &&
              plan.landed &&
              reactionDamageAuraAllowed &&
              !mechanicsTruncatedBefore &&
              propagatedReactionAudit?.model === "aura-engine" &&
              propagatedReactionAudit.icdAllowed === true &&
              propagatedReactionAudit.triggered === false &&
              propagatedReactionAudit.reaction === "none" &&
              propagatedReactionAudit.reactions.length === 0 &&
              propagatedReactionAudit.unsupportedReactions.length === 0 &&
              propagatedReactionAudit.mechanicsTruncation === null &&
              (propagatedReactionAudit.applicationGaugeUnits ?? 0) > 0 &&
              (propagatedReactionAudit.auraConsumed?.length ?? 0) === 0 &&
              propagatedReactionAudit.transformativeReaction === null &&
              (propagatedReactionAudit.transformativeReactions?.length ??
                0) === 0 &&
              propagatedReactionAudit.periodicReaction === null &&
              propagatedReactionAudit.frozenReaction === null &&
              propagatedReactionAudit.shatterReaction === null &&
              propagatedReactionAudit.swirlReactions.length === 0 &&
              propagatedReactionAudit.swirlDamageGroup === null &&
              propagatedReactionAudit.crystallizeReaction === null &&
              propagatedReactionAudit.catalyzeReaction === null &&
              propagatedReactionAudit.burningReaction === null &&
              propagatedReactionAudit.bloomReactions.length === 0 &&
              reactionApplicationIcdDecision.allowed &&
              reactionApplicationIcdDecision.applicationMultiplier > 0;
            if (
              mustDeferNonReactedAttachment !==
              (pendingDeferredSwirlAttachment !== null)
            ) {
              throw new Error(
                `Swirl scheduler v2 produced an inconsistent deferred attachment decision for target "${plan.targetId}".`
              );
            }
            const auditAura =
              propagatedReactionAudit === null
                ? readReactionApplicationAura(
                    targetAuraEngine,
                    event.frame,
                    burningRootInlineDeliveryState !== undefined
                  )
                : null;
            const attackSchedulerLogId =
              basicReactionSchedulerLog.length;
            const disposition = deferredSwirlAuraAttachmentEnabled
              ? pendingDeferredSwirlAttachment === null
                ? "not-attached"
                : "deferred"
              : "legacy-immediate";
            const schedulerAttackCommon = {
              id: attackSchedulerLogId,
              kind: "swirl-attack-resolution",
              frame: event.frame,
              timeSeconds,
              eventPriority: event.priority,
              eventSequence: event.sequence,
              parentEventSequence: event.sequence,
              reactionDamageLogId,
              hitResolutionLogId: targetResolutionId,
              elementalApplicationIcdLogId,
              sourceActorId: actorId,
              targetId: plan.targetId,
              element: reactionApplication.channel.element,
              reaction:
                propagatedReactionAudit?.reaction ?? "none",
              reactions: deepClone(
                propagatedReactionAudit?.reactions ?? []
              ),
              auraBefore: deepClone(
                propagatedReactionAudit?.auraBefore ??
                  auditAura ??
                  []
              ),
              auraApplied: deepClone(
                propagatedReactionAudit?.auraApplied ?? []
              ),
              auraConsumed: deepClone(
                propagatedReactionAudit?.auraConsumed ?? []
              ),
              auraAfter: deepClone(
                propagatedReactionAudit?.auraAfter ??
                  auditAura ??
                  []
              )
            } as const;
            if (disposition === "deferred") {
              basicReactionSchedulerLog.push({
                ...schedulerAttackCommon,
                disposition,
                // Filled with the committed row id when the queued task runs.
                pairedLogId: -1
              });
            } else {
              basicReactionSchedulerLog.push({
                ...schedulerAttackCommon,
                disposition,
                pairedLogId: null
              });
            }
            if (reactionDamageApplicationTimelinePointId === null) {
              reactionDamageApplicationTimelinePointId =
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
                  reaction: schedulerAttackCommon.reaction,
                  reactions: schedulerAttackCommon.reactions,
                  primaryDamageEventId: damageEventId,
                  links: [
                    ...(damageEventId === null
                      ? []
                      : [
                          {
                            kind: "damage-event" as const,
                            id: damageEventId
                          }
                        ]),
                    {
                      kind: "reaction-damage-log",
                      id: reactionDamageLogId
                    },
                    {
                      kind: "basic-reaction-scheduler-log",
                      id: attackSchedulerLogId
                    }
                  ],
                  auraBefore: schedulerAttackCommon.auraBefore,
                  auraApplied: schedulerAttackCommon.auraApplied,
                  auraConsumed: schedulerAttackCommon.auraConsumed,
                  auraAfter: schedulerAttackCommon.auraAfter
                });
            } else {
              const schedulerTimelinePoint =
                targetStateTimelineRecorder.result().points[
                  reactionDamageApplicationTimelinePointId
                ];
              if (schedulerTimelinePoint === undefined) {
                throw new Error(
                  `Swirl scheduler log ${attackSchedulerLogId} could not resolve target-state point ${reactionDamageApplicationTimelinePointId}.`
                );
              }
              schedulerTimelinePoint.links.push({
                kind: "basic-reaction-scheduler-log",
                id: attackSchedulerLogId
              });
            }
            if (pendingDeferredSwirlAttachment !== null) {
              const attachmentSequence = push(
                event.frame / 60,
                "reactionAuraAttachment",
                {
                  token: pendingDeferredSwirlAttachment,
                  attackSchedulerLogId,
                  parentEventSequence: event.sequence,
                  reactionDamageLogId,
                  hitResolutionLogId: targetResolutionId,
                  elementalApplicationIcdLogId,
                  sourceActorId: actorId,
                  targetId: plan.targetId,
                  element: reactionApplication.channel.element
                } satisfies ReactionAuraAttachmentEventPayload,
                EVENT_PRIORITY.reactionAuraAttachment
              );
              if (attachmentSequence === null) {
                throw new Error(
                  `Deferred Swirl Aura attachment for scheduler log ${attackSchedulerLogId} fell outside the current simulation frame.`
                );
              }
            }
          }
          return elementalApplicationIcdLogId;
        };
        const electroChargedPropagationCandidate =
          electroChargedPropagationCandidateByTargetId?.get(plan.targetId);
        if (electroChargedPropagationCandidate !== undefined) {
          electroChargedPropagationCandidate.hitResolutionLogId =
            targetResolutionId;
        }
        if (burningRootInlineDeliveryState !== undefined) {
          inlineDeliveryLinksByTargetId?.set(plan.targetId, {
            hitResolutionLogId: targetResolutionId,
            damageEventId: null,
            elementalApplicationIcdLogId: null,
            targetStateTimelinePointId: reactionDamageApplicationTimelinePointId
          });
        }
        if (!plan.landed) {
          appendReactionOwnedApplicationForTarget(null);
          return;
        }

        const debuffState = getDebuffState(
          timeSeconds,
          damageElement,
          targetProfile.defReduction,
          plan.targetId
        );
        const baseResistance = resolveEnemyBaseResistance(
          targetProfile,
          damageElement
        );
        const effectiveResistance =
          baseResistance - debuffState.resShred;
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
        if (propagatedReactionAudit !== null && propagatedReactionAudit.mechanicsTruncation === null) handleArtifactReactions(propagatedReactionAudit.reactions, actorId, event.frame, { parentDamageEventId: pendingReactionDamageEventId });
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
                scheduledReactionBonusDelta + artifactReactionBonus(actorId, additiveReaction.reaction, event.frame)
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
        if (amplifyingReaction !== "none") amplifyingReactionBonus += artifactReactionBonus(actorId, amplifyingReaction, event.frame);
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
          swirlDamageGroup:
            swirlDamageGroup === null
              ? null
              : projectSwirlDamageGroupAudit(swirlDamageGroup),
          note:
            reactionApplication === undefined
              ? `${reactionLabel}自身伤害：不暴击、忽略防御且不附着元素；应用目标元素抗性、伤害策略与对应反应伤害组 ICD。`
              : reactionDamageAuraAllowed
                ? `${reactionLabel}范围传播：先以 ${reactionApplication.nominalGaugeUnits}U 可信反应附着处理目标 Aura 与二次反应，再结算不暴击、无视防御的反应伤害。`
                : `${reactionLabel}范围传播命中，但目标阶段阻止了元素附着；扩散伤害仍按目标伤害策略结算。`
        };
        damageEvents.push({
          id: damageEventId,
          elementalApplicationIcdLogId: null,
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
            baseResistance,
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
        settleTargetHealth(damageEvents[damageEventId]!);
        moonlightArtifactRuntime?.onEnemyDamage(event.frame, actorId, damageElement, damageEventId);
        reactionTriggerDamageEventIds.push(damageEventId);
        reactionLog.damageEventIds.push(damageEventId);
        if (
          electroChargedPropagationCandidate !== undefined
        ) {
          electroChargedPropagationCandidate.damageEventId =
            damageEventId;
        }
        targetResolution.damageEventId = damageEventId;
        targetResolution.potentialDamage = potentialDamage;
        targetResolution.finalDamage = finalDamage;
        targetResolution.displayDamage = displayDamage;
        const inlineDeliveryLinks =
          inlineDeliveryLinksByTargetId?.get(plan.targetId);
        if (inlineDeliveryLinks !== undefined) {
          inlineDeliveryLinks.damageEventId = damageEventId;
        }
        appendReactionOwnedApplicationForTarget(damageEventId);
        if (burningContext !== undefined) {
          const burningLog = burningStateLog[burningContext.burningStateLogId];
          if (burningLog !== undefined) {
            burningLog.damageEventIds.push(damageEventId);
            if (plan.targetId === sourceTargetId) {
              burningLog.damageAllowed =
                damageAllowed && !mechanicsTruncatedBefore;
              if (
                reactionApplication?.channel.kind === "burning-tick" &&
                !reactionDamageAuraAllowed
              ) {
                burningLog.applicationAllowed = null;
                burningLog.applicationBlockedReason =
                  "TARGET_AURA_BLOCKED";
                burningLog.icdWindowStartFrame = null;
                burningLog.icdHitIndex = null;
              }
              if (propagatedReactionAudit !== null) {
                burningLog.auraBefore = copyGeneratedAuraStates(
                  propagatedReactionAudit.auraBefore ?? []
                );
                burningLog.auraApplied = deepClone(
                  propagatedReactionAudit.auraApplied ?? []
                );
                burningLog.auraConsumed = deepClone(
                  propagatedReactionAudit.auraConsumed ?? []
                );
                burningLog.auraAfter = copyGeneratedAuraStates(
                  propagatedReactionAudit.auraAfter ?? []
                );
                burningLog.applicationAllowed =
                  propagatedReactionAudit.icdAllowed;
                burningLog.applicationBlockedReason =
                  propagatedReactionAudit.icdAllowed === false
                    ? "BURNING_APPLICATION_ICD"
                    : null;
                burningLog.icdWindowStartFrame =
                  reactionApplicationIcdDecision?.kind ===
                  "reaction-fixed-gcsim"
                    ? reactionApplicationIcdDecision.windowStartFrame
                    : null;
                burningLog.icdHitIndex =
                  reactionApplicationIcdDecision?.kind ===
                  "reaction-fixed-gcsim"
                    ? reactionApplicationIcdDecision.hitIndex
                    : null;
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
          !recursiveShatterDeliveryEnabled &&
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
            freezeResistance: targetProfile.freezeResistance,
            triggerEventType: event.type,
            triggerEventPriority: event.priority,
            triggerEventSequence: event.sequence,
            nextIntraEventSequence,
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
              triggerFrame: event.frame,
              eventPriority: event.priority,
              eventSequence: event.sequence,
              nextIntraEventSequence
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
      if (burningRootInlineDeliveryState !== undefined) {
        const planByTargetId = new Map(
          spatialPlans.map((plan) => [plan.targetId, plan])
        );
        const unresolvedTargetIds = new Set(
          reactionLog.unresolvedTargetIds
        );
        burningRootInlineDeliveryState.delivery.attempts =
          enemyTargets.map(
            (target, targetOrder): TargetPhaseV3DeliveryAttempt => {
              const applicationPhase =
                targetOrder <
                burningRootInlineDeliveryState.ownerTargetOrder
                  ? "after-reactable-tick"
                  : "before-reactable-tick";
              const base = {
                order: targetOrder,
                targetId: target.id,
                targetOrder,
                applicationPhase
              } as const;
              const plan = planByTargetId.get(target.id);
              const links =
                inlineDeliveryLinksByTargetId?.get(target.id);
              if (plan === undefined) {
                if (
                  !unresolvedTargetIds.has(target.id) ||
                  links !== undefined
                ) {
                  throw new Error(
                    `Inline Burning delivery did not classify target "${target.id}" as resolved or unresolved.`
                  );
                }
                return {
                  ...base,
                outcome: "unresolved",
                hitResolutionLogId: null,
                damageEventId: null,
                elementalApplicationIcdLogId: null,
                targetStateTimelinePointId: null
              };
            }
              if (links === undefined) {
                throw new Error(
                  `Inline Burning delivery did not create a hit-resolution link for target "${target.id}".`
                );
              }
            if (!plan.landed) {
              if (
                links.damageEventId !== null ||
                links.elementalApplicationIcdLogId === null ||
                links.targetStateTimelinePointId !== null
              ) {
                throw new Error(
                    `Inline Burning miss on target "${target.id}" unexpectedly mutated Aura or dealt damage.`
                  );
                }
                return {
                  ...base,
                outcome: "miss",
                hitResolutionLogId: links.hitResolutionLogId,
                damageEventId: null,
                elementalApplicationIcdLogId:
                  links.elementalApplicationIcdLogId,
                targetStateTimelinePointId: null
              };
            }
            if (
              links.damageEventId === null ||
              links.elementalApplicationIcdLogId === null ||
              links.targetStateTimelinePointId === null
            ) {
              throw new Error(
                  `Inline Burning hit on target "${target.id}" is missing its damage or Aura timeline link.`
                );
              }
              return {
                ...base,
              outcome: "landed",
              hitResolutionLogId: links.hitResolutionLogId,
              damageEventId: links.damageEventId,
              elementalApplicationIcdLogId: links.elementalApplicationIcdLogId,
              targetStateTimelinePointId: links.targetStateTimelinePointId
            };
          }
          );
        burningRootInlineDeliveryByReactionDamageLogId.delete(
          reactionDamageLogId
        );
      }
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
      if (
        config.reactionEngine?.mode === "aura-v5" ||
        config.reactionEngine?.mode === "aura-v6" ||
        config.reactionEngine?.mode === "aura-v7" ||
        config.reactionEngine?.mode === "aura-v8" ||
        config.reactionEngine?.mode === "aura-v9"
      ) {
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
          applicationGaugeUnits: reactionApplication?.nominalGaugeUnits ?? null,
          reactionBonusDelta: reactionBonus - stats.reactionBonus,
          hitResolutionLogIds: reactionHitResolutionLogIds,
          triggerDamageEventIds: reactionTriggerDamageEventIds,
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
        const shouldScheduleWane =
          periodicContext.waneEligible &&
          (!auraV9Enabled || periodicActualDamage > 0);
        if (periodicLog !== undefined) {
          periodicLog.damageEventId = periodicDamageEventId;
          periodicLog.waneFrame = shouldScheduleWane
            ? event.frame +
              AURA_ENGINE_CONSTANTS.electroChargedWaneDelayFrames
            : null;
        }
        if (shouldScheduleWane) {
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
              generation: periodicContext.generation,
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
      hit: configuredHit,
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
      periodicFlatSnapshots,
      sourceSnapshots,
      weaponProcLogId,
      weaponProcContext,
      thrillingTalesSnapshotStatuses,
      cycle
    } = event.payload as HitEventPayload;
    const infusionConversion = configuredHit.infusion === undefined ? undefined : liveConversions.get(`${actorId}:${configuredHit.infusion.statusKey}`);
    const hit = configuredHit.infusion !== undefined && infusionConversion !== undefined && event.frame < infusionConversion.expiresAtFrame
      ? { ...configuredHit, element: configuredHit.infusion.element, application: configuredHit.infusion.application }
      : configuredHit;
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
    const targetTaskPhaseEntry = ensureTargetTaskPhase({
      targetId,
      globalFrame: event.frame,
      wakeKind: "incoming",
      eventType: "hit",
      eventPriority: event.priority,
      eventSequence: event.sequence,
      intraEventSequence: targetPhaseEnabled
        ? nextIntraEventSequence()
        : 0
    });
    const targetPhaseV2Entry =
      ensureTargetPhaseV2State({
        targetId,
        globalFrame: event.frame,
        emit: true
      })?.entry ?? null;
    const mechanicsTruncatedBefore =
      auraEngine?.isMechanicsTruncated() ?? false;
    const mechanicsStatus: DamageEvent["mechanicsStatus"] =
      mechanicsTruncatedBefore
        ? "mechanics-truncated"
        : "authoritative";
    const targetDefeated = targetHealthRuntime?.isDefeated(targetId) ?? false;
    const targetOutcome = targetDefeated ? "miss" : targeting?.outcome ?? "landed";
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
      reactionDamageLogId: null,
      elementalApplicationIcdLogId: null,
      frame: event.frame,
      timeSeconds,
      eventPriority: event.priority,
      eventSequence: event.sequence,
      intraEventSequence: nextIntraEventSequence({kind:'hit-resolution',id:targetResolutionId}),
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
        (targetDefeated ? "TARGET_DEFEATED" : targeting?.reason) ??
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
    if (weaponProcLogId !== undefined) weaponProcLog[weaponProcLogId]!.hitResolutionIds.push(targetResolutionId);
    appendTargetTaskPhaseReference(
      targetTaskPhaseEntry,
      "hitResolutionLogIds",
      targetResolutionId
    );
    appendTargetPhaseV2Reference(
      targetPhaseV2Entry,
      "hitResolutionLogIds",
      targetResolutionId
    );
    if (!targetResolution.landed) {
      if (hit.application !== undefined) {
        targetResolution.elementalApplicationIcdLogId =
          appendElementalApplicationIcdLog({
            hitResolutionLogId: targetResolutionId,
            damageEventId: null,
            frame: event.frame,
            sourceActorId: actorId,
            targetId,
            hitId,
            hitGroupId,
            element,
            application: hit.application,
            decision: skippedConfiguredElementalApplicationDecision("miss")
          });
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
        damageEventId: null,
        targetIndex,
        targetCount,
        landed: false,
        hitConfirmAllowed: false,
        resolvedGeometry,
        eventPriority: event.priority,
        eventSequence: event.sequence,
        nextIntraEventSequence
      });
      continue;
    }

    const configuredDirectDamageGroupMultiplier = safeNumber(
      hit.groupMultiplier,
      1
    );
    const directDamageGroupDecision =
      hit.directDamageGroup === undefined
        ? null
        : directDamageGroupEngines
            .get(targetId)!
            .consumeLandedHit({
              frame: event.frame,
              sourceActorId: actorId,
              icdTag: hit.directDamageGroup.icdTag,
              icdGroup: hit.directDamageGroup.icdGroup
            });
    const directDamageGroupSequenceMultiplier: 0 | 1 =
      directDamageGroupDecision === null ||
      directDamageGroupDecision.sequenceMultiplier === 1
        ? 1
        : directDamageGroupDecision.sequenceMultiplier === 0
          ? 0
          : (() => {
              throw new Error(
                `Direct-damage group "${directDamageGroupDecision.icdGroup}" returned unsupported multiplier ${directDamageGroupDecision.sequenceMultiplier}.`
              );
            })();

    const mainSourceSnapshot = sourceSnapshots?.main === undefined ? undefined : sampledSource(sourceSnapshots.main);
    const stats = mainSourceSnapshot !== undefined ? deepClone(mainSourceSnapshot.stats) :
      hit.snapshot === "action"
        ? deepClone(
            snapshots[scalingOwnerId] ??
              sampleStats(scalingOwnerId, timeSeconds)
          )
        : sampleStats(scalingOwnerId, timeSeconds);
    if (!stats) {
      throw new Error(
        `Resolved scaling owner "${scalingOwnerId}" has no runtime stats for hit "${hitId}".`
      );
    }

    const scalingStat = hit.scalingStat ?? "atk";
    const scalingValue = calcTotalStat(stats, scalingStat);
    let flatDamage = safeNumber(hit.flat);
    const flatDetails: DamageEvent["flatDetails"] = [];
    for (const [sourceIndex, source] of (hit.flatSources ?? []).entries()) {
      const sourceId = source.ownerId ?? scalingOwnerId;
      const sourceSnapshotLogId = sourceSnapshots?.flatSources?.[sourceIndex];
      const sourceStats = (sourceSnapshotLogId === undefined ? undefined : sampledSource(sourceSnapshotLogId).stats) ?? periodicFlatSnapshots?.[sourceId] ?? (
        hit.snapshot === "action"
          ? deepClone(
              snapshots[sourceId] ?? sampleStats(sourceId, timeSeconds)
            )
          : sampleStats(sourceId, timeSeconds));
      if (!sourceStats) continue;
      const sourceStat = source.stat ?? "atk";
      const sourceValue = calcTotalStat(sourceStats, sourceStat);
      const amount = sourceValue * source.multiplier;
      flatDamage += amount;
      flatDetails.push({
        ...(sourceSnapshotLogId === undefined ? {} : { sourceSnapshotLogId }),
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
    const baseResistance = resolveEnemyBaseResistance(
      targetProfile,
      element
    );
    const stellarPanel = stellarConductRuntime === undefined ? undefined : hit.snapshot === "action" ? stellarActionPanels.get(snapshots) ?? stellarConductRuntime.panelSnapshot(event.frame) : stellarConductRuntime.panelSnapshot(event.frame);
    const stellarAdjustment = stellarConductRuntime?.adjustment(event.frame, element, stellarPanel!, stats.dmgBonus + safeNumber(hit.dmgBonus), baseResistance, debuffState.resShred + safeNumber(hit.resShred));
    const stellarCalculation = stellarAdjustment === undefined ? undefined : executeStellarConductAdjustment(stellarAdjustment);
    const effectiveResistance = stellarCalculation?.effectiveResistance ?? (baseResistance - debuffState.resShred - safeNumber(hit.resShred));
    const effectiveDefenseReduction = clamp(
      debuffState.defReduction + safeNumber(hit.defReduction),
      -1,
      0.9
    );
    const activeStatuses: ActiveStatusSnapshot[] = [
      ...(mainSourceSnapshot !== undefined ? deepClone(mainSourceSnapshot.activeBuffs) : weaponProcLogId === undefined ? activeBuffs
        .filter((buff) => buff.targetId === scalingOwnerId && !(thrillingTalesRuntime !== undefined && hit.snapshot === "action" && buff.key === `ttds:${scalingOwnerId}`))
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
        })) : deepClone(weaponProcContext!.triggerBuffStatuses)),
      ...(mainSourceSnapshot === undefined && thrillingTalesRuntime !== undefined && weaponProcLogId === undefined && hit.snapshot === "action"
        ? deepClone(thrillingTalesSnapshotStatuses?.[scalingOwnerId] ?? []) : []),
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
      baseResistance,
      resistanceShred: debuffState.resShred + safeNumber(hit.resShred) + (stellarAdjustment?.physicalResistanceReduction ?? 0),
      effectiveResistance,
      baseDefenseReduction: targetProfile.defReduction,
      effectiveDefenseReduction
    };
    // A force shield owns its elemental budget. It consumes the ordinary target ICD
    // once but must not masquerade as an ordinary Aura or create ordinary reaction side effects.
    const enemyShieldPrepared = !mechanicsTruncatedBefore && enemyShieldHost !== undefined
      ? enemyShieldHost.prepareDirectHit({ frame: event.frame, eventPriority: event.priority, eventSequence: event.sequence, intraEventSequence: targetIndex,
          sourceEventId: `damage:${damageEvents.length}`, sourceActorId: actorId, sourceActionId: action.id, hitId,
          damageEventId: damageEvents.length, hitResolutionLogId: targetResolutionId, targetId, element, hit, sourceRefs: [],
          liveAura: auraEngine?.getAuraStateAt(event.frame) ?? [], targetEffects: { damageAllowed, auraAllowed, hitConfirmAllowed } }) : null;
    if (enemyShieldPrepared !== null) {
      const pendingConsumers: string[] = [];
      if (config.weaponHitStackModel?.actors.some(row => row.actorId === actorId)) pendingConsumers.push("武器叠层 OnEnemyDamage");
      if (config.weaponProcModel?.actors.some(row => row.actorId === actorId)) pendingConsumers.push("独立武器追击回调");
      if (hit.attackTag === "skill" && config.sacrificialModel?.actors.some(row => row.actorId === actorId)) pendingConsumers.push("祭礼伤害回调");
      if (config.normalHitEnergyModel !== undefined && hit.normalHitEnergyTag !== undefined) pendingConsumers.push("普攻随机能量回调");
      if (element !== "physical" && config.nightsoulBurstModel !== undefined) pendingConsumers.push("夜魂迸发伤害回调");
      if (config.artifactDamageModel !== undefined) pendingConsumers.push("圣遗物命中／伤害回调");
      if (enemyShieldPrepared.reaction !== "none" && config.artifactBuffModel?.actors.some(row => row.actorId === actorId && ["instructor-4pc", "gilded-4pc"].includes(row.effectId))) pendingConsumers.push("圣遗物护盾反应回调");
      if (pluginDefinitions.length > 0) pendingConsumers.push("插件命中／伤害回调");
      if (action.particles?.some(particle => particle.trigger?.kind === "hit-confirm" && particle.trigger.hitIds.includes(hitId))) pendingConsumers.push("技能命中产球资格");
      if (pendingConsumers.length) throw new Error(`本次真实盾接触尚未来源验证以下回调资格：${pendingConsumers.join("、")}；不能用生命伤害 0 代替各机制的接触规则。`);
    }
    const preReactionSourceStats = computeStats(actorId, timeSeconds);
    const shatterState =
      enemyShieldPrepared === null &&
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
    const recursiveShatterWillSettle =
      recursiveShatterDeliveryEnabled &&
      shatterState?.audit.triggered === true &&
      shatterState.audit.scheduled &&
      shatterState.audit.damageFrame <=
        Math.round(config.duration * 60);
    const pendingDirectDamageEventId =
      damageEvents.length +
      (recursiveShatterWillSettle ? 1 : 0);
    if (shatterState?.audit.triggered) handleArtifactReactions(["shatter"], actorId, event.frame, { parentDamageEventId: pendingDirectDamageEventId });
    const artifactDamageDecisions = artifactDamageRuntime !== undefined && hitConfirmAllowed &&
      configuredDirectDamageGroupMultiplier * directDamageGroupSequenceMultiplier > 0
      ? artifactDamageRuntime.onEnemyHit({ frame: event.frame, sourceActorId: actorId, activeCharacterId,
          attackTag: hit.attackTag ?? null, currentAttack: () => calcTotalStat(computeStats(actorId, timeSeconds)!, "atk") }) : [];
    for (const decision of artifactDamageDecisions) {
      flatDamage += decision.flatDamage;
      appendArtifactDamageDecision(event, nextIntraEventSequence(), decision,
        { sourceActorId: actorId, targetId, parentDamageEventId: pendingDirectDamageEventId, hitResolutionLogId: targetResolutionId });
    }
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
    if (
      recursiveShatterDeliveryEnabled &&
      shatterState !== null
    ) {
      recordShatterFrozenState({
        result: shatterState,
        targetId,
        targetName: targetProfile.name,
        sourceActorId: actorId,
        triggerDamageEventId: pendingDirectDamageEventId,
        frame: event.frame,
        timeSeconds,
        freezeResistance: targetProfile.freezeResistance,
        triggerEventType: event.type,
        triggerEventPriority: event.priority,
        triggerEventSequence: event.sequence,
        nextIntraEventSequence,
      });
      if (shatterState.audit.triggered) {
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
          triggerDamageEventId:
            pendingDirectDamageEventId,
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
          triggerFrame: event.frame,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          nextIntraEventSequence
        });
      }
      if (damageEvents.length !== pendingDirectDamageEventId) {
        throw new Error(
          `Recursive Shatter reserved parent damage event ${pendingDirectDamageEventId}, but the next damage event id is ${damageEvents.length}.`
        );
      }
    }
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
          ? auraEngine.processConfiguredHit({
              frame: event.frame,
              sourceActorId: actorId,
              element,
              ...(hit.application === undefined || enemyShieldPrepared !== null
                ? {}
                : { application: hit.application }),
              ...(hit.reactionOverride === undefined
                ? {}
                : { reactionOverride: hit.reactionOverride })
            })
          : {
              ...auraEngine.processConfiguredHit({
                frame: event.frame,
                sourceActorId: actorId,
                element
              }),
              note:
                "目标效果策略阻止了本段元素附着与反应；Aura 仅按当前帧衰减。"
            };
    const reactionAudit =
      projectPlayerSelfDamageStatus(rawReactionAudit);
    if (auraEngine !== null && reactionAudit.mechanicsTruncation === null) handleArtifactReactions(reactionAudit.reactions, actorId, event.frame, { parentDamageEventId: pendingDirectDamageEventId });
    if (auraEngine !== null && reactionAudit.mechanicsTruncation === null && reactionAudit.icdAllowed === true) {
      const lunarCallbacks: Array<"lunarCharged" | "lunarCrystallize"> = [];
      if ((lunarRuntime || lunarMixedRuntime || lunarMixedV2Runtime) && auraEngine.didLastApplicationTriggerLunarCharged()) lunarCallbacks.push("lunarCharged");
      if ((lunarCrystallizeRuntime || lunarMixedRuntime || lunarMixedV2Runtime) && auraEngine.didLastApplicationTriggerLunarCrystallize()) lunarCallbacks.push("lunarCrystallize");
      if (lunarCallbacks.length > 0) {
        reactionAudit.specialReactions = lunarCallbacks;
        for (const reaction of lunarCallbacks) handleArtifactBuff({ kind: "reaction", frame: event.frame,
          sourceActorId: actorId, activeCharacterId, reaction, targetIsEnemy: true }, { parentDamageEventId: pendingDirectDamageEventId });
        for (const reaction of lunarCallbacks) moonlightArtifactRuntime?.onLunarReaction(event.frame, reaction, actorId, pendingDirectDamageEventId);
      }
    }
    if (reactionAudit.catalyzeReaction?.additive !== null && reactionAudit.catalyzeReaction?.additive !== undefined) lunarArtifactRuntime?.ordinaryReactionRead(actorId, event.frame);
    if (reactionAudit.icdAllowed === true && reactionAudit.bloomReactions.some(reaction => reaction.reaction === "bloom")) lunarArtifactRuntime?.reactionTriggered(actorId, event.frame, "bloom");
    if (reactionAudit.icdAllowed === true && reactionAudit.bloomReactions.some(reaction => reaction.reaction === "bloom") && (lunarBloomRuntime !== undefined || lunarMixedV2Runtime !== undefined)) moonlightArtifactRuntime?.onLunarReaction(event.frame, "lunarBloom", actorId, pendingDirectDamageEventId);
    if (lunarMixedV2Runtime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true) {
      if (element === "hydro" || element === "electro" || element === "geo") {
        const geoResolution = auraEngine.getLastLunarMixedGeoResolution();
        lunarMixedV2Runtime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
          gaugeUnits: reactionAudit.applicationGaugeUnits!, auraBefore: reactionAudit.auraBefore ?? [], auraAfter: reactionAudit.auraAfter ?? [],
          lunarCharged: auraEngine.didLastApplicationTriggerLunarCharged(), lunarCrystallize: auraEngine.didLastApplicationTriggerLunarCrystallize(), ...(geoResolution === undefined ? {} : { geoResolution }) });
      }
      if ((element === "hydro" || element === "electro" || element === "dendro") && reactionAudit.bloomReactions.length > 0) {
        lunarMixedV2Runtime.bloom({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element, gaugeUnits: reactionAudit.applicationGaugeUnits! });
      }
    }
    if (lunarMixedRuntime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true && (element === "hydro" || element === "electro" || element === "geo")) {
      const geoResolution = auraEngine.getLastLunarMixedGeoResolution();
      lunarMixedRuntime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
        gaugeUnits: reactionAudit.applicationGaugeUnits!, auraBefore: reactionAudit.auraBefore ?? [], auraAfter: reactionAudit.auraAfter ?? [],
        lunarCharged: auraEngine.didLastApplicationTriggerLunarCharged(), lunarCrystallize: auraEngine.didLastApplicationTriggerLunarCrystallize(), ...(geoResolution === undefined ? {} : { geoResolution }) });
    }
    if (lunarRuntime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true && (element === "hydro" || element === "electro")) {
      lunarRuntime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
        gaugeUnits: reactionAudit.applicationGaugeUnits!, auraBefore: reactionAudit.auraBefore ?? [], converted: auraEngine.didLastApplicationTriggerLunarCharged() });
    }
    if (lunarCrystallizeRuntime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true && (element === "hydro" || element === "geo")) {
      lunarCrystallizeRuntime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
        gaugeUnits: reactionAudit.applicationGaugeUnits!, auraBefore: reactionAudit.auraBefore ?? [], converted: auraEngine.didLastApplicationTriggerLunarCrystallize() });
    }
    if (stellarConductRuntime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true && (element === "cryo" || element === "electro")) {
      stellarConductRuntime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
        gaugeUnits: reactionAudit.applicationGaugeUnits!, converted: auraEngine.didLastApplicationTriggerStellarConduct() });
    }
    if (lunarBloomRuntime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true && (element === "hydro" || element === "dendro")) {
      lunarBloomRuntime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
        gaugeUnits: reactionAudit.applicationGaugeUnits!, actualIcdAllowed: true, ordinaryBloomCreated: reactionAudit.bloomReactions.some(reaction => reaction.reaction === "bloom") });
    }
    if (stellarSwirlRuntime !== undefined && auraEngine !== null && reactionAudit.icdAllowed === true && element === "anemo") {
      const converted = auraEngine.didLastApplicationTriggerStellarSwirl();
      stellarSwirlRuntime.application({ frame: event.frame, sourceActorId: actorId, sourceEventId: `damage:${pendingDirectDamageEventId}`, attackId: hitGroupId, targetId, element,
        gaugeUnits: reactionAudit.applicationGaugeUnits!, actualIcdAllowed: true, auraBefore: reactionAudit.auraBefore ?? [], converted, ordinaryReactionReplacementApplied: converted });
    }
    const elementalApplicationIcdDecision =
      enemyShieldPrepared !== null ? enemyShieldPrepared.applicationDecision :
      hit.application === undefined
        ? null
        : !auraAllowed
          ? skippedConfiguredElementalApplicationDecision(
              "target-aura-blocked"
            )
          : auraEngine === null
            ? skippedConfiguredElementalApplicationDecision("no-aura-engine")
            : mechanicsTruncatedBefore
              ? skippedConfiguredElementalApplicationDecision(
                  "mechanics-truncated"
                )
              : auraEngine.getLastConfiguredElementalApplicationIcdDecision();
    if (
      hit.application !== undefined &&
      elementalApplicationIcdDecision === null
    ) {
      throw new Error(
        `Aura engine did not expose an elemental-application ICD decision for configured hit "${hitGroupId}".`
      );
    }
    if (
      recursiveShatterDeliveryEnabled &&
      shatterState?.audit.triggered === true &&
      reactionAudit.mechanicsTruncation !== null
    ) {
      throw new Error(
        "Recursive Shatter cannot cross a newly triggered target-mechanics truncation boundary."
      );
    }
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
        intraEventSequence: nextIntraEventSequence({kind:'aura-application',damageEventId:pendingDirectDamageEventId}),
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
      !recursiveShatterDeliveryEnabled &&
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
            safeNumber(hit.reactionBonus) + artifactReactionBonus(actorId, additiveReaction.reaction, event.frame)
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
      lunarArtifactRuntime?.ordinaryReactionRead(actorId, event.frame);
      const liveReactionSourceStats = computeStats(
        actorId,
        timeSeconds
      );
      const reactionSourceSnapshot = sourceSnapshots?.reaction !== undefined ? sampledSource(sourceSnapshots.reaction).stats :
        hit.snapshot === "action"
          ? snapshots[actorId]
          : preReactionSourceStats;
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
        liveReactionSourceStats.reactionBonus + safeNumber(hit.reactionBonus) + artifactReactionBonus(actorId, amplifyingReaction, event.frame);
    }
    if (
      config.schemaVersion === CURRENT_SCHEMA_VERSION &&
      hit.ampBase !== undefined
    ) {
      throw new Error(
        `Hit "${hit.id ?? hit.label}" cannot provide ampBase for schema ${REACTION_FORMULA_ROOT_SCHEMA_VERSION}; amplifying multipliers are bound to the fixed reaction-formula root.`
      );
    }
    let damageInput: DamageCalculationInput = {
      scaling: hit.scaling,
      scalingStat,
      scalingValue,
      flatDamage:
        flatDamageComponents.ordinaryFlatDamage +
        flatDamageComponents.additiveReactionFlatDamage,
      damageBonus: stellarCalculation?.damageBonus ?? (stats.dmgBonus + safeNumber(hit.dmgBonus)),
      characterLevel: scalingOwner.level,
      enemyLevel: targetProfile.level,
      defenseReduction: effectiveDefenseReduction,
      defenseIgnore: stats.defIgnore + safeNumber(hit.defIgnore),
      effectiveResistance,
      critRate: stats.critRate + safeNumber(hit.critRate),
      critDamage: stats.critDmg + safeNumber(hit.critDmg),
      critMode: options.critMode,
      ...(hit.hitWeakPoint === undefined ? {} : { hitWeakPoint: hit.hitWeakPoint }),
      reaction: amplifyingReaction,
      elementalMastery: amplifyingElementalMastery,
      reactionBonus: amplifyingReactionBonus,
      // Formal Aura runs derive their amplifying base from the audited
      // reaction. Only frozen pre-1.45 replay paths may forward ampBase;
      // the formula-root current path rejects it above.
      ...(config.schemaVersion === CURRENT_SCHEMA_VERSION ||
      hit.ampBase === undefined ||
      (auraEngine !== null && reactionAudit.model !== "manual-override")
        ? {}
        : { explicitReactionBase: hit.ampBase }),
      // Plugins observe and may replace the hit-authored multiplier. The fixed
      // group sequence is applied after plugins so a zero slot cannot be
      // revived by an absolute override.
      groupMultiplier: configuredDirectDamageGroupMultiplier
    };
    const pluginMultiplierTrace: SimulationResult["directDamageGroupLog"][number]["pluginMultiplierTrace"] = [];
    let pluginCriticalModeOverride = false;
    for (const [pluginManifestIndex, definition] of pluginDefinitions.entries()) {
      const inputMultiplier = damageInput.groupMultiplier;
      const plugin = damagePluginsByManifestIndex.get(pluginManifestIndex);
      if (plugin === undefined) {
        // Callback-only plugins retain their position in the historical
        // unified manifest. This explicit no-change capability placeholder is
        // not a modifyDamage invocation and grants no damage authority.
        pluginMultiplierTrace.push({
          pluginManifestIndex,
          pluginId: definition.descriptor.id,
          inputMultiplier,
          outcome: "no-change",
          outputMultiplier: inputMultiplier,
        });
        continue;
      }
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
        additiveReactionFactors !== null,
        config.schemaVersion
      );
      if (pluginChanges !== undefined && Object.prototype.hasOwnProperty.call(pluginChanges, "critMode")) {
        pluginCriticalModeOverride = true;
      }
      damageInput = appliedChanges.damageInput;
      flatDamageComponents =
        appliedChanges.flatDamageComponents;
      const outputMultiplier = damageInput.groupMultiplier;
      pluginMultiplierTrace.push({
        pluginManifestIndex,
        pluginId: plugin.descriptor.id,
        inputMultiplier,
        // This is a multiplier-value trace, not a property-presence trace: an
        // explicit override to the same value is semantically no change.
        outcome:
          outputMultiplier === inputMultiplier
            ? "no-change"
            : "override",
        outputMultiplier
      });
    }
    if (additiveReactionFactors !== null) {
      additiveReactionFactors.appliedFlatDamage =
        flatDamageComponents.additiveReactionFlatDamage;
    }

    const pluginResolvedDirectDamageGroupMultiplier =
      damageInput.groupMultiplier;
    const effectiveDirectDamageGroupMultiplier =
      pluginResolvedDirectDamageGroupMultiplier *
      directDamageGroupSequenceMultiplier;
    damageInput = {
      ...damageInput,
      groupMultiplier: effectiveDirectDamageGroupMultiplier
    };

    const critical: SimulationExecutionAudit["hits"][number]["critical"] = {
      mode: "configured",
      eligible: hit.critEligible !== false,
      outcome: "expected",
      roll: null,
      drawIndex: null
    };
    if (hit.hitWeakPoint === true) {
      damageInput = { ...damageInput, critMode: "allCrit" };
      critical.outcome = "critical";
    } else if (!critical.eligible) {
      damageInput = { ...damageInput, critMode: "noCrit" };
      critical.outcome = "ineligible";
    } else if (executionOptions?.criticalSampling === "seeded-random-v1" && !pluginCriticalModeOverride) {
      critical.mode = "seeded-random-v1";
      critical.drawIndex = criticalDrawCount++;
      critical.roll = criticalRandom.next();
      const sampledCritical = critical.roll < clamp(damageInput.critRate, 0, 1);
      critical.outcome = sampledCritical ? "critical" : "noncritical";
      damageInput = { ...damageInput, critMode: sampledCritical ? "allCrit" : "noCrit" };
    } else {
      critical.outcome = damageInput.critMode === "allCrit" ? "critical" : damageInput.critMode === "noCrit" ? "noncritical" : "expected";
    }
    const calculation = executionOptions?.detailedTraces === true
      ? calculateDamageTrace(damageInput)
      : calcDamage(damageInput);
    if (captureResolvedHits) {
      resolvedHitContexts.set(damageEvents.length, {
        eventId: damageEvents.length,
        inputKind: "ordinary",
        input: deepClone(damageInput),
        critical,
        ...(stellarAdjustment === undefined ? {} : { stellarConduct: stellarAdjustment }),
        ...(executionOptions?.detailedTraces === true && "trace" in calculation && Array.isArray(calculation.trace) ? { trace: deepClone([...artifactDamageTrace(artifactDamageDecisions), ...(stellarCalculation?.trace ?? []), ...calculation.trace]) } : {})
      });
    }
    if (stellarAdjustment) stellarConductRuntime!.fieldInfluences.push({ ...stellarAdjustment, eventId: damageEvents.length, frame: event.frame, element });
    const factors = calculation.factors;
    const buffLabels = activeStatuses
      .filter((status) => status.kind === "buff")
      .map((status) => status.label);
    const debuffLabels = activeStatuses
      .filter((status) => status.kind === "debuff")
      .map((status) => status.label);
    const snapshot = hit.snapshot ?? "hit";
    const damageEventId = damageEvents.length;
    const enemyShieldSettlement = enemyShieldPrepared === null ? undefined : enemyShieldHost!.settleDirect(enemyShieldPrepared, damageInput, calculation.finalDamage);
    const targetDamageMultiplier =
      damageAllowed && !mechanicsTruncatedBefore && enemyShieldSettlement === undefined ? 1 : 0;
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
    directDamageGroupLog.push({
      id: directDamageGroupLog.length,
      damageEventId,
      hitResolutionLogId: targetResolutionId,
      frame: event.frame,
      sourceActorId: actorId,
      targetId,
      hitId,
      profileId:
        directDamageGroupDecision?.profileId ??
        GCSIM_DAMAGE_GROUP_ROOT.profileId,
      evaluation:
        directDamageGroupDecision === null
          ? "bypassed"
          : "evaluated",
      icdTag: directDamageGroupDecision?.icdTag ?? null,
      icdGroup: directDamageGroupDecision?.icdGroup ?? null,
      windowStartGroup:
        directDamageGroupDecision?.windowStartGroup ?? null,
      resetFrames:
        directDamageGroupDecision?.resetFrames ?? null,
      windowStartFrame:
        directDamageGroupDecision?.windowStartFrame ?? null,
      resetAtFrame:
        directDamageGroupDecision?.resetAtFrame ?? null,
      hitIndex: directDamageGroupDecision?.hitIndex ?? null,
      sequenceIndex:
        directDamageGroupDecision?.sequenceIndex ?? null,
      sequenceMultiplier: directDamageGroupSequenceMultiplier,
      configuredMultiplier:
        configuredDirectDamageGroupMultiplier,
      prePluginMultiplier:
        configuredDirectDamageGroupMultiplier,
      postPluginMultiplier:
        pluginResolvedDirectDamageGroupMultiplier,
      pluginMultiplierTrace,
      pluginTraceVerification:
        DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
      effectiveMultiplier:
        effectiveDirectDamageGroupMultiplier,
      damageGroupOnEnemyHitAllowed:
        hitConfirmAllowed &&
        directDamageGroupSequenceMultiplier > 0
    });
    damageEvents.push({
      id: damageEventId,
      ...(enemyShieldSettlement === undefined ? {} : { enemyShieldLogId: enemyShieldSettlement.hostLog.id }),
      elementalApplicationIcdLogId: null,
      kind: "direct",
      eventPriority: event.priority,
      eventSequence: event.sequence,
      parentDamageEventId: weaponProcLogId === undefined ? null : weaponProcLog[weaponProcLogId]!.parentDamageEventId,
      ...(weaponProcLogId === undefined ? {} : { weaponProcLogId }),
      ...(hit.hitWeakPoint === undefined ? {} : { hitWeakPoint: hit.hitWeakPoint }),
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
      ...(sourceSnapshots?.main === undefined ? {} : { sourceSnapshotLogId: sourceSnapshots.main }),
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
    settleTargetHealth(damageEvents[damageEventId]!, hit.attackTag ?? "none");
    moonlightArtifactRuntime?.onEnemyDamage(event.frame, actorId, element, damageEventId);
    targetResolution.damageEventId = damageEventId;
    if (weaponProcLogId !== undefined) weaponProcLog[weaponProcLogId]!.damageEventIds.push(damageEventId);
    targetResolution.potentialDamage = calculation.finalDamage;
    targetResolution.finalDamage = finalDamage;
    targetResolution.displayDamage = displayDamage;
    if (
      hit.application !== undefined &&
      elementalApplicationIcdDecision !== null
    ) {
      const elementalApplicationIcdLogId = appendElementalApplicationIcdLog({
        hitResolutionLogId: targetResolutionId,
        damageEventId,
        frame: event.frame,
        sourceActorId: actorId,
        targetId,
        hitId,
        hitGroupId,
        element,
        application: hit.application,
        decision: elementalApplicationIcdDecision
      });
      targetResolution.elementalApplicationIcdLogId =
        elementalApplicationIcdLogId;
      damageEvents[damageEventId]!.elementalApplicationIcdLogId =
        elementalApplicationIcdLogId;
      if (enemyShieldSettlement !== undefined) enemyShieldHost!.linkApplicationLog(enemyShieldSettlement.hostLog.id, elementalApplicationIcdLogId);
    }
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
    if (weaponProcLogId !== undefined && weaponProcLog[weaponProcLogId]!.weaponId === "eyeofperception" &&
        !eyeAdvancedActions.has(action.id)) {
      eyeAdvancedActions.add(action.id);
      const bounceIndex = Number(/:bounce-(\d+)$/.exec(action.id)?.[1] ?? 0);
      if (bounceIndex < 4) {
        const center = resolveTargetPosition(targetId, event.frame);
        if (center !== null) {
          const selected = selectEyeTarget(center, event.frame);
          if (selected !== null) scheduleEyeBounce(event, { actorId, targetId: selected, cycle,
            weaponProcLogId, triggerFrame: weaponProcLog[weaponProcLogId]!.frame,
            coefficient: weaponProcLog[weaponProcLogId]!.coefficient }, bounceIndex + 1);
        }
      }
    }
    if (sacrificialRuntime?.actor(actorId) !== undefined && !mechanicsTruncatedBefore && reactionAudit.mechanicsTruncation === null) {
      const decision = sacrificialRuntime.onDamage({ actorId, frame: event.frame, damageEventId, activeCharacterId,
        attackTag: hit.attackTag ?? null, damage: finalDamage,
        getSkillCooldown: () => serialSkillCooldownRemaining(skillCooldownStates.get(actorId)!, event.frame) });
      const id = sacrificialLog.length;
      const skillCooldownLogId = decision.outcome === "triggered"
        ? recordSkillCooldown(event, actorId, "reset", resetSerialSkillCooldown(skillCooldownStates.get(actorId)!, event.frame), null, id) : null;
      sacrificialLog.push({ ...decision, id, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, skillCooldownLogId });
    }
    const weaponProcActor = weaponProcRuntime?.actor(actorId);
    if (weaponProcActor !== undefined && !mechanicsTruncatedBefore && reactionAudit.mechanicsTruncation === null) {
      const definition = getWeaponProcDefinition(weaponProcActor.weaponId)!;
      const payload: WeaponProcCallbackPayload = { actorId, parentDamageEventId: damageEventId, targetId, attackTag: hit.attackTag ?? null, damage: finalDamage, cycle,
        ...(definition.requiresWeakPoint ? { hitWeakPoint: hit.hitWeakPoint! } : {}),
        ...(definition.lifecycleKind === undefined && !definition.requiresWeakPoint && definition.randomTrigger === undefined && definition.snapshotTiming !== "delivery" ? {} : { sourceActionId: action.id, sourceHitId: hitId, parentHitFrame: event.frame,
          parentEventPriority: event.priority, parentEventSequence: event.sequence }) };
      if (definition.randomTrigger !== undefined || definition.lifecycleKind !== undefined || definition.requiresWeakPoint) push(timeSeconds, "weaponProcCallback", payload, event.priority);
      else executeWeaponProcCallback(event, payload);
    }
    const favoniusActor = favoniusRuntime?.actor(actorId);
    if (favoniusActor !== undefined && enemyShieldSettlement === undefined) {
      if (critical.outcome === "expected") throw new Error("西风伤害回调收到了平均暴击结果，不能据此生成触发能量。");
      const decision = favoniusRuntime!.onDamage({ actorId, frame: event.frame, damageEventId, activeCharacterId,
        damage: finalDamage, critical: critical.outcome === "critical" });
      const favoniusLogId = favoniusLog.length;
      favoniusLog.push({ ...decision, id: favoniusLogId, timeSeconds, eventPriority: event.priority, eventSequence: event.sequence, particleEventId: null });
      if (decision.outcome === "triggered") {
        push(timeSeconds, "particleSpawn", { actorId, actionId: action.id, actionName: action.name, cycle, particleIndex: 0, favoniusLogId,
          particle: { id: `favonius:${actorId}:${damageEventId}`, source: `favonius:${favoniusActor.weaponId}`,
            element: "neutral", count: 3, kind: "particle", spawnOffset: 0, travelTime: favoniusActor.particleDelayFrames / 60 } });
      }
    }
    if (normalHitEnergyRuntime !== undefined && hit.normalHitEnergyTag !== undefined) {
      push(timeSeconds, "normalHitEnergy", { frame: event.frame, actorId, attackTag: hit.normalHitEnergyTag, damageEventId, hitGroupId });
    }
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
      recordOrderedQuickenState({
        audit: reactionAudit,
        targetId,
        targetName: targetProfile.name,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        frame: event.frame,
        timeSeconds
      });
      scheduleQuickenBloomFollowup({
        audit: reactionAudit,
        actorId,
        action,
        triggerHitId: hitId,
        triggerHitGroupId: hitGroupId,
        triggerDamageEventId: damageEventId,
        sourceTargetId: targetId,
        reactionBonusDelta: safeNumber(hit.reactionBonus),
        cycle,
        frame: event.frame,
        triggerEventType: "hit",
        triggerEventPriority: event.priority,
        triggerEventSequence: event.sequence
      });
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
    if (
      !recursiveShatterDeliveryEnabled &&
      shatterState !== null
    ) {
      recordShatterFrozenState({
        result: shatterState,
        targetId,
        targetName: targetProfile.name,
        sourceActorId: actorId,
        triggerDamageEventId: damageEventId,
        frame: event.frame,
        timeSeconds,
        freezeResistance: targetProfile.freezeResistance,
        triggerEventType: event.type,
        triggerEventPriority: event.priority,
        triggerEventSequence: event.sequence,
        nextIntraEventSequence,
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
          triggerFrame: event.frame,
          eventPriority: event.priority,
          eventSequence: event.sequence,
          nextIntraEventSequence
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
    const transformativeReactions =
      reactionAudit.transformativeReactions ??
      (reactionAudit.transformativeReaction === null
        ? []
        : [reactionAudit.transformativeReaction]);
    for (const transformativeReaction of transformativeReactions) {
      const reactionSourceStats = computeStats(
        actorId,
        timeSeconds
      );
      if (reactionSourceStats === undefined) {
        throw new Error(
          `Reaction source stats for "${actorId}" could not be resolved.`
        );
      }
      const sampledReactionBonus = reactionSourceStats.reactionBonus + safeNumber(hit.reactionBonus) +
        (transformativeReaction.scheduled ? artifactReactionBonus(actorId, transformativeReaction.reaction, event.frame) : 0);
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
          hitResolutionLogIds: [],
          elementalApplicationIcdLogIds: [],
          playerHitResolutionLogIds: [],
          playerDamageEventIds: [],
          reactionStatusLogIds: [],
        damageGroupDecisions: []
      });
      if (withinSimulation || (retainedOrdinaryReactionQueue && transformativeReaction.scheduled)) {
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
            reactionBonus: sampledReactionBonus,
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
      const existingSource = activeFrozenStateSources.get(targetId);
      const operation = frozenReaction.operation;
      const consumedByFrozenSwirl =
        operation === "consume" &&
        reactionAudit.swirlReactions.some(
          (entry) =>
            entry.reaction === "swirlCryo" &&
            entry.consumedAuraElement === "frozen",
        );
      const consumedByFrozenCrystallize =
        operation === "consume" &&
        reactionAudit.crystallizeReaction?.reaction === "crystallizeCryo" &&
        reactionAudit.crystallizeReaction.consumedAuraElement === "frozen";
      const consumedBySuperconduct =
        operation === "consume" &&
        reactionAudit.reactions.includes("superconduct");
      const frozenConsumptionReaction =
        reaction === "melt"
          ? "MELT"
          : consumedByFrozenSwirl
            ? "SWIRL"
            : consumedByFrozenCrystallize
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
      const frozenStateEntry: SimulationResult["frozenStateLog"][number] = {
        id: frozenStateLog.length,
        reaction:
          reaction === "melt"
            ? "melt"
            : consumedBySuperconduct
              ? "superconduct"
              : consumedByFrozenSwirl
                ? "swirlCryo"
                : consumedByFrozenCrystallize
                  ? "crystallizeCryo"
                : "freeze",
        generation: frozenReaction.generation,
        operation,
        frame: event.frame,
        ...targetLifecycleFields(
          targetId,
          event.frame,
          frozenReaction.expiresAtFrame
        ),
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
      };
      frozenStateLog.push(frozenStateEntry);
      appendFreezeBrokenAttackAudit({
        frozenStateEntry,
        depletionDamageEventId: damageEventId,
        sourceFreezeDamageEventId:
          existingSource?.triggerDamageEventId ?? null,
        triggerEventType: event.type,
        triggerEventPriority: event.priority,
        triggerEventSequence: event.sequence,
        nextIntraEventSequence,
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
          reason: "COEXISTING_AURA_REMOVED_BY_HIT",
          ...electroChargedV9Fields(
            periodicReaction.cadenceStatus,
            periodicReaction.waneListenerActive
          )
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
            safeNumber(hit.reactionBonus) + artifactReactionBonus(actorId, "electroCharged", event.frame),
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
          reason: null,
          ...electroChargedV9Fields(
            periodicReaction.cadenceStatus,
            periodicReaction.waneListenerActive
          )
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
        scheduleElectroChargedGlobalCadence(
          targetId,
          periodicReaction.generation,
          periodicReaction.operation,
          periodicReaction.nextTickFrame
        );
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
      eventPriority: event.priority,
      eventSequence: event.sequence,
      nextIntraEventSequence
    });
  }

  if (lunarMixedV2Runtime) {
    lunarMixedV2Runtime.finish(Math.round(config.duration * 60));
    (runtimeOptions as SimulationRuntimeOptions & { [lunarMixedV2RuntimeSink]?: (runtime: LunarMixedV2Runtime) => void })[lunarMixedV2RuntimeSink]?.(lunarMixedV2Runtime);
  }
  if (lunarMixedRuntime) (runtimeOptions as SimulationRuntimeOptions & { [lunarMixedRuntimeSink]?: (runtime: LunarMixedRuntime) => void })[lunarMixedRuntimeSink]?.(lunarMixedRuntime);
  if (stellarSwirlRuntime) (runtimeOptions as SimulationRuntimeOptions & { [stellarSwirlRuntimeSink]?: (runtime: StellarSwirlRuntime) => void })[stellarSwirlRuntimeSink]?.(stellarSwirlRuntime);
  lunarRuntime?.advanceThrough(Math.round(config.duration * 60));
  stellarConductRuntime?.advanceThrough(Math.round(config.duration * 60));
  lunarBloomRuntime?.advanceThrough(Math.round(config.duration * 60));
  if (stellarConductRuntime) (runtimeOptions as SimulationRuntimeOptions & { [stellarConductRuntimeSink]?: (runtime: StellarConductRuntime) => void })[stellarConductRuntimeSink]?.(stellarConductRuntime);
  if (lunarBloomRuntime) (runtimeOptions as SimulationRuntimeOptions & { [lunarBloomRuntimeSink]?: (runtime: LunarBloomRuntime) => void })[lunarBloomRuntimeSink]?.(lunarBloomRuntime);
  lunarCrystallizeRuntime?.advanceThrough(Math.round(config.duration * 60));
  if (lunarRuntime !== undefined) (runtimeOptions as SimulationRuntimeOptions & { [lunarChargedRuntimeSink]?: (runtime: LunarChargedRuntime) => void })[lunarChargedRuntimeSink]?.(lunarRuntime);
  if (lunarCrystallizeRuntime !== undefined) (runtimeOptions as SimulationRuntimeOptions & { [lunarCrystallizeRuntimeSink]?: (runtime: LunarCrystallizeRuntime) => void })[lunarCrystallizeRuntimeSink]?.(lunarCrystallizeRuntime);
  capturePendingCheckpointsThrough(Math.round(config.duration * 60));
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
        maxHp: hpState.initialMaxHp,
        ...(config.playerMaxHpModel === undefined ? {} : { finalMaxHp: hpState.maxHp, totalMaxHpAdjustment: hpState.totalMaxHpAdjustment }),
        initialHp: hpState.initialHp,
        finalHp: hpState.currentHp,
        ...(config.bondOfLifeModel === undefined ? {} : { initialBondOfLife: hpState.initialBondOfLife!, finalBondOfLife: hpState.currentBondOfLife! }),
        totalIncomingDamage:
          hpState.totalIncomingDamage,
        totalAbsorbedDamage:
          hpState.totalAbsorbedDamage,
        totalHpDamage: hpState.totalHpDamage,
        ...(healthChangesEnabled ? { totalHealing: hpState.totalHealing, totalOverheal: hpState.totalOverheal, totalHpConsumed: hpState.totalHpConsumed } : {}),
        hitCount: hpState.hitCount,
        zeroHpReached: hpState.currentHp === 0
      });
    }
  }
  const totalReactionSelfDamageTaken = playerDamageEvents.reduce(
    (sum, playerDamageEvent) =>
      sum + playerDamageEvent.finalDamage,
    0
  );
  const totalPlayerDamageTaken = totalReactionSelfDamageTaken + playerShieldLog.reduce((sum, row) => sum + (row.operation === "incoming-hit" ? row.hpResolution!.actualLoss : 0), 0);
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
  if (targetClocks !== null) {
    for (const target of enemyTargets) {
      const clock = targetClocks.get(target.id);
      if (clock === undefined) {
        throw new Error(
          `Missing final target clock for "${target.id}".`
        );
      }
      if (auraEngines?.get(target.id) === undefined) {
        clock.advanceTo(durationFrame);
      }
      recordTargetClockAdvance(
        target.id,
        "simulation-end"
      );
    }
  }
  if (
    config.reactionEngine?.mode === "aura-v8" ||
    config.reactionEngine?.mode === "aura-v9"
  ) {
    for (const target of enemyTargets) {
      const auraEngine = auraEngines?.get(target.id);
      if (auraEngine === undefined) {
        throw new Error(
          `Aura-v8 simulation end could not resolve target "${target.id}".`
        );
      }
      const unhandledCleanupResults =
        auraEngine.drainElectroChargedCleanupResults();
      if (unhandledCleanupResults.length !== 0) {
        throw new Error(
          `Aura-v8 target "${target.id}" reached simulation end with ${unhandledCleanupResults.length} unhandled EC cleanup result(s).`
        );
      }
    }
    for (const reactionTask of reactionTaskLog) {
      const cleanup = reactionTask.electroChargedCleanup;
      if (cleanup === null || cleanup.outcome !== "pending-at-end") {
        continue;
      }
      const finalTargetFrame =
        targetClocks?.get(reactionTask.targetId)?.getState().localFrame ??
        durationFrame;
      if (finalTargetFrame >= cleanup.deadlineTargetFrame) {
        throw new Error(
          `Aura-v8 EC cleanup task ${reactionTask.id} remained pending after target frame ${cleanup.deadlineTargetFrame}.`
        );
      }
    }
  }
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
  const targetClockSummaries: TargetClockSummary[] =
    targetClocks === null
      ? []
      : enemyTargets.map((target) => {
          const state = targetClocks
            .get(target.id)!
            .getState();
          const totalExtensionFrames =
            totalTargetHitlagExtensionById.get(target.id) ?? 0;
          const frozenFramesConsumed =
            state.globalFrame - state.localFrame;
          return {
            targetId: target.id,
            targetName: target.name,
            finalGlobalFrame: state.globalFrame,
            finalTargetFrame: state.localFrame,
            frozenFramesConsumed,
            frozenFramesRemaining: state.frozenFrames,
            hitlagApplications:
              targetHitlagApplicationCountById.get(
                target.id
              ) ?? 0,
            totalExtensionFrames
          };
        });
  const targetClockAudit = targetClockAuditSchema.parse(
    targetClocks === null
      ? {
          version: "1.0.0",
          mode: "disabled",
          hitlagStatus: "unsupported-enemy-hitlag",
          targets: []
        }
      : {
          version: "1.0.0",
          mode: "target-local-hitlag-v1",
          hitlagStatus: "modeled-enemy-hitlag",
          roundingModel: "ceil-ceil-v1",
          applicationOrder: "after-current-target-tick",
          mechanicsDataStatus: "fixed-gcsim-provisional",
          targets: targetClockSummaries
        }
  );
  const parsedTargetClockLog =
    targetClockLogSchema.parse(targetClockLog);
  const parsedTargetHitlagLog =
    targetHitlagLogSchema.parse(targetHitlagLog);
  targetTaskPhaseLog.sort(
    (left, right) =>
      left.globalFrame - right.globalFrame ||
      left.targetOrder - right.targetOrder ||
      left.eventPriority - right.eventPriority ||
      left.eventSequence - right.eventSequence
  );
  targetTaskPhaseLog.forEach((entry, index) => {
    entry.id = index;
  });
  targetTaskPhaseLogSchema.parse(targetTaskPhaseLog);
  const parsedTargetTaskPhaseLog = targetTaskPhaseLog;
  targetPhaseLog.sort(
    (left, right) =>
      left.globalFrame - right.globalFrame ||
      left.targetOrder - right.targetOrder
  );
  targetPhaseLog.forEach((entry, index) => {
    entry.id = index;
  });
  if (targetPhaseV2Enabled) {
    const preReactableDeliveryPointIdsByPhase = new Map<
      string,
      number[]
    >();
    if (targetPhaseV3Enabled) {
      // These points remain owned by the source callback delivery, not by the
      // recipient phase. They still extend the pre-Reactable boundary so the
      // later decay point, rather than an inline application, carries any
      // ordinary-durability bridge.
      for (const ownerPhase of targetPhaseLog) {
        if (ownerPhase.model !== "target-phase-v3") continue;
        for (const task of ownerPhase.targetTasks) {
          for (const attempt of task.delivery?.attempts ?? []) {
            if (
              attempt.applicationPhase !==
                "before-reactable-tick" ||
              attempt.targetStateTimelinePointId === null
            ) {
              continue;
            }
            const key = targetTaskPhaseKey(
              ownerPhase.globalFrame,
              attempt.targetId
            );
            const ids =
              preReactableDeliveryPointIdsByPhase.get(key) ?? [];
            ids.push(attempt.targetStateTimelinePointId);
            preReactableDeliveryPointIdsByPhase.set(key, ids);
          }
        }
      }
    }
    for (const phase of targetPhaseLog) {
      for (const transition of phase.reactableTick.transitions) {
        if (transition.kind !== "electro-charged-cleanup") {
          continue;
        }
        const reactionTask = reactionTaskLog[transition.reactionTaskLogId];
        const cleanup = reactionTask?.electroChargedCleanup;
        if (
          cleanup === undefined ||
          cleanup === null ||
          cleanup.outcome === "pending-at-end"
        ) {
          throw new Error(
            `Target phase ${phase.id} references unresolved EC cleanup task ${transition.reactionTaskLogId}.`
          );
        }
        cleanup.targetPhaseLogId = phase.id;
        const point =
          targetStateTimeline.points[transition.targetStateTimelinePointId];
        if (point === undefined) {
          throw new Error(
            `Target phase ${phase.id} EC cleanup transition references missing timeline point ${transition.targetStateTimelinePointId}.`
          );
        }
        const targetPhaseLink = point.links.find(
          (link) => link.kind === "target-phase-log"
        );
        if (targetPhaseLink === undefined) {
          point.links.push({
            kind: "target-phase-log",
            id: phase.id
          });
        } else {
          targetPhaseLink.id = phase.id;
        }
      }
      const targetTaskPointIds = new Set([
        ...phase.targetTasks.map(
          (task) => task.targetStateTimelinePointId
        ),
        ...(preReactableDeliveryPointIdsByPhase.get(
          targetTaskPhaseKey(
            phase.globalFrame,
            phase.targetId
          )
        ) ?? [])
      ]);
      const lastTargetTaskPointId =
        targetTaskPointIds.size === 0
          ? -1
          : Math.max(...targetTaskPointIds);
      const firstTransition =
        phase.reactableTick.transitions[0];
      // A same-target-frame durability gap is only legal across the complete
      // Reactable boundary. Its first explicit transition carries the bridge;
      // when the tick is sparse, the first subsequent incoming/core point
      // carries it instead.
      const bridgePoint =
        firstTransition === undefined
          ? targetStateTimeline.points.find(
              (point) =>
                point.targetId === phase.targetId &&
                point.frame === phase.globalFrame &&
                (point.targetFrame ?? point.frame) ===
                  phase.targetFrame &&
                point.id > lastTargetTaskPointId &&
                !targetTaskPointIds.has(point.id)
            )
          : targetStateTimeline.points[
              firstTransition.targetStateTimelinePointId
            ];
      if (bridgePoint === undefined) continue;
      let precedingTargetPoint:
        | (typeof targetStateTimeline.points)[number]
        | undefined;
      for (
        let pointIndex = bridgePoint.id - 1;
        pointIndex >= 0;
        pointIndex -= 1
      ) {
        const candidate =
          targetStateTimeline.points[pointIndex]!;
        if (candidate.targetId === phase.targetId) {
          precedingTargetPoint = candidate;
          break;
        }
      }
      const needsBridge =
        precedingTargetPoint !== undefined &&
        (precedingTargetPoint.targetFrame ??
          precedingTargetPoint.frame) ===
          phase.targetFrame &&
        !auraStateSnapshotsEqual(
          precedingTargetPoint.auraAfter,
          bridgePoint.auraBefore
        );
      if (!needsBridge) continue;
      const existingBridge = bridgePoint.links.find(
        (link) => link.kind === "target-phase-log"
      );
      if (
        existingBridge !== undefined &&
        existingBridge.id !== phase.id
      ) {
        throw new Error(
          `Target-state point ${bridgePoint.id} already bridges target phase ${existingBridge.id}; cannot also bridge ${phase.id}.`
        );
      }
      if (existingBridge === undefined) {
        bridgePoint.links.push({
          kind: "target-phase-log",
          id: phase.id
        });
      }
    }
  }
  if (burningRootInlineDeliveryByReactionDamageLogId.size > 0) {
    throw new Error(
      `Inline Burning deliveries were not settled: ${[
        ...burningRootInlineDeliveryByReactionDamageLogId.keys()
      ].join(", ")}.`
    );
  }
  if (pendingFreezeBrokenCallbacks.size > 0) {
    throw new Error(
      `Freeze Broken callback tasks were not settled: ${[
        ...pendingFreezeBrokenCallbacks.keys(),
      ].join(", ")}.`,
    );
  }
  const settledFreezeBrokenAttackLog =
    config.freezeBrokenAttackModel.mode ===
    "fixed-gcsim-freeze-broken-callback-dispatch-v3"
      ? freezeBrokenCallbackAuditBuffer.assertSettled()
      : freezeBrokenAttackLog;
  const callbackRegistrationLog = projectCallbackRegistrationLog();
  const unsettledSchedulerAttachment =
    basicReactionSchedulerLog.find(
      (entry) =>
        entry.kind === "swirl-attack-resolution" &&
        entry.disposition === "deferred" &&
        entry.pairedLogId < 0
    );
  if (unsettledSchedulerAttachment !== undefined) {
    throw new Error(
      `Deferred Swirl Aura attachment for scheduler log ${unsettledSchedulerAttachment.id} was not settled.`
    );
  }
  if (targetPhaseV3Enabled) {
    targetPhaseV3LogV148Schema.parse(targetPhaseLog);
  } else {
    targetPhaseV2LogSchema.parse(targetPhaseLog);
  }
  const parsedTargetPhaseLog = targetPhaseLog;

  const executionAudit: SimulationExecutionAudit | undefined = executionOptions === undefined ? undefined : {
    version: "execution-audit-v1",
    hits: captureResolvedHits ? damageEvents.map((damageEvent) => {
      if (damageEvent.kind === "direct") {
        const captured = resolvedHitContexts.get(damageEvent.id);
        if (!captured) throw new Error(`Missing resolved calculation input for damage event ${damageEvent.id}.`);
        return captured;
      }
      const factors = damageEvent.transformativeReactionFactors;
      if (!factors) throw new Error(`Missing transformative calculation input for damage event ${damageEvent.id}.`);
      const input = {
        characterLevel: factors.characterLevel,
        elementalMastery: factors.elementalMastery,
        reactionBonus: factors.reactionBonus,
        baseMultiplier: factors.baseMultiplier,
        effectiveResistance: factors.effectiveResistance
      };
      return {
        eventId: damageEvent.id,
        inputKind: "transformative" as const,
        input,
        critical: { mode: "configured" as const, eligible: false, outcome: "ineligible" as const, roll: null, drawIndex: null },
        ...(executionOptions.detailedTraces === true ? { trace: calculateTransformativeDamageTrace(input).trace } : {})
      };
    }) : [],
    phaseCheckpoints,
    checkpointCoverage: {
      complete: requestedCheckpointFrames.length > 0 && checkpointBlockers.size === 0 && phaseCheckpoints.length === requestedCheckpointFrames.length,
      missingDimensions: requestedCheckpointFrames.length > 0 && checkpointBlockers.size > 0
        ? ["energy", "cooldownsAndCharges", "buffsAndDebuffs", "entities", "auras", "resourcesAndHp", "icdAndTriggerHistory", "pendingEvents", "activeCharacterAndActionPhase"] : [],
      reasons: requestedCheckpointFrames.length === 0 ? ["本次未请求完整相位检查点。"] : [...checkpointBlockers]
    },
    criticalSampling: executionOptions.criticalSampling === undefined ? null : {
      algorithm: "mulberry32-v1", seed: criticalRandomSeed, drawCount: criticalDrawCount
    }
  };
  const simulationResult: SimulationResult = {
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
      targetMechanicsTruncationLog.length === 0 &&
      settledFreezeBrokenAttackLog.length === 0
        ? "complete"
        : "partial",
    config: resultConfig,
    actorPoses,
    enemyTargets,
    ...(targetHealthRuntime === undefined ? {} : { targetHealthLog: targetHealthRuntime.log, targetHealthSummaries: targetHealthRuntime.summaries() }),
    ...(enemyShieldHost === undefined ? {} : { enemyShieldLog: enemyShieldHost.log, enemyShieldState: enemyShieldHost.captureState(), totalPotentialDamage: damageEvents.reduce((sum, row) => sum + row.potentialDamage, 0) }),
    damageEvents,
    hitEvents: damageEvents,
    directDamageGroupLog,
    elementalApplicationIcdLog,
    hitResolutionLog,
    targetClockAudit,
    targetClockLog: parsedTargetClockLog,
    targetHitlagLog: parsedTargetHitlagLog,
    targetTaskPhaseLog: parsedTargetTaskPhaseLog,
    targetPhaseLog: parsedTargetPhaseLog,
    targetMechanicsTruncationLog,
    reactionDamageLog,
    reactionDamageGroupResetLog,
    basicReactionSchedulerLog,
    freezeBrokenAttackLog: settledFreezeBrokenAttackLog,
    callbackRegistrationLog,
    callbackDeliveryLog,
    reactionTaskLog,
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
    ...(healthChangesEnabled ? { playerHealthEvents } : {}),
    ...(config.playerMaxHpModel === undefined ? {} : { playerMaxHpEvents }),
    ...(periodicEntitiesEnabled ? { periodicEntityLog } : {}),
    ...(actionConditionsEnabled ? { actionConditionLog } : {}),
    playerHpTimeline,
    playerHpSummaries,
    playerSelfDamageStatus,
    totalPlayerDamageTaken,
    totalReactionSelfDamageTaken,
    targetPhaseTimeline,
    targetMotionTimeline,
    skippedActions,
    actionLog,
    ...(staminaRuntime === undefined ? {} : { stamina: staminaRuntime.finish(Math.round(config.duration * 60)) }),
    ...(resultConfig.normalHitEnergyModel === undefined ? {} : { normalHitEnergyLog }),
    ...(resultConfig.favoniusModel === undefined ? {} : { favoniusLog }),
    ...(resultConfig.weaponProcModel === undefined ? {} : { weaponProcLog }),
    ...(hasStatefulWeaponProc(resultConfig.weaponProcModel) ? { weaponProcLifecycleLog } : {}),
    ...(resultConfig.thrillingTalesModel === undefined ? {} : { thrillingTalesLog }),
    ...(resultConfig.sacrificialModel === undefined ? {} : { sacrificialLog }),
    ...(resultConfig.artifactEventModel === undefined ? {} : { artifactEventLog }),
    ...(playerShieldRuntime === undefined ? {} : { playerShieldLog, playerShieldState: playerShieldRuntime.captureState() }),
    ...(explicitSourceSnapshotsEnabled ? { sourceSnapshotLog } : {}),
    ...(sourceNormalChainRuntime === undefined ? {} : { sourceNormalChainLog, sourceNormalChainState: sourceNormalChainRuntime.captureState() }),
    ...(weaponHitStackRuntime === undefined ? {} : { weaponHitStackLog, weaponHitStackState: weaponHitStackRuntime.captureState() }),
    ...(artifactBuffRuntime === undefined ? {} : { artifactBuffLog, artifactBuffState: artifactBuffRuntime.captureState() }),
    ...(moonlightArtifactRuntime === undefined ? {} : { moonlightArtifactLog: moonlightArtifactRuntime.log }),
    ...(artifactDamageRuntime === undefined ? {} : { artifactDamageLog, artifactDamageState: artifactDamageRuntime.captureState() }),
    ...(resultConfig.nightsoulBurstModel === undefined ? {} : { nightsoulBurstLog }),
    ...(runtimeSkillActors.size === 0 ? {} : { skillCooldownLog }),
    ...([...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => (action.statConversions?.length ?? 0) > 0) ? { statConversionLog } : {}),
    ...([...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => (action.energyCostFrame ?? 0) > 0) ? { energyCostLog } : {}),
    ...([...resultConfig.rotation, ...(resultConfig.timeline?.abilities ?? [])].some(action => (action.summons?.length ?? 0) > 0) ? { summonLog } : {}),
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
    ...(executionAudit === undefined ? {} : { executionAudit }),
    ...(timelineExecution === undefined ? {} : { timelineExecution })
  };
  if (weaponHitStackRuntime !== undefined && executionOptions?.detailedTraces === true) {
    for (const captured of simulationResult.executionAudit?.hits ?? []) {
      const damage = simulationResult.damageEvents[captured.eventId];
      if (damage !== undefined && captured.trace !== undefined) captured.trace = [...weaponHitStackTraceForDamageEvent(simulationResult, damage), ...captured.trace];
    }
  }
  // Frozen reference facets still own the exact through-1.49 compact
  // ReactionA/B wire. Feed those validators a lossless nested projection;
  // the current 1.50 task-order proof validates the enriched decisions and
  // reset log separately before the result leaves sim-core.
  const frozenReactionDamageGroupFacet = {
    ...simulationResult,
    reactionDamageLog: simulationResult.reactionDamageLog.map((entry) => ({
      ...entry,
      damageGroupDecisions: entry.damageGroupDecisions.map(
        projectReactionDamageGroupAuditV149,
      ),
    })),
    playerDamageEvents: simulationResult.playerDamageEvents.map((event) => ({
      ...event,
      damageFactors: {
        ...event.damageFactors,
        damageGroupDecision:
          event.damageFactors.damageGroupDecision === null
            ? null
            : projectReactionDamageGroupAuditV149(
                event.damageFactors.damageGroupDecision,
              ),
      },
    })),
  };
  // target-phase-v3 is a frozen through-1.49 cross-log proof. Keep the live
  // 1.50 result untouched, but present that checker with the exact historical
  // result/config identity it owns, on top of the lossless nested V149 damage
  // group projection above.
  const frozenTargetPhaseV3Facet = Object.freeze({
    ...frozenReactionDamageGroupFacet,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    config: Object.freeze({
      ...frozenReactionDamageGroupFacet.config,
      schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    }),
  });
  // The public reference schema still accepts and descriptor-cleans a full
  // result. The simulator only needs to validate the fields that participate
  // in its cross-log proof, so avoid cloning unrelated timelines and summaries
  // on every run.
  const validatesNearbyElectroChargedPropagation =
    simulationResult.config.electroChargedPropagationModel
      .mode === "nearby-wet-radius-v1";
  if (
    !validatesNearbyElectroChargedPropagation &&
    simulationResult.targetStateTimeline.points.some(
      (point) =>
        point.cause ===
        "electro-charged-propagation-candidate"
    )
  ) {
    throw new Error(
      "single-target-v1 cannot emit Electro-Charged propagation candidate observations."
    );
  }
  // Diagnostic observers receive detached values and cannot change production output.
  // The explicit new protocol replays all witnesses before supplying exact positions;
  // default and historical calls retain their original reference rules.
  runtimeOptions[directHitStepWitnessSink]?.({events:deepClone(directHitStepEvents.filter(e=>e.allocationCount>0)),propagationEvents:deepClone(propagationStepEvents),result:deepClone(simulationResult)});
  const eventStepPositions = runtimeOptions[eventStepProtocol]
    ? verifiedStepPositions({events:directHitStepEvents.filter(e=>e.allocationCount>0),propagationEvents:propagationStepEvents,result:simulationResult})
    : undefined;
  assertTrustedReactionDeliveryResultReferences({
    schemaVersion: simulationResult.schemaVersion,
    engineVersion: simulationResult.engineVersion,
    config: {
      schemaVersion: simulationResult.config.schemaVersion,
      engineVersion: simulationResult.config.engineVersion,
      duration: simulationResult.config.duration,
      rotation: simulationResult.config.rotation,
      enemy: {
        ...(simulationResult.config.enemy.targets === undefined
          ? {}
          : {
              targets:
                simulationResult.config.enemy.targets.map(
                  ({
                    id,
                    name,
                    position,
                    hitboxRadius
                  }) => ({
                    id,
                    name,
                    ...(position === undefined
                      ? {}
                      : { position }),
                    ...(hitboxRadius === undefined
                      ? {}
                      : { hitboxRadius })
                  })
                )
            }),
        ...(simulationResult.config.enemy.targetMotions ===
        undefined
          ? {}
          : {
              targetMotions:
                simulationResult.config.enemy.targetMotions.map(
                  ({
                    id,
                    label,
                    targetId,
                    startFrame,
                    endFrame,
                    endPosition
                  }) => ({
                    id,
                    label,
                    targetId,
                    startFrame,
                    endFrame,
                    endPosition
                  })
                )
            }),
        ...(simulationResult.config.enemy.targetPhases ===
        undefined
          ? {}
          : {
              targetPhases:
                simulationResult.config.enemy.targetPhases.map(
                  ({
                    id,
                    label,
                    targetId,
                    startFrame,
                    endFrame,
                    reason,
                    effects
                  }) => ({
                    id,
                    label,
                    targetId,
                    startFrame,
                    endFrame,
                    reason,
                    effects
                  })
                )
            })
      },
      ...(simulationResult.config.reactionEngine === undefined
        ? {}
        : {
            reactionEngine: {
              mode: simulationResult.config.reactionEngine.mode
            }
          }),
      targetTaskModel:
        simulationResult.config.targetTaskModel,
      targetClockModel:
        simulationResult.config.targetClockModel,
      ...(simulationResult.config.timeline === undefined
        ? {}
        : {
            timeline: {
              mode: simulationResult.config.timeline.mode,
              fps: simulationResult.config.timeline.fps,
              abilities: simulationResult.config.timeline.abilities
            }
          }),
      reactionDeliveryModel:
        simulationResult.config.reactionDeliveryModel,
      electroChargedPropagationModel:
        simulationResult.config
          .electroChargedPropagationModel
    },
    actionLog: simulationResult.actionLog,
    damageEvents: simulationResult.damageEvents,
    ...(simulationResult.weaponProcLog === undefined ? {} : { weaponProcLog: simulationResult.weaponProcLog }),
    reactionDamageLog: simulationResult.reactionDamageLog,
    ...(validatesNearbyElectroChargedPropagation
      ? {
          hitResolutionLog:
            simulationResult.hitResolutionLog,
          periodicReactionLog:
            simulationResult.periodicReactionLog,
          targetClockLog:
            simulationResult.targetClockLog,
          targetHitlagLog:
            simulationResult.targetHitlagLog,
          targetStateTimeline:
            simulationResult.targetStateTimeline
        }
      : {})
  }, eventStepPositions);
  const hasElectroChargedCleanupAudit =
    simulationResult.reactionTaskLog.some(
      (task) => task.electroChargedCleanup !== null
    );
  const hasElectroChargedPeriodicRows =
    simulationResult.periodicReactionLog.some(
      (event) => event.reaction === "electroCharged"
    );
  if (
    (config.reactionEngine?.mode === "aura-v8" ||
      config.reactionEngine?.mode === "aura-v9") &&
    (hasElectroChargedCleanupAudit ||
      hasElectroChargedPeriodicRows)
  ) {
    electroChargedCleanupResultReferencesSchema.parse(
      frozenReactionDamageGroupFacet,
    );
  }
  if (targetPhaseV3Enabled) {
    targetPhaseV3ResultReferencesSchema.parse(frozenTargetPhaseV3Facet);
  } else if (targetPhaseV2Enabled) {
    targetPhaseV2ResultReferencesSchema.parse(frozenReactionDamageGroupFacet);
  } else {
    // The public v2 result-reference schema deliberately performs a deep,
    // cross-log audit. Legacy/v1 runs cannot produce v2 phases, so reparsing
    // every damage/timeline snapshot here is pure overhead. Keep the
    // mode-exclusivity proof explicit, then validate the small identity
    // projection; v1's own full reference validator still runs below.
    for (const point of simulationResult.targetStateTimeline
      .points) {
      if (
        point.links.some(
          (link) => link.kind === "target-phase-log"
        )
      ) {
        throw new Error(
          `${simulationResult.config.targetTaskModel.mode} cannot carry target-phase-v2 timeline bridges.`
        );
      }
    }
    for (const entry of simulationResult.burningStateLog) {
      if (
        entry.callbackAuraBefore !== undefined ||
        entry.callbackAuraAfter !== undefined ||
        (entry.clockModel === "target-local-no-hitlag" &&
          entry.targetFrame !== undefined)
      ) {
        throw new Error(
          `${simulationResult.config.targetTaskModel.mode} cannot carry target-phase-v2 Burning callback or target-frame fields.`
        );
      }
    }
    targetPhaseV2ResultReferencesSchema.parse({
      schemaVersion: simulationResult.schemaVersion,
      engineVersion: simulationResult.engineVersion,
      config: {
        schemaVersion:
          simulationResult.config.schemaVersion,
        engineVersion:
          simulationResult.config.engineVersion,
        targetTaskModel:
          simulationResult.config.targetTaskModel,
        electroChargedPropagationModel:
          simulationResult.config
            .electroChargedPropagationModel
      },
      targetTaskPhaseLog: [],
      targetPhaseLog: simulationResult.targetPhaseLog
    });
  }
  const dendroCoreOutputEnabled =
    config.reactionEngine?.mode === "aura-v5" ||
    config.reactionEngine?.mode === "aura-v6" ||
    config.reactionEngine?.mode === "aura-v7" ||
    config.reactionEngine?.mode === "aura-v8" ||
    config.reactionEngine?.mode === "aura-v9";
  if (dendroCoreOutputEnabled) {
    dendroCoreResultReferencesSchema.parse(simulationResult);
  } else {
    // Aura modes before v5 cannot own Dendro-core lifecycle output. Their
    // empty-mode invariant is cheaper and stronger than deeply reparsing all
    // unrelated hit, damage, and target-state rows.
    if (
      simulationResult.dendroCoreLog.length !== 0 ||
      simulationResult.dendroCoreContactLog.length !== 0 ||
      simulationResult.dendroCoreTimeline.points.length !== 0 ||
      simulationResult.reactionTaskLog.length !== 0
    ) {
      throw new Error(
        `${config.reactionEngine?.mode ?? "legacy"} cannot produce Dendro-core or reaction-task output.`
      );
    }
    for (const point of simulationResult.targetStateTimeline
      .points) {
      if (
        point.links.some(
          (link) => link.kind === "reaction-task-log"
        )
      ) {
        throw new Error(
          `${config.reactionEngine?.mode ?? "legacy"} cannot carry reaction-task timeline links.`
        );
      }
    }
  }
  const lightweightDisabledPlayerAudit =
    config.playerDamageModel.mode === "disabled" &&
    simulationResult.dendroCoreLog.length === 0 &&
    simulationResult.reactionTaskLog.length === 0 &&
    simulationResult.crystallizeShieldLog.length === 0 &&
    simulationResult.crystallizeShieldTimeline.length === 0;
  if (!lightweightDisabledPlayerAudit) {
    playerDamageResultReferencesSchema.parse(simulationResult);
  } else {
    if (
      simulationResult.playerHitResolutionLog.length !== 0 ||
      simulationResult.playerDamageEvents.length !== 0 ||
      simulationResult.playerHpTimeline.version !== "1.0.0" ||
      simulationResult.playerHpTimeline.points.length !== 0 ||
      simulationResult.playerHpSummaries.length !== 0 ||
      simulationResult.playerSelfDamageStatus !==
        "unsupported-player-damage-model" ||
      simulationResult.totalPlayerDamageTaken !== 0 ||
      simulationResult.totalReactionSelfDamageTaken !== 0
    ) {
      throw new Error(
        "disabled player damage requires empty player logs, HP timeline, and summaries."
      );
    }
    validateDisabledPlayerDamageBackReferences(
      simulationResult
    );
    for (const entry of simulationResult.burningStateLog) {
      if (
        entry.selfDamageStatus !==
        simulationResult.playerSelfDamageStatus
      ) {
        throw new Error(
          `Burning lifecycle ${entry.id} has inconsistent player self-damage status.`
        );
      }
    }
    for (const [eventIndex, event] of
      simulationResult.damageEvents.entries()) {
      const burningStatus =
        event.reactionAudit.burningReaction
          ?.selfDamageStatus;
      if (
        burningStatus !== undefined &&
        burningStatus !==
          simulationResult.playerSelfDamageStatus
      ) {
        throw new Error(
          `Damage event ${eventIndex} has inconsistent Burning self-damage status.`
        );
      }
      for (const bloomAudit of
        event.reactionAudit.bloomReactions) {
        if (
          bloomAudit.selfDamageStatus !==
          simulationResult.playerSelfDamageStatus
        ) {
          throw new Error(
            `Damage event ${eventIndex} has inconsistent Bloom self-damage status.`
          );
        }
      }
    }
  }
  if (config.targetClockModel.mode === "target-local-hitlag-v1") {
    targetClockResultReferencesSchema.parse(frozenReactionDamageGroupFacet);
  } else {
    validateEnemyTargetOutputProjection(simulationResult);
    if (
      simulationResult.targetClockAudit.mode !== "disabled" ||
      simulationResult.targetClockLog.length !== 0 ||
      simulationResult.targetHitlagLog.length !== 0
    ) {
      throw new Error(
        "disabled target-local clocks require an empty clock audit and logs."
      );
    }
    const reactionTaskIds = new Set(
      simulationResult.reactionTaskLog.map((task) => task.id)
    );
    for (const point of simulationResult.targetStateTimeline
      .points) {
      if (
        point.targetFrame !== undefined &&
        point.targetFrame !== point.frame
      ) {
        throw new Error(
          `disabled target-local clock point ${point.id} must use its global frame.`
        );
      }
      for (const link of point.links) {
        if (
          link.kind === "reaction-task-log" &&
          !reactionTaskIds.has(link.id)
        ) {
          throw new Error(
            `Target-state point ${point.id} references missing reaction task ${link.id}.`
          );
        }
      }
    }
  }
  targetTaskPhaseResultReferencesSchema.parse(
    targetPhaseEnabled
      ? simulationResult
      : {
          schemaVersion: simulationResult.schemaVersion,
          engineVersion: simulationResult.engineVersion,
          config: {
            schemaVersion:
              simulationResult.config.schemaVersion,
            engineVersion:
              simulationResult.config.engineVersion,
            targetTaskModel:
              simulationResult.config.targetTaskModel,
            electroChargedPropagationModel:
              simulationResult.config
                .electroChargedPropagationModel
          },
          targetTaskPhaseLog:
            simulationResult.targetTaskPhaseLog
        }
  );
  return simulationResult;
}

/** Read actual prefix transitions; never infer a reset from its probability or a final expiry. */
function earliestRuntimeSkillFrame(
  rows: NonNullable<SimulationResult["skillCooldownLog"]>, actorId: string, requestedFrame: number,
  actionPriority: number, maxCharges: number, durationFrames: number,
): number {
  let candidate = requestedFrame;
  let available = maxCharges;
  let finalState = createSerialSkillCooldown(maxCharges);
  for (const row of rows) {
    if (row.actorId !== actorId) continue;
    const beforeRequest = row.frame < candidate || row.frame === candidate && row.eventPriority <= actionPriority;
    if (!beforeRequest && available > 0) return candidate;
    if (!beforeRequest) candidate = row.frame + Number(row.eventPriority > actionPriority);
    available = row.stateAfter.availableCharges;
    finalState = row.stateAfter;
  }
  return available > 0 ? candidate : Math.max(candidate, serialSkillCooldownWorker(finalState)?.frame ?? durationFrames + 1);
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
  const runtimeSkillReadyFrames = new Map<number, number>();
  const runtimeStellarSwirlJumps = new Map<number, { actorId: string; frame: number }>();
  const runtimeSkillActors = getRuntimeSkillCooldownActors(config);
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
    if (command?.type === "jump" && runtimeOptions.execution?.stellarSwirl !== undefined) {
      const prefix = compileLegalTimeline(config, { runtimeEnergyFailures, runtimeSkillReadyFrames,
        runtimeStellarSwirlJumps, stopAfterCommandIndex: commandIndex });
      const probeOptions: SimulationRuntimeOptions & { [stellarSwirlRuntimeSink]: (runtime: StellarSwirlRuntime) => void } = {
        ...legalRuntimeOptions,
        [stellarSwirlRuntimeSink]: runtime => {
          const used = runtime.log.find(row => row.type === "high-jump-use" &&
            row.details.timelineCommandIndex === commandIndex && row.details.allowed === true);
          if (used) runtimeStellarSwirlJumps.set(commandIndex, { actorId: command.actorId, frame: used.frame });
        }
      };
      simulateConfig(prefix.config, probeOptions, config, prefix.execution);
      continue;
    }
    if (
      command === undefined ||
      command.type === "wait" ||
      !("abilityId" in command)
    ) {
      continue;
    }
    const ability = abilities.get(command.abilityId);
    if (!ability) continue;
    if (ability.kind === "skill" && runtimeSkillActors.has(ability.actorId)) {
      const provisional = compileLegalTimeline(config, { runtimeEnergyFailures, runtimeSkillReadyFrames, runtimeStellarSwirlJumps,
        provisionalSkillCommandIndex: commandIndex, stopAfterCommandIndex: commandIndex });
      const request = provisional.execution.commandResults.find(row => row.commandIndex === commandIndex);
      if (request?.startFrame === null || request === undefined || request.status === "rejected") {
        runtimeSkillReadyFrames.set(commandIndex, 0);
        continue;
      }
      const before = compileLegalTimeline(config, { runtimeEnergyFailures, runtimeSkillReadyFrames, runtimeStellarSwirlJumps, stopAfterCommandIndex: commandIndex - 1 });
      const probe = simulateConfig(before.config, legalRuntimeOptions, config, before.execution);
      const readyFrame = earliestRuntimeSkillFrame(probe.skillCooldownLog!, ability.actorId, request.startFrame,
        actionEventPriority(ability), ability.maxCharges ?? 1, Math.round(config.duration * 60));
      runtimeSkillReadyFrames.set(commandIndex, readyFrame);
    }
    if ((ability.energyCost ?? 0) <= 0) continue;

    const prefix = compileLegalTimeline(config, {
      runtimeEnergyFailures,
      runtimeSkillReadyFrames,
      runtimeStellarSwirlJumps,
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
    runtimeEnergyFailures,
    runtimeSkillReadyFrames,
    runtimeStellarSwirlJumps
  });
  assertSourceActionExecution(config, compiled.execution);
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
  return assertTrustedSimulationResult(result);
}

export function simulate(
  rawConfig: unknown,
  runtimeOptions: SimulationRuntimeOptions = {}
): SimulationResult {
  if (runtimeOptions.execution?.lunarMixedV2 !== undefined && !(lunarMixedV2RuntimeSink in runtimeOptions)) throw new Error("Use simulateLunarMixedV2Profile for the complete shared-state result.");
  if (runtimeOptions.execution?.lunarMixed !== undefined && !(lunarMixedRuntimeSink in runtimeOptions)) throw new Error("Use simulateLunarMixedProfile for the complete shared-state result.");
  if (runtimeOptions.execution?.lunarCharged !== undefined && !(lunarChargedRuntimeSink in runtimeOptions)) throw new Error("Use simulateLunarChargedProfile for the complete combined damage result.");
  if (runtimeOptions.execution?.lunarCrystallize !== undefined && !(lunarCrystallizeRuntimeSink in runtimeOptions)) throw new Error("Use simulateLunarCrystallizeProfile for the complete combined damage result.");
  if (runtimeOptions.execution?.stellarConduct !== undefined && !(stellarConductRuntimeSink in runtimeOptions)) throw new Error("Use simulateStellarConductProfile for its full field audit.");
  if (runtimeOptions.execution?.lunarBloom !== undefined && !(lunarBloomRuntimeSink in runtimeOptions)) throw new Error("Use simulateLunarBloomProfile for the combined result.");
  if (runtimeOptions.execution?.stellarSwirl !== undefined && !(stellarSwirlRuntimeSink in runtimeOptions)) throw new Error("Use simulateStellarSwirlProfile for the complete combined result.");
  const config = migrateConfig(rawConfig);
  if ((config.artifactEventModel !== undefined || config.artifactDamageModel !== undefined || config.nightsoulBurstModel !== undefined) && runtimeOptions.compatibilityMode === "legacy-v0.1") {
    throw new Error("圣遗物事件与夜魂迸发需要 legal-frame-v1 真实帧时钟。");
  }
  // Ordinary artifact burst, pickup, heal and enemy-hit callbacks already run in
  // the shared queue. Special contributors also read its live buffed stats.
  // Nightsoul Burst still needs a delivery callback for special damage itself.
  if (config.nightsoulBurstModel !== undefined &&
      (runtimeOptions.execution?.lunarCharged || runtimeOptions.execution?.lunarCrystallize || runtimeOptions.execution?.lunarMixed ||
       runtimeOptions.execution?.lunarMixedV2 || runtimeOptions.execution?.stellarConduct || runtimeOptions.execution?.stellarSwirl || runtimeOptions.execution?.lunarBloom)) {
    throw new Error("夜魂迸发尚未接入月曜／星辉特殊伤害交付回调。");
  }
  if ((hasRandomWeaponProc(config.weaponProcModel) || hasStatefulWeaponProc(config.weaponProcModel) || hasMessengerWeaponProc(config.weaponProcModel) || hasDelayedWeaponProc(config.weaponProcModel)) && runtimeOptions.compatibilityMode === "legacy-v0.1") {
    throw new Error("随机／状态／弱点武器追击的实际同相位 FIFO 回调需要 legal-frame-v1 帧时钟。");
  }
  if (runtimeOptions.compatibilityMode === "legacy-v0.1" && [...config.rotation, ...(config.timeline?.abilities ?? [])].some(action => action.healthChanges?.length || action.periodicEntities?.length || action.conditionalHitGroups?.length || action.actionPhase !== undefined)) throw new Error("healthChanges / periodicEntities / actionPhase / conditionalHitGroups 需要 legal-frame-v1 的同帧事件顺序，不支持 legacy-v0.1 秒时钟。");
  assertSourceActionContract(config, runtimeOptions);
  assertNonNegativeFixedEnergyGains(config);
  if (
    (config.targetTaskModel.mode === "target-phase-v1" ||
      config.targetTaskModel.mode === "target-phase-v2" ||
      config.targetTaskModel.mode === "target-phase-v3") &&
    runtimeOptions.compatibilityMode === "legacy-v0.1"
  ) {
    throw new Error(
      `targetTaskModel ${config.targetTaskModel.mode} requires compatibilityMode legal-frame-v1.`
    );
  }
  if (config.timeline) {
    return simulateLegalTimeline(config, runtimeOptions);
  }
  return assertTrustedSimulationResult(
    simulateConfig(config, runtimeOptions)
  );
}

/** Independent special deliveries do not enter the ordinary DamageEvent queue.
 * A stack holder may still use every ordinary callback in this shared run,
 * but its own special OnEnemyDamage or full contributor Stats read needs a
 * separately authenticated delivery/read hook before that result can leave. */
function assertSpecialWeaponStackCallbacks(config: SimConfig, events: ReadonlyArray<{
  frame: number; ownerId: string; context: { contributors: ReadonlyArray<{ id: string }> };
}>): void {
  const holders = new Set(config.weaponHitStackModel?.actors.map(actor => actor.actorId) ?? []);
  if (holders.size === 0) return;
  for (const event of events) {
    const affected = [event.ownerId, ...event.context.contributors.map(contributor => contributor.id)]
      .find(actorId => holders.has(actorId));
    if (affected !== undefined) throw new Error(`武器叠层持有者 ${affected} 在第 ${event.frame} 帧参与独立月曜／星辉伤害；该段 OnEnemyDamage 与完整 Stats 读取尚未接入普通武器回调及结果重放。`);
  }
}

/** Complete versioned composite; direct damage and real LC events share one live run. */
export function simulateLunarChargedProfile(
  rawConfig: unknown,
  options: SimulationRuntimeOptions & LunarArtifactExecutionOptions & { party: NonNullable<NonNullable<SimulationOptions["execution"]>["lunarCharged"]>["party"] }
): LunarChargedSimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, artifacts, moonsignLevel, ...runtimeOptions } = options;
  const lunarCharged = { ...(runtimeOptions.execution?.lunarCharged?.artifacts === undefined ? {} : { artifacts: runtimeOptions.execution.lunarCharged.artifacts }), ...(runtimeOptions.execution?.lunarCharged?.moonsignLevel === undefined ? {} : { moonsignLevel: runtimeOptions.execution.lunarCharged.moonsignLevel }), ...(artifacts === undefined ? {} : { artifacts }), ...(moonsignLevel === undefined ? {} : { moonsignLevel }), profileId: "lunar-charged-reference-v1" as const, party };
  validateLunarChargedProfile(config, lunarCharged);
  assertExclusiveSpecialProfile(runtimeOptions, "lunarCharged");
  if (runtimeOptions.execution?.lunarCrystallize !== undefined) throw new Error("月感电与月结晶参考配置必须分别运行，当前不支持混合专属状态。");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1") throw new Error("月感电参考模式要求 legal-frame-v1：普通事件和雷云必须共用 60 FPS 整数帧。");
  if (runtimeOptions.plugins?.length) throw new Error("月感电参考模式尚未定义插件对特殊贡献者的修改接口。");
  let completed: LunarChargedRuntime | undefined;
  const runOptions: SimulationRuntimeOptions & { [lunarChargedRuntimeSink]: (runtime: LunarChargedRuntime) => void } = {
    ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, lunarCharged },
    [lunarChargedRuntimeSink]: (runtime) => { completed = runtime; }
  };
  const baseResult = simulate(config, runOptions);
  if (completed === undefined) throw new Error("LC runtime did not complete");
  const result = (completed as LunarChargedRuntime).result(baseResult);
  assertSpecialWeaponStackCallbacks(config, result.specialDamageEvents);
  return result;
}

export function simulateLunarCrystallizeProfile(
  rawConfig: unknown,
  options: SimulationRuntimeOptions & LunarArtifactExecutionOptions & { party: NonNullable<NonNullable<SimulationOptions["execution"]>["lunarCrystallize"]>["party"] }
): LunarCrystallizeSimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, artifacts, moonsignLevel, ...runtimeOptions } = options;
  const lunarCrystallize = { ...(runtimeOptions.execution?.lunarCrystallize?.artifacts === undefined ? {} : { artifacts: runtimeOptions.execution.lunarCrystallize.artifacts }), ...(runtimeOptions.execution?.lunarCrystallize?.moonsignLevel === undefined ? {} : { moonsignLevel: runtimeOptions.execution.lunarCrystallize.moonsignLevel }), ...(artifacts === undefined ? {} : { artifacts }), ...(moonsignLevel === undefined ? {} : { moonsignLevel }), profileId: "lunar-crystallize-reference-v1" as const, party };
  validateLunarCrystallizeProfile(config, lunarCrystallize);
  assertExclusiveSpecialProfile(runtimeOptions, "lunarCrystallize");
  if (runtimeOptions.execution?.lunarCharged !== undefined) throw new Error("月感电与月结晶参考配置必须分别运行，当前不支持混合专属状态。");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1") throw new Error("月结晶参考模式要求 legal-frame-v1：普通事件、月笼取样与投射必须共用 60 FPS 整数帧。");
  if (runtimeOptions.plugins?.length) throw new Error("月结晶参考模式尚未定义插件对特殊贡献者的修改接口。");
  let completed: LunarCrystallizeRuntime | undefined;
  const runOptions: SimulationRuntimeOptions & { [lunarCrystallizeRuntimeSink]: (runtime: LunarCrystallizeRuntime) => void } = {
    ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, lunarCrystallize },
    [lunarCrystallizeRuntimeSink]: (runtime) => { completed = runtime; }
  };
  const baseResult = simulate(config, runOptions);
  if (completed === undefined) throw new Error("Lunar-Crystallize runtime did not complete");
  const result = (completed as LunarCrystallizeRuntime).result(baseResult);
  assertSpecialWeaponStackCallbacks(config, result.specialDamageEvents);
  return result;
}


export function simulateStellarConductProfile(rawConfig: unknown, options: SimulationRuntimeOptions & { party: NonNullable<NonNullable<SimulationOptions["execution"]>["stellarConduct"]>["party"] }): StellarConductSimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, ...runtimeOptions } = options;
  const stellarConduct = { profileId: "stellar-conduct-reference-v1" as const, party };
  validateStellarConductProfile(config, stellarConduct);
  assertExclusiveSpecialProfile(runtimeOptions, "stellarConduct");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1" || runtimeOptions.plugins?.length) throw new Error("星导领域参考模式要求 legal-frame-v1，暂不接插件对领域状态的修改。");
  let completed: StellarConductRuntime | undefined;
  const runOptions: SimulationRuntimeOptions & { [stellarConductRuntimeSink]: (runtime: StellarConductRuntime) => void } = { ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, stellarConduct }, [stellarConductRuntimeSink]: runtime => { completed = runtime; } };
  const baseResult = simulate(config, runOptions);
  if (!completed) throw new Error("Stellar-Conduct runtime did not complete");
  return (completed as StellarConductRuntime).result(baseResult);
}

export function simulateLunarBloomProfile(rawConfig: unknown, options: SimulationRuntimeOptions & LunarArtifactExecutionOptions & { party: LunarBloomRuntimeOptions["party"]; abilities?: NonNullable<LunarBloomRuntimeOptions["abilities"]> }): LunarBloomSimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, abilities, artifacts, moonsignLevel, ...runtimeOptions } = options;
  const lunarBloom: LunarBloomRuntimeOptions = { ...(runtimeOptions.execution?.lunarBloom?.artifacts === undefined ? {} : { artifacts: runtimeOptions.execution.lunarBloom.artifacts }), ...(runtimeOptions.execution?.lunarBloom?.moonsignLevel === undefined ? {} : { moonsignLevel: runtimeOptions.execution.lunarBloom.moonsignLevel }), ...(artifacts === undefined ? {} : { artifacts }), ...(moonsignLevel === undefined ? {} : { moonsignLevel }), profileId: "lunar-bloom-reference-v1", party, ...(abilities === undefined ? {} : { abilities }) };
  if (abilities?.length && !config.timeline) throw new Error("显式月露涤荡来源能力要求合法帧 timeline，不能按旧 rotation 名称推定动作。");
  validateLunarBloomProfile(config, lunarBloom);
  assertExclusiveSpecialProfile(runtimeOptions, "lunarBloom");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1" || runtimeOptions.plugins?.length) throw new Error("月绽放参考配置要求 legal-frame-v1、无插件；尚未接入特殊暴击后的被动反馈。");
  let completed: LunarBloomRuntime | undefined;
  const runOptions: SimulationRuntimeOptions & { [lunarBloomRuntimeSink]: (runtime: LunarBloomRuntime) => void } = { ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, lunarBloom }, [lunarBloomRuntimeSink]: runtime => { completed = runtime; } };
  const baseResult = simulate(config, runOptions);
  if (!completed) throw new Error("Lunar-Bloom runtime did not complete");
  const result = (completed as LunarBloomRuntime).result(baseResult);
  assertSpecialWeaponStackCallbacks(config, result.specialDamageEvents);
  return result;
}

function assertExclusiveSpecialProfile(options: SimulationRuntimeOptions, chosen: string): void {
  for (const key of ["lunarCharged", "lunarCrystallize", "stellarConduct", "lunarBloom", "stellarSwirl", "lunarMixed", "lunarMixedV2"] as const) if (key !== chosen && options.execution?.[key] !== undefined) throw new Error("不得并列叠加独立参考配置；共享 Lunar 请使用显式 mixed 入口，Stellar 混合尚未实现。");
}

export function simulateLunarMixedV2Profile(rawConfig: unknown, options: SimulationRuntimeOptions & LunarArtifactExecutionOptions & { party: NonNullable<NonNullable<SimulationOptions["execution"]>["lunarMixedV2"]>["party"]; abilities?: NonNullable<LunarBloomRuntimeOptions["abilities"]> }): LunarMixedV2SimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, abilities, artifacts, moonsignLevel, ...runtimeOptions } = options;
  const lunarMixedV2 = { ...(runtimeOptions.execution?.lunarMixedV2?.artifacts === undefined ? {} : { artifacts: runtimeOptions.execution.lunarMixedV2.artifacts }), ...(runtimeOptions.execution?.lunarMixedV2?.moonsignLevel === undefined ? {} : { moonsignLevel: runtimeOptions.execution.lunarMixedV2.moonsignLevel }), ...(artifacts === undefined ? {} : { artifacts }), ...(moonsignLevel === undefined ? {} : { moonsignLevel }), profileId: "lunar-mixed-reference-v2" as const, party, ...(abilities === undefined ? {} : { abilities }) };
  validateLunarMixedV2Profile(config, lunarMixedV2);
  assertExclusiveSpecialProfile(runtimeOptions, "lunarMixedV2");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1" || runtimeOptions.plugins?.length) throw new Error("混合 Lunar v2 参考配置要求 legal-frame-v1、无插件；尚未接入特殊暴击后的被动反馈。");
  let completed: LunarMixedV2Runtime | undefined;
  const runOptions: SimulationRuntimeOptions & { [lunarMixedV2RuntimeSink]: (runtime: LunarMixedV2Runtime) => void } = { ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, lunarMixedV2 }, [lunarMixedV2RuntimeSink]: runtime => { completed = runtime; } };
  const baseResult = simulate(config, runOptions);
  if (!completed) throw new Error("Mixed Lunar v2 runtime did not complete");
  const result = (completed as LunarMixedV2Runtime).resultV2(baseResult);
  assertSpecialWeaponStackCallbacks(config, result.specialDamageEvents);
  return result;
}

export function simulateLunarMixedProfile(rawConfig: unknown, options: SimulationRuntimeOptions & LunarArtifactExecutionOptions & { party: NonNullable<NonNullable<SimulationOptions["execution"]>["lunarMixed"]>["party"] }): LunarMixedSimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, artifacts, moonsignLevel, ...runtimeOptions } = options;
  const lunarMixed = { ...(runtimeOptions.execution?.lunarMixed?.artifacts === undefined ? {} : { artifacts: runtimeOptions.execution.lunarMixed.artifacts }), ...(runtimeOptions.execution?.lunarMixed?.moonsignLevel === undefined ? {} : { moonsignLevel: runtimeOptions.execution.lunarMixed.moonsignLevel }), ...(artifacts === undefined ? {} : { artifacts }), ...(moonsignLevel === undefined ? {} : { moonsignLevel }), profileId: "lunar-mixed-reference-v1" as const, party };
  validateLunarMixedProfile(config, lunarMixed);
  assertExclusiveSpecialProfile(runtimeOptions, "lunarMixed");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1" || runtimeOptions.plugins?.length) throw new Error("混合 Lunar 参考配置要求 legal-frame-v1、无插件；尚未接入特殊暴击后的被动反馈。");
  let completed: LunarMixedRuntime | undefined;
  const runOptions: SimulationRuntimeOptions & { [lunarMixedRuntimeSink]: (runtime: LunarMixedRuntime) => void } = { ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, lunarMixed }, [lunarMixedRuntimeSink]: runtime => { completed = runtime; } };
  const baseResult = simulate(config, runOptions);
  if (!completed) throw new Error("Mixed Lunar runtime did not complete");
  const result = (completed as LunarMixedRuntime).result(baseResult);
  assertSpecialWeaponStackCallbacks(config, result.specialDamageEvents);
  return result;
}

/** Explicit guide-reference execution: fixed-source conflicts remain visible in every result. */
export function simulateStellarSwirlProfile(rawConfig: unknown, options: SimulationRuntimeOptions & { party: NonNullable<NonNullable<SimulationOptions["execution"]>["stellarSwirl"]>["party"] }): StellarSwirlSimulationResult {
  const config = migrateConfig(rawConfig);
  const { party, ...runtimeOptions } = options;
  const stellarSwirl = { profileId: "stellar-swirl-guide-reference-v1" as const, party };
  validateStellarSwirlProfile(config, stellarSwirl);
  assertExclusiveSpecialProfile(runtimeOptions, "stellarSwirl");
  if (runtimeOptions.compatibilityMode === "legacy-v0.1" || runtimeOptions.plugins?.length || runtimeOptions.execution?.criticalSampling) throw new Error("星扩散指南参考配置要求 legal-frame-v1、无插件；特殊贡献者仅支持精确期望／全部暴击／全部不暴击。");
  let completed: StellarSwirlRuntime | undefined;
  const runOptions: SimulationRuntimeOptions & { [stellarSwirlRuntimeSink]: (runtime: StellarSwirlRuntime) => void } = { ...runtimeOptions, compatibilityMode: "legal-frame-v1", execution: { ...runtimeOptions.execution, captureHits: true, stellarSwirl }, [stellarSwirlRuntimeSink]: runtime => { completed = runtime; } };
  const baseResult = simulate(config, runOptions);
  if (!completed) throw new Error("Stellar-Swirl runtime did not complete");
  const result = (completed as StellarSwirlRuntime).result(baseResult);
  assertSpecialWeaponStackCallbacks(config, result.specialDamageEvents);
  return result;
}
