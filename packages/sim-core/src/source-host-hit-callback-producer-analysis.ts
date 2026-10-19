import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostHitCallbackEvidence } from "./source-host-hit-callback-analysis";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import type { SourceHostAbilityProducer } from "./source-host-finite-cast-types";
import type { SourceHostHitCallback, SourceHostHitCallbackBatch } from "./source-host-hit-callback-types";

/** Only reviewed callback-to-enemy-task families may retain an unbound task Origin. */
export const sourceHostHitCallbackProducerRules = {
  "nilou-burst": { kind: "enemy-task", callbackSite: "nilou.burst.lingering-aeon-hit",
    producerSite: "nilou.burst.lingering-aeon-task", taskCountFact: "nilou.burst.lingering-aeon-task-count",
    localDelay: 121, initialDelay: 91,
    initialAbility: "Dance of Abzendegi: Distant Dreams, Listening Spring", childAbility: "Lingering Aeon",
    attackTagName: "AttackTagElementalBurst" },
} as const;
export type SourceHostHitCallbackProducerRule = typeof sourceHostHitCallbackProducerRules[keyof typeof sourceHostHitCallbackProducerRules];

export function getSourceHostHitCallbackProducerRule(contractId: string): SourceHostHitCallbackProducerRule | undefined {
  return Object.hasOwn(sourceHostHitCallbackProducerRules, contractId)
    ? sourceHostHitCallbackProducerRules[contractId as keyof typeof sourceHostHitCallbackProducerRules] : undefined;
}

function parentEdge(rule: SourceHostHitCallbackProducerRule, evidence: SourceHostHitCallbackEvidence,
  callback: SourceHostHitCallback): SourceHostHitCallbackBatch | undefined {
  if (callback.siteId !== rule.callbackSite || callback.callbackIndex !== 0) return undefined;
  const batches = (evidence.hitCallbackBatches ?? []).filter(batch => batch.id === callback.batchId
    && batch.callbackIds[0] === callback.id);
  if (batches.length !== 1) return undefined;
  const batch = batches[0]!;
  const roots = evidence.invocation.queuedAttacks.filter(attack => attack.queueId === batch.parentQueueId
    && attack.attackId === batch.parentAttackId);
  if (roots.length !== 1 || batch.state !== "completed" || batch.hitConfirmBlocked
    || batch.runFrame !== callback.startedFrame || batch.completedFrame !== callback.completedFrame
    || callback.completedFrame !== callback.startedFrame) return undefined;
  const dispatches = evidence.dispatchCompletions.filter(row => row.attackId === batch.parentAttackId
    && row.dispatchId === batch.parentDispatchId && row.enemyTargetKeys.includes(batch.targetKey));
  const terminals = evidence.observations.filter(entry => entry.row.attackId === batch.parentAttackId
    && entry.row.dispatchId === batch.parentDispatchId && entry.row.targetKey === batch.targetKey
    && (entry.row.stage === "resolved" || entry.row.stage === "missed"));
  return dispatches.length === 1 && terminals.length === 1 && terminals[0]!.row.stage === "resolved" ? batch : undefined;
}

function producerEdge(rule: SourceHostHitCallbackProducerRule, evidence: SourceHostHitCallbackEvidence,
  producer: SourceHostAbilityProducer): { batch: SourceHostHitCallbackBatch; callback: SourceHostHitCallback } | undefined {
  if (producer.invocationId !== evidence.invocation.id || producer.actorIndex !== evidence.invocation.actorIndex
    || producer.siteId !== rule.producerSite || producer.parentProducerId !== undefined) return undefined;
  const callbacks = (evidence.hitCallbacks ?? []).filter(row => row.id === producer.parentHitCallbackId);
  if (callbacks.length !== 1) return undefined;
  const callback = callbacks[0]!, batch = parentEdge(rule, evidence, callback);
  if (!batch || producer.queuedFrame !== callback.startedFrame) return undefined;
  const tasks = evidence.taskLifecycle?.tasks.filter(task => task.id === producer.taskId) ?? [];
  if (tasks.length !== 1 || tasks[0]!.queuedFrame !== producer.queuedFrame) return undefined;
  const queues = evidence.taskLifecycle?.queues.filter(queue => queue.id === tasks[0]!.queueId) ?? [];
  if (queues.length !== 1 || queues[0]!.kind !== "enemy" || queues[0]!.targetKey !== batch.targetKey) return undefined;
  return { batch, callback };
}

/** Decorate existing producer roots, without duplicating them or fabricating Origin.
 * Branch facts/counts are closure proof, not membership: a missing fact keeps the known subtotal. */
export function reachableSourceHostHitCallbackProducerRoots(
  contractId: string, evidence: SourceHostHitCallbackEvidence, initialRoots: SourceHostFiniteRoot[],
): SourceHostFiniteRoot[] {
  const rule = getSourceHostHitCallbackProducerRule(contractId);
  if (!rule) return [];
  return initialRoots.flatMap(root => {
    if (!root.producer) return [];
    const edge = producerEdge(rule, evidence, root.producer);
    return edge ? [{ ...root, callbackBatch: edge.batch, hitCallback: edge.callback }] : [];
  });
}

/** The shared callback census separately proves all resolved/missed/blocked targets.
 * Here each executed callback must register exactly its own enemy-local task. */
export function analyzeSourceHostHitCallbackProducers(
  rule: SourceHostHitCallbackProducerRule, evidence: SourceHostHitCallbackEvidence,
  initialRoots: SourceHostFiniteRoot[], end: number | undefined,
): string[] {
  const reasons: string[] = [];
  const lifecycle = evidence.taskLifecycle;
  if (!lifecycle || lifecycle.observationFrame !== end)
    reasons.push("缺少与观察终点一致的敌方原生任务及局部时钟回执。");
  if (!evidence.producers) reasons.push("缺少命中回调登记的伤害任务清单。");
  const producers = evidence.producers ?? [];
  const visited = new Set<number>(), taskIds = new Set<number>();
  for (const callback of evidence.hitCallbacks ?? []) {
    const batch = parentEdge(rule, evidence, callback);
    if (!batch) continue;
    const rows = producers.filter(row => row.parentHitCallbackId === callback.id);
    if (callback.entryFacts?.[rule.taskCountFact] !== 1 || rows.length !== 1 || callback.queuedAttacks.length !== 0)
      reasons.push(`命中回调 #${callback.id} 缺少原生敌人分支的唯一延迟任务。`);
    for (const producer of rows) {
      visited.add(producer.id);
      if (!producerEdge(rule, evidence, producer)) {
        reasons.push(`回调任务 #${producer.id} 的角色、调用、父回调、任务编号或敌人队列目标不一致。`);
        continue;
      }
      const task = lifecycle!.tasks.find(task => task.id === producer.taskId)!;
      const queue = lifecycle!.queues.find(queue => queue.id === task.queueId)!;
      if (taskIds.has(task.id)) reasons.push(`敌方任务 #${task.id} 被多个伤害生产者重复认领。`);
      taskIds.add(task.id);
      if (task.dueClock - task.queuedClock !== rule.localDelay || task.state !== producer.state
        || task.runFrame !== producer.startedFrame || task.completedFrame !== producer.completedFrame
        || producer.state === "completed" && queue.clock < task.dueClock)
        reasons.push(`敌方任务 #${task.id} 的 ${rule.localDelay} 局部帧延迟或执行回执不一致。`);
      if (task.state === "pending") reasons.push(`目标 ${batch.targetKey} 的敌方任务 #${task.id} 仍待执行，不能把目标死亡当成任务完成。`);
      if (producer.state === "completed" && producer.queuedAttacks.length !== 1)
        reasons.push(`回调任务 #${producer.id} 完成后未产生源码规定的唯一攻击。`);
      for (const attack of producer.queuedAttacks) {
        const dispatches = evidence.dispatchCompletions.filter(row => row.attackId === attack.attackId);
        if (attack.ability !== rule.childAbility || !sourceHostAttackTagMatches(attack.attackTagName, rule.attackTagName)
          || attack.frame !== producer.startedFrame || dispatches.length !== 1
          || dispatches[0]!.frame !== producer.startedFrame)
          reasons.push(`回调任务 #${producer.id} 的攻击身份或即时派发不符。`);
        if (evidence.observations.some(entry => entry.row.attackId === attack.attackId
          && entry.row.stage === "resolved" && entry.row.targetKey !== batch.targetKey))
          reasons.push(`回调任务 #${producer.id} 的单体攻击命中了父回调目标以外的敌人。`);
      }
    }
  }
  for (const producer of producers) if (producer.invocationId === evidence.invocation.id && !visited.has(producer.id))
    reasons.push(`伤害任务 #${producer.id} 未连回本次初击的精确命中回调。`);
  for (const root of initialRoots) if (!root.producer) {
    const dispatches = evidence.dispatchCompletions.filter(row => row.attackId === root.attack.attackId);
    if (root.attack.ability !== rule.initialAbility || !sourceHostAttackTagMatches(root.attack.attackTagName, rule.attackTagName)
      || root.attack.frame !== evidence.invocation.startedFrame || dispatches.length !== 1
      || dispatches[0]!.frame !== root.attack.frame + rule.initialDelay)
      reasons.push(`初击队列 #${root.attack.queueId} 的攻击身份或 +${rule.initialDelay} 帧派发不符。`);
  }
  return reasons;
}
