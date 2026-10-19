import { expect, it } from "vitest";
import { simulationResultSchema, simConfigSchema } from "./index";
import { simulate } from "../../sim-core/src/simulator";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";

it("authenticates independent weapon source, trigger snapshot and complete dynamic lineage after JSON export", () => {
  const config = makeConfig({ duration: 1, cycleLength: 1,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "目标", position: { x: 2, y: 0 } }] },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "ashgravendrinkinghorn", refinement: 3, physicalDamageBonus: 0.25 }] },
    rotation: [{ id: "skill", actorId: "a", name: "合成技能", at: 0,
      buffs: [{ key: "hp-at-trigger", target: "self", stat: "hpPct", value: 1, duration: 1 / 60 }],
      hits: [{ offset: 0, scaling: 1, attackTag: "skill", element: "pyro" }] }] });
  const result = simulate(config, { execution: { detailedTraces: true } });
  const json = JSON.stringify(result);
  expect(simulationResultSchema.safeParse(JSON.parse(json)).success).toBe(true);
  const trigger = result.weaponProcLog!.find(row => row.outcome === "triggered")!;
  const event = result.damageEvents[trigger.damageEventIds[0]!]!;
  // R3: 60% maximum HP, independently multiplied by physical bonus and DEF.
  expect(event.finalDamage).toBeCloseTo(0.6 * 20_000 * 1.25 * 0.5, 9);
  for (const mutate of [
    (copy: typeof result) => { copy.weaponProcLog![0]!.sourceRef = "unverified-source"; },
    (copy: typeof result) => { copy.weaponProcLog![0]!.triggerSnapshot!.hpPct = 0; },
    (copy: typeof result) => { copy.weaponProcLog![0]!.origin!.x = 20; },
    (copy: typeof result) => { copy.weaponProcLog![0]!.damageEventIds = []; },
    (copy: typeof result) => { delete copy.weaponProcLog; },
  ]) {
    const copy = JSON.parse(json) as typeof result;
    mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
  const noPosition = structuredClone(config);
  delete noPosition.enemy.targets![0]!.position;
  expect(simConfigSchema.safeParse(noPosition).success).toBe(false);
  const wrongType = structuredClone(config);
  wrongType.normalHitEnergyModel = { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponType: "polearm" }] };
  expect(simConfigSchema.safeParse(wrongType).success).toBe(false);
});
