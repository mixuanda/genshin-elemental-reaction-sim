/** Link a recorded Mult producer to the actual final attack scaling, if the
 * native source preserved that value or exported every later AttackMod write. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { sourceHostCharacterMultiplierRuleDescriptor } from "./source-host-character-multiplier-formula";
import { sourceHostStatProvenanceSchema } from "./source-host-stat-provenance";
import { SOURCE_HOST_COMMIT, type SourceHostCalculationRecord, type SourceHostDamageRequest } from "./source-host-wire";

type Lookup = ReadonlyMap<number, SourceHostCalculationRecord>;
type MultiplierConsumer = Pick<SourceHostDamageRequest,
  "id" | "actorIndex" | "frame" | "sourceCommit" | "snapshot" | "input" | "multiplierCalculationId">;
type Resolve = (request: SourceHostCalculationRecord["request"], components: Lookup) =>
  { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] };

export function resolveSourceHostDamageMultiplierLink(request: MultiplierConsumer, components: Lookup, resolve: Resolve):
  { trace: CalculationTraceNode[]; origin?: { kind: string; reference: string }; explanationGaps: string[] } {
  const id = request.multiplierCalculationId;
  if (id === undefined) return { trace: [], explanationGaps: [] };
  const producer = components.get(id);
  if (!producer || producer.request.kind !== "character-multiplier" || producer.request.id !== id ||
    id >= request.id || producer.request.actorIndex !== request.actorIndex ||
    producer.request.input.sourceHolderIndex !== request.actorIndex || producer.request.frame > request.frame ||
    (producer.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
    (sourceHostCharacterMultiplierRuleDescriptor(producer.request.input.ruleId).resultUnit ?? "ratio") !== "ratio")
    throw new Error(`来源伤害 #${request.id} 的攻击倍率生产公式 #${id} 身份或单位无效`);
  const historical = resolve(producer.request, components);
  if (historical.value !== producer.value) throw new Error(`来源攻击倍率生产公式 #${id} 无法精确复现`);
  const trace = [...historical.trace];
  const originalReference = `characterMultiplier.${id}.${producer.request.input.ruleId}`;
  if (producer.value === request.input.scaling)
    return { trace, origin: { kind: "source-host-character-multiplier", reference: originalReference },
      explanationGaps: historical.explanationGaps };

  const observed = request.snapshot.statProvenance == null ? null
    : sourceHostStatProvenanceSchema.parse(request.snapshot.statProvenance);
  const changes = observed?.attackReads.flatMap(read => read.frame < producer.request.frame ? [] :
    read.steps.flatMap(step => step.attackChanges.filter(change => change.field === "Mult")
      .map(change => ({ ...change, readId: read.id, modifierKey: step.key })))) ?? [];
  let current = producer.value;
  let complete = changes.length > 0;
  const mutation = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${request.sourceCommit ?? SOURCE_HOST_COMMIT}/pkg/core/player/character/stats.go`]);
  let previous = originalReference;
  for (const [index, change] of changes.entries()) {
    if (current !== change.before) { complete = false; break; }
    const reference = `characterMultiplier.${request.id}.attackMod.${index}`;
    const replayed = mutation.add(reference, `${change.modifierKey}：命中前 Mult 实际修改`, expr.add(expr.input("before"), expr.input("observedDelta")), [
      traceInput("before", change.before, "ratio", { kind: "source-host-character-multiplier", reference: previous },
        `原生 ${change.readId} 中该 AttackMod 调用前的倍率`),
      traceInput("observedDelta", change.after - change.before, "ratio", "source-host-native-attack-mod",
        `原生 ${change.modifierKey} 一次 Amount 对 Mult 的已观察差值，内部公式未在此推断`),
    ], { unit: "ratio", status: "assumed", explanationKey: "沿同次真实 AttackMod 回执保存前后值；差值不冒充已展开的闭包公式。" });
    if (replayed !== change.after) { complete = false; break; }
    previous = reference;
    current = change.after;
  }
  if (complete && current === request.input.scaling)
    return { trace: [...trace, ...mutation.nodes], origin: { kind: "source-host-character-multiplier", reference: previous },
      explanationGaps: [...historical.explanationGaps, "攻击倍率生产值之后的 AttackMod Mult 修改已按真实回执接入；该闭包内部算式仍未展开。"] };
  return { trace, explanationGaps: [...historical.explanationGaps,
    `攻击倍率 #${id} 曾计算 ${producer.value}，本次实际伤害倍率为 ${request.input.scaling}；后续原生修改没有完整可连接回执，最终倍率仍按已观察字段读取。`] };
}
