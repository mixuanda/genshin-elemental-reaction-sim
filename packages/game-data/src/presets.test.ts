import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_PROFILE_ID } from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";
import {
  auraReactionDemoPreset,
  blankPreset,
  durinMeltPreset,
  legalTimelineDemoPreset,
  particleEnergyDemoPreset,
} from "./presets";

const presets = [
  durinMeltPreset,
  blankPreset,
  legalTimelineDemoPreset,
  auraReactionDemoPreset,
  particleEnergyDemoPreset,
];

const EXPECTED_REACTION_FORMULA_MODEL = {
  mode: "classic-formula-profile-v1",
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID,
} as const;

const EXPECTED_DIRECT_DAMAGE_GROUP_MODEL = {
  mode: "fixed-gcsim-direct-damage-group-v1",
  profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
} as const;

const EXPECTED_ELEMENTAL_APPLICATION_ICD_MODEL = {
  mode: "fixed-gcsim-elemental-application-v1",
  profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
} as const;

const EXPECTED_REACTION_OWNED_ELEMENTAL_APPLICATION_MODEL = {
  mode: "fixed-gcsim-reaction-owned-application-v2",
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
} as const;

const EXPECTED_BASIC_REACTION_SCHEDULER_MODEL = {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2",
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
} as const;

describe("game-data preset engine identity", () => {
  it("propagates the exact current mechanics-root identities without opting built-in presets into unrelated mechanics modes", () => {
    expect(REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION).toBe("1.50.0");
    expect(REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION).toBe(
      "1.50.0-reaction-damage-reset-boundary",
    );
    expect(CURRENT_SCHEMA_VERSION).toBe("1.51.0");
    expect(CURRENT_ENGINE_VERSION).toBe("1.51.0-basic-reaction-scheduler");
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT).toMatchObject({
      version: "2.0.0",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
      contentHash:
        "sha256:9b3b07731d49ebf8abb445708c3edb99b3ce8c3c7465ce5ca02b0a7c8092a660",
      provisional: true,
      officialServerTruth: false,
      completeGcsimParity: false,
    });

    for (const preset of presets) {
      expect(
        [preset.schemaVersion, preset.engineVersion],
        preset.meta.name,
      ).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_ENGINE_VERSION]);
      expect(preset.reactionFormulaModel, preset.meta.name).toEqual(
        EXPECTED_REACTION_FORMULA_MODEL,
      );
      expect(preset.directDamageGroupModel, preset.meta.name).toEqual(
        EXPECTED_DIRECT_DAMAGE_GROUP_MODEL,
      );
      expect(preset.elementalApplicationIcdModel, preset.meta.name).toEqual(
        EXPECTED_ELEMENTAL_APPLICATION_ICD_MODEL,
      );
      expect(
        preset.reactionOwnedElementalApplicationModel,
        preset.meta.name,
      ).toEqual(EXPECTED_REACTION_OWNED_ELEMENTAL_APPLICATION_MODEL);
      expect(preset.basicReactionSchedulerModel, preset.meta.name).toEqual(
        EXPECTED_BASIC_REACTION_SCHEDULER_MODEL,
      );
      expect(preset.reactionEngine?.mode, preset.meta.name).not.toBe("aura-v9");
      expect(preset.targetTaskModel).toEqual({
        mode: "legacy-event-heap-v1",
      });
      expect(preset.reactionDeliveryModel).toEqual({
        mode: "deferred-event-heap-v1",
      });
      expect(preset.electroChargedPropagationModel).toEqual({
        mode: "single-target-v1",
      });
    }
  });

  it("uses explicit current selectors for no-ICD and fixed default application", () => {
    const applications = auraReactionDemoPreset.timeline?.abilities.flatMap(
      (ability) =>
        (ability.hits ?? []).flatMap((hit) =>
          hit.application === undefined ? [] : [hit.application],
        ),
    );

    expect(applications).toEqual([
      {
        gaugeUnits: 1,
        icd: { mode: "no-icd-v1" },
      },
      ...Array.from({ length: 4 }, () => ({
        gaugeUnits: 1,
        icd: {
          mode: "fixed-gcsim-application-v1",
          icdTag: "m3-pyro-multihit",
          groupId: "default",
        },
      })),
    ]);
  });

  it("does not mislabel provisional preset hits as verified ordinary direct-damage groups", () => {
    for (const preset of presets) {
      const hits = [
        ...preset.rotation.flatMap((action) => action.hits ?? []),
        ...(preset.timeline?.abilities.flatMap(
          (ability) => ability.hits ?? [],
        ) ?? []),
      ];

      for (const hit of hits) {
        expect(
          hit,
          `${preset.meta.name}: ${hit.id ?? hit.label}`,
        ).not.toHaveProperty("directDamageGroup");
      }
    }
  });

  it("keeps the compatibility Durin preset explicitly provisional", () => {
    expect(durinMeltPreset.dataVersion).toBe("0.1.0-demo");
    expect(durinMeltPreset.meta.verificationStatus).toBe("provisional");
    expect(durinMeltPreset.meta.note).toContain("示例魔法数");
  });
});
