import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  calcAdditiveEmBonus,
  calcAmplifyingEmBonus,
  calcReactionResistanceMultiplier,
  calcTransformativeEmBonus,
  canonicalReactionFormulaPayloadJson,
  CLASSIC_REACTION_FORMULA_CONTENT_SHA256,
  CLASSIC_REACTION_FORMULA_PROFILE,
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT,
  CLASSIC_REACTION_FORMULA_SOURCE_REVISION,
  resolveAdditiveBaseMultiplier,
  resolveAmplifyingBaseMultiplier,
  resolveReactionLevelBase,
  resolveTransformativeBaseMultiplier
} from "./profile";

const EXPECTED_LEVEL_BASE_DAMAGE_BY_LEVEL = [
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

describe("classic reaction formula profile", () => {
  it("pins its provisional gcsim provenance without claiming server truth", () => {
    expect(CLASSIC_REACTION_FORMULA_PROFILE_ID).toBe(
      "gcsim-b4ae769-classic-provisional-v1"
    );
    expect(CLASSIC_REACTION_FORMULA_SOURCE_REVISION).toBe(
      "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
    );
    expect(CLASSIC_REACTION_FORMULA_PROFILE.provenance).toEqual({
      mechanicsDataStatus: "fixed-gcsim-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision:
        "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
      officialServerTruth: false,
      completeGcsimParity: false
    });
    expect(CLASSIC_REACTION_FORMULA_ROOT).toMatchObject({
      version: "1.0.0",
      profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID,
      contentHash: CLASSIC_REACTION_FORMULA_CONTENT_SHA256,
      mechanicsDataStatus: "fixed-gcsim-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision:
        "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
      officialServerTruth: false,
      completeGcsimParity: false
    });
  });

  it("keeps the complete level 1-100 table byte-for-value compatible", () => {
    const table =
      CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel;
    expect(table).toHaveLength(100);
    expect(table).toEqual(EXPECTED_LEVEL_BASE_DAMAGE_BY_LEVEL);
    expect(table.every((value) => Number.isFinite(value) && value > 0)).toBe(
      true
    );
    expect(resolveReactionLevelBase(1)).toBe(17.165606);
    expect(resolveReactionLevelBase(90)).toBe(1446.8535);
    expect(resolveReactionLevelBase(100)).toBe(1674.8092);
    expect(() => resolveReactionLevelBase(0)).toThrow(RangeError);
    expect(() => resolveReactionLevelBase(100.5)).toThrow(RangeError);
    expect(() => resolveReactionLevelBase(101)).toThrow(RangeError);
  });

  it("pins classic amplifying, transformative, Swirl, and additive bases", () => {
    expect(CLASSIC_REACTION_FORMULA_PROFILE.amplifyingBaseMultipliers).toEqual(
      {
        none: 1,
        melt: 2,
        reverseMelt: 1.5,
        vaporize: 2,
        reverseVaporize: 1.5
      }
    );
    expect(
      CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers
    ).toEqual({
      overload: 2.75,
      superconduct: 1.5,
      electroCharged: 2,
      burning: 0.25,
      shatter: 3,
      swirlPyro: 0.6,
      swirlHydro: 0.6,
      swirlCryo: 0.6,
      swirlElectro: 0.6,
      bloom: 2,
      burgeon: 3,
      hyperbloom: 3
    });
    expect(
      CLASSIC_REACTION_FORMULA_PROFILE.swirlPropagationBaseMultipliers
    ).toEqual({
      swirlPyro: 0.6,
      swirlHydro: 0,
      swirlCryo: 0.6,
      swirlElectro: 0.6
    });
    expect(CLASSIC_REACTION_FORMULA_PROFILE.additiveBaseMultipliers).toEqual({
      aggravate: 1.15,
      spread: 1.25
    });

    expect(resolveAmplifyingBaseMultiplier("melt")).toBe(2);
    expect(resolveTransformativeBaseMultiplier("superconduct")).toBe(1.5);
    expect(resolveTransformativeBaseMultiplier("swirlHydro")).toBe(0.6);
    expect(
      resolveTransformativeBaseMultiplier("swirlHydro", "propagation")
    ).toBe(0);
    expect(() =>
      resolveTransformativeBaseMultiplier("overload", "propagation")
    ).toThrow(RangeError);
    expect(resolveAdditiveBaseMultiplier("spread")).toBe(1.25);
  });

  it("pins semantic IDs and evaluates their classic formula branches", () => {
    expect(CLASSIC_REACTION_FORMULA_PROFILE.semanticIds).toEqual({
      amplifyingElementalMasteryBonus:
        "genshin-amplifying-em-max0-2p78-em-over-1400-plus-em-v1",
      transformativeElementalMasteryBonus:
        "genshin-transformative-em-max0-16-em-over-2000-plus-em-v1",
      additiveElementalMasteryBonus:
        "genshin-additive-em-max0-5-em-over-1200-plus-em-v1",
      resistanceMultiplier:
        "genshin-resistance-three-branch-lt0-half-lt0p75-linear-gte0p75-reciprocal-v1"
    });
    expect(calcAmplifyingEmBonus(-1)).toBe(0);
    expect(calcAmplifyingEmBonus(1400)).toBe(1.39);
    expect(calcTransformativeEmBonus(2000)).toBe(8);
    expect(calcAdditiveEmBonus(1200)).toBe(2.5);
    expect(calcReactionResistanceMultiplier(-0.1)).toBe(1.05);
    expect(calcReactionResistanceMultiplier(0.1)).toBe(0.9);
    expect(calcReactionResistanceMultiplier(0.75)).toBe(0.25);
    expect(() => calcAmplifyingEmBonus(Number.NaN)).toThrow(RangeError);
    expect(() => calcReactionResistanceMultiplier(Infinity)).toThrow(
      RangeError
    );
  });

  it("deep-freezes the payload and root", () => {
    expect(Object.isFrozen(CLASSIC_REACTION_FORMULA_PROFILE)).toBe(true);
    expect(
      Object.isFrozen(
        CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel
      )
    ).toBe(true);
    expect(
      Object.isFrozen(
        CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers
      )
    ).toBe(true);
    expect(Object.isFrozen(CLASSIC_REACTION_FORMULA_PROFILE.semanticIds)).toBe(
      true
    );
    expect(Object.isFrozen(CLASSIC_REACTION_FORMULA_ROOT)).toBe(true);
  });

  it("matches the literal SHA-256 of the canonical payload", () => {
    const canonicalPayload = canonicalReactionFormulaPayloadJson();
    expect(JSON.parse(canonicalPayload)).toEqual(
      CLASSIC_REACTION_FORMULA_PROFILE
    );
    expect(canonicalPayload).toBe(canonicalReactionFormulaPayloadJson());
    expect(canonicalPayload.startsWith('{"additiveBaseMultipliers":')).toBe(
      true
    );
    expect(CLASSIC_REACTION_FORMULA_CONTENT_SHA256).toMatch(
      /^sha256:[0-9a-f]{64}$/
    );
    expect(
      `sha256:${createHash("sha256")
        .update(canonicalPayload)
        .digest("hex")}`
    ).toBe(CLASSIC_REACTION_FORMULA_CONTENT_SHA256);
  });
});
