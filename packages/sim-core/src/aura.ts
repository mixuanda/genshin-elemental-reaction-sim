import type {
  AdditiveReactionAudit,
  AmplifyingReaction,
  AuraElement,
  AuraReactionEngineConfig,
  AuraSourceGaugeMutation,
  AuraStateElement,
  AuraStateEntry,
  BloomReactionAudit,
  BurningReactionAudit,
  CatalyzeReactionAudit,
  CrystallizeReaction,
  CrystallizeReactionAudit,
  Element,
  ElementalApplication,
  IcdProfile,
  OneShotTransformativeReaction,
  PersistentAuraElement,
  QuickenDecayEndCause,
  QuickenDecayMutationAudit,
  QuickenReactionAudit,
  ReactionTaskBlockedReason,
  ReactionType,
  ReactionAudit,
  ShatterReactionAudit,
  StrikeType,
  SwirlReaction,
  SwirlReactionAudit,
  TargetMechanicsTruncationAudit,
  TransformativeReaction
} from "@genshin-dps-lab/schemas";
import { resolveBloomGauge } from "./bloom-gauge";
import {
  TargetLocalClock,
  type TargetHitlagAudit,
  type TargetHitlagInput,
  type TargetLocalClockState
} from "./target-clock";

const AURA_EPSILON = 1e-10;
const NORMAL_AURA_RATIO = 0.8;
const NORMAL_AURA_BASE_DURATION_FRAMES = 420;
/** Historical aura-v1/v2 coefficient retained for exact config replay. */
const NORMAL_AURA_DURATION_PER_UNIT_FRAMES = 6;
/** Fixed gcsim uses 25 internal durability per 1U: 6 × 25 = 150f/U. */
const AURA_V3_NORMAL_DURATION_PER_UNIT_FRAMES = 150;
const QUICKEN_BASE_DURATION_FRAMES = 360;
/** Fixed gcsim Quicken duration is 12 × 25 = 300f per generated U. */
const QUICKEN_DURATION_PER_UNIT_FRAMES = 300;
const DEFAULT_ICD_RESET_FRAMES = 150;
/**
 * Fixed-gcsim-provisional reference sequence:
 * pkg/core/attacks/icd_groups.dm.go at b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541.
 * pkg/target/icd.go clamps reads beyond this 24-slot table to its final slot.
 */
const DEFAULT_ICD_SEQUENCE = [
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  false,
  false,
  true,
  false,
  false
] as const;
const OVERLOAD_DAMAGE_GCD_FRAMES = 6;
const OVERLOAD_DAMAGE_DELAY_FRAMES = 1;
const OVERLOAD_DAMAGE_RADIUS = 3;
const OVERLOAD_BASE_MULTIPLIER = 2.75;
const SUPERCONDUCT_DAMAGE_GCD_FRAMES = 6;
const SUPERCONDUCT_DAMAGE_DELAY_FRAMES = 1;
const SUPERCONDUCT_DAMAGE_RADIUS = 3;
const SUPERCONDUCT_BASE_MULTIPLIER = 1.5;
const SUPERCONDUCT_PHYSICAL_RES_SHRED = 0.4;
const SUPERCONDUCT_STATUS_DURATION_FRAMES = 720;
const ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES = 10;
const ELECTRO_CHARGED_TICK_INTERVAL_FRAMES = 60;
const ELECTRO_CHARGED_WANE_DELAY_FRAMES = 6;
const ELECTRO_CHARGED_WANE_GAUGE_UNITS = 0.4;
const ELECTRO_CHARGED_BASE_MULTIPLIER = 2;
const FROZEN_BASE_DECAY_PER_FRAME = 0.4 / 60;
const FROZEN_DECAY_ACCELERATION_PER_FRAME = 0.1 / (60 * 60);
const FROZEN_POISE_DAMAGE_TO_GAUGE_UNITS = 0.15 / 25;
const SHATTER_GAUGE_CONSUMPTION_UNITS = 200 / 25;
const SHATTER_DAMAGE_GCD_FRAMES = 12;
const SHATTER_BASE_MULTIPLIER = 3;
const SWIRL_AURA_CONSUMPTION_FACTOR = 0.5;
const SWIRL_QUEUE_GCD_FRAMES = 6;
const SWIRL_SELF_DAMAGE_DELAY_FRAMES = 1;
const SWIRL_PROPAGATION_DELAY_FRAMES = 5;
const SWIRL_RADIUS = 5;
const SWIRL_BASE_MULTIPLIER = 0.6;
const CRYSTALLIZE_AURA_CONSUMPTION_FACTOR = 0.5;
const CRYSTALLIZE_QUEUE_GCD_FRAMES = 60;
const CRYSTALLIZE_SHARD_SPAWN_DELAY_FRAMES = 23;
const CRYSTALLIZE_EARLIEST_PICKUP_DELAY_FRAMES = 54;
const CRYSTALLIZE_SHARD_DURATION_FRAMES = 15 * 60;
const CRYSTALLIZE_MAX_ACTIVE_SHARDS = 3;
const BURNING_MARKER_GAUGE_UNITS = 2;
const BURNING_FUEL_INCOMING_DENDRO_RATIO = 0.8;
const BURNING_FUEL_MIN_DECAY_PER_FRAME = 0.4 / 60;
const BURNING_TICK_INTERVAL_FRAMES = 15;
const BURNING_SKIPPED_TICK_INDEX = 9;
const BURNING_BASE_MULTIPLIER = 0.25;
const BURNING_RADIUS = 1;
const BURNING_APPLICATION_GAUGE_UNITS = 1;
const BLOOM_CORE_SPAWN_DELAY_FRAMES = 30;
const BURNING_ICD_RESET_FRAMES = 120;
const BURNING_ICD_SEQUENCE = [
  true,
  false,
  false,
  false,
  false,
  false,
  false,
  false
] as const;
const BUILT_IN_DEFAULT_ICD_PROFILE: IcdProfile = {
  resetFrames: DEFAULT_ICD_RESET_FRAMES,
  applicationSequence: [...DEFAULT_ICD_SEQUENCE],
  tailPolicy: "clamp"
};
const BUILT_IN_BURNING_ICD_PROFILE: IcdProfile = {
  resetFrames: BURNING_ICD_RESET_FRAMES,
  applicationSequence: [...BURNING_ICD_SEQUENCE],
  tailPolicy: "clamp"
};

interface MutableAura {
  element: AuraStateElement;
  gaugeUnits: number;
  decayPerFrame: number;
  /** aura-v3 only: source ownership slots sharing one modifier decay rate. */
  sourceSlots?: Map<string, number>;
}

interface IcdState {
  windowStartFrame: number;
  hitCount: number;
}

interface BurningStateCapture {
  generation: number;
  damageSourceActorId: string;
  fuelSourceActorId: string | null;
  burningGaugeUnits: number;
  fuelGaugeUnits: number;
  fuelDecayPerFrame: number;
  fuelExpiresAtFrame: number | null;
}

interface QuickenDecayStateCapture {
  generation: number;
  gaugeUnits: number;
  decayPerFrame: number;
  expiresAtFrame: number | null;
  endCause: QuickenDecayEndCause;
  auraEntry: AuraStateEntry | null;
}

type ReactableLifecycleBoundaryKind =
  | "frozen"
  | "quicken"
  | "burningFuel"
  | "electroCharged";

interface ReactableTickCapture {
  frame: number;
  auraBefore: AuraStateEntry[];
  frozen:
    | {
        generation: number;
      }
    | null;
  quicken: QuickenDecayStateCapture | null;
  burningFuel:
    | {
        state: BurningStateCapture;
      }
    | null;
  electroCharged:
    | {
        generation: number;
      }
    | null;
}

type ReactableLifecycleBoundary =
  | {
      kind: "frozen";
      result: FrozenStateResult;
    }
  | {
      kind: "quicken";
      result: QuickenExpiryResult;
    }
  | {
      kind: "burningFuel";
      result: BurningFuelExpiryResult;
    }
  | {
      kind: "electroCharged";
      result: ElectroChargedStateResult;
    };

interface ReactionRule {
  auraElement: AuraElement;
  reaction: ReactionType;
  consumptionFactor: number;
}

const TRANSFORMATIVE_REACTION_DEFINITIONS = {
  overload: {
    damageElement: "pyro",
    damageGcdFrames: OVERLOAD_DAMAGE_GCD_FRAMES,
    damageDelayFrames: OVERLOAD_DAMAGE_DELAY_FRAMES,
    radius: OVERLOAD_DAMAGE_RADIUS,
    baseMultiplier: OVERLOAD_BASE_MULTIPLIER,
    statusEffect: null
  },
  superconduct: {
    damageElement: "cryo",
    damageGcdFrames: SUPERCONDUCT_DAMAGE_GCD_FRAMES,
    damageDelayFrames: SUPERCONDUCT_DAMAGE_DELAY_FRAMES,
    radius: SUPERCONDUCT_DAMAGE_RADIUS,
    baseMultiplier: SUPERCONDUCT_BASE_MULTIPLIER,
    statusEffect: {
      key: "superconduct-phys-shred",
      label: "超导物理抗性降低",
      element: "physical",
      resShred: SUPERCONDUCT_PHYSICAL_RES_SHRED,
      durationFrames: SUPERCONDUCT_STATUS_DURATION_FRAMES
    }
  }
} as const satisfies Record<
  OneShotTransformativeReaction,
  {
    damageElement: Element;
    damageGcdFrames: number;
    damageDelayFrames: number;
    radius: number;
    baseMultiplier: number;
    statusEffect: {
      key: string;
      label: string;
      element: Element | "all";
      resShred: number;
      durationFrames: number;
    } | null;
  }
>;

function isOneShotTransformativeReaction(
  reaction: ReactionType
): reaction is OneShotTransformativeReaction {
  return reaction === "overload" || reaction === "superconduct";
}

function isTransformativeReaction(
  reaction: ReactionType
): reaction is TransformativeReaction {
  return (
    isOneShotTransformativeReaction(reaction) ||
    reaction === "electroCharged" ||
    reaction === "shatter" ||
    reaction === "swirlPyro" ||
    reaction === "swirlHydro" ||
    reaction === "swirlCryo" ||
    reaction === "swirlElectro" ||
    reaction === "burning"
  );
}

function requiresAuraV2(reaction: ReactionType): boolean {
  return isTransformativeReaction(reaction) || reaction === "freeze";
}

export interface ElectroChargedStateResult {
  generation: number;
  operation: "tick" | "wane" | "wane-skipped" | "stop" | "stale";
  frame: number;
  auraBefore: AuraStateEntry[];
  auraConsumed: NonNullable<ReactionAudit["auraConsumed"]>;
  auraAfter: AuraStateEntry[];
  nextTickFrame: number | null;
  coexistenceExpiresAtFrame: number | null;
  reason: string | null;
}

export interface FrozenStateResult {
  generation: number;
  operation: "expire" | "stale";
  frame: number;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  expiresAtFrame: number | null;
  reason: string;
}

export type BurningStopReason =
  | "FUEL_EXPIRED"
  | "BURNING_AURA_CONSUMED"
  | "TARGET_MECHANICS_TRUNCATION";

export interface BurningTickResult {
  generation: number;
  tickIndex: number;
  operation: "tick" | "tick-skipped" | "stop" | "stale";
  frame: number;
  damageSourceActorId: string | null;
  fuelSourceActorId: string | null;
  burningGaugeUnitsBefore: number;
  burningGaugeUnitsAfter: number;
  fuelGaugeUnitsBefore: number;
  fuelGaugeUnitsAfter: number;
  fuelDecayPerFrame: number;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  nextTickFrame: number | null;
  fuelExpiresAtFrame: number | null;
  selfDamageStatus: "unsupported-player-damage-model";
  skipReason: "COUNTER_9_SKIP" | null;
  reason:
    | BurningStopReason
    | "SUPERSEDED_STREAM"
    | "UNEXPECTED_TICK_FRAME"
    | "UNEXPECTED_TICK_INDEX"
    | null;
}

export interface BurningFuelExpiryResult {
  generation: number;
  operation: "expire" | "stale";
  frame: number;
  damageSourceActorId: string | null;
  fuelSourceActorId: string | null;
  burningGaugeUnitsBefore: number;
  burningGaugeUnitsAfter: number;
  fuelGaugeUnitsBefore: number;
  fuelGaugeUnitsAfter: number;
  fuelDecayPerFrame: number;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  nextTickFrame: number | null;
  fuelExpiresAtFrame: number | null;
  quickenStateMutation: QuickenDecayMutationAudit;
  selfDamageStatus: "unsupported-player-damage-model";
  reason:
    | "FUEL_EXPIRED"
    | "STALE_BURNING_FUEL_EXPIRY_CHECK"
    | "BURNING_REFRESHED_BEFORE_EXPIRY";
}

export interface BurningApplicationIcdDecision {
  windowStartFrame: number;
  /** Zero-based hit count inside the current window; it may exceed the fixed sequence length. */
  hitIndex: number;
  allowed: boolean;
}

export interface ShatterFrozenMutation {
  operation: "poise-consume" | "shatter-consume";
  consumedGaugeUnits: number;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  reason: string;
}

export interface ShatterStateResult {
  audit: ShatterReactionAudit;
  mutations: ShatterFrozenMutation[];
}

export interface AuraEngineConfig extends AuraReactionEngineConfig {
  freezeResistance?: number;
  /**
   * Opt-in Reactable.Tick lifecycle cache. The default preserves the frozen
   * observer/event-heap behavior; target-phase-v2 enables order-independent
   * lifecycle materialization after one shared target Tick.
   */
  reactableTickModel?:
    | "legacy-observer-v1"
    | "cached-boundary-v2";
  /**
   * Optional simulator-owned target clock. Historical/disabled runs omit it
   * and retain the frozen pre-1.33 global-frame behavior byte-for-byte.
   */
  targetClock?: TargetLocalClock;
}

export type ElectroChargedCleanupOutcome =
  "armed" | "stopped" | "retained" | "superseded" | "natural-expiry";

export type ElectroChargedCleanupReason =
  | "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO"
  | "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM"
  | "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK"
  | "ELECTRO_CHARGED_GENERATION_SUPERSEDED"
  | "AURA_DECAY_EXPIRED_BEFORE_CLEANUP";

/**
 * Auditable aura-v8 bridge between a zero-delay Quicken→Bloom task and the
 * following effective target Reactable.Tick. Damage-event cancellation stays
 * simulator-owned; this result only reports the authoritative Aura/EC state
 * boundary.
 */
export interface ElectroChargedCleanupResult {
  model: "quicken-bloom-target-tick-v1";
  generation: number;
  armedAtFrame: number;
  armedAtTargetFrame: number;
  deadlineTargetFrame: number;
  resolvedAtFrame: number | null;
  resolvedAtTargetFrame: number | null;
  outcome: ElectroChargedCleanupOutcome;
  reason: ElectroChargedCleanupReason;
  originReactionTaskId: number | null;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  nextTickFrame: number | null;
}

interface PendingElectroChargedCleanup {
  generation: number;
  armedAtFrame: number;
  armedAtTargetFrame: number;
  deadlineTargetFrame: number;
  originReactionTaskId: number | null;
}

export interface QuickenLifecycleState {
  generation: number;
  gaugeUnits: number;
  decayPerFrame: number;
  expiresAtFrame: number | null;
  endCause: QuickenDecayEndCause;
}

export interface QuickenExpiryResult {
  generation: number;
  operation: "expire" | "stale";
  frame: number;
  quickenGaugeUnitsBefore: number;
  quickenGaugeUnitsAfter: number;
  decayPerFrameBefore: number;
  decayPerFrameAfter: number;
  expiresAtFrameBefore: number | null;
  expiresAtFrame: number | null;
  endCauseBefore: QuickenDecayEndCause;
  endCauseAfter: QuickenDecayEndCause;
  auraBefore: AuraStateEntry[];
  auraAfter: AuraStateEntry[];
  reason: string;
}

export interface AuraHitInput {
  frame: number;
  sourceActorId: string;
  element: Element;
  application?: ElementalApplication;
  reactionOverride?: AmplifyingReaction;
}

export interface QuickenBloomFollowupInput {
  frame: number;
  sourceActorId: string;
  triggerElement: "dendro" | "electro";
  /** Optional simulator reaction-task log id retained by aura-v8 cleanup. */
  originReactionTaskId?: number | null;
}

export interface QuickenBloomFollowupResult {
  status: "triggered" | "skipped";
  blockedReason: ReactionTaskBlockedReason | null;
  auraBefore: AuraStateEntry[];
  auraConsumed: NonNullable<ReactionAudit["auraConsumed"]>;
  auraAfter: AuraStateEntry[];
  bloomReaction: BloomReactionAudit | null;
}

const REACTION_RULES: Record<AuraElement, readonly ReactionRule[]> = {
  // Fixed gcsim reference order for incoming Pyro: Overload, Vaporize, Melt.
  pyro: [
    {
      auraElement: "electro",
      reaction: "overload",
      consumptionFactor: 1
    },
    {
      auraElement: "hydro",
      reaction: "reverseVaporize",
      consumptionFactor: 0.5
    },
    {
      auraElement: "cryo",
      reaction: "melt",
      consumptionFactor: 2
    }
  ],
  cryo: [
    {
      auraElement: "electro",
      reaction: "superconduct",
      consumptionFactor: 1
    },
    {
      auraElement: "pyro",
      reaction: "reverseMelt",
      consumptionFactor: 0.5
    },
    {
      auraElement: "hydro",
      reaction: "freeze",
      consumptionFactor: 1
    }
  ],
  hydro: [
    {
      auraElement: "pyro",
      reaction: "vaporize",
      consumptionFactor: 2
    },
    {
      auraElement: "cryo",
      reaction: "freeze",
      consumptionFactor: 1
    },
    {
      auraElement: "electro",
      reaction: "electroCharged",
      consumptionFactor: 0
    }
  ],
  electro: [
    {
      auraElement: "pyro",
      reaction: "overload",
      consumptionFactor: 1
    },
    {
      auraElement: "hydro",
      reaction: "electroCharged",
      consumptionFactor: 0
    },
    {
      auraElement: "cryo",
      reaction: "superconduct",
      consumptionFactor: 1
    }
  ]
};

function isAuraApplicationElement(
  element: Element,
  mode: AuraReactionEngineConfig["mode"]
): element is PersistentAuraElement | "anemo" | "geo" {
  return (
    element === "pyro" ||
    element === "cryo" ||
    element === "hydro" ||
    (mode !== "aura-v1" &&
      (element === "electro" ||
        element === "anemo" ||
        element === "geo")) ||
    ((mode === "aura-v3" ||
      mode === "aura-v4" ||
      mode === "aura-v5" ||
      mode === "aura-v6" ||
      mode === "aura-v7" ||
      mode === "aura-v8") &&
      element === "dendro")
  );
}

function usesAuraV3Durability(
  mode: AuraReactionEngineConfig["mode"]
): boolean {
  return (
    mode === "aura-v3" ||
    mode === "aura-v4" ||
    mode === "aura-v5" ||
    mode === "aura-v6" ||
    mode === "aura-v7" ||
    mode === "aura-v8"
  );
}

function usesBurningModel(
  mode: AuraReactionEngineConfig["mode"]
): boolean {
  return (
    mode === "aura-v4" ||
    mode === "aura-v5" ||
    mode === "aura-v6" ||
    mode === "aura-v7" ||
    mode === "aura-v8"
  );
}

function usesBloomModel(mode: AuraReactionEngineConfig["mode"]): boolean {
  return (
    mode === "aura-v5" ||
    mode === "aura-v6" ||
    mode === "aura-v7" ||
    mode === "aura-v8"
  );
}

function usesQueuedQuickenBloomFollowup(
  mode: AuraReactionEngineConfig["mode"]
): boolean {
  return mode === "aura-v7" || mode === "aura-v8";
}

/**
 * Locale-independent UTF-16 code-unit ordering for canonical Aura output.
 * `localeCompare` is intentionally avoided because its collation can vary
 * with the host ICU data and process locale, breaking reproducible hashes.
 */
function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cleanGaugeUnits(value: number): number {
  if (Math.abs(value) <= AURA_EPSILON) return 0;
  return Number(value.toFixed(12));
}

function remainingDecayFrames(
  gaugeUnits: number,
  decayPerFrame: number
): number {
  return Math.max(
    0,
    Math.ceil(gaugeUnits / decayPerFrame - 1e-9)
  );
}

/**
 * Minimal deterministic Aura/ICD engine for Milestone 3.
 *
 * aura-v1 preserves normal Pyro/Cryo/Hydro aura and amplifying Melt/Vaporize.
 * aura-v2 additionally models normal Electro aura plus Overload and
 * Superconduct scheduling, Hydro/Electro coexistence, and Electro-Charged
 * periodic streams.
 * aura-v3 corrects the durability-to-U lifetime conversion, adds per-source
 * normal/Quicken slots, and implements Dendro, Quicken, Aggravate, and Spread.
 * aura-v4 adds fixed-reference Burning marker/Fuel decay, snapshot ownership,
 * tick cadence, and Burning-application ICD.
 * aura-v5 additionally resolves fixed-reference Bloom gauge ordering and emits
 * one auditable core-spawn request per direct or Quicken-follow-up trigger.
 * The core entity lifecycle is intentionally owned by the simulator layer.
 * aura-v6 inherits all aura-v5 state semantics and adds the fixed-reference
 * incoming-Electro ordered chain with one shared application Gauge budget.
 * aura-v7 defers Quicken→Hydro Bloom to a live-Aura zero-delay simulator task
 * and stops counting Burning snapshot/Fuel refreshes as new reactions.
 * aura-v8 retains aura-v7 reaction order and defers the EC stream cleanup
 * caused by that Bloom task to the next effective target Reactable.Tick.
 */
export class AuraEngine {
  private readonly auras = new Map<AuraStateElement, MutableAura>();
  private readonly icdStates = new Map<string, IcdState>();
  private readonly icdProfiles: Readonly<Record<string, IcdProfile>>;
  private readonly debugAllowReactionOverride: boolean;
  private readonly mode: AuraReactionEngineConfig["mode"];
  private readonly freezeResistance: number;
  private readonly targetClock: TargetLocalClock | null;
  private readonly reactableTickModel:
    | "legacy-observer-v1"
    | "cached-boundary-v2";
  private readonly reactionDamageReadyFrames = new Map<
    OneShotTransformativeReaction,
    number
  >();
  private electroChargedGeneration = 0;
  private electroChargedActive = false;
  private electroChargedNextTickFrame = -1;
  private readonly pendingElectroChargedCleanups: PendingElectroChargedCleanup[] =
    [];
  private readonly electroChargedCleanupResults: ElectroChargedCleanupResult[] =
    [];
  private frozenGeneration = 0;
  private frozenDecayRate = FROZEN_BASE_DECAY_PER_FRAME;
  private quickenGeneration = 0;
  /**
   * Reactable.Tick advances every target-owned lifecycle once. Dedicated
   * expiry observers can be dispatched in any order after that shared Tick,
   * so retain one authoritative natural boundary per lifecycle kind. A
   * matching observer consumes its own boundary without advancing Aura twice.
   */
  private readonly reactableLifecycleBoundaries = new Map<
    ReactableLifecycleBoundaryKind,
    ReactableLifecycleBoundary
  >();
  private shatterDamageReadyFrame = -1;
  private readonly swirlDamageReadyFrames = new Map<
    SwirlReaction,
    number
  >();
  private crystallizeReadyFrame = -1;
  private burningGeneration = 0;
  private burningDamageSourceActorId: string | null = null;
  private burningFuelSourceActorId: string | null = null;
  /**
   * Target-clock frame at which Fuel was applied after Aura decay. In legacy
   * runs target and global frames are identical.
   */
  private burningFuelAttachedFrame = -1;
  /**
   * Target-clock frame at which Bloom depleted Fuel after the Burning check;
   * the dependent state is purged on the next active target tick.
   */
  private burningFuelDepletedFrame: number | null = null;
  /** Effective decay retained for the one-frame Fuel-depleted purge boundary. */
  private burningFuelDepletedDecayPerFrame: number | null = null;
  private burningNextTickTargetFrame = -1;
  private burningNextTickIndex = 1;
  /**
   * A legacy target-phase callback owns the following same-frame decay. Its
   * historical dedicated Fuel observer remains stale after that decay; this
   * marker keeps the public snapshot cache from changing frozen v1 output.
   */
  private legacyPreDecayBurningTaskFrame: number | null = null;
  private lastBurningApplicationIcdDecision:
    | BurningApplicationIcdDecision
    | null = null;
  private lastBurningStop: {
    fromGeneration: number;
    frame: number;
    reason: BurningStopReason;
    quickenStateMutation: QuickenDecayMutationAudit;
  } | null = null;
  private currentFrame = 0;
  /**
   * During a running target Tick the shared clock has already advanced, while
   * Aura durability still represents the previous target frame. This override
   * preserves the fixed queue-before-decay boundary for expiry projections.
   */
  private targetFrameProjectionOverride: number | null = null;
  private mechanicsTruncation: TargetMechanicsTruncationAudit | null =
    null;

  constructor(config: AuraEngineConfig) {
    this.mode = config.mode;
    this.targetClock = config.targetClock ?? null;
    this.reactableTickModel =
      config.reactableTickModel ?? "legacy-observer-v1";
    this.freezeResistance = config.freezeResistance ?? 0;
    if (
      !Number.isFinite(this.freezeResistance) ||
      this.freezeResistance < 0 ||
      this.freezeResistance > 1
    ) {
      throw new Error(
        `freezeResistance must be between 0 and 1; got ${this.freezeResistance}`
      );
    }
    this.debugAllowReactionOverride =
      config.debugAllowReactionOverride === true;
    this.icdProfiles = {
      default: BUILT_IN_DEFAULT_ICD_PROFILE,
      ...(config.icdProfiles ?? {}),
      burning: BUILT_IN_BURNING_ICD_PROFILE
    };
    for (const initial of config.initialAura ?? []) {
      this.attachNormalAura(
        initial.element,
        initial.gaugeUnits,
        "__initial__"
      );
    }
  }

  isMechanicsTruncated(): boolean {
    return this.mechanicsTruncation !== null;
  }

  getCurrentFrame(): number {
    return this.currentFrame;
  }

  getCurrentTargetFrame(): number {
    return this.targetClock?.getState().localFrame ?? this.currentFrame;
  }

  getTargetClockState(): Readonly<TargetLocalClockState> | null {
    return this.targetClock?.getState() ?? null;
  }

  /**
   * Return and clear aura-v8 EC cleanup observations in deterministic
   * production order. Historical Aura modes never enqueue these records.
   */
  drainElectroChargedCleanupResults(): ElectroChargedCleanupResult[] {
    return this.electroChargedCleanupResults
      .splice(0)
      .map((result) => this.cloneElectroChargedCleanupResult(result));
  }

  applyTargetHitlag(
    input: Readonly<TargetHitlagInput>
  ): Readonly<TargetHitlagAudit> {
    if (this.targetClock === null) {
      throw new Error(
        "Enemy hitlag requires an enabled target-local clock."
      );
    }
    this.advanceTo(input.globalFrame);
    return this.targetClock.applyHitlag(input);
  }

  projectTargetFrame(targetFrame: number): number {
    if (!Number.isSafeInteger(targetFrame) || targetFrame < 0) {
      throw new Error(
        `Target frame must be a non-negative safe integer; got ${targetFrame}`
      );
    }
    return this.targetClock === null
      ? targetFrame
      : this.targetClock.projectGlobalFrameForLocalDeadline(
          targetFrame
        );
  }

  projectTargetDelay(delayFrames: number): number {
    if (!Number.isSafeInteger(delayFrames) || delayFrames < 0) {
      throw new Error(
        `Target-local delay must be a non-negative safe integer; got ${delayFrames}`
      );
    }
    // During a target Tick the shared clock is already at the new local
    // frame, but lifecycle durability still belongs to the preceding frame.
    // Both observer models must honor that projection override so a natural
    // boundary can be cached before the final decay removes its Aura.
    return this.projectTargetFrame(
      this.clockFrame() + delayFrames
    );
  }

  private clockFrame(): number {
    return (
      this.targetFrameProjectionOverride ??
      this.getCurrentTargetFrame()
    );
  }

  private clockDeadline(delayFrames: number): number {
    return this.clockFrame() + delayFrames;
  }

  private projectClockDeadline(clockDeadline: number): number {
    return this.projectTargetFrame(clockDeadline);
  }

  getQuickenLifecycleState(): QuickenLifecycleState {
    const quicken = this.auras.get("quicken");
    const lifecycle = this.quickenEffectiveLifecycle();
    return {
      generation: this.quickenGeneration,
      gaugeUnits: cleanGaugeUnits(
        quicken?.gaugeUnits ?? 0
      ),
      decayPerFrame: lifecycle.decayPerFrame,
      expiresAtFrame: lifecycle.expiresAtFrame,
      endCause: lifecycle.endCause
    };
  }

  getMechanicsTruncation(): TargetMechanicsTruncationAudit | null {
    if (this.mechanicsTruncation === null) return null;
    return {
      ...this.mechanicsTruncation,
      unsupportedReactions: [
        ...this.mechanicsTruncation.unsupportedReactions
      ],
      discardedAura: this.mechanicsTruncation.discardedAura.map(
        (entry) => ({
          ...entry,
          ...(entry.sourceSlots === undefined
            ? {}
            : {
                sourceSlots: entry.sourceSlots.map((slot) => ({
                  ...slot
                }))
              })
        })
      )
    };
  }

  getLastBurningApplicationIcdDecision(): BurningApplicationIcdDecision | null {
    return this.lastBurningApplicationIcdDecision === null
      ? null
      : { ...this.lastBurningApplicationIcdDecision };
  }

  private triggerMechanicsTruncation(
    frame: number,
    unsupportedReactions: TargetMechanicsTruncationAudit["unsupportedReactions"]
  ): TargetMechanicsTruncationAudit {
    if (this.mechanicsTruncation !== null) {
      return {
        ...this.getMechanicsTruncation()!,
        operation: "carry"
      };
    }
    const discardedAura = this.snapshot();
    this.mechanicsTruncation = {
      operation: "trigger",
      startedAtFrame: frame,
      unsupportedReactions: [...unsupportedReactions],
      discardedAura,
      reason:
        unsupportedReactions.includes(
          "non-pyro-multi-reaction-order"
        ) ||
        unsupportedReactions.includes(
          "legacy-multi-reaction-order"
        )
        ? "UNSUPPORTED_REACTION_ORDER"
        : "UNSUPPORTED_DENDRO_REACTION"
    };
    // Invalidate every target-local state event that may already be queued.
    // The target is now outside the implemented mechanics boundary, so a
    // later expiry/tick must resolve as stale rather than inventing a natural
    // state transition after the fail-closed frame.
    this.frozenGeneration += 1;
    this.electroChargedGeneration += 1;
    this.quickenGeneration += 1;
    if (this.hasActiveBurning()) {
      this.stopBurning(
        frame,
        "TARGET_MECHANICS_TRUNCATION",
        false
      );
    }
    this.auras.clear();
    this.burningFuelDepletedFrame = null;
    this.electroChargedActive = false;
    this.electroChargedNextTickFrame = -1;
    return this.getMechanicsTruncation()!;
  }

  private carriedMechanicsTruncation(): TargetMechanicsTruncationAudit {
    const audit = this.getMechanicsTruncation();
    if (audit === null) {
      throw new Error("Missing target mechanics truncation state.");
    }
    return {
      ...audit,
      operation: "carry"
    };
  }

  private syncAuraFromSourceSlots(aura: MutableAura): void {
    if (aura.sourceSlots === undefined) return;
    for (const [sourceActorId, gaugeUnits] of aura.sourceSlots) {
      if (gaugeUnits <= AURA_EPSILON) {
        aura.sourceSlots.delete(sourceActorId);
      }
    }
    aura.gaugeUnits = Math.max(0, ...aura.sourceSlots.values());
  }

  private reduceAuraGauge(
    element: AuraStateElement,
    maximumGaugeUnits: number
  ): {
    consumedGaugeUnits: number;
    sourceMutations: AuraSourceGaugeMutation[];
  } {
    const aura = this.auras.get(element);
    if (aura === undefined || maximumGaugeUnits <= AURA_EPSILON) {
      return {
        consumedGaugeUnits: 0,
        sourceMutations: []
      };
    }
    const consumedGaugeUnits = Math.min(
      aura.gaugeUnits,
      maximumGaugeUnits
    );
    const sourceMutations: AuraSourceGaugeMutation[] = [];
    if (aura.sourceSlots !== undefined) {
      for (const [sourceActorId, gaugeUnitsBefore] of aura.sourceSlots) {
        const sourceConsumedGaugeUnits = Math.min(
          consumedGaugeUnits,
          gaugeUnitsBefore
        );
        const gaugeUnitsAfter =
          gaugeUnitsBefore - sourceConsumedGaugeUnits;
        sourceMutations.push({
          sourceActorId,
          gaugeUnitsBefore: cleanGaugeUnits(gaugeUnitsBefore),
          consumedGaugeUnits: cleanGaugeUnits(
            sourceConsumedGaugeUnits
          ),
          gaugeUnitsAfter: cleanGaugeUnits(gaugeUnitsAfter)
        });
        aura.sourceSlots.set(sourceActorId, gaugeUnitsAfter);
      }
      this.syncAuraFromSourceSlots(aura);
    } else {
      aura.gaugeUnits -= consumedGaugeUnits;
    }
    if (aura.gaugeUnits <= AURA_EPSILON) {
      this.auras.delete(element);
    }
    return {
      consumedGaugeUnits: cleanGaugeUnits(consumedGaugeUnits),
      sourceMutations
    };
  }

  private mappedAuraGaugeUnits(element: AuraStateElement): number {
    if (!usesBurningModel(this.mode) || element !== "pyro") {
      return this.auras.get(element)?.gaugeUnits ?? 0;
    }
    return Math.max(
      this.auras.get("pyro")?.gaugeUnits ?? 0,
      this.auras.get("burning")?.gaugeUnits ?? 0
    );
  }

  private reduceMappedAuraGauge(
    element: AuraStateElement,
    maximumGaugeUnits: number
  ): Array<{
    element: AuraStateElement;
    consumedGaugeUnits: number;
    sourceMutations: AuraSourceGaugeMutation[];
  }> {
    const mappedElements =
      usesBurningModel(this.mode) && element === "pyro"
        ? (["pyro", "burning"] as const)
        : ([element] as const);
    const mutations = mappedElements
      .map((mappedElement) => ({
        element: mappedElement,
        ...this.reduceAuraGauge(
          mappedElement,
          maximumGaugeUnits
        )
      }))
      .filter(
        (mutation) =>
          mutation.consumedGaugeUnits > AURA_EPSILON
      );
    if (
      usesBurningModel(this.mode) &&
      element === "pyro" &&
      (this.auras.get("burning")?.gaugeUnits ?? 0) <=
        AURA_EPSILON &&
      (this.auras.get("burningFuel")?.gaugeUnits ?? 0) >
        AURA_EPSILON
    ) {
      this.stopBurning(
        this.currentFrame,
        "BURNING_AURA_CONSUMED",
        false
      );
    }
    return mutations;
  }

  private burningGaugeUnits(): number {
    return this.auras.get("burning")?.gaugeUnits ?? 0;
  }

  private burningFuelGaugeUnits(): number {
    return this.auras.get("burningFuel")?.gaugeUnits ?? 0;
  }

  private hasActiveBurning(): boolean {
    return (
      usesBurningModel(this.mode) &&
      this.burningGaugeUnits() > AURA_EPSILON &&
      this.burningFuelGaugeUnits() > AURA_EPSILON
    );
  }

  private burningFuelExpiryFrame(): number | null {
    const fuel = this.auras.get("burningFuel");
    if (fuel === undefined || fuel.decayPerFrame <= 0) {
      return null;
    }
    const currentClockFrame = this.clockFrame();
    return this.projectClockDeadline(
      currentClockFrame +
      Math.max(
        0,
        this.burningFuelAttachedFrame + 1 - currentClockFrame
      ) +
      remainingDecayFrames(
        fuel.gaugeUnits,
        fuel.decayPerFrame
      )
    );
  }

  private burningFuelLifecycleExpiryFrame(): number | null {
    const activeExpiry = this.burningFuelExpiryFrame();
    if (activeExpiry !== null) return activeExpiry;
    if (
      this.burningFuelDepletedFrame !== null &&
      this.burningGaugeUnits() > AURA_EPSILON
    ) {
      return this.projectClockDeadline(
        this.burningFuelDepletedFrame + 1
      );
    }
    return null;
  }

  private captureBurningFuelExpiryAt(
    frame: number
  ): ReactableTickCapture["burningFuel"] {
    if (this.burningFuelLifecycleExpiryFrame() !== frame) {
      return null;
    }
    const state = this.captureBurningState();
    return state === null ? null : { state };
  }

  private stopBurning(
    frame: number,
    reason: BurningStopReason,
    removeDendroStates: boolean,
    quickenBefore: QuickenDecayStateCapture =
      this.captureQuickenDecayState()
  ): QuickenDecayMutationAudit {
    const fromGeneration = this.burningGeneration;
    this.auras.delete("burningFuel");
    if (removeDendroStates) {
      this.auras.delete("burning");
      this.auras.delete("dendro");
      this.auras.delete("quicken");
    }
    const quickenStateMutation =
      this.finalizeQuickenDecayMutation(quickenBefore);
    this.burningGeneration += 1;
    this.burningDamageSourceActorId = null;
    this.burningFuelSourceActorId = null;
    this.burningFuelAttachedFrame = -1;
    this.burningFuelDepletedFrame = null;
    this.burningFuelDepletedDecayPerFrame = null;
    this.burningNextTickTargetFrame = -1;
    this.burningNextTickIndex = 1;
    this.lastBurningStop = {
      fromGeneration,
      frame,
      reason,
      quickenStateMutation
    };
    return quickenStateMutation;
  }

  private reduceAuraByDecay(
    aura: MutableAura,
    decayGaugeUnits: number
  ): void {
    if (aura.sourceSlots !== undefined) {
      for (const [sourceActorId, gaugeUnits] of aura.sourceSlots) {
        aura.sourceSlots.set(
          sourceActorId,
          gaugeUnits - decayGaugeUnits
        );
      }
      this.syncAuraFromSourceSlots(aura);
    } else {
      aura.gaugeUnits -= decayGaugeUnits;
    }
    if (aura.gaugeUnits <= AURA_EPSILON) {
      this.auras.delete(aura.element);
    }
  }

  private cloneAuraSnapshot(
    snapshot: readonly AuraStateEntry[]
  ): AuraStateEntry[] {
    return snapshot.map((entry) => ({
      ...entry,
      ...(entry.sourceSlots === undefined
        ? {}
        : {
            sourceSlots: entry.sourceSlots.map((slot) => ({
              ...slot
            }))
          })
    }));
  }

  private cloneElectroChargedCleanupResult(
    result: Readonly<ElectroChargedCleanupResult>
  ): ElectroChargedCleanupResult {
    return {
      ...result,
      auraBefore: this.cloneAuraSnapshot(result.auraBefore),
      auraAfter: this.cloneAuraSnapshot(result.auraAfter)
    };
  }

  /**
   * Replace selected Aura slots while preserving every other slot. This lets
   * one Reactable.Tick expose a canonical, strictly chained set of lifecycle
   * transitions without re-running any durability arithmetic.
   */
  private snapshotWithElementsFrom(
    baseSnapshot: readonly AuraStateEntry[],
    sourceSnapshot: readonly AuraStateEntry[],
    elements: ReadonlySet<AuraStateElement>
  ): AuraStateEntry[] {
    return [
      ...baseSnapshot.filter(
        (entry) => !elements.has(entry.element)
      ),
      ...sourceSnapshot.filter((entry) =>
        elements.has(entry.element)
      )
    ]
      .sort((left, right) =>
        compareCodeUnits(left.element, right.element)
      )
      .map((entry) => ({
        ...entry,
        ...(entry.sourceSlots === undefined
          ? {}
          : {
              sourceSlots: entry.sourceSlots.map((slot) => ({
                ...slot
              }))
            })
      }));
  }

  /**
   * Capture only lifecycle states whose authoritative natural boundary is the
   * Tick about to run. No durability arithmetic is duplicated here: the
   * existing Reactable decay path remains the sole state mutator.
   */
  private captureReactableTick(
    frame: number
  ): ReactableTickCapture | null {
    const cachedBoundaryV2 =
      this.reactableTickModel === "cached-boundary-v2";
    const legacyPreDecayTaskOwnsFuelBoundary =
      !cachedBoundaryV2 &&
      this.legacyPreDecayBurningTaskFrame === frame;
    // The historical global-clock observer retains its Quicken bridge and the
    // public Burning Fuel result. With a target-local clock, any same-frame
    // consumer may advance the shared Tick before the lifecycle observers are
    // dispatched, so v1 retains every natural boundary.
    if (!cachedBoundaryV2 && this.targetClock === null) {
      const quickenState = this.captureQuickenDecayState();
      const quicken =
        quickenState.gaugeUnits > AURA_EPSILON &&
        quickenState.expiresAtFrame === frame &&
        quickenState.endCause === "QUICKEN_DECAY"
          ? quickenState
          : null;
      const burningFuel = legacyPreDecayTaskOwnsFuelBoundary
        ? null
        : this.captureBurningFuelExpiryAt(frame);
      if (quicken === null && burningFuel === null) {
        return null;
      }
      return {
        frame,
        auraBefore: this.snapshot(),
        frozen: null,
        quicken,
        burningFuel,
        electroCharged: null
      };
    }
    const frozenExpiryFrame = this.frozenExpiryFrame();
    const frozen =
      this.frozenGaugeUnits() > AURA_EPSILON &&
      frozenExpiryFrame === frame
        ? {
            generation: this.frozenGeneration
          }
        : null;

    const quickenState = this.captureQuickenDecayState();
    const quicken =
      quickenState.gaugeUnits > AURA_EPSILON &&
      quickenState.expiresAtFrame === frame &&
      quickenState.endCause === "QUICKEN_DECAY"
        ? quickenState
        : null;

    const burningFuel =
      !legacyPreDecayTaskOwnsFuelBoundary &&
      (cachedBoundaryV2 || this.targetClock !== null)
        ? this.captureBurningFuelExpiryAt(frame)
        : null;

    const electroChargedExpiryFrame =
      this.electroChargedActive
        ? this.electroChargedExpiryFrame()
        : null;
    const electroCharged =
      this.electroChargedActive &&
      this.hasElectroChargedAuras() &&
      electroChargedExpiryFrame === frame
        ? {
            generation: this.electroChargedGeneration
          }
        : null;

    if (
      frozen === null &&
      quicken === null &&
      burningFuel === null &&
      electroCharged === null
    ) {
      return null;
    }
    return {
      frame,
      auraBefore: this.snapshot(),
      frozen,
      quicken,
      burningFuel,
      electroCharged
    };
  }

  /**
   * Materialize every lifecycle transition caused by one Reactable.Tick. The
   * dedicated expiry events may run later in any order; each consumes only its
   * cached transition and never advances target state a second time.
   */
  private completeReactableTick(
    capture: ReactableTickCapture | null
  ): void {
    if (capture === null) return;
    const finalAura = this.snapshot();
    const burningStop = this.lastBurningStop;
    const frozenExpired =
      capture.frozen !== null &&
      capture.frozen.generation === this.frozenGeneration &&
      this.frozenGaugeUnits() <= AURA_EPSILON;
    const quickenExpired =
      capture.quicken !== null &&
      capture.quicken.generation === this.quickenGeneration &&
      this.quickenGaugeUnits() <= AURA_EPSILON;
    const burningFuelExpired =
      capture.burningFuel !== null &&
      burningStop?.fromGeneration ===
        capture.burningFuel.state.generation &&
      burningStop.frame === capture.frame &&
      burningStop.reason === "FUEL_EXPIRED";
    const electroChargedStopped =
      capture.electroCharged !== null &&
      capture.electroCharged.generation ===
        this.electroChargedGeneration &&
      !this.hasElectroChargedAuras();

    const transitionDefinitions: Array<{
      kind: ReactableLifecycleBoundaryKind;
      elements: ReadonlySet<AuraStateElement>;
    }> = [];
    // Fixed Reactable.Tick order after ordinary Aura durability has already
    // moved: Fuel cleanup owns its dependent Dendro/Quicken removal, then an
    // independent Quicken decay, Frozen decay, and finally EC stream cleanup.
    if (burningFuelExpired) {
      transitionDefinitions.push({
        kind: "burningFuel",
        elements: new Set<AuraStateElement>([
          "burning",
          "burningFuel",
          "dendro",
          "quicken"
        ])
      });
    }
    if (quickenExpired) {
      transitionDefinitions.push({
        kind: "quicken",
        elements: new Set<AuraStateElement>(["quicken"])
      });
    }
    if (frozenExpired) {
      transitionDefinitions.push({
        kind: "frozen",
        elements: new Set<AuraStateElement>(["frozen"])
      });
    }
    if (electroChargedStopped) {
      transitionDefinitions.push({
        kind: "electroCharged",
        // Hydro/Electro durability already belongs to the preceding ordinary
        // Aura transition. EC cleanup only stops the periodic stream.
        elements: new Set<AuraStateElement>()
      });
    }
    if (transitionDefinitions.length === 0) return;
    const allTransitionElements = new Set<AuraStateElement>();
    for (const definition of transitionDefinitions) {
      for (const element of definition.elements) {
        allTransitionElements.add(element);
      }
    }
    // Ordinary Aura durability moves before Reactable lifecycle cleanup.
    // Seed every lifecycle segment with the post-durability snapshot, while
    // restoring only the elements owned by the pending lifecycle transitions.
    // This must cover partial Gauge decay as well as complete Aura expiry;
    // otherwise an unrelated Gauge change is falsely attributed to (for
    // example) the Quicken-expiry operation.
    let cursor = this.snapshotWithElementsFrom(
      finalAura,
      capture.auraBefore,
      allTransitionElements
    );
    const segments = new Map<
      ReactableLifecycleBoundaryKind,
      {
        auraBefore: AuraStateEntry[];
        auraAfter: AuraStateEntry[];
      }
    >();
    for (
      let index = 0;
      index < transitionDefinitions.length;
      index += 1
    ) {
      const definition = transitionDefinitions[index]!;
      const auraBefore = this.cloneAuraSnapshot(cursor);
      const remainingElements =
        new Set<AuraStateElement>();
      for (
        let laterIndex = index + 1;
        laterIndex < transitionDefinitions.length;
        laterIndex += 1
      ) {
        for (const element of transitionDefinitions[laterIndex]!
          .elements) {
          remainingElements.add(element);
        }
      }
      const auraAfter = this.snapshotWithElementsFrom(
        finalAura,
        capture.auraBefore,
        remainingElements
      );
      segments.set(definition.kind, {
        auraBefore,
        auraAfter: this.cloneAuraSnapshot(auraAfter)
      });
      cursor = auraAfter;
    }

    if (frozenExpired) {
      const segment = segments.get("frozen")!;
      this.reactableLifecycleBoundaries.set("frozen", {
        kind: "frozen",
        result: {
          generation: capture.frozen!.generation,
          operation: "expire",
          frame: capture.frame,
          auraBefore: segment.auraBefore,
          auraAfter: segment.auraAfter,
          expiresAtFrame: null,
          reason: "FROZEN_DECAY_EXPIRED"
        }
      });
    }

    if (quickenExpired) {
      const quickenBefore = capture.quicken!;
      const lifecycleAfter = this.captureQuickenDecayState();
      const segment = segments.get("quicken")!;
      this.reactableLifecycleBoundaries.set("quicken", {
        kind: "quicken",
        result: {
          generation: quickenBefore.generation,
          operation: "expire",
          frame: capture.frame,
          quickenGaugeUnitsBefore: quickenBefore.gaugeUnits,
          quickenGaugeUnitsAfter: lifecycleAfter.gaugeUnits,
          decayPerFrameBefore: quickenBefore.decayPerFrame,
          decayPerFrameAfter: lifecycleAfter.decayPerFrame,
          expiresAtFrameBefore:
            quickenBefore.expiresAtFrame,
          expiresAtFrame: lifecycleAfter.expiresAtFrame,
          endCauseBefore: quickenBefore.endCause,
          endCauseAfter: lifecycleAfter.endCause,
          auraBefore: segment.auraBefore,
          auraAfter: segment.auraAfter,
          reason: "QUICKEN_DECAY_EXPIRED"
        }
      });
    }

    if (burningFuelExpired) {
      const burningBefore = capture.burningFuel!.state;
      const segment = segments.get("burningFuel")!;
      this.reactableLifecycleBoundaries.set("burningFuel", {
        kind: "burningFuel",
        result: {
          generation: burningBefore.generation,
          operation: "expire",
          frame: capture.frame,
          damageSourceActorId:
            burningBefore.damageSourceActorId,
          fuelSourceActorId: burningBefore.fuelSourceActorId,
          burningGaugeUnitsBefore:
            burningBefore.burningGaugeUnits,
          burningGaugeUnitsAfter: 0,
          fuelGaugeUnitsBefore: burningBefore.fuelGaugeUnits,
          fuelGaugeUnitsAfter: 0,
          fuelDecayPerFrame:
            burningBefore.fuelDecayPerFrame,
          auraBefore: segment.auraBefore,
          auraAfter: segment.auraAfter,
          nextTickFrame: null,
          fuelExpiresAtFrame: null,
          quickenStateMutation:
            burningStop!.quickenStateMutation,
          selfDamageStatus:
            "unsupported-player-damage-model",
          reason: "FUEL_EXPIRED"
        }
      });
    }

    if (electroChargedStopped) {
      const segment = segments.get("electroCharged")!;
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
      this.reactableLifecycleBoundaries.set(
        "electroCharged",
        {
          kind: "electroCharged",
          result: {
            generation:
              capture.electroCharged!.generation,
            operation: "stop",
            frame: capture.frame,
            auraBefore: segment.auraBefore,
            auraConsumed: [],
            auraAfter: segment.auraAfter,
            nextTickFrame: null,
            coexistenceExpiresAtFrame: null,
            reason: "AURA_DECAY_EXPIRED"
          }
        }
      );
    }
  }

  private advanceFrozenBy(elapsed: number): void {
    for (let offset = 0; offset < elapsed; offset += 1) {
      const frozen = this.auras.get("frozen");
      if (frozen !== undefined) {
        this.frozenDecayRate +=
          FROZEN_DECAY_ACCELERATION_PER_FRAME;
        frozen.decayPerFrame = this.frozenDecayRate;
        frozen.gaugeUnits -=
          this.frozenDecayRate / (1 - this.freezeResistance);
        if (frozen.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete("frozen");
        }
      } else {
        this.frozenDecayRate = Math.max(
          FROZEN_BASE_DECAY_PER_FRAME,
          this.frozenDecayRate -
            2 * FROZEN_DECAY_ACCELERATION_PER_FRAME
        );
      }
    }
  }

  private advancePassiveDecayBy(elapsed: number): void {
    if (elapsed <= 0) return;
    for (const [element, aura] of this.auras) {
      if (element === "frozen") continue;
      this.reduceAuraByDecay(
        aura,
        aura.decayPerFrame * elapsed
      );
    }
    this.advanceFrozenBy(elapsed);
    this.currentFrame += elapsed;
  }

  private advancePassiveDecayToFinalBoundary(frame: number): void {
    const elapsed = frame - this.currentFrame;
    if (elapsed <= 0) return;
    const hasFinalBoundary =
      this.reactableTickModel === "cached-boundary-v2" &&
      (this.frozenExpiryFrame() === frame ||
        (this.electroChargedActive &&
          this.electroChargedExpiryFrame() === frame) ||
        (() => {
          const quicken = this.captureQuickenDecayState();
          return (
            quicken.endCause === "QUICKEN_DECAY" &&
            quicken.expiresAtFrame === frame
          );
        })());
    if (!hasFinalBoundary) {
      this.advancePassiveDecayBy(elapsed);
      return;
    }
    this.advancePassiveDecayBy(elapsed - 1);
    const reactableTick = this.captureReactableTick(frame);
    this.advancePassiveDecayBy(1);
    this.completeReactableTick(reactableTick);
  }

  /**
   * Advance one non-frozen enemy Tick while retaining the actual global frame
   * for result timestamps. The target-local clock has already advanced by one
   * before this method runs.
   */
  private advanceOneClockedTargetTick(globalFrame: number): void {
    this.currentFrame = globalFrame;
    const targetFrame = this.getCurrentTargetFrame();
    const previousTargetFrame = targetFrame - 1;
    this.targetFrameProjectionOverride = previousTargetFrame;
    const auraBeforeTick = this.snapshot();
    const reactableTick = this.captureReactableTick(globalFrame);

    try {
      if (
        this.burningFuelDepletedFrame !== null &&
        targetFrame > this.burningFuelDepletedFrame
      ) {
        const quickenBeforeFuelPurge =
          this.captureQuickenDecayState();
        this.targetFrameProjectionOverride = targetFrame;
        this.stopBurning(
          globalFrame,
          "FUEL_EXPIRED",
          true,
          quickenBeforeFuelPurge
        );
      }

      if (usesBurningModel(this.mode) && this.hasActiveBurning()) {
        const burningWasActive = this.hasActiveBurning();
        for (const [element, aura] of this.auras) {
          if (
            element === "frozen" ||
            element === "dendro" ||
            element === "quicken" ||
            element === "burning" ||
            element === "burningFuel"
          ) {
            continue;
          }
          this.reduceAuraByDecay(aura, aura.decayPerFrame);
        }

        if (burningWasActive) {
          const fuel = this.auras.get("burningFuel");
          const quickenBeforeFuelDecay = this.auras.has(
            "quicken"
          )
            ? this.captureQuickenDecayState()
            : null;
          if (
            fuel !== undefined &&
            targetFrame > this.burningFuelAttachedFrame + 1
          ) {
            this.reduceAuraByDecay(fuel, fuel.decayPerFrame);
          }
          if (this.burningFuelGaugeUnits() <= AURA_EPSILON) {
            this.targetFrameProjectionOverride = targetFrame;
            this.stopBurning(
              globalFrame,
              "FUEL_EXPIRED",
              true,
              quickenBeforeFuelDecay ??
                this.captureQuickenDecayState()
            );
          } else {
            const fuelDecayPerFrame =
              this.auras.get("burningFuel")?.decayPerFrame ??
              BURNING_FUEL_MIN_DECAY_PER_FRAME;
            const dendro = this.auras.get("dendro");
            if (dendro !== undefined) {
              this.reduceAuraByDecay(
                dendro,
                Math.max(
                  fuelDecayPerFrame,
                  dendro.decayPerFrame * 2
                )
              );
            }
            const quicken = this.auras.get("quicken");
            if (quicken !== undefined) {
              this.reduceAuraByDecay(
                quicken,
                fuelDecayPerFrame
              );
            }
            this.advanceFrozenBy(1);
            this.targetFrameProjectionOverride = targetFrame;
            return;
          }
        }
      } else {
        for (const [element, aura] of this.auras) {
          if (element === "frozen") continue;
          this.reduceAuraByDecay(aura, aura.decayPerFrame);
        }
        this.advanceFrozenBy(1);
        this.targetFrameProjectionOverride = targetFrame;
        return;
      }

      this.targetFrameProjectionOverride = targetFrame;
      this.advanceFrozenBy(1);
    } finally {
      this.targetFrameProjectionOverride = targetFrame;
      this.completeReactableTick(reactableTick);
      this.completePendingElectroChargedCleanups(
        globalFrame,
        targetFrame,
        auraBeforeTick
      );
      this.targetFrameProjectionOverride = null;
    }
  }

  private advanceToWithTargetClock(frame: number): void {
    if (this.targetClock === null) {
      throw new Error(
        "advanceToWithTargetClock requires a target clock."
      );
    }
    if (!Number.isInteger(frame) || frame < this.currentFrame) {
      throw new Error(
        `AuraEngine global frames must be non-decreasing integers; got ${frame} after ${this.currentFrame}`
      );
    }
    const clockState = this.targetClock.getState();
    if (clockState.globalFrame !== this.currentFrame) {
      throw new Error(
        `AuraEngine/target-clock drift: Aura is at global frame ${this.currentFrame}, clock is at ${clockState.globalFrame}.`
      );
    }
    for (
      let nextGlobalFrame = this.currentFrame + 1;
      nextGlobalFrame <= frame;
      nextGlobalFrame += 1
    ) {
      const localBefore =
        this.targetClock.getState().localFrame;
      const localAfter =
        this.targetClock.advanceTo(nextGlobalFrame).localFrame;
      this.currentFrame = nextGlobalFrame;
      if (localAfter > localBefore) {
        this.advanceOneClockedTargetTick(nextGlobalFrame);
      }
    }
  }

  private remainingFrozenFrames(): number | null {
    const frozen = this.auras.get("frozen");
    if (frozen === undefined || this.freezeResistance >= 1) {
      return null;
    }
    let gaugeUnits = frozen.gaugeUnits;
    let decayRate = this.frozenDecayRate;
    let frames = 0;
    while (gaugeUnits > AURA_EPSILON && frames <= 36_000) {
      decayRate += FROZEN_DECAY_ACCELERATION_PER_FRAME;
      gaugeUnits -= decayRate / (1 - this.freezeResistance);
      frames += 1;
    }
    return gaugeUnits <= AURA_EPSILON ? frames : null;
  }

  private advanceTo(frame: number): void {
    if (this.targetClock !== null) {
      this.advanceToWithTargetClock(frame);
      return;
    }
    if (!Number.isInteger(frame) || frame < this.currentFrame) {
      throw new Error(
        `AuraEngine frames must be non-decreasing integers; got ${frame} after ${this.currentFrame}`
      );
    }
    const elapsed = frame - this.currentFrame;
    if (elapsed > 0) {
      if (
        this.burningFuelDepletedFrame !== null &&
        frame > this.burningFuelDepletedFrame
      ) {
        // Bloom can empty Fuel after the current frame's Burning check.
        // Reactable purges the dependent marker/Dendro/Quicken state on the
        // next frame. Route that purge through the normal lifecycle stop so
        // already-queued Burning ticks and Quicken expiry checks carry an old
        // generation and resolve as stale instead of logging a ghost expiry.
        const quickenBeforeFuelPurge =
          this.captureQuickenDecayState();
        this.stopBurning(
          this.currentFrame + 1,
          "FUEL_EXPIRED",
          true,
          quickenBeforeFuelPurge
        );
      }
      if (usesBurningModel(this.mode) && this.hasActiveBurning()) {
        for (
          let nextFrame = this.currentFrame + 1;
          nextFrame <= frame;
          nextFrame += 1
        ) {
          const auraBeforeTick = this.snapshot();
          const reactableTick =
            this.captureReactableTick(nextFrame);
          const burningWasActive = this.hasActiveBurning();
          for (const [element, aura] of this.auras) {
            if (
              element === "frozen" ||
              element === "dendro" ||
              element === "quicken" ||
              element === "burning" ||
              element === "burningFuel"
            ) {
              continue;
            }
            this.reduceAuraByDecay(aura, aura.decayPerFrame);
          }

          if (burningWasActive) {
            const fuel = this.auras.get("burningFuel");
            const quickenBeforeFuelDecay = this.auras.has(
              "quicken"
            )
              ? this.captureQuickenDecayState()
              : null;
            if (
              fuel !== undefined &&
              nextFrame > this.burningFuelAttachedFrame + 1
            ) {
              this.reduceAuraByDecay(
                fuel,
                fuel.decayPerFrame
              );
            }
            if (
              this.burningFuelGaugeUnits() <= AURA_EPSILON
            ) {
              this.currentFrame = nextFrame;
              this.stopBurning(
                nextFrame,
                "FUEL_EXPIRED",
                true,
                quickenBeforeFuelDecay ??
                  this.captureQuickenDecayState()
              );
            } else {
              const fuelDecayPerFrame =
                this.auras.get("burningFuel")?.decayPerFrame ??
                BURNING_FUEL_MIN_DECAY_PER_FRAME;
              const dendro = this.auras.get("dendro");
              if (dendro !== undefined) {
                this.reduceAuraByDecay(
                  dendro,
                  Math.max(
                    fuelDecayPerFrame,
                    dendro.decayPerFrame * 2
                  )
                );
              }
              const quicken = this.auras.get("quicken");
              if (quicken !== undefined) {
                this.reduceAuraByDecay(
                  quicken,
                  fuelDecayPerFrame
                );
              }
              this.advanceFrozenBy(1);
              this.currentFrame = nextFrame;
              this.completeReactableTick(reactableTick);
              this.completePendingElectroChargedCleanups(
                nextFrame,
                nextFrame,
                auraBeforeTick
              );
              continue;
            }
          } else {
            for (const element of [
              "dendro",
              "quicken"
            ] as const) {
              const aura = this.auras.get(element);
              if (aura !== undefined) {
                this.reduceAuraByDecay(
                  aura,
                  aura.decayPerFrame
                );
              }
            }
          }
          this.advanceFrozenBy(1);
          this.currentFrame = nextFrame;
          this.completeReactableTick(reactableTick);
          this.completePendingElectroChargedCleanups(
            nextFrame,
            nextFrame,
            auraBeforeTick
          );
        }
      } else {
        const pendingDeadline =
          this.mode === "aura-v8"
            ? (this.pendingElectroChargedCleanups[0]?.deadlineTargetFrame ??
              null)
            : null;
        if (pendingDeadline !== null && pendingDeadline <= frame) {
          if (pendingDeadline !== this.currentFrame + 1) {
            throw new Error(
              `Aura-v8 EC cleanup missed its next target Tick: deadline ${pendingDeadline}, current ${this.currentFrame}.`
            );
          }
          const auraBeforeTick = this.snapshot();
          const reactableTick = this.captureReactableTick(pendingDeadline);
          this.advancePassiveDecayBy(1);
          this.completeReactableTick(reactableTick);
          this.completePendingElectroChargedCleanups(
            pendingDeadline,
            pendingDeadline,
            auraBeforeTick
          );
        }
        const quickenLifecycle =
          this.captureQuickenDecayState();
        const quickenExpiryFrame =
          quickenLifecycle.endCause === "QUICKEN_DECAY"
            ? quickenLifecycle.expiresAtFrame
            : null;
        if (
          quickenExpiryFrame !== null &&
          quickenExpiryFrame > this.currentFrame &&
          quickenExpiryFrame <= frame
        ) {
          this.advancePassiveDecayBy(
            quickenExpiryFrame - this.currentFrame - 1
          );
          const reactableTick =
            this.captureReactableTick(quickenExpiryFrame);
          this.advancePassiveDecayBy(1);
          this.completeReactableTick(reactableTick);
          this.advancePassiveDecayToFinalBoundary(frame);
        } else {
          this.advancePassiveDecayToFinalBoundary(frame);
        }
      }
      if (
        this.electroChargedActive &&
        !this.hasElectroChargedAuras() &&
        !this.shouldDeferElectroChargedMissingAuraCleanup()
      ) {
        this.electroChargedActive = false;
        this.electroChargedNextTickFrame = -1;
      }
    }
  }

  private snapshot(): AuraStateEntry[] {
    return [...this.auras.values()]
      .filter((aura) => aura.gaugeUnits > AURA_EPSILON)
      .sort((left, right) =>
        compareCodeUnits(left.element, right.element)
      )
      .map((aura) => {
        const expiresAtFrame =
          aura.element === "burningFuel"
            ? this.burningFuelExpiryFrame()
            : aura.element === "frozen"
              ? this.frozenExpiryFrame()
              : aura.element === "quicken"
                ? this.quickenExpiryFrame()
                : this.hasActiveBurning() &&
                    aura.element === "dendro"
                  ? this.projectTargetDelay(
                      Math.min(
                        remainingDecayFrames(
                          aura.gaugeUnits,
                          Math.max(
                            this.auras.get("burningFuel")
                              ?.decayPerFrame ??
                              BURNING_FUEL_MIN_DECAY_PER_FRAME,
                            aura.decayPerFrame * 2
                          )
                        ),
                        (() => {
                          const fuel =
                            this.auras.get("burningFuel");
                          if (
                            fuel === undefined ||
                            fuel.decayPerFrame <= 0
                          ) {
                            return 0;
                          }
                          return (
                            Math.max(
                              0,
                              this.burningFuelAttachedFrame +
                                1 -
                                this.clockFrame()
                            ) +
                            remainingDecayFrames(
                              fuel.gaugeUnits,
                              fuel.decayPerFrame
                            )
                          );
                        })()
                      )
                    )
                  : aura.decayPerFrame > 0
                    ? this.projectTargetDelay(
                        remainingDecayFrames(
                          aura.gaugeUnits,
                          aura.decayPerFrame
                        )
                      )
                    : null;
        return {
          element: aura.element,
          gaugeUnits: cleanGaugeUnits(aura.gaugeUnits),
          expiresAtFrame,
          ...(this.targetClock === null
            ? {}
            : {
                expiresAtTargetFrame:
                  expiresAtFrame === null
                    ? null
                    : this.targetClock.projectLocalFrameAtGlobalFrame(
                        expiresAtFrame
                      )
              }),
          ...(aura.sourceSlots === undefined
            ? {}
            : {
                sourceSlots: [...aura.sourceSlots]
                  .filter(
                    ([, gaugeUnits]) =>
                      gaugeUnits > AURA_EPSILON
                  )
                  .sort(([left], [right]) =>
                    compareCodeUnits(left, right)
                  )
                  .map(([sourceActorId, gaugeUnits]) => ({
                    sourceActorId,
                    gaugeUnits: cleanGaugeUnits(gaugeUnits)
                  }))
              })
        };
      });
  }

  private hasElectroChargedAuras(): boolean {
    return (
      (this.auras.get("hydro")?.gaugeUnits ?? 0) >
        AURA_EPSILON &&
      (this.auras.get("electro")?.gaugeUnits ?? 0) >
        AURA_EPSILON
    );
  }

  private shouldDeferElectroChargedMissingAuraCleanup(): boolean {
    return this.pendingElectroChargedCleanups.some(
      (pending) =>
        this.mode === "aura-v8" &&
        pending.generation === this.electroChargedGeneration &&
        this.clockFrame() < pending.deadlineTargetFrame
    );
  }

  private armElectroChargedCleanup(
    input: Readonly<QuickenBloomFollowupInput>,
    auraBefore: readonly AuraStateEntry[]
  ): void {
    if (this.mode !== "aura-v8") return;
    const originReactionTaskId = input.originReactionTaskId ?? null;
    if (
      originReactionTaskId !== null &&
      (!Number.isSafeInteger(originReactionTaskId) || originReactionTaskId < 0)
    ) {
      throw new Error(
        `originReactionTaskId must be null or a non-negative safe integer; got ${originReactionTaskId}`
      );
    }

    const armedAtTargetFrame = this.getCurrentTargetFrame();
    const deadlineTargetFrame = armedAtTargetFrame + 1;
    if (!Number.isSafeInteger(deadlineTargetFrame)) {
      throw new Error(
        `Aura-v8 EC cleanup target deadline exceeds the safe integer frame range after ${armedAtTargetFrame}.`
      );
    }
    const nextPending: PendingElectroChargedCleanup = {
      generation: this.electroChargedGeneration,
      armedAtFrame: input.frame,
      armedAtTargetFrame,
      deadlineTargetFrame,
      originReactionTaskId
    };
    if (
      this.pendingElectroChargedCleanups.some(
        (pending) => pending.generation === nextPending.generation
      )
    ) {
      return;
    }
    this.pendingElectroChargedCleanups.push(nextPending);
    this.electroChargedCleanupResults.push({
      model: "quicken-bloom-target-tick-v1",
      ...nextPending,
      resolvedAtFrame: null,
      resolvedAtTargetFrame: null,
      outcome: "armed",
      reason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO",
      auraBefore: this.cloneAuraSnapshot(auraBefore),
      auraAfter: this.snapshot(),
      nextTickFrame:
        this.electroChargedNextTickFrame < 0
          ? null
          : this.electroChargedNextTickFrame
    });
  }

  private completePendingElectroChargedCleanups(
    frame: number,
    targetFrame: number,
    auraBeforeTick: readonly AuraStateEntry[]
  ): void {
    if (
      this.mode !== "aura-v8" ||
      this.pendingElectroChargedCleanups.length === 0
    ) {
      return;
    }
    const due = this.pendingElectroChargedCleanups.filter(
      (pending) => targetFrame >= pending.deadlineTargetFrame
    );
    if (due.length === 0) return;
    this.pendingElectroChargedCleanups.splice(0, due.length);

    for (const pending of due) {
      let outcome: Exclude<ElectroChargedCleanupOutcome, "armed">;
      let reason: Exclude<
        ElectroChargedCleanupReason,
        "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO"
      >;
      const naturalBoundary =
        this.reactableLifecycleBoundaries.get("electroCharged");
      if (pending.generation !== this.electroChargedGeneration) {
        outcome = "superseded";
        reason = "ELECTRO_CHARGED_GENERATION_SUPERSEDED";
      } else if (
        naturalBoundary?.kind === "electroCharged" &&
        naturalBoundary.result.generation === pending.generation &&
        naturalBoundary.result.frame === frame &&
        naturalBoundary.result.reason === "AURA_DECAY_EXPIRED"
      ) {
        // Reactable.Tick naturally ended coexistence first. The simulator's
        // order-3 periodic-expiry lifecycle owns the unique stop; the later
        // cleanup wake only records that this request lost the collision.
        outcome = "natural-expiry";
        reason = "AURA_DECAY_EXPIRED_BEFORE_CLEANUP";
      } else if (this.electroChargedActive && this.hasElectroChargedAuras()) {
        outcome = "retained";
        reason = "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK";
      } else {
        outcome = "stopped";
        reason = "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM";
        this.electroChargedActive = false;
        this.electroChargedNextTickFrame = -1;
      }

      this.electroChargedCleanupResults.push({
        model: "quicken-bloom-target-tick-v1",
        ...pending,
        resolvedAtFrame: frame,
        resolvedAtTargetFrame: targetFrame,
        outcome,
        reason,
        auraBefore: this.cloneAuraSnapshot(auraBeforeTick),
        auraAfter: this.snapshot(),
        nextTickFrame:
          this.electroChargedNextTickFrame < 0
            ? null
            : this.electroChargedNextTickFrame
      });
    }
  }

  private electroChargedExpiryFrame(): number | null {
    if (!this.hasElectroChargedAuras()) return null;
    const hydro = this.auras.get("hydro");
    const electro = this.auras.get("electro");
    if (!hydro || !electro) return null;
    const expiryFrames = [hydro, electro].map((aura) =>
      aura.decayPerFrame > 0
        ? this.projectTargetDelay(
            remainingDecayFrames(
              aura.gaugeUnits,
              aura.decayPerFrame
            )
          )
        : Number.POSITIVE_INFINITY
    );
    const earliest = Math.min(...expiryFrames);
    return Number.isFinite(earliest) ? earliest : null;
  }

  private frozenGaugeUnits(): number {
    return this.auras.get("frozen")?.gaugeUnits ?? 0;
  }

  private frozenExpiryFrame(): number | null {
    const remainingFrames = this.remainingFrozenFrames();
    return remainingFrames === null
      ? null
      : this.projectTargetDelay(remainingFrames);
  }

  private attachFrozen(gaugeUnits: number): {
    operation: "start" | "refresh" | "immune";
    generatedGaugeUnits: number;
  } {
    this.frozenGeneration += 1;
    if (this.freezeResistance >= 1) {
      return {
        operation: "immune",
        generatedGaugeUnits: 0
      };
    }
    const existing = this.auras.get("frozen");
    const operation = existing === undefined ? "start" : "refresh";
    if (existing === undefined) {
      this.auras.set("frozen", {
        element: "frozen",
        gaugeUnits,
        decayPerFrame: this.frozenDecayRate
      });
    } else if (gaugeUnits > existing.gaugeUnits) {
      existing.gaugeUnits = gaugeUnits;
    }
    return {
      operation,
      generatedGaugeUnits: gaugeUnits
    };
  }

  processShatterHit(input: {
    frame: number;
    element: Element;
    strikeType?: StrikeType;
    poiseDamage?: number;
  }): ShatterStateResult | null {
    this.advanceTo(input.frame);
    if (this.mechanicsTruncation !== null) return null;
    const strikeType = input.strikeType ?? "default";
    const poiseDamage = input.poiseDamage ?? 0;
    if (
      !Number.isFinite(poiseDamage) ||
      poiseDamage < 0
    ) {
      throw new Error(
        `poiseDamage must be a finite non-negative number; got ${poiseDamage}`
      );
    }
    if (strikeType !== "blunt" && input.element !== "geo") {
      return null;
    }

    const mutations: ShatterFrozenMutation[] = [];
    const auraBefore = this.snapshot();
    const frozenGaugeBefore = this.frozenGaugeUnits();
    if (frozenGaugeBefore <= AURA_EPSILON) {
      return {
        audit: {
          reaction: "shatter",
          generation: this.frozenGeneration,
          strikeType,
          poiseDamage,
          triggered: false,
          scheduled: false,
          damageElement: "physical",
          damageFrame: input.frame,
          baseMultiplier: SHATTER_BASE_MULTIPLIER,
          blockedReason: "NO_FROZEN_AURA",
          nextAvailableFrame: null,
          frozenGaugeBefore: 0,
          poiseConsumedGaugeUnits: 0,
          frozenGaugeAfterPoise: 0,
          shatterConsumedGaugeUnits: 0,
          frozenGaugeAfter: 0,
          auraBefore,
          auraAfterPoise: this.snapshot(),
          auraAfter: this.snapshot(),
          expiresAtFrame: null
        },
        mutations
      };
    }

    let poiseConsumedGaugeUnits = 0;
    if (strikeType === "blunt" && poiseDamage > 0) {
      const mutationBefore = this.snapshot();
      const frozen = this.auras.get("frozen");
      if (frozen !== undefined) {
        poiseConsumedGaugeUnits = Math.min(
          frozen.gaugeUnits,
          poiseDamage * FROZEN_POISE_DAMAGE_TO_GAUGE_UNITS
        );
        frozen.gaugeUnits -= poiseConsumedGaugeUnits;
        if (frozen.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete("frozen");
        }
      }
      if (poiseConsumedGaugeUnits > AURA_EPSILON) {
        mutations.push({
          operation: "poise-consume",
          consumedGaugeUnits: cleanGaugeUnits(
            poiseConsumedGaugeUnits
          ),
          auraBefore: mutationBefore,
          auraAfter: this.snapshot(),
          reason:
            this.frozenGaugeUnits() <= AURA_EPSILON
              ? "FROZEN_DEPLETED_BY_BLUNT_POISE"
              : "FROZEN_PARTIALLY_CONSUMED_BY_BLUNT_POISE"
        });
      }
    }

    const auraAfterPoise = this.snapshot();
    const frozenGaugeAfterPoise = this.frozenGaugeUnits();
    if (frozenGaugeAfterPoise <= AURA_EPSILON) {
      if (mutations.length > 0) {
        this.frozenGeneration += 1;
      }
      return {
        audit: {
          reaction: "shatter",
          generation: this.frozenGeneration,
          strikeType,
          poiseDamage,
          triggered: false,
          scheduled: false,
          damageElement: "physical",
          damageFrame: input.frame,
          baseMultiplier: SHATTER_BASE_MULTIPLIER,
          blockedReason: "FROZEN_DEPLETED_BY_POISE",
          nextAvailableFrame: null,
          frozenGaugeBefore: cleanGaugeUnits(
            frozenGaugeBefore
          ),
          poiseConsumedGaugeUnits: cleanGaugeUnits(
            poiseConsumedGaugeUnits
          ),
          frozenGaugeAfterPoise: 0,
          shatterConsumedGaugeUnits: 0,
          frozenGaugeAfter: 0,
          auraBefore,
          auraAfterPoise,
          auraAfter: this.snapshot(),
          expiresAtFrame: null
        },
        mutations
      };
    }

    const shatterAuraBefore = this.snapshot();
    const frozen = this.auras.get("frozen");
    const shatterConsumedGaugeUnits =
      frozen === undefined
        ? 0
        : Math.min(
            frozen.gaugeUnits,
            SHATTER_GAUGE_CONSUMPTION_UNITS
          );
    if (frozen !== undefined) {
      frozen.gaugeUnits -= shatterConsumedGaugeUnits;
      if (frozen.gaugeUnits <= AURA_EPSILON) {
        this.auras.delete("frozen");
      }
    }
    this.frozenGeneration += 1;
    const auraAfter = this.snapshot();
    mutations.push({
      operation: "shatter-consume",
      consumedGaugeUnits: cleanGaugeUnits(
        shatterConsumedGaugeUnits
      ),
      auraBefore: shatterAuraBefore,
      auraAfter,
      reason:
        this.frozenGaugeUnits() <= AURA_EPSILON
          ? "FROZEN_CONSUMED_BY_SHATTER"
          : "FROZEN_PARTIALLY_CONSUMED_BY_SHATTER"
    });

    const scheduled =
      this.shatterDamageReadyFrame < 0 ||
      input.frame >= this.shatterDamageReadyFrame;
    if (scheduled) {
      this.shatterDamageReadyFrame =
        input.frame + SHATTER_DAMAGE_GCD_FRAMES;
    }
    return {
      audit: {
        reaction: "shatter",
        generation: this.frozenGeneration,
        strikeType,
        poiseDamage,
        triggered: true,
        scheduled,
        damageElement: "physical",
        damageFrame: input.frame,
        baseMultiplier: SHATTER_BASE_MULTIPLIER,
        blockedReason: scheduled
          ? null
          : "REACTION_DAMAGE_GCD",
        nextAvailableFrame: this.shatterDamageReadyFrame,
        frozenGaugeBefore: cleanGaugeUnits(
          frozenGaugeBefore
        ),
        poiseConsumedGaugeUnits: cleanGaugeUnits(
          poiseConsumedGaugeUnits
        ),
        frozenGaugeAfterPoise: cleanGaugeUnits(
          frozenGaugeAfterPoise
        ),
        shatterConsumedGaugeUnits: cleanGaugeUnits(
          shatterConsumedGaugeUnits
        ),
        frozenGaugeAfter: cleanGaugeUnits(
          this.frozenGaugeUnits()
        ),
        auraBefore,
        auraAfterPoise,
        auraAfter,
        expiresAtFrame: this.frozenExpiryFrame()
      },
      mutations
    };
  }

  expireFrozen(
    frame: number,
    generation: number,
    expectedExpiryFrame: number
  ): FrozenStateResult {
    const cachedBoundary =
      this.reactableLifecycleBoundaries.get("frozen");
    if (
      (this.reactableTickModel === "cached-boundary-v2" ||
        this.targetClock !== null) &&
      cachedBoundary?.kind === "frozen" &&
      cachedBoundary.result.frame === frame &&
      cachedBoundary.result.generation === generation &&
      expectedExpiryFrame === frame &&
      generation === this.frozenGeneration &&
      this.frozenGaugeUnits() <= AURA_EPSILON
    ) {
      this.reactableLifecycleBoundaries.delete("frozen");
      return cachedBoundary.result;
    }
    const currentExpiry = this.frozenExpiryFrame();
    if (
      generation !== this.frozenGeneration ||
      this.frozenGaugeUnits() <= AURA_EPSILON ||
      frame !== expectedExpiryFrame ||
      currentExpiry !== expectedExpiryFrame
    ) {
      const aura = this.snapshot();
      return {
        generation,
        operation: "stale",
        frame,
        auraBefore: aura,
        auraAfter: this.cloneAuraSnapshot(aura),
        expiresAtFrame: currentExpiry,
        reason: "STALE_FROZEN_EXPIRY_CHECK"
      };
    }
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const fallbackAuraBefore = this.snapshot();
    this.advanceTo(frame);
    const materializedBoundary =
      this.reactableLifecycleBoundaries.get("frozen");
    if (
      materializedBoundary?.kind === "frozen" &&
      materializedBoundary.result.frame === frame &&
      materializedBoundary.result.generation === generation
    ) {
      this.reactableLifecycleBoundaries.delete("frozen");
      return materializedBoundary.result;
    }
    const auraBefore = fallbackAuraBefore;
    const auraAfter = this.snapshot();
    const refreshedExpiry = this.frozenExpiryFrame();
    if (
      generation !== this.frozenGeneration ||
      (refreshedExpiry !== null &&
        refreshedExpiry !== expectedExpiryFrame)
    ) {
      return {
        generation,
        operation: "stale",
        frame,
        auraBefore,
        auraAfter,
        expiresAtFrame: refreshedExpiry,
        reason: "STALE_FROZEN_EXPIRY_CHECK"
      };
    }
    if (this.frozenGaugeUnits() <= AURA_EPSILON) {
      return {
        generation,
        operation: "expire",
        frame,
        auraBefore,
        auraAfter,
        expiresAtFrame: null,
        reason: "FROZEN_DECAY_EXPIRED"
      };
    }
    return {
      generation,
      operation: "stale",
      frame,
      auraBefore,
      auraAfter,
      expiresAtFrame: refreshedExpiry,
      reason: "FROZEN_REFRESHED_BEFORE_EXPIRY"
    };
  }

  getAuraStateAt(frame: number): AuraStateEntry[] {
    this.advanceTo(frame);
    return this.snapshot();
  }

  prepareElectroChargedTick(
    frame: number,
    generation: number
  ): ElectroChargedStateResult {
    this.advanceTo(frame);
    const auraBefore = this.snapshot();
    if (generation !== this.electroChargedGeneration) {
      return {
        generation,
        operation: "stale",
        frame,
        auraBefore,
        auraConsumed: [],
        auraAfter: this.snapshot(),
        nextTickFrame: null,
        coexistenceExpiresAtFrame:
          this.electroChargedExpiryFrame(),
        reason: "SUPERSEDED_STREAM"
      };
    }
    if (
      !this.electroChargedActive ||
      !this.hasElectroChargedAuras()
    ) {
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
      return {
        generation,
        operation: "stop",
        frame,
        auraBefore,
        auraConsumed: [],
        auraAfter: this.snapshot(),
        nextTickFrame: null,
        coexistenceExpiresAtFrame: null,
        reason: "COEXISTING_AURA_MISSING"
      };
    }
    this.electroChargedNextTickFrame =
      frame + ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
    return {
      generation,
      operation: "tick",
      frame,
      auraBefore,
      auraConsumed: [],
      auraAfter: this.snapshot(),
      nextTickFrame: this.electroChargedNextTickFrame,
      coexistenceExpiresAtFrame:
        this.electroChargedExpiryFrame(),
      reason: null
    };
  }

  waneElectroCharged(
    frame: number,
    damageApplied: boolean
  ): ElectroChargedStateResult;
  waneElectroCharged(
    frame: number,
    expectedGeneration: number,
    damageApplied: boolean
  ): ElectroChargedStateResult;
  waneElectroCharged(
    frame: number,
    expectedGenerationOrDamageApplied: number | boolean,
    maybeDamageApplied?: boolean
  ): ElectroChargedStateResult {
    const expectedGeneration =
      typeof expectedGenerationOrDamageApplied === "number"
        ? expectedGenerationOrDamageApplied
        : this.electroChargedGeneration;
    const damageApplied =
      typeof expectedGenerationOrDamageApplied === "number"
        ? maybeDamageApplied === true
        : expectedGenerationOrDamageApplied;
    if (expectedGeneration !== this.electroChargedGeneration) {
      const aura = this.snapshot();
      return {
        generation: expectedGeneration,
        operation: "stale",
        frame,
        auraBefore: aura,
        auraConsumed: [],
        auraAfter: this.cloneAuraSnapshot(aura),
        nextTickFrame: this.electroChargedActive
          ? this.electroChargedNextTickFrame
          : null,
        coexistenceExpiresAtFrame:
          this.electroChargedExpiryFrame(),
        reason: "SUPERSEDED_STREAM"
      };
    }
    this.advanceTo(frame);
    const auraBefore = this.snapshot();
    const generation = expectedGeneration;
    if (
      !this.electroChargedActive ||
      !this.hasElectroChargedAuras()
    ) {
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
      return {
        generation,
        operation: "stop",
        frame,
        auraBefore,
        auraConsumed: [],
        auraAfter: this.snapshot(),
        nextTickFrame: null,
        coexistenceExpiresAtFrame: null,
        reason: "COEXISTING_AURA_MISSING_BEFORE_WANE"
      };
    }
    if (!damageApplied) {
      return {
        generation,
        operation: "wane-skipped",
        frame,
        auraBefore,
        auraConsumed: [],
        auraAfter: this.snapshot(),
        nextTickFrame: this.electroChargedNextTickFrame,
        coexistenceExpiresAtFrame:
          this.electroChargedExpiryFrame(),
        reason: "ZERO_ACTUAL_DAMAGE"
      };
    }

    const auraConsumed: NonNullable<ReactionAudit["auraConsumed"]> =
      [];
    for (const element of ["hydro", "electro"] as const) {
      const mutation = this.reduceAuraGauge(
        element,
        ELECTRO_CHARGED_WANE_GAUGE_UNITS
      );
      if (mutation.consumedGaugeUnits <= AURA_EPSILON) continue;
      auraConsumed.push({
        element,
        gaugeUnits: mutation.consumedGaugeUnits,
        ...(mutation.sourceMutations.length === 0
          ? {}
          : { sourceMutations: mutation.sourceMutations })
      });
    }
    if (!this.hasElectroChargedAuras()) {
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
    }
    return {
      generation,
      operation: "wane",
      frame,
      auraBefore,
      auraConsumed,
      auraAfter: this.snapshot(),
      nextTickFrame: this.electroChargedActive
        ? this.electroChargedNextTickFrame
        : null,
      coexistenceExpiresAtFrame:
        this.electroChargedExpiryFrame(),
      reason: this.electroChargedActive
        ? null
        : "AURA_DEPLETED_BY_WANE"
    };
  }

  expireElectroCharged(
    frame: number,
    generation: number,
    expectedExpiryFrame: number
  ): ElectroChargedStateResult {
    const cachedBoundary =
      this.reactableLifecycleBoundaries.get(
        "electroCharged"
      );
    if (
      (this.reactableTickModel === "cached-boundary-v2" ||
        this.targetClock !== null) &&
      cachedBoundary?.kind === "electroCharged" &&
      cachedBoundary.result.frame === frame &&
      cachedBoundary.result.generation === generation &&
      expectedExpiryFrame === frame &&
      generation === this.electroChargedGeneration &&
      !this.electroChargedActive
    ) {
      this.reactableLifecycleBoundaries.delete(
        "electroCharged"
      );
      return cachedBoundary.result;
    }
    const dispatchExpiry = this.electroChargedExpiryFrame();
    if (
      generation !== this.electroChargedGeneration ||
      !this.electroChargedActive ||
      !this.hasElectroChargedAuras() ||
      frame !== expectedExpiryFrame ||
      dispatchExpiry !== expectedExpiryFrame
    ) {
      const aura = this.snapshot();
      return {
        generation,
        operation: "stale",
        frame,
        auraBefore: aura,
        auraConsumed: [],
        auraAfter: this.cloneAuraSnapshot(aura),
        nextTickFrame: this.electroChargedActive
          ? this.electroChargedNextTickFrame
          : null,
        coexistenceExpiresAtFrame: dispatchExpiry,
        reason: this.electroChargedActive
          ? "STALE_EXPIRY_CHECK"
          : "STREAM_ALREADY_INACTIVE"
      };
    }
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const fallbackAuraBefore = this.snapshot();
    this.advanceTo(frame);
    const materializedBoundary =
      this.reactableLifecycleBoundaries.get(
        "electroCharged"
      );
    if (
      materializedBoundary?.kind === "electroCharged" &&
      materializedBoundary.result.frame === frame &&
      materializedBoundary.result.generation === generation
    ) {
      this.reactableLifecycleBoundaries.delete(
        "electroCharged"
      );
      return materializedBoundary.result;
    }
    const auraBefore = fallbackAuraBefore;
    const auraAfter = this.snapshot();
    const currentExpiry = this.electroChargedExpiryFrame();
    if (
      generation !== this.electroChargedGeneration ||
      (currentExpiry !== null &&
        currentExpiry !== expectedExpiryFrame)
    ) {
      return {
        generation,
        operation: "stale",
        frame,
        auraBefore,
        auraConsumed: [],
        auraAfter,
        nextTickFrame: this.electroChargedActive
          ? this.electroChargedNextTickFrame
          : null,
        coexistenceExpiresAtFrame: currentExpiry,
        reason: "STALE_EXPIRY_CHECK"
      };
    }
    if (!this.hasElectroChargedAuras()) {
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
      return {
        generation,
        operation: "stop",
        frame,
        auraBefore,
        auraConsumed: [],
        auraAfter,
        nextTickFrame: null,
        coexistenceExpiresAtFrame: null,
        reason: "AURA_DECAY_EXPIRED"
      };
    }
    return {
      generation,
      operation: "stale",
      frame,
      auraBefore,
      auraConsumed: [],
      auraAfter,
      nextTickFrame: this.electroChargedNextTickFrame,
      coexistenceExpiresAtFrame: currentExpiry,
      reason: "AURA_REFRESHED_BEFORE_EXPIRY"
    };
  }

  private attachNormalAura(
    element: PersistentAuraElement,
    nominalGaugeUnits: number,
    sourceActorId: string
  ): void {
    const appliedGaugeUnits = NORMAL_AURA_RATIO * nominalGaugeUnits;
    const durationPerUnitFrames =
      usesAuraV3Durability(this.mode)
        ? AURA_V3_NORMAL_DURATION_PER_UNIT_FRAMES
        : NORMAL_AURA_DURATION_PER_UNIT_FRAMES;
    const durationFrames =
      NORMAL_AURA_BASE_DURATION_FRAMES +
      durationPerUnitFrames * nominalGaugeUnits;
    const nextDecayPerFrame = appliedGaugeUnits / durationFrames;
    const existing = this.auras.get(element);

    if (!existing) {
      this.auras.set(element, {
        element,
        gaugeUnits: appliedGaugeUnits,
        decayPerFrame: nextDecayPerFrame,
        ...(usesAuraV3Durability(this.mode)
          ? {
              sourceSlots: new Map([
                [sourceActorId, appliedGaugeUnits]
              ])
            }
          : {})
      });
      return;
    }

    if (usesAuraV3Durability(this.mode)) {
      const sourceSlots =
        existing.sourceSlots ??
        new Map([["__legacy__", existing.gaugeUnits]]);
      existing.sourceSlots = sourceSlots;
      if (element === "pyro") {
        if (
          appliedGaugeUnits + AURA_EPSILON >=
          existing.gaugeUnits
        ) {
          sourceSlots.set(sourceActorId, appliedGaugeUnits);
          existing.decayPerFrame = nextDecayPerFrame;
          this.syncAuraFromSourceSlots(existing);
        }
        return;
      }
      const existingSourceGauge =
        sourceSlots.get(sourceActorId) ?? 0;
      if (appliedGaugeUnits > existingSourceGauge) {
        sourceSlots.set(sourceActorId, appliedGaugeUnits);
        this.syncAuraFromSourceSlots(existing);
      }
      return;
    }

    if (element === "pyro") {
      // gcsim's normal Pyro overlap refreshes duration only when the incoming
      // aura is at least as strong as the remaining aura.
      if (appliedGaugeUnits + AURA_EPSILON >= existing.gaugeUnits) {
        existing.gaugeUnits = appliedGaugeUnits;
        existing.decayPerFrame = nextDecayPerFrame;
      }
      return;
    }

    // Cryo/Hydro/Electro/Dendro use overlap semantics. This per-target state
    // keeps the stronger remaining aura; per-source overlap arrays are
    // intentionally not yet represented.
    if (appliedGaugeUnits > existing.gaugeUnits) {
      existing.gaugeUnits = appliedGaugeUnits;
    }
  }

  private quickenGaugeUnits(): number {
    return this.auras.get("quicken")?.gaugeUnits ?? 0;
  }

  private quickenEffectiveLifecycle(): {
    decayPerFrame: number;
    expiresAtFrame: number | null;
    endCause: QuickenDecayEndCause;
  } {
    const quicken = this.auras.get("quicken");
    if (quicken === undefined || quicken.gaugeUnits <= AURA_EPSILON) {
      return {
        decayPerFrame: 0,
        expiresAtFrame: null,
        endCause: null
      };
    }

    if (
      usesBurningModel(this.mode) &&
      this.burningFuelDepletedFrame !== null &&
      this.burningGaugeUnits() > AURA_EPSILON
    ) {
      return {
        decayPerFrame:
          this.burningFuelDepletedDecayPerFrame ??
          quicken.decayPerFrame,
        expiresAtFrame: this.projectClockDeadline(
          this.burningFuelDepletedFrame + 1
        ),
        endCause: "BURNING_FUEL_EXPIRED"
      };
    }

    const fuel = usesBurningModel(this.mode)
      ? this.auras.get("burningFuel")
      : undefined;
    if (
      fuel !== undefined &&
      fuel.gaugeUnits > AURA_EPSILON &&
      fuel.decayPerFrame > 0
    ) {
      const quickenDecayExpiryFrame =
        this.projectTargetDelay(
        remainingDecayFrames(
          quicken.gaugeUnits,
          fuel.decayPerFrame
        )
        );
      const fuelExpiryFrame = this.burningFuelExpiryFrame();
      if (
        fuelExpiryFrame !== null &&
        fuelExpiryFrame <= quickenDecayExpiryFrame
      ) {
        return {
          decayPerFrame: fuel.decayPerFrame,
          expiresAtFrame: fuelExpiryFrame,
          endCause: "BURNING_FUEL_EXPIRED"
        };
      }
      return {
        decayPerFrame: fuel.decayPerFrame,
        expiresAtFrame: quickenDecayExpiryFrame,
        endCause: "QUICKEN_DECAY"
      };
    }

    if (quicken.decayPerFrame <= 0) {
      return {
        decayPerFrame: 0,
        expiresAtFrame: null,
        endCause: null
      };
    }
    return {
      decayPerFrame: quicken.decayPerFrame,
      expiresAtFrame:
        this.projectTargetDelay(
        remainingDecayFrames(
          quicken.gaugeUnits,
          quicken.decayPerFrame
        )
        ),
      endCause: "QUICKEN_DECAY"
    };
  }

  private quickenExpiryFrame(): number | null {
    return this.quickenEffectiveLifecycle().expiresAtFrame;
  }

  private quickenAuraEntry(
    expiresAtFrame: number | null
  ): AuraStateEntry | null {
    const quicken = this.auras.get("quicken");
    if (quicken === undefined || quicken.gaugeUnits <= AURA_EPSILON) {
      return null;
    }
    return {
      element: "quicken",
      gaugeUnits: cleanGaugeUnits(quicken.gaugeUnits),
      expiresAtFrame,
      ...(this.targetClock === null
        ? {}
        : {
            expiresAtTargetFrame:
              expiresAtFrame === null
                ? null
                : this.targetClock.projectLocalFrameAtGlobalFrame(
                    expiresAtFrame
                  )
          }),
      ...(quicken.sourceSlots === undefined
        ? {}
        : {
            sourceSlots: [...quicken.sourceSlots]
              .filter(([, gaugeUnits]) => gaugeUnits > AURA_EPSILON)
              .sort(([left], [right]) =>
                compareCodeUnits(left, right)
              )
              .map(([sourceActorId, gaugeUnits]) => ({
                sourceActorId,
                gaugeUnits: cleanGaugeUnits(gaugeUnits)
              }))
          })
    };
  }

  private captureQuickenDecayState(): QuickenDecayStateCapture {
    const lifecycle = this.quickenEffectiveLifecycle();
    return {
      generation: this.quickenGeneration,
      gaugeUnits: cleanGaugeUnits(this.quickenGaugeUnits()),
      decayPerFrame: lifecycle.decayPerFrame,
      expiresAtFrame: lifecycle.expiresAtFrame,
      endCause: lifecycle.endCause,
      auraEntry: this.quickenAuraEntry(
        lifecycle.expiresAtFrame
      )
    };
  }

  private snapshotWithQuickenState(
    baseSnapshot: AuraStateEntry[],
    state: QuickenDecayStateCapture
  ): AuraStateEntry[] {
    const snapshot = baseSnapshot
      .filter((entry) => entry.element !== "quicken")
      .map((entry) => ({
        ...entry,
        ...(entry.sourceSlots === undefined
          ? {}
          : {
              sourceSlots: entry.sourceSlots.map((slot) => ({
                ...slot
              }))
            })
      }));
    if (state.auraEntry !== null) {
      snapshot.push({
        ...state.auraEntry,
        ...(state.auraEntry.sourceSlots === undefined
          ? {}
          : {
              sourceSlots: state.auraEntry.sourceSlots.map(
                (slot) => ({ ...slot })
              )
            })
      });
    }
    return snapshot.sort((left, right) =>
      compareCodeUnits(left.element, right.element)
    );
  }

  private finalizeQuickenDecayMutation(
    before: QuickenDecayStateCapture
  ): QuickenDecayMutationAudit {
    let after = this.captureQuickenDecayState();
    const beforeActive = before.gaugeUnits > AURA_EPSILON;
    const afterActive = after.gaugeUnits > AURA_EPSILON;
    const lifecycleChanged =
      Math.abs(
        after.decayPerFrame - before.decayPerFrame
      ) > AURA_EPSILON ||
      after.expiresAtFrame !== before.expiresAtFrame ||
      after.endCause !== before.endCause;
    const operation: QuickenDecayMutationAudit["operation"] =
      beforeActive && !afterActive
        ? "remove"
        : beforeActive && afterActive && lifecycleChanged
          ? "decay-rebase"
          : "none";

    if (operation !== "none") {
      this.quickenGeneration += 1;
      after = this.captureQuickenDecayState();
    }

    const baseSnapshot = this.snapshot();
    const operationAuraBefore =
      this.snapshotWithQuickenState(baseSnapshot, before);
    const operationAuraAfter =
      this.snapshotWithQuickenState(baseSnapshot, after);
    return {
      operation,
      generationBefore: before.generation,
      generationAfter: after.generation,
      quickenGaugeUnitsBefore: before.gaugeUnits,
      quickenGaugeUnitsAfter: after.gaugeUnits,
      decayPerFrameBefore: before.decayPerFrame,
      decayPerFrameAfter: after.decayPerFrame,
      expiresAtFrameBefore: before.expiresAtFrame,
      expiresAtFrameAfter: after.expiresAtFrame,
      endCauseBefore: before.endCause,
      endCauseAfter: after.endCause,
      operationAuraBefore,
      operationAuraAfter
    };
  }

  private attachQuicken(
    candidateGaugeUnits: number,
    sourceActorId: string
  ): {
    operation: QuickenReactionAudit["operation"];
    generation: number;
    quickenGaugeUnitsBefore: number;
    quickenGaugeUnitsAfter: number;
    decayPerFrameBefore: number;
    decayPerFrame: number;
    expiresAtFrameBefore: number | null;
    expiresAtFrame: number | null;
    endCauseBefore: QuickenDecayEndCause;
    endCause: Exclude<QuickenDecayEndCause, null>;
    operationAuraBefore: AuraStateEntry[];
    operationAuraAfter: AuraStateEntry[];
  } {
    const lifecycleBefore = this.captureQuickenDecayState();
    const operationAuraBefore = this.snapshot();
    const quickenGaugeUnitsBefore = this.quickenGaugeUnits();
    const existing = this.auras.get("quicken");
    let operation: QuickenReactionAudit["operation"] = "unchanged";
    if (
      existing === undefined ||
      candidateGaugeUnits + AURA_EPSILON >= existing.gaugeUnits
    ) {
      const durationFrames =
        QUICKEN_BASE_DURATION_FRAMES +
        QUICKEN_DURATION_PER_UNIT_FRAMES * candidateGaugeUnits;
      const decayPerFrame = candidateGaugeUnits / durationFrames;
      operation = existing === undefined ? "start" : "refresh";
      const sourceSlots =
        existing?.sourceSlots ?? new Map<string, number>();
      sourceSlots.set(sourceActorId, candidateGaugeUnits);
      const quicken: MutableAura = {
        element: "quicken",
        gaugeUnits: candidateGaugeUnits,
        decayPerFrame,
        sourceSlots
      };
      this.syncAuraFromSourceSlots(quicken);
      this.auras.set("quicken", quicken);
      this.quickenGeneration += 1;
    }
    const quicken = this.auras.get("quicken");
    const lifecycleAfter = this.captureQuickenDecayState();
    if (lifecycleAfter.endCause === null) {
      throw new Error(
        "Active Quicken attachment requires a deterministic end cause."
      );
    }
    return {
      operation,
      generation: this.quickenGeneration,
      quickenGaugeUnitsBefore: cleanGaugeUnits(
        quickenGaugeUnitsBefore
      ),
      quickenGaugeUnitsAfter: cleanGaugeUnits(
        quicken?.gaugeUnits ?? 0
      ),
      decayPerFrameBefore: lifecycleBefore.decayPerFrame,
      decayPerFrame: lifecycleAfter.decayPerFrame,
      expiresAtFrameBefore:
        lifecycleBefore.expiresAtFrame,
      expiresAtFrame: lifecycleAfter.expiresAtFrame,
      endCauseBefore: lifecycleBefore.endCause,
      endCause: lifecycleAfter.endCause,
      operationAuraBefore,
      operationAuraAfter: this.snapshot()
    };
  }

  expireQuicken(
    frame: number,
    generation: number,
    expectedExpiryFrame: number
  ): QuickenExpiryResult {
    const cachedBoundary =
      this.reactableLifecycleBoundaries.get("quicken");
    if (
      cachedBoundary?.kind === "quicken" &&
      cachedBoundary.result.generation === generation &&
      cachedBoundary.result.frame === frame &&
      generation === this.quickenGeneration &&
      frame === expectedExpiryFrame &&
      this.quickenGaugeUnits() <= AURA_EPSILON
    ) {
      this.reactableLifecycleBoundaries.delete("quicken");
      return cachedBoundary.result;
    }
    const generationWasCurrent =
      generation === this.quickenGeneration;
    const lifecycleAtDispatch =
      this.captureQuickenDecayState();
    if (
      !generationWasCurrent ||
      lifecycleAtDispatch.gaugeUnits <= AURA_EPSILON ||
      lifecycleAtDispatch.endCause !== "QUICKEN_DECAY" ||
      frame !== expectedExpiryFrame ||
      (lifecycleAtDispatch.expiresAtFrame !== null &&
        lifecycleAtDispatch.expiresAtFrame !==
          expectedExpiryFrame)
    ) {
      // A stale target-local event is an observation only. Advancing the Aura
      // clock here could let an old Quicken event consume a same-frame Fuel
      // boundary before the authoritative BurningFuelExpiry event records it.
      const aura = this.snapshot();
      return {
        generation,
        operation: "stale",
        frame,
        quickenGaugeUnitsBefore:
          lifecycleAtDispatch.gaugeUnits,
        quickenGaugeUnitsAfter:
          lifecycleAtDispatch.gaugeUnits,
        decayPerFrameBefore:
          lifecycleAtDispatch.decayPerFrame,
        decayPerFrameAfter:
          lifecycleAtDispatch.decayPerFrame,
        expiresAtFrameBefore:
          lifecycleAtDispatch.expiresAtFrame,
        expiresAtFrame:
          lifecycleAtDispatch.expiresAtFrame,
        endCauseBefore: lifecycleAtDispatch.endCause,
        endCauseAfter: lifecycleAtDispatch.endCause,
        auraBefore: aura,
        auraAfter: aura.map((entry) => ({
          ...entry,
          ...(entry.sourceSlots === undefined
            ? {}
            : {
                sourceSlots: entry.sourceSlots.map((slot) => ({
                  ...slot
                }))
              })
        })),
        reason: "STALE_QUICKEN_EXPIRY_CHECK"
      };
    }
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const lifecycleBefore = this.captureQuickenDecayState();
    const auraBefore = this.snapshot();
    this.advanceTo(frame);
    const materializedBoundary =
      this.reactableLifecycleBoundaries.get("quicken");
    if (
      materializedBoundary?.kind === "quicken" &&
      materializedBoundary.result.generation === generation &&
      materializedBoundary.result.frame === frame
    ) {
      this.reactableLifecycleBoundaries.delete("quicken");
      return materializedBoundary.result;
    }
    const lifecycleAfter = this.captureQuickenDecayState();
    const auraAfter = this.snapshot();
    const currentExpiry = lifecycleAfter.expiresAtFrame;
    const lifecycle = {
      quickenGaugeUnitsBefore: lifecycleBefore.gaugeUnits,
      quickenGaugeUnitsAfter: lifecycleAfter.gaugeUnits,
      decayPerFrameBefore: lifecycleBefore.decayPerFrame,
      decayPerFrameAfter: lifecycleAfter.decayPerFrame,
      expiresAtFrameBefore:
        lifecycleBefore.expiresAtFrame,
      endCauseBefore: lifecycleBefore.endCause,
      endCauseAfter: lifecycleAfter.endCause
    };
    if (
      !generationWasCurrent ||
      generation !== this.quickenGeneration ||
      (currentExpiry !== null &&
        currentExpiry !== expectedExpiryFrame)
    ) {
      return {
        generation,
        operation: "stale",
        frame,
        ...lifecycle,
        auraBefore,
        auraAfter,
        expiresAtFrame: currentExpiry,
        reason: "STALE_QUICKEN_EXPIRY_CHECK"
      };
    }
    if (this.quickenGaugeUnits() <= AURA_EPSILON) {
      if (lifecycleBefore.gaugeUnits <= AURA_EPSILON) {
        return {
          generation,
          operation: "stale",
          frame,
          ...lifecycle,
          auraBefore,
          auraAfter,
          expiresAtFrame: currentExpiry,
          reason: "STALE_QUICKEN_EXPIRY_CHECK"
        };
      }
      const operationAuraBefore =
        this.snapshotWithQuickenState(
          auraAfter,
          lifecycleBefore
        );
      return {
        generation,
        operation: "expire",
        frame,
        ...lifecycle,
        // Time advancement may decay unrelated Aura slots on the same frame.
        // The lifecycle operation snapshots isolate the actual Quicken
        // removal boundary so strict consumers never attribute those ambient
        // decays to the Quicken expiry operation itself.
        auraBefore: operationAuraBefore,
        auraAfter,
        expiresAtFrame: null,
        reason: "QUICKEN_DECAY_EXPIRED"
      };
    }
    return {
      generation,
      operation: "stale",
      frame,
      ...lifecycle,
      auraBefore,
      auraAfter,
      expiresAtFrame: currentExpiry,
      reason: "QUICKEN_REFRESHED_BEFORE_EXPIRY"
    };
  }

  private captureBurningState(): BurningStateCapture | null {
    if (!this.hasActiveBurning()) return null;
    return {
      generation: this.burningGeneration,
      damageSourceActorId:
        this.burningDamageSourceActorId ??
        "__unknown-burning-source__",
      fuelSourceActorId: this.burningFuelSourceActorId,
      burningGaugeUnits: cleanGaugeUnits(
        this.burningGaugeUnits()
      ),
      fuelGaugeUnits: cleanGaugeUnits(
        this.burningFuelGaugeUnits()
      ),
      fuelDecayPerFrame:
        this.auras.get("burningFuel")?.decayPerFrame ?? 0,
      fuelExpiresAtFrame: this.burningFuelExpiryFrame()
    };
  }

  private makeBurningStopAudit(
    input: AuraHitInput,
    before: BurningStateCapture
  ): BurningReactionAudit {
    const quickenStateMutation =
      this.lastBurningStop?.fromGeneration ===
        before.generation &&
      this.lastBurningStop.frame === input.frame
        ? this.lastBurningStop.quickenStateMutation
        : this.finalizeQuickenDecayMutation(
            this.captureQuickenDecayState()
          );
    return {
      reaction: "burning",
      operation: "stop",
      reactionTriggered: false,
      generation: before.generation,
      triggerElement: input.element,
      fuelOperation: "remove",
      stopReason: "BURNING_AURA_CONSUMED",
      scheduled: false,
      blockedReason: null,
      damageSourceActorId: before.damageSourceActorId,
      fuelSourceActorId: before.fuelSourceActorId,
      burningGaugeUnitsBefore: before.burningGaugeUnits,
      candidateBurningGaugeUnits: 0,
      burningGaugeUnitsAfter: cleanGaugeUnits(
        this.burningGaugeUnits()
      ),
      burningDecayPerFrame: 0,
      burningExpiresAtFrame: null,
      fuelGaugeUnitsBefore: before.fuelGaugeUnits,
      candidateFuelGaugeUnits: 0,
      fuelGaugeUnitsAfter: cleanGaugeUnits(
        this.burningFuelGaugeUnits()
      ),
      fuelDecayPerFrame: before.fuelDecayPerFrame,
      fuelExpiresAtFrame: null,
      ...(this.targetClock === null
        ? {}
        : {
            fuelExpiresAtTargetFrame: null,
            snapshotTargetFrame: this.clockFrame(),
            firstTickTargetFrame: null,
            nextTickTargetFrame: null
          }),
      quickenStateMutation,
      snapshotFrame: input.frame,
      clockModel:
        this.targetClock === null
          ? "target-local-no-hitlag"
          : "target-local-hitlag-v1",
      hitlagStatus:
        this.targetClock === null
          ? "unsupported-enemy-hitlag"
          : "modeled-enemy-hitlag",
      firstTickFrame: null,
      nextTickFrame: null,
      tickIntervalFrames: BURNING_TICK_INTERVAL_FRAMES,
      skippedTickIndex: BURNING_SKIPPED_TICK_INDEX,
      damageElement: "pyro",
      baseMultiplier: BURNING_BASE_MULTIPLIER,
      radius: BURNING_RADIUS,
      applicationGaugeUnits:
        BURNING_APPLICATION_GAUGE_UNITS,
      selfDamageStatus: "unsupported-player-damage-model"
    };
  }

  private attachBurningFuel(
    gaugeUnits: number,
    sourceActorId: string
  ): void {
    this.auras.set("burningFuel", {
      element: "burningFuel",
      gaugeUnits,
      decayPerFrame: BURNING_FUEL_MIN_DECAY_PER_FRAME,
      sourceSlots: new Map([[sourceActorId, gaugeUnits]])
    });
    this.burningFuelSourceActorId = sourceActorId;
    this.burningFuelAttachedFrame = this.clockFrame();
    this.burningFuelDepletedFrame = null;
    this.burningFuelDepletedDecayPerFrame = null;
  }

  private startOrRefreshBurning(
    input: AuraHitInput,
    application: ElementalApplication
  ): BurningReactionAudit | null {
    if (
      !usesBurningModel(this.mode) ||
      (input.element !== "pyro" &&
        input.element !== "dendro") ||
      application.gaugeUnits <= AURA_EPSILON
    ) {
      return null;
    }

    const burningGaugeUnitsBefore = this.burningGaugeUnits();
    const fuelGaugeUnitsBefore =
      this.burningFuelGaugeUnits();
    const quickenBefore = this.captureQuickenDecayState();
    const activeBefore = this.hasActiveBurning();
    const qualifies =
      input.element === "pyro"
        ? (this.auras.get("dendro")?.gaugeUnits ?? 0) >
            AURA_EPSILON ||
          this.quickenGaugeUnits() > AURA_EPSILON
        : this.mappedAuraGaugeUnits("pyro") >
          AURA_EPSILON;
    if (!qualifies) return null;

    const incomingDendroFuel =
      input.element === "dendro"
        ? BURNING_FUEL_INCOMING_DENDRO_RATIO *
          application.gaugeUnits
        : 0;
    const candidateFuelGaugeUnits = activeBefore
      ? input.element === "dendro"
        ? incomingDendroFuel
        : fuelGaugeUnitsBefore
      : Math.max(
          this.auras.get("dendro")?.gaugeUnits ?? 0,
          this.quickenGaugeUnits(),
          incomingDendroFuel
        );
    if (candidateFuelGaugeUnits <= AURA_EPSILON) {
      return null;
    }

    let operation: BurningReactionAudit["operation"];
    let fuelOperation: BurningReactionAudit["fuelOperation"];
    if (!activeBefore) {
      operation = "start";
      fuelOperation = "start";
      this.burningGeneration += 1;
      this.auras.set("burning", {
        element: "burning",
        gaugeUnits: BURNING_MARKER_GAUGE_UNITS,
        decayPerFrame: 0,
        sourceSlots: new Map([
          [input.sourceActorId, BURNING_MARKER_GAUGE_UNITS]
        ])
      });
      this.attachBurningFuel(
        candidateFuelGaugeUnits,
        input.sourceActorId
      );
      this.burningNextTickTargetFrame =
        this.clockDeadline(BURNING_TICK_INTERVAL_FRAMES);
      this.burningNextTickIndex = 1;
      this.lastBurningStop = null;
    } else if (input.element === "dendro") {
      operation = "refresh-fuel";
      fuelOperation = "overwrite";
      this.attachBurningFuel(
        candidateFuelGaugeUnits,
        input.sourceActorId
      );
    } else {
      operation = "refresh-snapshot";
      fuelOperation = "unchanged";
    }
    this.burningDamageSourceActorId = input.sourceActorId;
    const quickenStateMutation =
      this.finalizeQuickenDecayMutation(quickenBefore);
    const fuelExpiresAtFrame =
      this.burningFuelExpiryFrame();
    const firstTickFrame =
      operation === "start"
        ? this.projectClockDeadline(
            this.burningNextTickTargetFrame
          )
        : null;
    const nextTickFrame =
      this.burningNextTickTargetFrame < 0
        ? null
        : this.projectClockDeadline(
            this.burningNextTickTargetFrame
          );

    return {
      reaction: "burning",
      operation,
      reactionTriggered: operation === "start",
      generation: this.burningGeneration,
      triggerElement: input.element,
      fuelOperation,
      stopReason: null,
      scheduled: true,
      blockedReason: null,
      damageSourceActorId: input.sourceActorId,
      fuelSourceActorId: this.burningFuelSourceActorId,
      burningGaugeUnitsBefore: cleanGaugeUnits(
        burningGaugeUnitsBefore
      ),
      candidateBurningGaugeUnits:
        BURNING_MARKER_GAUGE_UNITS,
      burningGaugeUnitsAfter: cleanGaugeUnits(
        this.burningGaugeUnits()
      ),
      burningDecayPerFrame: 0,
      burningExpiresAtFrame: null,
      fuelGaugeUnitsBefore: cleanGaugeUnits(
        fuelGaugeUnitsBefore
      ),
      candidateFuelGaugeUnits: cleanGaugeUnits(
        candidateFuelGaugeUnits
      ),
      fuelGaugeUnitsAfter: cleanGaugeUnits(
        this.burningFuelGaugeUnits()
      ),
      fuelDecayPerFrame:
        this.auras.get("burningFuel")?.decayPerFrame ?? 0,
      fuelExpiresAtFrame,
      ...(this.targetClock === null
        ? {}
        : {
            fuelExpiresAtTargetFrame:
              fuelExpiresAtFrame === null
                ? null
                : this.targetClock.projectLocalFrameAtGlobalFrame(
                    fuelExpiresAtFrame
                  ),
            snapshotTargetFrame: this.clockFrame(),
            firstTickTargetFrame:
              operation === "start"
                ? this.burningNextTickTargetFrame
                : null,
            nextTickTargetFrame:
              this.burningNextTickTargetFrame < 0
                ? null
                : this.burningNextTickTargetFrame
          }),
      quickenStateMutation,
      snapshotFrame: input.frame,
      clockModel:
        this.targetClock === null
          ? "target-local-no-hitlag"
          : "target-local-hitlag-v1",
      hitlagStatus:
        this.targetClock === null
          ? "unsupported-enemy-hitlag"
          : "modeled-enemy-hitlag",
      firstTickFrame,
      nextTickFrame,
      tickIntervalFrames: BURNING_TICK_INTERVAL_FRAMES,
      skippedTickIndex: BURNING_SKIPPED_TICK_INDEX,
      damageElement: "pyro",
      baseMultiplier: BURNING_BASE_MULTIPLIER,
      radius: BURNING_RADIUS,
      applicationGaugeUnits:
        BURNING_APPLICATION_GAUGE_UNITS,
      selfDamageStatus: "unsupported-player-damage-model"
    };
  }

  private prepareBurningTickForPhase(
    frame: number,
    generation: number,
    tickIndex: number,
    phase: "after-decay" | "before-decay"
  ): BurningTickResult {
    const generationWasCurrent =
      generation === this.burningGeneration;
    if (phase === "before-decay") {
      if (frame <= this.currentFrame) {
        throw new Error(
          `A pre-decay Burning task for frame ${frame} must run before Aura reaches that frame; Aura is already at ${this.currentFrame}.`
        );
      }
      this.advanceTo(frame - 1);
      if (this.reactableTickModel === "legacy-observer-v1") {
        this.legacyPreDecayBurningTaskFrame = frame;
      }
    } else {
      this.advanceTo(frame);
    }
    const auraBefore = this.snapshot();
    const burningGaugeUnits = this.burningGaugeUnits();
    const fuelGaugeUnits = this.burningFuelGaugeUnits();
    const base = {
      generation,
      tickIndex,
      frame,
      damageSourceActorId:
        this.burningDamageSourceActorId,
      fuelSourceActorId: this.burningFuelSourceActorId,
      burningGaugeUnitsBefore: cleanGaugeUnits(
        burningGaugeUnits
      ),
      burningGaugeUnitsAfter: cleanGaugeUnits(
        burningGaugeUnits
      ),
      fuelGaugeUnitsBefore: cleanGaugeUnits(fuelGaugeUnits),
      fuelGaugeUnitsAfter: cleanGaugeUnits(fuelGaugeUnits),
      fuelDecayPerFrame:
        this.auras.get("burningFuel")?.decayPerFrame ?? 0,
      auraBefore,
      auraAfter: this.snapshot(),
      fuelExpiresAtFrame: this.burningFuelExpiryFrame(),
      selfDamageStatus:
        "unsupported-player-damage-model" as const
    };
    if (
      !generationWasCurrent ||
      generation !== this.burningGeneration
    ) {
      const stoppedThisFrame =
        generationWasCurrent &&
        this.lastBurningStop?.fromGeneration === generation &&
        this.lastBurningStop.frame === frame;
      return {
        ...base,
        operation: stoppedThisFrame ? "stop" : "stale",
        nextTickFrame: null,
        skipReason: null,
        reason: stoppedThisFrame
          ? this.lastBurningStop!.reason
          : "SUPERSEDED_STREAM"
      };
    }
    if (!this.hasActiveBurning()) {
      return {
        ...base,
        operation: "stop",
        nextTickFrame: null,
        skipReason: null,
        reason: "FUEL_EXPIRED"
      };
    }
    const currentTargetFrame =
      phase === "before-decay"
        ? this.targetClock === null
          ? frame
          : this.targetClock.projectLocalFrameAtGlobalFrame(frame)
        : this.clockFrame();
    if (currentTargetFrame !== this.burningNextTickTargetFrame) {
      return {
        ...base,
        operation: "stale",
        nextTickFrame: this.projectClockDeadline(
          this.burningNextTickTargetFrame
        ),
        skipReason: null,
        reason: "UNEXPECTED_TICK_FRAME"
      };
    }
    if (tickIndex !== this.burningNextTickIndex) {
      return {
        ...base,
        operation: "stale",
        nextTickFrame: this.projectClockDeadline(
          this.burningNextTickTargetFrame
        ),
        skipReason: null,
        reason: "UNEXPECTED_TICK_INDEX"
      };
    }

    this.burningNextTickTargetFrame =
      currentTargetFrame + BURNING_TICK_INTERVAL_FRAMES;
    this.burningNextTickIndex += 1;
    const skipped =
      tickIndex === BURNING_SKIPPED_TICK_INDEX;
    return {
      ...base,
      operation: skipped ? "tick-skipped" : "tick",
      auraAfter: this.snapshot(),
      nextTickFrame: this.projectClockDeadline(
        this.burningNextTickTargetFrame
      ),
      skipReason: skipped ? "COUNTER_9_SKIP" : null,
      reason: null
    };
  }

  /**
   * Historical event-heap behavior: advance Aura through the current target
   * frame before evaluating the queued Burning callback.
   */
  prepareBurningTick(
    frame: number,
    generation: number,
    tickIndex: number
  ): BurningTickResult {
    return this.prepareBurningTickForPhase(
      frame,
      generation,
      tickIndex,
      "after-decay"
    );
  }

  /**
   * Fixed-reference target-task behavior: evaluate the queued Burning
   * callback against the state at the end of the previous target frame. The
   * caller must advance Aura through `frame` immediately afterwards, before
   * applying incoming attacks for the same frame.
   */
  prepareBurningTickBeforeDecay(
    frame: number,
    generation: number,
    tickIndex: number
  ): BurningTickResult {
    return this.prepareBurningTickForPhase(
      frame,
      generation,
      tickIndex,
      "before-decay"
    );
  }

  expireBurningFuel(
    frame: number,
    generation: number,
    expectedExpiryFrame: number
  ): BurningFuelExpiryResult {
    const cachedBoundary =
      this.reactableLifecycleBoundaries.get("burningFuel");
    if (
      cachedBoundary?.kind === "burningFuel" &&
      cachedBoundary.result.frame === frame &&
      cachedBoundary.result.generation === generation &&
      expectedExpiryFrame === frame &&
      this.burningGeneration === generation + 1 &&
      !this.hasActiveBurning()
    ) {
      this.reactableLifecycleBoundaries.delete("burningFuel");
      return cachedBoundary.result;
    }
    const generationWasCurrent =
      generation === this.burningGeneration;
    const dispatchExpiry =
      this.burningFuelLifecycleExpiryFrame();
    if (
      !generationWasCurrent ||
      frame !== expectedExpiryFrame ||
      dispatchExpiry === null ||
      dispatchExpiry !== expectedExpiryFrame
    ) {
      // Like Quicken expiry, a superseded Fuel event must not advance target
      // state. A newer same-frame event owns the actual Tick boundary.
      const aura = this.snapshot();
      const burningGaugeUnits = this.burningGaugeUnits();
      const fuelGaugeUnits = this.burningFuelGaugeUnits();
      return {
        generation,
        operation: "stale",
        frame,
        damageSourceActorId:
          this.burningDamageSourceActorId,
        fuelSourceActorId: this.burningFuelSourceActorId,
        burningGaugeUnitsBefore: cleanGaugeUnits(
          burningGaugeUnits
        ),
        burningGaugeUnitsAfter: cleanGaugeUnits(
          burningGaugeUnits
        ),
        fuelGaugeUnitsBefore: cleanGaugeUnits(
          fuelGaugeUnits
        ),
        fuelGaugeUnitsAfter: cleanGaugeUnits(
          fuelGaugeUnits
        ),
        fuelDecayPerFrame:
          this.auras.get("burningFuel")?.decayPerFrame ??
          this.burningFuelDepletedDecayPerFrame ??
          0,
        auraBefore: aura,
        auraAfter: aura.map((entry) => ({
          ...entry,
          ...(entry.sourceSlots === undefined
            ? {}
            : {
                sourceSlots: entry.sourceSlots.map((slot) => ({
                  ...slot
                }))
              })
        })),
        nextTickFrame:
          this.burningNextTickTargetFrame < 0
            ? null
            : this.projectClockDeadline(
                this.burningNextTickTargetFrame
              ),
        fuelExpiresAtFrame: dispatchExpiry,
        quickenStateMutation:
          this.finalizeQuickenDecayMutation(
            this.captureQuickenDecayState()
          ),
        selfDamageStatus:
          "unsupported-player-damage-model",
        reason: generationWasCurrent
          ? "BURNING_REFRESHED_BEFORE_EXPIRY"
          : "STALE_BURNING_FUEL_EXPIRY_CHECK"
      };
    }
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const damageSourceActorId =
      this.burningDamageSourceActorId;
    const fuelSourceActorId = this.burningFuelSourceActorId;
    const auraBefore = this.snapshot();
    const burningGaugeUnitsBefore =
      this.burningGaugeUnits();
    const fuelGaugeUnitsBefore =
      this.burningFuelGaugeUnits();
    const fuelDecayPerFrame =
      this.auras.get("burningFuel")?.decayPerFrame ?? 0;
    this.advanceTo(frame);
    const materializedBoundary =
      this.reactableLifecycleBoundaries.get("burningFuel");
    if (
      materializedBoundary?.kind === "burningFuel" &&
      materializedBoundary.result.frame === frame &&
      materializedBoundary.result.generation === generation
    ) {
      this.reactableLifecycleBoundaries.delete("burningFuel");
      if (this.reactableTickModel === "cached-boundary-v2") {
        return materializedBoundary.result;
      }
    }
    const auraAfter = this.snapshot();
    const currentExpiry = this.burningFuelExpiryFrame();
    const expiredThisFrame =
      generationWasCurrent &&
      this.lastBurningStop?.fromGeneration === generation &&
      this.lastBurningStop.frame === frame &&
      this.lastBurningStop.reason === "FUEL_EXPIRED";
    if (expiredThisFrame) {
      return {
        generation,
        operation: "expire",
        frame,
        damageSourceActorId,
        fuelSourceActorId,
        burningGaugeUnitsBefore: cleanGaugeUnits(
          burningGaugeUnitsBefore
        ),
        burningGaugeUnitsAfter: 0,
        fuelGaugeUnitsBefore: cleanGaugeUnits(
          fuelGaugeUnitsBefore
        ),
        fuelGaugeUnitsAfter: 0,
        fuelDecayPerFrame,
        auraBefore,
        auraAfter,
        nextTickFrame: null,
        fuelExpiresAtFrame: null,
        quickenStateMutation:
          this.lastBurningStop!.quickenStateMutation,
        selfDamageStatus:
          "unsupported-player-damage-model",
        reason: "FUEL_EXPIRED"
      };
    }
    const refreshed =
      generationWasCurrent &&
      generation === this.burningGeneration &&
      currentExpiry !== null &&
      currentExpiry !== expectedExpiryFrame;
    return {
      generation,
      operation: "stale",
      frame,
      damageSourceActorId:
        this.burningDamageSourceActorId,
      fuelSourceActorId: this.burningFuelSourceActorId,
      burningGaugeUnitsBefore: cleanGaugeUnits(
        burningGaugeUnitsBefore
      ),
      burningGaugeUnitsAfter: cleanGaugeUnits(
        this.burningGaugeUnits()
      ),
      fuelGaugeUnitsBefore: cleanGaugeUnits(
        fuelGaugeUnitsBefore
      ),
      fuelGaugeUnitsAfter: cleanGaugeUnits(
        this.burningFuelGaugeUnits()
      ),
      fuelDecayPerFrame:
        this.auras.get("burningFuel")?.decayPerFrame ??
        fuelDecayPerFrame,
      auraBefore,
      auraAfter,
      nextTickFrame:
        this.burningNextTickTargetFrame < 0
          ? null
          : this.projectClockDeadline(
              this.burningNextTickTargetFrame
            ),
      fuelExpiresAtFrame: currentExpiry,
      quickenStateMutation:
        this.finalizeQuickenDecayMutation(
          this.captureQuickenDecayState()
        ),
      selfDamageStatus:
        "unsupported-player-damage-model",
      reason: refreshed
        ? "BURNING_REFRESHED_BEFORE_EXPIRY"
        : "STALE_BURNING_FUEL_EXPIRY_CHECK"
    };
  }

  private resolveBloom(
    input: AuraHitInput,
    incomingGaugeUnits: number,
    runQuickenHydroFollowup: boolean,
    auraConsumed: NonNullable<ReactionAudit["auraConsumed"]>
  ): {
    remainingIncomingGaugeUnits: number;
    audits: BloomReactionAudit[];
  } {
    const isQuickenFollowupOnly =
      input.element === "electro" &&
      runQuickenHydroFollowup;
    if (
      !usesBloomModel(this.mode) ||
      (input.element !== "hydro" &&
        input.element !== "dendro" &&
        !isQuickenFollowupOnly)
    ) {
      return {
        remainingIncomingGaugeUnits: incomingGaugeUnits,
        audits: []
      };
    }

    const fuelWasActive =
      this.burningFuelGaugeUnits() > AURA_EPSILON;
    const burningMarkerWasActive =
      this.burningGaugeUnits() > AURA_EPSILON;
    const result = resolveBloomGauge({
      frame: input.frame,
      // The pure resolver expresses this queued gauge operation as the
      // Quicken-follow-up half of a Dendro Catalyze path. Electro Catalyze
      // performs the same Quicken/Hydro operation; the public audit below
      // retains Electro so reaction ownership remains truthful.
      triggerElement:
        input.element === "hydro" ? "hydro" : "dendro",
      incomingGauge: incomingGaugeUnits,
      gauges: {
        dendro: this.auras.get("dendro")?.gaugeUnits ?? 0,
        quicken: this.quickenGaugeUnits(),
        burningFuel: this.burningFuelGaugeUnits(),
        hydro: this.auras.get("hydro")?.gaugeUnits ?? 0
      },
      runQuickenHydroFollowup
    });

    const audits: BloomReactionAudit[] = [];
    for (const resolution of result.resolutions) {
      const quickenBefore =
        this.captureQuickenDecayState();
      const burningFuelGaugeUnitsBefore =
        this.burningFuelGaugeUnits();
      const burningFuelGeneration =
        burningMarkerWasActive &&
        (burningFuelGaugeUnitsBefore > AURA_EPSILON ||
          this.burningFuelDepletedFrame !== null)
          ? this.burningGeneration
          : null;
      const fuelDecayPerFrameBefore =
        this.auras.get("burningFuel")?.decayPerFrame ??
        this.burningFuelDepletedDecayPerFrame;
      const burningFuelExpiresAtFrameBefore =
        burningFuelGeneration === null
          ? null
          : this.burningFuelLifecycleExpiryFrame();
      const consume = (
        element:
          | "dendro"
          | "quicken"
          | "burningFuel"
          | "hydro",
        expectedGaugeUnits: number
      ): void => {
        if (expectedGaugeUnits <= AURA_EPSILON) return;
        const mutation = this.reduceAuraGauge(
          element,
          expectedGaugeUnits
        );
        if (
          Math.abs(
            mutation.consumedGaugeUnits -
              expectedGaugeUnits
          ) > AURA_EPSILON
        ) {
          throw new Error(
            `Bloom ${element} gauge drift: resolver expected ${expectedGaugeUnits}U but AuraEngine consumed ${mutation.consumedGaugeUnits}U.`
          );
        }
        auraConsumed.push({
          element,
          gaugeUnits: mutation.consumedGaugeUnits,
          ...(mutation.sourceMutations.length === 0
            ? {}
            : {
                sourceMutations: mutation.sourceMutations
              })
        });
      };

      consume(
        "dendro",
        resolution.gaugeConsumedBySlot.dendro
      );
      consume(
        "burningFuel",
        resolution.gaugeConsumedBySlot.burningFuel
      );
      if (
        fuelWasActive &&
        burningMarkerWasActive &&
        this.burningFuelGaugeUnits() <= AURA_EPSILON
      ) {
        this.burningFuelDepletedFrame = this.clockFrame();
        this.burningFuelDepletedDecayPerFrame =
          fuelDecayPerFrameBefore;
      }
      const burningFuelGaugeUnitsAfter =
        this.burningFuelGaugeUnits();
      const burningFuelConsumed =
        resolution.gaugeConsumedBySlot.burningFuel >
        AURA_EPSILON;
      const burningFuelStateMutation: BloomReactionAudit["burningFuelStateMutation"] =
        {
          operation:
            burningFuelGeneration === null ||
            !burningFuelConsumed
              ? "none"
              : burningFuelGaugeUnitsAfter >
                    AURA_EPSILON
                ? "expiry-rebase"
                : "deplete-pending-purge",
          generation: burningFuelGeneration,
          decayPerFrame:
            burningFuelGeneration === null
              ? 0
              : (fuelDecayPerFrameBefore ?? 0),
          expiresAtFrameBefore:
            burningFuelExpiresAtFrameBefore,
          expiresAtFrameAfter:
            burningFuelGeneration === null
              ? null
              : this.burningFuelLifecycleExpiryFrame()
        };
      consume(
        "quicken",
        resolution.gaugeConsumedBySlot.quicken
      );
      const quickenOperationBaseSnapshot = this.snapshot();
      consume(
        "hydro",
        resolution.gaugeConsumedBySlot.hydro
      );
      const quickenConsumed =
        resolution.gaugeConsumedBySlot.quicken >
        AURA_EPSILON;
      const quickenGaugeUnitsAfter =
        this.quickenGaugeUnits();
      let quickenAfter = this.captureQuickenDecayState();
      const lifecycleChanged =
        Math.abs(
          quickenAfter.decayPerFrame -
            quickenBefore.decayPerFrame
        ) > AURA_EPSILON ||
        quickenAfter.expiresAtFrame !==
          quickenBefore.expiresAtFrame ||
        quickenAfter.endCause !== quickenBefore.endCause;
      const quickenMutationOperation: BloomReactionAudit["quickenStateMutation"]["operation"] =
        quickenConsumed
          ? quickenGaugeUnitsAfter > AURA_EPSILON
            ? "partial-consume"
            : "remove"
          : lifecycleChanged
            ? "decay-rebase"
            : "none";
      if (quickenMutationOperation !== "none") {
        // Any Bloom Gauge or Fuel-lifetime mutation invalidates the previously
        // scheduled Quicken boundary exactly once. The simulator can then
        // schedule only QUICKEN_DECAY and leave Fuel-owned removal to Burning.
        this.quickenGeneration += 1;
        quickenAfter = this.captureQuickenDecayState();
      }
      const quickenStateMutation: BloomReactionAudit["quickenStateMutation"] =
        {
          operation: quickenMutationOperation,
          generationBefore: quickenBefore.generation,
          generationAfter: this.quickenGeneration,
          decayPerFrameBefore:
            quickenBefore.decayPerFrame,
          decayPerFrameAfter:
            quickenAfter.decayPerFrame,
          expiresAtFrameBefore:
            quickenBefore.expiresAtFrame,
          expiresAtFrameAfter:
            quickenAfter.expiresAtFrame,
          endCauseBefore: quickenBefore.endCause,
          endCauseAfter: quickenAfter.endCause,
          operationAuraBefore:
            this.snapshotWithQuickenState(
              quickenOperationBaseSnapshot,
              quickenBefore
            ),
          operationAuraAfter:
            this.snapshotWithQuickenState(
              quickenOperationBaseSnapshot,
              quickenAfter
            )
        };

      audits.push({
        reaction: "bloom",
        operation: resolution.kind,
        triggerElement:
          input.element === "hydro"
            ? "hydro"
            : input.element === "dendro"
              ? "dendro"
              : "electro",
        sourceActorId: input.sourceActorId,
        triggerFrame: input.frame,
        sourceBudget:
          resolution.driver.kind === "incoming"
            ? "incoming-application"
            : "quicken-state",
        sourceGaugeUnitsBefore:
          resolution.driver.gaugeBefore,
        sourceGaugeUnitsSpent:
          resolution.driver.consumedGauge,
        sourceGaugeUnitsAfter:
          resolution.driver.gaugeAfter,
        hydroGaugeUnitsBefore:
          resolution.gaugesBefore.hydro,
        hydroConsumedGaugeUnits:
          resolution.gaugeConsumedBySlot.hydro,
        hydroGaugeUnitsAfter:
          resolution.gaugesAfter.hydro,
        dendroGaugeUnitsBefore:
          resolution.gaugesBefore.dendro,
        dendroConsumedGaugeUnits:
          resolution.gaugeConsumedBySlot.dendro,
        dendroGaugeUnitsAfter:
          resolution.gaugesAfter.dendro,
        quickenGaugeUnitsBefore:
          resolution.gaugesBefore.quicken,
        quickenConsumedGaugeUnits:
          resolution.gaugeConsumedBySlot.quicken,
        quickenGaugeUnitsAfter:
          resolution.gaugesAfter.quicken,
        quickenStateMutation,
        burningFuelGaugeUnitsBefore:
          resolution.gaugesBefore.burningFuel,
        burningFuelConsumedGaugeUnits:
          resolution.gaugeConsumedBySlot.burningFuel,
        burningFuelGaugeUnitsAfter:
          resolution.gaugesAfter.burningFuel,
        burningFuelStateMutation,
        scheduled: true,
        coreSpawnFrame:
          input.frame + BLOOM_CORE_SPAWN_DELAY_FRAMES,
        coreSpawnDelayFrames:
          BLOOM_CORE_SPAWN_DELAY_FRAMES,
        blockedReason: null,
        mechanicsDataStatus: "fixed-gcsim-provisional",
        selfDamageStatus:
          "unsupported-player-damage-model"
      });
    }

    if (
      fuelWasActive &&
      burningMarkerWasActive &&
      this.burningFuelGaugeUnits() <= AURA_EPSILON
    ) {
      // Fixed Reactable.Tick performs the dependent Burning/Dendro/Quicken
      // purge on the next frame. Keep the marker visible to later same-frame
      // reactions and cancel this pending purge if same-frame Dendro/Pyro
      // refills Fuel.
      this.burningFuelDepletedFrame = this.clockFrame();
      this.burningFuelDepletedDecayPerFrame ??=
        BURNING_FUEL_MIN_DECAY_PER_FRAME;
    }

    return {
      remainingIncomingGaugeUnits: result.incomingGaugeAfter,
      audits
    };
  }

  processQuickenBloomFollowup(
    input: QuickenBloomFollowupInput
  ): QuickenBloomFollowupResult {
    if (!usesQueuedQuickenBloomFollowup(this.mode)) {
      throw new Error(
        "Quicken→Bloom follow-up tasks require reactionEngine.mode aura-v7 or aura-v8."
      );
    }
    this.advanceTo(input.frame);
    const auraBefore = this.snapshot();
    const electroChargedGenerationBefore = this.electroChargedGeneration;
    const electroChargedWasActive = this.electroChargedActive;
    const hydroGaugeUnitsBefore = this.auras.get("hydro")?.gaugeUnits ?? 0;
    const skipped = (
      blockedReason: ReactionTaskBlockedReason
    ): QuickenBloomFollowupResult => ({
      status: "skipped",
      blockedReason,
      auraBefore,
      auraConsumed: [],
      auraAfter: this.snapshot(),
      bloomReaction: null
    });
    if (this.mechanicsTruncation !== null) {
      return skipped("TARGET_MECHANICS_TRUNCATION");
    }
    if (this.quickenGaugeUnits() <= AURA_EPSILON) {
      return skipped("MISSING_QUICKEN");
    }
    if (
      (this.auras.get("hydro")?.gaugeUnits ?? 0) <=
      AURA_EPSILON
    ) {
      return skipped("MISSING_HYDRO");
    }

    const auraConsumed: NonNullable<
      ReactionAudit["auraConsumed"]
    > = [];
    const resolution = this.resolveBloom(
      {
        frame: input.frame,
        sourceActorId: input.sourceActorId,
        element: input.triggerElement
      },
      0,
      true,
      auraConsumed
    );
    const bloomReaction = resolution.audits[0] ?? null;
    if (
      resolution.audits.length !== 1 ||
      bloomReaction?.operation !== "quicken-followup"
    ) {
      throw new Error(
        "Quicken→Bloom follow-up passed its live Aura guards without producing exactly one follow-up audit."
      );
    }
    if (
      this.mode === "aura-v8" &&
      electroChargedWasActive &&
      electroChargedGenerationBefore === this.electroChargedGeneration &&
      hydroGaugeUnitsBefore > AURA_EPSILON &&
      (this.auras.get("hydro")?.gaugeUnits ?? 0) <= AURA_EPSILON &&
      bloomReaction.hydroConsumedGaugeUnits > AURA_EPSILON
    ) {
      this.armElectroChargedCleanup(input, auraBefore);
    }
    return {
      status: "triggered",
      blockedReason: null,
      auraBefore,
      auraConsumed,
      auraAfter: this.snapshot(),
      bloomReaction
    };
  }

  private willApply(
    frame: number,
    sourceActorId: string,
    application: ElementalApplication
  ): boolean {
    if (application.icdGroup === "no-icd") return true;
    const profile = this.icdProfiles[application.icdGroup];
    if (!profile) {
      throw new Error(
        `Unknown ICD profile "${application.icdGroup}"; declare it in reactionEngine.icdProfiles.`
      );
    }
    const key =
      application.icdGroup === "burning"
        ? "__target__\u0000burning"
        : `${sourceActorId}\u0000${application.icdTag}\u0000${application.icdGroup}`;
    const existing = this.icdStates.get(key);
    const state =
      existing === undefined ||
      frame - existing.windowStartFrame >= profile.resetFrames
        ? { windowStartFrame: frame, hitCount: 0 }
        : existing;
    const tailPolicy = profile.tailPolicy ?? "repeat";
    const applicationSequenceIndex =
      tailPolicy === "clamp"
        ? Math.min(
            state.hitCount,
            profile.applicationSequence.length - 1
          )
        : state.hitCount % profile.applicationSequence.length;
    const allowed =
      profile.applicationSequence[applicationSequenceIndex] ??
      false;
    if (application.icdGroup === "burning") {
      this.lastBurningApplicationIcdDecision = {
        windowStartFrame: state.windowStartFrame,
        hitIndex: state.hitCount,
        allowed
      };
    }
    state.hitCount += 1;
    this.icdStates.set(key, state);
    return allowed;
  }

  private processSwirl(
    input: AuraHitInput,
    application: ElementalApplication,
    auraBefore: AuraStateEntry[],
    electroChargedWasActive: boolean
  ): ReactionAudit {
    let remainingSourceGaugeUnits = application.gaugeUnits;
    const auraApplied: NonNullable<ReactionAudit["auraApplied"]> = [
      {
        element: "anemo",
        gaugeUnits: application.gaugeUnits,
        ...(usesAuraV3Durability(this.mode)
          ? { sourceActorId: input.sourceActorId }
          : {})
      }
    ];
    const auraConsumed: NonNullable<ReactionAudit["auraConsumed"]> = [];
    const swirlReactions: SwirlReactionAudit[] = [];
    let frozenReaction: ReactionAudit["frozenReaction"] = null;
    const burningBeforeReaction = this.captureBurningState();

    const trySwirl = (
      consumedAuraElement: AuraStateElement,
      swirledElement: AuraElement,
      reaction: SwirlReaction
    ): boolean => {
      if (remainingSourceGaugeUnits <= AURA_EPSILON) return false;
      // Fixed gcsim only enters TrySwirlPyro when ordinary Pyro is
      // present. Once entered, reduceMappedAuraGauge still consumes the
      // ordinary Pyro and Burning marker together.
      if (
        consumedAuraElement === "pyro" &&
        (this.auras.get("pyro")?.gaugeUnits ?? 0) <= AURA_EPSILON
      ) {
        return false;
      }
      const auraGaugeUnitsBefore =
        this.mappedAuraGaugeUnits(consumedAuraElement);
      if (auraGaugeUnitsBefore <= AURA_EPSILON) {
        return false;
      }
      const auditConsumedAuraElement =
        consumedAuraElement === "pyro" &&
        (this.auras.get("pyro")?.gaugeUnits ?? 0) <=
          AURA_EPSILON &&
        this.burningGaugeUnits() > AURA_EPSILON
          ? ("burning" as const)
          : consumedAuraElement;

      const sourceGaugeUnitsBefore = remainingSourceGaugeUnits;
      const auraConsumedGaugeUnits = Math.min(
        auraGaugeUnitsBefore,
        sourceGaugeUnitsBefore * SWIRL_AURA_CONSUMPTION_FACTOR
      );
      const sourceGaugeUnitsSpent =
        auraConsumedGaugeUnits / SWIRL_AURA_CONSUMPTION_FACTOR;
      remainingSourceGaugeUnits = cleanGaugeUnits(
        Math.max(0, remainingSourceGaugeUnits - sourceGaugeUnitsSpent)
      );
      const mutations = this.reduceMappedAuraGauge(
        consumedAuraElement,
        auraConsumedGaugeUnits
      );
      for (const mutation of mutations) {
        auraConsumed.push({
          element: mutation.element,
          gaugeUnits: mutation.consumedGaugeUnits,
          ...(mutation.sourceMutations.length === 0
            ? {}
            : {
                sourceMutations: mutation.sourceMutations
              })
        });
      }

      // Exact U-space conversion of fixed gcsim's internal durability formula:
      // 1.25 * (0.5 * consumed - 1) + 25, or
      // 1.25 * (source - 1) + 25 when all source durability is spent.
      const propagatedGaugeUnits =
        sourceGaugeUnitsSpent + AURA_EPSILON < sourceGaugeUnitsBefore
          ? 0.625 * sourceGaugeUnitsSpent + 0.95
          : 1.25 * sourceGaugeUnitsBefore + 0.95;
      const previousReadyFrame =
        this.swirlDamageReadyFrames.get(reaction) ?? -1;
      const scheduled =
        previousReadyFrame < 0 || input.frame >= previousReadyFrame;
      const nextAvailableFrame = scheduled
        ? input.frame + SWIRL_QUEUE_GCD_FRAMES
        : previousReadyFrame;
      if (scheduled) {
        this.swirlDamageReadyFrames.set(reaction, nextAvailableFrame);
      }

      if (auditConsumedAuraElement === "frozen") {
        const frozenGaugeAfter = this.frozenGaugeUnits();
        this.frozenGeneration += 1;
        frozenReaction = {
          generation: this.frozenGeneration,
          operation: "consume",
          freezeResistance: this.freezeResistance,
          generatedGaugeUnits: 0,
          consumedGaugeUnits: cleanGaugeUnits(
            auraConsumedGaugeUnits
          ),
          frozenGaugeBefore: cleanGaugeUnits(
            auraGaugeUnitsBefore
          ),
          frozenGaugeAfter: cleanGaugeUnits(frozenGaugeAfter),
          decayRatePerFrame: this.frozenDecayRate,
          expiresAtFrame: this.frozenExpiryFrame()
        };
      }

      swirlReactions.push({
        reaction,
        swirledElement,
        consumedAuraElement: auditConsumedAuraElement,
        sourceGaugeUnitsBefore: cleanGaugeUnits(
          sourceGaugeUnitsBefore
        ),
        sourceGaugeUnitsSpent: cleanGaugeUnits(
          sourceGaugeUnitsSpent
        ),
        sourceGaugeUnitsAfter: cleanGaugeUnits(
          remainingSourceGaugeUnits
        ),
        auraGaugeUnitsBefore: cleanGaugeUnits(
          auraGaugeUnitsBefore
        ),
        auraConsumedGaugeUnits: cleanGaugeUnits(
          auraConsumedGaugeUnits
        ),
        auraGaugeUnitsAfter: cleanGaugeUnits(
          this.mappedAuraGaugeUnits(consumedAuraElement)
        ),
        propagatedGaugeUnits: cleanGaugeUnits(
          propagatedGaugeUnits
        ),
        scheduled,
        blockedReason: scheduled ? null : "REACTION_QUEUE_GCD",
        nextAvailableFrame,
        selfDamageFrame:
          input.frame + SWIRL_SELF_DAMAGE_DELAY_FRAMES,
        propagationDamageFrame:
          input.frame + SWIRL_PROPAGATION_DELAY_FRAMES,
        selfBaseMultiplier: SWIRL_BASE_MULTIPLIER,
        propagationBaseMultiplier:
          swirledElement === "hydro" ? 0 : SWIRL_BASE_MULTIPLIER,
        radius: SWIRL_RADIUS
      });
      return true;
    };

    const swirledElectro = trySwirl(
      "electro",
      "electro",
      "swirlElectro"
    );
    // Fixed gcsim recursively checks Hydro immediately after Electro in an
    // Electro-Charged coexistence, then performs the regular Hydro check later.
    if (swirledElectro && remainingSourceGaugeUnits > AURA_EPSILON) {
      trySwirl("hydro", "hydro", "swirlHydro");
    }
    trySwirl("pyro", "pyro", "swirlPyro");
    trySwirl("hydro", "hydro", "swirlHydro");
    trySwirl("cryo", "cryo", "swirlCryo");
    trySwirl("frozen", "cryo", "swirlCryo");

    let periodicReaction: ReactionAudit["periodicReaction"] = null;
    if (
      electroChargedWasActive &&
      !this.hasElectroChargedAuras() &&
      !this.shouldDeferElectroChargedMissingAuraCleanup()
    ) {
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
      periodicReaction = {
        reaction: "electroCharged",
        generation: this.electroChargedGeneration,
        operation: "stop",
        damageElement: "electro",
        baseMultiplier: ELECTRO_CHARGED_BASE_MULTIPLIER,
        firstDamageFrame: null,
        nextTickFrame: null,
        tickIntervalFrames:
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
        waneDelayFrames: ELECTRO_CHARGED_WANE_DELAY_FRAMES,
        waneGaugeUnits: ELECTRO_CHARGED_WANE_GAUGE_UNITS,
        coexistenceExpiresAtFrame: null
      };
    }

    const firstSwirl = swirlReactions[0] ?? null;
    return {
      model: "aura-engine",
      triggered: firstSwirl !== null,
      reaction: firstSwirl?.reaction ?? "none",
      reactions: swirlReactions.map((entry) => entry.reaction),
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      icdTag: application.icdTag,
      icdGroup: application.icdGroup,
      applicationGaugeUnits: application.gaugeUnits,
      auraBefore,
      auraApplied,
      auraConsumed,
      auraAfter: this.snapshot(),
      transformativeReaction: null,
      periodicReaction,
      frozenReaction,
      shatterReaction: null,
      swirlReactions,
      swirlDamageGroup: null,
      crystallizeReaction: null,
      catalyzeReaction: null,
      burningReaction:
        burningBeforeReaction !== null &&
        this.lastBurningStop?.fromGeneration ===
          burningBeforeReaction.generation &&
        this.lastBurningStop.frame === input.frame &&
        this.lastBurningStop.reason ===
          "BURNING_AURA_CONSUMED"
          ? this.makeBurningStopAudit(
              input,
              burningBeforeReaction
            )
          : null,
      bloomReactions: [],
      note:
        firstSwirl === null
          ? "风元素附着通过 ICD；当前没有可扩散的火/水/冰/雷/冻元素 Aura。"
          : `${swirlReactions.length} 次扩散判定消耗了 Aura；仅通过各元素 6 帧队列 GCD 的判定会排入 1f 自身伤害与 5f 传播攻击。`
    };
  }

  private processCrystallize(
    input: AuraHitInput,
    application: ElementalApplication,
    auraBefore: AuraStateEntry[],
    electroChargedWasActive: boolean
  ): ReactionAudit {
    const candidates: Array<{
      consumedAuraElement: AuraStateElement;
      crystallizedElement: AuraElement;
      reaction: CrystallizeReaction;
    }> = [
      {
        consumedAuraElement: "electro",
        crystallizedElement: "electro",
        reaction: "crystallizeElectro"
      },
      {
        consumedAuraElement: "hydro",
        crystallizedElement: "hydro",
        reaction: "crystallizeHydro"
      },
      {
        consumedAuraElement: "cryo",
        crystallizedElement: "cryo",
        reaction: "crystallizeCryo"
      },
      {
        consumedAuraElement: "pyro",
        crystallizedElement: "pyro",
        reaction: "crystallizePyro"
      },
      {
        consumedAuraElement: "frozen",
        crystallizedElement: "cryo",
        reaction: "crystallizeCryo"
      }
    ];
    const candidate = candidates.find(
      ({ consumedAuraElement }) =>
        this.mappedAuraGaugeUnits(consumedAuraElement) >
        AURA_EPSILON
    );
    const auraApplied: NonNullable<ReactionAudit["auraApplied"]> = [
      {
        element: "geo",
        gaugeUnits: application.gaugeUnits,
        ...(usesAuraV3Durability(this.mode)
          ? { sourceActorId: input.sourceActorId }
          : {})
      }
    ];
    if (candidate === undefined) {
      return {
        model: "aura-engine",
        triggered: false,
        reaction: "none",
        reactions: [],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        icdAllowed: true,
        icdTag: application.icdTag,
        icdGroup: application.icdGroup,
        applicationGaugeUnits: application.gaugeUnits,
        auraBefore,
        auraApplied,
        auraConsumed: [],
        auraAfter: this.snapshot(),
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
          "岩元素附着通过 ICD；当前没有可结晶的火/水/冰/雷/冻元素 Aura。"
      };
    }

    const sourceGaugeUnitsBefore = application.gaugeUnits;
    const auditConsumedAuraElement =
      candidate.consumedAuraElement === "pyro" &&
      (this.auras.get("pyro")?.gaugeUnits ?? 0) <=
        AURA_EPSILON &&
      this.burningGaugeUnits() > AURA_EPSILON
        ? ("burning" as const)
        : candidate.consumedAuraElement;
    const auraGaugeUnitsBefore = this.mappedAuraGaugeUnits(
      candidate.consumedAuraElement
    );
    const burningBeforeReaction = this.captureBurningState();
    const scheduled =
      this.crystallizeReadyFrame < 0 ||
      input.frame >= this.crystallizeReadyFrame;
    const nextAvailableFrame = scheduled
      ? input.frame + CRYSTALLIZE_QUEUE_GCD_FRAMES
      : this.crystallizeReadyFrame;
    let sourceGaugeUnitsSpent = 0;
    let auraConsumedGaugeUnits = 0;
    let auraSourceMutations: AuraSourceGaugeMutation[] = [];
    let mappedAuraMutations: Array<{
      element: AuraStateElement;
      consumedGaugeUnits: number;
      sourceMutations: AuraSourceGaugeMutation[];
    }> = [];
    let frozenReaction: ReactionAudit["frozenReaction"] = null;
    let periodicReaction: ReactionAudit["periodicReaction"] = null;

    if (scheduled) {
      this.crystallizeReadyFrame = nextAvailableFrame;
      auraConsumedGaugeUnits = Math.min(
        auraGaugeUnitsBefore,
        sourceGaugeUnitsBefore *
          CRYSTALLIZE_AURA_CONSUMPTION_FACTOR
      );
      sourceGaugeUnitsSpent =
        auraConsumedGaugeUnits /
        CRYSTALLIZE_AURA_CONSUMPTION_FACTOR;
      mappedAuraMutations = this.reduceMappedAuraGauge(
        candidate.consumedAuraElement,
        auraConsumedGaugeUnits
      );
      auraConsumedGaugeUnits = Math.max(
        0,
        ...mappedAuraMutations.map(
          (mutation) => mutation.consumedGaugeUnits
        )
      );
      auraSourceMutations =
        mappedAuraMutations.find(
          (mutation) =>
            mutation.element === auditConsumedAuraElement
        )?.sourceMutations ?? [];

      if (candidate.consumedAuraElement === "frozen") {
        const frozenGaugeAfter = this.frozenGaugeUnits();
        this.frozenGeneration += 1;
        frozenReaction = {
          generation: this.frozenGeneration,
          operation: "consume",
          freezeResistance: this.freezeResistance,
          generatedGaugeUnits: 0,
          consumedGaugeUnits: cleanGaugeUnits(
            auraConsumedGaugeUnits
          ),
          frozenGaugeBefore: cleanGaugeUnits(
            auraGaugeUnitsBefore
          ),
          frozenGaugeAfter: cleanGaugeUnits(frozenGaugeAfter),
          decayRatePerFrame: this.frozenDecayRate,
          expiresAtFrame: this.frozenExpiryFrame()
        };
      }
      if (
        electroChargedWasActive &&
        !this.hasElectroChargedAuras() &&
        !this.shouldDeferElectroChargedMissingAuraCleanup()
      ) {
        this.electroChargedActive = false;
        this.electroChargedNextTickFrame = -1;
        periodicReaction = {
          reaction: "electroCharged",
          generation: this.electroChargedGeneration,
          operation: "stop",
          damageElement: "electro",
          baseMultiplier: ELECTRO_CHARGED_BASE_MULTIPLIER,
          firstDamageFrame: null,
          nextTickFrame: null,
          tickIntervalFrames:
            ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
          waneDelayFrames: ELECTRO_CHARGED_WANE_DELAY_FRAMES,
          waneGaugeUnits: ELECTRO_CHARGED_WANE_GAUGE_UNITS,
          coexistenceExpiresAtFrame: null
        };
      }
    }

    const crystallizeReaction: CrystallizeReactionAudit = {
      reaction: candidate.reaction,
      crystallizedElement: candidate.crystallizedElement,
      consumedAuraElement: auditConsumedAuraElement,
      sourceGaugeUnitsBefore: cleanGaugeUnits(
        sourceGaugeUnitsBefore
      ),
      sourceGaugeUnitsSpent: cleanGaugeUnits(
        sourceGaugeUnitsSpent
      ),
      sourceGaugeUnitsAfter: cleanGaugeUnits(
        sourceGaugeUnitsBefore - sourceGaugeUnitsSpent
      ),
      auraGaugeUnitsBefore: cleanGaugeUnits(auraGaugeUnitsBefore),
      auraConsumedGaugeUnits: cleanGaugeUnits(
        auraConsumedGaugeUnits
      ),
      auraGaugeUnitsAfter: cleanGaugeUnits(
        this.mappedAuraGaugeUnits(candidate.consumedAuraElement)
      ),
      scheduled,
      blockedReason: scheduled ? null : "REACTION_QUEUE_GCD",
      nextAvailableFrame,
      shardSpawnFrame:
        input.frame + CRYSTALLIZE_SHARD_SPAWN_DELAY_FRAMES,
      earliestPickupFrame:
        input.frame + CRYSTALLIZE_EARLIEST_PICKUP_DELAY_FRAMES,
      shardExpiresAtFrame:
        input.frame +
        CRYSTALLIZE_SHARD_SPAWN_DELAY_FRAMES +
        CRYSTALLIZE_SHARD_DURATION_FRAMES,
      shardDurationFrames: CRYSTALLIZE_SHARD_DURATION_FRAMES,
      maxActiveShards: CRYSTALLIZE_MAX_ACTIVE_SHARDS
    };
    return {
      model: "aura-engine",
      triggered: scheduled,
      reaction: scheduled ? candidate.reaction : "none",
      reactions: scheduled ? [candidate.reaction] : [],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      icdTag: application.icdTag,
      icdGroup: application.icdGroup,
      applicationGaugeUnits: application.gaugeUnits,
      auraBefore,
      auraApplied,
      auraConsumed: scheduled
        ? mappedAuraMutations.map((mutation) => ({
            element: mutation.element,
            gaugeUnits: cleanGaugeUnits(
              mutation.consumedGaugeUnits
            ),
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          }))
        : [],
      auraAfter: this.snapshot(),
      transformativeReaction: null,
      periodicReaction,
      frozenReaction,
      shatterReaction: null,
      swirlReactions: [],
      swirlDamageGroup: null,
      crystallizeReaction,
      catalyzeReaction: null,
      burningReaction:
        burningBeforeReaction !== null &&
        this.lastBurningStop?.fromGeneration ===
          burningBeforeReaction.generation &&
        this.lastBurningStop.frame === input.frame &&
        this.lastBurningStop.reason ===
          "BURNING_AURA_CONSUMED"
          ? this.makeBurningStopAudit(
              input,
              burningBeforeReaction
            )
          : null,
      bloomReactions: [],
      note: scheduled
        ? `${candidate.crystallizedElement}结晶通过目标本地 60 帧共享队列；23 帧后生成碎片，触发后第 54 帧起可拾取。`
        : `${candidate.crystallizedElement}结晶被目标本地共享队列阻止；Aura 与岩元素预算均未消耗，第 ${nextAvailableFrame} 帧可再次触发。`
    };
  }

  processHit(input: AuraHitInput): ReactionAudit {
    this.advanceTo(input.frame);
    const auraBefore = this.snapshot();
    if (this.mechanicsTruncation !== null) {
      const mechanicsTruncation =
        this.carriedMechanicsTruncation();
      return {
        model: "aura-engine",
        triggered: false,
        reaction: "none",
        reactions: [],
        unsupportedReactions: [
          ...mechanicsTruncation.unsupportedReactions
        ],
        mechanicsTruncation,
        icdAllowed: null,
        icdTag: input.application?.icdTag ?? null,
        icdGroup: input.application?.icdGroup ?? null,
        applicationGaugeUnits:
          input.application?.gaugeUnits ?? null,
        auraBefore,
        auraApplied: [],
        auraConsumed: [],
        auraAfter: [],
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
        note: `目标已于第 ${mechanicsTruncation.startedAtFrame} 帧进入机制截断；后续 Aura、ICD 与反应均冻结，本事件仅保留非反应伤害的潜在值。`
      };
    }
    const electroChargedWasActive =
      this.electroChargedActive;
    const application = input.application;

    if (
      !application ||
      !isAuraApplicationElement(input.element, this.mode)
    ) {
      const override =
        this.debugAllowReactionOverride &&
        input.reactionOverride !== undefined &&
        input.reactionOverride !== "none"
          ? input.reactionOverride
          : "none";
      return {
        model: override === "none" ? "aura-engine" : "manual-override",
        triggered: override !== "none",
        reaction: override,
        reactions: override === "none" ? [] : [override],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        icdAllowed: null,
        icdTag: null,
        icdGroup: null,
        applicationGaugeUnits: null,
        auraBefore,
        auraApplied: [],
        auraConsumed: [],
        auraAfter: this.snapshot(),
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
          override === "none"
            ? "该命中未配置元素附着；Aura 状态未改变。"
            : "调试模式 reactionOverride 覆盖了自动反应结果。"
      };
    }

    const icdAllowed = this.willApply(
      input.frame,
      input.sourceActorId,
      application
    );
    if (!icdAllowed) {
      return {
        model: "aura-engine",
        triggered: false,
        reaction: "none",
        reactions: [],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        icdAllowed,
        icdTag: application.icdTag,
        icdGroup: application.icdGroup,
        applicationGaugeUnits: application.gaugeUnits,
        auraBefore,
        auraApplied: [],
        auraConsumed: [],
        auraAfter: this.snapshot(),
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
        note: `ICD Profile "${application.icdGroup}" 阻止本段附着与反应。`
      };
    }

    const debugOverride =
      this.debugAllowReactionOverride &&
      input.reactionOverride !== undefined &&
      input.reactionOverride !== "none"
        ? input.reactionOverride
        : null;
    if (debugOverride !== null) {
      return {
        model: "manual-override",
        triggered: true,
        reaction: debugOverride,
        reactions: [debugOverride],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        icdAllowed,
        icdTag: application.icdTag,
        icdGroup: application.icdGroup,
        applicationGaugeUnits: application.gaugeUnits,
        auraBefore,
        auraApplied: [],
        auraConsumed: [],
        auraAfter: this.snapshot(),
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
          "调试模式 reactionOverride 绕过自动反应并保持 Aura 不变。"
      };
    }

    if (input.element === "anemo") {
      return this.processSwirl(
        input,
        application,
        auraBefore,
        electroChargedWasActive
      );
    }
    if (input.element === "geo") {
      return this.processCrystallize(
        input,
        application,
        auraBefore,
        electroChargedWasActive
      );
    }

    const dendroLikeBefore = auraBefore.some(
      (entry) =>
        (entry.element === "dendro" ||
          entry.element === "quicken") &&
        entry.gaugeUnits > AURA_EPSILON
    );
    const unsupportedReactions: ReactionAudit["unsupportedReactions"] =
      [];
    if (this.mode === "aura-v3") {
      const hydroAuraPresent = auraBefore.some(
        (entry) =>
          entry.element === "hydro" &&
          entry.gaugeUnits > AURA_EPSILON
      );
      const pyroAuraPresent = auraBefore.some(
        (entry) =>
          entry.element === "pyro" &&
          entry.gaugeUnits > AURA_EPSILON
      );
      if (input.element === "pyro" && dendroLikeBefore) {
        unsupportedReactions.push("burning");
      } else if (
        input.element === "hydro" &&
        dendroLikeBefore
      ) {
        unsupportedReactions.push("bloom");
      } else if (input.element === "dendro") {
        // Fixed gcsim order for Dendro is Spread → Quicken → Burning
        // → Bloom. Fail closed at the first unsupported branch; after that
        // boundary, a later branch is not observable or auditable truth.
        if (pyroAuraPresent) {
          unsupportedReactions.push("burning");
        } else if (hydroAuraPresent) {
          unsupportedReactions.push("bloom");
        }
      }
    }

    const quickenBefore = this.quickenGaugeUnits();
    const additiveReaction: AdditiveReactionAudit | null =
      usesAuraV3Durability(this.mode) &&
      quickenBefore > AURA_EPSILON &&
      (input.element === "electro" ||
        input.element === "dendro")
        ? {
            reaction:
              input.element === "electro"
                ? "aggravate"
                : "spread",
            triggerElement: input.element,
            quickenGaugeUnitsBefore: cleanGaugeUnits(
              quickenBefore
            ),
            quickenGaugeUnitsAfter: cleanGaugeUnits(
              quickenBefore
            ),
            consumedQuickenGaugeUnits: 0
          }
        : null;
    let catalyzeReaction: CatalyzeReactionAudit | null =
      additiveReaction === null
        ? null
        : {
            quicken: null,
            additive: additiveReaction
          };
    const auraApplied = [
      {
        element: input.element,
        gaugeUnits: application.gaugeUnits,
        ...(usesAuraV3Durability(this.mode)
          ? { sourceActorId: input.sourceActorId }
          : {})
      }
    ];
    const frozenPresent =
      this.frozenGaugeUnits() > AURA_EPSILON;
    const frozenMelt =
      this.mode !== "aura-v1" &&
      input.element === "pyro" &&
      frozenPresent &&
      (this.auras.get("electro")?.gaugeUnits ?? 0) <=
        AURA_EPSILON;
    const frozenSuperconduct =
      this.mode !== "aura-v1" &&
      input.element === "electro" &&
      frozenPresent &&
      this.mappedAuraGaugeUnits("pyro") <=
        AURA_EPSILON;
    const usesOrderedPyroPipeline =
      usesBurningModel(this.mode) &&
      input.element === "pyro";
    const usesOrderedHydroPipeline =
      usesBloomModel(this.mode) && input.element === "hydro";
    const usesOrderedCryoPipeline =
      usesBloomModel(this.mode) && input.element === "cryo";
    const usesOrderedElectroPipeline =
      (this.mode === "aura-v6" ||
        this.mode === "aura-v7" ||
        this.mode === "aura-v8") &&
      input.element === "electro";
    const usesElectroHydroDendroPipeline =
      this.mode === "aura-v5" &&
      input.element === "electro" &&
      (this.auras.get("hydro")?.gaugeUnits ?? 0) >
        AURA_EPSILON &&
      (this.auras.get("dendro")?.gaugeUnits ?? 0) >
        AURA_EPSILON &&
      this.mappedAuraGaugeUnits("pyro") <= AURA_EPSILON &&
      (this.auras.get("cryo")?.gaugeUnits ?? 0) <=
        AURA_EPSILON &&
      this.frozenGaugeUnits() <= AURA_EPSILON;
    let remainingPyroGaugeUnits = application.gaugeUnits;
    let remainingHydroGaugeUnits = application.gaugeUnits;
    let remainingCryoGaugeUnits = application.gaugeUnits;
    let remainingDendroGaugeUnits = application.gaugeUnits;
    let remainingElectroGaugeUnits = application.gaugeUnits;
    const orderedPyroReactions: ReactionType[] = [];
    const orderedHydroReactions: ReactionType[] = [];
    const orderedCryoReactions: ReactionType[] = [];
    const orderedElectroReactions: ReactionType[] = [];
    let orderedPyroTransformativeReaction:
      | OneShotTransformativeReaction
      | null = null;
    let orderedPyroAmplifyingReaction:
      | AmplifyingReaction
      | null = null;
    let orderedHydroAmplifyingReaction:
      | AmplifyingReaction
      | null = null;
    let orderedCryoTransformativeReaction:
      | OneShotTransformativeReaction
      | null = null;
    let orderedCryoAmplifyingReaction:
      | AmplifyingReaction
      | null = null;
    const orderedElectroTransformativeReactions:
      OneShotTransformativeReaction[] = [];
    const eligibleRules =
      frozenMelt ||
      frozenSuperconduct ||
      input.element === "dendro" ||
      usesOrderedPyroPipeline ||
      usesOrderedHydroPipeline ||
      usesOrderedCryoPipeline ||
      usesOrderedElectroPipeline
        ? []
        : REACTION_RULES[input.element].filter(
          (candidate) =>
            (this.mode !== "aura-v1" ||
              !requiresAuraV2(candidate.reaction)) &&
            !(
              frozenPresent &&
              (candidate.reaction === "electroCharged" ||
                candidate.reaction === "reverseVaporize" ||
                (input.element === "cryo" &&
                  candidate.reaction === "superconduct"))
            ) &&
            !(
              input.element === "hydro" &&
              candidate.reaction === "electroCharged" &&
              unsupportedReactions.includes("bloom")
            ) &&
            this.mappedAuraGaugeUnits(candidate.auraElement) >
              AURA_EPSILON
          );
    const rule = eligibleRules[0];
    const quickenConsumedAuraElement =
      usesAuraV3Durability(this.mode) && input.element === "dendro"
        ? "electro"
        : usesAuraV3Durability(this.mode) &&
            input.element === "electro"
          ? "dendro"
          : null;
    // v2/v3 historically execute only eligibleRules[0]. If the remaining
    // incoming budget can reach another consuming branch, preserve that
    // compatibility result but fail closed instead of claiming completeness.
    if (
      (this.mode === "aura-v2" ||
        this.mode === "aura-v3") &&
      input.element !== "dendro"
    ) {
      const legacyReactionCandidates: readonly ReactionRule[] =
        frozenMelt
          ? [
              {
                auraElement: "cryo",
                reaction: "melt",
                consumptionFactor: 2
              }
            ]
          : frozenSuperconduct
            ? [
                {
                  auraElement: "cryo",
                  reaction: "superconduct",
                  consumptionFactor: 1
                }
              ]
            : eligibleRules;
      let remainingGaugeUnits = application.gaugeUnits;
      let reachableConsumingReactionCount = 0;
      for (const candidate of legacyReactionCandidates) {
        if (remainingGaugeUnits <= AURA_EPSILON) break;
        if (candidate.consumptionFactor <= 0) continue;
        const consumedGaugeUnits = Math.min(
          this.mappedAuraGaugeUnits(candidate.auraElement),
          remainingGaugeUnits * candidate.consumptionFactor
        );
        if (consumedGaugeUnits <= AURA_EPSILON) continue;
        reachableConsumingReactionCount += 1;
        remainingGaugeUnits = cleanGaugeUnits(
          Math.max(
            0,
            remainingGaugeUnits -
              consumedGaugeUnits / candidate.consumptionFactor
          )
        );
      }
      if (
        this.mode === "aura-v3" &&
        input.element === "electro" &&
        remainingGaugeUnits > AURA_EPSILON &&
        (this.auras.get("dendro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        reachableConsumingReactionCount += 1;
      }
      if (
        reachableConsumingReactionCount > 1 &&
        !unsupportedReactions.includes(
          "legacy-multi-reaction-order"
        )
      ) {
        unsupportedReactions.push(
          "legacy-multi-reaction-order"
        );
      }
    }
    if (
      (this.mode === "aura-v4" ||
        this.mode === "aura-v5") &&
      !usesOrderedPyroPipeline &&
      !usesOrderedHydroPipeline &&
      !usesOrderedCryoPipeline &&
      !usesElectroHydroDendroPipeline &&
      (input.element === "cryo" ||
        input.element === "hydro" ||
        input.element === "electro")
    ) {
      let remainingGaugeUnits = application.gaugeUnits;
      let reachableReactionCount = 0;
      for (const candidate of eligibleRules) {
        if (remainingGaugeUnits <= AURA_EPSILON) break;
        reachableReactionCount += 1;
        if (candidate.consumptionFactor <= 0) continue;
        const consumedGaugeUnits = Math.min(
          this.mappedAuraGaugeUnits(candidate.auraElement),
          remainingGaugeUnits * candidate.consumptionFactor
        );
        remainingGaugeUnits = cleanGaugeUnits(
          Math.max(
            0,
            remainingGaugeUnits -
              consumedGaugeUnits / candidate.consumptionFactor
          )
        );
      }
      if (
        input.element === "electro" &&
        remainingGaugeUnits > AURA_EPSILON &&
        (this.auras.get("dendro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        reachableReactionCount += 1;
      }
      if (reachableReactionCount > 1) {
        unsupportedReactions.push(
          "non-pyro-multi-reaction-order"
        );
      }
    }
    let automaticReaction: ReactionType = "none";
    const auraConsumed: NonNullable<
      ReactionAudit["auraConsumed"]
    > = [];
    const burningBeforeReaction = this.captureBurningState();
    let burningReaction: BurningReactionAudit | null = null;
    let bloomReactions: BloomReactionAudit[] = [];

    let periodicReaction: ReactionAudit["periodicReaction"] = null;
    let frozenReaction: ReactionAudit["frozenReaction"] = null;
    if (usesOrderedPyroPipeline) {
      const consumeMappedAura = (
        element: AuraStateElement,
        consumptionFactor: number
      ): number => {
        if (
          remainingPyroGaugeUnits <= AURA_EPSILON ||
          this.mappedAuraGaugeUnits(element) <= AURA_EPSILON
        ) {
          return 0;
        }
        const mutations = this.reduceMappedAuraGauge(
          element,
          remainingPyroGaugeUnits * consumptionFactor
        );
        let maximumConsumedGaugeUnits = 0;
        for (const mutation of mutations) {
          maximumConsumedGaugeUnits = Math.max(
            maximumConsumedGaugeUnits,
            mutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: mutation.element,
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
        }
        remainingPyroGaugeUnits = cleanGaugeUnits(
          Math.max(
            0,
            remainingPyroGaugeUnits -
              maximumConsumedGaugeUnits / consumptionFactor
          )
        );
        return maximumConsumedGaugeUnits;
      };

      if (consumeMappedAura("electro", 1) > AURA_EPSILON) {
        orderedPyroReactions.push("overload");
        orderedPyroTransformativeReaction = "overload";
      }

      if (
        this.frozenGaugeUnits() <= AURA_EPSILON &&
        consumeMappedAura("hydro", 0.5) > AURA_EPSILON
      ) {
        orderedPyroReactions.push("reverseVaporize");
        orderedPyroAmplifyingReaction = "reverseVaporize";
      }

      if (remainingPyroGaugeUnits > AURA_EPSILON) {
        const frozenGaugeUnitsBefore = this.frozenGaugeUnits();
        const cryoMutations = this.reduceMappedAuraGauge(
          "cryo",
          remainingPyroGaugeUnits * 2
        );
        let maximumMeltConsumedGaugeUnits = 0;
        for (const mutation of cryoMutations) {
          maximumMeltConsumedGaugeUnits = Math.max(
            maximumMeltConsumedGaugeUnits,
            mutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: mutation.element,
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
        }
        const frozenMutation = this.reduceAuraGauge(
          "frozen",
          remainingPyroGaugeUnits * 2
        );
        if (frozenMutation.consumedGaugeUnits > AURA_EPSILON) {
          maximumMeltConsumedGaugeUnits = Math.max(
            maximumMeltConsumedGaugeUnits,
            frozenMutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: "frozen",
            gaugeUnits: frozenMutation.consumedGaugeUnits
          });
          this.frozenGeneration += 1;
          frozenReaction = {
            generation: this.frozenGeneration,
            operation: "consume",
            freezeResistance: this.freezeResistance,
            generatedGaugeUnits: 0,
            consumedGaugeUnits:
              frozenMutation.consumedGaugeUnits,
            frozenGaugeBefore: cleanGaugeUnits(
              frozenGaugeUnitsBefore
            ),
            frozenGaugeAfter: cleanGaugeUnits(
              this.frozenGaugeUnits()
            ),
            decayRatePerFrame: this.frozenDecayRate,
            expiresAtFrame: this.frozenExpiryFrame()
          };
        }
        if (maximumMeltConsumedGaugeUnits > AURA_EPSILON) {
          remainingPyroGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingPyroGaugeUnits -
                maximumMeltConsumedGaugeUnits / 2
            )
          );
          orderedPyroReactions.push("melt");
          orderedPyroAmplifyingReaction = "melt";
        }
      }

      automaticReaction =
        orderedPyroAmplifyingReaction ??
        orderedPyroTransformativeReaction ??
        "none";
      if (
        orderedPyroReactions.length === 0 &&
        unsupportedReactions.length === 0
      ) {
        this.attachNormalAura(
          input.element,
          application.gaugeUnits,
          input.sourceActorId
        );
      }
    } else if (usesOrderedCryoPipeline) {
      const consumeMappedAura = (
        element: AuraStateElement,
        consumptionFactor: number,
        spendsIncomingGauge = true
      ): number => {
        if (
          remainingCryoGaugeUnits <= AURA_EPSILON ||
          this.mappedAuraGaugeUnits(element) <= AURA_EPSILON
        ) {
          return 0;
        }
        const mutations = this.reduceMappedAuraGauge(
          element,
          remainingCryoGaugeUnits * consumptionFactor
        );
        let maximumConsumedGaugeUnits = 0;
        for (const mutation of mutations) {
          maximumConsumedGaugeUnits = Math.max(
            maximumConsumedGaugeUnits,
            mutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: mutation.element,
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
        }
        if (spendsIncomingGauge) {
          remainingCryoGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingCryoGaugeUnits -
                maximumConsumedGaugeUnits /
                  consumptionFactor
            )
          );
        }
        return maximumConsumedGaugeUnits;
      };

      // Fixed gcsim Cryo order: Superconduct → Melt → Freeze. Preserve one
      // shared incoming Gauge budget so a strong Cryo application can consume
      // Electro first and still reach Hydro later in the same hit.
      if (
        !frozenPresent &&
        consumeMappedAura("electro", 1) > AURA_EPSILON
      ) {
        orderedCryoReactions.push("superconduct");
        orderedCryoTransformativeReaction = "superconduct";
      }

      // The fixed gcsim reference-code path (not asserted here as verified
      // live-game truth) reduces Pyro in TryMelt but does not subtract its
      // return value from incoming Cryo durability. Preserve that observable
      // behavior so the same post-Superconduct budget reaches TryFreeze.
      if (
        consumeMappedAura("pyro", 0.5, false) >
        AURA_EPSILON
      ) {
        orderedCryoReactions.push("reverseMelt");
        orderedCryoAmplifyingReaction = "reverseMelt";
      }

      if (
        remainingCryoGaugeUnits > AURA_EPSILON &&
        (this.auras.get("hydro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        const mutation = this.reduceAuraGauge(
          "hydro",
          remainingCryoGaugeUnits
        );
        if (mutation.consumedGaugeUnits > AURA_EPSILON) {
          // That reference TryFreeze Cryo branch likewise consumes Hydro and
          // creates Frozen without subtracting the consumed value from incoming
          // Cryo. The hit has reacted, so any residue is not attached afterward.
          auraConsumed.push({
            element: "hydro",
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
          const frozenBefore = this.frozenGaugeUnits();
          const frozenAttachment = this.attachFrozen(
            2 * mutation.consumedGaugeUnits
          );
          frozenReaction = {
            generation: this.frozenGeneration,
            operation: frozenAttachment.operation,
            freezeResistance: this.freezeResistance,
            generatedGaugeUnits: cleanGaugeUnits(
              frozenAttachment.generatedGaugeUnits
            ),
            consumedGaugeUnits: 0,
            frozenGaugeBefore: cleanGaugeUnits(frozenBefore),
            frozenGaugeAfter: cleanGaugeUnits(
              this.frozenGaugeUnits()
            ),
            decayRatePerFrame: this.frozenDecayRate,
            expiresAtFrame: this.frozenExpiryFrame()
          };
          orderedCryoReactions.push("freeze");
        }
      }

      automaticReaction =
        orderedCryoAmplifyingReaction ??
        orderedCryoTransformativeReaction ??
        orderedCryoReactions[0] ??
        "none";
      if (
        orderedCryoReactions.length === 0 &&
        unsupportedReactions.length === 0
      ) {
        this.attachNormalAura(
          input.element,
          application.gaugeUnits,
          input.sourceActorId
        );
      }
    } else if (usesOrderedHydroPipeline) {
      const consumeMappedAura = (
        element: AuraStateElement,
        consumptionFactor: number
      ): number => {
        if (
          remainingHydroGaugeUnits <= AURA_EPSILON ||
          this.mappedAuraGaugeUnits(element) <= AURA_EPSILON
        ) {
          return 0;
        }
        const mutations = this.reduceMappedAuraGauge(
          element,
          remainingHydroGaugeUnits * consumptionFactor
        );
        let maximumConsumedGaugeUnits = 0;
        for (const mutation of mutations) {
          maximumConsumedGaugeUnits = Math.max(
            maximumConsumedGaugeUnits,
            mutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: mutation.element,
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
        }
        remainingHydroGaugeUnits = cleanGaugeUnits(
          Math.max(
            0,
            remainingHydroGaugeUnits -
              maximumConsumedGaugeUnits / consumptionFactor
          )
        );
        return maximumConsumedGaugeUnits;
      };

      if (consumeMappedAura("pyro", 2) > AURA_EPSILON) {
        orderedHydroReactions.push("vaporize");
        orderedHydroAmplifyingReaction = "vaporize";
      }

      if (
        remainingHydroGaugeUnits > AURA_EPSILON &&
        (this.auras.get("cryo")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        const mutation = this.reduceAuraGauge(
          "cryo",
          remainingHydroGaugeUnits
        );
        if (mutation.consumedGaugeUnits > AURA_EPSILON) {
          remainingHydroGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingHydroGaugeUnits -
                mutation.consumedGaugeUnits
            )
          );
          auraConsumed.push({
            element: "cryo",
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
          const frozenBefore = this.frozenGaugeUnits();
          const frozenAttachment = this.attachFrozen(
            2 * mutation.consumedGaugeUnits
          );
          frozenReaction = {
            generation: this.frozenGeneration,
            operation: frozenAttachment.operation,
            freezeResistance: this.freezeResistance,
            generatedGaugeUnits: cleanGaugeUnits(
              frozenAttachment.generatedGaugeUnits
            ),
            consumedGaugeUnits: 0,
            frozenGaugeBefore: cleanGaugeUnits(frozenBefore),
            frozenGaugeAfter: cleanGaugeUnits(
              this.frozenGaugeUnits()
            ),
            decayRatePerFrame: this.frozenDecayRate,
            expiresAtFrame: this.frozenExpiryFrame()
          };
          orderedHydroReactions.push("freeze");
        }
      }

      const bloom = this.resolveBloom(
        input,
        remainingHydroGaugeUnits,
        false,
        auraConsumed
      );
      remainingHydroGaugeUnits =
        bloom.remainingIncomingGaugeUnits;
      bloomReactions = bloom.audits;
      if (bloomReactions.length > 0) {
        orderedHydroReactions.push(
          ...bloomReactions.map(() => "bloom" as const)
        );
      }

      const reactedBeforeElectroCharged =
        orderedHydroReactions.length > 0;
      if (
        remainingHydroGaugeUnits > AURA_EPSILON &&
        (this.mode === "aura-v5" ||
          this.frozenGaugeUnits() <= AURA_EPSILON) &&
        (this.auras.get("electro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        if (!reactedBeforeElectroCharged) {
          this.attachNormalAura(
            "hydro",
            remainingHydroGaugeUnits,
            input.sourceActorId
          );
        }
        if (this.hasElectroChargedAuras()) {
          const operation = this.electroChargedActive
            ? "refresh"
            : "start";
          if (operation === "start") {
            this.electroChargedGeneration += 1;
            this.electroChargedActive = true;
            this.electroChargedNextTickFrame =
              input.frame +
              ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
              ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
          }
          const coexistenceExpiresAtFrame =
            this.electroChargedExpiryFrame();
          if (coexistenceExpiresAtFrame === null) {
            throw new Error(
              "Electro-Charged was selected without coexisting Hydro and Electro aura."
            );
          }
          periodicReaction = {
            reaction: "electroCharged",
            generation: this.electroChargedGeneration,
            operation,
            damageElement: "electro",
            baseMultiplier:
              ELECTRO_CHARGED_BASE_MULTIPLIER,
            firstDamageFrame:
              operation === "start"
                ? input.frame +
                  ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES
                : null,
            nextTickFrame:
              this.electroChargedNextTickFrame,
            tickIntervalFrames:
              ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
            waneDelayFrames:
              ELECTRO_CHARGED_WANE_DELAY_FRAMES,
            waneGaugeUnits:
              ELECTRO_CHARGED_WANE_GAUGE_UNITS,
            coexistenceExpiresAtFrame
          };
          orderedHydroReactions.push(
            "electroCharged"
          );
        } else if (reactedBeforeElectroCharged) {
          // Fixed TryAddEC still emits Electro-Charged and queues its +10f
          // first damage when Hydro already reacted earlier in this hit. The
          // remaining Hydro budget is not attached, so no continuing
          // coexistence stream is created.
          this.electroChargedGeneration += 1;
          this.electroChargedActive = true;
          this.electroChargedNextTickFrame =
            input.frame +
            ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
            ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
          periodicReaction = {
            reaction: "electroCharged",
            generation: this.electroChargedGeneration,
            operation: "start",
            damageElement: "electro",
            baseMultiplier:
              ELECTRO_CHARGED_BASE_MULTIPLIER,
            firstDamageFrame:
              input.frame +
              ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES,
            nextTickFrame:
              this.electroChargedNextTickFrame,
            tickIntervalFrames:
              ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
            waneDelayFrames:
              ELECTRO_CHARGED_WANE_DELAY_FRAMES,
            waneGaugeUnits:
              ELECTRO_CHARGED_WANE_GAUGE_UNITS,
            coexistenceExpiresAtFrame: null
          };
          orderedHydroReactions.push(
            "electroCharged"
          );
        }
      }

      automaticReaction =
        orderedHydroAmplifyingReaction ??
        orderedHydroReactions[0] ??
        "none";
      if (
        orderedHydroReactions.length === 0 &&
        unsupportedReactions.length === 0
      ) {
        this.attachNormalAura(
          input.element,
          application.gaugeUnits,
          input.sourceActorId
        );
      }
    } else if (usesOrderedElectroPipeline) {
      const consumeMappedAura = (
        element: AuraStateElement,
        consumptionFactor: number
      ): number => {
        if (
          remainingElectroGaugeUnits <= AURA_EPSILON ||
          this.mappedAuraGaugeUnits(element) <= AURA_EPSILON
        ) {
          return 0;
        }
        const mutations = this.reduceMappedAuraGauge(
          element,
          remainingElectroGaugeUnits * consumptionFactor
        );
        let maximumConsumedGaugeUnits = 0;
        for (const mutation of mutations) {
          maximumConsumedGaugeUnits = Math.max(
            maximumConsumedGaugeUnits,
            mutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: mutation.element,
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
        }
        remainingElectroGaugeUnits = cleanGaugeUnits(
          Math.max(
            0,
            remainingElectroGaugeUnits -
              maximumConsumedGaugeUnits / consumptionFactor
          )
        );
        return maximumConsumedGaugeUnits;
      };

      // Fixed gcsim incoming-Electro order:
      // Aggravate (captured above, non-consuming) → Overload → EC →
      // Frozen Superconduct → ordinary Superconduct → Quicken.
      if (consumeMappedAura("pyro", 1) > AURA_EPSILON) {
        orderedElectroReactions.push("overload");
        orderedElectroTransformativeReactions.push(
          "overload"
        );
      }

      let electroChargedOperation:
        | "start"
        | "refresh"
        | null = null;
      if (
        remainingElectroGaugeUnits > AURA_EPSILON &&
        this.frozenGaugeUnits() <= AURA_EPSILON &&
        (this.auras.get("hydro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        // TryAddEC attaches Electro only when an earlier consuming reaction
        // has not marked this hit as reacted. Aggravate is non-consuming.
        if (orderedElectroReactions.length === 0) {
          this.attachNormalAura(
            "electro",
            remainingElectroGaugeUnits,
            input.sourceActorId
          );
        }
        electroChargedOperation =
          this.electroChargedActive ? "refresh" : "start";
        if (electroChargedOperation === "start") {
          this.electroChargedGeneration += 1;
          this.electroChargedActive = true;
          this.electroChargedNextTickFrame =
            input.frame +
            ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
            ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
        }
        orderedElectroReactions.push(
          "electroCharged"
        );
      }

      if (
        remainingElectroGaugeUnits > AURA_EPSILON &&
        this.frozenGaugeUnits() > AURA_EPSILON
      ) {
        const frozenGaugeUnitsBefore =
          this.frozenGaugeUnits();
        const cryoMutation = this.reduceAuraGauge(
          "cryo",
          remainingElectroGaugeUnits
        );
        if (cryoMutation.consumedGaugeUnits > AURA_EPSILON) {
          remainingElectroGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingElectroGaugeUnits -
                cryoMutation.consumedGaugeUnits
            )
          );
          auraConsumed.push({
            element: "cryo",
            gaugeUnits: cryoMutation.consumedGaugeUnits,
            ...(cryoMutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    cryoMutation.sourceMutations
                })
          });
        }
        const frozenMutation = this.reduceAuraGauge(
          "frozen",
          remainingElectroGaugeUnits
        );
        if (
          frozenMutation.consumedGaugeUnits >
          AURA_EPSILON
        ) {
          auraConsumed.push({
            element: "frozen",
            gaugeUnits:
              frozenMutation.consumedGaugeUnits
          });
          this.frozenGeneration += 1;
          frozenReaction = {
            generation: this.frozenGeneration,
            operation: "consume",
            freezeResistance: this.freezeResistance,
            generatedGaugeUnits: 0,
            consumedGaugeUnits:
              frozenMutation.consumedGaugeUnits,
            frozenGaugeBefore: cleanGaugeUnits(
              frozenGaugeUnitsBefore
            ),
            frozenGaugeAfter: cleanGaugeUnits(
              this.frozenGaugeUnits()
            ),
            decayRatePerFrame: this.frozenDecayRate,
            expiresAtFrame: this.frozenExpiryFrame()
          };
        }
        // Fixed TryFrozenSuperconduct discards the whole residual incoming
        // budget after reducing ordinary Cryo and then Frozen.
        remainingElectroGaugeUnits = 0;
        orderedElectroReactions.push("superconduct");
        orderedElectroTransformativeReactions.push(
          "superconduct"
        );
      } else if (
        remainingElectroGaugeUnits > AURA_EPSILON &&
        (this.auras.get("cryo")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        const mutation = this.reduceAuraGauge(
          "cryo",
          remainingElectroGaugeUnits
        );
        if (mutation.consumedGaugeUnits > AURA_EPSILON) {
          remainingElectroGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingElectroGaugeUnits -
                mutation.consumedGaugeUnits
            )
          );
          auraConsumed.push({
            element: "cryo",
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
                })
          });
          orderedElectroReactions.push(
            "superconduct"
          );
          orderedElectroTransformativeReactions.push(
            "superconduct"
          );
        }
      }

      if (
        remainingElectroGaugeUnits > AURA_EPSILON &&
        (this.auras.get("dendro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      ) {
        const targetAura = this.auras.get("dendro");
        if (targetAura === undefined) {
          throw new Error(
            "Ordered Electro pipeline lost its Dendro Quicken candidate."
          );
        }
        const auraGaugeUnitsBefore =
          targetAura.gaugeUnits;
        const sourceGaugeUnitsBefore =
          remainingElectroGaugeUnits;
        const sourceGaugeUnitsSpent = Math.min(
          sourceGaugeUnitsBefore,
          auraGaugeUnitsBefore
        );
        remainingElectroGaugeUnits = cleanGaugeUnits(
          sourceGaugeUnitsBefore - sourceGaugeUnitsSpent
        );
        const mutation = this.reduceAuraGauge(
          "dendro",
          sourceGaugeUnitsSpent
        );
        auraConsumed.push({
          element: "dendro",
          gaugeUnits: mutation.consumedGaugeUnits,
          ...(mutation.sourceMutations.length === 0
            ? {}
            : {
                sourceMutations:
                  mutation.sourceMutations
              })
        });
        const attachment = this.attachQuicken(
          sourceGaugeUnitsSpent,
          input.sourceActorId
        );
        const pendingHydroBloomFollowup =
          (this.auras.get("hydro")?.gaugeUnits ?? 0) >
          AURA_EPSILON;
        const quickenReaction: QuickenReactionAudit = {
          reaction: "quicken",
          triggerElement: "electro",
          consumedAuraElement: "dendro",
          sourceGaugeUnitsBefore: cleanGaugeUnits(
            sourceGaugeUnitsBefore
          ),
          sourceGaugeUnitsSpent: cleanGaugeUnits(
            sourceGaugeUnitsSpent
          ),
          sourceGaugeUnitsAfter: cleanGaugeUnits(
            remainingElectroGaugeUnits
          ),
          auraGaugeUnitsBefore: cleanGaugeUnits(
            auraGaugeUnitsBefore
          ),
          auraConsumedGaugeUnits:
            mutation.consumedGaugeUnits,
          auraGaugeUnitsAfter: cleanGaugeUnits(
            this.auras.get("dendro")?.gaugeUnits ?? 0
          ),
          quickenGaugeUnitsBefore:
            attachment.quickenGaugeUnitsBefore,
          candidateGaugeUnits: cleanGaugeUnits(
            sourceGaugeUnitsSpent
          ),
          quickenGaugeUnitsAfter:
            attachment.quickenGaugeUnitsAfter,
          operation: attachment.operation,
          generation: attachment.generation,
          decayPerFrameBefore:
            attachment.decayPerFrameBefore,
          decayPerFrame: attachment.decayPerFrame,
          expiresAtFrameBefore:
            attachment.expiresAtFrameBefore,
          expiresAtFrame: attachment.expiresAtFrame,
          endCauseBefore: attachment.endCauseBefore,
          endCause: attachment.endCause,
          operationAuraBefore:
            attachment.operationAuraBefore,
          operationAuraAfter:
            attachment.operationAuraAfter,
          pendingHydroBloomFollowup
        };
        catalyzeReaction = {
          quicken: quickenReaction,
          additive: additiveReaction
        };
        orderedElectroReactions.push("quicken");

        const bloom = this.resolveBloom(
          input,
          0,
          usesQueuedQuickenBloomFollowup(this.mode)
            ? false
            : pendingHydroBloomFollowup,
          auraConsumed
        );
        bloomReactions = bloom.audits;
        orderedElectroReactions.push(
          ...bloomReactions.map(
            () => "bloom" as const
          )
        );
      }

      if (electroChargedOperation !== null) {
        periodicReaction = {
          reaction: "electroCharged",
          generation: this.electroChargedGeneration,
          operation: electroChargedOperation,
          damageElement: "electro",
          baseMultiplier:
            ELECTRO_CHARGED_BASE_MULTIPLIER,
          firstDamageFrame:
            electroChargedOperation === "start"
              ? input.frame +
                ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES
              : null,
          nextTickFrame:
            this.electroChargedNextTickFrame,
          tickIntervalFrames:
            ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
          waneDelayFrames:
            ELECTRO_CHARGED_WANE_DELAY_FRAMES,
          waneGaugeUnits:
            ELECTRO_CHARGED_WANE_GAUGE_UNITS,
          coexistenceExpiresAtFrame:
            this.electroChargedExpiryFrame()
        };
      }

      automaticReaction =
        orderedElectroReactions[0] ?? "none";
      if (
        orderedElectroReactions.length === 0 &&
        unsupportedReactions.length === 0
      ) {
        this.attachNormalAura(
          input.element,
          application.gaugeUnits,
          input.sourceActorId
        );
      }
    } else if (usesElectroHydroDendroPipeline) {
      // Fixed gcsim order reaches TryAddEC before TryQuicken for incoming
      // Electro. EC attaches the incoming Electro because no earlier
      // consuming reaction fired, then Quicken consumes Dendro and queues the
      // zero-delay Quicken→Hydro Bloom follow-up.
      this.attachNormalAura(
        "electro",
        application.gaugeUnits,
        input.sourceActorId
      );
      const electroChargedOperation =
        this.electroChargedActive ? "refresh" : "start";
      if (electroChargedOperation === "start") {
        this.electroChargedGeneration += 1;
        this.electroChargedActive = true;
        this.electroChargedNextTickFrame =
          input.frame +
          ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
      }
      orderedElectroReactions.push("electroCharged");

      const targetAura = this.auras.get("dendro");
      if (targetAura === undefined) {
        throw new Error(
          "Electro Hydro+Dendro pipeline lost its Dendro Quicken candidate."
        );
      }
      const auraGaugeUnitsBefore = targetAura.gaugeUnits;
      const sourceGaugeUnitsBefore = application.gaugeUnits;
      const sourceGaugeUnitsSpent = Math.min(
        sourceGaugeUnitsBefore,
        auraGaugeUnitsBefore
      );
      const sourceGaugeUnitsAfter = cleanGaugeUnits(
        sourceGaugeUnitsBefore - sourceGaugeUnitsSpent
      );
      const mutation = this.reduceAuraGauge(
        "dendro",
        sourceGaugeUnitsSpent
      );
      auraConsumed.push({
        element: "dendro",
        gaugeUnits: mutation.consumedGaugeUnits,
        ...(mutation.sourceMutations.length === 0
          ? {}
          : { sourceMutations: mutation.sourceMutations })
      });
      const attachment = this.attachQuicken(
        sourceGaugeUnitsSpent,
        input.sourceActorId
      );
      const quickenReaction: QuickenReactionAudit = {
        reaction: "quicken",
        triggerElement: "electro",
        consumedAuraElement: "dendro",
        sourceGaugeUnitsBefore: cleanGaugeUnits(
          sourceGaugeUnitsBefore
        ),
        sourceGaugeUnitsSpent: cleanGaugeUnits(
          sourceGaugeUnitsSpent
        ),
        sourceGaugeUnitsAfter,
        auraGaugeUnitsBefore: cleanGaugeUnits(
          auraGaugeUnitsBefore
        ),
        auraConsumedGaugeUnits: cleanGaugeUnits(
          mutation.consumedGaugeUnits
        ),
        auraGaugeUnitsAfter: cleanGaugeUnits(
          this.auras.get("dendro")?.gaugeUnits ?? 0
        ),
        quickenGaugeUnitsBefore:
          attachment.quickenGaugeUnitsBefore,
        candidateGaugeUnits: cleanGaugeUnits(
          sourceGaugeUnitsSpent
        ),
        quickenGaugeUnitsAfter:
          attachment.quickenGaugeUnitsAfter,
        operation: attachment.operation,
        generation: attachment.generation,
        decayPerFrameBefore:
          attachment.decayPerFrameBefore,
        decayPerFrame: attachment.decayPerFrame,
        expiresAtFrameBefore:
          attachment.expiresAtFrameBefore,
        expiresAtFrame: attachment.expiresAtFrame,
        endCauseBefore: attachment.endCauseBefore,
        endCause: attachment.endCause,
        operationAuraBefore:
          attachment.operationAuraBefore,
        operationAuraAfter:
          attachment.operationAuraAfter,
        pendingHydroBloomFollowup: true
      };
      catalyzeReaction = {
        quicken: quickenReaction,
        additive: additiveReaction
      };
      orderedElectroReactions.push("quicken");

      const bloom = this.resolveBloom(
        input,
        0,
        true,
        auraConsumed
      );
      bloomReactions = bloom.audits;
      orderedElectroReactions.push(
        ...bloomReactions.map(() => "bloom" as const)
      );

      periodicReaction = {
        reaction: "electroCharged",
        generation: this.electroChargedGeneration,
        operation: electroChargedOperation,
        damageElement: "electro",
        baseMultiplier: ELECTRO_CHARGED_BASE_MULTIPLIER,
        firstDamageFrame:
          electroChargedOperation === "start"
            ? input.frame +
              ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES
            : null,
        nextTickFrame: this.electroChargedNextTickFrame,
        tickIntervalFrames:
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
        waneDelayFrames: ELECTRO_CHARGED_WANE_DELAY_FRAMES,
        waneGaugeUnits: ELECTRO_CHARGED_WANE_GAUGE_UNITS,
        // The queued Bloom may remove Hydro later in the same frame. The
        // +10f EC damage remains scheduled, while a continuing coexistence
        // stream exists only when Hydro survives that follow-up.
        coexistenceExpiresAtFrame:
          this.electroChargedExpiryFrame()
      };
      automaticReaction = "electroCharged";
    } else if (frozenMelt) {
      const cryoAura = this.auras.get("cryo");
      if (cryoAura !== undefined) {
        const mutation = this.reduceAuraGauge(
          "cryo",
          application.gaugeUnits * 2
        );
        auraConsumed.push({
          element: "cryo",
          gaugeUnits: mutation.consumedGaugeUnits,
          ...(mutation.sourceMutations.length === 0
            ? {}
            : { sourceMutations: mutation.sourceMutations })
        });
      }
      const frozenBefore = this.frozenGaugeUnits();
      const frozenConsumed = Math.min(
        frozenBefore,
        application.gaugeUnits * 2
      );
      const frozenAura = this.auras.get("frozen");
      if (frozenAura !== undefined && frozenConsumed > 0) {
        frozenAura.gaugeUnits -= frozenConsumed;
        auraConsumed.push({
          element: "frozen",
          gaugeUnits: cleanGaugeUnits(frozenConsumed)
        });
        if (frozenAura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete("frozen");
        }
        this.frozenGeneration += 1;
      }
      automaticReaction = "melt";
      frozenReaction = {
        generation: this.frozenGeneration,
        operation: "consume",
        freezeResistance: this.freezeResistance,
        generatedGaugeUnits: 0,
        consumedGaugeUnits: cleanGaugeUnits(frozenConsumed),
        frozenGaugeBefore: cleanGaugeUnits(frozenBefore),
        frozenGaugeAfter: cleanGaugeUnits(
          this.frozenGaugeUnits()
        ),
        decayRatePerFrame: this.frozenDecayRate,
        expiresAtFrame: this.frozenExpiryFrame()
      };
    } else if (frozenSuperconduct) {
      let remainingGaugeUnits = application.gaugeUnits;
      const cryoAura = this.auras.get("cryo");
      if (cryoAura !== undefined && remainingGaugeUnits > AURA_EPSILON) {
        const mutation = this.reduceAuraGauge(
          "cryo",
          remainingGaugeUnits
        );
        remainingGaugeUnits -= mutation.consumedGaugeUnits;
        auraConsumed.push({
          element: "cryo",
          gaugeUnits: mutation.consumedGaugeUnits,
          ...(mutation.sourceMutations.length === 0
            ? {}
            : { sourceMutations: mutation.sourceMutations })
        });
      }
      const frozenBefore = this.frozenGaugeUnits();
      const frozenConsumed = Math.min(
        frozenBefore,
        remainingGaugeUnits
      );
      const frozenAura = this.auras.get("frozen");
      if (frozenAura !== undefined && frozenConsumed > 0) {
        frozenAura.gaugeUnits -= frozenConsumed;
        auraConsumed.push({
          element: "frozen",
          gaugeUnits: cleanGaugeUnits(frozenConsumed)
        });
        if (frozenAura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete("frozen");
        }
        this.frozenGeneration += 1;
      }
      automaticReaction = "superconduct";
      frozenReaction = {
        generation: this.frozenGeneration,
        operation: "consume",
        freezeResistance: this.freezeResistance,
        generatedGaugeUnits: 0,
        consumedGaugeUnits: cleanGaugeUnits(frozenConsumed),
        frozenGaugeBefore: cleanGaugeUnits(frozenBefore),
        frozenGaugeAfter: cleanGaugeUnits(
          this.frozenGaugeUnits()
        ),
        decayRatePerFrame: this.frozenDecayRate,
        expiresAtFrame: this.frozenExpiryFrame()
      };
    } else if (rule?.reaction === "electroCharged") {
      this.attachNormalAura(
        input.element,
        application.gaugeUnits,
        input.sourceActorId
      );
      const operation = this.electroChargedActive
        ? "refresh"
        : "start";
      if (operation === "start") {
        this.electroChargedGeneration += 1;
        this.electroChargedActive = true;
        this.electroChargedNextTickFrame =
          input.frame +
          ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
      }
      const coexistenceExpiresAtFrame =
        this.electroChargedExpiryFrame();
      if (coexistenceExpiresAtFrame === null) {
        throw new Error(
          "Electro-Charged was selected without coexisting Hydro and Electro aura."
        );
      }
      automaticReaction = "electroCharged";
      periodicReaction = {
        reaction: "electroCharged",
        generation: this.electroChargedGeneration,
        operation,
        damageElement: "electro",
        baseMultiplier: ELECTRO_CHARGED_BASE_MULTIPLIER,
        firstDamageFrame:
          operation === "start"
            ? input.frame +
              ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES
            : null,
        nextTickFrame: this.electroChargedNextTickFrame,
        tickIntervalFrames:
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
        waneDelayFrames: ELECTRO_CHARGED_WANE_DELAY_FRAMES,
        waneGaugeUnits: ELECTRO_CHARGED_WANE_GAUGE_UNITS,
        coexistenceExpiresAtFrame
      };
    } else if (rule?.reaction === "freeze") {
      const targetAura = this.auras.get(rule.auraElement);
      if (targetAura !== undefined) {
        const mutation = this.reduceAuraGauge(
          rule.auraElement,
          application.gaugeUnits
        );
        auraConsumed.push({
          element: rule.auraElement,
          gaugeUnits: mutation.consumedGaugeUnits,
          ...(mutation.sourceMutations.length === 0
            ? {}
            : { sourceMutations: mutation.sourceMutations })
        });
        if (input.element === "hydro") {
          remainingHydroGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingHydroGaugeUnits -
                mutation.consumedGaugeUnits
            )
          );
        }
        const frozenBefore = this.frozenGaugeUnits();
        const frozenAttachment = this.attachFrozen(
          2 * mutation.consumedGaugeUnits
        );
        automaticReaction = "freeze";
        frozenReaction = {
          generation: this.frozenGeneration,
          operation: frozenAttachment.operation,
          freezeResistance: this.freezeResistance,
          generatedGaugeUnits: cleanGaugeUnits(
            frozenAttachment.generatedGaugeUnits
          ),
          consumedGaugeUnits: 0,
          frozenGaugeBefore: cleanGaugeUnits(frozenBefore),
          frozenGaugeAfter: cleanGaugeUnits(
            this.frozenGaugeUnits()
          ),
          decayRatePerFrame: this.frozenDecayRate,
          expiresAtFrame: this.frozenExpiryFrame()
        };
      }
    } else if (rule) {
      if (
        this.mappedAuraGaugeUnits(rule.auraElement) >
        AURA_EPSILON
      ) {
        const mutations = this.reduceMappedAuraGauge(
          rule.auraElement,
          application.gaugeUnits * rule.consumptionFactor
        );
        let maximumConsumedGaugeUnits = 0;
        for (const mutation of mutations) {
          maximumConsumedGaugeUnits = Math.max(
            maximumConsumedGaugeUnits,
            mutation.consumedGaugeUnits
          );
          auraConsumed.push({
            element: mutation.element,
            gaugeUnits: mutation.consumedGaugeUnits,
            ...(mutation.sourceMutations.length === 0
              ? {}
              : {
                  sourceMutations:
                    mutation.sourceMutations
            })
          });
        }
        if (
          input.element === "hydro" &&
          rule.consumptionFactor > 0
        ) {
          remainingHydroGaugeUnits = cleanGaugeUnits(
            Math.max(
              0,
              remainingHydroGaugeUnits -
                maximumConsumedGaugeUnits /
                  rule.consumptionFactor
            )
          );
        }
        automaticReaction = rule.reaction;
      }
    } else if (
      quickenConsumedAuraElement !== null &&
      (this.auras.get(quickenConsumedAuraElement)?.gaugeUnits ?? 0) >
        AURA_EPSILON
    ) {
      const targetAura = this.auras.get(
        quickenConsumedAuraElement
      );
      if (targetAura === undefined) {
        throw new Error(
          "Quicken candidate disappeared before processing."
        );
      }
      const auraGaugeUnitsBefore = targetAura.gaugeUnits;
      const sourceGaugeUnitsBefore = application.gaugeUnits;
      const sourceGaugeUnitsSpent = Math.min(
        sourceGaugeUnitsBefore,
        auraGaugeUnitsBefore
      );
      remainingDendroGaugeUnits = cleanGaugeUnits(
        sourceGaugeUnitsBefore - sourceGaugeUnitsSpent
      );
      const mutation = this.reduceAuraGauge(
        quickenConsumedAuraElement,
        sourceGaugeUnitsSpent
      );
      auraConsumed.push({
        element: quickenConsumedAuraElement,
        gaugeUnits: mutation.consumedGaugeUnits,
        ...(mutation.sourceMutations.length === 0
          ? {}
          : { sourceMutations: mutation.sourceMutations })
      });
      const attachment = this.attachQuicken(
        sourceGaugeUnitsSpent,
        input.sourceActorId
      );
      const quickenReaction: QuickenReactionAudit = {
        reaction: "quicken",
        triggerElement: input.element as "dendro" | "electro",
        consumedAuraElement: quickenConsumedAuraElement,
        sourceGaugeUnitsBefore: cleanGaugeUnits(
          sourceGaugeUnitsBefore
        ),
        sourceGaugeUnitsSpent: cleanGaugeUnits(
          sourceGaugeUnitsSpent
        ),
        sourceGaugeUnitsAfter: cleanGaugeUnits(
          remainingDendroGaugeUnits
        ),
        auraGaugeUnitsBefore: cleanGaugeUnits(
          auraGaugeUnitsBefore
        ),
        auraConsumedGaugeUnits: cleanGaugeUnits(
          sourceGaugeUnitsSpent
        ),
        auraGaugeUnitsAfter: cleanGaugeUnits(
          this.auras.get(quickenConsumedAuraElement)
            ?.gaugeUnits ?? 0
        ),
        quickenGaugeUnitsBefore:
          attachment.quickenGaugeUnitsBefore,
        candidateGaugeUnits: cleanGaugeUnits(
          sourceGaugeUnitsSpent
        ),
        quickenGaugeUnitsAfter:
          attachment.quickenGaugeUnitsAfter,
        operation: attachment.operation,
        generation: attachment.generation,
        decayPerFrameBefore:
          attachment.decayPerFrameBefore,
        decayPerFrame: attachment.decayPerFrame,
        expiresAtFrameBefore:
          attachment.expiresAtFrameBefore,
        expiresAtFrame: attachment.expiresAtFrame,
        endCauseBefore: attachment.endCauseBefore,
        endCause: attachment.endCause,
        operationAuraBefore:
          attachment.operationAuraBefore,
        operationAuraAfter:
          attachment.operationAuraAfter,
        pendingHydroBloomFollowup:
          (this.auras.get("hydro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      };
      catalyzeReaction = {
        quicken: quickenReaction,
        additive: additiveReaction
      };
      automaticReaction = "quicken";
    } else if (
      unsupportedReactions.length === 0 &&
      !(
        usesBloomModel(this.mode) &&
        input.element === "dendro" &&
        (this.auras.get("hydro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      )
    ) {
      this.attachNormalAura(
        input.element,
        application.gaugeUnits,
        input.sourceActorId
      );
    }

    if (
      burningBeforeReaction !== null &&
      this.lastBurningStop?.fromGeneration ===
        burningBeforeReaction.generation &&
      this.lastBurningStop.frame === input.frame &&
      this.lastBurningStop.reason ===
        "BURNING_AURA_CONSUMED"
    ) {
      burningReaction = this.makeBurningStopAudit(
        input,
        burningBeforeReaction
      );
    }

    const burningApplication = usesOrderedPyroPipeline
      ? {
          ...application,
          gaugeUnits: remainingPyroGaugeUnits
        }
      : input.element === "dendro"
        ? {
            ...application,
            gaugeUnits: remainingDendroGaugeUnits
          }
        : application;
    const burningStartOrRefresh = this.startOrRefreshBurning(
      input,
      burningApplication
    );
    if (burningStartOrRefresh !== null) {
      burningReaction = burningStartOrRefresh;
      if (
        automaticReaction === "none" &&
        (!usesQueuedQuickenBloomFollowup(this.mode) ||
          burningStartOrRefresh.reactionTriggered)
      ) {
        automaticReaction = "burning";
      }
    }

    if (
      usesBloomModel(this.mode) &&
      input.element === "dendro"
    ) {
      const bloom = this.resolveBloom(
        input,
        remainingDendroGaugeUnits,
        usesQueuedQuickenBloomFollowup(this.mode)
          ? false
          : catalyzeReaction?.quicken
              ?.pendingHydroBloomFollowup === true,
        auraConsumed
      );
      remainingDendroGaugeUnits =
        bloom.remainingIncomingGaugeUnits;
      bloomReactions = bloom.audits;
      if (
        bloomReactions.length > 0 &&
        automaticReaction === "none"
      ) {
        automaticReaction = "bloom";
      }
    }

    if (this.mode === "aura-v4") {
      const bloomAuraPresent =
        (this.auras.get("dendro")?.gaugeUnits ?? 0) >
          AURA_EPSILON ||
        this.quickenGaugeUnits() > AURA_EPSILON ||
        this.burningFuelGaugeUnits() > AURA_EPSILON;
      if (
        (input.element === "hydro" &&
          remainingHydroGaugeUnits > AURA_EPSILON &&
          bloomAuraPresent) ||
        (input.element === "dendro" &&
          remainingDendroGaugeUnits > AURA_EPSILON &&
          (this.auras.get("hydro")?.gaugeUnits ?? 0) >
            AURA_EPSILON)
      ) {
        unsupportedReactions.push("bloom");
      }
    }

    if (
      periodicReaction === null &&
      electroChargedWasActive &&
      !this.hasElectroChargedAuras() &&
      !this.shouldDeferElectroChargedMissingAuraCleanup()
    ) {
      this.electroChargedActive = false;
      this.electroChargedNextTickFrame = -1;
      periodicReaction = {
        reaction: "electroCharged",
        generation: this.electroChargedGeneration,
        operation: "stop",
        damageElement: "electro",
        baseMultiplier: ELECTRO_CHARGED_BASE_MULTIPLIER,
        firstDamageFrame: null,
        nextTickFrame: null,
        tickIntervalFrames:
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
        waneDelayFrames: ELECTRO_CHARGED_WANE_DELAY_FRAMES,
        waneGaugeUnits: ELECTRO_CHARGED_WANE_GAUGE_UNITS,
        coexistenceExpiresAtFrame: null
      };
    }

    const reaction =
      additiveReaction?.reaction ?? automaticReaction;
    const reactions: ReactionType[] = [
      ...(additiveReaction === null
        ? []
        : [additiveReaction.reaction]),
      ...(usesOrderedPyroPipeline
        ? orderedPyroReactions
        : usesOrderedCryoPipeline
          ? orderedCryoReactions
          : usesOrderedHydroPipeline
            ? orderedHydroReactions
            : usesOrderedElectroPipeline
              ? orderedElectroReactions
            : usesElectroHydroDendroPipeline
              ? orderedElectroReactions
              : automaticReaction === "none"
                ? []
                : [automaticReaction]),
      ...(burningReaction !== null &&
      burningReaction.operation !== "stop" &&
      (!usesQueuedQuickenBloomFollowup(this.mode) ||
        burningReaction.reactionTriggered) &&
      (usesOrderedPyroPipeline ||
        automaticReaction !== "burning")
        ? (["burning"] as const)
        : []),
      ...(!usesOrderedCryoPipeline &&
      !usesOrderedHydroPipeline &&
      !usesOrderedElectroPipeline &&
      !usesElectroHydroDendroPipeline
        ? bloomReactions
            .slice(automaticReaction === "bloom" ? 1 : 0)
            .map(() => "bloom" as const)
        : [])
    ];
    const oneShotTransformativeReaction =
      orderedPyroTransformativeReaction ??
      orderedCryoTransformativeReaction ??
      (isOneShotTransformativeReaction(automaticReaction)
        ? automaticReaction
        : null);
    const oneShotTransformativeReactions =
      usesOrderedElectroPipeline
        ? orderedElectroTransformativeReactions
        : oneShotTransformativeReaction === null
          ? []
          : [oneShotTransformativeReaction];
    let transformativeReactions: NonNullable<
      ReactionAudit["transformativeReactions"]
    > = oneShotTransformativeReactions.map(
      (candidate) => {
      const definition =
        TRANSFORMATIVE_REACTION_DEFINITIONS[
          candidate
        ];
      const previousReadyFrame =
        this.reactionDamageReadyFrames.get(
          candidate
        ) ?? -1;
      const scheduled =
        previousReadyFrame < 0 ||
        input.frame >= previousReadyFrame;
      const nextAvailableFrame = scheduled
        ? input.frame + definition.damageGcdFrames
        : previousReadyFrame;
      if (scheduled) {
        this.reactionDamageReadyFrames.set(
          candidate,
          nextAvailableFrame
        );
      }
      return {
        reaction: candidate,
        damageElement: definition.damageElement,
        scheduled,
        damageFrame: input.frame + definition.damageDelayFrames,
        radius: definition.radius,
        baseMultiplier: definition.baseMultiplier,
        blockedReason: scheduled ? null : "REACTION_DAMAGE_GCD",
        nextAvailableFrame,
        statusEffect:
          definition.statusEffect === null
            ? null
            : { ...definition.statusEffect }
      };
      }
    );
    let transformativeReaction: ReactionAudit["transformativeReaction"] =
      transformativeReactions[0] ?? null;

    const mechanicsTruncation =
      unsupportedReactions.length === 0
        ? null
        : this.triggerMechanicsTruncation(
            input.frame,
            unsupportedReactions
          );
    if (
      mechanicsTruncation !== null &&
      transformativeReactions.some(
        (audit) => audit.scheduled
      )
    ) {
      transformativeReactions =
        transformativeReactions.map((audit) =>
          audit.scheduled
            ? {
                ...audit,
                scheduled: false,
                blockedReason:
                  "TARGET_MECHANICS_TRUNCATION" as const
              }
            : audit
        );
      transformativeReaction =
        transformativeReactions[0] ?? null;
    }
    if (
      mechanicsTruncation !== null &&
      burningReaction?.scheduled === true
    ) {
      burningReaction = {
        ...burningReaction,
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION",
        burningGaugeUnitsAfter: 0,
        fuelGaugeUnitsAfter: 0,
        fuelExpiresAtFrame: null,
        firstTickFrame: null,
        nextTickFrame: null
      };
    }
    if (
      mechanicsTruncation !== null &&
      bloomReactions.some((audit) => audit.scheduled)
    ) {
      bloomReactions = bloomReactions.map((audit) => ({
        ...audit,
        scheduled: false,
        coreSpawnFrame: null,
        blockedReason: "TARGET_MECHANICS_TRUNCATION"
      }));
    }

    const reactionNote =
      catalyzeReaction?.additive !== null &&
      catalyzeReaction?.additive !== undefined &&
      catalyzeReaction.quicken !== null
        ? `${catalyzeReaction.additive.reaction === "aggravate" ? "超激化" : "蔓激化"}读取命中帧激元素且不消耗耐久；同一命中随后生成或刷新激元素。`
        : catalyzeReaction?.additive !== null &&
            catalyzeReaction?.additive !== undefined
          ? `${catalyzeReaction.additive.reaction === "aggravate" ? "超激化" : "蔓激化"}读取命中帧激元素并追加可暴击、受增伤/防御/抗性影响的加算基础伤害；激元素耐久不消耗。`
          : catalyzeReaction?.quicken !== null &&
              catalyzeReaction?.quicken !== undefined
            ? `原激化消耗 ${catalyzeReaction.quicken.auraConsumedGaugeUnits}U ${catalyzeReaction.quicken.consumedAuraElement} Aura，${catalyzeReaction.quicken.operation === "unchanged" ? "较弱激元素未覆盖既有状态" : `${catalyzeReaction.quicken.operation === "start" ? "生成" : "刷新"} ${catalyzeReaction.quicken.quickenGaugeUnitsAfter}U 激元素至 ${catalyzeReaction.quicken.expiresAtFrame ?? "未知"}f`}。`
      : automaticReaction === "none"
        ? "附着通过 ICD；未找到当前 Aura 版本支持的反应。"
        : automaticReaction === "bloom"
          ? `绽放已按固定参考耐久顺序结算，并排队 ${bloomReactions.length} 个草原核生成请求。`
        : automaticReaction === "electroCharged"
          ? periodicReaction?.operation === "start"
            ? "感电由水雷共存自动判定；首次单目标伤害与后续 60 帧周期流已排队。"
            : "感电共存 Aura 已刷新；Tick 节奏不重置，未来 Tick 归属更新为本次触发者。"
          : automaticReaction === "freeze"
            ? frozenReaction?.operation === "immune"
              ? "冻结反应已消耗冰/水 Aura；目标冻结抗性为 1，未生成冻元素耐久。"
              : `冻结反应已生成冻元素耐久；逐帧加速衰减，预计在 ${frozenReaction?.expiresAtFrame ?? "未知"}f 到期。`
          : isOneShotTransformativeReaction(automaticReaction)
            ? transformativeReaction?.scheduled
              ? `${automaticReaction === "overload" ? "超载" : "超导"}由命中元素、敌方 Aura、元素量与 ICD 自动判定；独立反应伤害已排队。`
              : transformativeReaction?.blockedReason ===
                  "TARGET_MECHANICS_TRUNCATION"
                ? `${automaticReaction === "overload" ? "超载" : "超导"}已按反应顺序识别并消耗 Aura；同一命中随后进入目标机制截断，独立反应伤害未排队。`
                : `${automaticReaction === "overload" ? "超载" : "超导"}已触发并消耗 Aura；独立反应伤害被同目标 6 帧 GCD 阻止。`
            : "反应由命中元素、敌方 Aura、元素量与 ICD 自动判定。";
    const unsupportedReactionNote =
      unsupportedReactions.length === 0
        ? null
        : unsupportedReactions
            .map((candidate) => {
              if (candidate === "bloom") {
                return "检测到绽放前提，但草原核实体尚未实现；本次执行已支持且排序更早的反应后截断该草反应，未附着会被绽放处理的入射元素，不得据此推断后续 Aura 或伤害。";
              }
              if (
                candidate ===
                "non-pyro-multi-reaction-order"
              ) {
                return "检测到非火入射在同一命中内仍可继续触发多个有序反应；该完整顺序尚未实现，因此目标已 fail-closed，后续 Aura 与伤害不得据此推断。";
              }
              if (
                candidate ===
                "legacy-multi-reaction-order"
              ) {
                return "检测到 aura-v2/v3 的同一入射元素量仍可继续触发多个消费反应；旧版单分支流程无法完整结算该顺序，因此目标已 fail-closed，后续 Aura 与伤害不得据此推断。";
              }
              return "检测到燃烧前提，但燃烧燃料、周期伤害和共存状态尚未实现；本次执行已支持且排序更早的反应后截断该草反应，未附着会被燃烧处理的入射元素。";
            })
            .join("；");
    const baseNote =
      periodicReaction?.operation === "stop"
        ? `${reactionNote}；本次命中移除了水雷共存，感电周期流在同帧停止。`
        : frozenReaction?.operation === "consume"
          ? `${reactionNote}；本次${automaticReaction === "melt" ? "融化" : "超导"}消耗了冻元素耐久。`
          : reactionNote;
    const pendingBloomNote =
      catalyzeReaction?.quicken?.pendingHydroBloomFollowup === true
        ? this.mode === "aura-v5" ||
          this.mode === "aura-v6"
          ? `同帧激元素→水绽放后续已结算；本次共排队 ${bloomReactions.length} 个草原核生成请求。`
          : usesQueuedQuickenBloomFollowup(this.mode)
            ? "同帧激元素→水绽放后续已进入零延迟任务队列；该任务会在执行时重新读取目标 Aura。"
            : "固定 gcsim 会在同帧末尾继续检查激元素与水的绽放；该后续尚未实现并已明确截断。"
        : null;
    return {
      model: "aura-engine",
      triggered: reaction !== "none",
      reaction,
      reactions,
      unsupportedReactions,
      mechanicsTruncation,
      icdAllowed,
      icdTag: application.icdTag,
      icdGroup: application.icdGroup,
      applicationGaugeUnits: application.gaugeUnits,
      auraBefore,
      auraApplied,
      auraConsumed,
      auraAfter:
        mechanicsTruncation === null ? this.snapshot() : [],
      transformativeReaction,
      ...(usesOrderedElectroPipeline
        ? { transformativeReactions }
        : {}),
      periodicReaction,
      frozenReaction,
      shatterReaction: null,
      swirlReactions: [],
      swirlDamageGroup: null,
      crystallizeReaction: null,
      catalyzeReaction,
      burningReaction,
      bloomReactions,
      note: [baseNote, pendingBloomNote, unsupportedReactionNote]
        .filter((part): part is string => part !== null)
        .join("；")
    };
  }
}

export const AURA_ENGINE_CONSTANTS = {
  normalAuraRatio: NORMAL_AURA_RATIO,
  normalAuraBaseDurationFrames: NORMAL_AURA_BASE_DURATION_FRAMES,
  /** Historical aura-v1/v2 replay coefficient. */
  normalAuraDurationPerUnitFrames: NORMAL_AURA_DURATION_PER_UNIT_FRAMES,
  auraV3NormalAuraDurationPerUnitFrames:
    AURA_V3_NORMAL_DURATION_PER_UNIT_FRAMES,
  quickenBaseDurationFrames: QUICKEN_BASE_DURATION_FRAMES,
  quickenDurationPerUnitFrames:
    QUICKEN_DURATION_PER_UNIT_FRAMES,
  defaultIcdResetFrames: DEFAULT_ICD_RESET_FRAMES,
  defaultIcdSequence: DEFAULT_ICD_SEQUENCE,
  builtInDefaultIcdProfile: BUILT_IN_DEFAULT_ICD_PROFILE,
  overloadDamageGcdFrames: OVERLOAD_DAMAGE_GCD_FRAMES,
  overloadDamageDelayFrames: OVERLOAD_DAMAGE_DELAY_FRAMES,
  overloadDamageRadius: OVERLOAD_DAMAGE_RADIUS,
  overloadBaseMultiplier: OVERLOAD_BASE_MULTIPLIER,
  superconductDamageGcdFrames: SUPERCONDUCT_DAMAGE_GCD_FRAMES,
  superconductDamageDelayFrames: SUPERCONDUCT_DAMAGE_DELAY_FRAMES,
  superconductDamageRadius: SUPERCONDUCT_DAMAGE_RADIUS,
  superconductBaseMultiplier: SUPERCONDUCT_BASE_MULTIPLIER,
  superconductPhysicalResShred: SUPERCONDUCT_PHYSICAL_RES_SHRED,
  superconductStatusDurationFrames:
    SUPERCONDUCT_STATUS_DURATION_FRAMES,
  electroChargedFirstDamageDelayFrames:
    ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES,
  electroChargedTickIntervalFrames:
    ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
  electroChargedWaneDelayFrames:
    ELECTRO_CHARGED_WANE_DELAY_FRAMES,
  electroChargedWaneGaugeUnits:
    ELECTRO_CHARGED_WANE_GAUGE_UNITS,
  electroChargedBaseMultiplier:
    ELECTRO_CHARGED_BASE_MULTIPLIER,
  burningMarkerGaugeUnits: BURNING_MARKER_GAUGE_UNITS,
  burningFuelIncomingDendroRatio:
    BURNING_FUEL_INCOMING_DENDRO_RATIO,
  burningFuelMinDecayPerFrame:
    BURNING_FUEL_MIN_DECAY_PER_FRAME,
  burningTickIntervalFrames: BURNING_TICK_INTERVAL_FRAMES,
  burningSkippedTickIndex: BURNING_SKIPPED_TICK_INDEX,
  burningBaseMultiplier: BURNING_BASE_MULTIPLIER,
  burningRadius: BURNING_RADIUS,
  burningApplicationGaugeUnits:
    BURNING_APPLICATION_GAUGE_UNITS,
  bloomCoreSpawnDelayFrames:
    BLOOM_CORE_SPAWN_DELAY_FRAMES,
  burningIcdResetFrames: BURNING_ICD_RESET_FRAMES,
  burningIcdSequence: BURNING_ICD_SEQUENCE,
  frozenBaseDecayPerFrame: FROZEN_BASE_DECAY_PER_FRAME,
  frozenDecayAccelerationPerFrame:
    FROZEN_DECAY_ACCELERATION_PER_FRAME,
  frozenPoiseDamageToGaugeUnits:
    FROZEN_POISE_DAMAGE_TO_GAUGE_UNITS,
  shatterGaugeConsumptionUnits:
    SHATTER_GAUGE_CONSUMPTION_UNITS,
  shatterDamageGcdFrames: SHATTER_DAMAGE_GCD_FRAMES,
  shatterBaseMultiplier: SHATTER_BASE_MULTIPLIER,
  crystallizeAuraConsumptionFactor:
    CRYSTALLIZE_AURA_CONSUMPTION_FACTOR,
  crystallizeQueueGcdFrames: CRYSTALLIZE_QUEUE_GCD_FRAMES,
  crystallizeShardSpawnDelayFrames:
    CRYSTALLIZE_SHARD_SPAWN_DELAY_FRAMES,
  crystallizeEarliestPickupDelayFrames:
    CRYSTALLIZE_EARLIEST_PICKUP_DELAY_FRAMES,
  crystallizeShardDurationFrames:
    CRYSTALLIZE_SHARD_DURATION_FRAMES,
  crystallizeMaxActiveShards: CRYSTALLIZE_MAX_ACTIVE_SHARDS
} as const;
