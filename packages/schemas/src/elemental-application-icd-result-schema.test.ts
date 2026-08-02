import { describe, expect, it } from "vitest";
import {
  elementalApplicationIcdDecisionV147Schema,
  elementalApplicationIcdLogEntryV147Schema,
  simulationResultSchema,
  simulationResultV146ValueSchema,
  simulationResultV147Schema,
  simulationResultV147ValueSchema,
  simulationResultV148Schema,
  simulationResultV148ValueSchema,
  simulationResultV149Schema,
  simulationResultV149ValueSchema,
  simulationResultV150Schema,
  simulationResultV150ValueSchema,
  simulationResultV151Schema,
  simulationResultV151ValueSchema,
  simulationResultV152Schema,
  simulationResultV152ValueSchema,
  simulationResultV153Schema,
  simulationResultV153ValueSchema
} from "./result-schema";

const noIcdRow = {
  id: 0,
  sourceKind: "configured-direct-hit",
  hitResolutionLogId: 0,
  damageEventId: 0,
  frame: 0,
  sourceActorId: "actor",
  targetId: "target",
  hitId: "duplicate-hit",
  hitGroupId: "action:0:0:0",
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

const fixedRow = {
  ...noIcdRow,
  selector: {
    mode: "fixed-gcsim-application-v1",
    icdTag: "skill",
    groupId: "nahida-skill"
  },
  nominalGaugeUnits: 1,
  effectiveGaugeUnits: 1.5,
  decision: {
    kind: "fixed-gcsim",
    evaluated: true,
    consumed: true,
    applicationMultiplier: 1.5,
    allowed: true,
    scope: "actor-tag",
    profileId: "gcsim-b4ae769-elemental-application-provisional-v1",
    icdTag: "skill",
    groupId: "nahida-skill",
    windowStartGroupId: "nahida-skill",
    resetFrames: 60,
    windowStartFrame: 0,
    resetAtFrame: 59,
    hitIndex: 0,
    sequenceIndex: 0,
    tailPolicy: "clamp",
    resetSchedulePolicy:
      "window-start-plus-reset-frames-minus-one"
  }
} as const;

describe("elemental-application ICD result leaf schema", () => {
  it("accepts exact skipped, no-ICD, legacy, and numeric fixed decisions", () => {
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse(noIcdRow)
        .success
    ).toBe(true);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse(fixedRow)
        .success
    ).toBe(true);

    expect(
      elementalApplicationIcdDecisionV147Schema.safeParse({
        kind: "skipped",
        evaluated: false,
        reason: "miss",
        consumed: false,
        applicationMultiplier: 0,
        allowed: false
      }).success
    ).toBe(true);
    expect(
      elementalApplicationIcdDecisionV147Schema.safeParse({
        kind: "legacy-profile",
        evaluated: true,
        consumed: true,
        applicationMultiplier: 0,
        allowed: false,
        scope: "actor-tag-profile",
        profileId: "custom",
        icdTag: "skill",
        groupId: null,
        windowStartGroupId: null,
        resetFrames: 18,
        windowStartFrame: 4,
        resetAtFrame: 22,
        hitIndex: 1,
        sequenceIndex: 1,
        tailPolicy: "repeat",
        resetSchedulePolicy: "window-start-plus-reset-frames"
      }).success
    ).toBe(true);
  });

  it("keeps skipped and no-ICD decisions disjoint from stateful windows", () => {
    expect(
      elementalApplicationIcdDecisionV147Schema.safeParse({
        kind: "skipped",
        evaluated: false,
        reason: "target-aura-blocked",
        consumed: false,
        applicationMultiplier: 0,
        allowed: false,
        windowStartFrame: null
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...noIcdRow,
        decision: {
          ...noIcdRow.decision,
          windowStartFrame: 0
        }
      }).success
    ).toBe(false);
  });

  it("requires complete safe-integer windows and their versioned reset boundary", () => {
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        decision: {
          ...fixedRow.decision,
          resetAtFrame: 60
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        decision: {
          ...fixedRow.decision,
          hitIndex: Number.MAX_SAFE_INTEGER + 1
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        decision: {
          ...fixedRow.decision,
          windowStartFrame: Number.MAX_SAFE_INTEGER,
          resetAtFrame: Number.MAX_SAFE_INTEGER
        }
      }).success
    ).toBe(false);
  });

  it("binds allowed and effective gauge to the finite numeric multiplier", () => {
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        effectiveGaugeUnits: 1
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        decision: {
          ...fixedRow.decision,
          allowed: false
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        effectiveGaugeUnits: Number.POSITIVE_INFINITY
      }).success
    ).toBe(false);
  });

  it("binds stateful decisions to their exact selector and public group", () => {
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        selector: {
          ...fixedRow.selector,
          groupId: "default"
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        selector: {
          ...fixedRow.selector,
          groupId: "reaction-a"
        },
        decision: {
          ...fixedRow.decision,
          groupId: "reaction-a"
        }
      }).success
    ).toBe(false);
    expect(
      elementalApplicationIcdLogEntryV147Schema.safeParse({
        ...fixedRow,
        element: "physical"
      }).success
    ).toBe(false);
  });

  it("keeps the 1.46-1.51 application field sets frozen while CURRENT advances", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        simulationResultV146ValueSchema.shape,
        "elementalApplicationIcdLog"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        simulationResultV147ValueSchema.shape,
        "elementalApplicationIcdLog"
      )
    ).toBe(true);
    expect(
      simulationResultV147ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).toBe(elementalApplicationIcdLogEntryV147Schema);
    expect(
      simulationResultV148ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).not.toBe(elementalApplicationIcdLogEntryV147Schema);
    expect(
      simulationResultV149ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).not.toBe(
      simulationResultV148ValueSchema.shape.elementalApplicationIcdLog
        .element
    );
    expect(
      simulationResultV150ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).toBe(
      simulationResultV149ValueSchema.shape.elementalApplicationIcdLog
        .element
    );
    expect(
      simulationResultV151ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).toBe(
      simulationResultV150ValueSchema.shape.elementalApplicationIcdLog
        .element
    );
    expect(
      simulationResultV152ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).toBe(
      simulationResultV151ValueSchema.shape.elementalApplicationIcdLog
        .element
    );
    expect(
      simulationResultV153ValueSchema.shape.elementalApplicationIcdLog
        .element
    ).toBe(
      simulationResultV152ValueSchema.shape.elementalApplicationIcdLog
        .element
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        simulationResultV151ValueSchema.shape,
        "freezeBrokenAttackLog"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        simulationResultV152ValueSchema.shape,
        "freezeBrokenAttackLog"
      )
    ).toBe(true);
    const v151TopLevelFields = Object.keys(
      simulationResultV151ValueSchema.shape
    );
    const v152TopLevelFields = Object.keys(
      simulationResultV152ValueSchema.shape
    );
    expect(
      v152TopLevelFields.filter(
        (field) => !v151TopLevelFields.includes(field)
      )
    ).toEqual(["freezeBrokenAttackLog"]);
    expect(
      v151TopLevelFields.filter(
        (field) => !v152TopLevelFields.includes(field)
      )
    ).toEqual([]);
    const currentTopLevelFields = Object.keys(
      simulationResultV153ValueSchema.shape
    );
    expect(
      currentTopLevelFields.filter(
        (field) => !v152TopLevelFields.includes(field)
      )
    ).toEqual(["callbackRegistrationLog", "callbackDeliveryLog"]);
    expect(
      v152TopLevelFields.filter(
        (field) => !currentTopLevelFields.includes(field)
      )
    ).toEqual([]);
    expect(simulationResultSchema).toBe(simulationResultV153Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV152Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV151Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV150Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV149Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV148Schema);
    expect(simulationResultSchema).not.toBe(simulationResultV147Schema);
  });
});
