import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { z } from "zod";
import type { sourceHostAttackObservationSchema } from "./source-host-action-origin";
import type { SourceHostAttackDispatchCompletion, SourceHostOwnedGeneratorTrigger } from "./source-host-finite-cast-types";
import type { SourceHostOwnedGeneratorEvidence } from "./source-host-owned-generator-analysis";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import type { SourceHostHitCallbackBatch, SourceHostHitCallback } from "./source-host-hit-callback-types";
import type {
  SourceHostEventRegistration, SourceHostEventEmission, SourceHostEventListenerCall, SourceHostEventProducer,
} from "./source-host-event-types";
import { analyzeSourceHostEventCallbacks, reachableSourceHostEventCallbackAttacks } from "./source-host-event-callback-analysis";

export interface SourceHostBeidouOwnedEvidence extends SourceHostOwnedGeneratorEvidence {
  dispatchCompletions: SourceHostAttackDispatchCompletion[];
  observations: Array<{ sourceIndex: number; row: z.infer<typeof sourceHostAttackObservationSchema> }>;
  hitCallbackBatches?: SourceHostHitCallbackBatch[] | undefined;
  hitCallbacks?: SourceHostHitCallback[] | undefined;
  eventRegistrations?: SourceHostEventRegistration[] | undefined;
  eventEmissions?: SourceHostEventEmission[] | undefined;
  eventListenerCalls?: SourceHostEventListenerCall[] | undefined;
  eventProducers?: SourceHostEventProducer[] | undefined;
}

const isBeidouBurst = (evidence: SourceHostBeidouOwnedEvidence) =>
  evidence.invocation.characterKey === "beidou" && evidence.invocation.action === "burst";

function ownedTriggers(evidence: SourceHostBeidouOwnedEvidence): SourceHostOwnedGeneratorTrigger[] {
  const ids = new Set((evidence.ownedGenerators ?? []).filter(row => row.invocationId === evidence.invocation.id
    && row.siteId === "beidou.burst.stormbreaker-status").map(row => row.id));
  return (evidence.ownedGeneratorTriggers ?? []).filter(row => ids.has(row.generatorId)
    && row.siteId === "beidou.burst.stormbreaker.enemy-damage" && row.kind === "enemy-damage");
}

function triggerCalls(evidence: SourceHostBeidouOwnedEvidence, trigger: SourceHostOwnedGeneratorTrigger) {
  return (evidence.eventListenerCalls ?? []).filter(call => call.siteId === "beidou.burst.enemy-damage"
    && call.key === "beidou-burst" && call.queuedAttacks.some(eventAttack => trigger.queuedAttacks.some(ownedAttack =>
      eventAttack.queueId === ownedAttack.queueId && eventAttack.attackId === ownedAttack.attackId)));
}

function callbackEvidence(evidence: SourceHostBeidouOwnedEvidence, call: SourceHostEventListenerCall) {
  return { listenerCall: call, attackObservations: evidence.observations.map(entry => entry.row),
    attackDispatchCompletions: evidence.dispatchCompletions,
    hitCallbackBatches: evidence.hitCallbackBatches, hitCallbacks: evidence.hitCallbacks };
}

/** Callback descendants only; the generic status generator supplies each first bounce. */
export function reachableSourceHostBeidouOwnedCallbackRoots(evidence: SourceHostBeidouOwnedEvidence): SourceHostFiniteRoot[] {
  if (!isBeidouBurst(evidence)) return [];
  const roots: SourceHostFiniteRoot[] = [];
  for (const trigger of ownedTriggers(evidence)) {
    const calls = triggerCalls(evidence, trigger);
    if (calls.length !== 1) continue;
    const call = calls[0]!;
    const attacks = reachableSourceHostEventCallbackAttacks(callbackEvidence(evidence, call), call.queuedAttacks);
    for (const attack of attacks) {
      const callbacks = (evidence.hitCallbacks ?? []).filter(row => row.siteId === "beidou.burst.chain"
        && row.queuedAttacks.some(child => child.queueId === attack.queueId && child.attackId === attack.attackId));
      if (callbacks.length !== 1) continue;
      const hitCallback = callbacks[0]!;
      const batches = (evidence.hitCallbackBatches ?? []).filter(row => row.id === hitCallback.batchId);
      if (batches.length !== 1) continue;
      roots.push({ attack, ownedTrigger: trigger, hitCallback, callbackBatch: batches[0]!,
        startedFrame: hitCallback.startedFrame, completedFrame: hitCallback.completedFrame });
    }
  }
  return roots;
}

/** Connect the ended Q status to every real accepted event and its already audited bounce chain. */
export function analyzeSourceHostBeidouOwnedCallbacks(evidence: SourceHostBeidouOwnedEvidence, end: number | undefined) {
  const result = { roots: [] as SourceHostFiniteRoot[], reasons: [] as string[], closed: true,
    batchCount: 0, completedBatchCount: 0, pendingBatchCount: 0, callbackCount: 0 };
  if (!isBeidouBurst(evidence)) return result;
  result.roots = reachableSourceHostBeidouOwnedCallbackRoots(evidence);
  const { reasons } = result, { invocation } = evidence;
  const registrations = evidence.eventRegistrations ?? [], emissions = evidence.eventEmissions ?? [];
  const calls = evidence.eventListenerCalls ?? [], producers = evidence.eventProducers ?? [];
  if (!evidence.eventRegistrations || !evidence.eventEmissions || !evidence.eventListenerCalls || !evidence.eventProducers)
    reasons.push("北斗完整 Q 缺少原生事件注册、发射、调用或事件任务清单。");
  if (!evidence.hitCallbackBatches || !evidence.hitCallbacks)
    reasons.push("北斗完整 Q 缺少原生命中回调批次或槽位清单。");
  if ([registrations, emissions, calls, producers].some(rows => new Set(rows.map(row => row.id)).size !== rows.length))
    reasons.push("北斗 Q 事件回执编号重复。");
  const generators = (evidence.ownedGenerators ?? []).filter(row => row.invocationId === invocation.id);
  const statusIds = new Set(generators.map(row => row.statusInstanceId));
  for (const status of evidence.statusInstances ?? []) if (statusIds.has(status.instanceId)
    && (status.initialExpiryFrame !== status.createdFrame + 900 || status.finalExpiryFrame !== status.initialExpiryFrame))
    reasons.push("北斗 Q 状态不是源码固定的 900 帧且不受卡肉延长的窗口。");
  const observations = new Map(evidence.observations.map(entry => [entry.sourceIndex, entry.row]));
  const triggers = ownedTriggers(evidence), seenCalls = new Set<number>();
  const scopedCalls = calls.filter(call => call.siteId === "beidou.burst.enemy-damage"
    && (statusIds.has(call.entryFacts?.["beidou.burst.status-instance"] ?? -1)
      || call.queuedAttacks.some(attack => statusIds.has(observations.get(attack.queueId - 1)?.origin?.statusOwner?.instanceId ?? -1))));
  for (const trigger of triggers) {
    const matching = triggerCalls(evidence, trigger);
    if (matching.length !== 1) {
      reasons.push(`北斗 Q 触发 #${trigger.id} 缺少通过同一攻击队列绑定的唯一事件调用。`);
      continue;
    }
    const call = matching[0]!, attack = call.queuedAttacks[0], ownedAttack = trigger.queuedAttacks[0];
    if (seenCalls.has(call.id)) reasons.push(`北斗事件调用 #${call.id} 重复归属多个 Q 触发。`);
    seenCalls.add(call.id);
    const generator = generators.find(row => row.id === trigger.generatorId);
    if (!generator || call.entryFacts?.["beidou.burst.status-instance"] !== generator.statusInstanceId
      || call.entryFacts?.["beidou.burst.attack-count"] !== 1
      || call.entryFacts?.["beidou.burst.max-hit-count"] !== (invocation.constellation >= 2 ? 5 : 3)
      || call.startedFrame !== trigger.startedFrame || call.completedFrame !== trigger.completedFrame
      || call.queuedAttacks.length !== 1 || trigger.queuedAttacks.length !== 1 || !attack || !ownedAttack
      || attack.emitSiteId !== "beidou.burst.first-bounce" || ownedAttack.emitSiteId !== "beidou.burst.bounce"
      || attack.ability !== "Stormbreaker (Bounce)" || !sourceHostAttackTagMatches(attack.attackTagName, "AttackTagElementalBurst")
      || attack.queueId !== ownedAttack.queueId || attack.attackId !== ownedAttack.attackId
      || attack.ability !== ownedAttack.ability || attack.attackTagName !== ownedAttack.attackTagName
      || attack.frame !== ownedAttack.frame || attack.frame !== call.startedFrame)
      reasons.push(`北斗事件调用 #${call.id} 的状态归属、分支读数或首段排队身份不符。`);
    if (producers.some(row => row.listenerCallId === call.id))
      reasons.push(`北斗事件调用 #${call.id} 出现未审阅的延迟事件任务。`);
    const registration = registrations.filter(row => row.id === call.registrationId);
    const emission = emissions.filter(row => row.id === call.emissionId);
    if (registration.length !== 1 || emission.length !== 1) {
      reasons.push(`北斗事件调用 #${call.id} 缺少唯一注册或发射身份。`);
    } else {
      const registered = registration[0]!, emitted = emission[0]!;
      if (registered.siteId !== call.siteId || registered.key !== call.key || registered.slotIndex !== call.slotIndex
        || registered.eventType !== call.eventType || emitted.eventType !== call.eventType
        || emitted.mode !== "gameplay" || emitted.listenerIds.filter(id => id === call.id).length !== 1
        || emitted.suppressedListenerIds.includes(registered.id) || registered.createdFrame > emitted.frame
        || registered.endedFrame !== undefined && registered.endedFrame < emitted.frame
        || call.startedFrame !== emitted.frame || call.completedFrame !== call.startedFrame
        || emitted.completedFrame < call.completedFrame || end === undefined || emitted.completedFrame > end)
        reasons.push(`北斗事件调用 #${call.id} 的原生注册、执行名单或时序不符。`);
      const parents = evidence.dispatchCompletions.filter(row => row.attackId === emitted.parentAttackId
        && row.dispatchId === emitted.parentDispatchId);
      const target = evidence.observations.filter(({ row }) => row.attackId === emitted.parentAttackId
        && row.dispatchId === emitted.parentDispatchId && row.targetKey === emitted.targetKey && row.stage === "resolved");
      const queued = emitted.parentQueueId === undefined ? undefined : observations.get(emitted.parentQueueId - 1);
      if (emitted.parentAttackId === undefined || emitted.parentDispatchId === undefined
        || !queued || queued.stage !== "queued" || queued.attackId !== emitted.parentAttackId
        || parents.length !== 1 || !parents[0]!.enemyTargetKeys.includes(emitted.targetKey)
        || target.length !== 1 || target[0]!.row.frame !== parents[0]!.frame || emitted.frame > target[0]!.row.frame)
        reasons.push(`北斗事件调用 #${call.id} 缺少实际触发攻击、派发及命中目标的完整身份。`);
    }
    const callbackResult = analyzeSourceHostEventCallbacks(callbackEvidence(evidence, call), call.queuedAttacks, end);
    reasons.push(...callbackResult.reasons);
    result.batchCount += callbackResult.batchCount;
    result.callbackCount += callbackResult.callbackCount;
    const attackIds = new Set([...call.queuedAttacks, ...callbackResult.attacks].map(row => row.attackId));
    for (const batch of evidence.hitCallbackBatches ?? []) if (attackIds.has(batch.parentAttackId)) {
      if (batch.state === "pending") result.pendingBatchCount++;
      else result.completedBatchCount++;
    }
  }
  if (scopedCalls.length !== seenCalls.size || scopedCalls.some(call => !seenCalls.has(call.id)))
    reasons.push("北斗 Q 状态实际发出的事件攻击与生成器触发清单不完整或不一致。");
  result.closed = reasons.length === 0;
  return result;
}
