/** Actual source-host Lunar executions use the existing special formula AST. */
import {
  calculateConditionedSpecial, SPECIAL_FORMULA_RULES, SPECIAL_RANK_WEIGHTS,
  type ConditionedSpecialCalculation, type SpecialContributor, type RecordedSpecialCriticalExecution,
} from "@genshin-dps-lab/reaction-formulas";
import { calculateResistanceMultiplierTrace, criticalMultiplierExpression, reactionLevelBaseDamage } from "./calculator-formula";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { resolveSourceHostDirectCharacterAdditives } from "./source-host-character-additive-components";
import { resolveSourceHostDamageMultiplierLink } from "./source-host-character-multiplier-request";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, type SourceHostCalculationRecord, type SourceHostLunarContributorRequest,
  type SourceHostSpecialRequest,
} from "./source-host-wire";
import type { SourceHostCalculation, SourceHostCalculationLookup } from "./source-host-formula";

function referencesFor(commit: string | undefined) {
  const sourceCommit = commit === SOURCE_HOST_STELLAR_COMMIT ? SOURCE_HOST_STELLAR_COMMIT : SOURCE_HOST_COMMIT;
  return [SPECIAL_FORMULA_RULES.lunar.source,
    `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/pkg/reactable/lunarcharged.go`,
    `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/pkg/reactable/lunarcrystallize.go`,
    `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/pkg/enemy/damage.go`];
}
const contributorId = (actorIndex: number) => `source-actor-${String(actorIndex).padStart(4, "0")}`;
const v = expr.input;
const n = expr.value;
const input = (key: string, value: number, definition: string, unit = "ratio") => traceInput(key, value, unit, "来源宿主本次实际读取", definition);
function exact(actual: number, expected: number, label: string) {
  if (actual !== expected) throw new Error(`月反应来源 ${label} 不一致：${actual} / ${expected}`);
}
function sourceContext(branch: ConditionedSpecialCalculation["branch"], contributors: SpecialContributor[], resistance: number): ConditionedSpecialCalculation {
  return { branch, ruleVersion: SPECIAL_FORMULA_RULES.lunar.id,
    context: { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: [
      "本次数值上下文由固定来源宿主的实际动作、附着、参与者窗口与回调提供；这不等于游戏机制已经独立验证。",
      "原生随机数已经由 Go 消耗；此共享公式只重放同一结果，不使用本地 Mulberry32 流。",
    ] }, contributors, effectiveResistance: resistance };
}
function relevantTrace(nodes: CalculationTraceNode[], rootId: string): CalculationTraceNode[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const included = new Set<string>();
  const add = (id: string) => {
    if (included.has(id)) return;
    const node = byId.get(id);
    if (!node) throw new Error(`缺少月反应实际执行节点 ${id}`);
    included.add(id);
    node.childIds.forEach(add);
  };
  add(rootId);
  return nodes.filter(node => included.has(node.id));
}
function executeSpecial(context: ConditionedSpecialCalculation, draws: RecordedSpecialCriticalExecution["draws"], request: SourceHostSpecialRequest, contributorOnly = false, edited = false) {
  const references = referencesFor(request.sourceCommit);
  const nativeRandom = `固定 gcsim ${request.sourceCommit ?? SOURCE_HOST_COMMIT} 的 math/rand 实际抽样`;
  const builder = new TraceBuilder(references);
  const prefix = `sourceSpecial.${request.id}`;
  const result = calculateConditionedSpecial(context, stage => builder.add(
    `${prefix}.${stage.id}`,
    stage.titleKey === "special.recordedNativeCritical" ? edited ? "固定原生抽样的反事实暴击判定" : "原生来源实际贡献者暴击" : stage.titleKey,
    stage.expression,
    Object.entries(stage.values).map(([key, value]) => ({ ...traceInput(key, value,
      key === "EM" || key === "stat" ? "stat" : key === "critical" ? "boolean" : key === "roll" ? "probability" : ["base", "scaled", "augmented", "contribution", "levelBase", "specialAdditive"].includes(key) || /^rank\d/.test(key) ? "damage" : "ratio",
      key === "roll" ? nativeRandom : "来源月反应共享公式上下文",
      key === "roll" ? "Go math/rand 已实际消耗的本参与者随机数；不是本地命名随机流" : /^rank\d/.test(key) ? "本排名的加权贡献" : `special.input.${key}`),
      context: { sourceCalculationId: request.id, executionFrame: request.frame, snapshotFrame: request.snapshotFrame, targetKey: request.targetKey,
        ...(/^(?:contributor|sampled)\.\d+\./.test(stage.id) ? { contributorId: context.contributors[Number(stage.id.split(".")[1])]!.id } : {}) },
    })),
    { unit: stage.unit, ruleId: SPECIAL_FORMULA_RULES.lunar.id,
      explanationKey: stage.titleKey === "special.recordedNativeCritical"
        ? "此处读取原生来源实际随机数并执行 roll ≤ 本贡献者 CR；明确弱点必暴时为 1，且没有伪造随机数。编辑模式复用同一随机数，不代表重新运行来源。"
        : stage.explanationKey,
      sourceRefs: [...stage.sourceRefs, ...references], childIds: stage.dependencies.map(dependency => `${prefix}.${dependency}`) },
  ), { source: nativeRandom, draws, onlyRecorded: true });
  if (result.status !== "calculated" || !result.sampled) throw new Error(result.blockers.join("；") || "月反应没有生成实际共享公式结果。");
  const root = contributorOnly ? `${prefix}.sampled.0.damage` : `${prefix}.sampled.total`;
  return { result, value: contributorOnly ? result.sampled.rankedContributions[0]!.contribution : result.sampled.damage,
    trace: relevantTrace(builder.nodes, root) };
}
function contributor(request: SourceHostLunarContributorRequest): SpecialContributor {
  const c = request.input;
  const references = referencesFor(request.sourceCommit);
  exact(c.levelBaseDamage, reactionLevelBaseDamage(c.characterLevel), "等级基础值");
  return { id: contributorId(request.actorIndex),
    base: { kind: "level-base", characterLevel: c.characterLevel, value: c.levelBaseDamage, evidence: "provisional", sourceRefs: references },
    elementalMastery: c.elementalMastery, specialBaseBonus: c.baseDamageBonus, reactionBonus: c.reactionBonus,
    specialAdditive: c.flatDamage, elevationMultiplier: 1 + c.elevation, critRate: c.critRate, critDamage: c.critDamage, modifierSourceRefs: references };
}
function contributorDraw(request: SourceHostLunarContributorRequest): RecordedSpecialCriticalExecution["draws"][number] {
  return { contributorId: contributorId(request.actorIndex), roll: request.input.critRoll, critical: request.input.isCrit, guaranteed: false };
}
function validateTerminalCritical(request: Extract<SourceHostSpecialRequest, { kind: "lunar-direct" | "lunar-delivery" }>, builder: TraceBuilder) {
  const c = request.input;
  if (c.hitWeakPoint) {
    if (!c.isCrit || c.critRoll !== null) throw new Error("来源弱点必暴必须保留未抽样的真实状态。");
    return builder.add("terminalCriticalDecision", "来源终端弱点必暴", n(1), [], { unit: "boolean", explanationKey: "原生来源在弱点必暴时短路，没有再取随机数。" });
  }
  if (c.critRoll === null) throw new Error("来源月伤终端缺少实际随机数。");
  const decision = builder.add("terminalCriticalDecision", "来源终端实际暴击判定", expr.condition("lte", v("roll"), expr.clamp(v("CR"), n(0), n(1)), n(1), n(0)), [
    input("roll", c.critRoll, "本次原生终端实际消耗的随机数", "probability"), input("CR", c.critRate, "来源终端实际暴击率"),
  ], { unit: "boolean", explanationKey: "这是原生来源交付回调的实际判定。月反应参与者已经各自暴击；通常此终端 CD=0，只保留来源显示/回调标记，不再次放大贡献者伤害。" });
  exact(decision, Number(c.isCrit), "终端暴击判定");
  return decision;
}
function requireSpecialTerminal(request: Extract<SourceHostSpecialRequest, { kind: "lunar-direct" | "lunar-delivery" }>) {
  const c = request.input;
  if (c.defenseIgnore !== 1) throw new Error("来源月伤存在未解决的 DEF TODO：实际忽防不是 100%，不能把普通防御公式冒充已核月反应公式。");
  if (c.damageBonus !== 0 || c.amped) throw new Error("此来源月伤带有未支持的普通增伤或增幅字段，不能偷偷混入特殊公式。");
}
export interface SourceHostSpecialFormulaResult { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }
type Resolve = (request: unknown, components: SourceHostCalculationLookup, options?: { explicitFinalScaling?: boolean }) => SourceHostCalculation;

export function resolveSourceHostSpecialRequest(request: SourceHostSpecialRequest, components: SourceHostCalculationLookup, resolve: Resolve, edited = false): SourceHostSpecialFormulaResult {
  const references = referencesFor(request.sourceCommit);
  const gaps = ["月反应实际启用、参与者和资源由固定 Go 来源执行；来源 TODO、属性转换与角色特有加算分项仍未全部形成独立验证的完整解释。"];
  if (request.kind === "lunar-bloom-event") {
    const result = calculateConditionedSpecial(sourceContext("lunar-bloom-event", [], 0));
    if (result.status !== "non-damaging") throw new Error("月绽放事件必须是非伤害事件。");
    const trace = new TraceBuilder(references);
    trace.add("lunarBloomEvent", "实际月绽放触发事件：本身不造成月伤", n(0), [], { unit: "damage", status: "not-applicable", explanationKey: result.nonDamageReason!, applicabilityReason: `来源实际触发帧 ${request.frame}；草露窗口与草原核继续由原生事件处理，此零值没有创建 HP 伤害应用。` });
    return { value: 0, trace: trace.nodes, explanationGaps: gaps };
  }
  if (request.kind === "lunar-contributor") {
    if (request.componentIds.length || request.componentApplications.length) throw new Error("单个月反应参与者不能含未解析的递归伤害组件。");
    const output = executeSpecial(sourceContext(request.input.branch, [contributor(request)], 0), [contributorDraw(request)], request, true, edited);
    return { value: output.value, trace: output.trace, explanationGaps: gaps };
  }
  if (request.kind === "lunar-ranked") {
    const records = request.componentIds.map(id => {
      const record = components.get(id);
      if (!record || record.request.kind !== "lunar-contributor" || record.request.input.branch !== request.input.branch) throw new Error(`缺少同分支月反应参与者 #${id}。`);
      return record as SourceHostCalculationRecord & { request: SourceHostLunarContributorRequest };
    });
    if (!records.length || records.length > 4 || new Set(records.map(record => record.request.actorIndex)).size !== records.length || records.some((record, index) => index > 0 && record.request.actorIndex <= records[index - 1]!.request.actorIndex)) throw new Error("月反应贡献者须保留来源实际角色遍历顺序，每人只出现一次。");
    const output = executeSpecial(sourceContext(request.input.branch, records.map(record => contributor(record.request)), 0), records.map(record => contributorDraw(record.request)), request, false, edited);
    const ranked = output.result.sampled!.rankedContributions;
    if (ranked.length !== request.input.rankedContributorIds.length || request.input.weights.length !== SPECIAL_RANK_WEIGHTS.length || ranked.length !== request.componentApplications.length) throw new Error("来源月反应排名、固定四权重和实际应用长度不一致。");
    request.input.weights.forEach((weight, index) => exact(weight, SPECIAL_RANK_WEIGHTS[index]!, "固定来源权重表"));
    for (const [index, row] of ranked.entries()) {
      const record = records.find(candidate => contributorId(candidate.request.actorIndex) === row.contributorId)!;
      exact(row.contribution, record.value, "共享贡献者伤害");
      exact(request.input.rankedContributorIds[index]!, record.request.id, "原生稳定排序");
      exact(request.input.weights[index]!, SPECIAL_RANK_WEIGHTS[index]!, "原生排名权重");
      const applied = request.componentApplications[index]!;
      exact(applied.id, record.request.id, "排名应用所属参与者");
      exact(applied.multiplier, row.weight, "排名应用权重");
      exact(applied.amount, row.weightedDamage, "排名加权伤害");
    }
    if (request.input.displayIsCrit !== ranked[0]!.critical) throw new Error("来源月反应显示暴击标记与稳定排序的最高贡献者不一致。");
    if (output.result.sampled!.displayedCritical === "ambiguous-tie") gaps.push("最高贡献并列且暴击状态不同：来源按原角色顺序稳定排序取显示标记；不据此声称游戏内并列归属规则已经验证。");
    return { value: output.value, trace: output.trace, explanationGaps: gaps };
  }
  requireSpecialTerminal(request);
  const c = request.input;
  if (request.kind === "lunar-direct") {
    const additions = resolveSourceHostDirectCharacterAdditives(request, components, resolve);
    const multiplier = resolveSourceHostDamageMultiplierLink(request, components, resolve);
    gaps.push(...multiplier.explanationGaps);
    const panel = new TraceBuilder(references);
    const stats = request.snapshot;
    const fields = c.scalingStat === "atk" ? [stats.baseAtk, stats.atkPct, stats.flatAtk] : c.scalingStat === "hp" ? [stats.baseHp, stats.hpPct, stats.flatHp] : c.scalingStat === "def" ? [stats.baseDef, stats.defPct, stats.flatDef] : null;
    const finalStat = edited ? panel.add("directLunarFinalStat", "编辑后的直接月伤最终属性", v("scalingValue"), [traceInput("scalingValue", c.scalingValue, "stat", "用户独立数值编辑", "编辑后的本次最终缩放属性")], { unit: "stat", status: "assumed", explanationKey: "编辑模式直接使用新的最终属性，不把旧来源快照的属性分解冒充新面板。" })
      : fields === null ? panel.add("directLunarFinalStat", "直接月伤实际精通快照", v("EM"), [input("EM", stats.em, "原生来源本击最终精通", "stat")], { unit: "stat", explanationKey: "实际来源以精通作为天赋缩放属性；该属性与稍后特殊反应精通乘区分别适用。" })
        : panel.add("directLunarFinalStat", "直接月伤实际属性快照", expr.add(expr.mul(v("baseStat"), expr.add(n(1), v("statPercent"))), v("flatStat")), [input("baseStat", fields[0]!, "此缩放属性的来源基础值", "stat"), input("statPercent", fields[1]!, "此缩放属性的来源百分比合计"), input("flatStat", fields[2]!, "此缩放属性的来源固定加值合计", "stat")], { unit: "stat", explanationKey: "用真实快照的基础、百分比与固定值重建缩放属性；上游各装备和角色转换分项仍是明确解释缺口。" });
    exact(finalStat, c.scalingValue, "直接月伤实际缩放属性");
    const owner: SpecialContributor = { id: contributorId(request.actorIndex),
      base: { kind: "direct-stat-talent", scalingStat: c.scalingStat, statValue: c.scalingValue, talentCoefficient: c.scaling, sourceRefs: references },
      elementalMastery: c.elementalMastery, specialBaseBonus: c.baseDamageBonus, reactionBonus: c.reactionBonus,
      specialAdditive: c.flatDamage, elevationMultiplier: 1 + c.elevation, critRate: c.critRate, critDamage: c.critDamage, modifierSourceRefs: references };
    const output = executeSpecial(sourceContext(c.branch, [owner], c.effectiveResistance), [{ contributorId: owner.id, roll: c.critRoll, critical: c.isCrit, guaranteed: c.hitWeakPoint }], request, false, edited);
    const group = new TraceBuilder(references);
    const value = group.add("directLunarDamageGroup", "直接月伤实际伤害组倍率", expr.mul(v("specialDamage"), v("groupMultiplier")), [
      input("specialDamage", output.value, "共享特殊公式实际结果，含本人的实际暴击、目标抗性及擢升", "damage"), input("groupMultiplier", c.groupMultiplier, "原生来源实际伤害组倍率"),
    ], { unit: "damage", explanationKey: "普通增伤与敌人防御不进入直接月伤公式；使用现有共享特殊公式的运算顺序，再应用明确记录的来源伤害组倍率。" });
    if (additions.residual !== 0) gaps.push(`直接月伤加算 ${c.flatDamage} 已核对角色分项 ${additions.explained}；其余 ${additions.residual} 的来源尚未导出。`);
    const specialTrace = output.trace.map(node => ({ ...node, inputs: node.inputs.map(value => value.key === "specialAdditive"
      ? { ...value, origin: { kind: "source-host-character-flat-components", reference: additions.rootId } }
      : node.id === `sourceSpecial.${request.id}.contributor.0.base` && value.key === "talent" && multiplier.origin
        ? { ...value, origin: multiplier.origin } : value) }));
    return { value, trace: [...panel.nodes, ...multiplier.trace, ...additions.trace, ...specialTrace, ...group.nodes], explanationGaps: gaps };
  }
  if (request.componentIds.length !== 1 || request.componentApplications.length !== 1) throw new Error("月反应交付必须关联唯一完整排名组件。");
  const record = components.get(request.componentIds[0]!);
  if (!record || record.request.kind !== "lunar-ranked" || record.request.input.branch !== c.branch) throw new Error("月反应交付缺少原始贡献者排名计算。");
  const prior = resolve(record.request, components, { explicitFinalScaling: edited });
  exact(prior.value, record.value, "排名组件重算");
  const application = request.componentApplications[0]!;
  exact(application.id, record.request.id, "实际交付组件 ID");
  exact(application.multiplier, 1, "月反应交付组件倍数");
  exact(application.amount, record.value, "交付的排名基数");
  if (c.scaling !== 0) throw new Error("排名月反应交付意外携带天赋缩放项，当前终端公式不猜测其适用性。");
  const resistance = calculateResistanceMultiplierTrace(c.effectiveResistance);
  const terminal = new TraceBuilder(references);
  validateTerminalCritical(request, terminal);
  const critical = terminal.add("terminalCriticalMultiplier", "来源交付回调的暴击倍率", criticalMultiplierExpression(c.isCrit ? "allCrit" : "noCrit"), [input("critRate", c.critRate, "来源交付回调暴击率"), input("critDamage", c.critDamage, "来源交付回调暴击伤害，通常为零")], { unit: "ratio", explanationKey: "各贡献者已先独立暴击。这里只展示来源原生终端本身记录的额外倍率；CD 为零时倍率为 1，绝不再套某个贡献者的暴伤。", childIds: ["terminalCriticalDecision"] });
  const afterResistance = terminal.add("lunarDeliveryResistance", "月反应交付时目标抗性", expr.mul(v("rankedAndModifiedFlat"), v("resistanceMultiplier")), [
    input("rankedAndModifiedFlat", c.flatDamage, "来源攻击修正之后的实际 FlatDmg；原始排名结果另行保留", "damage"), input("resistanceMultiplier", resistance.value, "交付目标当前抗性，通过现有共享抗性 AST 计算"),
  ], { unit: "damage", explanationKey: "贡献者在取样帧完成各自暴击和排名；此处使用实际交付帧目标抗性。飞行期间的目标变化不会倒灌到贡献者快照。" });
  const afterCritical = terminal.add("lunarDeliveryCritical", "来源终端额外暴击处理", expr.mul(v("afterResistance"), v("terminalCritMultiplier")), [input("afterResistance", afterResistance, "抗性处理后的实际月伤", "damage"), input("terminalCritMultiplier", critical, "来源终端实际倍率")], { unit: "damage", childIds: ["lunarDeliveryResistance", "terminalCriticalMultiplier"], explanationKey: "保留原生终端实际行为及随机读取；此步没有再次抽样。" });
  const afterGroup = terminal.add("lunarDeliveryGroup", "月反应实际伤害组倍率", expr.mul(v("afterCritical"), v("groupMultiplier")), [input("afterCritical", afterCritical, "前一步的实际伤害", "damage"), input("groupMultiplier", c.groupMultiplier, "交付时的实际伤害组倍率")], { unit: "damage", childIds: ["lunarDeliveryCritical"], explanationKey: "按来源终端顺序，在抗性及终端暴击处理后应用伤害组倍率。" });
  const value = terminal.add("lunarDeliveryElevation", "来源终端实际擢升", expr.mul(v("afterGroup"), expr.add(n(1), v("elevation"))), [input("afterGroup", afterGroup, "伤害组处理后的实际伤害", "damage"), input("elevation", c.elevation, "来源终端自身的擢升；参与者擢升已含于排名基数")], { unit: "damage", childIds: ["lunarDeliveryGroup"], explanationKey: "仅应用实际记录在终端攻击上的擢升，不再次读取或叠加贡献者快照的擢升。" });
  if (c.flatDamage !== record.value) gaps.push(`原始月反应排名值 ${record.value} 与来源攻击修正后的 FlatDmg ${c.flatDamage} 相差 ${c.flatDamage - record.value}；额外来源分项尚未完整导出。`);
  return { value, trace: [...prior.trace, ...resistance.trace, ...terminal.nodes], explanationGaps: [...prior.explanationGaps, ...gaps] };
}
