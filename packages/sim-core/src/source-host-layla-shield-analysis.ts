import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostOwnedShieldEvidence } from "./source-host-owned-shield-analysis";
import type { SourceHostShieldHook, SourceHostShieldProducer } from "./source-host-owned-shield-types";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";

const birthSite = "layla.skill.shield", updateSite = "layla.skill.shield-update";
const tickSite = "layla.shield.night-star-tick", shootSite = "layla.shield.shoot";
const gainSites = ["layla.shield.tick-star", "layla.shield.skill-stars", "layla.shield.burst-star"];
const fact = (row: { entryFacts?: Record<string, number> | undefined }, key: string) => row.entryFacts?.[key];
const isInt = (value: number | undefined, min: number, max: number) =>
  value !== undefined && Number.isInteger(value) && value >= min && value <= max;

/** A refresh retains the native shield object and its birth owner. Shooting
 * chains retain that owner after expiry; only a new native shield gate can
 * assign a restarted accumulation task to another actual instance. */
export function analyzeSourceHostLaylaShields(evidence: SourceHostOwnedShieldEvidence, end: number | undefined) {
  const { invocation } = evidence;
  const allInstances = evidence.shieldInstances ?? [], allHooks = evidence.shieldHooks ?? [];
  const allProducers = evidence.shieldProducers ?? [], abilities = evidence.producers ?? [];
  const shields = allInstances.filter(row => row.invocationId === invocation.id && row.creationSiteId === birthSite);
  const ids = new Set(shields.map(row => row.id));
  const ownedProducers = allProducers.filter(row => row.ownerInstanceId !== undefined && ids.has(row.ownerInstanceId));
  const roots: SourceHostFiniteRoot[] = ownedProducers.flatMap(shieldProducer => shieldProducer.queuedAttacks.map(attack => ({
    attack, shieldInstanceId: shieldProducer.ownerInstanceId!, shieldProducer,
    startedFrame: shieldProducer.runFrame, completedFrame: shieldProducer.completedFrame,
  })));
  const reasons: string[] = [];
  const result = { roots, reasons, shieldInstanceIds: [...ids], shieldRelatedExcludedInstanceIds: [] as number[],
    shieldProducerIds: ownedProducers.map(row => row.id), shieldProducerCount: ownedProducers.length,
    completedShieldProducerCount: ownedProducers.filter(row => row.state === "completed").length,
    pendingShieldProducerCount: ownedProducers.filter(row => row.state === "pending").length,
    shieldCount: shields.length, endedShieldCount: 0, openShieldCount: 0, shieldHookCount: 0, closed: false };
  if (!evidence.producers || !evidence.invocations || !evidence.shieldInstances || !evidence.shieldHooks
    || !evidence.shieldProducers || !evidence.taskLifecycle || !evidence.eventRegistrations
    || !evidence.eventEmissions || !evidence.eventListenerCalls || !evidence.hitCallbacks || !evidence.hitCallbackBatches)
    reasons.push("缺少莱依拉 E 的护盾、任务、技能事件或 Q 命中贡献回执。");
  if (end === undefined || evidence.taskLifecycle?.observationFrame !== end)
    reasons.push("莱依拉 E 缺少与任务时钟一致的观察终点。");
  if (new Set(allInstances.map(row => row.id)).size !== allInstances.length
    || new Set(allHooks.map(row => row.id)).size !== allHooks.length
    || new Set(allProducers.map(row => row.id)).size !== allProducers.length)
    reasons.push("莱依拉护盾实例、钩子或任务编号重复。");
  const taskFor = (id: number | undefined) => evidence.taskLifecycle?.tasks.filter(row => row.id === id) ?? [];
  const calls = evidence.invocations ?? [];
  const actorFor = (producerId: number | undefined) => {
    const producer = abilities.find(row => row.id === producerId);
    return producer && calls.find(row => row.id === producer.invocationId);
  };
  const intervalForInstance = (id: number | undefined) => {
    const instance = allInstances.find(row => row.id === id);
    const call = calls.find(row => row.id === instance?.invocationId);
    return call ? call.constellation >= 6 ? 72 : 90 : undefined;
  };
  const updates = abilities.filter(row => row.invocationId === invocation.id && row.siteId === updateSite);
  if (updates.length !== 1) reasons.push("本次 E 缺少唯一的护盾创建／刷新任务。");
  const update = updates[0];
  if (update) {
    const tasks = taskFor(update.taskId), task = tasks[0];
    const queue = evidence.taskLifecycle?.queues.find(row => row.id === task?.queueId);
    const refresh = fact(update, "layla.skill.refresh"), instanceId = fact(update, "layla.skill.shield-instance");
    const instance = allInstances.find(row => row.id === instanceId);
    const refreshHooks = allHooks.filter(row => row.abilityProducerId === update.id && row.siteId === "layla.skill.shield-refresh");
    const ticks = allProducers.filter(row => row.spawnAbilityProducerId === update.id);
    if (update.actorIndex !== invocation.actorIndex || update.parentProducerId !== undefined
      || update.parentHitCallbackId !== undefined || update.queuedFrame !== invocation.startedFrame
      || tasks.length !== 1 || !task || queue?.kind !== "character" || queue.actorIndex !== invocation.actorIndex
      || task.dueClock - task.queuedClock !== 19 || task.origin.creationActionSequence !== invocation.actionSequence
      || task.state !== update.state || task.runFrame !== update.startedFrame || task.completedFrame !== update.completedFrame
      || update.state !== "completed" || update.startedFrame !== update.completedFrame
      || !isInt(refresh, 0, 1) || !instance || instance.actorIndex !== invocation.actorIndex
      || instance.creationSiteId !== birthSite || update.queuedAttacks.length !== 0
      || fact(update, "layla.tick.branch") !== 2 || ticks.length !== 1
      || ticks[0]?.ownerInstanceId !== instanceId || ticks[0]?.siteId !== tickSite)
      reasons.push("E 的 +19 角色局部帧任务、实际护盾分支或首个晚星任务不符。");
    const firstTick = ticks[0], tickTasks = taskFor(firstTick?.taskId), tickTask = tickTasks[0];
    const tickQueue = evidence.taskLifecycle?.queues.find(row => row.id === tickTask?.queueId);
    if (!firstTick || firstTick.parentHookId !== undefined || firstTick.parentProducerId !== undefined
      || tickTasks.length !== 1 || !tickTask || tickQueue?.kind !== "character"
      || tickQueue.actorIndex !== invocation.actorIndex || tickTask.parentTaskId !== update.taskId
      || firstTick.queuedFrame !== update.startedFrame || tickTask.queuedFrame !== firstTick.queuedFrame
      || tickTask.dueClock - tickTask.queuedClock !== intervalForInstance(instanceId)
      || tickTask.state !== firstTick.state || tickTask.runFrame !== firstTick.runFrame
      || tickTask.completedFrame !== firstTick.completedFrame)
      reasons.push("E 更新后的积星任务缺少原生角色队列、父任务或局部延迟登记。");
    if (refresh === 0 && (shields.length !== 1 || shields[0]?.id !== instanceId
      || shields[0]?.spawnProducerId !== update.id || shields[0]?.createdFrame !== update.startedFrame || refreshHooks.length))
      reasons.push("护盾创建分支没有唯一实际出生实例。");
    if (refresh === 1) {
      if (shields.length || !instance || instance.invocationId === invocation.id || refreshHooks.length !== 1
        || refreshHooks[0]?.instanceId !== instanceId || refreshHooks[0]?.cause !== "refresh"
        || refreshHooks[0]?.startedFrame !== update.startedFrame)
        reasons.push("刷新分支应延长原护盾，而不能创建或认领一个新实例。");
      const refreshHook = refreshHooks[0];
      if (refreshHook && instance) {
        const previousHooks = allHooks.filter(row => row.instanceId === instance.id && row.id < refreshHook.id)
          .sort((a, b) => a.id - b.id);
        const previousRefreshes = previousHooks.filter(row => row.siteId === "layla.skill.shield-refresh");
        const previousExpiry = previousRefreshes.length
          ? fact(previousRefreshes[previousRefreshes.length - 1]!, "layla.refresh.expiry-after") : instance.nativeExpiryFrame;
        const previousHP = previousHooks.length ? previousHooks[previousHooks.length - 1]!.hpAfter : instance.initialHP;
        if (refreshHook.completedFrame !== refreshHook.startedFrame || refreshHook.queuedAttacks.length
          || refreshHook.hpBefore !== previousHP || refreshHook.hpAfter !== refreshHook.hpBefore
          || refreshHook.startedFrame < instance.createdFrame
          || instance.terminalFrame !== undefined && refreshHook.startedFrame > instance.terminalFrame
          || fact(refreshHook, "layla.refresh.expiry-before") !== previousExpiry
          || fact(refreshHook, "layla.refresh.expiry-after") !== refreshHook.startedFrame + 720)
          reasons.push("旧盾刷新未保留原护盾量、实际有效期或同帧无伤害操作。");
      }
      if (instanceId !== undefined) result.shieldRelatedExcludedInstanceIds.push(instanceId);
    }
  }
  for (const root of invocation.queuedAttacks) {
    const dispatches = evidence.dispatchCompletions?.filter(row => row.attackId === root.attackId) ?? [];
    if (root.ability !== "Nights of Formal Focus" || root.frame !== invocation.startedFrame
      || !sourceHostAttackTagMatches(root.attackTagName, "AttackTagElementalArt")
      || dispatches.length !== 1 || dispatches[0]!.frame !== invocation.startedFrame + 32)
      reasons.push("E 初击的原生攻击身份或 +32 帧派发不符。");
  }

  // Every observed positive external contribution names the actual shield object.
  for (const call of evidence.eventListenerCalls ?? []) {
    if (call.key !== "stars-skill") continue;
    const instanceId = fact(call, "layla.shield.instance");
    if (instanceId === undefined) { reasons.push("技能事件缺少实际护盾实例读数。"); continue; }
    if (!ids.has(instanceId)) continue;
    const hooks = allHooks.filter(row => row.eventListenerCallId === call.id && row.siteId === "layla.shield.skill-stars");
    const registration = evidence.eventRegistrations?.find(row => row.id === call.registrationId);
    const emission = evidence.eventEmissions?.find(row => row.id === call.emissionId);
    if (call.siteId !== "layla.shield.on-skill" || registration?.key !== call.key
      || registration.eventType !== call.eventType || emission?.eventType !== call.eventType
      || !emission.listenerIds.includes(call.id) || hooks.length !== 1 || hooks[0]?.instanceId !== instanceId
      || hooks[0]?.startedFrame !== call.startedFrame || call.completedFrame !== call.startedFrame)
      reasons.push(`技能事件 #${call.id} 没有对应实际护盾的唯一晚星贡献。`);
  }
  for (const callback of evidence.hitCallbacks ?? []) {
    if (callback.siteId !== "layla.burst.night-star-hit" || !ids.has(fact(callback, "layla.burst.callback.shield-instance") ?? -1)) continue;
    const hooks = allHooks.filter(row => row.hitCallbackId === callback.id && row.siteId === "layla.shield.burst-star");
    if (fact(callback, "layla.burst.callback.first") !== 1 || fact(callback, "layla.burst.callback.shield-present") !== 1
      || hooks.length !== 1 || hooks[0]?.instanceId !== fact(callback, "layla.burst.callback.shield-instance"))
      reasons.push(`Q 命中回调 #${callback.id} 缺少对应实际护盾的唯一晚星贡献。`);
  }

  for (const instance of shields) {
    const hooks = allHooks.filter(row => row.instanceId === instance.id).sort((a, b) => a.id - b.id);
    result.shieldHookCount += hooks.length;
    let expiry = instance.nativeExpiryFrame, hp = instance.initialHP, previousFrame = instance.createdFrame;
    if (instance.actorIndex !== invocation.actorIndex || instance.targetIndex !== -1
      || instance.type !== 15 || instance.description !== "Curtain of Slumber (Shield)" || instance.sourceKeyFrame !== instance.createdFrame
      || expiry !== instance.createdFrame + 720 || instance.creationCallbackId !== undefined
      || instance.creationEventListenerCallId !== undefined)
      reasons.push(`护盾 #${instance.id} 的原生出生身份或有效期不符。`);
    for (const hook of hooks) {
      if (hook.startedFrame < previousFrame || hook.completedFrame !== hook.startedFrame
        || end === undefined || hook.completedFrame > end || hook.hpBefore !== hp
        || hook.cause !== "damage" && hook.hpAfter !== hp || hook.hpAfter < 0 || hook.hpAfter > hp
        || hook.queuedAttacks.length || instance.terminalFrame !== undefined && hook.startedFrame > instance.terminalFrame)
        reasons.push(`护盾钩子 #${hook.id} 的时间、护盾量连续性或直接攻击数不符。`);
      previousFrame = hook.startedFrame; hp = hook.hpAfter;
      if (hook.cause === "refresh") {
        const producer = abilities.find(row => row.id === hook.abilityProducerId), call = actorFor(hook.abilityProducerId);
        if (hook.siteId !== "layla.skill.shield-refresh" || !producer || call?.characterKey !== "layla"
          || call.action !== "skill" || call.actorIndex !== invocation.actorIndex
          || producer.siteId !== updateSite || producer.startedFrame !== hook.startedFrame
          || fact(producer, "layla.skill.refresh") !== 1 || fact(producer, "layla.skill.shield-instance") !== instance.id
          || fact(hook, "layla.refresh.expiry-before") !== expiry
          || fact(hook, "layla.refresh.expiry-after") !== hook.startedFrame + 720)
          reasons.push(`护盾刷新 #${hook.id} 没有精确 E 任务或原有效期衔接。`);
        expiry = fact(hook, "layla.refresh.expiry-after") ?? expiry;
      } else if (hook.cause === "trigger") validateGain(hook);
      else if (hook.siteId !== undefined) reasons.push(`护盾 #${instance.id} 出现未审阅的生命周期站点。`);
    }
    const terminals = hooks.filter(row => row.cause === "expiry" || row.cause === "overwrite"
      || row.cause === "damage" && row.hpAfter === 0);
    if (instance.lastHP !== hp) reasons.push(`护盾 #${instance.id} 末次护盾量与钩子记录不一致。`);
    if (instance.terminalFrame === undefined || instance.terminalReason === undefined || end === undefined
      || instance.terminalFrame > end || terminals.length !== 1 || terminals[0]?.startedFrame !== instance.terminalFrame)
      reasons.push(`护盾 #${instance.id} 尚无唯一实际终点，后续晚星仍可能产生。`);
    else {
      result.endedShieldCount++;
      if (instance.terminalReason === "expired" && (terminals[0]?.cause !== "expiry" || instance.terminalFrame !== expiry)
        || instance.terminalReason === "broken" && (terminals[0]?.cause !== "damage" || hp !== 0)
        || instance.terminalReason === "overwritten" && (terminals[0]?.cause !== "overwrite"
          || !allInstances.some(row => row.id === instance.replacedByInstanceId && row.replacesInstanceId === instance.id)))
        reasons.push(`护盾 #${instance.id} 的终止原因与实际钩子不符。`);
    }
  }

  function validateGain(hook: SourceHostShieldHook) {
    const branch = fact(hook, "layla.stars.branch"), count = fact(hook, "layla.stars.count");
    const before = fact(hook, "layla.stars.before"), after = fact(hook, "layla.stars.after");
    const children = allProducers.filter(row => row.parentHookId === hook.id);
    if (!gainSites.includes(hook.siteId ?? "") || !isInt(branch, 0, 4)
      || count !== (hook.siteId === "layla.shield.skill-stars" ? 2 : 1)
      || branch === 1 && hook.siteId === "layla.shield.burst-star" || branch === 2 && hook.siteId !== "layla.shield.burst-star"
      || branch !== undefined && branch >= 3 && (!isInt(before, 0, 4) || after !== Math.min(before! + count!, 4))
      || branch === 4 && after !== 4 || branch === 3 && after === 4
      || children.length !== (branch === 4 ? 1 : 0)
      || children.some(row => row.siteId !== shootSite || row.ownerInstanceId !== hook.instanceId || row.queuedFrame !== hook.startedFrame))
      reasons.push(`晚星贡献 #${hook.id} 的原生门控、累积或发射任务登记不符。`);
    if (hook.siteId === "layla.shield.tick-star") {
      const producer = allProducers.find(row => row.id === hook.shieldProducerId);
      if (!producer || producer.siteId !== tickSite || fact(producer, "layla.tick.branch") !== 2
        || producer.gateInstanceId !== hook.instanceId || producer.runFrame !== hook.startedFrame)
        reasons.push(`自然晚星 #${hook.id} 没有对应实际护盾门的角色任务。`);
    } else if (hook.siteId === "layla.shield.skill-stars") {
      const call = evidence.eventListenerCalls?.find(row => row.id === hook.eventListenerCallId);
      if (call?.key !== "stars-skill" || call.siteId !== "layla.shield.on-skill"
        || fact(call, "layla.shield.instance") !== hook.instanceId || call.startedFrame !== hook.startedFrame)
        reasons.push(`技能晚星 #${hook.id} 没有对应实际事件调用。`);
    } else if (hook.siteId === "layla.shield.burst-star") {
      const callback = evidence.hitCallbacks?.find(row => row.id === hook.hitCallbackId);
      const batch = evidence.hitCallbackBatches?.find(row => row.id === callback?.batchId);
      const producer = abilities.find(row => row.siteId === "layla.burst.slug" && row.queuedAttacks.some(attack =>
        attack.queueId === batch?.parentQueueId && attack.attackId === batch?.parentAttackId));
      const call = actorFor(producer?.id);
      if (!callback || callback.siteId !== "layla.burst.night-star-hit" || callback.callbackIndex !== 0
        || callback.startedFrame !== hook.startedFrame || fact(callback, "layla.burst.callback.first") !== 1
        || fact(callback, "layla.burst.callback.shield-instance") !== hook.instanceId
        || batch?.state !== "completed" || batch.hitConfirmBlocked || !batch.callbackIds.includes(callback.id)
        || call?.characterKey !== "layla" || call.action !== "burst" || call.actorIndex !== invocation.actorIndex)
        reasons.push(`Q 晚星 #${hook.id} 没有对应 Q 弹体的精确命中回调。`);
    }
  }

  const taskIds = new Set<number>();
  for (const producer of ownedProducers) {
    const tasks = taskFor(producer.taskId), task = tasks[0];
    const queue = evidence.taskLifecycle?.queues.find(row => row.id === task?.queueId);
    const parent = allProducers.find(row => row.id === producer.parentProducerId);
    const hook = allHooks.find(row => row.id === producer.parentHookId);
    const ability = abilities.find(row => row.id === producer.spawnAbilityProducerId);
    let delay: number | undefined;
    let registeredFrame: number | undefined;
    if ([producer.parentProducerId, producer.parentHookId, producer.spawnAbilityProducerId].filter(value => value !== undefined).length !== 1)
      reasons.push(`护盾任务 #${producer.id} 缺少唯一原生注册上下文。`);
    if (hook) {
      registeredFrame = hook.startedFrame; delay = 6;
      if (producer.siteId !== shootSite || fact(hook, "layla.stars.branch") !== 4
        || producer.ownerInstanceId !== hook.instanceId || hook.cause !== "trigger")
        reasons.push(`护盾任务 #${producer.id} 不是已满四星的实际发射登记。`);
    } else if (ability) {
      registeredFrame = ability.startedFrame; delay = intervalForInstance(producer.ownerInstanceId);
      if (producer.siteId !== tickSite || ability.siteId !== updateSite
        || fact(ability, "layla.tick.branch") !== 2 || fact(ability, "layla.skill.shield-instance") !== producer.ownerInstanceId
        || actorFor(ability.id)?.actorIndex !== invocation.actorIndex)
        reasons.push(`晚星任务 #${producer.id} 没有实际 E 护盾更新登记。`);
    } else if (parent) {
      registeredFrame = parent.runFrame;
      if (producer.siteId === tickSite) {
        delay = intervalForInstance(producer.ownerInstanceId);
        if (!(parent.siteId === tickSite || parent.siteId === shootSite && fact(parent, "layla.shoot.branch") === 5)
          || fact(parent, "layla.tick.branch") !== 2 || !parent.gateObserved || parent.gateInstanceId !== producer.ownerInstanceId)
          reasons.push(`晚星任务 #${producer.id} 没有通过父任务的实际护盾门。`);
      } else if (producer.siteId === shootSite) {
        const branch = fact(parent, "layla.shoot.branch");
        delay = branch === 2 ? 6 : branch === 3 ? 30 : branch === 4 ? 27 : undefined;
        if (parent.siteId !== shootSite || parent.ownerInstanceId !== producer.ownerInstanceId || delay === undefined)
          reasons.push(`星矢任务 #${producer.id} 的递归分支或出生护盾归属不符。`);
      }
    }
    if (!task || tasks.length !== 1 || taskIds.has(producer.taskId) || !queue || delay === undefined
      || producer.queuedFrame !== registeredFrame || task.queuedFrame !== producer.queuedFrame
      || task.dueClock - task.queuedClock !== delay || task.state !== producer.state
      || task.runFrame !== producer.runFrame || task.completedFrame !== producer.completedFrame
      || queue.kind !== (producer.siteId === tickSite ? "character" : "core")
      || producer.siteId === tickSite && queue.actorIndex !== invocation.actorIndex
      || parent && task.parentTaskId !== parent.taskId || ability && task.parentTaskId !== ability.taskId)
      reasons.push(`护盾任务 #${producer.id} 的任务编号、局部时钟或父登记不符。`);
    taskIds.add(producer.taskId);
    const children = allProducers.filter(row => row.parentProducerId === producer.id);
    const gains = allHooks.filter(row => row.shieldProducerId === producer.id && row.cause === "trigger");
    if (producer.state === "pending") {
      reasons.push(`护盾任务 #${producer.id} 尚待执行；护盾结束不会自动取消在途星矢。`);
      if (producer.runFrame !== undefined || producer.completedFrame !== undefined || producer.queuedAttacks.length || children.length || gains.length)
        reasons.push(`待执行护盾任务 #${producer.id} 却已有执行结果。`);
      continue;
    }
    if (producer.runFrame === undefined || producer.completedFrame !== producer.runFrame
      || end === undefined || producer.completedFrame > end || task && queue && queue.clock < task.dueClock)
      reasons.push(`护盾任务 #${producer.id} 没有完整执行终点。`);
    if (producer.siteId === tickSite) {
      const branch = fact(producer, "layla.tick.branch");
      if (!isInt(branch, 0, 2) || producer.queuedAttacks.length || children.length !== (branch === 2 ? 1 : 0)
        || children.some(row => row.siteId !== tickSite || row.ownerInstanceId !== producer.gateInstanceId)
        || gains.length !== (branch === 2 ? 1 : 0) || gains.some(row => row.siteId !== "layla.shield.tick-star")
        || branch === 0 && producer.gateObserved || branch !== 0 && !producer.gateObserved
        || branch === 1 && producer.gateInstanceId !== undefined || branch === 2 && producer.gateInstanceId === undefined)
        reasons.push(`自然晚星任务 #${producer.id} 的取消、护盾门或下一次登记不符。`);
    } else if (producer.siteId === shootSite) {
      const branch = fact(producer, "layla.shoot.branch"), before = fact(producer, "layla.shoot.stars-before"), after = fact(producer, "layla.shoot.stars-after");
      const emits = branch === 4 || branch === 5;
      const tickBranch = fact(producer, "layla.tick.branch");
      const expectedChildren = branch === 2 || branch === 3 || branch === 4 || branch === 5 && tickBranch === 2 ? 1 : 0;
      if (!isInt(branch, 0, 5) || producer.queuedAttacks.length !== (emits ? 1 : 0)
        || gains.length || children.length !== expectedChildren
        || children.some(row => row.siteId !== (branch === 5 ? tickSite : shootSite))
        || emits && (!isInt(before, 1, 4) || after !== before! - 1 || (branch === 5) !== (after === 0))
        || branch === 5 && (!isInt(tickBranch, 0, 2) || tickBranch === 0 && producer.gateObserved
          || tickBranch !== 0 && !producer.gateObserved || tickBranch === 1 && producer.gateInstanceId !== undefined
          || tickBranch === 2 && producer.gateInstanceId === undefined))
        reasons.push(`星矢任务 #${producer.id} 的寻敌、逐星发射或重新积星分支不符。`);
      for (const attack of producer.queuedAttacks) {
        const dispatch = evidence.dispatchCompletions?.filter(row => row.attackId === attack.attackId) ?? [];
        const travel = before === undefined ? undefined : [35, 33, 30, 28][4 - before];
        if (attack.emitSiteId !== "layla.shield.shooting-star" || attack.ability !== "Shooting Star"
          || !sourceHostAttackTagMatches(attack.attackTagName, "AttackTagElementalArt")
          || attack.frame !== producer.runFrame || travel === undefined || dispatch.length !== 1
          || dispatch[0]!.frame !== attack.frame + travel)
          reasons.push(`星矢队列 #${attack.queueId} 的来源、攻击身份或实际飞行时间不符。`);
      }
    } else reasons.push(`未审阅的莱依拉护盾任务 ${producer.siteId}。`);
  }
  result.openShieldCount = result.shieldCount - result.endedShieldCount;
  result.closed = reasons.length === 0;
  return result;
}
