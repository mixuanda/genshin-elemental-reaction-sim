import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterScalarDescriptor } from "./source-host-character-scalar-formula";

const b4 = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const a7 = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [b4, a7] as const;
const stellar = [a7] as const;
const level = { label: "原生技能天赋索引", unit: "level", minimum: 0, maximum: 14, integer: true } as const;
const em = { label: "原生本次元素精通", unit: "EM" } as const;
const maxHP = { label: "原生本次最大生命值", unit: "HP" } as const;
const stacks = { label: "原生当前层数", unit: "stack", minimum: 0, integer: true } as const;
const table = (key: string, values: readonly number[]): FormulaExpression =>
  values.reduceRight<FormulaExpression>((rest, value, index) =>
    expr.condition("equal", expr.input(key), expr.value(index), expr.value(value), rest), expr.value(values[values.length - 1]!));
const mizukiB4 = [0.0018, 0.0021, 0.0024, 0.0027, 0.003, 0.0033, 0.0036, 0.0039, 0.0042, 0.0045, 0.0048, 0.0051, 0.0054, 0.0057, 0.006] as const;
const mizukiA7 = [0.18, 0.21, 0.24, 0.27, 0.3, 0.33, 0.36, 0.39, 0.42, 0.45, 0.48, 0.51, 0.54, 0.57, 0.6] as const;
const mizukiStellar = [0.018, 0.021, 0.024, 0.027, 0.03, 0.033, 0.036, 0.039, 0.042, 0.045, 0.048, 0.051, 0.054, 0.057, 0.06] as const;
const odetteBurst = [0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5, 0.54, 0.58, 0.62, 0.66, 0.7] as const;
const ifaMemberKind = { label: "原队员夜魂读取结果：0未迭代、1错误、2非浮点、3有效", unit: "branch", choices: [
  { value: 0, label: "未迭代" }, { value: 1, label: "Condition 错误" },
  { value: 2, label: "不是 float64" }, { value: 3, label: "有效 float64" },
] } as const;
const legacyIfaState = {
  nightsoul: { label: "原生队伍夜魂值", unit: "point" },
  bonusPoints: { label: "原生二命追加值", unit: "point" },
  capIncrease: { label: "原生二命上限增加", unit: "point" },
} as const;
const legacyIfaPoints = expr.min(expr.add(expr.input("nightsoul"), expr.input("bonusPoints")), expr.add(expr.value(150), expr.input("capIncrease")));
const ifaDerivedState = {
  cons: { label: "原生命座", unit: "level", minimum: 0, integer: true },
  ascension: { label: "原生突破等级", unit: "level", minimum: 0, integer: true },
  teamCount: { label: "原团队实际迭代人数", unit: "count", minimum: 1, maximum: 4, integer: true },
  member0Kind: ifaMemberKind, member0Points: { label: "第 1 位队员有效夜魂点；其它读取分支为零占位", unit: "point" },
  member1Kind: ifaMemberKind, member1Points: { label: "第 2 位队员有效夜魂点；其它读取分支为零占位", unit: "point" },
  member2Kind: ifaMemberKind, member2Points: { label: "第 3 位队员有效夜魂点；其它读取分支为零占位", unit: "point" },
  member3Kind: ifaMemberKind, member3Points: { label: "第 4 位队员有效夜魂点；其它读取分支为零占位", unit: "point" },
} as const;
const ifaTeamNightsoul = [0, 1, 2, 3].reduce<FormulaExpression>((sum, index) => expr.add(sum,
  expr.condition("equal", expr.input(`member${index}Kind`), expr.value(3), expr.input(`member${index}Points`), expr.value(0))), expr.value(0));
const ifaBonusPoints = expr.condition("lt", expr.input("cons"), expr.value(2), expr.value(0),
  expr.mul(expr.max(expr.sub(ifaTeamNightsoul, expr.value(60)), expr.value(0)), expr.value(3)));
const ifaCapIncrease = expr.condition("lt", expr.input("cons"), expr.value(2), expr.value(0),
  expr.condition("lt", expr.input("ascension"), expr.value(1), expr.value(0), expr.value(50)));
const ifaDerivedPoints = expr.min(expr.add(ifaTeamNightsoul, ifaBonusPoints), expr.add(expr.value(150), ifaCapIncrease));

export const characterScalarRulesB = {
  "char-scalar-aino-c6": { character: "aino", title: "爱诺六命反应加成", kind: "reaction-bonus", modifierKey: "aino-c6-buff", sourceFile: "internal/characters/aino/cons.go", sourceCommits: both, phase: "read", inputs: { moonsign: { label: "原生当前月兆等级", unit: "level", minimum: 0, integer: true } }, expression: expr.add(expr.value(0.15), expr.condition("lt", expr.input("moonsign"), expr.value(2), expr.value(0), expr.value(0.2))), explanation: "原生状态、场上受益者和反应标签门后，基础 15% 加满辉 20%。" },
  "char-scalar-baizhu-a4-catalyzed": { character: "baizhu", title: "白术四阶激化加成", kind: "reaction-bonus", modifierKey: "baizhu-a4", sourceFile: "internal/characters/baizhu/asc.go", sourceCommits: both, phase: "read", statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, inputs: { maxHP }, expression: expr.mul(expr.min(expr.div(expr.input("maxHP"), expr.value(1000)), expr.value(50)), expr.value(0.008)), explanation: "原生激化类型门后，以白术最大生命值每千点 0.8%，按五十千上限。" },
  "char-scalar-baizhu-a4-bloom-family": { character: "baizhu", title: "白术四阶绽放类加成", kind: "reaction-bonus", modifierKey: "baizhu-a4", sourceFile: "internal/characters/baizhu/asc.go", sourceCommits: both, phase: "read", statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, inputs: { maxHP }, expression: expr.mul(expr.min(expr.div(expr.input("maxHP"), expr.value(1000)), expr.value(50)), expr.value(0.02)), explanation: "原生 Bloom、Hyperbloom、Burgeon、Burning 空 case 保留初始倍率 0.02。" },
  "char-scalar-baizhu-a4-direct-lunar-bloom": { character: "baizhu", title: "白术四阶直伤月绽放加成", kind: "reaction-bonus", modifierKey: "baizhu-a4", sourceFile: "internal/characters/baizhu/asc.go", sourceCommits: both, phase: "read", statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, inputs: { maxHP }, expression: expr.mul(expr.min(expr.div(expr.input("maxHP"), expr.value(1000)), expr.value(50)), expr.value(0.007)), explanation: "只有原生 DirectLunarBloom case 将初始倍率改为 0.007。" },
  "char-scalar-durin-a1-black": { character: "durin", title: "杜林黑形态增幅反应", kind: "reaction-bonus", modifierKey: "durin-a1-black", sourceFile: "internal/characters/durin/asc.go", sourceCommits: both, phase: "read", inputs: { bonusFactor: { label: "原生魔导协同因子", unit: "factor", choices: [{ value: 1, label: "普通" }, { value: 1.75, label: "双魔导" }] } }, expression: expr.mul(expr.value(0.4), expr.input("bonusFactor")), explanation: "原生增幅门后，用现有 hexereiA1Bonus 因子计算，白形态删除仍由 Go 控制。" },
  "char-scalar-durin-a1-black-derived": { character: "durin", title: "杜林黑形态增幅反应原始分支", kind: "reaction-bonus", modifierKey: "durin-a1-black", sourceFile: "internal/characters/durin/asc.go", sourceCommits: both, phase: "read", inputs: { isHexerei: { label: "杜林原生魔导身份", unit: "flag", choices: [{ value: 0, label: "否" }, { value: 1, label: "是" }] }, hexereiCount: { label: "魔导队员数；非魔导分支未读取时为零占位", unit: "count", minimum: 0, integer: true } }, expression: expr.mul(expr.value(0.4), expr.condition("equal", expr.input("isHexerei"), expr.value(0), expr.value(1), expr.condition("lt", expr.input("hexereiCount"), expr.value(2), expr.value(1), expr.value(1.75)))), explanation: "原生增幅门后按 IsHexerei 和实际队伍魔导人数展开 1 或 1.75 因子；非魔导分支不额外读取队伍，白形态删除仍由 Go 控制。" },
  "char-scalar-ineffa-c1": { character: "ineffa", title: "伊涅芙一命月感电加成", kind: "reaction-bonus", modifierKey: "ineffa-c1-buff", sourceFile: "internal/characters/ineffa/cons.go", sourceCommits: both, phase: "read", statLeaf: { stateKey: "totalAtk", getter: "total-atk", actor: "holder" }, inputs: { totalAtk: { label: "原生本次总攻击力", unit: "ATK" } }, expression: expr.min(expr.mul(expr.div(expr.input("totalAtk"), expr.value(100)), expr.value(0.025)), expr.value(0.5)), explanation: "原生命座状态与月感电标签门后，读取一次总攻击力并按 50% 上限计算。" },
  "char-scalar-mizuki-swirl-b4": { character: "mizuki", title: "梦见月瑞希扩散增伤经典版", kind: "reaction-bonus", modifierKey: "mizuki-swirl-buff", sourceFile: "internal/characters/mizuki/skill.go", sourceCommits: [b4], phase: "read", statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" }, inputs: { talentLevel: level, em }, expression: expr.mul(table("talentLevel", mizukiB4), expr.input("em")), explanation: "b4 原生技能表每点精通系数乘一次当前元素精通；扩散与状态门保留。" },
  "char-scalar-mizuki-swirl-a7": { character: "mizuki", title: "梦见月瑞希扩散增伤星辉版", kind: "reaction-bonus", modifierKey: "mizuki-swirl-buff", sourceFile: "internal/characters/mizuki/skill.go", sourceCommits: stellar, phase: "read", statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" }, inputs: { talentLevel: level, em }, expression: expr.mul(table("talentLevel", mizukiA7), expr.input("em"), expr.value(0.01)), explanation: "a7 原生每百点精通表乘当前元素精通再乘 0.01，保留其算术次序。" },
  "char-scalar-mizuki-stellar-swirl-a7": { character: "mizuki", title: "梦见月瑞希星辉扩散增伤", kind: "reaction-bonus", modifierKey: "mizuki-swirl-buff", sourceFile: "internal/characters/mizuki/skill.go", sourceCommits: stellar, phase: "read", statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" }, inputs: { talentLevel: level, em }, expression: expr.mul(table("talentLevel", mizukiStellar), expr.input("em"), expr.value(0.01)), explanation: "a7 专有星辉扩散表；原本的技能状态、增幅及激化排除门仍在 Go。" },
  "char-scalar-mona-astral-glow": { character: "mona", title: "莫娜星辉层数蒸发加成", kind: "reaction-bonus", modifierKey: "mona-hexerei-astral-glow-vaporize", sourceFile: "internal/characters/mona/asc.go", sourceCommits: both, phase: "read", inputs: { stacks }, expression: expr.mul(expr.value(0.05), expr.input("stacks")), explanation: "先捕获清零前真实层数，数值计算后仍在原回调位置由 Go 清层。" },
  "char-scalar-mona-c1": { character: "mona", title: "莫娜一命水系反应加成", kind: "reaction-bonus", modifierKey: "mona-c1", sourceFile: "internal/characters/mona/cons.go", sourceCommits: both, phase: "read", inputs: { enhanced: { label: "魔导且受益者在后台", unit: "flag", choices: [{ value: 0, label: "否" }, { value: 1, label: "是" }] } }, expression: expr.condition("equal", expr.input("enhanced"), expr.value(1), expr.mul(expr.value(0.15), expr.value(1.6)), expr.value(0.15)), explanation: "保留原短路场上检查和反应门，后台魔导分支将 15% 乘 1.6。" },
  "char-scalar-nilou-a4-initial": { character: "nilou", title: "妮露四阶初始零值", kind: "reaction-bonus", modifierKey: "nilou-a4", sourceFile: "internal/characters/nilou/asc.go", sourceCommits: both, phase: "creation", inputs: {}, expression: expr.value(0), explanation: "仅首次创建原生三十秒 modifier 时登记字段默认零值；以后重新施放沿用上次更新的值及回执。" },
  "char-scalar-nilou-a4-update": { character: "nilou", title: "妮露四阶丰穰之核定时加成", kind: "reaction-bonus", modifierKey: "nilou-a4", sourceFile: "internal/characters/nilou/asc.go", sourceCommits: both, phase: "creation", statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, inputs: { maxHP }, expression: expr.clamp(expr.mul(expr.mul(expr.sub(expr.input("maxHP"), expr.value(30000)), expr.value(0.001)), expr.value(0.09)), expr.value(0), expr.value(4)), explanation: "每三十帧在原任务更新处读取一次最大生命值；消费回调保留 Bloom 与丰穰之核 ICD 门。" },
  "char-scalar-ifa-a1-swirl-ec": { character: "ifa", title: "伊法扩散感电夜魂加成", kind: "reaction-bonus", modifierKey: "ifa-a1", sourceFile: "internal/characters/ifa/asc.go", sourceCommits: stellar, phase: "read", inputs: legacyIfaState, expression: expr.mul(expr.value(0.015), legacyIfaPoints), explanation: "a7 原生队伍夜魂、二命追加和上限叶值在日志前各读取一次，再按对应反应标签计算。" },
  "char-scalar-ifa-a1-lunar-stellar": { character: "ifa", title: "伊法月感电星辉扩散夜魂加成", kind: "reaction-bonus", modifierKey: "ifa-a1", sourceFile: "internal/characters/ifa/asc.go", sourceCommits: stellar, phase: "read", inputs: legacyIfaState, expression: expr.mul(expr.value(0.002), legacyIfaPoints), explanation: "a7 专有星辉扩散与月感电标签分支，原 Go 保留状态与日志。" },
  "char-scalar-ifa-a1-swirl-ec-derived": { character: "ifa", title: "伊法扩散感电夜魂原始推导", kind: "reaction-bonus", modifierKey: "ifa-a1", sourceFile: "internal/characters/ifa/asc.go", sourceCommits: stellar, phase: "read", inputs: ifaDerivedState, expression: expr.mul(expr.value(0.015), ifaDerivedPoints), explanation: "a7 按原队员顺序、Condition 错误与 float64 分支逐项求和，再由二命及突破分支计算追加点数和上限；日志仍由 Go 保留。" },
  "char-scalar-ifa-a1-lunar-stellar-derived": { character: "ifa", title: "伊法月感电星辉扩散夜魂原始推导", kind: "reaction-bonus", modifierKey: "ifa-a1", sourceFile: "internal/characters/ifa/asc.go", sourceCommits: stellar, phase: "read", inputs: ifaDerivedState, expression: expr.mul(expr.value(0.002), ifaDerivedPoints), explanation: "a7 星辉／月感电分支复用同次原生队员读取，二命加点和上限在共享 AST 展开。" },
  "char-scalar-qiqi-revelation-conduct": { character: "qiqi", title: "七七启明星辉超导加成", kind: "reaction-bonus", modifierKey: "qiqi-revelation-ssc", sourceFile: "internal/characters/qiqi/stellar.go", sourceCommits: stellar, phase: "read", inputs: {}, expression: expr.value(0.5), explanation: "a7 启明和当前辉光状态、超导或星辉超导标签门后返回 50%。" },
  "char-scalar-qiqi-revelation-swirl": { character: "qiqi", title: "七七启明星辉扩散加成", kind: "reaction-bonus", modifierKey: "qiqi-revelation-ssw", sourceFile: "internal/characters/qiqi/stellar.go", sourceCommits: stellar, phase: "read", inputs: {}, expression: expr.value(0.5), explanation: "a7 启明和辉光状态、冰扩散或星辉扩散标签门后返回 50%。" },
  "char-scalar-cryo-traveler-c6": { character: "traveler", title: "冰旅行者六命星辉加成", kind: "reaction-bonus", modifierKey: "travelercryo-c6", sourceFile: "internal/characters/traveler/common/cryo/cons.go", sourceCommits: stellar, phase: "read", inputs: { stacks }, expression: expr.mul(expr.value(0.05), expr.input("stacks")), explanation: "a7 原爆发捕获层数和原特殊反应标签门后，每层 5%。" },
  "char-scalar-yaemiko-c1-stellar": { character: "yaemiko", title: "八重神子一命星辉超导加成", kind: "reaction-bonus", modifierKey: "yae-c1-ssc", sourceFile: "internal/characters/yaemiko/cons.go", sourceCommits: stellar, phase: "read", inputs: {}, expression: expr.value(0.5), explanation: "a7 原启明与直接星辉超导标签门后返回 50%。" },
  "char-scalar-odette-a1-self": { character: "odette", title: "奥黛特一阶自身星辉层数", kind: "reaction-bonus", modifierKey: "odette-a1-buff", sourceFile: "internal/characters/odette/asc.go", sourceCommits: stellar, phase: "read", inputs: { stacks }, expression: expr.mul(expr.input("stacks"), expr.value(0.15)), explanation: "a7 自身舞伴状态与标签门后读取自身真实层数。" },
  "char-scalar-odette-a1-others": { character: "odette", title: "奥黛特一阶队友星辉层数", kind: "reaction-bonus", modifierKey: "odette-a1-buff", sourceFile: "internal/characters/odette/asc.go", sourceCommits: stellar, phase: "read", inputs: { stacks }, expression: expr.mul(expr.input("stacks"), expr.value(0.15)), explanation: "a7 其他受益者舞伴状态与标签门后读取队友真实层数。" },
  "char-scalar-odette-burst": { character: "odette", title: "奥黛特爆发星辉加成", kind: "reaction-bonus", modifierKey: "odette-snow-swans-dream", sourceFile: "internal/characters/odette/burst.go", sourceCommits: stellar, phase: "creation", inputs: { talentLevel: level }, expression: table("talentLevel", odetteBurst), explanation: "a7 爆发授予时按原十五档表保存系数，后续只在星辉标签消费。" },
  "char-scalar-odette-c4": { character: "odette", title: "奥黛特四命队友星辉加成", kind: "reaction-bonus", modifierKey: "odette-snow-swans-dream", sourceFile: "internal/characters/odette/cons.go", sourceCommits: stellar, phase: "creation", inputs: { talentLevel: level }, expression: expr.mul(table("talentLevel", odetteBurst), expr.value(0.5)), explanation: "a7 由同一次爆发天赋索引捕获原表值的半数，保留队友门和期限。" },
} as const satisfies Record<string, SourceHostCharacterScalarDescriptor>;
