import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type AbilityDefinition,
  type CharacterProfile,
  type Element,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

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
      baseAtk: 0
    }
  };
}

function application(_id: string, gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

function ability(
  actorId: string,
  element: Element,
  gaugeUnits = 1
): AbilityDefinition {
  const id = `${actorId}-burning-integrity-skill`;
  return {
    id,
    actorId,
    name: id,
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: `${id}-hit`,
        label: `${id} hit`,
        frame: 0,
        scaling: 0,
        element,
        geometry: SAME_TARGET_GEOMETRY,
        application: application(`${id}-application`, gaugeUnits)
      }
    ]
  };
}

function makeActiveBurningConfig(duration = 1.1): SimConfig {
  const base = makeConfig();
  const pyro = character(base.characters[0]!, "pyro-owner", "pyro");
  const pyroAbility = ability(pyro.id, "pyro");

  return {
    ...base,
    dataVersion: "burning-result-integrity-edgecases",
    randomSeed: "burning-result-integrity-edgecases",
    meta: {
      name: "Burning result integrity edge cases",
      version: "1.44.0",
      verificationStatus: "provisional"
    },
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Burning target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [{ element: "dendro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [pyro],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: pyro.id,
      swapFrames: 1,
      abilities: [pyroAbility],
      commands: [
        {
          type: "skill",
          actorId: pyro.id,
          abilityId: pyroAbility.id,
          atFrame: 0
        }
      ]
    }
  };
}

function makeSameHitHitlagBurningConfig(): SimConfig {
  const config = makeActiveBurningConfig(2.2);
  const hit = config.timeline?.abilities[0]?.hits?.[0];
  if (hit === undefined) {
    throw new Error("Burning fixture must expose its Pyro hit.");
  }
  config.targetClockModel = {
    mode: "target-local-hitlag-v1"
  };
  hit.targetHitlag = {
    haltFrames: 3,
    factor: 0
  };
  return config;
}

function makeTargetClockTruncationStopConfig(): SimConfig {
  const config = makeSameTriggerTruncationStopConfig();
  const pyroHit = config.timeline?.abilities[0]?.hits?.[0];
  if (pyroHit === undefined) {
    throw new Error("Truncation fixture must expose its Pyro hit.");
  }
  config.randomSeed =
    "burning-result-integrity-target-clock-truncation-stop";
  config.targetClockModel = {
    mode: "target-local-hitlag-v1"
  };
  pyroHit.targetHitlag = {
    haltFrames: 3,
    factor: 0
  };
  return config;
}

function makeCrossActorStopConfig(): SimConfig {
  const base = makeConfig();
  const pyro = character(base.characters[0]!, "pyro-owner", "pyro");
  const cryo = character(base.characters[0]!, "cryo-stopper", "cryo");
  const pyroAbility = ability(pyro.id, "pyro");
  const cryoAbility = ability(cryo.id, "cryo", 10);

  return {
    ...makeActiveBurningConfig(1),
    randomSeed: "burning-result-integrity-cross-actor-stop",
    characters: [pyro, cryo],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: pyro.id,
      swapFrames: 1,
      abilities: [pyroAbility, cryoAbility],
      commands: [
        {
          type: "skill",
          actorId: pyro.id,
          abilityId: pyroAbility.id,
          atFrame: 0
        },
        {
          type: "swap",
          characterId: cryo.id,
          atFrame: 1
        },
        {
          type: "skill",
          actorId: cryo.id,
          abilityId: cryoAbility.id,
          atFrame: 2
        }
      ]
    }
  };
}

function makeSameTriggerTruncationStopConfig(): SimConfig {
  const config = makeActiveBurningConfig(1);
  config.reactionEngine = { mode: "aura-v4" };
  const burningAbility = config.timeline?.abilities[0];
  const pyroHit = burningAbility?.hits?.[0];
  if (burningAbility === undefined || pyroHit === undefined) {
    throw new Error("Burning fixture must expose its Pyro hit.");
  }
  burningAbility.cancelFrame = 2;
  burningAbility.animationEndFrame = 2;
  burningAbility.hits = [
    pyroHit,
    {
      ...structuredClone(pyroHit),
      id: "hydro-truncation-hit",
      label: "Hydro truncation hit",
      frame: 1,
      element: "hydro",
      application: application("hydro-truncation-hit", 2)
    }
  ];
  return config;
}

function makeBlockedBurningStartConfig(): SimConfig {
  const config = makeActiveBurningConfig(1);
  config.reactionEngine = { mode: "aura-v4" };
  const target = config.enemy.targets?.[0];
  const burningAbility = config.timeline?.abilities[0];
  const hit = burningAbility?.hits?.[0];
  if (target === undefined || hit === undefined) {
    throw new Error("Burning fixture must expose its target and hit.");
  }
  target.initialAura = [
    { element: "pyro", gaugeUnits: 1 },
    { element: "hydro", gaugeUnits: 1 }
  ];
  hit.id = "blocked-burning-start-hit";
  hit.label = "Blocked Burning start hit";
  hit.element = "dendro";
  hit.application = application("blocked-burning-start-hit");
  return config;
}

function makeLateTargetClockBurningConfig(): SimConfig {
  const config = makeActiveBurningConfig(1);
  const burningAbility = config.timeline?.abilities[0];
  const pyroHit = burningAbility?.hits?.[0];
  if (burningAbility === undefined || pyroHit === undefined) {
    throw new Error("Burning fixture must expose its Pyro hit.");
  }
  config.randomSeed = "burning-result-integrity-late-target-clock";
  config.targetClockModel = {
    mode: "target-local-hitlag-v1"
  };
  burningAbility.cancelFrame = 60;
  burningAbility.animationEndFrame = 60;
  pyroHit.frame = 59;
  return config;
}

function makeBurningRestartConfig(): SimConfig {
  const config = makeActiveBurningConfig(3);
  const burningAbility = config.timeline?.abilities[0];
  const firstPyroHit = burningAbility?.hits?.[0];
  if (burningAbility === undefined || firstPyroHit === undefined) {
    throw new Error("Burning fixture must expose its Pyro hit.");
  }
  config.randomSeed = "burning-result-integrity-restart";
  burningAbility.cancelFrame = 180;
  burningAbility.animationEndFrame = 180;
  burningAbility.hits = [
    firstPyroHit,
    {
      ...structuredClone(firstPyroHit),
      id: "restart-burning-with-dendro",
      label: "Restart Burning with Dendro",
      frame: 178,
      element: "dendro",
      application: application("restart-burning-with-dendro")
    },
    {
      ...structuredClone(firstPyroHit),
      id: "refresh-restarted-burning-with-pyro",
      label: "Refresh restarted Burning with Pyro",
      frame: 179,
      element: "pyro",
      application: application(
        "refresh-restarted-burning-with-pyro"
      )
    }
  ];
  return config;
}

function shiftBurningFuelAuraDeadlines(
  result: SimulationResult,
  offset: number
): void {
  const visited = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);
    if (value === result.config) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.element === "burningFuel") {
      for (const field of [
        "expiresAtFrame",
        "expiresAtTargetFrame"
      ] as const) {
        const deadline = record[field];
        if (typeof deadline === "number") {
          record[field] = deadline + offset;
        }
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(result);
}

function expectAcceptedAtBothBoundaries(
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
  expect(assertTrustedSimulationResult(result)).toBe(result);
}

function expectRejectedAtBothBoundaries(
  result: SimulationResult
): void {
  expect(simulationResultSchema.safeParse(result).success).toBe(
    false
  );
  expect(() =>
    assertTrustedSimulationResult(result)
  ).toThrow(/Trusted SimulationResult 1\.48 integrity validation failed/);
}

function appendUnownedStop(
  result: SimulationResult,
  generation: number
): void {
  const start = result.burningStateLog.find(
    (entry) => entry.operation === "start"
  );
  if (start === undefined) {
    throw new Error("Burning fixture must expose a start row.");
  }

  result.burningStateLog.push({
    ...structuredClone(start),
    id: result.burningStateLog.length,
    generation,
    operation: "stop",
    frame: 61,
    timeSeconds: 61 / 60,
    eventPriority: 999,
    eventSequence: 999,
    triggerElement: null,
    triggerDamageEventId: start.triggerDamageEventId,
    reactionDamageLogId: null,
    damageEventIds: [],
    playerHitResolutionLogId: null,
    playerDamageEventId: null,
    tickIndex: null,
    tickSkipped: false,
    skipReason: null,
    damageAllowed: null,
    burningGaugeUnitsBefore: start.burningGaugeUnitsAfter,
    burningGaugeUnitsAfter: 0,
    fuelGaugeUnitsBefore: start.fuelGaugeUnitsAfter,
    fuelGaugeUnitsAfter: 0,
    fuelExpiresAtFrame: null,
    auraBefore: structuredClone(start.auraAfter),
    auraApplied: [],
    auraConsumed: [],
    auraAfter: [],
    nextTickFrame: null,
    icdWindowStartFrame: null,
    icdHitIndex: null,
    applicationAllowed: null,
    applicationBlockedReason: null,
    reason: "SOURCE_CHANGED"
  });
}

describe("Burning result integrity edge cases", () => {
  it("accepts a cross-actor stop while preserving the stream damage owner", () => {
    const result = simulate(makeCrossActorStopConfig(), {
      critMode: "noCrit"
    });
    const stopEvent = result.damageEvents.find(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "stop"
    );
    const stopRow = result.burningStateLog.find(
      (entry) => entry.operation === "stop"
    );

    expect(stopEvent?.sourceActorId).toBe("cryo-stopper");
    expect(
      stopEvent?.reactionAudit.burningReaction?.damageSourceActorId
    ).toBe("pyro-owner");
    expect(stopRow).toMatchObject({
      damageSourceActorId: "pyro-owner",
      triggerDamageEventId: stopEvent?.id,
      triggerElement: "cryo"
    });
    expectAcceptedAtBothBoundaries(result);
  });

  it("rejects a coordinated non-canonical generation for one Burning stream", () => {
    const result = simulate(makeLateTargetClockBurningConfig(), {
      critMode: "noCrit"
    });
    const burningAudits = [
      ...result.damageEvents,
      ...result.hitEvents
    ].flatMap((event) => {
      const audit = event.reactionAudit.burningReaction;
      return audit === null ? [] : [audit];
    });

    expect(result.burningStateLog).toHaveLength(1);
    expect(result.burningStateLog[0]).toMatchObject({
      operation: "start",
      generation: 1
    });
    expect(
      burningAudits.every((audit) => audit.generation === 1)
    ).toBe(true);
    expectAcceptedAtBothBoundaries(result);

    for (const audit of burningAudits) {
      audit.generation = 7;
    }
    result.burningStateLog[0]!.generation = 7;
    expectRejectedAtBothBoundaries(result);
  });

  it("accepts a post-expiry restart and rejects reusing the retired generation", () => {
    const legal = simulate(makeBurningRestartConfig(), {
      critMode: "noCrit"
    });
    const starts = legal.burningStateLog.filter(
      (entry) => entry.operation === "start"
    );
    const firstExpiry = legal.burningStateLog.find(
      (entry) =>
        entry.operation === "fuel-expire" &&
        entry.frame < (starts[1]?.frame ?? 0)
    );

    expect(starts.map((entry) => entry.generation)).toEqual([1, 3]);
    expect(firstExpiry).toMatchObject({
      operation: "fuel-expire",
      generation: 1
    });
    expectAcceptedAtBothBoundaries(legal);

    const forged = structuredClone(legal);
    const forgedStarts = forged.burningStateLog.filter(
      (entry) => entry.operation === "start"
    );
    const retiredGeneration = forgedStarts[0]?.generation;
    const restartedGeneration = forgedStarts[1]?.generation;
    const restartFrame = forgedStarts[1]?.frame;
    if (
      retiredGeneration === undefined ||
      restartedGeneration === undefined ||
      restartFrame === undefined
    ) {
      throw new Error(
        "Burning restart fixture must expose two materialized streams."
      );
    }
    for (const row of forged.burningStateLog) {
      if (
        row.frame >= restartFrame &&
        row.generation === restartedGeneration
      ) {
        row.generation = retiredGeneration;
      }
    }
    for (const event of [
      ...forged.damageEvents,
      ...forged.hitEvents
    ]) {
      const audit = event.reactionAudit.burningReaction;
      if (
        event.frame >= restartFrame &&
        audit?.generation === restartedGeneration
      ) {
        audit.generation = retiredGeneration;
      }
    }
    expectRejectedAtBothBoundaries(forged);
  });

  it("rejects a coordinated one-frame shift of the target-local Burning schedule", () => {
    const legal = simulate(makeLateTargetClockBurningConfig(), {
      critMode: "noCrit"
    });
    const legalAudit = legal.damageEvents.find(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "start"
    )?.reactionAudit.burningReaction;
    const legalStart = legal.burningStateLog.find(
      (entry) => entry.operation === "start"
    );
    expect(legalAudit).toMatchObject({
      snapshotFrame: 59,
      snapshotTargetFrame: 59,
      firstTickFrame: 74,
      firstTickTargetFrame: 74,
      fuelExpiresAtFrame: 168,
      fuelExpiresAtTargetFrame: 168
    });
    expect(legalStart).toMatchObject({
      frame: 59,
      targetFrame: 59,
      nextTickFrame: 74,
      nextTickTargetFrame: 74,
      fuelExpiresAtFrame: 168,
      fuelExpiresAtTargetFrame: 168
    });
    expectAcceptedAtBothBoundaries(legal);

    const forged = structuredClone(legal);
    const burningAudits = new Set(
      [...forged.damageEvents, ...forged.hitEvents].flatMap(
        (event) => {
          const audit = event.reactionAudit.burningReaction;
          return audit === null ? [] : [audit];
        }
      )
    );
    for (const audit of burningAudits) {
      if (
        audit.snapshotTargetFrame === undefined ||
        audit.firstTickFrame === null ||
        audit.firstTickTargetFrame === undefined ||
        audit.firstTickTargetFrame === null ||
        audit.nextTickFrame === null ||
        audit.nextTickTargetFrame === undefined ||
        audit.nextTickTargetFrame === null ||
        audit.fuelExpiresAtFrame === null ||
        audit.fuelExpiresAtTargetFrame === undefined ||
        audit.fuelExpiresAtTargetFrame === null
      ) {
        throw new Error(
          "Late Burning fixture must expose its complete target-local schedule."
        );
      }
      audit.snapshotTargetFrame -= 1;
      audit.firstTickFrame -= 1;
      audit.firstTickTargetFrame -= 1;
      audit.nextTickFrame -= 1;
      audit.nextTickTargetFrame -= 1;
      audit.fuelExpiresAtFrame -= 1;
      audit.fuelExpiresAtTargetFrame -= 1;
    }
    const forgedStart = forged.burningStateLog.find(
      (entry) => entry.operation === "start"
    );
    if (
      forgedStart?.targetFrame === undefined ||
      forgedStart.nextTickFrame === null ||
      forgedStart.nextTickTargetFrame === undefined ||
      forgedStart.nextTickTargetFrame === null ||
      forgedStart.fuelExpiresAtFrame === null ||
      forgedStart.fuelExpiresAtTargetFrame === undefined ||
      forgedStart.fuelExpiresAtTargetFrame === null
    ) {
      throw new Error(
        "Late Burning lifecycle must expose its complete target-local schedule."
      );
    }
    forgedStart.targetFrame -= 1;
    forgedStart.nextTickFrame -= 1;
    forgedStart.nextTickTargetFrame -= 1;
    forgedStart.fuelExpiresAtFrame -= 1;
    forgedStart.fuelExpiresAtTargetFrame -= 1;
    shiftBurningFuelAuraDeadlines(forged, -1);

    expectRejectedAtBothBoundaries(forged);
  });

  it("rejects a same-generation stop without authoritative provenance", () => {
    const result = simulate(makeActiveBurningConfig(), {
      critMode: "noCrit"
    });
    const generation = result.burningStateLog.find(
      (entry) => entry.operation === "start"
    )!.generation;

    appendUnownedStop(result, generation);
    expectRejectedAtBothBoundaries(result);
  });

  it("rejects an unowned stop with the wrong generation", () => {
    const result = simulate(makeActiveBurningConfig(), {
      critMode: "noCrit"
    });
    const generation = result.burningStateLog.find(
      (entry) => entry.operation === "start"
    )!.generation;

    appendUnownedStop(result, generation + 1);
    expectRejectedAtBothBoundaries(result);
  });

  it("rejects disguising an in-range natural Fuel expiry as a stop", () => {
    const result = simulate(makeActiveBurningConfig(2.2), {
      critMode: "noCrit"
    });
    const expiry = result.burningStateLog.find(
      (entry) => entry.operation === "fuel-expire"
    );
    if (expiry === undefined) {
      throw new Error("Burning fixture must expose Fuel expiry.");
    }

    expiry.operation = "stop";
    expiry.reason = "SOURCE_CHANGED";
    expectRejectedAtBothBoundaries(result);
  });

  it("rejects hiding a live Burning start from its parent reaction projections", () => {
    const result = simulate(makeActiveBurningConfig(), {
      critMode: "noCrit"
    });
    const startEvent = result.damageEvents.find(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "start"
    );
    if (startEvent === undefined) {
      throw new Error("Burning fixture must expose a start event.");
    }
    const startAlias = result.hitEvents.find(
      (event) => event.id === startEvent.id
    );
    if (startAlias === undefined) {
      throw new Error("Burning start must expose its hit-event alias.");
    }

    for (const event of [startEvent, startAlias]) {
      event.reaction = "none";
      event.reactionAudit.triggered = false;
      event.reactionAudit.reaction = "none";
      event.reactionAudit.reactions = [];
    }
    result.reactedHits = 0;
    for (const point of result.auraTimeline) {
      if (point.damageEventId !== startEvent.id) continue;
      point.reaction = "none";
      point.reactions = [];
    }
    for (const point of result.targetStateTimeline.points) {
      if (point.primaryDamageEventId !== startEvent.id) continue;
      point.reaction = "none";
      point.reactions = [];
    }

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects removing a Burning lifecycle audit while its parent still reports Burning", () => {
    const result = simulate(makeActiveBurningConfig(), {
      critMode: "noCrit"
    });
    const startEventIndex = result.damageEvents.findIndex(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "start"
    );
    const startEvent = result.damageEvents[startEventIndex];
    if (startEvent === undefined) {
      throw new Error("Burning fixture must expose a start event.");
    }
    const startAlias = result.hitEvents.find(
      (event) => event.id === startEvent.id
    );
    if (startAlias === undefined) {
      throw new Error("Burning start must expose its hit-event alias.");
    }

    startEvent.reactionAudit.burningReaction = null;
    startAlias.reactionAudit.burningReaction = null;

    const parsed = simulationResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          path: [
            "damageEvents",
            startEventIndex,
            "reactionAudit",
            "burningReaction"
          ],
          message:
            "a parent reaction audit that reports Burning requires its Burning lifecycle audit"
        })
      );
    }
    expect(() =>
      assertTrustedSimulationResult(result)
    ).toThrow(
      /Trusted SimulationResult 1\.48 integrity validation failed/
    );
  });

  it("rejects forged Fuel-expiry applied and consumed Aura projections", () => {
    const mutations: Array<
      (row: SimulationResult["burningStateLog"][number]) => void
    > = [
      (row) => {
        row.auraApplied = [
          { element: "pyro", gaugeUnits: 0.25 }
        ];
      },
      (row) => {
        row.auraConsumed = [];
      }
    ];

    for (const mutate of mutations) {
      const result = simulate(makeActiveBurningConfig(2.2), {
        critMode: "noCrit"
      });
      const expiry = result.burningStateLog.find(
        (entry) => entry.operation === "fuel-expire"
      );
      if (expiry === undefined) {
        throw new Error("Burning fixture must expose Fuel expiry.");
      }
      expect(expiry.auraConsumed.length).toBeGreaterThan(0);

      mutate(expiry);
      expectRejectedAtBothBoundaries(result);
    }
  });

  it("rejects forged Burning candidate and lifecycle Gauge summaries", () => {
    const auditResult = simulate(makeActiveBurningConfig(), {
      critMode: "noCrit"
    });
    const startEvent = auditResult.damageEvents.find(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "start"
    );
    const startAlias = auditResult.hitEvents.find(
      (event) => event.id === startEvent?.id
    );
    if (startEvent === undefined || startAlias === undefined) {
      throw new Error("Burning fixture must expose its start aliases.");
    }
    startEvent.reactionAudit.burningReaction!.candidateBurningGaugeUnits =
      999;
    startAlias.reactionAudit.burningReaction!.candidateBurningGaugeUnits =
      999;
    expectRejectedAtBothBoundaries(auditResult);

    for (const field of [
      "burningGaugeUnitsBefore",
      "burningGaugeUnitsAfter",
      "fuelGaugeUnitsBefore",
      "fuelGaugeUnitsAfter"
    ] as const) {
      const result = simulate(makeActiveBurningConfig(), {
        critMode: "noCrit"
      });
      const tick = result.burningStateLog.find(
        (entry) => entry.operation === "tick"
      );
      if (tick === undefined) {
        throw new Error("Burning fixture must expose a Tick row.");
      }
      tick[field] = 999;
      expectRejectedAtBothBoundaries(result);
    }
  });

  it("rejects a Burning lifecycle clock identity that contradicts config", () => {
    const result = simulate(makeActiveBurningConfig(), {
      critMode: "noCrit"
    });
    const start = result.burningStateLog.find(
      (entry) => entry.operation === "start"
    );
    if (start === undefined) {
      throw new Error("Burning fixture must expose a start row.");
    }

    start.clockModel = "target-local-hitlag-v1";
    start.hitlagStatus = "modeled-enemy-hitlag";
    start.targetFrame = start.frame;
    start.fuelExpiresAtTargetFrame = start.fuelExpiresAtFrame;
    start.nextTickTargetFrame = start.nextTickFrame;
    expectRejectedAtBothBoundaries(result);
  });

  it("accepts Burning deadlines that exclude same-hit post-processing Hitlag", () => {
    const result = simulate(makeSameHitHitlagBurningConfig(), {
      critMode: "noCrit"
    });
    const startEvent = result.damageEvents.find(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "start"
    );
    const start = result.burningStateLog.find(
      (entry) => entry.operation === "start"
    );
    const firstTick = result.burningStateLog.find(
      (entry) => entry.operation === "tick" && entry.tickIndex === 1
    );
    const hitlag = result.targetHitlagLog.find(
      (entry) => entry.hitId === startEvent?.hitId
    );
    const audit = startEvent?.reactionAudit.burningReaction;
    if (
      startEvent === undefined ||
      start === undefined ||
      firstTick === undefined ||
      hitlag === undefined ||
      audit === null ||
      audit === undefined
    ) {
      throw new Error(
        "Hitlag fixture must expose its Burning start, first Tick, and Hitlag row."
      );
    }

    expect(audit).toMatchObject({
      snapshotFrame: 0,
      snapshotTargetFrame: 0,
      firstTickFrame: 15,
      firstTickTargetFrame: 15,
      nextTickFrame: 15,
      nextTickTargetFrame: 15,
      fuelExpiresAtFrame: 121,
      fuelExpiresAtTargetFrame: 121
    });
    expect(start).toMatchObject({
      frame: 0,
      targetFrame: 0,
      nextTickFrame: 15,
      nextTickTargetFrame: 15,
      fuelExpiresAtFrame: 121,
      fuelExpiresAtTargetFrame: 121
    });
    expect(hitlag).toMatchObject({
      globalFrame: 0,
      eventPriority: startEvent.eventPriority,
      eventSequence: startEvent.eventSequence,
      extensionFrames: 3,
      applied: true
    });
    expect(firstTick).toMatchObject({
      frame: 18,
      targetFrame: 15,
      nextTickFrame: 33,
      nextTickTargetFrame: 30,
      fuelExpiresAtFrame: 124,
      fuelExpiresAtTargetFrame: 121
    });
    expectAcceptedAtBothBoundaries(result);
  });

  it("rejects coordinated Burning global-deadline drift under Hitlag", () => {
    const result = simulate(makeSameHitHitlagBurningConfig(), {
      critMode: "noCrit"
    });
    const startEventIndex = result.damageEvents.findIndex(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "start"
    );
    const startEvent = result.damageEvents[startEventIndex];
    const startAlias = result.hitEvents.find(
      (event) => event.id === startEvent?.id
    );
    const start = result.burningStateLog.find(
      (entry) => entry.operation === "start"
    );
    const audit = startEvent?.reactionAudit.burningReaction;
    const aliasAudit = startAlias?.reactionAudit.burningReaction;
    if (
      startEvent === undefined ||
      startAlias === undefined ||
      start === undefined ||
      audit === null ||
      audit === undefined ||
      aliasAudit === null ||
      aliasAudit === undefined ||
      audit.firstTickFrame === null
    ) {
      throw new Error("Hitlag fixture must expose its Burning start aliases.");
    }

    const driftedDeadline = audit.firstTickFrame + 1;
    audit.firstTickFrame = driftedDeadline;
    audit.nextTickFrame = driftedDeadline;
    aliasAudit.firstTickFrame = driftedDeadline;
    aliasAudit.nextTickFrame = driftedDeadline;
    start.nextTickFrame = driftedDeadline;

    const parsed = simulationResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          path: [
            "damageEvents",
            startEventIndex,
            "reactionAudit",
            "burningReaction",
            "firstTickFrame"
          ],
          message: expect.stringContaining(
            "target-clock projection must equal 15; received 16"
          )
        })
      );
    }
    expect(() =>
      assertTrustedSimulationResult(result)
    ).toThrow(
      /Trusted SimulationResult 1\.48 integrity validation failed/
    );
  });

  it("rejects target-frame drift on a truncation-owned Burning stop", () => {
    const result = simulate(makeTargetClockTruncationStopConfig(), {
      critMode: "noCrit"
    });
    const stop = result.burningStateLog.find(
      (entry) =>
        entry.operation === "stop" &&
        entry.reason === "TARGET_MECHANICS_TRUNCATION"
    );
    if (stop?.targetFrame === undefined) {
      throw new Error(
        "Target-clock truncation fixture must expose its stop target frame."
      );
    }
    expectAcceptedAtBothBoundaries(result);

    stop.targetFrame += 1;
    expectRejectedAtBothBoundaries(result);
  });

  it("rejects changing an audit-owned cross-actor stop reason", () => {
    const result = simulate(makeCrossActorStopConfig(), {
      critMode: "noCrit"
    });
    const stopRow = result.burningStateLog.find(
      (entry) => entry.operation === "stop"
    );
    if (stopRow === undefined) {
      throw new Error("Cross-actor fixture must expose its stop row.");
    }

    stopRow.reason = "SOURCE_CHANGED";
    expectRejectedAtBothBoundaries(result);
  });

  it("rejects deleting a Burning stop audit and its lifecycle row", () => {
    const config = makeCrossActorStopConfig();
    const result = simulate(config, { critMode: "noCrit" });
    const stopEventIndex = result.damageEvents.findIndex(
      (event) =>
        event.reactionAudit.burningReaction?.operation === "stop"
    );
    const stopEvent = result.damageEvents[stopEventIndex];
    const stopAlias = result.hitEvents.find(
      (event) => event.id === stopEvent?.id
    );
    const stopRow = result.burningStateLog.find(
      (entry) =>
        entry.operation === "stop" &&
        entry.triggerDamageEventId === stopEvent?.id
    );
    if (
      stopEvent === undefined ||
      stopAlias === undefined ||
      stopRow === undefined
    ) {
      throw new Error("Cross-actor fixture must expose its stop chain.");
    }

    stopEvent.reactionAudit.burningReaction = null;
    stopAlias.reactionAudit.burningReaction = null;
    result.burningStateLog = result.burningStateLog.filter(
      (entry) => entry.id !== stopRow.id
    );
    for (const point of result.targetStateTimeline.points) {
      point.links = point.links.filter(
        (link) =>
          !(
            link.kind === "burning-state-log" &&
            link.id === stopRow.id
          )
      );
    }

    const parsed = simulationResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          path: [
            "damageEvents",
            stopEventIndex,
            "reactionAudit",
            "burningReaction"
          ],
          message:
            "a hit that removes active Burning requires its Burning stop audit"
        })
      );
    }
    expect(() =>
      assertTrustedSimulationResult(result)
    ).toThrow(
      /Trusted SimulationResult 1\.48 integrity validation failed/
    );
  });

  it("accepts one trigger that consumes Burning while truncating target mechanics", () => {
    const result = simulate(makeSameTriggerTruncationStopConfig(), {
      critMode: "noCrit"
    });
    const hydroEvent = result.damageEvents.find(
      (event) => event.hitId === "hydro-truncation-hit"
    );
    if (hydroEvent === undefined) {
      throw new Error("Truncation fixture must expose its Hydro hit.");
    }
    const audit = hydroEvent.reactionAudit.burningReaction;
    const stopRows = result.burningStateLog.filter(
      (entry) =>
        entry.operation === "stop" &&
        entry.triggerDamageEventId === hydroEvent.id
    );

    expect(audit).toMatchObject({
      operation: "stop",
      stopReason: "BURNING_AURA_CONSUMED",
      triggerElement: "hydro"
    });
    expect(stopRows).toHaveLength(1);
    expect(stopRows[0]).toMatchObject({
      reason: "TARGET_MECHANICS_TRUNCATION",
      triggerElement: null
    });
    expect(
      result.targetMechanicsTruncationLog.filter(
        (entry) => entry.triggerDamageEventId === hydroEvent.id
      )
    ).toHaveLength(1);
    expectAcceptedAtBothBoundaries(result);

    const forgedGeneration = structuredClone(result);
    for (const event of [
      ...forgedGeneration.damageEvents,
      ...forgedGeneration.hitEvents
    ]) {
      const forgedAudit =
        event.reactionAudit.burningReaction;
      if (
        event.id === hydroEvent.id &&
        forgedAudit?.operation === "stop"
      ) {
        forgedAudit.generation = 7;
      }
    }
    expectRejectedAtBothBoundaries(forgedGeneration);
  });

  it("accepts a mechanics-truncated Burning start without a lifecycle row", () => {
    const result = simulate(makeBlockedBurningStartConfig(), {
      critMode: "noCrit"
    });
    const dendroEvent = result.damageEvents.find(
      (event) => event.hitId === "blocked-burning-start-hit"
    );
    if (dendroEvent === undefined) {
      throw new Error("Blocked-start fixture must expose its Dendro hit.");
    }

    expect(dendroEvent.reactionAudit.burningReaction).toMatchObject({
      operation: "start",
      scheduled: false,
      blockedReason: "TARGET_MECHANICS_TRUNCATION"
    });
    expect(dendroEvent.reactionAudit.mechanicsTruncation).toMatchObject({
      operation: "trigger"
    });
    expect(
      result.burningStateLog.filter(
        (entry) => entry.triggerDamageEventId === dendroEvent.id
      )
    ).toEqual([]);
    expect(
      result.targetMechanicsTruncationLog.filter(
        (entry) => entry.triggerDamageEventId === dendroEvent.id
      )
    ).toHaveLength(1);
    expectAcceptedAtBothBoundaries(result);

    const forged = structuredClone(result);
    for (const event of [
      ...forged.damageEvents,
      ...forged.hitEvents
    ]) {
      const audit = event.reactionAudit.burningReaction;
      if (event.id === dendroEvent.id && audit?.operation === "start") {
        audit.generation = 7;
      }
    }
    expectRejectedAtBothBoundaries(forged);

    const forgedOperation = structuredClone(result);
    for (const event of [
      ...forgedOperation.damageEvents,
      ...forgedOperation.hitEvents
    ]) {
      const audit = event.reactionAudit.burningReaction;
      if (event.id === dendroEvent.id && audit !== null) {
        Object.assign(audit, {
          operation: "refresh-fuel" as const,
          generation: 7,
          reactionTriggered: false,
          fuelOperation: "overwrite" as const
        });
      }
    }
    expectRejectedAtBothBoundaries(forgedOperation);

    const donor = simulate(makeActiveBurningConfig(1), {
      critMode: "noCrit"
    });
    const donorStart = donor.burningStateLog.find(
      (entry) => entry.operation === "start"
    );
    if (donorStart === undefined) {
      throw new Error(
        "Active Burning donor must expose one start lifecycle row."
      );
    }
    const forgedLifecycle = structuredClone(result);
    forgedLifecycle.burningStateLog.push({
      ...structuredClone(donorStart),
      id: forgedLifecycle.burningStateLog.length,
      frame: dendroEvent.frame,
      timeSeconds: dendroEvent.timeSeconds,
      eventPriority: dendroEvent.eventPriority,
      eventSequence: dendroEvent.eventSequence,
      targetId: dendroEvent.targetId,
      targetName: dendroEvent.targetName,
      triggerDamageEventId: dendroEvent.id,
      generation: 1
    });
    expectRejectedAtBothBoundaries(forgedLifecycle);
  });
});
