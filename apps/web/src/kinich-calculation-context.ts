import { releasedRuntimeWorkspace, type RuntimeWorkspace } from "@genshin-dps-lab/game-data";
import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { KINICH_CANNON_VALUES, KINICH_LOOP_VALUES, kinichDamageMappings } from "../../../packages/game-data/src/character-mappings/kinich-damage-mappings";
import { isKinichDamageAction, prepareKinichDamageDocument, type KinichCalculatorDocument, KINICH_DAMAGE_SOURCE_REFS } from "../../../packages/sim-core/src/kinich-damage-formulas";

/** Exact full vectors, not a name match or just this selected level. */
export function kinichCatalogVectorIssues(workspace: RuntimeWorkspace): string[] {
  const ability = workspace.catalog.talentSets.find(set => set.id === "talent-set:kinich")?.abilities.find(row => row.id === "talent:kinich:combat2" && row.key === "combat2" && row.kind === "skill");
  const issues: string[] = [];
  for (const [parameter, expected] of [["param1", KINICH_LOOP_VALUES], ["param2", KINICH_CANNON_VALUES]] as const) {
    const actual = ability?.parameters[parameter];
    if (!actual || actual.length !== expected.length || expected.some((value, index) => value !== actual[index])) issues.push(`基尼奇E.${parameter}完整天赋向量与固定来源不一致，须重新核验字段语义。`);
  }
  return issues;
}

/** Can be used after classifier registration or append the missing E entries.
 * Existing indices and unrelated character documents are retained. No Q entry. */
export function extendKinichDocuments(documents: CalculatorDocument[], workspace: RuntimeWorkspace = releasedRuntimeWorkspace): CalculatorDocument[] {
  const base = documents.find(document => document.gameContext?.characterId === "character:10000101");
  if (!base || workspace.channel === "preview") return documents;
  const issues = kinichCatalogVectorIssues(workspace);
  const initialize = (original: CalculatorDocument): CalculatorDocument => {
    const doc = structuredClone(original) as KinichCalculatorDocument;
    if (!doc.gameContext.kinichDamage) doc.gameContext.kinichDamage = doc.build.mode === "imported-final" ? {} : { includedA4BaseDamage: 0, c1CritDamageIncluded: false };
    doc.dependencies = doc.dependencies.filter(dependency => dependency.id !== "kinich-source-vectors");
    doc.dependencies.push({ id: "kinich-source-vectors", status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "环绕射击/贯鳞炮两组完整15级E向量与固定源逐值一致。", sourceRefs: KINICH_DAMAGE_SOURCE_REFS });
    doc.hits.forEach(hit => { if (!hit.dependencies.includes("kinich-source-vectors")) hit.dependencies.push("kinich-source-vectors"); });
    return prepareKinichDamageDocument(doc);
  };
  const result = documents.map(document => isKinichDamageAction(document) ? initialize(document) : document);
  for (const mapping of kinichDamageMappings) {
    if (result.some(document => document.gameContext?.skillId === mapping.skillId)) continue;
    const doc = structuredClone(base) as KinichCalculatorDocument;
    const level = doc.gameContext.effectiveTalentLevel;
    doc.id = `character:10000101:${mapping.skillId}:talent-${level}`;
    doc.label = `基尼奇 · ${mapping.skillLabel} · 有效E天赋等级 ${level}`;
    doc.gameContext.abilityId = "talent:kinich:combat2";
    doc.gameContext.skillId = mapping.skillId;
    doc.gameContext.skillName = mapping.skillLabel!;
    doc.gameContext.scopeCoverage = mapping.instanceCount === 2 ? "selected-components" : "single-hit";
    doc.gameContext.attributionPolicy = "只计算已明确条件的所选E组成，不是完整E状态或整轮总伤。";
    doc.gameContext.kinichDamage = { includedA4BaseDamage: 0, c1CritDamageIncluded: false };
    const count = mapping.instanceCount ?? 1;
    doc.hits = Array.from({ length: count }, (_, index) => ({
      id: count === 1 ? mapping.id : `${mapping.id}-instance-${index + 1}`,
      label: count === 1 ? mapping.hitLabel : `${mapping.hitLabel}·第${index + 1}次命中`, kind: "ordinary" as const,
      element: "dendro" as const, attackTag: "skill" as const,
      sourceRefs: KINICH_DAMAGE_SOURCE_REFS, dependencies: ["kinich-source-vectors"],
      terms: [{ stat: "atk" as const, coefficient: mapping.sourceCoefficientValues?.[level - 1] ?? 0 }],
      additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none" as const, reactionBonus: 0, groupMultiplier: 1,
    }));
    doc.scope = count === 1 ? "single-hit" : "one-cast";
    doc.selectedHitIds = doc.hits.map(hit => hit.id);
    doc.dependencies = [];
    doc.assumptions = [...mapping.assumptions, ...mapping.exclusions, "当前教学面板不是真实配装；公开展柜导入须重新明确未知战斗条件及已含增益。"];
    doc.dataIdentity.evidenceStatus = "provisional";
    result.push(initialize(doc));
  }
  return result;
}
