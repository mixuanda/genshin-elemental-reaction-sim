import type { ConditionedSpecialCalculation } from "@genshin-dps-lab/reaction-formulas";
import { TRAVELER_CRYO_STATE_ASSUMPTIONS, travelerCryoStateSourceRefs, travelerCryoStateValues } from "../../game-data/src/character-mappings/traveler-cryo-state-mappings";
import {
  travelerCryoStateCastContextSchema, type TravelerCryoStateCastContext, type CalculatorDocument,
  type CalculatorHit, type CalculatorFinalStats, type CalculatorFormula,
} from "./calculator-model";
import { createTravelerCryoA4Formula, createTravelerCryoBurstFormula } from "./traveler-cryo-formulas";
import { compileTravelerCryoStateSchedule, validateTravelerCryoStateEvent, type TravelerCryoStateCastKind, type TravelerCryoStateHitInstance } from "./traveler-cryo-state-schedule";
import type { TravelerCryoStateEvent, TravelerCryoStateHitState } from "./traveler-cryo-state-context";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type Ordinary = Extract<CalculatorHit, { kind: "ordinary" }>;
type Special = Extract<CalculatorHit, { kind: "special" }>;
type Hit = Ordinary | Special;
type Role = TravelerCryoStateEvent["templateRole"];
const prefix = "traveler-cryo-state:", sourceId = `${prefix}source`;
function castOf(document: CalculatorDocument): { gender: "aether" | "lumine"; kind: TravelerCryoStateCastKind; skillId: string } | undefined {
  const skillId = document.gameContext?.skillId ?? "", match = /^(aether|lumine)-cryo-(skill|burst)-state-c0$/.exec(skillId);
  return match ? { gender: match[1] as "aether" | "lumine", kind: match[2] as TravelerCryoStateCastKind, skillId } : undefined;
}
export const isTravelerCryoStateAction = (document: CalculatorDocument): boolean => castOf(document) !== undefined;
const ascensionOf = (document: CalculatorDocument) => (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
const stateOf = (context: TravelerCryoStateCastContext, hit: Hit): TravelerCryoStateHitState => ({ ...context.sharedState, ...context.hitStates?.[hit.id] });
const roleOf = (hit: Hit, kind: TravelerCryoStateCastKind): Role => hit.travelerCryoStateEvent?.templateRole ?? (kind === "skill" ? "initial" : "burst-ordinary");
const specialRole = (role: Role): boolean => role === "burst-conduct" || role === "burst-swirl";
function identity(document: CalculatorDocument, context: TravelerCryoStateCastContext, hit: Hit): string {
  const event = hit.travelerCryoStateEvent;
  return JSON.stringify({ event: event ?? hit.id, snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null,
    state: stateOf(context, hit), level: document.gameContext?.effectiveTalentLevel, ascension: ascensionOf(document),
    stable: context.statsStableAcrossHits, trueMoon: context.trueMoonStoryBuffEnabled, travelFrames: context.travelFrames });
}
function coefficient(role: Role, level: number): number {
  return travelerCryoStateValues(role === "initial" ? "skill" : role === "crystal" ? "crystal" : role === "burst-conduct" ? "burstSSC" : role === "burst-swirl" ? "burstSSw" : "burst")[level - 1]!;
}
function canonical(document: CalculatorDocument, context: TravelerCryoStateCastContext, role: Role, old?: Hit, event?: TravelerCryoStateHitInstance): Hit {
  const cast = castOf(document)!, id = event ? `${cast.skillId}:${event.id}` : old?.id ?? `${cast.skillId}-${cast.kind === "skill" ? "initial" : "javelin"}`;
  const refs = travelerCryoStateSourceRefs(cast.gender), level = document.gameContext!.effectiveTalentLevel;
  const label = role === "initial" ? "冰雾剑·初击" : role === "crystal" ? "栗烈寒星·冰晶" : role === "burst-conduct" ? "聚冰成锋·直接星超导" : role === "burst-swirl" ? "聚冰成锋·直接星扩散" : "聚冰成锋·普通投矛";
  const common = { id, label: `${label}${event ? ` · 第${event.frame}帧` : " · 独立实际命中"}`, sourceRefs: refs, dependencies: [sourceId] };
  let hit: Hit;
  if (!specialRole(role)) {
    const previous = old?.kind === "ordinary" ? structuredClone(old) : undefined;
    hit = { ...previous, ...common, kind: "ordinary", element: "cryo", attackTag: cast.kind,
      terms: [{ stat: "atk", coefficient: coefficient(role, level) }], additiveBaseDamage: previous?.additiveBaseDamage ?? 0,
      damageBonus: previous?.damageBonus ?? 0, critEligible: true, reaction: previous?.reaction ?? "none",
      reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1 };
    delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
    delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment; delete hit.resistanceReductionFormula;
    delete hit.critRateFormula; delete hit.critDamageFormula;
  } else {
    const branch = role === "burst-conduct" ? "stellar-conduct-direct" : "stellar-swirl-direct";
    const specialContext: ConditionedSpecialCalculation = {
      branch, ruleVersion: "kqm-stellar-7.0-20260922-v1",
      context: { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: TRAVELER_CRYO_STATE_ASSUMPTIONS },
      contributors: [{ id: context.casterId ?? cast.gender, base: { kind: "direct-stat-talent", scalingStat: "atk", statValue: 0,
        talentCoefficient: coefficient(role, level), sourceRefs: refs }, elementalMastery: 0, specialBaseBonus: 0,
        reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, critRate: 0, critDamage: 0, modifierSourceRefs: refs }],
      effectiveResistance: old?.kind === "special" ? old.context.effectiveResistance : document.enemy.resistance,
      ...(branch === "stellar-conduct-direct" ? { polestarApplicationCount: 0 } : {}),
    };
    hit = { ...common, kind: "special", context: specialContext };
  }
  if (event) { const { id: candidateId, ...metadata } = event; hit.travelerCryoStateEvent = { candidateId, ...metadata }; }
  else if (old?.travelerCryoStateEvent) hit.travelerCryoStateEvent = structuredClone(old.travelerCryoStateEvent);
  const snapshot = hit.travelerCryoStateEvent ? context.snapshots?.[hit.travelerCryoStateEvent.snapshotId] : undefined;
  const unchanged = old !== undefined && context.finalizedHitEvents?.[id] === identity(document, context, hit);
  if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
  else if (unchanged && old?.finalSnapshot) hit.finalSnapshot = structuredClone(old.finalSnapshot);
  else delete hit.finalSnapshot;
  if (hit.kind === "ordinary" && (!unchanged || snapshot && JSON.stringify(snapshot) !== JSON.stringify(old?.finalSnapshot))) {
    delete hit.effectiveResistance; delete hit.effectiveCritRate; delete hit.effectiveCritDamage;
  }
  return hit;
}

function passiveIssues(document: CalculatorDocument, context: TravelerCryoStateCastContext, hit: Hit): string[] {
  const issues: string[] = [], state = stateOf(context, hit), ascension = hit.finalSnapshot?.ascension ?? ascensionOf(document);
  if (ascension === undefined) issues.push("需要明确本击突破阶段，不能推断A4已解锁或未解锁。");
  if (ascension !== undefined && (hit.finalSnapshot?.characterLevel ?? document.characterLevel) < [1, 20, 40, 50, 60, 70, 80][ascension]!) issues.push("角色等级低于本次突破阶段的最低等级。");
  if (ascension !== undefined && ascension >= 4) {
    if (state.nonExtraAtk === undefined || state.includedA4Em === undefined) issues.push("A4需要本击取样时的实际非Extra攻击与面板精通已含份额；不能从最终ATK倒推。");
    if (state.nonExtraAtk !== undefined && state.includedA4Em !== undefined) {
      const actual = Math.min(state.nonExtraAtk * .08, 160);
      if (hit.finalSnapshot && state.includedA4Em !== actual) issues.push("历史最终快照须已包含该时点完整A4精通；重新物化时先恢复对应构筑，不给旧快照重复补差。");
      if (hit.kind === "ordinary") hit.elementalMasteryAdjustment = {
        accounting: "add-to-panel", formula: createTravelerCryoA4Formula(state.nonExtraAtk, state.includedA4Em),
      };
    }
  } else if (ascension !== undefined && state.includedA4Em !== undefined && state.includedA4Em !== 0) issues.push("本击尚未解锁A4，不能声明面板包含非零A4精通。");
  if (hit.kind === "special") {
    for (const key of ["otherSpecialBaseBonus", "otherReactionBonus", "specialAdditive", "elevationMultiplier"] as const) {
      if (state[key] === undefined) issues.push(`需要明确本击特殊伤害输入 ${key}，未知不当作零或一。`);
    }
    if (state.impactAtk === undefined && context.statsStableAcrossHits !== true) issues.push("星耀基础提升在命中时另读攻击；需要实际impactAtk，或明确36帧快照到命中的攻击稳定。");
    if (hit.context.branch === "stellar-conduct-direct" && state.polestarApplicationCount === undefined) issues.push("直接星超导需要本击实际极星领域应用计数0至12，不能按Q次数或当前领域存在性推定。");
  }
  return issues;
}

/** Reconstructs canonical source terms after edits/imports; unknown inputs remain blocked. */
export function prepareTravelerCryoStateDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = castOf(document); if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!, context = travelerCryoStateCastContextSchema.parse(game.travelerCryoStateCast ?? {});
  game.travelerCryoStateCast = context;
  const refs = travelerCryoStateSourceRefs(cast.gender), missing: string[] = [];
  if (game.constellation !== 0) missing.push("当前事件状态协议仅支持C0；高命新增晶体、延长与特殊增益不能沿用。");
  if (game.variantId !== `${cast.gender}-cryo`) missing.push("来源动作须保留对应空／荧冰元素身份与独立天赋绑定。");
  const level = game.effectiveTalentLevel;
  if (!Number.isInteger(level) || level < 1 || level > 15) {
    const id = `${prefix}talent`;
    result.dependencies = result.dependencies.filter(dependency => dependency.id !== id);
    result.dependencies.push({ id, status: "missing", reason: "实际有效天赋必须在固定来源1至15级内，不采用回退倍率。", sourceRefs: refs });
    result.hits.forEach(hit => hit.dependencies = [...new Set([...hit.dependencies, id])]);
    game.scopeCoverage = "selected-components"; return result;
  }
  const oldHits = new Map(result.hits.filter((hit): hit is Hit => hit.kind === "ordinary" || hit.kind === "special").map(hit => [hit.id, hit]));
  const selected = new Set(result.selectedHitIds), allSelected = result.hits.every(hit => selected.has(hit.id));
  const representative = () => canonical(result, context, cast.kind === "skill" ? "initial" : "burst-ordinary",
    [...oldHits.values()].find(hit => !hit.travelerCryoStateEvent && hit.kind === "ordinary"));
  let independentId: string | undefined;
  if (result.scope === "single-hit") {
    if (context.independentEvent) {
      const { candidateId: id, ...metadata } = context.independentEvent;
      independentId = `${cast.skillId}:${id}`;
      const hit = canonical(result, context, metadata.templateRole, oldHits.get(independentId), { id, ...metadata });
      result.hits = [...oldHits.values()].filter(previous => previous.id !== independentId); result.hits.push(hit);
    } else result.hits = oldHits.size ? [...oldHits.values()].map(hit => canonical(result, context, roleOf(hit, cast.kind), hit)) : [representative()];
  } else {
    // A saved single-hit record cannot satisfy a subsequent whole-cast request.
    const { independentEvent: _independent, ...wholeContext } = context;
    const schedule = compileTravelerCryoStateSchedule(cast.kind, wholeContext, cast.gender);
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonical(result, context, event.templateRole, oldHits.get(`${cast.skillId}:${event.id}`), event)) : [representative()];
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "完整观察没有接触所选目标", kind: "non-damaging",
      reason: "完整来源候选均明确落空；外部触发动作本体不属于本次E/Q。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [independentId ?? retained[0] ?? result.hits[0]!.id]
    : allSelected || !retained.length ? result.hits.map(hit => hit.id) : retained;
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定原文与完整实际事件协议；未晋升为游戏验证或自动团队执行。", sourceRefs: refs });
  const dependency = (id: string, reasons: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: [...new Set(reasons)].join("；") || "本击来源、取样及已含份额明确。", sourceRefs: refs });
    hits.forEach(hit => hit.dependencies = [...new Set([...hit.dependencies, id])]);
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) if (hit.kind === "ordinary" || hit.kind === "special") {
    const event = hit.travelerCryoStateEvent, issues = passiveIssues(result, context, hit);
    if (!event) issues.push("需要本次已发生命中的实际事件；代表行不能冒充完整普通或特殊伤害。");
    else {
      issues.push(...validateTravelerCryoStateEvent(cast.kind, event, context, cast.gender));
      if (hit.kind === "ordinary" && event.templateRole === "burst-ordinary" && event.frostglowStacks !== undefined) hit.baseDamageFormula = createTravelerCryoBurstFormula(level, event.frostglowStacks);
      if (context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId] && !hit.finalSnapshot && result.scope !== "single-hit") issues.push(`缺少实际历史进攻快照 ${event.snapshotId}；不同取样帧不能默认共享面板。`);
    }
    if (oldHits.get(hit.id)?.finalSnapshot && !hit.finalSnapshot && !(event && context.snapshots?.[event.snapshotId])) issues.push("本击历史快照已经失效或删除，需重新提供实际面板，不能静默沿用当前构筑。");
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) issues.push("本击来源事件或被动记账已改变，旧物化面板失效；请重新应用构筑。");
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const chosen = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : chosen.length === result.hits.length && !chosen.some(hit => hit.dependencies.some(id => result.dependencies.find(item => item.id === id)?.status === "missing")) ? "complete-cast" : "selected-components";
  game.attributionPolicy = "仅本次E初击与实际生成冰晶，或本次Q36帧构造的投矛；触发N/CA/P本体、队友与外部领域反应不并入。";
  result.assumptions = [...result.assumptions.filter(assumption => !assumption.startsWith("冰主事件来源：")), ...TRAVELER_CRYO_STATE_ASSUMPTIONS.map(assumption => `冰主事件来源：${assumption}`)];
  return result;
}

/** Let the existing panel/equipment resolver perform A4 before EM-dependent equipment. */
export function travelerCryoStateSpecialPanelProxy(document: CalculatorDocument, hit: Special): Ordinary | undefined {
  const context = document.gameContext?.travelerCryoStateCast;
  if (!castOf(document) || !context || hit.finalSnapshot || (ascensionOf(document) ?? 0) < 4) return undefined;
  const state = stateOf(context, hit);
  if (state.nonExtraAtk === undefined || state.includedA4Em === undefined) return undefined;
  return { id: hit.id, label: hit.label, kind: "ordinary", element: "cryo", attackTag: "burst", terms: [{ stat: "atk", coefficient: 1 }],
    additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1,
    sourceRefs: hit.sourceRefs, dependencies: [], elementalMasteryAdjustment: { accounting: "add-to-panel", formula: createTravelerCryoA4Formula(state.nonExtraAtk, state.includedA4Em) } };
}

export function resolveTravelerCryoStateSpecialContext(document: CalculatorDocument, hit: Special, panel: CalculatorFinalStats,
  a4AlreadyResolved = false): { context: ConditionedSpecialCalculation; trace: CalculationTraceNode[]; blockers?: string[] } {
  const cast = castOf(document), supplied = document.gameContext?.travelerCryoStateCast;
  if (!cast || !supplied) return { context: hit.context, trace: [] };
  const event = hit.travelerCryoStateEvent;
  if (!event || !specialRole(event.templateRole)) return { context: hit.context, trace: [], blockers: ["直接星耀伤害缺少本击已确认来源事件。"] };
  const state = stateOf(supplied, hit), stats = hit.finalSnapshot?.stats ?? panel, context = structuredClone(hit.context);
  const ascension = hit.finalSnapshot?.ascension ?? ascensionOf(document) ?? 0, builder = new TraceBuilder(hit.sourceRefs);
  const stage = (id: string, label: string, expression: CalculatorFormula["expression"], values: Record<string, number>, unit = "ratio") => builder.add(
    `${prefix}${id}`, label, expression, Object.entries(values).map(([key, value]) => ({ ...traceInput(key, value, "stat", "actual-traveler-cryo-state", key),
      context: { actorId: supplied.casterId ?? cast.gender, snapshotFrame: event.snapshotFrame, deliveryFrame: event.frame, targetId: event.targetId } })),
    { unit, explanationKey: label, status: "assumed" });
  let em = stats.em;
  if (ascension >= 4 && !a4AlreadyResolved) em = stage("a4-em", "36帧快照精通补入实际A4并扣除已含份额",
    expr.add(expr.input("snapshotEM"), expr.sub(expr.min(expr.mul(expr.input("nonExtraAtk"), expr.value(.08)), expr.value(160)), expr.input("includedA4Em"))),
    { snapshotEM: stats.em, nonExtraAtk: state.nonExtraAtk ?? 0, includedA4Em: state.includedA4Em ?? 0 }, "EM");
  const frostglowTable = event.templateRole === "burst-conduct" ? "flowGlowBonusSSC" : "frostGlowBonusSSw";
  const talent = stage("burst-coefficient", "36帧锁定的来源Q倍率加实际消耗寒辉倍率",
    expr.add(expr.input("baseCoefficient"), expr.mul(expr.input("frostglowStacks"), expr.input("perStackCoefficient"))),
    { baseCoefficient: coefficient(event.templateRole, document.gameContext!.effectiveTalentLevel), frostglowStacks: event.frostglowStacks ?? 0,
      perStackCoefficient: travelerCryoStateValues(frostglowTable)[document.gameContext!.effectiveTalentLevel - 1]! });
  const ownBaseBonus = stage("impact-base-bonus", "命中回调读取ATK：每100攻击提高0.35%，上限7%",
    expr.min(expr.mul(expr.div(expr.input("impactAtk"), expr.value(100)), expr.value(.0035)), expr.value(.07)),
    { impactAtk: state.impactAtk ?? stats.atk });
  const owner = context.contributors[0]!;
  owner.base = { kind: "direct-stat-talent", scalingStat: "atk", statValue: stats.atk, talentCoefficient: talent, sourceRefs: hit.sourceRefs };
  owner.elementalMastery = em; owner.critRate = stats.critRate; owner.critDamage = stats.critDamage;
  owner.specialBaseBonus = stage("base-bonus-total", "其他已确认基础提升加旅行者命中回调份额",
    expr.add(expr.input("otherSpecialBaseBonus"), expr.input("travelerBaseBonus")), { otherSpecialBaseBonus: state.otherSpecialBaseBonus ?? 0, travelerBaseBonus: ownBaseBonus });
  owner.reactionBonus = state.otherReactionBonus ?? 0; owner.specialAdditive = state.specialAdditive ?? 0; owner.elevationMultiplier = state.elevationMultiplier ?? 1;
  if (context.branch === "stellar-conduct-direct") context.polestarApplicationCount = state.polestarApplicationCount ?? 0;
  return { context, trace: builder.nodes, ...(em < 0 ? { blockers: ["已含A4精通与实际面板不符，补差后精通为负。"] } : {}) };
}

export function resetTravelerCryoStatePanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!castOf(document)) return;
  const context = document.gameContext!.travelerCryoStateCast ??= {}; delete context.finalizedHitEvents; context.hitStates ??= {};
  for (const hit of document.hits) if ((hit.kind === "ordinary" || hit.kind === "special") && hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion") context.hitStates[hit.id] = stateOf(context, hit);
  const reset = (state: TravelerCryoStateHitState) => { delete state.nonExtraAtk; delete state.impactAtk;
    if (mode === "fresh-equipment") state.includedA4Em = 0; else delete state.includedA4Em; };
  reset(context.sharedState ??= {});
  for (const hit of document.hits) if ((hit.kind === "ordinary" || hit.kind === "special") && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    reset(context.hitStates[hit.id] ??= {}); delete hit.finalSnapshot;
  }
}

export function finalizeTravelerCryoStatePanelAccounting(document: CalculatorDocument): void {
  if (!castOf(document)) return;
  const context = document.gameContext!.travelerCryoStateCast ??= {}; context.hitStates ??= {};
  for (const hit of document.hits) if ((hit.kind === "ordinary" || hit.kind === "special") && hit.finalSnapshot?.origin === "equipment-conversion") {
    const state = stateOf(context, hit), target = context.hitStates[hit.id] ??= {};
    if ((hit.finalSnapshot.ascension ?? ascensionOf(document) ?? 0) >= 4 && state.nonExtraAtk !== undefined) target.includedA4Em = Math.min(state.nonExtraAtk * .08, 160);
  }
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is Hit => hit.kind === "ordinary" || hit.kind === "special").map(hit => [hit.id, identity(document, context, hit)]));
}

export function travelerCryoStateEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if ((hit.kind !== "ordinary" && hit.kind !== "special") || !hit.travelerCryoStateEvent) return [];
  const event = hit.travelerCryoStateEvent, builder = new TraceBuilder(hit.sourceRefs);
  const add = (id: string, label: string, expression: CalculatorFormula["expression"], values: Record<string, number>) => builder.add(`${prefix}event.${id}`, label, expression,
    Object.entries(values).map(([key, value]) => traceInput(key, value, "frame", "observed-source-event", `${event.candidateId}／${event.targetId}：${key}`)),
    { unit: "frames", explanationKey: label, status: "assumed" });
  if (event.templateRole.startsWith("burst-")) add("snapshot", "Q在第36帧锁定辉映、寒辉和进攻快照", expr.value(36), {});
  else if (event.triggerFrame !== undefined) add("snapshot", event.triggerId ? "协同命中回调延迟3帧取样" : "定时检查加本枚冰晶队列偏移后取样",
    expr.add(expr.input("triggerFrame"), expr.input("snapshotDelay")), { triggerFrame: event.triggerFrame, snapshotDelay: event.snapshotFrame - event.triggerFrame });
  else add("snapshot", "E初击在第19帧取样", expr.value(19), {});
  add("delivery", "来源取样帧加实际排队及飞行时间得到交付帧",
    expr.add(expr.input("snapshotFrame"), expr.input("deliveryDelay")), { snapshotFrame: event.snapshotFrame, deliveryDelay: event.frame - event.snapshotFrame });
  return builder.nodes;
}
