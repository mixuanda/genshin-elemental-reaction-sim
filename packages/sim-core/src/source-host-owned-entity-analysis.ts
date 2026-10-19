import { analyzeSourceHostOwnedConstructs } from "./source-host-owned-construct-analysis";
import type { SourceHostEventListenerCall, SourceHostEventRegistration, SourceHostEventEmission } from "./source-host-event-types";
import type { SourceHostAbilityInvocation, SourceHostAbilityProducer } from "./source-host-finite-cast-types";
import type {
  SourceHostOwnedEntity, SourceHostOwnedEntityTrigger, SourceHostOwnedEntityProducer,
  SourceHostOwnedEntityQueuedAttack,
} from "./source-host-owned-entity-types";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import type { SourceHostTaskLifecycle } from "./source-host-task-lifecycle";
import { analyzeSourceHostExtendedOwnedEntities } from "./source-host-extended-entity-analysis";

const rules = {
  "amber-skill": {
    spawnSiteId: "amber.skill.spawn-bunny", entitySiteId: "amber.skill.bunny",
    directAttackCount: 0, terminalEmitSiteId: "amber.skill.bunny.explode", terminalAttackCount: 1,
  },
  "yaoyao-skill": {
    spawnSiteId: "yaoyao.skill.spawn-yuegui", entitySiteId: "yaoyao.skill.yuegui",
    directAttackCount: 0, flightSiteId: "yaoyao.skill.radish-flight",
    radishEmitSiteId: "yaoyao.skill.radish", megaEmitSiteId: "yaoyao.skill.mega-radish",
    megaConstellationThreshold: 6, megaThinkIndexes: [2, 5],
  },
} as const;

export type SourceHostOwnedEntityRule = typeof rules[keyof typeof rules];

export function getSourceHostOwnedEntityRule(contractId: string): SourceHostOwnedEntityRule | undefined {
  return Object.hasOwn(rules, contractId) ? rules[contractId as keyof typeof rules] : undefined;
}

export interface SourceHostOwnedEntityEvidence {
  invocation: SourceHostAbilityInvocation;
  producers?: SourceHostAbilityProducer[] | undefined;
  ownedEntities?: SourceHostOwnedEntity[] | undefined;
  ownedEntityTriggers?: SourceHostOwnedEntityTrigger[] | undefined;
  ownedEntityProducers?: SourceHostOwnedEntityProducer[] | undefined;
  taskLifecycle?: SourceHostTaskLifecycle | undefined;
  eventListenerCalls?: SourceHostEventListenerCall[] | undefined;
  eventRegistrations?: SourceHostEventRegistration[] | undefined;
  eventEmissions?: SourceHostEventEmission[] | undefined;
}

export interface SourceHostOwnedEntityAnalysis {
  roots: SourceHostFiniteRoot[];
  reasons: string[];
  entityCount: number;
  endedEntityCount: number;
  openEntityCount: number;
  entityTriggerCount: number;
  entityProducerCount: number;
  completedEntityProducerCount: number;
  pendingEntityProducerCount: number;
  closed: boolean;
}

function sameIds(declared: number[], observed: number[]): boolean {
  const left = new Set(declared);
  const right = new Set(observed);
  return left.size === declared.length && right.size === observed.length
    && left.size === right.size && [...left].every(id => right.has(id));
}

/** A root belongs to the exact spawned gadget, even when a later action triggered it. */
export function analyzeSourceHostOwnedEntities(
  contractId: string, evidence: SourceHostOwnedEntityEvidence, end: number | undefined,
): SourceHostOwnedEntityAnalysis {
  if (contractId === "albedo-skill" || contractId === "zhongli-skill")
    return analyzeSourceHostOwnedConstructs(contractId, evidence, end);
  if (contractId === "xiangling-skill" || contractId === "yaoyao-burst")
    return analyzeSourceHostExtendedOwnedEntities(contractId, evidence, end);
  const rule = getSourceHostOwnedEntityRule(contractId);
  const result: SourceHostOwnedEntityAnalysis = {
    roots: [], reasons: [], entityCount: 0, endedEntityCount: 0, openEntityCount: 0,
    entityTriggerCount: 0, entityProducerCount: 0, completedEntityProducerCount: 0,
    pendingEntityProducerCount: 0, closed: true,
  };
  if (!rule) return result;
  const { invocation } = evidence;
  const { reasons, roots } = result;
  if (invocation.queuedAttacks.length !== rule.directAttackCount)
    reasons.push("本次 E 方法直接排队攻击数与来源规则不符。");
  if (!evidence.producers || !evidence.ownedEntities || !evidence.ownedEntityTriggers || !evidence.ownedEntityProducers)
    reasons.push("缺少原生生成任务、实体、回调或飞行任务回执。");
  if (end === undefined || end < invocation.returnedFrame)
    reasons.push("没有覆盖技能调用的实际观察终点。");

  const spawnTasks = (evidence.producers ?? []).filter(row => row.invocationId === invocation.id && row.siteId === rule.spawnSiteId);
  if (spawnTasks.length !== 1) reasons.push("本次 E 必须恰好登记一个来源已审阅的实体生成任务。");
  const spawn = spawnTasks[0];
  if (spawn && (spawn.actorIndex !== invocation.actorIndex
    || spawn.queuedFrame < invocation.startedFrame || spawn.queuedFrame > invocation.returnedFrame
    || spawn.state !== "completed" || spawn.startedFrame === undefined || spawn.completedFrame !== spawn.startedFrame
    || end === undefined || spawn.completedFrame > end || spawn.queuedAttacks.length !== 0))
    reasons.push("实体生成任务的角色、注册帧、完成区间或攻击结果与源码不符。");

  const allEntities = evidence.ownedEntities ?? [];
  const allTriggers = evidence.ownedEntityTriggers ?? [];
  const allProducers = evidence.ownedEntityProducers ?? [];
  if (new Set(allEntities.map(row => row.id)).size !== allEntities.length
    || new Set(allTriggers.map(row => row.id)).size !== allTriggers.length
    || new Set(allProducers.map(row => row.id)).size !== allProducers.length)
    reasons.push("实体、回调或飞行任务编号重复。");
  const entities = allEntities.filter(row => row.invocationId === invocation.id);
  result.entityCount = entities.length;
  if (entities.length !== 1) reasons.push("本次 E 必须恰好绑定一个实际实体。");
  const entity = entities[0];
  if (!entity) { result.closed = false; return result; }
  if (entity.kind !== "gadget" || entity.siteId !== rule.entitySiteId
    || entity.actorIndex !== invocation.actorIndex || entity.spawnProducerId !== spawn?.id
    || entity.parentEntityId !== undefined || spawn?.startedFrame === undefined
    || spawn?.completedFrame === undefined || entity.createdFrame < spawn.startedFrame
    || entity.createdFrame > spawn.completedFrame)
    reasons.push("实体类型、出生来源、角色或生成任务区间不一致。");

  const ended = entity.endedFrame !== undefined && entity.endReason !== undefined
    && entity.endedFrame >= entity.createdFrame && end !== undefined && entity.endedFrame <= end;
  result.endedEntityCount = ended ? 1 : 0;
  result.openEntityCount = result.entityCount - result.endedEntityCount;
  if (!ended) reasons.push("实体尚未观察到实际移除终点。");

  const triggers = allTriggers.filter(row => row.entityId === entity.id).sort((a, b) => a.id - b.id);
  const producers = allProducers.filter(row => row.entityId === entity.id).sort((a, b) => a.id - b.id);
  result.entityTriggerCount = triggers.length;
  result.entityProducerCount = producers.length;
  result.completedEntityProducerCount = producers.filter(row => row.state === "completed").length;
  result.pendingEntityProducerCount = producers.length - result.completedEntityProducerCount;
  if (!sameIds(entity.triggerIds, triggers.map(row => row.id))
    || !sameIds(entity.producerIds, producers.map(row => row.id)))
    reasons.push("实体登记的回调／飞行任务编号与实际回执不完整或不一致。");

  const queueIds: number[] = [];
  const appendAttack = (attack: SourceHostOwnedEntityQueuedAttack, started: number, completed: number,
    trigger?: SourceHostOwnedEntityTrigger, producer?: SourceHostOwnedEntityProducer) => {
    queueIds.push(attack.queueId);
    roots.push({ attack, entityId: entity.id, ...(trigger ? { entityTrigger: trigger } : {}),
      ...(producer ? { entityProducer: producer } : {}), startedFrame: started, completedFrame: completed });
    if (attack.frame < started || attack.frame > completed)
      reasons.push(`实体排队攻击 #${attack.queueId} 不在其回调／任务执行区间内。`);
  };

  const thinkTriggers = triggers.filter(row => row.kind === "think");
  let lastTriggerFrame = -1;
  for (const trigger of triggers) {
    const problems: string[] = [];
    if (trigger.siteId !== `${entity.siteId}.${trigger.kind}`
      || trigger.kind === "think" && contractId !== "yaoyao-skill"
      || trigger.kind === "expiry" && contractId !== "amber-skill")
      problems.push("回调来源或类型不属于已审阅实体");
    if (trigger.startedFrame < entity.createdFrame || trigger.startedFrame < lastTriggerFrame
      || trigger.completedFrame !== trigger.startedFrame || end === undefined || trigger.completedFrame > end
      || entity.endedFrame !== undefined && trigger.completedFrame > entity.endedFrame)
      problems.push("回调顺序或执行帧与实体生存期不符");
    lastTriggerFrame = trigger.startedFrame;
    const children = producers.filter(row => row.parentTriggerId === trigger.id);
    if (!sameIds(trigger.childProducerIds, children.map(row => row.id)))
      problems.push("回调登记的子任务与实际飞行任务不一致");
    if (contractId === "amber-skill") {
      if (trigger.kind === "think" || trigger.queuedAttacks.length !== rules["amber-skill"].terminalAttackCount
        || trigger.queuedAttacks[0]?.emitSiteId !== rules["amber-skill"].terminalEmitSiteId
        || children.length !== 0)
        problems.push("兔兔伯爵终止回调必须只排队一次爆炸");
    } else if (trigger.kind === "think") {
      const source = rules["yaoyao-skill"];
      const thinkIndex = thinkTriggers.indexOf(trigger);
      const megaCount = invocation.constellation >= source.megaConstellationThreshold
        && (source.megaThinkIndexes as readonly number[]).includes(thinkIndex) ? 1 : 0;
      if (children.length !== 1 || children[0]?.siteId !== source.flightSiteId
        || trigger.queuedAttacks.filter(row => row.emitSiteId === source.megaEmitSiteId).length !== megaCount
        || trigger.queuedAttacks.length !== megaCount)
        problems.push("月桂每次投掷须登记一条飞行任务及准确的 C6 直发攻击");
    } else if (trigger.kind !== "kill" || trigger.queuedAttacks.length !== 0 || children.length !== 0) {
      problems.push("月桂终止回调不应产生固有攻击或飞行任务");
    }
    for (const attack of trigger.queuedAttacks)
      appendAttack(attack, trigger.startedFrame, trigger.completedFrame, trigger);
    if (problems.length) reasons.push(`实体回调 #${trigger.id}：${[...new Set(problems)].join("；")}。`);
  }

  if (ended && contractId === "amber-skill") {
    if (entity.endReason !== "killed" && entity.endReason !== "expired"
      || triggers.length !== 1 || triggers[0]?.kind !== (entity.endReason === "killed" ? "kill" : "expiry")
      || triggers[0]?.completedFrame !== entity.endedFrame)
      reasons.push("兔兔伯爵必须由一次实际击杀或到期回调爆炸后结束。");
  } else if (ended && contractId === "yaoyao-skill") {
    const terminal = triggers.filter(row => row.kind !== "think");
    if (entity.endReason === "killed"
      ? terminal.length !== 1 || terminal[0]?.kind !== "kill" || terminal[0]?.completedFrame !== entity.endedFrame
      : terminal.length !== 0)
      reasons.push("月桂终止回调与实际移除原因不一致。");
  }

  for (const producer of producers) {
    const problems: string[] = [];
    const source = rules["yaoyao-skill"];
    const parent = triggers.find(row => row.id === producer.parentTriggerId);
    if (contractId !== "yaoyao-skill" || producer.siteId !== source.flightSiteId
      || !parent || parent.kind !== "think" || producer.parentProducerId !== undefined
      || producer.queuedFrame < parent.startedFrame || producer.queuedFrame > parent.completedFrame)
      problems.push("飞行任务缺少合法的月桂投掷父回调");
    if (producer.state === "pending") {
      if (producer.startedFrame !== undefined || producer.completedFrame !== undefined || producer.queuedAttacks.length)
        problems.push("待飞行任务已有执行结果");
    } else if (producer.startedFrame === undefined || producer.completedFrame !== producer.startedFrame
      || producer.startedFrame < producer.queuedFrame || end === undefined || producer.completedFrame > end
      || producer.queuedAttacks.length !== 1 || producer.queuedAttacks[0]?.emitSiteId !== source.radishEmitSiteId) {
      problems.push("已完成飞行任务没有唯一萝卜排队攻击");
    }
    for (const attack of producer.queuedAttacks)
      appendAttack(attack, producer.startedFrame ?? producer.queuedFrame,
        producer.completedFrame ?? producer.queuedFrame, undefined, producer);
    if (problems.length) reasons.push(`实体飞行任务 #${producer.id}：${[...new Set(problems)].join("；")}。`);
  }
  if (result.pendingEntityProducerCount) reasons.push(`仍有 ${result.pendingEntityProducerCount} 个萝卜飞行任务未完成。`);
  if (new Set(queueIds).size !== queueIds.length) reasons.push("实体攻击排队编号重复。");
  result.closed = reasons.length === 0;
  return result;
}
