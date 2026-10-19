import type { SourceHitMapping } from "./types";

/** One selected pair from Lumi's continuing attack sequence. It is deliberately
 * not a whole cast, and ordinary damage is never substituted for lunar nodes. */
export const optimizerLinneaMappings: SourceHitMapping[] = [{
  id: "linnea-lumi-pummeler-hit",
  characterSlug: "linnea",
  talentSetId: "talent-set:linnea",
  abilityKey: "combat2",
  parameterKey: "param1",
  skillId: "linnea-lumi-pummeler-pair",
  skillLabel: "露米普通双击（选定一组）",
  hitLabel: "Lumi Pound-Pound Pummeler 普通岩伤",
  element: "geo",
  attackTag: "skill",
  scalingStat: "def",
  instanceCount: 2,
  sourceCoefficientValues: [0.96, 1.032, 1.104, 1.2, 1.272, 1.344, 1.44, 1.536, 1.632, 1.728, 1.824, 1.92, 2.04, 2.16, 2.28],
  coefficientTolerance: 0,
  resistanceReductionFormulaId: "linnea-a1-lumi",
  sourceRepository: "frzyc/genshin-optimizer",
  sourceCommit: "180a0a1015cb725c7570cd828eb086749960df98",
  sourcePaths: [
    "libs/gi/sheets/src/Characters/Linnea/index.tsx",
    "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
    "libs/gi/stats/Data/Characters/Linnea/data.json",
    "libs/gi/dm-localization/assets/locales/en/char_Linnea_gen.json",
    "libs/gi/sheets/src/Characters/dataUtil.tsx",
    "libs/gi/wr/src/formula.ts"
  ],
  assumptions: [
    "C0；已明确选中露米本次普通双击，两段均实际命中所选目标；各段使用命中时实际 DEF、增伤、双暴与敌人基础岩抗。",
    "A1 是否生效须恢复实际突破阶段、月兆级别、露米在场及目标处于减抗范围的状态，不由选择角色或 C0 自动推断。",
    "A1 在突破≥1且露米在场、目标在附近时：月兆<2 总减抗0.15，月兆≥2 总减抗0.30；0.30 已是总量，不能再加0.15。",
    "敌人输入保留基础抗性及其他已知减抗；A1 通过 linnea-a1-lumi 共享表达式进入抗性区，不能预先硬写有效抗性或重复减去。",
    "A4 将 DEF 转为特定角色的 EM，不是本普通 DEF 岩伤节点的额外基伤；固有月结晶基伤增益属于独立月结晶路径。"
  ],
  exclusions: [
    "此处只计算同一 Pummeler 类型的两段伤害，不合并 Heavy Overdrive Hammer 或 Million Ton Crush；后两者明确为 lunarDmgNode。",
    "25秒持续时间不能推出命中总轮数；未从 E 开启、Q 召唤、连点喂食、形态切换、攻击间隔或目标移动虚构持续总伤害。",
    "C1及以上资源、月结晶附加伤害、C2双暴和C4防御增益未作为完整角色状态机验证；队友协同及反应伤害实体也不并入本组。"
  ],
  completeAction: false
}];

export const optimizerLinneaMappingExclusions = [
  { characterSlug: "linnea", action: "lumi-heavy-overdrive-hammer", sourcePath: "libs/gi/sheets/src/Characters/Linnea/index.tsx", reason: "combat2.param2 的 hammerDmg 明确使用 DEF lunarDmgNode(lunarcrystallize)，不能以普通岩伤替代。" },
  { characterSlug: "linnea", action: "lumi-million-ton-crush", sourcePath: "libs/gi/sheets/src/Characters/Linnea/index.tsx", reason: "combat2.param3 的 crushDmg 属月结晶，且有独立命座附加项和互斥条件，不并入普通双击。" },
  { characterSlug: "linnea", action: "full-summon-duration", sourcePath: "libs/gi/sheets/src/Characters/Linnea/index.tsx", reason: "静态公式与持续25秒未提供足以验证持续总轮数、两段间隔和形态转换的执行时间线；整次召唤保持partial。" }
] as const;

export const optimizerLinneaSourceEvidence = {
  "sourceRepository": "frzyc/genshin-optimizer",
  "revision": "180a0a1015cb725c7570cd828eb086749960df98",
  "scope": "C0 selected ordinary Lumi Pound-Pound Pummeler pair; partial skill duration, no lunar damage",
  "sourceFiles": [
    {
      "path": "libs/gi/dm-localization/assets/locales/en/char_Linnea_gen.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Linnea_gen.json",
      "sha256": "0dcfddeaa649c6c12bf99ba96f83d21cd630e7cd2eddf63ca644416079ac7ca3",
      "bytes": 12399,
      "retrievedAt": "2026-09-23T10:25:51.492313+00:00"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "sha256": "656028626c1bd7ebd5a17b4ac5a0dcfc49b598841f0896075c36017aea8f9aaa",
      "bytes": 16555,
      "retrievedAt": "2026-09-23T10:25:51.507967+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Linnea/data.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Linnea/data.json",
      "sha256": "c2a5819dc89f1e2ab1147c9123edf32d4f3490d822ec983c8301f6e58edb37a4",
      "bytes": 964,
      "retrievedAt": "2026-09-23T10:25:51.536600+00:00"
    },
    {
      "path": "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "url": "https://raw.githubusercontent.com/frzyc/genshin-optimizer/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "sha256": "5a7b0211aaa9da1cf830467cdc56caacadf7d217a6c874123d7ab41dc05555ce",
      "bytes": 4751,
      "retrievedAt": "2026-09-23T10:25:51.432331+00:00"
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
  "sourceSha256": {
    "libs/gi/dm-localization/assets/locales/en/char_Linnea_gen.json": "0dcfddeaa649c6c12bf99ba96f83d21cd630e7cd2eddf63ca644416079ac7ca3",
    "libs/gi/sheets/src/Characters/Linnea/index.tsx": "656028626c1bd7ebd5a17b4ac5a0dcfc49b598841f0896075c36017aea8f9aaa",
    "libs/gi/stats/Data/Characters/Linnea/data.json": "c2a5819dc89f1e2ab1147c9123edf32d4f3490d822ec983c8301f6e58edb37a4",
    "libs/gi/stats/Data/Characters/Linnea/skillParam.json": "5a7b0211aaa9da1cf830467cdc56caacadf7d217a6c874123d7ab41dc05555ce",
    "libs/gi/sheets/src/Characters/dataUtil.tsx": "8448d1c106e2ff7a77fe3a6a72cf3d7d79fe6802814243dcc6bd99ed6c91125f",
    "libs/gi/wr/src/formula.ts": "392bdaa2950555b2d733959728c48105cd94495e17c5d32c3be60439a30c59bd"
  },
  "numericalComparison": "combat2.param1 equals all 15 source skill[0] values exactly, absolute tolerance 0; passive constants sourced independently because runtime passive metadata has no numerical parameter fields",
  "fieldCoordinates": [
    {
      "mappingId": "linnea-lumi-pummeler-hit",
      "sourceField": "libs/gi/stats/Data/Characters/Linnea/skillParam.json#/skill/0",
      "catalogField": "talent:linnea:combat2.parameters.param1"
    }
  ],
  "constants": [
    {
      "key": "pummelerInstanceCount",
      "value": 2,
      "sourcePath": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "sourceLocation": "line 63: skillParam_gen.skill[s++], // x2",
      "corroborationPath": "libs/gi/dm-localization/assets/locales/en/char_Linnea_gen.json",
      "corroborationField": "skill.skillParamsEncoding.0 = {{0, percent(fixed: 1)}}% DEF ×2"
    },
    {
      "key": "a1MinimumAscension",
      "value": 1,
      "sourcePath": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "sourceLocation": "lines 127-140: greaterEq(input.asc, 1, equal(condA1Lumi, on, threshold(...)))"
    },
    {
      "key": "ascendantMoonsignThreshold",
      "value": 2,
      "sourcePath": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "sourceLocation": "lines 133-137: threshold(tally.moonsign, 2, -gleamGeo_enemyRes_, -geo_enemyRes_)"
    },
    {
      "key": "a1GeoResistanceReduction",
      "value": 0.15,
      "sourcePath": "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "sourceLocation": "/passive1/0/0",
      "signConvention": "positive reduction; source applies signed resistance delta -0.15"
    },
    {
      "key": "a1AscendantTotalGeoResistanceReduction",
      "value": 0.3,
      "sourcePath": "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "sourceLocation": "/passive1/1/0",
      "signConvention": "total positive reduction; source applies signed resistance delta -0.30, not -(0.15+0.30)"
    },
    {
      "key": "a4DefToElementalMastery",
      "value": 0.05,
      "sourcePath": "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "sourceLocation": "/passive2/0/0",
      "application": "reviewed but not an additive term for ordinary DEF-scaling Geo skill damage"
    },
    {
      "key": "lumiMaximumDuration",
      "value": 25,
      "sourcePath": "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "sourceLocation": "/skill/3/0",
      "application": "duration alone does not prove number of attacks; not used to multiply selected pair"
    },
    {
      "key": "skillCooldown",
      "value": 18,
      "sourcePath": "libs/gi/stats/Data/Characters/Linnea/skillParam.json",
      "sourceLocation": "/skill/4/0",
      "application": "metadata only, not used to infer rotation legality or DPS"
    }
  ],
  "sourceLocations": [
    {
      "path": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "startLine": 62,
      "endLine": 68,
      "meaning": "single Pummeler type has x2, hammer and crush are distinct skill arrays"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "startLine": 78,
      "endLine": 81,
      "meaning": "A1 base and ascendant total RES reductions use passive source constants"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "startLine": 126,
      "endLine": 140,
      "meaning": "A1 ascension, Lumi condition, and Moonsign gates"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "startLine": 269,
      "endLine": 296,
      "meaning": "Pummeler ordinary DEF skill node is separate from hammer/crush lunar nodes"
    },
    {
      "path": "libs/gi/sheets/src/Characters/Linnea/index.tsx",
      "startLine": 340,
      "endLine": 346,
      "meaning": "A1 feeds Geo enemy resistance instead of damage bonus"
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "startLine": 68,
      "endLine": 90,
      "meaning": "skill uses character Geo element"
    },
    {
      "path": "libs/gi/sheets/src/Characters/dataUtil.tsx",
      "startLine": 165,
      "endLine": 192,
      "meaning": "ordinary DEF coefficient times total DEF; skill talent level"
    }
  ],
  "multiplicityEvidence": "Production sheet declares exactly one ordinary pummelerDmg formula with the x2 table annotation; machine skillParamsEncoding[0] independently encodes the same DEF coefficient twice. This establishes two instances of that damage type, not their interval, scheduler frequency, or whole-summon hit count.",
  "excludedFormulaModule": "libs/gi/formula/src/data/char/Linnea.ts is not used as source; only the production sheet and common helpers are classified."
} as const;
