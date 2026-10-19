import linneaParameters from "../../sources/optimizer-missing-components/linnea/raw/libs/gi/stats/Data/Characters/Linnea/skillParam.json";
import sandroneParameters from "../../sources/optimizer-missing-components/sandrone/raw/libs/gi/stats/Data/Characters/Sandrone/skillParam.json";
import linneaManifest from "../../sources/optimizer-missing-components/linnea/manifest.json";
import sandroneManifest from "../../sources/optimizer-missing-components/sandrone/manifest.json";

/** Actual individual special damage components, never a synthetic ordinary hit or complete cast. */
export interface OptimizerSpecialComponent {
  id: string;
  characterSlug: "linnea" | "sandrone";
  talentSetId: string;
  abilityKey: "combat1" | "combat2" | "combat3";
  parameterKey: string;
  sourceCoefficientValues: number[];
  scalingStat: "def" | "atk";
  specialBranch: "lunar-crystallize-direct" | "stellar-conduct-direct" | "stellar-swirl-direct";
  resistanceElement: "geo" | "cryo";
  attackTag: "charged" | "skill" | "burst";
  label: string;
  sourceRefs: string[];
  sourcePaths: string[];
  requiredActualState: string[];
  assumptions: string[];
  exclusions: string[];
  status: "partial";
  passiveProfile: "linnea" | "sandrone";
  intrinsicStat: "def" | "atk";
  baseTalentMultiplierKind: "none" | "sandrone-skill-decoding" | "sandrone-burst-tactics";
  coefficientEvidence: string;
}

const revision = "180a0a1015cb725c7570cd828eb086749960df98";
const pathsFor = (name: "Linnea" | "Sandrone"): string[] => [
  `libs/gi/sheets/src/Characters/${name}/index.tsx`,
  `libs/gi/stats/Data/Characters/${name}/skillParam.json`,
  `libs/gi/dm-localization/assets/locales/en/char_${name}_gen.json`,
  "libs/gi/dm-localization/assets/locales/en/tooltips_gen.json",
  "libs/gi/wr/src/reaction/special.ts",
  `libs/gi/wr/src/reaction/${name === "Linnea" ? "lunar" : "stellar"}.ts`,
  "libs/gi/wr/src/formula.ts",
];
const refsFor = (paths: string[]): string[] => paths.map(path => `https://github.com/frzyc/genshin-optimizer/blob/${revision}/${path}`);
const commonActualState = [
  "actualComponentOccurred", "actualOffensiveSnapshot", "actualIntrinsicStat",
  "otherSpecialBaseBonus", "otherReactionBonus", "specialAdditive", "elevationMultiplier",
];
const commonExclusions = [
  "只计算用户明确还原的一次实际命中；不从持续时间、静态伤害行或相邻组成推算总次数。",
  "没有自动动作帧、ICD、产球、取消窗、资源获得消费或完整实体状态机；不注册为已认证团队能力。",
  "本批固定来源的 C0 条件公式仍为 provisional；不代表实机验证，也不晋升为整角色或完整生命周期支持。",
];
const linneaPaths = pathsFor("Linnea"), sandronePaths = pathsFor("Sandrone");
const linneaBase = {
  characterSlug: "linnea", talentSetId: "talent-set:linnea", abilityKey: "combat2", scalingStat: "def",
  specialBranch: "lunar-crystallize-direct", resistanceElement: "geo", attackTag: "skill",
  passiveProfile: "linnea", intrinsicStat: "def", baseTalentMultiplierKind: "none", status: "partial",
  sourcePaths: linneaPaths, sourceRefs: refsFor(linneaPaths),
  requiredActualState: [...commonActualState, "moonsignLevel", "lumiPresent", "targetWithinLumiA1Range", "includedLinneaA1ResistanceReduction", "linneaA4AppliesToSelf", "linneaA4PreConversionDef", "includedLinneaA4Em"],
  assumptions: [
    "C0；本击确为露米的指定月结晶段，按实际最终 DEF、EM、双暴及目标岩抗执行共享直接月结晶公式。",
    "固有基础提升为 min(实际 DEF × 0.007 / 100, 0.14)，与普通伤害加成及其他特殊基础提升分开记账。",
    "A1 在突破≥1、露米在场且目标在范围内时减岩抗：月兆<2为0.15，≥2总量0.30；输入已含份额必须扣除。",
    "A4 在突破≥4时按转换前 DEF × 0.05 提供 EM；当前月兆前台接受增益，否则由莉奈娅本人接受。需明确本击本人是否接受及面板已含份额。",
  ],
  exclusions: [...commonExclusions, "不重建 E/Q 召唤、喂食次数、普通双击间隔、锤击交替周期、形态替换或 Q 重置露米寿命；C1及以上不在本组件域内。"],
} satisfies Omit<OptimizerSpecialComponent, "id" | "parameterKey" | "sourceCoefficientValues" | "label" | "coefficientEvidence">;
const sandroneBase = {
  characterSlug: "sandrone", talentSetId: "talent-set:sandrone", scalingStat: "atk", resistanceElement: "cryo",
  passiveProfile: "sandrone", intrinsicStat: "atk", status: "partial", sourcePaths: sandronePaths, sourceRefs: refsFor(sandronePaths),
  requiredActualState: [...commonActualState, "actualRadiance", "sandroneA4PreConversionAtk", "includedSandroneA4Em"],
  assumptions: [
    "C0；本击实际辉映与所选星导／星旋分支一致，伤害元素及抗性均为冰；特殊段取代对应普通光束、第二棱镜弹或射线，不与被替代段相加。",
    "固有基础提升为 min(实际 ATK × 0.007 / 100, 0.14)。A4 在突破≥4时提供 min(转换前 ATK × 0.08, 160) EM，扣除面板已含份额。",
    "A1 倍率只乘原始天赋×攻击项，位于特殊加算之前；不会将特殊加算一起乘以 A1，也不代替专属擢升区。",
  ],
  exclusions: [...commonExclusions, "不重建解析热量增减速率、普通／重击输入、100热量过载与低于50退出的具体时间、扫射／光束周期、辉映转换尾段或C1及以上。"],
} satisfies Omit<OptimizerSpecialComponent, "id" | "abilityKey" | "parameterKey" | "sourceCoefficientValues" | "specialBranch" | "attackTag" | "label" | "baseTalentMultiplierKind" | "coefficientEvidence">;

export const optimizerSpecialComponents: OptimizerSpecialComponent[] = [
  {
    ...linneaBase, id: "linnea-lumi-heavy-overdrive-hammer-component", parameterKey: "param2",
    sourceCoefficientValues: linneaParameters.skill[1]!, label: "露米重锤 · 实际单次月结晶",
    requiredActualState: [...linneaBase.requiredActualState, "lumiSuperPowerForm", "nearbyMoondrift"],
    coefficientEvidence: "Linnea/index.tsx dm.skill.hammerDmg = skill[1]; lunarDmgNode(..., 'def', 'lunarcrystallize'). char_Linnea_gen skill.skillParamsEncoding.1 maps parameter 1; tooltips_gen /11300001 states Super Power alternates Pummeler and Hammer when a Moondrift is nearby. Exact raw 15-level vector, no coefficient tolerance.",
  },
  {
    ...linneaBase, id: "linnea-lumi-million-ton-crush-component", parameterKey: "param3",
    sourceCoefficientValues: linneaParameters.skill[2]!, label: "露米百万吨重压 · 实际单次月结晶",
    requiredActualState: [...linneaBase.requiredActualState, "lumiUltimatePowerForm"],
    coefficientEvidence: "Linnea/index.tsx dm.skill.crushDmg = skill[2]; lunarDmgNode(..., 'def', 'lunarcrystallize'). char_Linnea_gen skill.skillParamsEncoding.2 maps parameter 2; tooltips_gen /11300001 identifies the one Ultimate Power crush then Standard Power. C1/C2 special additions are excluded at C0. Exact raw 15-level vector.",
  },
  {
    ...sandroneBase, id: "sandrone-charged-beam-stellar-conduct-component", abilityKey: "combat1", parameterKey: "param6",
    sourceCoefficientValues: sandroneParameters.auto[5]!, specialBranch: "stellar-conduct-direct", attackTag: "charged",
    label: "桑多涅凝聚光束 · 实际单次星导", baseTalentMultiplierKind: "none",
    requiredActualState: [...sandroneBase.requiredActualState, "decodingMode", "polestarApplicationCount"],
    coefficientEvidence: "Sandrone/index.tsx charged.beamStellarDmg and char_Sandrone_gen auto.skillParamsEncoding.5 both bind auto[5]. Stellar-Conduct Cryo direct damage. Exact raw 15-level vector.",
  },
  {
    ...sandroneBase, id: "sandrone-charged-beam-stellar-swirl-component", abilityKey: "combat1", parameterKey: "param11",
    sourceCoefficientValues: sandroneParameters.auto[10]!, specialBranch: "stellar-swirl-direct", attackTag: "charged",
    label: "桑多涅凝聚光束 · 实际单次星旋", baseTalentMultiplierKind: "none",
    requiredActualState: [...sandroneBase.requiredActualState, "decodingMode"],
    coefficientEvidence: "Explicit source conflict adjudication: dm.charged.beamSsDmg declares auto[last]=auto[10], and char_Sandrone_gen auto.skillParamsEncoding.6 explicitly points to {{10}} for Stellar Swirl. The charged.beamSsDmg node incorrectly reads dm.charged.beamStellarDmg (auto[5]); that node reference is rejected, preserved in the raw archive. Use the independently identified auto[10] 15-level vector without changing any global tolerance.",
  },
  {
    ...sandroneBase, id: "sandrone-skill-prism-stellar-conduct-component", abilityKey: "combat2", parameterKey: "param2",
    sourceCoefficientValues: sandroneParameters.skill[1]!, specialBranch: "stellar-conduct-direct", attackTag: "skill",
    label: "桑多涅第二棱镜弹 · 实际单次星导", baseTalentMultiplierKind: "sandrone-skill-decoding",
    requiredActualState: [...sandroneBase.requiredActualState, "decodingPowerAtSkill", "polestarApplicationCount"],
    coefficientEvidence: "Sandrone/index.tsx skill.prismStellarDmg uses skill[1] and a1Decoding_prism_mult_; char_Sandrone_gen skill.skillParamsEncoding.1 maps parameter 1. At ascension 1+ and actual Decoding Power >50, multiply the talent term by 1+3=4; exactly50 remains1. Exact raw 15-level vector.",
  },
  {
    ...sandroneBase, id: "sandrone-skill-prism-stellar-swirl-component", abilityKey: "combat2", parameterKey: "param4",
    sourceCoefficientValues: sandroneParameters.skill[3]!, specialBranch: "stellar-swirl-direct", attackTag: "skill",
    label: "桑多涅第二棱镜弹 · 实际单次星旋", baseTalentMultiplierKind: "sandrone-skill-decoding",
    requiredActualState: [...sandroneBase.requiredActualState, "decodingPowerAtSkill"],
    coefficientEvidence: "Sandrone/index.tsx skill.prismSsDmg uses skill[3] and a1Decoding_prism_mult_; char_Sandrone_gen skill.skillParamsEncoding.2 maps parameter 3. At ascension 1+ and actual Decoding Power >50, multiply the talent term by 1+3=4; exactly50 remains1. Exact raw 15-level vector.",
  },
  {
    ...sandroneBase, id: "sandrone-burst-ray-stellar-conduct-component", abilityKey: "combat3", parameterKey: "param3",
    sourceCoefficientValues: sandroneParameters.burst[2]!, specialBranch: "stellar-conduct-direct", attackTag: "burst",
    label: "桑多涅对流抑制射线 · 实际单次星导", baseTalentMultiplierKind: "sandrone-burst-tactics",
    requiredActualState: [...sandroneBase.requiredActualState, "refinedTacticsConsumed", "polestarApplicationCount"],
    coefficientEvidence: "Sandrone/index.tsx burst.rayStellarDmg uses burst[2]; char_Sandrone_gen burst.skillParamsEncoding.2 maps parameter 2. A1 at ascension1+ multiplies the talent term by 1+0.1*n for actual consumed Refined Tactics n=0..10. Tooltip separates Q consumption from the E >50 trigger; no requirement that current heat exceed50. Exact raw vector retains six-decimal values.",
  },
  {
    ...sandroneBase, id: "sandrone-burst-ray-stellar-swirl-component", abilityKey: "combat3", parameterKey: "param6",
    sourceCoefficientValues: sandroneParameters.burst[5]!, specialBranch: "stellar-swirl-direct", attackTag: "burst",
    label: "桑多涅对流抑制射线 · 实际单次星旋", baseTalentMultiplierKind: "sandrone-burst-tactics",
    requiredActualState: [...sandroneBase.requiredActualState, "refinedTacticsConsumed"],
    coefficientEvidence: "Sandrone/index.tsx burst.raySsDmg uses burst[5]; char_Sandrone_gen burst.skillParamsEncoding.3 maps parameter 5. A1 at ascension1+ multiplies the talent term by 1+0.1*n for actual consumed Refined Tactics n=0..10, independently of current heat. Exact raw 15-level vector.",
  },
];

export const optimizerSpecialComponentSourceEvidence = { linnea: linneaManifest, sandrone: sandroneManifest };
