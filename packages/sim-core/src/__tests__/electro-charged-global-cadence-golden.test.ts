import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  assertTrustedSimulationResult,
  canonicalStringify,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  electroChargedCleanupResultReferencesSchema,
  electroChargedGlobalCadenceGoldenFixtureV142Schema,
  electroChargedGlobalCadenceGoldenScenarioIdsV142,
  LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
  playerDamageResultReferencesSchema,
  reactionDeliveryResultReferencesSchema,
  simulationResultSchema,
  targetPhaseV2ResultReferencesSchema,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationRunManifestV142,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type CadenceGoldenScenarioId =
  (typeof electroChargedGlobalCadenceGoldenScenarioIdsV142)[number];

const SCENARIO_IDS: CadenceGoldenScenarioId[] = [
  ...electroChargedGlobalCadenceGoldenScenarioIdsV142
];
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/electro-charged-global-cadence-1.42.golden.json",
  import.meta.url
);
const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

function applicationHit({
  id,
  element,
  gaugeUnits,
  hitlagFrames
}: {
  id: string;
  element: NonNullable<FrameHitDefinition["element"]>;
  gaugeUnits: number;
  hitlagFrames?: number;
}): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    geometry: SAME_TARGET_GEOMETRY,
    application: {
      gaugeUnits,
      icd: { mode: "no-icd-v1" }
    },
    ...(hitlagFrames === undefined
      ? {}
      : {
          targetHitlag: {
            haltFrames: hitlagFrames,
            factor: 0
          }
        })
  };
}

interface ExpectedNoIcdApplication {
  hitId: string;
  frame: number;
  gaugeUnits: number;
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
  resetSchedulePolicy: "bypass"
} as const;

function expectCurrentNoIcdApplicationContract(
  result: SimulationResult,
  expected: readonly ExpectedNoIcdApplication[]
): void {
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  expect(result.config.elementalApplicationIcdModel).toEqual({
    mode: "fixed-gcsim-elemental-application-v1",
    profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
  });
  expect(result.runManifest.elementalApplicationIcdRoot).toEqual(
    GCSIM_ELEMENTAL_APPLICATION_ROOT
  );
  expect(
    result.config.timeline?.abilities.flatMap((ability) =>
      (ability.hits ?? []).flatMap((hit) =>
        hit.application === undefined
          ? []
          : [
              {
                hitId: hit.id,
                application: hit.application
              }
            ]
      )
    )
  ).toEqual(
    expected.map(({ hitId, gaugeUnits }) => ({
      hitId,
      application: {
        gaugeUnits,
        icd: { mode: "no-icd-v1" }
      }
    }))
  );
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
      decision: entry.decision
    }))
  ).toEqual(
    expected.map(({ hitId, frame, gaugeUnits }, id) => ({
      id,
      frame,
      sourceActorId: "driver",
      targetId: "enemy-0",
      hitId,
      selector: { mode: "no-icd-v1" },
      nominalGaugeUnits: gaugeUnits,
      effectiveGaugeUnits: gaugeUnits,
      decision: NO_ICD_DECISION
    }))
  );
}

/**
 * Before 1.47, a no-ICD application copied its configured hit id and the
 * `no-icd` group into the direct damage reaction audit. The 1.47 decision is
 * represented by the explicit selector/log and therefore carries null audit
 * stream fields. Recreate only that frozen presentation for old Goldens.
 */
function projectDamageEventsToFrozenNoIcd(
  result: SimulationResult
): SimulationResult["damageEvents"] {
  const legacyAuditByDamageEventId = new Map(
    result.elementalApplicationIcdLog.flatMap((entry) =>
      entry.damageEventId === null ||
      entry.selector.mode !== "no-icd-v1"
        ? []
        : [
            [
              entry.damageEventId,
              {
                icdAllowed: entry.decision.allowed,
                icdTag: entry.hitId,
                icdGroup: "no-icd" as const
              }
            ] as const
          ]
    )
  );
  return result.damageEvents.map((event) => {
    const legacyAudit = legacyAuditByDamageEventId.get(event.id);
    return legacyAudit === undefined
      ? event
      : {
          ...event,
          reactionAudit: {
            ...event.reactionAudit,
            ...legacyAudit
          }
        };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function projectNoIcdSelectorsToLegacyWire(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(projectNoIcdSelectorsToLegacyWire);
  }
  if (!isRecord(value)) return value;

  const projected = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      projectNoIcdSelectorsToLegacyWire(entry)
    ])
  );
  if (!Object.prototype.hasOwnProperty.call(value, "application")) {
    return projected;
  }
  if (
    typeof value.id !== "string" ||
    !isRecord(value.application) ||
    typeof value.application.gaugeUnits !== "number" ||
    !isRecord(value.application.icd) ||
    value.application.icd.mode !== "no-icd-v1"
  ) {
    throw new Error(
      "EC global-cadence frozen projection requires explicit no-icd-v1 hit applications."
    );
  }
  return {
    ...projected,
    application: {
      gaugeUnits: value.application.gaugeUnits,
      icdTag: value.id,
      icdGroup: "no-icd"
    }
  };
}

function projectCurrentConfigToFrozenV142(
  config: SimConfig
): Record<string, unknown> {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    directDamageGroupModel: _directDamageGroupModel,
    elementalApplicationIcdModel: _elementalApplicationIcdModel,
    ...frozenConfig
  } = structuredClone(config);
  return {
    ...(projectNoIcdSelectorsToLegacyWire(frozenConfig) as Record<
      string,
      unknown
    >),
    schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
    engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION
  };
}

function makeLongHitlagConfig({
  restoreFrame,
  restoreGaugeUnits = 1
}: {
  restoreFrame?: number;
  restoreGaugeUnits?: number;
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-global-cadence-provisional-1",
    randomSeed:
      `ec-global-cadence-${restoreFrame ?? "none"}-${restoreGaugeUnits}-145`,
    meta: {
      name: "Aura-v9 EC global cadence long-Hitlag Golden",
      version: "1.42.0",
      verificationStatus: "provisional",
      note:
        "Fixed-gcsim-provisional regression vector only; not official game data or a claim of complete gcsim parity."
    },
    duration: 145 / 60,
    cycleLength: 3,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Hydro Electro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 0.5 },
            { element: "electro", gaugeUnits: 2 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: {
      mode: "target-local-hitlag-v1"
    },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
    electroChargedPropagationModel: {
      mode: "single-target-v1"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "compound-chain",
          actorId: "driver",
          name: "Compound reaction chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "dendro-quicken",
              element: "dendro",
              gaugeUnits: 0.2
            }),
            applicationHit({
              id: "electro-stream",
              element: "electro",
              gaugeUnits: 0.8,
              hitlagFrames: 120
            })
          ]
        },
        ...(restoreFrame === undefined
          ? []
          : [
              {
                id: "hydro-restore",
                actorId: "driver",
                name: "Hydro restore",
                kind: "skill" as const,
                cancelFrame: 1,
                animationEndFrame: 1,
                cooldownFrames: 0,
                hits: [
                  applicationHit({
                    id: `hydro-restore-${restoreFrame}`,
                    element: "hydro",
                    gaugeUnits: restoreGaugeUnits
                  })
                ]
              }
            ])
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "compound-chain",
          atFrame: 0
        },
        ...(restoreFrame === undefined
          ? []
          : [
              {
                type: "skill" as const,
                actorId: "driver",
                abilityId: "hydro-restore",
                atFrame: restoreFrame
              }
            ])
      ]
    }
  };
}

function makePureEcHitlag120Config(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-global-cadence-pure-provisional-1",
    randomSeed: "ec-pure-2-2-120-0",
    meta: {
      name: "Aura-v9 pure EC global cadence Golden",
      version: "1.42.0",
      verificationStatus: "provisional",
      note:
        "Fixed-gcsim-provisional regression vector only; not official game data or a claim of complete gcsim parity."
    },
    duration: 145 / 60,
    cycleLength: 3,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Pure EC target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 2 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: {
      mode: "target-local-hitlag-v1"
    },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
    electroChargedPropagationModel: {
      mode: "single-target-v1"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "ec-start",
          actorId: "driver",
          name: "EC start",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "ec-start-hit",
              element: "electro",
              gaugeUnits: 2,
              hitlagFrames: 120
            })
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "ec-start",
          atFrame: 0
        }
      ]
    }
  };
}

function projectScenario(result: SimulationResult) {
  const frozenDamageEvents =
    projectDamageEventsToFrozenNoIcd(result);
  const componentTotals = result.damageEvents.reduce(
    (totals, event) => ({
      direct:
        totals.direct + event.damageComposition.direct,
      additiveReaction:
        totals.additiveReaction +
        event.damageComposition.additiveReaction,
      transformativeReaction:
        totals.transformativeReaction +
        event.damageComposition.transformativeReaction
    }),
    {
      direct: 0,
      additiveReaction: 0,
      transformativeReaction: 0
    }
  );
  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      resolvedRuntimeOptions:
        result.resolvedRuntimeOptions
    },
    configContract: {
      duration: result.config.duration,
      enemy: result.config.enemy,
      reactionEngine: result.config.reactionEngine,
      targetClockModel: result.config.targetClockModel,
      targetTaskModel: result.config.targetTaskModel,
      reactionDeliveryModel:
        result.config.reactionDeliveryModel,
      electroChargedPropagationModel:
        result.config.electroChargedPropagationModel,
      timeline: {
        mode: result.config.timeline?.mode ?? null,
        fps: result.config.timeline?.fps ?? null
      },
      enemyTargets: result.enemyTargets
    },
    reactionTasks: result.reactionTaskLog,
    periodicElectroCharged:
      result.periodicReactionLog.filter(
        (entry) => entry.reaction === "electroCharged"
      ),
    reactionDamageLog: result.reactionDamageLog,
    damageEvents: frozenDamageEvents,
    hitResolutionLog: result.hitResolutionLog,
    damageCurve: result.damageCurve,
    byCharacter: result.byCharacter,
    characterSummaries: result.characterSummaries,
    bySkill: result.bySkill,
    targetSummaries: result.targetSummaries,
    targetStateTimeline: result.targetStateTimeline,
    targetClockAudit: result.targetClockAudit,
    targetClockLog: result.targetClockLog,
    targetHitlagLog: result.targetHitlagLog,
    targetTaskPhaseLog: result.targetTaskPhaseLog,
    targetPhaseLog: result.targetPhaseLog,
    auraInitialStates: result.auraInitialStates,
    auraEndStates: result.auraEndStates,
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length,
      componentTotals,
      displayDamageTotal: result.damageEvents.reduce(
        (sum, event) => sum + event.displayDamage,
        0
      )
    }
  };
}

type CadenceGoldenScenario = ReturnType<
  typeof projectScenario
>;

type FrozenV142CadenceGoldenScenario = Omit<
  CadenceGoldenScenario,
  "identity"
> & {
  identity: Omit<
    CadenceGoldenScenario["identity"],
    | "schemaVersion"
    | "engineVersion"
    | "configHash"
    | "reproducibilityKey"
  > & {
    schemaVersion: typeof EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION;
    engineVersion: typeof EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION;
    configHash: string;
    reproducibilityKey: string;
  };
};

function projectScenarioToFrozenV142(
  result: SimulationResult
): FrozenV142CadenceGoldenScenario {
  const scenario = projectScenario(result);
  const frozenConfig = projectCurrentConfigToFrozenV142(
    result.config
  );
  const configHash = createSimulationConfigHash(frozenConfig);
  const runIdentity = {
    version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
    identityAlgorithm: result.runManifest.identityAlgorithm,
    schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
    engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
    dataVersion: result.runManifest.dataVersion,
    configHash,
    resolvedRuntimeOptions:
      result.runManifest.resolvedRuntimeOptions,
    plugins: result.runManifest.plugins
  } satisfies Omit<
    SimulationRunManifestV142,
    "reproducibilityKey"
  >;
  return {
    ...scenario,
    identity: {
      ...scenario.identity,
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
      configHash,
      reproducibilityKey:
        createSimulationReproducibilityKey(runIdentity)
    }
  };
}

function semanticHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function expectDamageConservation(
  result: SimulationResult
): void {
  let cumulativeDamage = 0;
  const cumulativeComponents = {
    direct: 0,
    additiveReaction: 0,
    transformativeReaction: 0
  };
  expect(result.damageCurve).toHaveLength(
    result.damageEvents.length
  );
  result.damageEvents.forEach((event, index) => {
    const composition =
      event.damageComposition.direct +
      event.damageComposition.additiveReaction +
      event.damageComposition.transformativeReaction;
    expect(composition).toBeCloseTo(event.finalDamage, 10);
    expect(event.displayDamage).toBe(
      Math.round(event.finalDamage)
    );
    cumulativeDamage += event.finalDamage;
    cumulativeComponents.direct +=
      event.damageComposition.direct;
    cumulativeComponents.additiveReaction +=
      event.damageComposition.additiveReaction;
    cumulativeComponents.transformativeReaction +=
      event.damageComposition.transformativeReaction;
    const point = result.damageCurve[index]!;
    expect(point).toMatchObject({
      damageEventId: event.id,
      targetId: event.targetId,
      targetName: event.targetName,
      frame: event.frame,
      timeSeconds: event.timeSeconds,
      sourceActorId: event.sourceActorId,
      creditOwnerId: event.creditOwnerId,
      finalDamage: event.finalDamage,
      cumulativeDamage,
      cumulativeByComponent: {
        ...cumulativeComponents
      }
    });
  });
  expect(cumulativeDamage).toBeCloseTo(
    result.totalDamage,
    10
  );
  expect(
    Object.values(result.byCharacter).reduce(
      (sum, damage) => sum + damage,
      0
    )
  ).toBeCloseTo(result.totalDamage, 10);
  expect(
    result.bySkill.reduce(
      (sum, skill) => sum + skill.damage,
      0
    )
  ).toBeCloseTo(result.totalDamage, 10);
  expect(
    result.targetSummaries.reduce(
      (sum, target) => sum + target.damage,
      0
    )
  ).toBeCloseTo(result.totalDamage, 10);
  expect(result.dps * result.config.duration).toBeCloseTo(
    result.totalDamage,
    10
  );
}

function cleanupOf(result: SimulationResult) {
  const task = result.reactionTaskLog.find(
    (entry) => entry.electroChargedCleanup !== null
  );
  if (task?.electroChargedCleanup === null || task === undefined) {
    throw new Error("Expected one EC cleanup task.");
  }
  return { task, cleanup: task.electroChargedCleanup };
}

describe("Aura-v9 Electro-Charged global cadence Golden", () => {
  it("freezes five deterministic long-Hitlag and global-cadence results with complete damage projections", () => {
    const runs: Array<{
      id: CadenceGoldenScenarioId;
      config: SimConfig;
      expectedApplications: readonly ExpectedNoIcdApplication[];
    }> = [
      {
        id: "longHitlagNoRestoreStop",
        config: makeLongHitlagConfig(),
        expectedApplications: [
          { hitId: "dendro-quicken", frame: 0, gaugeUnits: 0.2 },
          { hitId: "electro-stream", frame: 0, gaugeUnits: 0.8 }
        ]
      },
      {
        id: "longHitlagRestoreF70Scheduled",
        config: makeLongHitlagConfig({
          restoreFrame: 70
        }),
        expectedApplications: [
          { hitId: "dendro-quicken", frame: 0, gaugeUnits: 0.2 },
          { hitId: "electro-stream", frame: 0, gaugeUnits: 0.8 },
          { hitId: "hydro-restore-70", frame: 70, gaugeUnits: 1 }
        ]
      },
      {
        id: "longHitlagRestoreF71Dormant",
        config: makeLongHitlagConfig({
          restoreFrame: 71
        }),
        expectedApplications: [
          { hitId: "dendro-quicken", frame: 0, gaugeUnits: 0.2 },
          { hitId: "electro-stream", frame: 0, gaugeUnits: 0.8 },
          { hitId: "hydro-restore-71", frame: 71, gaugeUnits: 1 }
        ]
      },
      {
        id: "longHitlagRestoreF5EndedBeforeDeadline",
        config: makeLongHitlagConfig({
          restoreFrame: 5,
          restoreGaugeUnits: 0.5
        }),
        expectedApplications: [
          { hitId: "dendro-quicken", frame: 0, gaugeUnits: 0.2 },
          { hitId: "electro-stream", frame: 0, gaugeUnits: 0.8 },
          { hitId: "hydro-restore-5", frame: 5, gaugeUnits: 0.5 }
        ]
      },
      {
        id: "pureEcHitlag120GlobalCadence",
        config: makePureEcHitlag120Config(),
        expectedApplications: [
          { hitId: "ec-start-hit", frame: 0, gaugeUnits: 2 }
        ]
      }
    ];
    const scenarios = {} as Record<
      CadenceGoldenScenarioId,
      FrozenV142CadenceGoldenScenario
    >;
    for (const run of runs) {
      const first = simulate(run.config, {
        critMode: "noCrit"
      });
      const repeated = simulate(run.config, {
        critMode: "noCrit"
      });
      expect(repeated).toEqual(first);
      expect(
        electroChargedCleanupResultReferencesSchema.parse(
          first
        )
      ).toEqual(first);
      expect(
        targetPhaseV2ResultReferencesSchema.parse(first)
      ).toEqual(first);
      expect(
        reactionDeliveryResultReferencesSchema.parse(first)
      ).toEqual(first);
      expect(
        playerDamageResultReferencesSchema.parse(first)
      ).toEqual(first);
      expectCurrentNoIcdApplicationContract(
        first,
        run.expectedApplications
      );
      expectDamageConservation(first);
      scenarios[run.id] = projectScenarioToFrozenV142(first);
    }

    expect(Object.keys(scenarios).sort()).toEqual(
      [...SCENARIO_IDS].sort()
    );
    const fixture =
      electroChargedGlobalCadenceGoldenFixtureV142Schema.parse(
        JSON.parse(readFileSync(FIXTURE_URL, "utf8"))
      );
    for (const id of SCENARIO_IDS) {
      expect(semanticHash(fixture.scenarios[id])).toBe(
        fixture.hashes[id]
      );
      expect(semanticHash(scenarios[id])).toBe(fixture.hashes[id]);
      expect(scenarios[id]).toEqual(fixture.scenarios[id]);
    }

    const noRestore =
      fixture.scenarios.longHitlagNoRestoreStop;
    expect(
      noRestore.periodicElectroCharged.map(
        ({ frame, operation }) => ({ frame, operation })
      )
    ).toEqual([
      { frame: 0, operation: "start" },
      { frame: 10, operation: "tick" },
      { frame: 70, operation: "tick-skipped" },
      { frame: 121, operation: "stop" }
    ]);
    expect(cleanupOf(simulate(runs[0]!.config, {
      critMode: "noCrit"
    })).cleanup).toMatchObject({
      outcome: "stop",
      periodicReactionLogId:
        noRestore.periodicElectroCharged.at(-1)?.id,
      cadence: {
        status: "stopped",
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: 70
      }
    });

    const scheduled =
      fixture.scenarios.longHitlagRestoreF70Scheduled;
    expect(
      scheduled.periodicElectroCharged
        .filter((row) => row.operation === "tick")
        .map((row) => row.frame)
    ).toEqual([10, 70, 130]);
    const restoreF70 =
      scheduled.periodicElectroCharged.find(
        (row) =>
          row.operation === "refresh" && row.frame === 70
      );
    const tickF70 =
      scheduled.periodicElectroCharged.find(
        (row) =>
          row.operation === "tick" && row.frame === 70
      );
    if (restoreF70 === undefined || tickF70 === undefined) {
      throw new Error(
        "Expected the same-frame F70 refresh and callback."
      );
    }
    expect(restoreF70.id).toBeLessThan(tickF70.id);
    expect(
      scheduled.reactionTasks[0]?.electroChargedCleanup
    ).toMatchObject({
      outcome: "retain",
      cadence: {
        status: "scheduled",
        nextTickFrame: 130,
        waneListenerActive: false,
        lastCallbackFrame: 70
      }
    });

    const dormant =
      fixture.scenarios.longHitlagRestoreF71Dormant;
    expect(
      dormant.periodicElectroCharged.find(
        (row) => row.frame === 70
      )
    ).toMatchObject({
      operation: "tick-skipped",
      cadenceStatus: "dormant",
      nextTickFrame: null,
      waneListenerActive: false
    });
    expect(
      dormant.reactionTasks[0]?.electroChargedCleanup
    ).toMatchObject({
      outcome: "retain",
      cadence: {
        status: "dormant",
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: 70
      }
    });

    const ended =
      fixture.scenarios
        .longHitlagRestoreF5EndedBeforeDeadline;
    const terminal = ended.periodicElectroCharged.find(
      (row) =>
        row.frame === 16 && row.operation === "wane"
    );
    expect(terminal).toMatchObject({
      cadenceStatus: "stopped",
      nextTickFrame: null,
      waneListenerActive: false,
      reason: "AURA_DEPLETED_BY_WANE"
    });
    expect(
      ended.reactionTasks[0]?.electroChargedCleanup
    ).toMatchObject({
      outcome: "ended-before-deadline",
      resolutionReason:
        "ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP",
      periodicReactionLogId: terminal?.id
    });

    const pure =
      fixture.scenarios.pureEcHitlag120GlobalCadence;
    expect(
      pure.periodicElectroCharged
        .filter((row) => row.operation === "tick")
        .map((row) => row.frame)
    ).toEqual([10, 70, 130]);
    expect(
      pure.periodicElectroCharged
        .filter((row) => row.operation === "wane")
        .map((row) => row.frame)
    ).toEqual([16, 76, 136]);
    expect(
      pure.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
        .map((event) => event.frame)
    ).toEqual([10, 70, 130]);

  });

  it("rejects coordinated per-source Wane and terminal-cadence drift", () => {
    const legal = simulate(
      makeLongHitlagConfig({
        restoreFrame: 5,
        restoreGaugeUnits: 0.5
      }),
      { critMode: "noCrit" }
    );
    const wane = legal.periodicReactionLog.find(
      (row) => row.frame === 16 && row.operation === "wane"
    );
    const point = legal.targetStateTimeline.points.find(
      (candidate) =>
        candidate.links.some(
          (link) =>
            link.kind === "periodic-reaction-log" &&
            link.id === wane?.id
        )
    );
    const electroConsumption = wane?.auraConsumed.find(
      (entry) => entry.element === "electro"
    );
    const driverMutation =
      electroConsumption?.sourceMutations?.find(
        (mutation) => mutation.sourceActorId === "driver"
      );
    if (
      wane === undefined ||
      point === undefined ||
      electroConsumption === undefined ||
      driverMutation === undefined
    ) {
      throw new Error(
        "Expected the F16 multi-source terminal Wane proof."
      );
    }
    for (const mutation of electroConsumption.sourceMutations ?? []) {
      expect(mutation.consumedGaugeUnits).toBeCloseTo(
        Math.min(0.4, mutation.gaugeUnitsBefore),
        12
      );
    }
    expect(simulationResultSchema.parse(legal)).toEqual(legal);
    expect(assertTrustedSimulationResult(legal)).toBe(legal);

    const forgedSource = structuredClone(legal);
    const forgedWane = forgedSource.periodicReactionLog[wane.id]!;
    const forgedElectro = forgedWane.auraConsumed.find(
      (entry) => entry.element === "electro"
    )!;
    const forgedMutation = forgedElectro.sourceMutations!.find(
      (mutation) => mutation.sourceActorId === "driver"
    )!;
    forgedMutation.consumedGaugeUnits = 0.3;
    forgedMutation.gaugeUnitsAfter =
      forgedMutation.gaugeUnitsBefore - 0.3;
    const forgedElectroAfter = forgedWane.auraAfter.find(
      (entry) => entry.element === "electro"
    )!;
    forgedElectroAfter.sourceSlots!.find(
      (slot) => slot.sourceActorId === "driver"
    )!.gaugeUnits = forgedMutation.gaugeUnitsAfter;
    const forgedPoint =
      forgedSource.targetStateTimeline.points[point.id]!;
    forgedPoint.auraConsumed = structuredClone(
      forgedWane.auraConsumed
    );
    forgedPoint.auraAfter = structuredClone(forgedWane.auraAfter);
    expect(simulationResultSchema.safeParse(forgedSource).success).toBe(
      false
    );
    expect(() =>
      assertTrustedSimulationResult(forgedSource)
    ).toThrow(/fixed 0\.4U budget/);

    const forgedDeadlines = structuredClone(legal);
    const forgedDeadlineWane =
      forgedDeadlines.periodicReactionLog[wane.id]!;
    const forgedDeadlineElectro =
      forgedDeadlineWane.auraAfter.find(
        (entry) => entry.element === "electro"
      )!;
    forgedDeadlineElectro.expiresAtFrame! += 100;
    forgedDeadlineElectro.expiresAtTargetFrame! += 100;
    forgedDeadlines.targetStateTimeline.points[point.id]!.auraAfter =
      structuredClone(forgedDeadlineWane.auraAfter);
    expect(
      simulationResultSchema.safeParse(forgedDeadlines).success
    ).toBe(false);
    expect(() =>
      assertTrustedSimulationResult(forgedDeadlines)
    ).toThrow(/Aura deadline must retain/);

    const forgedCadence = structuredClone(legal);
    Object.assign(forgedCadence.periodicReactionLog[wane.id]!, {
      cadenceStatus: "scheduled" as const,
      waneListenerActive: true
    });
    expect(simulationResultSchema.safeParse(forgedCadence).success).toBe(
      false
    );
    expect(() =>
      assertTrustedSimulationResult(forgedCadence)
    ).toThrow(/post-Wane cadence status/);
  });
});
