import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import type { CalculatorDocument } from "../calculator-model";
import manifest from "../../../game-data/sources/batch-complete-projectile-skills/manifest.json";

const cases = [
  ["character:10000085", "freminet-skill-initial-complete-cast-c0-arkhe-ready", "param1", .8304, "param2", .144, "reverseMelt"],
  ["character:10000090", "chevreuse-skill-press-complete-cast-c0-arkhe-ready", "param1", 1.152, "param7", .288, "reverseVaporize"],
  ["character:10000090", "chevreuse-skill-hold-complete-cast-c0-arkhe-ready", "param2", 1.728, "param7", .288, "reverseVaporize"],
  ["character:10000090", "chevreuse-skill-overcharged-complete-cast-c0-arkhe-ready", "param3", 2.824, "param7", .288, "reverseVaporize"],
] as const;
type Case = typeof cases[number];
function fixture(spec: Case): CalculatorDocument {
  const [characterId, action, bodyParam, , arkheParam] = spec;
  const doc = getCharacterDocuments(characterId, 1).find(row => row.gameContext?.skillId === action);
  if (!doc) throw new Error(`Missing existing public action ${action}`);
  doc.scope = "one-cast"; doc.selectedHitIds = [`${action}-${bodyParam}`, `${action}-${arkheParam}`]; doc.characterLevel = 90;
  doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 0;
  doc.build = { mode: "manual-final", ascension: 0, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit source-defined E1 main and zero-application Arkhe contacts; ASC0 isolates reaction eligibility from passives" };
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext!.batchProjectileCast = { statsStableAcrossHits: true, sharedState: { includedA4AtkPercent: 0, includedA1Shred: 0 } };
  return doc;
}
function ordinary(doc: CalculatorDocument, id: string) {
  const hit = doc.hits.find(row => row.id === id);
  if (!hit || hit.kind !== "ordinary") throw new Error(`Missing ordinary role ${id}`);
  return hit;
}
function reject(doc: CalculatorDocument, id: string) {
  const result = calculateDocument(doc);
  expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
  expect(result.blockers.some(reason => reason.includes(id) && reason.includes("zero elemental application"))).toBe(true);
}

describe("Existing Freminet and Chevreuse exact zero-application Arkhe paths", () => {
  it("pins both source files and distinguishes their elemental damage from nonzero application", () => {
    const bytes = readFileSync(manifest.localArchivePath);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(manifest.localArchiveSha256);
    const archive = JSON.parse(gunzipSync(bytes).toString()) as { revision: string; files: Record<string,string> };
    expect(archive.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
    const hashes = manifest.sourceSha256 as Record<string,string>;
    for (const slug of ["freminet", "chevreuse"]) {
      const path = `internal/characters/${slug}/skill.go`, source = archive.files[path]!;
      expect(createHash("sha256").update(source).digest("hex")).toBe(hashes[path]);
      expect(source).toMatch(/Durability:\s*25,/);
      expect(source).toMatch(slug === "freminet" ? /aiSpiritbreath := info\.AttackInfo\{[\s\S]*?Element:\s*attributes\.Cryo,[\s\S]*?Durability:\s*0,/ : /aiArkhe := info\.AttackInfo\{[\s\S]*?Element:\s*attributes\.Pyro,[\s\S]*?Durability:\s*0,/);
    }
  });
  for (const spec of cases) {
    const [, action, bodyParam, bodyCoefficient, arkheParam, arkheCoefficient, reaction] = spec;
    const bodyId = `${action}-${bodyParam}`, arkheId = `${action}-${arkheParam}`;
    it(`${action}: nonreacting controls retain both independent E1 coefficients`, () => {
      const result = calculateDocument(fixture(spec)); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(2);
      expect(result.hits[0]!.nonCritical).toBeCloseTo(2000 * bodyCoefficient * .5 * .9, 8);
      expect(result.hits[1]!.nonCritical).toBeCloseTo(2000 * arkheCoefficient * .5 * .9, 8);
    });
    it(`${action}: qualified ordinary body ${reaction} remains available`, () => {
      const doc = fixture(spec); ordinary(doc, bodyId).reaction = reaction;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
      expect(result.hits[0]!.nonCritical).toBeCloseTo(2000 * bodyCoefficient * 1.5 * .5 * .9, 8);
      expect(result.hits[1]!.nonCritical).toBeCloseTo(2000 * arkheCoefficient * .5 * .9, 8);
    });
    it(`${action}: zero-application Arkhe cannot amplify in public calculation`, () => {
      const doc = fixture(spec); ordinary(doc, arkheId).reaction = reaction; reject(doc, arkheId);
    });
    it(`${action}: JSON reopening cannot introduce an impossible Arkhe reaction`, () => {
      const doc = fixture(spec); ordinary(doc, arkheId).reaction = reaction;
      reject(parseCalculatorDocument(serializeCalculatorDocument(doc)), arkheId);
    });
  }
  it.each(cases)("%s %s isolates a selected Arkhe guard from an unselected invalid role", (...spec) => {
    const doc = fixture(spec as Case), bodyId = `${spec[1]}-${spec[2]}`, arkheId = `${spec[1]}-${spec[4]}`;
    doc.scope = "single-hit"; doc.selectedHitIds = [arkheId]; ordinary(doc, arkheId).reaction = spec[6]; reject(doc, arkheId);
    doc.selectedHitIds = [bodyId];
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.totals?.expected).toBeCloseTo(2000 * spec[3] * .5 * .9 * 1.5, 8);
  });
  it("does not invent character-passive state or ascension requirements for Freminet", () => {
    const doc = fixture(cases[0]); delete doc.gameContext!.ascension;
    if (doc.build.mode === "manual-final") delete doc.build.ascension;
    doc.gameContext!.batchProjectileCast = { statsStableAcrossHits: true };
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.totals?.expected).toBeCloseTo(2000 * (.8304 + .144) * .5 * .9 * 1.5, 8);
  });
  it("rejects additive reaction assignments on each exact Arkhe role", () => {
    for (const spec of cases) for (const additive of ["aggravate", "spread"] as const) {
      const doc = fixture(spec), id = `${spec[1]}-${spec[4]}`; ordinary(doc, id).additiveReaction = additive; reject(doc, id);
    }
  });
});
