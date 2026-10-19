import type { CalculatorDocument } from "./calculator-model";
import type { ObservedCompositionAnalysis, ObservedCompositionOpportunity, ObservedSkillCompositionDocument } from "./observed-skill-composition";
import { linneaObservedContextSchema, type LinneaObservedContext, type LinneaObservedEvent } from "./linnea-observed-context";
import { LINNEA_OBSERVED_SOURCE_REFS, resolveLinneaObservedLifecycle } from "./linnea-observed-lifecycle";

type LinneaComposition = Extract<ObservedSkillCompositionDocument, { profile: "linnea-lumi" }>;
type Attack = Extract<LinneaObservedEvent, { kind: "attack-contact" }>;
type Departure = Extract<LinneaObservedEvent, { kind: "depart-observed" | "expire-observed" }>;

const skillFor = {
  "pummeler-1": "linnea-lumi-pummeler-pair",
  "pummeler-2": "linnea-lumi-pummeler-pair",
  hammer: "linnea-lumi-heavy-overdrive-hammer-component",
  crush: "linnea-lumi-million-ton-crush-component",
} as const;
const labelFor = {
  "pummeler-1": "露米普通双击第一段",
  "pummeler-2": "露米普通双击第二段",
  hammer: "露米超强形态重锤",
  crush: "露米究极形态百万吨重压",
} as const;

/** A full episode is declared by the user and ends only at an observed departure. */
export function analyzeLinneaComposition(doc: LinneaComposition): ObservedCompositionAnalysis {
  const context = linneaObservedContextSchema.parse(doc.context);
  const issues: string[] = [], warnings: string[] = [];
  const nonDamageNotes = [
    "战技召唤、连续按键喂食及提高抗打断不构成独立伤害段。",
    "爆发召唤／重置露米的治疗另属治疗结果；本组成仅计算露米对所选目标的伤害。",
    "实际攻击次数、首击与间隔只从用户事件读取，供给阈值不推断；25秒持续时间不用于生成攻击。",
  ];
  const originIndex = context.events.findIndex(event => event.id === doc.originEventId);
  const endIndex = doc.endEventId === undefined ? -1 : context.events.findIndex(event => event.id === doc.endEventId);
  if (originIndex < 0) issues.push(`找不到露米召唤起点 ${doc.originEventId}。`);
  if (doc.endEventId !== undefined && endIndex < 0) issues.push(`找不到露米离场终点 ${doc.endEventId}。`);
  if (endIndex >= 0 && originIndex >= endIndex) issues.push("露米实际离场必须晚于本次召唤。");
  const origin = originIndex < 0 ? undefined : context.events[originIndex];
  const originIsSkill = origin?.kind === "skill-tap" && origin.observedEffect === "summon";
  const originIsBurst = origin?.kind === "burst-cast";
  if (!originIsSkill && !originIsBurst) issues.push("起点必须是本次实际 E 或 Q 召唤，不是喂食或已有露米的 Q 重置。");
  const originSummonId = originIsSkill || originIsBurst ? origin.summonId : undefined;
  const terminal = endIndex < 0 ? undefined : context.events[endIndex];
  const terminalIsDeparture = terminal?.kind === "depart-observed" || terminal?.kind === "expire-observed";
  if (doc.damageWindowClosed && !terminalIsDeparture) issues.push("完整伤害窗口必须以实际离场事件关闭；声明结束帧本身不构成离场。");
  if (terminalIsDeparture && originSummonId !== terminal.summonId) issues.push("离场事件不属于本次召唤的露米。");
  if (!doc.damageWindowClosed) warnings.push("伤害窗口尚未声明关闭；只展示已记录组成。");
  if (!doc.allOpportunitiesRecorded) warnings.push("未确认本次露米对所选目标的全部攻击机会；不能称完整召唤。");

  const replay = resolveLinneaObservedLifecycle(context, endIndex >= 0 ? doc.endEventId : undefined);
  issues.push(...replay.issues);
  if (originIsBurst && originIndex > 0 && replay.records[originIndex - 1]?.lumiPresent)
    issues.push("所选 Q 起点发生时露米已在场，实际为重置而非新召唤。");
  if (originIsSkill && originIndex > 0 && replay.records[originIndex - 1]?.lumiPresent)
    issues.push("所选 E 起点发生时露米已在场，不能重复归为新召唤。");

  const windowEvents = originIndex >= 0
    ? context.events.slice(originIndex, endIndex >= originIndex ? endIndex + 1 : context.events.length)
    : [];
  const departures = windowEvents.filter((event): event is Departure => event.kind === "depart-observed" || event.kind === "expire-observed");
  if (terminalIsDeparture && departures.length !== 1) issues.push("一次召唤必须以首个实际离场事件结束，不能跨越第二次召唤。");
  const wrongSummon = windowEvents.filter(event => "summonId" in event && event.summonId !== originSummonId);
  if (wrongSummon.length) issues.push(`窗口内有其他露米身份：${wrongSummon.map(event => event.id).join("、")}。`);

  const attacks = windowEvents.filter((event): event is Attack => event.kind === "attack-contact");
  const targetAttacks = attacks.filter(event => event.targetId === doc.targetId);
  const targetAttackIds = new Set(targetAttacks.map(event => event.attackId));
  const otherTargetOnly = [...new Set(attacks.map(event => event.attackId))].filter(id => !targetAttackIds.has(id));
  if (otherTargetOnly.length) {
    const message = `以下露米攻击只记录其他目标，缺少对所选目标 ${doc.targetId} 的接触／落空结果：${otherTargetOnly.join("、")}。`;
    (doc.allOpportunitiesRecorded ? issues : warnings).push(message);
  }

  const pairs = new Map<string, Attack[]>();
  for (const event of targetAttacks) {
    if (event.component !== "pummeler-1" && event.component !== "pummeler-2") continue;
    if (!event.pairId) { issues.push(`${event.id}普通双击缺少实际 pairId。`); continue; }
    const pair = pairs.get(event.pairId) ?? [];
    pair.push(event); pairs.set(event.pairId, pair);
  }
  for (const [pairId, pair] of pairs) {
    const first = pair.filter(event => event.component === "pummeler-1");
    const second = pair.filter(event => event.component === "pummeler-2");
    const reason = `普通双击 ${pairId} 需要不同攻击身份的第一、第二段各一次，落空段也须记录。`;
    if (first.length > 1 || second.length > 1 || first[0] && second[0] && first[0].attackId === second[0].attackId)
      issues.push(reason);
    else if (first.length !== 1 || second.length !== 1)
      (doc.allOpportunitiesRecorded ? issues : warnings).push(reason);
  }
  for (const event of targetAttacks) {
    if (!event.contactConfirmed) continue;
    const record = replay.records.find(row => row.eventId === event.id);
    if (!record?.lumiPresent || record.form === null) issues.push(`${event.id}没有可归属的在场露米。`);
    if (event.component === "hammer" && (record?.form !== "super-power" || !event.nearbyMoondrift))
      issues.push(`${event.id}重锤缺少实际超强形态或附近月笼。`);
    if (event.component === "crush" && record?.form !== "ultimate-power")
      issues.push(`${event.id}重压缺少实际究极形态。`);
    // A1 range is a hit-time resistance condition, not a damage-contact gate.
  }

  const opportunities: ObservedCompositionOpportunity[] = targetAttacks.map(event => ({
    eventId: event.id, frame: event.frame, label: labelFor[event.component], contact: event.contactConfirmed,
    sourceSkillId: skillFor[event.component], sourceRefs: LINNEA_OBSERVED_SOURCE_REFS,
  }));
  const qIntervention = windowEvents.some(event => event.kind === "burst-cast" && event.id !== doc.originEventId);
  if (qIntervention) nonDamageNotes.push("此露米寿命含后续 Q 重置；Q 治疗不计入伤害，重置后的露米伤害标为有 Q 干预的实际召唤窗口。");
  const closed = doc.damageWindowClosed && terminalIsDeparture && terminal.summonId === originSummonId && departures.length === 1;
  const completeCastEligible = closed && doc.allOpportunitiesRecorded && issues.length === 0 && doc.unmappedOpportunities.length === 0 && !qIntervention;
  const originName = originIsBurst ? "Q" : "E";
  const attributionPolicy = qIntervention
    ? `一次由 ${originName} 召唤的露米实体实际寿命，含后续 Q 重置；仅选定目标的露米普通／月结晶攻击，非纯一次 ${originName} 施放。`
    : `一次由 ${originName} 召唤的露米实体实际寿命；仅选定目标的露米普通／月结晶攻击，不包含队友或装备独立伤害。`;
  return { opportunities, issues: [...new Set(issues)], warnings: [...new Set(warnings)], closed, completeCastEligible, attributionPolicy, nonDamageNotes };
}

/** Bind one positive contact to one child; the outer composition owns completeness. */
export function bindLinneaCompositionComponent(child: CalculatorDocument, context: LinneaObservedContext, eventId: string): CalculatorDocument {
  const event = context.events.find(row => row.id === eventId);
  if (!event || event.kind !== "attack-contact") throw new Error(`Linnea component ${eventId} is not an observed attack.`);
  if (!event.contactConfirmed) throw new Error(`Linnea component ${eventId} missed its target and has no damage child.`);
  const result = structuredClone(child);
  if (!result.gameContext) throw new Error("Linnea composition child has no source game context.");
  const skillId = skillFor[event.component];
  if (result.gameContext.skillId !== skillId) throw new Error(`${eventId} requires ${skillId}, not ${result.gameContext.skillId}.`);
  if (event.component === "pummeler-1" || event.component === "pummeler-2") {
    if (result.hits.length !== 2 || result.hits.some(hit => hit.kind !== "ordinary"))
      throw new Error("A Pummeler child must retain both source ordinary hit definitions.");
    const index = event.component === "pummeler-1" ? 0 : 1;
    const hit = result.hits[index]!;
    result.scope = "single-hit";
    result.selectedHitIds = [hit.id];
    result.gameContext.scopeCoverage = "single-hit";
    result.gameContext.attributionPolicy = `露米普通双击 ${event.pairId} 的实际${index + 1}段，仅计算对 ${event.targetId} 的接触。`;
    result.gameContext.observedLinneaLifecycle = { ...structuredClone(context), selectedEventId: undefined, hitBindings: { [hit.id]: eventId } };
  } else {
    result.scope = "single-hit";
    result.gameContext.scopeCoverage = "single-hit";
    result.gameContext.observedLinneaLifecycle = { ...structuredClone(context), selectedEventId: eventId, hitBindings: {} };
  }
  return result;
}
