import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { xiaoDamageContextSchema, type XiaoDamageContext } from "./xiao-damage-context";
import { XIAO_SOURCE_VALUES } from "./xiao-source-values";

const root = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/xiao/";
export const XIAO_DAMAGE_SOURCE_REFS = ["xiao.go", "burst.go", "asc.go", "cons.go", "skill.go", "attack.go", "charge.go", "plunge.go", "zz_xiao.dm.go"].map(file => root + file);
const prefix = "xiao-damage:";
export type XiaoCalculatorDocument = CalculatorDocument & { gameContext: NonNullable<CalculatorDocument["gameContext"]> & {xiaoDamage?: XiaoDamageContext} };
export function xiaoContext(document: CalculatorDocument): XiaoDamageContext | undefined {
  return (document as XiaoCalculatorDocument).gameContext?.xiaoDamage;
}
export function isXiaoDamageAction(document: CalculatorDocument): boolean {
  const game = document.gameContext;
  return document.dataIdentity.releaseStatus !== "preview" && game?.characterId === "character:10000026" && /^xiao-(?:skill$|normal-[1-6]-base-c0$|charged-base-c0$|(?:low|high)-plunge-no-collision-conditioned-c0$|plunge-collision$|q-(?:normal-[1-6]|charged|low-plunge|high-plunge|plunge-collision)$)/.test(game.skillId);
}
export function xiaoHitCoefficient(skillId: string, hitIndex: number, effectiveTalentLevel: number): number | undefined {
  const level = effectiveTalentLevel - 1;
  const normal = /^xiao-(?:q-)?normal-(\d)/.exec(skillId);
  if (normal) return XIAO_SOURCE_VALUES.attack[Number(normal[1]) - 1]?.[hitIndex]?.[level];
  const vector = skillId === "xiao-skill" ? XIAO_SOURCE_VALUES.skill
    : skillId.includes("plunge-collision") ? XIAO_SOURCE_VALUES.plunge
      : skillId.includes("low-plunge") ? XIAO_SOURCE_VALUES.lowPlunge
        : skillId.includes("high-plunge") ? XIAO_SOURCE_VALUES.highPlunge
          : skillId.includes("charged") ? XIAO_SOURCE_VALUES.charge : undefined;
  return vector?.[level];
}
const sourceInput = (key: string, value: number, unit = "ratio", origin = "pinned-source") => ({key, value, unit, origin, meaningKey: key});
export function createXiaoDamageBonusFormula(input: {burst: boolean; ascension: number; elapsedSeconds: number; burstBonus: number; skillStacks: number; included: number}): CalculatorFormula {
  return {
    ruleId: "xiao-damage-q-a1-a4-accounting-b4ae769", label: "魈：Q增伤＋随时间增长的降魔平妖＋E连用层数－输入已含份额",
    expression: expr.sub(expr.add(
      expr.input("xiaoBurstBonus"),
      expr.mul(expr.input("xiaoA1Active"), expr.value(.05), expr.min(expr.add(expr.value(1), expr.trunc(expr.div(expr.input("xiaoQElapsedSeconds"), expr.value(3)))), expr.value(5))),
      expr.mul(expr.input("xiaoSkillStacks"), expr.value(.15)),
    ), expr.input("xiaoIncludedDamageBonus")),
    inputs: [sourceInput("xiaoBurstBonus", input.burstBonus), sourceInput("xiaoA1Active", Number(input.burst && input.ascension >= 1), "boolean"),
      sourceInput("xiaoQElapsedSeconds", input.elapsedSeconds, "seconds", "explicit-hit-state"), sourceInput("xiaoSkillStacks", input.skillStacks, "count", "explicit-hit-state"),
      sourceInput("xiaoIncludedDamageBonus", input.included, "ratio", "explicit-accounting")],
    requirements: {maximumConstellation: 6}, sourceRefs: XIAO_DAMAGE_SOURCE_REFS,
  };
}

/** Source coefficients and state accounting are rebuilt on every calculation. */
export function prepareXiaoDamageDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isXiaoDamageAction(document)) return document;
  const result = structuredClone(document) as XiaoCalculatorDocument, game = result.gameContext;
  const context = xiaoDamageContextSchema.parse(game.xiaoDamage ?? {});
  game.xiaoDamage = context;
  const ascension = (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  result.dependencies = result.dependencies.filter(dep => !dep.id.startsWith(prefix));
  const selected = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  const normal = /^xiao-(?:q-)?normal-(\d)/.exec(game.skillId);
  const expectedCount = normal ? XIAO_SOURCE_VALUES.attack[Number(normal[1]) - 1]!.length : 1;
  const sourceTag = game.skillId === "xiao-skill" ? "skill" : game.skillId.includes("plunge") ? "plunge" : game.skillId.includes("charged") ? "charged" : "normal";
  for (const [index, hit] of result.hits.entries()) {
    if (hit.kind !== "ordinary") continue;
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    if (hit.damageBonusFormula?.ruleId.startsWith("xiao-damage-")) delete hit.damageBonusFormula;
    const issues: string[] = [];
    hit.attackTag = sourceTag;
    if (result.hits.length !== expectedCount) issues.push("命中集合不属于此来源动作；不能追加E或把C6后续E合并成这一击。");
    const coefficient = xiaoHitCoefficient(game.skillId, index, game.effectiveTalentLevel);
    if (coefficient === undefined) issues.push("本击缺少固定来源的有效天赋倍率；等级应为1–15，不再次增加命座天赋等级。");
    else hit.terms = [{stat: "atk", coefficient}];
    if (ascension === undefined) issues.push("请提供魈的突破阶段，以确定两项固有天赋。");
    if (context.burstActive === undefined) issues.push("请明确本击时靖妖傩舞是否仍在生效。");
    if (game.skillId.startsWith("xiao-q-") && context.burstActive === false) issues.push("此动作是Q状态下的一击；Q未生效时请选择普通动作。");
    if (context.burstActive && context.burstElapsedSeconds === undefined && (ascension === undefined || ascension >= 1)) issues.push("请填写本击距离按下Q已过多少秒，以计算降魔平妖增伤。");
    const boostedTag = hit.attackTag === "normal" || hit.attackTag === "charged" || hit.attackTag === "plunge";
    const qBonus = context.burstActive && boostedTag && context.burstTalentLevel !== undefined ? XIAO_SOURCE_VALUES.burstBonus[context.burstTalentLevel - 1] : 0;
    if (context.burstActive && boostedTag && context.burstTalentLevel === undefined) issues.push("请提供独立的有效Q天赋等级；不能借用普攻等级。");
    if (hit.attackTag === "skill" && (ascension === undefined || ascension >= 4) && context.skillA4Stacks === undefined) issues.push("请填写本击E之前仍有效的连用层数（0–3）；本次E不会立即给自己加一层。");
    if (ascension !== undefined && ascension < 4 && context.skillA4Stacks) issues.push("突破4之前尚未解锁E连用增伤，不能使用这些层数。");
    if (context.includedDamageBonus === undefined) issues.push("请明确本击增伤输入已包含多少魈自身Q/天赋增伤；未含请填0。");
    if (selected.length > 1 && context.burstActive) issues.push("Q状态按实际单击取样；请单选一击，不把共同时间当作整轮或两击的实际时刻。");
    hit.element = context.burstActive && boostedTag ? "anemo" : hit.attackTag === "skill" ? "anemo" : "physical";
    const savedState = context.finalizedHitStates?.[hit.id];
    if ((savedState !== undefined && savedState !== finalizedState(result, hit, context)) || (hit.finalSnapshot && (hit.finalSnapshot.origin !== "equipment-conversion" || savedState === undefined))) issues.push("历史快照的魈状态与当前输入不一致；请重新应用来源配装或使用该击实际面板，不能借用当前状态改写历史。");
    if (!issues.length) hit.damageBonusFormula = createXiaoDamageBonusFormula({
      burst: context.burstActive!, ascension: ascension!, elapsedSeconds: context.burstElapsedSeconds ?? 0, burstBonus: qBonus ?? 0,
      skillStacks: hit.attackTag === "skill" && ascension! >= 4 ? context.skillA4Stacks! : 0, included: context.includedDamageBonus!,
    });
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...XIAO_DAMAGE_SOURCE_REFS])];
    const id = `${prefix}${hit.id}`;
    hit.dependencies.push(id);
    result.dependencies.push({id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击Q/天赋状态、时间与已含份额明确，仅按固定来源计算这一实际命中。", sourceRefs: XIAO_DAMAGE_SOURCE_REFS});
  }
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : context.burstActive ? "selected-components" : game.scopeCoverage;
  game.attributionPolicy = "魈实际选定的一击：Q仅使普攻/重击/下落风附魔并增伤，A1按自施放Q起的实际时间，E按本击前有效A4层数；落地不含碰撞，碰撞不含落地。C1/C2/C4/C6不改该击倍率，C3/C5由独立有效天赋处理；不推算整轮、E充能或C6后续E次数。";
  result.assumptions = result.assumptions.filter(value => !value.startsWith("魈单击：") && !value.startsWith("C0；") && !value.startsWith("C0 条件；"));
  result.assumptions.push("魈单击：按当前所填实际Q状态和命中时刻；Q开启本身无直接伤害。固定源Q时长/HP扣除、A4刷新时机仍有来源近似，此处不推演生命周期或额外触发。");
  return result;
}

export function resetXiaoPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isXiaoDamageAction(document)) return;
  const game = (document as XiaoCalculatorDocument).gameContext;
  const context = game.xiaoDamage ??= {};
  delete context.finalizedHitStates;
  if (mode === "fresh-equipment") context.includedDamageBonus = 0;
  else delete context.includedDamageBonus;
}

function finalizedState(document: CalculatorDocument, hit: CalculatorHit, context: XiaoDamageContext): string {
  const ascension = (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
  return JSON.stringify([document.gameContext?.skillId, document.gameContext?.effectiveTalentLevel, document.gameContext?.constellation, ascension, hit.id,
    context.burstActive, context.burstTalentLevel, context.burstElapsedSeconds, context.skillA4Stacks, context.includedDamageBonus]);
}

/** Generic conversion retains the executable own-bonus tree, not its value. */
export function finalizeXiaoPanelAccounting(document: CalculatorDocument): void {
  if (!isXiaoDamageAction(document)) return;
  const context = xiaoContext(document);
  if (context) context.finalizedHitStates = Object.fromEntries(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, finalizedState(document, hit, context)]));
}
