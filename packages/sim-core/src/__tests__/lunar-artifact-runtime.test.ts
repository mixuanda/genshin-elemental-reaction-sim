import { describe, expect, it } from "vitest";
import { LunarArtifactRuntime } from "../lunar-artifact-runtime";
import { simulateLunarBloomProfile, simulateLunarChargedProfile, simulateLunarCrystallizeProfile, simulateLunarMixedProfile, simulateLunarMixedV2Profile } from "../simulator";
import { lunarChargedEventToCalculatorDocument } from "../lunar-charged-runtime";
import { lunarCrystallizeEventToCalculatorDocument } from "../lunar-crystallize-runtime";
import { lunarBloomEventToCalculatorDocument } from "../lunar-bloom-runtime";
import { lunarMixedEventToCalculatorDocument } from "../lunar-mixed-runtime";
import { lunarMixedV2EventToCalculatorDocument } from "../lunar-mixed-v2-runtime";
import { calculateDocument } from "../calculator";
import { makeConfig, neutralStats } from "./fixtures";
import { lunarBloomConfig, lunarBloomDeclaration, lunarBloomParty } from "./special-profile-fixtures";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "./lunar-mixed-v2.fixture";

function reactionConfig(mode: "charged" | "crystallize" | "mixed") {
  const base = makeConfig();
  const actors = mode === "charged" ? ["h", "e"] : mode === "crystallize" ? ["h", "g"] : ["h", "e", "g"];
  const elements = { h: "hydro", e: "electro", g: "geo" } as const;
  return makeConfig({ duration: 4, cycleLength: 5, reactionEngine: { mode: "aura-v3" }, rotation: [],
    characters: actors.map(id => ({ ...base.characters[0]!, id, element: elements[id as keyof typeof elements], stats: { ...neutralStats, em: 100, critRate: .3 } })),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "h", swapFrames: 5,
      abilities: actors.map(actorId => ({ id: actorId, actorId, name: actorId, kind: "skill" as const, cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: actorId, frame: 0, scaling: 1, application: { gaugeUnits: actorId === "h" ? 4 : 1, icd: { mode: "no-icd-v1" as const } } }] })),
      commands: [{ type: "skill", actorId: "h", abilityId: "h", atFrame: 0 },
        ...(mode === "crystallize" ? [] : [{ type: "swap" as const, characterId: "e", atFrame: 5 }, { type: "skill" as const, actorId: "e", abilityId: "e", atFrame: 10 }]),
        ...(mode === "charged" ? [] : [{ type: "swap" as const, characterId: "g", atFrame: mode === "mixed" ? 20 : 5 }, ...[0, 6, 12].map(offset => ({ type: "skill" as const, actorId: "g", abilityId: "g", atFrame: (mode === "mixed" ? 25 : 10) + offset }))])]
    } });
}

describe("source-backed Lunar artifact event integration", () => {
  it("preserves shared Flower ICD, strict query expiry and initial/returned Aubade semantics", () => {
    const make = () => new LunarArtifactRuntime({ artifacts: [{ actorId: "f", kind: "flower-of-paradise-lost-4pc" }, { actorId: "a", kind: "aubade-4pc" }], moonsignLevel: 2 }, ["f", "a"], "a");
    const runtime = make();
    expect(runtime.snapshot("a", 0)).toMatchObject({ offField: false, returnGraceActive: false });
    expect(runtime.reactionTriggered("f", 0, "bloom")).toBe(true);
    expect(runtime.reactionTriggered("f", 0, "bloom")).toBe(false);
    expect(runtime.reactionTriggered("f", 60, "hyperbloom")).toBe(false);
    expect(runtime.reactionTriggered("f", 61, "hyperbloom")).toBe(true);
    expect(runtime.snapshot("f", 660)).toMatchObject({ stacks: 2 });
    expect(runtime.snapshot("f", 661)).toMatchObject({ stacks: 0 });
    runtime.reactionTriggered("f", 661, "bloom");
    expect(runtime.snapshot("f", 661)).toMatchObject({ stacks: 1 });
    const unread = make(); unread.reactionTriggered("f", 0, "bloom"); unread.reactionTriggered("f", 600, "bloom");
    expect(unread.snapshot("f", 600)).toMatchObject({ stacks: 2 });
    const ordinaryRead = make(); ordinaryRead.reactionTriggered("f", 0, "bloom"); ordinaryRead.ordinaryReactionRead("f", 600); ordinaryRead.reactionTriggered("f", 600, "bloom");
    expect(ordinaryRead.snapshot("f", 600)).toMatchObject({ stacks: 1 });
    runtime.completedSwap("f", 700); expect(runtime.snapshot("a", 700)).toMatchObject({ offField: true });
    runtime.completedSwap("a", 710); expect(runtime.snapshot("a", 890)).toMatchObject({ returnGraceActive: true });
    expect(runtime.snapshot("a", 891)).toMatchObject({ returnGraceActive: false });
  });

  it("uses completed swaps and per-projectile snapshots, and replays all three reaction hosts", () => {
    const chargedInput = reactionConfig("charged");
    const chargedParty = [{ actorId: "h", characterKey: "columbina" }, { actorId: "e", characterKey: "fischl" }];
    const ordinary = simulateLunarChargedProfile(chargedInput, { party: chargedParty });
    const charged = simulateLunarChargedProfile(chargedInput, { party: chargedParty, artifacts: [{ actorId: "e", kind: "thundering-fury-4pc" }] });
    expect(charged.lunarChargedDamage).toBeGreaterThan(ordinary.lunarChargedDamage);
    expect(charged.baseResult.damageEvents).toEqual(ordinary.baseResult.damageEvents);
    expect(charged.specialDamageEvents[0]!.context.contributors.find(actor => actor.id === "e")!.artifactBonus).toEqual({ kind: "thundering-fury-4pc" });
    expect(calculateDocument(lunarChargedEventToCalculatorDocument(JSON.parse(JSON.stringify(charged)), 0)).totals!.expected).toBe(charged.specialDamageEvents[0]!.damage);

    const crystalInput = reactionConfig("crystallize");
    crystalInput.timeline!.commands.push({ type: "swap", characterId: "h", atFrame: 31 }); // completion 36, first snapshot 35
    const crystal = simulateLunarCrystallizeProfile(crystalInput, { party: [{ actorId: "h", characterKey: "columbina" }, { actorId: "g", characterKey: "zibai" }], artifacts: [{ actorId: "h", kind: "aubade-4pc" }], moonsignLevel: 2 });
    expect(crystal.specialDamageEvents.map(event => event.intent.snapshotFrame)).toEqual([35, 47, 59]);
    expect(crystal.specialDamageEvents.map(event => event.context.contributors.find(actor => actor.id === "h")!.artifactBonus)).toEqual([
      { kind: "aubade-4pc", offField: true, returnGraceActive: false, moonsignLevel: 2 },
      { kind: "aubade-4pc", offField: false, returnGraceActive: true, moonsignLevel: 2 },
      { kind: "aubade-4pc", offField: false, returnGraceActive: true, moonsignLevel: 2 },
    ]);
    expect(calculateDocument(lunarCrystallizeEventToCalculatorDocument(JSON.parse(JSON.stringify(crystal)), 0)).totals!.expected).toBe(crystal.specialDamageEvents[0]!.damage);
    crystalInput.timeline!.commands[crystalInput.timeline!.commands.length - 1] = { type: "swap", characterId: "h", atFrame: 30 }; // completion exactly snapshot 35
    const exactSwap = simulateLunarCrystallizeProfile(crystalInput, { party: [{ actorId: "h", characterKey: "columbina" }, { actorId: "g", characterKey: "zibai" }], artifacts: [{ actorId: "h", kind: "aubade-4pc" }], moonsignLevel: 2 });
    expect(exactSwap.specialDamageEvents[0]!.context.contributors.find(actor => actor.id === "h")!.artifactBonus).toMatchObject({ offField: false, returnGraceActive: true });

    const mixed = simulateLunarMixedProfile(reactionConfig("mixed"), { party: [...chargedParty, { actorId: "g", characterKey: "zibai" }], artifacts: [{ actorId: "h", kind: "aubade-4pc" }], moonsignLevel: 1 });
    expect(new Set(mixed.specialDamageEvents.map(event => event.context.branch)).size).toBe(2);
    for (const event of mixed.specialDamageEvents) {
      expect(event.context.contributors.find(actor => actor.id === "h")!.artifactBonus).toMatchObject({ kind: "aubade-4pc", offField: true, moonsignLevel: 1 });
      expect(calculateDocument(lunarMixedEventToCalculatorDocument(JSON.parse(JSON.stringify(mixed)), event.id)).totals!.expected).toBe(event.damage);
    }
  });

  it("obtains Flower stacks from real Bloom ownership in standalone and shared mixed-v2 captures", () => {
    const input = lunarBloomConfig();
    input.timeline!.initialActiveCharacterId = "d";
    input.timeline!.commands = [{ type: "skill", actorId: "d", abilityId: "d", atFrame: 0 }, { type: "swap", characterId: "c", atFrame: 5 }, { type: "skill", actorId: "c", abilityId: "c", atFrame: 6 }, { type: "charge", actorId: "c", abilityId: "moon", atFrame: 160 }];
    const bloom = simulateLunarBloomProfile(input, { party: lunarBloomParty, abilities: [lunarBloomDeclaration], artifacts: [{ actorId: "c", kind: "flower-of-paradise-lost-4pc" }] });
    expect(bloom.baseResult.damageEvents.some(event => event.actorId === "c" && event.reactionAudit.bloomReactions.length > 0)).toBe(true);
    for (const event of bloom.specialDamageEvents) {
      expect(event.context.contributors[0]!.artifactBonus).toEqual({ kind: "flower-of-paradise-lost-4pc", stacks: 1 });
      expect(calculateDocument(lunarBloomEventToCalculatorDocument(JSON.parse(JSON.stringify(bloom)), event.id)).totals!.expected).toBe(event.damage);
    }
    const mixed = simulateLunarMixedV2Profile(mixedV2Config(), { party: mixedV2Party, abilities: [mixedV2Declaration], artifacts: [{ actorId: "h", kind: "flower-of-paradise-lost-4pc" }, { actorId: "e", kind: "thundering-fury-4pc" }, { actorId: "g", kind: "aubade-4pc" }], moonsignLevel: 2 });
    const direct = mixed.specialDamageEvents.filter(event => event.kind === "direct-ability");
    expect(direct).toHaveLength(3);
    // This fixture's Bloom owners are other actors; a team reaction must not invent h's stacks.
    expect(mixed.baseResult.damageEvents.filter(event => event.actorId === "h").every(event => event.reactionAudit.bloomReactions.length === 0)).toBe(true);
    for (const event of direct) expect(event.context.contributors[0]!.artifactBonus).toEqual({ kind: "flower-of-paradise-lost-4pc", stacks: 0 });
    for (const event of mixed.specialDamageEvents) expect(calculateDocument(lunarMixedV2EventToCalculatorDocument(JSON.parse(JSON.stringify(mixed)), event.id)).totals!.expected).toBe(event.damage);
    expect(mixed.baseResult.resolvedRuntimeOptions.execution?.lunarMixedV2?.artifacts).toHaveLength(3);
  });
});
