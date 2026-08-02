import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  type ClassicReactionFormulaRoot,
} from "@genshin-dps-lab/reaction-formulas";
import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  type GcsimDamageGroupId,
  type GcsimDamageGroupRoot,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  type GcsimElementalApplicationRoot,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
  type GcsimReactionOwnedApplicationBinding,
  type GcsimReactionOwnedApplicationV1Binding,
  type GcsimReactionOwnedApplicationPolicyRoot,
  type GcsimReactionOwnedApplicationPolicyV1Root,
  type GcsimReactionDamageGroupBinding,
  type GcsimReactionDamageGroupReaction,
  type GcsimSwirlPropagationElement,
  type PublicGcsimElementalApplicationGroupId,
} from "@genshin-dps-lab/icd-profiles";

export const TARGET_TASK_PHASE_SCHEMA_VERSION = "1.37.0" as const;
export const TARGET_TASK_PHASE_ENGINE_VERSION =
  "1.37.0-target-task-phase" as const;
export const TARGET_REACTABLE_PHASE_SCHEMA_VERSION = "1.38.0" as const;
export const TARGET_REACTABLE_PHASE_ENGINE_VERSION =
  "1.38.0-target-reactable-phase" as const;
export const SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION = "1.39.0" as const;
export const SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION =
  "1.39.0-shatter-recursive-delivery" as const;
export const EC_NEXT_TARGET_TICK_SCHEMA_VERSION = "1.40.0" as const;
export const EC_NEXT_TARGET_TICK_ENGINE_VERSION =
  "1.40.0-ec-next-target-tick-cleanup" as const;
export const EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION = "1.41.0" as const;
export const EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION =
  "1.41.0-ec-secondary-wet-propagation" as const;
export const EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION = "1.42.0" as const;
export const EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION =
  "1.42.0-ec-global-cadence-safety" as const;
export const BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION = "1.44.0" as const;
export const BURNING_CALLBACK_DELIVERY_ENGINE_VERSION =
  "1.44.0-burning-callback-delivery" as const;
export const REACTION_FORMULA_ROOT_SCHEMA_VERSION = "1.45.0" as const;
export const REACTION_FORMULA_ROOT_ENGINE_VERSION =
  "1.45.0-reaction-formula-root" as const;
export const DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION = "1.46.0" as const;
export const DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION =
  "1.46.0-direct-damage-group-root" as const;
export const ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION = "1.47.0" as const;
export const ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION =
  "1.47.0-elemental-application-icd-root" as const;
export const REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION = "1.48.0" as const;
export const REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION =
  "1.48.0-reaction-owned-application-root" as const;
export const REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION = "1.49.0" as const;
export const REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION =
  "1.49.0-reaction-owned-reset-boundary" as const;
export const REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION =
  "1.50.0" as const;
export const REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION =
  "1.50.0-reaction-damage-reset-boundary" as const;
export const BASIC_REACTION_SCHEDULER_SCHEMA_VERSION = "1.51.0" as const;
export const BASIC_REACTION_SCHEDULER_ENGINE_VERSION =
  "1.51.0-basic-reaction-scheduler" as const;
export const FREEZE_BROKEN_ATTACK_SCHEMA_VERSION = "1.52.0" as const;
export const FREEZE_BROKEN_ATTACK_ENGINE_VERSION =
  "1.52.0-freeze-broken-attack" as const;
export const QUICKEN_BLOOM_TASK_SCHEMA_VERSION = "1.36.0" as const;
export const QUICKEN_BLOOM_TASK_ENGINE_VERSION =
  "1.36.0-quicken-bloom-task" as const;
export const CURRENT_SCHEMA_VERSION =
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION;
export const CURRENT_ENGINE_VERSION =
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION;
export const ELEMENTAL_ENEMY_RESISTANCE_SCHEMA_VERSION = "1.35.0" as const;
export const ELEMENTAL_ENEMY_RESISTANCE_ENGINE_VERSION =
  "1.35.0-elemental-enemy-resistance" as const;
export const GENERAL_REACTION_ORDER_SCHEMA_VERSION = "1.34.0" as const;
export const GENERAL_REACTION_ORDER_ENGINE_VERSION =
  "1.34.0-general-reaction-order" as const;
export const TARGET_LOCAL_HITLAG_SCHEMA_VERSION = "1.33.0" as const;
export const TARGET_LOCAL_HITLAG_ENGINE_VERSION =
  "1.33.0-target-local-hitlag" as const;
/** Frozen run-manifest wire used by the 1.42 and 1.44 result schemas. */
export const LEGACY_SIMULATION_RUN_MANIFEST_VERSION = "1.0.0" as const;
/** Frozen 1.45 run-manifest wire; 1.1 adds the reaction-formula trust root. */
export const REACTION_FORMULA_RUN_MANIFEST_VERSION = "1.1.0" as const;
/** Frozen 1.46 run-manifest wire; 1.2 binds the direct-damage-group root. */
export const DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION = "1.2.0" as const;
/** Frozen 1.47 run-manifest wire; 1.3 binds the direct-application ICD root. */
export const ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION = "1.3.0" as const;
/** Frozen 1.48 run-manifest wire; 1.4 binds the first reaction-owned root. */
export const REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION = "1.4.0" as const;
/** Frozen 1.49 run-manifest wire; 1.5 admits an explicit v1/v2 policy root. */
export const REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION = "1.5.0" as const;
/** Frozen 1.50 run-manifest wire; 1.6 binds reaction damage-group scheduling. */
export const REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION =
  "1.6.0" as const;
/** Current 1.51 run-manifest wire; 1.7 binds basic reaction scheduling. */
export const BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION = "1.7.0" as const;
/** Current 1.52 run-manifest wire; 1.8 binds Freeze Broken audit behavior. */
export const FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION = "1.8.0" as const;
export const SIMULATION_RUN_MANIFEST_VERSION =
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION;
/**
 * Public results can verify plugin trace structure and downstream arithmetic,
 * but cannot replay arbitrary runtime plugin code from its declared manifest.
 */
export const DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION =
  "structural-only-unverified-runtime-output-v1" as const;
/**
 * This identity algorithm is intentionally versioned and non-cryptographic.
 * It detects ordinary configuration drift; it is not an integrity signature.
 */
export const REPRODUCIBILITY_IDENTITY_ALGORITHM = "fnv1a32-v2" as const;
export const BURNING_REACTION_SCHEMA_VERSION = "1.30.0" as const;
export const BURNING_REACTION_ENGINE_VERSION =
  "1.30.0-burning-reaction" as const;
export const DENDRO_CORE_SCHEMA_VERSION = "1.31.0" as const;
export const DENDRO_CORE_ENGINE_VERSION = "1.31.0-dendro-cores" as const;
export const PLAYER_REACTION_DAMAGE_SCHEMA_VERSION = "1.32.0" as const;
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
  "none" | "melt" | "reverseMelt" | "vaporize" | "reverseVaporize";

export type OneShotTransformativeReaction = "overload" | "superconduct";
export type PeriodicTransformativeReaction = "electroCharged";
export type BurningReaction = "burning";
export type DendroCoreReaction = "bloom" | "burgeon" | "hyperbloom";
export type ShatterReaction = "shatter";
export type SwirlReaction =
  "swirlPyro" | "swirlHydro" | "swirlCryo" | "swirlElectro";
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
export type MechanicsResolutionStatus = "authoritative" | "mechanics-truncated";
export type SimulationMechanicsStatus = "complete" | "partial";
export type TransformativeReaction =
  | OneShotTransformativeReaction
  | PeriodicTransformativeReaction
  | BurningReaction
  | ShatterReaction
  | SwirlReaction
  | DendroCoreReaction;
export type NonDamageReaction =
  "freeze" | QuickenReaction | CrystallizeReaction;
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
export type AbilityFollowupKind = AbilityKind | "dash" | "jump" | "swap";
export type AuraElement = Extract<
  Element,
  "pyro" | "cryo" | "hydro" | "electro"
>;
export type PersistentAuraElement = AuraElement | "dendro";
export type AuraStateElement =
  PersistentAuraElement | "quicken" | "frozen" | "burning" | "burningFuel";
export type IcdGroup = string;
export type ParticleElement = Exclude<Element, "physical"> | "neutral";
export type ParticleKind = "particle" | "orb";
export type TargetId = string;
export type TargetHitOutcome = "landed" | "miss";
export type TargetDamagePolicy = "normal" | "immune";
export type TargetAuraPolicy = "normal" | "blocked";
export type TargetHitConfirmPolicy = "normal" | "blocked";
export type PlayerReactionSelfDamageKind =
  "burning" | "bloom" | "burgeon" | "hyperbloom";
export type PlayerSelfDamageStatus =
  "unsupported-player-damage-model" | "modeled-player-reaction-damage";

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
  DisabledPlayerDamageModel | ReactionSelfPlayerDamageModel;

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

/** Exact elemental-application wire embedded in every config through 1.46. */
export interface LegacyElementalApplicationV146 {
  /** Nominal elemental application strength (for example 1U, 2U, or 4U). */
  gaugeUnits: number;
  /** Independent ICD stream identifier within one actor and ICD group. */
  icdTag: string;
  icdGroup: IcdGroup;
}

/** Explicit 1.47 selector for one configured elemental application. */
export type ElementalApplicationIcdSelector =
  | {
      mode: "no-icd-v1";
    }
  | {
      mode: "legacy-boolean-profile-v1";
      icdTag: string;
      /** Key in reactionEngine.icdProfiles. */
      profileId: string;
    }
  | {
      mode: "fixed-gcsim-application-v1";
      icdTag: string;
      /** Public fixed groups exclude reaction-owned and Burning-only groups. */
      groupId: PublicGcsimElementalApplicationGroupId;
    };

/** Current, explicitly versioned elemental-application input. */
export interface ElementalApplication {
  /** Nominal elemental application strength before the ICD multiplier. */
  gaugeUnits: number;
  icd: ElementalApplicationIcdSelector;
}

/**
 * In-memory helper boundary used by low-level Aura tests and adapters while
 * persisted V146/V147 configs remain separately exact.
 */
export type AnyElementalApplication =
  ElementalApplication | LegacyElementalApplicationV146;

/**
 * Closed engine-owned channel set for reaction-derived applications.
 * Callers cannot supply an ICD tag, group, element override, or policy id.
 */
export type TrustedReactionElementalApplicationChannel =
  | { kind: "burning-tick" }
  | {
      kind: "swirl-propagation";
      element: GcsimSwirlPropagationElement;
    };

/**
 * Narrow input accepted by the trusted reaction-application state machine.
 * Burning has no authorable Gauge field: the policy fixes it at 1U. Swirl
 * alone carries the Gauge propagated by the owning reaction calculation.
 */
export type TrustedReactionElementalApplicationInput =
  | {
      frame: number;
      sourceActorId: string;
      channel: { kind: "burning-tick" };
    }
  | {
      frame: number;
      sourceActorId: string;
      channel: {
        kind: "swirl-propagation";
        element: GcsimSwirlPropagationElement;
      };
      nominalGaugeUnits: number;
    };

/**
 * Auditable selector derived from a trusted channel and the compiled policy.
 * This is output provenance, never a user-authorable persisted hit selector.
 */
export type TrustedReactionElementalApplicationSelectorV1 =
  | {
      mode: "fixed-gcsim-reaction-owned-application-v1";
      policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID;
      channel: { kind: "burning-tick" };
    }
  | {
      mode: "fixed-gcsim-reaction-owned-application-v1";
      policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID;
      channel: {
        kind: "swirl-propagation";
        element: GcsimSwirlPropagationElement;
      };
    };

export type TrustedReactionElementalApplicationSelectorV2 =
  | {
      mode: "fixed-gcsim-reaction-owned-application-v2";
      policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID;
      channel: { kind: "burning-tick" };
    }
  | {
      mode: "fixed-gcsim-reaction-owned-application-v2";
      policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID;
      channel: {
        kind: "swirl-propagation";
        element: GcsimSwirlPropagationElement;
      };
    };

/** Current selector union; persisted 1.49 runs retain the selected policy. */
export type TrustedReactionElementalApplicationSelector =
  | TrustedReactionElementalApplicationSelectorV1
  | TrustedReactionElementalApplicationSelectorV2;

export interface InitialAuraApplication {
  element: PersistentAuraElement;
  /** Nominal application strength; the normal aura starts at 0.8 × this value. */
  gaugeUnits: number;
}

export type IcdSequenceTailPolicy = "repeat" | "clamp";

export interface IcdProfile {
  /** Time-based reset boundary for the sequence, in 60 FPS frames. */
  resetFrames: number;
  /**
   * Per-hit elemental application permission sequence inside one reset
   * window.
   */
  applicationSequence: boolean[];
  /**
   * Behavior after applicationSequence is exhausted. Historical and custom
   * profiles that omit this field retain the pre-1.38 repeat behavior.
   */
  tailPolicy?: IcdSequenceTailPolicy;
}

export interface AuraReactionEngineConfig {
  mode:
    | "aura-v1"
    | "aura-v2"
    | "aura-v3"
    | "aura-v4"
    | "aura-v5"
    | "aura-v6"
    | "aura-v7"
    | "aura-v8"
    | "aura-v9";
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
  { mode: "disabled" } | { mode: "target-local-hitlag-v1" };

/**
 * Selects how target-owned tasks share the simulator's ordering boundary.
 * Historical configurations preserve the global event-heap behavior.
 */
export type TargetTaskModel =
  | { mode: "legacy-event-heap-v1" }
  | { mode: "target-phase-v1" }
  | { mode: "target-phase-v2" }
  | { mode: "target-phase-v3" };

/**
 * Selects how zero-delay reaction damage is delivered relative to the hit
 * that triggered it. Historical configurations preserve deferred heap
 * delivery; the recursive mode is an explicit 1.39+ opt-in.
 */
export type ReactionDeliveryModel =
  | { mode: "deferred-event-heap-v1" }
  | { mode: "shatter-recursive-zero-delay-v1" };

/**
 * Selects whether an Electro-Charged periodic tick is confined to its source
 * target or also checks nearby targets with live Hydro Aura. The spatial
 * branch remains provisional until its target-selection details are backed by
 * primary game evidence.
 */
export type ElectroChargedPropagationModel =
  | { mode: "single-target-v1" }
  | {
      mode: "nearby-wet-radius-v1";
      radius: number;
      verificationStatus: "provisional";
    };

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
  /**
   * Legacy signed defense adjustment: negative values reduce enemy defense,
   * while positive values increase it. The name is frozen for compatibility.
   */
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
  /** Signed defense adjustment; negative means defense reduction. */
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

export interface HitDefinition<TApplication = ElementalApplication> {
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
  application?: TApplication;
  reaction?: AmplifyingReaction;
  reactionOverride?: AmplifyingReaction;
  snapshot?: SnapshotMode;
  scalingOwnerId?: string;
  creditId?: string;
  flat?: number;
  flatSources?: FlatDamageSource[];
  dmgBonus?: number;
  defIgnore?: number;
  /** Signed defense adjustment; negative means defense reduction. */
  defReduction?: number;
  resShred?: number;
  critRate?: number;
  critDmg?: number;
  reactionBonus?: number;
  ampBase?: number;
  /**
   * Ordinary direct-damage group identity. This controls the fixed damage
   * sequence multiplier and the generic OnEnemyHit signal only. It does not
   * gate skill-owned particles or other attack callbacks. Elemental
   * application and Aura ICD remain governed by `application`.
   */
  directDamageGroup?: {
    icdTag: string;
    icdGroup: GcsimDamageGroupId;
  };
  groupMultiplier?: number;
}

export type LegacyHitDefinitionV146 =
  HitDefinition<LegacyElementalApplicationV146>;

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
  /** Signed defense adjustment; negative means defense reduction. */
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

export interface ActionDefinition<TApplication = ElementalApplication> {
  id: string;
  actorId: string;
  name: string;
  at: number;
  once?: boolean;
  cycles?: number[];
  everyNCycles?: number;
  cycleRemainder?: number;
  energyCost?: number;
  hits?: HitDefinition<TApplication>[];
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

export type RotationCommand = ActionDefinition<ElementalApplication>;
export type LegacyRotationCommandV146 =
  ActionDefinition<LegacyElementalApplicationV146>;

export type FrameHitDefinition<TApplication = ElementalApplication> = Omit<
  HitDefinition<TApplication>,
  "offset"
> & {
  frame: number;
};

export type LegacyFrameHitDefinitionV146 =
  FrameHitDefinition<LegacyElementalApplicationV146>;

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

export interface AbilityDefinition<TApplication = ElementalApplication> {
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
  hits?: FrameHitDefinition<TApplication>[];
  buffs?: FrameBuffDefinition[];
  debuffs?: FrameDebuffDefinition[];
  energyGains?: FrameEnergyEvent[];
  particles?: FrameParticleDefinition[];
  timelineState?: AbilityTimelineState;
}

export type LegacyAbilityDefinitionV146 =
  AbilityDefinition<LegacyElementalApplicationV146>;

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

export interface LegalTimelineConfig<TApplication = ElementalApplication> {
  mode: "legal-frame-v1";
  fps: 60;
  legalityMode: TimelineLegalityMode;
  initialActiveCharacterId: string;
  swapFrames: number;
  abilities: AbilityDefinition<TApplication>[];
  commands: LegalTimelineCommand[];
}

export type LegacyLegalTimelineConfigV146 =
  LegalTimelineConfig<LegacyElementalApplicationV146>;

export interface ConfigMeta {
  name: string;
  version: string;
  note?: string;
  verificationStatus: VerificationStatus;
}

/**
 * Fixed formula-profile selection for the 1.45 compatibility boundary.
 *
 * The profile is provisional reference data from the pinned gcsim revision;
 * this identity does not assert official-server truth or complete parity.
 */
export interface ReactionFormulaModel {
  mode: "classic-formula-profile-v1";
  profileId: typeof CLASSIC_REACTION_FORMULA_PROFILE_ID;
}

/**
 * Fixed ordinary direct-damage-group selection for the 1.46 boundary.
 *
 * The selected profile is provisional data from the pinned gcsim revision.
 * It does not model elemental-application sequences or Aura ICD.
 */
export interface DirectDamageGroupModel {
  mode: "fixed-gcsim-direct-damage-group-v1";
  profileId: typeof GCSIM_DAMAGE_GROUP_PROFILE_ID;
}

/** Fixed numeric elemental-application profile selected by current configs. */
export interface ElementalApplicationIcdModel {
  mode: "fixed-gcsim-elemental-application-v1";
  profileId: typeof GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID;
}

/**
 * Fixed, engine-owned reaction application policy selected by 1.48 configs.
 *
 * This model is deliberately not an authorable per-hit selector. Trusted
 * reaction channels resolve their tag, group, element, and Gauge rules from
 * the compiled policy root.
 */
export interface ReactionOwnedElementalApplicationModelV1 {
  mode: "fixed-gcsim-reaction-owned-application-v1";
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID;
}

export interface ReactionOwnedElementalApplicationModelV2 {
  mode: "fixed-gcsim-reaction-owned-application-v2";
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID;
}

/**
 * Current 1.49 selection. Migration may retain v1 exactly; newly constructed
 * configs select v2 explicitly.
 */
export type ReactionOwnedElementalApplicationModel =
  | ReactionOwnedElementalApplicationModelV1
  | ReactionOwnedElementalApplicationModelV2;

/** Frozen 1.49 lazy F30 reaction-damage-group window. */
export interface ReactionDamageGroupModelV1 {
  mode: "legacy-reaction-damage-group-window-v1";
  policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID;
}

/**
 * Current 1.50 scheduled F29 reset task. Same-frame resolution remains
 * insertion/eventSequence dependent and is not an unconditional reset-before.
 */
export interface ReactionDamageGroupModelV2 {
  mode: "fixed-gcsim-reaction-damage-task-order-v2";
  policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID;
}

export type ReactionDamageGroupModel =
  | ReactionDamageGroupModelV1
  | ReactionDamageGroupModelV2;

/** Frozen compatibility selection for migrated 1.50-and-earlier configs. */
export interface BasicReactionSchedulerModelV1 {
  mode: "legacy-immediate-basic-reaction-scheduler-v1";
  policyId: typeof LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID;
}

/** Current 1.51 deferred non-reacted Aura attachment scheduler. */
export interface BasicReactionSchedulerModelV2 {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2";
  policyId: typeof GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID;
}

export type BasicReactionSchedulerModel =
  | BasicReactionSchedulerModelV1
  | BasicReactionSchedulerModelV2;

/** Frozen compatibility selection for migrated 1.51-and-earlier configs. */
export interface FreezeBrokenAttackModelV1 {
  mode: typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE;
  policyId: typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID;
}

/** Current 1.52 normalized, reference-audit-only Freeze Broken policy. */
export interface FreezeBrokenAttackModelV2 {
  mode: typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE;
  policyId: typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID;
}

export type FreezeBrokenAttackModel =
  | FreezeBrokenAttackModelV1
  | FreezeBrokenAttackModelV2;

interface SimConfigCommon<TApplication = ElementalApplication> {
  dataVersion: string;
  randomSeed: string;
  meta: ConfigMeta;
  duration: number;
  cycleLength: number;
  enemy: EnemyProfile;
  characters: CharacterProfile[];
  /** Static scenario pose. Actor movement is not inferred in this version. */
  actorPoses?: ActorPoseDefinition[];
  rotation: ActionDefinition<TApplication>[];
  timeline?: LegalTimelineConfig<TApplication>;
  reactionEngine?: AuraReactionEngineConfig;
  /** Explicitly versioned player self-damage boundary. */
  playerDamageModel: PlayerDamageModel;
  /** Explicit opt-in; every pre-1.33 configuration migrates to disabled. */
  targetClockModel: TargetClockModel;
  /** Every pre-1.37 configuration migrates to the legacy event heap. */
  targetTaskModel: TargetTaskModel;
  /** Every pre-1.39 configuration migrates to deferred heap delivery. */
  reactionDeliveryModel: ReactionDeliveryModel;
  /** Every pre-1.41 configuration migrates to source-only EC damage. */
  electroChargedPropagationModel: ElectroChargedPropagationModel;
}

export type TargetTaskModelV142 = Exclude<
  TargetTaskModel,
  { mode: "target-phase-v3" }
>;

/** Exact persisted config shape for the frozen 1.42 wire. */
export interface SimConfigV142 extends Omit<
  SimConfigCommon<LegacyElementalApplicationV146>,
  "targetTaskModel"
> {
  schemaVersion: typeof EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION;
  engineVersion: typeof EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION;
  targetTaskModel: TargetTaskModelV142;
}

/** Exact persisted config shape for the frozen 1.44 wire. */
export interface SimConfigV144 extends SimConfigCommon<LegacyElementalApplicationV146> {
  schemaVersion: typeof BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
  engineVersion: typeof BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
}

/** Frozen 1.45 config shape. The formula profile participates in configHash. */
export interface SimConfigV145 extends SimConfigCommon<LegacyElementalApplicationV146> {
  schemaVersion: typeof REACTION_FORMULA_ROOT_SCHEMA_VERSION;
  engineVersion: typeof REACTION_FORMULA_ROOT_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
}

/** Frozen 1.46 config shape. Both fixed mechanics roots bind configHash. */
export interface SimConfigV146 extends SimConfigCommon<LegacyElementalApplicationV146> {
  schemaVersion: typeof DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION;
  engineVersion: typeof DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
}

/** Frozen 1.47 config. All configured applications use explicit selectors. */
export interface SimConfigV147 extends SimConfigCommon {
  schemaVersion: typeof ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION;
  engineVersion: typeof ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
  elementalApplicationIcdModel: ElementalApplicationIcdModel;
}

/** Current 1.48 config binds the exact trusted reaction-application policy. */
export interface SimConfigV148 extends SimConfigCommon {
  schemaVersion: typeof REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION;
  engineVersion: typeof REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
  elementalApplicationIcdModel: ElementalApplicationIcdModel;
  reactionOwnedElementalApplicationModel: ReactionOwnedElementalApplicationModelV1;
}

/** Current 1.49 config preserves an explicit v1/v2 policy choice. */
export interface SimConfigV149 extends SimConfigCommon {
  schemaVersion: typeof REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION;
  engineVersion: typeof REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
  elementalApplicationIcdModel: ElementalApplicationIcdModel;
  reactionOwnedElementalApplicationModel: ReactionOwnedElementalApplicationModel;
}

/** Frozen 1.50 config adds an explicit reaction damage-group policy. */
export interface SimConfigV150 extends SimConfigCommon {
  schemaVersion: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION;
  engineVersion: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
  elementalApplicationIcdModel: ElementalApplicationIcdModel;
  reactionOwnedElementalApplicationModel: ReactionOwnedElementalApplicationModel;
  reactionDamageGroupModel: ReactionDamageGroupModel;
}

/** Current 1.51 config adds an explicit basic-reaction scheduler policy. */
export interface SimConfigV151 extends SimConfigCommon {
  schemaVersion: typeof BASIC_REACTION_SCHEDULER_SCHEMA_VERSION;
  engineVersion: typeof BASIC_REACTION_SCHEDULER_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
  elementalApplicationIcdModel: ElementalApplicationIcdModel;
  reactionOwnedElementalApplicationModel: ReactionOwnedElementalApplicationModel;
  reactionDamageGroupModel: ReactionDamageGroupModel;
  basicReactionSchedulerModel: BasicReactionSchedulerModel;
}

/** Current 1.52 config binds the Freeze Broken audit/callback policy. */
export interface SimConfigV152 extends SimConfigCommon {
  schemaVersion: typeof FREEZE_BROKEN_ATTACK_SCHEMA_VERSION;
  engineVersion: typeof FREEZE_BROKEN_ATTACK_ENGINE_VERSION;
  reactionFormulaModel: ReactionFormulaModel;
  directDamageGroupModel: DirectDamageGroupModel;
  elementalApplicationIcdModel: ElementalApplicationIcdModel;
  reactionOwnedElementalApplicationModel: ReactionOwnedElementalApplicationModel;
  reactionDamageGroupModel: ReactionDamageGroupModel;
  basicReactionSchedulerModel: BasicReactionSchedulerModel;
  freezeBrokenAttackModel: FreezeBrokenAttackModel;
}

export type SimConfig = SimConfigV152;

export type VersionedSimConfig =
  | SimConfigV142
  | SimConfigV144
  | SimConfigV145
  | SimConfigV146
  | SimConfigV147
  | SimConfigV148
  | SimConfigV149
  | SimConfigV150
  | SimConfigV151
  | SimConfigV152;

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

export interface DamagePluginManifestEntry extends DamagePluginDescriptor {
  /** Execution order. Plugin ordering is semantic and is never sorted. */
  order: number;
  /** Redundant array-position guard used by the strict runtime Schema. */
  index: number;
}

interface SimulationRunManifestCommon {
  identityAlgorithm: typeof REPRODUCIBILITY_IDENTITY_ALGORITHM;
  dataVersion: string;
  /** Versioned, non-cryptographic fingerprint of the migrated config. */
  configHash: string;
  resolvedRuntimeOptions: ResolvedSimulationRuntimeOptions;
  plugins: DamagePluginManifestEntry[];
  reproducibilityKey: string;
}

/** Exact run-manifest shape embedded in frozen 1.42 results. */
export interface SimulationRunManifestV142 extends SimulationRunManifestCommon {
  version: typeof LEGACY_SIMULATION_RUN_MANIFEST_VERSION;
  schemaVersion: typeof EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION;
  engineVersion: typeof EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION;
}

/** Exact run-manifest shape embedded in frozen 1.44 results. */
export interface SimulationRunManifestV144 extends SimulationRunManifestCommon {
  version: typeof LEGACY_SIMULATION_RUN_MANIFEST_VERSION;
  schemaVersion: typeof BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
  engineVersion: typeof BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
}

/** Exact pinned formula root embedded in current run manifests. */
export type ReactionFormulaRoot = ClassicReactionFormulaRoot;

/** Frozen 1.45 run manifest. */
export interface SimulationRunManifestV145 extends SimulationRunManifestCommon {
  version: typeof REACTION_FORMULA_RUN_MANIFEST_VERSION;
  schemaVersion: typeof REACTION_FORMULA_ROOT_SCHEMA_VERSION;
  engineVersion: typeof REACTION_FORMULA_ROOT_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
}

/** Exact pinned direct-damage-group root embedded in 1.46 run manifests. */
export type DirectDamageGroupRoot = GcsimDamageGroupRoot;

/** Frozen 1.46 run manifest. */
export interface SimulationRunManifestV146 extends SimulationRunManifestCommon {
  version: typeof DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION;
  schemaVersion: typeof DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION;
  engineVersion: typeof DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
}

/** Exact pinned elemental-application ICD root embedded in 1.47 manifests. */
export type ElementalApplicationIcdRoot = GcsimElementalApplicationRoot;

/** Frozen 1.47 run manifest binds the first three fixed mechanics roots. */
export interface SimulationRunManifestV147 extends SimulationRunManifestCommon {
  version: typeof ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION;
  schemaVersion: typeof ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION;
  engineVersion: typeof ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
  elementalApplicationIcdRoot: ElementalApplicationIcdRoot;
}

/** Exact pinned v1 policy root embedded in frozen 1.48 manifests. */
export type ReactionOwnedElementalApplicationRootV148 =
  GcsimReactionOwnedApplicationPolicyV1Root;

/** Current 1.48 run manifest binds all four fixed mechanics roots. */
export interface SimulationRunManifestV148 extends SimulationRunManifestCommon {
  version: typeof REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION;
  schemaVersion: typeof REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION;
  engineVersion: typeof REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
  elementalApplicationIcdRoot: ElementalApplicationIcdRoot;
  reactionOwnedElementalApplicationRoot: ReactionOwnedElementalApplicationRootV148;
}

/** Current compiled v2 root; migration may retain the exact frozen v1 root. */
export type ReactionOwnedElementalApplicationRoot =
  GcsimReactionOwnedApplicationPolicyRoot;
export type ReactionOwnedElementalApplicationRootV149 =
  | ReactionOwnedElementalApplicationRootV148
  | ReactionOwnedElementalApplicationRoot;

/** Current 1.49 run manifest binds the explicitly selected policy root. */
export interface SimulationRunManifestV149 extends SimulationRunManifestCommon {
  version: typeof REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION;
  schemaVersion: typeof REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION;
  engineVersion: typeof REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
  elementalApplicationIcdRoot: ElementalApplicationIcdRoot;
  reactionOwnedElementalApplicationRoot: ReactionOwnedElementalApplicationRootV149;
}

export type ReactionDamageGroupRootV1 =
  typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT;
export type ReactionDamageGroupRootV2 =
  typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT;
export type ReactionDamageGroupRoot =
  | ReactionDamageGroupRootV1
  | ReactionDamageGroupRootV2;

/** Frozen 1.50 manifest binds the exact selected reaction damage-group root. */
export interface SimulationRunManifestV150 extends SimulationRunManifestCommon {
  version: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION;
  schemaVersion: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION;
  engineVersion: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
  elementalApplicationIcdRoot: ElementalApplicationIcdRoot;
  reactionOwnedElementalApplicationRoot: ReactionOwnedElementalApplicationRootV149;
  reactionDamageGroupRoot: ReactionDamageGroupRoot;
}

export type BasicReactionSchedulerRootV1 =
  typeof LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT;
export type BasicReactionSchedulerRootV2 =
  typeof GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT;
export type BasicReactionSchedulerRoot =
  | BasicReactionSchedulerRootV1
  | BasicReactionSchedulerRootV2;

/** Current 1.51 manifest binds the exact selected scheduler policy root. */
export interface SimulationRunManifestV151 extends SimulationRunManifestCommon {
  version: typeof BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION;
  schemaVersion: typeof BASIC_REACTION_SCHEDULER_SCHEMA_VERSION;
  engineVersion: typeof BASIC_REACTION_SCHEDULER_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
  elementalApplicationIcdRoot: ElementalApplicationIcdRoot;
  reactionOwnedElementalApplicationRoot: ReactionOwnedElementalApplicationRootV149;
  reactionDamageGroupRoot: ReactionDamageGroupRoot;
  basicReactionSchedulerRoot: BasicReactionSchedulerRoot;
}

export type FreezeBrokenAttackRootV1 =
  typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT;
export type FreezeBrokenAttackRootV2 =
  typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT;
export type FreezeBrokenAttackRoot =
  | FreezeBrokenAttackRootV1
  | FreezeBrokenAttackRootV2;

/** Current 1.52 manifest binds the exact selected Freeze Broken policy root. */
export interface SimulationRunManifestV152 extends SimulationRunManifestCommon {
  version: typeof FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION;
  schemaVersion: typeof FREEZE_BROKEN_ATTACK_SCHEMA_VERSION;
  engineVersion: typeof FREEZE_BROKEN_ATTACK_ENGINE_VERSION;
  reactionFormulaRoot: ReactionFormulaRoot;
  directDamageGroupRoot: DirectDamageGroupRoot;
  elementalApplicationIcdRoot: ElementalApplicationIcdRoot;
  reactionOwnedElementalApplicationRoot: ReactionOwnedElementalApplicationRootV149;
  reactionDamageGroupRoot: ReactionDamageGroupRoot;
  basicReactionSchedulerRoot: BasicReactionSchedulerRoot;
  freezeBrokenAttackRoot: FreezeBrokenAttackRoot;
}

export type SimulationRunManifest = SimulationRunManifestV152;

export type VersionedSimulationRunManifest =
  | SimulationRunManifestV142
  | SimulationRunManifestV144
  | SimulationRunManifestV145
  | SimulationRunManifestV146
  | SimulationRunManifestV147
  | SimulationRunManifestV148
  | SimulationRunManifestV149
  | SimulationRunManifestV150
  | SimulationRunManifestV151
  | SimulationRunManifestV152;

export type SimulationEventType =
  | "action"
  | "buff"
  | "debuff"
  | "energy"
  | "particleSpawn"
  | "particleReceive"
  | "hit"
  | "quickenBloomFollowup"
  | "reactionDamage"
  | "reactionDamageGroupReset"
  | "reactionAuraAttachment"
  | "periodicReactionTick"
  | "periodicReactionWane"
  | "periodicReactionExpiry"
  | "electroChargedCleanup"
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
  /** Present in aura-v3 through aura-v9; each owner keeps an independent slot. */
  sourceSlots?: AuraSourceGaugeSlot[];
}

export interface AuraGaugeEntry {
  /** Nominal application may be Anemo/Geo/Dendro even when it cannot persist. */
  element: AuraStateElement | "anemo" | "geo" | "dendro";
  gaugeUnits: number;
  sourceActorId?: string;
  sourceMutations?: AuraSourceGaugeMutation[];
}

interface BasicReactionSchedulerLogEntryCommon {
  /** Zero-based contiguous id equal to the row's array index. */
  id: number;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  eventSequence: number;
  /** Sequence of the Swirl propagation attack that owns this row. */
  parentEventSequence: number;
  reactionDamageLogId: number;
  hitResolutionLogId: number;
  elementalApplicationIcdLogId: number | null;
  sourceActorId: string;
  targetId: TargetId;
  element: GcsimSwirlPropagationElement;
  reaction: ReactionType;
  reactions: ReactionType[];
  auraBefore: AuraStateEntry[];
  auraApplied: AuraGaugeEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
}

/** Attack-resolution phase for one trusted Swirl propagation target. */
export type BasicReactionSchedulerSwirlAttackResolutionLogEntry =
  BasicReactionSchedulerLogEntryCommon & {
    kind: "swirl-attack-resolution";
  } & (
      | { disposition: "legacy-immediate"; pairedLogId: null }
      | { disposition: "deferred"; pairedLogId: number }
      | { disposition: "not-attached"; pairedLogId: null }
    );

/** Deferred zero-delay Aura attachment committed after attack resolution. */
export interface BasicReactionSchedulerDeferredAuraAttachmentLogEntry extends BasicReactionSchedulerLogEntryCommon {
  kind: "deferred-aura-attachment";
  disposition: "committed";
  pairedLogId: number;
}

export type BasicReactionSchedulerLogEntry =
  | BasicReactionSchedulerSwirlAttackResolutionLogEntry
  | BasicReactionSchedulerDeferredAuraAttachmentLogEntry;
export type BasicReactionSchedulerLog = BasicReactionSchedulerLogEntry[];

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
  model: "none" | "manual-override" | "aura-engine" | "reaction-damage";
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
   * aura-v6 through aura-v9 ordered, independently auditable transformative reactions
   * for one elemental application. The legacy singular field remains the
   * first-item compatibility projection.
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
  reason: "UNSUPPORTED_DENDRO_REACTION" | "UNSUPPORTED_REACTION_ORDER";
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
  "start" | "refresh-fuel" | "refresh-snapshot" | "stop";

export type QuickenDecayEndCause =
  "QUICKEN_DECAY" | "BURNING_FUEL_EXPIRED" | null;

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
  clockModel: "target-local-no-hitlag" | "target-local-hitlag-v1";
  hitlagStatus: "unsupported-enemy-hitlag" | "modeled-enemy-hitlag";
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
  operation: "none" | "decay-rebase" | "partial-consume" | "remove";
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
  operation: "none" | "expiry-rebase" | "deplete-pending-purge";
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

export type ReactionTaskBlockedReason =
  "MISSING_QUICKEN" | "MISSING_HYDRO" | "TARGET_MECHANICS_TRUNCATION";

interface ElectroChargedCleanupAuditBase {
  generation: number;
  requestedTargetFrame: number;
  deadlineTargetFrame: number;
  requestReason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO";
  /**
   * Aura-v9 global-cadence state at cleanup resolution. Historical aura-v8
   * wires omit this field.
   */
  cadence?: ElectroChargedCleanupCadenceAudit;
}

export interface ElectroChargedCleanupCadenceAudit {
  status: "scheduled" | "dormant" | "stopped" | "superseded";
  nextTickFrame: number | null;
  waneListenerActive: boolean;
  lastCallbackFrame: number | null;
}

/**
 * Aura-v8 cleanup requested by a zero-delay Quicken→Bloom follow-up.
 *
 * A resolved audit owns one target-phase transition and one target-state
 * observation. The stop branch creates a periodic-reaction stop row; the
 * natural-expiry branch reuses the unique ordinary-decay stop row.
 */
export type ElectroChargedCleanupAudit =
  | (ElectroChargedCleanupAuditBase & {
      outcome: "stop";
      resolutionReason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM";
      resolvedGlobalFrame: number;
      resolvedTargetFrame: number;
      targetPhaseLogId: number;
      periodicReactionLogId: number;
      targetStateTimelinePointId: number;
    })
  | (ElectroChargedCleanupAuditBase & {
      outcome: "retain";
      resolutionReason: "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK";
      resolvedGlobalFrame: number;
      resolvedTargetFrame: number;
      targetPhaseLogId: number;
      periodicReactionLogId: null;
      targetStateTimelinePointId: number;
    })
  | (ElectroChargedCleanupAuditBase & {
      outcome: "superseded";
      resolutionReason: "ELECTRO_CHARGED_GENERATION_SUPERSEDED";
      resolvedGlobalFrame: number;
      resolvedTargetFrame: number;
      targetPhaseLogId: number;
      periodicReactionLogId: null;
      targetStateTimelinePointId: number;
    })
  | (ElectroChargedCleanupAuditBase & {
      outcome: "natural-expiry";
      resolutionReason: "AURA_DECAY_EXPIRED_BEFORE_CLEANUP";
      resolvedGlobalFrame: number;
      resolvedTargetFrame: number;
      targetPhaseLogId: number;
      periodicReactionLogId: number;
      targetStateTimelinePointId: number;
    })
  | (ElectroChargedCleanupAuditBase & {
      outcome: "ended-before-deadline";
      resolutionReason: "ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP";
      resolvedGlobalFrame: number;
      resolvedTargetFrame: number;
      targetPhaseLogId: number;
      periodicReactionLogId: number;
      targetStateTimelinePointId: number;
    })
  | (ElectroChargedCleanupAuditBase & {
      outcome: "pending-at-end";
      resolutionReason: null;
      resolvedGlobalFrame: null;
      resolvedTargetFrame: null;
      targetPhaseLogId: null;
      periodicReactionLogId: null;
      targetStateTimelinePointId: null;
    });

/**
 * Fixed-reference zero-delay work emitted after Quicken is created while
 * Hydro remains. The task owns its live Aura mutation; the originating damage
 * event stays an immutable record of the direct hit.
 */
export interface QuickenBloomFollowupTaskLogEntry {
  /** Zero-based, contiguous id equal to the emitted array index. */
  id: number;
  kind: "quicken-bloom-followup";
  frame: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  sourceActorId: string;
  sourceActionId: string;
  triggerHitId: string;
  triggerHitGroupId: string;
  triggerDamageEventId: number;
  triggerElement: "dendro" | "electro";
  triggerEventType: "hit" | "reactionDamage";
  triggerEventPriority: number;
  triggerEventSequence: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  status: "triggered" | "skipped";
  blockedReason: ReactionTaskBlockedReason | null;
  auraBefore: AuraStateEntry[];
  auraConsumed: AuraGaugeEntry[];
  auraAfter: AuraStateEntry[];
  bloomReaction: BloomReactionAudit | null;
  quickenStateLogIds: number[];
  dendroCoreLogIds: number[];
  dendroCoreIds: number[];
  electroChargedCleanup: ElectroChargedCleanupAudit | null;
  mechanicsDataStatus: "fixed-gcsim-provisional";
}

export type ReactionTaskLogEntry = QuickenBloomFollowupTaskLogEntry;

export interface TransformativeReactionAudit {
  reaction: OneShotTransformativeReaction;
  damageElement: Element;
  scheduled: boolean;
  damageFrame: number;
  radius: number;
  baseMultiplier: number;
  blockedReason: "REACTION_DAMAGE_GCD" | "TARGET_MECHANICS_TRUNCATION" | null;
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
  /** Aura-v9 global callback state; historical audit wires omit it. */
  cadenceStatus?: "scheduled" | "dormant" | "stopped";
  /** Aura-v9 Wane listener state; historical audit wires omit it. */
  waneListenerActive?: boolean;
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

/**
 * Simulator-owned audit of one damage plugin's direct group-multiplier step.
 *
 * Arbitrary code plugins cannot be re-executed from a serialized result. This
 * trace therefore binds the ordered manifest identity and the multiplier
 * chain that the simulator actually observed; it is not a proof of the
 * plugin's implementation semantics.
 */
export interface DirectDamageGroupPluginMultiplierTraceEntry {
  pluginManifestIndex: number;
  pluginId: string;
  inputMultiplier: number;
  outcome: "no-change" | "override";
  outputMultiplier: number;
}

/**
 * Replayable ordinary direct-damage-group decision for one landed target hit.
 *
 * A bypassed row preserves the configured/plugin multiplier audit while all
 * group-state fields remain null. Elemental application is intentionally not
 * represented here because it is an independent mechanic.
 */
export interface DirectDamageGroupLogEntry {
  id: number;
  damageEventId: number;
  hitResolutionLogId: number;
  frame: number;
  sourceActorId: string;
  targetId: TargetId;
  hitId: string;
  profileId: typeof GCSIM_DAMAGE_GROUP_PROFILE_ID;
  evaluation: "bypassed" | "evaluated";
  icdTag: string | null;
  icdGroup: GcsimDamageGroupId | null;
  /** Group used by the first hit that created the shared tag window. */
  windowStartGroup: GcsimDamageGroupId | null;
  resetFrames: number | null;
  windowStartFrame: number | null;
  resetAtFrame: number | null;
  hitIndex: number | null;
  sequenceIndex: number | null;
  sequenceMultiplier: 0 | 1;
  configuredMultiplier: number;
  /** Configured multiplier presented to the plugin chain. */
  prePluginMultiplier: number;
  /** Plugin-chain output before applying the fixed sequence multiplier. */
  postPluginMultiplier: number;
  /**
   * Ordered runtime multiplier trace, one row per plugin manifest. Its public
   * proof is deliberately structural-only because executable plugin code is
   * not serialized into the result.
   */
  pluginMultiplierTrace: DirectDamageGroupPluginMultiplierTraceEntry[];
  pluginTraceVerification: typeof DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION;
  /** postPluginMultiplier multiplied by sequenceMultiplier. */
  effectiveMultiplier: number;
  /** Only the generic gcsim-style OnEnemyHit signal is gated by the sequence. */
  damageGroupOnEnemyHitAllowed: boolean;
}

export type ElementalApplicationIcdSkippedReason =
  "miss" | "target-aura-blocked" | "no-aura-engine" | "mechanics-truncated";

/**
 * Closed skip set for trusted reaction-owned delivery in 1.48.
 *
 * A trusted Burning/Swirl delivery can only be scheduled by an Aura engine,
 * so `no-aura-engine` is a fail-closed invariant violation rather than a
 * serializable reaction-owned outcome. The wider 1.47 configured-hit reason
 * remains frozen above for compatibility.
 */
export type ReactionOwnedElementalApplicationIcdSkippedReasonV148 =
  | "miss"
  | "target-aura-blocked"
  | "mechanics-truncated";

/**
 * A configured application was not presented to any ICD state machine.
 * Skips never create or advance an application window.
 */
export interface ElementalApplicationIcdSkippedDecision {
  kind: "skipped";
  evaluated: false;
  reason: ElementalApplicationIcdSkippedReason;
  consumed: false;
  applicationMultiplier: 0;
  allowed: false;
}

/** Exact skipped decision admitted by a trusted 1.48 reaction-owned row. */
export interface ReactionOwnedElementalApplicationIcdSkippedDecisionV148 {
  kind: "skipped";
  evaluated: false;
  reason: ReactionOwnedElementalApplicationIcdSkippedReasonV148;
  consumed: false;
  applicationMultiplier: 0;
  allowed: false;
}

/** Explicit no-ICD applications bypass all counters and timers. */
export interface ElementalApplicationNoIcdDecision {
  kind: "no-icd";
  evaluated: true;
  consumed: false;
  applicationMultiplier: 1;
  allowed: true;
  scope: null;
  profileId: null;
  icdTag: null;
  groupId: null;
  windowStartGroupId: null;
  resetFrames: null;
  windowStartFrame: null;
  resetAtFrame: null;
  hitIndex: null;
  sequenceIndex: null;
  tailPolicy: null;
  resetSchedulePolicy: "bypass";
}

/**
 * Frozen boolean-profile decision used by explicitly migrated legacy inputs.
 * The profile consumes an attempt even when its multiplier is zero.
 */
export interface ElementalApplicationLegacyProfileDecision {
  kind: "legacy-profile";
  evaluated: true;
  consumed: true;
  applicationMultiplier: 0 | 1;
  allowed: boolean;
  scope: "actor-tag-profile" | "target-global-burning";
  profileId: string;
  icdTag: string;
  groupId: null;
  windowStartGroupId: null;
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  hitIndex: number;
  sequenceIndex: number;
  tailPolicy: IcdSequenceTailPolicy;
  resetSchedulePolicy: "window-start-plus-reset-frames";
}

/**
 * Numeric decision from the pinned gcsim elemental-application profile.
 * Group selects the current sequence; actor plus tag owns the shared window.
 */
export interface ElementalApplicationFixedGcsimDecision {
  kind: "fixed-gcsim";
  evaluated: true;
  consumed: true;
  applicationMultiplier: number;
  allowed: boolean;
  scope: "actor-tag";
  profileId: typeof GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID;
  icdTag: string;
  groupId: PublicGcsimElementalApplicationGroupId;
  windowStartGroupId: PublicGcsimElementalApplicationGroupId;
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  hitIndex: number;
  sequenceIndex: number;
  tailPolicy: "clamp";
  resetSchedulePolicy: "window-start-plus-reset-frames-minus-one";
}

/**
 * Trusted numeric decision derived only from the compiled reaction-owned
 * policy. Burning and Swirl propagation consume reserved fixed ICD groups;
 * neither can be selected by an ordinary configured hit.
 */
interface ElementalApplicationReactionFixedGcsimDecisionV148Base {
  kind: "reaction-fixed-gcsim";
  evaluated: true;
  consumed: true;
  applicationMultiplier: number;
  allowed: boolean;
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID;
  profileId: typeof GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID;
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  hitIndex: number;
  sequenceIndex: number;
  tailPolicy: "clamp";
  resetSchedulePolicy: "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one";
}

/** Target-global fixed Burning window selected by the trusted tick channel. */
export interface ElementalApplicationReactionBurningFixedGcsimDecisionV148 extends ElementalApplicationReactionFixedGcsimDecisionV148Base {
  scope: "trusted-target-global-burning-projection";
  icdTag: Extract<
    GcsimReactionOwnedApplicationV1Binding,
    { sourceKind: "burning-tick" }
  >["sourceIcdTag"];
  groupId: "burning";
  windowStartGroupId: "burning";
}

/** Actor-tag fixed ReactionA window selected by a trusted Swirl channel. */
export interface ElementalApplicationReactionSwirlFixedGcsimDecisionV148 extends ElementalApplicationReactionFixedGcsimDecisionV148Base {
  scope: "actor-tag";
  icdTag: Extract<
    GcsimReactionOwnedApplicationV1Binding,
    { sourceKind: "swirl-propagation" }
  >["sourceIcdTag"];
  groupId: "reaction-a";
  windowStartGroupId: "reaction-a";
}

/** Closed union which preserves each trusted channel's scope/tag/group tuple. */
export type ElementalApplicationReactionFixedGcsimDecisionV148 =
  | ElementalApplicationReactionBurningFixedGcsimDecisionV148
  | ElementalApplicationReactionSwirlFixedGcsimDecisionV148;

interface ElementalApplicationReactionFixedGcsimDecisionV149Base extends Omit<
  ElementalApplicationReactionFixedGcsimDecisionV148Base,
  "policyId" | "resetSchedulePolicy"
> {
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID;
}

/** v2 Burning attempts are evaluated before the same-frame core reset. */
export interface ElementalApplicationReactionBurningFixedGcsimDecisionV149 extends ElementalApplicationReactionFixedGcsimDecisionV149Base {
  scope: "trusted-target-global-burning-projection";
  icdTag: Extract<
    GcsimReactionOwnedApplicationBinding,
    { sourceKind: "burning-tick" }
  >["sourceIcdTag"];
  groupId: "burning";
  windowStartGroupId: "burning";
  resetSchedulePolicy: "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one";
}

/** v2 Swirl retains reset-before-attempt at the exact boundary frame. */
export interface ElementalApplicationReactionSwirlFixedGcsimDecisionV149 extends ElementalApplicationReactionFixedGcsimDecisionV149Base {
  scope: "actor-tag";
  icdTag: Extract<
    GcsimReactionOwnedApplicationBinding,
    { sourceKind: "swirl-propagation" }
  >["sourceIcdTag"];
  groupId: "reaction-a";
  windowStartGroupId: "reaction-a";
  resetSchedulePolicy: "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one";
}

export type ElementalApplicationReactionFixedGcsimDecisionV149 =
  | ElementalApplicationReactionFixedGcsimDecisionV148
  | ElementalApplicationReactionBurningFixedGcsimDecisionV149
  | ElementalApplicationReactionSwirlFixedGcsimDecisionV149;

export type ElementalApplicationReactionBurningFixedGcsimDecision =
  | ElementalApplicationReactionBurningFixedGcsimDecisionV148
  | ElementalApplicationReactionBurningFixedGcsimDecisionV149;
export type ElementalApplicationReactionSwirlFixedGcsimDecision =
  | ElementalApplicationReactionSwirlFixedGcsimDecisionV148
  | ElementalApplicationReactionSwirlFixedGcsimDecisionV149;
export type ElementalApplicationReactionFixedGcsimDecision =
  ElementalApplicationReactionFixedGcsimDecisionV149;

/** Closed decision union for trusted 1.48 reaction-owned application rows. */
export type ReactionOwnedElementalApplicationIcdDecisionV148 =
  | ReactionOwnedElementalApplicationIcdSkippedDecisionV148
  | ElementalApplicationReactionFixedGcsimDecisionV148;

/** 1.49 admits exact v1 or v2 rows according to the persisted model. */
export type ReactionOwnedElementalApplicationIcdDecisionV149 =
  | ReactionOwnedElementalApplicationIcdSkippedDecisionV148
  | ElementalApplicationReactionFixedGcsimDecisionV149;

/** Exact direct/configured application decision union frozen at 1.47. */
export type ElementalApplicationIcdDecisionV147 =
  | ElementalApplicationIcdSkippedDecision
  | ElementalApplicationNoIcdDecision
  | ElementalApplicationLegacyProfileDecision
  | ElementalApplicationFixedGcsimDecision;

/** Current unified decision union, including trusted reaction channels. */
export type ElementalApplicationIcdDecision =
  | ElementalApplicationIcdDecisionV147
  | ElementalApplicationReactionFixedGcsimDecisionV149;

/**
 * One auditable decision for each target attempt of a configured direct-hit
 * elemental application. Reaction-owned applications are outside 1.47.
 */
export interface ElementalApplicationIcdLogEntryV147 {
  id: number;
  sourceKind: "configured-direct-hit";
  hitResolutionLogId: number;
  damageEventId: number | null;
  frame: number;
  sourceActorId: string;
  targetId: TargetId;
  hitId: string;
  hitGroupId: string;
  element: Exclude<Element, "physical">;
  selector: ElementalApplicationIcdSelector;
  nominalGaugeUnits: number;
  effectiveGaugeUnits: number;
  decision: ElementalApplicationIcdDecisionV147;
}

interface ReactionOwnedElementalApplicationIcdLogEntryV148Base {
  id: number;
  reactionDamageLogId: number;
  hitResolutionLogId: number;
  damageEventId: number | null;
  frame: number;
  eventPriority: number;
  eventSequence: number;
  /** Zero-based, contiguous order in the owning reaction delivery. */
  attemptIndex: number;
  attemptCount: number;
  deliveryPhase:
    "reaction-damage-event" | "before-reactable-tick" | "after-reactable-tick";
  sourceActorId: string;
  targetId: TargetId;
  hitId: string;
  hitGroupId: string;
  nominalGaugeUnits: number;
  effectiveGaugeUnits: number;
  decision: ReactionOwnedElementalApplicationIcdDecisionV148;
}

/** Trusted fixed Burning application target attempt. */
export interface BurningElementalApplicationIcdLogEntryV148 extends ReactionOwnedElementalApplicationIcdLogEntryV148Base {
  sourceKind: "burning-tick";
  selector: Extract<
    TrustedReactionElementalApplicationSelectorV1,
    { channel: { kind: "burning-tick" } }
  >;
  element: "pyro";
}

/** Trusted fixed Swirl propagation application target attempt. */
export interface SwirlPropagationElementalApplicationIcdLogEntryV148 extends ReactionOwnedElementalApplicationIcdLogEntryV148Base {
  sourceKind: "swirl-propagation";
  selector: Extract<
    TrustedReactionElementalApplicationSelectorV1,
    { channel: { kind: "swirl-propagation" } }
  >;
  element: GcsimSwirlPropagationElement;
}

export type ReactionOwnedElementalApplicationIcdLogEntryV148 =
  | BurningElementalApplicationIcdLogEntryV148
  | SwirlPropagationElementalApplicationIcdLogEntryV148;

interface ReactionOwnedElementalApplicationIcdLogEntryV149Base extends Omit<
  ReactionOwnedElementalApplicationIcdLogEntryV148Base,
  "decision"
> {
  decision: ReactionOwnedElementalApplicationIcdDecisionV149;
}

export interface BurningElementalApplicationIcdLogEntryV149 extends ReactionOwnedElementalApplicationIcdLogEntryV149Base {
  sourceKind: "burning-tick";
  selector: Extract<
    TrustedReactionElementalApplicationSelector,
    { channel: { kind: "burning-tick" } }
  >;
  element: "pyro";
}

export interface SwirlPropagationElementalApplicationIcdLogEntryV149 extends ReactionOwnedElementalApplicationIcdLogEntryV149Base {
  sourceKind: "swirl-propagation";
  selector: Extract<
    TrustedReactionElementalApplicationSelector,
    { channel: { kind: "swirl-propagation" } }
  >;
  element: GcsimSwirlPropagationElement;
}

export type ReactionOwnedElementalApplicationIcdLogEntryV149 =
  | BurningElementalApplicationIcdLogEntryV149
  | SwirlPropagationElementalApplicationIcdLogEntryV149;

/** Current unified application log; the 1.47 direct row remains unchanged. */
export type ElementalApplicationIcdLogEntryV148 =
  | ElementalApplicationIcdLogEntryV147
  | ReactionOwnedElementalApplicationIcdLogEntryV148;

export type ElementalApplicationIcdLogEntryV149 =
  | ElementalApplicationIcdLogEntryV147
  | ReactionOwnedElementalApplicationIcdLogEntryV149;

export type ElementalApplicationIcdLogEntry =
  ElementalApplicationIcdLogEntryV149;

/** Exact damage-event wire frozen at 1.47. */
export interface DamageEventV147 {
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

/** Current damage event with a reciprocal unified-application audit link. */
export interface DamageEventV148 extends DamageEventV147 {
  elementalApplicationIcdLogId: number | null;
}

export type DamageEvent = DamageEventV148;

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
    "INTERNAL_COOLDOWN" | "TARGET_MISS" | "TARGET_HIT_CONFIRM_BLOCKED" | null;
  internalCooldownKey: string | null;
  internalCooldownDurationFrames: number | null;
  internalCooldownReadyFrame: number | null;
}

/** Exact hit-resolution wire frozen at 1.47. */
export interface HitResolutionLogEntryV147 {
  id: number;
  frame: number;
  timeSeconds: number;
  /** Present when targetTaskModel.mode is target-phase-v1. */
  eventPriority?: number;
  /** Present when targetTaskModel.mode is target-phase-v1. */
  eventSequence?: number;
  /** Present when targetTaskModel.mode is target-phase-v1. */
  intraEventSequence?: number;
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

/** Current hit-resolution row with reciprocal reaction/application links. */
export interface HitResolutionLogEntryV148 extends HitResolutionLogEntryV147 {
  reactionDamageLogId: number | null;
  elementalApplicationIcdLogId: number | null;
}

export type HitResolutionLogEntry = HitResolutionLogEntryV148;

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
  "boundary" | "derived" | "observation" | "mutation";

export type TargetStateTimelineCause =
  | "simulation-start"
  | "simulation-end"
  | "aura-natural-expiry"
  | "target-reactable-tick-decay"
  | "direct-hit-shatter"
  | "direct-hit-application"
  | "quicken-bloom-followup"
  | "reaction-damage-application"
  | "reaction-damage-shatter"
  | "frozen-expiry"
  | "quicken-expiry"
  | "electro-charged-expiry"
  | "electro-charged-cleanup"
  | "electro-charged-tick"
  | "electro-charged-wane"
  | "electro-charged-propagation-candidate"
  | "burning-fuel-expiry"
  | "burning-tick"
  | "reaction-aura-attachment"
  | "target-mechanics-truncation";

export type TargetStateTimelineLink =
  | { kind: "damage-event"; id: number }
  | { kind: "reaction-task-log"; id: number }
  | { kind: "reaction-damage-log"; id: number }
  | { kind: "basic-reaction-scheduler-log"; id: number }
  | { kind: "periodic-reaction-log"; id: number }
  | { kind: "frozen-state-log"; id: number }
  | { kind: "quicken-state-log"; id: number }
  | { kind: "burning-state-log"; id: number }
  /**
   * target-phase-v2-only bridge from the post-Reactable timeline point back
   * to its owning complete target phase.
   */
  | { kind: "target-phase-log"; id: number }
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

export type SimulationEventTypeV150 = Exclude<
  SimulationEventType,
  "reactionAuraAttachment"
>;
export type TargetStateTimelineCauseV150 = Exclude<
  TargetStateTimelineCause,
  "reaction-aura-attachment"
>;
export type TargetStateTimelineLinkV150 = Exclude<
  TargetStateTimelineLink,
  { kind: "basic-reaction-scheduler-log" }
>;
export type TargetStateTimelinePointV150 = Omit<
  TargetStateTimelinePoint,
  "cause" | "eventType" | "links"
> & {
  cause: TargetStateTimelineCauseV150;
  eventType: SimulationEventTypeV150 | null;
  links: TargetStateTimelineLinkV150[];
};
export interface TargetStateTimelineV150 {
  version: "1.0.0";
  points: TargetStateTimelinePointV150[];
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
  reason: "UNSUPPORTED_DENDRO_REACTION" | "UNSUPPORTED_REACTION_ORDER";
}

/** Exact legacy ReactionA decision wire frozen through result schema 1.49. */
export interface ReactionADamageGroupAuditV149 {
  reaction: SwirlReaction | DendroCoreReaction | "shatter" | "superconduct";
  sourceActorId: string;
  targetId: TargetId;
  windowStartFrame: number;
  hitIndex: number;
  resetFrames: 30;
  sequence: readonly [true, true, false];
  damageAllowed: boolean;
  blockedReason: "REACTION_A_DAMAGE_ICD" | null;
}

/** Exact legacy ReactionB decision wire frozen through result schema 1.49. */
export interface ReactionBDamageGroupAuditV149 {
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

export type ReactionDamageGroupAuditV149 =
  | ReactionADamageGroupAuditV149
  | ReactionBDamageGroupAuditV149;

/** Compatibility aliases for frozen child/player projections. */
export type ReactionADamageGroupAudit =
  ReactionADamageGroupAuditV149;
export type ReactionBDamageGroupAudit =
  ReactionBDamageGroupAuditV149;
export type ReactionDamageGroupAudit =
  ReactionDamageGroupAuditV149;

type ReactionDamageGroupPolicyTaskAuditV150 =
  | {
      policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID;
      resetTaskLogId: null;
      resetTaskSequence: null;
    }
  | {
      policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID;
      resetTaskLogId: number;
      resetTaskSequence: number;
    };

interface ReactionDamageGroupDecisionAuditV150Common {
  profileId: typeof GCSIM_DAMAGE_GROUP_PROFILE_ID;
  icdTag: GcsimReactionDamageGroupBinding["icdTag"];
  sourceActorId: string;
  targetId: TargetId;
  /** Canonical JSON tuple [targetId, sourceActorId, icdTag]. */
  scopeKey: string;
  frame: number;
  /** Global event/task ordinal; V2 reset tasks share this same sequence. */
  damageGroupTaskSequence: number;
  windowGeneration: number;
  windowStartFrame: number;
  /** F30 for v1; scheduled F29 reset-task frame for v2. */
  resetAtFrame: number;
  hitIndex: number;
  sequenceIndex: number;
  sequenceMultiplier: 0 | 1;
  damageAllowed: boolean;
}

export type ReactionADamageGroupDecisionAuditV150 =
  ReactionDamageGroupDecisionAuditV150Common &
    ReactionDamageGroupPolicyTaskAuditV150 & {
      reaction: Exclude<
        GcsimReactionDamageGroupReaction,
        "overload" | "electroCharged"
      >;
      icdGroup: "reaction-a";
      blockedReason: "REACTION_A_DAMAGE_ICD" | null;
    };

export type ReactionBDamageGroupDecisionAuditV150 =
  ReactionDamageGroupDecisionAuditV150Common &
    ReactionDamageGroupPolicyTaskAuditV150 & {
      reaction: "overload" | "electroCharged";
      icdGroup: "reaction-b";
      blockedReason: "REACTION_B_DAMAGE_ICD" | null;
    };

/** Current policy/root-bound ReactionA/B decision wire. */
export type ReactionDamageGroupDecisionAuditV150 =
  | ReactionADamageGroupDecisionAuditV150
  | ReactionBDamageGroupDecisionAuditV150;

/** One scheduled v2 reset task and its eventual FIFO execution outcome. */
export interface ReactionDamageGroupResetLogEntryV150 {
  id: number;
  policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID;
  sourceActorId: string;
  targetId: TargetId;
  /** Canonical JSON tuple [targetId, sourceActorId, icdTag]. */
  scopeKey: string;
  reaction: GcsimReactionDamageGroupReaction;
  icdTag: GcsimReactionDamageGroupBinding["icdTag"];
  icdGroup: "reaction-a" | "reaction-b";
  windowGeneration: number;
  windowStartFrame: number;
  resetAtFrame: number;
  /** Shared priority-5 global event sequence allocated after the opener. */
  taskSequence: number;
  withinSimulation: boolean;
  executed: boolean;
  /** First same-frame attempt observed after this reset, when one exists. */
  executedBeforeAttemptTaskSequence: number | null;
  executionFrame: number | null;
  stale: boolean;
  invalidatedReason:
    | "WINDOW_GENERATION_MISMATCH"
    | "ALREADY_EXECUTED"
    | null;
}

export type ElectroChargedPropagationCandidateReason =
  | "SOURCE_STREAM_TARGET"
  | "NEARBY_WET_IN_RANGE"
  | "NO_HYDRO_AURA"
  | "OUT_OF_RANGE"
  | "POSITION_UNRESOLVED"
  | "SOURCE_POSITION_UNRESOLVED";

export interface ElectroChargedPropagationCandidateAudit {
  targetId: TargetId;
  targetName: string;
  targetOrder: number;
  hydroGaugeUnits: number;
  position: { x: number; y: number } | null;
  distance: number | null;
  threshold: number | null;
  selected: boolean;
  reason: ElectroChargedPropagationCandidateReason;
  auraObservationTimelinePointId: number;
  hitResolutionLogId: number | null;
  damageEventId: number | null;
}

export interface ElectroChargedPropagationAudit {
  model: "nearby-wet-radius-v1";
  verificationStatus: "provisional";
  mechanicsDataStatus: "community-provisional";
  generation: number;
  tickIndex: number;
  evaluationFrame: number;
  eventPriority: number;
  eventSequence: number;
  radius: number;
  selectionMode: "all-in-range-registration-order-v1";
  sourcePosition: { x: number; y: number } | null;
  candidates: ElectroChargedPropagationCandidateAudit[];
}

/** Exact queued reaction-damage audit wire frozen at 1.47. */
export interface ReactionDamageLogEntryV147 {
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
    | "nearest-target-radius"
    | "electro-charged-nearby-wet";
  /** Exact 1.41 audit for provisional EC nearby-Wet propagation. */
  electroChargedPropagation?: ElectroChargedPropagationAudit;
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
  damageGroupDecisions: ReactionDamageGroupAuditV149[];
}

/** Current reaction-damage audit with complete reciprocal target-attempt links. */
export interface ReactionDamageLogEntryV148 extends ReactionDamageLogEntryV147 {
  hitResolutionLogIds: number[];
  elementalApplicationIcdLogIds: number[];
}

/** Current 1.50 reaction-damage row with policy/root-bound decisions. */
export type ReactionDamageLogEntryV150 = Omit<
  ReactionDamageLogEntryV148,
  "damageGroupDecisions"
> & {
  damageGroupDecisions: ReactionDamageGroupDecisionAuditV150[];
};

export type ReactionDamageLogEntry = ReactionDamageLogEntryV150;

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
  clockModel: "global-frame-no-hitlag" | "global-frame-gadget-v1";
  hitlagStatus: "unsupported-enemy-hitlag" | "not-affected-by-enemy-hitlag";
  mechanicsDataStatus: "fixed-gcsim-provisional";
  selfDamageStatus: PlayerSelfDamageStatus;
}

export interface DendroCoreSpawnScheduledLogEntry extends DendroCoreLogBase {
  operation: "spawn-scheduled";
  /** Bloom can originate from a direct hit, propagation, or queued follow-up. */
  eventType: "hit" | "reactionDamage" | "quickenBloomFollowup";
  /** Present only when the Bloom audit is owned by reactionTaskLog. */
  reactionTaskLogId?: number;
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
  eventType: "dendroCoreExpiry" | "dendroCoreSpawn" | "hit" | "reactionDamage";
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
  eventType: "dendroCoreSpawn" | "dendroCoreExpiry" | "hit" | "reactionDamage";
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
  | "tick-skipped"
  | "wane"
  | "wane-skipped"
  | "stop";

export interface PeriodicReactionLogEntry {
  id: number;
  reaction: PeriodicTransformativeReaction;
  generation: number;
  operation: PeriodicReactionOperation;
  frame: number;
  /**
   * Present on target-phase-v2 Electro-Charged `stop` rows materialized by
   * Reactable.Tick, including aura-v8/v9 Quicken→Bloom cleanup. Damage ticks
   * and post-damage Wane rows remain global/core work and omit this field.
   */
  targetFrame?: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  sourceActorId: string | null;
  triggerDamageEventId: number | null;
  /**
   * Present only on an aura-v8/v9 Quicken→Bloom coexistence cleanup,
   * including natural-expiry and aura-v9 ended-before-deadline reuse.
   */
  reactionTaskLogId?: number;
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
  /** Aura-v9 global callback state; historical log wires omit it. */
  cadenceStatus?: "scheduled" | "dormant" | "stopped";
  /** Aura-v9 Wane listener state; historical log wires omit it. */
  waneListenerActive?: boolean;
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

export type FreezeBrokenAttackDepletionOperation = Extract<
  FrozenStateOperation,
  "consume" | "poise-consume" | "shatter-consume" | "expire"
>;

export type FreezeBrokenAttackReaction = Extract<
  ReactionType,
  "freeze" | "shatter" | "swirlCryo" | "crystallizeCryo"
>;

/**
 * Fixed reference AttackInfo projected by the 1.52 Freeze Broken audit.
 * The normalized local policy never dispatches this as a DamageEvent.
 */
export interface FreezeBrokenReferenceAttack {
  actorIndex: 0;
  resolvedActorId: string;
  damageSource: "receiving-target";
  damageSourceTargetId: TargetId;
  ability: "Freeze Broken";
  attackTag: "AttackTagNone";
  icdTag: "ICDTagNone";
  icdGroup: "ICDGroupDefault";
  strikeType: "StrikeTypeDefault";
  element: "NoElement";
  noImpulse: false;
  durability: 0;
  multiplier: 0;
  flatDamage: 0;
  snapshotDelayFrames: -1;
  damageDelayFrames: 0;
  targeting: "single-target";
  sourceIsSim: true;
  doNotLog: true;
}

/**
 * One normalized audit row for a pinned Freeze-depletion trigger source.
 * Both pinned reference phases are recorded, but neither creates a local
 * DamageEvent, HitResolution row, callback dispatch, or RNG draw.
 */
export interface FreezeBrokenAttackLogEntry {
  id: number;
  frame: number;
  targetFrame?: number;
  timeSeconds: number;
  targetId: TargetId;
  targetName: string;
  generation: number;
  sourceFrozenStateLogId: number;
  depletionOperation: FreezeBrokenAttackDepletionOperation;
  reaction: FreezeBrokenAttackReaction;
  reason: string | null;
  depletionDamageEventId: number | null;
  sourceFreezeDamageEventId: number | null;
  triggerEventType: SimulationEventType;
  triggerEventPriority: number;
  triggerEventSequence: number;
  intraEventSequence: number;
  frozenGaugeBefore: number;
  frozenGaugeAfter: 0;
  attack: FreezeBrokenReferenceAttack;
  syncPhase: {
    disposition: "reference-audit-only-not-dispatched";
    referencePhase: "same-call-stack-immediate";
    order: [
      "on-aura-durability-depleted-frozen",
      "on-apply-attack-freeze-broken",
      "on-enemy-hit-freeze-broken",
      "damage-log-freeze-broken",
    ];
  };
  endOfFramePhase: {
    disposition: "reference-audit-only-not-dispatched";
    referencePhase: "zero-delay-core-task";
    order: [
      "apply-zero-damage",
      "on-enemy-damage-freeze-broken-zero",
      "attack-callbacks-none-supplied",
    ];
    damage: 0;
    relativeToTriggerEnemyDamage: "before" | "not-applicable";
  };
  executionStatus: "reference-audit-only-not-dispatched";
  damageEventId: null;
  hitResolutionLogId: null;
}

export type FreezeBrokenAttackLog = FreezeBrokenAttackLogEntry[];

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
  clockModel: "target-local-no-hitlag" | "target-local-hitlag-v1";
  hitlagStatus: "unsupported-enemy-hitlag" | "modeled-enemy-hitlag";
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
  /**
   * target-phase-v2-only Aura snapshots taken immediately around the
   * target-local Burning callback. Legacy and target-phase-v1 omit them.
   * The existing auraBefore/auraApplied/auraConsumed/auraAfter fields remain
   * available for the later global elemental-application result.
   */
  callbackAuraBefore?: AuraStateEntry[];
  callbackAuraAfter?: AuraStateEntry[];
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
    false,
  ];
  applicationAllowed: boolean | null;
  applicationBlockedReason:
    "BURNING_APPLICATION_ICD" | "TARGET_AURA_BLOCKED" | null;
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

/** Exact player reaction self-damage factors frozen through result 1.49. */
export interface PlayerReactionSelfDamageFactorsV149 {
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
  damageGroupDecision: ReactionADamageGroupAuditV149 | null;
  /** Player incoming damage after resistance and damage-group gating. */
  finalDamage: number;
}

/** Current player reaction self-damage factors with a policy-bound decision. */
export interface PlayerReactionSelfDamageFactorsV150 extends Omit<
  PlayerReactionSelfDamageFactorsV149,
  "damageGroupDecision"
> {
  damageGroupDecision: ReactionADamageGroupDecisionAuditV150 | null;
}

export type PlayerReactionSelfDamageFactors =
  PlayerReactionSelfDamageFactorsV150;

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

/** Exact player damage event wire frozen through result 1.49. */
export interface PlayerDamageEventV149 {
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
  damageFactors: PlayerReactionSelfDamageFactorsV149;
  shieldResolution: PlayerCrystallizeShieldResolution;
  hpResolution: PlayerHpDamageResolution;
  /** Actual HP removed after shield absorption and zero-HP clamping. */
  finalDamage: number;
  displayDamage: number;
}

/** Current 1.50 player damage event with a policy-bound group decision. */
export interface PlayerDamageEventV150 extends Omit<
  PlayerDamageEventV149,
  "damageFactors"
> {
  damageFactors: PlayerReactionSelfDamageFactorsV150;
}

export type PlayerDamageEvent = PlayerDamageEventV150;

export type PlayerHpTimelineOperation = "initial" | "damage" | "simulation-end";

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
  "spawn" | "pickup-attempt" | "pickup" | "expire" | "evict";

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
  "add" | "overwrite" | "absorb" | "break" | "expire";

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

interface TargetTaskPhaseLogEntryBase {
  id: number;
  targetId: TargetId;
  targetName: string;
  globalFrame: number;
  timeSeconds: number;
  targetFrame: number;
  targetOrder: number;
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  auraBeforeTasks: AuraStateEntry[];
  auraAfterTasks: AuraStateEntry[];
  auraAfterDecay: AuraStateEntry[];
  burningStateLogIds: number[];
  hitResolutionLogIds: number[];
  reactionTaskLogIds: number[];
}

/**
 * One target-owned phase at a global-frame boundary. The discriminant records
 * whether the phase was woken by a target callback or by incoming work.
 */
export type TargetTaskPhaseLogEntry = TargetTaskPhaseLogEntryBase &
  (
    | {
        wakeKind: "burning-tick";
        eventType: "burningTick";
      }
    | {
        wakeKind: "incoming";
        eventType: "hit" | "reactionDamage";
      }
  );

/**
 * One Burning callback executed by the target-local task queue before the
 * target's Reactable.Tick boundary. Other lifecycle changes belong to
 * TargetLifecycleTransition instead of this task list.
 */
export interface TargetPhaseV2TargetTask {
  stage: "target-task";
  kind: "burning-tick";
  /** Zero-based, contiguous order within this target phase. */
  order: number;
  eventType: "burningTick";
  eventPriority: number;
  eventSequence: number;
  intraEventSequence: number;
  generation: number;
  tickIndex: number;
  /** Immutable target-local deadline owned by the queued callback. */
  deadlineTargetFrame: number;
  status: "applied" | "stale";
  burningStateLogId: number | null;
  targetStateTimelinePointId: number;
}

/**
 * An authoritative target-state mutation produced by Reactable.Tick after all
 * target-local callbacks for this target and global frame have run.
 */
export type TargetLifecycleTransition =
  | {
      stage: "reactable-tick";
      kind: "aura-natural-expiry";
      /** Zero-based, contiguous order within reactableTick.transitions. */
      order: number;
      deadlineTargetFrame: number;
      targetStateTimelinePointId: number;
    }
  | {
      stage: "reactable-tick";
      kind: "frozen-expiry";
      order: number;
      generation: number;
      deadlineTargetFrame: number;
      frozenStateLogId: number;
      targetStateTimelinePointId: number;
    }
  | {
      stage: "reactable-tick";
      kind: "quicken-expiry";
      order: number;
      generation: number;
      deadlineTargetFrame: number;
      quickenStateLogId: number;
      targetStateTimelinePointId: number;
    }
  | {
      stage: "reactable-tick";
      kind: "burning-fuel-expiry";
      order: number;
      generation: number;
      deadlineTargetFrame: number;
      burningStateLogId: number;
      /** Zero or one Quicken removal owned by the Fuel expiry boundary. */
      quickenStateLogIds: number[];
      targetStateTimelinePointId: number;
    }
  | {
      stage: "reactable-tick";
      kind: "electro-charged-expiry";
      order: number;
      generation: number;
      deadlineTargetFrame: number;
      periodicReactionLogId: number;
      targetStateTimelinePointId: number;
    }
  | ({
      stage: "reactable-tick";
      kind: "electro-charged-cleanup";
      order: number;
      deadlineTargetFrame: number;
      generation: number;
      reactionTaskLogId: number;
      targetStateTimelinePointId: number;
    } & (
      | {
          outcome: "stop" | "natural-expiry" | "ended-before-deadline";
          periodicReactionLogId: number;
        }
      | {
          outcome: "retain" | "superseded";
          periodicReactionLogId: null;
        }
    ));

/**
 * One complete target-local phase at a `(globalFrame, targetId)` boundary:
 * QueueEnemyTask callbacks run first, then Reactable.Tick lifecycle changes.
 * Incoming/core work is referenced separately and follows this boundary.
 */
export interface TargetPhaseV2LogEntry {
  model: "target-phase-v2";
  id: number;
  targetId: TargetId;
  targetName: string;
  globalFrame: number;
  timeSeconds: number;
  targetFrame: number;
  targetOrder: number;
  auraBeforeTargetTasks: AuraStateEntry[];
  targetTasks: TargetPhaseV2TargetTask[];
  auraAfterTargetTasks: AuraStateEntry[];
  reactableTick: {
    fromTargetFrame: number;
    toTargetFrame: number;
    auraBefore: AuraStateEntry[];
    transitions: TargetLifecycleTransition[];
    auraAfter: AuraStateEntry[];
  };
  hitResolutionLogIds: number[];
  reactionTaskLogIds: number[];
}

/**
 * One deterministic target application owned directly by a v3 Burning
 * callback delivery. Every landed application owns a damage event even when
 * its resolved damage is zero; misses and unresolved targets do not.
 */
interface TargetPhaseV3DeliveryAttemptBase {
  /** Zero-based, contiguous order within the callback delivery. */
  order: number;
  targetId: TargetId;
  targetOrder: number;
  applicationPhase: "before-reactable-tick" | "after-reactable-tick";
}

export type TargetPhaseV3DeliveryAttemptV147 =
  | (TargetPhaseV3DeliveryAttemptBase & {
      outcome: "landed";
      hitResolutionLogId: number;
      damageEventId: number;
      targetStateTimelinePointId: number;
    })
  | (TargetPhaseV3DeliveryAttemptBase & {
      outcome: "miss";
      hitResolutionLogId: number;
      damageEventId: null;
      targetStateTimelinePointId: null;
    })
  | (TargetPhaseV3DeliveryAttemptBase & {
      outcome: "unresolved";
      hitResolutionLogId: null;
      damageEventId: null;
      targetStateTimelinePointId: null;
    });

/**
 * Current inline Burning delivery attempt. Landed and missed target checks
 * both own unified application-log rows; unresolved candidates do not.
 */
export type TargetPhaseV3DeliveryAttemptV148 =
  | (TargetPhaseV3DeliveryAttemptBase & {
      outcome: "landed";
      hitResolutionLogId: number;
      damageEventId: number;
      elementalApplicationIcdLogId: number;
      targetStateTimelinePointId: number;
    })
  | (TargetPhaseV3DeliveryAttemptBase & {
      outcome: "miss";
      hitResolutionLogId: number;
      damageEventId: null;
      elementalApplicationIcdLogId: number;
      targetStateTimelinePointId: null;
    })
  | (TargetPhaseV3DeliveryAttemptBase & {
      outcome: "unresolved";
      hitResolutionLogId: null;
      damageEventId: null;
      elementalApplicationIcdLogId: null;
      targetStateTimelinePointId: null;
    });

export type TargetPhaseV3DeliveryAttempt = TargetPhaseV3DeliveryAttemptV148;

/**
 * Complete cross-target Burning application projection delivered inline by
 * one target-owned callback.
 */
export interface TargetPhaseV3DeliveryV147 {
  model: "burning-callback-zero-delay-v1";
  reactionDamageLogId: number;
  eventPriority: number;
  eventSequence: number;
  attempts: TargetPhaseV3DeliveryAttemptV147[];
}

export interface TargetPhaseV3DeliveryV148 extends Omit<
  TargetPhaseV3DeliveryV147,
  "attempts"
> {
  attempts: TargetPhaseV3DeliveryAttemptV148[];
}

export type TargetPhaseV3Delivery = TargetPhaseV3DeliveryV148;

/**
 * v3 preserves the v2 callback task wire and adds optional inline delivery.
 * Cross-log integrity determines whether the referenced Burning operation was
 * a real tick (delivery required) or a skipped/stopped/stale callback
 * (delivery forbidden).
 */
export type TargetPhaseV3TargetTaskV147 = TargetPhaseV2TargetTask & {
  delivery: TargetPhaseV3DeliveryV147 | null;
};

export type TargetPhaseV3TargetTaskV148 = TargetPhaseV2TargetTask & {
  delivery: TargetPhaseV3DeliveryV148 | null;
};

export type TargetPhaseV3TargetTask = TargetPhaseV3TargetTaskV148;

/**
 * v3 retains the v2 QueueEnemyTask then Reactable.Tick boundary while making
 * a Burning callback's cross-target application delivery explicit and inline.
 */
export interface TargetPhaseV3LogEntryV147 extends Omit<
  TargetPhaseV2LogEntry,
  "model" | "targetTasks"
> {
  model: "target-phase-v3";
  targetTasks: TargetPhaseV3TargetTaskV147[];
}

export interface TargetPhaseV3LogEntryV148 extends Omit<
  TargetPhaseV2LogEntry,
  "model" | "targetTasks"
> {
  model: "target-phase-v3";
  targetTasks: TargetPhaseV3TargetTaskV148[];
}

export type TargetPhaseV3LogEntry = TargetPhaseV3LogEntryV148;

export interface SimulationResult {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  engineVersion: typeof CURRENT_ENGINE_VERSION;
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
  damageEvents: DamageEventV148[];
  hitEvents: DamageEventV148[];
  /** Ordinary direct-damage sequence and hit-callback decisions. */
  directDamageGroupLog: DirectDamageGroupLogEntry[];
  /** Numeric elemental-application ICD decisions for configured target attempts. */
  elementalApplicationIcdLog: ElementalApplicationIcdLogEntryV149[];
  /** Every scheduled target check, including misses that did no damage. */
  hitResolutionLog: HitResolutionLogEntryV148[];
  /** Versioned target-clock mode and per-target final state. */
  targetClockAudit: TargetClockAudit;
  /** Compact, replayable target-clock transitions. */
  targetClockLog: TargetClockLogEntry[];
  /** Every configured target Hitlag check, including blocked rows. */
  targetHitlagLog: TargetHitlagLogEntry[];
  /** Replayable target-owned task and Aura-decay phase boundaries. */
  targetTaskPhaseLog: TargetTaskPhaseLogEntry[];
  /** Target-local QueueEnemyTask then Reactable.Tick boundaries for v2/v3. */
  targetPhaseLog: Array<TargetPhaseV2LogEntry | TargetPhaseV3LogEntryV148>;
  /** One first-crossing entry per target; later hits carry the audit in-place. */
  targetMechanicsTruncationLog: TargetMechanicsTruncationLogEntry[];
  /** Transformative reaction scheduling, GCD, spatial fanout, and damage links. */
  reactionDamageLog: ReactionDamageLogEntryV150[];
  /** Scheduled ReactionA/B reset tasks and their FIFO execution outcomes. */
  reactionDamageGroupResetLog: ReactionDamageGroupResetLogEntryV150[];
  /** Swirl attack resolution and deferred Aura-attachment scheduler audit. */
  basicReactionSchedulerLog: BasicReactionSchedulerLog;
  /** Reference-only Freeze Broken attack/callback audit; never damage output. */
  freezeBrokenAttackLog: FreezeBrokenAttackLog;
  /** Deferred live-Aura reaction operations in execution order. */
  reactionTaskLog: ReactionTaskLogEntry[];
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

type VersionedSimulationResultIdentityFields =
  | "schemaVersion"
  | "engineVersion"
  | "config"
  | "runManifest"
  | "directDamageGroupLog"
  | "elementalApplicationIcdLog"
  | "damageEvents"
  | "hitEvents"
  | "hitResolutionLog"
  | "reactionDamageLog"
  | "reactionDamageGroupResetLog"
  | "basicReactionSchedulerLog"
  | "freezeBrokenAttackLog"
  | "targetStateTimeline"
  | "playerDamageEvents"
  | "targetPhaseLog";

type FrozenV147NestedResultLogs = {
  damageEvents: DamageEventV147[];
  hitEvents: DamageEventV147[];
  hitResolutionLog: HitResolutionLogEntryV147[];
  reactionDamageLog: ReactionDamageLogEntryV147[];
  playerDamageEvents: PlayerDamageEventV149[];
  targetPhaseLog: Array<TargetPhaseV2LogEntry | TargetPhaseV3LogEntryV147>;
  targetStateTimeline: TargetStateTimelineV150;
};

type FrozenV148NestedResultLogs = {
  damageEvents: DamageEventV148[];
  hitEvents: DamageEventV148[];
  hitResolutionLog: HitResolutionLogEntryV148[];
  reactionDamageLog: ReactionDamageLogEntryV148[];
  playerDamageEvents: PlayerDamageEventV149[];
  targetPhaseLog: Array<TargetPhaseV2LogEntry | TargetPhaseV3LogEntryV148>;
  targetStateTimeline: TargetStateTimelineV150;
};

/**
 * Frozen 1.42 top-level result identity. Shared nested wires are projected to
 * the last pre-unified 1.47 shapes; exact frozen Zod schemas remain runtime
 * authority for fields introduced after each historical boundary.
 */
export type SimulationResultForV142 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION;
  engineVersion: typeof EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION;
  config: SimConfigV142;
  runManifest: SimulationRunManifestV142;
} & FrozenV147NestedResultLogs;

/** Frozen 1.44 top-level result identity. */
export type SimulationResultForV144 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
  engineVersion: typeof BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
  config: SimConfigV144;
  runManifest: SimulationRunManifestV144;
} & FrozenV147NestedResultLogs;

/** Frozen 1.45 top-level result identity. */
export type SimulationResultForV145 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof REACTION_FORMULA_ROOT_SCHEMA_VERSION;
  engineVersion: typeof REACTION_FORMULA_ROOT_ENGINE_VERSION;
  config: SimConfigV145;
  runManifest: SimulationRunManifestV145;
} & FrozenV147NestedResultLogs;

/** Frozen 1.46 result identity and direct-damage-group audit. */
export type SimulationResultForV146 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION;
  engineVersion: typeof DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;
  config: SimConfigV146;
  runManifest: SimulationRunManifestV146;
  directDamageGroupLog: DirectDamageGroupLogEntry[];
} & FrozenV147NestedResultLogs;

/** Frozen 1.47 result identity and direct-only application audit. */
export type SimulationResultForV147 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION;
  engineVersion: typeof ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION;
  config: SimConfigV147;
  runManifest: SimulationRunManifestV147;
  directDamageGroupLog: DirectDamageGroupLogEntry[];
  elementalApplicationIcdLog: ElementalApplicationIcdLogEntryV147[];
} & FrozenV147NestedResultLogs;

/** Frozen 1.48 result identity and unified reaction-owned application audit. */
export type SimulationResultForV148 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION;
  engineVersion: typeof REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION;
  config: SimConfigV148;
  runManifest: SimulationRunManifestV148;
  directDamageGroupLog: DirectDamageGroupLogEntry[];
  elementalApplicationIcdLog: ElementalApplicationIcdLogEntryV148[];
} & FrozenV148NestedResultLogs;

/** Frozen 1.49 result identity and explicit application reset policy audit. */
export type SimulationResultForV149 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION;
  engineVersion: typeof REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION;
  config: SimConfigV149;
  runManifest: SimulationRunManifestV149;
  directDamageGroupLog: DirectDamageGroupLogEntry[];
  elementalApplicationIcdLog: ElementalApplicationIcdLogEntryV149[];
} & FrozenV148NestedResultLogs;

/** Frozen 1.50 result identity and reaction damage-group policy audit. */
export type SimulationResultForV150 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION;
  engineVersion: typeof REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION;
  config: SimConfigV150;
  runManifest: SimulationRunManifestV150;
  directDamageGroupLog: DirectDamageGroupLogEntry[];
  elementalApplicationIcdLog: ElementalApplicationIcdLogEntryV149[];
  damageEvents: DamageEventV148[];
  hitEvents: DamageEventV148[];
  hitResolutionLog: HitResolutionLogEntryV148[];
  reactionDamageLog: ReactionDamageLogEntryV150[];
  reactionDamageGroupResetLog: ReactionDamageGroupResetLogEntryV150[];
  targetStateTimeline: TargetStateTimelineV150;
  playerDamageEvents: PlayerDamageEventV150[];
  targetPhaseLog: Array<TargetPhaseV2LogEntry | TargetPhaseV3LogEntryV148>;
};

/** Frozen 1.51 result identity and basic-reaction scheduler audit. */
export type SimulationResultForV151 = Omit<
  SimulationResult,
  VersionedSimulationResultIdentityFields
> & {
  schemaVersion: typeof BASIC_REACTION_SCHEDULER_SCHEMA_VERSION;
  engineVersion: typeof BASIC_REACTION_SCHEDULER_ENGINE_VERSION;
  config: SimConfigV151;
  runManifest: SimulationRunManifestV151;
  directDamageGroupLog: DirectDamageGroupLogEntry[];
  elementalApplicationIcdLog: ElementalApplicationIcdLogEntryV149[];
  damageEvents: DamageEventV148[];
  hitEvents: DamageEventV148[];
  hitResolutionLog: HitResolutionLogEntryV148[];
  reactionDamageLog: ReactionDamageLogEntryV150[];
  reactionDamageGroupResetLog: ReactionDamageGroupResetLogEntryV150[];
  basicReactionSchedulerLog: BasicReactionSchedulerLog;
  targetStateTimeline: TargetStateTimeline;
  playerDamageEvents: PlayerDamageEventV150[];
  targetPhaseLog: Array<TargetPhaseV2LogEntry | TargetPhaseV3LogEntryV148>;
};

/** Current 1.52 result identity and Freeze Broken reference audit. */
export type SimulationResultForV152 = SimulationResult;

export type VersionedSimulationResult =
  | SimulationResultForV142
  | SimulationResultForV144
  | SimulationResultForV145
  | SimulationResultForV146
  | SimulationResultForV147
  | SimulationResultForV148
  | SimulationResultForV149
  | SimulationResultForV150
  | SimulationResultForV151
  | SimulationResultForV152;
