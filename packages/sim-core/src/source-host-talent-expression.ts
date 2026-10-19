import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { appendSourceHostTalentTableRead, sourceHostTalentTableReadSchema } from "./source-host-talent-table";
import { sourceHostTalentRegistry } from "./source-host-talent-tables.generated";
import type { SourceHostDamageRequest } from "./source-host-wire";

export const sourceHostTalentExpressionReadSchema = z.object({
  schemaVersion: z.literal(1), siteId: z.string().min(1),
  reads: z.array(sourceHostTalentTableReadSchema).min(1),
  value: z.number().finite(), actorIndex: z.number().int().nonnegative(), frame: z.number().finite(),
}).strict();

/** The expression and every table come from the fixed build registry. The
 * imported receipt supplies only the actual indices and observed results. */
export function resolveSourceHostTalentExpressionRead(request: SourceHostDamageRequest, edited: boolean): {
  trace: CalculationTraceNode[];
  origin?: { kind: string; reference: string };
  explanationGaps: string[];
} {
  const read = request.talentExpressionRead;
  if (!read) return { trace: [], explanationGaps: [] };
  const commit = request.sourceCommit ?? "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
  const site = sourceHostTalentRegistry[commit]?.expressionSites?.[read.siteId];
  if (!site || site.termSiteIds.length !== read.reads.length)
    throw new Error(`伤害 #${request.id} 的倍率表达式或表读取数量未在固定来源中登记。`);
  if (read.actorIndex !== request.actorIndex || read.frame > request.frame)
    throw new Error(`伤害 #${request.id} 的倍率表达式读取者或读取时点与本击不匹配。`);
  const builder = new TraceBuilder();
  const nodeId = `sourceTalentExpression.${request.id}`;
  const gaps: string[] = [];
  const leaves = read.reads.map((leaf, index) => {
    if (leaf.siteId !== site.termSiteIds[index])
      throw new Error(`伤害 #${request.id} 的倍率表达式第 ${index + 1} 项与固定表读取位置不匹配。`);
    const result = appendSourceHostTalentTableRead(builder, { read: leaf, sourceCommit: commit,
      actorIndex: request.actorIndex, frame: read.frame, nodeId: `${nodeId}.term${index}`,
      label: `伤害 #${request.id} 的倍率表达式第 ${index + 1} 项` });
    gaps.push(...result.explanationGaps);
    return result;
  });
  const value = builder.add(nodeId, "来源天赋倍率：完整表达式", site.expression,
    leaves.map((leaf, index) => ({
      ...traceInput(`term${index}`, leaf.value, "ratio", { kind: "source-host-talent-table", reference: leaf.nodeId },
        `原表达式中的第 ${index + 1} 次天赋表读取；具体表、等级和下标见关联步骤`),
      context: { actorIndex: read.actorIndex, coefficientReadFrame: read.frame, siteId: site.termSiteIds[index]! },
    })), { unit: "ratio", childIds: leaves.map(leaf => leaf.nodeId),
      sourceRefs: [`https://github.com/genshinsim/gcsim/blob/${commit}/${site.path}`,
        `source-host-instrumentation:${commit}:${site.path}:${site.line}:${site.column}`],
      explanationKey: "按固定源码的运算树依次组合实际表值，保留括号和二元运算顺序。纯常量子表达式使用 Go 常量语义折算后的值；逐项表读取与等级来源由同一计算核心展开。", });
  if (value !== read.value)
    throw new Error(`伤害 #${request.id} 的倍率表达式复算 ${value} 与原生结果 ${read.value} 不同。`);
  if (edited) {
    gaps.push("独立编辑计算保留原倍率表达式作为历史记录；当前倍率使用编辑输入，不归因到旧表达式。");
    return { trace: builder.nodes, explanationGaps: gaps };
  }
  if (value !== request.input.scaling) {
    gaps.push(`倍率表达式原结果为 ${value}，本击最终倍率为 ${request.input.scaling}；后续原生修改未由这份表达式回执展开。`);
    return { trace: builder.nodes, explanationGaps: gaps };
  }
  return { trace: builder.nodes, origin: { kind: "source-host-talent-expression", reference: nodeId }, explanationGaps: gaps };
}
