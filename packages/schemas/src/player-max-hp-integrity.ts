import type { RefinementCtx } from "zod";
import type { PlayerMaxHpEvent, SimulationResult } from "./types";
import { actionChildEventPriority, actionOwner } from "./action-condition-integrity";

interface MaxHpBoundary { frame: number; actorId: string; cause: PlayerMaxHpEvent["cause"]; maxHpBefore: number; maxHpAfter: number; statsAfter: PlayerMaxHpEvent["statsAfter"]; priority: number }

/** Reconstruct declared buffs from accepted actions, never from captured max-HP values. */
export function replayPlayerMaxHpBoundaries(result: SimulationResult): MaxHpBoundary[] {
  if (result.config.playerMaxHpModel === undefined) return [];
  const endFrame = Math.round(result.config.duration * 60);
  const buffs = result.actionLog.flatMap((action, actionOrder) => {
    const owner = actionOwner(result.config, action);
    return (owner?.buffs ?? []).flatMap((buff, buffOrder) => {
      const delay = "durationFrames" in buff ? buff.startFrame ?? 0 : Math.round((buff.offset ?? 0) * 60);
      const frame = action.frame + delay;
      const expiry = frame + ("durationFrames" in buff ? buff.durationFrames : Math.round(buff.duration * 60));
      const targetIds = buff.target === "team" ? result.config.characters.map(actor => actor.id)
        : buff.target === "self" || buff.target === undefined ? [action.actorId] : Array.isArray(buff.target) ? buff.target : [buff.target];
      return targetIds.map(actorId => ({ frame, expiry, actorId, key: `${buff.key ?? buff.stat}:${actorId}`, stat: buff.stat, value: buff.value,
        priority: actionChildEventPriority(owner, delay, 1), actionOrder, buffOrder }));
    });
  }).filter(buff => buff.frame <= endFrame).sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.actionOrder - b.actionOrder || a.buffOrder - b.buffOrder);
  const frames = [...new Set(buffs.flatMap(buff => [buff.frame, buff.expiry]).filter(frame => frame <= endFrame))].sort((a, b) => a - b);
  const active = new Map<string, typeof buffs[number]>();
  const maxHp = new Map(result.config.characters.map(actor => [actor.id, actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp]));
  const boundaries: MaxHpBoundary[] = [];
  const sync = (frame: number, cause: MaxHpBoundary["cause"], priority: number): void => {
    for (const actor of result.config.characters) {
      let hpPct = actor.stats.hpPct, flatHp = actor.stats.flatHp;
      for (const buff of active.values()) if (buff.actorId === actor.id && buff.expiry > frame) {
        if (buff.stat === "hpPct") hpPct += buff.value;
        if (buff.stat === "hpFlat") flatHp += buff.value;
      }
      const after = actor.stats.baseHp * (1 + hpPct) + flatHp, before = maxHp.get(actor.id)!;
      if (after !== before) boundaries.push({ frame, actorId: actor.id, cause, priority, maxHpBefore: before, maxHpAfter: after, statsAfter: { baseHp: actor.stats.baseHp, hpPct, flatHp } });
      maxHp.set(actor.id, after);
    }
  };
  for (const frame of frames) {
    for (const [key, buff] of active) if (buff.expiry <= frame) active.delete(key);
    sync(frame, "buff-expire", -1);
    // A team buff is one queue event; its target changes preserve party order.
    const applying = buffs.filter(buff => buff.frame === frame);
    for (let index = 0; index < applying.length;) {
      const first = applying[index]!;
      do { const buff = applying[index++]!; active.delete(buff.key); active.set(buff.key, buff); }
      while (index < applying.length && applying[index]!.actionOrder === first.actionOrder && applying[index]!.buffOrder === first.buffOrder);
      sync(frame, "buff-apply", first.priority);
    }
  }
  return boundaries;
}

/** The HP timeline has already been ordered; its maximum is independently bound below. */
export function playerMaxHpForHealthEvent(result: SimulationResult, eventId: number, fallback: number): number {
  if (result.config.playerMaxHpModel === undefined) return fallback;
  return result.playerHpTimeline.points.find(point => point.playerHealthEventId === eventId)?.maxHp ?? fallback;
}

export function validatePlayerMaxHpIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
  const model = result.config.playerMaxHpModel, events = result.playerMaxHpEvents;
  if (model === undefined) {
    if (events !== undefined || result.playerHpTimeline.points.some(point => point.operation === "max-hp-change" || point.playerMaxHpEventId !== undefined)
        || result.playerHpSummaries.some(summary => summary.finalMaxHp !== undefined || summary.totalMaxHpAdjustment !== undefined)) issue(["playerMaxHpEvents"], "dynamic max-HP output requires its explicit source-profile model");
    return;
  }
  const expected = replayPlayerMaxHpBoundaries(result);
  if (events === undefined || events.length !== expected.length) issue(["playerMaxHpEvents"], "requires every effective accepted buff/expiry maximum-HP transition");
  const points = result.playerHpTimeline.points;
  const linked = points.filter(point => point.operation === "max-hp-change");
  if (linked.length !== expected.length) issue(["playerHpTimeline"], "requires one linked HP adjustment per dynamic maximum transition");
  expected.forEach((boundary, index) => {
    const event = events?.[index];
    if (event === undefined) return;
    const path: Array<string | number> = ["playerMaxHpEvents", index];
    if (event.id !== index || event.frame !== boundary.frame || event.actorId !== boundary.actorId || event.cause !== boundary.cause ||
        event.eventPriority !== boundary.priority) issue(path, "must match independently replayed accepted buff identity and order");
    for (const field of ["maxHpBefore", "maxHpAfter"] as const) if (!near(event[field], boundary[field]) || boundary[field] <= 0) issue([...path, field], "must equal the positive live maximum reconstructed from configured buffs");
    for (const field of ["baseHp", "hpPct", "flatHp"] as const) if (!near(event.statsAfter[field], boundary.statsAfter[field])) issue([...path, "statsAfter", field], "must equal actual stats reconstructed from accepted buff state");
    const point = linked[index];
    if (point === undefined || point.playerMaxHpEventId !== index || point.actorId !== event.actorId || point.frame !== event.frame ||
        point.eventPriority !== event.eventPriority || point.eventSequence !== event.eventSequence || point.intraEventSequence !== event.intraEventSequence + 1 ||
        !near(point.maxHp, event.maxHpAfter) || !near(point.hpBefore, event.hpBefore) || !near(point.hpAfter, event.hpAfter)) issue(path, "requires the exact linked HP-state adjustment and event tuple");
    const prior = point === undefined ? undefined : points.slice(0, point.id).filter(candidate => candidate.actorId === event.actorId).at(-1);
    const hpBefore = prior?.hpAfter ?? NaN, ratio = hpBefore / boundary.maxHpBefore, hpAfter = ratio * boundary.maxHpAfter;
    for (const [field, value] of Object.entries({ timeSeconds: boundary.frame / 60, hpBefore, hpAfter, hpRatioBefore: ratio, hpRatioAfter: ratio, hpAdjustment: hpAfter - hpBefore })) {
      if (!near(event[field as keyof typeof event] as number, value)) issue([...path, field], "must preserve the independently chained HP ratio without healing or damage");
    }
    if (result.config.bondOfLifeModel === undefined) {
      if (event.bondOfLifeBefore !== undefined || event.bondOfLifeAfter !== undefined) issue(path, "debt audit requires the explicit Bond of Life model");
    } else {
      const actor = result.config.characters.find(actor => actor.id === event.actorId)!;
      const initial = (actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp) * result.config.bondOfLifeModel.characters.find(state => state.actorId === actor.id)!.initialRatio;
      const lastHealthPoint = point === undefined ? undefined : points.slice(0, point.id).filter(candidate => candidate.actorId === actor.id && candidate.playerHealthEventId !== undefined).at(-1);
      const debt = lastHealthPoint === undefined ? initial : result.playerHealthEvents?.[lastHealthPoint.playerHealthEventId!]?.bondOfLife?.debtAfter;
      if (debt === undefined || event.bondOfLifeBefore === undefined || event.bondOfLifeAfter === undefined || !near(event.bondOfLifeBefore, debt) || !near(event.bondOfLifeAfter, debt)) issue(path, "maximum changes must preserve the actual absolute debt without rescaling or clamping");
    }
  });
  for (const actor of result.config.characters) {
    let currentMax = actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp;
    let adjustment = 0;
    for (const point of points.filter(point => point.actorId === actor.id)) {
      if (point.operation === "max-hp-change") { currentMax = events?.[point.playerMaxHpEventId!]?.maxHpAfter ?? NaN; adjustment += point.hpAfter - point.hpBefore; }
      if (!near(point.maxHp, currentMax)) issue(["playerHpTimeline", "points", point.id, "maxHp"], "must carry the current maximum from accepted buff transitions");
      if (point.operation === "damage") {
        const damage = result.playerDamageEvents[point.playerDamageEventId!];
        if (damage !== undefined && !near(damage.hpResolution.maxHp, currentMax)) issue(["playerDamageEvents", damage.id, "hpResolution", "maxHp"], "damage must use the live player maximum");
      }
    }
    const summary = result.playerHpSummaries.find(summary => summary.actorId === actor.id);
    if (summary?.finalMaxHp === undefined || summary.totalMaxHpAdjustment === undefined || !near(summary.finalMaxHp, currentMax) || !near(summary.totalMaxHpAdjustment, adjustment)) issue(["playerHpSummaries"], "requires exact final maximum and signed max-HP adjustment totals");
  }
}
