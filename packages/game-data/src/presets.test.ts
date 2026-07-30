import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION
} from "@genshin-dps-lab/schemas";
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

describe("game-data preset engine identity", () => {
  it("propagates the exact 1.42 identity without opting built-in presets into aura-v9 or nearby Electro-Charged propagation", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe("1.42.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.42.0-ec-global-cadence-safety"
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
