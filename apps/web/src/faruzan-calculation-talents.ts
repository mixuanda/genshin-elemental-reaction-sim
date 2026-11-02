import type { CatalogResolvedShowcaseCharacter } from "@genshin-dps-lab/schemas";
import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { hasKnownImportedTalent } from "./imported-talents";

/** The E follow-up arrow uses the independent normal talent, never E's level. */
export function bindFaruzanHurricaneTalent(document: CalculatorDocument, effectiveLevel: number | undefined): void {
  const game = document.gameContext;
  if (game?.characterId !== "character:10000076" || game.skillId !== "finite-followup-faruzan-skill-hurricane-c0" || game.abilityId !== "talent:faruzan:combat2") return;
  const context = game.finiteFollowupCast ??= {};
  if (effectiveLevel === undefined) delete context.normalTalentLevel;
  else {
    if (!Number.isInteger(effectiveLevel) || effectiveLevel < 1 || effectiveLevel > 15) throw new Error("飓烈箭普攻有效天赋等级须为1–15，不能借用E等级。");
    context.normalTalentLevel = effectiveLevel;
  }
}

export function bindImportedFaruzanHurricaneTalent(document: CalculatorDocument, character: CatalogResolvedShowcaseCharacter): void {
  if (character.catalog.characterId !== document.gameContext?.characterId) return;
  const normal = character.resolvedSkills.find(skill => skill.abilityId === "talent:faruzan:combat1");
  bindFaruzanHurricaneTalent(document, normal && hasKnownImportedTalent(normal) ? normal.effectiveLevel : undefined);
}
