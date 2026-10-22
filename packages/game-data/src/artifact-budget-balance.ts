import {
  artifactMainStatValue, artifactSubstatTiers, resolveArtifactBuild,
  type ArtifactPieceInput, type ArtifactStatKey,
} from "./artifact-build";

export type ArtifactStatTotals = Readonly<Partial<Record<ArtifactStatKey, number>>>;
export interface ArtifactBudgetBalance {
  pieces: ArtifactPieceInput[];
  initialScore: number;
  finalScore: number;
  moves: number;
  termination: "no-improving-transfer" | "move-limit";
  energyConstraint: {
    /** Artifact bonus only: 0.2 means +20%, not total 120% ER. */
    minimumArtifactBonus: number | null;
    actualArtifactBonus: number;
    status: "unspecified" | "satisfied" | "unsatisfied";
  };
}

/** A bounded local improvement of a fixed five-star +20 template, not a global optimizer.
 * Each transfer stays on one piece, keeps its tier index, and leaves every existing
 * substat with at least one roll. Main stats, substat identities and roll quality
 * cannot be manufactured. The caller supplies the actual supported damage/utility
 * objective; no ATK, CRIT, EM or reaction ownership assumptions are made here.
 */
export function balanceFiveStarArtifactRolls(
  input: readonly ArtifactPieceInput[],
  score: (stats: ArtifactStatTotals) => number,
  options: { minimumArtifactEnergyRechargeBonus?: number } = {},
): ArtifactBudgetBalance {
  if (input.some(piece => piece.observed || piece.rarity !== 5 || piece.level !== 20))
    throw new Error("预算配平只接受有明确离散词条的 +20 五星圣遗物；不能猜测导入面板的强化历史。");
  resolveArtifactBuild(input);
  const minimum = options.minimumArtifactEnergyRechargeBonus;
  if (minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0))
    throw new Error("圣遗物充能约束须为非负有限加成，不能填写总充能百分数。");
  const pieces = structuredClone([...input]);
  let totals: Partial<Record<ArtifactStatKey, number>> = {};
  const add = (stat: ArtifactStatKey, value: number) => { totals[stat] = (totals[stat] ?? 0) + value; };
  for (const piece of pieces) {
    add(piece.mainStat, artifactMainStatValue(piece.rarity, piece.level, piece.mainStat));
    for (const sub of piece.substats) for (const tier of sub.rolls) add(sub.stat, artifactSubstatTiers(piece.rarity, sub.stat)[tier]!);
  }
  const evaluate = (stats: ArtifactStatTotals) => {
    const result = score(stats);
    if (!Number.isFinite(result)) throw new Error("配平目标须返回有限数值。");
    return result;
  };
  const deficit = (stats: ArtifactStatTotals) => Math.max(0, (minimum ?? 0) - (stats.enerRech_ ?? 0));
  const initialScore = evaluate(totals);
  let currentScore = initialScore;
  let moves = 0;
  const maxMoves = 80;
  const epsilon = 1e-12;
  for (; moves < maxMoves; moves++) {
    let best: { piece: number; donor: number; receiver: number; roll: number; totals: typeof totals; score: number; deficit: number } | undefined;
    const currentDeficit = deficit(totals);
    for (const [pieceIndex, piece] of pieces.entries()) for (const [donorIndex, donor] of piece.substats.entries()) {
      if (donor.rolls.length <= 1) continue;
      // Equal tier indices on a donor produce the same candidate.
      for (const tier of new Set(donor.rolls)) for (const [receiverIndex, receiver] of piece.substats.entries()) {
        if (donorIndex === receiverIndex) continue;
        const nextTotals = { ...totals,
          [donor.stat]: (totals[donor.stat] ?? 0) - artifactSubstatTiers(5, donor.stat)[tier]!,
          [receiver.stat]: (totals[receiver.stat] ?? 0) + artifactSubstatTiers(5, receiver.stat)[tier]!,
        };
        const nextScore = evaluate(nextTotals);
        const nextDeficit = deficit(nextTotals);
        const previousDeficit = best?.deficit ?? currentDeficit;
        const previousScore = best?.score ?? currentScore;
        if (nextDeficit < previousDeficit - epsilon
          || (Math.abs(nextDeficit - previousDeficit) <= epsilon && nextScore > previousScore + epsilon)) {
          best = { piece: pieceIndex, donor: donorIndex, receiver: receiverIndex,
            roll: donor.rolls.indexOf(tier), totals: nextTotals, score: nextScore, deficit: nextDeficit };
        }
      }
    }
    if (!best) break;
    const piece = pieces[best.piece]!;
    const [tier] = piece.substats[best.donor]!.rolls.splice(best.roll, 1);
    piece.substats[best.receiver]!.rolls.push(tier!);
    totals = best.totals;
    currentScore = best.score;
  }
  resolveArtifactBuild(pieces);
  return {
    pieces, initialScore, finalScore: currentScore, moves,
    termination: moves === maxMoves ? "move-limit" : "no-improving-transfer",
    energyConstraint: { minimumArtifactBonus: minimum ?? null, actualArtifactBonus: totals.enerRech_ ?? 0,
      status: minimum === undefined ? "unspecified" : deficit(totals) <= epsilon ? "satisfied" : "unsatisfied" },
  };
}
