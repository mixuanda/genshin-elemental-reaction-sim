import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPDATE_FLAG = "UPDATE_DIRECT_DAMAGE_GROUP_V146_GOLDEN";
const EXPECTED_OUTPUT_SHA256 =
  "eebbd992dddbf4a24b16dd5c9d00a31a2c6d107372ba9fc58994181061156899";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const outputPath = resolve(
  scriptDirectory,
  "../fixtures/direct-damage-group-1.46.golden.json"
);
const testPath =
  "packages/sim-core/src/__tests__/direct-damage-group-golden.test.ts";
const vitestCli = resolve(
  repositoryRoot,
  "node_modules/vitest/vitest.mjs"
);

if (process.env[UPDATE_FLAG] !== "1") {
  throw new Error(
    `Refusing to create the 1.46 Damage Group fixture without ${UPDATE_FLAG}=1.`
  );
}
if (existsSync(outputPath)) {
  throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
}

const run = spawnSync(
  process.execPath,
  [
    vitestCli,
    "run",
    testPath,
    "-t",
    "matches the synthetic zero, switch, tail, and reset vector"
  ],
  {
    cwd: repositoryRoot,
    env: { ...process.env, [UPDATE_FLAG]: "1" },
    encoding: "utf8",
    stdio: "inherit"
  }
);
if (run.error !== undefined) throw run.error;
if (run.status !== 0) {
  throw new Error(
    `Vitest refused the 1.46 Damage Group Golden with exit code ${String(run.status)}.`
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
    `Created 1.46 Damage Group fixture has unexpected SHA-256 ${outputSha256}; expected ${EXPECTED_OUTPUT_SHA256}.`
  );
}
process.stdout.write(
  `Created ${outputPath}\nSHA-256 ${outputSha256}\n`
);
