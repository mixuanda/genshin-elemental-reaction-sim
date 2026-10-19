import type { SourceHitMapping } from "./types";

/** Explicit resource context; source UI presets are not an automatic state scheduler. */
export const optimizerResourceMappings: SourceHitMapping[] = [
  {
    "id": "lohen-skill-etch-resource-hit-1",
    "characterSlug": "lohen",
    "talentSetId": "talent-set:lohen",
    "abilityKey": "combat2",
    "parameterKey": "param17",
    "skillId": "lohen-skill-etch-resource",
    "skillLabel": "镂骨彻心（单次，显式争胜消耗）",
    "hitLabel": "镂骨彻心单次",
    "element": "cryo",
    "attackTag": "skill",
    "scalingStat": "atk",
    "additiveFormulaId": "lohen-will-consumed",
    "formulaParameters": [
      {
        "key": "willMultiplierPerPoint",
        "parameterKey": "param18",
        "sourceCoefficientValues": [
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004
        ],
        "coefficientTolerance": 0
      }
    ],
    "coefficientMultiplier": 1,
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.6,
      0.645,
      0.69,
      0.75,
      0.795,
      0.84,
      0.9,
      0.96,
      1.02,
      1.08,
      1.14,
      1.2,
      1.275,
      1.35,
      1.425
    ],
    "coefficientTolerance": 0,
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Lohen/index.tsx",
      "libs/gi/stats/Data/Characters/Lohen/skillParam.json",
      "libs/gi/stats/Data/Characters/Lohen/data.json",
      "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "libs/gi/wr/src/formula.ts",
      "libs/common/util/src/lib/array.ts"
    ],
    "sourceRepository": "frzyc/genshin-optimizer",
    "sourceCommit": "180a0a1015cb725c7570cd828eb086749960df98",
    "assumptions": [
      "C0；争胜实际消耗量 willConsumed 必须显式恢复。当前可验证界面情境采用20、40、60、80、100；20仅为明确的教学示例，不是缺失上下文默认值。",
      "固定源码 maxWill=100；上述档位来自 range(20,100,20)，不声称游戏资源只能按20递增，也不声称其连续。",
      "每击基础伤害=ATK×天赋倍率×(1+willMultiplierPerPoint×willConsumed)；系数从相应天赋参数读取，不能以默认0资源跳过该步骤。",
      "最终 ATK 必须包含实际 A4 状态：突破≥4且a4MasterCryo已触发时，自身15%攻击力增益需要已正确恢复；未触发时不可虚构加攻。",
      "不计算反应、装备触发、队友协同或C2/C6额外效果；实际暴击、伤害加成与目标抗性上下文须完整。",
      "使用镂骨彻心执行时实际有效 E 天赋等级；a0HighSpirits 乘兴生效时的技能等级+1必须已经包含，不能固定假设开启或关闭。",
      "这一行仅一次实际发生的镂骨彻心；不代表一次初始 E 加后续整个奇谋持续期的全部动作。"
    ],
    "exclusions": [
      "争胜累积/获得/消耗事件的自动调度、欢悦触发与奇谋动作循环没有由此 damage sheet 认证。",
      "未给出实际争胜消耗、实际E有效等级或A4最终ATK状态时，不能静默创建完整上下文。",
      "UI lookup 的 naught 回退不构成真实消耗动作 W=0 的验证证据。"
    ],
    "completeAction": false
  },
  {
    "id": "lohen-burst-six-cuts-resource-hit-1",
    "characterSlug": "lohen",
    "talentSetId": "talent-set:lohen",
    "abilityKey": "combat3",
    "parameterKey": "param1",
    "skillId": "lohen-burst-six-cuts-resource",
    "skillLabel": "元素爆发（六斩，显式争胜消耗）",
    "hitLabel": "连续斩击 × 6",
    "element": "cryo",
    "attackTag": "burst",
    "scalingStat": "atk",
    "additiveFormulaId": "lohen-will-consumed",
    "formulaParameters": [
      {
        "key": "willMultiplierPerPoint",
        "parameterKey": "param2",
        "sourceCoefficientValues": [
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004,
          0.004
        ],
        "coefficientTolerance": 0
      }
    ],
    "coefficientMultiplier": 1,
    "instanceCount": 6,
    "sourceCoefficientValues": [
      1.188,
      1.2771,
      1.3662,
      1.485,
      1.5741,
      1.6632,
      1.782,
      1.9008,
      2.0196,
      2.1384,
      2.2572,
      2.376,
      2.5245,
      2.673,
      2.8215
    ],
    "coefficientTolerance": 0,
    "sourcePaths": [
      "libs/gi/sheets/src/Characters/Lohen/index.tsx",
      "libs/gi/stats/Data/Characters/Lohen/skillParam.json",
      "libs/gi/stats/Data/Characters/Lohen/data.json",
      "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "libs/gi/wr/src/formula.ts",
      "libs/common/util/src/lib/array.ts"
    ],
    "sourceRepository": "frzyc/genshin-optimizer",
    "sourceCommit": "180a0a1015cb725c7570cd828eb086749960df98",
    "assumptions": [
      "C0；争胜实际消耗量 willConsumed 必须显式恢复。当前可验证界面情境采用20、40、60、80、100；20仅为明确的教学示例，不是缺失上下文默认值。",
      "固定源码 maxWill=100；上述档位来自 range(20,100,20)，不声称游戏资源只能按20递增，也不声称其连续。",
      "每击基础伤害=ATK×天赋倍率×(1+willMultiplierPerPoint×willConsumed)；系数从相应天赋参数读取，不能以默认0资源跳过该步骤。",
      "最终 ATK 必须包含实际 A4 状态：突破≥4且a4MasterCryo已触发时，自身15%攻击力增益需要已正确恢复；未触发时不可虚构加攻。",
      "不计算反应、装备触发、队友协同或C2/C6额外效果；实际暴击、伤害加成与目标抗性上下文须完整。",
      "使用实际有效 Q 天赋等级；生产 sheet 的 burstDmg 明确 multi=6，六斩均命中同一目标，并使用本次消耗的同一个争胜值。"
    ],
    "exclusions": [
      "争胜累积/获得/消耗事件的自动调度、欢悦触发与奇谋动作循环没有由此 damage sheet 认证。",
      "未给出实际争胜消耗、实际E有效等级或A4最终ATK状态时，不能静默创建完整上下文。",
      "UI lookup 的 naught 回退不构成真实消耗动作 W=0 的验证证据。"
    ],
    "completeAction": true
  }
];

export const optimizerResourceSourceEvidence = {
  "sourceRepository": "frzyc/genshin-optimizer",
  "commit": "180a0a1015cb725c7570cd828eb086749960df98",
  "reviewedAt": "2026-09-23T10:28:04.111147+00:00",
  "catalogSnapshotId": "snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34",
  "catalogSha256": "3ed973284f87bba52bf2dcc407c5ad08aa76fdc2c8f0cad475f34ed0812f5602",
  "sourceSha256": {
    "libs/gi/sheets/src/Characters/Lohen/index.tsx": "29ebbc9f074a6cea088c04af5f16c074a8d683af512e310692f17859536430fe",
    "libs/gi/stats/Data/Characters/Lohen/skillParam.json": "c3bdd9a10be7ca91eaeab57832cc2a49ad3b06618368efc93839353894bb8c22",
    "libs/gi/stats/Data/Characters/Lohen/data.json": "a315b2f5c372d477e7e57ece55e64eb08f924185f5a3996236b25b24c2423dc7",
    "libs/gi/sheets/src/Characters/dataUtil.tsx": "8448d1c106e2ff7a77fe3a6a72cf3d7d79fe6802814243dcc6bd99ed6c91125f",
    "libs/gi/wr/src/formula.ts": "392bdaa2950555b2d733959728c48105cd94495e17c5d32c3be60439a30c59bd",
    "libs/common/util/src/lib/array.ts": "3bfca9df92d9332da112f29eed305e4fc5ca8794d0bf4d3753fb49cc6cb8423e"
  },
  "sourceFiles": [
    {
      "path": "libs/gi/sheets/src/Characters/Lohen/index.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Lohen/index.tsx",
      "sha256": "29ebbc9f074a6cea088c04af5f16c074a8d683af512e310692f17859536430fe",
      "gitBlobSha": "c17766f748288510cdc1394fee1fca3db292eafa",
      "bytes": 16157
    },
    {
      "path": "libs/gi/stats/Data/Characters/Lohen/skillParam.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Lohen/skillParam.json",
      "sha256": "c3bdd9a10be7ca91eaeab57832cc2a49ad3b06618368efc93839353894bb8c22",
      "gitBlobSha": "03fa80ac19790805d497b7a52965f59f92879eea",
      "bytes": 8035
    },
    {
      "path": "libs/gi/stats/Data/Characters/Lohen/data.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Lohen/data.json",
      "sha256": "a315b2f5c372d477e7e57ece55e64eb08f924185f5a3996236b25b24c2423dc7",
      "gitBlobSha": "9c292679a781dd52c51588afb1d59235fdbc0fc1",
      "bytes": 968
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/dataUtil.tsx",
      "sha256": "8448d1c106e2ff7a77fe3a6a72cf3d7d79fe6802814243dcc6bd99ed6c91125f",
      "gitBlobSha": "736a1229592f4afead151920884dbccd5c5e22cb",
      "bytes": 15409
    },
    {
      "path": "libs/gi/wr/src/formula.ts",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/wr/src/formula.ts",
      "sha256": "392bdaa2950555b2d733959728c48105cd94495e17c5d32c3be60439a30c59bd",
      "gitBlobSha": "7a066de7a030ed2dd05b5184703bb955f6331961",
      "bytes": 15340
    },
    {
      "path": "libs/common/util/src/lib/array.ts",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/common/util/src/lib/array.ts",
      "sha256": "3bfca9df92d9332da112f29eed305e4fc5ca8794d0bf4d3753fb49cc6cb8423e",
      "gitBlobSha": "216f146a6297db6f3ce77e2e39419b8d928e2b46",
      "bytes": 3012
    }
  ],
  "coefficientBindings": [
    {
      "abilityKey": "combat2",
      "baseSource": "dm.skill.etchDmg = skillParam_gen.skill[16]",
      "baseParameter": "param17",
      "resourceSource": "dm.skill.willEtchMult = skillParam_gen.skill[17][0]",
      "resourceParameter": "param18"
    },
    {
      "abilityKey": "combat3",
      "baseSource": "dm.burst.skillDmg = skillParam_gen.burst[0]",
      "baseParameter": "param1",
      "resourceSource": "dm.burst.willDmgMult = skillParam_gen.burst[1][0]",
      "resourceParameter": "param2"
    }
  ],
  "sourceUiChoices": [
    20,
    40,
    60,
    80,
    100
  ],
  "sourceUiChoiceExpression": "range(20, dm.skill.maxWill, 20)",
  "sourceUiRangeSemantics": "rangeGen iterates i <= to; both endpoints included",
  "sourceMaxWill": 100,
  "sourceWillGainPerEvent": 20,
  "sourceAscension1AdditionalWillGain": 60,
  "resourceGranularityStatus": "unverified",
  "resourceGranularityExplanation": "The inspected sheet builds a damage calculator and UI choices; it does not implement resource-accumulation events. Data values 20 and 60 are compatible with the displayed steps, but neither a continuous domain nor an exhaustive in-game step restriction is independently established.",
  "emptyChoiceSourceFallback": "lookup(..., naught): GUI fallback, not proof of a real consumed amount",
  "automaticResourceSchedulerVerified": false,
  "verifiedCoefficientPositions": 60,
  "mappingRows": 2,
  "expandedInstanceCount": 7
} as const;
