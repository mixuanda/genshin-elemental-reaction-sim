import { z } from "zod";
import {
  assessDefinitionReadiness, fieldAssessmentSchema, runtimeDatasetMetadataSchema,
  supportedDefinitionSchema, updateSourceSchema,
  type SupportedDefinition, type updatePointersSchema
} from "./update-schema";
export { aggregateRuntimeEvidence, createRuntimeEvidence } from "./update-schema";

/** Immutable evidence projection. Promotion is deliberately NOT stored here:
 * it belongs to the authoritative runtime selection, not snapshot payloads or
 * calculator documents imported by a user. */
export const runtimeEvidenceSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  snapshotId: z.string().regex(/^snapshot-[a-f0-9]{64}$/),
  metadata: runtimeDatasetMetadataSchema,
  fields: z.array(fieldAssessmentSchema),
  definitions: z.array(supportedDefinitionSchema),
  sources: z.array(updateSourceSchema)
}).strict().refine((value) => value.snapshotId === value.metadata.snapshotId, "Evidence/metadata snapshot mismatch");

export type RuntimeEvidence = z.infer<typeof runtimeEvidenceSchema>;
export type RuntimeSelection = z.infer<typeof updatePointersSchema>;
export interface RuntimeEvidenceRequest {
  scope: SupportedDefinition["scope"];
  definitionIds: readonly string[];
  dependencyFieldIds?: readonly string[];
  channel?: "released" | "preview";
}

export function assessRuntimeEvidence(evidence: RuntimeEvidence, selection: RuntimeSelection, request: RuntimeEvidenceRequest) {
  const definitionIds = [...new Set(request.definitionIds)];
  const definitions = new Map(evidence.definitions.map((definition) => [definition.id, definition]));
  const fields = new Map(evidence.fields.map((field) => [field.id, field]));
  const sources = new Map(evidence.sources.map((source) => [source.id, source]));
  const blockers: string[] = [];
  const formallyPromoted = request.channel !== "preview" && evidence.metadata.releaseStatus === "released"
    && selection.activeVerifiedSnapshotId === evidence.snapshotId;
  if (!formallyPromoted) blockers.push("当前快照尚未正式晋升为已发布验证数据集；预览数据不进入 verified 通道。");
  if (evidence.snapshotId !== evidence.metadata.snapshotId) blockers.push("证据与元数据快照标识不一致。");
  if (definitionIds.length === 0) blockers.push("本次计算没有匹配的可执行验证定义。");
  const dependencyFieldIds = new Set(request.dependencyFieldIds ?? []);
  for (const id of definitionIds) {
    const definition = definitions.get(id);
    if (!definition) { blockers.push(`缺少执行定义 ${id}`); continue; }
    if (definition.scope !== request.scope) blockers.push(`${id}: 定义范围 ${definition.scope} 与请求 ${request.scope} 不匹配`);
    if (!definition.implementationRef || definition.testRefs.length === 0) blockers.push(`${id}: 缺少实现或测试记录`);
    for (const fieldId of definition.dependencyFieldIds) dependencyFieldIds.add(fieldId);
    blockers.push(...assessDefinitionReadiness(definition, evidence.fields).blockers);
  }
  // Additional dependencies (equipment, active condition or special branch)
  // use the same field checks; unrelated fields never enter this loop.
  for (const id of dependencyFieldIds) {
    const field = fields.get(id);
    if (!field) { blockers.push(`缺少依赖字段 ${id}`); continue; }
    blockers.push(...assessDefinitionReadiness({
      id, entityId: field.entityId, scope: request.scope, dependencyFieldIds: [id],
      implementationRef: "dependency-evidence", testRefs: ["dependency-evidence"]
    }, evidence.fields).blockers);
    for (const sourceId of field.sourceIds) {
      const source = sources.get(sourceId);
      if (!source) blockers.push(`${id}: 未解析来源 ${sourceId}`);
      else if (!source.contentSha256) blockers.push(`${id}: 来源 ${sourceId} 缺少不可变内容指纹`);
    }
  }
  const uniqueBlockers = [...new Set(blockers)];
  return {
    status: uniqueBlockers.length === 0 ? "verified" as const : "provisional" as const,
    ready: uniqueBlockers.length === 0, formallyPromoted,
    definitionIds, dependencyFieldIds: [...dependencyFieldIds], blockers: uniqueBlockers
  };
}
