import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPDATE_FLAG =
  "UPDATE_EC_PROPAGATION_V141_GOLDEN";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputPath = resolve(
  scriptDirectory,
  "../fixtures/electro-charged-propagation-1.41.golden.json"
);
const testPath =
  "packages/sim-core/src/__tests__/electro-charged-propagation-golden.test.ts";
const vitestCli = resolve(
  repositoryRoot,
  "node_modules/vitest/vitest.mjs"
);

if (process.env[UPDATE_FLAG] !== "1") {
  throw new Error(
    `Refusing to create the 1.41 propagation fixture without ${UPDATE_FLAG}=1.`
  );
}
if (existsSync(outputPath)) {
  throw new Error(
    `Refusing to overwrite frozen fixture ${outputPath}.`
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
    `Vitest refused the 1.41 propagation Golden with exit code ${String(run.status)}.`
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
