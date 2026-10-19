import { expect, it } from "vitest";
import { simulationResultSchema } from "./index";
import { simulate } from "../../sim-core/src/simulator";
import { makeConfig, neutralStats } from "../../sim-core/src/__tests__/fixtures";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../../sim-core/src/calculator-bridge";

it("replays an actual TTDS transfer and preserves the already-included share across calculator JSON", () => {
  const config = makeConfig({ duration: 2, cycleLength: 2,
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    thrillingTalesModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", refinement: 5 }] },
    rotation: [{ id: "receive", actorId: "b", name: "受益角色合成动作", at: 1 / 60,
      hits: [{ id: "snapshot-hit", offset: 0.5, scaling: 1, element: "physical", snapshot: "action" }] }] });
  config.characters.push({ ...config.characters[0]!, id: "b", name: "受益角色", stats: { ...neutralStats } });
  const result = simulate(config, { execution: { detailedTraces: true } });
  expect(result.thrillingTalesLog).toHaveLength(1);
  expect(result.thrillingTalesLog![0]).toMatchObject({ ownerId: "a", recipientId: "b", coefficient: 0.48, outcome: "applied", swapKind: "legacy-implicit" });
  const event = result.damageEvents[0]!;
  expect(event.statsBeforeDamage.atkPct).toBe(0.48);
  // The source percentage multiplies the recipient's base ATK once.
  expect(event.finalDamage).toBe(1000 * (1 + 0.48) * 0.5);
  const replay = replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, event.id))));
  expect(replay.difference).toBe(0);
  expect(replay.thrillingTales?.map(row => row.id)).toEqual([0]);
  expect(replay.trace.find(node => node.id === "thrillingTales.0.attackContribution")!.result!.value).toBe(480);
  const json = JSON.stringify(result);
  for (const mutate of [
    (copy: typeof result) => { delete copy.thrillingTalesLog; },
    (copy: typeof result) => { copy.thrillingTalesLog![0]!.recipientId = "a"; },
    (copy: typeof result) => { copy.thrillingTalesLog![0]!.coefficient = 0.24; },
    (copy: typeof result) => { copy.damageEvents[0]!.activeStatuses = []; copy.hitEvents[0]!.activeStatuses = []; },
  ]) {
    const copy = JSON.parse(json) as typeof result;
    mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
});
