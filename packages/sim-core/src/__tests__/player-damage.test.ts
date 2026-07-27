import { describe, expect, it } from "vitest";
import { calcTransformativeReactionDamage } from "../formulas";
import {
  absorbPlayerDamageWithCrystallizeShield,
  applyPlayerHpDamage,
  calcPlayerMaxHp,
  calcPlayerReactionSelfDamage,
  calcPlayerResistanceMultiplier,
  PLAYER_DAMAGE_REFERENCE,
  PLAYER_REACTION_SELF_DAMAGE_MULTIPLIERS,
  PLAYER_REACTION_SELF_DAMAGE_RADII,
  resolveCircularPlayerHit,
  type PlayerReactionSelfDamageKind
} from "../player-damage";

describe("player max HP", () => {
  it("uses BaseHP * (1 + HP%) + flat HP", () => {
    expect(
      calcPlayerMaxHp({
        baseHp: 10_000,
        hpPct: 0.2,
        flatHp: 500
      })
    ).toEqual({
      baseHp: 10_000,
      hpPct: 0.2,
      flatHp: 500,
      unclampedMaxHp: 12_500,
      maxHp: 12_500
    });
  });

  it("floors malformed negative totals at zero without hiding the raw total", () => {
    expect(
      calcPlayerMaxHp({
        baseHp: 100,
        hpPct: -2,
        flatHp: -25
      })
    ).toEqual({
      baseHp: 100,
      hpPct: -2,
      flatHp: -25,
      unclampedMaxHp: -125,
      maxHp: 0
    });
  });
});

describe("player reaction self-damage", () => {
  it("locks the provisional fixed-reference multipliers, radii, and defense ignore", () => {
    expect(PLAYER_DAMAGE_REFERENCE).toEqual({
      project: "genshinsim/gcsim",
      revision:
        "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
      mechanicsDataStatus: "fixed-gcsim-provisional",
      defenseIgnore: 1
    });
    expect(PLAYER_REACTION_SELF_DAMAGE_MULTIPLIERS).toEqual({
      burning: 1,
      bloom: 0.02,
      burgeon: 0.02,
      hyperbloom: 0.02
    });
    expect(PLAYER_REACTION_SELF_DAMAGE_RADII).toEqual({
      burning: 1,
      bloom: 5,
      burgeon: 5,
      hyperbloom: 1
    });
  });

  it.each([
    ["burning", 1, 1_000, 900],
    ["bloom", 0.02, 20, 18],
    ["burgeon", 0.02, 20, 18],
    ["hyperbloom", 0.02, 20, 18]
  ] as const)(
    "applies %s self damage before resistance and ignores defense",
    (reaction, multiplier, preResistanceDamage, finalDamage) => {
      const result = calcPlayerReactionSelfDamage({
        reaction,
        sourcePreResistanceDamage: 1_000,
        effectiveResistance: 0.1
      });

      expect(result).toEqual({
        reaction,
        sourcePreResistanceDamage: 1_000,
        effectiveResistance: 0.1,
        selfDamageMultiplier: multiplier,
        preResistanceDamage,
        resistanceMultiplier: 0.9,
        ignoreDefense: 1,
        defenseMultiplier: 1,
        finalDamage
      });
      expect(Object.isFrozen(result)).toBe(true);
    }
  );

  it.each([
    ["burning", 0.25, 361.713_375, 325.542_037_5, 326],
    ["bloom", 2, 2_893.707, 52.086_726, 52],
    ["burgeon", 3, 4_340.560_5, 78.130_089, 78],
    ["hyperbloom", 3, 4_340.560_5, 78.130_089, 78]
  ] as const)(
    "locks the level-90 zero-EM %s fixed-reference vector",
    (
      reaction,
      baseMultiplier,
      expectedSource,
      expectedFinal,
      expectedDisplay
    ) => {
      const source = calcTransformativeReactionDamage({
        characterLevel: 90,
        elementalMastery: 0,
        reactionBonus: 0,
        baseMultiplier,
        effectiveResistance: 0
      });
      const result = calcPlayerReactionSelfDamage({
        reaction,
        sourcePreResistanceDamage: source.preResistanceDamage,
        effectiveResistance: 0.1
      });

      expect(source.preResistanceDamage).toBeCloseTo(
        expectedSource,
        12
      );
      expect(result.finalDamage).toBeCloseTo(expectedFinal, 12);
      expect(Math.round(result.finalDamage)).toBe(expectedDisplay);
    }
  );

  it.each([
    [-0.2, 1.1],
    [0, 1],
    [0.1, 0.9],
    [0.749, 0.251],
    [0.75, 0.25],
    [1, 0.2]
  ])(
    "covers the resistance branch at %s",
    (resistance, expected) => {
      expect(
        calcPlayerResistanceMultiplier(resistance)
      ).toBeCloseTo(expected, 15);
    }
  );

  it("rejects unsupported reactions and invalid damage", () => {
    expect(() =>
      calcPlayerReactionSelfDamage({
        reaction: "overload" as PlayerReactionSelfDamageKind,
        sourcePreResistanceDamage: 100,
        effectiveResistance: 0
      })
    ).toThrow(/reaction must be one of/);
    expect(() =>
      calcPlayerReactionSelfDamage({
        reaction: "burning",
        sourcePreResistanceDamage: -1,
        effectiveResistance: 0
      })
    ).toThrow(/sourcePreResistanceDamage must be non-negative/);
  });
});

describe("circular player hit resolution", () => {
  it("uses circle-circle intersection and counts tangency as a hit", () => {
    expect(
      resolveCircularPlayerHit({
        damageCenter: { x: 0, y: 0 },
        damageRadius: 5,
        playerCenter: { x: 3, y: 4 },
        playerRadius: 0
      })
    ).toEqual({
      hit: true,
      distance: 5,
      distanceSquared: 25,
      combinedRadius: 5,
      combinedRadiusSquared: 25
    });

    expect(
      resolveCircularPlayerHit({
        damageCenter: { x: 0, y: 0 },
        damageRadius: 5,
        playerCenter: { x: 5.5, y: 0 },
        playerRadius: 0.5
      }).hit
    ).toBe(true);
  });

  it("misses outside the summed radii", () => {
    expect(
      resolveCircularPlayerHit({
        damageCenter: { x: 0, y: 0 },
        damageRadius: 1,
        playerCenter: { x: 1.500_001, y: 0 },
        playerRadius: 0.5
      }).hit
    ).toBe(false);
  });
});

describe("Crystallize shield absorption", () => {
  it("uses ordinary absorption and conserves base HP when breaking", () => {
    const result = absorbPlayerDamageWithCrystallizeShield({
      incomingDamage: 140,
      incomingElement: "dendro",
      shieldElement: "pyro",
      currentBaseHp: 100
    });

    expect(result).toEqual({
      incomingDamage: 140,
      incomingElement: "dendro",
      shieldElement: "pyro",
      elementalMasteryBonus: 0,
      shieldStrengthBonus: 0,
      absorptionMultiplier: 1,
      effectiveAbsorptionMultiplier: 1,
      baseHpBefore: 100,
      baseHpConsumed: 100,
      baseHpAfter: 0,
      absorptionCapacity: 100,
      absorbedDamage: 100,
      damageAfterShield: 40,
      shieldBroken: true
    });
  });

  it("uses 2.5x matching-element absorption and consumes only equivalent base HP", () => {
    const result = absorbPlayerDamageWithCrystallizeShield({
      incomingDamage: 100,
      incomingElement: "pyro",
      shieldElement: "pyro",
      currentBaseHp: 100
    });

    expect(result).toMatchObject({
      absorptionMultiplier: 2.5,
      effectiveAbsorptionMultiplier: 2.5,
      baseHpConsumed: 40,
      baseHpAfter: 60,
      absorbedDamage: 100,
      damageAfterShield: 0,
      shieldBroken: false
    });
  });

  it("uses 1.5x absorption for incoming Geo damage", () => {
    const result = absorbPlayerDamageWithCrystallizeShield({
      incomingDamage: 150,
      incomingElement: "geo",
      shieldElement: "pyro",
      currentBaseHp: 100
    });

    expect(result).toMatchObject({
      absorptionMultiplier: 1.5,
      effectiveAbsorptionMultiplier: 1.5,
      baseHpConsumed: 100,
      baseHpAfter: 0,
      absorbedDamage: 150,
      damageAfterShield: 0,
      shieldBroken: true
    });
  });

  it("does not infer the Geo multiplier from the shield element", () => {
    expect(
      absorbPlayerDamageWithCrystallizeShield({
        incomingDamage: 100,
        incomingElement: "dendro",
        shieldElement: "geo",
        currentBaseHp: 100
      })
    ).toMatchObject({
      absorptionMultiplier: 1,
      absorbedDamage: 100,
      baseHpAfter: 0
    });
  });

  it("combines EM and shield-strength bonuses while preserving base-HP accounting", () => {
    const result = absorbPlayerDamageWithCrystallizeShield({
      incomingDamage: 75,
      incomingElement: "hydro",
      shieldElement: "pyro",
      currentBaseHp: 100,
      elementalMasteryBonus: 0.25,
      shieldStrengthBonus: 0.25
    });

    expect(result).toMatchObject({
      absorptionMultiplier: 1,
      effectiveAbsorptionMultiplier: 1.5,
      baseHpConsumed: 50,
      baseHpAfter: 50,
      absorbedDamage: 75,
      damageAfterShield: 0
    });
    expect(
      result.baseHpConsumed *
        result.effectiveAbsorptionMultiplier
    ).toBeCloseTo(result.absorbedDamage, 15);
    expect(result.baseHpBefore).toBeCloseTo(
      result.baseHpConsumed + result.baseHpAfter,
      15
    );
  });
});

describe("player HP damage", () => {
  it("applies damage inside the HP range without overkill", () => {
    expect(
      applyPlayerHpDamage({
        currentHp: 500,
        maxHp: 1_000,
        incomingDamage: 200
      })
    ).toEqual({
      inputCurrentHp: 500,
      currentHpBefore: 500,
      currentHpAfter: 300,
      maxHp: 1_000,
      attemptedLoss: 200,
      actualLoss: 200,
      overkill: 0,
      hpRatioBefore: 0.5,
      hpRatioAfter: 0.3
    });
  });

  it("clamps HP first and separates actual loss from overkill", () => {
    expect(
      applyPlayerHpDamage({
        currentHp: 1_250,
        maxHp: 1_000,
        incomingDamage: 1_400
      })
    ).toEqual({
      inputCurrentHp: 1_250,
      currentHpBefore: 1_000,
      currentHpAfter: 0,
      maxHp: 1_000,
      attemptedLoss: 1_400,
      actualLoss: 1_000,
      overkill: 400,
      hpRatioBefore: 1,
      hpRatioAfter: 0
    });
  });

  it("keeps zero-max-HP ratios finite and reports all damage as overkill", () => {
    expect(
      applyPlayerHpDamage({
        currentHp: -10,
        maxHp: 0,
        incomingDamage: 25
      })
    ).toEqual({
      inputCurrentHp: -10,
      currentHpBefore: 0,
      currentHpAfter: 0,
      maxHp: 0,
      attemptedLoss: 25,
      actualLoss: 0,
      overkill: 25,
      hpRatioBefore: 0,
      hpRatioAfter: 0
    });
  });
});
