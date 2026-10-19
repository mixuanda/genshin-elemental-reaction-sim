/** Actual Go modifier receipts. No closure is re-run or inferred from its output. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type TraceInput } from "./calculation-trace";
import { executeSourceHostBasePanel, sourceHostBasePanelSchema, SOURCE_HOST_STAT_NAMES as STAT_NAMES, type SourceHostBasePanel } from "./source-host-base-panel";

const SOURCE = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const sourcePaths = ["pkg/core/player/character/basestat.go", "pkg/core/player/character/character.go", "pkg/gcs/parser/parseCharacter.go", "pkg/simulation/setup.go", "pkg/core/player/character/stats.go", "pkg/core/player/character/mods.go", "internal/template/character/character.go", "internal/artifacts/blizzard/blizzard.go", "internal/artifacts/disenchantmentindeepshadow/disenchantmentindeepshadow.go"];
const finite = z.number().finite();
const vector = z.array(finite).length(STAT_NAMES.length);
const index = z.number().int().nonnegative();
const kind = z.enum(["stats", "stat", "non-extra-stat", "select-stat", "attack-mods", "artifact-snapshot"]);
const outcome = z.enum(["applied", "returned-nil", "expired", "stat-filtered", "extra-excluded"]);
const numericChange = z.object({ field: z.string().min(1), before: finite, after: finite }).strict();

export interface SourceHostStatStepReceipt {
  index: number; key: string; expiryBefore: number; expiryAfter: number;
  affectedStat: number; extra: boolean; affectedByHitlag: boolean;
  outcome: z.infer<typeof outcome>;
  before: number[]; afterAmount: number[]; returned: number[] | null; after: number[];
  attackChanges: Array<z.infer<typeof numericChange>>;
  dependencies: SourceHostStatReadReceipt[];
  formulaCalculationIds?: number[] | undefined;
  creationFormulaCalculationIds?: number[] | undefined;
}
export interface SourceHostStatReadReceipt {
  id: string; kind: z.infer<typeof kind>; frame: number; actorIndex: number; targetKey?: number | undefined;
  effectSourceActorIndex?: number | undefined;
  selector: number[]; nonExtra: boolean; base: number[]; steps: SourceHostStatStepReceipt[]; result: number[];
  basePanel?: SourceHostBasePanel | undefined;
}
export const sourceHostStatReadSchema: z.ZodType<SourceHostStatReadReceipt> = z.lazy(() => z.object({
  id: z.string().min(1), kind, frame: z.number().int(), actorIndex: z.number().int(), targetKey: z.number().int().optional(), effectSourceActorIndex: z.number().int().optional(),
  selector: z.array(index.max(STAT_NAMES.length - 1)), nonExtra: z.boolean(), base: vector,
  basePanel: sourceHostBasePanelSchema.optional(),
  steps: z.array(z.object({
    index, key: z.string().min(1), expiryBefore: z.number().int(), expiryAfter: z.number().int(),
    affectedStat: index.max(STAT_NAMES.length - 1), extra: z.boolean(), affectedByHitlag: z.boolean(), outcome,
    before: vector, afterAmount: vector, returned: z.array(finite).max(STAT_NAMES.length).nullable(), after: vector,
    attackChanges: z.array(numericChange), dependencies: z.array(sourceHostStatReadSchema),
    formulaCalculationIds: z.array(index).optional(),
    creationFormulaCalculationIds: z.array(index).optional(),
  }).strict()), result: vector,
}).strict());
export const sourceHostStatProvenanceSchema = z.object({
  version: z.literal("stat-provenance-v1"), snapshotRead: sourceHostStatReadSchema.nullable(),
  attackReads: z.array(sourceHostStatReadSchema), finalStats: vector,
}).strict();
export type SourceHostStatProvenance = z.infer<typeof sourceHostStatProvenanceSchema>;
export interface SourceHostStatProvenanceExecution {
  trace: CalculationTraceNode[];
  finalStats: number[];
  /** Numeric keys are the pinned Go attributes.Stat indices. */
  finalNodeIds: string[];
  explanationGaps: string[];
}

function close(actual: number, expected: number, field: string): void {
  if (Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected))) {
    throw new Error(`来源属性贡献 ${field} 不一致：${actual} / ${expected}`);
  }
}
function sameVector(actual: readonly number[], expected: readonly number[], field: string): void {
  if (actual.length !== expected.length) throw new Error(`来源属性贡献 ${field} 长度不一致`);
  actual.forEach((value, i) => close(value, expected[i]!, `${field}[${i}]`));
}
function receiptInput(key: string, value: number, meaning: string, read: SourceHostStatReadReceipt, step?: SourceHostStatStepReceipt): TraceInput {
  return { ...traceInput(key, value, "stat", { kind: "source-host-observed-modifier", reference: read.id }, meaning), context: {
    readFrame: read.frame, actorIndex: read.actorIndex, readKind: read.kind,
    ...(read.targetKey === undefined ? {} : { targetKey: read.targetKey }),
    ...(read.effectSourceActorIndex === undefined ? {} : { effectSourceActorIndex: read.effectSourceActorIndex }),
    ...(step ? { modifierKey: step.key, expiryBefore: step.expiryBefore, expiryAfter: step.expiryAfter, extra: step.extra, affectedByHitlag: step.affectedByHitlag } : {}),
  } };
}

/** Only a caller-verified consumer link may identify a shared formula node. */
export function sourceHostVerifiedFormulaOrigin(reference: string): TraceInput["origin"] {
  return { kind: reference.startsWith("characterModifier.") ? "source-host-character-modifier"
    : reference.startsWith("characterScalar.") ? "source-host-character-scalar" : "source-host-artifact-scalar", reference };
}

/** Executes every recorded addition in source order and checks its actual sum.
 * The caller connects finalNodeIds to damage inputs; edited final panels keep
 * this graph as historical evidence and must not treat opaque deltas as formulas.
 */
export function executeSourceHostStatProvenance(raw: unknown, expectedFinalStats?: readonly number[], prefix = "sourceStats", allowNestedRoot = false, sourceRoot = SOURCE, verifiedFormulaLinks?: ReadonlyMap<string, string>): SourceHostStatProvenanceExecution {
  const receipt = sourceHostStatProvenanceSchema.parse(raw);
  if (expectedFinalStats !== undefined) sameVector(receipt.finalStats, expectedFinalStats, "final snapshot");
  const builder = new TraceBuilder(sourcePaths.map(path => sourceRoot + path));
  const gaps = new Set<string>();
  const formulaChildren = new Map<string, string>();
  const panels = new Map<string, ReturnType<typeof executeSourceHostBasePanel>>();
  const rendered = new Map<string, { serialized: string; stats: number[]; ids: string[]; completionId: string }>();
  const opaque = (id: string, before: readonly number[], after: readonly number[], previous: readonly string[], description: string, read?: SourceHostStatReadReceipt): string[] => {
    const ids = [...previous];
    after.forEach((value, stat) => {
      if (before[stat] === value) return;
      gaps.add(`属性读取 ${read?.id ?? "快照"}/${id}：${description} 差值不代表已验证的独立机制表达式。`);
      const differenceId = `${id}.difference.${stat}`;
      builder.add(differenceId, `${STAT_NAMES[stat]}：实际前后差值`, expr.sub(expr.input("after"), expr.input("before")), [
        traceInput("before", before[stat]!, "stat", "source-host-observed-boundary", "边界前实际值"),
        traceInput("after", value, "stat", "source-host-observed-boundary", "边界后实际值"),
      ], { unit: "stat", status: "assumed", childIds: previous[stat] ? [previous[stat]!] : [], explanationKey: description });
      ids[stat] = `${id}.observed.${stat}`;
      builder.add(ids[stat]!, `${STAT_NAMES[stat]}：实际修改后值`, expr.input("observedAfter"), [
        read ? receiptInput("observedAfter", value, "原执行点直接修改后的数值", read) : traceInput("observedAfter", value, "stat", "source-host-observed-boundary", "原执行点直接修改后的数值"),
      ], { unit: "stat", status: "assumed", childIds: [differenceId], explanationKey: "采用真实修改后值；差值仅用于解释数值去向，不重新执行或推断来源闭包。" });
    });
    return ids;
  };
  const executeRead = (read: SourceHostStatReadReceipt, previousIds?: readonly string[]): { stats: number[]; ids: string[]; completionId: string } => {
    const directSnapshot = read.kind === "artifact-snapshot";
    const serialized = JSON.stringify(read);
    const existing = rendered.get(read.id);
    if (existing) {
      if (existing.serialized !== serialized) throw new Error(`同一来源属性取样 ID ${read.id} 对应不同记录`);
      return existing;
    }
    const scope = `${prefix}.${read.id}`;
    let stats = [...read.base];
    let baseIds = previousIds;
    if (read.basePanel) {
      if (read.basePanel.actorIndex !== read.actorIndex || !["stats", "stat", "non-extra-stat", "select-stat"].includes(read.kind))
        throw new Error("来源基础面板与实际属性读取的角色或类型不匹配。");
      const key = JSON.stringify(read.basePanel);
      let panel = panels.get(key);
      if (!panel) {
        panel = executeSourceHostBasePanel(read.basePanel, `${prefix}.basePanel.${panels.size}`, sourceRoot, builder);
        panels.set(key, panel);
        panel.explanationGaps.forEach(gap => gaps.add(gap));
      }
      const selected = read.kind === "stats" ? panel.finalStats : panel.finalStats.map((value, stat) => read.selector.includes(stat) ? value : 0);
      const selectedIds = panel.finalNodeIds.map((id, stat) => read.kind === "stats" || read.selector.includes(stat) ? id : "");
      baseIds = opaque(`${scope}.basePanelBoundary`, selected, read.base, selectedIds,
        "初始基础面板构造后、本次 getter 之前发生的实际修改；保留其数值差异，不从最终值逆推修改公式。", read);
    } else if (["stats", "stat", "non-extra-stat", "select-stat"].includes(read.kind)) {
      gaps.add(`属性读取 ${read.id} 未保存初始基础面板构造配方；角色、武器与配置输入的上游贡献未展开。`);
    }
    let ids = stats.map((value, stat) => {
      const id = `${scope}.base.${stat}`;
      const baseInput = receiptInput("base", value, directSnapshot ? "事件回调写入前的真实快照属性" : "本次 getter 实际复制的起始属性", read);
      if (baseIds?.[stat]) baseInput.origin = { kind: "source-host-stat-provenance", reference: baseIds[stat]! };
      builder.add(id, `${STAT_NAMES[stat]}：${directSnapshot ? "事件写入前值" : "本次读取起点"}`, expr.input("base"), [baseInput], {
        unit: "stat", childIds: baseIds?.[stat] ? [baseIds[stat]!] : [],
        explanationKey: directSnapshot
          ? `帧 ${read.frame} 原事件回调直接写入攻击快照；受益角色索引 ${read.actorIndex}，装备来源角色索引 ${read.effectSourceActorIndex ?? "未记录"}。这里没有重新调用属性 getter。`
          : `${read.kind} 在帧 ${read.frame} 读取的起点；单属性/选定属性 getter 的其他槽位不代表完整面板。`,
      });
      return id;
    });
    const stepNodes: string[] = [];
    read.steps.forEach((step, stepIndex) => {
      if (step.creationFormulaCalculationIds?.length && (new Set(step.creationFormulaCalculationIds).size !== step.creationFormulaCalculationIds.length
        || step.creationFormulaCalculationIds.some(id => !step.formulaCalculationIds?.includes(id)))) {
        throw new Error(`来源属性步骤 ${read.id}/${step.key} 的创建公式 ID 未包含在实际消费公式中`);
      }
      if (step.index !== stepIndex) throw new Error(`属性读取 ${read.id} 的 modifier 顺序不连续`);
      sameVector(stats, step.before, `${read.id}/${step.key}/before`);
      const dependencies = step.dependencies.map(dependency => executeRead(dependency)).map(result => result.completionId);
      const stepId = `${scope}.${directSnapshot ? "callback" : "modifier"}.${stepIndex}`;
      ids = opaque(`${stepId}.closure`, stats, step.afterAmount, ids,
        directSnapshot ? `事件回调 ${step.key} 在公式求值前修改了快照；这里只保留帧 ${read.frame} 的观测差值。`
          : `modifier ${step.key} 原 Amount 调用直接修改了属性；这里只有帧 ${read.frame} 的观测差值，闭包内部公式仍未解析。`, read);
      stats = [...step.afterAmount];
      for (const [changeIndex, change] of step.attackChanges.entries()) {
        gaps.add(`属性读取 ${read.id}/${stepIndex}/${step.key}/${change.field}：AttackMod 直接改变了攻击字段；其前后数值已保存，内部机制公式仍不透明。`);
        const mutationId = `${stepId}.attackMutation.${changeIndex}`;
        builder.add(mutationId, `${step.key}：${change.field} 实际改变量`, expr.sub(expr.input("after"), expr.input("before")), [
          receiptInput("before", change.before, `${change.field} 修改前值`, read, step), receiptInput("after", change.after, `${change.field} 修改后值`, read, step),
        ], { unit: "stat", status: "assumed", childIds: dependencies, explanationKey: "仅观察同一次 Amount 对攻击字段的直接修改，不将差值伪装为被动公式。" });
        stepNodes.push(mutationId);
      }
      if (step.outcome === "applied") {
        if (step.returned === null) throw new Error(`modifier ${step.key} 应用记录缺少实际返回值`);
        const slots = read.kind === "stats" || read.kind === "attack-mods"
          ? step.returned.map((_, i) => i) : read.selector;
        const additionIds: string[] = [];
        slots.forEach((stat, occurrence) => {
          const delta = step.returned![stat];
          if (delta === undefined) throw new Error(`modifier ${step.key} 缺少实际使用的属性槽位 ${stat}`);
          if (delta === 0) return;
          const formulaReference = verifiedFormulaLinks?.get(`${read.id}/${step.index}/${stat}`);
          if (!formulaReference) gaps.add(`属性读取 ${read.id}/${step.index}/${step.key}/${STAT_NAMES[stat]}[${stat}] 的非零返回量缺少已验证公式节点链接。`);
          const id = `${stepId}.add.${stat}.${occurrence}`;
          const deltaInput = receiptInput("delta", delta, formulaReference
            ? "原 Amount 实际消费的已验证共享公式返回值"
            : "原 Amount 唯一一次调用实际返回的本项增量；此槽位公式尚未验证", read, step);
          if (formulaReference) {
            deltaInput.origin = sourceHostVerifiedFormulaOrigin(formulaReference);
            formulaChildren.set(id, formulaReference);
          }
          const value = builder.add(id, `${step.key} → ${STAT_NAMES[stat]}`, expr.add(expr.input("before"), expr.input("delta")), [
            receiptInput("before", stats[stat]!, "按原列表顺序执行到此项前的累计属性", read, step),
            deltaInput,
          ], { unit: "stat", childIds: [...new Set([ids[stat]!, ...dependencies])], explanationKey: directSnapshot
            ? `原事件回调 ${step.key} 通过目标状态门后直接向受益者快照相加；来源装备角色索引 ${read.effectSourceActorIndex ?? "未记录"}，目标 ${read.targetKey ?? "未记录"}。`
            : `原始修饰器 ${step.key} 的实际贡献相加；读取帧 ${read.frame}，到期帧 ${step.expiryBefore}（-1 表示永久），Extra=${step.extra}。${formulaReference && step.creationFormulaCalculationIds?.length ? "此项沿用已验证的创建时公式，本帧仅消费，未重新求值。" : ""}` });
          stats[stat] = value;
          ids[stat] = id;
          additionIds.push(id);
        });
        builder.add(stepId, `${step.key}：${directSnapshot ? "事件直接写值" : "本次返回贡献"}`, expr.value(additionIds.length), [], {
          unit: "count", childIds: [...new Set([...additionIds, ...dependencies])], explanationKey: additionIds.length === 0
            ? directSnapshot ? `帧 ${read.frame} 原事件回调写入零增量；触发条件由来源事件决定。` : `帧 ${read.frame} 原 Amount 实际返回了零增量；不推断条件未满足。到期帧 ${step.expiryBefore}。`
            : "子节点按来源原始顺序执行各非零属性加法；计数仅用于展示，不参与伤害公式。",
        });
      } else {
        if (step.returned !== null) throw new Error(`modifier ${step.key} 非应用记录不应包含返回增量`);
        builder.add(stepId, `${step.key}：${step.outcome}`, expr.value(0), [], {
          unit: "stat", status: "not-applicable", childIds: dependencies,
          explanationKey: step.outcome === "returned-nil"
            ? `帧 ${read.frame} 原 Amount 返回 nil；未推断闭包内部条件。直接属性/攻击修改另行保留。`
            : `原 getter 在 ${step.outcome} 分支跳过此项，未额外调用 Amount；读取帧 ${read.frame}，到期帧 ${step.expiryBefore}。`,
        });
      }
      sameVector(stats, step.after, `${read.id}/${step.key}/sum`);
      stepNodes.push(stepId);
    });
    sameVector(stats, read.result, `${read.id}/result`);
    const completionId = `${scope}.complete`;
    builder.add(completionId, `帧 ${read.frame} ${directSnapshot ? "事件快照写入完成" : "属性读取完成"}`, expr.value(read.steps.length), [], {
      unit: "count", childIds: [...new Set([...ids, ...stepNodes])], explanationKey: directSnapshot
        ? "已按事件回调的真实前后快照核对直接写值；装备来源角色和受益角色分别记录。"
        : "已按记录执行原始加法并核对实际结果；闭包依赖表示真实嵌套调用，不推断其内部代数关系。",
    });
    const result = { serialized, stats, ids, completionId };
    rendered.set(read.id, result);
    return result;
  };

  let current: { stats: number[]; ids: string[] } | undefined;
  if (receipt.snapshotRead) {
    if (!allowNestedRoot && receipt.snapshotRead.kind !== "stats") throw new Error("快照 provenance 必须引用实际 Stats 读取");
    current = executeRead(receipt.snapshotRead);
  } else {
    gaps.add("此快照没有通用 Stats 采样记录；手工构造或来源专用快照的上游属性仍未捕获。");
  }
  receipt.attackReads.forEach((read, i) => {
    if (read.kind !== "attack-mods" && read.kind !== "artifact-snapshot") throw new Error("命中 provenance 必须引用实际 ApplyAttackMods 读取或事件快照写值");
    const previousIds = current ? opaque(`${prefix}.boundary.${i}`, current.stats, read.base, current.ids,
      "原 Stats/上一阶段与目标命中之间的实际差值；可能来自角色 Snapshot 后处理或 OnEnemyHit 回调，尚未归因到单个闭包。", read) : undefined;
    current = executeRead(read, previousIds);
  });
  if (!current) throw new Error("属性 provenance 没有任何真实 getter 或 AttackMod 读取记录");
  const finalNodeIds = opaque(`${prefix}.finalBoundary`, current.stats, receipt.finalStats, current.ids,
    "最后一次已记录读取与实际导出快照之间的差值；不假定来源、不补造 modifier key 或 expiry。");
  return { trace: builder.nodes.map(node => {
    const reference = formulaChildren.get(node.id);
    return reference ? { ...node, childIds: [...node.childIds, reference] } : node;
  }), finalStats: [...receipt.finalStats], finalNodeIds, explanationGaps: [...gaps] };
}

/** Render a getter observed inside a scalar modifier without presenting it as
 * a complete damage snapshot. Its original recursive modifier receipts remain
 * attached to the scalar Amount call that triggered it. */
export function executeSourceHostNestedStatRead(raw: unknown, prefix: string, sourceRoot = SOURCE, verifiedFormulaLinks?: ReadonlyMap<string, string>): SourceHostStatProvenanceExecution {
  const read = sourceHostStatReadSchema.parse(raw);
  return executeSourceHostStatProvenance({
    version: "stat-provenance-v1", snapshotRead: read, attackReads: [], finalStats: read.result,
  }, read.result, prefix, true, sourceRoot, verifiedFormulaLinks);
}
