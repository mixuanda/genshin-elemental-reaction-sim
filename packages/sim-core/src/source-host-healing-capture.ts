/** A single observed Go Heal call and an independent arithmetic editor. */
import { z } from "zod";
import { sourceHostArtifactSupportClosureIds } from "./source-host-artifact-support";
import { resolveSourceHostHealingInput, sourceHostHealingInputSchema, type SourceHostHealingInput } from "./source-host-healing-formula";
import { resolveSourceHostHealingSourceInput, sourceHostHealingSourceInputSchema,
  type SourceHostHealingSourceInput } from "./source-host-healing-source-formula";
import { resolveSourceHostRequest } from "./source-host-formula";
import type { CalculationTraceNode } from "./calculation-trace";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_FORMULA_VERSION, assertSourceHostStartupState,
  sourceHostArtifactSchema, sourceHostCalculationRecordSchema, sourceHostCommitSchema,
  sourceHostHealingApplicationSchema, sourceHostHealingRequestSchema,
  sourceHostInitialEnergySchema, sourceHostResultSchema, sourceHostStartupStateSchema,
  type SourceHostCalculationRecord, type SourceHostHealingApplication,
} from "./source-host-wire";

export const SOURCE_HOST_HEALING_CAPTURE_VERSION = "source-host-healing-v1" as const;
export const SOURCE_HOST_HEALING_CALCULATOR_VERSION = "source-host-healing-calculator-v1" as const;
const healingRecord = z.object({ request: sourceHostHealingRequestSchema, value: z.number().finite() }).strict();
export const sourceHostHealingCaptureSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_HEALING_CAPTURE_VERSION),
  formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION),
  executionArtifact: sourceHostArtifactSchema.optional(),
  sourceCommit: sourceHostCommitSchema, sourceConfig: z.string(), seed: z.string(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  application: sourceHostHealingApplicationSchema,
  calculation: healingRecord,
  components: z.array(healingRecord),
  sources: z.array(healingRecord).optional(),
  supportingCalculations: z.array(sourceHostCalculationRecordSchema).optional(),
}).strict();
export type SourceHostHealingCapture = z.infer<typeof sourceHostHealingCaptureSchema>;
export interface SourceHostHealingReplay {
  captured: SourceHostHealingCapture;
  trace: CalculationTraceNode[];
  originalAmount: number; reproducedAmount: number;
  originalReceived: number; reproducedReceived: number | null;
  originalOverheal: number; reproducedOverheal: number;
  difference: number;
  warnings: string[];
}
type HealingRecord = z.infer<typeof healingRecord>;
type BaseInput = Extract<SourceHostHealingInput, { operation: "base" }>;
type BonusInput = Extract<SourceHostHealingInput, { operation: "bonus" }>;
type ReceiveInput = Extract<SourceHostHealingInput, { operation: "receive" }>;
type ConversionInput = Extract<SourceHostHealingInput, { operation: "receive-conversion" }>;
type OverrideInput = Extract<SourceHostHealingInput, { operation: "receive-override" }>;
type OverhealInput = Extract<SourceHostHealingInput, { operation: "overheal" }>;

function exact(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`来源治疗 ${label} 无法精确复现：${actual} / ${expected}`);
}
function ids(application: SourceHostHealingApplication, records: ReadonlyMap<number, SourceHostCalculationRecord>): number[] {
  const receive = application.receiveCalculationId === undefined ? undefined : records.get(application.receiveCalculationId);
  const earlier = receive?.request.kind === "character-healing" &&
    (receive.request.input.operation === "receive" || receive.request.input.operation === "receive-override")
    ? receive.request.componentIds.filter(id => id !== application.amountCalculationId) : [];
  return [application.baseCalculationId, application.bonusCalculationId, application.amountCalculationId,
    ...earlier, ...(application.receiveCalculationId === undefined ? [] : [application.receiveCalculationId]),
    application.overhealCalculationId];
}
function healingRecordAt(records: ReadonlyMap<number, SourceHostCalculationRecord>, id: number,
  operation: SourceHostHealingInput["operation"], application: SourceHostHealingApplication): HealingRecord {
  const row = records.get(id);
  if (!row || row.request.kind !== "character-healing" || row.request.input.operation !== operation
    || row.request.frame !== application.frame || row.request.actorIndex !== application.actorIndex
    || row.request.actorKey !== application.actorKey || row.request.ability !== application.source)
    throw new Error(`来源治疗应用 #${application.id} 缺少同帧同角色的 ${operation} 公式 #${id}。`);
  return row as HealingRecord;
}

/** Whole-run normalization and standalone replay use this same identity check. */
export function verifySourceHostHealingApplication(application: SourceHostHealingApplication,
  records: ReadonlyMap<number, SourceHostCalculationRecord>): void {
  if (application.targetIndex !== application.actorIndex) throw new Error("来源治疗实际目标与应用角色不一致。");
  const sequence = ids(application, records);
  if (new Set(sequence).size !== sequence.length || sequence.some((id, index) => index > 0 && id <= sequence[index - 1]!))
    throw new Error("来源治疗公式必须按原 getter 与状态更新顺序执行。");
  const base = healingRecordAt(records, application.baseCalculationId, "base", application);
  const bonus = healingRecordAt(records, application.bonusCalculationId, "bonus", application);
  const amount = healingRecordAt(records, application.amountCalculationId, "amount", application);
  const receiveRow = application.receiveCalculationId === undefined ? undefined
    : records.get(application.receiveCalculationId);
  const receiveOperation = receiveRow?.request.kind === "character-healing"
    ? receiveRow.request.input.operation : undefined;
  const receive = application.receiveCalculationId === undefined ? undefined
    : healingRecordAt(records, application.receiveCalculationId, receiveOperation === "receive-override" ? "receive-override" : "receive", application);
  const earlier = sequence.slice(3, receive ? -2 : -1).map(id => {
    const row = records.get(id);
    const operation = row?.request.kind === "character-healing" ? row.request.input.operation : undefined;
    if (operation !== "receive-delegation" && operation !== "receive-conversion")
      throw new Error("角色治疗覆盖的前置分支缺失。");
    return healingRecordAt(records, id, operation, application);
  });
  const overheal = healingRecordAt(records, application.overhealCalculationId, "overheal", application);
  const amountInput = amount.request.input;
  const overhealInput = overheal.request.input;
  if (amountInput.operation !== "amount" || overhealInput.operation !== "overheal") throw new Error("来源治疗公式阶段不匹配。");
  if (base.request.componentIds.length > 1 || bonus.request.componentIds.length > 1
    || JSON.stringify(amount.request.componentIds) !== JSON.stringify([base.request.id, bonus.request.id]))
    throw new Error("治疗基础、加成及原始治疗量的前置组件不一致。");
  for (const stage of [base, bonus]) {
    const sourceId = stage.request.componentIds[0];
    if (sourceId === undefined) continue;
    const source = records.get(sourceId);
    if (source?.request.kind !== "character-healing" || source.request.input.operation !== "source" ||
      source.request.input.sourceHolderIndex !== application.callerIndex ||
      source.request.actorIndex !== application.callerIndex || source.request.frame > application.frame)
      throw new Error(`治疗 HealInfo 来源 #${sourceId} 与本次 Caller 不一致。`);
  }
  exact(amountInput.baseAmount, base.value, "base amount link");
  exact(amountInput.bonusMultiplier, bonus.value, "bonus link");
  exact(amount.value, application.finalAmount, "original heal amount");
  if (receive) {
    const receiveInput = receive.request.input;
    if (receiveInput.operation !== "receive" && receiveInput.operation !== "receive-override")
      throw new Error("角色接收治疗阶段不匹配。");
    const prior = earlier[0];
    const expected = receiveInput.operation === "receive"
      ? [prior?.request.input.operation === "receive-delegation" ? prior.request.id : amount.request.id]
      : receiveInput.branch === "clorinde-converted" ? [amount.request.id, prior?.request.id] : [amount.request.id];
    if (JSON.stringify(receive.request.componentIds) !== JSON.stringify(expected))
      throw new Error("角色接收治疗没有链接本次原始量及实际分支。");
    if (receiveInput.operation === "receive" && prior && prior.request.input.operation !== "receive-delegation")
      throw new Error("模板治疗前置分支不匹配。");
    if (receiveInput.operation === "receive-override" && prior && prior.request.input.operation !== "receive-conversion")
      throw new Error("覆盖治疗前置转换不匹配。");
    if (receiveInput.operation === "receive-override" && receiveInput.branch === "clorinde-converted" && !prior)
      throw new Error("克洛琳德转换治疗缺少转换公式。");
    if (receiveInput.operation === "receive-override" && receiveInput.branch === "arlecchino-rejected" && prior)
      throw new Error("阿蕾奇诺拒绝治疗不应包含转换公式。");
    if (prior) {
      if (JSON.stringify(prior.request.componentIds) !== JSON.stringify([amount.request.id]))
        throw new Error("角色治疗覆盖前置公式未链接本次治疗量。");
      if (prior.request.input.operation === "receive-delegation" || prior.request.input.operation === "receive-conversion")
        exact(prior.request.input.finalAmount, amount.value, "override amount link");
      if (prior.request.input.operation === "receive-conversion" && receiveInput.operation === "receive-override"
        && receiveInput.branch === "clorinde-converted")
        exact(receiveInput.convertedAmount, prior.value, "conversion amount link");
    }
    exact(receiveInput.finalAmount, amount.value, "receive amount link");
    exact(receive.value, application.receivedAmount, "native received heal");
  }
  if (JSON.stringify(overheal.request.componentIds) !== JSON.stringify([amount.request.id, ...(receive ? [receive.request.id] : [])]))
    throw new Error("过量治疗未按原生回调链接原始治疗与真实抵扣组件。");
  exact(overhealInput.previousHp, application.previousHp, "previous HP");
  exact(overhealInput.receivedAmount, application.receivedAmount, "actual received heal");
  exact(overheal.value, application.overheal, "native overheal");
  // previousHpDebt is the earlier log getter. It need not equal the fresh
  // CurrentHPDebt read in template ReceiveHeal. Current HP/debt are Go state.
  for (const row of [base, bonus, amount, ...earlier, ...(receive ? [receive] : []), overheal]) {
    const calculated = resolveSourceHostRequest(row.request, records);
    exact(calculated.value, row.value, `calculation #${row.request.id}`);
  }
}

function supportMap(records: readonly SourceHostCalculationRecord[], sourceCommit: string): Map<number, SourceHostCalculationRecord> {
  const map = new Map<number, SourceHostCalculationRecord>();
  for (const record of records) {
    if ((record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar") || record.request.componentIds.length || map.has(record.request.id)
      || (record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== sourceCommit)
      throw new Error("治疗捕获的装备支持公式重复或身份不符。");
    const calculated = resolveSourceHostRequest(record.request, map);
    exact(calculated.value, record.value, `modifier support #${record.request.id}`);
    map.set(record.request.id, record);
  }
  return map;
}
function uniqueTrace(nodes: CalculationTraceNode[]): CalculationTraceNode[] {
  const seen = new Set<string>();
  return nodes.filter(node => seen.has(node.id) ? false : (seen.add(node.id), true));
}
function editedTrace(nodes: CalculationTraceNode[], links: Record<string, string> = {}): CalculationTraceNode[] {
  return nodes.map(node => ({ ...node, inputs: node.inputs.map(input => ({ ...input,
    origin: links[input.key]
      ? { kind: "user-edited-healing-stage", reference: links[input.key]! }
      : "user-edited-healing-experiment",
  })) }));
}

/** Capture one completed native Heal, including only its causal formula reads. */
export function captureSourceHostHealing(rawResult: unknown, applicationId: number): SourceHostHealingCapture {
  const result = sourceHostResultSchema.parse(rawResult);
  if (!result.healingApplications) throw new Error("此来源运行没有原生治疗应用记录，不能捕获治疗事件。");
  const application = result.healingApplications.find(row => row.id === applicationId);
  if (!application) throw new Error(`来源运行不存在实际治疗应用 #${applicationId}。`);
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  if (byId.size !== result.calculations.length) throw new Error("来源计算 ID 重复。");
  const records = ids(application, byId).map(id => {
    const row = byId.get(id);
    if (!row || row.request.kind !== "character-healing") throw new Error(`实际治疗应用缺少共享公式 #${id}。`);
    return row;
  });
  const sourceIds = new Set<number>();
  const includeSource = (id: number, parent: number): void => {
    const row = byId.get(id);
    if (!row || row.request.kind !== "character-healing" || row.request.input.operation !== "source" || id >= parent)
      throw new Error(`治疗来源缺少先前 HealInfo 字段生产公式 #${id}。`);
    if (sourceIds.has(id)) return;
    sourceIds.add(id);
    row.request.componentIds.forEach(child => includeSource(child, id));
  };
  records.slice(0, 2).forEach(row => row.request.componentIds.forEach(id => includeSource(id, row.request.id)));
  const sources = [...sourceIds].sort((a, b) => a - b).map(id => byId.get(id)!);
  const supportIds = sourceHostArtifactSupportClosureIds([...sources, ...records].map(row => row.request), byId);
  const supportingCalculations = supportIds.map(id => {
    const row = byId.get(id);
    if (!row || (row.request.kind !== "artifact-scalar" && row.request.kind !== "character-modifier" && row.request.kind !== "character-scalar")) throw new Error(`来源治疗缺少读取时使用的共享公式 #${id}。`);
    return row;
  });
  return replaySourceHostHealing({
    schemaVersion: SOURCE_HOST_HEALING_CAPTURE_VERSION, formulaVersion: SOURCE_HOST_FORMULA_VERSION,
    sourceCommit: result.sourceCommit, sourceConfig: result.config, seed: result.seed,
    ...(result.initialEnergy ? { initialEnergy: result.initialEnergy, startupState: result.startupState } : {}),
    ...(result.executionArtifact ? { executionArtifact: result.executionArtifact } : {}),
    application, calculation: records.at(-1)!, components: records.slice(0, -1),
    ...(sources.length ? { sources } : {}),
    ...(supportingCalculations.length ? { supportingCalculations } : {}),
  }).captured;
}

/** Reproduce original scalar responses; native mutation is retained as a receipt. */
export function replaySourceHostHealing(raw: unknown): SourceHostHealingReplay {
  const captured = sourceHostHealingCaptureSchema.parse(raw);
  assertSourceHostStartupState(captured.initialEnergy, captured.startupState);
  const rows = [...captured.components, captured.calculation];
  const expectedIds = ids(captured.application, new Map(rows.map(row => [row.request.id, row])));
  if (rows.length !== expectedIds.length || rows.some((row, index) => row.request.id !== expectedIds[index]))
    throw new Error("治疗捕获缺少原始阶段或混入无关计算。");
  if ([...rows, ...(captured.sources ?? [])].some(row => (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== captured.sourceCommit))
    throw new Error("治疗捕获混合了不同固定源码版本。");
  const map = supportMap(captured.supportingCalculations ?? [], captured.sourceCommit);
  const sourceRows = captured.sources ?? [];
  const bySourceId = new Map(sourceRows.map(row => [row.request.id, row]));
  if (bySourceId.size !== sourceRows.length) throw new Error("治疗来源计算 ID 重复。");
  const neededSources = new Set<number>();
  const requireSource = (id: number, parent: number): void => {
    const row = bySourceId.get(id);
    if (!row || row.request.kind !== "character-healing" || row.request.input.operation !== "source" || id >= parent)
      throw new Error(`治疗捕获缺少先前来源 #${id}。`);
    if (neededSources.has(id)) return;
    neededSources.add(id);
    row.request.componentIds.forEach(child => requireSource(child, id));
  };
  rows.slice(0, 2).forEach(row => row.request.componentIds.forEach(id => requireSource(id, row.request.id)));
  if (neededSources.size !== sourceRows.length) throw new Error("治疗捕获混入无关来源公式。");
  for (const row of sourceRows) {
    if (map.has(row.request.id) || row.request.componentIds.some(id => !map.has(id)))
      throw new Error("治疗来源公式未按生产时序保存。");
    exact(resolveSourceHostRequest(row.request, map).value, row.value, `source #${row.request.id}`);
    map.set(row.request.id, row);
  }
  const requiredSupport = new Set(sourceHostArtifactSupportClosureIds([...sourceRows, ...rows].map(row => row.request), map));
  const supportingIds = new Set((captured.supportingCalculations ?? []).map(row => row.request.id));
  if (requiredSupport.size !== supportingIds.size || [...requiredSupport].some(id => !supportingIds.has(id)))
    throw new Error("治疗捕获缺少所用装备支持记录，或包含无关记录。");
  for (const row of rows) {
    if (map.has(row.request.id)) throw new Error("治疗捕获存在重复计算 ID。");
    map.set(row.request.id, row);
  }
  verifySourceHostHealingApplication(captured.application, map);
  const calculations = rows.map(row => resolveSourceHostRequest(row.request, map));
  const amount = rows[2]!;
  const receive = captured.application.receiveCalculationId === undefined ? undefined
    : rows.find(row => row.request.id === captured.application.receiveCalculationId);
  const overheal = rows.at(-1)!;
  return { captured, trace: uniqueTrace([...sourceRows.map(row => resolveSourceHostRequest(row.request, map)), ...calculations].flatMap(row => row.trace)),
    originalAmount: captured.application.finalAmount, reproducedAmount: amount.value,
    originalReceived: captured.application.receivedAmount, reproducedReceived: receive?.value ?? null,
    originalOverheal: captured.application.overheal, reproducedOverheal: overheal.value,
    difference: overheal.value - captured.application.overheal,
    warnings: [...new Set([...calculations.flatMap(row => row.explanationGaps),
      "角色最终 HP/生命之契与事件由 Go 原生状态更新；本捕获核对本次共享治疗数值。"])] };
}

export const sourceHostHealingEditableSchema = z.object({
  schemaVersion: z.literal(SOURCE_HOST_HEALING_CALCULATOR_VERSION), label: z.string(),
  originalCapture: sourceHostHealingCaptureSchema,
  sourceInputs: z.array(z.object({ id: z.number().int().nonnegative(),
    input: sourceHostHealingSourceInputSchema }).strict()).optional(),
  baseInput: sourceHostHealingInputSchema,
  bonusInput: sourceHostHealingInputSchema,
  conversionInput: sourceHostHealingInputSchema.optional(),
  receiveInput: sourceHostHealingInputSchema.optional(),
  overhealInput: sourceHostHealingInputSchema,
}).strict();
export type SourceHostHealingEditable = z.infer<typeof sourceHostHealingEditableSchema>;
export type SourceHostHealingEditedResult =
  | { status: "calculated"; originalCapture: SourceHostHealingCapture; originalAmount: number; editedAmount: number;
      originalReceived: number; editedReceived: number; originalOverheal: number; editedOverheal: number;
      originalConverted?: number; editedConverted?: number;
      difference: number; trace: CalculationTraceNode[]; warnings: string[] }
  | { status: "blocked"; originalCapture: SourceHostHealingCapture; originalAmount: number; editedAmount: number;
      originalReceived: number; originalOverheal: number; reason: string; trace: CalculationTraceNode[]; warnings: string[] };

export function createSourceHostHealingEditable(raw: unknown): SourceHostHealingEditable {
  const originalCapture = replaySourceHostHealing(raw).captured;
  const stage = (operation: SourceHostHealingInput["operation"]) => {
    const row = originalCapture.components.find(record => record.request.input.operation === operation);
    return row?.request.input;
  };
  return sourceHostHealingEditableSchema.parse({
    schemaVersion: SOURCE_HOST_HEALING_CALCULATOR_VERSION,
    label: `${originalCapture.application.source} · frame ${originalCapture.application.frame}`,
    originalCapture,
    ...(originalCapture.sources?.length ? { sourceInputs: originalCapture.sources.map(row => ({
      id: row.request.id, input: structuredClone(row.request.input) as SourceHostHealingSourceInput,
    })) } : {}),
    baseInput: stage("base"), bonusInput: stage("bonus"),
    ...(stage("receive-conversion") ? { conversionInput: stage("receive-conversion") } : {}),
    ...(stage("receive") || stage("receive-override")
      ? { receiveInput: stage("receive") ?? stage("receive-override") } : {}),
    overhealInput: originalCapture.calculation.request.input,
  });
}

/** Counterfactual arithmetic only. Native getters and character overrides are
 * never re-executed, and the original capture remains byte-for-byte evidence. */
export function calculateSourceHostHealingEditable(raw: unknown): SourceHostHealingEditedResult {
  const editable = sourceHostHealingEditableSchema.parse(raw);
  const original = replaySourceHostHealing(editable.originalCapture);
  if (editable.baseInput.operation !== "base" || editable.bonusInput.operation !== "bonus"
    || editable.overhealInput.operation !== "overheal") throw new Error("治疗独立实验的阶段输入不匹配。");
  const originalBase = original.captured.components[0]!.request.input;
  if (originalBase.operation !== "base" || editable.baseInput.healType !== originalBase.healType)
    throw new Error("独立治疗实验不能更换原始绝对、百分比或未支持的治疗类型。");
  if (originalBase.healType === "unsupported" && editable.baseInput.healType === "unsupported"
    && editable.baseInput.originalHealType !== originalBase.originalHealType)
    throw new Error("独立治疗实验不能更换未支持类型的原生枚举值。");
  const sourceRows = original.captured.sources ?? [];
  const editedSources = editable.sourceInputs ?? [];
  if (sourceRows.length !== editedSources.length ||
    sourceRows.some((row, index) => row.request.id !== editedSources[index]?.id))
    throw new Error("治疗独立实验缺少完整的源数值编辑输入。");
  const sourceValues = new Map<number, number>();
  const sourceTraces: CalculationTraceNode[] = [];
  const sourceWarnings: string[] = [];
  for (const [index, row] of sourceRows.entries()) {
    const originalInput = row.request.input;
    const editableInput = editedSources[index]!.input;
    if (originalInput.operation !== "source" || editableInput.ruleId !== originalInput.ruleId ||
      editableInput.sourceHolderIndex !== originalInput.sourceHolderIndex)
      throw new Error("治疗独立实验不能更换源公式身份或来源角色。");
    const state = { ...editableInput.state };
    for (const [key, id] of Object.entries(row.request.valueSources ?? {})) {
      const upstream = sourceValues.get(id);
      if (upstream === undefined) throw new Error(`治疗源公式缺少编辑后的上游数值 #${id}。`);
      if (state[key] !== originalInput.state[key])
        throw new Error(`治疗源公式的 ${key} 来自先前生产值，请编辑其上游公式。`);
      state[key] = upstream;
    }
    const recomputed = resolveSourceHostHealingSourceInput({ ...editableInput, state },
      original.captured.sourceCommit, `healingEdit.source.${row.request.id}`);
    sourceValues.set(row.request.id, recomputed.value);
    const sourceLinks: Record<string, string> = {};
    for (const [key, id] of Object.entries(row.request.valueSources ?? {})) {
      const prior = sourceRows.find(source => source.request.id === id);
      if (prior?.request.input.operation !== "source") throw new Error(`治疗源公式缺少上游规则 #${id}。`);
      sourceLinks[key] = `healingEdit.source.${id}.${prior.request.input.ruleId}`;
    }
    sourceTraces.push(...editedTrace(recomputed.trace, sourceLinks));
    sourceWarnings.push(...recomputed.explanationGaps);
  }
  const baseSourceId = original.captured.components[0]!.request.componentIds[0];
  const bonusSourceId = original.captured.components[1]!.request.componentIds[0];
  if (baseSourceId !== undefined && editable.baseInput.sourceAmount !== originalBase.sourceAmount)
    throw new Error("治疗 Src 已连接原生产公式；请编辑源公式状态叶，不能单独覆盖下游字段。");
  const originalBonus = original.captured.components[1]!.request.input;
  if (bonusSourceId !== undefined && originalBonus.operation === "bonus" &&
    editable.bonusInput.infoBonus !== originalBonus.infoBonus)
    throw new Error("治疗 Bonus 已连接原生产公式；请编辑源公式状态叶，不能单独覆盖下游字段。");
  const baseInput: BaseInput = baseSourceId === undefined ? editable.baseInput
    : { ...editable.baseInput, sourceAmount: sourceValues.get(baseSourceId)! };
  const bonusInput: BonusInput = bonusSourceId === undefined ? editable.bonusInput
    : { ...editable.bonusInput, infoBonus: sourceValues.get(bonusSourceId)! };
  const sourceRef = (id: number): string => {
    const row = sourceRows.find(source => source.request.id === id);
    if (row?.request.input.operation !== "source") throw new Error(`治疗独立实验缺少来源公式 #${id}。`);
    return `healingEdit.source.${id}.${row.request.input.ruleId}`;
  };
  const base = resolveSourceHostHealingInput(baseInput, original.captured.sourceCommit, "healingEdit.base");
  const bonus = resolveSourceHostHealingInput(bonusInput, original.captured.sourceCommit, "healingEdit.bonus");
  const amount = resolveSourceHostHealingInput({ operation: "amount", baseAmount: base.value, bonusMultiplier: bonus.value },
    original.captured.sourceCommit, "healingEdit.amount");
  const traces = [
    ...sourceTraces,
    ...editedTrace(base.trace, baseSourceId === undefined ? {} : { sourceAmount: sourceRef(baseSourceId) }),
    ...editedTrace(bonus.trace, bonusSourceId === undefined ? {} : { infoBonus: sourceRef(bonusSourceId) }),
    ...editedTrace(amount.trace, { baseAmount: "healingEdit.base.base", bonusMultiplier: "healingEdit.bonus.bonus" }),
  ];
  const warnings = [...sourceWarnings, ...base.explanationGaps, ...bonus.explanationGaps, ...amount.explanationGaps];
  const hasReceive = original.captured.application.receiveCalculationId !== undefined;
  if (hasReceive !== (editable.receiveInput !== undefined))
    throw new Error("独立治疗实验不能添加或移除原生 ReceiveHeal 阶段。");
  let received: number;
  let editedConverted: number | undefined;
  if (hasReceive) {
    const editedReceiveInput = editable.receiveInput;
    const originalReceive = original.captured.components.find(row => row.request.id === original.captured.application.receiveCalculationId);
    if (!originalReceive || !editedReceiveInput || editedReceiveInput.operation !== originalReceive.request.input.operation)
      throw new Error("独立治疗实验不能更改角色接收治疗分支。");
    const delegation = original.captured.components.find(row => row.request.input.operation === "receive-delegation");
    if (delegation?.request.input.operation === "receive-delegation") {
      const delegated = resolveSourceHostHealingInput({ ...delegation.request.input, finalAmount: amount.value },
        original.captured.sourceCommit, "healingEdit.delegation");
      traces.push(...editedTrace(delegated.trace, { finalAmount: "healingEdit.amount.final" }));
      warnings.push(...delegated.explanationGaps);
    }
    if (editedReceiveInput.operation === "receive") {
      const receiveInput: ReceiveInput = editedReceiveInput;
      const receive = resolveSourceHostHealingInput({ ...receiveInput, finalAmount: amount.value },
        original.captured.sourceCommit, "healingEdit.receive");
      received = receive.value;
      traces.push(...editedTrace(receive.trace, { finalAmount: delegation ? "healingEdit.delegation.delegated" : "healingEdit.amount.final" }));
      warnings.push(...receive.explanationGaps);
    } else if (editedReceiveInput.operation === "receive-override") {
      const overrideInput: OverrideInput = editedReceiveInput;
      if (originalReceive.request.input.operation !== "receive-override"
        || overrideInput.branch !== originalReceive.request.input.branch)
        throw new Error("独立治疗实验不能更改角色覆盖分支。");
      let convertedAmount: number | undefined;
      if (overrideInput.branch === "clorinde-converted") {
        if (editable.conversionInput?.operation !== "receive-conversion")
          throw new Error("克洛琳德转换治疗缺少原始转换阶段输入。");
        const conversionInput: ConversionInput = editable.conversionInput;
        const conversion = resolveSourceHostHealingInput({ ...conversionInput, finalAmount: amount.value },
          original.captured.sourceCommit, "healingEdit.conversion");
        convertedAmount = conversion.value;
        editedConverted = conversion.value;
        traces.push(...editedTrace(conversion.trace, { finalAmount: "healingEdit.amount.final" }));
        warnings.push(...conversion.explanationGaps);
      } else if (editable.conversionInput !== undefined) throw new Error("拒绝治疗不能附带转换阶段。");
      const receive = resolveSourceHostHealingInput(overrideInput.branch === "clorinde-converted"
        ? { ...overrideInput, finalAmount: amount.value, convertedAmount: convertedAmount! }
        : { ...overrideInput, finalAmount: amount.value }, original.captured.sourceCommit, "healingEdit.receive");
      received = receive.value;
      traces.push(...editedTrace(receive.trace, { finalAmount: "healingEdit.amount.final",
        ...(convertedAmount === undefined ? {} : { convertedAmount: "healingEdit.conversion.converted" }) }));
      warnings.push(...receive.explanationGaps);
    } else throw new Error("独立治疗实验的接收阶段不匹配。");
  } else {
    if (amount.value !== original.originalAmount) return {
      status: "blocked", originalCapture: original.captured,
      originalAmount: original.originalAmount, editedAmount: amount.value,
      originalReceived: original.originalReceived, originalOverheal: original.originalOverheal,
      reason: "此角色覆盖了 ReceiveHeal；原生回执没有模板生命之契阶段。上游治疗量改变后，不能推断覆盖方法会返回多少治疗。",
      trace: traces, warnings,
    };
    received = (editable.overhealInput as OverhealInput).receivedAmount;
  }
  const overhealInput: OverhealInput = editable.overhealInput as OverhealInput;
  const overheal = resolveSourceHostHealingInput({ ...overhealInput, receivedAmount: received },
    original.captured.sourceCommit, "healingEdit.overheal");
  traces.push(...editedTrace(overheal.trace, hasReceive
    ? { receivedAmount: "healingEdit.receive.received" } : {}));
  warnings.push(...overheal.explanationGaps, "本实验仅沿已捕获阶段重算算术；HP/生命之契状态更新与 OnHeal 事件不会重跑。");
  return { status: "calculated", originalCapture: original.captured,
    originalAmount: original.originalAmount, editedAmount: amount.value,
    originalReceived: original.originalReceived, editedReceived: received,
    ...(editedConverted === undefined ? {} : {
      originalConverted: original.captured.components.find(row => row.request.input.operation === "receive-conversion")!.value,
      editedConverted,
    }),
    originalOverheal: original.originalOverheal, editedOverheal: overheal.value,
    difference: overheal.value - original.originalOverheal,
    trace: traces, warnings };
}
