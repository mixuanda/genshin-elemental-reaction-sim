import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import type { SourceHostOwnedShieldEvidence } from "./source-host-owned-shield-analysis";
import type { SourceHostShieldInstance } from "./source-host-owned-shield-types";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";

const initialSite = "xinyan.skill.initial-shield-task";
const upgradeSite = "xinyan.skill.hit-shield-upgrade-task";
const burstSite = "xinyan.burst.c2-shield-task";
const callbackSite = "xinyan.skill.shield-hit-callback";
const firstTick = "xinyan.shield.dot-first-task", nextTick = "xinyan.shield.dot-next-task";
const fact = (name: string) => `xinyan.skill.${name}`;
const tickFact = (name: string) => `xinyan.shield.dot.${name}`;

/** The recorded character queue clock includes native hitlag; global frame deltas do not. */
function taskMatches(evidence: SourceHostOwnedShieldEvidence, id: number | undefined, delay: number,
  kind: "character" | "core", queuedFrame: number, runFrame: number | undefined, completedFrame: number | undefined) {
  if (id === undefined) return false;
  const task = evidence.taskLifecycle?.tasks.find(row => row.id === id);
  const queue = evidence.taskLifecycle?.queues.find(row => row.id === task?.queueId);
  return task !== undefined && queue?.kind === kind && (kind !== "character" || queue.actorIndex === evidence.invocation.actorIndex)
    && task.queuedFrame === queuedFrame && task.runFrame === runFrame && task.completedFrame === completedFrame
    && task.state === "completed" && Math.abs(task.dueClock - task.queuedClock - delay) < 1e-8;
}

/** Recurring damage follows the task's exact birth owner, not the shield found by its later gameplay gate. */
export function analyzeSourceHostXinyanShields(contractId: string, evidence: SourceHostOwnedShieldEvidence,
  end: number | undefined, shields: SourceHostShieldInstance[], roots: SourceHostFiniteRoot[]) {
  const { invocation } = evidence;
  const reasons: string[] = [];
  const ownedIds = new Set(shields.map(row => row.id));
  const instances = evidence.shieldInstances ?? [], hooks = evidence.shieldHooks ?? [];
  const allTasks = evidence.shieldProducers ?? [];
  const tasks = allTasks.filter(row => row.ownerInstanceId !== undefined && ownedIds.has(row.ownerInstanceId));
  const producers = (evidence.producers ?? []).filter(row => row.invocationId === invocation.id);
  const birthLevels = new Map<number, number>();
  const relatedIds = new Set(shields.flatMap(row => [row.replacesInstanceId, row.replacedByInstanceId]));
  const result = { roots, reasons, shieldInstanceIds: [...ownedIds],
    shieldRelatedExcludedInstanceIds: instances.filter(row => !ownedIds.has(row.id) && relatedIds.has(row.id)).map(row => row.id),
    shieldCount: shields.length, endedShieldCount: 0, openShieldCount: 0,
    shieldHookCount: hooks.filter(row => ownedIds.has(row.instanceId)).length,
    shieldProducerIds: tasks.map(row => row.id), shieldProducerCount: tasks.length,
    completedShieldProducerCount: tasks.filter(row => row.state === "completed").length,
    pendingShieldProducerCount: tasks.filter(row => row.state === "pending").length, closed: false };
  // Preserve pre-shield receipts for the already supported C0–C1 eight-hit Q.
  if (contractId === "xinyan-burst" && invocation.constellation < 2) {
    if (shields.length) reasons.push("C0–C1 的 Q 不应创建 C2 护盾。");
    result.closed = reasons.length === 0;
    return result;
  }
  const needsShieldTasks = contractId === "xinyan-skill" || invocation.constellation >= 2;
  if (!evidence.producers || !evidence.shieldInstances || !evidence.shieldHooks
    || needsShieldTasks && (!evidence.shieldProducers || !evidence.taskLifecycle))
    reasons.push("缺少辛焱护盾出生、递归任务或原生任务时钟回执。");
  if (new Set(instances.map(row => row.id)).size !== instances.length
    || new Set(hooks.map(row => row.id)).size !== hooks.length || new Set(allTasks.map(row => row.id)).size !== allTasks.length)
    reasons.push("护盾实例、钩子或递归任务编号重复。");

  if (contractId === "xinyan-skill") {
    const present = invocation.entryFacts?.[fact("initial-shield-present")];
    const initial = producers.filter(row => row.siteId === initialSite);
    if (present !== 0 && present !== 1 || initial.length !== (present === 0 ? 1 : 0))
      reasons.push("E 调用缺少实际既存护盾事实或初始护盾任务数不符。");
    for (const row of initial) {
      if (row.entryFacts?.[fact("initial-shield-birth-count")] !== 1
        || !taskMatches(evidence, row.taskId, 28, "character", row.queuedFrame, row.startedFrame, row.completedFrame))
        reasons.push(`初始护盾任务 #${row.id} 的出生事实或 28 本地帧任务回执不符。`);
      birthLevels.set(row.id, 1);
    }
    const initialRoot = invocation.queuedAttacks[0];
    const batches = (evidence.hitCallbackBatches ?? []).filter(row => row.parentQueueId === initialRoot?.queueId
      && row.parentAttackId === initialRoot?.attackId);
    const batchIds = new Set(batches.map(row => row.id));
    const callbacks = (evidence.hitCallbacks ?? []).filter(row => batchIds.has(row.batchId)
      && row.callbackIndex === 0 && row.siteId === callbackSite).sort((a, b) => a.id - b.id);
    const upgrades = producers.filter(row => row.siteId === upgradeSite);
    if (!evidence.hitCallbackBatches || !evidence.hitCallbacks)
      reasons.push("缺少 E 初击的实际命中回调批次，无法枚举护盾升级任务。");
    if (upgrades.length !== callbacks.length) reasons.push("每个实际 E 护盾命中回调必须恰好登记一条升级任务。");
    callbacks.forEach((callback, index) => {
      const children = upgrades.filter(row => row.parentHitCallbackId === callback.id);
      if (callback.entryFacts?.[fact("hit-count")] !== index + 1 || children.length !== 1)
        reasons.push(`E 命中回调 #${callback.id} 的实际命中计数或唯一延迟任务不完整。`);
    });
    for (const row of upgrades) {
      const facts = row.entryFacts ?? {};
      const hits = facts[fact("hit-count")], level = facts[fact("shield-level")];
      const threshold2 = facts[fact("level2-threshold")], threshold3 = facts[fact("level3-threshold")];
      const expected = hits! >= threshold3! && level! < 3 ? 3 : hits! >= threshold2! && level! < 2 ? 2 : 0;
      const birth = facts[fact("birth-level")];
      const parent = callbacks.find(callback => callback.id === row.parentHitCallbackId);
      if (!parent || !Number.isInteger(hits) || hits! < (parent?.entryFacts?.[fact("hit-count")] ?? Infinity)
        || !Number.isInteger(level) || level! < 1 || level! > 3
        || threshold2 !== (invocation.ascension >= 1 ? 1 : 2) || threshold3 !== (invocation.ascension >= 1 ? 2 : 3)
        || birth !== expected || !taskMatches(evidence, row.taskId, 13, "character", row.queuedFrame, row.startedFrame, row.completedFrame))
        reasons.push(`护盾升级任务 #${row.id} 的回调、实际分支或 13 本地帧回执不符。`);
      if (birth === 0 || birth === 2 || birth === 3) birthLevels.set(row.id, birth);
    }
  } else {
    const births = producers.filter(row => row.siteId === burstSite);
    if (births.length !== (invocation.constellation >= 2 ? 1 : 0)) reasons.push("Q 的 C2 护盾任务数与实际命座不符。");
    for (const row of births) {
      if (row.entryFacts?.["xinyan.burst.c2-shield-birth-count"] !== 1
        || !taskMatches(evidence, row.taskId, 43, "character", row.queuedFrame, row.startedFrame, row.completedFrame))
        reasons.push(`C2 护盾任务 #${row.id} 的出生事实或 43 本地帧回执不符。`);
      birthLevels.set(row.id, 3);
    }
  }
  const expectedBirthSites: Record<string, string> = {
    [initialSite]: "xinyan.skill.initial-shield-birth", [upgradeSite]: "xinyan.skill.hit-shield-upgrade-birth",
    [burstSite]: "xinyan.burst.c2-shield-birth",
  };
  for (const [id, level] of birthLevels) {
    const producer = producers.find(row => row.id === id)!;
    const born = shields.filter(row => row.spawnProducerId === id);
    if (born.length !== (level === 0 ? 0 : 1) || born.some(row => row.creationSiteId !== expectedBirthSites[producer.siteId]
      || row.createdFrame !== producer.startedFrame || row.createdFrame !== producer.completedFrame))
      reasons.push(`任务 #${id} 的实际护盾出生与分支不一致。`);
  }

  for (const instance of shields) {
    const problems: string[] = [];
    const level = instance.spawnProducerId === undefined ? undefined : birthLevels.get(instance.spawnProducerId);
    const ownedHooks = hooks.filter(row => row.instanceId === instance.id).sort((a, b) => a.id - b.id);
    const firstTasks = tasks.filter(row => row.ownerInstanceId === instance.id && row.parentProducerId === undefined);
    if (level === undefined || level === 0 || instance.actorIndex !== invocation.actorIndex || instance.targetIndex !== -1
      || instance.sourceKeyFrame !== instance.createdFrame || instance.nativeExpiryFrame !== instance.createdFrame + 720
      || instance.creationCallbackId !== undefined || instance.creationEventListenerCallId !== undefined)
      problems.push("出生任务、护盾身份或 720 帧原生有效期不符");
    if (firstTasks.length !== (level === 3 ? 1 : 0)) problems.push("三级盾必须登记一条实际首个 DoT 任务，其余盾不得创建 DoT 链");
    const ended = instance.terminalFrame !== undefined && instance.terminalReason !== undefined
      && instance.terminalFrame >= instance.createdFrame && end !== undefined && instance.terminalFrame <= end;
    if (ended) result.endedShieldCount++;
    else if (level === 3) problems.push("产生 DoT 的护盾尚未观察到实际终点");
    const terminalHooks = ownedHooks.filter(row => row.cause === "overwrite" || row.cause === "expiry"
      || row.cause === "damage" && row.hpAfter === 0);
    if (ended && (terminalHooks.length !== 1 || terminalHooks[0]?.startedFrame !== instance.terminalFrame
      || terminalHooks[0]?.cause !== (instance.terminalReason === "overwritten" ? "overwrite"
        : instance.terminalReason === "expired" ? "expiry" : "damage")
      || instance.terminalReason === "expired" && instance.terminalFrame !== instance.nativeExpiryFrame))
      problems.push("护盾终点与唯一原生终止钩子不一致");
    for (const [oldId, newId] of [[instance.replacesInstanceId, instance.id], [instance.id, instance.replacedByInstanceId]]) {
      if (oldId === undefined || newId === undefined) continue;
      const old = instances.find(row => row.id === oldId), next = instances.find(row => row.id === newId);
      if (!old || !next || old.replacedByInstanceId !== next.id || next.replacesInstanceId !== old.id
        || old.terminalReason !== "overwritten" || old.terminalFrame !== next.createdFrame
        || old.type !== next.type || old.targetIndex !== next.targetIndex || old.id >= next.id)
        problems.push("护盾替换关系缺少准确旧／新实例");
    }
    let hp = instance.initialHP, previous = instance.createdFrame;
    for (const hook of ownedHooks) {
      if (hook.cause === "refresh" || hook.siteId !== undefined || hook.queuedAttacks.length
        || hook.hpBefore !== hp || hook.cause !== "damage" && hook.hpAfter !== hp
        || hook.startedFrame < previous || hook.completedFrame !== hook.startedFrame
        || end === undefined || hook.completedFrame > end
        || instance.terminalFrame !== undefined && hook.completedFrame > instance.terminalFrame)
        problems.push(`钩子 #${hook.id} 含未经来源支持的攻击、时间或护盾量变化`);
      hp = hook.hpAfter; previous = hook.startedFrame;
    }
    if (hp !== instance.lastHP) problems.push("护盾末次量与钩子链不符");
    if (problems.length) reasons.push(`辛焱护盾 #${instance.id}：${[...new Set(problems)].join("；")}。`);
  }
  for (const row of tasks) {
    const problems: string[] = [];
    const owner = shields.find(instance => instance.id === row.ownerInstanceId)!;
    const parent = row.parentProducerId === undefined ? undefined : allTasks.find(task => task.id === row.parentProducerId);
    const children = allTasks.filter(task => task.parentProducerId === row.id);
    const task = evidence.taskLifecycle?.tasks.find(task => task.id === row.taskId);
    const birthProducer = producers.find(producer => producer.id === owner.spawnProducerId);
    if (parent ? row.siteId !== nextTick || parent.ownerInstanceId !== row.ownerInstanceId || parent.id >= row.id
      || row.queuedFrame !== parent.runFrame || task?.parentTaskId !== parent.taskId
      : row.parentProducerId !== undefined || row.siteId !== firstTick || row.queuedFrame !== owner.createdFrame
        || task?.parentTaskId !== birthProducer?.taskId)
      problems.push("递归任务缺少准确出生任务或父盾任务关系");
    if (row.state !== "completed" || row.runFrame === undefined || row.completedFrame !== row.runFrame
      || end === undefined || row.completedFrame > end
      || !taskMatches(evidence, row.taskId, 120, "core", row.queuedFrame, row.runFrame, row.completedFrame))
      problems.push("120 帧 Core 任务尚未取得实际完整执行回执");
    if (row.state === "completed") {
      const facts = row.entryFacts ?? {}, level = facts[tickFact("level")], tickSource = facts[tickFact("tick-source")];
      const gate = instances.find(instance => instance.id === row.gateInstanceId);
      if (!row.gateObserved || facts[tickFact("source-frame")] !== owner.createdFrame
        || row.gateInstanceId !== undefined && (!gate || gate.type !== owner.type
          || gate.targetIndex !== owner.targetIndex || gate.createdFrame > row.runFrame!
          || gate.terminalFrame !== undefined && gate.terminalFrame < row.runFrame!))
        problems.push("实际护盾门控或闭包来源帧不完整");
      const emits = row.gateInstanceId === undefined ? 0 : level === 3 && tickSource === owner.createdFrame ? 1 : 0;
      if (row.gateInstanceId === undefined ? level !== undefined || tickSource !== undefined
        : !Number.isInteger(level) || level! < 1 || level! > 3 || (level === 3 ? !Number.isInteger(tickSource) : tickSource !== undefined))
        problems.push("递归任务没有遵循原始门控读取顺序");
      if (facts[tickFact("attack-count")] !== emits || row.queuedAttacks.length !== emits || children.length !== emits
        || children.some(child => child.siteId !== nextTick || child.ownerInstanceId !== owner.id)
        || row.queuedAttacks.some(attack => attack.emitSiteId !== "xinyan.shield.dot.attack"
          || attack.ability !== "Sweeping Fervor (DoT)" || !sourceHostAttackTagMatches(attack.attackTagName, "AttackTagElementalArt")
          || attack.frame !== row.runFrame))
        problems.push("实际零／一攻击与后续零／一子任务分支不一致");
    }
    if (problems.length) reasons.push(`护盾 DoT 任务 #${row.id}：${problems.join("；")}。`);
  }
  result.openShieldCount = result.shieldCount - result.endedShieldCount;
  result.closed = reasons.length === 0;
  return result;
}
