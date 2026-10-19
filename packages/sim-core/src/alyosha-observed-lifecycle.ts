import { alyoshaObservedContextSchema, type AlyoshaObservedContext, type AlyoshaObservedEvent } from "./alyosha-observed-context";
import params from "../../game-data/sources/optimizer-missing-components/alyosha/raw/libs/gi/stats/Data/Characters/Alyosha/skillParam.json";
import type { CalculatorDocument } from "./calculator-model";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

const base = "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/";
export const ALYOSHA_OBSERVED_SOURCE_REFS = [
  `${base}libs/gi/sheets/src/Characters/Alyosha/index.tsx`,
  `${base}libs/gi/stats/Data/Characters/Alyosha/skillParam.json`,
  `${base}libs/gi/dm-localization/assets/locales/en/char_Alyosha_gen.json`,
  `${base}libs/gi/dm-localization/assets/locales/en/tooltips_gen.json`,
];
const before = (a: { frame: number; order: number }, b: { frame: number; order: number }) => a.frame < b.frame || a.frame === b.frame && a.order < b.order;
type Mark = { appliedAt: number; expiresAt: number };
type Precision = { activatedAt: number; expiresAt: number; attackBonusRatio: number; stellarConductBonus: number };
type Burst = { castAt: number; expiresAt: number; lastFieldAt?: number; lastBiteAt?: number };
export type AlyoshaObservedRecord = {
  eventId: string; kind: AlyoshaObservedEvent["kind"]; frame: number; order: number; targetId?: string;
  effect: string; activatedMark: boolean; attackBonusRatio?: number; stellarConductBonus?: number;
  healing?: { recipientId: string; baseHealing: number };
};
export type AlyoshaObservedResolution = {
  records: AlyoshaObservedRecord[]; issues: string[]; complete: boolean;
  marks: Record<string, Mark>; precision: Record<string, Precision>; activeActorId: string;
};

/** Replays one observed C0 timeline; it never multiplies 14 s by 2 s into invented attacks. */
export function resolveAlyoshaObservedLifecycle(raw: AlyoshaObservedContext, throughEventId?: string): AlyoshaObservedResolution {
  const c = alyoshaObservedContextSchema.parse(raw), issues: string[] = [], records: AlyoshaObservedRecord[] = [];
  const marks = new Map<string, Mark>(), precision = new Map<string, Precision>(), bursts = new Map<string, Burst>();
  const events = [...c.events].sort((a, b) => a.frame - b.frame || a.order - b.order);
  const seenIds = new Set<string>(), seenSlots = new Set<string>(), seenAttacks = new Set<string>();
  let activeActorId = c.initialActiveActorId;
  if (!c.initialMarksKnownClear || !c.initialPrecisionKnownClear || !c.initialBurstKnownClear) issues.push("起点须明确印记、猎人精准及现存Q均为空；已有状态不能默认为零。");
  if (!c.eventsObservedThroughCutoff || !c.observedOrderConfirmed || !c.noHitlag) issues.push("须确认截至截止点的回调完整、同帧顺序与60帧每秒关系。");
  const end = throughEventId === undefined ? events.length - 1 : events.findIndex(e => e.id === throughEventId);
  if (throughEventId !== undefined && end < 0) issues.push(`找不到绑定事件${throughEventId}。`);
  const precisionRatio = params.skill[4]?.[c.skillTalentLevel - 1];
  if (precisionRatio === undefined) issues.push("缺少本次有效E天赋等级的猎人精准攻击百分比。");
  function activate(targetId: string, recipientIds: string[] | undefined, frame: number, eventId: string): boolean {
    if (!recipientIds || recipientIds.length === 0 || new Set(recipientIds).size !== recipientIds.length) {
      issues.push(`${eventId}须记录实际附近队员，且身份不能重复。`); return false;
    }
    marks.delete(targetId);
    for (const recipientId of recipientIds) precision.set(recipientId, { activatedAt: frame, expiresAt: frame + 900, attackBonusRatio: precisionRatio ?? 0, stellarConductBonus: .2 });
    return true;
  }
  function markStatus(targetId: string, event: { frame: number; markActiveAtExpiryBoundary?: boolean; id: string }): boolean {
    const mark = marks.get(targetId); if (!mark) return false;
    if (event.frame < mark.expiresAt) return true;
    if (event.frame > mark.expiresAt) { marks.delete(targetId); return false; }
    if (event.markActiveAtExpiryBoundary === undefined) { issues.push(`${event.id}恰在印记到期帧，须明确回调时印记是否有效。`); return false; }
    if (!event.markActiveAtExpiryBoundary) marks.delete(targetId);
    return event.markActiveAtExpiryBoundary;
  }
  for (const event of end < 0 ? [] : events.slice(0, end + 1)) {
    const at = { frame: c.initialFrame, order: c.initialOrder }, slot = `${event.frame}:${event.order}`;
    if (!before(at, event)) issues.push(`${event.id}不晚于观察起点。`);
    if (seenIds.has(event.id) || seenSlots.has(slot)) issues.push(`${event.id}的身份或同帧顺序重复。`);
    seenIds.add(event.id); seenSlots.add(slot);
    let effect = "", activatedMark = false, healing: AlyoshaObservedRecord["healing"];
    let attackBonusRatio: number | undefined, stellarConductBonus: number | undefined;
    if (event.kind === "burst-cast") {
      if (!event.actionReadyConfirmed || bursts.has(event.burstId)) issues.push(`${event.id}缺少合法且唯一的实际Q施放。`);
      else { bursts.set(event.burstId, { castAt: event.frame, expiresAt: event.frame + 840 }); effect = "实际Q进入14秒生命周期；首击帧和命中数仍由事件给出。"; }
    } else if (event.kind === "field-change") {
      activeActorId = event.activeActorId; effect = `实际前台切换为${activeActorId}。`;
    } else if (event.kind === "mark-apply") {
      if (!event.contactConfirmed) effect = "未接触目标，不施印。";
      else if (markStatus(event.targetId, { id: event.id, frame: event.frame,
        ...(event.markActiveAtExpiryBoundary === undefined ? {} : { markActiveAtExpiryBoundary: event.markActiveAtExpiryBoundary }) })) {
        activatedMark = activate(event.targetId, event.nearbyRecipientIds, event.frame, event.id);
        effect = activatedMark ? "再次施印激活并移除旧印；附近队员取得15秒精准。" : "旧印存在，但缺少激活所需的附近队员记录。";
      } else { marks.set(event.targetId, { appliedAt: event.frame, expiresAt: event.frame + 900 }); effect = "目标取得15秒猎人印。"; }
    } else if (event.kind === "field-attack" || event.kind === "tugarin-attack") {
      const burst = bursts.get(event.burstId);
      if (!burst || event.frame <= burst.castAt || event.frame > burst.expiresAt) issues.push(`${event.id}不属于已记录Q的有效14秒生命周期；到期等号需另有实测，保守视为未知。`);
      if (seenAttacks.has(event.attackId)) issues.push(`${event.id}重复使用一次实际攻击身份。`);
      seenAttacks.add(event.attackId);
      const previous = event.kind === "field-attack" ? burst?.lastFieldAt : burst?.lastBiteAt;
      if (previous !== undefined && event.frame - previous < 120) issues.push(`${event.id}与同类已记录攻击相距不足2秒；须核对实际事件。`);
      if (burst) { if (event.kind === "field-attack") burst.lastFieldAt = event.frame; else burst.lastBiteAt = event.frame; }
      if (event.kind === "field-attack") {
        if (!event.targetEnteredFieldConfirmed) issues.push(`${event.id}缺少目标进入猎场的实际确认。`);
        effect = event.contactConfirmed ? "猎场一次实际接触；使用已有独立普通雷伤组成。" : "猎场一次实际攻击但未接触此目标。";
      } else {
        if (!event.approachedTargetConfirmed) issues.push(`${event.id}缺少图加林接近所选目标的实际确认。`);
        if (event.contactConfirmed && markStatus(event.targetId, { id: event.id, frame: event.frame,
          ...(event.markActiveAtExpiryBoundary === undefined ? {} : { markActiveAtExpiryBoundary: event.markActiveAtExpiryBoundary }) })) activatedMark = activate(event.targetId, event.nearbyRecipientIds, event.frame, event.id);
        if (c.ascension >= 1) {
          if (event.healResolvedConfirmed === undefined || event.healRecipientId === undefined || event.alyoshaAttackAtHeal === undefined) issues.push(`${event.id}的A1前台治疗须给出实际结算、附近前台对象及当时攻击力。`);
          else if (event.healResolvedConfirmed) {
            if (event.healRecipientId !== activeActorId) issues.push(`${event.id}的A1治疗对象不是已观察的当前前台。`);
            healing = { recipientId: event.healRecipientId, baseHealing: 1.2 * event.alyoshaAttackAtHeal };
          }
        }
        effect = event.contactConfirmed ? "图加林实际撕咬接触；已有印记可激活，A1治疗逐次结算。" : "图加林实际攻击未接触；A1治疗仍按实际结算记录。";
      }
    } else {
      const p = precision.get(event.recipientId);
      if (p) {
        const valid = event.frame < p.expiresAt || event.frame === p.expiresAt && event.precisionActiveAtExpiryBoundary === true;
        if (event.frame === p.expiresAt && event.precisionActiveAtExpiryBoundary === undefined) issues.push(`${event.id}恰在精准到期帧，须确认本回调是否仍有效。`);
        if (valid && event.recipientId === activeActorId) {
          attackBonusRatio = p.attackBonusRatio;
          if (event.radianceStellarConductActiveConfirmed === true) stellarConductBonus = p.stellarConductBonus;
        }
        if (!valid && event.frame > p.expiresAt) precision.delete(event.recipientId);
      }
      effect = attackBonusRatio === undefined ? "此时该队员未获得可应用的前台精准。" : "实际前台精准生效；星导增伤仅在实际星导辉映与星导反应时可用。";
    }
    records.push({ eventId: event.id, kind: event.kind, frame: event.frame, order: event.order,
      ...("targetId" in event ? { targetId: event.targetId } : {}), effect, activatedMark,
      ...(attackBonusRatio === undefined ? {} : { attackBonusRatio }),
      ...(stellarConductBonus === undefined ? {} : { stellarConductBonus }), ...(healing ? { healing } : {}) });
  }
  return { records, issues: [...new Set(issues)], complete: issues.length === 0,
    marks: Object.fromEntries(marks), precision: Object.fromEntries(precision), activeActorId };
}

const skillEvents: Record<string, AlyoshaObservedEvent["kind"]> = {
  "alyosha-skill-press": "mark-apply", "alyosha-skill-hold": "mark-apply",
  "alyosha-burst-field-tick": "field-attack", "alyosha-burst-tugarin-bite": "tugarin-attack",
};
export function isAlyoshaObservedAction(document: CalculatorDocument): boolean {
  return !!skillEvents[document.gameContext?.skillId ?? ""];
}
/** Binds existing sourced E/Q damage coefficients to the actual event that delivered each hit. */
export function prepareAlyoshaObservedDocument(document: CalculatorDocument): CalculatorDocument {
  const raw = document.gameContext?.observedAlyoshaLifecycle;
  if (!raw || !isAlyoshaObservedAction(document)) return document;
  const result = structuredClone(document), context = alyoshaObservedContextSchema.parse(raw);
  const game = result.gameContext!;
  result.dependencies = result.dependencies.filter(dep => !dep.id.startsWith("alyosha-observed:"));
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const id = `alyosha-observed:${hit.id}`, eventId = context.hitBindings?.[hit.id];
    const resolution = resolveAlyoshaObservedLifecycle(context, eventId);
    const record = resolution.records.find(row => row.eventId === eventId);
    const event = context.events.find(row => row.id === eventId);
    const issues = [...resolution.issues];
    if (!eventId || !event || !record) issues.push("本击须绑定一次已记录的实际伤害事件。");
    if (event && event.kind !== skillEvents[game.skillId]) issues.push("绑定事件类型与本次来源E/Q伤害组成不符。");
    if (event?.kind === "mark-apply" && event.source !== (game.skillId === "alyosha-skill-press" ? "skill-press" : "skill-hold")) issues.push("点按／长按施印来源与本击不一致。");
    if (event && "contactConfirmed" in event && !event.contactConfirmed) issues.push("该次伤害没有接触本目标，不能计算已命中本击。");
    if (game.characterId !== "character:10000148" || game.constellation !== context.constellation || game.ascension !== context.ascension) issues.push("角色、C0或突破阶段与观察账本不一致。");
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional",
      reason: issues.join("；") || `实际事件${eventId}已绑定来源伤害组成；施印、激活、前台精准与A1治疗按事件顺序结算。当前最终攻击力须与该时点的精准状态一致。`,
      sourceRefs: ALYOSHA_OBSERVED_SOURCE_REFS });
    hit.dependencies = [...new Set([...hit.dependencies.filter(dep => !dep.startsWith("alyosha-observed:")), id])];
  }
  return result;
}

export function alyoshaObservedTrace(document: CalculatorDocument): CalculationTraceNode[] {
  const raw = document.gameContext?.observedAlyoshaLifecycle;
  if (!raw || !isAlyoshaObservedAction(document)) return [];
  const c = alyoshaObservedContextSchema.parse(raw), b = new TraceBuilder(ALYOSHA_OBSERVED_SOURCE_REFS);
  for (const hitId of document.selectedHitIds) {
    const eventId = c.hitBindings?.[hitId]; if (!eventId) continue;
    const result = resolveAlyoshaObservedLifecycle(c, eventId), record = result.records.find(row => row.eventId === eventId);
    if (!record || result.issues.length) continue;
    b.add(`alyosha-observed:${hitId}:frame`, `实际${record.kind}事件帧`, expr.input("frame"),
      [traceInput("frame", record.frame, "frames", "observed-event", `${eventId}；同帧顺序${record.order}`)], { unit: "frames", status: "assumed" });
    if (record.healing) b.add(`alyosha-observed:${hitId}:a1-healing`, "图加林实际攻击的A1基础治疗", expr.mul(expr.input("atk"), expr.value(1.2)),
      [traceInput("atk", record.healing.baseHealing / 1.2, "hp", "observed-event", `${eventId}；接受者${record.healing.recipientId}`)], { unit: "hp", status: "assumed" });
  }
  return b.nodes;
}
