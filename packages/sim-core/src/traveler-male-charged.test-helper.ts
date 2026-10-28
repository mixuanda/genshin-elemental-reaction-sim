import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import type { CalculatorDocument } from "./calculator-model";

const sourceDocuments = new Map<number, CalculatorDocument[]>();
export function createMaleChargedFixture(constellation = 6, element = "anemo", level = 10): CalculatorDocument {
  if (!sourceDocuments.has(level)) sourceDocuments.set(level, getCharacterDocuments("character:10000005", level));
  const document = structuredClone(sourceDocuments.get(level)!.find(row => row.gameContext?.skillId === `male-charged-aether-${element}-c0`)!);
  document.scope = "one-cast";
  document.characterLevel = 90;
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  document.build = { mode: "manual-final", ascension: 6, source: "Synthetic actual physical charged-hit panel; no extra damage bonus or reaction",
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.gameContext!.constellation = constellation;
  document.gameContext!.travelerMaleChargedCast = {
    casterId: "aether", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true,
    observedThroughFrame: 20, statsStableAcrossHits: true,
    precedingNormalAttackConfirmed: true, normalCounterBeforeCast: 1,
    actionReadyConfirmed: true, initialStamina: 20, staminaCostMultiplier: 1,
    targetContacts: { "hit-1": true, "hit-2": true },
    sharedState: { externalInfusionActive: false, trueMoonStoryBuffEnabled: false },
  };
  return document;
}
