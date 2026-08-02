import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const NO_CRIT = { critMode: "noCrit" } as const;

function moveSingleActionToTimeline(
  config: SimConfig,
  initialActiveCharacterId: string
): SimConfig {
  const action = config.rotation[0];
  if (action === undefined || config.rotation.length !== 1) {
    throw new Error("test vector requires exactly one rotation action");
  }
  const hits = (action.hits ?? []).map(({ offset, ...hit }) => ({
    ...hit,
    frame: Math.round(offset * 60)
  }));

  return {
    ...config,
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId,
      swapFrames: 1,
      abilities: [
        {
          id: action.id,
          actorId: action.actorId,
          name: action.name,
          kind: "skill",
          cancelFrame: 0,
          animationEndFrame: Math.max(
            1,
            ...hits.map((hit) => hit.frame)
          ),
          cooldownFrames: 0,
          hits
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: action.actorId,
          abilityId: action.id,
          atFrame: Math.round(action.at * 60)
        }
      ]
    }
  };
}

describe("configured elemental-application ICD simulation edges", () => {
  it("consumes application ICD on a landed damage-immune hit when Aura remains allowed", () => {
    const result = simulate(
      moveSingleActionToTimeline(makeConfig({
        dataVersion: "application-icd-damage-immune-proof",
        randomSeed: "application-icd-damage-immune-proof",
        duration: 1,
        cycleLength: 1,
        enemy: {
          level: 90,
          resistance: 0.1,
          defReduction: 0,
          targets: [
            {
              id: "enemy-0",
              name: "Damage-immune application target",
              initialAura: [{ element: "hydro", gaugeUnits: 4 }]
            }
          ]
        },
        reactionEngine: { mode: "aura-v2" },
        rotation: [
          {
            id: "damage-immune-action",
            actorId: "a",
            name: "Damage immunity does not suppress Aura",
            at: 0,
            once: true,
            hits: [
              {
                id: "damage-immune-opener",
                offset: 0,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                  reason: "SCRIPTED_DAMAGE_IMMUNITY_ONLY",
                  effects: {
                    damage: "immune",
                    aura: "normal",
                    hitConfirm: "normal"
                  }
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "damage-immune-stream",
                    groupId: "default"
                  }
                }
              },
              {
                id: "damage-normal-followup",
                offset: 1 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed"
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "damage-immune-stream",
                    groupId: "default"
                  }
                }
              }
            ]
          }
        ]
      }), "a"),
      NO_CRIT
    );

    expect(
      result.elementalApplicationIcdLog.map((entry) => ({
        hitId: entry.hitId,
        targetId: entry.targetId,
        kind: entry.decision.kind,
        allowed: entry.decision.allowed,
        applicationMultiplier:
          entry.decision.applicationMultiplier,
        hitIndex:
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.hitIndex
            : null,
        effectiveGaugeUnits: entry.effectiveGaugeUnits
      }))
    ).toEqual([
      {
        hitId: "damage-immune-opener",
        targetId: "enemy-0",
        kind: "fixed-gcsim",
        allowed: true,
        applicationMultiplier: 1,
        hitIndex: 0,
        effectiveGaugeUnits: 1
      },
      {
        hitId: "damage-normal-followup",
        targetId: "enemy-0",
        kind: "fixed-gcsim",
        allowed: false,
        applicationMultiplier: 0,
        hitIndex: 1,
        effectiveGaugeUnits: 0
      }
    ]);
    expect(result.damageEvents[0]).toMatchObject({
      hitId: "damage-immune-opener",
      targetDamagePolicy: "immune",
      targetDamageMultiplier: 0,
      finalDamage: 0,
      reactionAudit: {
        icdAllowed: true,
        applicationGaugeUnits: 1
      }
    });
    expect(result.damageEvents[1]).toMatchObject({
      hitId: "damage-normal-followup",
      targetDamagePolicy: "normal",
      targetDamageMultiplier: 1,
      reactionAudit: {
        icdAllowed: false,
        applicationGaugeUnits: 0
      }
    });
  });

  it("consumes application ICD even when the ordinary direct-damage group resolves to zero", () => {
    const result = simulate(
      moveSingleActionToTimeline(makeConfig({
        dataVersion: "application-icd-zero-damage-group-proof",
        randomSeed: "application-icd-zero-damage-group-proof",
        duration: 1,
        cycleLength: 1,
        reactionEngine: { mode: "aura-v2" },
        rotation: [
          {
            id: "zero-damage-group-action",
            actorId: "a",
            name: "Zero direct-damage group still applies Aura",
            at: 0,
            once: true,
            hits: [
              {
                id: "damage-group-opener",
                offset: 0,
                scaling: 1,
                element: "pyro",
                directDamageGroup: {
                  icdTag: "zero-damage-group-stream",
                  icdGroup: "pole-extra-attack"
                }
              },
              {
                id: "damage-group-zero-application-opener",
                offset: 1 / 60,
                scaling: 1,
                element: "pyro",
                directDamageGroup: {
                  icdTag: "zero-damage-group-stream",
                  icdGroup: "pole-extra-attack"
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "independent-application-stream",
                    groupId: "default"
                  }
                }
              },
              {
                id: "application-followup",
                offset: 2 / 60,
                scaling: 1,
                element: "pyro",
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "independent-application-stream",
                    groupId: "default"
                  }
                }
              }
            ]
          }
        ]
      }), "a"),
      NO_CRIT
    );

    const zeroDamageGroup = result.directDamageGroupLog.find(
      (entry) =>
        entry.hitId === "damage-group-zero-application-opener"
    );
    expect(zeroDamageGroup).toMatchObject({
      evaluation: "evaluated",
      sequenceMultiplier: 0,
      effectiveMultiplier: 0
    });
    expect(
      result.damageEvents.find(
        (entry) =>
          entry.hitId === "damage-group-zero-application-opener"
      )
    ).toMatchObject({
      groupMultiplier: 0,
      finalDamage: 0
    });
    expect(
      result.elementalApplicationIcdLog.map((entry) => ({
        hitId: entry.hitId,
        allowed: entry.decision.allowed,
        applicationMultiplier:
          entry.decision.applicationMultiplier,
        hitIndex:
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.hitIndex
            : null,
        effectiveGaugeUnits: entry.effectiveGaugeUnits
      }))
    ).toEqual([
      {
        hitId: "damage-group-zero-application-opener",
        allowed: true,
        applicationMultiplier: 1,
        hitIndex: 0,
        effectiveGaugeUnits: 1
      },
      {
        hitId: "application-followup",
        allowed: false,
        applicationMultiplier: 0,
        hitIndex: 1,
        effectiveGaugeUnits: 0
      }
    ]);
  });

  it("keys ICD by the source actor rather than shared scaling and credit owners", () => {
    const result = simulate(
      makeConfig({
        dataVersion: "application-icd-source-owner-proof",
        randomSeed: "application-icd-source-owner-proof",
        duration: 1,
        cycleLength: 1,
        characters: [
          {
            id: "source-a",
            name: "Source A",
            element: "pyro",
            color: "#ff0000",
            level: 90,
            energyMax: 60,
            initialEnergy: 0,
            stats: { ...neutralStats }
          },
          {
            id: "source-b",
            name: "Source B",
            element: "pyro",
            color: "#ff6600",
            level: 90,
            energyMax: 60,
            initialEnergy: 0,
            stats: { ...neutralStats }
          },
          {
            id: "scaling-proxy",
            name: "Scaling proxy",
            element: "pyro",
            color: "#aa0000",
            level: 90,
            energyMax: 60,
            initialEnergy: 0,
            stats: { ...neutralStats, baseAtk: 1500 }
          },
          {
            id: "credit-proxy",
            name: "Credit proxy",
            element: "pyro",
            color: "#880000",
            level: 90,
            energyMax: 60,
            initialEnergy: 0,
            stats: { ...neutralStats }
          }
        ],
        reactionEngine: { mode: "aura-v2" },
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "source-a",
          swapFrames: 1,
          abilities: [
          {
            id: "source-a-action",
            actorId: "source-a",
            name: "Source A application",
            kind: "skill",
            cancelFrame: 0,
            animationEndFrame: 4,
            cooldownFrames: 0,
            hits: [
              {
                id: "source-a-open",
                frame: 0,
                scaling: 1,
                element: "pyro",
                scalingOwnerId: "scaling-proxy",
                creditId: "credit-proxy",
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-owner-stream",
                    groupId: "default"
                  }
                }
              },
              {
                id: "source-a-second",
                frame: 4,
                scaling: 1,
                element: "pyro",
                scalingOwnerId: "scaling-proxy",
                creditId: "credit-proxy",
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-owner-stream",
                    groupId: "default"
                  }
                }
              }
            ]
          },
          {
            id: "source-b-action",
            actorId: "source-b",
            name: "Source B application",
            kind: "skill",
            cancelFrame: 0,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "source-b-open",
                frame: 0,
                scaling: 1,
                element: "pyro",
                scalingOwnerId: "scaling-proxy",
                creditId: "credit-proxy",
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-owner-stream",
                    groupId: "default"
                  }
                }
              }
            ]
          }
          ],
          commands: [
            {
              type: "skill",
              actorId: "source-a",
              abilityId: "source-a-action",
              atFrame: 0
            },
            {
              type: "swap",
              characterId: "source-b",
              atFrame: 1
            },
            {
              type: "skill",
              actorId: "source-b",
              abilityId: "source-b-action",
              atFrame: 2
            }
          ]
        }
      }),
      NO_CRIT
    );

    expect(
      result.elementalApplicationIcdLog.map((entry) => ({
        frame: entry.frame,
        hitId: entry.hitId,
        sourceActorId: entry.sourceActorId,
        applicationMultiplier:
          entry.decision.applicationMultiplier,
        hitIndex:
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.hitIndex
            : null
      }))
    ).toEqual([
      {
        frame: 0,
        hitId: "source-a-open",
        sourceActorId: "source-a",
        applicationMultiplier: 1,
        hitIndex: 0
      },
      {
        frame: 2,
        hitId: "source-b-open",
        sourceActorId: "source-b",
        applicationMultiplier: 1,
        hitIndex: 0
      },
      {
        frame: 4,
        hitId: "source-a-second",
        sourceActorId: "source-a",
        applicationMultiplier: 0,
        hitIndex: 1
      }
    ]);
    expect(
      result.damageEvents.map((entry) => ({
        hitId: entry.hitId,
        sourceActorId: entry.sourceActorId,
        scalingOwnerId: entry.scalingOwnerId,
        creditOwnerId: entry.creditOwnerId
      }))
    ).toEqual([
      {
        hitId: "source-a-open",
        sourceActorId: "source-a",
        scalingOwnerId: "scaling-proxy",
        creditOwnerId: "credit-proxy"
      },
      {
        hitId: "source-b-open",
        sourceActorId: "source-b",
        scalingOwnerId: "scaling-proxy",
        creditOwnerId: "credit-proxy"
      },
      {
        hitId: "source-a-second",
        sourceActorId: "source-a",
        scalingOwnerId: "scaling-proxy",
        creditOwnerId: "credit-proxy"
      }
    ]);
  });

  it("isolates same-frame fanout state per target and preserves authored log order", () => {
    const config = makeConfig({
      dataVersion: "application-icd-same-frame-fanout-proof",
      randomSeed: "application-icd-same-frame-fanout-proof",
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          { id: "enemy-0", name: "Fanout target A" },
          { id: "enemy-b", name: "Fanout target B" }
        ]
      },
      reactionEngine: { mode: "aura-v2" },
      rotation: [
        {
          id: "same-frame-fanout-action",
          actorId: "a",
          name: "Same-frame fanout",
          at: 0,
          once: true,
          hits: [
            {
              id: "fanout-first",
              offset: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                mode: "fanout",
                targets: [
                  { targetId: "enemy-b", outcome: "landed" },
                  { targetId: "enemy-0", outcome: "landed" }
                ]
              },
              application: {
                gaugeUnits: 1,
                icd: {
                  mode: "fixed-gcsim-application-v1",
                  icdTag: "same-frame-fanout-stream",
                  groupId: "default"
                }
              }
            },
            {
              id: "fanout-second",
              offset: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                mode: "fanout",
                targets: [
                  { targetId: "enemy-0", outcome: "landed" },
                  { targetId: "enemy-b", outcome: "landed" }
                ]
              },
              application: {
                gaugeUnits: 1,
                icd: {
                  mode: "fixed-gcsim-application-v1",
                  icdTag: "same-frame-fanout-stream",
                  groupId: "default"
                }
              }
            }
          ]
        }
      ]
    });
    const timelineConfig = moveSingleActionToTimeline(config, "a");
    const first = simulate(timelineConfig, NO_CRIT);
    const repeated = simulate(timelineConfig, NO_CRIT);
    const project = (result: typeof first) =>
      result.elementalApplicationIcdLog.map((entry) => ({
        id: entry.id,
        frame: entry.frame,
        hitId: entry.hitId,
        targetId: entry.targetId,
        targetIndex:
          result.hitResolutionLog[entry.hitResolutionLogId]!
            .targetIndex,
        hitResolutionLogId: entry.hitResolutionLogId,
        damageEventId: entry.damageEventId,
        applicationMultiplier:
          entry.decision.applicationMultiplier,
        hitIndex:
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.hitIndex
            : null
      }));

    expect(project(first)).toEqual([
      {
        id: 0,
        frame: 0,
        hitId: "fanout-first",
        targetId: "enemy-b",
        targetIndex: 0,
        hitResolutionLogId: 0,
        damageEventId: 0,
        applicationMultiplier: 1,
        hitIndex: 0
      },
      {
        id: 1,
        frame: 0,
        hitId: "fanout-first",
        targetId: "enemy-0",
        targetIndex: 1,
        hitResolutionLogId: 1,
        damageEventId: 1,
        applicationMultiplier: 1,
        hitIndex: 0
      },
      {
        id: 2,
        frame: 0,
        hitId: "fanout-second",
        targetId: "enemy-0",
        targetIndex: 0,
        hitResolutionLogId: 2,
        damageEventId: 2,
        applicationMultiplier: 0,
        hitIndex: 1
      },
      {
        id: 3,
        frame: 0,
        hitId: "fanout-second",
        targetId: "enemy-b",
        targetIndex: 1,
        hitResolutionLogId: 3,
        damageEventId: 3,
        applicationMultiplier: 0,
        hitIndex: 1
      }
    ]);
    expect(project(repeated)).toEqual(project(first));
    expect(repeated.reproducibilityKey).toBe(
      first.reproducibilityKey
    );
  });
});
