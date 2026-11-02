import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareSourceCastDocument } from "./source-cast-context";

function complete(height: "low" | "high"): CalculatorDocument {
  const document = getCharacterDocuments("character:10000100", 10)
    .find(candidate => candidate.gameContext?.skillId === `kachina-plunge-${height}-with-collision`)!;
  document.build = { mode: "manual-final", source: "Synthetic ordinary physical plunge; not a measured UID panel",
    stats: { atk: 1000, hp: 10000, def: 700, em: 0, critRate: 0, critDamage: 0.5 } };
  document.characterLevel = 90;
  document.enemy = { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 };
  document.gameContext!.observedPlunge = { noExternalInfusion: true, collisionCount: 1,
    collisionContacts: { "1": true }, landingContact: true, statsStableAcrossHits: true };
  return prepareSourceCastDocument(document);
}

function selectOne(document: CalculatorDocument, role: "collision-1" | "landing"): CalculatorDocument {
  const result = structuredClone(document);
  result.scope = "single-hit";
  result.selectedHitIds = [result.hits.find(hit => hit.id.endsWith(`:${role}`))!.id];
  // This already-occurred hit does not require an entire future trajectory.
  result.gameContext!.observedPlunge = { noExternalInfusion: true };
  return prepareSourceCastDocument(result);
}

describe("observed Kachina physical plunge single-hit scope", () => {
  it.each([
    { height: "low" as const, role: "collision-1" as const, coefficient: 1.26378 },
    { height: "low" as const, role: "landing" as const, coefficient: 2.527025 },
    { height: "high" as const, role: "collision-1" as const, coefficient: 1.26378 },
    { height: "high" as const, role: "landing" as const, coefficient: 3.15639 },
  ])("drops obsolete whole-cast dependencies for $height $role and survives save/reopen", ({ height, role, coefficient }) => {
    const full = complete(height), original = JSON.stringify(full);
    expect(calculateDocument(full).blockers).toEqual([]);
    const single = selectOne(full, role), id = single.selectedHitIds[0]!;
    const result = calculateDocument(single);
    expect(result.blockers).toEqual([]);
    expect(result.status).toBe("calculated");
    // Source NA10 ATK coefficients; 90/90 DEF .5, resistance .9, no critical chance.
    expect(result.totals!.nonCritical).toBeCloseTo(1000 * coefficient * 0.5 * 0.9, 10);
    expect(result.totals!.expected).toBeCloseTo(450 * coefficient, 10);
    expect(single.hits.find(hit => hit.id === id)!.dependencies.filter(dep => dep.startsWith("observed-plunge:")))
      .toEqual(["observed-plunge:physical"]);
    expect(single.dependencies.some(dep => dep.id === "observed-plunge:schedule")).toBe(false);
    expect(single.gameContext!.observedPlunge).toEqual({ noExternalInfusion: true });
    const reopened = parseCalculatorDocument(serializeCalculatorDocument(single));
    expect(reopened.selectedHitIds).toEqual([id]);
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
    expect(JSON.stringify(full)).toBe(original);
  });

  it("retains the selected hit's unknown or false physical condition", () => {
    const single = selectOne(complete("low"), "collision-1");
    for (const state of [undefined, false]) {
      single.gameContext!.observedPlunge = state === undefined ? {} : { noExternalInfusion: state };
      const result = calculateDocument(single);
      expect(result.status).toBe("blocked");
      expect(result.totals).toBeUndefined();
      expect(result.blockers.some(reason => reason.includes("外部附魔"))).toBe(true);
      expect(result.blockers.some(reason => reason.includes("schedule"))).toBe(false);
    }
  });

  it("does not clear unrelated missing evidence when removing the old schedule", () => {
    const full = complete("high"), selected = full.hits.find(hit => hit.id.endsWith(":collision-1"))!;
    selected.dependencies.push("unrelated-missing-proof");
    full.dependencies.push({ id: "unrelated-missing-proof", status: "missing", reason: "Independent missing proof", sourceRefs: [] });
    const single = selectOne(full, "collision-1"), result = calculateDocument(single);
    expect(result.status).toBe("blocked");
    expect(result.blockers.some(reason => reason.includes("Independent missing proof"))).toBe(true);
    expect(single.hits.find(hit => hit.id === single.selectedHitIds[0])!.dependencies).toContain("unrelated-missing-proof");
  });
});
