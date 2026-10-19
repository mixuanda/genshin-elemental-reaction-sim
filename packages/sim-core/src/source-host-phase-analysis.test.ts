import { describe, expect, it } from "vitest";
import {
  SOURCE_HOST_PHASE_PROVIDERS,
  analyzeSourceHostPhase,
  type SourceHostPhaseObservation,
  type SourceHostPhaseObservationRequest,
} from "./source-host-phase-analysis";

const policy: SourceHostPhaseObservationRequest = {
  warmupFrames: 10, maxPeriod: 2, requiredConsecutivePeriods: 2, maxObservations: 8,
};

function observation(iteration: number, energy: number, damage: number): SourceHostPhaseObservation {
  const normalizedState = Object.fromEntries(SOURCE_HOST_PHASE_PROVIDERS.map(name => [name, name === "characters" ? { energy } : {}]));
  return {
    boundary: "post-tick-pre-input-v1", frame: 10 + iteration * 10,
    inputPhase: { repeatId: "rotation-A", iteration, position: 0, futureInputSignature: "native-ast-loop-A", verifiedRepeat: true },
    determinism: "deterministic", normalizedState,
    coverage: { complete: true, providers: [...SOURCE_HOST_PHASE_PROVIDERS], gaps: [] }, cumulativeDamage: damage,
  };
}

describe("native source-host phase observations", () => {
  it("establishes a two-cycle phase only from matching complete native states and actual equal intervals", () => {
    const rows = [observation(0, 0, 0), observation(1, 1, 20), observation(2, 0, 100),
      observation(3, 1, 120), observation(4, 0, 200)];
    rows[1]!.inputPhase.futureInputSignature = "native-ast-loop-B";
    rows[3]!.inputPhase.futureInputSignature = "native-ast-loop-B";
    const result = analyzeSourceHostPhase(rows, policy);
    expect(result).toMatchObject({ status: "established-for-declared-native-state", evidence: "provisional-source-state",
      periodCycles: 2, periodFrames: 20, periodDamage: 100, steadyStateDps: 300,
      warmupBoundaryFrame: 10, matchedBoundaryFrames: [10, 20, 30, 40, 50] });
  });

  it("reports a structural state difference even when interval damage is identical", () => {
    const rows = [observation(0, 0, 0), observation(1, 1, 50), observation(2, 2, 100)];
    const result = analyzeSourceHostPhase(rows, { ...policy, maxPeriod: 1 });
    expect(result.status).toBe("not-established");
    expect(result.steadyStateDps).toBeNull();
    expect(result.stateDifferences[0]?.paths).toContain("$.characters.energy");
  });

  it("does not certify a native gap, unverified input phase, stochastic run, or unequal elapsed time", () => {
    const rows = [observation(0, 0, 0), observation(1, 0, 50), observation(2, 0, 100)];
    expect(analyzeSourceHostPhase(rows.map((row, index) => index === 1 ? { ...row, coverage: { ...row.coverage, gaps: ["opaque task"] } } : row), policy).status).toBe("not-established");
    expect(analyzeSourceHostPhase(rows.map((row, index) => index === 1 ? { ...row, inputPhase: { ...row.inputPhase, verifiedRepeat: false } } : row), policy).status).toBe("not-established");
    expect(analyzeSourceHostPhase(rows.map(row => ({ ...row, determinism: "stochastic" as const })), policy).status).toBe("not-established");
    const unequal = analyzeSourceHostPhase(rows.map((row, index) => index === 2 ? { ...row, frame: 31 } : row), policy);
    expect(unequal.status).toBe("not-established");
    expect(unequal.intervalDifferences[0]).toMatchObject({ first: { frames: 10, damage: 50 }, later: { frames: 11, damage: 50 } });
  });

  it("uses observed application sums without relaxing state or damage equality for cumulative cancellation", () => {
    const rows = [observation(0, 0, 0.1), observation(1, 0, 0.3), observation(2, 0, 0.5)];
    expect(analyzeSourceHostPhase(rows, { ...policy, maxPeriod: 1 }).status).toBe("not-established");
    rows[1]!.damageSincePreviousBoundary = 0.2;
    rows[2]!.damageSincePreviousBoundary = 0.2;
    expect(analyzeSourceHostPhase(rows, { ...policy, maxPeriod: 1 })).toMatchObject({
      status: "established-for-declared-native-state", periodDamage: 0.2,
    });
    rows[2]!.damageSincePreviousBoundary = 0.20001;
    expect(analyzeSourceHostPhase(rows, { ...policy, maxPeriod: 1 }).status).toBe("not-established");
  });

  it("allows a bounded incomplete startup prefix only after later native coverage actually closes", () => {
    const rows = [observation(0, 0, 0), observation(1, 0, 50), observation(2, 0, 100), observation(3, 0, 150)];
    rows[0]!.coverage = { complete: false, providers: [], gaps: ["startup callback"] };
    rows[0]!.normalizedState = {};
    rows[0]!.inputPhase.verifiedRepeat = false;
    const result = analyzeSourceHostPhase(rows, { ...policy, warmupFrames: 20, maxPeriod: 1 });
    expect(result).toMatchObject({ status: "established-for-declared-native-state", warmupBoundaryFrame: 20, periodCycles: 1 });
  });
});
