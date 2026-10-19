import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import { sourceClassifiedMappings } from "../classified-hits";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { baseStateAttackMappings } from "./base-state-attack-mappings";
import { additionalBaseStateAttackMappings } from "./base-state-additional-attack-mappings";
import { conditionedBasicActionMappings, conditionedBasicActionSourceEvidence } from "./conditioned-basic-action-mappings";

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

it("pins the remaining conditional inputs, retains Furina's ready Arkhe hit, and exposes every complete input to the calculator", () => {
  const evidence = conditionedBasicActionSourceEvidence;
  const compressed = readFileSync(evidence.localArchivePath);
  expect(sha256(compressed)).toBe(evidence.localArchiveSha256);
  const archive = JSON.parse(gunzipSync(compressed).toString("utf8")) as { revision: string; files: Record<string, string> };
  expect(archive.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
  for (const [path, hash] of Object.entries(evidence.sourceSha256)) expect(sha256(archive.files[path]!), path).toBe(hash);
  expect(conditionedBasicActionMappings).toHaveLength(30);
  const skillIds = [...new Set(conditionedBasicActionMappings.map((mapping) => mapping.skillId))];
  expect(skillIds).toHaveLength(25);
  const priorSkills = new Set([...baseStateAttackMappings, ...additionalBaseStateAttackMappings].map((mapping) => mapping.skillId));
  for (const mapping of conditionedBasicActionMappings) {
    const reference = evidence.references.find((row) => row.id === mapping.id)!;
    const sourcePath = mapping.sourcePaths.find((path) => path.endsWith(".dm.go"))!;
    let sourceValue = numericTable(archive.files[sourcePath]!, reference.sourceTable);
    for (const index of reference.sourceIndex) sourceValue = (sourceValue as unknown[])[index];
    expect(mapping.sourceCoefficientValues, mapping.id).toEqual(sourceValue);
    expect(mapping.sourceCoefficientValues).toHaveLength(15);
    expect(findTalentSetById(mapping.talentSetId)?.abilities.find((ability) => ability.key === "combat1")?.parameters[mapping.parameterKey], `${mapping.id}: active source drift`).toEqual(sourceValue);
    expect(priorSkills.has(mapping.skillId), `${mapping.id}: old action duplicated`).toBe(false);
    expect(sourceClassifiedMappings.some((entry) => entry.id === mapping.id), `${mapping.id}: registry`).toBe(true);
    expect(mapping.coefficientTolerance).toBe(0);
    expect(mapping.assumptions.join(" ")).toContain("C0");
    for (const path of mapping.sourcePaths) expect(archive.files[path], path).toBeDefined();
    if (mapping.attackTag === "plunge") {
      expect(mapping.assumptions.join(" ")).toContain("collision=0");
      expect(mapping.assumptions.join(" ")).toContain("外部下落追加基础伤害及协同事件未生效");
    }
  }
  for (const skillId of skillIds) {
    const entries = conditionedBasicActionMappings.filter((mapping) => mapping.skillId === skillId);
    const character = gameDataCatalog.characters.find((row) => row.slug === entries[0]!.characterSlug)!;
    const doc = getCharacterDocuments(character.id, 1).find((row) => row.gameContext?.skillId === skillId)!;
    expect(doc, skillId).toBeDefined();
    expect(doc.gameContext?.scopeCoverage).toBe("complete-cast");
    expect(doc.hits).toHaveLength(entries.length);
  }
  const gaming = conditionedBasicActionMappings.filter((mapping) => mapping.characterSlug === "gaming");
  expect(gaming.every((mapping) => mapping.element === "physical" && mapping.assumptions.join(" ").includes("LastAction != Skill"))).toBe(true);
  const alhaitham = conditionedBasicActionMappings.filter((mapping) => mapping.characterSlug === "alhaitham");
  expect(alhaitham.every((mapping) => mapping.assumptions.join(" ").includes("Core.Status.Duration > 0"))).toBe(true);
  expect(archive.files["internal/characters/alhaitham/asc.go"]).toMatch(/if c.Core.Status.Duration\(a1IcdKey\) > 0 {\s*return/);
  expect(archive.files["internal/characters/alhaitham/skill.go"]).toMatch(/if c.mirrorCount == 0 {\s*return/);
  expect(archive.files["internal/characters/furina/attack.go"]).toMatch(/if c.StatusIsActive\(arkheIcdKeys\[c.arkhe\]\) {\s*return/);
  expect(archive.files["internal/characters/furina/attack.go"]).toMatch(/Mult:\s+arkhe\[c.TalentLvlAttack\(\)\]/);
  const furina = gameDataCatalog.characters.find((row) => row.slug === "furina")!;
  const ready = getCharacterDocuments(furina.id, 1).find((row) => row.gameContext?.skillId === "furina-normal-1-arkhe-ready-conditioned-c0")!;
  const cooldown = getCharacterDocuments(furina.id, 1).find((row) => row.gameContext?.skillId === "furina-normal-1-arkhe-cooldown-conditioned-c0")!;
  expect(ready.hits.map((hit) => hit.kind === "ordinary" ? hit.element : "blocked")).toEqual(["physical", "hydro"]);
  expect(ready.hits.every((hit) => hit.kind === "ordinary" && hit.reaction === "none")).toBe(true);
  const parameters = findTalentSetById("talent-set:furina")!.abilities.find((ability) => ability.key === "combat1")!.parameters;
  expect(calculateDocument(ready).totals!.nonCritical).toBeCloseTo((parameters.param1![0]! + parameters.param10![0]!) * 2000 * 0.5 * 0.9, 9);
  expect(calculateDocument(cooldown).totals!.nonCritical).toBeCloseTo(parameters.param1![0]! * 2000 * 0.5 * 0.9, 9);
});
