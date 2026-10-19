import { z } from "zod";

export const releaseStatusSchema = z.enum(["released", "official-next", "preview", "unknown"]);
export const processingStatusSchema = z.enum(["raw", "parsed", "classified"]);
export const numericEvidenceStatusSchema = z.enum(["missing", "unchecked", "cross-checked", "verified"]);
export const mechanicEvidenceStatusSchema = z.enum(["missing", "partial", "verified"]);
export const calculationScopeSchema = z.enum(["hitCalculation", "skillCalculation", "sequenceSimulation", "teamSimulation"]);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const nonempty = z.string().min(1);

export const updateSourceSchema = z.object({
  id: nonempty,
  url: z.string().url(),
  revision: nonempty,
  retrievedAt: z.string().datetime(),
  gameVersion: nonempty,
  contentSha256: sha256.nullable(),
  license: nonempty,
  verificationMethod: nonempty,
  evidenceRef: z.string().optional()
}).strict();

export const fieldAssessmentSchema = z.object({
  id: nonempty,
  entityId: nonempty,
  path: nonempty,
  processingStatus: processingStatusSchema,
  numericEvidenceStatus: numericEvidenceStatusSchema,
  mechanicEvidenceStatus: mechanicEvidenceStatusSchema,
  sourceIds: z.array(nonempty),
  sourceMapping: nonempty,
  testRefs: z.array(nonempty),
  rejectionReasons: z.array(nonempty),
  conflicts: z.array(nonempty)
}).strict();

export const supportedDefinitionSchema = z.object({
  id: nonempty,
  entityId: nonempty,
  scope: calculationScopeSchema,
  dependencyFieldIds: z.array(nonempty).min(1),
  implementationRef: nonempty,
  testRefs: z.array(nonempty).min(1)
}).strict();

const catalogRecord = z.object({ id: nonempty }).passthrough();
const supplementSchema = z.object({
  artifactSets: z.array(catalogRecord),
  constellationSets: z.array(catalogRecord),
  statCurves: z.object({ characters: z.record(z.string(), z.unknown()), weapons: z.record(z.string(), z.unknown()) }).strict()
}).strict();

export const expectedInventorySchema = z.object({
  sourceId: nonempty,
  sourceIds: z.array(nonempty).optional(),
  independentOfImportedData: z.literal(true),
  characterIds: z.array(nonempty),
  weaponIds: z.array(nonempty),
  artifactSetIds: z.array(nonempty),
  completeness: z.object({ characters: z.enum(["complete", "partial", "unknown"]), weapons: z.enum(["complete", "partial", "unknown"]), artifactSets: z.enum(["complete", "partial", "unknown"]) }).optional(),
  identityPolicy: z.string().optional(),
  evidenceRef: z.string().optional()
}).strict();

export const updateBundleSchema = z.object({
  catalog: z.object({
    schemaVersion: z.literal("1.0.0"),
    catalogVersion: nonempty,
    gamePatch: nonempty,
    characters: z.array(catalogRecord),
    talentSets: z.array(catalogRecord.extend({ abilities: z.array(catalogRecord.extend({ parameters: z.record(z.string(), z.array(z.number().finite())) }).passthrough()) }).passthrough()),
    weapons: z.array(catalogRecord),
    enkaCharacterMappings: z.array(catalogRecord)
  }).passthrough(),
  supplemental: supplementSchema
}).strict();

export const snapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().regex(/^snapshot-[a-f0-9]{64}$/),
  gameVersion: nonempty,
  label: nonempty,
  releaseStatus: releaseStatusSchema,
  createdAt: z.string().datetime(),
  supersedes: z.string().nullable(),
  contentSha256: sha256,
  sources: z.array(updateSourceSchema).min(1),
  data: updateBundleSchema,
  fields: z.array(fieldAssessmentSchema),
  definitions: z.array(supportedDefinitionSchema),
  expectedInventory: expectedInventorySchema.nullable()
}).strict();

export const updatePointersSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  activeCatalogSnapshotId: z.string().nullable(),
  previousCatalogSnapshotIds: z.array(nonempty).default([]),
  activeVerifiedSnapshotId: z.string().nullable(),
  previousVerifiedSnapshotIds: z.array(nonempty),
  previewWorkspaceSnapshotId: z.string().nullable(),
  archivedSnapshotIds: z.array(nonempty)
}).strict();

export interface RuntimeDatasetMetadata {
  snapshotId: string;
  catalogVersion: string;
  gameVersion: string;
  releaseStatus: z.infer<typeof releaseStatusSchema>;
  contentSha256: string;
  numericEvidenceStatus: z.infer<typeof numericEvidenceStatusSchema>;
  mechanicEvidenceStatus: z.infer<typeof mechanicEvidenceStatusSchema>;
  sourceIds: string[];
}

export const runtimeDatasetMetadataSchema = z.object({
  snapshotId: z.string().regex(/^snapshot-[a-f0-9]{64}$/),
  catalogVersion: nonempty,
  gameVersion: nonempty,
  releaseStatus: releaseStatusSchema,
  contentSha256: sha256,
  numericEvidenceStatus: numericEvidenceStatusSchema,
  mechanicEvidenceStatus: mechanicEvidenceStatusSchema,
  sourceIds: z.array(nonempty)
}).strict();

export type DataSnapshot = z.infer<typeof snapshotSchema>;
export type FieldAssessment = z.infer<typeof fieldAssessmentSchema>;
export type SupportedDefinition = z.infer<typeof supportedDefinitionSchema>;

/** Snapshot-wide summaries must not be used as per-action eligibility gates. */
export function aggregateRuntimeEvidence(fields: readonly FieldAssessment[]): Pick<RuntimeDatasetMetadata, "numericEvidenceStatus" | "mechanicEvidenceStatus"> {
  const numericOrder = ["missing", "unchecked", "cross-checked", "verified"] as const;
  const numericEvidenceStatus = numericOrder.find((status) => fields.some((field) => field.numericEvidenceStatus === status)) ?? "missing";
  const mechanicEvidenceStatus = fields.length > 0 && fields.every((field) => field.mechanicEvidenceStatus === "verified")
    ? "verified" : fields.some((field) => field.mechanicEvidenceStatus !== "missing") ? "partial" : "missing";
  return { numericEvidenceStatus, mechanicEvidenceStatus };
}

export function createRuntimeEvidence(snapshot: DataSnapshot) {
  return {
    schemaVersion: "1.0.0" as const, snapshotId: snapshot.id,
    metadata: {
      snapshotId: snapshot.id, catalogVersion: snapshot.data.catalog.catalogVersion,
      gameVersion: snapshot.gameVersion, releaseStatus: snapshot.releaseStatus,
      contentSha256: snapshot.contentSha256, ...aggregateRuntimeEvidence(snapshot.fields),
      sourceIds: snapshot.sources.map((source) => source.id)
    },
    fields: snapshot.fields, definitions: snapshot.definitions, sources: snapshot.sources
  };
}

/** Readiness is dependency scoped. An unrelated missing Burst never blocks a
 * verified normal hit; a missing coefficient for that hit always does. */
export function assessDefinitionReadiness(definition: SupportedDefinition, fields: readonly FieldAssessment[]) {
  const map = new Map(fields.map((field) => [field.id, field]));
  const blockers = definition.dependencyFieldIds.flatMap((id) => {
    const field = map.get(id);
    if (!field) return [`缺少依赖字段 ${id}`];
    const reasons: string[] = [];
    if (field.numericEvidenceStatus !== "verified") reasons.push(`${id}: 数值证据 ${field.numericEvidenceStatus}`);
    if (field.mechanicEvidenceStatus !== "verified") reasons.push(`${id}: 机制证据 ${field.mechanicEvidenceStatus}`);
    if (field.processingStatus !== "classified") reasons.push(`${id}: 尚未完成语义分类`);
    if (field.sourceIds.length === 0 || field.testRefs.length === 0) reasons.push(`${id}: 缺少来源或测试记录`);
    reasons.push(...field.rejectionReasons, ...field.conflicts);
    return reasons;
  });
  return { ready: blockers.length === 0, blockers };
}
