/** Links the actual native healing stages; state mutations remain in Go. */
import { resolveSourceHostHealingInput } from "./source-host-healing-formula";
import { sourceHostHealingSourceRuleDescriptor } from "./source-host-healing-source-formula";
import { resolveSourceHostHealingSourceRequest } from "./source-host-healing-source-request";
import { SOURCE_HOST_COMMIT, type SourceHostCalculationRecord, type SourceHostHealingRequest } from "./source-host-wire";
import type { CalculationTraceNode } from "./calculation-trace";

type Resolved = { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] };
const terminals = { source: "source", base: "base", bonus: "bonus", amount: "final", receive: "received",
  "receive-delegation": "delegated", "receive-conversion": "converted", "receive-override": "received",
  overheal: "overheal" } as const;
export function resolveSourceHostHealingRequest(request: SourceHostHealingRequest,
  records: ReadonlyMap<number, SourceHostCalculationRecord>,
  resolve: (request: unknown, records: ReadonlyMap<number, SourceHostCalculationRecord>) => Resolved,
  verifiedFormulaLinks?: ReadonlyMap<string, string>): Resolved {
  const input = request.input;
  if (request.componentApplications.length) throw new Error("治疗请求不能含伤害应用组件。");
  if (input.operation === "source") {
    if (request.statRead !== undefined || request.scalarProvenance !== undefined)
      throw new Error("治疗来源算式不能携带模板治疗的额外读取。");
    return resolveSourceHostHealingSourceRequest(request, records, resolve, verifiedFormulaLinks);
  }
  if (request.statReads !== undefined || request.valueSources !== undefined ||
    request.snapshot !== null || request.snapshotStats !== null)
    throw new Error("模板治疗阶段不能携带来源生成时的快照或状态叶。");
  const overrideActor = input.operation === "receive-conversion"
    || (input.operation === "receive-override" && input.branch === "clorinde-converted")
    || (input.operation === "receive-delegation" && input.branch.startsWith("clorinde-"))
    ? "clorinde"
    : input.operation === "receive-override" || input.operation === "receive-delegation"
      ? "arlecchino" : undefined;
  if (overrideActor && request.actorKey !== overrideActor)
    throw new Error(`角色治疗覆盖分支与实际角色 ${request.actorKey} 不匹配。`);
  const result = resolveSourceHostHealingInput(input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `healing.${request.id}`);
  const upstream: CalculationTraceNode[] = [];
  const links = new Map<string, string>();
  if (input.operation === "base" || input.operation === "bonus") {
    if (request.componentIds.length > 1) throw new Error("治疗基础或加成阶段只能链接一个真实 HealInfo 字段来源。");
    const id = request.componentIds[0];
    if (id !== undefined) {
      const row = records.get(id);
      if (!row || row.request.kind !== "character-healing" || row.request.input.operation !== "source" ||
        id >= request.id || row.request.frame > request.frame ||
        (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT))
        throw new Error(`治疗 HealInfo 字段缺少实际来源计算 #${id}。`);
      const unit = sourceHostHealingSourceRuleDescriptor(row.request.input.ruleId).resultUnit;
      const expectedUnit = input.operation === "bonus" || input.healType === "percent" ? "ratio" : "HP";
      if (input.operation === "bonus" || input.healType !== "unsupported") {
        if (unit !== expectedUnit) throw new Error("治疗 HealInfo 字段与来源公式的绝对量或比例单位不符。");
      }
      const observed = resolve(row.request, records);
      if (observed.value !== row.value || row.value !== (input.operation === "bonus" ? input.infoBonus : input.sourceAmount))
        throw new Error(`治疗 HealInfo 字段与来源公式 #${id} 数值不符。`);
      upstream.push(...observed.trace);
      result.explanationGaps.push(...observed.explanationGaps);
      links.set(input.operation === "bonus" ? "infoBonus" : "sourceAmount",
        `healingSource.${id}.${row.request.input.ruleId}`);
    } else result.explanationGaps.push(`本次 HealInfo.${input.operation === "bonus" ? "Bonus" : "Src"} 未附先前生成公式 ID；沿用原生字段值，不声称已解释其来源。`);
  }
  const delegateRecord = input.operation === "receive" && request.componentIds.length === 1
    ? records.get(request.componentIds[0]!) : undefined;
  const delegated = delegateRecord?.request.kind === "character-healing"
    && delegateRecord.request.input.operation === "receive-delegation";
  const overhealReceiveRecord = input.operation === "overheal" && request.componentIds.length === 2
    ? records.get(request.componentIds[1]!) : undefined;
  const overhealReceiveOperation = overhealReceiveRecord?.request.kind === "character-healing"
    && overhealReceiveRecord.request.input.operation === "receive-override" ? "receive-override" : "receive";
  const expected = input.operation === "base" || input.operation === "bonus" ? request.componentIds.length ? ["source"] : []
    : input.operation === "amount" ? ["base", "bonus"]
    : input.operation === "receive" ? (request.componentIds.length ? [delegated ? "receive-delegation" : "amount"] : [])
    : input.operation === "receive-delegation" || input.operation === "receive-conversion" ? ["amount"]
    : input.operation === "receive-override" ? (input.branch === "clorinde-converted" ? ["amount", "receive-conversion"] : ["amount"])
    : input.operation === "overheal" ? (request.componentIds.length === 2 ? ["amount", overhealReceiveOperation] : ["amount"]) : [];
  if (request.componentIds.length !== expected.length) throw new Error("治疗阶段缺少本次前置公式。");
  for (const [index, id] of request.componentIds.entries()) {
    if (input.operation === "base" || input.operation === "bonus") continue;
    const record = records.get(id);
    if (!record || record.request.kind !== "character-healing" || record.request.input.operation !== expected[index]
      || id >= request.id || record.request.actorIndex !== request.actorIndex || record.request.frame !== request.frame
      || record.request.ability !== request.ability || record.request.sourceCommit !== request.sourceCommit)
      throw new Error(`治疗前置公式 #${id} 的阶段、角色、帧或来源不一致。`);
    const prior = resolve(record.request, records);
    if (prior.value !== record.value) throw new Error(`治疗前置公式 #${id} 不能精确复现。`);
    const key = input.operation === "amount" ? (index === 0 ? "baseAmount" : "bonusMultiplier")
      : input.operation === "receive" || input.operation === "receive-delegation" || input.operation === "receive-conversion"
        ? "finalAmount"
      : input.operation === "receive-override" ? (index === 0 ? "finalAmount" : "convertedAmount")
      : index === 1 ? "receivedAmount" : undefined;
    if (key) {
      if ((input as unknown as Record<string, unknown>)[key] !== record.value) throw new Error(`治疗阶段的 ${key} 与实际前置结果不一致。`);
      links.set(key, `healing.${id}.${terminals[record.request.input.operation]}`);
    }
    upstream.push(...prior.trace);
    result.explanationGaps.push(...prior.explanationGaps);
  }
  const needsHp = (input.operation === "base" && input.healType === "percent") || input.operation === "overheal";
  if (needsHp) {
    const read = request.statRead;
    if (!read || read.kind !== "select-stat" || read.actorIndex !== request.actorIndex || read.frame !== request.frame
      || JSON.stringify(read.selector) !== "[23,4,3]") throw new Error("治疗缺少本次实际 MaxHP 属性读取。");
    const hp = read.result[23]! * (1 + read.result[4]!) + read.result[3]!;
    const observed = input.operation === "overheal" ? input.maxHpForOverheal : input.healType === "percent" ? input.maxHpForBase : 0;
    if (hp !== observed) throw new Error("治疗 MaxHP 与本次实际属性读取不一致。");
  } else if (request.statRead) throw new Error("此治疗阶段不应包含 MaxHP 属性读取。");
  if (input.operation === "bonus" && !request.scalarProvenance) throw new Error("治疗加成缺少实际 HealBonus 读取。");
  const nodes = [...upstream, ...result.trace.map(node => ({ ...node, inputs: node.inputs.map(value => {
    const reference = links.get(value.key);
    return reference ? { ...value, origin: { kind: "shared-core-execution", reference } } : value;
  }) }))];
  return { ...result, trace: [...new Map(nodes.map(node => [node.id, node])).values()], explanationGaps: [...new Set(result.explanationGaps)] };
}
