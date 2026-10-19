/** Bind a DrainInfo.Amount formula to the native getter reads and saved values. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { resolveSourceHostDrainSourceInput, sourceHostDrainSourceRuleDescriptor } from "./source-host-drain-source-formula";
import { executeSourceHostNestedStatRead } from "./source-host-stat-provenance";
import { SOURCE_HOST_COMMIT, type SourceHostCalculationRecord, type SourceHostCalculationRequest,
  type SourceHostDrainSourceRequest } from "./source-host-wire";

type Resolved = { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] };
const canonicalActorKeys: Readonly<Record<string, string>> = {
  kuki: "kukishinobu",
  sara: "kujousara",
};
const commit = (request: { sourceCommit?: string | undefined }) => request.sourceCommit ?? SOURCE_HOST_COMMIT;
const close = (actual: number, expected: number, label: string): void => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected)))
    throw new Error(`Drain 来源 ${label} 与原生值不一致：${actual} / ${expected}`);
};
const statValue = (values: readonly number[], getter: string, statIndex?: number): number => {
  if (getter === "stat" || getter === "non-extra-stat" || getter === "stats-stat") return values[statIndex!]!;
  const slots = getter.includes("atk") ? [24, 6, 5] : getter.includes("def") ? [25, 1, 2] : [23, 4, 3];
  return values[slots[0]!]! * (1 + values[slots[1]!]!) + values[slots[2]!]!;
};
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

export function resolveSourceHostDrainSourceRequest(request: SourceHostDrainSourceRequest,
  records: ReadonlyMap<number, SourceHostCalculationRecord>,
  resolve: (request: SourceHostCalculationRequest, records: ReadonlyMap<number, SourceHostCalculationRecord>) => Resolved,
  verifiedFormulaLinks?: ReadonlyMap<string, string>): Resolved {
  const input = request.input;
  const descriptor = sourceHostDrainSourceRuleDescriptor(input.ruleId);
  const travelerElement = descriptor.character.endsWith("-traveler")
    ? descriptor.character.slice(0, -"-traveler".length) : undefined;
  const matchingActor = descriptor.character === "*" ? request.actorKey.length > 0
    : travelerElement !== undefined ? request.actorKey === `aether${travelerElement}` || request.actorKey === `lumine${travelerElement}`
      : request.actorKey === (canonicalActorKeys[descriptor.character] ?? descriptor.character);
  if (!matchingActor || request.actorIndex !== input.sourceHolderIndex || request.attackId !== 0 ||
    request.targetKey !== 0 || request.sourceFrame !== request.frame || request.snapshot !== null ||
    request.snapshotStats !== null || request.snapshotFrame !== 0 || request.componentApplications.length)
    throw new Error(`Drain 来源 #${request.id} 的持有者或创建身份无效。`);
  if (descriptor.statLeaf && descriptor.statLeaves) throw new Error(`Drain 来源 #${request.id} 的状态叶重复定义。`);
  const leaves = descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : []);
  const reads = request.statReads ?? [];
  if (reads.length !== leaves.length || new Set(reads.map(read => read.id)).size !== reads.length ||
    reads.some(read => read.frame !== request.frame))
    throw new Error(`Drain 来源 #${request.id} 的实际属性读取数量或时点不符。`);
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
    if (slots.some(slot => slot === undefined) || leaf.getter === "stats-stat" && statIndex === undefined ||
      read.kind !== (statsGetter ? "stats" : single ? leaf.getter : "select-stat") ||
      read.nonExtra !== leaf.getter.startsWith("non-extra-") ||
      JSON.stringify(read.selector) !== JSON.stringify(slots) ||
      leaf.actor === "holder" && read.actorIndex !== input.sourceHolderIndex ||
      leaf.actor === "request-actor" && read.actorIndex !== request.actorIndex)
      throw new Error(`Drain 来源 #${request.id} 的 ${leaf.stateKey} getter 身份不符。`);
    close(statValue(read.result, leaf.getter, statIndex), input.state[leaf.stateKey]!, leaf.stateKey);
    const observed = executeSourceHostNestedStatRead(read, `drainSourceStats.${request.id}.${index}`, root, verifiedFormulaLinks);
    trace.push(...observed.trace);
    gaps.push(...observed.explanationGaps);
    if (single) origins.set(leaf.stateKey, observed.finalNodeIds[statIndex!]!);
    else {
      const s = statsGetter ? leaf.getter.includes("atk") ? [24, 6, 5]
        : leaf.getter.includes("def") ? [25, 1, 2] : [23, 4, 3] : slots as number[];
      const nodeId = `drainSourceStats.${request.id}.${index}.state.${leaf.stateKey}`;
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
  const declared = descriptor.valueSources ?? {};
  const actual = request.valueSources ?? {};
  for (const key of Object.keys(actual)) if (!Object.prototype.hasOwnProperty.call(declared, key))
    throw new Error(`Drain 来源 #${request.id} 携带未声明的先前数值 ${key}。`);
  const keys = Object.keys(actual).sort();
  if (JSON.stringify(request.componentIds) !== JSON.stringify([...new Set(keys.map(key => actual[key]!))]))
    throw new Error(`Drain 来源 #${request.id} 的先前数值组件顺序无效。`);
  for (const [key, rules] of Object.entries(declared)) {
    const id = actual[key];
    if (id === undefined) {
      if (descriptor.initialZeroKeys?.includes(key) && input.state[key] === 0) continue;
      gaps.push(`Drain 来源 ${key} 使用原生保存值，但尚无创建来源 ID。`);
      continue;
    }
    const prior = records.get(id);
    const accepted = typeof rules === "string" ? [rules] : rules;
    const priorDrainAmount = accepted.includes("prior-drain-amount") && prior !== undefined &&
      (prior.request.kind === "character-drain" || prior.request.kind === "player-manual-incoming" ||
        prior.request.kind === "player-incoming" || prior.request.kind === "player-shield-min");
    const exactRule = prior?.request.kind === "character-drain" && accepted.includes(prior.request.input.ruleId);
    if (!prior || !priorDrainAmount && !exactRule ||
      id >= request.id || prior.request.frame > request.frame || commit(prior.request) !== commit(request) ||
      !Object.prototype.hasOwnProperty.call(input.state, key) || origins.has(key))
      throw new Error(`Drain 来源 #${request.id} 的先前数值 ${key} 身份或时序无效。`);
    const observed = resolve(prior.request, records);
    close(observed.value, prior.value, `source #${id}`);
    close(prior.value, input.state[key]!, key);
    // Character Drain nodes already have stable calculation-ID names. Copying
    // them without a path prefix keeps the Redmane pool dependency diamond a
    // shared DAG rather than duplicating every ancestor for each route.
    const externalPrefix = `drainExternal.${id}`;
    trace.push(...(prior.request.kind === "character-drain" ? observed.trace : prefixTrace(observed.trace, externalPrefix)));
    gaps.push(...observed.explanationGaps);
    const finalId = observed.trace.at(-1)?.id;
    if (finalId) origins.set(key, prior.request.kind === "character-drain" ? finalId : `${externalPrefix}.${finalId}`);
  }
  const pure = resolveSourceHostDrainSourceInput(input, commit(request), `drainSource.${request.id}`);
  trace.push(...pure.trace.map(node => ({ ...node, inputs: node.inputs.map(value => origins.has(value.key)
    ? { ...value, origin: { kind: "source-host-drain-source", reference: origins.get(value.key)! } } : value) })));
  const unique = new Map<string, CalculationTraceNode>();
  for (const node of trace) {
    const previous = unique.get(node.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(node))
      throw new Error(`Drain 来源 #${request.id} 的重复节点冲突。`);
    unique.set(node.id, node);
  }
  return { value: pure.value, trace: [...unique.values()], explanationGaps: [...new Set([...gaps, ...pure.explanationGaps])] };
}
