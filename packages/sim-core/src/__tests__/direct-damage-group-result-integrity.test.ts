import {
  REACTION_FORMULA_RUN_MANIFEST_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createVersionedContentHash,
  simulationResultSchema,
  simulationResultV145Schema,
  type AbilityDefinition,
  type SimulationResult,
  type VersionedSimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { defineDamageModifierPlugin } from "../plugins";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function resultVector(): SimulationResult {
  return simulate(
    makeConfig({
      dataVersion: "direct-damage-group-result-proof",
      randomSeed: "direct-damage-group-result-proof",
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "proof-action",
          actorId: "a",
          name: "Direct damage group proof",
          at: 0,
          once: true,
          hits: [
            {
              id: "pole-open",
              offset: 0,
              scaling: 1,
              element: "physical",
              groupMultiplier: 2,
              directDamageGroup: {
                icdTag: "pole-proof",
                icdGroup: "pole-extra-attack"
              }
            },
            {
              id: "pole-zero",
              offset: 1 / 60,
              scaling: 1,
              element: "physical",
              groupMultiplier: 2,
              directDamageGroup: {
                icdTag: "pole-proof",
                icdGroup: "pole-extra-attack"
              }
            },
            {
              id: "pole-reset",
              offset: 29 / 60,
              scaling: 1,
              element: "physical",
              groupMultiplier: 2,
              directDamageGroup: {
                icdTag: "pole-proof",
                icdGroup: "pole-extra-attack"
              }
            },
            {
              id: "bypass",
              offset: 30 / 60,
              scaling: 1,
              element: "physical",
              groupMultiplier: 0.5
            },
            {
              id: "switch-open",
              offset: 40 / 60,
              scaling: 1,
              element: "physical",
              directDamageGroup: {
                icdTag: "switch-proof",
                icdGroup: "default"
              }
            },
            {
              id: "switch-zero",
              offset: 41 / 60,
              scaling: 1,
              element: "physical",
              directDamageGroup: {
                icdTag: "switch-proof",
                icdGroup: "xiao-dash"
              }
            }
          ]
        }
      ]
    }),
    { critMode: "noCrit" }
  );
}

function cloneResult(result: SimulationResult): SimulationResult {
  const cloned = structuredClone(result);
  cloned.hitEvents = cloned.damageEvents;
  return cloned;
}

function expectRejectedByPublicAndTrusted(
  result: SimulationResult,
  mutate: (forged: SimulationResult) => void
): void {
  const publicWire = cloneResult(result);
  mutate(publicWire);
  expect(simulationResultSchema.safeParse(publicWire).success).toBe(
    false
  );

  const trusted = cloneResult(result);
  mutate(trusted);
  expect(() => assertTrustedSimulationResult(trusted)).toThrow(
    /Trusted SimulationResult 1\.46 integrity validation failed/
  );
}

function expectRejectedByTrustedOnly(
  result: SimulationResult,
  mutate: (forged: SimulationResult) => void
): void {
  const trusted = cloneResult(result);
  mutate(trusted);
  expect(() => assertTrustedSimulationResult(trusted)).toThrow(
    /Trusted SimulationResult 1\.46 integrity validation failed/
  );
}

function projectCurrentBypassResultToV145(
  result: SimulationResult
): Record<string, unknown> {
  const projected = cloneResult(result) as unknown as Record<
    string,
    unknown
  >;
  delete projected.directDamageGroupLog;
  projected.schemaVersion = REACTION_FORMULA_ROOT_SCHEMA_VERSION;
  projected.engineVersion = REACTION_FORMULA_ROOT_ENGINE_VERSION;

  const config = projected.config as Record<string, unknown>;
  config.schemaVersion = REACTION_FORMULA_ROOT_SCHEMA_VERSION;
  config.engineVersion = REACTION_FORMULA_ROOT_ENGINE_VERSION;
  delete config.directDamageGroupModel;

  const manifest = projected.runManifest as Record<string, unknown>;
  manifest.version = REACTION_FORMULA_RUN_MANIFEST_VERSION;
  manifest.schemaVersion = REACTION_FORMULA_ROOT_SCHEMA_VERSION;
  manifest.engineVersion = REACTION_FORMULA_ROOT_ENGINE_VERSION;
  delete manifest.directDamageGroupRoot;
  manifest.configHash = createSimulationConfigHash(
    config as unknown as VersionedSimConfig
  );
  const {
    reproducibilityKey: _ignoredReproducibilityKey,
    ...identity
  } = manifest;
  const key = createSimulationReproducibilityKey(
    identity as unknown as Parameters<
      typeof createSimulationReproducibilityKey
    >[0]
  );
  manifest.reproducibilityKey = key;
  projected.reproducibilityKey = key;
  return projected;
}

describe("direct-damage-group result wire and trusted replay", () => {
  it("accepts the exact V146 log, including bypass, reset, and group switch rows", () => {
    const result = resultVector();

    expect(simulationResultSchema.safeParse(result).success).toBe(true);
    expect(() => assertTrustedSimulationResult(result)).not.toThrow();
    expect(
      result.directDamageGroupLog.map(
        ({
          hitId,
          evaluation,
          windowStartGroup,
          hitIndex,
          sequenceMultiplier,
          effectiveMultiplier
        }) => ({
          hitId,
          evaluation,
          windowStartGroup,
          hitIndex,
          sequenceMultiplier,
          effectiveMultiplier
        })
      )
    ).toEqual([
      {
        hitId: "pole-open",
        evaluation: "evaluated",
        windowStartGroup: "pole-extra-attack",
        hitIndex: 0,
        sequenceMultiplier: 1,
        effectiveMultiplier: 2
      },
      {
        hitId: "pole-zero",
        evaluation: "evaluated",
        windowStartGroup: "pole-extra-attack",
        hitIndex: 1,
        sequenceMultiplier: 0,
        effectiveMultiplier: 0
      },
      {
        hitId: "pole-reset",
        evaluation: "evaluated",
        windowStartGroup: "pole-extra-attack",
        hitIndex: 0,
        sequenceMultiplier: 1,
        effectiveMultiplier: 2
      },
      {
        hitId: "bypass",
        evaluation: "bypassed",
        windowStartGroup: null,
        hitIndex: null,
        sequenceMultiplier: 1,
        effectiveMultiplier: 0.5
      },
      {
        hitId: "switch-open",
        evaluation: "evaluated",
        windowStartGroup: "default",
        hitIndex: 0,
        sequenceMultiplier: 1,
        effectiveMultiplier: 1
      },
      {
        hitId: "switch-zero",
        evaluation: "evaluated",
        windowStartGroup: "default",
        hitIndex: 1,
        sequenceMultiplier: 0,
        effectiveMultiplier: 0
      }
    ]);
  });

  it("resolves repeated and explicit/automatic hit ID collisions by the stable hitGroupId index", () => {
    const rotationActionId = "rotation:duplicate-proof";
    const rotationResult = simulate(
      makeConfig({
        dataVersion: "direct-group-duplicate-rotation",
        randomSeed: "direct-group-duplicate-rotation",
        duration: 1,
        cycleLength: 1,
        rotation: [
          {
            id: rotationActionId,
            actorId: "a",
            name: "Duplicate rotation IDs",
            at: 0,
            once: true,
            hits: [
              {
                id: "same-id",
                offset: 0,
                scaling: 1,
                element: "physical",
                groupMultiplier: 2,
                directDamageGroup: {
                  icdTag: "rotation-duplicate-0",
                  icdGroup: "default"
                }
              },
              {
                id: "same-id",
                offset: 1 / 60,
                scaling: 1,
                element: "physical",
                groupMultiplier: 3
              },
              {
                id: `${rotationActionId}:hit-3`,
                offset: 2 / 60,
                scaling: 1,
                element: "physical",
                groupMultiplier: 4,
                directDamageGroup: {
                  icdTag: "rotation-collision-2",
                  icdGroup: "default"
                }
              },
              {
                offset: 3 / 60,
                scaling: 1,
                element: "physical",
                groupMultiplier: 5
              }
            ]
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    const abilityId = "timeline:duplicate-proof";
    const compiledActionId = `${abilityId}#0`;
    const ability: AbilityDefinition = {
      id: abilityId,
      actorId: "a",
      name: "Duplicate timeline IDs",
      kind: "skill",
      cancelFrame: 4,
      animationEndFrame: 4,
      cooldownFrames: 0,
      hits: [
        {
          id: "same-id",
          frame: 0,
          scaling: 1,
          element: "physical",
          groupMultiplier: 6,
          directDamageGroup: {
            icdTag: "timeline-duplicate-0",
            icdGroup: "default"
          }
        },
        {
          id: "same-id",
          frame: 1,
          scaling: 1,
          element: "physical",
          groupMultiplier: 7
        },
        {
          id: `${compiledActionId}:hit-3`,
          frame: 2,
          scaling: 1,
          element: "physical",
          groupMultiplier: 8,
          directDamageGroup: {
            icdTag: "timeline-collision-2",
            icdGroup: "default"
          }
        },
        {
          frame: 3,
          scaling: 1,
          element: "physical",
          groupMultiplier: 9
        }
      ]
    };
    const timelineBase = makeConfig({
      dataVersion: "direct-group-duplicate-timeline",
      randomSeed: "direct-group-duplicate-timeline",
      duration: 1,
      cycleLength: 1,
      rotation: []
    });
    const timelineResult = simulate(
      {
        ...timelineBase,
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
              abilityId,
              atFrame: 0
            }
          ]
        }
      },
      { critMode: "noCrit" }
    );

    for (const [result, multipliers, expectedHitIds] of [
      [
        rotationResult,
        [2, 3, 4, 5],
        [
          "same-id",
          "same-id",
          `${rotationActionId}:hit-3`,
          `${rotationActionId}:hit-3`
        ]
      ],
      [
        timelineResult,
        [6, 7, 8, 9],
        [
          "same-id",
          "same-id",
          `${compiledActionId}:hit-3`,
          `${compiledActionId}:hit-3`
        ]
      ]
    ] as const) {
      expect(simulationResultSchema.safeParse(result).success).toBe(true);
      expect(() => assertTrustedSimulationResult(result)).not.toThrow();
      expect(
        result.directDamageGroupLog.map(
          (entry) => entry.configuredMultiplier
        )
      ).toEqual(multipliers);
      expect(result.damageEvents.map((event) => event.hitId)).toEqual(
        expectedHitIds
      );

      // The first two hits intentionally share their visible hit ID. Moving
      // the first event to hit index 1 must select the second configured hit
      // and therefore fail proof instead of silently resolving by hitId.
      expectRejectedByPublicAndTrusted(result, (forged) => {
        const event = forged.damageEvents[0]!;
        event.hitGroupId = `${event.actionId}:${event.cycle}:1:${event.frame}`;
        forged.hitResolutionLog[
          event.targetResolutionId
        ]!.hitGroupId = event.hitGroupId;
      });
    }
  });

  it.each([
    ["profile", (result: SimulationResult) => {
      (result.directDamageGroupLog[0] as unknown as Record<string, unknown>)
        .profileId = "forged-profile";
    }],
    ["tag", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.icdTag = "forged-tag";
    }],
    ["group", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.icdGroup = "default";
    }],
    ["window start group", (result: SimulationResult) => {
      result.directDamageGroupLog[5]!.windowStartGroup = "xiao-dash";
    }],
    ["window frame", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.windowStartFrame = 1;
    }],
    ["reset timer", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.resetFrames = 31;
    }],
    ["reset boundary", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.resetAtFrame = 30;
    }],
    ["hit index", (result: SimulationResult) => {
      result.directDamageGroupLog[1]!.hitIndex = 2;
    }],
    ["sequence index", (result: SimulationResult) => {
      result.directDamageGroupLog[1]!.sequenceIndex = 2;
    }],
    ["sequence multiplier", (result: SimulationResult) => {
      result.directDamageGroupLog[1]!.sequenceMultiplier = 1;
    }],
    ["configured multiplier", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.configuredMultiplier = 3;
    }],
    ["effective multiplier", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.effectiveMultiplier = 3;
    }],
    ["damage backlink", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.damageEventId = 1;
    }],
    ["resolution backlink", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.hitResolutionLogId = 1;
    }],
    ["source actor", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.sourceActorId = "forged";
    }],
    ["target", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.targetId = "forged";
    }],
    ["hit", (result: SimulationResult) => {
      result.directDamageGroupLog[0]!.hitId = "forged";
    }],
    ["generic OnEnemyHit gate", (result: SimulationResult) => {
      result.directDamageGroupLog[1]!.damageGroupOnEnemyHitAllowed = true;
    }]
  ])("rejects %s tampering through public and trusted boundaries", (_label, mutate) => {
    expectRejectedByPublicAndTrusted(resultVector(), mutate);
  });

  it("rejects log deletion, duplication, and stable-order tampering", () => {
    const result = resultVector();
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.directDamageGroupLog.pop();
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.directDamageGroupLog.push(
        structuredClone(forged.directDamageGroupLog[0]!)
      );
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      const first = forged.directDamageGroupLog[0]!;
      forged.directDamageGroupLog[0] =
        forged.directDamageGroupLog[1]!;
      forged.directDamageGroupLog[1] = first;
    });
  });

  it("binds the exact root and the plugin-free post multiplier", () => {
    const result = resultVector();
    expectRejectedByPublicAndTrusted(result, (forged) => {
      (
        forged.runManifest.directDamageGroupRoot as unknown as {
          contentHash: string;
        }
      ).contentHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      (
        forged.config.directDamageGroupModel as unknown as {
          profileId: string;
        }
      ).profileId = "forged-profile";
    });
    // A zero sequence slot leaves effective damage at zero, so this mutation
    // isolates the no-plugin post===pre proof from downstream damage math.
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.directDamageGroupLog[1]!.postPluginMultiplier = 99;
    });
  });

  it("rejects non-finite multiplier and damage-factor values at the trusted boundary", () => {
    const result = resultVector();
    const mutations: Array<
      (forged: SimulationResult, poison: number) => void
    > = [
      (forged, poison) => {
        forged.directDamageGroupLog[0]!.configuredMultiplier = poison;
      },
      (forged, poison) => {
        forged.directDamageGroupLog[0]!.prePluginMultiplier = poison;
      },
      (forged, poison) => {
        forged.directDamageGroupLog[0]!.postPluginMultiplier = poison;
      },
      (forged, poison) => {
        forged.directDamageGroupLog[0]!.effectiveMultiplier = poison;
      },
      (forged, poison) => {
        forged.damageEvents[0]!.damageFactors.groupMultiplier = poison;
      }
    ];

    for (const poison of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      for (const mutate of mutations) {
        expectRejectedByTrustedOnly(result, (forged) => {
          mutate(forged, poison);
        });
      }
    }
  });

  it("binds every plugin multiplier step, including fixed zero slots", () => {
    const noChangePlugin = defineDamageModifierPlugin(
      {
        id: "result-proof-group-no-change",
        version: "1",
        kind: "code",
        contentHash: createVersionedContentHash({ groupMultiplier: "unchanged" })
      },
      () => ({
        modifyDamage: () => undefined
      })
    );
    const overridePlugin = defineDamageModifierPlugin(
      {
        id: "result-proof-group-override",
        version: "1",
        kind: "code",
        contentHash: createVersionedContentHash({ groupMultiplier: 3 })
      },
      () => ({
        modifyDamage: () => ({ groupMultiplier: 3 })
      })
    );
    const result = simulate(
      makeConfig({
        duration: 1,
        cycleLength: 1,
        rotation: [
          {
            id: "plugin-proof",
            actorId: "a",
            name: "Plugin proof",
            at: 0,
            once: true,
            hits: [0, 1].map((frame) => ({
              id: `plugin-${frame}`,
              offset: frame / 60,
              scaling: 1,
              element: "physical" as const,
              groupMultiplier: 2,
              directDamageGroup: {
                icdTag: "plugin-proof",
                icdGroup: "pole-extra-attack" as const
              }
            }))
          }
        ]
      }),
      {
        critMode: "noCrit",
        plugins: [noChangePlugin, overridePlugin]
      }
    );

    expect(simulationResultSchema.safeParse(result).success).toBe(true);
    expect(
      result.directDamageGroupLog.map((entry) => ({
        post: entry.postPluginMultiplier,
        sequence: entry.sequenceMultiplier,
        effective: entry.effectiveMultiplier
      }))
    ).toEqual([
      { post: 3, sequence: 1, effective: 3 },
      { post: 3, sequence: 0, effective: 0 }
    ]);
    expect(result.directDamageGroupLog[1]!.pluginMultiplierTrace).toEqual([
      {
        pluginManifestIndex: 0,
        pluginId: "result-proof-group-no-change",
        inputMultiplier: 2,
        outcome: "no-change",
        outputMultiplier: 2
      },
      {
        pluginManifestIndex: 1,
        pluginId: "result-proof-group-override",
        inputMultiplier: 2,
        outcome: "override",
        outputMultiplier: 3
      }
    ]);
    expect(
      result.directDamageGroupLog[1]!.pluginTraceVerification
    ).toBe("structural-only-unverified-runtime-output-v1");
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.directDamageGroupLog[1]!.pluginTraceVerification =
        "forged-authoritative" as typeof forged.directDamageGroupLog[number]["pluginTraceVerification"];
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.directDamageGroupLog[1]!.sequenceMultiplier = 1;
    });
    // A single-field edit cannot break the structural chain even when the
    // fixed sequence keeps the downstream effective multiplier at zero.
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.directDamageGroupLog[1]!.postPluginMultiplier = 99;
    });
    for (const mutate of [
      (forged: SimulationResult) => {
        forged.directDamageGroupLog[1]!.pluginMultiplierTrace.pop();
      },
      (forged: SimulationResult) => {
        const trace = forged.directDamageGroupLog[1]!.pluginMultiplierTrace;
        trace.push(structuredClone(trace[0]!));
      },
      (forged: SimulationResult) => {
        const trace = forged.directDamageGroupLog[1]!.pluginMultiplierTrace;
        [trace[0], trace[1]] = [trace[1]!, trace[0]!];
      },
      (forged: SimulationResult) => {
        forged.directDamageGroupLog[1]!.pluginMultiplierTrace[0]!
          .pluginManifestIndex = 1;
      },
      (forged: SimulationResult) => {
        forged.directDamageGroupLog[1]!.pluginMultiplierTrace[0]!.pluginId =
          "forged-plugin";
      },
      (forged: SimulationResult) => {
        forged.directDamageGroupLog[1]!.pluginMultiplierTrace[0]!
          .inputMultiplier = 99;
      },
      (forged: SimulationResult) => {
        forged.directDamageGroupLog[1]!.pluginMultiplierTrace[0]!
          .outputMultiplier = 99;
      },
      (forged: SimulationResult) => {
        forged.directDamageGroupLog[1]!.pluginMultiplierTrace[0]!.outcome =
          "override";
      }
    ]) {
      expectRejectedByPublicAndTrusted(result, mutate);
    }
  });

  it("keeps actor/target/tag scopes collision-safe in replay", () => {
    const base = makeConfig();
    const actors = [
      { ...base.characters[0]!, id: "b", name: "B" },
      { ...base.characters[0]!, id: "a\u0000b", name: "A NUL B" }
    ];
    const result = simulate(
      makeConfig({
        dataVersion: "direct-group-scope-collision",
        randomSeed: "direct-group-scope-collision",
        duration: 1,
        cycleLength: 1,
        characters: actors,
        enemy: {
          level: 90,
          resistance: 0,
          defReduction: 0,
          targets: [
            { id: "enemy-0", name: "Compatibility target" },
            { id: "t\u0000a", name: "T NUL A" },
            { id: "t", name: "T" }
          ]
        },
        rotation: [
          {
            id: "scope-one",
            actorId: "b",
            name: "Scope one",
            at: 0,
            once: true,
            hits: [0, 1].map((frame) => ({
              id: `scope-one-${frame}`,
              offset: frame / 60,
              scaling: 1,
              element: "physical" as const,
              targeting: {
                targetId: "t\u0000a",
                outcome: "landed" as const
              },
              directDamageGroup: {
                icdTag: "c",
                icdGroup: "pole-extra-attack" as const
              }
            }))
          },
          {
            id: "scope-two",
            actorId: "a\u0000b",
            name: "Scope two",
            at: 0,
            once: true,
            hits: [0, 1].map((frame) => ({
              id: `scope-two-${frame}`,
              offset: frame / 60,
              scaling: 1,
              element: "physical" as const,
              targeting: {
                targetId: "t",
                outcome: "landed" as const
              },
              directDamageGroup: {
                icdTag: "c",
                icdGroup: "pole-extra-attack" as const
              }
            }))
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(simulationResultSchema.safeParse(result).success).toBe(true);
    const scopes = new Map<string, number[]>();
    for (const entry of result.directDamageGroupLog) {
      const key = JSON.stringify([
        entry.targetId,
        entry.sourceActorId,
        entry.icdTag
      ]);
      const indexes = scopes.get(key) ?? [];
      indexes.push(entry.hitIndex ?? -1);
      scopes.set(key, indexes);
    }
    expect([...scopes.values()]).toEqual([
      [0, 1],
      [0, 1]
    ]);

    expectRejectedByPublicAndTrusted(result, (forged) => {
      const secondScopeOpening = forged.directDamageGroupLog.find(
        (entry) => entry.hitId === "scope-two-0"
      )!;
      secondScopeOpening.hitIndex = 1;
      secondScopeOpening.sequenceIndex = 1;
      secondScopeOpening.sequenceMultiplier = 0;
      secondScopeOpening.effectiveMultiplier = 0;
    });
  });

  it("keeps V145 exact and rejects the future top-level log", () => {
    const currentBypass = simulate(
      makeConfig({
        duration: 1,
        cycleLength: 1,
        rotation: [
          {
            id: "v145-projection",
            actorId: "a",
            name: "V145 projection",
            at: 0,
            once: true,
            hits: [
              {
                id: "bypass-only",
                offset: 0,
                scaling: 1,
                element: "physical"
              }
            ]
          }
        ]
      }),
      { critMode: "noCrit" }
    );
    const projected = projectCurrentBypassResultToV145(currentBypass);
    expect(simulationResultV145Schema.safeParse(projected).success).toBe(
      true
    );
    projected.directDamageGroupLog = [];
    expect(simulationResultV145Schema.safeParse(projected).success).toBe(
      false
    );
  });
});
