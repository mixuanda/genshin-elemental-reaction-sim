import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = resolve(scriptDirectory, "../fixtures");
const sourcePath = resolve(
  fixtureDirectory,
  "quicken-bloom-task-order-1.37.golden.json"
);
const outputPath = resolve(
  fixtureDirectory,
  "quicken-bloom-task-order-1.38.golden.json"
);
const expectedSourceSha256 =
  "d7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6";

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

const sourceText = readFileSync(sourcePath, "utf8");
const sourceSha256 = createHash("sha256")
  .update(sourceText)
  .digest("hex");
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(
    `Refusing to derive the 1.38 fixture from an unfrozen 1.37 source: expected ${expectedSourceSha256}, received ${sourceSha256}.`
  );
}
const source = JSON.parse(sourceText);
const fixture = structuredClone(source);
fixture.description =
  "Provisional 1.38 identity fixture for the frozen queued Quicken-to-Bloom core-task ordering.";
fixture.provenance = {
  ...fixture.provenance,
  source:
    "Identity-only projection of quicken-bloom-task-order-1.37.golden.json under the 1.38 schema/engine envelope.",
  capturedAt: "2026-07-29",
  notes: [
    ...fixture.provenance.notes,
    "1.38 keeps this Quicken-to-Bloom follow-up in the zero-delay core queue; target-phase-v2 does not reclassify it as a target-owned callback.",
    "These vectors explicitly retain legacy-event-heap-v1, so targetTaskPhaseLog and targetPhaseLog are both empty."
  ]
};
fixture.config = {
  ...fixture.config,
  schemaVersion: "1.38.0",
  engineVersion: "1.38.0-target-reactable-phase",
  targetTaskModelMode: "legacy-event-heap-v1"
};
for (const vector of Object.values(fixture.vectors)) {
  vector.version.schemaVersion = "1.38.0";
  vector.version.engineVersion =
    "1.38.0-target-reactable-phase";
  vector.version.targetTaskModelMode =
    "legacy-event-heap-v1";
  vector.targetTaskPhaseLog = [];
  vector.targetPhaseLog = [];
}
fixture.hashes = Object.fromEntries(
  Object.entries(fixture.vectors).map(([id, vector]) => [
    id,
    createHash("sha256")
      .update(canonicalStringify(vector))
      .digest("hex")
  ])
);

writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
