export const CURRENT_SCHEMA_VERSION = "1.35.0" as const;
export const CURRENT_ENGINE_VERSION =
  "1.35.0-elemental-enemy-resistance" as const;
export const GENERAL_REACTION_ORDER_SCHEMA_VERSION = "1.34.0" as const;
export const GENERAL_REACTION_ORDER_ENGINE_VERSION =
  "1.34.0-general-reaction-order" as const;
export const TARGET_LOCAL_HITLAG_SCHEMA_VERSION = "1.33.0" as const;
export const TARGET_LOCAL_HITLAG_ENGINE_VERSION =
  "1.33.0-target-local-hitlag" as const;
export const SIMULATION_RUN_MANIFEST_VERSION = "1.0.0" as const;
/**
 * This identity algorithm is intentionally versioned and non-cryptographic.
 * It detects ordinary configuration drift; it is not an integrity signature.
 */
export const REPRODUCIBILITY_IDENTITY_ALGORITHM =
  "fnv1a32-v2" as const;
export const BURNING_REACTION_SCHEMA_VERSION = "1.30.0" as const;
export const BURNING_REACTION_ENGINE_VERSION =
  "1.30.0-burning-reaction" as const;
export const DENDRO_CORE_SCHEMA_VERSION = "1.31.0" as const;
export const DENDRO_CORE_ENGINE_VERSION =
  "1.31.0-dendro-cores" as const;
export const PLAYER_REACTION_DAMAGE_SCHEMA_VERSION =
  "1.32.0" as const;
export const PLAYER_REACTION_DAMAGE_ENGINE_VERSION =
  "1.32.0-player-reaction-damage" as const;
export const CATALYZE_REACTION_SCHEMA_VERSION = "1.29.0" as const;
export const CATALYZE_REACTION_ENGINE_VERSION =
  "1.29.0-catalyze-reaction" as const;
export const CRYSTALLIZE_REACTION_SCHEMA_VERSION = "1.28.0" as const;
export const SWIRL_REACTION_SCHEMA_VERSION = "1.27.0" as const;
export const SHATTER_REACTION_SCHEMA_VERSION = "1.26.0" as const;
export const FREEZE_REACTION_SCHEMA_VERSION = "1.25.0" as const;
export const ELECTRO_CHARGED_REACTION_SCHEMA_VERSION = "1.24.0" as const;
export const SUPERCONDUCT_REACTION_SCHEMA_VERSION = "1.23.0" as const;
export const OVERLOAD_REACTION_SCHEMA_VERSION = "1.22.0" as const;
export const ACTOR_POSE_SCHEMA_VERSION = "1.21.0" as const;
export const SECTOR_GEOMETRY_SCHEMA_VERSION = "1.20.0" as const;
export const CAPSULE_GEOMETRY_SCHEMA_VERSION = "1.19.0" as const;
export const ORIENTED_RECTANGLE_SCHEMA_VERSION = "1.18.0" as const;
export const TARGET_MOTION_SCHEMA_VERSION = "1.17.0" as const;
export const CIRCLE_GEOMETRY_SCHEMA_VERSION = "1.16.0" as const;
export const AOE_FANOUT_SCHEMA_VERSION = "1.15.0" as const;
export const MULTI_TARGET_REGISTRY_SCHEMA_VERSION = "1.14.0" as const;
export const TARGET_PHASE_TIMELINE_SCHEMA_VERSION = "1.13.0" as const;
export const TARGET_EFFECT_POLICY_SCHEMA_VERSION = "1.12.0" as const;
export const TARGET_HIT_RESOLUTION_SCHEMA_VERSION = "1.11.0" as const;
export const TIMELINE_STATE_CLEAR_SCHEMA_VERSION = "1.10.0" as const;
export const MOVEMENT_COMMAND_SCHEMA_VERSION = "1.9.0" as const;
export const HIT_PARTICLE_TRIGGER_SCHEMA_VERSION = "1.8.0" as const;
export const FIXED_ENERGY_ICD_SCHEMA_VERSION = "1.7.0" as const;
export const RUNTIME_ENERGY_SCHEMA_VERSION = "1.6.0" as const;
export const FOLLOWUP_CANCEL_SCHEMA_VERSION = "1.5.0" as const;
export const ACTION_STATE_SCHEMA_VERSION = "1.4.0" as const;
export const ICD_PROFILE_SCHEMA_VERSION = "1.3.0" as const;
export const PARTICLE_SCHEMA_VERSION = "1.2.0" as const;
export const PREVIOUS_SCHEMA_VERSION = "1.1.0" as const;
export const INITIAL_TYPED_SCHEMA_VERSION = "1.0.0" as const;
export const LEGACY_SCHEMA_VERSION = "0.1.0" as const;

export type Element =
  | "pyro"
  | "cryo"
  | "hydro"
  | "electro"
  | "anemo"
  | "geo"
  | "dendro"
  | "physical";

export type AmplifyingReaction =
  | "none"
  | "melt"
  | "reverseMelt"
  | "vaporize"
  | "reverseVaporize";

export type OneShotTransformativeReaction =
  | "overload"
  | "superconduct";
export type PeriodicTransformativeReaction = "electroCharged";
export type BurningReaction = "burning";
export type DendroCoreReaction =
  | "bloom"
  | "burgeon"
  | "hyperbloom";
export type ShatterReaction = "shatter";
export type SwirlReaction =
  | "swirlPyro"
  | "swirlHydro"
  | "swirlCryo"
  | "swirlElectro";
export type CrystallizeReaction =
  | "crystallizePyro"
  | "crystallizeHydro"
  | "crystallizeCryo"
  | "crystallizeElectro";
export type AdditiveReaction = "aggravate" | "spread";
export type QuickenReaction = "quicken";
export type UnsupportedMechanicsBranch =
  | "burning"
  | "bloom"
  | "legacy-multi-reaction-order"
  | "non-pyro-multi-reaction-order";
/** @deprecated Use UnsupportedMechanicsBranch for new integrations. */
export type UnsupportedDendroReaction = UnsupportedMechanicsBranch;
export type MechanicsResolutionStatus =
  | "authoritative"
  | "mechanics-truncated";
export type SimulationMechanicsStatus = "complete" | "partial";
export type TransformativeReaction =
  | OneShotTransformativeReaction
  | PeriodicTransformativeReaction
  | BurningReaction
  | ShatterReaction
  | SwirlReaction
  | DendroCoreReaction;
export type NonDamageReaction =
  | "freeze"
  | QuickenReaction
  | CrystallizeReaction;
export type ReactionType =
  | AmplifyingReaction
  | TransformativeReaction
  | AdditiveReaction
  | NonDamageReaction;

export type ScalingStat = "atk" | "hp" | "def" | "em";
export type SnapshotMode = "action" | "hit";
export type StrikeType = "default" | "blunt";
export type CritMode = "average" | "allCrit" | "noCrit";
export type EnergyMode = "configured" | "zero" | "full";
export type CompatibilityMode = "legacy-v0.1" | "legal-frame-v1";
export type VerificationStatus = "verified" | "provisional" | "user-supplied";
export type TimelineLegalityMode = "strict" | "wait";
export type AbilityKind = "skill" | "burst" | "normal" | "charge";
export type AbilityFollowupKind =
  | AbilityKind
  | "dash"
  | "jump"
  | "swap";
export type AuraElement = Extract<
  Element,
  "pyro" | "cryo" | "hydro" | "electro"
>;
export type PersistentAuraElement = AuraElement | "dendro";
export type AuraStateElement =
  | PersistentAuraElement
  | "quicken"
  | "frozen"
  | "burning"
  | "burningFuel";
export type IcdGroup = string;
export type ParticleElement = Exclude<Element, "physical"> | "neutral";
export type ParticleKind = "particle" | "orb";
export type TargetId = string;
export type TargetHitOutcome = "landed" | "miss";
export type TargetDamagePolicy = "normal" | "immune";
export type TargetAuraPolicy = "normal" | "blocked";
export type TargetHitConfirmPolicy = "normal" | "blocked";
export type PlayerReactionSelfDamageKind =
  | "burning"
  | "bloom"
  | "burgeon"
  | "hyperbloom";
export type PlayerSelfDamageStatus =
  | "unsupported-player-damage-model"
  | "modeled-player-reaction-damage";

export interface PlayerElementalResistances {
  pyro: number;
  cryo: number;
  hydro: number;
  electro: number;
  anemo: number;
  geo: number;
  dendro: number;
  physical: number;
}

export interface EnemyElementalResistances {
  pyro: number;
  cryo: number;
  hydro: number;
  electro: number;
  anemo: number;
  geo: number;
  dendro: number;
  physical: number;
}

export interface PlayerReactionSelfCharacterState {
  actorId: string;
  initialHpRatio: number;
  resistances: PlayerElementalResistances;
}

export interface DisabledPlayerDamageModel {
  mode: "disabled";
}

export interface ReactionSelfPlayerDamageModel {
  mode: "reaction-self-v1";
  position: { x: number; y: number };
  hitboxRadius: number;
  shieldMode: "crystallize-v1";
  zeroHpPolicy: "clamp-and-continue";
  characters: PlayerReactionSelfCharacterState[];
}

export type PlayerDamageModel =
  | DisabledPlayerDamageModel
  | ReactionSelfPlayerDamageModel;

export interface TargetEffectPolicy {
  damage: TargetDamagePolicy;
  aura: TargetAuraPolicy;
  hitConfirm: TargetHitConfirmPolicy;
}

export interface TargetPhaseDefinition {
  id: string;
  label: string;
  targetId: TargetId;
  /** Inclusive 60 FPS boundary. */
  startFrame: number;
  /** Exclusive 60 FPS boundary. */
  endFrame: number;
  reason: string;
  effects: TargetEffectPolicy;
}

/**
 * Scenario-level, single-target hit result. Ability blueprints intentionally
 * omit this field because whether an attack lands belongs to the target
 * scenario rather than immutable character data.
 */
export interface HitTargeting {
  targetId: TargetId;
  outcome: TargetHitOutcome;
  /** Required for misses or any non-normal target effect policy. */
  reason?: string;
  /**
   * Explicit scenario policy for a landed hit. This is not inferred from a
   * generic "invulnerable" flag because real target phases can block these
   * three layers independently.
   */
  effects?: TargetEffectPolicy;
}

export interface HitTargetingGroup {
  mode: "fanout";
  targets: HitTargeting[];
}

export type HitTargetingConfig = HitTargeting | HitTargetingGroup;

export interface ElementalApplication {
  /** Nominal elemental application strength (for example 1U, 2U, or 4U). */
  gaugeUnits: number;
  /** Independent ICD stream identifier within one actor and ICD group. */
  icdTag: string;
  icdGroup: IcdGroup;
}

export interface InitialAuraApplication {
  element: PersistentAuraElement;
  /** Nominal application strength; the normal aura starts at 0.8 × this value. */
  gaugeUnits: number;
}

export interface IcdProfile {
  /** Time-based reset boundary for the sequence, in 60 FPS frames. */
  resetFrames: number;
  /**
   * Per-hit elemental application permission sequence. User/default profiles
   * repeat by index; the engine-owned Burning profile clamps beyond its final
   * slot until the window resets.
   */
  applicationSequence: boolean[];
}

export interface AuraReactionEngineConfig {
  mode:
    | "aura-v1"
    | "aura-v2"
    | "aura-v3"
    | "aura-v4"
    | "aura-v5"
    | "aura-v6";
  initialAura?: InitialAuraApplication[];
  /** Character-specific ICD groups keyed by the id used on each hit. */
  icdProfiles?: Record<string, IcdProfile>;
  /**
   * Debug-only escape hatch. Formal presets must leave this false and rely on
   * Aura/ICD state rather than manually labelling reactions.
   */
  debugAllowReactionOverride?: boolean;
}

/**
 * Enemy target-local time is an independent mechanics boundary. It is not an
 * Aura-engine revision because Hitlag can pause target state without changing
 * the reaction rule set.
 */
export type TargetClockModel =
  | { mode: "disabled" }
  | { mode: "target-local-hitlag-v1" };

export interface CharacterStats {
  baseAtk: number;
  atkPct: number;
  flatAtk: number;
  baseHp: number;
  hpPct: number;
  flatHp: number;
  baseDef: number;
  defPct: number;
  flatDef: number;
  em: number;
  critRate: number;
  critDmg: number;
  dmgBonus: number;
  defIgnore: number;
  reactionBonus: number;
  /** 1.0 means 100% Energy Recharge. */
  energyRecharge: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  element: Element;
  color: string;
  level: number;
  energyMax: number;
  initialEnergy: number;
  stats: CharacterStats;
}

export interface EnemyProfile {
  level: number;
  resistance: number;
  /** Optional exact per-element base resistance table. */
  resistances?: EnemyElementalResistances;
  defReduction: number;
  /** 0 = normal Frozen decay; 1 = immune to Frozen durability. */
  freezeResistance?: number;
  /**
   * Optional named target registry. When omitted, the engine materializes the
   * compatibility target enemy-0 from the shared enemy stats.
   */
  targets?: EnemyTargetProfile[];
  /**
   * Sorted, non-overlapping target-state windows. Per-hit targeting effects
   * override the active phase while a scripted miss bypasses all effect layers.
   */
  targetPhases?: TargetPhaseDefinition[];
  /**
   * Sorted, non-overlapping linear motion segments. A target holds its prior
   * position in gaps and reaches endPosition exactly at endFrame.
   */
  targetMotions?: TargetMotionDefinition[];
}

export interface EnemyTargetProfileBase {
  id: TargetId;
  name: string;
  level?: number;
  defReduction?: number;
  /** Overrides the shared enemy Frozen resistance. */
  freezeResistance?: number;
  /** Overrides reactionEngine.initialAura for this target. */
  initialAura?: InitialAuraApplication[];
  position?: { x: number; y: number };
  hitboxRadius?: number;
}

export type EnemyTargetProfile = EnemyTargetProfileBase &
  (
    | {
        /** Overrides every element with one scalar value. */
        resistance?: number;
        resistances?: never;
      }
    | {
        resistance?: never;
        /** Exact eight-element override; mutually exclusive with resistance. */
        resistances: EnemyElementalResistances;
      }
  );

export interface ResolvedEnemyTargetProfile {
  id: TargetId;
  name: string;
  level: number;
  /**
   * Compatibility scalar fallback. When resistances is present, damage uses
   * that table and this value remains only for legacy consumers.
   */
  resistance: number;
  /** Present only when this target resolves to per-element base resistance. */
  resistances?: EnemyElementalResistances;
  defReduction: number;
  freezeResistance: number;
  initialAura: InitialAuraApplication[];
  position: { x: number; y: number } | null;
  hitboxRadius: number;
}

export interface CircleHitGeometry {
  kind: "circle";
  coordinateSpace?: GeometryCoordinateSpace;
  origin: { x: number; y: number };
  radius: number;
}

export interface RectangleHitGeometry {
  kind: "rectangle";
  coordinateSpace?: GeometryCoordinateSpace;
  origin: { x: number; y: number };
  halfWidth: number;
  halfHeight: number;
  rotationDegrees: number;
}

export interface CapsuleHitGeometry {
  kind: "capsule";
  coordinateSpace?: GeometryCoordinateSpace;
  start: { x: number; y: number };
  end: { x: number; y: number };
  radius: number;
}

export interface SectorHitGeometry {
  kind: "sector";
  coordinateSpace?: GeometryCoordinateSpace;
  origin: { x: number; y: number };
  radius: number;
  directionDegrees: number;
  angleDegrees: number;
}

export type HitGeometry =
  | CircleHitGeometry
  | RectangleHitGeometry
  | CapsuleHitGeometry
  | SectorHitGeometry;

export type GeometryCoordinateSpace = "world" | "actor-local";

/**
 * Actor-local geometry after the core has projected it into world space.
 * Keeping this separate from input HitGeometry prevents result consumers from
 * repeating pose transforms.
 */
export type ResolvedWorldHitGeometry =
  | (Omit<CircleHitGeometry, "coordinateSpace"> & {
      coordinateSpace: "world";
    })
  | (Omit<RectangleHitGeometry, "coordinateSpace"> & {
      coordinateSpace: "world";
    })
  | (Omit<CapsuleHitGeometry, "coordinateSpace"> & {
      coordinateSpace: "world";
    })
  | (Omit<SectorHitGeometry, "coordinateSpace"> & {
      coordinateSpace: "world";
    });

export interface ActorPoseDefinition {
  actorId: string;
  position: { x: number; y: number };
  facingDegrees: number;
}

export interface TargetMotionDefinition {
  id: string;
  label: string;
  targetId: TargetId;
  startFrame: number;
  endFrame: number;
  endPosition: { x: number; y: number };
}

export interface FlatDamageSource {
  ownerId?: string;
  stat?: ScalingStat;
  multiplier: number;
}

export interface TargetHitlagDefinition {
  /**
   * Fixed-reference halt duration before the engine-owned nested-ceil
   * calculation. Fractional values are valid.
   */
  haltFrames: number;
  /** Enemy Hitlag factor in the inclusive range [0, 1]. */
  factor: number;
}

export interface HitDefinition {
  id?: string;
  offset: number;
  label?: string;
  scaling: number;
  scalingStat?: ScalingStat;
  element?: Element;
  /**
   * Frozen/Shatter strike classification. Other gcsim strike categories are
   * intentionally not represented until they affect a modeled mechanic.
   */
  strikeType?: StrikeType;
  /** gcsim poise damage; only valid for blunt hits and used to reduce Frozen. */
  poiseDamage?: number;
  /** Atomic enemy-target Hitlag input; defense-halt bonuses are not public. */
  targetHitlag?: TargetHitlagDefinition;
  targeting?: HitTargetingConfig;
  geometry?: HitGeometry;
  application?: ElementalApplication;
  reaction?: AmplifyingReaction;
  reactionOverride?: AmplifyingReaction;
  snapshot?: SnapshotMode;
  scalingOwnerId?: string;
  creditId?: string;
  flat?: number;
  flatSources?: FlatDamageSource[];
  dmgBonus?: number;
  defIgnore?: number;
  defReduction?: number;
  resShred?: number;
  critRate?: number;
  critDmg?: number;
  reactionBonus?: number;
  ampBase?: number;
  groupMultiplier?: number;
}

export type BuffStat =
  | "atkFlat"
  | "atkPct"
  | "hpFlat"
  | "hpPct"
  | "defFlat"
  | "defPct"
  | "dmgBonus"
  | "critRate"
  | "critDmg"
  | "em"
  | "defIgnore"
  | "reactionBonus"
  | "energyRecharge";

export type StatusTarget = "team" | "self" | string | string[];

export interface BuffDefinition {
  kind?: "buff";
  key?: string;
  label?: string;
  target?: StatusTarget;
  stat: BuffStat;
  value: number;
  duration: number;
  offset?: number;
}

export interface DebuffDefinition {
  kind?: "debuff";
  key?: string;
  label?: string;
  element?: Element | "all";
  resShred?: number;
  defReduction?: number;
  duration: number;
  offset?: number;
}

export type StatusDefinition = BuffDefinition | DebuffDefinition;

export interface EnergyEvent {
  target?: "team" | string | string[];
  amount: number;
  offset?: number;
  source?: string;
  internalCooldown?: {
    key: string;
    duration: number;
  };
}

export interface ParticleCountRange {
  min: number;
  max: number;
  /** Discrete inclusive roll step. Defaults to 1. */
  step?: number;
}

export type ParticleCount = number | ParticleCountRange;

export interface ParticleDefinition {
  id?: string;
  source?: string;
  kind?: ParticleKind;
  element: ParticleElement;
  count: ParticleCount;
  spawnOffset?: number;
  travelTime: number;
  trigger?: {
    kind: "hit-confirm";
    hitIds: string[];
    internalCooldown?: {
      key: string;
      duration: number;
    };
  };
}

export interface ActionDefinition {
  id: string;
  actorId: string;
  name: string;
  at: number;
  once?: boolean;
  cycles?: number[];
  everyNCycles?: number;
  cycleRemainder?: number;
  energyCost?: number;
  hits?: HitDefinition[];
  buffs?: BuffDefinition[];
  debuffs?: DebuffDefinition[];
  energyGains?: EnergyEvent[];
  particles?: ParticleDefinition[];
  /** Compiler metadata for legal-frame-v1 actions. */
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  startFrame?: number;
  cancelFrame?: number;
  animationEndFrame?: number;
}

export type RotationCommand = ActionDefinition;

export type FrameHitDefinition = Omit<HitDefinition, "offset"> & {
  frame: number;
};

export type FrameBuffDefinition = Omit<
  BuffDefinition,
  "duration" | "offset"
> & {
  startFrame?: number;
  durationFrames: number;
};

export type FrameDebuffDefinition = Omit<
  DebuffDefinition,
  "duration" | "offset"
> & {
  startFrame?: number;
  durationFrames: number;
};

export type FrameEnergyEvent = Omit<
  EnergyEvent,
  "offset" | "internalCooldown"
> & {
  frame?: number;
  internalCooldown?: {
    key: string;
    durationFrames: number;
  };
};

export type FrameParticleDefinition = Omit<
  ParticleDefinition,
  "spawnOffset" | "travelTime" | "trigger"
> & {
  spawnFrame?: number;
  travelFrames: number;
  trigger?: {
    kind: "hit-confirm";
    hitIds: string[];
    internalCooldown?: {
      key: string;
      durationFrames: number;
    };
  };
};

export interface TimelineStateGrant {
  key: string;
  label: string;
  durationFrames: number;
}

/**
 * Action-legality state owned by the ability actor. This is intentionally
 * separate from combat-stat buffs/debuffs.
 */
export interface AbilityTimelineState {
  requires?: string[];
  consumes?: string[];
  /** Removes any matching actor-owned state without requiring it to exist. */
  clears?: string[];
  grants?: TimelineStateGrant[];
}

export interface AbilityDefinition {
  id: string;
  actorId: string;
  name: string;
  kind: AbilityKind;
  cancelFrame: number;
  /** Optional action-specific cancel offsets selected from the next command. */
  cancelFrames?: Partial<Record<AbilityFollowupKind, number>>;
  animationEndFrame: number;
  cooldownFrames: number;
  maxCharges?: number;
  chargeRecoveryFrames?: number;
  energyCost?: number;
  hits?: FrameHitDefinition[];
  buffs?: FrameBuffDefinition[];
  debuffs?: FrameDebuffDefinition[];
  energyGains?: FrameEnergyEvent[];
  particles?: FrameParticleDefinition[];
  timelineState?: AbilityTimelineState;
}

export interface TimelineWaitCommand {
  type: "wait";
  frames: number;
}

export interface TimelineSwapCommand {
  type: "swap";
  characterId: string;
  atFrame?: number;
}

export interface TimelineMovementCommand {
  type: "dash" | "jump";
  actorId: string;
  /** Explicit provisional action occupancy; stamina and movement physics are not inferred. */
  frames: number;
  atFrame?: number;
}

export interface TimelineAbilityCommand {
  type: AbilityKind;
  actorId: string;
  abilityId: string;
  atFrame?: number;
}

export interface TimelineCrystallizePickupCommand {
  type: "pickUpCrystallize";
  element: AuraElement | "any";
  atFrame?: number;
}

export type LegalTimelineCommand =
  | TimelineWaitCommand
  | TimelineSwapCommand
  | TimelineMovementCommand
  | TimelineAbilityCommand
  | TimelineCrystallizePickupCommand;

export interface LegalTimelineConfig {
  mode: "legal-frame-v1";
  fps: 60;
  legalityMode: TimelineLegalityMode;
  initialActiveCharacterId: string;
  swapFrames: number;
  abilities: AbilityDefinition[];
  commands: LegalTimelineCommand[];
}

export interface ConfigMeta {
  name: string;
  version: string;
  note?: string;
  verificationStatus: VerificationStatus;
}

export interface SimConfig {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  engineVersion: typeof CURRENT_ENGINE_VERSION;
  dataVersion: string;
  randomSeed: string;
  meta: ConfigMeta;
  duration: number;
  cycleLength: number;
  enemy: EnemyProfile;
  characters: CharacterProfile[];
  /** Static scenario pose. Actor movement is not inferred in this version. */
  actorPoses?: ActorPoseDefinition[];
  rotation: RotationCommand[];
  timeline?: LegalTimelineConfig;
  reactionEngine?: AuraReactionEngineConfig;
  /** Explicitly versioned player self-damage boundary. */
  playerDamageModel: PlayerDamageModel;
  /** Explicit opt-in; every pre-1.33 configuration migrates to disabled. */
  targetClockModel: TargetClockModel;
}

export interface SimulationOptions {
  energyMode?: EnergyMode;
  critMode?: CritMode;
  compatibilityMode?: CompatibilityMode;
  randomSeed?: string;
}

export interface ResolvedSimulationRuntimeOptions {
  energyMode: EnergyMode;
  critMode: CritMode;
  compatibilityMode: CompatibilityMode;
  randomSeed: string;
}

export type DamagePluginKind = "code" | "declarative";

/**
 * Stable, author-declared identity for executable plugin code.
 *
 * Code-plugin hashes are trust declarations. Function source text is never
 * serialized because bundlers and runtimes do not provide a stable encoding.
 */
export interface DamagePluginDescriptor {
  id: string;
  version: string;
  kind: DamagePluginKind;
  contentHash: string;
}

export interface DamagePluginManifestEntry
  extends DamagePluginDescriptor {
  /** Execution order. Plugin ordering is semantic and is never sorted. */
  order: number;
  /** Redundant array-position guard used by the strict runtime Schema. */
  index: number;
}

export interface SimulationRunManifest {
  version: typeof SIMULATION_RUN_MANIFEST_VERSION;
  identityAlgorithm: typeof REPRODUCIBILITY_IDENTITY_ALGORITHM;
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  engineVersion: typeof CURRENT_ENGINE_VERSION;
  dataVersion: string;
  /** Versioned, non-cryptographic fingerprint of the migrated config. */
  configHash: string;
  resolvedRuntimeOptions: ResolvedSimulationRuntimeOptions;
  plugins: DamagePluginManifestEntry[];
  reproducibilityKey: string;
}

export type SimulationEventType =
  | "action"
  | "buff"
  | "debuff"
  | "energy"
  | "particleSpawn"
  | "particleReceive"
  | "hit"
  | "reactionDamage"
  | "periodicReactionTick"
  | "periodicReactionWane"
  | "periodicReactionExpiry"
  | "burningTick"
  | "burningFuelExpiry"
  | "dendroCoreSpawn"
  | "dendroCoreExpiry"
  | "frozenExpiry"
  | "quickenExpiry"
  | "crystallizeShardSpawn"
  | "crystallizeShardExpiry"
  | "crystallizePickup"
  | "crystallizeShieldExpiry";

export interface SimulationEvent<TPayload = unknown> {
  type: SimulationEventType;
  timeSeconds: number;
  frame: number;
  priority: number;
  sequence: number;
  payload: TPayload;
}

export interface ActiveStatusSnapshot {
  key: string;
  kind: "buff" | "debuff";
  sourceActorId?: string;
  targetId?: string;
  stat?: BuffStat;
  element?: Element | "all";
  value?: number;
  resShred?: number;
  defReduction?: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  label: string;
}

export interface EnemyStateBeforeHit {
  level: number;
  baseResistance: number;
  resistanceShred: number;
  effectiveResistance: number;
  baseDefenseReduction: number;
  effectiveDefenseReduction: number;
}

export interface AuraStateEntry {
  element: AuraStateElement;
  gaugeUnits: number;
  expiresAtFrame: number | null;
  /**
   * Explicit target-clock deadline for Hitlag-aware output. Historical and
   * disabled output omits it and retains expiresAtFrame byte-for-byte.
   */
  expiresAtTargetFrame?: number | null;
  /** Present in aura-v3 through aura-v6; each owner keeps an independent slot. */
  sourceSlots?: AuraSourceGaugeSlot[];
}

export interface AuraGaugeEntry {
  /** Nominal application may be Anemo/Geo/Dendro even when it cannot persist. */
  element: AuraStateElement | "anemo" | "geo" | "dendro";
  gaugeUnits: number;
  sourceActorId?: string;
  sourceMutations?: AuraSourceGaugeMutation[];
}

export interface AuraSourceGaugeSlot {
  sourceActorId: string;
  gaugeUnits: number;
}

export interface AuraSourceGaugeMutation {
  sourceActorId: string;
  gaugeUnitsBefore: number;
  consumedGaugeUnits: number;
  gaugeUnitsAfter: number;
}

export interface ReactionAudit {
  model:
    | "none"
    | "manual-override"
    | "aura-engine"
    | "reaction-damage";
  triggered: boolean;
  reaction: ReactionType;
  /** Ordered reactions observed on this hit; preserves valid multi-reactions. */
  reactions: ReactionType[];
  /** Detected but deliberately not executed by the current engine slice. */
  unsupportedReactions: UnsupportedDendroReaction[];
  /**
   * Target-local fail-closed boundary. Once triggered, later hits on this
   * target cannot claim authoritative Aura or reaction resolution.
   */
  mechanicsTruncation: TargetMechanicsTruncationAudit | null;
  icdAllowed: boolean | null;
  icdTag: string | null;
  icdGroup: IcdGroup | null;
  applicationGaugeUnits: number | null;
  auraBefore: AuraStateEntry[] | null;
  /** Nominal attack application that passed ICD. */
  auraApplied: AuraGaugeEntry[] | null;
  /** Actual remaining aura durability removed by this hit. */
  auraConsumed: AuraGaugeEntry[] | null;
  auraAfter: AuraStateEntry[] | null;
  /**
   * aura-v6 ordered, independently auditable transformative reactions for one
   * elemental application. The legacy singular field remains the first-item
   * compatibility projection.
   */
  transformativeReactions?: TransformativeReactionAudit[];
  transformativeReaction: TransformativeReactionAudit | null;
  periodicReaction: PeriodicReactionAudit | null;
  frozenReaction: FrozenReactionAudit | null;
  shatterReaction: ShatterReactionAudit | null;
  /** One Anemo application can Swirl multiple coexisting Aura elements. */
  swirlReactions: SwirlReactionAudit[];
  /** ReactionA damage ICD decision for a queued Swirl damage hit. */
  swirlDamageGroup: SwirlDamageGroupAudit | null;
  /** Geo reaction, shared target-local queue, and shard timing decision. */
  crystallizeReaction: CrystallizeReactionAudit | null;
  /** Dendro/Electro Quicken state and optional additive hit reaction. */
  catalyzeReaction: CatalyzeReactionAudit | null;
  /** Pyro/Dendro Burning marker, Fuel, snapshot, and tick scheduling. */
  burningReaction: BurningReactionAudit | null;
  /** One hit may trigger both direct and same-frame Quicken-follow-up Bloom. */
  bloomReactions: BloomReactionAudit[];
  note?: string;
}

export interface TargetMechanicsTruncationAudit {
  operation: "trigger" | "carry";
  startedAtFrame: number;
  unsupportedReactions: UnsupportedDendroReaction[];
  /** Aura state discarded when the unsupported branch was first reached. */
  discardedAura: AuraStateEntry[];
  reason:
    | "UNSUPPORTED_DENDRO_REACTION"
    | "UNSUPPORTED_REACTION_ORDER";
}

export interface QuickenReactionAudit {
  reaction: "quicken";
  triggerElement: "dendro" | "electro";
  consumedAuraElement: "dendro" | "electro";
  sourceGaugeUnitsBefore: number;
  sourceGaugeUnitsSpent: number;
  sourceGaugeUnitsAfter: number;
  auraGaugeUnitsBefore: number;
  auraConsumedGaugeUnits: number;
  auraGaugeUnitsAfter: number;
  quickenGaugeUnitsBefore: number;
  candidateGaugeUnits: number;
  quickenGaugeUnitsAfter: number;
  operation: "start" | "refresh" | "unchanged";
  generation: number;
  decayPerFrameBefore: number;
  expiresAtFrameBefore: number | null;
  endCauseBefore: QuickenDecayEndCause;
  decayPerFrame: number;
  expiresAtFrame: number | null;
  endCause: Exclude<QuickenDecayEndCause, null>;
  /** Aura state immediately around the Quicken modifier attach decision. */
  operationAuraBefore: AuraStateEntry[];
  operationAuraAfter: AuraStateEntry[];
  /** Fixed gcsim queues a same-frame Bloom follow-up when Hydro is present. */
  pendingHydroBloomFollowup: boolean;
}

export interface AdditiveReactionAudit {
  reaction: AdditiveReaction;
  triggerElement: "dendro" | "electro";
  quickenGaugeUnitsBefore: number;
  quickenGaugeUnitsAfter: number;
  consumedQuickenGaugeUnits: 0;
}

export interface CatalyzeReactionAudit {
  quicken: QuickenReactionAudit | null;
  additive: AdditiveReactionAudit | null;
}

export type BurningReactionOperation =
  | "start"
  | "refresh-fuel"
  | "refresh-snapshot"
  | "stop";

export type QuickenDecayEndCause =
  | "QUICKEN_DECAY"
  | "BURNING_FUEL_EXPIRED"
  | null;

/**
 * Quicken lifetime change caused by a Burning/Fuel boundary.
 *
 * This is separate from Bloom's Gauge-consumption mutation because Burning
 * may rebase decay and expiry while preserving the current Quicken Gauge.
 */
export interface QuickenDecayMutationAudit {
  operation: "none" | "decay-rebase" | "remove";
  generationBefore: number;
  generationAfter: number;
  quickenGaugeUnitsBefore: number;
  quickenGaugeUnitsAfter: number;
  decayPerFrameBefore: number;
  decayPerFrameAfter: number;
  expiresAtFrameBefore: number | null;
  expiresAtFrameAfter: number | null;
  endCauseBefore: QuickenDecayEndCause;
  endCauseAfter: QuickenDecayEndCause;
  operationAuraBefore: AuraStateEntry[];
  operationAuraAfter: AuraStateEntry[];
}

/**
 * Audit emitted on the Pyro/Dendro hit that starts or refreshes Burning.
 *
 * Literal mechanics constants make an accidental drift from the fixed gcsim
 * reference visible to TypeScript consumers. Player self-damage status is
 * explicit because it is opt-in and historical configurations migrate with
 * the player-damage model disabled.
 */
export interface BurningReactionAudit {
  reaction: BurningReaction;
  operation: BurningReactionOperation;
  reactionTriggered: boolean;
  generation: number;
  triggerElement: Element;
  fuelOperation: "start" | "overwrite" | "unchanged" | "remove";
  stopReason: "BURNING_AURA_CONSUMED" | null;
  scheduled: boolean;
  blockedReason: "TARGET_MECHANICS_TRUNCATION" | null;
  damageSourceActorId: string;
  fuelSourceActorId: string | null;
  burningGaugeUnitsBefore: number;
  candidateBurningGaugeUnits: number;
  burningGaugeUnitsAfter: number;
  burningDecayPerFrame: 0;
  burningExpiresAtFrame: null;
  fuelGaugeUnitsBefore: number;
  candidateFuelGaugeUnits: number;
  fuelGaugeUnitsAfter: number;
  fuelDecayPerFrame: number;
  fuelExpiresAtFrame: number | null;
  fuelExpiresAtTargetFrame?: number | null;
  /** Explicit Quicken decay/end-cause mutation at this Burning boundary. */
  quickenStateMutation: QuickenDecayMutationAudit;
  snapshotFrame: number;
  snapshotTargetFrame?: number;
  clockModel:
    | "target-local-no-hitlag"
    | "target-local-hitlag-v1";
  hitlagStatus:
    | "unsupported-enemy-hitlag"
    | "modeled-enemy-hitlag";
  firstTickFrame: number | null;
  nextTickFrame: number | null;
  firstTickTargetFrame?: number | null;
  nextTickTargetFrame?: number | null;
  tickIntervalFrames: 15;
  skippedTickIndex: 9;
  damageElement: "pyro";
  baseMultiplier: 0.25;
  radius: 1;
  applicationGaugeUnits: 1;
  selfDamageStatus: PlayerSelfDamageStatus;
}

/**
 * Exact gauge accounting for one Bloom trigger. A single source hit may emit
 * more than one record, so ReactionAudit owns an ordered array.
 */
export interface BloomQuickenStateMutationAudit {
  operation:
    | "none"
    | "decay-rebase"
    | "partial-consume"
    | "remove";
  generationBefore: number;
  generationAfter: number;
  decayPerFrameBefore: number;
  decayPerFrameAfter: number;
  expiresAtFrameBefore: number | null;
  expiresAtFrameAfter: number | null;
  endCauseBefore: QuickenDecayEndCause;
  endCauseAfter: QuickenDecayEndCause;
  /** Aura state immediately around this resolution's Quicken-slot mutation. */
  operationAuraBefore: AuraStateEntry[];
  operationAuraAfter: AuraStateEntry[];
}

/**
 * Burning Fuel lifetime mutation caused by one Bloom Gauge resolution.
 *
 * Depletion deliberately retains the current Burning stream identity until
 * Reactable.Tick purges the dependent state on the next frame.
 */
export interface BloomBurningFuelStateMutationAudit {
  operation:
    | "none"
    | "expiry-rebase"
    | "deplete-pending-purge";
  generation: number | null;
  decayPerFrame: number;
  expiresAtFrameBefore: number | null;
  expiresAtFrameAfter: number | null;
}

export interface BloomReactionAudit {
  reaction: "bloom";
  operation: "direct" | "quicken-followup";
  triggerElement: "hydro" | "dendro" | "electro";
  sourceActorId: string;
  triggerFrame: number;
  sourceBudget: "incoming-application" | "quicken-state";
  sourceGaugeUnitsBefore: number;
  sourceGaugeUnitsSpent: number;
  sourceGaugeUnitsAfter: number;
  hydroGaugeUnitsBefore: number;
  hydroConsumedGaugeUnits: number;
  hydroGaugeUnitsAfter: number;
  dendroGaugeUnitsBefore: number;
  dendroConsumedGaugeUnits: number;
  dendroGaugeUnitsAfter: number;
  quickenGaugeUnitsBefore: number;
  quickenConsumedGaugeUnits: number;
  quickenGaugeUnitsAfter: number;
  /** Explicit Quicken lifecycle mutation; never inferred by the UI. */
  quickenStateMutation: BloomQuickenStateMutationAudit;
  burningFuelGaugeUnitsBefore: number;
  burningFuelConsumedGaugeUnits: number;
  burningFuelGaugeUnitsAfter: number;
  burningFuelStateMutation: BloomBurningFuelStateMutationAudit;
  scheduled: boolean;
  coreSpawnFrame: number | null;
  coreSpawnDelayFrames: 30;
  blockedReason: "TARGET_MECHANICS_TRUNCATION" | null;
  mechanicsDataStatus: "fixed-gcsim-provisional";
  selfDamageStatus: PlayerSelfDamageStatus;
}

export interface TransformativeReactionAudit {
  reaction: OneShotTransformativeReaction;
  damageElement: Element;
  scheduled: boolean;
  damageFrame: number;
  radius: number;
  baseMultiplier: number;
  blockedReason:
    | "REACTION_DAMAGE_GCD"
    | "TARGET_MECHANICS_TRUNCATION"
    | null;
  nextAvailableFrame: number;
  statusEffect: ReactionStatusEffectDefinition | null;
}

export interface PeriodicReactionAudit {
  reaction: PeriodicTransformativeReaction;
  generation: number;
  operation: "start" | "refresh" | "stop";
  damageElement: Element;
  baseMultiplier: number;
  firstDamageFrame: number | null;
  nextTickFrame: number | null;
  tickIntervalFrames: number;
  waneDelayFrames: number;
  waneGaugeUnits: number;
  coexistenceExpiresAtFrame: number | null;
}

export interface FrozenReactionAudit {
  generation: number;
  operation: "start" | "refresh" | "immune" | "consume";
  freezeResistance: number;
  generatedGaugeUnits: number;
  consumedGaugeUnits: number;
  frozenGaugeBefore: number;
  frozenGaugeAfter: number;
  decayRatePerFrame: number;
  expiresAtFrame: number | null;
}

export interface ShatterReactionAudit {
  reaction: "shatter";
  generation: number;
  strikeType: StrikeType;
  poiseDamage: number;
  triggered: boolean;
  scheduled: boolean;
  damageElement: "physical";
  damageFrame: number;
  baseMultiplier: number;
  blockedReason:
    | "NO_FROZEN_AURA"
    | "FROZEN_DEPLETED_BY_POISE"
    | "REACTION_DAMAGE_GCD"
    | "TARGET_MECHANICS_TRUNCATION"
    | null;
  nextAvailableFrame: number | null;
  frozenGaugeBefore: number;
  poiseConsumedGaugeUnits: number;
  frozenGaugeAfterPoise: number;
  shatterConsumedGaugeUnits: number;
  frozenGaugeAfter: number;
  auraBefore: AuraStateEntry[];
  auraAfterPoise: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  expiresAtFrame: number | null;
}

export interface SwirlReactionAudit {
  reaction: SwirlReaction;
  swirledElement: AuraElement;
  /** Aura state consumed; Frozen is emitted as Cryo Swirl. */
  consumedAuraElement: AuraStateElement;
  sourceGaugeUnitsBefore: number;
  /** Incoming Anemo budget spent, equal to actual Aura reduction / 0.5. */
  sourceGaugeUnitsSpent: number;
  sourceGaugeUnitsAfter: number;
  auraGaugeUnitsBefore: number;
  auraConsumedGaugeUnits: number;
  auraGaugeUnitsAfter: number;
  propagatedGaugeUnits: number;
  scheduled: boolean;
  blockedReason: "REACTION_QUEUE_GCD" | null;
  nextAvailableFrame: number;
  selfDamageFrame: number;
  propagationDamageFrame: number;
  selfBaseMultiplier: number;
  propagationBaseMultiplier: number;
  radius: number;
}

export interface SwirlDamageGroupAudit {
  reaction: SwirlReaction;
  windowStartFrame: number;
  hitIndex: number;
  resetFrames: number;
  sequence: readonly [true, true, false];
  damageAllowed: boolean;
  blockedReason: "REACTION_A_DAMAGE_ICD" | null;
}

export interface CrystallizeReactionAudit {
  reaction: CrystallizeReaction;
  crystallizedElement: AuraElement;
  /** Frozen creates a Cryo shard while consuming Frozen durability. */
  consumedAuraElement: AuraStateElement;
  sourceGaugeUnitsBefore: number;
  sourceGaugeUnitsSpent: number;
  sourceGaugeUnitsAfter: number;
  auraGaugeUnitsBefore: number;
  auraConsumedGaugeUnits: number;
  auraGaugeUnitsAfter: number;
  scheduled: boolean;
  blockedReason: "REACTION_QUEUE_GCD" | null;
  nextAvailableFrame: number;
  shardSpawnFrame: number;
  earliestPickupFrame: number;
  shardExpiresAtFrame: number;
  shardDurationFrames: number;
  maxActiveShards: number;
}

export interface ReactionStatusEffectDefinition {
  key: string;
  label: string;
  element: Element | "all";
  resShred: number;
  durationFrames: number;
}

export interface FlatDamageDetail {
  ownerId: string;
  stat: ScalingStat;
  multiplier: number;
  sourceValue: number;
  amount: number;
}

export interface DamageFactors {
  scaling: number;
  scalingStat: ScalingStat;
  scalingValue: number;
  flatDamage: number;
  baseDamage: number;
  damageBonus: number;
  damageBonusMultiplier: number;
  defenseIgnore: number;
  defenseReduction: number;
  defenseMultiplier: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
  critRate: number;
  critDamage: number;
  critMultiplier: number;
  reactionBase: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  amplifyingReactionMultiplier: number;
  groupMultiplier: number;
}

export interface TransformativeReactionFactors {
  reaction: TransformativeReaction;
  characterLevel: number;
  levelBaseDamage: number;
  baseMultiplier: number;
  elementalMastery: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  preResistanceDamage: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
}

export interface AdditiveReactionFactors {
  reaction: AdditiveReaction;
  sourceActorId: string;
  characterLevel: number;
  levelBaseDamage: number;
  baseMultiplier: number;
  elementalMastery: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  /** Formula contribution before plugin-level flat-damage overrides. */
  flatDamage: number;
  /** Contribution that remains in the final damage input after plugins. */
  appliedFlatDamage: number;
  /** Catalyze EM is read at the damage frame even for action-snapshot hits. */
  snapshotMode: "hit-time";
}

/**
 * Final-damage contributions after every formula zone and target policy.
 * The three fields must sum to the event's `finalDamage`.
 */
export interface DamageComposition {
  direct: number;
  additiveReaction: number;
  transformativeReaction: number;
}

export interface DamageEvent {
  id: number;
  kind: "direct" | "transformative-reaction";
  /** Authoritative event-queue ordering used by result timelines. */
  eventPriority: number;
  eventSequence: number;
  parentDamageEventId: number | null;
  sourceActorId: string;
  scalingOwnerId: string;
  creditOwnerId: string;
  actionId: string;
  hitId: string;
  hitGroupId: string;
  targetIndex: number;
  targetCount: number;
  targetResolutionId: number;
  targetId: TargetId;
  targetName: string;
  targetDamagePolicy: TargetDamagePolicy;
  targetDamageMultiplier: 0 | 1;
  /**
   * Truncated events retain potentialDamage but contribute zero finalDamage to
   * authoritative totals.
   */
  mechanicsStatus: MechanicsResolutionStatus;
  /** Formula result before the target-level damage policy. */
  potentialDamage: number;
  frame: number;
  timeSeconds: number;
  activeCharacterId: string | null;
  statsBeforeDamage: CharacterStats;
  activeStatuses: ActiveStatusSnapshot[];
  enemyStateBeforeHit: EnemyStateBeforeHit;
  reactionAudit: ReactionAudit;
  damageFactors: DamageFactors;
  transformativeReactionFactors: TransformativeReactionFactors | null;
  additiveReactionFactors: AdditiveReactionFactors | null;
  damageComposition: DamageComposition;
  /** Raw deterministic result retained for aggregation and Golden fixtures. */
  finalDamage: number;
  /** Nearest-integer display value, matching gcsim Sample presentation. */
  displayDamage: number;
  sourceActorName: string;
  scalingOwnerName: string;
  creditOwnerName: string;
  actionName: string;
  hitLabel: string;
  element: Element;
  reaction: ReactionType;
  snapshot: SnapshotMode;
  cycle: number;
  flatDetails: FlatDamageDetail[];
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  actionStartFrame?: number;
  actionCancelFrame?: number;
  actionAnimationEndFrame?: number;

  /** Compatibility aliases consumed by the v0.1-shaped UI. */
  time: number;
  second: number;
  actorId: string;
  creditId: string;
  actorName: string;
  activeId: string | null;
  scaling: number;
  scalingStat: ScalingStat;
  scalingValue: number;
  flat: number;
  baseDamage: number;
  dmgBonus: number;
  bonusFactor: number;
  defIgnore: number;
  defReduction: number;
  defenseFactor: number;
  effectiveRes: number;
  resFactor: number;
  critRate: number;
  critDmg: number;
  critFactor: number;
  em: number;
  reactionBase: number;
  emBonus: number;
  reactionBonus: number;
  reactionFactor: number;
  groupMultiplier: number;
  buffs: string[];
  debuffs: string[];
}

export interface SkippedAction {
  time: number;
  frame: number;
  actorId: string;
  actionId: string;
  action: string;
  reason: string;
  reasonCode: "INSUFFICIENT_ENERGY";
  energyBefore: number;
  energyCost: number;
  cycle: number;
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
}

export interface ActionLogEntry {
  time: number;
  frame: number;
  actorId: string;
  actionId: string;
  action: string;
  cycle: number;
  energyBefore: number;
  energyAfter: number;
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
  cancelFrame?: number;
  animationEndFrame?: number;
}

export interface EnergySummary {
  initial: number;
  gained: number;
  fixedGained: number;
  particleGained: number;
  wasted: number;
  spent: number;
  skipped: number;
  final: number;
}

export interface ParticleEventLog {
  id: number;
  sourceActorId: string;
  sourceActionId: string;
  source: string;
  particleId: string;
  spawnFrame: number;
  receiveFrame: number;
  spawnTimeSeconds: number;
  receiveTimeSeconds: number;
  particleElement: ParticleElement;
  particleKind: ParticleKind;
  particleCount: number;
  receivedWithinSimulation: boolean;
  cycle: number;
  triggerLogId: number | null;
  triggerHitId: string | null;
}

export interface ParticleTriggerLogEntry {
  id: number;
  frame: number;
  timeSeconds: number;
  cycle: number;
  sourceActorId: string;
  sourceActionId: string;
  source: string;
  particleId: string;
  hitId: string;
  hitGroupId: string;
  checkedTargetIds: TargetId[];
  confirmedTargetIds: TargetId[];
  triggered: boolean;
  blockedReason:
    | "INTERNAL_COOLDOWN"
    | "TARGET_MISS"
    | "TARGET_HIT_CONFIRM_BLOCKED"
    | null;
  internalCooldownKey: string | null;
  internalCooldownDurationFrames: number | null;
  internalCooldownReadyFrame: number | null;
}

export interface HitResolutionLogEntry {
  id: number;
  frame: number;
  timeSeconds: number;
  cycle: number;
  sourceActorId: string;
  sourceActionId: string;
  actionName: string;
  hitId: string;
  hitGroupId: string;
  targetIndex: number;
  targetCount: number;
  hitLabel: string;
  element: Element;
  targetId: TargetId;
  targetName: string;
  targetingSource:
    | "default"
    | "scripted"
    | "geometry"
    | "reaction-source"
    | "reaction-geometry";
  resolutionKind: "direct" | "reaction-damage";
  targetPosition: { x: number; y: number } | null;
  sourceActorPosition: { x: number; y: number } | null;
  sourceActorFacingDegrees: number | null;
  geometryKind: HitGeometry["kind"] | null;
  geometryCoordinateSpace: GeometryCoordinateSpace | null;
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
  outcome: TargetHitOutcome;
  landed: boolean;
  reason: string | null;
  targetEffectSource: "normal" | "hit" | "target-phase";
  /** Active phase even when a per-hit override or miss takes precedence. */
  targetPhaseId: string | null;
  damageAllowed: boolean;
  auraAllowed: boolean;
  hitConfirmAllowed: boolean;
  mechanicsStatus: MechanicsResolutionStatus;
  /** Null when the target was missed before combat resolution. */
  damageEventId: number | null;
  /** Formula result before target immunity; zero for a miss. */
  potentialDamage: number;
  finalDamage: number;
  displayDamage: number;
  timelineCommandIndex?: number;
  sourceAbilityId?: string;
}

export interface TargetPhaseTimelineEntry extends TargetPhaseDefinition {
  startTimeSeconds: number;
  endTimeSeconds: number;
}

export interface TargetMotionTimelineEntry extends TargetMotionDefinition {
  startPosition: { x: number; y: number };
  startTimeSeconds: number;
  endTimeSeconds: number;
}

export interface EnergyLogEntry {
  id: number;
  kind: "fixed" | "particle";
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  sourceActionId: string;
  source: string;
  receiverId: string;
  activeCharacterId: string | null;
  isOnField: boolean;
  energyBefore: number;
  /** Particle energy after element/field rules but before Energy Recharge. */
  rawEnergy: number;
  /** Requested energy after Energy Recharge and before the energy cap. */
  finalEnergy: number;
  gainedEnergy: number;
  wastedEnergy: number;
  energyAfter: number;
  spawnFrame: number | null;
  receiveFrame: number;
  particleElement: ParticleElement | null;
  particleKind: ParticleKind | null;
  particleCount: number | null;
  isSameElement: boolean | null;
  energyRecharge: number;
  fieldMultiplier: number;
  baseEnergyPerParticle: number | null;
  applied: boolean;
  blockedReason: "INTERNAL_COOLDOWN" | null;
  internalCooldownKey: string | null;
  internalCooldownDurationFrames: number | null;
  internalCooldownReadyFrame: number | null;
}

export interface EnergyCurvePoint {
  id: number;
  frame: number;
  timeSeconds: number;
  kind: "initial" | "spend" | "fixed" | "fixed-blocked" | "particle";
  receiverId: string | null;
  source: string;
  energyByCharacter: Record<string, number>;
}

export interface SkillSummary {
  creditId: string;
  actionName: string;
  damage: number;
  hits: number;
  dps: number;
  share: number;
}

export interface CharacterDamageSummary {
  characterId: string;
  damage: number;
  hits: number;
  dps: number;
  share: number;
}

export interface EnemyTargetDamageSummary {
  targetId: TargetId;
  targetName: string;
  damage: number;
  potentialDamage: number;
  damageEvents: number;
  landedChecks: number;
  missedChecks: number;
  immuneDamageEvents: number;
  dps: number;
  share: number;
}

export interface DamageCurvePoint {
  damageEventId: number;
  targetId: TargetId;
  targetName: string;
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  creditOwnerId: string;
  finalDamage: number;
  cumulativeDamage: number;
  cumulativeByCharacter: Record<string, number>;
  cumulativeByComponent: DamageComposition;
  /** Core-owned reaction series; the UI must not reconstruct these totals. */
  cumulativeByReaction: Partial<Record<TransformativeReaction, number>>;
}

export interface AuraTimelinePoint {
  damageEventId: number;
  /** Copied from the originating DamageEvent; the UI must not infer it. */
  eventPriority: number;
  eventSequence: number;
  targetId: TargetId;
  targetName: string;
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  actionId: string;
  hitId: string;
  incomingElement: Element;
  icdAllowed: boolean | null;
  reaction: ReactionType;
  reactions: ReactionType[];
  unsupportedReactions: UnsupportedDendroReaction[];
  mechanicsTruncation: TargetMechanicsTruncationAudit | null;
  auraBefore: AuraStateEntry[];
  auraApplied: AuraGaugeEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
}

/**
 * Versioned, core-owned projection of every target-local Aura observation and
 * mutation. Consumers must preserve the emitted point order and links instead
 * of joining the legacy state logs heuristically.
 */
export type TargetStateTimelinePointKind =
  | "boundary"
  | "derived"
  | "observation"
  | "mutation";

export type TargetStateTimelineCause =
  | "simulation-start"
  | "simulation-end"
  | "aura-natural-expiry"
  | "direct-hit-shatter"
  | "direct-hit-application"
  | "reaction-damage-application"
  | "reaction-damage-shatter"
  | "frozen-expiry"
  | "quicken-expiry"
  | "electro-charged-expiry"
  | "electro-charged-tick"
  | "electro-charged-wane"
  | "burning-fuel-expiry"
  | "burning-tick"
  | "target-mechanics-truncation";

export type TargetStateTimelineLink =
  | { kind: "damage-event"; id: number }
  | { kind: "reaction-damage-log"; id: number }
  | { kind: "periodic-reaction-log"; id: number }
  | { kind: "frozen-state-log"; id: number }
  | { kind: "quicken-state-log"; id: number }
  | { kind: "burning-state-log"; id: number }
  | { kind: "target-mechanics-truncation-log"; id: number };

export interface TargetStateTimelinePoint {
  /** Zero-based, contiguous id equal to this point's emitted array index. */
  id: number;
  frame: number;
  /** Required for Hitlag-aware output; omitted by frozen legacy output. */
  targetFrame?: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  pointKind: TargetStateTimelinePointKind;
  cause: TargetStateTimelineCause;
  /**
   * Boundary and derived points have no event tuple. Observation and mutation
   * points carry the complete queue tuple plus a stable sequence within that
   * event.
   */
  eventType: SimulationEventType | null;
  eventPriority: number | null;
  eventSequence: number | null;
  intraEventSequence: number | null;
  reaction: ReactionType;
  reactions: ReactionType[];
  primaryDamageEventId: number | null;
  links: TargetStateTimelineLink[];
  auraBefore: AuraStateEntry[];
  auraApplied: AuraGaugeEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
}

export interface TargetStateTimeline {
  version: "1.0.0";
  points: TargetStateTimelinePoint[];
}

export interface AuraEndState {
  targetId: TargetId;
  targetName: string;
  frame: number;
  timeSeconds: number;
  aura: AuraStateEntry[];
}

export interface TargetMechanicsTruncationLogEntry {
  id: number;
  targetId: TargetId;
  targetName: string;
  frame: number;
  timeSeconds: number;
  sourceActorId: string;
  sourceActionId: string;
  hitId: string;
  triggerDamageEventId: number;
  unsupportedReactions: UnsupportedDendroReaction[];
  discardedAura: AuraStateEntry[];
  reason:
    | "UNSUPPORTED_DENDRO_REACTION"
    | "UNSUPPORTED_REACTION_ORDER";
}

export interface ReactionADamageGroupAudit {
  reaction:
    | SwirlReaction
    | DendroCoreReaction
    | "shatter"
    | "superconduct";
  sourceActorId: string;
  targetId: TargetId;
  windowStartFrame: number;
  hitIndex: number;
  resetFrames: 30;
  sequence: readonly [true, true, false];
  damageAllowed: boolean;
  blockedReason: "REACTION_A_DAMAGE_ICD" | null;
}

export interface ReactionBDamageGroupAudit {
  reaction: "overload" | "electroCharged";
  sourceActorId: string;
  targetId: TargetId;
  windowStartFrame: number;
  hitIndex: number;
  resetFrames: 30;
  sequence: readonly [true, false];
  damageAllowed: boolean;
  blockedReason: "REACTION_B_DAMAGE_ICD" | null;
}

export type ReactionDamageGroupAudit =
  | ReactionADamageGroupAudit
  | ReactionBDamageGroupAudit;

export interface ReactionDamageLogEntry {
  id: number;
  reaction: TransformativeReaction;
  triggerDamageEventId: number | null;
  /** Present for Dendro-core contacts; null for expiry-driven Bloom. */
  triggerHitGroupId: string | null;
  sourceActorId: string;
  sourceTargetId: TargetId;
  triggerFrame: number;
  damageFrame: number;
  scheduled: boolean;
  /** Whether the queued damage frame is inside the configured simulation. */
  withinSimulation: boolean;
  blockedReason:
    | "REACTION_DAMAGE_GCD"
    | "REACTION_QUEUE_GCD"
    | "TARGET_MECHANICS_TRUNCATION"
    | null;
  /** Next one-shot GCD frame or periodic cadence frame; null when no later tick is queued. */
  nextAvailableFrame: number | null;
  scheduleKind:
    | "one-shot"
    | "periodic-tick"
    | "burning-tick"
    | "swirl-self"
    | "swirl-propagation"
    | "dendro-core-bloom"
    | "dendro-core-burgeon"
    | "dendro-core-hyperbloom";
  targetingMode:
    | "radius"
    | "single-target"
    | "nearest-target-radius";
  centerPosition: { x: number; y: number } | null;
  radius: number;
  /** Dendro-core source and Hyperbloom selection audit. */
  sourceCoreId: number | null;
  sourceCoreLogId: number | null;
  selectionRadius: number | null;
  selectedTargetId: TargetId | null;
  resolutionReason: "NO_TARGET_IN_RANGE" | null;
  applicationGaugeUnits: number | null;
  excludedTargetIds: TargetId[];
  checkedTargetIds: TargetId[];
  hitTargetIds: TargetId[];
  unresolvedTargetIds: TargetId[];
  damageGroupBlockedTargetIds: TargetId[];
  damageEventIds: number[];
  /** Player-side target checks produced by this reaction damage event. */
  playerHitResolutionLogIds: number[];
  /** Player HP damage events produced by this reaction damage event. */
  playerDamageEventIds: number[];
  reactionStatusLogIds: number[];
  damageGroupDecisions: ReactionDamageGroupAudit[];
}

export interface DendroCoreLogBase {
  id: number;
  coreId: number;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  sourceActorId: string;
  sourceTargetId: TargetId;
  originDamageEventId: number;
  triggerFrame: number;
  coreDurationFrames: 300;
  hitboxRadius: 2;
  maxActiveCores: 5;
  clockModel:
    | "global-frame-no-hitlag"
    | "global-frame-gadget-v1";
  hitlagStatus:
    | "unsupported-enemy-hitlag"
    | "not-affected-by-enemy-hitlag";
  mechanicsDataStatus: "fixed-gcsim-provisional";
  selfDamageStatus: PlayerSelfDamageStatus;
}

export interface DendroCoreSpawnScheduledLogEntry
  extends DendroCoreLogBase {
  operation: "spawn-scheduled";
  /** Bloom can originate from a direct hit or propagated reaction damage. */
  eventType: "hit" | "reactionDamage";
  bloomReactionIndex: number;
  spawnFrame: number;
  withinSimulation: boolean;
  reason: "BLOOM_TRIGGERED";
}

export interface DendroCoreSpawnLogEntry extends DendroCoreLogBase {
  operation: "spawn";
  eventType: "dendroCoreSpawn";
  spawnedAtFrame: number;
  expiresAtFrame: number;
  position: { x: number; y: number };
  spawnRadius: number;
  spawnAngleDegrees: number;
  positionRandomRoll: number;
  rngStream: "dendro-core-position-v1";
  reason: "SPAWNED";
}

export interface DendroCoreRemovalLogEntry extends DendroCoreLogBase {
  operation: "expire" | "evict" | "consume";
  eventType:
    | "dendroCoreExpiry"
    | "dendroCoreSpawn"
    | "hit"
    | "reactionDamage";
  reaction: DendroCoreReaction;
  reactionDamageLogId: number;
  playerHitResolutionLogId: number | null;
  playerDamageEventId: number | null;
  contactLogId: number | null;
  damageFrame: number;
  withinSimulation: boolean;
  reason:
    | "NATURAL_EXPIRY"
    | "ACTIVE_CORE_LIMIT"
    | "BURGEON_CONTACT"
    | "HYPERBLOOM_CONTACT";
}

export type DendroCoreLogEntry =
  | DendroCoreSpawnScheduledLogEntry
  | DendroCoreSpawnLogEntry
  | DendroCoreRemovalLogEntry;

export interface DendroCoreContactLogEntry {
  id: number;
  frame: number;
  timeSeconds: number;
  eventType: "hit" | "reactionDamage";
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  sourceActorId: string;
  sourceActionId: string;
  hitId: string;
  hitGroupId: string;
  /** Null for a direct hit; otherwise the queued reaction event owning this contact. */
  triggerReactionDamageLogId: number | null;
  triggerElement: "pyro" | "electro";
  reaction: "burgeon" | "hyperbloom";
  hitResolutionLogIds: number[];
  triggerDamageEventIds: number[];
  resolvedGeometry: ResolvedWorldHitGeometry | null;
  checkedCoreIds: number[];
  contactedCoreIds: number[];
  removalLogIds: number[];
  reactionDamageLogIds: number[];
  blockedReason: "MISSING_EXPLICIT_GEOMETRY" | null;
}

export interface DendroCoreSnapshot {
  coreId: number;
  sourceActorId: string;
  sourceTargetId: TargetId;
  spawnedAtFrame: number;
  expiresAtFrame: number;
  position: { x: number; y: number };
  hitboxRadius: 2;
}

export interface DendroCoreTimelinePoint {
  id: number;
  frame: number;
  timeSeconds: number;
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
  /** Authoritative active-core state after this operation. */
  activeCores: DendroCoreSnapshot[];
}

export interface DendroCoreTimeline {
  version: "1.0.0";
  points: DendroCoreTimelinePoint[];
}

export type PeriodicReactionOperation =
  | "start"
  | "refresh"
  | "tick"
  | "wane"
  | "wane-skipped"
  | "stop";

export interface PeriodicReactionLogEntry {
  id: number;
  reaction: PeriodicTransformativeReaction;
  generation: number;
  operation: PeriodicReactionOperation;
  frame: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  sourceActorId: string | null;
  triggerDamageEventId: number | null;
  reactionDamageLogId: number | null;
  damageEventId: number | null;
  tickIndex: number | null;
  auraBefore: AuraStateEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
  nextTickFrame: number | null;
  coexistenceExpiresAtFrame: number | null;
  waneFrame: number | null;
  reason: string | null;
}

export type FrozenStateOperation =
  | "start"
  | "refresh"
  | "immune"
  | "consume"
  | "poise-consume"
  | "shatter-consume"
  | "expire";

export interface FrozenStateLogEntry {
  id: number;
  reaction:
    | "freeze"
    | "melt"
    | "superconduct"
    | "shatter"
    | "swirlCryo"
    | "crystallizeCryo";
  generation: number;
  operation: FrozenStateOperation;
  frame: number;
  targetFrame?: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  sourceActorId: string | null;
  triggerDamageEventId: number | null;
  freezeResistance: number;
  generatedGaugeUnits: number;
  consumedGaugeUnits: number;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  expiresAtFrame: number | null;
  expiresAtTargetFrame?: number | null;
  reason: string | null;
}

export type QuickenStateOperation =
  | "start"
  | "refresh"
  | "unchanged"
  | "decay-rebase"
  | "partial-consume"
  | "remove"
  | "expire";

export interface QuickenStateLogEntry {
  id: number;
  reaction: "quicken";
  generation: number;
  operation: QuickenStateOperation;
  frame: number;
  targetFrame?: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  sourceActorId: string | null;
  triggerDamageEventId: number | null;
  triggerElement: "dendro" | "electro" | null;
  consumedAuraElement: "dendro" | "electro" | null;
  candidateGaugeUnits: number;
  quickenGaugeUnitsBefore: number;
  quickenGaugeUnitsAfter: number;
  decayPerFrameBefore: number;
  decayPerFrameAfter: number;
  expiresAtFrameBefore: number | null;
  expiresAtTargetFrameBefore?: number | null;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  expiresAtFrame: number | null;
  expiresAtTargetFrame?: number | null;
  endCauseBefore: QuickenDecayEndCause;
  endCauseAfter: QuickenDecayEndCause;
  reason: string | null;
}

export type BurningStateOperation =
  | "start"
  | "refresh-fuel"
  | "refresh-snapshot"
  | "tick"
  | "tick-skipped"
  | "stop"
  | "fuel-expire";

export type BurningStopReason =
  | "FUEL_EXPIRED"
  | "BURNING_AURA_CONSUMED"
  | "TARGET_MECHANICS_TRUNCATION"
  | "SOURCE_CHANGED"
  | null;

/**
 * Target-local Burning lifecycle log.
 *
 * Tick rows link the owning hit, queued reaction damage, and resulting damage
 * events. They also preserve the Burning-specific application ICD decision so
 * the UI never has to infer Aura or damage behavior from the final total.
 */
export interface BurningStateLogEntry {
  id: number;
  reaction: BurningReaction;
  generation: number;
  operation: BurningStateOperation;
  frame: number;
  targetFrame?: number;
  timeSeconds: number;
  /** Stable same-frame ordering copied from the scheduled simulator event. */
  eventPriority: number;
  eventSequence: number;
  clockModel:
    | "target-local-no-hitlag"
    | "target-local-hitlag-v1";
  hitlagStatus:
    | "unsupported-enemy-hitlag"
    | "modeled-enemy-hitlag";
  targetId: TargetId;
  targetName: string;
  triggerElement: Element | null;
  damageSourceActorId: string | null;
  fuelSourceActorId: string | null;
  triggerDamageEventId: number | null;
  reactionDamageLogId: number | null;
  damageEventIds: number[];
  playerHitResolutionLogId: number | null;
  playerDamageEventId: number | null;
  /** One-based for tick and tick-skipped operations. */
  tickIndex: number | null;
  tickSkipped: boolean;
  skipReason: "COUNTER_9_SKIP" | null;
  damageAllowed: boolean | null;
  burningGaugeUnitsBefore: number;
  burningGaugeUnitsAfter: number;
  fuelGaugeUnitsBefore: number;
  fuelGaugeUnitsAfter: number;
  fuelDecayPerFrame: number;
  fuelExpiresAtFrame: number | null;
  fuelExpiresAtTargetFrame?: number | null;
  auraBefore: AuraStateEntry[];
  auraApplied: AuraGaugeEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
  nextTickFrame: number | null;
  nextTickTargetFrame?: number | null;
  icdGroup: "burning";
  icdTag: "burning-application";
  icdScope: "global-target";
  icdWindowStartFrame: number | null;
  icdHitIndex: number | null;
  icdResetFrames: 120;
  icdApplicationSequence: readonly [
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false
  ];
  applicationAllowed: boolean | null;
  applicationBlockedReason:
    | "BURNING_APPLICATION_ICD"
    | "TARGET_AURA_BLOCKED"
    | null;
  selfDamageStatus: PlayerSelfDamageStatus;
  reason: BurningStopReason;
}

export type PlayerHitOutcome = "landed" | "miss";

/**
 * One player-side spatial check owned by a queued reaction-damage event.
 * IDs and provenance are intentionally explicit so consumers never infer
 * player self-damage by joining on a frame alone.
 */
export interface PlayerHitResolutionLogEntry {
  id: number;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  reaction: PlayerReactionSelfDamageKind;
  element: Element;
  sourceActorId: string;
  sourceTargetId: TargetId;
  targetActorId: string;
  reactionDamageLogId: number;
  burningStateLogId: number | null;
  dendroCoreRemovalLogId: number | null;
  damageCenter: { x: number; y: number };
  damageRadius: number;
  playerCenter: { x: number; y: number };
  playerRadius: number;
  distance: number;
  distanceSquared: number;
  combinedRadius: number;
  combinedRadiusSquared: number;
  outcome: PlayerHitOutcome;
  blockedReason: "OUT_OF_RANGE" | null;
  playerDamageEventId: number | null;
}

export interface PlayerReactionSelfDamageFactors {
  reaction: PlayerReactionSelfDamageKind;
  sourcePreResistanceDamage: number;
  selfDamageMultiplier: number;
  preResistanceDamage: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
  /** Reaction self-damage bypasses the enemy/player defense formula. */
  ignoreDefense: 1;
  defenseMultiplier: 1;
  /** Player-avatar ReactionA result; Burning is outside ReactionA. */
  damageGroupMultiplier: 0 | 1;
  damageGroupDecision: ReactionADamageGroupAudit | null;
  /** Player incoming damage after resistance and damage-group gating. */
  finalDamage: number;
}

export interface PlayerCrystallizeShieldResolution {
  mode: "crystallize-v1";
  shieldId: number | null;
  shieldElement: AuraElement | null;
  incomingDamage: number;
  incomingElement: Element;
  elementalMasteryBonus: number;
  shieldStrengthBonus: number;
  absorptionMultiplier: number;
  effectiveAbsorptionMultiplier: number;
  baseHpBefore: number;
  baseHpConsumed: number;
  baseHpAfter: number;
  absorptionCapacity: number;
  absorbedDamage: number;
  damageAfterShield: number;
  shieldBroken: boolean;
}

export interface PlayerHpDamageResolution {
  zeroHpPolicy: "clamp-and-continue";
  inputCurrentHp: number;
  currentHpBefore: number;
  currentHpAfter: number;
  maxHp: number;
  attemptedLoss: number;
  actualLoss: number;
  overkill: number;
  hpRatioBefore: number;
  hpRatioAfter: number;
}

export interface PlayerDamageEvent {
  id: number;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  reaction: PlayerReactionSelfDamageKind;
  element: Element;
  sourceActorId: string;
  sourceTargetId: TargetId;
  targetActorId: string;
  reactionDamageLogId: number;
  playerHitResolutionLogId: number;
  burningStateLogId: number | null;
  dendroCoreRemovalLogId: number | null;
  damageFactors: PlayerReactionSelfDamageFactors;
  shieldResolution: PlayerCrystallizeShieldResolution;
  hpResolution: PlayerHpDamageResolution;
  /** Actual HP removed after shield absorption and zero-HP clamping. */
  finalDamage: number;
  displayDamage: number;
}

export type PlayerHpTimelineOperation =
  | "initial"
  | "damage"
  | "simulation-end";

export interface PlayerHpTimelinePoint {
  id: number;
  frame: number;
  timeSeconds: number;
  eventPriority: number | null;
  eventSequence: number | null;
  intraEventSequence: number | null;
  operation: PlayerHpTimelineOperation;
  actorId: string;
  playerDamageEventId: number | null;
  maxHp: number;
  hpBefore: number;
  hpAfter: number;
  hpRatioAfter: number;
}

export interface PlayerHpTimeline {
  version: "1.0.0";
  points: PlayerHpTimelinePoint[];
}

export interface PlayerHpSummary {
  actorId: string;
  maxHp: number;
  initialHp: number;
  finalHp: number;
  totalIncomingDamage: number;
  totalAbsorbedDamage: number;
  totalHpDamage: number;
  hitCount: number;
  zeroHpReached: boolean;
}

export type CrystallizeShardOperation =
  | "spawn"
  | "pickup-attempt"
  | "pickup"
  | "expire"
  | "evict";

export interface CrystallizeShardLogEntry {
  id: number;
  operation: CrystallizeShardOperation;
  frame: number;
  timeSeconds: number;
  shardId: number | null;
  reaction: CrystallizeReaction | null;
  element: AuraElement | "any";
  sourceActorId: string | null;
  sourceTargetId: TargetId | null;
  triggerDamageEventId: number | null;
  triggerFrame: number | null;
  spawnedAtFrame: number | null;
  earliestPickupFrame: number | null;
  expiresAtFrame: number | null;
  position: { x: number; y: number } | null;
  spawnRadius: number | null;
  spawnAngleDegrees: number | null;
  sourceCharacterLevel: number | null;
  sourceElementalMastery: number | null;
  pickupCommandIndex: number | null;
  pickedUpByActorId: string | null;
  shieldLogId: number | null;
  success: boolean;
  reason:
    | "SPAWNED"
    | "TOO_EARLY"
    | "NO_MATCHING_SHARD"
    | "PICKED_UP"
    | "EXPIRED"
    | "ACTIVE_SHARD_LIMIT"
    | null;
}

export type CrystallizeShieldOperation =
  | "add"
  | "overwrite"
  | "absorb"
  | "break"
  | "expire";

export interface CrystallizeShieldLogEntry {
  id: number;
  operation: CrystallizeShieldOperation;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  shieldId: number;
  shardId: number;
  element: AuraElement;
  sourceActorId: string;
  pickedUpByActorId: string;
  sourceCharacterLevel: number;
  sourceElementalMastery: number;
  baseHp: number;
  elementalMasteryBonus: number;
  generalAbsorption: number;
  matchingElementAbsorption: number;
  geoDamageAbsorption: number;
  currentBaseHp: number;
  expiresAtFrame: number;
  previousShieldId: number | null;
  /** Non-null only for absorb/break rows caused by player self-damage. */
  playerDamageEventId: number | null;
  incomingElement: Element | null;
  baseHpBeforeAbsorption: number;
  baseHpConsumed: number;
  baseHpAfterAbsorption: number;
  absorbedDamage: number;
  damageAfterShield: number;
}

export interface CrystallizeShieldTimelinePoint {
  id: number;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  operation: CrystallizeShieldOperation;
  shieldId: number | null;
  element: AuraElement | null;
  generalAbsorption: number;
  expiresAtFrame: number | null;
  playerDamageEventId: number | null;
  baseHpBeforeAbsorption: number;
  baseHpAfterAbsorption: number;
  absorbedDamage: number;
  damageAfterShield: number;
}

export interface ReactionStatusLogEntry {
  id: number;
  reaction: TransformativeReaction;
  reactionDamageEventId: number;
  targetId: TargetId;
  targetName: string;
  key: string;
  label: string;
  element: Element | "all";
  resShred: number;
  startFrame: number;
  endFrame: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  operation: "apply" | "refresh";
  /** Frame at which a refresh replaced this interval, otherwise null. */
  supersededAtFrame: number | null;
}

export type TimelineFailureCode =
  | "ACTION_OVERLAP"
  | "ABILITY_ON_COOLDOWN"
  | "INSUFFICIENT_ENERGY"
  | "UNKNOWN_ABILITY"
  | "WRONG_ACTIVE_CHARACTER"
  | "ALREADY_ACTIVE"
  | "MISSING_REQUIRED_STATE"
  | "OUT_OF_DURATION";

export interface TimelineStateLogEntry {
  sequence: number;
  frame: number;
  timeSeconds: number;
  operation: "grant" | "replace" | "consume" | "clear" | "expire";
  actorId: string;
  statusKey: string;
  label: string;
  expiresAtFrame: number;
  commandIndex: number;
  abilityId: string;
}

export interface TimelineFailure {
  commandIndex: number;
  code: TimelineFailureCode;
  frame: number;
  message: string;
  energyBefore?: number;
  energyCost?: number;
}

export interface TimelineAdjustment {
  commandIndex: number;
  code: "ACTION_OVERLAP" | "ABILITY_ON_COOLDOWN";
  requestedFrame: number;
  executedFrame: number;
  waitedFrames: number;
  message: string;
}

export interface TimelineCommandResult {
  commandIndex: number;
  commandType: LegalTimelineCommand["type"];
  actorId: string | null;
  abilityId: string | null;
  requestedFrame: number;
  startFrame: number | null;
  cancelFrame: number | null;
  animationEndFrame: number | null;
  endFrame: number | null;
  status: "executed" | "waited" | "rejected";
  waitedFrames: number;
  failureCode?: TimelineFailureCode;
  energyBefore?: number;
  energyCost?: number;
}

export interface TimelineExecution {
  mode: "legal-frame-v1";
  fps: 60;
  legalityMode: TimelineLegalityMode;
  initialActiveCharacterId: string;
  finalActiveCharacterId: string;
  totalFrames: number;
  commandResults: TimelineCommandResult[];
  adjustments: TimelineAdjustment[];
  failures: TimelineFailure[];
  stateLog: TimelineStateLogEntry[];
}

export interface TargetClockSummary {
  targetId: TargetId;
  targetName: string;
  finalGlobalFrame: number;
  finalTargetFrame: number;
  frozenFramesConsumed: number;
  frozenFramesRemaining: number;
  hitlagApplications: number;
  totalExtensionFrames: number;
}

export type TargetClockAudit =
  | {
      version: "1.0.0";
      mode: "disabled";
      hitlagStatus: "unsupported-enemy-hitlag";
      targets: [];
    }
  | {
      version: "1.0.0";
      mode: "target-local-hitlag-v1";
      hitlagStatus: "modeled-enemy-hitlag";
      roundingModel: "ceil-ceil-v1";
      applicationOrder: "after-current-target-tick";
      mechanicsDataStatus: "fixed-gcsim-provisional";
      targets: TargetClockSummary[];
    };

/**
 * One configured target check, including misses and zero-extension checks.
 * The linked hit-resolution row remains authoritative for landed/miss state.
 */
export interface TargetHitlagLogEntry {
  id: number;
  globalFrame: number;
  timeSeconds: number;
  targetFrame: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  targetId: TargetId;
  targetName: string;
  sourceActorId: string;
  sourceActionId: string;
  hitId: string;
  hitGroupId: string;
  hitResolutionLogId: number;
  haltFrames: number;
  factor: number;
  roundedHaltFrames: number;
  extensionFrames: number;
  frozenFramesBefore: number;
  frozenFramesAfter: number;
  pausedGlobalFrameStart: number | null;
  nextTargetAdvanceGlobalFrame: number | null;
  applied: boolean;
  blockedReason: "TARGET_MISS" | "ZERO_EXTENSION" | null;
  /**
   * Active, Hitlag-affected reaction modifiers whose end frames were extended
   * by this application (currently Superconduct resistance shred).
   */
  extendedReactionStatusLogIds: number[];
  mechanicsDataStatus: "fixed-gcsim-provisional";
}

/**
 * Compact replay log for a single enemy clock. It records jumps and Hitlag
 * mutations rather than one row per global frame.
 */
export interface TargetClockLogEntry {
  id: number;
  targetId: TargetId;
  targetName: string;
  operation: "advance" | "apply-hitlag";
  globalFrameBefore: number;
  globalFrameAfter: number;
  targetFrameBefore: number;
  targetFrameAfter: number;
  frozenFramesBefore: number;
  consumedFrozenFrames: number;
  addedFrozenFrames: number;
  frozenFramesAfter: number;
  targetHitlagLogId: number | null;
  cause: "hit" | "target-local-task" | "simulation-end";
}

export interface SimulationResult {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  engineVersion: string;
  dataVersion: string;
  randomSeed: string;
  /** Authoritative identity envelope for replaying this exact run. */
  runManifest: SimulationRunManifest;
  /** Convenience alias; must equal runManifest.resolvedRuntimeOptions. */
  resolvedRuntimeOptions: ResolvedSimulationRuntimeOptions;
  /** Convenience alias; must equal runManifest.plugins. */
  pluginManifest: DamagePluginManifestEntry[];
  reproducibilityKey: string;
  compatibilityMode: CompatibilityMode;
  /** Partial only when this run actually crossed an unsupported mechanic. */
  mechanicsStatus: SimulationMechanicsStatus;
  config: SimConfig;
  /** Static scenario poses used to resolve actor-local attack geometry. */
  actorPoses: ActorPoseDefinition[];
  /** Effective per-target stats after applying shared enemy defaults. */
  enemyTargets: ResolvedEnemyTargetProfile[];
  damageEvents: DamageEvent[];
  hitEvents: DamageEvent[];
  /** Every scheduled target check, including misses that did no damage. */
  hitResolutionLog: HitResolutionLogEntry[];
  /** Versioned target-clock mode and per-target final state. */
  targetClockAudit: TargetClockAudit;
  /** Compact, replayable target-clock transitions. */
  targetClockLog: TargetClockLogEntry[];
  /** Every configured target Hitlag check, including blocked rows. */
  targetHitlagLog: TargetHitlagLogEntry[];
  /** One first-crossing entry per target; later hits carry the audit in-place. */
  targetMechanicsTruncationLog: TargetMechanicsTruncationLogEntry[];
  /** Transformative reaction scheduling, GCD, spatial fanout, and damage links. */
  reactionDamageLog: ReactionDamageLogEntry[];
  /** Target-scoped reaction status applications with exact half-open windows. */
  reactionStatusLog: ReactionStatusLogEntry[];
  /** Periodic reaction stream starts, refreshes, ticks, wanes, and stops. */
  periodicReactionLog: PeriodicReactionLogEntry[];
  /** Frozen durability starts, refreshes, immunity, consumption, and expiry. */
  frozenStateLog: FrozenStateLogEntry[];
  /** Quicken state starts, refreshes, weaker no-ops, and exact expiry. */
  quickenStateLog: QuickenStateLogEntry[];
  /** Burning marker, Fuel, per-tick/skip, ICD, and stop lifecycle. */
  burningStateLog: BurningStateLogEntry[];
  /** Bloom scheduling plus Dendro-core spawn/removal lifecycle. */
  dendroCoreLog: DendroCoreLogEntry[];
  /** Once-per-hit-group Pyro/Electro contacts with active Dendro cores. */
  dendroCoreContactLog: DendroCoreContactLogEntry[];
  /** Core-owned, versioned projection of active Dendro-core entities. */
  dendroCoreTimeline: DendroCoreTimeline;
  /** Crystallize shard lifecycle, explicit pickup attempts, and evictions. */
  crystallizeShardLog: CrystallizeShardLogEntry[];
  /** Crystallize shield add/overwrite/expiry state transitions. */
  crystallizeShieldLog: CrystallizeShieldLogEntry[];
  /** Core-produced step points for shield visualization. */
  crystallizeShieldTimeline: CrystallizeShieldTimelinePoint[];
  /** Player-side reaction self-damage geometry checks. */
  playerHitResolutionLog: PlayerHitResolutionLogEntry[];
  /** Player-side HP damage events after resistance and shields. */
  playerDamageEvents: PlayerDamageEvent[];
  /** Core-owned, versioned player HP state projection. */
  playerHpTimeline: PlayerHpTimeline;
  /** Per-character player HP aggregates. */
  playerHpSummaries: PlayerHpSummary[];
  /** Whether player-side reaction damage was disabled or modeled. */
  playerSelfDamageStatus: PlayerSelfDamageStatus;
  /** All player HP damage taken in this run. */
  totalPlayerDamageTaken: number;
  /** Reaction self-damage subset of total player HP damage. */
  totalReactionSelfDamageTaken: number;
  /** Core-resolved, half-open target phase windows consumed by the hit resolver. */
  targetPhaseTimeline: TargetPhaseTimelineEntry[];
  /** Core-resolved linear target movement segments consumed by geometry checks. */
  targetMotionTimeline: TargetMotionTimelineEntry[];
  skippedActions: SkippedAction[];
  actionLog: ActionLogEntry[];
  energyStats: Record<string, EnergySummary>;
  energyLog: EnergyLogEntry[];
  particleEvents: ParticleEventLog[];
  particleTriggerLog: ParticleTriggerLogEntry[];
  energyCurve: EnergyCurvePoint[];
  totalDamage: number;
  dps: number;
  reactedHits: number;
  byCharacter: Record<string, number>;
  characterSummaries: CharacterDamageSummary[];
  targetSummaries: EnemyTargetDamageSummary[];
  bySkill: SkillSummary[];
  perSecond: Array<Record<string, number>>;
  damageCurve: DamageCurvePoint[];
  auraTimeline: AuraTimelinePoint[];
  /** Unified, deterministically ordered target Aura observations/mutations. */
  targetStateTimeline: TargetStateTimeline;
  /** Exact target Aura snapshots before the first simulation frame. */
  auraInitialStates: AuraEndState[];
  /** Exact target Aura snapshots after advancing every engine to the run end. */
  auraEndStates: AuraEndState[];
  timelineExecution?: TimelineExecution;
}
