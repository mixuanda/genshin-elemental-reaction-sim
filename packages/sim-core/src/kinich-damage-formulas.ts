import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
import { kinichDamageContextSchema, type KinichDamageContext } from "./kinich-damage-context";
import { KINICH_CANNON_VALUES, KINICH_LOOP_VALUES, kinichDamageMappings } from "../../game-data/src/character-mappings/kinich-damage-mappings";

export type KinichCalculatorDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument["gameContext"]> & { kinichDamage?: KinichDamageContext };
};
export const KINICH_DAMAGE_SOURCE_REFS = ["kinich.go", "skill.go", "attack.go", "asc.go", "cons.go", "zz_kinich.dm.go"].map(file =>
  `https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kinich/${file}`);
const prefix = "kinich-damage:";
export function kinichContext(document: CalculatorDocument): KinichDamageContext | undefined {
  return (document as KinichCalculatorDocument).gameContext?.kinichDamage;
}
export function isKinichDamageAction(document: CalculatorDocument): boolean {
  return document.dataIdentity.releaseStatus !== "preview" && document.gameContext?.characterId === "character:10000101"
    && kinichDamageMappings.some(mapping => mapping.skillId === document.gameContext?.skillId);
}
export function kinichHitCoefficient(skillId: string, effectiveTalentLevel: number): number | undefined {
  if (!Number.isInteger(effectiveTalentLevel) || effectiveTalentLevel < 1 || effectiveTalentLevel > 15) return undefined;
  return (skillId === "kinich-scalespiker-cannon" ? KINICH_CANNON_VALUES
    : skillId === "kinich-loop-shot-single" || skillId === "kinich-loop-shot-pair" ? KINICH_LOOP_VALUES : [])[effectiveTalentLevel - 1];
}
const input = (key: string, value: number, unit: string, origin: string) => ({ key, value, unit, origin, meaningKey: key });
export function createKinichA4BaseFormula(stacks: number, creationAttack: number, included: number): CalculatorFormula {
  return {
    ruleId: "kinich-damage-a4-flat-accounting-b4ae769", label: "焰灵的契约：3.2 × 实耗心得层数 × 炮动作创建时攻击力 − 已含附加基数",
    expression: expr.sub(expr.mul(expr.value(3.2), expr.input("kinichA4Stacks"), expr.input("kinichA4CreationAttack")), expr.input("kinichIncludedA4Base")),
    inputs: [
      { ...input("kinichA4Stacks", stacks, "count", "explicit-cannon-creation-state"), minimum: 0, maximum: 2, integer: true },
      { ...input("kinichA4CreationAttack", creationAttack, "stat", "explicit-creation-TotalAtk"), minimum: 0 },
      { ...input("kinichIncludedA4Base", included, "damage", "explicit-accounting"), minimum: 0 },
    ], requirements: { maximumConstellation: 1, elements: ["dendro"], attackTags: ["skill"] }, sourceRefs: KINICH_DAMAGE_SOURCE_REFS,
  };
}
export function createKinichC1CritFormula(active: boolean, included: boolean): CalculatorFormula {
  return {
    ruleId: "kinich-damage-c1-cd-accounting-b4ae769", label: "贯鳞炮C1：100%专属暴伤 − 输入已含份额",
    expression: expr.sub(expr.input("kinichC1CannonActive"), expr.input("kinichC1CritIncluded")),
    inputs: [input("kinichC1CannonActive", Number(active), "ratio", "source-cannon-tag-and-constellation"), input("kinichC1CritIncluded", Number(included), "ratio", "explicit-accounting")],
    requirements: { maximumConstellation: 1, elements: ["dendro"], attackTags: ["skill"] }, sourceRefs: KINICH_DAMAGE_SOURCE_REFS,
  };
}
function effectiveAscension(document: CalculatorDocument): number | undefined {
  return (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
}
function frozenState(document: CalculatorDocument, hit: CalculatorHit, context: KinichDamageContext): string {
  const { finalizedHitStates: _, ...state } = context;
  return JSON.stringify([document.gameContext?.characterId, document.gameContext?.abilityId, document.gameContext?.skillId,
    document.gameContext?.effectiveTalentLevel, document.gameContext?.constellation, document.characterLevel, effectiveAscension(document),
    document.scope, document.selectedHitIds, hit.id, state]);
}

/** Rebuild owned formulas and coefficient every time; never modify the caller. */
export function prepareKinichDamageDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isKinichDamageAction(document)) return document;
  const doc = structuredClone(document) as KinichCalculatorDocument, game = doc.gameContext;
  const context = kinichDamageContextSchema.parse(game.kinichDamage ?? {});
  game.kinichDamage = context;
  const cannon = game.skillId === "kinich-scalespiker-cannon", pair = game.skillId === "kinich-loop-shot-pair";
  const expectedIds = pair ? ["kinich-loop-shot-pair-hit-instance-1", "kinich-loop-shot-pair-hit-instance-2"]
    : [cannon ? "kinich-scalespiker-cannon-hit" : "kinich-loop-shot-hit"];
  const ascension = effectiveAscension(doc);
  doc.dependencies = doc.dependencies.filter(dependency => !dependency.id.startsWith(prefix));
  const globalIssues: string[] = [];
  if (game.abilityId !== "talent:kinich:combat2") globalIssues.push("此攻击必须使用独立E天赋，不能借用普通攻击或Q等级。");
  if (game.constellation > 1) globalIssues.push("此入口只覆盖C0/C1；C2后的首炮增伤、减抗及更高命座尚未实现。");
  if (doc.hits.length !== expectedIds.length || doc.hits.some(hit => !expectedIds.includes(hit.id) || hit.kind !== "ordinary")
    || expectedIds.some(id => doc.hits.filter(hit => hit.id === id).length !== 1)
    || doc.selectedHitIds.length === 0 || doc.selectedHitIds.some(id => !expectedIds.includes(id))) globalIssues.push("命中集合不属于此来源动作；不得追加普通攻击、Q、额外炮或合并整轮。");
  if (context.nightsoulBlessingActive !== true) globalIssues.push("请确认本击实际处于夜魂加持状态；未开启时不会产生此E状态攻击。");
  if (cannon && context.cannonPointsBeforeUse !== 20) globalIssues.push("释放贯鳞炮前必须实际有20点夜魂值；未知或不足20点不能按可释放计算。");
  if (cannon && ascension === undefined) globalIssues.push("请提供突破阶段，以确认焰灵的契约是否解锁。");
  if (cannon && (ascension === undefined || ascension >= 4) && context.a4Stacks === undefined) globalIssues.push("请填写本炮实际消耗的有效猎人心得层数（0–2）；不推断夜魂迸发或默认满层。");
  if (cannon && ascension !== undefined && ascension < 4 && (context.a4Stacks ?? 0) > 0) globalIssues.push("突破4之前尚未解锁猎人心得，不能消费A4层数。");
  const stacks = cannon && ascension !== undefined && ascension >= 4 ? context.a4Stacks ?? 0 : 0;
  if (stacks > 0 && context.a4CreationAttack === undefined) globalIssues.push("有心得层数时须提供炮动作创建瞬间的实际攻击力；不能借用稍后释放/命中面板补造旧取样。");
  if (cannon && context.includedA4BaseDamage === undefined) globalIssues.push("请确认附加基数已含多少A4贡献；明确未含请填0。");
  if ((cannon && game.constellation === 1 || context.c1CritDamageIncluded === true) && context.c1CritDamageIncluded === undefined) globalIssues.push("请确认输入暴伤是否已包含C1炮专属100%暴伤。");
  if (pair && doc.selectedHitIds.length > 1) {
    if (doc.scope !== "one-cast") globalIssues.push("双击合计须选择本次输入的单次施放范围。");
    if (context.bothLoopHitsConnected !== true) globalIssues.push("双击合计需要实际两次命中均接触同一目标。");
    if (context.statsStableAcrossHits !== true) globalIssues.push("双击合计需要两个独立取样时刻的面板、装备及目标状态相同；变化时请单选一击。");
  }
  // Attach a global dependency even to a forged non-ordinary hit or empty set.
  const globalId = prefix + "conditions";
  doc.dependencies.push({ id: globalId, status: globalIssues.length ? "missing" : "provisional", reason: globalIssues.join("；") || "明确C0/C1 E状态和所选命中；夜魂、心得及燃烧不由面板推断。", sourceRefs: KINICH_DAMAGE_SOURCE_REFS });
  for (const hit of doc.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    hit.dependencies.push(globalId);
    if (hit.kind !== "ordinary") continue;
    const issues = [...globalIssues];
    if (hit.baseDamageFormula) issues.push("本入口必须执行固定E攻击力倍率；不能用其他基伤公式替换来源主项。");
    for (const key of ["additiveBaseFormula", "critDamageFormula"] as const) {
      if (hit[key] && !hit[key]!.ruleId.startsWith("kinich-damage-")) issues.push("本击已有其他来源的同槽公式，不能覆盖后声称完整计算。");
      else delete hit[key];
    }
    hit.element = "dendro"; hit.attackTag = "skill";
    const coefficient = kinichHitCoefficient(game.skillId, game.effectiveTalentLevel);
    if (coefficient === undefined) issues.push("缺少固定来源E倍率；有效天赋必须为1–15，且不自动加命座等级。");
    else hit.terms = [{ stat: "atk", coefficient }];
    if (hit.groupMultiplier !== 1) issues.push("此入口每条命中就是一击；不能用组倍率复制环绕或炮的次数。");
    const saved = context.finalizedHitStates?.[hit.id];
    if ((saved !== undefined && saved !== frozenState(doc, hit, context))
      || ((hit.finalSnapshot || hit.effectiveCritDamage !== undefined) && (saved === undefined || hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion"))) {
      issues.push("本击状态与已冻结面板不一致；请重新应用配装，不能用新条件改写历史快照。");
    }
    if (!issues.length) {
      if (cannon) hit.additiveBaseFormula = createKinichA4BaseFormula(stacks, stacks ? context.a4CreationAttack! : 0, context.includedA4BaseDamage!);
      if (cannon || context.c1CritDamageIncluded === true) hit.critDamageFormula = createKinichC1CritFormula(cannon && game.constellation === 1, context.c1CritDamageIncluded === true);
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...KINICH_DAMAGE_SOURCE_REFS])];
    const id = prefix + hit.id; hit.dependencies.push(id);
    doc.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本次实际E命中；C1与A4只补减输入未计入的份额。", sourceRefs: KINICH_DAMAGE_SOURCE_REFS });
  }
  game.scopeCoverage = pair && doc.selectedHitIds.length > 1 ? "selected-components" : "single-hit";
  game.attributionPolicy = cannon
    ? "单次E贯鳞炮：20点夜魂为释放前条件；C1只加炮100%暴伤；A4在动作创建时消耗有效心得并按当时TotalAtk附加基数。"
    : "E环绕射击每次输入两击；单击和同次双击分别列出，伤害使用E天赋和技能标签，不享受C1炮暴伤或A4炮附加。";
  doc.assumptions = doc.assumptions.filter(value => !value.startsWith("基尼奇E：") && !value.startsWith("C0 条件；"));
  doc.assumptions.push("基尼奇E：仅C0/C1和明确所选命中；A1燃烧/烈绽放仅影响产点，不据此直接增加本炮伤害。未覆盖Q、C2+、整轮与夜魂/心得过期时序。固定源A4未检查标签过期，输入必须是实际仍有效层数。");
  return doc;
}

export function resetKinichPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isKinichDamageAction(document)) return;
  const context = (document as KinichCalculatorDocument).gameContext.kinichDamage ??= {};
  delete context.finalizedHitStates;
  if (mode === "fresh-equipment") { context.includedA4BaseDamage = 0; context.c1CritDamageIncluded = false; }
  else {
    for (const key of ["includedA4BaseDamage", "c1CritDamageIncluded", "nightsoulBlessingActive", "cannonPointsBeforeUse", "a4Stacks", "a4CreationAttack", "bothLoopHitsConnected", "statsStableAcrossHits"] as const) delete context[key];
    // ATK cannot contain A4 FlatDmg. A new, explicit zero additive input proves
    // that it contains zero A4; custom or historical nonzero input stays unknown.
    if (document.hits.length > 0 && document.hits.every(hit => hit.kind === "ordinary" && hit.additiveBaseDamage === 0 && !hit.finalSnapshot && hit.finalizedEquipmentBaseInput === undefined && !hit.finalizedEquipmentEffects?.length)) context.includedA4BaseDamage = 0;
  }
}
export function finalizeKinichPanelAccounting(document: CalculatorDocument): void {
  if (!isKinichDamageAction(document)) return;
  const context = (document as KinichCalculatorDocument).gameContext.kinichDamage ??= {};
  context.finalizedHitStates = Object.fromEntries(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, frozenState(document, hit, context)]));
}
