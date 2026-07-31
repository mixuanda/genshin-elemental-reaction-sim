import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V144_GOLDEN";
const EXPECTED_SOURCE_SHA256 =
  "ccb4bd071cbd5643f4a59dc41273801dd6e76a778bc876ea3ed6ab23266425df";
const EXPECTED_OUTPUT_SHA256 =
  "e0c2e1475ec97b35bd0ee7bb1bf6b3bc0e505588e1ea76001b8011216d475d05";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const sourcePath = resolve(
  scriptDirectory,
  "../fixtures/legacy-default-120s-1.42.golden.json"
);
const outputPath = resolve(
  scriptDirectory,
  "../fixtures/legacy-default-120s-1.44.golden.json"
);
const testPath = "packages/sim-core/src/__tests__/golden.test.ts";
const vitestCli = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs");

if (process.env[UPDATE_FLAG] !== "1") {
  throw new Error(
    `Refusing to create the 1.44 default fixture without ${UPDATE_FLAG}=1.`
  );
}
if (existsSync(outputPath)) {
  throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
}
const sourceSha256 = createHash("sha256")
  .update(readFileSync(sourcePath))
  .digest("hex");
if (sourceSha256 !== EXPECTED_SOURCE_SHA256) {
  throw new Error(
    `Refusing to derive 1.44 from modified 1.42 source ${sourcePath}; received ${sourceSha256}.`
  );
}

const run = spawnSync(
  process.execPath,
  [vitestCli, "run", testPath],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      [UPDATE_FLAG]: "1"
    },
    encoding: "utf8",
    stdio: "inherit"
  }
);
if (run.error !== undefined) throw run.error;
if (run.status !== 0) {
  throw new Error(
    `Vitest refused the 1.44 default Golden with exit code ${String(run.status)}.`
  );
}
if (!existsSync(outputPath)) {
  throw new Error(`Vitest passed without creating ${outputPath}.`);
}

const outputSha256 = createHash("sha256")
  .update(readFileSync(outputPath))
  .digest("hex");
if (outputSha256 !== EXPECTED_OUTPUT_SHA256) {
  throw new Error(
    `Created default 1.44 fixture has unexpected SHA-256 ${outputSha256}; expected ${EXPECTED_OUTPUT_SHA256}.`
  );
}
process.stdout.write(`Created ${outputPath}\nSHA-256 ${outputSha256}\n`);
