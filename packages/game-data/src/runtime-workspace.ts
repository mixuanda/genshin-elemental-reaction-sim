import {
  gameDataRuntimeIndexSchema, migrateGameDataCatalog,
  type GameDataCatalog, type GameDataRuntimeIndex
} from "@genshin-dps-lab/schemas";
import {
  activeCatalogData, activeCatalogIndexData, activeSupplementalData
} from "../manifests/runtime/current";
import {
  loadPreviewRuntimeDataset, previewRuntimeDatasetMetadata,
  runtimeDatasetMetadata, runtimeEvidence, runtimeSelection
} from "./runtime-metadata";
import { runtimeEvidenceSchema, type RuntimeEvidence, type RuntimeSelection } from "./runtime-evidence";
import {
  runtimeDatasetMetadataSchema, updateBundleSchema, updatePointersSchema,
  type RuntimeDatasetMetadata
} from "./update-schema";

const supplementalSchema = updateBundleSchema.shape.supplemental;
export type RuntimeSupplemental = ReturnType<typeof supplementalSchema.parse>;
export const availablePreviewDatasets: readonly RuntimeDatasetMetadata[] = previewRuntimeDatasetMetadata;

/** A workspace is an explicit data source, never a replacement of the released
 * catalog's module-level maps. Its channel is distinct from source releaseStatus. */
export interface RuntimeWorkspace {
  readonly channel: "released" | "preview";
  readonly catalog: GameDataCatalog;
  readonly index: GameDataRuntimeIndex;
  readonly supplemental: RuntimeSupplemental;
  readonly metadata: RuntimeDatasetMetadata;
  readonly evidence: RuntimeEvidence;
  readonly selection: RuntimeSelection;
}

interface WorkspacePayload {
  catalog: unknown;
  index: unknown;
  supplemental: unknown;
  metadata: unknown;
  evidence: unknown;
  selection: unknown;
}

function assertWorkspaceIdentity(workspace: RuntimeWorkspace): void {
  const { catalog, index, metadata, evidence, selection, channel } = workspace;
  const selectedId = channel === "preview" ? selection.previewWorkspaceSnapshotId : selection.activeCatalogSnapshotId;
  if (!selectedId || metadata.snapshotId !== selectedId || evidence.snapshotId !== selectedId
    || evidence.metadata.contentSha256 !== metadata.contentSha256
    || evidence.metadata.catalogVersion !== metadata.catalogVersion
    || evidence.metadata.gameVersion !== metadata.gameVersion
    || evidence.metadata.releaseStatus !== metadata.releaseStatus
    || catalog.catalogVersion !== metadata.catalogVersion || index.catalogVersion !== metadata.catalogVersion
    || catalog.gamePatch !== metadata.gameVersion || index.gamePatch !== metadata.gameVersion) {
    throw new Error("数据工作区的快照、目录、索引与证据身份不一致。");
  }
  if (channel === "released" && metadata.releaseStatus !== "released") {
    throw new Error("默认已发布工作区不能加载预览或发布状态未知的数据。");
  }
  for (const kind of ["characters", "talentSets", "weapons", "enkaCharacterMappings"] as const) {
    if (catalog.counts[kind] !== catalog[kind].length || index.counts[kind] !== index[kind].length
      || catalog[kind].length !== index[kind].length) {
      throw new Error(`数据工作区 ${kind} 的目录与索引数量不一致。`);
    }
  }
  for (const kind of ["characters", "talentSets", "weapons"] as const) {
    const catalogIds = new Set(catalog[kind].map((entry) => entry.id));
    if (catalogIds.size !== catalog[kind].length || index[kind].some((entry) => !catalogIds.has(entry.id))) {
      throw new Error(`数据工作区 ${kind} 的目录与索引标识不一致。`);
    }
  }
  const abilityCount = catalog.talentSets.reduce((count, entry) => count + entry.abilities.length, 0);
  if (index.counts.abilities !== abilityCount
    || index.talentSets.reduce((count, entry) => count + entry.abilities.length, 0) !== abilityCount) {
    throw new Error("数据工作区的技能目录与索引数量不一致。");
  }
}

function parseWorkspace(raw: WorkspacePayload, channel: RuntimeWorkspace["channel"]): RuntimeWorkspace {
  const workspace: RuntimeWorkspace = {
    channel,
    catalog: migrateGameDataCatalog(raw.catalog),
    index: gameDataRuntimeIndexSchema.parse(raw.index),
    supplemental: supplementalSchema.parse(raw.supplemental),
    metadata: runtimeDatasetMetadataSchema.parse(raw.metadata),
    evidence: runtimeEvidenceSchema.parse(raw.evidence),
    selection: updatePointersSchema.parse(raw.selection)
  };
  assertWorkspaceIdentity(workspace);
  return Object.freeze(workspace);
}

export const releasedRuntimeWorkspace: RuntimeWorkspace = parseWorkspace({
  catalog: activeCatalogData,
  index: activeCatalogIndexData,
  supplemental: activeSupplementalData,
  metadata: runtimeDatasetMetadata,
  evidence: runtimeEvidence,
  selection: runtimeSelection
}, "released");

/** Validate a materialized preview. This does not promote evidence or rewrite
 * source releaseStatus, including when a released snapshot is inspected here. */
export function parsePreviewWorkspace(raw: WorkspacePayload): RuntimeWorkspace {
  return parseWorkspace(raw, "preview");
}

/** A saved preview ID can be selected locally without changing global pointers. */
export async function loadPreviewWorkspace(snapshotId?: string): Promise<RuntimeWorkspace | null> {
  const raw = await loadPreviewRuntimeDataset(snapshotId);
  return raw === null ? null : parsePreviewWorkspace(raw);
}

export interface PreviewWorkspaceChange {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
  numericDelta?: number;
}

export interface PreviewWorkspaceComparison {
  from: { metadata: RuntimeDatasetMetadata; sources: RuntimeEvidence["sources"] };
  to: { metadata: RuntimeDatasetMetadata; sources: RuntimeEvidence["sources"] };
  changes: PreviewWorkspaceChange[];
}

const excludedContentKeys = new Set(["provenance", "generatedAt", "verifiedAt", "sourceVersion", "sourceMapping", "sourceId", "sourceIds"]);
function content(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(content);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !excludedContentKeys.has(key))
      .map(([key, entry]) => [key, content(entry)]));
  }
  return value;
}
function keyed<T>(rows: readonly T[], identity: (row: T) => string): Record<string, unknown> {
  return Object.fromEntries(rows.map((row) => [identity(row), content(row)]));
}
function comparisonContent(bundle: ReturnType<typeof updateBundleSchema.parse>) {
  const { catalog, supplemental } = bundle;
  return {
    catalog: {
      characters: keyed(catalog.characters, (row) => row.id),
      talentSets: Object.fromEntries(catalog.talentSets.map((row) => [row.id, {
        ...(content(row) as Record<string, unknown>),
        abilities: keyed(row.abilities, (ability) => ability.id)
      }])),
      weapons: keyed(catalog.weapons, (row) => row.id),
      enkaCharacterMappings: keyed(catalog.enkaCharacterMappings, (row) => row.id)
    },
    supplemental: {
      artifactSets: keyed(supplemental.artifactSets, (row) => row.id),
      constellationSets: keyed(supplemental.constellationSets, (row) => row.id),
      statCurves: content(supplemental.statCurves)
    }
  };
}
function objectEntries(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function pointer(base: string, key: string): string {
  return `${base}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}
function appendChange(changes: PreviewWorkspaceChange[], path: string, kind: PreviewWorkspaceChange["kind"], before?: unknown, after?: unknown) {
  const change: PreviewWorkspaceChange = { path, kind };
  if (kind !== "added") change.before = before;
  if (kind !== "removed") change.after = after;
  if (kind === "changed" && typeof before === "number" && typeof after === "number") change.numericDelta = after - before;
  changes.push(change);
}
function descendPresence(changes: PreviewWorkspaceChange[], path: string, kind: "added" | "removed", value: unknown) {
  const object = objectEntries(value);
  if (object && Object.keys(object).length) {
    for (const key of Object.keys(object).sort()) descendPresence(changes, pointer(path, key), kind, object[key]);
  } else if (Array.isArray(value) && value.length) {
    value.forEach((entry, index) => descendPresence(changes, pointer(path, String(index)), kind, entry));
  } else appendChange(changes, path, kind, kind === "removed" ? value : undefined, kind === "added" ? value : undefined);
}
function compareValues(changes: PreviewWorkspaceChange[], path: string, before: unknown, after: unknown) {
  const left = objectEntries(before);
  const right = objectEntries(after);
  if (left && right) {
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      const nextPath = pointer(path, key);
      if (!(key in left)) descendPresence(changes, nextPath, "added", right[key]);
      else if (!(key in right)) descendPresence(changes, nextPath, "removed", left[key]);
      else compareValues(changes, nextPath, left[key], right[key]);
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    for (let index = 0; index < Math.max(before.length, after.length); index++) {
      const nextPath = pointer(path, String(index));
      if (index >= before.length) descendPresence(changes, nextPath, "added", after[index]);
      else if (index >= after.length) descendPresence(changes, nextPath, "removed", before[index]);
      else compareValues(changes, nextPath, before[index], after[index]);
    }
  } else if (!Object.is(before, after)) appendChange(changes, path, "changed", before, after);
}

/** Content changes omit retrieval/provenance noise. Source hashes and dataset
 * status remain visible in the separate identity records. */
export async function comparePreviewWorkspaces(from: string, to: string): Promise<PreviewWorkspaceComparison> {
  const [rawLeft, rawRight] = await Promise.all([loadPreviewRuntimeDataset(from), loadPreviewRuntimeDataset(to)]);
  if (!rawLeft || !rawRight) throw new Error("Both preview snapshots must be persisted and selectable.");
  // The calculator's migrated catalog intentionally has a narrower schema.
  // Compare the validated saved content so unmapped source fields remain visible.
  const left = parsePreviewWorkspace(rawLeft);
  const right = parsePreviewWorkspace(rawRight);
  const leftBundle = updateBundleSchema.parse({ catalog: rawLeft.catalog, supplemental: rawLeft.supplemental });
  const rightBundle = updateBundleSchema.parse({ catalog: rawRight.catalog, supplemental: rawRight.supplemental });
  const changes: PreviewWorkspaceChange[] = [];
  compareValues(changes, "", comparisonContent(leftBundle), comparisonContent(rightBundle));
  return {
    from: { metadata: left.metadata, sources: left.evidence.sources },
    to: { metadata: right.metadata, sources: right.evidence.sources },
    changes
  };
}
