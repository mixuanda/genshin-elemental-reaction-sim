// Project existing repository data only. No network, third-party code or shared file writes.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const runtime = new URL("../../game-data/manifests/runtime/", import.meta.url);
const current = await readFile(new URL("current.ts", runtime), "utf8");
const selection = JSON.parse(current.match(/^\/\/ runtime-selection: (.+)$/m)[1]);
const revision = selection.activeCatalogSnapshotId;
const inputs = await Promise.all(["catalog.json", "catalog-index.json", "supplemental.json"].map(async name => {
  const text = await readFile(new URL(`datasets/${revision}/${name}`, runtime), "utf8");
  return { name, sha256: createHash("sha256").update(text).digest("hex"), data: JSON.parse(text) };
}));
const [catalog, index, supplemental] = inputs.map(i => i.data);
const output = JSON.stringify({
  revision, sourceFiles: inputs.map(({ name, sha256 }) => ({ name, sha256 })),
  characters: catalog.characters.map(({ id, avatarId, name, weaponType, rarity }) => ({ id, avatarId, name, weaponType, rarity })),
  weapons: catalog.weapons.map(({ id, itemId, name, weaponType, rarity }) => ({ id, itemId, name, weaponType, rarity })),
  mappings: index.enkaCharacterMappings,
  sets: supplemental.artifactSets.map(({ id, numericId, name, rarityList, slots }) => ({ id, numericId, name, rarityList, slots: slots.map(({ slot }) => ({ slot })) }))
}) + "\n";
const target = new URL("../src/catalog.generated.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== output) throw new Error("Import catalog projection is stale; run generate-catalog.mjs");
  console.log(`Import catalog projection matches ${revision}`);
} else { await writeFile(target, output); console.log(`Generated import catalog projection from ${revision}`); }
