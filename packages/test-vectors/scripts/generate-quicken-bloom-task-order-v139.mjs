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
  "quicken-bloom-task-order-1.38.golden.json"
);
const outputPath = resolve(
  fixtureDirectory,
  "quicken-bloom-task-order-1.39.golden.json"
);
const expectedSourceSha256 =
  "07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc";

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
    `Refusing to derive the 1.39 fixture from an unfrozen 1.38 source: expected ${expectedSourceSha256}, received ${sourceSha256}.`
  );
}

const fixture = structuredClone(JSON.parse(sourceText));
fixture.description =
  "Provisional 1.39 identity fixture for the frozen queued Quicken-to-Bloom core-task ordering.";
fixture.provenance = {
  ...fixture.provenance,
  source:
    "Identity-only projection of quicken-bloom-task-order-1.38.golden.json under the 1.39 schema/engine envelope.",
  capturedAt: "2026-07-29",
  notes: [
    ...fixture.provenance.notes,
    "1.39 keeps this Quicken-to-Bloom follow-up in the zero-delay core queue and explicitly retains deferred-event-heap-v1 reaction delivery.",
    "Recursive Shatter delivery is not active in these vectors."
  ]
};
fixture.config = {
  ...fixture.config,
  schemaVersion: "1.39.0",
  engineVersion: "1.39.0-shatter-recursive-delivery",
  reactionDeliveryModelMode: "deferred-event-heap-v1"
};
for (const vector of Object.values(fixture.vectors)) {
  vector.version.schemaVersion = "1.39.0";
  vector.version.engineVersion =
    "1.39.0-shatter-recursive-delivery";
  vector.version.reactionDeliveryModelMode =
    "deferred-event-heap-v1";
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
