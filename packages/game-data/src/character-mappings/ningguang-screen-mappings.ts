import type { SourceHitMapping } from "./types";
import manifest from "./ningguang-screen-source-manifest.json";
export const ningguangScreenSourceEvidence=manifest;
export const ningguangScreenMappings:SourceHitMapping[]=["body","screen"].map(group=>({
  id:`ningguang-burst-with-screen-${group}`,characterSlug:"ningguang",talentSetId:"talent-set:ningguang",abilityKey:"combat3",parameterKey:"param1",skillId:"ningguang-burst-with-screen",skillLabel:"天权崩玉·有璇玑屏十二枚（独立 E 历史快照）",hitLabel:group==="body"?"本体宝石（Q 起手快照）":"屏宝石（此前 E 快照）",attackTag:"burst",element:"geo",scalingStat:"atk",instanceCount:6,
  sourceCoefficientValues:manifest.coefficients[0]!.values,coefficientTolerance:0,sourceRepository:"genshinsim/gcsim",sourceCommit:manifest.revision,sourcePaths:Object.keys(manifest.sourceSha256).filter(path=>path.endsWith(".go")),completeAction:true,
  assumptions:["Q 起手存在可销毁的璇玑屏；六枚本体与六枚屏宝石全部命中同一稳定目标。","本体使用 Q 起手面板，屏宝石恢复此前 E 保存的独立完整数值快照，二者均使用 Q 有效天赋系数，A4 两个时点分别记账。","C0–C6；有效天赋已含命座等级，不自动再加级。缺少 E 历史快照只阻塞屏宝石，不会猜测或借用当前面板。"],
  exclusions:["C6 生成供后续重击使用的七枚星璇，不归入本次 Q 自身十二枚伤害。","来源保留屏宝石 hitmarks 和 A4 穿屏事件 TODO；不验证弹道、散射命中率、时序、能量、完整队伍轮转或游戏实测。"]
}));
