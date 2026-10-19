import { optimizerNormalSourceEvidence } from "./optimizer-normal-mappings";
import { neferOrdinarySourceEvidence } from "./nefer-ordinary-source";
import type { SourceHitMapping } from "./types";

const sourceCommit = optimizerNormalSourceEvidence.revision;
const sourceRepository = optimizerNormalSourceEvidence.sourceRepository;
const sourcePaths = (character: "Illuga" | "Zibai" | "Nefer") => [
  `libs/gi/sheets/src/Characters/${character}/index.tsx`,
  `libs/gi/stats/Data/Characters/${character}/skillParam.json`,
  `libs/gi/stats/Data/Characters/${character}/data.json`,
  `libs/gi/dm-localization/assets/locales/en/char_${character}_gen.json`,
  ...(character === "Nefer" ? ["libs/gi/dm-localization/assets/locales/en/tooltips_gen.json"] : []),
  "libs/gi/sheets/src/Characters/dataUtil.tsx",
  "libs/gi/wr/src/formula.ts"
];

const illugaAssumptions = [
  "C0；burstSong=off，命中时没有自身夜莺之歌剩余加伤层数，也未在此动作内开启爆发。该状态为本输入的明确条件，不能由 C0 自动推出。",
  "输入命中时实际 EM、DEF、增伤、双暴和敌人状态；只计算选定目标被本次点按或长按飞鸟命中的自身直接伤害。",
  "已审阅 A1：岩元素双暴与 EM 增益只给予其他队友（target.charKey≠Illuga），不自动施加给自身。",
  "已审阅 A4：其 EM 转岩伤加值受 burstSong=on 门控；本输入明确 off，因此不适用。Song 开启时的 E 须另恢复 Q 等级、实际剩余层数、前台身份、突破阶段和水岩队友数量。"
];
const illugaExclusions = [
  "未包含 burstSong=on 时的 EM 转伤、队友协同、武器/圣遗物独立触发及反应实体；它们不能通过沿用本 off 状态结果计算。",
  "本映射不判断 Q 初段与新施加 Song 的先后顺序；缺执行时序证据的 Q 不提供默认关闭 Song 的伤害结果。"
];
const zibaiAssumptions = [
  "C0；输入命中时实际 DEF、增伤、双暴和敌人状态。A4 按其他岩元素队友增加的 DEF 若已生效，须体现在实际 DEF 中；本映射不自动假定其为零。",
  "已审阅 A1：其 DEF 转附加伤害只属于 Spirit Steed's Stride 的第二段月结晶，不加到这里的第一段普通岩伤。",
  "本结果只对应明确命中的第一段普通岩元素伤害；同次动作的第二段是独立 lunarDmgNode，不使用普通伤害公式替代。"
];
const zibaiExclusions = [
  "第二段月结晶伤害未计入本组件；不得把此结果标为整次战技重施或完整爆发总伤害。",
  "未恢复月结晶的反应增益、A1/C1/C2 的限定加值、资源获得、隙中月持续时间和完整轮转。"
];
const neferAssumptions = [
  "C0–C6 的所选普通组成；恢复命中时实际 ATK、EM、增伤、双暴、突破阶段和月兆级别。C3/C5等级+3必须已包含在显式有效天赋等级中，不自动再次增加。",
  "满层精通的8秒状态独立于当前或Q消耗帷幕：C0/C1为100，C2+为200替代100。实际最终EM模式默认已计入；若提供未包含该增益的面板，须显式选择add-to-panel，共享核心只加一次。",
  "Q消耗域为C0/C1的0–3、C2+的0–5；瞬时消耗数不代表精通buff是否仍有效。C4减抗须明确本目标实际有效状态，包含离开影舞/范围后4.5秒残留，不从选择E推断。"
];
const neferExclusions = [
  "不自动演算种子吸收、帷幕生成/刷新/消耗和持续影舞轮转；计算时须提供这次命中实际采用的完整资源快照。",
  "C2施E瞬得2层、C4影舞开启与初击的先后缺事件时序证明；不自动设定为命中时已触发。",
  "C1/C6幻戏的本人重击与独立月绽放影子段不并入突进或 Q；武器/圣遗物独立触发和反应实体也各自归属。"
];
const neferBurstBonusPerVeil = {
  key: "neferBurstBonusPerVeil",
  parameterKey: "param5",
  sourceCoefficientValues: [0.13, 0.16, 0.19, 0.22, 0.25, 0.28, 0.31, 0.34, 0.37, 0.4, 0.43, 0.46, 0.49, 0.52, 0.55],
  coefficientTolerance: 0
};

/** Only deterministic ordinary branches from the production sheets are mapped.
 * Lunar components and unresolved Q buff ordering remain explicit exclusions. */
export const optimizerSkillMappings: SourceHitMapping[] = [
  {
    id: "nefer-skill-rush-hit",
    characterSlug: "nefer",
    talentSetId: "talent-set:nefer",
    abilityKey: "combat2",
    parameterKey: "param1",
    skillId: "nefer-skill-rush",
    skillLabel: "战技突进（帷幕资源快照）",
    hitLabel: "战技突进命中",
    element: "dendro",
    attackTag: "skill",
    scalingStat: "atk",
    sourceCoefficientValues: [0.76384, 0.821128, 0.878416, 0.9548, 1.012088, 1.069376, 1.14576, 1.222144, 1.298528, 1.374912, 1.451296, 1.52768, 1.62316, 1.71864, 1.81412],
    additionalTerms: [{
      scalingStat: "em",
      parameterKey: "param2",
      sourceCoefficientValues: [1.52768, 1.642256, 1.756832, 1.9096, 2.024176, 2.138752, 2.29152, 2.444288, 2.597056, 2.749824, 2.902592, 3.05536, 3.24632, 3.43728, 3.62824],
      coefficientTolerance: 0
    }],
    elementalMasteryAdjustmentFormulaId: "nefer-full-veil-em",
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Nefer"),
    assumptions: [...neferAssumptions, "来源内部冲突：生产sheet误将帷幕倍率传入E突进，但tooltip11220003把8%增幅明确限定幻戏特殊重击；本映射按明确技能文本作用域移除E突进帷幕乘区，不乘外部附加伤害，仍为provisional。范围为一次突进，不是整个影舞状态。"],
    exclusions: neferExclusions,
    completeAction: false
  },
  {
    id: "nefer-burst-hit-1",
    characterSlug: "nefer",
    talentSetId: "talent-set:nefer",
    abilityKey: "combat3",
    parameterKey: "param1",
    skillId: "nefer-burst",
    skillLabel: "元素爆发（消耗帷幕快照）",
    hitLabel: "爆发第1段",
    element: "dendro",
    attackTag: "burst",
    scalingStat: "atk",
    sourceCoefficientValues: [2.2464, 2.41488, 2.58336, 2.808, 2.97648, 3.14496, 3.3696, 3.59424, 3.81888, 4.04352, 4.26816, 4.4928, 4.7736, 5.0544, 5.3352],
    additionalTerms: [{
      scalingStat: "em",
      parameterKey: "param2",
      sourceCoefficientValues: [4.4928, 4.82976, 5.16672, 5.616, 5.95296, 6.28992, 6.7392, 7.18848, 7.63776, 8.08704, 8.53632, 8.9856, 9.5472, 10.1088, 10.6704],
      coefficientTolerance: 0
    }],
    damageBonusFormulaId: "nefer-burst-veils",
    elementalMasteryAdjustmentFormulaId: "nefer-full-veil-em",
    formulaParameters: [neferBurstBonusPerVeil],
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Nefer"),
    assumptions: [...neferAssumptions, "恢复的是本次 Q 消耗的帷幕数，不能用施放后已清零的剩余层数替代；param5×消耗层数加到爆发增伤区，两段各应用一次。"],
    exclusions: neferExclusions,
    completeAction: true
  },
  {
    id: "nefer-burst-hit-2",
    characterSlug: "nefer",
    talentSetId: "talent-set:nefer",
    abilityKey: "combat3",
    parameterKey: "param3",
    skillId: "nefer-burst",
    skillLabel: "元素爆发（消耗帷幕快照）",
    hitLabel: "爆发第2段",
    element: "dendro",
    attackTag: "burst",
    scalingStat: "atk",
    sourceCoefficientValues: [3.3696, 3.62232, 3.87504, 4.212, 4.46472, 4.71744, 5.0544, 5.39136, 5.72832, 6.06528, 6.40224, 6.7392, 7.1604, 7.5816, 8.0028],
    additionalTerms: [{
      scalingStat: "em",
      parameterKey: "param4",
      sourceCoefficientValues: [6.7392, 7.24464, 7.75008, 8.424, 8.92944, 9.43488, 10.1088, 10.78272, 11.45664, 12.13056, 12.80448, 13.4784, 14.3208, 15.1632, 16.0056],
      coefficientTolerance: 0
    }],
    damageBonusFormulaId: "nefer-burst-veils",
    elementalMasteryAdjustmentFormulaId: "nefer-full-veil-em",
    formulaParameters: [neferBurstBonusPerVeil],
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Nefer"),
    assumptions: [...neferAssumptions, "两段共用本次 Q 已消耗帷幕数；不在第2段再次消耗，也不把消耗后的零剩余层数替换进本次增伤。"],
    exclusions: neferExclusions,
    completeAction: true
  },
  {
    id: "illuga-skill-press-hit",
    characterSlug: "illuga",
    talentSetId: "talent-set:illuga",
    abilityKey: "combat2",
    parameterKey: "param1",
    skillId: "illuga-skill-press-song-off",
    skillLabel: "战技点按（夜莺之歌关闭）",
    hitLabel: "点按飞鸟命中",
    element: "geo",
    attackTag: "skill",
    scalingStat: "em",
    sourceCoefficientValues: [4.8256, 5.18752, 5.54944, 6.032, 6.39392, 6.75584, 7.2384, 7.72096, 8.20352, 8.68608, 9.16864, 9.6512, 10.2544, 10.8576, 11.4608],
    additionalTerms: [{
      scalingStat: "def",
      parameterKey: "param2",
      sourceCoefficientValues: [2.4128, 2.59376, 2.77472, 3.016, 3.19696, 3.37792, 3.6192, 3.86048, 4.10176, 4.34304, 4.58432, 4.8256, 5.1272, 5.4288, 5.7304],
      coefficientTolerance: 0
    }],
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Illuga"),
    assumptions: illugaAssumptions,
    exclusions: illugaExclusions,
    completeAction: true
  },
  {
    id: "illuga-skill-hold-hit",
    characterSlug: "illuga",
    talentSetId: "talent-set:illuga",
    abilityKey: "combat2",
    parameterKey: "param3",
    skillId: "illuga-skill-hold-song-off",
    skillLabel: "战技长按（夜莺之歌关闭）",
    hitLabel: "长按瞄准飞鸟命中",
    element: "geo",
    attackTag: "skill",
    scalingStat: "em",
    sourceCoefficientValues: [6.032, 6.4844, 6.9368, 7.54, 7.9924, 8.4448, 9.048, 9.6512, 10.2544, 10.8576, 11.4608, 12.064, 12.818, 13.572, 14.326],
    additionalTerms: [{
      scalingStat: "def",
      parameterKey: "param4",
      sourceCoefficientValues: [3.016, 3.2422, 3.4684, 3.77, 3.9962, 4.2224, 4.524, 4.8256, 5.1272, 5.4288, 5.7304, 6.032, 6.409, 6.786, 7.163],
      coefficientTolerance: 0
    }],
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Illuga"),
    assumptions: illugaAssumptions,
    exclusions: illugaExclusions,
    completeAction: true
  },
  {
    id: "zibai-spirit-steed-first-hit",
    characterSlug: "zibai",
    talentSetId: "talent-set:zibai",
    abilityKey: "combat2",
    parameterKey: "param1",
    skillId: "zibai-spirit-steed-ordinary-component",
    skillLabel: "Spirit Steed's Stride（仅普通岩伤组件）",
    hitLabel: "特殊战技重施第1段 · 普通岩伤",
    element: "geo",
    attackTag: "skill",
    scalingStat: "def",
    sourceCoefficientValues: [1.72528, 1.854676, 1.984072, 2.1566, 2.285996, 2.415392, 2.58792, 2.760448, 2.932976, 3.105504, 3.278032, 3.45056, 3.66622, 3.88188, 4.09754],
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Zibai"),
    assumptions: [
      ...zibaiAssumptions,
      "Lunar Phase Shift 已启用且 Phase Shift Radiance 足够，特殊战技重施已合法发生；这不是进入隙中月的 E 开启动作，开启本身不凭空生成此命中。"
    ],
    exclusions: zibaiExclusions,
    completeAction: false
  },
  {
    id: "zibai-burst-first-hit",
    characterSlug: "zibai",
    talentSetId: "talent-set:zibai",
    abilityKey: "combat3",
    parameterKey: "param1",
    skillId: "zibai-burst-ordinary-component",
    skillLabel: "元素爆发（仅普通岩伤组件）",
    hitLabel: "爆发第1段 · 普通岩伤",
    element: "geo",
    attackTag: "burst",
    scalingStat: "def",
    sourceCoefficientValues: [1.2696, 1.36482, 1.46004, 1.587, 1.68222, 1.77744, 1.9044, 2.03136, 2.15832, 2.28528, 2.41224, 2.5392, 2.6979, 2.8566, 3.0153],
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository,
    sourceCommit,
    sourcePaths: sourcePaths("Zibai"),
    assumptions: zibaiAssumptions,
    exclusions: zibaiExclusions,
    completeAction: false
  }
];

export const optimizerSkillMappingExclusions = [
  { characterSlug: "illuga", action: "skill-song-on", sourcePath: "libs/gi/sheets/src/Characters/Illuga/index.tsx", reason: "Song 开启时须加入由 Q 等级、EM、突破阶段和水岩队伍数量共同决定的岩伤基值加成；本模块只有明确 off 分支。" },
  { characterSlug: "illuga", action: "burst", sourcePath: "libs/gi/sheets/src/Characters/Illuga/index.tsx", reason: "静态 sheet 无法证明 Q 初段与新施加 Song 的先后顺序，缺独立执行时序证据；不提供默认 Song=off 的 Q 数值。" },
  { characterSlug: "zibai", action: "spirit-steed-second-hit", sourcePath: "libs/gi/sheets/src/Characters/Zibai/index.tsx", reason: "combat2.param2 明确进入 lunarDmgNode(def,lunarcrystallize)，须由月结晶专用核心处理，不伪装普通伤害。" },
  { characterSlug: "zibai", action: "burst-second-hit", sourcePath: "libs/gi/sheets/src/Characters/Zibai/index.tsx", reason: "combat3.param2 明确进入 lunarDmgNode(def,lunarcrystallize)，与第一段普通岩伤分开。" },
  { characterSlug: "nefer", action: "resource-and-debuff-event-ordering", sourcePath: "libs/gi/sheets/src/Characters/Nefer/index.tsx", reason: "C0–C6普通E/Q条件公式可运行，但资源生成/吸收/持续刷新、C2施E给层与初击先后、C4施加/残留到期仍未实现自动事件；必须明确本段实际资源、8秒精通状态和目标减抗状态。" }
] as const;

/** Reuse immutable fetched bytes/URLs from the reviewed production-source ledger;
 * this adds skill-specific coordinates without a second source identity. */
export const optimizerSkillSourceEvidence = {
  sourceRepository,
  revision: sourceCommit,
  sourceSha256: { ...optimizerNormalSourceEvidence.sourceSha256, ...Object.fromEntries(neferOrdinarySourceEvidence.sourceFiles.map((file) => [file.path, file.sha256])) },
  sourceFiles: [...new Map([...optimizerNormalSourceEvidence.sourceFiles, ...neferOrdinarySourceEvidence.sourceFiles].map((file) => [file.path, file])).values()],
  ordinaryContextReview: neferOrdinarySourceEvidence,
  comparison: "13 distinct talent parameter fields × 15 levels = 195 values, exact equality, tolerance 0; Q's shared per-veil bonus is referenced by both hits",
  sourceLocations: [
    { path: "libs/gi/sheets/src/Characters/Nefer/index.tsx", startLine: 59, endLine: 82, meaning: "skill and burst ATK/EM fields and per-veil burst bonus coordinates" },
    { path: "libs/gi/sheets/src/Characters/Nefer/index.tsx", startLine: 115, endLine: 167, meaning: "burst absorbed-veil bonus and conditional gates; sheet applies the separate Phantasm multiplier to initial E, conflicting with tooltip11220003; initial E does not use that disputed multiplier" },
    { path: "libs/gi/sheets/src/Characters/Nefer/index.tsx", startLine: 169, endLine: 190, meaning: "separate A1 EM buff, requiring actual total EM without double counting" },
    { path: "libs/gi/sheets/src/Characters/Nefer/index.tsx", startLine: 224, endLine: 232, meaning: "E split ATK/EM nodes apply A1 multiplier to talent terms" },
    { path: "libs/gi/sheets/src/Characters/Nefer/index.tsx", startLine: 290, endLine: 301, meaning: "two ordinary ATK/EM burst hits" },
    { path: "libs/gi/sheets/src/Characters/Illuga/index.tsx", startLine: 56, endLine: 62, meaning: "press/hold EM and DEF source array coordinates" },
    { path: "libs/gi/sheets/src/Characters/Illuga/index.tsx", startLine: 123, endLine: 136, meaning: "Song geo_dmgInc requires Song on and active recipient" },
    { path: "libs/gi/sheets/src/Characters/Illuga/index.tsx", startLine: 223, endLine: 245, meaning: "A4 additional EM scaling also requires Song on" },
    { path: "libs/gi/sheets/src/Characters/Illuga/index.tsx", startLine: 293, endLine: 304, meaning: "press and hold splitScaleDmgNode(eleMas,def), skill tag" },
    { path: "libs/gi/sheets/src/Characters/Zibai/index.tsx", startLine: 57, endLine: 73, meaning: "Spirit Steed and burst first/second field coordinates" },
    { path: "libs/gi/sheets/src/Characters/Zibai/index.tsx", startLine: 220, endLine: 228, meaning: "Stride passive addition belongs to lunarcrystallize, not the ordinary first hit" },
    { path: "libs/gi/sheets/src/Characters/Zibai/index.tsx", startLine: 279, endLine: 286, meaning: "Spirit Steed first hit ordinary DEF skill, second hit separate lunarDmgNode" },
    { path: "libs/gi/sheets/src/Characters/Zibai/index.tsx", startLine: 300, endLine: 307, meaning: "burst first hit ordinary DEF burst, second hit separate lunarDmgNode" },
    { path: "libs/gi/sheets/src/Characters/dataUtil.tsx", startLine: 195, endLine: 224, meaning: "sum of talent coefficients times each selected scaling stat" }
  ],
  fieldCoordinates: [
    { mappingId: "nefer-skill-rush-hit", sourceField: "Nefer/skillParam.json#/skill/0", catalogField: "talent:nefer:combat2.parameters.param1" },
    { mappingId: "nefer-skill-rush-hit", sourceField: "Nefer/skillParam.json#/skill/1", catalogField: "talent:nefer:combat2.parameters.param2" },
    { mappingId: "nefer-burst-hit-1", sourceField: "Nefer/skillParam.json#/burst/0", catalogField: "talent:nefer:combat3.parameters.param1" },
    { mappingId: "nefer-burst-hit-1", sourceField: "Nefer/skillParam.json#/burst/1", catalogField: "talent:nefer:combat3.parameters.param2" },
    { mappingId: "nefer-burst-hit-1", sourceField: "Nefer/skillParam.json#/burst/4", catalogField: "talent:nefer:combat3.parameters.param5" },
    { mappingId: "nefer-burst-hit-2", sourceField: "Nefer/skillParam.json#/burst/2", catalogField: "talent:nefer:combat3.parameters.param3" },
    { mappingId: "nefer-burst-hit-2", sourceField: "Nefer/skillParam.json#/burst/3", catalogField: "talent:nefer:combat3.parameters.param4" },
    { mappingId: "nefer-burst-hit-2", sourceField: "Nefer/skillParam.json#/burst/4", catalogField: "talent:nefer:combat3.parameters.param5" },
    { mappingId: "illuga-skill-press-hit", sourceField: "Illuga/skillParam.json#/skill/0", catalogField: "talent:illuga:combat2.parameters.param1" },
    { mappingId: "illuga-skill-press-hit", sourceField: "Illuga/skillParam.json#/skill/1", catalogField: "talent:illuga:combat2.parameters.param2" },
    { mappingId: "illuga-skill-hold-hit", sourceField: "Illuga/skillParam.json#/skill/2", catalogField: "talent:illuga:combat2.parameters.param3" },
    { mappingId: "illuga-skill-hold-hit", sourceField: "Illuga/skillParam.json#/skill/3", catalogField: "talent:illuga:combat2.parameters.param4" },
    { mappingId: "zibai-spirit-steed-first-hit", sourceField: "Zibai/skillParam.json#/skill/0", catalogField: "talent:zibai:combat2.parameters.param1" },
    { mappingId: "zibai-burst-first-hit", sourceField: "Zibai/skillParam.json#/burst/0", catalogField: "talent:zibai:combat3.parameters.param1" }
  ]
} as const;
