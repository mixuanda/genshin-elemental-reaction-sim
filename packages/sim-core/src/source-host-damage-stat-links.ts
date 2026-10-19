/** Link one native damage trace to the exact final snapshot slots it consumed.
 * This changes provenance edges only; no damage or Go callback is recalculated. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type TraceInput } from "./calculation-trace";
import type { SourceHostDamageRequest } from "./source-host-wire";

const CLASSIC_COMMIT = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const STELLAR_COMMIT = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
// The a7 fork inserts RelicSkill and three additional attack tags before this delimiter.
const NONE_STAT_TAG: Record<string, number> = { [CLASSIC_COMMIT]: 9, [STELLAR_COMMIT]: 13 };
const ELEMENT_BONUS_SLOT: Record<string, number> = {
  pyro: 12, hydro: 13, cryo: 14, electro: 15, anemo: 16, geo: 17, dendro: 18, physical: 19,
};
const WITHOUT_ELEMENT_BONUS = new Set(["", "none", "unknown", "quicken", "frozen", "burning", "burning-fuel"]);

export interface SourceHostDamageStatLinkResult {
  trace: CalculationTraceNode[];
  explanationGaps: string[];
}

export function linkSourceHostDamageStatInputs(
  request: SourceHostDamageRequest,
  finalNodeIds: readonly string[],
  trace: readonly CalculationTraceNode[],
  explicitFinalScaling: boolean,
): SourceHostDamageStatLinkResult {
  const gaps: string[] = [];
  const linked = trace.map(node => ({ ...node, inputs: [...node.inputs], childIds: [...node.childIds] }));
  const insertBeforeDamage = (created: CalculationTraceNode[]): CalculationTraceNode[] => {
    const index = linked.findIndex(node => node.id === "sourceScalingStat");
    return index < 0 ? [...created, ...linked] : [...linked.slice(0, index), ...created, ...linked.slice(index)];
  };
  const nodes = new Map(linked.map(node => [node.id, node]));
  const connect = (nodeId: string, key: string, reference: string, value: number,
    kind: string, label: string): boolean => {
    const node = nodes.get(nodeId);
    const input = node?.inputs.find(row => row.key === key);
    if (!node || !input) return false; // Absent or inapplicable stages are not invented.
    if (input.value !== value) {
      gaps.push(`${label} ${input.value} 与可验证的来源值 ${value} 不同；未连接旧属性回执。`);
      return false;
    }
    node.inputs = node.inputs.map(row => row === input
      ? { ...row, origin: { kind, reference } } : row);
    if (!node.childIds.includes(reference)) node.childIds.push(reference);
    return true;
  };
  const producer = (consumerId: string, key: string, producerId: string): void => {
    const value = nodes.get(producerId)?.result?.value;
    if (value !== undefined) connect(consumerId, key, producerId, value, "previous-step", `${consumerId}.${key}`);
  };

  // These values are created within this same calculation, including an edited
  // final-panel calculation. They never need a historical stat-provenance edge.
  producer("sourceTalentBase", "scalingValue", "sourceScalingStat");
  producer("talentDamage", "scalingValue", "sourceTalentBase");
  producer("baseDamage", "flatDamage", "sourceFlatDamage");

  if (explicitFinalScaling) return { trace: linked, explanationGaps: gaps };
  const commit = request.sourceCommit ?? CLASSIC_COMMIT;
  const threshold = NONE_STAT_TAG[commit];
  const skippedBonusTrace: CalculationTraceNode[] = [];
  if (threshold !== undefined && request.attackTag >= threshold) {
    if (request.input.damageBonus === 0) {
      const branch = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${commit}/pkg/enemy/damage.go`]);
      branch.add("sourceNativeDamageBonusEligibility", "来源攻击标签的普通增伤资格", expr.condition("lt",
        expr.input("attackTag"), expr.input("noneStatTag"), expr.value(1), expr.value(0)), [
        traceInput("attackTag", request.attackTag, "tag", "source-host-native-attack-tag", "本次原生攻击标签"),
        traceInput("noneStatTag", threshold, "tag", "source-host-pinned-attack-tag", "本固定来源的 NoneStat 分界"),
      ], { unit: "boolean", explanationKey: "仅判断本次原生标签是否进入读取攻击者增伤槽的分支。" });
      branch.add("sourceNativeDamageBonus", "来源攻击标签跳过普通增伤", expr.value(0), [],
        { unit: "ratio", status: "not-applicable", childIds: ["sourceNativeDamageBonusEligibility"],
          applicabilityReason: "本次资格为否，原生代码保留初始零值且未读取元素或通用增伤槽；未执行的真分支不构造数值。" });
      skippedBonusTrace.push(...branch.nodes);
      connect("damageBonusMultiplier", "damageBonus", "sourceNativeDamageBonus", 0, "previous-step", "共享核心伤害加成");
    } else gaps.push("AttackTag 已进入 NoneStat 绕过分支，但原生请求的伤害加成非零；未伪造属性来源。");
  }
  const stats = request.snapshotStats;
  const hasFinalNodes = finalNodeIds.length === 26 && finalNodeIds.every(Boolean);
  if (stats.length !== 26) {
    gaps.push("本击缺少完整的 26 槽原生攻击快照；未推断属性读取或 AttackTag 增伤分支。");
    return { trace: insertBeforeDamage(skippedBonusTrace), explanationGaps: gaps };
  }
  if (!hasFinalNodes) {
    if (request.input.scaling !== 0 || request.input.flatDamage !== 0) {
      gaps.push(request.damageCategory === "transformative"
        ? "本次专用反应伤害按已捕获的原生攻击快照及组件计算，但没有完整的 26 槽属性来源回执；未将其归因到不存在的 getter。"
        : "本击没有完整的 26 槽最终属性来源节点；没有把数值输入归因到缺失的 getter 回执。");
    }
  }
  const slot = (index: number, actual: number, label: string): string | undefined => {
    if (stats[index] !== actual) {
      gaps.push(`${label} ${actual} 与来源快照槽 ${index} 的 ${stats[index]} 不同；未连接该属性来源。`);
      return undefined;
    }
    return finalNodeIds[index];
  };
  const statInput = (nodeId: string, key: string, index: number, actual: number, label: string): void => {
    if (!hasFinalNodes) return;
    const reference = slot(index, actual, label);
    if (reference) connect(nodeId, key, reference, actual, "source-host-stat-provenance", label);
  };

  const sample = request.snapshot;
  if (request.input.scalingStat === "em") {
    statInput("sourceScalingStat", "elementalMastery", 8, sample.em, "精通缩放");
  } else {
    const parts = request.input.scalingStat === "atk"
      ? [[24, sample.baseAtk], [6, sample.atkPct], [5, sample.flatAtk]]
      : request.input.scalingStat === "hp"
        ? [[23, sample.baseHp], [4, sample.hpPct], [3, sample.flatHp]]
        : [[25, sample.baseDef], [1, sample.defPct], [2, sample.flatDef]];
    (["baseStat", "statPercent", "flatStat"] as const).forEach((key, i) => {
      const [index, value] = parts[i]!;
      statInput("sourceScalingStat", key, index!, value!, `${request.input.scalingStat} 缩放 ${key}`);
    });
  }
  const nativeRefs = [
    `https://github.com/genshinsim/gcsim/blob/${request.sourceCommit ?? CLASSIC_COMMIT}/pkg/enemy/damage.go`,
    `https://github.com/genshinsim/gcsim/blob/${request.sourceCommit ?? CLASSIC_COMMIT}/pkg/core/attributes/stats.go`,
  ];
  const additions = new TraceBuilder(nativeRefs);
  const nativeStatInput = (key: string, value: number, index: number, label: string,
    unit = "ratio"): TraceInput => ({
    ...traceInput(key, value, unit, hasFinalNodes
      ? { kind: "source-host-stat-provenance", reference: finalNodeIds[index]! }
      : "source-host-captured-snapshot", label),
    context: { actorIndex: request.actorIndex, sourceCalculationId: request.id, statIndex: index,
      snapshotFrame: request.snapshotFrame },
  });
  const extraChildren = new Map<string, string[]>();

  // calculateDamageTrace clamps its EM input before the amplification step.
  // Keep that step visible when the captured source value is below zero.
  if (nodes.get("amplifyingEmBonus")?.status === "applied") {
    const rawEm = stats[8]!;
    if (sample.em === rawEm && request.input.elementalMastery === rawEm) {
      const effectiveEm = Math.max(0, rawEm);
      if (effectiveEm === rawEm) {
        statInput("amplifyingEmBonus", "elementalMastery", 8, rawEm, "增幅反应元素精通");
      } else {
        const id = "sourceCoreAmplifyingEm";
        const value = additions.add(id, "共享核心增幅精通下界", expr.max(expr.value(0), expr.input("rawElementalMastery")), [
          nativeStatInput("rawElementalMastery", rawEm, 8, "来源本击快照原元素精通", "stat"),
        ], { unit: "stat", explanationKey: "共享伤害核心在增幅反应公式前将负精通限制为零。" });
        if (hasFinalNodes) extraChildren.set(id, [finalNodeIds[8]!]);
        connect("amplifyingEmBonus", "elementalMastery", id, value, "previous-step", "增幅反应有效元素精通");
      }
    } else gaps.push("本击增幅精通与来源快照不一致；未连接旧 EM 属性来源。");
  }

  const rawCritRate = stats[9]!;
  const clampedCritRate = Math.max(0, Math.min(1, rawCritRate));
  if (sample.critRate === rawCritRate && request.input.critRate === clampedCritRate) {
    const id = "sourceNativeCritRate";
    const value = additions.add(id, "来源最终暴击率：原快照钳制", expr.max(expr.value(0), expr.min(expr.value(1), expr.input("rawCritRate"))), [
      nativeStatInput("rawCritRate", rawCritRate, 9, "来源本击快照原暴击率，钳制前值"),
    ], { unit: "ratio", explanationKey: "固定来源先把实际 CR 槽钳制到 [0,1]，再用同一次已保存随机数比较；不重新取样。" });
    if (hasFinalNodes) extraChildren.set(id, [finalNodeIds[9]!]);
    if (value === request.input.critRate) {
      connect("critRate", "critRate", id, value, "previous-step", "共享核心暴击率");
      if (!request.input.hitWeakPoint)
        connect("sourceCritOutcome", "critRate", id, value, "previous-step", "原生暴击抽样阈值");
    }
  } else gaps.push("本击最终暴击率与原快照的钳制结果不一致；没有连接旧 CR 属性来源。");
  if (sample.critDamage === request.input.critDamage)
    statInput("critDamage", "critDamage", 10, sample.critDamage, "暴击伤害");
  else gaps.push("本击最终暴击伤害与原快照不一致；没有连接旧 CD 属性来源。");

  if (threshold === undefined) {
    gaps.push("未知固定来源的 AttackTagNoneStat 分界；不归因本击普通增伤。");
  } else if (request.attackTag < threshold) {
    const element = ELEMENT_BONUS_SLOT[request.element];
    const knownNonBonus = WITHOUT_ELEMENT_BONUS.has(request.element);
    if (element === undefined && !knownNonBonus) {
      gaps.push(`元素 ${request.element} 未在固定来源增伤槽映射中核验；不连接伤害加成。`);
    } else {
      const elementSlot = element ?? (commit === STELLAR_COMMIT ? 0 : undefined);
      const generic = stats[21]!;
      const elementValue = elementSlot === undefined ? 0 : stats[elementSlot]!;
      const sourceBonus = 0 + elementValue + generic;
      if (request.input.damageBonus === sourceBonus) {
        const inputs = [
          traceInput("attackTag", request.attackTag, "tag", "source-host-native-attack-tag", "本次原生攻击标签"),
          traceInput("noneStatTag", threshold, "tag", "source-host-pinned-attack-tag", "本固定来源的 NoneStat 分界"),
          ...(elementSlot === undefined ? [] : [nativeStatInput("elementBonus", elementValue, elementSlot,
            "来源实际读取的元素或物理增伤槽")]),
          nativeStatInput("genericBonus", generic, 21, "来源实际读取的通用伤害加成槽"),
        ];
        const id = "sourceNativeDamageBonus";
        const bonusTerms = [expr.value(0), ...(elementSlot === undefined ? [] : [expr.input("elementBonus")]), expr.input("genericBonus")];
        const value = additions.add(id, "来源攻击标签决定本击伤害加成", expr.condition("lt",
          expr.input("attackTag"), expr.input("noneStatTag"), expr.add(...bonusTerms), expr.value(0)), inputs,
          { unit: "ratio",
            explanationKey: "来源 Go 仅在 AttackTag 低于本版本 NoneStat 分界时读取元素及通用增伤槽；否则直接保留零值。" });
        if (hasFinalNodes) extraChildren.set(id, [...(elementSlot === undefined ? [] : [finalNodeIds[elementSlot]!]), finalNodeIds[21]!]);
        if (value === request.input.damageBonus)
          connect("damageBonusMultiplier", "damageBonus", id, value, "previous-step", "共享核心伤害加成");
      } else gaps.push(`本击增伤 ${request.input.damageBonus} 与来源 AttackTag 分支结果 ${sourceBonus} 不同；未连接旧属性回执。`);
    }
  }

  const created = additions.nodes.map(node => ({ ...node,
    childIds: [...new Set([...node.childIds, ...(extraChildren.get(node.id) ?? [])])] }));
  return { trace: insertBeforeDamage([...skippedBonusTrace, ...created]), explanationGaps: gaps };
}
