/** One native character shield HP write and its causal source calculations. */
import { z } from "zod";
import { sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import { resolveSourceHostCharacterShieldInput, sourceHostCharacterShieldInputSchema } from "./source-host-character-shield-formula";
import { resolveSourceHostRequest } from "./source-host-formula";
import type { CalculationTraceNode } from "./calculation-trace";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, assertSourceHostStartupState,
  sourceHostArtifactSchema, sourceHostCalculationRecordSchema, sourceHostCharacterShieldRequestSchema,
  sourceHostCommitSchema, sourceHostInitialEnergySchema, sourceHostResultSchema, sourceHostStartupStateSchema,
  type SourceHostCalculationRecord,
} from "./source-host-wire";

export const SOURCE_HOST_CHARACTER_SHIELD_CAPTURE_VERSION = "source-host-character-shield-v1" as const;
export const SOURCE_HOST_CHARACTER_SHIELD_CALCULATOR_VERSION = "source-host-character-shield-calculator-v1" as const;
const shieldRecord = z.object({ request: sourceHostCharacterShieldRequestSchema, value: z.number().finite() }).strict();
export const sourceHostCharacterShieldCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_CHARACTER_SHIELD_CAPTURE_VERSION),
  formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION), sourceCommit: sourceHostCommitSchema,
  sourceConfig: z.string(), seed: z.string(), executionArtifact: sourceHostArtifactSchema.optional(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  calculation: shieldRecord, dependencies: z.array(sourceHostCalculationRecordSchema),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostCharacterShieldCapture = z.infer<typeof sourceHostCharacterShieldCaptureSchema>;
export const sourceHostCharacterShieldEditableSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_CHARACTER_SHIELD_CALCULATOR_VERSION), label: z.string(),
  originalCapture: sourceHostCharacterShieldCaptureSchema,
  input: sourceHostCharacterShieldInputSchema,
}).strict();
export type SourceHostCharacterShieldEditable = z.infer<typeof sourceHostCharacterShieldEditableSchema>;

const close = (actual: number, expected: number, label: string): void => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected)))
    throw new Error(`来源护盾 ${label} 无法精确复现：${actual} / ${expected}`);
};
const supported = (row: SourceHostCalculationRecord): boolean =>
  row.request.kind === "artifact-scalar" || row.request.kind === "character-modifier" || row.request.kind === "character-scalar";

/** Capture the exact formula ID returned at a shield's original HP write. */
export function captureSourceHostCharacterShield(rawResult: unknown, calculationId: number): SourceHostCharacterShieldCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  assertSourceHostStartupState(result.initialEnergy, result.startupState);
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  if (byId.size !== result.calculations.length) throw new Error("来源计算 ID 重复。");
  const calculation = byId.get(calculationId);
  if (!calculation || calculation.request.kind !== "character-shield")
    throw new Error(`来源运行不存在角色护盾 HP 计算 #${calculationId}。`);
  const needed = new Set<number>();
  const visit = (id: number, consumer: number): void => {
    const row = byId.get(id);
    if (!row || id >= consumer || (row.request.kind !== "character-shield" && row.request.kind !== "player-shield"))
      throw new Error(`护盾 HP 计算缺少真实先前来源 #${id}。`);
    if (needed.has(id)) return;
    needed.add(id);
    row.request.componentIds.forEach(child => visit(child, id));
  };
  calculation.request.componentIds.forEach(id => visit(id, calculationId));
  const dependencies = [...needed].sort((a, b) => a - b).map(id => byId.get(id)!);
  const supportIds = sourceHostArtifactSupportClosureIds([calculation.request, ...dependencies.map(row => row.request)], byId);
  const supportingCalculations = supportIds.map(id => {
    const row = byId.get(id);
    if (!row || !supported(row)) throw new Error(`护盾 HP 缺少来源修饰器 #${id}。`);
    return row;
  });
  return replaySourceHostCharacterShield({
    schemaVersion: SOURCE_HOST_CHARACTER_SHIELD_CAPTURE_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    calculation, dependencies,
    ...(supportingCalculations.length ? { supportingCalculations } : {}),
  }).captured;
}

export function replaySourceHostCharacterShield(raw: unknown): {
  captured: SourceHostCharacterShieldCapture; originalValue: number; reproducedValue: number;
  trace: CalculationTraceNode[]; warnings: string[];
} {
  const captured = sourceHostCharacterShieldCaptureSchema.parse(raw);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const row of captured.supportingCalculations ?? []) {
    if (!supported(row) || map.has(row.request.id) || row.request.componentIds.length ||
      (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
      throw new Error("护盾 HP 修饰器支持记录重复或源码身份不符。");
    close(resolveSourceHostRequest(row.request, map).value, row.value, `support #${row.request.id}`);
    map.set(row.request.id, row);
  }
  const need = new Set<number>();
  const byId = new Map(captured.dependencies.map(row => [row.request.id, row]));
  if (byId.size !== captured.dependencies.length) throw new Error("护盾 HP 的先前来源 ID 重复。");
  const visit = (id: number, parent: number): void => {
    const row = byId.get(id);
    if (!row || id >= parent || (row.request.kind !== "character-shield" && row.request.kind !== "player-shield"))
      throw new Error(`护盾 HP 缺少因果来源 #${id}。`);
    if (need.has(id)) return;
    need.add(id);
    row.request.componentIds.forEach(child => visit(child, id));
  };
  captured.calculation.request.componentIds.forEach(id => visit(id, captured.calculation.request.id));
  if (need.size !== captured.dependencies.length) throw new Error("护盾 HP 捕获混入无关先前计算。");
  for (const row of captured.dependencies) {
    if (map.has(row.request.id) || (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit ||
      row.request.componentIds.some(id => !map.has(id))) throw new Error("护盾 HP 先前来源顺序或固定源码身份不符。");
    close(resolveSourceHostRequest(row.request, map).value, row.value, `source #${row.request.id}`);
    map.set(row.request.id, row);
  }
  const request = captured.calculation.request;
  if (map.has(request.id) || (request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit)
    throw new Error("护盾 HP 本次计算身份与固定源码不符。");
  const requiredSupport = new Set(sourceHostArtifactSupportClosureIds(
    [request, ...captured.dependencies.map(row => row.request)], map));
  const actualSupport = new Set((captured.supportingCalculations ?? []).map(row => row.request.id));
  if (requiredSupport.size !== actualSupport.size || [...requiredSupport].some(id => !actualSupport.has(id)))
    throw new Error("护盾 HP 捕获缺少真实属性修饰器支持或混入无关支持。");
  const resolved = resolveSourceHostRequest(request, map);
  close(resolved.value, captured.calculation.value, `calculation #${request.id}`);
  return { captured, originalValue: captured.calculation.value, reproducedValue: resolved.value,
    trace: resolved.trace, warnings: [...new Set([...resolved.explanationGaps,
      "护盾创建、刷新、受击、破盾及事件仍由原生 Go 执行；独立算术编辑不会重跑这些状态。"])] };
}

export function createSourceHostCharacterShieldEditable(rawCapture: unknown): SourceHostCharacterShieldEditable {
  const captured = replaySourceHostCharacterShield(rawCapture).captured;
  return sourceHostCharacterShieldEditableSchema.parse({
    schemaVersion: SOURCE_HOST_CHARACTER_SHIELD_CALCULATOR_VERSION,
    label: `${captured.calculation.request.actorKey} · ${captured.calculation.request.input.ruleId} · frame ${captured.calculation.request.frame}`,
    originalCapture: captured, input: structuredClone(captured.calculation.request.input),
  });
}

export function calculateSourceHostCharacterShieldEditable(raw: unknown): {
  status: "calculated"; originalCapture: SourceHostCharacterShieldCapture;
  originalValue: number; editedValue: number; difference: number;
  trace: CalculationTraceNode[]; warnings: string[];
} {
  const editable = sourceHostCharacterShieldEditableSchema.parse(raw);
  const original = replaySourceHostCharacterShield(editable.originalCapture);
  const saved = original.captured.calculation.request.input;
  if (editable.input.ruleId !== saved.ruleId || editable.input.sourceHolderIndex !== saved.sourceHolderIndex)
    throw new Error("护盾独立实验不能更换来源角色或原公式规则。");
  const calculated = resolveSourceHostCharacterShieldInput(editable.input, original.captured.sourceCommit, "characterShieldEdit");
  return { status: "calculated", originalCapture: original.captured,
    originalValue: original.originalValue, editedValue: calculated.value,
    difference: calculated.value - original.originalValue, trace: calculated.trace,
    warnings: [...new Set([...original.warnings, ...calculated.explanationGaps,
      "编辑后的状态叶仅重算创建/刷新表达式；原生 getter、先前护盾及生命周期不会重新执行。"])] };
}
