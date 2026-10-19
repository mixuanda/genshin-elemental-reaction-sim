import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostAbilityInvocation, SourceHostAbilityProducer } from "./source-host-finite-cast-types";
import type { SourceHostTaskLifecycle } from "./source-host-task-lifecycle";
import type { SourceHostShieldInstance, SourceHostShieldHook } from "./source-host-owned-shield-types";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";

const rule = {
  birthSite: "noelle.skill.shield",
  initialHitSite: "noelle.skill.initial-hit",
  initialHitFact: "noelle.skill.initial-hit.attack-count",
  timerSite: "noelle.skill.c4-timer",
  timerFact: "noelle.skill.c4-timer.attack-count",
  explosionSite: "noelle.shield.explosion",
  explosionAbility: "Breastplate (C4)",
  initialAbility: "Breastplate",
  attackTag: "AttackTagElementalArt",
  shieldType: 1, // shield.NoelleSkill
  shieldDescription: "Noelle Skill",
  shieldLifetime: 720,
};

export interface SourceHostNoelleShieldEvidence {
  invocation: SourceHostAbilityInvocation;
  producers?: SourceHostAbilityProducer[] | undefined;
  shieldInstances?: SourceHostShieldInstance[] | undefined;
  shieldHooks?: SourceHostShieldHook[] | undefined;
  taskLifecycle?: SourceHostTaskLifecycle | undefined;
}

function expectedTerminalAttacks(hook: SourceHostShieldHook, constellation: number): number {
  if (constellation < 4) return 0;
  return hook.cause === "overwrite" || hook.cause === "expiry"
    || hook.cause === "damage" && hook.hpAfter === 0 ? 1 : 0;
}

/** Analyze only the shield installed synchronously by this exact E invocation. */
export function analyzeSourceHostNoelleShields(
  evidence: SourceHostNoelleShieldEvidence, end: number | undefined,
) {
  const { invocation } = evidence;
  const allInstances = evidence.shieldInstances ?? [];
  const allHooks = evidence.shieldHooks ?? [];
  const shields = allInstances.filter(row => row.invocationId === invocation.id
    && row.creationSiteId === rule.birthSite);
  const roots: SourceHostFiniteRoot[] = [];
  const reasons: string[] = [];
  const result = {
    roots, reasons, shieldInstanceIds: shields.map(row => row.id),
    shieldRelatedExcludedInstanceIds: [] as number[],
    shieldCount: shields.length, endedShieldCount: 0, openShieldCount: 0,
    shieldHookCount: 0, closed: true,
  };
  const c4 = invocation.constellation >= 4;
  if (!evidence.producers || !evidence.shieldInstances || !evidence.shieldHooks || !evidence.taskLifecycle)
    reasons.push("缺少诺艾尔 E 的原生任务、护盾出生或生命周期回执。");
  if (end === undefined || end < invocation.returnedFrame)
    reasons.push("没有覆盖本次 E 调用的实际观察终点。");
  if (new Set(allInstances.map(row => row.id)).size !== allInstances.length
    || new Set(allHooks.map(row => row.id)).size !== allHooks.length)
    reasons.push("护盾实例或生命周期钩子编号重复。");
  if (shields.length !== 1)
    reasons.push("本次 E 必须恰好创建一个来源明确的护心铠护盾。");
  if (allInstances.some(row => row.invocationId === invocation.id && row.creationSiteId !== rule.birthSite))
    reasons.push("本次 E 混入了未审阅出生站点的护盾实例。");

  const relatedIds = new Set(shields.flatMap(row => [row.replacesInstanceId, row.replacedByInstanceId]));
  result.shieldRelatedExcludedInstanceIds = allInstances
    .filter(row => !result.shieldInstanceIds.includes(row.id) && relatedIds.has(row.id)).map(row => row.id);

  const producers = (evidence.producers ?? []).filter(row => row.invocationId === invocation.id);
  const initialProducers = producers.filter(row => row.siteId === rule.initialHitSite);
  if (initialProducers.length !== 1)
    reasons.push("本次 E 必须登记一个原生 +14 角色任务初击生产者。");
  const initialProducer = initialProducers[0];
  if (initialProducer) {
    const tasks = (evidence.taskLifecycle?.tasks ?? []).filter(row => row.id === initialProducer.taskId);
    const task = tasks[0];
    const queue = task && evidence.taskLifecycle?.queues.find(row => row.id === task.queueId);
    if (initialProducer.actorIndex !== invocation.actorIndex || initialProducer.parentProducerId !== undefined
      || initialProducer.queuedFrame < invocation.startedFrame || initialProducer.queuedFrame > invocation.returnedFrame
      || initialProducer.taskId === undefined || tasks.length !== 1 || !task || !queue
      || queue.kind !== "character" || queue.actorIndex !== invocation.actorIndex
      || task.origin.creationActionSequence !== invocation.actionSequence
      || task.dueClock - task.queuedClock !== 14 || task.state !== "completed"
      || task.runFrame !== initialProducer.startedFrame || task.completedFrame !== initialProducer.completedFrame
      || initialProducer.state !== "completed" || initialProducer.startedFrame === undefined
      || initialProducer.completedFrame !== initialProducer.startedFrame || end === undefined
      || initialProducer.completedFrame > end || initialProducer.entryFacts?.[rule.initialHitFact] !== 1
      || initialProducer.queuedAttacks.length !== 1
      || initialProducer.queuedAttacks.some(attack => attack.ability !== rule.initialAbility
        || !sourceHostAttackTagMatches(attack.attackTagName, rule.attackTag) || attack.frame < initialProducer.startedFrame!
        || attack.frame > initialProducer.completedFrame!))
      reasons.push("诺艾尔 E 初击的角色任务、单次队列或执行回执与来源规则不符。");
  }

  const timers = producers.filter(row => row.siteId === rule.timerSite);
  if (timers.length !== (c4 ? 1 : 0))
    reasons.push(c4 ? "C4 E 必须登记一个原生 +720 核心计时任务。" : "C0–C3 E 不应登记 C4 计时任务。");
  const timer = timers[0];
  if (timer) {
    const tasks = (evidence.taskLifecycle?.tasks ?? []).filter(row => row.id === timer.taskId);
    const task = tasks[0];
    const queue = task && evidence.taskLifecycle?.queues.find(row => row.id === task.queueId);
    const count = timer.entryFacts?.[rule.timerFact];
    if (timer.actorIndex !== invocation.actorIndex || timer.parentProducerId !== undefined
      || timer.queuedFrame !== invocation.startedFrame || timer.taskId === undefined
      || tasks.length !== 1 || !task || !queue || queue.kind !== "core"
      || task.origin.creationActionSequence !== invocation.actionSequence
      || task.dueClock - task.queuedClock !== rule.shieldLifetime || task.state !== "completed"
      || task.runFrame !== timer.startedFrame || task.completedFrame !== timer.completedFrame
      || timer.state !== "completed" || timer.startedFrame === undefined
      || timer.completedFrame !== timer.startedFrame || end === undefined || timer.completedFrame > end
      || (count !== 0 && count !== 1) || timer.queuedAttacks.length !== count
      || timer.queuedAttacks.some(attack => attack.ability !== rule.explosionAbility
        || !sourceHostAttackTagMatches(attack.attackTagName, rule.attackTag) || attack.frame !== timer.startedFrame))
      reasons.push("C4 计时任务尚未完成，或其核心队列、0/1 分支与来源规则不符。");
  }
  if (new Set((evidence.producers ?? []).map(row => row.id)).size !== (evidence.producers ?? []).length)
    reasons.push("技能后续任务编号重复。");

  for (const instance of shields) {
    const problems: string[] = [];
    const hooks = allHooks.filter(row => row.instanceId === instance.id).sort((a, b) => a.id - b.id);
    result.shieldHookCount += hooks.length;
    if (instance.actorIndex !== invocation.actorIndex || instance.targetIndex !== -1
      || instance.type !== rule.shieldType || instance.description !== rule.shieldDescription
      || instance.sourceKeyFrame !== instance.createdFrame
      || instance.nativeExpiryFrame !== instance.createdFrame + rule.shieldLifetime
      || instance.createdFrame < invocation.startedFrame || instance.createdFrame > invocation.returnedFrame
      || instance.spawnProducerId !== undefined || instance.creationCallbackId !== undefined
      || instance.creationEventListenerCallId !== undefined)
      problems.push("出生调用、角色、目标、来源类型或原生有效期不一致");

    const hasTerminal = instance.terminalFrame !== undefined && instance.terminalReason !== undefined;
    const ended = hasTerminal && instance.terminalFrame! >= instance.createdFrame
      && end !== undefined && instance.terminalFrame! <= end;
    if (ended) result.endedShieldCount++;
    if (c4 && !ended) problems.push("C4 护盾尚未观察到实际覆盖、破裂或到期终点");
    if (hasTerminal && !ended) problems.push("护盾终点超出观察窗口或早于出生");

    if (instance.replacesInstanceId !== undefined) {
      const replaced = allInstances.find(row => row.id === instance.replacesInstanceId);
      if (!replaced || replaced.replacedByInstanceId !== instance.id
        || replaced.terminalReason !== "overwritten" || replaced.terminalFrame !== instance.createdFrame
        || replaced.type !== instance.type || replaced.targetIndex !== instance.targetIndex
        || replaced.id >= instance.id)
        problems.push("出生时被覆盖的旧护盾实例关系不完整");
    }
    const overwrites = hooks.filter(row => row.cause === "overwrite");
    const expiries = hooks.filter(row => row.cause === "expiry");
    const breaks = hooks.filter(row => row.cause === "damage" && row.hpAfter === 0);
    if ((instance.terminalFrame === undefined) !== (instance.terminalReason === undefined))
      problems.push("护盾终点帧与终点原因必须同时存在");
    if (!hasTerminal && (overwrites.length > 0 || expiries.length > 0 || breaks.length > 0))
      problems.push("存在终止钩子但实例没有对应的实际终点");
    if (instance.terminalReason === "overwritten") {
      const next = allInstances.find(row => row.id === instance.replacedByInstanceId);
      if (!next || next.replacesInstanceId !== instance.id || next.createdFrame !== instance.terminalFrame
        || next.type !== instance.type || next.targetIndex !== instance.targetIndex || next.id <= instance.id
        || overwrites.length !== 1 || expiries.length || breaks.length
        || overwrites[0]?.startedFrame !== instance.terminalFrame)
        problems.push("覆盖终点没有唯一旧实例覆盖钩子与实际新实例");
    } else if (instance.terminalReason === "expired") {
      if (instance.terminalFrame !== instance.nativeExpiryFrame || expiries.length !== 1
        || expiries[0]?.startedFrame !== instance.terminalFrame || overwrites.length || breaks.length
        || instance.replacedByInstanceId !== undefined)
        problems.push("到期终点与唯一到期钩子或原生有效期不一致");
    } else if (instance.terminalReason === "broken") {
      if (breaks.length !== 1 || breaks[0]?.startedFrame !== instance.terminalFrame
        || overwrites.length || expiries.length || instance.replacedByInstanceId !== undefined)
        problems.push("破裂终点没有唯一耗尽护盾的受击钩子");
    } else if (hasTerminal) {
      problems.push("护盾终点原因不属于来源审阅的生命周期分支");
    }

    let hp = instance.initialHP;
    let previousFrame = instance.createdFrame;
    for (const hook of hooks) {
      if (hook.siteId !== undefined || hook.startedFrame < previousFrame
        || hook.completedFrame !== hook.startedFrame || end === undefined || hook.completedFrame > end
        || instance.terminalFrame !== undefined && hook.completedFrame > instance.terminalFrame
        || hook.hpBefore !== hp || hook.hpAfter < 0 || hook.hpAfter > hook.hpBefore
        || hook.cause !== "damage" && hook.hpAfter !== hook.hpBefore)
        problems.push(`钩子 #${hook.id} 的时间、来源或护盾量连续性不一致`);
      if (hook.cause === "refresh") problems.push(`钩子 #${hook.id} 含有未审阅的刷新分支`);
      previousFrame = hook.startedFrame;
      hp = hook.hpAfter;
      const expected = expectedTerminalAttacks(hook, invocation.constellation);
      if (hook.queuedAttacks.length !== expected || hook.queuedAttacks.some(attack =>
        attack.emitSiteId !== rule.explosionSite || attack.ability !== rule.explosionAbility
        || !sourceHostAttackTagMatches(attack.attackTagName, rule.attackTag) || attack.frame !== hook.startedFrame))
        problems.push(`钩子 #${hook.id} 的 C4 爆炸队列与原生生命周期分支不符`);
      if (expected) for (const attack of hook.queuedAttacks) roots.push({ attack,
        shieldInstanceId: instance.id, shieldHook: hook,
        startedFrame: hook.startedFrame, completedFrame: hook.completedFrame });
    }
    if (instance.lastHP !== hp) problems.push("护盾末次血量与钩子链不一致");
    if (instance.terminalReason === "broken" && hp !== 0)
      problems.push("破裂后护盾末次血量必须为零");
    if (instance.terminalReason !== "broken" && instance.terminalReason !== undefined && hp === 0)
      problems.push("非破裂终点不能留下耗尽血量");
    if (problems.length) reasons.push(`护盾实例 #${instance.id}：${[...new Set(problems)].join("；")}。`);
  }

  result.openShieldCount = result.shieldCount - result.endedShieldCount;
  result.closed = reasons.length === 0;
  return result;
}
