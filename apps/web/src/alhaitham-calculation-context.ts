import { releasedRuntimeWorkspace, type RuntimeWorkspace } from "@genshin-dps-lab/game-data";
import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import {
  ALHAITHAM_MIRROR_ATK_VALUES, ALHAITHAM_MIRROR_EM_VALUES, alhaithamPrimaryMappings,
  alhaithamProjectionHitIds,
} from "../../../packages/game-data/src/character-mappings/alhaitham-primary-mappings";
import {
  ALHAITHAM_DAMAGE_SOURCE_REFS, alhaithamProjectionMirrorCount, isAlhaithamDamageAction,
  prepareAlhaithamDamageDocument, type AlhaithamCalculatorDocument,
} from "../../../packages/sim-core/src/alhaitham-damage-formulas";

/** Each count-specific ATK/EM vector is checked in full, not just this level. */
export function alhaithamCatalogVectorIssues(workspace: RuntimeWorkspace): string[] {
  const ability = workspace.catalog.talentSets.find(set => set.id === "talent-set:alhaitham")?.abilities.find(row => row.id === "talent:alhaitham:combat2" && row.key === "combat2" && row.kind === "skill");
  const issues: string[] = [];
  for (const mirrors of [1, 2, 3]) for (const [parameter, expected] of [[`param${mirrors * 2 + 2}`, ALHAITHAM_MIRROR_ATK_VALUES], [`param${mirrors * 2 + 3}`, ALHAITHAM_MIRROR_EM_VALUES]] as const) {
    const values = ability?.parameters[parameter];
    if (!values || values.length !== expected.length || expected.some((value, index) => value !== values[index])) issues.push(`艾尔海森E.${parameter}完整15级投射向量与固定源不一致，须重新核验字段语义。`);
  }
  return issues;
}

/** Works both with and without classifier registration; never duplicates its
 * entries. Selecting a named scenario supplies its mirror count, not a trigger. */
export function extendAlhaithamDocuments(documents: CalculatorDocument[], workspace: RuntimeWorkspace = releasedRuntimeWorkspace): CalculatorDocument[] {
  const base = documents.find(document => document.gameContext?.characterId === "character:10000078");
  if (!base || workspace.channel === "preview") return documents;
  const issues = alhaithamCatalogVectorIssues(workspace);
  const initialize = (original: CalculatorDocument): CalculatorDocument => {
    const doc = structuredClone(original) as AlhaithamCalculatorDocument;
    if (!doc.gameContext.alhaithamDamage) {
      doc.gameContext.alhaithamDamage = { mirrorCount: alhaithamProjectionMirrorCount(doc.gameContext.skillId)!, hitStates: Object.fromEntries(doc.hits.map(hit => [hit.id,
        doc.build.mode === "imported-final" ? {} : { includedProjectionBase: 0, includedA4Bonus: 0 }])) };
    }
    doc.dependencies = doc.dependencies.filter(dependency => dependency.id !== "alhaitham-primary-vectors");
    doc.dependencies.push({ id: "alhaitham-primary-vectors", status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "1/2/3镜的六组15级E投射ATK/EM向量与固定源完整一致。", sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS });
    doc.hits.forEach(hit => { if (!hit.dependencies.includes("alhaitham-primary-vectors")) hit.dependencies.push("alhaitham-primary-vectors"); });
    return prepareAlhaithamDamageDocument(doc);
  };
  const result = documents.map(document => isAlhaithamDamageAction(document) ? initialize(document) : document);
  for (const mapping of alhaithamPrimaryMappings) {
    if (result.some(document => document.gameContext?.skillId === mapping.skillId)) continue;
    const doc = structuredClone(base) as AlhaithamCalculatorDocument;
    const level = doc.gameContext.effectiveTalentLevel, mirrors = alhaithamProjectionMirrorCount(mapping.skillId)!;
    doc.id = `character:10000078:${mapping.skillId}:talent-${level}`;
    doc.label = `艾尔海森 · ${mapping.skillLabel} · 有效E天赋等级 ${level}`;
    doc.gameContext.abilityId = "talent:alhaitham:combat2";
    doc.gameContext.skillId = mapping.skillId; doc.gameContext.skillName = mapping.skillLabel!;
    doc.gameContext.scopeCoverage = mirrors === 1 ? "single-hit" : "selected-components";
    doc.gameContext.attributionPolicy = "仅所选一次镜投射，不含触发它的普通攻击、重击或下落。";
    const ids = alhaithamProjectionHitIds(mirrors);
    doc.hits = ids.map((id, index) => ({
      id, label: `${mirrors}镜投射·第${index + 1}次命中`, kind: "ordinary" as const, element: "dendro" as const, attackTag: "skill" as const,
      sourceRefs: ALHAITHAM_DAMAGE_SOURCE_REFS, dependencies: ["alhaitham-primary-vectors"], terms: [{ stat: "atk" as const, coefficient: ALHAITHAM_MIRROR_ATK_VALUES[level - 1] ?? 0 }],
      additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none" as const, reactionBonus: 0, groupMultiplier: 1,
    }));
    doc.gameContext.alhaithamDamage = { mirrorCount: mirrors, hitStates: Object.fromEntries(ids.map(id => [id, { includedProjectionBase: 0, includedA4Bonus: 0 }])) };
    doc.scope = mirrors === 1 ? "single-hit" : "one-cast"; doc.selectedHitIds = ids;
    doc.dependencies = []; doc.assumptions = [...mapping.assumptions, ...mapping.exclusions, "默认面板是可编辑教学输入，不是真实配装；实际触发、接触与阶段精通不从展示柜推断。"];
    doc.dataIdentity.evidenceStatus = "provisional";
    result.push(initialize(doc));
  }
  return result;
}
