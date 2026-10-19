import type { EquipmentDynamicHitBonus } from "./equipment-formulas";

/** A term added to this ordinary hit's damage base, never to the character's ATK. */
export interface EquipmentAdditiveBaseBonus extends EquipmentDynamicHitBonus {
  inputPolicy: "pre-conversion" | "final-panel";
}
/** A critical property for matching ordinary hits only. */
export interface EquipmentCriticalBonus extends EquipmentDynamicHitBonus {
  target: "critRate" | "critDamage";
  inputPolicy: "pre-conversion" | "final-panel";
}
/** Missing context blocks only ordinary hits that depend on this exact clause. */
export interface EquipmentPendingHitEffect extends Pick<EquipmentDynamicHitBonus, "id" | "label" | "sourceRefs" | "elements" | "attackTags" | "weaponTypes"> {
  reason: string;
  kind?: "additive-base" | "critRate" | "critDamage" | "damageBonus";
}
export interface EquipmentHitEffectResolution {
  additiveBaseBonuses: EquipmentAdditiveBaseBonus[];
  criticalBonuses: EquipmentCriticalBonus[];
  pendingHitEffects: EquipmentPendingHitEffect[];
  assumptions: string[];
  effectBlockers: string[];
  missingConditions: string[];
  sourceRefs: string[];
  verification: "provisional";
}
