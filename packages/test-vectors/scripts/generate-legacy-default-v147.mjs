import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PREVIEW_FLAG = "PREVIEW_LEGACY_DEFAULT_V147_GOLDEN";
const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V147_GOLDEN";
const EXPECTED_SOURCE_SHA256 =
  "3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465";
const EXPECTED_OUTPUT_SHA256 =
  "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const sourcePath = resolve(
  scriptDirectory,
  "../fixtures/legacy-default-120s-1.46.golden.json"
);
const outputPath = resolve(
  scriptDirectory,
  "../fixtures/legacy-default-120s-1.47.golden.json"
);
const testPath =
  "packages/sim-core/src/__tests__/legacy-default-v147-golden.test.ts";
const testName =
  "matches the exact default 120-second 1.47 baseline";
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

function assertFrozenSource() {
  const sourceSha256 = byteSha256(sourcePath);
  if (sourceSha256 !== EXPECTED_SOURCE_SHA256) {
    throw new Error(
      `Refusing to derive 1.47 from modified 1.46 source ${sourcePath}; received ${sourceSha256}.`
    );
  }
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
      `Vitest refused the 1.47 default Golden ${mode} with exit code ${String(run.status)}.`
    );
  }
}

assertFrozenSource();
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
    `Refusing to create the 1.47 default fixture without ${UPDATE_FLAG}=1. Use --preview first.`
  );
}
if (reviewedSha256 === null) {
  throw new Error(
    "Refusing to create the 1.47 default fixture while EXPECTED_OUTPUT_SHA256 is PENDING. Review preview output and replace the sentinel with the approved 64-hex SHA-256 in both the script and test."
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
    `Created default 1.47 fixture has unexpected SHA-256 ${outputSha256}; expected ${reviewedSha256}.`
  );
}
process.stdout.write(
  `Created ${outputPath}\nSHA-256 ${outputSha256}\n`
);
