import { describe, expect, it } from "vitest";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  createVersionedContentHash,
  migrateConfig,
  simConfigSchema,
  simConfigV144Schema,
  simulationResultSchema,
  simulationRunManifestSchema
} from "@genshin-dps-lab/schemas";
import {
  defineDamageModifierPlugin,
  type DamageModifierPlugin,
  type DamageModifierPluginRuntime
} from "../plugins";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function makeTestPlugin(
  id: string,
  version: string,
  contentIdentity: unknown,
  createRuntime: () => DamageModifierPluginRuntime = () => ({
    modifyDamage() {}
  })
): DamageModifierPlugin {
  return defineDamageModifierPlugin(
    {
      id,
      version,
      kind: "code",
      contentHash:
        createVersionedContentHash(contentIdentity)
    },
    createRuntime
  );
}

describe("deterministic event simulation", () => {
  it("applies a same-time buff before a hit", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "same-frame",
          actorId: "a",
          name: "同帧",
          at: 0,
          buffs: [
            {
              key: "bonus",
              target: "self",
              stat: "dmgBonus",
              value: 1,
              duration: 1,
              offset: 0
            }
          ],
          hits: [
            {
              id: "hit",
              offset: 0,
              scaling: 1,
              element: "pyro",
              snapshot: "hit"
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    expect(result.damageEvents[0]?.damageFactors.damageBonusMultiplier).toBe(2);
  });

  it("expires a buff exactly on its end boundary", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "boundary",
          actorId: "a",
          name: "边界",
          at: 0,
          buffs: [
            {
              key: "bonus",
              target: "self",
              stat: "dmgBonus",
              value: 1,
              duration: 1,
              offset: 0
            }
          ],
          hits: [
            {
              id: "hit",
              offset: 1,
              scaling: 1,
              element: "pyro",
              snapshot: "hit"
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    expect(result.damageEvents[0]?.damageFactors.damageBonusMultiplier).toBe(1);
    expect(result.damageEvents[0]?.activeStatuses).toEqual([]);
  });

  it("distinguishes action snapshots from hit-time stats", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "snapshot",
          actorId: "a",
          name: "快照",
          at: 0,
          buffs: [
            {
              key: "bonus",
              target: "self",
              stat: "dmgBonus",
              value: 1,
              duration: 2,
              offset: 0
            }
          ],
          hits: [
            {
              id: "snapshot-hit",
              label: "快照",
              offset: 1,
              scaling: 1,
              element: "pyro",
              snapshot: "action"
            },
            {
              id: "dynamic-hit",
              label: "动态",
              offset: 1,
              scaling: 1,
              element: "pyro",
              snapshot: "hit"
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    expect(
      result.damageEvents.find((event) => event.hitId === "snapshot-hit")
        ?.damageFactors.damageBonusMultiplier
    ).toBe(1);
    expect(
      result.damageEvents.find((event) => event.hitId === "dynamic-hit")
        ?.damageFactors.damageBonusMultiplier
    ).toBe(2);
  });

  it("accepts energy exactly equal to the action cost", () => {
    const base = makeConfig();
    const config = makeConfig({
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 60
        }
      ],
      rotation: [
        {
          id: "burst",
          actorId: "a",
          name: "爆发",
          at: 0,
          energyCost: 60,
          hits: [
            {
              offset: 0,
              scaling: 1,
              element: "pyro"
            }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.skippedActions).toHaveLength(0);
    expect(result.damageEvents).toHaveLength(1);
    expect(result.energyStats.a?.spent).toBe(60);
    expect(result.energyStats.a?.final).toBe(0);
  });

  it("cancels the whole action when energy is insufficient", () => {
    const base = makeConfig();
    const config = makeConfig({
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 59
        }
      ],
      rotation: [
        {
          id: "burst",
          actorId: "a",
          name: "爆发",
          at: 0,
          energyCost: 60,
          buffs: [
            {
              stat: "dmgBonus",
              value: 1,
              duration: 10
            }
          ],
          energyGains: [{ amount: 60 }],
          hits: [
            {
              offset: 0,
              scaling: 1,
              element: "pyro"
            }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.skippedActions).toHaveLength(1);
    expect(result.skippedActions[0]?.reasonCode).toBe(
      "INSUFFICIENT_ENERGY"
    );
    expect(result.damageEvents).toHaveLength(0);
    expect(result.energyStats.a?.gained).toBe(0);
  });

  it("preserves insertion order for equal-time equal-priority hits", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "ordered",
          actorId: "a",
          name: "排序",
          at: 0,
          hits: [
            { id: "first", offset: 1, scaling: 1, element: "pyro" },
            { id: "second", offset: 1, scaling: 1, element: "pyro" }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.damageEvents.map((event) => event.hitId)).toEqual([
      "first",
      "second"
    ]);
  });

  it("keeps raw damage while exposing an integer display and honest aura audit", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "audit",
          actorId: "a",
          name: "审计",
          at: 0,
          hits: [
            {
              id: "manual-melt",
              offset: 0,
              scaling: 1.2345,
              element: "pyro",
              reaction: "melt"
            }
          ]
        }
      ]
    });
    const event = simulate(config).damageEvents[0]!;
    expect(event.displayDamage).toBe(Math.round(event.finalDamage));
    expect(Number.isInteger(event.displayDamage)).toBe(true);
    expect(event.reactionAudit).toMatchObject({
      model: "manual-override",
      triggered: true,
      reaction: "melt",
      icdAllowed: null,
      auraBefore: null,
      auraAfter: null
    });
  });

  it("documents frozen 1.44 ampBase compatibility while current 1.46 fails closed", () => {
    const baseHit = {
      id: "legacy-explicit-base",
      offset: 0,
      scaling: 1,
      element: "pyro" as const,
      reaction: "none" as const
    };
    const currentWithLegacyOverride = makeConfig({
      rotation: [
        {
          id: "legacy-explicit",
          actorId: "a",
          name: "Legacy explicit base",
          at: 0,
          hits: [{ ...baseHit, ampBase: 2 }]
        }
      ]
    });
    const {
      reactionFormulaModel: _reactionFormulaModel,
      directDamageGroupModel: _directDamageGroupModel,
      ...legacyPayload
    } = structuredClone(currentWithLegacyOverride);
    const frozenV144WithAmpBase = {
      ...legacyPayload,
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    };

    // Exact 1.44 accepted ampBase as an explicit multiplier for legacy/manual
    // debug runs without inventing a reaction. Migration must not silently
    // carry that unrooted multiplier into the current fixed-formula contract.
    expect(
      simConfigV144Schema.parse(frozenV144WithAmpBase)
    ).toEqual(frozenV144WithAmpBase);
    expect(() => migrateConfig(frozenV144WithAmpBase)).toThrow(
      /ampBase is forbidden by the 1\.45 formula-root contract/
    );
    expect(() =>
      simConfigSchema.parse(currentWithLegacyOverride)
    ).toThrow(/ampBase is forbidden by the 1\.45 formula-root contract/);
    expect(() => simulate(currentWithLegacyOverride)).toThrow(
      /ampBase is forbidden by the 1\.45 formula-root contract/
    );
  });

  it("truncates hits after the configured duration", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "cutoff",
          actorId: "a",
          name: "截断",
          at: 0,
          hits: [
            { id: "inside", offset: 1, scaling: 1, element: "pyro" },
            { id: "outside", offset: 1.001, scaling: 1, element: "pyro" }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.damageEvents.map((event) => event.hitId)).toEqual(["inside"]);
  });

  it("is reproducible for the same config, versions, and seed", () => {
    const config = makeConfig();
    const first = simulate(config);
    const second = simulate(config);
    expect(second).toEqual(first);
    expect(first.reproducibilityKey).toMatch(
      /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
    );
    expect(first.runManifest).toEqual(
      simulationRunManifestSchema.parse(first.runManifest)
    );
    expect(first.resolvedRuntimeOptions).toBe(
      first.runManifest.resolvedRuntimeOptions
    );
    expect(first.pluginManifest).toBe(
      first.runManifest.plugins
    );
    expect(first.reproducibilityKey).toBe(
      first.runManifest.reproducibilityKey
    );
  });

  it("keys every resolved runtime option, including the effective seed", () => {
    const config = makeConfig();
    const base = simulate(config).reproducibilityKey;
    const variants = [
      simulate(config, { energyMode: "zero" }),
      simulate(config, { energyMode: "full" }),
      simulate(config, { critMode: "allCrit" }),
      simulate(config, { critMode: "noCrit" }),
      simulate(config, {
        compatibilityMode: "legal-frame-v1"
      }),
      simulate(config, { randomSeed: "other-seed" })
    ];

    expect(
      variants.map((result) => result.reproducibilityKey)
    ).not.toContain(base);
    expect(
      new Set(
        variants.map((result) => result.reproducibilityKey)
      ).size
    ).toBe(variants.length);
    expect(
      variants.at(-1)?.resolvedRuntimeOptions.randomSeed
    ).toBe("other-seed");
  });

  it("binds the key to migrated config content and data version", () => {
    const config = makeConfig();
    const base = simulate(config);
    const changedData = simulate({
      ...config,
      dataVersion: "test-vector-2"
    });
    const changedConfig = simulate({
      ...config,
      meta: {
        ...config.meta,
        name: "不同配置"
      }
    });
    const legalCompatibility = {
      compatibilityMode: "legal-frame-v1" as const
    };
    const legacyTargetTasks = simulate(
      config,
      legalCompatibility
    );
    const phasedTargetTasks = simulate(
      {
        ...config,
        targetTaskModel: { mode: "target-phase-v1" }
      },
      legalCompatibility
    );

    expect(changedData.reproducibilityKey).not.toBe(
      base.reproducibilityKey
    );
    expect(changedConfig.reproducibilityKey).not.toBe(
      base.reproducibilityKey
    );
    expect(
      phasedTargetTasks.runManifest.configHash
    ).not.toBe(legacyTargetTasks.runManifest.configHash);
    expect(phasedTargetTasks.reproducibilityKey).not.toBe(
      legacyTargetTasks.reproducibilityKey
    );
    expect(changedData.runManifest.dataVersion).toBe(
      "test-vector-2"
    );
  });

  it("keys plugin version, declared content, and execution order", () => {
    const config = makeConfig();
    const first = makeTestPlugin("first", "1.0.0", {
      behavior: 1
    });
    const firstVersion2 = makeTestPlugin(
      "first",
      "2.0.0",
      { behavior: 1 }
    );
    const firstContent2 = makeTestPlugin(
      "first",
      "1.0.0",
      { behavior: 2 }
    );
    const second = makeTestPlugin("second", "1.0.0", {
      behavior: 1
    });
    const base = simulate(config, {
      plugins: [first, second]
    });

    expect(
      simulate(config, {
        plugins: [firstVersion2, second]
      }).reproducibilityKey
    ).not.toBe(base.reproducibilityKey);
    expect(
      simulate(config, {
        plugins: [firstContent2, second]
      }).reproducibilityKey
    ).not.toBe(base.reproducibilityKey);
    expect(
      simulate(config, {
        plugins: [second, first]
      }).reproducibilityKey
    ).not.toBe(base.reproducibilityKey);
    expect(base.pluginManifest.map((entry) => entry.id)).toEqual([
      "first",
      "second"
    ]);
    expect(
      base.pluginManifest.map(({ order, index }) => ({
        order,
        index
      }))
    ).toEqual([
      { order: 0, index: 0 },
      { order: 1, index: 1 }
    ]);
  });

  it("preserves the code-plugin contract for explicit scaling overrides", () => {
    const plugin = makeTestPlugin(
      "scaling-override",
      "1.0.0",
      { behavior: "scaling-value-plus-one" },
      () => ({
        modifyDamage(context) {
          return {
            scalingValue:
              context.damageInput.scalingValue + 1
          };
        }
      })
    );
    const result = simulate(
      makeConfig({
        rotation: [
          {
            id: "plugin-scaling-hit",
            actorId: "a",
            name: "Plugin scaling hit",
            at: 0,
            hits: [
              {
                id: "hit",
                offset: 0,
                scaling: 1,
                element: "pyro"
              }
            ]
          }
        ]
      }),
      {
        plugins: [plugin],
        critMode: "noCrit"
      }
    );
    const event = result.damageEvents[0]!;
    const snapshotAtk =
      event.statsBeforeDamage.baseAtk *
        (1 + event.statsBeforeDamage.atkPct) +
      event.statsBeforeDamage.flatAtk;

    expect(event.damageFactors.scalingValue).toBe(
      snapshotAtk + 1
    );
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
  });

  it("creates fresh plugin runtime state for consecutive simulations", () => {
    let runtimeCount = 0;
    const plugin = makeTestPlugin(
      "stateful",
      "1.0.0",
      { behavior: "per-run-counter" },
      () => {
        runtimeCount += 1;
        let hitCount = 0;
        return {
          modifyDamage(context) {
            hitCount += 1;
            return {
              damageBonus:
                context.damageInput.damageBonus +
                hitCount / 100
            };
          }
        };
      }
    );
    const config = makeConfig({
      rotation: [
        {
          id: "stateful-hit",
          actorId: "a",
          name: "状态隔离",
          at: 0,
          hits: [
            {
              id: "hit",
              offset: 0,
              scaling: 1,
              element: "pyro"
            }
          ]
        }
      ]
    });

    const first = simulate(config, { plugins: [plugin] });
    const second = simulate(config, { plugins: [plugin] });

    expect(runtimeCount).toBe(2);
    expect(second).toEqual(first);
    expect(
      first.damageEvents[0]?.damageFactors
        .damageBonusMultiplier
    ).toBeCloseTo(1.01, 12);
  });

  it("freezes a declared plugin identity against factory replacement", () => {
    const plugin = makeTestPlugin(
      "frozen-definition",
      "1.0.0",
      { behavior: "stable" },
      () => ({
        modifyDamage(context) {
          return {
            damageBonus:
              context.damageInput.damageBonus + 0.01
          };
        }
      })
    );
    const config = makeConfig();
    const first = simulate(config, { plugins: [plugin] });

    expect(Object.isFrozen(plugin)).toBe(true);
    expect(Object.isFrozen(plugin.descriptor)).toBe(true);
    expect(() => {
      (
        plugin as unknown as {
          createRuntime: () => DamageModifierPluginRuntime;
        }
      ).createRuntime = () => ({
        modifyDamage(context) {
          return {
            damageBonus:
              context.damageInput.damageBonus + 100
          };
        }
      });
    }).toThrow(TypeError);

    const second = simulate(config, { plugins: [plugin] });
    expect(second.reproducibilityKey).toBe(
      first.reproducibilityKey
    );
    expect(second).toEqual(first);
  });

  it("prevents one plugin factory from rewriting a later plugin", () => {
    const victim = makeTestPlugin(
      "cross-plugin-victim",
      "1.0.0",
      { behavior: "stable-victim" },
      () => ({
        modifyDamage(context) {
          return {
            damageBonus:
              context.damageInput.damageBonus + 0.01
          };
        }
      })
    );
    let mutationError: unknown;
    const attacker = makeTestPlugin(
      "cross-plugin-attacker",
      "1.0.0",
      { behavior: "attempt-rewrite" },
      () => {
        try {
          (
            victim as unknown as {
              createRuntime: () => DamageModifierPluginRuntime;
            }
          ).createRuntime = () => ({
            modifyDamage(context) {
              return {
                damageBonus:
                  context.damageInput.damageBonus + 100
              };
            }
          });
        } catch (error) {
          mutationError = error;
        }
        return {
          modifyDamage() {}
        };
      }
    );
    const config = makeConfig();
    const first = simulate(config, {
      plugins: [attacker, victim]
    });
    const second = simulate(config, {
      plugins: [attacker, victim]
    });

    expect(mutationError).toBeInstanceOf(TypeError);
    expect(second.reproducibilityKey).toBe(
      first.reproducibilityKey
    );
    expect(second).toEqual(first);
  });

  it("isolates legal-timeline prefix probes from the final plugin runtime", () => {
    let runtimeCount = 0;
    const plugin = makeTestPlugin(
      "prefix-isolation",
      "1.0.0",
      { behavior: "prefix-isolation" },
      () => {
        runtimeCount += 1;
        let hitCount = 0;
        return {
          modifyDamage(context) {
            hitCount += 1;
            return {
              damageBonus:
                context.damageInput.damageBonus +
                hitCount / 100
            };
          }
        };
      }
    );
    const base = makeConfig();
    const config = makeConfig({
      duration: 2,
      cycleLength: 2,
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 60
        }
      ],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 1,
        abilities: [
          {
            id: "burst",
            actorId: "a",
            name: "爆发",
            kind: "burst",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 60,
            energyCost: 60,
            hits: [
              {
                id: "burst-hit",
                frame: 0,
                scaling: 1,
                element: "pyro"
              }
            ]
          }
        ],
        commands: [
          {
            type: "burst",
            actorId: "a",
            abilityId: "burst"
          }
        ]
      }
    });
    const result = simulate(config, { plugins: [plugin] });

    expect(runtimeCount).toBe(2);
    expect(
      result.damageEvents[0]?.damageFactors
        .damageBonusMultiplier
    ).toBeCloseTo(1.01, 12);
  });
});
