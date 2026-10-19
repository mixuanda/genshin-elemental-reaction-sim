import type { SourceHostAbilityProducer } from "./source-host-finite-cast-types";
import type { SourceHostOwnedEntityAnalysis, SourceHostOwnedEntityEvidence } from "./source-host-owned-entity-analysis";
import type { SourceHostOwnedEntity, SourceHostOwnedEntityProducer, SourceHostOwnedEntityQueuedAttack, SourceHostOwnedEntityTrigger } from "./source-host-owned-entity-types";
import { sourceHostConstructPlan } from "./source-host-construct-contracts";

type ContractId = "albedo-skill" | "zhongli-skill";
const sameIds = (declared: number[], observed: number[]) => new Set(declared).size === declared.length
  && new Set(observed).size === observed.length && declared.length === observed.length
  && observed.every(id => declared.includes(id));

/** Ownership follows native object birth, while Origin and shared snapshot reads
 * retain the trigger/task ancestry the source actually used. */
export function analyzeSourceHostOwnedConstructs(id: ContractId, evidence: SourceHostOwnedEntityEvidence, end: number | undefined): SourceHostOwnedEntityAnalysis {
  const result: SourceHostOwnedEntityAnalysis = {
    roots: [], reasons: [], entityCount: 0, endedEntityCount: 0, openEntityCount: 0,
    entityTriggerCount: 0, entityProducerCount: 0, completedEntityProducerCount: 0,
    pendingEntityProducerCount: 0, closed: false,
  };
  const { reasons, roots } = result, { invocation } = evidence;
  const albedo = id === "albedo-skill";
  const site = albedo ? "albedo.skill.isotoma" : "zhongli.skill.stele";
  const spawnSite = albedo ? "albedo.skill.spawn-isotoma" : "zhongli.skill.spawn-stele";
  const nativeType = albedo ? "AlbedoSkill" : "ZhongliSkill";
  const hold = (invocation.params.hold ?? 0) > 0 || (invocation.params.hold_nostele ?? 0) > 0;
  const delay = albedo ? 25 : hold ? 48 : 24;
  const duration = albedo ? 1800 : 1860;
  const plan = sourceHostConstructPlan(id, invocation);
  const expectedSpawns = plan?.sites[0]?.rootCount;
  if (!plan || invocation.queuedAttacks.length !== plan.directRootCount) reasons.push("岩造物技能的实际调用分支或直接攻击数量未被来源规则确定。");
  if (!evidence.producers || !evidence.ownedEntities || !evidence.ownedEntityTriggers
    || !evidence.ownedEntityProducers || !evidence.taskLifecycle)
    reasons.push("缺少原生造物出生、回调、共鸣任务或核心队列回执。");
  if (end === undefined || end < invocation.returnedFrame) reasons.push("没有覆盖技能调用的实际观察终点。");
  const allEntities = evidence.ownedEntities ?? [], allTriggers = evidence.ownedEntityTriggers ?? [];
  const allProducers = evidence.ownedEntityProducers ?? [];
  if ([allEntities, allTriggers, allProducers].some(rows => new Set(rows.map(row => row.id)).size !== rows.length))
    reasons.push("岩造物、回调或共鸣任务身份重复。");
  const entities = allEntities.filter(row => row.invocationId === invocation.id);
  const entityIds = new Set(entities.map(row => row.id));
  const producers = allProducers.filter(row => entityIds.has(row.entityId));
  const triggers = allTriggers.filter(row => entityIds.has(row.entityId));
  const spawns = (evidence.producers ?? []).filter(row => row.invocationId === invocation.id && row.siteId === spawnSite);
  result.entityCount = entities.length;
  result.entityTriggerCount = triggers.length;
  result.entityProducerCount = producers.length;
  result.completedEntityProducerCount = producers.filter(row => row.state === "completed").length;
  result.pendingEntityProducerCount = producers.length - result.completedEntityProducerCount;
  if (expectedSpawns === undefined || spawns.length !== expectedSpawns || entities.length !== expectedSpawns)
    reasons.push("岩造物的出生任务／对象数量与原生调用分支不符，未执行任务不能作为零伤害。");
  const taskMatches = (row: SourceHostAbilityProducer | SourceHostOwnedEntityProducer, expectedDelay: number, parentTaskId?: number) => {
    const task = evidence.taskLifecycle?.tasks.find(task => task.id === row.taskId);
    const queue = evidence.taskLifecycle?.queues.find(queue => queue.id === task?.queueId);
    return task !== undefined && queue?.kind === "core" && task.queuedFrame === row.queuedFrame
      && task.dueClock - task.queuedClock === expectedDelay && task.state === row.state
      && task.runFrame === row.startedFrame && task.completedFrame === row.completedFrame
      && (parentTaskId === undefined || task.parentTaskId === parentTaskId);
  };
  for (const spawn of spawns) {
    if (spawn.actorIndex !== invocation.actorIndex || spawn.parentProducerId !== undefined
      || spawn.parentHitCallbackId !== undefined || spawn.queuedFrame !== invocation.startedFrame
      || !taskMatches(spawn, delay) || spawn.state !== "completed"
      || spawn.startedFrame !== spawn.queuedFrame + delay || spawn.completedFrame !== spawn.startedFrame
      || spawn.completedFrame === undefined || end === undefined || spawn.completedFrame > end
      || spawn.queuedAttacks.length !== (albedo ? 0 : 1))
      reasons.push(`造物出生任务 #${spawn.id} 的归属、原生延迟或初击回执不完整。`);
    const born = entities.filter(entity => entity.spawnProducerId === spawn.id);
    if (born.length !== 1 || born[0]?.createdFrame !== spawn.startedFrame)
      reasons.push(`造物出生任务 #${spawn.id} 未与唯一实际对象绑定。`);
  }
  const append = (entity: SourceHostOwnedEntity, attack: SourceHostOwnedEntityQueuedAttack,
    trigger?: SourceHostOwnedEntityTrigger, producer?: SourceHostOwnedEntityProducer) => {
    const started = trigger?.startedFrame ?? producer?.startedFrame;
    const completed = trigger?.completedFrame ?? producer?.completedFrame;
    roots.push({ attack, entityId: entity.id, ...(trigger ? { entityTrigger: trigger } : {}),
      ...(producer ? { entityProducer: producer } : {}), startedFrame: started, completedFrame: completed });
    if (started === undefined || completed === undefined || attack.frame !== started || attack.frame !== completed)
      reasons.push(`造物攻击 #${attack.queueId} 不在实际同步回调执行帧内。`);
  };
  for (const entity of entities) {
    const metadata = entity.construct;
    if (entity.kind !== "construct" || entity.siteId !== site || entity.actorIndex !== invocation.actorIndex
      || entity.parentEntityId !== undefined || metadata?.type !== nativeType || !metadata.limitedList
      || metadata.expiryFrame !== entity.createdFrame + duration || entity.targetKey !== entity.createdFrame
      || !spawns.some(row => row.id === entity.spawnProducerId))
      reasons.push(`造物 #${entity.id} 的实际对象出生来源、原生 key 或寿命与源码不一致。`);
    const ended = entity.endedFrame !== undefined && end !== undefined && entity.endedFrame <= end
      && entity.endedFrame >= entity.createdFrame && ["expired", "replaced", "limit", "destroyed"].includes(entity.endReason ?? "")
      && (entity.endReason !== "expired" || entity.endedFrame === metadata?.expiryFrame);
    if (ended) result.endedEntityCount++;
    else reasons.push(`造物 #${entity.id} 尚无有效原生移除终点。`);
    const localTriggers = triggers.filter(row => row.entityId === entity.id);
    const localProducers = producers.filter(row => row.entityId === entity.id);
    if (!sameIds(entity.triggerIds, localTriggers.map(row => row.id)) || !sameIds(entity.producerIds, localProducers.map(row => row.id)))
      reasons.push(`造物 #${entity.id} 的回调／任务清单不完整。`);
    if (albedo) {
      if (localProducers.length) reasons.push("阳华刹那之花由同步事件直接发出，不应出现额外实体任务。");
      for (const trigger of localTriggers) {
        const call = evidence.eventListenerCalls?.find(row => row.id === trigger.eventCallId);
        const count = call?.entryFacts?.["albedo.skill.enemy-damage.attack-count"];
        if (trigger.kind !== "enemy-damage" || trigger.siteId !== `${site}.enemy-damage`
          || trigger.startedFrame < entity.createdFrame || trigger.completedFrame !== trigger.startedFrame
          || end === undefined || trigger.completedFrame > end
          || entity.endedFrame !== undefined && trigger.completedFrame > entity.endedFrame
          || trigger.childProducerIds.length || !call || call.siteId !== "albedo.skill.enemy-damage"
          || call.key !== "albedo-skill" || call.startedFrame !== trigger.startedFrame || call.completedFrame !== trigger.completedFrame
          || count !== 0 && count !== 1 || trigger.queuedAttacks.length !== count
          || !sameIds(trigger.queuedAttacks.map(row => row.queueId), call.queuedAttacks.map(row => row.queueId)))
          reasons.push(`阳华回调 #${trigger.id} 缺少准确事件身份、原生零／一分支或完整发出记录。`);
        for (const attack of trigger.queuedAttacks) {
          append(entity, attack, trigger);
          if (attack.emitSiteId !== "albedo.skill.isotoma.bloom") reasons.push("阳华回执出现未审阅的伤害发出点。");
        }
      }
      continue;
    }
    if (localTriggers.length) reasons.push("石脊固有持续伤害应由原生共鸣任务产生。");
    const first = localProducers.filter(row => row.parentProducerId === undefined);
    if (first.length !== 1) reasons.push(`石脊 #${entity.id} 缺少唯一首个共鸣任务。`);
    for (const producer of localProducers) {
      const parent = localProducers.find(row => row.id === producer.parentProducerId);
      const spawn = spawns.find(row => row.id === entity.spawnProducerId);
      const children = localProducers.filter(row => row.parentProducerId === producer.id);
      const taskParent = producer.parentProducerId === undefined ? spawn?.taskId : parent?.taskId;
      const selections = producer.constructSelections ?? [];
      if (producer.siteId !== "zhongli.skill.resonance" || producer.parentTriggerId !== undefined
        || taskParent === undefined || !taskMatches(producer, 120, taskParent)
        || (producer.parentProducerId === undefined ? producer.queuedFrame !== entity.createdFrame
          : !parent || parent.id >= producer.id || producer.queuedFrame !== parent.startedFrame || parent.state !== "completed"))
        reasons.push(`石脊任务 #${producer.id} 的对象归属、父任务或 120 帧原生排期不一致。`);
      if (producer.state === "pending") {
        if (producer.startedFrame !== undefined || producer.completedFrame !== undefined || producer.constructKeyPresent !== undefined
          || producer.snapshotEntityId !== undefined || selections.length || producer.queuedAttacks.length || children.length)
          reasons.push(`待执行石脊任务 #${producer.id} 却已有执行结果。`);
        reasons.push(`石脊任务 #${producer.id} 尚待执行；造物已移除也必须保留其真实终止检查。`);
      } else {
        if (producer.startedFrame !== producer.queuedFrame + 120 || producer.completedFrame !== producer.startedFrame
          || producer.completedFrame === undefined || end === undefined || producer.completedFrame > end
          || producer.constructKeyPresent === undefined || children.length !== (producer.constructKeyPresent ? 1 : 0))
          reasons.push(`石脊任务 #${producer.id} 的执行／后继分支不符合原生 Has(src) 结果。`);
        if (producer.constructKeyPresent === false && (selections.length || producer.queuedAttacks.length
          || entity.endedFrame === undefined || entity.endedFrame > (producer.startedFrame ?? -1)))
          reasons.push(`石脊任务 #${producer.id} 的退出分支缺少对象移除证据或仍发出攻击。`);
        const snapshot = allEntities.find(row => row.id === producer.snapshotEntityId);
        if (!snapshot || snapshot.construct?.type !== "ZhongliSkill" || snapshot.actorIndex !== invocation.actorIndex
          || snapshot.createdFrame > (producer.startedFrame ?? -1))
          reasons.push(`石脊任务 #${producer.id} 的原生共享快照来源对象未被记录。`);
        if (producer.constructKeyPresent === true && selections.length !== 1)
          reasons.push(`石脊任务 #${producer.id} 未选中唯一主柱，原生 key 分支仍为 partial。`);
        const expected = selections.flatMap(selection => [
          { site: "zhongli.skill.stele.tick", emitter: selection.primaryEntityId },
          ...selection.resonanceEntityIds.map(emitter => ({ site: "zhongli.skill.stele.resonance", emitter })),
        ]);
        if (expected.length !== producer.queuedAttacks.length || expected.some((row, i) =>
          row.emitter === 0 || producer.queuedAttacks[i]?.emitSiteId !== row.site || producer.queuedAttacks[i]?.emitterEntityId !== row.emitter))
          reasons.push(`石脊任务 #${producer.id} 的发出攻击与原生实际选取造物清单不一致。`);
        for (const selection of selections) {
          // A native frame-key collision can select another object. Preserve
          // its attacks, but do not assert complete ownership of that branch.
          if (selection.primaryEntityId !== entity.id)
            reasons.push(`石脊任务 #${producer.id} 发生原生 key 与对象身份交叉，归属仍为 partial。`);
          const emitters = [selection.primaryEntityId, ...selection.resonanceEntityIds];
          for (const [index, emitterId] of emitters.entries()) {
            const emitter = allEntities.find(row => row.id === emitterId);
            if (!emitter || emitter.kind !== "construct" || emitter.createdFrame > (producer.startedFrame ?? -1)
              || emitter.endedFrame !== undefined && emitter.endedFrame < (producer.startedFrame ?? -1)
              || index > 0 && emitter.construct?.type === "ZhongliSkill")
              reasons.push(`石脊任务 #${producer.id} 的共鸣对象 #${emitterId} 没有匹配的原生活跃对象证据。`);
          }
        }
      }
      for (const attack of producer.queuedAttacks) append(entity, attack, undefined, producer);
    }
    if (localProducers.filter(row => row.state === "completed" && row.constructKeyPresent === false).length !== 1)
      reasons.push(`石脊 #${entity.id} 尚无唯一真实终止检查。`);
  }
  if (albedo) {
    const registrations = evidence.eventRegistrations ?? [], emissions = evidence.eventEmissions ?? [];
    const calls = evidence.eventListenerCalls ?? [];
    if (!evidence.eventListenerCalls || !evidence.eventRegistrations || !evidence.eventEmissions)
      reasons.push("缺少阿贝多原生事件注册／发出／回调三表，不能将未捕获的刹那之花视为零伤害。");
    const slots = registrations.filter(row => row.key === "albedo-skill");
    if (slots.length !== 1) reasons.push("没有唯一阿贝多原生敌人伤害监听槽位。");
    if ([registrations, emissions, calls].some(rows => new Set(rows.map(row => row.id)).size !== rows.length))
      reasons.push("阿贝多事件证据中的注册／发出／回调身份重复。");
    for (const emission of emissions) {
      // A missing call cannot disappear together with its owned trigger while
      // the native emission still declares that the listener actually ran.
      const observed = calls.filter(row => row.emissionId === emission.id);
      if (!sameIds(emission.listenerIds, observed.map(row => row.id)))
        reasons.push(`原生事件 #${emission.id} 的实际监听回调清单不完整。`);
    }
    for (const call of calls) {
      if (call.key !== "albedo-skill" && call.siteId !== "albedo.skill.enemy-damage") continue;
      const registration = registrations.find(row => row.id === call.registrationId);
      const emission = emissions.find(row => row.id === call.emissionId);
      const count = call.entryFacts?.["albedo.skill.enemy-damage.attack-count"];
      if (call.siteId !== "albedo.skill.enemy-damage" || call.key !== "albedo-skill"
        || !registration || registration.key !== call.key || registration.slotIndex !== call.slotIndex
        || registration.eventType !== call.eventType || registration.createdFrame > call.startedFrame
        || registration.endedFrame !== undefined && registration.endedFrame < call.startedFrame
        || !emission || emission.eventType !== call.eventType || emission.frame !== call.startedFrame
        || emission.completedFrame !== call.completedFrame || !emission.listenerIds.includes(call.id)
        || emission.suppressedListenerIds.includes(call.registrationId)
        || count !== 0 && count !== 1 || call.queuedAttacks.length !== count
        || call.queuedAttacks.some(row => row.emitSiteId !== "albedo.skill.proc-attack"))
        reasons.push(`刹那之花事件 #${call.id} 缺少匹配注册／发出身份或准确零／一分支。`);
      if (count === 0 && call.queuedAttacks.length === 0) continue;
      const owners = allTriggers.filter(row => row.eventCallId === call.id && row.kind === "enemy-damage");
      if (owners.length !== 1 || !sameIds(owners[0]!.queuedAttacks.map(row => row.queueId), call.queuedAttacks.map(row => row.queueId)))
        reasons.push(`刹那之花事件 #${call.id} 缺少唯一实际阳华对象回执。`);
    }
  }
  result.openEntityCount = result.entityCount - result.endedEntityCount;
  if (new Set(roots.map(row => row.attack.queueId)).size !== roots.length) reasons.push("岩造物攻击队列身份重复。");
  result.closed = reasons.length === 0;
  return result;
}
