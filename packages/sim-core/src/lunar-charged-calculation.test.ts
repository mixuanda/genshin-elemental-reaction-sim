import { expect, it } from "vitest";
import { resolveReactionLevelBase } from "@genshin-dps-lab/reaction-formulas";
import { calculateLunarChargedIntent } from "./lunar-charged-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import type { SpecialDamageIntent } from "./special-reaction-state";

const intent: SpecialDamageIntent = { id: 4, branch: "lunar-charged-reaction", snapshotFrame: 15, deliveryFrame: 15, targetId: "target", ownerId: "B", contributorIds: ["A", "B"], contributorPolicy: "live-positive-aura", sourceEventId: "actual-application-6", sourceRefs: ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/reactable/lunarcharged.go"], evidence: "fixed-source-provisional", element: "electro", onDelivery: [{ kind: "consume-aura", element: "hydro", gaugeUnits: 0.4, scope: "each-personal-aura" }, { kind: "consume-aura", element: "electro", gaugeUnits: 0.4, scope: "each-personal-aura" }], blockedMechanics: [] };
const snapshots = [ { actorId: "A", level: 90, elementalMastery: 0, critRate: 0.5, critDamage: 1 }, { actorId: "B", level: 90, elementalMastery: 0, critRate: 0, critDamage: 0 } ];

it("uses the pinned Lunar-shared level table and preserves original snapshots in each mode and calculator restore", () => {
  const base = resolveReactionLevelBase(90) * 3 * 0.9;
  const expected = base * (0.5 * (0.6 + 0.3) + 0.5 * (2 * 0.6 + 0.3));
  const average = calculateLunarChargedIntent(intent, snapshots, 0.1, "average");
  expect(average.damage).toBeCloseTo(expected, 9);
  const critical = calculateLunarChargedIntent(intent, snapshots, 0.1, "allCrit");
  const nonCritical = calculateLunarChargedIntent(intent, snapshots, 0.1, "noCrit");
  expect(critical.context).toEqual(average.context); expect(nonCritical.context).toEqual(average.context);
  expect(average.context.contributors[0]!.critRate).toBe(0.5);
  const restored = calculateSpecialCalculatorHit(JSON.parse(JSON.stringify(average.context)));
  expect(restored.expected).toBe(average.damage); expect(restored.critical).toBe(critical.damage); expect(restored.nonCritical).toBe(nonCritical.damage);
});

it("rejects unsupported levels and non-LC branches, while tracing overcap probability without changing the raw crit rate", () => {
  expect(() => calculateLunarChargedIntent({ ...intent, branch: "lunar-crystallize-reaction" }, snapshots, 0, "average")).toThrow(/lunar-charged-reaction/);
  expect(() => calculateLunarChargedIntent(intent, [{ ...snapshots[0]!, level: 101 }, snapshots[1]!], 0, "average")).toThrow(/integer from 1 to 100/);
  const overcap = calculateLunarChargedIntent(intent, [{ ...snapshots[0]!, critRate: 1.2 }, snapshots[1]!], 0, "average");
  expect(overcap.context.contributors[0]!.critRate).toBe(1.2);
  expect(overcap.trace.find(node => node.id.endsWith("contributor.0.probability"))!.result!.value).toBe(1);
  expect(overcap.damage).toBe(calculateLunarChargedIntent(intent, [{ ...snapshots[0]!, critRate: 1.2 }, snapshots[1]!], 0, "allCrit").damage);
});
