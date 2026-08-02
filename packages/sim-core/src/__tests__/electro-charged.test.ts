import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function auraV2RetainedGauge(frame: number, consumedGaugeUnits = 0): number {
  return 0.8 - (0.8 / 426) * frame - consumedGaugeUnits;
}

function makeElectroChargedConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 3,
    cycleLength: 3,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "感电目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-1",
          name: "邻近但无独立感电流",
          position: { x: 0.1, y: 0 },
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "electro-a",
        name: "Electro A",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2,
        },
      },
      {
        ...template,
        id: "hydro-b",
        name: "Hydro B",
        element: "hydro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 300,
          reactionBonus: 0.1,
        },
      },
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v2",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro-a",
      swapFrames: 12,
      abilities: [
        {
          id: "electro-start",
          actorId: "electro-a",
          name: "Electro start",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "electro-start-hit",
              label: "雷触发感电",
              frame: 0,
              scaling: 1,
              element: "electro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
        {
          id: "hydro-refresh",
          actorId: "hydro-b",
          name: "Hydro refresh",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-refresh-hit",
              label: "水刷新感电",
              frame: 0,
              scaling: 1,
              element: "hydro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro-a",
          abilityId: "electro-start",
        },
        { type: "wait", frames: 7 },
        { type: "swap", characterId: "hydro-b" },
        {
          type: "skill",
          actorId: "hydro-b",
          abilityId: "hydro-refresh",
        },
      ],
    },
  };
}

function enableAuraV9(config: SimConfig): SimConfig {
  config.reactionEngine = { mode: "aura-v9" };
  config.targetTaskModel = { mode: "target-phase-v2" };
  for (const ability of config.timeline?.abilities ?? []) {
    for (const hit of ability.hits ?? []) {
      delete hit.targeting;
      hit.geometry = {
        kind: "circle",
        coordinateSpace: "world",
        origin: { x: 0, y: 0 },
        radius: 0,
      };
    }
  }
  return config;
}

function expectAcceptedAtBothBoundaries(
  result: ReturnType<typeof simulate>,
): void {
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  expect(result.freezeBrokenAttackLog).toEqual([]);
  expect(result.mechanicsStatus).toBe("complete");
}

function expectRejectedAtBothBoundaries(
  result: ReturnType<typeof simulate>,
  expectedIssue?: RegExp,
): void {
  const parsed = simulationResultSchema.safeParse(result);
  expect(parsed.success).toBe(false);
  if (!parsed.success && expectedIssue !== undefined) {
    expect(
      parsed.error.issues.map((issue) => issue.message).join("\n"),
    ).toMatch(expectedIssue);
  }
  expect(() => assertTrustedSimulationResult(result)).toThrow(
    /Trusted SimulationResult 1\.52 integrity validation failed/,
  );
}

describe("Electro-Charged simulation integration", () => {
  it("emits every single-target tick and transfers future ownership on refresh", () => {
    const config = makeElectroChargedConfig();
    const result = simulate(config, {
      critMode: "noCrit",
    });
    const triggers = result.damageEvents.filter(
      (event) => event.kind === "direct",
    );
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );
    const firstExpected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 2,
      effectiveResistance: 0.1,
    });
    const secondExpected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 300,
      reactionBonus: 0.1,
      baseMultiplier: 2,
      effectiveResistance: 0.1,
    });

    expect(triggers.map((event) => event.frame)).toEqual([0, 20]);
    expect(triggers[0]?.reactionAudit.periodicReaction).toMatchObject({
      operation: "start",
      firstDamageFrame: 10,
      nextTickFrame: 70,
    });
    expect(triggers[1]?.reactionAudit.periodicReaction).toMatchObject({
      operation: "refresh",
      firstDamageFrame: null,
      nextTickFrame: 70,
    });
    expect(ticks).toHaveLength(2);
    expect(
      ticks.map((event) => ({
        frame: event.frame,
        actorId: event.sourceActorId,
        parentDamageEventId: event.parentDamageEventId,
        targetId: event.targetId,
        element: event.element,
        reaction: event.reaction,
      })),
    ).toEqual([
      {
        frame: 10,
        actorId: "electro-a",
        parentDamageEventId: triggers[0]?.id,
        targetId: "enemy-0",
        element: "electro",
        reaction: "electroCharged",
      },
      {
        frame: 70,
        actorId: "hydro-b",
        parentDamageEventId: triggers[1]?.id,
        targetId: "enemy-0",
        element: "electro",
        reaction: "electroCharged",
      },
    ]);
    expect(ticks[0]?.finalDamage).toBeCloseTo(firstExpected.finalDamage, 10);
    expect(ticks[1]?.finalDamage).toBeCloseTo(secondExpected.finalDamage, 10);
    expect(
      result.damageEvents.some(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.targetId === "enemy-1",
      ),
    ).toBe(false);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("logs an immediate stop when a later reaction removes the coexisting aura", () => {
    const config = makeElectroChargedConfig();
    config.characters[1]!.element = "pyro";
    config.characters[1]!.name = "Pyro B";
    config.timeline!.abilities[1]!.name = "Pyro stop";
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.label = "火触发超载并终止感电";
    config.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits =
      auraV2RetainedGauge(20, 0.4);

    const result = simulate(config, { critMode: "noCrit" });
    const directHits = result.damageEvents.filter(
      (event) => event.kind === "direct",
    );
    const electroChargedTicks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );

    expect(electroChargedTicks.map((event) => event.frame)).toEqual([10]);
    expect(directHits[1]?.reactionAudit.periodicReaction).toMatchObject({
      operation: "stop",
      generation: 1,
      nextTickFrame: null,
      coexistenceExpiresAtFrame: null,
    });
    expect(
      result.periodicReactionLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason,
      ]),
    ).toEqual([
      ["start", 0, null],
      ["tick", 10, null],
      ["wane", 16, null],
      ["stop", 20, "COEXISTING_AURA_REMOVED_BY_HIT"],
    ]);
    expect(
      result.damageEvents.some(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "overload" &&
          event.frame === 21,
      ),
    ).toBe(true);
  });

  it("closes an immediate hit-removal stop in both directions", () => {
    const config = makeElectroChargedConfig();
    config.characters[1]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits =
      auraV2RetainedGauge(20, 0.4);
    const legal = simulate(config, { critMode: "noCrit" });
    const trigger = legal.damageEvents.find(
      (event) => event.reactionAudit.periodicReaction?.operation === "stop",
    );
    const stop = legal.periodicReactionLog.find(
      (entry) =>
        entry.operation === "stop" &&
        entry.reason === "COEXISTING_AURA_REMOVED_BY_HIT",
    );
    if (trigger === undefined || stop === undefined) {
      throw new Error(
        "Immediate EC stop fixture must expose its trigger and terminal row.",
      );
    }
    expectAcceptedAtBothBoundaries(legal);

    const forgedSource = structuredClone(legal);
    forgedSource.periodicReactionLog[stop.id]!.sourceActorId = "electro-a";
    expectRejectedAtBothBoundaries(forgedSource);

    const missingAudit = structuredClone(legal);
    for (const event of [
      ...missingAudit.damageEvents,
      ...missingAudit.hitEvents,
    ]) {
      if (event.id === trigger.id) {
        event.reactionAudit.periodicReaction = null;
      }
    }
    expectRejectedAtBothBoundaries(missingAudit);

    const launderedReason = structuredClone(legal);
    launderedReason.periodicReactionLog[stop.id]!.reason =
      "COEXISTING_AURA_MISSING";
    for (const event of [
      ...launderedReason.damageEvents,
      ...launderedReason.hitEvents,
    ]) {
      if (event.id === trigger.id) {
        event.reactionAudit.periodicReaction = null;
      }
    }
    expectRejectedAtBothBoundaries(launderedReason);

    const detachedLaunderedReason = structuredClone(legal);
    Object.assign(detachedLaunderedReason.periodicReactionLog[stop.id]!, {
      reason: "COEXISTING_AURA_MISSING" as const,
      triggerDamageEventId: null,
    });
    for (const event of [
      ...detachedLaunderedReason.damageEvents,
      ...detachedLaunderedReason.hitEvents,
    ]) {
      if (event.id === trigger.id) {
        event.reactionAudit.periodicReaction = null;
      }
    }
    expectRejectedAtBothBoundaries(detachedLaunderedReason);

    const missingRow = structuredClone(legal);
    missingRow.periodicReactionLog = missingRow.periodicReactionLog.filter(
      (entry) => entry.id !== stop.id,
    );
    for (const point of missingRow.targetStateTimeline.points) {
      point.links = point.links.filter(
        (link) =>
          !(link.kind === "periodic-reaction-log" && link.id === stop.id),
      );
    }
    expectRejectedAtBothBoundaries(missingRow);
  });

  it("replays aura-v9 Wane consumption, reason, and cadence at the shared result boundary", () => {
    const config = makeElectroChargedConfig();
    config.reactionEngine = { mode: "aura-v9" };
    config.targetTaskModel = { mode: "target-phase-v2" };
    const startHit = config.timeline?.abilities[0]?.hits?.[0];
    if (startHit === undefined) {
      throw new Error("EC fixture must expose its starting hit.");
    }
    delete startHit.targeting;
    startHit.geometry = {
      kind: "circle",
      coordinateSpace: "world",
      origin: { x: 0, y: 0 },
      radius: 0,
    };
    const legal = simulate(config, { critMode: "noCrit" });
    const wane = legal.periodicReactionLog.find(
      (entry) => entry.operation === "wane",
    );
    const point = legal.targetStateTimeline.points.find((candidate) =>
      candidate.links.some(
        (link) => link.kind === "periodic-reaction-log" && link.id === wane?.id,
      ),
    );
    if (wane === undefined || point === undefined) {
      throw new Error(
        "Aura-v9 EC fixture must expose its Wane row and timeline point.",
      );
    }
    expect(wane).toMatchObject({
      frame: 16,
      operation: "wane",
      reason: null,
      cadenceStatus: "scheduled",
      waneListenerActive: true,
    });
    expect(wane.auraConsumed.map((entry) => entry.element)).toEqual([
      "hydro",
      "electro",
    ]);
    expectAcceptedAtBothBoundaries(legal);

    const forgedConsumption = structuredClone(legal);
    const forgedWane = forgedConsumption.periodicReactionLog[wane.id]!;
    forgedWane.auraConsumed[0]!.gaugeUnits += 0.1;
    const forgedPoint = forgedConsumption.targetStateTimeline.points[point.id]!;
    forgedPoint.auraConsumed = structuredClone(forgedWane.auraConsumed);
    expectRejectedAtBothBoundaries(forgedConsumption);

    const forgedReason = structuredClone(legal);
    forgedReason.periodicReactionLog[wane.id]!.reason = "AURA_DEPLETED_BY_WANE";
    expectRejectedAtBothBoundaries(forgedReason);

    const forgedCadence = structuredClone(legal);
    Object.assign(forgedCadence.periodicReactionLog[wane.id]!, {
      cadenceStatus: "dormant" as const,
      waneListenerActive: false,
    });
    expectRejectedAtBothBoundaries(forgedCadence);

    const start = legal.periodicReactionLog.find(
      (entry) => entry.operation === "start",
    );
    const tick = legal.periodicReactionLog.find(
      (entry) =>
        entry.operation === "tick" &&
        entry.damageEventId === wane.damageEventId,
    );
    if (start === undefined || tick === undefined) {
      throw new Error(
        "Aura-v9 EC fixture must expose the owning start and tick rows.",
      );
    }

    const forgedStartCadence = structuredClone(legal);
    Object.assign(forgedStartCadence.periodicReactionLog[start.id]!, {
      cadenceStatus: "dormant" as const,
      waneListenerActive: false,
    });
    for (const event of [
      ...forgedStartCadence.damageEvents,
      ...forgedStartCadence.hitEvents,
    ]) {
      if (event.id !== start.triggerDamageEventId) continue;
      const audit = event.reactionAudit.periodicReaction;
      if (audit?.operation === "start") {
        audit.cadenceStatus = "dormant";
        audit.waneListenerActive = false;
      }
    }
    expectRejectedAtBothBoundaries(forgedStartCadence);

    const forgedTickCadence = structuredClone(legal);
    forgedTickCadence.periodicReactionLog[tick.id]!.cadenceStatus = "dormant";
    expectRejectedAtBothBoundaries(forgedTickCadence);

    const missingTickBacklink = structuredClone(legal);
    missingTickBacklink.periodicReactionLog[tick.id]!.waneFrame = null;
    expectRejectedAtBothBoundaries(missingTickBacklink);

    const forgedStop = structuredClone(legal);
    const forgedStopRow = forgedStop.periodicReactionLog[wane.id]!;
    Object.assign(forgedStopRow, {
      operation: "stop" as const,
      auraConsumed: [],
      auraAfter: structuredClone(forgedStopRow.auraBefore),
      nextTickFrame: null,
      coexistenceExpiresAtFrame: null,
      reason: "COEXISTING_AURA_MISSING_BEFORE_WANE",
      cadenceStatus: "stopped" as const,
      waneListenerActive: false,
    });
    const forgedStopPoint = forgedStop.targetStateTimeline.points[point.id]!;
    Object.assign(forgedStopPoint, {
      pointKind: "observation" as const,
      auraConsumed: [],
      auraAfter: structuredClone(forgedStopRow.auraBefore),
    });
    expectRejectedAtBothBoundaries(forgedStop);

    const forgedDeadlines = structuredClone(legal);
    const forgedDeadlineWane = forgedDeadlines.periodicReactionLog[wane.id]!;
    for (const aura of forgedDeadlineWane.auraAfter) {
      if (
        (aura.element === "hydro" || aura.element === "electro") &&
        aura.expiresAtFrame !== null
      ) {
        aura.expiresAtFrame += 100;
      }
    }
    forgedDeadlineWane.coexistenceExpiresAtFrame = Math.min(
      ...forgedDeadlineWane.auraAfter
        .filter(
          (aura) => aura.element === "hydro" || aura.element === "electro",
        )
        .map((aura) => aura.expiresAtFrame!),
    );
    forgedDeadlines.targetStateTimeline.points[point.id]!.auraAfter =
      structuredClone(forgedDeadlineWane.auraAfter);
    expectRejectedAtBothBoundaries(forgedDeadlines);
  });

  it("rejects a coordinated forged deadline on Hydro depleted by a terminal aura-v9 Wane", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.enemy.targets![0]!.initialAura = [
      { element: "hydro", gaugeUnits: 1.30001856e-10 },
    ];
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    const legal = simulate(enableAuraV9(config), {
      critMode: "noCrit",
    });
    const terminalWane = legal.periodicReactionLog.find(
      (entry) =>
        entry.operation === "wane" &&
        entry.auraBefore.some((aura) => aura.element === "hydro") &&
        !entry.auraAfter.some((aura) => aura.element === "hydro"),
    );
    const terminalPoint = legal.targetStateTimeline.points.find((point) =>
      point.links.some(
        (link) =>
          link.kind === "periodic-reaction-log" && link.id === terminalWane?.id,
      ),
    );
    const hydroBefore = terminalWane?.auraBefore.find(
      (aura) => aura.element === "hydro",
    );
    if (
      terminalWane === undefined ||
      terminalPoint === undefined ||
      hydroBefore === undefined
    ) {
      throw new Error(
        "Aura-v9 terminal fixture must deplete Hydro at its Wane callback.",
      );
    }
    expect(hydroBefore.expiresAtFrame).toBe(421);
    expectAcceptedAtBothBoundaries(legal);

    const forged = structuredClone(legal);
    const forgedHydro = forged.periodicReactionLog[
      terminalWane.id
    ]!.auraBefore.find((aura) => aura.element === "hydro");
    const forgedPointHydro = forged.targetStateTimeline.points[
      terminalPoint.id
    ]!.auraBefore.find((aura) => aura.element === "hydro");
    if (forgedHydro === undefined || forgedPointHydro === undefined) {
      throw new Error(
        "Forged terminal fixture must retain both reciprocal Hydro snapshots.",
      );
    }
    forgedHydro.expiresAtFrame = 9999;
    forgedPointHydro.expiresAtFrame = 9999;

    expectRejectedAtBothBoundaries(forged);
  });

  it("rejects a coordinated non-canonical first Electro-Charged generation", () => {
    const legal = simulate(makeElectroChargedConfig(), {
      critMode: "noCrit",
    });
    expectAcceptedAtBothBoundaries(legal);

    const forgedHistoricalCadence = structuredClone(legal);
    const historicalStart = forgedHistoricalCadence.periodicReactionLog.find(
      (entry) => entry.operation === "start",
    );
    if (historicalStart === undefined) {
      throw new Error("EC fixture must expose its start row.");
    }
    Object.assign(historicalStart, {
      cadenceStatus: "scheduled" as const,
      waneListenerActive: true,
    });
    expectRejectedAtBothBoundaries(forgedHistoricalCadence);

    const forged = structuredClone(legal);
    for (const event of [...forged.damageEvents, ...forged.hitEvents]) {
      const audit = event.reactionAudit.periodicReaction;
      if (audit?.generation === 1) audit.generation = 7;
    }
    for (const row of forged.periodicReactionLog) {
      if (row.generation === 1) row.generation = 7;
    }
    for (const parent of forged.reactionDamageLog) {
      if (parent.electroChargedPropagation?.generation === 1) {
        parent.electroChargedPropagation.generation = 7;
      }
    }
    expectRejectedAtBothBoundaries(forged);
  });

  it("requires a start audit to own its lifecycle row before the first tick", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
        atFrame: 55,
      },
    ];
    const legal = simulate(config, { critMode: "noCrit" });
    expect(legal.periodicReactionLog.map((entry) => entry.operation)).toEqual([
      "start",
    ]);
    expectAcceptedAtBothBoundaries(legal);

    const forged = structuredClone(legal);
    forged.periodicReactionLog = [];
    for (const event of [...forged.damageEvents, ...forged.hitEvents]) {
      const audit = event.reactionAudit.periodicReaction;
      if (audit?.operation === "start") audit.generation = 7;
    }
    expectRejectedAtBothBoundaries(forged);
  });

  it("rejects coordinated suppression and deletion of a scheduled aura-v9 Wane", () => {
    const legal = simulate(enableAuraV9(makeElectroChargedConfig()), {
      critMode: "noCrit",
    });
    const tick = legal.periodicReactionLog.find(
      (entry) => entry.operation === "tick" && entry.tickIndex === 0,
    );
    const wane = legal.periodicReactionLog.find(
      (entry) =>
        entry.operation === "wane" &&
        entry.generation === tick?.generation &&
        entry.tickIndex === tick.tickIndex,
    );
    const wanePoint = legal.targetStateTimeline.points.find((point) =>
      point.links.some(
        (link) => link.kind === "periodic-reaction-log" && link.id === wane?.id,
      ),
    );
    if (tick === undefined || wane === undefined || wanePoint === undefined) {
      throw new Error(
        "Aura-v9 EC fixture must expose a scheduled first Wane callback.",
      );
    }
    expectAcceptedAtBothBoundaries(legal);

    const suppressed = structuredClone(legal);
    Object.assign(suppressed.periodicReactionLog[tick.id]!, {
      waneFrame: null,
      waneListenerActive: false,
    });
    const forgedPoint = suppressed.targetStateTimeline.points[wanePoint.id]!;
    Object.assign(forgedPoint, {
      pointKind: "observation" as const,
      cause: "electro-charged-tick" as const,
      eventType: "periodicReactionTick" as const,
      auraConsumed: [],
      auraAfter: structuredClone(forgedPoint.auraBefore),
    });
    forgedPoint.links = forgedPoint.links.map((link) =>
      link.kind === "periodic-reaction-log" && link.id === wane.id
        ? { kind: "periodic-reaction-log" as const, id: tick.id }
        : link,
    );
    suppressed.periodicReactionLog = suppressed.periodicReactionLog.filter(
      (entry) => entry.id !== wane.id,
    );
    for (const [index, row] of suppressed.periodicReactionLog.entries()) {
      row.id = index;
    }
    for (const point of suppressed.targetStateTimeline.points) {
      for (const link of point.links) {
        if (link.kind === "periodic-reaction-log" && link.id > wane.id) {
          link.id -= 1;
        }
      }
    }

    expectRejectedAtBothBoundaries(suppressed, /pinned first tick listener/);
  });

  it.each([
    ["past", -10],
    ["future", 10],
  ] as const)(
    "rejects a coordinated aura-v9 cadence drift into the %s",
    (_direction, drift) => {
      const legal = simulate(enableAuraV9(makeElectroChargedConfig()), {
        critMode: "noCrit",
      });
      const firstTick = legal.periodicReactionLog.find(
        (entry) => entry.operation === "tick" && entry.tickIndex === 0,
      );
      const firstWane = legal.periodicReactionLog.find(
        (entry) =>
          entry.operation === "wane" &&
          entry.generation === firstTick?.generation &&
          entry.tickIndex === firstTick.tickIndex,
      );
      const refresh = legal.periodicReactionLog.find(
        (entry) => entry.operation === "refresh",
      );
      if (
        firstTick === undefined ||
        firstTick.nextTickFrame === null ||
        firstWane === undefined ||
        firstWane.nextTickFrame === null ||
        refresh === undefined ||
        refresh.nextTickFrame === null
      ) {
        throw new Error(
          "Aura-v9 EC fixture must retain its first recurring cadence.",
        );
      }
      expectAcceptedAtBothBoundaries(legal);

      const forged = structuredClone(legal);
      forged.periodicReactionLog[firstTick.id]!.nextTickFrame =
        firstTick.nextTickFrame + drift;
      forged.periodicReactionLog[firstWane.id]!.nextTickFrame =
        firstWane.nextTickFrame + drift;
      forged.periodicReactionLog[refresh.id]!.nextTickFrame =
        refresh.nextTickFrame + drift;
      for (const event of [...forged.damageEvents, ...forged.hitEvents]) {
        if (event.id !== refresh.triggerDamageEventId) continue;
        const audit = event.reactionAudit.periodicReaction;
        if (audit?.operation === "refresh" && audit.nextTickFrame !== null) {
          audit.nextTickFrame += drift;
        }
      }

      expectRejectedAtBothBoundaries(forged, /pinned first tick cadence/);
    },
  );

  it("rejects erasing a real aura-v9 start and inventing one on a non-reacting hit", () => {
    const makeLateConfig = (hasHydroAura: boolean): SimConfig => {
      const config = makeElectroChargedConfig();
      config.duration = 1;
      config.cycleLength = 1;
      config.enemy.targets![0]!.initialAura = hasHydroAura
        ? [{ element: "hydro", gaugeUnits: 1 }]
        : [];
      config.timeline!.commands = [
        {
          type: "skill",
          actorId: "electro-a",
          abilityId: "electro-start",
          atFrame: 55,
        },
      ];
      return enableAuraV9(config);
    };

    const legalStart = simulate(makeLateConfig(true), {
      critMode: "noCrit",
    });
    const startRow = legalStart.periodicReactionLog.find(
      (entry) => entry.operation === "start",
    );
    const startTrigger = legalStart.damageEvents.find(
      (event) => event.reactionAudit.periodicReaction?.operation === "start",
    );
    if (startRow === undefined || startTrigger === undefined) {
      throw new Error("Late EC fixture must expose one real start.");
    }
    expectAcceptedAtBothBoundaries(legalStart);

    const erased = structuredClone(legalStart);
    erased.periodicReactionLog = [];
    for (const event of [...erased.damageEvents, ...erased.hitEvents]) {
      if (event.id === startTrigger.id) {
        event.reactionAudit.periodicReaction = null;
      }
    }
    for (const point of erased.targetStateTimeline.points) {
      point.links = point.links.filter(
        (link) => link.kind !== "periodic-reaction-log",
      );
    }
    expectRejectedAtBothBoundaries(
      erased,
      /hit reaction requires a start or refresh lifecycle audit/,
    );

    const noReaction = simulate(makeLateConfig(false), {
      critMode: "noCrit",
    });
    const noReactionTrigger = noReaction.damageEvents.find(
      (event) => event.kind === "direct",
    );
    if (noReactionTrigger === undefined) {
      throw new Error("Non-reacting fixture must expose its direct hit.");
    }
    expect(noReactionTrigger.reactionAudit.reactions).toEqual([]);
    expectAcceptedAtBothBoundaries(noReaction);

    const invented = structuredClone(noReaction);
    const inventedAudit = structuredClone(
      startTrigger.reactionAudit.periodicReaction!,
    );
    inventedAudit.coexistenceExpiresAtFrame = null;
    for (const event of [...invented.damageEvents, ...invented.hitEvents]) {
      if (event.id === noReactionTrigger.id) {
        event.reactionAudit.periodicReaction = structuredClone(inventedAudit);
      }
    }
    const inventedRow = structuredClone(startRow);
    Object.assign(inventedRow, {
      id: 0,
      triggerDamageEventId: noReactionTrigger.id,
      coexistenceExpiresAtFrame: null,
      auraBefore: structuredClone(
        noReactionTrigger.reactionAudit.auraBefore ?? [],
      ),
      auraAfter: structuredClone(
        noReactionTrigger.reactionAudit.auraAfter ?? [],
      ),
    });
    invented.periodicReactionLog = [inventedRow];
    expectRejectedAtBothBoundaries(
      invented,
      /start or refresh cannot be invented without an Electro-Charged hit reaction/,
    );
  });

  it("rejects an ordinary stop over coexisting Aura and aura-v9 hit-stop reason laundering", () => {
    const retainedConfig = makeElectroChargedConfig();
    retainedConfig.duration = 2;
    retainedConfig.cycleLength = 2;
    retainedConfig.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
        atFrame: 55,
      },
    ];
    const retained = simulate(enableAuraV9(retainedConfig), {
      critMode: "noCrit",
    });
    const retainedStart = retained.periodicReactionLog.find(
      (entry) => entry.operation === "start",
    );
    const retainedWane = retained.periodicReactionLog.find(
      (entry) =>
        entry.operation === "wane" &&
        entry.auraAfter.some((aura) => aura.element === "hydro") &&
        entry.auraAfter.some((aura) => aura.element === "electro"),
    );
    if (retainedStart === undefined || retainedWane === undefined) {
      throw new Error(
        "Aura-v9 retained fixture must expose a live post-Wane stream.",
      );
    }
    expectAcceptedAtBothBoundaries(retained);

    const phantomStop = structuredClone(retained);
    const stopRow = structuredClone(retainedStart);
    Object.assign(stopRow, {
      id: phantomStop.periodicReactionLog.length,
      frame: 100,
      timeSeconds: 100 / 60,
      operation: "stop" as const,
      reactionDamageLogId: null,
      damageEventId: null,
      tickIndex: null,
      nextTickFrame: null,
      coexistenceExpiresAtFrame: null,
      waneFrame: null,
      auraBefore: structuredClone(retainedWane.auraAfter),
      auraConsumed: [],
      auraAfter: structuredClone(retainedWane.auraAfter),
      reason: "COEXISTING_AURA_MISSING" as const,
      cadenceStatus: "stopped" as const,
      waneListenerActive: false,
    });
    phantomStop.periodicReactionLog.push(stopRow);
    expectRejectedAtBothBoundaries(
      phantomStop,
      /missing-Aura stop must observe unchanged non-coexisting Aura/,
    );

    const removalConfig = makeElectroChargedConfig();
    removalConfig.characters[1]!.element = "pyro";
    removalConfig.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    removalConfig.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits = 1;
    const removal = simulate(enableAuraV9(removalConfig), {
      critMode: "noCrit",
    });
    const removalTrigger = removal.damageEvents.find(
      (event) => event.reactionAudit.periodicReaction?.operation === "stop",
    );
    const removalStop = removal.periodicReactionLog.find(
      (entry) =>
        entry.operation === "stop" &&
        entry.reason === "COEXISTING_AURA_REMOVED_BY_HIT",
    );
    if (removalTrigger === undefined || removalStop === undefined) {
      throw new Error(
        "Aura-v9 removal fixture must expose its hit-owned stop.",
      );
    }
    expectAcceptedAtBothBoundaries(removal);

    const laundered = structuredClone(removal);
    laundered.periodicReactionLog[removalStop.id]!.reason =
      "COEXISTING_AURA_MISSING";
    for (const event of [...laundered.damageEvents, ...laundered.hitEvents]) {
      if (event.id === removalTrigger.id) {
        event.reactionAudit.periodicReaction = null;
      }
    }
    expectRejectedAtBothBoundaries(
      laundered,
      /missing-Aura stop must observe unchanged non-coexisting Aura/,
    );
  });

  it("rejects a refresh that resumes the same generation after a terminal aura-v9 Wane", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.timeline!.abilities[0]!.hits![0]!.application!.gaugeUnits = 0.5;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
      { type: "wait", frames: 19 },
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    const legal = simulate(enableAuraV9(config), {
      critMode: "noCrit",
    });
    const starts = legal.periodicReactionLog.filter(
      (entry) => entry.operation === "start",
    );
    const terminal = legal.periodicReactionLog.find(
      (entry) =>
        entry.generation === 1 &&
        entry.operation === "wane" &&
        entry.waneListenerActive === false,
    );
    if (starts.length !== 2 || terminal === undefined) {
      throw new Error(
        "Aura-v9 restart fixture must terminate generation 1 before generation 2.",
      );
    }
    const replacementStart = starts[1]!;
    expect(terminal.id).toBeLessThan(replacementStart.id);
    expectAcceptedAtBothBoundaries(legal);

    const forged = structuredClone(legal);
    const forgedStart = forged.periodicReactionLog[replacementStart.id]!;
    Object.assign(forgedStart, {
      operation: "refresh" as const,
      generation: 1,
    });
    for (const event of [...forged.damageEvents, ...forged.hitEvents]) {
      if (event.id !== replacementStart.triggerDamageEventId) continue;
      const audit = event.reactionAudit.periodicReaction;
      if (audit?.operation !== "start") continue;
      Object.assign(audit, {
        operation: "refresh" as const,
        generation: 1,
        firstDamageFrame: null,
      });
    }
    for (const row of forged.periodicReactionLog) {
      if (row.id <= replacementStart.id || row.generation !== 2) {
        continue;
      }
      row.generation = 1;
      if (row.tickIndex !== null) row.tickIndex += 1;
    }
    for (const parent of forged.reactionDamageLog) {
      const propagation = parent.electroChargedPropagation;
      if (propagation?.generation !== 2) continue;
      propagation.generation = 1;
      propagation.tickIndex += 1;
    }
    for (const task of forged.reactionTaskLog) {
      if (task.electroChargedCleanup?.generation === 2) {
        task.electroChargedCleanup.generation = 1;
      }
    }

    expectRejectedAtBothBoundaries(
      forged,
      /refresh requires the current active generation/,
    );
  });

  it("preserves the 1.44 sub-epsilon Wane wire while validating the depleted Aura", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.reactionEngine = { mode: "aura-v9" };
    config.targetTaskModel = { mode: "target-phase-v2" };
    config.enemy.targets![0]!.initialAura = [
      { element: "hydro", gaugeUnits: 1.30001856e-10 },
    ];
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    const startHit = config.timeline!.abilities[0]!.hits![0]!;
    delete startHit.targeting;
    startHit.geometry = {
      kind: "circle",
      coordinateSpace: "world",
      origin: { x: 0, y: 0 },
      radius: 0,
    };

    const result = simulate(config, { critMode: "noCrit" });
    const wane = result.periodicReactionLog.find(
      (entry) => entry.operation === "wane",
    );
    expect(wane?.auraConsumed.map((entry) => entry.element)).toEqual([
      "electro",
    ]);
    expect(
      wane?.auraBefore.find((entry) => entry.element === "hydro")?.gaugeUnits,
    ).toBe(1e-10);
    expect(wane?.auraAfter.some((entry) => entry.element === "hydro")).toBe(
      false,
    );
    expectAcceptedAtBothBoundaries(result);
  });

  it("accepts a retained Wane source slot that rounds exactly to the Aura epsilon", () => {
    const nominalGaugeUnits = 0.5166150130762146;
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.reactionEngine = { mode: "aura-v9" };
    config.targetTaskModel = { mode: "target-phase-v2" };
    config.enemy.targets![0]!.initialAura = [
      { element: "hydro", gaugeUnits: nominalGaugeUnits },
    ];
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    const startHit = config.timeline!.abilities[0]!.hits![0]!;
    startHit.application!.gaugeUnits = nominalGaugeUnits;
    delete startHit.targeting;
    startHit.geometry = {
      kind: "circle",
      coordinateSpace: "world",
      origin: { x: 0, y: 0 },
      radius: 0,
    };

    const result = simulate(config, { critMode: "noCrit" });
    const wane = result.periodicReactionLog.find(
      (entry) => entry.operation === "wane",
    );
    expect(wane?.auraBefore.map((entry) => entry.gaugeUnits)).toEqual([
      0.4000000001, 0.4000000001,
    ]);
    expect(wane?.auraAfter.map((entry) => entry.gaugeUnits)).toEqual([
      1e-10, 1e-10,
    ]);
    expect(
      wane?.auraAfter.flatMap((entry) =>
        (entry.sourceSlots ?? []).map((slot) => slot.gaugeUnits),
      ),
    ).toEqual([1e-10, 1e-10]);
    expectAcceptedAtBothBoundaries(result);
  });

  it("accepts a depleted Wane source slot whose rounded before Gauge straddles the Aura epsilon", () => {
    const nominalGaugeUnits = 0.5166150130755722;
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.reactionEngine = { mode: "aura-v9" };
    config.targetTaskModel = { mode: "target-phase-v2" };
    config.enemy.targets![0]!.initialAura = [
      { element: "hydro", gaugeUnits: nominalGaugeUnits },
    ];
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    const startHit = config.timeline!.abilities[0]!.hits![0]!;
    startHit.application!.gaugeUnits = nominalGaugeUnits;
    delete startHit.targeting;
    startHit.geometry = {
      kind: "circle",
      coordinateSpace: "world",
      origin: { x: 0, y: 0 },
      radius: 0,
    };

    const result = simulate(config, { critMode: "noCrit" });
    const wane = result.periodicReactionLog.find(
      (entry) => entry.operation === "wane",
    );
    expect(wane?.auraBefore.map((entry) => entry.gaugeUnits)).toEqual([
      0.4000000001, 0.4000000001,
    ]);
    expect(wane?.auraConsumed).toHaveLength(2);
    expect(wane?.auraConsumed).toSatisfy(
      (entries: NonNullable<typeof wane>["auraConsumed"]) =>
        entries.every((entry) =>
          entry.sourceMutations?.every(
            (mutation) => mutation.gaugeUnitsAfter === 0,
          ),
        ),
    );
    expect(wane?.auraAfter).toEqual([]);
    expectAcceptedAtBothBoundaries(result);
  });

  it("keeps a Wane-callback stop distinct from a non-Wane stop and accepts the exact result wire", () => {
    const config = makeElectroChargedConfig();
    config.characters[1]!.element = "pyro";
    config.characters[1]!.name = "Pyro B";
    config.timeline!.swapFrames = 4;
    config.timeline!.abilities[1]!.name = "Pyro stop before Wane";
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.label = "火在 Wane 前终止感电";
    config.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits =
      auraV2RetainedGauge(12);

    const result = simulate(config, { critMode: "noCrit" });
    const nonWaneStop = result.periodicReactionLog.find(
      (entry) => entry.operation === "stop" && entry.frame === 12,
    );
    const waneStop = result.periodicReactionLog.find(
      (entry) => entry.operation === "stop" && entry.waneFrame === 16,
    );

    expect(nonWaneStop).toMatchObject({
      damageEventId: null,
      tickIndex: null,
      waneFrame: null,
      reason: "COEXISTING_AURA_REMOVED_BY_HIT",
    });
    expect(waneStop).toMatchObject({
      frame: 16,
      damageEventId: expect.any(Number),
      tickIndex: 0,
      waneFrame: 16,
      reason: "COEXISTING_AURA_MISSING_BEFORE_WANE",
    });
    expect(simulationResultSchema.safeParse(result).success).toBe(true);
    expect(assertTrustedSimulationResult(result)).toBe(result);
  });

  it("keeps an already queued first tick after an early stop without wane or later ticks", () => {
    const config = makeElectroChargedConfig();
    config.characters[1]!.element = "pyro";
    config.timeline!.swapFrames = 1;
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits =
      auraV2RetainedGauge(5);
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
      { type: "wait", frames: 3 },
      { type: "swap", characterId: "hydro-b" },
      {
        type: "skill",
        actorId: "hydro-b",
        abilityId: "hydro-refresh",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );
    const electroChargedSchedules = result.reactionDamageLog.filter(
      (entry) => entry.reaction === "electroCharged",
    );

    expect(ticks.map((event) => event.frame)).toEqual([10]);
    expect(
      result.periodicReactionLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason,
        entry.nextTickFrame,
        entry.waneFrame,
      ]),
    ).toEqual([
      ["start", 0, null, 70, null],
      ["stop", 5, "COEXISTING_AURA_REMOVED_BY_HIT", null, null],
      ["tick", 10, "QUEUED_FIRST_TICK_AFTER_STREAM_STOP", null, null],
    ]);
    expect(electroChargedSchedules).toHaveLength(1);
    expect(electroChargedSchedules[0]?.nextAvailableFrame).toBeNull();
  });

  it("audits start, refresh, tick, delayed wane, and Aura depletion", () => {
    const config = makeElectroChargedConfig();
    config.duration = 4;
    config.cycleLength = 4;
    const result = simulate(config, {
      critMode: "noCrit",
    });

    expect(
      result.periodicReactionLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        actorId: entry.sourceActorId,
        tickIndex: entry.tickIndex,
        damageEventId: entry.damageEventId,
        reason: entry.reason,
      })),
    ).toMatchObject([
      {
        operation: "start",
        frame: 0,
        actorId: "electro-a",
        tickIndex: null,
      },
      {
        operation: "tick",
        frame: 10,
        actorId: "electro-a",
        tickIndex: 0,
        damageEventId: expect.any(Number),
      },
      {
        operation: "wane",
        frame: 16,
        actorId: "electro-a",
        tickIndex: 0,
        damageEventId: expect.any(Number),
        reason: null,
      },
      {
        operation: "refresh",
        frame: 20,
        actorId: "hydro-b",
        tickIndex: null,
      },
      {
        operation: "tick",
        frame: 70,
        actorId: "hydro-b",
        tickIndex: 1,
        damageEventId: expect.any(Number),
      },
      {
        operation: "wane",
        frame: 76,
        actorId: "hydro-b",
        tickIndex: 1,
        damageEventId: expect.any(Number),
        reason: "AURA_DEPLETED_BY_WANE",
      },
    ]);
    const wanes = result.periodicReactionLog.filter(
      (entry) => entry.operation === "wane",
    );
    expect(wanes[0]?.auraConsumed).toEqual([
      { element: "hydro", gaugeUnits: 0.4 },
      { element: "electro", gaugeUnits: 0.4 },
    ]);
    expect(wanes[1]?.auraAfter).toEqual([
      expect.objectContaining({ element: "hydro" }),
    ]);
    expect(wanes[1]?.auraAfter.some((aura) => aura.element === "electro")).toBe(
      false,
    );
    expect(result.reactionDamageLog).toMatchObject([
      {
        reaction: "electroCharged",
        scheduleKind: "periodic-tick",
        targetingMode: "single-target",
        damageFrame: 10,
        hitTargetIds: ["enemy-0"],
      },
      {
        reaction: "electroCharged",
        scheduleKind: "periodic-tick",
        targetingMode: "single-target",
        damageFrame: 70,
        hitTargetIds: ["enemy-0"],
      },
    ]);
  });

  it("keeps Aura when an Electro-Charged tick has zero actual damage", () => {
    const config = makeElectroChargedConfig();
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    config.enemy.targetPhases = [
      {
        id: "immune-first-ec-tick",
        label: "首次感电数值免疫",
        targetId: "enemy-0",
        startFrame: 10,
        endFrame: 11,
        reason: "EC_TICK_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal",
        },
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );
    const skippedWane = result.periodicReactionLog.find(
      (entry) => entry.operation === "wane-skipped",
    );

    expect(ticks.map((event) => event.frame)).toEqual([10, 70, 130]);
    expect(ticks[0]).toMatchObject({
      targetDamagePolicy: "immune",
      finalDamage: 0,
    });
    expect(skippedWane).toMatchObject({
      frame: 16,
      auraConsumed: [],
      reason: "ZERO_ACTUAL_DAMAGE",
    });
  });

  it("stops the stream at the exact natural Aura expiry before a later tick", () => {
    const config = makeElectroChargedConfig();
    config.duration = 7.2;
    config.cycleLength = 7.2;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    config.enemy.targetPhases = [
      {
        id: "immune-entire-ec-stream",
        label: "感电全程数值免疫",
        targetId: "enemy-0",
        startFrame: 0,
        endFrame: 432,
        reason: "EC_STREAM_DAMAGE_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal",
        },
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const tickFrames = result.damageEvents
      .filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "electroCharged",
      )
      .map((event) => event.frame);
    const stopped = result.periodicReactionLog.find(
      (entry) => entry.operation === "stop",
    );

    expect(tickFrames).toEqual([10, 70, 130, 190, 250, 310, 370]);
    expect(stopped).toMatchObject({
      frame: 426,
      operation: "stop",
      auraAfter: [],
      reason: "AURA_DECAY_EXPIRED",
    });
    expect(tickFrames).not.toContain(430);
  });

  it("keeps separate periodic streams for each fanout target", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    config.timeline!.abilities[0]!.hits![0]!.targeting = {
      mode: "fanout",
      targets: [
        { targetId: "enemy-0", outcome: "landed" },
        { targetId: "enemy-1", outcome: "landed" },
      ],
    };

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );
    const starts = result.periodicReactionLog.filter(
      (entry) => entry.operation === "start",
    );

    expect(ticks.map((event) => [event.frame, event.targetId])).toEqual([
      [10, "enemy-0"],
      [10, "enemy-1"],
    ]);
    expect(starts.map((entry) => entry.targetId)).toEqual([
      "enemy-0",
      "enemy-1",
    ]);
    expect(
      result.reactionDamageLog.map((entry) => entry.sourceTargetId),
    ).toEqual(["enemy-0", "enemy-1"]);
  });

  it("applies a same-frame direct refresh before the scheduled periodic tick", () => {
    const config = makeElectroChargedConfig();
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
      { type: "wait", frames: 57 },
      { type: "swap", characterId: "hydro-b" },
      {
        type: "skill",
        actorId: "hydro-b",
        abilityId: "hydro-refresh",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const frame70 = result.damageEvents.filter((event) => event.frame === 70);
    const tick = frame70.find(
      (event) => event.kind === "transformative-reaction",
    );

    expect(frame70.map((event) => event.kind)).toEqual([
      "direct",
      "transformative-reaction",
    ]);
    expect(tick).toMatchObject({
      sourceActorId: "hydro-b",
      parentDamageEventId: frame70[0]?.id,
      reaction: "electroCharged",
    });
  });

  it("keeps the already queued first tick snapshot when refreshed before frame 10", () => {
    const config = makeElectroChargedConfig();
    config.timeline!.swapFrames = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
      { type: "swap", characterId: "hydro-b" },
      {
        type: "skill",
        actorId: "hydro-b",
        abilityId: "hydro-refresh",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );

    expect(ticks.map((event) => event.sourceActorId)).toEqual([
      "electro-a",
      "hydro-b",
    ]);
    expect(ticks.map((event) => event.frame)).toEqual([10, 70]);
  });

  it("keeps a blocked queued restart tick as zero damage inside the target-local ReactionB window", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    const electroStart = config.timeline!.abilities[0]!;
    const pyroStop = config.timeline!.abilities[1]!;
    pyroStop.id = "pyro-stop";
    pyroStop.actorId = "electro-a";
    pyroStop.name = "Pyro stop";
    pyroStop.hits![0] = {
      ...pyroStop.hits![0]!,
      id: "pyro-stop-hit",
      label: "火触发超载并终止第一条感电流",
      element: "pyro",
      application: {
        gaugeUnits: auraV2RetainedGauge(5),
        icd: { mode: "no-icd-v1" },
      },
    };
    config.timeline!.abilities.push({
      ...electroStart,
      id: "electro-restart",
      name: "Electro restart",
      hits: electroStart.hits!.map((hit) => ({
        ...hit,
        id: "electro-restart-hit",
        label: "雷重启感电",
        application: {
          gaugeUnits: 1,
          icd: { mode: "no-icd-v1" },
        },
      })),
    });
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
      { type: "wait", frames: 4 },
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "pyro-stop",
      },
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-restart",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );
    const schedules = result.reactionDamageLog.filter(
      (entry) => entry.reaction === "electroCharged",
    );

    expect(
      result.periodicReactionLog
        .filter((entry) => entry.operation === "tick")
        .map((entry) => ({
          frame: entry.frame,
          generation: entry.generation,
          sourceActorId: entry.sourceActorId,
          reason: entry.reason,
        })),
    ).toEqual([
      {
        frame: 10,
        generation: 1,
        sourceActorId: "electro-a",
        reason: "QUEUED_FIRST_TICK_AFTER_STREAM_REPLACED",
      },
      {
        frame: 16,
        generation: 2,
        sourceActorId: "electro-a",
        reason: null,
      },
    ]);
    expect(
      ticks.map((event) => ({
        frame: event.frame,
        sourceActorId: event.sourceActorId,
        targetId: event.targetId,
        finalDamage: event.finalDamage,
        groupMultiplier: event.damageFactors.groupMultiplier,
      })),
    ).toEqual([
      {
        frame: 10,
        sourceActorId: "electro-a",
        targetId: "enemy-0",
        finalDamage: expect.any(Number),
        groupMultiplier: 1,
      },
      {
        frame: 16,
        sourceActorId: "electro-a",
        targetId: "enemy-0",
        finalDamage: 0,
        groupMultiplier: 0,
      },
    ]);
    expect(ticks[0]?.finalDamage).toBeGreaterThan(0);
    expect(ticks[1]).toMatchObject({
      displayDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0,
      },
    });
    expect(schedules).toHaveLength(2);
    expect(result.runManifest).toMatchObject({
      reactionDamageGroupRoot: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
    });
    expect(schedules[1]).toMatchObject({
      damageFrame: 16,
      damageGroupBlockedTargetIds: ["enemy-0"],
      damageEventIds: [ticks[1]?.id],
    });
    expect(schedules[1]?.damageGroupDecisions).toEqual([
      {
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
        profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
        icdTag: "ICDTagECDamage",
        icdGroup: "reaction-b",
        reaction: "electroCharged",
        sourceActorId: "electro-a",
        targetId: "enemy-0",
        scopeKey: '["enemy-0","electro-a","ICDTagECDamage"]',
        frame: 16,
        damageGroupTaskSequence: 14,
        windowGeneration: 0,
        windowStartFrame: 10,
        resetAtFrame: 39,
        resetTaskLogId: 2,
        resetTaskSequence: 12,
        hitIndex: 1,
        sequenceIndex: 1,
        sequenceMultiplier: 0,
        damageAllowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD",
      },
    ]);
    expect(result.reactionDamageGroupResetLog[2]).toEqual({
      id: 2,
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
      sourceActorId: "electro-a",
      targetId: "enemy-0",
      scopeKey: '["enemy-0","electro-a","ICDTagECDamage"]',
      reaction: "electroCharged",
      icdTag: "ICDTagECDamage",
      icdGroup: "reaction-b",
      windowGeneration: 0,
      windowStartFrame: 10,
      resetAtFrame: 39,
      taskSequence: 12,
      withinSimulation: true,
      executed: true,
      executedBeforeAttemptTaskSequence: null,
      executionFrame: 39,
      stale: false,
      invalidatedReason: null,
    });
  });

  it("freezes trigger-frame live EM and reaction bonus for a queued action-snapshot tick", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start",
      },
    ];
    const ability = config.timeline!.abilities[0]!;
    const hit = ability.hits![0]!;
    ability.cancelFrame = 11;
    ability.animationEndFrame = 11;
    ability.buffs = [
      {
        key: "ec-live-em",
        label: "感电触发帧精通",
        target: "self",
        stat: "em",
        value: 200,
        startFrame: 5,
        durationFrames: 6,
      },
      {
        key: "ec-live-reaction-bonus",
        label: "感电触发帧反应增伤",
        target: "self",
        stat: "reactionBonus",
        value: 0.3,
        startFrame: 5,
        durationFrames: 6,
      },
    ];
    ability.hits = [
      {
        ...hit,
        frame: 10,
        snapshot: "action",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const direct = result.damageEvents.find(
      (event) => event.hitId === "electro-start-hit",
    );
    const tick = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 300,
      reactionBonus: 0.5,
      baseMultiplier: 2,
      effectiveResistance: 0.1,
    });

    expect(direct).toMatchObject({
      frame: 10,
      snapshot: "action",
      statsBeforeDamage: {
        em: 100,
        reactionBonus: 0.2,
      },
    });
    expect(tick).toMatchObject({
      frame: 20,
      sourceActorId: "electro-a",
      snapshot: "hit",
      statsBeforeDamage: {
        em: 300,
        reactionBonus: 0.5,
      },
      transformativeReactionFactors: {
        characterLevel: 90,
        elementalMastery: 300,
        reactionBonus: 0.5,
      },
    });
    expect(tick?.buffs).toEqual(["感电触发帧精通", "感电触发帧反应增伤"]);
    expect(tick?.finalDamage).toBeCloseTo(expected.finalDamage, 10);
  });
});
