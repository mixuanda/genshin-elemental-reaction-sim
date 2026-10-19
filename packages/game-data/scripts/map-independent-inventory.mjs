#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const args = process.argv.slice(2);
const option = (key) => { const i = args.indexOf(`--${key}`); if (i < 0 || !args[i + 1]) throw new Error(`Required --${key}`); return args[i + 1]; };
const researchPath = resolve(option("research"));
const tree = resolve(option("localization-tree"));
const output = resolve(option("output"));
const research = JSON.parse(readFileSync(researchPath, "utf8"));
const inventory = research.independentInventory;
const normalize = (name) => name.normalize("NFKC").replace(/\s/g, "").replaceAll("·", "・");
const identityExpansion = { "主人公": [10000005, 10000007], "ドール": [10000117, 10000118] };
const categories = {};
const localizationFiles = [];
for (const [category, section, prefix] of [["characters", "characters", "character"], ["weapons", "weapons", "weapon"], ["artifacts", "artifacts", "artifact-set"]]) {
  const records = readdirSync(resolve(tree, "src/data/Japanese", category)).filter((name) => name.endsWith(".json")).map((name) => {
    const path = `src/data/Japanese/${category}/${name}`;
    const bytes = readFileSync(resolve(tree, path));
    localizationFiles.push({ path, contentSha256: createHash("sha256").update(bytes).digest("hex") });
    return JSON.parse(bytes);
  });
  const mapped = inventory[section].rows.map((row) => {
    const ids = category === "characters" && identityExpansion[row.name] ? identityExpansion[row.name] : records.filter((record) => normalize(record.name) === normalize(row.name)).map((record) => record.id);
    return { sourceName: row.name, sourceUrl: row.source, ids: ids.map((id) => `${prefix}:${id}`), mappingMethod: identityExpansion[row.name] ? "documented-gender-identity-expansion" : "exact-localized-name-after-NFKC", releaseEvidence: row.v ?? null };
  });
  const ids = [...new Set(mapped.flatMap((row) => row.ids))].sort();
  categories[category] = { independentRows: mapped.length, ids, mapped, unmappedSourceNames: mapped.filter((row) => row.ids.length === 0).map((row) => row.sourceName), importedOnlyIds: records.filter((record) => !ids.includes(`${prefix}:${record.id}`)).map((record) => ({ id: `${prefix}:${record.id}`, name: record.name })) };
}
const result = {
  schemaVersion: "1.0.0", researchRef: researchPath.split("/docs/")[1], researchSha256: createHash("sha256").update(readFileSync(researchPath)).digest("hex"),
  method: "Membership was independently enumerated from Wiki tables; genshin-db Japanese values are used only to map those independently observed names to stable IDs. Imported records do not set the expected denominator.",
  categories, localizationFiles,
  expectedInventory: {
    sourceId: "wiki-characters", sourceIds: ["wiki-characters", "wiki-artifact-sets", "wiki-weapon-index", "wiki-weapon-type-片手剣", "wiki-weapon-type-両手剣", "wiki-weapon-type-長柄武器", "wiki-weapon-type-法器", "wiki-weapon-type-弓"], independentOfImportedData: true,
    characterIds: categories.characters.ids, weaponIds: categories.weapons.ids, artifactSetIds: categories.artifacts.ids,
    completeness: { characters: categories.characters.unmappedSourceNames.length ? "partial" : "complete", weapons: "partial", artifactSets: categories.artifacts.unmappedSourceNames.length ? "partial" : "complete" },
    identityPolicy: "7.1 version-content named inventory; Traveler and Doll each split into two gender identities. Character completeness means the enumerated Wiki main table, not individually certified current obtainability. Weapon union remains partial pending temporary-variant reconciliation.",
    evidenceRef: "docs/research/independent-inventory-mapping-2026-09-23.json"
  }
};
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, { independentRows: value.independentRows, mappedIds: value.ids.length, unmappedSourceNames: value.unmappedSourceNames, importedOnlyIds: value.importedOnlyIds }])), null, 2));
