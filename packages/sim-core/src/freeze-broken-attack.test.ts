import { describe, expect, it } from "vitest";
import type { FrozenStateLogEntry } from "@genshin-dps-lab/schemas";
import {
  buildFreezeBrokenAttackLogEntry,
  classifyFreezeBrokenAttackTransition,
  collectFreezeBrokenAttackTransitions,
} from "./freeze-broken-attack";

const V1 = "legacy-no-freeze-broken-attack-callback" as const;
const V2 = "fixed-gcsim-freeze-broken-attack-normalized-v2" as const;

function frozenRow(
  overrides: Partial<FrozenStateLogEntry> = {},
): FrozenStateLogEntry {
  return {
    id: 0,
    reaction: "freeze",
    generation: 1,
    operation: "expire",
    frame: 60,
    timeSeconds: 1,
    targetId: "enemy-0",
    targetName: "Enemy",
    sourceActorId: "actor-0",
    triggerDamageEventId: 4,
    freezeResistance: 0,
    generatedGaugeUnits: 0,
    consumedGaugeUnits: 1,
    auraBefore: [
      { element: "frozen", gaugeUnits: 1, expiresAtFrame: 60 },
    ],
    auraAfter: [],
    expiresAtFrame: null,
    reason: null,
    ...overrides,
  };
}

describe("Freeze Broken attack transition classifier", () => {
  it("keeps legacy v1 callback output empty", () => {
    expect(
      collectFreezeBrokenAttackTransitions(V1, [frozenRow()]),
    ).toEqual([]);
  });

  it("fails closed for an unknown mode even through an unsafe cast", () => {
    expect(() =>
      classifyFreezeBrokenAttackTransition(
        "future-untrusted-mode" as typeof V2,
        frozenRow(),
      ),
    ).toThrowError(
      new RangeError(
        "unknown Freeze Broken attack mode: future-untrusted-mode",
      ),
    );
  });

  it.each([
    ["natural-decay", "freeze", "expire"],
    ["poise", "shatter", "poise-consume"],
    ["shatter", "shatter", "shatter-consume"],
    ["swirl-frozen", "swirlCryo", "consume"],
    ["crystallize-frozen", "crystallizeCryo", "consume"],
  ] as const)(
    "classifies %s only on a positive-to-depleted transition",
    (triggerSource, reaction, operation) => {
      expect(
        classifyFreezeBrokenAttackTransition(
          V2,
          frozenRow({ reaction, operation }),
        ),
      ).toMatchObject({ triggerSource, frozenGaugeBefore: 1, frozenGaugeAfter: 0 });
    },
  );

  it.each(["melt", "superconduct"] as const)(
    "explicitly excludes terminal %s consumption",
    (reaction) => {
      expect(
        classifyFreezeBrokenAttackTransition(
          V2,
          frozenRow({ reaction, operation: "consume" }),
        ),
      ).toBeNull();
    },
  );

  it("rejects partial consumption and non-positive starting state", () => {
    expect(
      classifyFreezeBrokenAttackTransition(
        V2,
        frozenRow({
          auraAfter: [
            { element: "frozen", gaugeUnits: 0.25, expiresAtFrame: 90 },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      classifyFreezeBrokenAttackTransition(
        V2,
        frozenRow({ auraBefore: [], auraAfter: [] }),
      ),
    ).toBeNull();
  });

  it("uses the local 1e-10 Aura boundary, not the reference-only 1e-11 threshold", () => {
    expect(
      classifyFreezeBrokenAttackTransition(
        V2,
        frozenRow({
          auraBefore: [
            { element: "frozen", gaugeUnits: 1.1e-10, expiresAtFrame: 60 },
          ],
          auraAfter: [],
        }),
      ),
    ).not.toBeNull();
    expect(
      classifyFreezeBrokenAttackTransition(
        V2,
        frozenRow({
          auraBefore: [
            { element: "frozen", gaugeUnits: 1e-10, expiresAtFrame: 60 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("requires the terminal Aura snapshot to remove the Frozen entry", () => {
    expect(
      classifyFreezeBrokenAttackTransition(
        V2,
        frozenRow({
          auraAfter: [
            { element: "frozen", gaugeUnits: 0, expiresAtFrame: null },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("collapses repeated observation of the same terminal row exactly once", () => {
    const terminal = frozenRow({ id: 7 });
    expect(
      collectFreezeBrokenAttackTransitions(V2, [terminal, terminal]),
    ).toEqual([
      expect.objectContaining({
        terminalFrozenStateLogId: 7,
        triggerSource: "natural-decay",
      }),
    ]);
  });

  it("keeps the source Freeze event distinct from the depletion event", () => {
    const row = buildFreezeBrokenAttackLogEntry({
      id: 3,
      mode: V2,
      frozenStateEntry: frozenRow({
        id: 7,
        reaction: "shatter",
        operation: "shatter-consume",
        generation: 2,
        triggerDamageEventId: 12,
      }),
      resolvedActorId: "first-party-actor",
      sourceFreezeDamageEventId: 4,
      depletionDamageEventId: 12,
      triggerEventType: "hit",
      triggerEventPriority: 3,
      triggerEventSequence: 8,
      intraEventSequence: 5,
    });

    expect(row).toMatchObject({
      id: 3,
      sourceFrozenStateLogId: 7,
      sourceFreezeDamageEventId: 4,
      depletionDamageEventId: 12,
      attack: {
        actorIndex: 0,
        resolvedActorId: "first-party-actor",
        damageSource: "receiving-target",
        damageSourceTargetId: "enemy-0",
        snapshotDelayFrames: -1,
        damageDelayFrames: 0,
      },
      syncPhase: {
        disposition: "reference-audit-only-not-dispatched",
      },
      endOfFramePhase: {
        disposition: "reference-audit-only-not-dispatched",
        damage: 0,
        relativeToTriggerEnemyDamage: "before",
      },
      executionStatus: "reference-audit-only-not-dispatched",
      damageEventId: null,
      hitResolutionLogId: null,
    });
  });

  it("marks natural expiry as having no trigger enemy-damage phase", () => {
    expect(
      buildFreezeBrokenAttackLogEntry({
        id: 0,
        mode: V2,
        frozenStateEntry: frozenRow(),
        resolvedActorId: "first-party-actor",
        sourceFreezeDamageEventId: 4,
        depletionDamageEventId: null,
        triggerEventType: "frozenExpiry",
        triggerEventPriority: 2,
        triggerEventSequence: 9,
        intraEventSequence: 0,
      })?.endOfFramePhase.relativeToTriggerEnemyDamage,
    ).toBe("not-applicable");
  });
});
