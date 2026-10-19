import { travelerHydroResolvedCastBaseSchema, type TravelerHydroResolvedEvent, type TravelerHydroResolvedScheduleContext } from "./traveler-hydro-resolved-context";
export const TRAVELER_HYDRO_RESOLVED_CAST_KINDS = ["traveler-hydro-resolved-aether-hold-c0", "traveler-hydro-resolved-lumine-hold-c0"] as const;
export type TravelerHydroResolvedCastKind = typeof TRAVELER_HYDRO_RESOLVED_CAST_KINDS[number];
export interface TravelerHydroResolvedCandidate extends TravelerHydroResolvedEvent { id: string; contact: boolean | undefined }
export interface TravelerHydroResolvedSchedule {
  candidates: TravelerHydroResolvedCandidate[]; instances: TravelerHydroResolvedEvent[];
  decisions: Array<{ frame: number; reason: string }>;
  hpLedger: Array<{ id: string; frame: number; order: number; kind: string; hpBefore: number; hpAfter: number; maxHp: number; consumedHp: number; cumulativeConsumed: number }>;
  issues: string[]; complete: boolean; requiredObservedThroughFrame: number;
}
const precedes = (a: { frame: number; order: number }, b: { frame: number; order: number }) => a.frame < b.frame || a.frame === b.frame && a.order < b.order;

/** Observed HP and delivery chronology; no invented automatic drain cadence or projectile travel. */
export function compileTravelerHydroResolvedSchedule(kind: TravelerHydroResolvedCastKind, raw: TravelerHydroResolvedScheduleContext): TravelerHydroResolvedSchedule {
  if (!(TRAVELER_HYDRO_RESOLVED_CAST_KINDS as readonly string[]).includes(kind)) throw new Error("未登记的水旅行者充盈长E分支。");
  const context = travelerHydroResolvedCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "snapshots")));
  const issues: string[] = [], decisions: TravelerHydroResolvedSchedule["decisions"] = [], hpLedger: TravelerHydroResolvedSchedule["hpLedger"] = [];
  for (const [key, label] of [
    ["freshCastConfirmed", "这是一次独立的新施放，不混入上次充盈消耗"], ["noHitlag", "没有卡肉"],
    ["noInterruption", "长按没有被打断"], ["noReplacement", "没有重施或状态替换"],
    ["fullObservedLifetime", "完整观察结束及最后发出伤害的交付"], ["allHpChangesRecorded", "全部充盈扣血及外部生命变化均已按实际先后记录"],
    ["allDamageEventsRecorded", "本次全部露滴、结束激流和灵息之刺（包括落空）均已记录"],
    ["trueMoonStoryBuffInactive", "本基础分支的真月剧情增益关闭"],
  ] as const) if (context[key] !== true) issues.push(`请明确${label}。`);
  if (!context.casterId || !context.targetId) issues.push("需要本次施放者与所选目标身份。");
  if (context.initialCurrentHp === undefined || context.initialMaxHp === undefined) issues.push("需要施放起点的实际当前生命和生命上限。");
  if (context.initialCurrentHp !== undefined && context.initialMaxHp !== undefined && context.initialCurrentHp > context.initialMaxHp) issues.push("起点当前生命不能超过生命上限。");
  if (context.releaseFrame === undefined || context.releaseOrder === undefined) issues.push("需要实际结束长按的帧及同帧顺序，以限定本次A4扣血归属。");
  if (context.dewCount === undefined) issues.push("需要明确本次实际发出的露滴数（1至22），不能把最大22当作命中数。");
  if (context.spiritbreathTriggered === undefined) issues.push("需要明确本次实际触发或未触发灵息之刺，不能默认9秒间隔已就绪。");
  if (!context.hpEvents) issues.push("请提供完整生命事件账本；空数组表示明确没有充盈扣血或外部生命变化。");
  const entries = [...context.hpEvents ?? []].sort((a,b) => a.frame-b.frame || a.order-b.order);
  const slots = new Set<string>(), ids = new Set<string>();
  let hp = context.initialCurrentHp, maxHp = context.initialMaxHp, total = 0;
  for (const row of entries) {
    const slot = `${row.frame}:${row.order}`;
    if (ids.has(row.id) || slots.has(slot)) issues.push(`生命事件${row.id}的身份或同帧顺序重复，无法重放。`);
    ids.add(row.id); slots.add(slot);
    if (hp === undefined || maxHp === undefined) continue;
    const before = hp; let consumed = 0;
    if (row.kind === "observed-hp-state") {
      if (row.currentHp > row.maxHp) issues.push(`生命观察${row.id}的当前生命超过上限。`);
      hp = row.currentHp; maxHp = row.maxHp;
    } else {
      if (context.releaseFrame !== undefined && context.releaseOrder !== undefined && !precedes(row, { frame: context.releaseFrame, order: context.releaseOrder })) issues.push(`充盈扣血${row.id}不早于本次结束点，不能计入结束激流。`);
      if (hp <= maxHp * .5) issues.push(`充盈扣血${row.id}发生前生命不高于50%，与来源资格冲突。`);
      else { consumed = maxHp * .04; hp -= consumed; total += consumed; }
    }
    hpLedger.push({ id: row.id, frame: row.frame, order: row.order, kind: row.kind, hpBefore: before, hpAfter: hp, maxHp, consumedHp: consumed, cumulativeConsumed: total });
    decisions.push({ frame: row.frame, reason: row.kind === "suffusion" ? `${row.id}：按当时生命上限4%消耗${consumed}，本次累计${total}。` : `${row.id}：采用实际外部生命状态（${row.reason}），不把它计作充盈。` });
  }
  const events = context.events ?? [], counts = { dew: 0, torrent: 0, thorn: 0 }, candidates: TravelerHydroResolvedCandidate[] = [], instances: TravelerHydroResolvedEvent[] = [];
  const damageIds = new Set<string>();
  for (const rawEvent of events) {
    counts[rawEvent.templateRole]++;
    if (damageIds.has(rawEvent.candidateId)) issues.push(`伤害事件${rawEvent.candidateId}身份重复。`);
    damageIds.add(rawEvent.candidateId);
    const event = { ...rawEvent, observedSourceEvent: true };
    // Full-cast arithmetic derives these values from its ledger; user-supplied cached values are not authoritative.
    delete event.actualCurrentHp; delete event.actualMaxHp; delete event.consumedHpThisCast;
    if (event.targetId !== context.targetId) issues.push(`${event.candidateId}的目标不属于本次所选目标。`);
    if (event.launchFrame > event.frame || event.snapshotFrame > event.frame) issues.push(`${event.candidateId}的发射或取样晚于命中。`);
    if (event.templateRole === "dew") {
      if (context.releaseFrame !== undefined && event.launchFrame > context.releaseFrame) issues.push(`${event.candidateId}在长按结束后才发射。`);
      if (event.hpReadFrame === undefined || event.hpReadOrder === undefined) issues.push(`${event.candidateId}需要实际充盈生命资格取样的帧和同帧顺序。`);
      else {
        if (event.hpReadFrame > event.frame) issues.push(`${event.candidateId}的生命资格取样晚于伤害。`);
        const readAt = { frame: event.hpReadFrame, order: event.hpReadOrder };
        if (slots.has(`${readAt.frame}:${readAt.order}`)) issues.push(`${event.candidateId}的生命读取与生命变更顺序重叠；请明确前后顺序。`);
        const prior = hpLedger.filter(row => precedes(row, readAt)).at(-1);
        const readHp = prior?.hpAfter ?? context.initialCurrentHp, readMaxHp = prior?.maxHp ?? context.initialMaxHp;
        if (readHp !== undefined) event.actualCurrentHp = readHp;
        if (readMaxHp !== undefined) event.actualMaxHp = readMaxHp;
      }
    } else if (event.templateRole === "torrent") {
      if (event.launchFrame !== context.releaseFrame) issues.push("结束激流的发射帧必须是实际结束长按帧。");
      if (context.releaseFrame !== undefined && context.releaseOrder !== undefined) event.consumedHpThisCast = hpLedger.filter(row => precedes(row, { frame: context.releaseFrame!, order: context.releaseOrder! })).reduce((sum,row) => sum+row.consumedHp,0);
    } else if (context.releaseFrame !== undefined && event.launchFrame < context.releaseFrame) issues.push("灵息之刺不能在本次结束激流发射之前触发。");
    const contact = context.targetContacts?.[event.candidateId];
    candidates.push({ ...event, id: event.candidateId, contact });
    if (contact === undefined) issues.push(`请明确${event.candidateId}是否实际命中所选目标。`);
    else if (contact) instances.push(event);
  }
  if (counts.dew !== context.dewCount || counts.torrent !== 1 || counts.thorn !== (context.spiritbreathTriggered ? 1 : 0)) issues.push("全部事件数必须对应实际露滴数、一次结束激流，以及明确是否触发的一次灵息之刺。");
  const requiredObservedThroughFrame = Math.max(context.releaseFrame ?? 0, ...events.map(event => event.frame), ...entries.map(row => row.frame));
  if (context.observedThroughFrame === undefined || context.observedThroughFrame < requiredObservedThroughFrame) issues.push(`完整观察至少须覆盖第${requiredObservedThroughFrame}帧的最后一次真实交付／生命记录。`);
  decisions.push({ frame: context.releaseFrame ?? 0, reason: "结束激流仅使用本次结束点之前的充盈扣血总和；不使用上次施放、外部扣血或起手零值。自动耗血帧仍未跨源裁决，全部同帧先后使用明确观察。" });
  return { candidates, instances, decisions, hpLedger, issues: [...new Set(issues)], complete: issues.length === 0, requiredObservedThroughFrame };
}
