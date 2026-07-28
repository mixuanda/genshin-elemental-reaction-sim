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
  "quicken-bloom-task-order-1.36.golden.json"
);
const outputPath = resolve(
  fixtureDirectory,
  "quicken-bloom-task-order-1.37.golden.json"
);

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

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const fixture = structuredClone(source);
fixture.description =
  "Provisional 1.37 identity fixture for the frozen queued Quicken-to-Bloom core-task ordering.";
fixture.provenance = {
  ...fixture.provenance,
  source:
    "Identity-only projection of quicken-bloom-task-order-1.36.golden.json under the 1.37 schema/engine envelope.",
  notes: [
    ...fixture.provenance.notes,
    "1.37 keeps this Quicken-to-Bloom follow-up in the zero-delay core queue; target-phase-v1 does not reclassify it as a target-owned callback."
  ]
};
fixture.config = {
  ...fixture.config,
  schemaVersion: "1.37.0",
  engineVersion: "1.37.0-target-task-phase",
  targetTaskModelMode: "legacy-event-heap-v1"
};
for (const vector of Object.values(fixture.vectors)) {
  vector.version.schemaVersion = "1.37.0";
  vector.version.engineVersion =
    "1.37.0-target-task-phase";
  vector.version.targetTaskModelMode =
    "legacy-event-heap-v1";
  vector.targetTaskPhaseLog = [];
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
