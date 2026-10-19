import { sourceHostAttackTagMatches } from "./source-host-attack-tag";
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { sourceHostAttackObservationSchema, sourceHostPendingAttackStageSchema } from "./source-host-action-origin";
import { sourceHostTaskLifecycleSchema } from "./source-host-task-lifecycle";
import { sourceHostAttackDispatchCompletionSchema } from "./source-host-finite-cast-types";
import { sourceHostHitCallbackBatchSchema, sourceHostHitCallbackSchema } from "./source-host-hit-callback-types";
import { analyzeSourceHostEventCallbacks, reachableSourceHostEventCallbackAttacks } from "./source-host-event-callback-analysis";
import { analyzeSourceHostEventTaskTree } from "./source-host-event-task-tree-analysis";
import {
  sourceHostEventRegistrationSchema, sourceHostEventEmissionSchema,
  sourceHostEventListenerCallSchema, sourceHostEventProducerSchema,
  type SourceHostEventQueuedAttack,
} from "./source-host-event-types";
import { sourceHostResultSchema, sourceHostApplicationSchema, type SourceHostResult } from "./source-host-wire";
import {
  captureSourceHostHit, createSourceHostEditableCalculation, calculateSourceHostEditableCalculation,
  sourceHostEditableCalculationSchema, sourceHostHitCaptureSchema,
} from "./source-host-capture";
import {
  sourceHostEventComponentIds, getSourceHostEventComponentRule, getSourceHostEventComponentForSite,
} from "./source-host-event-rules";

const sourceContextSchema = sourceHostHitCaptureSchema.pick({
  sourceCommit: true, sourceConfig: true, seed: true, executionArtifact: true,
  randomness: true, initialEnergy: true, startupState: true,
  targetScene: true, observationWindow: true, targetPhases: true,
});

export const sourceHostEventCollectionSchema = z.object({
  schemaVersion: z.literal("source-host-event-collection-v1"),
  scope: z.literal("observed-event-component"),
  componentId: z.enum(sourceHostEventComponentIds),
  selection: z.object({ listenerCallId: z.number().int().positive() }).strict(),
  sourceContext: sourceContextSchema,
  nativeEvidence: z.object({
    observationEndFrame: z.number().int().nonnegative().optional(),
    eventRegistrations: z.array(sourceHostEventRegistrationSchema).optional(),
    eventEmissions: z.array(sourceHostEventEmissionSchema).optional(),
    eventListenerCalls: z.array(sourceHostEventListenerCallSchema).optional(),
    eventProducers: z.array(sourceHostEventProducerSchema).optional(),
    attackDispatchCompletions: z.array(sourceHostAttackDispatchCompletionSchema).optional(),
    attackObservations: z.array(sourceHostAttackObservationSchema).optional(),
    pendingAttackStages: z.array(sourceHostPendingAttackStageSchema).optional(),
    taskLifecycle: sourceHostTaskLifecycleSchema.optional(),
    hitCallbackBatches: z.array(sourceHostHitCallbackBatchSchema).optional(),
    hitCallbacks: z.array(sourceHostHitCallbackSchema).optional(),
    applications: z.array(sourceHostApplicationSchema),
  }).strict(),
  hits: z.array(z.object({ included: z.boolean(), calculation: sourceHostEditableCalculationSchema }).strict()),
}).strict();
export type SourceHostEventCollection = z.infer<typeof sourceHostEventCollectionSchema>;

export interface SourceHostEventCollectionRow {
  applicationId?: number;
  attackId?: number;
  dispatchId?: number;
  targetKey?: number;
  status: "calculated" | "excluded" | "missed" | "unresolved" | "pending";
  value?: number;
  reason: string;
  trace: CalculationTraceNode[];
}
export interface SourceHostEventCollectionAnalysis {
  deliveryClosed: boolean;
  label: string;
  reasons: string[];
  scopeNotes: string[];
  attackCount: number;
  producerCount: number;
  completedProducerCount: number;
  pendingProducerCount: number;
}

/** Select a real listener call by ID. No action, ability-name, or nearby-frame attribution. */
export function captureSourceHostEventCollection(raw: SourceHostResult, listenerCallId: number): SourceHostEventCollection | undefined {
  const result = sourceHostResultSchema.parse(raw);
  const calls = (result.eventListenerCalls ?? []).filter(row => row.id === listenerCallId);
  if (calls.length !== 1) return undefined;
  const call = calls[0]!;
  const componentId = getSourceHostEventComponentForSite(call.siteId);
  if (!componentId) return undefined;
  const rule = getSourceHostEventComponentRule(componentId);
  if (!rule.sourceCommits.includes(result.sourceCommit)) return undefined;
  const producers = (result.eventProducers ?? []).filter(row => row.listenerCallId === listenerCallId);
  const callbackAttacks = rule.kind === "beidou-chain" ? reachableSourceHostEventCallbackAttacks({
    listenerCall: call, attackObservations: result.attackObservations ?? [],
    attackDispatchCompletions: result.attackDispatchCompletions ?? [],
    hitCallbackBatches: result.hitCallbackBatches, hitCallbacks: result.hitCallbacks,
  }, call.queuedAttacks) : [];
  const attackIds = new Set([...call.queuedAttacks, ...producers.flatMap(row => row.queuedAttacks), ...callbackAttacks]
    .flatMap(row => row.attackId === undefined ? [] : [row.attackId]));
  const applications = result.applications.filter(row => attackIds.has(row.attackId));
  const duration = (result.result as { duration?: unknown }).duration;
  return sourceHostEventCollectionSchema.parse({
    schemaVersion: "source-host-event-collection-v1", scope: "observed-event-component", componentId,
    selection: { listenerCallId },
    sourceContext: sourceContextSchema.parse({ sourceCommit: result.sourceCommit, sourceConfig: result.config,
      seed: result.seed, executionArtifact: result.executionArtifact, randomness: result.randomness,
      initialEnergy: result.initialEnergy, startupState: result.startupState, targetScene: result.targetScene,
      observationWindow: result.observationWindow, targetPhases: result.targetPhases }),
    nativeEvidence: {
      ...(result.lifecycleObservationFrame !== undefined ? { observationEndFrame: result.lifecycleObservationFrame }
        : typeof duration === "number" && Number.isInteger(duration) && duration >= 0 ? { observationEndFrame: duration } : {}),
      ...(result.eventRegistrations === undefined ? {} : { eventRegistrations: result.eventRegistrations }),
      ...(result.eventEmissions === undefined ? {} : { eventEmissions: result.eventEmissions }),
      ...(result.eventListenerCalls === undefined ? {} : { eventListenerCalls: result.eventListenerCalls }),
      ...(result.eventProducers === undefined ? {} : { eventProducers: result.eventProducers }),
      ...(result.attackDispatchCompletions === undefined ? {} : { attackDispatchCompletions: result.attackDispatchCompletions }),
      ...(result.attackObservations === undefined ? {} : { attackObservations: result.attackObservations }),
      ...(result.pendingAttackStages === undefined ? {} : { pendingAttackStages: result.pendingAttackStages }),
      ...(result.taskLifecycle === undefined ? {} : { taskLifecycle: result.taskLifecycle }),
      ...(result.hitCallbackBatches === undefined ? {} : { hitCallbackBatches: result.hitCallbackBatches }),
      ...(result.hitCallbacks === undefined ? {} : { hitCallbacks: result.hitCallbacks }),
      applications,
    },
    hits: applications.map(application => ({ included: true,
      calculation: createSourceHostEditableCalculation(captureSourceHostHit(result, application.id)) })),
  });
}

function uniqueIds(rows: Array<{ id: number }>): boolean {
  return new Set(rows.map(row => row.id)).size === rows.length;
}

function analyzeEventDelivery(document: SourceHostEventCollection): {
  analysis: SourceHostEventCollectionAnalysis; attacks: SourceHostEventQueuedAttack[];
} {
  const { nativeEvidence: evidence, componentId } = document;
  const rule = getSourceHostEventComponentRule(componentId), reasons: string[] = [];
  if (!rule.sourceCommits.includes(document.sourceContext.sourceCommit))
    reasons.push(rule.kind === "baizhu-c2" || rule.kind === "tartaglia-riptide"
      ? "该来源提交不在两条已审阅事件监听器源码规则内。"
      : "该来源提交不在本组件已审阅事件监听器源码规则内。");
  const registrations = evidence.eventRegistrations ?? [], emissions = evidence.eventEmissions ?? [];
  const calls = evidence.eventListenerCalls ?? [], producers = evidence.eventProducers ?? [];
  const dispatches = evidence.attackDispatchCompletions ?? [], observations = evidence.attackObservations ?? [];
  const pending = evidence.pendingAttackStages ?? [];
  if (!evidence.eventRegistrations || !evidence.eventEmissions || !evidence.eventListenerCalls
    || !evidence.eventProducers || !evidence.attackDispatchCompletions
    || !evidence.attackObservations || !evidence.pendingAttackStages)
    reasons.push("缺少事件、派发、目标或待结算阶段的完整原生回执。");
  if (evidence.observationEndFrame === undefined) reasons.push("缺少本次事件攻击的观察终点。");
  if (![registrations, emissions, calls, producers, dispatches.map(row => ({ id: row.dispatchId }))]
    .every(uniqueIds)) reasons.push("事件登记、调用、任务或派发编号重复。");

  const selectedCalls = calls.filter(row => row.id === document.selection.listenerCallId);
  const call = selectedCalls.length === 1 ? selectedCalls[0] : undefined;
  if (!call) reasons.push("缺少唯一的所选事件监听器调用。");
  const registration = call === undefined ? undefined : registrations.find(row => row.id === call.registrationId);
  const emission = call === undefined ? undefined : emissions.find(row => row.id === call.emissionId);
  if (!registration || !emission) reasons.push("监听器缺少原生注册或事件发射身份。");
  else if (call && (registration.siteId !== rule.siteId || call.siteId !== rule.siteId
    || registration.key !== rule.key || call.key !== rule.key
    || registration.slotIndex !== call.slotIndex || registration.eventType !== call.eventType
    || emission.eventType !== call.eventType || emission.listenerIds.filter(id => id === call.id).length !== 1
    || emission.suppressedListenerIds.includes(registration.id)
    || registration.createdFrame > emission.frame
    || registration.endedFrame !== undefined && registration.endedFrame < emission.frame
    || call.startedFrame !== emission.frame || call.completedFrame !== call.startedFrame
    || emission.completedFrame < call.completedFrame
    || evidence.observationEndFrame !== undefined && emission.completedFrame > evidence.observationEndFrame))
    reasons.push("事件注册点、槽位、触发时序或实际调用名单不符。");
  if (emission) {
    const hasParent = emission.parentQueueId !== undefined || emission.parentAttackId !== undefined
      || emission.parentDispatchId !== undefined;
    if (!hasParent && rule.kind !== "tartaglia-riptide")
      reasons.push(rule.kind === "baizhu-c2"
        ? "白术 OnEnemyDamage 事件缺少真实触发攻击身份。"
        : "OnEnemyDamage 事件缺少真实触发攻击身份。");
    if (hasParent) {
      const parent = dispatches.filter(row => row.dispatchId === emission.parentDispatchId
        && row.attackId === emission.parentAttackId);
      const target = observations.filter(row => row.attackId === emission.parentAttackId
        && row.dispatchId === emission.parentDispatchId && row.targetKey === emission.targetKey
        && row.stage === "resolved");
      const queued = emission.parentQueueId === undefined ? undefined : observations[emission.parentQueueId - 1];
      if (emission.parentAttackId === undefined || emission.parentDispatchId === undefined
        || parent.length !== 1 || !parent[0]!.enemyTargetKeys.includes(emission.targetKey)
        || target.length !== 1 || target[0]!.frame !== parent[0]!.frame
        || emission.frame > target[0]!.frame
        || emission.parentQueueId !== undefined && (!queued || queued.stage !== "queued"
          || queued.attackId !== emission.parentAttackId))
        reasons.push("事件发射的触发队列、攻击、派发或目标与原生回执不符。");
    }
  }

  const owned = call === undefined ? [] : producers.filter(row => row.listenerCallId === call.id);
  const delayedRule = rule.kind === "tartaglia-riptide" || rule.kind === "delayed" ? rule : undefined;
  let expectedDirect = 0, expectedProducerCount = 0;
  let expectedAttack: { ability: string; attackTag: string } = rule;
  if (call) {
    if (rule.kind === "baizhu-c2") {
      const actor = call.entryFacts?.["baizhu.c2.trigger-actor-active"];
      const icd = call.entryFacts?.["baizhu.c2.icd-active"];
      if (actor !== 0 && actor !== 1 || actor === 0 && icd !== undefined
        || actor === 1 && icd !== 0 && icd !== 1)
        reasons.push("白术 C2 缺少实际触发角色与冷却分支读数。");
      expectedDirect = actor === 1 && icd === 0 ? 1 : 0;
    } else if (rule.kind === "tartaglia-riptide") {
      const enemy = call.entryFacts?.["tartaglia.riptide.target-enemy"];
      const active = call.entryFacts?.["tartaglia.riptide.active"];
      if (enemy !== 0 && enemy !== 1 || enemy === 0 && active !== undefined
        || enemy === 1 && active !== 0 && active !== 1)
        reasons.push("达达利亚死亡事件缺少实际目标与断流状态分支读数。");
      expectedProducerCount = enemy === 1 && active === 1 ? 1 : 0;
    } else if (rule.kind === "delayed" || rule.kind === "chiori-c4-tree") {
      const count = call.entryFacts?.[rule.producerCountFact];
      if (count === undefined || !rule.allowedProducerCounts.includes(count))
        reasons.push("本次监听器缺少已审阅任务分支的数量读数，或读数超出允许分支。");
      else expectedProducerCount = count;
    } else {
      const count = call.entryFacts?.[rule.attackCountFact];
      const validCount = count !== undefined && (rule.attackCountMode === "source-loop"
        ? Number.isInteger(count) && count >= 0 : rule.allowedAttackCounts.includes(count));
      if (!validCount)
        reasons.push("本次监听器缺少已审阅直接排队分支的攻击数读数，或读数超出允许分支。");
      else expectedDirect = count!;
      if (rule.attackVariant && expectedDirect > 0) {
        const variant = rule.attackVariant.variants.find(row => row.value === call.entryFacts?.[rule.attackVariant!.fact]);
        if (!variant) reasons.push("本次监听器缺少已审阅攻击分支的能力与标签配对读数。");
        else expectedAttack = variant;
      }
    }
    const rootProducerCount = rule.kind === "chiori-c4-tree"
      ? owned.filter(row => row.parentProducerId === undefined).length : owned.length;
    if (call.queuedAttacks.length !== expectedDirect || rootProducerCount !== expectedProducerCount)
      reasons.push("本次监听器发出的直接攻击或延迟任务数与实际分支不符。");
  }

  if (rule.kind === "baizhu-c2" && owned.length)
    reasons.push("白术 C2 监听器出现未经审阅的事件攻击任务。");
  if ((rule.kind === "direct" || rule.kind === "beidou-chain") && owned.length)
    reasons.push("直接事件监听器出现未纳入本组件的延迟攻击任务。");
  if (rule.kind === "tartaglia-riptide" && call?.queuedAttacks.length)
    reasons.push("死亡断流应由已登记的延迟任务排队攻击，监听器出现直接攻击。");
  if (delayedRule) for (const producer of owned) {
    if (producer.siteId !== delayedRule.producerSite || producer.parentProducerId !== undefined
      || !call || producer.queuedFrame !== call.startedFrame)
      reasons.push(`事件任务 #${producer.id} 的来源或登记帧不符。`);
    const tasks = evidence.taskLifecycle?.tasks.filter(row => row.id === producer.taskId) ?? [];
    const task = tasks.length === 1 ? tasks[0] : undefined;
    const queue = task === undefined ? undefined : evidence.taskLifecycle?.queues.find(row => row.id === task.queueId);
    if (!task || !queue || queue.kind !== "core" || task.queuedFrame !== producer.queuedFrame
      || task.dueClock - task.queuedClock !== delayedRule.producerDelayFrames || task.state !== producer.state
      || task.runFrame !== producer.runFrame || task.completedFrame !== producer.completedFrame)
      reasons.push(`事件任务 #${producer.id} 缺少相同任务编号与 +${delayedRule.producerDelayFrames} 帧原生队列回执。`);
    if (producer.state === "pending") {
      if (producer.runFrame !== undefined || producer.completedFrame !== undefined || producer.queuedAttacks.length)
        reasons.push(`待执行事件任务 #${producer.id} 却已有执行结果。`);
      reasons.push(`事件任务 #${producer.id} 仍待执行。`);
    } else if (producer.runFrame === undefined || producer.completedFrame !== producer.runFrame
      || producer.runFrame !== producer.queuedFrame + delayedRule.producerDelayFrames
      || evidence.observationEndFrame === undefined || producer.completedFrame > evidence.observationEndFrame
      || producer.queuedAttacks.length !== delayedRule.producerAttackCount)
      reasons.push(`事件任务 #${producer.id} 的执行帧或后续攻击数不符。`);
  }
  if (owned.length && !evidence.taskLifecycle) reasons.push("缺少事件任务原生生命周期记录。");

  if (rule.kind === "chiori-c4-tree" && call) {
    const tree = analyzeSourceHostEventTaskTree({ call, producers: owned,
      taskLifecycle: evidence.taskLifecycle, observationEndFrame: evidence.observationEndFrame });
    reasons.push(...tree.reasons);
  }
  let callbackAttacks: SourceHostEventQueuedAttack[] = [];
  if (rule.kind === "beidou-chain" && call) {
    const callbackEvidence = { listenerCall: call, attackObservations: observations,
      attackDispatchCompletions: dispatches, hitCallbackBatches: evidence.hitCallbackBatches,
      hitCallbacks: evidence.hitCallbacks };
    const callbacks = analyzeSourceHostEventCallbacks(callbackEvidence, call.queuedAttacks, evidence.observationEndFrame);
    callbackAttacks = callbacks.attacks;
    reasons.push(...callbacks.reasons);
  }
  const callbackQueueIds = new Set(callbackAttacks.map(row => row.queueId));
  const attacks = [...(call?.queuedAttacks ?? []), ...owned.flatMap(row => row.queuedAttacks), ...callbackAttacks];
  if (new Set(attacks.map(row => row.queueId)).size !== attacks.length
    || new Set(attacks.map(row => row.attackId)).size !== attacks.length)
    reasons.push("本次事件攻击队列或攻击编号重复。");
  for (const attack of attacks) {
    const expectedSite = delayedRule ? delayedRule.producerEmitSite
      : rule.kind === "chiori-c4-tree" ? rule.treeAttackEmitSite
      : rule.kind === "beidou-chain" && callbackQueueIds.has(attack.queueId) ? rule.callbackEmitSite
      : "directEmitSite" in rule ? rule.directEmitSite : undefined;
    if (attack.emitSiteId !== expectedSite || attack.ability !== expectedAttack.ability
      || !sourceHostAttackTagMatches(attack.attackTagName, expectedAttack.attackTag) || attack.attackId === undefined)
      reasons.push(`事件攻击队列 #${attack.queueId} 缺少已审阅的来源点或攻击身份。`);
    const queued = observations[attack.queueId - 1];
    if (!queued || queued.stage !== "queued" || queued.attackId !== attack.attackId
      || queued.frame !== attack.frame) reasons.push(`事件攻击 #${attack.queueId} 缺少精确的排队观察。`);
    if (!delayedRule && rule.kind !== "chiori-c4-tree" && !callbackQueueIds.has(attack.queueId)) {
      if (!call || attack.frame < call.startedFrame || attack.frame > call.completedFrame)
        reasons.push(`事件攻击 #${attack.queueId} 不在监听器执行区间。`);
    } else if (delayedRule) {
      const parents = owned.filter(row => row.queuedAttacks.some(child => child.queueId === attack.queueId));
      if (parents.length !== 1 || parents[0]!.runFrame === undefined
        || attack.frame < parents[0]!.runFrame! || parents[0]!.completedFrame === undefined
        || attack.frame > parents[0]!.completedFrame!)
        reasons.push(`事件攻击 #${attack.queueId} 不在唯一延迟任务执行区间。`);
    }
    if (pending.some(row => row.attackId === attack.attackId))
      reasons.push(`事件攻击 #${attack.queueId} 到观察终点仍有待执行阶段。`);
    const completions = dispatches.filter(row => row.attackId === attack.attackId);
    const dispatched = observations.filter(row => row.attackId === attack.attackId && row.stage === "dispatched");
    if (completions.length !== 1 || dispatched.length !== 1) {
      reasons.push(`事件攻击 #${attack.queueId} 尚无唯一派发完成回执。`);
      continue;
    }
    const completion = completions[0]!, dispatch = dispatched[0]!;
    if (completion.dispatchId !== dispatch.dispatchId || completion.frame !== dispatch.frame
      || completion.frame < attack.frame || evidence.observationEndFrame === undefined
      || completion.frame > evidence.observationEndFrame
      || JSON.stringify(completion.origin) !== JSON.stringify(queued?.origin))
      reasons.push(`事件攻击 #${attack.queueId} 的派发编号、帧或原始来源不一致。`);
    const keys = [...completion.enemyTargetKeys, ...completion.skippedEnemyKeys];
    if (new Set(keys).size !== keys.length || completion.skipsEnemies && keys.length > 0)
      reasons.push(`事件攻击 #${attack.queueId} 的派发目标名单冲突。`);
    const attackApps = evidence.applications.filter(row => row.attackId === attack.attackId);
    if (attackApps.some(row => row.dispatchId !== completion.dispatchId
      || !completion.enemyTargetKeys.includes(row.targetKey)))
      reasons.push(`事件攻击 #${attack.queueId} 混入其他派发目标的应用。`);
    for (const targetKey of completion.enemyTargetKeys) {
      const terminal = observations.filter(row => row.attackId === attack.attackId
        && row.dispatchId === completion.dispatchId && row.targetKey === targetKey
        && (row.stage === "resolved" || row.stage === "missed"));
      const applied = attackApps.filter(row => row.dispatchId === completion.dispatchId && row.targetKey === targetKey);
      if (terminal.length !== 1 || terminal[0]!.frame !== completion.frame
        || terminal[0]!.stage === "resolved" && (applied.length !== 1 || applied[0]!.frame < completion.frame
          || evidence.observationEndFrame === undefined || applied[0]!.frame > evidence.observationEndFrame)
        || terminal[0]!.stage === "missed" && applied.length !== 0)
        reasons.push(`事件攻击 #${attack.queueId} 的目标 ${targetKey} 缺少唯一应用或明确落空回执。`);
    }
  }
  if (evidence.applications.some(row => !attacks.some(attack => attack.attackId === row.attackId)))
    reasons.push("事件组件混入未由本监听器或任务发出的应用。");
  const capturedIds = document.hits.map(row => row.calculation.originalCapture.application.id);
  if (new Set(capturedIds).size !== capturedIds.length
    || capturedIds.length !== evidence.applications.length
    || evidence.applications.some(row => !capturedIds.includes(row.id)))
    reasons.push("可编辑命中清单与本次事件的实际应用回执不一致。");
  const analysis: SourceHostEventCollectionAnalysis = {
    deliveryClosed: reasons.length === 0,
    label: reasons.length === 0 ? "本次事件攻击已结算" : "本次事件攻击尚未结算完毕",
    reasons, scopeNotes: [...rule.scopeNotes], attackCount: attacks.length,
    producerCount: owned.length, completedProducerCount: owned.filter(row => row.state === "completed").length,
    pendingProducerCount: owned.filter(row => row.state === "pending").length,
  };
  return { analysis, attacks };
}

function blockedTrace(id: string, reason: string): CalculationTraceNode {
  return { id, ruleId: "source-event-unresolved", titleKey: "尚未取得可计算伤害", status: "blocked",
    expression: expr.value(0), inputs: [], childIds: [], sourceRefs: [], warnings: [],
    symbolicFormula: "未计算", substitution: "没有对应的已结算伤害数值", explanationKey: reason,
    applicabilityReason: reason };
}

/** Recalculate saved actual hits through the shared numeric core; no native rerun or cast claim. */
export function calculateSourceHostEventCollection(raw: unknown): {
  document: SourceHostEventCollection;
  rows: SourceHostEventCollectionRow[];
  total: number;
  knownSubtotal?: number;
  trace: CalculationTraceNode[];
  analysis: SourceHostEventCollectionAnalysis;
} {
  const document = sourceHostEventCollectionSchema.parse(raw);
  const { analysis, attacks } = analyzeEventDelivery(document);
  const source = document.sourceContext.sourceCommit;
  const expectedIdentity = JSON.stringify(document.sourceContext);
  const capturedIds = new Set<number>();
  const rows: SourceHostEventCollectionRow[] = document.hits.map(hit => {
    const capture = hit.calculation.originalCapture;
    const application = capture.application;
    if (capturedIds.has(application.id)) throw new Error(`事件应用 #${application.id} 重复。`);
    capturedIds.add(application.id);
    const identity = sourceContextSchema.strip().parse(capture);
    if (JSON.stringify(identity) !== expectedIdentity)
      throw new Error(`事件应用 #${application.id} 混入不同来源、脚本或初始状态。`);
    const original = document.nativeEvidence.applications.find(row => row.id === application.id);
    if (!original || JSON.stringify(original) !== JSON.stringify(application)
      || !attacks.some(attack => attack.attackId === application.attackId))
      throw new Error(`事件应用 #${application.id} 没有本监听器的原生攻击身份。`);
    const result = calculateSourceHostEditableCalculation(hit.calculation);
    return {
      applicationId: application.id, attackId: application.attackId,
      ...(application.dispatchId === undefined ? {} : { dispatchId: application.dispatchId }),
      targetKey: application.targetKey,
      status: hit.included ? "calculated" as const : "excluded" as const,
      value: hit.included ? result.applicationValue ?? result.value : 0,
      reason: hit.included
        ? "本次事件已记录的实际目标应用，使用可编辑单击共享公式计算。"
        : "此实际命中由用户排除于所选小计；原生应用仍保留在完整性核对中。",
      trace: result.trace,
    };
  });
  const evidence = document.nativeEvidence;
  for (const attack of attacks) {
    const completion = evidence.attackDispatchCompletions?.find(row => row.attackId === attack.attackId);
    if (!completion) {
      const reason = `事件攻击 #${attack.attackId ?? attack.queueId} 尚未取得派发与目标终态。`;
      rows.push({ ...(attack.attackId === undefined ? {} : { attackId: attack.attackId }), status: "pending", reason,
        trace: [blockedTrace(`event-attack-${attack.queueId}`, reason)] });
      continue;
    }
    for (const targetKey of completion.enemyTargetKeys) {
      const terminal = evidence.attackObservations?.find(row => row.attackId === attack.attackId
        && row.dispatchId === completion.dispatchId && row.targetKey === targetKey
        && (row.stage === "resolved" || row.stage === "missed"));
      if (terminal?.stage === "missed") {
        const reason = "原生目标接触检查明确落空；这次攻击机会对小计贡献为零。";
        const trace = new TraceBuilder([`gcsim:${source}`]);
        trace.add(`event.miss.${attack.queueId}.${targetKey}`, "明确落空", expr.value(0), [],
          { unit: "damage", status: "not-applicable", explanationKey: reason });
        rows.push({ ...(attack.attackId === undefined ? {} : { attackId: attack.attackId }), dispatchId: completion.dispatchId, targetKey,
          status: "missed", value: 0, reason, trace: trace.nodes });
      } else if (!rows.some(row => row.attackId === attack.attackId
        && row.dispatchId === completion.dispatchId && row.targetKey === targetKey)) {
        const reason = "已记录目标处理，但缺少同一攻击、派发与目标的唯一伤害应用；不能解释为零伤害。";
        rows.push({ ...(attack.attackId === undefined ? {} : { attackId: attack.attackId }), dispatchId: completion.dispatchId, targetKey,
          status: "unresolved", reason,
          trace: [blockedTrace(`event-target-${attack.queueId}-${targetKey}`, reason)] });
      }
    }
  }
  for (const producer of evidence.eventProducers?.filter(row => row.listenerCallId === document.selection.listenerCallId) ?? []) {
    if (producer.state !== "pending") continue;
    const reason = `事件延迟任务 #${producer.id} 已登记但尚未执行；后续攻击不能视为零。`;
    rows.push({ status: "pending", reason, trace: [blockedTrace(`event-producer-${producer.id}`, reason)] });
  }
  const selected = rows.filter(row => row.status === "calculated");
  const builder = new TraceBuilder([`gcsim:${source}`, ...getSourceHostEventComponentRule(document.componentId).sourceRefs]);
  const inputs = selected.map(row => traceInput(`application${row.applicationId}`, row.value!, "damage",
    { kind: "source-host-editable-calculation", reference: String(row.applicationId) },
    `事件组件实际应用 #${row.applicationId} 的共享核心结果`));
  const total = builder.add("sourceEventSelectedDamage", "所选事件命中的公式伤害小计",
    expr.add(...inputs.map(input => expr.input(input.key))), inputs,
    { unit: "damage", explanationKey: analysis.deliveryClosed
      ? "本次已审阅监听器发出的攻击均已逐目标结算；数值只汇总用户纳入的实际命中。"
      : "仅汇总已观察且纳入的实际命中；未执行任务和未结算目标不作为零伤害。" });
  const hasKnownValue = selected.length > 0 || rows.some(row => row.status === "missed") || analysis.deliveryClosed;
  return { document, rows, total, ...(hasKnownValue ? { knownSubtotal: total } : {}),
    trace: hasKnownValue ? builder.nodes : [blockedTrace("source-event-unsettled",
      "本次事件尚无已结算命中或明确落空；不能把待执行攻击解释为零伤害。")],
    analysis };
}
