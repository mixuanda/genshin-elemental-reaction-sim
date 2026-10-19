import { describe, expect, it } from "vitest";
import { availablePreviewDatasets, comparePreviewWorkspaces, loadPreviewWorkspace, parsePreviewWorkspace, releasedRuntimeWorkspace } from "./runtime-workspace";

function syntheticWorkspace() {
  const snapshotId = `snapshot-${"a".repeat(64)}`;
  const metadata = {
    snapshotId, catalogVersion: "synthetic-workspace-v1", gameVersion: "synthetic-only",
    releaseStatus: "released", contentSha256: "b".repeat(64),
    numericEvidenceStatus: "unchecked", mechanicEvidenceStatus: "missing",
    sourceIds: ["synthetic-workspace-source"]
  };
  const counts = { characters: 0, talentSets: 0, weapons: 0, enkaCharacterMappings: 0 };
  return {
    catalog: {
      schemaVersion: "1.0.0", catalogVersion: metadata.catalogVersion,
      locale: "zh-CN", gamePatch: metadata.gameVersion, generatedAt: "2026-09-24T00:00:00Z",
      sources: [{
        id: "synthetic-workspace-source", name: "Synthetic workspace fixture only",
        url: "https://example.org/synthetic-workspace", version: "fixture-v1", commit: "fixture-v1",
        license: "test-only", contentSha256: "c".repeat(64), notes: "Does not certify game values."
      }],
      counts, characters: [], talentSets: [], weapons: [], enkaCharacterMappings: []
    },
    index: {
      schemaVersion: "1.0.0", catalogVersion: metadata.catalogVersion,
      gamePatch: metadata.gameVersion, verificationStatus: "provisional",
      counts: { ...counts, abilities: 0 }, characters: [], talentSets: [], weapons: [], enkaCharacterMappings: []
    },
    supplemental: { artifactSets: [], constellationSets: [], statCurves: { characters: {}, weapons: {} } },
    metadata,
    evidence: {
      schemaVersion: "1.0.0", snapshotId, metadata, fields: [], definitions: [],
      sources: [{
        id: "synthetic-workspace-source", url: "https://example.org/synthetic-workspace",
        revision: "fixture-v1", retrievedAt: "2026-09-24T00:00:00Z", gameVersion: metadata.gameVersion,
        contentSha256: "c".repeat(64), license: "test-only", verificationMethod: "Synthetic pipeline fixture only"
      }]
    },
    selection: {
      schemaVersion: "1.0.0", activeCatalogSnapshotId: releasedRuntimeWorkspace.metadata.snapshotId,
      previousCatalogSnapshotIds: [], activeVerifiedSnapshotId: null, previousVerifiedSnapshotIds: [],
      previewWorkspaceSnapshotId: snapshotId, archivedSnapshotIds: []
    }
  };
}

describe("isolated runtime workspaces", () => {
  it("selects persisted historical previews locally and compares content without changing the default", async () => {
    const previous = "snapshot-075975978341f3e8c54b32e3c2d94e8da049ec890d880c8b398f115c7c0216bc";
    const current = "snapshot-93da65025b953bdcd7918078624d11ba25f657cdf1b469f2980c70261ebe4217";
    expect(availablePreviewDatasets.map((dataset) => dataset.snapshotId)).toEqual(expect.arrayContaining([previous, current]));
    const [older, selected, defaultWorkspace] = await Promise.all([
      loadPreviewWorkspace(previous), loadPreviewWorkspace(current), loadPreviewWorkspace()
    ]);
    expect(older?.selection.previewWorkspaceSnapshotId).toBe(previous);
    expect(selected?.selection.previewWorkspaceSnapshotId).toBe(current);
    expect(defaultWorkspace?.metadata.snapshotId).toBe(current);
    expect(releasedRuntimeWorkspace.metadata.snapshotId).toBe(releasedRuntimeWorkspace.selection.activeCatalogSnapshotId);
    await expect(loadPreviewWorkspace("snapshot-" + "0".repeat(64))).rejects.toThrow(/Unknown persisted preview snapshot/);

    const diff = await comparePreviewWorkspaces(previous, current);
    expect(diff.from.metadata.snapshotId).toBe(previous);
    expect(diff.to.metadata.snapshotId).toBe(current);
    expect(diff.changes.some((change) => change.path.includes("sourceCombatMetadata") && change.kind === "added")).toBe(true);
    expect(diff.changes.every((change) => change.numericDelta === undefined
      || (typeof change.before === "number" && typeof change.after === "number"))).toBe(true);
  });

  it("parses only matching selected preview data, preserves source status and never replaces released data", () => {
    // These deliberately empty synthetic catalogs exercise isolation and identity,
    // not character mechanics or source verification.
    const releasedCatalog = releasedRuntimeWorkspace.catalog;
    const releasedId = releasedRuntimeWorkspace.metadata.snapshotId;
    const raw = syntheticWorkspace();
    const preview = parsePreviewWorkspace(raw);
    expect(preview).toMatchObject({
      channel: "preview", metadata: { releaseStatus: "released", snapshotId: raw.metadata.snapshotId },
      catalog: { catalogVersion: raw.catalog.catalogVersion }
    });
    expect(preview.catalog).not.toBe(releasedCatalog);
    expect(releasedRuntimeWorkspace.catalog).toBe(releasedCatalog);
    expect(releasedRuntimeWorkspace.metadata.snapshotId).toBe(releasedId);
    expect(releasedRuntimeWorkspace.channel).toBe("released");

    expect(() => parsePreviewWorkspace({ ...raw, selection: { ...raw.selection, previewWorkspaceSnapshotId: null } })).toThrow(/身份不一致/);
    expect(() => parsePreviewWorkspace({ ...raw, metadata: { ...raw.metadata, contentSha256: "d".repeat(64) } })).toThrow(/身份不一致/);
    expect(() => parsePreviewWorkspace({ ...raw, index: { ...raw.index, catalogVersion: "unrelated-snapshot" } })).toThrow(/身份不一致/);
    expect(() => parsePreviewWorkspace({ ...raw, catalog: { ...raw.catalog, gamePatch: "unrelated-patch" } })).toThrow(/身份不一致/);
    expect(() => parsePreviewWorkspace({ ...raw, index: { ...raw.index, counts: { ...raw.index.counts, abilities: 1 } } })).toThrow(/技能目录与索引数量不一致/);
    expect(() => parsePreviewWorkspace({ ...raw, supplemental: { ...raw.supplemental, artifactSets: [{}] } })).toThrow();
  });
});
