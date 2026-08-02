import type { FrameHitDefinition, SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1,
};

function applicationHit({
  id,
  element,
  gaugeUnits,
  hitlagFrames,
}: {
  id: string;
  element: NonNullable<FrameHitDefinition["element"]>;
  gaugeUnits: number;
  hitlagFrames?: number;
}): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    geometry: SAME_TARGET_GEOMETRY,
    application: {
      gaugeUnits,
      icd: { mode: "no-icd-v1" },
    },
    ...(hitlagFrames === undefined
      ? {}
      : {
          targetHitlag: {
            haltFrames: hitlagFrames,
            factor: 0,
          },
        }),
  };
}

function makeLongHitlagCleanupConfig({
  restoreFrame,
  restoreGaugeUnits = 1,
  durationFrames = 145,
}: {
  restoreFrame?: number;
  restoreGaugeUnits?: number;
  durationFrames?: number;
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-global-cadence-provisional-1",
    randomSeed: `ec-global-cadence-${restoreFrame ?? "none"}-${restoreGaugeUnits}-${durationFrames}`,
    meta: {
      name: "Aura-v9 EC global cadence long-Hitlag vector",
      version: "1.42.0",
      verificationStatus: "provisional",
    },
    duration: durationFrames / 60,
    cycleLength: Math.max(3, durationFrames / 60),
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Hydro Electro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 0.5 },
            { element: "electro", gaugeUnits: 2 },
          ],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: {
      mode: "target-local-hitlag-v1",
    },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "compound-chain",
          actorId: "driver",
          name: "Compound reaction chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "dendro-quicken",
              element: "dendro",
              gaugeUnits: 0.2,
            }),
            applicationHit({
              id: "electro-stream",
              element: "electro",
              gaugeUnits: 0.8,
              hitlagFrames: 120,
            }),
          ],
        },
        ...(restoreFrame === undefined
          ? []
          : [
              {
                id: "hydro-restore",
                actorId: "driver",
                name: "Hydro restore",
                kind: "skill" as const,
                cancelFrame: 1,
                animationEndFrame: 1,
                cooldownFrames: 0,
                hits: [
                  applicationHit({
                    id: `hydro-restore-${restoreFrame}`,
                    element: "hydro",
                    gaugeUnits: restoreGaugeUnits,
                  }),
                ],
              },
            ]),
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "compound-chain",
          atFrame: 0,
        },
        ...(restoreFrame === undefined
          ? []
          : [
              {
                type: "skill" as const,
                actorId: "driver",
                abilityId: "hydro-restore",
                atFrame: restoreFrame,
              },
            ]),
      ],
    },
  };
}

function electroChargedRows(result: ReturnType<typeof simulate>) {
  return result.periodicReactionLog.filter(
    (entry) => entry.reaction === "electroCharged",
  );
}

function cleanupOf(result: ReturnType<typeof simulate>) {
  const task = result.reactionTaskLog.find(
    (entry) => entry.electroChargedCleanup !== null,
  );
  if (task?.electroChargedCleanup === null || task === undefined) {
    throw new Error("Expected one EC cleanup task.");
  }
  return { task, cleanup: task.electroChargedCleanup };
}

function makePureElectroChargedConfig({
  initialGaugeUnits = 2,
  startGaugeUnits = 2,
  startHitlagFrames,
  boundaryHitlagFrames,
  durationFrames = 145,
}: {
  initialGaugeUnits?: number;
  startGaugeUnits?: number;
  startHitlagFrames?: number;
  boundaryHitlagFrames?: number;
  durationFrames?: number;
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-global-cadence-pure-provisional-1",
    randomSeed: `ec-pure-${initialGaugeUnits}-${startGaugeUnits}-${startHitlagFrames ?? 0}-${boundaryHitlagFrames ?? 0}`,
    meta: {
      name: "Aura-v9 pure EC global cadence",
      version: "1.42.0",
      verificationStatus: "provisional",
    },
    duration: durationFrames / 60,
    cycleLength: Math.max(3, durationFrames / 60),
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Pure EC target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            {
              element: "hydro",
              gaugeUnits: initialGaugeUnits,
            },
          ],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: {
      mode: "target-local-hitlag-v1",
    },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "ec-start",
          actorId: "driver",
          name: "EC start",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "ec-start-hit",
              element: "electro",
              gaugeUnits: startGaugeUnits,
              ...(startHitlagFrames === undefined
                ? {}
                : { hitlagFrames: startHitlagFrames }),
            }),
          ],
        },
        ...(boundaryHitlagFrames === undefined
          ? []
          : [
              {
                id: "boundary-hitlag",
                actorId: "driver",
                name: "Boundary Hitlag",
                kind: "skill" as const,
                cancelFrame: 1,
                animationEndFrame: 1,
                cooldownFrames: 0,
                hits: [
                  {
                    id: "boundary-hitlag-hit",
                    label: "boundary-hitlag-hit",
                    frame: 0,
                    scaling: 0,
                    element: "physical" as const,
                    geometry: SAME_TARGET_GEOMETRY,
                    targetHitlag: {
                      haltFrames: boundaryHitlagFrames,
                      factor: 0,
                    },
                  },
                ],
              },
            ]),
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "ec-start",
          atFrame: 0,
        },
        ...(boundaryHitlagFrames === undefined
          ? []
          : [
              {
                type: "skill" as const,
                actorId: "driver",
                abilityId: "boundary-hitlag",
                atFrame: 68,
              },
            ]),
      ],
    },
  };
}

describe("aura-v9 Electro-Charged global cadence", () => {
  it("keeps F10 pinned, audits the missing F70 callback, and stops at the delayed target Tick", () => {
    const result = simulate(makeLongHitlagCleanupConfig(), {
      critMode: "noCrit",
    });
    const rows = electroChargedRows(result);
    expect(
      rows.map(
        ({
          frame,
          operation,
          tickIndex,
          nextTickFrame,
          cadenceStatus,
          waneListenerActive,
          reason,
        }) => ({
          frame,
          operation,
          tickIndex,
          nextTickFrame,
          cadenceStatus,
          waneListenerActive,
          reason,
        }),
      ),
    ).toEqual([
      {
        frame: 0,
        operation: "start",
        tickIndex: null,
        nextTickFrame: 70,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
        reason: null,
      },
      {
        frame: 10,
        operation: "tick",
        tickIndex: 0,
        nextTickFrame: 70,
        cadenceStatus: "scheduled",
        waneListenerActive: false,
        reason: "QUEUED_FIRST_TICK_WHILE_CLEANUP_PENDING",
      },
      {
        frame: 70,
        operation: "tick-skipped",
        tickIndex: 1,
        nextTickFrame: null,
        cadenceStatus: "dormant",
        waneListenerActive: false,
        reason: "COEXISTING_AURA_MISSING_AT_GLOBAL_CALLBACK",
      },
      {
        frame: 121,
        operation: "stop",
        tickIndex: null,
        nextTickFrame: null,
        cadenceStatus: "stopped",
        waneListenerActive: false,
        reason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
      },
    ]);
    expect(
      result.damageEvents
        .filter((entry) => entry.reaction === "electroCharged")
        .map((entry) => entry.frame),
    ).toEqual([10]);
    expect(rows.filter((entry) => entry.frame === 70)).toHaveLength(1);
    const { cleanup } = cleanupOf(result);
    expect(cleanup).toMatchObject({
      generation: 1,
      outcome: "stop",
      resolvedGlobalFrame: 121,
      resolvedTargetFrame: 1,
      cadence: {
        status: "stopped",
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: 70,
      },
    });
  });

  for (const restoreFrame of [20, 69, 70]) {
    it(`restores at F${restoreFrame} before the unique F70 callback and retains generation 1`, () => {
      const result = simulate(makeLongHitlagCleanupConfig({ restoreFrame }), {
        critMode: "noCrit",
      });
      const rows = electroChargedRows(result);
      const restore = rows.find(
        (entry) =>
          entry.frame === restoreFrame && entry.operation === "refresh",
      );
      const tick70 = rows.filter(
        (entry) => entry.frame === 70 && entry.operation === "tick",
      );
      expect(restore).toMatchObject({
        generation: 1,
        nextTickFrame: 70,
        cadenceStatus: "scheduled",
        waneListenerActive: false,
      });
      expect(tick70).toHaveLength(1);
      expect(tick70[0]).toMatchObject({
        generation: 1,
        tickIndex: 1,
        triggerDamageEventId: restore?.triggerDamageEventId,
        nextTickFrame: 130,
        waneFrame: null,
        cadenceStatus: "scheduled",
        waneListenerActive: false,
      });
      if (restoreFrame === 70) {
        expect(restore!.id).toBeLessThan(tick70[0]!.id);
      }
      expect(
        rows.find((entry) => entry.frame === 130 && entry.operation === "tick"),
      ).toMatchObject({
        generation: 1,
        tickIndex: 2,
        nextTickFrame: 190,
        waneFrame: null,
      });
      expect(cleanupOf(result).cleanup).toMatchObject({
        generation: 1,
        outcome: "retain",
        resolvedGlobalFrame: 121,
        resolvedTargetFrame: 1,
        cadence: {
          status: "scheduled",
          nextTickFrame: 130,
          waneListenerActive: false,
          lastCallbackFrame: 70,
        },
      });
    });
  }

  it("does not restart a missed cadence when Hydro returns at F71", () => {
    const result = simulate(makeLongHitlagCleanupConfig({ restoreFrame: 71 }), {
      critMode: "noCrit",
    });
    const rows = electroChargedRows(result);
    expect(
      rows.find(
        (entry) => entry.frame === 70 && entry.operation === "tick-skipped",
      ),
    ).toMatchObject({
      generation: 1,
      nextTickFrame: null,
      cadenceStatus: "dormant",
      waneListenerActive: false,
    });
    expect(
      rows.find((entry) => entry.frame === 71 && entry.operation === "refresh"),
    ).toMatchObject({
      generation: 1,
      nextTickFrame: null,
      cadenceStatus: "dormant",
      waneListenerActive: false,
    });
    expect(
      rows.some((entry) => entry.frame === 130 && entry.operation === "tick"),
    ).toBe(false);
    expect(cleanupOf(result).cleanup).toMatchObject({
      generation: 1,
      outcome: "retain",
      cadence: {
        status: "dormant",
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: 70,
      },
    });
  });

  it("publishes the current dormant cadence when cleanup is still pending at simulation end", () => {
    const result = simulate(
      makeLongHitlagCleanupConfig({
        durationFrames: 100,
      }),
      { critMode: "noCrit" },
    );
    expect(cleanupOf(result).cleanup).toMatchObject({
      generation: 1,
      outcome: "pending-at-end",
      resolvedGlobalFrame: null,
      resolvedTargetFrame: null,
      cadence: {
        status: "dormant",
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: 70,
      },
    });
  });

  it("links an F16 terminal Wane instead of creating a duplicate cleanup stop", () => {
    const result = simulate(
      makeLongHitlagCleanupConfig({
        restoreFrame: 5,
        restoreGaugeUnits: 0.5,
      }),
      { critMode: "noCrit" },
    );
    const rows = electroChargedRows(result);
    const terminal = rows.find(
      (entry) => entry.frame === 16 && entry.operation === "wane",
    );
    expect(terminal).toMatchObject({
      generation: 1,
      nextTickFrame: null,
      cadenceStatus: "stopped",
      waneListenerActive: false,
      reason: "AURA_DEPLETED_BY_WANE",
    });
    const { task, cleanup } = cleanupOf(result);
    expect(cleanup).toMatchObject({
      generation: 1,
      outcome: "ended-before-deadline",
      resolutionReason: "ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP",
      resolvedGlobalFrame: 121,
      resolvedTargetFrame: 1,
      periodicReactionLogId: terminal?.id,
      cadence: {
        status: "stopped",
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: null,
      },
    });
    expect(terminal?.reactionTaskLogId).toBe(task.id);
    expect(
      rows.filter(
        (entry) => entry.generation === 1 && entry.operation === "stop",
      ),
    ).toEqual([]);
  });

  it("Wane subtracts 0.4U from every source slot without deleting a stronger slot", () => {
    const engine = new AuraEngine({
      mode: "aura-v9",
      reactableTickModel: "cached-boundary-v2",
    });
    const noIcd = (gaugeUnits: number) => ({
      gaugeUnits,
      icd: { mode: "no-icd-v1" as const },
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro-weak",
      element: "hydro",
      application: noIcd(0.5),
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro-strong",
      element: "hydro",
      application: noIcd(1),
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "electro-weak",
      element: "electro",
      application: noIcd(0.5),
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro-strong",
      element: "electro",
      application: noIcd(1),
    });
    const generation = start.periodicReaction?.generation;
    if (generation === undefined) {
      throw new Error("Expected an EC generation.");
    }
    expect(
      engine.prepareElectroChargedFirstDamage(10, generation),
    ).toMatchObject({
      operation: "tick",
      waneListenerActive: true,
    });
    const wane = engine.waneElectroCharged(16, generation, true);
    expect(wane).toMatchObject({
      operation: "wane",
      generation,
      reason: null,
      cadenceStatus: "scheduled",
      waneListenerActive: true,
    });
    for (const element of ["hydro", "electro"] as const) {
      const consumed = wane.auraConsumed.find(
        (entry) => entry.element === element,
      );
      expect(consumed?.gaugeUnits).toBe(0.4);
      expect(consumed?.sourceMutations).toHaveLength(2);
      const weak = consumed?.sourceMutations?.find((entry) =>
        entry.sourceActorId.endsWith("weak"),
      );
      const strong = consumed?.sourceMutations?.find((entry) =>
        entry.sourceActorId.endsWith("strong"),
      );
      expect(weak?.gaugeUnitsAfter).toBe(0);
      expect(weak?.consumedGaugeUnits).toBe(weak?.gaugeUnitsBefore);
      expect(strong?.consumedGaugeUnits).toBe(0.4);
      expect(
        (strong?.gaugeUnitsBefore ?? 0) - (strong?.gaugeUnitsAfter ?? 0),
      ).toBeCloseTo(0.4, 12);
      expect(
        wane.auraAfter
          .find((entry) => entry.element === element)
          ?.sourceSlots?.some(
            (slot) =>
              slot.sourceActorId.endsWith("strong") && slot.gaugeUnits > 0,
          ),
      ).toBe(true);
    }
  });

  it("keeps pure EC callbacks and Wanes on global frames while 120F Hitlag freezes target state", () => {
    const result = simulate(
      makePureElectroChargedConfig({
        startHitlagFrames: 120,
      }),
      { critMode: "noCrit" },
    );
    const rows = electroChargedRows(result);
    expect(
      rows
        .filter((entry) => [10, 16, 70, 76, 130, 136].includes(entry.frame))
        .map(
          ({
            frame,
            operation,
            tickIndex,
            cadenceStatus,
            waneListenerActive,
          }) => ({
            frame,
            operation,
            tickIndex,
            cadenceStatus,
            waneListenerActive,
          }),
        ),
    ).toEqual([
      {
        frame: 10,
        operation: "tick",
        tickIndex: 0,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
      },
      {
        frame: 16,
        operation: "wane",
        tickIndex: 0,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
      },
      {
        frame: 70,
        operation: "tick",
        tickIndex: 1,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
      },
      {
        frame: 76,
        operation: "wane",
        tickIndex: 1,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
      },
      {
        frame: 130,
        operation: "tick",
        tickIndex: 2,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
      },
      {
        frame: 136,
        operation: "wane",
        tickIndex: 2,
        cadenceStatus: "scheduled",
        waneListenerActive: true,
      },
    ]);
    for (const frame of [10, 16, 70, 76]) {
      expect(
        result.targetStateTimeline.points.find(
          (point) =>
            point.frame === frame &&
            (point.cause === "electro-charged-tick" ||
              point.cause === "electro-charged-wane"),
        ),
      ).toMatchObject({
        frame,
        targetFrame: 0,
      });
    }
    expect(
      result.targetStateTimeline.points.find(
        (point) =>
          point.frame === 130 && point.cause === "electro-charged-tick",
      ),
    ).toMatchObject({
      frame: 130,
      targetFrame: 10,
    });
    expect(
      result.targetStateTimeline.points.find(
        (point) =>
          point.frame === 136 && point.cause === "electro-charged-wane",
      ),
    ).toMatchObject({
      frame: 136,
      targetFrame: 16,
    });
  });

  it("lets an F68 five-frame Hitlag preserve the exact F70 callback boundary", () => {
    const withoutHitlag = simulate(
      makePureElectroChargedConfig({
        initialGaugeUnits: 0.58,
        startGaugeUnits: 0.58,
        durationFrames: 80,
      }),
      { critMode: "noCrit" },
    );
    const withHitlag = simulate(
      makePureElectroChargedConfig({
        initialGaugeUnits: 0.58,
        startGaugeUnits: 0.58,
        boundaryHitlagFrames: 5,
        durationFrames: 80,
      }),
      { critMode: "noCrit" },
    );
    expect(
      electroChargedRows(withoutHitlag).some(
        (entry) => entry.frame === 70 && entry.operation === "tick",
      ),
    ).toBe(false);
    expect(
      electroChargedRows(withHitlag).filter(
        (entry) => entry.frame === 70 && entry.operation === "tick",
      ),
    ).toHaveLength(1);
    expect(
      withoutHitlag.damageEvents
        .filter(
          (entry) =>
            entry.kind === "transformative-reaction" &&
            entry.reaction === "electroCharged",
        )
        .map((entry) => entry.frame),
    ).toEqual([10]);
    expect(
      withHitlag.damageEvents
        .filter(
          (entry) =>
            entry.kind === "transformative-reaction" &&
            entry.reaction === "electroCharged",
        )
        .map((entry) => entry.frame),
    ).toEqual([10, 70]);
    expect(
      electroChargedRows(withHitlag).some(
        (entry) => entry.frame === 76 && entry.operation === "wane",
      ),
    ).toBe(false);
  });

  it("rejects a stale old-generation Wane after a replacement stream starts", () => {
    const engine = new AuraEngine({
      mode: "aura-v9",
      reactableTickModel: "cached-boundary-v2",
    });
    const noIcd = (gaugeUnits: number) => ({
      gaugeUnits,
      icd: { mode: "no-icd-v1" as const },
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1),
    });
    const firstStart = engine.processHit({
      frame: 0,
      sourceActorId: "electro-one",
      element: "electro",
      application: noIcd(1),
    });
    const firstGeneration = firstStart.periodicReaction?.generation;
    if (firstGeneration === undefined) {
      throw new Error("Expected generation one.");
    }
    engine.prepareElectroChargedFirstDamage(10, firstGeneration);
    expect(
      engine.processHit({
        frame: 11,
        sourceActorId: "pyro",
        element: "pyro",
        application: noIcd(1),
      }).periodicReaction,
    ).toMatchObject({
      generation: firstGeneration,
      operation: "stop",
    });
    const replacement = engine.processHit({
      frame: 12,
      sourceActorId: "electro-two",
      element: "electro",
      application: noIcd(1),
    });
    expect(replacement.periodicReaction).toMatchObject({
      operation: "start",
      generation: firstGeneration + 1,
    });
    const replacementAura = engine.getAuraStateAt(12);
    const stale = engine.waneElectroCharged(16, firstGeneration, true);
    expect(stale).toMatchObject({
      generation: firstGeneration,
      operation: "stale",
      reason: "SUPERSEDED_STREAM",
    });
    expect(stale.auraBefore).toEqual(replacementAura);
    expect(stale.auraAfter).toEqual(replacementAura);
    expect(engine.getCurrentFrame()).toBe(12);
  });

  it("keeps an active generation as a refresh when residual Hydro is consumed by Quicken first", () => {
    const engine = new AuraEngine({
      mode: "aura-v9",
      reactableTickModel: "cached-boundary-v2",
    });
    const noIcd = (gaugeUnits: number) => ({
      gaugeUnits,
      icd: { mode: "no-icd-v1" as const },
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1),
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1),
    });
    const generation = start.periodicReaction?.generation;
    if (generation === undefined) {
      throw new Error("Expected an EC generation.");
    }
    const mutable = engine as unknown as {
      auras: Map<
        string,
        {
          element: string;
          gaugeUnits: number;
          decayPerFrame: number;
          sourceSlots?: Map<string, number>;
        }
      >;
    };
    mutable.auras.delete("hydro");
    mutable.auras.set("quicken", {
      element: "quicken",
      gaugeUnits: 0.1,
      decayPerFrame: 0.001,
      sourceSlots: new Map([["quicken", 0.1]]),
    });
    const residual = engine.processHit({
      frame: 0,
      sourceActorId: "hydro-residual",
      element: "hydro",
      application: noIcd(1),
    });
    expect(residual.bloomReactions).toHaveLength(1);
    expect(residual.periodicReaction).toMatchObject({
      operation: "refresh",
      generation,
      firstDamageFrame: null,
      nextTickFrame: 70,
      cadenceStatus: "scheduled",
      waneListenerActive: true,
    });
  });

  it("does not queue an F16 Wane task when the pinned F10 damage is actually zero", () => {
    const config = makePureElectroChargedConfig({
      durationFrames: 80,
    });
    config.enemy.targetPhases = [
      {
        id: "immune-first-ec-tick",
        label: "Immune first EC tick",
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
    const result = simulate(config, {
      critMode: "noCrit",
    });
    const ticks = result.damageEvents.filter(
      (entry) =>
        entry.kind === "transformative-reaction" &&
        entry.reaction === "electroCharged",
    );
    expect(
      ticks.map(({ frame, finalDamage }) => ({
        frame,
        finalDamage,
      })),
    ).toEqual([
      { frame: 10, finalDamage: 0 },
      { frame: 70, finalDamage: expect.any(Number) },
    ]);
    expect(ticks[1]!.finalDamage).toBeGreaterThan(0);
    expect(
      electroChargedRows(result).some(
        (entry) =>
          entry.frame === 16 &&
          (entry.operation === "wane" || entry.operation === "wane-skipped"),
      ),
    ).toBe(false);
  });
});
