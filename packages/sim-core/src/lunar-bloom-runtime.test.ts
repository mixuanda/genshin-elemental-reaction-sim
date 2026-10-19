import { describe, expect, it } from "vitest";
import type { ResolvedEnemyTargetProfile } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./__tests__/fixtures";
import { createMoondewCleanseAbility, LunarBloomRuntime, type LunarBloomRuntimeOptions } from "./lunar-bloom-runtime";
import { calculateMoondewCleanseHit, MOONDEW_CLEANSE } from "./lunar-bloom-calculation";
import { calculateSpecialCalculatorHit } from "./special-calculator";

const options: LunarBloomRuntimeOptions = { profileId: "lunar-bloom-reference-v1", party: [{ actorId: "c", characterKey: "columbina" }, { actorId: "d", characterKey: "nahida" }], abilities: [{ sourceAbilityId: "moon", actorId: "c", abilityKey: MOONDEW_CLEANSE.key, talentLevel: 10, ascension: 6, constellation: 0 }] };
const target: ResolvedEnemyTargetProfile = { id: "target", name: "Target", level: 90, resistance: 0.1, defReduction: 0, freezeResistance: 0, initialAura: [], position: null, hitboxRadius: 1 };
function runtime(dynamic = false, abilityOverrides: Partial<ReturnType<typeof createMoondewCleanseAbility>> = {}) {
  const base = makeConfig();
  const config = makeConfig({ duration: 10, cycleLength: 10, reactionEngine: { mode: "aura-v5" }, characters: [{ ...base.characters[0]!, id: "c", element: "hydro" }, { ...base.characters[0]!, id: "d", element: "dendro" }], rotation: [], timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1, abilities: [{ ...createMoondewCleanseAbility("c", "moon"), ...abilityOverrides }], commands: [] } });
  return new LunarBloomRuntime({ config, options, target, critMode: "average", snapshot: (_actor, frame) => ({ ...neutralStats, baseHp: dynamic ? frame < 220 ? 35000 : frame < 230 ? 40000 : 30000 : 35000 }), resistance: frame => dynamic && frame >= 230 ? -0.1 : 0.1, beforeWake: () => {} });
}
const bloom = (frame: number, allowed = true) => ({ frame, sourceActorId: "d", sourceEventId: `bloom-${frame}`, attackId: `attack-${frame}`, targetId: "target", element: "dendro" as const, gaugeUnits: 1, actualIcdAllowed: allowed, ordinaryBloomCreated: true });
const start = (frame: number) => ({ frame, actorId: "c", sourceAbilityId: "moon", sourceEventId: `moon-${frame}`, fromState: "idle" as const });

describe("source-declared Lunar-Bloom resource and direct ability execution", () => {
  it("preserves core conversion without immediate damage and accumulates only actual Bloom windows", () => {
    const run = runtime();
    run.application(bloom(0, false)); run.advanceThrough(150);
    expect(run.verdantDew.full).toBe(0);
    run.application(bloom(150)); run.application(bloom(270)); run.advanceThrough(450);
    expect(run.verdantDew).toMatchObject({ ruleId: "verdant-dew-fixed-core-order-v2", full: 1, partialFrames: 122 });
    expect(run.damageEvents).toEqual([]);
    expect(run.log.filter(row => row.type === "ordinary-core-preserved")).toHaveLength(2);
    expect(run.log.find(row => row.type === "resource-gain")?.frame).toBe(297);
  });
  it("executes real one-Dew consumption then three live snapshots with replayable passive traces", () => {
    const run = runtime(true); run.application(bloom(0)); run.advanceThrough(147);
    // Source animation checks Dew before the new gain at this same frame.
    expect(() => run.startDeclaredAbility(start(147))).toThrow(/动作开始时/);
    run.startDeclaredAbility(start(150)); run.advanceThrough(242);
    expect(run.log.find(row => row.type === "ability-resource-consumed")?.frame).toBe(205);
    expect(run.damageEvents.map(event => event.frame)).toEqual([212, 220, 242]);
    expect(run.damageEvents.map(event => event.context.contributors[0]!.base)).toEqual([35000, 40000, 30000].map(hp => expect.objectContaining({ kind: "direct-stat-talent", statValue: hp, talentCoefficient: 0.027202 })));
    expect(run.damageEvents.map(event => event.damage)).toEqual([35000 * 0.027202 * 1.07 * 0.9, 40000 * 0.027202 * 1.07 * 0.9, 30000 * 0.027202 * 1.06 * 1.05]);
    for (const event of run.damageEvents) {
      const restored = JSON.parse(JSON.stringify(event.context));
      const replay = calculateSpecialCalculatorHit(restored, `moondew-${event.sourceEventId}-${event.hitIndex}`);
      expect(replay.expected).toBe(event.damage); expect(replay.trace).toEqual(event.trace);
      expect(restored.context.sourceAbilityExecution).toMatchObject({ effectiveTalentLevel: 10, ascension: 6, constellation: 0, fromState: "idle", castFrame: 150, resourceReceipt: { resource: "verdant-dew", consumed: 1, frame: 205 } });
      expect(event.trace.find(node => node.titleKey === "special.columbinaMoonsign")?.symbolicFormula).toContain("1000");
    }
    expect(run.verdantDew).toMatchObject({ full: 0, partialFrames: 2 });
  });
  it("stops production at cap before same-frame consumption and rejects invented/free abilities", () => {
    expect(() => runtime(false, { cancelFrame: 43 })).toThrow(/124 帧/);
    expect(() => runtime(false, { energyCost: 1 })).toThrow(/额外效果/);
    const run = runtime();
    expect(() => run.startDeclaredAbility(start(0))).toThrow(/已有草露/);
    for (const at of [0, 120, 240, 360]) run.application(bloom(at));
    run.advanceThrough(439); expect(run.verdantDew.full).toBe(3);
    run.startDeclaredAbility(start(440)); run.advanceThrough(495);
    expect(run.verdantDew).toMatchObject({ full: 2, partialFrames: 0 });
    run.advanceThrough(496); expect(run.verdantDew.partialFrames).toBe(1);
    expect(() => run.startDeclaredAbility({ ...start(496), sourceAbilityId: "guess-from-label" })).toThrow(/显式来源能力声明/);
    expect(() => run.startDeclaredAbility(start(496))).toThrow(/完整闲置起手/);
  });
  it("matches the independent Decimal teaching vector without turning the event into a reaction-level formula", () => {
    const calculated = calculateMoondewCleanseHit({ actorId: "c", targetId: "target", sourceEventId: "skill", frame: 62, talentLevel: 10, ascension: 6, constellation: 0, hitIndex: 0, resourceConsumption: { frame: 55, sourceEventId: "skill", consumed: 1 } }, { hp: 35000, elementalMastery: 0, critRate: 0, critDamage: 1 }, 0.1, "average");
    expect(calculated.damage).toBeCloseTo(916.84341, 8);
    expect(calculated.context.branch).toBe("lunar-bloom-direct");
    expect(calculated.trace.some(node => node.titleKey === "special.levelBase")).toBe(false);
  });
});
