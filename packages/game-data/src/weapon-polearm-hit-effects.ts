import { equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import { equipmentDescriptionSource } from "./equipment-source";
import type { EquipmentFormulaContext } from "./equipment-formulas";
import type { EquipmentHitEffectResolution } from "./weapon-hit-effect-types";
import reviewedCatalog from "../sources/weapon-polearm-effects/reviewed-catalog.json";

export const SUPPORTED_WEAPON_POLEARM_HIT_IDS = ["weapon:13415"] as const;
export const hasWeaponPolearmHitRule = (id: string): boolean => (SUPPORTED_WEAPON_POLEARM_HIT_IDS as readonly string[]).includes(id);

/** The Catch's burst-only CR is separate from its existing burst DMG term. */
export function resolveWeaponPolearmHitEffects(args: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentFormulaContext; dataset?: EquipmentDataset }): EquipmentHitEffectResolution {
  const result: EquipmentHitEffectResolution = { additiveBaseBonuses: [], criticalBonuses: [], pendingHitEffects: [], assumptions: [], effectBlockers: [], missingConditions: [], sourceRefs: [], verification: "provisional" };
  const weapon = equipmentCatalog(args.dataset).weapons.find(entry => entry.id === args.weaponId);
  const record = reviewedCatalog.find(entry => entry.id === args.weaponId);
  if (!weapon || !record || !hasWeaponPolearmHitRule(weapon.id)) throw new Error(`未登记长柄逐命中条款 ${args.weaponId}。`);
  const rank = weapon.refinements.find(entry => entry.rank === args.refinement), fixedRank = record.refinements.find(entry => entry.rank === args.refinement);
  if (!rank || !fixedRank || !Number.isInteger(args.refinement)) throw new Error(`${weapon.name}没有该精炼来源。`);
  if (rank.description !== fixedRank.description || JSON.stringify(rank.values) !== JSON.stringify(fixedRank.values)) throw new Error(`${weapon.name}来源条款变化，须重新核验。`);
  if (!args.enabled) return result;
  const refs = [equipmentDescriptionSource("weapons", weapon.slug, args.dataset), ...record.sourceRefs.slice(1)];
  result.sourceRefs.push(...refs);
  result.criticalBonuses.push({ id: `${weapon.id}:r${args.refinement}:burst-crit-rate`, label: "渔获·仅元素爆发暴击率", target: "critRate", attackTags: ["burst"], inputPolicy: "final-panel", expression: { kind: "variable", key: "burstCritRate" }, inputs: [{ key: "burstCritRate", value: Number(rank.values[1]!.replace("%", "")) / 100, unit: "ratio", meaningKey: "固定精炼条款的元素爆发专属暴击率", origin: "weapon-fixed-source" }], sourceRefs: refs });
  result.assumptions.push("渔获专属暴击率仅作用于普通元素爆发命中；与原有爆发增伤分别结算，不修改角色全局暴击率，也不用于独立剧变反应。");
  return result;
}
