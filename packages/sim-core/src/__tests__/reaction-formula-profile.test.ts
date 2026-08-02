import { describe, expect, it } from "vitest";
import {
  CLASSIC_REACTION_FORMULA_PROFILE,
  CLASSIC_REACTION_FORMULA_PROFILE_ID
} from "@genshin-dps-lab/reaction-formulas";
import { AURA_ENGINE_CONSTANTS, AuraEngine } from "../aura";
import { DENDRO_CORE_CONSTANTS } from "../dendro-core";
import {
  calcAdditiveReactionDamage,
  calcAmplifyingReactionMultiplier,
  calcResistanceMultiplier,
  calcTransformativeReactionDamage,
  TRANSFORMATIVE_REACTION_LEVEL_BASE
} from "../formulas";
import {
  assertFormulaBoundDamagePluginChanges,
  type DamagePluginChanges
} from "../plugins";

/**
 * Independent transcription of the fixed gcsim b4ae769 reaction level table.
 * This is deliberately not computed through the production profile helpers:
 * it is the sim-core binding oracle for levels 1–100. The fixed reference is
 * provisional mechanics data, not a claim of official live-server truth.
 */
const LEVEL_BASE_ORACLE = [
  17.165606,
  18.535048,
  19.904854,
  21.274902,
  22.6454,
  24.649612,
  26.640642,
  28.868587,
  31.36768,
  34.143345,
  37.201,
  40.66,
  44.446667,
  48.56352,
  53.74848,
  59.081898,
  64.420044,
  69.72446,
  75.12314,
  80.58478,
  86.11203,
  91.70374,
  97.24463,
  102.812645,
  108.40956,
  113.20169,
  118.102905,
  122.97932,
  129.72733,
  136.29291,
  142.67085,
  149.02902,
  155.41699,
  161.8255,
  169.10631,
  176.51808,
  184.07274,
  191.70952,
  199.55692,
  207.38205,
  215.3989,
  224.16566,
  233.50217,
  243.35057,
  256.06308,
  268.5435,
  281.52606,
  295.01364,
  309.0672,
  323.6016,
  336.75754,
  350.5303,
  364.4827,
  378.61917,
  398.6004,
  416.39825,
  434.387,
  452.95105,
  472.60623,
  492.8849,
  513.56854,
  539.1032,
  565.51056,
  592.53876,
  624.4434,
  651.47015,
  679.4968,
  707.79407,
  736.67145,
  765.64026,
  794.7734,
  824.67737,
  851.1578,
  877.74207,
  914.2291,
  946.74677,
  979.4114,
  1011.223,
  1044.7917,
  1077.4437,
  1109.9976,
  1142.9766,
  1176.3695,
  1210.1844,
  1253.8357,
  1288.9528,
  1325.4841,
  1363.4569,
  1405.0974,
  1446.8535,
  1462.788,
  1475.6956,
  1497.9644,
  1516.9423,
  1561.468,
  1593.5062,
  1621.0258,
  1643.8679,
  1662.1382,
  1674.8092
] as const;

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

describe("classic reaction formula profile bindings", () => {
  it("binds every level 1-100 base to an independent fixed-reference oracle", () => {
    expect([...TRANSFORMATIVE_REACTION_LEVEL_BASE]).toEqual(
      LEVEL_BASE_ORACLE
    );
    expect(
      TRANSFORMATIVE_REACTION_LEVEL_BASE
    ).toBe(CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel);
  });

  it.each([
    ["none", 1],
    ["melt", 2],
    ["reverseMelt", 1.5],
    ["vaporize", 2],
    ["reverseVaporize", 1.5]
  ] as const)("binds %s to amplifying base %s", (reaction, expected) => {
    expect(
      calcAmplifyingReactionMultiplier({
        reaction,
        elementalMastery: 0,
        reactionBonus: 0
      })
    ).toEqual({
      base: expected,
      elementalMasteryBonus: 0,
      reactionBonus: 0,
      total: expected
    });
  });

  it("preserves the independent EM, additive, and resistance oracles", () => {
    const amplifying = calcAmplifyingReactionMultiplier({
      reaction: "melt",
      elementalMastery: 100,
      reactionBonus: 0.2
    });
    const transformative = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 2.75,
      effectiveResistance: -0.2
    });
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

    const amplifyingEmOracle = (2.78 * 100) / (1400 + 100);
    const transformativeEmOracle = (16 * 100) / (2000 + 100);
    const additiveEmOracle = (5 * 100) / (1200 + 100);
    expect(amplifying.elementalMasteryBonus).toBeCloseTo(
      amplifyingEmOracle,
      15
    );
    expect(amplifying.total).toBeCloseTo(
      2 * (1 + amplifyingEmOracle + 0.2),
      15
    );
    expect(transformative.elementalMasteryBonus).toBeCloseTo(
      transformativeEmOracle,
      15
    );
    expect(transformative.resistanceMultiplier).toBeCloseTo(1.1, 15);
    expect(transformative.finalDamage).toBeCloseTo(
      1446.8535 *
        2.75 *
        (1 + transformativeEmOracle + 0.2) *
        1.1,
      10
    );
    expect(aggravate.baseMultiplier).toBe(1.15);
    expect(aggravate.flatDamage).toBeCloseTo(
      1446.8535 * 1.15 * (1 + additiveEmOracle + 0.2),
      10
    );
    expect(spread.baseMultiplier).toBe(1.25);
    expect(spread.flatDamage).toBeCloseTo(
      1446.8535 * 1.25 * (1 + additiveEmOracle + 0.2),
      10
    );

    expect(calcResistanceMultiplier(-0.2)).toBeCloseTo(1.1, 15);
    expect(calcResistanceMultiplier(0.1)).toBeCloseTo(0.9, 15);
    expect(calcResistanceMultiplier(0.75)).toBeCloseTo(0.25, 15);
    expect(calcResistanceMultiplier(1)).toBeCloseTo(0.2, 15);
  });

  it("binds every non-Swirl transformative base used by Aura and Dendro cores", () => {
    expect(AURA_ENGINE_CONSTANTS).toMatchObject({
      overloadBaseMultiplier: 2.75,
      superconductBaseMultiplier: 1.5,
      electroChargedBaseMultiplier: 2,
      burningBaseMultiplier: 0.25,
      shatterBaseMultiplier: 3
    });
    expect(DENDRO_CORE_CONSTANTS).toMatchObject({
      bloomMultiplier: 2,
      burgeonMultiplier: 3,
      hyperbloomMultiplier: 3
    });
  });

  it.each([
    ["pyro", "swirlPyro", 0.6],
    ["hydro", "swirlHydro", 0],
    ["cryo", "swirlCryo", 0.6],
    ["electro", "swirlElectro", 0.6]
  ] as const)(
    "binds %s Swirl self and propagation bases",
    (element, reaction, propagationBaseMultiplier) => {
      const audit = new AuraEngine({
        mode: "aura-v9",
        initialAura: [{ element, gaugeUnits: 1 }]
      }).processHit({
        frame: 0,
        sourceActorId: "anemo",
        element: "anemo",
        application: noIcd()
      });

      expect(audit.swirlReactions).toHaveLength(1);
      expect(audit.swirlReactions[0]).toMatchObject({
        reaction,
        selfBaseMultiplier: 0.6,
        propagationBaseMultiplier
      });
    }
  );

  it("rejects formula-field plugin overrides without removing the legacy type", () => {
    const safe: DamagePluginChanges = { damageBonus: 0.2 };
    expect(() =>
      assertFormulaBoundDamagePluginChanges(safe, "safe")
    ).not.toThrow();
    expect(() =>
      assertFormulaBoundDamagePluginChanges(
        { reaction: "melt" },
        "reaction-override"
      )
    ).toThrow(/cannot override formula-bound field "reaction"/);
    expect(() =>
      assertFormulaBoundDamagePluginChanges(
        { explicitReactionBase: 20 },
        "base-override"
      )
    ).toThrow(
      /cannot override formula-bound field "explicitReactionBase"/
    );
  });

  it("keeps the fixed reference explicitly provisional", () => {
    expect(CLASSIC_REACTION_FORMULA_PROFILE.profileId).toBe(
      CLASSIC_REACTION_FORMULA_PROFILE_ID
    );
    expect(CLASSIC_REACTION_FORMULA_PROFILE.provenance).toMatchObject({
      mechanicsDataStatus: "fixed-gcsim-provisional",
      officialServerTruth: false,
      completeGcsimParity: false
    });
  });
});
