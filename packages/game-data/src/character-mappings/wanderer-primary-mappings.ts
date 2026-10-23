import type { SourceHitMapping } from "./types";
import manifest from "../../sources/wanderer-primary/manifest.json";

export const wandererPrimarySourceEvidence = manifest;
const common = {
  characterSlug: "wanderer", talentSetId: "talent-set:wanderer", element: "anemo", scalingStat: "atk",
  sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.revision,
  sourcePaths: manifest.files.map(file => file.path), numericEvidenceStatus: "single-source-extracted", coefficientTolerance: 0,
  assumptions: ["固定来源的实际所选命中；NA/E/Q有效天赋分别输入，已含命座加级，不再增加。", "火/冰吸收增益及输入已含份额按本击真实取样；水/雷吸收仍可能存在，不从队友元素推断。"],
  exclusions: ["不生成空居循环、A4风矢、随机C4吸收、能量或武器叠层日程。", "C6追加在原普攻命中后8帧重新取样；其面板不自动借用原普攻。"],
} as const;
export const wandererPrimaryMappings: SourceHitMapping[] = manifest.tables.attack.flatMap((step, stepIndex) => step.flatMap((values, subIndex) => {
  const suffix = stepIndex === 2 ? `3-${subIndex + 1}` : String(stepIndex + 1);
  const stepLabel = `第${stepIndex + 1}段${stepIndex === 2 ? `第${subIndex + 1}击` : ""}`;
  return [false, true].map(extra => ({
    ...common, sourcePaths: [...common.sourcePaths], assumptions: [...common.assumptions], exclusions: [...common.exclusions],
    id: `wanderer-windfavored-${extra ? "c6-" : ""}normal-${suffix}-hit`,
    skillId: `wanderer-windfavored-${extra ? "c6-" : ""}normal-${suffix}`,
    skillLabel: extra ? `空居·${stepLabel}的C6追加（独立一击）` : `空居·不生断${stepLabel}（单击）`,
    hitLabel: extra ? `C6追加·${stepLabel}` : `空居普攻·${stepLabel}`,
    abilityKey: "combat1" as const, parameterKey: `param${stepIndex === 2 ? subIndex + 3 : stepIndex + 1}`,
    attackTag: "normal" as const, sourceCoefficientValues: values,
    ...(extra ? {coefficientMultiplier: .4} : {}), completeAction: false,
  }));
}));
wandererPrimaryMappings.push(...Array.from({length: 5}, (_, index): SourceHitMapping => ({
  ...common, sourcePaths: [...common.sourcePaths], assumptions: [...common.assumptions], exclusions: [...common.exclusions],
  id: `wanderer-kyougen-hit-${index + 1}`, skillId: "wanderer-kyougen-five-hits",
  skillLabel: "狂言·式乐五番（单击／五击合计）", hitLabel: `狂言·第${index + 1}击`,
  abilityKey: "combat3", parameterKey: "param1", attackTag: "burst", sourceCoefficientValues: manifest.tables.burst, completeAction: true,
})));
