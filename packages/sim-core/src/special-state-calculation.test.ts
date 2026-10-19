import { expect, it } from "vitest";
import type { SpecialContributor } from "@genshin-dps-lab/reaction-formulas";
import { createSpecialReactionState, transitionSpecialState, SPECIAL_STATE_PROFILE_ID, type SpecialStateContext } from "./special-reaction-state";
import { specialDamageIntentToCalculationContext } from "./special-state-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";

function generatedHit() {
  const context: SpecialStateContext = { profileId: SPECIAL_STATE_PROFILE_ID, targetId: "target", spatialProfile: "single-stationary-target-in-range", party: [{ actorId: "A", characterKey: "columbina" }, { actorId: "B", characterKey: "lisa" }], auraAt: () => ({ hydro: ["A"], electro: ["B"] }) };
  const initial = transitionSpecialState(createSpecialReactionState(), { kind: "application", frame: 0, sourceActorId: "B", targetId: "target", sourceEventId: "actual-aura-event-1", attackId: "attack-1", element: "electro", gaugeUnits: 1, actualIcdAllowed: true, resolutionOrigin: "aura-engine", ordinaryReaction: "electroCharged", auraBefore: { hydro: ["A"], electro: [] } }, context);
  return transitionSpecialState(initial.state, { kind: "advance", frame: 9 }, context).damageIntents[0]!;
}
const contributor = (id: string, base: number, critRate: number): SpecialContributor => ({ id, base: { kind: "level-base", characterLevel: 90, value: base, evidence: "synthetic", sourceRefs: ["synthetic:teaching-value-not-level90-data"] }, elementalMastery: 0, specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, critRate, critDamage: id === "A" ? 1 : 0, modifierSourceRefs: ["synthetic:explicit-zero-modifiers"] });
const snapshots = [contributor("A", 100 / 3, 0.5), contributor("B", 50, 0)];
const proof = { ordinaryReactionReplacementApplied: true, deliveryOperationsScheduled: true } as const;

it("reproduces a state-derived LC event through the same standalone trace after exact context serialization", () => {
  const intent = generatedHit();
  const context = specialDamageIntentToCalculationContext(intent, snapshots, 0, proof);
  expect(context.context).toMatchObject({ mode: "state-resolved", contributorEligibility: "resolved", sourceEventId: "actual-aura-event-1", snapshotFrame: 9, ownerId: "B" });
  const hit = calculateSpecialCalculatorHit(context);
  expect(hit.expected).toBe(142.5);
  expect(hit.specialResult.readiness).toBe("reference-state-resolved-formula");
  expect(hit.trace.every(node => node.status === "applied")).toBe(true);
  expect(calculateSpecialCalculatorHit(JSON.parse(JSON.stringify(context)))).toEqual(hit);
});

it("does not turn a sidecar, incomplete participant list or blocked state into automatic numerical damage", () => {
  const intent = generatedHit();
  expect(() => specialDamageIntentToCalculationContext(intent, snapshots, 0, { ...proof, ordinaryReactionReplacementApplied: false } as never)).toThrow(/replacement/);
  expect(() => specialDamageIntentToCalculationContext(intent, snapshots.slice(0, 1), 0, proof)).toThrow(/exactly/);
  intent.blockedMechanics.push({ mechanic: "lunar-charged", field: "conversion-not-applied", reason: "ordinary EC remains active", sourceRefs: ["synthetic:integration-test"] });
  expect(() => specialDamageIntentToCalculationContext(intent, snapshots, 0, proof)).toThrow(/conversion-not-applied/);
});
