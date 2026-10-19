import type {
  SourceHostAbilityInvocation, SourceHostAbilityProducer, SourceHostOwnedGenerator,
  SourceHostOwnedGeneratorTrigger,
} from "./source-host-finite-cast-types";
import type { SourceHostStatusInstance } from "./source-host-action-origin";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import { analyzeSourceHostRaidenOwnedGenerators } from "./source-host-raiden-owned-analysis";

const rules = {
  "xingqiu-burst": {
    generatorSiteId: "xingqiu.burst.raincutter-status", statusKey: "xingqiuburst",
    triggerSites: [
      { siteId: "xingqiu.burst.raincutter.state-change", kind: "state-change" },
      { siteId: "xingqiu.burst.raincutter.ticker", kind: "ticker" },
    ],
    emitSites: ["xingqiu.burst.rainsword"], directAttackCount: 0,
    emitPattern: { kind: "cycle", siteId: "xingqiu.burst.rainsword",
      base: [2, 3], constellationThreshold: 6, elevated: [2, 3, 5] },
  },
  "yelan-burst": {
    generatorSiteId: "yelan.burst.dice-status", statusKey: "yelanburst",
    activationProducerSiteId: "yelan.burst.activate",
    triggerSites: [
      { siteId: "yelan.burst.dice.state-change", kind: "state-change" },
      { siteId: "yelan.burst.dice.ticker", kind: "ticker" },
      { siteId: "yelan.burst.dice.skill-hit", kind: "skill-hit" },
    ],
    emitSites: ["yelan.burst.dice", "yelan.burst.c2-dice"], directAttackCount: 1,
    emitPattern: { kind: "fixed-plus-optional", fixedSiteId: "yelan.burst.dice", fixedCount: 3,
      optionalSiteId: "yelan.burst.c2-dice", optionalConstellationThreshold: 2, optionalMax: 1 },
  },
  "thoma-burst": {
    generatorSiteId: "thoma.burst.oyoroi-status", statusKey: "thoma-q",
    triggerSites: [
      { siteId: "thoma.burst.collapse.state-change", kind: "state-change" },
      { siteId: "thoma.burst.collapse.ticker", kind: "ticker" },
    ],
    emitSites: ["thoma.burst.collapse"], directAttackCount: 1,
    emitPattern: { kind: "fixed", siteId: "thoma.burst.collapse", count: 1 },
  },
  "beidou-burst": {
    generatorSiteId: "beidou.burst.stormbreaker-status", statusKey: "beidouburst",
    triggerSites: [
      { siteId: "beidou.burst.stormbreaker.enemy-damage", kind: "enemy-damage" },
    ],
    emitSites: ["beidou.burst.bounce"], directAttackCount: 1,
    emitPattern: { kind: "fixed", siteId: "beidou.burst.bounce", count: 1 },
  },
  "raiden-skill": {
    generatorSiteId: "raiden.skill.eye-modifier", statusKey: "raiden-e",
    activationProducerSiteId: "raiden.skill.eye-activate",
    triggerSites: [{ siteId: "raiden.skill.eye.enemy-damage", kind: "enemy-damage" }],
    emitSites: ["raiden.skill.eye-strike"], directAttackCount: 1,
    emitPattern: { kind: "fixed", siteId: "raiden.skill.eye-strike", count: 1 },
  },
  "qiqi-skill-stellar": {
    generatorSiteId: "qiqi.skill.herald-status", statusKey: "qiqi-e",
    triggerSites: [
      { siteId: "qiqi.skill.herald.enemy-hit", kind: "enemy-hit" },
    ],
    emitSites: ["qiqi.skill.coordinated-attack"], directAttackCount: 0,
    emitPattern: { kind: "fixed", siteId: "qiqi.skill.coordinated-attack", count: 1 },
  },
} as const;

export type SourceHostOwnedGeneratorRule = typeof rules[keyof typeof rules];

export function getSourceHostOwnedGeneratorRule(contractId: string): SourceHostOwnedGeneratorRule | undefined {
  return Object.hasOwn(rules, contractId) ? rules[contractId as keyof typeof rules] : undefined;
}

export interface SourceHostOwnedGeneratorEvidence {
  invocation: SourceHostAbilityInvocation;
  producers?: SourceHostAbilityProducer[] | undefined;
  ownedGenerators?: SourceHostOwnedGenerator[] | undefined;
  ownedGeneratorTriggers?: SourceHostOwnedGeneratorTrigger[] | undefined;
  statusInstances?: SourceHostStatusInstance[] | undefined;
}

export interface SourceHostOwnedGeneratorAnalysis {
  roots: SourceHostFiniteRoot[];
  reasons: string[];
  generatorCount: number;
  endedGeneratorCount: number;
  openGeneratorCount: number;
  triggerCount: number;
  closed: boolean;
}

/** Status ownership proves a persistent skill emitter; callback creation ancestry does not. */
export function analyzeSourceHostOwnedGenerators(
  contractId: string, evidence: SourceHostOwnedGeneratorEvidence, end: number | undefined,
): SourceHostOwnedGeneratorAnalysis {
  if (contractId === "raiden-skill") return analyzeSourceHostRaidenOwnedGenerators(evidence, end);
  const rule = getSourceHostOwnedGeneratorRule(contractId);
  const result: SourceHostOwnedGeneratorAnalysis = {
    roots: [], reasons: [], generatorCount: 0, endedGeneratorCount: 0,
    openGeneratorCount: 0, triggerCount: 0, closed: true,
  };
  if (!rule) return result;
  const { invocation } = evidence;
  const { reasons, roots } = result;
  if (!evidence.ownedGenerators || !evidence.ownedGeneratorTriggers || !evidence.statusInstances)
    reasons.push("缺少原生技能状态生成器、触发或状态实例回执。");
  if (end === undefined || end < invocation.returnedFrame)
    reasons.push("没有覆盖技能调用的实际观察终点。");

  const allGenerators = evidence.ownedGenerators ?? [];
  const allTriggers = evidence.ownedGeneratorTriggers ?? [];
  const statuses = evidence.statusInstances ?? [];
  if (new Set(allGenerators.map(row => row.id)).size !== allGenerators.length
    || new Set(allTriggers.map(row => row.id)).size !== allTriggers.length
    || new Set(statuses.map(row => row.instanceId)).size !== statuses.length)
    reasons.push("生成器、触发或状态实例编号重复。");

  const generators = allGenerators.filter(row => row.invocationId === invocation.id);
  result.generatorCount = generators.length;
  if (generators.length !== 1) reasons.push("本次技能调用必须恰好绑定一个实际状态生成器。");

  const producerSite = "activationProducerSiteId" in rule ? rule.activationProducerSiteId : undefined;
  const activationProducers = producerSite === undefined ? [] : (evidence.producers ?? []).filter(row =>
    row.invocationId === invocation.id && row.siteId === producerSite);
  if (producerSite !== undefined && activationProducers.length !== 1)
    reasons.push("缺少本次技能的唯一延迟状态激活任务。");

  const owned = generators[0];
  let status: SourceHostStatusInstance | undefined;
  let terminalFrame: number | undefined;
  if (owned) {
    status = statuses.find(row => row.instanceId === owned.statusInstanceId);
    if (owned.siteId !== rule.generatorSiteId || owned.actorIndex !== invocation.actorIndex
      || !status || status.actorIndex !== invocation.actorIndex || status.statusKey !== rule.statusKey
      || status.createdFrame !== owned.activatedFrame
      || status.creationActionSequence !== invocation.actionSequence)
      reasons.push("生成器来源、角色或实际状态实例与本次技能不一致。");
    if (producerSite === undefined) {
      if (owned.activatedFrame < invocation.startedFrame || owned.activatedFrame > invocation.returnedFrame)
        reasons.push("同步状态激活不在本次技能方法区间内。");
    } else {
      const producer = activationProducers[0];
      if (!producer || producer.actorIndex !== invocation.actorIndex || producer.state !== "completed"
        || producer.queuedFrame < invocation.startedFrame || producer.queuedFrame > invocation.returnedFrame
        || producer.startedFrame === undefined || producer.completedFrame === undefined
        || owned.activatedFrame < producer.startedFrame || owned.activatedFrame > producer.completedFrame
        || end === undefined || producer.completedFrame > end)
        reasons.push("延迟状态激活不在本次技能的已完成任务区间内。");
    }
    if (status && end !== undefined) {
      if ((status.endState === "replaced" || status.endState === "removed")
        && status.endFrame >= owned.activatedFrame && status.endFrame <= end) {
        terminalFrame = status.endFrame;
      } else if (status.endState === "expired-at-end"
        && status.finalExpiryFrame >= owned.activatedFrame && status.finalExpiryFrame < end
        && status.endFrame === end) {
        terminalFrame = status.finalExpiryFrame;
      }
    }
    if (terminalFrame === undefined) reasons.push("技能状态仍活跃，或缺少可确证的替换、移除或到期终点。");
  }
  result.endedGeneratorCount = owned && terminalFrame !== undefined ? 1 : 0;
  result.openGeneratorCount = result.generatorCount - result.endedGeneratorCount;

  if (!owned) {
    result.closed = false;
    return result;
  }
  if (allGenerators.some(row => row.id !== owned.id && row.statusInstanceId === owned.statusInstanceId)
    || allTriggers.some(row => row.generatorId !== owned.id
      && row.origin.statusOwner?.instanceId === owned.statusInstanceId))
    reasons.push("同一状态实例出现其他生成器或未归属本次生成器的触发。");

  const triggers = allTriggers.filter(row => row.generatorId === owned.id).sort((a, b) => a.id - b.id);
  result.triggerCount = triggers.length;
  const declaredTriggerIds = new Set(owned.triggerIds);
  const observedTriggerIds = new Set(triggers.map(row => row.id));
  if (declaredTriggerIds.size !== owned.triggerIds.length
    || declaredTriggerIds.size !== observedTriggerIds.size
    || [...declaredTriggerIds].some(id => !observedTriggerIds.has(id)))
    reasons.push("生成器登记的触发编号与实际触发回执不完整或不一致。");
  if (triggers.some(row => row.startedFrame < owned.activatedFrame))
    reasons.push("状态激活前已记录生成器触发。");
  const allowedTriggerSites: readonly { siteId: string; kind: string }[] = rule.triggerSites;
  const allowedEmitSites: readonly string[] = rule.emitSites;
  let lastTriggerFrame = -1;
  const queueIds: number[] = [];
  const attackIds: number[] = [];
  for (const [index, trigger] of triggers.entries()) {
    const problems: string[] = [];
    if (!allowedTriggerSites.some(site => site.siteId === trigger.siteId && site.kind === trigger.kind))
      problems.push("触发来源或类型不在固定源码规则内");
    if (trigger.startedFrame < lastTriggerFrame || trigger.completedFrame !== trigger.startedFrame
      || end === undefined || trigger.completedFrame > end
      || terminalFrame !== undefined && trigger.completedFrame > terminalFrame)
      problems.push("触发顺序或执行区间与状态生存期不符");
    lastTriggerFrame = trigger.startedFrame;
    const owner = trigger.origin.statusOwner;
    if (!status || !owner || owner.instanceId !== status.instanceId
      || owner.actorIndex !== status.actorIndex || owner.statusKey !== status.statusKey
      || owner.createdFrame !== status.createdFrame
      || owner.creationActionSequence !== status.creationActionSequence)
      problems.push("触发没有归属同一实际状态实例");

    const counts = new Map<string, number>();
    for (const attack of trigger.queuedAttacks) {
      counts.set(attack.emitSiteId, (counts.get(attack.emitSiteId) ?? 0) + 1);
      queueIds.push(attack.queueId);
      if (attack.attackId !== undefined) attackIds.push(attack.attackId);
      if (attack.frame < trigger.startedFrame || attack.frame > trigger.completedFrame)
        problems.push("攻击未在触发调用区间内排队");
      roots.push({ attack, ownedTrigger: trigger, statusInstanceId: owned.statusInstanceId,
        startedFrame: trigger.startedFrame, completedFrame: trigger.completedFrame });
    }
    if ([...counts.keys()].some(site => !allowedEmitSites.includes(site)))
      problems.push("出现未审阅的攻击发射点");
    const pattern = rule.emitPattern;
    if (pattern.kind === "cycle") {
      const sequence = invocation.constellation >= pattern.constellationThreshold ? pattern.elevated : pattern.base;
      if (counts.get(pattern.siteId) !== sequence[index % sequence.length]
        || trigger.queuedAttacks.length !== sequence[index % sequence.length])
        problems.push("雨帘剑数量不符合本次生成器的 2/3/5 周期");
    } else if (pattern.kind === "fixed-plus-optional") {
      const optional = counts.get(pattern.optionalSiteId) ?? 0;
      if (counts.get(pattern.fixedSiteId) !== pattern.fixedCount
        || optional > (invocation.constellation >= pattern.optionalConstellationThreshold ? pattern.optionalMax : 0)
        || trigger.queuedAttacks.length !== pattern.fixedCount + optional)
        problems.push("骰子或 C2 追加攻击数量与源码分支不符");
    } else if (counts.get(pattern.siteId) !== pattern.count || trigger.queuedAttacks.length !== pattern.count) {
      problems.push("固定触发攻击数量与源码规则不符");
    }
    if (problems.length) reasons.push(`生成器触发 #${trigger.id}：${[...new Set(problems)].join("；")}。`);
  }
  if (new Set(queueIds).size !== queueIds.length || new Set(attackIds).size !== attackIds.length)
    reasons.push("生成器攻击的队列或攻击编号重复。");
  result.closed = reasons.length === 0;
  return result;
}
