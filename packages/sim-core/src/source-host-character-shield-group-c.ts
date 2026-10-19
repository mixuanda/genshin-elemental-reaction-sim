import { expr } from "./calculation-trace";
import type { SourceHostCharacterShieldDescriptor } from "./source-host-character-shield-formula";

const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const n = expr.value;
const flat = { label: "原技能等级固定吸收量表值", unit: "HP" } as const;
const ratio = { label: "原技能等级防御或生命倍率表值", unit: "ratio" } as const;
const totalDef = { label: "原攻击快照总防御力", unit: "DEF" } as const;
const maxHp = { label: "原写入点单次最大生命值读取", unit: "HP" } as const;
const defSnapshot = { stateKey: "totalDef", getter: "total-def" } as const;
const maxHpRead = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const defFormula = expr.add(v("flat"), expr.mul(v("ratio"), v("totalDef")));

function xinyanSkill(level: 1 | 2 | 3): SourceHostCharacterShieldDescriptor {
  return {
    character: "xinyan", title: `辛焱战技 ${level} 级护盾吸收量`,
    sourceFile: "internal/characters/xinyan/skill.go", sourceCommits: commits,
    inputs: { flat, ratio, totalDef }, snapshotLeaf: defSnapshot,
    expression: defFormula,
    explanation: `原 updateShield 的 ${level} 级分支在写盾时按该等级两张技能表与施放战技时取得的同一快照防御力计算；分支选择、延迟和附带效果仍由原生处理。`,
  };
}

export const characterShieldGroupC = {
  "char-shield-noelle-skill": {
    character: "noelle", title: "诺艾尔护心铠吸收量",
    sourceFile: "internal/characters/noelle/skill.go", sourceCommits: commits,
    inputs: { flat, ratio, totalDef }, snapshotLeaf: defSnapshot,
    expression: defFormula,
    explanation: "战技原写点先取快照总防御力，再按固定量表值加防御倍率表值乘快照；原生护盾元素和期限保持。",
  },
  "char-shield-noelle-a1": {
    character: "noelle", title: "诺艾尔 A1 庇护护盾吸收量",
    sourceFile: "internal/characters/noelle/asc.go", sourceCommits: commits,
    inputs: { totalDef }, snapshotLeaf: defSnapshot,
    expression: expr.mul(v("totalDef"), n(4)),
    explanation: "仅在原 A1 低生命值及冷却门控后创建，以当次快照总防御力乘原固定系数 4；保留来源的元素字段。",
  },
  "char-shield-xinyan-skill-level-1": xinyanSkill(1),
  "char-shield-xinyan-skill-level-2": xinyanSkill(2),
  "char-shield-xinyan-skill-level-3": xinyanSkill(3),
  "char-shield-xinyan-burst-def": {
    character: "xinyan", title: "辛焱二命爆发施放时防御力保存值",
    sourceFile: "internal/characters/xinyan/burst.go", sourceCommits: commits,
    inputs: { defFactor: { label: "二命爆发原位置一次总防御力读取", unit: "DEF" } },
    statLeaf: { stateKey: "defFactor", getter: "total-def", actor: "holder" },
    expression: v("defFactor"), resultUnit: "DEF",
    explanation: "二命爆发施放时原生仅取一次 TotalDef(false)；保存此读取的值与公式 ID，延迟创建护盾时引用同一值。",
  },
  "char-shield-xinyan-burst-level-3": {
    character: "xinyan", title: "辛焱二命爆发三级护盾吸收量",
    sourceFile: "internal/characters/xinyan/skill.go", sourceCommits: commits,
    inputs: { flat, ratio, defFactor: { label: "爆发施放时保存的总防御力", unit: "DEF" } },
    valueSources: { defFactor: "char-shield-xinyan-burst-def" },
    expression: expr.add(v("flat"), expr.mul(v("ratio"), v("defFactor"))),
    explanation: "爆发后的原延迟任务只在原三级分支读取技能表，乘先前真实读取并保存的防御力；不在延迟帧重读。",
  },
  "char-shield-diona-paws": {
    character: "diona", title: "迪奥娜猫爪冻冻护盾吸收量",
    sourceFile: "internal/characters/diona/skill.go", sourceCommits: commits,
    inputs: {
      ratio: { label: "原技能等级生命倍率表值", unit: "ratio" }, maxHp, flat,
      pawCount: { label: "原短按或长按猫爪数", unit: "count", integer: true, choices: [{ value: 2, label: "短按" }, { value: 5, label: "长按" }] },
      c2: { label: "原二命分支", unit: "flag", integer: true, choices: [{ value: 0, label: "未触发" }, { value: 1, label: "触发" }] },
    }, statLeaf: maxHpRead,
    expression: expr.condition("equal", v("c2"), n(1),
      expr.mul(expr.mul(expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
        expr.condition("equal", v("pawCount"), n(5), n(1.75), n(1))), n(1.15)),
      expr.mul(expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
        expr.condition("equal", v("pawCount"), n(5), n(1.75), n(1)))),
    explanation: "原先倍率表×一次最大生命值再加固定表值；五爪长按乘 1.75，原二命分支再乘 1.15。同一施放后续猫爪仅延长现存盾期限，不重复生成公式。",
  },
  "char-shield-zhongli-jade": {
    character: "zhongli", title: "钟离玉璋护盾吸收量",
    sourceFile: "internal/characters/zhongli/shield.go", sourceCommits: commits,
    inputs: { flat, ratio, maxHp }, statLeaf: maxHpRead,
    expression: expr.add(v("flat"), expr.mul(v("ratio"), v("maxHp"))),
    explanation: "原 addJadeShield 按固定表值加倍率表值乘该次最大生命值读取；战技及二命爆发调用均沿原生时序。",
  },
} as const satisfies Record<string, SourceHostCharacterShieldDescriptor>;
