import type {
  ElementalApplicationIcdSkippedDecision,
  ElementalApplicationIcdSkippedReason,
  ReactionOwnedElementalApplicationIcdSkippedDecisionV148,
  ReactionOwnedElementalApplicationIcdSkippedReasonV148
} from "@genshin-dps-lab/schemas";

function skippedDecision<Reason extends string>(reason: Reason) {
  return {
    kind: "skipped" as const,
    evaluated: false as const,
    reason,
    consumed: false as const,
    applicationMultiplier: 0 as const,
    allowed: false as const
  };
}

/** Frozen configured-direct-hit skip helper, including legacy no-Aura mode. */
export function skippedConfiguredElementalApplicationDecision(
  reason: ElementalApplicationIcdSkippedReason
): ElementalApplicationIcdSkippedDecision {
  return skippedDecision(reason);
}

/**
 * Trusted reaction-owned skip helper.
 *
 * Keep the runtime switch even though TypeScript closes the public input: an
 * unsafe JavaScript/cast call must fail instead of serializing an outcome that
 * the 1.48 result schema cannot represent.
 */
export function skippedReactionOwnedElementalApplicationDecision(
  reason: ReactionOwnedElementalApplicationIcdSkippedReasonV148
): ReactionOwnedElementalApplicationIcdSkippedDecisionV148 {
  switch (reason) {
    case "miss":
    case "target-aura-blocked":
    case "mechanics-truncated":
      return skippedDecision(reason);
    default:
      throw new Error(
        `Reaction-owned elemental application cannot use skip reason "${String(reason)}".`
      );
  }
}
