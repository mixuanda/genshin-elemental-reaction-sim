import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type AbilityDefinition,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { beforeAll, describe, expect, it } from "vitest";
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
  mutate: (value: SimulationResult) => void
): void {
  const publicWire = cloneResult(result);
  mutate(publicWire);
  expect(
    simulationResultSchema.safeParse(publicWire).success,
    `${label}: public SimulationResult boundary`
  ).toBe(false);

  const trustedResult = cloneResult(result);
  mutate(trustedResult);
  expect(
    () => assertTrustedSimulationResult(trustedResult),
    `${label}: trusted sim-core boundary`
  ).toThrow(
    /Trusted SimulationResult 1\.46 integrity validation failed/
  );
}

function makeLegacyEnergyAuditConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;

  return makeConfig({
    dataVersion: "energy-result-integrity-legacy",
    randomSeed: "energy-result-integrity-legacy",
    duration: 2,
    cycleLength: 2,
    characters: [
      {
        ...template,
        id: "a",
        name: "Legacy Pyro",
        element: "pyro",
        energyMax: 60,
        initialEnergy: 10,
        stats: {
          ...template.stats,
          energyRecharge: 1.5
        }
      },
      {
        ...template,
        id: "b",
        name: "Legacy Cryo",
        element: "cryo",
        energyMax: 60,
        initialEnergy: 0,
        stats: {
          ...template.stats,
          energyRecharge: 2
        }
      }
    ],
    rotation: [
      {
        id: "legacy-source",
        actorId: "a",
        name: "Legacy source",
        at: 0,
        once: true,
        energyGains: [
          {
            target: "a",
            amount: 5,
            source: "legacy-flat-energy",
            internalCooldown: {
              key: "legacy-flat-energy-icd",
              duration: 1
            }
          }
        ],
        particles: [
          {
            id: "legacy-scheduled-orb",
            source: "legacy-scheduled-orb",
            element: "neutral",
            kind: "orb",
            count: 1,
            spawnOffset: 0,
            travelTime: 0.25
          }
        ]
      },
      {
        id: "legacy-fixed-blocked",
        actorId: "a",
        name: "Legacy fixed blocked",
        at: 0.1,
        once: true,
        energyGains: [
          {
            target: "a",
            amount: 5,
            source: "legacy-flat-energy",
            internalCooldown: {
              key: "legacy-flat-energy-icd",
              duration: 1
            }
          }
        ]
      },
      {
        id: "legacy-activate-b",
        actorId: "b",
        name: "Legacy activate B",
        at: 0.2,
        once: true
      },
      {
        id: "legacy-spend",
        actorId: "a",
        name: "Legacy spend",
        at: 0.5,
        once: true,
        energyCost: 10
      },
      {
        id: "legacy-skip",
        actorId: "b",
        name: "Legacy skip",
        at: 0.6,
        once: true,
        energyCost: 50
      }
    ]
  });
}

function makeLegalEnergyAuditConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const primer: AbilityDefinition = {
    id: "legal-primer",
    actorId: "a",
    name: "Legal primer",
    kind: "skill",
    cancelFrame: 10,
    animationEndFrame: 10,
    cooldownFrames: 0,
    hits: [
      {
        id: "legal-particle-hit-0",
        frame: 0,
        scaling: 0,
        element: "pyro"
      },
      {
        id: "legal-particle-hit-5",
        frame: 5,
        scaling: 0,
        element: "pyro"
      }
    ],
    particles: [
      {
        id: "legal-hit-particle",
        source: "legal-hit-particle",
        element: "pyro",
        count: 1,
        travelFrames: 0,
        trigger: {
          kind: "hit-confirm",
          hitIds: [
            "legal-particle-hit-0",
            "legal-particle-hit-5"
          ],
          internalCooldown: {
            key: "legal-particle-icd",
            durationFrames: 10
          }
        }
      }
    ]
  };
  const spender: AbilityDefinition = {
    id: "legal-spend",
    actorId: "a",
    name: "Legal spend",
    kind: "burst",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    energyCost: 10
  };
  const skipped: AbilityDefinition = {
    id: "legal-skip",
    actorId: "a",
    name: "Legal skip",
    kind: "burst",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    energyCost: 20
  };

  return makeConfig({
    dataVersion: "energy-result-integrity-legal",
    randomSeed: "energy-result-integrity-legal",
    duration: 1,
    cycleLength: 1,
    characters: [
      {
        ...template,
        id: "a",
        name: "Legal Pyro",
        element: "pyro",
        energyMax: 60,
        initialEnergy: 10,
        stats: {
          ...template.stats,
          energyRecharge: 1
        }
      }
    ],
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 12,
      abilities: [primer, spender, skipped],
      commands: [
        {
          type: "skill",
          actorId: "a",
          abilityId: primer.id
        },
        {
          type: "burst",
          actorId: "a",
          abilityId: spender.id
        },
        {
          type: "burst",
          actorId: "a",
          abilityId: skipped.id
        }
      ]
    }
  });
}

function makeParticleCapAuditConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;

  return makeConfig({
    dataVersion: "energy-result-integrity-cap",
    randomSeed: "energy-result-integrity-cap",
    duration: 1,
    cycleLength: 1,
    characters: [
      {
        ...template,
        id: "a",
        name: "Capped receiver",
        element: "pyro",
        energyMax: 60,
        initialEnergy: 59,
        stats: {
          ...template.stats,
          energyRecharge: 1
        }
      }
    ],
    rotation: [
      {
        id: "cap-orb",
        actorId: "a",
        name: "Cap orb",
        at: 0,
        once: true,
        particles: [
          {
            id: "cap-orb",
            source: "cap-orb",
            element: "neutral",
            kind: "orb",
            count: 1,
            travelTime: 0
          }
        ]
      }
    ]
  });
}

function makeDuplicateHitConfirmParticleLegacyConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const particle = {
    id: "duplicate-explicit-particle",
    source: "duplicate-explicit-source",
    kind: "particle" as const,
    element: "pyro" as const,
    count: 1,
    travelTime: 0,
    trigger: {
      kind: "hit-confirm" as const,
      hitIds: ["duplicate-hit"]
    }
  };

  return makeConfig({
    dataVersion: "energy-result-integrity-duplicate-legacy",
    randomSeed: "energy-result-integrity-duplicate-legacy",
    duration: 1,
    cycleLength: 1,
    characters: [
      {
        ...template,
        id: "a",
        name: "Duplicate Legacy Pyro",
        element: "pyro",
        energyMax: 60,
        initialEnergy: 0,
        stats: {
          ...template.stats,
          energyRecharge: 1
        }
      }
    ],
    rotation: [
      {
        id: "duplicate-legacy-action",
        actorId: "a",
        name: "Duplicate legacy action",
        at: 0,
        once: true,
        hits: [
          {
            id: "duplicate-hit",
            offset: 0,
            scaling: 0,
            element: "pyro"
          },
          {
            id: "duplicate-hit",
            offset: 0,
            scaling: 0,
            element: "pyro"
          }
        ],
        particles: [
          structuredClone(particle),
          structuredClone(particle)
        ]
      }
    ]
  });
}

function makeDuplicateHitConfirmParticleLegalConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const particle = {
    id: "duplicate-explicit-particle",
    source: "duplicate-explicit-source",
    kind: "particle" as const,
    element: "pyro" as const,
    count: 1,
    travelFrames: 0,
    trigger: {
      kind: "hit-confirm" as const,
      hitIds: ["duplicate-hit"]
    }
  };
  const ability: AbilityDefinition = {
    id: "duplicate-legal-ability",
    actorId: "a",
    name: "Duplicate legal ability",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "duplicate-hit",
        frame: 0,
        scaling: 0,
        element: "pyro"
      },
      {
        id: "duplicate-hit",
        frame: 0,
        scaling: 0,
        element: "pyro"
      }
    ],
    particles: [
      structuredClone(particle),
      structuredClone(particle)
    ]
  };

  return makeConfig({
    dataVersion: "energy-result-integrity-duplicate-legal",
    randomSeed: "energy-result-integrity-duplicate-legal",
    duration: 1,
    cycleLength: 1,
    characters: [
      {
        ...template,
        id: "a",
        name: "Duplicate Legal Pyro",
        element: "pyro",
        energyMax: 60,
        initialEnergy: 0,
        stats: {
          ...template.stats,
          energyRecharge: 1
        }
      }
    ],
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 12,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "a",
          abilityId: ability.id
        }
      ]
    }
  });
}

function requireEnergyRow(
  result: SimulationResult,
  predicate: (
    row: SimulationResult["energyLog"][number]
  ) => boolean,
  description: string
): SimulationResult["energyLog"][number] {
  const row = result.energyLog.find(predicate);
  if (row === undefined) {
    throw new Error(`Missing energy row: ${description}`);
  }
  return row;
}

function requireCurvePoint(
  result: SimulationResult,
  predicate: (
    point: SimulationResult["energyCurve"][number]
  ) => boolean,
  description: string
): SimulationResult["energyCurve"][number] {
  const point = result.energyCurve.find(predicate);
  if (point === undefined) {
    throw new Error(`Missing energy curve point: ${description}`);
  }
  return point;
}

let legacyResult: SimulationResult;
let legalResult: SimulationResult;
let capResult: SimulationResult;
let duplicateLegacyResult: SimulationResult;
let duplicateLegalResult: SimulationResult;

beforeAll(() => {
  legacyResult = simulate(makeLegacyEnergyAuditConfig());
  legalResult = simulate(makeLegalEnergyAuditConfig());
  capResult = simulate(makeParticleCapAuditConfig());
  duplicateLegacyResult = simulate(
    makeDuplicateHitConfirmParticleLegacyConfig()
  );
  duplicateLegalResult = simulate(
    makeDuplicateHitConfirmParticleLegalConfig()
  );
});

describe("current SimulationResult energy replay integrity", () => {
  it("accepts compact legacy and legal energy audit vectors", () => {
    expect(legacyResult.compatibilityMode).toBe("legacy-v0.1");
    expect(legalResult.compatibilityMode).toBe("legal-frame-v1");
    expect(legacyResult.energyLog.some((row) => !row.applied)).toBe(
      true
    );
    expect(legalResult.skippedActions).toHaveLength(1);
    expect(
      legalResult.particleTriggerLog.map((row) => row.triggered)
    ).toEqual([true, false]);

    expectAcceptedByPublicAndTrusted(legacyResult);
    expectAcceptedByPublicAndTrusted(legalResult);
    expectAcceptedByPublicAndTrusted(capResult);
  });

  it("accepts identical explicit hit-confirm particle producers one-to-one per hit group", () => {
    for (const result of [
      duplicateLegacyResult,
      duplicateLegalResult
    ]) {
      expect(result.particleTriggerLog).toHaveLength(4);
      expect(
        new Set(
          result.particleTriggerLog.map(
            (trigger) => trigger.hitGroupId
          )
        ).size
      ).toBe(2);
      expect(result.particleEvents).toHaveLength(4);
      expect(result.energyLog).toHaveLength(4);
      expectAcceptedByPublicAndTrusted(result);
    }
  });

  it("rejects coordinated removal of one indistinguishable producer and its energy projections", () => {
    expectRejectedByPublicAndTrusted(
      "duplicate trigger, particle child, energy row, curve, and summary removed together",
      duplicateLegalResult,
      (mutation) => {
        const removedTrigger =
          mutation.particleTriggerLog.splice(1, 1)[0];
        if (removedTrigger === undefined) {
          throw new Error(
            "Duplicate legal result must expose a second trigger."
          );
        }

        mutation.particleEvents =
          mutation.particleEvents.filter(
            (event) =>
              event.triggerLogId !== removedTrigger.id
          );
        const triggerIdMap = new Map<number, number>();
        mutation.particleTriggerLog.forEach((trigger, index) => {
          triggerIdMap.set(trigger.id, index);
          trigger.id = index;
        });
        mutation.particleEvents.forEach((event, index) => {
          event.id = index;
          if (event.triggerLogId !== null) {
            event.triggerLogId =
              triggerIdMap.get(event.triggerLogId) ?? null;
          }
        });

        mutation.energyLog.splice(1, 1);
        let currentEnergy = 0;
        mutation.energyLog.forEach((row, index) => {
          row.id = index;
          row.energyBefore = currentEnergy;
          currentEnergy += row.gainedEnergy;
          row.energyAfter = currentEnergy;
        });

        const particleCurveIndexes =
          mutation.energyCurve.flatMap((point, index) =>
            point.kind === "particle" ? [index] : []
          );
        const removedCurveIndex = particleCurveIndexes[1];
        if (removedCurveIndex === undefined) {
          throw new Error(
            "Duplicate legal result must expose a second particle curve point."
          );
        }
        mutation.energyCurve.splice(removedCurveIndex, 1);
        currentEnergy = 0;
        mutation.energyCurve.forEach((point, index) => {
          point.id = index;
          if (point.kind === "particle") {
            currentEnergy +=
              mutation.energyLog[
                mutation.energyCurve
                  .slice(0, index)
                  .filter(
                    (candidate) =>
                      candidate.kind === "particle"
                  ).length
              ]?.gainedEnergy ?? 0;
          }
          point.energyByCharacter.a = currentEnergy;
        });

        const summary = mutation.energyStats.a;
        if (summary === undefined) {
          throw new Error(
            "Duplicate legal result must expose A energy stats."
          );
        }
        summary.gained = currentEnergy;
        summary.particleGained = currentEnergy;
        summary.final = currentEnergy;
      }
    );
  });

  it("rejects replacement, initial, and intermediate energy-curve forgeries", () => {
    expectRejectedByPublicAndTrusted(
      "whole curve replaced by a forged terminal snapshot",
      legalResult,
      (mutation) => {
        const terminal = mutation.energyCurve.at(-1);
        if (terminal === undefined) {
          throw new Error("Legal result must expose an energy curve.");
        }
        mutation.energyCurve = [
          {
            ...structuredClone(terminal),
            id: 0,
            frame: 0,
            timeSeconds: 0,
            kind: "initial",
            receiverId: null,
            source: "initial"
          }
        ];
      }
    );

    expectRejectedByPublicAndTrusted(
      "forged initial energy snapshot",
      legalResult,
      (mutation) => {
        const initial = mutation.energyCurve[0];
        const energy = initial?.energyByCharacter.a;
        if (initial === undefined || energy === undefined) {
          throw new Error(
            "Legal result must expose initial energy for A."
          );
        }
        initial.energyByCharacter.a = energy + 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      "forged intermediate energy snapshot",
      legalResult,
      (mutation) => {
        const point = mutation.energyCurve.find(
          (candidate) => candidate.kind === "particle"
        );
        if (point === undefined) {
          throw new Error(
            "Legal result must expose an intermediate particle point."
          );
        }
        const energy = point.energyByCharacter.a;
        if (energy === undefined) {
          throw new Error(
            "Particle point must expose energy for A."
          );
        }
        point.energyByCharacter.a = energy + 1;
      }
    );
  });

  it("rejects coordinated action and skipped-action energy drift", () => {
    expectRejectedByPublicAndTrusted(
      "action before/after shifted while spent delta is preserved",
      legalResult,
      (mutation) => {
        const action = mutation.actionLog.find(
          (candidate) =>
            candidate.sourceAbilityId === "legal-spend"
        );
        if (action === undefined) {
          throw new Error(
            "Legal result must expose the successful spender."
          );
        }
        action.energyBefore += 4;
        action.energyAfter += 4;
      }
    );

    expectRejectedByPublicAndTrusted(
      "skipped before/cost shifted across all convenience projections",
      legalResult,
      (mutation) => {
        const skipped = mutation.skippedActions[0];
        const execution = mutation.timelineExecution;
        if (
          skipped === undefined ||
          execution === undefined ||
          skipped.timelineCommandIndex === undefined
        ) {
          throw new Error(
            "Legal result must expose one energy-rejected command."
          );
        }
        const command =
          execution.commandResults[skipped.timelineCommandIndex];
        const failure = execution.failures.find(
          (candidate) =>
            candidate.commandIndex === skipped.timelineCommandIndex
        );
        if (command === undefined || failure === undefined) {
          throw new Error(
            "Rejected command must expose command and failure audits."
          );
        }

        skipped.energyBefore += 7;
        skipped.energyCost += 7;
        command.energyBefore = skipped.energyBefore;
        command.energyCost = skipped.energyCost;
        failure.energyBefore = skipped.energyBefore;
        failure.energyCost = skipped.energyCost;
      }
    );
  });

  it("rejects fixed-energy raw, source, receiver, application, and ICD drift", () => {
    expectRejectedByPublicAndTrusted(
      "fixed raw energy",
      legacyResult,
      (mutation) => {
        requireEnergyRow(
          mutation,
          (row) => row.kind === "fixed" && row.applied,
          "applied fixed gain"
        ).rawEnergy += 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      "fixed source coordinated with its curve label",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "fixed" && candidate.applied,
          "applied fixed gain"
        );
        row.source = "forged-fixed-source";
        requireCurvePoint(
          mutation,
          (point) =>
            point.kind === "fixed" &&
            point.frame === row.frame &&
            point.receiverId === row.receiverId,
          "applied fixed gain"
        ).source = row.source;
      }
    );

    expectRejectedByPublicAndTrusted(
      "blocked fixed receiver coordinated with its curve",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "fixed" && !candidate.applied,
          "blocked fixed gain"
        );
        row.receiverId = "b";
        requireCurvePoint(
          mutation,
          (point) =>
            point.kind === "fixed-blocked" &&
            point.frame === row.frame,
          "blocked fixed gain"
        ).receiverId = "b";
      }
    );

    expectRejectedByPublicAndTrusted(
      "blocked fixed gain forged as an applied zero child",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "fixed" && !candidate.applied,
          "blocked fixed gain"
        );
        row.applied = true;
        row.blockedReason = null;
        requireCurvePoint(
          mutation,
          (point) =>
            point.kind === "fixed-blocked" &&
            point.frame === row.frame,
          "blocked fixed gain"
        ).kind = "fixed";
      }
    );

    expectRejectedByPublicAndTrusted(
      "fixed energy ICD ready frame",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "fixed" && candidate.applied,
          "applied fixed gain"
        );
        if (row.internalCooldownReadyFrame === null) {
          throw new Error(
            "Applied fixed row must expose an ICD ready frame."
          );
        }
        row.internalCooldownReadyFrame += 1;
      }
    );
  });

  it("rejects scheduled particle element, count, and arrival-window drift", () => {
    expectRejectedByPublicAndTrusted(
      "particle event element",
      legacyResult,
      (mutation) => {
        mutation.particleEvents[0]!.particleElement = "pyro";
      }
    );

    expectRejectedByPublicAndTrusted(
      "particle event count",
      legacyResult,
      (mutation) => {
        mutation.particleEvents[0]!.particleCount += 1;
      }
    );

    expectRejectedByPublicAndTrusted(
      "particle received-within-simulation flag",
      legacyResult,
      (mutation) => {
        mutation.particleEvents[0]!.receivedWithinSimulation = false;
      }
    );
  });

  it("rejects particle-row kind, receiver, field state, ER, and formula drift", () => {
    expectRejectedByPublicAndTrusted(
      "particle row relabeled fixed with summary buckets synchronized",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "particle" &&
            candidate.receiverId === "a",
          "particle energy for A"
        );
        const summary = mutation.energyStats.a;
        if (summary === undefined) {
          throw new Error("Missing A energy summary.");
        }
        row.kind = "fixed";
        summary.fixedGained += row.gainedEnergy;
        summary.particleGained -= row.gainedEnergy;
      }
    );

    expectRejectedByPublicAndTrusted(
      "particle row ghost receiver with zero remaining A aggregates",
      capResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) => candidate.kind === "particle",
          "capped particle energy"
        );
        const summary = mutation.energyStats.a;
        const curve = mutation.energyCurve.find(
          (point) => point.kind === "particle"
        );
        if (summary === undefined || curve === undefined) {
          throw new Error(
            "Missing capped receiver summary or particle curve."
          );
        }
        row.receiverId = "ghost";
        summary.gained = 0;
        summary.particleGained = 0;
        summary.wasted = 0;
        summary.final = summary.initial;
        curve.receiverId = "ghost";
        curve.energyByCharacter.a = summary.initial;
      }
    );

    expectRejectedByPublicAndTrusted(
      "particle active-character and on-field state",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "particle" &&
            candidate.receiverId === "a",
          "off-field particle energy for A"
        );
        row.activeCharacterId = "a";
        row.isOnField = true;
      }
    );

    expectRejectedByPublicAndTrusted(
      "particle Energy Recharge",
      legacyResult,
      (mutation) => {
        requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "particle" &&
            candidate.receiverId === "a",
          "particle energy for A"
        ).energyRecharge += 0.25;
      }
    );

    expectRejectedByPublicAndTrusted(
      "particle base-energy formula",
      legacyResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) =>
            candidate.kind === "particle" &&
            candidate.receiverId === "a",
          "particle energy for A"
        );
        if (row.baseEnergyPerParticle === null) {
          throw new Error(
            "Particle row must expose base energy per particle."
          );
        }
        row.baseEnergyPerParticle += 1;
      }
    );
  });

  it("rejects a coordinated forged particle cap projection", () => {
    expectRejectedByPublicAndTrusted(
      "particle cap, summary, and terminal curve",
      capResult,
      (mutation) => {
        const row = requireEnergyRow(
          mutation,
          (candidate) => candidate.kind === "particle",
          "capped particle energy"
        );
        const summary = mutation.energyStats.a;
        const terminal = mutation.energyCurve.at(-1);
        if (summary === undefined || terminal === undefined) {
          throw new Error(
            "Cap result must expose a summary and terminal curve."
          );
        }

        row.gainedEnergy = 2;
        row.wastedEnergy = 4;
        row.energyAfter = 61;
        summary.gained = 2;
        summary.particleGained = 2;
        summary.wasted = 4;
        summary.final = 61;
        terminal.energyByCharacter.a = 61;
      }
    );
  });

  it("rejects a hit-confirm particle disguised as a scheduled particle", () => {
    expectRejectedByPublicAndTrusted(
      "trigger log removed and child backlinks cleared",
      legalResult,
      (mutation) => {
        const particle = mutation.particleEvents[0];
        if (particle === undefined) {
          throw new Error(
            "Legal result must expose a hit-confirm particle."
          );
        }
        particle.triggerLogId = null;
        particle.triggerHitId = null;
        mutation.particleTriggerLog = [];
      }
    );
  });

  it("rejects an ICD-blocked trigger forged into a success with a fake child", () => {
    expectRejectedByPublicAndTrusted(
      "blocked particle trigger promoted with fake particle child",
      legalResult,
      (mutation) => {
        const blocked = mutation.particleTriggerLog.find(
          (candidate) =>
            !candidate.triggered &&
            candidate.blockedReason === "INTERNAL_COOLDOWN"
        );
        const template = mutation.particleEvents[0];
        if (blocked === undefined || template === undefined) {
          throw new Error(
            "Legal result must expose a blocked trigger and particle template."
          );
        }

        blocked.triggered = true;
        blocked.blockedReason = null;
        if (
          blocked.internalCooldownDurationFrames !== null &&
          blocked.internalCooldownReadyFrame !== null
        ) {
          blocked.internalCooldownReadyFrame =
            blocked.frame +
            blocked.internalCooldownDurationFrames;
        }
        mutation.particleEvents.push({
          ...structuredClone(template),
          id: mutation.particleEvents.length,
          spawnFrame: blocked.frame,
          receiveFrame: blocked.frame,
          spawnTimeSeconds: blocked.timeSeconds,
          receiveTimeSeconds: blocked.timeSeconds,
          receivedWithinSimulation: true,
          triggerLogId: blocked.id,
          triggerHitId: blocked.hitId
        });
      }
    );
  });
});
