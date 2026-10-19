import {
  runtimeDatasetMetadata as rawMetadata, runtimeEvidenceData,
  runtimeSelection as rawSelection, previewRuntimeDatasetMetadata as rawPreviewMetadata,
  loadPreviewRuntimeDataset as loadRawPreview
} from "../manifests/runtime/current";
import { runtimeDatasetMetadataSchema, updatePointersSchema, type RuntimeDatasetMetadata } from "./update-schema";
import { runtimeEvidenceSchema, type RuntimeEvidence, type RuntimeSelection } from "./runtime-evidence";

export const runtimeDatasetMetadata: RuntimeDatasetMetadata = runtimeDatasetMetadataSchema.parse(rawMetadata);
export const runtimeEvidence: RuntimeEvidence = runtimeEvidenceSchema.parse(runtimeEvidenceData);
export const runtimeSelection: RuntimeSelection = updatePointersSchema.parse(rawSelection);
export const previewRuntimeDatasetMetadata: readonly RuntimeDatasetMetadata[] = Object.freeze(
  rawPreviewMetadata.map((entry) => runtimeDatasetMetadataSchema.parse(entry))
);

export interface RuntimeDatasetWorkspace {
  channel: "preview";
  catalog: unknown;
  index: unknown;
  supplemental: unknown;
  evidence: RuntimeEvidence;
  metadata: RuntimeDatasetMetadata;
  selection: RuntimeSelection;
}

/** Preview has its own lazy-loaded catalog, supplemental data and immutable
 * evidence. Nothing from this function mutates the released singleton maps. */
export async function loadPreviewRuntimeDataset(snapshotId?: string): Promise<RuntimeDatasetWorkspace | null> {
  if (snapshotId !== undefined && !previewRuntimeDatasetMetadata.some((entry) => entry.snapshotId === snapshotId)) {
    throw new Error(`Unknown persisted preview snapshot: ${snapshotId}`);
  }
  const raw = await (loadRawPreview as (snapshotId?: string) => Promise<{
    catalog: unknown; index: unknown; supplemental: unknown;
    evidence: unknown; metadata: unknown; selection: unknown;
  } | null>)(snapshotId);
  if (!raw) return null;
  const evidence = runtimeEvidenceSchema.parse(raw.evidence);
  const metadata = runtimeDatasetMetadataSchema.parse(raw.metadata);
  const selection = updatePointersSchema.parse(raw.selection);
  if (metadata.releaseStatus !== "preview"
    || !previewRuntimeDatasetMetadata.some((entry) => entry.snapshotId === metadata.snapshotId && entry.contentSha256 === metadata.contentSha256)
    || metadata.snapshotId !== selection.previewWorkspaceSnapshotId
    || evidence.snapshotId !== metadata.snapshotId || evidence.metadata.contentSha256 !== metadata.contentSha256) {
    throw new Error("预览数据身份与隔离工作区指针不匹配。");
  }
  return { channel: "preview", catalog: raw.catalog, index: raw.index, supplemental: raw.supplemental, evidence, metadata, selection };
}
