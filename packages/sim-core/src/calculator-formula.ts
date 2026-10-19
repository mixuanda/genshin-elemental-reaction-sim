/** Shared execution graphs. Both simulator arithmetic and calculator explanations run these expressions. */
import { CLASSIC_REACTION_FORMULA_PROFILE } from "@genshin-dps-lab/reaction-formulas";
import type { CritMode } from "@genshin-dps-lab/schemas";
import type { DamageCalculationInput, DamageCalculationResult, TransformativeReactionDamageInput, TransformativeReactionDamageResult, AdditiveReactionDamageInput, AdditiveReactionDamageResult } from "./formulas";
import { expr, TraceBuilder, executeFormulaExpression, traceInput, type FormulaExpression, type CalculationTraceNode, type TraceNodeOptions } from "./calculation-trace";
export const DAMAGE_FORMULA_SOURCE = "https://library.keqingmains.com/combat-mechanics/damage/damage-formula";
export const DAMAGE_FORMULA_SOURCES = [DAMAGE_FORMULA_SOURCE, "gcsim:b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541:pkg/core/combat/reaction.dm.go"];
const v = expr.input;
const n = expr.value;
/** Shared EM expression, including source-host pre-reaction callbacks. */
export function reactionMasteryBonusExpression(family: "amplifying" | "transformative" | "additive"): FormulaExpression {
  const [numerator, denominator] = family === "amplifying" ? [2.78, 1400] : family === "transformative" ? [16, 2000] : [5, 1200];
  return expr.div(expr.mul(n(numerator!), v("elementalMastery")), expr.add(n(denominator!), v("elementalMastery")));
}
export const WEAK_POINT_DAMAGE_SOURCE = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/pkg/enemy/damage.go";

/** A guaranteed outcome is distinct from a change to the character's CRIT rate. */
export function criticalMultiplierExpression(mode: CritMode, withWeakPointContext = false): FormulaExpression {
  const ordinary = mode === "average" ? expr.add(n(1), expr.mul(v("critRate"), v("critDamage")))
    : mode === "allCrit" ? expr.add(n(1), v("critDamage")) : n(1);
  return withWeakPointContext
    ? expr.condition("equal", v("hitWeakPoint"), n(1), expr.add(n(1), v("critDamage")), ordinary)
    : ordinary;
}

const DAMAGE_INPUTS = new Set(["talentDamage","flatDamage","baseDamage","afterBonus","afterDefense","afterResistance","afterCritical","afterReaction","levelBaseDamage","preResistanceDamage"]);
function formulaUnit(key:string):string { return key === "hitWeakPoint" ? "boolean" : /Level$/.test(key) ? "level" : key === "scalingValue" || key === "elementalMastery" ? "stat" : DAMAGE_INPUTS.has(key) ? "damage" : "ratio"; }
function runner(trace: boolean) {
  const builder = new TraceBuilder(DAMAGE_FORMULA_SOURCES);
  const previous = new Map<string,string>();
  const step = (id: string, expression: FormulaExpression, values: Record<string, number>, options: TraceNodeOptions = {}) => {
    if (!trace) return executeFormulaExpression(expression, values);
    const childIds=[...new Set(Object.keys(values).flatMap(key=>previous.has(key)?[previous.get(key)!]:[]))];
    const value=builder.add(id, `stage.${id}`, expression, Object.entries(values).map(([key,value]) => traceInput(key,value, formulaUnit(key), previous.has(key)?{kind:"previous-step",reference:previous.get(key)!}:"calculation-context", `input.${key}`)), { explanationKey: `explain.${id}`, childIds, ...options });
    previous.set(id,id);
    if(["expectedMultiplier","criticalMultiplier","nonCriticalMultiplier"].includes(id)) previous.set("critMultiplier",id);
    return value;
  };
  return { builder, step };
}
function resistanceGraph(step: ReturnType<typeof runner>["step"], resistance: number) {
  return step("resistanceMultiplier", expr.condition("lt", v("resistance"),n(0), expr.sub(n(1),expr.div(v("resistance"),n(2))), expr.condition("lt",v("resistance"),n(0.75),expr.sub(n(1),v("resistance")),expr.div(n(1),expr.add(expr.mul(n(4),v("resistance")),n(1))))), { resistance });
}
/** Delivery-only paths reuse the exact ordinary/special target resistance AST. */
export function calculateResistanceMultiplierTrace(resistance: number): { value: number; trace: CalculationTraceNode[] } {
  if (!Number.isFinite(resistance)) throw new RangeError("resistance must be finite");
  const { builder, step } = runner(true);
  return { value: resistanceGraph(step, resistance), trace: builder.nodes };
}
function requireFiniteInputs(input: object) {
  for (const [key,value] of Object.entries(input)) if (typeof value === "number" && !Number.isFinite(value)) throw new RangeError(`${key} must be finite`);
}
export function executeOrdinaryDamage(input: DamageCalculationInput, withTrace: boolean): DamageCalculationResult & { trace: CalculationTraceNode[] } {
  requireFiniteInputs(input);
  const { builder, step } = runner(withTrace);
  const talentDamage = step("talentDamage",expr.mul(v("scaling"),v("scalingValue")),{ scaling:input.scaling,scalingValue:input.scalingValue },{ unit:"damage" });
  const baseDamage = step("baseDamage",expr.add(v("talentDamage"),v("flatDamage")),{talentDamage,flatDamage:input.flatDamage},{unit:"damage"});
  const damageBonusMultiplier = step("damageBonusMultiplier",expr.add(n(1),v("damageBonus")),{damageBonus:input.damageBonus});
  const afterBonus = step("afterBonus",expr.mul(v("baseDamage"),v("damageBonusMultiplier")),{baseDamage,damageBonusMultiplier},{unit:"damage"});
  const defenseIgnore = step("defenseIgnore",expr.clamp(v("defenseIgnore"),n(0),n(1)),{defenseIgnore:input.defenseIgnore});
  const defenseReduction = step("defenseAdjustment",expr.clamp(v("defenseAdjustment"),n(-1),n(0.9)),{defenseAdjustment:input.defenseReduction});
  const defenseMultiplier = step("defenseMultiplier",expr.div(expr.add(v("characterLevel"),n(100)),expr.add(expr.add(v("characterLevel"),n(100)),expr.mul(expr.add(v("enemyLevel"),n(100)),expr.add(n(1),v("defenseAdjustment")),expr.sub(n(1),v("defenseIgnore"))))),{characterLevel:input.characterLevel,enemyLevel:input.enemyLevel,defenseAdjustment:defenseReduction,defenseIgnore});
  const afterDefense = step("afterDefense",expr.mul(v("afterBonus"),v("defenseMultiplier")),{afterBonus,defenseMultiplier},{unit:"damage"});
  const resistanceMultiplier = resistanceGraph(step,input.effectiveResistance);
  const afterResistance = step("afterResistance",expr.mul(v("afterDefense"),v("resistanceMultiplier")),{afterDefense,resistanceMultiplier},{unit:"damage"});
  const critRate = step("critRate",expr.clamp(v("critRate"),n(0),n(1)),{critRate:input.critRate});
  const critDamage = step("critDamage",expr.max(n(0),v("critDamage")),{critDamage:input.critDamage});
  const weakPointContext = input.hitWeakPoint !== undefined;
  if (weakPointContext) step("weakPointGuaranteedCritical", v("hitWeakPoint"), { hitWeakPoint: Number(input.hitWeakPoint) }, {
    unit: "boolean", sourceRefs: [WEAK_POINT_DAMAGE_SOURCE],
    applicabilityReason: "此处读取明确的实际弱点命中；1保证暴击并跳过暴击随机抽样，0沿用所选暴击模式，不改变人物面板暴击率。"
  });
  const critMultiplier = step(input.critMode === "average" ? "expectedMultiplier" : input.critMode === "allCrit" ? "criticalMultiplier" : "nonCriticalMultiplier",
    criticalMultiplierExpression(input.critMode, weakPointContext),
    { critRate, critDamage, ...(weakPointContext ? { hitWeakPoint: Number(input.hitWeakPoint) } : {}) },
    weakPointContext ? { sourceRefs: [...DAMAGE_FORMULA_SOURCES, WEAK_POINT_DAMAGE_SOURCE], explanationKey: "explain.weakPointCriticalMultiplier", childIds: ["critRate", "critDamage", "weakPointGuaranteedCritical"] } : {});
  if (!(input.reaction in CLASSIC_REACTION_FORMULA_PROFILE.amplifyingBaseMultipliers)) throw new TypeError("reaction must be a supported amplifying reaction");
  const base = input.explicitReactionBase ?? CLASSIC_REACTION_FORMULA_PROFILE.amplifyingBaseMultipliers[input.reaction];
  if (!Number.isFinite(base) || base <= 0) throw new RangeError("explicitBase must be a finite positive number");
  const elementalMastery = Math.max(0,input.elementalMastery);
  const elementalMasteryBonus = step("amplifyingEmBonus",base === 1 ? n(0) : reactionMasteryBonusExpression("amplifying"),{elementalMastery},{status:base === 1 ? "not-applicable" : "applied", applicabilityReason:base === 1 ? "reaction.none" : "reaction.amplifying"});
  const reactionBonus = base === 1 ? 0 : Math.max(0,input.reactionBonus);
  const reactionMultiplier = step("reactionMultiplier",expr.mul(v("reactionBase"),expr.add(n(1),v("elementalMasteryBonus"),v("reactionBonus"))),{reactionBase:base,elementalMasteryBonus,reactionBonus},{status:base === 1 ? "not-applicable" : "applied", applicabilityReason:base === 1 ? "reaction.none" : "reaction.amplifying"});
  // Preserve the inherited left-to-right operation order: CRIT precedes amplification.
  // Educational pre-critical reaction values below are separate graph nodes, not parsed rounded text.
  const afterCritical = step("afterCritical",expr.mul(v("afterResistance"),v("critMultiplier")),{afterResistance,critMultiplier},{unit:"damage"});
  const afterReaction = step("afterReaction",expr.mul(v("afterCritical"),v("reactionMultiplier")),{afterCritical,reactionMultiplier},{unit:"damage",status:base === 1 ? "not-applicable" : "applied"});
  const finalDamage = step("finalDamage",expr.mul(v("afterReaction"),v("groupMultiplier")),{afterReaction,groupMultiplier:input.groupMultiplier},{unit:"damage"});
  return {finalDamage,trace:builder.nodes,factors:{ scaling:input.scaling,scalingStat:input.scalingStat,scalingValue:input.scalingValue,flatDamage:input.flatDamage,baseDamage,damageBonus:input.damageBonus,damageBonusMultiplier,defenseIgnore,defenseReduction,defenseMultiplier,effectiveResistance:input.effectiveResistance,resistanceMultiplier,critRate,critDamage,critMultiplier,reactionBase:base,elementalMasteryBonus,reactionBonus,amplifyingReactionMultiplier:reactionMultiplier,groupMultiplier:input.groupMultiplier }};
}
export function calculateDamageTrace(input: DamageCalculationInput) { return executeOrdinaryDamage(input,true); }

export function reactionLevelBaseDamage(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 100) throw new RangeError("characterLevel must be an integer from 1 to 100");
  return CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel[level-1]!;
}
export function executeTransformativeDamage(input: TransformativeReactionDamageInput, withTrace: boolean): TransformativeReactionDamageResult & {trace:CalculationTraceNode[]} {
  const levelBaseDamage = reactionLevelBaseDamage(input.characterLevel);
  requireFiniteInputs(input);
  if (input.baseMultiplier < 0) throw new RangeError("baseMultiplier must be a finite non-negative number");
  const {builder,step} = runner(withTrace);
  step("levelBaseDamage",v("levelBaseDamage"),{levelBaseDamage},{unit:"damage",applicabilityReason:`exact-level-table:${input.characterLevel}`});
  const elementalMastery = Math.max(0,input.elementalMastery);
  const elementalMasteryBonus = step("transformativeEmBonus",reactionMasteryBonusExpression("transformative"),{elementalMastery});
  const reactionBonus = Math.max(0,input.reactionBonus);
  const preResistanceDamage = step("transformativeBaseDamage",expr.mul(v("levelBaseDamage"),v("baseMultiplier"),expr.add(n(1),v("elementalMasteryBonus"),v("reactionBonus"))),{levelBaseDamage,baseMultiplier:input.baseMultiplier,elementalMasteryBonus,reactionBonus},{unit:"damage"});
  const resistanceMultiplier = resistanceGraph(step,input.effectiveResistance);
  const finalDamage = step("transformativeDamage",expr.mul(v("preResistanceDamage"),v("resistanceMultiplier")),{preResistanceDamage,resistanceMultiplier},{unit:"damage"});
  return {finalDamage,levelBaseDamage,elementalMasteryBonus,reactionBonus,preResistanceDamage,resistanceMultiplier,trace:builder.nodes};
}
export function calculateTransformativeDamageTrace(input:TransformativeReactionDamageInput) { return executeTransformativeDamage(input,true); }
export function executeAdditiveDamage(input:AdditiveReactionDamageInput,withTrace:boolean):AdditiveReactionDamageResult & {trace:CalculationTraceNode[]} {
  if (input.reaction !== "aggravate" && input.reaction !== "spread") throw new TypeError('reaction must be either "aggravate" or "spread"');
  const levelBaseDamage=reactionLevelBaseDamage(input.characterLevel); requireFiniteInputs(input);
  const {builder,step}=runner(withTrace); const elementalMastery=Math.max(0,input.elementalMastery);
  const elementalMasteryBonus=step("additiveEmBonus",reactionMasteryBonusExpression("additive"),{elementalMastery});
  const reactionBonus=Math.max(0,input.reactionBonus); const baseMultiplier=CLASSIC_REACTION_FORMULA_PROFILE.additiveBaseMultipliers[input.reaction];
  const flatDamage=step("additiveReactionDamage",expr.mul(v("levelBaseDamage"),v("baseMultiplier"),expr.add(n(1),v("elementalMasteryBonus"),v("reactionBonus"))),{levelBaseDamage,baseMultiplier,elementalMasteryBonus,reactionBonus},{unit:"damage"});
  return {reaction:input.reaction,levelBaseDamage,baseMultiplier,elementalMasteryBonus,reactionBonus,flatDamage,trace:builder.nodes};
}
