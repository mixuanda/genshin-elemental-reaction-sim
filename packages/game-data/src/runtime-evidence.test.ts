import { describe, expect, it } from "vitest";
import { aggregateRuntimeEvidence, assessRuntimeEvidence, createRuntimeEvidence } from "./runtime-evidence";
import { snapshotSchema, updatePointersSchema, type FieldAssessment } from "./update-schema";

describe("runtime evidence trust chain", () => {
  it("requires released promotion and complete relevant evidence while isolating preview and unrelated gaps", () => {
    // Synthetic pipeline records only: this fixture does not certify any game value.
    const verifiedField: FieldAssessment = {
      id: "fixture-hit:coefficient", entityId: "fixture-hit", path: "coefficient",
      processingStatus: "classified", numericEvidenceStatus: "verified", mechanicEvidenceStatus: "verified",
      sourceIds: ["synthetic-evidence"], sourceMapping: "fixture.coefficient",
      testRefs: ["runtime-evidence.test.ts"], rejectionReasons: [], conflicts: []
    };
    const missingBurst: FieldAssessment = {
      ...verifiedField, id: "unrelated-burst:coefficient", entityId: "unrelated-burst",
      numericEvidenceStatus: "missing", mechanicEvidenceStatus: "missing"
    };
    const snapshot = snapshotSchema.parse({
      schemaVersion: "1.0.0", id: `snapshot-${"a".repeat(64)}`, gameVersion: "synthetic-test",
      label: "Synthetic runtime evidence fixture", releaseStatus: "released",
      createdAt: "2026-09-24T00:00:00Z", supersedes: null, contentSha256: "b".repeat(64),
      sources: [{
        id: "synthetic-evidence", url: "https://example.org/synthetic-runtime-evidence",
        revision: "fixture-v1", retrievedAt: "2026-09-24T00:00:00Z", gameVersion: "synthetic-test",
        contentSha256: "c".repeat(64), license: "test-only",
        verificationMethod: "Synthetic pipeline fixture; never game data"
      }],
      data: {
        catalog: {
          schemaVersion: "1.0.0", catalogVersion: "synthetic-test-v1", gamePatch: "synthetic-test",
          characters: [], talentSets: [], weapons: [], enkaCharacterMappings: []
        },
        supplemental: { artifactSets: [], constellationSets: [], statCurves: { characters: {}, weapons: {} } }
      },
      fields: [verifiedField],
      definitions: [{
        id: "fixture-hit", entityId: "fixture-hit", scope: "hitCalculation",
        dependencyFieldIds: [verifiedField.id], implementationRef: "synthetic-fixture-only",
        testRefs: ["runtime-evidence.test.ts"]
      }],
      expectedInventory: null
    });
    const unpromoted = updatePointersSchema.parse({
      schemaVersion: "1.0.0", activeCatalogSnapshotId: snapshot.id,
      activeVerifiedSnapshotId: null, previousVerifiedSnapshotIds: [],
      previewWorkspaceSnapshotId: null, archivedSnapshotIds: []
    });
    const promoted = { ...unpromoted, activeVerifiedSnapshotId: snapshot.id };
    const hitRequest = { scope: "hitCalculation" as const, definitionIds: ["fixture-hit"] };
    const complete = createRuntimeEvidence(snapshot);

    expect(aggregateRuntimeEvidence(snapshot.fields)).toMatchObject({
      numericEvidenceStatus: "verified", mechanicEvidenceStatus: "verified"
    });
    expect(assessRuntimeEvidence(complete, unpromoted, hitRequest)).toMatchObject({
      status: "provisional", formallyPromoted: false
    });

    const partial = createRuntimeEvidence({ ...snapshot, fields: [verifiedField, missingBurst] });
    expect(aggregateRuntimeEvidence(partial.fields)).toMatchObject({
      numericEvidenceStatus: "missing", mechanicEvidenceStatus: "partial"
    });
    expect(partial.metadata).toMatchObject({
      numericEvidenceStatus: "missing", mechanicEvidenceStatus: "partial"
    });
    expect(assessRuntimeEvidence(partial, promoted, hitRequest)).toMatchObject({
      status: "verified", ready: true, formallyPromoted: true,
      definitionIds: ["fixture-hit"], dependencyFieldIds: [verifiedField.id], blockers: []
    });

    for (const request of [
      { ...hitRequest, dependencyFieldIds: ["fixture-hit:absent"] },
      { ...hitRequest, dependencyFieldIds: [missingBurst.id] },
      { ...hitRequest, definitionIds: ["absent-definition"] },
      { ...hitRequest, scope: "teamSimulation" as const }
    ]) {
      const assessment = assessRuntimeEvidence(partial, promoted, request);
      expect(assessment.status).toBe("provisional");
      expect(assessment.ready).toBe(false);
      expect(assessment.blockers.length).toBeGreaterThan(0);
    }

    const preview = createRuntimeEvidence({ ...snapshot, releaseStatus: "preview" });
    expect(assessRuntimeEvidence(preview, { ...promoted, previewWorkspaceSnapshotId: snapshot.id }, hitRequest)).toMatchObject({
      status: "provisional", formallyPromoted: false
    });
    expect(assessRuntimeEvidence(complete, promoted, { ...hitRequest, channel: "preview" })).toMatchObject({
      status: "provisional", formallyPromoted: false
    });
  });
});
