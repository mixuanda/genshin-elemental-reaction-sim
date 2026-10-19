import { describe, expect, it } from "vitest";
import { simulationResultSchema, type CharacterProfile, type Element, type FrameHitDefinition, type HealthChangeDefinition, type SimConfig, type SimulationResult } from "@genshin-dps-lab/schemas";
import { ARTIFACT_BUFF_SOURCE } from "@genshin-dps-lab/reaction-formulas";
import { BOND_OF_LIFE_PROFILE } from "../bond-of-life";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const actor = (id: string, element: Element): CharacterProfile => ({ id, name: `合成 ${id}`, element, color: "#777777", level: 90, energyMax: 40, initialEnergy: 40, stats: { ...neutralStats } });
const hit = (id: string, frame: number, targetId: string, options: Partial<FrameHitDefinition> = {}): FrameHitDefinition => ({ id, label: id, frame, element: "physical", scaling: 1, attackTag: "normal", snapshot: "hit", ...(options.geometry === undefined ? { targeting: { targetId, outcome: "landed" as const } } : {}), ...options });
const application = { gaugeUnits: 1, icd: { mode: "no-icd-v1" as const } };
const meta = { name: "六套圣遗物共享事件合成集成向量", version: "1", verificationStatus: "user-supplied" as const };
const healthSource = { kind: "custom" as const, note: "明确合成生命资源事件，只验证实际回调和装备生命周期，不认证任何角色技能" };
const hitAt = (result: SimulationResult, actorId: string, frame: number) => {
  const row = result.damageEvents.find(event => event.sourceActorId === actorId && event.frame === frame && event.reaction !== "bloom");
  expect(row, `${actorId} 的实际 ${frame}f 命中`).toBeDefined();
  return row!;
};
function assertReplay(result: SimulationResult, damageId: number): void {
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  expect(restored.artifactBuffLog).toEqual(result.artifactBuffLog);
  expect(restored.artifactBuffState).toEqual(result.artifactBuffState);
  const capture = parseSimulationHit(serializeSimulationHit(captureSimulationHit(restored, damageId)));
  expect(replaySimulationHit(capture).difference).toBe(0);
}

/** Source constants are independent numerical expectations below. The fixtures
 * use actual accepted actions, Aura reactions and health callbacks, not injected
 * artifact events or already-buffed panels. Prepared for the root's single run. */
describe("six fixed-source artifact buff lifecycles through real simulation hooks", () => {
  it("applies Noblesse delay, Instructor and Gilded without rewriting snapshots, and Paradise only to an actual Bloom", () => {
    const config = makeConfig({ meta, duration: 8, cycleLength: 8,
      characters: [actor("n", "pyro"), actor("i", "pyro"), actor("g", "hydro"), actor("p", "hydro")],
      reactionEngine: { mode: "aura-v5" },
      enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
        { id: "enemy-0", name: "普通伤害目标", position: { x: 300, y: 0 }, hitboxRadius: 0 },
        { id: "instructor", name: "教官真实反应目标", position: { x: 100, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "hydro", gaugeUnits: 1 }] },
        { id: "gilded", name: "饰金真实反应目标", position: { x: 200, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "pyro", gaugeUnits: 1 }] },
        { id: "bloom", name: "单颗草原核目标", position: { x: 0, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "dendro", gaugeUnits: .625 }] },
      ] },
      artifactBuffModel: { mode: ARTIFACT_BUFF_SOURCE.mode, actors: [
        { actorId: "n", effectId: "noblesse-4pc", noblesseSelfDelayFrames: 1 },
        { actorId: "i", effectId: "instructor-4pc" }, { actorId: "g", effectId: "gilded-4pc" }, { actorId: "p", effectId: "paradise-4pc" },
      ] },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "n", swapFrames: 1,
        abilities: [
          { id: "n-q", actorId: "n", name: "真实接受的合成爆发", kind: "burst", energyCost: 40, cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
            hits: [hit("before-own-delay", 0, "enemy-0", { attackTag: "burst" }), hit("after-own-delay", 1, "enemy-0", { attackTag: "burst" }), hit("retained-action-snapshot", 2, "enemy-0", { attackTag: "burst", snapshot: "action" })] },
          { id: "i-e", actorId: "i", name: "教官真实蒸发与后续取样", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
            hits: [hit("instructor-trigger", 1, "instructor", { element: "pyro", attackTag: "skill", snapshot: "action", application, geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 100, y: 0 }, radius: 1 } }), hit("instructor-old-snapshot", 2, "enemy-0", { snapshot: "action" }), hit("instructor-live", 3, "enemy-0")] },
          { id: "g-e", actorId: "g", name: "饰金真实蒸发与后续取样", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
            hits: [hit("gilded-trigger", 1, "gilded", { element: "hydro", attackTag: "skill", snapshot: "action", application }), hit("gilded-live", 2, "enemy-0")] },
          { id: "p-e", actorId: "p", name: "乐园真实绽放生成", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
            hits: [hit("paradise-trigger", 1, "bloom", { element: "hydro", attackTag: "skill", scaling: 0, application })] },
        ], commands: [
          { type: "burst", actorId: "n", abilityId: "n-q", atFrame: 0 },
          { type: "swap", characterId: "i", atFrame: 10 }, { type: "skill", actorId: "i", abilityId: "i-e", atFrame: 12 },
          { type: "swap", characterId: "g", atFrame: 20 }, { type: "skill", actorId: "g", abilityId: "g-e", atFrame: 22 },
          { type: "swap", characterId: "p", atFrame: 30 }, { type: "skill", actorId: "p", abilityId: "p-e", atFrame: 32 },
        ] },
    });
    const result = simulate(config, { execution: { detailedTraces: true } });
    expect(result.actionLog.filter(row => row.sourceAbilityId).map(row => row.frame)).toEqual([0, 12, 22, 32]);
    expect(result.energyStats.n!.final).toBe(0);
    // Same-level defense is 1/2, zero resistance/crit/bonus: 1000 -> 500;
    // after the actual +20% buff 1200 -> 600. The old action snapshot stays 500.
    expect([0, 1, 2].map(frame => hitAt(result, "n", frame).finalDamage)).toEqual([500, 600, 500]);
    const noblesse = result.artifactBuffLog!.find(row => row.effectId === "noblesse-4pc" && row.event.kind === "burst")!;
    expect(noblesse).toMatchObject({ frame: 0, outcome: "scheduled", actionLogIndex: 0 });
    expect(noblesse.applications.map(row => [row.receiverId, row.value, row.startFrame, row.expiresFrame])).toEqual([["i", .2, 0, 720], ["g", .2, 0, 720], ["p", .2, 0, 720]]);
    expect(result.artifactBuffLog!.find(row => row.event.kind === "delayed-buff")).toMatchObject({ frame: 1, parentArtifactBuffLogId: noblesse.id, applications: [{ receiverId: "n", value: .2, startFrame: 1, expiresFrame: 721 }] });
    const instructor = result.artifactBuffLog!.find(row => row.effectId === "instructor-4pc" && row.outcome === "applied")!;
    expect(instructor).toMatchObject({ frame: 13, event: { kind: "reaction", reaction: "reverseVaporize", sourceActorId: "i", activeCharacterId: "i" } });
    expect(instructor.applications.map(row => [row.receiverId, row.value, row.expiresFrame])).toEqual([["n", 120, 493], ["i", 120, 493], ["g", 120, 493], ["p", 120, 493]]);
    expect(hitAt(result, "i", 14).statsBeforeDamage.em).toBe(0);
    expect(hitAt(result, "i", 15)).toMatchObject({ finalDamage: 600, statsBeforeDamage: { em: 120 } });
    const gilded = result.artifactBuffLog!.find(row => row.effectId === "gilded-4pc" && row.outcome === "applied")!;
    expect(gilded).toMatchObject({ frame: 23, sameElementCount: 1, differentElementCount: 2, stateAfter: { effectExpiresFrame: 503, cooldownExpiresFrame: 503 } });
    expect(gilded.applications.map(row => [row.stat, row.value])).toEqual([["atkPct", .14], ["em", 100]]);
    expect(hitAt(result, "g", 23).statsBeforeDamage).toMatchObject({ atkPct: .2, em: 120 });
    // 1000 * (1 + .20 + .14) / 2 = 670; EM is 120 + 2 * 50 = 220.
    expect(hitAt(result, "g", 24).finalDamage).toBeCloseTo(670, 10);
    expect(hitAt(result, "g", 24).statsBeforeDamage.em).toBe(220);
    const paradise = result.artifactBuffLog!.find(row => row.effectId === "paradise-4pc" && row.outcome === "stack-gained")!;
    expect(paradise).toMatchObject({ frame: 33, stateAfter: { stacks: 1, cooldownExpiresFrame: 93, effectExpiresFrame: 633 }, applications: [] });
    expect(paradise.trace.find(raw => (raw as { id: string }).id === "artifact.buff.paradise")).toMatchObject({ result: { value: .5 } });
    const blooms = result.damageEvents.filter(row => row.kind === "transformative-reaction" && row.reaction === "bloom");
    expect(blooms).toHaveLength(1);
    expect(blooms[0]).toMatchObject({ sourceActorId: "p", targetId: "bloom", em: 120 });
    // Fixed level-90 base 1446.8535; Bloom ×2; live EM120; Paradise .4+.1.
    // Ordinary +ATK and damage bonus do not enter this transformative formula.
    expect(blooms[0]!.finalDamage).toBeCloseTo(1446.8535 * 2 * (1 + 16 * 120 / 2120 + .5), 8);
    assertReplay(result, blooms[0]!.id);
    assertReplay(result, hitAt(result, "g", 24).id);
  });

  it("uses actual debt callbacks for Fragment and positive drain/cooldown/swap hooks for Vermillion", () => {
    const target = { kind: "actor" as const, actorId: "f" };
    const common = (id: string, frameOffset: number) => ({ id, label: id, frameOffset, target, source: healthSource });
    const changes: HealthChangeDefinition[] = [
      { ...common("debt-granted", 1), operation: "bond-add", amount: { basis: "fixed", value: 1000 } },
      { ...common("debt-removed", 2), operation: "bond-remove", amount: { basis: "fixed", value: 200 } },
      { ...common("heal-pays-debt", 3), operation: "heal", amount: { basis: "fixed", value: 300 }, healingBonus: 0, incomingHealingBonus: 0 },
      { ...common("refresh-at-cap", 4), operation: "heal", amount: { basis: "fixed", value: 50 }, healingBonus: 0, incomingHealingBonus: 0 },
      { ...common("zero-no-source-event", 5), operation: "bond-add", amount: { basis: "fixed", value: 0 } },
      ...[10, 20, 59, 108, 157, 206].map((frame): HealthChangeDefinition => ({ ...common(`actual-drain-${frame}`, frame), operation: "consume", amount: { basis: "fixed", value: 100 }, minimumHpRatio: 0 })),
    ];
    const config: SimConfig = makeConfig({ meta, duration: 7, cycleLength: 7, characters: [actor("v", "pyro"), actor("f", "hydro")],
      enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "中立目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
      playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: .5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: ["v", "f"].map(actorId => ({ actorId, initialHpRatio: 1, resistances: { physical: 0, pyro: 0, hydro: 0, electro: 0, cryo: 0, anemo: 0, geo: 0, dendro: 0 } })) },
      bondOfLifeModel: { mode: BOND_OF_LIFE_PROFILE.id, characters: [{ actorId: "v", initialRatio: 0 }, { actorId: "f", initialRatio: 0 }] },
      artifactBuffModel: { mode: ARTIFACT_BUFF_SOURCE.mode, actors: [{ actorId: "v", effectId: "vermillion-4pc" }, { actorId: "f", effectId: "fragment-4pc" }] },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "v", swapFrames: 1, abilities: [
        { id: "v-q", actorId: "v", name: "真实爆发和声明生命事件", kind: "burst", energyCost: 40, cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0, healthChanges: changes,
          hits: [0, 11, 21, 60, 109, 158, 207, 212].map(frame => hit(`v-${frame}`, frame, "enemy-0", { attackTag: "burst" })) },
        { id: "f-n", actorId: "f", name: "谐律增伤及窗口到期取样", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0, hits: [hit("fragment-active", 1, "enemy-0"), hit("fragment-expiry-read", 152, "enemy-0")] },
      ], commands: [{ type: "burst", actorId: "v", abilityId: "v-q", atFrame: 0 }, { type: "swap", characterId: "f", atFrame: 210 }, { type: "normal", actorId: "f", abilityId: "f-n", atFrame: 212 }] },
    });
    const result = simulate(config, { execution: { detailedTraces: true } });
    const fragment = result.artifactBuffLog!.filter(row => row.effectId === "fragment-4pc" && row.event.kind === "bond-of-life-change");
    expect(fragment.map(row => [row.frame, row.event.kind === "bond-of-life-change" ? row.event.amount : null, row.stateAfter.stacks, row.stateAfter.effectExpiresFrame])).toEqual([[1, -1000, 1, 361], [2, 200, 2, 362], [3, 300, 3, 363], [4, 50, 3, 364]]);
    expect(fragment.map(row => row.applications[0]!.value)).toEqual([.18, .36, .54, .54]);
    for (const row of fragment) {
      const actual = result.playerHealthEvents![row.playerHealthEventId!];
      expect(row.event.kind === "bond-of-life-change" ? row.event.amount : null).toBe(actual!.bondOfLife!.sourceCallbackAmount);
    }
    const vermillion = result.artifactBuffLog!.filter(row => row.effectId === "vermillion-4pc" && row.event.kind === "hp-drain");
    expect(vermillion.map(row => [row.frame, row.outcome, row.stateAfter.stacks])).toEqual([[10, "stack-gained", 1], [20, "cooldown-blocked", 1], [59, "stack-gained", 2], [108, "stack-gained", 3], [157, "stack-gained", 4], [206, "max-stacks", 4]]);
    expect(vermillion.every(row => row.stateAfter.effectExpiresFrame === 960)).toBe(true);
    // Source behavior intentionally checks any player's positive DrainInfo;
    // here f loses HP while v owns the active burst window.
    expect(vermillion.every(row => result.playerHealthEvents![row.playerHealthEventId!]!.targetActorId === "f")).toBe(true);
    const expectedV = [540, 590, 590, 640, 690, 740, 740, 500];
    [0, 11, 21, 60, 109, 158, 207, 212].forEach((frame, index) => expect(hitAt(result, "v", frame).finalDamage).toBeCloseTo(expectedV[index]!, 10));
    expect(result.artifactBuffLog!.find(row => row.effectId === "vermillion-4pc" && row.outcome === "window-removed")).toMatchObject({ frame: 211, stateAfter: { stacks: 0, effectExpiresFrame: null } });
    expect(hitAt(result, "f", 213).finalDamage).toBeCloseTo(770, 10); // 1000 * (1 + 3 * .18) / 2.
    expect(hitAt(result, "f", 364).finalDamage).toBe(500); // Full Stats read deletes the exact-expiry modifier.
    expect(result.artifactBuffLog!.find(row => row.effectId === "fragment-4pc" && row.outcome === "expired-on-read")).toMatchObject({ frame: 364, stateAfter: { effectExpiresFrame: null } });
    expect(result.playerHpSummaries.find(row => row.actorId === "f")).toMatchObject({ finalHp: 9400, finalBondOfLife: 450 });
    assertReplay(result, hitAt(result, "f", 213).id);
  });
});
