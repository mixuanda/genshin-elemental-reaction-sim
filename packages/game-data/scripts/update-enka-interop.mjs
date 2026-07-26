#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, "..");
const outputPath = resolve(PACKAGE_DIR, "vendor/enka-avatar-skill-map.json");
const sourcePath = process.argv[2];
const sourceCommit = process.argv[3];

if (!sourcePath || !sourceCommit) {
  throw new Error(
    "Usage: node update-enka-interop.mjs /path/to/API-docs/store/gi/avatars.json <commit>"
  );
}

const source = readFileSync(resolve(sourcePath));
const avatars = JSON.parse(source.toString("utf8"));
const records = Object.entries(avatars)
  .map(([variantKey, value]) => ({
    variantKey,
    avatarId: Number(variantKey.split("-")[0]),
    element: value.Element ?? "None",
    skillOrder: Array.isArray(value.SkillOrder)
      ? value.SkillOrder.map(Number)
      : [],
    proudMap: Object.fromEntries(
      Object.entries(value.ProudMap ?? {}).map(([skillId, proudId]) => [
        skillId,
        Number(proudId)
      ])
    )
  }))
  .filter((entry) => Number.isInteger(entry.avatarId))
  .sort(
    (left, right) =>
      left.avatarId - right.avatarId ||
      left.variantKey.localeCompare(right.variantKey)
  );

const snapshot = {
  schemaVersion: "1.0.0",
  source: {
    name: "EnkaNetwork/API-docs GI avatar identifier map",
    url: "https://github.com/EnkaNetwork/API-docs",
    commit: sourceCommit,
    verifiedAt: "2026-07-26T00:00:00.000Z",
    contentSha256: createHash("sha256").update(source).digest("hex"),
    license: "NO-LICENSE-DETECTED",
    notes:
      "Only numeric avatar, skill-order and proud-skill identifier relationships are retained for API interoperability; no text, descriptions, icons or other assets are copied."
  },
  records
};

writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${records.length} Enka identifier mappings to ${outputPath}`);
