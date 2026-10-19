import type { CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

const clorindeSourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/clorinde";

export const CLORINDE_A1_RULE_ID = "clorinde-a1-c0-c1-gcsim-b4ae769";
export const CLORINDE_A1_SOURCE_REFS = [
  `${clorindeSourceRoot}/asc.go#L24-L34`,
  `${clorindeSourceRoot}/asc.go#L61-L73`,
  `${clorindeSourceRoot}/zz_clorinde.dm.go#L39-L41`,
];

/**
 * Fixed-source, conditioned C0/C1 Dark-Shattering Flame additive base damage.
 *
 * The adapter must establish ascension >= 1 and attack eligibility: an Electro
 * Normal Attack or an Elemental Burst hit. C2 changes both coefficient and cap
 * in the source and is deliberately outside this rule. This constructor does
 * not establish that a team triggered a reaction or that a stack is unexpired.
 * The caller supplies the explicit current stack count; zero means no buff.
 * `atk` is injected by the shared calculator from its resolved final panel.
 * This value enters additive base damage, not flat ATK or talent scaling.
 */
export function createClorindeA1Formula(stacks = 0): CalculatorFormula {
  if (!Number.isInteger(stacks) || stacks < 0 || stacks > 3) {
    throw new RangeError("破夜的明焰层数必须是 0 至 3 的整数；不得从队伍或反应名称推断层数。");
  }
  return {
    ruleId: CLORINDE_A1_RULE_ID,
    label: "破夜的明焰：C0/C1 有条件附加基础伤害（至多 1,800）",
    expression: expr.min(
      expr.mul(expr.input("atk"), expr.value(0.2), expr.input("clorindeA1Stacks")),
      expr.value(1_800),
    ),
    inputs: [{
      key: "clorindeA1Stacks",
      value: stacks,
      minimum: 0, maximum: 3, integer: true,
      unit: "count",
      meaningKey: "input.clorindeA1Stacks",
      origin: "conditioned-user-input",
      ownerId: "character:10000098",
    }],
    requirements: { minimumAscension: 1, maximumConstellation: 1, elements: ["electro"], attackTags: ["normal", "burst"] },
    sourceRefs: [...CLORINDE_A1_SOURCE_REFS],
  };
}

export const DENDRO_TRAVELER_A4_SOURCE_REFS = [
  "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/traveler/common/dendro/asc.go#L62-L83",
];

/** The source reads the hit's EM; this contributes ordinary DMG Bonus, not base damage. */
export function createDendroTravelerA4BonusFormula(attackTag:"skill"|"burst"):CalculatorFormula {
  return {
    ruleId:`dendro-traveler-a4-${attackTag}-gcsim-b4ae769`,
    label:`旅行者·草：突破 4 精通转${attackTag==="skill"?"战技":"爆发"}伤害加成`,
    expression:expr.mul(expr.input("em"),expr.value(attackTag==="skill"?.0015:.001)),
    inputs:[],
    requirements:{minimumAscension:4,elements:["dendro"],attackTags:[attackTag]},
    sourceRefs:[...DENDRO_TRAVELER_A4_SOURCE_REFS],
  };
}
