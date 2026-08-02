import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  createVersionedContentHash,
  type AbilityDefinition,
  type FrameHitDefinition,
  type FrameParticleDefinition,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { defineDamageModifierPlugin } from "../plugins";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function directHit(
  id: string,
  frame: number,
  icdTag: string,
  icdGroup: NonNullable<
    FrameHitDefinition["directDamageGroup"]
  >["icdGroup"],
  overrides: Partial<FrameHitDefinition> = {}
): FrameHitDefinition {
  return {
    id,
    frame,
    scaling: 1,
    element: "physical",
    directDamageGroup: { icdTag, icdGroup },
    ...overrides
  };
}

function legalHitConfig({
  hits,
  durationFrames,
  particles = [],
  overrides = {}
}: {
  hits: FrameHitDefinition[];
  durationFrames: number;
  particles?: FrameParticleDefinition[];
  overrides?: Partial<SimConfig>;
}): SimConfig {
  const base = makeConfig(overrides);
  const ability: AbilityDefinition = {
    id: "direct-damage-group-vector",
    actorId: "a",
    name: "Direct damage group vector",
    kind: "skill",
    cancelFrame: 0,
    animationEndFrame: Math.max(
      1,
      ...hits.map((hit) => hit.frame)
    ),
    cooldownFrames: 0,
    hits,
    particles
  };

  return {
    ...base,
    ...overrides,
    duration: durationFrames / 60,
    cycleLength: durationFrames / 60,
    rotation: [],
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

describe("ordinary direct-damage groups in the simulator", () => {
  it("applies zero slots, the reset-1 boundary, tail clamp, and same-tag group switches", () => {
    const yelanTail = Array.from({ length: 6 }, (_, index) =>
      directHit(
        `yelan-tail-${index}`,
        40 + index,
        "yelan-tail",
        "yelan-breakthrough"
      )
    );
    const result = simulate(
      legalHitConfig({
        durationFrames: 240,
        hits: [
          directHit("pole-open", 0, "pole", "pole-extra-attack"),
          directHit("pole-reset-minus-2", 28, "pole", "pole-extra-attack"),
          directHit("pole-reset-minus-1", 29, "pole", "pole-extra-attack"),
          ...yelanTail,
          directHit("switch-open", 80, "switch", "default"),
          directHit("switch-group", 81, "switch", "xiao-dash")
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(
      result.directDamageGroupLog
        .filter((entry) => entry.icdTag === "pole")
        .map(
          ({
            frame,
            windowStartFrame,
            resetAtFrame,
            hitIndex,
            sequenceMultiplier
          }) => ({
            frame,
            windowStartFrame,
            resetAtFrame,
            hitIndex,
            sequenceMultiplier
          })
        )
    ).toEqual([
      {
        frame: 0,
        windowStartFrame: 0,
        resetAtFrame: 29,
        hitIndex: 0,
        sequenceMultiplier: 1
      },
      {
        frame: 28,
        windowStartFrame: 0,
        resetAtFrame: 29,
        hitIndex: 1,
        sequenceMultiplier: 0
      },
      {
        frame: 29,
        windowStartFrame: 29,
        resetAtFrame: 58,
        hitIndex: 0,
        sequenceMultiplier: 1
      }
    ]);

    const yelanLogs = result.directDamageGroupLog.filter(
      (entry) => entry.icdTag === "yelan-tail"
    );
    expect(yelanLogs.slice(2).map(({ hitIndex, sequenceIndex }) => ({
      hitIndex,
      sequenceIndex
    }))).toEqual([
      { hitIndex: 2, sequenceIndex: 2 },
      { hitIndex: 3, sequenceIndex: 3 },
      { hitIndex: 4, sequenceIndex: 3 },
      { hitIndex: 5, sequenceIndex: 3 }
    ]);
    expect(yelanLogs.slice(1).every(
      (entry) => entry.sequenceMultiplier === 0
    )).toBe(true);

    expect(
      result.directDamageGroupLog.find(
        (entry) => entry.hitId === "switch-group"
      )
    ).toMatchObject({
      icdGroup: "xiao-dash",
      windowStartGroup: "default",
      resetFrames: 150,
      windowStartFrame: 80,
      resetAtFrame: 229,
      hitIndex: 1,
      sequenceIndex: 1,
      sequenceMultiplier: 0
    });

    for (const hitId of [
      "pole-reset-minus-2",
      "yelan-tail-2",
      "switch-group"
    ]) {
      const event = result.damageEvents.find(
        (candidate) => candidate.hitId === hitId
      );
      expect(event).toMatchObject({
        potentialDamage: 0,
        finalDamage: 0,
        displayDamage: 0,
        damageComposition: {
          direct: 0,
          additiveReaction: 0,
          transformativeReaction: 0
        }
      });
    }
  });

  it("keeps fixed zero slots authoritative after plugins while preserving skill-owned hit callbacks", () => {
    const plugin = defineDamageModifierPlugin(
      {
        id: "direct-group-absolute-override",
        version: "1",
        kind: "code",
        contentHash: createVersionedContentHash({
          groupMultiplier: 3
        })
      },
      () => ({
        modifyDamage: () => ({ groupMultiplier: 3 })
      })
    );
    const result = simulate(
      legalHitConfig({
        durationFrames: 60,
        hits: [
          directHit("plugin-open", 0, "plugin", "pole-extra-attack", {
            groupMultiplier: 2
          }),
          directHit("plugin-zero", 1, "plugin", "pole-extra-attack", {
            groupMultiplier: 2
          })
        ],
        particles: [
          {
            id: "skill-owned-particle",
            source: "skill-owned-hit-callback",
            element: "pyro",
            count: 1,
            travelFrames: 0,
            trigger: {
              kind: "hit-confirm",
              hitIds: ["plugin-open", "plugin-zero"]
            }
          }
        ]
      }),
      { critMode: "noCrit", plugins: [plugin] }
    );

    expect(
      result.directDamageGroupLog.map(
        ({
          configuredMultiplier,
          prePluginMultiplier,
          postPluginMultiplier,
          sequenceMultiplier,
          effectiveMultiplier,
          damageGroupOnEnemyHitAllowed
        }) => ({
          configuredMultiplier,
          prePluginMultiplier,
          postPluginMultiplier,
          sequenceMultiplier,
          effectiveMultiplier,
          damageGroupOnEnemyHitAllowed
        })
      )
    ).toEqual([
      {
        configuredMultiplier: 2,
        prePluginMultiplier: 2,
        postPluginMultiplier: 3,
        sequenceMultiplier: 1,
        effectiveMultiplier: 3,
        damageGroupOnEnemyHitAllowed: true
      },
      {
        configuredMultiplier: 2,
        prePluginMultiplier: 2,
        postPluginMultiplier: 3,
        sequenceMultiplier: 0,
        effectiveMultiplier: 0,
        damageGroupOnEnemyHitAllowed: false
      }
    ]);
    expect(
      result.damageEvents.map(
        (event) => event.damageFactors.groupMultiplier
      )
    ).toEqual([3, 0]);
    expect(
      result.directDamageGroupLog.map(
        (entry) => entry.pluginMultiplierTrace
      )
    ).toEqual([
      [
        {
          pluginManifestIndex: 0,
          pluginId: "direct-group-absolute-override",
          inputMultiplier: 2,
          outcome: "override",
          outputMultiplier: 3
        }
      ],
      [
        {
          pluginManifestIndex: 0,
          pluginId: "direct-group-absolute-override",
          inputMultiplier: 2,
          outcome: "override",
          outputMultiplier: 3
        }
      ]
    ]);
    expect(
      result.particleTriggerLog.map(
        ({ hitId, triggered, blockedReason }) => ({
          hitId,
          triggered,
          blockedReason
        })
      )
    ).toEqual([
      {
        hitId: "plugin-open",
        triggered: true,
        blockedReason: null
      },
      {
        hitId: "plugin-zero",
        triggered: true,
        blockedReason: null
      }
    ]);
  });

  it.each([
    ["string", "groupMultiplier", "3"],
    ["NaN", "groupMultiplier", Number.NaN],
    ["Infinity", "groupMultiplier", Number.POSITIVE_INFINITY],
    ["other-numeric-field", "damageBonus", "0.5"]
  ] as const)(
    "rejects a malicious %s plugin numeric override before calculation",
    (caseName, field, value) => {
      const pluginId = `malicious-${caseName}`;
      const plugin = defineDamageModifierPlugin(
        {
          id: pluginId,
          version: "1",
          kind: "code",
          contentHash: createVersionedContentHash({ caseName, field })
        },
        () => ({
          modifyDamage: () => ({ [field]: value }) as never
        })
      );
      const config = legalHitConfig({
        durationFrames: 60,
        hits: [
          directHit(
            "malicious-plugin-hit",
            0,
            "malicious-plugin",
            "pole-extra-attack"
          )
        ]
      });

      expect(() =>
        simulate(config, {
          critMode: "noCrit",
          plugins: [plugin]
        })
      ).toThrow(
        new RegExp(
          `Damage plugin "${pluginId}".*${field}.*finite number`
        )
      );
    }
  );

  it.each([
    ["null", null, /plain object/],
    ["primitive-string", "bad", /plain object/],
    ["boxed-string", new String("bad"), /plain object/],
    ["array", [{ groupMultiplier: 3 }], /plain object/],
    [
      "inherited-wire",
      Object.create({ groupMultiplier: 3 }),
      /plain object/
    ],
    ["unknown-field", { surprise: 3 }, /unknown override field "surprise"/],
    [
      "bad-scaling-stat",
      { scalingStat: "energyRecharge" },
      /invalid scalingStat override/
    ],
    [
      "bad-crit-mode",
      { critMode: "sometimes" },
      /invalid critMode override/
    ]
  ] as const)(
    "rejects a malicious %s plugin return boundary",
    (caseName, changes, expectedReason) => {
      const pluginId = `boundary-${caseName}`;
      const plugin = defineDamageModifierPlugin(
        {
          id: pluginId,
          version: "1",
          kind: "code",
          contentHash: createVersionedContentHash({ caseName })
        },
        () => ({
          modifyDamage: () => changes as never
        })
      );
      const config = legalHitConfig({
        durationFrames: 60,
        hits: [
          directHit(
            "plugin-boundary-hit",
            0,
            "plugin-boundary",
            "pole-extra-attack"
          )
        ]
      });

      expect(() =>
        simulate(config, {
          critMode: "noCrit",
          plugins: [plugin]
        })
      ).toThrow(
        new RegExp(
          `Damage plugin "${pluginId}".*${expectedReason.source}`
        )
      );
    }
  );

  it("does not consume on a miss, consumes an immune landed hit, and isolates every target", () => {
    const targetPolicy = {
      damage: "normal" as const,
      aura: "normal" as const,
      hitConfirm: "normal" as const
    };
    const result = simulate(
      legalHitConfig({
        durationFrames: 60,
        overrides: {
          enemy: {
            level: 90,
            resistance: 0.1,
            defReduction: 0,
            targets: [
              { id: "enemy-0", name: "Target 0" },
              { id: "enemy-1", name: "Target 1" }
            ]
          }
        },
        hits: [
          directHit("fanout-open", 0, "shared", "cyno-bolt", {
            targeting: {
              mode: "fanout",
              targets: [
                {
                  targetId: "enemy-0",
                  outcome: "landed"
                },
                {
                  targetId: "enemy-1",
                  outcome: "landed"
                }
              ]
            }
          }),
          directHit("target-0-miss", 1, "shared", "cyno-bolt", {
            targeting: {
              targetId: "enemy-0",
              outcome: "miss",
              reason: "OUTSIDE_HITBOX"
            }
          }),
          directHit("target-0-second", 2, "shared", "cyno-bolt", {
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            }
          }),
          directHit("target-1-immune", 3, "shared", "cyno-bolt", {
            targeting: {
              targetId: "enemy-1",
              outcome: "landed",
              reason: "DAMAGE_IMMUNE",
              effects: {
                ...targetPolicy,
                damage: "immune"
              }
            }
          }),
          directHit("target-1-after-immune", 4, "shared", "cyno-bolt", {
            targeting: {
              targetId: "enemy-1",
              outcome: "landed"
            }
          }),
          directHit("target-1-zero", 5, "shared", "cyno-bolt", {
            targeting: {
              targetId: "enemy-1",
              outcome: "landed"
            }
          })
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(
      result.directDamageGroupLog.map(
        ({ hitId, targetId, hitIndex, sequenceMultiplier }) => ({
          hitId,
          targetId,
          hitIndex,
          sequenceMultiplier
        })
      )
    ).toEqual([
      {
        hitId: "fanout-open",
        targetId: "enemy-0",
        hitIndex: 0,
        sequenceMultiplier: 1
      },
      {
        hitId: "fanout-open",
        targetId: "enemy-1",
        hitIndex: 0,
        sequenceMultiplier: 1
      },
      {
        hitId: "target-0-second",
        targetId: "enemy-0",
        hitIndex: 1,
        sequenceMultiplier: 1
      },
      {
        hitId: "target-1-immune",
        targetId: "enemy-1",
        hitIndex: 1,
        sequenceMultiplier: 1
      },
      {
        hitId: "target-1-after-immune",
        targetId: "enemy-1",
        hitIndex: 2,
        sequenceMultiplier: 1
      },
      {
        hitId: "target-1-zero",
        targetId: "enemy-1",
        hitIndex: 3,
        sequenceMultiplier: 0
      }
    ]);
    expect(
      result.directDamageGroupLog.some(
        (entry) => entry.hitId === "target-0-miss"
      )
    ).toBe(false);
    expect(
      result.damageEvents.find(
        (event) => event.hitId === "target-1-immune"
      )
    ).toMatchObject({
      targetDamagePolicy: "immune",
      potentialDamage: expect.any(Number),
      finalDamage: 0
    });
    expect(
      result.damageEvents.find(
        (event) => event.hitId === "target-1-immune"
      )!.potentialDamage
    ).toBeGreaterThan(0);
  });

  it("isolates the actor and tag tuple on a shared target", () => {
    const base = makeConfig();
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      characters: [
        base.characters[0]!,
        {
          ...base.characters[0]!,
          id: "b",
          name: "B",
          element: "hydro"
        }
      ],
      rotation: [
        {
          id: "actor-a-hit",
          actorId: "a",
          name: "Actor A",
          at: 0,
          once: true,
          hits: [
            {
              id: "actor-a",
              offset: 0,
              scaling: 1,
              element: "physical",
              directDamageGroup: {
                icdTag: "same-tag",
                icdGroup: "pole-extra-attack"
              }
            }
          ]
        },
        {
          id: "actor-b-hit",
          actorId: "b",
          name: "Actor B",
          at: 0,
          once: true,
          hits: [
            {
              id: "actor-b",
              offset: 0,
              scaling: 1,
              element: "physical",
              directDamageGroup: {
                icdTag: "same-tag",
                icdGroup: "pole-extra-attack"
              }
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });

    expect(
      result.directDamageGroupLog.map(
        ({ sourceActorId, hitIndex, sequenceMultiplier }) => ({
          sourceActorId,
          hitIndex,
          sequenceMultiplier
        })
      )
    ).toEqual([
      { sourceActorId: "a", hitIndex: 0, sequenceMultiplier: 1 },
      { sourceActorId: "b", hitIndex: 0, sequenceMultiplier: 1 }
    ]);
  });

  it("keeps Aura reactions, target Hitlag, and Dendro-core contact active on zero-damage slots", () => {
    const auraAndHitlag = simulate(
      legalHitConfig({
        durationFrames: 180,
        overrides: {
          enemy: {
            level: 90,
            resistance: 0.1,
            defReduction: 0,
            targets: [
              {
                id: "enemy-0",
                name: "Hydro target",
                initialAura: [
                  { element: "hydro", gaugeUnits: 4 }
                ]
              }
            ]
          },
          reactionEngine: { mode: "aura-v2" },
          targetClockModel: {
            mode: "target-local-hitlag-v1"
          }
        },
        hits: [
          directHit("aura-open", 0, "aura", "pole-extra-attack", {
            element: "pyro",
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" }
            },
            targetHitlag: { haltFrames: 2, factor: 0 }
          }),
          directHit("aura-zero", 4, "aura", "pole-extra-attack", {
            element: "pyro",
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" }
            },
            targetHitlag: { haltFrames: 2, factor: 0 }
          })
        ]
      }),
      { critMode: "noCrit" }
    );
    const zeroAuraEvent = auraAndHitlag.damageEvents.find(
      (event) => event.hitId === "aura-zero"
    )!;

    expect(zeroAuraEvent.finalDamage).toBe(0);
    expect(zeroAuraEvent.reaction).toBe("reverseVaporize");
    expect(zeroAuraEvent.reactionAudit.auraConsumed).not.toEqual([]);
    expect(
      auraAndHitlag.targetHitlagLog.filter(
        (entry) => entry.hitId === "aura-zero"
      )
    ).toHaveLength(1);
    expect(
      auraAndHitlag.targetHitlagLog.find(
        (entry) => entry.hitId === "aura-zero"
      )
    ).toMatchObject({
      applied: true,
      extensionFrames: 2,
      blockedReason: null
    });

    const coreContact = simulate(
      legalHitConfig({
        durationFrames: 360,
        overrides: {
          actorPoses: [
            {
              actorId: "a",
              position: { x: 0, y: 0 },
              facingDegrees: 0
            }
          ],
          enemy: {
            level: 90,
            resistance: 0.1,
            defReduction: 0,
            targets: [
              {
                id: "enemy-0",
                name: "Dendro target",
                position: { x: 0, y: 0 },
                hitboxRadius: 0,
                initialAura: [
                  { element: "dendro", gaugeUnits: 1 }
                ]
              }
            ]
          },
          reactionEngine: { mode: "aura-v5" }
        },
        hits: [
          directHit("core-group-open", 30, "core", "pole-extra-attack"),
          {
            id: "create-core",
            frame: 1,
            scaling: 1,
            element: "hydro",
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" }
            }
          },
          directHit("zero-core-contact", 32, "core", "pole-extra-attack", {
            element: "pyro",
            geometry: {
              kind: "circle",
              coordinateSpace: "world",
              origin: { x: 0, y: 0 },
              radius: 100
            },
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" }
            }
          })
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(
      coreContact.damageEvents.find(
        (event) => event.hitId === "zero-core-contact"
      )
    ).toMatchObject({ potentialDamage: 0, finalDamage: 0 });
    expect(
      coreContact.dendroCoreContactLog.find(
        (entry) => entry.hitId === "zero-core-contact"
      )
    ).toMatchObject({
      reaction: "burgeon",
      blockedReason: null,
      contactedCoreIds: [expect.any(Number)]
    });
    expect(coreContact.directDamageGroupLog).toHaveLength(3);
    expect(
      coreContact.damageEvents.some(
        (event) => event.kind === "transformative-reaction"
      )
    ).toBe(true);
  });

  it("preserves the default 120-second preset numerics and is deterministic", () => {
    const first = simulate(durinMeltPreset, {
      critMode: "average",
      energyMode: "configured"
    });
    const second = simulate(durinMeltPreset, {
      critMode: "average",
      energyMode: "configured"
    });

    expect(first.totalDamage).toBe(41410555.13728799);
    expect(first.dps).toBe(345087.9594773999);
    expect(first.damageEvents).toHaveLength(269);
    expect(first.reactedHits).toBe(129);
    expect(first.skippedActions).toHaveLength(3);
    expect(first.byCharacter).toEqual({
      nicole: 740338.5919263127,
      citlali: 77244.84267655843,
      durin: 38779268.124040276,
      lohen: 1813703.5786448019
    });
    expect(first.directDamageGroupLog).toHaveLength(
      first.damageEvents.filter((event) => event.kind === "direct").length
    );
    expect(
      first.directDamageGroupLog.every(
        (entry) =>
          entry.evaluation === "bypassed" &&
          entry.sequenceMultiplier === 1 &&
          entry.effectiveMultiplier === entry.postPluginMultiplier
      )
    ).toBe(true);
    expect(second.directDamageGroupLog).toEqual(
      first.directDamageGroupLog
    );
    expect(second.totalDamage).toBe(first.totalDamage);
    expect(second.reproducibilityKey).toBe(first.reproducibilityKey);
  });
});
