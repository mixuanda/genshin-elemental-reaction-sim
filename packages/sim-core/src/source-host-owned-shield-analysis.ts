import { analyzeSourceHostLaylaShields } from "./source-host-layla-shield-analysis";
import type { SourceHostEventRegistration, SourceHostEventEmission, SourceHostEventListenerCall } from "./source-host-event-types";
import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostAbilityInvocation, SourceHostAbilityProducer } from "./source-host-finite-cast-types";
import type { SourceHostShieldInstance, SourceHostShieldHook, SourceHostShieldProducer } from "./source-host-owned-shield-types";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import type { SourceHostHitCallbackEvidence } from "./source-host-hit-callback-analysis";
import type { SourceHostTaskLifecycle } from "./source-host-task-lifecycle";
import { analyzeSourceHostXinyanShields } from "./source-host-xinyan-shield-analysis";
import { analyzeSourceHostNoelleShields } from "./source-host-noelle-shield-analysis";

const baizhu = {
  birthSite: "baizhu.burst.shield", refreshSite: "baizhu.shield.refresh",
  emitSite: "baizhu.shield.spiritvein", lifetime: 152,
  births: [
    { site: "baizhu.burst.first-shield", delay: 81 },
    ...[223, 369, 515, 661, 807].map(delay => ({ site: "baizhu.burst.refresh-shield", delay })),
  ],
};

export interface SourceHostOwnedShieldEvidence extends Partial<SourceHostHitCallbackEvidence> {
  invocation: SourceHostAbilityInvocation;
  producers?: SourceHostAbilityProducer[] | undefined;
  shieldInstances?: SourceHostShieldInstance[] | undefined;
  shieldHooks?: SourceHostShieldHook[] | undefined;
  shieldProducers?: SourceHostShieldProducer[] | undefined;
  taskLifecycle?: SourceHostTaskLifecycle | undefined;
  eventRegistrations?: SourceHostEventRegistration[] | undefined;
  eventEmissions?: SourceHostEventEmission[] | undefined;
  eventListenerCalls?: SourceHostEventListenerCall[] | undefined;
}

const shieldBirthSites: Record<string, string[]> = {
  "layla-skill": ["layla.skill.shield"],
  "baizhu-burst": [baizhu.birthSite], "noelle-skill": ["noelle.skill.shield"],
  "xinyan-skill": ["xinyan.skill.initial-shield-birth", "xinyan.skill.hit-shield-upgrade-birth"],
  "xinyan-burst": ["xinyan.burst.c2-shield-birth"],
};

/** Birth ownership stays with the shield, independently of the action refreshing or breaking it. */
export function sourceHostOwnedShieldInstances(contractId: string, evidence: SourceHostOwnedShieldEvidence): SourceHostShieldInstance[] {
  return (evidence.shieldInstances ?? []).filter(row => row.invocationId === evidence.invocation.id
    && row.creationSiteId !== undefined && shieldBirthSites[contractId]?.includes(row.creationSiteId));
}

export function sourceHostOwnedShieldRoots(contractId: string, evidence: SourceHostOwnedShieldEvidence): SourceHostFiniteRoot[] {
  const ids = new Set(sourceHostOwnedShieldInstances(contractId, evidence).map(row => row.id));
  return [...(evidence.shieldHooks ?? []).filter(row => ids.has(row.instanceId))
    .flatMap(shieldHook => shieldHook.queuedAttacks.map(attack => ({ attack,
      shieldInstanceId: shieldHook.instanceId, shieldHook,
      startedFrame: shieldHook.startedFrame, completedFrame: shieldHook.completedFrame }))),
    ...(evidence.shieldProducers ?? []).filter(row => row.ownerInstanceId !== undefined && ids.has(row.ownerInstanceId))
      .flatMap(shieldProducer => shieldProducer.queuedAttacks.map(attack => ({ attack,
        shieldInstanceId: shieldProducer.ownerInstanceId!, shieldProducer,
        startedFrame: shieldProducer.runFrame, completedFrame: shieldProducer.completedFrame })))];
}

export function analyzeSourceHostOwnedShields(
  contractId: string, evidence: SourceHostOwnedShieldEvidence, end: number | undefined,
) {
  const shields = sourceHostOwnedShieldInstances(contractId, evidence);
  const roots = sourceHostOwnedShieldRoots(contractId, evidence);
  const reasons: string[] = [];
  const result = { roots, reasons, shieldInstanceIds: shields.map(row => row.id),
    shieldRelatedExcludedInstanceIds: [] as number[],
    shieldProducerIds: [] as number[], shieldProducerCount: 0, completedShieldProducerCount: 0, pendingShieldProducerCount: 0,
    shieldCount: shields.length, endedShieldCount: 0, openShieldCount: 0, shieldHookCount: 0, closed: true };
  if (contractId === "xinyan-skill" || contractId === "xinyan-burst")
    return { ...result, ...analyzeSourceHostXinyanShields(contractId, evidence, end, shields, roots) };
  if (contractId === "layla-skill") return { ...result, ...analyzeSourceHostLaylaShields(evidence, end) };
  if (contractId === "noelle-skill") return { ...result, ...analyzeSourceHostNoelleShields(evidence, end) };
  if (contractId !== "baizhu-burst") return result;
  const { invocation } = evidence;
  const instances = evidence.shieldInstances ?? [], allHooks = evidence.shieldHooks ?? [];
  const ownedIds = new Set(result.shieldInstanceIds);
  const relatedIds = new Set(shields.flatMap(row => [row.replacesInstanceId, row.replacedByInstanceId]));
  result.shieldRelatedExcludedInstanceIds = instances
    .filter(row => !ownedIds.has(row.id) && relatedIds.has(row.id)).map(row => row.id);
  if (!evidence.producers || !evidence.shieldInstances || !evidence.shieldHooks)
    reasons.push("缺少护盾出生任务、实例或生命周期钩子的原生回执。");
  if (end === undefined || end < invocation.returnedFrame)
    reasons.push("没有覆盖本次 Q 调用的实际观察终点。");
  if (new Set(instances.map(row => row.id)).size !== instances.length
    || new Set(allHooks.map(row => row.id)).size !== allHooks.length)
    reasons.push("护盾实例或钩子编号重复。");
  if (shields.length !== baizhu.births.length)
    reasons.push("本次 Q 的六次实际护盾出生尚未完整记录。");
  if (instances.some(row => row.invocationId === invocation.id && row.creationSiteId !== baizhu.birthSite))
    reasons.push("本次 Q 混入了未审阅出生站点的护盾实例。");

  const producers = (evidence.producers ?? []).filter(row => row.invocationId === invocation.id)
    .sort((a, b) => a.id - b.id);
  for (const [index, birth] of baizhu.births.entries()) {
    const producer = producers[index];
    const children = shields.filter(row => row.spawnProducerId === producer?.id);
    if (!producer || producer.siteId !== birth.site || producer.parentProducerId !== undefined
      || producer.queuedFrame !== invocation.startedFrame || producer.state !== "completed"
      || producer.entryFacts?.["baizhu.burst.shield-birth-count"] !== 1
      || producer.startedFrame !== invocation.startedFrame + birth.delay
      || producer.completedFrame !== producer.startedFrame || children.length !== 1
      || children[0]?.createdFrame !== producer.startedFrame)
      reasons.push(`护盾出生 #${index + 1} 缺少对应的实际任务或来源规定的执行帧。`);
  }

  for (const instance of shields) {
    const problems: string[] = [];
    const hooks = allHooks.filter(row => row.instanceId === instance.id).sort((a, b) => a.id - b.id);
    result.shieldHookCount += hooks.length;
    if (instance.actorIndex !== invocation.actorIndex || instance.targetIndex !== -1
      || instance.sourceKeyFrame !== instance.createdFrame
      || instance.nativeExpiryFrame !== instance.createdFrame + baizhu.lifetime
      || instance.terminalFrame !== undefined && instance.terminalFrame > instance.nativeExpiryFrame
      || instance.creationCallbackId !== undefined || instance.creationEventListenerCallId !== undefined
      || !producers.some(row => row.id === instance.spawnProducerId))
      problems.push("出生身份、角色、全队目标或来源有效期不一致");
    const ended = instance.terminalFrame !== undefined && instance.terminalReason !== undefined
      && instance.terminalFrame >= instance.createdFrame && end !== undefined && instance.terminalFrame <= end;
    if (ended) result.endedShieldCount++;
    else problems.push("尚未取得实际覆盖、破裂或到期终点");

    if (instance.replacesInstanceId !== undefined) {
      const replaced = instances.find(row => row.id === instance.replacesInstanceId);
      if (!replaced || replaced.replacedByInstanceId !== instance.id || replaced.terminalReason !== "overwritten"
        || replaced.terminalFrame !== instance.createdFrame || replaced.type !== instance.type
        || replaced.targetIndex !== instance.targetIndex || replaced.id >= instance.id)
        problems.push("出生时替换的旧实例关系不完整");
    }
    const overwrites = hooks.filter(row => row.cause === "overwrite");
    const refreshes = hooks.filter(row => row.cause === "refresh");
    const expiries = hooks.filter(row => row.cause === "expiry");
    const breaks = hooks.filter(row => row.cause === "damage" && row.hpAfter === 0);
    if (instance.terminalReason === "overwritten") {
      const next = instances.find(row => row.id === instance.replacedByInstanceId);
      if (!next || next.replacesInstanceId !== instance.id || next.createdFrame !== instance.terminalFrame
        || next.type !== instance.type || next.targetIndex !== instance.targetIndex || next.id <= instance.id
        || overwrites.length !== 1 || refreshes.length !== 1 || expiries.length || breaks.length
        || overwrites[0]?.startedFrame !== instance.terminalFrame
        || refreshes[0]?.startedFrame !== instance.terminalFrame || refreshes[0]!.id >= overwrites[0]!.id)
        problems.push("覆盖终点没有唯一旧盾刷新、覆盖钩子与实际新实例");
    } else if (instance.terminalReason === "expired") {
      if (instance.terminalFrame !== instance.nativeExpiryFrame || expiries.length !== 1
        || expiries[0]?.startedFrame !== instance.terminalFrame || overwrites.length || refreshes.length || breaks.length
        || instance.replacedByInstanceId !== undefined)
        problems.push("到期终点与唯一到期钩子或原生到期帧不一致");
    } else if (instance.terminalReason === "broken") {
      if (breaks.length !== 1 || breaks[0]?.startedFrame !== instance.terminalFrame
        || overwrites.length || refreshes.length || expiries.length || instance.replacedByInstanceId !== undefined)
        problems.push("破裂终点没有唯一耗尽护盾的受击钩子");
    }

    let hp = instance.initialHP, previousFrame = instance.createdFrame;
    for (const hook of hooks) {
      if (hook.startedFrame < previousFrame || hook.completedFrame !== hook.startedFrame
        || end === undefined || hook.completedFrame > end
        || instance.terminalFrame !== undefined && hook.completedFrame > instance.terminalFrame
        || hook.hpBefore !== hp || hook.cause !== "damage" && hook.hpAfter !== hook.hpBefore)
        problems.push(`钩子 #${hook.id} 的时间或护盾量连续性不一致`);
      previousFrame = hook.startedFrame; hp = hook.hpAfter;
      const expectedAttacks = hook.cause === "refresh" || hook.cause === "expiry"
        || hook.cause === "damage" && hook.hpAfter === 0 ? 1 : 0;
      if (hook.cause === "refresh" ? hook.siteId !== baizhu.refreshSite : hook.siteId !== undefined)
        problems.push(`钩子 #${hook.id} 的来源站点不符`);
      if (hook.queuedAttacks.length !== expectedAttacks || hook.queuedAttacks.some(attack =>
        attack.emitSiteId !== baizhu.emitSite || attack.ability !== "Spiritvein Damage"
        || !sourceHostAttackTagMatches(attack.attackTagName, "AttackTagElementalBurst") || attack.frame !== hook.startedFrame))
        problems.push(`钩子 #${hook.id} 的灵气脉排队回执不符合实际生命周期分支`);
    }
    if (instance.lastHP !== hp) problems.push("实例末次护盾量与实际钩子链不一致");
    if (problems.length) reasons.push(`护盾实例 #${instance.id}：${[...new Set(problems)].join("；")}。`);
  }
  result.openShieldCount = result.shieldCount - result.endedShieldCount;
  result.closed = reasons.length === 0;
  return result;
}
