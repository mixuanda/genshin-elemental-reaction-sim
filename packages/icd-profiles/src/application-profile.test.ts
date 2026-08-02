import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalElementalApplicationPayloadJson,
  ELEMENTAL_APPLICATION_PROFILE_VERSION,
  GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS,
  GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
  GCSIM_ELEMENTAL_APPLICATION_COVERAGE,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_RESET_SCHEDULE_POLICY,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
  GCSIM_ELEMENTAL_APPLICATION_STATE_SCOPE,
  GCSIM_ELEMENTAL_APPLICATION_TAIL_POLICY,
  GCSIM_RESERVED_ELEMENTAL_APPLICATION_GROUP_IDS,
  resolveElementalApplicationGroup,
  resolveElementalApplicationMultiplier,
  resolveElementalApplicationResetAtFrame,
  resolveElementalApplicationResetFrames,
  type PublicGcsimElementalApplicationGroupId
} from "./application-profile";

// Independent compact oracle transcribed from ICDGroup, ICDGroupResetTimer,
// and ICDGroupEleApplicationSequence at the pinned source revision. Sequence
// tokens are deliberately decoded here instead of importing/deriving them from
// the production payload: 0 -> 0, 1 -> 1, N -> Nahida's unique 1.5 value.
const EXPECTED_GROUPS = [
  ["default", "ICDGroupDefault", 150, "100100100100100100100100"],
  [
    "pole-extra-attack",
    "ICDGroupPoleExtraAttack",
    30,
    "100000000000000000000000"
  ],
  ["reaction-a", "ICDGroupReactionA", 30, "1111111111"],
  ["reaction-b", "ICDGroupReactionB", 30, "1111111111"],
  ["burning", "ICDGroupBurning", 120, "10000000"],
  ["aino-burst-moon-hit", "ICDGroupAinoBurstMoonHit", 108, "1000"],
  [
    "alhaitham-extra-attack",
    "ICDGroupAlhaithamExtraAttack",
    120,
    "100000000000000"
  ],
  [
    "alhaitham-projection-attack",
    "ICDGroupAlhaithamProjectionAttack",
    720,
    "101010101010101010101010"
  ],
  ["amber", "ICDGroupAmber", 60, "100100100100100100100100"],
  [
    "arlecchino-elemental-art",
    "ICDGroupArlecchinoElementalArt",
    600,
    "10010010000000000000"
  ],
  [
    "ayaka-extra-attack",
    "ICDGroupAyakaExtraAttack",
    30,
    "100000000000000000000000000"
  ],
  ["baizhu-c2", "ICDGroupBaizhuC2", 240, "10000000000"],
  ["charlotte-kamera", "ICDGroupCharlotteKamera", 240, "10001000"],
  ["charlotte-mark", "ICDGroupCharlotteMark", 720, "1010101010"],
  ["chasca-burst", "ICDGroupChascaBurst", 90, "101010"],
  ["chasca-shadowhunt", "ICDGroupChascaShadowhunt", 90, "10"],
  ["chasca-shining", "ICDGroupChascaShining", 90, "101010"],
  ["chasca-tap", "ICDGroupChascaTap", 90, "10"],
  [
    "chevreuse-burst-mines",
    "ICDGroupChevreuseBurstMines",
    180,
    "10010000"
  ],
  ["chiori-skill", "ICDGroupChioriSkill", 114, "10000"],
  [
    "citlali-frostfall-storm",
    "ICDGroupCitlaliFrostfallStorm",
    90,
    "10"
  ],
  [
    "clorinde-elemental-art",
    "ICDGroupClorindeElementalArt",
    60,
    "100000000000000000000000"
  ],
  ["collei-burst", "ICDGroupColleiBurst", 180, "100000000000"],
  ["cyno-bolt", "ICDGroupCynoBolt", 150, "10000000000"],
  ["diluc", "ICDGroupDiluc", 300, "100001000010000100001000010000"],
  ["dori-burst", "ICDGroupDoriBurst", 180, "100000000000"],
  ["durin-burst-black", "ICDGroupDurinBurstBlack", 120, "10"],
  ["durin-burst-white", "ICDGroupDurinBurstWhite", 90, "10"],
  ["durin-skill", "ICDGroupDurinSkill", 18, "100"],
  ["emilie-lumidouce", "ICDGroupEmilieLumidouce", 120, "10"],
  ["escoffier-skill", "ICDGroupEscoffierSkill", 90, "100000"],
  [
    "fischl",
    "ICDGroupFischl",
    300,
    "10001000100010001000100010001000"
  ],
  [
    "furina-salon-solitaire",
    "ICDGroupFurinaSalonSolitaire",
    1800,
    "101010101010101010101010"
  ],
  ["kinich-loop-shot", "ICDGroupKinichLoopShot", 120, "1000"],
  [
    "kinich-scalespiker-cannon",
    "ICDGroupKinichScalespikerCannon",
    72,
    "1000"
  ],
  [
    "lanyan-ring-attack",
    "ICDGroupLanyanRingAttack",
    150,
    "100100100100100100100100"
  ],
  [
    "lanyan-ring-attack-mix",
    "ICDGroupLanyanRingAttackMix",
    150,
    "100100100100100100100100"
  ],
  ["layla", "ICDGroupLayla", 180, "100000010000"],
  ["lyney-extra", "ICDGroupLyneyExtra", 60, "100000"],
  ["mizuki-skill", "ICDGroupMizukiSkill", 72, "1000"],
  ["nahida-skill", "ICDGroupNahidaSkill", 60, "N0000000000"],
  ["navia-burst", "ICDGroupNaviaBurst", 720, "100100100100100100100100"],
  ["nilou", "ICDGroupNilou", 114, "100010001000"],
  [
    "ororon-elemental-burst",
    "ICDGroupOroronElementalBurst",
    180,
    "1000000"
  ],
  ["sigewinne", "ICDGroupSigewinne", 120, "1000000000000"],
  [
    "sigewinne-burst",
    "ICDGroupSigewinneBurst",
    114,
    "1000000000000"
  ],
  ["tighnari", "ICDGroupTighnari", 150, "100010001000"],
  ["traveler-burst", "ICDGroupTravelerBurst", 480, "100010001000"],
  ["traveler-dewdrop", "ICDGroupTravelerDewdrop", 90, "10000000"],
  ["venti", "ICDGroupVenti", 60, "100100100100100100100100"],
  ["wanderer-a4", "ICDGroupWandererA4", 60, "10000000000000000000"],
  [
    "wanderer-c6",
    "ICDGroupWandererC6",
    120,
    "10000000000000000000"
  ],
  ["xiao-dash", "ICDGroupXiaoDash", 6, "1000000"],
  ["yae-charged", "ICDGroupYaeCharged", 30, "1000000"],
  ["yaoyao-radish-burst", "ICDGroupYaoyaoRadishBurst", 90, "100000"],
  ["yaoyao-radish-skill", "ICDGroupYaoyaoRadishSkill", 150, "100000"],
  ["yelan-breakthrough", "ICDGroupYelanBreakthrough", 18, "1000"],
  ["yelan-burst", "ICDGroupYelanBurst", 120, "100100100100100100100100"]
] as const;

function decodeSequence(token: string): number[] {
  return [...token].map((value) => {
    if (value === "0") return 0;
    if (value === "1") return 1;
    if (value === "N") return 1.5;
    throw new TypeError(`unexpected sequence oracle token: ${value}`);
  });
}

describe("fixed gcsim elemental-application profile", () => {
  it("matches the independent 58-group reset and numeric-sequence oracle", () => {
    expect(EXPECTED_GROUPS).toHaveLength(58);
    expect(GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups).toHaveLength(58);
    expect(GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups).toEqual(
      EXPECTED_GROUPS.map(
        ([id, sourceName, resetFrames, applicationSequence]) => ({
          id,
          sourceName,
          resetFrames,
          applicationSequence: decodeSequence(applicationSequence)
        })
      )
    );

    expect(
      new Set(GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups.map(({ id }) => id))
        .size
    ).toBe(58);
    expect(
      new Set(
        GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups.map(
          ({ sourceName }) => sourceName
        )
      ).size
    ).toBe(58);
  });

  it("pins provenance, tail, reset, state-scope, and provisional metadata", () => {
    expect(GCSIM_ELEMENTAL_APPLICATION_PROFILE).toMatchObject({
      version: ELEMENTAL_APPLICATION_PROFILE_VERSION,
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
      tailPolicy: GCSIM_ELEMENTAL_APPLICATION_TAIL_POLICY,
      resetSchedulePolicy:
        GCSIM_ELEMENTAL_APPLICATION_RESET_SCHEDULE_POLICY,
      stateScope: GCSIM_ELEMENTAL_APPLICATION_STATE_SCOPE,
      provisional: true,
      provenance: {
        mechanicsDataStatus: "fixed-gcsim-provisional",
        sourceProject: "genshinsim/gcsim",
        sourceRevision: GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
        officialServerTruth: false,
        completeGcsimParity: false,
        coverage: GCSIM_ELEMENTAL_APPLICATION_COVERAGE,
        provisional: true
      }
    });
    expect(GCSIM_ELEMENTAL_APPLICATION_ROOT).toMatchObject({
      version: ELEMENTAL_APPLICATION_PROFILE_VERSION,
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
      contentHash: GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
      sourceRevision: GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
      officialServerTruth: false,
      completeGcsimParity: false,
      coverage: GCSIM_ELEMENTAL_APPLICATION_COVERAGE,
      tailPolicy: GCSIM_ELEMENTAL_APPLICATION_TAIL_POLICY,
      resetSchedulePolicy:
        GCSIM_ELEMENTAL_APPLICATION_RESET_SCHEDULE_POLICY,
      stateScope: GCSIM_ELEMENTAL_APPLICATION_STATE_SCOPE,
      provisional: true
    });
  });

  it("restricts numeric values to 0, 1, and Nahida's unique 1.5", () => {
    const entries = GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups.flatMap(
      (group) =>
        group.applicationSequence.map((multiplier, hitCounter) => ({
          groupId: group.id,
          hitCounter,
          multiplier
        }))
    );
    expect(new Set(entries.map(({ multiplier }) => multiplier))).toEqual(
      new Set([0, 1, 1.5])
    );
    expect(entries.filter(({ multiplier }) => multiplier === 1.5)).toEqual([
      { groupId: "nahida-skill", hitCounter: 0, multiplier: 1.5 }
    ]);
  });

  it("keeps engine-owned reaction delivery groups out of public configuration", () => {
    const publicId: PublicGcsimElementalApplicationGroupId = "default";
    expect(publicId).toBe("default");
    expect(GCSIM_RESERVED_ELEMENTAL_APPLICATION_GROUP_IDS).toEqual([
      "reaction-a",
      "reaction-b",
      "burning"
    ]);
    expect(GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS).toHaveLength(
      55
    );
    expect(GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS).not.toContain(
      "reaction-a"
    );
    expect(GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS).not.toContain(
      "reaction-b"
    );
    expect(GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS).not.toContain(
      "burning"
    );

    // @ts-expect-error engine-owned groups are not public configuration IDs
    const invalidPublicId: PublicGcsimElementalApplicationGroupId = "burning";
    expect(invalidPublicId).toBe("burning");
  });

  it("resolves group, numeric multiplier, clamp-last tail, and reset frame", () => {
    expect(resolveElementalApplicationGroup("nahida-skill")).toEqual({
      id: "nahida-skill",
      sourceName: "ICDGroupNahidaSkill",
      resetFrames: 60,
      applicationSequence: [1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    });
    expect(resolveElementalApplicationResetFrames("durin-skill")).toBe(18);
    expect(resolveElementalApplicationMultiplier("default", 0)).toBe(1);
    expect(resolveElementalApplicationMultiplier("default", 1)).toBe(0);
    expect(resolveElementalApplicationMultiplier("default", 3)).toBe(1);
    expect(resolveElementalApplicationMultiplier("nahida-skill", 0)).toBe(
      1.5
    );
    expect(
      resolveElementalApplicationMultiplier(
        "reaction-a",
        Number.MAX_SAFE_INTEGER
      )
    ).toBe(1);
    expect(
      resolveElementalApplicationMultiplier(
        "nahida-skill",
        Number.MAX_SAFE_INTEGER
      )
    ).toBe(0);
    expect(resolveElementalApplicationResetAtFrame("durin-skill", 100)).toBe(
      117
    );
    expect(resolveElementalApplicationResetAtFrame("xiao-dash", 0)).toBe(5);
  });

  it("fails closed for unknown groups and invalid frame/counter inputs", () => {
    expect(() => resolveElementalApplicationGroup("not-a-source-group")).toThrow(
      /unknown elemental-application group/
    );
    expect(() => resolveElementalApplicationResetFrames("")).toThrow(
      RangeError
    );
    expect(() => resolveElementalApplicationMultiplier("default", -1)).toThrow(
      RangeError
    );
    expect(() =>
      resolveElementalApplicationMultiplier("default", 1.5)
    ).toThrow(RangeError);
    expect(() =>
      resolveElementalApplicationMultiplier(
        "default",
        Number.MAX_SAFE_INTEGER + 1
      )
    ).toThrow(RangeError);
    expect(() =>
      resolveElementalApplicationResetAtFrame("default", -1)
    ).toThrow(RangeError);
    expect(() =>
      resolveElementalApplicationResetAtFrame(
        "default",
        Number.MAX_SAFE_INTEGER
      )
    ).toThrow(/safe integer range/);
  });

  it("deep-freezes every payload, root, sequence, and exported ID list", () => {
    expect(Object.isFrozen(GCSIM_ELEMENTAL_APPLICATION_PROFILE)).toBe(true);
    expect(
      Object.isFrozen(GCSIM_ELEMENTAL_APPLICATION_PROFILE.provenance)
    ).toBe(true);
    expect(Object.isFrozen(GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups)).toBe(
      true
    );
    expect(
      GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups.every(
        (group) =>
          Object.isFrozen(group) &&
          Object.isFrozen(group.applicationSequence)
      )
    ).toBe(true);
    expect(Object.isFrozen(GCSIM_ELEMENTAL_APPLICATION_ROOT)).toBe(true);
    expect(
      Object.isFrozen(GCSIM_RESERVED_ELEMENTAL_APPLICATION_GROUP_IDS)
    ).toBe(true);
    expect(
      Object.isFrozen(GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS)
    ).toBe(true);

    expect(() => {
      const mutable = GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups[0]
        .applicationSequence as unknown as number[];
      mutable[0] = 0;
    }).toThrow(TypeError);
    expect(
      GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups[0].applicationSequence[0]
    ).toBe(1);
  });

  it("pins canonical payload bytes and the independently calculated SHA", () => {
    const canonicalPayload = canonicalElementalApplicationPayloadJson();
    expect(JSON.parse(canonicalPayload)).toEqual(
      GCSIM_ELEMENTAL_APPLICATION_PROFILE
    );
    expect(canonicalPayload).toBe(canonicalElementalApplicationPayloadJson());
    expect(canonicalPayload.startsWith('{"groups":')).toBe(true);
    expect(Buffer.byteLength(canonicalPayload)).toBe(7988);
    expect(GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256).toBe(
      "sha256:df461cf8aefee33ec57b8a8f83e2ec26497f17be8bc3ee1e6d667bf91d4015c1"
    );
    expect(
      `sha256:${createHash("sha256")
        .update(canonicalPayload)
        .digest("hex")}`
    ).toBe(GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256);
  });
});
