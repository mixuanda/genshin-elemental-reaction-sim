import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";

/** A freshly selected source template need not have a cast context yet.
 * Bind only independently known Q levels; never borrow the normal talent. */
export function bindIansanSwiftBurstTalent(document: CalculatorDocument, effectiveLevel: number | undefined): void {
  const game = document.gameContext;
  if (game?.characterId !== "character:10000110" || game.skillId !== "iansan-swift-resolved-c0"
    || game.abilityId !== "talent:iansan:combat1") return;
  const cast = game.iansanSwiftResolvedCast ??= {};
  if (effectiveLevel === undefined) delete cast.burstTalentLevel;
  else {
    if (!Number.isInteger(effectiveLevel) || effectiveLevel < 1 || effectiveLevel > 15) throw new Error("伊安珊 Q 有效天赋等级须为1–15；不能借用普通攻击等级。");
    cast.burstTalentLevel = effectiveLevel;
  }
}
