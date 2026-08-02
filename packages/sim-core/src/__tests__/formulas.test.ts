import { describe, expect, it } from "vitest";
import {
  calcAdditiveReactionDamage,
  calcAmplifyingReactionMultiplier,
  calcCritMultiplier,
  calcDamage,
  calcDefenseMultiplier,
  calcResistanceMultiplier,
  calcTransformativeReactionDamage,
  calcTotalStat,
  TRANSFORMATIVE_REACTION_LEVEL_BASE
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

  it("locks the legacy signed defense-adjustment convention", () => {
    const base = calcDefenseMultiplier({
      characterLevel: 90,
      enemyLevel: 110,
      defenseReduction: 0
    });
    const reduced = calcDefenseMultiplier({
      characterLevel: 90,
      enemyLevel: 110,
      defenseReduction: -0.3
    });
    const increased = calcDefenseMultiplier({
      characterLevel: 90,
      enemyLevel: 110,
      defenseReduction: 0.3
    });

    expect(base).toBeCloseTo(190 / (190 + 210), 15);
    expect(reduced).toBeCloseTo(190 / (190 + 210 * 0.7), 15);
    expect(increased).toBeCloseTo(190 / (190 + 210 * 1.3), 15);
    expect(reduced).toBeGreaterThan(base);
    expect(increased).toBeLessThan(base);

    expect(
      calcDefenseMultiplier({
        characterLevel: 90,
        enemyLevel: 110,
        defenseReduction: -2
      })
    ).toBe(1);
    expect(
      calcDefenseMultiplier({
        characterLevel: 90,
        enemyLevel: 110,
        defenseReduction: 2
      })
    ).toBeCloseTo(190 / (190 + 210 * 1.9), 15);
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

  it("supports positive explicit bases for manual and legacy compatibility multipliers", () => {
    expect(
      calcAmplifyingReactionMultiplier({
        reaction: "melt",
        elementalMastery: 0,
        explicitBase: 2.5
      })
    ).toEqual({
      base: 2.5,
      elementalMasteryBonus: 0,
      reactionBonus: 0,
      total: 2.5
    });

    expect(
      calcAmplifyingReactionMultiplier({
        reaction: "none",
        elementalMastery: 0,
        explicitBase: 2
      })
    ).toEqual({
      base: 2,
      elementalMasteryBonus: 0,
      reactionBonus: 0,
      total: 2
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-positive or non-finite explicit base %s",
    (explicitBase) => {
      expect(() =>
        calcAmplifyingReactionMultiplier({
          reaction: "melt",
          elementalMastery: 0,
          explicitBase
        })
      ).toThrow(/must be a finite positive number/);
    }
  );

  it("rejects invalid amplifying reactions and non-finite inputs", () => {
    expect(() =>
      calcAmplifyingReactionMultiplier({
        reaction: "burning" as never,
        elementalMastery: 0
      })
    ).toThrow(/supported amplifying reaction/);
    expect(() =>
      calcAmplifyingReactionMultiplier({
        reaction: "melt",
        elementalMastery: Number.NaN
      })
    ).toThrow(/elementalMastery must be finite/);
    expect(() =>
      calcAmplifyingReactionMultiplier({
        reaction: "melt",
        elementalMastery: 0,
        reactionBonus: Number.POSITIVE_INFINITY
      })
    ).toThrow(/reactionBonus must be finite/);
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

  it("calculates level-based Overload damage without defense or crit", () => {
    const result = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 2.75,
      effectiveResistance: 0.1
    });

    expect(result.levelBaseDamage).toBe(1446.8535);
    expect(result.elementalMasteryBonus).toBeCloseTo(
      1600 / 2100,
      15
    );
    expect(result.preResistanceDamage).toBeCloseTo(
      1446.8535 * 2.75 * (1 + 1600 / 2100 + 0.2),
      10
    );
    expect(result.resistanceMultiplier).toBeCloseTo(0.9, 15);
    expect(result.finalDamage).toBeCloseTo(
      result.preResistanceDamage * 0.9,
      10
    );
    expect(TRANSFORMATIVE_REACTION_LEVEL_BASE).toHaveLength(100);
    expect(TRANSFORMATIVE_REACTION_LEVEL_BASE[99]).toBe(1674.8092);
  });

  it.each([0, 101, 90.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid transformative reaction character level %s",
    (characterLevel) => {
      expect(() =>
        calcTransformativeReactionDamage({
          characterLevel,
          elementalMastery: 0,
          reactionBonus: 0,
          baseMultiplier: 1,
          effectiveResistance: 0
        })
      ).toThrow(/characterLevel must be an integer from 1 to 100/);
    }
  );

  it("keeps a zero-multiplier transformative event auditable", () => {
    expect(
      calcTransformativeReactionDamage({
        characterLevel: 90,
        elementalMastery: 100,
        reactionBonus: 0.2,
        baseMultiplier: 0,
        effectiveResistance: 0.1
      })
    ).toMatchObject({
      preResistanceDamage: 0,
      finalDamage: 0
    });
  });

  it.each([
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  ])(
    "rejects invalid transformative reaction base multiplier %s",
    (baseMultiplier) => {
      expect(() =>
        calcTransformativeReactionDamage({
          characterLevel: 90,
          elementalMastery: 0,
          reactionBonus: 0,
          baseMultiplier,
          effectiveResistance: 0
        })
      ).toThrow(/baseMultiplier must be a finite non-negative number/);
    }
  );

  it.each([
    ["elementalMastery", Number.NaN],
    ["elementalMastery", Number.POSITIVE_INFINITY],
    ["reactionBonus", Number.NaN],
    ["reactionBonus", Number.NEGATIVE_INFINITY],
    ["effectiveResistance", Number.NaN],
    ["effectiveResistance", Number.POSITIVE_INFINITY]
  ] as const)(
    "rejects non-finite transformative reaction %s",
    (field, invalidValue) => {
      expect(() =>
        calcTransformativeReactionDamage({
          characterLevel: 90,
          elementalMastery: 0,
          reactionBonus: 0,
          baseMultiplier: 1,
          effectiveResistance: 0,
          [field]: invalidValue
        })
      ).toThrow(new RegExp(`${field} must be finite`));
    }
  );

  it("rejects non-finite transformative reaction results", () => {
    expect(() =>
      calcTransformativeReactionDamage({
        characterLevel: 100,
        elementalMastery: 0,
        reactionBonus: Number.MAX_VALUE,
        baseMultiplier: Number.MAX_VALUE,
        effectiveResistance: 0
      })
    ).toThrow(
      /transformative reaction damage produced a non-finite result/
    );
  });

  it("preserves finite negative EM and bonus clamping", () => {
    const transformative = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: -1,
      reactionBonus: -1,
      baseMultiplier: 1,
      effectiveResistance: -0.2
    });
    const additive = calcAdditiveReactionDamage({
      reaction: "aggravate",
      characterLevel: 90,
      elementalMastery: -1,
      reactionBonus: -1
    });

    expect(transformative.elementalMasteryBonus).toBe(0);
    expect(transformative.reactionBonus).toBe(0);
    expect(transformative.resistanceMultiplier).toBe(1.1);
    expect(additive.elementalMasteryBonus).toBe(0);
    expect(additive.reactionBonus).toBe(0);
  });

  it("calculates Aggravate and Spread as additive flat damage", () => {
    const aggravate = calcAdditiveReactionDamage({
      reaction: "aggravate",
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2
    });
    const spread = calcAdditiveReactionDamage({
      reaction: "spread",
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2
    });

    expect(aggravate.levelBaseDamage).toBe(1446.8535);
    expect(aggravate.elementalMasteryBonus).toBeCloseTo(
      500 / 1300,
      15
    );
    expect(aggravate.flatDamage).toBeCloseTo(
      1446.8535 * 1.15 * (1 + 500 / 1300 + 0.2),
      10
    );
    expect(spread.flatDamage).toBeCloseTo(
      1446.8535 * 1.25 * (1 + 500 / 1300 + 0.2),
      10
    );
  });

  it("rejects invalid additive reaction identifiers", () => {
    expect(() =>
      calcAdditiveReactionDamage({
        reaction: "invalid" as never,
        characterLevel: 90,
        elementalMastery: 0,
        reactionBonus: 0
      })
    ).toThrow(/reaction must be either "aggravate" or "spread"/);
  });

  it.each([0, 101, 90.5, Number.NaN, Number.NEGATIVE_INFINITY])(
    "rejects invalid additive reaction character level %s",
    (characterLevel) => {
      expect(() =>
        calcAdditiveReactionDamage({
          reaction: "aggravate",
          characterLevel,
          elementalMastery: 0,
          reactionBonus: 0
        })
      ).toThrow(/characterLevel must be an integer from 1 to 100/);
    }
  );

  it.each([
    ["elementalMastery", Number.NaN],
    ["elementalMastery", Number.POSITIVE_INFINITY],
    ["reactionBonus", Number.NaN],
    ["reactionBonus", Number.NEGATIVE_INFINITY]
  ] as const)(
    "rejects non-finite additive reaction %s",
    (field, invalidValue) => {
      expect(() =>
        calcAdditiveReactionDamage({
          reaction: "spread",
          characterLevel: 90,
          elementalMastery: 0,
          reactionBonus: 0,
          [field]: invalidValue
        })
      ).toThrow(new RegExp(`${field} must be finite`));
    }
  );

  it("rejects non-finite additive reaction results", () => {
    expect(() =>
      calcAdditiveReactionDamage({
        reaction: "spread",
        characterLevel: 100,
        elementalMastery: 0,
        reactionBonus: Number.MAX_VALUE
      })
    ).toThrow(
      /additive reaction damage produced a non-finite result/
    );
  });
});
