import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr, type FormulaExpression } from "./calculation-trace";
import { alhaithamDamageContextSchema, type AlhaithamDamageContext } from "./alhaitham-damage-context";
import {
  ALHAITHAM_MIRROR_ATK_VALUES, ALHAITHAM_MIRROR_EM_VALUES, ALHAITHAM_PROJECTION_TIMING,
  alhaithamPrimaryMappings, alhaithamProjectionHitIds,
} from "../../game-data/src/character-mappings/alhaitham-primary-mappings";

export type AlhaithamCalculatorDocument = CalculatorDocument & {
  gameContext: NonNullable<CalculatorDocument["gameContext"]> & { alhaithamDamage?: AlhaithamDamageContext };
};
export const ALHAITHAM_DAMAGE_SOURCE_REFS = [
  "internal/characters/alhaitham/alhaitham.go", "internal/characters/alhaitham/skill.go", "internal/characters/alhaitham/attack.go",
  "internal/characters/alhaitham/asc.go", "internal/characters/alhaitham/cons.go", "internal/characters/alhaitham/zz_alhaitham.dm.go",
  "pkg/core/attack.go", "pkg/enemy/attack.go", "pkg/core/player/character/mods.go",
].map(path => `https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/${path}`);
const prefix = "alhaitham-damage:";
const nativeRuleId = "alhaitham-damage-projection-trigger-em-b4ae769";
const a4RuleId = "alhaitham-damage-a4-impact-em-b4ae769";
const c2RuleId = "alhaitham-damage-c2-snapshot-em-b4ae769";
export const ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION = 3;
export function alhaithamContext(document: CalculatorDocument): AlhaithamDamageContext | undefined {
  return (document as AlhaithamCalculatorDocument).gameContext?.alhaithamDamage;
}
export function isAlhaithamDamageAction(document: CalculatorDocument): boolean {
  return document.dataIdentity.releaseStatus !== "preview" && document.gameContext?.characterId === "character:10000078"
    && alhaithamPrimaryMappings.some(mapping => mapping.skillId === document.gameContext?.skillId);
}
export function alhaithamProjectionMirrorCount(skillId: string): number | undefined {
  const index = alhaithamPrimaryMappings.findIndex(mapping => mapping.skillId === skillId);
  return index < 0 ? undefined : index + 1;
}
export function alhaithamProjectionTiming(mirrors: number) {
  return ALHAITHAM_PROJECTION_TIMING.find(timing => timing.mirrors === mirrors);
}
export function alhaithamProjectionCoefficients(level: number): { attack: number; mastery: number } | undefined {
  if (!Number.isInteger(level) || level < 1 || level > 15) return undefined;
  return { attack: ALHAITHAM_MIRROR_ATK_VALUES[level - 1]!, mastery: ALHAITHAM_MIRROR_EM_VALUES[level - 1]! };
}
const input = (key: string, value: number, unit: string, origin: string) => ({ key, value, unit, origin, meaningKey: key });
const requirements = { maximumConstellation: ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION, elements: ["dendro" as const], attackTags: ["skill" as const] };
export function createAlhaithamC2SnapshotFormula(actualStacks: number, includedStacks: number): CalculatorFormula {
  return {
    ruleId: c2RuleId, label: "殊境：50精通 ×（本击快照实际有效层数 − 面板已含层数）",
    expression: expr.mul(expr.value(50), expr.sub(expr.input("alhaithamC2SnapshotStacks"), expr.input("alhaithamC2IncludedStacks"))),
    inputs: [{ ...input("alhaithamC2SnapshotStacks", actualStacks, "count", "explicit-unexpired-C2-at-snapshot"), minimum: 0, maximum: 4, integer: true },
      { ...input("alhaithamC2IncludedStacks", includedStacks, "count", "explicit-snapshot-panel-accounting"), minimum: 0, maximum: 4, integer: true }],
    requirements, sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS,
  };
}
function usesMastery(expression: FormulaExpression): boolean {
  switch (expression.kind) {
    case "variable": return expression.key === "em";
    case "constant": return false;
    case "lookup": return expression.indices.some(usesMastery);
    case "add": case "multiply": case "min": case "max": return expression.terms.some(usesMastery);
    case "subtract": case "divide": return usesMastery(expression.left) || usesMastery(expression.right);
    case "truncate": return usesMastery(expression.value);
    case "clamp": return usesMastery(expression.value) || usesMastery(expression.min) || usesMastery(expression.max);
    case "condition": return usesMastery(expression.left) || usesMastery(expression.right) || usesMastery(expression.whenTrue) || usesMastery(expression.whenFalse);
  }
}
/** These executable gear rules have not been given independent trigger/snapshot/
 * impact samples. Stable mastery is supported by the shared phase rebuilder. */
export function alhaithamUnstableC2EquipmentRules(document: CalculatorDocument): string[] {
  if ((document.gameContext?.constellation ?? 0) < 2 || alhaithamContext(document)?.masteryStableAcrossStages !== false || document.build.mode !== "equipment-derived") return [];
  const equipment = document.build.equipment;
  return [...new Set([...(equipment?.statModifiers ?? []), ...(equipment?.dynamicHitBonuses ?? []),
    ...(equipment?.additiveBaseBonuses ?? []), ...(equipment?.criticalBonuses ?? [])].filter(rule => {
      if ("elements" in rule && rule.elements && !rule.elements.includes("dendro")) return false;
      if ("attackTags" in rule && rule.attackTags && !rule.attackTags.includes("skill")) return false;
      if ("weaponTypes" in rule && rule.weaponTypes && (!equipment?.weaponType || !rule.weaponTypes.includes(equipment.weaponType))) return false;
      return usesMastery(rule.expression);
    }).map(rule => rule.label))];
}
export function alhaithamRequiresC2SnapshotStatsConfirmation(document: CalculatorDocument): boolean {
  const context = alhaithamContext(document);
  return document.build.mode === "imported-final" && (document.gameContext?.constellation ?? 0) >= 2
    && context?.c2SnapshotStacks !== undefined && context.c2SnapshotIncludedStacks !== undefined
    && context.c2SnapshotStacks !== context.c2SnapshotIncludedStacks;
}
export function createAlhaithamProjectionBaseFormula(level: number, stableMastery: boolean, triggerMastery: number, included: number): CalculatorFormula {
  const coefficients = alhaithamProjectionCoefficients(level);
  if (!coefficients) throw new RangeError("Alhaitham projection requires effective E talent level 1–15");
  return {
    ruleId: nativeRuleId, label: "镜投射：E精通倍率 × 触发时精通 − 附加基数已含份额",
    expression: expr.sub(expr.mul(expr.input("alhaithamMirrorEmCoefficient"), expr.input(stableMastery ? "em" : "alhaithamTriggerMastery")), expr.input("alhaithamIncludedProjectionBase")),
    inputs: [input("alhaithamMirrorEmCoefficient", coefficients.mastery, "ratio", "pinned-E-mirrorEm-vector"),
      ...(!stableMastery ? [{ ...input("alhaithamTriggerMastery", triggerMastery, "stat", "explicit-projection-trigger-sample"), minimum: 0 }] : []),
      { ...input("alhaithamIncludedProjectionBase", included, "damage", "explicit-accounting"), minimum: 0 }],
    requirements, sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS,
  };
}
export function createAlhaithamA4Formula(ascension: number, stableMastery: boolean, hitTimeMastery: number, included: number): CalculatorFormula {
  return {
    ruleId: a4RuleId, label: "谜林道破：命中时精通 × 0.1%（上限100%）− 增伤已含份额",
    expression: expr.sub(expr.mul(expr.input("alhaithamA4Unlocked"), expr.min(expr.mul(expr.value(.001), expr.input(stableMastery ? "em" : "alhaithamImpactMastery")), expr.value(1))), expr.input("alhaithamIncludedA4")),
    inputs: [input("alhaithamA4Unlocked", Number(ascension >= 4), "boolean", "source-ascension-unlock"),
      ...(!stableMastery ? [{ ...input("alhaithamImpactMastery", hitTimeMastery, "stat", "explicit-current-EM-at-impact"), minimum: 0 }] : []),
      { ...input("alhaithamIncludedA4", included, "ratio", "explicit-accounting"), minimum: 0, maximum: 1 }],
    requirements, sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS,
  };
}
function ascension(document: CalculatorDocument): number | undefined {
  return (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
}
function frozenState(document: CalculatorDocument, hit: CalculatorHit, context: AlhaithamDamageContext): string {
  const { finalizedHitStates: _, ...state } = context;
  return JSON.stringify([document.gameContext?.characterId, document.gameContext?.abilityId, document.gameContext?.skillId,
    document.characterLevel, document.gameContext?.effectiveTalentLevel, document.gameContext?.constellation, ascension(document),
    document.scope, document.selectedHitIds, hit.id, state]);
}
function zeroNativeShareProven(hit: CalculatorHit): boolean {
  return hit.kind === "ordinary" && hit.additiveBaseDamage === 0 && !hit.finalSnapshot
    && hit.finalizedEquipmentBaseInput === undefined && !hit.finalizedEquipmentEffects?.length;
}

/** Only this actual projection event. The triggering attack and mirror life
 * cycle are intentionally outside it; source stages never manufacture EM. */
export function prepareAlhaithamDamageDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isAlhaithamDamageAction(document)) return document;
  const doc = structuredClone(document) as AlhaithamCalculatorDocument, game = doc.gameContext;
  const context = alhaithamDamageContextSchema.parse(game.alhaithamDamage ?? {});
  game.alhaithamDamage = context;
  const mirrors = alhaithamProjectionMirrorCount(game.skillId)!, expectedIds = alhaithamProjectionHitIds(mirrors);
  const stage = ascension(doc), stable = context.masteryStableAcrossStages === true;
  const c2 = game.constellation >= 2, actualC2Stacks = c2 ? context.c2SnapshotStacks : 0;
  const includedC2Stacks = context.c2SnapshotIncludedStacks ?? (c2 ? undefined : 0);
  const c2Delta = actualC2Stacks === undefined || includedC2Stacks === undefined ? undefined : 50 * (actualC2Stacks - includedC2Stacks);
  const coefficients = alhaithamProjectionCoefficients(game.effectiveTalentLevel);
  const globalIssues: string[] = [];
  if (game.abilityId !== "talent:alhaitham:combat2") globalIssues.push("镜投射必须使用独立有效E天赋，不能借用普攻或Q天赋。");
  if (game.constellation > ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION) globalIssues.push("本入口仅覆盖C0–C3镜投射；C4以上的增伤、精通或双暴尚未实现。");
  if (!c2 && ((context.c2SnapshotStacks ?? 0) > 0 || (context.c2SnapshotIncludedStacks ?? 0) > 0)) globalIssues.push("当前命座未解锁C2，不能声称本击有实际或面板已含C2精通层数；请重新应用本命座实际面板。");
  if (c2 && actualC2Stacks === undefined) globalIssues.push("请填写本击延后快照时仍有效的C2层数（0–4）；持镜数不是层数，过期层数也不能计入。");
  if (c2 && includedC2Stacks === undefined) globalIssues.push("请填写本击精通面板已含的C2层数，不能把展示柜未知状态当作未含或满层。");
  if (c2 && !stable && context.masteryStableAcrossStages === false && context.c2TriggerMasteryFinal !== true) globalIssues.push("请确认触发精通是已含当时有效C2的实际最终值；此阶段不会再补加50或200精通。");
  if ((alhaithamRequiresC2SnapshotStatsConfirmation(doc) && context.c2OtherSnapshotStatsFinal !== true)
    || (c2 && document.build.mode === "manual-final" && c2Delta !== undefined && c2Delta !== 0 && context.c2OtherSnapshotStatsFinal === false)) globalIssues.push("请填写C2生效后的实际攻击力等面板，或改用配装计算，再确认其余属性已是本击快照。非战斗展示柜不能证明精通转攻击等属性，精通差额不会反推未提供的武器转换。");
  const unsupportedRules = alhaithamUnstableC2EquipmentRules(doc);
  if (unsupportedRules.length) globalIssues.push(`精通跨阶段变化，而装备规则「${unsupportedRules.join("、")}」仍使用单份精通；本批不能重建该路径。请改用手动最终面板，填写实际快照攻击/精通和各阶段最终精通，或仅在实际精通不变时选择稳定分支。`);
  if (context.mirrorCount === undefined) globalIssues.push("请明确本次投射触发时的镜数情景，不能以未知镜数推断命中数量。");
  else if (context.mirrorCount !== mirrors) globalIssues.push(`当前入口是${mirrors}镜投射，所填镜数与入口不一致；零镜不能触发投射。`);
  if (context.projectionTriggerValid !== true) globalIssues.push("请确认本次为前台普攻/重击/下落命中敌人，且投射的1.6秒冷却已结束；不由持镜或展示柜推断触发。");
  if (context.masteryStableAcrossStages === undefined) globalIssues.push("请选择触发到命中期间精通是否不变；未知不能当作当前面板全程适用。");
  if (!stable && context.masteryStableAcrossStages === false && context.triggerMastery === undefined) globalIssues.push("精通变化时请提供投射触发瞬间的精通，供固化精通基数使用。");
  if (stage === undefined) globalIssues.push("请提供突破阶段，以确定谜林道破是否解锁；不从角色等级推断。");
  if (!coefficients) globalIssues.push("缺少固定来源E倍率；有效E天赋须为1–15，且不再自动增加命座等级。");
  if (doc.hits.length !== mirrors || expectedIds.some(id => doc.hits.filter(hit => hit.id === id).length !== 1)
    || doc.hits.some(hit => !expectedIds.includes(hit.id) || hit.kind !== "ordinary")
    || doc.selectedHitIds.length === 0 || doc.selectedHitIds.some(id => !expectedIds.includes(id))) globalIssues.push("命中集合与本次投射不符；不能追加触发普攻、E突进、Q、额外投射或重复同一实例。");
  if (doc.selectedHitIds.length > 1 && (doc.scope !== "one-cast" || context.statsAndTargetStableAcrossHits !== true)) globalIssues.push("多击合计须声明这些命中的其余面板、装备和目标状态共用；变化时单选实际一击。");
  doc.dependencies = doc.dependencies.filter(dependency => !dependency.id.startsWith(prefix));
  const globalId = prefix + "conditions";
  doc.dependencies.push({ id: globalId, status: globalIssues.length ? "missing" : "provisional", reason: globalIssues.join("；") || `所选C${game.constellation}单次投射的镜数、触发与取样条件明确；不推演镜生命周期。`, sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS });
  for (const hit of doc.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix)); hit.dependencies.push(globalId);
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates?.[hit.id] ?? {}, issues = [...globalIssues];
    const ownedC2 = hit.elementalMasteryAdjustment?.formula.ruleId === c2RuleId;
    if (ownedC2) delete hit.elementalMasteryAdjustment;
    else if (c2Delta !== undefined && c2Delta !== 0 && hit.elementalMasteryAdjustment) issues.push("本击已有外来精通调整公式；保留原式并拒绝用C2覆盖同槽贡献。");
    if (hit.baseDamageFormula) issues.push("本入口必须执行固定E的ATK主项，不能用外来基伤公式替换。");
    for (const [key, ruleId] of [["additiveBaseFormula", nativeRuleId], ["damageBonusFormula", a4RuleId]] as const) {
      if (hit[key] && hit[key]!.ruleId !== ruleId) issues.push("本击已有外来同槽公式；保留该式并拒绝覆盖，不能静默丢失贡献。");
      else delete hit[key];
    }
    if (state.connected !== true) issues.push("请确认本段实际命中所选目标；未接触的段不能按命中计伤，可取消选择该段。");
    if (state.includedProjectionBase === undefined) issues.push("请确认本段附加基数中已含多少镜投射精通基数；明确未含填0。");
    if (stage !== undefined && stage >= 4) {
      if (!stable && context.masteryStableAcrossStages === false && state.hitTimeMastery === undefined) issues.push("精通变化时请提供这一段命中瞬间的精通，不能用触发值代替A4取样。");
      if (c2 && !stable && context.masteryStableAcrossStages === false && state.c2HitMasteryFinal !== true) issues.push("请确认本段命中精通已含当时有效C2的实际最终值；A4直接读取它，不再补层。");
      if (state.includedA4Bonus === undefined) issues.push("请确认本段增伤输入已含多少A4；明确未含填0，避免重复加算。");
    }
    if (hit.groupMultiplier !== 1) issues.push("每条记录已是一段真实命中；不能用组倍率复制投射次数。");
    if (coefficients) hit.terms = [{ stat: "atk", coefficient: coefficients.attack }];
    hit.element = "dendro"; hit.attackTag = "skill";
    const saved = context.finalizedHitStates?.[hit.id];
    if ((saved !== undefined && saved !== frozenState(doc, hit, context))
      || (hit.finalSnapshot && (hit.finalSnapshot.origin !== "equipment-conversion" || saved === undefined))) issues.push("镜数、精通取样或角色状态与已冻结面板不一致；请重新应用配装，不能修改旧快照的含义。");
    if (!issues.length) {
      if (c2Delta !== undefined && c2Delta !== 0) hit.elementalMasteryAdjustment = { accounting: "add-to-panel", formula: createAlhaithamC2SnapshotFormula(actualC2Stacks!, includedC2Stacks!) };
      hit.additiveBaseFormula = createAlhaithamProjectionBaseFormula(game.effectiveTalentLevel, stable, context.triggerMastery ?? 0, state.includedProjectionBase!);
      hit.damageBonusFormula = createAlhaithamA4Formula(stage!, stable, state.hitTimeMastery ?? 0, state.includedA4Bonus ?? 0);
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...ALHAITHAM_DAMAGE_SOURCE_REFS])];
    const id = prefix + hit.id; hit.dependencies.push(id);
    doc.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击ATK、触发精通基数与命中A4按各自来源时点计入，已含份额仅补差。", sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS });
  }
  const timing = alhaithamProjectionTiming(mirrors)!;
  game.scopeCoverage = doc.selectedHitIds.length === 1 ? "single-hit" : "selected-components";
  game.attributionPolicy = `C${game.constellation}·${mirrors}镜的一次投射，共${mirrors}次E标签草伤；快照相对触发+${timing.snapshotDelay}帧，命中左侧${timing.leftHitFrames.join("/")}帧或右侧${timing.rightHitFrames.join("/")}帧。C1减CD在命中后、不改变本击；C3只读取已给的有效E等级，不再+3。`;
  doc.assumptions = doc.assumptions.filter(value => !value.startsWith("艾尔海森投射："));
  doc.assumptions.push("艾尔海森投射：仅C0–C3的所选一次投射。C2每层50精通、8秒独立到期、最多4层，溢出生成也可触发；实际层数不由持镜数推断。快照精通只补实际与已含层数的差，进入装备属性相位；变化分支的触发/命中精通必须是已含各自C2的完整实际最终值。精通基数在触发时固化，A4按各段命中时精通；只有明确精通不变才共用完整重建面板。最终面板的其余属性视为所填实际快照，不反推未提供的精通转攻击等装备历史。未覆盖C4以上、镜生成/消失、后续投射、Q或整轮。");
  return doc;
}

export function resetAlhaithamPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isAlhaithamDamageAction(document)) return;
  const context = (document as AlhaithamCalculatorDocument).gameContext.alhaithamDamage ??= {};
  delete context.finalizedHitStates;
  if (mode === "imported-final") {
    delete context.projectionTriggerValid; delete context.masteryStableAcrossStages; delete context.triggerMastery; delete context.statsAndTargetStableAcrossHits;
    delete context.c2SnapshotStacks; delete context.c2SnapshotIncludedStacks; delete context.c2TriggerMasteryFinal; delete context.c2OtherSnapshotStatsFinal;
    context.hitStates = Object.fromEntries(document.hits.map(hit => [hit.id, zeroNativeShareProven(hit) ? { includedProjectionBase: 0 } : {}]));
  } else {
    context.c2SnapshotIncludedStacks = 0;
    context.hitStates ??= {};
    for (const hit of document.hits) {
      const state = context.hitStates[hit.id] ??= {}; state.includedA4Bonus = 0;
      if (zeroNativeShareProven(hit)) state.includedProjectionBase = 0;
      else delete state.includedProjectionBase;
    }
  }
}
export function finalizeAlhaithamPanelAccounting(document: CalculatorDocument): void {
  if (!isAlhaithamDamageAction(document)) return;
  const context = (document as AlhaithamCalculatorDocument).gameContext.alhaithamDamage ??= {};
  context.finalizedHitStates = Object.fromEntries(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, frozenState(document, hit, context)]));
}
