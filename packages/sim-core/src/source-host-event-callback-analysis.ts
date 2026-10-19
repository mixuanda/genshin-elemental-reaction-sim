import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { z } from "zod";
import type { sourceHostAttackObservationSchema } from "./source-host-action-origin";
import type { SourceHostAttackDispatchCompletion } from "./source-host-finite-cast-types";
import type { SourceHostEventListenerCall, SourceHostEventQueuedAttack } from "./source-host-event-types";
import type { SourceHostHitCallbackBatch, SourceHostHitCallback } from "./source-host-hit-callback-types";

export interface SourceHostEventCallbackEvidence {
  listenerCall: SourceHostEventListenerCall;
  attackObservations: Array<z.infer<typeof sourceHostAttackObservationSchema>>;
  attackDispatchCompletions: SourceHostAttackDispatchCompletion[];
  hitCallbackBatches?: SourceHostHitCallbackBatch[] | undefined;
  hitCallbacks?: SourceHostHitCallback[] | undefined;
}

export interface SourceHostEventCallbackAnalysis {
  /** Audited descendants only; the caller retains the listener's direct roots. */
  attacks: SourceHostEventQueuedAttack[];
  reasons: string[];
  closed: boolean;
  batchCount: number;
  callbackCount: number;
}

const callbackSite = "beidou.burst.chain";
const childEmitSite = "beidou.burst.chain-bounce";

/** Follow one native Stormbreaker invocation, never another event with the same ability name. */
export function analyzeSourceHostEventCallbacks(
  evidence: SourceHostEventCallbackEvidence, roots: SourceHostEventQueuedAttack[], endFrame: number | undefined,
): SourceHostEventCallbackAnalysis {
  const result: SourceHostEventCallbackAnalysis = { attacks: [], reasons: [], closed: false, batchCount: 0, callbackCount: 0 };
  const { reasons } = result;
  const limit = evidence.listenerCall.entryFacts?.["beidou.burst.max-hit-count"];
  if (limit !== 3 && limit !== 5) reasons.push("北斗本次闪雷缺少原生 3/5 段连锁上限读数。");
  if (!evidence.hitCallbackBatches || !evidence.hitCallbacks) reasons.push("缺少北斗闪雷的原生命中回调批次或槽位回执。");
  if (endFrame === undefined) reasons.push("缺少北斗闪雷连锁的观察终点。");
  const batches = evidence.hitCallbackBatches ?? [], callbacks = evidence.hitCallbacks ?? [];
  if (new Set(batches.map(row => row.id)).size !== batches.length
    || new Set(callbacks.map(row => row.id)).size !== callbacks.length)
    reasons.push("北斗闪雷回调批次或槽位编号重复。");
  const reached = new Set(roots.map(row => row.queueId)), visitedBatches = new Set<number>();
  const frontier = roots.map(attack => ({ attack, index: 1 }));
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    const { attack, index } = frontier[cursor]!;
    const completions = evidence.attackDispatchCompletions.filter(row => row.attackId === attack.attackId);
    if (attack.attackId === undefined || completions.length !== 1) {
      reasons.push(`闪雷队列 #${attack.queueId} 尚无唯一派发，不能判断后续弹跳。`);
      continue;
    }
    const completion = completions[0]!;
    if (completion.frame !== attack.frame + 1)
      reasons.push(`闪雷队列 #${attack.queueId} 与源码的 +1 帧攻击延迟不符。`);
    const resolvedTargets = evidence.attackObservations.filter(row => row.attackId === attack.attackId
      && row.dispatchId === completion.dispatchId && row.stage === "resolved");
    if (resolvedTargets.length > 1) reasons.push(`单目标闪雷队列 #${attack.queueId} 出现多个已结算目标。`);
    for (const targetKey of completion.enemyTargetKeys) {
      const terminal = evidence.attackObservations.filter(row => row.attackId === attack.attackId
        && row.dispatchId === completion.dispatchId && row.targetKey === targetKey
        && (row.stage === "resolved" || row.stage === "missed"));
      const matching = batches.filter(row => row.parentQueueId === attack.queueId
        && row.parentAttackId === attack.attackId && row.parentDispatchId === completion.dispatchId
        && row.targetKey === targetKey);
      if (terminal.length !== 1) {
        reasons.push(`闪雷队列 #${attack.queueId} 的目标 ${targetKey} 缺少唯一命中或落空终态。`);
        continue;
      }
      if (terminal[0]!.stage === "missed") {
        if (matching.length) reasons.push(`落空闪雷目标 ${targetKey} 却登记了命中回调。`);
        continue;
      }
      if (matching.length !== 1) {
        reasons.push(`闪雷目标 ${targetKey} 缺少精确父队列、攻击、派发身份的唯一回调批次。`);
        continue;
      }
      const batch = matching[0]!;
      visitedBatches.add(batch.id);
      result.batchCount++;
      const expectedSlots = limit === 3 || limit === 5 ? Number(index < limit) : -1;
      const rows = callbacks.filter(row => row.batchId === batch.id);
      if (batch.callbackCount !== expectedSlots || batch.queuedFrame !== completion.frame)
        reasons.push(`闪雷第 ${index} 段回调的原生槽位数或登记帧不符。`);
      if (batch.state === "pending") {
        reasons.push(`闪雷回调批次 #${batch.id} 尚待执行。`);
        if (batch.runFrame !== undefined || batch.completedFrame !== undefined || rows.length || batch.callbackIds.length)
          reasons.push(`待执行闪雷回调批次 #${batch.id} 已出现执行结果。`);
        continue;
      }
      if (batch.runFrame === undefined || batch.completedFrame !== batch.runFrame
        || batch.runFrame < batch.queuedFrame || endFrame === undefined || batch.completedFrame > endFrame)
        reasons.push(`闪雷回调批次 #${batch.id} 缺少观察窗口内的同帧执行区间。`);
      if (batch.state === "blocked") {
        if (!batch.hitConfirmBlocked || rows.length || batch.callbackIds.length)
          reasons.push(`阻断的闪雷回调批次 #${batch.id} 却执行了命中回调。`);
        continue;
      }
      if (batch.hitConfirmBlocked || rows.length !== expectedSlots || batch.callbackIds.length !== rows.length
        || rows.some((row, slot) => row.id !== batch.callbackIds[slot] || row.callbackIndex !== slot)) {
        reasons.push(`闪雷回调批次 #${batch.id} 的实际槽位清单不完整。`);
        continue;
      }
      for (const callback of rows) {
        result.callbackCount++;
        const count = callback.entryFacts?.["beidou.burst.chain-attack-count"];
        const target = callback.entryFacts?.["beidou.burst.chain-target-key"];
        const validCallback = callback.siteId === callbackSite && callback.callbackIndex === 0
          && callback.startedFrame === batch.runFrame && callback.completedFrame === callback.startedFrame
          && callback.entryFacts?.["beidou.burst.chain-index"] === index
          && callback.entryFacts?.["beidou.burst.chain-max-hit-count"] === limit
          && (count === 0 || count === 1) && callback.queuedAttacks.length === count
          && (count === 0 ? target === undefined : Number.isInteger(target) && target !== targetKey);
        if (!validCallback) {
          reasons.push(`闪雷回调 #${callback.id} 的来源、段数、选敌分支或攻击数不符。`);
          continue;
        }
        for (const child of callback.queuedAttacks) {
          if (child.emitSiteId !== childEmitSite || child.ability !== "Stormbreaker (Bounce)"
            || !sourceHostAttackTagMatches(child.attackTagName, "AttackTagElementalBurst") || child.frame !== callback.startedFrame
            || child.attackId === undefined || limit === undefined || index >= limit || reached.has(child.queueId)) {
            reasons.push(`闪雷回调 #${callback.id} 的子攻击来源、排队帧或连锁边不符。`);
            continue;
          }
          const childDispatches = evidence.attackDispatchCompletions.filter(row => row.attackId === child.attackId);
          if (childDispatches.length === 1) {
            const next = childDispatches[0]!;
            const resolved = evidence.attackObservations.filter(row => row.attackId === child.attackId
              && row.dispatchId === next.dispatchId && row.stage === "resolved");
            if (next.frame !== callback.startedFrame + 1 || resolved.some(row => row.targetKey !== target))
              reasons.push(`闪雷子攻击 #${child.queueId} 的 +1 帧派发或实际目标与原生选敌读数不符。`);
          }
          reached.add(child.queueId);
          result.attacks.push(child);
          frontier.push({ attack: child, index: index + 1 });
        }
      }
    }
  }
  for (const batch of batches) if (frontier.some(({ attack }) => batch.parentQueueId === attack.queueId
    || batch.parentAttackId === attack.attackId) && !visitedBatches.has(batch.id))
    reasons.push(`闪雷关联回调批次 #${batch.id} 未对应唯一已结算父目标。`);
  // A missing branch read prevents closure, but does not erase an attack whose
  // native parent/callback/queue identities still establish its membership.
  result.attacks = reachableSourceHostEventCallbackAttacks(evidence, roots);
  result.closed = reasons.length === 0;
  return result;
}

/** Capture only descendants reached through the same audited native chain edges. */
export function reachableSourceHostEventCallbackAttacks(
  evidence: SourceHostEventCallbackEvidence, roots: SourceHostEventQueuedAttack[],
): SourceHostEventQueuedAttack[] {
  const batches = evidence.hitCallbackBatches ?? [], callbacks = evidence.hitCallbacks ?? [];
  const reached = new Set(roots.map(row => row.queueId)), frontier = [...roots];
  const descendants: SourceHostEventQueuedAttack[] = [];
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    const parent = frontier[cursor]!;
    const dispatches = evidence.attackDispatchCompletions.filter(row => row.attackId === parent.attackId);
    if (parent.attackId === undefined || dispatches.length !== 1) continue;
    const dispatch = dispatches[0]!;
    for (const targetKey of dispatch.enemyTargetKeys) {
      const terminal = evidence.attackObservations.filter(row => row.attackId === parent.attackId
        && row.dispatchId === dispatch.dispatchId && row.targetKey === targetKey && row.stage === "resolved");
      const matching = batches.filter(row => row.parentQueueId === parent.queueId
        && row.parentAttackId === parent.attackId && row.parentDispatchId === dispatch.dispatchId
        && row.targetKey === targetKey);
      if (terminal.length !== 1 || matching.length !== 1) continue;
      const batch = matching[0]!;
      const slots = callbacks.filter(row => row.batchId === batch.id && row.callbackIndex === 0
        && row.id === batch.callbackIds[0] && row.siteId === callbackSite);
      if (slots.length !== 1) continue;
      for (const child of slots[0]!.queuedAttacks) {
        if (child.emitSiteId !== childEmitSite || child.ability !== "Stormbreaker (Bounce)"
          || !sourceHostAttackTagMatches(child.attackTagName, "AttackTagElementalBurst") || reached.has(child.queueId)) continue;
        reached.add(child.queueId);
        descendants.push(child);
        frontier.push(child);
      }
    }
  }
  return descendants;
}
