import type { TrustedReactionElementalApplicationInput } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import {
  AuraEngine,
  type DeferredReactionOwnedAttachmentToken
} from "./aura";

function swirl(
  frame: number,
  sourceActorId: string,
  element: "pyro" | "hydro" | "cryo" | "electro",
  nominalGaugeUnits = 1
): TrustedReactionElementalApplicationInput {
  return {
    frame,
    sourceActorId,
    channel: { kind: "swirl-propagation", element },
    nominalGaugeUnits
  };
}

function burning(
  frame: number,
  sourceActorId: string
): TrustedReactionElementalApplicationInput {
  return {
    frame,
    sourceActorId,
    channel: { kind: "burning-tick" }
  };
}

describe("reaction-owned deferred non-reacted attachment", () => {
  it("resolves a same-frame Pyro+Cryo attack cohort before committing both Auras", () => {
    const target = new AuraEngine({ mode: "aura-v9" });

    const pyro =
      target.processReactionOwnedHitWithDeferredNonReactedAttachment(
        swirl(5, "anemo-pyro", "pyro")
      );
    const cryo =
      target.processReactionOwnedHitWithDeferredNonReactedAttachment(
        swirl(5, "anemo-cryo", "cryo")
      );

    expect(pyro.reactionAudit).toMatchObject({
      triggered: false,
      reaction: "none",
      reactions: [],
      icdAllowed: true,
      auraBefore: [],
      auraApplied: [],
      auraConsumed: [],
      auraAfter: []
    });
    expect(cryo.reactionAudit).toMatchObject({
      triggered: false,
      reaction: "none",
      reactions: [],
      icdAllowed: true,
      auraBefore: [],
      auraApplied: [],
      auraConsumed: [],
      auraAfter: []
    });
    expect(pyro.pendingAttachment).not.toBeNull();
    expect(cryo.pendingAttachment).not.toBeNull();

    const pyroCommit = target.commitDeferredReactionOwnedAttachment(
      pyro.pendingAttachment!
    );
    const cryoCommit = target.commitDeferredReactionOwnedAttachment(
      cryo.pendingAttachment!
    );

    expect(pyroCommit).toMatchObject({
      model: "reaction-owned-deferred-attachment-v1",
      frame: 5,
      sourceActorId: "anemo-pyro",
      element: "pyro",
      applicationGaugeUnits: 1,
      auraBefore: [],
      auraApplied: [
        {
          element: "pyro",
          gaugeUnits: 1,
          sourceActorId: "anemo-pyro"
        }
      ],
      auraAfter: [{ element: "pyro", gaugeUnits: 0.8 }]
    });
    expect(cryoCommit).toMatchObject({
      model: "reaction-owned-deferred-attachment-v1",
      frame: 5,
      sourceActorId: "anemo-cryo",
      element: "cryo",
      applicationGaugeUnits: 1,
      auraBefore: [{ element: "pyro", gaugeUnits: 0.8 }],
      auraApplied: [
        {
          element: "cryo",
          gaugeUnits: 1,
          sourceActorId: "anemo-cryo"
        }
      ],
      auraAfter: [
        { element: "cryo", gaugeUnits: 0.8 },
        { element: "pyro", gaugeUnits: 0.8 }
      ]
    });
    expect(target.getAuraStateAt(5)).toMatchObject([
      { element: "cryo", gaugeUnits: 0.8 },
      { element: "pyro", gaugeUnits: 0.8 }
    ]);
  });

  it("preserves the immediate entry's sequential reverse-Melt semantics", () => {
    const target = new AuraEngine({ mode: "aura-v9" });

    const pyro = target.processReactionOwnedHit(
      swirl(5, "anemo-pyro", "pyro")
    );
    const cryo = target.processReactionOwnedHit(
      swirl(5, "anemo-cryo", "cryo")
    );

    expect(pyro).toMatchObject({
      triggered: false,
      reaction: "none"
    });
    expect(cryo).toMatchObject({
      triggered: true,
      reaction: "reverseMelt",
      reactions: ["reverseMelt"]
    });
  });

  it("commits a token once, rejects copies and other engines, and does not rerun ICD", () => {
    const target = new AuraEngine({ mode: "aura-v9" });
    const otherTarget = new AuraEngine({ mode: "aura-v9" });
    const prepared =
      target.processReactionOwnedHitWithDeferredNonReactedAttachment(
        swirl(3, "anemo-owner", "hydro")
      );
    const token = prepared.pendingAttachment!;
    const decisionBeforeCommit =
      target.getLastReactionOwnedElementalApplicationIcdDecision();

    expect(() =>
      otherTarget.commitDeferredReactionOwnedAttachment(token)
    ).toThrow(/invalid, forged, already consumed, or belongs to another/);
    expect(() =>
      target.commitDeferredReactionOwnedAttachment(
        {} as DeferredReactionOwnedAttachmentToken
      )
    ).toThrow(/invalid, forged, already consumed, or belongs to another/);

    target.commitDeferredReactionOwnedAttachment(token);
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toBe(decisionBeforeCommit);
    expect(() =>
      target.commitDeferredReactionOwnedAttachment(token)
    ).toThrow(/invalid, forged, already consumed, or belongs to another/);
  });

  it("rejects a pending attachment after the engine advances beyond its frame", () => {
    const target = new AuraEngine({ mode: "aura-v9" });
    const prepared =
      target.processReactionOwnedHitWithDeferredNonReactedAttachment(
        swirl(3, "anemo-owner", "electro")
      );

    target.getAuraStateAt(4);
    expect(() =>
      target.commitDeferredReactionOwnedAttachment(
        prepared.pendingAttachment!
      )
    ).toThrow(/from frame 3 expired before commit/);
  });

  it("returns no token for non-Swirl, ICD-blocked, or reacted applications", () => {
    const burningTarget = new AuraEngine({ mode: "aura-v9" });
    const nonSwirl =
      burningTarget.processReactionOwnedHitWithDeferredNonReactedAttachment(
        burning(0, "burning-owner")
      );
    expect(nonSwirl.pendingAttachment).toBeNull();
    expect(nonSwirl.reactionAudit.auraAfter).toMatchObject([
      { element: "pyro", gaugeUnits: 0.8 }
    ]);

    const allowed = nonSwirl;
    const blocked =
      burningTarget.processReactionOwnedHitWithDeferredNonReactedAttachment(
        burning(1, "other-burning-owner")
      );
    expect(allowed.pendingAttachment).toBeNull();
    expect(blocked).toMatchObject({
      pendingAttachment: null,
      reactionAudit: {
        triggered: false,
        reaction: "none",
        icdAllowed: false,
        applicationGaugeUnits: 0
      }
    });

    const reactedTarget = new AuraEngine({
      mode: "aura-v9",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }]
    });
    const reacted =
      reactedTarget.processReactionOwnedHitWithDeferredNonReactedAttachment(
        swirl(0, "cryo-owner", "cryo")
      );
    expect(reacted.pendingAttachment).toBeNull();
    expect(reacted.reactionAudit).toMatchObject({
      triggered: true,
      reaction: "reverseMelt",
      reactions: ["reverseMelt"]
    });
  });
});
