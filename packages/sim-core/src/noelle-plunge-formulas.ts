import definitions from "../../game-data/sources/noelle-plunge-casts/definitions.json";
import type { NoellePlungeTemplate } from "../../game-data/src/character-mappings/noelle-plunge-mappings";
import { noellePlungeCastContextSchema, type NoellePlungeCastContext, type CalculatorDocument, type CalculatorHit } from "./calculator-model";
import { compileNoellePlungeSchedule, type NoellePlungeCastKind, type NoellePlungeHitInstance } from "./noelle-plunge-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
type Role = "collision" | "landing";
const templates = definitions.templates as NoellePlungeTemplate[], prefix = "noelle-plunge:", sourceId = `${prefix}source`;
const templateOf = (doc: CalculatorDocument) => templates.find(row => row.skillId === doc.gameContext?.skillId);
export const isNoellePlungeCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const roleOf = (cast: NoellePlungeTemplate, hit: OrdinaryHit): Role | undefined => hit.noellePlungeEvent?.templateRole ?? (Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0] as Role | undefined);
function identity(doc: CalculatorDocument, context: NoellePlungeCastContext, hit: OrdinaryHit): string {
  const event = hit.noellePlungeEvent;
  return JSON.stringify({ event: event ?? `independent:${hit.id}`, snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null,
    talent: doc.gameContext?.effectiveTalentLevel, constellation: doc.gameContext?.constellation, burstInactive: context.burstInactive,
    noExternalInfusion: context.noExternalInfusion, statsStableAcrossHits: context.statsStableAcrossHits });
}
function canonical(doc: CalculatorDocument, cast: NoellePlungeTemplate, roleKey: Role, context: NoellePlungeCastContext, previous?: OrdinaryHit, event?: NoellePlungeHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey], id = event && doc.scope !== "single-hit" ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const hit: OrdinaryHit = { ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary", label: role.label + (event ? ` · 第${event.frame}帧` : " · 独立实际命中"),
    element: "physical", attackTag: "plunge", terms: [{ stat: "atk", coefficient: role.values[doc.gameContext!.effectiveTalentLevel - 1] ?? role.values[0]! }],
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0, critEligible: true,
    reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    dependencies: [sourceId], sourceRefs: role.sourceRefs,
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula; delete hit.resistanceReductionFormula;
  delete hit.critRateFormula; delete hit.critDamageFormula; delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment;
  delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.observedEntityEvent; delete hit.idleStanceEvent; delete hit.occurrence;
  if (event) {
    const { id: candidateId, ...metadata } = event; hit.noellePlungeEvent = { candidateId, ...metadata };
    const snapshot = context.snapshots?.[event.snapshotId];
    const current = previous?.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitEvents?.[id] === identity(doc, context, hit);
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot); else if (!current) delete hit.finalSnapshot;
    if (JSON.stringify(previous?.noellePlungeEvent) !== JSON.stringify(hit.noellePlungeEvent) || snapshot && JSON.stringify(snapshot) !== JSON.stringify(previous?.finalSnapshot)) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  }
  return hit;
}
export function prepareNoellePlungeCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document); if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!, context = noellePlungeCastContextSchema.parse(game.noellePlungeCast ?? {}); game.noellePlungeCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previous = (role: Role) => [...old.values()].find(hit => !hit.noellePlungeEvent && roleOf(cast, hit) === role);
  const representatives = () => (["collision", "landing"] as const).map(role => canonical(result, cast, role, context, previous(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(role => role.sourceRefs))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源真实AirborneXianyun资格下的完整观察下落；来源一致不等于游戏内实测。", sourceRefs: refs });
  const missing = oldHits.filter((hit): hit is Extract<CalculatorHit, { kind: "blocked" }> => hit.kind === "blocked" && selected.has(hit.id)).flatMap(hit => hit.reasons);
  if (game.constellation !== 0) missing.push("此下落来源协议只支持明确C0。");
  if (game.effectiveTalentLevel > 15) missing.push("有效普攻天赋超过固定来源15级。");
  if (context.burstInactive !== true) missing.push("需要明确本击Q大扫除未激活；不能把岩附魔或DEF转ATK当作此物理分支。");
  if (context.noExternalInfusion !== true) missing.push("需要明确本击没有外部附魔。");
  if (result.scope === "single-hit") result.hits = old.size ? [...old.values()].map(hit => {
    const role = roleOf(cast, hit); if (!role) return hit;
    const saved = hit.noellePlungeEvent; if (!saved) return canonical(result, cast, role, context, hit);
    const { candidateId: id, ...metadata } = saved; return canonical(result, cast, role, context, hit, { id, ...metadata });
  }) : representatives();
  else {
    const schedule = compileNoellePlungeSchedule(cast.skillId as NoellePlungeCastKind, context); missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonical(result, cast, event.templateRole, context, old.get(`${cast.skillId}:${event.id}`) ?? previous(event.templateRole), event)) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "本次完整下落未命中所选敌人", kind: "non-damaging", reason: "碰撞与落地机会均已明确，本目标没有实际伤害。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, reasons: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "实际来源状态、接触与本击快照明确。", sourceRefs: refs }); hits.forEach(hit => hit.dependencies.push(id));
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) if (hit.kind === "ordinary") {
    const issues: string[] = [], event = hit.noellePlungeEvent;
    if (!roleOf(cast, hit)) issues.push("所选命中没有此完整下落的有效来源角色。");
    if (event) {
      const expected = event.templateRole === "collision" ? 33 : cast.skillId === "noelle-plunge-high-observed-c0" ? 42 : 39;
      if (event.frame !== expected || event.snapshotFrame !== expected) issues.push("本击事件时点与当前低／高下落分支的固定伤害及取样帧不符。");
      if (context.targetId && event.targetId !== context.targetId) issues.push("本击保存的目标与当前所选敌人不同，不能沿用旧观察。");
    }
    if (hit.reaction !== "none" || hit.additiveReaction !== undefined) issues.push("本物理伤害不能指定元素增幅或激化；碎冰反应本体属于另一个伤害事件。");
    if (event && result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) issues.push(`缺少本击实际进攻快照${event.snapshotId}，不能借用另一时点面板。`);
    if (event && result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot && !context.snapshots?.[event.snapshotId]) issues.push("先前实际快照已经移除或失效；不能静默改用当前面板，请恢复本击快照。");
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) issues.push("本击来源事件、快照或状态变化，旧物化属性不能沿用，请重新应用构筑或导入实际快照。");
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const chosen = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : chosen.length === result.hits.length && !chosen.some(hit => hit.dependencies.some(id => result.dependencies.find(row => row.id === id)?.status === "missing")) ? "complete-cast" : "selected-components";
  game.attributionPolicy = "本次低／高空下落包含实际发生的33帧路径碰撞与39／42帧落地冲击；只计算物理本体，碎冰及队友追加伤害独立归属。单击只需本击状态，不依赖未来落地记录。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("诺艾尔下落协议：")), "诺艾尔下落协议：C0、Q未激活、无外部附魔；完整动作要求实际AirborneXianyun资格、返回Grounded、独立碰撞选择及全部接触观察。", "诺艾尔下落协议：碰撞和落地分别读取33及39／42帧进攻快照；源码Grounded闭环在下落入口返回时执行，不推定其他腾空来源。"];
  return result;
}
export function resetNoellePlungePanelAccounting(document: CalculatorDocument, _mode: "fresh-equipment" | "imported-final"): void {
  if (!isNoellePlungeCastAction(document)) return;
  const context = document.gameContext!.noellePlungeCast ??= {}; delete context.finalizedHitEvents;
  for (const hit of document.hits) if (hit.kind === "ordinary" && hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
}
export function finalizeNoellePlungePanelAccounting(document: CalculatorDocument): void {
  if (!isNoellePlungeCastAction(document)) return;
  const context = document.gameContext!.noellePlungeCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(document, context, hit)]));
}
export function noellePlungeEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.noellePlungeEvent) return [];
  const event = hit.noellePlungeEvent, trace = new TraceBuilder(hit.sourceRefs);
  for (const [key, value, label] of [["frame", event.frame, "下落本击实际帧"], ["snapshotFrame", event.snapshotFrame, "本击独立进攻取样帧"]] as const) trace.add(`noelle-plunge.${key}`, label, expr.input(key), [traceInput(key, value, "frames", "fixed-source-plunge-observation", `${event.candidateId}，目标${event.targetId}`)], { unit: "frames" });
  return trace.nodes;
}
