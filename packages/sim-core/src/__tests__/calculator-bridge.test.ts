import { describe, expect, it } from "vitest";
import { createVersionedContentHash } from "@genshin-dps-lab/schemas";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { simulate } from "../simulator";
import { defineDamageModifierPlugin } from "../plugins";
import { makeConfig, neutralStats } from "./fixtures";

describe("simulation to standalone calculator", () => {
  it("restores snapshot, source flat contributions, enemy policy and every factor", () => {
    const config = makeConfig({
      enemy: { level: 90, resistance: -0.2, defReduction: -0.3 },
      characters: [
        { ...makeConfig().characters[0]!, stats: { ...neutralStats, baseAtk: 2000, critRate: 0.7, critDmg: 1.2 } },
        { ...makeConfig().characters[0]!, id: "b", stats: { ...neutralStats, baseDef: 1000 } }
      ],
      rotation: [{ id: "snapshot", actorId: "a", name: "Snapshot", at: 0,
        buffs: [{ stat: "atkPct", value: 1, duration: 2, offset: 0 }],
        hits: [
          { id: "snap", scaling: 2, snapshot: "action", offset: 1, element: "pyro", flat: 300, flatSources: [{ ownerId: "b", stat: "def", multiplier: 0.5 }] },
          { id: "live", scaling: 2, snapshot: "hit", offset: 1, element: "pyro" }
        ]
      }]
    });
    const result = simulate(config);
    const capture = captureSimulationHit(result, 0);
    const restored = replaySimulationHit(parseSimulationHit(serializeSimulationHit(capture)));
    expect(restored.reproducedDamage).toBeCloseTo(result.damageEvents[0]!.finalDamage, 10);
    expect(restored.event.snapshot).toBe("action");
    expect(restored.event.statsBeforeDamage.atkPct).toBe(0);
    expect(result.damageEvents[1]!.statsBeforeDamage.atkPct).toBe(1);
    expect(restored.event.flatDetails[0]).toMatchObject({ ownerId: "b", sourceValue: 1000, amount: 500 });
    expect(restored.trace.find((node) => node.id === "contributor-0")?.result?.value).toBe(500);
    expect(restored.captured.sourceResult.runManifest).toEqual(result.runManifest);
    expect(restored.trace.at(-1)?.result?.value).toBe(restored.reproducedDamage);
  });

  it("keeps manual reactions marked as conditioned rather than automatic coverage", () => {
    const result = simulate(makeConfig({ rotation: [{ id: "manual", actorId: "a", name: "Manual", at: 0, hits: [{ offset: 0, scaling: 1, element: "pyro", reaction: "reverseVaporize" }] }] }));
    const replay = replaySimulationHit(captureSimulationHit(result, 0));
    expect(replay.reactionProvenance).toBe("conditioned-manual-override");
    expect(replay.trace.find((node) => node.id === "reactionMultiplier")?.status).toBe("assumed");
    expect(replay.warnings.some((warning) => warning.includes("不证明自动"))).toBe(true);
  });

  it("restores automatic overload with noncritical transformative formula", () => {
    const config = makeConfig({
      duration: 1,
      enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "Target", position: { x: 0, y: 0 }, initialAura: [{ element: "electro", gaugeUnits: 1 }] }] },
      reactionEngine: { mode: "aura-v2" },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
        abilities: [{ id: "skill", actorId: "a", name: "Skill", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "hit", frame: 0, scaling: 1, element: "pyro", application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] }],
        commands: [{ type: "skill", actorId: "a", abilityId: "skill" }]
      }
    });
    const result = simulate(config, { critMode: "allCrit" });
    const event = result.damageEvents.find((hit) => hit.kind === "transformative-reaction")!;
    expect(event).toBeDefined();
    const replay = replaySimulationHit(captureSimulationHit(result, event.id));
    expect(replay.reproducedDamage).toBe(event.finalDamage);
    expect(replay.reactionProvenance).toBe("automatic-engine");
    expect(replay.trace.some((node) => node.id === "criticalMultiplier")).toBe(false);
    expect(replay.trace.some((node) => node.id === "reactionGroupPolicy")).toBe(true);
  });

  it("rejects altered imported event values and missing event identities", () => {
    const result = simulate(makeConfig({ rotation: [{ id: "hit", actorId: "a", name: "Hit", at: 0, hits: [{ offset: 0, scaling: 1 }] }] }));
    const capture = captureSimulationHit(result, 0);
    const altered = JSON.parse(JSON.stringify(capture));
    altered.sourceResult.damageEvents[0].statsBeforeDamage.baseAtk += 100;
    expect(() => replaySimulationHit(altered)).toThrow();
    const alteredDamage = JSON.parse(JSON.stringify(capture));
    alteredDamage.sourceResult.damageEvents[0].finalDamage += 1;
    expect(() => replaySimulationHit(alteredDamage)).toThrow();
    expect(() => captureSimulationHit(result, 999)).toThrow("命中不存在");
  });

  it("retains additive reaction ownership and executes its contribution before ordinary damage", () => {
    const base = makeConfig();
    const config = makeConfig({
      duration: 1,
      characters: [{ ...base.characters[0]!, element: "electro", stats: { ...neutralStats, em: 200 } }],
      enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "Target", initialAura: [{ element: "dendro", gaugeUnits: 1 }] }] },
      reactionEngine: { mode: "aura-v3" },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
        abilities: [{ id: "skill", actorId: "a", name: "Skill", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
          hits: [0, 1].map((frame) => ({ id: `hit${frame}`, frame, scaling: 1, element: "electro" as const, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" as const } } })) }],
        commands: [{ type: "skill", actorId: "a", abilityId: "skill" }]
      }
    });
    const result = simulate(config);
    const hit = result.damageEvents.find((event) => event.additiveReactionFactors !== null)!;
    expect(hit).toBeDefined();
    const replay = replaySimulationHit(captureSimulationHit(result, hit.id));
    expect(replay.reproducedDamage).toBe(hit.finalDamage);
    expect(replay.event.additiveReactionFactors?.sourceActorId).toBe("a");
    expect(replay.trace.find((node) => node.id === "additiveReactionDamage")?.result?.value).toBe(hit.additiveReactionFactors!.flatDamage);
  });

  it("preserves immune-target zero independently from potential formula damage", () => {
    const config = makeConfig({
      duration: 1,
      enemy: { level: 90, resistance: 0.1, defReduction: 0, targetPhases: [{ id: "immune", label: "Immune", targetId: "enemy-0", startFrame: 0, endFrame: 60, reason: "TEST_IMMUNE", effects: { damage: "immune", aura: "normal", hitConfirm: "normal" } }] },
      rotation: [{ id: "hit", actorId: "a", name: "Hit", at: 0, hits: [{ offset: 0, scaling: 1 }] }]
    });
    const result = simulate(config);
    const replay = replaySimulationHit(captureSimulationHit(result, 0));
    expect(replay.event.potentialDamage).toBeGreaterThan(0);
    expect(replay.reproducedDamage).toBe(0);
    expect(replay.trace.at(-1)?.inputs.find((input) => input.key === "targetDamageMultiplier")?.value).toBe(0);
  });

  it("blocks plugin contexts whose complete original input is not captured", () => {
    const config = makeConfig({ rotation: [{ id: "hit", actorId: "a", name: "Hit", at: 0, hits: [{ offset: 0, scaling: 1 }] }] });
    const plugin = defineDamageModifierPlugin({ id: "noop", version: "test", kind: "code", contentHash: createVersionedContentHash("noop") }, () => ({ modifyDamage() {} }));
    const result = simulate(config, { plugins: [plugin] });
    expect(() => captureSimulationHit(result, 0)).toThrow("旧事件格式未完整记录");
  });
});
