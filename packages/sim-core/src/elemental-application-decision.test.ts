import { describe, expect, it } from "vitest";
import {
  skippedConfiguredElementalApplicationDecision,
  skippedReactionOwnedElementalApplicationDecision
} from "./elemental-application-decision";

describe("elemental application skipped-decision boundaries", () => {
  it("preserves configured-direct-hit no-Aura compatibility", () => {
    expect(
      skippedConfiguredElementalApplicationDecision("no-aura-engine")
    ).toEqual({
      kind: "skipped",
      evaluated: false,
      reason: "no-aura-engine",
      consumed: false,
      applicationMultiplier: 0,
      allowed: false
    });
  });

  it.each([
    "miss",
    "target-aura-blocked",
    "mechanics-truncated"
  ] as const)("accepts the legal reaction-owned skip reason %s", (reason) => {
    expect(
      skippedReactionOwnedElementalApplicationDecision(reason)
    ).toMatchObject({
      kind: "skipped",
      reason,
      consumed: false,
      applicationMultiplier: 0,
      allowed: false
    });
  });

  it("fails closed when unsafe runtime input asks for no-aura-engine", () => {
    const unsafeHelper =
      skippedReactionOwnedElementalApplicationDecision as unknown as (
        reason: string
      ) => unknown;

    expect(() => unsafeHelper("no-aura-engine")).toThrow(
      /Reaction-owned elemental application cannot use skip reason "no-aura-engine"/
    );
  });
});
