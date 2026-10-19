import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression, type FormulaLookupTable } from "./calculation-trace";
import { sourceHostTalentRegistry } from "./source-host-talent-tables.generated";
import type { SourceHostDamageRequest } from "./source-host-wire";
import { appendSourceHostTalentIndexTrace, sourceHostTalentIndexSourceSchema } from "./source-host-talent-index";

export interface SourceHostTalentTableDefinition {
  tableId: string;
  tablePath: string;
  tableLine: number;
  symbol: string;
  values: FormulaLookupTable[];
}
export interface SourceHostTalentSite {
  tableId: string;
  indexExpressions: string[];
  talentLevelIndices?: { position: number; kind: "attack" | "skill" | "burst" }[];
  rangeSource?: { expression: string; rowVariable: string; indexVariable: string; indexPosition: number; path: string; line: number };
}
export interface SourceHostTalentExpressionSite {
  path: string;
  line: number;
  column: number;
  expression: FormulaExpression;
  termSiteIds: string[];
}
export interface SourceHostTalentRegistry {
  tables: Record<string, SourceHostTalentTableDefinition>;
  sites: Record<string, SourceHostTalentSite>;
  expressionSites?: Record<string, SourceHostTalentExpressionSite>;
}

export const sourceHostTalentTableReadSchema = z.object({
  schemaVersion: z.literal(1), tableId: z.string().min(1), siteId: z.string().min(1),
  indices: z.array(z.number().int().nonnegative()).min(1).max(3),
  indexSources: z.array(sourceHostTalentIndexSourceSchema).optional(),
  rangeFrame: z.number().finite().optional(),
  value: z.number().finite(), actorIndex: z.number().int().nonnegative(), frame: z.number().finite(),
}).strict();
export type SourceHostTalentTableRead = z.infer<typeof sourceHostTalentTableReadSchema>;

/** Appends one actual source read; the caller decides how its value relates to a hit. */
export function appendSourceHostTalentTableRead(builder: TraceBuilder, args: {
  read: SourceHostTalentTableRead;
  sourceCommit: string;
  actorIndex: number;
  frame: number;
  nodeId: string;
  label: string;
}): { value: number; nodeId: string; explanationGaps: string[] } {
  const { read, sourceCommit: commit, actorIndex, frame, nodeId, label } = args;
  const registry = sourceHostTalentRegistry[commit];
  const table = registry?.tables[read.tableId];
  const site = registry?.sites[read.siteId];
  if (!table || !site || site.tableId !== read.tableId || site.indexExpressions.length !== read.indices.length)
    throw new Error(`${label} 的天赋表或实际读取位置未在固定来源中登记。`);
  if (read.actorIndex !== actorIndex || read.frame > frame)
    throw new Error(`${label} 的天赋表读取者或读取时点与本击不匹配。`);
  if (Boolean(site.rangeSource) !== (read.rangeFrame !== undefined) || (read.rangeFrame !== undefined && read.rangeFrame > read.frame))
    throw new Error(`${label} 的循环取表时点与固定来源或倍率读取时点不匹配。`);
  const source = `https://github.com/genshinsim/gcsim/blob/${commit}/${table.tablePath}#L${table.tableLine}`;
  const indexOrigins = new Map<number, string>();
  const gaps: string[] = [];
  if (site.rangeSource) {
    const range = site.rangeSource;
    const rangeIndexId = `${nodeId}.rangeIndex`;
    builder.add(rangeIndexId, "本次循环选中的天赋表行", expr.input("iterationIndex"), [{
      ...traceInput("iterationIndex", read.indices[range.indexPosition]!, "index", "source-host-native-range-iteration",
        `原循环变量 ${range.indexVariable} 的实际迭代下标（从 0 起）；对应局部表行 ${range.rowVariable}`),
      context: { actorIndex: read.actorIndex, rangeExpression: range.expression,
        rangeExpressionFrame: read.rangeFrame!, coefficientReadFrame: read.frame },
    }], { unit: "index", sourceRefs: [`https://github.com/genshinsim/gcsim/blob/${commit}/${range.path}`,
      `source-host-instrumentation:${commit}:${range.path}:${range.line}`],
      explanationKey: `原循环遍历 ${range.expression}，本次 ${range.rowVariable} 已绑定到记录的迭代行。循环取表完成于帧 ${read.rangeFrame}，实际倍率读取发生在帧 ${read.frame}；回放使用保存的下标，不重新读取当前动作状态。构建清单中的循环行号 ${range.line} 基于补丁后、自动改写前的代码。`,
    });
    indexOrigins.set(range.indexPosition, rangeIndexId);
  }
  for (const indexSource of read.indexSources ?? []) {
    const registered = site.talentLevelIndices?.find(index => index.position === indexSource.position);
    if (!registered || registered.kind !== indexSource.kind || indexOrigins.has(indexSource.position))
      throw new Error(`${label} 的天赋等级来源与固定读取位置不匹配。`);
    const resolved = appendSourceHostTalentIndexTrace(builder, {
      source: indexSource, expectedIndex: read.indices[indexSource.position]!,
      nodePrefix: `${nodeId}.index${indexSource.position}`, sourceCommit: commit,
      actorIndex: read.actorIndex,
      frame: site.rangeSource && indexSource.position < site.rangeSource.indexPosition ? read.rangeFrame! : read.frame,
    });
    indexOrigins.set(indexSource.position, resolved.nodeId);
    gaps.push(...resolved.gaps);
  }
  const value = builder.add(nodeId, `来源天赋表 ${table.symbol}：实际索引查值`,
    expr.lookup(table.symbol, table.values, ...read.indices.map((_, index) => expr.input(`index${index}`))),
    read.indices.map((value, index) => ({
      ...traceInput(`index${index}`, value, "index", indexOrigins.has(index)
        ? { kind: site.rangeSource?.indexPosition === index ? "source-host-range-index" : "source-host-talent-index", reference: indexOrigins.get(index)! }
        : "source-host-native-table-index",
        `第 ${index + 1} 维实际下标（从 0 起）；来源表达式 ${site.indexExpressions[index]}`),
      context: { tableId: read.tableId, actorIndex: read.actorIndex,
        ...(site.rangeSource && index <= site.rangeSource.indexPosition
          ? { rangeExpressionFrame: read.rangeFrame!, coefficientReadFrame: read.frame,
            rangeExpression: site.rangeSource.expression }
          : { readFrame: read.frame }),
        sourceExpression: site.indexExpressions[index]! },
    })), {
      unit: "ratio", childIds: [...indexOrigins.values()],
      sourceRefs: [source],
      explanationKey: `用固定来源 ${table.tablePath} 中的 ${table.symbol} 表和本次实际索引重算。表值来自构建时的源码声明；读取记录只提供索引与原结果，不提供可替换的表。`,
    });
  if (value !== read.value)
    throw new Error(`${label} 的天赋表查值 ${value} 与原生读取 ${read.value} 不同。`);
  if (site.indexExpressions.some((expression, index) => !/^\d+$/.test(expression) && !indexOrigins.has(index)))
    gaps.push("天赋表读取使用原生实际索引；未附等级来源的动态索引，其天赋、命座或动作状态生成过程尚未逐步展开。");
  return { value, nodeId, explanationGaps: gaps };
}

/** A source read is replayed against the bundled pinned table, never a table
 * supplied by an imported receipt or a match on the final numeric value. */
export function resolveSourceHostTalentTableRead(request: SourceHostDamageRequest, edited: boolean): {
  trace: CalculationTraceNode[];
  origin?: { kind: string; reference: string };
  explanationGaps: string[];
} {
  const read = request.talentTableRead;
  if (!read) return { trace: [], explanationGaps: [] };
  const commit = request.sourceCommit ?? "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
  const builder = new TraceBuilder();
  const { value, nodeId, explanationGaps: gaps } = appendSourceHostTalentTableRead(builder, {
    read, sourceCommit: commit, actorIndex: request.actorIndex, frame: request.frame,
    nodeId: `sourceTalentTable.${request.id}`, label: `伤害 #${request.id}`,
  });
  if (edited) {
    gaps.push("独立编辑计算保留原天赋表读取作为历史记录；当前倍率使用编辑输入，不归因到旧读取。");
    return { trace: builder.nodes, explanationGaps: gaps };
  }
  if (value !== request.input.scaling) {
    gaps.push(`天赋表原读取为 ${value}，本击最终倍率为 ${request.input.scaling}；后续原生修改未由这份表读取展开。`);
    return { trace: builder.nodes, explanationGaps: gaps };
  }
  return { trace: builder.nodes, origin: { kind: "source-host-talent-table", reference: nodeId }, explanationGaps: gaps };
}
