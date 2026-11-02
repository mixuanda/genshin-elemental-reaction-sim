import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import type { CalculatorDocument } from "../calculator-model";
import manifest from "../../../game-data/sources/batch-complete-projectile-skills/manifest.json";

const action = "neuvillette-skill-complete-cast-c0-arkhe-ready";
const bodyId = `${action}-param1`, thornId = `${action}-param2`;
const fixture = (): CalculatorDocument => {
  const doc = getCharacterDocuments("character:10000087", 1).find(row => row.gameContext?.skillId === action)!;
  doc.scope = "one-cast"; doc.selectedHitIds = [bodyId, thornId]; doc.characterLevel = 90;
  doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 30000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit conditional E1 body and Arkhe contact; no automatic Aura simulation" };
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext!.batchProjectileCast = { statsStableAcrossHits: true, hitStates: {
    [bodyId]: { actualHpRatio: .5, includedHydroBonus: 0 },
    [thornId]: { actualHpRatio: .8, includedHydroBonus: 0 },
  } };
  return doc;
};
const ordinary = (doc: CalculatorDocument, id: string) => {
  const hit = doc.hits.find(row => row.id === id);
  if (!hit || hit.kind !== "ordinary") throw new Error(`Missing ordinary source role ${id}`);
  return hit;
};
const guardReason = "The source-defined Spiritbreath Thorn has zero elemental application";
const reject = (doc: CalculatorDocument) => {
  const result = calculateDocument(doc);
  expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
  expect(result.blockers.some(reason => reason.includes(`${thornId}`) && reason.includes(guardReason))).toBe(true);
};

describe("Neuvillette exact zero-application Arkhe reaction guard", () => {
  it("verifies pinned body/thorn durability and the source reaction-dispatch condition independently", () => {
    const bytes = readFileSync(manifest.localArchivePath);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(manifest.localArchiveSha256);
    const archive = JSON.parse(gunzipSync(bytes).toString()) as { revision: string; files: Record<string,string> };
    expect(archive.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
    const hashes = manifest.sourceSha256 as Record<string,string>;
    for (const path of ["internal/characters/neuvillette/skill.go", "pkg/enemy/attack.go"]) expect(createHash("sha256").update(archive.files[path]!).digest("hex")).toBe(hashes[path]);
    const source = archive.files["internal/characters/neuvillette/skill.go"]!;
    expect(source.match(/ai := info\.AttackInfo\{([\s\S]*?)\n\t\}/)?.[1]).toMatch(/Durability:\s*25,/);
    expect(source.match(/aiThorn := info\.AttackInfo\{([\s\S]*?)\n\t\}/)?.[1]).toMatch(/Element:\s*attributes\.Hydro,[\s\S]*?Durability:\s*0,/);
    expect(archive.files["pkg/enemy/attack.go"]).toMatch(/if atk\.Info\.Durability > 0 && atk\.Info\.Element != attributes\.Physical \{[\s\S]*?e\.React\(atk\)/);
  });
  it("keeps nonreacting body and thorn numerically available with distinct HP and ATK scaling", () => {
    const result = calculateDocument(fixture()); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.hits).toHaveLength(2);
    expect(result.hits[0]!.nonCritical).toBeCloseTo(30000 * .12864 * 1.12 * .5 * .9, 8);
    expect(result.hits[1]!.nonCritical).toBeCloseTo(2000 * .208 * 1.3 * .5 * .9, 8);
  });
  it("allows independently qualified ordinary body Vaporize without multiplying the nonreacting thorn", () => {
    const doc = fixture(); ordinary(doc, bodyId).reaction = "vaporize";
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    const body = 30000 * .12864 * 1.12 * 2 * .5 * .9, thorn = 2000 * .208 * 1.3 * .5 * .9;
    expect(result.hits[0]!.nonCritical).toBeCloseTo(body, 8); expect(result.hits[1]!.nonCritical).toBeCloseTo(thorn, 8);
    expect(result.totals?.expected).toBeCloseTo((body + thorn) * 1.5, 8);
  });
  it.each(["vaporize", "reverseVaporize", "melt", "reverseMelt"] as const)("rejects thorn %s through direct and actual JSON ingress", reaction => {
    const doc = fixture(); ordinary(doc, thornId).reaction = reaction;
    reject(doc); reject(parseCalculatorDocument(serializeCalculatorDocument(doc)));
  });
  it.each(["aggravate", "spread"] as const)("rejects thorn additive %s even with reaction none", additiveReaction => {
    const doc = fixture(); ordinary(doc, thornId).additiveReaction = additiveReaction;
    reject(doc); reject(parseCalculatorDocument(serializeCalculatorDocument(doc)));
  });
  it("applies to a selected actual thorn while leaving an unselected impossible thorn out of body calculation", () => {
    const thorn = fixture(); thorn.scope = "single-hit"; thorn.selectedHitIds = [thornId]; ordinary(thorn, thornId).reaction = "vaporize"; reject(thorn);
    const body = fixture(); body.scope = "single-hit"; body.selectedHitIds = [bodyId]; ordinary(body, thornId).reaction = "vaporize";
    const result = calculateDocument(body); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.totals?.expected).toBeCloseTo(30000 * .12864 * 1.12 * .5 * .9 * 1.5, 8);
  });
});
