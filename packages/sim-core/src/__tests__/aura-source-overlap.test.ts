import { describe, expect, it } from "vitest";
import type { AuraReactionEngineConfig } from "@genshin-dps-lab/schemas";
import { AuraEngine } from "../aura";

type AuraMode = AuraReactionEngineConfig["mode"];

const MODES = [
  "aura-v6",
  "aura-v7",
  "aura-v8",
  "aura-v9"
] as const satisfies readonly AuraMode[];

function apply(
  engine: AuraEngine,
  input: {
    frame?: number;
    sourceActorId: string;
    element: "cryo" | "dendro" | "electro" | "hydro" | "pyro";
    gaugeUnits: number;
  }
) {
  return engine.processHit({
    frame: input.frame ?? 0,
    sourceActorId: input.sourceActorId,
    element: input.element,
    application: {
      gaugeUnits: input.gaugeUnits,
      icdTag: "aura-source-overlap",
      icdGroup: "no-icd"
    }
  });
}

function observe(engine: AuraEngine, frame: number) {
  return engine.processHit({
    frame,
    sourceActorId: "observer",
    element: "physical"
  });
}

function startQuicken(mode: AuraMode, nominalGaugeUnits: number) {
  const engine = new AuraEngine({
    mode,
    initialAura: [
      { element: "dendro", gaugeUnits: nominalGaugeUnits }
    ]
  });
  const audit = apply(engine, {
    sourceActorId: "quicken-starter",
    element: "electro",
    gaugeUnits: nominalGaugeUnits
  });
  return { engine, audit };
}

/**
 * Source-overlap contract frozen against fixed gcsim b4ae769. These tests
 * deliberately cover the already-legal v6-v9 behavior only; they do not
 * claim that the surrounding Aura/reaction model has complete gcsim parity.
 */
describe.each(MODES)("AuraEngine %s source overlap", (mode) => {
  it("keeps the first shared decay for different-source non-Pyro 0.5U -> 1U and expires at F990", () => {
    const engine = new AuraEngine({ mode });
    apply(engine, {
      sourceActorId: "source-a-weak",
      element: "cryo",
      gaugeUnits: 0.5
    });
    const overlap = apply(engine, {
      sourceActorId: "source-b-strong",
      element: "cryo",
      gaugeUnits: 1
    });

    expect(overlap.auraAfter).toEqual([
      {
        element: "cryo",
        gaugeUnits: 0.8,
        expiresAtFrame: 990,
        sourceSlots: [
          {
            sourceActorId: "source-a-weak",
            gaugeUnits: 0.4
          },
          {
            sourceActorId: "source-b-strong",
            gaugeUnits: 0.8
          }
        ]
      }
    ]);

    expect(observe(engine, 989).auraBefore).toEqual([
      {
        element: "cryo",
        gaugeUnits: expect.closeTo(0.4 / 495, 12),
        expiresAtFrame: 990,
        sourceSlots: [
          {
            sourceActorId: "source-b-strong",
            gaugeUnits: expect.closeTo(0.4 / 495, 12)
          }
        ]
      }
    ]);
    expect(observe(engine, 990).auraBefore).toEqual([]);
  });

  it("refreshes a same-source non-Pyro 1U -> 2U slot without replacing the first decay", () => {
    const engine = new AuraEngine({ mode });
    apply(engine, {
      sourceActorId: "shared-source",
      element: "cryo",
      gaugeUnits: 1
    });
    const refreshed = apply(engine, {
      sourceActorId: "shared-source",
      element: "cryo",
      gaugeUnits: 2
    });

    expect(refreshed.auraAfter).toEqual([
      {
        element: "cryo",
        gaugeUnits: 1.6,
        expiresAtFrame: 1140,
        sourceSlots: [
          {
            sourceActorId: "shared-source",
            gaugeUnits: 1.6
          }
        ]
      }
    ]);
    expect(observe(engine, 1139).auraBefore).toMatchObject([
      {
        element: "cryo",
        expiresAtFrame: 1140,
        sourceSlots: [
          {
            sourceActorId: "shared-source",
            gaugeUnits: expect.closeTo(0.8 / 570, 12)
          }
        ]
      }
    ]);
    expect(observe(engine, 1140).auraBefore).toEqual([]);
  });

  it("keeps every equal-strength owner and emits source slots in stable code-unit order", () => {
    const sourceActorIds = Array.from(
      { length: 32 },
      (_, index) => `owner-${String(31 - index).padStart(2, "0")}`
    );
    const engine = new AuraEngine({ mode });
    for (const sourceActorId of sourceActorIds) {
      apply(engine, {
        sourceActorId,
        element: "cryo",
        gaugeUnits: 1
      });
    }

    const sourceSlots = engine.getAuraStateAt(0)[0]?.sourceSlots;
    expect(sourceSlots).toHaveLength(sourceActorIds.length);
    expect(sourceSlots?.map((slot) => slot.sourceActorId)).toEqual(
      [...sourceActorIds].sort()
    );
    expect(sourceSlots?.map((slot) => slot.gaugeUnits)).toEqual(
      Array.from({ length: sourceActorIds.length }, () => 0.8)
    );
  });

  it("ignores weaker Pyro overlap and keeps the original shared deadline", () => {
    const engine = new AuraEngine({ mode });
    apply(engine, {
      sourceActorId: "pyro-owner",
      element: "pyro",
      gaugeUnits: 1
    });
    const weak = apply(engine, {
      frame: 60,
      sourceActorId: "ignored-weak-owner",
      element: "pyro",
      gaugeUnits: 0.5
    });

    expect(weak.auraAfter).toEqual([
      {
        element: "pyro",
        gaugeUnits: expect.closeTo(0.8 - (60 * 0.8) / 570, 12),
        expiresAtFrame: 570,
        sourceSlots: [
          {
            sourceActorId: "pyro-owner",
            gaugeUnits: expect.closeTo(
              0.8 - (60 * 0.8) / 570,
              12
            )
          }
        ]
      }
    ]);
  });

  it.each([
    {
      label: "equal",
      incomingGaugeUnits: 1,
      expectedGaugeUnits: 0.8,
      expectedExpiryFrame: 630
    },
    {
      label: "stronger",
      incomingGaugeUnits: 2,
      expectedGaugeUnits: 1.6,
      expectedExpiryFrame: 780
    }
  ] as const)(
    "refreshes the shared Pyro deadline for an $label application",
    ({ incomingGaugeUnits, expectedGaugeUnits, expectedExpiryFrame }) => {
      const engine = new AuraEngine({ mode });
      apply(engine, {
        sourceActorId: "pyro-owner",
        element: "pyro",
        gaugeUnits: 1
      });
      const refreshed = apply(engine, {
        frame: 60,
        sourceActorId: "refresh-owner",
        element: "pyro",
        gaugeUnits: incomingGaugeUnits
      });

      expect(refreshed.auraAfter?.[0]).toMatchObject({
        element: "pyro",
        gaugeUnits: expectedGaugeUnits,
        expiresAtFrame: expectedExpiryFrame,
        sourceSlots: expect.arrayContaining([
          {
            sourceActorId: "refresh-owner",
            gaugeUnits: expectedGaugeUnits
          }
        ])
      });
      expect(
        observe(engine, expectedExpiryFrame - 1).auraBefore?.[0]
      ).toMatchObject({ expiresAtFrame: expectedExpiryFrame });
      expect(observe(engine, expectedExpiryFrame).auraBefore).toEqual(
        []
      );
    }
  );

  it("keeps weaker Quicken unchanged and refreshes equal or stronger candidates", () => {
    const weaker = startQuicken(mode, 2);
    apply(weaker.engine, {
      sourceActorId: "electro-reserve",
      element: "electro",
      gaugeUnits: 2
    });
    const weakerAudit = apply(weaker.engine, {
      sourceActorId: "weak-quicken-candidate",
      element: "dendro",
      gaugeUnits: 0.5
    });

    expect(weaker.audit.catalyzeReaction?.quicken).toMatchObject({
      operation: "start",
      candidateGaugeUnits: 1.6,
      quickenGaugeUnitsAfter: 1.6,
      generation: 1,
      expiresAtFrame: 840
    });
    expect(weakerAudit.catalyzeReaction?.quicken).toMatchObject({
      operation: "unchanged",
      candidateGaugeUnits: 0.5,
      quickenGaugeUnitsBefore: 1.6,
      quickenGaugeUnitsAfter: 1.6,
      generation: 1,
      expiresAtFrameBefore: 840,
      expiresAtFrame: 840
    });

    const equal = startQuicken(mode, 2);
    apply(equal.engine, {
      sourceActorId: "electro-reserve",
      element: "electro",
      gaugeUnits: 2
    });
    const equalAudit = apply(equal.engine, {
      sourceActorId: "equal-quicken-candidate",
      element: "dendro",
      gaugeUnits: 2
    });
    expect(equalAudit.catalyzeReaction?.quicken).toMatchObject({
      operation: "refresh",
      candidateGaugeUnits: 1.6,
      quickenGaugeUnitsBefore: 1.6,
      quickenGaugeUnitsAfter: 1.6,
      generation: 2,
      expiresAtFrameBefore: 840,
      expiresAtFrame: 840
    });

    const stronger = startQuicken(mode, 1);
    apply(stronger.engine, {
      sourceActorId: "electro-reserve",
      element: "electro",
      gaugeUnits: 2
    });
    const strongerAudit = apply(stronger.engine, {
      sourceActorId: "strong-quicken-candidate",
      element: "dendro",
      gaugeUnits: 2
    });
    expect(strongerAudit.catalyzeReaction?.quicken).toMatchObject({
      operation: "refresh",
      candidateGaugeUnits: 1.6,
      quickenGaugeUnitsBefore: 0.8,
      quickenGaugeUnitsAfter: 1.6,
      generation: 2,
      expiresAtFrameBefore: 600,
      expiresAtFrame: 840
    });
  });

  it("applies the same natural-decay and reaction-consumption budget to every source slot", () => {
    const engine = new AuraEngine({ mode });
    apply(engine, {
      sourceActorId: "source-a-weak",
      element: "hydro",
      gaugeUnits: 0.5
    });
    apply(engine, {
      sourceActorId: "source-b-strong",
      element: "hydro",
      gaugeUnits: 1
    });
    const vaporize = apply(engine, {
      frame: 30,
      sourceActorId: "pyro-trigger",
      element: "pyro",
      gaugeUnits: 0.5
    });

    const beforeSlots = vaporize.auraBefore?.[0]?.sourceSlots ?? [];
    expect(beforeSlots).toHaveLength(2);
    expect(0.4 - beforeSlots[0]!.gaugeUnits).toBeCloseTo(
      0.8 - beforeSlots[1]!.gaugeUnits,
      12
    );
    expect(vaporize).toMatchObject({
      reaction: "reverseVaporize",
      auraConsumed: [
        {
          element: "hydro",
          gaugeUnits: 0.25,
          sourceMutations: [
            {
              sourceActorId: "source-a-weak",
              consumedGaugeUnits: 0.25
            },
            {
              sourceActorId: "source-b-strong",
              consumedGaugeUnits: 0.25
            }
          ]
        }
      ]
    });
    for (const mutation of
      vaporize.auraConsumed?.[0]?.sourceMutations ?? []) {
      expect(
        mutation.gaugeUnitsBefore - mutation.gaugeUnitsAfter
      ).toBeCloseTo(0.25, 12);
    }
  });
});
