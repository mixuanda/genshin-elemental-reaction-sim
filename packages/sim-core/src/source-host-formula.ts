import { resolveSourceHostCooldownRequest } from "./source-host-cooldown-request";
import { resolveSourceHostHealingRequest } from "./source-host-healing-request";
import { resolveSourceHostDrainSourceRequest } from "./source-host-drain-source-request";
import { resolveSourceHostPlayerManualIncomingRequest } from "./source-host-manual-incoming-formula";
import { sourceHostDrainSourceRuleDescriptor } from "./source-host-drain-source-formula";
import { resolveSourceHostTargetApplication } from "./source-host-target-application";
/** The source runtime supplies state and one actual CRIT outcome; this core supplies damage. */
import { calculateDamageTrace, calculateTransformativeDamageTrace, executeAdditiveDamage, reactionLevelBaseDamage } from "./calculator-formula";
import { isImmutableTraceNode, expr, TraceBuilder, traceInput, traceText, type CalculationTraceNode } from "./calculation-trace";
import { assertSourceHostSnapshotTiming, executeSourceHostNestedStatRead, executeSourceHostStatProvenance } from "./source-host-stat-provenance";
import { linkSourceHostDamageStatInputs } from "./source-host-damage-stat-links";
import { executeSourceHostScalarProvenance, type SourceHostScalarKind } from "./source-host-scalar-provenance";
import { resolveSourceHostArtifactScalarInput } from "./source-host-artifact-formula";
import { resolveSourceHostCharacterModifierInput } from "./source-host-character-modifier-formula";
import { isSourceHostCharacterModifierDynamicRuleId, sourceHostCharacterModifierDynamicRuleDescriptor } from "./source-host-character-modifier-dynamic-formula";
import { resolveSourceHostCharacterScalarInput, sourceHostCharacterScalarRuleDescriptor } from "./source-host-character-scalar-formula";
import { resolveSourceHostCharacterAdditiveInput, sourceHostCharacterAdditiveRuleDescriptor } from "./source-host-character-additive-formula";
import { resolveSourceHostCharacterFlatInput, sourceHostCharacterFlatRuleDescriptor } from "./source-host-character-flat-formula";
import { resolveSourceHostCharacterShieldRequest } from "./source-host-character-shield-request";
import { sourceHostCharacterShieldRuleDescriptor } from "./source-host-character-shield-formula";
import { resolveSourceHostCharacterMultiplierInput, sourceHostCharacterMultiplierRuleDescriptor } from "./source-host-character-multiplier-formula";
import { resolveSourceHostDamageMultiplierLink } from "./source-host-character-multiplier-request";
import { resolveSourceHostTalentTableRead } from "./source-host-talent-table";
import { resolveSourceHostTalentExpressionRead } from "./source-host-talent-expression";
import { resolveSourceHostWeaponAdditiveInput } from "./source-host-weapon-formula";
import { resolveSourceHostArtifactAdditiveInput } from "./source-host-artifact-additive-formula";
import { resolveSourceHostEnergyInput } from "./source-host-energy-formula";
import { sourceHostArtifactSupportClosureIds, sourceHostCharacterScalarValueSourceLinks, sourceHostCharacterAdditiveValueSourceLinks, sourceHostCharacterFlatValueSourceLinks, verifySourceHostArtifactSupport } from "./source-host-artifact-support";
import { resolveSourceHostPlayerIncomingRequest } from "./source-host-incoming-formula";
import { resolveSourceHostPlayerDrainRequest, resolveSourceHostPlayerShieldMinimumRequest, resolveSourceHostPlayerShieldRequest } from "./source-host-shield-formula";
import { resolveSourceHostSpecialRequest } from "./source-host-special-formula";
import { resolveSourceHostStellarRequest } from "./source-host-stellar-formula";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, SOURCE_HOST_PROTOCOL, sourceHostCalculationRequestSchema, sourceHostCalculationRecordSchema,
  type SourceHostCalculationRecord, type SourceHostCalculationRequest, type SourceHostDamageRequest, type SourceHostSpecialRequest,
  type SourceHostCharacterFlatRequest, type SourceHostCharacterMultiplierRequest, type SourceHostTargetApplicationRequest,
  isSourceHostOutgoingRequest,
} from "./source-host-wire";

export const SOURCE_HOST_FORMULA_SOURCES = [
  `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_COMMIT}/pkg/enemy/damage.go`,
  `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_COMMIT}/pkg/core/combat/reaction.go`,
  `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_COMMIT}/pkg/core/attributes/stats.go`,
  "https://library.keqingmains.com/combat-mechanics/damage/damage-formula",
];
function sourceFormulaRefs(commit: string | undefined) {
  return commit === SOURCE_HOST_STELLAR_COMMIT ? [
    `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_STELLAR_COMMIT}/pkg/enemy/damage.go`,
    `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_STELLAR_COMMIT}/pkg/core/combat/reaction.go`,
    `https://github.com/genshinsim/gcsim/blob/${SOURCE_HOST_STELLAR_COMMIT}/pkg/core/attributes/stats.go`,
    SOURCE_HOST_FORMULA_SOURCES[3]!,
  ] : SOURCE_HOST_FORMULA_SOURCES;
}
function resolveSourceHostTargetApplicationRequest(
  request: SourceHostTargetApplicationRequest,
  calculations: SourceHostCalculationLookup,
): Omit<SourceHostCalculation, "request" | "verification" | "explanationStatus"> {
  const raw = calculations.get(request.rawCalculationId);
  if (!raw || !isSourceHostOutgoingRequest(raw.request) || request.rawCalculationId >= request.id) {
    throw new Error("目标应用公式必须引用更早的实际 outgoing 伤害计算。");
  }
  const outgoing = raw.request;
  if (outgoing.actorIndex !== request.actorIndex || outgoing.actorKey !== request.actorKey ||
    outgoing.ability !== request.ability || outgoing.attackId !== request.attackId ||
    outgoing.targetKey !== request.targetKey ||
    outgoing.sourceFrame !== request.sourceFrame || outgoing.snapshotFrame !== request.snapshotFrame ||
    outgoing.element !== request.element || request.phase.targetKey !== request.targetKey ||
    request.phase.frame !== request.frame ||
    (outgoing.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT)) {
    throw new Error("目标应用公式与原始 outgoing 命中的角色、帧或目标身份不一致。");
  }
  assertSourceHostNumber(request.input.rawDamage, raw.value, `target application raw #${raw.request.id}`);
  const resolved = resolveSourceHostTargetApplication({ ...request.input, rawCalculationId: request.rawCalculationId }, request.phase);
  return { value: resolved.value, trace: resolved.trace,
    explanationGaps: [...SOURCE_HOST_EXPLANATION_GAPS, ...resolved.explanationGaps] };
}
export const SOURCE_HOST_EXPLANATION_GAPS = [
  "触发资格、目标选择、排队和状态生命周期沿用固定版本的原生执行；数值公式回放不等于独立核验全部游戏机制。",
];
export interface SourceHostCalculation extends SourceHostCalculationRecord {
  trace: CalculationTraceNode[];
  verification: "provisional";
  explanationStatus: "partial";
  explanationGaps: string[];
}
export type SourceHostCalculationLookup = ReadonlyMap<number, SourceHostCalculationRecord>;
export interface SourceHostWeaponEditOverride { id: number; value: number; trace: CalculationTraceNode[] }
export function assertSourceHostNumber(actual: number, expected: number, field: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > 1e-10 * Math.max(1, Math.abs(expected))) {
    throw new Error(`来源宿主 ${field} 与共享核心不一致：${actual} / ${expected}`);
  }
}
function prefixTrace(nodes: readonly CalculationTraceNode[], prefix: string): CalculationTraceNode[] {
  const localIds = new Set(nodes.map(node => node.id));
  return nodes.map(node => ({ ...node, id: `${prefix}.${node.id}`,
    ...(node.parentId === undefined ? {} : { parentId: `${prefix}.${node.parentId}` }),
    childIds: node.childIds.map(id => `${prefix}.${id}`),
    inputs: node.inputs.map(input => typeof input.origin === "object" && input.origin.reference !== undefined && localIds.has(input.origin.reference)
      ? { ...input, origin: { ...input.origin, reference: `${prefix}.${input.origin.reference}` } } : input),
  }));
}
function sourceInput(key: string, value: number, unit: string, definition: string) {
  return traceInput(key, value, unit, "来源宿主实际计算上下文", definition);
}
function assertSupportedRanges(input: SourceHostDamageRequest["input"]): void {
  if (input.elementalMastery < 0 || input.reactionBonus < 0 || input.critDamage < 0 || input.defenseAdjustment < -1 || input.defenseAdjustment > .9 || input.defenseIgnore < 0 || input.defenseIgnore > 1) {
    throw new Error("来源请求超出共享公式已支持范围：负精通/反应加成/暴伤或未归一化防御参数，不能静默钳制为另一上下文。");
  }
}
function resolveCharacterFlatPrior(request: SourceHostCharacterFlatRequest, components: SourceHostCalculationLookup) {
  const expectedIds = [...new Set([
    ...request.priorComponents.map(row => row.id),
    ...Object.entries(request.valueSources ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, id]) => id),
  ])];
  if (request.componentApplications.length ||
    JSON.stringify(expectedIds) !== JSON.stringify(request.componentIds) ||
    request.priorComponents.some((row, index) => index > 0 && row.scope === "snapshot" && request.priorComponents[index - 1]!.scope === "attack-info")) {
    throw new Error(`角色 FlatDmg #${request.id} 的旧组件顺序或身份不匹配`);
  }
  const trace: CalculationTraceNode[] = [];
  const builder = new TraceBuilder(sourceFormulaRefs(request.sourceCommit));
  let explained = 0;
  for (const row of request.priorComponents) {
    const prior = components.get(row.id);
    if (!prior || row.id >= request.id || prior.request.id !== row.id || prior.request.kind === "damage" ||
      prior.request.kind === "artifact-scalar" || prior.request.kind === "character-modifier" ||
      prior.request.kind === "character-scalar" || prior.request.kind === "character-energy" ||
      prior.request.kind === "character-healing" || prior.request.kind === "character-cooldown" ||
      prior.request.kind === "player-incoming" || prior.request.kind === "player-shield" ||
      prior.request.kind === "player-shield-min" || prior.request.kind === "player-drain" ||
      (prior.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
      prior.request.frame > request.frame || (row.scope === "snapshot" && request.snapshot === null)) {
      throw new Error(`角色 FlatDmg #${request.id} 缺少原生旧组件 #${row.id}`);
    }
    const calculated = resolveSourceHostRequest(prior.request, components);
    assertSourceHostNumber(calculated.value, prior.value, `character flat prior #${row.id}`);
    assertSourceHostNumber(calculated.value * row.multiplier, row.amount, `character flat prior amount #${row.id}`);
    trace.push(...calculated.trace);
    builder.add(`characterFlat.${request.id}.prior.${row.id}`, "写入前仍活跃的旧 FlatDmg 组件",
      expr.mul(expr.input("value"), expr.input("multiplier")), [
        sourceInput("value", calculated.value, "damage", `旧组件 #${row.id} 的共享公式值`),
        sourceInput("multiplier", row.multiplier, "ratio", `旧组件在 ${row.scope} 中的原生倍率`),
      ], { unit: "damage", explanationKey: `真实 ${row.scope} 组件 #${row.id}；当前写入后由新唯一组件替换。` });
    explained += row.amount;
  }
  const residual = request.input.priorFlatDamage - explained;
  const reference = `characterFlat.${request.id}.priorFlatDamage`;
  builder.add(reference, "写入前的实际 FlatDmg", expr.add(expr.input("tracked"), expr.input("residual")), [
    sourceInput("tracked", explained, "damage", "原生记录中仍活跃的旧组件合计"),
    sourceInput("residual", residual, "damage", "旧 FlatDmg 中未由组件解释的原生余量"),
  ], { unit: "damage", status: residual === 0 ? "applied" : "assumed",
    childIds: request.priorComponents.map(row => `characterFlat.${request.id}.prior.${row.id}`),
    explanationKey: "从赋值前的真实字段与两个活跃组件数组重建；余量保留为原生边界。" });
  return { trace: [...trace, ...builder.nodes], reference, residual };
}
function resolveCharacterMultiplierDependencies(request: SourceHostCharacterMultiplierRequest, components: SourceHostCalculationLookup) {
  const descriptor = sourceHostCharacterMultiplierRuleDescriptor(request.input.ruleId);
  const priorId = request.priorMultiplierCalculationId;
  const expectedSources = descriptor.valueSources ?? {};
  const actualSources = request.valueSources ?? {};
  const keys = Object.keys(expectedSources);
  if (Object.keys(actualSources).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(actualSources, key)))
    throw new Error(`角色攻击倍率 #${request.id} 的保存来源状态键与规则不一致`);
  const expectedIds = [...new Set([
    ...(priorId === undefined ? [] : [priorId]),
    ...Object.entries(actualSources).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, id]) => id),
  ])];
  if (JSON.stringify(expectedIds) !== JSON.stringify(request.componentIds) || request.componentApplications.length ||
    request.actorIndex !== request.input.sourceHolderIndex || request.attackId !== 0 || request.targetKey !== 0 ||
    request.sourceFrame !== request.frame || request.snapshot !== null || request.snapshotStats !== null ||
    request.multiplierCalculationId !== undefined || priorId === 0)
    throw new Error(`角色攻击倍率 #${request.id} 的原生写入身份或上游 ID 无效`);
  const reads = request.statReads ?? [];
  const leaves = descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : []);
  if (descriptor.statLeaves && descriptor.statLeaf || reads.length !== leaves.length ||
    new Set(reads.map(read => read.id)).size !== reads.length || reads.some(read => read.frame !== request.frame))
    throw new Error(`角色攻击倍率 #${request.id} 的原生 getter 数量、次序或帧无效`);
  const trace: CalculationTraceNode[] = [];
  const links = new Map<string, string>();
  const gaps: string[] = [];
  const child = (id: number) => {
    const row = components.get(id);
    if (!row || row.request.kind !== "character-multiplier" || row.request.id !== id || id >= request.id ||
      row.request.actorIndex !== request.actorIndex || row.request.input.sourceHolderIndex !== request.input.sourceHolderIndex ||
      row.request.frame > request.frame || (row.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT))
      throw new Error(`角色攻击倍率 #${request.id} 缺少同来源先前计算 #${id}`);
    const calculated = resolveSourceHostRequest(row.request, components);
    if (calculated.value !== row.value) throw new Error(`角色攻击倍率 #${request.id} 的来源 #${id} 无法精确复现`);
    trace.push(...calculated.trace);
    return { ...row, request: row.request };
  };
  if (priorId !== undefined) {
    const prior = child(priorId);
    const priorDescriptor = sourceHostCharacterMultiplierRuleDescriptor(prior.request.input.ruleId);
    if ((priorDescriptor.resultUnit ?? "ratio") !== (descriptor.resultUnit ?? "ratio"))
      throw new Error(`角色攻击倍率 #${request.id} 的先前值单位不匹配`);
    if (descriptor.operation !== "set") {
      if (prior.value === request.input.priorMultiplier)
        links.set("priorMultiplier", `characterMultiplier.${priorId}.${prior.request.input.ruleId}`);
      else gaps.push(`攻击倍率 #${request.id} 的先前字段 ${request.input.priorMultiplier} 与旧共享值 ${prior.value} 不同；中间原生修改未展开，按本次实取字段计算。`);
    }
  }
  for (const key of keys) {
    const id = actualSources[key]!;
    const row = child(id);
    const allowed = expectedSources[key]!;
    const accepted = typeof allowed === "string" ? row.request.input.ruleId === allowed : allowed.includes(row.request.input.ruleId);
    if (!accepted || descriptor.statLeaf?.stateKey === key || descriptor.statLeaves?.some(leaf => leaf.stateKey === key) ||
      !Object.prototype.hasOwnProperty.call(request.input.state, key))
      throw new Error(`角色攻击倍率 #${request.id} 的 ${key} 保存来源规则无效`);
    if (row.value !== request.input.state[key]) throw new Error(`角色攻击倍率 #${request.id} 的 ${key} 缓存状态值不一致`);
    links.set(key, `characterMultiplier.${id}.${row.request.input.ruleId}`);
  }
  const unique = new Map<string, CalculationTraceNode>();
  for (const node of trace) {
    const old = unique.get(node.id);
    if (old && JSON.stringify(old) !== JSON.stringify(node)) throw new Error(`角色攻击倍率 #${request.id} 的重复来源节点不一致`);
    if (!old) unique.set(node.id, node);
  }
  return { trace: [...unique.values()], links, gaps };
}
function runDamage(request: SourceHostDamageRequest, components: SourceHostCalculationLookup, explicitFinalScaling = false, weaponEdit?: SourceHostWeaponEditOverride, artifactEdit?: SourceHostWeaponEditOverride): Omit<SourceHostCalculation, "request" | "verification" | "explanationStatus"> {
  if (request.snapshot.statProvenance)
    assertSourceHostSnapshotTiming(request.snapshot.statProvenance, request.snapshotFrame, request.frame);
  const input = request.input;
  assertSupportedRanges(input);
  const prefix = new TraceBuilder(sourceFormulaRefs(request.sourceCommit));
  const trace: CalculationTraceNode[] = [];
  const gaps: string[] = [];
  const sample = request.snapshot;
  const stat = input.scalingStat;
  const fields = stat === "atk" ? { base: sample.baseAtk, percent: sample.atkPct, flat: sample.flatAtk }
    : stat === "hp" ? { base: sample.baseHp, percent: sample.hpPct, flat: sample.flatHp }
      : stat === "def" ? { base: sample.baseDef, percent: sample.defPct, flat: sample.flatDef } : null;
  const scalingValue = explicitFinalScaling
    ? prefix.add("sourceScalingStat", "编辑后的最终缩放属性", expr.input("scalingValue"), [traceInput("scalingValue", input.scalingValue, "stat", "用户编辑的最终数值", "本次编辑后直接输入的最终缩放属性")], { unit: "stat", status: "assumed", explanationKey: "这是从实际命中派生的独立编辑计算；读取用户编辑的最终属性，不冒充原始来源快照的属性分解。" })
    : fields === null
    ? prefix.add("sourceScalingStat", "本击实际精通快照", expr.input("elementalMastery"), [sourceInput("elementalMastery", sample.em, "stat", "来源取样帧最终元素精通")], { unit: "stat", explanationKey: "精通读取本次实际快照；有来源回执的属性贡献在依赖节点中逐项展开。" })
    : prefix.add("sourceScalingStat", "本击实际缩放属性", expr.add(expr.mul(expr.input("baseStat"), expr.add(expr.value(1), expr.input("statPercent"))), expr.input("flatStat")), [
      sourceInput("baseStat", fields.base, "stat", `来源快照基础 ${stat}`), sourceInput("statPercent", fields.percent, "ratio", `来源快照 ${stat} 百分比合计`), sourceInput("flatStat", fields.flat, "stat", `来源快照 ${stat} 固定加值合计`),
    ], { unit: "stat", explanationKey: "以本击快照的基础属性、百分比合计与固定加值重建实际缩放属性；依赖节点保留已捕获的上游公式，未归因的实际修改另列缺口。" });
  assertSourceHostNumber(scalingValue, input.scalingValue, "scalingValue");
  const multiplierLink = resolveSourceHostDamageMultiplierLink(request, components, resolveSourceHostRequest);
  trace.push(...multiplierLink.trace);
  gaps.push(...multiplierLink.explanationGaps);
  const talentTable = resolveSourceHostTalentTableRead(request, explicitFinalScaling);
  trace.push(...talentTable.trace);
  gaps.push(...talentTable.explanationGaps);
  const talentExpression = resolveSourceHostTalentExpressionRead(request, explicitFinalScaling);
  trace.push(...talentExpression.trace);
  gaps.push(...talentExpression.explanationGaps);
  const multiplierOrigin = multiplierLink.origin ?? talentExpression.origin ?? talentTable.origin;
  if (!multiplierOrigin && !request.talentTableRead && !request.talentExpressionRead && input.scaling !== 0) gaps.push(`伤害 #${request.id}（${request.ability}）的攻击倍率 ${input.scaling} 来自原生字段；尚无可连接的天赋表读取或倍率生成公式。`);
  for (const [field, value, neutral] of [
    ["BaseDmgBonus", input.baseDamageBonus, 0], ["Elevation", input.elevation, 0],
    ["伤害组倍率", input.groupMultiplier, 1],
  ] as const) {
    if (value !== neutral) gaps.push(`伤害 #${request.id} 的 ${field}=${value} 已参与本次公式；其上游生成规则尚未附来源公式。`);
  }
  if (input.defenseIgnore !== 0 && request.damageCategory !== "transformative") gaps.push(`伤害 #${request.id} 的忽防比例 ${input.defenseIgnore} 来自原攻击字段；其生成规则尚未展开。`);
  const scalarKinds = new Set(request.scalarProvenance?.reads.map(read => read.kind));
  for (const kind of ["resistance", "defense-adjustment", ...(input.amped ? ["reaction-bonus"] : [])]) {
    if (!scalarKinds.has(kind as "resistance" | "defense-adjustment" | "reaction-bonus"))
      gaps.push(`伤害 #${request.id} 的 ${kind} 未保存实际标量读取回执；按捕获的输入值计算。`);
  }
  const talentBase = prefix.add("sourceTalentBase", "来源天赋基数及基础伤害加成", expr.mul(expr.input("scaling"), expr.input("scalingValue"), expr.add(expr.value(1), expr.input("baseDamageBonus"))), [
    { ...sourceInput("scaling", input.scaling, "ratio", "本次实际攻击倍率"),
      ...(multiplierOrigin ? { origin: multiplierOrigin } : {}) },
    sourceInput("scalingValue", input.scalingValue, "stat", "本次实际使用的缩放属性"), sourceInput("baseDamageBonus", input.baseDamageBonus, "ratio", "来源 BaseDmgBonus；只乘天赋倍率项，不乘 FlatDmg"),
  ], { unit: "damage", childIds: ["sourceScalingStat"], explanationKey: "按来源攻击字段顺序执行 倍率×属性×(1+基础伤害加成)，FlatDmg 在共享普通伤害核心中单独相加。" });

  let explainedFlat = 0;
  const applicationIds = request.componentApplications.map(row => row.id);
  if (new Set(applicationIds).size !== applicationIds.length || applicationIds.length !== request.componentIds.length || request.componentIds.some(id => !applicationIds.includes(id))) {
    throw new Error("来源伤害组件 ID 与实际应用记录不一致。");
  }
  for (const application of request.componentApplications) {
    const record = components.get(application.id);
    if (!record || record.request.kind === "damage" || record.request.kind === "artifact-scalar" || record.request.kind === "character-modifier" || record.request.kind === "character-scalar" || record.request.kind === "character-energy" || record.request.kind === "character-healing" || record.request.kind === "character-cooldown") throw new Error(`缺少来源反应组件 #${application.id} 的实际数值上下文。`);
    const weapon = record.request.kind === "weapon-additive";
    const artifact = record.request.kind === "artifact-additive";
    const characterAdditive = record.request.kind === "character-additive";
    const characterFlat = record.request.kind === "character-flat";
    if (weapon && (application.multiplier !== 1 || record.request.attackId !== request.attackId
      || record.request.targetKey !== request.targetKey || record.request.actorIndex !== request.actorIndex
      || record.request.frame !== request.frame)) throw new Error(`来源武器附加值 #${application.id} 与实际命中身份或应用量不一致。`);
    if (record.request.kind === "artifact-additive" && (application.multiplier !== 1 || record.request.actorIndex !== request.actorIndex
      || (record.request.componentScope === "same-hit" && (record.request.attackId !== request.attackId || record.request.targetKey !== request.targetKey || record.request.frame !== request.frame))
      || (record.request.componentScope === "queued-attack" && (record.request.input.ruleId !== "oceanhuedclam" || record.request.frame >= request.frame)))) {
      throw new Error(`来源圣遗物附加值 #${application.id} 与原生应用范围不一致。`);
    }
    if (record.request.kind === "character-additive" && (record.request.input.phase !== "hit" || record.request.componentScope !== "same-hit" ||
      application.multiplier !== 1 || record.request.actorIndex !== request.actorIndex ||
      record.request.attackId !== request.attackId || record.request.targetKey !== request.targetKey ||
      record.request.frame !== request.frame || record.request.sourceFrame !== request.sourceFrame ||
      record.request.snapshotFrame !== request.snapshotFrame)) {
      throw new Error(`来源角色附加伤害 #${application.id} 与本次原生命中身份不一致。`);
    }
    if (record.request.kind === "character-flat" && (record.request.componentScope !== "queued-attack" ||
      record.request.attackId !== 0 || record.request.targetKey !== 0 ||
      record.request.actorIndex !== request.actorIndex ||
      record.request.id >= request.id || record.request.frame > request.frame || application.multiplier !== 1 ||
      (record.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT))) {
      throw new Error(`来源角色排队 FlatDmg #${application.id} 与原生攻击时序或应用量不一致。`);
    }
    const override = weapon && weaponEdit?.id === application.id ? weaponEdit
      : artifact && artifactEdit?.id === application.id ? artifactEdit : undefined;
    const calculated = override ?? resolveSourceHostRequest(record.request, components, { explicitFinalScaling });
    if (!override) assertSourceHostNumber(calculated.value, record.value, `component[${application.id}].value`);
    if ("explanationGaps" in calculated) gaps.push(...calculated.explanationGaps);
    trace.push(...prefixTrace(calculated.trace, `component.${application.id}`));
    const amount = prefix.add(`componentApplication.${application.id}`, weapon ? "本击实际武器附加基数" : artifact ? "本击实际圣遗物附加基数" : characterAdditive ? "本击实际角色附加基数" : characterFlat ? "排队攻击最终 FlatDmg 基数" : "本击实际反应附加基数", expr.mul(expr.input("componentValue"), expr.input("appliedMultiplier")), [
      sourceInput("componentValue", calculated.value, "damage", `共享核心${weapon ? "武器" : artifact ? "圣遗物" : characterAdditive || characterFlat ? "角色" : "反应"}组件 #${application.id} 的实际返回值`), sourceInput("appliedMultiplier", application.multiplier, "ratio", weapon || artifact || characterAdditive || characterFlat ? "原生回调保存完整 FlatDmg 数值；倍数固定为 1" : "来源实际应用倍数；不重复乘已包含的反应系数"),
    ], { unit: "damage", explanationKey: weapon ? "原 Go 武器回调已将共享返回值加进本击 FlatDmg；这里核对其应用量和攻击身份。" : artifact ? "Go 原生圣遗物回调实际应用共享返回值；海染泡沫在排队帧计算，可由后续多个目标命中使用。" : characterAdditive ? "原角色回调只在真实命中门通过后把共享数值加入本击 FlatDmg；这里逐项核对组件与攻击、目标和帧。" : characterFlat ? "排队时原赋值链经共享公式得到完整 FlatDmg；旧组件已在写入回执里保存并由唯一新组件替换。" : "将来源宿主确实应用到本击的组件量连接到其共享公式，保留反应属性取样帧与实际命中帧的差别。" });
    assertSourceHostNumber(amount, application.amount, `component[${application.id}].amount`);
    explainedFlat += amount;
  }
  const unexplainedFlat = input.flatDamage - explainedFlat;
  if (unexplainedFlat !== 0) gaps.push(`本击 FlatDmg 合计 ${input.flatDamage}，已追踪前置组件 ${explainedFlat}；其余 ${unexplainedFlat} 的角色/装备独立分项尚未导出。`);
  prefix.add("sourceFlatDamage", "来源最终附加基数", expr.input("flatDamage"), [sourceInput("flatDamage", input.flatDamage, "damage", "来源攻击在本次回调时实际 FlatDmg 合计")], {
    unit: "damage", status: unexplainedFlat === 0 ? "applied" : "assumed",
    explanationKey: "数值复现读取已捕获的最终加算基数；已链接的前置反应或武器分项可独立重算，其余来源未被补造为完整表达式。",
    warnings: unexplainedFlat === 0 ? [] : [gaps[gaps.length - 1]!], childIds: applicationIds.map(id => `componentApplication.${id}`),
  });
  if (input.hitWeakPoint) {
    if (!input.isCrit || input.critRoll !== null) throw new Error("弱点必暴上下文必须记录暴击并且没有额外随机抽样。");
    prefix.add("sourceCritOutcome", "来源弱点保证暴击", expr.value(1), [], { unit: "boolean", explanationKey: "沿用来源宿主本次弱点判定；共享核心不再次抽随机数。" });
  } else {
    if (input.critRoll === null) throw new Error("非弱点命中缺少来源实际暴击抽样，不能重新抽取或猜测。");
    const critical = prefix.add("sourceCritOutcome", explicitFinalScaling ? "固定抽样的反事实暴击判定" : "来源实际暴击抽样", expr.condition("lte", expr.input("critRoll"), expr.clamp(expr.input("critRate"), expr.value(0), expr.value(1)), expr.value(1), expr.value(0)), [
      sourceInput("critRoll", input.critRoll, "probability", "来源宿主已实际消耗的随机数；这里不抽样"), sourceInput("critRate", input.critRate, "ratio", "本击来源最终暴击率，比较时限制在 0 至 1"),
    ], { unit: "boolean", explanationKey: explicitFinalScaling ? "保留捕获的同一随机数，用编辑后的暴击率作反事实比较；不是来源实际运行的新结果。" : "固定来源使用 roll ≤ 暴击率；共享核心仅重放该判定，不把平均暴击率当成本次实际结果。" });
    if (Boolean(critical) !== input.isCrit) throw new Error("来源实际暴击结果与保存的随机数/阈值不一致。");
  }
  if (input.amped && input.amplifyingReaction !== "melt" && input.amplifyingReaction !== "vaporize") throw new Error("来源增幅请求没有明确蒸发或融化反应类型。");
  const reaction = input.amped ? input.amplifyingReaction === "melt" ? "melt" : "vaporize" : "none";
  const output = calculateDamageTrace({
    scaling: 1, scalingStat: input.scalingStat, scalingValue: talentBase,
    flatDamage: input.flatDamage, damageBonus: input.damageBonus,
    characterLevel: input.characterLevel, enemyLevel: input.enemyLevel,
    defenseReduction: input.defenseAdjustment, defenseIgnore: input.defenseIgnore,
    effectiveResistance: input.effectiveResistance, critRate: input.critRate, critDamage: input.critDamage,
    critMode: input.isCrit ? "allCrit" : "noCrit", reaction,
    ...(input.amped ? { explicitReactionBase: input.amplifyingMultiplier } : {}),
    elementalMastery: input.elementalMastery, reactionBonus: input.reactionBonus, groupMultiplier: input.groupMultiplier,
  });
  // Base component was obtained through the same transformative graph. The
  // source may then apply explicit exceptional CRIT/group/elevation fields.
  const damageTrace = output.trace.map(node => {
    if (request.damageCategory !== "transformative" || !["talentDamage", "damageBonusMultiplier", "afterBonus", "defenseIgnore", "defenseAdjustment", "defenseMultiplier", "afterDefense"].includes(node.id)) return node;
    const notApplicable = (node.id === "talentDamage" && talentBase === 0) || (node.id.includes("Bonus") && input.damageBonus === 0) || (node.id.toLowerCase().includes("defense") && input.defenseIgnore === 1);
    return { ...node,
      applicabilityReason: "经典剧变攻击沿用来源实际攻击字段；通常天赋倍率为 0、普通增伤为 0、忽防为 1。此处显示真实输入而非补造普通天赋伤害。",
      ...(notApplicable ? { status: "not-applicable" as const } : {}),
    };
  });
  const suffix = new TraceBuilder(sourceFormulaRefs(request.sourceCommit));
  const value = suffix.add("sourceElevation", "来源最终提升倍率", expr.mul(expr.input("sharedDamage"), expr.add(expr.value(1), expr.input("elevation"))), [
    traceInput("sharedDamage", output.finalDamage, "damage", { kind: "shared-core-execution", reference: "finalDamage" }, "共享伤害核心输出，已包含实际暴击、增幅及伤害组倍率"), sourceInput("elevation", input.elevation, "ratio", "来源本击 Elevation；在伤害组倍率后独立相乘"),
  ], { unit: "damage", explanationKey: "以与来源相同的最后一步乘法顺序应用 Elevation，避免提前合并倍率造成另一计算顺序。" });
  if (input.effectiveResistance === .75) gaps.push("固定 Go 原公式在抗性恰为 75% 时存在分支边界差异；此处实际执行共享标准公式 1/(4×抗性+1)，不声称与未修订上游算术一致。");
  // These provenance children live in their own builder; attach only after the
  // local arithmetic builder has executed, just like the stat-source links.
  const prefixNodes = prefix.nodes.map(node => node.id === "sourceTalentBase" && multiplierOrigin
    ? { ...node, childIds: [...node.childIds, multiplierOrigin.reference] } : node);
  return { value, trace: [...trace, ...prefixNodes, ...damageTrace, ...suffix.nodes], explanationGaps: gaps };
}

/** Pure arithmetic, with the actual source RNG outcome and no native fallback. */
// Live evaluation memoizes its append-only private lookup.
// Public mutable replay/edit lookups remain uncached and continue validating mutations.
// Whole-run validation may explicitly own a fresh, isolated immutable snapshot.
const liveResolverMemos = new WeakMap<SourceHostCalculationLookup, WeakMap<object, SourceHostCalculation>>();
const validationMemos = new WeakMap<SourceHostCalculationLookup, { owned: WeakSet<object>; memo: WeakMap<object, SourceHostCalculation> }>();
function freezeValidationValue(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value) || isImmutableTraceNode(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) freezeValidationValue(child, seen);
  Object.freeze(value);
}
/** A per-validation snapshot; callers never receive the mutable backing Map. */
export function createSourceHostValidationLookup(records: SourceHostCalculationLookup): SourceHostCalculationLookup {
  const copy = new Map<number, SourceHostCalculationRecord>(), owned = new WeakSet<object>();
  for (const [id, raw] of records) {
    const row = sourceHostCalculationRecordSchema.parse(structuredClone(raw));
    if (id !== row.request.id || copy.has(id)) throw new Error("校验索引与公式身份不一致。");
    freezeValidationValue(row);
    owned.add(row.request);
    copy.set(id, row);
  }
  const view: SourceHostCalculationLookup = Object.freeze({
    get size() { return copy.size; }, get: (id: number) => copy.get(id), has: (id: number) => copy.has(id),
    entries: () => copy.entries(), keys: () => copy.keys(), values: () => copy.values(),
    [Symbol.iterator]: () => copy[Symbol.iterator](),
    forEach: (fn: (value: SourceHostCalculationRecord, key: number, map: SourceHostCalculationLookup) => void, thisArg?: unknown) => copy.forEach((value,key)=>fn.call(thisArg,value,key,view)),
  });
  validationMemos.set(view, { owned, memo: new WeakMap() });
  return view;
}
export function resolveSourceHostRequest(raw: unknown, components: SourceHostCalculationLookup = new Map(), options: { explicitFinalScaling?: boolean; weaponEdit?: SourceHostWeaponEditOverride; artifactEdit?: SourceHostWeaponEditOverride; drainMemo?: Map<number, SourceHostCalculation> } = {}): SourceHostCalculation {
  if (!options.explicitFinalScaling && !options.weaponEdit && !options.artifactEdit && typeof raw === "object" && raw !== null && Object.isFrozen(raw)) {
    const prior = liveResolverMemos.get(components)?.get(raw);
    if (prior) return prior;
  }
  const validation = !options.explicitFinalScaling && !options.weaponEdit && !options.artifactEdit && !options.drainMemo
    && typeof raw === "object" && raw !== null ? validationMemos.get(components) : undefined;
  const cacheable = validation && typeof raw === "object" && raw !== null && validation.owned.has(raw);
  if (cacheable) { const prior = validation.memo.get(raw); if (prior) return prior; }
  const request = sourceHostCalculationRequestSchema.parse(raw);
  const drainMemo = options.drainMemo ?? new Map<number, SourceHostCalculation>();
  if (request.kind === "character-drain") {
    const prior = drainMemo.get(request.id);
    if (prior) return prior;
  }
  // Resolve consumer identities before any nested provenance is rendered. IDs
  // alone are not proof that a returned slot came from a shared formula.
  const supportLinks = verifySourceHostArtifactSupport(request, components);
  let calculated: Omit<SourceHostCalculation, "request" | "verification" | "explanationStatus">;
  if (request.kind === "damage") calculated = runDamage(request, components, options.explicitFinalScaling, options.weaponEdit, options.artifactEdit);
  else if (request.kind === "target-application") {
    calculated = resolveSourceHostTargetApplicationRequest(request, components);
  }
  else if (request.kind === "artifact-scalar") calculated = resolveSourceHostArtifactScalarInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `artifactScalar.${request.id}`);
  else if (request.kind === "character-modifier") {
    if (request.componentIds.length || request.componentApplications.length || request.snapshot !== null || request.snapshotStats !== null) throw new Error("角色 modifier 常量请求不能携带伤害组件或快照。");
    if ("phase" in request.input && request.input.phase === "creation" && (request.actorIndex !== request.input.sourceHolderIndex || request.targetKey !== 0)) throw new Error("角色 modifier 创建公式的来源角色或目标身份无效。");
    if (request.statRead && request.statRead.frame !== request.frame) throw new Error("角色 modifier 原生属性读取与计算帧不一致。");
    const dynamic = "state" in request.input && isSourceHostCharacterModifierDynamicRuleId(request.input.ruleId)
      ? sourceHostCharacterModifierDynamicRuleDescriptor(request.input.ruleId) : undefined;
    if (request.statReads) {
      if (dynamic === undefined || !dynamic.statLeaves || dynamic.statLeaf || request.statRead || dynamic.phase !== "creation" ||
        request.statReads.length !== dynamic.statLeaves.length ||
        new Set(request.statReads.map(read => read.id)).size !== request.statReads.length ||
        request.statReads.some(read => read.frame !== request.frame)) {
        throw new Error("角色 modifier 的有序多次原生属性读取与规则不匹配。");
      }
    } else if (dynamic?.statLeaves || (dynamic?.statLeaf && !request.statRead)) {
      throw new Error("角色 modifier 的可验证状态叶缺少原生属性读取。");
    }
    calculated = resolveSourceHostCharacterModifierInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterModifier.${request.id}`);
  }
  else if (request.kind === "character-scalar") {
    if (request.componentIds.length || request.componentApplications.length || request.snapshot !== null || request.snapshotStats !== null) throw new Error("角色标量请求不能携带伤害组件或快照。");
    if (request.input.phase === "creation" && (request.actorIndex !== request.input.sourceHolderIndex || request.targetKey !== 0)) throw new Error("角色标量创建公式的来源角色或目标身份无效。");
    if (request.statRead && request.statRead.frame !== request.frame) throw new Error("角色标量原生属性读取与计算帧不一致。");
    if (sourceHostCharacterScalarRuleDescriptor(request.input.ruleId).statLeaf && !request.statRead) throw new Error("角色标量的可验证状态叶缺少原生属性读取。");
    const valueSourceLinks = sourceHostCharacterScalarValueSourceLinks(request, components);
    const scalar = resolveSourceHostCharacterScalarInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterScalar.${request.id}`);
    calculated = { ...scalar, trace: scalar.trace.map(node => ({ ...node, inputs: node.inputs.map(input => {
      const reference = valueSourceLinks.get(input.key);
      return reference === undefined ? input : { ...input, origin: { kind: "source-host-character-scalar", reference } };
    }) })) };
  }
  else if (request.kind === "character-additive") {
    if (request.componentIds.length || request.componentApplications.length) throw new Error("角色附加伤害请求不能伪装前置伤害组件。");
    const descriptor = sourceHostCharacterAdditiveRuleDescriptor(request.input.ruleId);
    if (request.input.phase === "creation") {
      if (request.actorIndex !== request.input.sourceHolderIndex || request.targetKey !== 0 ||
        request.snapshot !== null || request.snapshotStats !== null || request.componentScope !== undefined) {
        throw new Error("角色附加伤害创建公式的持有者或快照身份无效。");
      }
    } else if (request.componentScope !== "same-hit" || request.snapshot === null || request.snapshotStats === null) {
      throw new Error("角色附加伤害命中缺少真实攻击快照或同击范围。");
    }
    if (request.statRead && request.statRead.frame !== request.frame) throw new Error("角色附加伤害的原生 getter 与计算帧不一致。");
    if (request.statReads) {
      if (!descriptor.statLeaves || descriptor.statLeaf || request.statRead ||
        request.statReads.length !== descriptor.statLeaves.length ||
        new Set(request.statReads.map(read => read.id)).size !== request.statReads.length ||
        request.statReads.some(read => read.frame !== request.frame)) {
        throw new Error("角色附加伤害有序多次 getter 与固定规则不匹配。");
      }
    } else if (descriptor.statLeaves || (descriptor.statLeaf && !request.statRead) || (request.statRead && !descriptor.statLeaf)) {
      throw new Error("角色附加伤害缺少原回调的一次或多次 getter 回执。");
    }
    if (descriptor.snapshotLeaf) {
      const snapshot = request.snapshot;
      const stats = request.snapshotStats;
      if (request.input.phase !== "hit" || snapshot === null || stats === null ||
        !("statProvenance" in snapshot) || snapshot.statProvenance == null) {
        throw new Error("角色附加伤害快照叶缺少本击属性快照来源。");
      }
      const leaf = descriptor.snapshotLeaf;
      const value = leaf.getter === "total-atk" ? stats[24]! * (1 + stats[6]!) + stats[5]!
        : stats[25]! * (1 + stats[1]!) + stats[2]!;
      assertSourceHostNumber(value, request.input.state[leaf.stateKey]!, `character additive snapshot ${leaf.stateKey}`);
    }
    const valueSourceLinks = sourceHostCharacterAdditiveValueSourceLinks(request, components);
    const additive = resolveSourceHostCharacterAdditiveInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterAdditive.${request.id}`);
    calculated = { ...additive, trace: additive.trace.map(node => ({ ...node, inputs: node.inputs.map(input => {
      const reference = valueSourceLinks.get(input.key);
      return reference === undefined ? input : { ...input, origin: { kind: "source-host-character-additive", reference } };
    }) })) };
  }
  else if (request.kind === "character-multiplier") {
    const dependencies = resolveCharacterMultiplierDependencies(request, components);
    const pure = resolveSourceHostCharacterMultiplierInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT,
      `characterMultiplier.${request.id}`);
    const linked = pure.trace.map(node => ({ ...node, inputs: node.inputs.map(input => {
      const reference = dependencies.links.get(input.key);
      return reference === undefined ? input : { ...input, origin: { kind: "source-host-character-multiplier", reference } };
    }) }));
    const unique = new Map<string, CalculationTraceNode>();
    for (const node of [...dependencies.trace, ...linked]) {
      const old = unique.get(node.id);
      if (old && JSON.stringify(old) !== JSON.stringify(node)) throw new Error(`角色攻击倍率 #${request.id} 的来源节点不一致`);
      if (!old) unique.set(node.id, node);
    }
    calculated = { ...pure, trace: [...unique.values()], explanationGaps: [...dependencies.gaps, ...pure.explanationGaps] };
  }
  else if (request.kind === "character-flat") {
    const descriptor = sourceHostCharacterFlatRuleDescriptor(request.input.ruleId);
    if (descriptor.character === "*" && (request.actorIndex !== request.input.sourceHolderIndex || request.actorKey.length === 0) ||
      request.attackId !== 0 || request.targetKey !== 0 ||
      request.componentScope !== "queued-attack" || request.sourceFrame !== request.frame ||
      (request.snapshot === null) !== (request.snapshotStats === null) ||
      (request.snapshot === null && request.snapshotFrame !== 0) ||
      request.priorComponents.some(row => row.scope === "snapshot") && request.snapshot === null) {
      throw new Error(`角色 FlatDmg #${request.id} 的原生创建身份、快照或旧组件无效`);
    }
    const reads = request.statReads ?? [];
    const leaves = descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : []);
    if (reads.length !== leaves.length || new Set(reads.map(read => read.id)).size !== reads.length ||
      reads.some(read => read.frame !== request.frame)) {
      throw new Error(`角色 FlatDmg #${request.id} 的原生 getter 数量、帧或顺序不符`);
    }
    if (descriptor.snapshotLeaf && descriptor.snapshotLeaves) throw new Error(`角色 FlatDmg #${request.id} 的快照叶声明重复`);
    const snapshotLeaves = descriptor.snapshotLeaves ?? (descriptor.snapshotLeaf ? [descriptor.snapshotLeaf] : []);
    if (descriptor.snapshotLeaves && (descriptor.snapshotLeaves.length < 2 ||
      new Set(descriptor.snapshotLeaves.map(leaf => leaf.stateKey)).size !== descriptor.snapshotLeaves.length)) {
      throw new Error(`角色 FlatDmg #${request.id} 的多快照叶声明无效`);
    }
    if (snapshotLeaves.length) {
      if (request.snapshot === null || request.snapshotStats === null || request.snapshot.statProvenance == null)
        throw new Error(`角色 FlatDmg #${request.id} 的快照状态叶没有来源回执`);
      const stats = request.snapshotStats;
      for (const leaf of snapshotLeaves) {
        const value = leaf.getter === "em" ? stats[8]!
          : leaf.getter === "total-atk" ? stats[24]! * (1 + stats[6]!) + stats[5]!
            : stats[25]! * (1 + stats[1]!) + stats[2]!;
        assertSourceHostNumber(value, request.input.state[leaf.stateKey]!, `character flat snapshot ${leaf.stateKey}`);
      }
    }
    const prior = resolveCharacterFlatPrior(request, components);
    const valueSourceLinks = sourceHostCharacterFlatValueSourceLinks(request, components);
    const priorIds = new Set(request.priorComponents.map(row => row.id));
    const valueSourceTrace = [...new Set(Object.values(request.valueSources ?? {}))].filter(id => !priorIds.has(id)).flatMap(id => {
      const row = components.get(id)!;
      const source = resolveSourceHostRequest(row.request, components);
      assertSourceHostNumber(source.value, row.value, `character flat saved source #${id}`);
      return source.trace;
    });
    const flat = resolveSourceHostCharacterFlatInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `characterFlat.${request.id}`);
    const trace = flat.trace.map(node => ({ ...node, inputs: node.inputs.map(input => {
      const valueSource = valueSourceLinks.get(input.key);
      if (valueSource !== undefined) return { ...input, origin: { kind: "source-host-character-flat", reference: valueSource } };
      if (input.key === "priorFlatDamage" && descriptor.operation !== "set")
        return { ...input, origin: { kind: "source-host-character-flat", reference: prior.reference } };
      return input;
    }) }));
    const uniqueTrace = new Map<string, CalculationTraceNode>();
    for (const node of [...prior.trace, ...valueSourceTrace, ...trace]) {
      const existing = uniqueTrace.get(node.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(node))
        throw new Error(`角色 FlatDmg #${request.id} 的重复来源节点 ${node.id} 数值或表达式不一致`);
      if (!existing) uniqueTrace.set(node.id, node);
    }
    calculated = { value: flat.value, trace: [...uniqueTrace.values()], explanationGaps: [
      ...flat.explanationGaps,
      ...(prior.residual !== 0 && descriptor.operation !== "set"
        ? [`写入前 FlatDmg ${request.input.priorFlatDamage} 中 ${prior.residual} 尚无独立前置组件；共享公式仍按原字段逐字执行 ${descriptor.operation}。`] : []),
    ] };
  }
  else if (request.kind === "character-shield") {
    calculated = resolveSourceHostCharacterShieldRequest(request, components, resolveSourceHostRequest, supportLinks);
  }
  else if (request.kind === "weapon-additive") {
    if (request.componentIds.length || request.componentApplications.length || request.statRead.actorIndex !== request.actorIndex || request.statRead.frame !== request.frame) throw new Error("武器附加值的原生属性读取或前置组件身份无效。");
    const stat = request.statRead.result;
    const actual = request.input.ruleId === "cinnabar" ? stat[25]! * (1 + stat[1]!) + stat[2]! : stat[8]!;
    assertSourceHostNumber(actual, request.input.statValue, "weapon statValue");
    const remaining = request.weaponState;
    if (request.input.ruleId === "cinnabar" ? remaining.remainingBefore !== undefined || remaining.remainingAfter !== undefined
      : remaining.remainingBefore === undefined || remaining.remainingAfter !== remaining.remainingBefore - 1) throw new Error("武器附加值的原生消耗状态不完整。");
    const weapon = resolveSourceHostWeaponAdditiveInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `weaponAdditive.${request.id}`);
    const state = new TraceBuilder(sourceFormulaRefs(request.sourceCommit));
    state.add(`weaponAdditive.${request.id}.nativeState`, "来源武器实际消耗状态", expr.input("buffExpiry"), [
      sourceInput("buffExpiry", request.weaponState.buffExpiry, "frame", "本次实际触发时的武器增益到期帧"),
      sourceInput("cooldownExpiry", request.weaponState.cooldownExpiry, "frame", "本次实际触发时的冷却到期帧"),
      ...(request.weaponState.remainingBefore === undefined ? [] : [sourceInput("remainingBefore", request.weaponState.remainingBefore, "count", "来源消费前剩余次数")]),
      ...(request.weaponState.remainingAfter === undefined ? [] : [sourceInput("remainingAfter", request.weaponState.remainingAfter, "count", "来源消费后剩余次数")]),
    ], { unit: "frame", explanationKey: "这是 Go 在真正应用武器加值时观察到的原生状态；共享核心只计算金额，不推断触发或重跑状态。" });
    calculated = { ...weapon, trace: [...weapon.trace, ...state.nodes] };
  }
  else if (request.kind === "artifact-additive") {
    if (request.componentIds.length || request.componentApplications.length || request.artifactState.ruleId !== request.input.ruleId) throw new Error("圣遗物附加值回执含无效前置组件或状态规则。");
    const ruleId = request.input.ruleId;
    const state = request.artifactState;
    if (ruleId === "echoes") {
      if (state.ruleId !== "echoes") throw new Error("余响附加值原生状态规则不一致。");
      if (request.componentScope !== "same-hit" || !request.statRead
        || request.statRead.kind !== "select-stat" || request.statRead.actorIndex !== request.actorIndex || request.statRead.frame !== request.frame
        || JSON.stringify(request.statRead.selector) !== JSON.stringify([24, 6, 5]) || state.sourceHolderIndex !== request.actorIndex) throw new Error("余响附加值缺少本次实际总攻击力读取。");
      const stat = request.statRead.result;
      assertSourceHostNumber(stat[24]! * (1 + stat[6]!) + stat[5]!, request.input.sourceValue, "echoes totalAtk");
      if (state.path === "active-window" ? state.roll !== null : state.roll === null) throw new Error("余响随机抽样与原生触发分支不一致。");
    } else if (ruleId === "songofdayspast") {
      if (state.ruleId !== "songofdayspast") throw new Error("昔时之歌原生状态规则不一致。");
      if (request.componentScope !== "same-hit" || request.statRead !== undefined
        || state.remainingAfter !== state.remainingBefore - 1) throw new Error("昔时之歌次数或属性读取回执不一致。");
      assertSourceHostNumber(state.healSnap, request.input.sourceValue, "song healSnap");
    } else {
      if (state.ruleId !== "oceanhuedclam") throw new Error("海染泡沫原生状态规则不一致。");
      if (request.componentScope !== "queued-attack" || request.statRead !== undefined
        || request.attackId !== 0 || request.targetKey !== 0 || state.sourceHolderIndex !== request.actorIndex) throw new Error("海染泡沫排队攻击上下文不一致。");
      assertSourceHostNumber(state.bubbleHealStacks, request.input.sourceValue, "ocean-hued clam heal stacks");
    }
    const artifact = resolveSourceHostArtifactAdditiveInput(request.input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `artifactAdditive.${request.id}`);
    const native = new TraceBuilder(sourceFormulaRefs(request.sourceCommit));
    const stateUnits: Record<string, string> = {
      sourceHolderIndex: "index", probabilityBefore: "probability", probabilityAfter: "probability", roll: "probability",
      procExpiryBefore: "frame", procExpiryAfter: "frame", cooldownBefore: "frame", cooldownAfter: "frame",
      remainingBefore: "count", remainingAfter: "count", windowRemainingFrames: "frame", healSnap: "healing",
      bubbleHealStacks: "healing", bubbleExpiry: "frame", cooldownExpiry: "frame", queueDelayFrames: "frame",
    };
    const observed = Object.entries(state).filter(([key, value]) => key !== "ruleId" && key !== "path" && value !== null).map(([key, value]) =>
      sourceInput(key, Number(value), stateUnits[key]!, `Go 在本次 ${ruleId} 原生回调实际观察的 ${key}`));
    native.add(`artifactAdditive.${request.id}.nativeState`, "来源圣遗物实际事件状态", expr.input("sourceValue"), [
      sourceInput("sourceValue", request.input.sourceValue, ruleId === "echoes" ? "ATK" : "healing", "原生回调本次实取数值"),
      ...observed,
    ], { unit: ruleId === "echoes" ? "ATK" : "healing", explanationKey: `事件门、概率、次数、窗口与排队由 Go 原生状态决定；共享核心只返回本次附加伤害数值。${state.ruleId === "echoes" && state.roll === null ? "此分支没有随机抽样。" : ""}` });
    calculated = { ...artifact, trace: [...artifact.trace, ...native.nodes] };
  }
  else if (request.kind === "character-healing") {
    calculated = resolveSourceHostHealingRequest(request, components, resolveSourceHostRequest, supportLinks);
  }
  else if (request.kind === "character-cooldown") {
    calculated = resolveSourceHostCooldownRequest(request, components, resolveSourceHostRequest);
  }
  else if (request.kind === "character-energy") {
    const input = request.input;
    if (request.componentApplications.length) throw new Error("能量计算不能携带伤害应用组件。");
    const energy = resolveSourceHostEnergyInput(input, request.sourceCommit ?? SOURCE_HOST_COMMIT, `energy.${request.id}`);
    if (input.operation === "particle-amount") {
      const read = request.statRead;
      if (!read || read.kind !== "stat" || read.actorIndex !== request.actorIndex || read.frame !== request.frame
        || read.selector.length !== 1 || read.selector[0] !== 7 || request.componentIds.length) throw new Error("粒子能量缺少本次实际充能读取。");
      assertSourceHostNumber(read.result[7]!, input.energyRecharge, "particle energy recharge");
    } else if (request.statRead) throw new Error("非粒子能量不应再次读取充能属性。");
    if (input.operation === "particle-apply") {
      const amount = components.get(request.componentIds[0]!);
      if (request.componentIds.length !== 1 || !amount || amount.request.kind !== "character-energy"
        || amount.request.input.operation !== "particle-amount" || amount.request.id >= request.id
        || amount.request.actorIndex !== request.actorIndex || amount.request.frame !== request.frame
        || amount.request.ability !== request.ability || amount.request.element !== request.element
        || amount.request.sourceCommit !== request.sourceCommit) throw new Error("粒子入账缺少同次实际回能量计算。");
      const prior = resolveSourceHostRequest(amount.request, components);
      assertSourceHostNumber(prior.value, amount.value, "particle amount response");
      assertSourceHostNumber(amount.value, input.amount, "particle applied amount");
      const prefix = `energyAmount.${amount.request.id}`;
      const finalNode = prior.trace.find(node => node.id === `energy.${amount.request.id}.amount`);
      calculated = { ...energy, trace: [...prefixTrace(prior.trace, prefix), ...energy.trace.map(node => ({ ...node,
        inputs: node.inputs.map(value => value.key === "amount" && finalNode
          ? { ...value, origin: { kind: "source-host-energy-amount", reference: `${prefix}.${finalNode.id}` } } : value),
      }))], explanationGaps: [...prior.explanationGaps, ...energy.explanationGaps] };
    } else {
      if (request.componentIds.length) throw new Error("直接能量变更不能携带粒子金额组件。");
      if (input.operation === "flat-change" && input.artifactRule) {
        const sources = { exile: "exile-4pc", scholar: "scholar-4pc", scroll: "scroll-2pc", reminiscence: "shim-4pc" };
        if (request.ability !== sources[input.artifactRule]) throw new Error("圣遗物能量公式与原生调用来源不一致。");
      }
      calculated = energy;
    }
  }
  else if (request.kind === "player-incoming") {
    const incoming = resolveSourceHostPlayerIncomingRequest(request);
    calculated = { ...incoming, explanationGaps: incoming.explanationGaps };
  }
  else if (request.kind === "player-shield") {
    if (request.input.output === "hpAfter") {
      const sourceId = request.hpBeforeCalculationId;
      const bonusId = request.bonusCalculationId;
      const incomingId = request.incomingCalculationId;
      if (JSON.stringify(request.componentIds) !== JSON.stringify([
        ...(sourceId === undefined ? [] : [sourceId]), ...(bonusId === undefined ? [] : [bonusId]),
        ...(incomingId === undefined ? [] : [incomingId]),
      ]) || bonusId !== undefined && request.scalarProvenance !== undefined)
        throw new Error("盾受击前 HP、强效来源与组件 ID 不一致。");
      const previousTrace: CalculationTraceNode[] = [];
      const previousGaps: string[] = [];
      if (sourceId !== undefined) {
        const prior = components.get(sourceId);
        if (!prior || sourceId >= request.id || prior.request.frame > request.frame ||
          prior.request.actorIndex !== request.actorIndex ||
          (prior.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT) ||
          (prior.request.kind !== "character-shield" &&
            (prior.request.kind !== "player-shield" || prior.request.input.output !== "hpAfter")))
          throw new Error("盾受击前 HP 缺少实际创建、刷新或前次消耗来源。");
        if (prior.request.kind === "character-shield" &&
          (sourceHostCharacterShieldRuleDescriptor(prior.request.input.ruleId).resultUnit ?? "HP") !== "HP")
          throw new Error("盾受击前 HP 不能引用 DEF 或吸收比率公式。");
        const resolved = resolveSourceHostRequest(prior.request, components);
        assertSourceHostNumber(resolved.value, prior.value, "shield HP source");
        assertSourceHostNumber(prior.value, request.input.hpBefore, "shield hpBefore");
        previousTrace.push(...prefixTrace(resolved.trace, `shieldHpSource.${sourceId}`));
        previousGaps.push(...resolved.explanationGaps);
      } else previousGaps.push("该护盾 HP 的创建或上次刷新尚无来源计算 ID；本次按真实 HP 读数执行，不能声称已展开上游来源。");
      if (bonusId !== undefined) {
        const prior = components.get(bonusId);
        if (!prior || prior.request.kind !== "character-shield" ||
          prior.request.input.ruleId !== "char-shield-crystallize-bonus-total" || bonusId >= request.id ||
          prior.request.frame !== request.frame || prior.request.actorIndex !== request.actorIndex ||
          (prior.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT))
          throw new Error("结晶盾本次合计强效缺少来源公式。");
        const resolved = resolveSourceHostRequest(prior.request, components);
        assertSourceHostNumber(resolved.value, prior.value, "crystallize shield bonus source");
        assertSourceHostNumber(prior.value, request.input.bonus, "crystallize shield bonus");
        previousTrace.push(...prefixTrace(resolved.trace, `shieldBonusSource.${bonusId}`));
        previousGaps.push(...resolved.explanationGaps);
      }
      if (incomingId !== undefined) {
        const prior = components.get(incomingId);
        if (!prior || (prior.request.kind !== "player-manual-incoming" && prior.request.kind !== "player-incoming") ||
          prior.request.attackId !== request.attackId || incomingId >= request.id ||
          prior.request.frame !== request.frame ||
          (prior.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT))
          throw new Error("玩家盾步骤缺少实际原始入射伤害来源。");
        const resolved = resolveSourceHostRequest(prior.request, components);
        assertSourceHostNumber(resolved.value, prior.value, "player incoming source");
        assertSourceHostNumber(prior.value, request.input.incomingDamage, "shield incoming damage");
        previousTrace.push(...prefixTrace(resolved.trace, `shieldIncomingSource.${incomingId}`));
        previousGaps.push(...resolved.explanationGaps);
      }
      const current = resolveSourceHostPlayerShieldRequest(request);
      const hpReference = sourceId === undefined ? undefined : (() => {
        const prior = components.get(sourceId)!;
        return prior.request.kind === "character-shield"
          ? `shieldHpSource.${sourceId}.characterShield.${sourceId}.${prior.request.input.ruleId}`
          : `shieldHpSource.${sourceId}.shieldHpAfter`;
      })();
      const incomingReference = incomingId === undefined ? undefined :
        `shieldIncomingSource.${incomingId}.${components.get(incomingId)?.request.kind === "player-manual-incoming"
          ? "manualIncomingRaw" : "incomingRawDamage"}`;
      calculated = { ...current,
        trace: [...previousTrace, ...current.trace.map(node => ({ ...node,
          inputs: node.inputs.map(value => value.key === "hpBefore" && hpReference
            ? { ...value, origin: { kind: "source-host-shield-hp", reference: hpReference } }
            : value.key === "bonus" && bonusId !== undefined
              ? { ...value, origin: { kind: "source-host-shield-bonus", reference:
                `shieldBonusSource.${bonusId}.characterShield.${bonusId}.char-shield-crystallize-bonus-total` } }
              : value.key === "incomingDamage" && incomingReference
                ? { ...value, origin: { kind: "source-host-player-incoming", reference: incomingReference } } : value),
        }))], explanationGaps: [...previousGaps, ...current.explanationGaps] };
    }
    else {
      if (request.hpBeforeCalculationId !== undefined || request.bonusCalculationId !== undefined)
        throw new Error("盾穿透阶段不能重带 HP 或强效创建来源 ID。");
      if (request.componentIds.length !== 1) throw new Error("盾穿透计算缺少先前的盾生命组件。");
      const prior = components.get(request.componentIds[0]!);
      if (prior?.request.kind !== "player-shield" || prior.request.input.output !== "hpAfter"
        || prior.request.attackId !== request.attackId || prior.request.id >= request.id
        || JSON.stringify({ ...prior.request.input, output: "damageAfter" }) !== JSON.stringify(request.input)) {
        throw new Error("盾穿透计算的前置盾生命上下文不一致。");
      }
      assertSourceHostNumber(resolveSourceHostPlayerShieldRequest(prior.request).value, prior.value, "shield hpAfter");
      calculated = resolveSourceHostPlayerShieldRequest(request);
    }
  }
  else if (request.kind === "character-drain") calculated = resolveSourceHostDrainSourceRequest(request, components,
    (prior, records) => resolveSourceHostRequest(prior, records, { ...options, drainMemo }), supportLinks);
  else if (request.kind === "player-manual-incoming") {
    const sourceId = request.rawCalculationId;
    if (sourceId === undefined ? request.componentIds.length !== 0
      : request.componentIds.length !== 1 || request.componentIds[0] !== sourceId)
      throw new Error("手工玩家自伤原始值组件身份无效。");
    const source = sourceId === undefined ? undefined : components.get(sourceId);
    if (sourceId !== undefined && (!source || source.request.kind !== "character-drain" ||
      sourceHostDrainSourceRuleDescriptor(source.request.input.ruleId).outputSlot !== "manual-raw-damage" ||
      sourceId >= request.id || source.request.frame > request.frame ||
      (source.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT)))
      throw new Error("手工玩家自伤缺少真实原始伤害生产者。");
    const raw = resolveSourceHostPlayerManualIncomingRequest(request);
    if (source) {
      const resolved = resolveSourceHostRequest(source.request, components);
      assertSourceHostNumber(resolved.value, source.value, `manual incoming source #${sourceId}`);
      assertSourceHostNumber(source.value, raw.value, "manual incoming raw damage");
      calculated = { value: raw.value, trace: [...resolved.trace, ...raw.trace],
        explanationGaps: [...resolved.explanationGaps, ...raw.explanationGaps] };
    } else calculated = raw;
  }
  else if (request.kind === "player-drain") {
    const sourceId = request.amountCalculationId;
    if (sourceId === undefined ? request.componentIds.length !== 0
      : request.componentIds.length !== 1 || request.componentIds[0] !== sourceId)
      throw new Error("玩家 Drain 金额前置组件身份无效。");
    const source = sourceId === undefined ? undefined : components.get(sourceId);
    if (sourceId !== undefined && (!source ||
      (source.request.kind !== "character-drain" && source.request.kind !== "player-manual-incoming" &&
        source.request.kind !== "player-incoming" && source.request.kind !== "player-shield-min") ||
      sourceId >= request.id || source.request.frame > request.frame ||
      (source.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== (request.sourceCommit ?? SOURCE_HOST_COMMIT)))
      throw new Error("玩家 Drain 缺少真实金额来源。");
    const hp = resolveSourceHostPlayerDrainRequest(request);
    if (source) {
      const resolved = resolveSourceHostRequest(source.request, components);
      assertSourceHostNumber(resolved.value, source.value, `drain source #${sourceId}`);
      assertSourceHostNumber(source.value, request.input.amount, "player drain amount");
      calculated = { value: hp.value, trace: [...resolved.trace, ...hp.trace],
        explanationGaps: [...resolved.explanationGaps, ...hp.explanationGaps] };
    } else calculated = { ...hp, explanationGaps: [...hp.explanationGaps,
      "此 DrainInfo.Amount 没有来源数值 ID；来源可能是玩家受击转发，不能将其误称为角色技能源公式。"] };
  }
  else if (request.kind === "player-shield-min") {
    if (request.componentIds.length !== 1) throw new Error("多盾最小穿透步骤缺少此前盾穿透计算。");
    const prior = components.get(request.componentIds[0]!);
    if (prior?.request.kind !== "player-shield" || prior.request.input.output !== "damageAfter"
      || prior.request.id >= request.id || prior.request.attackId !== request.attackId) {
      throw new Error("多盾最小穿透步骤引用的盾穿透计算无效。");
    }
    assertSourceHostNumber(prior.value, request.input.damageAfter, "shield minimum input");
    calculated = resolveSourceHostPlayerShieldMinimumRequest(request);
  }
  else if (request.kind === "transformative-base" || request.kind === "additive-base") {
    const input = request.input;
    if (input.elementalMastery < 0 || input.reactionBonus < 0 || input.baseMultiplier < 0) throw new Error("来源反应回调包含共享经典反应公式尚未支持的负输入。");
    assertSourceHostNumber(reactionLevelBaseDamage(input.characterLevel), input.levelBaseDamage, "reactionLevelBaseDamage");
    if (request.kind === "transformative-base") {
      const output = calculateTransformativeDamageTrace({ ...input, effectiveResistance: 0 });
      calculated = { value: output.finalDamage, trace: output.trace, explanationGaps: [] };
    } else {
      const reaction = input.baseMultiplier === 1.15 ? "aggravate" : input.baseMultiplier === 1.25 ? "spread" : undefined;
      if (!reaction) throw new Error(`未支持的激化基础系数 ${input.baseMultiplier}，不能猜作蔓激化或超激化。`);
      const output = executeAdditiveDamage({ ...input, reaction }, true);
      calculated = { value: output.flatDamage, trace: output.trace, explanationGaps: [] };
    }
    if (!request.statRead) calculated.explanationGaps.push(`反应基数 #${request.id}（${request.ability}）使用元素精通 ${input.elementalMastery}；本次请求尚未保存该 EM 的属性读取回执，数值公式已展开但其面板来源未连接。`);
    else {
      const read = request.statRead;
      if (read.kind !== "stat" || read.nonExtra || read.actorIndex !== request.actorIndex || read.frame !== request.frame
        || read.selector.length !== 1 || read.selector[0] !== 8)
        throw new Error(`反应基数 #${request.id} 的精通回执与本次角色、帧或 EM getter 不匹配。`);
      const provenance = executeSourceHostNestedStatRead(read, `sourceStats.reaction.${request.id}`,
        `https://github.com/genshinsim/gcsim/blob/${request.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      calculated.explanationGaps.push(...provenance.explanationGaps);
      if (options.explicitFinalScaling) calculated.explanationGaps.push(`反应基数 #${request.id} 使用编辑的元素精通；原 EM getter 回执仅保留为历史来源，不连接到本次编辑输入。`);
      else {
        assertSourceHostNumber(read.result[8]!, input.elementalMastery, `reaction #${request.id} elementalMastery`);
        const reference = provenance.finalNodeIds[8]!;
        const nodeId = request.kind === "transformative-base" ? "transformativeEmBonus" : "additiveEmBonus";
        calculated.trace = calculated.trace.map(node => node.id !== nodeId ? node : ({ ...node,
          inputs: node.inputs.map(value => value.key === "elementalMastery"
            ? { ...value, origin: { kind: "source-host-stat-provenance", reference } } : value),
          childIds: [...new Set([...node.childIds, reference])],
          explanationKey: `${traceText(node.explanationKey)} 精通来自此反应生成时的唯一一次实际 EM getter；后续复用组件不再次取样。`,
        }));
      }
      calculated.trace = [...provenance.trace, ...calculated.trace];
    }
  } else if (request.kind === "stellar-contributor" || request.kind === "stellar-ranked" || request.kind === "stellar-delivery" || request.kind === "stellar-direct" || request.kind === "stellar-conduct-event") {
    const special = resolveSourceHostStellarRequest(request, components, resolveSourceHostRequest, options.explicitFinalScaling);
    calculated = { ...special, explanationGaps: special.explanationGaps };
  } else {
    // The validated union has excluded both classic reaction enum values above;
    // TypeScript does not eliminate that entire enum-valued object member.
    const special = resolveSourceHostSpecialRequest(request as SourceHostSpecialRequest, components, resolveSourceHostRequest, options.explicitFinalScaling);
    calculated = { ...special, explanationGaps: special.explanationGaps };
  }
  // Ranked Lunar arithmetic evaluates all contributors together; carry each
  // actual snapshot's provenance into that same visible graph as well.
  const statRequests = request.kind === "lunar-ranked" || request.kind === "stellar-ranked"
    ? request.componentIds.map(id => components.get(id)!.request) : [request];
  const provenanceNodes: CalculationTraceNode[] = [];
  let damageFinalNodeIds: readonly string[] = [];
  const supportTraceIds = new Set<number>();
  const supportTraceNodeIds = new Set<string>();
  for (const owner of statRequests) {
    if (owner !== request) verifySourceHostArtifactSupport(owner, components).forEach((value, key) => supportLinks.set(key, value));
    for (const id of sourceHostArtifactSupportClosureIds([owner], components)) {
      if (supportTraceIds.has(id)) continue;
      supportTraceIds.add(id);
      const record = components.get(id)!;
      if (record.request.kind !== "artifact-scalar" && record.request.kind !== "character-modifier" && record.request.kind !== "character-scalar"
        && !(record.request.kind === "character-additive" && record.request.input.phase === "creation")) throw new Error(`来源修饰器支持记录 #${id} 类型错误`);
      const support = resolveSourceHostRequest(record.request, components);
      assertSourceHostNumber(support.value, record.value, `modifier support #${id}`);
      for (const node of support.trace) if (!supportTraceNodeIds.has(node.id)) {
        supportTraceNodeIds.add(node.id);
        provenanceNodes.push(node);
      }
      calculated.explanationGaps.push(...support.explanationGaps);
    }
  }
  for (const statRequest of statRequests) {
    if (statRequest.kind === "character-modifier" && (statRequest.statRead || statRequest.statReads?.length)) {
      const multi = statRequest.statReads !== undefined;
      const reads = statRequest.statReads ?? [statRequest.statRead!];
      for (const [readIndex, read] of reads.entries()) {
      const readPrefix = multi ? `sourceStats.characterModifier.${statRequest.id}.${readIndex}` : `sourceStats.characterModifier.${statRequest.id}`;
      const provenance = executeSourceHostNestedStatRead(read, readPrefix,
        `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      provenanceNodes.push(...provenance.trace);
      calculated.explanationGaps.push(...provenance.explanationGaps);
      if ("state" in statRequest.input && isSourceHostCharacterModifierDynamicRuleId(statRequest.input.ruleId)) {
        const descriptor = sourceHostCharacterModifierDynamicRuleDescriptor(statRequest.input.ruleId);
        const leaf = multi ? descriptor.statLeaves?.[readIndex] : descriptor.statLeaf;
        if (leaf) {
          const single = leaf.getter === "stat" || leaf.getter === "non-extra-stat";
          const atk = leaf.getter === "total-atk" || leaf.getter === "non-extra-total-atk";
          const def = leaf.getter === "total-def" || leaf.getter === "non-extra-total-def";
          const selector = single ? [leaf.statIndex] : atk ? [24, 6, 5] : def ? [25, 1, 2] : [23, 4, 3];
          const nonExtra = leaf.getter.startsWith("non-extra-");
          const expectedKind = single ? leaf.getter : "select-stat";
          if (selector.some(slot => slot === undefined) || read.kind !== expectedKind || read.nonExtra !== nonExtra
            || JSON.stringify(read.selector) !== JSON.stringify(selector)
            || (leaf.actor === "holder" && read.actorIndex !== statRequest.input.sourceHolderIndex)
            || (leaf.actor === "request-actor" && read.actorIndex !== statRequest.actorIndex)) {
            throw new Error(`角色 modifier #${statRequest.id} 的原生属性读取与状态叶 ${leaf.stateKey} 不匹配`);
          }
          const stateValue = statRequest.input.state[leaf.stateKey];
          if (stateValue === undefined) throw new Error(`角色 modifier #${statRequest.id} 缺少状态叶 ${leaf.stateKey}`);
          const value = single ? read.result[leaf.statIndex!]!
            : atk ? read.result[24]! * (1 + read.result[6]!) + read.result[5]!
            : def ? read.result[25]! * (1 + read.result[1]!) + read.result[2]!
            : read.result[23]! * (1 + read.result[4]!) + read.result[3]!;
          assertSourceHostNumber(value, stateValue, `character modifier ${leaf.stateKey}`);
          let reference: string;
          if (single) reference = provenance.finalNodeIds[leaf.statIndex!]!;
          else {
            const slots = selector as number[];
            reference = `${readPrefix}.state.${leaf.stateKey}`;
            const derived = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
            derived.add(reference, `${descriptor.title}：本次实际读取的 ${leaf.stateKey}`,
              expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
                { ...sourceInput("base", read.result[slots[0]!]!, "stat", "同次 getter 的基础属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[0]!]! } },
                { ...sourceInput("percent", read.result[slots[1]!]!, "ratio", "同次 getter 的属性百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[1]!]! } },
                { ...sourceInput("flat", read.result[slots[2]!]!, "stat", "同次 getter 的固定属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[2]!]! } },
              ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat", explanationKey: `只使用帧 ${read.frame} 的这一次来源 getter；结果已核对动态公式状态叶 ${leaf.stateKey}。` });
            provenanceNodes.push(...derived.nodes);
          }
          calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input =>
            node.id === `characterModifier.${statRequest.id}.${statRequest.input.ruleId}` && input.key === leaf.stateKey
              ? { ...input, origin: { kind: "source-host-stat-provenance", reference } } : input) }));
        } else calculated.explanationGaps.push("角色动态公式的状态叶值来自原回调；附带属性读取展示其真实上游，但未声明可逐键归因的 getter 槽位。");
      }
      }
    }
    if (statRequest.kind === "character-scalar" && statRequest.statRead) {
      const read = statRequest.statRead;
      const descriptor = sourceHostCharacterScalarRuleDescriptor(statRequest.input.ruleId);
      const provenance = executeSourceHostNestedStatRead(read, `sourceStats.characterScalar.${statRequest.id}`,
        `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      provenanceNodes.push(...provenance.trace);
      calculated.explanationGaps.push(...provenance.explanationGaps);
      const leaf = descriptor.statLeaf;
      if (leaf) {
        const single = leaf.getter === "stat" || leaf.getter === "non-extra-stat";
        const atk = leaf.getter === "total-atk" || leaf.getter === "non-extra-total-atk";
        const def = leaf.getter === "total-def" || leaf.getter === "non-extra-total-def";
        const selector = single ? [leaf.statIndex] : atk ? [24, 6, 5] : def ? [25, 1, 2] : [23, 4, 3];
        const nonExtra = leaf.getter.startsWith("non-extra-");
        const expectedKind = single ? leaf.getter : "select-stat";
        if (selector.some(slot => slot === undefined) || read.kind !== expectedKind || read.nonExtra !== nonExtra
          || JSON.stringify(read.selector) !== JSON.stringify(selector)
          || (leaf.actor === "holder" && read.actorIndex !== statRequest.input.sourceHolderIndex)
          || (leaf.actor === "request-actor" && read.actorIndex !== statRequest.actorIndex)) {
          throw new Error(`角色标量 #${statRequest.id} 的原生属性读取与状态叶 ${leaf.stateKey} 不匹配`);
        }
        const stateValue = statRequest.input.state[leaf.stateKey];
        if (stateValue === undefined) throw new Error(`角色标量 #${statRequest.id} 缺少状态叶 ${leaf.stateKey}`);
        const value = single ? read.result[leaf.statIndex!]!
          : atk ? read.result[24]! * (1 + read.result[6]!) + read.result[5]!
          : def ? read.result[25]! * (1 + read.result[1]!) + read.result[2]!
          : read.result[23]! * (1 + read.result[4]!) + read.result[3]!;
        assertSourceHostNumber(value, stateValue, `character scalar ${leaf.stateKey}`);
        let reference: string;
        if (single) reference = provenance.finalNodeIds[leaf.statIndex!]!;
        else {
          const slots = selector as number[];
          reference = `sourceStats.characterScalar.${statRequest.id}.state.${leaf.stateKey}`;
          const derived = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
          derived.add(reference, `${descriptor.title}：本次实际读取的 ${leaf.stateKey}`,
            expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
              { ...sourceInput("base", read.result[slots[0]!]!, "stat", "同次 getter 的基础属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[0]!]! } },
              { ...sourceInput("percent", read.result[slots[1]!]!, "ratio", "同次 getter 的属性百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[1]!]! } },
              { ...sourceInput("flat", read.result[slots[2]!]!, "stat", "同次 getter 的固定属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[2]!]! } },
            ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat", explanationKey: `只使用帧 ${read.frame} 的这一次来源 getter；结果已核对角色标量状态叶 ${leaf.stateKey}。` });
          provenanceNodes.push(...derived.nodes);
        }
        calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input =>
          node.id === `characterScalar.${statRequest.id}.${statRequest.input.ruleId}` && input.key === leaf.stateKey
            ? { ...input, origin: { kind: "source-host-stat-provenance", reference } } : input) }));
      } else calculated.explanationGaps.push("角色标量公式的状态叶值来自原回调；附带属性读取展示其真实上游，但未声明可逐键归因的 getter 槽位。");
    }
    if ((statRequest.kind === "character-additive" && (statRequest.statRead || statRequest.statReads?.length)) ||
      ((statRequest.kind === "character-flat" || statRequest.kind === "character-multiplier") && statRequest.statReads?.length)) {
      const flat = statRequest.kind === "character-flat";
      const multiplier = statRequest.kind === "character-multiplier";
      const descriptor = flat ? sourceHostCharacterFlatRuleDescriptor(statRequest.input.ruleId)
        : multiplier ? sourceHostCharacterMultiplierRuleDescriptor(statRequest.input.ruleId)
          : sourceHostCharacterAdditiveRuleDescriptor(statRequest.input.ruleId);
      const reads = statRequest.kind === "character-additive" ? statRequest.statReads ?? [statRequest.statRead!] : statRequest.statReads ?? [];
      for (const [index, read] of reads.entries()) {
        const leaf = flat || multiplier ? descriptor.statLeaves?.[index] ?? (index === 0 ? descriptor.statLeaf : undefined)
          : statRequest.statReads ? descriptor.statLeaves?.[index] : descriptor.statLeaf;
        const readPrefix = `sourceStats.${flat ? "characterFlat" : multiplier ? "characterMultiplier" : "characterAdditive"}.${statRequest.id}.${index}`;
        const provenance = executeSourceHostNestedStatRead(read, readPrefix,
          `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
        provenanceNodes.push(...provenance.trace);
        calculated.explanationGaps.push(...provenance.explanationGaps);
        if (!leaf) {
          calculated.explanationGaps.push("角色附加伤害原生 getter 已展示；规则没有声明可逐键归因的状态叶。");
          continue;
        }
        const single = leaf.getter === "stat" || leaf.getter === "non-extra-stat";
        const atk = leaf.getter === "total-atk" || leaf.getter === "non-extra-total-atk";
        const def = leaf.getter === "total-def" || leaf.getter === "non-extra-total-def";
        const slots = single ? [leaf.statIndex] : atk ? [24, 6, 5] : def ? [25, 1, 2] : [23, 4, 3];
        const expectedKind = single ? leaf.getter : "select-stat";
        if (slots.some(slot => slot === undefined) || read.kind !== expectedKind || read.nonExtra !== leaf.getter.startsWith("non-extra-")
          || JSON.stringify(read.selector) !== JSON.stringify(slots)
          || (leaf.actor === "holder" && read.actorIndex !== statRequest.input.sourceHolderIndex)
          || (leaf.actor === "request-actor" && read.actorIndex !== statRequest.actorIndex)) {
          throw new Error(`角色公式 #${statRequest.id} 的原生属性读取与状态叶 ${leaf.stateKey} 不匹配`);
        }
        const actual = single ? read.result[leaf.statIndex!]!
          : read.result[slots[0]!]! * (1 + read.result[slots[1]!]!) + read.result[slots[2]!]!;
        assertSourceHostNumber(actual, statRequest.input.state[leaf.stateKey]!, `character state ${leaf.stateKey}`);
        let reference = provenance.finalNodeIds[single ? leaf.statIndex! : slots[0]!]!;
        if (!single) {
          reference = `${readPrefix}.state.${leaf.stateKey}`;
          const derived = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
          derived.add(reference, `${descriptor.title}：原生 getter 的 ${leaf.stateKey}`,
            expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
              { ...sourceInput("base", read.result[slots[0]!]!, "stat", "同次 getter 的基础属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[0]!]! } },
              { ...sourceInput("percent", read.result[slots[1]!]!, "ratio", "同次 getter 的属性百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[1]!]! } },
              { ...sourceInput("flat", read.result[slots[2]!]!, "stat", "同次 getter 的固定属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[2]!]! } },
            ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat", explanationKey: `按来源第 ${index + 1} 次 getter 重建状态叶，未额外读取属性。` });
          provenanceNodes.push(...derived.nodes);
        }
        const termId = flat ? `characterFlat.${statRequest.id}.${statRequest.input.ruleId}.sourceTerm`
          : multiplier ? `characterMultiplier.${statRequest.id}.${statRequest.input.ruleId}.sourceTerm`
          : `characterAdditive.${statRequest.id}.${statRequest.input.ruleId}`;
        calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input =>
          node.id === termId && input.key === leaf.stateKey
            ? { ...input, origin: { kind: "source-host-stat-provenance", reference } } : input) }));
      }
    }
    if (statRequest.kind === "character-healing" && statRequest.statRead) {
      const read = statRequest.statRead;
      const provenance = executeSourceHostNestedStatRead(read, `sourceStats.healing.${statRequest.id}`,
        `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      provenanceNodes.push(...provenance.trace);
      const reference = `sourceStats.healing.${statRequest.id}.maxHp`;
      const total = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
      total.add(reference, "本治疗阶段实际读取的生命值上限", expr.add(expr.mul(expr.input("baseHP"), expr.add(expr.value(1), expr.input("hpPercent"))), expr.input("flatHP")), [
        { ...sourceInput("baseHP", read.result[23]!, "HP", "本次读取的基础生命值"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[23]! } },
        { ...sourceInput("hpPercent", read.result[4]!, "ratio", "本次读取的生命值百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[4]! } },
        { ...sourceInput("flatHP", read.result[3]!, "HP", "本次读取的固定生命值"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[3]! } },
      ], { unit: "HP", explanationKey: "保持此阶段唯一一次 SelectStat(false, BaseHP, HPP, HP) 的实际读取；基础量和过量治疗分别保留各自时点的 MaxHP。" });
      provenanceNodes.push(...total.nodes);
      calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input =>
        ["maxHpForBase", "maxHpForOverheal"].includes(input.key) && node.id.startsWith(`healing.${statRequest.id}.`)
          ? { ...input, origin: { kind: "source-host-stat-provenance", reference } } : input) }));
      calculated.explanationGaps.push(...provenance.explanationGaps);
    }
    if (statRequest.kind === "character-energy" && statRequest.statRead) {
      const provenance = executeSourceHostNestedStatRead(statRequest.statRead, `sourceStats.energy.${statRequest.id}`,
        `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      provenanceNodes.push(...provenance.trace);
      calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input => input.key === "energyRecharge"
        ? { ...input, origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[7]! } } : input) }));
      calculated.explanationGaps.push(...provenance.explanationGaps);
    }
    if (statRequest.kind === "weapon-additive") {
      const provenance = executeSourceHostNestedStatRead(statRequest.statRead, `sourceStats.weapon.${statRequest.id}`,
        `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      provenanceNodes.push(...provenance.trace);
      let statReference = provenance.finalNodeIds[8]!;
      if (statRequest.input.ruleId === "cinnabar") {
        const total = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
        statReference = `sourceStats.weapon.${statRequest.id}.totalDefense`;
        total.add(statReference, "武器实际读取的总防御力", expr.add(expr.mul(expr.input("baseDEF"), expr.add(expr.value(1), expr.input("defPercent"))), expr.input("flatDEF")), [
          { ...sourceInput("baseDEF", statRequest.statRead.result[25]!, "DEF", "实际属性读取中的基础防御力"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[25]! } },
          { ...sourceInput("defPercent", statRequest.statRead.result[1]!, "ratio", "实际属性读取中的防御百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[1]! } },
          { ...sourceInput("flatDEF", statRequest.statRead.result[2]!, "DEF", "实际属性读取中的固定防御力"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[2]! } },
        ], { unit: "DEF", explanationKey: "沿用来源 SelectStat(false, BaseDEF, DEFP, DEF).TotalDEF() 的实际顺序；三个输入各自链接本次真实属性读取。" });
        provenanceNodes.push(...total.nodes);
      }
      calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input => input.key === "statValue"
        ? { ...input, origin: { kind: "source-host-stat-provenance", reference: statReference } } : input) }));
      calculated.explanationGaps.push(...provenance.explanationGaps);
    }
    if (statRequest.kind === "artifact-additive" && statRequest.input.ruleId === "echoes" && statRequest.statRead) {
      const provenance = executeSourceHostNestedStatRead(statRequest.statRead, `sourceStats.artifact.${statRequest.id}`,
        `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
      provenanceNodes.push(...provenance.trace);
      const totalReference = `sourceStats.artifact.${statRequest.id}.totalAttack`;
      const total = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
      total.add(totalReference, "余响本次实际读取的总攻击力", expr.add(expr.mul(expr.input("baseATK"), expr.add(expr.value(1), expr.input("atkPercent"))), expr.input("flatATK")), [
        { ...sourceInput("baseATK", statRequest.statRead.result[24]!, "ATK", "本次属性读取中的基础攻击力"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[24]! } },
        { ...sourceInput("atkPercent", statRequest.statRead.result[6]!, "ratio", "本次属性读取中的攻击百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[6]! } },
        { ...sourceInput("flatATK", statRequest.statRead.result[5]!, "ATK", "本次属性读取中的固定攻击力"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[5]! } },
      ], { unit: "ATK", explanationKey: "只使用来源 SelectStat(false, BaseATK, ATKP, ATK) 的这一次读取，不追加第二次 getter 或重排修正。" });
      provenanceNodes.push(...total.nodes);
      calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input => input.key === "sourceValue"
        ? { ...input, origin: { kind: "source-host-stat-provenance", reference: totalReference } } : input) }));
      calculated.explanationGaps.push(...provenance.explanationGaps);
    }
    // A zero talent coefficient and zero additive base make all panel terms
    // irrelevant to this recorded damage. In particular, orbital collision
    // receipts must not invent a missing full character snapshot.
    if (statRequest.kind === "damage" && statRequest.input.scaling === 0 && statRequest.input.flatDamage === 0) continue;
    if (statRequest.snapshot?.statProvenance == null) continue;
    const provenance = executeSourceHostStatProvenance(statRequest.snapshot.statProvenance, statRequest.snapshotStats ?? undefined,
      `sourceStats.${statRequest.id}`, false, `https://github.com/genshinsim/gcsim/blob/${statRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
    provenanceNodes.push(...provenance.trace);
    calculated.explanationGaps.push(...provenance.explanationGaps);
    if (statRequest.kind === "damage") {
      damageFinalNodeIds = provenance.finalNodeIds;
      continue;
    }
    if (statRequest.kind === "character-additive" || statRequest.kind === "character-flat") {
      const descriptor = statRequest.kind === "character-flat"
        ? sourceHostCharacterFlatRuleDescriptor(statRequest.input.ruleId)
        : sourceHostCharacterAdditiveRuleDescriptor(statRequest.input.ruleId);
      const leaves = "snapshotLeaves" in descriptor && descriptor.snapshotLeaves
        ? descriptor.snapshotLeaves : descriptor.snapshotLeaf ? [descriptor.snapshotLeaf] : [];
      for (const leaf of leaves) {
        let reference = provenance.finalNodeIds[8]!;
        if (leaf.getter !== "em") {
          const slots = leaf.getter === "total-atk" ? [24, 6, 5] : [25, 1, 2];
          reference = `sourceStats.${statRequest.id}.state.${leaf.stateKey}`;
          const derived = new TraceBuilder(sourceFormulaRefs(statRequest.sourceCommit));
          derived.add(reference, `${descriptor.title}：原攻击快照 ${leaf.stateKey}`,
            expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("percent"))), expr.input("flat")), [
              { ...sourceInput("base", statRequest.snapshotStats![slots[0]!]!, "stat", "本击快照基础属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[0]!]! } },
              { ...sourceInput("percent", statRequest.snapshotStats![slots[1]!]!, "ratio", "本击快照百分比"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[1]!]! } },
              { ...sourceInput("flat", statRequest.snapshotStats![slots[2]!]!, "stat", "本击快照固定属性"), origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[slots[2]!]! } },
            ], { unit: descriptor.inputs[leaf.stateKey]?.unit ?? "stat", explanationKey: "从原攻击快照三槽重建，原回调没有再次调用 getter。" });
          provenanceNodes.push(...derived.nodes);
        }
        const termId = statRequest.kind === "character-flat"
          ? `characterFlat.${statRequest.id}.${statRequest.input.ruleId}.sourceTerm`
          : `characterAdditive.${statRequest.id}.${statRequest.input.ruleId}`;
        calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(input =>
          node.id === termId && input.key === leaf.stateKey
            ? { ...input, origin: { kind: "source-host-stat-provenance", reference } } : input) }));
      }
    }
    calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(value => {
      let statIndex: number | undefined;
      if (node.id === "sourceScalingStat" || node.id === "directLunarFinalStat" || node.id === "stellarDirectFinalStat") {
        if (statRequest.kind !== "lunar-direct" && statRequest.kind !== "stellar-direct") return value;
        if (value.context?.sourceCalculationId !== undefined && value.context.sourceCalculationId !== statRequest.id) return value;
        if (options.explicitFinalScaling) return value;
        const slots = statRequest.input.scalingStat === "atk" ? [24, 6, 5] : statRequest.input.scalingStat === "hp" ? [23, 4, 3] : [25, 1, 2];
        statIndex = value.key === "baseStat" ? slots[0] : value.key === "statPercent" ? slots[1] : value.key === "flatStat" ? slots[2] : ["EM", "elementalMastery"].includes(value.key) ? 8 : undefined;
      } else if (!options.explicitFinalScaling && ["EM", "CR", "CD", "critDamage"].includes(value.key)) {
        const owner = value.context?.contributorId;
        if (owner !== `source-actor-${String(statRequest.actorIndex).padStart(4, "0")}`) return value;
        if (value.context?.sourceCalculationId !== statRequest.id) return value;
        statIndex = value.key === "EM" ? 8 : value.key === "CR" ? 9 : 10;
      }
      return statIndex === undefined ? value : { ...value, origin: { kind: "source-host-stat-provenance", reference: provenance.finalNodeIds[statIndex]! } };
    }) }));
  }
  for (const scalarRequest of statRequests) {
    if (scalarRequest.scalarProvenance == null) continue;
    const expected: Partial<Record<SourceHostScalarKind, number>> = {};
    if (scalarRequest.kind === "damage" || scalarRequest.kind === "lunar-direct" || scalarRequest.kind === "lunar-delivery" || scalarRequest.kind === "stellar-direct" || scalarRequest.kind === "stellar-delivery") {
      expected.resistance = scalarRequest.input.effectiveResistance;
      expected["defense-adjustment"] = scalarRequest.input.defenseAdjustment;
      if (scalarRequest.kind === "lunar-direct" || scalarRequest.kind === "stellar-direct" || scalarRequest.input.amped) expected["reaction-bonus"] = scalarRequest.input.reactionBonus;
    } else if (scalarRequest.kind === "transformative-base" || scalarRequest.kind === "additive-base" || scalarRequest.kind === "lunar-contributor" || scalarRequest.kind === "stellar-contributor") {
      expected["reaction-bonus"] = scalarRequest.input.reactionBonus;
    } else if (scalarRequest.kind === "character-healing" && scalarRequest.input.operation === "bonus") {
      expected["heal-bonus"] = scalarRequest.input.healBonus;
    } else if (scalarRequest.kind === "character-cooldown" && scalarRequest.input.operation === "duration") {
      expected["cooldown-factor"] = scalarRequest.input.cooldownFactor;
    } else if (scalarRequest.kind === "player-shield") {
      expected["shield-bonus"] = scalarRequest.input.bonus;
    } else if (scalarRequest.kind === "character-shield" && scalarRequest.input.ruleId === "char-shield-crystallize-bonus-total") {
      const handlerBonus = scalarRequest.input.state.handlerBonus;
      if (handlerBonus === undefined) throw new Error("结晶盾缺少本次原生护盾强效读取值。");
      expected["shield-bonus"] = handlerBonus;
    } else if (scalarRequest.kind === "player-incoming" && scalarRequest.input.amped) {
      expected["reaction-bonus"] = scalarRequest.input.reactionBonus;
    }
    const scalar = executeSourceHostScalarProvenance(scalarRequest.scalarProvenance,
      options.explicitFinalScaling ? {} : expected, `sourceScalar.${scalarRequest.id}`,
      `https://github.com/genshinsim/gcsim/blob/${scalarRequest.sourceCommit ?? SOURCE_HOST_COMMIT}/`, supportLinks);
    provenanceNodes.push(...scalar.trace);
    calculated.explanationGaps.push(...scalar.explanationGaps);
    if (options.explicitFinalScaling) {
      calculated.explanationGaps.push("标量来源回执仍展示原始运行时的实际读取；编辑后的反应加成、抗性和防御输入是独立数值，不连接为旧回执的输出。");
      continue;
    }
    const owner = `source-actor-${String(scalarRequest.actorIndex).padStart(4, "0")}`;
    calculated.trace = calculated.trace.map(node => ({ ...node, inputs: node.inputs.map(value => {
      // Ranked Lunar stages contain several actors in one graph. A contributor
      // receipt may only explain that actor's own input, never a neighbor's.
      if ((request.kind === "lunar-ranked" || request.kind === "stellar-ranked") && (value.key !== "reactionBonus" || value.context?.contributorId !== owner || (request.kind === "stellar-ranked" && value.context?.sourceCalculationId !== scalarRequest.id))) return value;
      if (request.kind !== "lunar-ranked" && request.kind !== "stellar-ranked" && value.context?.sourceCalculationId !== undefined && value.context.sourceCalculationId !== scalarRequest.id) return value;
      if (node.id.startsWith("component.")) return value;
      let kind: SourceHostScalarKind | undefined;
      if (value.key === "reactionBonus") kind = "reaction-bonus";
      else if (scalarRequest.kind === "character-healing" && value.key === "healBonus") kind = "heal-bonus";
      else if (scalarRequest.kind === "character-cooldown" && value.key === "cooldownFactor") kind = "cooldown-factor";
      else if (scalarRequest.kind === "player-shield" && value.key === "bonus") kind = "shield-bonus";
      else if (scalarRequest.kind === "character-shield" && value.key === "handlerBonus") kind = "shield-bonus";
      else if (value.key === "resistance" || value.key === "effectiveResistance") kind = "resistance";
      else if (value.key === "defenseAdjustment") kind = "defense-adjustment";
      const reference = kind === undefined ? undefined : scalar.finalNodeIds[kind];
      return reference === undefined ? value : { ...value, origin: { kind: "source-host-scalar-provenance", reference } };
    }) }));
  }
  let trace = [...provenanceNodes, ...calculated.trace];
  if (request.kind === "damage") {
    const linked = linkSourceHostDamageStatInputs(request, damageFinalNodeIds, trace, options.explicitFinalScaling ?? false);
    trace = linked.trace;
    calculated.explanationGaps.push(...linked.explanationGaps);
  }
  const result: SourceHostCalculation = { request, ...calculated, trace,
    explanationGaps: [...new Set(calculated.explanationGaps)], verification: "provisional", explanationStatus: "partial" };
  if (request.kind === "character-drain") drainMemo.set(request.id, result);
  if (cacheable) { freezeValidationValue(result);validation.memo.set(raw as object,result); }
  return result;
}

/** One resolver per run. The returned number is used by Go for actual callbacks/HP. */
export function createSourceHostFormulaResolver(options: { memoize?: boolean } = {}) {
  const calculations: SourceHostCalculation[] = [];
  const records = new Map<number, SourceHostCalculationRecord>();
  const drainMemo = new Map<number, SourceHostCalculation>();
  const memo = new WeakMap<object, SourceHostCalculation>();
  const frozen = new WeakSet<object>();
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== "object" || frozen.has(value) || isImmutableTraceNode(value)) return;
    frozen.add(value);
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  if (options.memoize !== false) liveResolverMemos.set(records, memo);
  return {
    calculations,
    resolve(requestJson: string): string {
      let id: number | null = null;
      try {
        const request: unknown = JSON.parse(requestJson);
        if (typeof request === "object" && request !== null && "id" in request && typeof request.id === "number") id = request.id;
        const result = resolveSourceHostRequest(request, records, { drainMemo });
        if (records.has(result.request.id)) throw new Error(`重复来源计算 ID ${result.request.id}`);
        if (options.memoize !== false) {
          freeze(result);
          memo.set(result.request, result);
        }
        calculations.push(result);
        records.set(result.request.id, result);
        return JSON.stringify({ protocol: SOURCE_HOST_PROTOCOL, id: result.request.id, value: result.value });
      } catch (error) {
        return JSON.stringify({ protocol: SOURCE_HOST_PROTOCOL, id, error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
