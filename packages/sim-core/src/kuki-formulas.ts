import type { CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

const source = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
export const KUKI_DAMAGE_SOURCE_REFS = ["internal/characters/kuki/skill.go", "internal/characters/kuki/burst.go", "internal/characters/kuki/asc.go", "internal/characters/kuki/cons.go", "internal/characters/kuki/kuki.go", "internal/characters/kuki/zz_kukishinobu.dm.go", "pkg/core/status/status.go", "pkg/core/task/task.go", "pkg/core/attack.go"].map((path) => source + path).concat("https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/KukiShinobu/index.tsx");
const input = (key: string, value: number, origin = "source-rule", unit = "ratio") => ({key, value, origin, unit, meaningKey: `input.${key}`});

export function createKukiSkillBaseFormula(coefficient: number, ascension: number): CalculatorFormula {
  return {
    ruleId: "kuki-e-atk-and-a4-em-gcsim-b4ae769-optimizer-180a0a1",
    label: "久岐忍 E：攻击力×本段天赋倍率＋精通×25%×A4解锁状态；低突破初击来源冲突另行阻塞",
    expression: expr.add(expr.mul(expr.input("atk"), expr.input("kukiSkillCoefficient")), expr.mul(expr.input("em"), expr.input("kukiA4Rate"), expr.input("kukiA4Unlocked"))),
    inputs: [input("kukiSkillCoefficient", coefficient, "source-table"), input("kukiA4Rate", .25), input("kukiA4Unlocked", Number(ascension >= 4), "explicit-ascension", "boolean")],
    requirements: { maximumConstellation: 6, elements: ["electro"], attackTags: ["skill"] }, sourceRefs: KUKI_DAMAGE_SOURCE_REFS,
  };
}

export function createKukiC6EmFormula(active: boolean, included: boolean): CalculatorFormula {
  return {
    ruleId: "kuki-c6-final-em-accounting-gcsim-b4ae769",
    label: "久岐忍 C6：150精通×（本击有效状态−共享输入面板已含份额），不推测生命变化触发",
    expression: expr.mul(expr.input("kukiC6Em"), expr.sub(expr.input("kukiC6Active"), expr.input("kukiC6Included"))),
    inputs: [input("kukiC6Em", 150, "source-rule", "stat"), input("kukiC6Active", Number(active), "conditioned-user-input", "boolean"), input("kukiC6Included", Number(included), "explicit-accounting", "boolean")],
    requirements: { minimumConstellation: 6, maximumConstellation: 6, elements: ["electro"], attackTags: ["skill", "burst"] }, sourceRefs: KUKI_DAMAGE_SOURCE_REFS,
  };
}
