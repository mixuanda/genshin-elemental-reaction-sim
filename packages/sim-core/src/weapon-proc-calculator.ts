import { getWeaponProcDefinition, getWeaponProcCoefficient, getWeaponProcCooldownFrames, getWeaponProcTriggerProbability, weaponProcDefinitions, WEAPON_PROC_DATA_IDENTITY, WEAPON_PROC_LIFECYCLE, type WeaponProcId, type WeaponProcDefinition } from "@genshin-dps-lab/reaction-formulas";
import { expr } from "./calculation-trace";
import { calculatorDocumentSchema, weaponProcCalculatorContextSchema, CALCULATOR_SCHEMA_VERSION, CALCULATOR_RULE_VERSION, type CalculatorDocument, type CalculatorBuild, type CalculatorFormula, type WeaponProcCalculatorContext } from "./calculator-model";

const legacyProcIds = new Set<WeaponProcId>(["halberd", "ashgravendrinkinghorn", "sequenceofsolitude"]);
const contextDependency = "weapon-proc-context:triggering-target";
const assumptionPrefix = "独立追击来源条件：";

/** Describe the condition of this already-triggered hit without running or requiring its lifecycle. */
function lifecycleAssumption(definition: WeaponProcDefinition): string | undefined {
  switch (definition.lifecycleKind) {
    case "flute": {
      const lifecycle = WEAPON_PROC_LIFECYCLE.flute;
      return `本次是集齐${lifecycle.requiredNotes}个音符后已经发生的一次追击。收集音符门限为${lifecycle.noteCooldownFrames}帧，音符窗口为${lifecycle.noteDurationFrames}帧；收集音符门限不是独立追击伤害冷却，不能据此推算追击频率，也不把音符数乘入本击伤害。`;
    }
    case "debateclub": {
      const lifecycle = WEAPON_PROC_LIFECYCLE.debateclub;
      return `来源技能事件开启${lifecycle.effectDurationFrames}帧窗口并重置追击冷却，窗口内合格普攻／重击可触发，追击伤害冷却为${lifecycle.hitCooldownFrames}帧。这里计算该窗口中已经发生的一次追击，不要求补建技能或轮转。`;
    }
    case "crescentpike": {
      const lifecycle = WEAPON_PROC_LIFECYCLE.crescentpike;
      return `持有者站场时实际收到微粒／晶球事件开启${lifecycle.effectDurationFrames}帧增益，满能量也可开启；有效期间每次合格的非零普攻／重击伤害可独立追击。来源无独立追击伤害冷却；不以冷却0计算频率或期望值。本入口以这一次已经触发为前提，不要求填写拾球记录。`;
    }
    case "endoftheline": {
      const lifecycle = WEAPON_PROC_LIFECYCLE.endoftheline;
      return `来源技能事件启动${lifecycle.effectDurationFrames}帧效果，启动冷却${lifecycle.activationCooldownFrames}帧，每次效果最多${lifecycle.procLimit}次追击；前${lifecycle.procLimit - 1}次之后分别有${lifecycle.hitCooldownFrames}帧伤害冷却。成功重新启动会重置次数与有效的伤害冷却。本入口只计算其中已经发生的一次，不乘剩余次数或整段窗口。`;
    }
    default: return undefined;
  }
}

export interface WeaponProcCalculatorInput {
  weaponId: WeaponProcId;
  refinement: number;
  characterLevel: number;
  build: CalculatorBuild;
  enemy: CalculatorDocument["enemy"];
  /** Actual physical plus general damage bonus for this proc; excludes its host's normal/E/Q-only bonus. */
  damageBonus: number;
  /** Cryo/Frozen on the original triggering target, sampled once for the entire proc AoE. */
  triggeringTargetCryoOrFrozen?: boolean | undefined;
}

/** One actual proc, not a prediction that a host action will trigger it. Uses the ordinary shared core. */
export function createWeaponProcCalculatorDocument(input: WeaponProcCalculatorInput): CalculatorDocument {
  const definition = getWeaponProcDefinition(input.weaponId);
  if (!definition) throw new Error(`尚未接入该武器的独立追击：${input.weaponId}`);
  if (!Number.isInteger(input.refinement) || input.refinement < 1 || input.refinement > 5) throw new Error("武器精炼必须为 R1–R5。");
  const usesContext = !legacyProcIds.has(definition.weaponId);
  const coefficient = definition.cryoOrFrozenCoefficients && input.triggeringTargetCryoOrFrozen === undefined ? undefined
    : getWeaponProcCoefficient(definition, input.refinement, input.triggeringTargetCryoOrFrozen);
  const id = `weapon-proc:${definition.weaponId}:r${input.refinement}`;
  const hitId = `${id}:hit`;
  const statLabel = definition.scalingStat === "atk" ? "追击取样时攻击力" : "触发时最大生命值";
  const sourceId = `weapon-proc-source:${definition.weaponId}`;
  const document = calculatorDocumentSchema.parse({
    schemaVersion: CALCULATOR_SCHEMA_VERSION,
    ruleVersion: CALCULATOR_RULE_VERSION,
    id,
    label: `${definition.weaponName} R${input.refinement} · 独立物理追击`,
    scope: "single-hit",
    ...(usesContext ? {weaponProc: {weaponId: input.weaponId, refinement: input.refinement,
      ...(input.triggeringTargetCryoOrFrozen === undefined ? {} : {triggeringTargetCryoOrFrozen: input.triggeringTargetCryoOrFrozen})}} : {}),
    characterLevel: input.characterLevel,
    build: structuredClone(input.build),
    enemy: structuredClone(input.enemy),
    hits: [{
      id: hitId, label: `${definition.weaponName} · 本次实际追击`, kind: "ordinary",
      element: "physical", attackTag: "proc",
      terms: coefficient === undefined ? [] : [{stat: definition.scalingStat, coefficient}],
      baseDamageFormula: {
        ruleId: `weapon-proc-${definition.weaponId}-r${input.refinement}-b4ae769`,
        label: coefficient === undefined ? "缺少原触发目标的冰／冻结状态，尚未选择来源倍率" : `${statLabel} × R${input.refinement} 固定来源倍率（${coefficient * 100}%）`,
        expression: expr.mul(expr.input(definition.scalingStat), expr.input("weaponProcCoefficient")),
        inputs: coefficient === undefined ? [] : [{key: "weaponProcCoefficient", value: coefficient, allowedValues: [coefficient], unit: "ratio", meaningKey: `${definition.weaponName} R${input.refinement} 追击倍率`, origin: "source-table"}],
        requirements: {elements: ["physical"], attackTags: ["proc"]},
        sourceRefs: definition.sourceRefs
      },
      additiveBaseDamage: 0, damageBonus: input.damageBonus, critEligible: true,
      ...(definition.forcedCrit ? {hitWeakPoint: true} : {}),
      reaction: "none", reactionBonus: 0, groupMultiplier: 1,
      sourceRefs: definition.sourceRefs, dependencies: [sourceId],
      excludedModifiers: [{label: "宿主命中伤害", reason: "这是一条独立武器追击，单独结算自己的暴击、防御与物理抗性，不加入宿主的基础伤害加算。"}, {label: "普通攻击／战技／爆发专属增伤", reason: "武器追击标签为 proc，不继承宿主的攻击类型专属增伤。"}]
    }],
    selectedHitIds: [hitId],
    assumptions: usesContext ? [] : [
      "条件输入：本次武器追击已经真实触发并命中所填目标；本计算不证明触发次数、冷却可用、前台状态或自动轮转。",
      `${statLabel}和暴击等使用实际追击取样面板；最终面板可编辑，不重复加入武器白值或副属性。`,
      definition.scalingStat === "atk" ? "钺矛来源仅由持有者普通攻击回调触发；固定代码未另要求前台或非零宿主伤害。" : "此HP追击来源要求持有者前台并命中敌人；以触发时最大生命值为基数，不取当前剩余生命。",
      definition.targetMode === "circle" ? "范围追击这里只计算一个已知实际命中目标；不将单目标伤害乘未知敌人数，不认证范围或命中几何。" : "钺矛为原目标单体追击，不把范围或其他目标并入。",
      `固定来源在伤害回调取样后 +${definition.damageDelayFrames} 帧排程，名义冷却 ${getWeaponProcCooldownFrames(definition, input.refinement)} 帧；此独立计算器不执行这些时钟或卡肉。`,
      "R1–R5倍率来自固定源码与目录。结果仍为来源条件数值，未经当前游戏实测；改精炼需由对应来源定义重新生成文档。"
    ],
    dependencies: [{id: sourceId, status: "provisional", reason: "固定来源的独立追击公式；实际触发与目标命中为明确输入前提，不是自动触发认证。", sourceRefs: definition.sourceRefs}],
    dataIdentity: WEAPON_PROC_DATA_IDENTITY
  });
  return usesContext ? prepareWeaponProcCalculatorDocument(document) : document;
}

export function getWeaponProcDocumentSelection(document: CalculatorDocument): WeaponProcCalculatorContext | undefined {
  if (document.weaponProc) return {...document.weaponProc};
  const match = /^weapon-proc:([^:]+):r([1-5])$/.exec(document.id);
  if (!match) return undefined;
  const definition = weaponProcDefinitions.find(row => row.weaponId === match[1]);
  return definition ? {weaponId: definition.weaponId, refinement: Number(match[2])} : undefined;
}

/** A separate trace step exposes the once-per-proc branch before its ATK/HP multiplication. */
export function getWeaponProcCoefficientFormula(document: Pick<CalculatorDocument, "weaponProc">): CalculatorFormula | undefined {
  const context = document.weaponProc;
  if (!context) return undefined;
  const definition = getWeaponProcDefinition(context.weaponId)!;
  if (definition.cryoOrFrozenCoefficients && context.triggeringTargetCryoOrFrozen === undefined) return undefined;
  const sourceInput = (key: string, value: number, meaningKey: string): CalculatorFormula["inputs"][number] => ({key, value, allowedValues: [value], unit: "ratio", meaningKey, origin: "source-table"});
  const ordinary = getWeaponProcCoefficient(definition, context.refinement, false);
  const inputs = [sourceInput("ordinaryWeaponProcCoefficient", ordinary, `${definition.weaponName} R${context.refinement} 普通来源倍率`)];
  if (definition.cryoOrFrozenCoefficients) inputs.push(
    sourceInput("cryoWeaponProcCoefficient", getWeaponProcCoefficient(definition, context.refinement, true), `${definition.weaponName} R${context.refinement} 原目标冰／冻结时的来源倍率`),
    {key: "triggeringTargetCryoOrFrozen", value: Number(context.triggeringTargetCryoOrFrozen), allowedValues: [0, 1], unit: "boolean", meaningKey: "原触发目标在触发回调时是否附着冰或处于冻结；不是本次范围受击目标的状态", origin: "explicit-trigger-context"}
  );
  return {ruleId: `weapon-proc-${definition.weaponId}-coefficient-r${context.refinement}-b4ae769`,
    label: definition.cryoOrFrozenCoefficients ? "原触发目标冰／冻结时选择高档倍率；整次范围追击共用这次选择" : `${definition.weaponName} R${context.refinement} 固定来源倍率`,
    expression: definition.cryoOrFrozenCoefficients
      ? expr.condition("equal", expr.input("triggeringTargetCryoOrFrozen"), expr.value(1), expr.input("cryoWeaponProcCoefficient"), expr.input("ordinaryWeaponProcCoefficient"))
      : expr.input("ordinaryWeaponProcCoefficient"), inputs, sourceRefs: definition.sourceRefs};
}

/** Rebuild source-derived values after JSON/context edits; a saved AST is never the authority. */
export function prepareWeaponProcCalculatorDocument(document: CalculatorDocument): CalculatorDocument {
  const selected = getWeaponProcDocumentSelection(document);
  if (!document.weaponProc && (!selected || legacyProcIds.has(selected.weaponId))) return document;
  const result = structuredClone(document);
  const context = weaponProcCalculatorContextSchema.parse(result.weaponProc ?? selected);
  result.weaponProc = context;
  const definition = getWeaponProcDefinition(context.weaponId)!;
  const hit = result.hits[0];
  if (result.hits.length !== 1 || hit?.kind !== "ordinary") throw new Error("独立武器追击上下文需要唯一普通伤害命中。");
  const missing = definition.cryoOrFrozenCoefficients !== undefined && context.triggeringTargetCryoOrFrozen === undefined;
  const coefficient = missing ? undefined : getWeaponProcCoefficient(definition, context.refinement, context.triggeringTargetCryoOrFrozen);
  const sourceId = `weapon-proc-source:${definition.weaponId}`;
  result.label = `${definition.weaponName} R${context.refinement} · 独立物理追击`;
  hit.label = definition.weaponId === "theviridescenthunt" ? `${definition.weaponName} · 本次旋风单段命中` : `${definition.weaponName} · 本次实际追击`;
  hit.element = "physical"; hit.attackTag = "proc"; hit.critEligible = true; hit.reaction = "none";
  if (definition.forcedCrit) hit.hitWeakPoint = true;
  else delete hit.hitWeakPoint;
  delete hit.additiveReaction; delete hit.explicitReactionBase;
  hit.terms = coefficient === undefined ? [] : [{stat: definition.scalingStat, coefficient}];
  hit.baseDamageFormula = {ruleId: `weapon-proc-${definition.weaponId}-r${context.refinement}-b4ae769`,
    label: coefficient === undefined ? "缺少原触发目标的冰／冻结状态，尚未选择来源倍率" : `${definition.scalingStat.toUpperCase()} × R${context.refinement} 来源选定倍率（${coefficient * 100}%）`,
    expression: expr.mul(expr.input(definition.scalingStat), expr.input("weaponProcCoefficient")),
    inputs: coefficient === undefined ? [] : [{key: "weaponProcCoefficient", value: coefficient, allowedValues: [coefficient], unit: "ratio", meaningKey: `${definition.weaponName} R${context.refinement} 本次实际追击的来源选定倍率`, origin: definition.cryoOrFrozenCoefficients ? "source-selected-trigger-context" : "source-table"}],
    requirements: {elements: ["physical"], attackTags: ["proc"]}, sourceRefs: definition.sourceRefs};
  hit.sourceRefs = [...definition.sourceRefs];
  hit.dependencies = hit.dependencies.filter(id => !id.startsWith("weapon-proc-source:") && id !== contextDependency);
  hit.dependencies.push(sourceId, contextDependency);
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith("weapon-proc-source:") && row.id !== contextDependency);
  result.dependencies.push(
    {id: sourceId, status: "provisional", reason: "固定来源的独立物理追击公式；实际触发与目标命中是输入前提，不是自动触发认证。", sourceRefs: definition.sourceRefs},
    {id: contextDependency, status: missing ? "missing" : "provisional", reason: missing ? "缺少原触发目标在触发回调时是否附着冰或冻结；未知不能默认无冰，也不能用当前范围受击目标的状态代替。" : "倍率由武器、精炼及明确原触发目标条件重新推导；整次范围追击共用该来源选择。", sourceRefs: definition.sourceRefs}
  );
  const probability = getWeaponProcTriggerProbability(definition, context.refinement);
  const lifecycle = lifecycleAssumption(definition);
  const automaticBlocked = definition.automaticTriggerBlockedReason;
  result.assumptions = result.assumptions.filter(row => !row.startsWith(assumptionPrefix));
  result.assumptions.push(
    `${assumptionPrefix}本次追击已经实际触发并命中所填目标；不需要队伍或轮转，也不推断前台、触发次数、冷却可用或命中几何。`,
    `${assumptionPrefix}使用实际追击取样的最终面板与通用／物理增伤；该独立proc自己结算暴击、防御和物理抗性，不继承宿主的普攻／重击／战技／爆发专属增伤。`,
    `${assumptionPrefix}${definition.targetMode === "circle" ? "这里只计算范围追击的一名已知受击目标；不乘未知敌人数。" : "这里只计算原触发目标的单体追击。"}${definition.cryoOrFrozenCoefficients ? "高低倍率取原触发目标在回调时的冰／冻结状态，一次选择用于整次范围追击，不随当前受击目标或稍后状态切换。" : ""}`,
    ...(automaticBlocked !== undefined ? [
      `${assumptionPrefix}自动触发边界：${automaticBlocked}`,
      `${assumptionPrefix}${definition.weaponId === "theviridescenthunt" ? "只计算旋风的一次已发生伤害，不把完整旋风的次数乘入，也不认证聚怪、持续取样或周期。" : "只计算一次明确已经发生的命中，不认证自动触发、整条追击链或完整循环。"} 未接入的触发概率、排程与目标选择不作为本击伤害乘数。`
    ] : lifecycle === undefined ? [`${assumptionPrefix}来源概率${probability === null ? "无需随机触发抽样" : `${probability * 100}%`}、冷却${getWeaponProcCooldownFrames(definition, context.refinement)}帧及延迟${definition.damageDelayFrames}帧只用于说明前提；本入口不执行这些时钟或抽样，不把触发概率乘进已发生的一击。`] : [
      `${assumptionPrefix}${lifecycle}`,
      `${assumptionPrefix}此来源无需随机触发抽样；成功触发时取样，延迟${definition.damageDelayFrames}帧结算追击。本入口不执行窗口、冷却或排程，也不把触发概率乘进已发生的一击。`
    ]),
    ...(definition.forcedCrit ? [`${assumptionPrefix}本次信使追击已发生，其固定来源将本击标记为弱点命中以保证暴击。真实面板暴击率保留，实际期望恒等于暴击伤害；非暴击数值仅作移除该条件后的教学对照，当前条件下不会发生。`] : []),
    ...(definition.sourceNotes ?? []).map(note => `${assumptionPrefix}${note}`),
    `${assumptionPrefix}R1–R5倍率由固定来源定义重新生成；面板、精炼和原目标条件可编辑。数据为released/provisional来源条件数值，未经当前游戏实测。`
  );
  return result;
}
