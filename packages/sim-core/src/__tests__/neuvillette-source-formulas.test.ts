import { describe, expect, it } from "vitest";
import { calcDamage } from "../formulas";
import { resolveSourceHostCharacterFlatInput, type SourceHostCharacterFlatRuleId } from "../source-host-character-flat-formula";
import { resolveSourceHostCharacterModifierDynamicInput } from "../source-host-character-modifier-dynamic-formula";

// Pure numeric regressions at the source-owned read points; no native clock,
// ascension gate, energy, or hit-window lifecycle is replayed here. In particular,
// constant-MaxHP native parity fixtures cannot distinguish Q's saved cast base
// from later snapshot MaxHP. These samples deliberately make those values differ.
const commits = [
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
] as const;

function flat(commit: string, ruleId: SourceHostCharacterFlatRuleId, state: Record<string, number>, priorFlatDamage = 0) {
  return resolveSourceHostCharacterFlatInput({ ruleId, sourceHolderIndex: 0, priorFlatDamage, state }, commit).value;
}

function a4(commit: string, hpRatio: number) {
  return resolveSourceHostCharacterModifierDynamicInput({
    ruleId: "char-dyn-neuvillette-a4-hydrop", modifierKey: "neuvillette-a4",
    sourceHolderIndex: 0, phase: "creation", state: { hpRatio },
  }, commit).value;
}

function damage(flatDamage: number, laterMaxHp: number, damageBonus: number) {
  return calcDamage({
    // Native HP damage is already stored in FlatDmg. Later HP must not supply
    // another scaling term, even when the offensive snapshot sees a new value.
    scaling: 0, scalingStat: "hp", scalingValue: laterMaxHp, flatDamage, damageBonus,
    characterLevel: 90, enemyLevel: 90, defenseReduction: 0, defenseIgnore: 0,
    effectiveResistance: 0.1, critRate: 0, critDamage: 0, critMode: "noCrit",
    reaction: "none", elementalMastery: 0, reactionBonus: 0, groupMultiplier: 1,
  }).finalDamage;
}

describe.each(commits)("Neuvillette C0 source formulas at %s", commit => {
  it("keeps both Q bases at cast HP while later HP and A4 change", () => {
    // burst.go creates both AttackInfo values before its delayed QueueAttack calls.
    const castHp = 32_000;
    for (const [ruleId, coefficient] of [
      ["char-flat-neuv-burst", 0.400641],
      ["char-flat-neuv-burstwaterfall", 0.163898],
    ] as const) {
      const savedBase = flat(commit, ruleId, { talent: 9, maxHp: castHp });
      expect(savedBase).toBeCloseTo(castHp * coefficient, 10);
      const earlierBonus = a4(commit, 0.5);
      const laterBonus = a4(commit, 0.8);
      expect(earlierBonus).toBeCloseTo(0.12, 12);
      expect(laterBonus).toBeCloseTo(0.3, 12);
      const earlier = damage(savedBase, 48_000, 0.466 + earlierBonus);
      const later = damage(savedBase, 64_000, 0.466 + laterBonus);
      expect(earlier).toBeCloseTo(castHp * coefficient * (1 + 0.466 + 0.12) * 0.5 * 0.9, 8);
      expect(later).toBeCloseTo(castHp * coefficient * (1 + 0.466 + 0.3) * 0.5 * 0.9, 8);
      expect(later / earlier).toBeCloseTo((1 + 0.466 + 0.3) / (1 + 0.466 + 0.12), 12);
      expect(damage(savedBase, 64_000, 0.466 + earlierBonus)).toBe(earlier);
      expect(later).not.toBeCloseTo(64_000 * coefficient * (1 + 0.466 + 0.3) * 0.5 * 0.9, 8);
    }
  });

  it("distinguishes the initial pre-A1 CA base from C0 per-wave A1 replacement", () => {
    // charge.go retains the initial value below A1; its ascension >= 1 branch
    // calls the per-wave rule instead. The source still owns that gate.
    const coefficient = 0.073186;
    const initial = flat(commit, "char-flat-neuv-chargejudgement", { talent: 0, maxHp: 32_000 });
    expect(initial).toBeCloseTo(32_000 * coefficient, 10);
    expect(damage(initial, 48_000, 0)).toBeCloseTo(32_000 * coefficient * 0.5 * 0.9, 8);
    for (const [stacks, multiplier] of [[0, 1], [1, 1.1], [2, 1.25], [3, 1.6]] as const) {
      const state: Record<string, number> = { talent: 0, maxHp: 48_000, baseStacks: 0 };
      for (let index = 0; index < 9; index++) state[`status${index}`] = index < stacks ? 1 : 0;
      const wave = flat(commit, "char-flat-neuv-judgement-a1", state, initial);
      expect(wave).toBeCloseTo(48_000 * coefficient * multiplier, 10);
      // The A1 assignment replaces the initial FlatDmg; it never adds it again.
      expect(wave).not.toBeCloseTo(initial + 48_000 * coefficient * multiplier, 10);
      expect(damage(wave, 48_000, 0)).toBeCloseTo(48_000 * coefficient * multiplier * 0.5 * 0.9, 8);
    }
  });

  it("clamps the A4 creation value and consumes it once in the damage bonus", () => {
    for (const [ratio, expected] of [[0, 0], [0.3, 0], [0.5, 0.12], [0.8, 0.3], [1, 0.3]] as const) {
      expect(a4(commit, ratio)).toBeCloseTo(expected, 12);
    }
    const base = flat(commit, "char-flat-neuv-chargejudgement", { talent: 9, maxHp: 40_000 });
    const bonus = a4(commit, 0.5);
    // A source snapshot's damageBonus already contains the stored modifier.
    // Resolving the flat base does not include or add A4 a second time.
    const snapshotDamageBonus = 0.466 + bonus;
    const actual = damage(base, 40_000, snapshotDamageBonus);
    expect(base).toBeCloseTo(40_000 * 0.14467, 10);
    expect(actual).toBeCloseTo(40_000 * 0.14467 * (1 + 0.466 + 0.12) * 0.5 * 0.9, 8);
    expect(actual).not.toBeCloseTo(40_000 * 0.14467 * (1 + 0.466 + 0.12 + 0.12) * 0.5 * 0.9, 8);
  });
});
