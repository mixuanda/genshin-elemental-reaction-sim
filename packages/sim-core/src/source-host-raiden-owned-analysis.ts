import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { z } from "zod";
import type { sourceHostAttackObservationSchema, SourceHostStatusInstance } from "./source-host-action-origin";
import type { SourceHostAttackDispatchCompletion } from "./source-host-finite-cast-types";
import type { SourceHostOwnedGeneratorEvidence, SourceHostOwnedGeneratorAnalysis } from "./source-host-owned-generator-analysis";
import type { SourceHostEventRegistration, SourceHostEventEmission, SourceHostEventListenerCall, SourceHostEventProducer } from "./source-host-event-types";
import { getSourceHostEventComponentRule } from "./source-host-event-rules";

const generatorSite = "raiden.skill.eye-modifier";
const activationSite = "raiden.skill.eye-activate";
const triggerSite = "raiden.skill.eye.enemy-damage";
const emitSite = "raiden.skill.eye-strike";

function terminalFrame(status: SourceHostStatusInstance, activatedFrame: number, end: number | undefined) {
  if (end === undefined) return undefined;
  if ((status.endState === "replaced" || status.endState === "removed")
    && status.endFrame >= activatedFrame && status.endFrame <= end) return status.endFrame;
  // StatusIsActive still accepts the exact expiry frame. AttackMod deletion is
  // recorded as removed when the native ApplyAttackMods loop actually deletes it.
  if (status.endState === "expired-at-end" && status.finalExpiryFrame >= activatedFrame
    && status.finalExpiryFrame < end && status.endFrame === end) return status.finalExpiryFrame;
  return undefined;
}

/** Each party AttackMod has its own holder, producer, native instance and lifetime. */
export function analyzeSourceHostRaidenOwnedGenerators(
  evidence: SourceHostOwnedGeneratorEvidence, end: number | undefined,
): SourceHostOwnedGeneratorAnalysis {
  const result: SourceHostOwnedGeneratorAnalysis = { roots: [], reasons: [], generatorCount: 0,
    endedGeneratorCount: 0, openGeneratorCount: 0, triggerCount: 0, closed: false };
  const { invocation } = evidence, { reasons, roots } = result;
  const allGenerators = evidence.ownedGenerators ?? [], allTriggers = evidence.ownedGeneratorTriggers ?? [];
  const statuses = evidence.statusInstances ?? [], allProducers = evidence.producers ?? [];
  if (!evidence.ownedGenerators || !evidence.ownedGeneratorTriggers || !evidence.statusInstances || !evidence.producers)
    reasons.push("雷电 E 缺少原生持有者状态、生成器、触发或激活任务清单。");
  if (end === undefined || end < invocation.returnedFrame)
    reasons.push("没有覆盖雷电 E 调用的实际观察终点。");
  if (new Set(allGenerators.map(row => row.id)).size !== allGenerators.length
    || new Set(allTriggers.map(row => row.id)).size !== allTriggers.length
    || new Set(statuses.map(row => row.instanceId)).size !== statuses.length
    || new Set(allProducers.map(row => row.id)).size !== allProducers.length)
    reasons.push("雷电 E 状态、生成器、触发或激活任务编号重复。");
  const partyCount = invocation.entryFacts?.["raiden.skill.party-count"];
  const partyCountValid = partyCount !== undefined && Number.isInteger(partyCount) && partyCount >= 1 && partyCount <= 4;
  if (!partyCountValid) reasons.push("雷电 E 缺少固定源码队伍人数读数，或人数超出 1 至 4。");
  const generators = allGenerators.filter(row => row.invocationId === invocation.id);
  const activationProducers = allProducers.filter(row => row.invocationId === invocation.id && row.siteId === activationSite);
  result.generatorCount = generators.length;
  if (!partyCountValid || generators.length !== partyCount || activationProducers.length !== partyCount)
    reasons.push("本次雷电 E 必须为每个队伍持有者登记一个状态生成器和一个延迟激活任务。");
  const holders = generators.map(row => row.holderActorIndex);
  if (new Set(holders).size !== holders.length || holders.some(index => index === undefined
    || !partyCountValid || index >= partyCount!)
    || partyCountValid && Array.from({ length: partyCount }, (_, index) => index).some(index => !holders.includes(index)))
    reasons.push("雷电 E 的持有者编号没有恰好覆盖本次原生队伍。");
  if (new Set(generators.map(row => row.statusInstanceId)).size !== generators.length
    || new Set(generators.map(row => row.activationProducerId)).size !== generators.length)
    reasons.push("多个雷电 E 持有者复用了同一状态实例或激活任务。");
  const queueIds: number[] = [], attackIds: number[] = [];
  for (const generator of generators) {
    const status = statuses.find(row => row.instanceId === generator.statusInstanceId);
    const producer = activationProducers.find(row => row.id === generator.activationProducerId);
    if (generator.siteId !== generatorSite || generator.actorIndex !== invocation.actorIndex
      || generator.holderActorIndex === undefined || !status || status.actorIndex !== generator.holderActorIndex
      || status.statusKey !== "raiden-e" || status.createdFrame !== generator.activatedFrame
      || status.creationActionSequence !== invocation.actionSequence
      || status.initialExpiryFrame !== status.createdFrame + 1500 || status.finalExpiryFrame < status.initialExpiryFrame)
      reasons.push(`雷电 E 生成器 #${generator.id} 的施放者、持有者或原生 AttackMod 状态不符。`);
    if (!producer || producer.actorIndex !== invocation.actorIndex || producer.state !== "completed"
      || producer.entryFacts?.["raiden.skill.holder-index"] !== generator.holderActorIndex
      || producer.parentProducerId !== undefined || producer.parentHitCallbackId !== undefined
      || producer.queuedFrame !== invocation.startedFrame
      || producer.startedFrame !== invocation.startedFrame + 66 || producer.completedFrame !== producer.startedFrame
      || generator.activatedFrame !== producer.startedFrame || producer.queuedAttacks.length !== 0
      || end === undefined || producer.completedFrame === undefined || producer.completedFrame > end)
      reasons.push(`雷电 E 生成器 #${generator.id} 缺少同一持有者的唯一 +66 帧已完成激活任务。`);
    const endedAt = status === undefined ? undefined : terminalFrame(status, generator.activatedFrame, end);
    if (endedAt === undefined) reasons.push(`雷电 E 持有者状态 #${generator.statusInstanceId} 仍活跃或缺少原生生命周期终点。`);
    else result.endedGeneratorCount++;
    if (allGenerators.some(row => row.id !== generator.id && row.statusInstanceId === generator.statusInstanceId)
      || allTriggers.some(row => row.generatorId !== generator.id && row.origin.statusOwner?.instanceId === generator.statusInstanceId))
      reasons.push(`雷电 E 状态 #${generator.statusInstanceId} 出现其他生成器或未归属触发。`);
    const triggers = allTriggers.filter(row => row.generatorId === generator.id).sort((a, b) => a.id - b.id);
    result.triggerCount += triggers.length;
    const ids = new Set(triggers.map(row => row.id));
    if (new Set(generator.triggerIds).size !== generator.triggerIds.length || ids.size !== generator.triggerIds.length
      || generator.triggerIds.some(id => !ids.has(id)))
      reasons.push(`雷电 E 生成器 #${generator.id} 的登记触发与实际回执不一致。`);
    let lastFrame = generator.activatedFrame;
    for (const trigger of triggers) {
      const owner = trigger.origin.statusOwner, attack = trigger.queuedAttacks[0];
      if (trigger.siteId !== triggerSite || trigger.kind !== "enemy-damage"
        || trigger.startedFrame < lastFrame || trigger.completedFrame !== trigger.startedFrame
        || end === undefined || trigger.completedFrame > end || endedAt !== undefined && trigger.completedFrame > endedAt
        || status !== undefined && trigger.startedFrame > status.finalExpiryFrame
        || !status || !owner || owner.instanceId !== status.instanceId || owner.actorIndex !== status.actorIndex
        || owner.statusKey !== status.statusKey || owner.createdFrame !== status.createdFrame
        || owner.creationActionSequence !== status.creationActionSequence
        || trigger.queuedAttacks.length !== 1 || !attack || attack.emitSiteId !== emitSite
        || attack.frame !== trigger.startedFrame)
        reasons.push(`雷电 E 触发 #${trigger.id} 的持有者状态、执行区间或单次攻击发射点不符。`);
      lastFrame = trigger.startedFrame;
      for (const queued of trigger.queuedAttacks) {
        queueIds.push(queued.queueId);
        if (queued.attackId !== undefined) attackIds.push(queued.attackId);
        roots.push({ attack: queued, ownedTrigger: trigger, statusInstanceId: generator.statusInstanceId,
          startedFrame: trigger.startedFrame, completedFrame: trigger.completedFrame });
      }
    }
  }
  const currentGeneratorIds = new Set(generators.map(row => row.id));
  const casterGeneratorIds = new Set(allGenerators.filter(row => row.siteId === generatorSite
    && row.actorIndex === invocation.actorIndex).map(row => row.id));
  const orderedTriggers = allTriggers.filter(row => casterGeneratorIds.has(row.generatorId)
    && row.siteId === triggerSite && row.kind === "enemy-damage")
    .sort((a, b) => a.startedFrame - b.startedFrame);
  if (orderedTriggers.some((trigger, index) => index > 0
    && (currentGeneratorIds.has(trigger.generatorId) || currentGeneratorIds.has(orderedTriggers[index - 1]!.generatorId))
    && trigger.startedFrame - orderedTriggers[index - 1]!.startedFrame < 54))
    reasons.push("同一雷电施放者的恶曜之眼跨 E 刷新共享 54 帧冷却，出现涉及本次状态的过早重复成功触发。");
  result.openGeneratorCount = result.generatorCount - result.endedGeneratorCount;
  if (new Set(queueIds).size !== queueIds.length || new Set(attackIds).size !== attackIds.length)
    reasons.push("雷电 E 协同攻击的队列或攻击编号重复。");
  result.closed = reasons.length === 0;
  return result;
}

interface SourceHostRaidenOwnedEventEvidence extends SourceHostOwnedGeneratorEvidence {
  dispatchCompletions: SourceHostAttackDispatchCompletion[];
  observations: Array<{ sourceIndex: number; row: z.infer<typeof sourceHostAttackObservationSchema> }>;
  eventRegistrations?: SourceHostEventRegistration[] | undefined;
  eventEmissions?: SourceHostEventEmission[] | undefined;
  eventListenerCalls?: SourceHostEventListenerCall[] | undefined;
  eventProducers?: SourceHostEventProducer[] | undefined;
}

/** Bind each successful existing eye event to exactly one holder generator emit. */
export function analyzeSourceHostRaidenOwnedEvents(evidence: SourceHostRaidenOwnedEventEvidence, end: number | undefined) {
  const reasons: string[] = [];
  const { invocation } = evidence;
  if (invocation.characterKey !== "raidenshogun" || invocation.action !== "skill") return { reasons, closed: true };
  const rule = getSourceHostEventComponentRule("raiden-eye-followup");
  if (rule.kind !== "direct") return { reasons: ["雷电恶曜之眼事件组件缺少已审阅的直接攻击规则。"], closed: false };
  const registrations = evidence.eventRegistrations ?? [], emissions = evidence.eventEmissions ?? [];
  const calls = evidence.eventListenerCalls ?? [], producers = evidence.eventProducers ?? [];
  if (!evidence.eventRegistrations || !evidence.eventEmissions || !evidence.eventListenerCalls || !evidence.eventProducers)
    reasons.push("雷电完整 E 缺少原生事件注册、发射、调用或事件任务清单。");
  if ([registrations, emissions, calls, producers].some(rows => new Set(rows.map(row => row.id)).size !== rows.length))
    reasons.push("雷电 E 事件回执编号重复。");
  const generators = (evidence.ownedGenerators ?? []).filter(row => row.invocationId === invocation.id);
  const generatorIds = new Set(generators.map(row => row.id)), statusIds = new Set(generators.map(row => row.statusInstanceId));
  const triggers = (evidence.ownedGeneratorTriggers ?? []).filter(row => generatorIds.has(row.generatorId));
  const observations = new Map(evidence.observations.map(entry => [entry.sourceIndex, entry.row]));
  const scopedCalls = calls.filter(call => call.siteId === rule.siteId
    && (statusIds.has(call.entryFacts?.["raiden.eye.enemy-damage.status-instance"] ?? -1)
      || call.queuedAttacks.some(attack => statusIds.has(observations.get(attack.queueId - 1)?.origin?.statusOwner?.instanceId ?? -1))));
  const seenCalls = new Set<number>();
  for (const trigger of triggers) {
    const matching = scopedCalls.filter(call => call.queuedAttacks.some(eventAttack => trigger.queuedAttacks.some(ownedAttack =>
      eventAttack.queueId === ownedAttack.queueId && eventAttack.attackId === ownedAttack.attackId)));
    if (matching.length !== 1) {
      reasons.push(`雷电 E 触发 #${trigger.id} 缺少同一攻击队列绑定的唯一恶曜之眼事件调用。`);
      continue;
    }
    const call = matching[0]!, generator = generators.find(row => row.id === trigger.generatorId);
    if (seenCalls.has(call.id)) reasons.push(`恶曜之眼事件 #${call.id} 被重复归属多个持有者触发。`);
    seenCalls.add(call.id);
    const attack = call.queuedAttacks[0], ownedAttack = trigger.queuedAttacks[0];
    if (!generator || call.key !== rule.key || call.entryFacts?.["raiden.eye.enemy-damage.status-instance"] !== generator.statusInstanceId
      || call.entryFacts?.["raiden.eye.enemy-damage.holder-index"] !== generator.holderActorIndex
      || call.entryFacts?.[rule.attackCountFact] !== 1
      || call.startedFrame !== trigger.startedFrame || call.completedFrame !== trigger.completedFrame
      || call.queuedAttacks.length !== 1 || trigger.queuedAttacks.length !== 1 || !attack || !ownedAttack
      || attack.emitSiteId !== rule.directEmitSite || ownedAttack.emitSiteId !== emitSite
      || attack.ability !== rule.ability || !sourceHostAttackTagMatches(attack.attackTagName, rule.attackTag)
      || attack.queueId !== ownedAttack.queueId || attack.attackId !== ownedAttack.attackId
      || attack.ability !== ownedAttack.ability || attack.attackTagName !== ownedAttack.attackTagName
      || attack.frame !== ownedAttack.frame || attack.frame !== call.startedFrame)
      reasons.push(`恶曜之眼事件 #${call.id} 的持有者状态、分支读数或排队攻击身份不符。`);
    if (producers.some(row => row.listenerCallId === call.id))
      reasons.push(`恶曜之眼事件 #${call.id} 出现未审阅的延迟事件攻击任务。`);
    const registered = registrations.filter(row => row.id === call.registrationId);
    const emitted = emissions.filter(row => row.id === call.emissionId);
    if (registered.length !== 1 || emitted.length !== 1) {
      reasons.push(`恶曜之眼事件 #${call.id} 缺少唯一注册或发射身份。`);
      continue;
    }
    const registration = registered[0]!, emission = emitted[0]!;
    if (registration.siteId !== rule.siteId || registration.key !== rule.key || registration.slotIndex !== call.slotIndex
      || registration.eventType !== call.eventType || emission.eventType !== call.eventType
      || emission.mode !== "gameplay" || emission.listenerIds.filter(id => id === call.id).length !== 1
      || emission.suppressedListenerIds.includes(registration.id) || registration.createdFrame > emission.frame
      || registration.endedFrame !== undefined && registration.endedFrame < emission.frame
      || call.startedFrame !== emission.frame || call.completedFrame !== call.startedFrame
      || emission.completedFrame < call.completedFrame || end === undefined || emission.completedFrame > end)
      reasons.push(`恶曜之眼事件 #${call.id} 的原生注册、执行名单或时序不符。`);
    const childDispatches = evidence.dispatchCompletions.filter(row => row.attackId === attack?.attackId);
    if (childDispatches.length !== 1 || childDispatches[0]!.frame !== call.startedFrame + 5)
      reasons.push(`恶曜之眼事件 #${call.id} 缺少原生 +5 帧快照并派发的完成回执。`);
    const parents = evidence.dispatchCompletions.filter(row => row.attackId === emission.parentAttackId && row.dispatchId === emission.parentDispatchId);
    const targets = evidence.observations.filter(({ row }) => row.attackId === emission.parentAttackId
      && row.dispatchId === emission.parentDispatchId && row.targetKey === emission.targetKey && row.stage === "resolved");
    const parentQueued = emission.parentQueueId === undefined ? undefined : observations.get(emission.parentQueueId - 1);
    const childQueued = attack === undefined ? undefined : observations.get(attack.queueId - 1);
    if (emission.parentAttackId === undefined || emission.parentDispatchId === undefined
      || !parentQueued || parentQueued.stage !== "queued" || parentQueued.attackId !== emission.parentAttackId
      || parents.length !== 1 || !parents[0]!.enemyTargetKeys.includes(emission.targetKey)
      || targets.length !== 1 || targets[0]!.row.frame !== parents[0]!.frame || emission.frame !== targets[0]!.row.frame
      || childQueued?.origin?.via !== "event-callback" || childQueued.origin.eventKey !== rule.key
      || childQueued.origin.eventType !== call.eventType
      || childQueued.origin.parentAttackId !== emission.parentAttackId
      || JSON.stringify(childQueued.origin) !== JSON.stringify(trigger.origin))
      reasons.push(`恶曜之眼事件 #${call.id} 缺少实际触发攻击和目标身份，或改变了原生事件来源／触发时状态归属。`);
  }
  const successfulCalls = scopedCalls.filter(call => call.queuedAttacks.length > 0 || call.entryFacts?.[rule.attackCountFact] !== 0);
  if (successfulCalls.length !== seenCalls.size || successfulCalls.some(call => !seenCalls.has(call.id)))
    reasons.push("雷电 E 持有者实际发出的恶曜之眼攻击与状态生成器触发清单不完整或不一致。");
  return { reasons, closed: reasons.length === 0 };
}
