import { sourceHostConstructContracts, sourceHostConstructPlan } from "./source-host-construct-contracts";
import { z } from "zod";
import registry from "./source-host-finite-cast-contracts.json" with { type: "json" };
import producerRegistry from "./source-host-producer-contracts.json" with { type: "json" };
import { sourceHostProducerPlan, type SourceHostFiniteCastPlan } from "./source-host-producer-plan";
import { analyzeSourceHostProducerGraph, type SourceHostFiniteRoot } from "./source-host-producer-analysis";
import { analyzeSourceHostOwnedGenerators } from "./source-host-owned-generator-analysis";
import { analyzeSourceHostRaidenOwnedEvents } from "./source-host-raiden-owned-analysis";
import { analyzeSourceHostBeidouOwnedCallbacks, reachableSourceHostBeidouOwnedCallbackRoots } from "./source-host-beidou-owned-analysis";
import { sourceHostEventRegistrationSchema, sourceHostEventEmissionSchema, sourceHostEventListenerCallSchema, sourceHostEventProducerSchema } from "./source-host-event-types";
import { analyzeSourceHostOwnedEntities } from "./source-host-owned-entity-analysis";
import { analyzeSourceHostOwnedShields, sourceHostOwnedShieldRoots } from "./source-host-owned-shield-analysis";
import { sourceHostShieldInstanceSchema, sourceHostShieldHookSchema, sourceHostShieldProducerSchema } from "./source-host-owned-shield-types";
import { sourceHostTaskLifecycleSchema } from "./source-host-task-lifecycle";
import { sourceHostOwnedEntitySchema, sourceHostOwnedEntityTriggerSchema, sourceHostOwnedEntityProducerSchema } from "./source-host-owned-entity-types";
import { sourceHostHitCallbackBatchSchema, sourceHostHitCallbackSchema } from "./source-host-hit-callback-types";
import { getSourceHostHitCallbackProducerRule, reachableSourceHostHitCallbackProducerRoots } from "./source-host-hit-callback-producer-analysis";
import { analyzeSourceHostHitCallbacks, reachableSourceHostHitCallbackRoots } from "./source-host-hit-callback-analysis";
import { sourceHostAbilityInvocationSchema, sourceHostAbilityProducerSchema, sourceHostAttackDispatchCompletionSchema, sourceHostOwnedGeneratorSchema, sourceHostOwnedGeneratorTriggerSchema, type SourceHostAbilityInvocation } from "./source-host-finite-cast-types";
import { sourceHostAttackObservationSchema, sourceHostStatusInstanceSchema, type SourceHostOrigin } from "./source-host-action-origin";
import type { SourceHostApplication } from "./source-host-wire";

type CountRule = { kind: "constant"; count: number; condition?: string }
  | { kind: "paramEquals"; param: string; value: number; whenEqual: number; otherwise: number }
  | { kind: "constellationThreshold"; threshold: number; below: number; atOrAbove: number };
export interface SourceHostFiniteCastContract {
  id: string; label: string; characterKey: string; action: string; method: string;
  sourcePath: string; sourceSha256: string; sourceEvidence: string;
  scopeNotes?: string[];
  /** A reviewed lane may differ from the other pinned source. Omission retains the shared registry scope. */
  sourceCommits?: string[];
  nonDamageCallbacksAndInitAudit: string; expectedRootAttackCount?: CountRule; sourceRefs: string[];
  producerContract?: boolean;
  ownedGeneratorContract?: boolean;
  ownedEntityContract?: boolean;
  ownedShieldContract?: boolean;
  shieldProducerContract?: boolean;
  hitCallbackContract?: boolean;
  sourceHashes?: { classicSha256: string; stellarSha256: string };
}
const commits: string[] = Object.values(registry.sourceCommits);
export const sourceHostFiniteCastContracts: Omit<SourceHostFiniteCastContract, "sourceRefs">[] = [
  ...(registry.rows as Omit<SourceHostFiniteCastContract, "sourceRefs">[]).filter(row => !producerRegistry.rows.some(producer => producer.id === row.id)),
  ...producerRegistry.rows,
  ...sourceHostConstructContracts,
];
export function getSourceHostFiniteCastContract(sourceCommit: string, characterKey: string, action: string): SourceHostFiniteCastContract | undefined {
  if (!commits.includes(sourceCommit)) return undefined;
  const row = sourceHostFiniteCastContracts.find(row => row.characterKey === characterKey && row.action === action
    && (row.sourceCommits === undefined || row.sourceCommits.includes(sourceCommit)));
  return row && { ...row,
    sourceSha256: row.sourceHashes?.[sourceCommit === producerRegistry.sourceCommits.stellar ? "stellarSha256" : "classicSha256"] ?? row.sourceSha256,
    sourceRefs: [`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${row.sourcePath}`] };
}

/** Parameters follow the pinned method's branches, not an inferred damage count. */
export function sourceHostFiniteCastPlan(contract: SourceHostFiniteCastContract, invocation: SourceHostAbilityInvocation): SourceHostFiniteCastPlan | undefined {
  if (!Object.values(invocation.params).every(Number.isInteger)) return undefined;
  if (contract.id === "albedo-skill" || contract.id === "zhongli-skill") return sourceHostConstructPlan(contract.id, invocation);
  if (contract.producerContract) return sourceHostProducerPlan(contract.id, invocation);
  const rule = contract.expectedRootAttackCount;
  if (!rule) return undefined;
  const count = rule.kind === "constant" ? rule.count : rule.kind === "paramEquals"
    ? invocation.params[rule.param] === rule.value ? rule.whenEqual : rule.otherwise
    : invocation.constellation >= rule.threshold ? rule.atOrAbove : rule.below;
  return { directRootCount: count, expectedRootAttackCount: count, requiresProducers: false, sites: [],
    ...(contract.scopeNotes ? { scopeNotes: contract.scopeNotes } : {}) };
}

export function sourceHostFiniteExpectedRootCount(contract: SourceHostFiniteCastContract, invocation: SourceHostAbilityInvocation): number | undefined {
  return sourceHostFiniteCastPlan(contract, invocation)?.expectedRootAttackCount;
}

/** Only native facts are serialized. Closure is recomputed using the local fixed-source registry. */
export const sourceHostFiniteCastEvidenceSchema = z.object({
  invocation: sourceHostAbilityInvocationSchema,
  producers: z.array(sourceHostAbilityProducerSchema).optional(),
  invocations: z.array(sourceHostAbilityInvocationSchema).optional(),
  eventRegistrations: z.array(sourceHostEventRegistrationSchema).optional(),
  eventEmissions: z.array(sourceHostEventEmissionSchema).optional(),
  eventListenerCalls: z.array(sourceHostEventListenerCallSchema).optional(),
  eventProducers: z.array(sourceHostEventProducerSchema).optional(),
  ownedGenerators: z.array(sourceHostOwnedGeneratorSchema).optional(),
  ownedGeneratorTriggers: z.array(sourceHostOwnedGeneratorTriggerSchema).optional(),
  ownedEntities: z.array(sourceHostOwnedEntitySchema).optional(),
  ownedEntityTriggers: z.array(sourceHostOwnedEntityTriggerSchema).optional(),
  ownedEntityProducers: z.array(sourceHostOwnedEntityProducerSchema).optional(),
  shieldInstances: z.array(sourceHostShieldInstanceSchema).optional(),
  shieldHooks: z.array(sourceHostShieldHookSchema).optional(),
  shieldProducers: z.array(sourceHostShieldProducerSchema).optional(),
  taskLifecycle: sourceHostTaskLifecycleSchema.optional(),
  hitCallbackBatches: z.array(sourceHostHitCallbackBatchSchema).optional(),
  hitCallbacks: z.array(sourceHostHitCallbackSchema).optional(),
  statusInstances: z.array(sourceHostStatusInstanceSchema).optional(),
  dispatchCompletions: z.array(sourceHostAttackDispatchCompletionSchema),
  observations: z.array(z.object({ sourceIndex: z.number().int().nonnegative(), row: sourceHostAttackObservationSchema }).strict()),
  excluded: z.array(z.object({ id: z.string(), reason: z.string(), applicationIds: z.array(z.number().int().nonnegative()) }).strict()),
}).strict();
export type SourceHostFiniteCastEvidence = z.infer<typeof sourceHostFiniteCastEvidenceSchema>;
interface FiniteDocument {
  action: { sequence: number; characterKey: string; action: string; acceptedFrame: number; noOp?: boolean | undefined };
  sourceContext?: { sourceCommit: string } | undefined;
  observationEndFrame?: number | undefined; lifecycleObservationFrame?: number | undefined;
  finiteCastEvidence?: SourceHostFiniteCastEvidence | undefined;
  hits: Array<{ included: boolean; calculation: { originalCapture: { sourceCommit: string; application: SourceHostApplication } } }>;
}
export interface SourceHostFiniteCastAnalysis {
  contract?: SourceHostFiniteCastContract | undefined;
  expectedRootAttackCount: number | undefined; completedRootAttackCount: number; closed: boolean;
  rootCountKind: "fixed" | "runtime"; observedRootAttackCount: number;
  producerCount: number; completedProducerCount: number; pendingProducerCount: number;
  generatorCount: number; endedGeneratorCount: number; openGeneratorCount: number; triggerCount: number;
  entityCount: number; endedEntityCount: number; openEntityCount: number; entityTriggerCount: number;
  entityProducerCount: number; completedEntityProducerCount: number; pendingEntityProducerCount: number;
  shieldInstanceIds: number[]; shieldCount: number; endedShieldCount: number; openShieldCount: number; shieldHookCount: number;
  shieldRelatedExcludedInstanceIds: number[];
  shieldProducerIds: number[]; shieldProducerCount: number; completedShieldProducerCount: number; pendingShieldProducerCount: number;
  hitCallbackBatchCount: number; completedHitCallbackBatchCount: number; pendingHitCallbackBatchCount: number;
  hitCallbackCount: number;
  scopeNotes?: string[];
  reasons: string[]; includedComponents: string[]; excludedComponents: string[];
}
const includedComponents = ["本次技能方法及已审阅后续任务创建的固有攻击，对本次场景敌人的实际伤害应用", "每击独立的快照、增伤、暴击及已支持的增幅／加算反应"];
const excludedComponents = ["另行派发的剧变或其他反应伤害", "独立武器／圣遗物追击、其他角色及后续动作自身的伤害", "治疗、护盾量与持续增益效果"];
const intrinsicOrigin = (origin: SourceHostOrigin | undefined, sequence: number, producer: boolean) =>
  origin?.creationActionSequence === sequence && (origin.via === "action" || producer && origin.via === "task") && origin.parentAttackId === undefined;
const ownedOrigin = (origin: SourceHostOrigin | undefined, invocation: SourceHostAbilityInvocation, instanceId: number,
  holderActorIndex = invocation.actorIndex) =>
  origin?.statusOwner?.instanceId === instanceId && origin.statusOwner.actorIndex === holderActorIndex
  && origin.statusOwner.creationActionSequence === invocation.actionSequence;

/** Exact native root references establish ownership; trigger ancestry stays separate. */
export function sourceHostFiniteSkillOwnsApplication(evidence: SourceHostFiniteCastEvidence, application: SourceHostApplication): boolean {
  const { invocation } = evidence, origin = application.origin;
  const callbackProducerContract = sourceHostFiniteCastContracts.find(row => getSourceHostHitCallbackProducerRule(row.id)
    && row.characterKey === invocation.characterKey && row.action === invocation.action);
  if (invocation.queuedAttacks.some(row => row.attackId === application.attackId)
    && intrinsicOrigin(origin, invocation.actionSequence, false)) return true;
  if (!callbackProducerContract && evidence.producers?.some(producer => producer.invocationId === invocation.id
    && producer.queuedAttacks.some(row => row.attackId === application.attackId))
    && intrinsicOrigin(origin, invocation.actionSequence, true)) return true;
  const statusOwned = evidence.ownedGenerators?.some(generator => generator.invocationId === invocation.id
    && ownedOrigin(origin, invocation, generator.statusInstanceId, generator.holderActorIndex ?? generator.actorIndex)
    && evidence.ownedGeneratorTriggers?.some(trigger => trigger.generatorId === generator.id
      && trigger.queuedAttacks.some(row => row.attackId === application.attackId)
      && (invocation.characterKey !== "raidenshogun" || invocation.action !== "skill"
        || JSON.stringify(origin) === JSON.stringify(trigger.origin)))) ?? false;
  const entityOwned = evidence.ownedEntities?.some(entity => entity.invocationId === invocation.id
    && (evidence.ownedEntityTriggers?.some(trigger => trigger.entityId === entity.id
      && trigger.queuedAttacks.some(row => row.attackId === application.attackId))
      || evidence.ownedEntityProducers?.some(producer => producer.entityId === entity.id
        && producer.queuedAttacks.some(row => row.attackId === application.attackId)))) ?? false;
  if (statusOwned || entityOwned) return true;
  if (reachableSourceHostBeidouOwnedCallbackRoots(evidence)
    .some(row => row.attack.attackId === application.attackId)) return true;
  const shieldContract = sourceHostFiniteCastContracts.find(row => row.ownedShieldContract
    && row.characterKey === invocation.characterKey && row.action === invocation.action);
  if (shieldContract && sourceHostOwnedShieldRoots(shieldContract.id, evidence)
    .some(row => row.attack.attackId === application.attackId)) return true;
  const callbackContract = sourceHostFiniteCastContracts.find(row => row.hitCallbackContract
    && row.characterKey === invocation.characterKey && row.action === invocation.action);
  if (!callbackContract) return false;
  // Audited callback families start at method or producer roots; only their
  // exact parent/target/slot graph can add an intrinsic child attack.
  const initialRoots: SourceHostFiniteRoot[] = [
    ...invocation.queuedAttacks.map(attack => ({ attack, startedFrame: invocation.startedFrame, completedFrame: invocation.returnedFrame })),
    ...(evidence.producers ?? []).filter(row => row.invocationId === invocation.id)
      .flatMap(producer => producer.queuedAttacks.map(attack => ({ attack, producer,
        startedFrame: producer.startedFrame, completedFrame: producer.completedFrame }))),
  ];
  return [...reachableSourceHostHitCallbackRoots(callbackContract.id, evidence, initialRoots),
    ...reachableSourceHostHitCallbackProducerRoots(callbackContract.id, evidence, initialRoots)]
    .some(row => row.attack.attackId === application.attackId);
}

/** Every root needs a finished dispatch and a terminal outcome for every checked enemy. */
export function analyzeSourceHostFiniteSkillCollection(document: FiniteDocument): SourceHostFiniteCastAnalysis {
  const evidence = document.finiteCastEvidence;
  const sourceCommit = document.sourceContext?.sourceCommit ?? document.hits[0]?.calculation.originalCapture.sourceCommit ?? "";
  const contract = getSourceHostFiniteCastContract(sourceCommit, document.action.characterKey, document.action.action);
  const reasons: string[] = [];
  const analysis: SourceHostFiniteCastAnalysis = { contract, expectedRootAttackCount: undefined, completedRootAttackCount: 0, closed: false,
    rootCountKind: "fixed", observedRootAttackCount: 0, producerCount: 0, completedProducerCount: 0, pendingProducerCount: 0,
    generatorCount: 0, endedGeneratorCount: 0, openGeneratorCount: 0, triggerCount: 0,
    entityCount: 0, endedEntityCount: 0, openEntityCount: 0, entityTriggerCount: 0,
    entityProducerCount: 0, completedEntityProducerCount: 0, pendingEntityProducerCount: 0,
    shieldInstanceIds: [], shieldCount: 0, endedShieldCount: 0, openShieldCount: 0, shieldHookCount: 0,
    shieldRelatedExcludedInstanceIds: [],
    shieldProducerIds: [], shieldProducerCount: 0, completedShieldProducerCount: 0, pendingShieldProducerCount: 0,
    hitCallbackBatchCount: 0, completedHitCallbackBatchCount: 0, pendingHitCallbackBatchCount: 0, hitCallbackCount: 0,
    reasons, includedComponents: [...includedComponents], excludedComponents: [...excludedComponents] };
  if (!contract || !evidence) {
    reasons.push(!contract ? "该来源或技能没有已审阅的有限固有伤害规则。" : "没有本次技能调用及派发结束的原生回执。");
    return analysis;
  }
  const { invocation, dispatchCompletions, observations } = evidence;
  const plan = sourceHostFiniteCastPlan(contract, invocation);
  if (!plan) { reasons.push("本次参数分支不在已审阅的有限规则内。"); return analysis; }
  analysis.expectedRootAttackCount = plan.expectedRootAttackCount;
  analysis.rootCountKind = plan.expectedRootAttackCount === undefined ? "runtime" : "fixed";
  if (plan.scopeNotes) analysis.scopeNotes = plan.scopeNotes;
  analysis.excludedComponents.push(...evidence.excluded.filter(row => row.applicationIds.length > 0).map(row => `${row.reason}（${row.applicationIds.length} 次应用）`));
  const end = document.lifecycleObservationFrame ?? document.observationEndFrame;
  if (!invocation.success || document.action.noOp || invocation.actionSequence !== document.action.sequence
    || invocation.characterKey !== document.action.characterKey || invocation.action !== document.action.action
    || invocation.startedFrame !== document.action.acceptedFrame || invocation.returnedFrame !== invocation.startedFrame
    || end === undefined || invocation.returnedFrame > end)
    reasons.push("技能调用身份、实际接受帧或观察终点不一致。");
  if (invocation.animationQueuedCallbacks !== 0 || invocation.hasOnRemoved && !plan.allowsOnRemoved)
    reasons.push("返回的动作另有动画回调，当前有限规则尚未覆盖其未来伤害。");
  const graph = analyzeSourceHostProducerGraph(plan, evidence, end);
  const owned = analyzeSourceHostOwnedGenerators(contract.id, evidence, end);
  const entities = analyzeSourceHostOwnedEntities(contract.id, evidence, end);
  const shields = analyzeSourceHostOwnedShields(contract.id, evidence, end);
  const producerCallbackRoots = new Map(reachableSourceHostHitCallbackProducerRoots(contract.id, evidence, graph.roots)
    .map(root => [root.attack.queueId, root]));
  const initialRoots = [...graph.roots.map(root => producerCallbackRoots.get(root.attack.queueId) ?? root),
    ...owned.roots, ...entities.roots, ...shields.roots];
  const callbacks = analyzeSourceHostHitCallbacks(contract.id, evidence, initialRoots, end);
  const ownedCallbacks = analyzeSourceHostBeidouOwnedCallbacks(evidence, end);
  const raidenEvents = analyzeSourceHostRaidenOwnedEvents(evidence, end);
  reasons.push(...graph.reasons, ...owned.reasons, ...entities.reasons, ...shields.reasons, ...callbacks.reasons, ...ownedCallbacks.reasons, ...raidenEvents.reasons);
  analysis.producerCount = graph.producerCount;
  analysis.completedProducerCount = graph.completedProducerCount;
  analysis.pendingProducerCount = graph.pendingProducerCount;
  analysis.generatorCount = owned.generatorCount;
  analysis.endedGeneratorCount = owned.endedGeneratorCount;
  analysis.openGeneratorCount = owned.openGeneratorCount;
  analysis.triggerCount = owned.triggerCount;
  analysis.entityCount = entities.entityCount;
  analysis.endedEntityCount = entities.endedEntityCount;
  analysis.openEntityCount = entities.openEntityCount;
  analysis.entityTriggerCount = entities.entityTriggerCount;
  analysis.entityProducerCount = entities.entityProducerCount;
  analysis.completedEntityProducerCount = entities.completedEntityProducerCount;
  analysis.pendingEntityProducerCount = entities.pendingEntityProducerCount;
  analysis.shieldInstanceIds = shields.shieldInstanceIds;
  analysis.shieldRelatedExcludedInstanceIds = shields.shieldRelatedExcludedInstanceIds;
  analysis.shieldCount = shields.shieldCount;
  analysis.endedShieldCount = shields.endedShieldCount;
  analysis.openShieldCount = shields.openShieldCount;
  analysis.shieldHookCount = shields.shieldHookCount;
  analysis.shieldProducerIds = shields.shieldProducerIds;
  analysis.shieldProducerCount = shields.shieldProducerCount;
  analysis.completedShieldProducerCount = shields.completedShieldProducerCount;
  analysis.pendingShieldProducerCount = shields.pendingShieldProducerCount;
  analysis.hitCallbackBatchCount = callbacks.batchCount + ownedCallbacks.batchCount;
  analysis.completedHitCallbackBatchCount = callbacks.completedBatchCount + ownedCallbacks.completedBatchCount;
  analysis.pendingHitCallbackBatchCount = callbacks.pendingBatchCount + ownedCallbacks.pendingBatchCount;
  analysis.hitCallbackCount = callbacks.callbackCount + ownedCallbacks.callbackCount;
  if (contract.ownedGeneratorContract) analysis.includedComponents.push("明确状态实例产生的本技能协同攻击；触发它的后续动作自身伤害不纳入");
  if (contract.ownedEntityContract) analysis.includedComponents.push("本次技能创建的明确实体所产生的固有攻击，包含实体移除后仍在途的已发出攻击");
  if (contract.ownedShieldContract) analysis.includedComponents.push("本次技能创建的明确护盾实例及其已审阅生命周期钩子／任务发出的固有攻击；其他调用或命座独立创建的护盾保留各自归属");
  if (contract.hitCallbackContract) analysis.includedComponents.push("明确父攻击与目标的已审阅命中回调所产生的本技能追加攻击");
  const allRoots = [...initialRoots, ...callbacks.roots, ...ownedCallbacks.roots];
  const generationClosed = graph.closed && owned.closed && entities.closed && shields.closed && callbacks.closed && ownedCallbacks.closed && raidenEvents.closed;
  const roots = allRoots.map(row => row.attack);
  analysis.observedRootAttackCount = roots.length;
  if (invocation.queuedAttacks.length !== plan.directRootCount
    || new Set(roots.map(row => row.queueId)).size !== roots.length
    || generationClosed && plan.expectedRootAttackCount !== undefined && roots.length !== plan.expectedRootAttackCount)
    reasons.push("实际根攻击数量或队列身份与固定源码规则不符。");
  if (generationClosed && analysis.rootCountKind === "runtime") analysis.expectedRootAttackCount = roots.length;
  const ids = roots.flatMap(row => row.attackId === undefined ? [] : [row.attackId]);
  if (new Set(ids).size !== ids.length) reasons.push("根攻击编号重复，无法证明独立攻击机会。");
  const apps = document.hits.map(hit => hit.calculation.originalCapture.application);
  if (apps.some(app => !ids.includes(app.attackId) || !sourceHostFiniteSkillOwnsApplication(evidence, app))) reasons.push("集合混入契约范围以外的伤害应用。");
  const indexed = new Map(observations.map(entry => [entry.sourceIndex, entry.row]));
  if (indexed.size !== observations.length) reasons.push("原生观察序号重复。");
  for (const ownedRoot of allRoots) {
    const root = ownedRoot.attack;
    const queued = indexed.get(root.queueId - 1);
    const statusGenerator = evidence.ownedGenerators?.find(row => row.statusInstanceId === ownedRoot.statusInstanceId
      && row.invocationId === invocation.id);
    // Entity ownership comes from native instance and emit receipts; retain its
    // actual callback ancestry, including a later action or unknown creation.
    const matchesOrigin = (origin: SourceHostOrigin | undefined) => ownedRoot.entityId !== undefined || ownedRoot.shieldInstanceId !== undefined || ownedRoot.hitCallback !== undefined
      ? JSON.stringify(origin) === JSON.stringify(queued?.origin)
      : ownedRoot.statusInstanceId === undefined
      ? intrinsicOrigin(origin, invocation.actionSequence, ownedRoot.producer !== undefined)
      : ownedOrigin(origin, invocation, ownedRoot.statusInstanceId,
        statusGenerator?.holderActorIndex ?? statusGenerator?.actorIndex ?? invocation.actorIndex)
        && (contract.id !== "raiden-skill" || JSON.stringify(origin) === JSON.stringify(queued?.origin));
    const problems: string[] = [];
    if (!queued || queued.stage !== "queued" || queued.frame !== root.frame
      || queued.attackId !== root.attackId
      || !matchesOrigin(queued.origin)
      || ownedRoot.startedFrame === undefined || ownedRoot.completedFrame === undefined
      || root.frame < ownedRoot.startedFrame || root.frame > ownedRoot.completedFrame)
      problems.push("缺少技能方法／后续任务区间内对应的原生排队记录");
    const completions = root.attackId === undefined ? [] : dispatchCompletions.filter(row => row.attackId === root.attackId);
    const dispatched = root.attackId === undefined ? [] : observations.map(entry => entry.row).filter(row => row.attackId === root.attackId && row.stage === "dispatched");
    if (completions.length !== 1 || dispatched.length !== 1) {
      problems.push("攻击尚无唯一的派发结束回执");
    } else {
      const completion = completions[0]!, dispatch = dispatched[0]!;
      if (completion.dispatchId !== dispatch.dispatchId || completion.frame !== dispatch.frame
        || completion.frame < root.frame || end === undefined || completion.frame > end
        || !matchesOrigin(completion.origin)) problems.push("派发身份、帧或来源不一致");
      const keys = [...completion.enemyTargetKeys, ...completion.skippedEnemyKeys];
      if (new Set(keys).size !== keys.length || completion.skipsEnemies && keys.length > 0) problems.push("派发敌人集合冲突");
      const rootApps = apps.filter(app => app.attackId === root.attackId);
      if (rootApps.some(app => app.dispatchId !== completion.dispatchId || !completion.enemyTargetKeys.includes(app.targetKey)))
        problems.push("伤害应用不属于本次派发检查的敌人");
      for (const targetKey of completion.enemyTargetKeys) {
        const terminal = observations.map(entry => entry.row).filter(row => row.attackId === root.attackId
          && row.dispatchId === completion.dispatchId && row.targetKey === targetKey && (row.stage === "resolved" || row.stage === "missed"));
        const applied = rootApps.filter(app => app.targetKey === targetKey && app.dispatchId === completion.dispatchId);
        if (terminal.length !== 1 || terminal[0]!.frame !== completion.frame
          || terminal[0]!.stage === "resolved" && (applied.length !== 1 || applied[0]!.frame < completion.frame || end === undefined || applied[0]!.frame > end)
          || terminal[0]!.stage === "missed" && applied.length !== 0)
          problems.push(`目标 ${targetKey} 缺少唯一命中应用或明确落空回执`);
      }
    }
    if (problems.length) reasons.push(`排队攻击 #${root.queueId}：${problems.join("；")}。`);
    else analysis.completedRootAttackCount++;
  }
  analysis.closed = reasons.length === 0 && analysis.expectedRootAttackCount !== undefined && analysis.completedRootAttackCount === analysis.expectedRootAttackCount;
  return analysis;
}
