import { describe, expect, it } from "vitest";
import { targetPhaseV3ResultReferencesSchema } from "./target-phase-v3-integrity";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION
} from "./types";

function resultReferences(
  schemaVersion: string,
  engineVersion: string,
  configSchemaVersion = schemaVersion,
  configEngineVersion = engineVersion
) {
  return {
    schemaVersion,
    engineVersion,
    config: {
      schemaVersion: configSchemaVersion,
      engineVersion: configEngineVersion,
      targetTaskModel: { mode: "target-phase-v2" }
    },
    enemyTargets: [],
    targetPhaseLog: [],
    targetTaskPhaseLog: [],
    burningStateLog: [],
    reactionDamageLog: [],
    hitResolutionLog: [],
    damageEvents: [],
    targetStateTimeline: { points: [] }
  };
}

describe("target-phase-v3 exact result identity", () => {
  it.each([
    [
      BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    ],
    [
      REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      REACTION_FORMULA_ROOT_ENGINE_VERSION
    ],
    [
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    ],
    [
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION
    ]
  ])("accepts the exact %s result/config pair", (schemaVersion, engineVersion) => {
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(
        resultReferences(schemaVersion, engineVersion)
      ).success
    ).toBe(true);
  });

  it.each([
    [
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
      REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      REACTION_FORMULA_ROOT_ENGINE_VERSION
    ],
    [
      REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
      REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    ],
    [
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      "1.46.0-direct-damage-group-root-forged",
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      "1.46.0-direct-damage-group-root-forged"
    ],
    [
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    ],
    [
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    ],
    [
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      "1.47.0-elemental-application-icd-root-forged",
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      "1.47.0-elemental-application-icd-root-forged"
    ]
  ])(
    "rejects a forged or mixed result/config identity %#",
    (
      resultSchemaVersion,
      resultEngineVersion,
      configSchemaVersion,
      configEngineVersion
    ) => {
      const parsed = targetPhaseV3ResultReferencesSchema.safeParse(
        resultReferences(
          resultSchemaVersion,
          resultEngineVersion,
          configSchemaVersion,
          configEngineVersion
        )
      );
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      expect(parsed.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["schemaVersion"],
            message:
              "target-phase-v3 integrity requires an exact 1.44, 1.45, 1.46, or 1.47 schema and engine identity"
          })
        ])
      );
    }
  );
});
