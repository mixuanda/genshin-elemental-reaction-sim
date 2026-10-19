/** Verify source-owned shield HP creation/refresh arithmetic and its actual
 * earlier getter, snapshot, and live-shield HP sources. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { resolveSourceHostCharacterShieldInput, sourceHostCharacterShieldRuleDescriptor } from "./source-host-character-shield-formula";
import { executeSourceHostNestedStatRead, executeSourceHostStatProvenance } from "./source-host-stat-provenance";
import { SOURCE_HOST_COMMIT, type SourceHostCalculationRecord, type SourceHostCalculationRequest,
  type SourceHostCharacterShieldRequest } from "./source-host-wire";

type Resolved = { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] };
const close = (actual: number, expected: number, label: string): void => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected)))
    throw new Error(`来源护盾 ${label} 与原生状态不一致：${actual} / ${expected}`);
};
const commit = (request: { sourceCommit?: string | undefined }) => request.sourceCommit ?? SOURCE_HOST_COMMIT;
const statValue = (values: readonly number[], getter: string, statIndex?: number): number => {
  if (getter === "stat" || getter === "non-extra-stat") return values[statIndex!]!;
  const slots = getter.includes("atk") ? [24, 6, 5] : getter.includes("def") ? [25, 1, 2] : [23, 4, 3];
  return values[slots[0]!]! * (1 + values[slots[1]!]!) + values[slots[2]!]!;
};
const snapshotValue = (values: readonly number[], getter: string): number =>
  getter === "em" ? values[8]! : statValue(values, getter);
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

export function resolveSourceHostCharacterShieldRequest(request: SourceHostCharacterShieldRequest,
  records: ReadonlyMap<number, SourceHostCalculationRecord>,
  resolve: (request: SourceHostCalculationRequest, records: ReadonlyMap<number, SourceHostCalculationRecord>) => Resolved,
  verifiedFormulaLinks?: ReadonlyMap<string, string>): Resolved {
  const descriptor = sourceHostCharacterShieldRuleDescriptor(request.input.ruleId);
  const matchingActor = descriptor.character === "*" ? request.actorKey.length > 0
    : descriptor.character === "hydro-traveler"
      ? request.actorKey === "aetherhydro" || request.actorKey === "luminehydro"
      : request.actorKey === descriptor.character;
  if (request.actorIndex !== request.input.sourceHolderIndex || !matchingActor ||
    request.attackId !== 0 || request.targetKey !== 0 || request.sourceFrame !== request.frame ||
    request.componentApplications.length || (request.snapshot === null) !== (request.snapshotStats === null) ||
    (request.snapshot === null && request.snapshotFrame !== 0) ||
    (request.snapshot !== null && (request.snapshotFrame > request.frame || request.snapshotFrame < 0))) {
    throw new Error(`角色护盾 #${request.id} 的来源持有者、快照或创建身份无效`);
  }
  if (descriptor.statLeaf && descriptor.statLeaves || descriptor.snapshotLeaf && descriptor.snapshotLeaves)
    throw new Error(`角色护盾 #${request.id} 的状态叶定义重复`);
  if (request.input.ruleId === "char-shield-crystallize-base") {
    if (request.snapshot === null || request.snapshot.charLevel !== request.input.state.level)
      throw new Error(`结晶盾 #${request.id} 的查表等级不是原生成快照等级`);
  }
  if ((request.input.ruleId === "char-shield-crystallize-bonus-total") !== (request.scalarProvenance !== undefined))
    throw new Error(`角色护盾 #${request.id} 的本次护盾强效读取来源不符`);
  const leaves = descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : []);
  const reads = request.statReads ?? [];
  if (reads.length !== leaves.length || new Set(reads.map(read => read.id)).size !== reads.length ||
    reads.some(read => read.frame !== request.frame))
    throw new Error(`角色护盾 #${request.id} 的实际属性读取数量、顺序或帧不符`);
  const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${commit(request)}/`;
  const trace: CalculationTraceNode[] = [];
  const gaps: string[] = [];
  const origin = new Map<string, string>();
  for (const [index, leaf] of leaves.entries()) {
    const read = reads[index]!;
    const single = leaf.getter === "stat" || leaf.getter === "non-extra-stat";
    const selector = single ? [leaf.statIndex] : leaf.getter.includes("atk") ? [24, 6, 5]
      : leaf.getter.includes("def") ? [25, 1, 2] : [23, 4, 3];
    const expectedKind = single ? leaf.getter : "select-stat";
    if (selector.some(slot => slot === undefined) || read.kind !== expectedKind ||
      read.nonExtra !== leaf.getter.startsWith("non-extra-") ||
      JSON.stringify(read.selector) !== JSON.stringify(selector) ||
      leaf.actor === "holder" && read.actorIndex !== request.input.sourceHolderIndex ||
      leaf.actor === "request-actor" && read.actorIndex !== request.actorIndex)
      throw new Error(`角色护盾 #${request.id} 的 ${leaf.stateKey} 原生getter身份不符`);
    close(statValue(read.result, leaf.getter, leaf.statIndex), request.input.state[leaf.stateKey]!, leaf.stateKey);
    const observed = executeSourceHostNestedStatRead(read, `shieldStats.${request.id}.${index}`, sourceRoot, verifiedFormulaLinks);
    trace.push(...observed.trace);
    gaps.push(...observed.explanationGaps);
    if (single) origin.set(leaf.stateKey, observed.finalNodeIds[leaf.statIndex!]!);
    else {
      const slots = selector as number[];
      const reference = `shieldStats.${request.id}.${index}.state.${leaf.stateKey}`;
      const derived = new TraceBuilder([`${sourceRoot}pkg/core/player/character/stats.go`]);
      derived.add(reference, `${descriptor.title}：实际属性读取 ${leaf.stateKey}`,
        expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
          { ...traceInput("base", read.result[slots[0]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[0]!]! } },
          { ...traceInput("percent", read.result[slots[1]!]!, "ratio"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[1]!]! } },
          { ...traceInput("flat", read.result[slots[2]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[2]!]! } },
        ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat" });
      trace.push(...derived.nodes);
      origin.set(leaf.stateKey, reference);
    }
  }
  const snapshotLeaves = descriptor.snapshotLeaves ?? (descriptor.snapshotLeaf ? [descriptor.snapshotLeaf] : []);
  if (snapshotLeaves.length) {
    if (request.snapshot === null || request.snapshotStats === null || request.snapshot.statProvenance == null)
      throw new Error(`角色护盾 #${request.id} 缺少实际来源快照`);
    const observed = executeSourceHostStatProvenance(request.snapshot.statProvenance, request.snapshotStats,
      `shieldSnapshot.${request.id}`, false, sourceRoot, verifiedFormulaLinks);
    trace.push(...observed.trace);
    gaps.push(...observed.explanationGaps);
    for (const leaf of snapshotLeaves) {
      close(snapshotValue(request.snapshotStats, leaf.getter), request.input.state[leaf.stateKey]!, leaf.stateKey);
      if (leaf.getter === "em") origin.set(leaf.stateKey, observed.finalNodeIds[8]!);
      else {
        const slots = leaf.getter === "total-atk" ? [24, 6, 5] : [25, 1, 2];
        const reference = `shieldSnapshot.${request.id}.state.${leaf.stateKey}`;
        const derived = new TraceBuilder([`${sourceRoot}pkg/core/player/character/stats.go`]);
        derived.add(reference, `${descriptor.title}：实际快照 ${leaf.stateKey}`,
          expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
            { ...traceInput("base", request.snapshotStats[slots[0]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[0]!]! } },
            { ...traceInput("percent", request.snapshotStats[slots[1]!]!, "ratio"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[1]!]! } },
            { ...traceInput("flat", request.snapshotStats[slots[2]!]!, "stat"), origin: { kind: "source-host-stat-provenance", reference: observed.finalNodeIds[slots[2]!]! } },
          ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat" });
        trace.push(...derived.nodes);
        origin.set(leaf.stateKey, reference);
      }
    }
  } else if (request.snapshot !== null && request.snapshotStats !== null && request.snapshot.statProvenance != null) {
    gaps.push("原生创建点附带攻击快照，但本规则未把其属性槽作为状态叶；保留快照回执而不臆造用途。");
  }
  const expectedSources = descriptor.valueSources ?? {};
  const actualSources = request.valueSources ?? {};
  for (const key of Object.keys(actualSources)) if (!Object.prototype.hasOwnProperty.call(expectedSources, key))
    throw new Error(`角色护盾 #${request.id} 出现未声明的旧数值来源 ${key}`);
  const sourceKeys = Object.keys(actualSources).sort();
  const expectedIds = [...new Set(sourceKeys.map(key => actualSources[key]!))];
  if (JSON.stringify(request.componentIds) !== JSON.stringify(expectedIds))
    throw new Error(`角色护盾 #${request.id} 的旧数值来源组件顺序无效`);
  for (const [key, rule] of Object.entries(expectedSources)) {
    const id = actualSources[key];
    if (id === undefined) { gaps.push(`角色护盾 ${key} 使用实际旧值，但旧护盾 HP 来源没有可用计算 ID。`); continue; }
    const prior = records.get(id);
    const accepted = typeof rule === "string" ? [rule] : rule;
    const validKind = prior?.request.kind === "character-shield"
      ? accepted.includes(prior.request.input.ruleId) && prior.request.input.sourceHolderIndex === request.input.sourceHolderIndex
      : prior?.request.kind === "player-shield" && prior.request.input.output === "hpAfter"
        && accepted.includes("player-shield-hpAfter") && prior.request.actorIndex === request.actorIndex;
    if (key === "oldHP" && prior?.request.kind === "character-shield" &&
      (sourceHostCharacterShieldRuleDescriptor(prior.request.input.ruleId).resultUnit ?? "HP") !== "HP")
      throw new Error(`角色护盾 #${request.id} 的旧 HP 不能来自非 HP 公式`);
    if (!prior || !validKind || id >= request.id || prior.request.frame > request.frame ||
      commit(prior.request) !== commit(request) ||
      !Object.prototype.hasOwnProperty.call(request.input.state, key) || origin.has(key))
      throw new Error(`角色护盾 #${request.id} 的旧数值来源 ${key} 身份、时序或状态叶无效`);
    const resolved = resolve(prior.request, records);
    close(resolved.value, prior.value, `old source #${id}`);
    close(prior.value, request.input.state[key]!, key);
    trace.push(...prefixTrace(resolved.trace, `shieldSource.${id}`));
    gaps.push(...resolved.explanationGaps);
    origin.set(key, prior.request.kind === "character-shield"
      ? `shieldSource.${id}.characterShield.${id}.${prior.request.input.ruleId}`
      : `shieldSource.${id}.shieldHpAfter`);
  }
  const pure = resolveSourceHostCharacterShieldInput(request.input, commit(request), `characterShield.${request.id}`);
  trace.push(...pure.trace.map(node => ({ ...node, inputs: node.inputs.map(value => origin.has(value.key)
    ? { ...value, origin: { kind: "source-host-shield-state", reference: origin.get(value.key)! } } : value) })));
  const unique = new Map<string, CalculationTraceNode>();
  for (const node of trace) {
    const old = unique.get(node.id);
    if (old && JSON.stringify(old) !== JSON.stringify(node)) throw new Error(`角色护盾 #${request.id} 的来源节点重复冲突`);
    unique.set(node.id, node);
  }
  return { value: pure.value, trace: [...unique.values()], explanationGaps: [...new Set([...gaps, ...pure.explanationGaps])] };
}
