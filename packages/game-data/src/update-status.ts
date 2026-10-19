import { z } from "zod";
import rawStatus from "./generated/update-status.json";
import { releaseStatusSchema, processingStatusSchema, numericEvidenceStatusSchema, mechanicEvidenceStatusSchema, expectedInventorySchema } from "./update-schema";

const snapshotSummary = z.object({ snapshotId: z.string(), gameVersion: z.string(), label: z.string(), releaseStatus: releaseStatusSchema, createdAt: z.string() });
const counts = z.object({ characters: z.number(), talentSets: z.number(), abilities: z.number(), weapons: z.number(), artifactSets: z.number(), constellationSets: z.number() });
const composableSourceCoverage = z.object({
  schemaVersion: z.literal("1.0.0"), datasetId: z.string(), sourceCatalogSnapshotId: z.string(), sourceCatalogSha256: z.string(),
  registryVersion: z.string(), scope: z.literal("composable-source-ability-definitions"), countUnit: z.string(),
  registeredActions: z.number(), executableCharacters: z.number(), executableActions: z.number(), executableHitDefinitions: z.number(),
  sourceOnlyActions: z.number(), sourceOnlyHitDefinitions: z.number(), formallyVerifiedActions: z.number(),
}).passthrough();
const failureEntry = z.object({ at: z.string(), stage: z.string(), error: z.string(), url: z.string().optional(), httpStatus: z.number().nullable().optional(), contentSha256: z.string().optional() }).passthrough();
const sourceDiscovery = z.object({
  attemptedAt: z.string(), status: z.enum(["success", "partial", "failed", "no-sources", "unknown"]), stage: z.literal("source-discovery"),
  failureCount: z.number().int().nonnegative(), error: z.string().optional(),
  results: z.array(z.object({ url: z.string(), retrievedAt: z.string(), httpStatus: z.number().nullable().optional(), contentSha256: z.string().optional(), bytes: z.number().optional(), error: z.string().optional(), note: z.string().optional() }).passthrough()),
});
const candidateReview = z.object({
  schemaVersion: z.literal("data-candidate-run-v1"), attemptedAt: z.string(), completedAt: z.string(),
  status: z.enum(["ready", "blocked", "failed"]), stage: z.string(), candidateId: z.string().nullable(),
  sourceCommit: z.string().nullable(), sourceProjectionSha256: z.string().nullable(), candidateManifestPath: z.string().nullable(),
  normalization: z.object({ status: z.string(), error: z.string().nullable() }),
  comparison: z.object({ status: z.string(), counts: z.record(z.string(), z.unknown()).optional() }).passthrough().nullable(),
  failureCount: z.number().int().nonnegative(), error: z.string().nullable(), partialCapturePath: z.string().nullable().optional(),
});
export const dataDiscoveryReviewSchema = z.object({
  schemaVersion: z.literal("data-discovery-review-v1"), generatedAt: z.string(),
  sourceDiscovery: sourceDiscovery.nullable(), candidateReview: candidateReview.nullable(),
  failureHistory: z.object({ count: z.number().int().nonnegative(), recent: z.array(failureEntry) }),
  projectStatusAutoUpdated: z.literal(false),
});
export type DataDiscoveryReview = z.infer<typeof dataDiscoveryReviewSchema>;
export const updateStatusSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  latestObservedOfficialRelease: z.object({ version: z.string(), observedAt: z.string(), sourceUrls: z.array(z.string()), evidenceNote: z.string() }).nullable(),
  activeVerifiedDataset: snapshotSummary.nullable(),
  activeCatalog: snapshotSummary.extend({ processingStatus: processingStatusSchema, numericEvidenceStatus: numericEvidenceStatusSchema, mechanicEvidenceStatus: mechanicEvidenceStatusSchema }).nullable(),
  officialNextCandidates: z.array(z.object({ version: z.string(), releaseStatus: releaseStatusSchema, observedAt: z.string(), scheduledMaintenanceStart: z.string().optional(), sourceUrls: z.array(z.string()), note: z.string() })),
  candidateSnapshots: z.array(snapshotSummary.extend({ counts, schemaValid: z.boolean(), numericEvidenceStatus: numericEvidenceStatusSchema, mechanicEvidenceStatus: mechanicEvidenceStatusSchema })),
  previewSnapshots: z.array(snapshotSummary),
  archivedSnapshots: z.array(snapshotSummary),
  previewWorkspaceSnapshotId: z.string().nullable(),
  lastSuccessfulSync: z.string().nullable(),
  lastAttemptedSync: z.string().nullable(),
  lastSyncStatus: z.string(),
  lastSyncError: z.string().nullable().optional(),
  sourceDiscovery: sourceDiscovery.nullable().optional(),
  candidateReview: candidateReview.nullable().optional(),
  failureHistory: z.object({ count: z.number().int().nonnegative(), recent: z.array(failureEntry) }).optional(),
  supplementalSources: z.array(z.object({ id: z.string(), sourceCommit: z.string(), retrievedAt: z.string(), gameVersion: z.string(), releaseStatus: releaseStatusSchema, numericEvidenceStatus: numericEvidenceStatusSchema, files: z.number(), hashesValid: z.boolean(), errors: z.array(z.string()) })).optional(),
  coverage: z.object({
    catalog: counts.nullable(), schemaValid: counts.nullable(),
    numericallyVerified: z.number(), mechanicsVerified: z.number(), countUnit: z.string(),
    hitReady: z.number(), skillReady: z.number(), sequenceReady: z.number(), teamReady: z.number(),
    conditionalCharacterSupport: z.object({ datasetId: z.string(), mappingVersion: z.string(), charactersWithHits: z.number(), classifiedHits: z.number(), completeActions: z.number(), partialActions: z.number(), blockedMappings: z.number() }).passthrough().nullable().optional(),
    conditionalEquipmentSupport: z.object({ datasetId: z.string(), weaponDefinitions: z.number(), refinementVariants: z.number(), twoPieceArtifactDefinitions: z.number(), fourPieceArtifactDefinitions: z.number() }).passthrough().nullable().optional(),
    composableSourceSupport: composableSourceCoverage.nullable().optional(),
    previewComposableSourceSupport: composableSourceCoverage.nullable().optional(),
    provisionalClassifiedHits: z.number(), executableWeaponDefinitions: z.number(), executableArtifactDefinitions: z.number(),
    expectedInventory: expectedInventorySchema.nullable(),
    inventoryValidation: z.object({ status: z.string(), missing: z.array(z.string()).nullable(), unexpected: z.array(z.string()).nullable(), categories: z.record(z.string(), z.object({ status: z.string(), completeness: z.string(), expectedCount: z.number(), observedCount: z.number(), missing: z.array(z.string()), unexpected: z.array(z.string()) })).optional() }),
    assessedFields: z.number(), missingFields: z.number()
  }),
  blockers: z.array(z.string())
});
export type UpdateStatus = z.infer<typeof updateStatusSchema>;
export const updateStatus: UpdateStatus = updateStatusSchema.parse(rawStatus);
