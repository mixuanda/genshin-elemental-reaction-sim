import { gameDataCatalog } from "./catalog";
import { artifactSetCatalog } from "./supplemental";
import { equipmentCatalog, equipmentDatasetSource, equipmentStatCurve, type EquipmentDataset } from "./equipment-dataset";
export { equipmentCatalog, equipmentArtifactSets, equipmentDatasetSource, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDataSource, equipmentStatSource } from "./equipment-source";
import type { CharacterCatalogEntry, WeaponCatalogEntry } from "@genshin-dps-lab/schemas";
import { resolveArtifactBuild, type ArtifactPieceInput } from "./artifact-build";
import { resolveWeaponEffects, resolveArtifactSetEffects, artifactTwoPieceRules, SUPPORTED_STATIC_WEAPON_IDS, SUPPORTED_STATIC_ARTIFACT_FOUR_PIECE_SLUGS, type EquipmentHitBonus } from "./equipment-effects";
import { hasWeaponFormulaRule, hasArtifactFormulaRule, resolveWeaponFormulaEffects, resolveArtifactFormulaEffects, SUPPORTED_WEAPON_FORMULA_IDS, SUPPORTED_ARTIFACT_FORMULA_IDS, type EquipmentStatModifier, type EquipmentDynamicHitBonus } from "./equipment-formulas";
import { hasArtifactConditionalRule, resolveArtifactConditionalEffects, SUPPORTED_ARTIFACT_CONDITIONAL_IDS, type ArtifactConditionalContext } from "./artifact-conditional-effects";
import { hasArtifactReactionRule, resolveArtifactReactionEffects, SUPPORTED_ARTIFACT_REACTION_IDS, type EquipmentReactionBonus, type EquipmentResistanceReduction, type EquipmentPendingResistanceEffect } from "./artifact-reaction-effects";
import { hasWeaponConditionalRule, resolveWeaponConditionalEffects, SUPPORTED_WEAPON_CONDITIONAL_IDS } from "./weapon-conditional-effects";
import { hasArtifactAdditionalRule, resolveArtifactAdditionalEffects, SUPPORTED_ARTIFACT_ADDITIONAL_IDS, SUPPORTED_ARTIFACT_ADDITIONAL_REACTION_IDS } from "./artifact-additional-effects";
import { hasWeaponAdditionalRule, resolveWeaponAdditionalEffects, SUPPORTED_WEAPON_ADDITIONAL_IDS, weaponAdditionalExcludedRules } from "./weapon-additional-effects";
import { hasWeaponPolearmRule, resolveWeaponPolearmEffects, SUPPORTED_WEAPON_POLEARM_IDS } from "./weapon-polearm-effects";
import { hasWeaponRangedRule, resolveWeaponRangedEffects, SUPPORTED_WEAPON_RANGED_IDS, weaponRangedExcludedRules } from "./weapon-ranged-effects";
import { hasWeaponExtendedRule, resolveWeaponExtendedEffects, SUPPORTED_WEAPON_EXTENDED_IDS, weaponExtendedExcludedRules } from "./weapon-extended-effects";
import { hasWeaponPolearmHitRule, resolveWeaponPolearmHitEffects, SUPPORTED_WEAPON_POLEARM_HIT_IDS } from "./weapon-polearm-hit-effects";
import { hasWeaponMeleeHitRule, resolveWeaponMeleeHitEffects, SUPPORTED_WEAPON_MELEE_HIT_IDS } from "./weapon-melee-hit-effects";
import { hasWeaponRangedHitRule, resolveWeaponRangedHitEffects, SUPPORTED_WEAPON_RANGED_HIT_IDS } from "./weapon-ranged-hit-effects";
import { hasWeaponConditionedExpansionRule, resolveWeaponConditionedExpansionEffects, SUPPORTED_WEAPON_CONDITIONED_EXPANSION_IDS } from "./weapon-conditioned-expansion";
import type { EquipmentAdditiveBaseBonus, EquipmentCriticalBonus, EquipmentPendingHitEffect } from "./weapon-hit-effect-types";
import { hasArtifactRemainingRule, resolveArtifactRemainingEffects, SUPPORTED_ARTIFACT_REMAINING_IDS } from "./artifact-remaining-effects";
import type { EquipmentPendingReactionEffect } from "./artifact-reaction-effects";

export interface EquipmentBuildInput {
  characterId: string;
  weaponId: string;
  level: number;
  ascension: number;
  weaponLevel: number;
  weaponAscension: number;
  refinement: number;
  /** An explicit conditioned build; no passive is inferred from prose. */
  effectsDisabled: boolean;
  artifacts?: ArtifactPieceInput[] | undefined;
  weaponEffectsEnabled?: boolean | undefined;
  setEffectsEnabled?: boolean | undefined;
  effectContext?: ArtifactConditionalContext | undefined;
}

export interface EquipmentDerivedStat {
  id: "characterBaseAtk" | "baseHp" | "baseDef" | "weaponBaseAtk" | "weaponSecondary";
  label: string;
  base: number;
  curve: number;
  promotion: number;
  sourceRef: string;
}

export interface EquipmentStatContribution {
  property: string;
  value: number;
  sourceRef: string;
}

export interface EquipmentBuildMetadata extends Omit<EquipmentBuildInput, "effectsDisabled"> {
  bonusAccounting: "core-sourced-v1";
  weaponType?: CharacterCatalogEntry["weaponType"];
  hitBonuses?: EquipmentHitBonus[];
  statModifiers?: EquipmentStatModifier[];
  dynamicHitBonuses?: EquipmentDynamicHitBonus[];
  additiveBaseBonuses?: EquipmentAdditiveBaseBonus[];
  criticalBonuses?: EquipmentCriticalBonus[];
  pendingHitEffects?: EquipmentPendingHitEffect[];
  pendingReactionEffects?: EquipmentPendingReactionEffect[];
  reactionBonuses?: EquipmentReactionBonus[];
  resistanceReductions?: EquipmentResistanceReduction[];
  pendingResistanceEffects?: EquipmentPendingResistanceEffect[];
  sourceVersion: string;
  sourceRefs: string[];
  derivedStats: EquipmentDerivedStat[];
  secondaryContributions: EquipmentStatContribution[];
  assumptions: string[];
  effectBlockers: string[];
}

export interface EquipmentBuildResolution {
  characterLevel: number;
  characterName: string;
  weaponName: string;
  build: {
    mode: "equipment-derived";
    characterBaseAtk: number; weaponBaseAtk: number;
    atkPercent: number; flatAtk: number;
    baseHp: number; hpPercent: number; flatHp: number;
    baseDef: number; defPercent: number; flatDef: number;
    em: number; critRate: number; critDamage: number;
    equipment: EquipmentBuildMetadata;
  };
  damageBonuses: Partial<Record<"physical" | "pyro" | "hydro" | "cryo" | "electro" | "anemo" | "geo" | "dendro", number>>;
  otherStats: { energyRechargeBonus: number; healingBonus: number };
  source: typeof equipmentDataSource;
  assumptions: string[];
  effectBlockers: string[];
  verification: "provisional";
}

export const equipmentCharacters = gameDataCatalog.characters;
export { equipmentDataSource };
/** Story trial variants cannot be freely equipped; the ordinary Isshin 11416 remains available. */
export const STORY_TRIAL_WEAPON_IDS = new Set(["weapon:11419", "weapon:11420", "weapon:11421"]);
export const equipmentWeapons = gameDataCatalog.weapons.filter(weapon => !STORY_TRIAL_WEAPON_IDS.has(weapon.id));

/** Counts describe mapped clauses, including partial passives, not independently verified gameplay. */
export function getConditionalEquipmentCoverage() {
  const staticWeapons = equipmentWeapons.filter(weapon => SUPPORTED_STATIC_WEAPON_IDS.includes(weapon.id));
  const formulaWeapons = equipmentWeapons.filter(weapon => ([...SUPPORTED_WEAPON_FORMULA_IDS, ...SUPPORTED_WEAPON_CONDITIONAL_IDS, ...SUPPORTED_WEAPON_ADDITIONAL_IDS, ...SUPPORTED_WEAPON_POLEARM_IDS, ...SUPPORTED_WEAPON_RANGED_IDS, ...SUPPORTED_WEAPON_EXTENDED_IDS, ...SUPPORTED_WEAPON_POLEARM_HIT_IDS, ...SUPPORTED_WEAPON_MELEE_HIT_IDS, ...SUPPORTED_WEAPON_RANGED_HIT_IDS, ...SUPPORTED_WEAPON_CONDITIONED_EXPANSION_IDS] as readonly string[]).includes(weapon.id));
  const weapons = equipmentWeapons.filter(weapon => staticWeapons.includes(weapon) || formulaWeapons.includes(weapon));
  const formulaSets = artifactSetCatalog.filter(set => ([...SUPPORTED_ARTIFACT_FORMULA_IDS, ...SUPPORTED_ARTIFACT_CONDITIONAL_IDS, ...SUPPORTED_ARTIFACT_REACTION_IDS, ...SUPPORTED_ARTIFACT_ADDITIONAL_IDS, ...SUPPORTED_ARTIFACT_REMAINING_IDS] as readonly string[]).includes(set.id));
  return {
    datasetId: equipmentDataSource.catalogVersion,
    snapshotId: equipmentDataSource.snapshotId,
    staticWeaponDefinitions: staticWeapons.length,
    formulaWeaponDefinitions: formulaWeapons.length,
    conditionalWeaponDefinitions: equipmentWeapons.filter(weapon => hasWeaponConditionalRule(weapon.id) || hasWeaponAdditionalRule(weapon.id) || hasWeaponPolearmRule(weapon.id) || hasWeaponRangedRule(weapon.id) || hasWeaponExtendedRule(weapon.id) || hasWeaponPolearmHitRule(weapon.id) || hasWeaponMeleeHitRule(weapon.id) || hasWeaponRangedHitRule(weapon.id) || hasWeaponConditionedExpansionRule(weapon.id)).length,
    weaponDefinitions: weapons.length,
    refinementVariants: weapons.reduce((sum, weapon) => sum + legalWeaponRefinements(weapon).length, 0),
    twoPieceArtifactDefinitions: artifactSetCatalog.filter(set => artifactTwoPieceRules[set.slug]?.description === set.pieceEffects.find(effect => effect.pieces === 2)?.description && artifactTwoPieceRules[set.slug] !== undefined).length,
    fourPieceArtifactDefinitions: artifactSetCatalog.filter(set => (SUPPORTED_STATIC_ARTIFACT_FOUR_PIECE_SLUGS as readonly string[]).includes(set.slug) || formulaSets.includes(set)).length,
    formulaArtifactDefinitions: artifactSetCatalog.filter(set => formulaSets.includes(set) || artifactTwoPieceRules[set.slug]?.conditionKey !== undefined).length,
    reactionArtifactDefinitions: artifactSetCatalog.filter(set => hasArtifactReactionRule(set.id) || (SUPPORTED_ARTIFACT_ADDITIONAL_REACTION_IDS as readonly string[]).includes(set.id) || set.id === "artifact-set:15028").length,
    verificationStatus: "provisional" as const,
    executionMode: "conditioned-snapshot" as const,
    countsPartialMappings: true,
    independentlyVerifiedDefinitions: 0
  };
}

/** Empty refinement text is valid for non-refinable starter weapons. */
export function legalWeaponRefinements(weapon: WeaponCatalogEntry): number[] {
  return weapon.refinements.length ? weapon.refinements.map(entry => entry.rank) : [1];
}

export function equipmentLevelRange(entry: CharacterCatalogEntry | WeaponCatalogEntry, ascension: number): { min: number; max: number } {
  const promotion = entry.stats.promotion[ascension];
  if (!Number.isInteger(ascension) || !promotion) throw new Error(`${entry.name}没有突破阶段 ${ascension} 的来源数据。`);
  const min = ascension === 0 ? 1 : entry.stats.promotion[ascension - 1]!.maxlevel;
  const max = promotion.maxlevel;
  if (min === undefined || max === undefined) throw new Error(`${entry.name}缺少突破等级边界。`);
  return { min, max };
}

function requireLevel(entry: CharacterCatalogEntry | WeaponCatalogEntry, level: number, ascension: number): void {
  const range = equipmentLevelRange(entry, ascension);
  if (!Number.isInteger(level) || level < range.min || level > range.max) {
    throw new Error(`${entry.name}突破 ${ascension} 的已收录等级范围为 ${range.min}–${range.max}；等级必须为整数。超过已收录突破上限的解锁条件尚未映射。`);
  }
}

/** Source-table resolution only. It never reconstructs or augments an imported final panel. */
export function resolveEquipmentBuild(input: EquipmentBuildInput, dataset?: EquipmentDataset): EquipmentBuildResolution {
  const equipmentCharacters = equipmentCatalog(dataset).characters;
  const equipmentWeapons = equipmentCatalog(dataset).weapons.filter(weapon => !STORY_TRIAL_WEAPON_IDS.has(weapon.id));
  const equipmentDataSource = equipmentDatasetSource(dataset);
  if (STORY_TRIAL_WEAPON_IDS.has(input.weaponId)) throw new Error("此刀为任务专用试用变体，不能在常规配装中自由装备；普通笼钓瓶一心请选 weapon:11416。");
  const character = equipmentCharacters.find(entry => entry.id === input.characterId);
  const weapon = equipmentWeapons.find(entry => entry.id === input.weaponId);
  if (!character || !weapon) throw new Error("角色或武器不在当前固定来源目录中。");
  if (weapon.weaponType !== character.weaponType) throw new Error(`${character.name}不能装备${weapon.name}：武器类型不匹配。`);
  requireLevel(character, input.level, input.ascension);
  requireLevel(weapon, input.weaponLevel, input.weaponAscension);
  if (!legalWeaponRefinements(weapon).includes(input.refinement)) throw new Error(`${weapon.name}没有精炼 ${input.refinement} 的合法来源记录。`);
  if (!input.effectsDisabled) throw new Error("尚未映射全部角色与装备效果；请明确选择停用未实现效果，才能进行有条件的配装计算。");
  const artifacts = resolveArtifactBuild(input.artifacts ?? [], dataset);
  const effectContext = { ...input.effectContext, weaponType: character.weaponType };
  const weaponEffectInput = { ...(dataset ? { dataset } : {}), weaponId: input.weaponId, characterId: input.characterId, refinement: input.refinement, enabled: input.weaponEffectsEnabled ?? false, context: effectContext };
  const weaponHasFormula = hasWeaponFormulaRule(input.weaponId) || hasWeaponConditionalRule(input.weaponId) || hasWeaponAdditionalRule(input.weaponId) || hasWeaponPolearmRule(input.weaponId) || hasWeaponRangedRule(input.weaponId) || hasWeaponExtendedRule(input.weaponId) || hasWeaponConditionedExpansionRule(input.weaponId);
  const weaponHasHitFormula = hasWeaponPolearmHitRule(input.weaponId) || hasWeaponMeleeHitRule(input.weaponId) || hasWeaponRangedHitRule(input.weaponId);
  const setEffectInputs = Object.entries(artifacts.setCounts).map(([setId, pieces]) => ({ ...(dataset ? { dataset } : {}), setId, pieces, enabled: input.setEffectsEnabled ?? false, context: effectContext }));
  const effectResults = [
    ...(!weaponHasFormula && !weaponHasHitFormula ? [resolveWeaponEffects(weaponEffectInput)] : []),
    ...setEffectInputs.map(entry => resolveArtifactSetEffects({ ...entry, pieces: hasArtifactFormulaRule(entry.setId) || hasArtifactConditionalRule(entry.setId) || hasArtifactReactionRule(entry.setId) || hasArtifactAdditionalRule(entry.setId) || hasArtifactRemainingRule(entry.setId) ? Math.min(3, entry.pieces) : entry.pieces }))
  ];
  // Formula rules own the converted/stacking terms; static rules still resolve each two-piece once.
  const additionalArtifactResults = setEffectInputs.filter(entry => hasArtifactAdditionalRule(entry.setId)).map(resolveArtifactAdditionalEffects);
  const remainingArtifactResults = setEffectInputs.filter(entry => hasArtifactRemainingRule(entry.setId)).map(resolveArtifactRemainingEffects);
  const polearmResults = hasWeaponPolearmRule(input.weaponId) ? [resolveWeaponPolearmEffects(weaponEffectInput)] : [];
  const rangedResults = hasWeaponRangedRule(input.weaponId) ? [resolveWeaponRangedEffects(weaponEffectInput)] : [];
  const conditionedExpansionResults = hasWeaponConditionedExpansionRule(input.weaponId) ? [resolveWeaponConditionedExpansionEffects(weaponEffectInput)] : [];
  const formulaResults = [
    ...(hasWeaponFormulaRule(input.weaponId) ? [resolveWeaponFormulaEffects(weaponEffectInput)] : []),
    ...(hasWeaponConditionalRule(input.weaponId) ? [resolveWeaponConditionalEffects(weaponEffectInput)] : []),
    ...(hasWeaponAdditionalRule(input.weaponId) ? [resolveWeaponAdditionalEffects(weaponEffectInput)] : []),
    ...(hasWeaponExtendedRule(input.weaponId) ? [resolveWeaponExtendedEffects(weaponEffectInput)] : []),
    ...polearmResults,
    ...rangedResults,
    ...conditionedExpansionResults,
    ...setEffectInputs.filter(entry => hasArtifactFormulaRule(entry.setId)).map(resolveArtifactFormulaEffects),
    ...setEffectInputs.filter(entry => hasArtifactConditionalRule(entry.setId)).map(resolveArtifactConditionalEffects),
    ...additionalArtifactResults
  ];
  const reactionResults = setEffectInputs.filter(entry => hasArtifactReactionRule(entry.setId)).map(resolveArtifactReactionEffects);
  const hitEffectResults = [
    ...remainingArtifactResults,
    ...(hasWeaponPolearmHitRule(input.weaponId) ? [resolveWeaponPolearmHitEffects(weaponEffectInput)] : []),
    ...(hasWeaponMeleeHitRule(input.weaponId) ? [resolveWeaponMeleeHitEffects(weaponEffectInput)] : []),
    ...(hasWeaponRangedHitRule(input.weaponId) ? [resolveWeaponRangedHitEffects(weaponEffectInput)] : [])
  ];
  const allEffects = [...effectResults, ...formulaResults, ...reactionResults, ...hitEffectResults];
  const excludedWeapon = [...weaponExtendedExcludedRules, ...weaponRangedExcludedRules, ...weaponAdditionalExcludedRules].find(rule => rule.id === input.weaponId);
  if (input.weaponEffectsEnabled && !weaponHasFormula && !weaponHasHitFormula && excludedWeapon?.blocker) {
    effectResults[0]!.effectBlockers.push(excludedWeapon.blocker);
    effectResults[0]!.sourceRefs.push(...excludedWeapon.sourceRefs);
  }
  const missingConditions = allEffects.flatMap(effect => effect.missingConditions);
  if (missingConditions.length) throw new Error(missingConditions.join("；"));

  const sourceRoot = equipmentDataSource.root;
  const statRef = (category: "characters" | "weapons", slug: string) => equipmentStatSource(category, slug, dataset);
  const characterRef = statRef("characters", character.slug);
  const weaponRef = statRef("weapons", weapon.slug);
  const formulaRef = `${sourceRoot}/src/getdata.js`;
  const derivedStats: EquipmentDerivedStat[] = [];
  const resolve = (kind: "characters" | "weapons", entry: CharacterCatalogEntry | WeaponCatalogEntry, key: string, level: number, ascension: number, id: EquipmentDerivedStat["id"], label: string): number => {
    const base = entry.stats.base[key];
    const curveId = entry.stats.curve[key];
    const promotion = key === "specialized" ? 0 : entry.stats.promotion[ascension]?.[key];
    if (base === undefined || curveId === undefined || promotion === undefined) throw new Error(`${entry.name}缺少 ${key} 的精确基础、曲线或突破数据。`);
    const curve = equipmentStatCurve(kind, level, curveId, dataset);
    derivedStats.push({ id, label, base, curve, promotion, sourceRef: `${statRef(kind, entry.slug)};${sourceRoot}/src/data/curve/${kind}.json#/${level}/${curveId}` });
    return base * curve + promotion;
  };
  const assumptions = [
    `装备推导条件：C0、装备 ${artifacts.pieces.length} 件圣遗物；仅执行明确启用且已映射的装备条款，停用角色被动及未实现效果。`,
    `所用来源为${dataset?.channel === "preview" ? "隔离预览" : "已发布"}目录 ${equipmentDataSource.gameVersion}（${equipmentDataSource.releaseStatus}）；发布状态不等于数值与机制已独立验证。`,
    ...allEffects.flatMap(effect => effect.assumptions)
  ];
  const effectBlockers = [
    `${character.name}：角色被动及命座没有逐项可执行验证规则，当前明确停用。`,
    ...allEffects.flatMap(effect => effect.effectBlockers)
  ];
  const metadata: EquipmentBuildMetadata = {
    bonusAccounting: "core-sourced-v1",
    characterId: input.characterId, weaponId: input.weaponId, level: input.level, ascension: input.ascension,
    weaponLevel: input.weaponLevel, weaponAscension: input.weaponAscension, refinement: input.refinement,
    sourceVersion: `${equipmentDataSource.sourceVersion};snapshot=${equipmentDataSource.snapshotId};${artifacts.sourceVersion}`, sourceRefs: [characterRef, weaponRef, formulaRef, `${sourceRoot}/src/data/curve/characters.json`, `${sourceRoot}/src/data/curve/weapons.json`, ...artifacts.sourceRefs, ...allEffects.flatMap(effect => effect.sourceRefs)], derivedStats,
    secondaryContributions: [], assumptions, effectBlockers, artifacts: artifacts.pieces,
    weaponEffectsEnabled: input.weaponEffectsEnabled ?? false, setEffectsEnabled: input.setEffectsEnabled ?? false,
    weaponType: character.weaponType, effectContext, hitBonuses: effectResults.flatMap(effect => effect.hitBonuses),
    statModifiers: formulaResults.flatMap(effect => effect.statModifiers), dynamicHitBonuses: [...effectResults.flatMap(effect => effect.dynamicHitBonuses ?? []), ...formulaResults.flatMap(effect => effect.dynamicHitBonuses)],
    additiveBaseBonuses: [...hitEffectResults, ...conditionedExpansionResults].flatMap(effect => effect.additiveBaseBonuses), criticalBonuses: hitEffectResults.flatMap(effect => effect.criticalBonuses),
    pendingHitEffects: allEffects.flatMap(effect => "pendingHitEffects" in effect ? effect.pendingHitEffects ?? [] : []),
    pendingReactionEffects: remainingArtifactResults.flatMap(effect => effect.pendingReactionEffects),
    pendingResistanceEffects: reactionResults.flatMap(effect => effect.pendingResistanceEffects),
    reactionBonuses: [...reactionResults.flatMap(effect => effect.reactionBonuses), ...additionalArtifactResults.flatMap(effect => effect.reactionBonuses), ...remainingArtifactResults.flatMap(effect => effect.reactionBonuses), ...polearmResults.flatMap(effect => effect.reactionBonuses), ...rangedResults.flatMap(effect => effect.reactionBonuses)], resistanceReductions: reactionResults.flatMap(effect => effect.resistanceReductions)
  };
  const build: EquipmentBuildResolution["build"] = {
    mode: "equipment-derived",
    characterBaseAtk: resolve("characters", character, "attack", input.level, input.ascension, "characterBaseAtk", "角色基础攻击力"),
    weaponBaseAtk: resolve("weapons", weapon, "attack", input.weaponLevel, input.weaponAscension, "weaponBaseAtk", "武器基础攻击力"),
    baseHp: resolve("characters", character, "hp", input.level, input.ascension, "baseHp", "角色基础生命值"),
    baseDef: resolve("characters", character, "defense", input.level, input.ascension, "baseDef", "角色基础防御力"),
    atkPercent: 0, flatAtk: 0, hpPercent: 0, flatHp: 0, defPercent: 0, flatDef: 0, em: 0,
    critRate: 0, critDamage: 0, equipment: metadata
  };
  if (character.stats.base.critrate === undefined || character.stats.base.critdmg === undefined) throw new Error(`${character.name}缺少基础暴击属性。`);
  const result: EquipmentBuildResolution = {
    characterLevel: input.level, characterName: character.name, weaponName: weapon.name, build,
    damageBonuses: {}, otherStats: { energyRechargeBonus: 0, healingBonus: 0 },
    source: equipmentDataSource, assumptions, effectBlockers, verification: "provisional"
  };
  const characterSpecialized = character.stats.promotion[input.ascension]?.specialized;
  if (characterSpecialized === undefined) throw new Error(`${character.name}缺少突破属性。`);
  const add = (property: string, value: number, sourceRef: string): void => {
    metadata.secondaryContributions.push({ property, value, sourceRef });
    const statProperties: Record<string, "flatAtk" | "flatHp" | "flatDef" | "atkPercent" | "hpPercent" | "defPercent" | "em" | "critRate" | "critDamage"> = { FIGHT_PROP_ATTACK: "flatAtk", FIGHT_PROP_HP: "flatHp", FIGHT_PROP_DEFENSE: "flatDef", FIGHT_PROP_ATTACK_PERCENT: "atkPercent", FIGHT_PROP_HP_PERCENT: "hpPercent", FIGHT_PROP_DEFENSE_PERCENT: "defPercent", FIGHT_PROP_ELEMENT_MASTERY: "em", FIGHT_PROP_CRITICAL: "critRate", FIGHT_PROP_CRITICAL_HURT: "critDamage" };
    const target = statProperties[property];
    if (target) build[target] += value;
    else if (property === "FIGHT_PROP_CHARGE_EFFICIENCY") result.otherStats.energyRechargeBonus += value;
    else if (property === "FIGHT_PROP_HEAL_ADD") result.otherStats.healingBonus += value;
    else if (property === "FIGHT_PROP_NONE") {
      if (value !== 0) throw new Error("无副属性武器含非零副属性，来源冲突。");
    } else {
      const elementProperties: Record<string, keyof EquipmentBuildResolution["damageBonuses"]> = { FIGHT_PROP_PHYSICAL_ADD_HURT: "physical", FIGHT_PROP_FIRE_ADD_HURT: "pyro", FIGHT_PROP_WATER_ADD_HURT: "hydro", FIGHT_PROP_ICE_ADD_HURT: "cryo", FIGHT_PROP_ELEC_ADD_HURT: "electro", FIGHT_PROP_WIND_ADD_HURT: "anemo", FIGHT_PROP_ROCK_ADD_HURT: "geo", FIGHT_PROP_GRASS_ADD_HURT: "dendro" };
      const element = elementProperties[property];
      if (!element) throw new Error(`尚未映射属性 ${property}；不把它静默计为零。`);
      result.damageBonuses[element] = (result.damageBonuses[element] ?? 0) + value;
    }
  };
  add("FIGHT_PROP_CRITICAL", character.stats.base.critrate, `${characterRef}.base.critrate`);
  add("FIGHT_PROP_CRITICAL_HURT", character.stats.base.critdmg, `${characterRef}.base.critdmg`);
  add(character.stats.specialized, characterSpecialized, `${characterRef}.promotion.${input.ascension}.specialized`);
  add(weapon.stats.specialized, resolve("weapons", weapon, "specialized", input.weaponLevel, input.weaponAscension, "weaponSecondary", "武器副属性"), `${weaponRef}.specialized`);
  for (const term of [...artifacts.statContributions, ...effectResults.flatMap(effect => effect.statContributions)]) add(term.property, term.value, term.sourceRef);
  return result;
}
