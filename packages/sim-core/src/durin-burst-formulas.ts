import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { resolveCalculatorStats } from "./calculator";
import { durinBurstContextSchema, type DurinBurstContext } from "./durin-burst-context";
import { durinBurstMappings, durinBurstSourceEvidence } from "../../game-data/src/character-mappings/durin-burst-mappings";

export type DurinBurstDocument = CalculatorDocument & {gameContext: NonNullable<CalculatorDocument["gameContext"]> & {durinBurst?: DurinBurstContext}};
export const DURIN_BURST_MAX_CONSTELLATION = 2;
export const DURIN_BURST_SOURCE_REFS = durinBurstSourceEvidence.files.map(file => file.sourceRef);
export const DURIN_BURST_RULE_IDS = {base: "durin-white-q-tick-a4-base-b4ae769", bonus: "durin-white-q-c2-pyro-accounting-b4ae769"} as const;
const prefix = "durin-burst:";
export const durinBurstContext = (document: CalculatorDocument) => (document as DurinBurstDocument).gameContext?.durinBurst;
export function isDurinBurstAction(document: CalculatorDocument): boolean {
  return document.gameContext?.characterId === "character:10000123" && durinBurstMappings.some(row => row.skillId === document.gameContext?.skillId);
}
export function createDurinWhiteTickBaseFormula(coefficient: number, a4: boolean): CalculatorFormula {
  return {ruleId: DURIN_BURST_RULE_IDS.base, label: "白焰之龙：有效Q倍率×攻击×前10次A4倍率（每100攻击3%，最多75%）",
    expression: expr.mul(expr.input("atk"), expr.input("durinWhiteTickCoefficient"), expr.add(expr.value(1), expr.mul(expr.input("durinA4Active"), expr.min(expr.mul(expr.div(expr.input("atk"), expr.value(100)), expr.value(.03)), expr.value(.75))))),
    inputs: [{key: "durinWhiteTickCoefficient", value: coefficient, unit: "ratio", origin: "pinned-effective-burst-talent", meaningKey: "独立有效Q天赋下的burstWhiteDoT倍率"}, {key: "durinA4Active", value: Number(a4), unit: "boolean", origin: "source-derived-current-burst-tick-index", meaningKey: "突破4且本次白Q第1–10次追击，当前实例的10次强化尚未用完"}],
    requirements: {maximumConstellation: 2, elements: ["pyro"], attackTags: ["burst"]}, sourceRefs: DURIN_BURST_SOURCE_REFS};
}
export function createDurinWhiteTickC2Formula(active: boolean, included: boolean): CalculatorFormula {
  return {ruleId: DURIN_BURST_RULE_IDS.bonus, label: "杜林C2：本击实际50%火伤 − 输入已经包含的份额",
    expression: expr.mul(expr.value(.5), expr.sub(expr.input("durinC2Active"), expr.input("durinC2Included"))),
    inputs: [{key: "durinC2Active", value: Number(active), unit: "boolean", origin: "actual-tick-snapshot", meaningKey: "本段取样前C2火伤是否已实际生效"}, {key: "durinC2Included", value: Number(included), unit: "boolean", origin: "explicit-input-accounting", meaningKey: "本击输入增伤已包含同一份50%火伤"}],
    requirements: {maximumConstellation: 2, elements: ["pyro"], attackTags: ["burst"]}, sourceRefs: DURIN_BURST_SOURCE_REFS};
}
function stateIdentity(document: CalculatorDocument, hit: CalculatorHit, context: DurinBurstContext): string {
  const state = Object.keys(durinBurstContextSchema.shape).filter(key => key !== "finalizedHitStates").map(key => context[key as keyof DurinBurstContext]), game = document.gameContext!;
  const stats = resolveCalculatorStats(document.build);
  return JSON.stringify([game.characterId, game.abilityId, game.skillId, game.variantId, game.effectiveTalentLevel, game.constellation, game.ascension,
    document.characterLevel, hit.id, state, [stats.atk, stats.hp, stats.def, stats.em, stats.critRate, stats.critDamage, stats.energyRecharge], hit.kind === "ordinary" ? [hit.finalSnapshot?.stats, hit.effectiveCritRate, hit.effectiveCritDamage] : null]);
}
export function prepareDurinBurstDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isDurinBurstAction(document)) return document;
  const result = structuredClone(document) as DurinBurstDocument, game = result.gameContext;
  const context = durinBurstContextSchema.parse(game.durinBurst ?? {}); game.durinBurst = context;
  const mapping = durinBurstMappings[0]!, ascension = (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  result.dependencies = result.dependencies.filter(dep => !dep.id.startsWith(prefix));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    const issues: string[] = [];
    if (result.dataIdentity.releaseStatus === "preview" || game.abilityId !== "talent:durin:combat3" || game.variantId !== undefined) issues.push("只支持固定已发布来源杜林白Q的独立有效Q天赋，不能借用其他身份或E等级。");
    if (result.scope !== "single-hit" || result.hits.length !== 1 || hit.id !== mapping.id || result.selectedHitIds.length !== 1 || result.selectedHitIds[0] !== mapping.id) issues.push("白焰之龙此入口只算一次实际追击，不包含初始三击、20次总和或整轮。");
    if (!Number.isInteger(game.constellation) || game.constellation < 0 || game.constellation > 2) issues.push("白Q此单次追击当前仅审阅C0–C2，更高命座不能按C2代算。");
    if (ascension === undefined) issues.push("请提供实际突破阶段，以确定前10次追击的A4强化。");
    else if (ascension >= 4 && context.tickIndex === undefined) issues.push("请选择这是本次白Q的第几次追击（1–20）；前10次与后10次的A4倍率不同。");
    if (game.constellation === 2) {
      if (context.c2PyroBonusActive === undefined) issues.push("请确认本段取样前C2的50%火伤是否已经生效；当前这一击触发的反应不能倒灌。");
      if (context.c2PyroBonusIncluded === undefined) issues.push("请明确本击增伤输入是否已经包含这份C2火伤，避免重复加入。");
    } else if (context.c2PyroBonusActive === true || context.c2PyroBonusIncluded === true) issues.push("当前命座没有C2，不能声明自身C2火伤生效或已含。");
    if (hit.kind !== "ordinary") issues.push("来源追击必须保留普通可暴击伤害，不能替换为固定结果或反应实例。");
    else {
      if (hit.groupMultiplier !== 1 || hit.occurrence || !hit.critEligible) issues.push("单次追击的实例数为1且可暴击，不能复制、加发生率或关闭暴击。");
      if (hit.baseDamageFormula?.ruleId === DURIN_BURST_RULE_IDS.base) delete hit.baseDamageFormula;
      else if (hit.baseDamageFormula) issues.push("A4基础伤害槽已有外来公式，未定义合并规则，不能覆盖。");
      if (hit.damageBonusFormula?.ruleId === DURIN_BURST_RULE_IDS.bonus) delete hit.damageBonusFormula;
      else if (hit.damageBonusFormula) issues.push("C2增伤槽已有外来公式，未定义合并规则，不能覆盖。");
      const coefficient = Number.isInteger(game.effectiveTalentLevel) ? mapping.sourceCoefficientValues?.[game.effectiveTalentLevel - 1] : undefined;
      if (coefficient === undefined || game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) issues.push("需要固定来源1–15级独立有效Q倍率，C3加级不得重复。");
      else hit.terms = [{stat: "atk", coefficient}];
      hit.element = "pyro"; hit.attackTag = "burst";
      const saved = context.finalizedHitStates?.[hit.id], frozen = hit.finalSnapshot || hit.effectiveCritRate !== undefined || hit.effectiveCritDamage !== undefined;
      if (saved !== undefined && saved !== stateIdentity(result, hit, context) || frozen && (saved === undefined || hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion")) issues.push("杜林本段序号、状态或角色等级与旧快照不一致；请重新应用来源配装，不能用当前状态改写旧伤害。");
      if (!issues.length) {
        hit.baseDamageFormula = createDurinWhiteTickBaseFormula(coefficient!, ascension! >= 4 && context.tickIndex! <= 10);
        hit.damageBonusFormula = createDurinWhiteTickC2Formula(game.constellation === 2 && context.c2PyroBonusActive === true, game.constellation === 2 && context.c2PyroBonusIncluded === true);
      }
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...DURIN_BURST_SOURCE_REFS])];
    const id = prefix + hit.id; hit.dependencies.push(id);
    result.dependencies.push({id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "当前白Q实际一次追击：有效Q等级、前10次A4强化及C2火伤份额明确。", sourceRefs: DURIN_BURST_SOURCE_REFS});
  }
  game.scopeCoverage = "single-hit";
  game.attributionPolicy = "只算当前白Q一次已经发生的白焰之龙追击，按该段实际攻击和增伤取样；前10次A4倍率自动推导。C1白色祝福只加给其他队友，不加本人；不含三次初始伤害、20次总和、黑Q或反应实体。敌人抗性输入应为本击实际火抗。";
  return result;
}
export function resetDurinBurstPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isDurinBurstAction(document)) return;
  const context = (document as DurinBurstDocument).gameContext.durinBurst ??= {};
  delete context.finalizedHitStates;
  if (mode === "fresh-equipment") context.c2PyroBonusIncluded = false;
  else {delete context.tickIndex; delete context.c2PyroBonusActive; delete context.c2PyroBonusIncluded;}
}
export function finalizeDurinBurstPanelAccounting(document: CalculatorDocument): void {
  if (!isDurinBurstAction(document)) return;
  const context = (document as DurinBurstDocument).gameContext.durinBurst ??= {};
  context.finalizedHitStates = Object.fromEntries(document.hits.map(hit => [hit.id, stateIdentity(document, hit, context)]));
}
