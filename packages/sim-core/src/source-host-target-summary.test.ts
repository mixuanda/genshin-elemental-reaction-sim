import { expect, it } from "vitest";
import { summarizeSourceHostTargets } from "./source-host-target-summary";
import type { SourceHostApplication, SourceHostNativeResult } from "./source-host-wire";

const application = (id: number, targetKey: number, rawDamage: number, appliedDamage: number, hpBefore: number, hpAfter: number): SourceHostApplication => ({
  id, calculationId: id + 100, attackId: id + 200, frame: id * 10, targetKey,
  damageMode: false, rawDamage, appliedDamage, hpBefore, hpAfter, isCrit: false,
});

it("maps non-contiguous native target keys, retains an observed zero-hit target, and traces per-target and total sums", () => {
  const result = {
    applications: [application(1, 3, 10, 8, 100, 92), application(2, 8, 4, 4, 200, 196)],
    targetScene: {
      damageMode: false, primaryTargetIndex: 1, initialDefaultTargetKey: 3,
      targets: [
        { declarationIndex: 0, targetKey: 3, profile: { level: 90 }, position: { x: 0, y: 0, radius: 1 }, initialHP: 100, initialMaxHP: 100 },
        { declarationIndex: 1, targetKey: 8, profile: { level: 90 }, position: { x: 1, y: 0, radius: 1 }, initialHP: 200, initialMaxHP: 200 },
        { declarationIndex: 2, targetKey: 15, profile: { level: 90 }, position: { x: 20, y: 0, radius: 1 }, initialHP: 300, initialMaxHP: 300 },
      ],
    },
    observationWindow: { policy: "duration-or-native" as const, configuredEndFrame: 600, actualEndFrame: 600, endReason: "duration" as const },
    result: { duration: 600 },
  } as unknown as Pick<SourceHostNativeResult, "applications" | "targetScene" | "observationWindow" | "result">;

  const summary = summarizeSourceHostTargets(result);
  expect(summary.targets.map(row => row.targetKey)).toEqual([3, 8, 15]);
  expect(summary.primaryTargetKey).toBe(8);
  expect(summary.targets[1]!.isPrimary).toBe(true);
  expect(summary.targets[0]!.isInitialDefault).toBe(true);
  expect(summary.targets[2]).toMatchObject({ rawDamage: 0, appliedDamage: 0, hpLoss: 0, hitCount: 0, applicationIds: [] });
  expect(summary.targets[2]!.trace.find(node => node.id === "target-15.appliedDamage")!.explanationKey).toContain("没有命中记录");
  expect(summary.total).toMatchObject({ rawDamage: 14, appliedDamage: 12, hpLoss: 12, hitCount: 2, applicationIds: [1, 2] });
  expect(summary.total.appliedDamageRate).toBe(1.2);
  expect(summary.fullConfiguredWindow).toBe(true);
  expect(summary.trace.find(node => node.id === "total.appliedDamage")!.result!.value).toBe(summary.total.appliedDamage);
});

it("keeps legacy target attribution observed-only and rejects duplicate application IDs", () => {
  const result = {
    applications: [application(7, 41, 6, 5, 50, 45)],
    result: { duration: 120 },
  } as unknown as Pick<SourceHostNativeResult, "applications" | "targetScene" | "observationWindow" | "result">;
  const summary = summarizeSourceHostTargets(result, { showRates: false });
  expect(summary.primaryTargetKey).toBeUndefined();
  expect(summary.targets).toHaveLength(1);
  expect(summary.targets[0]!.targetKey).toBe(41);
  expect(summary.targets[0]).not.toHaveProperty("initialHP");
  expect(summary.targets[0]!.isPrimary).toBeUndefined();
  expect(summary.trace.some(node => node.id.endsWith("DamageRate"))).toBe(false);
  expect(summary.actualDurationSeconds).toBe(2);

  expect(() => summarizeSourceHostTargets({ ...result, applications: [application(7, 41, 6, 5, 50, 45), application(7, 41, 1, 1, 45, 44)] })).toThrow(/重复/);
});

it("uses the same half-open complete window as the damage curve and retains boundary receipt identity", () => {
  const inside = { ...application(1, 3, 100, 100, 1000, 900), frame: 7199 };
  const endpoint = { ...application(2, 3, 500, 500, 900, 400), frame: 7200 };
  const result = {
    applications: [inside, endpoint],
    observationWindow: { policy: "duration-or-native" as const, configuredEndFrame: 7200, actualEndFrame: 7200, endReason: "duration" as const },
    result: { duration: 7200, total_damage: 600 },
  } as Pick<SourceHostNativeResult, "applications" | "targetScene" | "observationWindow" | "result">;
  const original = structuredClone(result);
  const summary = summarizeSourceHostTargets(result);
  expect(summary.total).toMatchObject({ appliedDamage: 100, rawDamage: 100, hpLoss: 100, hitCount: 1, applicationIds: [1] });
  expect(summary.total.appliedDamageRate).toBe(100 / 120);
  expect(summary.targets[0]!.appliedDamage).toBe(100);
  expect(summary.excludedApplicationIds).toEqual([2]);
  expect(summary.excludedAppliedDamage).toBe(500);
  expect(result).toEqual(original);
  expect(summarizeSourceHostTargets(result, { applicationIds: [1, 2], showRates: false }).applicationIds).toEqual([1]);
});

it("does not impose a configured half-open cutoff on an early native end or an unverified legacy window", () => {
  const endpoint = { ...application(2, 3, 500, 500, 900, 400), frame: 120 };
  const result = {
    applications: [endpoint],
    observationWindow: { policy: "duration-or-native" as const, configuredEndFrame: 7200, actualEndFrame: 120, endReason: "targets-dead" as const },
    result: { duration: 120 },
  } as Pick<SourceHostNativeResult, "applications" | "targetScene" | "observationWindow" | "result">;
  expect(summarizeSourceHostTargets(result).total.appliedDamage).toBe(500);
  expect(summarizeSourceHostTargets({ ...result, observationWindow: undefined }).total.appliedDamage).toBe(500);
});
