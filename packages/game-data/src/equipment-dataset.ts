import { z } from "zod";
import { gameDataCatalog } from "./catalog";
import { artifactSetCatalog, exactStatCurves } from "./supplemental";
import { runtimeDatasetMetadata } from "./runtime-metadata";
import type { RuntimeWorkspace } from "./runtime-workspace";

/** Explicit source injection; omission alone selects the released defaults. */
export type EquipmentDataset = Pick<RuntimeWorkspace, "catalog" | "supplemental" | "metadata" | "channel">;
export const equipmentCatalog = (dataset?: EquipmentDataset) => dataset ? dataset.catalog : gameDataCatalog;

const artifactSetSchema = z.object({
  id: z.string().min(1), slug: z.string().min(1), name: z.string().min(1),
  rarityList: z.array(z.number().int().min(1).max(5)).min(1),
  slots: z.array(z.object({ slot: z.string().min(1) }).passthrough()),
  pieceEffects: z.array(z.object({ pieces: z.number().int().positive(), description: z.string() }).passthrough())
}).passthrough();
export type EquipmentArtifactSet = z.infer<typeof artifactSetSchema>;

/** Malformed unrelated sets do not block a different set or a zero-artifact build.
 * A selected missing/invalid set is rejected explicitly by the resolver. */
export function equipmentArtifactSets(dataset?: EquipmentDataset): EquipmentArtifactSet[] {
  return (dataset ? dataset.supplemental.artifactSets : artifactSetCatalog).flatMap(record => {
    const parsed = artifactSetSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
}
export function requireEquipmentArtifactSet(setId: string, dataset?: EquipmentDataset): EquipmentArtifactSet {
  const raw = (dataset ? dataset.supplemental.artifactSets : artifactSetCatalog).find(set => set.id === setId);
  if (!raw) throw new Error(`当前工作区未收录圣遗物套装 ${setId}；不从正式目录补齐。`);
  const parsed = artifactSetSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`圣遗物 ${setId} 缺少本次推导所需目录字段：${parsed.error.issues.map(issue => issue.path.join(".")).join("、")}。`);
  return parsed.data;
}

export function equipmentDatasetSource(dataset?: EquipmentDataset) {
  const catalog = equipmentCatalog(dataset), metadata = dataset?.metadata ?? runtimeDatasetMetadata;
  const source = catalog.sources.find(entry => entry.id === "genshin-db");
  if (!source) throw new Error("当前装备工作区缺少 genshin-db 来源身份；不能借用正式来源。");
  return {
    snapshotId: metadata.snapshotId, catalogVersion: metadata.catalogVersion,
    gameVersion: metadata.gameVersion, releaseStatus: metadata.releaseStatus,
    sourceVersion: source.version, sourceCommit: source.commit, sourceSha256: source.contentSha256,
    generatedAt: catalog.generatedAt, root: `${source.url}/blob/${source.commit}`
  };
}
export function equipmentStatCurve(kind: "characters" | "weapons", level: number, curveId: string, dataset?: EquipmentDataset): number {
  if (!Number.isInteger(level)) throw new Error("等级必须为整数；不得在来源等级表之间插值。");
  const curves = (dataset ? dataset.supplemental.statCurves : exactStatCurves)[kind] as Record<string, Record<string, unknown>>;
  const value = curves[String(level)]?.[curveId];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`当前工作区缺少 ${kind} 等级 ${level} 的 ${curveId} 曲线数据；不回退正式目录。`);
  return value;
}
