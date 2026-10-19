/** Source-owned queued FlatDmg expressions for the remaining E-group characters. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterFlatDescriptor } from "./source-host-character-flat-formula";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";

const group1 = (() => {
  const n = expr.value;
  const v = expr.input;
  const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
  const em = { label: "原位置一次元素精通读取", unit: "EM" } as const;
  const maxHp = { label: "原位置一次生命上限读取", unit: "HP" } as const;
  const totalAtk = { label: "原位置一次总攻击力读取", unit: "ATK" } as const;
  const emLeaf = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;
  const hpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
  const atkLeaf = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
  const talent = { label: "原生天赋等级表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
  const masque = [1.204, 1.302, 1.4, 1.54, 1.638, 1.75, 1.904, 2.058, 2.212, 2.38, 2.548, 2.716, 2.884, 3.052, 3.22] as const;
  const ayatoSkillpp = [.005611, .006067, .006524, .007176, .007633, .008155, .008873, .00959, .010308, .011091, .011874, .012657, .013439, .014222, .015005] as const;
  const table = (index: FormulaExpression, values: readonly number[]): FormulaExpression =>
    values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
  function rule(character: string, title: string, file: string, operation: "set" | "add",
    inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>, expression: FormulaExpression,
    explanation: string, leaves: readonly SourceHostCharacterModifierDynamicStatLeaf[] = []): SourceHostCharacterFlatDescriptor {
    return { character, title, sourceFile: `internal/characters/${character}/${file}`, sourceCommits: both,
      operation, inputs, expression, explanation,
      ...(leaves.length === 1 ? { statLeaf: leaves[0]! } : leaves.length > 1 ? { statLeaves: leaves } : {}) };
  }
  const zero = (character: string, title: string, file: string, explanation: string) =>
    rule(character, title, file, "set", {}, n(0), explanation);

  return {
    "char-flat-aino-burst-zero": zero("aino", "爱诺爆发未解锁 A4 零附加基伤", "burst.go", "原 A4 helper 在四阶前返回零，仍覆盖复用的 AttackInfo。"),
    "char-flat-aino-burst-a4": rule("aino", "爱诺爆发 A4 精通附加基伤", "burst.go", "set",
      { em }, expr.mul(v("em"), n(.5)), "每次爆发 tick 在原任务帧读取一次精通，覆盖上次同一 AttackInfo 的值。", [emLeaf]),
    "char-flat-aino-c2-zero-a4": rule("aino", "爱诺 C2 未解锁 A4 附加基伤", "cons.go", "set",
      { emFirst: em }, v("emFirst"), "C2 冷却状态写入后仍执行首次精通读取，A4 helper 返回零。",
      [{ stateKey: "emFirst", getter: "stat", statIndex: 8, actor: "holder" }]),
    "char-flat-aino-c2-a4": rule("aino", "爱诺 C2 双精通读取附加基伤", "cons.go", "set",
      { emFirst: em, emSecond: em }, expr.add(v("emFirst"), expr.mul(v("emSecond"), n(.5))),
      "C2 首次精通读取发生在构造攻击前，A4 helper 独立读取第二次精通。",
      [{ stateKey: "emFirst", getter: "stat", statIndex: 8, actor: "holder" }, { stateKey: "emSecond", getter: "stat", statIndex: 8, actor: "holder" }]),
    "char-flat-arlecchino-na-bond": rule("arlecchino", "阿蕾奇诺红死之宴普攻生命之契加值", "attack.go", "add",
      { talent, c1Bonus: { label: "原一命加成", unit: "ratio", choices: [{ value: 0, label: "未解锁" }, { value: 1, label: "已解锁" }] },
        hpDebt: { label: "当前生命之契", unit: "HP" }, maxHp, totalAtk },
      expr.mul(expr.div(expr.mul(expr.add(table(v("talent"), masque), v("c1Bonus")), v("hpDebt")), v("maxHp")), v("totalAtk")),
      "仅红死之宴状态有效的普攻创建任务执行；生命之契与生命上限、攻击力依原顺序读取。", [hpLeaf, atkLeaf]),
    "char-flat-arlecchino-burst-c6-zero": rule("arlecchino", "阿蕾奇诺爆发未解锁六命零加值", "burst.go", "add", {}, n(0), "原 C6 helper 返回零且不写伤害日志。"),
    "char-flat-arlecchino-burst-c6": rule("arlecchino", "阿蕾奇诺六命爆发生命之契加值", "burst.go", "add",
      { totalAtk, hpDebt: { label: "当前生命之契", unit: "HP" }, maxHp },
      expr.div(expr.mul(v("totalAtk"), n(7), v("hpDebt")), v("maxHp")),
      "爆发第 110 帧读取攻击力、生命之契、生命上限，保留原伤害日志。", [atkLeaf, hpLeaf]),
    "char-flat-ayato-namisen": rule("ayato", "神里绫人浪闪层数生命加值", "ayato.go", "add",
      { maxHp, talent, stacks: { label: "快照帧浪闪层数", unit: "stack", integer: true, minimum: 0, maximum: 5 } },
      expr.mul(v("maxHp"), table(v("talent"), ayatoSkillpp), v("stacks")),
      "基础 Snapshot 已完成后，在战技状态的普通或重击快照中读取生命上限，再查战技等级和层数。", [hpLeaf]),
    "char-flat-columbina-c4-zero": zero("columbina", "哥伦比娅 C4 未触发零附加基伤", "skill.go", "原 helper 的星座与冷却门槛或多段后续攻击返回零，每段仍覆盖同一 AttackInfo。"),
    "char-flat-columbina-c4-hp": rule("columbina", "哥伦比娅 C4 引力干涉生命加值", "skill.go", "set",
      { maxHp, reaction: { label: "已选月曜反应", unit: "index", integer: true,
        choices: [{ value: 0, label: "月感电" }, { value: 1, label: "月绽放" }, { value: 2, label: "月结晶" }] } },
      expr.condition("equal", v("reaction"), n(1), expr.mul(n(.025), v("maxHp")), expr.mul(n(.125), v("maxHp"))),
      "每段原 helper 先回能并检查冷却；仅首次可触发段读取生命上限。", [hpLeaf]),
    "char-flat-cyno-na-zero": zero("cyno", "赛诺未解锁 A4 誓约普攻零加值", "attack.go", "A4 helper 四阶前返回零。"),
    "char-flat-cyno-na-a4": rule("cyno", "赛诺 A4 誓约普攻精通加值", "attack.go", "set",
      { em }, expr.mul(v("em"), n(1.5)), "每段爆发普攻构造时读取一次精通。", [emLeaf]),
    "char-flat-cyno-skill-bolt-zero": zero("cyno", "赛诺未解锁 A4 战技渡荒之雷零加值", "skill.go", "三枚共享的渡荒之雷使用同一原生零值。"),
    "char-flat-cyno-skill-bolt-a4": rule("cyno", "赛诺 A4 战技渡荒之雷精通加值", "skill.go", "set",
      { em }, expr.mul(v("em"), n(2.5)), "A1 条件内一次读取后复制给三枚渡荒之雷。", [emLeaf]),
    "char-flat-cyno-c6-bolt-zero": zero("cyno", "赛诺未解锁 A4 六命渡荒之雷零加值", "cons.go", "六命命中回调原门槛和层数扣除后返回零。"),
    "char-flat-cyno-c6-bolt-a4": rule("cyno", "赛诺 A4 六命渡荒之雷精通加值", "cons.go", "set",
      { em }, expr.mul(v("em"), n(2.5)), "六命命中回调扣除层数后读取一次精通。", [emLeaf]),
    "char-flat-emilie-c6": rule("emilie", "艾梅莉埃六命普攻重击攻击力加值", "cons.go", "add",
      { totalAtk }, expr.mul(v("totalAtk"), n(3)), "原六命状态及普通或重击标签门槛后读取一次攻击力。", [atkLeaf]),
    "char-flat-hutao-c2-blood-blossom": rule("hutao", "胡桃二命血梅香生命加值", "skill.go", "add",
      { maxHp }, expr.mul(v("maxHp"), n(.1)), "每个目标各自的 240 帧持续伤害回调在二命门槛后读取一次生命上限。", [hpLeaf]),
  } as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
})();

const group2 = (() => {
  const n = expr.value;
  const v = expr.input;
  const classic = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
  const stellar = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
  const both = [classic, stellar] as const;
  const talent = { label: "原生天赋等级表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
  const totalAtk = { label: "本次来源角色总攻击力", unit: "ATK" } as const;
  const holderAtk = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
  function table(key: string, values: readonly number[]): FormulaExpression {
    return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", v(key), n(i), n(value), otherwise), n(0));
  }
  const jahodaRobot = [.172664,.185614,.198564,.21583,.22878,.24173,.258996,.276262,.293529,.310795,.328062,.345328,.366911,.388494,.410077] as const;
  const mavuikaQ = [.016,.0172,.0184,.02,.0212,.0224,.024,.0256,.0272,.0288,.0304,.032,.034,.036,.038] as const;
  const mavuikaNA = [.00258,.00279,.003,.0033,.00351,.00375,.00408,.00441,.00474,.0051,.00546,.00582,.00618,.00654,.0069] as const;
  const mavuikaCA = [.00516,.00558,.006,.0066,.00702,.0075,.00816,.00882,.00948,.0102,.01092,.01164,.01236,.01308,.0138] as const;
  const mavuikaInputs = { burstStacks: { label: "爆发起手保存的战意", unit: "stack", minimum: 0 }, talentLevel: talent, totalAtk } as const;
  function mavBurst(title: string, file: string, values: readonly number[]): SourceHostCharacterFlatDescriptor {
    return { character: "mavuika", title, sourceFile: `internal/characters/mavuika/${file}`, sourceCommits: both,
      operation: "set", inputs: mavuikaInputs, statLeaf: holderAtk,
      expression: expr.mul(expr.mul(v("burstStacks"), table("talentLevel", values)), v("totalAtk")),
      explanation: "原爆发状态门通过后，先用起手保存的战意和爆发天赋表计算，再执行左侧独立攻击力读取。" };
  }
  function mavZero(title: string, file: string): SourceHostCharacterFlatDescriptor {
    return { character: "mavuika", title, sourceFile: `internal/characters/mavuika/${file}`, sourceCommits: both,
      operation: "set", inputs: {}, expression: n(0),
      explanation: "原爆发状态门未通过，左侧辅助函数返回零且没有攻击力读取。" };
  }
  function mavC2(title: string, file: string, ratio: number): SourceHostCharacterFlatDescriptor {
    return { character: "mavuika", title, sourceFile: `internal/characters/mavuika/${file}`, sourceCommits: both,
      operation: "add", inputs: { totalAtk }, statLeaf: holderAtk,
      expression: expr.mul(n(ratio), v("totalAtk")),
      explanation: "原 C2 与摩托形态门通过后，右侧再独立读取一次攻击力，并加到左侧完整 FlatDmg。" };
  }
  return {
    "char-flat-jahoda-robot": {
      character: "jahoda", title: "嘉霍达机器人吸收时附加基伤", sourceFile: "internal/characters/jahoda/burst.go", sourceCommits: [stellar],
      operation: "set", inputs: { talentLevel: talent, totalAtk, a1DmgMult: { label: "原 A1 元素分支保存的伤害倍率", unit: "ratio" } }, statLeaf: holderAtk,
      expression: expr.mul(expr.mul(table("talentLevel", jahodaRobot), v("totalAtk")), v("a1DmgMult")),
      explanation: "元素吸收成功时只读取一次爆发天赋、攻击力及原 A1 倍率；同一机器人攻击信息在后续定时命中及多目标间复用。",
    },
    "char-flat-kinich-a4-cannon": {
      character: "kinich", title: "基尼奇 A4 炮击附加基伤", sourceFile: "internal/characters/kinich/skill.go", sourceCommits: both,
      operation: "set", inputs: { stacks: { label: "原 A4 读取并立即清空的层数", unit: "stack", integer: true, minimum: 0, maximum: 2 }, totalAtk }, statLeaf: holderAtk,
      expression: expr.mul(expr.mul(n(3.2), v("stacks")), v("totalAtk")),
      explanation: "构造炮击 AttackInfo 时在原 A4 消耗层数及删除状态后读取一次总攻击力；之后的排队与快照沿用此值。",
    },
    "char-flat-mavuika-normal-burst": mavBurst("玛薇卡骑行普攻爆发加值", "attack.go", mavuikaNA),
    "char-flat-mavuika-normal-zero": mavZero("玛薇卡骑行普攻无爆发加值", "attack.go"),
    "char-flat-mavuika-normal-c2": mavC2("玛薇卡骑行普攻 C2 加值", "attack.go", .6),
    "char-flat-mavuika-sunfell-burst": mavBurst("玛薇卡坠日斩爆发加值", "burst.go", mavuikaQ),
    "char-flat-mavuika-sunfell-zero": mavZero("玛薇卡坠日斩无爆发加值", "burst.go"),
    "char-flat-mavuika-sunfell-c2": mavC2("玛薇卡坠日斩 C2 加值", "burst.go", 1.2),
    "char-flat-mavuika-final-burst": mavBurst("玛薇卡骑行重击终结爆发加值", "charge.go", mavuikaCA),
    "char-flat-mavuika-final-zero": mavZero("玛薇卡骑行重击终结无爆发加值", "charge.go"),
    "char-flat-mavuika-final-c2": mavC2("玛薇卡骑行重击终结 C2 加值", "charge.go", .9),
    "char-flat-mavuika-cyclic-burst": mavBurst("玛薇卡骑行重击旋转爆发加值", "charge.go", mavuikaCA),
    "char-flat-mavuika-cyclic-zero": mavZero("玛薇卡骑行重击旋转无爆发加值", "charge.go"),
    "char-flat-mavuika-cyclic-c2": mavC2("玛薇卡骑行重击旋转 C2 加值", "charge.go", .9),
    "char-flat-nicole-burst-projection": {
      character: "nicole", title: "妮可爆发奥术投影附加基伤", sourceFile: "internal/characters/nicole/burst.go", sourceCommits: both,
      operation: "set", inputs: { totalAtk }, statLeaf: holderAtk, expression: expr.mul(v("totalAtk"), n(3)),
      explanation: "原三道 Hexerei 门通过后，在投影任务实际执行帧读取妮可攻击力；投影攻击者仍是触发的角色。",
    },
    "char-flat-nicole-c1-projection": {
      character: "nicole", title: "妮可 C1 奥术投影附加基伤", sourceFile: "internal/characters/nicole/cons.go", sourceCommits: both,
      operation: "set", inputs: { totalAtk }, statLeaf: holderAtk, expression: expr.mul(v("totalAtk"), n(3)),
      explanation: "原三道 Hexerei 门通过后，在 C1 投影任务实际执行帧读取妮可攻击力；投影攻击者仍是触发的角色。",
    },
    "char-flat-razor-hexerei-wolf": {
      character: "razor", title: "雷泽魔导狼魂追加基伤", sourceFile: "internal/characters/razor/burst.go", sourceCommits: both,
      operation: "add", inputs: { totalAtk }, statLeaf: holderAtk, expression: expr.mul(n(.7), v("totalAtk")),
      explanation: "原狼魂回调的 IsHexerei 门通过后才读取雷泽攻击力；加在独立雷元素狼魂攻击上。",
    },
  } as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
})();

const group3 = (() => {
  const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
  const stellar = ["a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
  const n = expr.value;
  const v = expr.input;
  const a1Bonus = { label: "A1 helper 在本次攻击构造时返回的数值", unit: "damage" } as const;
  const c4Bonus = { label: "C4 helper 在 A1 之后返回的数值", unit: "damage" } as const;
  const plungeInputs = { a1Bonus, c4Bonus } as const;
  const plungeExpression = expr.add(v("a1Bonus"), v("c4Bonus"));
  const plungeBase = {
    character: "varesa", sourceFile: "internal/characters/varesa/plunge.go", sourceCommits: both,
    operation: "set", inputs: plungeInputs, expression: plungeExpression,
  } as const;

  return {
    "char-flat-sayu-c6-daruma": {
      character: "sayu", title: "早柚 C6 不倒貉貉精通附伤", sourceFile: "internal/characters/sayu/burst.go",
      sourceCommits: both, operation: "add",
      inputs: { atk: { label: "施放时另取的不倒貉貉快照总攻击力", unit: "ATK" },
        em: { label: "同一快照在 C6 伤害表达式中的元素精通", unit: "EM" } },
      snapshotLeaves: [{ stateKey: "atk", getter: "total-atk" }, { stateKey: "em", getter: "em" }],
      expression: expr.mul(v("atk"), expr.min(expr.mul(v("em"), n(.002)), n(4))),
      explanation: "C6 门通过后给复用的攻击事件加一次附伤；治疗继续在下一句独立读取快照精通。",
    },
    "char-flat-varesa-a1-atk-cache": {
      character: "varesa", title: "瓦蕾莎 A1 定时攻击力缓存", sourceFile: "internal/characters/varesa/asc.go",
      sourceCommits: both, operation: "set", resultUnit: "ATK",
      inputs: { totalAtk: { label: "每六帧更新点的一次总攻击力读取", unit: "ATK" } },
      statLeaves: [{ stateKey: "totalAtk", getter: "total-atk", actor: "holder" }],
      expression: v("totalAtk"),
      explanation: "只在来源的定时更新回调实际执行时生产缓存值，之后的 A1 helper 使用保存值和对应生产 ID。",
    },
    "char-flat-varesa-a1-helper": {
      character: "varesa", title: "瓦蕾莎 A1 下落攻击加值", sourceFile: "internal/characters/varesa/asc.go",
      sourceCommits: both, operation: "set",
      inputs: { mult: { label: "A1 原状态决定的 0.5 或 1.8 倍率", unit: "ratio", choices: [
        { value: .5, label: "普通" }, { value: 1.8, label: "C1 或夜魂加持" },
      ] }, a1Atk: { label: "每六帧刷新并保存的原 A1 攻击力", unit: "ATK" } },
      valueSources: { a1Atk: "char-flat-varesa-a1-atk-cache" },
      expression: expr.mul(v("mult"), v("a1Atk")),
      explanation: "突破与 A1 状态门通过后读取已生产的定时攻击力缓存；未激活分支直接返回零。",
    },
    "char-flat-varesa-a1-helper-no-source": {
      character: "varesa", title: "瓦蕾莎 A1 首次刷新前零缓存", sourceFile: "internal/characters/varesa/asc.go",
      sourceCommits: both, operation: "set",
      inputs: { mult: { label: "A1 原状态决定的 0.5 或 1.8 倍率", unit: "ratio", choices: [
        { value: .5, label: "普通" }, { value: 1.8, label: "C1 或夜魂加持" },
      ] }, a1Atk: { label: "首次六帧更新前原字段的零值", unit: "ATK", choices: [{ value: 0, label: "尚未刷新" }] } },
      expression: expr.mul(v("mult"), v("a1Atk")),
      explanation: "A1 已激活但首次定时更新尚未执行时，原字段仍为零；无保存值生产 ID。",
    },
    "char-flat-varesa-c4-helper": {
      character: "varesa", title: "瓦蕾莎 C4 下落攻击加值", sourceFile: "internal/characters/varesa/cons.go",
      sourceCommits: both, operation: "set",
      inputs: { totalAtk: { label: "C4 helper 原位置一次总攻击力读取", unit: "ATK" } },
      statLeaves: [{ stateKey: "totalAtk", getter: "total-atk", actor: "holder" }],
      expression: expr.min(expr.mul(v("totalAtk"), n(5)), n(20000)),
      explanation: "仅在 C4 与勤修状态门通过后读一次总攻击力，仍在 helper 内按原顺序记录加值日志。",
    },
    "char-flat-varesa-kablam-a1": {
      character: "varesa", title: "瓦蕾莎火山爆裂 A1 附伤", sourceFile: "internal/characters/varesa/burst.go",
      sourceCommits: both, operation: "set", inputs: { a1Bonus },
      valueSources: { a1Bonus: "char-flat-varesa-a1-helper" }, expression: v("a1Bonus"),
      explanation: "构造攻击信息时使用先前 A1 helper 的本次返回值，再于原 hitmark 排队。",
    },
    "char-flat-varesa-kablam-a1-no-source": {
      character: "varesa", title: "瓦蕾莎火山爆裂首次刷新前 A1 附伤", sourceFile: "internal/characters/varesa/burst.go",
      sourceCommits: both, operation: "set", inputs: { a1Bonus },
      valueSources: { a1Bonus: "char-flat-varesa-a1-helper-no-source" }, expression: v("a1Bonus"),
      explanation: "A1 helper 在首次缓存刷新前返回零，直接承接其真实零值回执。",
    },
    "char-flat-varesa-kablam-zero": {
      character: "varesa", title: "瓦蕾莎火山爆裂无 A1 附伤", sourceFile: "internal/characters/varesa/burst.go",
      sourceCommits: both, operation: "set", inputs: { a1Bonus }, expression: v("a1Bonus"),
      explanation: "A1 helper 的原生门返回零，没有调用属性 getter 或伪造 A1 产出。",
    },
    "char-flat-varesa-plunge-a1-c4": {
      ...plungeBase, title: "瓦蕾莎下落 A1 与 C4 附伤",
      valueSources: { a1Bonus: "char-flat-varesa-a1-helper", c4Bonus: "char-flat-varesa-c4-helper" },
      explanation: "原 AttackInfo 表达式先执行 A1 helper 再执行 C4 helper，之后相加并排队。",
    },
    "char-flat-varesa-plunge-a1-no-source-c4": {
      ...plungeBase, title: "瓦蕾莎下落首次刷新前 A1 与 C4 附伤",
      valueSources: { a1Bonus: "char-flat-varesa-a1-helper-no-source", c4Bonus: "char-flat-varesa-c4-helper" },
      explanation: "A1 读取未初始化的零缓存，随后 C4 按原序读取攻击力并记录日志。",
    },
    "char-flat-varesa-plunge-a1": {
      ...plungeBase, title: "瓦蕾莎下落仅 A1 附伤",
      valueSources: { a1Bonus: "char-flat-varesa-a1-helper" },
      explanation: "C4 helper 原生门返回零；保留 A1 helper 的产出关联和原加法。",
    },
    "char-flat-varesa-plunge-a1-no-source": {
      ...plungeBase, title: "瓦蕾莎下落首次刷新前仅 A1 附伤",
      valueSources: { a1Bonus: "char-flat-varesa-a1-helper-no-source" },
      explanation: "A1 helper 读取原零缓存且 C4 门返回零；两项按原顺序相加。",
    },
    "char-flat-varesa-plunge-c4": {
      ...plungeBase, title: "瓦蕾莎下落仅 C4 附伤",
      valueSources: { c4Bonus: "char-flat-varesa-c4-helper" },
      explanation: "A1 helper 原生门返回零；C4 helper 在原位置读攻击力并记录日志后相加。",
    },
    "char-flat-varesa-plunge-zero": {
      ...plungeBase, title: "瓦蕾莎下落无 A1、C4 附伤",
      explanation: "两个 helper 均由原生门返回零，仍保留 AttackInfo 的原始加法位置。",
    },
    "char-flat-yaemiko-revelation": {
      character: "yaemiko", title: "八重神子启示杀生樱附伤", sourceFile: "internal/characters/yaemiko/stellar.go",
      sourceCommits: stellar, operation: "set",
      inputs: { atk: { label: "消耗启示状态后的一次总攻击力读取", unit: "ATK" } },
      statLeaves: [{ stateKey: "atk", getter: "total-atk", actor: "holder" }],
      expression: expr.mul(n(.8), v("atk")),
      explanation: "启示与 ICD 门通过后先启动 ICD 并消耗状态，再算 80% 攻击力；辉光附加攻击回调继续由原 helper 产生。",
    },
  } as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
})();
export const characterFlatGroupE = {
  ...group1,
  ...group2,
  ...group3,
} as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
