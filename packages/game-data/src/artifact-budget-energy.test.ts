import { describe, expect, it } from "vitest";
import { replayArtifactBudgetEnergy, minimumArtifactEnergyForFixedSchedule, type ArtifactBudgetEnergyContract, type ArtifactBudgetEnergyEvent } from "./artifact-budget-energy";
import { balanceFiveStarArtifactRolls } from "./artifact-budget-balance";
import { resolveArtifactBuild, type ArtifactPieceInput } from "./artifact-build";
import { calculateParticleEnergy } from "../../sim-core/src/energy";
import noelleEvidence from "../../../docs/fixtures/noelle-q-normal-reference.expected.json";

const sourceRef = "https://library.keqingmains.com/combat-mechanics/energy";
type EventInput<T = ArtifactBudgetEnergyEvent> = T extends ArtifactBudgetEnergyEvent ? Omit<T, "sourceRef"> : never;
const event = <T extends EventInput>(input: T): T & { sourceRef: string } => ({ ...input, sourceRef });
const contract = (events: ArtifactBudgetEnergyEvent[], overrides: Partial<ArtifactBudgetEnergyContract> = {}): ArtifactBudgetEnergyContract => ({
  id: "unit-explicit-energy-schedule", actorId: "unit-recipient", scope: "declared-fixed-event-schedule",
  capacity: 60, initialEnergy: 60, nonArtifactEnergyRecharge: 1, minimumEndingEnergy: 0, events, ...overrides,
});
const reserve = (id: string, frame: number, order = 0) => event({ id: `${id}-reserve`, kind: "burst-reserve", reservationId: id, frame, order, amount: 60 });
const spend = (id: string, frame: number, order = 0) => event({ id: `${id}-spend`, kind: "burst-spend", reservationId: id, frame, order, amount: 60 });
const particle = (id: string, frame: number, energyAt100PercentER: number, order = 0) => event({ id, kind: "particle-arrival", frame, order, energyAt100PercentER });

describe("artifact budget energy feasibility for explicit timed source events", () => {
  it("replays the existing Noelle source fixture's actual reservation, debit and seeded flat energy", () => {
    const costs: ArtifactBudgetEnergyEvent[] = noelleEvidence.energyCostLog.map((row, i) => ({
      id: `noelle-source-cost-${i}`, frame: row.frame, order: row.eventSequence, sourceRef: "docs/fixtures/noelle-q-normal-reference.expected.json#energyCostLog",
      kind: row.operation === "reserve" ? "burst-reserve" : "burst-spend", reservationId: "source-Q-0", amount: row.energyCost,
    }));
    const gains: ArtifactBudgetEnergyEvent[] = noelleEvidence.normalHitEnergyLog.map((row, i) => ({
      id: `noelle-source-normal-${i}`, frame: row.frame, order: row.eventSequence, sourceRef: row.sourceRef, kind: "flat-energy", amount: row.energyRequested,
    }));
    const fixed = contract([...costs, ...gains], { id: "noelle-existing-Q-N1-N4-source-v2", actorId: "noelle", minimumEndingEnergy: 1 });
    for (const artifactBonus of [0, 2]) {
      const result = replayArtifactBudgetEnergy(fixed, artifactBonus);
      expect(result.status).toBe("satisfied");
      expect(result.endingEnergy).toBe(noelleEvidence.energyStats.noelle.final);
      expect(result.trace[0]).toMatchObject({ before: 60, after: 60, reservedBefore: 0, reservedAfter: 60 });
      expect(result.trace[1]).toMatchObject({ before: 60, after: 0, reservedBefore: 60, reservedAfter: 0 });
      expect(result.trace.at(-1)).toMatchObject({ kind: "flat-energy", requested: 1, after: 1 });
      expect(result.actionAndParticleTiming).toBe("requires-candidate-resimulation");
    }
    // This finite opener is executable, but it does not restore its starting energy.
    const noFreeRefill = { ...fixed, minimumEndingEnergy: 60 };
    expect(replayArtifactBudgetEnergy(noFreeRefill, 10).failure).toMatchObject({ kind: "ending-reserve", available: 1, shortfall: 59 });
    expect(minimumArtifactEnergyForFixedSchedule(noFreeRefill, 10)).toBeNull();
    const repeatedQ = { ...fixed, events: [...fixed.events, reserve("second-Q", 1200), spend("second-Q", 1208)] };
    expect(replayArtifactBudgetEnergy(repeatedQ, 10).failure).toMatchObject({ eventId: "second-Q-reserve", available: 1, shortfall: 59 });
  });

  it("uses source particle energy before ER/capping and leaves flat refunds unscaled", () => {
    const energyAt100PercentER = calculateParticleEnergy({ particleElement: "neutral", particleKind: "particle", particleCount: 20,
      receiverElement: "geo", isOnField: true, partySize: 4, energyRecharge: 1 }).rawEnergy;
    expect(energyAt100PercentER).toBe(40);
    const fixed = contract([reserve("Q1", 0), spend("Q1", 8), particle("actual-normalized-particles", 500, energyAt100PercentER),
      event({ id: "declared-flat-refund", kind: "flat-energy", amount: 10, frame: 600, order: 0 }), reserve("Q2", 1000), spend("Q2", 1008)]);
    expect(replayArtifactBudgetEnergy(fixed, 0).failure).toMatchObject({ eventId: "Q2-reserve", available: 50, shortfall: 10 });
    const result = replayArtifactBudgetEnergy(fixed, 0.25);
    expect(result.status).toBe("satisfied");
    expect(result.trace[2]).toMatchObject({ requested: 50, applied: 50 });
    expect(result.trace[3]).toMatchObject({ requested: 10, applied: 10 });
    expect(minimumArtifactEnergyForFixedSchedule(fixed, 0.5)).toBeCloseTo(0.25, 9);
    expect(minimumArtifactEnergyForFixedSchedule({ ...fixed, nonArtifactEnergyRecharge: 1.2 }, 0.5)).toBeCloseTo(0.05, 9);
    expect(minimumArtifactEnergyForFixedSchedule(fixed, 0.2)).toBeNull();
  });

  it("keeps field/element/orb normalization in the actual source calculation rather than guessing from received capped deltas", () => {
    for (const [particleElement, particleKind, isOnField, expected] of [
      ["geo", "particle", true, 15], ["geo", "particle", false, 9],
      ["hydro", "particle", false, 3], ["neutral", "orb", false, 18],
    ] as const) {
      const raw = calculateParticleEnergy({ particleElement, particleKind, particleCount: 5, receiverElement: "geo", isOnField, partySize: 4, energyRecharge: 1 }).rawEnergy;
      expect(raw).toBe(expected);
      const result = replayArtifactBudgetEnergy(contract([particle("arrival", 0, raw)], { initialEnergy: 0 }), 1);
      expect(result.endingEnergy).toBe(expected * 2);
    }
  });

  it("checks energy at the input reservation, before a late arrival can fund a later debit", () => {
    const tooLate = contract([reserve("Q", 10, 0), particle("late-arrival", 10, 60, 1), spend("Q", 18)], { initialEnergy: 0 });
    const failed = replayArtifactBudgetEnergy(tooLate, 10);
    expect(failed.status).toBe("unsatisfied");
    expect(failed.trace).toHaveLength(1);
    expect(failed.trace[0]).toMatchObject({ blocked: true, applied: 0, after: 0, reservedAfter: 0 });
    expect(failed.failure).toMatchObject({ eventId: "Q-reserve", available: 0, shortfall: 60 });
    expect(minimumArtifactEnergyForFixedSchedule(tooLate, 10)).toBeNull();
    const timely = { ...tooLate, events: [particle("timely-arrival", 10, 60, 0), reserve("Q", 10, 1), spend("Q", 18)] };
    expect(replayArtifactBudgetEnergy(timely, 0).status).toBe("satisfied");
  });

  it("honors cap waste and prevents overlapping reservations from spending the same energy twice", () => {
    const wasted = contract([particle("while-full", 0, 60), reserve("Q1", 1), spend("Q1", 9), reserve("Q2", 1000), spend("Q2", 1008)]);
    const result = replayArtifactBudgetEnergy(wasted, 1);
    expect(result.trace[0]).toMatchObject({ requested: 120, applied: 0, wasted: 120, after: 60 });
    expect(result.failure).toMatchObject({ eventId: "Q2-reserve", available: 0 });
    expect(minimumArtifactEnergyForFixedSchedule(wasted, 10)).toBeNull();
    const overlapping = contract([reserve("Q1", 0), reserve("Q2", 1), spend("Q1", 8), spend("Q2", 9)]);
    expect(replayArtifactBudgetEnergy(overlapping, 0).failure).toMatchObject({ eventId: "Q2-reserve", available: 0 });
    const released = contract([reserve("cancelled-Q", 0), event({ id: "cancel", kind: "burst-release", reservationId: "cancelled-Q", frame: 1, order: 0 }), reserve("Q", 2), spend("Q", 10)]);
    expect(replayArtifactBudgetEnergy(released, 0)).toMatchObject({ status: "satisfied", endingEnergy: 0, endingReservedEnergy: 0 });
    expect(replayArtifactBudgetEnergy(contract([reserve("unfinished-Q", 0)]), 0).failure?.kind).toBe("outstanding-reservation");
  });

  it("balances legal ER only when a supplied timed schedule requires it and never claims an unreachable schedule passes", () => {
    const flower: ArtifactPieceInput = { slot: "flower", setId: "artifact-set:15001", rarity: 5, level: 20, mainStat: "hp", initialSubstats: 3,
      substats: [{ stat: "enerRech_", rolls: [3] }, { stat: "critDMG_", rolls: [3, 3, 3, 3, 3] }, { stat: "critRate_", rolls: [3] }, { stat: "atk_", rolls: [3] }] };
    const fixed = contract([reserve("Q1", 0), spend("Q1", 8), particle("particles", 500, 40),
      event({ id: "refund", kind: "flat-energy", amount: 10, frame: 600, order: 0 }), reserve("Q2", 1000), spend("Q2", 1008)]);
    const result = balanceFiveStarArtifactRolls([flower], stats => stats.critDMG_ ?? 0, { rotationEnergy: fixed });
    expect(result.energyConstraint.status).toBe("satisfied");
    expect(result.energyConstraint.rotation!.minimumArtifactBonus).toBeCloseTo(0.25, 9);
    expect(result.energyConstraint.actualArtifactBonus).toBeCloseTo(4 * 0.0648, 12);
    expect(result.energyConstraint.rotation!.replay.status).toBe("satisfied");
    expect(result.finalScore).toBeLessThan(result.initialScore); // Meeting a declared Q schedule can cost damage.
    expect(() => resolveArtifactBuild(result.pieces)).not.toThrow();
    const absent = structuredClone(flower);
    absent.substats[0]!.stat = "hp_";
    const failed = balanceFiveStarArtifactRolls([absent], stats => stats.critDMG_ ?? 0, { rotationEnergy: fixed });
    expect(failed.energyConstraint).toMatchObject({ status: "unsatisfied", minimumArtifactBonus: null,
      rotation: { maximumArtifactBonus: 0, minimumArtifactBonus: null, replay: { status: "unsatisfied" } } });
    // Mixed quality: each non-ER sub keeps its lowest tier; all five ER rolls stay discrete.
    const mixed = structuredClone(flower);
    mixed.substats = [{ stat: "enerRech_", rolls: [0, 3] }, { stat: "critDMG_", rolls: [0, 1, 3] },
      { stat: "hp_", rolls: [1, 3] }, { stat: "atk_", rolls: [2] }];
    const impossible = { ...fixed, events: fixed.events.map(row => row.kind === "flat-energy" ? { ...row, amount: 0 } : row) };
    const capacity = balanceFiveStarArtifactRolls([mixed], stats => stats.critDMG_ ?? 0, { rotationEnergy: impossible });
    expect(capacity.energyConstraint.rotation!.maximumArtifactBonus).toBeCloseTo(0.0453 + 0.0648 + 0.0518 + 0.0648 + 0.0648, 12);
    expect(capacity.energyConstraint.actualArtifactBonus).toBeCloseTo(capacity.energyConstraint.rotation!.maximumArtifactBonus, 12);
    expect(capacity.energyConstraint.status).toBe("unsatisfied");
    expect(capacity.energyConstraint.rotation!.minimumArtifactBonus).toBeNull();
    expect(() => resolveArtifactBuild(capacity.pieces)).not.toThrow();
  });

  it("rejects malformed, unsourced, non-finite, out-of-order and unmatched-reservation input", () => {
    const valid = contract([particle("arrival", 0, 60), reserve("Q", 1), spend("Q", 9)]);
    for (const change of [{ initialEnergy: 61 }, { minimumEndingEnergy: 61 }, { nonArtifactEnergyRecharge: Infinity }, { capacity: 0 }]) {
      expect(() => replayArtifactBudgetEnergy({ ...valid, ...change }, 0)).toThrow();
    }
    expect(() => replayArtifactBudgetEnergy(valid, Number.NaN)).toThrow();
    expect(() => replayArtifactBudgetEnergy({ ...valid, events: [...valid.events].reverse() }, 0)).toThrow();
    expect(() => replayArtifactBudgetEnergy({ ...valid, events: [particle("a", 0, 10), particle("b", 0, 10)] }, 0)).toThrow("order");
    expect(() => replayArtifactBudgetEnergy({ ...valid, events: [spend("unreserved", 0)] }, 0)).toThrow("reservation");
    expect(() => replayArtifactBudgetEnergy({ ...valid, events: [reserve("Q", 0), { ...spend("Q", 1), amount: 40 }] }, 0)).toThrow("same cost");
    expect(() => replayArtifactBudgetEnergy({ ...valid, events: [{ ...particle("a", 0, 10), sourceRef: "" }] }, 0)).toThrow("source-backed");
  });
});
