import { expect, it } from "vitest";
import { NORMAL_HIT_ENERGY_PROFILE, NormalHitEnergyRuntime, type NormalHitEnergyDecision } from "./normal-hit-energy";

it("audits independent source-shaped normal-hit rolls, shared ICD, unfiltered callbacks and swap reset", () => {
  const options = { seed: "normal-energy-module-case", actors: [
    { actorId: "sword", weaponType: "sword" as const },
    { actorId: "polearm", weaponType: "polearm" as const },
  ] };
  const runtime = new NormalHitEnergyRuntime(options);
  const control = new NormalHitEnergyRuntime(options);
  const damage = (frame: number, actorId: string, damageEventId: number) => ({
    frame, actorId, damageEventId, attackTag: "normal" as const, hitGroupId: "same-confirmed-group",
  });
  const first = runtime.onDamage(damage(0, "polearm", 0));
  expect(first).toEqual(control.onDamage(damage(0, "polearm", 0)));
  expect(first).toMatchObject({ outcome: "failed-roll", probabilityBefore: 0, probabilityAfter: 0.04,
    drawIndex: 0, drawCountBefore: 0, drawCountAfter: 1, globalIcdReadyFrameAfter: 0, energyRequested: 0 });
  const reset = runtime.onSwap(0, "sword");
  expect(reset).toEqual(control.onSwap(0, "sword"));
  expect(reset.probabilitiesBefore.map(row => row.probability)).toEqual([0.1, 0.04]);
  expect(reset.probabilitiesAfter.map(row => row.probability)).toEqual([0.1, 0]);

  // Failure does not start ICD. Repeated confirmed targets in one hit group
  // remain distinct attempts; no damage/energy-full parameter is needed.
  const next = runtime.onDamage({ ...damage(0, "polearm", 1), attackTag: "extra" });
  expect(next).toEqual(control.onDamage({ ...damage(0, "polearm", 1), attackTag: "extra" }));
  expect(next.icdBlocked).toBe(false);
  expect(next.drawIndex).toBe(1);
  let success: NormalHitEnergyDecision | undefined = next.outcome === "gained" ? next : undefined;
  for (let index = 2; index < 28 && success === undefined; index++) {
    const candidate = runtime.onDamage(damage(index * 12, "polearm", index));
    expect(candidate).toEqual(control.onDamage(damage(index * 12, "polearm", index)));
    if (candidate.outcome === "gained") success = candidate;
  }
  expect(success).toBeDefined();
  expect(success!.energyRequested).toBe(1);
  expect(success!.roll!).toBeLessThanOrEqual(success!.probabilityBefore);
  expect(success!.probabilityAfter).toBe(0);
  expect(success!.globalIcdReadyFrameAfter).toBe(success!.frame + 12);

  const blocked = runtime.onDamage(damage(success!.frame, "sword", 100));
  expect(blocked).toMatchObject({ outcome: "icd-blocked", roll: null, drawIndex: null, energyRequested: 0,
    probabilityBefore: 0.1, probabilityAfter: 0.1, drawCountBefore: success!.drawCountAfter, drawCountAfter: success!.drawCountAfter });
  const swapped = runtime.onSwap(success!.frame + 1, "sword");
  expect(swapped).toEqual(control.onSwap(success!.frame + 1, "sword"));
  expect(swapped.probabilitiesAfter.map(row => row.probability)).toEqual([0.1, 0]);
  expect(swapped.globalIcdReadyFrameAfter).toBe(success!.frame + 12);
  const atReady = damage(success!.frame + 12, "sword", 101);
  expect(runtime.onDamage(atReady)).toEqual(control.onDamage(atReady));
  expect(NORMAL_HIT_ENERGY_PROFILE.matchesGcsimRandomSequence).toBe(false);
  expect(NORMAL_HIT_ENERGY_PROFILE.assumptions.join(" ")).toContain("TODO");
});
