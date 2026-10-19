import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { ArtifactDamageRuntime, ARTIFACT_DAMAGE_PROFILE, artifactDamageTrace, artifactDamageTransitionTrace } from "../artifact-damage-runtime";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { BOND_OF_LIFE_PROFILE } from "../bond-of-life";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

describe("fixed-source Echoes and Song actual artifact callbacks", () => {
  it("keeps Echoes failure cooldown, increasing odds, exclusive three-frame window and live ATK separate from RNG draws", () => {
    const runtime = new ArtifactDamageRuntime({ mode: ARTIFACT_DAMAGE_PROFILE.id, actors: [{ actorId: "a", effectId: "echoes-4pc" }] }, ["a"], "artifact-module");
    const hit = (frame: number, attack = 1000) => runtime.onEnemyHit({ frame, sourceActorId: "a", activeCharacterId: "a", attackTag: "normal", currentAttack: () => attack })[0]!;
    let successFrame = -1;
    for (let frame = 0; frame <= 48; frame += 12) {
      const decision = hit(frame);
      expect(decision.random).not.toBeNull();
      const transition = artifactDamageTransitionTrace({ ...decision, frame });
      expect(transition.find(row => row.id === "artifact.state.echoesSuccess")!.result!.value).toBe(Number(decision.outcome === "rite-triggered"));
      expect(transition.find(row => row.id === "artifact.state.echoesProbability")!.result!.value).toBe(decision.stateAfter.echoes[0]!.probability);
      if (decision.outcome === "rite-triggered") { successFrame = frame; expect(decision.flatDamage).toBe(700); break; }
      expect(decision.outcome).toBe("roll-failed");
      expect(decision.stateAfter.echoes[0]!.probability).toBeCloseTo(decision.stateBefore.echoes[0]!.probability + .2);
      expect(hit(frame + 1).outcome).toBe("cooldown-blocked");
    }
    expect(successFrame).toBeGreaterThanOrEqual(0);
    const randomBefore = runtime.captureState().random;
    const active = hit(successFrame + 2, 2000);
    expect(active).toMatchObject({ outcome: "rite-active", currentAttack: 2000, flatDamage: 1400, random: null });
    expect(artifactDamageTrace([active])[0]!.result!.value).toBe(1400);
    expect(hit(successFrame + 3).outcome).toBe("cooldown-blocked");
    expect(runtime.captureState().random).toEqual(randomBefore);
    expect(hit(successFrame + 12).random).not.toBeNull();
    const before = runtime.captureState();
    expect(runtime.onEnemyHit({ frame: 500, sourceActorId: "a", activeCharacterId: "b", attackTag: "normal", currentAttack: () => 9000 })[0]!.outcome).toBe("off-field");
    expect(runtime.captureState()).toEqual(before);
  });

  it("retains the fixed source shared Song pool, multi-holder consumption, replacement and exact-boundary queue semantics", () => {
    const runtime = new ArtifactDamageRuntime({ mode: ARTIFACT_DAMAGE_PROFILE.id, actors: ["a", "b"].map(actorId => ({ actorId, effectId: "song-of-days-past-4pc" })) }, ["a", "b", "c"], "unused");
    expect(runtime.onHeal(0, "a", 10000)!.startsWindow).toBe(true);
    expect(runtime.onHeal(240, "b", 10000)!.startsWindow).toBe(false);
    expect(runtime.convert(360, "a").stateAfter.song).toMatchObject({ healingPool: 0, waveHealing: 15000, charges: 5, wavesExpiresFrame: 960 });
    expect(runtime.onHeal(360, "a", 0)!.startsWindow).toBe(true);
    const hit = (frame: number) => runtime.onEnemyHit({ frame, sourceActorId: "c", activeCharacterId: "c", attackTag: "normal", currentAttack: () => 0 });
    expect(hit(360).map(row => row.flatDamage)).toEqual([1200, 1200]);
    expect(hit(361).map(row => row.stateAfter.song.charges)).toEqual([2, 1]);
    expect(hit(362).map(row => [row.outcome, row.flatDamage])).toEqual([["waves-consumed", 1200], ["waves-inactive", 0]]);
    // At the boundary this healing executes first, enters the previous pool,
    // and queues another window; the already queued conversion still executes.
    expect(runtime.onHeal(720, "b", 1000)!.startsWindow).toBe(true);
    expect(runtime.convert(720, "a").stateAfter.song).toMatchObject({ healingPool: 0, yearningExpiresFrame: 1080, waveHealing: 1000, charges: 5, wavesExpiresFrame: 1320 });
    expect(runtime.convert(1080, "b").stateAfter.song).toMatchObject({ waveHealing: 0, charges: 5, wavesExpiresFrame: 1680 });
    expect(hit(1680).every(row => row.outcome === "waves-inactive")).toBe(true);
  });

  it("captures actual party healing before debt, queued conversion, live-versus-action ATK, formula replay and random checkpoints", () => {
    // Keep the declared finite input unchanged, with the complete eight-second
    // observation tail required after either requested checkpoint boundary.
    const config = makeConfig({ duration: 16, cycleLength: 8,
      characters: ["a", "b"].map(id => ({ id, name: id, element: "pyro" as const, color: "#555555", level: 90,
        energyMax: 60, initialEnergy: 60, stats: { ...neutralStats } })),
      enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成中立目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
      playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: .5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
        characters: ["a", "b"].map(actorId => ({ actorId, initialHpRatio: 1, resistances: { physical: 0, pyro: 0, hydro: 0, cryo: 0, electro: 0, dendro: 0, anemo: 0, geo: 0 } })) },
      bondOfLifeModel: { mode: BOND_OF_LIFE_PROFILE.id, characters: [{ actorId: "a", initialRatio: 1 }, { actorId: "b", initialRatio: 0 }] },
      artifactDamageModel: { mode: ARTIFACT_DAMAGE_PROFILE.id, actors: [{ actorId: "a", effectId: "song-of-days-past-4pc" }, { actorId: "b", effectId: "echoes-4pc" }] },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
        abilities: [
          { id: "heal", actorId: "a", name: "明确合成群体治疗", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
            healthChanges: [{ id: "declared-heal", label: "明确请求治疗", frameOffset: 0, operation: "heal", target: { kind: "party" }, amount: { basis: "fixed", value: 8000 }, healingBonus: 0, incomingHealingBonus: 0, source: { kind: "custom", note: "只用于共享生命周期的合成治疗" } }] },
          { id: "attacks", actorId: "b", name: "明确合成普攻", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
            buffs: [{ key: "live-atk", target: "self", stat: "atkFlat", value: 200, startFrame: 10, durationFrames: 600 }],
            hits: [1, 13, 25, 37, 49, 261, 273, 285, 297, 309, 321].map((frame, index) => ({ id: `normal-${index}`, frame, scaling: 1, element: "physical" as const, attackTag: "normal" as const, snapshot: "action" as const })) },
        ], commands: [{ type: "skill", actorId: "a", abilityId: "heal", atFrame: 0 }, { type: "swap", characterId: "b", atFrame: 90 }, { type: "normal", actorId: "b", abilityId: "attacks", atFrame: 100 }] },
    });
    const options = { randomSeed: "artifact-capture-override", execution: { detailedTraces: true, checkpointFrames: [200, 400] } };
    const result = simulate(config, options);
    expect(result.playerHealthEvents!.map(row => row.actualChange)).toEqual([0, 0]);
    expect(result.artifactDamageLog!.filter(row => row.kind === "heal").map(row => row.requestedHealing)).toEqual([8000, 8000]);
    const recorded = result.artifactDamageLog!.find(row => row.kind === "heal")!;
    expect(artifactDamageTransitionTrace(recorded).find(row => row.id === "artifact.state.songPool")!.result!.value).toBe(recorded.stateAfter.song.healingPool);
    const consumed = result.artifactDamageLog!.find(row => row.outcome === "waves-consumed")!;
    expect(artifactDamageTransitionTrace(consumed).find(row => row.id === "artifact.state.songCharges")!.result!.value).toBe(consumed.stateAfter.song.charges);
    expect(result.artifactDamageLog!.find(row => row.kind === "song-convert")).toMatchObject({ frame: 360, stateAfter: { song: { waveHealing: 15000, charges: 5 } } });
    expect(result.artifactDamageLog!.filter(row => row.outcome === "waves-consumed").map(row => [row.frame, row.flatDamage])).toEqual([[361, 1200], [373, 1200], [385, 1200], [397, 1200], [409, 1200]]);
    expect(result.artifactDamageLog!.filter(row => row.effectId === "echoes-4pc" && row.frame > 110).every(row => row.currentAttack === 1200)).toBe(true);
    expect(result.damageEvents.every(row => row.statsBeforeDamage.baseAtk === 1000 && row.statsBeforeDamage.flatAtk === 0)).toBe(true);
    expect(result.executionAudit!.checkpointCoverage.complete, JSON.stringify(result.executionAudit!.checkpointCoverage)).toBe(true);
    const pending = result.executionAudit!.phaseCheckpoints[0]!.state.pendingEvents as { inFlight: Array<{ type: string; remainingTicks: number }> };
    expect(pending.inFlight.filter(row => row.type === "artifactSongConvert").map(row => row.remainingTicks)).toEqual([160]);
    const hit = result.damageEvents.find(row => row.frame === 361)!;
    const capture = parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, hit.id)));
    expect(replaySimulationHit(capture).difference).toBe(0);
    expect(replaySimulationHit(capture).trace.some(row => row.id === "artifact.flat.0")).toBe(true);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    expect(simulate(JSON.parse(JSON.stringify(config)), options).artifactDamageLog).toEqual(result.artifactDamageLog);
    const forged = structuredClone(result); forged.artifactDamageState!.random!.drawCount++;
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
  });
});
