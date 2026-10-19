/** One actual Go energy application, replayed without a second combat run. */
import { z } from "zod";
import { sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import { resolveSourceHostRequest } from "./source-host-formula";
import { resolveSourceHostEnergyInput, sourceHostEnergyInputSchema, type SourceHostEnergyInput, type SourceHostParticleAmountInput } from "./source-host-energy-formula";
import { expr, TraceBuilder, traceInput } from "./calculation-trace";
import type { CalculationTraceNode } from "./calculation-trace";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION,
  assertSourceHostStartupState,
  sourceHostArtifactSchema, sourceHostCommitSchema, sourceHostCalculationRecordSchema,
  sourceHostEnergyApplicationSchema, sourceHostEnergyRequestSchema,
  sourceHostInitialEnergySchema, sourceHostResultSchema, sourceHostStartupStateSchema,
  type SourceHostCalculationRecord, type SourceHostEnergyApplication,
} from "./source-host-wire";

export const SOURCE_HOST_ENERGY_CAPTURE_VERSION = "source-host-energy-v1" as const;
export const SOURCE_HOST_ENERGY_CALCULATOR_VERSION = "source-host-energy-calculator-v1" as const;
const energyRecord = z.object({ request: sourceHostEnergyRequestSchema, value: z.number().finite() }).strict();
export const sourceHostEnergyCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_ENERGY_CAPTURE_VERSION),
  formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION),
  executionArtifact: sourceHostArtifactSchema.optional(),
  sourceCommit: sourceHostCommitSchema, sourceConfig: z.string(), seed: z.string(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  application: sourceHostEnergyApplicationSchema,
  calculation: energyRecord,
  components: z.array(energyRecord),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostEnergyCapture = z.infer<typeof sourceHostEnergyCaptureSchema>;
export interface SourceHostEnergyReplay {
  captured: SourceHostEnergyCapture;
  request: SourceHostEnergyCapture["calculation"]["request"];
  trace: CalculationTraceNode[];
  originalEnergy: number;
  reproducedEnergy: number;
  difference: number;
  requestedAmount: number;
  actualChange: number;
  overflow: number;
  warnings: string[];
}

function exact(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`来源能量 ${label} 无法精确复现：${actual} / ${expected}`);
}
function operationAmount(input: SourceHostEnergyInput): number {
  if (input.operation === "particle-amount") throw new Error("粒子金额不是已应用角色能量。");
  return input.amount;
}
function energyBoundaryTrace(sourceCommit: string, prefix: string, operation: SourceHostEnergyApplication["operation"],
  before: number, after: number, requested: number, origin: string) {
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/pkg/core/player/character/energy.go`]);
  const actualChange = builder.add(`${prefix}.actualChange`, "本次实际能量变化",
    expr.sub(expr.input("energyAfter"), expr.input("energyBefore")), [
      traceInput("energyAfter", after, "energy", origin, "本次公式执行后的角色能量"),
      traceInput("energyBefore", before, "energy", origin, "本次操作前的角色能量"),
    ], { unit: "energy", explanationKey: "用后值减前值，显示上限或下限截断后的实际变化。" });
  const overflow = builder.add(`${prefix}.overflow`, "本次未入账的正向能量",
    operation === "consume" ? expr.value(0)
      : expr.max(expr.sub(expr.input("requestedAmount"), expr.input("actualChange")), expr.value(0)),
    operation === "consume" ? [] : [
      traceInput("requestedAmount", requested, "energy", origin, "本次请求的能量变化量"),
      traceInput("actualChange", actualChange, "energy", { kind: "shared-core-execution", reference: `${prefix}.actualChange` }, "前后值求得的实际能量变化"),
    ], { unit: "energy", childIds: operation === "consume" ? [] : [`${prefix}.actualChange`],
      explanationKey: operation === "consume" ? "消耗不是正向获能，不计算溢出。" : "正向请求超过实际入账的部分按 0 截断；负向变化不计为溢出。" });
  return { actualChange, overflow, trace: builder.nodes };
}
function checkIdentity(application: SourceHostEnergyApplication, record: SourceHostCalculationRecord): void {
  const request = record.request;
  if (request.kind !== "character-energy" || request.input.operation === "particle-amount"
    || request.id !== application.calculationId || request.frame !== application.frame
    || request.actorIndex !== application.actorIndex || request.actorKey !== application.actorKey
    || request.ability !== application.source || request.input.operation !== application.operation) {
    throw new Error(`来源能量应用 #${application.id} 与终端共享公式身份不一致。`);
  }
  exact(request.input.energyBefore, application.energyBefore, "energyBefore");
  exact(request.input.energyMax, application.energyMax, "energyMax");
  exact(operationAmount(request.input), application.requestedAmount, "requestedAmount");
}

/** Used by whole-run normalization and by standalone capture replay. */
export function verifySourceHostEnergyApplication(
  application: SourceHostEnergyApplication,
  records: ReadonlyMap<number, SourceHostCalculationRecord>,
): void {
  const terminal = records.get(application.calculationId);
  if (!terminal) throw new Error(`来源能量应用 #${application.id} 缺少共享公式回调。`);
  checkIdentity(application, terminal);
  const request = terminal.request;
  if (request.kind !== "character-energy" || request.input.operation === "particle-amount") throw new Error("来源能量终端请求类型错误。");
  if (request.input.operation === "particle-apply") {
    const id = application.amountCalculationId;
    if (id === undefined || request.componentIds.length !== 1 || request.componentIds[0] !== id)
      throw new Error("粒子入账未引用本次前置粒子金额。");
    const amount = records.get(id);
    if (!amount || amount.request.kind !== "character-energy" || amount.request.input.operation !== "particle-amount"
      || id >= request.id || amount.request.frame !== request.frame || amount.request.actorIndex !== request.actorIndex
      || amount.request.actorKey !== request.actorKey || amount.request.ability !== request.ability
      || amount.request.element !== request.element || amount.request.sourceCommit !== request.sourceCommit)
      throw new Error("粒子入账与前置粒子金额的来源身份不一致。");
    const amountReplay = resolveSourceHostRequest(amount.request, records);
    exact(amountReplay.value, amount.value, `particle amount #${id}`);
    exact(amount.value, request.input.amount, "particle applied amount");
  } else if (application.amountCalculationId !== undefined || request.componentIds.length) {
    throw new Error("非粒子能量应用不应包含前置粒子金额。");
  }
  const replay = resolveSourceHostRequest(request, records);
  exact(replay.value, terminal.value, `calculation #${request.id}`);
  exact(replay.value, application.energyAfter, `application #${application.id}`);
}

function supportRecords(records: readonly SourceHostCalculationRecord[], sourceCommit: string): Map<number, SourceHostCalculationRecord> {
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const record of records) {
    if (map.has(record.request.id) || (record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar") || record.request.componentIds.length
      || (record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== sourceCommit)
      throw new Error("能量捕获包含重复或无关的装备支持计算。");
    const expected = resolveSourceHostRequest(record.request, map);
    exact(expected.value, record.value, `modifier support #${record.request.id}`);
    map.set(record.request.id, record);
  }
  return map;
}

/** A legacy run without native energy applications cannot claim an observed receipt. */
export function captureSourceHostEnergy(rawResult: unknown, applicationId: number): SourceHostEnergyCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  if (!result.energyApplications) throw new Error("此来源运行没有原生能量应用记录，不能捕获能量事件。");
  const application = result.energyApplications.find(row => row.id === applicationId);
  if (!application) throw new Error(`来源运行不存在实际能量应用 #${applicationId}。`);
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  if (byId.size !== result.calculations.length) throw new Error("来源计算 ID 重复。");
  const calculation = byId.get(application.calculationId);
  if (!calculation || calculation.request.kind !== "character-energy") throw new Error("实际能量应用缺少共享公式终端记录。");
  const components = calculation.request.componentIds.map(id => {
    const record = byId.get(id);
    if (!record || record.request.kind !== "character-energy" || record.request.input.operation !== "particle-amount")
      throw new Error(`能量应用缺少实际前置粒子金额 #${id}。`);
    return record;
  });
  const supportingIds = sourceHostArtifactSupportClosureIds([calculation, ...components].map(row => row.request), byId);
  const supportingCalculations = supportingIds.map(id => {
    const record = byId.get(id);
    if (!record || (record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar")) throw new Error(`能量应用缺少本次充能读取的共享公式 #${id}。`);
    return record;
  });
  return replaySourceHostEnergy({
    schemaVersion: SOURCE_HOST_ENERGY_CAPTURE_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    application, calculation, components,
    ...(supportingCalculations.length ? { supportingCalculations } : {}),
  }).captured;
}

/** Reproduce the original application and its observed upstream ER read. */
export function replaySourceHostEnergy(raw: unknown): SourceHostEnergyReplay {
  const captured = sourceHostEnergyCaptureSchema.parse(raw);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const all = [captured.calculation, ...captured.components];
  if (all.some(row => (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit))
    throw new Error("能量捕获混合了不同固定源码版本。");
  const supporting = supportRecords(captured.supportingCalculations ?? [], captured.sourceCommit);
  const required = new Set(sourceHostArtifactSupportClosureIds(all.map(row => row.request), supporting));
  if (required.size !== supporting.size || [...required].some(id => !supporting.has(id)))
    throw new Error("能量捕获缺少原充能读取所消费的修饰器公式，或混入无关记录。");
  const map = new Map<number, SourceHostCalculationRecord>(supporting);
  for (const component of captured.components) {
    if (map.has(component.request.id) || component.request.id >= captured.calculation.request.id)
      throw new Error("前置能量金额必须具有唯一且先于终端的计算 ID。");
    map.set(component.request.id, component);
  }
  if (map.has(captured.calculation.request.id)) throw new Error("能量终端计算 ID 重复。");
  map.set(captured.calculation.request.id, captured.calculation);
  const expectedComponents = captured.calculation.request.componentIds;
  if (expectedComponents.length !== captured.components.length
    || captured.components.some((row, index) => row.request.id !== expectedComponents[index]))
    throw new Error("能量捕获的前置金额与原始组件列表不一致。");
  verifySourceHostEnergyApplication(captured.application, map);
  const calculation = resolveSourceHostRequest(captured.calculation.request, map);
  const boundary = energyBoundaryTrace(captured.sourceCommit, `energy.${captured.application.id}.boundary`,
    captured.application.operation, captured.application.energyBefore, calculation.value,
    captured.application.requestedAmount, "source-host-observed-energy-application");
  return { captured, request: captured.calculation.request, trace: [...calculation.trace, ...boundary.trace],
    originalEnergy: captured.application.energyAfter, reproducedEnergy: calculation.value,
    difference: calculation.value - captured.application.energyAfter,
    requestedAmount: captured.application.requestedAmount, actualChange: boundary.actualChange,
    overflow: boundary.overflow,
    warnings: calculation.explanationGaps };
}

export const sourceHostEnergyEditableSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_ENERGY_CALCULATOR_VERSION), label: z.string(),
  originalCapture: sourceHostEnergyCaptureSchema,
  input: sourceHostEnergyInputSchema,
  particleInput: sourceHostEnergyInputSchema.optional(),
}).strict();
export type SourceHostEnergyEditable = z.infer<typeof sourceHostEnergyEditableSchema>;
export interface SourceHostEnergyEditedResult {
  status: "calculated";
  originalCapture: SourceHostEnergyCapture;
  originalEnergy: number;
  value: number;
  difference: number;
  requestedAmount: number;
  actualChange: number;
  overflow: number;
  editedInput: Exclude<SourceHostEnergyInput, { operation: "particle-amount" }>;
  trace: CalculationTraceNode[];
  warnings: string[];
}

export function createSourceHostEnergyEditable(raw: unknown): SourceHostEnergyEditable {
  const originalCapture = replaySourceHostEnergy(raw).captured;
  const particle = originalCapture.components[0]?.request.input;
  return sourceHostEnergyEditableSchema.parse({
    schemaVersion: SOURCE_HOST_ENERGY_CALCULATOR_VERSION,
    label: `${originalCapture.application.source} · frame ${originalCapture.application.frame}`,
    originalCapture, input: originalCapture.calculation.request.input,
    ...(particle ? { particleInput: particle } : {}),
  });
}

/** Counterfactual arithmetic: the original Go receipt and statRead stay intact. */
export function calculateSourceHostEnergyEditable(raw: unknown): SourceHostEnergyEditedResult {
  const editable = sourceHostEnergyEditableSchema.parse(raw);
  const original = replaySourceHostEnergy(editable.originalCapture);
  const terminalOriginal = original.captured.calculation.request.input;
  if (terminalOriginal.operation === "particle-amount" || editable.input.operation !== terminalOriginal.operation)
    throw new Error("独立能量实验不能更换原始操作类型。");
  if (terminalOriginal.operation === "flat-change" && editable.input.operation === "flat-change"
    && editable.input.artifactRule !== terminalOriginal.artifactRule)
    throw new Error("独立能量实验不能更换原始圣遗物固定规则。");
  if (terminalOriginal.operation !== "particle-apply" && editable.particleInput !== undefined)
    throw new Error("非粒子能量实验不能附带粒子金额输入。");
  let editedInput: Exclude<SourceHostEnergyInput, { operation: "particle-amount" }> = editable.input as Exclude<SourceHostEnergyInput, { operation: "particle-amount" }>;
  const trace: CalculationTraceNode[] = [];
  const warnings: string[] = [];
  if (terminalOriginal.operation === "particle-apply") {
    if (editable.particleInput?.operation !== "particle-amount") throw new Error("粒子实验缺少原生金额公式的可编辑输入。");
    const particleInput: SourceHostParticleAmountInput = editable.particleInput;
    const pureAmount = resolveSourceHostEnergyInput(particleInput, original.captured.sourceCommit, "energyEdit.particle");
    editedInput = { ...editedInput, amount: pureAmount.value } as typeof editedInput;
    trace.push(...pureAmount.trace.map(node => ({ ...node, inputs: node.inputs.map(input => ({ ...input,
      origin: "user-edited-energy-experiment" })) })));
    warnings.push(...pureAmount.explanationGaps);
  }
  const pure = resolveSourceHostEnergyInput(editedInput, original.captured.sourceCommit, "energyEdit.terminal");
  trace.push(...pure.trace.map(node => ({ ...node, inputs: node.inputs.map(input => ({ ...input,
    origin: editedInput.operation === "particle-apply" && input.key === "amount"
      ? { kind: "user-edited-energy-amount", reference: "energyEdit.particle.amount" }
      : "user-edited-energy-experiment" })) })));
  warnings.push(...pure.explanationGaps, "独立实验只重算已捕获的数值操作；不表示 Go 重新运行队伍、触发条件或属性读取。");
  const boundary = energyBoundaryTrace(original.captured.sourceCommit, "energyEdit.boundary",
    editedInput.operation, editedInput.energyBefore, pure.value, editedInput.amount, "user-edited-energy-experiment");
  trace.push(...boundary.trace);
  return { status: "calculated", originalCapture: original.captured, originalEnergy: original.originalEnergy,
    value: pure.value, difference: pure.value - original.originalEnergy,
    requestedAmount: editedInput.amount, actualChange: boundary.actualChange,
    overflow: boundary.overflow,
    editedInput, trace, warnings };
}
