/** Native HealInfo producers; recipient, queue and event decisions stay in Go. */
import { expr } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";

const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const maxHp = { label: "原治疗构造位置一次生命上限读取", unit: "HP" } as const;
const totalDef = { label: "原治疗构造位置一次总防御力读取", unit: "DEF" } as const;
const hpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const defLeaf = { stateKey: "totalDef", getter: "total-def", actor: "holder" } as const;
const flat = { label: "原生当前天赋表固定治疗值", unit: "HP" } as const;
const ratio = { label: "原生当前天赋表治疗倍率", unit: "ratio" } as const;
const radish = (mode: "skill" | "burst", title: string): SourceHostHealingSourceDescriptor => ({
  character: "yaoyao", title, sourceFile: `internal/characters/yaoyao/${mode}.go`, sourceCommits: commits,
  resultUnit: "HP", inputs: { maxHp: { label: "兔兔或萝卜原有快照生命上限", unit: "HP" }, ratio, flat },
  snapshotLeaf: { stateKey: "maxHp", getter: "total-hp" },
  expression: expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
  explanation: `在原 get${mode === "skill" ? "Skill" : "Burst"}HealInfo 调用时，以保存的攻击快照生命上限乘 ${mode}RadishHealing[0] 的当次原生天赋索引值，再加 ${mode}RadishHealing[1] 的当次索引值；只记录实际表值，不假设两个索引相同。治疗值与来源 ID 随整份 HealInfo 传入延后萝卜治疗任务，未重新采样角色属性。`,
});

export const healingSourceGroupE = {
  "heal-source-traveler-anemo-a4": {
    character: "anemo-traveler", title: "风主复苏之风每跳治疗比例", sourceFile: "internal/characters/traveler/common/anemo/asc.go", sourceCommits: commits,
    resultUnit: "ratio", inputs: {}, expression: n(.02),
    explanation: "原技能击杀、突破与冷却门槛通过后排队五跳；每跳 HealInfo.Src 为 0.02，随后通用治疗核心读取被治疗者生命上限换算。原构造不附加 HealInfo.Bonus。",
  },
  "heal-source-traveler-hydro-a1": {
    character: "hydro-traveler", title: "水主无染的澈水拾取治疗", sourceFile: "internal/characters/traveler/common/hydro/asc.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { maxHp }, statLeaf: hpLeaf, expression: expr.mul(v("maxHp"), n(.07)),
    explanation: "在原源水之滴拾取并移除之后读取一次水主生命上限，乘 0.07 写入实际治疗；后续一命回能和六命治疗仍按原顺序执行。",
  },
  "heal-source-traveler-hydro-c6": {
    character: "hydro-traveler", title: "水主六命公义的潮汐治疗比例", sourceFile: "internal/characters/traveler/common/hydro/cons.go", sourceCommits: commits,
    resultUnit: "ratio", inputs: {}, expression: n(.06),
    explanation: "原生先按剩余生命比例选出队员，再写入 0.06 的百分比治疗；被治疗者生命上限的实际读取由通用治疗核心完成，未换成旅行者生命上限。",
  },
  "heal-source-xilonen-burst": {
    character: "xilonen", title: "希诺宁欢腾律动持续治疗", sourceFile: "internal/characters/xilonen/burst.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { flat, totalDef, ratio }, statLeaf: defLeaf,
    expression: expr.add(v("flat"), expr.mul(v("totalDef"), v("ratio"))),
    explanation: "每个原治疗命中帧实际执行时，先读取 burstHealBase 当前天赋表值，再读取总防御力，再读取 burstHealPer 当前表值；结果写回 hi.Src，随后才读取治疗加成。",
  },
  "heal-source-xilonen-c6": {
    character: "xilonen", title: "希诺宁六命狂欢持续治疗", sourceFile: "internal/characters/xilonen/cons.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { totalDef }, statLeaf: defLeaf, expression: expr.mul(v("totalDef"), n(1.2)),
    explanation: "保留原命座状态门控和三次间隔队列；本次原生 Heal 属性先读、总防御力后读的顺序不变，治疗来源为该次防御力乘 1.2。",
  },
  "heal-source-yaoyao-skill": radish("skill", "瑶瑶月桂抛掷型萝卜治疗"),
  "heal-source-yaoyao-burst": radish("burst", "瑶瑶玉颗珊珊月中落萝卜治疗"),
  "heal-source-yaoyao-a4": {
    character: "yaoyao", title: "瑶瑶推己及人持续治疗", sourceFile: "internal/characters/yaoyao/asc.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { maxHp }, statLeaf: hpLeaf, expression: expr.mul(n(.008), v("maxHp")),
    explanation: "在原 A4 来源标识与状态存续检查通过后，每跳读取一次瑶瑶当前生命上限，以 0.008 倍写入治疗，再照常排下一跳。",
  },
  "heal-source-yaoyao-c6": {
    character: "yaoyao", title: "瑶瑶六命超厉害大萝卜治疗", sourceFile: "internal/characters/yaoyao/cons.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { maxHp }, statLeaf: hpLeaf, expression: expr.mul(v("maxHp"), n(.075)),
    explanation: "原月桂 C6 触发时直接读取瑶瑶当前生命上限，乘 0.075；不是月桂攻击快照生命上限。整份 HealInfo 携带来源 ID 延后到原旅行时间施加。",
  },
  "heal-source-zhongli-c6": {
    character: "zhongli", title: "钟离六命金玉，礼予天地治疗", sourceFile: "internal/characters/zhongli/shield.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { incomingDamage: { label: "本盾 OnDamage 原生入参（尚无上游来源 ID）", unit: "HP" }, maxHp }, statLeaf: hpLeaf,
    expression: expr.min(expr.mul(n(.4), v("incomingDamage")), expr.mul(n(.08), v("maxHp"))),
    explanation: "保留源码在 Tmpl.OnDamage 后，以该盾原始 dmg 入参的 40% 与钟离自身生命上限的 8% 取较小值；源码虽注释被治疗者上限，实际 getter 是钟离，未悄然修正。dmg 只记录真实入参，上游伤害来源尚未连接；它不是本盾消耗后的 taken。",
    explanationGaps: ["钟离 C6 的 incomingDamage 是本次护盾 OnDamage 实际入参，尚未连接到产生该伤害的上游计算 ID。"],
  },
  "heal-source-arlecchino-burst": {
    character: "arlecchino", title: "阿蕾奇诺厄月将升治疗", sourceFile: "internal/characters/arlecchino/burst.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { hpDebt: { label: "原治疗帧一次 CurrentHPDebt 生命之契数值", unit: "HP" }, totalAtk: { label: "随后一次当前总攻击力读取", unit: "ATK" } },
    statLeaf: { stateKey: "totalAtk", getter: "total-atk", actor: "holder" },
    expression: expr.add(expr.mul(n(1.5), v("hpDebt")), expr.mul(n(1.5), v("totalAtk"))),
    explanation: "原延后治疗帧先读取实际生命之契、再读取总攻击力，分别乘 1.5 后相加；不使用施放帧生命之契，也不把 CurrentHPDebt 当成生命比例。后续角色专属 ReceiveHeal 仍由原生执行。",
    explanationGaps: ["阿蕾奇诺的 hpDebt 保留本次实际 CurrentHPDebt 读数；该生命之契此前增减过程尚未连接为共享公式来源链。"],
  },
  "heal-source-clorinde-skill": {
    character: "clorinde", title: "克洛琳德贯夜治疗", sourceFile: "internal/characters/clorinde/skill.go", sourceCommits: commits,
    resultUnit: "HP", inputs: { hpDebt: { label: "原治疗帧一次 CurrentHPDebt 生命之契数值", unit: "HP" }, bolMultiplier: { label: "原贯夜分支传入的治疗倍率", unit: "ratio", choices: [{ value: 1.04, label: "未达 100% 生命之契分支：1.04" }, { value: 1.1, label: "达到 100% 生命之契分支：1.1" }] } },
    expression: expr.mul(v("hpDebt"), v("bolMultiplier")),
    explanation: "保留施放时的贯夜分支与第六帧治疗队列；倍率由原分支传入，生命之契在实际治疗帧读取一次再相乘。原源码对治疗加成适用性的 TODO 仍保留，未据此标记游戏验证完成。",
    explanationGaps: ["克洛琳德的 hpDebt 保留本次实际 CurrentHPDebt 读数；该生命之契此前增减过程尚未连接为共享公式来源链。", "固定源码仍标记贯夜是否受治疗加成影响为 TODO；本公式重现源码行为，没有完成该游戏机制的独立验证。"],
  },
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
