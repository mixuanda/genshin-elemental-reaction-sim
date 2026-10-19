/** The a7 source host supplies actual Stellar state, contributors and native draws. */
import {
  calculateConditionedSpecial, SPECIAL_FORMULA_RULES, SPECIAL_RANK_WEIGHTS,
  STELLAR_CONDUCT_APPLICATION_MULTIPLIERS,
  type ConditionedSpecialCalculation, type RecordedSpecialCriticalExecution, type SpecialContributor,
} from "@genshin-dps-lab/reaction-formulas";
import { calculateResistanceMultiplierTrace, reactionLevelBaseDamage } from "./calculator-formula";
import { expr, traceInput, TraceBuilder, type CalculationTraceNode } from "./calculation-trace";
import { resolveSourceHostDirectCharacterAdditives } from "./source-host-character-additive-components";
import { resolveSourceHostDamageMultiplierLink } from "./source-host-character-multiplier-request";
import type { SourceHostCalculationRecord, SourceHostStellarContributorRequest, SourceHostStellarRequest } from "./source-host-wire";
import type { SourceHostCalculation, SourceHostCalculationLookup } from "./source-host-formula";

const revision = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${revision}/`;
const sources = [SPECIAL_FORMULA_RULES.stellar.source,
  `${sourceRoot}pkg/reactable/stellarswirl.go`, `${sourceRoot}pkg/reactable/stellarswirl_gadget.go`,
  `${sourceRoot}pkg/reactable/stellarconduct.go`, `${sourceRoot}pkg/enemy/damage.go`,
  `${sourceRoot}pkg/core/combat/reaction.go`, `${sourceRoot}pkg/core/combat/reaction.dm.go`];
const nativeRandom = `固定 gcsim ${revision} 的 math/rand 实际抽样`;
const contributorId = (index: number) => `source-actor-${String(index).padStart(4, "0")}`;
const rankedBranches = ["stellar-swirl-anemo-reaction", "stellar-swirl-vortex-1", "stellar-swirl-vortex-2"] as const;
export type SourceHostStellarLookup = ReadonlyMap<number, SourceHostCalculationRecord>;

const recorded = (key: string, value: number, unit: string) => traceInput(key, value, unit, "a7 来源宿主本次实际读取", `星反应输入：${key}`);
const stageTitles: Record<string, string> = {
  "special.levelBase": "来源等级反应基础值", "special.directBase": "直接星伤的属性与天赋倍率",
  "special.em": "星反应元素精通提升", "special.scaled": "星反应基础伤害与专属基础提升",
  "special.augmented": "星反应精通、反应提升与加算", "special.critChance": "参与者实际暴击率",
  "special.critical": "参与者暴击倍率", "special.contribution": "参与者实际贡献",
  "special.weighted": "来源稳定排名与权重", "special.outcome": "本次星反应加权合计",
  "special.probability": "本次抽样组合概率", "special.recordedNativeCritical": "原生实际暴击判定",
  "special.sampledCritical": "本次抽样暴击判定", "special.expectedTerm": "概率加权伤害项",
  "special.expected": "预期伤害合计", "special.columbinaMoonsign": "月兆基础加成",
  "special.baseBonusTotal": "专属基础加成合计",
  "special.resistance": "目标实际抗性倍率",
};
function equal(actual: number, expected: number, field: string) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > 1e-10 * Math.max(1, Math.abs(expected))) {
    throw new Error(`Stellar source ${field} differs from shared formula: ${actual} / ${expected}`);
  }
}
function context(branch: ConditionedSpecialCalculation["branch"], contributors: SpecialContributor[], resistance: number, count?: number): ConditionedSpecialCalculation {
  return { branch, ruleVersion: SPECIAL_FORMULA_RULES.stellar.id, context: {
    mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: [
      "固定 a7 来源宿主执行真实反应与贡献者窗口；这仍不是当前游戏机制的独立验证。",
      "每个暴击随机数由 Go 在原位置消耗一次；共享公式只重放实际结果。",
    ],
  }, contributors, effectiveResistance: resistance, ...(count === undefined ? {} : { polestarApplicationCount: count }) };
}
function execute(input: ConditionedSpecialCalculation, draws: RecordedSpecialCriticalExecution["draws"],
  request: SourceHostStellarRequest,
  contributorRequests: readonly Pick<SourceHostStellarRequest, "id" | "frame" | "snapshotFrame" | "targetKey">[]) {
  const id = request.id;
  const trace = new TraceBuilder(sources);
  const result = calculateConditionedSpecial(input, stage => trace.add(
    `stellar.${id}.${stage.id}`, stageTitles[stage.titleKey] ?? stage.titleKey, stage.expression,
    Object.entries(stage.values).map(([key, value]) => {
      const actorStage = stage.id.match(/^(?:contributor|sampled)\.(\d+)\./);
      const actor = actorStage === null ? undefined : Number(actorStage[1]);
      const owner = actor === undefined ? undefined : contributorRequests[actor];
      return { ...recorded(key, value,
      key === "EM" || key === "stat" ? "stat" : key === "roll" ? "probability" : key === "critical" ? "boolean" :
        ["base", "scaled", "augmented", "contribution", "levelBase", "specialAdditive"].includes(key) || /^rank\d/.test(key) ? "damage" : "ratio"),
        context: { sourceCalculationId: owner?.id ?? id, executionFrame: owner?.frame ?? request.frame,
          snapshotFrame: owner?.snapshotFrame ?? request.snapshotFrame, targetKey: owner?.targetKey ?? request.targetKey,
          ...(owner === undefined ? {} : { contributorId: input.contributors[actor!]!.id }) } };
    }),
    { unit: stage.unit, ruleId: SPECIAL_FORMULA_RULES.stellar.id,
      explanationKey: "按固定来源本次实际取样、暴击结果与共享星反应公式逐项计算；贡献者先各自暴击，再稳定排序加权。",
      sourceRefs: [...stage.sourceRefs, ...sources], childIds: stage.dependencies.map(key => `stellar.${id}.${key}`) }),
    { source: nativeRandom, draws, onlyRecorded: true });
  if (result.status !== "calculated" || !result.sampled) throw new Error(result.blockers.join("; ") || "Stellar formula produced no actual outcome");
  return { result, trace: trace.nodes };
}
function contributor(request: SourceHostStellarContributorRequest): SpecialContributor {
  const c = request.input;
  if (!rankedBranches.includes(c.branch) || request.componentIds.length || request.componentApplications.length) throw new Error("Stellar contributor has an unsupported branch or recursive component");
  equal(c.levelBaseDamage, reactionLevelBaseDamage(c.characterLevel), "level base");
  const coefficient = c.branch === "stellar-swirl-anemo-reaction" ? 0.75 : c.branch === "stellar-swirl-vortex-1" ? 2 : 3;
  equal(c.reactionMultiplier, coefficient, "source Swirl multiplier");
  return { id: contributorId(request.actorIndex), base: { kind: "level-base", characterLevel: c.characterLevel,
    value: c.levelBaseDamage, evidence: "provisional", sourceRefs: sources },
    elementalMastery: c.elementalMastery, specialBaseBonus: c.baseDamageBonus, reactionBonus: c.reactionBonus,
    // a7 multiplies CalcSpecialReactionDmg (including FlatDmg) by 0.75/2/3.
    specialAdditive: c.reactionMultiplier * c.flatDamage, elevationMultiplier: 1 + c.elevation,
    critRate: c.critRate, critDamage: c.critDamage, modifierSourceRefs: sources };
}
function draw(request: SourceHostStellarContributorRequest): RecordedSpecialCriticalExecution["draws"][number] {
  return { contributorId: contributorId(request.actorIndex), roll: request.input.critRoll,
    critical: request.input.isCrit, guaranteed: false };
}
export interface SourceHostStellarFormulaResult { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

type Resolve = (request: unknown, components: SourceHostCalculationLookup, options?: { explicitFinalScaling?: boolean }) => SourceHostCalculation;
export function resolveSourceHostStellarRequest(request: SourceHostStellarRequest, components: SourceHostStellarLookup, resolve: Resolve, edited = false): SourceHostStellarFormulaResult {
  if (request.sourceCommit !== revision) throw new Error("Stellar requests require the archived a7 source identity");
  const gaps = ["a7 星反应与角色修改器仍属固定来源暂定实现；归档漩涡的计数、实体类型、范围与时间规则和指南存在冲突。"];
  if (request.kind === "stellar-conduct-event") {
    if (request.input.branch !== "stellar-conduct-event" || request.componentIds.length || request.componentApplications.length) throw new Error("Stellar-Conduct event is state only");
    const output = calculateConditionedSpecial(context("stellar-conduct-event", [], 0));
    if (output.status !== "non-damaging") throw new Error("Stellar-Conduct event must not deal damage");
    const trace = new TraceBuilder(sources);
    trace.add("stellarConductEvent", "实际星导状态事件", expr.value(0), [], { unit: "damage", status: "not-applicable",
      explanationKey: "a7 来源事件创建或刷新极星辉域；这次事件本身不造成 HP 伤害。" });
    return { value: 0, trace: trace.nodes, explanationGaps: gaps };
  }
  if (request.kind === "stellar-contributor") {
    const c = contributor(request);
    const output = execute(context(request.input.branch, [c], 0), [draw(request)], request, [request]);
    return { value: output.result.sampled!.rankedContributions[0]!.contribution, trace: output.trace, explanationGaps: gaps };
  }
  if (request.kind === "stellar-ranked") {
    const records = request.componentIds.map(id => {
      const row = components.get(id);
      if (!row || row.request.kind !== "stellar-contributor") throw new Error(`Missing Stellar contributor #${id}`);
      if (row.request.input.branch !== request.input.branch) throw new Error("Stellar contributor branch differs from ranked event");
      return { request: row.request, value: row.value };
    });
    if (!records.length || records.length > 4 || new Set(records.map(row => row.request.actorIndex)).size !== records.length ||
      records.some((row, index) => index > 0 && row.request.actorIndex <= records[index - 1]!.request.actorIndex)) throw new Error("Stellar contributor order must match source actor iteration");
    const output = execute(context(request.input.branch, records.map(row => contributor(row.request)), 0), records.map(row => draw(row.request)), request, records.map(row => row.request));
    const ranked = output.result.sampled!.rankedContributions;
    if (ranked.length !== request.input.rankedContributorIds.length || ranked.length !== request.componentApplications.length || request.input.weights.length !== SPECIAL_RANK_WEIGHTS.length) throw new Error("Stellar ranked receipt length mismatch");
    request.input.weights.forEach((weight, index) => equal(weight, SPECIAL_RANK_WEIGHTS[index]!, "rank weight"));
    for (const [index, row] of ranked.entries()) {
      const source = records.find(record => contributorId(record.request.actorIndex) === row.contributorId)!;
      equal(row.contribution, source.value, "contributor value");
      equal(request.input.rankedContributorIds[index]!, source.request.id, "ranked ID");
      const applied = request.componentApplications[index]!;
      equal(applied.id, source.request.id, "applied contributor ID");
      equal(applied.multiplier, row.weight, "applied weight");
      equal(applied.amount, row.weightedDamage, "applied weighted damage");
    }
    if (request.input.displayIsCrit !== ranked[0]!.critical) throw new Error("Stellar displayed critical flag differs from source stable ranking");
    return { value: output.result.sampled!.damage, trace: output.trace, explanationGaps: gaps };
  }
  if (request.kind === "stellar-direct") {
    const c = request.input;
    if (c.defenseIgnore !== 1 || c.damageBonus !== 0 || c.amped) throw new Error("Stellar special damage cannot use ordinary defense, damage bonus or amplification");
    const additions = resolveSourceHostDirectCharacterAdditives(request, components, resolve);
    const multiplier = resolveSourceHostDamageMultiplierLink(request, components, resolve);
    gaps.push(...multiplier.explanationGaps);
    const count = c.branch === "stellar-conduct-direct" ? c.polestarApplicationCount : undefined;
    if (count !== undefined) {
      if (!Number.isInteger(count) || count < 0 || count >= STELLAR_CONDUCT_APPLICATION_MULTIPLIERS.length) throw new Error("Polestar field count is outside a7 source table");
    } else if (c.branch === "stellar-conduct-direct") throw new Error("Direct Stellar-Conduct requires the actual Polestar published count");
    const panel = new TraceBuilder(sources);
    const stats = request.snapshot;
    const fields = c.scalingStat === "atk" ? [stats.baseAtk, stats.atkPct, stats.flatAtk]
      : c.scalingStat === "hp" ? [stats.baseHp, stats.hpPct, stats.flatHp]
        : c.scalingStat === "def" ? [stats.baseDef, stats.defPct, stats.flatDef] : null;
    const finalStat = edited
      ? panel.add("stellarDirectFinalStat", "编辑后的直接星伤最终属性", expr.input("scalingValue"), [
        traceInput("scalingValue", c.scalingValue, "stat", "用户独立数值编辑", "编辑后的本次最终缩放属性"),
      ], { unit: "stat", status: "assumed", explanationKey: "编辑值直接作为最终缩放属性；旧来源快照只保留为历史证据。" })
      : fields === null
        ? panel.add("stellarDirectFinalStat", "直接星伤实际精通快照", expr.input("EM"), [
          recorded("EM", stats.em, "stat"),
        ], { unit: "stat", explanationKey: "原生来源本击精通用作天赋缩放属性；其专属反应精通乘区另行计算。" })
        : panel.add("stellarDirectFinalStat", "直接星伤实际属性快照", expr.add(expr.mul(expr.input("baseStat"), expr.add(expr.value(1), expr.input("statPercent"))), expr.input("flatStat")), [
          recorded("baseStat", fields[0]!, "stat"), recorded("statPercent", fields[1]!, "ratio"), recorded("flatStat", fields[2]!, "stat"),
        ], { unit: "stat", explanationKey: "以本击真实快照的基础、百分比与固定值重建缩放属性；更早的角色或装备转换仍保留解释缺口。" });
    equal(finalStat, c.scalingValue, "direct scaling stat snapshot");
    const owner: SpecialContributor = { id: contributorId(request.actorIndex),
      base: { kind: "direct-stat-talent", scalingStat: c.scalingStat, statValue: c.scalingValue,
        talentCoefficient: c.scaling, sourceRefs: sources },
      elementalMastery: c.elementalMastery, specialBaseBonus: c.baseDamageBonus, reactionBonus: c.reactionBonus,
      specialAdditive: c.flatDamage, elevationMultiplier: 1 + c.elevation,
      critRate: c.critRate, critDamage: c.critDamage, modifierSourceRefs: sources };
    const output = execute(context(c.branch, [owner], c.effectiveResistance, count), [{ contributorId: owner.id,
      roll: c.critRoll, critical: c.isCrit, guaranteed: c.hitWeakPoint }], request, [request]);
    const specialTrace = output.trace.map(node => ({ ...node,
      ...(node.id === `stellar.${request.id}.contributor.0.base` ? { childIds: [...node.childIds, "stellarDirectFinalStat"] } : {}),
      inputs: node.inputs.map(value => value.key === "specialAdditive"
        ? { ...value, origin: { kind: "source-host-character-flat-components", reference: additions.rootId } }
        : node.id === `stellar.${request.id}.contributor.0.base` && value.key === "stat"
          ? { ...value, origin: { kind: "source-host-final-stat", reference: "stellarDirectFinalStat" } }
          : node.id === `stellar.${request.id}.contributor.0.base` && value.key === "talent" && multiplier.origin
            ? { ...value, origin: multiplier.origin } : value),
    }));
    const trace = new TraceBuilder(sources);
    const value = trace.add("stellarDirectGroup", "来源直接星伤组倍率", expr.mul(expr.input("specialDamage"), expr.input("groupMultiplier")), [
      recorded("specialDamage", output.result.sampled!.damage, "damage"), recorded("groupMultiplier", c.groupMultiplier, "ratio")],
      { unit: "damage", explanationKey: "共享直接星伤公式完成后，按来源顺序应用本次实际伤害组倍率。" });
    if (edited) gaps.push("编辑后的最终缩放属性复用已捕获的原生暴击随机数；这是独立反事实计算，不是重新运行 a7 角色状态。");
    if (additions.residual !== 0) gaps.push(`Direct Stellar FlatDmg ${c.flatDamage} includes ${additions.explained} verified character additions; ${additions.residual} remains source-native context.`);
    return { value, trace: [...panel.nodes, ...multiplier.trace, ...additions.trace, ...specialTrace, ...trace.nodes], explanationGaps: gaps };
  }
  const c = request.input;
  if (c.defenseIgnore !== 1 || c.damageBonus !== 0 || c.amped) throw new Error("Stellar Swirl delivery cannot use ordinary defense, damage bonus or amplification");
  if (request.componentIds.length !== 1 || request.componentApplications.length !== 1) throw new Error("Stellar Swirl delivery requires exactly one ranked source component");
  const ranked = components.get(request.componentIds[0]!);
  if (!ranked || ranked.request.kind !== "stellar-ranked") throw new Error("Stellar Swirl delivery lacks ranked contributor receipt");
  const prior = resolve(ranked.request, components, { explicitFinalScaling: edited });
  equal(prior.value, ranked.value, "ranked component recalculation");
  const applied = request.componentApplications[0]!;
  equal(applied.id, request.componentIds[0]!, "delivery component ID");
  equal(applied.multiplier, 1, "delivery multiplier");
  equal(applied.amount, ranked.value, "delivery ranked value");
  if (c.scaling !== 0 || c.critDamage !== 0) throw new Error("Stellar Swirl terminal has unexpected talent scaling or second critical multiplier");
  const trace = new TraceBuilder(sources);
  // Contributors already critted and ranked at snapshot; the common AST reads
  // the target's resistance at actual delivery without a second RNG draw.
  const resistance = calculateResistanceMultiplierTrace(c.effectiveResistance);
  const resistanceTrace = resistance.trace.map(node => ({ ...node, id: `stellar.${request.id}.${node.id}`,
    titleKey: node.id === "resistanceMultiplier" ? "交付时目标抗性倍率" : node.titleKey,
    explanationKey: "在本次交付帧读取目标实际抗性，并执行共享抗性分段公式。",
    sourceRefs: [...new Set([...node.sourceRefs, ...sources])],
    inputs: node.inputs.map(value => ({ ...value, meaningKey: "交付帧目标实际有效抗性",
      context: { sourceCalculationId: request.id, executionFrame: request.frame,
        snapshotFrame: request.snapshotFrame, targetKey: request.targetKey } })),
    childIds: node.childIds.map(id => `stellar.${request.id}.${id}`),
  }));
  const value = trace.add("stellarDelivery", "实际星扩散交付伤害", expr.mul(expr.input("sourceFlatDamage"), expr.input("resistanceMultiplier"), expr.input("groupMultiplier"), expr.add(expr.value(1), expr.input("elevation"))), [
    recorded("sourceFlatDamage", c.flatDamage, "damage"), { ...recorded("resistanceMultiplier", resistance.value, "ratio"), origin: { kind: "previous-step", reference: `stellar.${request.id}.resistanceMultiplier` } },
    recorded("groupMultiplier", c.groupMultiplier, "ratio"), recorded("elevation", c.elevation, "ratio")],
    { unit: "damage",
      explanationKey: "参与者在取样帧各自暴击并完成排序；目标抗性在实际交付帧读取，之后按来源顺序应用伤害组倍率与擢升。" });
  if (c.flatDamage !== ranked.value) gaps.push("攻击修改器在交付前改变了排名结果的 FlatDmg；此处保留来源实际最终值与原始排名两项证据。");
  return { value, trace: [...prior.trace, ...resistanceTrace, ...trace.nodes.map(node => ({ ...node, childIds: [`stellar.${ranked.request.id}.sampled.total`, ...resistanceTrace.map(child => child.id)] }))], explanationGaps: [...prior.explanationGaps, ...gaps] };
}
