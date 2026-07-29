import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  canonicalStringify,
  reactionDeliveryResultReferencesSchema,
  SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
  SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { afterAll, describe, expect, it, vi } from "vitest";
import shatterRecursiveDeliveryGoldenJson from "../../../test-vectors/fixtures/shatter-recursive-delivery-1.39.golden.json";
import { AuraEngine } from "../aura";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type DeliveryMode = SimConfig["reactionDeliveryModel"]["mode"];

type ShatterGoldenScenarioId =
  | "directPhysical"
  | "directGeo"
  | "nestedOverload"
  | "gcdBlocked"
  | "poiseDepleted";

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function projectShatterResult(result: SimulationResult) {
  reactionDeliveryResultReferencesSchema.parse(result);
  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      resolvedRuntimeOptions: result.resolvedRuntimeOptions,
      reactionDeliveryModel:
        result.config.reactionDeliveryModel,
      reactionEngine: result.config.reactionEngine,
      targetTaskModel: result.config.targetTaskModel,
      timeline: {
        mode: result.config.timeline?.mode ?? null,
        fps: result.config.timeline?.fps ?? null,
      },
    },
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      byCharacter: result.byCharacter,
    },
    damage: result.damageEvents.map((entry) => [
      entry.id,
      entry.kind,
      entry.frame,
      entry.targetId,
      entry.sourceActorId,
      entry.hitId,
      entry.element,
      entry.reaction,
      entry.parentDamageEventId,
      entry.eventPriority,
      entry.eventSequence,
      entry.finalDamage,
      entry.displayDamage,
    ]),
    reactionDamage: result.reactionDamageLog.map((entry) => [
      entry.id,
      entry.reaction,
      entry.triggerDamageEventId,
      entry.sourceActorId,
      entry.sourceTargetId,
      entry.triggerFrame,
      entry.damageFrame,
      entry.scheduled,
      entry.withinSimulation,
      entry.blockedReason,
      entry.scheduleKind,
      entry.targetingMode,
      entry.checkedTargetIds,
      entry.hitTargetIds,
      entry.damageEventIds,
    ]),
    frozenState: result.frozenStateLog.map((entry) => [
      entry.id,
      entry.operation,
      entry.frame,
      entry.targetId,
      entry.generation,
      entry.reason,
      entry.triggerDamageEventId,
    ]),
    damageCurve: result.damageCurve.map((point) => [
      point.damageEventId,
      point.frame,
      point.targetId,
      point.finalDamage,
      point.cumulativeDamage,
      point.cumulativeByReaction,
    ]),
    digests: {
      config: sha256(result.config),
      damageEvents: sha256(result.damageEvents),
      reactionDamageLog: sha256(
        result.reactionDamageLog,
      ),
      damageCurve: sha256(result.damageCurve),
    },
  };
}

type ShatterGoldenScenario = ReturnType<
  typeof projectShatterResult
>;

interface ShatterGoldenFixture {
  fixtureVersion: "shatter-recursive-delivery-1.39";
  provenance: {
    mechanicsDataStatus: "fixed-gcsim-provisional";
    referenceProject: "genshinsim/gcsim";
    referenceCommit: string;
    officialServerTruth: false;
    completeGcsimParity: false;
    scope: string;
    limitations: string[];
  };
  projectionFormat: Record<string, string[]>;
  commonConfig: {
    schemaVersion: string;
    engineVersion: string;
    reactionEngine: { mode: "aura-v7" };
    reactionDeliveryModel: {
      mode: "shatter-recursive-zero-delay-v1";
    };
    timeline: { mode: "legal-frame-v1"; fps: 60 };
  };
  scenarios: Record<
    ShatterGoldenScenarioId,
    ShatterGoldenScenario
  >;
  hashes: Record<ShatterGoldenScenarioId, string>;
}

const shatterGolden =
  shatterRecursiveDeliveryGoldenJson as unknown as ShatterGoldenFixture;
const shatterGoldenScenarioIds: ShatterGoldenScenarioId[] =
  [
    "directPhysical",
    "directGeo",
    "nestedOverload",
    "gcdBlocked",
    "poiseDepleted",
  ];
const generatedShatterGoldenScenarios: Partial<
  Record<ShatterGoldenScenarioId, ShatterGoldenScenario>
> = {};

afterAll(() => {
  if (
    process.env
      .UPDATE_SHATTER_RECURSIVE_DELIVERY_GOLDEN !== "1"
  ) {
    return;
  }
  const generatedIds = Object.keys(
    generatedShatterGoldenScenarios,
  ).sort();
  if (
    canonicalStringify(generatedIds) !==
    canonicalStringify(
      [...shatterGoldenScenarioIds].sort(),
    )
  ) {
    throw new Error(
      `Refusing to write incomplete Shatter Golden: ${generatedIds.join(", ")}`,
    );
  }
  const scenarios =
    generatedShatterGoldenScenarios as Record<
      ShatterGoldenScenarioId,
      ShatterGoldenScenario
    >;
  const hashes = Object.fromEntries(
    shatterGoldenScenarioIds.map((scenarioId) => [
      scenarioId,
      sha256(scenarios[scenarioId]),
    ]),
  ) as Record<ShatterGoldenScenarioId, string>;
  const fixture: ShatterGoldenFixture = {
    ...shatterGolden,
    fixtureVersion: "shatter-recursive-delivery-1.39",
    commonConfig: {
      schemaVersion:
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion:
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      reactionEngine: { mode: "aura-v7" },
      reactionDeliveryModel: {
        mode: "shatter-recursive-zero-delay-v1",
      },
      timeline: { mode: "legal-frame-v1", fps: 60 },
    },
    scenarios,
    hashes,
  };
  writeFileSync(
    new URL(
      "../../../test-vectors/fixtures/shatter-recursive-delivery-1.39.golden.json",
      import.meta.url,
    ),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );
});

function expectShatterGolden(
  scenarioId: ShatterGoldenScenarioId,
  result: SimulationResult,
): void {
  expect(result.config.reactionDeliveryModel).toEqual({
    mode: "shatter-recursive-zero-delay-v1",
  });
  const shatterDeliveryRows =
    result.reactionDamageLog.filter(
      (entry) => entry.reaction === "shatter",
    );
  expect(
    shatterDeliveryRows.filter(
      (entry) =>
        entry.scheduled && !entry.withinSimulation,
    ),
  ).toEqual([]);
  expect(
    shatterDeliveryRows
      .filter(
        (entry) =>
          !entry.scheduled || !entry.withinSimulation,
      )
      .map((entry) => ({
        scheduled: entry.scheduled,
        withinSimulation: entry.withinSimulation,
        blockedReason: entry.blockedReason,
      })),
  ).toEqual(
    scenarioId === "gcdBlocked"
      ? [
          {
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_DAMAGE_GCD",
          },
        ]
      : [],
  );
  const scenario = projectShatterResult(result);
  if (
    process.env
      .UPDATE_SHATTER_RECURSIVE_DELIVERY_GOLDEN === "1"
  ) {
    generatedShatterGoldenScenarios[scenarioId] =
      scenario;
    return;
  }
  expect(shatterGolden).toMatchObject({
    fixtureVersion: "shatter-recursive-delivery-1.39",
    provenance: {
      mechanicsDataStatus: "fixed-gcsim-provisional",
      referenceProject: "genshinsim/gcsim",
      officialServerTruth: false,
      completeGcsimParity: false,
    },
    commonConfig: {
      schemaVersion:
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion:
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      reactionEngine: { mode: "aura-v7" },
      reactionDeliveryModel: {
        mode: "shatter-recursive-zero-delay-v1",
      },
      timeline: { mode: "legal-frame-v1", fps: 60 },
    },
  });
  expect(Object.keys(shatterGolden.scenarios).sort()).toEqual(
    [...shatterGoldenScenarioIds].sort(),
  );
  expect(Object.keys(shatterGolden.hashes).sort()).toEqual(
    [...shatterGoldenScenarioIds].sort(),
  );
  expect(scenario).toStrictEqual(
    shatterGolden.scenarios[scenarioId],
  );
  expect(sha256(scenario)).toBe(
    shatterGolden.hashes[scenarioId],
  );
  expect(
    sha256(shatterGolden.scenarios[scenarioId]),
  ).toBe(shatterGolden.hashes[scenarioId]);
}

function makeDirectShatterConfig(options?: {
  deliveryMode?: DeliveryMode;
  element?: "physical" | "geo";
  strikeType?: "default" | "blunt";
  poiseDamage?: number;
  repeatWithinGcd?: boolean;
}): SimConfig {
  const base = makeConfig({
    reactionDeliveryModel: {
      mode: options?.deliveryMode ?? "shatter-recursive-zero-delay-v1",
    },
  });
  const template = base.characters[0]!;
  const element = options?.element ?? "physical";
  const strikeType = options?.strikeType ?? "blunt";
  const crusherHit = {
    id: "crusher-hit",
    label: "碎冰触发命中",
    frame: 0,
    scaling: 1,
    element,
    strikeType,
    ...(options?.poiseDamage === undefined
      ? {}
      : { poiseDamage: options.poiseDamage }),
  } as const;
  return {
    ...base,
    duration: 2,
    cycleLength: 2,
    enemy: {
      level: 90,
      resistance: 0.25,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "冻结目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
      {
        ...template,
        id: "crusher",
        name: "Crusher",
        element,
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "hydro-freeze",
          actorId: "hydro",
          name: "Hydro Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-freeze-hit",
              frame: 0,
              scaling: 1,
              element: "hydro",
              application: {
                gaugeUnits: 1,
                icdTag: "freeze",
                icdGroup: "no-icd",
              },
            },
          ],
        },
        {
          id: "crusher-skill",
          actorId: "crusher",
          name: "Crusher Hit",
          kind: "skill",
          cancelFrame: options?.repeatWithinGcd ? 7 : 1,
          animationEndFrame: options?.repeatWithinGcd ? 7 : 1,
          cooldownFrames: 0,
          hits: options?.repeatWithinGcd
            ? [
                crusherHit,
                {
                  id: "refreeze-cryo",
                  frame: 3,
                  scaling: 1,
                  element: "cryo",
                  application: {
                    gaugeUnits: 1,
                    icdTag: "refreeze-cryo",
                    icdGroup: "no-icd",
                  },
                },
                {
                  id: "refreeze-hydro",
                  frame: 4,
                  scaling: 1,
                  element: "hydro",
                  application: {
                    gaugeUnits: 1,
                    icdTag: "refreeze-hydro",
                    icdGroup: "no-icd",
                  },
                },
                {
                  ...crusherHit,
                  id: "crusher-hit-gcd",
                  frame: 6,
                },
              ]
            : [crusherHit],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "hydro-freeze",
        },
        { type: "swap", characterId: "crusher" },
        {
          type: "skill",
          actorId: "crusher",
          abilityId: "crusher-skill",
        },
      ],
    },
  };
}

function makeNestedOverloadShatterConfig(
  deliveryMode: DeliveryMode,
): SimConfig {
  const base = makeConfig({
    reactionDeliveryModel: { mode: deliveryMode },
  });
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "超载触发目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "electro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-1",
          name: "邻近冻结目标",
          position: { x: 3, y: 0 },
          initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
      {
        ...template,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "freeze-neighbor",
          actorId: "hydro",
          name: "Freeze Neighbor",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "freeze-neighbor-hit",
              frame: 0,
              scaling: 1,
              element: "hydro",
              targeting: {
                targetId: "enemy-1",
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icdTag: "freeze-neighbor",
                icdGroup: "no-icd",
              },
            },
          ],
        },
        {
          id: "trigger-overload",
          actorId: "pyro",
          name: "Trigger Overload",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "trigger-overload-hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 0.1,
              },
              application: {
                gaugeUnits: 1,
                icdTag: "trigger-overload",
                icdGroup: "no-icd",
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "freeze-neighbor",
        },
        { type: "swap", characterId: "pyro" },
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "trigger-overload",
        },
      ],
    },
  };
}

describe("recursive zero-delay Shatter delivery", () => {
  it.each([
    {
      label: "blunt Physical",
      element: "physical" as const,
      strikeType: "blunt" as const,
    },
    {
      label: "Geo",
      element: "geo" as const,
      strikeType: "default" as const,
    },
  ])(
    "delivers the $label Shatter child before its direct parent",
    ({ element, strikeType }) => {
      const first = simulate(
        makeDirectShatterConfig({
          element,
          strikeType,
        }),
        { critMode: "noCrit" },
      );
      const second = simulate(
        makeDirectShatterConfig({
          element,
          strikeType,
        }),
        { critMode: "noCrit" },
      );
      const parent = first.damageEvents.find(
        (event) => event.kind === "direct" && event.sourceActorId === "crusher",
      );
      const child = first.damageEvents.find(
        (event) => event.reaction === "shatter",
      );
      const shatterLog = first.reactionDamageLog.find(
        (entry) => entry.reaction === "shatter",
      );
      const expected = calcTransformativeReactionDamage({
        characterLevel: 90,
        elementalMastery: 100,
        reactionBonus: 0.2,
        baseMultiplier: 3,
        effectiveResistance: 0.25,
      });

      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child!.id).toBeLessThan(parent!.id);
      expect(parent!.id).toBe(child!.id + 1);
      expect(child).toMatchObject({
        parentDamageEventId: parent!.id,
        frame: parent!.frame,
        eventPriority: parent!.eventPriority,
        eventSequence: parent!.eventSequence,
        targetId: parent!.targetId,
        element: "physical",
        reaction: "shatter",
        finalDamage: expected.finalDamage,
      });
      expect(shatterLog).toMatchObject({
        triggerDamageEventId: parent!.id,
        triggerFrame: parent!.frame,
        damageFrame: parent!.frame,
        checkedTargetIds: ["enemy-0"],
        hitTargetIds: ["enemy-0"],
        damageEventIds: [child!.id],
      });
      expect(first.damageCurve.map((point) => point.damageEventId)).toEqual(
        first.damageEvents.map((event) => event.id),
      );
      expect(second).toStrictEqual(first);
      expectShatterGolden(
        element === "physical"
          ? "directPhysical"
          : "directGeo",
        first,
      );
    },
  );

  it("preserves the nested Overload parent chain while delivering Shatter first", () => {
    const result = simulate(
      makeNestedOverloadShatterConfig("shatter-recursive-zero-delay-v1"),
      { critMode: "noCrit" },
    );
    const directTrigger = result.damageEvents.find(
      (event) => event.kind === "direct" && event.sourceActorId === "pyro",
    );
    const overloadParent = result.damageEvents.find(
      (event) => event.reaction === "overload" && event.targetId === "enemy-1",
    );
    const shatterChild = result.damageEvents.find(
      (event) => event.reaction === "shatter",
    );
    const shatterLog = result.reactionDamageLog.find(
      (entry) => entry.reaction === "shatter",
    );

    expect(directTrigger).toBeDefined();
    expect(overloadParent).toBeDefined();
    expect(shatterChild).toBeDefined();
    expect(shatterChild!.id).toBeLessThan(overloadParent!.id);
    expect(overloadParent!.id).toBe(shatterChild!.id + 1);
    expect(shatterChild).toMatchObject({
      parentDamageEventId: overloadParent!.id,
      frame: overloadParent!.frame,
      eventPriority: overloadParent!.eventPriority,
      eventSequence: overloadParent!.eventSequence,
      targetId: "enemy-1",
    });
    expect(overloadParent).toMatchObject({
      parentDamageEventId: directTrigger!.id,
    });
    expect(shatterLog).toMatchObject({
      triggerDamageEventId: overloadParent!.id,
      damageEventIds: [shatterChild!.id],
    });
    expect(result.reactionDamageLog.map((entry) => entry.reaction)).toEqual([
      "overload",
      "shatter",
    ]);
    expectShatterGolden("nestedOverload", result);
  });

  it("keeps the target-phase-v1 wake hit parent-first while damage settles child-first", () => {
    const config = makeNestedOverloadShatterConfig(
      "shatter-recursive-zero-delay-v1",
    );
    config.targetTaskModel = { mode: "target-phase-v1" };
    const result = simulate(config, {
      critMode: "noCrit",
    });
    const overloadParent = result.damageEvents.find(
      (event) =>
        event.reaction === "overload" && event.targetId === "enemy-1",
    )!;
    const shatterChild = result.damageEvents.find(
      (event) => event.reaction === "shatter",
    )!;
    const parentResolution =
      result.hitResolutionLog[overloadParent.targetResolutionId]!;
    const childResolution =
      result.hitResolutionLog[shatterChild.targetResolutionId]!;
    const phase = result.targetTaskPhaseLog.find(
      (entry) =>
        entry.targetId === "enemy-1" &&
        entry.globalFrame === overloadParent.frame &&
        entry.hitResolutionLogIds.includes(parentResolution.id),
    );

    expect(shatterChild.id).toBeLessThan(overloadParent.id);
    expect(parentResolution.id).toBeLessThan(childResolution.id);
    expect(phase?.hitResolutionLogIds).toEqual(
      expect.arrayContaining([parentResolution.id, childResolution.id]),
    );
    expect(
      phase?.hitResolutionLogIds.indexOf(parentResolution.id),
    ).toBeLessThan(
      phase?.hitResolutionLogIds.indexOf(childResolution.id) ?? -1,
    );
  });

  it("consumes refrozen durability inside the 12-frame GCD without creating a second child", () => {
    const result = simulate(
      makeDirectShatterConfig({
        repeatWithinGcd: true,
      }),
      { critMode: "noCrit" },
    );
    const shatterLogs = result.reactionDamageLog.filter(
      (entry) => entry.reaction === "shatter",
    );

    expect(shatterLogs).toMatchObject([
      {
        triggerFrame: 2,
        scheduled: true,
        blockedReason: null,
        damageEventIds: [expect.any(Number)],
      },
      {
        triggerFrame: 8,
        scheduled: false,
        blockedReason: "REACTION_DAMAGE_GCD",
        damageEventIds: [],
      },
    ]);
    expect(
      result.damageEvents.filter((event) => event.reaction === "shatter"),
    ).toHaveLength(1);
    expect(
      result.frozenStateLog
        .filter((entry) => entry.operation === "shatter-consume")
        .map((entry) => entry.frame),
    ).toEqual([2, 8]);
    expectShatterGolden("gcdBlocked", result);
  });

  it("does not recurse when blunt poise depletes Frozen first", () => {
    const result = simulate(makeDirectShatterConfig({ poiseDamage: 300 }), {
      critMode: "noCrit",
    });
    const parent = result.damageEvents.find(
      (event) => event.sourceActorId === "crusher",
    );

    expect(parent?.reactionAudit.shatterReaction).toMatchObject({
      triggered: false,
      scheduled: false,
      blockedReason: "FROZEN_DEPLETED_BY_POISE",
      frozenGaugeAfterPoise: 0,
    });
    expect(result.reactionDamageLog).toEqual([]);
    expect(
      result.damageEvents.some((event) => event.reaction === "shatter"),
    ).toBe(false);
    expectShatterGolden("poiseDepleted", result);
  });

  it("fails closed if a parent application newly crosses the mechanics-truncation boundary", () => {
    const originalProcessHit = AuraEngine.prototype.processHit;
    const processHitSpy = vi
      .spyOn(AuraEngine.prototype, "processHit")
      .mockImplementation(function (
        this: AuraEngine,
        input: Parameters<AuraEngine["processHit"]>[0],
      ) {
        const audit = originalProcessHit.call(this, input);
        if (input.sourceActorId !== "crusher") {
          return audit;
        }
        return {
          ...audit,
          unsupportedReactions: ["bloom"],
          mechanicsTruncation: {
            operation: "trigger",
            startedAtFrame: input.frame,
            unsupportedReactions: ["bloom"],
            discardedAura: [],
            reason: "UNSUPPORTED_DENDRO_REACTION",
          },
        };
      });

    try {
      expect(() =>
        simulate(makeDirectShatterConfig(), {
          critMode: "noCrit",
        }),
      ).toThrow(
        "Recursive Shatter cannot cross a newly triggered target-mechanics truncation boundary.",
      );
    } finally {
      processHitSpy.mockRestore();
    }
  });

  it("runs the delivery-reference validator before returning a recursive result", () => {
    const originalParse =
      reactionDeliveryResultReferencesSchema.parse.bind(
        reactionDeliveryResultReferencesSchema,
      );
    const parseSpy = vi
      .spyOn(reactionDeliveryResultReferencesSchema, "parse")
      .mockImplementation((input) => {
        const forged = structuredClone(input) as SimulationResult;
        const child = forged.damageEvents.find(
          (event) => event.reaction === "shatter",
        );
        if (child !== undefined) {
          child.parentDamageEventId = null;
        }
        return originalParse(forged);
      });

    try {
      expect(() =>
        simulate(makeDirectShatterConfig(), {
          critMode: "noCrit",
        }),
      ).toThrow();
      expect(parseSpy).toHaveBeenCalledOnce();
    } finally {
      parseSpy.mockRestore();
    }
  });

  it("keeps deferred compatibility totals while changing only recursive delivery order", () => {
    const deferred = simulate(
      makeNestedOverloadShatterConfig("deferred-event-heap-v1"),
      { critMode: "noCrit" },
    );
    const recursiveConfig = makeNestedOverloadShatterConfig(
      "shatter-recursive-zero-delay-v1",
    );
    const recursive = simulate(recursiveConfig, {
      critMode: "noCrit",
    });
    const recursiveRepeat = simulate(recursiveConfig, {
      critMode: "noCrit",
    });
    const deferredOverload = deferred.damageEvents.find(
      (event) => event.reaction === "overload" && event.targetId === "enemy-1",
    )!;
    const deferredShatter = deferred.damageEvents.find(
      (event) => event.reaction === "shatter",
    )!;
    const recursiveOverload = recursive.damageEvents.find(
      (event) => event.reaction === "overload" && event.targetId === "enemy-1",
    )!;
    const recursiveShatter = recursive.damageEvents.find(
      (event) => event.reaction === "shatter",
    )!;

    expect(deferredOverload.id).toBeLessThan(deferredShatter.id);
    expect(recursiveShatter.id).toBeLessThan(recursiveOverload.id);
    expect(recursive.totalDamage).toBeCloseTo(deferred.totalDamage, 12);
    expect(recursive.byCharacter).toEqual(deferred.byCharacter);
    expect(
      recursive.damageEvents
        .map((event) => ({
          sourceActorId: event.sourceActorId,
          targetId: event.targetId,
          kind: event.kind,
          reaction: event.reaction,
          finalDamage: event.finalDamage,
        }))
        .sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        ),
    ).toEqual(
      deferred.damageEvents
        .map((event) => ({
          sourceActorId: event.sourceActorId,
          targetId: event.targetId,
          kind: event.kind,
          reaction: event.reaction,
          finalDamage: event.finalDamage,
        }))
        .sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        ),
    );
    expect(recursiveRepeat).toStrictEqual(recursive);
  });
});
