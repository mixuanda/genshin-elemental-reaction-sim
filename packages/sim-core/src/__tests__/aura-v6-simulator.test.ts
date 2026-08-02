import {
  playerDamageResultReferencesSchema,
  type AuraReactionEngineConfig,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeOrderedElectroConfig(
  mode: AuraReactionEngineConfig["mode"]
): SimConfig {
  const base = makeConfig();
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
          name: "Pyro + Cryo target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "pyro", gaugeUnits: 1 },
            { element: "cryo", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
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
    reactionEngine: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "ordered-electro",
          actorId: "electro",
          name: "Ordered Electro",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "strong-electro",
              label: "Strong Electro",
              frame: 0,
              scaling: 1,
              element: "electro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1
              },
              application: {
                gaugeUnits: 2,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "ordered-electro",
          atFrame: 0
        }
      ]
    }
  };
}

function makeFrozenSuperconductConfig(): SimConfig {
  const base = makeConfig();
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
          name: "Frozen target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
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
    reactionEngine: { mode: "aura-v6" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "freeze-then-superconduct",
          actorId: "electro",
          name: "Freeze then Superconduct",
          kind: "skill",
          cancelFrame: 3,
          animationEndFrame: 3,
          cooldownFrames: 0,
          hits: [
            {
              id: "cryo-freeze-setup",
              label: "Cryo Freeze setup",
              frame: 0,
              scaling: 0,
              element: "cryo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              }
            },
            {
              id: "frozen-superconduct",
              label: "Frozen Superconduct",
              frame: 2,
              scaling: 1,
              element: "electro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1
              },
              application: {
                gaugeUnits: 2,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "freeze-then-superconduct",
          atFrame: 0
        }
      ]
    }
  };
}

function makeFrozenNoopConsumptionConfig(): SimConfig {
  const config = structuredClone(makeFrozenSuperconductConfig());
  const target = config.enemy.targets?.[0];
  const hits =
    config.timeline?.mode === "legal-frame-v1"
      ? config.timeline.abilities[0]?.hits
      : undefined;
  if (target === undefined || hits?.[0] === undefined || hits[1] === undefined) {
    throw new Error("Frozen no-op fixture lost its target or hits.");
  }
  target.initialAura = [{ element: "cryo", gaugeUnits: 2 }];
  hits[0] = {
    ...hits[0],
    id: "hydro-freeze-with-cryo-remnant",
    label: "Hydro Freeze with Cryo remnant",
    element: "hydro",
    application: {
      gaugeUnits: 0.5,
      icd: { mode: "no-icd-v1" }
    }
  };
  hits[1] = {
    ...hits[1],
    id: "superconduct-without-frozen-consumption",
    label: "Superconduct without Frozen consumption",
    frame: 0,
    application: {
      gaugeUnits: 1.1,
      icd: { mode: "no-icd-v1" }
    }
  };
  return config;
}

describe("aura-v6 simulator ordered Electro integration", () => {
  it("emits auditable Overload then Superconduct damage from one hit", () => {
    const result = simulate(makeOrderedElectroConfig("aura-v6"), {
      critMode: "noCrit"
    });
    expect(
      playerDamageResultReferencesSchema.parse(result)
    ).toEqual(result);
    const directEvent = result.damageEvents.find(
      (event) => event.kind === "direct"
    );

    expect(directEvent).toBeDefined();
    const forgedProjection = structuredClone(result);
    const forgedDirectEvent = forgedProjection.damageEvents.find(
      (event) => event.kind === "direct"
    );
    forgedDirectEvent!.reactionAudit.transformativeReactions =
      [
        ...forgedDirectEvent!.reactionAudit
          .transformativeReactions!
      ].reverse();
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        forgedProjection
      )
    ).toThrow(/singular transformative reaction must equal/);
    const forgedReactionOrder = structuredClone(result);
    const forgedOrderEvent = forgedReactionOrder.damageEvents.find(
      (event) => event.kind === "direct"
    );
    forgedOrderEvent!.reactionAudit.reactions = [
      "superconduct",
      "overload"
    ];
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        forgedReactionOrder
      )
    ).toThrow(/in-order subsequence/);
    expect(directEvent!.reactionAudit.reactions).toEqual([
      "overload",
      "superconduct"
    ]);
    expect(
      directEvent!.reactionAudit.transformativeReactions?.map(
        ({ reaction, damageElement, damageFrame, scheduled }) => ({
          reaction,
          damageElement,
          damageFrame,
          scheduled
        })
      )
    ).toEqual([
      {
        reaction: "overload",
        damageElement: "pyro",
        damageFrame: 1,
        scheduled: true
      },
      {
        reaction: "superconduct",
        damageElement: "cryo",
        damageFrame: 1,
        scheduled: true
      }
    ]);
    expect(directEvent!.reactionAudit.transformativeReaction).toEqual(
      directEvent!.reactionAudit.transformativeReactions?.[0]
    );
    expect(directEvent!.reactionAudit.unsupportedReactions).toEqual([]);
    expect(directEvent!.reactionAudit.mechanicsTruncation).toBeNull();
    expect(result.mechanicsStatus).toBe("complete");
    expect(result.targetMechanicsTruncationLog).toEqual([]);

    expect(
      result.reactionDamageLog.map(
        ({
          id,
          reaction,
          triggerDamageEventId,
          triggerFrame,
          damageFrame,
          scheduled,
          withinSimulation,
          damageEventIds
        }) => ({
          id,
          reaction,
          triggerDamageEventId,
          triggerFrame,
          damageFrame,
          scheduled,
          withinSimulation,
          damageEventIds
        })
      )
    ).toEqual([
      {
        id: 0,
        reaction: "overload",
        triggerDamageEventId: directEvent!.id,
        triggerFrame: 0,
        damageFrame: 1,
        scheduled: true,
        withinSimulation: true,
        damageEventIds: [1]
      },
      {
        id: 1,
        reaction: "superconduct",
        triggerDamageEventId: directEvent!.id,
        triggerFrame: 0,
        damageFrame: 1,
        scheduled: true,
        withinSimulation: true,
        damageEventIds: [2]
      }
    ]);

    const reactionEvents = result.damageEvents.filter(
      (event) => event.kind === "transformative-reaction"
    );
    expect(
      reactionEvents.map(
        ({
          id,
          frame,
          element,
          reaction,
          parentDamageEventId,
          targetResolutionId
        }) => ({
          id,
          frame,
          element,
          reaction,
          parentDamageEventId,
          targetResolutionId
        })
      )
    ).toEqual([
      {
        id: 1,
        frame: 1,
        element: "pyro",
        reaction: "overload",
        parentDamageEventId: directEvent!.id,
        targetResolutionId: 1
      },
      {
        id: 2,
        frame: 1,
        element: "cryo",
        reaction: "superconduct",
        parentDamageEventId: directEvent!.id,
        targetResolutionId: 2
      }
    ]);

    for (const logEntry of result.reactionDamageLog) {
      const triggerEvent = result.damageEvents.find(
        (event) => event.id === logEntry.triggerDamageEventId
      );
      expect(triggerEvent).toBe(directEvent);
      for (const damageEventId of logEntry.damageEventIds) {
        const damageEvent = result.damageEvents.find(
          (event) => event.id === damageEventId
        );
        expect(damageEvent).toBeDefined();
        expect(damageEvent!.reaction).toBe(logEntry.reaction);
        expect(damageEvent!.parentDamageEventId).toBe(
          logEntry.triggerDamageEventId
        );
        expect(
          result.hitResolutionLog.find(
            (entry) => entry.id === damageEvent!.targetResolutionId
          )?.damageEventId
        ).toBe(damageEventId);
      }
    }
  });

  it("keeps aura-v5 fail-closed for the same unresolved multi-reaction", () => {
    const result = simulate(makeOrderedElectroConfig("aura-v5"), {
      critMode: "noCrit"
    });
    const directEvent = result.damageEvents.find(
      (event) => event.kind === "direct"
    );

    expect(directEvent).toBeDefined();
    expect(directEvent!.reactionAudit.reactions).toEqual(["overload"]);
    expect(directEvent!.reactionAudit.transformativeReactions).toBeUndefined();
    expect(directEvent!.reactionAudit.unsupportedReactions).toEqual([
      "non-pyro-multi-reaction-order"
    ]);
    expect(directEvent!.reactionAudit.mechanicsTruncation).toMatchObject({
      startedAtFrame: 0,
      unsupportedReactions: ["non-pyro-multi-reaction-order"]
    });
    expect(result.mechanicsStatus).toBe("partial");
    expect(result.targetMechanicsTruncationLog).toHaveLength(1);
    expect(
      result.damageEvents.filter(
        (event) => event.kind === "transformative-reaction"
      )
    ).toEqual([]);
  });

  it("records Frozen consumption as Superconduct in the state log", () => {
    const result = simulate(makeFrozenSuperconductConfig(), {
      critMode: "noCrit"
    });
    const setupEvent = result.damageEvents.find(
      (event) => event.hitId === "cryo-freeze-setup"
    );
    const electroEvent = result.damageEvents.find(
      (event) => event.hitId === "frozen-superconduct"
    );

    expect(setupEvent?.reactionAudit.reactions).toEqual(["freeze"]);
    expect(electroEvent?.reactionAudit.reactions).toEqual([
      "superconduct"
    ]);
    expect(electroEvent?.reactionAudit.frozenReaction).toMatchObject({
      operation: "consume",
      frozenGaugeAfter: 0
    });
    expect(result.frozenStateLog).toMatchObject([
      {
        reaction: "freeze",
        operation: "start",
        frame: 0,
        triggerDamageEventId: setupEvent!.id,
        reason: null
      },
      {
        reaction: "superconduct",
        operation: "consume",
        frame: 2,
        triggerDamageEventId: electroEvent!.id,
        reason: "FROZEN_CONSUMED_BY_SUPERCONDUCT"
      }
    ]);
    expect(result.targetMechanicsTruncationLog).toEqual([]);
    expect(result.mechanicsStatus).toBe("complete");
  });

  it("does not invent a Frozen state mutation when Cryo spends the full Electro budget", () => {
    const result = simulate(makeFrozenNoopConsumptionConfig(), {
      critMode: "noCrit"
    });
    const electroEvent = result.damageEvents.find(
      (event) =>
        event.hitId ===
        "superconduct-without-frozen-consumption"
    );

    expect(electroEvent?.reactionAudit.reactions).toEqual([
      "superconduct"
    ]);
    expect(electroEvent?.reactionAudit.frozenReaction).toBeNull();
    expect(
      result.frozenStateLog.filter(
        (entry) => entry.operation === "consume"
      )
    ).toEqual([]);
    expect(
      electroEvent?.reactionAudit.auraAfter?.find(
        (entry) => entry.element === "frozen"
      )?.gaugeUnits
    ).toBe(
      electroEvent?.reactionAudit.auraBefore?.find(
        (entry) => entry.element === "frozen"
      )?.gaugeUnits
    );
  });
});
