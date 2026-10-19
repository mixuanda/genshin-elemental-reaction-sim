import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { sourceActionReceipts, sourceHostAttackObservationSchema, sourceHostStatusInstanceSchema, sourceHostPendingAttackStageSchema } from "./source-host-action-origin";
import { sourceHostTaskLifecycleSchema, selectSourceHostTaskLifecycle, sourceHostTaskAssociationSequence, summarizeSourceHostTaskLifecycle } from "./source-host-task-lifecycle";
import { sourceHostResultSchema, type SourceHostResult } from "./source-host-wire";
import {
  analyzeSourceHostFiniteSkillCollection, getSourceHostFiniteCastContract, sourceHostFiniteCastPlan,
  sourceHostFiniteCastEvidenceSchema, sourceHostFiniteSkillOwnsApplication,
} from "./source-host-finite-cast";
import { getSourceHostHitCallbackRule, reachableSourceHostHitCallbackRoots } from "./source-host-hit-callback-analysis";
import { reachableSourceHostBeidouOwnedCallbackRoots } from "./source-host-beidou-owned-analysis";
import { sourceHostOwnedShieldRoots } from "./source-host-owned-shield-analysis";
import type { SourceHostFiniteRoot } from "./source-host-producer-analysis";
import {
  captureSourceHostHit, createSourceHostEditableCalculation, calculateSourceHostEditableCalculation,
  sourceHostEditableCalculationSchema, sourceHostHitCaptureSchema,
} from "./source-host-capture";

export function summarizeSourceHostActionOrigins(result: SourceHostResult) {
  const groups = sourceActionReceipts(result.logs).map(action => ({ action,
    creationApplicationIds: [] as number[], triggerApplicationIds: [] as number[], statusOwnerApplicationIds: [] as number[],
    creationDamage: 0, triggerDamage: 0, statusOwnerDamage: 0 }));
  const bySequence = new Map(groups.map(group => [group.action.sequence, group]));
  const unassignedApplicationIds: number[] = [];
  let hasOrigin = false;
  for (const application of result.applications) {
    // The application carries the actual AttackEvent creation. A formula call
    // can run under a different nested callback context, so never substitute it.
    const origin = application.origin;
    hasOrigin ||= origin !== undefined;
    const creation = origin?.creationActionSequence === undefined ? undefined : bySequence.get(origin.creationActionSequence);
    const trigger = origin?.triggerActionSequence === undefined ? undefined : bySequence.get(origin.triggerActionSequence);
    const statusOwner = origin?.statusOwner?.creationActionSequence === undefined ? undefined : bySequence.get(origin.statusOwner.creationActionSequence);
    if (creation?.action.acceptedFrame !== undefined) {
      creation.creationApplicationIds.push(application.id);
      creation.creationDamage += application.appliedDamage;
    } else unassignedApplicationIds.push(application.id);
    if (trigger?.action.acceptedFrame !== undefined) {
      trigger.triggerApplicationIds.push(application.id);
      trigger.triggerDamage += application.appliedDamage;
    }
    if (statusOwner?.action.acceptedFrame !== undefined) {
      statusOwner.statusOwnerApplicationIds.push(application.id);
      statusOwner.statusOwnerDamage += application.appliedDamage;
    }
  }
  hasOrigin ||= result.attackObservations?.some(row => row.origin !== undefined) === true
    || result.pendingAttackStages?.some(row => row.origin !== undefined) === true
    || (result.taskLifecycle?.tasks.length ?? 0) > 0
    || result.statusInstances?.some(row => row.creationActionSequence !== undefined) === true;
  return { groups, unassignedApplicationIds, legacy: !hasOrigin };
}

const sourceContextSchema = sourceHostHitCaptureSchema.pick({
  sourceCommit: true, sourceConfig: true, seed: true, executionArtifact: true,
  randomness: true, initialEnergy: true, startupState: true,
  targetScene: true, observationWindow: true, targetPhases: true,
});
type ObservedAssociation = "creation" | "trigger" | "status-owner";
export const sourceHostActionCollectionSchema = z.object({
  schemaVersion: z.literal("source-host-action-collection-v1"),
  scope: z.enum(["observed-action-hits", "finite-skill-cast"]),
  association: z.enum(["creation", "trigger", "status-owner", "skill-ownership"]),
  finiteCastEvidence: sourceHostFiniteCastEvidenceSchema.optional(),
  sourceContext: sourceContextSchema.optional(),
  observationEndFrame: z.number().finite().optional(),
  lifecycleObservationFrame: z.number().int().optional(),
  statusInstances: z.array(sourceHostStatusInstanceSchema).optional(),
  pendingAttackStages: z.array(sourceHostPendingAttackStageSchema).optional(),
  attackObservations: z.array(sourceHostAttackObservationSchema).optional(),
  taskLifecycle: sourceHostTaskLifecycleSchema.optional(),
  action: z.object({ sequence: z.number().int().positive(), characterKey: z.string(), action: z.string(),
    queuedFrame: z.number().finite(), acceptedFrame: z.number().finite(),
    inputWindowFrame: z.number().finite().optional(), noOp: z.boolean().optional() }).strict(),
  hits: z.array(z.object({ included: z.boolean(), calculation: sourceHostEditableCalculationSchema }).strict()),
  exclusions: z.object({ otherAppliedHits: z.number().int().nonnegative(), unassignedAppliedHits: z.number().int().nonnegative() }).strict(),
}).strict().superRefine((document, context) => {
  if ((document.scope === "finite-skill-cast") !== (document.finiteCastEvidence !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "有限技能集合必须且只能保存原生有限技能证据。", path: ["finiteCastEvidence"] });
  }
  if (document.scope === "finite-skill-cast" && document.association !== "creation" && document.association !== "skill-ownership") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "有限技能集合只能使用已审阅的技能归属或攻击创建关联。", path: ["association"] });
  }
  if (document.scope === "observed-action-hits" && document.association === "skill-ownership") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "普通动作观察不能声称有限技能归属。", path: ["association"] });
  }
});
export type SourceHostActionCollection = z.infer<typeof sourceHostActionCollectionSchema>;

export function sourceHostActionHasEvidence(result: SourceHostResult, sequence: number, association: ObservedAssociation): boolean {
  if (!sourceActionReceipts(result.logs).some(action => action.sequence === sequence && action.acceptedFrame !== undefined)) return false;
  return result.applications.some(row => associationSequence(row.origin, association) === sequence)
    || result.attackObservations?.some(row => associationSequence(row.origin, association) === sequence) === true
    || result.pendingAttackStages?.some(row => associationSequence(row.origin, association) === sequence) === true
    || result.taskLifecycle?.tasks.some(row => sourceHostTaskAssociationSequence(row.origin, association) === sequence) === true
    || association !== "trigger" && result.statusInstances?.some(row => row.creationActionSequence === sequence) === true;
}

/** Only recorded associations are selected. No frame, ability-name or actor inference. */
export function captureSourceHostActionCollection(raw: unknown, sequence: number, association: ObservedAssociation): SourceHostActionCollection {
  return captureSourceHostActionCollectionInternal(raw, sequence, association, true);
}

function captureSourceHostActionCollectionInternal(raw: unknown, sequence: number, association: ObservedAssociation, requireEvidence: boolean, captureHits = true): SourceHostActionCollection {
  const result = sourceHostResultSchema.parse(raw);
  const summary = summarizeSourceHostActionOrigins(result);
  const group = summary.groups.find(row => row.action.sequence === sequence);
  if (!group || group.action.acceptedFrame === undefined) throw new Error("该动作没有实际接受回执。");
  const ids = association === "creation" ? group.creationApplicationIds : association === "trigger" ? group.triggerApplicationIds : group.statusOwnerApplicationIds;
  if (requireEvidence && !sourceHostActionHasEvidence(result, sequence, association)) throw new Error("该动作没有记录到此类关联的实际观察；不能推断零伤害或完整技能。");
  const duration = (result.result as { duration?: unknown }).duration;
  const pending = result.pendingAttackStages?.filter(row => associationSequence(row.origin, association) === sequence);
  const taskLifecycle = result.taskLifecycle === undefined ? undefined
    : selectSourceHostTaskLifecycle(result.taskLifecycle, sequence, association);
  const selectedIds = new Set(ids);
  const ownerInstances = new Set([
    ...result.applications.filter(row => selectedIds.has(row.id)).map(row => row.origin?.statusOwner?.instanceId),
    ...(pending ?? []).map(row => row.origin.statusOwner?.instanceId),
    ...(taskLifecycle?.tasks ?? []).map(row => row.origin.statusOwner?.instanceId),
  ].filter((id): id is number => id !== undefined));
  const statuses = result.statusInstances?.filter(row => ownerInstances.has(row.instanceId)
    || association !== "trigger" && row.creationActionSequence === sequence);
  return sourceHostActionCollectionSchema.parse({ schemaVersion: "source-host-action-collection-v1", scope: "observed-action-hits",
    association, action: group.action,
    sourceContext: sourceContextSchema.parse({ sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
      executionArtifact: result.executionArtifact, randomness: result.randomness, initialEnergy: result.initialEnergy, startupState: result.startupState,
      targetScene: result.targetScene, observationWindow: result.observationWindow, targetPhases: result.targetPhases }),
    ...(typeof duration === "number" ? { observationEndFrame: duration } : {}),
    ...(result.lifecycleObservationFrame === undefined ? {} : { lifecycleObservationFrame: result.lifecycleObservationFrame }),
    ...(statuses === undefined ? {} : { statusInstances: statuses }),
    ...(pending === undefined ? {} : { pendingAttackStages: pending }),
    ...(result.attackObservations ? { attackObservations: result.attackObservations.filter(row => associationSequence(row.origin, association) === sequence) } : {}),
    ...(taskLifecycle === undefined ? {} : { taskLifecycle }),
    hits: captureHits ? ids.map(id => ({ included: true, calculation: createSourceHostEditableCalculation(captureSourceHostHit(result, id)) })) : [],
    exclusions: { otherAppliedHits: result.applications.length - ids.length, unassignedAppliedHits: summary.unassignedApplicationIds.length },
  });
}

/** Capture only audited intrinsic root attacks. Eligibility is source/action/parameter based;
 * the saved native receipts, not this function, determine whether the cast is closed. */
export function captureSourceHostFiniteSkillCollection(raw: unknown, sequence: number): SourceHostActionCollection | undefined {
  const result = sourceHostResultSchema.parse(raw);
  const summary = summarizeSourceHostActionOrigins(result);
  const group = summary.groups.find(row => row.action.sequence === sequence && row.action.acceptedFrame !== undefined);
  if (!group || group.action.noOp || group.action.acceptedFrame === undefined) return undefined;
  const invocationMatches = (result.abilityInvocations ?? []).filter(row => row.actionSequence === sequence
    && row.characterKey === group.action.characterKey && row.action === group.action.action
    && row.startedFrame === group.action.acceptedFrame);
  if (invocationMatches.length !== 1) return undefined;
  const invocation = invocationMatches[0]!;
  const contract = getSourceHostFiniteCastContract(result.sourceCommit, group.action.characterKey, group.action.action);
  const plan = contract === undefined ? undefined : sourceHostFiniteCastPlan(contract, invocation);
  const callbackRule = contract === undefined ? undefined : getSourceHostHitCallbackRule(contract.id, invocation);
  const shieldEvidenceApplies = contract?.id !== "xinyan-burst" || invocation.constellation >= 2;
  if (!contract || !plan || plan.requiresProducers && result.abilityProducers === undefined
    || contract.ownedGeneratorContract && (result.ownedGenerators === undefined
      || result.ownedGeneratorTriggers === undefined || result.statusInstances === undefined)
    || contract.ownedEntityContract && (result.ownedEntities === undefined
      || result.ownedEntityTriggers === undefined || result.ownedEntityProducers === undefined)
    || contract.ownedShieldContract && shieldEvidenceApplies && (result.shieldInstances === undefined || result.shieldHooks === undefined)
    || contract.shieldProducerContract && shieldEvidenceApplies && (result.shieldProducers === undefined || result.taskLifecycle === undefined)
    || callbackRule?.kind === "enemy-task" && result.taskLifecycle === undefined
    || callbackRule !== undefined && (result.hitCallbackBatches === undefined || result.hitCallbacks === undefined)) return undefined;

  const base = captureSourceHostActionCollectionInternal(result, sequence, "creation", false, false);
  const producers = (result.abilityProducers ?? []).filter(row => row.invocationId === invocation.id);
  const ownedGenerators = (result.ownedGenerators ?? []).filter(row => row.invocationId === invocation.id);
  const ownedGeneratorIds = new Set(ownedGenerators.map(row => row.id));
  const ownedStatusIds = new Set(ownedGenerators.map(row => row.statusInstanceId));
  const ownedTriggers = (result.ownedGeneratorTriggers ?? []).filter(row => ownedGeneratorIds.has(row.generatorId));
  const ownedEntities = (result.ownedEntities ?? []).filter(row => row.invocationId === invocation.id);
  const ownedEntityIds = new Set(ownedEntities.map(row => row.id));
  const ownedEntityTriggers = (result.ownedEntityTriggers ?? []).filter(row => ownedEntityIds.has(row.entityId));
  const ownedEntityProducers = (result.ownedEntityProducers ?? []).filter(row => ownedEntityIds.has(row.entityId));
  const initialRoots: SourceHostFiniteRoot[] = [
    ...invocation.queuedAttacks.map(attack => ({ attack, startedFrame: invocation.startedFrame, completedFrame: invocation.returnedFrame })),
    ...producers.flatMap(producer => producer.queuedAttacks.map(attack => ({ attack, producer,
      startedFrame: producer.startedFrame, completedFrame: producer.completedFrame }))),
    ...ownedTriggers.flatMap(ownedTrigger => ownedTrigger.queuedAttacks.map(attack => ({ attack, ownedTrigger,
      statusInstanceId: ownedGenerators.find(row => row.id === ownedTrigger.generatorId)!.statusInstanceId,
      startedFrame: ownedTrigger.startedFrame, completedFrame: ownedTrigger.completedFrame }))),
    ...ownedEntityTriggers.flatMap(entityTrigger => entityTrigger.queuedAttacks.map(attack => ({ attack,
      entityId: entityTrigger.entityId, entityTrigger,
      startedFrame: entityTrigger.startedFrame, completedFrame: entityTrigger.completedFrame }))),
    ...ownedEntityProducers.flatMap(entityProducer => entityProducer.queuedAttacks.map(attack => ({ attack,
      entityId: entityProducer.entityId, entityProducer,
      startedFrame: entityProducer.startedFrame, completedFrame: entityProducer.completedFrame }))),
    ...sourceHostOwnedShieldRoots(contract.id, { invocation, shieldInstances: result.shieldInstances,
      shieldHooks: result.shieldHooks, shieldProducers: result.shieldProducers }),
  ];
  const callbackRoots = callbackRule === undefined ? [] : reachableSourceHostHitCallbackRoots(contract.id, {
    invocation, dispatchCompletions: result.attackDispatchCompletions ?? [],
    observations: (result.attackObservations ?? []).map((row, sourceIndex) => ({ sourceIndex, row })),
    invocations: result.abilityInvocations, producers: result.abilityProducers,
    hitCallbackBatches: result.hitCallbackBatches, hitCallbacks: result.hitCallbacks,
  }, initialRoots);
  const ownedEventEvidence = { invocation, ownedGenerators: result.ownedGenerators,
    ownedGeneratorTriggers: result.ownedGeneratorTriggers, statusInstances: result.statusInstances,
    producers: result.abilityProducers, dispatchCompletions: result.attackDispatchCompletions ?? [],
    observations: (result.attackObservations ?? []).map((row, sourceIndex) => ({ sourceIndex, row })),
    hitCallbackBatches: result.hitCallbackBatches, hitCallbacks: result.hitCallbacks,
    eventRegistrations: result.eventRegistrations, eventEmissions: result.eventEmissions,
    eventListenerCalls: result.eventListenerCalls, eventProducers: result.eventProducers };
  const ownedCallbackRoots = reachableSourceHostBeidouOwnedCallbackRoots(ownedEventEvidence);
  const rootAttacks = [...initialRoots, ...callbackRoots, ...ownedCallbackRoots].map(row => row.attack);
  const rootQueueIds = new Set(rootAttacks.map(row => row.queueId));
  const rootAttackIds = new Set(rootAttacks.flatMap(row => row.attackId === undefined ? [] : [row.attackId]));
  const rootApplicationIds = new Set(result.applications.filter(row => rootAttackIds.has(row.attackId)).map(row => row.id));
  const hits = [...rootApplicationIds].map(id => ({ included: true, calculation: createSourceHostEditableCalculation(captureSourceHostHit(result, id)) }));
  const excludedApplicationIds = result.applications.filter(row => !rootApplicationIds.has(row.id)).map(row => row.id);
  const allObservations = (result.attackObservations ?? []).map((row, sourceIndex) => ({ sourceIndex, row }));
  const observations = allObservations.flatMap(entry => entry.row.attackId !== undefined && rootAttackIds.has(entry.row.attackId)
    || entry.row.stage === "queued" && rootQueueIds.has(entry.sourceIndex + 1)
    ? [entry] : []);
  const dispatchCompletions = plan.requiresProducers || contract.ownedGeneratorContract || contract.ownedEntityContract || contract.ownedShieldContract || callbackRule !== undefined
    ? (result.attackDispatchCompletions ?? [])
    : (result.attackDispatchCompletions ?? []).filter(row => row.origin.creationActionSequence === sequence);
  const finiteCastEvidence = sourceHostFiniteCastEvidenceSchema.parse({ invocation, dispatchCompletions,
    ...(!["beidou-burst", "raiden-skill", "layla-skill", "layla-burst", "albedo-skill"].includes(contract.id) ? {} : {
      eventRegistrations: result.eventRegistrations, eventEmissions: result.eventEmissions,
      eventListenerCalls: result.eventListenerCalls, eventProducers: result.eventProducers,
    }),
    ...(result.abilityProducers === undefined ? {} : { producers: result.abilityProducers }),
    ...(result.abilityInvocations === undefined ? {} : { invocations: result.abilityInvocations }),
    ...(result.ownedGenerators === undefined ? {} : { ownedGenerators: result.ownedGenerators }),
    ...(result.ownedGeneratorTriggers === undefined ? {} : { ownedGeneratorTriggers: result.ownedGeneratorTriggers }),
    ...(result.ownedEntities === undefined ? {} : { ownedEntities: result.ownedEntities }),
    ...(result.ownedEntityTriggers === undefined ? {} : { ownedEntityTriggers: result.ownedEntityTriggers }),
    ...(result.ownedEntityProducers === undefined ? {} : { ownedEntityProducers: result.ownedEntityProducers }),
    ...(result.shieldInstances === undefined ? {} : { shieldInstances: result.shieldInstances }),
    ...(result.shieldHooks === undefined ? {} : { shieldHooks: result.shieldHooks }),
    ...(result.shieldProducers === undefined ? {} : { shieldProducers: result.shieldProducers }),
    ...(result.taskLifecycle === undefined || !(contract.ownedShieldContract || contract.ownedEntityContract || callbackRule?.kind === "enemy-task" || callbackRule?.kind === "shield-contribution") ? {} : { taskLifecycle: result.taskLifecycle }),
    ...(result.hitCallbackBatches === undefined ? {} : { hitCallbackBatches: result.hitCallbackBatches }),
    ...(result.hitCallbacks === undefined ? {} : { hitCallbacks: result.hitCallbacks }),
    ...(result.statusInstances === undefined ? {} : { statusInstances: result.statusInstances }),
    observations: callbackRule === undefined && contract.id !== "beidou-burst" && contract.id !== "raiden-skill" ? observations : allObservations,
    excluded: excludedApplicationIds.length === 0 ? [] : [{ id: "other-applications", reason: "未被本技能固定源码规则识别为直接固有根攻击的其他伤害应用。", applicationIds: excludedApplicationIds }] });
  const relevantPending = result.pendingAttackStages?.filter(row => row.attackId !== undefined && rootAttackIds.has(row.attackId)
    || row.origin.statusOwner?.instanceId !== undefined && ownedStatusIds.has(row.origin.statusOwner.instanceId));
  return sourceHostActionCollectionSchema.parse({ ...base, scope: "finite-skill-cast",
    association: contract.ownedGeneratorContract || contract.ownedEntityContract || contract.ownedShieldContract || callbackRule !== undefined
      ? "skill-ownership" : "creation", finiteCastEvidence,
    hits, attackObservations: observations.map(entry => entry.row),
    ...(relevantPending === undefined ? {} : { pendingAttackStages: relevantPending }),
    ...(result.statusInstances === undefined ? {} : { statusInstances: result.statusInstances }),
    exclusions: { otherAppliedHits: excludedApplicationIds.length, unassignedAppliedHits: summary.unassignedApplicationIds.length } });
}

export function calculateSourceHostActionCollection(raw: unknown) {
  const document = sourceHostActionCollectionSchema.parse(raw);
  const first = document.sourceContext ?? document.hits[0]?.calculation.originalCapture;
  if (!first) throw new Error("没有已结算命中的动作观察集合必须保存原运行来源上下文。");
  const identity = (capture: z.infer<typeof sourceContextSchema>) => JSON.stringify([capture.sourceCommit, capture.sourceConfig, capture.seed,
    capture.executionArtifact, capture.randomness, capture.initialEnergy, capture.startupState,
    capture.targetScene, capture.observationWindow, capture.targetPhases]);
  const expectedIdentity = identity(first), seen = new Set<number>();
  const rows = document.hits.map(hit => {
    const capture = hit.calculation.originalCapture, id = capture.application.id;
    if (seen.has(id)) throw new Error(`实际命中 #${id} 重复，不能重复计数。`);
    seen.add(id);
    if (identity(capture) !== expectedIdentity) throw new Error("动作命中集合混入不同来源、脚本、种子或初始状态的记录。");
    if (document.scope === "finite-skill-cast"
      ? !sourceHostFiniteSkillOwnsApplication(document.finiteCastEvidence!, capture.application)
      : associationSequence(capture.application.origin, observedAssociation(document.association)) !== document.action.sequence)
      throw new Error(`实际命中 #${id} 没有所选动作的原生关联，不能按名称或相邻帧补齐。`);
    const result = calculateSourceHostEditableCalculation(hit.calculation);
    return { applicationId: id, included: hit.included, value: result.applicationValue ?? result.value,
      rawFormulaValue: result.value,
      originalRawDamage: capture.application.rawDamage, originalAppliedDamage: capture.application.appliedDamage, trace: result.trace };
  });
  const selected = rows.filter(row => row.included);
  const builder = new TraceBuilder([`gcsim:${first.sourceCommit}`, "source-host-creation-trigger-lineage-v1"]);
  const inputs = selected.map(row => traceInput(`hit${row.applicationId}`, row.value, "damage",
    { kind: "source-host-editable-calculation", reference: String(row.applicationId) }, `所选实际命中 #${row.applicationId} 的共享核心公式伤害`));
  const opportunities = projectSourceHostActionOpportunities(document, rows, first.sourceCommit);
  const taskSummary = summarizeSourceHostTaskLifecycle(document.taskLifecycle, document.action.sequence,
    observedAssociation(document.association));
  const finiteCast = document.scope === "finite-skill-cast" ? analyzeSourceHostFiniteSkillCollection(document) : undefined;
  const completeCast = document.scope === "finite-skill-cast" && finiteCast?.closed === true && rows.every(row => row.included);
  const zeroAttackCast = completeCast && finiteCast?.expectedRootAttackCount === 0;
  const hasSettledEvidence = rows.length > 0 || opportunities.some(row => row.status === "missed") || finiteCast?.closed === true;
  if (zeroAttackCast) {
    builder.add("sourceActionRootCount", "当前技能分支的固有攻击数", expr.input("registeredRoots"), [
      traceInput("registeredRoots", finiteCast.observedRootAttackCount, "count",
        { kind: "source-native-ability-invocation", reference: String(document.finiteCastEvidence!.invocation.id) },
        "本次调用及已审阅后续生成路径实际登记的固有攻击数"),
    ], { unit: "count", sourceRefs: finiteCast.contract?.sourceRefs ?? [],
      explanationKey: "固定来源分支要求零次固有攻击，实际登记数也为零，且不存在未闭合的伤害生成路径。状态变化本身不折算为伤害。" });
  }
  const total = builder.add("sourceActionSelectedDamage", "所选关联命中的公式伤害小计", expr.add(...inputs.map(input => expr.input(input.key))), inputs,
    { unit: "damage", explanationKey: zeroAttackCast
      ? "本次已闭合分支没有固有攻击，伤害项为空，其和为 0。这个零来自实际分支与完整记录，不是将缺失或待结算命中按零处理。"
      : completeCast
      ? "固定源码范围内的固有攻击均已逐目标结算；仅汇总所选命中，不包含另行派发的反应、装备追击、治疗、护盾或后续动作。"
      : "逐击共享核心结果求和。每击保留原快照、反应及暴击上下文；编辑后不重新执行目标生命或后续轮转。未闭合的观察不能解释为完整施放。" });
  return { document, rows, total, knownSubtotal: hasSettledEvidence ? total : undefined, taskSummary,
    ...(finiteCast === undefined ? {} : { finiteCast }),
    opportunities, unresolvedCount: opportunities.filter(row => row.status === "unresolved").length,
    pendingCount: opportunities.filter(row => row.status === "pending").length,
    observationRecorded: document.attackObservations !== undefined, pendingRecorded: document.pendingAttackStages !== undefined,
    completeCast, zeroAttackCast,
    originalRawTotal: selected.reduce((sum, row) => sum + row.originalRawDamage, 0),
    originalAppliedTotal: selected.reduce((sum, row) => sum + row.originalAppliedDamage, 0),
    trace: hasSettledEvidence ? builder.nodes : [unresolvedTrace("sourceActionUnsettled", "尚无已结算伤害或明确落空记录；不能把未结算解释为零伤害。")],
    warnings: [
      ...(document.scope === "finite-skill-cast" ? [] : ["创建来源、触发来源与明确状态激活来源可以重叠，不能相加作为技能归属。"]),
      ...(completeCast ? ["完整范围仅指已审阅的固有攻击及其当前目标结算；独立反应、装备追击、治疗、护盾和后续动作仍在范围外。"]
        : document.scope === "finite-skill-cast" ? (finiteCast?.reasons ?? ["有限技能证据尚未闭合。"])
          : ["未关联实体、未记录的攻击机会与观察窗后的待结算事件尚未闭合；本集合是已观察命中小计，不是完整施放。"]),
      ...(taskSummary.associatedTaskIds.length > 0 ? ["任务回执仅说明排队或执行过的原生回调；即使相关队列当前为空，也不能据此断言完整技能已结束。"] : []),
      "逐击编辑保留原始条件；上游装备公式实验仍独立，不自动改变其他命中或模拟状态。"],
  };
}

export interface SourceHostActionOpportunity {
  id: string; stage: string; frame: number;
  attackId?: number; dispatchId?: number; targetKey?: number; pendingStageId?: number; dueFrame?: number;
  status: "calculated" | "excluded" | "missed" | "pending" | "unresolved" | "observed";
  applicationIds: number[]; value?: number; reason: string; trace: CalculationTraceNode[];
}

function unresolvedTrace(id: string, reason: string): CalculationTraceNode {
  return { id, ruleId: "source-observation-unresolved", titleKey: "尚未取得可计算伤害", status: "blocked",
    expression: expr.value(0), inputs: [], childIds: [], sourceRefs: [], warnings: [],
    symbolicFormula: "未计算", substitution: "没有对应的已结算伤害数值", explanationKey: reason, applicabilityReason: reason };
}

/** Present actual records without matching on frame, name or a reused AttackID.
 * Only dispatch identity + explicit target/attack identity link terminal rows.
 * Intermediate phase rows are observations, never additional damage terms. */
function projectSourceHostActionOpportunities(
  document: SourceHostActionCollection,
  calculated: Array<{ applicationId: number; included: boolean; value: number }>,
  sourceCommit: string,
): SourceHostActionOpportunity[] {
  const observations = document.attackObservations ?? [];
  const source = `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/pkg/core/combat/attack.go`;
  const output: SourceHostActionOpportunity[] = [];
  const applications = document.hits.map(hit => hit.calculation.originalCapture.application);
  const finiteObservationCounts = new Map<string, number>();
  if (document.scope === "finite-skill-cast") for (const entry of document.finiteCastEvidence!.observations) {
    const key = JSON.stringify(entry.row);
    finiteObservationCounts.set(key, (finiteObservationCounts.get(key) ?? 0) + 1);
  }
  const sameDispatchTarget = (observation: typeof observations[number], application: typeof applications[number]) =>
    observation.dispatchId !== undefined && observation.dispatchId === application.dispatchId
    && observation.targetKey !== undefined && observation.targetKey === application.targetKey
    && observation.attackId !== undefined && observation.attackId === application.attackId;
  for (const row of calculated) {
    const application = applications.find(hit => hit.id === row.applicationId)!;
    const matched = observations.filter(observation => sameDispatchTarget(observation, application));
    if (matched.some(observation => observation.stage === "missed")) throw new Error(`派发与目标身份同时指向落空和实际伤害 #${application.id}，不能把冲突当作完整记录。`);
    const reason = matched.some(observation => observation.stage === "resolved")
      ? "按实际派发、攻击和目标编号关联到原生目标处理回执；只把本次伤害应用计入一次。"
      : "保留实际伤害应用；没有可用的派发与目标终态关联，不按帧或技能名称补配。";
    const trace = new TraceBuilder([source]);
    const value = trace.add(`application.${application.id}.contribution`, "本次实际命中对小计的贡献", expr.mul(expr.input("included"), expr.input("damage")), [
      traceInput("included", Number(row.included), "boolean", "user", "1 表示用户纳入小计；0 表示排除"),
      traceInput("damage", row.value, "damage", { kind: "source-host-editable-calculation", reference: String(application.id) }, "本击完整上下文通过共享计算核心得到的公式伤害"),
    ], { unit: "damage", status: row.included ? "applied" : "not-applicable", explanationKey: reason });
    output.push({ id: `application-${application.id}`, stage: "application", frame: application.frame,
      attackId: application.attackId, targetKey: application.targetKey,
      ...(application.dispatchId === undefined ? {} : { dispatchId: application.dispatchId }),
      status: row.included ? "calculated" : "excluded", applicationIds: [application.id], value, reason, trace: trace.nodes });
  }
  observations.forEach((observation, index) => {
    if (document.scope === "finite-skill-cast") {
      const key = JSON.stringify(observation), count = finiteObservationCounts.get(key) ?? 0;
      if (count === 0) throw new Error("有限技能观察行缺少相同的原生攻击回执。");
      finiteObservationCounts.set(key, count - 1);
    } else if (associationSequence(observation.origin, observedAssociation(document.association)) !== document.action.sequence) {
      throw new Error("动作观察记录没有所选动作的原生关联。");
    }
    if (observation.stage === "resolved" && applications.some(application => sameDispatchTarget(observation, application))) return;
    const id = `observation-${index}`;
    const identity = { ...(observation.attackId === undefined ? {} : { attackId: observation.attackId }),
      ...(observation.dispatchId === undefined ? {} : { dispatchId: observation.dispatchId }),
      ...(observation.targetKey === undefined ? {} : { targetKey: observation.targetKey }) };
    let reason: string, status: SourceHostActionOpportunity["status"], value: number | undefined;
    let trace: CalculationTraceNode[];
    if (observation.stage === "missed") {
      status = "missed"; value = 0;
      reason = `来源目标接触检查明确返回未命中：${observation.reason || "来源未提供原因文本"}。只表示这次已记录检查无伤害，不推断其他攻击机会。`;
      const builder = new TraceBuilder([source]);
      builder.add(`${id}.miss`, "明确落空：本次伤害为零", expr.value(0), [], { unit: "damage", status: "not-applicable", explanationKey: reason });
      trace = builder.nodes;
    } else if (observation.stage === "resolved") {
      status = "unresolved";
      reason = observation.dispatchId === undefined
        ? "历史目标处理记录没有独立派发编号，无法与实际伤害作精确关联；不按帧或重复攻击编号猜测。"
        : "已记录目标处理返回，但本集合没有同一派发、攻击和目标的敌方伤害应用；可能属于其他目标类型或缺失记录，不能当作零伤害。";
      trace = [unresolvedTrace(id, reason)];
    } else {
      status = "observed";
      reason = observation.stage === "queued"
        ? "这是创建／排队阶段记录；单凭此记录不能断定观察终点是否仍待处理。"
        : "这是一次实际派发的阶段记录；目标检查或伤害应用另列，不重复增加伤害。";
      const builder = new TraceBuilder([source]);
      builder.add(`${id}.frame`, "原生阶段的实际观察帧", expr.input("frame"), [traceInput("frame", observation.frame, "frame", "source-host-observation", "原生记录此阶段的帧")],
        { unit: "frame", explanationKey: reason });
      trace = builder.nodes;
    }
    output.push({ id, stage: observation.stage, frame: observation.frame, ...identity, status,
      applicationIds: [], ...(value === undefined ? {} : { value }), reason, trace });
  });
  for (const pending of document.pendingAttackStages ?? []) {
    if (document.scope !== "finite-skill-cast"
      && associationSequence(pending.origin, observedAssociation(document.association)) !== document.action.sequence)
      throw new Error("待处理任务没有所选动作的原生关联。");
    const reason = pending.attackId === undefined
      ? `来源终点仍保留实际 ${pending.stage} 任务，到期帧 ${pending.dueFrame}；AttackID 尚未分配，此行仅作未绑定任务观察，不用于有限技能闭合证明。`
      : `来源终点仍保留实际 ${pending.stage} 任务，到期帧 ${pending.dueFrame}；该任务的未来伤害尚未结算。`;
    output.push({ id: `pending-${pending.id}`, pendingStageId: pending.id, stage: pending.stage,
      frame: pending.queuedFrame, dueFrame: pending.dueFrame,
      ...(pending.attackId === undefined ? {} : { attackId: pending.attackId }), status: "pending", applicationIds: [], reason,
      trace: [unresolvedTrace(`pending-${pending.id}`, reason)] });
  }
  return output;
}

function observedAssociation(association: SourceHostActionCollection["association"]): ObservedAssociation {
  return association === "skill-ownership" ? "creation" : association;
}

function associationSequence(origin: SourceHostResult["applications"][number]["origin"], association: ObservedAssociation): number | undefined {
  return association === "status-owner" ? origin?.statusOwner?.creationActionSequence
    : association === "creation" ? origin?.creationActionSequence : origin?.triggerActionSequence;
}
