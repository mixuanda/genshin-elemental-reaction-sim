import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalDamageGroupPayloadJson,
  GCSIM_DAMAGE_GROUP_CONTENT_SHA256,
  GCSIM_DAMAGE_GROUP_COVERAGE,
  GCSIM_DAMAGE_GROUP_PROFILE,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_DAMAGE_GROUP_RESET_SCHEDULE_POLICY,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_DAMAGE_GROUP_SOURCE_REVISION,
  GCSIM_DAMAGE_GROUP_TAIL_POLICY,
  resolveDamageGroup,
  resolveDamageGroupMultiplier,
  resolveDamageGroupResetAtFrame,
  resolveDamageGroupResetFrames
} from "./profile";

// Independent oracle transcribed from only ICDGroup, ICDGroupResetTimer, and
// ICDGroupDamageSequence at the pinned source revision. It deliberately does
// not reproduce or assert the elemental-application sequence table.
const EXPECTED_GROUPS = [
  {
    id: "default",
    sourceName: "ICDGroupDefault",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "pole-extra-attack",
    sourceName: "ICDGroupPoleExtraAttack",
    resetFrames: 30,
    damageSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "reaction-a",
    sourceName: "ICDGroupReactionA",
    resetFrames: 30,
    damageSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "reaction-b",
    sourceName: "ICDGroupReactionB",
    resetFrames: 30,
    damageSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "burning",
    sourceName: "ICDGroupBurning",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "aino-burst-moon-hit",
    sourceName: "ICDGroupAinoBurstMoonHit",
    resetFrames: 108,
    damageSequence: [1, 1, 1, 1]
  },
  {
    id: "alhaitham-extra-attack",
    sourceName: "ICDGroupAlhaithamExtraAttack",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "alhaitham-projection-attack",
    sourceName: "ICDGroupAlhaithamProjectionAttack",
    resetFrames: 720,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "amber",
    sourceName: "ICDGroupAmber",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "arlecchino-elemental-art",
    sourceName: "ICDGroupArlecchinoElementalArt",
    resetFrames: 600,
    damageSequence: [1, 1, 1, 1, 1]
  },
  {
    id: "ayaka-extra-attack",
    sourceName: "ICDGroupAyakaExtraAttack",
    resetFrames: 30,
    damageSequence: [
      1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0
    ]
  },
  {
    id: "baizhu-c2",
    sourceName: "ICDGroupBaizhuC2",
    resetFrames: 240,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "charlotte-kamera",
    sourceName: "ICDGroupCharlotteKamera",
    resetFrames: 240,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "charlotte-mark",
    sourceName: "ICDGroupCharlotteMark",
    resetFrames: 720,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "chasca-burst",
    sourceName: "ICDGroupChascaBurst",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "chasca-shadowhunt",
    sourceName: "ICDGroupChascaShadowhunt",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "chasca-shining",
    sourceName: "ICDGroupChascaShining",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "chasca-tap",
    sourceName: "ICDGroupChascaTap",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "chevreuse-burst-mines",
    sourceName: "ICDGroupChevreuseBurstMines",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "chiori-skill",
    sourceName: "ICDGroupChioriSkill",
    resetFrames: 114,
    damageSequence: [1, 1, 1, 1, 1]
  },
  {
    id: "citlali-frostfall-storm",
    sourceName: "ICDGroupCitlaliFrostfallStorm",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "clorinde-elemental-art",
    sourceName: "ICDGroupClorindeElementalArt",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "collei-burst",
    sourceName: "ICDGroupColleiBurst",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "cyno-bolt",
    sourceName: "ICDGroupCynoBolt",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "diluc",
    sourceName: "ICDGroupDiluc",
    resetFrames: 300,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "dori-burst",
    sourceName: "ICDGroupDoriBurst",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "durin-burst-black",
    sourceName: "ICDGroupDurinBurstBlack",
    resetFrames: 120,
    damageSequence: [1, 1]
  },
  {
    id: "durin-burst-white",
    sourceName: "ICDGroupDurinBurstWhite",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "durin-skill",
    sourceName: "ICDGroupDurinSkill",
    resetFrames: 18,
    damageSequence: [1, 1, 1]
  },
  {
    id: "emilie-lumidouce",
    sourceName: "ICDGroupEmilieLumidouce",
    resetFrames: 120,
    damageSequence: [1, 1]
  },
  {
    id: "escoffier-skill",
    sourceName: "ICDGroupEscoffierSkill",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1]
  },
  {
    id: "fischl",
    sourceName: "ICDGroupFischl",
    resetFrames: 300,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "furina-salon-solitaire",
    sourceName: "ICDGroupFurinaSalonSolitaire",
    resetFrames: 1800,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "kinich-loop-shot",
    sourceName: "ICDGroupKinichLoopShot",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "kinich-scalespiker-cannon",
    sourceName: "ICDGroupKinichScalespikerCannon",
    resetFrames: 72,
    damageSequence: [1, 1, 1, 1]
  },
  {
    id: "lanyan-ring-attack",
    sourceName: "ICDGroupLanyanRingAttack",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "lanyan-ring-attack-mix",
    sourceName: "ICDGroupLanyanRingAttackMix",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "layla",
    sourceName: "ICDGroupLayla",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "lyney-extra",
    sourceName: "ICDGroupLyneyExtra",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "mizuki-skill",
    sourceName: "ICDGroupMizukiSkill",
    resetFrames: 72,
    damageSequence: [1, 1, 1, 1]
  },
  {
    id: "nahida-skill",
    sourceName: "ICDGroupNahidaSkill",
    resetFrames: 60,
    damageSequence: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    ]
  },
  {
    id: "navia-burst",
    sourceName: "ICDGroupNaviaBurst",
    resetFrames: 720,
    damageSequence: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1
    ]
  },
  {
    id: "nilou",
    sourceName: "ICDGroupNilou",
    resetFrames: 114,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "ororon-elemental-burst",
    sourceName: "ICDGroupOroronElementalBurst",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "sigewinne",
    sourceName: "ICDGroupSigewinne",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "sigewinne-burst",
    sourceName: "ICDGroupSigewinneBurst",
    resetFrames: 114,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "tighnari",
    sourceName: "ICDGroupTighnari",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "traveler-burst",
    sourceName: "ICDGroupTravelerBurst",
    resetFrames: 480,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "traveler-dewdrop",
    sourceName: "ICDGroupTravelerDewdrop",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "venti",
    sourceName: "ICDGroupVenti",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "wanderer-a4",
    sourceName: "ICDGroupWandererA4",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "wanderer-c6",
    sourceName: "ICDGroupWandererC6",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "xiao-dash",
    sourceName: "ICDGroupXiaoDash",
    resetFrames: 6,
    damageSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "yae-charged",
    sourceName: "ICDGroupYaeCharged",
    resetFrames: 30,
    damageSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "yaoyao-radish-burst",
    sourceName: "ICDGroupYaoyaoRadishBurst",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "yaoyao-radish-skill",
    sourceName: "ICDGroupYaoyaoRadishSkill",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "yelan-breakthrough",
    sourceName: "ICDGroupYelanBreakthrough",
    resetFrames: 18,
    damageSequence: [1, 0, 0, 0]
  },
  {
    id: "yelan-burst",
    sourceName: "ICDGroupYelanBurst",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  }
] as const;

describe("gcsim direct-damage group profile", () => {
  it("pins provisional source identity and explicitly limited coverage", () => {
    expect(GCSIM_DAMAGE_GROUP_PROFILE_ID).toBe(
      "gcsim-b4ae769-damage-groups-provisional-v1"
    );
    expect(GCSIM_DAMAGE_GROUP_SOURCE_REVISION).toBe(
      "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"
    );
    expect(GCSIM_DAMAGE_GROUP_COVERAGE).toBe(
      "damage-group-reset-and-damage-sequences-only"
    );
    expect(GCSIM_DAMAGE_GROUP_TAIL_POLICY).toBe("clamp-last");
    expect(GCSIM_DAMAGE_GROUP_RESET_SCHEDULE_POLICY).toBe(
      "window-start-plus-reset-frames-minus-one"
    );
    expect(GCSIM_DAMAGE_GROUP_PROFILE).toMatchObject({
      tailPolicy: "clamp-last",
      resetSchedulePolicy: "window-start-plus-reset-frames-minus-one"
    });
    expect(GCSIM_DAMAGE_GROUP_PROFILE.provenance).toEqual({
      mechanicsDataStatus: "fixed-gcsim-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
      officialServerTruth: false,
      completeGcsimParity: false,
      coverage: "damage-group-reset-and-damage-sequences-only"
    });
    expect(GCSIM_DAMAGE_GROUP_ROOT).toEqual({
      version: "1.0.0",
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      contentHash: GCSIM_DAMAGE_GROUP_CONTENT_SHA256,
      mechanicsDataStatus: "fixed-gcsim-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
      officialServerTruth: false,
      completeGcsimParity: false,
      coverage: "damage-group-reset-and-damage-sequences-only",
      tailPolicy: "clamp-last",
      resetSchedulePolicy: "window-start-plus-reset-frames-minus-one"
    });
  });

  it("matches all 58 source reset timers and damage sequences", () => {
    expect(EXPECTED_GROUPS).toHaveLength(58);
    expect(GCSIM_DAMAGE_GROUP_PROFILE.groups).toHaveLength(58);
    expect(GCSIM_DAMAGE_GROUP_PROFILE.groups).toEqual(EXPECTED_GROUPS);

    for (const expected of EXPECTED_GROUPS) {
      expect(resolveDamageGroup(expected.id)).toEqual(expected);
      expect(resolveDamageGroupResetFrames(expected.id)).toBe(
        expected.resetFrames
      );
      expected.damageSequence.forEach((multiplier, hitCounter) => {
        expect(resolveDamageGroupMultiplier(expected.id, hitCounter)).toBe(
          multiplier
        );
      });
    }
  });

  it("keeps stable kebab-case IDs and unique source enum names", () => {
    const groups = GCSIM_DAMAGE_GROUP_PROFILE.groups;
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    expect(new Set(groups.map((group) => group.sourceName)).size).toBe(
      groups.length
    );
    expect(groups.every((group) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id)))
      .toBe(true);
    expect(groups.every((group) => /^ICDGroup[A-Za-z0-9]+$/.test(group.sourceName)))
      .toBe(true);
  });

  it("contains zero-valued and all-one groups without importing Aura ICD", () => {
    expect(resolveDamageGroup("reaction-a").damageSequence).toEqual([
      1, 1, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    expect(resolveDamageGroup("default").damageSequence.every((value) => value === 1))
      .toBe(true);
    for (const group of GCSIM_DAMAGE_GROUP_PROFILE.groups) {
      expect(Object.keys(group).sort()).toEqual([
        "damageSequence",
        "id",
        "resetFrames",
        "sourceName"
      ]);
    }
    expect(canonicalDamageGroupPayloadJson()).not.toContain(
      "EleApplicationSequence"
    );
    expect(canonicalDamageGroupPayloadJson()).not.toContain(
      "elementApplication"
    );
  });

  it("uses the last multiplier after the stored sequence", () => {
    expect(resolveDamageGroupMultiplier("reaction-a", 0)).toBe(1);
    expect(resolveDamageGroupMultiplier("reaction-a", 1)).toBe(1);
    expect(resolveDamageGroupMultiplier("reaction-a", 2)).toBe(0);
    expect(resolveDamageGroupMultiplier("reaction-a", 9)).toBe(0);
    expect(resolveDamageGroupMultiplier("reaction-a", 10)).toBe(0);
    expect(resolveDamageGroupMultiplier("reaction-a", 10_000)).toBe(0);
    expect(resolveDamageGroupMultiplier("default", 10_000)).toBe(1);
  });

  it("binds the reset-minus-one schedule and inclusive reset ordering", () => {
    expect(resolveDamageGroupResetAtFrame("default", 0)).toBe(149);
    expect(resolveDamageGroupResetAtFrame("default", 300)).toBe(449);
    expect(resolveDamageGroupResetAtFrame("xiao-dash", 20)).toBe(25);
    expect(() => resolveDamageGroupResetAtFrame("default", -1)).toThrow(
      RangeError
    );
    expect(() => resolveDamageGroupResetAtFrame("default", 0.5)).toThrow(
      RangeError
    );
    expect(() =>
      resolveDamageGroupResetAtFrame("default", Number.MAX_SAFE_INTEGER)
    ).toThrow(/safe integer range/);
  });

  it("fails closed for unknown groups and invalid counters", () => {
    expect(() => resolveDamageGroup("not-a-source-group")).toThrow(
      /unknown damage group/
    );
    expect(() => resolveDamageGroupResetFrames("")).toThrow(RangeError);
    expect(() => resolveDamageGroupMultiplier("default", -1)).toThrow(
      RangeError
    );
    expect(() => resolveDamageGroupMultiplier("default", 1.5)).toThrow(
      RangeError
    );
    expect(() =>
      resolveDamageGroupMultiplier("default", Number.MAX_SAFE_INTEGER + 1)
    ).toThrow(RangeError);
  });

  it("deep-freezes every payload and root layer", () => {
    expect(Object.isFrozen(GCSIM_DAMAGE_GROUP_PROFILE)).toBe(true);
    expect(Object.isFrozen(GCSIM_DAMAGE_GROUP_PROFILE.provenance)).toBe(true);
    expect(Object.isFrozen(GCSIM_DAMAGE_GROUP_PROFILE.groups)).toBe(true);
    expect(
      GCSIM_DAMAGE_GROUP_PROFILE.groups.every(
        (group) =>
          Object.isFrozen(group) && Object.isFrozen(group.damageSequence)
      )
    ).toBe(true);
    expect(Object.isFrozen(GCSIM_DAMAGE_GROUP_ROOT)).toBe(true);

    expect(() => {
      const mutable = GCSIM_DAMAGE_GROUP_PROFILE.groups[0]
        .damageSequence as unknown as number[];
      mutable[0] = 0;
    }).toThrow(TypeError);
    expect(GCSIM_DAMAGE_GROUP_PROFILE.groups[0].damageSequence[0]).toBe(1);
  });

  it("pins canonical payload bytes and the independently calculated SHA", () => {
    const canonicalPayload = canonicalDamageGroupPayloadJson();
    expect(JSON.parse(canonicalPayload)).toEqual(GCSIM_DAMAGE_GROUP_PROFILE);
    expect(canonicalPayload).toBe(canonicalDamageGroupPayloadJson());
    expect(canonicalPayload.startsWith('{"groups":')).toBe(true);
    expect(Buffer.byteLength(canonicalPayload)).toBe(7296);
    expect(GCSIM_DAMAGE_GROUP_CONTENT_SHA256).toBe(
      "sha256:7e6d16a2a90ac7d9bb84daa80c43f09d28fb65e45319c62f67d14c50bb5e9c70"
    );
    expect(
      `sha256:${createHash("sha256")
        .update(canonicalPayload)
        .digest("hex")}`
    ).toBe(GCSIM_DAMAGE_GROUP_CONTENT_SHA256);
  });
});
