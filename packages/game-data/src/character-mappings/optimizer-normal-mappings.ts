import type { SourceHitMapping } from "./types";

/**
 * Source-reviewed production sheets at the pinned Genshin Optimizer revision.
 * The newer libs/gi/formula/src/data/char modules at that revision are TODO stubs
 * and are explicitly excluded. No localized percentage is used to infer damage.
 * Production dmgNode calls establish ATK scaling and normal/charged/plunge tags;
 * source skillParam auto indices preserve individual hit identity, including
 * equal-valued but distinct Zibai/Illuga fields. Each N input is its own action.
 */
interface OptimizerNormalFamily {
  characterSlug: string;
  element: SourceHitMapping["element"];
  sourcePaths: string[];
  assumptions: string[];
  actions: Array<{
    id: string;
    skillId: string;
    skillLabel: string;
    hitLabel: string;
    attackTag: "normal" | "charged" | "plunge";
    sourceAutoIndex: number;
    parameterKey: string;
    instanceCount: number;
    sourceCoefficientValues: number[];
  }>;
}

const families: OptimizerNormalFamily[] = [
  {
    "characterSlug": "nefer",
    "element": "dendro",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
      "libs/gi/stats/Data/Characters/Nefer/data.json",
      "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
      "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "libs/gi/wr/src/formula.ts"
    ],
    "assumptions": [
      "Shadow Dance（影舞）未启用；本项是战斗天赋一的基础普攻、退出 Slither 的基础重击或下落，不是 Phantasm Performance（幻戏）的技能倍率替代动作。",
      "已审阅 A1：帷幕层数提升 EM，并在技能/幻戏公式应用独立倍率；普通 ATK×倍率节点未接入该乘区。若该命中另触发依赖 EM 的反应，必须使用实际 EM 单独恢复反应上下文。",
      "已审阅 A4：影舞中的月绽放后 Slither 额外提供草露，不为此基础 ATK 命中直接添加伤害。固有月绽放增益不并入普通草伤。"
    ],
    "actions": [
      {
        "id": "nefer-normal-1-hit-1",
        "skillId": "nefer-normal-1",
        "skillLabel": "基础普通攻击 N1",
        "hitLabel": "基础普通攻击 N1 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 0,
        "parameterKey": "param1",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.380712,
          0.409265,
          0.437819,
          0.47589,
          0.504443,
          0.532997,
          0.571068,
          0.609139,
          0.64721,
          0.685282,
          0.723353,
          0.761424,
          0.809013,
          0.856602,
          0.904191
        ]
      },
      {
        "id": "nefer-normal-2-hit-1",
        "skillId": "nefer-normal-2",
        "skillLabel": "基础普通攻击 N2",
        "hitLabel": "基础普通攻击 N2 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 1,
        "parameterKey": "param2",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.37564,
          0.403813,
          0.431986,
          0.46955,
          0.497723,
          0.525896,
          0.56346,
          0.601024,
          0.638588,
          0.676152,
          0.713716,
          0.75128,
          0.798235,
          0.84519,
          0.892145
        ]
      },
      {
        "id": "nefer-normal-3-hit-1",
        "skillId": "nefer-normal-3",
        "skillLabel": "基础普通攻击 N3",
        "hitLabel": "基础普通攻击 N3 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 2,
        "parameterKey": "param3",
        "instanceCount": 2,
        "sourceCoefficientValues": [
          0.2524,
          0.27133,
          0.29026,
          0.3155,
          0.33443,
          0.35336,
          0.3786,
          0.40384,
          0.42908,
          0.45432,
          0.47956,
          0.5048,
          0.53635,
          0.5679,
          0.59945
        ]
      },
      {
        "id": "nefer-normal-4-hit-1",
        "skillId": "nefer-normal-4",
        "skillLabel": "基础普通攻击 N4",
        "hitLabel": "基础普通攻击 N4 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 3,
        "parameterKey": "param4",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.609944,
          0.65569,
          0.701436,
          0.76243,
          0.808176,
          0.853922,
          0.914916,
          0.97591,
          1.036905,
          1.097899,
          1.158894,
          1.219888,
          1.296131,
          1.372374,
          1.448617
        ]
      },
      {
        "id": "nefer-charged-base-hit-1",
        "skillId": "nefer-charged-base",
        "skillLabel": "基础重击",
        "hitLabel": "基础重击 · 第 1 类命中",
        "attackTag": "charged",
        "sourceAutoIndex": 4,
        "parameterKey": "param5",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.3088,
          1.40696,
          1.50512,
          1.636,
          1.73416,
          1.83232,
          1.9632,
          2.09408,
          2.22496,
          2.35584,
          2.48672,
          2.6176,
          2.7812,
          2.9448,
          3.1084
        ]
      },
      {
        "id": "nefer-low-plunge-no-collision-hit-1",
        "skillId": "nefer-low-plunge-no-collision",
        "skillLabel": "低空下落（无碰撞）",
        "hitLabel": "低空下落（无碰撞） · 第 1 类命中",
        "attackTag": "plunge",
        "sourceAutoIndex": 8,
        "parameterKey": "param9",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.136335,
          1.228828,
          1.32132,
          1.453452,
          1.545944,
          1.65165,
          1.796995,
          1.94234,
          2.087686,
          2.246244,
          2.404802,
          2.563361,
          2.721919,
          2.880478,
          3.039036
        ]
      },
      {
        "id": "nefer-high-plunge-no-collision-hit-1",
        "skillId": "nefer-high-plunge-no-collision",
        "skillLabel": "高空下落（无碰撞）",
        "hitLabel": "高空下落（无碰撞） · 第 1 类命中",
        "attackTag": "plunge",
        "sourceAutoIndex": 9,
        "parameterKey": "param10",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.419344,
          1.534872,
          1.6504,
          1.81544,
          1.930968,
          2.063,
          2.244544,
          2.426088,
          2.607632,
          2.80568,
          3.003728,
          3.201776,
          3.399824,
          3.597872,
          3.79592
        ]
      }
    ]
  },
  {
    "characterSlug": "zibai",
    "element": "physical",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Zibai/index.tsx",
      "libs/gi/stats/Data/Characters/Zibai/skillParam.json",
      "libs/gi/stats/Data/Characters/Zibai/data.json",
      "libs/gi/dm-localization/assets/locales/en/char_Zibai_gen.json",
      "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "libs/gi/wr/src/formula.ts"
    ],
    "assumptions": [
      "Lunar Phase Shift（隙中月）未启用；自身和队伍均无元素附魔，本项是基础物理 ATK 节点，不是技能天赋控制的 DEF 岩元素普攻/重击。",
      "已审阅 A1：加值只属于 Spirit Steed's Stride 第二段；A4 仅按队伍增加 DEF/EM。二者均未接入此基础物理 ATK 伤害节点，不将其错误计为攻击力增益。",
      "固有月结晶基伤增益以及隙中月第四式的独立月结晶伤害不属于此基础物理动作。"
    ],
    "actions": [
      {
        "id": "zibai-normal-1-hit-1",
        "skillId": "zibai-normal-1",
        "skillLabel": "基础普通攻击 N1",
        "hitLabel": "基础普通攻击 N1 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 0,
        "parameterKey": "param1",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.505542,
          0.546691,
          0.58784,
          0.646624,
          0.687773,
          0.7348,
          0.799462,
          0.864125,
          0.928787,
          0.999328,
          1.069869,
          1.14041,
          1.21095,
          1.281491,
          1.352032
        ]
      },
      {
        "id": "zibai-normal-2-hit-1",
        "skillId": "zibai-normal-2",
        "skillLabel": "基础普通攻击 N2",
        "hitLabel": "基础普通攻击 N2 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 1,
        "parameterKey": "param2",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.465527,
          0.503418,
          0.54131,
          0.595441,
          0.633333,
          0.676638,
          0.736182,
          0.795726,
          0.85527,
          0.920227,
          0.985184,
          1.050141,
          1.115099,
          1.180056,
          1.245013
        ]
      },
      {
        "id": "zibai-normal-3-hit-1",
        "skillId": "zibai-normal-3",
        "skillLabel": "基础普通攻击 N3",
        "hitLabel": "基础普通攻击 N3 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 2,
        "parameterKey": "param3",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.308882,
          0.334023,
          0.359165,
          0.395082,
          0.420223,
          0.448956,
          0.488464,
          0.527973,
          0.567481,
          0.61058,
          0.65368,
          0.69678,
          0.73988,
          0.78298,
          0.826079
        ]
      },
      {
        "id": "zibai-normal-3-hit-2",
        "skillId": "zibai-normal-3",
        "skillLabel": "基础普通攻击 N3",
        "hitLabel": "基础普通攻击 N3 · 第 2 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 3,
        "parameterKey": "param4",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.308882,
          0.334023,
          0.359165,
          0.395082,
          0.420223,
          0.448956,
          0.488464,
          0.527973,
          0.567481,
          0.61058,
          0.65368,
          0.69678,
          0.73988,
          0.78298,
          0.826079
        ]
      },
      {
        "id": "zibai-normal-4-hit-1",
        "skillId": "zibai-normal-4",
        "skillLabel": "基础普通攻击 N4",
        "hitLabel": "基础普通攻击 N4 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 4,
        "parameterKey": "param5",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.778954,
          0.842357,
          0.90576,
          0.996336,
          1.059739,
          1.1322,
          1.231834,
          1.331467,
          1.431101,
          1.539792,
          1.648483,
          1.757174,
          1.865866,
          1.974557,
          2.083248
        ]
      },
      {
        "id": "zibai-charged-base-hit-1",
        "skillId": "zibai-charged-base",
        "skillLabel": "基础重击",
        "hitLabel": "基础重击 · 第 1 类命中",
        "attackTag": "charged",
        "sourceAutoIndex": 5,
        "parameterKey": "param6",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.73659,
          0.796545,
          0.8565,
          0.94215,
          1.002105,
          1.070625,
          1.16484,
          1.259055,
          1.35327,
          1.45605,
          1.55883,
          1.66161,
          1.76439,
          1.86717,
          1.96995
        ]
      },
      {
        "id": "zibai-charged-base-hit-2",
        "skillId": "zibai-charged-base",
        "skillLabel": "基础重击",
        "hitLabel": "基础重击 · 第 2 类命中",
        "attackTag": "charged",
        "sourceAutoIndex": 6,
        "parameterKey": "param7",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.73659,
          0.796545,
          0.8565,
          0.94215,
          1.002105,
          1.070625,
          1.16484,
          1.259055,
          1.35327,
          1.45605,
          1.55883,
          1.66161,
          1.76439,
          1.86717,
          1.96995
        ]
      },
      {
        "id": "zibai-low-plunge-no-collision-hit-1",
        "skillId": "zibai-low-plunge-no-collision",
        "skillLabel": "低空下落（无碰撞）",
        "hitLabel": "低空下落（无碰撞） · 第 1 类命中",
        "attackTag": "plunge",
        "sourceAutoIndex": 9,
        "parameterKey": "param10",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.278377,
          1.382431,
          1.486485,
          1.635134,
          1.739187,
          1.858106,
          2.02162,
          2.185133,
          2.348646,
          2.527025,
          2.705403,
          2.883781,
          3.062159,
          3.240537,
          3.418915
        ]
      },
      {
        "id": "zibai-high-plunge-no-collision-hit-1",
        "skillId": "zibai-high-plunge-no-collision",
        "skillLabel": "高空下落（无碰撞）",
        "hitLabel": "高空下落（无碰撞） · 第 1 类命中",
        "attackTag": "plunge",
        "sourceAutoIndex": 10,
        "parameterKey": "param11",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.596762,
          1.726731,
          1.8567,
          2.04237,
          2.172339,
          2.320875,
          2.525112,
          2.729349,
          2.933586,
          3.15639,
          3.379194,
          3.601998,
          3.824802,
          4.047606,
          4.27041
        ]
      }
    ]
  },
  {
    "characterSlug": "illuga",
    "element": "physical",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Illuga/index.tsx",
      "libs/gi/stats/Data/Characters/Illuga/skillParam.json",
      "libs/gi/stats/Data/Characters/Illuga/data.json",
      "libs/gi/dm-localization/assets/locales/en/char_Illuga_gen.json",
      "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "libs/gi/wr/src/formula.ts"
    ],
    "assumptions": [
      "自身和队伍均无元素附魔；本项是基础物理 ATK 伤害，不是战技或爆发的 EM+DEF 岩元素伤害。",
      "已审阅 A1：Lightkeeper's Oath 的岩元素双暴与 EM 明确只给予其他队友（target.charKey≠Illuga），不默认施加给 Illuga 自身。",
      "爆发与 A4 的 EM 转伤加值仅作用于岩伤或月结晶；未附魔的自身物理普攻/重击/下落不适用。"
    ],
    "actions": [
      {
        "id": "illuga-normal-1-hit-1",
        "skillId": "illuga-normal-1",
        "skillLabel": "基础普通攻击 N1",
        "hitLabel": "基础普通攻击 N1 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 0,
        "parameterKey": "param1",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.473662,
          0.512216,
          0.55077,
          0.605847,
          0.644401,
          0.688462,
          0.749047,
          0.809632,
          0.870217,
          0.936309,
          1.002401,
          1.068494,
          1.134586,
          1.200679,
          1.266771
        ]
      },
      {
        "id": "illuga-normal-2-hit-1",
        "skillId": "illuga-normal-2",
        "skillLabel": "基础普通攻击 N2",
        "hitLabel": "基础普通攻击 N2 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 1,
        "parameterKey": "param2",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.485255,
          0.524753,
          0.56425,
          0.620675,
          0.660172,
          0.705313,
          0.76738,
          0.829448,
          0.891515,
          0.959225,
          1.026935,
          1.094645,
          1.162355,
          1.230065,
          1.297775
        ]
      },
      {
        "id": "illuga-normal-3-hit-1",
        "skillId": "illuga-normal-3",
        "skillLabel": "基础普通攻击 N3",
        "hitLabel": "基础普通攻击 N3 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 2,
        "parameterKey": "param3",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.31433,
          0.339915,
          0.3655,
          0.40205,
          0.427635,
          0.456875,
          0.49708,
          0.537285,
          0.57749,
          0.62135,
          0.66521,
          0.70907,
          0.75293,
          0.79679,
          0.84065
        ]
      },
      {
        "id": "illuga-normal-3-hit-2",
        "skillId": "illuga-normal-3",
        "skillLabel": "基础普通攻击 N3",
        "hitLabel": "基础普通攻击 N3 · 第 2 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 3,
        "parameterKey": "param4",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.31433,
          0.339915,
          0.3655,
          0.40205,
          0.427635,
          0.456875,
          0.49708,
          0.537285,
          0.57749,
          0.62135,
          0.66521,
          0.70907,
          0.75293,
          0.79679,
          0.84065
        ]
      },
      {
        "id": "illuga-normal-4-hit-1",
        "skillId": "illuga-normal-4",
        "skillLabel": "基础普通攻击 N4",
        "hitLabel": "基础普通攻击 N4 · 第 1 类命中",
        "attackTag": "normal",
        "sourceAutoIndex": 4,
        "parameterKey": "param5",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          0.762786,
          0.824873,
          0.88696,
          0.975656,
          1.037743,
          1.1087,
          1.206266,
          1.303831,
          1.401397,
          1.507832,
          1.614267,
          1.720702,
          1.827138,
          1.933573,
          2.040008
        ]
      },
      {
        "id": "illuga-charged-base-hit-1",
        "skillId": "illuga-charged-base",
        "skillLabel": "基础重击",
        "hitLabel": "基础重击 · 第 1 类命中",
        "attackTag": "charged",
        "sourceAutoIndex": 5,
        "parameterKey": "param6",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.11026,
          1.20063,
          1.291,
          1.4201,
          1.51047,
          1.61375,
          1.75576,
          1.89777,
          2.03978,
          2.1947,
          2.34962,
          2.50454,
          2.65946,
          2.81438,
          2.9693
        ]
      },
      {
        "id": "illuga-low-plunge-no-collision-hit-1",
        "skillId": "illuga-low-plunge-no-collision",
        "skillLabel": "低空下落（无碰撞）",
        "hitLabel": "低空下落（无碰撞） · 第 1 类命中",
        "attackTag": "plunge",
        "sourceAutoIndex": 8,
        "parameterKey": "param9",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.278377,
          1.382431,
          1.486485,
          1.635134,
          1.739187,
          1.858106,
          2.02162,
          2.185133,
          2.348646,
          2.527025,
          2.705403,
          2.883781,
          3.062159,
          3.240537,
          3.418915
        ]
      },
      {
        "id": "illuga-high-plunge-no-collision-hit-1",
        "skillId": "illuga-high-plunge-no-collision",
        "skillLabel": "高空下落（无碰撞）",
        "hitLabel": "高空下落（无碰撞） · 第 1 类命中",
        "attackTag": "plunge",
        "sourceAutoIndex": 9,
        "parameterKey": "param10",
        "instanceCount": 1,
        "sourceCoefficientValues": [
          1.596762,
          1.726731,
          1.8567,
          2.04237,
          2.172339,
          2.320875,
          2.525112,
          2.729349,
          2.933586,
          3.15639,
          3.379194,
          3.601998,
          3.824802,
          4.047606,
          4.27041
        ]
      }
    ]
  }
];

export const optimizerNormalMappings: SourceHitMapping[] = families.flatMap((family) =>
  family.actions.map((action) => ({
    id: action.id,
    characterSlug: family.characterSlug,
    talentSetId: `talent-set:${family.characterSlug}`,
    abilityKey: "combat1",
    parameterKey: action.parameterKey,
    skillId: action.skillId,
    skillLabel: action.skillLabel,
    hitLabel: action.hitLabel,
    element: family.element,
    attackTag: action.attackTag,
    scalingStat: "atk",
    instanceCount: action.instanceCount,
    sourceCoefficientValues: action.sourceCoefficientValues,
    coefficientTolerance: 0,
    sourceRepository: "frzyc/genshin-optimizer",
    sourceCommit: "180a0a1015cb725c7570cd828eb086749960df98",
    sourcePaths: family.sourcePaths,
    assumptions: [
      "C0 基础动作；每段实际命中同一目标，输入命中时实际 ATK、增伤、双暴与敌人状态，不从队伍构筑自动推导。",
      ...family.assumptions,
      ...(action.attackTag === "plunge" ? ["collision=0；仅本次所选低空或高空下落的落地冲击，未虚构沿途碰撞次数。"] : []),
      ...(family.characterSlug === "nefer" && action.attackTag === "charged" ? ["Slither 已退出且产生这一次基础重击；持续移动阶段不按时间虚构重复命中。"] : [])
    ],
    exclusions: [
      "此处仅覆盖所选基础输入自身的直接伤害，不包括其他输入、队友协同、武器/圣遗物独立触发或反应伤害实体。",
      "固定源码的系数和节点语义交叉核对不等于当前游戏独立实测；命座、反应状态、附魔转换、粒子和完整轮转仍需各自实现与验证。"
    ],
    completeAction: true
  }))
);

export const optimizerNormalMappingExclusions = [
  {
    "characterSlug": "nefer",
    "action": "phantasm-performance",
    "reason": "影舞中的幻戏使用 skill 天赋与 ATK/EM 混合或月绽放节点，不能沿用基础重击 ATK 节点。",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Nefer/index.tsx"
    ],
    "sourceCommit": "180a0a1015cb725c7570cd828eb086749960df98",
    "sourceRepository": "frzyc/genshin-optimizer"
  },
  {
    "characterSlug": "zibai",
    "action": "lunar-phase-shift",
    "reason": "隙中月的普攻/重击使用 skill 天赋、DEF 与显式岩元素；第四式额外月结晶是独立节点，不能并入本模块基础物理 ATK 动作。",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Zibai/index.tsx"
    ],
    "sourceCommit": "180a0a1015cb725c7570cd828eb086749960df98",
    "sourceRepository": "frzyc/genshin-optimizer"
  },
  {
    "characterSlug": "illuga",
    "action": "infused-normal-with-geo-buffs",
    "reason": "附魔成岩元素后，爆发/A4 的 EM 转伤加值可能适用；本模块仅无附魔物理基础攻击，不自动恢复这些条件。",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Illuga/index.tsx"
    ],
    "sourceCommit": "180a0a1015cb725c7570cd828eb086749960df98",
    "sourceRepository": "frzyc/genshin-optimizer"
  },
  {
    "characterSlug": "nefer",
    "action": "plunge-collision",
    "reason": "公共 helper 将碰撞和落地冲击区分，且碰撞显式禁用反应。此模块只实现 collision=0 的落地冲击，不推定碰撞数量或反应资格。",
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/dataUtil.tsx"
    ],
    "sourceCommit": "180a0a1015cb725c7570cd828eb086749960df98",
    "sourceRepository": "frzyc/genshin-optimizer"
  }
] as const;

export const optimizerNormalSourceEvidence = {
  "sourceRepository": "frzyc/genshin-optimizer",
  "revision": "180a0a1015cb725c7570cd828eb086749960df98",
  "reviewedAt": "2026-09-23T08:14:23.848489+00:00",
  "catalogSnapshotId": "snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34",
  "catalogGameVersion": "7.1",
  "catalogSha256": "3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602",
  "classificationScope": "Conditioned C0 base normals, charged actions and low/high plunge impacts with collision=0; provisional source cross-check, not in-game or whole-character verification",
  "numericComparison": "24 identified fields, all 360 source values at 15 effective talent levels exactly equal active catalog; absolute tolerance 0",
  "actions": 21,
  "emittedInstances": 25,
  "sourceSha256": {
    "libs/gi/sheets/src/Characters/Nefer/index.tsx": "510f1d069423e18780fe0f6bd419332909ec4bf01f405c27f7627ed863189540",
    "libs/gi/stats/Data/Characters/Nefer/skillParam.json": "e4d50dee294669cd1b225c7c593c6bbce942d34ca6c1423d1e718cb5eac90bed",
    "libs/gi/stats/Data/Characters/Nefer/data.json": "b8166f68bc31beb47575ed6edda429c8d9aedec0b6de26100887abb82d50e367",
    "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json": "50d7ab10f56e866ee0856586e046649c6676470b4a76286ddb5de6ce7902dd46",
    "libs/gi/sheets/src/Characters/Zibai/index.tsx": "6fc2d03f10a4fe14cb41827fc5d9d824c1a17dfd2ea72517cf891d884830f45f",
    "libs/gi/stats/Data/Characters/Zibai/skillParam.json": "4cbbaf9bc4b972fc25c370f142aacae1b7bd23370177b26293adca3ec967a4e5",
    "libs/gi/stats/Data/Characters/Zibai/data.json": "4aca0817b577b9128679480bf578689c57f86ee01f303ef1ac234190d21c77e0",
    "libs/gi/dm-localization/assets/locales/en/char_Zibai_gen.json": "04fd74ff89092d8618bae7851fcf40fc7e8e6d69bf8e2f8b183d756998d0b7ca",
    "libs/gi/sheets/src/Characters/Illuga/index.tsx": "c514437fc81abdb2b340bcab249f76f57bdcc2538831d4cff4052dc7d2780f7f",
    "libs/gi/stats/Data/Characters/Illuga/skillParam.json": "379262eed51253690d95fbc9a8a57882b958664f7267cc2c53a8009e1b573a84",
    "libs/gi/stats/Data/Characters/Illuga/data.json": "7960aaa0c0f5d3a1c7401c5966b0989f820027630ab4b7bcdef198609ec08d4b",
    "libs/gi/dm-localization/assets/locales/en/char_Illuga_gen.json": "fad0e74c2c2010233979622362a97bb9abb74a0960c3fbee0c4508957357c5b3",
    "libs/gi/sheets/src/Characters/dataUtil.tsx": "8448d1c106e2ff7a77fe3a6a72cf3d7d79fe6802814243dcc6bd99ed6c91125f",
    "libs/gi/wr/src/formula.ts": "392bdaa2950555b2d733959728c48105cd94495e17c5d32c3be60439a30c59bd"
  },
  "sourceFiles": [
    {
      "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "sha256": "510f1d069423e18780fe0f6bd419332909ec4bf01f405c27f7627ed863189540",
      "bytes": 14943,
      "retrievedAt": "2026-09-23T08:11:34.070107+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Nefer/skillParam.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Nefer/skillParam.json",
      "sha256": "e4d50dee294669cd1b225c7c593c6bbce942d34ca6c1423d1e718cb5eac90bed",
      "bytes": 7119,
      "retrievedAt": "2026-09-23T08:11:33.131930+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Nefer/data.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Nefer/data.json",
      "sha256": "b8166f68bc31beb47575ed6edda429c8d9aedec0b6de26100887abb82d50e367",
      "bytes": 993,
      "retrievedAt": "2026-09-23T08:11:32.956964+00:00"
    },
    {
      "path": "libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
      "sha256": "50d7ab10f56e866ee0856586e046649c6676470b4a76286ddb5de6ce7902dd46",
      "bytes": 12815,
      "retrievedAt": "2026-09-23T08:11:33.093365+00:00"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Zibai/index.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Zibai/index.tsx",
      "sha256": "6fc2d03f10a4fe14cb41827fc5d9d824c1a17dfd2ea72517cf891d884830f45f",
      "bytes": 13924,
      "retrievedAt": "2026-09-23T08:11:34.571763+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Zibai/skillParam.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Zibai/skillParam.json",
      "sha256": "4cbbaf9bc4b972fc25c370f142aacae1b7bd23370177b26293adca3ec967a4e5",
      "bytes": 6724,
      "retrievedAt": "2026-09-23T08:11:34.412986+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Zibai/data.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Zibai/data.json",
      "sha256": "4aca0817b577b9128679480bf578689c57f86ee01f303ef1ac234190d21c77e0",
      "bytes": 964,
      "retrievedAt": "2026-09-23T08:11:35.438261+00:00"
    },
    {
      "path": "libs/gi/dm-localization/assets/locales/en/char_Zibai_gen.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Zibai_gen.json",
      "sha256": "04fd74ff89092d8618bae7851fcf40fc7e8e6d69bf8e2f8b183d756998d0b7ca",
      "bytes": 10271,
      "retrievedAt": "2026-09-23T08:11:35.512181+00:00"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Illuga/index.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Illuga/index.tsx",
      "sha256": "c514437fc81abdb2b340bcab249f76f57bdcc2538831d4cff4052dc7d2780f7f",
      "bytes": 13484,
      "retrievedAt": "2026-09-23T08:11:37.907534+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Illuga/skillParam.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Illuga/skillParam.json",
      "sha256": "379262eed51253690d95fbc9a8a57882b958664f7267cc2c53a8009e1b573a84",
      "bytes": 5807,
      "retrievedAt": "2026-09-23T08:11:37.242212+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Illuga/data.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Illuga/data.json",
      "sha256": "7960aaa0c0f5d3a1c7401c5966b0989f820027630ab4b7bcdef198609ec08d4b",
      "bytes": 949,
      "retrievedAt": "2026-09-23T08:11:36.736821+00:00"
    },
    {
      "path": "libs/gi/dm-localization/assets/locales/en/char_Illuga_gen.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Illuga_gen.json",
      "sha256": "fad0e74c2c2010233979622362a97bb9abb74a0960c3fbee0c4508957357c5b3",
      "bytes": 10301,
      "retrievedAt": "2026-09-23T08:11:36.799486+00:00"
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/dataUtil.tsx",
      "sha256": "8448d1c106e2ff7a77fe3a6a72cf3d7d79fe6802814243dcc6bd99ed6c91125f",
      "bytes": 15409,
      "retrievedAt": "2026-09-23T08:12:23.422211+00:00"
    },
    {
      "path": "libs/gi/wr/src/formula.ts",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts",
      "sha256": "392bdaa2950555b2d733959728c48105cd94495e17c5d32c3be60439a30c59bd",
      "bytes": 15340,
      "retrievedAt": "2026-09-23T08:13:42.991647+00:00"
    }
  ],
  "sourceLocations": [
    {
      "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "startLine": 41,
      "endLine": 58,
      "meaning": "auto array field coordinates"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "startLine": 214,
      "endLine": 223,
      "meaning": "ATK normal, charged, plunge formulas"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Nefer/index.tsx",
      "startLine": 341,
      "endLine": 349,
      "meaning": "N3 multiplicity=2"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Zibai/index.tsx",
      "startLine": 40,
      "endLine": 56,
      "meaning": "auto array field coordinates, duplicate fields preserved"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Zibai/index.tsx",
      "startLine": 230,
      "endLine": 277,
      "meaning": "base ATK versus skill DEF explicit Geo replacement"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Zibai/index.tsx",
      "startLine": 340,
      "endLine": 360,
      "meaning": "N3 and charged multiplicity=2"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Illuga/index.tsx",
      "startLine": 38,
      "endLine": 55,
      "meaning": "N3 has separate auto[2] and auto[3] fields"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Illuga/index.tsx",
      "startLine": 158,
      "endLine": 199,
      "meaning": "A1 Crit buff excludes self"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Illuga/index.tsx",
      "startLine": 283,
      "endLine": 292,
      "meaning": "ATK normal, charged and plunge formulas"
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "startLine": 68,
      "endLine": 90,
      "meaning": "catalyst character element and melee infusion/physical fallback"
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "startLine": 165,
      "endLine": 192,
      "meaning": "talent-indexed coefficient times selected total stat"
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "startLine": 228,
      "endLine": 260,
      "meaning": "plunge collision versus impact and no-reaction collision"
    },
    {
      "path": "libs/gi/wr/src/formula.ts",
      "startLine": 534,
      "endLine": 538,
      "meaning": "self/team infusion precedence"
    }
  ],
  "fieldCoordinates": [
    {
      "mappingId": "nefer-normal-1-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/0",
      "catalogField": "talent:nefer:combat1.parameters.param1",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "nefer-normal-2-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/1",
      "catalogField": "talent:nefer:combat1.parameters.param2",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "nefer-normal-3-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/2",
      "catalogField": "talent:nefer:combat1.parameters.param3",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "nefer-normal-4-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/3",
      "catalogField": "talent:nefer:combat1.parameters.param4",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "nefer-charged-base-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/4",
      "catalogField": "talent:nefer:combat1.parameters.param5",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "nefer-low-plunge-no-collision-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/8",
      "catalogField": "talent:nefer:combat1.parameters.param9",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "nefer-high-plunge-no-collision-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Nefer/skillParam.json#/auto/9",
      "catalogField": "talent:nefer:combat1.parameters.param10",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-normal-1-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/0",
      "catalogField": "talent:zibai:combat1.parameters.param1",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-normal-2-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/1",
      "catalogField": "talent:zibai:combat1.parameters.param2",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-normal-3-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/2",
      "catalogField": "talent:zibai:combat1.parameters.param3",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-normal-3-hit-2",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/3",
      "catalogField": "talent:zibai:combat1.parameters.param4",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-normal-4-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/4",
      "catalogField": "talent:zibai:combat1.parameters.param5",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-charged-base-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/5",
      "catalogField": "talent:zibai:combat1.parameters.param6",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-charged-base-hit-2",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/6",
      "catalogField": "talent:zibai:combat1.parameters.param7",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-low-plunge-no-collision-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/9",
      "catalogField": "talent:zibai:combat1.parameters.param10",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "zibai-high-plunge-no-collision-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Zibai/skillParam.json#/auto/10",
      "catalogField": "talent:zibai:combat1.parameters.param11",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-normal-1-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/0",
      "catalogField": "talent:illuga:combat1.parameters.param1",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-normal-2-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/1",
      "catalogField": "talent:illuga:combat1.parameters.param2",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-normal-3-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/2",
      "catalogField": "talent:illuga:combat1.parameters.param3",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-normal-3-hit-2",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/3",
      "catalogField": "talent:illuga:combat1.parameters.param4",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-normal-4-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/4",
      "catalogField": "talent:illuga:combat1.parameters.param5",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-charged-base-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/5",
      "catalogField": "talent:illuga:combat1.parameters.param6",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-low-plunge-no-collision-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/8",
      "catalogField": "talent:illuga:combat1.parameters.param9",
      "sourceReferenceLevelCount": 15
    },
    {
      "mappingId": "illuga-high-plunge-no-collision-hit-1",
      "sourceField": "libs/gi/stats/Data/Characters/Illuga/skillParam.json#/auto/9",
      "catalogField": "talent:illuga:combat1.parameters.param10",
      "sourceReferenceLevelCount": 15
    }
  ],
  "excludedSourceFiles": [
    {
      "path": "libs/gi/formula/src/data/char/Nefer.ts",
      "reason": "TODO stub at fixed revision; not production damage evidence"
    },
    {
      "path": "libs/gi/formula/src/data/char/Zibai.ts",
      "reason": "TODO stub at fixed revision; not production damage evidence"
    },
    {
      "path": "libs/gi/formula/src/data/char/Illuga.ts",
      "reason": "TODO stub at fixed revision; not production damage evidence"
    }
  ]
} as const;
