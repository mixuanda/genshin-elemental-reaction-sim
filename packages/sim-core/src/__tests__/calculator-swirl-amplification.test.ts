import { describe, expect, it } from "vitest";
import { assertTrustedSimulationResult, simulationResultSchema, type FrameBuffDefinition, type SimConfig } from "@genshin-dps-lab/schemas";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { simulateEventStepResult } from "../event-step-result";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const OPTIONS = { compatibilityMode: "legal-frame-v1", critMode: "noCrit", energyMode: "configured" } as const;
const UNIT = 1446.8535 * 0.6 * (1 + 16 * 100 / 2100 + 0.2);
function swirlConfig(options: { liveBonus?: number; resistance?: number; targetAura?: "hydro" | "cryo" | "none"; immune?: boolean; buffs?: FrameBuffDefinition[]; hitBonus?: number } = {}): SimConfig {
  const base = makeConfig();
  return makeConfig({
    randomSeed: "calculator-nested-swirl-source-proof", duration: 1, cycleLength: 1,
    reactionEngine: { mode: "aura-v9" }, targetTaskModel: { mode: "target-phase-v2" },
    characters: [{ ...base.characters[0]!, id: "source", level: 90, stats: { ...neutralStats, em: 100, reactionBonus: 0.2 } }],
    enemy: { level: 90, resistance: options.resistance ?? 0.1, defReduction: 0,
      targets: [
        { id: "enemy-0", name: "Swirl source", position: { x: 0, y: 0 }, initialAura: [{ element: "pyro", gaugeUnits: 1 }] },
        { id: "enemy-1", name: "Receiving target", position: { x: 1, y: 0 }, initialAura: options.targetAura === "none" ? [] : [{ element: options.targetAura ?? "hydro", gaugeUnits: 1 }] },
        { id: "enemy-2", name: "Unamplified target", position: { x: 2, y: 0 }, initialAura: [] },
      ], ...(options.immune ? { targetPhases: [{ id: "immune", label: "Immune receiving target", targetId: "enemy-1", startFrame: 0, endFrame: 60, reason: "TEST_IMMUNE", effects: { damage: "immune" as const, aura: "normal" as const, hitConfirm: "normal" as const } }] } : {}),
    }, rotation: [],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "source", swapFrames: 12,
      abilities: [{ id: "swirl", actorId: "source", name: "Synthetic Swirl", kind: "skill", cancelFrame: 8, animationEndFrame: 8, cooldownFrames: 0,
        hits: [{ id: "anemo", frame: 0, scaling: 1, element: "anemo", targeting: { targetId: "enemy-0", outcome: "landed" }, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } }, ...(options.hitBonus === undefined ? {} : { reactionBonus: options.hitBonus }) }],
        buffs: options.buffs ?? [{ key: "live-bonus", label: "F3 live bonus", target: "self", stat: "reactionBonus", value: options.liveBonus ?? 0.3, startFrame: 3, durationFrames: 5 }],
      }], commands: [{ type: "skill", actorId: "source", abilityId: "swirl" }],
    },
  });
}
function run(options: Parameters<typeof swirlConfig>[0] = {}) {
  const result = simulate(swirlConfig(options), OPTIONS);
  expect(simulationResultSchema.parse(result)).toEqual(result);
  const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1");
  if (!event) throw new Error("Missing actual F5 Swirl propagation");
  return { result, event };
}
function importEvent(result: ReturnType<typeof simulate>, eventId: number) {
  return parseSimulationHit(JSON.stringify({ schemaVersion: "calculator-event-v1", eventId, sourceResult: result }));
}

describe("source-proven nested Swirl amplification calculator replay", () => {
  it("replays the actual F5 Wet propagation with trigger EM and live amplification bonus", () => {
    const { result, event } = run();
    const base = UNIT * 0.9;
    const multiplier = 1.5 * (1 + 2.78 * 100 / 1500 + 0.5);
    expect(base).toBeCloseTo(1532.8379365714284, 10);
    expect(multiplier).toBe(2.528);
    expect(event).toMatchObject({ kind: "transformative-reaction", reaction: "swirlPyro", reactionAudit: { reaction: "reverseVaporize" },
      statsBeforeDamage: { em: 100, reactionBonus: 0.2 }, transformativeReactionFactors: { elementalMastery: 100, reactionBonus: 0.2 },
      damageFactors: { amplifyingReactionMultiplier: 2.528 },
    });
    expect(event.finalDamage).toBeCloseTo(base * multiplier, 10);
    const imported = importEvent(result, event.id);
    const replay = replaySimulationHit(imported);
    expect(replay.reproducedDamage).toBeCloseTo(base * multiplier, 10);
    expect(replay.difference).toBeCloseTo(0, 10);
    expect(new Set(replay.trace.map((node) => node.id)).size).toBe(replay.trace.length);
    expect(replay.trace.find((node) => node.id === "nestedAmplifyingDamage")?.childIds).toEqual(["transformativeDamage", "nestedAmplifyingMultiplier"]);
    const coreNode = replay.trace.find((node) => node.id === "transformativeDamage");
    if (!coreNode?.result) throw new Error("Missing executed transformative core trace");
    expect(coreNode.result.value).toBeCloseTo(base, 10);
    expect(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, event.id))).sourceResult).toEqual(result);
  });

  it("retains the explicit event-step witness through capture, JSON import and replay", () => {
    const { result, wire } = simulateEventStepResult(swirlConfig(), OPTIONS);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    const captured = captureSimulationHit(wire, event.id);
    expect(captured.schemaVersion).toBe("calculator-event-v2");
    const imported = parseSimulationHit(serializeSimulationHit(captured));
    expect(imported.eventStepResult).toEqual(wire);
    expect(replaySimulationHit(imported).reproducedDamage).toBeCloseTo(UNIT * 0.9 * 2.528, 10);
  });

  it.each([0.3, 0.75, -0.2])("preserves actual resistance %s independently of amplification", (resistance) => {
    const { result, event } = run({ resistance });
    const resistanceMultiplier = resistance < 0 ? 1 - resistance / 2 : resistance < 0.75 ? 1 - resistance : 1 / (4 * resistance + 1);
    const expected = UNIT * resistanceMultiplier * 2.528;
    expect(event.finalDamage).toBeCloseTo(expected, 10);
    expect(replaySimulationHit(importEvent(result, event.id)).reproducedDamage).toBeCloseTo(expected, 10);
  });

  it("retains immune zero separately from amplified potential damage", () => {
    const { result, event } = run({ immune: true });
    expect(event.potentialDamage).toBeCloseTo(UNIT * 0.9 * 2.528, 10);
    expect(event.finalDamage).toBe(0);
    const replay = replaySimulationHit(importEvent(result, event.id));
    expect(replay.reproducedDamage).toBe(0);
    expect(replay.trace.at(-1)?.inputs.find((row) => row.key === "potentialDamage")?.value).toBeCloseTo(event.potentialDamage, 10);
  });

  it("does not amplify the self hit or a propagation onto an empty target", () => {
    const { result } = run({ targetAura: "none" });
    const events = result.damageEvents.filter((row) => row.kind === "transformative-reaction");
    expect(events).toHaveLength(3);
    for (const event of events) {
      expect(event.damageFactors.amplifyingReactionMultiplier).toBe(1);
      expect(event.finalDamage).toBeCloseTo(UNIT * 0.9, 10);
      expect(replaySimulationHit(importEvent(result, event.id)).reproducedDamage).toBeCloseTo(UNIT * 0.9, 10);
    }
  });

  it("rejects a coherent stronger-buff result relabelled as the original source config", () => {
    const original = run();
    const changed = run({ liveBonus: 0.4 });
    const forged = structuredClone(changed.result);
    // All factors, damages, compositions, resolutions, totals and curves remain
    // internally consistent from a real run. Only claimed source authority is
    // replaced: the original declares +0.3, not +0.4 at the landing frame.
    forged.config = structuredClone(original.result.config);
    forged.runManifest = structuredClone(original.result.runManifest);
    forged.resolvedRuntimeOptions = structuredClone(original.result.resolvedRuntimeOptions);
    forged.reproducibilityKey = original.result.reproducibilityKey;
    expect(forged.damageEvents[changed.event.id]!.damageFactors.amplifyingReactionMultiplier).not.toBe(original.event.damageFactors.amplifyingReactionMultiplier);
    expect(forged.totalDamage).not.toBe(original.result.totalDamage);
    // Public/trusted legacy arithmetic alone accepts this coherent control;
    // the calculator must additionally prove the live source inputs itself.
    expect(simulationResultSchema.parse(forged)).toEqual(forged);
    expect(assertTrustedSimulationResult(forged)).toBe(forged);
    expect(() => importEvent(forged, changed.event.id)).toThrow("nestedSwirl.amplifyingMultiplier");
  });
});

describe("nested Swirl source-clock and fail-closed boundaries", () => {
  const bonus = (value: number, startFrame: number, durationFrames: number, key = "bonus"): FrameBuffDefinition => ({ key, target: "self", stat: "reactionBonus", value, startFrame, durationFrames });
  it.each([
    { name: "same-frame P1 bonus before F5 propagation", buffs: [bonus(0.3, 5, 2)], live: 0.5 },
    { name: "expiry exactly at F5", buffs: [bonus(0.3, 3, 2)], live: 0.2 },
    { name: "future undeployed bonus", buffs: [bonus(0.3, 6, 2)], live: 0.2 },
    { name: "same-key replacement rather than stacking", buffs: [bonus(0.3, 3, 5), bonus(0.1, 4, 4)], live: 0.3 },
    { name: "same-frame declaration order", buffs: [bonus(0.3, 3, 5), bonus(0.1, 3, 5)], live: 0.3 },
    { name: "expired replacement does not revive older bonus", buffs: [bonus(0.3, 3, 5), bonus(0.1, 4, 1)], live: 0.2 },
    { name: "cross-stat same-key replacement", buffs: [bonus(0.3, 3, 5), { ...bonus(0.1, 4, 4), stat: "atkPct" as const }], live: 0.2 },
  ])("reconstructs $name from accepted source declarations", ({ buffs, live }) => {
    const { result, event } = run({ buffs });
    const multiplier = 1.5 * (1 + 2.78 * 100 / 1500 + live);
    expect(event.potentialDamage).toBeCloseTo(UNIT * 0.9 * multiplier, 10);
    const replay = replaySimulationHit(importEvent(result, event.id));
    expect(replay.reproducedDamage).toBeCloseTo(UNIT * 0.9 * multiplier, 10);
    const node = replay.trace.find((entry) => entry.id === "nestedAmplifyingMultiplier");
    expect(node?.inputs.find((input) => input.key === "reactionBonus")?.value).toBeCloseTo(live, 12);
  });

  it("uses trigger-frame EM rather than landing EM and retains the hit-local bonus", () => {
    const buffs: FrameBuffDefinition[] = [
      { key: "trigger-em", target: "self", stat: "em", value: 50, startFrame: 0, durationFrames: 10 },
      { key: "later-em", target: "self", stat: "em", value: 100, startFrame: 3, durationFrames: 5 },
      bonus(0.3, 3, 5),
    ];
    const { result, event } = run({ buffs, hitBonus: 0.1 });
    const base = 1446.8535 * 0.6 * (1 + 16 * 150 / 2150 + 0.3) * 0.9;
    const multiplier = 1.5 * (1 + 2.78 * 150 / 1550 + 0.6);
    expect(event.transformativeReactionFactors).toMatchObject({ elementalMastery: 150 });
    expect(event.transformativeReactionFactors?.reactionBonus).toBeCloseTo(0.3, 12);
    const replay = replaySimulationHit(importEvent(result, event.id));
    expect(replay.reproducedDamage).toBeCloseTo(base * multiplier, 10);
    expect(replay.trace.find((entry) => entry.id === "nestedAmplifyingEmBonus")?.inputs[0]?.value).toBe(150);
  });

  it("uses the actual source actor with team targeting, not the first configured character", () => {
    const config = swirlConfig({ buffs: [{ ...bonus(0.3, 3, 5), target: "team" }] });
    config.characters.unshift({ ...config.characters[0]!, id: "other", stats: { ...neutralStats, em: 900, reactionBonus: 4 } });
    const result = simulate(config, OPTIONS);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    expect(replaySimulationHit(importEvent(result, event.id)).reproducedDamage).toBeCloseTo(UNIT * 0.9 * 2.528, 10);
  });

  it("ignores unexecuted declarations but accepts a genuinely stronger declared live bonus", () => {
    const config = swirlConfig({ liveBonus: 0.4 });
    const ability = config.timeline!.abilities[0]!;
    config.timeline!.abilities.push({ ...structuredClone(ability), id: "unused", buffs: [bonus(9, 0, 60)] });
    const result = simulate(config, OPTIONS);
    expect(result.actionLog.map((row) => row.sourceAbilityId)).toEqual(["swirl"]);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    expect(replaySimulationHit(importEvent(result, event.id)).reproducedDamage).toBeCloseTo(UNIT * 0.9 * (1.5 * (1 + 2.78 * 100 / 1500 + 0.6)), 10);
  });

  it("supports the corresponding nested Melt without borrowing an ordinary defense or CRIT factor", () => {
    const { result, event } = run({ targetAura: "cryo" });
    expect(event.reactionAudit.reaction).toBe("melt");
    const replay = replaySimulationHit(importEvent(result, event.id));
    expect(replay.reproducedDamage).toBeCloseTo(UNIT * 0.9 * (2 * (1 + 2.78 * 100 / 1500 + 0.5)), 10);
    expect(replay.trace.some((node) => ["defenseMultiplier", "criticalMultiplier"].includes(node.id))).toBe(false);
  });

  it("retains the existing execution-audit refusal of amplified explicit snapshots", () => {
    const config = swirlConfig();
    config.timeline!.abilities[0]!.hits![0]!.snapshotFrame = 0;
    // This advanced producer already fails before capture: its execution audit
    // lacks the composed nested input. This patch does not claim to support it
    // or relax that guard in order to reach the new calculator capability.
    expect(() => simulate(config, OPTIONS)).toThrow("executionAudit.hits.2.input: does not reproduce captured formula input");
  });

  it("does not impose the nested-only capability restriction on unamplified advanced sources", () => {
    const config = swirlConfig({ targetAura: "none" });
    config.timeline!.abilities[0]!.hits![0]!.snapshotFrame = 0;
    const result = simulate(config, OPTIONS);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    expect(replaySimulationHit(importEvent(result, event.id)).reproducedDamage).toBeCloseTo(UNIT * 0.9, 10);
  });

  it.each(["factor", "source", "trigger", "secondary", "extra"] as const)("retains rejection of malformed %s captures after a valid import", (kind) => {
    const { result, event } = run();
    expect(importEvent(result, event.id).sourceResult).toEqual(result);
    const forged = structuredClone(result);
    const row = forged.damageEvents[event.id]!;
    if (kind === "factor") row.damageFactors.amplifyingReactionMultiplier += 0.1;
    if (kind === "source") row.sourceActorId = "missing-source";
    if (kind === "trigger") forged.reactionDamageLog.find((entry) => entry.damageEventIds.includes(event.id))!.triggerDamageEventId = 999;
    if (kind === "secondary") row.reactionAudit.reaction = "melt";
    if (kind === "extra") Object.assign(forged, { unreviewedCaptureField: true });
    expect(() => importEvent(forged, event.id)).toThrow();
  });
});

describe("nested Swirl bounded snapshot and mastery support", () => {
  it("replays zero EM without a spurious mastery contribution", () => {
    const config = swirlConfig();
    config.characters[0]!.stats.em = 0;
    const result = simulate(config, OPTIONS);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    expect(event.transformativeReactionFactors?.elementalMastery).toBe(0);
    const expected = 1446.8535 * 0.6 * 1.2 * 0.9 * (1.5 * 1.5);
    expect(replaySimulationHit(importEvent(result, event.id)).reproducedDamage).toBeCloseTo(expected, 10);
  });

  it("retains the public wire's nonnegative-EM boundary rather than claiming support for a negative panel", () => {
    const config = swirlConfig();
    config.characters[0]!.stats.em = -100;
    const result = simulate(config, OPTIONS);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    expect(event.transformativeReactionFactors?.elementalMastery).toBe(-100);
    const parsed = simulationResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Negative EM unexpectedly became a supported result wire");
    expect(parsed.error.issues).toContainEqual(expect.objectContaining({
      path: ["damageEvents", event.id, "transformativeReactionFactors", "elementalMastery"], code: "too_small",
    }));
    expect(() => importEvent(result, event.id)).toThrow("Too small: expected number to be >=0");
  });

  it.each(["action", "foreign-owner"] as const)("keeps valid but unproved %s snapshot scopes fail-closed", (scope) => {
    const config = swirlConfig();
    if (scope === "action") config.timeline!.abilities[0]!.hits![0]!.snapshot = "action";
    else {
      config.characters.push({ ...config.characters[0]!, id: "other", stats: { ...neutralStats, em: 900 } });
      config.timeline!.abilities[0]!.hits![0]!.scalingOwnerId = "other";
    }
    const result = simulate(config, OPTIONS);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    const event = result.damageEvents.find((row) => row.frame === 5 && row.targetId === "enemy-1")!;
    expect(() => importEvent(result, event.id)).toThrow("暂不能独立还原扩散的嵌套增幅");
  });
});
