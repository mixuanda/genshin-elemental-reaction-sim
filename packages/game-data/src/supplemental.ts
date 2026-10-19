import { activeSupplementalData as supplemental } from "../manifests/runtime/current";

/** Source-preserving browsable metadata. Descriptions are not executable rules. */
export const artifactSetCatalog = supplemental.artifactSets;
export const constellationCatalog = supplemental.constellationSets;
export const exactStatCurves = supplemental.statCurves;

export function getExactStatCurve(kind: "characters" | "weapons", level: number, curveId: string): number {
  if (!Number.isInteger(level)) throw new Error("等级必须为整数；不得在精确等级表之间插值。");
  const levels = exactStatCurves[kind] as Record<string, Record<string, number>>;
  const value = levels[String(level)]?.[curveId];
  if (value === undefined) throw new Error(`缺少 ${kind} 等级 ${level} 的 ${curveId} 曲线数据。`);
  return value;
}
