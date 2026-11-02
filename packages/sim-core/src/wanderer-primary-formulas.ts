import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { resolveCalculatorStats } from "./calculator";
import { wandererPrimaryContextSchema, type WandererPrimaryContext } from "./wanderer-primary-context";
import { wandererPrimaryMappings, wandererPrimarySourceEvidence } from "../../game-data/src/character-mappings/wanderer-primary-mappings";

export type WandererPrimaryDocument = CalculatorDocument & {gameContext: NonNullable<CalculatorDocument["gameContext"]> & {wandererPrimary?: WandererPrimaryContext}};
export const WANDERER_PRIMARY_MAX_CONSTELLATION = 6;
export const WANDERER_PRIMARY_SOURCE_REFS = [...wandererPrimarySourceEvidence.files.map(file => file.sourceRef),
  `source-host-patch:137-wanderer-c2-burst-snapshot-scope.patch:sha256:${wandererPrimarySourceEvidence.c2ScopePatch.sha256}`];
const prefix = "wanderer-primary:";
export const WANDERER_PRIMARY_RULE_IDS = {attack: "wanderer-primary-a1-pyro-atk-b4ae769", critRate: "wanderer-primary-a1-cryo-cr-b4ae769", burstBonus: "wanderer-primary-c2-q-bonus-b4ae769"} as const;
const input = (key: string, value: number, unit: string, meaningKey: string, origin = "explicit-actual-hit-state") => ({key, value, unit, meaningKey, origin});
export const wandererPrimaryContext = (document: CalculatorDocument) => (document as WandererPrimaryDocument).gameContext?.wandererPrimary;
export function isWandererPrimaryAction(document: CalculatorDocument): boolean {
  return document.gameContext?.characterId === "character:10000075" && wandererPrimaryMappings.some(row => row.skillId === document.gameContext?.skillId);
}
export function createWandererPyroAttackFormula(baseAttack: number, actualPercent: number, includedPercent: number): CalculatorFormula {
  return {ruleId: WANDERER_PRIMARY_RULE_IDS.attack, label: "拾玉得花·火：基础攻击×（实际30%攻击 − 输入已含份额）",
    expression: expr.mul(expr.input("wandererBaseAttack"), expr.sub(expr.input("wandererPyroActualPercent"), expr.input("wandererPyroIncludedPercent")), expr.value(.01)),
    inputs: [input("wandererBaseAttack", baseAttack, "stat", "角色加武器的基础攻击；配装自动推导"), input("wandererPyroActualPercent", actualPercent, "percent", "本击取样时实际火吸收攻击加成"), input("wandererPyroIncludedPercent", includedPercent, "percent", "输入攻击力已经包含的同一份额")],
    requirements: {maximumConstellation: 6, elements: ["anemo"]}, sourceRefs: WANDERER_PRIMARY_SOURCE_REFS};
}
export function createWandererCryoCriticalFormula(actualPercent: number, includedPercent: number): CalculatorFormula {
  return {ruleId: WANDERER_PRIMARY_RULE_IDS.critRate, label: "拾玉得花·冰：实际20个百分点暴击率 − 输入已含份额",
    expression: expr.mul(expr.sub(expr.input("wandererCryoActualPercent"), expr.input("wandererCryoIncludedPercent")), expr.value(.01)),
    inputs: [input("wandererCryoActualPercent", actualPercent, "percent", "本击取样时实际冰吸收暴击率"), input("wandererCryoIncludedPercent", includedPercent, "percent", "输入暴击率已包含的同一份额")],
    requirements: {maximumConstellation: 6, elements: ["anemo"]}, sourceRefs: WANDERER_PRIMARY_SOURCE_REFS};
}
export function createWandererBurstC2Formula(windfavored: boolean, spentUpTo50: number, includedPercent: number, constellation: number): CalculatorFormula {
  return {ruleId: WANDERER_PRIMARY_RULE_IDS.burstBonus, label: "二番·箙岛月白浪：按Q时已消耗空居力×4%，最多200% − 已含份额",
    expression: expr.sub(expr.mul(expr.value(Number(windfavored && constellation >= 2)), expr.min(expr.mul(expr.input("wandererSpentKuugoryoku"), expr.value(.04)), expr.value(2))), expr.mul(expr.input("wandererC2IncludedPercent"), expr.value(.01))),
    inputs: [input("wandererSpentKuugoryoku", spentUpTo50, "points", "按下Q时实际消耗量；50代表至少50点并达到来源上限"), input("wandererC2IncludedPercent", includedPercent, "percent", "输入本击增伤已经包含的同一份C2增伤")],
    requirements: {maximumConstellation: 6, elements: ["anemo"], attackTags: ["burst"]}, sourceRefs: WANDERER_PRIMARY_SOURCE_REFS};
}
function stateIdentity(document: CalculatorDocument, hit: CalculatorHit, context: WandererPrimaryContext): string {
  const state = Object.keys(wandererPrimaryContextSchema.shape).filter(key => key !== "finalizedHitStates").map(key => context[key as keyof WandererPrimaryContext]);
  const game = document.gameContext!;
  const stats = resolveCalculatorStats(document.build);
  return JSON.stringify([game.characterId, game.abilityId, game.skillId, game.variantId, game.effectiveTalentLevel, game.constellation,
    game.ascension, document.characterLevel, hit.id, state, [stats.atk, stats.hp, stats.def, stats.em, stats.critRate, stats.critDamage, stats.energyRecharge],
    hit.kind === "ordinary" ? [hit.finalSnapshot?.stats, hit.effectiveCritRate, hit.effectiveCritDamage] : null]);
}

/** Actual selected Windfavored NA/extra, or the five fixed Q contacts. No rotation. */
export function prepareWandererPrimaryDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isWandererPrimaryAction(document)) return document;
  const result = structuredClone(document) as WandererPrimaryDocument, game = result.gameContext;
  const context = wandererPrimaryContextSchema.parse(game.wandererPrimary ?? {}); game.wandererPrimary = context;
  const mappings = wandererPrimaryMappings.filter(row => row.skillId === game.skillId), q = game.skillId === "wanderer-kyougen-five-hits", extra = game.skillId.includes("-c6-");
  const ascension = (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  if (result.build.mode === "equipment-derived") context.baseAttack = result.build.characterBaseAtk + result.build.weaponBaseAtk;
  const selected = new Set(result.selectedHitIds), selectedCount = result.hits.filter(hit => selected.has(hit.id)).length;
  const common: string[] = [];
  if (result.dataIdentity.releaseStatus === "preview") common.push("此入口只审阅固定已发布来源，预览角色规则不能借用。");
  if (!Number.isInteger(game.constellation) || game.constellation < 0 || game.constellation > 6) common.push("所选流浪者输出只审阅C0–C6。");
  if (game.abilityId !== `talent:wanderer:${q ? "combat3" : "combat1"}` || game.variantId !== undefined) common.push("所选来源身份与普攻／Q有效天赋不一致，不能借另一技能等级。");
  const validShape = result.hits.length === mappings.length && new Set(result.hits.map(hit => hit.id)).size === mappings.length && result.hits.every(hit => mappings.some(mapping => mapping.id === hit.id))
    && result.selectedHitIds.length === selectedCount && selectedCount > 0;
  if (!validShape || !q && (result.scope !== "single-hit" || selectedCount !== 1) || result.scope === "single-hit" && selectedCount !== 1) common.push("命中集合与固定来源不一致；普通／C6追加各为独立一击，Q仅固定五击，不能复制实例。");
  if (ascension === undefined) common.push("请提供实际突破阶段，以确定火／冰吸收天赋。");
  if (ascension !== undefined && ascension < 1) {
    if (context.absorptionBonuses !== undefined && context.absorptionBonuses !== "neither") common.push("尚未解锁拾玉得花，不能使用火攻击或冰暴击增益。");
    context.pyroAttackIncludedPercent ??= 0; context.cryoCritRateIncludedPercent ??= 0;
  } else if (context.absorptionBonuses === undefined) common.push("请选择本击取样时火30%攻击／冰20%暴击增益实际生效的组合；不能按队友元素猜测。");
  const actualPyro = ascension !== undefined && ascension >= 1 && (context.absorptionBonuses === "pyro" || context.absorptionBonuses === "pyro-cryo") ? 30 : 0;
  const actualCryo = ascension !== undefined && ascension >= 1 && (context.absorptionBonuses === "cryo" || context.absorptionBonuses === "pyro-cryo") ? 20 : 0;
  if (context.pyroAttackIncludedPercent === undefined) common.push("请明确输入攻击力已包含火吸收的多少个百分点（0–30），未含填0。");
  if (context.cryoCritRateIncludedPercent === undefined) common.push("请明确输入暴击率已包含冰吸收的多少个百分点（0–20），未含填0。");
  const attackDelta = actualPyro - (context.pyroAttackIncludedPercent ?? 0);
  if (attackDelta !== 0 && context.baseAttack === undefined) common.push("需要角色加武器的基础攻击来补火吸收差值；来源配装可自动提供，不能把总攻击当基础攻击。");
  if (!q && context.skillTalentLevel === undefined) common.push("请填写独立有效E天赋（1–15）；空居倍率不能借用普攻等级，C5加级只计一次。");
  if (extra && (game.constellation !== 6 || context.c6ParentQualified !== true)) common.push("此项是C6独立追加；需原普攻确实命中，且其命中回调时仍在空居、有空居力，不能只凭C6命座复制普攻。");
  if (q) {
    if (context.burstWindfavoredAtCast === undefined) common.push("请确认按下本次Q时是否仍在空居；C2只在该分支取样。");
    if (context.burstWindfavoredAtCast === false && (actualPyro > 0 || actualCryo > 0)) common.push("退出空居会移除火／冰吸收增益；普通Q不能声明仍有该自身增益。");
    if (game.constellation >= 2 && context.burstWindfavoredAtCast && context.burstC2ConsumedPointsUpTo50 === undefined) common.push("请填写按Q时已消耗空居力（0–50；至少50填50），不默认满C2增伤。");
    if (game.constellation < 2) {
      if ((context.burstC2IncludedPercent ?? 0) > 0) common.push("未解锁C2，输入不能声明含有本人的C2增伤。");
      context.burstC2IncludedPercent ??= 0;
    }
    if (context.burstC2IncludedPercent === undefined) common.push("请明确本击增伤已包含多少C2增伤（0–200%），避免重复。");
    if (selectedCount > 1 && context.burstConditionsStable !== true) common.push("多击合计需确认五击共同55帧取样及各击目标／装备结算条件一致；变化时请单选实际一击。");
    if (selectedCount === 5 && result.scope !== "single-hit" && context.burstAllHitsConnected !== true) common.push("五击合计需确认这五击全部实际命中同一目标，不补造未命中伤害。");
  }
  result.dependencies = result.dependencies.filter(dep => !dep.id.startsWith(prefix));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    const issues = [...common], mapping = mappings.find(row => row.id === hit.id);
    if (hit.kind !== "ordinary") issues.push("固定来源命中必须保留普通伤害类型，不能替换为已结算值或反应实例。");
    else {
      if (hit.baseDamageFormula) issues.push("固定来源保留NA×E或Q的ATK倍率，不接受外来基础伤害公式覆盖。");
      if (hit.groupMultiplier !== 1 || hit.occurrence) issues.push("命中必须是独立可暴击的一次实例，不能用倍数或发生率复制／替换。");
      if (!hit.critEligible) issues.push("固定来源命中允许暴击，不能关闭资格来绕过冰吸收状态。");
      if (hit.attackAdjustment?.formula.ruleId === WANDERER_PRIMARY_RULE_IDS.attack) delete hit.attackAdjustment;
      else if (attackDelta !== 0 && hit.attackAdjustment) issues.push("火吸收需要攻击调整槽，已有外来公式尚无合并规则，不能覆盖。");
      if (hit.critRateFormula?.ruleId === WANDERER_PRIMARY_RULE_IDS.critRate) delete hit.critRateFormula;
      else if (hit.critRateFormula) issues.push("冰吸收暴击槽已有外来公式，未定义合并规则，不能覆盖。");
      if (q) {
        if (hit.damageBonusFormula?.ruleId === WANDERER_PRIMARY_RULE_IDS.burstBonus) delete hit.damageBonusFormula;
        else if (hit.damageBonusFormula) issues.push("Q的C2增伤槽已有外来公式，未定义合并规则，不能覆盖。");
      }
      const base = Number.isInteger(game.effectiveTalentLevel) ? mapping?.sourceCoefficientValues?.[game.effectiveTalentLevel - 1] : undefined;
      const e = context.skillTalentLevel === undefined ? undefined : wandererPrimarySourceEvidence.tables.skillNABonus[context.skillTalentLevel - 1];
      if (base === undefined || game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15 || !q && e === undefined) issues.push("缺少固定来源1–15级独立有效NA/E/Q倍率；不得默认0或重复增加命座等级。");
      else hit.terms = [{stat: "atk", coefficient: base * (q ? 1 : e!) * (extra ? .4 : 1)}];
      hit.element = "anemo"; hit.attackTag = q ? "burst" : "normal";
      const saved = context.finalizedHitStates?.[hit.id], frozen = hit.finalSnapshot || hit.effectiveCritRate !== undefined || hit.effectiveCritDamage !== undefined;
      if (saved !== undefined && saved !== stateIdentity(result, hit, context) || frozen && (saved === undefined || hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion")) issues.push("流浪者状态、等级或输入已改变，不能把当前状态写入旧快照；请重新应用来源配装。");
      if (!issues.length) {
        if (attackDelta !== 0) hit.attackAdjustment = {accounting: "add-to-panel", formula: createWandererPyroAttackFormula(context.baseAttack!, actualPyro, context.pyroAttackIncludedPercent!)};
        hit.critRateFormula = createWandererCryoCriticalFormula(actualCryo, context.cryoCritRateIncludedPercent!);
        if (q) hit.damageBonusFormula = createWandererBurstC2Formula(context.burstWindfavoredAtCast!, context.burstC2ConsumedPointsUpTo50 ?? 0, context.burstC2IncludedPercent!, game.constellation);
      }
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...WANDERER_PRIMARY_SOURCE_REFS])];
    const id = prefix + hit.id; hit.dependencies.push(id);
    result.dependencies.push({id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "实际空居单击／固定Q命中：有效等级、吸收状态及已含份额明确。", sourceRefs: WANDERER_PRIMARY_SOURCE_REFS});
  }
  const ready = !result.dependencies.some(dep => dep.id.startsWith(prefix) && dep.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : q && selectedCount === 5 && ready ? "complete-cast" : "selected-components";
  game.attributionPolicy = q ? "狂言固定五击共用55帧来源快照；可单选实际一击，完整合计须确认五击命中且结算条件稳定。C2取按Q时实际已消耗空居力，最高200%，不加给普通攻击或C6追加。"
    : extra ? "仅已经实际触发的这一枚C6追加，倍率为对应空居普攻倍率的40%，原命中后8帧重新取样；不含原普攻或其他追击。" : "仅所选空居普攻的一次命中，倍率为独立有效NA×E倍率；第三段两击分别选取，不自动加C6或风矢。";
  return result;
}
export function resetWandererPrimaryPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isWandererPrimaryAction(document)) return;
  const context = (document as WandererPrimaryDocument).gameContext.wandererPrimary ??= {};
  delete context.finalizedHitStates;
  if (mode === "fresh-equipment") {
    context.pyroAttackIncludedPercent = 0; context.cryoCritRateIncludedPercent = 0; context.burstC2IncludedPercent = 0;
  } else {
    for (const key of ["absorptionBonuses", "baseAttack", "pyroAttackIncludedPercent", "cryoCritRateIncludedPercent", "c6ParentQualified", "burstWindfavoredAtCast", "burstC2ConsumedPointsUpTo50", "burstC2IncludedPercent", "burstAllHitsConnected", "burstConditionsStable"] as const) delete context[key];
  }
}
export function finalizeWandererPrimaryPanelAccounting(document: CalculatorDocument): void {
  if (!isWandererPrimaryAction(document)) return;
  const context = (document as WandererPrimaryDocument).gameContext.wandererPrimary ??= {};
  context.finalizedHitStates = Object.fromEntries(document.hits.map(hit => [hit.id, stateIdentity(document, hit, context)]));
}
