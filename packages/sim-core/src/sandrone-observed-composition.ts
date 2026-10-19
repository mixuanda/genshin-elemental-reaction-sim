import type { CalculatorDocument } from "./calculator-model";
import type { ObservedCompositionAnalysis, ObservedSkillCompositionDocument } from "./observed-skill-composition";
import { sandroneObservedLifecycleSchema, type SandroneObservedLifecycle } from "./sandrone-observed-context";
import { bindSandroneObservedHit, reduceSandroneObservedLifecycle, SANDRONE_OBSERVED_SOURCE_REFS } from "./sandrone-observed-lifecycle";

type SandroneComposition = Extract<ObservedSkillCompositionDocument, { profile: "sandrone-fagio-window" }>;
const chargedKinds = new Set(["sweep", "beam", "overdrive"]);
const terminalKinds = new Set(["window-end", "window-cancel"]);
const labels = { sweep: "重击扫射", beam: "重击凝聚光束", overdrive: "Fagio 超载射击" } as const;
const missedContactIssue = "所选事件没有确认命中目标；不能把一次落空计入伤害。";

/** A user-observed Fagio window; the archive does not establish held-input duration or an attack schedule. */
export function analyzeSandroneComposition(doc: SandroneComposition): ObservedCompositionAnalysis {
  const context = sandroneObservedLifecycleSchema.parse(doc.context);
  const issues: string[] = [], warnings: string[] = [], nonDamageNotes: string[] = [];
  const originIndex = context.events.findIndex((event) => event.id === doc.originEventId);
  const origin = context.events[originIndex];
  if (!origin || origin.kind !== "window-start") issues.push("起点必须绑定实际观察到的 Fagio 重击窗口开始事件。");
  const endIndex = doc.endEventId === undefined ? -1 : context.events.findIndex((event) => event.id === doc.endEventId);
  const end = context.events[endIndex];
  if (doc.endEventId !== undefined && (!end || !terminalKinds.has(end.kind)))
    issues.push("终点必须绑定实际观察到的窗口结束或取消事件。");
  if (end && origin && endIndex <= originIndex) issues.push("观察终点须晚于窗口起点，包括同帧事件的实际顺序。");
  if (!end) warnings.push("尚无实际观察终点；当前只是窗口前缀。");
  if (!doc.damageWindowClosed) warnings.push("尚未确认终点后的相关伤害机会已结束。");
  if (!doc.allOpportunitiesRecorded) warnings.push("尚未确认本目标全部攻击机会与落空均已记录。");
  const validBounds = origin?.kind === "window-start" && end !== undefined && terminalKinds.has(end.kind) && endIndex > originIndex;
  const closed = validBounds && doc.damageWindowClosed;
  const reduction = reduceSandroneObservedLifecycle(context, end?.id);
  issues.push(...reduction.issues);
  const throughIndex = end ? endIndex : context.events.length - 1;
  const windowEvents = originIndex >= 0 ? context.events.slice(originIndex + 1, throughIndex + 1) : [];
  if (windowEvents.some((event) => event.kind === "window-start")) issues.push("同一观察窗口内出现另一开始事件；须先明确前一窗口的真实终点。");
  if (windowEvents.slice(0, -1).some((event) => terminalKinds.has(event.kind)))
    issues.push("所选终点之前已有观察到的结束或取消事件。");
  if (end?.kind === "window-cancel") nonDamageNotes.push("本窗口由实际取消事件终止；完整性仅指已观察的截断窗口。");
  nonDamageNotes.push("超载可作为同一已观察 Fagio 状态窗口的射击；归入同一次按住重击没有来源证据。");
  const eventIds = new Set(windowEvents.map((event) => event.id));
  const opportunities: ObservedCompositionAnalysis["opportunities"] = [];
  for (const hit of reduction.hits) {
    const event = hit.event;
    if (!eventIds.has(event.id)) continue;
    if (!chargedKinds.has(event.hitKind ?? "")) {
      if (event.targetId === doc.targetId)
        nonDamageNotes.push(`${event.id} 为战技棱镜弹或爆发射线；它属于另一动作，不计入 Fagio 重击窗口伤害。`);
      continue;
    }
    if (event.targetId !== doc.targetId) continue;
    issues.push(...hit.issues.filter((issue) => issue !== missedContactIssue).map((issue) => `${event.id}：${issue}`));
    const sourceSkillId = hit.specialComponentId ?? hit.sourceSkillId;
    if (!sourceSkillId)
      issues.push(`${event.id} 缺少与实际状态相符的已映射伤害组成。`);
    opportunities.push({
      eventId: event.id, frame: event.frame,
      label: labels[event.hitKind as keyof typeof labels], contact: event.contact === true,
      sourceSkillId: sourceSkillId ?? `unmapped:sandrone:${event.hitKind}`,
      ...(hit.sourceHitId ? { sourceHitId: hit.sourceHitId } : {}),
      sourceRefs: SANDRONE_OBSERVED_SOURCE_REFS,
    });
  }
  for (const component of doc.components) {
    const event = context.events.find((row) => row.id === component.eventId);
    if (event?.kind === "hit" && !chargedKinds.has(event.hitKind ?? ""))
      issues.push(`${component.eventId} 是战技或爆发组成，不能归属本次 Fagio 重击窗口。`);
  }
  return {
    opportunities, issues: [...new Set(issues)], warnings: [...new Set(warnings)], closed,
    completeCastEligible: false,
    attributionPolicy: "只合计已观察 Fagio 窗口内本目标的重击扫射、凝聚光束和超载射击；不认定同一次持按或通用完整重击机制。",
    nonDamageNotes,
  };
}

/** Bind exactly one actual contact; the ordinary/special child keeps its own calculator math and snapshot. */
export function bindSandroneCompositionComponent(child: CalculatorDocument, raw: SandroneObservedLifecycle, eventId: string): CalculatorDocument {
  const context = sandroneObservedLifecycleSchema.parse(raw);
  const bound = bindSandroneObservedHit(context, eventId);
  if (bound.event.contact !== true || !chargedKinds.has(bound.event.hitKind ?? "") || bound.issues.length)
    throw new Error(`${eventId} 不是状态合法的 Fagio 重击实际接触：${bound.issues.join("；")}`);
  const expectedSkillId = bound.specialComponentId ?? bound.sourceSkillId;
  if (!expectedSkillId || child.gameContext?.skillId !== expectedSkillId)
    throw new Error(`${eventId} 的普通或星反应组成与所选子文档不一致。`);
  const selected = bound.sourceHitId
    ? child.hits.find((hit) => hit.id === bound.sourceHitId)
    : child.hits.length === 1 ? child.hits[0] : undefined;
  if (!selected) throw new Error(`${eventId} 缺少准确的单击子文档。`);
  const result = structuredClone(child);
  result.scope = "single-hit";
  result.selectedHitIds = [selected.id];
  result.gameContext!.scopeCoverage = "single-hit";
  result.gameContext!.sandroneObservedLifecycle = {
    ...structuredClone(context), hitBindings: { [selected.id]: eventId },
  };
  return result;
}
