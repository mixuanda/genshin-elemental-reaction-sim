import { expect, it } from "vitest";
import { solveEnergyRecharge } from "../simulation-analysis";
import { erIndependentFixture } from "./er-independent-fixture";

const options = { actorId: "a", minimumEr: 1, maximumEr: 2, step: 1 };

it("proves an observed capacity failure, retaining candidate receipts and execution epsilon", () => {
  const config = erIndependentFixture();
  const before = structuredClone(config);
  const result = solveEnergyRecharge(config, options);
  expect(result.status).toBe("er-independent-failure");
  expect(result.evaluated).toHaveLength(2);
  expect(result.independentFailureProof).toMatchObject({ kind: "cost-exceeds-capacity", commandIndex: 1, actorId: "a", abilityId: "q", energyCost: 61, energyMax: 60,
    evidence: { energyRecharge: 1, reproducibilityKey: result.evaluated[0]!.reproducibilityKey,
      failure: { reasonCode: "INSUFFICIENT_ENERGY", energyBefore: 60, energyCost: 61, timelineCommandIndex: 1 } } });
  expect(result.minimumFeasibleEr).toBeNull();
  expect(result.recommendedEr).toBeNull();
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  expect(config).toEqual(before);
  config.timeline!.abilities[1]!.energyCost = 60 + 5e-10;
  expect(solveEnergyRecharge(config, { ...options, maximumEr: 1 }).status).toBe("feasible-on-grid");
});

it("proves the all-success cooldown conflict through both runtime outcomes, excluding dynamic feedback", () => {
  const config = erIndependentFixture();
  config.characters[0]!.initialEnergy = 0;
  Object.assign(config.timeline!.abilities[1]!, { energyCost: 6, cooldownFrames: 60 });
  config.timeline!.commands = [{ type: "burst", actorId: "a", abilityId: "q", atFrame: 0 }, { type: "burst", actorId: "a", abilityId: "q", atFrame: 10 }];
  const empty = solveEnergyRecharge(config, options);
  expect(empty.status).toBe("er-independent-failure");
  expect(empty.evaluated).toHaveLength(2); // Energy refusals themselves do not start cooldowns.
  expect(empty.independentFailureProof).toMatchObject({ kind: "all-success-timeline-illegal", commandIndex: 1,
    failure: { code: "ABILITY_ON_COOLDOWN", frame: 10 }, evidence: { kind: "candidate-result", energyRecharge: 2 } });
  const full = solveEnergyRecharge(config, { ...options, runtimeOptions: { energyMode: "full" } });
  expect(full.status).toBe("er-independent-failure");
  expect(full.evaluated).toEqual([]); // The thrown simulation has no fabricated damage receipt.
  expect(full.independentFailureProof).toMatchObject({ evidence: { kind: "simulation-error", failure: { code: "ABILITY_ON_COOLDOWN", frame: 10 } } });
  Object.assign(config.timeline!.abilities[0]!, { cooldownStartFrame: 0, cooldownFrames: 60 });
  const dynamic = solveEnergyRecharge(config, options);
  expect(dynamic.status, dynamic.reasons.join(" ")).toBe("infeasible-within-bounds");
  expect(dynamic.independentFailureProof).toBeUndefined();
});

it("reports a strict stamina constraint independently of ER", () => {
  const config = erIndependentFixture();
  config.timeline!.abilities[1]!.energyCost = 6;
  config.staminaModel = { mode: "shared-stamina-v1", profileId: "gcsim-b4ae769-stamina-v1", initialStamina: 0 };
  config.timeline!.abilities[0]!.staminaCost = { amount: 0, consumeFrame: 0, source: { kind: "custom", note: "合成零体力技能" } };
  config.timeline!.abilities[1]!.staminaCost = { amount: 10, consumeFrame: 0, source: { kind: "custom", note: "合成动作体力消耗" } };
  const result = solveEnergyRecharge(config, { ...options, maximumEr: 1 });
  expect(result.status, result.reasons.join(" ")).toBe("er-independent-failure");
  expect(result.evaluated).toHaveLength(1);
  expect(result.independentFailureProof).toMatchObject({ kind: "all-success-timeline-illegal", failure: { code: "INSUFFICIENT_STAMINA", commandIndex: 1, frame: 2 } });
});
