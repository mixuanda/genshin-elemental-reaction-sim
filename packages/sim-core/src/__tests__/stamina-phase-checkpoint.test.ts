import { beforeAll, describe, expect, it } from "vitest";
import type { StaminaCost } from "@genshin-dps-lab/schemas";
import { evaluatePhaseAlignedSteadyState, simulateWithStartup, type PhaseCheckpoint } from "../simulation-analysis";
import { StaminaRuntime } from "../stamina";
import { makeConfig } from "./fixtures";

const cost = (amount: number, consumeFrame = 0): StaminaCost => ({ amount, consumeFrame,
  source: { kind: "custom", note: "可独立手算的合成体力周期费用" } });
const model = (initialStamina: number) => ({ mode: "shared-stamina-v1" as const,
  profileId: "gcsim-b4ae769-stamina-v1" as const, initialStamina });

function periodicFixture() {
  return makeConfig({ duration: 2, cycleLength: 2, staminaModel: model(240),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "ca", actorId: "a", name: "延迟体力合成重击", kind: "charge", cancelFrame: 1,
        animationEndFrame: 1, cooldownFrames: 0, staminaCost: cost(12.5, 150),
        hits: [{ id: "hit", frame: 0, scaling: 1, element: "physical" }] }],
      commands: [{ type: "charge", actorId: "a", abilityId: "ca", atFrame: 1 }] } });
}

describe("complete shared-stamina phase checkpoints", () => {
  let actual: ReturnType<typeof simulateWithStartup>;
  beforeAll(() => {
    actual = simulateWithStartup(periodicFixture(), { mode: "steady-state", maximumWarmupCycles: 9,
      maximumPeriodCycles: 1, warmupEnergyMode: "configured" });
  });

  const evaluate = (checkpoints: PhaseCheckpoint[]) => evaluatePhaseAlignedSteadyState({ checkpoints,
    cycleTicks: 120, deterministic: true, checkpointProducer: "test-runtime-state-sensitivity",
    maximumPeriodCycles: 1, maximumWarmupCycles: 9 });

  // These two negative comparisons isolate evaluator sensitivity using real runtime
  // snapshots. Replacing one resource facet is NOT a second simulated trajectory.
  const suppliedPoints = (snapshot: ReturnType<StaminaRuntime["captureBefore"]>) => {
    const points = structuredClone(actual.result!.executionAudit!.phaseCheckpoints);
    const originalPending = points[0]!.state.pendingEvents as { stamina: { spends: Array<{ command: unknown }> } };
    const command = originalPending.stamina.spends[0]!.command;
    for (const point of points) {
      const { tick, pendingSpends, ...resource } = snapshot;
      (point.state.resourcesAndHp as Record<string, unknown>).stamina = structuredClone(resource);
      (point.state.pendingEvents as Record<string, unknown>).stamina = {
        phase: "player-recovery-then-delayed-spends-before-inputs",
        spends: pendingSpends.map((spend, order) => ({ remainingTicks: spend.frame - tick,
          inputAgeTicks: tick - spend.inputFrame, amount: spend.amount, actorId: spend.actorId,
          order, source: spend.source, consumeWhenZero: spend.consumeWhenZero, command })),
      };
    }
    return points;
  };

  it("establishes a continuous periodic run with an actual delayed stamina debit crossing each boundary", () => {
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    expect(actual.result!.timelineExecution!.failures).toEqual([]);
    expect(actual.steadyState!.periodCycles).toBe(1);
    // ATK 1000 × scaling 1 × DEF 190/(190+210) × RES 0.9 = 427.5 per two-second cycle.
    expect(actual.measurement!.totalDamage).toBeCloseTo(427.5, 12);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(213.75, 12);
    const points = actual.result!.executionAudit!.phaseCheckpoints;
    expect(points.every((point) => JSON.stringify(point.state) === JSON.stringify(points[0]!.state))).toBe(true);
    // Each spend is followed by 90 ineligible frames and 30 eligible frames
    // before the next spend: 30 × 25/60 = 12.5, exactly the declared cost.
    expect(points[0]!.state.resourcesAndHp).toMatchObject({ stamina: {
      version: "shared-stamina-state-v1", maximum: 240, current: 227.5,
      recovery: { nextRecoveryInTicks: 2, anchorStamina: 227.5, elapsedRecoveryTicks: 0 },
    } });
    expect(points[0]!.state.pendingEvents).toMatchObject({ stamina: {
      phase: "player-recovery-then-delayed-spends-before-inputs",
      spends: [{ remainingTicks: 31, inputAgeTicks: 119, amount: 12.5, actorId: "a", order: 0 }],
    } });
    // A declared debit longer than the default two-cycle tail must extend the
    // actual run rather than certify a queue cropped at the observation end.
    const longTailConfig = periodicFixture();
    longTailConfig.timeline!.abilities[0]!.staminaCost = cost(12.5, 390);
    const longTail = simulateWithStartup(longTailConfig, { mode: "steady-state", maximumWarmupCycles: 9,
      maximumPeriodCycles: 1, warmupEnergyMode: "configured" });
    expect(longTail.status, longTail.reasons.join("; ")).toBe("steady-state-established");
    expect(longTail.startup.simulationTicks).toBe(1080 + 390);
    expect(longTail.startup.measurementEndTick).toBe(1200);
    expect(longTail.result!.executionAudit!.phaseCheckpoints.at(-1)!.state.pendingEvents).toMatchObject({ stamina: { spends: [
      { remainingTicks: 31, inputAgeTicks: 359, order: 0 },
      { remainingTicks: 151, inputAgeTicks: 239, order: 1 },
      { remainingTicks: 271, inputAgeTicks: 119, order: 2 },
    ] } });
    expect(longTail.steadyState!.steadyStateDps).toBeCloseTo(213.75, 12);
  });

  it("does not identify equal stamina amounts with different actual recovery clocks as the same phase", () => {
    const first = new StaminaRuntime(model(100));
    const second = new StaminaRuntime(model(100));
    first.accept({ ...cost(0), consumeWhenZero: true }, 50, "a", 0);
    second.accept({ ...cost(0), consumeWhenZero: true }, 60, "a", 0);
    const firstSnapshot = first.captureBefore(120);
    const secondSnapshot = second.captureBefore(120);
    expect(firstSnapshot.current).toBe(100);
    expect(secondSnapshot.current).toBe(100);
    expect(firstSnapshot.recovery.nextRecoveryInTicks).toBe(21);
    expect(secondSnapshot.recovery.nextRecoveryInTicks).toBe(31);
    const points = suppliedPoints(firstSnapshot);
    expect(evaluate(points).status).toBe("established-for-supplied-checkpoints");
    points.at(-1)!.state.resourcesAndHp = suppliedPoints(secondSnapshot)[0]!.state.resourcesAndHp;
    expect(evaluate(points).status).toBe("not-established");
  });

  it("retains pre-event pending debits and refuses to merge different due times despite equal current stamina", () => {
    const first = new StaminaRuntime(model(100));
    const second = new StaminaRuntime(model(100));
    first.accept(cost(12.5, 150), 0, "a", 0);
    second.accept(cost(12.5, 150), 10, "a", 0);
    const firstSnapshot = first.captureBefore(120);
    const secondSnapshot = second.captureBefore(120);
    expect(firstSnapshot.current).toBe(100 + 29 * 25 / 60);
    expect(secondSnapshot.current).toBe(firstSnapshot.current);
    expect(secondSnapshot.recovery).toEqual(firstSnapshot.recovery);
    expect(firstSnapshot.pendingSpends).toMatchObject([{ frame: 150, inputFrame: 0, amount: 12.5 }]);
    expect(secondSnapshot.pendingSpends).toMatchObject([{ frame: 160, inputFrame: 10, amount: 12.5 }]);
    const points = suppliedPoints(firstSnapshot);
    expect(evaluate(points).status).toBe("established-for-supplied-checkpoints");
    points.at(-1)!.state.pendingEvents = suppliedPoints(secondSnapshot)[0]!.state.pendingEvents;
    expect(evaluate(points).status).toBe("not-established");

    // Capture is before both the tick-150 recovery and its due debit.
    const beforeDue = first.captureBefore(150);
    expect(beforeDue.current).toBe(100 + 59 * 25 / 60);
    expect(beforeDue.pendingSpends).toMatchObject([{ frame: 150 }]);
    first.advanceThrough(150);
    expect(first.available).toBe(112.5);
    expect(beforeDue.pendingSpends).toHaveLength(1);
  });
});
