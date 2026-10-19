#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const argument = (name) => { const index = process.argv.indexOf(`--${name}`); return index === -1 ? null : process.argv[index + 1]; };
const source = JSON.parse(readFileSync(argument("source-manifest") ?? `${root}packages/game-data/manifests/catalog-source.json`, "utf8"));
const bytes = readFileSync(`${argument("source-dir") ?? `${root}node_modules/genshin-db`}/src/min/data.min.json`);
if (createHash("sha256").update(bytes).digest("hex") !== source.sourceSha256) throw new Error("Pinned data hash mismatch.");
const raw = JSON.parse(bytes);
const zh = raw.data.ChineseSimplified;
const supplemental = {
  artifactSets: Object.entries(zh.artifacts).map(([slug, item]) => ({
    id: `artifact-set:${item.id}`,
    numericId: item.id,
    slug,
    name: item.name,
    releasePatch: raw.version.artifacts[slug] ?? "unknown",
    rarityList: item.rarityList,
    // Four prayer sets actually have only a one-piece effect and a circlet.
    pieceEffects: [1, 2, 4].flatMap((pieces) => item[`effect${pieces}Pc`] === undefined ? [] : [{ pieces, description: item[`effect${pieces}Pc`] }]),
    slots: ["flower", "plume", "sands", "goblet", "circlet"].flatMap((slot) => item[slot] ? [{ slot, name: item[slot].name, relicType: item[slot].relicType }] : []),
    sourceMapping: `data.ChineseSimplified.artifacts.${slug}`,
    processingStatus: "parsed",
    numericEvidenceStatus: "unchecked",
    mechanicEvidenceStatus: "missing",
    executableEffects: [],
    missingFields: ["可执行套装触发规则", "主词条精确等级表", "副词条档位与合法等级表"]
  })).sort((a, b) => a.numericId - b.numericId),
  constellationSets: Object.entries(zh.constellations).map(([slug, item]) => ({
    id: `constellation-set:${item.id}`,
    numericId: item.id,
    slug,
    name: item.name,
    entries: [1, 2, 3, 4, 5, 6].flatMap((rank) => item[`c${rank}`] ? [{ rank, name: item[`c${rank}`].name, description: item[`c${rank}`].description }] : []),
    sourceMapping: `data.ChineseSimplified.constellations.${slug}`,
    processingStatus: "parsed",
    numericEvidenceStatus: "unchecked",
    mechanicEvidenceStatus: "missing",
    executableEffects: [],
    missingFields: ["逐命座可执行规则与独立验证"]
  })).sort((a, b) => a.numericId - b.numericId),
  statCurves: { characters: raw.curve.characters, weapons: raw.curve.weapons }
};
const path = `${argument("output-dir") ?? `${root}packages/game-data/src/generated`}/supplemental.zh-CN.json`;
const serialized = `${JSON.stringify(supplemental)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== serialized) throw new Error("Supplemental catalog is stale; run data:normalize.");
} else writeFileSync(path, serialized);
console.log(`${supplemental.artifactSets.length} artifact sets, ${supplemental.constellationSets.length} constellation sets, ${Object.keys(supplemental.statCurves.characters).length} character curve levels, ${Object.keys(supplemental.statCurves.weapons).length} weapon curve levels; parsed only, no semantic promotion.`);
