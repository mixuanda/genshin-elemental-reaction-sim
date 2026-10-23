import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { arlecchinoDamageContextSchema, type ArlecchinoDamageContext } from "./arlecchino-damage-context";
import { arlecchinoPrimaryMappings, arlecchinoPrimarySourceEvidence } from "../../game-data/src/character-mappings/arlecchino-primary-mappings";

export type ArlecchinoCalculatorDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument["gameContext"]> & {arlecchinoDamage?: ArlecchinoDamageContext};
};
export const ARLECCHINO_DAMAGE_SOURCE_REFS = arlecchinoPrimarySourceEvidence.files.map(file =>
  `https://github.com/genshinsim/gcsim/blob/${file.revision}/${file.path}`);
export const ARLECCHINO_DAMAGE_DEPENDENCY_PREFIX = "arlecchino-damage:";
export const ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION = 5;
const bondRuleId = "arlecchino-damage-pre-consumption-bond-base-b4ae769";
const passiveRuleId = "arlecchino-damage-passive-pyro-accounting-b4ae769";
const masque = arlecchinoPrimarySourceEvidence.coefficients.find(row => row.sourceTable === "masque")!.values;

export const arlecchinoContext = (document: CalculatorDocument): ArlecchinoDamageContext | undefined =>
  (document as ArlecchinoCalculatorDocument).gameContext?.arlecchinoDamage;
export function isArlecchinoDamageAction(document: CalculatorDocument): boolean {
  return document.gameContext?.characterId === "character:10000096"
    && arlecchinoPrimaryMappings.some(mapping => mapping.skillId === document.gameContext?.skillId);
}

/** Final ATK is not FlatDmg. A zero unmaterialized additive input proves no
 * own bond addition was previously entered; nonzero/converted inputs do not. */
export function canInferArlecchinoBondBaseZero(document: CalculatorDocument): boolean {
  return isArlecchinoDamageAction(document) && document.hits.length === 1 && document.hits.every(hit =>
    hit.kind === "ordinary" && hit.additiveBaseDamage === 0 && !hit.finalSnapshot
    && !hit.finalizedEquipmentEffects?.length && hit.finalizedEquipmentBaseInput === undefined
    && (!hit.additiveBaseFormula || hit.additiveBaseFormula.ruleId === bondRuleId));
}

export function createArlecchinoBondBaseFormula(effectiveNormalTalent: number, bondOfLifePercent: number, included: number, constellation = 0): CalculatorFormula {
  if (!Number.isInteger(constellation) || constellation < 0 || constellation > ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION)
    throw new Error("红死之宴单击目前只支持C0–C5；C6条件暴击状态尚未实现。");
  const coefficient = Number.isInteger(effectiveNormalTalent) ? masque[effectiveNormalTalent - 1] : undefined;
  if (coefficient === undefined || effectiveNormalTalent < 1 || effectiveNormalTalent > 15)
    throw new Error("生命之契附伤必须使用1–15级独立有效普攻天赋。");
  if (!Number.isFinite(bondOfLifePercent) || bondOfLifePercent < 30 || bondOfLifePercent > 200)
    throw new Error("红死之宴火普攻要求本击扣契前生命之契为最大生命的30%–200%。");
  return {
    ruleId: bondRuleId, label: "红死之宴：本击总攻击×命中前契比例×（有效普攻附伤倍率＋C1倍率）− 已含份额",
    expression: expr.sub(expr.mul(expr.input("atk"), expr.input("arlecchinoPreConsumptionBondPercent"), expr.value(.01), expr.add(expr.input("arlecchinoMasqueCoefficient"), expr.input("arlecchinoC1BondCoefficient"))), expr.input("arlecchinoIncludedBondBase")),
    inputs: [
      {key: "arlecchinoPreConsumptionBondPercent", value: bondOfLifePercent, unit: "percent", meaningKey: "本击取样时、命中回调扣契之前的实际生命之契占最大生命百分比", origin: "explicit-selected-hit-state", minimum: 30, maximum: 200},
      {key: "arlecchinoMasqueCoefficient", value: coefficient, unit: "ratio", meaningKey: "masque完整固定源向量按有效普攻等级取值，不使用E或Q等级", origin: "pinned-normal-talent-table"},
      {key: "arlecchinoC1BondCoefficient", value: constellation >= 1 ? 1 : 0, unit: "ratio", meaningKey: "C1在masque附伤倍率上加1.0（100个百分点），不将附伤整体翻倍", origin: "pinned-constellation-rule", allowedValues: [0, 1]},
      {key: "arlecchinoIncludedBondBase", value: included, unit: "damage", meaningKey: "本击附加基础伤害输入已包含的红死之宴份额", origin: "explicit-accounting", minimum: 0},
    ], requirements: {maximumConstellation: ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION, elements: ["pyro"], attackTags: ["normal"]}, sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS,
  };
}

export function createArlecchinoPassiveDamageBonusFormula(included: boolean): CalculatorFormula {
  return {
    ruleId: passiveRuleId, label: "唯厄月可知晓：固有40%火伤 − 输入已含份额",
    expression: expr.sub(expr.value(.4), expr.input("arlecchinoIncludedPassivePyroBonus")),
    inputs: [{key: "arlecchinoIncludedPassivePyroBonus", value: included ? .4 : 0, unit: "ratio",
      meaningKey: "所填火伤是否已含固有40%；装备重建未含，导入最终面板需明确", origin: "explicit-panel-accounting", allowedValues: [0, .4]}],
    requirements: {maximumConstellation: ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION, elements: ["pyro"], attackTags: ["normal"]}, sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS,
  };
}

function finalizedState(document: CalculatorDocument, hit: CalculatorHit, context: ArlecchinoDamageContext): string {
  const game = document.gameContext!, ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? game.ascension;
  return JSON.stringify([game.characterId, document.characterLevel, game.abilityId, game.skillId, game.effectiveTalentLevel,
    game.constellation, ascension, hit.id, context.bondOfLifePercent, context.passivePyroBonusIncluded, context.includedBondBase]);
}

/** Strict source contract: one actual C0–C5 Pyro normal, never a debt lifecycle. */
export function prepareArlecchinoDamageDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isArlecchinoDamageAction(document)) return document;
  const result = structuredClone(document) as ArlecchinoCalculatorDocument, game = result.gameContext;
  const context = arlecchinoDamageContextSchema.parse(game.arlecchinoDamage ?? {});
  game.arlecchinoDamage = context;
  if (context.includedBondBase === undefined && canInferArlecchinoBondBaseZero(result)) context.includedBondBase = 0;
  const mapping = arlecchinoPrimaryMappings.find(row => row.skillId === game.skillId)!;
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(ARLECCHINO_DAMAGE_DEPENDENCY_PREFIX));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(ARLECCHINO_DAMAGE_DEPENDENCY_PREFIX));
    const issues: string[] = [];
    if (result.dataIdentity.releaseStatus === "preview") issues.push("本入口只审阅固定Classic/Stellar已发布来源；预览规则不能借用此红死之宴公式。");
    if (result.scope !== "single-hit" || result.hits.length !== 1 || result.selectedHitIds.length !== 1 || hit.id !== mapping.id || result.selectedHitIds[0] !== mapping.id)
      issues.push("此入口只计算所选的一次实际普攻命中；第四段两击须分别选择，不能并成一段或整轮。");
    if (game.constellation > ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION) issues.push("红死之宴此单击目前只审阅C0–C5；C6普攻条件暴击状态尚未实现，不能按低命座代算。");
    if (game.abilityId !== "talent:arlecchino:combat1") issues.push("普通ATK项和生命之契附伤都使用独立有效普攻天赋，不能借用E或Q等级。");
    if (context.bondOfLifePercent === undefined) issues.push("请填写本击扣契前的实际生命之契百分比；公开展柜不包含这项战斗状态，不能猜测。");
    else if (context.bondOfLifePercent < 30) issues.push("生命之契低于最大生命的30%，红死之宴未生效；此火普攻入口不能静默改为物理伤害。");
    if (context.passivePyroBonusIncluded === undefined) issues.push("请明确所填火元素伤害加成是否已经包含唯厄月可知晓的40%火伤。");
    if (context.includedBondBase === undefined) issues.push("请明确附加基础伤害输入已包含的红死之宴份额；未含请填0。");
    if (hit.kind === "ordinary") {
      if (hit.baseDamageFormula) issues.push("固定来源普攻保留独立ATK天赋项，不接受基础伤害公式覆盖。");
      if (hit.groupMultiplier !== 1) issues.push("每个命中已独立声明，命中倍率必须为1，不能复制或缩放未声明实例。");
      if (hit.additiveBaseFormula?.ruleId === bondRuleId) delete hit.additiveBaseFormula;
      else if (hit.additiveBaseFormula) issues.push("生命之契附加基伤公式槽已有外来公式；未定义合并规则，不能覆盖。");
      if (hit.damageBonusFormula?.ruleId === passiveRuleId) delete hit.damageBonusFormula;
      else if (hit.damageBonusFormula) issues.push("固有火伤增伤公式槽已有外来公式；未定义合并规则，不能覆盖。");
      const coefficient = Number.isInteger(game.effectiveTalentLevel) ? mapping.sourceCoefficientValues?.[game.effectiveTalentLevel - 1] : undefined;
      if (coefficient === undefined || game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) issues.push("请提供1–15级的独立有效普攻天赋；不重复增加命座天赋等级。");
      else hit.terms = [{stat: "atk", coefficient}];
      hit.element = "pyro"; hit.attackTag = "normal";
      const saved = context.finalizedHitStates?.[hit.id], frozen = hit.finalSnapshot || hit.effectiveCritRate !== undefined || hit.effectiveCritDamage !== undefined;
      if ((saved !== undefined && saved !== finalizedState(result, hit, context))
        || (frozen && (saved === undefined || (hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion"))))
        issues.push("红死之宴状态、角色等级或天赋与已结算历史快照不一致；请重新应用来源配装，不能用新状态改写旧伤害。");
      if (!issues.length) {
        hit.additiveBaseFormula = createArlecchinoBondBaseFormula(game.effectiveTalentLevel, context.bondOfLifePercent!, context.includedBondBase!, game.constellation);
        hit.damageBonusFormula = createArlecchinoPassiveDamageBonusFormula(context.passivePyroBonusIncluded!);
      }
    } else issues.push("此入口必须使用来源已审阅的普通伤害命中，不能替换为已结算伤害、反应或其他命中类型。");
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...ARLECCHINO_DAMAGE_SOURCE_REFS])];
    const id = ARLECCHINO_DAMAGE_DEPENDENCY_PREFIX + hit.id;
    hit.dependencies.push(id);
    result.dependencies.push({id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "C0–C5实际红死之宴单击：ATK普攻项、命中扣契前契附伤（C1倍率加1.0）、已含加级的有效普攻等级和40%固有火伤分别核验。", sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS});
  }
  game.scopeCoverage = "single-hit";
  game.attributionPolicy = "仅所选C0–C5红死之宴火普攻的一次实际命中，使用已含C3加级的独立有效普攻天赋及本击扣契前生命之契；普通ATK项与（masque＋C1的1.0）×契比例×总ATK附加基伤分别计算。第四段两击分别取样；不含C2回收爆发、C4回能/Q冷却、C5的Q等级或耗契、回血、轮转。";
  result.assumptions = result.assumptions.filter(value => !value.startsWith("阿蕾奇诺红死单击："));
  result.assumptions.push("阿蕾奇诺红死单击：每次命中先取实际面板、契比例并结算伤害，随后原生回调才消耗当前契的7.5%；不从施放时契比例推算后续命中。固有40%火伤没有突破门。其他角色或装备的独立攻击/精通调整保留各自公式槽。");
  return result;
}

export function resetArlecchinoPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isArlecchinoDamageAction(document)) return;
  const context = (document as ArlecchinoCalculatorDocument).gameContext.arlecchinoDamage ??= {};
  delete context.finalizedHitStates;
  if (mode === "fresh-equipment") {context.passivePyroBonusIncluded = false; context.includedBondBase = 0;}
  else {
    delete context.bondOfLifePercent; delete context.passivePyroBonusIncluded; delete context.includedBondBase;
    if (canInferArlecchinoBondBaseZero(document)) context.includedBondBase = 0;
  }
}

/** Call only after the real shared conversion, never when importing a showcase. */
export function finalizeArlecchinoPanelAccounting(document: CalculatorDocument): void {
  if (!isArlecchinoDamageAction(document)) return;
  const context = (document as ArlecchinoCalculatorDocument).gameContext.arlecchinoDamage ??= {};
  context.finalizedHitStates = Object.fromEntries(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, finalizedState(document, hit, context)]));
}
