import definitions from "../../game-data/sources/coordinated-casts/definitions.json";
import type { CoordinatedCastRole, CoordinatedCastTemplate } from "../../game-data/src/character-mappings/coordinated-cast-mappings";
import { coordinatedCastContextSchema, type CalculatorDocument, type CalculatorHit, type CoordinatedCastContext } from "./calculator-model";
import { compileSchedule, type CoordinatedCastKind, type CoordinatedHitInstance } from "./coordinated-cast-schedule";
import { prepareCoordinatedHitPassive } from "./coordinated-cast-passives";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as CoordinatedCastTemplate[];
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const prefix = "coordinated-context:";
const sourceId = `${prefix}source`;
const notePrefix = "显式协同日程：";
const templateFor = (document: CalculatorDocument) => templates.find(row => row.skillId === document.gameContext?.skillId);
export const isCoordinatedCastAction = (document: CalculatorDocument): boolean => templateFor(document) !== undefined;
const roleOf = (hit: CalculatorHit): "initial" | "proc" => hit.kind === "ordinary" && hit.coordinatedEvent ? hit.coordinatedEvent.templateRole : hit.id.endsWith("-initial") ? "initial" : "proc";
const refsOf = (role: CoordinatedCastRole) => role.sourceRefs.map(path => path.startsWith("https://") ? path : sourceRoot + path);
const ascensionOf = (doc: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
const eventIdentity = (event: NonNullable<OrdinaryHit["coordinatedEvent"]>) => JSON.stringify([
  event.templateRole, event.frame, event.snapshotFrame, event.snapshotId,
  event.targetId, event.projectile, event.trigger.kind, event.trigger.eventId,
  event.trigger.frame, event.trigger.actorId,
]);
const hitEventIdentity = (hit: OrdinaryHit) => hit.coordinatedEvent ? eventIdentity(hit.coordinatedEvent) : `independent-single-hit:${hit.id}`;

/** Rebuild coefficients and provenance from the pinned role, never trust an imported generated count. */
function makeHit(doc: CalculatorDocument, cast: CoordinatedCastTemplate, role: CoordinatedCastRole, templateRole: "initial" | "proc", context: CoordinatedCastContext, id: string, previous: OrdinaryHit | undefined, instance?: CoordinatedHitInstance): OrdinaryHit {
  const level = templateRole === "proc" && cast.procTalent === "skill" ? context.skillTalentLevel : doc.gameContext!.effectiveTalentLevel;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}),
    id, label: `${role.label}${instance ? ` · ${instance.frame}帧（${instance.trigger.eventId}·第${instance.projectile}击）` : " · 已发生的独立单击"}`,
    kind: "ordinary", element: role.element, attackTag: role.attackTag,
    terms: role.terms.map(term => ({ stat: term.stat, coefficient: term.values[(level ?? doc.gameContext!.effectiveTalentLevel) - 1] ?? term.values[0]!, ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }) })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    sourceRefs: refsOf(role), dependencies: [sourceId],
  };
  // Imported coefficients/formulas may be editable data, but cannot change this source protocol.
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment; delete hit.occurrence;
  if (instance) {
    const { id: _id, ...event } = instance;
    hit.coordinatedEvent = event;
    const sameEvent = previous?.coordinatedEvent && eventIdentity(previous.coordinatedEvent) === eventIdentity(event);
    if (previous && (previous.id !== id || previous.coordinatedEvent && !sameEvent)) {
      delete hit.finalSnapshot; delete hit.effectiveCritRate; delete hit.effectiveCritDamage;
      // Keep the original additive-base bookkeeping until a fresh equipment reset restores its inputs.
      delete hit.effectiveResistance;
    }
    // An edited explicit snapshot is authoritative; only otherwise retain a matching converted snapshot.
    if (context.snapshots?.[event.snapshotId]) hit.finalSnapshot = structuredClone(context.snapshots[event.snapshotId]!);
  } else if (id === role.mappingId) delete hit.coordinatedEvent;
  if (cast.reposition && templateRole === "initial" && context.dehyaPriorSnapshot) hit.finalSnapshot = structuredClone(context.dehyaPriorSnapshot);
  return hit;
}

/** Compile a finite observed schedule into individual ordinary hits; this does not execute a team simulation. */
export function prepareCoordinatedCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateFor(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = coordinatedCastContextSchema.parse(game.coordinatedCast ?? {});
  game.coordinatedCast = context;
  const oldHits = result.hits, oldSelected = new Set(result.selectedHitIds);
  const selectedAll = oldSelected.size === oldHits.length;
  const oldById = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const originalBlockers = oldHits.filter(hit => hit.kind === "blocked").flatMap(hit => hit.reasons);
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  const refs = [...new Set([...(cast.initial ? refsOf(cast.initial) : []), ...refsOf(cast.proc)])];
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定源码的逐级系数与显式日程协议；每个实际触发独立生成伤害，不推断最大次数或团队自动状态。", sourceRefs: refs });
  const issues: string[] = [...originalBlockers];
  if (game.constellation !== 0) issues.push("此日程只支持明确C0，不能略去高命座的伤害、持续时间或触发变化。");
  if (game.effectiveTalentLevel > 15) issues.push("所选有效天赋等级超出固定来源的1至15级。");
  const rolePrevious = (role: "initial" | "proc") => [...oldById.values()].find(hit => roleOf(hit) === role && !hit.coordinatedEvent);
  const representativeHits = () => [
    ...(cast.initial ? [makeHit(result, cast, cast.initial, "initial", context, cast.initial.mappingId, rolePrevious("initial"))] : []),
    makeHit(result, cast, cast.proc, "proc", context, cast.proc.mappingId, rolePrevious("proc")),
  ];
  if (result.scope === "single-hit") {
    // Already-triggered single hits keep their own numerical inputs and require no future schedule.
    result.hits = oldHits.some(hit => hit.kind === "ordinary") ? [...oldById.values()].map(previous => {
      const role = roleOf(previous), template = role === "initial" ? cast.initial : cast.proc;
      return template ? makeHit(result, cast, template, role, context, previous.id, previous, previous.coordinatedEvent ? { id: previous.id, ...previous.coordinatedEvent } as CoordinatedHitInstance : undefined) : previous;
    }) : representativeHits();
    result.selectedHitIds = result.hits.some(hit => oldSelected.has(hit.id)) ? [result.hits.find(hit => oldSelected.has(hit.id))!.id] : [result.hits[0]!.id];
    game.scopeCoverage = "single-hit";
  } else {
    const schedule = compileSchedule(cast.skillId as CoordinatedCastKind, context);
    issues.push(...schedule.issues);
    if (schedule.instances.length > 1000) issues.push("当前文档最多保存1000个独立命中；请拆分观察范围，不能压缩成倍率次数。");
    if (context.statsStableAcrossHits !== true) issues.push("完整日程要求本次各取样时点的基础面板、装备条件及命中时反应属性稳定；已列逐击被动差异另行计算，历史迪希雅领域快照除外。");
    if (cast.sourceSlug === "yoimiya" && context.yoimiyaA1Inactive !== true) issues.push("此完整分支要求宵宫A1火伤叠层未激活；不能以稳定面板隐藏日程中旧叠层到期。");
    // Incomplete schedules retain honest coefficient templates so the independent single-hit entry remains available.
    result.hits = schedule.complete && schedule.instances.length <= 1000
      ? schedule.instances.map(instance => {
        const role = instance.templateRole === "initial" ? cast.initial! : cast.proc;
        const previous = oldById.get(instance.id), seed = previous ?? rolePrevious(instance.templateRole);
        if (!previous && seed?.finalSnapshot && !context.snapshots?.[instance.snapshotId] && !(cast.reposition && instance.templateRole === "initial" && context.dehyaPriorSnapshot)) {
          issues.push("新生成命中不能继承先前单击已结算快照；请为该日程恢复实际快照或重新应用构筑后填写面板条件。");
          // Retain the stale-panel boundary across repeated preparation, rather than losing it with the seed row.
          context.finalizedHitEvents ??= Object.fromEntries([...oldById.values()].map(hit => [hit.id, hitEventIdentity(hit)]));
        }
        return makeHit(result, cast, role, instance.templateRole, context, instance.id, seed, instance);
      }) : representativeHits();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-damage`, label: "本次完整日程没有产生伤害", kind: "non-damaging", reason: "已明确的事件记录未产生合格追击；不虚构一次伤害或最大触发次数。", dependencies: [sourceId], sourceRefs: refs }];
    const retained = result.hits.filter(hit => oldSelected.has(hit.id)).map(hit => hit.id);
    result.selectedHitIds = selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
    game.scopeCoverage = schedule.complete && !issues.length && result.selectedHitIds.length === result.hits.length ? "complete-cast" : "selected-components";
  }
  const addDependency = (id: string, reasons: string[], targets: CalculatorHit[]) => {
    for (const hit of targets) hit.dependencies.push(id);
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "实际触发、取样来源及本击被动记账已明确；固定来源条件数值，不是完整游戏验证。", sourceRefs: refs });
  };
  addDependency(`${prefix}schedule`, issues, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const role = roleOf(hit), reasons: string[] = [];
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== hitEventIdentity(hit)) reasons.push("日程修改后，本击与已转换面板的原事件不再一致；请重新应用构筑或导入实际最终面板，不能沿用旧时点已结算的增伤、反应和目标抗性。");
    const state = { ...context.sharedState, ...context.hitStates?.[hit.id] };
    if (role === "proc" && cast.procTalent === "skill" && context.skillTalentLevel === undefined) reasons.push("菲谢尔Q后的奥兹使用E天赋；缺少独立有效E等级，不能沿用Q等级。");
    if (cast.reposition && role === "initial" && !context.dehyaPriorSnapshot) reasons.push("迪希雅重新放置的初击需要原领域完整进攻快照，不能用当前面板替代历史快照。");
    if (cast.sourceSlug === "yelan" && role === "initial") {
      const castHp = state.yelanInitialCastHp ?? context.snapshots?.["cast:0"]?.stats.hp;
      if (castHp !== undefined) hit.baseDamageFormula = {
        ruleId: "coordinated-yelan-initial-cast-hp", label: "夜兰初击：施放第0帧最大生命×本级Q倍率；其他进攻属性在第76帧取样",
        expression: expr.mul(expr.input("yelanInitialCastHp"), expr.input("yelanInitialCoefficient")),
        inputs: [{ key: "yelanInitialCastHp", value: castHp, unit: "stat", meaningKey: "第0帧施放时实际最大生命", origin: "explicit-source-scaling-snapshot", minimum: 0 }, { key: "yelanInitialCoefficient", value: cast.initial!.terms[0]!.values[game.effectiveTalentLevel - 1]!, unit: "ratio", meaningKey: "固定来源本级Q初击生命倍率", origin: "source-table" }],
        requirements: { maximumConstellation: 0, elements: ["hydro"], attackTags: ["burst"] }, sourceRefs: hit.sourceRefs,
      };
      else if (context.statsStableAcrossHits !== true) reasons.push("夜兰初击的生命基数取施放第0帧，其他进攻属性取第76帧；须明确第0帧最大生命，或确认两时点生命与基础面板稳定。");
    }
    const passive = prepareCoordinatedHitPassive({ sourceSlug: cast.sourceSlug, role, frame: hit.coordinatedEvent?.frame, ascension: ascensionOf(result, hit), context, hit });
    reasons.push(...passive.issues);
    if (passive.formula) hit.damageBonusFormula = passive.formula;
    addDependency(`${prefix}${hit.id}`, reasons, [hit]);
  }
  if (result.hits.some(hit => hit.dependencies.some(id => result.dependencies.find(row => row.id === id)?.status === "missing"))) game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : "selected-components";
  game.attributionPolicy = "显式事件日程条件下的一次自身施放；每个追击与尾段独立计算。仅单击时以该击已经实际发生为前提，不要求未来日程；不自动模拟团队、能量、附着或空间。";
  result.assumptions = [...result.assumptions.filter(note => !note.startsWith(notePrefix)), `${notePrefix}事件记录与实际命中确认由使用者提供，核心逐项检查资格、冷却、生命周期和已发出伤害尾段；没有把持续时间除以周期当作实际触发数。`, `${notePrefix}当前只支持C0及明确列出的稳定上下文。来源角色被动按每击实际份额减去已含份额；反应的实际EM与加成不能被旧进攻快照自动替代。`];
  return result;
}

export function resetCoordinatedPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isCoordinatedCastAction(document)) return;
  const context = document.gameContext!.coordinatedCast ??= {};
  delete context.finalizedHitEvents;
  const shared = { ...context.sharedState };
  context.hitStates ??= {};
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates[hit.id] ??= { ...shared };
    if (hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion") continue;
    if (mode === "fresh-equipment") state.includedDamageBonus = 0;
    else delete state.includedDamageBonus;
  }
  if (mode === "fresh-equipment") (context.sharedState ??= {}).includedDamageBonus = 0;
  else if (context.sharedState) delete context.sharedState.includedDamageBonus;
}

/** Conversion resolves equipment/manual values, while own passive formulas remain executable deltas. */
export function finalizeCoordinatedPanelAccounting(document: CalculatorDocument): void {
  const context = document.gameContext?.coordinatedCast;
  if (!templateFor(document) || !context) return;
  context.finalizedHitEvents = {};
  for (const hit of document.hits) {
    if (hit.kind === "ordinary") context.finalizedHitEvents[hit.id] = hitEventIdentity(hit);
  }
  // Do not certify actualBonus as included: resolveCalculatorHitDamageBonus does not materialize damageBonusFormula.
  // Persist event identities so changing a converted schedule cannot silently reuse old finalized per-hit values.
}

export function coordinatedEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.coordinatedEvent) return [];
  const event = hit.coordinatedEvent, trace = new TraceBuilder(hit.sourceRefs);
  trace.add("coordinated.damage-frame", "本击事件时点", expr.add(expr.input("triggerFrame"), expr.input("deliveryDelay")), [traceInput("triggerFrame", event.trigger.frame, "frames", "explicit-compiled-event", `触发记录 ${event.trigger.eventId}`), traceInput("deliveryDelay", event.frame - event.trigger.frame, "frames", "pinned-source-schedule", "来源排程到实际伤害的延迟")], { unit: "frames", applicabilityReason: `${event.trigger.kind}；触发角色 ${event.trigger.actorId ?? "来源施放者"}；同次第${event.projectile}击；目标 ${event.targetId}` });
  trace.add("coordinated.snapshot-frame", "本击进攻快照时点", expr.input("snapshotFrame"), [traceInput("snapshotFrame", event.snapshotFrame, "frames", "pinned-source-snapshot-policy", event.snapshotId)], { unit: "frames", applicabilityReason: "此时点记录来源取样规则；完整分支仍要求明确稳定面板，历史领域另有完整快照。" });
  return trace.nodes;
}
