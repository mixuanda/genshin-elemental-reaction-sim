import { analyzeSourceHostLaylaBurstCallbacks } from "./source-host-layla-burst-analysis";
import type { SourceHostShieldHook, SourceHostShieldInstance, SourceHostShieldProducer } from "./source-host-owned-shield-types";
import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import { z } from "zod";
import { sourceHostAttackObservationSchema } from "./source-host-action-origin";
import type { SourceHostAbilityInvocation, SourceHostAbilityProducer, SourceHostAttackDispatchCompletion } from "./source-host-finite-cast-types";
import type { SourceHostHitCallbackBatch, SourceHostHitCallback } from "./source-host-hit-callback-types";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";

import type { SourceHostTaskLifecycle } from "./source-host-task-lifecycle";
import { sourceHostHitCallbackProducerRules, analyzeSourceHostHitCallbackProducers } from "./source-host-hit-callback-producer-analysis";

const rules = {
  "layla-burst": { kind: "shield-contribution", callbackSite: "layla.burst.night-star-hit" },
  ...sourceHostHitCallbackProducerRules,
  "xinyan-skill": { kind: "shield-birth", callbackSite: "xinyan.skill.shield-hit-callback" },
  "dori-skill": { kind: "shared-once", slot: 0, callbackSite: "dori.skill.after-sales",
    emitSite: "dori.skill.after-sales-round", fact: "dori.skill.after-count" },
  "mika-skill": { kind: "shared-once", slot: 1, callbackSite: "mika.skill.rimestar-shards",
    emitSite: "mika.skill.rimestar-shard", fact: "mika.skill.selected-shards" },
  "baizhu-skill": { kind: "chain", firstSite: "baizhu.skill.chain.first",
    secondSite: "baizhu.skill.chain.second", emitSite: "baizhu.skill.chain-child",
    presentFact: "baizhu.skill.next-present", changedFact: "baizhu.skill.target-changed" },
  "navia-skill": { kind: "cannon", callbackSite: "navia.skill.c2-cannon",
    emitSite: "navia.skill.c2-cannon-attack", icdFact: "navia.skill.c2-icd-active" },
  "yaemiko-skill-stellar": { kind: "producer-shared-once", callbackSite: "yaemiko.skill.revelation-hit",
    emitSite: "yaemiko.skill.revelation-strike", presentFact: "yaemiko.skill.tick.revelation-callback",
    countFact: "yaemiko.skill.revelation.attack-count",
    producerSites: ["yaemiko.skill.first-tick", "yaemiko.skill.next-tick"] },
} as const;

export type SourceHostHitCallbackRule = typeof rules[keyof typeof rules];

export function getSourceHostHitCallbackRule(
  contractId: string, invocation: SourceHostAbilityInvocation,
): SourceHostHitCallbackRule | undefined {
  if (contractId === "mika-skill" && !invocation.params.hold) return undefined;
  if (contractId === "baizhu-skill" && invocation.constellation >= 2) return undefined;
  return Object.hasOwn(rules, contractId) ? rules[contractId as keyof typeof rules] : undefined;
}

type Observation = z.infer<typeof sourceHostAttackObservationSchema>;
export interface SourceHostHitCallbackEvidence {
  invocation: SourceHostAbilityInvocation;
  dispatchCompletions: SourceHostAttackDispatchCompletion[];
  observations: Array<{ sourceIndex: number; row: Observation }>;
  invocations?: SourceHostAbilityInvocation[] | undefined;
  producers?: SourceHostAbilityProducer[] | undefined;
  taskLifecycle?: SourceHostTaskLifecycle | undefined;
  shieldHooks?: SourceHostShieldHook[] | undefined;
  shieldInstances?: SourceHostShieldInstance[] | undefined;
  shieldProducers?: SourceHostShieldProducer[] | undefined;
  hitCallbackBatches?: SourceHostHitCallbackBatch[] | undefined;
  hitCallbacks?: SourceHostHitCallback[] | undefined;
}

export interface SourceHostHitCallbackAnalysis {
  /** Additional intrinsic children only; initial roots remain with the caller. */
  roots: SourceHostFiniteRoot[];
  reasons: string[];
  batchCount: number;
  completedBatchCount: number;
  pendingBatchCount: number;
  callbackCount: number;
  closed: boolean;
}

function slots(rule: SourceHostHitCallbackRule, root: SourceHostFiniteRoot, invocation: SourceHostAbilityInvocation): Array<string | undefined> {
  if (rule.kind === "shield-contribution") return [rule.callbackSite];
  if (rule.kind === "enemy-task") return root.producer ? [] : [rule.callbackSite];
  if (rule.kind === "producer-shared-once") {
    if (root.hitCallback || !rule.producerSites.some(site => site === root.producer?.siteId)) return [];
    return [undefined, ...(root.producer?.entryFacts?.[rule.presentFact] === 1 ? [rule.callbackSite] : []),
      ...(invocation.constellation >= 4 ? [undefined] : [])];
  }
  if (rule.kind === "shield-birth") return root.shieldInstanceId === undefined
    ? [rule.callbackSite, undefined, ...(invocation.constellation >= 1 ? [undefined] : []), ...(invocation.constellation >= 4 ? [undefined] : [])]
    : invocation.constellation >= 1 ? [undefined] : [];
  if (rule.kind === "shared-once") {
    if (root.hitCallback) return rule.slot === 1 && invocation.ascension >= 1 ? [undefined] : [];
    if (rule.slot === 0) return invocation.ascension >= 4 ? [rule.callbackSite, undefined, undefined] : [rule.callbackSite, undefined];
    return invocation.constellation >= 2 && invocation.ascension >= 1
      ? [undefined, rule.callbackSite, undefined] : [undefined, rule.callbackSite];
  }
  if (rule.kind === "chain") {
    if (!root.hitCallback) return ["baizhu.skill.particle", rule.firstSite];
    return root.hitCallback.siteId === rule.firstSite ? [rule.secondSite] : [];
  }
  if (root.hitCallback || root.producer?.siteId === "navia.skill.surging-release")
    return root.hitCallback ? invocation.constellation >= 4
      ? ["navia.cannon.shrapnel", "navia.cannon.geo-shred"] : ["navia.cannon.shrapnel"] : [];
  return root.producer?.siteId === "navia.skill.fire"
    ? invocation.constellation >= 2 ? ["navia.skill.particle", rule.callbackSite] : ["navia.skill.particle"] : [];
}

function emitter(rule: SourceHostHitCallbackRule, root: SourceHostFiniteRoot, callback: SourceHostHitCallback): string | undefined {
  if (rule.kind === "enemy-task" || rule.kind === "shield-contribution") return undefined;
  if (rule.kind === "producer-shared-once") return !root.hitCallback
    && rule.producerSites.some(site => site === root.producer?.siteId)
    && callback.callbackIndex === 1 && callback.siteId === rule.callbackSite ? rule.emitSite : undefined;
  if (rule.kind === "shield-birth") return undefined;
  if (rule.kind === "shared-once")
    return !root.hitCallback && callback.callbackIndex === rule.slot && callback.siteId === rule.callbackSite
      ? rule.emitSite : undefined;
  if (rule.kind === "chain") {
    const site = !root.hitCallback ? rule.firstSite
      : root.hitCallback.siteId === rule.firstSite ? rule.secondSite : undefined;
    const slot = !root.hitCallback ? 1 : 0;
    return callback.callbackIndex === slot && callback.siteId === site ? rule.emitSite : undefined;
  }
  return !root.hitCallback && root.producer?.siteId === "navia.skill.fire"
    && callback.callbackIndex === 1 && callback.siteId === rule.callbackSite ? rule.emitSite : undefined;
}

function resolvedParent(evidence: SourceHostHitCallbackEvidence, root: SourceHostFiniteRoot, batch: SourceHostHitCallbackBatch): boolean {
  if (root.attack.attackId === undefined || batch.parentQueueId !== root.attack.queueId
    || batch.parentAttackId !== root.attack.attackId) return false;
  const completions = evidence.dispatchCompletions.filter(row => row.dispatchId === batch.parentDispatchId
    && row.attackId === root.attack.attackId && row.enemyTargetKeys.includes(batch.targetKey));
  return completions.length === 1 && evidence.observations.some(entry => entry.row.stage === "resolved"
    && entry.row.attackId === root.attack.attackId && entry.row.dispatchId === batch.parentDispatchId
    && entry.row.targetKey === batch.targetKey);
}

/** Select only observed child queues reached through an exact audited callback edge. */
export function reachableSourceHostHitCallbackRoots(
  contractId: string, evidence: SourceHostHitCallbackEvidence, initialRoots: SourceHostFiniteRoot[],
): SourceHostFiniteRoot[] {
  const rule = getSourceHostHitCallbackRule(contractId, evidence.invocation);
  if (!rule || rule.kind === "enemy-task" || rule.kind === "shield-contribution") return [];
  const batches = evidence.hitCallbackBatches ?? [];
  const callbacks = evidence.hitCallbacks ?? [];
  const reached = new Set(initialRoots.map(root => root.attack.queueId));
  const children: SourceHostFiniteRoot[] = [];
  const frontier = [...initialRoots];
  for (let index = 0; index < frontier.length; index++) {
    const parent = frontier[index]!;
    for (const batch of batches) {
      if (batch.state !== "completed" || batch.hitConfirmBlocked || batch.runFrame === undefined
        || batch.completedFrame !== batch.runFrame || !resolvedParent(evidence, parent, batch)) continue;
      const rows = callbacks.filter(row => row.batchId === batch.id).sort((a, b) => a.callbackIndex - b.callbackIndex);
      const expected = slots(rule, parent, evidence.invocation);
      if (rule.kind !== "producer-shared-once" && batch.callbackCount !== expected.length || batch.callbackIds.length !== rows.length
        || rows.length !== batch.callbackCount || rows.some((row, slot) => row.id !== batch.callbackIds[slot]
          || row.callbackIndex !== slot || row.startedFrame !== batch.runFrame
          || row.completedFrame !== row.startedFrame
          || rule.kind !== "producer-shared-once" && expected[slot] !== undefined && expected[slot] !== row.siteId)) continue;
      for (const callback of rows) {
        const emitSite = emitter(rule, parent, callback);
        if (!emitSite) continue;
        for (const attack of callback.queuedAttacks) {
          if (attack.emitSiteId !== emitSite || reached.has(attack.queueId)) continue;
          const child: SourceHostFiniteRoot = { attack, callbackBatch: batch, hitCallback: callback,
            startedFrame: callback.startedFrame, completedFrame: callback.completedFrame };
          reached.add(attack.queueId);
          children.push(child);
          frontier.push(child);
        }
      }
    }
  }
  return children;
}

/** Baizhu's next chain hit reads the mutable skillAtk field, which a later E overwrites. */
function baizhuCallbackLifetime(
  call: SourceHostAbilityInvocation, evidence: SourceHostHitCallbackEvidence, end: number | undefined,
  initialRoots?: SourceHostFiniteRoot[],
): number {
  if (call.constellation >= 2 || !evidence.hitCallbackBatches || !evidence.hitCallbacks) return Infinity;
  const ownedProducers = (evidence.producers ?? []).filter(row => row.invocationId === call.id);
  if (ownedProducers.some(row => row.state !== "completed")) return Infinity;
  const roots = initialRoots ?? [
    ...call.queuedAttacks.map(attack => ({ attack, startedFrame: call.startedFrame, completedFrame: call.returnedFrame })),
    ...ownedProducers.flatMap(producer => producer.queuedAttacks.map(attack => ({
      attack, producer, startedFrame: producer.startedFrame, completedFrame: producer.completedFrame,
    }))),
  ];
  const callEvidence = { ...evidence, invocation: call };
  const allRoots = [...roots, ...reachableSourceHostHitCallbackRoots("baizhu-skill", callEvidence, roots)];
  let last = call.returnedFrame;
  for (const producer of ownedProducers) {
    if (producer.completedFrame === undefined) return Infinity;
    last = Math.max(last, producer.completedFrame);
  }
  for (const root of allRoots) {
    const attackId = root.attack.attackId;
    if (attackId === undefined) return Infinity;
    const dispatches = evidence.dispatchCompletions.filter(row => row.attackId === attackId);
    if (dispatches.length !== 1) return Infinity;
    const dispatch = dispatches[0]!;
    last = Math.max(last, dispatch.frame);
    for (const targetKey of dispatch.enemyTargetKeys) {
      const terminal = evidence.observations.filter(entry => entry.row.attackId === attackId
        && entry.row.dispatchId === dispatch.dispatchId && entry.row.targetKey === targetKey
        && (entry.row.stage === "resolved" || entry.row.stage === "missed"));
      if (terminal.length !== 1) return Infinity;
      const matching = evidence.hitCallbackBatches.filter(batch => batch.parentAttackId === attackId
        && batch.parentQueueId === root.attack.queueId && batch.parentDispatchId === dispatch.dispatchId
        && batch.targetKey === targetKey);
      if (terminal[0]!.row.stage === "missed") {
        if (matching.length) return Infinity;
        continue;
      }
      if (matching.length !== 1) return Infinity;
      const batch = matching[0]!;
      if (batch.state === "pending" || batch.completedFrame === undefined) return Infinity;
      const rows = evidence.hitCallbacks.filter(row => row.batchId === batch.id)
        .sort((a, b) => a.callbackIndex - b.callbackIndex);
      if (batch.state === "blocked") {
        if (!batch.hitConfirmBlocked || rows.length || batch.callbackIds.length) return Infinity;
      } else if (batch.hitConfirmBlocked || batch.callbackCount !== slots(rules["baizhu-skill"], root, call).length
        || rows.length !== batch.callbackCount || batch.callbackIds.length !== rows.length
        || rows.some((row, slot) => row.id !== batch.callbackIds[slot] || row.callbackIndex !== slot
          || row.siteId !== slots(rules["baizhu-skill"], root, call)[slot])) return Infinity;
      for (const callback of rows) {
        const emitted = emitter(rules["baizhu-skill"], root, callback);
        if (callback.queuedAttacks.some(attack => attack.emitSiteId !== emitted)) return Infinity;
        if (emitted && (callback.entryFacts?.[rules["baizhu-skill"].presentFact] !== callback.queuedAttacks.length
          || callback.queuedAttacks.length > 1)) return Infinity;
      }
      last = Math.max(last, batch.completedFrame);
    }
  }
  if (end === undefined || last > end) return Infinity;
  return last;
}

/** Validate the callback census; generic queue/dispatch/target outcomes remain with finite-cast. */
export function analyzeSourceHostHitCallbacks(
  contractId: string, evidence: SourceHostHitCallbackEvidence, initialRoots: SourceHostFiniteRoot[], end: number | undefined,
): SourceHostHitCallbackAnalysis {
  const rule = getSourceHostHitCallbackRule(contractId, evidence.invocation);
  const result: SourceHostHitCallbackAnalysis = {
    roots: [], reasons: [], batchCount: 0, completedBatchCount: 0, pendingBatchCount: 0,
    callbackCount: 0, closed: true,
  };
  if (!rule) return result;
  const { reasons } = result;
  if (!evidence.hitCallbackBatches || !evidence.hitCallbacks) reasons.push("缺少完整的原生命中回调批次回执。");
  if (end === undefined) reasons.push("缺少命中回调观察终点。");
  const batches = evidence.hitCallbackBatches ?? [];
  const callbacks = evidence.hitCallbacks ?? [];
  if (new Set(batches.map(row => row.id)).size !== batches.length
    || new Set(callbacks.map(row => row.id)).size !== callbacks.length)
    reasons.push("命中回调批次或槽位编号重复。");
  result.roots = reachableSourceHostHitCallbackRoots(contractId, evidence, initialRoots);
  const roots = [...initialRoots, ...result.roots];
  const sharedCallbacks: SourceHostHitCallback[] = [];
  const producerSharedCallbacks = new Map<number, SourceHostHitCallback[]>();
  const emittedQueueIds = new Set<number>();
  const visitedBatchIds = new Set<number>();
  for (const root of roots) {
    if (rule.kind === "producer-shared-once" && !root.hitCallback
      && rule.producerSites.some(site => site === root.producer?.siteId)) {
      const present = root.producer?.entryFacts?.[rule.presentFact];
      if (present !== 0 && present !== 1)
        reasons.push(`杀生樱队列 #${root.attack.queueId} 缺少原生启示回调是否存在的读数。`);
    }
    const attackId = root.attack.attackId;
    const completions = attackId === undefined ? [] : evidence.dispatchCompletions.filter(row => row.attackId === attackId);
    if (completions.length !== 1) {
      reasons.push(`攻击队列 #${root.attack.queueId} 缺少唯一派发完成回执。`);
      continue;
    }
    const completion = completions[0]!;
    const expectedSlots = slots(rule, root, evidence.invocation);
    const targets = completion.enemyTargetKeys;
    for (const targetKey of targets) {
      const terminal = evidence.observations.filter(entry => entry.row.attackId === attackId
        && entry.row.dispatchId === completion.dispatchId && entry.row.targetKey === targetKey
        && (entry.row.stage === "resolved" || entry.row.stage === "missed"));
      if (terminal.length !== 1) {
        reasons.push(`攻击 #${attackId} 的目标 ${targetKey} 缺少唯一终态回执。`);
        continue;
      }
      const candidates = batches.filter(batch => batch.parentAttackId === attackId
        && batch.parentDispatchId === completion.dispatchId && batch.targetKey === targetKey);
      if (terminal[0]!.row.stage === "missed") {
        if (candidates.length) reasons.push(`落空目标 ${targetKey} 却登记了命中回调。`);
        continue;
      }
      if (candidates.length !== 1 || candidates[0]?.parentQueueId !== root.attack.queueId) {
        reasons.push(`已结算目标 ${targetKey} 缺少精确队列归属的唯一回调批次。`);
        continue;
      }
      const batch = candidates[0]!;
      visitedBatchIds.add(batch.id);
      result.batchCount++;
      if (batch.callbackCount !== expectedSlots.length || batch.queuedFrame > (batch.runFrame ?? end ?? -1)
        || batch.queuedFrame !== completion.frame
        || batch.completedFrame !== undefined && (end === undefined || batch.completedFrame > end))
        reasons.push(`回调批次 #${batch.id} 的槽位数或执行帧不符。`);
      const rows = callbacks.filter(row => row.batchId === batch.id).sort((a, b) => a.callbackIndex - b.callbackIndex);
      if (new Set(batch.callbackIds).size !== batch.callbackIds.length
        || rows.length !== batch.callbackIds.length
        || rows.some((row, index) => row.id !== batch.callbackIds[index]))
        reasons.push(`回调批次 #${batch.id} 的执行槽位清单不完整。`);
      if (batch.state === "pending") {
        result.pendingBatchCount++;
        reasons.push(`回调批次 #${batch.id} 仍待执行。`);
        if (rows.length || batch.runFrame !== undefined || batch.completedFrame !== undefined)
          reasons.push(`待执行批次 #${batch.id} 已出现回调结果。`);
        continue;
      }
      result.completedBatchCount++;
      if (batch.runFrame === undefined || batch.completedFrame !== batch.runFrame
        || end === undefined || batch.completedFrame > end)
        reasons.push(`回调批次 #${batch.id} 没有完整的同帧执行区间。`);
      if (batch.state === "blocked") {
        if (!batch.hitConfirmBlocked || rows.length) reasons.push(`阻断批次 #${batch.id} 却执行了命中回调。`);
        continue;
      }
      if (batch.hitConfirmBlocked || rows.length !== batch.callbackCount)
        reasons.push(`完成批次 #${batch.id} 缺少应执行的命中回调。`);
      for (const [index, callback] of rows.entries()) {
        result.callbackCount++;
        const expectedSite = expectedSlots[index];
        if (callback.callbackIndex !== index || expectedSite !== undefined && callback.siteId !== expectedSite
          || callback.startedFrame !== batch.runFrame || callback.completedFrame !== callback.startedFrame)
          reasons.push(`回调 #${callback.id} 的槽位、来源或执行帧不一致。`);
        const emitSite = emitter(rule, root, callback);
        if (callback.queuedAttacks.some(attack => attack.emitSiteId !== emitSite
          || attack.frame < callback.startedFrame || attack.frame > callback.completedFrame))
          reasons.push(`回调 #${callback.id} 发出了未经审阅的子攻击。`);
        for (const attack of callback.queuedAttacks) {
          if (emittedQueueIds.has(attack.queueId)) reasons.push(`回调子攻击队列 #${attack.queueId} 重复。`);
          emittedQueueIds.add(attack.queueId);
        }
        if (rule.kind === "shared-once" && emitSite) sharedCallbacks.push(callback);
        if (rule.kind === "producer-shared-once" && emitSite) {
          const grouped = producerSharedCallbacks.get(root.attack.queueId) ?? [];
          grouped.push(callback);
          producerSharedCallbacks.set(root.attack.queueId, grouped);
          const count = callback.entryFacts?.[rule.countFact];
          if ((count !== 0 && count !== 1) || callback.queuedAttacks.length !== count)
            reasons.push(`杀生樱启示回调 #${callback.id} 的实际发射分支或攻击数不符。`);
          for (const attack of callback.queuedAttacks) {
            const dispatch = evidence.dispatchCompletions.filter(row => row.attackId === attack.attackId);
            if (attack.ability !== "Sesshou Sakura (Stellar-Conduct)"
              || !sourceHostAttackTagMatches(attack.attackTagName, "AttackTagDirectStellarConduct")
              || attack.frame !== callback.startedFrame || dispatch.length !== 1
              || dispatch[0]!.frame !== callback.startedFrame + 12)
              reasons.push(`杀生樱启示回调 #${callback.id} 的攻击身份或 +12 帧派发不符。`);
          }
        }
        if (rule.kind === "chain" && emitSite) {
          const present = callback.entryFacts?.[rule.presentFact];
          const changed = callback.entryFacts?.[rule.changedFact];
          if ((present !== 0 && present !== 1) || callback.queuedAttacks.length !== present
            || present === 1 && changed !== 0 && changed !== 1)
            reasons.push(`连锁回调 #${callback.id} 缺少实际目标选择分支或攻击数不符。`);
          if (present === 1 && (changed === 0 || changed === 1)) {
            const child = callback.queuedAttacks[0];
            const dispatch = evidence.dispatchCompletions.filter(row => row.attackId === child?.attackId);
            if (child?.frame !== callback.startedFrame || dispatch.length !== 1
              || dispatch[0]!.frame !== callback.startedFrame + 48 + 6 * changed)
              reasons.push(`连锁回调 #${callback.id} 的 48/54 帧后续攻击与实际目标分支不符。`);
          }
        }
        if (rule.kind === "cannon" && emitSite) {
          const active = callback.entryFacts?.[rule.icdFact];
          if ((active !== 0 && active !== 1) || callback.queuedAttacks.length !== (active === 0 ? 1 : 0))
            reasons.push(`炮击回调 #${callback.id} 缺少实际冷却分支或攻击数不符。`);
        }
      }
    }
  }
  for (const batch of batches) if (roots.some(root => root.attack.queueId === batch.parentQueueId)
    && !visitedBatchIds.has(batch.id)) reasons.push(`关联攻击的回调批次 #${batch.id} 未能匹配唯一已结算目标。`);
  for (const root of roots) {
    const attackId = root.attack.attackId;
    const dispatch = evidence.dispatchCompletions.find(row => row.attackId === attackId);
    if (dispatch?.skippedEnemyKeys.some(targetKey => batches.some(batch => batch.parentAttackId === attackId
      && batch.parentDispatchId === dispatch.dispatchId && batch.targetKey === targetKey)))
      reasons.push(`攻击 #${attackId} 的跳过目标却登记了命中回调。`);
  }
  if (rule.kind === "shared-once" && sharedCallbacks.length) {
    sharedCallbacks.sort((a, b) => a.id - b.id);
    const first = sharedCallbacks[0]!;
    const firstCount = first.entryFacts?.[rule.fact];
    const expected = rule.slot === 0 ? evidence.invocation.constellation >= 1 ? 3 : 2 : firstCount;
    if (!Number.isInteger(firstCount) || rule.slot === 0 && firstCount !== expected
      || rule.slot === 1 && (firstCount! < 0 || firstCount! > 3)
      || first.queuedAttacks.length !== firstCount)
      reasons.push(`首次 ${rule.callbackSite} 回调的实际子攻击数不符。`);
    if (sharedCallbacks.slice(1).some(row => row.entryFacts?.[rule.fact] !== undefined || row.queuedAttacks.length !== 0))
      reasons.push(`${rule.callbackSite} 的共享一次性回调重复发射。`);
  }
  if (rule.kind === "producer-shared-once") for (const [queueId, group] of producerSharedCallbacks) {
    group.sort((a, b) => a.id - b.id);
    if (group[0]?.entryFacts?.[rule.countFact] !== 1 || group[0]?.queuedAttacks.length !== 1
      || group.slice(1).some(callback => callback.entryFacts?.[rule.countFact] !== 0 || callback.queuedAttacks.length !== 0))
      reasons.push(`杀生樱队列 #${queueId} 的启示闭包未遵循首个敌人命中发射一次、后续目标不重复发射的规则。`);
  }
  if (rule.kind === "chain") {
    if (!evidence.invocations || !evidence.producers || !evidence.hitCallbackBatches || !evidence.hitCallbacks)
      reasons.push("缺少全部调用、任务及回调回执，无法检查白术连锁攻击与下一次 E 的重叠。");
    else {
      const currentEnd = baizhuCallbackLifetime(evidence.invocation, evidence, end, initialRoots);
      if (evidence.invocations.some(other => other.id !== evidence.invocation.id
        && other.actorIndex === evidence.invocation.actorIndex
        && other.characterKey === evidence.invocation.characterKey && other.action === evidence.invocation.action
        && other.success && other.startedFrame <= currentEnd
        && (other.startedFrame >= evidence.invocation.startedFrame
          || baizhuCallbackLifetime(other, evidence, end) >= evidence.invocation.startedFrame)))
        reasons.push("白术 E 连锁回调与另一 E 调用重叠，后者会改写共享攻击模板。");
    }
  }
  if (rule.kind === "enemy-task") reasons.push(...analyzeSourceHostHitCallbackProducers(rule, evidence, initialRoots, end));
  if (rule.kind === "shield-contribution") reasons.push(...analyzeSourceHostLaylaBurstCallbacks(evidence, initialRoots, end));
  result.closed = reasons.length === 0;
  return result;
}
