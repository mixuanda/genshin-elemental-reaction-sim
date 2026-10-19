import type { CalculatorFormula, CalculatorHit } from "./calculator-model";
import { evaluateFormulaExpression, expr, type FormulaExpression } from "./calculation-trace";
import { DENDRO_TRAVELER_A4_SOURCE_REFS } from "./character-formula-rules";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;

export interface HeldLifecyclePassiveHitState {
  /** Current EM at damage resolution, including the actual A1 contribution; not the lamp's offensive snapshot EM. */
  actualElementalMasteryAtHit?: number | undefined;
  /** This hit's input damage bonus already contains this much Dendro Traveler A4. */
  includedDamageBonus?: number | undefined;
}

/** Structural subset shared with the schedule document's strict context schema. */
export interface HeldLifecyclePassiveContext {
  sharedState?: HeldLifecyclePassiveHitState | undefined;
  hitStates?: Record<string, HeldLifecyclePassiveHitState> | undefined;
}

export interface HeldLifecycleHitPassiveInput {
  skillId: string;
  ascension?: number | undefined;
  context: HeldLifecyclePassiveContext;
  hit: OrdinaryHit;
}

export interface HeldLifecycleHitPassiveResult {
  formula?: CalculatorFormula;
  issues: string[];
  actualBonus?: number;
}

/**
 * The lamp keeps its offensive snapshot, but A4 reads the owner's current EM at impact.
 * The existing single-hit A4 factory binds `em` to the ordinary panel; this branch uses
 * a separate named input so changing A1 after lamp creation does not overwrite that snapshot.
 * Hydro no-Suffusion, Pyro C0 and uninfused Noelle C0 add no numerical damage passive here;
 * their eligibility, HP, range and lifecycle restrictions are checked by the compiler.
 */
export function prepareHeldLifecycleHitPassive({ skillId, ascension, context, hit }: HeldLifecycleHitPassiveInput): HeldLifecycleHitPassiveResult {
  if (!/^held-(aether|lumine)-dendro-burst-pyro-c0$/.test(skillId)) return { issues: [] };

  const issues: string[] = [];
  const state = { ...context.sharedState, ...context.hitStates?.[hit.id] };
  if (ascension === undefined) issues.push("草旅行者完整Q缺少实际突破阶段，不能确定A4精通增伤是否解锁。");
  if (state.includedDamageBonus === undefined) issues.push("缺少本击增伤中已包含的草旅行者A4份额；须填写实际比例，0才表示明确未含。");
  if (ascension === undefined) return { issues };
  if (ascension >= 4 && state.actualElementalMasteryAtHit === undefined) {
    issues.push("草旅行者A4需要本次伤害命中时的实际精通，包含实际A1贡献；草灯莲第54帧的进攻快照精通不能代替该数值。");
    return { issues };
  }

  const inputs: CalculatorFormula["inputs"] = [{
    key: "heldDendroAscension", value: ascension, unit: "level", minimum: 0, maximum: 6, integer: true,
    meaningKey: "草旅行者本次实际突破阶段", origin: "derived-character-context",
  }];
  let actual: FormulaExpression = expr.value(0);
  if (ascension >= 4) {
    inputs.push({
      key: "heldDendroActualElementalMasteryAtHit", value: state.actualElementalMasteryAtHit!, unit: "stat", minimum: 0,
      meaningKey: "本次伤害命中时旅行者的实际精通，包含当时真正生效的A1与其他来源；独立于草灯莲进攻快照",
      origin: "explicit-impact-character-state",
    });
    actual = expr.condition("lt", expr.input("heldDendroAscension"), expr.value(4), expr.value(0),
      expr.mul(expr.input("heldDendroActualElementalMasteryAtHit"), expr.value(.001)));
  }
  const actualBonus = evaluateFormulaExpression(actual, Object.fromEntries(inputs.map(row => [row.key, row.value])));
  if (state.includedDamageBonus === undefined) return { issues, actualBonus };
  inputs.push({
    key: "heldDendroIncludedDamageBonus", value: state.includedDamageBonus, unit: "ratio", minimum: 0,
    meaningKey: "本击输入增伤已经包含的草旅行者A4份额；0表示明确未含", origin: "explicit-accounting",
  });
  return {
    issues, actualBonus,
    formula: {
      ruleId: "held-dendro-traveler-burst-a4-impact-accounting-b4ae769",
      label: "草旅行者Q A4：命中时实际精通×0.001 − 本击已含份额",
      expression: expr.sub(actual, expr.input("heldDendroIncludedDamageBonus")), inputs,
      requirements: { maximumConstellation: 0, elements: ["dendro"], attackTags: ["burst"] },
      sourceRefs: [
        ...DENDRO_TRAVELER_A4_SOURCE_REFS,
        "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/traveler/common/dendro/lealotus.go",
      ],
    },
  };
}
