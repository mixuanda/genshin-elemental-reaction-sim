import { describe, expect, it } from "vitest";

import {
  basicReactionSchedulerDeferredAuraAttachmentLogEntrySchema,
  basicReactionSchedulerLogEntrySchema,
  basicReactionSchedulerSwirlAttackResolutionLogEntrySchema,
  simulationResultV150ValueSchema,
  simulationResultV151ValueSchema
} from "./result-schema";

const attackRow = {
  id: 0,
  kind: "swirl-attack-resolution",
  disposition: "deferred",
  frame: 15,
  timeSeconds: 0.25,
  eventPriority: 5,
  eventSequence: 10,
  parentEventSequence: 10,
  reactionDamageLogId: 0,
  hitResolutionLogId: 0,
  elementalApplicationIcdLogId: 0,
  sourceActorId: "anemo",
  targetId: "recipient",
  element: "pyro",
  reaction: "none",
  reactions: [],
  auraBefore: [],
  auraApplied: [],
  auraConsumed: [],
  auraAfter: [],
  pairedLogId: 1
} as const;

const commitRow = {
  ...attackRow,
  id: 1,
  kind: "deferred-aura-attachment",
  disposition: "committed",
  eventSequence: 11,
  auraApplied: [
    {
      element: "pyro",
      gaugeUnits: 0.8,
      sourceActorId: "anemo"
    }
  ],
  auraAfter: [
    {
      element: "pyro",
      gaugeUnits: 0.8,
      expiresAtFrame: 495
    }
  ],
  pairedLogId: 0
} as const;

describe("1.51 basic-reaction scheduler result leaf", () => {
  it("accepts the exact deferred attack and commit union", () => {
    expect(
      basicReactionSchedulerSwirlAttackResolutionLogEntrySchema.safeParse(
        attackRow
      ).success
    ).toBe(true);
    expect(
      basicReactionSchedulerDeferredAuraAttachmentLogEntrySchema.safeParse(
        commitRow
      ).success
    ).toBe(true);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse(attackRow)
        .success
    ).toBe(true);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse(commitRow)
        .success
    ).toBe(true);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        disposition: "legacy-immediate",
        pairedLogId: null
      }).success
    ).toBe(true);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        disposition: "not-attached",
        pairedLogId: null
      }).success
    ).toBe(true);
  });

  it("rejects invalid parent ordering, frame time, and pair shape", () => {
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        parentEventSequence: 9
      }).success
    ).toBe(false);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        timeSeconds: 0.251
      }).success
    ).toBe(false);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        pairedLogId: null
      }).success
    ).toBe(false);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        disposition: "not-attached",
        pairedLogId: 1
      }).success
    ).toBe(false);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...commitRow,
        eventSequence: commitRow.parentEventSequence
      }).success
    ).toBe(false);
  });

  it("rejects inherited or extra row fields", () => {
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse({
        ...attackRow,
        futureSchedulerClaim: true
      }).success
    ).toBe(false);

    const inherited = Object.create({ futureSchedulerClaim: true });
    Object.assign(inherited, attackRow);
    expect(
      basicReactionSchedulerLogEntrySchema.safeParse(inherited)
        .success
    ).toBe(false);
  });

  it("keeps the 1.50 top-level result shape frozen", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        simulationResultV150ValueSchema.shape,
        "basicReactionSchedulerLog"
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        simulationResultV151ValueSchema.shape,
        "basicReactionSchedulerLog"
      )
    ).toBe(true);
  });
});
