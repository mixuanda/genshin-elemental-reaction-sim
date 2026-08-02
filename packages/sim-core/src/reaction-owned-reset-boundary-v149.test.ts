import {
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
} from "@genshin-dps-lab/icd-profiles";
import type {
  ReactionOwnedElementalApplicationModel,
  TrustedReactionElementalApplicationInput
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { AuraEngine } from "./aura";
import { ElementalApplicationIcdEngine } from "./elemental-application-icd";

const V1_MODEL = {
  mode: "fixed-gcsim-reaction-owned-application-v1",
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
} as const satisfies ReactionOwnedElementalApplicationModel;

const V2_MODEL = {
  mode: "fixed-gcsim-reaction-owned-application-v2",
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID
} as const satisfies ReactionOwnedElementalApplicationModel;

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

function swirl(
  frame: number,
  sourceActorId = "anemo-owner"
): TrustedReactionElementalApplicationInput {
  return {
    frame,
    sourceActorId,
    channel: { kind: "swirl-propagation", element: "pyro" },
    nominalGaugeUnits: 1
  };
}

describe("1.49 channel-specific reaction-owned reset boundary", () => {
  it("preserves the frozen v1 reset-before Burning boundary", () => {
    const engine = new ElementalApplicationIcdEngine({
      reactionOwnedElementalApplicationModel: V1_MODEL
    });
    const decisions = [0, 119, 120].map((frame) =>
      engine.consumeReactionAttempt(burning(frame, `actor-${frame}`))
    );

    expect(decisions.map(({ hitIndex }) => hitIndex)).toEqual([0, 0, 1]);
    expect(
      decisions.map(({ applicationMultiplier }) => applicationMultiplier)
    ).toEqual([1, 1, 0]);
    expect(decisions.map(({ resetAtFrame }) => resetAtFrame)).toEqual([
      119, 238, 238
    ]);
    expect(decisions[1]).toMatchObject({
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
      resetSchedulePolicy:
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
    });
  });

  it("lets v2 Burning consume the old window at resetAtFrame", () => {
    const engine = new ElementalApplicationIcdEngine({
      reactionOwnedElementalApplicationModel: V2_MODEL
    });
    const decisions = [0, 119, 120].map((frame) =>
      engine.consumeReactionAttempt(burning(frame, `actor-${frame}`))
    );

    expect(decisions.map(({ hitIndex }) => hitIndex)).toEqual([0, 1, 0]);
    expect(
      decisions.map(({ applicationMultiplier }) => applicationMultiplier)
    ).toEqual([1, 0, 1]);
    expect(decisions.map(({ resetAtFrame }) => resetAtFrame)).toEqual([
      119, 119, 239
    ]);
    expect(decisions[1]).toMatchObject({
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
      resetSchedulePolicy:
        "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one"
    });
  });

  it.each([
    ["v1", V1_MODEL, GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID],
    ["v2", V2_MODEL, GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID]
  ] as const)(
    "keeps Swirl reset-before semantics under %s",
    (_version, model, policyId) => {
      const engine = new ElementalApplicationIcdEngine({
        reactionOwnedElementalApplicationModel: model
      });
      const decisions = [0, 29, 29].map((frame) =>
        engine.consumeReactionAttempt(swirl(frame))
      );

      expect(decisions.map(({ hitIndex }) => hitIndex)).toEqual([0, 0, 1]);
      expect(decisions.map(({ resetAtFrame }) => resetAtFrame)).toEqual([
        29, 58, 58
      ]);
      expect(decisions.map(({ policyId: selected }) => selected)).toEqual([
        policyId,
        policyId,
        policyId
      ]);
      expect(
        decisions.map(({ resetSchedulePolicy }) => resetSchedulePolicy)
      ).toEqual([
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
      ]);
    }
  );

  it.each([
    ["v1", V1_MODEL, [0, 0, 1], [1, 1, 0]],
    ["v2", V2_MODEL, [0, 1, 0], [1, 0, 1]]
  ] as const)(
    "passes the selected %s policy through AuraEngine",
    (_version, model, hitIndexes, gaugeUnits) => {
      const aura = new AuraEngine({
        mode: "aura-v4",
        reactionOwnedElementalApplicationModel: model
      });
      const observed = [0, 119, 120].map((frame) => {
        const audit = aura.processReactionOwnedHit(
          burning(frame, `actor-${frame}`)
        );
        return {
          hitIndex:
            aura.getLastReactionOwnedElementalApplicationIcdDecision()
              ?.hitIndex,
          applicationGaugeUnits: audit.applicationGaugeUnits
        };
      });

      expect(observed.map(({ hitIndex }) => hitIndex)).toEqual(hitIndexes);
      expect(
        observed.map(({ applicationGaugeUnits }) => applicationGaugeUnits)
      ).toEqual(gaugeUnits);
    }
  );

  it("keeps the policy selector outside the trusted per-attempt wire", () => {
    const engine = new ElementalApplicationIcdEngine({
      reactionOwnedElementalApplicationModel: V2_MODEL
    });
    const consumeUnsafe = engine.consumeReactionAttempt.bind(engine) as (
      input: unknown
    ) => unknown;

    expect(() =>
      consumeUnsafe({
        ...burning(0, "forger"),
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
      })
    ).toThrow(/forbidden field policyId/);
    expect(engine.consumeReactionAttempt(burning(0, "valid"))).toMatchObject({
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
      hitIndex: 0
    });
  });
});
