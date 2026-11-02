import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { finiteFollowupTemplates } from "../../../packages/game-data/src/character-mappings/finite-followup-mappings";

const actionId = "finite-followup-faruzan-skill-hurricane-c0";
const canonicalIds = new Set(finiteFollowupTemplates.find(template => template.skillId === actionId)?.hits.map(hit => hit.id));

export function getFaruzanEPanelDeclarationHitIds(document: CalculatorDocument): string[] {
  const game = document.gameContext;
  if (game?.characterId !== "character:10000076" || game.skillId !== actionId || game.constellation !== 0) return [];
  const selected = new Set(document.selectedHitIds);
  return document.hits.filter(hit => hit.kind === "ordinary" && !hit.finalSnapshot && selected.has(hit.id) && canonicalIds.has(hit.id)).map(hit => hit.id);
}

/** Called only for the user's explicit declaration. Fresh-cast conditions do
 * not imply anything about shares already included in the input panel. */
export function applyFaruzanEPanelExcludesOwnEffectsDeclaration(document: CalculatorDocument): CalculatorDocument | undefined {
  const hitIds = getFaruzanEPanelDeclarationHitIds(document);
  if (!hitIds.length) return undefined;
  const next = structuredClone(document), context = next.gameContext!.finiteFollowupCast ??= {};
  context.hitStates ??= {};
  for (const id of hitIds) context.hitStates[id] = { ...context.hitStates[id],
    includedDamageBonus: 0, includedAdditiveBase: 0, includedResistanceReduction: 0 };
  return next;
}
