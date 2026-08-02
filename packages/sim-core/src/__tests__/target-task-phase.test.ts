import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeTargetTaskPhaseConfig(
  mode: SimConfig["targetTaskModel"]["mode"],
  options: { hitlag?: boolean; multiTarget?: boolean } = {}
): SimConfig {
  const base = makeConfig();
  const incomingFrame = options.hitlag === true ? 20 : 15;
  const targets: NonNullable<SimConfig["enemy"]["targets"]> = [
    {
      id: "enemy-0",
      name: "Target phase boundary",
      position: { x: 0, y: 0 },
      initialAura: [
        {
          element: "dendro",
          gaugeUnits: 7 / 60
        }
      ]
    }
  ];
  if (options.multiTarget === true) {
    targets.push({
      id: "enemy-1",
      name: "Second target phase boundary",
      position: { x: 0.5, y: 0 },
      initialAura: [
        {
          element: "dendro",
          gaugeUnits: 7 / 60
        }
      ]
    });
  }
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Target phase tester",
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
    targetClockModel:
      options.hitlag === true
        ? { mode: "target-local-hitlag-v1" }
        : { mode: "disabled" },
    targetTaskModel: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 12,
      abilities: [
        {
          id: "phase-sequence",
          actorId: "tester",
          name: "Target phase sequence",
          kind: "skill",
          cancelFrame: incomingFrame + 1,
          animationEndFrame: incomingFrame + 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "burning-start",
              label: "Burning start",
              frame: 0,
              scaling: 1,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius:
                  options.multiTarget === true ? 1 : 0.1
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              },
              ...(options.hitlag === true
                ? {
                    targetHitlag: {
                      haltFrames: 5,
                      factor: 0
                    }
                  }
                : {})
            },
            {
              id: "same-frame-incoming",
              label: "Same-frame incoming hit",
              frame: incomingFrame,
              scaling: 1,
              element: "physical",
              ...(options.multiTarget === true
                ? {
                    geometry: {
                      kind: "circle" as const,
                      coordinateSpace: "world" as const,
                      origin: { x: 0, y: 0 },
                      radius: 1
                    }
                  }
                : {
                    targeting: {
                      targetId: "enemy-0",
                      outcome: "landed" as const
                    }
                  })
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: "phase-sequence",
          atFrame: 0
        }
      ]
    }
  };
}

function burningDamageAtFrame(
  result: ReturnType<typeof simulate>,
  frame: number
) {
  return result.damageEvents.filter(
    (event) =>
      event.frame === frame &&
      event.kind === "transformative-reaction" &&
      event.reaction === "burning"
  );
}

function makeNoAuraTargetTaskConfig(
  outcome: "landed" | "miss"
): SimConfig {
  const config = makeTargetTaskPhaseConfig("target-phase-v1");
  delete config.reactionEngine;
  config.enemy.targets = config.enemy.targets!.map(
    ({ initialAura: _initialAura, ...target }) => target
  );
  const incomingHit =
    config.timeline?.abilities[0]?.hits?.[1];
  if (incomingHit === undefined) {
    throw new Error("missing no-Aura incoming hit fixture");
  }
  incomingHit.targeting = {
    targetId: "enemy-0",
    outcome,
    ...(outcome === "miss"
      ? { reason: "scripted no-Aura miss fixture" }
      : {})
  };
  return config;
}

describe("target-phase-v1 target-owned task ordering", () => {
  it("runs the Burning callback before current-frame decay and incoming damage", () => {
    const legacy = simulate(
      makeTargetTaskPhaseConfig("legacy-event-heap-v1")
    );
    const phased = simulate(
      makeTargetTaskPhaseConfig("target-phase-v1")
    );

    expect(burningDamageAtFrame(legacy, 15)).toEqual([]);
    const [burningDamage] = burningDamageAtFrame(phased, 15);
    expect(burningDamage).toBeDefined();
    expect(legacy.totalDamage).toBe(900);
    expect(phased.totalDamage).toBe(1473.5740660714287);
    expect(phased.totalDamage - legacy.totalDamage).toBe(
      573.5740660714287
    );
    expect(burningDamage).toMatchObject({
      sourceActorId: "tester",
      creditOwnerId: "tester",
      finalDamage: 573.5740660714285,
      displayDamage: 574
    });

    const tick = phased.burningStateLog.find(
      (entry) =>
        entry.frame === 15 &&
        entry.operation === "tick"
    );
    const incoming = phased.damageEvents.find(
      (event) =>
        event.frame === 15 &&
        event.kind === "direct" &&
        event.element === "physical"
    );
    expect(tick).toMatchObject({
      tickIndex: 1,
      eventPriority: 0.5,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12)
    });
    expect(incoming).toBeDefined();
    expect(tick!.eventPriority).toBeLessThan(
      incoming!.eventPriority
    );
    expect(incoming!.eventPriority).toBeLessThan(
      burningDamage!.eventPriority
    );

    const phasePoint = phased.targetStateTimeline.points.find(
      (point) =>
        point.frame === 15 &&
        point.targetId === "enemy-0" &&
        point.cause === "burning-tick"
    );
    expect(phasePoint).toMatchObject({
      eventType: "burningTick",
      eventPriority: 0.5
    });
    expect(phasePoint?.auraBefore).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "burningFuel",
          gaugeUnits: expect.closeTo(1 / 150, 12)
        })
      ])
    );
    expect(phasePoint?.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
  });

  it("fails closed if target-phase-v1 is explicitly paired with legacy runtime time semantics", () => {
    expect(() =>
      simulate(makeTargetTaskPhaseConfig("target-phase-v1"), {
        compatibilityMode: "legacy-v0.1"
      })
    ).toThrow(
      /target-phase-v1 requires compatibilityMode legal-frame-v1/
    );
  });

  it("records an authoritative incoming tuple for no-Aura landed and missed hits", () => {
    for (const outcome of ["landed", "miss"] as const) {
      const result = simulate(
        makeNoAuraTargetTaskConfig(outcome)
      );
      const phase = result.targetTaskPhaseLog.find(
        (entry) =>
          entry.globalFrame === 15 &&
          entry.targetId === "enemy-0"
      );
      expect(phase).toMatchObject({
        wakeKind: "incoming",
        eventType: "hit",
        eventPriority: 3
      });
      const wakeHit =
        result.hitResolutionLog[
          phase!.hitResolutionLogIds[0]!
        ];
      expect(wakeHit).toMatchObject({
        landed: outcome === "landed",
        eventPriority: phase!.eventPriority,
        eventSequence: phase!.eventSequence
      });
      expect(wakeHit!.intraEventSequence).toBeGreaterThan(
        phase!.intraEventSequence
      );
    }
  });

  it("reprojects a stale Burning wake before Aura decay when target Hitlag pauses the target clock", () => {
    const result = simulate(
      makeTargetTaskPhaseConfig("target-phase-v1", {
        hitlag: true
      })
    );
    const tick = result.burningStateLog.find(
      (entry) =>
        entry.operation === "tick" &&
        entry.tickIndex === 1
    );
    const [burningDamage] = burningDamageAtFrame(result, 20);

    expect(tick).toMatchObject({
      frame: 20,
      targetFrame: 15,
      tickIndex: 1,
      eventPriority: 0.5,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12)
    });
    expect(burningDamage).toBeDefined();
    expect(
      result.burningStateLog.some(
        (entry) =>
          entry.frame === 15 &&
          (entry.operation === "tick" ||
            entry.operation === "stop")
      )
    ).toBe(false);
    expect(result.targetClockAudit).toMatchObject({
      mode: "target-local-hitlag-v1",
      targets: [
        expect.objectContaining({
          targetId: "enemy-0",
          totalExtensionFrames: 5
        })
      ]
    });
  });

  it("drains target-owned callbacks in target order before any same-frame incoming or Burning damage", () => {
    const result = simulate(
      makeTargetTaskPhaseConfig("target-phase-v1", {
        multiTarget: true
      })
    );
    const ticks = result.burningStateLog.filter(
      (entry) =>
        entry.frame === 15 &&
        entry.operation === "tick"
    );
    const incoming = result.damageEvents.filter(
      (event) =>
        event.frame === 15 &&
        event.kind === "direct" &&
        event.element === "physical"
    );
    const burning = burningDamageAtFrame(result, 15);

    expect(
      ticks.map((entry) => ({
        targetId: entry.targetId,
        eventPriority: entry.eventPriority
      }))
    ).toEqual([
      { targetId: "enemy-0", eventPriority: 0.5 },
      {
        targetId: "enemy-1",
        eventPriority: 0.5 + 0.5 / 3
      }
    ]);
    expect(incoming).toHaveLength(2);
    expect(burning).toHaveLength(4);
    expect(
      Math.max(...ticks.map((entry) => entry.eventPriority))
    ).toBeLessThan(
      Math.min(...incoming.map((event) => event.eventPriority))
    );
    expect(
      Math.max(...incoming.map((event) => event.eventPriority))
    ).toBeLessThan(
      Math.min(...burning.map((event) => event.eventPriority))
    );
    expect(
      burning.map((event) => event.targetId)
    ).toEqual([
      "enemy-0",
      "enemy-1",
      "enemy-0",
      "enemy-1"
    ]);
  });
});
