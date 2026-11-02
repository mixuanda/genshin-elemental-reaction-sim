import type { SourceHitMapping } from "./types";
import manifest from "../../sources/durin-burst/manifest.json";

export const durinBurstSourceEvidence = manifest;
export const durinBurstMappings: SourceHitMapping[] = [{
  id: "durin-white-q-tick-hit", characterSlug: "durin", talentSetId: "talent-set:durin", abilityKey: "combat3", parameterKey: "param7",
  skillId: "durin-white-q-tick", skillLabel: "白焰之龙·后台追击（单次）", hitLabel: "白焰之龙·所选一次追击",
  element: "pyro", attackTag: "burst", scalingStat: "atk", sourceCoefficientValues: manifest.tables.burstWhiteDoT, coefficientTolerance: 0,
  sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.revision, sourcePaths: manifest.files.map(file => file.path),
  numericEvidenceStatus: "single-source-extracted", completeAction: false,
  assumptions: ["C0–C2当前白Q已经发生的一次追击，使用独立有效Q天赋与该段实际面板。", "当前白Q前10次追击消耗A4强化；A4在生成追击时读取总攻击，不是普通增伤。", "C2火伤按本击此前已生效状态与输入已含份额核对；当前反应不倒灌本击。"],
  exclusions: ["不是白Q三次初始伤害或20次追击总和，不代表整轮、队伍DPS或黑Q。", "白Q的C1附伤属于其他前台队友，不加给杜林自身；敌人抗性须填本击实际火抗。", "专武增伤与实际攻击窗口由既有装备条件单独核对，不默认生效。"],
}];
