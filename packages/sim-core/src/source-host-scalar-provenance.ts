/** Exact scalar getter receipts from the pinned Go runtime. A recorded delta
 * is an observed closure return, never a reconstruction of its internal rule. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type TraceInput } from "./calculation-trace";
import { executeSourceHostNestedStatRead, sourceHostStatReadSchema, sourceHostVerifiedFormulaOrigin } from "./source-host-stat-provenance";

const SOURCE = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const sourcePaths = ["pkg/core/player/character/mods.go", "pkg/core/player/shield/bonus.go", "pkg/enemy/mods.go", "pkg/enemy/damage.go"];
const finite = z.number().finite();
const scalarKind = z.enum(["reaction-bonus", "resistance", "defense-adjustment", "heal-bonus", "shield-bonus", "cooldown-factor"]);
const artifactResistanceSchema = z.object({
  sourceHolderIndex: z.number().int(), createdFrame: z.number().int(),
  targetKey: z.number().int(), element: z.string().min(1),
}).strict();
const scalarStepSchema = z.object({
  index: z.number().int().nonnegative(), key: z.string().min(1),
  expiryBefore: z.number().int(), expiryAfter: z.number().int(), affectedByHitlag: z.boolean(),
  element: z.string(), closureOpaque: z.boolean(),
  outcome: z.enum(["applied", "expired", "element-mismatch"]),
  before: finite, delta: finite.nullable(), after: finite,
  dependencies: z.array(sourceHostStatReadSchema),
  formulaCalculationIds: z.array(z.number().int().nonnegative()).optional(),
  creationFormulaCalculationIds: z.array(z.number().int().nonnegative()).optional(),
  artifactResistance: artifactResistanceSchema.optional(),
}).strict();
const scalarReadSchema = z.object({
  id: z.string().min(1), kind: scalarKind, frame: z.number().int(),
  actorIndex: z.number().int().optional(), targetKey: z.number().int().optional(),
  element: z.string(), base: finite, steps: z.array(scalarStepSchema), sum: finite,
  transforms: z.array(z.object({ kind: z.literal("min"), before: finite, limit: finite, after: finite }).strict()),
  output: finite,
}).strict();
export const sourceHostScalarProvenanceSchema = z.object({
  version: z.literal("scalar-provenance-v1"), reads: z.array(scalarReadSchema).min(1),
}).strict();
export type SourceHostScalarProvenance = z.infer<typeof sourceHostScalarProvenanceSchema>;
export type SourceHostScalarKind = z.infer<typeof scalarKind>;
export interface SourceHostScalarProvenanceExecution {
  trace: CalculationTraceNode[];
  finalNodeIds: Partial<Record<SourceHostScalarKind, string>>;
  explanationGaps: string[];
}

function close(actual: number, expected: number, field: string): void {
  if (Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected))) {
    throw new Error(`来源标量贡献 ${field} 不一致：${actual} / ${expected}`);
  }
}
function observed(key: string, value: number, meaning: string, read: z.infer<typeof scalarReadSchema>, modifierKey?: string): TraceInput {
  return { ...traceInput(key, value, "ratio", { kind: "source-host-observed-scalar", reference: read.id }, meaning), context: {
    frame: read.frame, scalarKind: read.kind,
    ...(read.actorIndex === undefined ? {} : { actorIndex: read.actorIndex }),
    ...(read.targetKey === undefined ? {} : { targetKey: read.targetKey }),
    ...(modifierKey === undefined ? {} : { modifierKey }),
  } };
}

/** Executes captured base + modifier deltas + recorded cap in source order. */
export function executeSourceHostScalarProvenance(
  raw: unknown,
  expected: Partial<Record<SourceHostScalarKind, number>> = {},
  prefix = "sourceScalar",
  sourceRoot = SOURCE,
  verifiedFormulaLinks?: ReadonlyMap<string, string>,
): SourceHostScalarProvenanceExecution {
  const receipt = sourceHostScalarProvenanceSchema.parse(raw);
  const builder = new TraceBuilder(sourcePaths.map(path => sourceRoot + path));
  const nestedTrace: CalculationTraceNode[] = [];
  const dependencyChildren = new Map<string, string[]>();
  const gaps = new Set<string>();
  const finalNodeIds: Partial<Record<SourceHostScalarKind, string>> = {};
  const ids = new Set<string>();
  for (const read of receipt.reads) {
    if (ids.has(read.id)) throw new Error(`来源标量读取 ID ${read.id} 重复`);
    ids.add(read.id);
    if (finalNodeIds[read.kind]) throw new Error(`来源标量请求重复记录 ${read.kind}`);
    const scope = `${prefix}.${read.id}`;
    const defenseBase = read.kind === "defense-adjustment";
    let value = builder.add(`${scope}.base`, defenseBase ? "敌人 DEF 调整：读取起点" : `${read.kind}：读取起点`, expr.input("base"), [
      observed("base", read.base, defenseBase ? "目标 DEF 调整起点；负值减防，正值增防，0 表示起点不调整" : "本次来源 getter 实际起始值", read),
    ], { unit: "ratio", explanationKey: `帧 ${read.frame} 的实际读取起点；没有重新执行来源 getter。${defenseBase ? "此值与后续生效的动态 DEF 调整相加，再按本次来源调用的上限处理；防御公式使用 1 + 调整比例。它与攻击专属的忽防比例分别计算。" : ""}` });
    let previousId = `${scope}.base`;
    for (const [index, step] of read.steps.entries()) {
      if (step.index !== index) throw new Error(`来源标量 ${read.id} 的 modifier 顺序不连续`);
      if (step.creationFormulaCalculationIds?.length &&
        (new Set(step.creationFormulaCalculationIds).size !== step.creationFormulaCalculationIds.length ||
          step.creationFormulaCalculationIds.some(id => !step.formulaCalculationIds?.includes(id)))) {
        throw new Error(`来源标量 ${read.id}/${step.key} 的创建公式 ID 不属于实际消费列表`);
      }
      close(value, step.before, `${read.id}/${step.key}/before`);
      const dependencyIds: string[] = [];
      for (const [depIndex, dependency] of step.dependencies.entries()) {
        const nested = executeSourceHostNestedStatRead(dependency, `${scope}.modifier.${index}.statDependency.${depIndex}`, sourceRoot, verifiedFormulaLinks);
        nestedTrace.push(...nested.trace);
        dependencyIds.push(...nested.finalNodeIds.filter(Boolean));
        nested.explanationGaps.forEach(gap => gaps.add(gap));
      }
      const stepId = `${scope}.modifier.${index}`;
      dependencyChildren.set(stepId, dependencyIds);
      if (step.outcome === "applied") {
        if (step.delta === null) throw new Error(`来源标量 ${read.id}/${step.key} 缺少实际返回量`);
        const formulaReference = verifiedFormulaLinks?.get(`${read.id}/${step.index}/scalar`);
        if (step.closureOpaque && step.delta !== 0 && !formulaReference)
          gaps.add(`来源标量 ${read.id}/${step.index}/${step.key}/scalar 的非零 Amount 闭包返回量缺少已验证公式节点链接。`);
        else if (!step.closureOpaque && step.delta !== 0 && !formulaReference)
          gaps.add(`来源标量 ${read.id}/${step.index}/${step.key}/scalar 读取非零 Value 字段；其创建公式尚未附来源链接。`);
        const deltaInput = observed("delta", step.delta, formulaReference
          ? "原 Amount 实际消费的已验证共享公式返回值"
          : step.closureOpaque ? "原 Amount 闭包实际返回值；此槽位公式尚未验证" : "来源 modifier 实际 Value", read, step.key);
        if (formulaReference) {
          deltaInput.origin = sourceHostVerifiedFormulaOrigin(formulaReference);
          dependencyChildren.set(stepId, [...dependencyIds, formulaReference]);
        }
        value = builder.add(stepId, `${step.key}：实际标量贡献`, expr.add(expr.input("before"), expr.input("delta")), [
          observed("before", value, "原列表顺序至此的累计值", read, step.key),
          deltaInput,
        ], { unit: "ratio", childIds: [previousId],
          explanationKey: `原 modifier ${step.key} 在帧 ${read.frame} 应用；到期帧 ${step.expiryBefore}，命中停帧=${step.affectedByHitlag}。${step.delta === 0 ? "本次返回零值；即使有公式链接也不推断触发条件或闭包公式完备。" : formulaReference ? "本次贡献已连接到验证过的共享公式节点。" : step.closureOpaque ? "闭包内部公式尚未验证。" : "数值来自原生实际字段读取。"}${step.artifactResistance ? `减抗数值在帧 ${step.artifactResistance.createdFrame} 创建，并在本帧由原 getter 读取。` : ""}` });
      } else {
        if (step.delta !== null) throw new Error(`来源标量 ${read.id}/${step.key} 跳过项不应有返回量`);
        builder.add(stepId, `${step.key}：${step.outcome}`, expr.input("before"), [
          observed("before", value, "跳过 modifier 前的实际累计值", read, step.key),
        ], { unit: "ratio", status: "not-applicable", childIds: [previousId],
          explanationKey: step.outcome === "expired" ? `帧 ${read.frame} 已过到期帧 ${step.expiryBefore}；原 getter 没有调用 Amount。`
            : `帧 ${read.frame} 的元素 ${read.element} 与 modifier 元素 ${step.element} 不符；原 getter 没有应用此项。` });
      }
      close(value, step.after, `${read.id}/${step.key}/after`);
      if (step.expiryAfter !== step.expiryBefore) gaps.add(`来源标量 ${read.id}/${step.index}/${step.key} 在读取期间改变了到期帧；回执保留前后帧值，内部原因未展开。`);
      previousId = stepId;
    }
    close(value, read.sum, `${read.id}/sum`);
    for (const [index, transform] of read.transforms.entries()) {
      close(value, transform.before, `${read.id}/transform.${index}.before`);
      value = builder.add(`${scope}.transform.${index}`, "来源标量上限", expr.min(expr.input("before"), expr.input("limit")), [
        observed("before", value, "已按原顺序求和的数值", read),
        observed("limit", transform.limit, "来源实际使用的上限", read),
      ], { unit: "ratio", childIds: [previousId], explanationKey: "来源在本次调用点执行 min；保留实际调用顺序。" });
      close(value, transform.after, `${read.id}/transform.${index}.after`);
      previousId = `${scope}.transform.${index}`;
    }
    close(value, read.output, `${read.id}/output`);
    if (expected[read.kind] !== undefined) close(value, expected[read.kind]!, `${read.kind}/damage input`);
    const completionId = `${scope}.complete`;
    builder.add(completionId, `${read.kind}：实际输出`, expr.input("output"), [
      observed("output", value, "本次 getter 进入共享公式的实际值", read),
    ], { unit: "ratio", childIds: [previousId], explanationKey: "已核对每次来源加法与上限；已连接的闭包数值可沿对应共享公式追溯，其余闭包只保留实际观测值。" });
    finalNodeIds[read.kind] = completionId;
  }
  for (const kind of Object.keys(expected) as SourceHostScalarKind[]) {
    if (expected[kind] !== undefined && !finalNodeIds[kind]) throw new Error(`来源标量请求缺少 ${kind} 的实际读取回执`);
  }
  return { trace: [...nestedTrace, ...builder.nodes.map(node => ({
    ...node, childIds: [...node.childIds, ...(dependencyChildren.get(node.id) ?? [])],
  }))], finalNodeIds, explanationGaps: [...gaps] };
}
