import type { SourceHitMapping, SourceMappingBlocker } from "./types";
import manifest from "../../sources/traveler-cryo-complete/manifest.json";

/** Fixed a7dc4bf4 source; none of the older traveler evidence is overwritten. */
export const travelerCryoCompleteSourceEvidence = manifest;
const coefficient = (table: string) => manifest.coefficients.find(row => row.sourceTable === table)!;
const values = (table: string) => coefficient(table).values;
const sourcePaths = (gender: "aether" | "lumine") => Object.keys(manifest.sourceSha256).filter(path =>
  path !== "LICENSE" && (!path.includes("/traveler/cryo/") || path.includes(`/traveler/cryo/${gender}/`)));

const assumptions = [
  "仅 C0；有效天赋等级明确提供。辉映在本分支相关取样时点均为 none，true_moon_story_buff=0；这些是必须恢复的计算上下文，不从角色名字或初始示例推断。",
  "每个列出命中均独立进入同一伤害核心；实际进攻属性、装备条件及目标防御/抗性在相关取样时点保持所声明的状态，逐击反应另行明确输入。",
  "突破4的A4精通为 min(实际非Extra攻击力×0.08,160)。非Extra攻击力使用 BaseStats 与尚有效且 Extra=false 的属性修正，再按白值×(1+攻击百分比)+固定攻击计算；不可直接用最终ATK冒充。须恢复实际非ExtraATK与已含精通记账，或明确恢复已包含A4的最终精通。",
  "A1 只在星超导辉映且 E 生效时转换普通/重击/下落攻击并加0.8倍率，不给本次E冰晶或Q投矛增加0.8。其他剧情固定属性必须反映在实际面板中，不重复加入。",
];
const exclusions = [
  "本映射仅完成所选条件下本次施放的自身伤害；队友、其他动作、外部普攻及额外反应实体不并入该总和。",
  "不认证动作帧、实际命中率、冰附着/ICD、霜芒积累过程、能量、命座或完整队伍轮转。固定源男性动画仍注明沿用女性假设，不能标作游戏内时序已验证。",
  "非零辉映的Q必须使用直接星烁公式；仅给普通Q设置100%忽防并不等价。高命座与TrueMoon特殊重击没有被本C0分支覆盖。",
];

function common(gender: "aether" | "lumine", skillId: string, skillLabel: string) {
  return {
    characterSlug: gender, variantId: `${gender}-cryo`, variantName: `冰元素旅行者（${gender === "aether" ? "空" : "荧"}）`,
    talentSetId: "talent-set:travelercryo", skillId, skillLabel,
    element: "cryo" as const, scalingStat: "atk" as const,
    coefficientTolerance: 0, sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision,
    sourcePaths: sourcePaths(gender), completeAction: true, assumptions, exclusions,
  };
}

/** Every menu branch has a fixed, real hit count. The core must validate its explicit context. */
export const travelerCryoCompleteMappings: SourceHitMapping[] = (["aether", "lumine"] as const).flatMap(gender => {
  const skillId = `${gender}-cryo-skill-periodic-complete-c0`;
  const skill = common(gender, skillId, "冰雾剑·完整初击＋8枚定时冰晶（C0·无辉映）");
  const skillAssumptions = [...assumptions,
    "栗烈寒星未被新一次E替换或提前中断；没有星超导协同模式、额外延长至下一轮或丢失目标。明确本次初击和八枚定时冰晶全部命中同一目标。",
    "初击在第19帧取样；定时轮次为178、354、530、706帧，每轮按0、13帧分别取快照，默认飞行9帧。八枚冰晶不会共享初击快照；本条件输入须明确这些取样时点的属性及装备条件稳定。",
  ];
  const skillMappings: SourceHitMapping[] = [
    { ...skill, id: `${skillId}-initial`, abilityKey: "combat2", parameterKey: "param1", attackTag: "skill", hitLabel: "冰雾剑·初始命中", instanceCount: 1, sourceCoefficientValues: values("skill"), assumptions: skillAssumptions },
    { ...skill, id: `${skillId}-crystal`, abilityKey: "combat2", parameterKey: "param2", attackTag: "skill", hitLabel: "栗烈寒星·定时冰晶", instanceCount: 8, sourceCoefficientValues: values("crystal"), assumptions: skillAssumptions },
  ];
  const burstMappings: SourceHitMapping[] = (["partial", "full"] as const).map(branch => {
    const full = branch === "full", burstId = `${gender}-cryo-burst-frostglow-${branch}-complete-c0`;
    return {
      ...common(gender, burstId, `聚冰成锋·${full ? "8层寒辉·完整5击" : "0–7层寒辉·完整3击"}（C0·无辉映）`),
      id: `${burstId}-javelin`, abilityKey: "combat3", parameterKey: "param1", attackTag: "burst",
      hitLabel: "聚冰成锋·投矛", instanceCount: full ? 5 : 3, sourceCoefficientValues: values("burst"),
      formulaParameters: [{ key: "frostglowCoefficient", parameterKey: "param2", sourceCoefficientValues: values("flowGlowBonus"), coefficientTolerance: 0 }],
      assumptions: [...assumptions,
        `实际寒辉层数在Q构造攻击的第36帧读取并随后清空；本分支要求${full ? "恰为8层" : "整数0–7层"}。每击倍率为本等级Q基础倍率＋本等级每层寒辉倍率×该实际层数，不能只使用基础倍率或默认0层。`,
        "Q的所有投矛在第36帧构造时取样；默认飞行6帧，前三枚队列偏移为0、33、38，满层另有35、42。明确所有投矛命中且适用目标/反应条件正确；不按列表次序假装它们逐帧顺序相同。",
        "第36帧前到达的冰晶、多目标回调及其他动作可能改变寒辉；直接提供实际已消耗层数，不根据E命中数或按下Q时状态推算。",
      ],
    };
  });
  return [...skillMappings, ...burstMappings];
});

/** Remove these duplicate menus only after the associated typed core context is wired. */
export const replacedTravelerCryoPartialMappingIds = new Set([
  "aether-cryo-skill-initial-hit-1", "lumine-cryo-skill-initial-hit-1",
  "aether-cryo-burst-no-radiance-zero-frostglow-hit-1", "lumine-cryo-burst-no-radiance-zero-frostglow-hit-1",
]);

/** Scope is narrowed, not erased: coordinated/mixed E and Stellar Q still need implementation. */
export const supersededTravelerCryoBlockerIds = new Set([
  "aether-cryo-skill-full-blocked", "lumine-cryo-skill-full-blocked",
  "aether-cryo-burst-conditional-blocked", "lumine-cryo-burst-conditional-blocked",
]);
export const travelerCryoResidualBlockers: SourceMappingBlocker[] = (["aether", "lumine"] as const).flatMap(gender => {
  const identity = {
    characterSlug: gender, variantId: `${gender}-cryo`, variantName: `冰元素旅行者（${gender === "aether" ? "空" : "荧"}）`,
    talentSetId: "talent-set:travelercryo", parameterKey: null, sourcePaths: sourcePaths(gender), sourceCommit: manifest.revision,
    sourceRepository: "genshinsim/gcsim" as const, hitLabel: "尚未接入的条件分支",
  };
  return [
    { ...identity, id: `${gender}-cryo-skill-coordinated-mixed-blocked`, abilityKey: "combat2", skillId: `${gender}-cryo-skill-coordinated-mixed`, skillLabel: "冰雾剑·星超导协同或辉映切换",
      reason: "C0无辉映定时初击＋八晶已另有完整条件映射；星超导会抑制定时双晶，改为本角色普攻/重击/下落命中后按12帧ICD触发单晶。完整协同或混合模式尚需实际触发次数、各自取样状态与时间线，不能沿用八晶总数。",
      evidence: { supportedBranch: `${gender}-cryo-skill-periodic-complete-c0`, firstPeriodicVolleyFrame: 178, periodicIntervalFrames: 176, periodicCrystalOffsets: [0, 13], coordinatedDelayFrames: 3, coordinatedICDFrames: 12, a1AppliesToSkillDamage: false, catalogSnapshotId: manifest.catalogSnapshotId } },
    { ...identity, id: `${gender}-cryo-burst-stellar-blocked`, abilityKey: "combat3", skillId: `${gender}-cryo-burst-stellar`, skillLabel: "聚冰成锋·星超导／星扩散直接伤害",
      reason: "C0无辉映0–8层寒辉三/五击已另有完整条件映射；两种星烁Q切换直接特殊反应标签，移除普通增伤，使用6EM/(2000+EM)、实际反应加成及旅行者命中时ATK生成的基础提升，星超导还读取命中时极星领域计数。其普通/特殊天赋向量均已核对，但角色上下文尚未接入直接特殊反应计算，不能以普通Q加100%忽防代替。",
      evidence: { sourceFormula: "burstBranch[level] + frostglowBranch[level] * actualStacksAtSpawn", frostglowDomain: [0, 8], hitCounts: [3, 5], defenseIgnore: 1, excludesOrdinaryDamageBonus: true, travelerBaseBonusFormula: "min(currentATK * 0.000035, 0.07)", polestarCountDomain: [0, 12], specialCoefficientParameters: ["param8", "param9", "param10", "param11"], catalogSnapshotId: manifest.catalogSnapshotId } },
  ];
});
