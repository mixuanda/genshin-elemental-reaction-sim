import { describe, expect, it } from "vitest";
import {
  calcAmplifyingReactionMultiplier,
  calcCritMultiplier,
  calcDamage,
  calcDefenseMultiplier,
  calcResistanceMultiplier,
  calcTotalStat
} from "../formulas";
import { neutralStats } from "./fixtures";

describe("damage formula primitives", () => {
  it("calculates ATK, HP, DEF and EM totals", () => {
    const stats = {
      ...neutralStats,
      baseAtk: 100,
      atkPct: 0.5,
      flatAtk: 20,
      baseHp: 1000,
      hpPct: 0.2,
      flatHp: 300,
      baseDef: 500,
      defPct: 0.4,
      flatDef: 50,
      em: 187
    };
    expect(calcTotalStat(stats, "atk")).toBe(170);
    expect(calcTotalStat(stats, "hp")).toBe(1500);
    expect(calcTotalStat(stats, "def")).toBe(750);
    expect(calcTotalStat(stats, "em")).toBe(187);
  });

  it("uses the level 90 versus level 110 defense multiplier", () => {
    expect(
      calcDefenseMultiplier({ characterLevel: 90, enemyLevel: 110 })
    ).toBeCloseTo(190 / 400, 15);
  });

  it("clamps defense ignore at 100%", () => {
    expect(
      calcDefenseMultiplier({
        characterLevel: 90,
        enemyLevel: 110,
        defenseIgnore: 1.5
      })
    ).toBe(1);
  });

  it("covers negative, normal, and high resistance branches", () => {
    expect(calcResistanceMultiplier(-0.2)).toBeCloseTo(1.1, 15);
    expect(calcResistanceMultiplier(0)).toBe(1);
    expect(calcResistanceMultiplier(0.1)).toBeCloseTo(0.9, 15);
    expect(calcResistanceMultiplier(0.75)).toBeCloseTo(0.25, 15);
    expect(calcResistanceMultiplier(1)).toBeCloseTo(0.2, 15);
  });

  it("supports average, all-crit, and no-crit modes", () => {
    expect(
      calcCritMultiplier({
        critRate: 0.5,
        critDamage: 2,
        critMode: "average"
      })
    ).toBe(2);
    expect(
      calcCritMultiplier({
        critRate: 0,
        critDamage: 2,
        critMode: "allCrit"
      })
    ).toBe(3);
    expect(
      calcCritMultiplier({
        critRate: 1,
        critDamage: 2,
        critMode: "noCrit"
      })
    ).toBe(1);
  });

  it("calculates forward and reverse amplifying reactions", () => {
    const melt = calcAmplifyingReactionMultiplier({
      reaction: "melt",
      elementalMastery: 0
    });
    const reverseMelt = calcAmplifyingReactionMultiplier({
      reaction: "reverseMelt",
      elementalMastery: 0
    });
    expect(melt.total).toBe(2);
    expect(reverseMelt.total).toBe(1.5);
  });

  it("returns an auditable naked-damage factor breakdown", () => {
    const result = calcDamage({
      scaling: 2,
      scalingStat: "atk",
      scalingValue: 1000,
      flatDamage: 0,
      damageBonus: 0,
      characterLevel: 90,
      enemyLevel: 110,
      defenseReduction: 0,
      defenseIgnore: 0,
      effectiveResistance: 0.1,
      critRate: 0,
      critDamage: 0.5,
      critMode: "average",
      reaction: "none",
      elementalMastery: 0,
      reactionBonus: 0,
      groupMultiplier: 1
    });
    expect(result.factors.baseDamage).toBe(2000);
    expect(result.factors.defenseMultiplier).toBeCloseTo(0.475, 15);
    expect(result.factors.resistanceMultiplier).toBeCloseTo(0.9, 15);
    expect(result.finalDamage).toBeCloseTo(855, 12);
  });
});

