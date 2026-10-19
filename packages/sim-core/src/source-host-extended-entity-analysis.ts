import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostAbilityProducer } from "./source-host-finite-cast-types";
import type {
  SourceHostOwnedEntity, SourceHostOwnedEntityProducer, SourceHostOwnedEntityQueuedAttack,
  SourceHostOwnedEntityTrigger,
} from "./source-host-owned-entity-types";
import type { SourceHostOwnedEntityAnalysis, SourceHostOwnedEntityEvidence } from "./source-host-owned-entity-analysis";

type ContractId = "xiangling-skill" | "yaoyao-burst";

const rules = {
  "xiangling-skill": {
    entitySite: "xiangling.skill.guoba", directAttackCount: 0,
    spawns: [{ site: "xiangling.skill.spawn-guoba", delay: 13 }],
  },
  "yaoyao-burst": {
    entitySite: "yaoyao.burst.yuegui-jumping", directAttackCount: 1,
    spawns: [
      { site: "yaoyao.burst.jump-yuegui-1", delay: 104 },
      { site: "yaoyao.burst.jump-yuegui-2", delay: 162 },
      { site: "yaoyao.burst.jump-yuegui-3", delay: 221 },
    ],
  },
} as const;

function sameIds(declared: number[], observed: number[]): boolean {
  const ids = new Set(declared);
  return ids.size === declared.length && new Set(observed).size === observed.length
    && ids.size === observed.length && observed.every(id => ids.has(id));
}

/** Birth ownership survives early removal and already launched projectiles. */
export function analyzeSourceHostExtendedOwnedEntities(
  contractId: ContractId, evidence: SourceHostOwnedEntityEvidence, end: number | undefined,
): SourceHostOwnedEntityAnalysis {
  const rule = rules[contractId], { invocation } = evidence;
  const result: SourceHostOwnedEntityAnalysis = {
    roots: [], reasons: [], entityCount: 0, endedEntityCount: 0, openEntityCount: 0,
    entityTriggerCount: 0, entityProducerCount: 0, completedEntityProducerCount: 0,
    pendingEntityProducerCount: 0, closed: false,
  };
  const { reasons, roots } = result;
  if (!evidence.producers || !evidence.ownedEntities || !evidence.ownedEntityTriggers
    || !evidence.ownedEntityProducers || !evidence.taskLifecycle)
    reasons.push("缺少实体生成、实际 Tick 次数、飞行任务或原生队列生命周期回执。");
  if (end === undefined || end < invocation.returnedFrame)
    reasons.push("没有覆盖本次技能调用的实际观察终点。");
  if (invocation.queuedAttacks.length !== rule.directAttackCount)
    reasons.push("本次技能方法直接排队攻击数与实体来源规则不符。");

  const allEntities = evidence.ownedEntities ?? [];
  const allTriggers = evidence.ownedEntityTriggers ?? [];
  const allFlights = evidence.ownedEntityProducers ?? [];
  if ([allEntities, allTriggers, allFlights].some(rows => new Set(rows.map(row => row.id)).size !== rows.length))
    reasons.push("实体、触发或飞行任务编号重复。");
  const entities = allEntities.filter(row => row.invocationId === invocation.id);
  const entityIds = new Set(entities.map(row => row.id));
  const flights = allFlights.filter(row => entityIds.has(row.entityId));
  result.entityCount = entities.length;
  result.entityTriggerCount = allTriggers.filter(row => entityIds.has(row.entityId)).length;
  result.entityProducerCount = flights.length;
  result.completedEntityProducerCount = flights.filter(row => row.state === "completed").length;
  result.pendingEntityProducerCount = flights.length - result.completedEntityProducerCount;

  const spawnTasks = new Map<number, SourceHostAbilityProducer>();
  for (const spawnRule of rule.spawns) {
    const matching = (evidence.producers ?? []).filter(row => row.invocationId === invocation.id && row.siteId === spawnRule.site);
    if (matching.length !== 1) reasons.push(`${spawnRule.site} 缺少唯一的原生实体生成任务。`);
    for (const spawn of matching) {
      spawnTasks.set(spawn.id, spawn);
      const tasks = evidence.taskLifecycle?.tasks.filter(row => row.id === spawn.taskId) ?? [];
      const task = tasks.length === 1 ? tasks[0] : undefined;
      const queue = evidence.taskLifecycle?.queues.find(row => row.id === task?.queueId);
      if (spawn.actorIndex !== invocation.actorIndex || spawn.parentProducerId !== undefined
        || spawn.parentHitCallbackId !== undefined || spawn.queuedFrame !== invocation.startedFrame
        || !task || queue?.kind !== "core" || task.queuedFrame !== spawn.queuedFrame
        || task.dueClock - task.queuedClock !== spawnRule.delay || task.state !== spawn.state
        || task.runFrame !== spawn.startedFrame || task.completedFrame !== spawn.completedFrame
        || spawn.queuedAttacks.length !== 0)
        reasons.push(`实体生成任务 #${spawn.id} 缺少相同角色、来源、任务编号或准确原生延迟。`);
      const spawned = allEntities.filter(row => row.spawnProducerId === spawn.id);
      if (spawn.state === "pending") {
        if (spawn.startedFrame !== undefined || spawn.completedFrame !== undefined || spawned.length)
          reasons.push(`待执行实体生成任务 #${spawn.id} 却已有出生结果。`);
        reasons.push(`实体生成任务 #${spawn.id} 尚待执行，不能将未出生实体解释为零伤害。`);
        continue;
      }
      if (spawn.startedFrame !== spawn.queuedFrame + spawnRule.delay || spawn.completedFrame !== spawn.startedFrame
        || end === undefined || spawn.completedFrame === undefined || spawn.completedFrame > end)
        reasons.push(`实体生成任务 #${spawn.id} 的实际执行区间不符合原生核心队列。`);
      const count = contractId === "xiangling-skill" ? 1 : spawn.entryFacts?.[`${spawn.siteId}.spawn-count`];
      if (count !== 0 && count !== 1 || spawned.length !== count
        || spawned.some(entity => entity.invocationId !== invocation.id))
        reasons.push(`实体生成任务 #${spawn.id} 的出生结果与源码分支读数不符。`);
    }
  }

  const queueIds: number[] = [];
  const appendAttack = (entity: SourceHostOwnedEntity, attack: SourceHostOwnedEntityQueuedAttack,
    trigger?: SourceHostOwnedEntityTrigger, producer?: SourceHostOwnedEntityProducer) => {
    const started = trigger?.startedFrame ?? producer?.startedFrame;
    const completed = trigger?.completedFrame ?? producer?.completedFrame;
    queueIds.push(attack.queueId);
    roots.push({ attack, entityId: entity.id, ...(trigger ? { entityTrigger: trigger } : {}),
      ...(producer ? { entityProducer: producer } : {}), startedFrame: started, completedFrame: completed });
    const guoba = contractId === "xiangling-skill";
    if (attack.emitSiteId !== (guoba ? "xiangling.skill.guoba-breath" : "yaoyao.skill.radish")
      || attack.ability !== (guoba ? "Guoba" : "Radish (Burst)")
      || !sourceHostAttackTagMatches(attack.attackTagName, guoba ? "AttackTagElementalArt" : "AttackTagElementalBurst")
      || started === undefined || completed !== started || attack.frame !== started)
      reasons.push(`实体攻击队列 #${attack.queueId} 的来源点、能力、标签或执行区间不符。`);
  };

  for (const entity of entities) {
    const spawn = entity.spawnProducerId === undefined ? undefined : spawnTasks.get(entity.spawnProducerId);
    if (entity.kind !== "gadget" || entity.siteId !== rule.entitySite || entity.actorIndex !== invocation.actorIndex
      || entity.parentEntityId !== undefined || !spawn || spawn.state !== "completed"
      || entity.createdFrame !== spawn.startedFrame || entity.createdFrame !== spawn.completedFrame)
      reasons.push(`实体 #${entity.id} 缺少同一调用内唯一的生成任务和出生身份。`);

    const ended = entity.endedFrame !== undefined && entity.endReason !== undefined
      && entity.endedFrame >= entity.createdFrame && end !== undefined && entity.endedFrame <= end;
    if (ended) result.endedEntityCount++;
    else reasons.push(`实体 #${entity.id} 尚未取得观察窗口内的实际移除终点。`);
    const ticks = entity.tickCount;
    const validTicks = ticks !== undefined && Number.isInteger(ticks) && ticks >= 0
      && end !== undefined && entity.createdFrame + ticks <= end;
    if (!validTicks) reasons.push(`实体 #${entity.id} 缺少实际原生 Tick 次数，不能按攻击记录反推完整周期。`);
    else if (ended && (entity.endedFrame! < entity.createdFrame + ticks
      || entity.endedFrame! > entity.createdFrame + ticks + 1))
      reasons.push(`实体 #${entity.id} 的实际 Tick 次数与移除时序不符。`);
    if (contractId === "xiangling-skill" && (ticks !== undefined && ticks > 438
      || entity.endReason === "expired" && ticks !== 438))
      reasons.push(`锅巴实体 #${entity.id} 的 Tick 次数与 438 次原生寿命不符。`);
    if (contractId === "yaoyao-burst" && ended && (entity.endReason !== "killed"
      || entity.endedFrame! > invocation.startedFrame + 360))
      reasons.push(`跳跃型月桂 #${entity.id} 未在本次爆发的移除范围内结束。`);

    const triggers = allTriggers.filter(row => row.entityId === entity.id).sort((a, b) => a.id - b.id);
    const producers = flights.filter(row => row.entityId === entity.id);
    if (!sameIds(entity.triggerIds, triggers.map(row => row.id)) || !sameIds(entity.producerIds, producers.map(row => row.id)))
      reasons.push(`实体 #${entity.id} 登记的触发和飞行任务清单不完整。`);
    const thoughts = triggers.filter(row => row.kind === "think");
    if (validTicks) {
      const guobaTicks = [103, 203, 303, 403].filter(tick => tick <= ticks!);
      const expectedCount = contractId === "xiangling-skill" ? guobaTicks.length
        : ticks! < 29 ? 0 : Math.floor((ticks! - 29) / 60) + 1;
      if (thoughts.length !== expectedCount || thoughts.some((trigger, index) => trigger.startedFrame !== entity.createdFrame
        + (contractId === "xiangling-skill" ? guobaTicks[index]! : 29 + index * 60)))
        reasons.push(`实体 #${entity.id} 的攻击触发清单未覆盖其实际 Tick 分支。`);
    }
    const terminal = triggers.filter(row => row.kind !== "think");
    if (contractId === "xiangling-skill" ? terminal.length !== 0
      : ended ? terminal.length !== 1 || terminal[0]?.kind !== "kill" || terminal[0]?.completedFrame !== entity.endedFrame
        : terminal.length !== 0)
      reasons.push(`实体 #${entity.id} 的终止回调与实际移除记录不符。`);

    let previousFrame = entity.createdFrame;
    for (const trigger of triggers) {
      const children = producers.filter(row => row.parentTriggerId === trigger.id);
      if (trigger.siteId !== `${rule.entitySite}.${trigger.kind}` || trigger.startedFrame < previousFrame
        || trigger.completedFrame !== trigger.startedFrame || end === undefined || trigger.completedFrame > end
        || entity.endedFrame !== undefined && trigger.completedFrame > entity.endedFrame
        || !sameIds(trigger.childProducerIds, children.map(row => row.id)))
        reasons.push(`实体触发 #${trigger.id} 的来源、顺序、执行区间或子任务清单不符。`);
      previousFrame = trigger.startedFrame;
      if (trigger.kind === "think") {
        if (contractId === "xiangling-skill"
          ? trigger.queuedAttacks.length !== 1 || children.length !== 0
          : trigger.queuedAttacks.length !== 0 || children.length !== 1 || children[0]?.siteId !== "yaoyao.skill.radish-flight")
          reasons.push(`实体触发 #${trigger.id} 的攻击或飞行任务数不符合固有排队分支。`);
      } else if (trigger.queuedAttacks.length || children.length)
        reasons.push(`实体终止触发 #${trigger.id} 不应产生固有攻击或飞行任务。`);
      for (const attack of trigger.queuedAttacks) appendAttack(entity, attack, trigger);
    }

    for (const producer of producers) {
      const parent = triggers.find(row => row.id === producer.parentTriggerId);
      const tasks = evidence.taskLifecycle?.tasks.filter(row => row.id === producer.taskId) ?? [];
      const task = tasks.length === 1 ? tasks[0] : undefined;
      const queue = evidence.taskLifecycle?.queues.find(row => row.id === task?.queueId);
      if (contractId !== "yaoyao-burst" || producer.siteId !== "yaoyao.skill.radish-flight"
        || producer.parentProducerId !== undefined || !parent || parent.kind !== "think"
        || producer.queuedFrame !== parent.startedFrame || producer.queuedFrame !== parent.completedFrame
        || !task || queue?.kind !== "character" || queue.actorIndex !== invocation.actorIndex
        || task.queuedFrame !== producer.queuedFrame || task.dueClock - task.queuedClock !== 12
        || task.state !== producer.state || task.runFrame !== producer.startedFrame || task.completedFrame !== producer.completedFrame)
        reasons.push(`实体飞行任务 #${producer.id} 缺少唯一投掷父回调或十二拍角色时钟任务回执。`);
      if (producer.state === "pending") {
        if (producer.startedFrame !== undefined || producer.completedFrame !== undefined || producer.queuedAttacks.length)
          reasons.push(`待执行实体飞行任务 #${producer.id} 却已有结算记录。`);
      } else if (producer.startedFrame === undefined || producer.completedFrame !== producer.startedFrame
        || producer.startedFrame < producer.queuedFrame || end === undefined || producer.completedFrame > end
        || producer.queuedAttacks.length !== 1)
        reasons.push(`实体飞行任务 #${producer.id} 没有观察窗口内的一次完整萝卜排队。`);
      // Flight ownership remains with its original entity even after that entity was killed.
      for (const attack of producer.queuedAttacks) appendAttack(entity, attack, undefined, producer);
    }
  }
  result.openEntityCount = result.entityCount - result.endedEntityCount;
  if (result.pendingEntityProducerCount) reasons.push(`仍有 ${result.pendingEntityProducerCount} 个实体飞行任务未完成。`);
  if (new Set(queueIds).size !== queueIds.length) reasons.push("实体攻击队列编号重复。");
  if (new Set(flights.map(row => row.taskId)).size !== flights.length)
    reasons.push("实体飞行任务重复绑定了同一原生任务编号。");
  result.closed = reasons.length === 0;
  return result;
}
