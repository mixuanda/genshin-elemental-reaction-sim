import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  freezeBrokenAttackLogEntrySchema,
  freezeBrokenAttackRootV1Schema,
  freezeBrokenAttackRootV2Schema,
  frozenStateLogEntryV142Schema,
  simulationResultV152Schema,
  simulationRunManifestV152Schema,
  type AbilityDefinition,
  type Element,
  type FreezeBrokenAttackModel,
  type SimConfig,
  type SimulationResultForV152,
} from "@genshin-dps-lab/schemas";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";

const PREVIEW_FLAG = "PREVIEW_FREEZE_BROKEN_ATTACK_V152_GOLDEN";
const UPDATE_FLAG = "UPDATE_FREEZE_BROKEN_ATTACK_V152_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "d9a8811a46efb2ed839fac111a4e796d308323f25f3ce0fe7b53c225664f01d4";
const FIXTURE_URL = new URL(
  "../fixtures/freeze-broken-attack-1.52.golden.json",
  import.meta.url,
);

const V1_MODEL = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const satisfies FreezeBrokenAttackModel;

const V2_MODEL = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const satisfies FreezeBrokenAttackModel;

type ScenarioSlug =
  | "natural-decay"
  | "poise"
  | "shatter"
  | "swirl-frozen"
  | "mixed-hydro-frozen-swirl"
  | "crystallize-frozen"
  | "melt-excluded"
  | "superconduct-excluded"
  | "partial-frozen-consumption";

interface TestHit {
  id: string;
  at: number;
  element: Element;
  gaugeUnits?: number;
  strikeType?: "default" | "blunt";
  poiseDamage?: number;
}

interface ScenarioDefinition {
  slug: ScenarioSlug;
  makeConfig: () => SimConfig;
}

function timelineHit(
  hit: TestHit,
): NonNullable<AbilityDefinition["hits"]>[number] {
  return {
    id: `${hit.id}-hit`,
    label: hit.id,
    frame: Math.round(hit.at * 60),
    scaling: 1,
    element: hit.element,
    ...(hit.strikeType === undefined ? {} : { strikeType: hit.strikeType }),
    ...(hit.poiseDamage === undefined ? {} : { poiseDamage: hit.poiseDamage }),
    ...(hit.gaugeUnits === undefined
      ? {}
      : {
          application: {
            gaugeUnits: hit.gaugeUnits,
            icd: { mode: "no-icd-v1" as const },
          },
        }),
  };
}

/** Mirrors the dedicated simulator matrix; mechanics remain owned by sim-core. */
function makeFreezeBrokenConfig({
  initialCryoGaugeUnits = 1,
  preFreezeCryoGaugeUnits,
  createFreezeGaugeUnits = 1,
  duration = 1,
  followups = [],
}: {
  initialCryoGaugeUnits?: number;
  preFreezeCryoGaugeUnits?: number;
  createFreezeGaugeUnits?: number;
  duration?: number;
  followups?: TestHit[];
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Freeze Broken reviewed target",
          initialAura: [
            { element: "cryo", gaugeUnits: initialCryoGaugeUnits },
          ],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Test actor index zero",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
    ],
    reactionEngine: { mode: "aura-v2" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 1,
      abilities: [
        {
          id: "freeze-broken-sequence",
          actorId: "tester",
          name: "Freeze Broken reviewed sequence",
          kind: "skill",
          cancelFrame:
            Math.max(0, ...followups.map((hit) => Math.round(hit.at * 60))) +
            1,
          animationEndFrame:
            Math.max(0, ...followups.map((hit) => Math.round(hit.at * 60))) +
            1,
          cooldownFrames: 0,
          hits: [
            ...(preFreezeCryoGaugeUnits === undefined
              ? []
              : [
                  timelineHit({
                    id: "fortify-test-cryo",
                    at: 0,
                    element: "cryo",
                    gaugeUnits: preFreezeCryoGaugeUnits,
                  }),
                ]),
            ...(createFreezeGaugeUnits > 0
              ? [
                  timelineHit({
                    id: "create-freeze",
                    at: preFreezeCryoGaugeUnits === undefined ? 0 : 1 / 60,
                    element: "hydro",
                    gaugeUnits: createFreezeGaugeUnits,
                  }),
                ]
              : []),
            ...followups.map(timelineHit),
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: "freeze-broken-sequence",
        },
      ],
    },
  };
}

const POSITIVE_SCENARIOS = {
  naturalDecay: {
    slug: "natural-decay",
    makeConfig: () => makeFreezeBrokenConfig({ duration: 4 }),
  },
  poise: {
    slug: "poise",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "poise",
            at: 0.1,
            element: "physical",
            strikeType: "blunt",
            poiseDamage: 300,
          },
        ],
      }),
  },
  shatter: {
    slug: "shatter",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "shatter",
            at: 0.1,
            element: "physical",
            strikeType: "blunt",
          },
        ],
      }),
  },
  swirlFrozen: {
    slug: "swirl-frozen",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        initialCryoGaugeUnits: 0.25,
        followups: [
          {
            id: "swirl-cryo",
            at: 0.1,
            element: "anemo",
            gaugeUnits: 1,
          },
        ],
      }),
  },
  mixedHydroFrozenSwirl: {
    slug: "mixed-hydro-frozen-swirl",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        initialCryoGaugeUnits: 0.25,
        followups: [
          {
            id: "attach-hydro-beside-frozen",
            at: 0.05,
            element: "hydro",
            gaugeUnits: 1,
          },
          {
            id: "mixed-hydro-frozen-swirl",
            at: 0.1,
            element: "anemo",
            gaugeUnits: 3,
          },
        ],
      }),
  },
  crystallizeFrozen: {
    slug: "crystallize-frozen",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        // Synthetic test-only high gauge: this is not a game-data claim.
        preFreezeCryoGaugeUnits: 5.3125,
        createFreezeGaugeUnits: 5.3125,
        followups: [
          {
            id: "crystallize-cryo",
            at: 0.1,
            element: "geo",
            gaugeUnits: 1,
          },
        ],
      }),
  },
} as const satisfies Record<string, ScenarioDefinition>;

const NEGATIVE_SCENARIOS = {
  meltExcluded: {
    slug: "melt-excluded",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        followups: [
          { id: "melt", at: 0.1, element: "pyro", gaugeUnits: 2 },
        ],
      }),
  },
  superconductExcluded: {
    slug: "superconduct-excluded",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "superconduct",
            at: 0.1,
            element: "electro",
            gaugeUnits: 2,
          },
        ],
      }),
  },
  partialFrozenConsumption: {
    slug: "partial-frozen-consumption",
    makeConfig: () =>
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "partial-swirl",
            at: 0.1,
            element: "anemo",
            gaugeUnits: 1,
          },
        ],
      }),
  },
} as const satisfies Record<string, ScenarioDefinition>;

function bindScenarioIdentity(
  base: SimConfig,
  slug: ScenarioSlug,
  model: FreezeBrokenAttackModel,
): SimConfig {
  const policy =
    model.mode === LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE ? "v1" : "v2";
  const identity = `synthetic-freeze-broken-${slug}-${policy}-1.52`;
  return {
    ...structuredClone(base),
    dataVersion: identity,
    randomSeed: identity,
    freezeBrokenAttackModel: model,
    meta: {
      name: `V1.52 Freeze Broken ${slug}`,
      version: "1.52.0",
      verificationStatus: "provisional",
    },
  };
}

function runScenario(
  definition: ScenarioDefinition,
  model: FreezeBrokenAttackModel,
): SimulationResultForV152 {
  const config = bindScenarioIdentity(
    definition.makeConfig(),
    definition.slug,
    model,
  );
  return simulate(config, {
    compatibilityMode: "legal-frame-v1",
    critMode: "noCrit",
    randomSeed: config.randomSeed,
  });
}

function combatOutputView(result: SimulationResultForV152) {
  return {
    damageEvents: result.damageEvents,
    hitEvents: result.hitEvents,
    hitResolutionLog: result.hitResolutionLog,
    reactedHits: result.reactedHits,
    byCharacter: result.byCharacter,
    characterSummaries: result.characterSummaries,
    targetSummaries: result.targetSummaries,
    bySkill: result.bySkill,
    perSecond: result.perSecond,
    damageCurve: result.damageCurve,
    totalDamage: result.totalDamage,
    dps: result.dps,
  };
}

function scenarioFixture(
  result: SimulationResultForV152,
  legacy: SimulationResultForV152,
) {
  const combatOutput = combatOutputView(result);
  const legacyCombatOutput = combatOutputView(legacy);
  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      selectedModel: result.config.freezeBrokenAttackModel,
      manifestCanonicalSha256: canonicalSha256(result.runManifest),
    },
    mechanicsStatus: result.mechanicsStatus,
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      hitResolutionCount: result.hitResolutionLog.length,
      frozenStateLogCount: result.frozenStateLog.length,
      freezeBrokenAttackLogCount: result.freezeBrokenAttackLog.length,
    },
    frozenStateLog: result.frozenStateLog,
    freezeBrokenAttackLog: result.freezeBrokenAttackLog,
    normalizedExecution: {
      combatOutputMatchesLegacy:
        canonicalSha256(combatOutput) === canonicalSha256(legacyCombatOutput),
      totalDamageDelta: result.totalDamage - legacy.totalDamage,
      damageEventCountDelta:
        result.damageEvents.length - legacy.damageEvents.length,
      hitResolutionCountDelta:
        result.hitResolutionLog.length - legacy.hitResolutionLog.length,
      materializedFreezeBrokenDamageEvent: result.freezeBrokenAttackLog.some(
        (entry) => entry.damageEventId !== null,
      ),
      materializedFreezeBrokenHitResolution: result.freezeBrokenAttackLog.some(
        (entry) => entry.hitResolutionLogId !== null,
      ),
      callbackDisposition: "reference-audit-only-not-dispatched" as const,
      rngDisposition: "consume-none" as const,
      configuredCritMode: "noCrit" as const,
    },
    canonicalSha256: {
      config: canonicalSha256(result.config),
      runManifest: canonicalSha256(result.runManifest),
      frozenStateLog: canonicalSha256(result.frozenStateLog),
      freezeBrokenAttackLog: canonicalSha256(result.freezeBrokenAttackLog),
      combatOutput: canonicalSha256(combatOutput),
      legacyCombatOutput: canonicalSha256(legacyCombatOutput),
    },
  };
}

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const nonNegativeIntegerSchema = z.number().int().nonnegative();

const scenarioSchema = z
  .object({
    identity: z
      .object({
        schemaVersion: z.literal(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION),
        engineVersion: z.literal(FREEZE_BROKEN_ATTACK_ENGINE_VERSION),
        dataVersion: z.string().min(1),
        randomSeed: z.string().min(1),
        configHash: z.string().regex(/^fnv1a32:[0-9a-f]{8}$/),
        reproducibilityKey: z
          .string()
          .regex(/^gdl-v2-fnv1a32-[0-9a-f]{8}$/),
        selectedModel: z.union([
          z.object({
            mode: z.literal(LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE),
            policyId: z.literal(LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID),
          }),
          z.object({
            mode: z.literal(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE),
            policyId: z.literal(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID),
          }),
        ]),
        manifestCanonicalSha256: sha256Schema,
      })
      .strict(),
    mechanicsStatus: z.enum(["complete", "partial"]),
    totals: z
      .object({
        totalDamage: z.number().finite().nonnegative(),
        dps: z.number().finite().nonnegative(),
        damageEventCount: nonNegativeIntegerSchema,
        hitResolutionCount: nonNegativeIntegerSchema,
        frozenStateLogCount: nonNegativeIntegerSchema,
        freezeBrokenAttackLogCount: nonNegativeIntegerSchema,
      })
      .strict(),
    frozenStateLog: z.array(frozenStateLogEntryV142Schema),
    freezeBrokenAttackLog: z.array(freezeBrokenAttackLogEntrySchema),
    normalizedExecution: z
      .object({
        combatOutputMatchesLegacy: z.literal(true),
        totalDamageDelta: z.literal(0),
        damageEventCountDelta: z.literal(0),
        hitResolutionCountDelta: z.literal(0),
        materializedFreezeBrokenDamageEvent: z.literal(false),
        materializedFreezeBrokenHitResolution: z.literal(false),
        callbackDisposition: z.literal(
          "reference-audit-only-not-dispatched",
        ),
        rngDisposition: z.literal("consume-none"),
        configuredCritMode: z.literal("noCrit"),
      })
      .strict(),
    canonicalSha256: z
      .object({
        config: sha256Schema,
        runManifest: sha256Schema,
        frozenStateLog: sha256Schema,
        freezeBrokenAttackLog: sha256Schema,
        combatOutput: sha256Schema,
        legacyCombatOutput: sha256Schema,
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
        sourceRevision: z.literal(
          "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
        ),
        capturedAt: z.literal("2026-08-02"),
        verificationStatus: z.literal("reviewed-provisional"),
        note: z.string().min(1),
        officialServerTruth: z.literal(false),
        completeGcsimParity: z.literal(false),
      })
      .strict(),
    currentIdentity: z
      .object({
        schemaVersion: z.literal(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION),
        engineVersion: z.literal(FREEZE_BROKEN_ATTACK_ENGINE_VERSION),
        runManifestVersion: z.literal(
          FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
        ),
      })
      .strict(),
    policyRoots: z
      .object({
        legacyNoCallbackV1: freezeBrokenAttackRootV1Schema,
        normalizedAuditV2: freezeBrokenAttackRootV2Schema,
      })
      .strict(),
    sevenRootManifestIdentity: z
      .object({
        trustRootKeys: z.tuple([
          z.literal("reactionFormulaRoot"),
          z.literal("directDamageGroupRoot"),
          z.literal("elementalApplicationIcdRoot"),
          z.literal("reactionOwnedElementalApplicationRoot"),
          z.literal("reactionDamageGroupRoot"),
          z.literal("basicReactionSchedulerRoot"),
          z.literal("freezeBrokenAttackRoot"),
        ]),
        trustRootCount: z.literal(7),
        referenceRunManifest: simulationRunManifestV152Schema,
      })
      .strict(),
    normalizedContract: z
      .object({
        auditOnly: z.literal(true),
        callbackBusImplemented: z.literal(false),
        syntheticDamageEventEmitted: z.literal(false),
        syntheticHitResolutionEmitted: z.literal(false),
        rngDrawConsumed: z.literal(false),
        note: z.string().min(1),
      })
      .strict(),
    mixedSwirlClassification: z
      .object({
        primaryDamageReaction: z.literal("swirlHydro"),
        orderedReactionsInclude: z.tuple([
          z.literal("swirlHydro"),
          z.literal("swirlCryo"),
        ]),
        consumedFrozenAuditReaction: z.literal("swirlCryo"),
        freezeBrokenAuditReaction: z.literal("swirlCryo"),
      })
      .strict(),
    limitations: z
      .object({
        testOnlyHighGaugeCrystallizeBoundary: z.literal(true),
        noOfficialServerValidation: z.literal(true),
        noCompleteGcsimParity: z.literal(true),
        noCallbackSubscriberSideEffects: z.literal(true),
        noGeneralPhysicsOrImpulseBus: z.literal(true),
        note: z.string().min(1),
      })
      .strict(),
    legacySameScenario: scenarioSchema,
    positiveMatrix: z
      .object({
        naturalDecay: scenarioSchema,
        poise: scenarioSchema,
        shatter: scenarioSchema,
        swirlFrozen: scenarioSchema,
        mixedHydroFrozenSwirl: scenarioSchema,
        crystallizeFrozen: scenarioSchema,
      })
      .strict(),
    negativeMatrix: z
      .object({
        meltExcluded: scenarioSchema,
        superconductExcluded: scenarioSchema,
        partialFrozenConsumption: scenarioSchema,
      })
      .strict(),
  })
  .strict();

function runMatrix() {
  const positive = Object.fromEntries(
    Object.entries(POSITIVE_SCENARIOS).map(([key, definition]) => {
      const legacy = runScenario(definition, V1_MODEL);
      const current = runScenario(definition, V2_MODEL);
      return [key, { legacy, current }];
    }),
  ) as Record<
    keyof typeof POSITIVE_SCENARIOS,
    {
      legacy: SimulationResultForV152;
      current: SimulationResultForV152;
    }
  >;
  const negative = Object.fromEntries(
    Object.entries(NEGATIVE_SCENARIOS).map(([key, definition]) => {
      const legacy = runScenario(definition, V1_MODEL);
      const current = runScenario(definition, V2_MODEL);
      return [key, { legacy, current }];
    }),
  ) as Record<
    keyof typeof NEGATIVE_SCENARIOS,
    {
      legacy: SimulationResultForV152;
      current: SimulationResultForV152;
    }
  >;
  return { positive, negative };
}

function makeFixture(matrix: ReturnType<typeof runMatrix>) {
  const reference = matrix.positive.naturalDecay.current;
  const mixed = matrix.positive.mixedHydroFrozenSwirl.current;
  const mixedHit = mixed.damageEvents.find(
    (event) => event.hitId === "mixed-hydro-frozen-swirl-hit",
  );
  const mixedFrozenState = mixed.frozenStateLog.find(
    (entry) => entry.triggerDamageEventId === mixedHit?.id,
  );
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Reviewed V1.52 Freeze Broken audit Golden covering legacy-empty compatibility, six normalized positive depletion paths, and three excluded or partial negative paths.",
    provenance: {
      sourceProject: "genshinsim/gcsim" as const,
      sourceRevision:
        "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const,
      capturedAt: "2026-08-02" as const,
      verificationStatus: "reviewed-provisional" as const,
      note: "The pinned gcsim Freeze Broken attack is retained only as reference provenance. Local V2 rows are a normalized audit contract and are not dispatched callbacks, DamageEvents, HitResolution rows, RNG draws, official server truth, or complete gcsim parity.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    currentIdentity: {
      schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
      engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
      runManifestVersion: FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
    },
    policyRoots: {
      legacyNoCallbackV1: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
      normalizedAuditV2: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    },
    sevenRootManifestIdentity: {
      trustRootKeys: [
        "reactionFormulaRoot",
        "directDamageGroupRoot",
        "elementalApplicationIcdRoot",
        "reactionOwnedElementalApplicationRoot",
        "reactionDamageGroupRoot",
        "basicReactionSchedulerRoot",
        "freezeBrokenAttackRoot",
      ] as const,
      trustRootCount: 7 as const,
      referenceRunManifest: reference.runManifest,
    },
    normalizedContract: {
      auditOnly: true as const,
      callbackBusImplemented: false as const,
      syntheticDamageEventEmitted: false as const,
      syntheticHitResolutionEmitted: false as const,
      rngDrawConsumed: false as const,
      note: "The current slice records eligible positive-to-depleted Frozen transitions. It intentionally does not dispatch either pinned reference phase or consume the pinned reference crit RNG draw.",
    },
    mixedSwirlClassification: {
      primaryDamageReaction: mixedHit?.reactionAudit.reaction,
      orderedReactionsInclude: [
        mixedHit?.reactionAudit.reactions.includes("swirlHydro")
          ? "swirlHydro"
          : null,
        mixedHit?.reactionAudit.reactions.includes("swirlCryo")
          ? "swirlCryo"
          : null,
      ],
      consumedFrozenAuditReaction: mixedFrozenState?.reaction,
      freezeBrokenAuditReaction: mixed.freezeBrokenAttackLog[0]?.reaction,
    },
    limitations: {
      testOnlyHighGaugeCrystallizeBoundary: true as const,
      noOfficialServerValidation: true as const,
      noCompleteGcsimParity: true as const,
      noCallbackSubscriberSideEffects: true as const,
      noGeneralPhysicsOrImpulseBus: true as const,
      note: "The Crystallize case uses a synthetic high-gauge exact boundary solely to exercise the local transition. The fixture does not validate live character data, callback subscribers, Mona bubble, enemy impulse, complete Aura/ICD, particles, or action frames.",
    },
    legacySameScenario: scenarioFixture(
      matrix.positive.naturalDecay.legacy,
      matrix.positive.naturalDecay.legacy,
    ),
    positiveMatrix: Object.fromEntries(
      Object.entries(matrix.positive).map(([key, pair]) => [
        key,
        scenarioFixture(pair.current, pair.legacy),
      ]),
    ),
    negativeMatrix: Object.fromEntries(
      Object.entries(matrix.negative).map(([key, pair]) => [
        key,
        scenarioFixture(pair.current, pair.legacy),
      ]),
    ),
  };
}

function expectTrustedV152(result: SimulationResultForV152): void {
  expect(simulationResultV152Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV152(result)).toBe(result);
  expect(result.schemaVersion).toBe(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(FREEZE_BROKEN_ATTACK_ENGINE_VERSION);
  expect(result.runManifest.version).toBe(
    FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  );
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("Freeze Broken attack 1.52 Golden review gate", () => {
  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V152-FREEZE-BROKEN-ATTACK-GOLDEN-REVIEW",
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(
      REVIEWED_FIXTURE_SHA256,
    );
  });
});

describe("Freeze Broken attack 1.52 Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the reviewed V1-empty and V2 positive-negative audit matrix",
    () => {
      const matrix = runMatrix();
      const repeated = runMatrix();
      expect(repeated).toEqual(matrix);

      for (const pair of [
        ...Object.values(matrix.positive),
        ...Object.values(matrix.negative),
      ]) {
        expectTrustedV152(pair.legacy);
        expectTrustedV152(pair.current);
        expect(pair.legacy.freezeBrokenAttackLog).toEqual([]);
        expect(pair.legacy.runManifest.freezeBrokenAttackRoot).toEqual(
          LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
        );
        expect(pair.current.runManifest.freezeBrokenAttackRoot).toEqual(
          GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
        );
        expect(combatOutputView(pair.current)).toEqual(
          combatOutputView(pair.legacy),
        );
      }
      expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT).toMatchObject({
        callbackDisposition: "reference-audit-only-not-dispatched",
        rngDisposition: "consume-none",
        damageEventDisposition: "emit-none",
      });
      expect(
        Object.values(matrix.positive).map(
          (pair) => pair.current.mechanicsStatus,
        ),
      ).toEqual([
        "partial",
        "partial",
        "partial",
        "partial",
        "partial",
        "partial",
      ]);
      expect(
        Object.values(matrix.positive).map(
          (pair) => pair.current.freezeBrokenAttackLog.length,
        ),
      ).toEqual([1, 1, 1, 1, 1, 1]);
      expect(
        Object.values(matrix.positive).map(
          (pair) => pair.current.freezeBrokenAttackLog[0]!.reaction,
        ),
      ).toEqual([
        "freeze",
        "shatter",
        "shatter",
        "swirlCryo",
        "swirlCryo",
        "crystallizeCryo",
      ]);
      expect(
        Object.values(matrix.negative).map(
          (pair) => pair.current.freezeBrokenAttackLog.length,
        ),
      ).toEqual([0, 0, 0]);
      expect(
        Object.values(matrix.negative).map(
          (pair) => pair.current.mechanicsStatus,
        ),
      ).toEqual(["complete", "complete", "complete"]);
      for (const row of Object.values(matrix.positive).flatMap(
        (pair) => pair.current.freezeBrokenAttackLog,
      )) {
        expect(row).toMatchObject({
          executionStatus: "reference-audit-only-not-dispatched",
          damageEventId: null,
          hitResolutionLogId: null,
          attack: { sourceIsSim: true, doNotLog: true },
        });
      }

      const generated = fixtureSchema.parse(makeFixture(matrix));
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "freeze-broken-attack-1.52.golden.json",
          schemaVersion: candidate.currentIdentity.schemaVersion,
          engineVersion: candidate.currentIdentity.engineVersion,
          runManifestVersion: candidate.currentIdentity.runManifestVersion,
          trustRootCount:
            candidate.sevenRootManifestIdentity.trustRootCount,
          policyContentHash: candidate.policyRoots.normalizedAuditV2.contentHash,
          positiveAuditCounts: Object.fromEntries(
            Object.entries(candidate.positiveMatrix).map(([key, scenario]) => [
              key,
              scenario.freezeBrokenAttackLog.length,
            ]),
          ),
          negativeAuditCounts: Object.fromEntries(
            Object.entries(candidate.negativeMatrix).map(([key, scenario]) => [
              key,
              scenario.freezeBrokenAttackLog.length,
            ]),
          ),
          auditOnly: candidate.normalizedContract.auditOnly,
          rngDrawConsumed: candidate.normalizedContract.rngDrawConsumed,
        }),
      });
      expect(fixtureSchema.parse(frozen)).toEqual(generated);
      expect(frozen).toEqual(generated);
    },
  );
});
