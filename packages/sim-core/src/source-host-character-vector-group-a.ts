/** Remaining source-owned StatMod/AttackMod vectors, Aino through Hu Tao.
 * Only numeric Amount slots move here; Go retains gates, state writes and expiry. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicDescriptor } from "./source-host-character-modifier-dynamic-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const n = expr.value;
const sourceFile = (character: string, file: string) => `internal/characters/${character}/${file}`;
const constant = (character: string, title: string, statIndex: number, modifierKey: string, file: string, value: number): SourceHostCharacterModifierDynamicDescriptor => ({
  character, title, statIndex, modifierKey, sourceFile: sourceFile(character, file), sourceCommits: both,
  phase: "read", inputs: {}, expression: n(value),
  explanation: "原向量槽仅在来源初始化或局部创建时写入该字面常量；原 Amount 的门槛、期限及受益者由 Go 保留。",
});
function table(index: FormulaExpression, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
}
const ayatoBurst = [.11,.12,.13,.14,.15,.16,.17,.18,.19,.2,.2,.2,.2,.2,.2] as const;
const hutaoParamita = [.03841,.04071,.04301,.046,.0483,.0506,.05359,.05658,.05957,.06256,.06555,.06854,.07153,.07452,.07751] as const;
const talent = { label: "创建时原生天赋表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;

export const characterModifierVectorGroupA = {
  "char-vector-aino-c1-em": constant("aino", "爱诺 C1 精通", 8, "aino-c1-buff", "cons.go", 80),
  "char-vector-alhaitham-c2-1-em": constant("alhaitham", "艾尔海森 C2 第一独立层精通", 8, "alhaitham-c2-1-stack", "cons.go", 50),
  "char-vector-alhaitham-c2-2-em": constant("alhaitham", "艾尔海森 C2 第二独立层精通", 8, "alhaitham-c2-2-stack", "cons.go", 50),
  "char-vector-alhaitham-c2-3-em": constant("alhaitham", "艾尔海森 C2 第三独立层精通", 8, "alhaitham-c2-3-stack", "cons.go", 50),
  "char-vector-alhaitham-c2-4-em": constant("alhaitham", "艾尔海森 C2 第四独立层精通", 8, "alhaitham-c2-4-stack", "cons.go", 50),
  "char-vector-alhaitham-c6-cr": constant("alhaitham", "艾尔海森 C6 暴击率", 9, "alhaitham-c6", "cons.go", .1),
  "char-vector-alhaitham-c6-cd": constant("alhaitham", "艾尔海森 C6 暴击伤害", 10, "alhaitham-c6", "cons.go", .7),
  "char-vector-arlecchino-c6-cr": constant("arlecchino", "阿蕾奇诺 C6 暴击率", 9, "arlecchino-c6", "cons.go", .1),
  "char-vector-arlecchino-c6-cd": constant("arlecchino", "阿蕾奇诺 C6 暴击伤害", 10, "arlecchino-c6", "cons.go", .7),
  "char-vector-ayato-burst-dmgp": { character: "ayato", title: "神里绫人爆发普攻增伤", statIndex: 21, modifierKey: "ayato-burst", sourceFile: sourceFile("ayato", "burst.go"), sourceCommits: both, phase: "creation", inputs: { talent }, expression: table(v("talent"), ayatoBurst), explanation: "爆发创建帧按原天赋表固定局部向量；每次场内普攻只消费该创建回执。" },
  "char-vector-barbara-c2-hydrop": constant("barbara", "芭芭拉 C2 水伤", 13, "barbara-c2", "barbara.go", .15),
  "char-vector-candace-burst-dmgp": constant("candace", "坎蒂丝爆发普攻增伤", 21, "candace-q-dmg", "burst.go", .2),
  "char-vector-chevreuse-c6-1-pyrop": constant("chevreuse", "夏沃蕾 C6 第一层火伤", 12, "chev-c6-1-stack", "cons.go", .2),
  "char-vector-chevreuse-c6-1-electrop": constant("chevreuse", "夏沃蕾 C6 第一层雷伤", 15, "chev-c6-1-stack", "cons.go", .2),
  "char-vector-chevreuse-c6-2-pyrop": constant("chevreuse", "夏沃蕾 C6 第二层火伤", 12, "chev-c6-2-stack", "cons.go", .2),
  "char-vector-chevreuse-c6-2-electrop": constant("chevreuse", "夏沃蕾 C6 第二层雷伤", 15, "chev-c6-2-stack", "cons.go", .2),
  "char-vector-chevreuse-c6-3-pyrop": constant("chevreuse", "夏沃蕾 C6 第三层火伤", 12, "chev-c6-3-stack", "cons.go", .2),
  "char-vector-chevreuse-c6-3-electrop": constant("chevreuse", "夏沃蕾 C6 第三层雷伤", 15, "chev-c6-3-stack", "cons.go", .2),
  "char-vector-chiori-a4-geop": constant("chiori", "千织 A4 岩伤", 17, "chiori-a4", "asc.go", .2),
  "char-vector-columbina-c2-hpp": constant("columbina", "哥伦比娅 C2 生命百分比", 4, "columbina-c2", "cons.go", .4),
  "char-vector-columbina-c6-lc-cd": constant("columbina", "哥伦比娅 C6 月感电暴伤", 10, "columbina-c6-lc", "cons.go", .8),
  "char-vector-columbina-c6-lb-cd": constant("columbina", "哥伦比娅 C6 月绽放暴伤", 10, "columbina-c6-lb", "cons.go", .8),
  "char-vector-columbina-c6-lcr-cd": constant("columbina", "哥伦比娅 C6 月结晶暴伤", 10, "columbina-c6-lcr", "cons.go", .8),
  "char-vector-cyno-burst-em": constant("cyno", "赛诺爆发精通", 8, "cyno-q", "burst.go", 100),
  "char-vector-cyno-c1-atkspd": constant("cyno", "赛诺 C1 普攻速度", 20, "cyno-c1", "cons.go", .2),
  "char-vector-dahlia-a4-atkspd": { character: "dahlia", title: "塔利雅 A4 攻击速度", statIndex: 20, modifierKey: "dahlia-a4-atk-speed", sourceFile: sourceFile("dahlia", "asc.go"), sourceCommits: both, phase: "creation", inputs: { maxHp: { label: "本次更新实际生命上限", unit: "stat", minimum: 0 }, c6Speed: { label: "原生 C6 攻速开关值", unit: "ratio", choices: [{ value: 0, label: "未触发" }, { value: .1, label: "已触发" }] } }, statLeaf: { stateKey: "maxHp", getter: "max-hp", actor: "holder" }, expression: expr.add(expr.min(expr.mul(v("maxHp"), n(.001), n(.005)), n(.2)), v("c6Speed")), explanation: "每次原三十帧更新依原 getter 顺序读取一次 MaxHP，再读取 C6 开关并覆盖共享攻速向量。" },
  "char-vector-diluc-a4-pyrop": constant("diluc", "迪卢克 A4 火伤", 12, "diluc-q", "diluc.go", .2),
  "char-vector-diluc-c2-atkp": { character: "diluc", title: "迪卢克 C2 攻击力百分比", statIndex: 6, modifierKey: "diluc-c2", sourceFile: sourceFile("diluc", "cons.go"), sourceCommits: both, phase: "creation", inputs: { stacks: { label: "本次本人受击后原生层数", unit: "stack", integer: true, minimum: 1, maximum: 3 } }, expression: expr.mul(n(.1), v("stacks")), explanation: "本人 OnPlayerHit 后更新共享向量，包括被护盾吸收的命中；到期重置与 ICD 原生保留。" },
  "char-vector-diluc-c2-atkspd": { character: "diluc", title: "迪卢克 C2 攻击速度", statIndex: 20, modifierKey: "diluc-c2", sourceFile: sourceFile("diluc", "cons.go"), sourceCommits: both, phase: "creation", inputs: { stacks: { label: "本次本人受击后原生层数", unit: "stack", integer: true, minimum: 1, maximum: 3 } }, expression: expr.mul(n(.05), v("stacks")), explanation: "同一 OnPlayerHit 写入第二个共享槽；消费时关联同次两条创建回执。" },
  "char-vector-diluc-c4-dmgp": constant("diluc", "迪卢克 C4 战技增伤", 21, "diluc-c4", "diluc.go", .4),
  "char-vector-diona-c6-em": constant("diona", "迪奥娜 C6 精通", 8, "diona-c6", "diona.go", 200),
  "char-vector-durin-c2-electro": constant("durin", "杜林 C2 雷伤", 15, "durin-c2-electro", "cons.go", .5),
  "char-vector-durin-c2-pyro": constant("durin", "杜林 C2 火伤", 12, "durin-c2-pyro", "cons.go", .5),
  "char-vector-durin-c2-cryo": constant("durin", "杜林 C2 冰伤", 14, "durin-c2-cryo", "cons.go", .5),
  "char-vector-durin-c2-hydro": constant("durin", "杜林 C2 水伤", 13, "durin-c2-hydro", "cons.go", .5),
  "char-vector-durin-c2-dendro": constant("durin", "杜林 C2 草伤", 18, "durin-c2-dendro", "cons.go", .5),
  "char-vector-durin-c2-anemo": constant("durin", "杜林 C2 风伤", 16, "durin-c2-anemo", "cons.go", .5),
  "char-vector-durin-c2-geo": constant("durin", "杜林 C2 岩伤", 17, "durin-c2-geo", "cons.go", .5),
  "char-vector-emilie-c1-dmgp": constant("emilie", "艾梅莉埃 C1 增伤", 21, "emilie-c1", "cons.go", .2),
  "char-vector-escoffier-c1-cd": constant("escoffier", "爱可菲 C1 冰伤暴伤", 10, "escoffier-c1", "cons.go", .6),
  "char-vector-eula-c1-phyp": constant("eula", "优菈 C1 物伤", 19, "eula-c1", "eula.go", .3),
  "char-vector-flins-c4-atkp": constant("flins", "菲林斯 C4 攻击力百分比", 6, "flins-c4", "cons.go", .2),
  "char-vector-freminet-a4-dmgp": constant("freminet", "菲米尼 A4 增伤", 21, "freminet-a4-buff", "asc.go", .4),
  "char-vector-freminet-c1-cr": constant("freminet", "菲米尼 C1 暴击率", 9, "freminet-c1", "cons.go", .15),
  "char-vector-gaming-c2-atkp": constant("gaming", "嘉明 C2 攻击力百分比", 6, "gaming-c2", "cons.go", .2),
  "char-vector-gaming-c6-cr": constant("gaming", "嘉明 C6 暴击率", 9, "gaming-c6", "cons.go", .2),
  "char-vector-gaming-c6-cd": constant("gaming", "嘉明 C6 暴击伤害", 10, "gaming-c6", "cons.go", .4),
  "char-vector-gorou-a1-defp": constant("gorou", "五郎 A1 防御力百分比", 1, "gorou-a1", "gorou.go", .25),
  "char-vector-heizou-a4-em": constant("heizou", "鹿野院平藏 A4 精通", 8, "heizou-a4", "heizou.go", 80),
  "char-vector-heizou-c1-atkspd": constant("heizou", "鹿野院平藏 C1 攻速", 20, "heizou-c1", "heizou.go", .15),
  "char-vector-hutao-a1-cr": constant("hutao", "胡桃 A1 队友暴击率", 9, "hutao-a1", "hutao.go", .12),
  "char-vector-hutao-a4-pyrop": constant("hutao", "胡桃 A4 半血火伤", 12, "hutao-a4", "asc.go", .33),
  "char-vector-hutao-c6-cr": constant("hutao", "胡桃 C6 暴击率", 9, "hutao-c6", "cons.go", 1),
  "char-vector-hutao-c4-cr": constant("hutao", "胡桃 C4 队友暴击率", 9, "hutao-c4", "cons.go", .12),
  "char-vector-hutao-paramita-atk": { character: "hutao", title: "胡桃蝶引来生攻击力", statIndex: 5, modifierKey: "paramita", sourceFile: sourceFile("hutao", "skill.go"), sourceCommits: both, phase: "creation", inputs: { talent, maxHp: { label: "原创建帧实际生命上限", unit: "stat", minimum: 0 }, baseAtk: { label: "原创建帧实际基础攻击力", unit: "stat", minimum: 0 } }, statLeaves: [{ stateKey: "maxHp", getter: "max-hp", actor: "holder" }, { stateKey: "baseAtk", getter: "stat", statIndex: 24, actor: "holder" }], expression: expr.min(expr.mul(table(v("talent"), hutaoParamita), v("maxHp")), expr.mul(n(4), v("baseAtk"))), explanation: "原战技创建时先各读取一次 MaxHP 与 BaseATK，使用原天赋表与四倍基础攻击力上限固定同一共享 ATK 槽。" },
} as const satisfies Record<string, SourceHostCharacterModifierDynamicDescriptor>;
