import type { SourceHitMapping } from "./types";

/**
 * Base C0 normal / charged / aimed branches reviewed against a7dc4bf.
 * attack.go and charge.go/aimed.go determine emitted instances and element;
 * zz_*.dm.go supplies exact 15-level tables, and damage.go establishes ATK scaling.
 * N1, N2, etc. are individual inputs, never prefixes of a normal combo.
 * These conditioned direct-hit mappings do not certify complete character mechanics.
 */
export const currentNormalMappings: SourceHitMapping[] = [
  {
    "id": "iansan-normal-1-hit-1",
    "characterSlug": "iansan",
    "talentSetId": "talent-set:iansan",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "iansan-normal-1",
    "skillLabel": "基础普通攻击 N1",
    "hitLabel": "普通攻击第 1 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.469758,
      0.507994,
      0.54623,
      0.600853,
      0.639089,
      0.682787,
      0.742873,
      0.802958,
      0.863043,
      0.928591,
      0.994139,
      1.059686,
      1.125234,
      1.190781,
      1.256329
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/iansan/attack.go",
      "internal/characters/iansan/charge.go",
      "internal/characters/iansan/zz_iansan.dm.go",
      "internal/characters/iansan/iansan.go",
      "internal/characters/iansan/asc.go",
      "internal/characters/iansan/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "fastSkill 未生效；基础重击另要求 nightsoulState.HasBlessing()=false，避免替换为电元素疾驰。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "iansan-normal-2-hit-1",
    "characterSlug": "iansan",
    "talentSetId": "talent-set:iansan",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "iansan-normal-2",
    "skillLabel": "基础普通攻击 N2",
    "hitLabel": "普通攻击第 2 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.427644,
      0.462452,
      0.49726,
      0.546986,
      0.581794,
      0.621575,
      0.676274,
      0.730972,
      0.785671,
      0.845342,
      0.905013,
      0.964684,
      1.024356,
      1.084027,
      1.143698
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/iansan/attack.go",
      "internal/characters/iansan/charge.go",
      "internal/characters/iansan/zz_iansan.dm.go",
      "internal/characters/iansan/iansan.go",
      "internal/characters/iansan/asc.go",
      "internal/characters/iansan/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "fastSkill 未生效；基础重击另要求 nightsoulState.HasBlessing()=false，避免替换为电元素疾驰。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "iansan-normal-3-hit-1",
    "characterSlug": "iansan",
    "talentSetId": "talent-set:iansan",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "iansan-normal-3",
    "skillLabel": "基础普通攻击 N3",
    "hitLabel": "普通攻击第 3 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.643882,
      0.696291,
      0.7487,
      0.82357,
      0.875979,
      0.935875,
      1.018232,
      1.100589,
      1.182946,
      1.27279,
      1.362634,
      1.452478,
      1.542322,
      1.632166,
      1.72201
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/iansan/attack.go",
      "internal/characters/iansan/charge.go",
      "internal/characters/iansan/zz_iansan.dm.go",
      "internal/characters/iansan/iansan.go",
      "internal/characters/iansan/asc.go",
      "internal/characters/iansan/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "fastSkill 未生效；基础重击另要求 nightsoulState.HasBlessing()=false，避免替换为电元素疾驰。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "iansan-charged-base-hit-1",
    "characterSlug": "iansan",
    "talentSetId": "talent-set:iansan",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "iansan-charged-base",
    "skillLabel": "基础重击",
    "hitLabel": "基础重击命中",
    "element": "physical",
    "attackTag": "charged",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.00276,
      1.08438,
      1.166,
      1.2826,
      1.36422,
      1.4575,
      1.58576,
      1.71402,
      1.84228,
      1.9822,
      2.12212,
      2.26204,
      2.40196,
      2.54188,
      2.6818
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/iansan/attack.go",
      "internal/characters/iansan/charge.go",
      "internal/characters/iansan/zz_iansan.dm.go",
      "internal/characters/iansan/iansan.go",
      "internal/characters/iansan/asc.go",
      "internal/characters/iansan/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "fastSkill 未生效；基础重击另要求 nightsoulState.HasBlessing()=false，避免替换为电元素疾驰。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "ifa-normal-1-hit-1",
    "characterSlug": "ifa",
    "talentSetId": "talent-set:ifa",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "ifa-normal-1",
    "skillLabel": "基础普通攻击 N1",
    "hitLabel": "普通攻击第 1 式 · 第 1 类命中",
    "element": "anemo",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.536072,
      0.576277,
      0.616483,
      0.67009,
      0.710295,
      0.750501,
      0.804108,
      0.857715,
      0.911322,
      0.96493,
      1.018537,
      1.072144,
      1.139153,
      1.206162,
      1.273171
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/ifa/attack.go",
      "internal/characters/ifa/charge.go",
      "internal/characters/ifa/zz_ifa.dm.go",
      "internal/characters/ifa/ifa.go",
      "internal/characters/ifa/asc.go",
      "internal/characters/ifa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "nightsoulState.HasBlessing()=false；本项是基础普攻或重击，不是夜魂状态的救援射击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "ifa-normal-2-hit-1",
    "characterSlug": "ifa",
    "talentSetId": "talent-set:ifa",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "ifa-normal-2",
    "skillLabel": "基础普通攻击 N2",
    "hitLabel": "普通攻击第 2 式 · 第 1 类命中",
    "element": "anemo",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.474672,
      0.510272,
      0.545873,
      0.59334,
      0.62894,
      0.664541,
      0.712008,
      0.759475,
      0.806942,
      0.85441,
      0.901877,
      0.949344,
      1.008678,
      1.068012,
      1.127346
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/ifa/attack.go",
      "internal/characters/ifa/charge.go",
      "internal/characters/ifa/zz_ifa.dm.go",
      "internal/characters/ifa/ifa.go",
      "internal/characters/ifa/asc.go",
      "internal/characters/ifa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "nightsoulState.HasBlessing()=false；本项是基础普攻或重击，不是夜魂状态的救援射击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "ifa-normal-3-hit-1",
    "characterSlug": "ifa",
    "talentSetId": "talent-set:ifa",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "ifa-normal-3",
    "skillLabel": "基础普通攻击 N3",
    "hitLabel": "普通攻击第 3 式 · 第 1 类命中",
    "element": "anemo",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.747584,
      0.803653,
      0.859722,
      0.93448,
      0.990549,
      1.046618,
      1.121376,
      1.196134,
      1.270893,
      1.345651,
      1.42041,
      1.495168,
      1.588616,
      1.682064,
      1.775512
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/ifa/attack.go",
      "internal/characters/ifa/charge.go",
      "internal/characters/ifa/zz_ifa.dm.go",
      "internal/characters/ifa/ifa.go",
      "internal/characters/ifa/asc.go",
      "internal/characters/ifa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "nightsoulState.HasBlessing()=false；本项是基础普攻或重击，不是夜魂状态的救援射击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "ifa-charged-base-hit-1",
    "characterSlug": "ifa",
    "talentSetId": "talent-set:ifa",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "ifa-charged-base",
    "skillLabel": "基础重击",
    "hitLabel": "基础重击命中",
    "element": "anemo",
    "attackTag": "charged",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.4704,
      1.58068,
      1.69096,
      1.838,
      1.94828,
      2.05856,
      2.2056,
      2.35264,
      2.49968,
      2.64672,
      2.79376,
      2.9408,
      3.1246,
      3.3084,
      3.4922
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/ifa/attack.go",
      "internal/characters/ifa/charge.go",
      "internal/characters/ifa/zz_ifa.dm.go",
      "internal/characters/ifa/ifa.go",
      "internal/characters/ifa/asc.go",
      "internal/characters/ifa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "nightsoulState.HasBlessing()=false；本项是基础普攻或重击，不是夜魂状态的救援射击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "jahoda-normal-1-hit-1",
    "characterSlug": "jahoda",
    "talentSetId": "talent-set:jahoda",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "jahoda-normal-1",
    "skillLabel": "基础普通攻击 N1",
    "hitLabel": "普通攻击第 1 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.416739,
      0.450659,
      0.48458,
      0.533038,
      0.566959,
      0.605725,
      0.659029,
      0.712333,
      0.765636,
      0.823786,
      0.881936,
      0.940085,
      0.998235,
      1.056384,
      1.114534
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/jahoda/attack.go",
      "internal/characters/jahoda/aimed.go",
      "internal/characters/jahoda/zz_jahoda.dm.go",
      "internal/characters/jahoda/jahoda.go",
      "internal/characters/jahoda/asc.go",
      "internal/characters/jahoda/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "基础普攻与瞄准不包含战技猫球或爆发机器人的独立攻击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "jahoda-normal-2-hit-1",
    "characterSlug": "jahoda",
    "talentSetId": "talent-set:jahoda",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "jahoda-normal-2",
    "skillLabel": "基础普通攻击 N2",
    "hitLabel": "普通攻击第 2 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 2,
    "sourceCoefficientValues": [
      0.192313,
      0.207967,
      0.22362,
      0.245982,
      0.261635,
      0.279525,
      0.304123,
      0.328721,
      0.35332,
      0.380154,
      0.406988,
      0.433823,
      0.460657,
      0.487492,
      0.514326
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/jahoda/attack.go",
      "internal/characters/jahoda/aimed.go",
      "internal/characters/jahoda/zz_jahoda.dm.go",
      "internal/characters/jahoda/jahoda.go",
      "internal/characters/jahoda/asc.go",
      "internal/characters/jahoda/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "基础普攻与瞄准不包含战技猫球或爆发机器人的独立攻击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "jahoda-normal-3-hit-1",
    "characterSlug": "jahoda",
    "talentSetId": "talent-set:jahoda",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "jahoda-normal-3",
    "skillLabel": "基础普通攻击 N3",
    "hitLabel": "普通攻击第 3 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.511975,
      0.553648,
      0.59532,
      0.654852,
      0.696524,
      0.74415,
      0.809635,
      0.87512,
      0.940606,
      1.012044,
      1.083482,
      1.154921,
      1.226359,
      1.297798,
      1.369236
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/jahoda/attack.go",
      "internal/characters/jahoda/aimed.go",
      "internal/characters/jahoda/zz_jahoda.dm.go",
      "internal/characters/jahoda/jahoda.go",
      "internal/characters/jahoda/asc.go",
      "internal/characters/jahoda/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "基础普攻与瞄准不包含战技猫球或爆发机器人的独立攻击。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "jahoda-aimed-physical-hit-1",
    "characterSlug": "jahoda",
    "talentSetId": "talent-set:jahoda",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "jahoda-aimed-physical",
    "skillLabel": "未蓄满瞄准射击",
    "hitLabel": "未蓄满瞄准箭",
    "element": "physical",
    "attackTag": "charged",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.4386,
      0.4743,
      0.51,
      0.561,
      0.5967,
      0.6375,
      0.6936,
      0.7497,
      0.8058,
      0.867,
      0.9282,
      0.9894,
      1.0506,
      1.1118,
      1.173
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/jahoda/attack.go",
      "internal/characters/jahoda/aimed.go",
      "internal/characters/jahoda/zz_jahoda.dm.go",
      "internal/characters/jahoda/jahoda.go",
      "internal/characters/jahoda/asc.go",
      "internal/characters/jahoda/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "基础普攻与瞄准不包含战技猫球或爆发机器人的独立攻击。",
      "hold=AimParamPhys；weakspot=0，不默认触发弱点必暴。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "jahoda-aimed-fully-charged-hit-1",
    "characterSlug": "jahoda",
    "talentSetId": "talent-set:jahoda",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "jahoda-aimed-fully-charged",
    "skillLabel": "蓄满瞄准射击",
    "hitLabel": "蓄满风元素瞄准箭",
    "element": "anemo",
    "attackTag": "charged",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.24,
      1.333,
      1.426,
      1.55,
      1.643,
      1.736,
      1.86,
      1.984,
      2.108,
      2.232,
      2.356,
      2.48,
      2.635,
      2.79,
      2.945
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/jahoda/attack.go",
      "internal/characters/jahoda/aimed.go",
      "internal/characters/jahoda/zz_jahoda.dm.go",
      "internal/characters/jahoda/jahoda.go",
      "internal/characters/jahoda/asc.go",
      "internal/characters/jahoda/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "基础普攻与瞄准不包含战技猫球或爆发机器人的独立攻击。",
      "hold=AimParamLv1；weakspot=0，不默认触发弱点必暴。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "prune-normal-1-hit-1",
    "characterSlug": "prune",
    "talentSetId": "talent-set:prune",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "prune-normal-1",
    "skillLabel": "基础普通攻击 N1",
    "hitLabel": "普通攻击第 1 式 · 第 1 类命中",
    "element": "anemo",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.486208,
      0.522674,
      0.559139,
      0.60776,
      0.644226,
      0.680691,
      0.729312,
      0.777933,
      0.826554,
      0.875174,
      0.923795,
      0.972416,
      1.033192,
      1.093968,
      1.154744
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/prune/attack.go",
      "internal/characters/prune/charge.go",
      "internal/characters/prune/zz_prune.dm.go",
      "internal/characters/prune/prune.go",
      "internal/characters/prune/asc.go",
      "internal/characters/prune/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "输入的是命中时攻击力，已生效的魔导等攻击力增益若适用须显式计入；不从队伍状态自动推导。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "prune-normal-2-hit-1",
    "characterSlug": "prune",
    "talentSetId": "talent-set:prune",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "prune-normal-2",
    "skillLabel": "基础普通攻击 N2",
    "hitLabel": "普通攻击第 2 式 · 第 1 类命中",
    "element": "anemo",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.482808,
      0.519019,
      0.555229,
      0.60351,
      0.639721,
      0.675931,
      0.724212,
      0.772493,
      0.820774,
      0.869054,
      0.917335,
      0.965616,
      1.025967,
      1.086318,
      1.146669
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/prune/attack.go",
      "internal/characters/prune/charge.go",
      "internal/characters/prune/zz_prune.dm.go",
      "internal/characters/prune/prune.go",
      "internal/characters/prune/asc.go",
      "internal/characters/prune/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "输入的是命中时攻击力，已生效的魔导等攻击力增益若适用须显式计入；不从队伍状态自动推导。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "prune-normal-3-hit-1",
    "characterSlug": "prune",
    "talentSetId": "talent-set:prune",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "prune-normal-3",
    "skillLabel": "基础普通攻击 N3",
    "hitLabel": "普通攻击第 3 式 · 第 1 类命中",
    "element": "anemo",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.679768,
      0.730751,
      0.781733,
      0.84971,
      0.900693,
      0.951675,
      1.019652,
      1.087629,
      1.155606,
      1.223582,
      1.291559,
      1.359536,
      1.444507,
      1.529478,
      1.614449
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/prune/attack.go",
      "internal/characters/prune/charge.go",
      "internal/characters/prune/zz_prune.dm.go",
      "internal/characters/prune/prune.go",
      "internal/characters/prune/asc.go",
      "internal/characters/prune/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "输入的是命中时攻击力，已生效的魔导等攻击力增益若适用须显式计入；不从队伍状态自动推导。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "prune-charged-base-hit-1",
    "characterSlug": "prune",
    "talentSetId": "talent-set:prune",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "prune-charged-base",
    "skillLabel": "基础重击",
    "hitLabel": "基础重击命中",
    "element": "anemo",
    "attackTag": "charged",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.3352,
      1.43534,
      1.53548,
      1.669,
      1.76914,
      1.86928,
      2.0028,
      2.13632,
      2.26984,
      2.40336,
      2.53688,
      2.6704,
      2.8373,
      3.0042,
      3.1711
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/prune/attack.go",
      "internal/characters/prune/charge.go",
      "internal/characters/prune/zz_prune.dm.go",
      "internal/characters/prune/prune.go",
      "internal/characters/prune/asc.go",
      "internal/characters/prune/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "输入的是命中时攻击力，已生效的魔导等攻击力增益若适用须显式计入；不从队伍状态自动推导。",
      "NormalCounter≠0；重击输入已通过前置普通攻击的合法性检查，此处只计算重击本身，不自动累加前置 N。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-normal-1-hit-1",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "odette-normal-1",
    "skillLabel": "基础普通攻击 N1",
    "hitLabel": "普通攻击第 1 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.518571,
      0.560781,
      0.60299,
      0.663289,
      0.705498,
      0.753738,
      0.820066,
      0.886395,
      0.952724,
      1.025083,
      1.097442,
      1.169801,
      1.242159,
      1.314518,
      1.386877
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-normal-2-hit-1",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "odette-normal-2",
    "skillLabel": "基础普通攻击 N2",
    "hitLabel": "普通攻击第 2 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.515106,
      0.557033,
      0.59896,
      0.658856,
      0.700783,
      0.7487,
      0.814586,
      0.880471,
      0.946357,
      1.018232,
      1.090107,
      1.161982,
      1.233858,
      1.305733,
      1.377608
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-normal-3-hit-1",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "odette-normal-3",
    "skillLabel": "基础普通攻击 N3",
    "hitLabel": "普通攻击第 3 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.326112,
      0.352656,
      0.3792,
      0.41712,
      0.443664,
      0.474,
      0.515712,
      0.557424,
      0.599136,
      0.64464,
      0.690144,
      0.735648,
      0.781152,
      0.826656,
      0.87216
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-normal-3-hit-2",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "odette-normal-3",
    "skillLabel": "基础普通攻击 N3",
    "hitLabel": "普通攻击第 3 式 · 第 2 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.382786,
      0.413943,
      0.4451,
      0.48961,
      0.520767,
      0.556375,
      0.605336,
      0.654297,
      0.703258,
      0.75667,
      0.810082,
      0.863494,
      0.916906,
      0.970318,
      1.02373
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-normal-4-hit-1",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "odette-normal-4",
    "skillLabel": "基础普通攻击 N4",
    "hitLabel": "普通攻击第 4 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.745732,
      0.806431,
      0.86713,
      0.953843,
      1.014542,
      1.083912,
      1.179297,
      1.274681,
      1.370065,
      1.474121,
      1.578177,
      1.682232,
      1.786288,
      1.890343,
      1.994399
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-normal-5-hit-1",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param6",
    "skillId": "odette-normal-5",
    "skillLabel": "基础普通攻击 N5",
    "hitLabel": "普通攻击第 5 式 · 第 1 类命中",
    "element": "physical",
    "attackTag": "normal",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.902123,
      0.975551,
      1.04898,
      1.153878,
      1.227307,
      1.311225,
      1.426613,
      1.542001,
      1.657388,
      1.783266,
      1.909144,
      2.035021,
      2.160899,
      2.286776,
      2.412654
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  },
  {
    "id": "odette-charged-base-hit-1",
    "characterSlug": "odette",
    "talentSetId": "talent-set:odette",
    "abilityKey": "combat1",
    "parameterKey": "param7",
    "skillId": "odette-charged-base",
    "skillLabel": "基础重击",
    "hitLabel": "基础重击命中",
    "element": "physical",
    "attackTag": "charged",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.07414,
      1.16157,
      1.249,
      1.3739,
      1.46133,
      1.56125,
      1.69864,
      1.83603,
      1.97342,
      2.1233,
      2.27318,
      2.42306,
      2.57294,
      2.72282,
      2.8727
    ],
    "coefficientTolerance": 0,
    "sourceCommit": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
    "sourcePaths": [
      "internal/characters/odette/attack.go",
      "internal/characters/odette/charge.go",
      "internal/characters/odette/zz_odette.dm.go",
      "internal/characters/odette/odette.go",
      "internal/characters/odette/asc.go",
      "internal/characters/odette/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；仅计算这一次输入产生且实际命中目标的自身直接伤害；无外部元素附魔。",
      "攻击力、伤害加成、敌人状态为命中时实际面板；反应及其他额外伤害实体须单独计算。",
      "仅基础物理普通攻击/重击；不含舞伴、星辉攻击与其他动作引起的独立命中。"
    ],
    "exclusions": [
      "未将前置普攻、其他输入、队友协同攻击、武器/圣遗物独立触发及反应实体并入本动作总伤害。",
      "此映射只验证所列直接伤害字段与执行分支，不表示整名角色、命座、天赋触发、能量和循环全部可模拟。"
    ],
    "completeAction": true
  }
];

export const currentNormalMappingExclusions = [
  {
    "characterSlug": "iansan",
    "action": "swift-stormflight-replacement",
    "sourcePath": "internal/characters/iansan/charge.go",
    "reason": "基础攻击仅采用 fastSkill=false 分支；夜魂/fastSkill 的疾驰使用 swift[TalentLvlSkill()]，而数值表与目录字段归属 combat1.param5，必须另行保存跨天赋等级上下文。"
  },
  {
    "characterSlug": "ifa",
    "action": "tonic-shot-replacement",
    "sourcePath": "internal/characters/ifa/charge.go",
    "reason": "夜魂状态的点按/长按均是 combat2 的 skillDmg 且标记普通攻击，不能沿用本模块 combat1 的基础普攻/重击倍率。"
  },
  {
    "characterSlug": "jahoda",
    "action": "aimed-weakspot",
    "sourcePath": "internal/characters/jahoda/aimed.go",
    "reason": "本模块固定 weakspot=0；弱点命中的必暴和命中条件未作为本基础瞄准动作自动推导。"
  },
  {
    "characterSlug": "prune",
    "action": "charged-without-normal-prerequisite",
    "sourcePath": "internal/characters/prune/prune.go",
    "reason": "NextQueueItemIsValid 明确拒绝 NormalCounter=0 的重击；独立伤害计算以合法重击已发生为条件，不证明轮转前置动作合法。"
  },
  {
    "characterSlug": "odette",
    "action": "stellar-and-dance-double-attacks",
    "sourcePath": "internal/characters/odette/odette.go",
    "reason": "本模块只包含战斗天赋一的基础物理动作；舞伴、特殊战技及星辉反应有独立执行上下文，不合并到基础普攻或重击。"
  }
] as const;

export const currentNormalSourceEvidence = {
  "revision": "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
  "archiveUrl": "https://codeload.github.com/genshinsim/gcsim/tar.gz/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
  "archiveSha256": "c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165",
  "retrievedAt": "2026-09-23T07:12:17.138350+00:00",
  "sourceSha256": {
    "internal/characters/iansan/asc.go": "d88c164485eeab10789d1ec256aeb636910d08f0f2c6ca8424d007aa5fe12360",
    "internal/characters/iansan/attack.go": "020377cb0e2b8d945b48e0f2f9925ce7954684b5aa57213a434c25ebfaa1e97c",
    "internal/characters/iansan/charge.go": "af3cedb1a1b13a26b09e901d942de0ede63a1a4dcdd7afe1449bd4246c9cae91",
    "internal/characters/iansan/cons.go": "7411ebc9bb7a168204461d0e740ebb438e4710a3dafcf830aa0ffa0d53a1a276",
    "internal/characters/iansan/iansan.go": "0a405ccf6284d152820171b59d4619eb4c253e7aff0d3b2b3edfb17848461f22",
    "internal/characters/iansan/zz_iansan.dm.go": "7ee6b65bcbdc6816139dd07cf5c5b4f582181efae11c8356f46b55f8635f074d",
    "internal/characters/ifa/asc.go": "73f94c0bbaac3de09d483c853bb7ccd9d3c802ce5e81263ec950cd9fcd77fcdb",
    "internal/characters/ifa/attack.go": "1f520d59c62e259fd86fd7f3c0c725215ec6ffeae09e5074fa15f671965fb307",
    "internal/characters/ifa/charge.go": "53d1e42c88dd71663a4f7fbf0daf5fb7de883a3b1884ed76a3c528b088f726d0",
    "internal/characters/ifa/cons.go": "9461194d95f2399dc67ce739468e8b032291fd80d3412b25c3176ea54c5e4957",
    "internal/characters/ifa/ifa.go": "5a4311efff2711b07d55e7c3e2be6826fe5ab9117d984ed46775c1b47008651c",
    "internal/characters/ifa/zz_ifa.dm.go": "e5df087efaa813a1741106fc76acd79f8f73ae38dc7b0d57de271ac16447b0f2",
    "internal/characters/jahoda/aimed.go": "9ab4220c0a9b3e1b9fd1cd04bb43f859c255fc42091d49b0c4801f7232685619",
    "internal/characters/jahoda/asc.go": "ed1f58de5e9d8a45e0b86ffd1d9f63d17cb2874de93a3ccbb5b4da3127563577",
    "internal/characters/jahoda/attack.go": "a240752fd8b5c99db79d0e06b8a7c336b2f1cac949d9dda021c502fbfdd435d0",
    "internal/characters/jahoda/cons.go": "9e76fca90f7ecca4efcffe357d7e1314dd064c8a5c9a86d627cc44182141023b",
    "internal/characters/jahoda/jahoda.go": "04b639a924ad26d50ba2c68ab5257c1c8afcd354206d73680f008605e39f2a32",
    "internal/characters/jahoda/zz_jahoda.dm.go": "7a3dcf3579777279ddb03d7008f74fbc5d31eda9ccaa5fa606629fada639013a",
    "internal/characters/odette/asc.go": "0b029beaf4b02ff4fef779524829c811dc0cbc706f27a29a5c43f78138d2416e",
    "internal/characters/odette/attack.go": "6fd582fcf80943f93981e181047ccdc3316bf51a73c379fd56f07e2221f13928",
    "internal/characters/odette/charge.go": "e3c5f73f2280be30c62e3d28a600be46a8fb2690af8360bdb2ca7a4641390305",
    "internal/characters/odette/cons.go": "ca8d6ad5be5371e50c42bf718384db51fd39204659efc4404e6cd4f6c3917420",
    "internal/characters/odette/odette.go": "4a05abf00902fe0d6280d7a12900bf4324e78b84eac1f552ee4d6eb8b3884cdc",
    "internal/characters/odette/zz_odette.dm.go": "0cff04e5f3cffa217872a8ad16d72ddaf9bf383bfd1e55e91fc2e2e105402262",
    "internal/characters/prune/asc.go": "ea518c78403705cf8eb79c634d68fd2c63cbad2ee931541c1003af5f49d4238f",
    "internal/characters/prune/attack.go": "b1523b55cc404e5c8ed23577220ae260c04b1952a3e8e7d0bdb4c8dc8289b21f",
    "internal/characters/prune/charge.go": "c1de46a648d8c6a9aaa42d7f9e7408d308a0c25123bf6193d0dfbe5de9f4b0a4",
    "internal/characters/prune/cons.go": "1b559599a78cd46d96cc85d3f1306bc50dd4ba27580d6cd20ce7211a31425e0c",
    "internal/characters/prune/prune.go": "2a88ca7e2ba1a2bdf7b8205936523f6bc27d62dd66fdb0fa876997cfab6e6307",
    "internal/characters/prune/zz_prune.dm.go": "cbaa51ddbb73fff7d3aa0ff57a4f3ea31a29b49a6881f4c375fe0a9015c63a8b",
    "pkg/enemy/damage.go": "444bdc0a1578fcdf2b7371e48aa767138975903fb4ee8d956722f6c4f56b22ae"
  },
  "classificationScope": "C0 base normal/charged/aimed direct hits under explicit action-state assumptions",
  "numericComparison": "exact full 15-level source vector; absolute tolerance 0",
  "normalActions": 17,
  "chargedOrAimedActions": 6,
  "mappedCoefficientFamilies": 24,
  "emittedInstances": 25
} as const;
