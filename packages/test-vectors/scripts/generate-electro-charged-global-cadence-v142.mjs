import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPDATE_FLAG =
  "UPDATE_EC_GLOBAL_CADENCE_V142_GOLDEN";
const EXPECTED_SOURCE_SHA256 =
  "b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const sourcePath = resolve(
  scriptDirectory,
  "../fixtures/electro-charged-propagation-1.41.golden.json"
);
const outputPath = resolve(
  scriptDirectory,
  "../fixtures/electro-charged-global-cadence-1.42.golden.json"
);
const testPath =
  "packages/sim-core/src/__tests__/electro-charged-global-cadence-golden.test.ts";
const vitestCli = resolve(
  repositoryRoot,
  "node_modules/vitest/vitest.mjs"
);

if (process.env[UPDATE_FLAG] !== "1") {
  throw new Error(
    `Refusing to create the 1.42 cadence fixture without ${UPDATE_FLAG}=1.`
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
if (sourceSha256 !== EXPECTED_SOURCE_SHA256) {
  throw new Error(
    `Refusing to derive 1.42 from modified 1.41 source ${sourcePath}; received ${sourceSha256}.`
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
    `Vitest refused the 1.42 cadence Golden with exit code ${String(run.status)}.`
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
