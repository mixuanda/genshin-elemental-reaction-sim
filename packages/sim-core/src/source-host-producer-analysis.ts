import type {
  SourceHostAbilityInvocation, SourceHostAbilityProducer, SourceHostAbilityQueuedAttack,
  SourceHostAttackDispatchCompletion,
  SourceHostOwnedGeneratorTrigger,
} from "./source-host-finite-cast-types";
import type { SourceHostFiniteCastPlan } from "./source-host-producer-plan";
import type { SourceHostOwnedEntityTrigger, SourceHostOwnedEntityProducer } from "./source-host-owned-entity-types";
import type { SourceHostHitCallbackBatch, SourceHostHitCallback } from "./source-host-hit-callback-types";
import type { SourceHostShieldHook } from "./source-host-owned-shield-types";
import type { SourceHostShieldProducer } from "./source-host-owned-shield-types";

export interface SourceHostFiniteRoot {
  attack: SourceHostAbilityQueuedAttack;
  producer?: SourceHostAbilityProducer;
  ownedTrigger?: SourceHostOwnedGeneratorTrigger;
  statusInstanceId?: number;
  entityId?: number;
  entityTrigger?: SourceHostOwnedEntityTrigger;
  entityProducer?: SourceHostOwnedEntityProducer;
  shieldInstanceId?: number;
  shieldHook?: SourceHostShieldHook;
  shieldProducer?: SourceHostShieldProducer;
  callbackBatch?: SourceHostHitCallbackBatch;
  hitCallback?: SourceHostHitCallback;
  startedFrame: number | undefined;
  completedFrame: number | undefined;
}
interface ProducerEvidence {
  invocation: SourceHostAbilityInvocation;
  producers?: SourceHostAbilityProducer[] | undefined;
  invocations?: SourceHostAbilityInvocation[] | undefined;
  dispatchCompletions: SourceHostAttackDispatchCompletion[];
  hitCallbacks?: SourceHostHitCallback[] | undefined;
}

/** Follow only the audited site graph; a generic task queue becoming empty is not proof. */
export function analyzeSourceHostProducerGraph(plan: SourceHostFiniteCastPlan, evidence: ProducerEvidence, end: number | undefined) {
  const { invocation } = evidence;
  const all = evidence.producers ?? [];
  const producers = all.filter(row => row.invocationId === invocation.id);
  const reasons: string[] = [];
  const roots: SourceHostFiniteRoot[] = invocation.queuedAttacks.map(attack => ({
    attack, startedFrame: invocation.startedFrame, completedFrame: invocation.returnedFrame,
  }));
  for (const producer of producers) for (const attack of producer.queuedAttacks) roots.push({
    attack, producer, startedFrame: producer.startedFrame, completedFrame: producer.completedFrame,
  });
  if (plan.requiresProducers && !evidence.producers) reasons.push("没有原生后续伤害任务回执，不能证明完整范围。");
  const byId = new Map(producers.map(row => [row.id, row]));
  if (byId.size !== producers.length || new Set(all.map(row => row.id)).size !== all.length)
    reasons.push("后续伤害任务编号重复。");
  if (all.some(row => row.parentProducerId !== undefined && byId.has(row.parentProducerId) && row.invocationId !== invocation.id))
    reasons.push("子任务跨越了本次技能调用身份。");
  for (const site of plan.sites) {
    if (producers.filter(row => row.siteId === site.siteId && row.parentProducerId === undefined && row.parentHitCallbackId === undefined).length !== site.rootCount)
      reasons.push(`${site.siteId} 的直接任务注册数与源码分支不符。`);
  }
  const depth = new Map<number, number>();
  for (const row of [...producers].sort((a, b) => a.id - b.id)) {
    const site = plan.sites.find(site => site.siteId === row.siteId);
    const problems: string[] = [];
    const parent = row.parentProducerId === undefined ? undefined : byId.get(row.parentProducerId);
    if (!site) problems.push("任务生成点未被本技能规则覆盖");
    if (row.actorIndex !== invocation.actorIndex || end === undefined || row.queuedFrame > end)
      problems.push("角色或任务注册帧不一致");
    if (row.parentHitCallbackId !== undefined) {
      const callback = evidence.hitCallbacks?.find(callback => callback.id === row.parentHitCallbackId);
      depth.set(row.id, 0);
      if (row.parentProducerId !== undefined || !callback || callback.siteId === undefined
        || !site?.parentCallbackSites?.includes(callback.siteId)
        || row.queuedFrame < callback.startedFrame || row.queuedFrame > callback.completedFrame)
        problems.push("回调任务缺少合法的父命中回调登记区间");
    } else if (row.parentProducerId === undefined) {
      depth.set(row.id, 0);
      if (row.queuedFrame < invocation.startedFrame || row.queuedFrame > invocation.returnedFrame)
        problems.push("根任务未在本次方法调用区间注册");
    } else {
      if (!parent || parent.id >= row.id || !site?.parentSites.includes(parent.siteId)
        || parent.startedFrame === undefined || parent.completedFrame === undefined
        || row.queuedFrame < parent.startedFrame || row.queuedFrame > parent.completedFrame)
        problems.push("缺少合法的父任务生成记录");
      depth.set(row.id, (depth.get(row.parentProducerId) ?? 0) + 1);
    }
    const children = producers.filter(child => child.parentProducerId === row.id);
    const rowDepth = depth.get(row.id)!;
    if (site?.maxDepth !== undefined && (rowDepth > site.maxDepth || rowDepth === site.maxDepth && children.length > 0))
      problems.push("递归任务超过源码检查次数");
    if (row.state === "pending") {
      if (row.startedFrame !== undefined || row.completedFrame !== undefined || row.queuedAttacks.length || children.length)
        problems.push("待执行任务却已记录执行结果");
    } else {
      if (row.startedFrame === undefined || row.completedFrame !== row.startedFrame
        || row.startedFrame < row.queuedFrame || end === undefined || row.startedFrame > end)
        problems.push("任务执行区间不一致");
      const counts = new Map<string, number>();
      for (const child of children) counts.set(child.siteId, (counts.get(child.siteId) ?? 0) + 1);
      if (!site?.outcomes.some(outcome => {
        if (outcome.whenProducerFact !== undefined
          && row.entryFacts?.[outcome.whenProducerFact.name] !== outcome.whenProducerFact.equals) return false;
        const expected = outcome.attackCountFromProducerFact === undefined ? outcome.attackCount
          : row.entryFacts?.[outcome.attackCountFromProducerFact];
        return expected !== undefined && Number.isInteger(expected) && expected >= 0
          && expected === row.queuedAttacks.length
          && (outcome.minDepth === undefined || rowDepth >= outcome.minDepth)
          && (outcome.maxDepth === undefined || rowDepth <= outcome.maxDepth)
          && Object.entries(outcome.children).every(([id, count]) => counts.get(id) === count)
          && [...counts.keys()].every(id => Object.hasOwn(outcome.children, id));
      }))
        problems.push("实际攻击／子任务组合不符合源码分支");
    }
    if (problems.length) reasons.push(`伤害任务 #${row.id} (${row.siteId})：${problems.join("；")}。`);
  }
  const pendingCount = producers.filter(row => row.state === "pending").length;
  if (pendingCount) reasons.push(`仍有 ${pendingCount} 个已注册的伤害任务未执行。`);
  if (plan.prohibitOverlappingInvocations) {
    if (!evidence.invocations || !evidence.producers) reasons.push("缺少其他调用及任务记录，无法检查共享转化状态的重叠。");
    else {
      // Lifetime uses actual receipts, including deliveries after a producer returns.
      // An unfinished branch keeps the interval open through the observation end.
      const lifetimeEnd = (call: SourceHostAbilityInvocation): number => {
        const owned = all.filter(row => row.invocationId === call.id);
        const attacks = [...call.queuedAttacks, ...owned.flatMap(row => row.queuedAttacks)];
        let last = call.returnedFrame;
        if (owned.some(row => row.state !== "completed")) return end ?? Infinity;
        for (const row of owned) last = Math.max(last, row.completedFrame ?? end ?? Infinity);
        for (const attack of attacks) {
          const done = evidence.dispatchCompletions.filter(row => row.attackId === attack.attackId);
          if (attack.attackId === undefined || done.length !== 1) return end ?? Infinity;
          last = Math.max(last, done[0]!.frame);
        }
        return last;
      };
      const last = lifetimeEnd(invocation);
      if (evidence.invocations.some(other => other.id !== invocation.id && other.actorIndex === invocation.actorIndex
        && other.characterKey === invocation.characterKey && other.action === invocation.action
        && other.success && other.startedFrame <= last && lifetimeEnd(other) >= invocation.startedFrame))
        reasons.push("同一角色技能的伤害流程重叠，共享转化状态超出本次已审阅范围。");
    }
  }
  return { roots, reasons, producerCount: producers.length, completedProducerCount: producers.length - pendingCount,
    pendingProducerCount: pendingCount, closed: reasons.length === 0 };
}
