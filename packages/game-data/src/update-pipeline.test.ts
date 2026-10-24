import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { assessDefinitionReadiness, fieldAssessmentSchema, snapshotSchema, type FieldAssessment } from "./update-schema";
import { getClassifiedCharacterHits } from "./classified-hits";
import { artifactSetCatalog, getExactStatCurve } from "./supplemental";
import { gameDataCatalog } from "./catalog";
import { gameDataRuntimeIndex } from "./catalog-runtime";
import { runtimeDatasetMetadata } from "./runtime-metadata";
import { updateStatus } from "./update-status";

const script = resolve("packages/game-data/scripts/update-data.mjs");
const stores: string[] = [];
function store() { const dir = mkdtempSync(resolve(tmpdir(), "gidps-update-test-")); stores.push(dir); return dir; }
afterEach(() => { for (const dir of stores.splice(0)) rmSync(dir, { force: true, recursive: true }); });

function run(dir: string, command: string, ...args: string[]) {
  return JSON.parse(execFileSync(process.execPath, [script, command, "--store", dir, ...args], { encoding: "utf8" })) as Record<string, unknown>;
}
function failed(dir: string, command: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [script, command, "--store", dir, ...args], { encoding: "utf8" });
  expect(result.status).not.toBe(0);
  return result.stderr;
}
const verifiedField: FieldAssessment = {
  id: "test-hit:coefficient", entityId: "test-hit", path: "coefficient", processingStatus: "classified", numericEvidenceStatus: "verified", mechanicEvidenceStatus: "verified", sourceIds: ["synthetic-test-fixture"], sourceMapping: "fixture.coefficient", testRefs: ["update-pipeline.test.ts"], rejectionReasons: [], conflicts: []
};
function syncFixture(dir: string, releaseStatus: "released" | "preview" | "official-next" | "unknown", revision = "1", verified = true) {
  const data = {
    catalog: { schemaVersion: "1.0.0", catalogVersion: `synthetic-test-${revision}`, locale: "zh-CN", generatedAt: "2026-09-22T00:00:00Z", gamePatch: "test", sources: [{ id: "synthetic-test-fixture", name: "Synthetic test only", url: "https://example.org/test-only", version: revision, commit: revision, license: "test", contentSha256: "a".repeat(64), notes: "never game data" }], counts: { characters: 0, talentSets: 0, weapons: 0, enkaCharacterMappings: 0 }, characters: [], talentSets: [], weapons: [], enkaCharacterMappings: [] },
    supplemental: { artifactSets: [], constellationSets: [], statCurves: { characters: {}, weapons: {} } }
  };
  const metadata = {
    gameVersion: "test", label: "Synthetic pipeline test only", releaseStatus, createdAt: "2026-09-22T00:00:00Z",
    sources: [{ id: "synthetic-test-fixture", url: "https://example.org/test-only", revision, retrievedAt: "2026-09-22T00:00:00Z", gameVersion: "test", contentSha256: "a".repeat(64), license: "test", verificationMethod: "synthetic pipeline fixture; never game data" }],
    fields: [verified ? verifiedField : { ...verifiedField, numericEvidenceStatus: "missing" }],
    definitions: [{ id: "test-hit", entityId: "test-hit", scope: "hitCalculation", dependencyFieldIds: [verifiedField.id], implementationRef: "test-only", testRefs: ["update-pipeline.test.ts"] }]
  };
  const input = resolve(dir, `input-${releaseStatus}-${revision}.json`);
  const meta = resolve(dir, `metadata-${releaseStatus}-${revision}.json`);
  writeFileSync(input, JSON.stringify(data)); writeFileSync(meta, JSON.stringify(metadata));
  return run(dir, releaseStatus === "preview" ? "preview" : "sync", "--input", input, "--metadata", meta).snapshotId as string;
}

describe("independent data dimensions and scoped readiness", () => {
  it("keeps a parsed preview independent from numeric and mechanic evidence", () => {
    expect(fieldAssessmentSchema.parse({ ...verifiedField, processingStatus: "parsed", numericEvidenceStatus: "cross-checked", mechanicEvidenceStatus: "partial" }).numericEvidenceStatus).toBe("cross-checked");
    const missingBurst = { ...verifiedField, id: "unrelated:burst", numericEvidenceStatus: "missing" as const };
    const definition = { id: "hit", entityId: "actor", scope: "hitCalculation" as const, dependencyFieldIds: [verifiedField.id], implementationRef: "fixture", testRefs: ["fixture"] };
    expect(assessDefinitionReadiness(definition, [verifiedField, missingBurst]).ready).toBe(true);
    expect(assessDefinitionReadiness(definition, [{ ...verifiedField, numericEvidenceStatus: "missing" }]).ready).toBe(false);
    expect(assessDefinitionReadiness(definition, []).blockers[0]).toContain("缺少依赖字段");
  });

  it("preserves real one-piece sets and exact lookup without invented intermediate levels", () => {
    const onePiece = artifactSetCatalog.filter((set) => set.pieceEffects.length === 1 && set.pieceEffects[0]?.pieces === 1);
    expect(onePiece).toHaveLength(4);
    expect(onePiece.every((set) => set.slots.length === 1 && set.slots[0]?.slot === "circlet")).toBe(true);
    expect(getExactStatCurve("weapons", 1, "GROW_CURVE_ATTACK_101")).toBe(1);
    expect(() => getExactStatCurve("weapons", 1.5, "GROW_CURVE_ATTACK_101")).toThrow(/整数/);
    expect(() => getExactStatCurve("weapons", 101, "GROW_CURVE_ATTACK_101")).toThrow(/缺少/);
  });

  it("exposes only curated classified Durin damage parameters, not energy or cooldown numbers", () => {
    const hits = getClassifiedCharacterHits("character:10000123", 10).filter((hit) => hit.coefficientField.startsWith("talent-set:durin.combat2."));
    expect(hits).toHaveLength(4);
    expect(hits[0]?.coefficient).toBe(1.9008);
    expect(hits.map((hit) => hit.coefficientField)).toEqual([1, 2, 3, 4].map((n) => `talent-set:durin.combat2.parameters.param${n}[9]`));
    // Later character batches append their own revisions after Durin's revision.
    expect(hits.every((hit) => hit.resultStatus === "provisional-conditioned" && hit.mappingVersion.split("+").includes("durin.8"))).toBe(true);
    expect(getClassifiedCharacterHits("unknown")).toEqual([]);
    expect(() => getClassifiedCharacterHits("character:10000123", 16)).toThrow(/缺少/);
  });

  it("does not declare the imported roster its own complete verified inventory", () => {
    expect(updateStatus.activeCatalog?.snapshotId).toBe(runtimeDatasetMetadata.snapshotId);
    expect(gameDataRuntimeIndex.catalogVersion).toBe(gameDataCatalog.catalogVersion);
    expect(updateStatus.coverage.catalog).toMatchObject({ characters: gameDataCatalog.characters.length, weapons: gameDataCatalog.weapons.length, artifactSets: artifactSetCatalog.length });
    expect(updateStatus.coverage.expectedInventory?.independentOfImportedData).toBe(true);
    expect(updateStatus.coverage.expectedInventory?.sourceId).not.toBe(gameDataCatalog.sources[0]?.id);
    expect(updateStatus.coverage.inventoryValidation.categories?.weapons?.completeness).toBe("partial");
    expect(updateStatus.activeVerifiedDataset).toBeNull();
    expect(updateStatus.previewSnapshots.map(snapshot => snapshot.gameVersion)).toEqual(["7.1.50", "7.1.50.2"]);
    for (const snapshot of updateStatus.previewSnapshots) {
      expect(snapshot.releaseStatus).toBe("preview");
      expect(snapshot.snapshotId).not.toBe(updateStatus.activeCatalog?.snapshotId);
      expect(snapshot.snapshotId).not.toBe(runtimeDatasetMetadata.snapshotId);
    }
  });
});

describe("immutable update pipeline", () => {
  it("atomically promotes verified released candidates, retains history and rolls back", () => {
    const dir = store(); const a = syncFixture(dir, "released"); const b = syncFixture(dir, "released", "2");
    expect(run(dir, "promote", "--id", a).activeVerifiedSnapshotId).toBe(a);
    expect(run(dir, "promote", "--id", b).previousVerifiedSnapshotIds).toEqual([a]);
    expect(run(dir, "rollback").activeVerifiedSnapshotId).toBe(a);
    expect(readdirSync(resolve(dir, "snapshots"))).toHaveLength(2);
  });

  it("activates released unverified catalogs across all runtime consumers and can roll back", () => {
    const dir = store(); const a = syncFixture(dir, "released", "1", false); const b = syncFixture(dir, "released", "2", false);
    run(dir, "activate", "--id", a);
    const pointers = run(dir, "activate", "--id", b);
    expect(pointers.activeVerifiedSnapshotId).toBeNull();
    expect(pointers.activeCatalogSnapshotId).toBe(b);
    const selector = readFileSync(resolve(dir, "runtime/current.ts"), "utf8");
    for (const file of ["catalog.json", "catalog-index.json", "supplemental.json", "metadata.json"]) expect(selector).toContain(`${b}/${file}`);
    const preview = syncFixture(dir, "preview", "3", false);
    expect(failed(dir, "activate", "--id", preview)).toContain("Only released");
    expect(run(dir, "rollback", "--catalog").activeCatalogSnapshotId).toBe(a);
    expect(readFileSync(resolve(dir, "runtime/current.ts"), "utf8")).toContain(`${a}/catalog.json`);
  });

  it("isolates preview workspaces and refuses preview or official-next promotion", () => {
    const dir = store(); const released = syncFixture(dir, "released"); run(dir, "promote", "--id", released);
    const releasedMetadataPath = resolve(dir, "runtime/datasets", released, "metadata.json");
    const releasedMetadataBytes = readFileSync(releasedMetadataPath, "utf8");
    const preview = syncFixture(dir, "preview", "2"); const next = syncFixture(dir, "official-next", "3");
    expect(failed(dir, "promote", "--id", preview)).toContain("Only released");
    expect(failed(dir, "promote", "--id", next)).toContain("Only released");
    const pointers = JSON.parse(readFileSync(resolve(dir, "pointers.json"), "utf8"));
    expect(pointers.activeVerifiedSnapshotId).toBe(released);
    expect(pointers.activeCatalogSnapshotId).toBe(released);
    expect(pointers.previewWorkspaceSnapshotId).toBe(preview);
    const previewDirectory = resolve(dir, "runtime/datasets", preview);
    expect(JSON.parse(readFileSync(resolve(previewDirectory, "evidence-v1.json"), "utf8")).metadata.releaseStatus).toBe("preview");
    expect(readFileSync(resolve(previewDirectory, "workspace.ts"), "utf8")).toContain("./catalog.json");
    const selector = readFileSync(resolve(dir, "runtime/current.ts"), "utf8");
    expect(selector).toContain("loadPreviewRuntimeDataset");
    expect(selector).toContain(`import("./datasets/${preview}/catalog.json")`);
    expect(selector).toContain(`${released}/catalog.json`);
    expect(readFileSync(releasedMetadataPath, "utf8")).toBe(releasedMetadataBytes);
    const newerPreview = syncFixture(dir, "preview", "4");
    const historicalSelector = readFileSync(resolve(dir, "runtime/current.ts"), "utf8");
    expect(historicalSelector).toContain(`case "${preview}"`);
    expect(historicalSelector).toContain(`case "${newerPreview}"`);
    const afterPreview = JSON.parse(readFileSync(resolve(dir, "pointers.json"), "utf8"));
    expect(afterPreview.activeCatalogSnapshotId).toBe(released);
    expect(afterPreview.activeVerifiedSnapshotId).toBe(released);
    expect(afterPreview.previewWorkspaceSnapshotId).toBe(newerPreview);
    expect(failed(dir, "preview")).toContain("actual --input");
  });

  it("rejects relevant missing evidence without damaging the active verified pointer", () => {
    const dir = store(); const good = syncFixture(dir, "released"); run(dir, "promote", "--id", good);
    const missing = syncFixture(dir, "released", "2", false);
    expect(failed(dir, "promote", "--id", missing)).toContain("No dependency-complete");
    expect(JSON.parse(readFileSync(resolve(dir, "pointers.json"), "utf8")).activeVerifiedSnapshotId).toBe(good);
  });

  it("detects mutation of immutable snapshots and produces deterministic diffs", () => {
    const dir = store(); const a = syncFixture(dir, "released"); const b = syncFixture(dir, "preview", "2");
    expect(run(dir, "diff", "--from", a, "--to", b).release).toEqual({ from: "released", to: "preview" });
    const path = resolve(dir, "snapshots", `${a}.json.gz`);
    const data = snapshotSchema.parse(JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")));
    data.label = "tampered";
    writeFileSync(path, gzipSync(JSON.stringify(data)));
    expect(failed(dir, "validate", "--id", a)).toContain("hash mismatch");
  });
});
