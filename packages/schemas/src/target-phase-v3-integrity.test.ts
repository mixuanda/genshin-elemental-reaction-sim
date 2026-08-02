import { describe, expect, it } from "vitest";
import {
  collectTargetPhaseV3BurningApplicationReferenceIssues,
  targetPhaseV3ResultReferencesSchema
} from "./target-phase-v3-integrity";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
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

type BurningApplicationReferenceInput = Parameters<
  typeof collectTargetPhaseV3BurningApplicationReferenceIssues
>[0];

function burningApplicationReferences(): BurningApplicationReferenceInput {
  const application = (
    id: number,
    hitResolutionLogId: number,
    damageEventId: number | null,
    targetId: string,
    attemptIndex: number,
    deliveryPhase:
      | "before-reactable-tick"
      | "after-reactable-tick"
  ) => ({
    id,
    sourceKind: "burning-tick",
    reactionDamageLogId: 7,
    hitResolutionLogId,
    damageEventId,
    frame: 15,
    eventPriority: 0.625,
    eventSequence: 40,
    attemptIndex,
    attemptCount: 2,
    deliveryPhase,
    sourceActorId: "burning-owner",
    targetId,
    hitId: "burning-hit",
    hitGroupId: "burning-group",
    element: "pyro",
    selector: { channel: { kind: "burning-tick" } },
    nominalGaugeUnits: 1
  });
  return {
    delivery: {
      model: "burning-callback-zero-delay-v1",
      reactionDamageLogId: 7,
      eventPriority: 0.625,
      eventSequence: 40,
      attempts: [
        {
          order: 0,
          targetId: "landed",
          targetOrder: 0,
          applicationPhase: "before-reactable-tick",
          outcome: "landed",
          hitResolutionLogId: 10,
          damageEventId: 30,
          elementalApplicationIcdLogId: 20,
          targetStateTimelinePointId: 50
        },
        {
          order: 1,
          targetId: "missed",
          targetOrder: 1,
          applicationPhase: "after-reactable-tick",
          outcome: "miss",
          hitResolutionLogId: 11,
          damageEventId: null,
          elementalApplicationIcdLogId: 21,
          targetStateTimelinePointId: null
        },
        {
          order: 2,
          targetId: "unresolved",
          targetOrder: 2,
          applicationPhase: "before-reactable-tick",
          outcome: "unresolved",
          hitResolutionLogId: null,
          damageEventId: null,
          elementalApplicationIcdLogId: null,
          targetStateTimelinePointId: null
        }
      ]
    },
    reactionDamage: {
      id: 7,
      sourceActorId: "burning-owner",
      damageFrame: 15,
      hitResolutionLogIds: [10, 11],
      elementalApplicationIcdLogIds: [20, 21]
    },
    hitResolutionLog: [
      {
        id: 10,
        reactionDamageLogId: 7,
        elementalApplicationIcdLogId: 20,
        damageEventId: 30,
        hitId: "burning-hit",
        hitGroupId: "burning-group"
      },
      {
        id: 11,
        reactionDamageLogId: 7,
        elementalApplicationIcdLogId: 21,
        damageEventId: null,
        hitId: "burning-hit",
        hitGroupId: "burning-group"
      }
    ],
    damageEvents: [
      {
        id: 30,
        targetResolutionId: 10,
        elementalApplicationIcdLogId: 20
      }
    ],
    elementalApplicationIcdLog: [
      application(
        20,
        10,
        30,
        "landed",
        0,
        "before-reactable-tick"
      ),
      application(
        21,
        11,
        null,
        "missed",
        1,
        "after-reactable-tick"
      )
    ]
  } as unknown as BurningApplicationReferenceInput;
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
    ],
    [
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION
    ],
    [
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
      REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION
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
    ],
    [
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION
    ],
    [
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION
    ],
    [
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      "1.48.0-reaction-owned-application-root-forged",
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      "1.48.0-reaction-owned-application-root-forged"
    ],
    [
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
      REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION
    ],
    [
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
      "1.49.0-reaction-owned-reset-boundary-forged",
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
      "1.49.0-reaction-owned-reset-boundary-forged"
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
              "target-phase-v3 integrity requires an exact 1.44, 1.45, 1.46, 1.47, 1.48, or 1.49 schema and engine identity"
          })
        ])
      );
    }
  );
});

describe("target-phase-v3 1.48 Burning application references", () => {
  it("accepts landed, missed, and unresolved attempts with exact reciprocal links", () => {
    expect(
      collectTargetPhaseV3BurningApplicationReferenceIssues(
        burningApplicationReferences()
      )
    ).toEqual([]);
  });

  it.each([
    [
      "attempt application",
      (input: BurningApplicationReferenceInput) => {
        input.delivery.attempts[0]!.elementalApplicationIcdLogId = 21;
      },
      "application row"
    ],
    [
      "hit reaction backlink",
      (input: BurningApplicationReferenceInput) => {
        input.hitResolutionLog[0]!.reactionDamageLogId = 8;
      },
      "hit must reciprocally link"
    ],
    [
      "hit application backlink",
      (input: BurningApplicationReferenceInput) => {
        input.hitResolutionLog[0]!.elementalApplicationIcdLogId = 21;
      },
      "hit must reciprocally link"
    ],
    [
      "damage application backlink",
      (input: BurningApplicationReferenceInput) => {
        input.damageEvents[0]!.elementalApplicationIcdLogId = 21;
      },
      "damage must reciprocally link"
    ],
    [
      "application reaction backlink",
      (input: BurningApplicationReferenceInput) => {
        const application = input.elementalApplicationIcdLog[0];
        if (application?.sourceKind === "burning-tick") {
          application.reactionDamageLogId = 8;
        }
      },
      "application row must match"
    ],
    [
      "application source kind",
      (input: BurningApplicationReferenceInput) => {
        input.elementalApplicationIcdLog[0] = {
          ...input.elementalApplicationIcdLog[0]!,
          sourceKind: "configured-direct-hit"
        } as (typeof input.elementalApplicationIcdLog)[number];
      },
      "application row must match"
    ],
    [
      "reaction child order",
      (input: BurningApplicationReferenceInput) => {
        input.reactionDamage.elementalApplicationIcdLogIds = [21, 20];
      },
      "reaction parent must list every resolved delivery application"
    ],
    [
      "unresolved application",
      (input: BurningApplicationReferenceInput) => {
        const unresolved = input.delivery.attempts[2]!;
        if (unresolved.outcome === "unresolved") {
          (
            unresolved as unknown as {
              elementalApplicationIcdLogId: number;
            }
          ).elementalApplicationIcdLogId = 20;
        }
      },
      "unresolved Burning delivery attempt"
    ]
  ])("rejects a forged %s", (_label, mutate, expectedMessage) => {
    const input = burningApplicationReferences();
    mutate(input);
    expect(
      collectTargetPhaseV3BurningApplicationReferenceIssues(input).map(
        (issue) => issue.message
      )
    ).toEqual(
      expect.arrayContaining([expect.stringContaining(expectedMessage)])
    );
  });
});
