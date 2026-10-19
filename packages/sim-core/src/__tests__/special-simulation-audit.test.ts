import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { auditSpecialReactionIntegration } from "../special-simulation-audit";
import { makeConfig } from "./fixtures";

function actualApplications() {
  const base = makeConfig();
  return simulate(makeConfig({
    duration: 1, cycleLength: 2, reactionEngine: { mode: "aura-v2" },
    characters: [
      { ...base.characters[0]!, element: "hydro", id: "hydro" },
      { ...base.characters[0]!, element: "electro", id: "electro" }
    ],
    enemy: { ...base.enemy, targets: [{ id: "enemy-0", name: "Enemy", position: { x: 0, y: 0 } }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "hydro", swapFrames: 1,
      abilities: ["hydro", "electro"].map((element) => ({ id: element, actorId: element, name: element, kind: "skill" as const, cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ frame: 0, scaling: 1, element: element as "hydro" | "electro", application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" as const } } }] })),
      commands: [{ type: "skill", actorId: "hydro", abilityId: "hydro" }, { type: "swap", characterId: "electro" }, { type: "skill", actorId: "electro", abilityId: "electro" }]
    }
  }), { compatibilityMode: "legal-frame-v1" });
}

describe("special reaction integration diagnostics", () => {
  it("uses actual aura/ICD events but never double-counts unimplemented conversion", () => {
    const result = actualApplications();
    const original = JSON.stringify(result);
    const audit = auditSpecialReactionIntegration(result, [{ actorId: "hydro", characterKey: "barbara" }, { actorId: "electro", characterKey: "flins" }]);
    expect(audit.processedApplicationEventIds).toHaveLength(2);
    expect(audit.status).toBe("conversion-not-applied");
    expect(audit.log.some((entry) => entry.type === "entity-create" && entry.ruleId.endsWith("lunar-charged"))).toBe(true);
    expect(audit.blockers.some((entry) => entry.field === "conversion-not-applied")).toBe(true);
    expect(audit.formalSpecialDamage).toBeNull();
    expect(JSON.stringify(result)).toBe(original);
    expect(audit.damageIntents.every((intent) => intent.blockedMechanics.some((entry) => entry.field === "conversion-not-applied"))).toBe(true);
  });
  it("preserves ordinary fallback when no party member enables conversion", () => {
    const audit = auditSpecialReactionIntegration(actualApplications(), [{ actorId: "hydro", characterKey: "barbara" }, { actorId: "electro", characterKey: "lisa" }]);
    expect(audit.status).toBe("no-enabled-conversion");
    expect(audit.damageIntents).toEqual([]);
  });
  it("cannot promote a hand-authored reaction label into an automatic state event", () => {
    const result = simulate(makeConfig({ rotation: [{ id: "manual", actorId: "a", name: "Manual", at: 0, hits: [{ offset: 0, scaling: 1, reaction: "reverseVaporize" }] }] }));
    const audit = auditSpecialReactionIntegration(result, [{ actorId: "a", characterKey: "flins" }]);
    expect(audit.status).toBe("blocked");
    expect(audit.processedApplicationEventIds).toEqual([]);
    expect(audit.blockers[0]?.field).toBe("automaticAuraEngine");
  });
});
