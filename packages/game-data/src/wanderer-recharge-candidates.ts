import {
  ARTIFACT_SLOTS, artifactMainStatValue, artifactSubstatTiers, resolveArtifactBuild,
  type ArtifactPieceInput, type ArtifactStatKey, type ArtifactSubstatKey,
} from "./artifact-build";
import { balanceFiveStarArtifactRolls, type ArtifactStatTotals } from "./artifact-budget-balance";
import type { EquipmentBuildInput } from "./equipment-build";

/** Ordinary, non-weak-point, ATK-scaling Wanderer hits from one immutable native
 * capture. Transformative damage and another character's coordinated hits must
 * be excluded by the extractor, even if the native row attributes them to him.
 */
export interface FrozenWandererHit {
  frame: number;
  ability: string;
  baseAtk: number;
  attack: number;
  scaling: number;
  baseDamageBonus: number;
  flatDamage: number;
  /** The unclamped snapshot is required: a Cryo infusion can overflow CR. */
  critRate: number;
  critDamage: number;
  usedCritRate: number;
  usedCritDamage: number;
  isCrit: boolean;
  actualDamage: number;
}

export interface WandererRollMove {
  slot: ArtifactPieceInput["slot"];
  tierIndex: number;
  from: ArtifactSubstatKey;
  to: ArtifactSubstatKey;
  removedValue: number;
  addedValue: number;
}

export const WANDERER_RECHARGE_PROXY_LABEL = "frozen-observed-own-hit-offense-only;not-native-DPS;not-cycle-or-global-optimum";

export function wandererArtifactTotals(pieces: readonly ArtifactPieceInput[]): ArtifactStatTotals {
  resolveArtifactBuild(pieces);
  const totals: Partial<Record<ArtifactStatKey, number>> = {};
  const add = (stat: ArtifactStatKey, value: number) => { totals[stat] = (totals[stat] ?? 0) + value; };
  for (const piece of pieces) {
    if (piece.observed) throw new Error("Observed artifact values cannot supply an invented discrete roll history.");
    add(piece.mainStat, artifactMainStatValue(piece.rarity, piece.level, piece.mainStat));
    for (const sub of piece.substats) for (const tier of sub.rolls) add(sub.stat, artifactSubstatTiers(piece.rarity, sub.stat)[tier]!);
  }
  return totals;
}

const clampCrit = (value: number) => Math.min(1, Math.max(0, value));

/** Ranks legal reallocations with the baseline's actual per-hit ATK, CR overflow,
 * flat damage and observed critical multiplier. All timing, buffs, flat terms,
 * reactions, energy and hit counts are frozen. ER has no invented damage value.
 * New burst opportunities and changed reaction/aura states require native replay.
 */
export function createFrozenWandererOffenseScore(
  baseline: readonly ArtifactPieceInput[], hits: readonly FrozenWandererHit[],
): (candidate: ArtifactStatTotals) => number {
  const original = wandererArtifactTotals(baseline);
  if (!hits.length) throw new Error("A frozen offense proxy requires witnessed ordinary Wanderer hits.");
  const terms = hits.map(hit => {
    if (![hit.frame, hit.baseAtk, hit.attack, hit.scaling, hit.baseDamageBonus, hit.flatDamage,
      hit.critRate, hit.critDamage, hit.usedCritRate, hit.usedCritDamage, hit.actualDamage].every(Number.isFinite)
      || !Number.isInteger(hit.frame) || hit.frame < 0 || !hit.ability
      || hit.baseAtk <= 0 || hit.attack <= 0 || hit.scaling <= 0
      || hit.flatDamage < 0 || hit.baseDamageBonus <= -1 || hit.actualDamage <= 0
      || hit.critDamage < 0 || hit.usedCritDamage < 0 || Math.abs(clampCrit(hit.critRate) - hit.usedCritRate) > 1e-10
      || typeof hit.isCrit !== "boolean") throw new Error("Invalid or unsupported frozen ordinary-hit evidence.");
    const baselineBase = hit.attack * hit.scaling * (1 + hit.baseDamageBonus) + hit.flatDamage;
    const observedNonCrit = hit.actualDamage / (hit.isCrit ? 1 + hit.usedCritDamage : 1);
    return { ...hit, coefficient: observedNonCrit / baselineBase };
  });
  return candidate => {
    const delta = (stat: ArtifactStatKey) => (candidate[stat] ?? 0) - (original[stat] ?? 0);
    // HP, EM, DEF, element bonuses and main stats are not varied by this proxy.
    for (const stat of new Set([...Object.keys(original), ...Object.keys(candidate)] as ArtifactStatKey[])) {
      if (!["atk", "atk_", "critRate_", "critDMG_", "enerRech_"].includes(stat) && Math.abs(delta(stat)) > 1e-10)
        throw new Error(`The frozen Wanderer proxy cannot score changed ${stat}.`);
    }
    return terms.reduce((sum, hit) => {
      const attack = hit.attack + hit.baseAtk * delta("atk_") + delta("atk");
      const critDamage = hit.usedCritDamage + delta("critDMG_");
      if (attack < 0 || critDamage < 0) throw new Error("Candidate offense cannot become negative.");
      const base = attack * hit.scaling * (1 + hit.baseDamageBonus) + hit.flatDamage;
      return sum + base * hit.coefficient * (1 + clampCrit(hit.critRate + delta("critRate_")) * critDamage);
    }, 0);
  };
}

const tiers = (piece: ArtifactPieceInput) => piece.substats.flatMap(sub => sub.rolls).sort((a, b) => a - b);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Proves the result used only within-piece transfers of the exact original
 * tier indices. This also constructs a replayable, per-tier before/after delta.
 */
export function validateWandererRollTransfers(
  before: readonly ArtifactPieceInput[], after: readonly ArtifactPieceInput[],
): WandererRollMove[] {
  for (const pieces of [before, after]) {
    if (pieces.length !== 5 || !ARTIFACT_SLOTS.every(slot => pieces.some(piece => piece.slot === slot))
      || pieces.some(piece => piece.observed || piece.rarity !== 5 || piece.level !== 20))
      throw new Error("Exactly five non-observed +20 five-star pieces are required.");
    resolveArtifactBuild(pieces);
  }
  const moves: WandererRollMove[] = [];
  for (const old of before) {
    const next = after.find(piece => piece.slot === old.slot)!;
    const identity = (piece: ArtifactPieceInput) => ({ slot: piece.slot, setId: piece.setId,
      rarity: piece.rarity, level: piece.level, mainStat: piece.mainStat, initialSubstats: piece.initialSubstats,
      substats: piece.substats.map(sub => sub.stat).sort() });
    if (!same(identity(old), identity(next)) || !same(tiers(old), tiers(next)))
      throw new Error("A candidate cannot change piece identity, substat identities, roll count or tier quality.");
    for (let tier = 0; tier < 4; tier++) {
      const donors: ArtifactSubstatKey[] = [], receivers: ArtifactSubstatKey[] = [];
      for (const sub of old.substats) {
        const delta = next.substats.find(item => item.stat === sub.stat)!.rolls.filter(value => value === tier).length
          - sub.rolls.filter(value => value === tier).length;
        for (let count = 0; count < Math.abs(delta); count++) (delta < 0 ? donors : receivers).push(sub.stat);
      }
      if (donors.length !== receivers.length) throw new Error("Tier transfer conservation failed.");
      for (const [index, from] of donors.entries()) {
        const to = receivers[index]!;
        moves.push({ slot: old.slot, tierIndex: tier, from, to,
          removedValue: artifactSubstatTiers(5, from)[tier]!, addedValue: artifactSubstatTiers(5, to)[tier]! });
      }
    }
  }
  return moves;
}

/** The caller supplies the independently sourced non-artifact total ER, e.g. 1
 * for this signature-weapon Wanderer. It is never inferred from desired energy.
 */
export function buildWandererRechargeCandidate(
  baseline: EquipmentBuildInput, hits: readonly FrozenWandererHit[],
  targetTotalEnergyRecharge: number, nonArtifactTotalEnergyRecharge: number,
) {
  if (baseline.characterId !== "character:10000075" || !baseline.artifacts)
    throw new Error("A complete Wanderer equipment input is required.");
  if (![targetTotalEnergyRecharge, nonArtifactTotalEnergyRecharge].every(Number.isFinite)
    || nonArtifactTotalEnergyRecharge < 1 || targetTotalEnergyRecharge < nonArtifactTotalEnergyRecharge)
    throw new Error("Target and non-artifact total ER must be explicit finite fractions, not artifact bonuses or displayed percents.");
  validateWandererRollTransfers(baseline.artifacts, baseline.artifacts);
  const score = createFrozenWandererOffenseScore(baseline.artifacts, hits);
  const balance = balanceFiveStarArtifactRolls(baseline.artifacts, score, {
    minimumArtifactEnergyRechargeBonus: targetTotalEnergyRecharge - nonArtifactTotalEnergyRecharge,
  });
  const rollMoves = validateWandererRollTransfers(baseline.artifacts, balance.pieces);
  const before = wandererArtifactTotals(baseline.artifacts), after = wandererArtifactTotals(balance.pieces);
  const resolution = resolveArtifactBuild(balance.pieces);
  return {
    equipment: { ...structuredClone(baseline), artifacts: balance.pieces },
    targetTotalEnergyRecharge, nonArtifactTotalEnergyRecharge,
    totalEnergyRecharge: nonArtifactTotalEnergyRecharge + (after.enerRech_ ?? 0),
    artifactTotals: after,
    artifactDelta: Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])]
      .map(stat => [stat, (after[stat as ArtifactStatKey] ?? 0) - (before[stat as ArtifactStatKey] ?? 0)])),
    rollMoves,
    pieceBudgets: balance.pieces.map(piece => ({ slot: piece.slot, initialSubstats: piece.initialSubstats,
      totalRolls: tiers(piece).length, tierIndices: tiers(piece),
      before: structuredClone(baseline.artifacts!.find(old => old.slot === piece.slot)!.substats), after: piece.substats })),
    proxy: { label: WANDERER_RECHARGE_PROXY_LABEL, hits: hits.length,
      baseline: balance.initialScore, candidate: balance.finalScore,
      relativeChange: balance.finalScore / balance.initialScore - 1 },
    search: { moves: balance.moves, termination: balance.termination, energyConstraint: balance.energyConstraint },
    sourceRefs: resolution.sourceRefs, sourceVersion: resolution.sourceVersion,
  };
}
