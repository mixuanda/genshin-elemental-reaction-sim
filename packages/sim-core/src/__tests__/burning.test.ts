import {
  burningReactionAuditSchema,
  burningStateLogEntrySchema,
  quickenDecayMutationAuditSchema,
  quickenStateLogEntrySchema,
  targetStateTimelineSchema,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { TargetLocalClock } from "../target-clock";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

function makeBurningConfig(
  overrides: {
    duration?: number;
    initialDendroGaugeUnits?: number;
    nearbyTarget?: boolean;
  } = {}
): SimConfig {
  const base = makeConfig();
  const duration = overrides.duration ?? 2.1;
  const targets: NonNullable<
    SimConfig["enemy"]["targets"]
  > = [
    {
      id: "enemy-0",
      name: "燃烧触发目标",
      position: { x: 0, y: 0 },
      initialAura: [
        {
          element: "dendro",
          gaugeUnits:
            overrides.initialDendroGaugeUnits ?? 1
        }
      ]
    }
  ];
  if (overrides.nearbyTarget === true) {
    targets.push({
      id: "enemy-1",
      name: "燃烧范围目标",
      position: { x: 0.5, y: 0 }
    });
  }
  return {
    ...base,
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v4"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "pyro-skill",
          actorId: "pyro",
          name: "Pyro Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-hit",
              label: "燃烧触发命中",
              frame: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: noIcd()
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "pyro-skill"
        }
      ]
    }
  };
}

describe("aura-v4 Burning lifecycle", () => {
  it.each([
    {
      initialElement: "dendro" as const,
      triggerElement: "pyro" as const
    },
    {
      initialElement: "pyro" as const,
      triggerElement: "dendro" as const
    }
  ])(
    "starts Burning for $triggerElement on $initialElement",
    ({ initialElement, triggerElement }) => {
      const audit = new AuraEngine({
        mode: "aura-v4",
        initialAura: [
          { element: initialElement, gaugeUnits: 1 }
        ]
      }).processHit({
        frame: 0,
        sourceActorId: "trigger",
        element: triggerElement,
        application: noIcd()
      });

      expect(audit).toMatchObject({
        triggered: true,
        reaction: "burning",
        reactions: ["burning"],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        burningReaction: {
          reaction: "burning",
          operation: "start",
          reactionTriggered: true,
          generation: 1,
          triggerElement,
          fuelOperation: "start",
          scheduled: true,
          blockedReason: null,
          damageSourceActorId: "trigger",
          fuelSourceActorId: "trigger",
          burningGaugeUnitsBefore: 0,
          candidateBurningGaugeUnits: 2,
          burningGaugeUnitsAfter: 2,
          burningDecayPerFrame: 0,
          burningExpiresAtFrame: null,
          fuelGaugeUnitsBefore: 0,
          candidateFuelGaugeUnits: 0.8,
          fuelGaugeUnitsAfter: 0.8,
          fuelDecayPerFrame: 1 / 150,
          fuelExpiresAtFrame: 121,
          snapshotFrame: 0,
          firstTickFrame: 15,
          nextTickFrame: 15,
          tickIntervalFrames: 15,
          skippedTickIndex: 9,
          damageElement: "pyro",
          baseMultiplier: 0.25,
          radius: 1,
          applicationGaugeUnits: 1,
          clockModel: "target-local-no-hitlag",
          hitlagStatus: "unsupported-enemy-hitlag",
          selfDamageStatus:
            "unsupported-player-damage-model"
        }
      });
      expect(audit.auraAfter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            element: "burning",
            gaugeUnits: 2
          }),
          expect.objectContaining({
            element: "burningFuel",
            gaugeUnits: 0.8
          })
        ])
      );
      expect(
        burningReactionAuditSchema.parse(
          audit.burningReaction
        )
      ).toEqual(audit.burningReaction);
    }
  );

  it("emits 1U tick slots at 15..120 and removes Burning/Fuel at frame 121", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const generation = start.burningReaction!.generation;
    const ticks = Array.from({ length: 8 }, (_, index) =>
      engine.prepareBurningTick(
        (index + 1) * 15,
        generation,
        index + 1
      )
    );
    const expiry = engine.expireBurningFuel(
      121,
      generation,
      121
    );

    expect(ticks.map((tick) => tick.frame)).toEqual([
      15, 30, 45, 60, 75, 90, 105, 120
    ]);
    expect(ticks.every((tick) => tick.operation === "tick")).toBe(
      true
    );
    expect(ticks.map((tick) => tick.nextTickFrame)).toEqual([
      30, 45, 60, 75, 90, 105, 120, 135
    ]);
    expect(expiry).toMatchObject({
      operation: "expire",
      frame: 121,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12),
      fuelGaugeUnitsAfter: 0,
      nextTickFrame: null,
      fuelExpiresAtFrame: null,
      reason: "FUEL_EXPIRED"
    });
    expect(expiry.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" }),
        expect.objectContaining({ element: "dendro" }),
        expect.objectContaining({ element: "quicken" })
      ])
    );
  });

  it("can evaluate a target-task Burning callback before the current-frame Fuel decay", () => {
    const makeEngine = () =>
      new AuraEngine({
        mode: "aura-v4",
        // 0.8 × 7/60U leaves exactly fourteen 1/150U Fuel decay
        // steps after Burning's attachment-frame grace. Fuel therefore
        // reaches zero on the same F15 target Tick as the first callback.
        initialAura: [
          { element: "dendro" as const, gaugeUnits: 7 / 60 }
        ]
      });
    const legacyEngine = makeEngine();
    const legacyStart = legacyEngine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const phasedEngine = makeEngine();
    const phasedStart = phasedEngine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });

    expect(legacyStart.burningReaction).toMatchObject({
      generation: 1,
      firstTickFrame: 15,
      fuelExpiresAtFrame: 15
    });
    expect(
      legacyEngine.prepareBurningTick(15, 1, 1)
    ).toMatchObject({
      operation: "stop",
      reason: "FUEL_EXPIRED"
    });

    const callback =
      phasedEngine.prepareBurningTickBeforeDecay(15, 1, 1);
    expect(callback).toMatchObject({
      operation: "tick",
      frame: 15,
      tickIndex: 1,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12),
      nextTickFrame: 30,
      reason: null
    });
    expect(
      phasedEngine.getAuraStateAt(15)
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
  });

  it("skips only slot 9, resumes slot 10, and keeps cadence across both refresh forms", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 2 }]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "pyro-start",
      element: "pyro",
      application: noIcd()
    });
    const generation = start.burningReaction!.generation;
    for (let index = 1; index <= 8; index += 1) {
      expect(
        engine.prepareBurningTick(
          index * 15,
          generation,
          index
        ).operation
      ).toBe("tick");
    }
    const skipped = engine.prepareBurningTick(
      135,
      generation,
      9
    );
    const resumed = engine.prepareBurningTick(
      150,
      generation,
      10
    );
    const dendroRefresh = engine.processHit({
      frame: 151,
      sourceActorId: "dendro-refresh",
      element: "dendro",
      application: noIcd(0.5)
    });
    const pyroRefresh = engine.processHit({
      frame: 152,
      sourceActorId: "pyro-refresh",
      element: "pyro",
      application: noIcd()
    });

    expect(skipped).toMatchObject({
      operation: "tick-skipped",
      tickIndex: 9,
      skipReason: "COUNTER_9_SKIP",
      nextTickFrame: 150
    });
    expect(resumed).toMatchObject({
      operation: "tick",
      tickIndex: 10,
      skipReason: null,
      nextTickFrame: 165
    });
    expect(dendroRefresh.burningReaction).toMatchObject({
      operation: "refresh-fuel",
      generation,
      fuelOperation: "overwrite",
      damageSourceActorId: "dendro-refresh",
      fuelSourceActorId: "dendro-refresh",
      candidateFuelGaugeUnits: 0.4,
      fuelGaugeUnitsAfter: 0.4,
      nextTickFrame: 165
    });
    expect(pyroRefresh.burningReaction).toMatchObject({
      operation: "refresh-snapshot",
      generation,
      fuelOperation: "unchanged",
      damageSourceActorId: "pyro-refresh",
      fuelSourceActorId: "dendro-refresh",
      candidateFuelGaugeUnits: 0.4,
      fuelGaugeUnitsAfter: 0.4,
      nextTickFrame: 165
    });
    for (const audit of [
      dendroRefresh.burningReaction,
      pyroRefresh.burningReaction
    ]) {
      expect(
        burningReactionAuditSchema.parse(audit)
      ).toEqual(audit);
    }
  });

  it("uses target-global Burning application ICD, clamps beyond the fixed sequence, and resets at 120f", () => {
    const engine = new AuraEngine({ mode: "aura-v4" });
    const frames = [
      15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 135
    ];
    const decisions = frames.map((frame) => {
      const audit = engine.processHit({
        frame,
        sourceActorId:
          frame % 30 === 0 ? "source-b" : "source-a",
        element: "pyro",
        application: {
          gaugeUnits: 1,
          icd: {
            mode: "legacy-boolean-profile-v1",
            icdTag: "burning-application",
            profileId: "burning"
          }
        }
      });
      return {
        allowed: audit.icdAllowed,
        decision:
          engine.getLastBurningApplicationIcdDecision()
      };
    });

    expect(decisions.map((entry) => entry.allowed)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true
    ]);
    expect(decisions.map((entry) => entry.decision?.hitIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0
    ]);
    expect(
      decisions.map(
        (entry) => entry.decision?.windowStartFrame
      )
    ).toEqual([
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 135
    ]);
  });

  it("preserves fixed reaction order for Overload → Burning", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "electro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });

    expect(audit).toMatchObject({
      reaction: "overload",
      reactions: ["overload", "burning"],
      transformativeReaction: {
        reaction: "overload",
        scheduled: true
      },
      burningReaction: {
        reaction: "burning",
        operation: "start",
        scheduled: true
      },
      unsupportedReactions: [],
      mechanicsTruncation: null
    });
  });

  it("records Burning before Bloom truncation and leaves no live or ghost Burning stream", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 }
      ]
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd()
    });
    const generation = audit.burningReaction!.generation;
    const ghost = engine.prepareBurningTick(15, generation, 1);

    expect(audit).toMatchObject({
      reaction: "burning",
      reactions: ["burning"],
      unsupportedReactions: ["bloom"],
      mechanicsTruncation: {
        operation: "trigger",
        startedAtFrame: 0,
        unsupportedReactions: ["bloom"]
      },
      auraAfter: [],
      burningReaction: {
        operation: "start",
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION",
        burningGaugeUnitsAfter: 0,
        fuelGaugeUnitsAfter: 0,
        fuelExpiresAtFrame: null,
        firstTickFrame: null,
        nextTickFrame: null
      }
    });
    expect(ghost).toMatchObject({
      operation: "stale",
      damageSourceActorId: null,
      nextTickFrame: null,
      reason: "SUPERSEDED_STREAM"
    });

    const clockedAudit = new AuraEngine({
      mode: "aura-v4",
      targetClock: new TargetLocalClock(),
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd()
    });
    expect(clockedAudit.burningReaction).toMatchObject({
      blockedReason: "TARGET_MECHANICS_TRUNCATION",
      fuelExpiresAtTargetFrame: null,
      firstTickTargetFrame: null,
      nextTickTargetFrame: null
    });
    expect(() =>
      burningReactionAuditSchema.parse(
        clockedAudit.burningReaction
      )
    ).not.toThrow();
  });

  it("stops immediately when a reaction consumes the Burning marker", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const stop = engine.processHit({
      frame: 1,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(10)
    });

    expect(stop.burningReaction).toMatchObject({
      operation: "stop",
      reactionTriggered: false,
      triggerElement: "cryo",
      fuelOperation: "remove",
      stopReason: "BURNING_AURA_CONSUMED",
      scheduled: false,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      nextTickFrame: null
    });
    expect(stop.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
    expect(stop.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "dendro",
          gaugeUnits: expect.any(Number)
        })
      ])
    );
    expect(
      burningReactionAuditSchema.parse(
        stop.burningReaction
      )
    ).toEqual(stop.burningReaction);
  });

  it.each([
    {
      label: "strictly before",
      fuelFrameLead: 1
    },
    {
      label: "on the same frame (Fuel wins the tie)",
      fuelFrameLead: 0
    }
  ])(
    "removes Quicken through Fuel when refreshed Fuel ends $label",
    ({ fuelFrameLead }) => {
      const engine = new AuraEngine({
        mode: "aura-v5",
        initialAura: [{ element: "electro", gaugeUnits: 1 }]
      });
      engine.processHit({
        frame: 0,
        sourceActorId: "dendro",
        element: "dendro",
        application: noIcd(1)
      });
      const burning = engine.processHit({
        frame: 1,
        sourceActorId: "pyro",
        element: "pyro",
        application: noIcd(1)
      });
      engine.processHit({
        frame: 2,
        sourceActorId: "physical",
        element: "physical"
      });

      const beforeRefresh =
        engine.getQuickenLifecycleState();
      const quickenFrames = Math.ceil(
        beforeRefresh.gaugeUnits /
          beforeRefresh.decayPerFrame -
          1e-9
      );
      const fuelFrames =
        quickenFrames - 1 - fuelFrameLead;
      const fuelGaugeUnits = fuelFrames / 150;
      const refresh = engine.processHit({
        frame: 2,
        sourceActorId: "dendro-refresh",
        element: "dendro",
        application: noIcd(fuelGaugeUnits / 0.8)
      });
      const burningAudit = refresh.burningReaction!;
      const mutation = burningAudit.quickenStateMutation;
      const fuelExpiryFrame = 2 + 1 + fuelFrames;

      expect(
        burning.burningReaction?.quickenStateMutation
      ).toMatchObject({
        operation: "decay-rebase",
        endCauseAfter: "QUICKEN_DECAY"
      });
      expect(
        burningReactionAuditSchema.parse(
          burning.burningReaction
        )
      ).toEqual(burning.burningReaction);
      expect(burningAudit).toMatchObject({
        operation: "refresh-fuel",
        fuelExpiresAtFrame: fuelExpiryFrame,
        quickenStateMutation: {
          operation: "decay-rebase",
          generationBefore: mutation.generationBefore,
          generationAfter: mutation.generationBefore + 1,
          quickenGaugeUnitsBefore:
            beforeRefresh.gaugeUnits,
          quickenGaugeUnitsAfter:
            beforeRefresh.gaugeUnits,
          expiresAtFrameBefore:
            beforeRefresh.expiresAtFrame,
          expiresAtFrameAfter: fuelExpiryFrame,
          endCauseBefore: "QUICKEN_DECAY",
          endCauseAfter: "BURNING_FUEL_EXPIRED"
        }
      });
      expect(
        burningReactionAuditSchema.parse(burningAudit)
      ).toEqual(burningAudit);
      if (fuelFrameLead === 0) {
        expect(mutation.expiresAtFrameBefore).toBe(
          mutation.expiresAtFrameAfter
        );
      } else {
        expect(mutation.expiresAtFrameAfter).toBe(
          mutation.expiresAtFrameBefore! - fuelFrameLead
        );
      }

      const fuelExpiry = engine.expireBurningFuel(
        fuelExpiryFrame,
        burningAudit.generation,
        fuelExpiryFrame
      );
      expect(fuelExpiry).toMatchObject({
        operation: "expire",
        reason: "FUEL_EXPIRED",
        quickenStateMutation: {
          operation: "remove",
          generationBefore: mutation.generationAfter,
          generationAfter: mutation.generationAfter + 1,
          endCauseBefore: "BURNING_FUEL_EXPIRED",
          endCauseAfter: null,
          expiresAtFrameBefore: fuelExpiryFrame,
          expiresAtFrameAfter: null
        }
      });
      expect(
        quickenDecayMutationAuditSchema.parse(
          fuelExpiry.quickenStateMutation
        )
      ).toEqual(fuelExpiry.quickenStateMutation);
      expect(
        engine.expireQuicken(
          mutation.expiresAtFrameBefore!,
          mutation.generationBefore,
          mutation.expiresAtFrameBefore!
        )
      ).toMatchObject({
        operation: "stale",
        expiresAtFrame: null
      });
    }
  );

  it("validates Fuel-driven Quicken expiry in the target-local clock domain", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v5",
      targetClock: clock,
      initialAura: [{ element: "electro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1)
    });
    engine.processHit({
      frame: 1,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(1)
    });
    engine.applyTargetHitlag({
      globalFrame: 1,
      haltFrames: 5,
      factor: 0
    });
    engine.processHit({
      frame: 2,
      sourceActorId: "physical",
      element: "physical"
    });

    const beforeRefresh = engine.getQuickenLifecycleState();
    const quickenFrames = Math.ceil(
      beforeRefresh.gaugeUnits /
        beforeRefresh.decayPerFrame -
        1e-9
    );
    const fuelFrames = quickenFrames - 1;
    const refresh = engine.processHit({
      frame: 2,
      sourceActorId: "dendro-refresh",
      element: "dendro",
      application: noIcd(fuelFrames / 150 / 0.8)
    });
    const burningAudit = refresh.burningReaction!;

    expect(clock.getState()).toMatchObject({
      globalFrame: 2,
      localFrame: 1,
      frozenFrames: 4
    });
    expect(burningAudit).toMatchObject({
      snapshotFrame: 2,
      snapshotTargetFrame: 1,
      fuelExpiresAtTargetFrame: 1 + 1 + fuelFrames,
      quickenStateMutation: {
        operation: "decay-rebase",
        endCauseAfter: "BURNING_FUEL_EXPIRED"
      }
    });
    expect(
      burningReactionAuditSchema.parse(burningAudit)
    ).toEqual(burningAudit);

    const coordinatedDrift = structuredClone(burningAudit);
    const quickenAfter =
      coordinatedDrift.quickenStateMutation.operationAuraAfter.find(
        (entry) => entry.element === "quicken"
      );
    if (
      coordinatedDrift.fuelExpiresAtTargetFrame ===
        undefined ||
      coordinatedDrift.fuelExpiresAtTargetFrame === null ||
      quickenAfter?.expiresAtTargetFrame === undefined ||
      quickenAfter.expiresAtTargetFrame === null
    ) {
      throw new Error(
        "Expected hitlag-aware Fuel and Quicken target deadlines"
      );
    }
    coordinatedDrift.fuelExpiresAtTargetFrame += 1;
    quickenAfter.expiresAtTargetFrame += 1;
    expect(() =>
      burningReactionAuditSchema.parse(coordinatedDrift)
    ).toThrow(/earlier Fuel or Quicken boundary/);
  });

  it("validates restored Quicken decay after a hitlag-aware Burning stop", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v5",
      targetClock: clock,
      initialAura: [{ element: "electro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1)
    });
    engine.processHit({
      frame: 1,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(1)
    });
    engine.applyTargetHitlag({
      globalFrame: 1,
      haltFrames: 5,
      factor: 0
    });
    const stopAudit = engine.processHit({
      frame: 2,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(10)
    }).burningReaction;

    expect(stopAudit).toMatchObject({
      operation: "stop",
      snapshotFrame: 2,
      snapshotTargetFrame: 1,
      quickenStateMutation: {
        operation: "decay-rebase",
        endCauseAfter: "QUICKEN_DECAY"
      }
    });
    expect(
      burningReactionAuditSchema.parse(stopAudit)
    ).toEqual(stopAudit);

    const coordinatedDrift = structuredClone(stopAudit!);
    const quickenAfter =
      coordinatedDrift.quickenStateMutation.operationAuraAfter.find(
        (entry) => entry.element === "quicken"
      );
    if (
      quickenAfter?.expiresAtTargetFrame === undefined ||
      quickenAfter.expiresAtTargetFrame === null
    ) {
      throw new Error(
        "Expected restored Quicken target-local expiry."
      );
    }
    quickenAfter.expiresAtTargetFrame += 1;
    expect(() =>
      burningReactionAuditSchema.parse(coordinatedDrift)
    ).toThrow(/intrinsic decay expiry/);
  });
});

describe("Burning simulation integration", () => {
  it("emits every 15..120 damage tick, exact composition, links, curve, and natural expiry", () => {
    const result = simulate(makeBurningConfig(), {
      critMode: "allCrit"
    });
    const direct = result.damageEvents.find(
      (event) => event.kind === "direct"
    )!;
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    expect(
      result.burningStateLog.map((entry) =>
        burningStateLogEntrySchema.parse(entry)
      )
    ).toEqual(result.burningStateLog);
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 0.25,
      effectiveResistance: 0.1
    });

    expect(expected.finalDamage).toBeCloseTo(
      638.6824735714285,
      12
    );
    expect(direct.reactionAudit.burningReaction).toMatchObject({
      operation: "start",
      firstTickFrame: 15,
      fuelExpiresAtFrame: 121
    });
    expect(ticks.map((event) => event.frame)).toEqual([
      15, 30, 45, 60, 75, 90, 105, 120
    ]);
    expect(
      ticks.every(
        (event) =>
          Math.abs(event.finalDamage - expected.finalDamage) <
            1e-10 &&
          event.displayDamage === 639 &&
          event.damageComposition.direct === 0 &&
          event.damageComposition.additiveReaction === 0 &&
          Math.abs(
            event.damageComposition.transformativeReaction -
              expected.finalDamage
          ) < 1e-10 &&
          event.damageFactors.defenseMultiplier === 1 &&
          event.damageFactors.critMultiplier === 1
      )
    ).toBe(true);
    expect(
      result.reactionDamageLog
        .filter((entry) => entry.reaction === "burning")
        .map((entry) => entry.damageFrame)
    ).toEqual([15, 30, 45, 60, 75, 90, 105, 120]);
    expect(
      result.burningStateLog
        .filter((entry) => entry.operation === "tick")
        .map((entry) => ({
          frame: entry.frame,
          tickIndex: entry.tickIndex,
          linkedDamageCount: entry.damageEventIds.length,
          hasReactionDamageLink:
            entry.reactionDamageLogId !== null
        }))
    ).toEqual(
      ticks.map((event, index) => ({
        frame: event.frame,
        tickIndex: index + 1,
        linkedDamageCount: 1,
        hasReactionDamageLink: true
      }))
    );
    expect(
      result.burningStateLog.at(-1)
    ).toMatchObject({
      operation: "fuel-expire",
      frame: 121,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      reason: "FUEL_EXPIRED"
    });
    expect(
      result.damageCurve.at(-1)?.cumulativeByReaction.burning
    ).toBeCloseTo(expected.finalDamage * 8, 10);
    expect(result.totalDamage).toBeCloseTo(
      expected.finalDamage * 8,
      10
    );
  });

  it("removes Quicken when Burning Fuel expires and leaves the old expiry stale", () => {
    const config = makeBurningConfig({ duration: 10.1 });
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 3;
    ability.animationEndFrame = 3;
    ability.hits = [
      {
        ...baseHit,
        id: "quicken-before-burning",
        label: "先生成激元素",
        frame: 0,
        element: "electro",
        application: noIcd()
      },
      {
        ...baseHit,
        id: "burning-removes-quicken",
        label: "燃烧开始重排激元素衰减",
        frame: 1,
        element: "pyro",
        application: noIcd()
      },
      {
        ...baseHit,
        id: "weak-dendro-shortens-fuel",
        label: "弱草覆写燃料并先于激元素耗尽",
        frame: 2,
        element: "dendro",
        application: noIcd(0.1)
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const quickenStart = result.quickenStateLog.find(
      (entry) => entry.operation === "start"
    )!;
    const quickenRemoval = result.quickenStateLog.find(
      (entry) => entry.operation === "remove"
    )!;
    const fuelExpiry = result.burningStateLog.find(
      (entry) => entry.operation === "fuel-expire"
    )!;
    const fuelExpiryTimelinePoint =
      result.targetStateTimeline.points.find(
        (point) => point.cause === "burning-fuel-expiry"
      )!;
    const staleQuickenExpiryPoint =
      result.targetStateTimeline.points.find(
        (point) =>
          point.cause === "quicken-expiry" &&
          point.frame === quickenStart.expiresAtFrame
      )!;

    expect(quickenStart.expiresAtFrame).toBeGreaterThan(
      fuelExpiry.frame
    );
    expect(
      result.quickenStateLog.map((entry) => entry.operation)
    ).toEqual([
      "start",
      "decay-rebase",
      "decay-rebase",
      "remove"
    ]);
    const rebases = result.quickenStateLog.filter(
      (entry) => entry.operation === "decay-rebase"
    );
    expect(rebases).toHaveLength(2);
    expect(rebases[0]).toMatchObject({
      frame: 1,
      generation: quickenStart.generation + 1,
      sourceActorId: quickenStart.sourceActorId,
      triggerDamageEventId:
        quickenStart.triggerDamageEventId,
      decayPerFrameBefore: quickenStart.decayPerFrameAfter,
      decayPerFrameAfter: 1 / 150,
      expiresAtFrameBefore: quickenStart.expiresAtFrame,
      expiresAtFrame: 121,
      endCauseBefore: "QUICKEN_DECAY",
      endCauseAfter: "QUICKEN_DECAY",
      reason: "BURNING_REBASED_QUICKEN_DECAY"
    });
    expect(rebases[1]).toMatchObject({
      frame: 2,
      generation: quickenStart.generation + 2,
      sourceActorId: quickenStart.sourceActorId,
      triggerDamageEventId:
        quickenStart.triggerDamageEventId,
      decayPerFrameBefore: 1 / 150,
      decayPerFrameAfter: 1 / 150,
      expiresAtFrameBefore: 121,
      expiresAtFrame: fuelExpiry.frame,
      endCauseBefore: "QUICKEN_DECAY",
      endCauseAfter: "BURNING_FUEL_EXPIRED",
      reason: "BURNING_REBASED_QUICKEN_DECAY"
    });
    for (const rebase of rebases) {
      expect(
        rebase.auraBefore.find(
          (entry) => entry.element === "quicken"
        )?.expiresAtFrame
      ).toBe(rebase.expiresAtFrameBefore);
      expect(
        rebase.auraAfter.find(
          (entry) => entry.element === "quicken"
        )?.expiresAtFrame
      ).toBe(rebase.expiresAtFrame);
    }
    expect(quickenRemoval).toMatchObject({
      operation: "remove",
      frame: fuelExpiry.frame,
      targetId: "enemy-0",
      sourceActorId: "pyro",
      triggerDamageEventId:
        quickenStart.triggerDamageEventId,
      generation: quickenStart.generation + 3,
      quickenGaugeUnitsBefore: expect.any(Number),
      quickenGaugeUnitsAfter: 0,
      decayPerFrameBefore: 1 / 150,
      decayPerFrameAfter: 0,
      expiresAtFrameBefore: fuelExpiry.frame,
      expiresAtFrame: null,
      endCauseBefore: "BURNING_FUEL_EXPIRED",
      endCauseAfter: null,
      reason: "BURNING_FUEL_EXPIRED"
    });
    expect(quickenRemoval.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "quicken" })
      ])
    );
    expect(fuelExpiryTimelinePoint.links).toEqual([
      {
        kind: "burning-state-log",
        id: fuelExpiry.id
      },
      {
        kind: "quicken-state-log",
        id: quickenRemoval.id
      }
    ]);
    expect(staleQuickenExpiryPoint).toMatchObject({
      pointKind: "observation",
      links: []
    });
    expect(
      result.targetStateTimeline.points
        .filter(
          (point) =>
            point.cause === "direct-hit-application" &&
            (point.frame === 1 || point.frame === 2)
        )
        .map((point) => point.links)
    ).toEqual([
      [
        { kind: "damage-event", id: 1 },
        { kind: "quicken-state-log", id: rebases[0]!.id }
      ],
      [
        { kind: "damage-event", id: 2 },
        { kind: "quicken-state-log", id: rebases[1]!.id }
      ]
    ]);
    expect(
      result.quickenStateLog.some(
        (entry) =>
          entry.operation === "expire" &&
          entry.frame === quickenStart.expiresAtFrame
      )
    ).toBe(false);
    for (const entry of result.quickenStateLog) {
      expect(quickenStateLogEntrySchema.parse(entry)).toEqual(
        entry
      );
    }
    expect(
      targetStateTimelineSchema.parse(
        result.targetStateTimeline
      )
    ).toEqual(result.targetStateTimeline);
  });

  it("lets the authoritative Fuel event win when an older Quicken expiry is queued first on the same frame", () => {
    const config = makeBurningConfig({ duration: 10.1 });
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 3;
    ability.animationEndFrame = 3;
    ability.hits = [
      {
        ...baseHit,
        id: "tie-quicken",
        label: "生成激元素",
        frame: 0,
        element: "electro",
        application: noIcd(1)
      },
      {
        ...baseHit,
        id: "tie-burning",
        label: "燃烧把激元素自然到期重排至121帧",
        frame: 1,
        element: "pyro",
        application: noIcd(1)
      },
      {
        ...baseHit,
        id: "tie-fuel-refresh",
        label: "弱草把燃料到期也重排至121帧",
        frame: 2,
        element: "dendro",
        application: noIcd((118 / 150) / 0.8)
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const frame121 = result.targetStateTimeline.points.filter(
      (point) =>
        point.frame === 121 &&
        (point.cause === "quicken-expiry" ||
          point.cause === "burning-fuel-expiry")
    );
    const staleOldFuel = result.targetStateTimeline.points.find(
      (point) =>
        point.frame === 122 &&
        point.cause === "burning-fuel-expiry"
    );
    const fuelExpiry = result.burningStateLog.find(
      (entry) =>
        entry.operation === "fuel-expire" &&
        entry.frame === 121
    )!;
    const quickenRemoval = result.quickenStateLog.find(
      (entry) =>
        entry.operation === "remove" &&
        entry.frame === 121
    )!;

    expect(
      result.quickenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation,
        endCauseAfter: entry.endCauseAfter
      }))
    ).toEqual([
      {
        operation: "start",
        frame: 0,
        generation: 1,
        endCauseAfter: "QUICKEN_DECAY"
      },
      {
        operation: "decay-rebase",
        frame: 1,
        generation: 2,
        endCauseAfter: "QUICKEN_DECAY"
      },
      {
        operation: "decay-rebase",
        frame: 2,
        generation: 3,
        endCauseAfter: "BURNING_FUEL_EXPIRED"
      },
      {
        operation: "remove",
        frame: 121,
        generation: 4,
        endCauseAfter: null
      }
    ]);
    expect(frame121.map((point) => point.cause)).toEqual([
      "quicken-expiry",
      "burning-fuel-expiry"
    ]);
    expect(frame121[0]).toMatchObject({
      pointKind: "observation",
      links: []
    });
    expect(frame121[1]).toMatchObject({
      pointKind: "mutation",
      links: [
        { kind: "burning-state-log", id: fuelExpiry.id },
        { kind: "quicken-state-log", id: quickenRemoval.id }
      ]
    });
    expect(staleOldFuel).toMatchObject({
      pointKind: "observation",
      links: []
    });
    expect(
      result.burningStateLog.filter(
        (entry) => entry.operation === "fuel-expire"
      )
    ).toHaveLength(1);
    expect(
      result.quickenStateLog.some(
        (entry) => entry.operation === "expire"
      )
    ).toBe(false);
  });

  it("resolves each Burning tick independently on a nearby target", () => {
    const result = simulate(
      makeBurningConfig({
        duration: 1,
        nearbyTarget: true
      }),
      { critMode: "noCrit" }
    );
    const tickDamage = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    const burningLog = result.reactionDamageLog.find(
      (entry) => entry.reaction === "burning"
    );

    expect(
      tickDamage.map((event) => ({
        targetId: event.targetId,
        parentDamageEventId: event.parentDamageEventId,
        frame: event.frame
      }))
    ).toEqual(
      [15, 30, 45, 60].flatMap((frame) => [
        {
          targetId: "enemy-0",
          parentDamageEventId: expect.any(Number),
          frame
        },
        {
          targetId: "enemy-1",
          parentDamageEventId: expect.any(Number),
          frame
        }
      ])
    );
    expect(burningLog).toMatchObject({
      scheduleKind: "burning-tick",
      targetingMode: "radius",
      centerPosition: { x: 0, y: 0 },
      radius: 1,
      checkedTargetIds: ["enemy-0", "enemy-1"],
      hitTargetIds: ["enemy-0", "enemy-1"],
      damageEventIds: tickDamage
        .filter((event) => event.frame === 15)
        .map((event) => event.id)
    });
  });

  it("resolves same-frame multi-target Burning ticks atomically in target order", () => {
    const config = makeBurningConfig({
      duration: 1,
      nearbyTarget: true
    });
    const targets = config.enemy.targets!;
    targets[1]!.initialAura = [
      { element: "dendro", gaugeUnits: 1 }
    ];
    const hit = config.timeline!.abilities[0]!.hits![0]!;
    hit.targeting = {
      mode: "fanout",
      targets: [
        { targetId: "enemy-0", outcome: "landed" },
        { targetId: "enemy-1", outcome: "landed" }
      ]
    };

    const result = simulate(config, { critMode: "noCrit" });
    const tickLogs = result.reactionDamageLog.filter(
      (entry) =>
        entry.reaction === "burning" &&
        entry.damageFrame === 15
    );
    const firstTargetTick = tickLogs.find(
      (entry) => entry.sourceTargetId === "enemy-0"
    )!;
    const secondTargetTick = tickLogs.find(
      (entry) => entry.sourceTargetId === "enemy-1"
    )!;
    const firstTickDamageOnSecondTarget =
      result.damageEvents.find(
        (event) =>
          firstTargetTick.damageEventIds.includes(event.id) &&
          event.targetId === "enemy-1"
      )!;
    const secondTickState = result.burningStateLog.find(
      (entry) =>
        entry.operation === "tick" &&
        entry.frame === 15 &&
        entry.targetId === "enemy-1"
    )!;

    expect(tickLogs.map((entry) => entry.sourceTargetId)).toEqual([
      "enemy-0",
      "enemy-1"
    ]);
    expect(secondTargetTick.triggerDamageEventId).toBe(
      firstTickDamageOnSecondTarget.id
    );
    expect(firstTickDamageOnSecondTarget.eventPriority).toBeLessThan(
      secondTickState.eventPriority
    );
    expect(secondTickState.eventPriority).toBeLessThan(
      result.damageEvents.find(
        (event) =>
          secondTargetTick.damageEventIds.includes(event.id)
      )!.eventPriority
    );
  });

  it("separates damage immunity, Aura blocking, and Burning ICD decisions", () => {
    const config = makeBurningConfig({ duration: 1 });
    config.enemy.targetPhases = [
      {
        id: "burning-damage-immune",
        label: "燃烧伤害免疫",
        targetId: "enemy-0",
        startFrame: 15,
        endFrame: 30,
        reason: "BURNING_DAMAGE_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      },
      {
        id: "burning-aura-blocked",
        label: "燃烧附着阻断",
        targetId: "enemy-0",
        startFrame: 30,
        endFrame: 45,
        reason: "BURNING_AURA_BLOCKED",
        effects: {
          damage: "normal",
          aura: "blocked",
          hitConfirm: "normal"
        }
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const tickDamage = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning" &&
        event.frame <= 45
    );
    const tickLog = result.burningStateLog.filter(
      (entry) =>
        entry.operation === "tick" && entry.frame <= 45
    );

    expect(
      tickDamage.map((event) => ({
        frame: event.frame,
        policy: event.targetDamagePolicy,
        finalDamage: event.finalDamage
      }))
    ).toEqual([
      { frame: 15, policy: "immune", finalDamage: 0 },
      {
        frame: 30,
        policy: "normal",
        finalDamage: expect.any(Number)
      },
      {
        frame: 45,
        policy: "normal",
        finalDamage: expect.any(Number)
      }
    ]);
    expect(tickDamage[1]!.finalDamage).toBeGreaterThan(0);
    expect(tickDamage[2]!.finalDamage).toBeGreaterThan(0);
    expect(
      tickLog.map((entry) => ({
        frame: entry.frame,
        damageAllowed: entry.damageAllowed,
        applicationAllowed: entry.applicationAllowed,
        applicationBlockedReason:
          entry.applicationBlockedReason,
        icdWindowStartFrame: entry.icdWindowStartFrame,
        icdHitIndex: entry.icdHitIndex
      }))
    ).toEqual([
      {
        frame: 15,
        damageAllowed: false,
        applicationAllowed: true,
        applicationBlockedReason: null,
        icdWindowStartFrame: 15,
        icdHitIndex: 0
      },
      {
        frame: 30,
        damageAllowed: true,
        applicationAllowed: null,
        applicationBlockedReason: "TARGET_AURA_BLOCKED",
        icdWindowStartFrame: null,
        icdHitIndex: null
      },
      {
        frame: 45,
        damageAllowed: true,
        applicationAllowed: false,
        applicationBlockedReason: "BURNING_APPLICATION_ICD",
        icdWindowStartFrame: 15,
        icdHitIndex: 1
      }
    ]);
  });
});
