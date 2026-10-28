import evidence from "../../game-data/sources/iansan-swift-native-index-correction/correction-evidence.json";
import type { SourceHostTalentSite, SourceHostTalentTableRead } from "./source-host-talent-table";

/** Exact source identities, not a match on a final multiplier or talent number. */
export function sourceHostIansanSwiftTalentSemantics(read: SourceHostTalentTableRead, sourceCommit: string, site: SourceHostTalentSite):
  { sourceRefs: string[]; explanation: string; explanationGaps: string[] } | undefined {
  if (sourceCommit !== evidence.sourceCommit || read.tableId !== evidence.table.tableId) return undefined;
  const corrected = read.siteId === evidence.correctedSite.id;
  const legacy = read.siteId === evidence.legacySite.id;
  if (!corrected && !legacy) return undefined;
  const entry = corrected ? evidence.correctedSite : evidence.legacySite, expected = entry.definition;
  if (site.tableId !== expected.tableId || JSON.stringify(site.indexExpressions) !== JSON.stringify(expected.indexExpressions)
    || JSON.stringify(site.talentLevelIndices) !== JSON.stringify(expected.talentLevelIndices) || site.rangeSource !== undefined) {
    throw new Error("伊安珊Swift天赋读取位置与声明的新旧来源语义不一致。");
  }
  const sources = read.indexSources;
  if (corrected && sources?.length !== 1 || sources !== undefined && (sources.length !== 1
    || sources[0]!.position !== 0 || sources[0]!.kind !== expected.talentLevelIndices[0]!.kind
    || sources[0]!.constellationUnlock !== entry.constellationUnlock)) {
    throw new Error("伊安珊Swift须保留对应NA/E基础天赋与正确加级getter来源；不能将E或C3加级冒充NA回执。");
  }
  const patchRef = `source-host-patch:${evidence.patch.name}:sha256:${evidence.patch.sha256}`;
  return {sourceRefs: [corrected ? patchRef : `source-host-known-conflict:${evidence.sourceCommit}:${evidence.legacySite.id}`,
    ...(corrected ? evidence.normalConSourceContract.sourceRefs : []),
    ...evidence.sourceFiles.filter(file => file.repository === "frzyc/genshin-optimizer").map(file => file.sourceRef)],
    explanation: corrected ? `补丁138的实际新源码读取位置：${entry.meaning}` : `历史原生读取，已知未修正：${entry.meaning}`,
    explanationGaps: corrected ? [] : ["该历史Swift回执忠实验证原a7的E等级索引；此索引已知与固定Optimizer的NA绑定冲突，不代表修正后语义或游戏正确。"]};
}
