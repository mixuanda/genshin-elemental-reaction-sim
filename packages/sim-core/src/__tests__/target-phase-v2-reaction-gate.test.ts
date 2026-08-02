import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  simConfigSchema,
  targetPhaseV2ResultReferencesSchema,
  type Element,
  type FrameHitDefinition,
  type InitialAuraApplication,
  type ReactionType,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

interface ReactionGateTarget {
  id: string;
  name: string;
  position: { x: number; y: number };
  initialAura: InitialAuraApplication[];
}

interface ReactionGateScenario {
  durationFrames: number;
  initialAura?: InitialAuraApplication[];
  targets?: ReactionGateTarget[];
  hits: FrameHitDefinition[];
  expectedReactions: readonly ReactionType[];
}

function applicationHit({
  id,
  frame = 0,
  element,
  gaugeUnits
}: {
  id: string;
  frame?: number;
  element: Element;
  gaugeUnits: number;
}): FrameHitDefinition {
  const coreContactElement =
    element === "pyro" || element === "electro";
  return {
    id,
    label: id,
    frame,
    scaling: 1,
    element,
    ...(coreContactElement
      ? {
          geometry: {
            kind: "circle" as const,
            coordinateSpace: "world" as const,
            origin: { x: 0, y: 0 },
            radius: 1
          }
        }
      : {}),
    application: {
      gaugeUnits,
      icd: { mode: "no-icd-v1" }
    }
  };
}

const REACTION_GATE_SCENARIOS = {
  melt: {
    durationFrames: 10,
    initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "melt-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["melt"]
  },
  reverseMelt: {
    durationFrames: 10,
    initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "reverse-melt-cryo",
        element: "cryo",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["reverseMelt"]
  },
  vaporize: {
    durationFrames: 10,
    initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "vaporize-hydro",
        element: "hydro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["vaporize"]
  },
  reverseVaporize: {
    durationFrames: 10,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "reverse-vaporize-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["reverseVaporize"]
  },
  overload: {
    durationFrames: 10,
    initialAura: [{ element: "electro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "overload-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["overload"]
  },
  superconduct: {
    durationFrames: 10,
    initialAura: [{ element: "electro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "superconduct-cryo",
        element: "cryo",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["superconduct"]
  },
  electroCharged: {
    durationFrames: 30,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "electro-charged-electro",
        element: "electro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["electroCharged"]
  },
  freezeShatter: {
    durationFrames: 40,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "freeze-cryo",
        element: "cryo",
        gaugeUnits: 1
      }),
      {
        id: "shatter-blunt",
        label: "shatter-blunt",
        frame: 12,
        scaling: 1,
        element: "physical",
        strikeType: "blunt",
        poiseDamage: 0
      }
    ],
    expectedReactions: ["freeze", "shatter"]
  },
  swirl: {
    durationFrames: 10,
    targets: [
      {
        id: "enemy-0",
        name: "Swirl source",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "pyro", gaugeUnits: 1 }]
      },
      {
        id: "enemy-1",
        name: "Swirl propagation target",
        position: { x: 1, y: 0 },
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      }
    ],
    hits: [
      {
        ...applicationHit({
          id: "swirl-anemo",
          element: "anemo",
          gaugeUnits: 1
        }),
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        }
      }
    ],
    expectedReactions: ["swirlPyro"]
  },
  crystallize: {
    durationFrames: 40,
    initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "crystallize-geo",
        element: "geo",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["crystallizePyro"]
  },
  catalyze: {
    durationFrames: 50,
    initialAura: [{ element: "dendro", gaugeUnits: 2 }],
    hits: [
      applicationHit({
        id: "quicken-electro",
        element: "electro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "aggravate-electro",
        frame: 12,
        element: "electro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "spread-dendro",
        frame: 24,
        element: "dendro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["quicken", "aggravate", "spread"]
  },
  burning: {
    durationFrames: 50,
    initialAura: [{ element: "dendro", gaugeUnits: 2 }],
    hits: [
      applicationHit({
        id: "burning-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["burning"]
  },
  bloom: {
    durationFrames: 360,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "bloom-hydro",
        element: "hydro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["bloom"]
  },
  burgeon: {
    durationFrames: 120,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "burgeon-bloom-hydro",
        element: "hydro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "burgeon-pyro-contact",
        frame: 31,
        element: "pyro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["bloom", "burgeon"]
  },
  hyperbloom: {
    durationFrames: 140,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "hyperbloom-bloom-hydro",
        element: "hydro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "hyperbloom-electro-contact",
        frame: 31,
        element: "electro",
        gaugeUnits: 1
      })
    ],
    expectedReactions: ["bloom", "hyperbloom"]
  }
} as const satisfies Record<string, ReactionGateScenario>;

function makeReactionGateConfig(
  scenarioId: string,
  scenario: ReactionGateScenario
): SimConfig {
  const base = makeConfig();
  const durationFrames = Math.max(60, scenario.durationFrames);
  const lastHitFrame = Math.max(
    ...scenario.hits.map((hit) => hit.frame)
  );
  const actionEndFrame = lastHitFrame + 1;
  const targets =
    scenario.targets ??
    [
      {
        id: "enemy-0",
        name: `Reaction gate ${scenarioId}`,
        position: { x: 0, y: 0 },
        initialAura: scenario.initialAura ?? []
      }
    ];
  return {
    ...base,
    meta: {
      name: `1.38 target-phase-v2 reaction gate · ${scenarioId}`,
      version: "1.38.0",
      verificationStatus: "provisional",
      note:
        "Representative engine regression vector; not official server truth."
    },
    dataVersion: "reaction-gate-1.38-provisional",
    randomSeed: `reaction-gate-1.38:${scenarioId}`,
    duration: durationFrames / 60,
    cycleLength: durationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "reaction-driver",
        name: "Reaction gate driver",
        element: "anemo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "reaction-driver",
      swapFrames: 1,
      abilities: [
        {
          id: `reaction-gate-${scenarioId}`,
          actorId: "reaction-driver",
          name: `Reaction gate ${scenarioId}`,
          kind: "skill",
          cancelFrame: actionEndFrame,
          animationEndFrame: actionEndFrame,
          cooldownFrames: 0,
          hits: scenario.hits
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "reaction-driver",
          abilityId: `reaction-gate-${scenarioId}`,
          atFrame: 0
        }
      ]
    }
  };
}

function observedReactions(
  result: SimulationResult
): Set<ReactionType> {
  const observed = new Set<ReactionType>();
  for (const event of result.damageEvents) {
    if (event.reaction !== "none") {
      observed.add(event.reaction);
    }
    for (const reaction of event.reactionAudit.reactions) {
      if (reaction !== "none") {
        observed.add(reaction);
      }
    }
  }
  return observed;
}

function makeSameFrameBoundaryConfig(
  kind: "frozen" | "quicken"
): {
  config: SimConfig;
  boundaryFrame: 176 | 600;
  incomingHitId: string;
  expectedTransition: "frozen-expiry" | "quicken-expiry";
} {
  const base = makeConfig();
  const frozen = kind === "frozen";
  const boundaryFrame = frozen ? 176 : 600;
  const incomingHitId = `${kind}-same-frame-incoming`;
  const startElement = frozen ? "hydro" : "electro";
  const incomingElement = frozen ? "pyro" : "hydro";
  const initialAura: InitialAuraApplication[] = [
    {
      element: frozen ? "cryo" : "dendro",
      gaugeUnits: 1
    }
  ];
  const config: SimConfig = {
    ...base,
    meta: {
      name: `1.38 ${kind} same-frame expiry gate`,
      version: "1.38.0",
      verificationStatus: "provisional",
      note:
        "Ordering regression vector; not official server truth."
    },
    dataVersion: "target-reactable-order-1.38-provisional",
    randomSeed: `target-reactable-order-1.38:${kind}`,
    duration: (boundaryFrame + 2) / 60,
    cycleLength: (boundaryFrame + 2) / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: `${kind} boundary target`,
          position: { x: 0, y: 0 },
          initialAura
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "boundary-driver",
        name: "Boundary driver",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "boundary-driver",
      swapFrames: 1,
      abilities: [
        {
          id: `${kind}-same-frame-boundary`,
          actorId: "boundary-driver",
          name: `${kind} same-frame boundary`,
          kind: "skill",
          cancelFrame: boundaryFrame + 1,
          animationEndFrame: boundaryFrame + 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: `${kind}-start`,
              element: startElement,
              gaugeUnits: 1
            }),
            applicationHit({
              id: incomingHitId,
              frame: boundaryFrame,
              element: incomingElement,
              gaugeUnits: 1
            })
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "boundary-driver",
          abilityId: `${kind}-same-frame-boundary`,
          atFrame: 0
        }
      ]
    }
  };
  return {
    config,
    boundaryFrame,
    incomingHitId,
    expectedTransition: frozen
      ? "frozen-expiry"
      : "quicken-expiry"
  };
}

describe("1.38 target-phase-v2 representative reaction release gate", () => {
  it.each(Object.entries(REACTION_GATE_SCENARIOS))(
    "keeps %s complete and auditable under legal-frame-v1/aura-v7",
    (scenarioId, scenario) => {
      const config = makeReactionGateConfig(
        scenarioId,
        scenario
      );
      expect(simConfigSchema.parse(config)).toEqual(config);

      const result = simulate(config, {
        energyMode: "configured",
        critMode: "noCrit",
        compatibilityMode: "legal-frame-v1",
        randomSeed: config.randomSeed
      });
      expect(result).toMatchObject({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        mechanicsStatus: "complete",
        config: {
          reactionEngine: { mode: "aura-v7" },
          targetTaskModel: { mode: "target-phase-v2" },
          timeline: { mode: "legal-frame-v1", fps: 60 }
        }
      });
      expect(result.timelineExecution?.failures).toEqual([]);
      expect(result.targetMechanicsTruncationLog).toEqual([]);
      expect(result.targetTaskPhaseLog).toEqual([]);
      expect(result.targetPhaseLog.length).toBeGreaterThan(0);
      if (process.env.DEBUG_TARGET_PHASE_GATE === scenarioId) {
        console.log(
          JSON.stringify(
            {
              phases: result.targetPhaseLog
                .map((phase, index) => ({ index, ...phase }))
                .filter(({ index }) => index >= 5),
              points: result.targetStateTimeline.points.filter(
                (point) => point.frame >= 65
              ),
              burning: result.burningStateLog.filter(
                (entry) => entry.frame >= 65
              )
            },
            null,
            2
          )
        );
      }
      expect(
        targetPhaseV2ResultReferencesSchema.parse(result)
      ).toEqual(result);

      const observed = observedReactions(result);
      expect(
        scenario.expectedReactions.filter(
          (reaction) => !observed.has(reaction)
        )
      ).toEqual([]);
      expect(
        result.damageEvents.every((event) =>
          Number.isInteger(event.displayDamage)
        )
      ).toBe(true);
    }
  );

  it.each(["frozen", "quicken"] as const)(
    "runs %s expiry before the same-target same-frame incoming hit",
    (kind) => {
      const {
        config,
        boundaryFrame,
        incomingHitId,
        expectedTransition
      } = makeSameFrameBoundaryConfig(kind);
      expect(simConfigSchema.parse(config)).toEqual(config);
      const result = simulate(config, {
        critMode: "noCrit",
        compatibilityMode: "legal-frame-v1",
        randomSeed: config.randomSeed
      });
      if (process.env.DEBUG_TARGET_PHASE_GATE === kind) {
        console.log(
          JSON.stringify(
            {
              phases: result.targetPhaseLog,
              points: result.targetStateTimeline.points,
              frozen: result.frozenStateLog,
              quicken: result.quickenStateLog
            },
            null,
            2
          )
        );
      }
      expect(
        targetPhaseV2ResultReferencesSchema.parse(result)
      ).toEqual(result);

      const boundaryPhases = result.targetPhaseLog.filter(
        (entry) =>
          entry.globalFrame === boundaryFrame &&
          entry.targetId === "enemy-0"
      );
      expect(boundaryPhases).toHaveLength(1);
      const phase = boundaryPhases[0]!;
      const transition = phase.reactableTick.transitions.find(
        (entry) => entry.kind === expectedTransition
      );
      expect(transition).toBeDefined();
      expect(transition).toMatchObject({
        stage: "reactable-tick",
        deadlineTargetFrame: boundaryFrame
      });

      const incomingEvent = result.damageEvents.find(
        (event) =>
          event.hitId === incomingHitId &&
          event.frame === boundaryFrame &&
          event.kind === "direct"
      );
      expect(incomingEvent).toBeDefined();
      expect(incomingEvent).toMatchObject({
        reaction: "none",
        reactionAudit: {
          reaction: "none",
          reactions: []
        }
      });
      expect(phase.hitResolutionLogIds).toContain(
        incomingEvent!.targetResolutionId
      );

      const incomingPoint =
        result.targetStateTimeline.points.find(
          (point) =>
            point.frame === boundaryFrame &&
            point.targetId === "enemy-0" &&
            point.cause === "direct-hit-application" &&
            point.primaryDamageEventId === incomingEvent!.id
        );
      expect(incomingPoint).toBeDefined();
      expect(
        transition!.targetStateTimelinePointId
      ).toBeLessThan(incomingPoint!.id);
      expect(incomingPoint!.auraBefore).toStrictEqual(
        phase.reactableTick.auraAfter
      );
      expect(
        result.reactionTaskLog.filter(
          (entry) => entry.frame === boundaryFrame
        )
      ).toEqual([]);
      expect(result.mechanicsStatus).toBe("complete");
      expect(result.targetMechanicsTruncationLog).toEqual([]);
    }
  );
});
