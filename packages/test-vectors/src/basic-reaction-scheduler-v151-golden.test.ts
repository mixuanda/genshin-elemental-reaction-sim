import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  assertTrustedSimulationResultV151,
  assertTrustedSimulationResultV153,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  basicReactionSchedulerLogEntrySchema,
  basicReactionSchedulerModelSchema,
  basicReactionSchedulerRootSchema,
  simulationResultV151Schema,
  simulationResultV153Schema,
  simulationRunManifestV151Schema,
  targetStateTimelinePointSchema,
  type BasicReactionSchedulerModel,
  type SimConfig,
  type SimulationResultForV151,
  type SimulationResultForV153,
} from "@genshin-dps-lab/schemas";
import { z } from "zod";
import { beforeAll, describe, expect, it } from "vitest";

import { simulate } from "../../sim-core/src/simulator";
import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";
import { projectSimulationResultV152ToV151 } from "./project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";
import { withV152CompatibilityPolicies } from "./v152-compatibility-config";

const PREVIEW_FLAG = "PREVIEW_BASIC_REACTION_SCHEDULER_V151_GOLDEN";
const UPDATE_FLAG = "UPDATE_BASIC_REACTION_SCHEDULER_V151_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "25cf50a6f39eb9bf4de2d709c896dc74e079493ef2b4e81dfad8d65d17fa4424";
const FIXTURE_URL = new URL(
  "../fixtures/basic-reaction-scheduler-1.51.golden.json",
  import.meta.url,
);

const LEGACY_SCHEDULER = {
  mode: "legacy-immediate-basic-reaction-scheduler-v1",
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} as const satisfies BasicReactionSchedulerModel;

const NATIVE_SCHEDULER = {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2",
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
} as const satisfies BasicReactionSchedulerModel;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const nonNegativeIntegerSchema = z.number().int().nonnegative();

const propagationSchema = z
  .object({
    id: nonNegativeIntegerSchema,
    frame: z.literal(15),
    eventSequence: nonNegativeIntegerSchema,
    sourceActorId: z.enum(["anemo-pyro", "anemo-cryo"]),
    targetId: z.literal("enemy-0"),
    reaction: z.enum(["swirlPyro", "swirlCryo"]),
    nestedReaction: z.enum(["none", "reverseMelt"]),
    finalDamage: z.number().finite().nonnegative(),
    displayDamage: nonNegativeIntegerSchema,
  })
  .strict();

const auraEntrySchema = z
  .object({
    element: z.enum(["pyro", "cryo"]),
    gaugeUnits: z.number().finite().positive(),
  })
  .strict();

const scenarioSchema = z
  .object({
    identity: z
      .object({
        schemaVersion: z.literal(BASIC_REACTION_SCHEDULER_SCHEMA_VERSION),
        engineVersion: z.literal(BASIC_REACTION_SCHEDULER_ENGINE_VERSION),
        dataVersion: z.string().min(1),
        randomSeed: z.string().min(1),
        configHash: z.string().regex(/^fnv1a32:[0-9a-f]{8}$/),
        reproducibilityKey: z.string().regex(/^gdl-v2-fnv1a32-[0-9a-f]{8}$/),
        selectedModel: basicReactionSchedulerModelSchema,
        selectedRoot: basicReactionSchedulerRootSchema,
        runManifest: simulationRunManifestV151Schema,
      })
      .strict(),
    totals: z
      .object({
        totalDamage: z.number().finite().nonnegative(),
        dps: z.number().finite().nonnegative(),
        damageEventCount: nonNegativeIntegerSchema,
        schedulerLogCount: nonNegativeIntegerSchema,
      })
      .strict(),
    sharedTargetPropagations: z.array(propagationSchema).length(2),
    sharedTargetSchedulerLog: z.array(basicReactionSchedulerLogEntrySchema),
    sharedTargetTimeline: z.array(targetStateTimelinePointSchema),
    sharedTargetFinalAura: z.array(auraEntrySchema),
    canonicalSha256: z
      .object({
        config: sha256Schema,
        runManifest: sha256Schema,
        sharedTargetPropagations: sha256Schema,
        sharedTargetSchedulerLog: sha256Schema,
        sharedTargetTimeline: sha256Schema,
        sharedTargetFinalAura: sha256Schema,
      })
      .strict(),
  })
  .strict();

const fixtureSchema = z
  .object({
    fixtureVersion: z.literal("1.0.0"),
    description: z.string().min(1),
    provenance: z
      .object({
        sourceProject: z.literal("genshinsim/gcsim"),
        sourceRevision: z.literal("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"),
        capturedAt: z.literal("2026-08-02"),
        verificationStatus: z.literal("reviewed-provisional"),
        note: z.string().min(1),
        officialServerTruth: z.literal(false),
        completeGcsimParity: z.literal(false),
      })
      .strict(),
    currentIdentity: z
      .object({
        schemaVersion: z.literal(BASIC_REACTION_SCHEDULER_SCHEMA_VERSION),
        engineVersion: z.literal(BASIC_REACTION_SCHEDULER_ENGINE_VERSION),
        runManifestVersion: z.literal(
          BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
        ),
      })
      .strict(),
    policyRoots: z
      .object({
        legacyImmediateV1: basicReactionSchedulerRootSchema,
        deferredAttachmentV2: basicReactionSchedulerRootSchema,
      })
      .strict(),
    vector: z
      .object({
        sourceTargets: z.tuple([
          z.object({
            id: z.literal("source-pyro"),
            element: z.literal("pyro"),
            x: z.literal(-4),
            y: z.literal(0),
          }),
          z.object({
            id: z.literal("source-cryo"),
            element: z.literal("cryo"),
            x: z.literal(4),
            y: z.literal(0),
          }),
        ]),
        sharedTarget: z.object({
          id: z.literal("enemy-0"),
          startsWithAura: z.literal(false),
          x: z.literal(0),
          y: z.literal(0),
        }),
        anemoHitFrames: z.tuple([z.literal(10), z.literal(10)]),
        swirlPropagationFrame: z.literal(15),
        insertionOrder: z.tuple([
          z.literal("anemo-pyro"),
          z.literal("anemo-cryo"),
        ]),
      })
      .strict(),
    expectedDifference: z
      .object({
        legacyNestedReactions: z.tuple([
          z.literal("none"),
          z.literal("reverseMelt"),
        ]),
        correctedNestedReactions: z.tuple([
          z.literal("none"),
          z.literal("none"),
        ]),
        correctedDeferredAttackCount: z.literal(2),
        correctedDeferredCommitCount: z.literal(2),
        correctedFinalAuraElements: z.tuple([
          z.literal("cryo"),
          z.literal("pyro"),
        ]),
      })
      .strict(),
    limitations: z
      .object({
        covered: z.tuple([
          z.literal("same-frame-mixed-swirl-attack-resolution"),
          z.literal("zero-delay-nonreacted-aura-attachment"),
          z.literal("same-priority-insertion-order"),
        ]),
        omitted: z.tuple([
          z.literal("complete-aura-and-icd-parity"),
          z.literal("all-reaction-scheduler-parity"),
          z.literal("official-character-and-enemy-data"),
          z.literal("official-server-validation"),
        ]),
        intentionalDeviation: z.literal(
          "burning-monotonic-generation-guard-not-exercised-by-this-vector",
        ),
        note: z.string().min(1),
      })
      .strict(),
    scenarios: z
      .object({
        legacyImmediateV1: scenarioSchema,
        deferredAttachmentV2: scenarioSchema,
      })
      .strict(),
  })
  .strict();

function makeSameFrameMixedSwirlConfig(
  basicReactionSchedulerModel: BasicReactionSchedulerModel,
): SimConfig {
  const base = makeConfig({ basicReactionSchedulerModel });
  const actors = ["anemo-pyro", "anemo-cryo"] as const;
  const sourceTargets = ["source-pyro", "source-cryo"] as const;
  const sourceElements = ["pyro", "cryo"] as const;
  const identity =
    basicReactionSchedulerModel.mode ===
    "legacy-immediate-basic-reaction-scheduler-v1"
      ? "synthetic-basic-reaction-scheduler-legacy-v1-1.51"
      : "synthetic-basic-reaction-scheduler-deferred-v2-1.51";

  return makeConfig({
    ...base,
    dataVersion: identity,
    randomSeed: identity,
    meta: {
      name: "V1.51 same-frame mixed Swirl scheduler vector",
      version: "1.51.0",
      verificationStatus: "provisional",
    },
    duration: 1,
    cycleLength: 1,
    basicReactionSchedulerModel,
    targetTaskModel: { mode: "target-phase-v2" },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: sourceTargets[0],
          name: "Left Swirl source",
          position: { x: -4, y: 0 },
          initialAura: [{ element: sourceElements[0], gaugeUnits: 1 }],
        },
        {
          id: sourceTargets[1],
          name: "Right Swirl source",
          position: { x: 4, y: 0 },
          initialAura: [{ element: sourceElements[1], gaugeUnits: 1 }],
        },
        {
          id: "enemy-0",
          name: "Shared empty target",
          position: { x: 0, y: 0 },
        },
      ],
    },
    characters: actors.map((actorId, index) => ({
      ...base.characters[0]!,
      id: actorId,
      name: `Anemo ${index + 1}`,
      element: "anemo" as const,
      level: 90,
      stats: {
        ...neutralStats,
        em: 100,
      },
    })),
    reactionEngine: { mode: "aura-v9" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actors[0],
      swapFrames: 1,
      abilities: actors.map((actorId, index) => ({
        id: `same-frame-swirl-${index}`,
        actorId,
        name: `Same-frame Swirl ${index + 1}`,
        kind: "skill" as const,
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: `same-frame-swirl-hit-${index}`,
            frame: index === 0 ? 10 : 8,
            scaling: 1,
            element: "anemo" as const,
            targeting: {
              targetId: sourceTargets[index]!,
              outcome: "landed" as const,
            },
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" as const },
            },
          },
        ],
      })),
      commands: [
        {
          type: "skill",
          actorId: actors[0],
          abilityId: "same-frame-swirl-0",
        },
        { type: "swap", characterId: actors[1] },
        {
          type: "skill",
          actorId: actors[1],
          abilityId: "same-frame-swirl-1",
        },
      ],
    },
  });
}

const historicalBytes = readFileSync(new URL(
  "./fixtures/historical-scheduler-golden-v153-84ff5cd.json", import.meta.url,
));
const historicalArchive = JSON.parse(historicalBytes.toString("utf8")) as {
  fixtureVersion: string;
  source: { commit: string };
  cases: Array<{ caseId: string; sourceWireSha256: string; sourceWireText: string }>;
};

function historicalSource(model: BasicReactionSchedulerModel): SimulationResultForV153 {
  const caseId = model.mode === LEGACY_SCHEDULER.mode
    ? "legacy-immediate-v1" : "deferred-attachment-v2";
  const row = historicalArchive.cases.find((entry) => entry.caseId === caseId);
  if (!row) throw new Error(`Missing authentic historical mixed-Swirl input ${caseId}`);
  expect(byteSha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  const result = JSON.parse(row.sourceWireText) as SimulationResultForV153;
  expect(result.config.basicReactionSchedulerModel).toEqual(model);
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultV153Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV153(result)).toBe(result);
  return result;
}

// Only genuine historical output is eligible for the frozen projection chain.
// Current canonical flat-stat semantics must never be stripped or relabelled.
function runScenario(model: BasicReactionSchedulerModel): SimulationResultForV151 {
  return projectSimulationResultV152ToV151(
    projectSimulationResultV153ToV152(historicalSource(model)),
  );
}

function runCurrentScenario(model: BasicReactionSchedulerModel): SimulationResultForV153 {
  const config = makeSameFrameMixedSwirlConfig(model);
  return simulate(withV152CompatibilityPolicies(config), {
    compatibilityMode: "legal-frame-v1",
    critMode: "noCrit",
    randomSeed: config.randomSeed,
  });
}

function scenarioFixture(result: SimulationResultForV151) {
  const sharedTargetPropagations = result.damageEvents
    .filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.frame === 15 &&
        event.targetId === "enemy-0",
    )
    .map((event) => ({
      id: event.id,
      frame: 15 as const,
      eventSequence: event.eventSequence,
      sourceActorId: event.sourceActorId as "anemo-pyro" | "anemo-cryo",
      targetId: "enemy-0" as const,
      reaction: event.reaction as "swirlPyro" | "swirlCryo",
      nestedReaction: event.reactionAudit.reaction as "none" | "reverseMelt",
      finalDamage: event.finalDamage,
      displayDamage: event.displayDamage,
    }));
  const sharedTargetSchedulerLog = result.basicReactionSchedulerLog.filter(
    (entry) => entry.targetId === "enemy-0",
  );
  const schedulerLogIds = new Set(
    sharedTargetSchedulerLog.map((entry) => entry.id),
  );
  const sharedTargetTimeline = result.targetStateTimeline.points.filter(
    (point) =>
      point.targetId === "enemy-0" &&
      point.links.some(
        (link) =>
          link.kind === "basic-reaction-scheduler-log" &&
          schedulerLogIds.has(link.id),
      ),
  );
  const sharedTargetFinalAura =
    result.auraEndStates
      .find((state) => state.targetId === "enemy-0")
      ?.aura.map(({ element, gaugeUnits }) => ({ element, gaugeUnits }))
      .filter(
        (entry): entry is { element: "pyro" | "cryo"; gaugeUnits: number } =>
          entry.element === "pyro" || entry.element === "cryo",
      ) ?? [];

  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      selectedModel: result.config.basicReactionSchedulerModel,
      selectedRoot: result.runManifest.basicReactionSchedulerRoot,
      runManifest: result.runManifest,
    },
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      schedulerLogCount: result.basicReactionSchedulerLog.length,
    },
    sharedTargetPropagations,
    sharedTargetSchedulerLog,
    sharedTargetTimeline,
    sharedTargetFinalAura,
    canonicalSha256: {
      config: canonicalSha256(result.config),
      runManifest: canonicalSha256(result.runManifest),
      sharedTargetPropagations: canonicalSha256(sharedTargetPropagations),
      sharedTargetSchedulerLog: canonicalSha256(sharedTargetSchedulerLog),
      sharedTargetTimeline: canonicalSha256(sharedTargetTimeline),
      sharedTargetFinalAura: canonicalSha256(sharedTargetFinalAura),
    },
  };
}

function makeFixture(
  legacy: SimulationResultForV151,
  corrected: SimulationResultForV151,
) {
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Reviewed V1.51 same-frame mixed-Swirl scheduler Golden comparing the frozen immediate-attachment compatibility mode with the deferred zero-delay attachment mode.",
    provenance: {
      sourceProject: "genshinsim/gcsim" as const,
      sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const,
      capturedAt: "2026-08-02" as const,
      verificationStatus: "reviewed-provisional" as const,
      note: "The V2 attack-then-zero-delay-attachment order is source-derived from pinned gcsim scheduler and enemy attack paths. The legacy scenario freezes prior local behavior. Neither scenario is official server truth or a claim of complete gcsim parity.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    currentIdentity: {
      schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
      engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
      runManifestVersion: BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
    },
    policyRoots: {
      legacyImmediateV1: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      deferredAttachmentV2: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
    },
    vector: {
      sourceTargets: [
        { id: "source-pyro", element: "pyro", x: -4, y: 0 },
        { id: "source-cryo", element: "cryo", x: 4, y: 0 },
      ] as const,
      sharedTarget: {
        id: "enemy-0" as const,
        startsWithAura: false as const,
        x: 0 as const,
        y: 0 as const,
      },
      anemoHitFrames: [10, 10] as const,
      swirlPropagationFrame: 15 as const,
      insertionOrder: ["anemo-pyro", "anemo-cryo"] as const,
    },
    expectedDifference: {
      legacyNestedReactions: ["none", "reverseMelt"] as const,
      correctedNestedReactions: ["none", "none"] as const,
      correctedDeferredAttackCount: 2 as const,
      correctedDeferredCommitCount: 2 as const,
      correctedFinalAuraElements: ["cryo", "pyro"] as const,
    },
    limitations: {
      covered: [
        "same-frame-mixed-swirl-attack-resolution",
        "zero-delay-nonreacted-aura-attachment",
        "same-priority-insertion-order",
      ] as const,
      omitted: [
        "complete-aura-and-icd-parity",
        "all-reaction-scheduler-parity",
        "official-character-and-enemy-data",
        "official-server-validation",
      ] as const,
      intentionalDeviation:
        "burning-monotonic-generation-guard-not-exercised-by-this-vector" as const,
      note: "This narrow synthetic fixture audits one mixed same-frame Swirl topology only. It does not validate every reaction, Aura/ICD edge, Burning callback topology, particle schedule, action frame, character, weapon, or enemy database entry.",
    },
    scenarios: {
      legacyImmediateV1: scenarioFixture(legacy),
      deferredAttachmentV2: scenarioFixture(corrected),
    },
  };
}

function expectTrustedV151(result: SimulationResultForV151): void {
  expect(simulationResultV151Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV151(result)).toBe(result);
  expect(result.schemaVersion).toBe(BASIC_REACTION_SCHEDULER_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(BASIC_REACTION_SCHEDULER_ENGINE_VERSION);
  expect(result.runManifest.version).toBe(
    BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  );
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("Basic reaction scheduler 1.51 Golden review gate", () => {
  it("pins authentic original inputs separately from the frozen reviewed Golden", () => {
    expect(byteSha256(historicalBytes)).toBe("9d23b660f8268e71419b352c1645f50dc938fbeea14ee652ebff378a903e3af4");
    expect(historicalArchive.fixtureVersion).toBe("historical-scheduler-golden-v153-84ff5cd-v1");
    expect(historicalArchive.source.commit).toBe("84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5");
    expect(historicalArchive.cases.map((entry) => entry.caseId)).toEqual([
      "legacy-immediate-v1", "deferred-attachment-v2",
    ]);
  });
  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V151-BASIC-REACTION-SCHEDULER-GOLDEN-REVIEW",
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(REVIEWED_FIXTURE_SHA256);
  });
});

describe("Basic reaction scheduler 1.51 Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the reviewed legacy-immediate and V2 deferred mixed-Swirl vector",
    () => {
      const legacy = runScenario(LEGACY_SCHEDULER);
      const corrected = runScenario(NATIVE_SCHEDULER);
      expect(runScenario(LEGACY_SCHEDULER)).toEqual(legacy);
      expect(runScenario(NATIVE_SCHEDULER)).toEqual(corrected);

      expectTrustedV151(legacy);
      expectTrustedV151(corrected);
      expect(legacy.runManifest.basicReactionSchedulerRoot).toEqual(
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      );
      expect(corrected.runManifest.basicReactionSchedulerRoot).toEqual(
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
      );

      const generated = fixtureSchema.parse(makeFixture(legacy, corrected));
      expect(
        generated.scenarios.legacyImmediateV1.sharedTargetPropagations.map(
          (entry) => entry.nestedReaction,
        ),
      ).toEqual(["none", "reverseMelt"]);
      expect(
        generated.scenarios.deferredAttachmentV2.sharedTargetPropagations.map(
          (entry) => entry.nestedReaction,
        ),
      ).toEqual(["none", "none"]);
      expect(
        generated.scenarios.deferredAttachmentV2.sharedTargetSchedulerLog
          .filter((entry) => entry.kind === "swirl-attack-resolution")
          .map((entry) => entry.disposition),
      ).toEqual(["deferred", "deferred"]);
      expect(
        generated.scenarios.deferredAttachmentV2.sharedTargetSchedulerLog.filter(
          (entry) => entry.kind === "deferred-aura-attachment",
        ),
      ).toHaveLength(2);
      expect(
        generated.scenarios.deferredAttachmentV2.sharedTargetFinalAura
          .map((entry) => entry.element)
          .sort(),
      ).toEqual(["cryo", "pyro"]);

      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "basic-reaction-scheduler-1.51.golden.json",
          schemaVersion: candidate.currentIdentity.schemaVersion,
          engineVersion: candidate.currentIdentity.engineVersion,
          runManifestVersion: candidate.currentIdentity.runManifestVersion,
          legacyPolicyContentHash:
            candidate.policyRoots.legacyImmediateV1.contentHash,
          deferredPolicyContentHash:
            candidate.policyRoots.deferredAttachmentV2.contentHash,
          legacyNestedReactions:
            candidate.expectedDifference.legacyNestedReactions,
          correctedNestedReactions:
            candidate.expectedDifference.correctedNestedReactions,
          correctedDeferredAttackCount:
            candidate.expectedDifference.correctedDeferredAttackCount,
          correctedDeferredCommitCount:
            candidate.expectedDifference.correctedDeferredCommitCount,
        }),
      });
      expect(fixtureSchema.parse(frozen)).toEqual(generated);
      expect(frozen).toEqual(generated);
    },
  );
});

describe("Current mixed-Swirl scheduler contract (not a historical wire)", () => {
  let legacy: SimulationResultForV153;
  let deferred: SimulationResultForV153;
  beforeAll(() => {
    legacy = runCurrentScenario(LEGACY_SCHEDULER);
    deferred = runCurrentScenario(NATIVE_SCHEDULER);
  });

  it.each([LEGACY_SCHEDULER, NATIVE_SCHEDULER])(
    "retains current identity, damage arithmetic and Aura causality for $mode",
    (model) => {
      const isDeferred = model.mode === NATIVE_SCHEDULER.mode;
      const result = isDeferred ? deferred : legacy;
      expect(runCurrentScenario(model)).toEqual(result);
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
      expect(result.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
      expect(result.runManifest.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
      expect(simulationResultV153Schema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
      expect(assertTrustedSimulationResultV153(result)).toBe(result);

      // Independent arithmetic for this synthetic level-90, EM=100, 10%-RES
      // vector. No production damage/EM helper or fixture total is the oracle.
      const directDamage = 1000 * 0.5 * (1 - 0.1);
      const swirlDamage = 1446.8535 * 0.6 * (1 + 16 * 100 / (2000 + 100)) * (1 - 0.1);
      const meltedSwirlDamage = swirlDamage * 1.5 * (1 + 2.78 * 100 / (1400 + 100));
      expect(result.damageEvents.map((event) => [event.frame, event.sourceActorId, event.targetId])).toEqual([
        [10, "anemo-pyro", "source-pyro"], [10, "anemo-cryo", "source-cryo"],
        [11, "anemo-pyro", "source-pyro"], [11, "anemo-cryo", "source-cryo"],
        [15, "anemo-pyro", "enemy-0"], [15, "anemo-cryo", "enemy-0"],
      ]);
      const expectedDamage = [directDamage, directDamage, swirlDamage, swirlDamage,
        swirlDamage, isDeferred ? swirlDamage : meltedSwirlDamage];
      result.damageEvents.forEach((event, index) => {
        expect(event.finalDamage).toBeCloseTo(expectedDamage[index]!, 9);
        expect(event.displayDamage).toBe(Math.round(expectedDamage[index]!));
      });
      const total = expectedDamage.reduce((sum, damage) => sum + damage, 0);
      expect(result.totalDamage).toBeCloseTo(total, 9);
      expect(result.dps).toBeCloseTo(total / 1, 9);
      const sharedHits = result.damageEvents.filter((event) => event.targetId === "enemy-0");
      expect(sharedHits.map((event) => event.reactionAudit.reaction)).toEqual(
        isDeferred ? ["none", "none"] : ["none", "reverseMelt"],
      );

      // Incoming Anemo 1U is fully spent: 1.25*1 + .95 = 2.2U nominal
      // propagation, 80% attachment, then 45 frames of a 750-frame decay.
      // Immediate Cryo consumes half of its 2.2U from the existing Pyro.
      const nominalGauge = 1.25 * 1 + 0.95;
      const attachedGauge = 0.8 * nominalGauge;
      const lifetime = 420 + 150 * nominalGauge;
      const decay = attachedGauge / lifetime * (60 - 15);
      const finalAura = result.auraEndStates.find((state) => state.targetId === "enemy-0")!.aura;
      expect(finalAura.map((entry) => entry.element)).toEqual(isDeferred ? ["cryo", "pyro"] : ["pyro"]);
      for (const entry of finalAura) {
        expect(entry.gaugeUnits).toBeCloseTo(attachedGauge - decay - (isDeferred ? 0 : 0.5 * nominalGauge), 10);
      }
      const rows = result.basicReactionSchedulerLog.filter((row) => row.targetId === "enemy-0");
      const attacks = rows.filter((row) => row.kind === "swirl-attack-resolution");
      const commits = rows.filter((row) => row.kind === "deferred-aura-attachment");
      expect(result.basicReactionSchedulerLog).toHaveLength(isDeferred ? 6 : 1);
      expect(attacks.map((row) => [row.sourceActorId, row.disposition])).toEqual(isDeferred
        ? [["anemo-pyro", "deferred"], ["anemo-cryo", "deferred"]]
        : [["anemo-pyro", "legacy-immediate"]]);
      expect(commits).toHaveLength(isDeferred ? 2 : 0);
      for (const attack of attacks) {
        expect(attack.frame).toBe(15);
        expect(attack.eventPriority).toBe(5);
        expect(attack.parentEventSequence).toBe(attack.eventSequence);
        expect(attack.auraBefore).toEqual([]);
        expect(attack.auraConsumed).toEqual([]);
        if (isDeferred) {
          expect(attack.auraApplied).toEqual([]);
          expect(attack.auraAfter).toEqual([]);
          const commit = commits.find((row) => row.id === attack.pairedLogId)!;
          expect(commit).toMatchObject({
            frame: 15, eventPriority: 5, pairedLogId: attack.id,
            parentEventSequence: attack.eventSequence, sourceActorId: attack.sourceActorId,
            reactionDamageLogId: attack.reactionDamageLogId,
            hitResolutionLogId: attack.hitResolutionLogId,
            elementalApplicationIcdLogId: attack.elementalApplicationIcdLogId,
            reaction: "none", reactions: [], auraConsumed: [],
            auraApplied: [{ element: attack.element, gaugeUnits: nominalGauge, sourceActorId: attack.sourceActorId }],
          });
          expect(commit.eventSequence).toBeGreaterThan(Math.max(...attacks.map((row) => row.eventSequence)));
        } else {
          expect(attack.pairedLogId).toBeNull();
          expect(attack.auraApplied).toEqual([{ element: "pyro", gaugeUnits: nominalGauge, sourceActorId: "anemo-pyro" }]);
        }
      }
      if (isDeferred) {
        expect(commits.map((row) => row.sourceActorId)).toEqual(["anemo-pyro", "anemo-cryo"]);
        expect(commits[0]!.eventSequence).toBeLessThan(commits[1]!.eventSequence);
        expect(commits[0]!.auraBefore).toEqual([]);
        expect(commits[1]!.auraBefore).toEqual(commits[0]!.auraAfter);
        expect(commits[1]!.auraAfter.map((entry) => entry.element)).toEqual(["cryo", "pyro"]);
        for (const entry of commits[1]!.auraAfter) {
          expect(entry.gaugeUnits).toBeCloseTo(attachedGauge, 10);
          expect(entry.expiresAtFrame).toBe(15 + lifetime);
        }
      }
      for (const row of result.basicReactionSchedulerLog) {
        const points = result.targetStateTimeline.points.filter((point) => point.links.some(
          (link) => link.kind === "basic-reaction-scheduler-log" && link.id === row.id,
        ));
        expect(points).toHaveLength(1);
        expect(points[0]).toMatchObject({
          frame: row.frame, targetId: row.targetId, eventPriority: row.eventPriority,
          eventSequence: row.eventSequence, reaction: row.reaction, reactions: row.reactions,
          auraBefore: row.auraBefore, auraApplied: row.auraApplied,
          auraConsumed: row.auraConsumed, auraAfter: row.auraAfter,
          cause: row.kind === "swirl-attack-resolution" ? "reaction-damage-application" : "reaction-aura-attachment",
        });
      }

      // Complete mechanics fields also match the authentic prior output; this
      // is a comparison, never a relabelled or stripped current result.
      const historical = historicalSource(model);
      expect(result.damageEvents).toEqual(historical.damageEvents);
      expect(result.basicReactionSchedulerLog).toEqual(historical.basicReactionSchedulerLog);
      // Current direct-hit allocation reserves hit resolution at step 0,
      // then Aura application at step 1 (simulator.ts direct-hit allocator).
      // Retain every other point/order/link; do not normalize away identities.
      const expectedTimeline = structuredClone(historical.targetStateTimeline);
      const directApplications = expectedTimeline.points.filter((point) => point.cause === "direct-hit-application");
      expect(directApplications.map((point) => [point.id, point.frame, point.targetId, point.eventSequence, point.intraEventSequence])).toEqual([
        [3, 10, "source-pyro", 3, 0], [4, 10, "source-cryo", 4, 0],
      ]);
      for (const point of directApplications) {
        const resolution = result.hitResolutionLog.find((row) => row.damageEventId === point.primaryDamageEventId)!;
        expect(resolution).toMatchObject({ frame: 10, eventSequence: point.eventSequence, intraEventSequence: 0 });
        point.intraEventSequence = 1;
      }
      expect(result.targetStateTimeline).toEqual(expectedTimeline);
      expect(result.auraEndStates).toEqual(historical.auraEndStates);
      const before = JSON.stringify(result);
      expect(() => projectSimulationResultV153ToV152(result)).toThrow(/flatStatBuffSemantics/);
      expect(JSON.stringify(result)).toBe(before);
    },
  );

  const hostileCases: Array<[string, (result: SimulationResultForV153) => void]> = [
    ["duplicate scheduler row", (result) => { result.basicReactionSchedulerLog.push(structuredClone(result.basicReactionSchedulerLog[0]!)); }],
    ["dangling reciprocal pair", (result) => { result.basicReactionSchedulerLog[1]!.pairedLogId = 999999; }],
    ["forged parent sequence", (result) => { result.basicReactionSchedulerLog.at(-1)!.parentEventSequence += 1; }],
    ["missing scheduler timeline backlink", (result) => {
      const id = result.basicReactionSchedulerLog.at(-1)!.id;
      for (const point of result.targetStateTimeline.points) point.links = point.links.filter(
        (link) => link.kind !== "basic-reaction-scheduler-log" || link.id !== id,
      );
    }],
    ["cross-actor reciprocal pair swap", (result) => {
      const attacks = result.basicReactionSchedulerLog.filter((row) => row.targetId === "enemy-0" && row.kind === "swirl-attack-resolution");
      const commits = result.basicReactionSchedulerLog.filter((row) => row.targetId === "enemy-0" && row.kind === "deferred-aura-attachment");
      attacks[0]!.pairedLogId = commits[1]!.id; attacks[1]!.pairedLogId = commits[0]!.id;
      commits[0]!.pairedLogId = attacks[1]!.id; commits[1]!.pairedLogId = attacks[0]!.id;
    }],
    ["false deferred nested Melt", (result) => { result.damageEvents.at(-1)!.reactionAudit.reaction = "reverseMelt"; }],
    ["forged scheduler policy hash", (result) => { Object.assign(result.runManifest.basicReactionSchedulerRoot, { contentHash: `sha256:${"0".repeat(64)}` }); }],
  ];
  it.each(hostileCases)("rejects %s without changing the authentic current wire", (_label, mutate) => {
    const before = JSON.stringify(deferred);
    const forged = structuredClone(deferred);
    mutate(forged);
    expect(simulationResultV153Schema.safeParse(forged).success).toBe(false);
    expect(() => assertTrustedSimulationResultV153(forged)).toThrow();
    expect(JSON.stringify(deferred)).toBe(before);
  });

  it("keeps additional-field rejection at the public current boundary", () => {
    const forged = structuredClone(deferred);
    Object.assign(forged.basicReactionSchedulerLog[0]!, { unreviewedSchedulerProof: true });
    expect(simulationResultV153Schema.safeParse(forged).success).toBe(false);
  });
});
