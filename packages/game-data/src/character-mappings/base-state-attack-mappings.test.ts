import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { findTalentSetById } from "../catalog";
import { baseStateAttackMappings, baseStateAttackSourceEvidence } from "./base-state-attack-mappings";

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

it("cross-checks the archived C0 base branches, exact talent vectors and real multi-hit decomposition", () => {
  const evidence = baseStateAttackSourceEvidence;
  const compressed = readFileSync(evidence.localArchivePath);
  expect(sha256(compressed)).toBe(evidence.localArchiveSha256);
  const archive = JSON.parse(gunzipSync(compressed).toString("utf8")) as { revision: string; files: Record<string, string> };
  expect(archive.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
  for (const [path, hash] of Object.entries(evidence.sourceSha256)) expect(sha256(archive.files[path]!), path).toBe(hash);
  expect(baseStateAttackMappings).toHaveLength(32);
  expect(new Set(baseStateAttackMappings.map((mapping) => mapping.skillId)).size).toBe(31);
  expect(baseStateAttackMappings.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0)).toBe(33);
  for (const mapping of baseStateAttackMappings) {
    const reference = evidence.references.find((row) => row.id === mapping.id)!;
    const sourcePath = mapping.sourcePaths.find((path) => path.endsWith(".dm.go"))!;
    let sourceValue = numericTable(archive.files[sourcePath]!, reference.sourceTable);
    for (const index of reference.sourceIndex) sourceValue = (sourceValue as unknown[])[index];
    expect(mapping.sourceCoefficientValues, mapping.id).toEqual(sourceValue);
    expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
    expect(findTalentSetById(mapping.talentSetId)?.abilities.find((ability) => ability.key === "combat1")?.parameters[mapping.parameterKey], `${mapping.id}: active source drift`).toEqual(sourceValue);
    expect(mapping).toMatchObject({ abilityKey: "combat1", element: "physical", scalingStat: "atk", coefficientTolerance: 0, completeAction: true });
    expect(mapping.assumptions.join(" ")).toContain("C0");
    for (const path of mapping.sourcePaths) expect(archive.files[path], `${mapping.id}: ${path}`).toBeDefined();
    if (mapping.attackTag === "plunge") expect(mapping.assumptions.join(" ")).toContain("collision=0");
  }
  const thomaN3 = baseStateAttackMappings.filter((mapping) => mapping.skillId === "thoma-normal-3-physical-c0");
  expect(thomaN3).toMatchObject([{ parameterKey: "param3", instanceCount: 2 }]);
  const raidenN4 = baseStateAttackMappings.filter((mapping) => mapping.skillId === "raidenshogun-normal-4-physical-c0");
  expect(raidenN4.map((mapping) => mapping.parameterKey)).toEqual(["param4", "param5"]);
  expect(raidenN4[0]!.sourceCoefficientValues).toEqual(raidenN4[1]!.sourceCoefficientValues);
  // The two equal vectors retain separate ordered source entries; no value-only
  // parameter matching silently collapses Raiden's N4 into a single hit.
  expect(evidence.references.filter((row) => row.id.startsWith("raidenshogun-normal-4")).map((row) => row.sourceIndex)).toEqual([[3, 0], [3, 1]]);
  expect(baseStateAttackMappings.filter((mapping) => mapping.characterSlug === "raidenshogun").every((mapping) => mapping.assumptions.join().includes("Eoff") && mapping.assumptions.join().includes("Qoff"))).toBe(true);
});
