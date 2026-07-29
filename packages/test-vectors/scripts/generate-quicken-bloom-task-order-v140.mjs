import { createHash } from "node:crypto";
import {
  linkSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPDATE_FLAG =
  "UPDATE_QUICKEN_BLOOM_TASK_ORDER_V140_GOLDEN";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = resolve(scriptDirectory, "../fixtures");
const sourcePath = resolve(
  fixtureDirectory,
  "quicken-bloom-task-order-1.39.golden.json"
);
const outputPath = resolve(
  fixtureDirectory,
  "quicken-bloom-task-order-1.40.golden.json"
);
const expectedSourceSha256 =
  "a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534";

function canonicalStringify(value) {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (
      typeof value === "number" &&
      !Number.isFinite(value)
    ) {
      throw new TypeError("Cannot canonicalize a non-finite number.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalStringify(
            value[key]
          )}`
      )
      .join(",")}}`;
  }
  throw new TypeError(`Cannot canonicalize ${typeof value}.`);
}

function atomicCreate(path, contents) {
  const temporaryPath =
    `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryPath, contents, { flag: "wx" });
  try {
    linkSync(temporaryPath, path);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(
        `Refusing to overwrite frozen fixture ${path}.`
      );
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

if (process.env[UPDATE_FLAG] !== "1") {
  throw new Error(
    `Refusing to create the 1.40 identity fixture without ${UPDATE_FLAG}=1.`
  );
}

const sourceText = readFileSync(sourcePath, "utf8");
const sourceSha256 = createHash("sha256")
  .update(sourceText)
  .digest("hex");
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(
    `Refusing to derive the 1.40 fixture from an unfrozen 1.39 source: expected ${expectedSourceSha256}, received ${sourceSha256}.`
  );
}

const fixture = structuredClone(JSON.parse(sourceText));
const expectedScenarioIds = [
  "auraV6Compatibility",
  "fifo",
  "missingHydro",
  "missingQuicken"
];
const sourceScenarioIds = Object.keys(fixture.vectors).sort();
if (
  canonicalStringify(sourceScenarioIds) !==
  canonicalStringify(expectedScenarioIds)
) {
  throw new Error(
    `Refusing to derive an incomplete 1.40 fixture: received ${sourceScenarioIds.join(", ")}.`
  );
}
fixture.description =
  "Provisional 1.40 identity fixture for the frozen aura-v7 queued Quicken-to-Bloom core-task ordering.";
fixture.provenance = {
  ...fixture.provenance,
  source:
    "Identity-only projection of quicken-bloom-task-order-1.39.golden.json under the 1.40 schema/engine envelope.",
  capturedAt: "2026-07-29",
  notes: [
    ...fixture.provenance.notes,
    "1.40 deliberately preserves aura-v7 for these historical task-order vectors; aura-v8 Electro-Charged cleanup is covered by a separate runtime Golden.",
    "No Electro-Charged cleanup audit is added to this identity-only projection."
  ]
};
fixture.config = {
  ...fixture.config,
  schemaVersion: "1.40.0",
  engineVersion: "1.40.0-ec-next-target-tick-cleanup"
};
for (const vector of Object.values(fixture.vectors)) {
  vector.version.schemaVersion = "1.40.0";
  vector.version.engineVersion =
    "1.40.0-ec-next-target-tick-cleanup";
}
fixture.hashes = Object.fromEntries(
  Object.entries(fixture.vectors).map(([id, vector]) => [
    id,
    createHash("sha256")
      .update(canonicalStringify(vector))
      .digest("hex")
  ])
);

atomicCreate(
  outputPath,
  `${JSON.stringify(fixture, null, 2)}\n`
);
