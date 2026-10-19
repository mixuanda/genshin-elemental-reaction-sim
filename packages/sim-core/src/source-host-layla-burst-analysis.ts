import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostAttackDispatchCompletion } from "./source-host-finite-cast-types";
import type { SourceHostHitCallback, SourceHostHitCallbackBatch } from "./source-host-hit-callback-types";
import type { SourceHostHitCallbackEvidence } from "./source-host-hit-callback-analysis";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import type { SourceHostShieldHook, SourceHostShieldInstance, SourceHostShieldProducer } from "./source-host-owned-shield-types";

const producerSite = "layla.burst.slug";
const callbackSite = "layla.burst.night-star-hit";
const hookSite = "layla.shield.burst-star";
const shieldBirthSite = "layla.skill.shield";
const ability = "Starlight Slug";
const attackTag = "AttackTagElementalBurst";
const callbackFirstFact = "layla.burst.callback.first";
const callbackShieldPresentFact = "layla.burst.callback.shield-present";
const callbackShieldInstanceFact = "layla.burst.callback.shield-instance";
const producerAttackCountFact = "layla.burst.slug.attack-count";
const burstStart = 36;
const slugPeriod = 90;
const slugCount = 8;
const tickRelease = 56;
const defaultTravel = 22;
const laylaShieldType = 15;
const laylaShieldDescription = "Curtain of Slumber (Shield)";

export interface SourceHostLaylaBurstEvidence extends SourceHostHitCallbackEvidence {
  shieldHooks?: SourceHostShieldHook[] | undefined;
  shieldProducers?: SourceHostShieldProducer[] | undefined;
  shieldInstances?: SourceHostShieldInstance[] | undefined;
}

function exactDispatch(attackId: number | undefined, rows: SourceHostAttackDispatchCompletion[]) {
  return attackId === undefined ? [] : rows.filter(row => row.attackId === attackId);
}

function batchesForRoot(
  evidence: SourceHostLaylaBurstEvidence, root: SourceHostFiniteRoot, dispatch: SourceHostAttackDispatchCompletion,
): SourceHostHitCallbackBatch[] {
  const attackId = root.attack.attackId;
  if (attackId === undefined) return [];
  return (evidence.hitCallbackBatches ?? []).filter(batch => batch.parentQueueId === root.attack.queueId
    && batch.parentAttackId === attackId && batch.parentDispatchId === dispatch.dispatchId
    && dispatch.enemyTargetKeys.includes(batch.targetKey));
}

/** Validate 莱依拉 Q's actual slug tasks and the one-time shield-gated Night Star callback. */
export function analyzeSourceHostLaylaBurstCallbacks(
  evidence: SourceHostLaylaBurstEvidence,
  initialRoots: SourceHostFiniteRoot[],
  end: number | undefined,
): string[] {
  const { invocation } = evidence;
  const reasons: string[] = [];
  const allProducers = evidence.producers ?? [];
  const producers = allProducers.filter(row => row.invocationId === invocation.id && row.siteId === producerSite);
  const shieldInstances = evidence.shieldInstances ?? [];
  const shieldHooks = evidence.shieldHooks ?? [];
  const callbacks = evidence.hitCallbacks ?? [];

  if (!evidence.producers) reasons.push("缺少 莱依拉 Q 的原生 Starlight Slug 任务回执。");
  if (!evidence.hitCallbackBatches || !evidence.hitCallbacks) reasons.push("缺少 莱依拉 Q 命中回调回执。");
  if (!evidence.shieldHooks || !evidence.shieldInstances || !evidence.shieldProducers)
    reasons.push("缺少 莱依拉 Q 护盾触发或实例回执。");
  if (!evidence.taskLifecycle || evidence.taskLifecycle.observationFrame !== end) reasons.push("缺少与观察终点一致的 Q 原生核心任务回执。");
  if (end === undefined || end < invocation.returnedFrame) reasons.push("观察终点未覆盖 莱依拉 Q 调用。");

  const travel = invocation.params.travel ?? defaultTravel;
  if (!Number.isInteger(travel) || travel < 0) reasons.push("莱依拉 Q 的 travel 参数不是非负整数帧。");
  if (producers.length !== slugCount) reasons.push("莱依拉 Q 未登记完整的 8 个原生 slug 任务。");

  const rootsByProducer = new Map<number, SourceHostFiniteRoot[]>();
  for (const root of initialRoots) {
    if (root.producer?.invocationId !== invocation.id || root.producer.siteId !== producerSite) continue;
    const group = rootsByProducer.get(root.producer.id) ?? [];
    group.push(root);
    rootsByProducer.set(root.producer.id, group);
  }

  const orderedProducers = [...producers].sort((a, b) => a.id - b.id);
  for (const [index, producer] of orderedProducers.entries()) {
    const expectedFrame = invocation.startedFrame + burstStart + slugPeriod * index;
    const tasks = evidence.taskLifecycle?.tasks.filter(row => row.id === producer.taskId) ?? [];
    const task = tasks[0], queue = evidence.taskLifecycle?.queues.find(row => row.id === task?.queueId);
    if (tasks.length !== 1 || !task || queue?.kind !== "core"
      || task.queuedFrame !== producer.queuedFrame || task.dueClock - task.queuedClock !== burstStart + slugPeriod * index
      || task.state !== producer.state || task.runFrame !== producer.startedFrame || task.completedFrame !== producer.completedFrame)
      reasons.push(`莱依拉 Q slug 任务 #${producer.id} 的实际核心队列或原生任务编号不符。`);
    if (producer.actorIndex !== invocation.actorIndex || producer.parentProducerId !== undefined
      || producer.queuedFrame !== invocation.startedFrame || producer.startedFrame !== expectedFrame)
      reasons.push(`莱依拉 Q slug 任务 #${producer.id} 的角色、父级或 +36/+90n 执行帧不符。`);
    const fact = producer.entryFacts?.[producerAttackCountFact];
    const roots = rootsByProducer.get(producer.id) ?? [];
    const producerAttacks = producer.queuedAttacks;
    if ((fact !== 0 && fact !== 1) || producerAttacks.length !== fact)
      reasons.push(`莱依拉 Q slug 任务 #${producer.id} 的目标分支事实与排队攻击数不符。`);
    if (roots.length !== producerAttacks.length || roots.some(root => !producerAttacks.some(attack => attack.queueId === root.attack.queueId)))
      reasons.push(`莱依拉 Q slug 任务 #${producer.id} 的攻击根与生产者队列不一致。`);
    for (const attack of producerAttacks) {
      const expectedDispatchFrame = expectedFrame + tickRelease + travel;
      const dispatches = exactDispatch(attack.attackId, evidence.dispatchCompletions);
      if (attack.ability !== ability || !sourceHostAttackTagMatches(attack.attackTagName, attackTag)
        || attack.frame !== expectedFrame || dispatches.length !== 1 || dispatches[0]!.frame !== expectedDispatchFrame)
        reasons.push(`莱依拉 Q slug 队列 #${attack.queueId} 的攻击身份、travel 派发帧或唯一派发不符。`);
    }
    if (producer.state === "completed" && (producer.completedFrame === undefined || end === undefined || producer.completedFrame > end))
      reasons.push(`莱依拉 Q slug 任务 #${producer.id} 的完成帧超出观察区间。`);
  }

  const attackRoots = initialRoots.filter(root => root.producer?.invocationId === invocation.id
    && root.producer.siteId === producerSite);
  const completedCallbackGroups = new Map<number, SourceHostHitCallback[]>();
  const firstCallbackIds = new Set<number>();
  const selectedCallbackIds = new Set<number>();
  for (const root of attackRoots) {
    const dispatches = exactDispatch(root.attack.attackId, evidence.dispatchCompletions);
    if (dispatches.length !== 1) continue; // Generic producer/dispatch census reports missing or ambiguous dispatches.
    for (const batch of batchesForRoot(evidence, root, dispatches[0]!)) {
      if (batch.state !== "completed" || batch.runFrame === undefined || batch.completedFrame !== batch.runFrame) continue;
      const rows = callbacks.filter(row => row.batchId === batch.id).sort((a, b) => a.id - b.id);
      if (rows.some(row => row.siteId !== callbackSite || row.callbackIndex !== 0
        || row.startedFrame !== batch.runFrame || row.completedFrame !== row.startedFrame))
        reasons.push(`莱依拉 Q 回调批次 #${batch.id} 含有非预期的命中回调槽位。`);
      for (const row of rows) selectedCallbackIds.add(row.id);
      const group = completedCallbackGroups.get(root.attack.queueId) ?? [];
      group.push(...rows);
      completedCallbackGroups.set(root.attack.queueId, group);
    }
  }

  for (const [queueId, rows] of completedCallbackGroups) {
    rows.sort((a, b) => a.id - b.id);
    for (const [index, callback] of rows.entries()) {
      const first = callback.entryFacts?.[callbackFirstFact];
      if (first !== (index === 0 ? 1 : 0))
        reasons.push(`莱依拉 Q 队列 #${queueId} 的回调 #${callback.id} 首次回调事实次序不符。`);
      if (index > 0) {
        if (callback.entryFacts?.[callbackShieldPresentFact] !== undefined
          || callback.entryFacts?.[callbackShieldInstanceFact] !== undefined)
          reasons.push(`莱依拉 Q 队列 #${queueId} 的后续回调 #${callback.id} 读取了首回调才会读取的护盾状态。`);
        continue;
      }
      firstCallbackIds.add(callback.id);
      const present = callback.entryFacts?.[callbackShieldPresentFact];
      const instanceId = callback.entryFacts?.[callbackShieldInstanceFact];
      if ((present !== 0 && present !== 1) || present === 0 && instanceId !== 0
        || present === 1 && (!Number.isInteger(instanceId) || instanceId! <= 0)) {
        reasons.push(`莱依拉 Q 首次回调 #${callback.id} 缺少一致的护盾存在与实例事实。`);
        continue;
      }
      const matchingHooks = shieldHooks.filter(hook => hook.hitCallbackId === callback.id);
      if (present === 0) {
        if (matchingHooks.length) reasons.push(`无护盾的 莱依拉 Q 回调 #${callback.id} 却登记了护盾钩子。`);
        continue;
      }
      const instance = shieldInstances.find(row => row.id === instanceId);
      if (!instance || instance.actorIndex !== invocation.actorIndex || instance.type !== laylaShieldType
        || instance.description !== laylaShieldDescription || instance.creationSiteId !== shieldBirthSite)
        reasons.push(`莱依拉 Q 首次回调 #${callback.id} 指向的护盾实例并非本角色 E 护盾出生。`);
      if (matchingHooks.length !== 1) {
        reasons.push(`有盾的 莱依拉 Q 首次回调 #${callback.id} 缺少唯一触发钩子。`);
        continue;
      }
      const hook = matchingHooks[0]!;
      if (hook.instanceId !== instanceId || hook.siteId !== hookSite || hook.cause !== "trigger"
        || hook.startedFrame !== callback.startedFrame || hook.completedFrame !== callback.startedFrame
        || hook.queuedAttacks.length !== 0)
        reasons.push(`莱依拉 Q 首次回调 #${callback.id} 的护盾触发钩子归属或时序不符。`);
    }
  }

  for (const hook of shieldHooks) {
    if (hook.hitCallbackId !== undefined && selectedCallbackIds.has(hook.hitCallbackId)
      && !callbacks.some(callback => callback.id === hook.hitCallbackId
      && callback.siteId === callbackSite && firstCallbackIds.has(callback.id)))
      reasons.push(`莱依拉护盾 Q 触发钩子 #${hook.id} 没有关联的 Starlight Slug 命中回调。`);
  }
  // E-owned delayed shield tasks are intentionally outside the Q producer roots.
  return reasons;
}
