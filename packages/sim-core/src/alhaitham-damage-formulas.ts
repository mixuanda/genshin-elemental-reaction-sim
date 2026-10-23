import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { expr } from "./calculation-trace";
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
const requirements = { maximumConstellation: 0, elements: ["dendro" as const], attackTags: ["skill" as const] };
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
  const coefficients = alhaithamProjectionCoefficients(game.effectiveTalentLevel);
  const globalIssues: string[] = [];
  if (game.abilityId !== "talent:alhaitham:combat2") globalIssues.push("镜投射必须使用独立有效E天赋，不能借用普攻或Q天赋。");
  if (game.constellation !== 0) globalIssues.push("本入口仅覆盖C0镜投射；更高命座的冷却、精通、增伤或双暴尚未实现。");
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
  doc.dependencies.push({ id: globalId, status: globalIssues.length ? "missing" : "provisional", reason: globalIssues.join("；") || "所选C0单次投射的镜数、触发与取样条件明确；不推演镜生命周期。", sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS });
  for (const hit of doc.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix)); hit.dependencies.push(globalId);
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates?.[hit.id] ?? {}, issues = [...globalIssues];
    if (hit.baseDamageFormula) issues.push("本入口必须执行固定E的ATK主项，不能用外来基伤公式替换。");
    for (const [key, ruleId] of [["additiveBaseFormula", nativeRuleId], ["damageBonusFormula", a4RuleId]] as const) {
      if (hit[key] && hit[key]!.ruleId !== ruleId) issues.push("本击已有外来同槽公式；保留该式并拒绝覆盖，不能静默丢失贡献。");
      else delete hit[key];
    }
    if (state.connected !== true) issues.push("请确认本段实际命中所选目标；未接触的段不能按命中计伤，可取消选择该段。");
    if (state.includedProjectionBase === undefined) issues.push("请确认本段附加基数中已含多少镜投射精通基数；明确未含填0。");
    if (stage !== undefined && stage >= 4) {
      if (!stable && context.masteryStableAcrossStages === false && state.hitTimeMastery === undefined) issues.push("精通变化时请提供这一段命中瞬间的精通，不能用触发值代替A4取样。");
      if (state.includedA4Bonus === undefined) issues.push("请确认本段增伤输入已含多少A4；明确未含填0，避免重复加算。");
    }
    if (hit.groupMultiplier !== 1) issues.push("每条记录已是一段真实命中；不能用组倍率复制投射次数。");
    if (coefficients) hit.terms = [{ stat: "atk", coefficient: coefficients.attack }];
    hit.element = "dendro"; hit.attackTag = "skill";
    const saved = context.finalizedHitStates?.[hit.id];
    if ((saved !== undefined && saved !== frozenState(doc, hit, context))
      || (hit.finalSnapshot && (hit.finalSnapshot.origin !== "equipment-conversion" || saved === undefined))) issues.push("镜数、精通取样或角色状态与已冻结面板不一致；请重新应用配装，不能修改旧快照的含义。");
    if (!issues.length) {
      hit.additiveBaseFormula = createAlhaithamProjectionBaseFormula(game.effectiveTalentLevel, stable, context.triggerMastery ?? 0, state.includedProjectionBase!);
      hit.damageBonusFormula = createAlhaithamA4Formula(stage!, stable, state.hitTimeMastery ?? 0, state.includedA4Bonus ?? 0);
    }
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...ALHAITHAM_DAMAGE_SOURCE_REFS])];
    const id = prefix + hit.id; hit.dependencies.push(id);
    doc.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击ATK、触发精通基数与命中A4按各自来源时点计入，已含份额仅补差。", sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS });
  }
  const timing = alhaithamProjectionTiming(mirrors)!;
  game.scopeCoverage = doc.selectedHitIds.length === 1 ? "single-hit" : "selected-components";
  game.attributionPolicy = `C0·${mirrors}镜的一次投射，共${mirrors}次E标签草伤；快照相对触发+${timing.snapshotDelay}帧，命中左侧${timing.leftHitFrames.join("/")}帧或右侧${timing.rightHitFrames.join("/")}帧。触发攻击不包含在本动作中。`;
  doc.assumptions = doc.assumptions.filter(value => !value.startsWith("艾尔海森投射："));
  doc.assumptions.push("艾尔海森投射：所选入口声明触发时镜数情景，实际触发资格与每段接触另行确认。精通基数在触发时固化，A4按各段命中时精通；只有明确精通不变才共用实际面板。未覆盖镜生成/消失、后续投射、Q、命座或整轮。");
  return doc;
}

export function resetAlhaithamPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isAlhaithamDamageAction(document)) return;
  const context = (document as AlhaithamCalculatorDocument).gameContext.alhaithamDamage ??= {};
  delete context.finalizedHitStates;
  if (mode === "imported-final") {
    delete context.projectionTriggerValid; delete context.masteryStableAcrossStages; delete context.triggerMastery; delete context.statsAndTargetStableAcrossHits;
    context.hitStates = Object.fromEntries(document.hits.map(hit => [hit.id, zeroNativeShareProven(hit) ? { includedProjectionBase: 0 } : {}]));
  } else {
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
