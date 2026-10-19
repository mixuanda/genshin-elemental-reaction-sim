/** A player hit carries the actual shared shield/Drain state calculations. */
import { z } from "zod";
import { resolveSourceHostRequest, type SourceHostCalculation } from "./source-host-formula";
import { sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, assertSourceHostStartupState,
  sourceHostInitialEnergySchema, sourceHostStartupStateSchema, sourceHostArtifactSchema, sourceHostCommitSchema,
  sourceHostCalculationRecordSchema, sourceHostPlayerApplicationSchema,
  sourceHostPlayerIncomingRequestSchema, sourceHostPlayerManualIncomingRequestSchema, sourceHostResultSchema,
  type SourceHostCalculationRecord, type SourceHostPlayerIncomingRequest,
} from "./source-host-wire";

export const SOURCE_HOST_INCOMING_CAPTURE_VERSION = "source-host-player-incoming-v1" as const;
export const SOURCE_HOST_INCOMING_CALCULATOR_VERSION = "source-host-player-incoming-calculator-v1" as const;
const calculationSchema = z.object({ request: z.union([sourceHostPlayerIncomingRequestSchema,
  sourceHostPlayerManualIncomingRequestSchema]), value: z.number().finite() }).strict();
export const sourceHostPlayerIncomingCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_INCOMING_CAPTURE_VERSION),
  formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION), sourceCommit: sourceHostCommitSchema,
  sourceConfig: z.string(), seed: z.string(), executionArtifact: sourceHostArtifactSchema.optional(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  application: sourceHostPlayerApplicationSchema, calculation: calculationSchema,
  components: z.array(sourceHostCalculationRecordSchema),
  stateCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
  shieldSources: z.array(sourceHostCalculationRecordSchema).optional(),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostPlayerIncomingCapture = z.infer<typeof sourceHostPlayerIncomingCaptureSchema>;
export const sourceHostPlayerIncomingEditableSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_INCOMING_CALCULATOR_VERSION), label: z.string(),
  originalCapture: sourceHostPlayerIncomingCaptureSchema,
  request: sourceHostPlayerIncomingRequestSchema,
}).strict();
export type SourceHostPlayerIncomingEditable = z.infer<typeof sourceHostPlayerIncomingEditableSchema>;

function exact(actual: number, expected: number, field: string): void {
  if (actual !== expected) throw new Error(`来源玩家受击 ${field} 无法精确复现：${actual} / ${expected}`);
}
function componentMap(records: readonly SourceHostCalculationRecord[], supporting: ReadonlyMap<number, SourceHostCalculationRecord> = new Map(),
  manualHistory = false): Map<number, SourceHostCalculationRecord> {
  const map = new Map<number, SourceHostCalculationRecord>(supporting);
  for (const record of records) {
    const request = record.request;
    if (request.kind === "artifact-scalar" || request.kind === "character-modifier" || request.kind === "character-scalar" ||
      !manualHistory && (request.kind === "player-incoming" || request.kind === "player-shield" || request.kind === "player-shield-min" || request.kind === "player-drain") ||
      request.kind === "lunar-bloom-event" || map.has(request.id)
      || request.componentIds.some(id => id >= request.id || !map.has(id))) {
      throw new Error("来源玩家受击的前置组件顺序、身份或类型无效。");
    }
    exact(resolveSourceHostRequest(request, map).value, record.value, `component #${request.id}`);
    map.set(request.id, record);
  }
  return map;
}
function supportingMap(records: readonly SourceHostCalculationRecord[], sourceCommit: string) {
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const row of records) {
    if ((row.request.kind !== "artifact-scalar" && row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar") || map.has(row.request.id) || row.request.componentIds.length || (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== sourceCommit) throw new Error("玩家受击的修饰器支持记录无效。");
    exact(resolveSourceHostRequest(row.request, map).value, row.value, `modifier support #${row.request.id}`);
    map.set(row.request.id, row);
  }
  return map;
}

/** Save one actual player hit, including every referenced prior calculation. */
export function captureSourceHostPlayerIncoming(rawResult: unknown, applicationId: number): SourceHostPlayerIncomingCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  assertSourceHostStartupState(result.initialEnergy, result.startupState);
  const application = result.playerApplications?.find(row => row.id === applicationId);
  if (!application) throw new Error(`来源运行不存在玩家受击 #${applicationId}。`);
  const calculation = result.calculations.find(row => row.request.id === application.calculationId);
  if (calculation?.request.kind !== "player-incoming" && calculation?.request.kind !== "player-manual-incoming")
    throw new Error("来源玩家受击缺少共享公式上下文。");
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  const required = new Set<number>();
  const include = (id: number, parentId: number): void => {
    if (id >= parentId) throw new Error("来源玩家受击引用了非前置组件。");
    if (required.has(id)) return;
    const row = byId.get(id);
    if (!row) throw new Error(`来源玩家受击缺少前置组件 #${id}。`);
    required.add(id);
    row.request.componentIds.forEach(child => include(child, id));
  };
  calculation.request.componentIds.forEach(id => include(id, calculation.request.id));
  const components = [...required].sort((a, b) => a - b).map(id => byId.get(id)!);
  const stepIds = [...(application.shieldCalculationIds ?? []), ...(application.drainCalculationId == null ? [] : [application.drainCalculationId])];
  if (new Set(stepIds).size !== stepIds.length || stepIds.some(id => id <= calculation.request.id)) {
    throw new Error("玩家受击盾与生命步骤 ID 无效。");
  }
  const stateCalculations = stepIds.map(id => {
    const row = byId.get(id);
    if (!row) throw new Error(`来源玩家受击缺少状态步骤 #${id}。`);
    return row;
  });
  const directStateIds = new Set(stepIds);
  const sourceIds = new Set<number>();
  const includeShieldSource = (id: number, parentId: number): void => {
    if (directStateIds.has(id) || id === calculation.request.id) return;
    const row = byId.get(id);
    if (!row || id >= parentId)
      throw new Error(`玩家受击护盾缺少创建、刷新或先前消耗来源 #${id}。`);
    if (sourceIds.has(id)) return;
    sourceIds.add(id);
    row.request.componentIds.forEach(child => includeShieldSource(child, id));
  };
  stateCalculations.forEach(row => row.request.componentIds.forEach(id => includeShieldSource(id, row.request.id)));
  const shieldSources = [...sourceIds].sort((a, b) => a - b).map(id => byId.get(id)!);
  const supportIds = sourceHostArtifactSupportClosureIds([calculation, ...components, ...shieldSources, ...stateCalculations].map(row => row.request), byId)
    .filter(id => !required.has(id) && !sourceIds.has(id));
  const supportingCalculations = supportIds.map(id => {
    const row = byId.get(id);
    if (!row || (row.request.kind !== "artifact-scalar" && row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar")) throw new Error(`来源玩家受击缺少修饰器共享公式 #${id}。`);
    return row;
  });
  return replaySourceHostPlayerIncoming({
    schemaVersion: SOURCE_HOST_INCOMING_CAPTURE_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    application, calculation, components, ...(supportingCalculations.length ? { supportingCalculations } : {}),
    ...(shieldSources.length ? { shieldSources } : {}),
    ...(application.shieldCalculationIds !== undefined && application.drainCalculationId !== undefined ? { stateCalculations } : {}),
  }).captured;
}

/** Replays the pre-shield formula; later native effects stay saved observations. */
export function replaySourceHostPlayerIncoming(raw: unknown): {
  captured: SourceHostPlayerIncomingCapture; calculation: SourceHostCalculation;
  stateCalculations: SourceHostCalculation[];
  stateArithmeticProvenance: "shared" | "unavailable";
  originalRawDamage: number; reproducedRawDamage: number; difference: number;
} {
  const captured = sourceHostPlayerIncomingCaptureSchema.parse(raw);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const { application, calculation } = captured;
  const request = calculation.request;
  const manual = request.kind === "player-manual-incoming";
  if ((request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit
    || (captured.stateCalculations ?? []).some(row => (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
    || captured.components.some(row => (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
    || (captured.shieldSources ?? []).some(row => (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
    || (captured.supportingCalculations ?? []).some(row => (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)) {
    throw new Error("来源玩家受击、护盾和生命步骤源码身份不一致。");
  }
  if (application.calculationId !== request.id || application.attackId !== request.attackId
    || application.targetKey !== request.targetKey || application.isCrit !== (request.kind === "player-incoming" ? request.input.isCrit : false)) {
    throw new Error("来源玩家受击回执与公式请求身份不一致。");
  }
  const supporting = supportingMap(captured.supportingCalculations ?? [], captured.sourceCommit);
  const capturedComponentIds = new Set(captured.components.map(row => row.request.id));
  const capturedShieldSourceIds = new Set((captured.shieldSources ?? []).map(row => row.request.id));
  const requiredSupport = new Set(sourceHostArtifactSupportClosureIds([calculation, ...captured.components,
    ...(captured.shieldSources ?? []), ...(captured.stateCalculations ?? [])].map(row => row.request),
    new Map([...supporting, ...captured.components.map(row => [row.request.id, row] as const),
      ...(captured.shieldSources ?? []).map(row => [row.request.id, row] as const)]))
    .filter(id => !capturedComponentIds.has(id) && !capturedShieldSourceIds.has(id)));
  if (requiredSupport.size !== supporting.size || [...requiredSupport].some(id => !supporting.has(id))) throw new Error("玩家受击缺少实际装备支持计算，或混入无关记录。");
  const components = componentMap(captured.components, supporting, manual);
  const needed = new Set<number>();
  const requireComponent = (id: number, parentId: number): void => {
    const row = components.get(id);
    if (!row || id >= parentId) throw new Error("来源玩家受击缺少实际前置组件。");
    if (needed.has(id)) return;
    needed.add(id);
    row.request.componentIds.forEach(child => requireComponent(child, id));
  };
  request.componentIds.forEach(id => requireComponent(id, request.id));
  if (needed.size !== captured.components.length) throw new Error("来源玩家受击混入了未使用的前置组件。");
  const resolved = resolveSourceHostRequest(request, components);
  exact(resolved.value, calculation.value, "calculation value");
  exact(resolved.value, application.rawDamage, "raw damage");
  exact(application.rawDamage - application.damageAfterShield, application.shieldAbsorbed, "shield absorbed");
  const hasSharedState = application.shieldCalculationIds !== undefined && application.drainCalculationId !== undefined
    && captured.stateCalculations !== undefined;
  const hasLegacyState = application.shieldCalculationIds === undefined && application.drainCalculationId === undefined
    && captured.stateCalculations === undefined;
  if (!hasSharedState && !hasLegacyState) throw new Error("玩家受击状态步骤仅保存了部分字段，不能作为完整来源回执。");
  if (hasLegacyState) return { captured, calculation: resolved, stateCalculations: [], stateArithmeticProvenance: "unavailable",
    originalRawDamage: application.rawDamage, reproducedRawDamage: resolved.value,
    difference: resolved.value - application.rawDamage };
  const stateRecords = captured.stateCalculations!;
  const shieldIds = application.shieldCalculationIds!;
  const drainId = application.drainCalculationId!;
  const stepIds = [...shieldIds, ...(drainId === null ? [] : [drainId])];
  if (new Set(stepIds).size !== stepIds.length || stepIds.length !== stateRecords.length
    || stepIds.some((id, i) => id !== stateRecords[i]?.request.id || id <= request.id)) {
    throw new Error("玩家受击的状态步骤与实际应用回执不一致。");
  }
  const replayMap = new Map(components);
  replayMap.set(request.id, calculation);
  const directStateIds = new Set(stepIds);
  const shieldSources = captured.shieldSources ?? [];
  const bySourceId = new Map(shieldSources.map(row => [row.request.id, row]));
  if (bySourceId.size !== shieldSources.length) throw new Error("玩家受击护盾 HP 来源 ID 重复。");
  const neededSources = new Set<number>();
  const requireShieldSource = (id: number, parentId: number): void => {
    if (directStateIds.has(id) || id === calculation.request.id) return;
    const row = bySourceId.get(id);
    if (!row || id >= parentId)
      throw new Error(`玩家受击缺少护盾 HP 来源 #${id}。`);
    if (neededSources.has(id)) return;
    neededSources.add(id);
    row.request.componentIds.forEach(child => requireShieldSource(child, id));
  };
  stateRecords.forEach(row => row.request.componentIds.forEach(id => requireShieldSource(id, row.request.id)));
  if (neededSources.size !== shieldSources.length) throw new Error("玩家受击护盾来源混入无关公式。");
  for (const row of shieldSources) {
    if (replayMap.has(row.request.id) || row.request.componentIds.some(id => !replayMap.has(id)))
      throw new Error("玩家受击护盾来源未按实际先后顺序保存。");
    const resolved = resolveSourceHostRequest(row.request, replayMap);
    exact(resolved.value, row.value, `shield source #${row.request.id}`);
    replayMap.set(row.request.id, row);
  }
  const stateCalculations: SourceHostCalculation[] = [];
  let minimum = application.rawDamage;
  for (const record of stateRecords) {
    const step = record.request;
    if (step.attackId !== application.attackId || step.frame !== application.frame
      || (step.kind !== "player-shield" && step.kind !== "player-shield-min" && step.kind !== "player-drain")) {
      throw new Error("玩家受击状态步骤身份不一致。");
    }
    if ((step.kind === "player-shield" || step.kind === "player-shield-min") && !shieldIds.includes(step.id)) throw new Error("玩家护盾步骤未被应用回执引用。");
    if (step.kind === "player-drain" && step.id !== drainId) throw new Error("玩家 Drain 步骤未被应用回执引用。");
    const replayed = resolveSourceHostRequest(step, replayMap);
    exact(replayed.value, record.value, `state #${step.id}`);
    if (step.kind === "player-shield-min") {
      exact(step.input.currentMinimum, minimum, "previous shield minimum");
      minimum = replayed.value;
    }
    if (step.kind === "player-drain") exact(step.input.amount, application.drainAttempted, "drain amount");
    replayMap.set(step.id, record);
    stateCalculations.push(replayed);
  }
  exact(minimum, application.damageAfterShield, "damage after shields");
  if ((application.damageAfterShield > 0) !== (drainId !== null)) throw new Error("玩家 Drain 分支与护盾后伤害不一致。");
  if (shieldIds.length % 3 !== 0) throw new Error("玩家护盾共享步骤必须成组。");
  for (let i = 0; i < shieldIds.length; i += 3) {
    const hp = stateRecords[i]?.request;
    const taken = stateRecords[i + 1]?.request;
    const minimumStep = stateRecords[i + 2]?.request;
    if (hp?.kind !== "player-shield" || hp.input.output !== "hpAfter"
      || taken?.kind !== "player-shield" || taken.input.output !== "damageAfter"
      || minimumStep?.kind !== "player-shield-min") throw new Error("玩家护盾步骤顺序无效。");
  }
  return { captured, calculation: resolved, stateCalculations, stateArithmeticProvenance: "shared", originalRawDamage: application.rawDamage,
    reproducedRawDamage: resolved.value, difference: resolved.value - application.rawDamage };
}

export function createSourceHostPlayerIncomingEditable(rawCapture: unknown): SourceHostPlayerIncomingEditable {
  const capture = replaySourceHostPlayerIncoming(rawCapture).captured;
  if (capture.calculation.request.kind !== "player-incoming")
    throw new Error("手工玩家自伤不经过普通防御、抗性或暴击计算；请编辑 Drain 来源公式。");
  return sourceHostPlayerIncomingEditableSchema.parse({
    schemaVersion: SOURCE_HOST_INCOMING_CALCULATOR_VERSION,
    label: `${capture.calculation.request.actorKey} · ${capture.calculation.request.ability} · 玩家受击 #${capture.application.id}`,
    originalCapture: capture, request: structuredClone(capture.calculation.request),
  });
}

export function calculateSourceHostPlayerIncomingEditable(raw: unknown): {
  value: number; difference: number; edited: boolean; calculation: SourceHostCalculation; warnings: string[];
} {
  const document = sourceHostPlayerIncomingEditableSchema.parse(raw);
  const original = replaySourceHostPlayerIncoming(document.originalCapture);
  const request: SourceHostPlayerIncomingRequest = structuredClone(document.request);
  const saved = document.originalCapture.calculation.request;
  if (saved.kind !== "player-incoming") throw new Error("手工玩家自伤不能进入普通受击编辑器。");
  if (request.id !== saved.id || request.attackId !== saved.attackId || request.targetKey !== saved.targetKey
    || request.sourceCommit !== saved.sourceCommit
    || JSON.stringify(request.componentIds) !== JSON.stringify(saved.componentIds)) throw new Error("独立编辑不能更换原受击身份或前置组件。");
  const edited = JSON.stringify(request) !== JSON.stringify(saved);
  // The same draw is compared with the edited rate. No random call or source run occurs.
  if (request.input.critRoll !== saved.input.critRoll || request.input.hitWeakPoint !== saved.input.hitWeakPoint) {
    throw new Error("独立编辑须保留来源的实际随机抽样和弱点条件。");
  }
  if (edited) request.input.isCrit = request.input.hitWeakPoint ||
    (request.input.critRoll !== null && request.input.critRoll <= Math.max(0, Math.min(1, request.input.critRate)));
  const supporting = supportingMap(document.originalCapture.supportingCalculations ?? [], document.originalCapture.sourceCommit);
  const components = componentMap(document.originalCapture.components, supporting);
  const calculation = resolveSourceHostRequest(request, components, { explicitFinalScaling: edited });
  return { value: calculation.value, difference: calculation.value - original.originalRawDamage,
    edited, calculation, warnings: [
      ...(original.stateArithmeticProvenance === "unavailable" ? ["旧版来源捕获未保存护盾与生命共享公式上下文；只可复现护盾前伤害，护盾吸收和 Drain 数值仍是历史回执。"] : []),
      ...(edited ? ["编辑后的数值只重算进入护盾前的公式，沿用原抽样；不会重跑队伍、护盾或玩家生命。下方来源护盾与 Drain 回执仍属于原运行。"] : []),
      ...calculation.explanationGaps,
    ] };
}

export function parseSourceHostPlayerIncoming(json: string): SourceHostPlayerIncomingCapture {
  return replaySourceHostPlayerIncoming(JSON.parse(json) as unknown).captured;
}
