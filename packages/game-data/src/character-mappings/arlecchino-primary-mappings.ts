import type { SourceHitMapping } from "./types";
import manifest from "../../sources/arlecchino-primary/manifest.json";

export const arlecchinoPrimarySourceEvidence = manifest;
const attack = manifest.coefficients.filter(row => row.sourceTable === "attack");
const masque = manifest.coefficients.find(row => row.sourceTable === "masque")!;

/** N4 has two independently sampled hits; no common debt value or automatic
 * post-hit debt consumption is assigned to those two entries. */
export const arlecchinoPrimaryMappings: SourceHitMapping[] = attack.map(row => {
  const step = row.normalStep!, subHit = row.subHit!;
  const suffix = step === 4 ? `4-hit-${subHit}` : String(step);
  const label = `红死之宴·普攻第${step}段${step === 4 ? `第${subHit}击` : ""}（单击·C0–C5）`;
  return {
    id: `arlecchino-red-death-normal-${suffix}-hit`, characterSlug: "arlecchino", talentSetId: "talent-set:arlecchino",
    abilityKey: "combat1", parameterKey: row.parameterKey,
    skillId: `arlecchino-red-death-normal-${suffix}`, skillLabel: label, hitLabel: label,
    element: "pyro", attackTag: "normal", scalingStat: "atk", sourceCoefficientValues: row.values,
    formulaParameters: [{key: "arlecchinoMasqueCoefficient", parameterKey: masque.parameterKey, sourceCoefficientValues: masque.values, coefficientTolerance: 0}],
    coefficientTolerance: 0, sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.revision,
    sourcePaths: manifest.files.map(file => file.path), numericEvidenceStatus: "single-source-extracted", completeAction: false,
    assumptions: [
      "只算C0–C5红死之宴实际火普攻的一击；有效普攻天赋已含C3加级，不再增加，不借用E/Q等级。",
      `本击在该段动作开始后${row.hitFrame}f读取实际面板和扣契前生命之契比例；契比例须至少30%。`,
      "普通ATK项与生命之契附加基伤分别计算；C1只在masque倍率上加1.0，固有40%火伤按输入已含份额核对。",
    ],
    exclusions: [
      "不模拟血偿回收、生命之契获取/消耗、普攻连段、E冷却、Q治疗或完整轮转。",
      "第四段24f与35f两击分别选择；不得把第一击扣契前比例套给第二击。",
      "不将生命之契比例未知或低于30%的输入冒充火附魔；C6普攻条件双暴未开放。",
      "C2回收爆发、C4回能/Q冷却及C5的Q等级不属于所选NA单击。",
    ],
  };
});
