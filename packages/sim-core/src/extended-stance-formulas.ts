import definitions from "../../game-data/sources/extended-stance-casts/definitions.json";
import type { ExtendedStanceTemplate } from "../../game-data/src/character-mappings/extended-stance-mappings";
import { extendedStanceCastContextSchema, type ExtendedStanceCastContext, type CalculatorDocument, type CalculatorFormula, type CalculatorHit } from "./calculator-model";
import { compileExtendedStanceSchedule, type ExtendedStanceCastKind, type ExtendedStanceHitInstance } from "./extended-stance-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as ExtendedStanceTemplate[];
const prefix = "extended-stance:", sourceId = `${prefix}source`;
const templateOf = (doc: CalculatorDocument) => templates.find(row => row.skillId === doc.gameContext?.skillId);
export const isExtendedStanceCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const roleOf = (cast: ExtendedStanceTemplate, hit: OrdinaryHit) => hit.extendedStanceEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];
const ascensionOf = (doc: CalculatorDocument, hit?: OrdinaryHit) => hit?.finalSnapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
const stateOf = (ctx: ExtendedStanceCastContext, hit: OrdinaryHit) => ({ ...ctx.sharedState, ...ctx.hitStates?.[hit.id] });
const identity = (doc: CalculatorDocument, ctx: ExtendedStanceCastContext, hit: OrdinaryHit) => JSON.stringify({
  event: hit.extendedStanceEvent ?? `independent-single:${hit.id}`,
  snapshot: hit.extendedStanceEvent ? ctx.snapshots?.[hit.extendedStanceEvent.snapshotId] ?? null : hit.finalSnapshot ?? null,
  state: stateOf(ctx, hit), talent: doc.gameContext?.effectiveTalentLevel, ascension: ascensionOf(doc, hit),
  constellation: doc.gameContext?.constellation, statsStableAcrossHits: ctx.statsStableAcrossHits,
  pruneHexerei: ctx.prune?.hexerei,
});

function canonicalHit(doc: CalculatorDocument, cast: ExtendedStanceTemplate, roleKey: string, ctx: ExtendedStanceCastContext,
  previous?: OrdinaryHit, event?: ExtendedStanceHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey]!, id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const state = { ...ctx.sharedState, ...ctx.hitStates?.[id] };
  // Varka's source indexes even its combat1 charge vector with TalentLvlSkill.
  const level = doc.gameContext!.effectiveTalentLevel;
  const multiplier = cast.sourceSlug === "varka" && roleKey !== "initial" ? event?.coefficientMultiplier ?? state.varkaA1Multiplier ?? 1 : 1;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary",
    label: `${role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    element: role.dynamicElement ? event?.element ?? state.convertedElement ?? role.element : role.element, attackTag: role.attackTag,
    terms: role.terms.map(term => ({ stat: term.stat, coefficient: (term.values[level - 1] ?? term.values[0]!) * multiplier })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    dependencies: [sourceId], sourceRefs: role.sourceRefs,
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment; delete hit.coordinatedEvent; delete hit.heldLifecycleEvent;
  delete hit.idleStanceEvent; delete hit.observedEntityEvent; delete hit.occurrence;
  if (event) {
    const { id: candidateId, ...metadata } = event;
    hit.extendedStanceEvent = { candidateId, ...metadata };
    const snapshot = ctx.snapshots?.[event.snapshotId];
    const convertedCurrent = previous?.finalSnapshot?.origin === "equipment-conversion" && ctx.finalizedHitEvents?.[id] === identity(doc, ctx, hit);
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
    else if (!convertedCurrent) delete hit.finalSnapshot;
    if (!previous?.extendedStanceEvent || JSON.stringify(previous.extendedStanceEvent) !== JSON.stringify(hit.extendedStanceEvent)
      || snapshot && JSON.stringify(snapshot) !== JSON.stringify(previous.finalSnapshot)) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  }
  return hit;
}
const account = (rule: string, label: string, actual: number, included: number, refs: string[], unit: string): CalculatorFormula => ({
  ruleId: `extended-stance-${rule}`, label, expression: expr.sub(expr.input("extendedActual"), expr.input("extendedIncluded")),
  inputs: [
    { key: "extendedActual", value: actual, unit, minimum: 0, meaningKey: "此击来源实际生效的角色自身份额", origin: "explicit-source-character-state" },
    { key: "extendedIncluded", value: included, unit, minimum: 0, meaningKey: "本击输入已包含的同一角色自身份额", origin: "explicit-panel-accounting" },
  ], sourceRefs: refs, requirements: { maximumConstellation: 0 },
});

function passiveIssues(doc: CalculatorDocument, cast: ExtendedStanceTemplate, roleKey: string, ctx: ExtendedStanceCastContext, hit: OrdinaryHit): string[] {
  const issues: string[] = [], state = stateOf(ctx, hit), role = cast.roles[roleKey]!, ascension = ascensionOf(doc, hit), event = hit.extendedStanceEvent;
  if (!role.dynamicElement && event?.element !== undefined && event.element !== role.element) issues.push("保存的来源事件元素与固定倍率角色冲突；不能通过编辑事件把本击改成其他元素。");
  if (role.dynamicElement && hit.element === "anemo") issues.push("转换元素剑击不能指定风元素；风元素是本动作另一个独立伤害角色。");
  if (role.dynamicElement && event?.element === undefined && state.convertedElement === undefined) issues.push("本次已发生命中缺少实际转换元素；单击无需未来日程，但不能默认物理或风元素。");
  if (cast.sourceSlug === "prune") {
    if (ctx.prune?.hexerei !== false) issues.push("本分支需要明确未启用魔女课题联动；不能省略已发生的队友反应攻击增益。");
    if (roleKey === "converted" && hit.element === "physical") issues.push("此角色二段必须为实际首次扩散取得的火／水／雷／冰元素，不能使用物理。");
  }
  if (cast.sourceSlug === "dahlia" && doc.scope !== "single-hit" || cast.sourceSlug === "varka") {
    if (ascension === undefined || ascension < 4) issues.push("本固定来源分支要求实际突破4或以上：来源存在未初始化攻速／缺少A4门槛的已知缺口，未将其静默修复。");
  }
  if (cast.sourceSlug === "ifa") {
    if (ascension === undefined) issues.push("缺少本击实际突破阶段，不能判断伊法A4精通是否解锁。");
    if (ascension !== undefined && ascension >= 4) {
      if (state.ifaA4Active === undefined) issues.push("请明确本击取样时伊法A4是否实际有效；不能因未列出全局夜魂迸发而默认未触发。");
      if (state.includedElementalMastery === undefined) issues.push("请明确本击面板已含的伊法A4元素精通数值；0才表示明确未含。");
      if (hit.finalSnapshot && state.ifaA4Active !== undefined && state.includedElementalMastery !== (state.ifaA4Active ? 80 : 0)) issues.push("完整进攻快照直接使用已保存精通；必须明确已含本击实际A4的80或0精通，不能用共同面板调整补写历史快照。");
      if (state.ifaA4Active !== undefined && state.includedElementalMastery !== undefined) hit.elementalMasteryAdjustment = {
        formula: account("ifa-a4-a7dc4bf", "伊法A4：实际80或0精通减去面板已含份额", state.ifaA4Active ? 80 : 0, state.includedElementalMastery, role.sourceRefs, "stat"), accounting: "add-to-panel",
      };
    }
  }
  if (cast.sourceSlug === "varka") {
    const active = roleKey !== "initial", stacks = active ? event?.varkaA4Stacks ?? state.varkaA4Stacks : 0;
    if (state.varkaA1NonExtraAtkAtLastRefresh === undefined) issues.push("缺少本击取样前最近一次60帧A1刷新所用非额外攻击；不可用不同取样时点的当前ATK代替。");
    if (state.includedDamageBonus === undefined) issues.push("缺少本击增伤输入已含的法尔伽A1＋A4份额；0才表示明确未含。");
    if (active && event?.coefficientMultiplier === undefined && state.varkaA1Multiplier === undefined) issues.push("独立姿态命中需要实际队伍决定的A1基础倍率1／1.4／2.2，不能与A1攻击转增伤互代。");
    if (stacks === undefined) issues.push("独立已发生命中需要本击实际A4层数0至4；不要求未来扩散历史，也不能默认0层。");
    if (state.varkaA1NonExtraAtkAtLastRefresh !== undefined && state.includedDamageBonus !== undefined && stacks !== undefined) {
      hit.damageBonusFormula = {
        ruleId: "extended-stance-varka-a1-a4-b4ae769", label: "法尔伽：min(最近A1刷新非额外ATK×0.0001,0.25)＋适用命中0.075×A4层数－输入已含份额",
        expression: expr.sub(expr.add(expr.min(expr.mul(expr.input("varkaA1ATK"), expr.value(.0001)), expr.value(.25)), expr.mul(expr.value(.075), expr.input("varkaA4Stacks"))), expr.input("varkaIncluded")),
        inputs: [
          { key: "varkaA1ATK", value: state.varkaA1NonExtraAtkAtLastRefresh, minimum: 0, unit: "stat", meaningKey: "本击取样前最近A1刷新实际非额外ATK", origin: "explicit-source-refresh-observation" },
          { key: "varkaA4Stacks", value: stacks, minimum: 0, maximum: 4, integer: true, unit: "count", meaningKey: active ? "本击适用的实际A4层数" : "初始E不符合A4伤害标签，实际份额为0", origin: event ? "compiled-explicit-swirl-history" : "independent-occurred-hit-state" },
          { key: "varkaIncluded", value: state.includedDamageBonus, minimum: 0, unit: "ratio", meaningKey: "本击已含的A1与A4增伤总份额", origin: "explicit-panel-accounting" },
        ], sourceRefs: role.sourceRefs, requirements: { minimumAscension: 4, maximumConstellation: 0 },
      };
    }
  }
  return issues;
}

export function prepareExtendedStanceCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document); if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!, context = extendedStanceCastContextSchema.parse(game.extendedStanceCast ?? {});
  game.extendedStanceCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previousRole = (role: string) => [...old.values()].find(hit => !hit.extendedStanceEvent && roleOf(cast, hit) === role);
  const representatives = () => Object.keys(cast.roles).map(role => canonicalHit(result, cast, role, context, previousRole(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(role => role.sourceRefs))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源完整动作流：显式资格、资源、接触与已排队尾段；来源一致不等于游戏内实测。", sourceRefs: refs });
  const missing = oldHits.filter((hit): hit is Extract<CalculatorHit, { kind: "blocked" }> => hit.kind === "blocked" && selected.has(hit.id)).flatMap(hit => hit.reasons);
  if (game.constellation !== 0) missing.push("此完整分支只支持明确C0，未省略高命座追加攻击或资源变化。");
  if (game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) missing.push("有效天赋等级必须在固定来源1至15级范围。");
  if (result.scope === "single-hit") {
    result.hits = old.size ? [...old.values()].map(hit => {
      const role = roleOf(cast, hit); if (!role || !cast.roles[role]) return hit;
      const saved = hit.extendedStanceEvent; if (!saved) return canonicalHit(result, cast, role, context, hit);
      const { candidateId: id, ...metadata } = saved;
      return canonicalHit(result, cast, role, context, hit, { id, ...metadata });
    }) : representatives();
  } else {
    const schedule = compileExtendedStanceSchedule(cast.skillId as ExtendedStanceCastKind, context, { ascension: ascensionOf(result) });
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonicalHit(result, cast, event.templateRole, context, old.get(`${cast.skillId}:${event.id}`) ?? previousRole(event.templateRole), event)) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "本次完整姿态没有对所选敌人造成伤害", kind: "non-damaging", reason: "全部实际攻击机会已明确接触或落空，没有补造伤害。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, reasons: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击来源、实际状态、取样与已含份额明确。", sourceRefs: refs }); hits.forEach(hit => hit.dependencies.push(id));
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const roleKey = roleOf(cast, hit), event = hit.extendedStanceEvent, reasons: string[] = [];
    if (!roleKey || !cast.roles[roleKey]) { dependency(`${prefix}${hit.id}`, ["命中未对应本次来源的有效倍率角色。"], [hit]); continue; }
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) reasons.push("日程、取样、实际状态或同帧观察已改变，不能沿用旧物化面板、抗性或装备贡献；请重新应用构筑或恢复本击实际面板。");
    if (event && result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) reasons.push(`缺少本击实际进攻快照 ${event.snapshotId}；未确认共同面板稳定，不能沿用其他时点。`);
    if (event && result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot && !context.snapshots?.[event.snapshotId]) reasons.push("本击先前实际快照已删除或失效；不能静默改用当前面板。");
    reasons.push(...passiveIssues(result, cast, roleKey, context, hit)); dependency(`${prefix}${hit.id}`, reasons, [hit]);
  }
  const selectedHits = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  const complete = result.scope === "one-cast" && selectedHits.length === result.hits.length && !selectedHits.some(hit => hit.dependencies.some(id => result.dependencies.find(row => row.id === id)?.status === "missing"));
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : complete ? "complete-cast" : "selected-components";
  game.attributionPolicy = "按本次明确的C0实际动作、状态与尾段，只合计归属本施放的自身直接伤害；独立已发生命中不要求未来排程，反应伤害与队友动作另计。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("扩展姿态协议：")),
    "扩展姿态协议：所有候选分别确认接触；同帧来源事实及进攻快照均参与已转换面板身份，不允许改动后借用旧物化属性。",
    ...cast.assumptions.map(row => `扩展姿态协议：${row}`)];
  return result;
}

export function resetExtendedStancePanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isExtendedStanceCastAction(document)) return;
  const context = document.gameContext!.extendedStanceCast ??= {}; delete context.finalizedHitEvents;
  context.hitStates ??= {};
  // Changing the current build must not erase independent historical-panel accounting.
  for (const hit of document.hits) if (hit.kind === "ordinary" && hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion") context.hitStates[hit.id] = stateOf(context, hit);
  const reset = (state: NonNullable<ExtendedStanceCastContext["sharedState"]>) => {
    if (mode === "fresh-equipment") { state.includedDamageBonus = 0; state.includedElementalMastery = 0; }
    else { delete state.includedDamageBonus; delete state.includedElementalMastery; }
  };
  reset(context.sharedState ??= {});
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    reset(context.hitStates[hit.id] ??= {});
    if (hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
  }
}
export function finalizeExtendedStancePanelAccounting(document: CalculatorDocument): void {
  if (!isExtendedStanceCastAction(document)) return;
  const context = document.gameContext!.extendedStanceCast ??= {};
  context.hitStates ??= {};
  if (document.gameContext?.skillId === "extended-ifa-skill-c0") {
    for (const hit of document.hits) if (hit.kind === "ordinary" && hit.finalSnapshot?.origin === "equipment-conversion") {
      const state = stateOf(context, hit), ascension = ascensionOf(document, hit);
      if (ascension !== undefined && (ascension < 4 || state.ifaA4Active !== undefined)) (context.hitStates[hit.id] ??= {}).includedElementalMastery = ascension >= 4 && state.ifaA4Active ? 80 : 0;
    }
  }
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(document, context, hit)]));
}
export function extendedStanceEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.extendedStanceEvent) return [];
  const event = hit.extendedStanceEvent, trace = new TraceBuilder(hit.sourceRefs);
  for (const [key, value, label, meaning] of [
    ["damageFrame", event.frame, "本击实际命中排程", `${event.candidateId}，所选目标${event.targetId}`],
    ["snapshotFrame", event.snapshotFrame, "本击进攻快照", event.snapshotId],
    ["launchFrame", event.launchFrame, "本击实际发射", event.actionId ?? "实际动作来源"],
  ] as const) if (value !== undefined) trace.add(`extended-stance.${key}`, label, expr.input(key), [traceInput(key, value, "frames", "fixed-source-explicit-action-stream", meaning)], { unit: "frames" });
  if (event.coefficientMultiplier !== undefined) trace.add("extended-stance.varka-a1-multiplier", "法尔伽队伍决定的基础倍率乘区", expr.input("multiplier"), [traceInput("multiplier", event.coefficientMultiplier, "ratio", "source-team-element-counts", "与攻击转增伤分别保存，已作用于本击系数")], { unit: "ratio" });
  if (event.varkaA4Stacks !== undefined) trace.add("extended-stance.varka-a4-stacks", "本击适用的实际扩散A4层数", expr.input("stacks"), [traceInput("stacks", event.varkaA4Stacks, "count", "explicit-ordered-swirl-events", "每触发角色独立冷却，事件顺序与到期判断均来自日程")], { unit: "count" });
  return trace.nodes;
}
