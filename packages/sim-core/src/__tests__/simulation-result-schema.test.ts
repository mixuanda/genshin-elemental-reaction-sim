import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
  EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
  assertTrustedSimulationResultV144,
  legacyDefault120sGoldenFixtureV142Schema,
  simulationResultV142Schema,
  simulationResultV144Schema,
  simulationResultV144ValueSchema,
  type AbilityDefinition,
  type CharacterProfile,
  type Element,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import frozenGoldenV142 from "../../../test-vectors/fixtures/legacy-default-120s-1.42.golden.json";
import { beforeAll, describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const ZERO_RESISTANCES = {
  pyro: 0,
  cryo: 0,
  hydro: 0,
  electro: 0,
  anemo: 0,
  geo: 0,
  dendro: 0,
  physical: 0
} as const;

const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

function noIcd(id: string) {
  return {
    gaugeUnits: 1,
    icdTag: id,
    icdGroup: "no-icd" as const
  };
}

function makeAuraV9TargetPhaseConfig(): SimConfig {
  const base = makeConfig();
  const ability: AbilityDefinition = {
    id: "result-schema-aura-v9",
    actorId: "a",
    name: "Result Schema Aura v9",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "dendro-quicken",
        label: "Dendro Quicken",
        frame: 0,
        scaling: 0,
        element: "dendro",
        geometry: SAME_TARGET_GEOMETRY,
        application: {
          ...noIcd("dendro-quicken"),
          gaugeUnits: 0.2
        }
      },
      {
        id: "electro-hitlag",
        label: "Electro Hitlag",
        frame: 0,
        scaling: 0,
        element: "electro",
        geometry: SAME_TARGET_GEOMETRY,
        application: {
          ...noIcd("electro-hitlag"),
          gaugeUnits: 0.8
        },
        targetHitlag: {
          haltFrames: 120,
          factor: 0
        }
      }
    ],
    timelineState: {
      grants: [
        {
          key: "result-schema-window",
          label: "Result Schema Window",
          durationFrames: 10
        }
      ]
    }
  };

  return {
    ...base,
    dataVersion: "simulation-result-schema-aura-v9",
    randomSeed: "simulation-result-schema-aura-v9",
    meta: {
      name: "SimulationResult Aura v9 vector",
      version: "1.42.0",
      verificationStatus: "provisional"
    },
    duration: 145 / 60,
    cycleLength: 145 / 60,
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
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "a",
          abilityId: ability.id,
          atFrame: 0
        }
      ]
    }
  };
}

function character(
  template: CharacterProfile,
  id: string,
  element: Element
): CharacterProfile {
  return {
    ...template,
    id,
    name: id,
    element,
    stats: {
      ...neutralStats,
      baseAtk: 0,
      baseHp: 10_000
    }
  };
}

function makePlayerDamageConfig(): SimConfig {
  const base = makeConfig();
  const pyro = character(
    base.characters[0]!,
    "pyro",
    "pyro"
  );
  const ability: AbilityDefinition = {
    id: "result-schema-burning",
    actorId: pyro.id,
    name: "Result Schema Burning",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "pyro-hit",
        label: "Pyro application",
        frame: 0,
        scaling: 0,
        element: "pyro",
        geometry: SAME_TARGET_GEOMETRY,
        application: noIcd("pyro-hit")
      }
    ]
  };

  return {
    ...base,
    dataVersion: "simulation-result-schema-player-damage",
    randomSeed: "simulation-result-schema-player-damage",
    meta: {
      name: "SimulationResult player-damage vector",
      version: "1.42.0",
      verificationStatus: "provisional"
    },
    duration: 1.1,
    cycleLength: 1.1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Burning source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "dendro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [pyro],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    playerDamageModel: {
      mode: "reaction-self-v1",
      position: { x: 0, y: 0 },
      hitboxRadius: 0.5,
      shieldMode: "crystallize-v1",
      zeroHpPolicy: "clamp-and-continue",
      characters: [
        {
          actorId: pyro.id,
          initialHpRatio: 1,
          resistances: { ...ZERO_RESISTANCES }
        }
      ]
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: pyro.id,
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: pyro.id,
          abilityId: ability.id,
          atFrame: 0
        }
      ]
    }
  };
}

function makeElectroChargedIntegrityConfig(): SimConfig {
  const base = makeConfig();
  const ability: AbilityDefinition = {
    id: "result-schema-electro-charged",
    actorId: "a",
    name: "Result Schema Electro-Charged",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "electro-charged-trigger",
        label: "Electro-Charged trigger",
        frame: 0,
        scaling: 0,
        element: "electro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        },
        application: noIcd("electro-charged-trigger")
      }
    ]
  };

  return {
    ...base,
    dataVersion: "simulation-result-schema-electro-charged",
    randomSeed: "simulation-result-schema-electro-charged",
    duration: 2,
    cycleLength: 2,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Electro-Charged target",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      },
      character(
        base.characters[0]!,
        "spectator",
        "cryo"
      )
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "a",
          abilityId: ability.id,
          atFrame: 0
        }
      ]
    }
  };
}

function makeFrozenExpiryIntegrityConfig(): SimConfig {
  const base = makeConfig();
  const hydro = character(
    base.characters[0]!,
    "hydro",
    "hydro"
  );
  const ability: AbilityDefinition = {
    id: "result-schema-freeze",
    actorId: hydro.id,
    name: "Result Schema Freeze",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "freeze-trigger",
        label: "Freeze trigger",
        frame: 0,
        scaling: 0,
        element: "hydro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        },
        application: noIcd("freeze-trigger")
      },
      {
        id: "neutral-witness",
        label: "Unrelated neutral witness",
        frame: 1,
        scaling: 0,
        element: "physical"
      }
    ]
  };

  return {
    ...base,
    dataVersion: "simulation-result-schema-frozen-expiry",
    randomSeed: "simulation-result-schema-frozen-expiry",
    duration: 4,
    cycleLength: 4,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      freezeResistance: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Frozen expiry target",
          initialAura: [
            { element: "cryo", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [hydro],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: hydro.id,
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: hydro.id,
          abilityId: ability.id,
          atFrame: 0
        }
      ]
    }
  };
}

function makeSameFrameSuperconductIntegrityConfig(): SimConfig {
  const base = makeConfig();
  const sourceTargets = [
    {
      id: "source-left",
      name: "Left Superconduct source",
      position: { x: 0, y: 0 },
      initialAura: [
        { element: "cryo" as const, gaugeUnits: 1 }
      ]
    },
    {
      id: "source-right",
      name: "Right Superconduct source",
      position: { x: 4, y: 0 },
      initialAura: [
        { element: "cryo" as const, gaugeUnits: 1 }
      ]
    }
  ];
  const ability: AbilityDefinition = {
    id: "result-schema-same-frame-superconduct",
    actorId: "electro",
    name: "Result Schema same-frame Superconduct",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: sourceTargets.map((target, index) => ({
      id: `superconduct-trigger-${index}`,
      label: `Superconduct trigger ${index}`,
      frame: 0,
      scaling: 0,
      element: "electro" as const,
      geometry: {
        kind: "circle" as const,
        coordinateSpace: "world" as const,
        origin: target.position,
        radius: 0.1
      },
      application: noIcd(
        `same-frame-superconduct-${index}`
      )
    }))
  };

  return {
    ...base,
    dataVersion: "simulation-result-schema-superconduct",
    randomSeed: "simulation-result-schema-superconduct",
    duration: 1,
    cycleLength: 1,
    targetClockModel: {
      mode: "target-local-hitlag-v1"
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        ...sourceTargets,
        {
          id: "enemy-0",
          name: "Shared Superconduct target",
          position: { x: 2, y: 0 }
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: ability.id,
          atFrame: 0
        }
      ]
    }
  };
}

function cloneResult(
  result: SimulationResult
): SimulationResult {
  return structuredClone(result);
}

function expectRejected(
  result: SimulationResult,
  mutate: (value: SimulationResult) => void
): void {
  const mutation = cloneResult(result);
  mutate(mutation);
  expect(
    simulationResultV144Schema.safeParse(mutation).success
  ).toBe(false);
}

function expectRejectedByPublicAndTrusted(
  result: SimulationResult,
  mutate: (value: SimulationResult) => void
): void {
  const publicWire = cloneResult(result);
  mutate(publicWire);
  expect(
    simulationResultV144Schema.safeParse(publicWire).success
  ).toBe(false);

  const trustedResult = cloneResult(result);
  mutate(trustedResult);
  expect(() =>
    assertTrustedSimulationResultV144(trustedResult)
  ).toThrow(/Trusted SimulationResult 1\.44 integrity validation failed/);
}

function expectAccepted(result: SimulationResult): void {
  const parsed = simulationResultV144Schema.safeParse(result);
  if (!parsed.success) {
    throw new Error(
      JSON.stringify(
        parsed.error.issues.map(({ path, message }) => ({
          path,
          message
        })),
        null,
        2
      )
    );
  }
}

let defaultResult: SimulationResult;
let auraV9Result: SimulationResult;
let playerDamageResult: SimulationResult;
let electroChargedResult: SimulationResult;
let frozenExpiryResult: SimulationResult;
let sameFrameSuperconductResult: SimulationResult;

beforeAll(() => {
  defaultResult = simulate(durinMeltPreset);
  auraV9Result = simulate(makeAuraV9TargetPhaseConfig(), {
    critMode: "noCrit"
  });
  playerDamageResult = simulate(makePlayerDamageConfig(), {
    critMode: "noCrit"
  });
  electroChargedResult = simulate(
    makeElectroChargedIntegrityConfig(),
    {
      critMode: "noCrit"
    }
  );
  frozenExpiryResult = simulate(
    makeFrozenExpiryIntegrityConfig(),
    {
      critMode: "noCrit"
    }
  );
  sameFrameSuperconductResult = simulate(
    makeSameFrameSuperconductIntegrityConfig(),
    {
      critMode: "noCrit"
    }
  );
});

describe("exact current 1.44 SimulationResult schema", () => {
  it("keeps the persisted 1.42 fixture and frozen result identity separate", () => {
    expect(
      legacyDefault120sGoldenFixtureV142Schema.safeParse(
        frozenGoldenV142
      ).success
    ).toBe(true);
    expect(
      simulationResultV142Schema.safeParse(defaultResult).success
    ).toBe(false);
    expect(
      simulationResultV144Schema.safeParse(defaultResult).success
    ).toBe(true);
  });

  it("keeps the exact 65-field shape and all 64 non-timeline fields required", () => {
    const schemaKeys = Object.keys(
      simulationResultV144ValueSchema.shape
    ).sort();
    expect(schemaKeys).toHaveLength(65);
    expect(Object.keys(defaultResult).sort()).toEqual(
      schemaKeys.filter((key) => key !== "timelineExecution")
    );
    expect(Object.keys(auraV9Result).sort()).toEqual(schemaKeys);

    for (const key of schemaKeys) {
      if (key === "timelineExecution") continue;
      const missing = cloneResult(
        defaultResult
      ) as unknown as Record<string, unknown>;
      delete missing[key];
      expect(
        simulationResultV144Schema.safeParse(missing).success,
        `missing required top-level field ${key}`
      ).toBe(false);
    }
  });

  it("accepts the default 120-second legacy-compatible result", () => {
    expect(defaultResult.compatibilityMode).toBe("legacy-v0.1");
    expect(defaultResult.damageEvents.length).toBeGreaterThan(0);
    expect(defaultResult.skippedActions.length).toBeGreaterThan(0);
    expectAccepted(defaultResult);
  });

  it("accepts legal-frame Aura v9 target-clock and target-phase-v2 output", () => {
    expect(auraV9Result.targetClockAudit.mode).toBe(
      "target-local-hitlag-v1"
    );
    expect(auraV9Result.targetHitlagLog.length).toBeGreaterThan(0);
    expect(auraV9Result.targetPhaseLog.length).toBeGreaterThan(0);
    expect(auraV9Result.reactionDamageLog.length).toBeGreaterThan(
      0
    );
    expectAccepted(auraV9Result);
  });

  it("accepts modeled player reaction damage and HP projections", () => {
    expect(
      playerDamageResult.playerHitResolutionLog.length
    ).toBeGreaterThan(0);
    expect(
      playerDamageResult.playerDamageEvents.length
    ).toBeGreaterThan(0);
    expect(playerDamageResult.totalPlayerDamageTaken).toBeGreaterThan(
      0
    );
    expectAccepted(playerDamageResult);
  });

  it("rejects missing and unknown top-level fields", () => {
    const missing = cloneResult(defaultResult) as unknown as Record<
      string,
      unknown
    >;
    delete missing.damageCurve;
    expect(
      simulationResultV144Schema.safeParse(missing).success
    ).toBe(false);

    const unknown = cloneResult(defaultResult) as unknown as Record<
      string,
      unknown
    >;
    unknown.unversionedResultField = true;
    expect(
      simulationResultV144Schema.safeParse(unknown).success
    ).toBe(false);
  });

  it("rejects prototype, accessor, sparse-array, and cyclic result wires", () => {
    const inherited = cloneResult(
      defaultResult
    ) as unknown as Record<string, unknown>;
    const inheritedVersion = inherited.schemaVersion;
    delete inherited.schemaVersion;
    Object.setPrototypeOf(inherited, {
      schemaVersion: inheritedVersion
    });
    expect(
      simulationResultV144Schema.safeParse(inherited).success
    ).toBe(false);

    const accessor = cloneResult(
      defaultResult
    ) as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "totalDamage", {
      enumerable: true,
      get: () => defaultResult.totalDamage
    });
    expect(
      simulationResultV144Schema.safeParse(accessor).success
    ).toBe(false);

    const sparse = cloneResult(defaultResult);
    delete sparse.damageEvents[0];
    expect(
      simulationResultV144Schema.safeParse(sparse).success
    ).toBe(false);

    const cyclic = cloneResult(
      defaultResult
    ) as unknown as Record<string, unknown>;
    cyclic.cycle = cyclic;
    expect(
      simulationResultV144Schema.safeParse(cyclic).success
    ).toBe(false);
  });

  it("rejects historical and mixed top-level/config/manifest identity", () => {
    const historical = cloneResult(defaultResult);
    (
      historical as unknown as {
        schemaVersion: string;
        engineVersion: string;
      }
    ).schemaVersion =
      EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION;
    (
      historical as unknown as {
        schemaVersion: string;
        engineVersion: string;
      }
    ).engineVersion =
      EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION;
    (
      historical.config as unknown as {
        schemaVersion: string;
        engineVersion: string;
      }
    ).schemaVersion =
      EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION;
    (
      historical.config as unknown as {
        schemaVersion: string;
        engineVersion: string;
      }
    ).engineVersion =
      EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION;
    (
      historical.runManifest as unknown as {
        schemaVersion: string;
        engineVersion: string;
      }
    ).schemaVersion =
      EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION;
    (
      historical.runManifest as unknown as {
        schemaVersion: string;
        engineVersion: string;
      }
    ).engineVersion =
      EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION;

    expect(
      simulationResultV144Schema.safeParse(historical).success
    ).toBe(false);

    expectRejected(defaultResult, (mutation) => {
      mutation.engineVersion =
        EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION;
    });
  });

  it("rejects run-manifest convenience-alias drift", () => {
    expectRejected(defaultResult, (mutation) => {
      mutation.resolvedRuntimeOptions.critMode =
        mutation.resolvedRuntimeOptions.critMode === "average"
          ? "noCrit"
          : "average";
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.pluginManifest = [
        {
          order: 0,
          index: 0,
          id: "forged-alias",
          version: "1",
          kind: "declarative",
          contentHash: "fnv1a32:00000000"
        }
      ];
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.reproducibilityKey =
        "gdl-v2-fnv1a32-00000000";
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.config.dataVersion = "forged-data-version";
    });
  });

  it("rejects damage display and composition drift", () => {
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents[0]!.displayDamage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents[0]!.damageComposition.direct += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents[0]!.time += 1;
    });
  });

  it("rejects internally inconsistent damage factors and reaction aliases", () => {
    for (const field of [
      "baseAtk",
      "atkPct",
      "flatAtk"
    ] as const) {
      expectRejectedByPublicAndTrusted(
        defaultResult,
        (mutation) => {
          const event = mutation.damageEvents.find(
            (candidate) =>
              candidate.damageFactors.scalingStat === "atk"
          );
          if (event === undefined) {
            throw new Error(
              "Default result must include an ATK-scaling event."
            );
          }
          event.statsBeforeDamage[field] += 1;
          mutation.hitEvents = mutation.damageEvents;
        }
      );
    }
    expectRejectedByPublicAndTrusted(
      auraV9Result,
      (mutation) => {
        const event = mutation.damageEvents.find(
          (candidate) =>
            candidate.kind === "transformative-reaction" &&
            candidate.damageFactors.scalingStat === "em"
        );
        if (event === undefined) {
          throw new Error(
            "Aura v9 result must include an EM-scaling transformative event."
          );
        }
        event.statsBeforeDamage.em += 1;
        mutation.hitEvents = mutation.damageEvents;
      }
    );
    expectRejectedByPublicAndTrusted(
      auraV9Result,
      (mutation) => {
        const event = mutation.damageEvents.find(
          (candidate) =>
            candidate.kind === "transformative-reaction"
        );
        if (event === undefined) {
          throw new Error(
            "Aura v9 result must include transformative reaction damage."
          );
        }
        const forgedAtk =
          event.statsBeforeDamage.baseAtk *
            (1 + event.statsBeforeDamage.atkPct) +
          event.statsBeforeDamage.flatAtk;
        event.damageFactors.scalingStat = "atk";
        event.damageFactors.scalingValue = forgedAtk;
        event.scalingStat = "atk";
        event.scalingValue = forgedAtk;
        mutation.hitEvents = mutation.damageEvents;
      }
    );
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents[0]!.reactionFactor += 1;
      mutation.hitEvents = mutation.damageEvents;
    });
    expectRejected(defaultResult, (mutation) => {
      const event = mutation.damageEvents[0]!;
      event.damageFactors.scaling += 1;
      event.scaling += 1;
      mutation.hitEvents = mutation.damageEvents;
    });
    expectRejected(defaultResult, (mutation) => {
      const event = mutation.damageEvents[0]!;
      event.damageFactors.effectiveResistance += 0.01;
      event.effectiveRes += 0.01;
      mutation.hitEvents = mutation.damageEvents;
    });
    expectRejected(auraV9Result, (mutation) => {
      const event = mutation.damageEvents.find(
        (candidate) =>
          candidate.kind === "transformative-reaction"
      );
      if (event === undefined) {
        throw new Error(
          "Aura v9 result must include transformative reaction damage."
        );
      }
      event.reactionFactor += 1;
      mutation.hitEvents = mutation.damageEvents;
    });
  });

  it.each([
    ["hp", "baseHp"],
    ["def", "baseDef"],
    ["em", "em"]
  ] as const)(
    "binds direct %s scaling to its damage snapshot",
    (scalingStat, snapshotField) => {
      const result = simulate(
        makeConfig({
          rotation: [
            {
              id: `${scalingStat}-snapshot`,
              actorId: "a",
              name: `${scalingStat.toUpperCase()} snapshot`,
              at: 0,
              hits: [
                {
                  id: `${scalingStat}-hit`,
                  offset: 0,
                  scaling: 1,
                  scalingStat,
                  element: "pyro"
                }
              ]
            }
          ]
        }),
        { critMode: "noCrit" }
      );

      expectRejectedByPublicAndTrusted(
        result,
        (mutation) => {
          mutation.damageEvents[0]!.statsBeforeDamage[
            snapshotField
          ] += 1;
          mutation.hitEvents = mutation.damageEvents;
        }
      );
    }
  );

  it("rejects reaction-audit drift and forged damage composition even when the curve is synchronized", () => {
    expectRejected(defaultResult, (mutation) => {
      const event = mutation.damageEvents.find(
        (candidate) =>
          candidate.kind === "direct" &&
          candidate.reaction !== "none"
      );
      if (event === undefined) {
        throw new Error(
          "Default result must include a direct reacted event."
        );
      }
      const forgedReaction =
        event.reaction === "melt" ? "vaporize" : "melt";
      event.reactionAudit.reaction = forgedReaction;
      event.reactionAudit.reactions =
        event.reactionAudit.reactions.map((reaction) =>
          reaction === event.reaction
            ? forgedReaction
            : reaction
        );
      mutation.hitEvents = mutation.damageEvents;
    });

    expectRejected(defaultResult, (mutation) => {
      const eventIndex = mutation.damageEvents.findIndex(
        (event) =>
          event.kind === "direct" &&
          event.additiveReactionFactors === null &&
          event.damageComposition.direct > 1
      );
      if (eventIndex < 0) {
        throw new Error(
          "Default result must include ordinary direct damage."
        );
      }
      const event = mutation.damageEvents[eventIndex]!;
      event.damageComposition.direct -= 1;
      event.damageComposition.additiveReaction += 1;
      for (
        let curveIndex = eventIndex;
        curveIndex < mutation.damageCurve.length;
        curveIndex += 1
      ) {
        const point = mutation.damageCurve[curveIndex]!;
        point.cumulativeByComponent.direct -= 1;
        point.cumulativeByComponent.additiveReaction += 1;
      }
      mutation.hitEvents = mutation.damageEvents;
    });
  });

  it("rejects total, DPS, reacted-hit, and summary drift", () => {
    expectRejected(defaultResult, (mutation) => {
      mutation.totalDamage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.dps += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.reactedHits += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      const characterId =
        mutation.characterSummaries[0]!.characterId;
      mutation.byCharacter[characterId]! += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.characterSummaries[0]!.damage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.targetSummaries[0]!.damage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.bySkill[0]!.damage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      const terminal =
        mutation.damageCurve[mutation.damageCurve.length - 1]!;
      terminal.cumulativeDamage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      const populatedBucket = mutation.perSecond.find((bucket) =>
        Object.values(bucket).some(
          (value) =>
            typeof value === "number" &&
            Number.isFinite(value) &&
            value !== 0
        )
      )!;
      const damageKey = Object.keys(populatedBucket).find(
        (key) => key !== "second" && key !== "total"
      );
      if (damageKey === undefined) {
        throw new Error(
          "Default result must expose a populated per-second actor bucket."
        );
      }
      populatedBucket[damageKey]! += 1;
    });
  });

  it("rejects hitEvents content that drifts from damageEvents", () => {
    expectRejected(defaultResult, (mutation) => {
      mutation.hitEvents = mutation.damageEvents.map((event) => ({
        ...event,
        damageComposition: { ...event.damageComposition }
      }));
      mutation.hitEvents[0]!.displayDamage += 1;
    });
  });

  it("rejects non-contiguous IDs, output reordering, and broken backlinks", () => {
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents[0]!.id += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents = [...mutation.damageEvents].reverse();
      mutation.hitEvents = [...mutation.damageEvents];
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.damageCurve[0]!.damageEventId = 1_000_000;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.energyCurve[0]!.id = 1_000_000;
    });
    expectRejected(defaultResult, (mutation) => {
      mutation.damageEvents[0]!.targetResolutionId = 1_000_000;
    });
    expectRejected(auraV9Result, (mutation) => {
      const linkedReaction = mutation.reactionDamageLog.find(
        (entry) => entry.damageEventIds.length > 0
      );
      if (linkedReaction === undefined) {
        throw new Error(
          "Aura v9 result must expose a reaction-damage backlink."
        );
      }
      linkedReaction.damageEventIds[0] = 1_000_000;
    });
    expectRejected(auraV9Result, (mutation) => {
      const linkedReaction = mutation.reactionDamageLog.find(
        (entry) => entry.damageEventIds.length > 0
      );
      if (linkedReaction === undefined) {
        throw new Error(
          "Aura v9 result must expose a reaction-damage backlink."
        );
      }
      const currentId = linkedReaction.damageEventIds[0]!;
      const wrongExisting = mutation.damageEvents.find(
        (event) =>
          event.id !== currentId &&
          !linkedReaction.damageEventIds.includes(event.id)
      );
      if (wrongExisting === undefined) {
        throw new Error(
          "Aura v9 result must expose an unrelated damage event."
        );
      }
      linkedReaction.damageEventIds[0] = wrongExisting.id;
    });
    expectRejected(playerDamageResult, (mutation) => {
      const playerEvent = mutation.playerDamageEvents.find(
        (event) => event.reactionDamageLogId !== null
      );
      if (playerEvent === undefined) {
        throw new Error(
          "Player-damage result must expose a reaction-damage backlink."
        );
      }
      playerEvent.reactionDamageLogId = 1_000_000;
    });
  });

  it("rejects reaction-damage trigger-frame drift at both result boundaries", () => {
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      const parent = mutation.reactionDamageLog.find(
        (entry) => entry.triggerDamageEventId !== null
      );
      if (parent === undefined) {
        throw new Error(
          "Aura v9 result must expose a triggered reaction-damage log."
        );
      }
      parent.triggerFrame += 1;
    });
  });

  it("rejects Electro-Charged tick clock drift and duplicate ownership at both result boundaries", () => {
    const tick = electroChargedResult.periodicReactionLog.find(
      (entry) => entry.operation === "tick"
    );
    expect(tick).toBeDefined();
    expect(tick?.reactionDamageLogId).not.toBeNull();
    expect(tick?.damageEventId).not.toBeNull();

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const forgedTick = mutation.periodicReactionLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick === undefined) {
          throw new Error(
            "Electro-Charged result must expose a periodic tick."
          );
        }
        forgedTick.frame += 1;
        forgedTick.timeSeconds = forgedTick.frame / 60;
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const forgedTick = mutation.periodicReactionLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick === undefined) {
          throw new Error(
            "Electro-Charged result must expose a periodic tick."
          );
        }
        mutation.periodicReactionLog.push({
          ...forgedTick,
          id: mutation.periodicReactionLog.length,
          auraBefore: structuredClone(forgedTick.auraBefore),
          auraConsumed: structuredClone(forgedTick.auraConsumed),
          auraAfter: structuredClone(forgedTick.auraAfter)
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const forgedTick = mutation.periodicReactionLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick === undefined) {
          throw new Error(
            "Electro-Charged result must expose a periodic tick."
          );
        }
        forgedTick.generation += 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const forgedTick = mutation.periodicReactionLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick === undefined) {
          throw new Error(
            "Electro-Charged result must expose a periodic tick."
          );
        }
        forgedTick.tickIndex = 999;
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const start = mutation.periodicReactionLog.find(
          (entry) => entry.operation === "start"
        );
        if (start === undefined) {
          throw new Error(
            "Electro-Charged result must expose a start row."
          );
        }
        mutation.periodicReactionLog.push({
          ...structuredClone(start),
          id: mutation.periodicReactionLog.length,
          generation: 999,
          operation: "stop",
          frame: 119,
          timeSeconds: 119 / 60,
          sourceActorId: null,
          triggerDamageEventId: null,
          reactionDamageLogId: null,
          damageEventId: null,
          tickIndex: null,
          auraBefore: [],
          auraConsumed: [],
          auraAfter: [],
          nextTickFrame: null,
          coexistenceExpiresAtFrame: null,
          waneFrame: null,
          reason: "FORGED"
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const wane = mutation.periodicReactionLog.find(
          (entry) =>
            entry.operation === "wane" ||
            entry.operation === "wane-skipped" ||
            (entry.operation === "stop" &&
              entry.waneFrame !== null)
        );
        if (wane === undefined) {
          throw new Error(
            "Electro-Charged result must expose a Wane callback."
          );
        }
        mutation.periodicReactionLog.push({
          ...structuredClone(wane),
          id: mutation.periodicReactionLog.length
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const wane = mutation.periodicReactionLog.find(
          (entry) =>
            entry.operation === "wane" ||
            entry.operation === "wane-skipped" ||
            (entry.operation === "stop" &&
              entry.waneFrame !== null)
        );
        if (wane === undefined) {
          throw new Error(
            "Electro-Charged result must expose a Wane callback."
          );
        }
        wane.frame += 1;
        wane.timeSeconds = wane.frame / 60;
        wane.waneFrame = wane.frame;
      }
    );

    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const wane = mutation.periodicReactionLog.find(
          (entry) => entry.operation === "wane"
        );
        if (wane === undefined) {
          throw new Error(
            "Electro-Charged result must expose a Wane mutation."
          );
        }
        wane.operation = "stop";
        wane.waneFrame = null;
        wane.damageEventId = null;
        wane.tickIndex = null;
      }
    );
  });

  it("rejects transformative-reaction scaling ownership transferred away from its source", () => {
    expectRejectedByPublicAndTrusted(
      electroChargedResult,
      (mutation) => {
        const child = mutation.damageEvents.find(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        );
        const alias = mutation.hitEvents.find(
          (event) => event.id === child?.id
        );
        if (child === undefined || alias === undefined) {
          throw new Error(
            "Electro-Charged result must expose a compatibility-linked damage child."
          );
        }
        child.scalingOwnerId = "spectator";
        child.scalingOwnerName = "spectator";
        alias.scalingOwnerId = "spectator";
        alias.scalingOwnerName = "spectator";
      }
    );
  });

  it("rejects Burning tick parent, child, and source drift at both result boundaries", () => {
    const tick = playerDamageResult.burningStateLog.find(
      (entry) => entry.operation === "tick"
    );
    expect(tick).toBeDefined();
    expect(tick?.reactionDamageLogId).not.toBeNull();
    expect(tick?.damageEventIds.length).toBeGreaterThan(0);

    expectRejectedByPublicAndTrusted(
      playerDamageResult,
      (mutation) => {
        const forgedTick = mutation.burningStateLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick?.reactionDamageLogId === null ||
            forgedTick === undefined) {
          throw new Error(
            "Burning result must expose a linked tick."
          );
        }
        mutation.reactionDamageLog[
          forgedTick.reactionDamageLogId
        ]!.damageFrame += 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      playerDamageResult,
      (mutation) => {
        const forgedTick = mutation.burningStateLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick === undefined) {
          throw new Error(
            "Burning result must expose a tick."
          );
        }
        forgedTick.damageEventIds = [];
      }
    );

    expectRejectedByPublicAndTrusted(
      playerDamageResult,
      (mutation) => {
        const forgedTick = mutation.burningStateLog.find(
          (entry) => entry.operation === "tick"
        );
        if (forgedTick === undefined) {
          throw new Error(
            "Burning result must expose a tick."
          );
        }
        forgedTick.damageSourceActorId = "forged-source";
      }
    );

    expectRejectedByPublicAndTrusted(
      playerDamageResult,
      (mutation) => {
        const forgedTick = mutation.burningStateLog.find(
          (entry) => entry.operation === "tick"
        );
        if (
          forgedTick === undefined ||
          forgedTick.damageAllowed === null
        ) {
          throw new Error(
            "Burning result must expose a resolved source-target damage policy."
          );
        }
        forgedTick.damageAllowed = !forgedTick.damageAllowed;
      }
    );
  });

  it("rejects Frozen expiry generation, clock, and Aura drift at both result boundaries", () => {
    const expiry = frozenExpiryResult.frozenStateLog.find(
      (entry) => entry.operation === "expire"
    );
    expect(expiry).toBeDefined();

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const forgedExpiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        if (forgedExpiry === undefined) {
          throw new Error(
            "Frozen result must expose a natural expiry."
          );
        }
        forgedExpiry.generation += 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const forgedExpiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        if (forgedExpiry === undefined) {
          throw new Error(
            "Frozen result must expose a natural expiry."
          );
        }
        forgedExpiry.frame += 1;
        forgedExpiry.timeSeconds = forgedExpiry.frame / 60;
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const forgedExpiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        if (
          forgedExpiry === undefined ||
          forgedExpiry.auraBefore.length === 0
        ) {
          throw new Error(
            "Frozen result must expose expiry Aura provenance."
          );
        }
        forgedExpiry.auraBefore[0]!.gaugeUnits += 0.1;
      }
    );
  });

  it("rejects erased Freeze audits and missing natural-expiry closure at both result boundaries", () => {
    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const expiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        if (expiry === undefined) {
          throw new Error(
            "Frozen result must expose a natural expiry."
          );
        }
        mutation.frozenStateLog = mutation.frozenStateLog
          .filter((entry) => entry.id !== expiry.id)
          .map((entry, id) => ({ ...entry, id }));
        mutation.targetStateTimeline.points =
          mutation.targetStateTimeline.points
            .filter(
              (point) =>
                !point.links.some(
                  (link) =>
                    link.kind === "frozen-state-log" &&
                    link.id === expiry.id
                )
            )
            .map((point, id) => ({ ...point, id }));
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        for (const event of mutation.damageEvents) {
          event.reactionAudit.frozenReaction = null;
        }
        for (const event of mutation.hitEvents) {
          event.reactionAudit.frozenReaction = null;
        }
        mutation.frozenStateLog = [];
        mutation.targetStateTimeline.points =
          mutation.targetStateTimeline.points
            .filter(
              (point) =>
                !point.links.some(
                  (link) => link.kind === "frozen-state-log"
                )
            )
            .map((point, id) => ({ ...point, id }));
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        for (const event of [
          ...mutation.damageEvents,
          ...mutation.hitEvents
        ]) {
          event.reaction = "none";
          event.reactionAudit.triggered = false;
          event.reactionAudit.reaction = "none";
          event.reactionAudit.reactions = [];
          event.reactionAudit.frozenReaction = null;
        }
        mutation.reactedHits = 0;
        for (const point of mutation.auraTimeline) {
          point.reaction = "none";
          point.reactions = [];
        }
        for (const point of mutation.targetStateTimeline.points) {
          if (point.primaryDamageEventId === 0) {
            point.reaction = "none";
            point.reactions = [];
            point.links = point.links.filter(
              (link) => link.kind !== "frozen-state-log"
            );
          }
          if (point.cause === "frozen-expiry") {
            point.pointKind = "derived";
            point.cause = "aura-natural-expiry";
            point.eventType = null;
            point.eventPriority = null;
            point.eventSequence = null;
            point.intraEventSequence = null;
            point.links = [];
          }
        }
        mutation.frozenStateLog = [];
      }
    );
  });

  it("rejects forged or half-null Frozen expiry provenance", () => {
    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const expiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        const unrelated = mutation.damageEvents.find(
          (event) => event.reaction === "none"
        );
        if (expiry === undefined || unrelated === undefined) {
          throw new Error(
            "Frozen result must expose expiry and unrelated event provenance."
          );
        }
        expiry.triggerDamageEventId = unrelated.id;
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const expiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        if (expiry === undefined) {
          throw new Error(
            "Frozen result must expose a natural expiry."
          );
        }
        expiry.sourceActorId = "ghost";
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const expiry = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        if (expiry === undefined) {
          throw new Error(
            "Frozen result must expose a natural expiry."
          );
        }
        expiry.sourceActorId = null;
      }
    );
  });

  it("binds normalized initial Aura to the resolved input target", () => {
    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const initial = mutation.auraInitialStates[0]?.aura.find(
          (entry) => entry.element === "cryo"
        );
        const boundary =
          mutation.targetStateTimeline.points.find(
            (point) =>
              point.targetId === "enemy-0" &&
              point.cause === "simulation-start"
          );
        const boundaryBefore = boundary?.auraBefore.find(
          (entry) => entry.element === "cryo"
        );
        const boundaryAfter = boundary?.auraAfter.find(
          (entry) => entry.element === "cryo"
        );
        if (
          initial === undefined ||
          boundaryBefore === undefined ||
          boundaryAfter === undefined
        ) {
          throw new Error(
            "Frozen result must expose normalized initial Cryo Aura."
          );
        }
        initial.gaugeUnits = 0.4;
        boundaryBefore.gaugeUnits = 0.4;
        boundaryAfter.gaugeUnits = 0.4;
      }
    );
  });

  it("rejects six independently forged Freeze state projections at both result boundaries", () => {
    const mutateFreezeStart = (
      mutation: SimulationResult,
      mutate: (
        audit: NonNullable<
          SimulationResult["damageEvents"][number]["reactionAudit"]["frozenReaction"]
        >,
        row: SimulationResult["frozenStateLog"][number]
      ) => void
    ): void => {
      const event = mutation.damageEvents.find(
        (candidate) =>
          candidate.reactionAudit.frozenReaction?.operation ===
          "start"
      );
      const audit = event?.reactionAudit.frozenReaction;
      const row = mutation.frozenStateLog.find(
        (candidate) =>
          candidate.operation === "start" &&
          candidate.triggerDamageEventId === event?.id
      );
      if (audit === null || audit === undefined || row === undefined) {
        throw new Error(
          "Frozen result must expose a start audit and lifecycle row."
        );
      }
      mutate(audit, row);
    };

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        mutateFreezeStart(mutation, (audit) => {
          audit.frozenGaugeAfter += 0.1;
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        mutateFreezeStart(mutation, (audit, row) => {
          audit.generatedGaugeUnits += 0.1;
          row.generatedGaugeUnits =
            audit.generatedGaugeUnits;
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        mutateFreezeStart(mutation, (audit, row) => {
          audit.operation = "refresh";
          row.operation = "refresh";
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        mutateFreezeStart(mutation, (audit, row) => {
          audit.freezeResistance = 0.25;
          row.freezeResistance = 0.25;
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        mutateFreezeStart(mutation, (audit) => {
          audit.decayRatePerFrame += 0.001;
        });
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        mutateFreezeStart(mutation, (audit, row) => {
          if (audit.expiresAtFrame === null) {
            throw new Error(
              "Active Frozen start must expose an expiry."
            );
          }
          audit.expiresAtFrame += 1;
          row.expiresAtFrame = audit.expiresAtFrame;
        });
      }
    );
  });

  it("rejects a coordinated forged Freeze generation and natural-decay history", () => {
    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const startEvent = mutation.damageEvents.find(
          (event) =>
            event.reactionAudit.frozenReaction?.operation ===
            "start"
        );
        const startAudit =
          startEvent?.reactionAudit.frozenReaction;
        const compatibilityEvent = mutation.hitEvents.find(
          (event) => event.id === startEvent?.id
        );
        const startRow = mutation.frozenStateLog.find(
          (entry) => entry.operation === "start"
        );
        const expiryRow = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        const auraPoint = mutation.auraTimeline.find(
          (point) =>
            point.damageEventId === startEvent?.id
        );
        const applicationPoint =
          mutation.targetStateTimeline.points.find(
            (point) =>
              point.primaryDamageEventId === startEvent?.id &&
              point.cause === "direct-hit-application"
          );
        const expiryPoint =
          mutation.targetStateTimeline.points.find((point) =>
            point.links.some(
              (link) =>
                link.kind === "frozen-state-log" &&
                link.id === expiryRow?.id
            )
          );
        if (
          startEvent === undefined ||
          startAudit === null ||
          startAudit === undefined ||
          compatibilityEvent === undefined ||
          startRow === undefined ||
          expiryRow === undefined ||
          auraPoint === undefined ||
          applicationPoint === undefined ||
          expiryPoint === undefined
        ) {
          throw new Error(
            "Frozen result must expose its complete generation and expiry projection."
          );
        }
        const rewriteFrozen = (
          aura: Array<{
            element: string;
            gaugeUnits: number;
            expiresAtFrame: number | null;
            expiresAtTargetFrame?: number | null;
          }>,
          gaugeUnits: number,
          expiresAtFrame: number
        ): void => {
          const frozen = aura.find(
            (entry) => entry.element === "frozen"
          );
          if (frozen === undefined) {
            throw new Error(
              "Expected a Frozen Aura entry."
            );
          }
          frozen.gaugeUnits = gaugeUnits;
          frozen.expiresAtFrame = expiresAtFrame;
          if (frozen.expiresAtTargetFrame !== undefined) {
            frozen.expiresAtTargetFrame = expiresAtFrame;
          }
        };

        for (const event of [
          startEvent,
          compatibilityEvent
        ]) {
          const frozen = event.reactionAudit.frozenReaction;
          if (frozen === null) {
            throw new Error(
              "Expected a Frozen reaction audit."
            );
          }
          frozen.generatedGaugeUnits = 1.5;
          frozen.frozenGaugeAfter = 1.5;
          frozen.expiresAtFrame = 167;
          rewriteFrozen(
            event.reactionAudit.auraAfter ?? [],
            1.5,
            167
          );
        }
        startRow.generatedGaugeUnits = 1.5;
        startRow.expiresAtFrame = 167;
        rewriteFrozen(startRow.auraAfter, 1.5, 167);
        rewriteFrozen(auraPoint.auraAfter, 1.5, 167);
        rewriteFrozen(
          applicationPoint.auraAfter,
          1.5,
          167
        );

        expiryRow.frame = 167;
        expiryRow.timeSeconds = 167 / 60;
        if (expiryRow.targetFrame !== undefined) {
          expiryRow.targetFrame = 167;
        }
        rewriteFrozen(
          expiryRow.auraBefore,
          0.25,
          167
        );
        expiryPoint.frame = 167;
        expiryPoint.timeSeconds = 167 / 60;
        if (expiryPoint.targetFrame !== undefined) {
          expiryPoint.targetFrame = 167;
        }
        rewriteFrozen(
          expiryPoint.auraBefore,
          0.25,
          167
        );
      }
    );

    expectRejectedByPublicAndTrusted(
      frozenExpiryResult,
      (mutation) => {
        const expiryRow = mutation.frozenStateLog.find(
          (entry) => entry.operation === "expire"
        );
        const expiryPoint =
          mutation.targetStateTimeline.points.find((point) =>
            point.links.some(
              (link) =>
                link.kind === "frozen-state-log" &&
                link.id === expiryRow?.id
            )
          );
        const rowFrozen = expiryRow?.auraBefore.find(
          (entry) => entry.element === "frozen"
        );
        const pointFrozen = expiryPoint?.auraBefore.find(
          (entry) => entry.element === "frozen"
        );
        if (
          rowFrozen === undefined ||
          pointFrozen === undefined
        ) {
          throw new Error(
            "Frozen result must expose reciprocal pre-expiry Aura snapshots."
          );
        }
        rowFrozen.gaugeUnits = 0.25;
        pointFrozen.gaugeUnits = 0.25;
      }
    );
  });

  it("keeps natural Frozen expiry source and trigger provenance nullable", () => {
    const nullableExpiry = cloneResult(frozenExpiryResult);
    const expiry = nullableExpiry.frozenStateLog.find(
      (entry) => entry.operation === "expire"
    );
    if (expiry === undefined) {
      throw new Error(
        "Frozen result must expose a natural expiry."
      );
    }
    expiry.sourceActorId = null;
    expiry.triggerDamageEventId = null;
    expectAccepted(nullableExpiry);
    expect(
      assertTrustedSimulationResultV144(nullableExpiry)
    ).toBe(nullableExpiry);
  });

  it("accepts same-frame Superconduct refreshes but rejects orphan zero-length and overlapping statuses", () => {
    const sharedStatuses =
      sameFrameSuperconductResult.reactionStatusLog.filter(
        (entry) => entry.targetId === "enemy-0"
      );
    expect(sharedStatuses).toHaveLength(2);
    expect(sharedStatuses).toMatchObject([
      {
        startFrame: 1,
        endFrame: 1,
        operation: "apply",
        supersededAtFrame: 1
      },
      {
        startFrame: 1,
        endFrame: 721,
        operation: "refresh",
        supersededAtFrame: null
      }
    ]);
    expectAccepted(sameFrameSuperconductResult);
    expect(
      assertTrustedSimulationResultV144(
        sameFrameSuperconductResult
      )
    ).toBe(sameFrameSuperconductResult);

    expectRejectedByPublicAndTrusted(
      sameFrameSuperconductResult,
      (mutation) => {
        const statuses = mutation.reactionStatusLog.filter(
          (entry) => entry.targetId === "enemy-0"
        );
        const terminalStatus = statuses[1];
        if (terminalStatus === undefined) {
          throw new Error(
            "Same-frame Superconduct result must expose a terminal refresh."
          );
        }
        terminalStatus.endFrame = terminalStatus.startFrame;
        terminalStatus.endTimeSeconds =
          terminalStatus.startTimeSeconds;
        terminalStatus.supersededAtFrame =
          terminalStatus.startFrame;
      }
    );

    expectRejectedByPublicAndTrusted(
      sameFrameSuperconductResult,
      (mutation) => {
        const statuses = mutation.reactionStatusLog.filter(
          (entry) => entry.targetId === "enemy-0"
        );
        const supersededStatus = statuses[0];
        if (supersededStatus === undefined) {
          throw new Error(
            "Same-frame Superconduct result must expose a superseded status."
          );
        }
        supersededStatus.endFrame =
          supersededStatus.startFrame + 1;
        supersededStatus.endTimeSeconds =
          supersededStatus.endFrame / 60;
        supersededStatus.supersededAtFrame =
          supersededStatus.endFrame;
      }
    );
  });

  it("rejects hit-resolution provenance and amount drift", () => {
    expectRejected(defaultResult, (mutation) => {
      const event = mutation.damageEvents[0]!;
      mutation.hitResolutionLog[
        event.targetResolutionId
      ]!.potentialDamage += 1;
    });
    expectRejected(defaultResult, (mutation) => {
      const event = mutation.damageEvents[0]!;
      mutation.hitResolutionLog[
        event.targetResolutionId
      ]!.actionName = "forged action";
    });
  });

  it("rejects coupled energy-summary and terminal-curve drift", () => {
    expectRejected(defaultResult, (mutation) => {
      const characterId = mutation.config.characters[0]!.id;
      mutation.energyStats[characterId]!.final += 1;
      mutation.energyCurve[
        mutation.energyCurve.length - 1
      ]!.energyByCharacter[characterId]! += 1;
    });
  });

  it("rejects legal-timeline execution identity and command-order drift", () => {
    expectRejected(auraV9Result, (mutation) => {
      mutation.timelineExecution!.fps = 30 as 60;
    });
    expectRejected(auraV9Result, (mutation) => {
      mutation.timelineExecution!.commandResults[0]!.commandIndex =
        1_000_000;
    });
    expectRejected(auraV9Result, (mutation) => {
      mutation.timelineExecution!.commandResults = [];
    });
    expectRejected(auraV9Result, (mutation) => {
      const command =
        mutation.timelineExecution!.commandResults[0]!;
      command.commandType =
        command.commandType === "skill" ? "burst" : "skill";
    });
  });

  it("accepts a real legal timeline with replayable execution and state transitions", () => {
    expect(auraV9Result.timelineExecution?.stateLog).toHaveLength(2);
    expectAccepted(auraV9Result);
    expect(
      assertTrustedSimulationResultV144(auraV9Result)
    ).toBe(auraV9Result);
  });

  it("rejects legal-timeline frame, outcome, state, and source projection drift at both boundaries", () => {
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      mutation.timelineExecution!.totalFrames += 1;
    });
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      mutation.timelineExecution!.commandResults[0]!.requestedFrame +=
        1;
    });
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      mutation.timelineExecution!.commandResults[0]!.status =
        "rejected";
    });
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      mutation.timelineExecution!.stateLog = [];
    });
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      mutation.actionLog.find(
        (entry) => entry.timelineCommandIndex === 0
      )!.frame += 1;
    });
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      mutation.damageEvents[0]!.actionStartFrame! += 1;
      mutation.hitEvents = mutation.damageEvents;
    });
    expectRejectedByPublicAndTrusted(auraV9Result, (mutation) => {
      const command =
        mutation.timelineExecution!.commandResults[0]!;
      mutation.skippedActions.push({
        time: command.startFrame! / 60,
        frame: command.startFrame!,
        actorId: command.actorId!,
        actionId: `${command.abilityId}#0`,
        action: "forged skip",
        reason: "forged energy failure",
        reasonCode: "INSUFFICIENT_ENERGY",
        energyBefore: 0,
        energyCost: 60,
        cycle: 0,
        timelineCommandIndex: 0,
        sourceAbilityId: command.abilityId!
      });
    });
  });
});
