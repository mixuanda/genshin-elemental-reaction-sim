/** One actual native Drain and an independent source arithmetic editor. */
import { z } from "zod";
import { sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import { sourceHostDrainSourceRuleDescriptor } from "./source-host-drain-source-formula";
import { resolveSourceHostRequest, type SourceHostCalculation } from "./source-host-formula";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, assertSourceHostStartupState,
  sourceHostArtifactSchema, sourceHostCalculationRecordSchema, sourceHostCommitSchema,
  sourceHostDrainApplicationSchema, sourceHostInitialEnergySchema, sourceHostPlayerDrainRequestSchema,
  sourceHostResultSchema, sourceHostStartupStateSchema, type SourceHostCalculationRecord } from "./source-host-wire";

export const SOURCE_HOST_DRAIN_CAPTURE_VERSION = "source-host-drain-v1" as const;
export const SOURCE_HOST_DRAIN_CALCULATOR_VERSION = "source-host-drain-calculator-v1" as const;
const drainRecord = z.object({ request: sourceHostPlayerDrainRequestSchema, value: z.number().finite() }).strict();
export const sourceHostDrainCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_DRAIN_CAPTURE_VERSION),
  formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION), sourceCommit: sourceHostCommitSchema,
  sourceConfig: z.string(), seed: z.string(), executionArtifact: sourceHostArtifactSchema.optional(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  application: sourceHostDrainApplicationSchema, calculation: drainRecord,
  sources: z.array(sourceHostCalculationRecordSchema),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostDrainCapture = z.infer<typeof sourceHostDrainCaptureSchema>;
export const sourceHostDrainEditableSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_DRAIN_CALCULATOR_VERSION), label: z.string(),
  originalCapture: sourceHostDrainCaptureSchema,
  sourceInputs: z.array(z.object({ id: z.number().int().nonnegative(), ruleId: z.string(),
    state: z.record(z.string(), z.number().finite()) }).strict()),
}).strict();
export type SourceHostDrainEditable = z.infer<typeof sourceHostDrainEditableSchema>;

function exact(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`来源 Drain ${label} 无法精确复现：${actual} / ${expected}`);
}
const sourceCommitOf = (row: SourceHostCalculationRecord) => row.request.sourceCommit ?? SOURCE_HOST_COMMIT;
const isSupport = (row: SourceHostCalculationRecord) => row.request.kind === "artifact-scalar" ||
  row.request.kind === "character-modifier" || row.request.kind === "character-scalar";

/** Preserve exactly the recursive formula prerequisites of one real Drain. */
export function captureSourceHostDrain(rawResult: unknown, applicationId: number): SourceHostDrainCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  assertSourceHostStartupState(result.initialEnergy, result.startupState);
  const application = result.drainApplications?.find(row => row.id === applicationId);
  if (!application) throw new Error(`来源运行不存在 Drain 应用 #${applicationId}。`);
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  if (byId.size !== result.calculations.length) throw new Error("来源计算 ID 重复。");
  const calculation = byId.get(application.calculationId);
  if (calculation?.request.kind !== "player-drain") throw new Error("Drain 应用缺少实际生命写回公式。");
  const needed = new Set<number>();
  const include = (id: number, parent: number): void => {
    const row = byId.get(id);
    if (!row || id >= parent) throw new Error(`Drain 缺少先前来源公式 #${id}。`);
    if (needed.has(id)) return;
    needed.add(id);
    row.request.componentIds.forEach(child => include(child, id));
  };
  calculation.request.componentIds.forEach(id => include(id, calculation.request.id));
  const sources = [...needed].sort((a, b) => a - b).map(id => byId.get(id)!);
  const supportIds = sourceHostArtifactSupportClosureIds([calculation, ...sources].map(row => row.request), byId);
  const supportingCalculations = supportIds.filter(id => !needed.has(id)).map(id => {
    const row = byId.get(id);
    if (!row || !isSupport(row)) throw new Error(`Drain 缺少真实属性读取支持公式 #${id}。`);
    return row;
  });
  return replaySourceHostDrain({
    schemaVersion: SOURCE_HOST_DRAIN_CAPTURE_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    application, calculation, sources,
    ...(supportingCalculations.length ? { supportingCalculations } : {}),
  }).captured;
}

export function replaySourceHostDrain(raw: unknown): {
  captured: SourceHostDrainCapture; calculation: SourceHostCalculation;
  sourceCalculations: SourceHostCalculation[];
  originalAmount: number; reproducedAmount: number;
  originalRatio: number; reproducedRatio: number; difference: number; warnings: string[];
} {
  const captured = sourceHostDrainCaptureSchema.parse(raw);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const { application, calculation } = captured;
  if (sourceCommitOf(calculation) !== captured.sourceCommit ||
    [...captured.sources, ...(captured.supportingCalculations ?? [])].some(row => sourceCommitOf(row) !== captured.sourceCommit))
    throw new Error("Drain 捕获混合了不同固定源码版本。");
  const request = calculation.request;
  if (request.id !== application.calculationId || request.attackId !== application.attackId ||
    request.frame !== application.frame || request.actorIndex !== application.actorIndex ||
    request.actorKey !== application.actorKey || request.ability !== application.ability ||
    (request.amountCalculationId ?? null) !== application.sourceCalculationId ||
    request.input.amount !== application.amount || request.input.hpBefore !== application.hpBefore ||
    request.input.maxHp !== application.maxHp)
    throw new Error("Drain 应用与实际公式身份或输入不一致。");
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const row of captured.supportingCalculations ?? []) {
    if (!isSupport(row) || map.has(row.request.id) || row.request.componentIds.length)
      throw new Error("Drain 捕获的属性支持公式无效。");
    exact(resolveSourceHostRequest(row.request, map).value, row.value, `support #${row.request.id}`);
    map.set(row.request.id, row);
  }
  const required = new Set<number>();
  const sourceById = new Map(captured.sources.map(row => [row.request.id, row]));
  if (sourceById.size !== captured.sources.length) throw new Error("Drain 来源公式 ID 重复。");
  const requireSource = (id: number, parent: number): void => {
    const row = sourceById.get(id);
    if (!row || id >= parent) throw new Error(`Drain 捕获缺少前置来源 #${id}。`);
    if (required.has(id)) return;
    required.add(id);
    row.request.componentIds.forEach(child => requireSource(child, id));
  };
  request.componentIds.forEach(id => requireSource(id, request.id));
  if (required.size !== captured.sources.length) throw new Error("Drain 捕获混入无关来源公式。");
  const supportIds = sourceHostArtifactSupportClosureIds([calculation, ...captured.sources].map(row => row.request),
    new Map([...map, ...sourceById]));
  const requiredSupport = supportIds.filter(id => !sourceById.has(id));
  if (requiredSupport.length !== map.size || requiredSupport.some(id => !map.has(id)))
    throw new Error("Drain 捕获缺少实际属性支持公式，或混入无关记录。");
  const sourceCalculations: SourceHostCalculation[] = [];
  for (const row of captured.sources) {
    if (map.has(row.request.id) || row.request.componentIds.some(id => !map.has(id)))
      throw new Error("Drain 来源公式未按真实先后顺序保存。");
    const resolved = resolveSourceHostRequest(row.request, map);
    exact(resolved.value, row.value, `source #${row.request.id}`);
    sourceCalculations.push(resolved);
    map.set(row.request.id, row);
  }
  const resolved = resolveSourceHostRequest(request, map);
  exact(resolved.value, calculation.value, "player-drain calculation");
  exact(resolved.value, application.resultRatio, "native result ratio");
  const warnings = request.amountCalculationId === undefined
    ? ["此 DrainInfo.Amount 没有来源数值 ID；只能复现实际 HP 写回算术，不能编辑上游金额。"] : [];
  return { captured, calculation: resolved, sourceCalculations,
    originalAmount: application.amount, reproducedAmount: request.input.amount,
    originalRatio: application.resultRatio, reproducedRatio: resolved.value,
    difference: resolved.value - application.resultRatio, warnings };
}

export function createSourceHostDrainEditable(rawCapture: unknown): SourceHostDrainEditable {
  const captured = replaySourceHostDrain(rawCapture).captured;
  return sourceHostDrainEditableSchema.parse({
    schemaVersion: SOURCE_HOST_DRAIN_CALCULATOR_VERSION,
    label: `${captured.application.actorKey} · ${captured.application.ability} · Drain #${captured.application.id}`,
    originalCapture: captured,
    sourceInputs: captured.sources.flatMap(row => row.request.kind === "character-drain" ? [{
      id: row.request.id, ruleId: row.request.input.ruleId, state: structuredClone(row.request.input.state),
    }] : []),
  });
}

/** Recalculate source arithmetic and final HP ratio using the captured HP state.
 * This never mutates the source Go player or replays combat callbacks. */
export function calculateSourceHostDrainEditable(raw: unknown): {
  originalAmount: number; editedAmount: number; originalRatio: number; editedRatio: number;
  difference: number; edited: boolean; calculation: SourceHostCalculation;
  sourceCalculations: SourceHostCalculation[]; warnings: string[];
} {
  const editable = sourceHostDrainEditableSchema.parse(raw);
  const original = replaySourceHostDrain(editable.originalCapture);
  const originalInputs = createSourceHostDrainEditable(original.captured).sourceInputs;
  if (editable.sourceInputs.length !== originalInputs.length || editable.sourceInputs.some((row, index) =>
    row.id !== originalInputs[index]?.id || row.ruleId !== originalInputs[index]?.ruleId))
    throw new Error("Drain 独立编辑不能替换原生生产者身份。");
  const edited = JSON.stringify(editable.sourceInputs) !== JSON.stringify(originalInputs);
  const edits = new Map(editable.sourceInputs.map(row => [row.id, row.state]));
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const row of original.captured.supportingCalculations ?? []) map.set(row.request.id, row);
  const sourceCalculations: SourceHostCalculation[] = [];
  for (const record of original.captured.sources) {
    const request = structuredClone(record.request);
    if (request.kind === "character-drain") {
      const desired = edits.get(request.id)!;
      const descriptor = sourceHostDrainSourceRuleDescriptor(request.input.ruleId);
      const linked = new Set([
        ...(descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : [])).map(leaf => leaf.stateKey),
        ...Object.keys(descriptor.valueSources ?? {}),
      ]);
      for (const key of linked) if (desired[key] !== request.input.state[key])
        throw new Error(`Drain 独立编辑不能改写原生已链接读取 ${key}。`);
      request.input.state = structuredClone(desired);
      for (const [key, id] of Object.entries(request.valueSources ?? {})) {
        const prior = map.get(id);
        if (!prior) throw new Error(`Drain 编辑缺少先前来源 #${id}。`);
        request.input.state[key] = prior.value;
      }
    } else if (request.kind === "player-manual-incoming" && request.rawCalculationId !== undefined) {
      request.input.rawDamage = map.get(request.rawCalculationId)!.value;
    } else if (request.kind === "player-shield") {
      if (request.input.output === "hpAfter" && request.hpBeforeCalculationId !== undefined)
        request.input.hpBefore = map.get(request.hpBeforeCalculationId)!.value;
      if (request.input.output === "damageAfter") {
        const hp = map.get(request.componentIds[0]!);
        if (hp?.request.kind !== "player-shield" || hp.request.input.output !== "hpAfter")
          throw new Error("Drain 编辑缺少同面护盾生命阶段。");
        request.input.hpBefore = hp.request.input.hpBefore;
        request.input.incomingDamage = hp.request.input.incomingDamage;
      }
      const manual = original.captured.sources.find(row => row.request.kind === "player-manual-incoming" &&
        row.request.attackId === request.attackId);
      if (manual && request.input.output === "hpAfter") request.input.incomingDamage = map.get(manual.request.id)!.value;
    } else if (request.kind === "player-shield-min") {
      const earlier = sourceCalculations.filter(row => row.request.kind === "player-shield-min" &&
        row.request.attackId === request.attackId).at(-1);
      const manual = original.captured.sources.find(row => row.request.kind === "player-manual-incoming" &&
        row.request.attackId === request.attackId);
      if (earlier || manual) request.input.currentMinimum = earlier?.value ?? map.get(manual!.request.id)!.value;
      request.input.damageAfter = map.get(request.componentIds[0]!)!.value;
    }
    const calculated = resolveSourceHostRequest(request, map);
    sourceCalculations.push(calculated);
    map.set(request.id, { request, value: calculated.value });
  }
  const request = structuredClone(original.captured.calculation.request);
  if (request.amountCalculationId !== undefined) request.input.amount = map.get(request.amountCalculationId)!.value;
  const calculation = resolveSourceHostRequest(request, map);
  return { originalAmount: original.originalAmount, editedAmount: request.input.amount,
    originalRatio: original.originalRatio, editedRatio: calculation.value,
    difference: calculation.value - original.originalRatio, edited, calculation, sourceCalculations,
    warnings: ["编辑只重算固定来源公式与保存 HP 状态上的算术；不会写入原生角色生命或重跑后续事件。",
      ...original.warnings, ...calculation.explanationGaps] };
}

export function parseSourceHostDrain(json: string): SourceHostDrainCapture {
  return replaySourceHostDrain(JSON.parse(json) as unknown).captured;
}
