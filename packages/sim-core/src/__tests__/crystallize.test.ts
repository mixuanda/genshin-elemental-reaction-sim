import { describe, expect, it } from "vitest";
import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { AuraEngine } from "../aura";
import { calcCrystallizeShield, CRYSTALLIZE_CONSTANTS } from "../crystallize";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const },
  };
}

function expectCrystallizeMutationRejected(
  result: SimulationResult,
  mutate: (value: SimulationResult) => void,
  expectedMessage?: RegExp,
): void {
  const publicWire = structuredClone(result);
  mutate(publicWire);
  const parsed = simulationResultSchema.safeParse(publicWire);
  expect(parsed.success).toBe(false);
  if (!parsed.success && expectedMessage !== undefined) {
    expect(
      parsed.error.issues.map((issue) => issue.message).join("\n"),
    ).toMatch(expectedMessage);
  }

  const trustedResult = structuredClone(result);
  mutate(trustedResult);
  expect(() => assertTrustedSimulationResult(trustedResult)).toThrow(
    expectedMessage ??
      /Trusted SimulationResult 1\.52 integrity validation failed/,
  );
}

describe("AuraEngine Crystallize", () => {
  it("consumes 0.5x Aura, queues one shard, and keeps the exact fixed timings", () => {
    const audit = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    }).processHit({
      frame: 0,
      sourceActorId: "geo",
      element: "geo",
      application: noIcd(1),
    });

    expect(audit).toMatchObject({
      triggered: true,
      reaction: "crystallizePyro",
      auraApplied: [{ element: "geo", gaugeUnits: 1 }],
      auraConsumed: [{ element: "pyro", gaugeUnits: 0.5 }],
      crystallizeReaction: {
        reaction: "crystallizePyro",
        crystallizedElement: "pyro",
        consumedAuraElement: "pyro",
        sourceGaugeUnitsBefore: 1,
        sourceGaugeUnitsSpent: 1,
        sourceGaugeUnitsAfter: 0,
        auraGaugeUnitsBefore: 0.8,
        auraConsumedGaugeUnits: 0.5,
        auraGaugeUnitsAfter: 0.3,
        scheduled: true,
        blockedReason: null,
        nextAvailableFrame: 60,
        shardSpawnFrame: 23,
        earliestPickupFrame: 54,
        shardExpiresAtFrame: 923,
        shardDurationFrames: 900,
        maxActiveShards: 3,
      },
    });
  });

  it("emits literal crystallizeHydro and schedules a Hydro shard without independent damage", () => {
    const audit = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    }).processHit({
      frame: 0,
      sourceActorId: "geo",
      element: "geo",
      application: noIcd(1),
    });

    expect(audit).toMatchObject({
      triggered: true,
      reaction: "crystallizeHydro",
      reactions: ["crystallizeHydro"],
      auraConsumed: [{ element: "hydro", gaugeUnits: 0.5 }],
      crystallizeReaction: {
        reaction: "crystallizeHydro",
        crystallizedElement: "hydro",
        consumedAuraElement: "hydro",
        scheduled: true,
        shardSpawnFrame: 23,
        earliestPickupFrame: 54,
        shardExpiresAtFrame: 923,
      },
    });
    expect(audit.transformativeReaction).toBeNull();
    expect(audit.periodicReaction).toBeNull();
    expect(audit.frozenReaction).toBeNull();
  });

  it("uses Electro → Hydro → Cryo → Pyro → Frozen priority and a shared 60-frame GCD", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [
        { element: "pyro", gaugeUnits: 2 },
        { element: "hydro", gaugeUnits: 2 },
        { element: "electro", gaugeUnits: 2 },
      ],
    });
    const hit = (frame: number) =>
      engine.processHit({
        frame,
        sourceActorId: "geo",
        element: "geo",
        application: noIcd(1),
      });

    const first = hit(0);
    expect(first.reaction).toBe("crystallizeElectro");
    expect(first.auraConsumed).toEqual([
      { element: "electro", gaugeUnits: 0.5 },
    ]);
    const blocked = hit(30);
    expect(blocked).toMatchObject({
      triggered: false,
      reaction: "none",
      auraConsumed: [],
      crystallizeReaction: {
        reaction: "crystallizeElectro",
        scheduled: false,
        blockedReason: "REACTION_QUEUE_GCD",
        nextAvailableFrame: 60,
        sourceGaugeUnitsSpent: 0,
        auraConsumedGaugeUnits: 0,
      },
    });
    expect(hit(60).reaction).toBe("crystallizeElectro");
  });

  it("creates a Cryo shard while consuming Frozen durability", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1),
    });
    const audit = engine.processHit({
      frame: 1,
      sourceActorId: "geo",
      element: "geo",
      application: noIcd(1),
    });

    expect(audit.reaction).toBe("crystallizeCryo");
    expect(audit.crystallizeReaction).toMatchObject({
      crystallizedElement: "cryo",
      consumedAuraElement: "frozen",
    });
    expect(audit.frozenReaction).toMatchObject({
      operation: "consume",
      consumedGaugeUnits: 0.5,
    });
  });

  it("stops Electro-Charged when Crystallize removes a coexistence Aura", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1),
    });
    const audit = engine.processHit({
      frame: 1,
      sourceActorId: "geo",
      element: "geo",
      application: noIcd(2),
    });

    expect(audit.reaction).toBe("crystallizeElectro");
    expect(audit.periodicReaction).toMatchObject({
      reaction: "electroCharged",
      operation: "stop",
    });
    expect(audit.auraAfter).toEqual([
      expect.objectContaining({ element: "hydro" }),
    ]);
  });

  it("reports mapped Pyro durability after partially consuming ordinary Pyro and Burning", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(1),
    });
    const audit = engine.processHit({
      frame: 1,
      sourceActorId: "geo",
      element: "geo",
      application: noIcd(1),
    });

    expect(audit.crystallizeReaction).toMatchObject({
      reaction: "crystallizePyro",
      consumedAuraElement: "pyro",
      auraGaugeUnitsBefore: 2,
      auraConsumedGaugeUnits: 0.5,
      auraGaugeUnitsAfter: 1.5,
    });
    expect(audit.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "pyro",
        }),
        expect.objectContaining({
          element: "burning",
          gaugeUnits: 1.5,
        }),
      ]),
    );
    expect(
      audit.auraAfter?.find((entry) => entry.element === "pyro")?.gaugeUnits,
    ).toBeCloseTo(0.298596491228, 12);
  });
});

describe("Crystallize shield formula", () => {
  it("matches the fixed level table and EM absorption multiplier", () => {
    const zeroEm = calcCrystallizeShield(90, 0);
    const oneHundredEm = calcCrystallizeShield(90, 100);

    expect(zeroEm).toMatchObject({
      characterLevel: 90,
      elementalMastery: 0,
      baseHp: 1851.0603,
      elementalMasteryBonus: 0,
      generalAbsorption: 1851.0603,
    });
    expect(zeroEm.matchingElementAbsorption).toBeCloseTo(4627.65075, 11);
    expect(zeroEm.geoDamageAbsorption).toBeCloseTo(2776.59045, 11);
    expect(oneHundredEm.elementalMasteryBonus).toBeCloseTo(
      (40 / 9) * (100 / 1500),
      12,
    );
    expect(oneHundredEm.generalAbsorption).toBeCloseTo(
      1851.0603 * (1 + oneHundredEm.elementalMasteryBonus),
      12,
    );
  });
});

function makeCrystallizeConfig({
  triggerFrames = [0],
  pickupFrames = [53, 54],
  duration = 20,
  emBuffAtSpawn = false,
}: {
  triggerFrames?: number[];
  pickupFrames?: number[];
  duration?: number;
  emBuffAtSpawn?: boolean;
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "结晶目标",
          position: { x: 10, y: 5 },
          hitboxRadius: 1,
          initialAura: [{ element: "pyro", gaugeUnits: 4 }],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "geo",
        name: "Geo",
        element: "geo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "geo",
      swapFrames: 12,
      abilities: [
        {
          id: "geo-skill",
          actorId: "geo",
          name: "岩命中",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "geo-hit",
              label: "岩命中",
              frame: 0,
              scaling: 1,
              element: "geo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: noIcd(1),
            },
          ],
          ...(emBuffAtSpawn
            ? {
                buffs: [
                  {
                    key: "spawn-em",
                    label: "生成帧精通",
                    target: "self",
                    stat: "em" as const,
                    value: 200,
                    startFrame: 10,
                    durationFrames: 30,
                  },
                ],
              }
            : {}),
        },
      ],
      commands: [
        ...triggerFrames.map((atFrame) => ({
          type: "skill" as const,
          actorId: "geo",
          abilityId: "geo-skill",
          atFrame,
        })),
        ...pickupFrames.map((atFrame) => ({
          type: "pickUpCrystallize" as const,
          element: "pyro" as const,
          atFrame,
        })),
      ].sort((left, right) => (left.atFrame ?? 0) - (right.atFrame ?? 0)),
    },
  };
}

describe("Crystallize shard and shield simulation", () => {
  it("logs spawn, too-early pickup, exact pickup, shield, and expiry", () => {
    const result = simulate(makeCrystallizeConfig(), {
      critMode: "noCrit",
    });
    const direct = result.damageEvents[0]!;

    expect(direct).toMatchObject({
      frame: 0,
      reaction: "crystallizePyro",
      reactionAudit: {
        crystallizeReaction: {
          shardSpawnFrame: 23,
          earliestPickupFrame: 54,
        },
      },
    });
    expect(
      result.crystallizeShardLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        success: entry.success,
        reason: entry.reason,
        shardId: entry.shardId,
        shieldLogId: entry.shieldLogId,
      })),
    ).toEqual([
      {
        operation: "spawn",
        frame: 23,
        success: true,
        reason: "SPAWNED",
        shardId: 0,
        shieldLogId: null,
      },
      {
        operation: "pickup-attempt",
        frame: 53,
        success: false,
        reason: "TOO_EARLY",
        shardId: 0,
        shieldLogId: null,
      },
      {
        operation: "pickup",
        frame: 54,
        success: true,
        reason: "PICKED_UP",
        shardId: 0,
        shieldLogId: 0,
      },
    ]);
    expect(result.crystallizeShardLog[0]?.position).not.toBeNull();
    expect(result.crystallizeShardLog[0]?.spawnRadius).toBe(1.5);
    expect(result.crystallizeShieldLog).toMatchObject([
      {
        operation: "add",
        frame: 54,
        shieldId: 0,
        shardId: 0,
        element: "pyro",
        sourceCharacterLevel: 90,
        sourceElementalMastery: 100,
        expiresAtFrame: 960,
        previousShieldId: null,
      },
      {
        operation: "expire",
        frame: 960,
        shieldId: 0,
        currentBaseHp: 0,
      },
    ]);
    expect(result.crystallizeShieldTimeline).toMatchObject([
      {
        frame: 54,
        operation: "add",
        shieldId: 0,
        element: "pyro",
      },
      {
        frame: 960,
        operation: "expire",
        shieldId: null,
        element: null,
        generalAbsorption: 0,
      },
    ]);
    expect(result.auraTimeline[0]).toMatchObject({
      reaction: "crystallizePyro",
      auraApplied: [{ element: "geo", gaugeUnits: 1 }],
      auraConsumed: [{ element: "pyro", gaugeUnits: 0.5 }],
    });
  });

  it("snapshots level and EM at shard spawn rather than trigger or pickup", () => {
    const result = simulate(
      makeCrystallizeConfig({
        pickupFrames: [54],
        emBuffAtSpawn: true,
      }),
      { critMode: "noCrit" },
    );

    expect(result.crystallizeShardLog[0]).toMatchObject({
      operation: "spawn",
      frame: 23,
      sourceElementalMastery: 300,
    });
    expect(result.crystallizeShieldLog[0]).toMatchObject({
      operation: "add",
      frame: 54,
      sourceElementalMastery: 300,
    });
    expect(simulationResultSchema.safeParse(result).success).toBe(true);
    expect(assertTrustedSimulationResult(result)).toBe(result);
  });

  it("keeps shard positions reproducible and audits a pickup before spawn", () => {
    const config = makeCrystallizeConfig({
      pickupFrames: [22],
      duration: 2,
    });
    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });
    const otherSeed = simulate(
      { ...config, randomSeed: `${config.randomSeed}-other` },
      { critMode: "noCrit" },
    );

    expect(first.crystallizeShardLog).toMatchObject([
      {
        operation: "pickup-attempt",
        frame: 22,
        shardId: null,
        success: false,
        reason: "NO_MATCHING_SHARD",
      },
      {
        operation: "spawn",
        frame: 23,
        shardId: 0,
      },
    ]);
    expect(first.crystallizeShardLog[1]?.position).toEqual(
      second.crystallizeShardLog[1]?.position,
    );
    expect(first.crystallizeShardLog[1]?.position).not.toEqual(
      otherSeed.crystallizeShardLog[1]?.position,
    );
  });

  it("evicts the oldest shard when the fourth active shard spawns", () => {
    const result = simulate(
      makeCrystallizeConfig({
        triggerFrames: [0, 60, 120, 180],
        pickupFrames: [],
        duration: 5,
      }),
      { critMode: "noCrit" },
    );

    expect(
      result.crystallizeShardLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        shardId: entry.shardId,
        reason: entry.reason,
      })),
    ).toEqual([
      { operation: "spawn", frame: 23, shardId: 0, reason: "SPAWNED" },
      { operation: "spawn", frame: 83, shardId: 1, reason: "SPAWNED" },
      { operation: "spawn", frame: 143, shardId: 2, reason: "SPAWNED" },
      {
        operation: "evict",
        frame: 203,
        shardId: 0,
        reason: "ACTIVE_SHARD_LIMIT",
      },
      { operation: "spawn", frame: 203, shardId: 3, reason: "SPAWNED" },
    ]);
  });

  it("overwrites the active Crystallize shield and ignores its stale expiry", () => {
    const result = simulate(
      makeCrystallizeConfig({
        triggerFrames: [0, 60],
        pickupFrames: [54, 114],
        duration: 18,
      }),
      { critMode: "noCrit" },
    );

    expect(
      result.crystallizeShieldLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        shieldId: entry.shieldId,
        previousShieldId: entry.previousShieldId,
      })),
    ).toEqual([
      {
        operation: "add",
        frame: 54,
        shieldId: 0,
        previousShieldId: null,
      },
      {
        operation: "overwrite",
        frame: 114,
        shieldId: 1,
        previousShieldId: 0,
      },
      {
        operation: "expire",
        frame: 114 + CRYSTALLIZE_CONSTANTS.shieldDurationFrames,
        shieldId: 1,
        previousShieldId: null,
      },
    ]);
  });

  it("accepts the any-element pickup selector", () => {
    const config = makeCrystallizeConfig({
      pickupFrames: [54],
    });
    const pickup = config.timeline?.commands.find(
      (command) => command.type === "pickUpCrystallize",
    );
    if (pickup?.type !== "pickUpCrystallize") {
      throw new Error("expected a Crystallize pickup command");
    }
    pickup.element = "any";

    const result = simulate(config, { critMode: "noCrit" });
    expect(result.crystallizeShardLog).toMatchObject([
      { operation: "spawn", element: "pyro" },
      {
        operation: "pickup",
        element: "pyro",
        success: true,
      },
    ]);
  });

  it("rejects forged shard commands, shield identity, formula, expiry, and timeline projections at both boundaries", () => {
    const result = simulate(
      makeCrystallizeConfig({
        triggerFrames: [0, 60],
        pickupFrames: [54, 114],
        duration: 18,
      }),
      { critMode: "noCrit" },
    );

    expectCrystallizeMutationRejected(result, (mutation) => {
      const pickup = mutation.crystallizeShardLog.find(
        (row) => row.operation === "pickup",
      )!;
      pickup.pickupCommandIndex = 0;
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      const pickupIndex = mutation.crystallizeShardLog.findIndex(
        (row) => row.operation === "pickup",
      );
      mutation.crystallizeShardLog.splice(pickupIndex, 1);
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      const overwrite = mutation.crystallizeShieldLog.find(
        (row) => row.operation === "overwrite",
      )!;
      overwrite.operation = "add";
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      const overwrite = mutation.crystallizeShieldLog.find(
        (row) => row.operation === "overwrite",
      )!;
      overwrite.previousShieldId = null;
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      mutation.crystallizeShieldLog[0]!.generalAbsorption += 1;
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      mutation.crystallizeShieldLog[0]!.sourceCharacterLevel = 1;
    });
    expectCrystallizeMutationRejected(
      result,
      (mutation) => {
        for (const shard of mutation.crystallizeShardLog) {
          if (shard.shardId !== null) {
            shard.sourceElementalMastery = 777;
          }
        }
        for (const shield of mutation.crystallizeShieldLog) {
          const calculation = calcCrystallizeShield(
            shield.sourceCharacterLevel,
            777,
          );
          shield.sourceElementalMastery = 777;
          shield.baseHp = calculation.baseHp;
          shield.elementalMasteryBonus = calculation.elementalMasteryBonus;
          shield.generalAbsorption = calculation.generalAbsorption;
          shield.matchingElementAbsorption =
            calculation.matchingElementAbsorption;
          shield.geoDamageAbsorption = calculation.geoDamageAbsorption;
          shield.currentBaseHp =
            shield.operation === "add" || shield.operation === "overwrite"
              ? calculation.baseHp
              : 0;
        }
        for (const [
          index,
          point,
        ] of mutation.crystallizeShieldTimeline.entries()) {
          const shield = mutation.crystallizeShieldLog[index]!;
          point.generalAbsorption =
            point.shieldId === null
              ? 0
              : shield.currentBaseHp * (1 + shield.elementalMasteryBonus);
        }
      },
      /spawn-frame elemental mastery/,
    );
    expectCrystallizeMutationRejected(
      result,
      (mutation) => {
        for (const shield of mutation.crystallizeShieldLog) {
          const forgedBaseHp = shield.baseHp + 123;
          shield.baseHp = forgedBaseHp;
          shield.generalAbsorption =
            forgedBaseHp * (1 + shield.elementalMasteryBonus);
          shield.matchingElementAbsorption = shield.generalAbsorption * 2.5;
          shield.geoDamageAbsorption = shield.generalAbsorption * 1.5;
          shield.currentBaseHp =
            shield.operation === "add" || shield.operation === "overwrite"
              ? forgedBaseHp
              : 0;
        }
        for (const [
          index,
          point,
        ] of mutation.crystallizeShieldTimeline.entries()) {
          const shield = mutation.crystallizeShieldLog[index]!;
          point.generalAbsorption =
            point.shieldId === null
              ? 0
              : shield.currentBaseHp * (1 + shield.elementalMasteryBonus);
        }
      },
      /formula baseHp/,
    );
    expectCrystallizeMutationRejected(result, (mutation) => {
      const expiry = mutation.crystallizeShieldLog.find(
        (row) => row.operation === "expire",
      )!;
      expiry.frame -= 1;
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      mutation.crystallizeShieldTimeline[0]!.id += 1;
    });
    expectCrystallizeMutationRejected(result, (mutation) => {
      mutation.crystallizeShieldTimeline[0]!.generalAbsorption += 1;
    });
  });
});
