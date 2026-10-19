/** Remaining source character vector clauses, inventory rows 39–72. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicDescriptor } from "./source-host-character-modifier-dynamic-formula";

const B4 = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const A7 = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [B4, A7] as const;
const stellar = [A7] as const;
const v = expr.input;
const n = expr.value;

function fixed(character: string, title: string, statIndex: number, modifierKey: string,
  source: string, value: number, phase: "read" | "creation" = "creation",
  commits: readonly string[] = both): SourceHostCharacterModifierDynamicDescriptor {
  return { character, title, statIndex, modifierKey, sourceFile: `internal/characters/${source}`,
    sourceCommits: commits, phase, inputs: {}, expression: n(value),
    explanation: phase === "creation"
      ? "原始生产者在此创建帧写入常量；原 Amount 的门控、生命周期和返回次序仍由 Go 执行。"
      : "原 Amount 的既有门控通过后才写入此常量槽；触发和副作用仍由 Go 执行。" };
}

function table(level: string, entries: readonly number[]): FormulaExpression {
  let result = n(entries[entries.length - 1]!);
  for (let index = entries.length - 2; index >= 0; index--) {
    result = expr.condition("equal", v(level), n(index), n(entries[index]!), result);
  }
  return result;
}
const talentLevel = { label: "原天赋等级表索引", unit: "level", integer: true, minimum: 0, maximum: 14 };

export const characterModifierVectorGroupB = {
  "char-vector-iansan-a1-atkp": fixed("iansan", "伊安珊 A1 攻击力", 6, "precise-movement", "iansan/asc.go", 0.2, "creation", stellar),
  "char-vector-iansan-burst-zero-atk": fixed("iansan", "伊安珊爆发攻击力归零", 5, "iansan-burst-buff", "iansan/burst.go", 0, "creation", stellar),
  "char-vector-iansan-burst-atk": { character: "iansan", title: "伊安珊爆发当前攻击力", statIndex: 5, modifierKey: "iansan-burst-buff", sourceFile: "internal/characters/iansan/burst.go", sourceCommits: stellar, phase: "creation", inputs: {
    pointsThreshold: { label: "原阈值判断读取的夜魂点", unit: "point" },
    pointsRate: { label: "低于 42 时第二次读取的夜魂点；否则沿用首次值", unit: "point" },
    nonExtraAtk: { label: "当次非额外总攻击力", unit: "stat" }, talentLevel,
  }, statLeaf: { stateKey: "nonExtraAtk", getter: "non-extra-total-atk", actor: "holder" },
  expression: expr.min(expr.mul(v("nonExtraAtk"), expr.condition("lt", v("pointsThreshold"), n(42), expr.mul(n(0.005), v("pointsRate")), n(0.27))),
    table("talentLevel", [330, 370, 410, 450, 490, 530, 570, 610, 650, 690, 730, 770, 810, 850, 890])),
  explanation: "每次原 0.3 秒更新依照夜魂点阈值和两次原 getter 顺序计算；退出爆发的零值由独立创建回执记录。" },
  "char-vector-iansan-c2-atkp": fixed("iansan", "伊安珊 C2 攻击力", 6, "iansan-c2", "iansan/cons.go", 0.3, "creation", stellar),
  "char-vector-iansan-c6-dmgp": fixed("iansan", "伊安珊 C6 伤害加成", 21, "iansan-c6", "iansan/cons.go", 0.25, "creation", stellar),
  "char-vector-itto-burst-atkspd": fixed("itto", "荒泷一斗爆发普攻攻速", 20, "itto-q-atkspd", "itto/burst.go", 0.1),
  "char-vector-jahoda-a4-em": fixed("jahoda", "雅珂达 A4 元素精通", 8, "jahoda-a4", "jahoda/asc.go", 100, "creation", stellar),
  "char-vector-jahoda-c6-cr": fixed("jahoda", "雅珂达 C6 暴击率", 9, "jahoda-c6", "jahoda/cons.go", 0.05, "creation", stellar),
  "char-vector-jahoda-c6-cd": fixed("jahoda", "雅珂达 C6 暴击伤害", 10, "jahoda-c6", "jahoda/cons.go", 0.4, "creation", stellar),
  "char-vector-jean-c2-atkspd": fixed("jean", "琴 C2 攻速", 20, "jean-c2", "jean/cons.go", 0.15),
  "char-vector-kaeya-c1-cr": fixed("kaeya", "凯亚 C1 暴击率", 9, "kaeya-c1", "kaeya/cons.go", 0.15, "read"),
  "char-vector-kaveh-c2-atkspd": fixed("kaveh", "卡维 C2 攻速", 20, "kaveh-c2", "kaveh/cons.go", 0.15),
  "char-vector-kazuha-a4-cryo": { character: "kazuha", title: "万叶 A4 冰伤", statIndex: 14, modifierKey: "kazuha-a4-cryo", sourceFile: "internal/characters/kazuha/asc.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "原风扩散帧的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(n(0.0004), v("nonExtraEM")), explanation: "原风扩散回调只读取一次精通并创建对应元素的八秒增伤。" },
  "char-vector-kazuha-a4-electro": { character: "kazuha", title: "万叶 A4 雷伤", statIndex: 15, modifierKey: "kazuha-a4-electro", sourceFile: "internal/characters/kazuha/asc.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "原风扩散帧的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(n(0.0004), v("nonExtraEM")), explanation: "原风扩散回调只读取一次精通并创建对应元素的八秒增伤。" },
  "char-vector-kazuha-a4-hydro": { character: "kazuha", title: "万叶 A4 水伤", statIndex: 13, modifierKey: "kazuha-a4-hydro", sourceFile: "internal/characters/kazuha/asc.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "原风扩散帧的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(n(0.0004), v("nonExtraEM")), explanation: "原风扩散回调只读取一次精通并创建对应元素的八秒增伤。" },
  "char-vector-kazuha-a4-pyro": { character: "kazuha", title: "万叶 A4 火伤", statIndex: 12, modifierKey: "kazuha-a4-pyro", sourceFile: "internal/characters/kazuha/asc.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "原风扩散帧的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(n(0.0004), v("nonExtraEM")), explanation: "原风扩散回调只读取一次精通并创建对应元素的八秒增伤。" },
  "char-vector-kazuha-c2-em": fixed("kazuha", "万叶 C2 元素精通", 8, "kazuha-c2", "kazuha/kazuha.go", 200),
  "char-vector-keqing-a4-cr": fixed("keqing", "刻晴 A4 暴击率", 9, "keqing-a4", "keqing/keqing.go", 0.15),
  "char-vector-keqing-a4-er": fixed("keqing", "刻晴 A4 充能效率", 7, "keqing-a4", "keqing/keqing.go", 0.15),
  "char-vector-keqing-c4-atkp": fixed("keqing", "刻晴 C4 攻击力", 6, "keqing-c4", "keqing/keqing.go", 0.25),
  "char-vector-keqing-c6-electrop": { ...fixed("keqing", "刻晴 C6 雷元素伤害", 15, "keqing-c6-attack", "keqing/keqing.go", 0.06),
    consumerSlots: { "keqing-c6-attack": 15, "keqing-c6-burst": 15, "keqing-c6-charge": 15, "keqing-c6-skill": 15 } },
  "char-vector-kinich-c1-cd": fixed("kinich", "基尼奇 C1 暴击伤害", 10, "kinich-c1", "kinich/cons.go", 1, "read"),
  "char-vector-kinich-c4-dmgp": fixed("kinich", "基尼奇 C4 爆发增伤", 21, "kinich-c4-dmgp", "kinich/cons.go", 0.7, "read"),
  "char-vector-kirara-c6-pyrop": fixed("kirara", "绮良良 C6 火伤", 12, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-hydrop": fixed("kirara", "绮良良 C6 水伤", 13, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-cryop": fixed("kirara", "绮良良 C6 冰伤", 14, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-electrop": fixed("kirara", "绮良良 C6 雷伤", 15, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-anemop": fixed("kirara", "绮良良 C6 风伤", 16, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-geop": fixed("kirara", "绮良良 C6 岩伤", 17, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-phyp": fixed("kirara", "绮良良 C6 物理伤害", 19, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-kirara-c6-dendrop": fixed("kirara", "绮良良 C6 草伤", 18, "kirara-c6", "kirara/kirara.go", 0.12),
  "char-vector-lynette-a1-atkp": { character: "lynette", title: "琳妮特 A1 队伍元素攻击力", statIndex: 6, modifierKey: "lynette-a1", sourceFile: "internal/characters/lynette/asc.go", sourceCommits: both, phase: "creation", inputs: { elementCount: { label: "原队伍不同元素数", unit: "count", integer: true, minimum: 1, maximum: 4 } }, expression: expr.add(n(0.08), expr.mul(expr.sub(v("elementCount"), n(1)), n(0.04))), explanation: "原队伍元素去重后在初始化时固定攻击力；后续各队友只消费创建值。" },
  "char-vector-mavuika-a1-atkp": fixed("mavuika", "玛薇卡 A1 攻击力", 6, "mavuika-a1", "mavuika/asc.go", 0.3),
  "char-vector-mavuika-c1-atkp": fixed("mavuika", "玛薇卡 C1 攻击力", 6, "mavuika-c1", "mavuika/cons.go", 0.4),
  "char-vector-mika-c6-cd": fixed("mika", "米卡 C6 暴击伤害", 10, "mika-c6", "mika/mika.go", 0.6),
  "char-vector-mika-skill-atkspd": { character: "mika", title: "米卡战技攻速", statIndex: 20, modifierKey: "soulwind", sourceFile: "internal/characters/mika/mika.go", sourceCommits: both, phase: "creation", inputs: { talentLevel }, expression: table("talentLevel", [0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.25, 0.25]), explanation: "原初始化帧只取一次战技天赋等级，按固定十五档表创建攻速向量。" },
  "char-vector-mizuki-a4-em": fixed("mizuki", "梦见月瑞希 A4 元素精通", 8, "mizuki-a4", "mizuki/asc.go", 100),
  "char-vector-mizuki-c2-zero-pyrop": fixed("mizuki", "梦见月瑞希 C2 初始火伤", 12, "mizuki-c2", "mizuki/cons.go", 0),
  "char-vector-mizuki-c2-zero-hydrop": fixed("mizuki", "梦见月瑞希 C2 初始水伤", 13, "mizuki-c2", "mizuki/cons.go", 0),
  "char-vector-mizuki-c2-zero-electrop": fixed("mizuki", "梦见月瑞希 C2 初始雷伤", 15, "mizuki-c2", "mizuki/cons.go", 0),
  "char-vector-mizuki-c2-zero-cryop": fixed("mizuki", "梦见月瑞希 C2 初始冰伤", 14, "mizuki-c2", "mizuki/cons.go", 0),
  "char-vector-mizuki-c2-pyrop": { character: "mizuki", title: "梦见月瑞希 C2 火伤", statIndex: 12, modifierKey: "mizuki-c2", sourceFile: "internal/characters/mizuki/cons.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "当次更新的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(v("nonExtraEM"), n(0.0004)), explanation: "原半秒任务一次读取精通并更新四个伤害槽；此槽只复用同次读取。" },
  "char-vector-mizuki-c2-hydrop": { character: "mizuki", title: "梦见月瑞希 C2 水伤", statIndex: 13, modifierKey: "mizuki-c2", sourceFile: "internal/characters/mizuki/cons.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "当次更新的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(v("nonExtraEM"), n(0.0004)), explanation: "原半秒任务一次读取精通并更新四个伤害槽；此槽只复用同次读取。" },
  "char-vector-mizuki-c2-electrop": { character: "mizuki", title: "梦见月瑞希 C2 雷伤", statIndex: 15, modifierKey: "mizuki-c2", sourceFile: "internal/characters/mizuki/cons.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "当次更新的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(v("nonExtraEM"), n(0.0004)), explanation: "原半秒任务一次读取精通并更新四个伤害槽；此槽只复用同次读取。" },
  "char-vector-mizuki-c2-cryop": { character: "mizuki", title: "梦见月瑞希 C2 冰伤", statIndex: 14, modifierKey: "mizuki-c2", sourceFile: "internal/characters/mizuki/cons.go", sourceCommits: both, phase: "creation", inputs: { nonExtraEM: { label: "当次更新的非额外元素精通", unit: "EM" } }, statLeaf: { stateKey: "nonExtraEM", getter: "non-extra-stat", statIndex: 8, actor: "holder" }, expression: expr.mul(v("nonExtraEM"), n(0.0004)), explanation: "原半秒任务一次读取精通并更新四个伤害槽；此槽只复用同次读取。" },
  "char-vector-mizuki-c6-cr": fixed("mizuki", "梦见月瑞希 C6 星涡暴击率", 9, "mizuki-c6", "mizuki/cons.go", 0.1, "creation", stellar),
  "char-vector-mizuki-c6-cd": fixed("mizuki", "梦见月瑞希 C6 星涡暴击伤害", 10, "mizuki-c6", "mizuki/cons.go", 0.2, "creation", stellar),
  "char-vector-mona-omen-dmgp": { character: "mona", title: "莫娜星异增伤", statIndex: 21, modifierKey: "mona-omen", sourceFile: "internal/characters/mona/burst.go", sourceCommits: both, phase: "creation", inputs: { talentLevel }, expression: table("talentLevel", [0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]), explanation: "原爆发时读取一次天赋等级创建星异数值；目标水泡或星异状态门仍在 Amount。" },
  "char-vector-mona-c4-cr": fixed("mona", "莫娜 C4 暴击率", 9, "mona-c4", "mona/cons.go", 0.15),
  "char-vector-mona-c4-cd": { character: "mona", title: "莫娜 C4 魔导暴击伤害", statIndex: 10, modifierKey: "mona-c4", sourceFile: "internal/characters/mona/cons.go", sourceCommits: both, phase: "read", inputs: { hexEligible: { label: "原莫娜及受益者均为魔导成员", unit: "boolean", integer: true, choices: [{ value: 0, label: "否" }, { value: 1, label: "是" }] } }, expression: expr.mul(v("hexEligible"), n(0.15)), explanation: "原 Amount 先改共享 CD 槽，再检查目标星异状态；没有目标状态时仍保留该写入副作用。" },
  "char-vector-mualani-c4-dmgp": fixed("mualani", "玛拉妮 C4 爆发增伤", 21, "mualani-c4", "mualani/cons.go", 0.75),
  "char-vector-nahida-burst-pyro-dmgp": { character: "nahida", title: "纳西妲爆发火元素增伤", statIndex: 21, modifierKey: "nahida-q", sourceFile: "internal/characters/nahida/nahida.go", sourceCommits: both, phase: "creation", inputs: { pyroCount: { label: "原队伍火元素人数上限二", unit: "count", integer: true, choices: [{ value: 1, label: "一名" }, { value: 2, label: "至少两名" }] }, talentLevel }, expression: expr.condition("equal", v("pyroCount"), n(1),
    table("talentLevel", [0.1488, 0.15996, 0.17112, 0.186, 0.19716, 0.20832, 0.2232, 0.23808, 0.25296, 0.26784, 0.28272, 0.2976, 0.3162, 0.3348, 0.3534]),
    table("talentLevel", [0.2232, 0.23994, 0.25668, 0.279, 0.29574, 0.31248, 0.3348, 0.35712, 0.37944, 0.40176, 0.42408, 0.4464, 0.4743, 0.5022, 0.5301])),
  explanation: "原初始化时按火元素人数和一次爆发天赋等级读取固定二维表；命中时仍检查灭净三业技能名。" },
  "char-vector-nahida-c4-em": { character: "nahida", title: "纳西妲 C4 元素精通", statIndex: 8, modifierKey: "nahida-c4", sourceFile: "internal/characters/nahida/cons.go", sourceCommits: both, phase: "read", inputs: { markedEnemies: { label: "原范围搜索后截断的标记敌人数", unit: "count", integer: true, minimum: 1, maximum: 4 } }, expression: expr.add(n(80), expr.mul(v("markedEnemies"), n(20))), explanation: "原范围查询和零目标门槛保留；按至多四名已标记敌人当次计算。" },
  "char-vector-navia-a1-dmgp": fixed("navia", "娜维娅 A1 普重下增伤", 21, "navia-a1-dmg", "navia/asc.go", 0.4, "read"),
} as const satisfies Record<string, SourceHostCharacterModifierDynamicDescriptor>;
