import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const vitestCli = resolve(
  repositoryRoot,
  "node_modules/vitest/vitest.mjs"
);

function byteSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function outputSnapshot(path) {
  return existsSync(path)
    ? { exists: true, sha256: byteSha256(path) }
    : { exists: false, sha256: null };
}

/**
 * Runs a reviewed Golden gate without giving the wrapper permission to write.
 * The selected Vitest case owns candidate construction and atomic creation;
 * this wrapper only selects preview/update mode and verifies the final bytes.
 */
export function runGoldenGenerator({
  label,
  outputPath,
  previewFlag,
  updateFlag,
  expectedOutputSha256,
  testPath,
  testName,
  frozenSources = []
}) {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => arg !== "--preview");
  if (unknownArgs.length > 0) {
    throw new Error(
      `Unknown arguments: ${unknownArgs.join(", ")}. Only --preview is supported.`
    );
  }

  for (const source of frozenSources) {
    const received = byteSha256(source.path);
    if (received !== source.sha256) {
      throw new Error(
        `Refusing to derive ${label} from modified source ${source.path}; received ${received}.`
      );
    }
  }

  const previewRequested =
    args.includes("--preview") || process.env[previewFlag] === "1";
  const updateRequested = process.env[updateFlag] === "1";
  if (previewRequested && updateRequested) {
    throw new Error("Preview and update modes are mutually exclusive.");
  }

  const reviewedSha256 = /^[0-9a-f]{64}$/.test(expectedOutputSha256)
    ? expectedOutputSha256
    : null;
  const runVitest = (mode) => {
    const run = spawnSync(
      process.execPath,
      [vitestCli, "run", testPath, "-t", testName],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          [previewFlag]: mode === "preview" ? "1" : "0",
          [updateFlag]: mode === "update" ? "1" : "0"
        },
        encoding: "utf8",
        stdio: "inherit"
      }
    );
    if (run.error !== undefined) throw run.error;
    if (run.status !== 0) {
      throw new Error(
        `Vitest refused the ${label} ${mode} with exit code ${String(run.status)}.`
      );
    }
  };

  if (previewRequested) {
    const before = outputSnapshot(outputPath);
    if (reviewedSha256 === null && before.exists) {
      throw new Error(
        `Unreviewed fixture already exists at ${outputPath}; remove it before previewing a candidate.`
      );
    }
    runVitest("preview");
    const after = outputSnapshot(outputPath);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error(`Preview mutated fixture state at ${outputPath}.`);
    }
    process.stdout.write(
      `Preview completed without writing ${outputPath}.\n`
    );
    return;
  }

  if (!updateRequested) {
    throw new Error(
      `Refusing to create ${label} without ${updateFlag}=1. Use --preview first.`
    );
  }
  if (reviewedSha256 === null) {
    throw new Error(
      `Refusing to create ${label} while the reviewed output SHA-256 is pending.`
    );
  }
  if (existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
  }

  runVitest("update");
  if (!existsSync(outputPath)) {
    throw new Error(`Vitest passed without creating ${outputPath}.`);
  }
  const received = byteSha256(outputPath);
  if (received !== reviewedSha256) {
    throw new Error(
      `Created ${label} has unexpected SHA-256 ${received}; expected ${reviewedSha256}.`
    );
  }
  process.stdout.write(
    `Created ${outputPath}\nSHA-256 ${received}\n`
  );
}
