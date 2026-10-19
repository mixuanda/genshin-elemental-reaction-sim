import { expect, it } from "vitest";
import { simulationResultSchema } from "./index";
import { simulate } from "../../sim-core/src/simulator";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../../sim-core/src/calculator-bridge";

it("replays the deferred callback's actual Aura, one coefficient for its whole AoE, and the independent random draw", () => {
  const config = makeConfig({ duration: 1, cycleLength: 1,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "触发目标：同帧被火消冰", position: { x: 0, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "cryo", gaugeUnits: 1 }] },
      { id: "nearby", name: "邻近目标：保留冰附着", position: { x: 1, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "cryo", gaugeUnits: 1 }] },
    ] },
    reactionEngine: { mode: "aura-v3" },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "frostbearer", refinement: 5, physicalDamageBonus: 0 }] },
    rotation: [],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "combined", actorId: "a", name: "同帧来源反例：先普攻后火附着", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [
          { id: "normal-hit", frame: 0, scaling: 1, element: "physical", attackTag: "normal", targeting: { targetId: "enemy-0", outcome: "landed" } },
          { id: "consume-hit", frame: 0, scaling: 0, element: "pyro", attackTag: "skill", targeting: { targetId: "enemy-0", outcome: "landed" },
            application: { gaugeUnits: 2, icd: { mode: "no-icd-v1" } } },
        ] }], commands: [{ type: "normal", actorId: "a", abilityId: "combined", atFrame: 0 }] } });
  const result = simulate(config, { randomSeed: "schema-random-weapon", critMode: "noCrit" });
  const trigger = result.weaponProcLog!.find(row => row.outcome === "triggered")!;
  const parent = result.damageEvents[trigger.parentDamageEventId]!;
  expect(parent.reactionAudit.auraAfter!.some(aura => aura.element === "cryo")).toBe(true);
  expect(trigger).toMatchObject({ sourceProfileId: "gcsim-random-weapon-proc-v1", coefficient: 1.4,
    triggerAura: { cryo: false, frozen: false }, random: { probability: 1, successComparison: "<", drawIndex: 0, drawCountAfter: 1 } });
  expect(trigger.eventSequence).toBeGreaterThan(result.damageEvents.find(event => event.hitId === "consume-hit")!.eventSequence);
  const children = result.damageEvents.filter(event => event.weaponProcLogId === trigger.id);
  // The initiating target selects 140% ATK once. The nearby Cryo target does not reselect 360%.
  expect(children.map(event => [event.targetId, event.finalDamage])).toEqual([["enemy-0", 1000 * 1.4 * 0.5], ["nearby", 1000 * 1.4 * 0.5]]);
  expect(result.totalDamage).toBe(1900);
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  const replay = replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(restored, children[1]!.id))));
  expect(replay.difference).toBe(0);
  expect(replay.trace.find(node => node.id === "weaponProc.coefficientChoice")!.result!.value).toBe(1.4);
  for (const mutate of [
    (copy: typeof result) => { copy.weaponProcLog![trigger.id]!.coefficient = 3.6; },
    (copy: typeof result) => { copy.weaponProcLog![trigger.id]!.triggerAura = { cryo: true, frozen: false }; },
    (copy: typeof result) => { copy.weaponProcLog![trigger.id]!.random!.roll = (trigger.random!.roll! + 0.5) % 1; },
    (copy: typeof result) => { copy.weaponProcLog![trigger.id]!.eventSequence = parent.eventSequence; },
  ]) {
    const copy = structuredClone(result);
    mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
});
