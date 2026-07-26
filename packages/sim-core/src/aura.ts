import type {
  AmplifyingReaction,
  AuraElement,
  AuraReactionEngineConfig,
  AuraStateEntry,
  Element,
  ElementalApplication,
  IcdProfile,
  ReactionAudit
} from "@genshin-dps-lab/schemas";

const AURA_EPSILON = 1e-10;
const NORMAL_AURA_RATIO = 0.8;
const NORMAL_AURA_BASE_DURATION_FRAMES = 420;
const NORMAL_AURA_DURATION_PER_UNIT_FRAMES = 6;
const DEFAULT_ICD_RESET_FRAMES = 150;
const DEFAULT_ICD_SEQUENCE = [true, false, false] as const;
const BUILT_IN_DEFAULT_ICD_PROFILE: IcdProfile = {
  resetFrames: DEFAULT_ICD_RESET_FRAMES,
  applicationSequence: [...DEFAULT_ICD_SEQUENCE]
};

interface MutableAura {
  element: AuraElement;
  gaugeUnits: number;
  decayPerFrame: number;
}

interface IcdState {
  windowStartFrame: number;
  hitCount: number;
}

interface ReactionRule {
  auraElement: AuraElement;
  reaction: AmplifyingReaction;
  consumptionFactor: number;
}

export interface AuraHitInput {
  frame: number;
  sourceActorId: string;
  element: Element;
  application?: ElementalApplication;
  reactionOverride?: AmplifyingReaction;
}

const REACTION_RULES: Record<AuraElement, readonly ReactionRule[]> = {
  // gcsim checks Vaporize before Melt for incoming Pyro.
  pyro: [
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
      auraElement: "pyro",
      reaction: "reverseMelt",
      consumptionFactor: 0.5
    }
  ],
  hydro: [
    {
      auraElement: "pyro",
      reaction: "vaporize",
      consumptionFactor: 2
    }
  ]
};

function isAuraElement(element: Element): element is AuraElement {
  return element === "pyro" || element === "cryo" || element === "hydro";
}

function cleanGaugeUnits(value: number): number {
  if (Math.abs(value) <= AURA_EPSILON) return 0;
  return Number(value.toFixed(12));
}

/**
 * Minimal deterministic Aura/ICD engine for Milestone 3.
 *
 * It deliberately models only normal Pyro/Cryo/Hydro aura, amplifying
 * Melt/Vaporize, default 3-hit/2.5s ICD, and no-ICD applications. Coexistence,
 * transformative reactions, elemental shields, and per-source overlap arrays
 * remain future mechanics work.
 */
export class AuraEngine {
  private readonly auras = new Map<AuraElement, MutableAura>();
  private readonly icdStates = new Map<string, IcdState>();
  private readonly icdProfiles: Readonly<Record<string, IcdProfile>>;
  private readonly debugAllowReactionOverride: boolean;
  private currentFrame = 0;

  constructor(config: AuraReactionEngineConfig) {
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

  private advanceTo(frame: number): void {
    if (!Number.isInteger(frame) || frame < this.currentFrame) {
      throw new Error(
        `AuraEngine frames must be non-decreasing integers; got ${frame} after ${this.currentFrame}`
      );
    }
    const elapsed = frame - this.currentFrame;
    if (elapsed > 0) {
      for (const [element, aura] of this.auras) {
        aura.gaugeUnits -= aura.decayPerFrame * elapsed;
        if (aura.gaugeUnits <= AURA_EPSILON) {
          this.auras.delete(element);
        }
      }
      this.currentFrame = frame;
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
          aura.decayPerFrame > 0
            ? this.currentFrame +
              Math.ceil(aura.gaugeUnits / aura.decayPerFrame)
            : null
      }));
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

    // Cryo/Hydro use overlap semantics. This single-target v1 state keeps the
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

  processHit(input: AuraHitInput): ReactionAudit {
    this.advanceTo(input.frame);
    const auraBefore = this.snapshot();
    const application = input.application;

    if (!application || !isAuraElement(input.element)) {
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
        note: `ICD Profile "${application.icdGroup}" 阻止本段附着与反应。`
      };
    }

    const auraApplied = [
      {
        element: input.element,
        gaugeUnits: application.gaugeUnits
      }
    ];
    const rule = REACTION_RULES[input.element].find(
      (candidate) =>
        (this.auras.get(candidate.auraElement)?.gaugeUnits ?? 0) >
        AURA_EPSILON
    );
    let automaticReaction: AmplifyingReaction = "none";
    const auraConsumed: ReactionAudit["auraConsumed"] = [];

    if (rule) {
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

    const debugOverride =
      this.debugAllowReactionOverride &&
      input.reactionOverride !== undefined &&
      input.reactionOverride !== "none"
        ? input.reactionOverride
        : null;
    const reaction = debugOverride ?? automaticReaction;

    return {
      model: debugOverride === null ? "aura-engine" : "manual-override",
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
      note:
        debugOverride === null
          ? automaticReaction === "none"
            ? "附着通过 ICD；未找到可触发增幅反应的敌方 Aura。"
            : "反应由命中元素、敌方 Aura、元素量与 ICD 自动判定。"
          : "调试模式 reactionOverride 覆盖了自动反应结果。"
    };
  }
}

export const AURA_ENGINE_CONSTANTS = {
  normalAuraRatio: NORMAL_AURA_RATIO,
  normalAuraBaseDurationFrames: NORMAL_AURA_BASE_DURATION_FRAMES,
  normalAuraDurationPerUnitFrames: NORMAL_AURA_DURATION_PER_UNIT_FRAMES,
  defaultIcdResetFrames: DEFAULT_ICD_RESET_FRAMES,
  defaultIcdSequence: DEFAULT_ICD_SEQUENCE,
  builtInDefaultIcdProfile: BUILT_IN_DEFAULT_ICD_PROFILE
} as const;
