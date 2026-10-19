import { expect, it } from "vitest";
import { calculateLunarCrystallizeIntent } from "./lunar-crystallize-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import type { SpecialDamageIntent } from "./special-reaction-state";

const intent: SpecialDamageIntent = { id: 5, branch: "lunar-crystallize-reaction", snapshotFrame: 33, deliveryFrame: 43, targetId: "target", ownerId: "geo", contributorIds: ["hydro", "geo"], contributorPolicy: "captured-since-last-volley", sourceEventId: "harmony-at20", sourceRefs: ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcrystallize.go"], evidence: "fixed-source-provisional", element: "geo", onDelivery: [], blockedMechanics: [] };
const captured = [{ actorId: "hydro", level: 90, elementalMastery: 0, critRate: 0.5, critDamage: 1 }, { actorId: "geo", level: 80, elementalMastery: 0, critRate: 0, critDamage: 0 }];

it("executes the independent1.6 branch with character snapshots and delivery-time resistance, preserving calculator restore", () => {
  const result = calculateLunarCrystallizeIntent(intent, captured, 0.1, "average");
  const expected = ((1446.8535 * 1.6 * 1.5) * 0.6 + (1077.4437 * 1.6) * 0.3) * 0.9;
  expect(result.damage).toBeCloseTo(expected, 9);
  expect(result.context.context).toMatchObject({ snapshotFrame: 33, deliveryFrame: 43, ownerId: "geo", contributorPolicy: "captured-since-last-volley" });
  const laterResistance = calculateLunarCrystallizeIntent(intent, captured, -0.2, "average");
  expect(laterResistance.context.contributors).toEqual(result.context.contributors);
  expect(laterResistance.damage / result.damage).toBeCloseTo(1.1 / 0.9, 12);
  expect(calculateSpecialCalculatorHit(JSON.parse(JSON.stringify(result.context))).expected).toBe(result.damage);
  expect(calculateLunarCrystallizeIntent(intent, captured, 0.1, "allCrit").context).toEqual(result.context);
});

it("rejects another formula, missing participants, unsupported level and incorrect travel semantics", () => {
  expect(() => calculateLunarCrystallizeIntent({ ...intent, branch: "lunar-charged-reaction" }, captured, 0.1, "average")).toThrow(/captured-volley/);
  expect(() => calculateLunarCrystallizeIntent(intent, captured.slice(0, 1), 0.1, "average")).toThrow(/exactly/);
  expect(() => calculateLunarCrystallizeIntent(intent, [{ ...captured[0]!, level: 101 }, captured[1]!], 0.1, "average")).toThrow(/integer from 1 to 100/);
  expect(() => calculateLunarCrystallizeIntent({ ...intent, deliveryFrame: 33 }, captured, 0.1, "average")).toThrow(/ten-frame/);
});
