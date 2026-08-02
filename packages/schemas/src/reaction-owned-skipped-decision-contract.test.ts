import { describe, expect, expectTypeOf, it } from "vitest";
import {
  elementalApplicationIcdDecisionV147Schema,
  reactionOwnedElementalApplicationSkippedDecisionV148Schema
} from "./result-schema";
import type {
  ElementalApplicationIcdDecisionV147,
  ReactionOwnedElementalApplicationIcdDecisionV148
} from "./types";

const noAuraSkippedDecision = {
  kind: "skipped",
  evaluated: false,
  reason: "no-aura-engine",
  consumed: false,
  applicationMultiplier: 0,
  allowed: false
} as const;

describe("reaction-owned skipped-decision contract", () => {
  it("keeps no-aura-engine in the frozen configured-direct decision schema", () => {
    expect(
      elementalApplicationIcdDecisionV147Schema.safeParse(
        noAuraSkippedDecision
      ).success
    ).toBe(true);
  });

  it("rejects no-aura-engine from the 1.48 reaction-owned schema", () => {
    expect(
      reactionOwnedElementalApplicationSkippedDecisionV148Schema.safeParse(
        noAuraSkippedDecision
      ).success
    ).toBe(false);
  });

  it("closes the reaction-owned TypeScript reason union without narrowing 1.47", () => {
    type DirectSkipped = Extract<
      ElementalApplicationIcdDecisionV147,
      { kind: "skipped" }
    >;
    type ReactionOwnedSkipped = Extract<
      ReactionOwnedElementalApplicationIcdDecisionV148,
      { kind: "skipped" }
    >;

    expectTypeOf<DirectSkipped["reason"]>().toEqualTypeOf<
      | "miss"
      | "target-aura-blocked"
      | "no-aura-engine"
      | "mechanics-truncated"
    >();
    expectTypeOf<ReactionOwnedSkipped["reason"]>().toEqualTypeOf<
      "miss" | "target-aura-blocked" | "mechanics-truncated"
    >();
    expectTypeOf<
      "no-aura-engine" extends ReactionOwnedSkipped["reason"] ? true : false
    >().toEqualTypeOf<false>();
  });
});
