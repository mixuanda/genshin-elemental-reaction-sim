#!/usr/bin/env node
// Read a pinned, already-downloaded tree as data; never execute upstream scripts.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const option = (key) => { const i = args.indexOf(`--${key}`); if (i < 0 || !args[i + 1]) throw new Error(`Required --${key}`); return args[i + 1]; };
const tree = resolve(option("tree"));
const output = resolve(option("output"));
const commit = option("commit");
const version = option("game-version");
const releaseStatus = option("release-status");
if (!["released", "official-next", "preview", "unknown"].includes(releaseStatus)) throw new Error("Invalid release status.");
const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: tree, encoding: "utf8" });
if (revision.status !== 0 || revision.stdout.trim() !== commit) throw new Error("Working tree is not at the requested commit.");
const records = [];
function read(path) {
  const bytes = readFileSync(resolve(tree, path));
  records.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  return JSON.parse(bytes);
}
function pick(item, keys) { return Object.fromEntries(keys.filter((key) => item[key] !== undefined).map((key) => [key, item[key]])); }
const data = { ChineseSimplified: {} };
for (const category of ["characters", "talents", "weapons", "artifacts", "constellations"]) {
  const folder = `src/data/ChineseSimplified/${category}`;
  data.ChineseSimplified[category] = Object.fromEntries(readdirSync(resolve(tree, folder)).filter((name) => name.endsWith(".json")).sort().map((name) => {
    const raw = read(`${folder}/${name}`);
    let selected;
    if (category === "characters") selected = pick(raw, ["id", "name", "elementType", "weaponType", "rarity"]);
    if (category === "weapons") selected = pick(raw, ["id", "name", "weaponType", "rarity", "baseAtkValue", "mainStatType", "baseStatText", "effectName", "r1", "r2", "r3", "r4", "r5"]);
    if (category === "talents") selected = pick(raw, ["id", "name", ...Object.keys(raw).filter((key) => key.startsWith("combat") || key.startsWith("passive"))]);
    if (category === "constellations") selected = { ...pick(raw, ["id", "name"]), ...Object.fromEntries([1, 2, 3, 4, 5, 6].filter((n) => raw[`c${n}`]).map((n) => [`c${n}`, pick(raw[`c${n}`], ["name", "description"])])) };
    if (category === "artifacts") selected = { ...pick(raw, ["id", "name", "rarityList", "effect1Pc", "effect2Pc", "effect4Pc"]), ...Object.fromEntries(["flower", "plume", "sands", "goblet", "circlet"].filter((slot) => raw[slot]).map((slot) => [slot, pick(raw[slot], ["name", "relicType"])])) };
    return [name.slice(0, -5), selected];
  }));
}
const combined = { data, stats: {}, curve: {}, version: {} };
for (const category of ["characters", "talents", "weapons"]) combined.stats[category] = read(`src/data/stats/${category}.json`);
for (const category of ["characters", "weapons"]) combined.curve[category] = read(`src/data/curve/${category}.json`);
for (const category of ["characters", "talents", "weapons", "artifacts", "constellations"]) combined.version[category] = read(`src/data/version/${category}.json`);
const packageJson = read("package.json");
mkdirSync(resolve(output, "src/min"), { recursive: true });
mkdirSync(resolve(output, "generated"), { recursive: true });
const bytes = JSON.stringify(combined);
writeFileSync(resolve(output, "src/min/data.min.json"), bytes);
writeFileSync(resolve(output, "package.json"), JSON.stringify({ name: packageJson.name, version: packageJson.version }));
const manifest = { schemaVersion: "1.0.0", catalogVersion: `gi-${version}-${releaseStatus}.genshin-db-${commit.slice(0, 12)}.1`, gameVersion: version, sourceVersion: packageJson.version, sourceCommit: commit, retrievedAt: new Date().toISOString(), releaseStatus, sourceSha256: createHash("sha256").update(bytes).digest("hex"), notes: "Projected combat data from a pinned Git tree. Source files hashed individually; no upstream code executed. This content hash identifies the imported projection, not a nonexistent upstream bundled file. Community values remain provisional." };
writeFileSync(resolve(output, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(resolve(output, "source-files.json"), `${JSON.stringify({ commit, generatedAt: manifest.retrievedAt, records }, null, 2)}\n`);
console.log(JSON.stringify({ output, manifest, sourceFiles: records.length, counts: Object.fromEntries(Object.entries(data.ChineseSimplified).map(([key, items]) => [key, Object.keys(items).length])) }, null, 2));
