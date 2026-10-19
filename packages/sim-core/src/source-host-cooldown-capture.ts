/** One native cooldown calculation, replayed without rerunning the Go host. */
import { z } from "zod";
import type { CalculationTraceNode } from "./calculation-trace";
import { resolveSourceHostCooldownInput, sourceHostCooldownInputSchema, type SourceHostCooldownInput } from "./source-host-cooldown-formula";
import { sourceHostCooldownParentIds } from "./source-host-cooldown-request";
import { resolveSourceHostRequest } from "./source-host-formula";
import { sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, assertSourceHostStartupState,
  sourceHostArtifactSchema, sourceHostCooldownRequestSchema, sourceHostCommitSchema,
  sourceHostInitialEnergySchema, sourceHostResultSchema, sourceHostStartupStateSchema,
  sourceHostCalculationRecordSchema, type SourceHostCalculationRecord,
} from "./source-host-wire";

export const SOURCE_HOST_COOLDOWN_CAPTURE_VERSION = "source-host-cooldown-v1" as const;
export const SOURCE_HOST_COOLDOWN_CALCULATOR_VERSION = "source-host-cooldown-calculator-v1" as const;

const cooldownRecord = z.object({ request: sourceHostCooldownRequestSchema, value: z.number().finite() }).strict();

export const sourceHostCooldownCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_COOLDOWN_CAPTURE_VERSION),
  formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION),
  executionArtifact: sourceHostArtifactSchema.optional(),
  sourceCommit: sourceHostCommitSchema, sourceConfig: z.string(), seed: z.string(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  calculation: cooldownRecord,
  components: z.array(cooldownRecord).optional(),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostCooldownCapture = z.infer<typeof sourceHostCooldownCaptureSchema>;

export interface SourceHostCooldownReplay {
  captured: SourceHostCooldownCapture;
  request: SourceHostCooldownCapture["calculation"]["request"];
  trace: CalculationTraceNode[];
  originalValue: number;
  reproducedValue: number;
  difference: number;
  warnings: string[];
}

function exact(actual: number, expected: number): void {
  if (actual !== expected) throw new Error(`来源冷却计算无法精确复现：${actual} / ${expected}`);
}

function cooldownClosureIds(root: SourceHostCalculationRecord,
  byId: ReadonlyMap<number, SourceHostCalculationRecord>): number[] {
  const found = new Set<number>();
  const visit = (row: SourceHostCalculationRecord): void => {
    if (row.request.kind !== "character-cooldown") throw new Error("冷却上游记录类型错误。");
    for (const id of sourceHostCooldownParentIds(row.request)) {
      const parent = byId.get(id);
      if (!parent || parent.request.kind !== "character-cooldown" || id >= row.request.id)
        throw new Error(`冷却计算 #${row.request.id} 缺少先前上游记录 #${id}。`);
      if (!found.has(id)) { found.add(id); visit(parent); }
    }
  };
  visit(root);
  return [...found].sort((a, b) => a - b);
}

/** Capture one calculation ID from a completed source-host run. */
export function captureSourceHostCooldown(rawResult: unknown, calculationId: number): SourceHostCooldownCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  const ids = new Set(result.calculations.map(row => row.request.id));
  if (ids.size !== result.calculations.length) throw new Error("来源计算 ID 重复。");
  const calculation = result.calculations.find(row => row.request.id === calculationId);
  if (!calculation || calculation.request.kind !== "character-cooldown")
    throw new Error(`来源运行不存在角色冷却计算 #${calculationId}。`);
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  const components = cooldownClosureIds(calculation, byId).map(id => {
    const row = byId.get(id);
    if (!row || row.request.kind !== "character-cooldown") throw new Error(`来源冷却缺少上游计算 #${id}。`);
    return row;
  });
  const supportingCalculations = sourceHostArtifactSupportClosureIds([calculation.request, ...components.map(row => row.request)], byId).map(id => {
    const row = byId.get(id);
    if (!row || (row.request.kind !== "artifact-scalar" && row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar"))
      throw new Error(`来源冷却缺少原标量 getter 使用的共享公式 #${id}。`);
    return row;
  });
  return replaySourceHostCooldown({
    schemaVersion: SOURCE_HOST_COOLDOWN_CAPTURE_VERSION,
    formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    calculation,
    ...(components.length ? { components } : {}),
    ...(supportingCalculations.length ? { supportingCalculations } : {}),
  }).captured;
}

/** Verify the saved native calculation against the shared cooldown arithmetic. */
export function replaySourceHostCooldown(raw: unknown): SourceHostCooldownReplay {
  const captured = sourceHostCooldownCaptureSchema.parse(raw);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const { request, value: originalValue } = captured.calculation;
  if (request.kind !== "character-cooldown") throw new Error("冷却捕获的原始请求类型错误。");
  if ((request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
    throw new Error("冷却捕获混合了不同固定源码版本。");
  const supporting = new Map<number, SourceHostCalculationRecord>();
  for (const row of captured.supportingCalculations ?? []) {
    if ((row.request.kind !== "artifact-scalar" && row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar") ||
      row.request.componentIds.length || supporting.has(row.request.id) ||
      (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit) {
      throw new Error("冷却捕获的修饰器支持记录无效。");
    }
    exact(resolveSourceHostRequest(row.request, supporting).value, row.value);
    supporting.set(row.request.id, row);
  }
  const componentRows = captured.components ?? [];
  const componentMap = new Map<number, SourceHostCalculationRecord>();
  for (const row of componentRows) {
    if (row.request.kind !== "character-cooldown" || row.request.id >= request.id ||
      componentMap.has(row.request.id) || supporting.has(row.request.id) || row.request.id === request.id ||
      (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
      throw new Error("冷却捕获的上游计算身份无效。");
    componentMap.set(row.request.id, row);
  }
  const requiredComponents = cooldownClosureIds(captured.calculation, componentMap);
  if (requiredComponents.length !== componentRows.length || componentRows.some((row, index) => row.request.id !== requiredComponents[index]))
    throw new Error("冷却捕获的上游记录缺失、乱序或含无关计算。");
  const required = new Set(sourceHostArtifactSupportClosureIds([request, ...componentRows.map(row => row.request)], supporting));
  if (required.size !== supporting.size || [...required].some(id => !supporting.has(id)))
    throw new Error("冷却捕获缺少原标量 getter 使用的公式，或含无关记录。");
  const previous = new Map(supporting);
  for (const row of componentRows) {
    exact(resolveSourceHostRequest(row.request, previous).value, row.value);
    previous.set(row.request.id, row);
  }
  const replay = resolveSourceHostRequest(request, previous);
  exact(replay.value, originalValue);
  return { captured, request, trace: replay.trace, originalValue, reproducedValue: replay.value,
    difference: replay.value - originalValue, warnings: replay.explanationGaps };
}

export const sourceHostCooldownEditableSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_COOLDOWN_CALCULATOR_VERSION),
  label: z.string(),
  originalCapture: sourceHostCooldownCaptureSchema,
  input: sourceHostCooldownInputSchema,
}).strict();
export type SourceHostCooldownEditable = z.infer<typeof sourceHostCooldownEditableSchema>;

export interface SourceHostCooldownEditedResult {
  status: "calculated";
  originalCapture: SourceHostCooldownCapture;
  originalValue: number;
  value: number;
  difference: number;
  editedInput: SourceHostCooldownInput;
  trace: CalculationTraceNode[];
  warnings: string[];
}

export function createSourceHostCooldownEditable(raw: unknown): SourceHostCooldownEditable {
  const originalCapture = replaySourceHostCooldown(raw).captured;
  const { request } = originalCapture.calculation;
  if (request.kind !== "character-cooldown") throw new Error("冷却捕获的原始请求类型错误。");
  return sourceHostCooldownEditableSchema.parse({
    schemaVersion: SOURCE_HOST_COOLDOWN_CALCULATOR_VERSION,
    label: `${request.ability} · frame ${request.frame}`,
    originalCapture,
    input: request.input,
  });
}

/** Recompute only the captured numeric step as a counterfactual. */
export function calculateSourceHostCooldownEditable(raw: unknown): SourceHostCooldownEditedResult {
  const editable = sourceHostCooldownEditableSchema.parse(raw);
  const original = replaySourceHostCooldown(editable.originalCapture);
  const originalInput = original.request.input;
  if (editable.input.operation !== originalInput.operation
    || editable.input.action !== originalInput.action || editable.input.actionType !== originalInput.actionType)
    throw new Error("独立冷却实验不能更换原始操作或动作身份。");
  if (editable.input.operation === "source") {
    if (JSON.stringify(editable.input) !== JSON.stringify(originalInput)) throw new Error("固定如雷来源值没有可编辑数值字段。");
  } else if (editable.input.operation === "route" && originalInput.operation === "route" &&
    editable.input.rule !== originalInput.rule)
    throw new Error("独立冷却实验不能更换原始角色覆写规则。");
  else if (editable.input.operation === "special-reduce" && originalInput.operation === "special-reduce" &&
    editable.input.rule !== originalInput.rule)
    throw new Error("独立冷却实验不能更换原始角色覆写规则。");
  if (editable.input.operation === "route" && originalInput.operation === "route" &&
    editable.input.specialActive !== originalInput.specialActive)
    throw new Error("独立冷却实验不能更换原始特殊技能分支。");
  const pure = resolveSourceHostCooldownInput(editable.input, original.captured.sourceCommit, "cooldownEdit");
  const trace = pure.trace.map(node => ({
    ...node,
    inputs: node.inputs.map(input => ({ ...input,
      origin: "user-edited-cooldown-experiment" as const })),
  }));
  const warnings = [...pure.explanationGaps,
    "独立实验只重算已捕获的单个冷却数值操作；不重跑冷却队列、worker、角色覆写或完整轮转。"];
  return { status: "calculated", originalCapture: original.captured, originalValue: original.originalValue,
    value: pure.value, difference: pure.value - original.originalValue, editedInput: editable.input, trace, warnings };
}
