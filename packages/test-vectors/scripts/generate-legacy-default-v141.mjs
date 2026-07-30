import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPDATE_FLAG =
  "UPDATE_LEGACY_DEFAULT_V141_GOLDEN";
const EXPECTED_V140_SHA256 =
  "843523027635a1026269fbe4711fbdb56e5a229a8cb2dbf45bcbb396fe62136f";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const fixtureDirectory = resolve(scriptDirectory, "../fixtures");
const sourcePath = resolve(
  fixtureDirectory,
  "legacy-default-120s-1.40.golden.json"
);
const outputPath = resolve(
  fixtureDirectory,
  "legacy-default-120s-1.41.golden.json"
);
const testPath =
  "packages/sim-core/src/__tests__/golden.test.ts";
const vitestCli = resolve(
  repositoryRoot,
  "node_modules/vitest/vitest.mjs"
);

if (process.env[UPDATE_FLAG] !== "1") {
  throw new Error(
    `Refusing to create the 1.41 identity fixture without ${UPDATE_FLAG}=1.`
  );
}
if (existsSync(outputPath)) {
  throw new Error(
    `Refusing to overwrite frozen fixture ${outputPath}.`
  );
}

const sourceSha256 = createHash("sha256")
  .update(readFileSync(sourcePath))
  .digest("hex");
if (sourceSha256 !== EXPECTED_V140_SHA256) {
  throw new Error(
    `Refusing to derive the 1.41 fixture from an unfrozen 1.40 source: expected ${EXPECTED_V140_SHA256}, received ${sourceSha256}.`
  );
}

const run = spawnSync(
  process.execPath,
  [
    vitestCli,
    "run",
    testPath,
    "-t",
    "matches the full default 120-second baseline"
  ],
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
    `Vitest refused the 1.41 default Golden with exit code ${String(run.status)}.`
  );
}
if (!existsSync(outputPath)) {
  throw new Error(
    `Vitest passed without creating ${outputPath}.`
  );
}

const outputSha256 = createHash("sha256")
  .update(readFileSync(outputPath))
  .digest("hex");
process.stdout.write(
  `Created ${outputPath}\nSHA-256 ${outputSha256}\n`
);
