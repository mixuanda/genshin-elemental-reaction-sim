import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import type { EquipmentFormulaResolution } from "./equipment-formulas";
import type { EquipmentReactionBonus } from "./artifact-reaction-effects";
import { SUPPORTED_WEAPON_BOW_IDS, hasWeaponBowRule, getWeaponBowControls, resolveWeaponBowEffects, weaponBowExcludedRules, weaponBowSourceEvidence, type WeaponBowContext } from "./weapon-bow-effects";
import { SUPPORTED_WEAPON_CATALYST_IDS, hasWeaponCatalystRule, getWeaponCatalystControls, resolveWeaponCatalystEffects, weaponCatalystExcludedRules, weaponCatalystSourceEvidence, type WeaponCatalystContext } from "./weapon-catalyst-effects";

export interface WeaponRangedContext extends WeaponBowContext, WeaponCatalystContext {}
export interface WeaponRangedControl { key: keyof WeaponRangedContext; label: string; kind: "number" | "boolean"; min?: number; max?: number }
export interface WeaponRangedResolution extends EquipmentFormulaResolution { reactionBonuses: EquipmentReactionBonus[] }
export const SUPPORTED_WEAPON_RANGED_IDS = [...SUPPORTED_WEAPON_BOW_IDS, ...SUPPORTED_WEAPON_CATALYST_IDS];
export const hasWeaponRangedRule = (id: string): boolean => hasWeaponBowRule(id) || hasWeaponCatalystRule(id);
export const weaponRangedExcludedRules = [...weaponBowExcludedRules, ...weaponCatalystExcludedRules];
export const weaponRangedSourceEvidence = [
  ...weaponBowSourceEvidence.map(file => ({ ...file, archiveRoot: "packages/game-data/sources/weapon-bow-effects" })),
  ...weaponCatalystSourceEvidence.map(file => ({ ...file, archiveRoot: "packages/game-data/sources/weapon-catalyst-effects" }))
];
export function getWeaponRangedControls(input: { weaponId: string }): WeaponRangedControl[] {
  return [...getWeaponBowControls(input), ...getWeaponCatalystControls(input)];
}

/** One dispatcher for this batch; returns ordinary formula terms and reaction terms separately. */
export function resolveWeaponRangedEffects(args: { weaponId: string; refinement: number; enabled: boolean; characterId?: string; context?: WeaponRangedContext; dataset?: EquipmentDataset }): WeaponRangedResolution {
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  if (!weapon) throw new Error(`活动目录未收录武器 ${args.weaponId}。`);
  if (weapon.weaponType === "bow") return { ...resolveWeaponBowEffects(args), reactionBonuses: [] };
  if (weapon.weaponType === "catalyst") return resolveWeaponCatalystEffects(args);
  return { statModifiers: [], dynamicHitBonuses: [], reactionBonuses: [], assumptions: [], effectBlockers: [`${weapon.name}不属于弓与法器来源模块。`], missingConditions: [], sourceRefs: [], verification: "provisional" };
}
