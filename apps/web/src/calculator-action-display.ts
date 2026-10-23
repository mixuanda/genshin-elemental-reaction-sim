import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";

const anemoBursts = new Set([
  "traveler-cross-aether-anemo-burst-c0",
  "traveler-cross-lumine-anemo-burst-c0",
]);

const elementNames: Readonly<Record<string, string>> = {
  pyro: "火", hydro: "水", cryo: "冰", electro: "雷",
};

/** Source names and old identifiers stay unchanged in saved calculations.
 * This read-only label describes the action the player can currently select. */
export function calculatorActionDisplayName(document: CalculatorDocument): string {
  const game = document.gameContext;
  if (game && anemoBursts.has(game.skillId)) return "风息激荡 · 风伤与元素吸收";
  if (game?.characterId === "character:10000110" && game.skillId === "iansan-swift-resolved-c0") return "雷霆飞缒 · 雷元素重击";
  return game?.skillName ?? document.label;
}

export function calculatorResultDisplayName(document: CalculatorDocument): string {
  const game = document.gameContext;
  if (!game) return document.label;
  if (game.characterId === "character:10000110" && game.skillId === "iansan-swift-resolved-c0") {
    return `${game.characterName} · 雷霆飞缒 · ${document.scope === "single-hit" ? "单次命中" : "本次完整重击"} · C${game.constellation} · 有效普攻 Lv.${game.effectiveTalentLevel}`;
  }
  if (!anemoBursts.has(game.skillId)) return document.scope === "single-hit" && game.travelerCrossEntityCast
    ? `${game.characterName} · ${game.skillName.split("·")[0]} · 单次命中（C${game.constellation}） · 有效天赋等级 ${game.effectiveTalentLevel}`
    : document.label;
  const anemo = game.travelerCrossEntityCast?.anemo;
  const element = anemo && "absorptionElement" in anemo ? anemo.absorptionElement : undefined;
  const independent = game.travelerCrossEntityCast?.independentEvent;
  const singleRole = independent?.templateRole
    ?? (anemo && "singleHitRole" in anemo ? anemo.singleHitRole : "tick");
  const absorption = anemo?.noAbsorption === true ? "无元素吸收"
    : anemo?.noAbsorption === false && typeof element === "string" && elementNames[element]
      ? `${elementNames[element]}元素吸收`
      : document.scope === "single-hit" && singleRole === "tick" ? "风元素本体" : "吸收条件待填写";
  const scope = document.scope === "single-hit" ? "单次命中" : "本次所选命中";
  return `${game.characterName} · 风息激荡 · ${scope} · ${absorption} · C${game.constellation} · 有效Q Lv.${game.effectiveTalentLevel}`;
}
