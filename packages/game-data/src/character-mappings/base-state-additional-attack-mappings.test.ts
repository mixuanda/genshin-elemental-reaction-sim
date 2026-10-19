import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { additionalBaseStateAttackMappings, additionalBaseStateAttackSourceEvidence } from "./base-state-additional-attack-mappings";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function numericTable(source: string, table: string): unknown {
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
  return JSON.parse(code.slice(start, end + 1).replaceAll("{", "[").replaceAll("}", "]").replace(/,\s*]/g, "]"));
}

it("checks the additional pinned base branches and executes Zhongli A4 per real hit with explicit ascension", () => {
  const evidence = additionalBaseStateAttackSourceEvidence;
  const compressed = readFileSync(evidence.localArchivePath);
  expect(sha256(compressed)).toBe(evidence.localArchiveSha256);
  const archive = JSON.parse(gunzipSync(compressed).toString("utf8")) as { revision: string; files: Record<string, string> };
  expect(archive.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
  for (const [path, hash] of Object.entries(evidence.sourceSha256)) expect(sha256(archive.files[path]!), path).toBe(hash);
  expect(additionalBaseStateAttackMappings).toHaveLength(49);
  expect(new Set(additionalBaseStateAttackMappings.map((mapping) => mapping.skillId)).size).toBe(46);
  expect(additionalBaseStateAttackMappings.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0)).toBe(58);
  for (const mapping of additionalBaseStateAttackMappings) {
    const reference = evidence.references.find((row) => row.id === mapping.id)!;
    const sourcePath = mapping.sourcePaths.find((path) => path.endsWith(".dm.go"))!;
    let sourceValue = numericTable(archive.files[sourcePath]!, reference.sourceTable);
    for (const index of reference.sourceIndex) sourceValue = (sourceValue as unknown[])[index];
    expect(mapping.sourceCoefficientValues, mapping.id).toEqual(sourceValue);
    expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
    expect(findTalentSetById(mapping.talentSetId)?.abilities.find((ability) => ability.key === "combat1")?.parameters[mapping.parameterKey], `${mapping.id}: active source drift`).toEqual(sourceValue);
    expect(mapping.coefficientTolerance).toBe(0);
    expect(mapping.assumptions.join(" ")).toContain("C0");
    for (const path of mapping.sourcePaths) expect(archive.files[path], `${mapping.id}: ${path}`).toBeDefined();
  }
  expect(additionalBaseStateAttackMappings.filter((mapping) => mapping.characterSlug === "alhaitham").every((mapping) => mapping.attackTag === "normal")).toBe(true);
  expect(additionalBaseStateAttackMappings.filter((mapping) => mapping.characterSlug === "yanfei").every((mapping) => mapping.attackTag === "normal")).toBe(true);
  expect(additionalBaseStateAttackMappings.find((mapping) => mapping.skillId === "kamisatoayaka-charged-base-c0")?.instanceCount).toBe(3);
  const zhongliMappings = additionalBaseStateAttackMappings.filter((mapping) => mapping.characterSlug === "zhongli");
  for (const mapping of zhongliMappings) expect(mapping.fixedTerms).toEqual([{ scalingStat: "hp", coefficient: 0.0139, sourceField: "internal/characters/zhongli/asc.go:a4Attacks", minimumAscension: 4 }]);
  const a4Source = archive.files["internal/characters/zhongli/asc.go"]!;
  expect(a4Source).toMatch(/a4Attacks\(\) float64\s*{\s*if c.Base.Ascension < 4 {\s*return 0\s*}\s*return 0\.0139 \* c.MaxHP\(\)/);
  const zhongli = gameDataCatalog.characters.find((character) => character.slug === "zhongli")!;
  const doc = getCharacterDocuments(zhongli.id, 1).find((document) => document.gameContext?.skillId === "zhongli-normal-5-base-c0")!;
  expect(doc, "new mappings must reach the standalone calculator").toBeDefined();
  expect(doc.hits).toHaveLength(4);
  expect(doc.gameContext?.scopeCoverage).toBe("complete-cast");
  if (doc.build.mode !== "manual-final") throw new Error("Expected editable final panel");
  doc.build.stats.atk = 2000; doc.build.stats.hp = 20000;
  doc.gameContext!.ascension = 4;
  expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(4 * (0.1075 * 2000 + 0.0139 * 20000) * 0.5 * 0.9, 9);
  doc.gameContext!.ascension = 3;
  expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(4 * 0.1075 * 2000 * 0.5 * 0.9, 9);
  delete doc.gameContext!.ascension;
  expect(calculateDocument(doc).status).toBe("blocked");
});
