import type { RefinementCtx } from "zod";
import {
  CLASSIC_REACTION_FORMULA_PROFILE,
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT
} from "@genshin-dps-lab/reaction-formulas";
import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_DAMAGE_GROUP_ROOT,
  resolveDamageGroup,
  type GcsimDamageGroupId
} from "@genshin-dps-lab/icd-profiles";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  REACTION_FORMULA_RUN_MANIFEST_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  type AuraGaugeEntry,
  type AuraReactionEngineConfig,
  type AuraStateEntry,
  type CharacterStats,
  type DamageEvent,
  type HitDefinition,
  type ScalingStat,
  type SimulationResult,
  type StatusTarget
} from "./types";
import {
  canonicalStringify,
  createSimulationConfigHash,
  createSimulationReproducibilityKey
} from "./reproducibility";
import { calcCrystallizeShield } from "./crystallize";
import { validateEnergyReplayIntegrity } from "./energy-replay-integrity";
import { validateParticleProvenanceIntegrity } from "./particle-provenance-integrity";
import { targetPhaseV2ResultReferencesSchema } from "./schema";
import { validateTargetPhaseV3Integrity } from "./target-phase-v3-integrity";

type IssuePath = Array<string | number>;

const FLOAT_TOLERANCE = 1e-9;
const AURA_GAUGE_EPSILON = 1e-10;
const AURA_GAUGE_ROUNDING_RADIUS = 0.5e-12;
const AURA_DECAY_CEIL_BIAS = 1e-9;
const NORMAL_AURA_RATIO = 0.8;
const NORMAL_AURA_BASE_DURATION_FRAMES = 420;
const LEGACY_NORMAL_AURA_DURATION_PER_UNIT_FRAMES = 6;
const CURRENT_NORMAL_AURA_DURATION_PER_UNIT_FRAMES = 150;
const ELECTRO_CHARGED_BASE_MULTIPLIER = 2;
const ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES = 10;
const ELECTRO_CHARGED_TICK_INTERVAL_FRAMES = 60;
const ELECTRO_CHARGED_WANE_DELAY_FRAMES = 6;
const ELECTRO_CHARGED_WANE_GAUGE_UNITS = 0.4;
const FROZEN_BASE_DECAY_PER_FRAME = 0.4 / 60;
const FROZEN_DECAY_ACCELERATION_PER_FRAME =
  0.1 / (60 * 60);
const BURNING_TICK_INTERVAL_FRAMES = 15;
const BURNING_SKIPPED_TICK_INDEX = 9;
const BURNING_FUEL_DECAY_PER_FRAME = 0.4 / 60;
const BURNING_ICD_RESET_FRAMES = 120;
const BURNING_APPLICATION_GAUGE_UNITS = 1;
const BURNING_MARKER_GAUGE_UNITS = 2;
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

function usesCurrentAuraDurability(
  mode: AuraReactionEngineConfig["mode"] | undefined
): boolean {
  return (
    mode === "aura-v3" ||
    mode === "aura-v4" ||
    mode === "aura-v5" ||
    mode === "aura-v6" ||
    mode === "aura-v7" ||
    mode === "aura-v8" ||
    mode === "aura-v9"
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function totalScalingStat(
  stats: CharacterStats,
  stat: ScalingStat
): number {
  switch (stat) {
    case "atk":
      return stats.baseAtk * (1 + stats.atkPct) + stats.flatAtk;
    case "hp":
      return stats.baseHp * (1 + stats.hpPct) + stats.flatHp;
    case "def":
      return stats.baseDef * (1 + stats.defPct) + stats.flatDef;
    case "em":
      return stats.em;
  }
}

function resistanceMultiplier(resistance: number): number {
  if (resistance < 0) return 1 - resistance / 2;
  if (resistance < 0.75) return 1 - resistance;
  return 1 / (4 * resistance + 1);
}

function transformativeDamageElement(
  reaction: SimulationResult["reactionDamageLog"][number]["reaction"]
): DamageEvent["element"] {
  switch (reaction) {
    case "overload":
    case "burning":
      return "pyro";
    case "superconduct":
      return "cryo";
    case "electroCharged":
      return "electro";
    case "shatter":
      return "physical";
    case "swirlPyro":
      return "pyro";
    case "swirlHydro":
      return "hydro";
    case "swirlCryo":
      return "cryo";
    case "swirlElectro":
      return "electro";
    case "bloom":
    case "burgeon":
    case "hyperbloom":
      return "dendro";
  }
}

function hasValidReactionDeliveryShape(
  parent: SimulationResult["reactionDamageLog"][number]
): boolean {
  switch (parent.reaction) {
    case "overload":
    case "superconduct":
      return (
        parent.scheduleKind === "one-shot" &&
        parent.targetingMode === "radius"
      );
    case "electroCharged":
      return (
        parent.scheduleKind === "periodic-tick" &&
        (parent.targetingMode === "single-target" ||
          parent.targetingMode ===
            "electro-charged-nearby-wet")
      );
    case "burning":
      return (
        parent.scheduleKind === "burning-tick" &&
        parent.targetingMode === "radius"
      );
    case "shatter":
      return (
        parent.scheduleKind === "one-shot" &&
        parent.targetingMode === "single-target"
      );
    case "swirlPyro":
    case "swirlHydro":
    case "swirlCryo":
    case "swirlElectro":
      return (
        (parent.scheduleKind === "swirl-self" &&
          parent.targetingMode === "single-target") ||
        (parent.scheduleKind === "swirl-propagation" &&
          parent.targetingMode === "radius")
      );
    case "bloom":
      return (
        parent.scheduleKind === "dendro-core-bloom" &&
        parent.targetingMode === "radius"
      );
    case "burgeon":
      return (
        parent.scheduleKind === "dendro-core-burgeon" &&
        parent.targetingMode === "radius"
      );
    case "hyperbloom":
      return (
        parent.scheduleKind === "dendro-core-hyperbloom" &&
        parent.targetingMode === "nearest-target-radius"
      );
  }
}

function nearlyEqual(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  return (
    Math.abs(left - right) <=
    FLOAT_TOLERANCE *
      Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function canonicalSerializedAuraGauge(value: number): number {
  return Number(value.toFixed(12));
}

function electroChargedWaneAfterGaugeCandidates(
  beforeGaugeUnits: number
): number[] {
  if (
    beforeGaugeUnits <= ELECTRO_CHARGED_WANE_GAUGE_UNITS
  ) {
    return [0];
  }
  const roundedResidual = canonicalSerializedAuraGauge(
    beforeGaugeUnits - ELECTRO_CHARGED_WANE_GAUGE_UNITS
  );
  const rawResidualMinimum =
    beforeGaugeUnits -
    AURA_GAUGE_ROUNDING_RADIUS -
    ELECTRO_CHARGED_WANE_GAUGE_UNITS;
  const rawResidualMaximum =
    beforeGaugeUnits +
    AURA_GAUGE_ROUNDING_RADIUS -
    ELECTRO_CHARGED_WANE_GAUGE_UNITS;
  if (rawResidualMaximum <= AURA_GAUGE_EPSILON) {
    return [0];
  }
  if (rawResidualMinimum > AURA_GAUGE_EPSILON) {
    return [roundedResidual];
  }
  return roundedResidual === 0
    ? [0]
    : [0, roundedResidual];
}

function semanticEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  return canonicalStringify(left) === canonicalStringify(right);
}

function auraStateProjectionEqual(
  left: readonly AuraStateEntry[],
  right: readonly AuraStateEntry[]
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftEntry = left[index]!;
    const rightEntry = right[index]!;
    if (
      leftEntry.element !== rightEntry.element ||
      !nearlyEqual(leftEntry.gaugeUnits, rightEntry.gaugeUnits) ||
      leftEntry.expiresAtFrame !== rightEntry.expiresAtFrame ||
      leftEntry.expiresAtTargetFrame !==
        rightEntry.expiresAtTargetFrame
    ) {
      return false;
    }
    const leftSlots = leftEntry.sourceSlots;
    const rightSlots = rightEntry.sourceSlots;
    if ((leftSlots === undefined) !== (rightSlots === undefined)) {
      return false;
    }
    if (leftSlots === undefined || rightSlots === undefined) {
      continue;
    }
    if (leftSlots.length !== rightSlots.length) return false;
    for (
      let slotIndex = 0;
      slotIndex < leftSlots.length;
      slotIndex += 1
    ) {
      const leftSlot = leftSlots[slotIndex]!;
      const rightSlot = rightSlots[slotIndex]!;
      if (
        leftSlot.sourceActorId !== rightSlot.sourceActorId ||
        !nearlyEqual(leftSlot.gaugeUnits, rightSlot.gaugeUnits)
      ) {
        return false;
      }
    }
  }
  return true;
}

function auraGaugeProjectionEqual(
  left: readonly AuraGaugeEntry[],
  right: readonly AuraGaugeEntry[]
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftEntry = left[index]!;
    const rightEntry = right[index]!;
    if (
      leftEntry.element !== rightEntry.element ||
      !nearlyEqual(leftEntry.gaugeUnits, rightEntry.gaugeUnits) ||
      leftEntry.sourceActorId !== rightEntry.sourceActorId
    ) {
      return false;
    }
    const leftMutations = leftEntry.sourceMutations;
    const rightMutations = rightEntry.sourceMutations;
    if (
      (leftMutations === undefined) !==
      (rightMutations === undefined)
    ) {
      return false;
    }
    if (
      leftMutations === undefined ||
      rightMutations === undefined
    ) {
      continue;
    }
    if (leftMutations.length !== rightMutations.length) return false;
    for (
      let mutationIndex = 0;
      mutationIndex < leftMutations.length;
      mutationIndex += 1
    ) {
      const leftMutation = leftMutations[mutationIndex]!;
      const rightMutation = rightMutations[mutationIndex]!;
      if (
        leftMutation.sourceActorId !==
          rightMutation.sourceActorId ||
        !nearlyEqual(
          leftMutation.gaugeUnitsBefore,
          rightMutation.gaugeUnitsBefore
        ) ||
        !nearlyEqual(
          leftMutation.consumedGaugeUnits,
          rightMutation.consumedGaugeUnits
        ) ||
        !nearlyEqual(
          leftMutation.gaugeUnitsAfter,
          rightMutation.gaugeUnitsAfter
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function electroChargedCoexistenceExpiryFrame(
  snapshot: readonly AuraStateEntry[]
): number | null {
  const hydro = snapshot.find(
    (entry) =>
      entry.element === "hydro" &&
      entry.gaugeUnits >= AURA_GAUGE_EPSILON
  );
  const electro = snapshot.find(
    (entry) =>
      entry.element === "electro" &&
      entry.gaugeUnits >= AURA_GAUGE_EPSILON
  );
  if (hydro === undefined || electro === undefined) return null;
  const deadlines = [
    hydro.expiresAtFrame,
    electro.expiresAtFrame
  ].filter((frame): frame is number => frame !== null);
  return deadlines.length === 0 ? null : Math.min(...deadlines);
}

function hasElectroChargedCoexistence(
  snapshot: readonly AuraStateEntry[]
): boolean {
  return (
    snapshot.some(
      (entry) =>
        entry.element === "hydro" &&
        entry.gaugeUnits >= AURA_GAUGE_EPSILON
    ) &&
    snapshot.some(
      (entry) =>
        entry.element === "electro" &&
        entry.gaugeUnits >= AURA_GAUGE_EPSILON
    )
  );
}

function validateElectroChargedWaneAuraDeadline(
  context: RefinementCtx,
  path: IssuePath,
  currentGlobalFrame: number,
  currentTargetFrame: number | null,
  before: AuraStateEntry,
  after: AuraStateEntry
): number | null {
  if (
    before.expiresAtFrame === null ||
    after.expiresAtFrame === null
  ) {
    addIssue(
      context,
      path,
      "Electro-Charged Wane normal Aura requires a finite decay deadline"
    );
    return null;
  }

  let beforeRemainingFrames: number;
  let afterRemainingFrames: number;
  let projectedFrozenFrames: number | null = null;
  if (currentTargetFrame === null) {
    if (
      before.expiresAtTargetFrame !== undefined ||
      after.expiresAtTargetFrame !== undefined
    ) {
      addIssue(
        context,
        path,
        "global-clock Electro-Charged Wane Aura cannot claim target-local deadlines"
      );
    }
    beforeRemainingFrames =
      before.expiresAtFrame - currentGlobalFrame;
    afterRemainingFrames =
      after.expiresAtFrame - currentGlobalFrame;
  } else {
    if (
      before.expiresAtTargetFrame === undefined ||
      before.expiresAtTargetFrame === null ||
      after.expiresAtTargetFrame === undefined ||
      after.expiresAtTargetFrame === null
    ) {
      addIssue(
        context,
        path,
        "Hitlag-aware Electro-Charged Wane Aura requires target-local decay deadlines"
      );
      return null;
    }
    beforeRemainingFrames =
      before.expiresAtTargetFrame - currentTargetFrame;
    afterRemainingFrames =
      after.expiresAtTargetFrame - currentTargetFrame;
    const frozenFramesBefore =
      before.expiresAtFrame -
      currentGlobalFrame -
      beforeRemainingFrames;
    const frozenFramesAfter =
      after.expiresAtFrame -
      currentGlobalFrame -
      afterRemainingFrames;
    projectedFrozenFrames = frozenFramesBefore;
    if (frozenFramesBefore < 0 || frozenFramesAfter < 0) {
      addIssue(
        context,
        path,
        "Electro-Charged Wane target-clock projection cannot have negative pending Hitlag"
      );
    }
    expectEqual(
      context,
      path,
      frozenFramesAfter,
      frozenFramesBefore,
      "Electro-Charged Wane target-clock projection"
    );
  }

  if (beforeRemainingFrames < 0 || afterRemainingFrames < 0) {
    addIssue(
      context,
      path,
      "Electro-Charged Wane retained Aura cannot have a past decay deadline"
    );
    return projectedFrozenFrames;
  }

  // Aura snapshots round Gauge to 12 decimal places, while the engine keeps
  // the unrounded value and applies ceil(gauge / decay - 1e-9). Each rounded
  // Gauge/deadline pair therefore implies an interval of possible decay
  // rates. Before and after must admit at least one shared rate.
  const beforeGaugeMinimum = Math.max(
    AURA_GAUGE_EPSILON,
    before.gaugeUnits - AURA_GAUGE_ROUNDING_RADIUS
  );
  const beforeGaugeMaximum =
    before.gaugeUnits + AURA_GAUGE_ROUNDING_RADIUS;
  const afterGaugeMinimum = Math.max(
    AURA_GAUGE_EPSILON,
    after.gaugeUnits - AURA_GAUGE_ROUNDING_RADIUS
  );
  const afterGaugeMaximum =
    after.gaugeUnits + AURA_GAUGE_ROUNDING_RADIUS;
  const decayInterval = (
    gaugeMinimum: number,
    gaugeMaximum: number,
    remainingFrames: number
  ): { minimum: number; maximum: number } =>
    remainingFrames === 0
      ? {
          minimum:
            gaugeMinimum / AURA_DECAY_CEIL_BIAS,
          maximum: Number.POSITIVE_INFINITY
        }
      : {
          minimum:
            gaugeMinimum /
            (remainingFrames + AURA_DECAY_CEIL_BIAS),
          maximum:
            gaugeMaximum /
            (remainingFrames - 1 + AURA_DECAY_CEIL_BIAS)
        };
  const beforeDecay = decayInterval(
    beforeGaugeMinimum,
    beforeGaugeMaximum,
    beforeRemainingFrames
  );
  const afterDecay = decayInterval(
    afterGaugeMinimum,
    afterGaugeMaximum,
    afterRemainingFrames
  );
  const sharedDecayMinimum = Math.max(
    beforeDecay.minimum,
    afterDecay.minimum
  );
  const sharedDecayMaximum = Math.min(
    beforeDecay.maximum,
    afterDecay.maximum
  );
  if (
    afterRemainingFrames > beforeRemainingFrames ||
    (Number.isFinite(sharedDecayMaximum) &&
      sharedDecayMinimum >= sharedDecayMaximum)
  ) {
    addIssue(
      context,
      path,
      "Electro-Charged Wane Aura deadline must retain one feasible pre-Wane decay rate"
    );
  }
  return projectedFrozenFrames;
}

function validateElectroChargedWaneAuraMutation(
  context: RefinementCtx,
  path: IssuePath,
  currentGlobalFrame: number,
  currentTargetFrame: number | null,
  before: readonly AuraStateEntry[],
  consumed: readonly AuraGaugeEntry[],
  after: readonly AuraStateEntry[]
): void {
  const elements = ["hydro", "electro"] as const;
  let sharedProjectedFrozenFrames: number | null = null;
  const consumedElementIndexes = consumed.map((entry) =>
    elements.indexOf(entry.element as (typeof elements)[number])
  );
  if (
    consumedElementIndexes.some((index) => index < 0) ||
    new Set(consumedElementIndexes).size !== consumed.length ||
    consumedElementIndexes.some(
      (index, position) =>
        position > 0 &&
        index <= consumedElementIndexes[position - 1]!
    )
  ) {
    addIssue(
      context,
      path,
      "Electro-Charged Wane consumption must be the canonical Hydro-then-Electro subsequence"
    );
    return;
  }

  for (const element of elements) {
    const beforeEntries = before.filter(
      (entry) => entry.element === element
    );
    const afterEntries = after.filter(
      (entry) => entry.element === element
    );
    const consumedEntry = consumed.find(
      (entry) => entry.element === element
    );
    const beforeEntry = beforeEntries[0];
    if (
      beforeEntries.length !== 1 ||
      afterEntries.length > 1 ||
      beforeEntry === undefined
    ) {
      addIssue(
        context,
        path,
        `Electro-Charged Wane requires one ${element} Aura before the callback`
      );
      continue;
    }

    const expectedConsumedGauge = Math.min(
      ELECTRO_CHARGED_WANE_GAUGE_UNITS,
      beforeEntry.gaugeUnits
    );
    if (consumedEntry === undefined) {
      if (expectedConsumedGauge > AURA_GAUGE_EPSILON) {
        addIssue(
          context,
          path,
          `Electro-Charged Wane cannot omit material ${element} consumption`
        );
      }
      if (afterEntries.length !== 0) {
        addIssue(
          context,
          path,
          `Electro-Charged Wane omitted ${element} consumption must deplete that sub-epsilon wire Aura`
        );
      }
      continue;
    }
    if (
      expectedConsumedGauge <= AURA_GAUGE_EPSILON ||
      consumedEntry.gaugeUnits !== expectedConsumedGauge
    ) {
      addIssue(
        context,
        path,
        `Electro-Charged Wane ${element} aggregate consumption must equal its fixed 0.4U budget at 12-digit Gauge precision`
      );
    }
    if (consumedEntry.sourceActorId !== undefined) {
      addIssue(
        context,
        path,
        "Electro-Charged Wane aggregate consumption cannot claim one source actor"
      );
    }

    const beforeSlots = beforeEntry.sourceSlots;
    const afterEntry = afterEntries[0];
    if (afterEntry !== undefined) {
      const projectedFrozenFrames =
        validateElectroChargedWaneAuraDeadline(
          context,
          path,
          currentGlobalFrame,
          currentTargetFrame,
          beforeEntry,
          afterEntry
        );
      if (projectedFrozenFrames !== null) {
        if (sharedProjectedFrozenFrames === null) {
          sharedProjectedFrozenFrames = projectedFrozenFrames;
        } else {
          expectEqual(
            context,
            path,
            projectedFrozenFrames,
            sharedProjectedFrozenFrames,
            "Electro-Charged Wane shared target-clock projection"
          );
        }
      }
    }
    if (beforeSlots === undefined) {
      if (consumedEntry.sourceMutations !== undefined) {
        addIssue(
          context,
          path,
          `legacy ${element} Wane cannot invent source-slot mutations`
        );
      }
      const afterCandidates =
        electroChargedWaneAfterGaugeCandidates(
          beforeEntry.gaugeUnits
        );
      if (afterEntry === undefined) {
        if (!afterCandidates.includes(0)) {
          addIssue(
            context,
            path,
            `Electro-Charged Wane cannot remove retained ${element} Aura`
          );
        }
      } else if (
        afterEntry.sourceSlots !== undefined ||
        afterEntry.gaugeUnits < AURA_GAUGE_EPSILON ||
        !afterCandidates.includes(afterEntry.gaugeUnits)
      ) {
        addIssue(
          context,
          path,
          `Electro-Charged Wane ${element} Aura does not match the fixed 0.4U reduction`
        );
      }
      continue;
    }

    const mutations = consumedEntry.sourceMutations ?? [];
    const mutationBySource = new Map(
      mutations.map((mutation) => [
        mutation.sourceActorId,
        mutation
      ])
    );
    if (
      mutations.length !== beforeSlots.length ||
      mutationBySource.size !== beforeSlots.length
    ) {
      addIssue(
        context,
        path,
        `Electro-Charged Wane must mutate every ${element} source slot exactly once`
      );
    }
    const expectedAfterSlots = beforeSlots
      .map((slot) => {
        const slotConsumed = Math.min(
          ELECTRO_CHARGED_WANE_GAUGE_UNITS,
          slot.gaugeUnits
        );
        const afterCandidates =
          electroChargedWaneAfterGaugeCandidates(
            slot.gaugeUnits
          );
        const mutation = mutationBySource.get(slot.sourceActorId);
        const mutationAfter = mutation?.gaugeUnitsAfter ?? 0;
        if (
          mutation === undefined ||
          mutation.gaugeUnitsBefore !== slot.gaugeUnits ||
          mutation.consumedGaugeUnits !== slotConsumed ||
          !afterCandidates.includes(mutationAfter) ||
          (mutationAfter > 0 &&
            mutationAfter < AURA_GAUGE_EPSILON)
        ) {
          addIssue(
            context,
            path,
            `Electro-Charged Wane ${element} source slot ${slot.sourceActorId} does not consume its fixed 0.4U budget`
          );
        }
        return {
          sourceActorId: slot.sourceActorId,
          gaugeUnits: mutationAfter
        };
      })
      .filter((slot) => slot.gaugeUnits > 0);

    if (expectedAfterSlots.length === 0) {
      if (afterEntry !== undefined) {
        addIssue(
          context,
          path,
          `Electro-Charged Wane must remove depleted ${element} source slots`
        );
      }
      continue;
    }
    const afterSlots = afterEntry?.sourceSlots;
    if (
      afterEntry === undefined ||
      afterSlots === undefined ||
      afterSlots.length !== expectedAfterSlots.length
    ) {
      addIssue(
        context,
        path,
        `Electro-Charged Wane ${element} source-slot result is incomplete`
      );
      continue;
    }
    const afterBySource = new Map(
      afterSlots.map((slot) => [slot.sourceActorId, slot])
    );
    if (afterBySource.size !== afterSlots.length) {
      addIssue(
        context,
        path,
        `Electro-Charged Wane ${element} result contains duplicate source slots`
      );
    }
    for (
      let slotIndex = 0;
      slotIndex < expectedAfterSlots.length;
      slotIndex += 1
    ) {
      const expectedSlot = expectedAfterSlots[slotIndex]!;
      const actualSlot = afterBySource.get(
        expectedSlot.sourceActorId
      );
      if (
        actualSlot === undefined ||
        afterSlots[slotIndex]?.sourceActorId !==
          expectedSlot.sourceActorId ||
        actualSlot.gaugeUnits !== expectedSlot.gaugeUnits ||
        actualSlot.gaugeUnits < AURA_GAUGE_EPSILON
      ) {
        addIssue(
          context,
          path,
          `Electro-Charged Wane ${element} source slot ${expectedSlot.sourceActorId} has the wrong remaining Gauge`
        );
      }
    }
    const expectedAggregate = Math.max(
      ...expectedAfterSlots.map((slot) => slot.gaugeUnits)
    );
    if (afterEntry.gaugeUnits !== expectedAggregate) {
      addIssue(
        context,
        path,
        `Electro-Charged Wane ${element} aggregate Gauge must equal its largest source slot`
      );
    }
  }

  const unaffectedBefore = before.filter(
    (entry) =>
      entry.element !== "hydro" && entry.element !== "electro"
  );
  const unaffectedAfter = after.filter(
    (entry) =>
      entry.element !== "hydro" && entry.element !== "electro"
  );
  if (!auraStateProjectionEqual(unaffectedBefore, unaffectedAfter)) {
    addIssue(
      context,
      path,
      "Electro-Charged Wane cannot mutate unrelated Aura"
    );
  }
}

type ElectroChargedPeriodicRow =
  SimulationResult["periodicReactionLog"][number];

interface ElectroChargedV9ReplayState {
  targetId: string;
  generation: number;
  startFrame: number;
  active: boolean;
  listenerActive: boolean;
  nextTickFrame: number | null;
  sourceActorId: string | null;
  triggerDamageEventId: number | null;
  initialSourceActorId: string | null;
  initialTriggerDamageEventId: number | null;
}

function validateElectroChargedV9LifecycleReplay(
  result: SimulationResult,
  context: RefinementCtx
): void {
  if (result.config.reactionEngine?.mode !== "aura-v9") {
    return;
  }

  const damageEventById = new Map(
    result.damageEvents.map((event) => [event.id, event])
  );
  const rowIndexById = new Map(
    result.periodicReactionLog.map((row, index) => [row.id, index])
  );
  const tickByKey = new Map<string, ElectroChargedPeriodicRow>();
  const wanePointByPeriodicId = new Map<
    number,
    SimulationResult["targetStateTimeline"]["points"][number]
  >();
  const previousTimelinePointById = new Map<
    number,
    SimulationResult["targetStateTimeline"]["points"][number]
  >();
  const latestTimelinePointByTarget = new Map<
    string,
    SimulationResult["targetStateTimeline"]["points"][number]
  >();
  for (const point of result.targetStateTimeline.points) {
    const previousPoint = latestTimelinePointByTarget.get(
      point.targetId
    );
    if (previousPoint !== undefined) {
      previousTimelinePointById.set(point.id, previousPoint);
    }
    latestTimelinePointByTarget.set(point.targetId, point);
    if (point.cause !== "electro-charged-wane") continue;
    for (const link of point.links) {
      if (link.kind === "periodic-reaction-log") {
        wanePointByPeriodicId.set(link.id, point);
      }
    }
  }
  const appliedHitlagByTarget = new Map<
    string,
    SimulationResult["targetHitlagLog"]
  >();
  if (
    result.config.targetClockModel.mode ===
    "target-local-hitlag-v1"
  ) {
    for (const hitlag of result.targetHitlagLog) {
      if (!hitlag.applied || hitlag.extensionFrames <= 0) continue;
      const rows = appliedHitlagByTarget.get(hitlag.targetId) ?? [];
      rows.push(hitlag);
      appliedHitlagByTarget.set(hitlag.targetId, rows);
    }
    for (const rows of appliedHitlagByTarget.values()) {
      rows.sort(
        (left, right) =>
          left.globalFrame - right.globalFrame ||
          left.eventPriority - right.eventPriority ||
          left.eventSequence - right.eventSequence ||
          left.intraEventSequence - right.intraEventSequence ||
          left.id - right.id
      );
    }
  }
  type TargetClockState = {
    globalFrame: number;
    targetFrame: number;
    frozenFrames: number;
  };
  const advanceTargetClock = (
    state: TargetClockState,
    globalFrame: number
  ): TargetClockState => {
    const elapsed = globalFrame - state.globalFrame;
    const consumedFrozenFrames = Math.min(
      elapsed,
      state.frozenFrames
    );
    return {
      globalFrame,
      targetFrame:
        state.targetFrame + elapsed - consumedFrozenFrames,
      frozenFrames: state.frozenFrames - consumedFrozenFrames
    };
  };
  const targetClockAfterHitlagByTarget = new Map<
    string,
    TargetClockState[]
  >();
  for (const [targetId, hitlags] of appliedHitlagByTarget) {
    let state: TargetClockState = {
      globalFrame: 0,
      targetFrame: 0,
      frozenFrames: 0
    };
    const states: TargetClockState[] = [];
    for (const hitlag of hitlags) {
      state = advanceTargetClock(state, hitlag.globalFrame);
      state = {
        ...state,
        frozenFrames: state.frozenFrames + hitlag.extensionFrames
      };
      states.push(state);
    }
    targetClockAfterHitlagByTarget.set(targetId, states);
  }
  const targetClockAtPoint = (
    point: SimulationResult["targetStateTimeline"]["points"][number]
  ): TargetClockState => {
    const pointEventPriority =
      point.eventPriority ?? Number.MAX_SAFE_INTEGER;
    const pointEventSequence =
      point.eventSequence ?? Number.MAX_SAFE_INTEGER;
    const hitlags = appliedHitlagByTarget.get(point.targetId) ?? [];
    let lower = 0;
    let upper = hitlags.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      const hitlag = hitlags[middle]!;
      const precedes =
        hitlag.globalFrame < point.frame ||
        (hitlag.globalFrame === point.frame &&
          (hitlag.eventPriority < pointEventPriority ||
            (hitlag.eventPriority === pointEventPriority &&
              hitlag.eventSequence < pointEventSequence)));
      if (precedes) {
        lower = middle + 1;
      } else {
        upper = middle;
      }
    }
    const state =
      lower === 0
        ? {
            globalFrame: 0,
            targetFrame: 0,
            frozenFrames: 0
          }
        : targetClockAfterHitlagByTarget.get(point.targetId)![
            lower - 1
          ]!;
    return advanceTargetClock(state, point.frame);
  };
  const stateByKey = new Map<
    string,
    ElectroChargedV9ReplayState
  >();
  const currentStateByTarget = new Map<
    string,
    ElectroChargedV9ReplayState
  >();
  const streamKey = (targetId: string, generation: number): string =>
    `${targetId}\u0000${generation}`;
  const tickKey = (
    targetId: string,
    generation: number,
    tickIndex: number | null
  ): string => `${streamKey(targetId, generation)}\u0000${tickIndex}`;
  const rowPath = (row: ElectroChargedPeriodicRow): IssuePath => [
    "periodicReactionLog",
    rowIndexById.get(row.id) ?? row.id
  ];
  const expectRowField = <
    Field extends keyof ElectroChargedPeriodicRow
  >(
    row: ElectroChargedPeriodicRow,
    field: Field,
    expected: ElectroChargedPeriodicRow[Field],
    label: string
  ): void => {
    expectEqual(
      context,
      [...rowPath(row), field as string],
      row[field],
      expected,
      label
    );
  };
  const cleanupIntervalsByStream = new Map<
    string,
    Array<{ startFrame: number; endFrame: number }>
  >();
  for (const task of result.reactionTaskLog) {
    const cleanup = task.electroChargedCleanup;
    if (cleanup === null || cleanup === undefined) continue;
    const key = `${task.targetId}\u0000${cleanup.generation}`;
    const intervals = cleanupIntervalsByStream.get(key) ?? [];
    intervals.push({
      startFrame: task.frame,
      endFrame:
        cleanup.outcome === "pending-at-end"
          ? Number.POSITIVE_INFINITY
          : cleanup.resolvedGlobalFrame
    });
    cleanupIntervalsByStream.set(key, intervals);
  }
  const cleanupStartsByStream = new Map<string, number[]>();
  const cleanupPrefixMaxEndsByStream = new Map<string, number[]>();
  for (const [key, intervals] of cleanupIntervalsByStream) {
    intervals.sort(
      (left, right) =>
        left.startFrame - right.startFrame ||
        left.endFrame - right.endFrame
    );
    const starts: number[] = [];
    const prefixMaxEnds: number[] = [];
    let maximumEnd = Number.NEGATIVE_INFINITY;
    for (const interval of intervals) {
      starts.push(interval.startFrame);
      maximumEnd = Math.max(maximumEnd, interval.endFrame);
      prefixMaxEnds.push(maximumEnd);
    }
    cleanupStartsByStream.set(key, starts);
    cleanupPrefixMaxEndsByStream.set(key, prefixMaxEnds);
  }
  const cleanupWasPendingAtFrame = (
    targetId: string,
    generation: number,
    frame: number
  ): boolean => {
    const key = `${targetId}\u0000${generation}`;
    const starts = cleanupStartsByStream.get(key) ?? [];
    let lower = 0;
    let upper = starts.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (starts[middle]! <= frame) {
        lower = middle + 1;
      } else {
        upper = middle;
      }
    }
    return (
      lower > 0 &&
      cleanupPrefixMaxEndsByStream.get(key)![lower - 1]! > frame
    );
  };

  for (const [eventIndex, event] of result.damageEvents.entries()) {
    const audit = event.reactionAudit;
    const periodic = audit.periodicReaction;
    const publishesElectroCharged =
      audit.reactions.includes("electroCharged");
    const eventPath = [
      "damageEvents",
      eventIndex,
      "reactionAudit",
      "periodicReaction"
    ] satisfies IssuePath;
    if (
      audit.model === "aura-engine" &&
      audit.mechanicsTruncation === null
    ) {
      if (
        publishesElectroCharged &&
        (periodic === null || periodic.operation === "stop")
      ) {
        addIssue(
          context,
          eventPath,
          "aura-v9 Electro-Charged hit reaction requires a start or refresh lifecycle audit"
        );
      }
      if (
        periodic !== null &&
        (periodic.operation === "start" ||
          periodic.operation === "refresh") &&
        !publishesElectroCharged
      ) {
        addIssue(
          context,
          eventPath,
          "aura-v9 start or refresh cannot be invented without an Electro-Charged hit reaction"
        );
      }
    }
    if (
      periodic?.operation === "start" ||
      periodic?.operation === "refresh"
    ) {
      expectEqual(
        context,
        [...eventPath, "coexistenceExpiresAtFrame"],
        periodic.coexistenceExpiresAtFrame,
        electroChargedCoexistenceExpiryFrame(
          audit.auraAfter ?? []
        ),
        "Electro-Charged hit coexistence deadline"
      );
    }
    if (periodic?.operation === "stop") {
      if (
        !hasElectroChargedCoexistence(audit.auraBefore ?? []) ||
        hasElectroChargedCoexistence(audit.auraAfter ?? [])
      ) {
        addIssue(
          context,
          eventPath,
          "Electro-Charged hit stop requires pre-hit coexistence and post-hit removal"
        );
      }
    }
  }

  for (const row of result.periodicReactionLog) {
    if (row.operation === "tick" && row.tickIndex !== null) {
      tickByKey.set(
        tickKey(row.targetId, row.generation, row.tickIndex),
        row
      );
    }
  }

  const closeState = (state: ElectroChargedV9ReplayState): void => {
    state.active = false;
    state.listenerActive = false;
    state.nextTickFrame = null;
    if (currentStateByTarget.get(state.targetId) === state) {
      currentStateByTarget.delete(state.targetId);
    }
  };

  for (const row of result.periodicReactionLog) {
    const key = streamKey(row.targetId, row.generation);
    const current = currentStateByTarget.get(row.targetId);
    let state = stateByKey.get(key);

    if (row.operation === "start") {
      if (current?.active === true) {
        addIssue(
          context,
          rowPath(row),
          "Electro-Charged start cannot replace an unterminated active generation"
        );
      }
      expectRowField(row, "reason", null, "Electro-Charged start reason");
      expectRowField(
        row,
        "nextTickFrame",
        row.frame +
          ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
        "Electro-Charged start global cadence"
      );
      expectRowField(
        row,
        "coexistenceExpiresAtFrame",
        electroChargedCoexistenceExpiryFrame(row.auraAfter),
        "Electro-Charged start coexistence deadline"
      );
      state = {
        targetId: row.targetId,
        generation: row.generation,
        startFrame: row.frame,
        active: true,
        listenerActive: true,
        nextTickFrame:
          row.frame +
          ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
        sourceActorId: row.sourceActorId,
        triggerDamageEventId: row.triggerDamageEventId,
        initialSourceActorId: row.sourceActorId,
        initialTriggerDamageEventId: row.triggerDamageEventId
      };
      stateByKey.set(key, state);
      currentStateByTarget.set(row.targetId, state);
      continue;
    }

    if (state === undefined) {
      addIssue(
        context,
        rowPath(row),
        "Electro-Charged lifecycle replay requires its canonical start state"
      );
      continue;
    }

    if (row.operation === "refresh") {
      if (!state.active || current !== state) {
        addIssue(
          context,
          rowPath(row),
          "Electro-Charged refresh requires the current active generation"
        );
      }
      expectRowField(
        row,
        "reason",
        null,
        "Electro-Charged refresh reason"
      );
      expectRowField(
        row,
        "nextTickFrame",
        state.nextTickFrame,
        "Electro-Charged refresh inherited cadence"
      );
      expectRowField(
        row,
        "cadenceStatus",
        state.nextTickFrame === null ? "dormant" : "scheduled",
        "Electro-Charged refresh cadence status"
      );
      expectRowField(
        row,
        "waneListenerActive",
        state.listenerActive,
        "Electro-Charged refresh listener state"
      );
      expectRowField(
        row,
        "coexistenceExpiresAtFrame",
        electroChargedCoexistenceExpiryFrame(row.auraAfter),
        "Electro-Charged refresh coexistence deadline"
      );
      state.sourceActorId = row.sourceActorId;
      state.triggerDamageEventId = row.triggerDamageEventId;
      continue;
    }

    const isWaneCallback =
      row.waneFrame !== null &&
      (row.operation === "wane" ||
        row.operation === "wane-skipped" ||
        row.operation === "stop");
    if (isWaneCallback) {
      const owningTick = tickByKey.get(
        tickKey(row.targetId, row.generation, row.tickIndex)
      );
      const wanePoint = wanePointByPeriodicId.get(row.id);
      const previousTimelinePoint =
        wanePoint === undefined
          ? undefined
          : previousTimelinePointById.get(wanePoint.id);
      for (const aura of row.auraBefore) {
        if (
          aura.element !== "hydro" &&
          aura.element !== "electro"
        ) {
          continue;
        }
        const inheritedAura = previousTimelinePoint?.auraAfter.find(
          (entry) => entry.element === aura.element
        );
        if (inheritedAura === undefined) {
          addIssue(
            context,
            [...rowPath(row), "auraBefore"],
            `Electro-Charged Wane ${aura.element} Aura requires an inherited pre-callback timeline state`
          );
          continue;
        }
        if (
          result.config.targetClockModel.mode ===
          "target-local-hitlag-v1"
        ) {
          expectEqual(
            context,
            [...rowPath(row), "auraBefore"],
            aura.expiresAtTargetFrame,
            inheritedAura.expiresAtTargetFrame,
            `Electro-Charged Wane inherited ${aura.element} target deadline`
          );
        } else {
          expectEqual(
            context,
            [...rowPath(row), "auraBefore"],
            aura.expiresAtFrame,
            inheritedAura.expiresAtFrame,
            `Electro-Charged Wane inherited ${aura.element} global deadline`
          );
        }
      }
      if (
        result.config.targetClockModel.mode ===
        "target-local-hitlag-v1"
      ) {
        if (wanePoint === undefined) {
          addIssue(
            context,
            rowPath(row),
            "Hitlag-aware Electro-Charged Wane requires its timeline clock owner"
          );
        } else {
          const clock = targetClockAtPoint(wanePoint);
          expectEqual(
            context,
            [...rowPath(row), "targetFrame"],
            wanePoint.targetFrame,
            clock.targetFrame,
            "Electro-Charged Wane replayed target frame"
          );
          for (const [snapshotName, snapshot] of [
            ["auraBefore", row.auraBefore],
            ["auraAfter", row.auraAfter]
          ] as const) {
            for (const aura of snapshot) {
              if (
                aura.element !== "hydro" &&
                aura.element !== "electro"
              ) {
                continue;
              }
              if (
                aura.expiresAtFrame === null ||
                aura.expiresAtTargetFrame === undefined ||
                aura.expiresAtTargetFrame === null
              ) {
                addIssue(
                  context,
                  [...rowPath(row), snapshotName],
                  "Hitlag-aware Electro-Charged Wane normal Aura requires finite global and target deadlines"
                );
                continue;
              }
              const expectedGlobalDeadline =
                aura.expiresAtTargetFrame <= clock.targetFrame
                  ? clock.globalFrame
                  : clock.globalFrame +
                    clock.frozenFrames +
                    aura.expiresAtTargetFrame -
                    clock.targetFrame;
              expectEqual(
                context,
                [...rowPath(row), snapshotName],
                aura.expiresAtFrame,
                expectedGlobalDeadline,
                "Electro-Charged Wane replayed global deadline"
              );
            }
          }
        }
      } else {
        for (const [snapshotName, snapshot] of [
          ["auraBefore", row.auraBefore],
          ["auraAfter", row.auraAfter]
        ] as const) {
          for (const aura of snapshot) {
            if (
              (aura.element === "hydro" ||
                aura.element === "electro") &&
              aura.expiresAtTargetFrame !== undefined
            ) {
              addIssue(
                context,
                [...rowPath(row), snapshotName],
                "global-clock Electro-Charged Wane Aura cannot claim a target-local deadline"
              );
            }
          }
        }
      }
      if (!state.active || current !== state) {
        addIssue(
          context,
          rowPath(row),
          "aura-v9 Wane callback requires the current active generation"
        );
      }
      if (!state.listenerActive) {
        addIssue(
          context,
          rowPath(row),
          "aura-v9 Wane callback requires a replayed active listener"
        );
      }
      if (owningTick !== undefined) {
        expectRowField(
          row,
          "nextTickFrame",
          row.operation === "wane" &&
            hasElectroChargedCoexistence(row.auraAfter)
            ? owningTick.nextTickFrame
            : null,
          "Electro-Charged Wane inherited cadence"
        );
      }
      if (
        row.operation === "wane" &&
        hasElectroChargedCoexistence(row.auraAfter)
      ) {
        state.nextTickFrame = owningTick?.nextTickFrame ?? null;
      } else {
        closeState(state);
      }
      continue;
    }

    if (row.operation === "tick") {
      const child =
        row.damageEventId === null
          ? undefined
          : damageEventById.get(row.damageEventId);
      if (row.tickIndex === 0) {
        expectRowField(
          row,
          "frame",
          state.startFrame +
            ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES,
          "Electro-Charged pinned first damage frame"
        );
        expectRowField(
          row,
          "sourceActorId",
          state.initialSourceActorId,
          "Electro-Charged pinned first source"
        );
        expectRowField(
          row,
          "triggerDamageEventId",
          state.initialTriggerDamageEventId,
          "Electro-Charged pinned first trigger"
        );
        if (state.active && current === state) {
          const coexistencePresent =
            hasElectroChargedCoexistence(row.auraAfter);
          if (!coexistencePresent) {
            state.listenerActive = false;
          }
          const expectedReason = coexistencePresent
            ? null
            : cleanupWasPendingAtFrame(
                  row.targetId,
                  row.generation,
                  row.frame
                )
              ? "QUEUED_FIRST_TICK_WHILE_CLEANUP_PENDING"
              : "QUEUED_FIRST_TICK_AFTER_STREAM_REPLACED";
          expectRowField(
            row,
            "reason",
            expectedReason,
            "Electro-Charged pinned first tick reason"
          );
          expectRowField(
            row,
            "nextTickFrame",
            state.nextTickFrame,
            "Electro-Charged pinned first tick cadence"
          );
          expectRowField(
            row,
            "cadenceStatus",
            "scheduled",
            "Electro-Charged pinned first tick cadence status"
          );
          expectRowField(
            row,
            "waneListenerActive",
            state.listenerActive,
            "Electro-Charged pinned first tick listener"
          );
        } else {
          const replacement = current !== undefined && current !== state;
          expectRowField(
            row,
            "reason",
            replacement
              ? "QUEUED_FIRST_TICK_AFTER_STREAM_REPLACED"
              : "QUEUED_FIRST_TICK_AFTER_STREAM_STOP",
            "Electro-Charged terminal pinned tick reason"
          );
          expectRowField(
            row,
            "nextTickFrame",
            null,
            "Electro-Charged terminal pinned tick cadence"
          );
          expectRowField(
            row,
            "cadenceStatus",
            "stopped",
            "Electro-Charged terminal pinned tick cadence status"
          );
          expectRowField(
            row,
            "waneListenerActive",
            false,
            "Electro-Charged terminal pinned tick listener"
          );
        }
      } else {
        if (!state.active || current !== state) {
          addIssue(
            context,
            rowPath(row),
            "Electro-Charged recurring tick requires the current active generation"
          );
        }
        if (state.nextTickFrame === null) {
          addIssue(
            context,
            [...rowPath(row), "frame"],
            "Electro-Charged recurring tick cannot run without a scheduled callback"
          );
        } else {
          expectRowField(
            row,
            "frame",
            state.nextTickFrame,
            "Electro-Charged recurring callback frame"
          );
        }
        expectRowField(
          row,
          "reason",
          null,
          "Electro-Charged recurring tick reason"
        );
        expectRowField(
          row,
          "nextTickFrame",
          row.frame + ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
          "Electro-Charged recurring cadence interval"
        );
        expectRowField(
          row,
          "cadenceStatus",
          "scheduled",
          "Electro-Charged recurring cadence status"
        );
        expectRowField(
          row,
          "waneListenerActive",
          state.listenerActive,
          "Electro-Charged recurring listener state"
        );
        expectRowField(
          row,
          "sourceActorId",
          state.sourceActorId,
          "Electro-Charged recurring source"
        );
        expectRowField(
          row,
          "triggerDamageEventId",
          state.triggerDamageEventId,
          "Electro-Charged recurring trigger"
        );
        state.nextTickFrame =
          row.frame + ELECTRO_CHARGED_TICK_INTERVAL_FRAMES;
      }
      expectRowField(
        row,
        "coexistenceExpiresAtFrame",
        electroChargedCoexistenceExpiryFrame(row.auraAfter),
        "Electro-Charged tick coexistence deadline"
      );
      const expectedWaneFrame =
        row.waneListenerActive === true &&
        (child?.finalDamage ?? 0) > 0
          ? row.frame + ELECTRO_CHARGED_WANE_DELAY_FRAMES
          : null;
      expectRowField(
        row,
        "waneFrame",
        expectedWaneFrame,
        "Electro-Charged replayed Wane scheduling"
      );
      continue;
    }

    if (row.operation === "tick-skipped") {
      if (!state.active || current !== state) {
        addIssue(
          context,
          rowPath(row),
          "Electro-Charged skipped tick requires the current active generation"
        );
      }
      if (state.nextTickFrame === null) {
        addIssue(
          context,
          [...rowPath(row), "frame"],
          "Electro-Charged skipped tick cannot run without a scheduled callback"
        );
      } else {
        expectRowField(
          row,
          "frame",
          state.nextTickFrame,
          "Electro-Charged skipped callback frame"
        );
      }
      expectRowField(
        row,
        "reason",
        "COEXISTING_AURA_MISSING_AT_GLOBAL_CALLBACK",
        "Electro-Charged skipped tick reason"
      );
      if (hasElectroChargedCoexistence(row.auraAfter)) {
        addIssue(
          context,
          rowPath(row),
          "Electro-Charged skipped tick requires missing coexistence"
        );
      }
      state.listenerActive = false;
      state.nextTickFrame = null;
      continue;
    }

    if (row.operation === "stop") {
      if (!state.active || current !== state) {
        addIssue(
          context,
          rowPath(row),
          "Electro-Charged ordinary stop requires the current active generation"
        );
      }
      if (row.reason === "COEXISTING_AURA_MISSING") {
        if (state.nextTickFrame === null) {
          addIssue(
            context,
            [...rowPath(row), "frame"],
            "Electro-Charged missing-Aura stop requires a scheduled callback"
          );
        } else {
          expectRowField(
            row,
            "frame",
            state.nextTickFrame,
            "Electro-Charged missing-Aura callback frame"
          );
        }
        expectRowField(
          row,
          "sourceActorId",
          state.sourceActorId,
          "Electro-Charged missing-Aura source"
        );
        expectRowField(
          row,
          "triggerDamageEventId",
          state.triggerDamageEventId,
          "Electro-Charged missing-Aura trigger"
        );
        if (
          hasElectroChargedCoexistence(row.auraBefore) ||
          !auraStateProjectionEqual(row.auraBefore, row.auraAfter) ||
          row.auraConsumed.length !== 0
        ) {
          addIssue(
            context,
            rowPath(row),
            "Electro-Charged missing-Aura stop must observe unchanged non-coexisting Aura"
          );
        }
      } else if (
        row.reason === "COEXISTING_AURA_REMOVED_BY_HIT"
      ) {
        if (
          !hasElectroChargedCoexistence(row.auraBefore) ||
          hasElectroChargedCoexistence(row.auraAfter)
        ) {
          addIssue(
            context,
            rowPath(row),
            "Electro-Charged hit stop must remove pre-hit coexistence"
          );
        }
      } else if (
        row.reason ===
          "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM" &&
        row.reactionTaskLogId === undefined
      ) {
        addIssue(
          context,
          rowPath(row),
          "Electro-Charged cleanup stop requires its reaction-task owner"
        );
      }
      closeState(state);
    }
  }
}

function orderedScalarArrayEqual(
  left: readonly (string | number | boolean | null)[],
  right: readonly (string | number | boolean | null)[]
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function mechanicsTruncationProjectionEqual(
  left: DamageEvent["reactionAudit"]["mechanicsTruncation"],
  right: DamageEvent["reactionAudit"]["mechanicsTruncation"]
): boolean {
  if (left === right) return true;
  if (left === null || right === null) return false;
  return (
    left.operation === right.operation &&
    left.startedAtFrame === right.startedAtFrame &&
    left.reason === right.reason &&
    orderedScalarArrayEqual(
      left.unsupportedReactions,
      right.unsupportedReactions
    ) &&
    auraStateProjectionEqual(
      left.discardedAura,
      right.discardedAura
    )
  );
}

function expectAuraStateProjection(
  context: RefinementCtx,
  path: IssuePath,
  actual: readonly AuraStateEntry[],
  expected: readonly AuraStateEntry[],
  label: string
): void {
  if (!auraStateProjectionEqual(actual, expected)) {
    addIssue(context, path, `${label} does not match its authoritative source`);
  }
}

function expectAuraGaugeProjection(
  context: RefinementCtx,
  path: IssuePath,
  actual: readonly AuraGaugeEntry[],
  expected: readonly AuraGaugeEntry[],
  label: string
): void {
  if (!auraGaugeProjectionEqual(actual, expected)) {
    addIssue(context, path, `${label} does not match its authoritative source`);
  }
}

function expectAuraStateFieldProjection(
  context: RefinementCtx,
  pathPrefix: readonly (string | number)[],
  field: string,
  actual: readonly AuraStateEntry[],
  expected: readonly AuraStateEntry[],
  label: string
): void {
  if (!auraStateProjectionEqual(actual, expected)) {
    addIssue(
      context,
      [...pathPrefix, field],
      `${label} does not match its authoritative source`
    );
  }
}

function expectAuraGaugeFieldProjection(
  context: RefinementCtx,
  pathPrefix: readonly (string | number)[],
  field: string,
  actual: readonly AuraGaugeEntry[],
  expected: readonly AuraGaugeEntry[],
  label: string
): void {
  if (!auraGaugeProjectionEqual(actual, expected)) {
    addIssue(
      context,
      [...pathPrefix, field],
      `${label} does not match its authoritative source`
    );
  }
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

function expectFieldEqual(
  context: RefinementCtx,
  pathPrefix: readonly (string | number)[],
  field: string,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    addIssue(
      context,
      [...pathPrefix, field],
      `${label} must equal ${String(expected)}; received ${String(actual)}`
    );
  }
}

function expectFieldNearlyEqual(
  context: RefinementCtx,
  pathPrefix: readonly (string | number)[],
  field: string,
  actual: number,
  expected: number,
  label: string
): void {
  if (!nearlyEqual(actual, expected)) {
    addIssue(
      context,
      [...pathPrefix, field],
      `${label} must equal ${expected}; received ${actual}`
    );
  }
}

function expectSemanticEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (!semanticEqual(actual, expected)) {
    addIssue(context, path, `${label} does not match its source`);
  }
}

function addToRecord(
  record: Record<string, number>,
  key: string,
  value: number
): void {
  record[key] = (record[key] ?? 0) + value;
}

function compareFiniteRecord(
  context: RefinementCtx,
  path: IssuePath,
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string
): void {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (!semanticEqual(actualKeys, expectedKeys)) {
    addIssue(
      context,
      path,
      `${label} keys must match the authoritative aggregation`
    );
    return;
  }
  for (const key of expectedKeys) {
    expectNearlyEqual(
      context,
      [...path, key],
      actual[key] ?? Number.NaN,
      expected[key] ?? Number.NaN,
      `${label}.${key}`
    );
  }
}

function validateIdentityForVersion(
  result: SimulationResult,
  context: RefinementCtx,
  expectedSchemaVersion: string,
  expectedEngineVersion: string,
  identityLabel: "frozen" | "current"
): void {
  if (
    (result.schemaVersion as string) !==
    expectedSchemaVersion
  ) {
    addIssue(
      context,
      ["schemaVersion"],
      `must equal ${identityLabel} schema ${expectedSchemaVersion}`
    );
  }
  if (
    result.engineVersion !== expectedEngineVersion
  ) {
    addIssue(
      context,
      ["engineVersion"],
      `must equal ${identityLabel} engine ${expectedEngineVersion}`
    );
  }
  if (
    (result.config.schemaVersion as string) !==
      (result.schemaVersion as string) ||
    (result.runManifest.schemaVersion as string) !==
      (result.schemaVersion as string)
  ) {
    addIssue(
      context,
      ["config", "schemaVersion"],
      "result, config, and run manifest schema identities must match"
    );
  }
  if (
    result.config.engineVersion !== result.engineVersion ||
    result.runManifest.engineVersion !== result.engineVersion
  ) {
    addIssue(
      context,
      ["config", "engineVersion"],
      "result, config, and run manifest engine identities must match"
    );
  }
  if (
    result.config.dataVersion !== result.dataVersion ||
    result.runManifest.dataVersion !== result.dataVersion
  ) {
    addIssue(
      context,
      ["dataVersion"],
      "result, config, and run manifest data versions must match"
    );
  }
  if (
    result.randomSeed !==
      result.runManifest.resolvedRuntimeOptions.randomSeed
  ) {
    addIssue(
      context,
      ["randomSeed"],
      "must equal the resolved run-manifest random seed"
    );
  }
  if (
    result.compatibilityMode !==
    result.resolvedRuntimeOptions.compatibilityMode
  ) {
    addIssue(
      context,
      ["compatibilityMode"],
      "must equal resolvedRuntimeOptions.compatibilityMode"
    );
  }
  expectSemanticEqual(
    context,
    ["resolvedRuntimeOptions"],
    result.resolvedRuntimeOptions,
    result.runManifest.resolvedRuntimeOptions,
    "resolved runtime options"
  );
  expectSemanticEqual(
    context,
    ["pluginManifest"],
    result.pluginManifest,
    result.runManifest.plugins,
    "plugin manifest"
  );
  if (
    result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
  ) {
    addIssue(
      context,
      ["reproducibilityKey"],
      "must equal runManifest.reproducibilityKey"
    );
  }
  const expectedConfigHash = createSimulationConfigHash(
    result.config
  );
  if (result.runManifest.configHash !== expectedConfigHash) {
    addIssue(
      context,
      ["runManifest", "configHash"],
      "must equal the canonical current config hash"
    );
  }
  const {
    reproducibilityKey: _ignoredReproducibilityKey,
    ...identity
  } = result.runManifest;
  const expectedReproducibilityKey =
    createSimulationReproducibilityKey(identity);
  if (
    result.runManifest.reproducibilityKey !==
    expectedReproducibilityKey
  ) {
    addIssue(
      context,
      ["runManifest", "reproducibilityKey"],
      "must equal the canonical run-manifest identity hash"
    );
  }
}

function validateIdentityV142(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityForVersion(
    result,
    context,
    EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
    EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
    "frozen"
  );
}

function validateIdentityV144(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityForVersion(
    result,
    context,
    BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
    "current"
  );
}

function validateIdentityV145(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityForVersion(
    result,
    context,
    REACTION_FORMULA_ROOT_SCHEMA_VERSION,
    REACTION_FORMULA_ROOT_ENGINE_VERSION,
    "current"
  );
  if (
    (result.runManifest.version as string) !==
    REACTION_FORMULA_RUN_MANIFEST_VERSION
  ) {
    addIssue(
      context,
      ["runManifest", "version"],
      `1.45 results require run-manifest version ${REACTION_FORMULA_RUN_MANIFEST_VERSION}`
    );
  }
  expectSemanticEqual(
    context,
    ["runManifest", "reactionFormulaRoot"],
    result.runManifest.reactionFormulaRoot,
    CLASSIC_REACTION_FORMULA_ROOT,
    "compiled reaction formula root"
  );
  expectSemanticEqual(
    context,
    ["config", "reactionFormulaModel"],
    result.config.reactionFormulaModel,
    {
      mode: "classic-formula-profile-v1",
      profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
    },
    "compiled reaction formula profile selection"
  );
  expectEqual(
    context,
    ["runManifest", "reactionFormulaRoot", "profileId"],
    result.runManifest.reactionFormulaRoot?.profileId,
    result.config.reactionFormulaModel?.profileId,
    "run-manifest/config reaction formula profile"
  );
}

function validateIdentityV146(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityForVersion(
    result,
    context,
    DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
    DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
    "current"
  );
  if (
    result.runManifest.version !==
    SIMULATION_RUN_MANIFEST_VERSION
  ) {
    addIssue(
      context,
      ["runManifest", "version"],
      `1.46 results require run-manifest version ${SIMULATION_RUN_MANIFEST_VERSION}`
    );
  }
  expectSemanticEqual(
    context,
    ["runManifest", "reactionFormulaRoot"],
    result.runManifest.reactionFormulaRoot,
    CLASSIC_REACTION_FORMULA_ROOT,
    "compiled reaction formula root"
  );
  expectSemanticEqual(
    context,
    ["config", "reactionFormulaModel"],
    result.config.reactionFormulaModel,
    {
      mode: "classic-formula-profile-v1",
      profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
    },
    "compiled reaction formula profile selection"
  );
  expectEqual(
    context,
    ["runManifest", "reactionFormulaRoot", "profileId"],
    result.runManifest.reactionFormulaRoot?.profileId,
    result.config.reactionFormulaModel?.profileId,
    "run-manifest/config reaction formula profile"
  );
  expectSemanticEqual(
    context,
    ["runManifest", "directDamageGroupRoot"],
    result.runManifest.directDamageGroupRoot,
    GCSIM_DAMAGE_GROUP_ROOT,
    "compiled direct-damage-group root"
  );
  expectSemanticEqual(
    context,
    ["config", "directDamageGroupModel"],
    result.config.directDamageGroupModel,
    {
      mode: "fixed-gcsim-direct-damage-group-v1",
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID
    },
    "compiled direct-damage-group profile selection"
  );
  expectEqual(
    context,
    ["runManifest", "directDamageGroupRoot", "profileId"],
    result.runManifest.directDamageGroupRoot?.profileId,
    result.config.directDamageGroupModel?.profileId,
    "run-manifest/config direct-damage-group profile"
  );
}

type ReactionDamageDelivery =
  SimulationResult["reactionDamageLog"][number];

function expectedAmplifyingReactionBase(
  reaction: DamageEvent["reaction"]
): number {
  switch (reaction) {
    case "melt":
    case "reverseMelt":
    case "vaporize":
    case "reverseVaporize":
      return CLASSIC_REACTION_FORMULA_PROFILE
        .amplifyingBaseMultipliers[reaction];
    default:
      return CLASSIC_REACTION_FORMULA_PROFILE
        .amplifyingBaseMultipliers.none;
  }
}

function deliveryKindMatchesReaction(
  delivery: ReactionDamageDelivery
): boolean {
  switch (delivery.reaction) {
    case "overload":
    case "superconduct":
    case "shatter":
      return delivery.scheduleKind === "one-shot";
    case "electroCharged":
      return delivery.scheduleKind === "periodic-tick";
    case "burning":
      return delivery.scheduleKind === "burning-tick";
    case "swirlPyro":
    case "swirlHydro":
    case "swirlCryo":
    case "swirlElectro":
      return (
        delivery.scheduleKind === "swirl-self" ||
        delivery.scheduleKind === "swirl-propagation"
      );
    case "bloom":
      return delivery.scheduleKind === "dendro-core-bloom";
    case "burgeon":
      return delivery.scheduleKind === "dendro-core-burgeon";
    case "hyperbloom":
      return delivery.scheduleKind === "dendro-core-hyperbloom";
  }
}

function expectedTransformativeReactionBase(
  delivery: ReactionDamageDelivery
): number {
  if (
    delivery.scheduleKind === "swirl-propagation" &&
    (delivery.reaction === "swirlPyro" ||
      delivery.reaction === "swirlHydro" ||
      delivery.reaction === "swirlCryo" ||
      delivery.reaction === "swirlElectro")
  ) {
    return CLASSIC_REACTION_FORMULA_PROFILE
      .swirlPropagationBaseMultipliers[delivery.reaction];
  }
  return CLASSIC_REACTION_FORMULA_PROFILE
    .transformativeBaseMultipliers[delivery.reaction];
}

function fixedLevelBaseDamage(
  characterLevel: number
): number | undefined {
  return CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel[
    characterLevel - 1
  ];
}

/**
 * 1.45 fixed-profile proof.
 *
 * These checks deliberately derive every immutable input from the compiled
 * profile, the config character level, and the reaction-delivery owner. They
 * never accept another duplicated result field as the formula authority.
 */
function validateReactionFormulaProfileV145(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const characterById = new Map(
    result.config.characters.map((character) => [
      character.id,
      character
    ])
  );
  const deliveryByDamageEventId = new Map<
    number,
    ReactionDamageDelivery
  >();
  for (const delivery of result.reactionDamageLog) {
    for (const damageEventId of delivery.damageEventIds) {
      deliveryByDamageEventId.set(damageEventId, delivery);
    }
  }

  for (const [eventIndex, event] of
    result.damageEvents.entries()) {
    const eventPath = [
      "damageEvents",
      eventIndex
    ] satisfies IssuePath;
    const sourceCharacter = characterById.get(
      event.sourceActorId
    );

    if (event.kind === "direct") {
      expectEqual(
        context,
        [...eventPath, "damageFactors", "reactionBase"],
        event.damageFactors.reactionBase,
        expectedAmplifyingReactionBase(event.reaction),
        "fixed-profile amplifying reaction base"
      );
    }

    const additive = event.additiveReactionFactors;
    if (additive !== null) {
      if (sourceCharacter === undefined) {
        addIssue(
          context,
          [...eventPath, "sourceActorId"],
          "formula proof requires a configured source character"
        );
      } else {
        expectEqual(
          context,
          [
            ...eventPath,
            "additiveReactionFactors",
            "characterLevel"
          ],
          additive.characterLevel,
          sourceCharacter.level,
          "fixed-profile additive source level"
        );
        const expectedLevelBase = fixedLevelBaseDamage(
          sourceCharacter.level
        );
        if (expectedLevelBase === undefined) {
          addIssue(
            context,
            [
              ...eventPath,
              "additiveReactionFactors",
              "characterLevel"
            ],
            "fixed-profile additive level must be within 1..100"
          );
        } else {
          expectEqual(
            context,
            [
              ...eventPath,
              "additiveReactionFactors",
              "levelBaseDamage"
            ],
            additive.levelBaseDamage,
            expectedLevelBase,
            "fixed-profile additive level base damage"
          );
        }
      }
      expectEqual(
        context,
        [
          ...eventPath,
          "additiveReactionFactors",
          "baseMultiplier"
        ],
        additive.baseMultiplier,
        CLASSIC_REACTION_FORMULA_PROFILE.additiveBaseMultipliers[
          additive.reaction
        ],
        "fixed-profile additive reaction base multiplier"
      );
    }

    const transformative =
      event.transformativeReactionFactors;
    if (transformative === null) continue;
    if (sourceCharacter === undefined) {
      addIssue(
        context,
        [...eventPath, "sourceActorId"],
        "formula proof requires a configured reaction source"
      );
    } else {
      expectEqual(
        context,
        [
          ...eventPath,
          "transformativeReactionFactors",
          "characterLevel"
        ],
        transformative.characterLevel,
        sourceCharacter.level,
        "fixed-profile transformative source level"
      );
      const expectedLevelBase = fixedLevelBaseDamage(
        sourceCharacter.level
      );
      if (expectedLevelBase === undefined) {
        addIssue(
          context,
          [
            ...eventPath,
            "transformativeReactionFactors",
            "characterLevel"
          ],
          "fixed-profile transformative level must be within 1..100"
        );
      } else {
        expectEqual(
          context,
          [
            ...eventPath,
            "transformativeReactionFactors",
            "levelBaseDamage"
          ],
          transformative.levelBaseDamage,
          expectedLevelBase,
          "fixed-profile transformative level base damage"
        );
      }
    }
    const delivery = deliveryByDamageEventId.get(event.id);
    if (delivery === undefined) {
      addIssue(
        context,
        [...eventPath, "parentDamageEventId"],
        "fixed-profile transformative damage requires a delivery owner"
      );
      continue;
    }
    if (!deliveryKindMatchesReaction(delivery)) {
      addIssue(
        context,
        ["reactionDamageLog", delivery.id, "scheduleKind"],
        `delivery kind ${delivery.scheduleKind} is not valid for ${delivery.reaction}`
      );
      continue;
    }
    expectEqual(
      context,
      [
        ...eventPath,
        "transformativeReactionFactors",
        "reaction"
      ],
      transformative.reaction,
      delivery.reaction,
      "fixed-profile reaction delivery label"
    );
    expectEqual(
      context,
      [
        ...eventPath,
        "transformativeReactionFactors",
        "baseMultiplier"
      ],
      transformative.baseMultiplier,
      expectedTransformativeReactionBase(delivery),
      "fixed-profile transformative base multiplier"
    );
  }
}

type ConfiguredDirectDamageHit = Pick<
  HitDefinition,
  "id" | "groupMultiplier" | "directDamageGroup"
>;

interface ConfiguredDirectDamageHitLookup {
  rotationHits: Map<string, ConfiguredDirectDamageHit[]>;
  abilityHits: Map<string, ConfiguredDirectDamageHit[]>;
}

const RESERVED_INTERNAL_DAMAGE_GROUPS = new Set<string>([
  "reaction-a",
  "reaction-b",
  "burning"
]);

function buildConfiguredDirectDamageHitLookup(
  result: SimulationResult
): ConfiguredDirectDamageHitLookup {
  const rotationHits = new Map<
    string,
    ConfiguredDirectDamageHit[]
  >();
  for (const action of result.config.rotation) {
    rotationHits.set(
      JSON.stringify([action.actorId, action.id]),
      [...(action.hits ?? [])]
    );
  }

  const abilityHits = new Map<
    string,
    ConfiguredDirectDamageHit[]
  >();
  for (const ability of result.config.timeline?.abilities ?? []) {
    abilityHits.set(
      JSON.stringify([ability.actorId, ability.id]),
      [...(ability.hits ?? [])]
    );
  }
  return { rotationHits, abilityHits };
}

function parseConfiguredDirectDamageHitIndex(
  event: DamageEvent
): number | undefined {
  // hitGroupId is simulator-authored as
  // `${actionId}:${cycle}:${hitIndex}:${frame}`. actionId may itself contain
  // colons, so splitting on ':' is ambiguous; bind the exact known prefix and
  // suffix and parse only the remaining decimal index.
  const prefix = `${event.actionId}:${event.cycle}:`;
  const suffix = `:${event.frame}`;
  if (
    !event.hitGroupId.startsWith(prefix) ||
    !event.hitGroupId.endsWith(suffix)
  ) {
    return undefined;
  }
  const indexText = event.hitGroupId.slice(
    prefix.length,
    event.hitGroupId.length - suffix.length
  );
  if (!/^(0|[1-9]\d*)$/.test(indexText)) {
    return undefined;
  }
  const hitIndex = Number(indexText);
  return Number.isSafeInteger(hitIndex) ? hitIndex : undefined;
}

function findConfiguredDirectDamageHit(
  lookup: ConfiguredDirectDamageHitLookup,
  event: DamageEvent
): ConfiguredDirectDamageHit | undefined {
  const hitIndex = parseConfiguredDirectDamageHitIndex(event);
  if (hitIndex === undefined) return undefined;

  let configuredHits: ConfiguredDirectDamageHit[] | undefined;
  if (
    event.timelineCommandIndex !== undefined &&
    event.sourceAbilityId !== undefined
  ) {
    configuredHits = lookup.abilityHits.get(
      JSON.stringify([
        event.sourceActorId,
        event.sourceAbilityId
      ])
    );
  } else {
    configuredHits = lookup.rotationHits.get(
      JSON.stringify([
        event.sourceActorId,
        event.actionId
      ])
    );
  }

  const configuredHit = configuredHits?.[hitIndex];
  if (configuredHit === undefined) return undefined;
  const effectiveHitId =
    configuredHit.id ?? `${event.actionId}:hit-${hitIndex}`;
  return effectiveHitId === event.hitId
    ? configuredHit
    : undefined;
}

interface DirectDamageGroupReplayWindow {
  startFrame: number;
  resetAtFrame: number;
  resetFrames: number;
  startGroup: GcsimDamageGroupId;
  hitCount: number;
}

/**
 * Replays the exact ordinary direct-damage-group counter independently from
 * sim-core. State is target + source actor + tag scoped; group intentionally
 * does not participate in the key. The first hit fixes the active window's
 * timer while each current hit selects its own damage sequence.
 */
function validateDirectDamageGroupV146(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const directEvents = result.damageEvents
    .filter(
      (event) =>
        event.kind === "direct" &&
        event.parentDamageEventId === null
    )
    .sort(
      (left, right) =>
        left.frame - right.frame ||
        left.eventPriority - right.eventPriority ||
        left.eventSequence - right.eventSequence ||
        left.id - right.id
    );

  if (result.directDamageGroupLog.length !== directEvents.length) {
    addIssue(
      context,
      ["directDamageGroupLog"],
      "must contain exactly one row per landed ordinary direct damage event"
    );
  }

  const loggedDamageEventIds = new Set<number>();
  const configuredHitLookup = buildConfiguredDirectDamageHitLookup(
    result
  );
  const replayWindows = new Map<
    string,
    DirectDamageGroupReplayWindow
  >();

  for (const [logIndex, log] of
    result.directDamageGroupLog.entries()) {
    const logPath = [
      "directDamageGroupLog",
      logIndex
    ] satisfies IssuePath;
    const expectedEvent = directEvents[logIndex];

    expectEqual(
      context,
      [...logPath, "id"],
      log.id,
      logIndex,
      "direct-damage-group log ID"
    );
    if (loggedDamageEventIds.has(log.damageEventId)) {
      addIssue(
        context,
        [...logPath, "damageEventId"],
        "must not duplicate another direct-damage-group backlink"
      );
    }
    loggedDamageEventIds.add(log.damageEventId);

    if (expectedEvent === undefined) {
      addIssue(
        context,
        [...logPath, "damageEventId"],
        "has no ordinary direct damage event at this stable replay position"
      );
      continue;
    }
    expectEqual(
      context,
      [...logPath, "damageEventId"],
      log.damageEventId,
      expectedEvent.id,
      "stable direct damage event backlink"
    );
    expectEqual(
      context,
      [...logPath, "hitResolutionLogId"],
      log.hitResolutionLogId,
      expectedEvent.targetResolutionId,
      "direct hit-resolution backlink"
    );
    expectEqual(
      context,
      [...logPath, "frame"],
      log.frame,
      expectedEvent.frame,
      "direct-damage-group frame"
    );
    expectEqual(
      context,
      [...logPath, "sourceActorId"],
      log.sourceActorId,
      expectedEvent.sourceActorId,
      "direct-damage-group source actor"
    );
    expectEqual(
      context,
      [...logPath, "targetId"],
      log.targetId,
      expectedEvent.targetId,
      "direct-damage-group target"
    );
    expectEqual(
      context,
      [...logPath, "hitId"],
      log.hitId,
      expectedEvent.hitId,
      "direct-damage-group hit"
    );
    expectEqual(
      context,
      [...logPath, "profileId"],
      log.profileId,
      GCSIM_DAMAGE_GROUP_PROFILE_ID,
      "fixed direct-damage-group profile"
    );

    const resolution =
      result.hitResolutionLog[expectedEvent.targetResolutionId];
    if (
      resolution === undefined ||
      resolution.id !== expectedEvent.targetResolutionId ||
      resolution.damageEventId !== expectedEvent.id ||
      !resolution.landed ||
      resolution.resolutionKind !== "direct"
    ) {
      addIssue(
        context,
        [...logPath, "hitResolutionLogId"],
        "must backlink the landed direct hit-resolution row"
      );
    }

    const configuredHit = findConfiguredDirectDamageHit(
      configuredHitLookup,
      expectedEvent
    );
    if (configuredHit === undefined) {
      addIssue(
        context,
        [...logPath, "hitId"],
        "must resolve to exactly one configured direct hit"
      );
      continue;
    }
    const configuredMultiplier =
      configuredHit.groupMultiplier ?? 1;
    expectNearlyEqual(
      context,
      [...logPath, "configuredMultiplier"],
      log.configuredMultiplier,
      configuredMultiplier,
      "configured direct group multiplier"
    );
    expectNearlyEqual(
      context,
      [...logPath, "prePluginMultiplier"],
      log.prePluginMultiplier,
      configuredMultiplier,
      "pre-plugin direct group multiplier"
    );
    expectEqual(
      context,
      [...logPath, "pluginTraceVerification"],
      log.pluginTraceVerification,
      DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
      "plugin trace verification boundary"
    );

    if (
      log.pluginMultiplierTrace.length !==
      result.pluginManifest.length
    ) {
      addIssue(
        context,
        [...logPath, "pluginMultiplierTrace"],
        "must contain exactly one ordered row per plugin manifest entry"
      );
    }
    let expectedPluginMultiplier = log.prePluginMultiplier;
    for (const [traceIndex, trace] of
      log.pluginMultiplierTrace.entries()) {
      const tracePath = [
        ...logPath,
        "pluginMultiplierTrace",
        traceIndex
      ] satisfies IssuePath;
      const manifestEntry = result.pluginManifest[traceIndex];
      expectEqual(
        context,
        [...tracePath, "pluginManifestIndex"],
        trace.pluginManifestIndex,
        traceIndex,
        "plugin multiplier trace manifest index"
      );
      if (manifestEntry === undefined) {
        addIssue(
          context,
          [...tracePath, "pluginId"],
          "has no plugin manifest entry at this execution position"
        );
      } else {
        expectEqual(
          context,
          [...tracePath, "pluginManifestIndex"],
          trace.pluginManifestIndex,
          manifestEntry.index,
          "plugin multiplier trace bound manifest index"
        );
        expectEqual(
          context,
          [...tracePath, "pluginId"],
          trace.pluginId,
          manifestEntry.id,
          "plugin multiplier trace bound plugin identity"
        );
      }
      if (!Number.isFinite(trace.inputMultiplier)) {
        addIssue(
          context,
          [...tracePath, "inputMultiplier"],
          "plugin multiplier trace input must be finite"
        );
      }
      if (!Number.isFinite(trace.outputMultiplier)) {
        addIssue(
          context,
          [...tracePath, "outputMultiplier"],
          "plugin multiplier trace output must be finite"
        );
      }
      expectEqual(
        context,
        [...tracePath, "inputMultiplier"],
        trace.inputMultiplier,
        expectedPluginMultiplier,
        "ordered plugin multiplier trace input"
      );
      if (trace.outcome === "no-change") {
        expectEqual(
          context,
          [...tracePath, "outputMultiplier"],
          trace.outputMultiplier,
          trace.inputMultiplier,
          "no-change plugin multiplier trace output"
        );
      } else if (trace.outcome === "override") {
        if (trace.outputMultiplier === trace.inputMultiplier) {
          addIssue(
            context,
            [...tracePath, "outcome"],
            "override requires a changed output multiplier"
          );
        }
      } else {
        addIssue(
          context,
          [...tracePath, "outcome"],
          "must be no-change or override"
        );
      }
      expectedPluginMultiplier = trace.outputMultiplier;
    }
    expectEqual(
      context,
      [...logPath, "postPluginMultiplier"],
      log.postPluginMultiplier,
      expectedPluginMultiplier,
      "ordered plugin multiplier trace final output"
    );

    const configuredGroup = configuredHit.directDamageGroup;
    let expectedSequenceMultiplier: 0 | 1 = 1;
    if (configuredGroup === undefined) {
      expectEqual(
        context,
        [...logPath, "evaluation"],
        log.evaluation,
        "bypassed",
        "unconfigured direct-damage-group evaluation"
      );
      for (const field of [
        "icdTag",
        "icdGroup",
        "windowStartGroup",
        "resetFrames",
        "windowStartFrame",
        "resetAtFrame",
        "hitIndex",
        "sequenceIndex"
      ] as const) {
        expectEqual(
          context,
          [...logPath, field],
          log[field],
          null,
          `bypassed direct-damage-group ${field}`
        );
      }
      expectEqual(
        context,
        [...logPath, "sequenceMultiplier"],
        log.sequenceMultiplier,
        1,
        "bypassed direct-damage-group sequence multiplier"
      );
    } else {
      expectEqual(
        context,
        [...logPath, "evaluation"],
        log.evaluation,
        "evaluated",
        "configured direct-damage-group evaluation"
      );
      if (
        RESERVED_INTERNAL_DAMAGE_GROUPS.has(
          configuredGroup.icdGroup
        )
      ) {
        addIssue(
          context,
          [...logPath, "icdGroup"],
          `${configuredGroup.icdGroup} is reserved for internal reaction delivery`
        );
        continue;
      }

      const currentGroup = resolveDamageGroup(
        configuredGroup.icdGroup
      );
      const scope = JSON.stringify([
        expectedEvent.targetId,
        expectedEvent.sourceActorId,
        configuredGroup.icdTag
      ]);
      let window = replayWindows.get(scope);
      if (
        window === undefined ||
        expectedEvent.frame >= window.resetAtFrame
      ) {
        window = {
          startFrame: expectedEvent.frame,
          resetAtFrame:
            expectedEvent.frame + currentGroup.resetFrames - 1,
          resetFrames: currentGroup.resetFrames,
          startGroup: currentGroup.id,
          hitCount: 0
        };
      }
      const expectedHitIndex = window.hitCount;
      const expectedSequenceIndex = Math.min(
        expectedHitIndex,
        currentGroup.damageSequence.length - 1
      );
      expectedSequenceMultiplier = currentGroup.damageSequence[
        expectedSequenceIndex
      ] as 0 | 1;

      expectEqual(
        context,
        [...logPath, "icdTag"],
        log.icdTag,
        configuredGroup.icdTag,
        "configured direct-damage-group tag"
      );
      expectEqual(
        context,
        [...logPath, "icdGroup"],
        log.icdGroup,
        currentGroup.id,
        "configured direct-damage-group ID"
      );
      expectEqual(
        context,
        [...logPath, "windowStartGroup"],
        log.windowStartGroup,
        window.startGroup,
        "active window start group"
      );
      expectEqual(
        context,
        [...logPath, "resetFrames"],
        log.resetFrames,
        window.resetFrames,
        "active window fixed reset timer"
      );
      expectEqual(
        context,
        [...logPath, "windowStartFrame"],
        log.windowStartFrame,
        window.startFrame,
        "active window start frame"
      );
      expectEqual(
        context,
        [...logPath, "resetAtFrame"],
        log.resetAtFrame,
        window.startFrame + window.resetFrames - 1,
        "active window reset boundary"
      );
      expectEqual(
        context,
        [...logPath, "hitIndex"],
        log.hitIndex,
        expectedHitIndex,
        "active window hit index"
      );
      expectEqual(
        context,
        [...logPath, "sequenceIndex"],
        log.sequenceIndex,
        expectedSequenceIndex,
        "tail-clamped damage sequence index"
      );
      expectEqual(
        context,
        [...logPath, "sequenceMultiplier"],
        log.sequenceMultiplier,
        expectedSequenceMultiplier,
        "fixed damage sequence multiplier"
      );

      window.hitCount += 1;
      replayWindows.set(scope, window);
    }

    expectNearlyEqual(
      context,
      [...logPath, "effectiveMultiplier"],
      log.effectiveMultiplier,
      log.postPluginMultiplier * expectedSequenceMultiplier,
      "effective fixed-sequence multiplier"
    );
    expectNearlyEqual(
      context,
      [
        "damageEvents",
        expectedEvent.id,
        "damageFactors",
        "groupMultiplier"
      ],
      expectedEvent.damageFactors.groupMultiplier,
      log.effectiveMultiplier,
      "damage-event effective group multiplier"
    );
    expectNearlyEqual(
      context,
      ["damageEvents", expectedEvent.id, "groupMultiplier"],
      expectedEvent.groupMultiplier,
      log.effectiveMultiplier,
      "damage-event group multiplier compatibility alias"
    );

    const expectedOnEnemyHitAllowed =
      (resolution?.hitConfirmAllowed ?? false) &&
      expectedSequenceMultiplier > 0;
    expectEqual(
      context,
      [...logPath, "damageGroupOnEnemyHitAllowed"],
      log.damageGroupOnEnemyHitAllowed,
      expectedOnEnemyHitAllowed,
      "generic OnEnemyHit damage-group gate"
    );

    if (expectedSequenceMultiplier === 0) {
      for (const [field, actual] of [
        ["potentialDamage", expectedEvent.potentialDamage],
        ["finalDamage", expectedEvent.finalDamage],
        ["damageComposition.direct", expectedEvent.damageComposition.direct],
        [
          "damageComposition.additiveReaction",
          expectedEvent.damageComposition.additiveReaction
        ],
        [
          "damageComposition.transformativeReaction",
          expectedEvent.damageComposition.transformativeReaction
        ]
      ] as const) {
        expectNearlyEqual(
          context,
          ["damageEvents", expectedEvent.id, ...field.split(".")],
          actual,
          0,
          "zero-sequence direct damage output"
        );
      }
    }
  }

  for (const event of directEvents) {
    if (!loggedDamageEventIds.has(event.id)) {
      addIssue(
        context,
        ["directDamageGroupLog"],
        `missing landed ordinary direct damage event ${event.id}`
      );
    }
  }
}

function validateDamageEvent(
  event: DamageEvent,
  index: number,
  result: SimulationResult,
  context: RefinementCtx
): void {
  const path = ["damageEvents", index] satisfies IssuePath;
  if (event.id !== index) {
    addIssue(
      context,
      [...path, "id"],
      "damage event IDs must be contiguous and index-addressable"
    );
  }
  if (event.frame !== Math.round(event.timeSeconds * 60)) {
    addIssue(
      context,
      [...path, "timeSeconds"],
      "frame must equal Math.round(timeSeconds * 60)"
    );
  }
  expectNearlyEqual(
    context,
    [...path, "time"],
    event.time,
    event.timeSeconds,
    "legacy time alias"
  );
  if (event.second !== Math.floor(event.timeSeconds)) {
    addIssue(
      context,
      [...path, "second"],
      "must equal floor(timeSeconds)"
    );
  }
  if (event.displayDamage !== Math.round(event.finalDamage)) {
    addIssue(
      context,
      [...path, "displayDamage"],
      "must equal Math.round(finalDamage)"
    );
  }
  expectNearlyEqual(
    context,
    [...path, "damageComposition"],
    event.damageComposition.direct +
      event.damageComposition.additiveReaction +
      event.damageComposition.transformativeReaction,
    event.finalDamage,
    "damage composition sum"
  );
  expectNearlyEqual(
    context,
    [...path, "finalDamage"],
    event.finalDamage,
    event.potentialDamage * event.targetDamageMultiplier,
    "target-policy adjusted damage"
  );
  if (event.actorId !== event.sourceActorId) {
    addIssue(
      context,
      [...path, "actorId"],
      "must alias sourceActorId"
    );
  }
  if (event.creditId !== event.creditOwnerId) {
    addIssue(
      context,
      [...path, "creditId"],
      "must alias creditOwnerId"
    );
  }
  if (event.actorName !== event.creditOwnerName) {
    addIssue(
      context,
      [...path, "actorName"],
      "must alias creditOwnerName"
    );
  }
  if (event.activeId !== event.activeCharacterId) {
    addIssue(
      context,
      [...path, "activeId"],
      "must alias activeCharacterId"
    );
  }
  const factorAliases: Array<
    [keyof DamageEvent, number, string]
  > = [
    ["scaling", event.damageFactors.scaling, "scaling"],
    [
      "scalingValue",
      event.damageFactors.scalingValue,
      "scalingValue"
    ],
    ["flat", event.damageFactors.flatDamage, "flatDamage"],
    ["baseDamage", event.damageFactors.baseDamage, "baseDamage"],
    ["dmgBonus", event.damageFactors.damageBonus, "damageBonus"],
    [
      "bonusFactor",
      event.damageFactors.damageBonusMultiplier,
      "damageBonusMultiplier"
    ],
    [
      "defIgnore",
      event.damageFactors.defenseIgnore,
      "defenseIgnore"
    ],
    [
      "defReduction",
      event.damageFactors.defenseReduction,
      "defenseReduction"
    ],
    [
      "defenseFactor",
      event.damageFactors.defenseMultiplier,
      "defenseMultiplier"
    ],
    [
      "effectiveRes",
      event.damageFactors.effectiveResistance,
      "effectiveResistance"
    ],
    [
      "resFactor",
      event.damageFactors.resistanceMultiplier,
      "resistanceMultiplier"
    ],
    ["critRate", event.damageFactors.critRate, "critRate"],
    ["critDmg", event.damageFactors.critDamage, "critDamage"],
    [
      "critFactor",
      event.damageFactors.critMultiplier,
      "critMultiplier"
    ],
    [
      "reactionBase",
      event.damageFactors.reactionBase,
      "reactionBase"
    ],
    [
      "emBonus",
      event.damageFactors.elementalMasteryBonus,
      "elementalMasteryBonus"
    ],
    [
      "reactionBonus",
      event.damageFactors.reactionBonus,
      "reactionBonus"
    ],
    [
      "reactionFactor",
      event.kind === "direct"
        ? event.damageFactors.amplifyingReactionMultiplier
        : event.damageFactors.reactionBase *
          (1 +
            event.damageFactors.elementalMasteryBonus +
            event.damageFactors.reactionBonus) *
          event.damageFactors.amplifyingReactionMultiplier,
      event.kind === "direct"
        ? "amplifyingReactionMultiplier"
        : "transformative reaction multiplier"
    ],
    [
      "groupMultiplier",
      event.damageFactors.groupMultiplier,
      "groupMultiplier"
    ]
  ];
  for (const [alias, expected, source] of factorAliases) {
    expectNearlyEqual(
      context,
      [...path, alias],
      event[alias] as number,
      expected,
      `legacy ${String(alias)} alias for ${source}`
    );
  }
  const factors = event.damageFactors;
  const hasDamagePlugin =
    result.runManifest.plugins.length > 0;
  if (
    event.kind === "transformative-reaction" ||
    !hasDamagePlugin
  ) {
    expectNearlyEqual(
      context,
      [...path, "damageFactors", "scalingValue"],
      factors.scalingValue,
      totalScalingStat(
        event.statsBeforeDamage,
        factors.scalingStat
      ),
      "snapshot scaling-stat value"
    );
  }
  expectNearlyEqual(
    context,
    [...path, "damageFactors", "effectiveResistance"],
    factors.effectiveResistance,
    event.enemyStateBeforeHit.effectiveResistance,
    "enemy-state effective resistance"
  );
  expectNearlyEqual(
    context,
    [...path, "damageFactors", "defenseReduction"],
    factors.defenseReduction,
    event.enemyStateBeforeHit.effectiveDefenseReduction,
    "enemy-state effective defense reduction"
  );
  expectNearlyEqual(
    context,
    [...path, "damageFactors", "resistanceMultiplier"],
    factors.resistanceMultiplier,
    resistanceMultiplier(factors.effectiveResistance),
    "resistance multiplier"
  );
  expectNearlyEqual(
    context,
    [...path, "damageFactors", "damageBonusMultiplier"],
    factors.damageBonusMultiplier,
    1 + factors.damageBonus,
    "damage-bonus multiplier"
  );
  const formulaMultiplier =
    factors.damageBonusMultiplier *
    factors.defenseMultiplier *
    factors.resistanceMultiplier *
    factors.critMultiplier *
    factors.amplifyingReactionMultiplier *
    factors.groupMultiplier;
  const scalingOwner = result.config.characters.find(
    (character) => character.id === event.scalingOwnerId
  );
  if (scalingOwner === undefined) {
    addIssue(
      context,
      [...path, "scalingOwnerId"],
      `references missing scaling owner ${event.scalingOwnerId}`
    );
  } else {
    const characterTerm = scalingOwner.level + 100;
    const enemyTerm =
      (event.enemyStateBeforeHit.level + 100) *
      (1 + factors.defenseReduction) *
      (1 - factors.defenseIgnore);
    expectNearlyEqual(
      context,
      [...path, "damageFactors", "defenseMultiplier"],
      factors.defenseMultiplier,
      characterTerm / (characterTerm + enemyTerm),
      "defense multiplier"
    );
  }
  const expectedCritMultiplier =
    result.resolvedRuntimeOptions.critMode === "allCrit"
      ? 1 + factors.critDamage
      : result.resolvedRuntimeOptions.critMode === "noCrit"
        ? 1
        : 1 + factors.critRate * factors.critDamage;
  expectNearlyEqual(
    context,
    [...path, "damageFactors", "critMultiplier"],
    factors.critMultiplier,
    expectedCritMultiplier,
    "critical-hit multiplier"
  );
  for (const [field, value, minimum, maximum] of [
    ["defenseIgnore", factors.defenseIgnore, 0, 1],
    ["defenseReduction", factors.defenseReduction, -1, 0.9],
    ["critRate", factors.critRate, 0, 1],
    ["critDamage", factors.critDamage, 0, Number.POSITIVE_INFINITY]
  ] as const) {
    if (value < minimum || value > maximum) {
      addIssue(
        context,
        [...path, "damageFactors", field],
        `must be within [${minimum}, ${maximum}]`
      );
    }
  }
  expectNearlyEqual(
    context,
    [...path, "potentialDamage"],
    event.potentialDamage,
    factors.baseDamage * formulaMultiplier,
    "potential damage formula"
  );

  const additiveFactors = event.additiveReactionFactors;
  if (additiveFactors !== null) {
    const additiveAudit =
      event.reactionAudit.catalyzeReaction?.additive;
    const expectedElement =
      additiveFactors.reaction === "aggravate"
        ? "electro"
        : "dendro";
    expectEqual(
      context,
      [...path, "additiveReactionFactors", "sourceActorId"],
      additiveFactors.sourceActorId,
      event.sourceActorId,
      "additive reaction source actor"
    );
    const expectedAdditiveBase =
      additiveFactors.reaction === "aggravate" ? 1.15 : 1.25;
    expectNearlyEqual(
      context,
      [...path, "additiveReactionFactors", "baseMultiplier"],
      additiveFactors.baseMultiplier,
      expectedAdditiveBase,
      "additive reaction base multiplier"
    );
    expectNearlyEqual(
      context,
      [
        ...path,
        "additiveReactionFactors",
        "elementalMasteryBonus"
      ],
      additiveFactors.elementalMasteryBonus,
      (5 * Math.max(0, additiveFactors.elementalMastery)) /
        (1200 + Math.max(0, additiveFactors.elementalMastery)),
      "additive elemental-mastery bonus"
    );
    expectNearlyEqual(
      context,
      [...path, "additiveReactionFactors", "flatDamage"],
      additiveFactors.flatDamage,
      additiveFactors.levelBaseDamage *
        additiveFactors.baseMultiplier *
        (1 +
          additiveFactors.elementalMasteryBonus +
          additiveFactors.reactionBonus),
      "additive reaction flat-damage formula"
    );
    expectEqual(
      context,
      [...path, "additiveReactionFactors", "reaction"],
      additiveAudit?.reaction,
      additiveFactors.reaction,
      "Catalyze audit reaction"
    );
    expectEqual(
      context,
      [...path, "reactionAudit", "reaction"],
      event.reactionAudit.reaction,
      additiveFactors.reaction,
      "Catalyze primary reaction"
    );
    expectEqual(
      context,
      [...path, "element"],
      event.element,
      expectedElement,
      "Catalyze damage element"
    );
    expectEqual(
      context,
      [
        ...path,
        "reactionAudit",
        "catalyzeReaction",
        "additive",
        "triggerElement"
      ],
      additiveAudit?.triggerElement,
      expectedElement,
      "Catalyze trigger element"
    );
    if (additiveAudit !== null && additiveAudit !== undefined) {
      expectEqual(
        context,
        [
          ...path,
          "reactionAudit",
          "catalyzeReaction",
          "additive",
          "consumedQuickenGaugeUnits"
        ],
        additiveAudit.consumedQuickenGaugeUnits,
        0,
        "additive Catalyze Quicken Gauge consumption"
      );
      expectEqual(
        context,
        [
          ...path,
          "reactionAudit",
          "catalyzeReaction",
          "additive",
          "quickenGaugeUnitsAfter"
        ],
        additiveAudit.quickenGaugeUnitsAfter,
        additiveAudit.quickenGaugeUnitsBefore,
        "additive Catalyze Quicken Gauge conservation"
      );
    }
    const sourceActor = result.config.characters.find(
      (character) => character.id === event.sourceActorId
    );
    if (sourceActor !== undefined) {
      expectEqual(
        context,
        [
          ...path,
          "additiveReactionFactors",
          "characterLevel"
        ],
        additiveFactors.characterLevel,
        sourceActor.level,
        "Catalyze source level"
      );
    }
  }

  const targetAdjustedMultiplier =
    formulaMultiplier * event.targetDamageMultiplier;
  const additiveContribution =
    (additiveFactors?.appliedFlatDamage ?? 0) *
    targetAdjustedMultiplier;
  if (event.kind === "direct") {
    const amplifyingEm = Math.max(0, event.em);
    const expectedAmplifyingEmBonus =
      factors.reactionBase === 1
        ? 0
        : (2.78 * amplifyingEm) / (1400 + amplifyingEm);
    expectNearlyEqual(
      context,
      [...path, "damageFactors", "elementalMasteryBonus"],
      factors.elementalMasteryBonus,
      expectedAmplifyingEmBonus,
      "amplifying elemental-mastery bonus"
    );
    expectNearlyEqual(
      context,
      [
        ...path,
        "damageFactors",
        "amplifyingReactionMultiplier"
      ],
      factors.amplifyingReactionMultiplier,
      factors.reactionBase *
        (1 +
          factors.elementalMasteryBonus +
          factors.reactionBonus),
      "amplifying reaction multiplier"
    );
    if (factors.reactionBase === 1) {
      expectNearlyEqual(
        context,
        [...path, "em"],
        event.em,
        event.statsBeforeDamage.em,
        "non-amplifying elemental mastery"
      );
    }
    expectEqual(
      context,
      [...path, "reaction"],
      event.reaction,
      event.reactionAudit.reaction,
      "direct event reaction audit"
    );
    expectNearlyEqual(
      context,
      [...path, "damageFactors", "baseDamage"],
      factors.baseDamage,
      factors.scaling * factors.scalingValue +
        factors.flatDamage,
      "direct base-damage formula"
    );
    expectNearlyEqual(
      context,
      [...path, "damageComposition", "additiveReaction"],
      event.damageComposition.additiveReaction,
      additiveContribution,
      "direct additive-reaction contribution"
    );
    expectNearlyEqual(
      context,
      [...path, "damageComposition", "direct"],
      event.damageComposition.direct,
      event.finalDamage - additiveContribution,
      "direct non-additive contribution"
    );
    expectNearlyEqual(
      context,
      [...path, "damageComposition", "transformativeReaction"],
      event.damageComposition.transformativeReaction,
      0,
      "direct transformative contribution"
    );
  } else {
    const transformativeFactors =
      event.transformativeReactionFactors;
    if (transformativeFactors !== null) {
      expectEqual(
        context,
        [...path, "damageFactors", "scaling"],
        factors.scaling,
        0,
        "transformative damage scaling"
      );
      expectEqual(
        context,
        [...path, "damageFactors", "scalingStat"],
        factors.scalingStat,
        "em",
        "transformative damage scaling stat"
      );
      expectNearlyEqual(
        context,
        [...path, "damageFactors", "scalingValue"],
        factors.scalingValue,
        transformativeFactors.elementalMastery,
        "transformative damage scaling value"
      );
      expectNearlyEqual(
        context,
        [...path, "em"],
        event.em,
        transformativeFactors.elementalMastery,
        "transformative elemental mastery"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "transformativeReactionFactors",
          "elementalMasteryBonus"
        ],
        transformativeFactors.elementalMasteryBonus,
        (16 *
          Math.max(
            0,
            transformativeFactors.elementalMastery
          )) /
          (2000 +
            Math.max(
              0,
              transformativeFactors.elementalMastery
            )),
        "transformative elemental-mastery bonus"
      );
      expectNearlyEqual(
        context,
        [...path, "damageFactors", "reactionBase"],
        factors.reactionBase,
        transformativeFactors.baseMultiplier,
        "transformative reaction base"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "damageFactors",
          "elementalMasteryBonus"
        ],
        factors.elementalMasteryBonus,
        transformativeFactors.elementalMasteryBonus,
        "transformative elemental-mastery factor"
      );
      expectNearlyEqual(
        context,
        [...path, "damageFactors", "reactionBonus"],
        factors.reactionBonus,
        transformativeFactors.reactionBonus,
        "transformative reaction-bonus factor"
      );
      expectEqual(
        context,
        [...path, "reaction"],
        event.reaction,
        transformativeFactors.reaction,
        "transformative event reaction factors"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "transformativeReactionFactors",
          "preResistanceDamage"
        ],
        transformativeFactors.preResistanceDamage,
        transformativeFactors.levelBaseDamage *
          transformativeFactors.baseMultiplier *
          (1 +
            transformativeFactors.elementalMasteryBonus +
            transformativeFactors.reactionBonus),
        "transformative pre-resistance formula"
      );
      expectNearlyEqual(
        context,
        [...path, "damageFactors", "baseDamage"],
        factors.baseDamage,
        transformativeFactors.preResistanceDamage +
          (additiveFactors?.appliedFlatDamage ?? 0),
        "transformative combined base damage"
      );
      expectNearlyEqual(
        context,
        [...path, "damageFactors", "flatDamage"],
        factors.flatDamage,
        additiveFactors?.appliedFlatDamage ?? 0,
        "transformative additive flat damage"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "transformativeReactionFactors",
          "effectiveResistance"
        ],
        transformativeFactors.effectiveResistance,
        factors.effectiveResistance,
        "transformative effective resistance"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "transformativeReactionFactors",
          "resistanceMultiplier"
        ],
        transformativeFactors.resistanceMultiplier,
        factors.resistanceMultiplier,
        "transformative resistance multiplier"
      );
      const transformativeContribution =
        transformativeFactors.preResistanceDamage *
        targetAdjustedMultiplier;
      expectNearlyEqual(
        context,
        [...path, "damageComposition", "direct"],
        event.damageComposition.direct,
        0,
        "transformative direct contribution"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "damageComposition",
          "additiveReaction"
        ],
        event.damageComposition.additiveReaction,
        additiveContribution,
        "nested additive-reaction contribution"
      );
      expectNearlyEqual(
        context,
        [
          ...path,
          "damageComposition",
          "transformativeReaction"
        ],
        event.damageComposition.transformativeReaction,
        transformativeContribution,
        "transformative contribution"
      );
    }
    for (const [
      factor,
      expected
    ] of [
      ["scaling", 0],
      ["damageBonus", 0],
      ["damageBonusMultiplier", 1],
      ["defenseIgnore", 1],
      ["defenseMultiplier", 1],
      ["critRate", 0],
      ["critDamage", 0],
      ["critMultiplier", 1]
    ] as const) {
      expectNearlyEqual(
        context,
        [...path, "damageFactors", factor],
        factors[factor],
        expected,
        `transformative ${factor}`
      );
    }
  }
  for (const [detailIndex, detail] of
    event.flatDetails.entries()) {
    expectNearlyEqual(
      context,
      [...path, "flatDetails", detailIndex, "amount"],
      detail.amount,
      detail.multiplier * detail.sourceValue,
      "flat-damage detail amount"
    );
  }
  const reactionTriggered =
    event.reactionAudit.reactions.length > 0;
  if (event.reactionAudit.triggered !== reactionTriggered) {
    addIssue(
      context,
      [...path, "reactionAudit", "triggered"],
      "must agree with reactionAudit.reaction"
    );
  }
  if (
    reactionTriggered &&
    (event.reactionAudit.reaction === "none" ||
      !event.reactionAudit.reactions.includes(
        event.reactionAudit.reaction
      ))
  ) {
    addIssue(
      context,
      [...path, "reactionAudit", "reaction"],
      "must name one of the ordered reactions"
    );
  }
  if (
    !reactionTriggered &&
    event.reactionAudit.reaction !== "none"
  ) {
    addIssue(
      context,
      [...path, "reactionAudit", "reaction"],
      "must be none when no reaction triggered"
    );
  }
  if (event.scalingStat !== event.damageFactors.scalingStat) {
    addIssue(
      context,
      [...path, "scalingStat"],
      "must alias damageFactors.scalingStat"
    );
  }
  const resolution =
    result.hitResolutionLog[event.targetResolutionId];
  if (
    resolution === undefined ||
    resolution.id !== event.targetResolutionId ||
    resolution.damageEventId !== event.id ||
    resolution.targetId !== event.targetId
  ) {
    addIssue(
      context,
      [...path, "targetResolutionId"],
      "must backlink a matching hit-resolution row"
    );
  } else {
    for (const [field, expected] of [
      ["frame", event.frame],
      ["cycle", event.cycle],
      ["sourceActorId", event.sourceActorId],
      ["sourceActionId", event.actionId],
      ["actionName", event.actionName],
      ["hitId", event.hitId],
      ["hitGroupId", event.hitGroupId],
      ["hitLabel", event.hitLabel],
      ["targetIndex", event.targetIndex],
      ["targetCount", event.targetCount],
      ["targetName", event.targetName],
      ["element", event.element],
      ["mechanicsStatus", event.mechanicsStatus]
    ] as const) {
      expectEqual(
        context,
        [
          "hitResolutionLog",
          event.targetResolutionId,
          field
        ],
        resolution[field],
        expected,
        `hit-resolution ${field}`
      );
    }
    expectNearlyEqual(
      context,
      [
        "hitResolutionLog",
        event.targetResolutionId,
        "timeSeconds"
      ],
      resolution.timeSeconds,
      event.timeSeconds,
      "hit-resolution time"
    );
    for (const [field, expected] of [
      ["timelineCommandIndex", event.timelineCommandIndex],
      ["sourceAbilityId", event.sourceAbilityId]
    ] as const) {
      expectEqual(
        context,
        [
          "hitResolutionLog",
          event.targetResolutionId,
          field
        ],
        resolution[field],
        expected,
        `hit-resolution ${field}`
      );
    }
    if (resolution.eventPriority !== undefined) {
      expectNearlyEqual(
        context,
        [
          "hitResolutionLog",
          event.targetResolutionId,
          "eventPriority"
        ],
        resolution.eventPriority,
        event.eventPriority,
        "hit-resolution event priority"
      );
    }
    if (resolution.eventSequence !== undefined) {
      expectEqual(
        context,
        [
          "hitResolutionLog",
          event.targetResolutionId,
          "eventSequence"
        ],
        resolution.eventSequence,
        event.eventSequence,
        "hit-resolution event sequence"
      );
    }
    expectEqual(
      context,
      [
        "hitResolutionLog",
        event.targetResolutionId,
        "landed"
      ],
      resolution.landed,
      true,
      "damage-event hit-resolution landed flag"
    );
    expectEqual(
      context,
      [...path, "targetResolutionId"],
      resolution.resolutionKind,
      event.kind === "direct" ? "direct" : "reaction-damage",
      "hit-resolution kind"
    );
    expectNearlyEqual(
      context,
      [
        "hitResolutionLog",
        event.targetResolutionId,
        "potentialDamage"
      ],
      resolution.potentialDamage,
      event.potentialDamage,
      "hit-resolution potential damage"
    );
    expectNearlyEqual(
      context,
      [
        "hitResolutionLog",
        event.targetResolutionId,
        "finalDamage"
      ],
      resolution.finalDamage,
      event.finalDamage,
      "hit-resolution final damage"
    );
    expectEqual(
      context,
      [
        "hitResolutionLog",
        event.targetResolutionId,
        "displayDamage"
      ],
      resolution.displayDamage,
      event.displayDamage,
      "hit-resolution display damage"
    );
  }
  if (
    event.mechanicsStatus === "mechanics-truncated" &&
    event.targetDamageMultiplier !== 0
  ) {
    addIssue(
      context,
      [...path, "targetDamageMultiplier"],
      "mechanics-truncated damage must be excluded from totals"
    );
  }
}

function validateDamageAggregates(
  result: SimulationResult,
  context: RefinementCtx
): void {
  expectSemanticEqual(
    context,
    ["hitEvents"],
    result.hitEvents,
    result.damageEvents,
    "hitEvents compatibility alias"
  );

  const byCharacter: Record<string, number> = {};
  const hitCountByCharacter: Record<string, number> = {};
  const bySkill = new Map<
    string,
    {
      creditId: string;
      actionName: string;
      damage: number;
      hits: number;
    }
  >();
  const perSecond = Array.from(
    { length: Math.ceil(result.config.duration) },
    () => ({}) as Record<string, number>
  );
  const targetAggregates = new Map(
    result.enemyTargets.map((target) => [
      target.id,
      {
        damage: 0,
        potentialDamage: 0,
        damageEvents: 0,
        landedChecks: 0,
        missedChecks: 0,
        immuneDamageEvents: 0
      }
    ])
  );
  let totalDamage = 0;
  let reactedHits = 0;
  let previousOrder:
    | [frame: number, priority: number, sequence: number]
    | undefined;

  for (const [index, event] of result.damageEvents.entries()) {
    validateDamageEvent(event, index, result, context);
    const order = [
      event.frame,
      event.eventPriority,
      event.eventSequence
    ] satisfies [number, number, number];
    if (
      previousOrder !== undefined &&
      (order[0] < previousOrder[0] ||
        (order[0] === previousOrder[0] &&
          order[1] < previousOrder[1]) ||
        (order[0] === previousOrder[0] &&
          order[1] === previousOrder[1] &&
          order[2] < previousOrder[2]))
    ) {
      addIssue(
        context,
        ["damageEvents", index],
        "damage events must use nondecreasing queue order"
      );
    }
    previousOrder = order;
    totalDamage += event.finalDamage;
    const targetAggregate = targetAggregates.get(event.targetId);
    if (targetAggregate === undefined) {
      addIssue(
        context,
        ["damageEvents", index, "targetId"],
        `references unknown target ${event.targetId}`
      );
    } else {
      targetAggregate.damage += event.finalDamage;
      targetAggregate.potentialDamage += event.potentialDamage;
      targetAggregate.damageEvents += 1;
      if (event.targetDamagePolicy === "immune") {
        targetAggregate.immuneDamageEvents += 1;
      }
    }
    addToRecord(
      byCharacter,
      event.creditOwnerId,
      event.finalDamage
    );
    addToRecord(hitCountByCharacter, event.creditOwnerId, 1);
    if (event.kind === "direct" && event.reaction !== "none") {
      reactedHits += 1;
    }
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
    if (bucket !== undefined) {
      addToRecord(
        bucket,
        event.creditOwnerId,
        event.finalDamage
      );
    }
  }
  for (const [index, resolution] of
    result.hitResolutionLog.entries()) {
    const targetAggregate = targetAggregates.get(
      resolution.targetId
    );
    if (targetAggregate === undefined) {
      addIssue(
        context,
        ["hitResolutionLog", index, "targetId"],
        `references unknown target ${resolution.targetId}`
      );
      continue;
    }
    if (resolution.landed) {
      targetAggregate.landedChecks += 1;
    } else {
      targetAggregate.missedChecks += 1;
    }
  }

  expectNearlyEqual(
    context,
    ["totalDamage"],
    result.totalDamage,
    totalDamage,
    "totalDamage"
  );
  expectNearlyEqual(
    context,
    ["dps"],
    result.dps,
    totalDamage / result.config.duration,
    "DPS"
  );
  if (result.reactedHits !== reactedHits) {
    addIssue(
      context,
      ["reactedHits"],
      `must equal ${reactedHits} direct reacted hits`
    );
  }
  compareFiniteRecord(
    context,
    ["byCharacter"],
    result.byCharacter,
    byCharacter,
    "byCharacter"
  );

  const characterSummaries = result.config.characters
    .map((character) => {
      const damage = byCharacter[character.id] ?? 0;
      return {
        characterId: character.id,
        damage,
        hits: hitCountByCharacter[character.id] ?? 0,
        dps: damage / result.config.duration,
        share: totalDamage === 0 ? 0 : damage / totalDamage
      };
    })
    .sort((left, right) => right.damage - left.damage);
  expectSemanticEqual(
    context,
    ["characterSummaries"],
    result.characterSummaries,
    characterSummaries,
    "character summaries"
  );

  const targetSummaries = result.enemyTargets.map((target) => {
    const aggregate = targetAggregates.get(target.id);
    if (aggregate === undefined) {
      throw new Error(
        `Missing aggregate for resolved target ${target.id}.`
      );
    }
    return {
      targetId: target.id,
      targetName: target.name,
      damage: aggregate.damage,
      potentialDamage: aggregate.potentialDamage,
      damageEvents: aggregate.damageEvents,
      landedChecks: aggregate.landedChecks,
      missedChecks: aggregate.missedChecks,
      immuneDamageEvents: aggregate.immuneDamageEvents,
      dps: aggregate.damage / result.config.duration,
      share:
        totalDamage === 0 ? 0 : aggregate.damage / totalDamage
    };
  });
  expectSemanticEqual(
    context,
    ["targetSummaries"],
    result.targetSummaries,
    targetSummaries,
    "target summaries"
  );

  const skillSummaries = [...bySkill.values()]
    .map((skill) => ({
      ...skill,
      dps: skill.damage / result.config.duration,
      share: totalDamage === 0 ? 0 : skill.damage / totalDamage
    }))
    .sort((left, right) => right.damage - left.damage);
  expectSemanticEqual(
    context,
    ["bySkill"],
    result.bySkill,
    skillSummaries,
    "skill summaries"
  );
  expectSemanticEqual(
    context,
    ["perSecond"],
    result.perSecond,
    perSecond,
    "per-second aggregation"
  );

  if (result.damageCurve.length !== result.damageEvents.length) {
    addIssue(
      context,
      ["damageCurve"],
      "must contain one point per damage event"
    );
  }
  const cumulativeByCharacter: Record<string, number> = {};
  const cumulativeByComponent = {
    direct: 0,
    additiveReaction: 0,
    transformativeReaction: 0
  };
  const cumulativeByReaction: Record<string, number> = {};
  let cumulativeDamage = 0;
  for (const [index, event] of result.damageEvents.entries()) {
    cumulativeDamage += event.finalDamage;
    addToRecord(
      cumulativeByCharacter,
      event.creditOwnerId,
      event.finalDamage
    );
    cumulativeByComponent.direct +=
      event.damageComposition.direct;
    cumulativeByComponent.additiveReaction +=
      event.damageComposition.additiveReaction;
    cumulativeByComponent.transformativeReaction +=
      event.damageComposition.transformativeReaction;
    const transformativeReaction =
      event.transformativeReactionFactors?.reaction;
    if (transformativeReaction !== undefined) {
      addToRecord(
        cumulativeByReaction,
        transformativeReaction,
        event.damageComposition.transformativeReaction
      );
    }
    const point = result.damageCurve[index];
    if (point === undefined) continue;
    for (const [field, expected] of [
      ["damageEventId", event.id],
      ["targetId", event.targetId],
      ["targetName", event.targetName],
      ["frame", event.frame],
      ["sourceActorId", event.sourceActorId],
      ["creditOwnerId", event.creditOwnerId]
    ] as const) {
      expectEqual(
        context,
        ["damageCurve", index, field],
        point[field],
        expected,
        `damage curve ${field}`
      );
    }
    for (const [field, expected] of [
      ["timeSeconds", event.timeSeconds],
      ["finalDamage", event.finalDamage],
      ["cumulativeDamage", cumulativeDamage]
    ] as const) {
      expectNearlyEqual(
        context,
        ["damageCurve", index, field],
        point[field],
        expected,
        `damage curve ${field}`
      );
    }
    compareFiniteRecord(
      context,
      ["damageCurve", index, "cumulativeByCharacter"],
      point.cumulativeByCharacter,
      cumulativeByCharacter,
      "damage curve cumulativeByCharacter"
    );
    for (const component of [
      "direct",
      "additiveReaction",
      "transformativeReaction"
    ] as const) {
      expectNearlyEqual(
        context,
        [
          "damageCurve",
          index,
          "cumulativeByComponent",
          component
        ],
        point.cumulativeByComponent[component],
        cumulativeByComponent[component],
        `damage curve cumulativeByComponent.${component}`
      );
    }
    compareFiniteRecord(
      context,
      ["damageCurve", index, "cumulativeByReaction"],
      point.cumulativeByReaction,
      cumulativeByReaction,
      "damage curve cumulativeByReaction"
    );
  }
}

function validateAuraProjection(
  result: SimulationResult,
  context: RefinementCtx,
  damageEventIds: ReadonlySet<number>
): void {
  let auraTimelineIndex = 0;
  for (const [eventIndex, event] of result.damageEvents.entries()) {
    const audit = event.reactionAudit;
    if (
      audit.auraBefore === null ||
      audit.auraApplied === null ||
      audit.auraConsumed === null ||
      audit.auraAfter === null
    ) {
      if (
        audit.auraBefore !== null ||
        audit.auraApplied !== null ||
        audit.auraConsumed !== null ||
        audit.auraAfter !== null
      ) {
        addIssue(
          context,
          ["damageEvents", eventIndex, "reactionAudit"],
          "Aura audit fields must be all-null or all-present"
        );
      }
      continue;
    }

    const point = result.auraTimeline[auraTimelineIndex];
    if (point === undefined) {
      addIssue(
        context,
        ["auraTimeline"],
        `missing projection for damage event ${event.id}`
      );
      auraTimelineIndex += 1;
      continue;
    }
    const timelinePath = [
      "auraTimeline",
      auraTimelineIndex
    ] satisfies IssuePath;
    expectFieldEqual(
      context,
      timelinePath,
      "damageEventId",
      point.damageEventId,
      event.id,
      "Aura timeline damage event"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "eventPriority",
      point.eventPriority,
      event.eventPriority,
      "Aura timeline event priority"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "eventSequence",
      point.eventSequence,
      event.eventSequence,
      "Aura timeline event sequence"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "targetId",
      point.targetId,
      event.targetId,
      "Aura timeline target"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "targetName",
      point.targetName,
      event.targetName,
      "Aura timeline target name"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "frame",
      point.frame,
      event.frame,
      "Aura timeline frame"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "sourceActorId",
      point.sourceActorId,
      event.sourceActorId,
      "Aura timeline source"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "actionId",
      point.actionId,
      event.actionId,
      "Aura timeline action"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "hitId",
      point.hitId,
      event.hitId,
      "Aura timeline hit"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "incomingElement",
      point.incomingElement,
      event.element,
      "Aura timeline incoming element"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "icdAllowed",
      point.icdAllowed,
      audit.icdAllowed,
      "Aura timeline ICD decision"
    );
    expectFieldEqual(
      context,
      timelinePath,
      "reaction",
      point.reaction,
      audit.reaction,
      "Aura timeline reaction"
    );
    expectFieldNearlyEqual(
      context,
      timelinePath,
      "timeSeconds",
      point.timeSeconds,
      event.timeSeconds,
      "Aura timeline time"
    );
    if (!orderedScalarArrayEqual(point.reactions, audit.reactions)) {
      addIssue(
        context,
        [...timelinePath, "reactions"],
        "Aura timeline reactions do not match their authoritative source"
      );
    }
    if (
      !orderedScalarArrayEqual(
        point.unsupportedReactions,
        audit.unsupportedReactions
      )
    ) {
      addIssue(
        context,
        [...timelinePath, "unsupportedReactions"],
        "Aura timeline unsupported reactions do not match their authoritative source"
      );
    }
    if (
      !mechanicsTruncationProjectionEqual(
        point.mechanicsTruncation,
        audit.mechanicsTruncation
      )
    ) {
      addIssue(
        context,
        [...timelinePath, "mechanicsTruncation"],
        "Aura timeline mechanics truncation does not match its authoritative source"
      );
    }
    expectAuraStateFieldProjection(
      context,
      timelinePath,
      "auraBefore",
      point.auraBefore,
      audit.auraBefore,
      "Aura timeline auraBefore"
    );
    expectAuraGaugeFieldProjection(
      context,
      timelinePath,
      "auraApplied",
      point.auraApplied,
      audit.auraApplied,
      "Aura timeline auraApplied"
    );
    expectAuraGaugeFieldProjection(
      context,
      timelinePath,
      "auraConsumed",
      point.auraConsumed,
      audit.auraConsumed,
      "Aura timeline auraConsumed"
    );
    expectAuraStateFieldProjection(
      context,
      timelinePath,
      "auraAfter",
      point.auraAfter,
      audit.auraAfter,
      "Aura timeline auraAfter"
    );
    auraTimelineIndex += 1;
  }
  if (auraTimelineIndex !== result.auraTimeline.length) {
    addIssue(
      context,
      ["auraTimeline"],
      `must contain exactly ${auraTimelineIndex} damage-event Aura projections`
    );
  }

  const targetById = new Map(
    result.enemyTargets.map((target) => [target.id, target])
  );
  type TimelinePointOwnership = {
    point: SimulationResult["targetStateTimeline"]["points"][number];
    count: number;
  };
  const initialBoundaryByTarget = new Map<
    string,
    TimelinePointOwnership
  >();
  const endBoundaryByTarget = new Map<
    string,
    TimelinePointOwnership
  >();
  const applicationPointsByDamageEventId = new Map<
    number,
    TimelinePointOwnership
  >();
  const linkTargets: Record<
    Exclude<
      SimulationResult["targetStateTimeline"]["points"][number]["links"][number]["kind"],
      "damage-event"
    >,
    ReadonlySet<number>
  > = {
    "reaction-task-log": new Set(
      result.reactionTaskLog.map((entry) => entry.id)
    ),
    "reaction-damage-log": new Set(
      result.reactionDamageLog.map((entry) => entry.id)
    ),
    "periodic-reaction-log": new Set(
      result.periodicReactionLog.map((entry) => entry.id)
    ),
    "frozen-state-log": new Set(
      result.frozenStateLog.map((entry) => entry.id)
    ),
    "quicken-state-log": new Set(
      result.quickenStateLog.map((entry) => entry.id)
    ),
    "burning-state-log": new Set(
      result.burningStateLog.map((entry) => entry.id)
    ),
    "target-phase-log": new Set(
      result.targetPhaseLog.map((entry) => entry.id)
    ),
    "target-mechanics-truncation-log": new Set(
      result.targetMechanicsTruncationLog.map((entry) => entry.id)
    )
  };

  for (const [pointIndex, point] of
    result.targetStateTimeline.points.entries()) {
    if (point.id !== pointIndex) {
      addIssue(
        context,
        ["targetStateTimeline", "points", pointIndex, "id"],
        "target-state timeline IDs must be contiguous and index-addressable"
      );
    }
    const target = targetById.get(point.targetId);
    if (
      target === undefined ||
      target.name !== point.targetName
    ) {
      addIssue(
        context,
        [
          "targetStateTimeline",
          "points",
          pointIndex,
          "targetId"
        ],
        "target-state timeline target identity must match enemyTargets"
      );
    }
    if (
      point.primaryDamageEventId !== null &&
      !damageEventIds.has(point.primaryDamageEventId)
    ) {
      addIssue(
        context,
        [
          "targetStateTimeline",
          "points",
          pointIndex,
          "primaryDamageEventId"
        ],
        `references missing damage event ${point.primaryDamageEventId}`
      );
    }
    for (const [linkIndex, link] of point.links.entries()) {
      const valid =
        link.kind === "damage-event"
          ? damageEventIds.has(link.id)
          : linkTargets[link.kind].has(link.id);
      if (!valid) {
        addIssue(
          context,
          [
            "targetStateTimeline",
            "points",
            pointIndex,
            "links",
            linkIndex,
            "id"
          ],
          `references missing ${link.kind} ${link.id}`
        );
      }
    }
    if (point.cause === "simulation-start") {
      const ownership = initialBoundaryByTarget.get(point.targetId);
      if (ownership === undefined) {
        initialBoundaryByTarget.set(point.targetId, {
          point,
          count: 1
        });
      } else {
        ownership.count += 1;
      }
    } else if (point.cause === "simulation-end") {
      const ownership = endBoundaryByTarget.get(point.targetId);
      if (ownership === undefined) {
        endBoundaryByTarget.set(point.targetId, {
          point,
          count: 1
        });
      } else {
        ownership.count += 1;
      }
    } else if (
      (point.cause === "direct-hit-application" ||
        point.cause === "reaction-damage-application") &&
      point.primaryDamageEventId !== null
    ) {
      const ownership = applicationPointsByDamageEventId.get(
        point.primaryDamageEventId
      );
      if (ownership === undefined) {
        applicationPointsByDamageEventId.set(
          point.primaryDamageEventId,
          { point, count: 1 }
        );
      } else {
        ownership.count += 1;
      }
    }
  }

  for (const [auraIndex, auraPoint] of
    result.auraTimeline.entries()) {
    const event = result.damageEvents[auraPoint.damageEventId];
    const applicationOwnership =
      applicationPointsByDamageEventId.get(
        auraPoint.damageEventId
      );
    if (
      applicationOwnership?.count !== 1 ||
      event === undefined
    ) {
      addIssue(
        context,
        ["auraTimeline", auraIndex, "damageEventId"],
        `damage event ${auraPoint.damageEventId} must own exactly one target-state application point`
      );
      continue;
    }
    const application = applicationOwnership.point;
    const expectedCause =
      event.kind === "direct"
        ? "direct-hit-application"
        : "reaction-damage-application";
    const expectedEventType =
      event.kind === "direct" ? "hit" : "reactionDamage";
    const applicationPath = [
      "targetStateTimeline",
      "points",
      application.id
    ] satisfies IssuePath;
    expectFieldEqual(
      context,
      applicationPath,
      "cause",
      application.cause,
      expectedCause,
      "target-state application cause"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "eventType",
      application.eventType,
      expectedEventType,
      "target-state application event type"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "eventPriority",
      application.eventPriority,
      event.eventPriority,
      "target-state application priority"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "eventSequence",
      application.eventSequence,
      event.eventSequence,
      "target-state application sequence"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "targetId",
      application.targetId,
      auraPoint.targetId,
      "target-state application target"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "targetName",
      application.targetName,
      auraPoint.targetName,
      "target-state application target name"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "frame",
      application.frame,
      auraPoint.frame,
      "target-state application frame"
    );
    expectFieldEqual(
      context,
      applicationPath,
      "reaction",
      application.reaction,
      auraPoint.reaction,
      "target-state application reaction"
    );
    expectFieldNearlyEqual(
      context,
      applicationPath,
      "timeSeconds",
      application.timeSeconds,
      auraPoint.timeSeconds,
      "target-state application time"
    );
    if (!orderedScalarArrayEqual(application.reactions, auraPoint.reactions)) {
      addIssue(
        context,
        [...applicationPath, "reactions"],
        "target-state application reactions do not match their authoritative source"
      );
    }
    expectAuraStateFieldProjection(
      context,
      applicationPath,
      "auraBefore",
      application.auraBefore,
      auraPoint.auraBefore,
      "target-state application auraBefore"
    );
    expectAuraGaugeFieldProjection(
      context,
      applicationPath,
      "auraApplied",
      application.auraApplied,
      auraPoint.auraApplied,
      "target-state application auraApplied"
    );
    expectAuraGaugeFieldProjection(
      context,
      applicationPath,
      "auraConsumed",
      application.auraConsumed,
      auraPoint.auraConsumed,
      "target-state application auraConsumed"
    );
    expectAuraStateFieldProjection(
      context,
      applicationPath,
      "auraAfter",
      application.auraAfter,
      auraPoint.auraAfter,
      "target-state application auraAfter"
    );
    let matchingDamageLinkCount = 0;
    for (const link of application.links) {
      if (
        link.kind === "damage-event" &&
        link.id === auraPoint.damageEventId
      ) {
        matchingDamageLinkCount += 1;
      }
    }
    if (matchingDamageLinkCount !== 1) {
      addIssue(
        context,
        [...applicationPath, "links"],
        "target-state application must backlink its damage event exactly once"
      );
    }
  }

  for (const [targetIndex, target] of
    result.enemyTargets.entries()) {
    const initialState = result.auraInitialStates[targetIndex];
    const endState = result.auraEndStates[targetIndex];
    const initialBoundaryOwnership =
      initialBoundaryByTarget.get(target.id);
    const endBoundaryOwnership = endBoundaryByTarget.get(target.id);
    if (initialBoundaryOwnership?.count !== 1) {
      addIssue(
        context,
        ["targetStateTimeline", "points"],
        `target ${target.id} must have exactly one simulation-start boundary`
      );
    }
    if (endBoundaryOwnership?.count !== 1) {
      addIssue(
        context,
        ["targetStateTimeline", "points"],
        `target ${target.id} must have exactly one simulation-end boundary`
      );
    }
    const initialBoundary = initialBoundaryOwnership?.point;
    if (initialState !== undefined && initialBoundary !== undefined) {
      expectEqual(
        context,
        [
          "targetStateTimeline",
          "points",
          initialBoundary.id,
          "frame"
        ],
        initialBoundary.frame,
        initialState.frame,
        "initial Aura boundary frame"
      );
      expectNearlyEqual(
        context,
        [
          "targetStateTimeline",
          "points",
          initialBoundary.id,
          "timeSeconds"
        ],
        initialBoundary.timeSeconds,
        initialState.timeSeconds,
        "initial Aura boundary time"
      );
      expectSemanticEqual(
        context,
        ["auraInitialStates", targetIndex, "aura"],
        initialState.aura,
        initialBoundary.auraAfter,
        "initial Aura boundary"
      );
      expectSemanticEqual(
        context,
        [
          "targetStateTimeline",
          "points",
          initialBoundary.id,
          "auraBefore"
        ],
        initialBoundary.auraBefore,
        initialState.aura,
        "initial Aura boundary before-state"
      );
    }
    if (initialState !== undefined) {
      const configuredInitialAura = target.initialAura;
      if (
        initialState.aura.length !== configuredInitialAura.length
      ) {
        addIssue(
          context,
          ["auraInitialStates", targetIndex, "aura"],
          "initial Aura must contain exactly the configured resolved elements"
        );
      }
      const currentDurability = usesCurrentAuraDurability(
        result.config.reactionEngine?.mode
      );
      const durabilityPerUnit = currentDurability
        ? CURRENT_NORMAL_AURA_DURATION_PER_UNIT_FRAMES
        : LEGACY_NORMAL_AURA_DURATION_PER_UNIT_FRAMES;
      for (const [configuredIndex, configured] of
        configuredInitialAura.entries()) {
        const matches = initialState.aura.filter(
          (entry) => entry.element === configured.element
        );
        if (matches.length !== 1) {
          addIssue(
            context,
            ["auraInitialStates", targetIndex, "aura"],
            `configured initial ${configured.element} Aura must own exactly one normalized state entry`
          );
          continue;
        }
        const actual = matches[0]!;
        const expectedGauge =
          configured.gaugeUnits * NORMAL_AURA_RATIO;
        const expectedExpiryFrame = Math.max(
          0,
          Math.ceil(
            NORMAL_AURA_BASE_DURATION_FRAMES +
              durabilityPerUnit * configured.gaugeUnits -
              1e-9
          )
        );
        expectNearlyEqual(
          context,
          [
            "auraInitialStates",
            targetIndex,
            "aura",
            configuredIndex,
            "gaugeUnits"
          ],
          actual.gaugeUnits,
          expectedGauge,
          "configured initial Aura normalization"
        );
        expectEqual(
          context,
          [
            "auraInitialStates",
            targetIndex,
            "aura",
            configuredIndex,
            "expiresAtFrame"
          ],
          actual.expiresAtFrame,
          expectedExpiryFrame,
          "configured initial Aura global expiry"
        );
        if (
          result.targetClockAudit.mode ===
          "target-local-hitlag-v1"
        ) {
          expectEqual(
            context,
            [
              "auraInitialStates",
              targetIndex,
              "aura",
              configuredIndex,
              "expiresAtTargetFrame"
            ],
            actual.expiresAtTargetFrame,
            expectedExpiryFrame,
            "configured initial Aura target-local expiry"
          );
        }
        if (!currentDurability) {
          if (actual.sourceSlots !== undefined) {
            addIssue(
              context,
              [
                "auraInitialStates",
                targetIndex,
                "aura",
                configuredIndex,
                "sourceSlots"
              ],
              "legacy initial Aura cannot expose current durability source slots"
            );
          }
        } else if (
          actual.sourceSlots === undefined ||
          actual.sourceSlots.length !== 1 ||
          actual.sourceSlots[0]?.sourceActorId !== "__initial__"
        ) {
          addIssue(
            context,
            [
              "auraInitialStates",
              targetIndex,
              "aura",
              configuredIndex,
              "sourceSlots"
            ],
            "configured initial Aura must preserve its __initial__ source slot"
          );
        } else {
          expectNearlyEqual(
            context,
            [
              "auraInitialStates",
              targetIndex,
              "aura",
              configuredIndex,
              "sourceSlots",
              0,
              "gaugeUnits"
            ],
            actual.sourceSlots[0].gaugeUnits,
            expectedGauge,
            "configured initial Aura source-slot gauge"
          );
        }
      }
    }
    const endBoundary = endBoundaryOwnership?.point;
    if (endState !== undefined && endBoundary !== undefined) {
      expectEqual(
        context,
        [
          "targetStateTimeline",
          "points",
          endBoundary.id,
          "frame"
        ],
        endBoundary.frame,
        endState.frame,
        "final Aura boundary frame"
      );
      expectNearlyEqual(
        context,
        [
          "targetStateTimeline",
          "points",
          endBoundary.id,
          "timeSeconds"
        ],
        endBoundary.timeSeconds,
        endState.timeSeconds,
        "final Aura boundary time"
      );
      expectSemanticEqual(
        context,
        ["auraEndStates", targetIndex, "aura"],
        endState.aura,
        endBoundary.auraAfter,
        "final Aura boundary"
      );
      expectSemanticEqual(
        context,
        [
          "targetStateTimeline",
          "points",
          endBoundary.id,
          "auraBefore"
        ],
        endBoundary.auraBefore,
        endState.aura,
        "final Aura boundary before-state"
      );
    }
  }
}

function validateReactionBacklinks(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const damageEventById = new Map(
    result.damageEvents.map((event) => [event.id, event])
  );
  const reactionDamageById = new Map(
    result.reactionDamageLog.map((entry) => [entry.id, entry])
  );
  const parentByDamageEventId = new Map<
    number,
    SimulationResult["reactionDamageLog"][number]
  >();
  const statusesByDamageEventId = new Map<
    number,
    SimulationResult["reactionStatusLog"]
  >();
  for (const status of result.reactionStatusLog) {
    const statuses =
      statusesByDamageEventId.get(
        status.reactionDamageEventId
      ) ?? [];
    statuses.push(status);
    statusesByDamageEventId.set(
      status.reactionDamageEventId,
      statuses
    );
  }

  for (const [parentIndex, parent] of
    result.reactionDamageLog.entries()) {
    if (!hasValidReactionDeliveryShape(parent)) {
      addIssue(
        context,
        ["reactionDamageLog", parentIndex, "scheduleKind"],
        "reaction, scheduleKind, and targetingMode must use a supported delivery shape"
      );
    }
    if (parent.triggerDamageEventId !== null) {
      const triggerEvent = damageEventById.get(
        parent.triggerDamageEventId
      );
      if (triggerEvent === undefined) {
        addIssue(
          context,
          [
            "reactionDamageLog",
            parentIndex,
            "triggerDamageEventId"
          ],
          `references missing damage event ${parent.triggerDamageEventId}`
        );
      } else if (
        parent.scheduleKind !== "dendro-core-bloom"
      ) {
        expectEqual(
          context,
          ["reactionDamageLog", parentIndex, "triggerFrame"],
          parent.triggerFrame,
          triggerEvent.frame,
          "reaction-damage trigger frame"
        );
      }
      if (triggerEvent !== undefined) {
        expectEqual(
          context,
          ["reactionDamageLog", parentIndex, "sourceActorId"],
          parent.sourceActorId,
          triggerEvent.sourceActorId,
          "reaction-damage trigger source actor"
        );
        if (
          parent.scheduleKind !== "dendro-core-bloom" &&
          parent.scheduleKind !== "dendro-core-burgeon" &&
          parent.scheduleKind !== "dendro-core-hyperbloom"
        ) {
          expectEqual(
            context,
            [
              "reactionDamageLog",
              parentIndex,
              "sourceTargetId"
            ],
            parent.sourceTargetId,
            triggerEvent.targetId,
            "reaction-damage trigger source target"
          );
        }
      }
    }
    if (
      parent.damageEventIds.length !== parent.hitTargetIds.length
    ) {
      addIssue(
        context,
        ["reactionDamageLog", parentIndex, "damageEventIds"],
        "reaction-damage children and hitTargetIds must have identical cardinality"
      );
    }
    if (
      parent.damageEventIds.length > 0 &&
      (!parent.scheduled ||
        !parent.withinSimulation ||
        parent.blockedReason !== null)
    ) {
      addIssue(
        context,
        ["reactionDamageLog", parentIndex],
        "a reaction-damage log with settled children must be scheduled, in-range, and unblocked"
      );
    }
    for (const [damageIndex, damageEventId] of
      parent.damageEventIds.entries()) {
      const event = damageEventById.get(damageEventId);
      if (event === undefined) continue;
      if (parentByDamageEventId.has(damageEventId)) {
        addIssue(
          context,
          [
            "reactionDamageLog",
            parentIndex,
            "damageEventIds",
            damageIndex
          ],
          `damage event ${damageEventId} is owned by multiple reaction-damage logs`
        );
      } else {
        parentByDamageEventId.set(damageEventId, parent);
      }
      expectEqual(
        context,
        ["damageEvents", damageEventId, "kind"],
        event.kind,
        "transformative-reaction",
        "reaction-damage child kind"
      );
      expectEqual(
        context,
        ["damageEvents", damageEventId, "reaction"],
        event.reaction,
        parent.reaction,
        "reaction-damage child outer reaction"
      );
      expectEqual(
        context,
        ["damageEvents", damageEventId, "element"],
        event.element,
        transformativeDamageElement(parent.reaction),
        "reaction-damage child element"
      );
      expectEqual(
        context,
        [
          "reactionDamageLog",
          parentIndex,
          "damageEventIds",
          damageIndex
        ],
        event.transformativeReactionFactors?.reaction,
        parent.reaction,
        "reaction-damage child reaction"
      );
      expectEqual(
        context,
        ["damageEvents", damageEventId, "parentDamageEventId"],
        event.parentDamageEventId,
        parent.triggerDamageEventId,
        "reaction-damage child trigger"
      );
      expectEqual(
        context,
        ["damageEvents", damageEventId, "sourceActorId"],
        event.sourceActorId,
        parent.sourceActorId,
        "reaction-damage child source"
      );
      expectEqual(
        context,
        ["damageEvents", damageEventId, "scalingOwnerId"],
        event.scalingOwnerId,
        parent.sourceActorId,
        "reaction-damage child scaling owner"
      );
      expectEqual(
        context,
        ["damageEvents", damageEventId, "creditOwnerId"],
        event.creditOwnerId,
        parent.sourceActorId,
        "reaction-damage child credit owner"
      );
      const sourceActor = result.config.characters.find(
        (character) => character.id === parent.sourceActorId
      );
      if (sourceActor !== undefined) {
        for (const field of [
          "sourceActorName",
          "scalingOwnerName",
          "creditOwnerName",
          "actorName"
        ] as const) {
          expectEqual(
            context,
            ["damageEvents", damageEventId, field],
            event[field],
            sourceActor.name,
            `reaction-damage child ${field}`
          );
        }
      }
      expectEqual(
        context,
        ["damageEvents", damageEventId, "frame"],
        event.frame,
        parent.damageFrame,
        "reaction-damage child frame"
      );
      expectEqual(
        context,
        [
          "reactionDamageLog",
          parentIndex,
          "hitTargetIds",
          damageIndex
        ],
        parent.hitTargetIds[damageIndex],
        event.targetId,
        "reaction-damage hit target"
      );
    }
    const triggerEvent =
      parent.triggerDamageEventId === null
        ? undefined
        : damageEventById.get(parent.triggerDamageEventId);
    const transformativeAudits =
      triggerEvent?.reactionAudit.transformativeReactions ??
      (triggerEvent?.reactionAudit.transformativeReaction === null ||
      triggerEvent?.reactionAudit.transformativeReaction === undefined
        ? []
        : [triggerEvent.reactionAudit.transformativeReaction]);
    const statusDefinition = transformativeAudits.find(
      (audit) => audit.reaction === parent.reaction
    )?.statusEffect;
    const expectedStatusIds: number[] = [];
    if (statusDefinition !== null && statusDefinition !== undefined) {
      for (const damageEventId of parent.damageEventIds) {
        const child = damageEventById.get(damageEventId);
        if (child?.mechanicsStatus !== "authoritative") continue;
        const statuses =
          statusesByDamageEventId.get(damageEventId) ?? [];
        if (statuses.length !== 1) {
          addIssue(
            context,
            ["reactionDamageLog", parentIndex, "reactionStatusLogIds"],
            `authoritative child ${damageEventId} must own exactly one reaction status`
          );
        } else {
          expectedStatusIds.push(statuses[0]!.id);
        }
      }
    }
    expectSemanticEqual(
      context,
      ["reactionDamageLog", parentIndex, "reactionStatusLogIds"],
      parent.reactionStatusLogIds,
      expectedStatusIds,
      "reaction-damage status children"
    );
    for (const [statusIndex, statusId] of
      parent.reactionStatusLogIds.entries()) {
      const status = result.reactionStatusLog[statusId];
      if (
        status === undefined ||
        status.id !== statusId ||
        !parent.damageEventIds.includes(
          status.reactionDamageEventId
        )
      ) {
        addIssue(
          context,
          [
            "reactionDamageLog",
            parentIndex,
            "reactionStatusLogIds",
            statusIndex
          ],
          `does not backlink a status owned by reaction-damage log ${parent.id}`
        );
      }
    }
  }

  for (const [eventIndex, event] of
    result.damageEvents.entries()) {
    if (
      event.kind === "transformative-reaction" &&
      !parentByDamageEventId.has(event.id)
    ) {
      addIssue(
        context,
        ["damageEvents", eventIndex, "parentDamageEventId"],
        "transformative damage event must belong to exactly one reaction-damage log"
      );
    }
  }

  const lastStatusByTargetAndKey = new Map<
    string,
    SimulationResult["reactionStatusLog"][number]
  >();
  const statusesByTargetAndKey = new Map<
    string,
    SimulationResult["reactionStatusLog"]
  >();
  const baseNaturalEndByStatusId = new Map<number, number>();
  for (const [statusIndex, status] of
    result.reactionStatusLog.entries()) {
    const event = damageEventById.get(
      status.reactionDamageEventId
    );
    const parent = parentByDamageEventId.get(
      status.reactionDamageEventId
    );
    if (
      event === undefined ||
      parent === undefined ||
      !parent.reactionStatusLogIds.includes(status.id)
    ) {
      addIssue(
        context,
        [
          "reactionStatusLog",
          statusIndex,
          "reactionDamageEventId"
        ],
        "must backlink a reaction-damage child and its owning parent log"
      );
      continue;
    }
    for (const [field, expected] of [
      ["reaction", parent.reaction],
      ["targetId", event.targetId],
      ["targetName", event.targetName],
      ["startFrame", event.frame]
    ] as const) {
      expectEqual(
        context,
        ["reactionStatusLog", statusIndex, field],
        status[field],
        expected,
        `reaction status ${field}`
      );
    }
    expectNearlyEqual(
      context,
      ["reactionStatusLog", statusIndex, "startTimeSeconds"],
      status.startTimeSeconds,
      event.timeSeconds,
      "reaction status start time"
    );
    const triggerEvent =
      parent.triggerDamageEventId === null
        ? undefined
        : damageEventById.get(parent.triggerDamageEventId);
    const transformativeAudits =
      triggerEvent?.reactionAudit.transformativeReactions ??
      (triggerEvent?.reactionAudit.transformativeReaction === null ||
      triggerEvent?.reactionAudit.transformativeReaction === undefined
        ? []
        : [triggerEvent.reactionAudit.transformativeReaction]);
    const definition = transformativeAudits.find(
      (audit) => audit.reaction === parent.reaction
    )?.statusEffect;
    if (definition === null || definition === undefined) {
      addIssue(
        context,
        ["reactionStatusLog", statusIndex],
        "reaction status must derive from its trigger audit definition"
      );
      continue;
    }
    for (const [field, expected] of [
      ["key", definition.key],
      ["label", definition.label],
      ["element", definition.element]
    ] as const) {
      expectEqual(
        context,
        ["reactionStatusLog", statusIndex, field],
        status[field],
        expected,
        `reaction status ${field}`
      );
    }
    expectNearlyEqual(
      context,
      ["reactionStatusLog", statusIndex, "resShred"],
      status.resShred,
      definition.resShred,
      "reaction status resistance shred"
    );
    const hitlagExtensionFrames =
      result.targetHitlagLog.reduce(
        (total, hitlag) =>
          hitlag.extendedReactionStatusLogIds.includes(status.id)
            ? total + hitlag.extensionFrames
            : total,
        0
      );
    const naturalEndFrame =
      status.startFrame +
      definition.durationFrames +
      hitlagExtensionFrames;
    baseNaturalEndByStatusId.set(
      status.id,
      status.startFrame + definition.durationFrames
    );
    if (status.supersededAtFrame === null) {
      expectEqual(
        context,
        ["reactionStatusLog", statusIndex, "endFrame"],
        status.endFrame,
        naturalEndFrame,
        "reaction status natural end frame"
      );
    } else {
      expectEqual(
        context,
        [
          "reactionStatusLog",
          statusIndex,
          "supersededAtFrame"
        ],
        status.supersededAtFrame,
        status.endFrame,
        "reaction status superseded frame"
      );
      if (status.endFrame >= naturalEndFrame) {
        addIssue(
          context,
          ["reactionStatusLog", statusIndex, "endFrame"],
          "superseded status must end before its natural duration"
        );
      }
    }
    expectNearlyEqual(
      context,
      ["reactionStatusLog", statusIndex, "endTimeSeconds"],
      status.endTimeSeconds,
      status.endFrame / 60,
      "reaction status end time"
    );
    const statusKey = `${status.targetId}\u0000${status.key}`;
    const previous = lastStatusByTargetAndKey.get(statusKey);
    if (
      previous !== undefined &&
      previous.endFrame > status.startFrame
    ) {
      addIssue(
        context,
        ["reactionStatusLog", statusIndex, "startFrame"],
        "reaction statuses with the same target and key cannot overlap"
      );
    }
    const expectedOperation =
      previous?.supersededAtFrame === status.startFrame
        ? "refresh"
        : "apply";
    expectEqual(
      context,
      ["reactionStatusLog", statusIndex, "operation"],
      status.operation,
      expectedOperation,
      "reaction status operation"
    );
    lastStatusByTargetAndKey.set(statusKey, status);
    const chain = statusesByTargetAndKey.get(statusKey) ?? [];
    chain.push(status);
    statusesByTargetAndKey.set(statusKey, chain);
  }
  for (const chain of statusesByTargetAndKey.values()) {
    for (const [statusIndex, status] of chain.entries()) {
      if (status.supersededAtFrame === null) continue;
      const successor = chain[statusIndex + 1];
      if (
        successor === undefined ||
        successor.startFrame !== status.supersededAtFrame ||
        successor.operation !== "refresh"
      ) {
        addIssue(
          context,
          ["reactionStatusLog", status.id, "supersededAtFrame"],
          "superseded reaction status must have an immediate reciprocal refresh at the same frame"
        );
      }
    }
  }
  const projectedNaturalEndByStatusId = new Map(
    baseNaturalEndByStatusId
  );
  for (const [hitlagIndex, hitlag] of
    result.targetHitlagLog.entries()) {
    expectNearlyEqual(
      context,
      ["targetHitlagLog", hitlagIndex, "timeSeconds"],
      hitlag.timeSeconds,
      hitlag.globalFrame / 60,
      "target Hitlag time"
    );
    const expectedStatusIds =
      hitlag.applied && hitlag.extensionFrames > 0
        ? result.reactionStatusLog
            .filter((status) => {
              if (
                status.reaction !== "superconduct" ||
                status.targetId !== hitlag.targetId ||
                status.targetName !== hitlag.targetName
              ) {
                return false;
              }
              const sourceEvent = damageEventById.get(
                status.reactionDamageEventId
              );
              const createdBeforeHitlag =
                sourceEvent !== undefined &&
                (sourceEvent.frame < hitlag.globalFrame ||
                  (sourceEvent.frame === hitlag.globalFrame &&
                    (sourceEvent.eventPriority <
                      hitlag.eventPriority ||
                      (sourceEvent.eventPriority ===
                        hitlag.eventPriority &&
                        sourceEvent.eventSequence <
                          hitlag.eventSequence))));
              const naturalEnd =
                projectedNaturalEndByStatusId.get(status.id);
              const activeEnd =
                naturalEnd === undefined
                  ? undefined
                  : Math.min(
                      naturalEnd,
                      status.supersededAtFrame ??
                        Number.POSITIVE_INFINITY
                    );
              return (
                createdBeforeHitlag &&
                activeEnd !== undefined &&
                activeEnd > hitlag.globalFrame
              );
            })
            .map((status) => status.id)
        : [];
    expectSemanticEqual(
      context,
      [
        "targetHitlagLog",
        hitlagIndex,
        "extendedReactionStatusLogIds"
      ],
      hitlag.extendedReactionStatusLogIds,
      expectedStatusIds,
      "target Hitlag active Superconduct status set"
    );
    for (const statusId of expectedStatusIds) {
      const projectedEnd =
        projectedNaturalEndByStatusId.get(statusId);
      if (projectedEnd !== undefined) {
        projectedNaturalEndByStatusId.set(
          statusId,
          projectedEnd + hitlag.extensionFrames
        );
      }
    }
  }

  const hasElectroChargedEvidence =
    result.periodicReactionLog.length > 0 ||
    result.damageEvents.some(
      (event) =>
        event.reaction === "electroCharged" ||
        event.transformativeReactionFactors?.reaction ===
          "electroCharged" ||
        event.reactionAudit.reactions.includes(
          "electroCharged"
        ) ||
        event.reactionAudit.periodicReaction !== null
    ) ||
    result.hitEvents.some(
      (event) =>
        event.reaction === "electroCharged" ||
        event.transformativeReactionFactors?.reaction ===
          "electroCharged" ||
        event.reactionAudit.reactions.includes(
          "electroCharged"
        ) ||
        event.reactionAudit.periodicReaction !== null
    ) ||
    result.reactionDamageLog.some(
      (parent) =>
        parent.reaction === "electroCharged" ||
        parent.scheduleKind === "periodic-tick"
    ) ||
    result.reactionTaskLog.some(
      (task) => task.electroChargedCleanup != null
    ) ||
    result.targetPhaseLog.some((phase) =>
      phase.reactableTick.transitions.some(
        (transition) =>
          transition.kind === "electro-charged-expiry" ||
          transition.kind === "electro-charged-cleanup"
      )
    ) ||
    result.targetStateTimeline.points.some(
      (point) =>
        point.cause === "electro-charged-wane" ||
        point.links.some(
          (link) => link.kind === "periodic-reaction-log"
        )
    );
  if (!hasElectroChargedEvidence) {
    return;
  }

  const electroChargedGlobalCadenceMode =
    result.config.reactionEngine?.mode === "aura-v9";
  for (const [eventIndex, event] of result.damageEvents.entries()) {
    const periodicAudit = event.reactionAudit.periodicReaction;
    if (periodicAudit !== null) {
      const auditPath = [
        "damageEvents",
        eventIndex,
        "reactionAudit",
        "periodicReaction"
      ] satisfies IssuePath;
      for (const [field, expected] of [
        ["damageElement", "electro"],
        ["baseMultiplier", ELECTRO_CHARGED_BASE_MULTIPLIER],
        [
          "tickIntervalFrames",
          ELECTRO_CHARGED_TICK_INTERVAL_FRAMES
        ],
        ["waneDelayFrames", ELECTRO_CHARGED_WANE_DELAY_FRAMES],
        ["waneGaugeUnits", ELECTRO_CHARGED_WANE_GAUGE_UNITS]
      ] as const) {
        expectEqual(
          context,
          [...auditPath, field],
          periodicAudit[field],
          expected,
          `Electro-Charged audit ${field}`
        );
      }
      expectEqual(
        context,
        [...auditPath, "firstDamageFrame"],
        periodicAudit.firstDamageFrame,
        periodicAudit.operation === "start"
          ? event.frame +
              ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES
          : null,
        "Electro-Charged audit first damage frame"
      );
      if (periodicAudit.operation === "start") {
        expectEqual(
          context,
          [...auditPath, "nextTickFrame"],
          periodicAudit.nextTickFrame,
          event.frame +
            ELECTRO_CHARGED_FIRST_DAMAGE_DELAY_FRAMES +
            ELECTRO_CHARGED_TICK_INTERVAL_FRAMES,
          "Electro-Charged start next callback frame"
        );
      }
      if (periodicAudit.operation === "stop") {
        for (const field of [
          "nextTickFrame",
          "coexistenceExpiresAtFrame"
        ] as const) {
          expectEqual(
            context,
            [...auditPath, field],
            periodicAudit[field],
            null,
            `Electro-Charged stop ${field}`
          );
        }
      }
      if (electroChargedGlobalCadenceMode) {
        if (
          periodicAudit.cadenceStatus === undefined ||
          periodicAudit.waneListenerActive === undefined
        ) {
          addIssue(
            context,
            auditPath,
            "aura-v9 Electro-Charged audits require cadence and Wane-listener state"
          );
        }
        if (periodicAudit.operation === "stop") {
          expectEqual(
            context,
            [...auditPath, "cadenceStatus"],
            periodicAudit.cadenceStatus,
            "stopped",
            "Electro-Charged stop cadence"
          );
          expectEqual(
            context,
            [...auditPath, "waneListenerActive"],
            periodicAudit.waneListenerActive,
            false,
            "Electro-Charged stop Wane listener"
          );
        }
      } else if (
        periodicAudit.cadenceStatus !== undefined ||
        periodicAudit.waneListenerActive !== undefined
      ) {
        addIssue(
          context,
          auditPath,
          "pre-aura-v9 Electro-Charged audits cannot claim global cadence state"
        );
      }
    }
    if (
      event.reactionAudit.mechanicsTruncation !== null &&
      periodicAudit !== null &&
      periodicAudit.operation !== "stop"
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "periodicReaction"
        ],
        "target mechanics truncation cannot advertise an Electro-Charged start or refresh stream"
      );
    }
  }

  const periodicTickByKey = new Map<
    string,
    SimulationResult["periodicReactionLog"][number]
  >();
  const periodicTickByDamageEventId = new Map<
    number,
    SimulationResult["periodicReactionLog"][number]
  >();
  const periodicTicksByReactionDamageId = new Map<
    number,
    SimulationResult["periodicReactionLog"]
  >();
  const periodicStreamByTargetGeneration = new Map<
    string,
    {
      nextTickIndex: number;
    }
  >();
  const periodicStartKeys = new Set<string>();
  const nextPeriodicStartGenerationByTarget = new Map<
    string,
    number
  >();
  const currentPeriodicGenerationByTarget = new Map<
    string,
    number
  >();
  const startOrRefreshRowsByAuditKey = new Map<
    string,
    SimulationResult["periodicReactionLog"]
  >();
  const ordinaryStopKeys = new Set<string>();
  const hitStopRowsByTriggerDamageEventId = new Map<
    number,
    SimulationResult["periodicReactionLog"]
  >();
  const waneCallbackKeys = new Set<string>();
  const generationBoundWaneMode =
    result.config.reactionEngine?.mode === "aura-v8" ||
    result.config.reactionEngine?.mode === "aura-v9";
  const periodicStreamKey = (
    periodic: SimulationResult["periodicReactionLog"][number]
  ): string => `${periodic.targetId}\u0000${periodic.generation}`;
  const periodicTickKey = (
    periodic: SimulationResult["periodicReactionLog"][number]
  ): string =>
    `${periodic.targetId}\u0000${periodic.generation}\u0000${periodic.tickIndex}`;
  const periodicAuditKey = (
    damageEventId: number,
    operation: "start" | "refresh"
  ): string => `${damageEventId}\u0000${operation}`;
  const firstWaneTimelinePointByPeriodicId = new Map<
    number,
    SimulationResult["targetStateTimeline"]["points"][number]
  >();
  for (const point of result.targetStateTimeline.points) {
    if (point.cause !== "electro-charged-wane") continue;
    for (const link of point.links) {
      if (
        link.kind === "periodic-reaction-log" &&
        !firstWaneTimelinePointByPeriodicId.has(link.id)
      ) {
        firstWaneTimelinePointByPeriodicId.set(link.id, point);
      }
    }
  }
  const historicalActiveCadenceRowByStream = new Map<
    string,
    SimulationResult["periodicReactionLog"][number]
  >();
  for (const [periodicIndex, periodic] of
    result.periodicReactionLog.entries()) {
    const streamKey = periodicStreamKey(periodic);
    const rowPath = [
      "periodicReactionLog",
      periodicIndex
    ] satisfies IssuePath;
    if (electroChargedGlobalCadenceMode) {
      if (
        periodic.cadenceStatus === undefined ||
        periodic.waneListenerActive === undefined
      ) {
        addIssue(
          context,
          rowPath,
          "aura-v9 Electro-Charged lifecycle rows require cadence and Wane-listener state"
        );
      } else if (periodic.operation === "start") {
        expectEqual(
          context,
          [...rowPath, "cadenceStatus"],
          periodic.cadenceStatus,
          "scheduled",
          "aura-v9 start cadence"
        );
        expectEqual(
          context,
          [...rowPath, "waneListenerActive"],
          periodic.waneListenerActive,
          true,
          "aura-v9 start Wane listener"
        );
      } else if (periodic.operation === "refresh") {
        const expectedStatus =
          periodic.nextTickFrame === null
            ? "dormant"
            : "scheduled";
        expectEqual(
          context,
          [...rowPath, "cadenceStatus"],
          periodic.cadenceStatus,
          expectedStatus,
          "aura-v9 refresh cadence"
        );
        if (expectedStatus === "dormant") {
          expectEqual(
            context,
            [...rowPath, "waneListenerActive"],
            periodic.waneListenerActive,
            false,
            "aura-v9 dormant refresh Wane listener"
          );
        }
      } else if (periodic.operation === "tick") {
        const expectedStatus =
          periodic.nextTickFrame === null
            ? "stopped"
            : "scheduled";
        expectEqual(
          context,
          [...rowPath, "cadenceStatus"],
          periodic.cadenceStatus,
          expectedStatus,
          "aura-v9 tick cadence"
        );
        if (expectedStatus === "stopped") {
          expectEqual(
            context,
            [...rowPath, "waneListenerActive"],
            periodic.waneListenerActive,
            false,
            "aura-v9 stopped tick Wane listener"
          );
        }
      } else if (periodic.operation === "tick-skipped") {
        expectEqual(
          context,
          [...rowPath, "cadenceStatus"],
          periodic.cadenceStatus,
          "dormant",
          "aura-v9 skipped tick cadence"
        );
        expectEqual(
          context,
          [...rowPath, "waneListenerActive"],
          periodic.waneListenerActive,
          false,
          "aura-v9 skipped tick Wane listener"
        );
      } else if (periodic.operation === "stop") {
        expectEqual(
          context,
          [...rowPath, "cadenceStatus"],
          periodic.cadenceStatus,
          "stopped",
          "aura-v9 terminal cadence"
        );
        expectEqual(
          context,
          [...rowPath, "waneListenerActive"],
          periodic.waneListenerActive,
          false,
          "aura-v9 terminal Wane listener"
        );
      }
    } else if (
      periodic.cadenceStatus !== undefined ||
      periodic.waneListenerActive !== undefined
    ) {
      addIssue(
        context,
        rowPath,
        "pre-aura-v9 Electro-Charged lifecycle rows cannot claim global cadence state"
      );
    }
    if (periodic.operation === "start") {
      const expectedGeneration =
        nextPeriodicStartGenerationByTarget.get(
          periodic.targetId
        ) ?? 1;
      expectEqual(
        context,
        ["periodicReactionLog", periodicIndex, "generation"],
        periodic.generation,
        expectedGeneration,
        "Electro-Charged canonical start generation"
      );
      nextPeriodicStartGenerationByTarget.set(
        periodic.targetId,
        expectedGeneration + 1
      );
      currentPeriodicGenerationByTarget.set(
        periodic.targetId,
        periodic.generation
      );
      if (periodicStartKeys.has(streamKey)) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "generation"],
          "Electro-Charged generation must have exactly one start row"
        );
      }
      periodicStartKeys.add(streamKey);
    } else if (!periodicStartKeys.has(streamKey)) {
      addIssue(
        context,
        ["periodicReactionLog", periodicIndex, "generation"],
        "Electro-Charged lifecycle row requires a preceding start for the same target and generation"
      );
    }
    expectNearlyEqual(
      context,
      ["periodicReactionLog", periodicIndex, "timeSeconds"],
      periodic.timeSeconds,
      periodic.frame / 60,
      "periodic reaction time"
    );
    if (
      periodic.triggerDamageEventId !== null &&
      !damageEventById.has(periodic.triggerDamageEventId)
    ) {
      addIssue(
        context,
        [
          "periodicReactionLog",
          periodicIndex,
          "triggerDamageEventId"
        ],
        `references missing damage event ${periodic.triggerDamageEventId}`
      );
    }
    const target = result.enemyTargets.find(
      (candidate) => candidate.id === periodic.targetId
    );
    if (
      target === undefined ||
      target.name !== periodic.targetName
    ) {
      addIssue(
        context,
        ["periodicReactionLog", periodicIndex, "targetId"],
        "periodic reaction target identity must match enemyTargets"
      );
    }
    const explicitParent =
      periodic.reactionDamageLogId === null
        ? undefined
        : reactionDamageById.get(periodic.reactionDamageLogId);
    if (
      periodic.reactionDamageLogId !== null &&
      explicitParent === undefined
    ) {
      addIssue(
        context,
        [
          "periodicReactionLog",
          periodicIndex,
          "reactionDamageLogId"
        ],
        `references missing reaction-damage log ${periodic.reactionDamageLogId}`
      );
    }
    const isWaneOperation =
      periodic.operation === "wane" ||
      periodic.operation === "wane-skipped" ||
      (periodic.operation === "stop" &&
        periodic.waneFrame !== null);
    if (
      periodic.operation === "stop" &&
      periodic.waneFrame === null
    ) {
      if (ordinaryStopKeys.has(streamKey)) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "operation"],
          "Electro-Charged generation can own at most one ordinary terminal stop"
        );
      }
      ordinaryStopKeys.add(streamKey);
      if (periodic.reason === "COEXISTING_AURA_MISSING") {
        const activeCadenceRow =
          historicalActiveCadenceRowByStream.get(streamKey);
        if (
          activeCadenceRow === undefined ||
          activeCadenceRow.nextTickFrame === null
        ) {
          addIssue(
            context,
            ["periodicReactionLog", periodicIndex, "frame"],
            "missing-Aura Electro-Charged stop requires a preceding scheduled callback"
          );
        } else {
          expectEqual(
            context,
            ["periodicReactionLog", periodicIndex, "frame"],
            periodic.frame,
            activeCadenceRow.nextTickFrame,
            "missing-Aura Electro-Charged callback frame"
          );
          expectEqual(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "sourceActorId"
            ],
            periodic.sourceActorId,
            activeCadenceRow.sourceActorId,
            "missing-Aura Electro-Charged source"
          );
          expectEqual(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "triggerDamageEventId"
            ],
            periodic.triggerDamageEventId,
            activeCadenceRow.triggerDamageEventId,
            "missing-Aura Electro-Charged trigger"
          );
        }
        if (
          hasElectroChargedCoexistence(periodic.auraBefore) ||
          !auraStateProjectionEqual(
            periodic.auraBefore,
            periodic.auraAfter
          ) ||
          periodic.auraConsumed.length !== 0
        ) {
          addIssue(
            context,
            ["periodicReactionLog", periodicIndex, "reason"],
            "missing-Aura Electro-Charged stop must observe unchanged non-coexisting Aura"
          );
        }
      }
      if (
        periodic.reason === "COEXISTING_AURA_REMOVED_BY_HIT" &&
        periodic.triggerDamageEventId !== null
      ) {
        const rows =
          hitStopRowsByTriggerDamageEventId.get(
            periodic.triggerDamageEventId
          ) ?? [];
        rows.push(periodic);
        hitStopRowsByTriggerDamageEventId.set(
          periodic.triggerDamageEventId,
          rows
        );
      }
    }
    if (isWaneOperation && periodic.tickIndex !== null) {
      const callbackKey = generationBoundWaneMode
        ? periodicTickKey(periodic)
        : `${periodic.targetId}\u0000${periodic.damageEventId ?? `row-${periodic.id}`}`;
      if (waneCallbackKeys.has(callbackKey)) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "tickIndex"],
          "Electro-Charged tick can own at most one Wane callback result"
        );
      }
      waneCallbackKeys.add(callbackKey);
    }
    if (
      periodic.operation === "start" ||
      periodic.operation === "refresh"
    ) {
      if (periodic.triggerDamageEventId !== null) {
        const key = periodicAuditKey(
          periodic.triggerDamageEventId,
          periodic.operation
        );
        const rows = startOrRefreshRowsByAuditKey.get(key) ?? [];
        rows.push(periodic);
        startOrRefreshRowsByAuditKey.set(key, rows);
      }
      if (
        periodic.reactionDamageLogId !== null ||
        periodic.damageEventId !== null ||
        periodic.tickIndex !== null ||
        periodic.waneFrame !== null
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex],
          `${periodic.operation} rows cannot own tick damage or Wane fields`
        );
      }
      const trigger =
        periodic.triggerDamageEventId === null
          ? undefined
          : damageEventById.get(periodic.triggerDamageEventId);
      const audit = trigger?.reactionAudit.periodicReaction;
      if (
        trigger === undefined ||
        audit === null ||
        audit === undefined ||
        audit.operation !== periodic.operation
      ) {
        addIssue(
          context,
          [
            "periodicReactionLog",
            periodicIndex,
            "triggerDamageEventId"
          ],
          `${periodic.operation} must backlink its matching Electro-Charged audit`
        );
      } else {
        for (const [field, expected] of [
          ["generation", audit.generation],
          ["frame", trigger.frame],
          ["targetId", trigger.targetId],
          ["targetName", trigger.targetName],
          ["sourceActorId", trigger.sourceActorId],
          ["nextTickFrame", audit.nextTickFrame],
          [
            "coexistenceExpiresAtFrame",
            audit.coexistenceExpiresAtFrame
          ],
          ["cadenceStatus", audit.cadenceStatus],
          ["waneListenerActive", audit.waneListenerActive]
        ] as const) {
          expectEqual(
            context,
            ["periodicReactionLog", periodicIndex, field],
            periodic[field],
            expected,
            `periodic reaction ${field}`
          );
        }
        expectSemanticEqual(
          context,
          ["periodicReactionLog", periodicIndex, "auraBefore"],
          periodic.auraBefore,
          trigger.reactionAudit.auraBefore ?? [],
          "periodic reaction Aura before"
        );
        expectSemanticEqual(
          context,
          ["periodicReactionLog", periodicIndex, "auraConsumed"],
          periodic.auraConsumed,
          [],
          "periodic reaction start/refresh Aura consumption"
        );
        expectSemanticEqual(
          context,
          ["periodicReactionLog", periodicIndex, "auraAfter"],
          periodic.auraAfter,
          trigger.reactionAudit.auraAfter ?? [],
          "periodic reaction Aura after"
        );
        if (periodic.operation === "start") {
          periodicStreamByTargetGeneration.set(
            `${periodic.targetId}\u0000${periodic.generation}`,
            { nextTickIndex: 0 }
          );
        }
      }
    } else if (periodic.operation === "tick") {
      if (
        periodic.reactionDamageLogId === null ||
        periodic.damageEventId === null ||
        periodic.tickIndex === null
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex],
          "tick rows require reactionDamageLogId, damageEventId, and tickIndex"
        );
      } else {
        const key = periodicTickKey(periodic);
        if (periodicTickByKey.has(key)) {
          addIssue(
            context,
            ["periodicReactionLog", periodicIndex, "tickIndex"],
            "Electro-Charged target, generation, and tick index must be unique"
          );
        } else {
          periodicTickByKey.set(key, periodic);
        }
        if (
          periodicTickByDamageEventId.has(periodic.damageEventId)
        ) {
          addIssue(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "damageEventId"
            ],
            "Electro-Charged tick damage event must have one periodic owner"
          );
        } else {
          periodicTickByDamageEventId.set(
            periodic.damageEventId,
            periodic
          );
        }
        const owners =
          periodicTicksByReactionDamageId.get(
            periodic.reactionDamageLogId
          ) ?? [];
        owners.push(periodic);
        periodicTicksByReactionDamageId.set(
          periodic.reactionDamageLogId,
          owners
        );
      }
    } else if (periodic.operation === "tick-skipped") {
      if (
        periodic.reactionDamageLogId !== null ||
        periodic.damageEventId !== null ||
        periodic.tickIndex === null ||
        periodic.waneFrame !== null
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex],
          "tick-skipped rows require only tickIndex among tick ownership fields"
        );
      }
    } else if (isWaneOperation) {
      if (
        periodic.reactionDamageLogId !== null ||
        periodic.damageEventId === null ||
        periodic.tickIndex === null ||
        periodic.waneFrame !== periodic.frame
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex],
          "Wane rows must reuse a tick child without owning its reaction-damage log"
        );
      }
      const tick = generationBoundWaneMode
        ? periodicTickByKey.get(periodicTickKey(periodic))
        : periodic.damageEventId === null
          ? undefined
          : periodicTickByDamageEventId.get(
              periodic.damageEventId
            );
      if (
        tick === undefined ||
        tick.damageEventId !== periodic.damageEventId ||
        tick.tickIndex !== periodic.tickIndex ||
        tick.sourceActorId !== periodic.sourceActorId ||
        tick.triggerDamageEventId !==
          periodic.triggerDamageEventId
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "damageEventId"],
          "Wane row must backlink the preceding tick of the same target, generation, and tick index"
        );
      } else {
        expectEqual(
          context,
          ["periodicReactionLog", periodicIndex, "waneFrame"],
          tick.waneFrame,
          periodic.frame,
          "Electro-Charged tick Wane backlink"
        );
        expectEqual(
          context,
          ["periodicReactionLog", periodicIndex, "frame"],
          periodic.frame,
          tick.frame + ELECTRO_CHARGED_WANE_DELAY_FRAMES,
          "Electro-Charged Wane callback delay"
        );
        const damageEvent =
          periodic.damageEventId === null
            ? undefined
            : damageEventById.get(periodic.damageEventId);
        const rowPath = [
          "periodicReactionLog",
          periodicIndex
        ] satisfies IssuePath;
        if (!generationBoundWaneMode) {
          expectEqual(
            context,
            [...rowPath, "generation"],
            periodic.generation,
            currentPeriodicGenerationByTarget.get(
              periodic.targetId
            ),
            "historical Electro-Charged Wane active generation"
          );
        }
        if (electroChargedGlobalCadenceMode) {
          expectEqual(
            context,
            [...rowPath, "waneListenerActive"],
            tick.waneListenerActive,
            true,
            "aura-v9 Wane owning tick listener"
          );
        }
        const hasCoexistingAuraBefore =
          periodic.auraBefore.some(
            (entry) => entry.element === "hydro"
          ) &&
          periodic.auraBefore.some(
            (entry) => entry.element === "electro"
          );
        const actualDamage = damageEvent?.finalDamage ?? 0;
        const expectedOperation = !hasCoexistingAuraBefore
          ? "stop"
          : actualDamage > 0
            ? "wane"
            : "wane-skipped";
        expectEqual(
          context,
          [...rowPath, "operation"],
          periodic.operation,
          expectedOperation,
          "Electro-Charged Wane operation from pre-callback Aura and actual damage"
        );
        if (
          electroChargedGlobalCadenceMode &&
          actualDamage <= 0
        ) {
          addIssue(
            context,
            [...rowPath, "damageEventId"],
            "aura-v9 cannot publish a Wane callback for zero actual damage"
          );
        }
        if (
          periodic.operation === "wane" ||
          periodic.operation === "wane-skipped"
        ) {
          if (periodic.operation === "wane") {
            const waneTimelinePoint =
              firstWaneTimelinePointByPeriodicId.get(periodic.id);
            const targetClockEnabled =
              result.config.targetClockModel.mode ===
              "target-local-hitlag-v1";
            const currentTargetFrame = targetClockEnabled
              ? waneTimelinePoint?.targetFrame
              : null;
            if (
              targetClockEnabled &&
              currentTargetFrame === undefined
            ) {
              addIssue(
                context,
                [...rowPath, "auraAfter"],
                "Hitlag-aware Electro-Charged Wane requires its target-frame timeline owner"
              );
            }
            validateElectroChargedWaneAuraMutation(
              context,
              [...rowPath, "auraConsumed"],
              periodic.frame,
              currentTargetFrame ?? null,
              periodic.auraBefore,
              periodic.auraConsumed,
              periodic.auraAfter
            );
          } else {
            expectAuraGaugeProjection(
              context,
              [...rowPath, "auraConsumed"],
              periodic.auraConsumed,
              [],
              "zero-damage Electro-Charged Wane consumption"
            );
            expectAuraStateProjection(
              context,
              [...rowPath, "auraAfter"],
              periodic.auraAfter,
              periodic.auraBefore,
              "zero-damage Electro-Charged Wane Aura"
            );
          }
          const retainsCoexistence =
            periodic.auraAfter.some(
              (entry) => entry.element === "hydro"
            ) &&
            periodic.auraAfter.some(
              (entry) => entry.element === "electro"
            );
          const expectedReason =
            periodic.operation === "wane-skipped"
              ? "ZERO_ACTUAL_DAMAGE"
              : retainsCoexistence
                ? null
                : "AURA_DEPLETED_BY_WANE";
          const historicalActiveCadenceRow =
            generationBoundWaneMode
              ? undefined
              : historicalActiveCadenceRowByStream.get(streamKey);
          const expectedRetainedNextTickFrame =
            generationBoundWaneMode
              ? tick.nextTickFrame
              : historicalActiveCadenceRow?.nextTickFrame ?? null;
          expectEqual(
            context,
            [...rowPath, "reason"],
            periodic.reason,
            expectedReason,
            "Electro-Charged Wane reason"
          );
          expectEqual(
            context,
            [...rowPath, "nextTickFrame"],
            periodic.nextTickFrame,
            retainsCoexistence
              ? expectedRetainedNextTickFrame
              : null,
            "Electro-Charged post-Wane cadence"
          );
          expectEqual(
            context,
            [...rowPath, "coexistenceExpiresAtFrame"],
            periodic.coexistenceExpiresAtFrame,
            electroChargedCoexistenceExpiryFrame(
              periodic.auraAfter
            ),
            "Electro-Charged post-Wane coexistence expiry"
          );
          if (
            periodic.operation === "wane-skipped" &&
            !retainsCoexistence
          ) {
            addIssue(
              context,
              [...rowPath, "auraAfter"],
              "wane-skipped requires Hydro/Electro coexistence"
            );
          }
          if (electroChargedGlobalCadenceMode) {
            expectEqual(
              context,
              [...rowPath, "cadenceStatus"],
              periodic.cadenceStatus,
              retainsCoexistence ? "scheduled" : "stopped",
              "aura-v9 post-Wane cadence status"
            );
            expectEqual(
              context,
              [...rowPath, "waneListenerActive"],
              periodic.waneListenerActive,
              retainsCoexistence,
              "aura-v9 post-Wane listener state"
            );
          }
        } else if (periodic.operation === "stop") {
          expectAuraGaugeProjection(
            context,
            [...rowPath, "auraConsumed"],
            periodic.auraConsumed,
            [],
            "pre-Wane terminal consumption"
          );
          expectAuraStateProjection(
            context,
            [...rowPath, "auraAfter"],
            periodic.auraAfter,
            periodic.auraBefore,
            "pre-Wane terminal Aura"
          );
          for (const [field, expected] of [
            ["nextTickFrame", null],
            ["coexistenceExpiresAtFrame", null],
            ["reason", "COEXISTING_AURA_MISSING_BEFORE_WANE"]
          ] as const) {
            expectEqual(
              context,
              [...rowPath, field],
              periodic[field],
              expected,
              `pre-Wane terminal ${field}`
            );
          }
          if (electroChargedGlobalCadenceMode) {
            expectEqual(
              context,
              [...rowPath, "cadenceStatus"],
              periodic.cadenceStatus,
              "stopped",
              "aura-v9 pre-Wane terminal cadence"
            );
            expectEqual(
              context,
              [...rowPath, "waneListenerActive"],
              periodic.waneListenerActive,
              false,
              "aura-v9 pre-Wane terminal listener"
            );
          }
        }
        if (!electroChargedGlobalCadenceMode) {
          if (
            periodic.cadenceStatus !== undefined ||
            periodic.waneListenerActive !== undefined
          ) {
            addIssue(
              context,
              rowPath,
              "pre-aura-v9 Wane rows cannot claim global cadence state"
            );
          }
        }
      }
    } else if (
      periodic.operation === "stop" &&
      (periodic.reactionDamageLogId !== null ||
        periodic.damageEventId !== null)
    ) {
      addIssue(
        context,
        ["periodicReactionLog", periodicIndex],
        "non-Wane stop rows cannot own reaction damage"
      );
    }
    if (explicitParent !== undefined) {
      for (const [field, expected] of [
        ["reaction", periodic.reaction],
        ["sourceTargetId", periodic.targetId],
        ["triggerDamageEventId", periodic.triggerDamageEventId]
      ] as const) {
        expectEqual(
          context,
          [
            "periodicReactionLog",
            periodicIndex,
            "reactionDamageLogId"
          ],
          explicitParent[field],
          expected,
          `periodic reaction parent ${field}`
        );
      }
      expectEqual(
        context,
        [
          "reactionDamageLog",
          explicitParent.id,
          "scheduleKind"
        ],
        explicitParent.scheduleKind,
        "periodic-tick",
        "periodic reaction schedule kind"
      );
      if (periodic.operation === "tick") {
        const trigger =
          periodic.triggerDamageEventId === null
            ? undefined
            : damageEventById.get(
                periodic.triggerDamageEventId
              );
        const sourceAudit =
          trigger?.reactionAudit.periodicReaction;
        if (
          trigger === undefined ||
          sourceAudit === null ||
          sourceAudit === undefined
        ) {
          addIssue(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "triggerDamageEventId"
            ],
            "Electro-Charged tick must backlink its source stream audit"
          );
        } else {
          for (const [field, expected] of [
            ["generation", sourceAudit.generation],
            ["sourceActorId", trigger.sourceActorId]
          ] as const) {
            expectEqual(
              context,
              ["periodicReactionLog", periodicIndex, field],
              periodic[field],
              expected,
              `Electro-Charged tick source ${field}`
            );
          }
        }
        expectEqual(
          context,
          [
            "reactionDamageLog",
            explicitParent.id,
            "damageFrame"
          ],
          explicitParent.damageFrame,
          periodic.frame,
          "periodic reaction damage frame"
        );
        expectEqual(
          context,
          [
            "reactionDamageLog",
            explicitParent.id,
            "nextAvailableFrame"
          ],
          explicitParent.nextAvailableFrame,
          periodic.nextTickFrame,
          "periodic reaction next tick frame"
        );
      }
      if (periodic.sourceActorId !== null) {
        expectEqual(
          context,
          [
            "reactionDamageLog",
            explicitParent.id,
            "sourceActorId"
          ],
          explicitParent.sourceActorId,
          periodic.sourceActorId,
          "periodic reaction source actor"
        );
      }
    }
    if (periodic.damageEventId !== null) {
      const event = damageEventById.get(periodic.damageEventId);
      const parent =
        explicitParent ??
        parentByDamageEventId.get(periodic.damageEventId);
      if (
        event === undefined ||
        parent === undefined ||
        !parent.damageEventIds.includes(periodic.damageEventId)
      ) {
        addIssue(
          context,
          [
            "periodicReactionLog",
            periodicIndex,
            "damageEventId"
          ],
          "must backlink a child of the linked reaction-damage log"
        );
      } else {
        if (periodic.triggerDamageEventId !== null) {
          expectEqual(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "triggerDamageEventId"
            ],
            parent.triggerDamageEventId,
            periodic.triggerDamageEventId,
            "periodic damage trigger"
          );
        }
        if (periodic.sourceActorId !== null) {
          expectEqual(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "sourceActorId"
            ],
            parent.sourceActorId,
            periodic.sourceActorId,
            "periodic damage source actor"
          );
        }
        expectEqual(
          context,
          [
            "periodicReactionLog",
            periodicIndex,
            "damageEventId"
          ],
          event.targetId,
          periodic.targetId,
          "periodic damage target"
        );
        expectEqual(
          context,
          [
            "periodicReactionLog",
            periodicIndex,
            "reaction"
          ],
          event.transformativeReactionFactors?.reaction,
          periodic.reaction,
          "periodic damage reaction"
        );
      }
    }
    if (
      periodic.operation === "tick" ||
      periodic.operation === "tick-skipped"
    ) {
      const streamKey = `${periodic.targetId}\u0000${periodic.generation}`;
      const stream =
        periodicStreamByTargetGeneration.get(streamKey);
      if (stream === undefined) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "generation"],
          "Electro-Charged tick must belong to a preceding start row of the same target and generation"
        );
      } else {
        expectEqual(
          context,
          ["periodicReactionLog", periodicIndex, "tickIndex"],
          periodic.tickIndex,
          stream.nextTickIndex,
          "Electro-Charged tick index"
        );
        stream.nextTickIndex += 1;
      }
    }
    if (
      electroChargedGlobalCadenceMode &&
      periodic.operation === "tick" &&
      periodic.damageEventId !== null
    ) {
      const child = damageEventById.get(periodic.damageEventId);
      const expectedWaneFrame =
        periodic.waneListenerActive === true &&
        (child?.finalDamage ?? 0) > 0
          ? periodic.frame + ELECTRO_CHARGED_WANE_DELAY_FRAMES
          : null;
      expectEqual(
        context,
        ["periodicReactionLog", periodicIndex, "waneFrame"],
        periodic.waneFrame,
        expectedWaneFrame,
        "aura-v9 tick Wane scheduling"
      );
    }
    if (
      (periodic.operation === "start" ||
        periodic.operation === "refresh" ||
        periodic.operation === "tick") &&
      periodic.nextTickFrame !== null
    ) {
      historicalActiveCadenceRowByStream.set(streamKey, periodic);
    }
  }

  for (const [eventIndex, event] of result.damageEvents.entries()) {
    const audit = event.reactionAudit.periodicReaction;
    if (
      audit?.operation !== "start" &&
      audit?.operation !== "refresh"
    ) {
      continue;
    }
    const rows =
      startOrRefreshRowsByAuditKey.get(
        periodicAuditKey(event.id, audit.operation)
      ) ?? [];
    if (rows.length !== 1) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "periodicReaction"
        ],
        `Electro-Charged ${audit.operation} audit must own exactly one lifecycle row`
      );
    }
  }

  for (const [eventIndex, event] of result.damageEvents.entries()) {
    const audit = event.reactionAudit.periodicReaction;
    if (audit?.operation !== "stop") continue;
    const rows =
      hitStopRowsByTriggerDamageEventId.get(event.id) ?? [];
    const auditPath = [
      "damageEvents",
      eventIndex,
      "reactionAudit",
      "periodicReaction"
    ] satisfies IssuePath;
    if (event.reactionAudit.mechanicsTruncation !== null) {
      if (rows.length !== 0) {
        addIssue(
          context,
          auditPath,
          "target mechanics truncation cannot also publish an Electro-Charged hit-removal terminal row"
        );
      }
      continue;
    }
    if (rows.length !== 1) {
      addIssue(
        context,
        auditPath,
        "Electro-Charged stop audit must own exactly one hit-removal terminal row"
      );
      continue;
    }
    const row = rows[0]!;
    const rowPath = [
      "periodicReactionLog",
      row.id
    ] satisfies IssuePath;
    for (const [field, expected] of [
      ["generation", audit.generation],
      ["frame", event.frame],
      ["targetId", event.targetId],
      ["targetName", event.targetName],
      ["sourceActorId", event.sourceActorId],
      ["triggerDamageEventId", event.id],
      ["reactionDamageLogId", null],
      ["damageEventId", null],
      ["tickIndex", null],
      ["nextTickFrame", null],
      ["coexistenceExpiresAtFrame", null],
      ["waneFrame", null],
      ["reason", "COEXISTING_AURA_REMOVED_BY_HIT"],
      ["cadenceStatus", audit.cadenceStatus],
      ["waneListenerActive", audit.waneListenerActive]
    ] as const) {
      expectEqual(
        context,
        [...rowPath, field],
        row[field],
        expected,
        `Electro-Charged hit stop ${field}`
      );
    }
    expectAuraStateProjection(
      context,
      [...rowPath, "auraBefore"],
      row.auraBefore,
      event.reactionAudit.auraBefore ?? [],
      "Electro-Charged hit stop Aura before"
    );
    expectAuraGaugeProjection(
      context,
      [...rowPath, "auraConsumed"],
      row.auraConsumed,
      event.reactionAudit.auraConsumed ?? [],
      "Electro-Charged hit stop Aura consumption"
    );
    expectAuraStateProjection(
      context,
      [...rowPath, "auraAfter"],
      row.auraAfter,
      event.reactionAudit.auraAfter ?? [],
      "Electro-Charged hit stop Aura after"
    );
  }

  const ordinaryStopReasons = new Set([
    "AURA_DECAY_EXPIRED",
    "COEXISTING_AURA_MISSING",
    "COEXISTING_AURA_REMOVED_BY_HIT",
    "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM"
  ]);
  const isWaneCallback = (
    periodic: SimulationResult["periodicReactionLog"][number]
  ): boolean =>
    periodic.operation === "wane" ||
    periodic.operation === "wane-skipped" ||
    (periodic.operation === "stop" &&
      periodic.waneFrame !== null);
  const appendFrame = (
    index: Map<string, number[]>,
    key: string,
    frame: number
  ): void => {
    const frames = index.get(key) ?? [];
    frames.push(frame);
    index.set(key, frames);
  };
  const lowerBound = (values: readonly number[], value: number): number => {
    let lower = 0;
    let upper = values.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (values[middle]! < value) {
        lower = middle + 1;
      } else {
        upper = middle;
      }
    }
    return lower;
  };
  const upperBound = (values: readonly number[], value: number): number => {
    let lower = 0;
    let upper = values.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (values[middle]! <= value) {
        lower = middle + 1;
      } else {
        upper = middle;
      }
    }
    return lower;
  };
  const countFramesInRange = (
    frames: readonly number[] | undefined,
    startFrame: number,
    endFrame: number
  ): number =>
    frames === undefined
      ? 0
      : upperBound(frames, endFrame) -
        lowerBound(frames, startFrame);
  const waneCallbackDeliveryKey = (
    targetId: string,
    damageEventId: number | null,
    frame: number
  ): string => `${targetId}\u0000${damageEventId}\u0000${frame}`;
  const waneCallbackCountByDeliveryKey = new Map<string, number>();
  const startFramesByTarget = new Map<string, number[]>();
  const startFramesByStream = new Map<string, number[]>();
  const terminalStopFramesByStream = new Map<string, number[]>();
  for (const periodic of result.periodicReactionLog) {
    const streamKey = periodicStreamKey(periodic);
    if (isWaneCallback(periodic)) {
      const callbackKey = waneCallbackDeliveryKey(
        periodic.targetId,
        periodic.damageEventId,
        periodic.frame
      );
      waneCallbackCountByDeliveryKey.set(
        callbackKey,
        (waneCallbackCountByDeliveryKey.get(callbackKey) ?? 0) + 1
      );
    }
    if (periodic.operation === "start") {
      appendFrame(
        startFramesByTarget,
        periodic.targetId,
        periodic.frame
      );
      appendFrame(startFramesByStream, streamKey, periodic.frame);
    }
    if (
      periodic.operation === "stop" &&
      periodic.waneFrame === null &&
      periodic.reason !== null &&
      ordinaryStopReasons.has(periodic.reason)
    ) {
      appendFrame(
        terminalStopFramesByStream,
        streamKey,
        periodic.frame
      );
    }
  }
  const truncationFramesByTarget = new Map<string, number[]>();
  for (const truncation of result.targetMechanicsTruncationLog) {
    appendFrame(
      truncationFramesByTarget,
      truncation.targetId,
      truncation.frame
    );
  }
  for (const index of [
    startFramesByTarget,
    startFramesByStream,
    terminalStopFramesByStream,
    truncationFramesByTarget
  ]) {
    for (const frames of index.values()) {
      frames.sort((left, right) => left - right);
    }
  }
  const illegalSuccessorAfterStopByIndex = new Map<
    number,
    SimulationResult["periodicReactionLog"][number]
  >();
  const nextIllegalSuccessorByStream = new Map<
    string,
    SimulationResult["periodicReactionLog"][number]
  >();
  for (
    let periodicIndex = result.periodicReactionLog.length - 1;
    periodicIndex >= 0;
    periodicIndex -= 1
  ) {
    const periodic = result.periodicReactionLog[periodicIndex]!;
    const streamKey = periodicStreamKey(periodic);
    if (
      periodic.operation === "stop" &&
      periodic.waneFrame === null
    ) {
      const illegalSuccessor =
        nextIllegalSuccessorByStream.get(streamKey);
      if (illegalSuccessor !== undefined) {
        illegalSuccessorAfterStopByIndex.set(
          periodicIndex,
          illegalSuccessor
        );
      }
    }
    const queuedFirstTick =
      periodic.operation === "tick" &&
      periodic.tickIndex === 0 &&
      periodic.reason !== null &&
      periodic.reason.startsWith("QUEUED_FIRST_TICK_");
    if (
      !queuedFirstTick &&
      !isWaneCallback(periodic) &&
      (periodic.operation === "refresh" ||
        periodic.operation === "tick" ||
        periodic.operation === "tick-skipped")
    ) {
      nextIllegalSuccessorByStream.set(streamKey, periodic);
    }
  }
  const waneTimelinePointCountByPeriodicId = new Map<number, number>();
  for (const [pointIndex, point] of
    result.targetStateTimeline.points.entries()) {
    if (point.cause !== "electro-charged-wane") continue;
    const periodicLinks = point.links.filter(
      (link) => link.kind === "periodic-reaction-log"
    );
    const periodic =
      periodicLinks.length === 1
        ? result.periodicReactionLog[periodicLinks[0]!.id]
        : undefined;
    if (
      periodicLinks.length !== 1 ||
      periodic === undefined ||
      !isWaneCallback(periodic) ||
      periodic.frame !== point.frame ||
      periodic.targetId !== point.targetId ||
      periodic.targetName !== point.targetName ||
      point.pointKind !==
        (periodic.operation === "wane"
          ? "mutation"
          : "observation") ||
      periodic.damageEventId !== point.primaryDamageEventId ||
      point.eventType !== "periodicReactionWane" ||
      point.eventPriority !== 6 ||
      !semanticEqual(point.auraBefore, periodic.auraBefore) ||
      !semanticEqual(point.auraConsumed, periodic.auraConsumed) ||
      !semanticEqual(point.auraAfter, periodic.auraAfter)
    ) {
      addIssue(
        context,
        ["targetStateTimeline", "points", pointIndex, "links"],
        "Electro-Charged Wane timeline point must own one exact Wane callback row"
      );
      continue;
    }
    waneTimelinePointCountByPeriodicId.set(
      periodic.id,
      (waneTimelinePointCountByPeriodicId.get(periodic.id) ?? 0) + 1
    );
  }

  const simulationEndFrame = Math.round(
    result.config.duration * 60
  );
  for (const [periodicIndex, periodic] of
    result.periodicReactionLog.entries()) {
    const streamKey = periodicStreamKey(periodic);
    if (isWaneCallback(periodic)) {
      if (
        waneTimelinePointCountByPeriodicId.get(periodic.id) !== 1
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "id"],
          "Electro-Charged Wane callback requires one reciprocal timeline point"
        );
      }
      continue;
    }
    if (
      periodic.operation === "stop" &&
      periodic.waneFrame === null
    ) {
      if (
        periodic.reason === null ||
        !ordinaryStopReasons.has(periodic.reason)
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "reason"],
          "ordinary Electro-Charged stop requires a modeled terminal reason"
        );
      }
      const terminalTrigger =
        periodic.triggerDamageEventId === null
          ? undefined
          : damageEventById.get(periodic.triggerDamageEventId);
      if (
        periodic.reason !== "COEXISTING_AURA_REMOVED_BY_HIT" &&
        terminalTrigger !== undefined &&
        terminalTrigger.frame >= periodic.frame
      ) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "reason"],
          "non-hit Electro-Charged terminal rows must backlink an earlier stream source"
        );
      }
      if (
        periodic.reason === "COEXISTING_AURA_REMOVED_BY_HIT"
      ) {
        if (
          terminalTrigger?.reactionAudit.periodicReaction
            ?.operation !==
          "stop"
        ) {
          addIssue(
            context,
            [
              "periodicReactionLog",
              periodicIndex,
              "triggerDamageEventId"
            ],
            "hit-removal Electro-Charged stop must backlink its stop audit"
          );
        }
      }
      const illegalSuccessor =
        illegalSuccessorAfterStopByIndex.get(periodicIndex);
      if (illegalSuccessor !== undefined) {
        addIssue(
          context,
          ["periodicReactionLog", periodicIndex, "operation"],
          `ordinary Electro-Charged stop cannot be followed by ${illegalSuccessor.operation} row ${illegalSuccessor.id} in the same generation`
        );
      }
      continue;
    }
    if (
      periodic.operation !== "tick" ||
      periodic.damageEventId === null ||
      periodic.waneFrame === null ||
      periodic.waneFrame > simulationEndFrame
    ) {
      continue;
    }
    const truncatedBeforeCallback =
      countFramesInRange(
        truncationFramesByTarget.get(periodic.targetId),
        periodic.frame,
        periodic.waneFrame
      ) > 0;
    const streamCancelledBeforeCallback =
      generationBoundWaneMode &&
      (countFramesInRange(
        startFramesByTarget.get(periodic.targetId),
        periodic.frame,
        periodic.waneFrame
      ) -
        countFramesInRange(
          startFramesByStream.get(streamKey),
          periodic.frame,
          periodic.waneFrame
        ) >
        0 ||
        countFramesInRange(
          terminalStopFramesByStream.get(streamKey),
          periodic.frame,
          periodic.waneFrame
        ) > 0);
    if (
      truncatedBeforeCallback ||
      streamCancelledBeforeCallback
    ) {
      continue;
    }
    const callbackCount =
      waneCallbackCountByDeliveryKey.get(
        waneCallbackDeliveryKey(
          periodic.targetId,
          periodic.damageEventId,
          periodic.waneFrame
        )
      ) ?? 0;
    if (callbackCount !== 1) {
      addIssue(
        context,
        ["periodicReactionLog", periodicIndex, "waneFrame"],
        "in-range Electro-Charged tick requires exactly one uncancelled Wane callback"
      );
    }
  }
  for (const [parentIndex, parent] of
    result.reactionDamageLog.entries()) {
    if (
      parent.scheduleKind !== "periodic-tick" ||
      parent.reaction !== "electroCharged"
    ) {
      continue;
    }
    const owners =
      periodicTicksByReactionDamageId.get(parent.id) ?? [];
    if (owners.length !== 1) {
      addIssue(
        context,
        ["reactionDamageLog", parentIndex],
        "Electro-Charged periodic-tick damage must have exactly one tick owner"
      );
    }
  }
  validateElectroChargedV9LifecycleReplay(result, context);
}

const SWIRL_DAMAGE_ELEMENT = {
  swirlPyro: "pyro",
  swirlHydro: "hydro",
  swirlCryo: "cryo",
  swirlElectro: "electro"
} as const;

type SwirlReactionName = keyof typeof SWIRL_DAMAGE_ELEMENT;

function isSwirlReactionName(
  reaction: string
): reaction is SwirlReactionName {
  return Object.prototype.hasOwnProperty.call(
    SWIRL_DAMAGE_ELEMENT,
    reaction
  );
}

function cleanAuraGaugeUnits(value: number): number {
  if (Math.abs(value) <= AURA_GAUGE_EPSILON) return 0;
  return Number(value.toFixed(12));
}

function validateSwirlBacklinks(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const damageEventById = new Map(
    result.damageEvents.map((event) => [event.id, event])
  );
  const logIndexesByKey = new Map<string, number[]>();
  const claimedLogIndexes = new Set<number>();
  const deliveryKey = (
    triggerDamageEventId: number,
    reaction: SwirlReactionName,
    scheduleKind: "swirl-self" | "swirl-propagation"
  ): string =>
    `${triggerDamageEventId}\u0000${reaction}\u0000${scheduleKind}`;

  for (const [logIndex, log] of
    result.reactionDamageLog.entries()) {
    if (
      log.triggerDamageEventId === null ||
      !isSwirlReactionName(log.reaction) ||
      (log.scheduleKind !== "swirl-self" &&
        log.scheduleKind !== "swirl-propagation")
    ) {
      continue;
    }
    const key = deliveryKey(
      log.triggerDamageEventId,
      log.reaction,
      log.scheduleKind
    );
    const indexes = logIndexesByKey.get(key) ?? [];
    indexes.push(logIndex);
    logIndexesByKey.set(key, indexes);
  }

  const damageGroupAttempts: Array<{
    child: DamageEvent;
    logIndex: number;
    decisionIndex: number;
    decision: SimulationResult["reactionDamageLog"][number]["damageGroupDecisions"][number];
  }> = [];

  for (const [eventIndex, event] of
    result.damageEvents.entries()) {
    const seenReactions = new Set<SwirlReactionName>();
    for (const [auditIndex, audit] of
      event.reactionAudit.swirlReactions.entries()) {
      const auditPath = [
        "damageEvents",
        eventIndex,
        "reactionAudit",
        "swirlReactions",
        auditIndex
      ] satisfies IssuePath;
      if (seenReactions.has(audit.reaction)) {
        addIssue(
          context,
          [...auditPath, "reaction"],
          "one damage event cannot repeat a Swirl reaction audit"
        );
      }
      seenReactions.add(audit.reaction);
      const expectedAuraConsumedGaugeUnits = Math.min(
        audit.auraGaugeUnitsBefore,
        audit.sourceGaugeUnitsBefore * 0.5
      );
      const expectedSourceGaugeUnitsSpent =
        expectedAuraConsumedGaugeUnits / 0.5;
      expectNearlyEqual(
        context,
        [...auditPath, "auraConsumedGaugeUnits"],
        audit.auraConsumedGaugeUnits,
        cleanAuraGaugeUnits(expectedAuraConsumedGaugeUnits),
        "Swirl consumed Aura gauge"
      );
      expectNearlyEqual(
        context,
        [...auditPath, "sourceGaugeUnitsSpent"],
        audit.sourceGaugeUnitsSpent,
        cleanAuraGaugeUnits(expectedSourceGaugeUnitsSpent),
        "Swirl spent source gauge"
      );
      expectNearlyEqual(
        context,
        [...auditPath, "sourceGaugeUnitsAfter"],
        audit.sourceGaugeUnitsAfter,
        cleanAuraGaugeUnits(
          Math.max(
            0,
            audit.sourceGaugeUnitsBefore -
              expectedSourceGaugeUnitsSpent
          )
        ),
        "Swirl remaining source gauge"
      );
      expectNearlyEqual(
        context,
        [...auditPath, "auraGaugeUnitsAfter"],
        audit.auraGaugeUnitsAfter,
        cleanAuraGaugeUnits(
          Math.max(
            0,
            audit.auraGaugeUnitsBefore -
              expectedAuraConsumedGaugeUnits
          )
        ),
        "Swirl remaining Aura gauge"
      );
      const expectedPropagatedGaugeUnits =
        audit.sourceGaugeUnitsSpent + AURA_GAUGE_EPSILON <
        audit.sourceGaugeUnitsBefore
          ? 0.625 * audit.sourceGaugeUnitsSpent + 0.95
          : 1.25 * audit.sourceGaugeUnitsBefore + 0.95;
      expectNearlyEqual(
        context,
        [...auditPath, "propagatedGaugeUnits"],
        audit.propagatedGaugeUnits,
        cleanAuraGaugeUnits(expectedPropagatedGaugeUnits),
        "Swirl propagated gauge formula"
      );
      expectEqual(
        context,
        [...auditPath, "swirledElement"],
        audit.swirledElement,
        SWIRL_DAMAGE_ELEMENT[audit.reaction],
        "Swirl audit element"
      );
      expectEqual(
        context,
        [...auditPath, "selfDamageFrame"],
        audit.selfDamageFrame,
        event.frame + 1,
        "Swirl self damage frame"
      );
      expectEqual(
        context,
        [...auditPath, "propagationDamageFrame"],
        audit.propagationDamageFrame,
        event.frame + 5,
        "Swirl propagation damage frame"
      );
      expectEqual(
        context,
        [...auditPath, "scheduled"],
        audit.scheduled,
        audit.blockedReason === null,
        "Swirl scheduling decision"
      );
      if (audit.scheduled) {
        expectEqual(
          context,
          [...auditPath, "nextAvailableFrame"],
          audit.nextAvailableFrame,
          event.frame + 6,
          "scheduled Swirl queue ready frame"
        );
      } else if (audit.nextAvailableFrame <= event.frame) {
        addIssue(
          context,
          [...auditPath, "nextAvailableFrame"],
          "queue-GCD-blocked Swirl requires a future ready frame"
        );
      }

      for (const [scheduleKind, damageFrame] of [
        ["swirl-self", audit.selfDamageFrame],
        ["swirl-propagation", audit.propagationDamageFrame]
      ] as const) {
        const logIndexes =
          logIndexesByKey.get(
            deliveryKey(
              event.id,
              audit.reaction,
              scheduleKind
            )
          ) ?? [];
        if (logIndexes.length !== 1) {
          addIssue(
            context,
            auditPath,
            `Swirl audit must own exactly one ${scheduleKind} reaction-damage log`
          );
          continue;
        }
        const logIndex = logIndexes[0]!;
        const log = result.reactionDamageLog[logIndex]!;
        claimedLogIndexes.add(logIndex);
        for (const [field, expected] of [
          ["scheduled", audit.scheduled],
          ["damageFrame", damageFrame],
          ["blockedReason", audit.blockedReason],
          ["nextAvailableFrame", audit.nextAvailableFrame]
        ] as const) {
          expectEqual(
            context,
            ["reactionDamageLog", logIndex, field],
            log[field],
            expected,
            `${scheduleKind} log ${field}`
          );
        }
        expectEqual(
          context,
          ["reactionDamageLog", logIndex, "withinSimulation"],
          log.withinSimulation,
          audit.scheduled &&
            damageFrame <= Math.round(result.config.duration * 60),
          `${scheduleKind} log simulation boundary`
        );
        if (scheduleKind === "swirl-self") {
          expectEqual(
            context,
            [
              "reactionDamageLog",
              logIndex,
              "applicationGaugeUnits"
            ],
            log.applicationGaugeUnits,
            null,
            "Swirl self application gauge"
          );
        } else if (log.applicationGaugeUnits === null) {
          addIssue(
            context,
            [
              "reactionDamageLog",
              logIndex,
              "applicationGaugeUnits"
            ],
            "Swirl propagation must carry its source audit gauge"
          );
        } else {
          expectNearlyEqual(
            context,
            [
              "reactionDamageLog",
              logIndex,
              "applicationGaugeUnits"
            ],
            log.applicationGaugeUnits,
            audit.propagatedGaugeUnits,
            "Swirl propagated gauge"
          );
        }

        if (
          log.damageGroupDecisions.length !==
          log.damageEventIds.length
        ) {
          addIssue(
            context,
            [
              "reactionDamageLog",
              logIndex,
              "damageGroupDecisions"
            ],
            "settled Swirl children require one ordered ReactionA decision each"
          );
        }
        const expectedBlockedTargetIds: string[] = [];
        for (const [decisionIndex, damageEventId] of
          log.damageEventIds.entries()) {
          const child = damageEventById.get(damageEventId);
          const decision =
            log.damageGroupDecisions[decisionIndex];
          if (child === undefined || decision === undefined) {
            continue;
          }
          if (scheduleKind === "swirl-propagation") {
            const applicationGaugeUnits =
              child.reactionAudit.applicationGaugeUnits;
            if (
              child.reactionAudit.model === "aura-engine" &&
              applicationGaugeUnits === null
            ) {
              addIssue(
                context,
                [
                  "damageEvents",
                  damageEventId,
                  "reactionAudit",
                  "applicationGaugeUnits"
                ],
                "Aura-resolved Swirl propagation must retain its application gauge"
              );
            }
            if (applicationGaugeUnits !== null) {
              expectNearlyEqual(
                context,
                [
                  "damageEvents",
                  damageEventId,
                  "reactionAudit",
                  "applicationGaugeUnits"
                ],
                applicationGaugeUnits,
                audit.propagatedGaugeUnits,
                "Swirl child application gauge"
              );
              const auraApplied =
                child.reactionAudit.auraApplied;
              if (
                auraApplied === null ||
                auraApplied.length !== 1
              ) {
                addIssue(
                  context,
                  [
                    "damageEvents",
                    damageEventId,
                    "reactionAudit",
                    "auraApplied"
                  ],
                  "Swirl propagation application must expose exactly one applied Aura entry"
                );
              } else {
                expectEqual(
                  context,
                  [
                    "damageEvents",
                    damageEventId,
                    "reactionAudit",
                    "auraApplied",
                    0,
                    "element"
                  ],
                  auraApplied[0]!.element,
                  audit.swirledElement,
                  "Swirl child applied Aura element"
                );
                expectNearlyEqual(
                  context,
                  [
                    "damageEvents",
                    damageEventId,
                    "reactionAudit",
                    "auraApplied",
                    0,
                    "gaugeUnits"
                  ],
                  auraApplied[0]!.gaugeUnits,
                  audit.propagatedGaugeUnits,
                  "Swirl child applied Aura gauge"
                );
              }
            }
          }
          const childAudit =
            child.reactionAudit.swirlDamageGroup;
          const decisionPath = [
            "reactionDamageLog",
            logIndex,
            "damageGroupDecisions",
            decisionIndex
          ] satisfies IssuePath;
          for (const [field, expected] of [
            ["reaction", log.reaction],
            ["sourceActorId", child.sourceActorId],
            ["targetId", child.targetId]
          ] as const) {
            expectEqual(
              context,
              [...decisionPath, field],
              decision[field],
              expected,
              `Swirl ReactionA ${field}`
            );
          }
          if (childAudit === null) {
            addIssue(
              context,
              [
                "damageEvents",
                damageEventId,
                "reactionAudit",
                "swirlDamageGroup"
              ],
              "Swirl damage child must project its ReactionA decision"
            );
          } else {
            for (const [field, expected] of [
              ["reaction", decision.reaction],
              [
                "windowStartFrame",
                decision.windowStartFrame
              ],
              ["hitIndex", decision.hitIndex],
              ["resetFrames", decision.resetFrames],
              ["damageAllowed", decision.damageAllowed],
              ["blockedReason", decision.blockedReason]
            ] as const) {
              expectEqual(
                context,
                [
                  "damageEvents",
                  damageEventId,
                  "reactionAudit",
                  "swirlDamageGroup",
                  field
                ],
                childAudit[field],
                expected,
                `Swirl child damage-group ${field}`
              );
            }
            expectSemanticEqual(
              context,
              [
                "damageEvents",
                damageEventId,
                "reactionAudit",
                "swirlDamageGroup",
                "sequence"
              ],
              childAudit.sequence,
              decision.sequence,
              "Swirl child damage-group sequence"
            );
          }
          if (!decision.damageAllowed) {
            expectedBlockedTargetIds.push(decision.targetId);
          }
          damageGroupAttempts.push({
            child,
            logIndex,
            decisionIndex,
            decision
          });
        }
        expectSemanticEqual(
          context,
          [
            "reactionDamageLog",
            logIndex,
            "damageGroupBlockedTargetIds"
          ],
          log.damageGroupBlockedTargetIds,
          expectedBlockedTargetIds,
          "Swirl blocked-target projection"
        );
      }
    }
  }

  for (const [logIndex, log] of
    result.reactionDamageLog.entries()) {
    if (
      (log.scheduleKind === "swirl-self" ||
        log.scheduleKind === "swirl-propagation") &&
      !claimedLogIndexes.has(logIndex)
    ) {
      addIssue(
        context,
        ["reactionDamageLog", logIndex, "triggerDamageEventId"],
        "Swirl reaction-damage log must belong to exactly one source audit"
      );
    }
  }

  damageGroupAttempts.sort(
    (left, right) =>
      left.child.frame - right.child.frame ||
      left.child.eventPriority - right.child.eventPriority ||
      left.child.eventSequence - right.child.eventSequence ||
      left.child.id - right.child.id
  );
  const windowByScope = new Map<
    string,
    { startFrame: number; attempts: number }
  >();
  for (const attempt of damageGroupAttempts) {
    const scope = `${attempt.child.targetId}\u0000${attempt.child.sourceActorId}\u0000${attempt.child.reaction}`;
    const previous = windowByScope.get(scope);
    const startsNewWindow =
      previous === undefined ||
      attempt.child.frame - previous.startFrame >= 30;
    const expectedStartFrame = startsNewWindow
      ? attempt.child.frame
      : previous.startFrame;
    const expectedHitIndex = startsNewWindow
      ? 0
      : previous.attempts;
    const expectedDamageAllowed = expectedHitIndex < 2;
    const decisionPath = [
      "reactionDamageLog",
      attempt.logIndex,
      "damageGroupDecisions",
      attempt.decisionIndex
    ] satisfies IssuePath;
    for (const [field, expected] of [
      ["windowStartFrame", expectedStartFrame],
      ["hitIndex", expectedHitIndex],
      ["resetFrames", 30],
      ["damageAllowed", expectedDamageAllowed],
      [
        "blockedReason",
        expectedDamageAllowed
          ? null
          : "REACTION_A_DAMAGE_ICD"
      ]
    ] as const) {
      expectEqual(
        context,
        [...decisionPath, field],
        attempt.decision[field],
        expected,
        `Swirl ReactionA replay ${field}`
      );
    }
    expectSemanticEqual(
      context,
      [...decisionPath, "sequence"],
      attempt.decision.sequence,
      [true, true, false],
      "Swirl ReactionA replay sequence"
    );
    windowByScope.set(scope, {
      startFrame: expectedStartFrame,
      attempts: expectedHitIndex + 1
    });
  }
}

function validateParticleBacklinks(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const actorIds = new Set(
    result.config.characters.map((character) => character.id)
  );
  const particlesByTrigger = new Map<number, number[]>();
  for (const [particleIndex, particle] of
    result.particleEvents.entries()) {
    if (
      !actorIds.has(particle.sourceActorId) ||
      particle.receiveFrame < particle.spawnFrame
    ) {
      addIssue(
        context,
        ["particleEvents", particleIndex],
        "particle source must exist and receiveFrame cannot precede spawnFrame"
      );
    }
    if (
      (particle.triggerLogId === null) !==
      (particle.triggerHitId === null)
    ) {
      addIssue(
        context,
        ["particleEvents", particleIndex, "triggerLogId"],
        "triggerLogId and triggerHitId must be jointly null or present"
      );
    }
    if (particle.triggerLogId === null) continue;
    const trigger = result.particleTriggerLog[
      particle.triggerLogId
    ];
    if (
      trigger === undefined ||
      trigger.id !== particle.triggerLogId ||
      !trigger.triggered
    ) {
      addIssue(
        context,
        ["particleEvents", particleIndex, "triggerLogId"],
        "must backlink a triggered particle hit-confirm row"
      );
      continue;
    }
    const children =
      particlesByTrigger.get(trigger.id) ?? [];
    children.push(particle.id);
    particlesByTrigger.set(trigger.id, children);
    for (const [field, expected] of [
      ["sourceActorId", trigger.sourceActorId],
      ["sourceActionId", trigger.sourceActionId],
      ["source", trigger.source],
      ["particleId", trigger.particleId],
      ["cycle", trigger.cycle],
      ["spawnFrame", trigger.frame],
      ["triggerHitId", trigger.hitId]
    ] as const) {
      expectEqual(
        context,
        ["particleEvents", particleIndex, field],
        particle[field],
        expected,
        `particle trigger ${field}`
      );
    }
  }
  for (const [triggerIndex, trigger] of
    result.particleTriggerLog.entries()) {
    if (!actorIds.has(trigger.sourceActorId)) {
      addIssue(
        context,
        [
          "particleTriggerLog",
          triggerIndex,
          "sourceActorId"
        ],
        `references missing actor ${trigger.sourceActorId}`
      );
    }
    if (trigger.triggered !== (trigger.blockedReason === null)) {
      addIssue(
        context,
        ["particleTriggerLog", triggerIndex, "triggered"],
        "triggered must be the inverse of blockedReason"
      );
    }
    const childCount =
      particlesByTrigger.get(trigger.id)?.length ?? 0;
    const expectedChildCount = trigger.triggered ? 1 : 0;
    if (childCount !== expectedChildCount) {
      addIssue(
        context,
        ["particleTriggerLog", triggerIndex],
        `must own exactly ${expectedChildCount} particle event(s)`
      );
    }
  }
}

function validateFrozenStateProjection(
  result: SimulationResult,
  context: RefinementCtx
): void {
  type AuraSnapshot =
    SimulationResult["frozenStateLog"][number]["auraBefore"];
  type FrozenStateRow =
    SimulationResult["frozenStateLog"][number];

  const targetById = new Map(
    result.enemyTargets.map((target) => [target.id, target])
  );
  const actorIds = new Set(
    result.config.characters.map((character) => character.id)
  );
  const frozenEntries = (aura: AuraSnapshot) =>
    aura.filter((entry) => entry.element === "frozen");
  const frozenGauge = (aura: AuraSnapshot): number =>
    frozenEntries(aura).reduce(
      (total, entry) => total + entry.gaugeUnits,
      0
    );
  const expectSingleFrozenEntry = (
    aura: AuraSnapshot,
    path: IssuePath,
    label: string
  ): AuraSnapshot[number] | undefined => {
    const entries = frozenEntries(aura);
    if (entries.length > 1) {
      addIssue(
        context,
        path,
        `${label} must contain at most one Frozen Aura entry`
      );
    }
    return entries[0];
  };
  const remainingFrozenFrames = (
    gaugeUnits: number,
    decayRatePerFrame: number,
    freezeResistance: number
  ): number | null => {
    if (
      gaugeUnits <= AURA_GAUGE_EPSILON ||
      freezeResistance >= 1 ||
      decayRatePerFrame < FROZEN_BASE_DECAY_PER_FRAME
    ) {
      return null;
    }
    let remaining = gaugeUnits;
    let decayRate = decayRatePerFrame;
    let frames = 0;
    while (
      remaining > AURA_GAUGE_EPSILON &&
      frames <= 36_000
    ) {
      decayRate += FROZEN_DECAY_ACCELERATION_PER_FRAME;
      remaining -= decayRate / (1 - freezeResistance);
      frames += 1;
    }
    return remaining <= AURA_GAUGE_EPSILON ? frames : null;
  };
  const frozenGaugeAfterTicks = (
    gaugeUnits: number,
    decayRatePerFrame: number,
    freezeResistance: number,
    frames: number
  ): number =>
    gaugeUnits -
    (frames * decayRatePerFrame +
      (FROZEN_DECAY_ACCELERATION_PER_FRAME *
        frames *
        (frames + 1)) /
        2) /
      (1 - freezeResistance);
  const validateActiveFrozenExpiry = ({
    eventIndex,
    row,
    frozenGaugeAfter,
    decayRatePerFrame,
    freezeResistance,
    expiresAtFrame
  }: {
    eventIndex: number;
    row: FrozenStateRow;
    frozenGaugeAfter: number;
    decayRatePerFrame: number;
    freezeResistance: number;
    expiresAtFrame: number | null;
  }): void => {
    const auditPath = [
      "damageEvents",
      eventIndex,
      "reactionAudit",
      "frozenReaction"
    ] satisfies IssuePath;
    const frozenAfter = expectSingleFrozenEntry(
      row.auraAfter,
      ["frozenStateLog", row.id, "auraAfter"],
      "Frozen state Aura after"
    );
    if (frozenGaugeAfter <= AURA_GAUGE_EPSILON) {
      if (frozenAfter !== undefined || expiresAtFrame !== null) {
        addIssue(
          context,
          [...auditPath, "expiresAtFrame"],
          "depleted Frozen state cannot retain Aura or an expiry"
        );
      }
      return;
    }
    if (
      freezeResistance >= 1 ||
      decayRatePerFrame < FROZEN_BASE_DECAY_PER_FRAME
    ) {
      addIssue(
        context,
        [...auditPath, "decayRatePerFrame"],
        "active Frozen requires non-immune resistance and the modeled base-or-faster decay rate"
      );
      return;
    }
    const remainingFrames = remainingFrozenFrames(
      frozenGaugeAfter,
      decayRatePerFrame,
      freezeResistance
    );
    if (
      frozenAfter === undefined ||
      expiresAtFrame === null ||
      remainingFrames === null
    ) {
      addIssue(
        context,
        [...auditPath, "expiresAtFrame"],
        "active Frozen requires one finite projected expiry"
      );
      return;
    }
    expectEqual(
      context,
      ["frozenStateLog", row.id, "auraAfter", "expiresAtFrame"],
      frozenAfter.expiresAtFrame,
      expiresAtFrame,
      "Frozen Aura global expiry"
    );
    if (row.targetFrame === undefined) {
      expectEqual(
        context,
        [...auditPath, "expiresAtFrame"],
        expiresAtFrame,
        row.frame + remainingFrames,
        "Frozen global expiry"
      );
      return;
    }
    const expectedTargetExpiry =
      row.targetFrame + remainingFrames;
    expectEqual(
      context,
      ["frozenStateLog", row.id, "expiresAtTargetFrame"],
      row.expiresAtTargetFrame,
      expectedTargetExpiry,
      "Frozen target-local expiry"
    );
    if (
      result.targetClockAudit.mode ===
      "target-local-hitlag-v1"
    ) {
      expectEqual(
        context,
        [
          "frozenStateLog",
          row.id,
          "auraAfter",
          "expiresAtTargetFrame"
        ],
        frozenAfter.expiresAtTargetFrame,
        expectedTargetExpiry,
        "Frozen Aura target-local expiry"
      );
    }
  };

  const damageEventById = new Map(
    result.damageEvents.map((event) => [event.id, event])
  );
  const beforeReactableDeliveryDamageIds = new Set<number>();
  const lastBeforeReactableDeliveryByTargetFrame = new Map<
    string,
    number
  >();
  for (const phase of result.targetPhaseLog) {
    if (phase.model !== "target-phase-v3") continue;
    for (const task of phase.targetTasks) {
      const delivery = task.delivery;
      if (delivery === null) continue;
      for (const attempt of delivery.attempts) {
        if (
          attempt.outcome !== "landed" ||
          attempt.applicationPhase !== "before-reactable-tick"
        ) {
          continue;
        }
        beforeReactableDeliveryDamageIds.add(
          attempt.damageEventId
        );
        lastBeforeReactableDeliveryByTargetFrame.set(
          `${attempt.targetId}\u0000${phase.globalFrame}`,
          attempt.damageEventId
        );
      }
    }
  }
  const rowsByTrigger = new Map<
    number,
    SimulationResult["frozenStateLog"]
  >();
  const expiryPointsByFrozenStateId = new Map<
    number,
    SimulationResult["targetStateTimeline"]["points"]
  >();
  for (const point of result.targetStateTimeline.points) {
    for (const link of point.links) {
      if (link.kind !== "frozen-state-log") continue;
      const points =
        expiryPointsByFrozenStateId.get(link.id) ?? [];
      points.push(point);
      expiryPointsByFrozenStateId.set(link.id, points);
    }
  }
  for (const row of result.frozenStateLog) {
    if (row.triggerDamageEventId === null) continue;
    const rows = rowsByTrigger.get(row.triggerDamageEventId) ?? [];
    rows.push(row);
    rowsByTrigger.set(row.triggerDamageEventId, rows);
  }

  for (const [pointIndex, point] of
    result.targetStateTimeline.points.entries()) {
    const frozenBefore = frozenGauge(point.auraBefore);
    const frozenAfter = frozenGauge(point.auraAfter);
    const createsFrozen =
      frozenBefore <= AURA_GAUGE_EPSILON &&
      frozenAfter > AURA_GAUGE_EPSILON;
    const removesFrozen =
      frozenBefore > AURA_GAUGE_EPSILON &&
      frozenAfter <= AURA_GAUGE_EPSILON;
    if (
      point.cause === "aura-natural-expiry" &&
      removesFrozen
    ) {
      addIssue(
        context,
        ["targetStateTimeline", "points", pointIndex, "cause"],
        "ordinary Aura expiry cannot remove Frozen; use the Frozen lifecycle callback"
      );
    }
    if (createsFrozen) {
      const startRows = result.frozenStateLog.filter(
        (row) =>
          row.targetId === point.targetId &&
          row.frame === point.frame &&
          row.operation === "start" &&
          row.triggerDamageEventId ===
            point.primaryDamageEventId &&
          semanticEqual(row.auraBefore, point.auraBefore) &&
          semanticEqual(row.auraAfter, point.auraAfter)
      );
      if (startRows.length !== 1) {
        addIssue(
          context,
          ["targetStateTimeline", "points", pointIndex, "auraAfter"],
          "Frozen appearance requires one input-owned Frozen start lifecycle row"
        );
      }
    }
    const explicitMechanicsTruncation =
      point.cause === "target-mechanics-truncation" ||
      (point.primaryDamageEventId !== null &&
        result.targetMechanicsTruncationLog.some(
          (entry) =>
            entry.targetId === point.targetId &&
            entry.frame === point.frame &&
            entry.triggerDamageEventId ===
              point.primaryDamageEventId
        ));
    if (!removesFrozen || explicitMechanicsTruncation) {
      continue;
    }
    const terminalRows = result.frozenStateLog.filter((row) => {
      if (
        row.targetId !== point.targetId ||
        row.frame !== point.frame ||
        frozenGauge(row.auraAfter) > AURA_GAUGE_EPSILON ||
        !semanticEqual(row.auraAfter, point.auraAfter)
      ) {
        return false;
      }
      if (point.cause === "frozen-expiry") {
        return (
          row.operation === "expire" &&
          point.links.some(
            (link) =>
              link.kind === "frozen-state-log" &&
              link.id === row.id
          )
        );
      }
      return (
        point.primaryDamageEventId !== null &&
        row.triggerDamageEventId === point.primaryDamageEventId &&
        (row.operation === "consume" ||
          row.operation === "poise-consume" ||
          row.operation === "shatter-consume")
      );
    });
    if (terminalRows.length !== 1) {
      addIssue(
        context,
        ["targetStateTimeline", "points", pointIndex, "auraAfter"],
        "Frozen disappearance requires one explicit expiry or consumption lifecycle owner"
      );
    }
  }
  const matchedRowIds = new Set<number>();
  const latestFrozenRowByTarget = new Map<
    string,
    SimulationResult["frozenStateLog"][number]
  >();

  for (const [eventIndex, event] of
    result.damageEvents.entries()) {
    const frozen = event.reactionAudit.frozenReaction;
    if (
      event.reactionAudit.reactions.includes("freeze") &&
      frozen === null
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "frozenReaction"
        ],
        "a recorded Freeze reaction must expose its Frozen lifecycle audit"
      );
    }
    if (frozen !== null) {
      const rows = (rowsByTrigger.get(event.id) ?? []).filter(
        (row) => row.operation === frozen.operation
      );
      if (rows.length !== 1) {
        addIssue(
          context,
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "frozenReaction"
          ],
          "Frozen reaction audit must own exactly one matching frozen-state row"
        );
      } else {
        const row = rows[0]!;
        matchedRowIds.add(row.id);
        const expectedReaction =
          event.reactionAudit.reaction === "melt"
            ? "melt"
            : frozen.operation === "consume" &&
                event.reactionAudit.reactions.includes(
                  "superconduct"
                )
              ? "superconduct"
              : event.reactionAudit.reaction === "swirlCryo"
                ? "swirlCryo"
                : event.reactionAudit.reaction ===
                    "crystallizeCryo"
                  ? "crystallizeCryo"
                  : "freeze";
        for (const [field, expected] of [
          ["reaction", expectedReaction],
          ["generation", frozen.generation],
          ["operation", frozen.operation],
          ["frame", event.frame],
          ["targetId", event.targetId],
          ["targetName", event.targetName],
          ["sourceActorId", event.sourceActorId],
          ["triggerDamageEventId", event.id],
          ["expiresAtFrame", frozen.expiresAtFrame]
        ] as const) {
          expectEqual(
            context,
            ["frozenStateLog", row.id, field],
            row[field],
            expected,
            `Frozen state ${field}`
          );
        }
        for (const [field, expected] of [
          ["timeSeconds", event.timeSeconds],
          ["freezeResistance", frozen.freezeResistance],
          ["generatedGaugeUnits", frozen.generatedGaugeUnits],
          ["consumedGaugeUnits", frozen.consumedGaugeUnits]
        ] as const) {
          expectNearlyEqual(
            context,
            ["frozenStateLog", row.id, field],
            row[field],
            expected,
            `Frozen state ${field}`
          );
        }
        expectSemanticEqual(
          context,
          ["frozenStateLog", row.id, "auraBefore"],
          row.auraBefore,
          event.reactionAudit.auraBefore ?? [],
          "Frozen state Aura before"
        );
        expectSemanticEqual(
          context,
          ["frozenStateLog", row.id, "auraAfter"],
          row.auraAfter,
          event.reactionAudit.auraAfter ?? [],
          "Frozen state Aura after"
        );
        const target = targetById.get(event.targetId);
        if (
          target === undefined ||
          !nearlyEqual(
            frozen.freezeResistance,
            target.freezeResistance
          )
        ) {
          addIssue(
            context,
            [
              "damageEvents",
              eventIndex,
              "reactionAudit",
              "frozenReaction",
              "freezeResistance"
            ],
            "Frozen resistance must match the resolved target"
          );
        }
        const auditAuraBefore =
          event.reactionAudit.auraBefore ?? [];
        const auditAuraAfter =
          event.reactionAudit.auraAfter ?? [];
        const frozenGaugeBefore =
          frozenGauge(auditAuraBefore);
        const frozenGaugeAfter =
          frozenGauge(auditAuraAfter);
        expectNearlyEqual(
          context,
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "frozenReaction",
            "frozenGaugeBefore"
          ],
          frozen.frozenGaugeBefore,
          frozenGaugeBefore,
          "Frozen gauge before"
        );
        expectNearlyEqual(
          context,
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "frozenReaction",
            "frozenGaugeAfter"
          ],
          frozen.frozenGaugeAfter,
          frozenGaugeAfter,
          "Frozen gauge after"
        );
        if (
          frozen.decayRatePerFrame <
          FROZEN_BASE_DECAY_PER_FRAME
        ) {
          addIssue(
            context,
            [
              "damageEvents",
              eventIndex,
              "reactionAudit",
              "frozenReaction",
              "decayRatePerFrame"
            ],
            "Frozen decay rate cannot be below the modeled base rate"
          );
        }
        if (
          frozen.operation === "start" ||
          frozen.operation === "refresh"
        ) {
          const consumedFreezeAuraElement =
            event.element === "hydro"
              ? "cryo"
              : event.element === "cryo"
                ? "hydro"
                : null;
          const freezeAuraConsumed =
            consumedFreezeAuraElement === null
              ? 0
              : (event.reactionAudit.auraConsumed ?? [])
                  .filter(
                    (entry) =>
                      entry.element ===
                      consumedFreezeAuraElement
                  )
                  .reduce(
                    (total, entry) =>
                      total + entry.gaugeUnits,
                    0
                  );
          expectNearlyEqual(
            context,
            [
              "damageEvents",
              eventIndex,
              "reactionAudit",
              "frozenReaction",
              "generatedGaugeUnits"
            ],
            frozen.generatedGaugeUnits,
            2 * freezeAuraConsumed,
            "Freeze generation from consumed opposing Aura"
          );
          const expectedAfter = Math.max(
            frozen.frozenGaugeBefore,
            frozen.generatedGaugeUnits
          );
          if (
            frozen.generatedGaugeUnits <=
              AURA_GAUGE_EPSILON ||
            frozen.consumedGaugeUnits >
              AURA_GAUGE_EPSILON ||
            !nearlyEqual(
              frozen.frozenGaugeAfter,
              expectedAfter
            ) ||
            (frozen.operation === "start" &&
              frozen.frozenGaugeBefore >
                AURA_GAUGE_EPSILON) ||
            (frozen.operation === "refresh" &&
              frozen.frozenGaugeBefore <=
                AURA_GAUGE_EPSILON)
          ) {
            addIssue(
              context,
              [
                "damageEvents",
                eventIndex,
                "reactionAudit",
                "frozenReaction",
                "frozenGaugeAfter"
              ],
              `${frozen.operation} must preserve max(before, generated) Frozen gauge without consumption`
            );
          }
        } else if (frozen.operation === "immune") {
          if (
            frozen.freezeResistance !== 1 ||
            frozen.generatedGaugeUnits >
              AURA_GAUGE_EPSILON ||
            frozen.consumedGaugeUnits >
              AURA_GAUGE_EPSILON ||
            frozen.frozenGaugeBefore >
              AURA_GAUGE_EPSILON ||
            frozen.frozenGaugeAfter >
              AURA_GAUGE_EPSILON ||
            frozen.expiresAtFrame !== null
          ) {
            addIssue(
              context,
              [
                "damageEvents",
                eventIndex,
                "reactionAudit",
                "frozenReaction"
              ],
              "immune Freeze must leave no Frozen gauge or expiry at resistance 1"
            );
          }
        } else {
          if (
            frozen.generatedGaugeUnits >
              AURA_GAUGE_EPSILON ||
            frozen.frozenGaugeBefore <=
              AURA_GAUGE_EPSILON ||
            frozen.consumedGaugeUnits >
              frozen.frozenGaugeBefore +
                AURA_GAUGE_EPSILON ||
            !nearlyEqual(
              frozen.frozenGaugeAfter,
              Math.max(
                0,
                frozen.frozenGaugeBefore -
                  frozen.consumedGaugeUnits
              )
            )
          ) {
            addIssue(
              context,
              [
                "damageEvents",
                eventIndex,
                "reactionAudit",
                "frozenReaction",
                "frozenGaugeAfter"
              ],
              "Frozen consumption must conserve before - consumed = after"
            );
          }
        }
        validateActiveFrozenExpiry({
          eventIndex,
          row,
          frozenGaugeAfter: frozen.frozenGaugeAfter,
          decayRatePerFrame: frozen.decayRatePerFrame,
          freezeResistance: frozen.freezeResistance,
          expiresAtFrame: frozen.expiresAtFrame
        });
      }
    }

    const shatter = event.reactionAudit.shatterReaction;
    if (shatter === null) continue;
    const shatterGaugeBefore = frozenGauge(
      shatter.auraBefore
    );
    const shatterGaugeAfterPoise = frozenGauge(
      shatter.auraAfterPoise
    );
    const shatterGaugeAfter = frozenGauge(
      shatter.auraAfter
    );
    for (const [field, actual, expected] of [
      [
        "frozenGaugeBefore",
        shatter.frozenGaugeBefore,
        shatterGaugeBefore
      ],
      [
        "frozenGaugeAfterPoise",
        shatter.frozenGaugeAfterPoise,
        shatterGaugeAfterPoise
      ],
      [
        "frozenGaugeAfter",
        shatter.frozenGaugeAfter,
        shatterGaugeAfter
      ]
    ] as const) {
      expectNearlyEqual(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "shatterReaction",
          field
        ],
        actual,
        expected,
        `Shatter ${field}`
      );
    }
    if (
      shatter.poiseConsumedGaugeUnits >
        shatter.frozenGaugeBefore +
          AURA_GAUGE_EPSILON ||
      !nearlyEqual(
        shatter.frozenGaugeAfterPoise,
        Math.max(
          0,
          shatter.frozenGaugeBefore -
            shatter.poiseConsumedGaugeUnits
        )
      ) ||
      shatter.shatterConsumedGaugeUnits >
        shatter.frozenGaugeAfterPoise +
          AURA_GAUGE_EPSILON ||
      !nearlyEqual(
        shatter.frozenGaugeAfter,
        Math.max(
          0,
          shatter.frozenGaugeAfterPoise -
            shatter.shatterConsumedGaugeUnits
        )
      )
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "shatterReaction",
          "frozenGaugeAfter"
        ],
        "Shatter poise and reaction consumption must conserve Frozen gauge"
      );
    }
    const finalFrozenEntry = expectSingleFrozenEntry(
      shatter.auraAfter,
      [
        "damageEvents",
        eventIndex,
        "reactionAudit",
        "shatterReaction",
        "auraAfter"
      ],
      "Shatter Aura after"
    );
    if (shatter.frozenGaugeAfter > AURA_GAUGE_EPSILON) {
      if (
        finalFrozenEntry === undefined ||
        shatter.expiresAtFrame === null
      ) {
        addIssue(
          context,
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "shatterReaction",
            "expiresAtFrame"
          ],
          "partially consumed Frozen must retain its Aura expiry"
        );
      } else {
        expectEqual(
          context,
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "shatterReaction",
            "expiresAtFrame"
          ],
          shatter.expiresAtFrame,
          finalFrozenEntry.expiresAtFrame,
          "Shatter Frozen expiry"
        );
      }
    } else if (
      finalFrozenEntry !== undefined ||
      shatter.expiresAtFrame !== null
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "shatterReaction",
          "expiresAtFrame"
        ],
        "depleted Shatter Frozen state cannot retain Aura or an expiry"
      );
    }
    const expectedShatterState =
      shatter.frozenGaugeBefore <= AURA_GAUGE_EPSILON
        ? "NO_FROZEN_AURA"
        : shatter.frozenGaugeAfterPoise <=
            AURA_GAUGE_EPSILON
          ? "FROZEN_DEPLETED_BY_POISE"
          : "TRIGGERED";
    if (
      (expectedShatterState === "NO_FROZEN_AURA" &&
        (shatter.triggered ||
          shatter.scheduled ||
          shatter.blockedReason !== "NO_FROZEN_AURA" ||
          shatter.poiseConsumedGaugeUnits >
            AURA_GAUGE_EPSILON ||
          shatter.shatterConsumedGaugeUnits >
            AURA_GAUGE_EPSILON)) ||
      (expectedShatterState ===
        "FROZEN_DEPLETED_BY_POISE" &&
        (shatter.triggered ||
          shatter.scheduled ||
          shatter.blockedReason !==
            "FROZEN_DEPLETED_BY_POISE" ||
          shatter.poiseConsumedGaugeUnits <=
            AURA_GAUGE_EPSILON ||
          shatter.shatterConsumedGaugeUnits >
            AURA_GAUGE_EPSILON)) ||
      (expectedShatterState === "TRIGGERED" &&
        (!shatter.triggered ||
          shatter.shatterConsumedGaugeUnits <=
            AURA_GAUGE_EPSILON ||
          (shatter.scheduled
            ? shatter.blockedReason !== null
            : shatter.blockedReason !==
                "REACTION_DAMAGE_GCD" &&
              shatter.blockedReason !==
                "TARGET_MECHANICS_TRUNCATION")))
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "shatterReaction"
        ],
        "Shatter trigger state is inconsistent with its Frozen gauge transitions"
      );
    }
    const shatterRows = rowsByTrigger.get(event.id) ?? [];
    for (const operation of [
      "poise-consume",
      "shatter-consume"
    ] as const) {
      const expectedConsumed =
        operation === "poise-consume"
          ? shatter.poiseConsumedGaugeUnits
          : shatter.shatterConsumedGaugeUnits;
      const rows = shatterRows.filter(
        (row) => row.operation === operation
      );
      const expectedCount =
        expectedConsumed > 0 &&
        event.reactionAudit.mechanicsTruncation === null
          ? 1
          : 0;
      if (rows.length !== expectedCount) {
        addIssue(
          context,
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "shatterReaction"
          ],
          `${operation} must own exactly ${expectedCount} frozen-state row(s)`
        );
        continue;
      }
      const row = rows[0];
      if (row === undefined) continue;
      matchedRowIds.add(row.id);
      for (const [field, expected] of [
        ["reaction", "shatter"],
        ["generation", shatter.generation],
        ["operation", operation],
        ["frame", event.frame],
        ["targetId", event.targetId],
        ["targetName", event.targetName],
        ["sourceActorId", event.sourceActorId],
        ["triggerDamageEventId", event.id],
        ["expiresAtFrame", shatter.expiresAtFrame]
      ] as const) {
        expectEqual(
          context,
          ["frozenStateLog", row.id, field],
          row[field],
          expected,
          `Shatter Frozen state ${field}`
        );
      }
      expectNearlyEqual(
        context,
        ["frozenStateLog", row.id, "consumedGaugeUnits"],
        row.consumedGaugeUnits,
        expectedConsumed,
        "Shatter Frozen consumption"
      );
      expectNearlyEqual(
        context,
        ["frozenStateLog", row.id, "generatedGaugeUnits"],
        row.generatedGaugeUnits,
        0,
        "Shatter Frozen generation"
      );
      expectSemanticEqual(
        context,
        ["frozenStateLog", row.id, "auraBefore"],
        row.auraBefore,
        operation === "poise-consume"
          ? shatter.auraBefore
          : shatter.auraAfterPoise,
        "Shatter Frozen Aura before"
      );
      expectSemanticEqual(
        context,
        ["frozenStateLog", row.id, "auraAfter"],
        row.auraAfter,
        operation === "poise-consume"
          ? shatter.auraAfterPoise
          : shatter.auraAfter,
        "Shatter Frozen Aura after"
      );
    }
  }

  for (const [rowIndex, row] of
    result.frozenStateLog.entries()) {
    const target = result.enemyTargets.find(
      (candidate) => candidate.id === row.targetId
    );
    if (
      target === undefined ||
      target.name !== row.targetName
    ) {
      addIssue(
        context,
        ["frozenStateLog", rowIndex, "targetId"],
        "Frozen state target identity must match enemyTargets"
      );
    }
    if (
      target !== undefined &&
      !nearlyEqual(
        row.freezeResistance,
        target.freezeResistance
      )
    ) {
      addIssue(
        context,
        ["frozenStateLog", rowIndex, "freezeResistance"],
        "Frozen state resistance must match the resolved target"
      );
    }
    if (
      row.triggerDamageEventId !== null &&
      !damageEventById.has(row.triggerDamageEventId)
    ) {
      addIssue(
        context,
        [
          "frozenStateLog",
          rowIndex,
          "triggerDamageEventId"
        ],
        `references missing damage event ${row.triggerDamageEventId}`
      );
    }
    if (
      row.sourceActorId !== null &&
      !actorIds.has(row.sourceActorId)
    ) {
      addIssue(
        context,
        ["frozenStateLog", rowIndex, "sourceActorId"],
        `references missing actor ${row.sourceActorId}`
      );
    }
    expectNearlyEqual(
      context,
      ["frozenStateLog", rowIndex, "timeSeconds"],
      row.timeSeconds,
      row.frame / 60,
      "Frozen state time"
    );
    const rowGaugeBefore = frozenGauge(row.auraBefore);
    const rowGaugeAfter = frozenGauge(row.auraAfter);
    expectSingleFrozenEntry(
      row.auraBefore,
      ["frozenStateLog", rowIndex, "auraBefore"],
      "Frozen state Aura before"
    );
    const rowFrozenAfter = expectSingleFrozenEntry(
      row.auraAfter,
      ["frozenStateLog", rowIndex, "auraAfter"],
      "Frozen state Aura after"
    );
    if (
      row.operation === "start" ||
      row.operation === "refresh"
    ) {
      const expectedAfter = Math.max(
        rowGaugeBefore,
        row.generatedGaugeUnits
      );
      if (
        row.generatedGaugeUnits <= AURA_GAUGE_EPSILON ||
        row.consumedGaugeUnits > AURA_GAUGE_EPSILON ||
        !nearlyEqual(rowGaugeAfter, expectedAfter) ||
        (row.operation === "start" &&
          rowGaugeBefore > AURA_GAUGE_EPSILON) ||
        (row.operation === "refresh" &&
          rowGaugeBefore <= AURA_GAUGE_EPSILON) ||
        row.reason !== null
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          `${row.operation} Frozen row must preserve max(before, generated) gauge without consumption`
        );
      }
    } else if (row.operation === "immune") {
      if (
        row.freezeResistance !== 1 ||
        row.generatedGaugeUnits > AURA_GAUGE_EPSILON ||
        row.consumedGaugeUnits > AURA_GAUGE_EPSILON ||
        rowGaugeBefore > AURA_GAUGE_EPSILON ||
        rowGaugeAfter > AURA_GAUGE_EPSILON ||
        row.expiresAtFrame !== null ||
        row.reason !== "FREEZE_RESISTANCE_IMMUNE"
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          "immune Freeze row must retain no Frozen gauge or expiry"
        );
      }
    } else if (
      row.operation === "consume" ||
      row.operation === "poise-consume" ||
      row.operation === "shatter-consume"
    ) {
      const expectedAfter = Math.max(
        0,
        rowGaugeBefore - row.consumedGaugeUnits
      );
      if (
        row.generatedGaugeUnits > AURA_GAUGE_EPSILON ||
        rowGaugeBefore <= AURA_GAUGE_EPSILON ||
        row.consumedGaugeUnits >
          rowGaugeBefore + AURA_GAUGE_EPSILON ||
        !nearlyEqual(rowGaugeAfter, expectedAfter)
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          `${row.operation} must conserve before - consumed = after Frozen gauge`
        );
      }
      const expectedExtent =
        rowGaugeAfter <= AURA_GAUGE_EPSILON
          ? "FROZEN_CONSUMED"
          : "FROZEN_PARTIALLY_CONSUMED";
      const expectedReason =
        row.operation === "poise-consume"
          ? rowGaugeAfter <= AURA_GAUGE_EPSILON
            ? "FROZEN_DEPLETED_BY_BLUNT_POISE"
            : "FROZEN_PARTIALLY_CONSUMED_BY_BLUNT_POISE"
          : row.operation === "shatter-consume"
            ? `${expectedExtent}_BY_SHATTER`
            : `${expectedExtent}_BY_${
                row.reaction === "melt"
                  ? "MELT"
                  : row.reaction === "swirlCryo"
                    ? "SWIRL"
                    : row.reaction === "crystallizeCryo"
                      ? "CRYSTALLIZE"
                      : "SUPERCONDUCT"
              }`;
      if (row.reason !== expectedReason) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex, "reason"],
          `${row.operation} reason must match its Frozen consumption extent`
        );
      }
    }
    if (
      row.operation !== "expire" &&
      row.operation !== "poise-consume"
    ) {
      if (rowGaugeAfter > AURA_GAUGE_EPSILON) {
        if (
          rowFrozenAfter === undefined ||
          row.expiresAtFrame === null
        ) {
          addIssue(
            context,
            ["frozenStateLog", rowIndex, "expiresAtFrame"],
            "active Frozen row requires one Aura expiry"
          );
        } else {
          expectEqual(
            context,
            ["frozenStateLog", rowIndex, "expiresAtFrame"],
            row.expiresAtFrame,
            rowFrozenAfter.expiresAtFrame,
            "Frozen row global expiry"
          );
          if (
            row.targetFrame !== undefined &&
            result.targetClockAudit.mode ===
              "target-local-hitlag-v1"
          ) {
            expectEqual(
              context,
              [
                "frozenStateLog",
                rowIndex,
                "expiresAtTargetFrame"
              ],
              row.expiresAtTargetFrame,
              rowFrozenAfter.expiresAtTargetFrame,
              "Frozen row target-local expiry"
            );
          }
        }
      } else if (
        rowFrozenAfter !== undefined ||
        row.expiresAtFrame !== null
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex, "expiresAtFrame"],
          "depleted Frozen row cannot retain Aura or an expiry"
        );
      }
    }
    if (row.operation === "expire") {
      if (
        row.reaction !== "freeze" ||
        row.generatedGaugeUnits !== 0 ||
        row.consumedGaugeUnits !== 0 ||
        row.expiresAtFrame !== null ||
        row.reason !== "FROZEN_DECAY_EXPIRED" ||
        rowGaugeBefore <= AURA_GAUGE_EPSILON ||
        rowGaugeAfter > AURA_GAUGE_EPSILON ||
        (row.targetFrame !== undefined &&
          row.expiresAtTargetFrame !== null)
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          "Frozen expiry must be a zero-gauge terminal Freeze row"
        );
      }
      const points =
        expiryPointsByFrozenStateId.get(row.id) ?? [];
      if (points.length !== 1) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          "Frozen expiry must own exactly one target-state expiry point"
        );
      } else {
        const point = points[0]!;
        for (const [field, expected] of [
          ["cause", "frozen-expiry"],
          ["frame", row.frame],
          ["targetId", row.targetId],
          ["targetName", row.targetName]
        ] as const) {
          expectEqual(
            context,
            ["frozenStateLog", rowIndex, field],
            point[field],
            expected,
            `Frozen expiry point ${field}`
          );
        }
        expectNearlyEqual(
          context,
          ["frozenStateLog", rowIndex, "timeSeconds"],
          point.timeSeconds,
          row.timeSeconds,
          "Frozen expiry point time"
        );
        expectSemanticEqual(
          context,
          ["frozenStateLog", rowIndex, "auraBefore"],
          row.auraBefore,
          point.auraBefore,
          "Frozen expiry Aura before"
        );
        expectSemanticEqual(
          context,
          ["frozenStateLog", rowIndex, "auraAfter"],
          row.auraAfter,
          point.auraAfter,
          "Frozen expiry Aura after"
        );
        expectEqual(
          context,
          ["frozenStateLog", rowIndex, "targetFrame"],
          row.targetFrame,
          point.targetFrame,
          "Frozen expiry target frame"
        );
      }
      const expiringFrozen = expectSingleFrozenEntry(
        row.auraBefore,
        ["frozenStateLog", rowIndex, "auraBefore"],
        "Frozen expiry Aura before"
      );
      if (expiringFrozen !== undefined) {
        expectEqual(
          context,
          [
            "frozenStateLog",
            rowIndex,
            "auraBefore",
            "expiresAtFrame"
          ],
          expiringFrozen.expiresAtFrame,
          row.frame,
          "Frozen natural global expiry boundary"
        );
        if (
          row.targetFrame !== undefined &&
          result.targetClockAudit.mode ===
            "target-local-hitlag-v1"
        ) {
          expectEqual(
            context,
            [
              "frozenStateLog",
              rowIndex,
              "auraBefore",
              "expiresAtTargetFrame"
            ],
            expiringFrozen.expiresAtTargetFrame,
            row.targetFrame,
            "Frozen natural target-local expiry boundary"
          );
        }
      }
      const previous = latestFrozenRowByTarget.get(row.targetId);
      if (previous === undefined) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          "Frozen expiry requires a preceding active Frozen state"
        );
      } else {
        expectEqual(
          context,
          ["frozenStateLog", rowIndex, "generation"],
          row.generation,
          previous.generation,
          "Frozen expiry generation"
        );
        if (previous.targetFrame !== undefined) {
          expectEqual(
            context,
            ["frozenStateLog", rowIndex, "targetFrame"],
            row.targetFrame,
            previous.expiresAtTargetFrame,
            "Frozen target-local lifecycle deadline"
          );
        } else {
          expectEqual(
            context,
            ["frozenStateLog", rowIndex, "frame"],
            row.frame,
            previous.expiresAtFrame,
            "Frozen global lifecycle deadline"
          );
        }
        const hasSourceActor = row.sourceActorId !== null;
        const hasTrigger = row.triggerDamageEventId !== null;
        if (hasSourceActor !== hasTrigger) {
          addIssue(
            context,
            ["frozenStateLog", rowIndex, "sourceActorId"],
            "Frozen expiry provenance must be either a complete source/trigger pair or fully unavailable"
          );
        } else if (hasSourceActor && hasTrigger) {
          expectEqual(
            context,
            ["frozenStateLog", rowIndex, "sourceActorId"],
            row.sourceActorId,
            previous.sourceActorId,
            "Frozen expiry source snapshot"
          );
          expectEqual(
            context,
            [
              "frozenStateLog",
              rowIndex,
              "triggerDamageEventId"
            ],
            row.triggerDamageEventId,
            previous.triggerDamageEventId,
            "Frozen expiry trigger snapshot"
          );
        }
      }
    } else if (!matchedRowIds.has(row.id)) {
      addIssue(
        context,
        ["frozenStateLog", rowIndex],
        "non-expiry Frozen state row must backlink its owning damage-event audit"
      );
    }
    if (
      row.operation === "expire" ||
      !row.auraAfter.some((entry) => entry.element === "frozen")
    ) {
      latestFrozenRowByTarget.delete(row.targetId);
    } else {
      latestFrozenRowByTarget.set(row.targetId, row);
    }
  }

  const endAuraByTarget = new Map(
    result.auraEndStates.map((state) => [state.targetId, state.aura])
  );
  for (const target of result.enemyTargets) {
    const activeLifecycle = latestFrozenRowByTarget.get(target.id);
    const finalHasFrozen = (endAuraByTarget.get(target.id) ?? []).some(
      (entry) =>
        entry.element === "frozen" &&
        entry.gaugeUnits > AURA_GAUGE_EPSILON
    );
    const truncatedAfterLifecycle =
      activeLifecycle !== undefined &&
      result.targetMechanicsTruncationLog.some(
        (entry) =>
          entry.targetId === target.id &&
          entry.frame >= activeLifecycle.frame
      );
    if (
      activeLifecycle !== undefined &&
      !finalHasFrozen &&
      !truncatedAfterLifecycle
    ) {
      addIssue(
        context,
        ["frozenStateLog", activeLifecycle.id],
        "active Frozen lifecycle is missing an in-range terminal mutation"
      );
    }
    if (activeLifecycle === undefined && finalHasFrozen) {
      addIssue(
        context,
        ["auraEndStates", target.id, "aura"],
        "terminal Frozen Aura is missing its originating lifecycle row"
      );
    }
  }

  type FrozenDecayReplayState = {
    localFrame: number;
    decayRatePerFrame: number;
    gaugeUnits: number;
    active: boolean;
  };
  const decayReplayByTarget = new Map<
    string,
    FrozenDecayReplayState
  >();
  for (const [rowIndex, row] of
    result.frozenStateLog.entries()) {
    const localFrame = row.targetFrame ?? row.frame;
    const target = targetById.get(row.targetId);
    if (target === undefined) continue;
    const previous =
      decayReplayByTarget.get(row.targetId) ?? {
        localFrame: 0,
        decayRatePerFrame:
          FROZEN_BASE_DECAY_PER_FRAME,
        gaugeUnits: 0,
        active: false
      };
    if (localFrame < previous.localFrame) {
      addIssue(
        context,
        ["frozenStateLog", rowIndex, "targetFrame"],
        "Frozen target-local lifecycle frames must be nondecreasing"
      );
      continue;
    }
    const elapsed = localFrame - previous.localFrame;
    const beforeReactableDelivery =
      row.operation !== "expire" &&
      row.triggerDamageEventId !== null &&
      beforeReactableDeliveryDamageIds.has(
        row.triggerDamageEventId
      );
    // A v3 inline delivery settles before this target's Reactable.Tick. Its
    // audit observes the end of the prior local frame, so the current frame's
    // ordinary Frozen decay must not be charged until after the mutation.
    const elapsedBeforeMutation = beforeReactableDelivery
      ? Math.max(0, elapsed - 1)
      : elapsed;
    const rowGaugeBefore = frozenGauge(row.auraBefore);
    const rowGaugeAfter = frozenGauge(row.auraAfter);

    if (row.operation === "expire") {
      if (
        !previous.active ||
        elapsed <= 0 ||
        target.freezeResistance >= 1
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex],
          "Frozen natural expiry requires a prior active non-immune decay state"
        );
        decayReplayByTarget.set(row.targetId, {
          localFrame,
          decayRatePerFrame:
            previous.decayRatePerFrame,
          gaugeUnits: 0,
          active: false
        });
        continue;
      }
      const expectedRemainingFrames =
        remainingFrozenFrames(
          previous.gaugeUnits,
          previous.decayRatePerFrame,
          target.freezeResistance
        );
      expectEqual(
        context,
        ["frozenStateLog", rowIndex, "targetFrame"],
        elapsed,
        expectedRemainingFrames,
        "Frozen natural expiry target-local duration"
      );
      const framesBeforeFinalTick = elapsed - 1;
      const expectedGaugeBefore = frozenGaugeAfterTicks(
        previous.gaugeUnits,
        previous.decayRatePerFrame,
        target.freezeResistance,
        framesBeforeFinalTick
      );
      expectNearlyEqual(
        context,
        ["frozenStateLog", rowIndex, "auraBefore"],
        rowGaugeBefore,
        expectedGaugeBefore,
        "Frozen natural expiry pre-final-tick gauge"
      );
      const decayRateBeforeFinalTick =
        previous.decayRatePerFrame +
        FROZEN_DECAY_ACCELERATION_PER_FRAME *
          framesBeforeFinalTick;
      const gaugeAfterFinalTick =
        expectedGaugeBefore -
        (decayRateBeforeFinalTick +
          FROZEN_DECAY_ACCELERATION_PER_FRAME) /
          (1 - target.freezeResistance);
      if (gaugeAfterFinalTick > AURA_GAUGE_EPSILON) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex, "auraAfter"],
          "Frozen natural expiry final tick must deplete the remaining gauge"
        );
      }
      decayReplayByTarget.set(row.targetId, {
        localFrame,
        decayRatePerFrame:
          decayRateBeforeFinalTick +
          FROZEN_DECAY_ACCELERATION_PER_FRAME,
        gaugeUnits: 0,
        active: false
      });
      continue;
    }

    let expectedGaugeBefore = 0;
    let expectedDecayRate = previous.decayRatePerFrame;
    if (previous.active) {
      expectedGaugeBefore = frozenGaugeAfterTicks(
        previous.gaugeUnits,
        previous.decayRatePerFrame,
        target.freezeResistance,
        elapsedBeforeMutation
      );
      expectedDecayRate +=
        FROZEN_DECAY_ACCELERATION_PER_FRAME *
        elapsedBeforeMutation;
      if (
        expectedGaugeBefore <= AURA_GAUGE_EPSILON
      ) {
        addIssue(
          context,
          ["frozenStateLog", rowIndex, "auraBefore"],
          "Frozen lifecycle cannot skip its natural expiry before a later mutation"
        );
      }
    } else {
      expectedDecayRate = Math.max(
        FROZEN_BASE_DECAY_PER_FRAME,
            previous.decayRatePerFrame -
          2 *
            FROZEN_DECAY_ACCELERATION_PER_FRAME *
            elapsedBeforeMutation
      );
    }
    expectNearlyEqual(
      context,
      ["frozenStateLog", rowIndex, "auraBefore"],
      rowGaugeBefore,
      Math.max(0, expectedGaugeBefore),
      "Frozen lifecycle replay gauge before"
    );

    const trigger =
      row.triggerDamageEventId === null
        ? undefined
        : damageEventById.get(row.triggerDamageEventId);
    const frozenAudit =
      trigger?.reactionAudit.frozenReaction;
    const ownsFrozenAudit =
      frozenAudit !== null &&
      frozenAudit !== undefined &&
      frozenAudit.operation === row.operation &&
      trigger?.frame === row.frame;
    if (ownsFrozenAudit) {
      expectNearlyEqual(
        context,
        [
          "damageEvents",
          trigger.id,
          "reactionAudit",
          "frozenReaction",
          "decayRatePerFrame"
        ],
        frozenAudit.decayRatePerFrame,
        expectedDecayRate,
        "Frozen lifecycle replay decay rate"
      );
    }
    let replayGaugeAfter = rowGaugeAfter;
    let replayDecayRate = ownsFrozenAudit
      ? frozenAudit.decayRatePerFrame
      : expectedDecayRate;
    if (
      beforeReactableDelivery &&
      row.triggerDamageEventId !== null &&
      lastBeforeReactableDeliveryByTargetFrame.get(
        `${row.targetId}\u0000${row.frame}`
      ) === row.triggerDamageEventId &&
      !result.frozenStateLog
        .slice(rowIndex + 1)
        .some(
          (later) =>
            later.targetId === row.targetId &&
            (later.targetFrame ?? later.frame) === localFrame
        )
    ) {
      const recipientPhase = result.targetPhaseLog.find(
        (phase) =>
          phase.model === "target-phase-v3" &&
          phase.globalFrame === row.frame &&
          phase.targetId === row.targetId
      );
      if (recipientPhase !== undefined) {
        replayGaugeAfter = frozenGauge(
          recipientPhase.reactableTick.auraAfter
        );
        if (rowGaugeAfter > AURA_GAUGE_EPSILON) {
          replayDecayRate +=
            FROZEN_DECAY_ACCELERATION_PER_FRAME;
        }
      }
    }
    decayReplayByTarget.set(row.targetId, {
      localFrame,
      decayRatePerFrame: replayDecayRate,
      gaugeUnits: replayGaugeAfter,
      active: replayGaugeAfter > AURA_GAUGE_EPSILON
    });
  }
}

interface CrystallizeEmBuffReplayEvent {
  key: string;
  targetId: string;
  value: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  actionOrder: number;
  buffOrder: number;
}

function crystallizeBuffTargets(
  result: SimulationResult,
  actorId: string,
  target: StatusTarget | undefined
): string[] {
  if (target === "team") {
    return result.config.characters.map((character) => character.id);
  }
  if (target === "self" || target === undefined) {
    return [actorId];
  }
  return Array.isArray(target) ? target : [target];
}

function buildCrystallizeEmBuffReplay(
  result: SimulationResult
): Map<string, CrystallizeEmBuffReplayEvent[]> {
  const eventsByTarget = new Map<
    string,
    CrystallizeEmBuffReplayEvent[]
  >();
  const append = ({
    actorId,
    target,
    key,
    value,
    startTimeSeconds,
    endTimeSeconds,
    actionOrder,
    buffOrder
  }: Omit<CrystallizeEmBuffReplayEvent, "targetId"> & {
    actorId: string;
    target: StatusTarget | undefined;
  }): void => {
    for (const targetId of crystallizeBuffTargets(
      result,
      actorId,
      target
    )) {
      const events = eventsByTarget.get(targetId) ?? [];
      events.push({
        key: `${key}:${targetId}`,
        targetId,
        value,
        startTimeSeconds,
        endTimeSeconds,
        actionOrder,
        buffOrder
      });
      eventsByTarget.set(targetId, events);
    }
  };

  for (const [actionOrder, action] of
    result.actionLog.entries()) {
    if (
      action.timelineCommandIndex !== undefined &&
      action.sourceAbilityId !== undefined
    ) {
      const ability = result.config.timeline?.abilities.find(
        (candidate) =>
          candidate.id === action.sourceAbilityId &&
          candidate.actorId === action.actorId
      );
      for (const [buffOrder, buff] of (
        ability?.buffs ?? []
      ).entries()) {
        if (buff.stat !== "em") continue;
        const startTimeSeconds =
          action.time + (buff.startFrame ?? 0) / 60;
        append({
          actorId: action.actorId,
          target: buff.target,
          key: buff.key ?? buff.stat,
          value: buff.value,
          startTimeSeconds,
          endTimeSeconds:
            startTimeSeconds + buff.durationFrames / 60,
          actionOrder,
          buffOrder
        });
      }
      continue;
    }

    const definition = result.config.rotation.find(
      (candidate) =>
        candidate.id === action.actionId &&
        candidate.actorId === action.actorId
    );
    for (const [buffOrder, buff] of (
      definition?.buffs ?? []
    ).entries()) {
      if (buff.stat !== "em") continue;
      const startTimeSeconds =
        action.time + (buff.offset ?? 0);
      append({
        actorId: action.actorId,
        target: buff.target,
        key: buff.key ?? buff.stat,
        value: buff.value,
        startTimeSeconds,
        endTimeSeconds: startTimeSeconds + buff.duration,
        actionOrder,
        buffOrder
      });
    }
  }

  for (const events of eventsByTarget.values()) {
    events.sort(
      (left, right) =>
        left.startTimeSeconds - right.startTimeSeconds ||
        left.actionOrder - right.actionOrder ||
        left.buffOrder - right.buffOrder
    );
  }
  return eventsByTarget;
}

function replayCrystallizeSpawnElementalMastery(
  result: SimulationResult,
  eventsByTarget: Map<
    string,
    CrystallizeEmBuffReplayEvent[]
  >,
  actorId: string,
  spawnTimeSeconds: number
): number | undefined {
  const actor = result.config.characters.find(
    (character) => character.id === actorId
  );
  if (actor === undefined) return undefined;
  const activeByKey = new Map<
    string,
    CrystallizeEmBuffReplayEvent
  >();
  for (const event of eventsByTarget.get(actorId) ?? []) {
    if (
      event.startTimeSeconds > spawnTimeSeconds
    ) {
      break;
    }
    activeByKey.set(event.key, event);
  }
  let elementalMastery = actor.stats.em;
  for (const event of activeByKey.values()) {
    if (
      event.endTimeSeconds >
      spawnTimeSeconds + FLOAT_TOLERANCE
    ) {
      elementalMastery += event.value;
    }
  }
  return elementalMastery;
}

function validateCrystallizeShardProjection(
  result: SimulationResult,
  context: RefinementCtx
): void {
  if (
    result.crystallizeShardLog.length === 0 &&
    result.crystallizeShieldLog.length === 0 &&
    result.crystallizeShieldTimeline.length === 0
  ) {
    return;
  }
  const damageEventById = new Map(
    result.damageEvents.map((event) => [event.id, event])
  );
  const actorIds = new Set(
    result.config.characters.map((character) => character.id)
  );
  const targetIds = new Set(
    result.enemyTargets.map((target) => target.id)
  );
  const actorById = new Map(
    result.config.characters.map((character) => [
      character.id,
      character
    ])
  );
  const spawnByShardId = new Map<
    number,
    SimulationResult["crystallizeShardLog"][number]
  >();
  const activeShards = new Map<
    number,
    SimulationResult["crystallizeShardLog"][number]
  >();
  const pickupRowsByCommandIndex = new Map<
    number,
    SimulationResult["crystallizeShardLog"]
  >();
  const pickupByShieldLogId = new Map<
    number,
    SimulationResult["crystallizeShardLog"][number]
  >();
  let nextShardId = 0;
  const snapshotFields = [
    "reaction",
    "element",
    "sourceActorId",
    "sourceTargetId",
    "triggerDamageEventId",
    "triggerFrame",
    "spawnedAtFrame",
    "earliestPickupFrame",
    "expiresAtFrame",
    "position",
    "spawnRadius",
    "spawnAngleDegrees",
    "sourceCharacterLevel",
    "sourceElementalMastery"
  ] as const;
  const runEndFrame = Math.round(result.config.duration * 60);
  const timeline = result.config.timeline;
  const execution = result.timelineExecution;
  const emBuffReplay = buildCrystallizeEmBuffReplay(result);

  for (const [rowIndex, row] of
    result.crystallizeShardLog.entries()) {
    if (
      row.sourceActorId !== null &&
      !actorIds.has(row.sourceActorId)
    ) {
      addIssue(
        context,
        [
          "crystallizeShardLog",
          rowIndex,
          "sourceActorId"
        ],
        `references missing actor ${row.sourceActorId}`
      );
    }
    if (
      row.sourceTargetId !== null &&
      !targetIds.has(row.sourceTargetId)
    ) {
      addIssue(
        context,
        [
          "crystallizeShardLog",
          rowIndex,
          "sourceTargetId"
        ],
        `references missing target ${row.sourceTargetId}`
      );
    }
    if (
      row.pickedUpByActorId !== null &&
      !actorIds.has(row.pickedUpByActorId)
    ) {
      addIssue(
        context,
        [
          "crystallizeShardLog",
          rowIndex,
          "pickedUpByActorId"
        ],
        `references missing actor ${row.pickedUpByActorId}`
      );
    }
    if (
      row.operation === "pickup" ||
      row.operation === "pickup-attempt"
    ) {
      const commandIndex = row.pickupCommandIndex;
      const command =
        commandIndex === null
          ? undefined
          : timeline?.commands[commandIndex];
      const commandResult =
        commandIndex === null
          ? undefined
          : execution?.commandResults[commandIndex];
      if (
        commandIndex === null ||
        command?.type !== "pickUpCrystallize" ||
        commandResult === undefined ||
        commandResult.commandIndex !== commandIndex ||
        commandResult.commandType !== "pickUpCrystallize" ||
        commandResult.status === "rejected" ||
        commandResult.startFrame !== row.frame
      ) {
        addIssue(
          context,
          [
            "crystallizeShardLog",
            rowIndex,
            "pickupCommandIndex"
          ],
          "pickup rows must backlink an executed Crystallize-pickup command at the same frame"
        );
      } else {
        const rows =
          pickupRowsByCommandIndex.get(commandIndex) ?? [];
        rows.push(row);
        pickupRowsByCommandIndex.set(commandIndex, rows);
        const commandMatchesShard =
          command.element === "any" ||
          command.element === row.element;
        if (
          row.reason === "NO_MATCHING_SHARD"
            ? row.element !== command.element
            : !commandMatchesShard
        ) {
          addIssue(
            context,
            ["crystallizeShardLog", rowIndex, "element"],
            "pickup shard element must match the linked command selector"
          );
        }
      }
    }
    if (row.operation === "spawn" && row.shardId !== null) {
      if (spawnByShardId.has(row.shardId)) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "shardId"],
          `shard ${row.shardId} was spawned more than once`
        );
      } else {
        spawnByShardId.set(row.shardId, row);
      }
      if (row.shardId !== nextShardId) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "shardId"],
          `spawned shard IDs must be contiguous; expected ${nextShardId}`
        );
      }
      nextShardId += 1;
      if (activeShards.size >= 3) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "operation"],
          "spawn cannot exceed the three-active-shard capacity without a preceding eviction"
        );
      }
      const trigger =
        row.triggerDamageEventId === null
          ? undefined
          : damageEventById.get(row.triggerDamageEventId);
      const audit =
        trigger?.reactionAudit.crystallizeReaction;
      if (trigger === undefined || audit === null || audit === undefined) {
        addIssue(
          context,
          [
            "crystallizeShardLog",
            rowIndex,
            "triggerDamageEventId"
          ],
          "spawn must backlink a Crystallize damage-event audit"
        );
      } else {
        for (const [field, expected] of [
          ["reaction", audit.reaction],
          ["element", audit.crystallizedElement],
          ["sourceActorId", trigger.sourceActorId],
          ["sourceTargetId", trigger.targetId],
          ["triggerFrame", trigger.frame],
          ["frame", audit.shardSpawnFrame],
          ["earliestPickupFrame", audit.earliestPickupFrame],
          ["expiresAtFrame", audit.shardExpiresAtFrame]
        ] as const) {
          expectEqual(
            context,
            ["crystallizeShardLog", rowIndex, field],
            row[field],
            expected,
            `Crystallize shard spawn ${field}`
          );
        }
      }
      const actor =
        row.sourceActorId === null
          ? undefined
          : actorById.get(row.sourceActorId);
      if (actor !== undefined) {
        expectEqual(
          context,
          [
            "crystallizeShardLog",
            rowIndex,
            "sourceCharacterLevel"
          ],
          row.sourceCharacterLevel,
          actor.level,
          "Crystallize shard source character level"
        );
        const expectedElementalMastery =
          replayCrystallizeSpawnElementalMastery(
            result,
            emBuffReplay,
            actor.id,
            row.timeSeconds
          );
        if (expectedElementalMastery !== undefined) {
          expectNearlyEqual(
            context,
            [
              "crystallizeShardLog",
              rowIndex,
              "sourceElementalMastery"
            ],
            row.sourceElementalMastery ?? Number.NaN,
            expectedElementalMastery,
            "Crystallize shard spawn-frame elemental mastery"
          );
        }
      }
      activeShards.set(row.shardId, row);
    } else if (row.shardId !== null) {
      const spawn = spawnByShardId.get(row.shardId);
      if (spawn === undefined) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "shardId"],
          `references shard ${row.shardId} before its spawn`
        );
      } else {
        for (const field of snapshotFields) {
          expectSemanticEqual(
            context,
            ["crystallizeShardLog", rowIndex, field],
            row[field],
            spawn[field],
            `Crystallize shard snapshot ${field}`
          );
        }
      }
    }
    if (row.operation === "pickup-attempt") {
      const command =
        row.pickupCommandIndex === null
          ? undefined
          : timeline?.commands[row.pickupCommandIndex];
      if (row.reason === "TOO_EARLY") {
        const active =
          row.shardId === null
            ? undefined
            : activeShards.get(row.shardId);
        if (
          active === undefined ||
          row.earliestPickupFrame === null ||
          row.frame >= row.earliestPickupFrame
        ) {
          addIssue(
            context,
            ["crystallizeShardLog", rowIndex, "reason"],
            "TOO_EARLY must reference an active shard before its earliest pickup frame"
          );
        }
      } else if (row.reason === "NO_MATCHING_SHARD") {
        const selector =
          command?.type === "pickUpCrystallize"
            ? command.element
            : row.element;
        const hasMatchingActiveShard = [...activeShards.values()].some(
          (shard) =>
            selector === "any" || shard.element === selector
        );
        if (
          row.shardId !== null ||
          hasMatchingActiveShard
        ) {
          addIssue(
            context,
            ["crystallizeShardLog", rowIndex, "reason"],
            "NO_MATCHING_SHARD requires no active shard matching the command selector"
          );
        }
      }
    } else if (row.operation === "pickup") {
      const active =
        row.shardId === null
          ? undefined
          : activeShards.get(row.shardId);
      if (
        active === undefined ||
        row.earliestPickupFrame === null ||
        row.frame < row.earliestPickupFrame
      ) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "operation"],
          "pickup must consume one active, pickup-ready shard"
        );
      } else {
        activeShards.delete(active.shardId!);
      }
    } else if (row.operation === "expire") {
      const active =
        row.shardId === null
          ? undefined
          : activeShards.get(row.shardId);
      if (
        active === undefined ||
        row.expiresAtFrame === null ||
        row.frame !== row.expiresAtFrame
      ) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "operation"],
          "expiry must terminate the active shard exactly at expiresAtFrame"
        );
      } else {
        activeShards.delete(active.shardId!);
      }
    } else if (row.operation === "evict") {
      const active =
        row.shardId === null
          ? undefined
          : activeShards.get(row.shardId);
      const oldest = [...activeShards.values()].sort(
        (left, right) =>
          (left.spawnedAtFrame ?? 0) -
            (right.spawnedAtFrame ?? 0) ||
          (left.shardId ?? 0) - (right.shardId ?? 0)
      )[0];
      const successor = result.crystallizeShardLog[rowIndex + 1];
      if (
        active === undefined ||
        activeShards.size !== 3 ||
        oldest?.shardId !== row.shardId ||
        successor?.operation !== "spawn" ||
        successor.frame !== row.frame
      ) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "operation"],
          "capacity eviction must remove the oldest of three active shards immediately before a same-frame spawn"
        );
      } else {
        activeShards.delete(active.shardId!);
      }
    }
    if (
      row.operation === "pickup" &&
      row.shieldLogId !== null
    ) {
      if (pickupByShieldLogId.has(row.shieldLogId)) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "shieldLogId"],
          `shield log ${row.shieldLogId} is linked by more than one pickup`
        );
      } else {
        pickupByShieldLogId.set(row.shieldLogId, row);
      }
      const shield = result.crystallizeShieldLog[row.shieldLogId];
      if (
        shield === undefined ||
        shield.id !== row.shieldLogId
      ) {
        addIssue(
          context,
          ["crystallizeShardLog", rowIndex, "shieldLogId"],
          `references missing shield log ${row.shieldLogId}`
        );
      } else {
        for (const [field, expected] of [
          ["shardId", row.shardId],
          ["element", row.element],
          ["sourceActorId", row.sourceActorId],
          ["pickedUpByActorId", row.pickedUpByActorId],
          [
            "sourceCharacterLevel",
            row.sourceCharacterLevel
          ],
          [
            "sourceElementalMastery",
            row.sourceElementalMastery
          ],
          ["frame", row.frame]
        ] as const) {
          expectEqual(
            context,
            ["crystallizeShieldLog", shield.id, field],
            shield[field],
            expected,
            `Crystallize pickup shield ${field}`
          );
        }
      }
    }
  }

  for (const active of activeShards.values()) {
    if (
      active.expiresAtFrame !== null &&
      active.expiresAtFrame <= runEndFrame
    ) {
      addIssue(
        context,
        [
          "crystallizeShardLog",
          active.id,
          "expiresAtFrame"
        ],
        "active shard is missing its in-range terminal expiry"
      );
    }
  }
  for (const [commandIndex, command] of
    (timeline?.commands ?? []).entries()) {
    if (command.type !== "pickUpCrystallize") continue;
    const commandResult = execution?.commandResults[commandIndex];
    const rows = pickupRowsByCommandIndex.get(commandIndex) ?? [];
    if (
      commandResult !== undefined &&
      commandResult.status !== "rejected" &&
      commandResult.startFrame !== null &&
      rows.length === 0
    ) {
      addIssue(
        context,
        [
          "timelineExecution",
          "commandResults",
          commandIndex
        ],
        "executed Crystallize pickup command must emit a pickup or pickup-attempt audit"
      );
    }
    if (
      (commandResult === undefined ||
        commandResult.status === "rejected") &&
      rows.length !== 0
    ) {
      addIssue(
        context,
        ["crystallizeShardLog"],
        `rejected or missing pickup command ${commandIndex} cannot own shard audit rows`
      );
    }
  }

  const shieldSnapshotFields = [
    "shieldId",
    "shardId",
    "element",
    "sourceActorId",
    "pickedUpByActorId",
    "sourceCharacterLevel",
    "sourceElementalMastery",
    "baseHp",
    "elementalMasteryBonus",
    "generalAbsorption",
    "matchingElementAbsorption",
    "geoDamageAbsorption",
    "expiresAtFrame"
  ] as const;
  let activeShield:
    | SimulationResult["crystallizeShieldLog"][number]
    | null = null;
  let nextShieldId = 0;
  const playerDamageById = new Map(
    result.playerDamageEvents.map((event) => [event.id, event])
  );
  if (
    result.crystallizeShieldTimeline.length !==
    result.crystallizeShieldLog.length
  ) {
    addIssue(
      context,
      ["crystallizeShieldTimeline"],
      "shield timeline must contain exactly one point per shield log row"
    );
  }
  for (const [shieldIndex, shield] of
    result.crystallizeShieldLog.entries()) {
    const spawn = spawnByShardId.get(shield.shardId);
    if (
      spawn === undefined ||
      spawn.element !== shield.element ||
      spawn.sourceActorId !== shield.sourceActorId
    ) {
      addIssue(
        context,
        ["crystallizeShieldLog", shieldIndex, "shardId"],
        "shield must backlink its source Crystallize shard"
      );
    }
    const creation =
      shield.operation === "add" ||
      shield.operation === "overwrite";
    const absorption =
      shield.operation === "absorb" ||
      shield.operation === "break";
    if (
      !absorption &&
      (shield.playerDamageEventId !== null ||
        shield.incomingElement !== null ||
        !nearlyEqual(shield.baseHpBeforeAbsorption, 0) ||
        !nearlyEqual(shield.baseHpConsumed, 0) ||
        !nearlyEqual(shield.baseHpAfterAbsorption, 0) ||
        !nearlyEqual(shield.absorbedDamage, 0) ||
        !nearlyEqual(shield.damageAfterShield, 0))
    ) {
      addIssue(
        context,
        [
          "crystallizeShieldLog",
          shieldIndex,
          "playerDamageEventId"
        ],
        "add/overwrite/expire rows cannot carry absorption provenance"
      );
    }
    if (creation) {
      const pickup = pickupByShieldLogId.get(shield.id);
      if (
        pickup === undefined ||
        pickup.shardId !== shield.shardId ||
        pickup.frame !== shield.frame
      ) {
        addIssue(
          context,
          ["crystallizeShieldLog", shieldIndex],
          "add/overwrite must be owned by exactly one same-frame shard pickup"
        );
      }
      if (shield.shieldId !== nextShieldId) {
        addIssue(
          context,
          ["crystallizeShieldLog", shieldIndex, "shieldId"],
          `new shield IDs must be contiguous; expected ${nextShieldId}`
        );
      }
      nextShieldId += 1;
      const expectedOperation =
        activeShield === null ? "add" : "overwrite";
      const expectedPreviousShieldId =
        activeShield?.shieldId ?? null;
      expectEqual(
        context,
        ["crystallizeShieldLog", shieldIndex, "operation"],
        shield.operation,
        expectedOperation,
        "Crystallize shield creation operation"
      );
      expectEqual(
        context,
        [
          "crystallizeShieldLog",
          shieldIndex,
          "previousShieldId"
        ],
        shield.previousShieldId,
        expectedPreviousShieldId,
        "Crystallize overwritten shield identity"
      );
      expectNearlyEqual(
        context,
        [
          "crystallizeShieldLog",
          shieldIndex,
          "currentBaseHp"
        ],
        shield.currentBaseHp,
        shield.baseHp,
        "new Crystallize shield base HP"
      );
      expectEqual(
        context,
        [
          "crystallizeShieldLog",
          shieldIndex,
          "expiresAtFrame"
        ],
        shield.expiresAtFrame,
        shield.frame + 906,
        "Crystallize shield expiry frame"
      );
      activeShield = shield;
    } else {
      if (activeShield === null) {
        addIssue(
          context,
          ["crystallizeShieldLog", shieldIndex, "shieldId"],
          `${shield.operation} cannot reference an inactive shield`
        );
      } else {
        for (const field of shieldSnapshotFields) {
          expectSemanticEqual(
            context,
            ["crystallizeShieldLog", shieldIndex, field],
            shield[field],
            activeShield[field],
            `Crystallize shield snapshot ${field}`
          );
        }
      }
      expectEqual(
        context,
        [
          "crystallizeShieldLog",
          shieldIndex,
          "previousShieldId"
        ],
        shield.previousShieldId,
        null,
        "non-creation shield previousShieldId"
      );
      if (
        shield.operation === "absorb" ||
        shield.operation === "break"
      ) {
        if (activeShield !== null) {
          expectNearlyEqual(
            context,
            [
              "crystallizeShieldLog",
              shieldIndex,
              "baseHpBeforeAbsorption"
            ],
            shield.baseHpBeforeAbsorption,
            activeShield.currentBaseHp,
            "shield base HP before absorption"
          );
        }
        expectNearlyEqual(
          context,
          [
            "crystallizeShieldLog",
            shieldIndex,
            "baseHpAfterAbsorption"
          ],
          shield.baseHpAfterAbsorption,
          shield.baseHpBeforeAbsorption -
            shield.baseHpConsumed,
          "shield absorption conservation"
        );
        expectNearlyEqual(
          context,
          [
            "crystallizeShieldLog",
            shieldIndex,
            "currentBaseHp"
          ],
          shield.currentBaseHp,
          shield.baseHpAfterAbsorption,
          "shield current base HP after absorption"
        );
        const expectedOperation = nearlyEqual(
          shield.baseHpAfterAbsorption,
          0
        )
          ? "break"
          : "absorb";
        expectEqual(
          context,
          [
            "crystallizeShieldLog",
            shieldIndex,
            "operation"
          ],
          shield.operation,
          expectedOperation,
          "shield absorption terminal operation"
        );
        const playerDamage =
          shield.playerDamageEventId === null
            ? undefined
            : playerDamageById.get(
                shield.playerDamageEventId
              );
        const resolution = playerDamage?.shieldResolution;
        if (
          playerDamage === undefined ||
          resolution === undefined ||
          playerDamage.frame !== shield.frame ||
          playerDamage.eventPriority !== shield.eventPriority ||
          playerDamage.eventSequence !== shield.eventSequence ||
          resolution.shieldId !== shield.shieldId ||
          resolution.incomingElement !== shield.incomingElement ||
          !nearlyEqual(
            resolution.baseHpBefore,
            shield.baseHpBeforeAbsorption
          ) ||
          !nearlyEqual(
            resolution.baseHpConsumed,
            shield.baseHpConsumed
          ) ||
          !nearlyEqual(
            resolution.baseHpAfter,
            shield.baseHpAfterAbsorption
          ) ||
          !nearlyEqual(
            resolution.absorbedDamage,
            shield.absorbedDamage
          ) ||
          !nearlyEqual(
            resolution.damageAfterShield,
            shield.damageAfterShield
          )
        ) {
          addIssue(
            context,
            [
              "crystallizeShieldLog",
              shieldIndex,
              "playerDamageEventId"
            ],
            "shield absorption must exactly project its player damage event"
          );
        }
        activeShield =
          shield.operation === "break" ? null : shield;
      } else if (shield.operation === "expire") {
        if (
          activeShield === null ||
          shield.frame !== activeShield.expiresAtFrame ||
          !nearlyEqual(shield.currentBaseHp, 0)
        ) {
          addIssue(
            context,
            ["crystallizeShieldLog", shieldIndex, "operation"],
            "expiry must terminate the active shield exactly at its expiry frame"
          );
        }
        activeShield = null;
      }
    }
    const expectedShield = calcCrystallizeShield(
      shield.sourceCharacterLevel,
      shield.sourceElementalMastery
    );
    for (const [field, expected] of [
      ["baseHp", expectedShield.baseHp],
      [
        "elementalMasteryBonus",
        expectedShield.elementalMasteryBonus
      ],
      ["generalAbsorption", expectedShield.generalAbsorption],
      [
        "matchingElementAbsorption",
        expectedShield.matchingElementAbsorption
      ],
      [
        "geoDamageAbsorption",
        expectedShield.geoDamageAbsorption
      ]
    ] as const) {
      expectNearlyEqual(
        context,
        ["crystallizeShieldLog", shieldIndex, field],
        shield[field],
        expected,
        `Crystallize shield formula ${field}`
      );
    }
    /*
     * Keep these local conservation checks explicit as well: they make any
     * future formula-version change fail closed even if only one derived
     * projection is updated.
     */
    expectNearlyEqual(
      context,
      [
        "crystallizeShieldLog",
        shieldIndex,
        "elementalMasteryBonus"
      ],
      shield.elementalMasteryBonus,
      expectedShield.elementalMasteryBonus,
      "Crystallize shield EM bonus"
    );
    expectNearlyEqual(
      context,
      [
        "crystallizeShieldLog",
        shieldIndex,
        "generalAbsorption"
      ],
      shield.generalAbsorption,
      shield.baseHp * (1 + shield.elementalMasteryBonus),
      "Crystallize general absorption"
    );
    expectNearlyEqual(
      context,
      [
        "crystallizeShieldLog",
        shieldIndex,
        "matchingElementAbsorption"
      ],
      shield.matchingElementAbsorption,
      shield.generalAbsorption * 2.5,
      "Crystallize matching-element absorption"
    );
    expectNearlyEqual(
      context,
      [
        "crystallizeShieldLog",
        shieldIndex,
        "geoDamageAbsorption"
      ],
      shield.geoDamageAbsorption,
      shield.generalAbsorption * 1.5,
      "Crystallize Geo absorption"
    );

    const point = result.crystallizeShieldTimeline[shieldIndex];
    if (point === undefined) continue;
    for (const [field, expected] of [
      ["frame", shield.frame],
      ["timeSeconds", shield.timeSeconds],
      ["eventPriority", shield.eventPriority],
      ["eventSequence", shield.eventSequence],
      ["operation", shield.operation],
      ["playerDamageEventId", shield.playerDamageEventId],
      [
        "baseHpBeforeAbsorption",
        shield.baseHpBeforeAbsorption
      ],
      [
        "baseHpAfterAbsorption",
        shield.baseHpAfterAbsorption
      ],
      ["absorbedDamage", shield.absorbedDamage],
      ["damageAfterShield", shield.damageAfterShield]
    ] as const) {
      expectEqual(
        context,
        ["crystallizeShieldTimeline", shieldIndex, field],
        point[field],
        expected,
        `Crystallize shield timeline ${field}`
      );
    }
    expectEqual(
      context,
      [
        "crystallizeShieldTimeline",
        shieldIndex,
        "intraEventSequence"
      ],
      point.intraEventSequence,
      shield.intraEventSequence + 1,
      "Crystallize shield timeline intra-event order"
    );
    const shieldSurvives =
      shield.operation === "add" ||
      shield.operation === "overwrite" ||
      shield.operation === "absorb";
    expectEqual(
      context,
      ["crystallizeShieldTimeline", shieldIndex, "shieldId"],
      point.shieldId,
      shieldSurvives ? shield.shieldId : null,
      "Crystallize shield timeline active shield"
    );
    expectEqual(
      context,
      ["crystallizeShieldTimeline", shieldIndex, "element"],
      point.element,
      shieldSurvives ? shield.element : null,
      "Crystallize shield timeline active element"
    );
    expectEqual(
      context,
      [
        "crystallizeShieldTimeline",
        shieldIndex,
        "expiresAtFrame"
      ],
      point.expiresAtFrame,
      shieldSurvives ? shield.expiresAtFrame : null,
      "Crystallize shield timeline expiry"
    );
    expectNearlyEqual(
      context,
      [
        "crystallizeShieldTimeline",
        shieldIndex,
        "generalAbsorption"
      ],
      point.generalAbsorption,
      shieldSurvives
        ? shield.currentBaseHp *
            (1 + shield.elementalMasteryBonus)
        : 0,
      "Crystallize shield timeline remaining absorption"
    );
  }
  if (
    activeShield !== null &&
    activeShield.expiresAtFrame <= runEndFrame
  ) {
    addIssue(
      context,
      [
        "crystallizeShieldLog",
        activeShield.id,
        "expiresAtFrame"
      ],
      "active shield is missing its in-range expiry"
    );
  }
}

function validateBurningStateProjection(
  result: SimulationResult,
  context: RefinementCtx
): void {
  type QuickenStateRow =
    SimulationResult["quickenStateLog"][number];
  type TargetStatePoint =
    SimulationResult["targetStateTimeline"]["points"][number];
  type BurningReactionAudit = NonNullable<
    SimulationResult["damageEvents"][number]["reactionAudit"]["burningReaction"]
  >;
  type BurningQuickenMutation =
    BurningReactionAudit["quickenStateMutation"];
  type CatalyzeQuickenAudit = NonNullable<
    NonNullable<
      SimulationResult["damageEvents"][number]["reactionAudit"]["catalyzeReaction"]
    >["quicken"]
  >;
  type BloomReactionAudit =
    SimulationResult["damageEvents"][number]["reactionAudit"]["bloomReactions"][number];
  type BurningQuickenOwner = {
    eventIndex: number;
    applicationPointId: number;
  };
  type BurningClockCut = {
    frame: number;
    eventPriority: number;
    eventSequence: number;
  };
  type BurningClockState = {
    globalFrame: number;
    targetFrame: number;
    frozenFrames: number;
  };

  const usesTargetHitlagClock =
    result.config.targetClockModel.mode ===
    "target-local-hitlag-v1";
  const appliedHitlagByTarget = new Map<
    string,
    SimulationResult["targetHitlagLog"]
  >();
  if (usesTargetHitlagClock) {
    // This is deliberately a minimal result-side replay over the already
    // validated Hitlag log. It closes coordinated Burning deadline drift, but
    // it is not the final config-root provenance link from haltFrames/factor
    // on an ability hit to the emitted Hitlag row.
    for (const hitlag of result.targetHitlagLog) {
      if (!hitlag.applied || hitlag.extensionFrames <= 0) continue;
      const rows = appliedHitlagByTarget.get(hitlag.targetId) ?? [];
      rows.push(hitlag);
      appliedHitlagByTarget.set(hitlag.targetId, rows);
    }
    for (const rows of appliedHitlagByTarget.values()) {
      rows.sort(
        (left, right) =>
          left.globalFrame - right.globalFrame ||
          left.eventPriority - right.eventPriority ||
          left.eventSequence - right.eventSequence ||
          left.intraEventSequence - right.intraEventSequence ||
          left.id - right.id
      );
    }
  }

  const hitlagStrictlyPrecedesBurningCut = (
    hitlag: SimulationResult["targetHitlagLog"][number],
    cut: BurningClockCut
  ): boolean =>
    hitlag.globalFrame < cut.frame ||
    (hitlag.globalFrame === cut.frame &&
      (hitlag.eventPriority < cut.eventPriority ||
        (hitlag.eventPriority === cut.eventPriority &&
          hitlag.eventSequence < cut.eventSequence)));

  const advanceBurningClock = (
    state: BurningClockState,
    globalFrame: number
  ): BurningClockState => {
    const elapsed = globalFrame - state.globalFrame;
    const consumedFrozenFrames = Math.min(
      elapsed,
      state.frozenFrames
    );
    return {
      globalFrame,
      targetFrame:
        state.targetFrame + elapsed - consumedFrozenFrames,
      frozenFrames: state.frozenFrames - consumedFrozenFrames
    };
  };

  const burningClockStateAtCut = (
    targetId: string,
    cut: BurningClockCut
  ): BurningClockState => {
    let state: BurningClockState = {
      globalFrame: 0,
      targetFrame: 0,
      frozenFrames: 0
    };
    for (const hitlag of appliedHitlagByTarget.get(targetId) ?? []) {
      if (!hitlagStrictlyPrecedesBurningCut(hitlag, cut)) break;
      state = advanceBurningClock(state, hitlag.globalFrame);
      state = {
        ...state,
        frozenFrames: state.frozenFrames + hitlag.extensionFrames
      };
    }
    return advanceBurningClock(state, cut.frame);
  };

  const burningClockStateAtEndOfPreviousGlobalFrame = (
    targetId: string,
    globalFrame: number
  ): BurningClockState =>
    globalFrame === 0
      ? {
          globalFrame: 0,
          targetFrame: 0,
          frozenFrames: 0
        }
      : burningClockStateAtCut(targetId, {
          frame: globalFrame - 1,
          eventPriority: Number.MAX_SAFE_INTEGER,
          eventSequence: Number.MAX_SAFE_INTEGER
        });

  const validateBurningGlobalDeadline = (
    state: BurningClockState,
    globalDeadline: number | null,
    targetDeadline: number | null | undefined,
    path: IssuePath,
    label: string
  ): void => {
    if (!usesTargetHitlagClock) return;
    if (targetDeadline === undefined) {
      addIssue(
        context,
        path,
        `${label} requires its target-local deadline`
      );
      return;
    }
    if (targetDeadline === null) {
      expectEqual(context, path, globalDeadline, null, label);
      return;
    }
    const expectedGlobalDeadline =
      targetDeadline <= state.targetFrame
        ? state.globalFrame
        : state.globalFrame +
          state.frozenFrames +
          targetDeadline -
          state.targetFrame;
    expectEqual(
      context,
      path,
      globalDeadline,
      expectedGlobalDeadline,
      label
    );
  };

  const damageEventById = new Map(
    result.damageEvents.map((event) => [event.id, event])
  );
  const reactionDamageById = new Map(
    result.reactionDamageLog.map((entry) => [entry.id, entry])
  );
  const enemyTargetById = new Map(
    result.enemyTargets.map((target) => [target.id, target])
  );
  const v3ApplicationPhaseByDamageEventId = new Map<
    number,
    "before-reactable-tick" | "after-reactable-tick"
  >();
  for (const phase of result.targetPhaseLog) {
    if (phase.model !== "target-phase-v3") continue;
    for (const task of phase.targetTasks) {
      for (const attempt of task.delivery?.attempts ?? []) {
        if (
          attempt.outcome === "landed" &&
          attempt.damageEventId !== null
        ) {
          v3ApplicationPhaseByDamageEventId.set(
            attempt.damageEventId,
            attempt.applicationPhase
          );
        }
      }
    }
  }
  const burningTickByReactionDamageId = new Map<
    number,
    SimulationResult["burningStateLog"]
  >();
  const rowsByTrigger = new Map<
    number,
    SimulationResult["burningStateLog"]
  >();
  const burningAuditOwnedRowIds = new Set<number>();
  const authoritativeBurningStopRowIds = new Set<number>();
  const lifecyclePointByBurningStateId = new Map<
    number,
    SimulationResult["targetStateTimeline"]["points"]
  >();
  const targetTaskPhasesByBurningStateId = new Map<
    number,
    SimulationResult["targetTaskPhaseLog"]
  >();
  const applicationPointsByDamageEventId = new Map<
    number,
    TargetStatePoint[]
  >();
  const quickenTimelinePointsByRowId = new Map<
    number,
    TargetStatePoint[]
  >();
  const burningQuickenRowsByTarget = new Map<
    string,
    Map<number, QuickenStateRow[]>
  >();
  const burningQuickenOwnersByRowId = new Map<
    number,
    BurningQuickenOwner[]
  >();
  const quickenStateById = new Map(
    result.quickenStateLog.map((row) => [row.id, row])
  );
  for (const point of result.targetStateTimeline.points) {
    if (
      (point.cause === "direct-hit-application" ||
        point.cause === "reaction-damage-application") &&
      point.primaryDamageEventId !== null
    ) {
      const points =
        applicationPointsByDamageEventId.get(
          point.primaryDamageEventId
        ) ?? [];
      points.push(point);
      applicationPointsByDamageEventId.set(
        point.primaryDamageEventId,
        points
      );
    }
    for (const link of point.links) {
      if (link.kind === "burning-state-log") {
        const points =
          lifecyclePointByBurningStateId.get(link.id) ?? [];
        points.push(point);
        lifecyclePointByBurningStateId.set(link.id, points);
      } else if (link.kind === "quicken-state-log") {
        // Preserve one entry per link occurrence. This lets the reverse
        // ownership check reject a duplicated link even when both copies sit
        // on the same target-state point.
        const points =
          quickenTimelinePointsByRowId.get(link.id) ?? [];
        points.push(point);
        quickenTimelinePointsByRowId.set(link.id, points);
      }
    }
  }
  for (const row of result.quickenStateLog) {
    if (row.reason !== "BURNING_REBASED_QUICKEN_DECAY") {
      continue;
    }
    let rowsByFrame = burningQuickenRowsByTarget.get(
      row.targetId
    );
    if (rowsByFrame === undefined) {
      rowsByFrame = new Map();
      burningQuickenRowsByTarget.set(row.targetId, rowsByFrame);
    }
    const rows = rowsByFrame.get(row.frame) ?? [];
    rows.push(row);
    rowsByFrame.set(row.frame, rows);
  }
  const burningQuickenRowMatchesMutation = (
    row: QuickenStateRow,
    mutation: BurningQuickenMutation,
    event: SimulationResult["damageEvents"][number],
    applicationPoint: TargetStatePoint
  ): boolean => {
    const quickenBefore =
      mutation.operationAuraBefore.find(
        (entry) => entry.element === "quicken"
      );
    const quickenAfter =
      mutation.operationAuraAfter.find(
        (entry) => entry.element === "quicken"
      );
    const expectedTargetExpiryBefore =
      quickenBefore?.expiresAtTargetFrame ??
      mutation.expiresAtFrameBefore;
    const expectedTargetExpiryAfter =
      quickenAfter?.expiresAtTargetFrame ??
      mutation.expiresAtFrameAfter;
    return (
      row.reaction === "quicken" &&
      row.reason === "BURNING_REBASED_QUICKEN_DECAY" &&
      row.operation === "decay-rebase" &&
      row.generation === mutation.generationAfter &&
      row.frame === event.frame &&
      nearlyEqual(row.timeSeconds, event.timeSeconds) &&
      (row.targetFrame ?? row.frame) ===
        (applicationPoint.targetFrame ?? applicationPoint.frame) &&
      row.targetId === event.targetId &&
      row.targetName === event.targetName &&
      row.triggerElement === null &&
      row.consumedAuraElement === null &&
      nearlyEqual(row.candidateGaugeUnits, 0) &&
      nearlyEqual(
        row.quickenGaugeUnitsBefore,
        mutation.quickenGaugeUnitsBefore
      ) &&
      nearlyEqual(
        row.quickenGaugeUnitsAfter,
        mutation.quickenGaugeUnitsAfter
      ) &&
      nearlyEqual(
        row.decayPerFrameBefore,
        mutation.decayPerFrameBefore
      ) &&
      nearlyEqual(
        row.decayPerFrameAfter,
        mutation.decayPerFrameAfter
      ) &&
      row.expiresAtFrameBefore ===
        mutation.expiresAtFrameBefore &&
      row.expiresAtFrame === mutation.expiresAtFrameAfter &&
      (row.expiresAtTargetFrameBefore ??
        row.expiresAtFrameBefore) ===
        expectedTargetExpiryBefore &&
      (row.expiresAtTargetFrame ?? row.expiresAtFrame) ===
        expectedTargetExpiryAfter &&
      row.endCauseBefore === mutation.endCauseBefore &&
      row.endCauseAfter === mutation.endCauseAfter &&
      auraStateProjectionEqual(
        row.auraBefore,
        mutation.operationAuraBefore
      ) &&
      auraStateProjectionEqual(
        row.auraAfter,
        mutation.operationAuraAfter
      )
    );
  };
  const quickenRowMatchesApplicationContext = (
    row: QuickenStateRow,
    event: SimulationResult["damageEvents"][number],
    applicationPoint: TargetStatePoint
  ): boolean =>
    row.frame === event.frame &&
    nearlyEqual(row.timeSeconds, event.timeSeconds) &&
    (row.targetFrame ?? row.frame) ===
      (applicationPoint.targetFrame ?? applicationPoint.frame) &&
    row.targetId === event.targetId &&
    row.targetName === event.targetName;
  const quickenRowMatchesCatalyzeAudit = (
    row: QuickenStateRow,
    audit: CatalyzeQuickenAudit,
    event: SimulationResult["damageEvents"][number],
    applicationPoint: TargetStatePoint
  ): boolean => {
    const beforeQuicken = audit.operationAuraBefore.find(
      (entry) => entry.element === "quicken"
    );
    const afterQuicken = audit.operationAuraAfter.find(
      (entry) => entry.element === "quicken"
    );
    const expectedReason =
      audit.operation === "unchanged"
        ? "WEAKER_QUICKEN_DID_NOT_REFRESH"
        : audit.operation === "start"
          ? "QUICKEN_STARTED"
          : "QUICKEN_REFRESHED";
    return (
      quickenRowMatchesApplicationContext(
        row,
        event,
        applicationPoint
      ) &&
      row.reaction === "quicken" &&
      row.generation === audit.generation &&
      row.operation === audit.operation &&
      row.sourceActorId === event.sourceActorId &&
      row.triggerDamageEventId === event.id &&
      row.triggerElement === audit.triggerElement &&
      row.consumedAuraElement === audit.consumedAuraElement &&
      nearlyEqual(
        row.candidateGaugeUnits,
        audit.candidateGaugeUnits
      ) &&
      nearlyEqual(
        row.quickenGaugeUnitsBefore,
        audit.quickenGaugeUnitsBefore
      ) &&
      nearlyEqual(
        row.quickenGaugeUnitsAfter,
        audit.quickenGaugeUnitsAfter
      ) &&
      nearlyEqual(
        row.decayPerFrameBefore,
        audit.decayPerFrameBefore
      ) &&
      nearlyEqual(row.decayPerFrameAfter, audit.decayPerFrame) &&
      row.expiresAtFrameBefore === audit.expiresAtFrameBefore &&
      row.expiresAtFrame === audit.expiresAtFrame &&
      (row.expiresAtTargetFrameBefore ??
        row.expiresAtFrameBefore) ===
        (beforeQuicken?.expiresAtTargetFrame ??
          audit.expiresAtFrameBefore) &&
      (row.expiresAtTargetFrame ?? row.expiresAtFrame) ===
        (afterQuicken?.expiresAtTargetFrame ??
          audit.expiresAtFrame) &&
      row.endCauseBefore === audit.endCauseBefore &&
      row.endCauseAfter === audit.endCause &&
      row.reason === expectedReason &&
      auraStateProjectionEqual(
        row.auraBefore,
        audit.operationAuraBefore
      ) &&
      auraStateProjectionEqual(
        row.auraAfter,
        audit.operationAuraAfter
      )
    );
  };
  const quickenRowMatchesBloomAudit = (
    row: QuickenStateRow,
    audit: BloomReactionAudit,
    event: SimulationResult["damageEvents"][number],
    applicationPoint: TargetStatePoint
  ): boolean => {
    const mutation = audit.quickenStateMutation;
    const beforeQuicken = mutation.operationAuraBefore.find(
      (entry) => entry.element === "quicken"
    );
    const afterQuicken = mutation.operationAuraAfter.find(
      (entry) => entry.element === "quicken"
    );
    const expectedReason =
      mutation.operation === "partial-consume"
        ? "BLOOM_PARTIALLY_CONSUMED_QUICKEN"
        : mutation.operation === "decay-rebase"
          ? "BLOOM_REBASED_QUICKEN_DECAY"
          : "BLOOM_REMOVED_QUICKEN";
    return (
      mutation.operation !== "none" &&
      quickenRowMatchesApplicationContext(
        row,
        event,
        applicationPoint
      ) &&
      row.reaction === "quicken" &&
      row.generation === mutation.generationAfter &&
      row.operation === mutation.operation &&
      row.triggerDamageEventId === event.id &&
      row.triggerElement === null &&
      row.consumedAuraElement === null &&
      nearlyEqual(row.candidateGaugeUnits, 0) &&
      nearlyEqual(
        row.quickenGaugeUnitsBefore,
        audit.quickenGaugeUnitsBefore
      ) &&
      nearlyEqual(
        row.quickenGaugeUnitsAfter,
        audit.quickenGaugeUnitsAfter
      ) &&
      nearlyEqual(
        row.decayPerFrameBefore,
        mutation.decayPerFrameBefore
      ) &&
      nearlyEqual(
        row.decayPerFrameAfter,
        mutation.decayPerFrameAfter
      ) &&
      row.expiresAtFrameBefore ===
        mutation.expiresAtFrameBefore &&
      row.expiresAtFrame === mutation.expiresAtFrameAfter &&
      (row.expiresAtTargetFrameBefore ??
        row.expiresAtFrameBefore) ===
        (beforeQuicken?.expiresAtTargetFrame ??
          mutation.expiresAtFrameBefore) &&
      (row.expiresAtTargetFrame ?? row.expiresAtFrame) ===
        (afterQuicken?.expiresAtTargetFrame ??
          mutation.expiresAtFrameAfter) &&
      row.endCauseBefore === mutation.endCauseBefore &&
      row.endCauseAfter === mutation.endCauseAfter &&
      row.reason === expectedReason &&
      auraStateProjectionEqual(
        row.auraBefore,
        mutation.operationAuraBefore
      ) &&
      auraStateProjectionEqual(
        row.auraAfter,
        mutation.operationAuraAfter
      )
    );
  };
  const resolveAuthoritativeQuickenSourceBefore = (
    exclusiveRowId: number,
    targetId: string
  ): {
    sourceActorId: string;
    triggerDamageEventId: number;
  } | null => {
    let activeSource: {
      sourceActorId: string;
      triggerDamageEventId: number;
    } | null = null;
    for (const row of result.quickenStateLog) {
      if (row.id >= exclusiveRowId) break;
      if (row.targetId !== targetId) continue;
      if (row.operation === "start" || row.operation === "refresh") {
        const trigger =
          row.triggerDamageEventId === null
            ? undefined
            : damageEventById.get(row.triggerDamageEventId);
        const triggerPoint =
          trigger === undefined
            ? undefined
            : (applicationPointsByDamageEventId.get(trigger.id) ?? [])[0];
        const triggerAudit =
          trigger?.reactionAudit.catalyzeReaction?.quicken;
        activeSource =
          trigger !== undefined &&
          triggerPoint !== undefined &&
          triggerAudit !== null &&
          triggerAudit !== undefined &&
          quickenRowMatchesCatalyzeAudit(
            row,
            triggerAudit,
            trigger,
            triggerPoint
          )
            ? {
                sourceActorId: trigger.sourceActorId,
                triggerDamageEventId: trigger.id
              }
            : null;
      } else if (row.operation === "partial-consume") {
        const trigger =
          row.triggerDamageEventId === null
            ? undefined
            : damageEventById.get(row.triggerDamageEventId);
        const triggerPoint =
          trigger === undefined
            ? undefined
            : (applicationPointsByDamageEventId.get(trigger.id) ?? [])[0];
        const ownsBloomMutation: boolean =
          activeSource !== null &&
          trigger !== undefined &&
          triggerPoint !== undefined &&
          trigger.reactionAudit.bloomReactions.filter((bloom) =>
            quickenRowMatchesBloomAudit(
              row,
              bloom,
              trigger,
              triggerPoint
            )
          ).length === 1;
        activeSource = ownsBloomMutation
          ? {
              sourceActorId: activeSource!.sourceActorId,
              triggerDamageEventId: trigger!.id
            }
          : null;
      } else if (
        row.operation === "remove" ||
        row.operation === "expire"
      ) {
        activeSource = null;
      }
      // unchanged and decay-rebase preserve the already-authoritative source.
    }
    return activeSource;
  };
  for (const phase of result.targetTaskPhaseLog) {
    for (const burningStateLogId of phase.burningStateLogIds) {
      const phases =
        targetTaskPhasesByBurningStateId.get(
          burningStateLogId
        ) ?? [];
      phases.push(phase);
      targetTaskPhasesByBurningStateId.set(
        burningStateLogId,
        phases
      );
    }
  }
  for (const row of result.burningStateLog) {
    if (row.triggerDamageEventId !== null) {
      const rows = rowsByTrigger.get(row.triggerDamageEventId) ?? [];
      rows.push(row);
      rowsByTrigger.set(row.triggerDamageEventId, rows);
    }
    if (row.reactionDamageLogId !== null) {
      const rows =
        burningTickByReactionDamageId.get(
          row.reactionDamageLogId
        ) ?? [];
      rows.push(row);
      burningTickByReactionDamageId.set(
        row.reactionDamageLogId,
        rows
      );
    }
  }

  const orderedBurningRows = [...result.burningStateLog].sort(
    (left, right) =>
      left.frame - right.frame ||
      left.eventPriority - right.eventPriority ||
      left.eventSequence - right.eventSequence ||
      left.id - right.id
  );
  const replayBurningBeforeEventCut = (
    event: SimulationResult["damageEvents"][number]
  ): {
    activeGeneration: number | null;
    nextStartGeneration: number;
  } => {
    let activeGeneration: number | null = null;
    let materializedStartCount = 0;
    for (const row of orderedBurningRows) {
      if (row.targetId !== event.targetId) continue;
      const beforeEventCut =
        row.frame < event.frame ||
        (row.frame === event.frame &&
          (row.eventPriority < event.eventPriority ||
            (row.eventPriority === event.eventPriority &&
              row.eventSequence < event.eventSequence)));
      if (!beforeEventCut) continue;
      if (row.operation === "start") {
        materializedStartCount += 1;
        activeGeneration = row.generation;
      } else if (
        row.operation === "stop" ||
        row.operation === "fuel-expire"
      ) {
        activeGeneration = null;
      }
    }
    return {
      activeGeneration,
      nextStartGeneration: materializedStartCount * 2 + 1
    };
  };

  for (const [eventIndex, event] of
    result.damageEvents.entries()) {
    const audit = event.reactionAudit.burningReaction;
    const isBurningDamageIdentity =
      event.kind === "transformative-reaction" &&
      event.transformativeReactionFactors?.reaction === "burning";
    const burningMarkerBefore =
      event.reactionAudit.auraBefore?.some(
        (entry) =>
          entry.element === "burning" &&
          entry.gaugeUnits > AURA_GAUGE_EPSILON
      ) ?? false;
    const burningFuelBefore =
      event.reactionAudit.auraBefore?.some(
        (entry) =>
          entry.element === "burningFuel" &&
          entry.gaugeUnits > AURA_GAUGE_EPSILON
      ) ?? false;
    const burningMarkerAfter =
      event.reactionAudit.auraAfter?.some(
        (entry) =>
          entry.element === "burning" &&
          entry.gaugeUnits > AURA_GAUGE_EPSILON
      ) ?? false;
    const burningFuelAfter =
      event.reactionAudit.auraAfter?.some(
        (entry) =>
          entry.element === "burningFuel" &&
          entry.gaugeUnits > AURA_GAUGE_EPSILON
      ) ?? false;
    if (
      audit === null &&
      !isBurningDamageIdentity &&
      (event.reactionAudit.reaction === "burning" ||
        event.reactionAudit.reactions.includes("burning"))
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "burningReaction"
        ],
        "a parent reaction audit that reports Burning requires its Burning lifecycle audit"
      );
    }
    if (
      audit === null &&
      burningMarkerBefore &&
      burningFuelBefore &&
      (!burningMarkerAfter || !burningFuelAfter)
    ) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "burningReaction"
        ],
        "a hit that removes active Burning requires its Burning stop audit"
      );
    }
    if (audit === null) continue;
    const auditPath = [
      "damageEvents",
      eventIndex,
      "reactionAudit",
      "burningReaction"
    ] satisfies IssuePath;
    const expectedClockModel =
      result.config.targetClockModel.mode ===
      "target-local-hitlag-v1"
        ? "target-local-hitlag-v1"
        : "target-local-no-hitlag";
    const expectedHitlagStatus =
      result.config.targetClockModel.mode ===
      "target-local-hitlag-v1"
        ? "modeled-enemy-hitlag"
        : "unsupported-enemy-hitlag";
    expectFieldEqual(
      context,
      auditPath,
      "clockModel",
      audit.clockModel,
      expectedClockModel,
      "Burning clock model"
    );
    expectFieldEqual(
      context,
      auditPath,
      "hitlagStatus",
      audit.hitlagStatus,
      expectedHitlagStatus,
      "Burning Hitlag status"
    );
    if (audit.operation !== "stop") {
      expectFieldEqual(
        context,
        auditPath,
        "damageSourceActorId",
        audit.damageSourceActorId,
        event.sourceActorId,
        "Burning snapshot damage source"
      );
    }
    if (audit.operation === "start") {
      const burningReactionCount =
        event.reactionAudit.reactions.filter(
          (reaction) => reaction === "burning"
        ).length;
      if (
        !event.reactionAudit.triggered ||
        event.reactionAudit.reaction === "none" ||
        burningReactionCount !== 1
      ) {
        addIssue(
          context,
          auditPath,
          "Burning start requires the parent reaction audit to report one triggered Burning reaction"
        );
      }
    }
    expectFieldEqual(
      context,
      auditPath,
      "triggerElement",
      audit.triggerElement,
      event.element,
      "Burning trigger element"
    );
    expectFieldEqual(
      context,
      auditPath,
      "snapshotFrame",
      audit.snapshotFrame,
      event.frame,
      "Burning snapshot frame"
    );
    if (usesTargetHitlagClock) {
      const auditClockState = burningClockStateAtCut(event.targetId, {
        frame: event.frame,
        eventPriority: event.eventPriority,
        eventSequence: event.eventSequence
      });
      const applicationPhase =
        v3ApplicationPhaseByDamageEventId.get(event.id);
      const expectedSnapshotTargetFrame =
        applicationPhase === "before-reactable-tick"
          ? burningClockStateAtEndOfPreviousGlobalFrame(
              event.targetId,
              event.frame
            ).targetFrame
          : auditClockState.targetFrame;
      expectFieldEqual(
        context,
        auditPath,
        "snapshotTargetFrame",
        audit.snapshotTargetFrame,
        expectedSnapshotTargetFrame,
        "Burning audit snapshot target frame"
      );
      validateBurningGlobalDeadline(
        auditClockState,
        audit.fuelExpiresAtFrame,
        audit.fuelExpiresAtTargetFrame,
        [...auditPath, "fuelExpiresAtFrame"],
        "Burning audit Fuel global deadline target-clock projection"
      );
      validateBurningGlobalDeadline(
        auditClockState,
        audit.firstTickFrame,
        audit.firstTickTargetFrame,
        [...auditPath, "firstTickFrame"],
        "Burning audit first Tick global deadline target-clock projection"
      );
      validateBurningGlobalDeadline(
        auditClockState,
        audit.nextTickFrame,
        audit.nextTickTargetFrame,
        [...auditPath, "nextTickFrame"],
        "Burning audit next Tick global deadline target-clock projection"
      );
    }
    expectFieldNearlyEqual(
      context,
      auditPath,
      "fuelDecayPerFrame",
      audit.fuelDecayPerFrame,
      BURNING_FUEL_DECAY_PER_FRAME,
      "Burning mechanics Fuel decay"
    );
    expectFieldNearlyEqual(
      context,
      auditPath,
      "tickIntervalFrames",
      audit.tickIntervalFrames,
      BURNING_TICK_INTERVAL_FRAMES,
      "Burning mechanics tick interval"
    );
    expectFieldNearlyEqual(
      context,
      auditPath,
      "skippedTickIndex",
      audit.skippedTickIndex,
      BURNING_SKIPPED_TICK_INDEX,
      "Burning mechanics skipped tick index"
    );
    expectFieldNearlyEqual(
      context,
      auditPath,
      "baseMultiplier",
      audit.baseMultiplier,
      0.25,
      "Burning mechanics base multiplier"
    );
    expectFieldNearlyEqual(
      context,
      auditPath,
      "radius",
      audit.radius,
      1,
      "Burning mechanics radius"
    );
    expectFieldNearlyEqual(
      context,
      auditPath,
      "applicationGaugeUnits",
      audit.applicationGaugeUnits,
      BURNING_APPLICATION_GAUGE_UNITS,
      "Burning mechanics application Gauge"
    );
    expectFieldEqual(
      context,
      auditPath,
      "damageElement",
      audit.damageElement,
      "pyro",
      "Burning damage element"
    );

    if (audit.operation === "stop") {
      expectFieldNearlyEqual(
        context,
        auditPath,
        "candidateBurningGaugeUnits",
        audit.candidateBurningGaugeUnits,
        0,
        "Burning stop candidate marker"
      );
      expectFieldNearlyEqual(
        context,
        auditPath,
        "candidateFuelGaugeUnits",
        audit.candidateFuelGaugeUnits,
        0,
        "Burning stop candidate Fuel"
      );
      expectFieldNearlyEqual(
        context,
        auditPath,
        "fuelGaugeUnitsAfter",
        audit.fuelGaugeUnitsAfter,
        0,
        "Burning stop Fuel"
      );
    } else {
      expectFieldNearlyEqual(
        context,
        auditPath,
        "candidateBurningGaugeUnits",
        audit.candidateBurningGaugeUnits,
        BURNING_MARKER_GAUGE_UNITS,
        "Burning candidate marker"
      );
    }
    if (audit.operation !== "stop" && audit.blockedReason === null) {
      if (
        audit.operation === "start" ||
        audit.operation === "refresh-fuel"
      ) {
        expectFieldNearlyEqual(
          context,
          auditPath,
          "candidateFuelGaugeUnits",
          audit.candidateFuelGaugeUnits,
          audit.fuelGaugeUnitsAfter,
          "Burning attached Fuel candidate"
        );
      } else {
        expectFieldNearlyEqual(
          context,
          auditPath,
          "candidateFuelGaugeUnits",
          audit.candidateFuelGaugeUnits,
          audit.fuelGaugeUnitsBefore,
          "Burning snapshot Fuel candidate"
        );
        expectFieldNearlyEqual(
          context,
          auditPath,
          "fuelGaugeUnitsAfter",
          audit.fuelGaugeUnitsAfter,
          audit.fuelGaugeUnitsBefore,
          "Burning snapshot Fuel preservation"
        );
      }
    }

    if (audit.blockedReason === null) {
      const operationAuraAfter =
        audit.quickenStateMutation.operationAuraAfter;
      let markerEntry:
        | (typeof operationAuraAfter)[number]
        | undefined;
      let markerEntryCount = 0;
      let fuelEntry:
        | (typeof operationAuraAfter)[number]
        | undefined;
      let fuelEntryCount = 0;
      for (const entry of operationAuraAfter) {
        if (entry.element === "burning") {
          markerEntry = entry;
          markerEntryCount += 1;
        } else if (entry.element === "burningFuel") {
          fuelEntry = entry;
          fuelEntryCount += 1;
        }
      }
      if (audit.burningGaugeUnitsAfter > AURA_GAUGE_EPSILON) {
        if (markerEntryCount !== 1 || markerEntry === undefined) {
          addIssue(
            context,
            [...auditPath, "quickenStateMutation", "operationAuraAfter"],
            "active Burning post-state requires exactly one marker entry"
          );
        } else {
          expectFieldNearlyEqual(
            context,
            auditPath,
            "burningGaugeUnitsAfter",
            markerEntry.gaugeUnits,
            audit.burningGaugeUnitsAfter,
            "Burning marker post-state Gauge"
          );
          expectFieldEqual(
            context,
            auditPath,
            "burningExpiresAtFrame",
            markerEntry.expiresAtFrame,
            null,
            "Burning marker expiry"
          );
        }
      } else if (markerEntryCount !== 0) {
        addIssue(
          context,
          [...auditPath, "quickenStateMutation", "operationAuraAfter"],
          "inactive Burning post-state cannot retain a marker entry"
        );
      }
      if (audit.fuelGaugeUnitsAfter > AURA_GAUGE_EPSILON) {
        if (fuelEntryCount !== 1 || fuelEntry === undefined) {
          addIssue(
            context,
            [...auditPath, "quickenStateMutation", "operationAuraAfter"],
            "active Burning post-state requires exactly one Fuel entry"
          );
        } else {
          expectFieldNearlyEqual(
            context,
            auditPath,
            "fuelGaugeUnitsAfter",
            fuelEntry.gaugeUnits,
            audit.fuelGaugeUnitsAfter,
            "Burning Fuel post-state Gauge"
          );
          expectFieldEqual(
            context,
            auditPath,
            "fuelExpiresAtFrame",
            fuelEntry.expiresAtFrame,
            audit.fuelExpiresAtFrame,
            "Burning Fuel post-state expiry"
          );
          expectFieldEqual(
            context,
            auditPath,
            "fuelExpiresAtTargetFrame",
            fuelEntry.expiresAtTargetFrame,
            audit.fuelExpiresAtTargetFrame,
            "Burning Fuel post-state target expiry"
          );
          const fuelSourceSlots = fuelEntry.sourceSlots ?? [];
          if (
            audit.fuelSourceActorId === null ||
            fuelSourceSlots.length !== 1 ||
            fuelSourceSlots[0]!.sourceActorId !==
              audit.fuelSourceActorId ||
            !nearlyEqual(
              fuelSourceSlots[0]!.gaugeUnits,
              audit.fuelGaugeUnitsAfter
            )
          ) {
            addIssue(
              context,
              [...auditPath, "fuelSourceActorId"],
              "Burning Fuel post-state owner does not match its authoritative source"
            );
          }
        }
      } else if (fuelEntryCount !== 0) {
        addIssue(
          context,
          [...auditPath, "quickenStateMutation", "operationAuraAfter"],
          "inactive Burning post-state cannot retain a Fuel entry"
        );
      }
    }
    if (
      audit.blockedReason === "TARGET_MECHANICS_TRUNCATION" ||
      event.reactionAudit.mechanicsTruncation !== null
    ) {
      const replayBefore = replayBurningBeforeEventCut(event);
      const activeBefore = replayBefore.activeGeneration !== null;
      const auraClaimsActive =
        burningMarkerBefore && burningFuelBefore;
      if (activeBefore !== auraClaimsActive) {
        addIssue(
          context,
          auditPath,
          "mechanics-truncated Burning audit pre-state must match the materialized lifecycle replay"
        );
      }
      const ownedRows = rowsByTrigger.get(event.id) ?? [];
      const truncationTerminalRows = ownedRows.filter(
        (row) =>
          row.operation === "stop" &&
          row.reason === "TARGET_MECHANICS_TRUNCATION"
      );
      const expectedOperation: BurningReactionAudit["operation"] | null =
        activeBefore
          ? audit.triggerElement === "dendro"
            ? "refresh-fuel"
            : audit.triggerElement === "pyro"
              ? "refresh-snapshot"
              : "stop"
          : audit.triggerElement === "pyro" ||
              audit.triggerElement === "dendro"
            ? "start"
            : null;
      if (expectedOperation === null) {
        addIssue(
          context,
          [...auditPath, "operation"],
          "mechanics-truncated Burning audit requires an active stream or a Pyro/Dendro start trigger"
        );
      } else {
        expectFieldEqual(
          context,
          auditPath,
          "operation",
          audit.operation,
          expectedOperation,
          "mechanics-truncated Burning operation"
        );
        expectFieldEqual(
          context,
          auditPath,
          "generation",
          audit.generation,
          replayBefore.activeGeneration ??
            replayBefore.nextStartGeneration,
          "mechanics-truncated Burning canonical generation"
        );
        expectFieldEqual(
          context,
          auditPath,
          "reactionTriggered",
          audit.reactionTriggered,
          expectedOperation === "start",
          "mechanics-truncated Burning reaction trigger"
        );
        expectFieldEqual(
          context,
          auditPath,
          "fuelOperation",
          audit.fuelOperation,
          expectedOperation === "start"
            ? "start"
            : expectedOperation === "refresh-fuel"
              ? "overwrite"
              : expectedOperation === "refresh-snapshot"
                ? "unchanged"
                : "remove",
          "mechanics-truncated Burning Fuel operation"
        );
      }
      expectFieldEqual(
        context,
        auditPath,
        "scheduled",
        audit.scheduled,
        false,
        "mechanics-truncated Burning scheduling"
      );
      if (
        audit.blockedReason === "TARGET_MECHANICS_TRUNCATION" &&
        event.reactionAudit.mechanicsTruncation === null
      ) {
        addIssue(
          context,
          [...auditPath, "blockedReason"],
          "TARGET_MECHANICS_TRUNCATION requires the parent mechanics-truncation audit"
        );
      }
      if (
        event.reactionAudit.mechanicsTruncation !== null &&
        expectedOperation !== "stop" &&
        audit.blockedReason !== "TARGET_MECHANICS_TRUNCATION"
      ) {
        addIssue(
          context,
          [...auditPath, "blockedReason"],
          "mechanics-truncated Burning start/refresh must be explicitly blocked"
        );
      }
      if (
        expectedOperation === "stop" &&
        audit.blockedReason !== null
      ) {
        addIssue(
          context,
          [...auditPath, "blockedReason"],
          "mechanics-truncated Burning stop is an immediate terminal observation, not a blocked start/refresh"
        );
      }
      if (audit.operation === "stop") {
        if (replayBefore.activeGeneration === null) {
          addIssue(
            context,
            [...auditPath, "operation"],
            "mechanics-truncated Burning stop requires an active stream at the event cut"
          );
        } else {
          expectFieldEqual(
            context,
            auditPath,
            "generation",
            audit.generation,
            replayBefore.activeGeneration,
            "mechanics-truncated Burning stop generation"
          );
        }
        if (
          truncationTerminalRows.length !== 1 ||
          truncationTerminalRows[0]?.generation !==
            replayBefore.activeGeneration
        ) {
          addIssue(
            context,
            auditPath,
            "mechanics-truncated Burning stop requires one terminal row for the active generation"
          );
        }
      } else {
        if (
          ownedRows.some((row) => row.operation === audit.operation)
        ) {
          addIssue(
            context,
            auditPath,
            "mechanics-truncated Burning start/refresh cannot own a matching lifecycle row"
          );
        }
        const expectedTerminalCount = activeBefore ? 1 : 0;
        if (
          truncationTerminalRows.length !== expectedTerminalCount ||
          (activeBefore &&
            truncationTerminalRows[0]?.generation !==
              replayBefore.activeGeneration)
        ) {
          addIssue(
            context,
            auditPath,
            activeBefore
              ? "mechanics-truncated Burning refresh requires one terminal row for the active generation"
              : "mechanics-truncated Burning start cannot materialize a terminal lifecycle row"
          );
        }
      }
      // Mechanics truncation owns its one terminal lifecycle projection. The
      // simulator deliberately skips processBurningConsequences, so a nested
      // Burning start/refresh/stop audit does not own a second audit-shaped
      // burningStateLog row.
      continue;
    }
    const quickenMutation = audit.quickenStateMutation;
    const applicationPoints =
      applicationPointsByDamageEventId.get(event.id) ?? [];
    const applicationPoint =
      applicationPoints.length === 1
        ? applicationPoints[0]
        : undefined;
    if (applicationPoint === undefined) {
      addIssue(
        context,
        [...auditPath, "quickenStateMutation"],
        "a non-truncated Burning audit requires exactly one application timeline point"
      );
    }
    let ownedBurningQuickenRow: QuickenStateRow | undefined;
    if (quickenMutation.operation === "none") {
      const burningOwnedLinks = applicationPoints.flatMap(
        (point) =>
          point.links.filter((link) => {
            if (link.kind !== "quicken-state-log") return false;
            const linkedRow = quickenStateById.get(link.id);
            return (
              linkedRow?.reason ===
                "BURNING_REBASED_QUICKEN_DECAY" ||
              linkedRow?.reason === "BURNING_REMOVED_QUICKEN"
            );
          })
      );
      if (burningOwnedLinks.length !== 0) {
        addIssue(
          context,
          [...auditPath, "quickenStateMutation", "operation"],
          "operation=none cannot own a Burning Quicken lifecycle row or timeline link"
        );
      }
    } else if (quickenMutation.operation !== "decay-rebase") {
      addIssue(
        context,
        [...auditPath, "quickenStateMutation", "operation"],
        "a non-truncated Burning audit currently supports only none or decay-rebase Quicken ownership"
      );
    } else if (applicationPoint !== undefined) {
      const matchingQuickenRows =
        burningQuickenRowsByTarget
          .get(event.targetId)
          ?.get(event.frame)
          ?.filter((row) =>
            burningQuickenRowMatchesMutation(
              row,
              quickenMutation,
              event,
              applicationPoint
            )
          ) ?? [];
      if (matchingQuickenRows.length !== 1) {
        addIssue(
          context,
          [...auditPath, "quickenStateMutation"],
          "Burning decay-rebase must own exactly one exact BURNING_REBASED_QUICKEN_DECAY row"
        );
      } else {
        const quickenRow = matchingQuickenRows[0]!;
        ownedBurningQuickenRow = quickenRow;
        const owners =
          burningQuickenOwnersByRowId.get(quickenRow.id) ?? [];
        owners.push({
          eventIndex,
          applicationPointId: applicationPoint.id
        });
        burningQuickenOwnersByRowId.set(quickenRow.id, owners);
        const applicationLinkCount =
          applicationPoint.links.filter(
            (link) =>
              link.kind === "quicken-state-log" &&
              link.id === quickenRow.id
          ).length;
        if (applicationLinkCount !== 1) {
          addIssue(
            context,
            [...auditPath, "quickenStateMutation"],
            "Burning decay-rebase application point must link its owned Quicken row exactly once"
          );
        }
      }
    }
    if (applicationPoint !== undefined) {
      const expectedApplicationRows: QuickenStateRow[] = [];
      let applicationSequenceComplete = true;
      const catalyzeQuicken =
        event.reactionAudit.catalyzeReaction?.quicken;
      if (catalyzeQuicken !== null && catalyzeQuicken !== undefined) {
        const matchingCatalyzeRows = result.quickenStateLog.filter(
          (candidate) =>
            quickenRowMatchesCatalyzeAudit(
              candidate,
              catalyzeQuicken,
              event,
              applicationPoint
            )
        );
        if (matchingCatalyzeRows.length !== 1) {
          applicationSequenceComplete = false;
          addIssue(
            context,
            [...auditPath, "quickenStateMutation"],
            "a Burning application with Quicken formation must own exactly one exact leading Quicken row"
          );
        } else {
          expectedApplicationRows.push(matchingCatalyzeRows[0]!);
        }
      }
      if (quickenMutation.operation === "decay-rebase") {
        if (ownedBurningQuickenRow === undefined) {
          applicationSequenceComplete = false;
        } else {
          expectedApplicationRows.push(ownedBurningQuickenRow);
          const authoritativeSource =
            resolveAuthoritativeQuickenSourceBefore(
              ownedBurningQuickenRow.id,
              event.targetId
            );
          if (authoritativeSource === null) {
            addIssue(
              context,
              [...auditPath, "quickenStateMutation"],
              "Burning decay-rebase requires an authoritative preceding Quicken source"
            );
          } else {
            expectFieldEqual(
              context,
              ["quickenStateLog", ownedBurningQuickenRow.id],
              "sourceActorId",
              ownedBurningQuickenRow.sourceActorId,
              authoritativeSource.sourceActorId,
              "Burning decay-rebase inherited Quicken source"
            );
            expectFieldEqual(
              context,
              ["quickenStateLog", ownedBurningQuickenRow.id],
              "triggerDamageEventId",
              ownedBurningQuickenRow.triggerDamageEventId,
              authoritativeSource.triggerDamageEventId,
              "Burning decay-rebase inherited Quicken trigger"
            );
          }
        }
      }
      for (const [bloomIndex, bloom] of
        event.reactionAudit.bloomReactions.entries()) {
        if (bloom.quickenStateMutation.operation === "none") continue;
        const matchingBloomRows = result.quickenStateLog.filter(
          (candidate) =>
            quickenRowMatchesBloomAudit(
              candidate,
              bloom,
              event,
              applicationPoint
            )
        );
        if (matchingBloomRows.length !== 1) {
          applicationSequenceComplete = false;
          addIssue(
            context,
            [
              "damageEvents",
              eventIndex,
              "reactionAudit",
              "bloomReactions",
              bloomIndex,
              "quickenStateMutation"
            ],
            "a Burning application Bloom mutation must own exactly one exact trailing Quicken row"
          );
        } else {
          expectedApplicationRows.push(matchingBloomRows[0]!);
        }
      }
      if (
        applicationSequenceComplete &&
        expectedApplicationRows.length > 1
      ) {
        for (
          let sequenceIndex = 1;
          sequenceIndex < expectedApplicationRows.length;
          sequenceIndex += 1
        ) {
          const previous = expectedApplicationRows[sequenceIndex - 1]!;
          const current = expectedApplicationRows[sequenceIndex]!;
          const currentPath = [
            "quickenStateLog",
            current.id
          ] satisfies IssuePath;
          expectFieldEqual(
            context,
            currentPath,
            "id",
            current.id,
            previous.id + 1,
            "same-application Quicken lifecycle order"
          );
          expectFieldEqual(
            context,
            currentPath,
            "generation",
            current.generation,
            previous.generation + 1,
            "same-application Quicken generation"
          );
          expectFieldNearlyEqual(
            context,
            currentPath,
            "quickenGaugeUnitsBefore",
            current.quickenGaugeUnitsBefore,
            previous.quickenGaugeUnitsAfter,
            "same-application Quicken Gauge continuity"
          );
          expectFieldNearlyEqual(
            context,
            currentPath,
            "decayPerFrameBefore",
            current.decayPerFrameBefore,
            previous.decayPerFrameAfter,
            "same-application Quicken decay continuity"
          );
          expectFieldEqual(
            context,
            currentPath,
            "expiresAtFrameBefore",
            current.expiresAtFrameBefore,
            previous.expiresAtFrame,
            "same-application Quicken expiry continuity"
          );
          expectFieldEqual(
            context,
            currentPath,
            "endCauseBefore",
            current.endCauseBefore,
            previous.endCauseAfter,
            "same-application Quicken end-cause continuity"
          );
          expectAuraStateProjection(
            context,
            [...currentPath, "auraBefore"],
            current.auraBefore.filter(
              (entry) => entry.element === "quicken"
            ),
            previous.auraAfter.filter(
              (entry) => entry.element === "quicken"
            ),
            "same-application Quicken slot continuity"
          );
        }
      }
    }
    let matchingRow:
      | SimulationResult["burningStateLog"][number]
      | undefined;
    let matchingRowCount = 0;
    for (const candidate of rowsByTrigger.get(event.id) ?? []) {
      if (candidate.operation !== audit.operation) continue;
      if (
        audit.operation === "stop" &&
        (candidate.reason !==
          (audit.stopReason ?? "BURNING_AURA_CONSUMED") ||
          candidate.triggerElement !== audit.triggerElement ||
          candidate.damageSourceActorId !==
            audit.damageSourceActorId ||
          candidate.fuelSourceActorId !== audit.fuelSourceActorId ||
          !nearlyEqual(
            candidate.burningGaugeUnitsBefore,
            audit.burningGaugeUnitsBefore
          ) ||
          !nearlyEqual(
            candidate.burningGaugeUnitsAfter,
            audit.burningGaugeUnitsAfter
          ) ||
          !nearlyEqual(
            candidate.fuelGaugeUnitsBefore,
            audit.fuelGaugeUnitsBefore
          ) ||
          !nearlyEqual(
            candidate.fuelGaugeUnitsAfter,
            audit.fuelGaugeUnitsAfter
          ) ||
          !auraStateProjectionEqual(
            candidate.auraBefore,
            event.reactionAudit.auraBefore ?? []
          ) ||
          !auraGaugeProjectionEqual(
            candidate.auraApplied,
            event.reactionAudit.auraApplied ?? []
          ) ||
          !auraGaugeProjectionEqual(
            candidate.auraConsumed,
            event.reactionAudit.auraConsumed ?? []
          ) ||
          !auraStateProjectionEqual(
            candidate.auraAfter,
            event.reactionAudit.auraAfter ?? []
          ))
      ) {
        continue;
      }
      matchingRow = candidate;
      matchingRowCount += 1;
    }
    if (matchingRowCount !== 1 || matchingRow === undefined) {
      addIssue(
        context,
        [
          "damageEvents",
          eventIndex,
          "reactionAudit",
          "burningReaction"
        ],
        "Burning audit must own exactly one matching lifecycle row"
      );
      continue;
    }
    const row = matchingRow;
    burningAuditOwnedRowIds.add(row.id);
    const rowPath = ["burningStateLog", row.id] satisfies IssuePath;
    const expectedLifecycleLocalSnapshotFrame =
      usesTargetHitlagClock
        ? burningClockStateAtCut(event.targetId, {
            frame: event.frame,
            eventPriority: event.eventPriority,
            eventSequence: event.eventSequence
          }).targetFrame
        : audit.snapshotTargetFrame ?? audit.snapshotFrame;
    expectFieldEqual(
      context,
      rowPath,
      "targetFrame",
      row.targetFrame ?? row.frame,
      expectedLifecycleLocalSnapshotFrame,
      "Burning lifecycle local snapshot frame"
    );
    expectFieldEqual(
      context,
      rowPath,
      "fuelExpiresAtTargetFrame",
      row.fuelExpiresAtTargetFrame ?? row.fuelExpiresAtFrame,
      audit.fuelExpiresAtTargetFrame ?? audit.fuelExpiresAtFrame,
      "Burning lifecycle local Fuel deadline"
    );
    expectFieldEqual(
      context,
      rowPath,
      "nextTickTargetFrame",
      row.nextTickTargetFrame ?? row.nextTickFrame,
      audit.nextTickTargetFrame ?? audit.nextTickFrame,
      "Burning lifecycle local tick deadline"
    );
    for (const [field, expected] of [
      ["reaction", audit.reaction],
      ["generation", audit.generation],
      ["operation", audit.operation],
      ["frame", event.frame],
      ["eventPriority", event.eventPriority],
      ["eventSequence", event.eventSequence],
      ["targetId", event.targetId],
      ["targetName", event.targetName],
      ["triggerElement", audit.triggerElement],
      ["damageSourceActorId", audit.damageSourceActorId],
      ["fuelSourceActorId", audit.fuelSourceActorId],
      ["triggerDamageEventId", event.id],
      ["fuelExpiresAtFrame", audit.fuelExpiresAtFrame],
      ["nextTickFrame", audit.nextTickFrame],
      ["clockModel", audit.clockModel],
      ["hitlagStatus", audit.hitlagStatus],
      ["selfDamageStatus", audit.selfDamageStatus]
    ] as const) {
      expectFieldEqual(
        context,
        rowPath,
        field,
        row[field],
        expected,
        `Burning lifecycle ${field}`
      );
    }
    if (audit.operation === "stop") {
      expectFieldEqual(
        context,
        rowPath,
        "reason",
        row.reason,
        audit.stopReason ?? "BURNING_AURA_CONSUMED",
        "Burning stop reason"
      );
    }
    for (const [field, expected] of [
      ["timeSeconds", event.timeSeconds],
      [
        "burningGaugeUnitsBefore",
        audit.burningGaugeUnitsBefore
      ],
      ["burningGaugeUnitsAfter", audit.burningGaugeUnitsAfter],
      ["fuelGaugeUnitsBefore", audit.fuelGaugeUnitsBefore],
      ["fuelGaugeUnitsAfter", audit.fuelGaugeUnitsAfter],
      ["fuelDecayPerFrame", audit.fuelDecayPerFrame]
    ] as const) {
      expectFieldNearlyEqual(
        context,
        rowPath,
        field,
        row[field],
        expected,
        `Burning lifecycle ${field}`
      );
    }
    expectAuraStateProjection(
      context,
      [...rowPath, "auraBefore"],
      row.auraBefore,
      event.reactionAudit.auraBefore ?? [],
      "Burning lifecycle auraBefore"
    );
    expectAuraGaugeProjection(
      context,
      [...rowPath, "auraApplied"],
      row.auraApplied,
      event.reactionAudit.auraApplied ?? [],
      "Burning lifecycle auraApplied"
    );
    expectAuraGaugeProjection(
      context,
      [...rowPath, "auraConsumed"],
      row.auraConsumed,
      event.reactionAudit.auraConsumed ?? [],
      "Burning lifecycle auraConsumed"
    );
    expectAuraStateProjection(
      context,
      [...rowPath, "auraAfter"],
      row.auraAfter,
      event.reactionAudit.auraAfter ?? [],
      "Burning lifecycle auraAfter"
    );
  }

  for (const [rowIndex, row] of
    result.quickenStateLog.entries()) {
    if (
      row.reason !== "BURNING_REBASED_QUICKEN_DECAY" &&
      row.reason !== "BURNING_REMOVED_QUICKEN"
    ) {
      continue;
    }
    const rowPath = ["quickenStateLog", rowIndex] satisfies IssuePath;
    const owners =
      burningQuickenOwnersByRowId.get(row.id) ?? [];
    if (owners.length !== 1) {
      addIssue(
        context,
        rowPath,
        "a Burning-owned Quicken lifecycle row requires exactly one exact Burning audit owner"
      );
    }
    if (row.reason !== "BURNING_REBASED_QUICKEN_DECAY") {
      continue;
    }
    const linkedPoints =
      quickenTimelinePointsByRowId.get(row.id) ?? [];
    if (linkedPoints.length !== 1) {
      addIssue(
        context,
        rowPath,
        "BURNING_REBASED_QUICKEN_DECAY must be linked from exactly one target-state point"
      );
      continue;
    }
    if (
      owners.length === 1 &&
      linkedPoints[0]!.id !== owners[0]!.applicationPointId
    ) {
      addIssue(
        context,
        rowPath,
        "BURNING_REBASED_QUICKEN_DECAY must be linked by its owning Burning application's timeline point"
      );
    }
  }

  for (const [rowIndex, row] of
    result.burningStateLog.entries()) {
    if (row.operation !== "stop") continue;
    const rowPath = ["burningStateLog", rowIndex] satisfies IssuePath;
    const trigger =
      row.triggerDamageEventId === null
        ? undefined
        : damageEventById.get(row.triggerDamageEventId);
    const callbackPoints =
      lifecyclePointByBurningStateId.get(row.id) ?? [];
    const callbackPoint = callbackPoints[0];
    const callbackOwned =
      callbackPoints.length === 1 &&
      callbackPoint !== undefined &&
      callbackPoint.cause === "burning-tick" &&
      callbackPoint.eventType === "burningTick" &&
      callbackPoint.targetId === row.targetId &&
      callbackPoint.targetName === row.targetName &&
      callbackPoint.frame === row.frame &&
      callbackPoint.eventPriority === row.eventPriority &&
      callbackPoint.eventSequence === row.eventSequence &&
      auraStateProjectionEqual(
        callbackPoint.auraBefore,
        row.callbackAuraBefore ?? row.auraBefore
      ) &&
      auraStateProjectionEqual(
        callbackPoint.auraAfter,
        row.callbackAuraAfter ?? row.auraAfter
      );
    const legacyCallbackOwned = result.targetTaskPhaseLog.some(
      (phase) =>
        phase.wakeKind === "burning-tick" &&
        phase.eventType === "burningTick" &&
        phase.targetId === row.targetId &&
        phase.targetName === row.targetName &&
        phase.globalFrame === row.frame &&
        phase.targetFrame === (row.targetFrame ?? row.frame) &&
        phase.eventPriority === row.eventPriority &&
        phase.eventSequence === row.eventSequence &&
        phase.burningStateLogIds.filter((id) => id === row.id)
          .length === 1 &&
        auraStateProjectionEqual(
          phase.auraBeforeTasks,
          row.callbackAuraBefore ?? row.auraBefore
        ) &&
        auraStateProjectionEqual(
          phase.auraAfterTasks,
          row.callbackAuraAfter ?? row.auraAfter
        )
    );
    const auditOwned = burningAuditOwnedRowIds.has(row.id);
    const directAuraBefore = trigger?.reactionAudit.auraBefore;
    const directAuraAfter = trigger?.reactionAudit.auraAfter;
    const directAuraApplied = trigger?.reactionAudit.auraApplied;
    const directAuraConsumed = trigger?.reactionAudit.auraConsumed;
    const directBurningBefore =
      directAuraBefore?.find(
        (entry) => entry.element === "burning"
      )?.gaugeUnits ?? 0;
    const directFuelBefore =
      directAuraBefore?.find(
        (entry) => entry.element === "burningFuel"
      )?.gaugeUnits ?? 0;
    const directBurningAfter =
      directAuraAfter?.find(
        (entry) => entry.element === "burning"
      )?.gaugeUnits ?? 0;
    const directFuelAfter =
      directAuraAfter?.find(
        (entry) => entry.element === "burningFuel"
      )?.gaugeUnits ?? 0;
    const phaseDecayRemovedBurning =
      result.targetTaskPhaseLog.some(
        (phase) => {
          if (
            phase.targetId !== row.targetId ||
            phase.globalFrame !== row.frame
          ) {
            return false;
          }
          const burningBefore = phase.auraAfterTasks.some(
            (entry) =>
              entry.element === "burning" &&
              entry.gaugeUnits > AURA_GAUGE_EPSILON
          );
          const fuelBefore = phase.auraAfterTasks.some(
            (entry) =>
              entry.element === "burningFuel" &&
              entry.gaugeUnits > AURA_GAUGE_EPSILON
          );
          const burningAfter = phase.auraAfterDecay.some(
            (entry) =>
              entry.element === "burning" &&
              entry.gaugeUnits > AURA_GAUGE_EPSILON
          );
          const fuelAfter = phase.auraAfterDecay.some(
            (entry) =>
              entry.element === "burningFuel" &&
              entry.gaugeUnits > AURA_GAUGE_EPSILON
          );
          return (
            burningBefore &&
            fuelBefore &&
            (!burningAfter || !fuelAfter)
          );
        }
      );
    const directRemovalOwned =
      trigger !== undefined &&
      trigger.reactionAudit.burningReaction === null &&
      row.reason === "BURNING_AURA_CONSUMED" &&
      row.frame === trigger.frame &&
      row.timeSeconds === trigger.timeSeconds &&
      row.eventPriority === trigger.eventPriority &&
      row.eventSequence === trigger.eventSequence &&
      row.targetId === trigger.targetId &&
      row.targetName === trigger.targetName &&
      row.triggerElement === null &&
      directAuraBefore !== null &&
      directAuraBefore !== undefined &&
      directAuraAfter !== null &&
      directAuraAfter !== undefined &&
      directAuraApplied !== null &&
      directAuraApplied !== undefined &&
      directAuraConsumed !== null &&
      directAuraConsumed !== undefined &&
      ((directBurningBefore > AURA_GAUGE_EPSILON &&
        directFuelBefore > AURA_GAUGE_EPSILON &&
        (directBurningAfter <= AURA_GAUGE_EPSILON ||
          directFuelAfter <= AURA_GAUGE_EPSILON)) ||
        phaseDecayRemovedBurning) &&
      nearlyEqual(
        row.burningGaugeUnitsBefore,
        directBurningBefore
      ) &&
      nearlyEqual(row.fuelGaugeUnitsBefore, directFuelBefore) &&
      nearlyEqual(row.burningGaugeUnitsAfter, directBurningAfter) &&
      nearlyEqual(row.fuelGaugeUnitsAfter, directFuelAfter) &&
      auraStateProjectionEqual(row.auraBefore, directAuraBefore) &&
      auraGaugeProjectionEqual(row.auraApplied, directAuraApplied) &&
      auraGaugeProjectionEqual(
        row.auraConsumed,
        directAuraConsumed
      ) &&
      auraStateProjectionEqual(row.auraAfter, directAuraAfter);
    const matchingTruncations =
      trigger === undefined
        ? []
        : result.targetMechanicsTruncationLog.filter(
            (entry) =>
              entry.triggerDamageEventId === trigger.id &&
              entry.targetId === row.targetId &&
              entry.targetName === row.targetName &&
              entry.frame === row.frame
          );
    const truncation = matchingTruncations[0];
    const truncationOwned =
      matchingTruncations.length === 1 &&
      truncation !== undefined &&
      row.reason === "TARGET_MECHANICS_TRUNCATION" &&
      trigger !== undefined &&
      row.frame === trigger.frame &&
      row.timeSeconds === trigger.timeSeconds &&
      row.eventPriority === trigger.eventPriority &&
      row.eventSequence === trigger.eventSequence &&
      row.triggerElement === null &&
      auraStateProjectionEqual(
        row.auraBefore,
        truncation.discardedAura
      ) &&
      row.auraApplied.length === 0 &&
      row.auraConsumed.length === 0 &&
      row.auraAfter.length === 0;

    if (
      auditOwned ||
      callbackOwned ||
      legacyCallbackOwned ||
      directRemovalOwned ||
      truncationOwned
    ) {
      authoritativeBurningStopRowIds.add(row.id);
    } else {
      addIssue(
        context,
        rowPath,
        "Burning stop must be owned by an exact stop audit, Aura-consuming hit, mechanics truncation, or callback task"
      );
    }
  }

  for (const [rowIndex, row] of
    result.burningStateLog.entries()) {
    const rowPath = ["burningStateLog", rowIndex] satisfies IssuePath;
    const expectedClockModel =
      result.config.targetClockModel.mode ===
      "target-local-hitlag-v1"
        ? "target-local-hitlag-v1"
        : "target-local-no-hitlag";
    const expectedHitlagStatus =
      result.config.targetClockModel.mode ===
      "target-local-hitlag-v1"
        ? "modeled-enemy-hitlag"
        : "unsupported-enemy-hitlag";
    expectFieldEqual(
      context,
      rowPath,
      "clockModel",
      row.clockModel,
      expectedClockModel,
      "Burning lifecycle clock model"
    );
    expectFieldEqual(
      context,
      rowPath,
      "hitlagStatus",
      row.hitlagStatus,
      expectedHitlagStatus,
      "Burning lifecycle Hitlag status"
    );
    expectFieldNearlyEqual(
      context,
      rowPath,
      "timeSeconds",
      row.timeSeconds,
      row.frame / 60,
      "Burning lifecycle time"
    );
    expectFieldNearlyEqual(
      context,
      rowPath,
      "fuelDecayPerFrame",
      row.fuelDecayPerFrame,
      BURNING_FUEL_DECAY_PER_FRAME,
      "Burning Fuel decay constant"
    );
    expectFieldEqual(
      context,
      rowPath,
      "icdGroup",
      row.icdGroup,
      "burning",
      "Burning lifecycle ICD group"
    );
    expectFieldEqual(
      context,
      rowPath,
      "icdTag",
      row.icdTag,
      "burning-application",
      "Burning lifecycle ICD tag"
    );
    expectFieldEqual(
      context,
      rowPath,
      "icdScope",
      row.icdScope,
      "global-target",
      "Burning lifecycle ICD scope"
    );
    expectFieldEqual(
      context,
      rowPath,
      "icdResetFrames",
      row.icdResetFrames,
      BURNING_ICD_RESET_FRAMES,
      "Burning lifecycle ICD reset"
    );
    if (
      row.icdApplicationSequence.length !==
        BURNING_ICD_SEQUENCE.length ||
      row.icdApplicationSequence.some(
        (allowed, index) =>
          allowed !== BURNING_ICD_SEQUENCE[index]
      )
    ) {
      addIssue(
        context,
        ["burningStateLog", rowIndex, "icdApplicationSequence"],
        "Burning application ICD sequence does not match its authoritative source"
      );
    }
    const scalarLifecyclePoints =
      lifecyclePointByBurningStateId.get(row.id) ?? [];
    const scalarLifecyclePoint =
      scalarLifecyclePoints.length === 1
        ? scalarLifecyclePoints[0]
        : undefined;
    const scalarTargetTaskPhases =
      targetTaskPhasesByBurningStateId.get(row.id) ?? [];
    const scalarTargetTaskPhase =
      scalarTargetTaskPhases.length === 1
        ? scalarTargetTaskPhases[0]
        : undefined;
    const scalarAuraBefore =
      row.callbackAuraBefore ??
      scalarTargetTaskPhase?.auraBeforeTasks ??
      scalarLifecyclePoint?.auraBefore ??
      row.auraBefore;
    const scalarAuraAfter =
      row.callbackAuraAfter ??
      scalarTargetTaskPhase?.auraAfterTasks ??
      scalarLifecyclePoint?.auraAfter ??
      row.auraAfter;
    const burningGaugeUnitsBefore =
      scalarAuraBefore.find(
        (entry) => entry.element === "burning"
      )?.gaugeUnits ?? 0;
    const burningGaugeUnitsAfter =
      scalarAuraAfter.find(
        (entry) => entry.element === "burning"
      )?.gaugeUnits ?? 0;
    const fuelGaugeUnitsBefore =
      scalarAuraBefore.find(
        (entry) => entry.element === "burningFuel"
      )?.gaugeUnits ?? 0;
    const fuelGaugeUnitsAfter =
      scalarAuraAfter.find(
        (entry) => entry.element === "burningFuel"
      )?.gaugeUnits ?? 0;
    for (const [field, actual, expected] of [
      [
        "burningGaugeUnitsBefore",
        row.burningGaugeUnitsBefore,
        burningGaugeUnitsBefore
      ],
      [
        "burningGaugeUnitsAfter",
        row.burningGaugeUnitsAfter,
        burningGaugeUnitsAfter
      ],
      [
        "fuelGaugeUnitsBefore",
        row.fuelGaugeUnitsBefore,
        fuelGaugeUnitsBefore
      ],
      [
        "fuelGaugeUnitsAfter",
        row.fuelGaugeUnitsAfter,
        fuelGaugeUnitsAfter
      ]
    ] as const) {
      expectFieldNearlyEqual(
        context,
        rowPath,
        field,
        actual,
        expected,
        `Burning lifecycle ${field} Aura projection`
      );
    }
    const target = enemyTargetById.get(row.targetId);
    if (
      target === undefined ||
      target.name !== row.targetName
    ) {
      addIssue(
        context,
        ["burningStateLog", rowIndex, "targetId"],
        "Burning target identity must match enemyTargets"
      );
    }
    if (
      row.triggerDamageEventId !== null &&
      !damageEventById.has(row.triggerDamageEventId)
    ) {
      addIssue(
        context,
        [
          "burningStateLog",
          rowIndex,
          "triggerDamageEventId"
        ],
        `references missing damage event ${row.triggerDamageEventId}`
      );
    }
    const isTick = row.operation === "tick";
    if (
      row.operation === "tick" ||
      row.operation === "tick-skipped" ||
      row.operation === "fuel-expire"
    ) {
      const points =
        lifecyclePointByBurningStateId.get(row.id) ?? [];
      if (points.length !== 1) {
        addIssue(
          context,
          ["burningStateLog", rowIndex],
          `${row.operation} must own exactly one target-state lifecycle point`
        );
      } else {
        const point = points[0]!;
        const expectedCause =
          row.operation === "fuel-expire"
            ? "burning-fuel-expiry"
            : "burning-tick";
        expectFieldEqual(
          context,
          rowPath,
          "cause",
          point.cause,
          expectedCause,
          "Burning lifecycle point cause"
        );
        expectFieldEqual(
          context,
          rowPath,
          "frame",
          point.frame,
          row.frame,
          "Burning lifecycle point frame"
        );
        expectFieldEqual(
          context,
          rowPath,
          "targetId",
          point.targetId,
          row.targetId,
          "Burning lifecycle point target"
        );
        expectFieldEqual(
          context,
          rowPath,
          "targetName",
          point.targetName,
          row.targetName,
          "Burning lifecycle point target name"
        );
        expectFieldEqual(
          context,
          rowPath,
          "eventPriority",
          point.eventPriority,
          row.eventPriority,
          "Burning lifecycle point priority"
        );
        expectFieldEqual(
          context,
          rowPath,
          "eventSequence",
          point.eventSequence,
          row.eventSequence,
          "Burning lifecycle point sequence"
        );
        expectFieldNearlyEqual(
          context,
          rowPath,
          "timeSeconds",
          point.timeSeconds,
          row.timeSeconds,
          "Burning lifecycle point time"
        );
      }
    }
    if (isTick) {
      if (
        row.reactionDamageLogId === null ||
        row.tickIndex === null ||
        row.tickIndex === BURNING_SKIPPED_TICK_INDEX ||
        row.tickSkipped ||
        row.skipReason !== null
      ) {
        addIssue(
          context,
          ["burningStateLog", rowIndex],
          "Burning tick requires an owned reaction-damage log and non-skipped tick index"
        );
        continue;
      }
      const parent = reactionDamageById.get(
        row.reactionDamageLogId
      );
      if (
        parent === undefined ||
        parent.reaction !== "burning" ||
        parent.scheduleKind !== "burning-tick"
      ) {
        addIssue(
          context,
          [
            "burningStateLog",
            rowIndex,
            "reactionDamageLogId"
          ],
          "Burning tick must backlink a burning-tick reaction-damage log"
        );
        continue;
      }
      const trigger =
        row.triggerDamageEventId === null
          ? undefined
          : damageEventById.get(row.triggerDamageEventId);
      const sourceAudit =
        trigger?.reactionAudit.burningReaction;
      if (
        trigger === undefined ||
        sourceAudit === null ||
        sourceAudit === undefined
      ) {
        addIssue(
          context,
          [
            "burningStateLog",
            rowIndex,
            "triggerDamageEventId"
          ],
          "Burning tick must backlink its source Burning audit"
        );
      } else {
        expectFieldEqual(
          context,
          rowPath,
          "generation",
          row.generation,
          sourceAudit.generation,
          "Burning tick source generation"
        );
        expectFieldEqual(
          context,
          rowPath,
          "damageSourceActorId",
          row.damageSourceActorId,
          trigger.sourceActorId,
          "Burning tick damage source"
        );
        expectFieldEqual(
          context,
          rowPath,
          "fuelSourceActorId",
          row.fuelSourceActorId,
          sourceAudit.fuelSourceActorId,
          "Burning tick Fuel source"
        );
        expectFieldNearlyEqual(
          context,
          rowPath,
          "fuelDecayPerFrame",
          row.fuelDecayPerFrame,
          sourceAudit.fuelDecayPerFrame,
          "Burning tick source fuel decay"
        );
      }
      const parentPath = ["reactionDamageLog", parent.id] satisfies IssuePath;
      expectFieldEqual(
        context,
        parentPath,
        "sourceActorId",
        parent.sourceActorId,
        row.damageSourceActorId,
        "Burning tick parent source"
      );
      expectFieldEqual(
        context,
        parentPath,
        "sourceTargetId",
        parent.sourceTargetId,
        row.targetId,
        "Burning tick parent source target"
      );
      expectFieldEqual(
        context,
        parentPath,
        "triggerDamageEventId",
        parent.triggerDamageEventId,
        row.triggerDamageEventId,
        "Burning tick parent trigger"
      );
      expectFieldEqual(
        context,
        parentPath,
        "damageFrame",
        parent.damageFrame,
        row.frame,
        "Burning tick parent frame"
      );
      expectFieldEqual(
        context,
        parentPath,
        "nextAvailableFrame",
        parent.nextAvailableFrame,
        row.nextTickFrame,
        "Burning tick parent next callback"
      );
      if (
        row.damageEventIds.length !== parent.damageEventIds.length ||
        row.damageEventIds.some(
          (damageEventId, index) =>
            damageEventId !== parent.damageEventIds[index]
        )
      ) {
        addIssue(
          context,
          [...rowPath, "damageEventIds"],
          "Burning tick damage children do not match their authoritative parent"
        );
      }
      let sourceTargetChild:
        | SimulationResult["damageEvents"][number]
        | undefined;
      let sourceTargetChildCount = 0;
      for (const damageEventId of parent.damageEventIds) {
        const child = damageEventById.get(damageEventId);
        if (child?.targetId !== row.targetId) continue;
        sourceTargetChild = child;
        sourceTargetChildCount += 1;
      }
      if (sourceTargetChildCount !== 1 || sourceTargetChild === undefined) {
        addIssue(
          context,
          ["burningStateLog", rowIndex, "damageAllowed"],
          "Burning tick must have exactly one source-target damage child"
        );
      } else {
        expectEqual(
          context,
          ["burningStateLog", rowIndex, "damageAllowed"],
          row.damageAllowed,
          sourceTargetChild.targetDamageMultiplier === 1,
          "Burning source-target damage policy"
        );
        expectEqual(
          context,
          ["burningStateLog", rowIndex, "applicationAllowed"],
          row.applicationAllowed,
          sourceTargetChild.reactionAudit.icdAllowed,
          "Burning source-target ICD decision"
        );
        if (
          sourceTargetChild.reactionAudit.icdGroup === "burning"
        ) {
          expectAuraStateProjection(
            context,
            ["burningStateLog", rowIndex, "auraBefore"],
            row.auraBefore,
            sourceTargetChild.reactionAudit.auraBefore ?? [],
            "Burning source-target auraBefore"
          );
          expectAuraGaugeProjection(
            context,
            ["burningStateLog", rowIndex, "auraApplied"],
            row.auraApplied,
            sourceTargetChild.reactionAudit.auraApplied ?? [],
            "Burning source-target auraApplied"
          );
          expectAuraGaugeProjection(
            context,
            ["burningStateLog", rowIndex, "auraConsumed"],
            row.auraConsumed,
            sourceTargetChild.reactionAudit.auraConsumed ?? [],
            "Burning source-target auraConsumed"
          );
          expectAuraStateProjection(
            context,
            ["burningStateLog", rowIndex, "auraAfter"],
            row.auraAfter,
            sourceTargetChild.reactionAudit.auraAfter ?? [],
            "Burning source-target auraAfter"
          );
        }
      }
    } else if (row.operation === "tick-skipped") {
      if (
        row.reactionDamageLogId !== null ||
        row.damageEventIds.length !== 0 ||
        row.tickIndex === null ||
        !row.tickSkipped ||
        row.skipReason !== "COUNTER_9_SKIP"
      ) {
        addIssue(
          context,
          ["burningStateLog", rowIndex],
          "Burning tick-skipped row cannot own damage and must identify counter-9 skip"
        );
      }
    } else if (
      row.reactionDamageLogId !== null ||
      row.damageEventIds.length !== 0
    ) {
      addIssue(
        context,
        ["burningStateLog", rowIndex],
        `${row.operation} Burning rows cannot own reaction damage`
      );
    }
  }

  type ActiveBurningReplay = {
    generation: number;
    sourceTriggerDamageEventId: number;
    damageSourceActorId: string;
    fuelSourceActorId: string;
    nextTickLocalFrame: number;
    fuelExpiryLocalFrame: number;
    lastTickIndex: number;
  };
  const activeBurningByTarget = new Map<
    string,
    ActiveBurningReplay
  >();
  const nextBurningStartGenerationByTarget = new Map<
    string,
    number
  >();
  const callbackBeforeReactableTick =
    result.config.targetTaskModel.mode === "target-phase-v1" ||
    result.config.targetTaskModel.mode === "target-phase-v2" ||
    result.config.targetTaskModel.mode === "target-phase-v3";

  for (const row of orderedBurningRows) {
    const rowPath = ["burningStateLog", row.id] satisfies IssuePath;
    const active = activeBurningByTarget.get(row.targetId);
    const trigger =
      row.triggerDamageEventId === null
        ? undefined
        : damageEventById.get(row.triggerDamageEventId);
    const sourceAudit = trigger?.reactionAudit.burningReaction;
    const currentLocalFrame = row.targetFrame ?? row.frame;
    const nextTickLocalFrame =
      row.nextTickTargetFrame ?? row.nextTickFrame;
    const fuelExpiryLocalFrame =
      row.fuelExpiresAtTargetFrame ?? row.fuelExpiresAtFrame;
    if (usesTargetHitlagClock) {
      const rowClockState = burningClockStateAtCut(row.targetId, {
        frame: row.frame,
        eventPriority: row.eventPriority,
        eventSequence: row.eventSequence
      });
      expectFieldEqual(
        context,
        rowPath,
        "targetFrame",
        row.targetFrame,
        rowClockState.targetFrame,
        "Burning lifecycle target frame"
      );
      validateBurningGlobalDeadline(
        rowClockState,
        row.fuelExpiresAtFrame,
        row.fuelExpiresAtTargetFrame,
        [...rowPath, "fuelExpiresAtFrame"],
        "Burning lifecycle Fuel global deadline target-clock projection"
      );
      validateBurningGlobalDeadline(
        rowClockState,
        row.nextTickFrame,
        row.nextTickTargetFrame,
        [...rowPath, "nextTickFrame"],
        "Burning lifecycle next Tick global deadline target-clock projection"
      );
    }

    if (
      row.operation === "start" ||
      row.operation === "refresh-fuel" ||
      row.operation === "refresh-snapshot"
    ) {
      if (
        trigger === undefined ||
        sourceAudit === null ||
        sourceAudit === undefined ||
        sourceAudit.operation !== row.operation
      ) {
        addIssue(
          context,
          [...rowPath, "triggerDamageEventId"],
          `${row.operation} must backlink its exact Burning source audit`
        );
        continue;
      }
      if (
        sourceAudit.blockedReason ===
        "TARGET_MECHANICS_TRUNCATION"
      ) {
        addIssue(
          context,
          [...rowPath, "triggerDamageEventId"],
          "mechanics-truncated Burning start/refresh cannot materialize a lifecycle row"
        );
        if (active !== undefined) {
          addIssue(
            context,
            [...rowPath, "blockedReason"],
            "mechanics-truncated Burning start/refresh cannot implicitly remove an active stream; an earlier authoritative stop is required"
          );
        }
        continue;
      }
      if (
        nextTickLocalFrame === null ||
        fuelExpiryLocalFrame === null ||
        sourceAudit.fuelSourceActorId === null
      ) {
        addIssue(
          context,
          rowPath,
          `${row.operation} requires active local tick and Fuel deadlines plus a Fuel owner`
        );
        continue;
      }
      if (row.operation === "start") {
        const expectedGeneration =
          nextBurningStartGenerationByTarget.get(row.targetId) ?? 1;
        expectFieldEqual(
          context,
          rowPath,
          "generation",
          row.generation,
          expectedGeneration,
          "Burning canonical start generation"
        );
        if (active !== undefined) {
          addIssue(
            context,
            [...rowPath, "operation"],
            "Burning start cannot replace an active stream without an explicit terminal row"
          );
        }
        expectEqual(
          context,
          [...rowPath, "nextTickTargetFrame"],
          nextTickLocalFrame,
          (sourceAudit.snapshotTargetFrame ??
            sourceAudit.snapshotFrame) +
            BURNING_TICK_INTERVAL_FRAMES,
          "Burning first local tick deadline"
        );
        expectEqual(
          context,
          [...rowPath, "fuelSourceActorId"],
          row.fuelSourceActorId,
          trigger.sourceActorId,
          "Burning initial Fuel owner"
        );
        activeBurningByTarget.set(row.targetId, {
          generation: row.generation,
          sourceTriggerDamageEventId: trigger.id,
          damageSourceActorId: trigger.sourceActorId,
          fuelSourceActorId: sourceAudit.fuelSourceActorId,
          nextTickLocalFrame,
          fuelExpiryLocalFrame,
          lastTickIndex: 0
        });
        continue;
      }

      if (
        active === undefined ||
        active.generation !== row.generation
      ) {
        addIssue(
          context,
          [...rowPath, "generation"],
          `${row.operation} requires an active stream with the same generation`
        );
        continue;
      }
      expectEqual(
        context,
        [...rowPath, "nextTickTargetFrame"],
        nextTickLocalFrame,
        active.nextTickLocalFrame,
        "Burning refresh cadence preservation"
      );
      if (row.operation === "refresh-snapshot") {
        expectEqual(
          context,
          [...rowPath, "fuelSourceActorId"],
          row.fuelSourceActorId,
          active.fuelSourceActorId,
          "Burning snapshot Fuel owner preservation"
        );
        expectEqual(
          context,
          [...rowPath, "fuelExpiresAtTargetFrame"],
          fuelExpiryLocalFrame,
          active.fuelExpiryLocalFrame,
          "Burning snapshot Fuel deadline preservation"
        );
      } else {
        expectEqual(
          context,
          [...rowPath, "fuelSourceActorId"],
          row.fuelSourceActorId,
          trigger.sourceActorId,
          "Burning refreshed Fuel owner"
        );
      }
      active.sourceTriggerDamageEventId = trigger.id;
      active.damageSourceActorId = trigger.sourceActorId;
      if (row.operation === "refresh-fuel") {
        active.fuelSourceActorId = sourceAudit.fuelSourceActorId;
        active.fuelExpiryLocalFrame = fuelExpiryLocalFrame;
      }
      continue;
    }

    if (
      row.operation === "tick" ||
      row.operation === "tick-skipped"
    ) {
      if (
        active === undefined ||
        active.generation !== row.generation
      ) {
        addIssue(
          context,
          [...rowPath, "generation"],
          "Burning callback requires an active stream with the same generation"
        );
        continue;
      }
      if (
        currentLocalFrame > active.fuelExpiryLocalFrame ||
        (!callbackBeforeReactableTick &&
          currentLocalFrame === active.fuelExpiryLocalFrame)
      ) {
        addIssue(
          context,
          [...rowPath, "targetFrame"],
          callbackBeforeReactableTick
            ? "Burning callback cannot execute after its Fuel expiry"
            : "Burning callback must execute strictly before its Fuel expiry"
        );
      }
      const expectedTickIndex = active.lastTickIndex + 1;
      expectFieldEqual(
        context,
        rowPath,
        "triggerDamageEventId",
        row.triggerDamageEventId,
        active.sourceTriggerDamageEventId,
        "Burning callback trigger"
      );
      expectFieldEqual(
        context,
        rowPath,
        "damageSourceActorId",
        row.damageSourceActorId,
        active.damageSourceActorId,
        "Burning callback damage source"
      );
      expectFieldEqual(
        context,
        rowPath,
        "fuelSourceActorId",
        row.fuelSourceActorId,
        active.fuelSourceActorId,
        "Burning callback Fuel source"
      );
      expectFieldEqual(
        context,
        rowPath,
        "targetFrame",
        currentLocalFrame,
        active.nextTickLocalFrame,
        "Burning callback local frame"
      );
      expectFieldEqual(
        context,
        rowPath,
        "tickIndex",
        row.tickIndex,
        expectedTickIndex,
        "Burning callback tick index"
      );
      expectFieldEqual(
        context,
        rowPath,
        "fuelExpiresAtTargetFrame",
        fuelExpiryLocalFrame,
        active.fuelExpiryLocalFrame,
        "Burning callback Fuel deadline"
      );
      expectFieldEqual(
        context,
        rowPath,
        "operation",
        row.operation === "tick-skipped",
        expectedTickIndex === BURNING_SKIPPED_TICK_INDEX,
        "Burning counter-9 skip ownership"
      );
      expectFieldEqual(
        context,
        rowPath,
        "nextTickTargetFrame",
        nextTickLocalFrame,
        currentLocalFrame + BURNING_TICK_INTERVAL_FRAMES,
        "Burning 15-frame local cadence"
      );
      active.nextTickLocalFrame =
        currentLocalFrame + BURNING_TICK_INTERVAL_FRAMES;
      active.lastTickIndex = expectedTickIndex;
      continue;
    }

    if (row.operation === "fuel-expire") {
      if (
        active === undefined ||
        active.generation !== row.generation
      ) {
        addIssue(
          context,
          [...rowPath, "generation"],
          "Burning Fuel expiry requires its active stream"
        );
        continue;
      } else {
        expectFieldEqual(
          context,
          rowPath,
          "triggerDamageEventId",
          row.triggerDamageEventId,
          active.sourceTriggerDamageEventId,
          "Burning Fuel expiry trigger"
        );
        expectFieldEqual(
          context,
          rowPath,
          "damageSourceActorId",
          row.damageSourceActorId,
          active.damageSourceActorId,
          "Burning Fuel expiry damage source"
        );
        expectFieldEqual(
          context,
          rowPath,
          "fuelSourceActorId",
          row.fuelSourceActorId,
          active.fuelSourceActorId,
          "Burning Fuel expiry Fuel source"
        );
        expectFieldEqual(
          context,
          rowPath,
          "targetFrame",
          currentLocalFrame,
          active.fuelExpiryLocalFrame,
          "Burning Fuel expiry local frame"
        );
        expectFieldEqual(
          context,
          rowPath,
          "triggerElement",
          row.triggerElement,
          null,
          "Burning Fuel expiry trigger element"
        );
        expectFieldEqual(
          context,
          rowPath,
          "fuelExpiresAtFrame",
          row.fuelExpiresAtFrame,
          null,
          "Burning Fuel expiry terminal global deadline"
        );
        expectFieldEqual(
          context,
          rowPath,
          "fuelExpiresAtTargetFrame",
          row.fuelExpiresAtTargetFrame ?? null,
          null,
          "Burning Fuel expiry terminal local deadline"
        );
        expectFieldEqual(
          context,
          rowPath,
          "nextTickFrame",
          row.nextTickFrame,
          null,
          "Burning Fuel expiry terminal global callback"
        );
        expectFieldEqual(
          context,
          rowPath,
          "nextTickTargetFrame",
          row.nextTickTargetFrame ?? null,
          null,
          "Burning Fuel expiry terminal local callback"
        );
        expectFieldNearlyEqual(
          context,
          rowPath,
          "burningGaugeUnitsAfter",
          row.burningGaugeUnitsAfter,
          0,
          "Burning Fuel expiry marker Gauge"
        );
        expectFieldNearlyEqual(
          context,
          rowPath,
          "fuelGaugeUnitsAfter",
          row.fuelGaugeUnitsAfter,
          0,
          "Burning Fuel expiry Fuel Gauge"
        );
        expectAuraGaugeProjection(
          context,
          [...rowPath, "auraApplied"],
          row.auraApplied,
          [],
          "Burning Fuel expiry applied Aura"
        );
        const expectedAuraConsumed = row.auraBefore
          .filter(
            (before) =>
              !row.auraAfter.some(
                (after) => after.element === before.element
              )
          )
          .map((entry) => ({
            element: entry.element,
            gaugeUnits: entry.gaugeUnits
          }));
        expectAuraGaugeProjection(
          context,
          [...rowPath, "auraConsumed"],
          row.auraConsumed,
          expectedAuraConsumed,
          "Burning Fuel expiry consumed Aura"
        );
        const expiryPoints =
          lifecyclePointByBurningStateId.get(row.id) ?? [];
        const expiryPoint = expiryPoints[0];
        if (
          expiryPoints.length !== 1 ||
          expiryPoint === undefined ||
          !auraStateProjectionEqual(
            row.auraBefore,
            expiryPoint.auraBefore
          ) ||
          !auraStateProjectionEqual(
            row.auraAfter,
            expiryPoint.auraAfter
          )
        ) {
          addIssue(
            context,
            [...rowPath, "auraBefore"],
            "Burning Fuel expiry Aura snapshots must match its lifecycle point"
          );
        }
        const markerBefore = row.auraBefore.find(
          (entry) => entry.element === "burning"
        )?.gaugeUnits ?? 0;
        const fuelBefore = row.auraBefore.find(
          (entry) => entry.element === "burningFuel"
        )?.gaugeUnits ?? 0;
        expectFieldNearlyEqual(
          context,
          rowPath,
          "burningGaugeUnitsBefore",
          row.burningGaugeUnitsBefore,
          markerBefore,
          "Burning Fuel expiry marker snapshot"
        );
        expectFieldNearlyEqual(
          context,
          rowPath,
          "fuelGaugeUnitsBefore",
          row.fuelGaugeUnitsBefore,
          fuelBefore,
          "Burning Fuel expiry Fuel snapshot"
        );
      }
      nextBurningStartGenerationByTarget.set(
        row.targetId,
        active.generation + 2
      );
      activeBurningByTarget.delete(row.targetId);
      continue;
    }

    if (row.operation === "stop") {
      if (!authoritativeBurningStopRowIds.has(row.id)) {
        continue;
      }
      if (active === undefined) {
        addIssue(
          context,
          [...rowPath, "generation"],
          "Burning stop requires its active stream with the same generation"
        );
        continue;
      }
      if (active.generation !== row.generation) {
        addIssue(
          context,
          [...rowPath, "generation"],
          "Burning stop requires its active stream with the same generation"
        );
        continue;
      }
      if (trigger === undefined) {
        addIssue(
          context,
          [...rowPath, "triggerDamageEventId"],
          "Burning stop must retain its authoritative source trigger"
        );
        continue;
      }
      if (
        currentLocalFrame > active.fuelExpiryLocalFrame ||
        (!callbackBeforeReactableTick &&
          currentLocalFrame === active.fuelExpiryLocalFrame)
      ) {
        addIssue(
          context,
          [...rowPath, "targetFrame"],
          "Burning stop cannot replace a Fuel expiry that has already become active"
        );
      }
      expectEqual(
        context,
        [...rowPath, "damageSourceActorId"],
        row.damageSourceActorId,
        active.damageSourceActorId,
        "Burning terminal damage source"
      );
      expectEqual(
        context,
        [...rowPath, "fuelSourceActorId"],
        row.fuelSourceActorId,
        active.fuelSourceActorId,
        "Burning terminal Fuel owner"
      );
      nextBurningStartGenerationByTarget.set(
        row.targetId,
        active.generation + 2
      );
      activeBurningByTarget.delete(row.targetId);
    }
  }

  const runEndFrame = Math.round(result.config.duration * 60);
  for (const [targetId, active] of activeBurningByTarget) {
    const finalLocalFrame =
      result.targetClockAudit.mode === "target-local-hitlag-v1"
        ? (result.targetClockAudit.targets.find(
            (target) => target.targetId === targetId
          )?.finalTargetFrame ?? runEndFrame)
        : runEndFrame;
    if (active.fuelExpiryLocalFrame <= finalLocalFrame) {
      addIssue(
        context,
        ["burningStateLog"],
        `active Burning stream on ${targetId} is missing its Fuel expiry at local frame ${active.fuelExpiryLocalFrame}`
      );
    } else if (
      active.nextTickLocalFrame < active.fuelExpiryLocalFrame &&
      active.nextTickLocalFrame <= finalLocalFrame
    ) {
      addIssue(
        context,
        ["burningStateLog"],
        `active Burning stream on ${targetId} is missing its in-range callback at local frame ${active.nextTickLocalFrame}`
      );
    }
  }

  const burningTickRowBySourceChildId = new Map<
    number,
    SimulationResult["burningStateLog"][number]
  >();
  const burningParentByChildId = new Map<
    number,
    SimulationResult["reactionDamageLog"][number]
  >();
  for (const parent of result.reactionDamageLog) {
    if (
      parent.reaction !== "burning" ||
      parent.scheduleKind !== "burning-tick"
    ) {
      continue;
    }
    for (const damageEventId of parent.damageEventIds) {
      burningParentByChildId.set(damageEventId, parent);
    }
    const ownerRows =
      burningTickByReactionDamageId.get(parent.id) ?? [];
    const ownerRow = ownerRows.find(
      (row) => row.operation === "tick"
    );
    if (ownerRow !== undefined) {
      let sourceChildId: number | undefined;
      let sourceChildCount = 0;
      for (const damageEventId of parent.damageEventIds) {
        if (
          damageEventById.get(damageEventId)?.targetId !==
          ownerRow.targetId
        ) {
          continue;
        }
        sourceChildId = damageEventId;
        sourceChildCount += 1;
      }
      if (sourceChildCount === 1 && sourceChildId !== undefined) {
        burningTickRowBySourceChildId.set(
          sourceChildId,
          ownerRow
        );
      }
    }
  }

  const compareDamageEventOrder = (
    left: DamageEvent,
    right: DamageEvent
  ): number =>
    left.frame - right.frame ||
    left.eventPriority - right.eventPriority ||
    left.eventSequence - right.eventSequence ||
    left.id - right.id;
  const earliestTruncationTriggerByTarget = new Map<
    string,
    DamageEvent
  >();
  for (const truncation of result.targetMechanicsTruncationLog) {
    const trigger = damageEventById.get(
      truncation.triggerDamageEventId
    );
    if (trigger === undefined) continue;
    const earliest = earliestTruncationTriggerByTarget.get(
      truncation.targetId
    );
    if (
      earliest === undefined ||
      compareDamageEventOrder(trigger, earliest) < 0
    ) {
      earliestTruncationTriggerByTarget.set(
        truncation.targetId,
        trigger
      );
    }
  }
  const auraBlockedPhasesByTarget = new Map<
    string,
    NonNullable<
      SimulationResult["config"]["enemy"]["targetPhases"]
    >
  >();
  for (const phase of result.config.enemy.targetPhases ?? []) {
    if (phase.effects.aura !== "blocked") continue;
    const phases = auraBlockedPhasesByTarget.get(phase.targetId) ?? [];
    phases.push(phase);
    auraBlockedPhasesByTarget.set(phase.targetId, phases);
  }
  const targetAuraBlockedAtFrame = (
    targetId: string,
    frame: number
  ): boolean => {
    const phases = auraBlockedPhasesByTarget.get(targetId);
    if (phases === undefined) return false;
    for (const phase of phases) {
      if (frame >= phase.startFrame && frame < phase.endFrame) {
        return true;
      }
    }
    return false;
  };
  const burningIcdByTarget = new Map<
    string,
    { windowStartFrame: number; hitCount: number }
  >();
  const burningApplicationChildren = result.damageEvents
    .filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning" &&
        burningParentByChildId.has(event.id)
    )
    .sort(compareDamageEventOrder);

  for (const child of burningApplicationChildren) {
    const childPath = [
      "damageEvents",
      child.id,
      "reactionAudit"
    ] satisfies IssuePath;
    const targetAuraBlocked = targetAuraBlockedAtFrame(
      child.targetId,
      child.frame
    );
    const earliestTruncationTrigger =
      earliestTruncationTriggerByTarget.get(child.targetId);
    const mechanicsTruncatedBefore =
      earliestTruncationTrigger !== undefined &&
      compareDamageEventOrder(earliestTruncationTrigger, child) < 0;
    const ownerRow = burningTickRowBySourceChildId.get(child.id);
    if (targetAuraBlocked || mechanicsTruncatedBefore) {
      expectFieldEqual(
        context,
        childPath,
        "icdAllowed",
        child.reactionAudit.icdAllowed,
        null,
        "non-applying Burning child ICD decision"
      );
      expectFieldEqual(
        context,
        childPath,
        "icdTag",
        child.reactionAudit.icdTag,
        null,
        "non-applying Burning child ICD tag"
      );
      expectFieldEqual(
        context,
        childPath,
        "icdGroup",
        child.reactionAudit.icdGroup,
        null,
        "non-applying Burning child ICD group"
      );
      expectFieldEqual(
        context,
        childPath,
        "applicationGaugeUnits",
        child.reactionAudit.applicationGaugeUnits,
        null,
        "non-applying Burning child Gauge"
      );
      if (ownerRow !== undefined && targetAuraBlocked) {
        const ownerPath = [
          "burningStateLog",
          ownerRow.id
        ] satisfies IssuePath;
        expectFieldEqual(
          context,
          ownerPath,
          "applicationBlockedReason",
          ownerRow.applicationBlockedReason,
          "TARGET_AURA_BLOCKED",
          "Aura-blocked Burning source callback"
        );
        expectFieldEqual(
          context,
          ownerPath,
          "icdWindowStartFrame",
          ownerRow.icdWindowStartFrame,
          null,
          "Aura-blocked Burning source ICD window"
        );
        expectFieldEqual(
          context,
          ownerPath,
          "icdHitIndex",
          ownerRow.icdHitIndex,
          null,
          "Aura-blocked Burning source ICD index"
        );
      }
      continue;
    }

    const previous = burningIcdByTarget.get(child.targetId);
    const startsNewWindow =
      previous === undefined ||
      child.frame - previous.windowStartFrame >=
        BURNING_ICD_RESET_FRAMES;
    const expectedWindowStartFrame = startsNewWindow
      ? child.frame
      : previous.windowStartFrame;
    const expectedHitIndex = startsNewWindow
      ? 0
      : previous.hitCount;
    const expectedApplicationAllowed =
      BURNING_ICD_SEQUENCE[
        Math.min(
          expectedHitIndex,
          BURNING_ICD_SEQUENCE.length - 1
        )
      ] ?? false;
    if (previous === undefined || startsNewWindow) {
      burningIcdByTarget.set(child.targetId, {
        windowStartFrame: expectedWindowStartFrame,
        hitCount: expectedHitIndex + 1
      });
    } else {
      previous.hitCount = expectedHitIndex + 1;
    }

    expectFieldEqual(
      context,
      childPath,
      "icdAllowed",
      child.reactionAudit.icdAllowed,
      expectedApplicationAllowed,
      "Burning application ICD decision"
    );
    expectFieldEqual(
      context,
      childPath,
      "icdTag",
      child.reactionAudit.icdTag,
      "burning-application",
      "Burning application ICD tag"
    );
    expectFieldEqual(
      context,
      childPath,
      "icdGroup",
      child.reactionAudit.icdGroup,
      "burning",
      "Burning application ICD group"
    );
    expectFieldEqual(
      context,
      childPath,
      "applicationGaugeUnits",
      child.reactionAudit.applicationGaugeUnits,
      BURNING_APPLICATION_GAUGE_UNITS,
      "Burning application Gauge"
    );
    if (ownerRow !== undefined) {
      const ownerPath = [
        "burningStateLog",
        ownerRow.id
      ] satisfies IssuePath;
      expectFieldEqual(
        context,
        ownerPath,
        "icdWindowStartFrame",
        ownerRow.icdWindowStartFrame,
        expectedWindowStartFrame,
        "Burning source ICD window"
      );
      expectFieldEqual(
        context,
        ownerPath,
        "icdHitIndex",
        ownerRow.icdHitIndex,
        expectedHitIndex,
        "Burning source ICD hit index"
      );
      expectFieldEqual(
        context,
        ownerPath,
        "applicationBlockedReason",
        ownerRow.applicationBlockedReason,
        expectedApplicationAllowed
          ? null
          : "BURNING_APPLICATION_ICD",
        "Burning source ICD block reason"
      );
    }
  }

  for (const [parentIndex, parent] of
    result.reactionDamageLog.entries()) {
    if (parent.scheduleKind !== "burning-tick") continue;
    const rows =
      burningTickByReactionDamageId.get(parent.id) ?? [];
    if (rows.length !== 1 || rows[0]?.operation !== "tick") {
      addIssue(
        context,
        ["reactionDamageLog", parentIndex],
        "burning-tick reaction damage must belong to exactly one Burning tick row"
      );
    }
  }
}

function validateTimelineExecutionProjection(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const execution = result.timelineExecution;
  const timeline = result.config.timeline;
  if (execution === undefined) {
    if (timeline !== undefined) {
      addIssue(
        context,
        ["timelineExecution"],
        "config.timeline requires a timeline execution audit"
      );
    }
    return;
  }
  if (timeline === undefined) {
    addIssue(
      context,
      ["timelineExecution"],
      "cannot exist without config.timeline"
    );
    return;
  }

  expectEqual(
    context,
    ["compatibilityMode"],
    result.compatibilityMode,
    "legal-frame-v1",
    "timeline compatibility mode"
  );
  for (const [field, expected] of [
    ["mode", timeline.mode],
    ["fps", timeline.fps],
    ["legalityMode", timeline.legalityMode],
    [
      "initialActiveCharacterId",
      timeline.initialActiveCharacterId
    ]
  ] as const) {
    expectEqual(
      context,
      ["timelineExecution", field],
      execution[field],
      expected,
      `timeline execution ${field}`
    );
  }
  if (
    execution.commandResults.length !== timeline.commands.length
  ) {
    addIssue(
      context,
      ["timelineExecution", "commandResults"],
      `must contain one result for each of ${timeline.commands.length} config commands`
    );
  }

  const failureByCommand = new Map<
    number,
    (typeof execution.failures)[number]
  >();
  for (const [index, failure] of execution.failures.entries()) {
    if (failureByCommand.has(failure.commandIndex)) {
      addIssue(
        context,
        ["timelineExecution", "failures", index, "commandIndex"],
        "a command can own at most one failure"
      );
    }
    failureByCommand.set(failure.commandIndex, failure);
  }
  const adjustmentsByCommand = new Map<
    number,
    Array<(typeof execution.adjustments)[number]>
  >();
  for (const [index, adjustment] of
    execution.adjustments.entries()) {
    if (timeline.commands[adjustment.commandIndex] === undefined) {
      addIssue(
        context,
        [
          "timelineExecution",
          "adjustments",
          index,
          "commandIndex"
        ],
        "must reference a configured command"
      );
    }
    const rows =
      adjustmentsByCommand.get(adjustment.commandIndex) ?? [];
    if (rows.some((row) => row.code === adjustment.code)) {
      addIssue(
        context,
        ["timelineExecution", "adjustments", index, "code"],
        "a command can own at most one adjustment of each kind"
      );
    }
    rows.push(adjustment);
    adjustmentsByCommand.set(adjustment.commandIndex, rows);
  }

  type TimelineState =
    (typeof execution.stateLog)[number];
  type ActiveTimelineState = {
    actorId: string;
    statusKey: string;
    label: string;
    expiresAtFrame: number;
    commandIndex: number;
    abilityId: string;
  };
  const expectedStateLog: TimelineState[] = [];
  const activeStates = new Map<string, ActiveTimelineState>();
  const durationFrames = Math.round(result.config.duration * 60);
  let stateSequence = 0;
  const scopedStateKey = (
    actorId: string,
    statusKey: string
  ): string => `${actorId}\u0000${statusKey}`;
  const expireStatesThrough = (frame: number): void => {
    const cutoffFrame = Math.min(frame, durationFrames);
    const expiring = [...activeStates.entries()]
      .filter(([, state]) => state.expiresAtFrame <= cutoffFrame)
      .sort(
        (left, right) =>
          left[1].expiresAtFrame - right[1].expiresAtFrame ||
          left[1].commandIndex - right[1].commandIndex ||
          left[1].statusKey.localeCompare(right[1].statusKey)
      );
    for (const [key, state] of expiring) {
      if (activeStates.get(key) !== state) continue;
      activeStates.delete(key);
      expectedStateLog.push({
        sequence: stateSequence++,
        frame: state.expiresAtFrame,
        timeSeconds: state.expiresAtFrame / 60,
        operation: "expire",
        actorId: state.actorId,
        statusKey: state.statusKey,
        label: state.label,
        expiresAtFrame: state.expiresAtFrame,
        commandIndex: state.commandIndex,
        abilityId: state.abilityId
      });
    }
  };
  const applyAbilityStates = (
    ability: (typeof timeline.abilities)[number],
    commandIndex: number,
    startFrame: number
  ): void => {
    const definition = ability.timelineState;
    if (definition === undefined) return;
    for (const statusKey of definition.consumes ?? []) {
      const key = scopedStateKey(ability.actorId, statusKey);
      const state = activeStates.get(key);
      if (state === undefined) continue;
      activeStates.delete(key);
      expectedStateLog.push({
        sequence: stateSequence++,
        frame: startFrame,
        timeSeconds: startFrame / 60,
        operation: "consume",
        actorId: ability.actorId,
        statusKey,
        label: state.label,
        expiresAtFrame: state.expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
    }
    for (const statusKey of definition.clears ?? []) {
      const key = scopedStateKey(ability.actorId, statusKey);
      const state = activeStates.get(key);
      if (state === undefined) continue;
      activeStates.delete(key);
      expectedStateLog.push({
        sequence: stateSequence++,
        frame: startFrame,
        timeSeconds: startFrame / 60,
        operation: "clear",
        actorId: ability.actorId,
        statusKey,
        label: state.label,
        expiresAtFrame: state.expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
    }
    for (const grant of definition.grants ?? []) {
      const key = scopedStateKey(ability.actorId, grant.key);
      const existing = activeStates.get(key);
      const expiresAtFrame = startFrame + grant.durationFrames;
      activeStates.set(key, {
        actorId: ability.actorId,
        statusKey: grant.key,
        label: grant.label,
        expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
      expectedStateLog.push({
        sequence: stateSequence++,
        frame: startFrame,
        timeSeconds: startFrame / 60,
        operation: existing === undefined ? "grant" : "replace",
        actorId: ability.actorId,
        statusKey: grant.key,
        label: grant.label,
        expiresAtFrame,
        commandIndex,
        abilityId: ability.id
      });
    }
  };

  type ExpectedAction = {
    commandIndex: number;
    frame: number;
    actorId: string;
    actionId: string;
    action: string;
    sourceAbilityId: string | undefined;
    cancelFrame: number;
    animationEndFrame: number;
  };
  const expectedActions = new Map<number, ExpectedAction>();
  const acceptedAbilities = new Map<
    number,
    {
      actorId: string;
      abilityId: string;
      startFrame: number;
      cancelFrame: number;
      animationEndFrame: number;
      actionId: string;
    }
  >();
  let cursor = 0;
  let activeCharacterId = timeline.initialActiveCharacterId;

  for (const [index, sourceCommand] of
    timeline.commands.entries()) {
    const command = execution.commandResults[index];
    if (command === undefined) continue;
    const path = [
      "timelineExecution",
      "commandResults",
      index
    ] satisfies IssuePath;
    if (command.commandIndex !== index) {
      addIssue(
        context,
        [...path, "commandIndex"],
        "command results must preserve config command order"
      );
    }
    expectEqual(
      context,
      [...path, "commandType"],
      command.commandType,
      sourceCommand.type,
      "timeline command type"
    );
    expectEqual(
      context,
      [...path, "actorId"],
      command.actorId,
      "actorId" in sourceCommand
        ? sourceCommand.actorId
        : sourceCommand.type === "swap"
          ? sourceCommand.characterId
          : null,
      "timeline command actor"
    );
    expectEqual(
      context,
      [...path, "abilityId"],
      command.abilityId,
      "abilityId" in sourceCommand
        ? sourceCommand.abilityId
        : null,
      "timeline command ability"
    );

    const requestedFrame =
      sourceCommand.type === "wait"
        ? cursor
        : (sourceCommand.atFrame ?? cursor);
    expectEqual(
      context,
      [...path, "requestedFrame"],
      command.requestedFrame,
      requestedFrame,
      "timeline requested frame"
    );
    const failure = failureByCommand.get(index);
    const attemptedFrame =
      command.startFrame ?? failure?.frame;
    if (attemptedFrame === undefined) {
      addIssue(
        context,
        [...path, "startFrame"],
        "must expose an actual start frame or a matching failure frame"
      );
      continue;
    }
    const baseAttemptFrame = Math.max(cursor, requestedFrame);
    const adjustments = adjustmentsByCommand.get(index) ?? [];
    const overlap = adjustments.find(
      (adjustment) => adjustment.code === "ACTION_OVERLAP"
    );
    if (requestedFrame < cursor) {
      if (
        overlap === undefined ||
        overlap.requestedFrame !== requestedFrame ||
        overlap.executedFrame !== cursor ||
        overlap.waitedFrames !== cursor - requestedFrame
      ) {
        addIssue(
          context,
          ["timelineExecution", "adjustments"],
          `command ${index} must record its action-overlap wait`
        );
      }
    } else if (overlap !== undefined) {
      addIssue(
        context,
        ["timelineExecution", "adjustments"],
        `command ${index} has no action overlap to adjust`
      );
    }
    const cooldown = adjustments.find(
      (adjustment) =>
        adjustment.code === "ABILITY_ON_COOLDOWN"
    );
    const expectedAttemptFrame =
      cooldown === undefined
        ? baseAttemptFrame
        : cooldown.executedFrame;
    if (
      cooldown !== undefined &&
      (cooldown.requestedFrame !== baseAttemptFrame ||
        cooldown.executedFrame <= baseAttemptFrame ||
        cooldown.waitedFrames !==
          cooldown.executedFrame - baseAttemptFrame ||
        sourceCommand.type === "wait" ||
        sourceCommand.type === "swap" ||
        sourceCommand.type === "pickUpCrystallize" ||
        sourceCommand.type === "dash" ||
        sourceCommand.type === "jump")
    ) {
      addIssue(
        context,
        ["timelineExecution", "adjustments"],
        `command ${index} has an invalid cooldown adjustment`
      );
    }
    expectEqual(
      context,
      [...path, "startFrame"],
      attemptedFrame,
      expectedAttemptFrame,
      "timeline actual start frame"
    );
    expectEqual(
      context,
      [...path, "waitedFrames"],
      command.waitedFrames,
      attemptedFrame - requestedFrame,
      "timeline waited frames"
    );

    if (sourceCommand.type !== "wait") {
      cursor = attemptedFrame;
      expireStatesThrough(attemptedFrame);
    }
    if (command.status === "rejected") {
      if (
        failure === undefined ||
        command.failureCode === undefined ||
        failure.code !== command.failureCode ||
        failure.frame !== attemptedFrame
      ) {
        addIssue(
          context,
          path,
          "rejected commands require one matching failure at the attempted frame"
        );
      }
      if (
        command.failureCode === "INSUFFICIENT_ENERGY"
      ) {
        expectEqual(
          context,
          [...path, "startFrame"],
          command.startFrame,
          attemptedFrame,
          "energy-rejected command start"
        );
        expectEqual(
          context,
          [...path, "endFrame"],
          command.endFrame,
          attemptedFrame,
          "energy-rejected command end"
        );
        expectNearlyEqual(
          context,
          [...path, "energyBefore"],
          command.energyBefore ?? Number.NaN,
          failure?.energyBefore ?? Number.NaN,
          "energy-rejected command energy before"
        );
        expectNearlyEqual(
          context,
          [...path, "energyCost"],
          command.energyCost ?? Number.NaN,
          failure?.energyCost ?? Number.NaN,
          "energy-rejected command energy cost"
        );
      } else if (
        command.startFrame !== null ||
        command.endFrame !== null
      ) {
        addIssue(
          context,
          [...path, "startFrame"],
          "non-energy rejected commands cannot expose executed frame bounds"
        );
      }
      if (
        command.cancelFrame !== null ||
        command.animationEndFrame !== null
      ) {
        addIssue(
          context,
          [...path, "cancelFrame"],
          "rejected commands cannot expose action frame bounds"
        );
      }
      continue;
    }

    if (failure !== undefined || command.failureCode !== undefined) {
      addIssue(
        context,
        path,
        "accepted commands cannot own a failure"
      );
    }
    const expectedStatus =
      attemptedFrame > requestedFrame ? "waited" : "executed";
    expectEqual(
      context,
      [...path, "status"],
      command.status,
      expectedStatus,
      "accepted timeline command status"
    );

    if (sourceCommand.type === "wait") {
      const endFrame = attemptedFrame + sourceCommand.frames;
      for (const [field, expected] of [
        ["startFrame", attemptedFrame],
        ["cancelFrame", null],
        ["animationEndFrame", null],
        ["endFrame", endFrame]
      ] as const) {
        expectEqual(
          context,
          [...path, field],
          command[field],
          expected,
          `wait command ${field}`
        );
      }
      cursor = endFrame;
      expireStatesThrough(endFrame);
      continue;
    }
    if (sourceCommand.type === "pickUpCrystallize") {
      expectEqual(
        context,
        [...path, "endFrame"],
        command.endFrame,
        attemptedFrame,
        "pickup command end"
      );
      continue;
    }

    let actionFrame = attemptedFrame;
    let cancelFrame: number;
    let animationEndFrame: number;
    let actionId: string;
    let actionName: string;
    let sourceAbilityId: string | undefined;
    if (sourceCommand.type === "swap") {
      cancelFrame = attemptedFrame + timeline.swapFrames;
      animationEndFrame = cancelFrame;
      actionFrame = cancelFrame;
      actionId = `__swap#${index}`;
      actionName = `切换至 ${sourceCommand.characterId}`;
      activeCharacterId = sourceCommand.characterId;
    } else if (
      sourceCommand.type === "dash" ||
      sourceCommand.type === "jump"
    ) {
      cancelFrame = attemptedFrame + sourceCommand.frames;
      animationEndFrame = cancelFrame;
      actionId = `__${sourceCommand.type}#${index}`;
      actionName =
        sourceCommand.type === "dash" ? "冲刺" : "跳跃";
    } else {
      const configuredAbilityId = (
        sourceCommand as { abilityId?: string }
      ).abilityId;
      const ability = timeline.abilities.find(
        (candidate) =>
          candidate.id === configuredAbilityId
      );
      if (ability === undefined) {
        addIssue(
          context,
          [...path, "abilityId"],
          "accepted ability command must reference a configured ability"
        );
        continue;
      }
      const nextType = timeline.commands[index + 1]?.type;
      const followup =
        nextType === undefined ||
        nextType === "wait" ||
        nextType === "pickUpCrystallize"
          ? undefined
          : nextType;
      const cancelOffset =
        (followup === undefined
          ? undefined
          : ability.cancelFrames?.[followup]) ??
        ability.cancelFrame;
      cancelFrame = attemptedFrame + cancelOffset;
      animationEndFrame =
        attemptedFrame + ability.animationEndFrame;
      actionId = `${ability.id}#${index}`;
      actionName = ability.name;
      sourceAbilityId = ability.id;
      acceptedAbilities.set(index, {
        actorId: ability.actorId,
        abilityId: ability.id,
        startFrame: attemptedFrame,
        cancelFrame,
        animationEndFrame,
        actionId
      });
      applyAbilityStates(ability, index, attemptedFrame);
    }
    for (const [field, expected] of [
      ["startFrame", attemptedFrame],
      ["cancelFrame", cancelFrame],
      ["animationEndFrame", animationEndFrame],
      ["endFrame", cancelFrame]
    ] as const) {
      expectEqual(
        context,
        [...path, field],
        command[field],
        expected,
        `accepted command ${field}`
      );
    }
    cursor = cancelFrame;
    if (
      sourceCommand.type === "swap" ||
      sourceCommand.type === "dash" ||
      sourceCommand.type === "jump"
    ) {
      expireStatesThrough(cancelFrame);
    }
    if (actionFrame / 60 <= result.config.duration) {
      expectedActions.set(index, {
        commandIndex: index,
        frame: actionFrame,
        actorId:
          sourceCommand.type === "swap"
            ? sourceCommand.characterId
            : sourceCommand.actorId,
        actionId,
        action: actionName,
        sourceAbilityId,
        cancelFrame,
        animationEndFrame
      });
    }
  }

  expireStatesThrough(durationFrames);
  expectEqual(
    context,
    ["timelineExecution", "totalFrames"],
    execution.totalFrames,
    cursor,
    "timeline terminal frame"
  );
  expectEqual(
    context,
    ["timelineExecution", "finalActiveCharacterId"],
    execution.finalActiveCharacterId,
    activeCharacterId,
    "timeline final active character"
  );
  expectSemanticEqual(
    context,
    ["timelineExecution", "stateLog"],
    execution.stateLog,
    expectedStateLog,
    "timeline state transition replay"
  );

  const actionsByCommand = new Map<
    number,
    Array<(typeof result.actionLog)[number]>
  >();
  for (const [index, action] of result.actionLog.entries()) {
    if (action.timelineCommandIndex === undefined) continue;
    const rows =
      actionsByCommand.get(action.timelineCommandIndex) ?? [];
    rows.push(action);
    actionsByCommand.set(action.timelineCommandIndex, rows);
    const expected = expectedActions.get(
      action.timelineCommandIndex
    );
    if (expected === undefined) {
      addIssue(
        context,
        ["actionLog", index, "timelineCommandIndex"],
        "must reference one accepted action-producing timeline command"
      );
      continue;
    }
    for (const [field, value] of [
      ["frame", expected.frame],
      ["actorId", expected.actorId],
      ["actionId", expected.actionId],
      ["action", expected.action],
      ["sourceAbilityId", expected.sourceAbilityId],
      ["cancelFrame", expected.cancelFrame],
      ["animationEndFrame", expected.animationEndFrame],
      ["cycle", 0]
    ] as const) {
      expectEqual(
        context,
        ["actionLog", index, field],
        action[field],
        value,
        `timeline action ${field}`
      );
    }
    expectNearlyEqual(
      context,
      ["actionLog", index, "time"],
      action.time,
      expected.frame / 60,
      "timeline action time"
    );
  }
  for (const [commandIndex] of expectedActions) {
    if ((actionsByCommand.get(commandIndex) ?? []).length !== 1) {
      addIssue(
        context,
        ["actionLog"],
        `timeline command ${commandIndex} must own exactly one action row`
      );
    }
  }

  const skippedByCommand = new Map<
    number,
    Array<(typeof result.skippedActions)[number]>
  >();
  for (const [index, skipped] of
    result.skippedActions.entries()) {
    if (skipped.timelineCommandIndex === undefined) {
      addIssue(
        context,
        ["skippedActions", index, "timelineCommandIndex"],
        "legal timeline skipped actions must reference their command"
      );
      continue;
    }
    const rows =
      skippedByCommand.get(skipped.timelineCommandIndex) ?? [];
    rows.push(skipped);
    skippedByCommand.set(skipped.timelineCommandIndex, rows);
    const command =
      execution.commandResults[skipped.timelineCommandIndex];
    if (
      command === undefined ||
      command.status !== "rejected" ||
      command.failureCode !== "INSUFFICIENT_ENERGY" ||
      command.startFrame === null
    ) {
      addIssue(
        context,
        ["skippedActions", index, "timelineCommandIndex"],
        "must reference an energy-rejected timeline command"
      );
      continue;
    }
    for (const [field, expected] of [
      ["frame", command.startFrame],
      ["actorId", command.actorId],
      ["sourceAbilityId", command.abilityId],
      ["actionId", `${command.abilityId}#${command.commandIndex}`],
      ["energyBefore", command.energyBefore],
      ["energyCost", command.energyCost],
      ["cycle", 0]
    ] as const) {
      expectEqual(
        context,
        ["skippedActions", index, field],
        skipped[field],
        expected,
        `timeline skipped action ${field}`
      );
    }
    expectNearlyEqual(
      context,
      ["skippedActions", index, "time"],
      skipped.time,
      command.startFrame / 60,
      "timeline skipped action time"
    );
  }
  for (const command of execution.commandResults) {
    const count = (
      skippedByCommand.get(command.commandIndex) ?? []
    ).length;
    if (
      command.failureCode === "INSUFFICIENT_ENERGY"
        ? count !== 1
        : count !== 0
    ) {
      addIssue(
        context,
        ["skippedActions"],
        `timeline command ${command.commandIndex} has an invalid skipped-action cardinality`
      );
    }
  }

  for (const [index, event] of result.damageEvents.entries()) {
    if (event.timelineCommandIndex === undefined) {
      addIssue(
        context,
        ["damageEvents", index, "timelineCommandIndex"],
        "legal timeline damage must reference its accepted ability command"
      );
      continue;
    }
    const ability = acceptedAbilities.get(
      event.timelineCommandIndex
    );
    if (ability === undefined) {
      addIssue(
        context,
        ["damageEvents", index, "timelineCommandIndex"],
        "must reference an accepted ability command"
      );
      continue;
    }
    for (const [field, expected] of [
      ["sourceActorId", ability.actorId],
      ["sourceAbilityId", ability.abilityId],
      ["actionId", ability.actionId],
      ["actionStartFrame", ability.startFrame],
      ["actionCancelFrame", ability.cancelFrame],
      [
        "actionAnimationEndFrame",
        ability.animationEndFrame
      ]
    ] as const) {
      expectEqual(
        context,
        ["damageEvents", index, field],
        event[field],
        expected,
        `timeline damage ${field}`
      );
    }
  }
}

function validateMechanicsAndBoundaries(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const damageEventIds = new Set(
    result.damageEvents.map((event) => event.id)
  );
  const idLogs: Array<
    [path: string, entries: Array<{ id: number }>]
  > = [
    ["hitResolutionLog", result.hitResolutionLog],
    ["targetClockLog", result.targetClockLog],
    ["targetHitlagLog", result.targetHitlagLog],
    ["targetTaskPhaseLog", result.targetTaskPhaseLog],
    ["targetPhaseLog", result.targetPhaseLog],
    [
      "targetMechanicsTruncationLog",
      result.targetMechanicsTruncationLog
    ],
    ["reactionDamageLog", result.reactionDamageLog],
    ["reactionTaskLog", result.reactionTaskLog],
    ["reactionStatusLog", result.reactionStatusLog],
    ["periodicReactionLog", result.periodicReactionLog],
    ["frozenStateLog", result.frozenStateLog],
    ["quickenStateLog", result.quickenStateLog],
    ["burningStateLog", result.burningStateLog],
    ["dendroCoreLog", result.dendroCoreLog],
    ["dendroCoreContactLog", result.dendroCoreContactLog],
    ["crystallizeShardLog", result.crystallizeShardLog],
    ["crystallizeShieldLog", result.crystallizeShieldLog],
    [
      "crystallizeShieldTimeline",
      result.crystallizeShieldTimeline
    ],
    [
      "playerHitResolutionLog",
      result.playerHitResolutionLog
    ],
    ["playerDamageEvents", result.playerDamageEvents],
    ["energyLog", result.energyLog],
    ["particleEvents", result.particleEvents],
    ["particleTriggerLog", result.particleTriggerLog],
    ["energyCurve", result.energyCurve]
  ];
  for (const [path, entries] of idLogs) {
    for (const [index, entry] of entries.entries()) {
      if (entry.id !== index) {
        addIssue(
          context,
          [path, index, "id"],
          `${path} IDs must be contiguous and index-addressable`
        );
      }
    }
  }
  for (const [logIndex, entry] of
    result.reactionDamageLog.entries()) {
    for (const [referenceIndex, damageEventId] of
      entry.damageEventIds.entries()) {
      if (!damageEventIds.has(damageEventId)) {
        addIssue(
          context,
          [
            "reactionDamageLog",
            logIndex,
            "damageEventIds",
            referenceIndex
          ],
          `references missing damage event ${damageEventId}`
        );
      }
    }
  }
  validateAuraProjection(result, context, damageEventIds);
  validateReactionBacklinks(result, context);
  validateSwirlBacklinks(result, context);
  validateParticleBacklinks(result, context);
  validateParticleProvenanceIntegrity(result, context);
  validateFrozenStateProjection(result, context);
  validateCrystallizeShardProjection(result, context);
  validateBurningStateProjection(result, context);
  validateTimelineExecutionProjection(result, context);
  const expectedMechanicsStatus =
    result.targetMechanicsTruncationLog.length === 0
      ? "complete"
      : "partial";
  if (result.mechanicsStatus !== expectedMechanicsStatus) {
    addIssue(
      context,
      ["mechanicsStatus"],
      `must be ${expectedMechanicsStatus} for the truncation log`
    );
  }
  const targetIdentity = result.enemyTargets.map((target) => ({
    targetId: target.id,
    targetName: target.name
  }));
  const initialIdentity = result.auraInitialStates.map(
    ({ targetId, targetName }) => ({ targetId, targetName })
  );
  const endIdentity = result.auraEndStates.map(
    ({ targetId, targetName }) => ({ targetId, targetName })
  );
  expectSemanticEqual(
    context,
    ["auraInitialStates"],
    initialIdentity,
    targetIdentity,
    "initial Aura target projection"
  );
  expectSemanticEqual(
    context,
    ["auraEndStates"],
    endIdentity,
    targetIdentity,
    "final Aura target projection"
  );
  const endFrame = Math.round(result.config.duration * 60);
  for (const [index, state] of result.auraInitialStates.entries()) {
    if (state.frame !== 0 || state.timeSeconds !== 0) {
      addIssue(
        context,
        ["auraInitialStates", index, "frame"],
        "initial Aura boundary must be at frame 0"
      );
    }
  }
  for (const [index, state] of result.auraEndStates.entries()) {
    if (
      state.frame !== endFrame ||
      !nearlyEqual(state.timeSeconds, endFrame / 60)
    ) {
      addIssue(
        context,
        ["auraEndStates", index, "frame"],
        "final Aura boundary must match simulation duration"
      );
    }
  }
}

function validateEnergy(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const characterIds = result.config.characters.map(
    (character) => character.id
  );
  const statIds = Object.keys(result.energyStats);
  expectSemanticEqual(
    context,
    ["energyStats"],
    [...statIds].sort(),
    [...characterIds].sort(),
    "energy summary character IDs"
  );

  const gainedByCharacter: Record<string, number> = {};
  const fixedGainedByCharacter: Record<string, number> = {};
  const particleGainedByCharacter: Record<string, number> = {};
  const wastedByCharacter: Record<string, number> = {};
  for (const entry of result.energyLog) {
    addToRecord(
      gainedByCharacter,
      entry.receiverId,
      entry.gainedEnergy
    );
    addToRecord(
      wastedByCharacter,
      entry.receiverId,
      entry.wastedEnergy
    );
    addToRecord(
      entry.kind === "fixed"
        ? fixedGainedByCharacter
        : particleGainedByCharacter,
      entry.receiverId,
      entry.gainedEnergy
    );
  }
  const spentByCharacter: Record<string, number> = {};
  for (const action of result.actionLog) {
    addToRecord(
      spentByCharacter,
      action.actorId,
      action.energyBefore - action.energyAfter
    );
  }
  const skippedByCharacter: Record<string, number> = {};
  for (const skipped of result.skippedActions) {
    addToRecord(skippedByCharacter, skipped.actorId, 1);
  }

  const terminalEnergy =
    result.energyCurve[result.energyCurve.length - 1]
      ?.energyByCharacter;
  if (terminalEnergy === undefined) {
    addIssue(
      context,
      ["energyCurve"],
      "must contain an initial and terminal energy projection"
    );
  }

  for (const [index, character] of
    result.config.characters.entries()) {
    const path = ["energyStats", character.id] satisfies IssuePath;
    const summary = result.energyStats[character.id];
    if (summary === undefined) {
      addIssue(
        context,
        path,
        `missing energy summary for ${character.id}`
      );
      continue;
    }
    const expectedInitial =
      result.resolvedRuntimeOptions.energyMode === "zero"
        ? 0
        : result.resolvedRuntimeOptions.energyMode === "full"
          ? character.energyMax
          : character.initialEnergy;
    expectNearlyEqual(
      context,
      [...path, "initial"],
      summary.initial,
      expectedInitial,
      "initial energy"
    );
    expectNearlyEqual(
      context,
      [...path, "gained"],
      summary.gained,
      gainedByCharacter[character.id] ?? 0,
      "gained energy"
    );
    expectNearlyEqual(
      context,
      [...path, "fixedGained"],
      summary.fixedGained,
      fixedGainedByCharacter[character.id] ?? 0,
      "fixed energy gained"
    );
    expectNearlyEqual(
      context,
      [...path, "particleGained"],
      summary.particleGained,
      particleGainedByCharacter[character.id] ?? 0,
      "particle energy gained"
    );
    expectNearlyEqual(
      context,
      [...path, "wasted"],
      summary.wasted,
      wastedByCharacter[character.id] ?? 0,
      "wasted energy"
    );
    expectNearlyEqual(
      context,
      [...path, "spent"],
      summary.spent,
      spentByCharacter[character.id] ?? 0,
      "spent energy"
    );
    expectEqual(
      context,
      [...path, "skipped"],
      summary.skipped,
      skippedByCharacter[character.id] ?? 0,
      "skipped action count"
    );
    expectNearlyEqual(
      context,
      [...path, "final"],
      summary.final,
      summary.initial + summary.gained - summary.spent,
      "final energy balance"
    );
    if (terminalEnergy !== undefined) {
      expectNearlyEqual(
        context,
        [
          "energyCurve",
          result.energyCurve.length - 1,
          "energyByCharacter",
          character.id
        ],
        terminalEnergy[character.id] ?? Number.NaN,
        summary.final,
        "terminal energy curve"
      );
    }
    if (
      index === 0 &&
      result.energyCurve[0]?.kind !== "initial"
    ) {
      addIssue(
        context,
        ["energyCurve", 0, "kind"],
        "first energy curve point must be initial"
      );
    }
  }
}

/**
 * Cross-field proof for the exact current SimulationResult wire.
 *
 * Leaf schemas own field domains and discriminated unions. This pass stays
 * linear in result size and binds duplicated compatibility projections,
 * aggregates, identities, and the principal event backlinks.
 */
export function validateSimulationResultV142Integrity(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityV142(result, context);
  validateDamageAggregates(result, context);
  validateMechanicsAndBoundaries(result, context);
  validateEnergy(result, context);
  validateEnergyReplayIntegrity(result, context);
}

/**
 * Cross-field proof for the exact 1.44 SimulationResult wire. Unchanged
 * aggregates and mechanics reuse the frozen proof; only identity and v3
 * callback ownership are version-specific.
 */
export function validateSimulationResultV144Integrity(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityV144(result, context);
  validateDamageAggregates(result, context);
  validateMechanicsAndBoundaries(result, context);
  validateEnergy(result, context);
  validateEnergyReplayIntegrity(result, context);
  validateTargetPhaseV3Integrity(result, context);
}

/**
 * Cross-field proof for exact 1.45 results. The 1.44 mechanics proof remains
 * unchanged; this boundary additionally binds the config, run manifest, and
 * every reaction-formula input to the compiled fixed profile.
 */
export function validateSimulationResultV145Integrity(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityV145(result, context);
  validateReactionFormulaProfileV145(result, context);
  validateDamageAggregates(result, context);
  validateMechanicsAndBoundaries(result, context);
  validateEnergy(result, context);
  validateEnergyReplayIntegrity(result, context);
  validateTargetPhaseV3Integrity(result, context);
}

/**
 * Cross-field proof for exact 1.46 results. The fixed 1.45 reaction-formula
 * proof remains in force and the ordinary direct-damage-group log is replayed
 * from config plus the compiled fixed profile.
 */
export function validateSimulationResultV146Integrity(
  result: SimulationResult,
  context: RefinementCtx
): void {
  validateIdentityV146(result, context);
  validateReactionFormulaProfileV145(result, context);
  validateDirectDamageGroupV146(result, context);
  validateDamageAggregates(result, context);
  validateMechanicsAndBoundaries(result, context);
  validateEnergy(result, context);
  validateEnergyReplayIntegrity(result, context);
  validateTargetPhaseV3Integrity(result, context);
}

/**
 * Zero-copy assertion for a SimulationResult produced inside sim-core.
 *
 * Internal results have already passed TypeScript construction and the
 * mode-specific reaction/clock/player facets. Running the full public Zod
 * wire schema here would clone several megabytes of timelines on every
 * simulation. This trusted boundary reuses the exact same cross-field proof
 * without cloning; untrusted JSON and persisted fixtures must still use
 * simulationResultV142Schema.
 */
export function assertTrustedSimulationResultV142(
  result: SimulationResult
): SimulationResult {
  const issues: Array<{
    path: PropertyKey[];
    message: string;
  }> = [];
  const context = {
    addIssue(issue: {
      path?: PropertyKey[];
      message?: string;
    }): void {
      issues.push({
        path: issue.path === undefined ? [] : [...issue.path],
        message: issue.message ?? "invalid SimulationResult"
      });
    }
  } as unknown as RefinementCtx;
  validateSimulationResultV142Integrity(result, context);
  if (issues.length !== 0) {
    const preview = issues
      .slice(0, 12)
      .map(
        (issue) =>
          `${issue.path.map(String).join(".") || "<root>"}: ${
            issue.message
          }`
      )
      .join("; ");
    const remainder =
      issues.length > 12
        ? `; ${issues.length - 12} additional issue(s)`
        : "";
    throw new Error(
      `Trusted SimulationResult 1.42 integrity validation failed: ${preview}${remainder}`
    );
  }
  return result;
}

/**
 * Trusted assertion for current 1.44 results produced inside sim-core.
 * The common path is zero-copy; v2 results that contain an EC expiry or
 * cleanup transition additionally run the dedicated reference facet.
 */
export function assertTrustedSimulationResultV144(
  result: SimulationResult
): SimulationResult {
  const issues: Array<{
    path: PropertyKey[];
    message: string;
  }> = [];
  const context = {
    addIssue(issue: {
      path?: PropertyKey[];
      message?: string;
    }): void {
      issues.push({
        path: issue.path === undefined ? [] : [...issue.path],
        message: issue.message ?? "invalid SimulationResult"
      });
    }
  } as unknown as RefinementCtx;
  validateSimulationResultV144Integrity(result, context);
  const hasElectroChargedTargetPhaseV2Transition =
    result.config.targetTaskModel.mode === "target-phase-v2" &&
    result.targetPhaseLog.some((phase) =>
      phase.reactableTick.transitions.some(
        (transition) =>
          transition.kind === "electro-charged-expiry" ||
          transition.kind === "electro-charged-cleanup"
      )
    );
  if (hasElectroChargedTargetPhaseV2Transition) {
    const targetPhaseReferences =
      targetPhaseV2ResultReferencesSchema.safeParse(result);
    if (!targetPhaseReferences.success) {
      for (const issue of targetPhaseReferences.error.issues) {
        issues.push({
          path: [...issue.path],
          message: `target phase v2 references: ${issue.message}`
        });
      }
    }
  }
  if (issues.length !== 0) {
    const preview = issues
      .slice(0, 12)
      .map(
        (issue) =>
          `${issue.path.map(String).join(".") || "<root>"}: ${
            issue.message
          }`
      )
      .join("; ");
    const remainder =
      issues.length > 12
        ? `; ${issues.length - 12} additional issue(s)`
        : "";
    throw new Error(
      `Trusted SimulationResult 1.44 integrity validation failed: ${preview}${remainder}`
    );
  }
  return result;
}

/** Trusted, zero-copy assertion for current 1.45 fixed-profile results. */
export function assertTrustedSimulationResultV145(
  result: SimulationResult
): SimulationResult {
  const issues: Array<{
    path: PropertyKey[];
    message: string;
  }> = [];
  const context = {
    addIssue(issue: {
      path?: PropertyKey[];
      message?: string;
    }): void {
      issues.push({
        path: issue.path === undefined ? [] : [...issue.path],
        message: issue.message ?? "invalid SimulationResult"
      });
    }
  } as unknown as RefinementCtx;
  validateSimulationResultV145Integrity(result, context);
  const hasElectroChargedTargetPhaseV2Transition =
    result.config.targetTaskModel.mode === "target-phase-v2" &&
    result.targetPhaseLog.some((phase) =>
      phase.reactableTick.transitions.some(
        (transition) =>
          transition.kind === "electro-charged-expiry" ||
          transition.kind === "electro-charged-cleanup"
      )
    );
  if (hasElectroChargedTargetPhaseV2Transition) {
    const targetPhaseReferences =
      targetPhaseV2ResultReferencesSchema.safeParse(result);
    if (!targetPhaseReferences.success) {
      for (const issue of targetPhaseReferences.error.issues) {
        issues.push({
          path: [...issue.path],
          message: `target phase v2 references: ${issue.message}`
        });
      }
    }
  }
  if (issues.length !== 0) {
    const preview = issues
      .slice(0, 12)
      .map(
        (issue) =>
          `${issue.path.map(String).join(".") || "<root>"}: ${
            issue.message
          }`
      )
      .join("; ");
    const remainder =
      issues.length > 12
        ? `; ${issues.length - 12} additional issue(s)`
        : "";
    throw new Error(
      `Trusted SimulationResult 1.45 integrity validation failed: ${preview}${remainder}`
    );
  }
  return result;
}

/** Trusted, zero-copy assertion for current 1.46 fixed-root results. */
export function assertTrustedSimulationResultV146(
  result: SimulationResult
): SimulationResult {
  const issues: Array<{
    path: PropertyKey[];
    message: string;
  }> = [];
  const context = {
    addIssue(issue: {
      path?: PropertyKey[];
      message?: string;
    }): void {
      issues.push({
        path: issue.path === undefined ? [] : [...issue.path],
        message: issue.message ?? "invalid SimulationResult"
      });
    }
  } as unknown as RefinementCtx;
  validateSimulationResultV146Integrity(result, context);
  const hasElectroChargedTargetPhaseV2Transition =
    result.config.targetTaskModel.mode === "target-phase-v2" &&
    result.targetPhaseLog.some((phase) =>
      phase.reactableTick.transitions.some(
        (transition) =>
          transition.kind === "electro-charged-expiry" ||
          transition.kind === "electro-charged-cleanup"
      )
    );
  if (hasElectroChargedTargetPhaseV2Transition) {
    const targetPhaseReferences =
      targetPhaseV2ResultReferencesSchema.safeParse(result);
    if (!targetPhaseReferences.success) {
      for (const issue of targetPhaseReferences.error.issues) {
        issues.push({
          path: [...issue.path],
          message: `target phase v2 references: ${issue.message}`
        });
      }
    }
  }
  if (issues.length !== 0) {
    const preview = issues
      .slice(0, 12)
      .map(
        (issue) =>
          `${issue.path.map(String).join(".") || "<root>"}: ${
            issue.message
          }`
      )
      .join("; ");
    const remainder =
      issues.length > 12
        ? `; ${issues.length - 12} additional issue(s)`
        : "";
    throw new Error(
      `Trusted SimulationResult 1.46 integrity validation failed: ${preview}${remainder}`
    );
  }
  return result;
}

/** Current aliases; versioned validators above remain frozen exports. */
export const validateSimulationResultIntegrity =
  validateSimulationResultV146Integrity;
export const assertTrustedSimulationResult =
  assertTrustedSimulationResultV146;
export {
  targetPhaseV3ResultReferencesSchema,
  validateTargetPhaseV3Integrity
} from "./target-phase-v3-integrity";
