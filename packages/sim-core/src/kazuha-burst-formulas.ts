import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { kazuhaBurstContextSchema, type KazuhaAbsorbedElement, type KazuhaBurstContext } from "./kazuha-burst-context";
import {
  KAZUHA_BURST_ABSORPTION_CHECK_FRAMES, KAZUHA_BURST_SOURCE_REFS, KAZUHA_BURST_SOURCE_VALUES, KAZUHA_BURST_TICK_FRAMES,
} from "./kazuha-burst-source-values";

export { KAZUHA_BURST_SOURCE_REFS } from "./kazuha-burst-source-values";
export type KazuhaCalculatorDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument["gameContext"]> & { kazuhaBurst?: KazuhaBurstContext };
};
type OrdinaryHit = Extract<CalculatorHit, {kind: "ordinary"}>;
export interface KazuhaBurstHitEvent {
  id: string;
  frame: number;
  snapshotFrame: 81 | 82;
  role: "slash" | "anemo-dot" | "absorbed-dot";
  element: "anemo" | KazuhaAbsorbedElement;
  tick?: number;
}
const prefix = "kazuha-burst:";
const dynamicId = /^kazuha-burst-complete-absorb-(?:pyro|hydro|electro|cryo)-[1-5]$/;
const names = {anemo: "风", pyro: "火", hydro: "水", electro: "雷", cryo: "冰"};

export function kazuhaBurstContext(document: CalculatorDocument): KazuhaBurstContext | undefined {
  return (document as KazuhaCalculatorDocument).gameContext?.kazuhaBurst;
}
export function isKazuhaBurstAction(document: CalculatorDocument): boolean {
  const game = document.gameContext;
  return document.dataIdentity.releaseStatus !== "preview" && game?.characterId === "character:10000047"
    && /^kazuha-burst-(?:slash|anemo-dot|complete)$/.test(game.skillId);
}
export function kazuhaBurstCoefficient(role: KazuhaBurstHitEvent["role"], talentLevel: number): number | undefined {
  if (!Number.isInteger(talentLevel) || talentLevel < 1 || talentLevel > 15) return undefined;
  return (role === "slash" ? KAZUHA_BURST_SOURCE_VALUES.slash
    : role === "anemo-dot" ? KAZUHA_BURST_SOURCE_VALUES.anemoDot : KAZUHA_BURST_SOURCE_VALUES.absorbedDot)[talentLevel - 1];
}

/** Source order is initial slash, then absorbed DoT before Anemo at each tick.
 * Unknown absorption never creates an assumed elemental damage instance. */
export function kazuhaBurstHitPlan(skillId: string, context: KazuhaBurstContext = {}): KazuhaBurstHitEvent[] {
  if (skillId === "kazuha-burst-slash") return [{id: "kazuha-burst-slash-hit", frame: 82, snapshotFrame: 82, role: "slash", element: "anemo"}];
  if (skillId === "kazuha-burst-anemo-dot") return [{id: "kazuha-burst-anemo-dot-hit", frame: 140, snapshotFrame: 81, role: "anemo-dot", element: "anemo", tick: 1}];
  if (skillId !== "kazuha-burst-complete") return [];
  const plan: KazuhaBurstHitEvent[] = [{id: "kazuha-burst-complete-slash", frame: 82, snapshotFrame: 82, role: "slash", element: "anemo"}];
  const element = context.absorptionElement;
  const start = context.absorptionStartFrame;
  for (const [index, frame] of KAZUHA_BURST_TICK_FRAMES.entries()) {
    if (element && element !== "none" && start !== undefined && KAZUHA_BURST_ABSORPTION_CHECK_FRAMES.includes(start) && frame >= start) {
      plan.push({id: `kazuha-burst-complete-absorb-${element}-${index + 1}`, frame, snapshotFrame: 81, role: "absorbed-dot", element, tick: index + 1});
    }
    plan.push({id: `kazuha-burst-complete-anemo-${index + 1}`, frame, snapshotFrame: 81, role: "anemo-dot", element: "anemo", tick: index + 1});
  }
  return plan;
}

export function createKazuhaA4DamageBonusFormula(nonExtraEm: number, priorA4Active: boolean, included: number): CalculatorFormula {
  return {
    ruleId: "kazuha-burst-prior-swirl-a4-b4ae769", label: "81f前同元素扩散A4：前序NonExtraEM×0.04%－已含份额",
    expression: expr.sub(expr.mul(expr.input("kazuhaPriorA4Active"), expr.input("kazuhaPriorSwirlNonExtraEm"), expr.value(.0004)), expr.input("kazuhaIncludedA4DamageBonus")),
    inputs: [
      {key: "kazuhaPriorA4Active", value: Number(priorA4Active), unit: "boolean", meaningKey: "同元素前序扩散A4在81f仍生效", origin: "explicit-prior-swirl-state", allowedValues: [0, 1]},
      {key: "kazuhaPriorSwirlNonExtraEm", value: nonExtraEm, unit: "em", meaningKey: "实际前序扩散的NonExtraStat(EM)，不读取本Q当前EM", origin: "explicit-prior-swirl-snapshot", minimum: 0},
      {key: "kazuhaIncludedA4DamageBonus", value: included, unit: "ratio", meaningKey: "所填同元素增伤中已含的A4份额", origin: "explicit-accounting", minimum: 0},
    ], requirements: {maximumConstellation: 1}, sourceRefs: KAZUHA_BURST_SOURCE_REFS,
  };
}

function ascensionOf(document: CalculatorDocument): number | undefined {
  return (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
}
function hitLabel(event: KazuhaBurstHitEvent): string {
  if (event.role === "slash") return "初斩·82f风伤";
  return `${event.role === "absorbed-dot" ? `${names[event.element]}元素转化附加` : "风DoT"}第${event.tick}次·${event.frame}f（81f快照）`;
}
function makeAbsorbedHit(event: KazuhaBurstHitEvent, talentLevel: number, context: KazuhaBurstContext, snapshotTemplate?: OrdinaryHit): OrdinaryHit {
  return {
    id: event.id, label: hitLabel(event), kind: "ordinary", element: event.element, attackTag: "burst",
    terms: [{stat: "atk", coefficient: kazuhaBurstCoefficient(event.role, talentLevel) ?? 0}],
    // Missing input is blocked below; zero is only the structural placeholder.
    damageBonus: context.elementDamageBonuses?.[event.element as KazuhaAbsorbedElement] ?? 0,
    additiveBaseDamage: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1,
    ...(snapshotTemplate?.elementalMasteryAdjustment ? {elementalMasteryAdjustment: structuredClone(snapshotTemplate.elementalMasteryAdjustment)} : {}),
    ...(snapshotTemplate?.attackAdjustment ? {attackAdjustment: structuredClone(snapshotTemplate.attackAdjustment)} : {}),
    ...(snapshotTemplate?.incomingThrillingTalesFormula ? {incomingThrillingTalesFormula: structuredClone(snapshotTemplate.incomingThrillingTalesFormula)} : {}),
    sourceRefs: [...new Set([...KAZUHA_BURST_SOURCE_REFS, ...(snapshotTemplate?.sourceRefs ?? [])])],
    dependencies: snapshotTemplate?.dependencies.filter(id => !id.startsWith(prefix)) ?? [],
  };
}
function finalizedState(document: CalculatorDocument, event: KazuhaBurstHitEvent, context: KazuhaBurstContext): string {
  const game = document.gameContext!;
  return JSON.stringify([game.characterId, game.abilityId, game.skillId, game.effectiveTalentLevel, game.constellation, ascensionOf(document),
    event.id, event.frame, event.snapshotFrame, event.role, event.element,
    ...(game.skillId === "kazuha-burst-complete" ? [context.absorptionElement, context.absorptionStartFrame] : []),
    ...(event.role === "absorbed-dot" ? [context.absorptionElement, context.absorptionStartFrame, context.priorA4Active,
      context.priorSwirlNonExtraEm, context.includedA4DamageBonus, context.elementDamageBonuses?.[event.element as KazuhaAbsorbedElement]] : []),
  ]);
}

/** Rebuild coefficients, actual elemental instances and A4 on each calculation. */
export function prepareKazuhaBurstDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isKazuhaBurstAction(document)) return document;
  const result = structuredClone(document) as KazuhaCalculatorDocument, game = result.gameContext;
  const context = kazuhaBurstContextSchema.parse(game.kazuhaBurst ?? {});
  game.kazuhaBurst = context;
  const plan = kazuhaBurstHitPlan(game.skillId, context), basePlan = plan.filter(event => event.role !== "absorbed-dot");
  const full = game.skillId === "kazuha-burst-complete";
  const originalIds = new Set(result.hits.map(hit => hit.id));
  const selectedAll = result.hits.every(hit => result.selectedHitIds.includes(hit.id));
  const claimsComplete = full && result.scope === "one-cast" && selectedAll;
  const known = new Map(result.hits.map(hit => [hit.id, hit]));
  const snapshotTemplate = result.hits.find((hit): hit is OrdinaryHit => hit.kind === "ordinary" && hit.id === "kazuha-burst-complete-anemo-1");
  const planIds = new Set(plan.map(event => event.id));
  const extra = result.hits.filter(hit => !planIds.has(hit.id) && !dynamicId.test(hit.id));
  const malformed = extra.length > 0 || basePlan.some(event => !originalIds.has(event.id))
    || basePlan.some(event => known.get(event.id)?.kind !== "ordinary")
    || (!full && result.hits.length !== 1);
  // Preserve unexpected hits so malformed input remains visible and blocked.
  result.hits = [...plan.map(event => known.get(event.id) ?? makeAbsorbedHit(event, game.effectiveTalentLevel, context, snapshotTemplate)), ...extra];
  // A removed independently-selected elemental hit remains a blocked receipt.
  // Repeated prepare calls cannot silently replace it with the initial slash.
  if (!claimsComplete) for (const id of result.selectedHitIds) if (!result.hits.some(hit => hit.id === id)) {
    result.hits.push({id, label: known.get(id)?.label ?? "旧元素转化命中", kind: "blocked",
      reasons: ["所选旧染色命中不属于当前分支；请重新选择实际命中。"], sourceRefs: KAZUHA_BURST_SOURCE_REFS, dependencies: []});
  }
  if (claimsComplete) result.selectedHitIds = result.hits.map(hit => hit.id);
  const selectedEvents = plan.filter(event => result.selectedHitIds.includes(event.id));
  const needsStable = selectedEvents.some(event => event.snapshotFrame === 81) && selectedEvents.some(event => event.snapshotFrame === 82);
  const commonIssues: string[] = [];
  if (game.abilityId !== "talent:kaedeharakazuha:combat3") commonIssues.push("Q命中必须使用万叶独立有效Q天赋，不借用普攻或E等级。");
  if (game.constellation > 1) commonIssues.push("万叶Q直接伤害目前仅审阅C0/C1；C2及更高命座需要独立快照与命座实现。");
  if (malformed) commonIssues.push("命中集合与固定来源Q动作不符；缺失、外加或替换的命中不能当作完整Q。");
  if (claimsComplete && context.absorptionElement === undefined) commonIssues.push("完整Q需要明确无元素转化，或实际转化元素与首次吸收时点。");
  if (claimsComplete && context.absorptionElement !== undefined && context.absorptionElement !== "none" && context.absorptionStartFrame === undefined) commonIssues.push("请明确首次成功元素转化检查帧；不能默认五次染色附加。");
  if (claimsComplete && context.absorptionElement === "none" && context.absorptionStartFrame !== undefined) commonIssues.push("无元素转化与已填首次吸收时点冲突；请清除吸收时点。");
  if (claimsComplete && context.allHitsConnected !== true) commonIssues.push("完整Q须确认初斩、五次风DoT及已生成的染色附加均实际命中，期间领域未被替换。");
  if (needsStable && context.statsStableAcrossSnapshots !== true) commonIssues.push("共用面板须确认81f快照与82f初斩的面板/装备，以及所算各击目标状态稳定；否则请单选实际命中。");
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  context.hitEvents = Object.fromEntries(plan.map(event => [event.id, {frame: event.frame, snapshotFrame: event.snapshotFrame, role: event.role, element: event.element, ownerId: "character:10000047" as const}]));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    const issues = [...commonIssues], event = plan.find(row => row.id === hit.id);
    if (hit.kind === "ordinary" && event) {
      if (hit.damageBonusFormula?.ruleId.startsWith("kazuha-burst-")) delete hit.damageBonusFormula;
      hit.label = hitLabel(event); hit.attackTag = "burst"; hit.element = event.element;
      const coefficient = kazuhaBurstCoefficient(event.role, game.effectiveTalentLevel);
      if (coefficient === undefined) issues.push("缺少固定来源有效Q天赋倍率；有效等级应为1–15，不自动再加命座天赋等级。");
      else hit.terms = [{stat: "atk", coefficient}];
      if (event.role === "absorbed-dot") {
        const ascension = ascensionOf(result), element = event.element as KazuhaAbsorbedElement;
        if (ascension === undefined) issues.push("请提供突破阶段以确定是否解锁风物之诗咏。");
        const bonus = context.elementDamageBonuses?.[element];
        if (result.build.mode !== "equipment-derived") {
          if (bonus === undefined && !hit.finalSnapshot) issues.push(`缺少${names[element]}元素最终伤害加成；公开展柜未知值不能以0或风伤加成替代。`);
          else if (bonus !== undefined && !hit.finalSnapshot) hit.damageBonus = bonus;
        } else if (!hit.finalSnapshot) hit.damageBonus = 0; // Equipment resolver applies the actual element filters.
        if (ascension === undefined || ascension >= 4) {
          if (context.priorA4Active === undefined) issues.push("请明确81f前是否已有同元素前序扩散A4且在81f仍生效；本Q初斩后的新扩散不计入。");
          if (context.priorA4Active === true && context.priorSwirlNonExtraEm === undefined) issues.push("请提供该次实际前序扩散的非额外精通；不能借用当前面板精通。");
          if (context.includedA4DamageBonus === undefined) issues.push("请明确该元素增伤输入已含的A4份额；未含填0。");
        } else if (context.priorA4Active === true || (context.includedA4DamageBonus ?? 0) !== 0) issues.push("突破4前未解锁A4，不能使用前序扩散增伤或已含A4份额。");
        if (!issues.length) hit.damageBonusFormula = createKazuhaA4DamageBonusFormula(
          context.priorSwirlNonExtraEm ?? 0, ascension! >= 4 && context.priorA4Active === true, context.includedA4DamageBonus ?? 0);
      }
      const saved = context.finalizedHitStates?.[hit.id];
      if (hit.finalSnapshot && (hit.finalSnapshot.origin !== "equipment-conversion" || saved !== finalizedState(result, event, context))) {
        issues.push("历史快照的万叶Q状态与当前分支不一致；请重新应用来源配装或使用本击实际面板，不能改写81f历史。");
        delete hit.damageBonusFormula;
      }
      hit.sourceRefs = [...new Set([...hit.sourceRefs, ...KAZUHA_BURST_SOURCE_REFS])];
    } else issues.push(hit.kind === "blocked" && dynamicId.test(hit.id)
      ? "所选旧染色命中不属于当前分支；请重新选择实际命中。" : "此命中不属于万叶Q固定来源的直接伤害集合。");
    const id = `${prefix}${hit.id}`;
    hit.dependencies.push(id);
    result.dependencies.push({id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "固定来源本次Q直接命中：真实元素与时点、81f/82f快照及前序A4份额已明确。", sourceRefs: KAZUHA_BURST_SOURCE_REFS});
  }
  game.scopeCoverage = full ? "complete-cast" : "single-hit";
  game.attributionPolicy = "仅本次万叶Q直接伤害：初斩82f，风DoT和染色附加81f锁定，tick为140/257/374/491/608f；染色附加先于同帧风DoT，晚转化只生成其后的附加段。不含扩散等反应实体。";
  result.assumptions = result.assumptions.filter(value => !value.startsWith("万叶Q："));
  result.assumptions.push("万叶Q：单风DoT使用81f实际面板，初斩使用82f面板；完整直接伤害采用明确全命中和稳定条件。元素转化时点为固定源相对施放帧；未推算附着、命中判定或反应实体。");
  return result;
}

export function resetKazuhaBurstPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isKazuhaBurstAction(document)) return;
  const context = (document as KazuhaCalculatorDocument).gameContext.kazuhaBurst ??= {};
  delete context.finalizedHitStates;
  if (mode === "fresh-equipment") { context.includedA4DamageBonus = 0; delete context.elementDamageBonuses; }
  else { delete context.includedA4DamageBonus; delete context.elementDamageBonuses; }
}

/** Call after imported-final reset, with raw real bonuses including nulls. */
export function captureKazuhaImportedDamageBonuses(document: CalculatorDocument, bonuses: Partial<Record<KazuhaAbsorbedElement, number | null | undefined>>): void {
  if (!isKazuhaBurstAction(document)) return;
  const context = (document as KazuhaCalculatorDocument).gameContext.kazuhaBurst ??= {};
  context.elementDamageBonuses = {};
  for (const element of ["pyro", "hydro", "electro", "cryo"] as const) {
    const value = bonuses[element];
    if (typeof value === "number" && Number.isFinite(value)) context.elementDamageBonuses[element] = value;
  }
}

/** Called by actual conversion, never by imported-final capture. */
export function finalizeKazuhaBurstPanelAccounting(document: CalculatorDocument): void {
  if (!isKazuhaBurstAction(document)) return;
  const context = kazuhaBurstContext(document);
  if (!context) return;
  const plan = kazuhaBurstHitPlan(document.gameContext!.skillId, context);
  context.finalizedHitStates = Object.fromEntries(document.hits.flatMap(hit => {
    const event = plan.find(row => row.id === hit.id);
    return hit.kind === "ordinary" && hit.finalSnapshot && event ? [[hit.id, finalizedState(document, event, context)]] : [];
  }));
}
