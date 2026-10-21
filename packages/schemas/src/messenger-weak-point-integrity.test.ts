import { expect, it } from "vitest";
import { simConfigSchema, simulationResultSchema } from "./index";
import { weaponProcWeaponIdSchema } from "./weapon-proc-schema";
import { simulate } from "../../sim-core/src/simulator";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../../sim-core/src/calculator-bridge";

it("proves explicit Messenger weak points, independent guaranteed critical damage, and zero critical-stream draws for those hits", () => {
  const config = makeConfig({ duration: 1, cycleLength: 1,
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "messenger", refinement: 1, physicalDamageBonus: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "weak", actorId: "a", name: "显式弱点与普通命中", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [
          { id: "weak-hit", frame: 0, scaling: 1, element: "physical", attackTag: "skill", hitWeakPoint: true, critDmg: .5 },
          { id: "ordinary-hit", frame: 3, scaling: 1, element: "physical", attackTag: "normal", hitWeakPoint: false },
        ] }], commands: [{ type: "skill", actorId: "a", abilityId: "weak", atFrame: 0 }] } });
  // A 0% CR panel remains 0%. The host's extra +50% CD does not leak into
  // the independent R1 attack, which uses the actor's actual +50% CD snapshot.
  const result = simulate(config, { critMode: "noCrit", randomSeed: "messenger-proof" });
  const proc = result.damageEvents.find(event => event.weaponProcLogId !== undefined)!;
  expect(result.damageEvents.map(event => [event.hitWeakPoint, event.finalDamage])).toEqual([
    [true, 1000 * .5 * (1 + 1)], [true, 1000 * 1 * .5 * (1 + .5)], [false, 1000 * .5],
  ]);
  expect(result.totalDamage).toBe(2250);
  expect(proc.damageFactors.critRate).toBe(0);
  expect(result.weaponProcLog!.map(row => [row.hitWeakPoint, row.outcome])).toEqual([
    [true, "triggered"], [true, "cooldown-blocked"], [false, "not-weak-point"],
  ]);
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  const replay = replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(restored, proc.id))));
  expect(replay.difference).toBe(0);
  expect(replay.trace.find(node => node.id === "weakPointGuaranteedCritical")!.result!.value).toBe(1);
  const sampled = simulate(config, { critMode: "noCrit", randomSeed: "messenger-proof",
    execution: { criticalSampling: "seeded-random-v1", captureHits: true } });
  expect(sampled.totalDamage).toBe(result.totalDamage);
  expect(sampled.executionAudit!.criticalSampling!.drawCount).toBe(1);
  expect(sampled.executionAudit!.hits.slice(0, 2).map(hit => hit.critical)).toEqual([
    { mode: "configured", eligible: true, outcome: "critical", roll: null, drawIndex: null },
    { mode: "configured", eligible: true, outcome: "critical", roll: null, drawIndex: null },
  ]);
  expect(sampled.executionAudit!.hits[2]!.critical.drawIndex).toBe(0);
  for (const mutate of [
    (copy: typeof result) => { copy.damageEvents[0]!.hitWeakPoint = false; },
    (copy: typeof result) => { copy.damageEvents[proc.id]!.hitWeakPoint = false; },
    (copy: typeof result) => { copy.weaponProcLog![0]!.hitWeakPoint = false; },
    (copy: typeof result) => { const hit = copy.executionAudit!.hits[proc.id]!; if (hit.inputKind === "ordinary") hit.input.hitWeakPoint = false; },
    (copy: typeof result) => { copy.executionAudit!.hits[proc.id]!.critical.mode = "seeded-random-v1"; },
  ]) {
    const copy = structuredClone(result); mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
  const unknown = structuredClone(config);
  delete unknown.timeline!.abilities[0]!.hits![0]!.hitWeakPoint;
  expect(simConfigSchema.safeParse(unknown).success).toBe(false);
  const contradictory = structuredClone(config);
  contradictory.timeline!.abilities[0]!.hits![0]!.critEligible = false;
  expect(simConfigSchema.safeParse(contradictory).success).toBe(false);
  // The three later fixed-source runtimes have dedicated delivery/replay
  // tests. Assert the exact whitelist, not the pre-expansion count alone.
  expect(weaponProcWeaponIdSchema.options).toEqual([
    "halberd", "ashgravendrinkinghorn", "sequenceofsolitude",
    "filletblade", "prototypearchaic", "snowtombedstarsilver", "dragonspinespear", "frostbearer",
    "flute", "debateclub", "crescentpike", "endoftheline", "messenger",
    "theviridescenthunt", "swordofnarzissenkreuz", "eyeofperception",
  ]);
  expect(weaponProcWeaponIdSchema.safeParse("unreviewed-weapon").success).toBe(false);
});
