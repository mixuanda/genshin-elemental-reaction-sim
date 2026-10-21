import { assertSourceHostRandomness, sourceHostRandomnessSchema } from "./source-host-randomness";
import { z } from "zod";
import { SPECIAL_RANK_WEIGHTS } from "@genshin-dps-lab/reaction-formulas";
import { reactionLevelBaseDamage } from "./calculator-formula";
import { sourceHostArtifactSupportIds, sourceHostArtifactSupportRefs, sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import { resolveSourceHostArtifactScalarInput, sourceHostArtifactScalarInputSchema, sourceHostArtifactRuleStatIndex, type SourceHostArtifactScalarInput } from "./source-host-artifact-formula";
import { isSourceHostArtifactDynamicRuleId } from "./source-host-artifact-dynamic-formula";
import { resolveSourceHostCharacterModifierInput, sourceHostCharacterModifierInputSchema } from "./source-host-character-modifier-formula";
import { resolveSourceHostCharacterScalarInput, sourceHostCharacterScalarInputSchema } from "./source-host-character-scalar-formula";
import { sourceHostWeaponAdditiveInputSchema } from "./source-host-weapon-formula";
import { resolveSourceHostCharacterMultiplierInput, sourceHostCharacterMultiplierInputSchema } from "./source-host-character-multiplier-formula";
import { resolveSourceHostCharacterFlatInput, sourceHostCharacterFlatInputSchema } from "./source-host-character-flat-formula";
import { resolveSourceHostCharacterAdditiveInput, sourceHostCharacterAdditiveInputSchema } from "./source-host-character-additive-formula";
import { sourceHostArtifactAdditiveInputSchema } from "./source-host-artifact-additive-formula";
import { verifySourceHostHealingApplication } from "./source-host-healing-capture";
import { verifySourceHostEnergyApplication } from "./source-host-energy-capture";
import { sourceHostStatProvenanceSchema } from "./source-host-stat-provenance";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { createSourceHostValidationLookup, resolveSourceHostRequest, SOURCE_HOST_EXPLANATION_GAPS, SOURCE_HOST_FORMULA_SOURCES, type SourceHostCalculation } from "./source-host-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, SOURCE_HOST_RESULT_VERSION,
  assertSourceHostStartupState, sourceHostInitialEnergySchema, sourceHostStartupStateSchema,
  sourceHostApplicationSchema, sourceHostCalculationRecordSchema, sourceHostOutgoingRequestSchema, isSourceHostOutgoingRequest,
  sourceHostNativeResultSchema, sourceHostResultSchema, sourceHostArtifactSchema, sourceHostCommitSchema,
  sourceHostTargetSceneSchema, sourceHostObservationWindowSchema,
  sourceHostTargetApplicationRequestSchema,
  type SourceHostCalculationRecord, type SourceHostOutgoingRequest, type SourceHostResult, type SourceHostTargetApplicationRequest,
} from "./source-host-wire";
import { assertSourceHostTargetPhases, normalizeSourceHostTargetPhases, sourceHostTargetPhaseAt, sourceHostTargetPhaseReceiptSchema } from "./source-host-target-phase";

export const SOURCE_HOST_CAPTURE_VERSION = "source-host-hit-v1" as const;
export const SOURCE_HOST_CALCULATOR_VERSION = "source-host-calculator-v1" as const;
const damageRecord = z.object({ request: sourceHostOutgoingRequestSchema, value: z.number().finite() }).strict();
const applicationRecord = z.object({ request: sourceHostTargetApplicationRequestSchema, value: z.number().finite() }).strict();
export const sourceHostHitCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_CAPTURE_VERSION), formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION),
  executionArtifact: sourceHostArtifactSchema.optional(),
  sourceCommit: sourceHostCommitSchema, sourceConfig: z.string(), seed: z.string(),
  randomness: sourceHostRandomnessSchema.optional(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  targetScene: sourceHostTargetSceneSchema.optional(), observationWindow: sourceHostObservationWindowSchema.optional(),
  targetPhases: sourceHostTargetPhaseReceiptSchema.optional(),
  application: sourceHostApplicationSchema, calculation: damageRecord,
  applicationCalculation: applicationRecord.optional(),
  components: z.array(sourceHostCalculationRecordSchema),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostHitCapture = z.infer<typeof sourceHostHitCaptureSchema>;
export interface SourceHostHitReplay {
  captured: SourceHostHitCapture;
  request: SourceHostOutgoingRequest;
  trace: CalculationTraceNode[];
  originalDamage: number;
  reproducedDamage: number;
  difference: number;
  originalRawDamage: number;
  reproducedRawDamage: number;
  applicationCalculation?: SourceHostCalculationRecord;
  applicationTrace?: CalculationTraceNode[];
  reproducedApplicationDamage?: number;
  applicationDifference?: number;
  verification: "provisional";
  explanationStatus: "partial";
  warnings: string[];
}
function exact(actual: number, expected: number, field: string): void {
  if (actual !== expected) throw new Error(`来源命中 ${field} 无法精确复现：${actual} / ${expected}`);
}
function componentMap(records: readonly SourceHostCalculationRecord[], supporting: ReadonlyMap<number, SourceHostCalculationRecord> = new Map()) {
  const map = new Map<number, SourceHostCalculationRecord>(supporting);
  for (const record of records) {
    if (isSourceHostOutgoingRequest(record.request) || record.request.kind === "target-application" || record.request.kind === "artifact-scalar" || record.request.kind === "character-modifier" || record.request.kind === "character-scalar" || record.request.kind === "character-additive" && record.request.input.phase === "creation" || record.request.kind === "character-energy" || record.request.kind === "character-healing" || record.request.kind === "character-cooldown" || record.request.kind === "player-incoming" || record.request.kind === "player-shield" || record.request.kind === "player-shield-min" || record.request.kind === "player-drain" || record.request.kind === "lunar-bloom-event" || record.request.kind === "stellar-conduct-event" || map.has(record.request.id) || record.request.componentIds.some(id => id >= record.request.id || !map.has(id))) throw new Error("来源捕获中的反应组件必须按实际前置顺序保留唯一、完整的递归公式上下文。");
    const replay = resolveSourceHostRequest(record.request, map);
    exact(replay.value, record.value, `component #${record.request.id}`);
    map.set(record.request.id, record);
  }
  return map;
}
function supportingMap(records: readonly SourceHostCalculationRecord[], sourceCommit: string) {
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const record of records) {
    if ((record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar" && !(record.request.kind === "character-additive" && record.request.input.phase === "creation")) || map.has(record.request.id) || record.request.componentIds.length || (record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== sourceCommit) throw new Error("来源修饰器支持记录的类型、身份或源码不一致。");
    const output = resolveSourceHostRequest(record.request, map);
    exact(output.value, record.value, `modifier support #${record.request.id}`);
    map.set(record.request.id, record);
  }
  return map;
}

// Native fields were parsed above; validate only the additional result fields
// when attaching metadata. Keep the saved-result parser strict on entry.
const resultMetadataSchema = sourceHostResultSchema.pick({ executionArtifact: true, schemaVersion: true, formulaVersion: true, verification: true, explanationStatus: true, explanationGaps: true }).strip();

/** Match the actual JS responses to Go's receipt without running the combat twice. */
export function createSourceHostResult(rawNative: unknown, executed?: readonly SourceHostCalculation[]): SourceHostResult {
  if (typeof rawNative === "object" && rawNative !== null && "error" in rawNative) throw new Error(String(rawNative.error));
  // Saved results must retain their original formula identity before any
  // current metadata is attached. Fresh Go responses have no schemaVersion.
  const native = typeof rawNative === "object" && rawNative !== null && "schemaVersion" in rawNative
    ? sourceHostResultSchema.parse(rawNative) : sourceHostNativeResultSchema.parse(rawNative);
  assertSourceHostStartupState(native.initialEnergy, native.startupState);
  assertSourceHostRandomness(native.randomness, native.seed);
  if (native.targetPhases) assertSourceHostTargetPhases({ policy: native.targetPhases.policy,
    phases: normalizeSourceHostTargetPhases(native.targetPhases) }, native.targetPhases, native.targetScene);
  const map = new Map<number, SourceHostCalculationRecord>();
  const explanationGaps = new Set(SOURCE_HOST_EXPLANATION_GAPS);
  const local = executed === undefined ? undefined : new Map(executed.map(record => [record.request.id, record]));
  if (local !== undefined && local.size !== native.calculations.length) throw new Error("来源运行记录数量与共享核心实际回调数量不一致。");
  for (const record of native.calculations) {
    if ((record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== native.sourceCommit) throw new Error("来源计算回执与运行源码身份不一致。");
    if (map.has(record.request.id)) throw new Error("来源运行记录包含重复计算 ID。");
    if (local) {
      const supplied = local.get(record.request.id);
      if (!supplied) throw new Error(`来源运行缺少实际共享核心响应 #${record.request.id}。`);
      exact(record.value, supplied.value, `source response #${record.request.id}`);
      supplied.explanationGaps.forEach(gap => explanationGaps.add(gap));
      if (JSON.stringify(record.request) !== JSON.stringify(supplied.request)) {
        // Native Go map-key order differs from the parsed JS object's insertion order.
        // Compare the actual numeric context and shared request identity directly.
        if (record.request.kind !== supplied.request.kind || JSON.stringify(record.request.input) !== JSON.stringify(supplied.request.input)) throw new Error(`来源请求 #${record.request.id} 与本次共享核心上下文不一致。`);
      }
    } else {
      const replay = resolveSourceHostRequest(record.request, map);
      exact(record.value, replay.value, `source response #${record.request.id}`);
      replay.explanationGaps.forEach(gap => explanationGaps.add(gap));
    }
    map.set(record.request.id, record);
  }
  for (const application of native.applications) {
    const record = map.get(application.calculationId);
    if (!record || !isSourceHostOutgoingRequest(record.request)) throw new Error("来源实际伤害没有对应的共享公式回调。");
    if (application.frame !== record.request.frame) throw new Error("来源实际伤害应用帧与共享公式计算帧不一致。");
    exact(application.rawDamage, record.value, `application #${application.id}`);
    const matchedPhase = sourceHostTargetPhaseAt(native.targetPhases, application.targetKey, application.frame);
    if (JSON.stringify(matchedPhase ?? null) !== JSON.stringify(application.targetPhase ?? null))
      throw new Error(`来源应用 #${application.id} 的目标阶段与实际半开窗口不一致。`);
    if (application.applicationCalculationId !== undefined) {
      const applied = map.get(application.applicationCalculationId);
      if (!applied || applied.request.kind !== "target-application" ||
        applied.request.rawCalculationId !== application.calculationId ||
        applied.request.frame !== application.frame ||
        JSON.stringify(applied.request.phase) !== JSON.stringify(application.targetPhase))
        throw new Error(`来源应用 #${application.id} 缺少匹配的共享目标应用公式。`);
      exact(applied.request.input.hpBefore, application.hpBefore, `application HP #${application.id}`);
      exact(applied.request.input.damageMode ? 1 : 0, application.damageMode ? 1 : 0, `application mode #${application.id}`);
      exact(applied.value, application.appliedDamage, `application result #${application.id}`);
    } else if (matchedPhase !== undefined) {
      throw new Error(`来源应用 #${application.id} 位于已声明阶段内，但缺少共享目标应用公式。`);
    }
  }
  for (const application of native.playerApplications ?? []) {
    const record = map.get(application.calculationId);
    if (!record || (record.request.kind !== "player-incoming" && record.request.kind !== "player-manual-incoming") ||
      record.request.attackId !== application.attackId || record.request.targetKey !== application.targetKey ||
      record.request.frame !== application.frame ||
      (record.request.kind === "player-incoming" ? record.request.input.isCrit !== application.isCrit || application.damagedActorIndex !== undefined
        : application.isCrit || application.damagedActorIndex !== record.request.actorIndex))
      throw new Error("来源玩家受击缺少匹配的共享公式回调。");
    exact(application.rawDamage, record.value, `player application #${application.id}`);
    exact(application.shieldAbsorbed, application.rawDamage - application.damageAfterShield, `player shield #${application.id}`);
  }
  for (const application of native.drainApplications ?? []) {
    const record = map.get(application.calculationId);
    if (!record || record.request.kind !== "player-drain" || record.request.frame !== application.frame ||
      record.request.attackId !== application.attackId || record.request.actorIndex !== application.actorIndex ||
      record.request.actorKey !== application.actorKey || record.request.ability !== application.ability ||
      (record.request.amountCalculationId ?? null) !== application.sourceCalculationId)
      throw new Error("来源 Drain 应用缺少实际生命写回公式。");
    exact(record.request.input.amount, application.amount, `drain amount #${application.id}`);
    exact(record.request.input.hpBefore, application.hpBefore, `drain HP #${application.id}`);
    exact(record.request.input.maxHp, application.maxHp, `drain max HP #${application.id}`);
    exact(record.value, application.resultRatio, `drain ratio #${application.id}`);
  }
  const verificationRecords = (native.energyApplications?.length || native.healingApplications?.length) ? createSourceHostValidationLookup(map) : map;
  for (const application of native.energyApplications ?? []) verifySourceHostEnergyApplication(application, verificationRecords);
  for (const application of native.healingApplications ?? []) verifySourceHostHealingApplication(application, verificationRecords);
  return { ...native, ...resultMetadataSchema.parse({
    executionArtifact: native.executionArtifact,
    schemaVersion: SOURCE_HOST_RESULT_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    verification: "provisional", explanationStatus: "partial", explanationGaps: [...explanationGaps],
  }) };
}

/** Capture one actually applied hit and only the preceding calculations it used. */
export function captureSourceHostHit(rawResult: unknown, applicationId: number): SourceHostHitCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  assertSourceHostStartupState(result.initialEnergy, result.startupState);
  const application = result.applications.find(row => row.id === applicationId);
  if (!application) throw new Error(`来源运行不存在实际命中 #${applicationId}。`);
  const calculation = result.calculations.find(row => row.request.id === application.calculationId);
  if (!calculation || !isSourceHostOutgoingRequest(calculation.request)) throw new Error("来源命中缺少完整数值计算上下文。");
  const applicationCalculation = application.applicationCalculationId === undefined ? undefined
    : result.calculations.find(row => row.request.id === application.applicationCalculationId);
  if (application.applicationCalculationId !== undefined && applicationCalculation?.request.kind !== "target-application")
    throw new Error("来源命中缺少实际共享目标应用公式。");
  const byId = new Map(result.calculations.map(record => [record.request.id, record]));
  const needed = new Set<number>();
  const include = (id: number, parentId: number) => {
    if (id >= parentId) throw new Error("来源反应组件没有在其使用之前计算。");
    if (needed.has(id)) return;
    const record = byId.get(id);
    if (!record) throw new Error(`来源命中缺少反应组件 #${id}。`);
    needed.add(id);
    record.request.componentIds.forEach(child => include(child, id));
  };
  calculation.request.componentIds.forEach(id => include(id, calculation.request.id));
  if (calculation.request.multiplierCalculationId) include(calculation.request.multiplierCalculationId, calculation.request.id);
  const components = [...needed].sort((a, b) => a - b).map(id => byId.get(id)!);
  const supportIds = sourceHostArtifactSupportClosureIds([calculation, ...components].map(record => record.request), byId);
  const supportingCalculations = supportIds.map(id => {
    const record = byId.get(id);
    if (!record || (record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar" && !(record.request.kind === "character-additive" && record.request.input.phase === "creation"))) throw new Error(`来源命中缺少修饰器共享公式 #${id}。`);
    return record;
  });
  return replaySourceHostHit({
    schemaVersion: SOURCE_HOST_CAPTURE_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.randomness ? { randomness: result.randomness } : {}),
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.targetScene ? { targetScene: result.targetScene } : {}),
    ...(result.observationWindow ? { observationWindow: result.observationWindow } : {}),
    ...(result.targetPhases ? { targetPhases: result.targetPhases } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    application, calculation,
    ...(applicationCalculation ? { applicationCalculation } : {}),
    components, ...(supportingCalculations.length ? { supportingCalculations } : {}),
  }).captured;
}

/** Restore exactly the same numeric hit; no team, rotation or WASM is required. */
export function replaySourceHostHit(raw: unknown): SourceHostHitReplay {
  const captured = sourceHostHitCaptureSchema.parse(raw);
  assertSourceHostRandomness(captured.randomness, captured.seed);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const { application, calculation } = captured;
  const request = calculation.request;
  if ([request, ...(captured.applicationCalculation ? [captured.applicationCalculation.request] : []), ...captured.components.map(row => row.request), ...(captured.supportingCalculations ?? []).map(row => row.request)].some(row => (row.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)) throw new Error("捕获中的计算来自不同源码版本。");
  if (application.calculationId !== request.id || application.attackId !== request.attackId || application.targetKey !== request.targetKey || application.isCrit !== request.input.isCrit || application.frame !== request.frame) throw new Error("来源实际应用记录与捕获的命中身份或帧不一致。");
  if ((application.applicationCalculationId === undefined) !== (captured.applicationCalculation === undefined) ||
    (application.targetPhase === undefined) !== (captured.applicationCalculation === undefined))
    throw new Error("来源命中的目标阶段与共享目标应用计算记录不完整或不一致。");
  if (captured.applicationCalculation && !captured.targetPhases)
    throw new Error("阶段应用捕获缺少完整的用户声明目标阶段元数据。");
  const supporting = supportingMap(captured.supportingCalculations ?? [], captured.sourceCommit);
  const requiredSupport = new Set(sourceHostArtifactSupportClosureIds([calculation, ...captured.components].map(record => record.request), supporting));
  if (requiredSupport.size !== supporting.size || [...requiredSupport].some(id => !supporting.has(id))) throw new Error("来源捕获缺少本击实际使用的装备支持计算，或混入无关记录。");
  const components = componentMap(captured.components, supporting);
  const required = new Set<number>();
  const requireComponent = (id: number, parentId: number) => {
    const record = components.get(id);
    if (id >= parentId || !record) throw new Error("来源捕获缺少命中真正使用的前置反应上下文。");
    if (required.has(id)) return;
    required.add(id);
    record.request.componentIds.forEach(child => requireComponent(child, id));
  };
  request.componentIds.forEach(id => requireComponent(id, request.id));
  if (request.multiplierCalculationId) requireComponent(request.multiplierCalculationId, request.id);
  if (required.size !== captured.components.length) throw new Error("来源捕获混入了本击没有使用的组件。");
  const calculationReplay = resolveSourceHostRequest(request, components);
  exact(calculationReplay.value, calculation.value, "calculation value");
  exact(application.rawDamage, calculationReplay.value, "raw damage");
  const hp = new TraceBuilder(SOURCE_HOST_FORMULA_SOURCES);
  let loss: number;
  let applicationReplay: SourceHostCalculation | undefined;
  if (captured.applicationCalculation) {
    const record = captured.applicationCalculation;
    const appRequest = record.request;
    if (application.applicationCalculationId !== appRequest.id || appRequest.rawCalculationId !== request.id ||
      appRequest.attackId !== application.attackId || appRequest.targetKey !== application.targetKey ||
      appRequest.frame !== application.frame || appRequest.input.hpBefore !== application.hpBefore ||
      appRequest.input.damageMode !== application.damageMode || JSON.stringify(appRequest.phase) !== JSON.stringify(application.targetPhase))
      throw new Error("来源目标应用计算与实际命中/阶段回执身份不一致。");
    const phase = sourceHostTargetPhaseAt(captured.targetPhases, application.targetKey, application.frame);
    if (JSON.stringify(phase ?? null) !== JSON.stringify(appRequest.phase)) throw new Error("捕获的目标应用公式与完整阶段回执不一致。");
    const applicationInputs = new Map(components);
    applicationInputs.set(request.id, { request, value: calculationReplay.value });
    applicationReplay = resolveSourceHostRequest(appRequest, applicationInputs);
    exact(applicationReplay.value, record.value, "target application calculation");
    exact(applicationReplay.value, application.appliedDamage, "applied damage");
    const lossNode = applicationReplay.trace.find(node => node.id === "targetApplication.hpLoss");
    if (!lossNode?.result || !Number.isFinite(lossNode.result.value)) throw new Error("目标应用共享公式没有可重放的实际生命损失节点。");
    loss = lossNode.result.value;
  } else {
    loss = hp.add("sourceHpLoss", "目标实际生命扣减", expr.min(expr.input("rawDamage"), expr.input("hpBefore")), [
      traceInput("rawDamage", calculationReplay.value, "damage", "共享核心实际输出", "本击未按剩余生命截断的伤害"),
      traceInput("hpBefore", application.hpBefore, "hp", "来源实际扣血前", "同帧前序命中已结算后的实际剩余生命"),
    ], { unit: "hp", explanationKey: "固定来源始终从目标生命中扣除 min(伤害,剩余生命)。扣血与返回给伤害回调的统计量分开记录。" });
  }
  const after = hp.add("sourceHpAfter", "目标扣血后生命", expr.sub(expr.input("hpBefore"), expr.input("hpLoss")), [
    traceInput("hpBefore", application.hpBefore, "hp", "来源实际扣血前", "本次扣血之前的生命"), traceInput("hpLoss", loss, "hp", captured.applicationCalculation ? { kind: "shared-core-execution", reference: "targetApplication.hpLoss" } : "上一计算步骤", "本次实际扣除的生命"),
  ], { unit: "hp", explanationKey: "先前同帧伤害的实际扣血已包含在 hpBefore 中；这里没有重跑轮转或凭伤害总量反推生命。", childIds: captured.applicationCalculation ? [] : ["sourceHpLoss"] });
  exact(after, application.hpAfter, "target hpAfter");
  const reproducedDamage = applicationReplay?.value ?? hp.add("sourceAppliedDamage", "来源伤害回调实际记账量", expr.condition("equal", expr.input("damageMode"), expr.value(1), expr.input("hpLoss"), expr.input("rawDamage")), [
    traceInput("damageMode", Number(application.damageMode), "boolean", "来源实际运行模式", "1 为击杀伤害模式；0 为固定时长模式"), traceInput("hpLoss", loss, "damage", "上一计算步骤", "击杀模式计入本次真实生命损失"), traceInput("rawDamage", calculationReplay.value, "damage", "共享核心实际输出", "固定时长模式保留未裁剪伤害统计量"),
  ], { unit: "damage", explanationKey: "固定来源在击杀模式返回实际扣血；固定时长模式仍返回原伤害。不能将两个模式的伤害统计量混为真实生命损失。", childIds: ["sourceHpLoss"] });
  exact(reproducedDamage, application.appliedDamage, "applied damage");
  return { captured, request, trace: [...calculationReplay.trace, ...(applicationReplay?.trace ?? []), ...hp.nodes],
    originalDamage: application.appliedDamage, reproducedDamage, difference: reproducedDamage - application.appliedDamage,
    originalRawDamage: application.rawDamage, reproducedRawDamage: calculationReplay.value,
    ...(applicationReplay ? { applicationCalculation: applicationReplay,
      applicationTrace: applicationReplay.trace, reproducedApplicationDamage: applicationReplay.value,
      applicationDifference: applicationReplay.value - application.appliedDamage } : {}),
    verification: "provisional", explanationStatus: "partial", warnings: calculationReplay.explanationGaps,
  };
}
export function serializeSourceHostHit(capture: SourceHostHitCapture): string { return JSON.stringify(replaySourceHostHit(capture).captured, null, 2); }
export function parseSourceHostHit(json: string): SourceHostHitCapture { return replaySourceHostHit(JSON.parse(json) as unknown).captured; }

export const sourceHostEditableCalculationSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_CALCULATOR_VERSION), label: z.string(),
  originalCapture: sourceHostHitCaptureSchema, request: sourceHostOutgoingRequestSchema,
  applicationCalculation: applicationRecord.optional(),
  components: z.array(sourceHostCalculationRecordSchema),
  artifactExperiments: z.array(z.object({ calculationId: z.number().int().positive(), input: sourceHostArtifactScalarInputSchema }).strict()).optional(),
  weaponExperiments: z.array(z.object({ calculationId: z.number().int().positive(), input: sourceHostWeaponAdditiveInputSchema }).strict()).optional(),
  artifactAdditiveExperiments: z.array(z.object({ calculationId: z.number().int().positive(), input: sourceHostArtifactAdditiveInputSchema }).strict()).optional(),
  characterExperiments: z.array(z.object({ calculationId: z.number().int().positive(), input: z.union([sourceHostCharacterModifierInputSchema, sourceHostCharacterScalarInputSchema, sourceHostCharacterAdditiveInputSchema, sourceHostCharacterFlatInputSchema, sourceHostCharacterMultiplierInputSchema]) }).strict()).optional(),
}).strict();
export type SourceHostEditableCalculation = z.infer<typeof sourceHostEditableCalculationSchema>;
export type SourceHostArtifactScalarEditResult =
  | { status: "calculated"; originalValue: number; editedValue: number; formulaTrace: CalculationTraceNode[]; originalRawDamage: number; editedRawDamage: number; editedRequest: SourceHostOutgoingRequest; calculation: SourceHostCalculation }
  | { status: "blocked"; originalValue: number; editedValue: number; formulaTrace: CalculationTraceNode[]; originalRawDamage: number; reason: string };
export interface SourceHostEditableCalculationResult {
  calculation: SourceHostCalculation;
  /** Unclipped arithmetic result: editing does not pretend to rerun HP or reactions. */
  value: number;
  applicationValue?: number;
  applicationDifference?: number;
  applicationTrace?: CalculationTraceNode[];
  originalDamage: number;
  difference: number;
  edited: boolean;
  trace: CalculationTraceNode[];
  warnings: string[];
}
export function createSourceHostEditableCalculation(rawCapture: unknown): SourceHostEditableCalculation {
  const capture = replaySourceHostHit(rawCapture).captured;
  return sourceHostEditableCalculationSchema.parse({ schemaVersion: SOURCE_HOST_CALCULATOR_VERSION,
    label: `${capture.calculation.request.actorKey} · ${capture.calculation.request.ability} · #${capture.application.id}`,
    originalCapture: capture, request: structuredClone(capture.calculation.request),
    ...(capture.applicationCalculation ? { applicationCalculation: structuredClone(capture.applicationCalculation) } : {}),
    components: structuredClone(capture.components),
  });
}
function editedComponentMap(records: readonly SourceHostCalculationRecord[], supporting: ReadonlyMap<number, SourceHostCalculationRecord> = new Map()) {
  const map = new Map<number, SourceHostCalculationRecord>(supporting);
  for (const original of records) {
    const request = structuredClone(original.request);
    if (isSourceHostOutgoingRequest(request) || request.kind === "target-application" || request.kind === "artifact-scalar" || request.kind === "character-modifier" || request.kind === "character-scalar" || request.kind === "character-additive" && request.input.phase === "creation" || request.kind === "character-energy" || request.kind === "character-healing" || request.kind === "character-cooldown" || request.kind === "player-incoming" || request.kind === "player-manual-incoming" || request.kind === "player-shield" || request.kind === "player-shield-min" || request.kind === "player-drain" || request.kind === "character-drain" || request.kind === "lunar-bloom-event" || request.kind === "stellar-conduct-event" || map.has(request.id) || request.componentIds.some(id => id >= request.id || !map.has(id))) throw new Error("独立编辑仍须保留原有前置组件的完整顺序与身份。");
    if (request.kind === "lunar-contributor" || request.kind === "stellar-contributor") {
      request.input.levelBaseDamage = reactionLevelBaseDamage(request.input.characterLevel);
      request.input.isCrit = request.input.critRoll <= request.input.critRate;
    } else if (request.kind === "lunar-ranked" || request.kind === "stellar-ranked") {
      const ranked = request.componentIds.map(id => {
        const record = map.get(id)!;
        const contributorKind = request.kind === "lunar-ranked" ? "lunar-contributor" : "stellar-contributor";
        if (record.request.kind !== contributorKind) throw new Error("编辑后的特殊反应排名只能使用同分支的真实参与者组件。");
        return { id, value: record.value, actorIndex: record.request.actorIndex, critical: record.request.input.isCrit };
      }).sort((a, b) => b.value - a.value || a.actorIndex - b.actorIndex);
      if (!ranked.length) throw new Error("月反应独立编辑缺少实际参与者。");
      request.input.rankedContributorIds = ranked.map(row => row.id);
      request.input.weights = [...SPECIAL_RANK_WEIGHTS];
      request.input.displayIsCrit = ranked[0]!.critical;
      request.componentApplications = ranked.map((row, index) => ({ id: row.id, multiplier: SPECIAL_RANK_WEIGHTS[index]!, amount: row.value * SPECIAL_RANK_WEIGHTS[index]! }));
    } else if (request.kind !== "weapon-additive" && request.kind !== "artifact-additive" && request.kind !== "character-additive" && request.kind !== "character-flat" && request.kind !== "character-multiplier" && request.kind !== "character-shield") {
      request.input.levelBaseDamage = reactionLevelBaseDamage(request.input.characterLevel);
    }
    const result = resolveSourceHostRequest(request, map, { explicitFinalScaling: true });
    map.set(request.id, { request, value: result.value });
  }
  return map;
}
export function calculateSourceHostEditableCalculation(raw: unknown): SourceHostEditableCalculationResult {
  const document = sourceHostEditableCalculationSchema.parse(raw);
  const original = replaySourceHostHit(document.originalCapture);
  for (const experiment of document.characterExperiments ?? []) {
    calculateCharacterFormulaExperiment(original.captured, experiment.calculationId, experiment.input);
  }
  const request = structuredClone(document.request);
  const edited = JSON.stringify(request) !== JSON.stringify(document.originalCapture.calculation.request) || JSON.stringify(document.components) !== JSON.stringify(document.originalCapture.components);
  const supporting = supportingMap(document.originalCapture.supportingCalculations ?? [], document.originalCapture.sourceCommit);
  const components = edited ? editedComponentMap(document.components, supporting) : componentMap(document.components, supporting);
  if (edited) {
    const priorAmount = request.componentApplications.reduce((sum, row) => sum + row.amount, 0);
    for (const applied of request.componentApplications) {
      const component = components.get(applied.id);
      if (!component) throw new Error(`编辑上下文缺少实际前置组件 #${applied.id}。`);
      applied.amount = component.value * applied.multiplier;
    }
    const editedAmount = request.componentApplications.reduce((sum, row) => sum + row.amount, 0);
    if (editedAmount !== priorAmount) request.input.flatDamage = editedAmount + (request.input.flatDamage - priorAmount);
    if (request.kind === "lunar-delivery" || request.kind === "stellar-delivery") {
      const ranked = components.get(request.componentIds[0]!);
      if (ranked?.request.kind === "lunar-ranked" || ranked?.request.kind === "stellar-ranked") {
        // The source's terminal snapshot stores the highest contributor's crit
        // as CR=0/1 and CD=0. Rebuild only that recorded convention, not a panel.
        const oldRanked = document.originalCapture.components.find(row => row.request.id === ranked.request.id);
        if ((oldRanked?.request.kind === "lunar-ranked" || oldRanked?.request.kind === "stellar-ranked") && request.input.critRate === Number(oldRanked.request.input.displayIsCrit) && request.input.critDamage === 0) request.input.critRate = Number(ranked.request.input.displayIsCrit);
      }
    }
  }
  // Reuse the same recorded random draw under an edited CRIT rate. This is a
  // counterfactual numerical context, not another native simulation or RNG draw.
  if (edited) request.input.isCrit = request.input.hitWeakPoint || (request.input.critRoll !== null && request.input.critRoll <= Math.max(0, Math.min(1, request.input.critRate)));
  const calculation = resolveSourceHostRequest(request, components, { explicitFinalScaling: edited });
  let applicationCalculation: SourceHostCalculation | undefined;
  if (document.applicationCalculation) {
    const applicationRequest = structuredClone(document.applicationCalculation.request);
    applicationRequest.input.rawDamage = calculation.value;
    const applicationInputs = new Map(components);
    applicationInputs.set(request.id, { request, value: calculation.value });
    applicationCalculation = resolveSourceHostRequest(applicationRequest, applicationInputs);
  }
  const warnings = [...calculation.explanationGaps];
  if (edited) warnings.unshift("这是从实际命中派生的独立数值编辑：使用编辑后的属性和同一已记录随机数，不重跑来源轮转、重新触发反应、改变历史资源窗口或更新队伍结果。编辑的参与者按新等级查精确等级基数，重新计算各自暴击、实际排名和下游附加基数；未编辑的其他加算分项仍保持原值。原始来源回执没有被改写成新模拟结果。");
  if (applicationCalculation) warnings.push("目标阶段门控按原始回执中保存的用户声明阶段重新计算；这只是单击数值实验，不会重跑目标事件、附着或后续轮转。");
  return { calculation, value: calculation.value, originalDamage: original.originalRawDamage,
    ...(applicationCalculation ? { applicationValue: applicationCalculation.value,
      applicationDifference: applicationCalculation.value - original.originalDamage,
      applicationTrace: applicationCalculation.trace } : {}),
    difference: calculation.value - original.originalRawDamage, edited,
    trace: [...calculation.trace, ...(applicationCalculation?.trace ?? [])], warnings };
}

export interface SourceHostCharacterFormulaEditResult {
  originalValue: number;
  editedValue: number;
  formulaTrace: CalculationTraceNode[];
  changed: boolean;
  scope: "formula-only";
}

function calculateCharacterFormulaExperiment(capture: SourceHostHitCapture, calculationId: number, rawInput: unknown): SourceHostCharacterFormulaEditResult {
  const record = [...(capture.supportingCalculations ?? []), ...capture.components].find(row => row.request.id === calculationId);
  if (!record || (record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar" && record.request.kind !== "character-additive" && record.request.kind !== "character-flat" && record.request.kind !== "character-multiplier")) {
    throw new Error(`捕获未引用角色共享公式 #${calculationId}`);
  }
  const original = record.request.input;
  const input = record.request.kind === "character-modifier"
    ? sourceHostCharacterModifierInputSchema.parse(rawInput)
    : record.request.kind === "character-scalar" ? sourceHostCharacterScalarInputSchema.parse(rawInput)
    : record.request.kind === "character-additive" ? sourceHostCharacterAdditiveInputSchema.parse(rawInput)
    : record.request.kind === "character-flat" ? sourceHostCharacterFlatInputSchema.parse(rawInput)
    : sourceHostCharacterMultiplierInputSchema.parse(rawInput);
  if (input.ruleId !== original.ruleId || ("modifierKey" in input ? input.modifierKey : undefined) !== ("modifierKey" in original ? original.modifierKey : undefined)
    || input.sourceHolderIndex !== original.sourceHolderIndex
    || ("phase" in input ? input.phase : undefined) !== ("phase" in original ? original.phase : undefined)) {
    throw new Error("角色公式实验只能编辑本次公式的状态变量，不能替换角色、规则或创建阶段。");
  }
  const oldState: Readonly<Record<string, number>> = "state" in original ? original.state : {};
  const changedKeys = new Set(Object.entries("state" in input ? input.state : {})
    .filter(([key, value]) => value !== oldState[key]).map(([key]) => key));
  if ("priorFlatDamage" in input && "priorFlatDamage" in original && input.priorFlatDamage !== original.priorFlatDamage) changedKeys.add("priorFlatDamage");
  if ("priorMultiplier" in input && "priorMultiplier" in original && input.priorMultiplier !== original.priorMultiplier) changedKeys.add("priorMultiplier");
  const changed = changedKeys.size > 0;
  const formula = record.request.kind === "character-modifier"
    ? resolveSourceHostCharacterModifierInput(input, capture.sourceCommit, `characterExperiment.${calculationId}`)
    : record.request.kind === "character-scalar"
      ? resolveSourceHostCharacterScalarInput(input, capture.sourceCommit, `characterExperiment.${calculationId}`)
      : record.request.kind === "character-additive"
        ? resolveSourceHostCharacterAdditiveInput(input, capture.sourceCommit, `characterExperiment.${calculationId}`)
        : record.request.kind === "character-flat"
          ? resolveSourceHostCharacterFlatInput(input, capture.sourceCommit, `characterExperiment.${calculationId}`)
          : resolveSourceHostCharacterMultiplierInput(input, capture.sourceCommit, `characterExperiment.${calculationId}`);
  const formulaTrace = formula.trace.map(node => ({ ...node,
    explanationKey: `本项角色数值公式实验；后续属性、命中与原队伍状态未联动。${node.explanationKey}`,
    inputs: node.inputs.map(value => changedKeys.has(value.key)
      ? { ...value, origin: "user-edited-character-experiment", meaningKey: `${value.meaningKey}（本次独立编辑值）` } : value),
  }));
  return { originalValue: record.value, editedValue: formula.value, formulaTrace, changed, scope: "formula-only" };
}

/** A captured character clause is an editable worked calculation. Its state
 * leaves are counterfactual inputs; native triggers and downstream hits stay frozen. */
export function deriveSourceHostCharacterFormulaEdit(rawCapture: unknown, calculationId: number, rawInput: unknown): SourceHostCharacterFormulaEditResult {
  return calculateCharacterFormulaExperiment(replaySourceHostHit(rawCapture).captured, calculationId, rawInput);
}

/** Edit one source-owned arithmetic input against a frozen native trigger
 * receipt. Full-hit propagation is limited to a provably terminal addition. */
export function deriveSourceHostArtifactScalarEdit(rawCapture: unknown, calculationId: number, rawInput: unknown): SourceHostArtifactScalarEditResult {
  const capture = replaySourceHostHit(rawCapture).captured;
  const original = capture.supportingCalculations?.find(row => row.request.id === calculationId);
  if (!original || original.request.kind !== "artifact-scalar") throw new Error(`捕获未引用装备共享公式 #${calculationId}`);
  const input: SourceHostArtifactScalarInput = sourceHostArtifactScalarInputSchema.parse(rawInput);
  if (input.ruleId !== original.request.input.ruleId) throw new Error("装备独立编辑只能改变本规则的原生状态输入，不能更换原装备规则。");
  const formula = resolveSourceHostArtifactScalarInput(input, capture.sourceCommit, `artifactScalar.${calculationId}`);
  const changedInput = JSON.stringify(input) !== JSON.stringify(original.request.input);
  const experimentTrace = (nodes: CalculationTraceNode[]): CalculationTraceNode[] => changedInput ? nodes.map(node => ({ ...node,
    explanationKey: `独立装备公式实验；编辑输入没有重新触发或改写来源原生状态。${node.explanationKey}`,
    inputs: node.inputs.map(value => value.origin === "source-host-native-state"
      ? { ...value, origin: "user-edited-artifact-experiment", meaningKey: `${value.meaningKey}（本次独立编辑值）` } : value),
  })) : nodes;
  const common = { originalValue: original.value, editedValue: formula.value, formulaTrace: experimentTrace(formula.trace), originalRawDamage: capture.application.rawDamage };
  const block = (reason: string) => ({ status: "blocked" as const, ...common, reason });
  const request: SourceHostOutgoingRequest = structuredClone(capture.calculation.request);
  const supporting = supportingMap(capture.supportingCalculations ?? [], capture.sourceCommit);
  supporting.set(calculationId, { request: { ...original.request, input }, value: formula.value });
  const components = componentMap(capture.components, supporting);
  if (formula.value === original.value) {
    const calculation = resolveSourceHostRequest(request, components);
    return { status: "calculated", ...common, editedRawDamage: calculation.value, editedRequest: request, calculation };
  }
  if (capture.components.some(row => sourceHostArtifactSupportIds(row.request).includes(calculationId))) return block("此装备贡献属于前置反应组件；后续排名、应用或快照可能改变，不能只平移终端命中。");
  const refs = sourceHostArtifactSupportRefs(request).filter(ref => ref.ids.includes(calculationId));
  if (refs.length !== 1 || refs[0]!.ids.length !== 1) return block("本装备公式未唯一对应一个来源 modifier 返回项，无法确定独立编辑的作用位置。");
  const ref = refs[0]!;
  const difference = formula.value - original.value;
  if (ref.kind === "scalar" && (input.ruleId === "cw-4pc-reaction" || isSourceHostArtifactDynamicRuleId(input.ruleId) && sourceHostArtifactRuleStatIndex(input.ruleId) === undefined)) {
    const read = request.scalarProvenance?.reads.find(row => row.id === ref.readId);
    const step = read?.steps[ref.index];
    if (!read || read.kind !== "reaction-bonus" || !step || ref.index !== read.steps.length - 1 || read.transforms.length || step.delta !== original.value || step.after !== read.sum || read.sum !== read.output) return block("反应加成后仍有不透明 modifier 或边界转换，不能安全传播编辑值。");
    if (request.kind !== "damage" && request.kind !== "lunar-direct" && request.kind !== "lunar-delivery") return block("该反应加成的终端伤害路径暂未建立可编辑映射。");
    step.delta = formula.value;
    step.after += difference;
    read.sum += difference;
    read.output += difference;
    request.input.reactionBonus += difference;
  } else if (ref.kind === "stat" && request.kind === "damage") {
    const slot = sourceHostArtifactRuleStatIndex(input.ruleId);
    if (slot !== 21) return block("此属性需要重新推导快照缩放、暴击或元素面板；当前只允许终端通用增伤的透明加法传播。");
    const provenance = sourceHostStatProvenanceSchema.parse(request.snapshot.statProvenance);
    const read = provenance.attackReads.at(-1);
    const step = read?.steps[ref.index];
    if (!read || read.id !== ref.readId || !step || ref.index !== read.steps.length - 1 || step.outcome !== "applied" || step.returned === null || step.returned[slot] !== original.value
      || step.afterAmount[slot] !== step.before[slot] || step.after[slot] !== read.result[slot]
      || read.result[slot] !== provenance.finalStats[slot] || request.snapshotStats[slot] !== provenance.finalStats[slot]) {
      return block("此装备项之后仍有 modifier、直接修改或快照边界，无法证明最终通用增伤可按差值传播。");
    }
    step.returned[slot] = formula.value;
    step.after[slot] = step.after[slot]! + difference;
    read.result[slot] = read.result[slot]! + difference;
    provenance.finalStats[slot] = provenance.finalStats[slot]! + difference;
    request.snapshotStats[slot] = request.snapshotStats[slot]! + difference;
    request.snapshot.statProvenance = provenance;
    request.input.damageBonus += difference;
  } else return block("该来源属性路径仍经过未展开的状态、属性转换或非线性公式，不能从单个装备标量安全重算完整命中。");
  const calculation = resolveSourceHostRequest(request, components, { explicitFinalScaling: true });
  if (changedInput) {
    calculation.trace = calculation.trace.map(node => node.id.startsWith(`artifactScalar.${calculationId}.`)
      ? experimentTrace([node])[0]! : node);
    calculation.explanationGaps.unshift("此为固定原始来源触发回执上的独立状态数值实验；原始 capture 与 Go 状态历史未被改写。");
  }
  return { status: "calculated", ...common, editedRawDamage: calculation.value, editedRequest: request, calculation };
}
