import type {
  AdditiveReactionAudit,
  AmplifyingReaction,
  AuraElement,
  AuraReactionEngineConfig,
  AuraSourceGaugeMutation,
  AuraStateElement,
  AuraStateEntry,
  BurningReactionAudit,
  CatalyzeReactionAudit,
  CrystallizeReaction,
  CrystallizeReactionAudit,
  Element,
  ElementalApplication,
  IcdProfile,
  OneShotTransformativeReaction,
  PersistentAuraElement,
  QuickenReactionAudit,
  ReactionType,
  ReactionAudit,
  ShatterReactionAudit,
  StrikeType,
  SwirlReaction,
  SwirlReactionAudit,
  TargetMechanicsTruncationAudit,
  TransformativeReaction
} from "@genshin-dps-lab/schemas";

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
const DEFAULT_ICD_SEQUENCE = [true, false, false] as const;
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
  applicationSequence: [...DEFAULT_ICD_SEQUENCE]
};
const BUILT_IN_BURNING_ICD_PROFILE: IcdProfile = {
  resetFrames: BURNING_ICD_RESET_FRAMES,
  applicationSequence: [...BURNING_ICD_SEQUENCE]
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
}

export interface AuraHitInput {
  frame: number;
  sourceActorId: string;
  element: Element;
  application?: ElementalApplication;
  reactionOverride?: AmplifyingReaction;
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
    ((mode === "aura-v3" || mode === "aura-v4") &&
      element === "dendro")
  );
}

function usesAuraV3Durability(
  mode: AuraReactionEngineConfig["mode"]
): boolean {
  return mode === "aura-v3" || mode === "aura-v4";
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
 * tick cadence, and Burning-application ICD. Bloom/core entities, elemental
 * shields, and their special overlap modifiers remain future mechanics work.
 */
export class AuraEngine {
  private readonly auras = new Map<AuraStateElement, MutableAura>();
  private readonly icdStates = new Map<string, IcdState>();
  private readonly icdProfiles: Readonly<Record<string, IcdProfile>>;
  private readonly debugAllowReactionOverride: boolean;
  private readonly mode: AuraReactionEngineConfig["mode"];
  private readonly freezeResistance: number;
  private readonly reactionDamageReadyFrames = new Map<
    OneShotTransformativeReaction,
    number
  >();
  private electroChargedGeneration = 0;
  private electroChargedActive = false;
  private electroChargedNextTickFrame = -1;
  private frozenGeneration = 0;
  private frozenDecayRate = FROZEN_BASE_DECAY_PER_FRAME;
  private quickenGeneration = 0;
  private shatterDamageReadyFrame = -1;
  private readonly swirlDamageReadyFrames = new Map<
    SwirlReaction,
    number
  >();
  private crystallizeReadyFrame = -1;
  private burningGeneration = 0;
  private burningDamageSourceActorId: string | null = null;
  private burningFuelSourceActorId: string | null = null;
  /** Fuel applied after the frame's Aura decay; its first decay is next frame-end. */
  private burningFuelAttachedFrame = -1;
  private burningNextTickFrame = -1;
  private burningNextTickIndex = 1;
  private lastBurningApplicationIcdDecision:
    | BurningApplicationIcdDecision
    | null = null;
  private lastBurningStop: {
    fromGeneration: number;
    frame: number;
    reason: BurningStopReason;
  } | null = null;
  private currentFrame = 0;
  private mechanicsTruncation: TargetMechanicsTruncationAudit | null =
    null;

  constructor(config: AuraEngineConfig) {
    this.mode = config.mode;
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
      reason: unsupportedReactions.includes(
        "non-pyro-multi-reaction-order"
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
    if (this.mode !== "aura-v4" || element !== "pyro") {
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
      this.mode === "aura-v4" && element === "pyro"
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
      this.mode === "aura-v4" &&
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
      this.mode === "aura-v4" &&
      this.burningGaugeUnits() > AURA_EPSILON &&
      this.burningFuelGaugeUnits() > AURA_EPSILON
    );
  }

  private burningFuelExpiryFrame(): number | null {
    const fuel = this.auras.get("burningFuel");
    if (fuel === undefined || fuel.decayPerFrame <= 0) {
      return null;
    }
    return (
      this.currentFrame +
      Math.max(
        0,
        this.burningFuelAttachedFrame + 1 - this.currentFrame
      ) +
      remainingDecayFrames(
        fuel.gaugeUnits,
        fuel.decayPerFrame
      )
    );
  }

  private stopBurning(
    frame: number,
    reason: BurningStopReason,
    removeDendroStates: boolean
  ): void {
    const fromGeneration = this.burningGeneration;
    this.auras.delete("burningFuel");
    if (removeDendroStates) {
      this.auras.delete("burning");
      this.auras.delete("dendro");
      if (this.auras.delete("quicken")) {
        this.quickenGeneration += 1;
      }
    }
    this.burningGeneration += 1;
    this.burningDamageSourceActorId = null;
    this.burningFuelSourceActorId = null;
    this.burningFuelAttachedFrame = -1;
    this.burningNextTickFrame = -1;
    this.burningNextTickIndex = 1;
    this.lastBurningStop = {
      fromGeneration,
      frame,
      reason
    };
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
    if (!Number.isInteger(frame) || frame < this.currentFrame) {
      throw new Error(
        `AuraEngine frames must be non-decreasing integers; got ${frame} after ${this.currentFrame}`
      );
    }
    const elapsed = frame - this.currentFrame;
    if (elapsed > 0) {
      if (this.mode === "aura-v4" && this.hasActiveBurning()) {
        for (
          let nextFrame = this.currentFrame + 1;
          nextFrame <= frame;
          nextFrame += 1
        ) {
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
                true
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
        }
      } else {
        for (const [element, aura] of this.auras) {
          if (element === "frozen") continue;
          this.reduceAuraByDecay(
            aura,
            aura.decayPerFrame * elapsed
          );
        }
        this.advanceFrozenBy(elapsed);
        this.currentFrame = frame;
      }
      if (
        this.electroChargedActive &&
        !this.hasElectroChargedAuras()
      ) {
        this.electroChargedActive = false;
        this.electroChargedNextTickFrame = -1;
      }
    }
  }

  private snapshot(): AuraStateEntry[] {
    return [...this.auras.values()]
      .filter((aura) => aura.gaugeUnits > AURA_EPSILON)
      .sort((left, right) => left.element.localeCompare(right.element))
      .map((aura) => ({
        element: aura.element,
        gaugeUnits: cleanGaugeUnits(aura.gaugeUnits),
        expiresAtFrame:
          aura.element === "burningFuel"
            ? this.burningFuelExpiryFrame()
            : aura.element === "frozen"
            ? this.frozenExpiryFrame()
            : this.hasActiveBurning() &&
                (aura.element === "dendro" ||
                  aura.element === "quicken")
              ? this.currentFrame +
                Math.min(
                  remainingDecayFrames(
                    aura.gaugeUnits,
                    aura.element === "dendro"
                      ? Math.max(
                          this.auras.get("burningFuel")
                            ?.decayPerFrame ??
                            BURNING_FUEL_MIN_DECAY_PER_FRAME,
                          aura.decayPerFrame * 2
                        )
                      : this.auras.get("burningFuel")
                          ?.decayPerFrame ??
                          BURNING_FUEL_MIN_DECAY_PER_FRAME
                  ),
                  (this.burningFuelExpiryFrame() ??
                    this.currentFrame) - this.currentFrame
                )
            : aura.decayPerFrame > 0
              ? this.currentFrame +
                remainingDecayFrames(
                  aura.gaugeUnits,
                  aura.decayPerFrame
                )
              : null,
        ...(aura.sourceSlots === undefined
          ? {}
          : {
              sourceSlots: [...aura.sourceSlots]
                .filter(([, gaugeUnits]) => gaugeUnits > AURA_EPSILON)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([sourceActorId, gaugeUnits]) => ({
                  sourceActorId,
                  gaugeUnits: cleanGaugeUnits(gaugeUnits)
                }))
            })
      }));
  }

  private hasElectroChargedAuras(): boolean {
    return (
      (this.auras.get("hydro")?.gaugeUnits ?? 0) >
        AURA_EPSILON &&
      (this.auras.get("electro")?.gaugeUnits ?? 0) >
        AURA_EPSILON
    );
  }

  private electroChargedExpiryFrame(): number | null {
    if (!this.hasElectroChargedAuras()) return null;
    const hydro = this.auras.get("hydro");
    const electro = this.auras.get("electro");
    if (!hydro || !electro) return null;
    const expiryFrames = [hydro, electro].map((aura) =>
      aura.decayPerFrame > 0
        ? this.currentFrame +
          remainingDecayFrames(
            aura.gaugeUnits,
            aura.decayPerFrame
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
      : this.currentFrame + remainingFrames;
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
    const generationWasCurrent =
      generation === this.frozenGeneration;
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const auraBefore = this.snapshot();
    this.advanceTo(frame);
    const auraAfter = this.snapshot();
    const currentExpiry = this.frozenExpiryFrame();
    if (
      !generationWasCurrent ||
      generation !== this.frozenGeneration ||
      (currentExpiry !== null &&
        currentExpiry !== expectedExpiryFrame)
    ) {
      return {
        generation,
        operation: "stale",
        frame,
        auraBefore,
        auraAfter,
        expiresAtFrame: currentExpiry,
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
      expiresAtFrame: currentExpiry,
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
  ): ElectroChargedStateResult {
    this.advanceTo(frame);
    const auraBefore = this.snapshot();
    const generation = this.electroChargedGeneration;
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
    const streamWasEligible =
      generation === this.electroChargedGeneration &&
      this.electroChargedActive;
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const auraBefore = this.snapshot();
    this.advanceTo(frame);
    const auraAfter = this.snapshot();
    const currentExpiry = this.electroChargedExpiryFrame();
    if (
      !streamWasEligible ||
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
        reason: streamWasEligible
          ? "STALE_EXPIRY_CHECK"
          : "STREAM_ALREADY_INACTIVE"
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

  private quickenExpiryFrame(): number | null {
    const quicken = this.auras.get("quicken");
    if (quicken === undefined || quicken.decayPerFrame <= 0) {
      return null;
    }
    return (
      this.currentFrame +
      remainingDecayFrames(
        quicken.gaugeUnits,
        quicken.decayPerFrame
      )
    );
  }

  private attachQuicken(
    candidateGaugeUnits: number,
    sourceActorId: string
  ): {
    operation: QuickenReactionAudit["operation"];
    generation: number;
    quickenGaugeUnitsBefore: number;
    quickenGaugeUnitsAfter: number;
    decayPerFrame: number;
    expiresAtFrame: number | null;
  } {
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
    return {
      operation,
      generation: this.quickenGeneration,
      quickenGaugeUnitsBefore: cleanGaugeUnits(
        quickenGaugeUnitsBefore
      ),
      quickenGaugeUnitsAfter: cleanGaugeUnits(
        quicken?.gaugeUnits ?? 0
      ),
      decayPerFrame: quicken?.decayPerFrame ?? 0,
      expiresAtFrame: this.quickenExpiryFrame()
    };
  }

  expireQuicken(
    frame: number,
    generation: number,
    expectedExpiryFrame: number
  ): {
    generation: number;
    operation: "expire" | "stale";
    frame: number;
    auraBefore: AuraStateEntry[];
    auraAfter: AuraStateEntry[];
    expiresAtFrame: number | null;
    reason: string;
  } {
    const generationWasCurrent =
      generation === this.quickenGeneration;
    if (frame > this.currentFrame) {
      this.advanceTo(Math.max(this.currentFrame, frame - 1));
    }
    const auraBefore = this.snapshot();
    this.advanceTo(frame);
    const auraAfter = this.snapshot();
    const currentExpiry = this.quickenExpiryFrame();
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
        auraBefore,
        auraAfter,
        expiresAtFrame: currentExpiry,
        reason: "STALE_QUICKEN_EXPIRY_CHECK"
      };
    }
    if (this.quickenGaugeUnits() <= AURA_EPSILON) {
      return {
        generation,
        operation: "expire",
        frame,
        auraBefore,
        auraAfter,
        expiresAtFrame: null,
        reason: "QUICKEN_DECAY_EXPIRED"
      };
    }
    return {
      generation,
      operation: "stale",
      frame,
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
      snapshotFrame: input.frame,
      clockModel: "target-local-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
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
    this.burningFuelAttachedFrame = this.currentFrame;
  }

  private startOrRefreshBurning(
    input: AuraHitInput,
    application: ElementalApplication
  ): BurningReactionAudit | null {
    if (
      this.mode !== "aura-v4" ||
      (input.element !== "pyro" &&
        input.element !== "dendro") ||
      application.gaugeUnits <= AURA_EPSILON
    ) {
      return null;
    }

    const burningGaugeUnitsBefore = this.burningGaugeUnits();
    const fuelGaugeUnitsBefore =
      this.burningFuelGaugeUnits();
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
      this.burningNextTickFrame =
        input.frame + BURNING_TICK_INTERVAL_FRAMES;
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
      fuelExpiresAtFrame: this.burningFuelExpiryFrame(),
      snapshotFrame: input.frame,
      clockModel: "target-local-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      firstTickFrame:
        operation === "start"
          ? input.frame + BURNING_TICK_INTERVAL_FRAMES
          : null,
      nextTickFrame:
        this.burningNextTickFrame < 0
          ? null
          : this.burningNextTickFrame,
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

  prepareBurningTick(
    frame: number,
    generation: number,
    tickIndex: number
  ): BurningTickResult {
    const generationWasCurrent =
      generation === this.burningGeneration;
    this.advanceTo(frame);
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
    if (frame !== this.burningNextTickFrame) {
      return {
        ...base,
        operation: "stale",
        nextTickFrame: this.burningNextTickFrame,
        skipReason: null,
        reason: "UNEXPECTED_TICK_FRAME"
      };
    }
    if (tickIndex !== this.burningNextTickIndex) {
      return {
        ...base,
        operation: "stale",
        nextTickFrame: this.burningNextTickFrame,
        skipReason: null,
        reason: "UNEXPECTED_TICK_INDEX"
      };
    }

    this.burningNextTickFrame =
      frame + BURNING_TICK_INTERVAL_FRAMES;
    this.burningNextTickIndex += 1;
    const skipped =
      tickIndex === BURNING_SKIPPED_TICK_INDEX;
    return {
      ...base,
      operation: skipped ? "tick-skipped" : "tick",
      auraAfter: this.snapshot(),
      nextTickFrame: this.burningNextTickFrame,
      skipReason: skipped ? "COUNTER_9_SKIP" : null,
      reason: null
    };
  }

  expireBurningFuel(
    frame: number,
    generation: number,
    expectedExpiryFrame: number
  ): BurningFuelExpiryResult {
    const generationWasCurrent =
      generation === this.burningGeneration;
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
        this.burningNextTickFrame < 0
          ? null
          : this.burningNextTickFrame,
      fuelExpiresAtFrame: currentExpiry,
      selfDamageStatus:
        "unsupported-player-damage-model",
      reason: refreshed
        ? "BURNING_REFRESHED_BEFORE_EXPIRY"
        : "STALE_BURNING_FUEL_EXPIRY_CHECK"
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
    const applicationSequenceIndex =
      application.icdGroup === "burning"
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
          this.auras.get(auditConsumedAuraElement)?.gaugeUnits ?? 0
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
      !this.hasElectroChargedAuras()
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
        !this.hasElectroChargedAuras()
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
        this.auras.get(auditConsumedAuraElement)?.gaugeUnits ??
          0
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
      this.mode === "aura-v4" && input.element === "pyro";
    let remainingPyroGaugeUnits = application.gaugeUnits;
    let remainingDendroGaugeUnits = application.gaugeUnits;
    const orderedPyroReactions: ReactionType[] = [];
    let orderedPyroTransformativeReaction:
      | OneShotTransformativeReaction
      | null = null;
    let orderedPyroAmplifyingReaction:
      | AmplifyingReaction
      | null = null;
    const eligibleRules =
      frozenMelt ||
      frozenSuperconduct ||
      input.element === "dendro" ||
      usesOrderedPyroPipeline
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
    if (
      this.mode === "aura-v4" &&
      !usesOrderedPyroPipeline &&
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
    const auraConsumed: ReactionAudit["auraConsumed"] = [];
    const burningBeforeReaction = this.captureBurningState();
    let burningReaction: BurningReactionAudit | null = null;

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
        for (const mutation of mutations) {
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
        decayPerFrame: attachment.decayPerFrame,
        expiresAtFrame: attachment.expiresAtFrame,
        pendingHydroBloomFollowup:
          (this.auras.get("hydro")?.gaugeUnits ?? 0) >
          AURA_EPSILON
      };
      catalyzeReaction = {
        quicken: quickenReaction,
        additive: additiveReaction
      };
      automaticReaction = "quicken";
    } else if (unsupportedReactions.length === 0) {
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
      if (automaticReaction === "none") {
        automaticReaction = "burning";
      }
    }

    if (this.mode === "aura-v4") {
      const bloomAuraPresent =
        (this.auras.get("dendro")?.gaugeUnits ?? 0) >
          AURA_EPSILON ||
        this.quickenGaugeUnits() > AURA_EPSILON ||
        this.burningFuelGaugeUnits() > AURA_EPSILON;
      if (
        (input.element === "hydro" && bloomAuraPresent) ||
        (input.element === "dendro" &&
          (this.auras.get("hydro")?.gaugeUnits ?? 0) >
            AURA_EPSILON)
      ) {
        unsupportedReactions.push("bloom");
      }
    }

    if (
      periodicReaction === null &&
      electroChargedWasActive &&
      !this.hasElectroChargedAuras()
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
        : automaticReaction === "none"
          ? []
          : [automaticReaction]),
      ...(burningReaction !== null &&
      burningReaction.operation !== "stop" &&
      (usesOrderedPyroPipeline ||
        automaticReaction !== "burning")
        ? (["burning"] as const)
        : [])
    ];
    let transformativeReaction: ReactionAudit["transformativeReaction"] =
      null;
    const oneShotTransformativeReaction =
      orderedPyroTransformativeReaction ??
      (isOneShotTransformativeReaction(automaticReaction)
        ? automaticReaction
        : null);
    if (oneShotTransformativeReaction !== null) {
      const definition =
        TRANSFORMATIVE_REACTION_DEFINITIONS[
          oneShotTransformativeReaction
        ];
      const previousReadyFrame =
        this.reactionDamageReadyFrames.get(
          oneShotTransformativeReaction
        ) ?? -1;
      const scheduled =
        previousReadyFrame < 0 ||
        input.frame >= previousReadyFrame;
      const nextAvailableFrame = scheduled
        ? input.frame + definition.damageGcdFrames
        : previousReadyFrame;
      if (scheduled) {
        this.reactionDamageReadyFrames.set(
          oneShotTransformativeReaction,
          nextAvailableFrame
        );
      }
      transformativeReaction = {
        reaction: oneShotTransformativeReaction,
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

    const mechanicsTruncation =
      unsupportedReactions.length === 0
        ? null
        : this.triggerMechanicsTruncation(
            input.frame,
            unsupportedReactions
          );
    if (
      mechanicsTruncation !== null &&
      transformativeReaction?.scheduled === true
    ) {
      transformativeReaction = {
        ...transformativeReaction,
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION"
      };
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
        ? "固定 gcsim 会在同帧末尾继续检查激元素与水的绽放；该后续尚未实现并已明确截断。"
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
      periodicReaction,
      frozenReaction,
      shatterReaction: null,
      swirlReactions: [],
      swirlDamageGroup: null,
      crystallizeReaction: null,
      catalyzeReaction,
      burningReaction,
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
