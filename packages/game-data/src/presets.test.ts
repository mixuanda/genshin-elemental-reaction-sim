import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION
} from "@genshin-dps-lab/schemas";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID
} from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";
import {
  auraReactionDemoPreset,
  blankPreset,
  durinMeltPreset,
  legalTimelineDemoPreset,
  particleEnergyDemoPreset
} from "./presets";

const presets = [
  durinMeltPreset,
  blankPreset,
  legalTimelineDemoPreset,
  auraReactionDemoPreset,
  particleEnergyDemoPreset
];

const EXPECTED_REACTION_FORMULA_MODEL = {
  mode: "classic-formula-profile-v1",
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
} as const;

describe("game-data preset engine identity", () => {
  it("propagates the exact 1.45 formula-root identity without opting built-in presets into unrelated mechanics modes", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe("1.45.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.45.0-reaction-formula-root"
    );

    for (const preset of presets) {
      expect(
        [preset.schemaVersion, preset.engineVersion],
        preset.meta.name
      ).toEqual([
        CURRENT_SCHEMA_VERSION,
        CURRENT_ENGINE_VERSION
      ]);
      expect(
        preset.reactionFormulaModel,
        preset.meta.name
      ).toEqual(EXPECTED_REACTION_FORMULA_MODEL);
      expect(
        preset.reactionEngine?.mode,
        preset.meta.name
      ).not.toBe("aura-v9");
      expect(preset.targetTaskModel).toEqual({
        mode: "legacy-event-heap-v1"
      });
      expect(preset.reactionDeliveryModel).toEqual({
        mode: "deferred-event-heap-v1"
      });
      expect(preset.electroChargedPropagationModel).toEqual({
        mode: "single-target-v1"
      });
    }
  });
});
