import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import { sourceClassifiedMappings } from "../classified-hits";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { conditionalSkillMappings, conditionalSkillSourceEvidence } from "./sourced-conditional-skill-mappings";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function numericTable(source: string, table: string, indices: number[]): number[] {
  const code = source.replace(/\/\/[^\n]*/g, "");
  const match = new RegExp(`\\b${table}\\s*=\\s*(?:\\[\\])+float64\\s*\\{`).exec(code);
  if (!match) throw new Error(`Missing source table ${table}`);
  const start = match.index + match[0].length - 1;
  let end = start;
  let depth = 0;
  for (; end < code.length; end++) {
    if (code[end] === "{") depth++;
    if (code[end] === "}" && --depth === 0) break;
  }
  let value = JSON.parse(code.slice(start, end + 1).replaceAll("{", "[").replaceAll("}", "]").replace(/,\s*]/g, "]"));
  for (const index of indices) value = value[index];
  return value;
}

it("pins all conditional E/Q vectors and executes complete per-input damage without dropping counters or terminal hits", () => {
  const evidence = conditionalSkillSourceEvidence;
  const compressed = readFileSync(evidence.localArchivePath);
  expect(sha256(compressed)).toBe(evidence.localArchiveSha256);
  const archive = JSON.parse(gunzipSync(compressed).toString("utf8")) as { revision: string; files: Record<string, string> };
  expect(archive.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
  for (const [path, hash] of Object.entries(evidence.sourceSha256)) expect(sha256(archive.files[path]!), path).toBe(hash);
  expect(conditionalSkillMappings).toHaveLength(17);
  const skills = [...new Set(conditionalSkillMappings.map((mapping) => mapping.skillId))];
  expect(skills).toHaveLength(14);
  expect(conditionalSkillMappings.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0)).toBe(25);
  for (const mapping of conditionalSkillMappings) {
    const reference = evidence.references.find((row) => row.id === mapping.id)!;
    const code = archive.files[mapping.sourcePaths.find((path) => path.endsWith(".dm.go"))!]!;
    const values = numericTable(code, reference.sourceTable, reference.sourceIndex);
    const parameters = findTalentSetById(mapping.talentSetId)!.abilities.find((ability) => ability.key === mapping.abilityKey)!.parameters;
    expect(mapping.sourceCoefficientValues, mapping.id).toEqual(values);
    expect(values).toHaveLength(15);
    expect(parameters[mapping.parameterKey], `${mapping.id}: active source drift`).toEqual(values);
    for (const [index, term] of (mapping.additionalTerms ?? []).entries()) {
      const ref = reference.additionalTerms[index]!;
      const extra = numericTable(code, ref.sourceTable, ref.sourceIndex);
      expect(term.sourceCoefficientValues).toEqual(extra);
      expect(parameters[term.parameterKey]).toEqual(extra);
    }
    expect(sourceClassifiedMappings.filter((row) => row.id === mapping.id), `${mapping.id}: exactly one registered hit`).toHaveLength(1);
    for (const path of mapping.sourcePaths) expect(archive.files[path], path).toBeDefined();
  }
  for (const skill of skills) {
    const mappings = conditionalSkillMappings.filter((mapping) => mapping.skillId === skill);
    const character = gameDataCatalog.characters.find((row) => row.slug === mappings[0]!.characterSlug)!;
    const doc = getCharacterDocuments(character.id, 1).find((row) => row.gameContext?.skillId === skill)!;
    expect(doc, `${skill}: public standalone action`).toBeDefined();
    expect(doc.gameContext?.scopeCoverage).toBe("complete-cast");
    expect(doc.hits).toHaveLength(mappings.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0));
    const coefficientSum = mappings.reduce((sum, mapping) => sum + (mapping.sourceCoefficientValues![0]! + (mapping.additionalTerms ?? []).reduce((extra, term) => extra + term.sourceCoefficientValues[0]!, 0)) * (mapping.instanceCount ?? 1), 0);
    // Independent hand evaluation: ATK 2000, equal Lv90 DEF 1/2, 10% RES -> 0.9.
    expect(calculateDocument(doc).totals!.nonCritical, skill).toBeCloseTo(coefficientSum * 2000 * 0.5 * 0.9, 9);
  }
  const beidou = conditionalSkillMappings.find((mapping) => mapping.skillId === "beidou-skill-counter-2-c0")!;
  expect(beidou.additionalTerms).toHaveLength(2);
  expect(archive.files["internal/characters/beidou/skill.go"]).toMatch(/skillbase\[c.TalentLvlSkill\(\)\] \+ skillbonus\[c.TalentLvlSkill\(\)\]\*float64\(counter\)/);
  expect(archive.files["internal/characters/lisa/skill.go"]).toMatch(/atk.Info.Mult = skillHold\[stacks\]\[c.TalentLvlSkill\(\)\]/);
  expect(archive.files["internal/characters/lisa/skill.go"]).toContain("t.SetTag(conductiveTag, 0)");
  expect(archive.files["internal/characters/bennett/skill.go"]).toMatch(/if level == 2 {[\s\S]*?ai.Mult = explosion\[c.TalentLvlSkill\(\)\]/);
  expect(archive.files["internal/characters/xiangling/guoba.go"]).toContain("snap: c.Snapshot(&ai)");
  expect(archive.files["internal/characters/xiangling/guoba.go"]).toContain("case 103, 203, 303, 403:");
  expect(archive.files["internal/characters/xiangling/guoba.go"]).toContain("p.snap,");
  expect(archive.files["internal/characters/ningguang/burst.go"]).toMatch(/jade = 6/);
  expect(archive.files["internal/characters/ningguang/burst.go"]).toContain("c.skillSnapshot");
  expect(conditionalSkillMappings.some((mapping) => mapping.characterSlug === "keqing" || mapping.characterSlug === "xingqiu")).toBe(false);
});
