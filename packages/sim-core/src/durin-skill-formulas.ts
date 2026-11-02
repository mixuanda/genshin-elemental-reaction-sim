import { durinMappings } from "../../game-data/src/classified-hits";
import { expr } from "./calculation-trace";
import type { CalculatorDocument, CalculatorFormula, CalculatorHit } from "./calculator-model";
import { durinSkillContextSchema } from "./durin-skill-context";

const prefix = "durin-skill:";
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
export const DURIN_SKILL_SOURCE_REFS = ["skill.go", "attack.go", "asc.go", "cons.go", "burst.go", "durin.go", "zz_durin.dm.go"]
  .map(file => `${sourceRoot}internal/characters/durin/${file}`);
const mappingFor = (document: CalculatorDocument) => durinMappings.filter(mapping => mapping.skillId === document.gameContext?.skillId);
export const isDurinSkillAction = (document: CalculatorDocument): boolean =>
  document.gameContext?.characterId === "character:10000123" && mappingFor(document).length > 0;

export function createDurinC2SkillBonusFormula(active: boolean, included: boolean): CalculatorFormula {
  return {
    ruleId: "durin-c2-pyro-skill-accounting-b4ae769", label: "杜林C2：实际50%火伤 − 输入已含的同一份额",
    expression: expr.mul(expr.value(.5), expr.sub(expr.input("durinC2Active"), expr.input("durinC2Included"))),
    inputs: [
      { key: "durinC2Active", value: Number(active), unit: "boolean", origin: "explicit-hit-snapshot", meaningKey: "本击快照时杜林C2火伤增益实际生效" },
      { key: "durinC2Included", value: Number(included), unit: "boolean", origin: "explicit-accounting", meaningKey: "本击增伤输入已包含C2的50%火伤份额" },
    ], requirements: { minimumConstellation: 2, maximumConstellation: 2, elements: ["pyro"], attackTags: ["skill"] },
    sourceRefs: DURIN_SKILL_SOURCE_REFS,
  };
}

/** Chosen White/Black E contacts only; not the stance input, burst, or a team rotation. */
export function prepareDurinSkillDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isDurinSkillAction(document)) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = durinSkillContextSchema.parse(game.durinSkill ?? {});
  game.durinSkill = context;
  const mappings = mappingFor(result), selected = new Set(result.selectedHitIds);
  const selectedAll = result.hits.every(hit => selected.has(hit.id));
  const oldHits = new Map(result.hits.map(hit => [hit.id, hit]));
  const originalBlockers = result.hits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith(prefix));
  if (result.hits.some(hit => selected.has(hit.id) && !mappings.some(mapping => mapping.id === hit.id))) {
    const id = `${prefix}unknown-hit`;
    result.dependencies.push({ id, status: "missing", reason: "所选命中不属于此杜林E分支的固定来源，不能替换成另一击代算。", sourceRefs: DURIN_SKILL_SOURCE_REFS });
    for (const hit of result.hits) hit.dependencies = [...hit.dependencies.filter(dependency => !dependency.startsWith(prefix)), id];
    game.scopeCoverage = "selected-components";
    return result;
  }
  result.hits = mappings.map(mapping => {
    const previous = oldHits.get(mapping.id);
    const hit: Extract<CalculatorHit, { kind: "ordinary" }> = {
      ...(previous?.kind === "ordinary" ? previous : {}), id: mapping.id, label: mapping.hitLabel,
      kind: "ordinary", element: "pyro", attackTag: "skill",
      terms: [{ stat: "atk", coefficient: mapping.sourceCoefficientValues![game.effectiveTalentLevel - 1] ?? 0 }],
      additiveBaseDamage: previous?.kind === "ordinary" ? previous.additiveBaseDamage : 0,
      damageBonus: previous?.kind === "ordinary" ? previous.damageBonus : 0,
      critEligible: true, reaction: previous?.kind === "ordinary" ? previous.reaction : "none",
      reactionBonus: previous?.kind === "ordinary" ? previous.reactionBonus : 0,
      groupMultiplier: previous?.kind === "ordinary" ? previous.groupMultiplier : 1,
      sourceRefs: DURIN_SKILL_SOURCE_REFS,
      dependencies: previous?.dependencies.filter(id => !id.startsWith(prefix)) ?? [],
    };
    delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
    delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
    delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment; delete hit.occurrence;
    return hit;
  });
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id]
    : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const selectedCount = result.selectedHitIds.length, castIssues = [...originalBlockers];
  if (game.constellation > 2) castIssues.push("当前杜林E仅审阅C0–C2；未将更高命座按C2代算。");
  if (game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) castIssues.push("有效E天赋必须为固定来源的1–15级，不自动再次增加命座等级。");
  if (selectedCount > 1 && context.statsStableAcrossHits !== true) castIssues.push("黑E多段合计需要明确各击其他面板、装备及目标条件稳定；C2火伤状态仍逐击填写。");
  const dependency = (id: string, issues: string[], hits: CalculatorHit[]): void => {
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本次杜林E系数与逐击C2增伤记账明确。", sourceRefs: DURIN_SKILL_SOURCE_REFS });
    hits.forEach(hit => hit.dependencies.push(id));
  };
  dependency(`${prefix}conditions`, castIssues, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates?.[hit.id], issues: string[] = [];
    if (game.constellation === 2) {
      if (state?.c2PyroBonusActive === undefined) issues.push("请填写本击快照时C2的50%火伤是否实际有效；选择反应不证明此前已触发该增益。");
      if (state?.c2PyroBonusIncluded === undefined) issues.push("请填写本击增伤输入是否已包含C2的50%火伤，不能默认未含或重复加入。");
      if (state?.c2PyroBonusActive !== undefined && state.c2PyroBonusIncluded !== undefined) {
        hit.damageBonusFormula = createDurinC2SkillBonusFormula(state.c2PyroBonusActive, state.c2PyroBonusIncluded);
      }
      if (hit.reaction !== "none") issues.push("此C2 E分支只覆盖无蒸发/融化的自身直伤；黑Q的A1反应增益尚需独立状态，不能自动省略。");
    } else if (state?.c2PyroBonusActive === true || state?.c2PyroBonusIncluded === true) {
      issues.push("C0/C1未解锁C2，不能声明自身C2火伤已生效或已含。");
    }
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const usedDependencies = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(dependency => usedDependencies.has(dependency.id) && dependency.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit"
    : selectedCount === result.hits.length && ready ? "complete-cast" : "selected-components";
  game.attributionPolicy = "仅选定白E一击或黑E三击的自身伤害；C0–C2，C2按实际快照与已含份额补差值。不生成首次无伤E、Q后台、队友增益或反应实体，不能当作整队DPS。";
  return result;
}

/** A new offensive input does not certify whether the old input contained C2. */
export function resetDurinSkillPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isDurinSkillAction(document)) return;
  const context = document.gameContext!.durinSkill ??= {};
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") state.c2PyroBonusIncluded = false;
    else delete state.c2PyroBonusIncluded;
  }
}
