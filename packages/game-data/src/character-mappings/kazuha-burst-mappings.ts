import type { SourceHitMapping } from "./types";
import manifest from "../../sources/kazuha-burst/manifest.json";

export const kazuhaBurstSourceEvidence = manifest;
const vector = (name: string) => manifest.coefficients.find(row => row.sourceTable === name)!.values;
const shared = {
  characterSlug: "kaedeharakazuha", talentSetId: "talent-set:kaedeharakazuha", abilityKey: "combat3" as const,
  element: "anemo" as const, attackTag: "burst" as const, scalingStat: "atk" as const,
  sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision,
  sourcePaths: manifest.files.map(row => row.path), coefficientTolerance: 0,
  numericEvidenceStatus: "single-source-extracted" as const,
  assumptions: [
    "C0/C1；有效Q天赋等级显式输入，固定来源15级完整向量逐值比对，不重复加命座等级。",
    "初斩在82f取样；风DoT及染色附加伤害在81f锁定进攻快照。",
  ],
  exclusions: [
    "只含本次Q直接伤害，不含扩散等反应实体、其他动作或队友伤害。",
    "元素转化不改变风伤元素；同帧染色附加先于风DoT。晚染色按首次成功吸收检查裁剪附加段。",
    "C2及更高命座未开放；A4只读取81f前已发生且仍生效的同元素扩散及其NonExtraEM。",
  ],
};

/** Complete-cast starts with its six unconditional source hits; prepare adds
 * only the absorbed hits warranted by the explicit first absorption frame. */
export const kazuhaBurstMappings: SourceHitMapping[] = [
  {...shared, id: "kazuha-burst-slash-hit", parameterKey: "param1", sourceCoefficientValues: vector("burstSlash"),
    skillId: "kazuha-burst-slash", skillLabel: "万叶之一刀·初斩", hitLabel: "初斩·82f风伤", completeAction: false},
  {...shared, id: "kazuha-burst-anemo-dot-hit", parameterKey: "param2", sourceCoefficientValues: vector("burstDot"),
    skillId: "kazuha-burst-anemo-dot", skillLabel: "万叶之一刀·单次风DoT", hitLabel: "单次风DoT·81f快照", completeAction: false},
  {...shared, id: "kazuha-burst-complete-slash", parameterKey: "param1", sourceCoefficientValues: vector("burstSlash"),
    skillId: "kazuha-burst-complete", skillLabel: "万叶之一刀·完整Q直接伤害", hitLabel: "初斩·82f风伤", completeAction: true},
  ...[140, 257, 374, 491, 608].map((frame, index): SourceHitMapping => ({
    ...shared, id: `kazuha-burst-complete-anemo-${index + 1}`, parameterKey: "param2", sourceCoefficientValues: vector("burstDot"),
    skillId: "kazuha-burst-complete", skillLabel: "万叶之一刀·完整Q直接伤害", hitLabel: `风DoT第${index + 1}次·${frame}f（81f快照）`, completeAction: true,
  })),
];
