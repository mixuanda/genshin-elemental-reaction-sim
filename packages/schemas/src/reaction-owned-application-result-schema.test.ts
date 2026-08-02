import { describe, expect, it } from "vitest";
import {
  damageEventV142Schema,
  damageEventV148Schema,
  elementalApplicationIcdLogEntryV147Schema,
  elementalApplicationIcdLogEntryV148Schema,
  hitResolutionLogEntryV142Schema,
  hitResolutionLogEntryV148Schema,
  reactionDamageLogEntryV142Schema,
  reactionDamageLogEntryV148Schema,
  simulationResultSchema,
  simulationResultV147Schema,
  simulationResultV147ValueSchema,
  simulationResultV148Schema,
  simulationResultV148ValueSchema,
  simulationResultV149Schema,
  simulationResultV149ValueSchema,
  targetPhaseV3DeliveryAttemptV148Schema
} from "./result-schema";
import {
  simConfigV147Schema,
  simConfigV148Schema,
  simConfigV149Schema,
  simulationRunManifestV147Schema,
  simulationRunManifestV148Schema,
  simulationRunManifestV149Schema,
  targetPhaseV3DeliveryAttemptSchema
} from "./schema";

const policyId =
  "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v1";
const profileId =
  "gcsim-b4ae769-elemental-application-provisional-v1";

const burningSelector = {
  mode: "fixed-gcsim-reaction-owned-application-v1",
  policyId,
  channel: { kind: "burning-tick" }
} as const;

const burningDecision = {
  kind: "reaction-fixed-gcsim",
  evaluated: true,
  consumed: true,
  applicationMultiplier: 1,
  allowed: true,
  scope: "trusted-target-global-burning-projection",
  policyId,
  profileId,
  icdTag: "ICDTagBurningDamage",
  groupId: "burning",
  windowStartGroupId: "burning",
  resetFrames: 120,
  windowStartFrame: 0,
  resetAtFrame: 119,
  hitIndex: 0,
  sequenceIndex: 0,
  tailPolicy: "clamp",
  resetSchedulePolicy:
    "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
} as const;

const burningRow = {
  id: 0,
  sourceKind: "burning-tick",
  selector: burningSelector,
  reactionDamageLogId: 0,
  hitResolutionLogId: 0,
  damageEventId: 0,
  frame: 0,
  eventPriority: 0.5,
  eventSequence: 0,
  attemptIndex: 0,
  attemptCount: 1,
  deliveryPhase: "before-reactable-tick",
  sourceActorId: "pyro-owner",
  targetId: "enemy-0",
  hitId: "burning:0:enemy-0",
  hitGroupId: "burning:0",
  element: "pyro",
  nominalGaugeUnits: 1,
  effectiveGaugeUnits: 1,
  decision: burningDecision
} as const;

const swirlSelector = {
  mode: "fixed-gcsim-reaction-owned-application-v1",
  policyId,
  channel: {
    kind: "swirl-propagation",
    element: "pyro"
  }
} as const;

const swirlDecision = {
  kind: "reaction-fixed-gcsim",
  evaluated: true,
  consumed: true,
  applicationMultiplier: 1,
  allowed: true,
  scope: "actor-tag",
  policyId,
  profileId,
  icdTag: "ICDTagSwirlPyro",
  groupId: "reaction-a",
  windowStartGroupId: "reaction-a",
  resetFrames: 30,
  windowStartFrame: 10,
  resetAtFrame: 39,
  hitIndex: 0,
  sequenceIndex: 0,
  tailPolicy: "clamp",
  resetSchedulePolicy:
    "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
} as const;

const swirlRow = {
  ...burningRow,
  id: 1,
  sourceKind: "swirl-propagation",
  selector: swirlSelector,
  reactionDamageLogId: 1,
  hitResolutionLogId: 1,
  damageEventId: 1,
  frame: 10,
  eventPriority: 5,
  eventSequence: 1,
  deliveryPhase: "reaction-damage-event",
  hitId: "swirl:1:enemy-0",
  hitGroupId: "swirl:1",
  nominalGaugeUnits: 0.8,
  effectiveGaugeUnits: 0.8,
  decision: swirlDecision
} as const;

describe("1.48 reaction-owned elemental-application result wire", () => {
  it("accepts exact Burning and Swirl fixed-policy rows", () => {
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse(
        burningRow
      ).success
    ).toBe(true);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse(swirlRow)
        .success
    ).toBe(true);

    const blockedBurning = {
      ...burningRow,
      id: 2,
      hitResolutionLogId: 2,
      damageEventId: 2,
      frame: 1,
      effectiveGaugeUnits: 0,
      decision: {
        ...burningDecision,
        applicationMultiplier: 0,
        allowed: false,
        hitIndex: 1,
        sequenceIndex: 1
      }
    } as const;
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse(
        blockedBurning
      ).success
    ).toBe(true);
  });

  it("binds every Swirl channel to its exact propagated element tag", () => {
    for (const [element, suffix] of [
      ["pyro", "Pyro"],
      ["hydro", "Hydro"],
      ["cryo", "Cryo"],
      ["electro", "Electro"]
    ] as const) {
      expect(
        elementalApplicationIcdLogEntryV148Schema.safeParse({
          ...swirlRow,
          element,
          selector: {
            ...swirlSelector,
            channel: {
              kind: "swirl-propagation",
              element
            }
          },
          decision: {
            ...swirlDecision,
            icdTag: `ICDTagSwirl${suffix}`
          }
        }).success
      ).toBe(true);
    }
  });

  it("keeps the configured-direct 1.47 branch byte-exact", () => {
    const directRow = {
      id: 0,
      sourceKind: "configured-direct-hit",
      hitResolutionLogId: 0,
      damageEventId: 0,
      frame: 0,
      sourceActorId: "actor",
      targetId: "enemy-0",
      hitId: "hit",
      hitGroupId: "group",
      element: "pyro",
      selector: { mode: "no-icd-v1" },
      nominalGaugeUnits: 1,
      effectiveGaugeUnits: 1,
      decision: {
        kind: "no-icd",
        evaluated: true,
        consumed: false,
        applicationMultiplier: 1,
        allowed: true,
        scope: null,
        profileId: null,
        icdTag: null,
        groupId: null,
        windowStartGroupId: null,
        resetFrames: null,
        windowStartFrame: null,
        resetAtFrame: null,
        hitIndex: null,
        sequenceIndex: null,
        tailPolicy: null,
        resetSchedulePolicy: "bypass"
      }
    } as const;
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse(directRow)
        .success
    ).toBe(true);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse(directRow)
        .success
    ).toBe(true);

    const forgedCrossSource = {
      ...directRow,
      reactionDamageLogId: 0
    };
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse(
        forgedCrossSource
      ).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse(
        forgedCrossSource
      ).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse(burningRow)
        .success
    ).toBe(false);
  });

  it("rejects fabricated source kinds and cross-source fields", () => {
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        sourceKind: "reaction-owned"
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        applicationKind: "burning-tick"
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        selector: swirlSelector
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...swirlRow,
        element: "hydro"
      }).success
    ).toBe(false);
  });

  it("rejects untrusted selectors, policy ids, and ordinary public groups", () => {
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        selector: {
          ...burningSelector,
          policyId: "forged-policy"
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...swirlRow,
        selector: {
          mode: "fixed-gcsim-application-v1",
          icdTag: "ICDTagSwirlPyro",
          groupId: "reaction-a"
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        decision: {
          ...burningDecision,
          scope: "target-global-burning"
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        decision: {
          ...burningDecision,
          groupId: "reaction-a",
          windowStartGroupId: "reaction-a",
          resetFrames: 30,
          resetAtFrame: 29
        }
      }).success
    ).toBe(false);
  });

  it("binds Gauge, element, and trusted numeric sequence identities", () => {
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        nominalGaugeUnits: 2,
        effectiveGaugeUnits: 2
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...swirlRow,
        effectiveGaugeUnits: 0.7
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        decision: {
          ...burningDecision,
          applicationMultiplier: 0,
          allowed: false
        },
        effectiveGaugeUnits: 0
      }).success
    ).toBe(false);
  });

  it("requires complete active fixed windows with exact reset boundaries", () => {
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        decision: {
          ...burningDecision,
          resetAtFrame: 120
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...swirlRow,
        decision: {
          ...swirlDecision,
          resetAtFrame: 10
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...swirlRow,
        decision: {
          ...swirlDecision,
          hitIndex: 1,
          sequenceIndex: 0
        }
      }).success
    ).toBe(false);
  });

  it("keeps misses resolvable but damage-free, and landed rows damage-backed", () => {
    const missed = {
      ...burningRow,
      damageEventId: null,
      effectiveGaugeUnits: 0,
      decision: {
        kind: "skipped",
        evaluated: false,
        reason: "miss",
        consumed: false,
        applicationMultiplier: 0,
        allowed: false
      }
    } as const;
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse(missed)
        .success
    ).toBe(true);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...missed,
        damageEventId: 9
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...burningRow,
        damageEventId: null
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV148Schema.safeParse({
        ...missed,
        hitResolutionLogId: null
      }).success
    ).toBe(false);
  });

  it("requires every backlink id to be non-negative or explicitly null", () => {
    for (const forged of [
      { ...burningRow, reactionDamageLogId: -1 },
      { ...burningRow, hitResolutionLogId: -1 },
      { ...burningRow, damageEventId: -1 }
    ]) {
      expect(
        elementalApplicationIcdLogEntryV148Schema.safeParse(forged)
          .success
      ).toBe(false);
    }
  });

  it("requires V148 reaction owners to expose both reciprocal id arrays", () => {
    const frozenReactionRow = {
      id: 0,
      reaction: "overload",
      triggerDamageEventId: 0,
      triggerHitGroupId: "trigger-group",
      sourceActorId: "actor",
      sourceTargetId: "enemy-0",
      triggerFrame: 0,
      damageFrame: 1,
      scheduled: true,
      withinSimulation: true,
      blockedReason: null,
      nextAvailableFrame: 7,
      scheduleKind: "one-shot",
      targetingMode: "radius",
      centerPosition: null,
      radius: 3,
      sourceCoreId: null,
      sourceCoreLogId: null,
      selectionRadius: null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits: null,
      excludedTargetIds: [],
      checkedTargetIds: ["enemy-0"],
      hitTargetIds: ["enemy-0"],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [1],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    } as const;
    expect(
      reactionDamageLogEntryV142Schema.safeParse(frozenReactionRow)
        .success
    ).toBe(true);

    const currentReactionRow = {
      ...frozenReactionRow,
      hitResolutionLogIds: [0],
      elementalApplicationIcdLogIds: []
    };
    expect(
      reactionDamageLogEntryV148Schema.safeParse(currentReactionRow)
        .success
    ).toBe(true);
    expect(
      reactionDamageLogEntryV142Schema.safeParse(currentReactionRow)
        .success
    ).toBe(false);
    expect(
      reactionDamageLogEntryV148Schema.safeParse({
        ...currentReactionRow,
        hitResolutionLogIds: [0, 0]
      }).success
    ).toBe(false);
    expect(
      reactionDamageLogEntryV148Schema.safeParse({
        ...currentReactionRow,
        elementalApplicationIcdLogIds: [-1]
      }).success
    ).toBe(false);
  });

  it("versions hit-resolution reciprocal fields without widening V147", () => {
    const frozenResolution = {
      id: 0,
      frame: 0,
      timeSeconds: 0,
      cycle: 0,
      sourceActorId: "actor",
      sourceActionId: "action",
      actionName: "Action",
      hitId: "hit",
      hitGroupId: "group",
      targetIndex: 0,
      targetCount: 1,
      hitLabel: "Hit",
      element: "pyro",
      targetId: "enemy-0",
      targetName: "Enemy",
      targetingSource: "default",
      resolutionKind: "direct",
      targetPosition: null,
      sourceActorPosition: null,
      sourceActorFacingDegrees: null,
      geometryKind: null,
      geometryCoordinateSpace: null,
      geometryOrigin: null,
      geometryStart: null,
      geometryEnd: null,
      geometryRadius: null,
      geometryHalfWidth: null,
      geometryHalfHeight: null,
      geometryRotationDegrees: null,
      geometryDirectionDegrees: null,
      geometryAngleDegrees: null,
      geometryDistance: null,
      geometryThreshold: null,
      outcome: "landed",
      landed: true,
      reason: null,
      targetEffectSource: "normal",
      targetPhaseId: null,
      damageAllowed: true,
      auraAllowed: true,
      hitConfirmAllowed: true,
      mechanicsStatus: "authoritative",
      damageEventId: 0,
      potentialDamage: 100,
      finalDamage: 100,
      displayDamage: 100
    } as const;
    expect(
      hitResolutionLogEntryV142Schema.safeParse(frozenResolution)
        .success
    ).toBe(true);

    const currentResolution = {
      ...frozenResolution,
      reactionDamageLogId: null,
      elementalApplicationIcdLogId: 0
    };
    expect(
      hitResolutionLogEntryV148Schema.safeParse(currentResolution)
        .success
    ).toBe(true);
    expect(
      hitResolutionLogEntryV142Schema.safeParse(currentResolution)
        .success
    ).toBe(false);
    expect(
      hitResolutionLogEntryV148Schema.safeParse({
        ...currentResolution,
        reactionDamageLogId: 0
      }).success
    ).toBe(false);

    const missedReactionResolution = {
      ...frozenResolution,
      resolutionKind: "reaction-damage",
      targetingSource: "reaction-geometry",
      outcome: "miss",
      landed: false,
      reason: "OUT_OF_RANGE",
      damageEventId: null,
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0,
      reactionDamageLogId: 0,
      elementalApplicationIcdLogId: 1
    } as const;
    expect(
      hitResolutionLogEntryV148Schema.safeParse(
        missedReactionResolution
      ).success
    ).toBe(true);
  });

  it("versions the target-phase-v3 Burning delivery backlink", () => {
    const landedAttempt = {
      order: 0,
      targetId: "enemy-0",
      targetOrder: 0,
      applicationPhase: "before-reactable-tick",
      outcome: "landed",
      hitResolutionLogId: 0,
      damageEventId: 0,
      elementalApplicationIcdLogId: 0,
      targetStateTimelinePointId: 0
    } as const;
    expect(
      targetPhaseV3DeliveryAttemptV148Schema.safeParse(
        landedAttempt
      ).success
    ).toBe(true);
    expect(
      targetPhaseV3DeliveryAttemptSchema.safeParse(landedAttempt)
        .success
    ).toBe(false);
    expect(
      targetPhaseV3DeliveryAttemptV148Schema.safeParse({
        ...landedAttempt,
        outcome: "miss",
        damageEventId: null,
        elementalApplicationIcdLogId: 0,
        targetStateTimelinePointId: null
      }).success
    ).toBe(true);
    expect(
      targetPhaseV3DeliveryAttemptV148Schema.safeParse({
        ...landedAttempt,
        outcome: "unresolved",
        hitResolutionLogId: null,
        damageEventId: null,
        elementalApplicationIcdLogId: null,
        targetStateTimelinePointId: null
      }).success
    ).toBe(true);
  });

  it("freezes V147 nested event shapes while V148 owns reciprocal fields", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        damageEventV142Schema.shape,
        "elementalApplicationIcdLogId"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        damageEventV148Schema.shape,
        "elementalApplicationIcdLogId"
      )
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        hitResolutionLogEntryV142Schema.shape,
        "reactionDamageLogId"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        hitResolutionLogEntryV148Schema.shape,
        "reactionDamageLogId"
      )
    ).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        reactionDamageLogEntryV142Schema.shape,
        "elementalApplicationIcdLogIds"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        reactionDamageLogEntryV148Schema.shape,
        "elementalApplicationIcdLogIds"
      )
    ).toBe(true);
  });

  it("freezes V147/V148 while advancing only the current V149 identity", () => {
    expect(
      simulationResultV147ValueSchema.shape.schemaVersion.safeParse(
        "1.47.0"
      ).success
    ).toBe(true);
    expect(
      simulationResultV147ValueSchema.shape.schemaVersion.safeParse(
        "1.48.0"
      ).success
    ).toBe(false);
    expect(
      simulationResultV148ValueSchema.shape.schemaVersion.safeParse(
        "1.48.0"
      ).success
    ).toBe(true);
    expect(
      simulationResultV148ValueSchema.shape.schemaVersion.safeParse(
        "1.49.0"
      ).success
    ).toBe(false);
    expect(
      simulationResultV149ValueSchema.shape.schemaVersion.safeParse(
        "1.49.0"
      ).success
    ).toBe(true);
    expect(simulationResultV147ValueSchema.shape.config).toBe(
      simConfigV147Schema
    );
    expect(simulationResultV148ValueSchema.shape.config).toBe(
      simConfigV148Schema
    );
    expect(simulationResultV149ValueSchema.shape.config).toBe(
      simConfigV149Schema
    );
    expect(simulationResultV147ValueSchema.shape.runManifest).toBe(
      simulationRunManifestV147Schema
    );
    expect(simulationResultV148ValueSchema.shape.runManifest).toBe(
      simulationRunManifestV148Schema
    );
    expect(simulationResultV149ValueSchema.shape.runManifest).toBe(
      simulationRunManifestV149Schema
    );
    expect(simulationResultSchema).toBe(simulationResultV149Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV148Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV147Schema);
  });
});
