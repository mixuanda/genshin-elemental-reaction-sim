import type {
  AmplifyingReaction,
  AuraElement,
  AuraReactionEngineConfig,
  AuraStateElement,
  AuraStateEntry,
  Element,
  ElementalApplication,
  IcdProfile,
  OneShotTransformativeReaction,
  ReactionType,
  ReactionAudit,
  ShatterReactionAudit,
  StrikeType,
  SwirlReaction,
  SwirlReactionAudit,
  TransformativeReaction
} from "@genshin-dps-lab/schemas";

const AURA_EPSILON = 1e-10;
const NORMAL_AURA_RATIO = 0.8;
const NORMAL_AURA_BASE_DURATION_FRAMES = 420;
const NORMAL_AURA_DURATION_PER_UNIT_FRAMES = 6;
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
const BUILT_IN_DEFAULT_ICD_PROFILE: IcdProfile = {
  resetFrames: DEFAULT_ICD_RESET_FRAMES,
  applicationSequence: [...DEFAULT_ICD_SEQUENCE]
};

interface MutableAura {
  element: AuraStateElement;
  gaugeUnits: number;
  decayPerFrame: number;
}

interface IcdState {
  windowStartFrame: number;
  hitCount: number;
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
    reaction === "swirlElectro"
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
): element is AuraElement | "anemo" {
  return (
    element === "pyro" ||
    element === "cryo" ||
    element === "hydro" ||
    (mode === "aura-v2" &&
      (element === "electro" || element === "anemo"))
  );
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
 * Coexistence beyond Hydro/Electro, the remaining reactions, elemental
 * shields, and per-source overlap arrays remain future mechanics work.
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
  private shatterDamageReadyFrame = -1;
  private readonly swirlDamageReadyFrames = new Map<
    SwirlReaction,
    number
  >();
  private currentFrame = 0;

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
      ...(config.icdProfiles ?? {})
    };
    for (const initial of config.initialAura ?? []) {
      this.attachNormalAura(initial.element, initial.gaugeUnits);
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
      for (const [element, aura] of this.auras) {
        if (element === "frozen") continue;
        aura.gaugeUnits -= aura.decayPerFrame * elapsed;
        if (aura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete(element);
        }
      }
      this.advanceFrozenBy(elapsed);
      this.currentFrame = frame;
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
          aura.element === "frozen"
            ? this.frozenExpiryFrame()
            : aura.decayPerFrame > 0
              ? this.currentFrame +
                remainingDecayFrames(
                  aura.gaugeUnits,
                  aura.decayPerFrame
                )
              : null
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
      const aura = this.auras.get(element);
      if (!aura) continue;
      const consumed = Math.min(
        aura.gaugeUnits,
        ELECTRO_CHARGED_WANE_GAUGE_UNITS
      );
      aura.gaugeUnits -= consumed;
      auraConsumed.push({
        element,
        gaugeUnits: cleanGaugeUnits(consumed)
      });
      if (aura.gaugeUnits <= AURA_EPSILON) {
        this.auras.delete(element);
      }
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

  private attachNormalAura(element: AuraElement, nominalGaugeUnits: number): void {
    const appliedGaugeUnits = NORMAL_AURA_RATIO * nominalGaugeUnits;
    const durationFrames =
      NORMAL_AURA_BASE_DURATION_FRAMES +
      NORMAL_AURA_DURATION_PER_UNIT_FRAMES * nominalGaugeUnits;
    const nextDecayPerFrame = appliedGaugeUnits / durationFrames;
    const existing = this.auras.get(element);

    if (!existing) {
      this.auras.set(element, {
        element,
        gaugeUnits: appliedGaugeUnits,
        decayPerFrame: nextDecayPerFrame
      });
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

    // Cryo/Hydro/Electro use overlap semantics. This per-target state keeps the
    // stronger remaining aura; per-source overlap arrays are intentionally not
    // yet represented.
    if (appliedGaugeUnits > existing.gaugeUnits) {
      existing.gaugeUnits = appliedGaugeUnits;
    }
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
    const key = `${sourceActorId}\u0000${application.icdTag}\u0000${application.icdGroup}`;
    const existing = this.icdStates.get(key);
    const state =
      existing === undefined ||
      frame - existing.windowStartFrame >= profile.resetFrames
        ? { windowStartFrame: frame, hitCount: 0 }
        : existing;
    const allowed =
      profile.applicationSequence[
        state.hitCount % profile.applicationSequence.length
      ] ?? false;
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
        gaugeUnits: application.gaugeUnits
      }
    ];
    const auraConsumed: NonNullable<ReactionAudit["auraConsumed"]> = [];
    const swirlReactions: SwirlReactionAudit[] = [];
    let frozenReaction: ReactionAudit["frozenReaction"] = null;

    const trySwirl = (
      consumedAuraElement: AuraStateElement,
      swirledElement: AuraElement,
      reaction: SwirlReaction
    ): boolean => {
      if (remainingSourceGaugeUnits <= AURA_EPSILON) return false;
      const aura = this.auras.get(consumedAuraElement);
      if (aura === undefined || aura.gaugeUnits <= AURA_EPSILON) {
        return false;
      }

      const sourceGaugeUnitsBefore = remainingSourceGaugeUnits;
      const auraGaugeUnitsBefore = aura.gaugeUnits;
      const auraConsumedGaugeUnits = Math.min(
        auraGaugeUnitsBefore,
        sourceGaugeUnitsBefore * SWIRL_AURA_CONSUMPTION_FACTOR
      );
      const sourceGaugeUnitsSpent =
        auraConsumedGaugeUnits / SWIRL_AURA_CONSUMPTION_FACTOR;
      remainingSourceGaugeUnits = cleanGaugeUnits(
        Math.max(0, remainingSourceGaugeUnits - sourceGaugeUnitsSpent)
      );
      aura.gaugeUnits -= auraConsumedGaugeUnits;
      if (aura.gaugeUnits <= AURA_EPSILON) {
        this.auras.delete(consumedAuraElement);
      }
      auraConsumed.push({
        element: consumedAuraElement,
        gaugeUnits: cleanGaugeUnits(auraConsumedGaugeUnits)
      });

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

      if (consumedAuraElement === "frozen") {
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
        consumedAuraElement,
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
          this.auras.get(consumedAuraElement)?.gaugeUnits ?? 0
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
      note:
        firstSwirl === null
          ? "风元素附着通过 ICD；当前没有可扩散的火/水/冰/雷/冻元素 Aura。"
          : `${swirlReactions.length} 次扩散判定消耗了 Aura；仅通过各元素 6 帧队列 GCD 的判定会排入 1f 自身伤害与 5f 传播攻击。`
    };
  }

  processHit(input: AuraHitInput): ReactionAudit {
    this.advanceTo(input.frame);
    const auraBefore = this.snapshot();
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

    const auraApplied = [
      {
        element: input.element,
        gaugeUnits: application.gaugeUnits
      }
    ];
    const frozenPresent =
      this.frozenGaugeUnits() > AURA_EPSILON;
    const frozenMelt =
      this.mode === "aura-v2" &&
      input.element === "pyro" &&
      frozenPresent &&
      (this.auras.get("electro")?.gaugeUnits ?? 0) <=
        AURA_EPSILON;
    const frozenSuperconduct =
      this.mode === "aura-v2" &&
      input.element === "electro" &&
      frozenPresent &&
      (this.auras.get("pyro")?.gaugeUnits ?? 0) <=
        AURA_EPSILON;
    const rule = frozenMelt || frozenSuperconduct
      ? undefined
      : REACTION_RULES[input.element].find(
          (candidate) =>
            (this.mode === "aura-v2" ||
              !requiresAuraV2(candidate.reaction)) &&
            !(
              frozenPresent &&
              (candidate.reaction === "electroCharged" ||
                candidate.reaction === "reverseVaporize" ||
                (input.element === "cryo" &&
                  candidate.reaction === "superconduct"))
            ) &&
            (this.auras.get(candidate.auraElement)?.gaugeUnits ?? 0) >
              AURA_EPSILON
        );
    let automaticReaction: ReactionType = "none";
    const auraConsumed: ReactionAudit["auraConsumed"] = [];

    let periodicReaction: ReactionAudit["periodicReaction"] = null;
    let frozenReaction: ReactionAudit["frozenReaction"] = null;
    if (frozenMelt) {
      const cryoAura = this.auras.get("cryo");
      if (cryoAura !== undefined) {
        const consumedCryo = Math.min(
          cryoAura.gaugeUnits,
          application.gaugeUnits * 2
        );
        cryoAura.gaugeUnits -= consumedCryo;
        auraConsumed.push({
          element: "cryo",
          gaugeUnits: cleanGaugeUnits(consumedCryo)
        });
        if (cryoAura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete("cryo");
        }
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
        const consumedCryo = Math.min(
          cryoAura.gaugeUnits,
          remainingGaugeUnits
        );
        cryoAura.gaugeUnits -= consumedCryo;
        remainingGaugeUnits -= consumedCryo;
        auraConsumed.push({
          element: "cryo",
          gaugeUnits: cleanGaugeUnits(consumedCryo)
        });
        if (cryoAura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete("cryo");
        }
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
      this.attachNormalAura(input.element, application.gaugeUnits);
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
        const consumedGaugeUnits = Math.min(
          targetAura.gaugeUnits,
          application.gaugeUnits
        );
        targetAura.gaugeUnits -= consumedGaugeUnits;
        if (targetAura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete(rule.auraElement);
        }
        auraConsumed.push({
          element: rule.auraElement,
          gaugeUnits: cleanGaugeUnits(consumedGaugeUnits)
        });
        const frozenBefore = this.frozenGaugeUnits();
        const frozenAttachment = this.attachFrozen(
          2 * consumedGaugeUnits
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
      const targetAura = this.auras.get(rule.auraElement);
      if (targetAura) {
        const consumedGaugeUnits = Math.min(
          targetAura.gaugeUnits,
          application.gaugeUnits * rule.consumptionFactor
        );
        targetAura.gaugeUnits -= consumedGaugeUnits;
        if (targetAura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete(rule.auraElement);
        }
        auraConsumed.push({
          element: rule.auraElement,
          gaugeUnits: cleanGaugeUnits(consumedGaugeUnits)
        });
        automaticReaction = rule.reaction;
      }
    } else {
      this.attachNormalAura(input.element, application.gaugeUnits);
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

    const reaction = automaticReaction;
    let transformativeReaction: ReactionAudit["transformativeReaction"] =
      null;
    if (
      isOneShotTransformativeReaction(automaticReaction)
    ) {
      const definition =
        TRANSFORMATIVE_REACTION_DEFINITIONS[automaticReaction];
      const previousReadyFrame =
        this.reactionDamageReadyFrames.get(automaticReaction) ?? -1;
      const scheduled =
        previousReadyFrame < 0 ||
        input.frame >= previousReadyFrame;
      const nextAvailableFrame = scheduled
        ? input.frame + definition.damageGcdFrames
        : previousReadyFrame;
      if (scheduled) {
        this.reactionDamageReadyFrames.set(
          automaticReaction,
          nextAvailableFrame
        );
      }
      transformativeReaction = {
        reaction: automaticReaction,
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

    const reactionNote =
      automaticReaction === "none"
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
              : `${automaticReaction === "overload" ? "超载" : "超导"}已触发并消耗 Aura；独立反应伤害被同目标 6 帧 GCD 阻止。`
            : "反应由命中元素、敌方 Aura、元素量与 ICD 自动判定。";
    return {
      model: "aura-engine",
      triggered: reaction !== "none",
      reaction,
      icdAllowed,
      icdTag: application.icdTag,
      icdGroup: application.icdGroup,
      applicationGaugeUnits: application.gaugeUnits,
      auraBefore,
      auraApplied,
      auraConsumed,
      auraAfter: this.snapshot(),
      transformativeReaction,
      periodicReaction,
      frozenReaction,
      shatterReaction: null,
      swirlReactions: [],
      swirlDamageGroup: null,
      note:
        periodicReaction?.operation === "stop"
          ? `${reactionNote}；本次命中移除了水雷共存，感电周期流在同帧停止。`
          : frozenReaction?.operation === "consume"
            ? `${reactionNote}；本次${automaticReaction === "melt" ? "融化" : "超导"}消耗了冻元素耐久。`
          : reactionNote
    };
  }
}

export const AURA_ENGINE_CONSTANTS = {
  normalAuraRatio: NORMAL_AURA_RATIO,
  normalAuraBaseDurationFrames: NORMAL_AURA_BASE_DURATION_FRAMES,
  normalAuraDurationPerUnitFrames: NORMAL_AURA_DURATION_PER_UNIT_FRAMES,
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
  frozenBaseDecayPerFrame: FROZEN_BASE_DECAY_PER_FRAME,
  frozenDecayAccelerationPerFrame:
    FROZEN_DECAY_ACCELERATION_PER_FRAME,
  frozenPoiseDamageToGaugeUnits:
    FROZEN_POISE_DAMAGE_TO_GAUGE_UNITS,
  shatterGaugeConsumptionUnits:
    SHATTER_GAUGE_CONSUMPTION_UNITS,
  shatterDamageGcdFrames: SHATTER_DAMAGE_GCD_FRAMES,
  shatterBaseMultiplier: SHATTER_BASE_MULTIPLIER
} as const;
