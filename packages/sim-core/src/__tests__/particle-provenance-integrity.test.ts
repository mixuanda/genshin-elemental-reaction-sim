import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function cloneResult(result: SimulationResult): SimulationResult {
  return structuredClone(result);
}

function expectAcceptedByPublicAndTrusted(
  result: SimulationResult
): void {
  const parsed = simulationResultSchema.safeParse(result);
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
  expect(() =>
    assertTrustedSimulationResult(result)
  ).not.toThrow();
}

function expectRejectedByPublicAndTrusted(
  label: string,
  result: SimulationResult,
  mutate: (value: SimulationResult) => void,
  expectedPublicIssue?: RegExp
): void {
  const publicWire = cloneResult(result);
  mutate(publicWire);
  const publicResult =
    simulationResultSchema.safeParse(publicWire);
  expect(
    publicResult.success,
    `${label}: public SimulationResult boundary`
  ).toBe(false);
  if (!publicResult.success && expectedPublicIssue !== undefined) {
    expect(
      publicResult.error.issues.some((issue) =>
        expectedPublicIssue.test(issue.message)
      ),
      `${label}: expected public integrity issue`
    ).toBe(true);
  }

  const trustedResult = cloneResult(result);
  mutate(trustedResult);
  expect(
    () => assertTrustedSimulationResult(trustedResult),
    `${label}: trusted sim-core boundary`
  ).toThrow(
    /Trusted SimulationResult 1\.48 integrity validation failed/
  );
}

function makeHitConfirmedParticleConfig(
  overrides: Partial<SimConfig> = {}
): SimConfig {
  return makeConfig({
    dataVersion: "particle-provenance-hit-confirm",
    randomSeed: "particle-provenance-hit-confirm",
    duration: 1,
    cycleLength: 1,
    rotation: [
      {
        id: "source",
        actorId: "a",
        name: "Source",
        at: 0,
        once: true,
        hits: [
          {
            id: "source-hit",
            offset: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            }
          }
        ],
        particles: [
          {
            id: "source-particle",
            source: "source-particle",
            element: "pyro",
            count: 1,
            travelTime: 2,
            trigger: {
              kind: "hit-confirm",
              hitIds: ["source-hit"]
            }
          }
        ]
      }
    ],
    ...overrides
  });
}

function forgeHitConfirmBlocked(
  result: SimulationResult
): void {
  const resolution = result.hitResolutionLog[0];
  const trigger = result.particleTriggerLog[0];
  if (resolution === undefined || trigger === undefined) {
    throw new Error("Expected one direct hit and one particle trigger.");
  }
  resolution.hitConfirmAllowed = false;
  resolution.targetEffectSource = "hit";
  resolution.reason = "FORGED_HIT_CONFIRM_BLOCK";
  trigger.confirmedTargetIds = [];
  trigger.triggered = false;
  trigger.blockedReason = "TARGET_HIT_CONFIRM_BLOCKED";
  result.particleEvents = [];
}

function forgeWholeDirectHitDeletion(
  result: SimulationResult
): void {
  const resolution = result.hitResolutionLog[0];
  const trigger = result.particleTriggerLog[0];
  const character = result.config.characters[0];
  const target = result.enemyTargets[0];
  if (
    resolution === undefined ||
    trigger === undefined ||
    character === undefined ||
    target === undefined
  ) {
    throw new Error("Expected one complete direct-hit chain.");
  }

  resolution.outcome = "miss";
  resolution.landed = false;
  resolution.reason = "FORGED_MISS";
  resolution.targetEffectSource = "hit";
  resolution.damageAllowed = false;
  resolution.auraAllowed = false;
  resolution.hitConfirmAllowed = false;
  resolution.damageEventId = null;
  resolution.potentialDamage = 0;
  resolution.finalDamage = 0;
  resolution.displayDamage = 0;

  trigger.confirmedTargetIds = [];
  trigger.triggered = false;
  trigger.blockedReason = "TARGET_MISS";
  result.particleEvents = [];

  result.damageEvents = [];
  result.hitEvents = [];
  result.damageCurve = [];
  result.totalDamage = 0;
  result.dps = 0;
  result.reactedHits = 0;
  result.byCharacter = {};
  result.bySkill = [];
  result.perSecond = [{}];
  result.characterSummaries = [
    {
      characterId: character.id,
      damage: 0,
      hits: 0,
      dps: 0,
      share: 0
    }
  ];
  result.targetSummaries = [
    {
      targetId: target.id,
      targetName: target.name,
      damage: 0,
      potentialDamage: 0,
      damageEvents: 0,
      landedChecks: 0,
      missedChecks: 1,
      immuneDamageEvents: 0,
      dps: 0,
      share: 0
    }
  ];
}

function forgeRetainedLandedDirectDamageDeletion(
  result: SimulationResult
): void {
  const resolution = result.hitResolutionLog[0];
  const character = result.config.characters[0];
  const target = result.enemyTargets[0];
  if (
    resolution === undefined ||
    character === undefined ||
    target === undefined
  ) {
    throw new Error("Expected one complete direct-hit chain.");
  }

  // Preserve the configuration-derived landed row and its hit-confirm
  // particle chain while deleting only the damage projection.
  resolution.damageEventId = null;
  resolution.potentialDamage = 0;
  resolution.finalDamage = 0;
  resolution.displayDamage = 0;

  result.damageEvents = [];
  result.hitEvents = [];
  result.damageCurve = [];
  result.totalDamage = 0;
  result.dps = 0;
  result.reactedHits = 0;
  result.byCharacter = {};
  result.bySkill = [];
  result.perSecond = [{}];
  result.characterSummaries = [
    {
      characterId: character.id,
      damage: 0,
      hits: 0,
      dps: 0,
      share: 0
    }
  ];
  result.targetSummaries = [
    {
      targetId: target.id,
      targetName: target.name,
      damage: 0,
      potentialDamage: 0,
      damageEvents: 0,
      landedChecks: 1,
      missedChecks: 0,
      immuneDamageEvents: 0,
      dps: 0,
      share: 0
    }
  ];
}

function makeSharedParticleIcdConfig(
  crossActionOffsets = false
): SimConfig {
  const makeAction = (
    id: string,
    at: number,
    offset: number
  ): SimConfig["rotation"][number] => ({
    id,
    actorId: "a",
    name: id,
    at,
    once: true,
    hits: [
      {
        id: `${id}-hit`,
        offset,
        scaling: 0,
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        }
      }
    ],
    particles: [
      {
        id: `${id}-particle`,
        source: `${id}-particle`,
        element: "pyro",
        count: 1,
        travelTime: 2,
        trigger: {
          kind: "hit-confirm",
          hitIds: [`${id}-hit`],
          internalCooldown: {
            key: "shared-particle-icd",
            duration: 1
          }
        }
      }
    ]
  });

  return makeConfig({
    dataVersion: crossActionOffsets
      ? "particle-provenance-cross-action-order"
      : "particle-provenance-same-frame-order",
    duration: 2,
    cycleLength: 2,
    rotation: crossActionOffsets
      ? [
          makeAction("late-action", 1, 0),
          makeAction("early-action", 0, 1)
        ]
      : [
          makeAction("first-action", 0, 0),
          makeAction("second-action", 0, 0)
        ]
  });
}

function forgeSharedIcdWinnerSwap(
  result: SimulationResult
): void {
  const firstResolution = result.hitResolutionLog[0];
  const secondResolution = result.hitResolutionLog[1];
  const firstTrigger = result.particleTriggerLog[0];
  const secondTrigger = result.particleTriggerLog[1];
  const child = result.particleEvents[0];
  if (
    firstResolution === undefined ||
    secondResolution === undefined ||
    firstTrigger === undefined ||
    secondTrigger === undefined ||
    child === undefined
  ) {
    throw new Error("Expected two same-frame hit groups and one child.");
  }

  result.hitResolutionLog = [
    { ...structuredClone(secondResolution), id: 0 },
    { ...structuredClone(firstResolution), id: 1 }
  ];
  for (const event of result.damageEvents) {
    event.targetResolutionId =
      event.targetResolutionId === 0 ? 1 : 0;
  }
  result.hitEvents = structuredClone(result.damageEvents);

  result.particleTriggerLog = [
    {
      ...structuredClone(secondTrigger),
      id: 0,
      triggered: true,
      blockedReason: null
    },
    {
      ...structuredClone(firstTrigger),
      id: 1,
      triggered: false,
      blockedReason: "INTERNAL_COOLDOWN"
    }
  ];
  child.sourceActionId = secondTrigger.sourceActionId;
  child.source = secondTrigger.source;
  child.particleId = secondTrigger.particleId;
  child.triggerLogId = 0;
  child.triggerHitId = secondTrigger.hitId;
}

describe("current SimulationResult particle provenance integrity", () => {
  it("rejects deletion of an out-of-window hit-confirm particle chain", () => {
    const result = simulate(makeHitConfirmedParticleConfig());
    expect(result.particleEvents).toMatchObject([
      {
        receivedWithinSimulation: false,
        triggerLogId: 0,
        triggerHitId: "source-hit"
      }
    ]);
    expectAcceptedByPublicAndTrusted(result);

    expectRejectedByPublicAndTrusted(
      "configured landed hit forged into hit-confirm blocked",
      result,
      forgeHitConfirmBlocked
    );
  });

  it("rejects coordinated deletion of a configured landed direct-hit damage chain", () => {
    const result = simulate(makeHitConfirmedParticleConfig());
    expect(result.damageEvents).toHaveLength(1);
    expectAcceptedByPublicAndTrusted(result);

    expectRejectedByPublicAndTrusted(
      "configured landed hit forged into a miss with all damage aggregates removed",
      result,
      forgeWholeDirectHitDeletion
    );
  });

  it("rejects deletion of a landed row's damage projection while retaining its hit-confirm particle chain", () => {
    const result = simulate(makeHitConfirmedParticleConfig());
    expect(result.hitResolutionLog).toMatchObject([
      {
        landed: true,
        damageEventId: 0
      }
    ]);
    expect(result.particleTriggerLog).toMatchObject([
      {
        triggered: true
      }
    ]);
    expect(result.particleEvents).toHaveLength(1);
    expectAcceptedByPublicAndTrusted(result);

    expectRejectedByPublicAndTrusted(
      "landed hit retained while its entire damage projection is removed",
      result,
      forgeRetainedLandedDirectDamageDeletion,
      /configured landed direct hit must own exactly one direct damage event/
    );
  });

  it("requires configured misses to retain a null damage backlink and zero damage values", () => {
    const config = makeHitConfirmedParticleConfig();
    const hit = config.rotation[0]?.hits?.[0];
    if (hit === undefined) {
      throw new Error("Expected one configured direct hit.");
    }
    hit.targeting = {
      targetId: "enemy-0",
      outcome: "miss",
      reason: "TEST_MISS"
    };
    const result = simulate(config);
    expect(result.hitResolutionLog).toMatchObject([
      {
        outcome: "miss",
        landed: false,
        damageEventId: null,
        potentialDamage: 0,
        finalDamage: 0,
        displayDamage: 0
      }
    ]);
    expect(result.damageEvents).toHaveLength(0);
    expectAcceptedByPublicAndTrusted(result);

    for (const [field, value] of [
      ["damageEventId", 0],
      ["potentialDamage", 1],
      ["finalDamage", 1],
      ["displayDamage", 1]
    ] as const) {
      expectRejectedByPublicAndTrusted(
        `configured miss forged with ${field}=${value}`,
        result,
        (mutation) => {
          const resolution = mutation.hitResolutionLog[0];
          if (resolution === undefined) {
            throw new Error("Expected one missed target row.");
          }
          resolution[field] = value;
        },
        new RegExp(`configured missed direct hit ${field}`)
      );
    }
  });

  it("rejects coordinated direct-hit label and element drift", () => {
    const result = simulate(makeHitConfirmedParticleConfig());
    expectRejectedByPublicAndTrusted(
      "direct hit label and element rewritten across result aliases",
      result,
      (mutation) => {
        const resolution = mutation.hitResolutionLog[0];
        const damage = mutation.damageEvents[0];
        if (resolution === undefined || damage === undefined) {
          throw new Error("Expected one direct damage chain.");
        }
        resolution.hitLabel = "Forged label";
        resolution.element = "hydro";
        damage.hitLabel = "Forged label";
        damage.element = "hydro";
        mutation.hitEvents = structuredClone(
          mutation.damageEvents
        );
      }
    );
  });

  it("rejects timeline backlinks injected into a legacy direct-hit chain", () => {
    const result = simulate(makeHitConfirmedParticleConfig());
    expectRejectedByPublicAndTrusted(
      "legacy action and direct damage forged as timeline-backed",
      result,
      (mutation) => {
        const action = mutation.actionLog[0];
        const resolution = mutation.hitResolutionLog[0];
        const damage = mutation.damageEvents[0];
        if (
          action === undefined ||
          resolution === undefined ||
          damage === undefined
        ) {
          throw new Error("Expected one legacy direct damage chain.");
        }
        action.timelineCommandIndex = 0;
        action.sourceAbilityId = "forged-ability";
        resolution.timelineCommandIndex = 0;
        resolution.sourceAbilityId = "forged-ability";
        damage.timelineCommandIndex = 0;
        damage.sourceAbilityId = "forged-ability";
        mutation.hitEvents = structuredClone(
          mutation.damageEvents
        );
      }
    );
  });

  it.each(["legacy", "legal"] as const)(
    "accepts repeated hit IDs distinguished by hit index/group in %s mode",
    (mode) => {
      const repeatedHits = [
        {
          id: "repeated",
          scaling: 0,
          element: "pyro" as const
        },
        {
          id: "repeated",
          scaling: 0,
          element: "pyro" as const
        }
      ];
      const config =
        mode === "legacy"
          ? makeConfig({
              duration: 1,
              cycleLength: 1,
              rotation: [
                {
                  id: "repeated-source",
                  actorId: "a",
                  name: "Repeated source",
                  at: 0,
                  once: true,
                  hits: repeatedHits.map((hit) => ({
                    ...hit,
                    offset: 0
                  })),
                  particles: [
                    {
                      id: "repeated-particle",
                      element: "pyro",
                      count: 1,
                      travelTime: 2,
                      trigger: {
                        kind: "hit-confirm",
                        hitIds: ["repeated"]
                      }
                    }
                  ]
                }
              ]
            })
          : makeConfig({
              duration: 1,
              cycleLength: 1,
              rotation: [],
              timeline: {
                mode: "legal-frame-v1",
                fps: 60,
                legalityMode: "strict",
                initialActiveCharacterId: "a",
                swapFrames: 12,
                abilities: [
                  {
                    id: "repeated-source",
                    actorId: "a",
                    name: "Repeated source",
                    kind: "skill",
                    cancelFrame: 1,
                    animationEndFrame: 1,
                    cooldownFrames: 0,
                    hits: repeatedHits.map((hit) => ({
                      ...hit,
                      frame: 0
                    })),
                    particles: [
                      {
                        id: "repeated-particle",
                        element: "pyro",
                        count: 1,
                        travelFrames: 120,
                        trigger: {
                          kind: "hit-confirm",
                          hitIds: ["repeated"]
                        }
                      }
                    ]
                  }
                ],
                commands: [
                  {
                    type: "skill",
                    actorId: "a",
                    abilityId: "repeated-source"
                  }
                ]
              }
            });

      const result = simulate(config);
      expect(result.hitResolutionLog.map((row) => row.hitId)).toEqual([
        "repeated",
        "repeated"
      ]);
      expect(
        result.hitResolutionLog.map((row) => row.hitGroupId)
      ).toHaveLength(2);
      expect(result.particleTriggerLog).toHaveLength(2);
      expectAcceptedByPublicAndTrusted(result);
    }
  );

  it("rejects orphan and duplicate direct target rows", () => {
    const result = simulate(
      makeHitConfirmedParticleConfig({
        enemy: {
          level: 110,
          resistance: 0.1,
          defReduction: 0,
          targets: [
            { id: "enemy-0", name: "Enemy 0" },
            { id: "enemy-1", name: "Enemy 1" }
          ]
        },
        rotation: [
          {
            id: "fanout",
            actorId: "a",
            name: "Fanout",
            at: 0,
            once: true,
            hits: [
              {
                id: "fanout-hit",
                offset: 0,
                scaling: 0,
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
              }
            ]
          }
        ]
      })
    );
    expectAcceptedByPublicAndTrusted(result);

    expectRejectedByPublicAndTrusted(
      "duplicate direct target row",
      result,
      (mutation) => {
        const duplicate = structuredClone(
          mutation.hitResolutionLog[0]!
        );
        duplicate.id = mutation.hitResolutionLog.length;
        mutation.hitResolutionLog.push(duplicate);
        mutation.targetSummaries[0]!.landedChecks += 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      "orphan direct hit group",
      result,
      (mutation) => {
        const orphan = structuredClone(
          mutation.hitResolutionLog[0]!
        );
        orphan.id = mutation.hitResolutionLog.length;
        orphan.hitGroupId = "forged-orphan-group";
        mutation.hitResolutionLog.push(orphan);
        mutation.targetSummaries[0]!.landedChecks += 1;
      }
    );
  });

  it("derives the same-frame shared particle ICD winner from configuration order", () => {
    const result = simulate(makeSharedParticleIcdConfig());
    expect(
      result.particleTriggerLog.map(
        ({ sourceActionId, triggered, blockedReason }) => ({
          sourceActionId,
          triggered,
          blockedReason
        })
      )
    ).toEqual([
      {
        sourceActionId: "first-action",
        triggered: true,
        blockedReason: null
      },
      {
        sourceActionId: "second-action",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN"
      }
    ]);
    expectAcceptedByPublicAndTrusted(result);

    expectRejectedByPublicAndTrusted(
      "same-frame shared ICD winner swapped with result-row order",
      result,
      forgeSharedIcdWinnerSwap
    );
  });

  it("uses action execution order before config insertion order for converging hits", () => {
    const result = simulate(makeSharedParticleIcdConfig(true));
    expect(
      result.particleTriggerLog.map(
        ({ sourceActionId, triggered }) => ({
          sourceActionId,
          triggered
        })
      )
    ).toEqual([
      { sourceActionId: "early-action", triggered: true },
      { sourceActionId: "late-action", triggered: false }
    ]);
    expectAcceptedByPublicAndTrusted(result);
  });

  it("aggregates missing legacy occurrences instead of retaining one issue per cycle", () => {
    const result = simulate(
      makeConfig({
        duration: 4,
        cycleLength: 1,
        rotation: [
          {
            id: "repeating-action",
            actorId: "a",
            name: "Repeating action",
            at: 0
          }
        ]
      })
    );
    const mutation = cloneResult(result);
    mutation.actionLog = [];
    const parsed = simulationResultSchema.safeParse(mutation);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const occurrenceIssues = parsed.error.issues.filter(({ message }) =>
      message.includes(
        "scheduled action occurrence(s) are missing"
      )
    );
    expect(occurrenceIssues).toHaveLength(1);
    expect(occurrenceIssues[0]?.message).toContain("4");
    expect(() =>
      assertTrustedSimulationResult(mutation)
    ).toThrow(
      /Trusted SimulationResult 1\.48 integrity validation failed/
    );
  });

});
