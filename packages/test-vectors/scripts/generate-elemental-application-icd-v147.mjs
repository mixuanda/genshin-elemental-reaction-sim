import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PREVIEW_FLAG =
  "PREVIEW_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN";
const UPDATE_FLAG =
  "UPDATE_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN";
const EXPECTED_OUTPUT_SHA256 =
  "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputPath = resolve(
  scriptDirectory,
  "../fixtures/elemental-application-icd-1.47.golden.json"
);
const testPath =
  "packages/sim-core/src/__tests__/elemental-application-icd-golden.test.ts";
const testName =
  "matches the synthetic shared-window, clamp, and reset vector";
const vitestCli = resolve(
  repositoryRoot,
  "node_modules/vitest/vitest.mjs"
);

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== "--preview");
if (unknownArgs.length > 0) {
  throw new Error(
    `Unknown arguments: ${unknownArgs.join(", ")}. Only --preview is supported.`
  );
}
const previewRequested =
  args.includes("--preview") || process.env[PREVIEW_FLAG] === "1";
const updateRequested = process.env[UPDATE_FLAG] === "1";
if (previewRequested && updateRequested) {
  throw new Error("Preview and update modes are mutually exclusive.");
}

function byteSha256(path) {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function outputSnapshot() {
  return existsSync(outputPath)
    ? { exists: true, sha256: byteSha256(outputPath) }
    : { exists: false, sha256: null };
}

function runVitest(mode) {
  const run = spawnSync(
    process.execPath,
    [vitestCli, "run", testPath, "-t", testName],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        [PREVIEW_FLAG]: mode === "preview" ? "1" : "0",
        [UPDATE_FLAG]: mode === "update" ? "1" : "0"
      },
      encoding: "utf8",
      stdio: "inherit"
    }
  );
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0) {
    throw new Error(
      `Vitest refused the 1.47 elemental-application ICD Golden ${mode} with exit code ${String(run.status)}.`
    );
  }
}

const reviewedSha256 = /^[0-9a-f]{64}$/.test(
  EXPECTED_OUTPUT_SHA256
)
  ? EXPECTED_OUTPUT_SHA256
  : null;

if (previewRequested) {
  const before = outputSnapshot();
  if (reviewedSha256 === null && before.exists) {
    throw new Error(
      `Unreviewed fixture already exists at ${outputPath}; remove it before previewing a candidate.`
    );
  }
  runVitest("preview");
  const after = outputSnapshot();
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error(
      `Preview mutated fixture state at ${outputPath}.`
    );
  }
  process.stdout.write(
    `Preview completed without writing ${outputPath}.\n`
  );
  process.exit(0);
}

if (!updateRequested) {
  throw new Error(
    `Refusing to create the 1.47 elemental-application ICD fixture without ${UPDATE_FLAG}=1. Use --preview first.`
  );
}
if (reviewedSha256 === null) {
  throw new Error(
    "Refusing to create the 1.47 elemental-application ICD fixture while EXPECTED_OUTPUT_SHA256 is PENDING. Review preview output and replace the sentinel with the approved 64-hex SHA-256 in both the script and test."
  );
}
if (existsSync(outputPath)) {
  throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
}

runVitest("update");
if (!existsSync(outputPath)) {
  throw new Error(`Vitest passed without creating ${outputPath}.`);
}
const outputSha256 = byteSha256(outputPath);
if (outputSha256 !== reviewedSha256) {
  throw new Error(
    `Created 1.47 elemental-application ICD fixture has unexpected SHA-256 ${outputSha256}; expected ${reviewedSha256}.`
  );
}
process.stdout.write(
  `Created ${outputPath}\nSHA-256 ${outputSha256}\n`
);
