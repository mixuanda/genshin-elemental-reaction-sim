import { periodicOrdinaryTemplates, type PeriodicOrdinaryTemplate, type PeriodicOrdinaryRole } from "../../game-data/src/character-mappings/periodic-ordinary-mappings";
import definitions from "../../game-data/sources/periodic-ordinary-casts/definitions.json";
import { periodicOrdinaryCastContextSchema, type CalculatorDocument, type CalculatorHit, type CalculatorFormula, type PeriodicOrdinaryCastContext } from "./calculator-model";
import { compilePeriodicOrdinarySchedule, type PeriodicOrdinaryCastKind, type PeriodicOrdinaryHitInstance } from "./periodic-ordinary-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const prefix = "periodic-ordinary:", sourceId = `${prefix}source`;
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const templateOf = (doc: CalculatorDocument) => periodicOrdinaryTemplates.find(row => row.skillId === doc.gameContext?.skillId);
const refsOf = (role: PeriodicOrdinaryRole) => role.sourceRefs.map(path => sourceRoot + path);
export const isPeriodicOrdinaryCastAction = (doc: CalculatorDocument) => templateOf(doc) !== undefined;
const roleOf = (cast: PeriodicOrdinaryTemplate, hit: OrdinaryHit) => hit.periodicOrdinaryEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const identity = (doc: CalculatorDocument, hit: OrdinaryHit, context: PeriodicOrdinaryCastContext) => stable({
  event: hit.periodicOrdinaryEvent ?? { singleHitId: hit.id }, state: { ...context.sharedState, ...context.hitStates?.[hit.id] },
  snapshot: hit.periodicOrdinaryEvent ? context.snapshots?.[hit.periodicOrdinaryEvent.snapshotId] : undefined,
  laumaInitializationEm: context.lauma?.initializationEm, talent: doc.gameContext!.effectiveTalentLevel,
  ascension: hit.finalSnapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension,
});

function canonicalHit(doc: CalculatorDocument, cast: PeriodicOrdinaryTemplate, roleKey: string, context: PeriodicOrdinaryCastContext, previous?: OrdinaryHit, event?: PeriodicOrdinaryHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey]!;
  const id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const hit: OrdinaryHit = { ...(previous ? structuredClone(previous) : {}), id,
    label: `${role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    kind: "ordinary", element: role.element, attackTag: role.attackTag,
    terms: role.terms.map(term => ({ stat: term.stat, coefficient: term.values[doc.gameContext!.effectiveTalentLevel - 1]! })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0,
    groupMultiplier: previous?.groupMultiplier ?? 1, dependencies: [sourceId], sourceRefs: refsOf(role),
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula; delete hit.resistanceReductionFormula;
  delete hit.critRateFormula; delete hit.critDamageFormula; delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment;
  delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.occurrence;
  if (event) {
    hit.periodicOrdinaryEvent = { candidateId: event.id, templateRole: roleKey, frame: event.frame, snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
      ...(event.laumaOwnShredActive === undefined ? {} : { laumaOwnShredActive: event.laumaOwnShredActive }) };
    const changed = previous?.periodicOrdinaryEvent && stable(previous.periodicOrdinaryEvent) !== stable(hit.periodicOrdinaryEvent);
    if (changed) { delete hit.finalSnapshot; delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance; }
    const snapshot = context.snapshots?.[event.snapshotId];
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
    else if (hit.finalSnapshot?.origin !== "equipment-conversion") delete hit.finalSnapshot;
  }
  return hit;
}

/** Each role returns its exact source coefficient; complete schedules and single hits share ordinary AST. */
export function preparePeriodicOrdinaryCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = periodicOrdinaryCastContextSchema.parse(game.periodicOrdinaryCast ?? {});
  game.periodicOrdinaryCast = context;
  const selected = new Set(result.selectedHitIds), oldHits = result.hits;
  const selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previousRole = (role: string) => [...old.values()].find(hit => !hit.periodicOrdinaryEvent && roleOf(cast, hit) === role);
  const representatives = () => Object.keys(cast.roles).map(role => canonicalHit(result, cast, role, context, previousRole(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(refsOf))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源完整普通施放；来源排程只生成机会，实际接触逐项确认。", sourceRefs: refs });
  const missing = oldHits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  if (game.constellation !== 0) missing.push("此来源分支只支持C0，不省略高命座额外伤害与状态变化。");
  if (game.effectiveTalentLevel > 15) missing.push("有效等级须在固定来源1至15级范围内。");
  if (result.scope === "single-hit") {
    result.hits = old.size ? [...old.values()].map(hit => {
      const role = roleOf(cast, hit);
      if (!role || !cast.roles[role]) return hit;
      const saved = hit.periodicOrdinaryEvent;
      return canonicalHit(result, cast, role, context, hit, saved ? { id: saved.candidateId, templateRole: saved.templateRole, frame: saved.frame, snapshotFrame: saved.snapshotFrame, snapshotId: saved.snapshotId, targetId: saved.targetId,
        ...(saved.laumaOwnShredActive === undefined ? {} : { laumaOwnShredActive: saved.laumaOwnShredActive }) } : undefined);
    }) : representatives();
  } else {
    const schedule = compilePeriodicOrdinarySchedule(cast.skillId as PeriodicOrdinaryCastKind, context);
    missing.push(...schedule.issues);
    if (context.statsStableAcrossHits !== true && schedule.instances.some(event => !context.snapshots?.[event.snapshotId])) missing.push("须声明共用面板在全部取样时点稳定，或提供每个实际命中的完整历史快照。");
    result.hits = schedule.complete ? schedule.instances.map(event => {
      const previous = old.get(`${cast.skillId}:${event.id}`), seed = previous ?? previousRole(event.templateRole);
      if (!previous && seed?.finalSnapshot && !context.snapshots?.[event.snapshotId]) missing.push("新命中不能借用原单击的最终快照；请重新应用配装或提供实际取样面板。");
      return canonicalHit(result, cast, event.templateRole, context, seed, event);
    }) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, kind: "non-damaging", label: "完整施放未命中所选目标", reason: "所有来源候选都明确落空，不补造伤害。", dependencies: [sourceId], sourceRefs: refs }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, issues: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击来源与条件明确。", sourceRefs: refs });
    hits.forEach(hit => hit.dependencies.push(id));
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) if (hit.kind === "ordinary") {
    const issues: string[] = [], state = { ...context.sharedState, ...context.hitStates?.[hit.id] };
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, hit, context)) issues.push("已转换的本击事件、面板或来源状态改变；请重新应用配装或导入真实面板，不能复用旧时点已结算数值。");
    if (cast.characterSlug === "ineffa" && result.scope === "single-hit" && state.ineffaA4Inactive !== true && context.ineffa?.burstInactive !== true) issues.push("请明确本击伊涅芙A4精通转化未生效；独立命中不需要未来月感电日程。");
    if (cast.characterSlug === "columbina" && result.scope === "single-hit" && state.columbinaA1Inactive !== true && context.columbina?.noPriorGravityOrA1 !== true) issues.push("请明确本击哥伦比娅没有A1暴击层数；独立命中不需要未来月事件日程。");
    if (cast.characterSlug === "lauma") {
      const ascension = hit.finalSnapshot?.ascension ?? (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
      if (ascension === undefined) issues.push("缺少实际突破阶段，无法判断菈乌玛A4。");
      if (state.includedDamageBonus === undefined) issues.push("请明确本击增伤已包含的菈乌玛A4份额；0表示明确未含。");
      if (ascension !== undefined && ascension >= 4 && context.lauma?.initializationEm === undefined) issues.push("固定来源A4在角色初始化时读取EM一次，需要该实际精通；不能用当前命中面板代替。");
      if (ascension !== undefined && state.includedDamageBonus !== undefined && (ascension < 4 || context.lauma?.initializationEm !== undefined)) {
        const inputs: CalculatorFormula["inputs"] = [{ key: "included", value: state.includedDamageBonus, unit: "ratio", origin: "explicit-accounting", meaningKey: "本击增伤中已经包含的菈乌玛A4份额" }];
        if (ascension >= 4) inputs.push({ key: "initializationEm", value: context.lauma!.initializationEm!, unit: "stat", origin: "explicit-initialization-state", meaningKey: "固定来源A4初始化时的实际精通" });
        hit.damageBonusFormula = { ruleId: `${prefix}lauma-a4`, label: "菈乌玛A4：初始化EM×0.004（上限32%）−已含份额", expression: expr.sub(ascension < 4 ? expr.value(0) : expr.min(expr.mul(expr.input("initializationEm"), expr.value(.004)), expr.value(.32)), expr.input("included")), inputs, sourceRefs: refs };
      }
      const active = hit.periodicOrdinaryEvent?.laumaOwnShredActive ?? state.laumaOwnShredActive;
      if (hit.effectiveResistance === undefined) {
        if (active === undefined) issues.push("独立命中须明确本击伤害前目标是否已有菈乌玛自身减抗；无需补未来日程。");
        if (state.includedResistanceReduction === undefined) issues.push("请明确当前抗性输入已含的菈乌玛减抗份额。");
      }
      if (active !== undefined && state.includedResistanceReduction !== undefined) hit.resistanceReductionFormula = {
        ruleId: `${prefix}lauma-shred`, label: "菈乌玛：伤害前实际减抗−抗性输入已含份额",
        expression: expr.sub(expr.mul(expr.input("active"), expr.input("talentShred")), expr.input("included")),
        inputs: [{ key: "active", value: active ? 1 : 0, unit: "ratio", origin: "source-contact-history", meaningKey: "此前命中回调的减抗仍有效；本击不会追溯享受自己的回调" },
          { key: "talentShred", value: definitions.laumaShredValues[game.effectiveTalentLevel - 1]!, unit: "ratio", origin: "pinned-talent-source", meaningKey: "本级战技的减抗幅度" },
          { key: "included", value: state.includedResistanceReduction, unit: "ratio", origin: "explicit-accounting", meaningKey: "敌方抗性输入已含的菈乌玛减抗份额" }], sourceRefs: refs,
      };
    }
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const relevant = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(row => relevant.has(row.id) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : ready && result.selectedHitIds.length === result.hits.length ? "complete-cast" : "selected-components";
  game.attributionPolicy = "所命名普通条件域中的一次C0施放，来源机会与实际接触逐项区别；不自动生成特殊反应、队伍、附着或产球。";
  return result;
}

export function resetPeriodicOrdinaryPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const cast = templateOf(document); if (!cast) return;
  const context = document.gameContext!.periodicOrdinaryCast ??= {};
  delete context.finalizedHitEvents;
  if (cast.characterSlug !== "lauma") return;
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") state.includedDamageBonus = 0; else delete state.includedDamageBonus;
  }
  if (mode === "fresh-equipment") (context.sharedState ??= {}).includedDamageBonus = 0;
  else if (context.sharedState) delete context.sharedState.includedDamageBonus;
}
export function finalizePeriodicOrdinaryPanelAccounting(document: CalculatorDocument): void {
  if (!isPeriodicOrdinaryCastAction(document)) return;
  const context = document.gameContext!.periodicOrdinaryCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(document, hit, context)]));
}
export function periodicOrdinaryEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.periodicOrdinaryEvent) return [];
  const event = hit.periodicOrdinaryEvent, trace = new TraceBuilder(hit.sourceRefs);
  trace.add(`${prefix}damage-frame`, "来源候选实际命中", expr.input("frame"), [traceInput("frame", event.frame, "frames", "source-schedule", `${event.candidateId}，明确命中${event.targetId}`)], { unit: "frames" });
  trace.add(`${prefix}snapshot-frame`, "本击进攻取样", expr.input("snapshotFrame"), [traceInput("snapshotFrame", event.snapshotFrame, "frames", "source-snapshot", event.snapshotId)], { unit: "frames" });
  return trace.nodes;
}
