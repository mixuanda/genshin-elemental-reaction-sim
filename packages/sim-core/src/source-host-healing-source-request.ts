/** Verify native HealInfo producer arithmetic against its actual reads and
 * earlier saved producer values. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { resolveSourceHostHealingSourceInput, sourceHostHealingSourceRuleDescriptor } from "./source-host-healing-source-formula";
import { executeSourceHostNestedStatRead, executeSourceHostStatProvenance } from "./source-host-stat-provenance";
import { SOURCE_HOST_COMMIT, type SourceHostCalculationRecord, type SourceHostCalculationRequest,
  type SourceHostHealingRequest } from "./source-host-wire";

type Resolved = { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] };
// Source descriptor names follow the character packages. These three package
// names differ from the canonical actor keys in pinned character config.yml.
const canonicalActorKeys: Readonly<Record<string, string>> = {
  kokomi: "sangonomiyakokomi",
  kuki: "kukishinobu",
  mizuki: "yumemizukimizuki",
};
const commit = (request: { sourceCommit?: string | undefined }) => request.sourceCommit ?? SOURCE_HOST_COMMIT;
const close = (actual: number, expected: number, label: string): void => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected)))
    throw new Error(`治疗来源 ${label} 与原生读数不一致：${actual} / ${expected}`);
};
const statValue = (values: readonly number[], getter: string, statIndex?: number): number => {
  if (getter === "stat" || getter === "non-extra-stat" || getter === "stats-stat") return values[statIndex!]!;
  const slots = getter.includes("atk") ? [24, 6, 5] : getter.includes("def") ? [25, 1, 2] : [23, 4, 3];
  return values[slots[0]!]! * (1 + values[slots[1]!]!) + values[slots[2]!]!;
};
const snapshotValue = (values: readonly number[], getter: string, statIndex?: number): number =>
  getter === "heal" ? values[11]! : getter === "em" ? values[8]!
    : getter === "stat" ? values[statIndex!]! : statValue(values, getter);
const prefixTrace = (nodes: CalculationTraceNode[], prefix: string): CalculationTraceNode[] => {
  const local = new Set(nodes.map(node => node.id));
  return nodes.map(node => ({ ...node, id: `${prefix}.${node.id}`,
    ...(node.parentId === undefined ? {} : { parentId: `${prefix}.${node.parentId}` }),
    childIds: node.childIds.map(id => `${prefix}.${id}`),
    inputs: node.inputs.map(value => typeof value.origin === "object" && value.origin.reference !== undefined
      && local.has(value.origin.reference)
      ? { ...value, origin: { ...value.origin, reference: `${prefix}.${value.origin.reference}` } } : value),
  }));
};

export function resolveSourceHostHealingSourceRequest(request: SourceHostHealingRequest,
  records: ReadonlyMap<number, SourceHostCalculationRecord>,
  resolve: (request: SourceHostCalculationRequest, records: ReadonlyMap<number, SourceHostCalculationRecord>) => Resolved,
  verifiedFormulaLinks?: ReadonlyMap<string, string>): Resolved {
  const input = request.input;
  if (input.operation !== "source") throw new Error("治疗来源请求缺少 source 操作。");
  const descriptor = sourceHostHealingSourceRuleDescriptor(input.ruleId);
  const travelerElement = descriptor.character.endsWith("-traveler")
    ? descriptor.character.slice(0, -"-traveler".length) : undefined;
  const matchingActor = descriptor.character === "*" ? request.actorKey.length > 0
    : travelerElement !== undefined ? request.actorKey === `aether${travelerElement}` || request.actorKey === `lumine${travelerElement}`
      : request.actorKey === (canonicalActorKeys[descriptor.character] ?? descriptor.character);
  if (!matchingActor || request.actorIndex !== input.sourceHolderIndex || request.attackId !== 0 ||
    request.targetKey !== 0 || request.sourceFrame !== request.frame || request.componentApplications.length ||
    (request.snapshot === null) !== (request.snapshotStats === null) ||
    (request.snapshot === null && request.snapshotFrame !== 0) ||
    (request.snapshot !== null && (request.snapshotFrame < 0 || request.snapshotFrame > request.frame)))
    throw new Error(`治疗来源 #${request.id} 的持有者、快照或原生创建身份无效。`);
  if (descriptor.statLeaf && descriptor.statLeaves || descriptor.snapshotLeaf && descriptor.snapshotLeaves)
    throw new Error(`治疗来源 #${request.id} 的状态叶重复定义。`);
  const leaves = descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : []);
  const reads = request.statReads ?? [];
  if (reads.length !== leaves.length || new Set(reads.map(read => read.id)).size !== reads.length ||
    reads.some(read => read.frame !== request.frame))
    throw new Error(`治疗来源 #${request.id} 的实际属性读取数量或时点不符。`);
  const root = `https://github.com/genshinsim/gcsim/blob/${commit(request)}/`;
  const trace: CalculationTraceNode[] = [];
  const gaps: string[] = [];
  const origins = new Map<string, string>();
  for (const [index, leaf] of leaves.entries()) {
    const read = reads[index]!;
    const single = leaf.getter === "stat" || leaf.getter === "non-extra-stat" || leaf.getter === "stats-stat";
    const statsGetter = leaf.getter.startsWith("stats-");
    const statIndex = "statIndex" in leaf ? leaf.statIndex : undefined;
    const slots = statsGetter ? [] : single ? [statIndex] : leaf.getter.includes("atk") ? [24, 6, 5]
      : leaf.getter.includes("def") ? [25, 1, 2] : [23, 4, 3];
    if (slots.some(slot => slot === undefined) || (leaf.getter === "stats-stat" && statIndex === undefined) ||
      read.kind !== (statsGetter ? "stats" : single ? leaf.getter : "select-stat") ||
      read.nonExtra !== leaf.getter.startsWith("non-extra-") ||
      JSON.stringify(read.selector) !== JSON.stringify(slots) ||
      leaf.actor === "holder" && read.actorIndex !== input.sourceHolderIndex ||
      leaf.actor === "request-actor" && read.actorIndex !== request.actorIndex)
      throw new Error(`治疗来源 #${request.id} 的 ${leaf.stateKey} getter 身份不符。`);
    close(statValue(read.result, leaf.getter, statIndex), input.state[leaf.stateKey]!, leaf.stateKey);
    const observed = executeSourceHostNestedStatRead(read, `healingSourceStats.${request.id}.${index}`, root, verifiedFormulaLinks);
    trace.push(...observed.trace);
    gaps.push(...observed.explanationGaps);
    if (single) origins.set(leaf.stateKey, observed.finalNodeIds[statIndex!]!);
    else {
      const s = statsGetter ? leaf.getter.includes("atk") ? [24, 6, 5]
        : leaf.getter.includes("def") ? [25, 1, 2] : [23, 4, 3] : slots as number[];
      const nodeId = `healingSourceStats.${request.id}.${index}.state.${leaf.stateKey}`;
      const builder = new TraceBuilder([`${root}pkg/core/player/character/stats.go`]);
      builder.add(nodeId, `${descriptor.title}：原属性读取 ${leaf.stateKey}`,
        expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
          { ...traceInput("base", read.result[s[0]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[s[0]!]! } },
          { ...traceInput("percent", read.result[s[1]!]!, "ratio"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[s[1]!]! } },
          { ...traceInput("flat", read.result[s[2]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[s[2]!]! } },
        ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat" });
      trace.push(...builder.nodes);
      origins.set(leaf.stateKey, nodeId);
    }
  }
  const snapshotLeaves = descriptor.snapshotLeaves ?? (descriptor.snapshotLeaf ? [descriptor.snapshotLeaf] : []);
  if (snapshotLeaves.length) {
    if (request.snapshot === null || request.snapshotStats === null || request.snapshot.statProvenance == null)
      throw new Error(`治疗来源 #${request.id} 缺少原生属性快照。`);
    const observed = executeSourceHostStatProvenance(request.snapshot.statProvenance, request.snapshotStats,
      `healingSourceSnapshot.${request.id}`, false, root, verifiedFormulaLinks);
    trace.push(...observed.trace);
    gaps.push(...observed.explanationGaps);
    for (const leaf of snapshotLeaves) {
      const value = snapshotValue(request.snapshotStats, leaf.getter, leaf.statIndex);
      close(value, input.state[leaf.stateKey]!, leaf.stateKey);
      const single = leaf.getter === "heal" || leaf.getter === "em" || leaf.getter === "stat";
      if (single) origins.set(leaf.stateKey, observed.finalNodeIds[leaf.getter === "heal" ? 11 : leaf.getter === "em" ? 8 : leaf.statIndex!]!);
      else {
        const slots = leaf.getter === "total-atk" ? [24, 6, 5] : leaf.getter === "total-def" ? [25, 1, 2] : [23, 4, 3];
        const nodeId = `healingSourceSnapshot.${request.id}.state.${leaf.stateKey}`;
        const builder = new TraceBuilder([`${root}pkg/core/player/character/stats.go`]);
        builder.add(nodeId, `${descriptor.title}：快照属性 ${leaf.stateKey}`,
          expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
            { ...traceInput("base", request.snapshotStats[slots[0]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[0]!]! } },
            { ...traceInput("percent", request.snapshotStats[slots[1]!]!, "ratio"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[1]!]! } },
            { ...traceInput("flat", request.snapshotStats[slots[2]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[2]!]! } },
          ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat" });
        trace.push(...builder.nodes);
        origins.set(leaf.stateKey, nodeId);
      }
    }
  }
  const declared = descriptor.valueSources ?? {};
  const actual = request.valueSources ?? {};
  for (const key of Object.keys(actual)) if (!Object.prototype.hasOwnProperty.call(declared, key))
    throw new Error(`治疗来源 #${request.id} 携带未声明的先前数值 ${key}。`);
  const keys = Object.keys(actual).sort();
  if (JSON.stringify(request.componentIds) !== JSON.stringify([...new Set(keys.map(key => actual[key]!))]))
    throw new Error(`治疗来源 #${request.id} 的先前数值组件顺序无效。`);
  for (const [key, rules] of Object.entries(declared)) {
    const id = actual[key];
    if (id === undefined) { gaps.push(`治疗来源 ${key} 使用原生保存值，但尚无创建来源 ID。`); continue; }
    const prior = records.get(id);
    const accepted = typeof rules === "string" ? [rules] : rules;
    if (!prior || prior.request.kind !== "character-healing" || prior.request.input.operation !== "source" ||
      !accepted.includes(prior.request.input.ruleId) || id >= request.id || prior.request.frame > request.frame ||
      commit(prior.request) !== commit(request) || !Object.prototype.hasOwnProperty.call(input.state, key) || origins.has(key))
      throw new Error(`治疗来源 #${request.id} 的先前数值 ${key} 身份或时序无效。`);
    const observed = resolve(prior.request, records);
    close(observed.value, prior.value, `source #${id}`);
    close(prior.value, input.state[key]!, key);
    trace.push(...prefixTrace(observed.trace, `healingSourcePrior.${id}`));
    gaps.push(...observed.explanationGaps);
    origins.set(key, `healingSourcePrior.${id}.healingSource.${id}.${prior.request.input.ruleId}`);
  }
  const pure = resolveSourceHostHealingSourceInput(input, commit(request), `healingSource.${request.id}`);
  trace.push(...pure.trace.map(node => ({ ...node, inputs: node.inputs.map(value => origins.has(value.key)
    ? { ...value, origin: { kind: "source-host-healing-source", reference: origins.get(value.key)! } } : value) })));
  const unique = new Map<string, CalculationTraceNode>();
  for (const node of trace) {
    const old = unique.get(node.id);
    if (old && JSON.stringify(old) !== JSON.stringify(node)) throw new Error(`治疗来源 #${request.id} 的重复节点冲突。`);
    unique.set(node.id, node);
  }
  return { value: pure.value, trace: [...unique.values()], explanationGaps: [...new Set([...gaps, ...pure.explanationGaps])] };
}
