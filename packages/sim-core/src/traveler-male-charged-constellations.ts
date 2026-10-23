import { travelerMaleChargedTemplates } from "../../game-data/src/character-mappings/traveler-male-charged-mappings";
import manifest from "../../game-data/sources/traveler-male-charged-constellations/manifest.json";
import type { CalculatorDocument, CalculatorHit } from "./calculator-model";

export const TRAVELER_MALE_CHARGED_ANEMO_MAX_CONSTELLATION = 6;
export const TRAVELER_MALE_CHARGED_ANEMO_CONSTELLATION_SOURCE_REFS: readonly string[] = manifest.sourceRefs;
const ANEMO_SKILL = "male-charged-aether-anemo-c0";

export interface TravelerMaleChargedConstellationScope {
  allowed: boolean;
  maximumConstellation: number;
  reason: string;
  sourceRefs: readonly string[];
}

/** The legacy c0 ID is retained. Support is attached to the exact form, NA
 * talent and physical charged effect; it never grants a character-wide scope. */
export function travelerMaleChargedConstellationScope(document: CalculatorDocument, hit?: CalculatorHit): TravelerMaleChargedConstellationScope | undefined {
  const game = document.gameContext, cast = travelerMaleChargedTemplates.find(row => row.skillId === game?.skillId);
  if (!game || !cast) return undefined;
  const anemo = cast.skillId === ANEMO_SKILL;
  const maximumConstellation = anemo ? TRAVELER_MALE_CHARGED_ANEMO_MAX_CONSTELLATION : 0;
  const sourceRefs = anemo ? [...cast.sourceRefs, ...TRAVELER_MALE_CHARGED_ANEMO_CONSTELLATION_SOURCE_REFS] : cast.sourceRefs;
  const identity = game.characterId === "character:10000005" && game.variantId === cast.variantId
    && game.abilityId === `talent:traveler${cast.element}:combat1`;
  const effect = hit === undefined || hit.kind === "ordinary" && hit.element === "physical" && hit.attackTag === "charged"
    && Object.entries(cast.roles).some(([role, definition]) => hit.id === definition.mappingId
      || hit.id === `${cast.skillId}:${role}` && hit.travelerMaleChargedEvent?.candidateId === role
        && hit.travelerMaleChargedEvent.templateRole === role);
  const validLevel = Number.isInteger(game.effectiveTalentLevel) && game.effectiveTalentLevel >= 1 && game.effectiveTalentLevel <= 15;
  const validConstellation = Number.isInteger(game.constellation) && game.constellation >= 0 && game.constellation <= maximumConstellation;
  const allowed = identity && effect && validLevel && validConstellation;
  const reason = !identity || !effect
    ? "此命座审阅仅适用于空的对应元素普攻天赋与已定义的基础物理重击段落；不能借给其他身份、天赋、动作或元素。"
    : !validLevel ? "男性重击需要已明确的1至15级有效普攻天赋，不从命座补加等级。"
    : !validConstellation ? anemo ? "空风形态基础物理重击仅核准明确的C0–C6。"
      : "此非风男性基础重击分支仍仅支持明确C0；其他形态高命座尚未核准。"
    : anemo
      ? "空风形态基础物理重击C0–C6：C1仅E牵引、C2仅充能效率、C3/C5仅Q/E等级、C4仅E期间减伤，C6只减风与实际吸收元素抗性；不增加物理倍率、物理减抗或普攻等级。实际附魔／剧情、起手、体力、接触和取样条件仍逐击检查。"
      : "此非风男性基础物理重击只核准C0；实际资格与逐击面板仍分别检查。";
  return { allowed, maximumConstellation, reason, sourceRefs };
}
