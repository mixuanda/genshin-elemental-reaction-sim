import { expect, it } from "vitest";
import { simulationResultSchema, type AbilityDefinition, type CharacterProfile, type DamageEvent } from "@genshin-dps-lab/schemas";
import { compileSourceRuntimeAbility } from "../source-runtime-abilities";
import { deriveSourceBackedRotationMappings, validateComposableSourceAbilities } from "../source-action-library";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

it("composes sourced bursts with editable panels, actual sampling, passive timing, energy and calculator restore", () => {
  // Explicit neutral panels and teammate buffs exercise the shared host; they
  // are not presented as source-backed builds or in-game measurements.
  const actors: CharacterProfile[] = ([['a', 'pyro'], ['k', 'electro'], ['z', 'geo'], ['c', 'cryo']] as const).map(([id, element]) => ({
    id, name: `可编辑角色 ${id}`, element, color: "#555555", level: 90, energyMax: 40, initialEnergy: 40,
    stats: { ...neutralStats, critRate: .1, critDmg: 1 },
  }));
  const compiled = ([['a', 'amber-q', 1], ['k', 'keqing-q', 4], ['z', 'zhongli-q', 4], ['c', 'chongyun-q', 0]] as const)
    .map(([actorId, sourceActionId, ascension]) => compileSourceRuntimeAbility({ actorId, sourceActionId, ascension, talentLevel: 1, constellation: 0 }));
  const [amber, keqing, zhongli, chongyun] = compiled.map(row => row.ability);
  const helper: AbilityDefinition = {
    id: "declared-teammate-buffs", actorId: "a", name: "显式合成延迟增益与飞行取样", kind: "skill",
    cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
    hits: [{ id: "synthetic-travel-hit", frame: 30, snapshot: "hit", snapshotFrame: 10, scaling: 1, element: "physical", attackTag: "normal" }],
    buffs: [
      { key: "amber-after-cast", target: "a", stat: "atkFlat", value: 200, startFrame: 20, durationFrames: 600 },
      { key: "keqing-between-slashes", target: "k", stat: "atkFlat", value: 100, startFrame: 450, durationFrames: 600 },
      { key: "zhongli-after-hp-sample", target: "z", stat: "hpFlat", value: 10000, startFrame: 650, durationFrames: 600 },
      { key: "zhongli-before-main-sample", target: "z", stat: "atkFlat", value: 500, startFrame: 650, durationFrames: 600 },
      { key: "chongyun-between-blades", target: "c", stat: "atkFlat", value: 100, startFrame: 955, durationFrames: 600 },
    ],
  };
  const config = makeConfig({ duration: 30, cycleLength: 30,
    meta: { name: "可组合来源能力聚合", version: "synthetic-source-ability-context-v1", verificationStatus: "user-supplied" },
    dataVersion: "synthetic-source-ability-context-v1", characters: actors,
    sourceAbilityBindings: compiled.map(row => row.binding),
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    reactionEngine: { mode: "aura-v3", initialAura: [], icdProfiles: {} },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [helper, ...compiled.map(row => row.ability)], commands: [
        { type: "skill", actorId: "a", abilityId: helper.id, atFrame: 0 },
        { type: "burst", actorId: "a", abilityId: amber!.id, atFrame: 1 },
        { type: "swap", characterId: "k", atFrame: 250 },
        { type: "burst", actorId: "k", abilityId: keqing!.id, atFrame: 300 },
        { type: "swap", characterId: "z", atFrame: 550 },
        { type: "burst", actorId: "z", abilityId: zhongli!.id, atFrame: 600 },
        { type: "swap", characterId: "c", atFrame: 850 },
        { type: "burst", actorId: "c", abilityId: chongyun!.id, atFrame: 900 },
        { type: "burst", actorId: "c", abilityId: chongyun!.id, atFrame: 1000 },
      ] },
  });
  expect(validateComposableSourceAbilities(config).status).toBe("valid");
  expect(deriveSourceBackedRotationMappings(config)?.aliases?.a?.Q).toBe(amber!.id);
  const result = simulate(config, { critMode: "average", energyMode: "configured" });
  const hits = (abilityId: string) => result.damageEvents.filter(event => event.sourceAbilityId === abilityId && event.kind === "direct");
  const amberHits = hits(amber!.id), keqingHits = hits(keqing!.id), zhongliHits = hits(zhongli!.id), chongyunHits = hits(chongyun!.id);
  // Source values below are independent arithmetic oracles from the pinned
  // level-one vectors; reaction-only events are not part of a Q's direct sum.
  expect(amberHits).toHaveLength(18);
  expect(amberHits.every(event => event.scalingValue === 1000 && event.critRate === .2)).toBe(true);
  for (const event of amberHits) expect(event.finalDamage).toBeCloseTo(1000 * .2808 * .5 * 1.2, 9);
  expect(keqingHits).toHaveLength(10);
  for (const event of keqingHits) {
    const coefficient = event.frame === 356 ? .88 : event.frame === 497 ? 1.888 : .24;
    const attack = event.frame < 450 ? 1000 : 1100;
    expect(event.critRate).toBe(.25);
    expect(event.statsBeforeDamage.energyRecharge).toBe(1.15);
    expect(event.finalDamage).toBeCloseTo(attack * coefficient * .5 * 1.25, 9);
  }
  expect(zhongliHits).toHaveLength(1);
  const meteor = zhongliHits[0]!;
  expect(meteor.frame).toBe(701);
  expect(meteor.scalingValue).toBe(1500);
  expect(meteor.flat).toBe(3300);
  expect(meteor.finalDamage).toBeCloseTo((1500 * 4.0108 + 10000 * .33) * .5 * 1.1, 9);
  expect(meteor.flatDetails[0]!.sourceSnapshotLogId).toBeTypeOf("number");
  const hpSample = result.sourceSnapshotLog!.find(row => row.id === meteor.flatDetails[0]!.sourceSnapshotLogId)!;
  expect(hpSample).toMatchObject({ ownerId: "z", relativeFrame: 0, frame: 600, status: "sampled", eventPriority: 12.5 });
  expect(hpSample.stats!.flatHp).toBe(0);
  expect(meteor.statsBeforeDamage.flatHp).toBe(10000);
  expect(chongyunHits.map(event => [event.frame, event.scalingValue])).toEqual([[950, 1000], [959, 1100], [967, 1100]]);
  for (const event of chongyunHits) expect(event.finalDamage).toBeCloseTo(event.scalingValue * 1.424 * .5 * 1.1, 9);
  const flight = result.damageEvents.find(event => event.hitId === "synthetic-travel-hit")!;
  expect(flight.finalDamage).toBeCloseTo(550, 9);
  expect(result.sourceSnapshotLog!.find(row => row.id === flight.sourceSnapshotLogId)).toMatchObject({ ownerId: "a", relativeFrame: 10, frame: 10, status: "sampled", stats: { flatAtk: 0 } });
  expect(result.timelineExecution!.adjustments).toContainEqual(expect.objectContaining({ code: "ABILITY_ON_COOLDOWN", requestedFrame: 1000, executedFrame: 1620 }));
  expect(result.timelineExecution!.failures.map(row => row.code)).toEqual(["INSUFFICIENT_ENERGY"]);
  expect(result.energyCostLog!.filter(row => row.operation === "debit").map(row => row.frame)).toEqual([60, 355, 607, 906]);
  expect(result.elementalApplicationIcdLog.length).toBeGreaterThan(0);
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  expect(restored.sourceSnapshotLog).toEqual(result.sourceSnapshotLog);
  for (const event of [amberHits[0]!, keqingHits[0]!, meteor, chongyunHits[0]!, flight]) {
    const capture = parseSimulationHit(serializeSimulationHit(captureSimulationHit(restored, event.id)));
    expect(replaySimulationHit(capture).difference).toBe(0);
  }

  // The fifth source uses another editable level and panel. Its Q retains
  // the accepted-action snapshot despite a later real stat increase.
  const aloy = compileSourceRuntimeAbility({ actorId: "a", sourceActionId: "aloy-q", talentLevel: 1, ascension: 6, constellation: 0 });
  const aloyConfig = makeConfig({ duration: 4, cycleLength: 4,
    meta: { name: "可组合埃洛伊起手取样", version: "synthetic-aloy-context-v1", verificationStatus: "user-supplied" },
    dataVersion: "synthetic-aloy-context-v1", enemy: { level: 90, resistance: 0, defReduction: 0 },
    characters: [{ ...actors[0]!, element: "cryo", level: 80, stats: { ...actors[0]!.stats, baseAtk: 1250 } }],
    sourceAbilityBindings: [aloy.binding], reactionEngine: { mode: "aura-v3", initialAura: [], icdProfiles: {} },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ ...helper, hits: [], buffs: [{ key: "late-bonus", target: "a", stat: "atkFlat", value: 750, startFrame: 20, durationFrames: 200 }] }, aloy.ability],
      commands: [{ type: "skill", actorId: "a", abilityId: helper.id, atFrame: 0 }, { type: "burst", actorId: "a", abilityId: aloy.ability.id, atFrame: 1 }] },
  });
  const aloyResult = simulate(aloyConfig, { critMode: "average", energyMode: "configured" });
  expect(aloyResult.damageEvents).toHaveLength(1);
  const explosion: DamageEvent = aloyResult.damageEvents[0]!;
  expect(explosion.frame).toBe(101);
  expect(explosion.scalingValue).toBe(1250);
  expect(explosion.finalDamage).toBeCloseTo(1250 * 3.592 * (180 / 370) * 1.1, 9);
  expect(replaySimulationHit(captureSimulationHit(aloyResult, explosion.id)).difference).toBe(0);
});
