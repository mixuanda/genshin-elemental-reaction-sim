#!/usr/bin/env node
// Capture a real upstream data revision without running code from that revision.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { diffSnapshots, readPointers, readSnapshot } from "./update-lib.mjs";

const repository = "https://github.com/theBowja/genshin-db.git";
const packageDir = fileURLToPath(new URL("../", import.meta.url));
const scriptDir = fileURLToPath(new URL("./", import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing --${name} value.`);
  return args[index + 1];
}
const outputRoot = resolve(option("output", "artifacts/data-candidates"));
const gameVersion = option("game-version", "unknown");
const releaseStatus = option("release-status", "unknown");
const releaseEvidenceUrl = option("release-evidence-url");
if (!/^(unknown|[0-9]+\.[0-9]+(?:\.[0-9]+)?)$/.test(gameVersion)) throw new Error("Game version must be a numeric version or unknown.");
if (!["unknown", "released", "official-next", "preview"].includes(releaseStatus)) throw new Error("Invalid release status.");
if (releaseStatus !== "unknown" && (gameVersion === "unknown" || !releaseEvidenceUrl)) throw new Error("A non-unknown release status requires --game-version and --release-evidence-url.");
if (releaseEvidenceUrl && !/^https:\/\//.test(releaseEvidenceUrl)) throw new Error("Release evidence must be an HTTPS URL.");

function run(command, argv, cwd, maxBuffer = 8 * 1024 * 1024) {
  const result = spawnSync(command, argv, { cwd, encoding: "utf8", maxBuffer });
  if (result.status !== 0) throw new Error(`${command} ${argv[0]} failed: ${result.stderr?.trim() || result.stdout?.trim() || result.error || result.status}`);
  return result.stdout.trim();
}
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); }
function writeRunStatus(value) { writeFileSync(resolve(outputRoot, "run-status.json"), `${JSON.stringify(value, null, 2)}\n`); }
function recordFailure(stage, error, details = {}) {
  appendFileSync(resolve(outputRoot, "failure-ledger.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), stage, error: String(error), ...details })}\n`);
}

mkdirSync(outputRoot, { recursive: true });
const discoveredAt = new Date().toISOString();
let phase = "resolve-upstream";
let checkout = null;
let stage = null;
let sourceCommit = null;
let blockedPhase = null;
try {
const advertised = run("git", ["ls-remote", "--symref", repository, "HEAD"], undefined);
const branch = /^ref: refs\/heads\/([^\s]+)\s+HEAD$/m.exec(advertised)?.[1];
const commit = /^([a-f0-9]{40})\s+HEAD$/m.exec(advertised)?.[1];
if (!branch || !commit) throw new Error("Could not identify the upstream default branch and HEAD commit.");
sourceCommit = commit;
phase = "clone-fixed-revision";
checkout = mkdtempSync(resolve(tmpdir(), "gidps-genshin-db-"));
run("git", ["clone", "--depth", "1", "--single-branch", "--branch", branch, "--no-tags", repository, checkout], undefined, 32 * 1024 * 1024);
if (run("git", ["rev-parse", "HEAD"], checkout) !== commit) throw new Error("Upstream HEAD moved during capture; retry to pin one revision.");

phase = "project-source-tree";
stage = mkdtempSync(resolve(outputRoot, ".capture-"));
const raw = resolve(stage, "raw");
run(process.execPath, [resolve(scriptDir, "ingest-genshin-db-tree.mjs"), "--tree", checkout, "--output", raw, "--commit", commit, "--game-version", gameVersion, "--release-status", releaseStatus], undefined);
const sourceManifest = JSON.parse(readFileSync(resolve(raw, "source-manifest.json"), "utf8"));
const sourceFiles = JSON.parse(readFileSync(resolve(raw, "source-files.json"), "utf8"));
const sourceBytes = readFileSync(resolve(raw, "src/min/data.min.json"));
if (sha(sourceBytes) !== sourceManifest.sourceSha256) throw new Error("Projection hash mismatch after ingestion.");
phase = "archive-source-tree";
const archive = spawnSync("git", ["archive", "--format=tar", "HEAD", "LICENSE", "package.json", "src/data/ChineseSimplified/characters", "src/data/ChineseSimplified/talents", "src/data/ChineseSimplified/weapons", "src/data/ChineseSimplified/artifacts", "src/data/ChineseSimplified/constellations", "src/data/stats/characters.json", "src/data/stats/talents.json", "src/data/stats/weapons.json", "src/data/curve/characters.json", "src/data/curve/weapons.json", "src/data/version/characters.json", "src/data/version/talents.json", "src/data/version/weapons.json", "src/data/version/artifacts.json", "src/data/version/constellations.json"], { cwd: checkout, maxBuffer: 128 * 1024 * 1024 });
if (archive.status !== 0) throw new Error(`Could not archive pinned raw source files: ${archive.stderr?.toString() || archive.error}`);
const archivedBytes = gzipSync(archive.stdout, { level: 9 });
writeFileSync(resolve(stage, "source-tree.tar.gz"), archivedBytes, { flag: "wx" });
rmSync(checkout, { recursive: true, force: true });

const candidateId = `genshin-db-${commit}-${sourceManifest.sourceSha256.slice(0, 16)}`;
const activeStore = resolve(packageDir, "manifests");
const activeId = readPointers(activeStore).activeCatalogSnapshotId;
const active = activeId ? readSnapshot(activeStore, activeId) : null;
const activeGenshinDb = active?.data.catalog.sources.find((source) => source.id === "genshin-db");
const manifest = {
  schemaVersion: "1.0.0", candidateId, discoveredAt,
  repository, branch, commit,
  sourceTreeUrl: `https://github.com/theBowja/genshin-db/tree/${commit}`,
  sourceVersion: sourceManifest.sourceVersion,
  releaseIdentity: { gameVersion, releaseStatus, evidenceUrl: releaseEvidenceUrl },
  acquisition: "Git default-branch HEAD resolved and checked out at the exact commit; JSON parsed without running upstream code.",
  rawSourceArchiveSha256: sha(archivedBytes),
  projectedDataSha256: sourceManifest.sourceSha256,
  comparedToActiveCatalog: active ? {
    snapshotId: active.id,
    sourceCommit: activeGenshinDb?.commit ?? null,
    sourceProjectionSha256: activeGenshinDb?.contentSha256 ?? null,
    sameSourceProjection: activeGenshinDb?.contentSha256 === sourceManifest.sourceSha256
  } : null,
  sourceFiles: sourceFiles.records.length,
  verification: { structure: "pending", numeric: "unchecked", mechanics: "missing", officialRelease: releaseStatus === "unknown" ? "unknown" : "manual-evidence-required" },
  activeDatasetChanged: false
};
writeJson(resolve(stage, "candidate-manifest.json"), manifest);

// Reuse the project's existing normalizers and snapshot validation, entirely
// within this candidate directory. A raw capture remains useful if a future
// upstream schema requires manual mapping before normalization can succeed.
try {
  phase = "normalize-candidate";
  const generated = resolve(stage, "generated");
  mkdirSync(generated);
  run(process.execPath, [resolve(scriptDir, "generate-catalog.mjs"), "--source-dir", raw, "--source-manifest", resolve(raw, "source-manifest.json"), "--output-dir", generated], undefined);
  run(process.execPath, [resolve(scriptDir, "generate-supplemental.mjs"), "--source-dir", raw, "--source-manifest", resolve(raw, "source-manifest.json"), "--output-dir", generated], undefined);
  const bundle = { catalog: JSON.parse(readFileSync(resolve(generated, "catalog.zh-CN.json"), "utf8")), supplemental: JSON.parse(readFileSync(resolve(generated, "supplemental.zh-CN.json"), "utf8")) };
  writeJson(resolve(stage, "bundle.json"), bundle);
  const metadata = {
    gameVersion, label: sourceManifest.catalogVersion, releaseStatus, createdAt: discoveredAt,
    sources: bundle.catalog.sources.map((source) => ({ id: source.id, url: source.url, revision: source.commit, retrievedAt: discoveredAt, gameVersion, contentSha256: source.contentSha256, license: source.license, verificationMethod: "Fixed Git revision and source byte hashes; numerical and mechanic meaning unchecked." }))
  };
  writeJson(resolve(stage, "metadata.json"), metadata);
  const syncReceipt = JSON.parse(run(process.execPath, [resolve(scriptDir, "update-data.mjs"), "sync", "--store", resolve(stage, "snapshot-store"), "--input", resolve(stage, "bundle.json"), "--metadata", resolve(stage, "metadata.json")], undefined, 32 * 1024 * 1024));
  const candidateStore = resolve(stage, "snapshot-store");
  // Preview snapshots intentionally have no active catalog pointer.
  const candidateSnapshot = readSnapshot(candidateStore, syncReceipt.snapshotId);
  if (active) {
    phase = "compare-candidate";
    const diff = diffSnapshots(active, candidateSnapshot);
    writeJson(resolve(stage, "diff-from-active.json"), diff);
    const counts = Object.fromEntries(Object.entries(diff).map(([group, value]) => [
      group,
      Array.isArray(value)
        ? value.length
        : Object.fromEntries(Object.entries(value).map(([kind, identities]) => [kind, Array.isArray(identities) ? identities.length : identities]))
    ]));
    manifest.comparison = {
      status: "compared",
      fromSnapshotId: active.id,
      toSnapshotId: candidateSnapshot.id,
      diffFile: "diff-from-active.json",
      counts
    };
  } else {
    manifest.comparison = { status: "unavailable-no-active-snapshot" };
  }
  manifest.verification.structure = "schema-valid-candidate";
  writeFileSync(resolve(stage, "candidate-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
} catch (error) {
  blockedPhase = phase;
  manifest.verification.structure = "normalization-blocked";
  manifest.normalizationError = String(error);
  writeFileSync(resolve(stage, "candidate-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
phase = "finalize-candidate";
const finalPath = resolve(outputRoot, candidateId);
if (existsSync(finalPath)) throw new Error(`Candidate already exists: ${finalPath}`);
renameSync(stage, finalPath);
stage = null;
const candidateStatus = manifest.verification.structure === "schema-valid-candidate" ? "ready" : "blocked";
writeRunStatus({ schemaVersion: "data-candidate-run-v1", attemptedAt: discoveredAt, completedAt: new Date().toISOString(),
  status: candidateStatus, stage: candidateStatus === "ready" ? "complete" : blockedPhase, candidateId,
  sourceCommit: commit, sourceProjectionSha256: manifest.projectedDataSha256,
  candidateManifestPath: `${candidateId}/candidate-manifest.json`,
  normalization: { status: manifest.verification.structure, error: manifest.normalizationError ?? null },
  comparison: manifest.comparison ?? null, failureCount: candidateStatus === "ready" ? 0 : 1,
  error: manifest.normalizationError ?? null });
if (candidateStatus === "blocked") recordFailure(blockedPhase, manifest.normalizationError, { candidateId, sourceCommit: commit });
console.log(JSON.stringify({ candidateId, path: finalPath, commit, gameVersion, releaseStatus, projectedDataSha256: manifest.projectedDataSha256, structure: manifest.verification.structure, sourceFiles: manifest.sourceFiles }, null, 2));
if (manifest.verification.structure !== "schema-valid-candidate") process.exitCode = 1;
} catch (error) {
  let partialCapturePath = null;
  if (stage && existsSync(stage)) {
    partialCapturePath = resolve(outputRoot, `failed-capture-${Date.now()}-${process.pid}`);
    renameSync(stage, partialCapturePath);
  }
  recordFailure(phase, error, { sourceCommit, partialCapturePath });
  writeRunStatus({ schemaVersion: "data-candidate-run-v1", attemptedAt: discoveredAt, completedAt: new Date().toISOString(),
    status: "failed", stage: phase, candidateId: null, sourceCommit, sourceProjectionSha256: null,
    candidateManifestPath: null, normalization: { status: "not-completed", error: null }, comparison: null,
    failureCount: 1, error: String(error), partialCapturePath });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (checkout && existsSync(checkout)) rmSync(checkout, { recursive: true, force: true });
}
