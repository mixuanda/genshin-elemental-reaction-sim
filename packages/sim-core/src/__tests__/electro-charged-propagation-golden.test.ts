import { createHash } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import {
  canonicalStringify,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
  EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
  electroChargedPropagationGoldenFixtureV141Schema,
  assertTrustedSimulationResult,
  reactionDeliveryResultReferencesSchema,
  simulationResultSchema,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { beforeAll, describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import {
  parseEventStepResult,
  simulateEventStepResult,
  type EventStepResult,
} from "../event-step-result";
import { makeConfig, neutralStats } from "./fixtures";

const UPDATE_FLAG = "UPDATE_EC_PROPAGATION_V141_GOLDEN";
const EXPECTED_FIXTURE_SHA256 =
  "b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18";
const EXPECTED_SCENARIO_SHA256 =
  "b00a4a02e859e7744660fb71ed859763a67b0cb08dfb8cc8146e46f409d6e92c";
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/electro-charged-propagation-1.41.golden.json",
  import.meta.url,
);
const SOURCE_TARGET_ID = "enemy-0";
const EXPECTED_CANDIDATE_OUTCOMES = [
  {
    targetId: SOURCE_TARGET_ID,
    selected: true,
    reason: "SOURCE_STREAM_TARGET",
  },
  {
    targetId: "wet-boundary",
    selected: true,
    reason: "NEARBY_WET_IN_RANGE",
  },
  {
    targetId: "dry-nearby",
    selected: false,
    reason: "NO_HYDRO_AURA",
  },
  {
    targetId: "wet-outside",
    selected: false,
    reason: "OUT_OF_RANGE",
  },
  {
    targetId: "wet-unresolved",
    selected: false,
    reason: "POSITION_UNRESOLVED",
  },
  {
    targetId: "wet-immune",
    selected: true,
    reason: "NEARBY_WET_IN_RANGE",
  },
] as const;

function makePropagationGoldenConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  return makeConfig({
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
    },
    dataVersion: "ec-propagation-community-provisional-1",
    randomSeed: "ec-propagation-v141-golden-seed",
    meta: {
      name: "Electro-Charged propagation Golden",
      version: "1.41.0",
      verificationStatus: "provisional",
      note: "Community-provisional regression vector. Nearby-Wet selection is not implemented by the pinned gcsim reference and is not official game data.",
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: SOURCE_TARGET_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          resistance: 0.1,
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
        {
          id: "wet-boundary",
          name: "Wet boundary",
          position: { x: 3.5, y: 0 },
          hitboxRadius: 0.5,
          resistance: 0.5,
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
        {
          id: "dry-nearby",
          name: "Dry nearby",
          position: { x: 1, y: 0 },
          hitboxRadius: 0,
        },
        {
          id: "wet-outside",
          name: "Wet outside",
          position: { x: 3.51, y: 0 },
          hitboxRadius: 0.5,
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
        {
          id: "wet-unresolved",
          name: "Wet unresolved",
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
        {
          id: "wet-immune",
          name: "Wet immune",
          position: { x: 2, y: 0 },
          hitboxRadius: 0,
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
      ],
      targetPhases: [
        {
          id: "immune-at-first-tick",
          label: "Immune at first tick",
          targetId: "wet-immune",
          startFrame: 10,
          endFrame: 11,
          reason: "TEST_EC_IMMUNE",
          effects: {
            damage: "immune",
            aura: "normal",
            hitConfirm: "normal",
          },
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "ec-owner",
        name: "EC Owner",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          em: 120,
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1",
    },
    electroChargedPropagationModel: {
      mode: "nearby-wet-radius-v1",
      radius: 3,
      verificationStatus: "provisional",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "ec-owner",
      swapFrames: 1,
      abilities: [
        {
          id: "start-ec",
          actorId: "ec-owner",
          name: "Start EC",
          kind: "skill",
          cancelFrame: 11,
          animationEndFrame: 11,
          cooldownFrames: 0,
          hits: [
            {
              id: "start-source-with-unresolved-candidate",
              label: "Start source with unresolved candidate",
              frame: 0,
              scaling: 1,
              element: "electro",
              targeting: {
                targetId: SOURCE_TARGET_ID,
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "ec-owner",
          abilityId: "start-ec",
        },
      ],
    },
  });
}

const NO_ICD_DECISION = {
  kind: "no-icd",
  evaluated: true,
  consumed: false,
  applicationMultiplier: 1,
  allowed: true,
  scope: null,
  profileId: null,
  icdTag: null,
  groupId: null,
  windowStartGroupId: null,
  resetFrames: null,
  windowStartFrame: null,
  resetAtFrame: null,
  hitIndex: null,
  sequenceIndex: null,
  tailPolicy: null,
  resetSchedulePolicy: "bypass",
} as const;

function expectCurrentApplicationContract(result: SimulationResult): void {
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  expect(result.freezeBrokenAttackLog).toEqual([]);
  expect(result.mechanicsStatus).toBe("complete");
  expect(result.config.elementalApplicationIcdModel).toEqual({
    mode: "fixed-gcsim-elemental-application-v1",
    profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  });
  expect(result.runManifest.elementalApplicationIcdRoot).toEqual(
    GCSIM_ELEMENTAL_APPLICATION_ROOT,
  );
  expect(result.config.timeline?.abilities[0]?.hits?.[0]?.application).toEqual({
    gaugeUnits: 1,
    icd: { mode: "no-icd-v1" },
  });
  expect(
    result.elementalApplicationIcdLog.map((entry) => ({
      id: entry.id,
      frame: entry.frame,
      sourceActorId: entry.sourceActorId,
      targetId: entry.targetId,
      hitId: entry.hitId,
      selector: entry.selector,
      nominalGaugeUnits: entry.nominalGaugeUnits,
      effectiveGaugeUnits: entry.effectiveGaugeUnits,
      decision: entry.decision,
    })),
  ).toEqual([
    {
      id: 0,
      frame: 0,
      sourceActorId: "ec-owner",
      targetId: SOURCE_TARGET_ID,
      hitId: "start-source-with-unresolved-candidate",
      selector: { mode: "no-icd-v1" },
      nominalGaugeUnits: 1,
      effectiveGaugeUnits: 1,
      decision: NO_ICD_DECISION,
    },
  ]);
}

function projectDamageEventsToFrozenNoIcd(result: SimulationResult) {
  const legacyAuditByDamageEventId = new Map(
    result.elementalApplicationIcdLog.flatMap((entry) =>
      entry.damageEventId === null || entry.selector.mode !== "no-icd-v1"
        ? []
        : [
            [
              entry.damageEventId,
              {
                icdAllowed: entry.decision.allowed,
                icdTag: entry.hitId,
                icdGroup: "no-icd" as const,
              },
            ] as const,
          ],
    ),
  );
  return result.damageEvents.map((currentEvent) => {
    const {
      elementalApplicationIcdLogId: _elementalApplicationIcdLogId,
      ...event
    } = currentEvent;
    const legacyAudit = legacyAuditByDamageEventId.get(event.id);
    return legacyAudit === undefined
      ? event
      : {
          ...event,
          reactionAudit: {
            ...event.reactionAudit,
            ...legacyAudit,
          },
        };
  });
}

function projectReactionDamageLogToFrozenV147(result: SimulationResult) {
  return result.reactionDamageLog.map(
    ({
      hitResolutionLogIds: _hitResolutionLogIds,
      elementalApplicationIcdLogIds: _elementalApplicationIcdLogIds,
      damageGroupDecisions,
      ...entry
    }) => ({
      ...entry,
      damageGroupDecisions: damageGroupDecisions.map((decision) => ({
        reaction: decision.reaction,
        sourceActorId: decision.sourceActorId,
        targetId: decision.targetId,
        windowStartFrame: decision.windowStartFrame,
        hitIndex: decision.hitIndex,
        resetFrames: 30 as const,
        sequence:
          decision.icdGroup === "reaction-a"
            ? ([true, true, false] as const)
            : ([true, false] as const),
        damageAllowed: decision.damageAllowed,
        blockedReason: decision.blockedReason,
      })),
    }),
  );
}

function projectHitResolutionLogToFrozenV147(result: SimulationResult) {
  return result.hitResolutionLog.map(
    ({
      reactionDamageLogId: _reactionDamageLogId,
      elementalApplicationIcdLogId: _elementalApplicationIcdLogId,
      ...entry
    }) => entry,
  );
}

function projectPropagationScenario(result: SimulationResult) {
  const frozenDamageEvents = projectDamageEventsToFrozenNoIcd(result);
  const reactionDamage = projectReactionDamageLogToFrozenV147(result).filter(
    (entry) => entry.reaction === "electroCharged" && entry.withinSimulation,
  );
  const reactionDamageIds = new Set(reactionDamage.map((entry) => entry.id));
  const propagationDamageEventIds = new Set(
    reactionDamage.flatMap((entry) => entry.damageEventIds),
  );
  const triggerDamageEventIds = new Set(
    reactionDamage.flatMap((entry) =>
      entry.triggerDamageEventId === null ? [] : [entry.triggerDamageEventId],
    ),
  );
  const relevantDamageEventIds = new Set([
    ...triggerDamageEventIds,
    ...propagationDamageEventIds,
  ]);
  const relevantHitResolutionIds = new Set(
    reactionDamage.flatMap(
      (entry) =>
        entry.electroChargedPropagation?.candidates.flatMap((candidate) =>
          candidate.hitResolutionLogId === null
            ? []
            : [candidate.hitResolutionLogId],
        ) ?? [],
    ),
  );
  const candidateAuraWitnesses = result.targetStateTimeline.points.filter(
    (point) =>
      point.cause === "electro-charged-propagation-candidate" &&
      point.links.some(
        (link) =>
          link.kind === "reaction-damage-log" && reactionDamageIds.has(link.id),
      ),
  );
  const propagationDamageApplicationPoints =
    result.targetStateTimeline.points.filter(
      (point) =>
        point.cause === "reaction-damage-application" &&
        point.links.some(
          (link) =>
            (link.kind === "reaction-damage-log" &&
              reactionDamageIds.has(link.id)) ||
            (link.kind === "damage-event" &&
              propagationDamageEventIds.has(link.id)),
        ),
    );

  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      resolvedRuntimeOptions: result.resolvedRuntimeOptions,
    },
    configContract: {
      reactionEngine: result.config.reactionEngine,
      targetClockModel: result.config.targetClockModel,
      targetTaskModel: result.config.targetTaskModel,
      reactionDeliveryModel: result.config.reactionDeliveryModel,
      electroChargedPropagationModel:
        result.config.electroChargedPropagationModel,
      timeline: {
        mode: result.config.timeline?.mode ?? null,
        fps: result.config.timeline?.fps ?? null,
      },
      enemyTargets: result.enemyTargets,
    },
    periodicElectroCharged: result.periodicReactionLog.filter(
      (entry) => entry.reaction === "electroCharged",
    ),
    reactionDamage,
    reactionBDecisions: reactionDamage.flatMap(
      (entry) => entry.damageGroupDecisions,
    ),
    triggerDamageEvents: frozenDamageEvents.filter((event) =>
      triggerDamageEventIds.has(event.id),
    ),
    propagationDamageChildren: frozenDamageEvents.filter((event) =>
      propagationDamageEventIds.has(event.id),
    ),
    relevantHitResolutions: projectHitResolutionLogToFrozenV147(result).filter(
      (entry) =>
        relevantHitResolutionIds.has(entry.id) ||
        (entry.damageEventId !== null &&
          relevantDamageEventIds.has(entry.damageEventId)),
    ),
    allRelatedDamageEvents: frozenDamageEvents.filter((event) =>
      relevantDamageEventIds.has(event.id),
    ),
    targetStateTimeline: result.targetStateTimeline,
    candidateAuraWitnesses,
    propagationDamageApplicationPoints,
    auraInitialStates: result.auraInitialStates,
    auraEndStates: result.auraEndStates,
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length,
    },
  };
}

type PropagationGoldenScenario = ReturnType<typeof projectPropagationScenario>;

type FrozenV141PropagationGoldenScenario = Omit<
  PropagationGoldenScenario,
  "identity"
> & {
  identity: Omit<
    PropagationGoldenScenario["identity"],
    "schemaVersion" | "engineVersion"
  > & {
    schemaVersion: typeof EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION;
    engineVersion: typeof EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION;
  };
};

interface PropagationGoldenFixture {
  fixtureVersion: "electro-charged-propagation-1.41";
  description: string;
  provenance: {
    referenceProject: "genshinsim/gcsim";
    referenceCommit: string;
    mechanicsDataStatus: "community-provisional";
    capturedAt: string;
    notes: string[];
  };
  scenario: FrozenV141PropagationGoldenScenario;
  scenarioSha256: string;
}

function semanticHash(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function atomicCreateJsonFixture(outputUrl: URL, value: unknown): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
  try {
    linkSync(temporaryPath, outputPath);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

function loadOrCreateFixture(
  generatedFixture: PropagationGoldenFixture,
): PropagationGoldenFixture {
  if (process.env[UPDATE_FLAG] === "1") {
    atomicCreateJsonFixture(FIXTURE_URL, generatedFixture);
    return generatedFixture;
  }
  return JSON.parse(
    readFileSync(FIXTURE_URL, "utf8"),
  ) as PropagationGoldenFixture;
}

// Shared mechanics only: this helper never rewrites a result's version, queue,
// substep identities, or persisted wire. Both contracts must satisfy it.
function expectPropagationMechanics(
  scenario: Omit<PropagationGoldenScenario, "identity">,
): void {
  const reactionDamage = scenario.reactionDamage[0]!;
  const audit = reactionDamage.electroChargedPropagation!;
  expect(reactionDamage).toMatchObject({
    damageFrame: 10,
    targetingMode: "electro-charged-nearby-wet",
    checkedTargetIds: [SOURCE_TARGET_ID, "wet-boundary", "wet-immune"],
    hitTargetIds: [SOURCE_TARGET_ID, "wet-boundary", "wet-immune"],
    unresolvedTargetIds: ["wet-unresolved"],
  });
  expect(audit).toMatchObject({
    model: "nearby-wet-radius-v1",
    verificationStatus: "provisional",
    mechanicsDataStatus: "community-provisional",
    generation: 1,
    tickIndex: 0,
    evaluationFrame: 10,
    eventPriority: 5,
    radius: 3,
    selectionMode: "all-in-range-registration-order-v1",
  });
  expect(
    audit.candidates.map(({ targetId, selected, reason }) => ({
      targetId,
      selected,
      reason,
    })),
  ).toEqual(EXPECTED_CANDIDATE_OUTCOMES);
  expect(
    scenario.reactionBDecisions.map(
      ({ reaction, targetId, damageAllowed, blockedReason }) => ({
        reaction,
        targetId,
        damageAllowed,
        blockedReason,
      }),
    ),
  ).toEqual([
    {
      reaction: "electroCharged",
      targetId: SOURCE_TARGET_ID,
      damageAllowed: true,
      blockedReason: null,
    },
    {
      reaction: "electroCharged",
      targetId: "wet-boundary",
      damageAllowed: true,
      blockedReason: null,
    },
    {
      reaction: "electroCharged",
      targetId: "wet-immune",
      damageAllowed: true,
      blockedReason: null,
    },
  ]);

  const children = scenario.propagationDamageChildren;
  expect(children.map((event) => event.targetId)).toEqual([
    SOURCE_TARGET_ID,
    "wet-boundary",
    "wet-immune",
  ]);
  expect(
    new Set(children.map((event) => event.parentDamageEventId)).size,
  ).toBe(1);
  expect(
    children.find((event) => event.targetId === "wet-immune"),
  ).toMatchObject({
    targetDamagePolicy: "immune",
    finalDamage: 0,
  });
  expect(
    scenario.periodicElectroCharged.some(
      (entry) => entry.targetId !== SOURCE_TARGET_ID,
    ),
  ).toBe(false);

  const candidateAuraWitnesses =
    scenario.candidateAuraWitnesses;
  expect(candidateAuraWitnesses.map((point) => point.targetId)).toEqual(
    EXPECTED_CANDIDATE_OUTCOMES.map((candidate) => candidate.targetId),
  );
  for (const candidate of audit.candidates) {
    const witness = candidateAuraWitnesses.find(
      (point) => point.id === candidate.auraObservationTimelinePointId,
    );
    expect(witness).toMatchObject({
      id: candidate.auraObservationTimelinePointId,
      frame: audit.evaluationFrame,
      targetId: candidate.targetId,
      targetName: candidate.targetName,
      pointKind: "observation",
      cause: "electro-charged-propagation-candidate",
      eventType: "reactionDamage",
      eventPriority: audit.eventPriority,
      eventSequence: audit.eventSequence,
      reaction: "electroCharged",
      reactions: ["electroCharged"],
      primaryDamageEventId: null,
      links: [
        {
          kind: "reaction-damage-log",
          id: reactionDamage.id,
        },
      ],
      auraApplied: [],
      auraConsumed: [],
    });
    expect(witness?.auraAfter).toEqual(witness?.auraBefore);
    expect(
      witness?.auraBefore.find((entry) => entry.element === "hydro")
        ?.gaugeUnits ?? 0,
    ).toBe(candidate.hydroGaugeUnits);
  }
  const witnessIntraEventSequences = candidateAuraWitnesses.map(
    (point) => point.intraEventSequence!,
  );
  expect(witnessIntraEventSequences).toEqual(
    [...witnessIntraEventSequences].sort((left, right) => left - right),
  );
  expect(new Set(witnessIntraEventSequences).size).toBe(
    candidateAuraWitnesses.length,
  );

  const secondaryDamageTimeline =
    scenario.propagationDamageApplicationPoints.filter(
      (point) => point.targetId !== SOURCE_TARGET_ID,
    );
  expect(secondaryDamageTimeline.map((point) => point.targetId)).toEqual([
    "wet-boundary",
    "wet-immune",
  ]);
  expect(
    secondaryDamageTimeline.every(
      (point) =>
        point.cause === "reaction-damage-application" &&
        point.reaction === "electroCharged" &&
        point.reactions.includes("electroCharged") &&
        canonicalStringify(point.auraBefore) ===
          canonicalStringify(point.auraAfter) &&
        point.auraApplied.length === 0 &&
        point.auraConsumed.length === 0,
    ),
  ).toBe(true);
  for (const candidate of audit.candidates) {
    const damageApplication =
      scenario.propagationDamageApplicationPoints.find(
        (point) => point.targetId === candidate.targetId,
      );
    if (candidate.selected) {
      expect(damageApplication).toBeDefined();
      expect(candidate.auraObservationTimelinePointId).toBeLessThan(
        damageApplication!.id,
      );
    } else {
      expect(damageApplication).toBeUndefined();
    }
  }

}

function readFrozenFixture(): PropagationGoldenFixture {
  const bytes = readFileSync(FIXTURE_URL);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    EXPECTED_FIXTURE_SHA256,
  );
  const fixture = JSON.parse(bytes.toString("utf8")) as PropagationGoldenFixture;
  expect(electroChargedPropagationGoldenFixtureV141Schema.parse(fixture)).toEqual(
    fixture,
  );
  // Retain the original update flag and refusal to overwrite an existing file.
  // This frozen vector must already exist; never recreate it from current output.
  return loadOrCreateFixture(fixture);
}

function expectedAura(
  element: "hydro" | "electro",
  gaugeUnits: number,
  expiresAtFrame: number,
) {
  return {
    element,
    gaugeUnits,
    expiresAtFrame,
    sourceSlots: [{
      sourceActorId: element === "hydro" ? "__initial__" : "ec-owner",
      gaugeUnits,
    }],
  };
}

function expectIndependentDamageAndAura(result: SimulationResult): void {
  // Independent arithmetic for the configured Classic profile: level-90 base,
  // EC multiplier 2, 120 EM, 20% reaction bonus, and each target's resistance.
  // Do not call the production calculator to manufacture expected damage.
  const emBonus = 16 * 120 / (2000 + 120);
  const preResistance = 1446.8535 * 2 * (1 + emBonus + 0.2);
  const expectedDamage = [1000 * 0.5 * 0.9, preResistance * 0.9, preResistance * 0.5, 0];
  expect(result.damageEvents.map(event => event.finalDamage)).toEqual(expectedDamage);
  expect(result.totalDamage).toBe(expectedDamage.reduce((sum, value) => sum + value, 0));
  expect(result.dps).toBe(result.totalDamage);
  expect(result.reactedHits).toBe(1);
  expect(result.skippedActions).toEqual([]);
  for (const event of result.damageEvents.slice(1)) {
    expect(event).toMatchObject({
      frame: 10, eventPriority: 5, eventSequence: 17,
      parentDamageEventId: 0, sourceActorId: "ec-owner",
      scalingOwnerId: "ec-owner", creditOwnerId: "ec-owner",
      transformativeReactionFactors: {
        characterLevel: 90, levelBaseDamage: 1446.8535,
        baseMultiplier: 2, elementalMastery: 120,
        elementalMasteryBonus: emBonus, reactionBonus: 0.2,
        preResistanceDamage: preResistance,
      },
    });
  }
  expect(result.damageEvents[3]!.potentialDamage).toBe(preResistance * 0.9);

  // A 1U initial/application aura is taxed to 0.8U and decays over 570F.
  // The source alone loses 0.4U of each coexisting element at F10+6; no
  // propagated child applies Electro or starts a secondary periodic stream.
  const rounded = (value: number) => Number(value.toFixed(12));
  const gaugeAt = (frame: number) => rounded(0.8 - 0.8 * frame / 570);
  const pair = (gauge: number, expiry: number) => [
    expectedAura("electro", gauge, expiry),
    expectedAura("hydro", gauge, expiry),
  ];
  const [start, tick, wane] = result.periodicReactionLog;
  expect(result.periodicReactionLog).toHaveLength(3);
  expect(start).toMatchObject({operation: "start", frame: 0, nextTickFrame: 70,
    targetId: SOURCE_TARGET_ID, sourceActorId: "ec-owner", generation: 1,
    auraBefore: [expectedAura("hydro", 0.8, 570)],
    auraConsumed: [], auraAfter: pair(0.8, 570)});
  expect(tick).toMatchObject({operation: "tick", frame: 10, nextTickFrame: 70,
    waneFrame: 16, tickIndex: 0, targetId: SOURCE_TARGET_ID,
    auraBefore: pair(gaugeAt(10), 570), auraConsumed: [],
    auraAfter: pair(gaugeAt(10), 570)});
  const afterWane = rounded(gaugeAt(16) - 0.4);
  expect(wane).toMatchObject({operation: "wane", frame: 16, nextTickFrame: 70,
    waneFrame: 16, tickIndex: 0, targetId: SOURCE_TARGET_ID,
    auraBefore: pair(gaugeAt(16), 570), auraAfter: pair(afterWane, 285)});
  expect(wane!.auraConsumed).toEqual(["hydro", "electro"].map(element => ({
    element, gaugeUnits: 0.4, sourceMutations: [{
      sourceActorId: element === "hydro" ? "__initial__" : "ec-owner",
      gaugeUnitsBefore: gaugeAt(16), consumedGaugeUnits: 0.4,
      gaugeUnitsAfter: afterWane,
    }],
  })));
  const targets = makePropagationGoldenConfig().enemy.targets!;
  expect(result.auraInitialStates).toEqual(targets.map(target => ({
    targetId: target.id, targetName: target.name, frame: 0, timeSeconds: 0,
    aura: target.id === "dry-nearby" ? [] : [expectedAura("hydro", 0.8, 570)],
  })));
  expect(result.auraEndStates).toEqual(targets.map(target => ({
    targetId: target.id, targetName: target.name, frame: 60, timeSeconds: 1,
    aura: target.id === SOURCE_TARGET_ID
      ? pair(rounded(gaugeAt(60) - 0.4), 285)
      : target.id === "dry-nearby" ? [] : [expectedAura("hydro", gaugeAt(60), 570)],
  })));
}

function expectExactCurrentWitness(wire: EventStepResult): void {
  expect(wire.evidence.events).toEqual([{
    frame: 0, eventPriority: 3, eventSequence: 1,
    allocationCount: 2, hitResolutionLogId: 0,
    steps: [
      {sequence: 0, site: {kind: "hit-resolution", id: 0}},
      {sequence: 1, site: {kind: "aura-application", damageEventId: 0}},
    ],
  }]);
  const selectedTargets = [SOURCE_TARGET_ID, "wet-boundary", "wet-immune"];
  expect(wire.evidence.propagationEvents).toEqual([{
    frame: 10, eventPriority: 5, eventSequence: 17, allocationCount: 9,
    reactionDamageLogId: 0, sourceActorId: "ec-owner",
    sourceTargetId: SOURCE_TARGET_ID, triggerDamageEventId: 0,
    operations: [
      ...EXPECTED_CANDIDATE_OUTCOMES.map((candidate, sequence) => ({
        operation: "allocate", sequence, site: {
          kind: "propagation-candidate", reactionDamageLogId: 0,
          targetId: candidate.targetId,
        },
      })),
      ...selectedTargets.flatMap((targetId, index) => [
        {operation: "allocate", sequence: 6 + index, site: {
          kind: "propagation-application", reactionDamageLogId: 0,
          targetId, damageEventId: index + 1,
        }},
        // A hit observes the cursor without allocating it. It deliberately
        // shares the next child's application position, not an invented gap.
        {operation: "observe-hit", sequence: 7 + index,
          hitResolutionLogId: index + 1, targetId},
      ]),
    ],
  }]);
}

function expectVersionedTimelineComparison(
  current: SimulationResult,
  historical: PropagationGoldenFixture,
): void {
  // Compare the entire Aura/link/clock lifecycle, while pinning the known new
  // queue identities and direct allocation explicitly. This is an assertion
  // oracle, NOT a migration or a fabricated historical simulation result.
  const expected = structuredClone(historical.scenario.targetStateTimeline);
  for (const point of expected.points) {
    switch (point.cause) {
      case "direct-hit-application": point.intraEventSequence = 1; break;
      case "electro-charged-tick": point.eventSequence = 10; break;
      case "electro-charged-propagation-candidate":
      case "reaction-damage-application": point.eventSequence = 17; break;
      case "electro-charged-wane": point.eventSequence = 19; break;
    }
  }
  expect(current.targetStateTimeline).toEqual(expected);
  expect(current.periodicReactionLog).toEqual(historical.scenario.periodicElectroCharged);
  expect(current.auraInitialStates).toEqual(historical.scenario.auraInitialStates);
  expect(current.auraEndStates).toEqual(historical.scenario.auraEndStates);
}

describe("Electro-Charged nearby-Wet frozen 1.41 contract", () => {
  it("reads the authentic frozen 1.41 Golden without re-simulating or relabeling it", () => {
    const fixture = readFrozenFixture();
    expect(fixture.scenario.identity).toMatchObject({
      schemaVersion: EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
      engineVersion: EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
      configHash: "fnv1a32:c6f195e0", reproducibilityKey: "gdl-v2-fnv1a32-cc0079e7",
    });
    expect(semanticHash(fixture.scenario)).toBe(EXPECTED_SCENARIO_SHA256);
    expect(fixture.scenarioSha256).toBe(EXPECTED_SCENARIO_SHA256);
    expectPropagationMechanics(fixture.scenario);
    expect(fixture.scenario.targetStateTimeline.points.find(
      point => point.cause === "direct-hit-application",
    )!.intraEventSequence).toBe(0);
  });
});

describe("Electro-Charged nearby-Wet current 1.54 contract", () => {
  let current: ReturnType<typeof simulateEventStepResult>;
  beforeAll(() => {
    current = simulateEventStepResult(makePropagationGoldenConfig(), {critMode: "noCrit"});
  });

  it("proves the current 1.54 fanout, exact allocations, damage and source-only Aura lifecycle", () => {
    const {result, wire} = current;
    const repeated = simulateEventStepResult(makePropagationGoldenConfig(), {critMode: "noCrit"});
    expect(repeated).toEqual(current);
    expect(parseEventStepResult(JSON.parse(JSON.stringify(wire))).result).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    expect(wire.result.schemaVersion).toBe("1.54.0-event-steps");
    expect(wire.result.engineVersion).toBe("1.54.0-event-steps");
    expectCurrentApplicationContract(result);
    expect(result.dataVersion).toBe("ec-propagation-community-provisional-1");
    expect(result.randomSeed).toBe("ec-propagation-v141-golden-seed");
    expect(result.config.electroChargedPropagationModel).toEqual({
      mode: "nearby-wet-radius-v1", radius: 3, verificationStatus: "provisional",
    });
    expectPropagationMechanics(projectPropagationScenario(result));
    expectIndependentDamageAndAura(result);
    expectExactCurrentWitness(wire);
    expectVersionedTimelineComparison(result, readFrozenFixture());
  });

  it("keeps the historical gate strict instead of pretending current allocations are 1.41/1.53", () => {
    expect(() => simulate(makePropagationGoldenConfig(), {critMode: "noCrit"})).toThrow(
      "direct Electro-Charged trigger requires one exact target-clock Aura-application timeline backlink",
    );
    expect(() => reactionDeliveryResultReferencesSchema.parse(current.result)).toThrow(
      "direct Electro-Charged trigger requires one exact target-clock Aura-application timeline backlink",
    );
    expect(simulationResultSchema.safeParse(current.result).success).toBe(false);
    const relabeled = structuredClone(current.wire);
    relabeled.result.schemaVersion = "1.41.0" as never;
    expect(() => parseEventStepResult(relabeled)).toThrow("Event-step result identity mismatch");
  });

  it.each([
    ["missing direct allocation", (wire: EventStepResult) => {wire.evidence.events[0]!.steps.pop();}],
    ["duplicated direct allocation", (wire: EventStepResult) => {wire.evidence.events[0]!.steps.push(wire.evidence.events[0]!.steps[1]!);}],
    ["reordered direct allocations", (wire: EventStepResult) => {wire.evidence.events[0]!.steps.reverse();}],
    ["coherently omitted direct application", (wire: EventStepResult) => {
      wire.evidence.events[0]!.steps.pop(); wire.evidence.events[0]!.allocationCount--;
      wire.result.targetStateTimeline.points.find(point => point.cause === "direct-hit-application")!.intraEventSequence = 0;
    }],
    ["wrong trigger queue", (wire: EventStepResult) => {wire.evidence.events[0]!.eventSequence++;}],
    ["missing propagation candidate", (wire: EventStepResult) => {wire.evidence.propagationEvents[0]!.operations.shift();}],
    ["reordered propagation operations", (wire: EventStepResult) => {wire.evidence.propagationEvents[0]!.operations.reverse();}],
    ["cross-target propagation hit", (wire: EventStepResult) => {
      const operation = wire.evidence.propagationEvents[0]!.operations.find(op => op.operation === "observe-hit")!;
      if (operation.operation === "observe-hit") operation.targetId = "wet-boundary";
    }],
    ["false direct backlink", (wire: EventStepResult) => {
      wire.result.targetStateTimeline.points.find(point => point.cause === "direct-hit-application")!.primaryDamageEventId = 1;
    }],
    ["changed source Wane", (wire: EventStepResult) => {wire.result.periodicReactionLog.find(row => row.operation === "wane")!.auraConsumed[0]!.gaugeUnits = 0.3;}],
    ["changed child damage", (wire: EventStepResult) => {wire.result.damageEvents[1]!.finalDamage++;}],
    ["changed child parent", (wire: EventStepResult) => {wire.result.damageEvents[1]!.parentDamageEventId = 2;}],
  ] as const)("rejects %s at the public current envelope", (_label, mutate) => {
    const changed = structuredClone(current.wire);
    mutate(changed);
    expect(() => parseEventStepResult(changed)).toThrow();
  });
});
