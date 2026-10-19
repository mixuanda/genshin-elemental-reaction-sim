import definitions from "../../game-data/sources/zibai-finite-casts/definitions.json";
import type { ZibaiFiniteTemplate } from "../../game-data/src/character-mappings/zibai-finite-mappings";
import { zibaiFiniteCastContextSchema, type ZibaiFiniteCastContext, type CalculatorDocument, type CalculatorHit, type CalculatorFinalStats } from "./calculator-model";
import { compileZibaiFiniteSchedule, zibaiFiniteEventIssues, type ZibaiFiniteCandidate, type ZibaiFiniteCastKind } from "./zibai-finite-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { ConditionedSpecialCalculation } from "@genshin-dps-lab/reaction-formulas";

type Ordinary = Extract<CalculatorHit, { kind: "ordinary" }>; type Special = Extract<CalculatorHit, { kind: "special" }>; type Hit = Ordinary | Special;
const templates = definitions.templates as ZibaiFiniteTemplate[], constants = definitions.constants;
const prefix = "zibai-finite:", sourceId = `${prefix}source`;
type DocumentContext = Pick<CalculatorDocument, "build" | "gameContext">;
const castOf = (d: DocumentContext) => templates.find(t => t.skillId === d.gameContext?.skillId);
export const isZibaiFiniteCastAction = (d: CalculatorDocument): boolean => castOf(d) !== undefined;
const ascOf = (d: DocumentContext, h?: Hit) => h?.finalSnapshot?.ascension ?? (d.build.mode === "equipment-derived" ? d.build.equipment?.ascension : d.build.ascension) ?? d.gameContext?.ascension;
const stateOf = (c: ZibaiFiniteCastContext, h: Hit) => ({ ...c.sharedState, ...c.hitStates?.[h.id] });
const roleOf = (t: ZibaiFiniteTemplate, h: Hit) => h.zibaiFiniteEvent?.templateRole ?? (Object.entries(t.roles).find(([, role]) => role.mappingId === h.id)?.[0] as "ordinary" | "lunar" | undefined);
function identity(d: CalculatorDocument, c: ZibaiFiniteCastContext, h: Hit): string {
  return JSON.stringify({ event: h.zibaiFiniteEvent ?? h.id, snapshot: h.zibaiFiniteEvent ? c.snapshots?.[h.zibaiFiniteEvent.snapshotId] ?? null : null,
    state: stateOf(c, h), talent: d.gameContext?.effectiveTalentLevel, constellation: d.gameContext?.constellation, ascension: ascOf(d, h) });
}
const inputUnit = (key: string): string => key === "frame" || key === "snapshotFrame" ? "frames" : ["unlocked", "a1Eligible"].includes(key) ? "boolean" : key.endsWith("Teammates") ? "count" : key.includes("Percent") || key.includes("Bonus") || key === "a1DefenseCoefficient" ? "ratio" : key.includes("Additive") ? "damage" : "stat";
const sourceInputs = new Set(["defensePercentPerGeo", "elementalMasteryPerHydro", "intrinsicBonusPer100Defense", "intrinsicBonusCap", "a1DefenseCoefficient"]);
const add = (b: TraceBuilder, id: string, expression: FormulaExpression, values: Record<string, number>, unit = "ratio", note?: string, notApplicable = false): number =>
  b.add(`zibai.${id}`, `stage.zibai.${id}`, expression, Object.entries(values).map(([key, value]) => traceInput(key, value, inputUnit(key), sourceInputs.has(key) ? "fixed-optimizer-source-constant" : "explicit-zibai-source-context", `input.zibai.${key}`)),
    { unit, explanationKey: `explain.zibai.${id}`, ...(notApplicable ? { status: "not-applicable" as const } : {}), ...(note ? { applicabilityReason: note } : {}) });

/** Ratios/deltas are executed here before the ordinary equipment conversion stage. */
export function resolveZibaiFiniteA4(d: DocumentContext, h: CalculatorHit): { defensePercent: number; elementalMastery: number; defensePercentDelta: number; elementalMasteryDelta: number; trace: CalculationTraceNode[]; blockers: string[] } {
  const t = castOf(d), c = d.gameContext?.zibaiFiniteCast, b = new TraceBuilder(h.sourceRefs);
  const empty = { defensePercent: 0, elementalMastery: 0, defensePercentDelta: 0, elementalMasteryDelta: 0, trace: b.nodes, blockers: [] as string[] };
  if (!t || !c || (h.kind !== "ordinary" && h.kind !== "special")) return empty;
  const s = stateOf(c, h), ascension = ascOf(d, h), blockers: string[] = [];
  if (ascension === undefined) return { ...empty, blockers: ["需要本击实际突破阶段，不能猜测兹白A4是否解锁。"] };
  const active = ascension >= 4;
  if (active) {
    if (s.otherGeoTeammates === undefined || s.hydroTeammates === undefined) blockers.push("A4需要除兹白外的实际岩、水队友人数；未知不能当作0。");
    if ((s.otherGeoTeammates ?? 0) + (s.hydroTeammates ?? 0) > 3) blockers.push("除兹白外岩与水队友合计不能超过3人。");
    if (s.includedA4DefensePercent === undefined || s.includedA4ElementalMastery === undefined) blockers.push("需要明确输入面板已含的兹白A4防御百分比与精通份额。");
  }
  const defensePercent = active ? add(b, "a4DefensePercent", expr.mul(expr.input("otherGeoTeammates"), expr.input("defensePercentPerGeo")), { otherGeoTeammates: s.otherGeoTeammates ?? 0, defensePercentPerGeo: constants.a4DefensePercentPerOtherGeo }) : add(b, "a4DefensePercent", expr.value(0), {}, "ratio", "突破4尚未解锁；不要求未执行的队伍人数。", true);
  const elementalMastery = active ? add(b, "a4ElementalMastery", expr.mul(expr.input("hydroTeammates"), expr.input("elementalMasteryPerHydro")), { hydroTeammates: s.hydroTeammates ?? 0, elementalMasteryPerHydro: constants.a4ElementalMasteryPerHydro }, "stat") : add(b, "a4ElementalMastery", expr.value(0), {}, "stat", "突破4尚未解锁；不要求未执行的队伍人数。", true);
  const defensePercentDelta = add(b, "a4DefenseDelta", expr.sub(expr.input("actualDefensePercent"), expr.input("includedDefensePercent")), { actualDefensePercent: defensePercent, includedDefensePercent: s.includedA4DefensePercent ?? 0 });
  const elementalMasteryDelta = add(b, "a4ElementalMasteryDelta", expr.sub(expr.input("actualElementalMastery"), expr.input("includedElementalMastery")), { actualElementalMastery: elementalMastery, includedElementalMastery: s.includedA4ElementalMastery ?? 0 }, "stat");
  if (h.finalSnapshot && h.finalSnapshot.origin !== "equipment-conversion" && (Math.abs(defensePercentDelta) > 1e-12 || Math.abs(elementalMasteryDelta) > 1e-12)) blockers.push("实际历史完整快照必须已含本次A4及其装备派生属性；请恢复正确最终面板，不能从旧快照重建未保存的转换。");
  return { defensePercent, elementalMastery, defensePercentDelta, elementalMasteryDelta, trace: b.nodes, blockers };
}

/** a4AlreadyResolved is only for a caller that already ran these source deltas through equipment stat construction. */
export function resolveZibaiFinitePanel(d: DocumentContext, h: CalculatorHit, panel: CalculatorFinalStats, a4AlreadyResolved = false): { stats: CalculatorFinalStats; trace: CalculationTraceNode[]; blockers: string[] } {
  const c = d.gameContext?.zibaiFiniteCast;
  if (!castOf(d) || !c || (h.kind !== "ordinary" && h.kind !== "special")) return { stats: panel, trace: [], blockers: [] };
  const a4 = resolveZibaiFiniteA4(d, h), b = new TraceBuilder(h.sourceRefs), s = stateOf(c, h), blockers = [...a4.blockers];
  if (a4AlreadyResolved) return { stats: panel, trace: a4.trace, blockers };
  const delta = a4.defensePercentDelta;
  const baseDefense = d.build.mode === "equipment-derived" && !h.finalSnapshot ? d.build.baseDef : s.baseDefense;
  if (Math.abs(delta) > 1e-12 && baseDefense === undefined) blockers.push("防御百分比补差需要本击真实基础防御；不能把最终防御当基础防御。");
  const def = Math.abs(delta) <= 1e-12 ? add(b, "finalDefense", expr.input("panelDefense"), { panelDefense: panel.def }, "stat", "A4防御已含份额与本击实际份额相同；直接读取最终防御，不要求历史基础防御。", true) : add(b, "finalDefense", expr.add(expr.input("panelDefense"), expr.mul(expr.input("baseDefense"), expr.input("defensePercentDelta"))), { panelDefense: panel.def, baseDefense: baseDefense ?? 0, defensePercentDelta: delta }, "stat");
  const em = add(b, "finalElementalMastery", expr.add(expr.input("panelElementalMastery"), expr.input("elementalMasteryDelta")), { panelElementalMastery: panel.em, elementalMasteryDelta: a4.elementalMasteryDelta }, "stat");
  if (def < 0 || em < 0) blockers.push("A4已含份额与实际输入面板矛盾，产生负防御或负精通。");
  return { stats: { ...panel, def, em }, trace: [...a4.trace, ...b.nodes], blockers };
}
function canonical(d: CalculatorDocument, t: ZibaiFiniteTemplate, c: ZibaiFiniteCastContext, role: "ordinary" | "lunar", previous?: Hit, event?: ZibaiFiniteCandidate): Hit {
  const r = t.roles[role], level = d.gameContext!.effectiveTalentLevel, id = event ? `${t.skillId}:${event.id}` : previous?.id ?? r.mappingId;
  const common = { id, label: `${r.label}${event ? ` · 第${event.frame}帧` : " · 独立实际命中"}`, sourceRefs: r.sourceRefs, dependencies: [sourceId] };
  let h: Hit;
  if (role === "ordinary") {
    const old = previous?.kind === "ordinary" ? structuredClone(previous) : undefined;
    h = { ...old, ...common, kind: "ordinary", element: "geo", attackTag: r.attackTag, terms: [{ stat: "def", coefficient: r.values[level - 1]! }], additiveBaseDamage: old?.additiveBaseDamage ?? 0, damageBonus: old?.damageBonus ?? 0, critEligible: true, reaction: "none", reactionBonus: old?.reactionBonus ?? 0, groupMultiplier: old?.groupMultiplier ?? 1 };
    delete h.baseDamageFormula; delete h.additiveBaseFormula; delete h.damageBonusFormula; delete h.resistanceReductionFormula; delete h.elementalMasteryAdjustment; delete h.attackAdjustment; delete h.critRateFormula; delete h.critDamageFormula; delete h.additiveReaction;
  } else {
    h = { ...common, kind: "special", context: { branch: "lunar-crystallize-direct", ruleVersion: "kqm-lunar-luna-vi-20260922-v1", context: { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: t.assumptions }, contributors: [{ id: c.casterId ?? "zibai", base: { kind: "direct-stat-talent", scalingStat: "def", statValue: 0, talentCoefficient: r.values[level - 1]!, sourceRefs: r.sourceRefs }, elementalMastery: 0, critRate: 0, critDamage: 0, specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, modifierSourceRefs: r.sourceRefs }], effectiveResistance: d.enemy.resistance } };
  }
  if (event) { const { id: candidateId, contact: _contact, ...rest } = event; h.zibaiFiniteEvent = { candidateId, ...rest }; }
  else if (previous?.zibaiFiniteEvent) h.zibaiFiniteEvent = structuredClone(previous.zibaiFiniteEvent);
  const snapshot = h.zibaiFiniteEvent ? c.snapshots?.[h.zibaiFiniteEvent.snapshotId] : undefined;
  const unchanged = previous && c.finalizedHitEvents?.[id] === identity(d, c, h);
  if (snapshot) h.finalSnapshot = structuredClone(snapshot); else if (unchanged && previous?.finalSnapshot) h.finalSnapshot = structuredClone(previous.finalSnapshot); else delete h.finalSnapshot;
  if (h.kind === "ordinary" && (!unchanged || snapshot && JSON.stringify(snapshot) !== JSON.stringify(previous?.finalSnapshot))) { delete h.effectiveResistance; delete h.effectiveCritRate; delete h.effectiveCritDamage; }
  return h;
}
export function prepareZibaiFiniteCastDocument(document: CalculatorDocument): CalculatorDocument {
  const t = castOf(document); if (!t) return document;
  const d = structuredClone(document), g = d.gameContext!, c = zibaiFiniteCastContextSchema.parse(g.zibaiFiniteCast ?? {}); g.zibaiFiniteCast = c;
  const prior = d.hits, selected = new Set(d.selectedHitIds), all = prior.every(h => selected.has(h.id));
  const old = new Map(prior.filter((h): h is Hit => h.kind === "ordinary" || h.kind === "special").map(h => [h.id, h]));
  const refs = [...new Set(Object.values(t.roles).flatMap(r => r.sourceRefs))], issues: string[] = [];
  d.dependencies = d.dependencies.filter(row => !row.id.startsWith(prefix));
  if (g.constellation !== 0) issues.push("此兹白有限两段协议仅支持明确C0；高命座不能沿用C0条款。");
  if (g.effectiveTalentLevel > 15) issues.push("有效天赋必须在固定来源1至15级内。");
  const reps = () => [canonical(d, t, c, "ordinary", [...old.values()].find(h => roleOf(t, h) === "ordinary" && !h.zibaiFiniteEvent))];
  let independentId: string | undefined;
  if (g.effectiveTalentLevel > 15) d.hits = prior;
  else if (d.scope === "single-hit") {
    if (c.independentEvent) {
      const { candidateId: id, ...metadata } = c.independentEvent, key = `${t.skillId}:${id}`;
      const h = canonical(d, t, c, metadata.templateRole, old.get(key), { id, ...metadata });
      d.hits = [...old.values()].filter(row => row.id !== key); d.hits.push(h); independentId = key;
    } else d.hits = old.size ? [...old.values()].map(h => {
      const role = roleOf(t, h); if (!role) return h;
      const e = h.zibaiFiniteEvent; if (!e) return canonical(d, t, c, role, h);
      const { candidateId: id, ...metadata } = e; return canonical(d, t, c, role, h, { id, ...metadata });
    }) : reps();
  } else {
    const schedule = compileZibaiFiniteSchedule(t.skillId as ZibaiFiniteCastKind, c); issues.push(...schedule.issues);
    d.hits = schedule.complete ? schedule.instances.map(e => canonical(d, t, c, e.templateRole, old.get(`${t.skillId}:${e.id}`), e)) : reps();
    if (!d.hits.length) d.hits = [{ id: `${t.skillId}:no-contact`, label: "完整两段均未接触本目标", kind: "non-damaging", reason: "两段实际候选与落空均已明确，伤害为零。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = d.hits.filter(h => selected.has(h.id)).map(h => h.id);
  d.selectedHitIds = d.scope === "single-hit" ? [independentId ?? retained[0] ?? d.hits[0]!.id] : all || !retained.length ? d.hits.map(h => h.id) : retained;
  d.dependencies.push({ id: sourceId, status: "provisional", reason: "固定Optimizer有限两段公式及明确观察输入；不是自动团队能力或当前游戏实测。", sourceRefs: refs });
  const dependency = (id: string, reasons: string[], hits: CalculatorHit[]) => { d.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击实际身份、快照与已含份额已明确。", sourceRefs: refs }); hits.forEach(h => h.dependencies = [...new Set([...h.dependencies, id])]); };
  dependency(`${prefix}schedule`, issues, d.hits);
  for (const h of d.hits) if (h.kind === "ordinary" || h.kind === "special") {
    const reasons: string[] = [], e = h.zibaiFiniteEvent, s = stateOf(c, h), a = ascOf(d, h);
    if (!e) reasons.push("需要本击已发生事件、实际时刻与取样身份；单击不需要未来另一段。");
    else reasons.push(...zibaiFiniteEventIssues(e, c.targetId));
    if (e && (h.kind === "ordinary") !== (e.templateRole === "ordinary")) reasons.push("实际事件角色与普通／月结晶计算分支不一致。");
    if (t.abilityKey === "combat2" && c.spiritSteedRecastConfirmed !== true) reasons.push("本击须明确来自实际合法灵驹重施，而非E姿态开启。");
    if (a === undefined) reasons.push("需要本击实际突破阶段。");
    if (a !== undefined && (h.finalSnapshot?.characterLevel ?? d.characterLevel) < [1, 20, 40, 50, 60, 70, 80][a]!) reasons.push("角色等级不符合本击突破阶段。");
    const a4 = resolveZibaiFiniteA4(d, h);
    reasons.push(...a4.blockers);
    if (d.build.mode !== "equipment-derived" && !h.finalSnapshot && Math.abs(a4.defensePercentDelta) > 1e-12 && s.baseDefense === undefined) reasons.push("手动／导入最终面板的A4防御补差需要本击真实基础防御，不能从最终DEF猜测。");
    if (e && d.scope !== "single-hit" && c.statsStableAcrossHits !== true && !c.snapshots?.[e.snapshotId] && !h.finalSnapshot) reasons.push(`缺少本击实际进攻快照 ${e.snapshotId}；不能默认两段面板相同。`);
    if (old.get(h.id)?.finalSnapshot && !h.finalSnapshot && e && !c.snapshots?.[e.snapshotId]) reasons.push("之前的本击历史面板已失效或被移除，请恢复实际面板而非静默改用当前构筑。");
    if (h.kind === "special") {
      for (const key of ["specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "elevationMultiplier"] as const) if (s[key] === undefined) reasons.push(`需要明确月结晶输入 ${key}；未知不能默认0或1。`);
      if (t.abilityKey === "combat2" && (a ?? 1) >= 1 && (s.a1WindowActive === undefined || s.includedA1Additive === undefined)) reasons.push("灵驹第二段需明确本击A1四秒窗口与特殊加值已含A1份额；不从重施自行推断窗口刷新。");
    }
    if (c.finalizedHitEvents && c.finalizedHitEvents[h.id] !== identity(d, c, h)) reasons.push("本击事件或来源记账已改变，旧物化面板失效；请恢复来源构筑后重新计算。");
    dependency(`${prefix}${h.id}`, reasons, [h]);
  }
  const chosen = d.hits.filter(h => d.selectedHitIds.includes(h.id));
  g.scopeCoverage = d.scope === "single-hit" ? "single-hit" : chosen.length === d.hits.length && !chosen.some(h => h.dependencies.some(id => d.dependencies.find(row => row.id === id)?.status === "missing")) ? "complete-cast" : "selected-components";
  g.attributionPolicy = "只合计本次已观察普通岩伤与直接月结晶两段；单击显示本击真实伤害，不包含未选未来段。灵驹重施不等于完整隙中月，Q延长姿态不在有限伤害协议内。";
  d.assumptions = [...d.assumptions.filter(row => !row.startsWith("兹白有限协议：")), ...t.assumptions.map(row => `兹白有限协议：${row}`)]; return d;
}

export function resolveZibaiFiniteSpecialContext(d: CalculatorDocument, h: Special, panel: CalculatorFinalStats, a4AlreadyResolved = false): { context: ConditionedSpecialCalculation; trace: CalculationTraceNode[]; blockers: string[] } {
  const t = castOf(d), c = d.gameContext?.zibaiFiniteCast;
  if (!t || !c) return { context: h.context, trace: [], blockers: [] };
  if (!h.zibaiFiniteEvent) return { context: h.context, trace: [], blockers: ["缺少本次实际月结晶事件，不执行代表行的空面板。"] };
  const resolved = resolveZibaiFinitePanel(d, h, h.finalSnapshot?.stats ?? panel, a4AlreadyResolved), s = stateOf(c, h), b = new TraceBuilder(h.sourceRefs), context = structuredClone(h.context), owner = context.contributors[0]!;
  const actualBaseBonus = add(b, "intrinsicBaseBonus", expr.min(expr.mul(expr.div(expr.input("actualDefense"), expr.value(100)), expr.input("intrinsicBonusPer100Defense")), expr.input("intrinsicBonusCap")), { actualDefense: resolved.stats.def, intrinsicBonusPer100Defense: constants.intrinsicBaseBonusPer100Defense, intrinsicBonusCap: constants.intrinsicBaseBonusCap });
  owner.specialBaseBonus = add(b, "baseBonusTotal", expr.add(expr.input("inputBaseBonus"), expr.sub(expr.input("intrinsicBaseBonus"), expr.input("includedIntrinsicBaseBonus"))), { inputBaseBonus: s.specialBaseBonus ?? 0, intrinsicBaseBonus: actualBaseBonus, includedIntrinsicBaseBonus: s.includedIntrinsicBaseBonus ?? 0 });
  const strideA1 = t.abilityKey === "combat2" && (ascOf(d, h) ?? 0) >= 1 && s.a1WindowActive === true;
  const a1 = add(b, "a1Additive", expr.mul(expr.input("a1Eligible"), expr.input("actualDefense"), expr.input("a1DefenseCoefficient")), { a1Eligible: Number(strideA1), actualDefense: resolved.stats.def, a1DefenseCoefficient: constants.a1DefenseCoefficient }, "damage", t.abilityKey === "combat3" ? "元素爆发不适用灵驹A1；不读取其窗口及已含份额。" : "只在实际四秒窗口内的灵驹第二段适用，位于EM与反应乘区之后。", !strideA1);
  owner.specialAdditive = add(b, "specialAdditiveTotal", expr.add(expr.input("inputSpecialAdditive"), expr.sub(expr.input("a1Additive"), expr.input("includedA1Additive"))), { inputSpecialAdditive: s.specialAdditive ?? 0, a1Additive: a1, includedA1Additive: t.abilityKey === "combat2" ? s.includedA1Additive ?? 0 : 0 }, "damage");
  owner.base = { kind: "direct-stat-talent", scalingStat: "def", statValue: resolved.stats.def, talentCoefficient: t.roles.lunar.values[d.gameContext!.effectiveTalentLevel - 1]!, sourceRefs: h.sourceRefs };
  owner.elementalMastery = resolved.stats.em; owner.critRate = resolved.stats.critRate; owner.critDamage = resolved.stats.critDamage;
  owner.reactionBonus = s.reactionBonus ?? 0; owner.elevationMultiplier = s.elevationMultiplier ?? 1; context.effectiveResistance = d.enemy.resistance;
  const blockers = [...resolved.blockers]; if (owner.specialBaseBonus < 0 || owner.specialAdditive < 0) blockers.push("特殊加成的已含份额大于输入总额与实际来源贡献，产生负数，请修正本击记账。");
  return { context, trace: [...resolved.trace, ...b.nodes], blockers };
}
export function resetZibaiFinitePanelAccounting(d: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!castOf(d)) return; const c = d.gameContext!.zibaiFiniteCast ??= {}; delete c.finalizedHitEvents;
  const reset = (s: NonNullable<ZibaiFiniteCastContext["sharedState"]>) => {
    for (const key of ["includedA4DefensePercent", "includedA4ElementalMastery"] as const) { if (mode === "fresh-equipment") s[key] = 0; else delete s[key]; }
  };
  c.hitStates ??= {}; for (const h of d.hits) if ((h.kind === "ordinary" || h.kind === "special") && h.finalSnapshot?.origin !== "equipment-conversion" && h.finalSnapshot) c.hitStates[h.id] = stateOf(c, h);
  reset(c.sharedState ??= {});
  for (const h of d.hits) if ((h.kind === "ordinary" || h.kind === "special") && (!h.finalSnapshot || h.finalSnapshot.origin === "equipment-conversion")) { reset(c.hitStates[h.id] ??= {}); delete h.finalSnapshot; }
}
export function finalizeZibaiFinitePanelAccounting(d: CalculatorDocument): void {
  if (!castOf(d)) return; const c = d.gameContext!.zibaiFiniteCast ??= {}; c.hitStates ??= {};
  for (const h of d.hits) if ((h.kind === "ordinary" || h.kind === "special") && h.finalSnapshot?.origin === "equipment-conversion") {
    const a4 = resolveZibaiFiniteA4(d, h), s = c.hitStates[h.id] ??= {};
    s.includedA4DefensePercent = a4.defensePercent; s.includedA4ElementalMastery = a4.elementalMastery;
  }
  c.finalizedHitEvents = Object.fromEntries(d.hits.filter((h): h is Hit => h.kind === "ordinary" || h.kind === "special").map(h => [h.id, identity(d, c, h)]));
}
export function zibaiFiniteEventTrace(h: CalculatorHit): CalculationTraceNode[] {
  if ((h.kind !== "ordinary" && h.kind !== "special") || !h.zibaiFiniteEvent) return [];
  const e = h.zibaiFiniteEvent, b = new TraceBuilder(h.sourceRefs);
  add(b, "observedFrame", expr.input("frame"), { frame: e.frame }, "frames", `实际观察 ${e.candidateId}，目标 ${e.targetId}；不是来源认证动画帧。`);
  add(b, "snapshotFrame", expr.input("snapshotFrame"), { snapshotFrame: e.snapshotFrame }, "frames", `实际进攻取样 ${e.snapshotId}；与另一段独立。`); return b.nodes;
}
