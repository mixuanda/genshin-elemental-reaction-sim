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
  basicReactionSchedulerLogEntrySchema,
  basicReactionSchedulerModelSchema,
  basicReactionSchedulerRootSchema,
  simulationResultV151Schema,
  simulationRunManifestV151Schema,
  targetStateTimelinePointSchema,
  type BasicReactionSchedulerModel,
  type SimConfig,
  type SimulationResultForV151,
} from "@genshin-dps-lab/schemas";
import { z } from "zod";
import { describe, expect, it } from "vitest";

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

function runScenario(
  model: BasicReactionSchedulerModel,
): SimulationResultForV151 {
  const config = makeSameFrameMixedSwirlConfig(model);
  return projectSimulationResultV152ToV151(
    projectSimulationResultV153ToV152(
      simulate(withV152CompatibilityPolicies(config), {
        compatibilityMode: "legal-frame-v1",
        critMode: "noCrit",
        randomSeed: config.randomSeed,
      }),
    ),
  );
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
