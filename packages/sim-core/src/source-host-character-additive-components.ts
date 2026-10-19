/** Validate character FlatDmg components applied to one native special hit. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import type { SourceHostCalculationRecord, SourceHostCalculationRequest } from "./source-host-wire";
import type { SourceHostCalculation, SourceHostCalculationLookup } from "./source-host-formula";

type DirectRequest = Extract<SourceHostCalculationRequest, { kind: "lunar-direct" | "stellar-direct" }>;
type Resolve = (request: unknown, components: SourceHostCalculationLookup) => SourceHostCalculation;

function equal(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > 1e-10 * Math.max(1, Math.abs(expected)))
    throw new Error(`来源同击角色附加伤害 ${label} 不一致：${actual} / ${expected}`);
}

export function resolveSourceHostDirectCharacterAdditives(
  request: DirectRequest, records: ReadonlyMap<number, SourceHostCalculationRecord>, resolve: Resolve,
): { trace: CalculationTraceNode[]; explained: number; residual: number; rootId: string } {
  const applications = request.componentApplications;
  const ids = request.componentIds;
  if (new Set(ids).size !== ids.length || new Set(applications.map(row => row.id)).size !== applications.length ||
    ids.length !== applications.length || ids.some(id => !applications.some(row => row.id === id))) {
    throw new Error("直接特殊伤害的角色附加组件 ID 与原生应用记录不一致");
  }
  const trace: CalculationTraceNode[] = [];
  const builder = new TraceBuilder([]);
  let explained = 0;
  for (const application of applications) {
    const record = records.get(application.id);
    const sameHit = record?.request.kind === "character-additive" && record.request.input.phase === "hit" &&
      record.request.componentScope === "same-hit" && record.request.actorIndex === request.actorIndex &&
      record.request.attackId === request.attackId && record.request.targetKey === request.targetKey &&
      record.request.frame === request.frame && record.request.sourceFrame === request.sourceFrame &&
      record.request.snapshotFrame === request.snapshotFrame;
    const queued = record?.request.kind === "character-flat" && record.request.componentScope === "queued-attack" &&
      record.request.attackId === 0 && record.request.targetKey === 0 &&
      record.request.actorIndex === request.actorIndex && record.request.frame <= request.frame;
    if (!record || (!sameHit && !queued) || record.request.id >= request.id ||
      record.request.sourceCommit !== request.sourceCommit || application.multiplier !== 1) {
      throw new Error(`直接特殊伤害组件 #${application.id} 不属于同一原生命中`);
    }
    const calculated = resolve(record.request, records);
    equal(calculated.value, record.value, `#${application.id} 公式返回值`);
    equal(application.amount, calculated.value, `#${application.id} 实际应用量`);
    trace.push(...calculated.trace);
    explained += application.amount;
  }
  const residual = request.input.flatDamage - explained;
  const rootId = `directCharacterAdditive.${request.id}`;
  builder.add(rootId, "直接特殊伤害的实际加算来源", expr.add(expr.input("explained"), expr.input("residual")), [
    traceInput("explained", explained, "damage", "source-host-character-flat-components", "本击逐项核对的角色 FlatDmg 组件之和"),
    traceInput("residual", residual, "damage", "来源宿主本击最终字段", "尚无共享公式来源的其余 FlatDmg"),
  ], { unit: "damage", status: residual === 0 ? "applied" : "assumed",
    childIds: applications.map(row => {
      const prior = records.get(row.id)!.request;
      if (prior.kind === "character-flat") return `characterFlat.${row.id}.${prior.input.ruleId}`;
      if (prior.kind === "character-additive") return `characterAdditive.${row.id}.${prior.input.ruleId}`;
      throw new Error(`直接特殊伤害组件 #${row.id} 类型错误`);
    }),
    explanationKey: "同击角色回调核对攻击 ID 和目标；排队 FlatDmg 核对原生来源时序；最终字段仍由原生攻击提供。" });
  return { trace: [...trace, ...builder.nodes], explained, residual, rootId };
}
