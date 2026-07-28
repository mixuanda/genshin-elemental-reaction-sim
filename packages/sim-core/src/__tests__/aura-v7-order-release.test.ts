import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";

/**
 * These ordered-chain vectors freeze the repository's provisional behavior
 * cross-checked against genshinsim/gcsim commit
 * b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541. Synthetic multi-Aura states are
 * regression inputs, not a claim that every state is naturally reachable or
 * independently verified as live-server truth.
 */

type AuraAudit = ReturnType<AuraEngine["processHit"]>;

function noIcd(gaugeUnits: number) {
  return {
    gaugeUnits,
    icdTag: "aura-v7-order-release",
    icdGroup: "no-icd" as const
  };
}

function defaultIcd(gaugeUnits: number) {
  return {
    gaugeUnits,
    icdTag: "aura-v7-order-release",
    icdGroup: "default" as const
  };
}

function projectCore(audit: AuraAudit) {
  return {
    model: audit.model,
    triggered: audit.triggered,
    reaction: audit.reaction,
    reactions: audit.reactions,
    unsupportedReactions: audit.unsupportedReactions,
    mechanicsTruncation: audit.mechanicsTruncation,
    icdAllowed: audit.icdAllowed,
    applicationGaugeUnits: audit.applicationGaugeUnits,
    auraConsumed:
      audit.auraConsumed?.map(({ element, gaugeUnits }) => ({
        element,
        gaugeUnits
      })) ?? null,
    auraAfter:
      audit.auraAfter?.map(
        ({ element, gaugeUnits, expiresAtFrame }) => ({
          element,
          gaugeUnits,
          expiresAtFrame
        })
      ) ?? null
  };
}

function projectTransformative(audit: AuraAudit) {
  const entries =
    audit.transformativeReactions ??
    (audit.transformativeReaction === null
      ? []
      : [audit.transformativeReaction]);
  return entries.map(
    ({
      reaction,
      damageElement,
      scheduled,
      damageFrame,
      blockedReason,
      nextAvailableFrame
    }) => ({
      reaction,
      damageElement,
      scheduled,
      damageFrame,
      blockedReason,
      nextAvailableFrame
    })
  );
}

function projectBloom(audit: AuraAudit) {
  return audit.bloomReactions.map(
    ({
      operation,
      triggerElement,
      sourceBudget,
      sourceGaugeUnitsBefore,
      sourceGaugeUnitsSpent,
      sourceGaugeUnitsAfter,
      hydroGaugeUnitsBefore,
      hydroConsumedGaugeUnits,
      hydroGaugeUnitsAfter,
      dendroGaugeUnitsBefore,
      dendroConsumedGaugeUnits,
      dendroGaugeUnitsAfter,
      quickenGaugeUnitsBefore,
      quickenConsumedGaugeUnits,
      quickenGaugeUnitsAfter,
      scheduled,
      coreSpawnFrame,
      blockedReason,
      mechanicsDataStatus
    }) => ({
      operation,
      triggerElement,
      sourceBudget,
      sourceGaugeUnitsBefore,
      sourceGaugeUnitsSpent,
      sourceGaugeUnitsAfter,
      hydroGaugeUnitsBefore,
      hydroConsumedGaugeUnits,
      hydroGaugeUnitsAfter,
      dendroGaugeUnitsBefore,
      dendroConsumedGaugeUnits,
      dendroGaugeUnitsAfter,
      quickenGaugeUnitsBefore,
      quickenConsumedGaugeUnits,
      quickenGaugeUnitsAfter,
      scheduled,
      coreSpawnFrame,
      blockedReason,
      mechanicsDataStatus
    })
  );
}

describe("aura-v7 basic ordered reaction release gate", () => {
  it("freezes the provisional Pyro Overload → reverse Vaporize → Melt → Burning chain", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "electro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(3)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "melt",
      reactions: [
        "overload",
        "reverseVaporize",
        "melt",
        "burning"
      ],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 3,
      auraConsumed: [
        { element: "electro", gaugeUnits: 0.8 },
        { element: "hydro", gaugeUnits: 0.8 },
        { element: "cryo", gaugeUnits: 0.8 }
      ],
      auraAfter: [
        {
          element: "burning",
          gaugeUnits: 2,
          expiresAtFrame: null
        },
        {
          element: "burningFuel",
          gaugeUnits: 0.8,
          expiresAtFrame: 121
        },
        {
          element: "dendro",
          gaugeUnits: 0.8,
          expiresAtFrame: 120
        }
      ]
    });
    expect(projectTransformative(audit)).toEqual([
      {
        reaction: "overload",
        damageElement: "pyro",
        scheduled: true,
        damageFrame: 1,
        blockedReason: null,
        nextAvailableFrame: 6
      }
    ]);
    expect(
      audit.burningReaction === null
        ? null
        : {
            operation: audit.burningReaction.operation,
            reactionTriggered:
              audit.burningReaction.reactionTriggered,
            candidateFuelGaugeUnits:
              audit.burningReaction.candidateFuelGaugeUnits,
            fuelGaugeUnitsAfter:
              audit.burningReaction.fuelGaugeUnitsAfter,
            fuelExpiresAtFrame:
              audit.burningReaction.fuelExpiresAtFrame,
            firstTickFrame:
              audit.burningReaction.firstTickFrame
          }
    ).toEqual({
      operation: "start",
      reactionTriggered: true,
      candidateFuelGaugeUnits: 0.8,
      fuelGaugeUnitsAfter: 0.8,
      fuelExpiresAtFrame: 121,
      firstTickFrame: 15
    });
    expect(projectBloom(audit)).toEqual([]);
  });

  it("keeps Frozen as an explicit guard against Pyro Vaporize before Melt", () => {
    // Fixed gcsim vaporize.go explicitly rejects Pyro Vaporize while Frozen
    // exists, even when an ordinary Hydro slot also remains. Melt then
    // consumes Frozen according to the Pyro reaction order.
    const engine = new AuraEngine({
      mode: "aura-v7",
      initialAura: [{ element: "hydro", gaugeUnits: 1.25 }]
    });
    const freeze = engine.processHit({
      frame: 0,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(0.5)
    });
    const pyro = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(1)
    });

    expect(projectCore(freeze)).toMatchObject({
      reaction: "freeze",
      reactions: ["freeze"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      auraAfter: [
        {
          element: "frozen",
          gaugeUnits: 1,
          expiresAtFrame: 120
        },
        {
          element: "hydro",
          gaugeUnits: 0.5,
          expiresAtFrame: 304
        }
      ]
    });
    expect(projectCore(pyro)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "melt",
      reactions: ["melt"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 1,
      auraConsumed: [
        {
          element: "frozen",
          gaugeUnits: 1
        }
      ],
      auraAfter: [
        {
          element: "hydro",
          gaugeUnits: 0.5,
          expiresAtFrame: 304
        }
      ]
    });
    expect(pyro.frozenReaction).toMatchObject({
      operation: "consume",
      consumedGaugeUnits: 1,
      frozenGaugeBefore: 1,
      frozenGaugeAfter: 0
    });
  });

  it("freezes Hydro Vaporize → Freeze → Bloom and rejects the post-Freeze Electro-Charged branch", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(3)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "vaporize",
      reactions: ["vaporize", "freeze", "bloom"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 3,
      auraConsumed: [
        { element: "pyro", gaugeUnits: 0.8 },
        { element: "cryo", gaugeUnits: 0.8 },
        { element: "dendro", gaugeUnits: 0.8 }
      ],
      auraAfter: [
        {
          element: "electro",
          gaugeUnits: 0.8,
          expiresAtFrame: 570
        },
        {
          element: "frozen",
          gaugeUnits: 1.6,
          expiresAtFrame: 176
        }
      ]
    });
    expect(audit.periodicReaction).toBeNull();
    expect(audit.frozenReaction).toEqual({
      generation: 1,
      operation: "start",
      freezeResistance: 0,
      generatedGaugeUnits: 1.6,
      consumedGaugeUnits: 0,
      frozenGaugeBefore: 0,
      frozenGaugeAfter: 1.6,
      decayRatePerFrame: 0.006666666666666667,
      expiresAtFrame: 176
    });
    expect(projectBloom(audit)).toEqual([
      {
        operation: "direct",
        triggerElement: "hydro",
        sourceBudget: "incoming-application",
        sourceGaugeUnitsBefore: 1.8,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 0.2,
        hydroGaugeUnitsBefore: 0,
        hydroConsumedGaugeUnits: 0,
        hydroGaugeUnitsAfter: 0,
        dendroGaugeUnitsBefore: 0.8,
        dendroConsumedGaugeUnits: 0.8,
        dendroGaugeUnitsAfter: 0,
        quickenGaugeUnitsBefore: 0,
        quickenConsumedGaugeUnits: 0,
        quickenGaugeUnitsAfter: 0,
        scheduled: true,
        coreSpawnFrame: 30,
        blockedReason: null,
        mechanicsDataStatus: "fixed-gcsim-provisional"
      }
    ]);
  });

  it("freezes the provisional Cryo Superconduct → reverse Melt → Freeze chain", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "electro", gaugeUnits: 1 },
        { element: "pyro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(2)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "reverseMelt",
      reactions: ["superconduct", "reverseMelt", "freeze"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 2,
      auraConsumed: [
        { element: "electro", gaugeUnits: 0.8 },
        { element: "pyro", gaugeUnits: 0.6 },
        { element: "hydro", gaugeUnits: 0.8 }
      ],
      auraAfter: [
        {
          element: "frozen",
          gaugeUnits: 1.6,
          expiresAtFrame: 176
        },
        {
          element: "pyro",
          gaugeUnits: 0.2,
          expiresAtFrame: 143
        }
      ]
    });
    expect(projectTransformative(audit)).toEqual([
      {
        reaction: "superconduct",
        damageElement: "cryo",
        scheduled: true,
        damageFrame: 1,
        blockedReason: null,
        nextAvailableFrame: 6
      }
    ]);
    expect(audit.frozenReaction).toEqual({
      generation: 1,
      operation: "start",
      freezeResistance: 0,
      generatedGaugeUnits: 1.6,
      consumedGaugeUnits: 0,
      frozenGaugeBefore: 0,
      frozenGaugeAfter: 1.6,
      decayRatePerFrame: 0.006666666666666667,
      expiresAtFrame: 176
    });
  });

  it("freezes Electro Overload → EC → Superconduct → Quicken and leaves Bloom for the v7 task", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "pyro", gaugeUnits: 0.5 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 0.5 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(2)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "overload",
      reactions: [
        "overload",
        "electroCharged",
        "superconduct",
        "quicken"
      ],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 2,
      auraConsumed: [
        { element: "pyro", gaugeUnits: 0.4 },
        { element: "cryo", gaugeUnits: 0.4 },
        { element: "dendro", gaugeUnits: 0.8 }
      ],
      auraAfter: [
        {
          element: "hydro",
          gaugeUnits: 0.8,
          expiresAtFrame: 570
        },
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 600
        }
      ]
    });
    expect(projectTransformative(audit)).toEqual([
      {
        reaction: "overload",
        damageElement: "pyro",
        scheduled: true,
        damageFrame: 1,
        blockedReason: null,
        nextAvailableFrame: 6
      },
      {
        reaction: "superconduct",
        damageElement: "cryo",
        scheduled: true,
        damageFrame: 1,
        blockedReason: null,
        nextAvailableFrame: 6
      }
    ]);
    expect(audit.periodicReaction).toEqual({
      reaction: "electroCharged",
      generation: 1,
      operation: "start",
      damageElement: "electro",
      baseMultiplier: 2,
      firstDamageFrame: 10,
      nextTickFrame: 70,
      tickIntervalFrames: 60,
      waneDelayFrames: 6,
      waneGaugeUnits: 0.4,
      coexistenceExpiresAtFrame: null
    });
    expect(
      audit.catalyzeReaction?.quicken === null ||
        audit.catalyzeReaction?.quicken === undefined
        ? null
        : {
            sourceGaugeUnitsBefore:
              audit.catalyzeReaction.quicken
                .sourceGaugeUnitsBefore,
            sourceGaugeUnitsSpent:
              audit.catalyzeReaction.quicken
                .sourceGaugeUnitsSpent,
            sourceGaugeUnitsAfter:
              audit.catalyzeReaction.quicken
                .sourceGaugeUnitsAfter,
            quickenGaugeUnitsAfter:
              audit.catalyzeReaction.quicken
                .quickenGaugeUnitsAfter,
            operation:
              audit.catalyzeReaction.quicken.operation,
            expiresAtFrame:
              audit.catalyzeReaction.quicken.expiresAtFrame,
            pendingHydroBloomFollowup:
              audit.catalyzeReaction.quicken
                .pendingHydroBloomFollowup
          }
    ).toEqual({
      sourceGaugeUnitsBefore: 1.2,
      sourceGaugeUnitsSpent: 0.8,
      sourceGaugeUnitsAfter: 0.4,
      quickenGaugeUnitsAfter: 0.8,
      operation: "start",
      expiresAtFrame: 600,
      pendingHydroBloomFollowup: true
    });
    expect(projectBloom(audit)).toEqual([]);
    expect(audit.note).toContain("零延迟任务队列");
  });

  it("freezes Dendro Quicken → Burning → direct Bloom while queuing the Quicken follow-up", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "hydro", gaugeUnits: 2.5 },
        { element: "electro", gaugeUnits: 1.25 },
        { element: "pyro", gaugeUnits: 0.25 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1.5)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "quicken",
      reactions: ["quicken", "burning", "bloom"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 1.5,
      auraConsumed: [
        { element: "electro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 }
      ],
      auraAfter: [
        {
          element: "burning",
          gaugeUnits: 2,
          expiresAtFrame: null
        },
        {
          element: "burningFuel",
          gaugeUnits: 1,
          expiresAtFrame: 151
        },
        {
          element: "hydro",
          gaugeUnits: 1,
          expiresAtFrame: 398
        },
        {
          element: "pyro",
          gaugeUnits: 0.2,
          expiresAtFrame: 458
        },
        {
          element: "quicken",
          gaugeUnits: 1,
          expiresAtFrame: 150
        }
      ]
    });
    expect(
      audit.catalyzeReaction?.quicken === null ||
        audit.catalyzeReaction?.quicken === undefined
        ? null
        : {
            sourceGaugeUnitsBefore:
              audit.catalyzeReaction.quicken
                .sourceGaugeUnitsBefore,
            sourceGaugeUnitsSpent:
              audit.catalyzeReaction.quicken
                .sourceGaugeUnitsSpent,
            sourceGaugeUnitsAfter:
              audit.catalyzeReaction.quicken
                .sourceGaugeUnitsAfter,
            quickenGaugeUnitsAfter:
              audit.catalyzeReaction.quicken
                .quickenGaugeUnitsAfter,
            pendingHydroBloomFollowup:
              audit.catalyzeReaction.quicken
                .pendingHydroBloomFollowup
          }
    ).toEqual({
      sourceGaugeUnitsBefore: 1.5,
      sourceGaugeUnitsSpent: 1,
      sourceGaugeUnitsAfter: 0.5,
      quickenGaugeUnitsAfter: 1,
      pendingHydroBloomFollowup: true
    });
    expect(
      audit.burningReaction === null
        ? null
        : {
            operation: audit.burningReaction.operation,
            reactionTriggered:
              audit.burningReaction.reactionTriggered,
            candidateFuelGaugeUnits:
              audit.burningReaction.candidateFuelGaugeUnits,
            fuelGaugeUnitsAfter:
              audit.burningReaction.fuelGaugeUnitsAfter,
            fuelExpiresAtFrame:
              audit.burningReaction.fuelExpiresAtFrame,
            quickenMutation:
              audit.burningReaction.quickenStateMutation
                .operation
          }
    ).toEqual({
      operation: "start",
      reactionTriggered: true,
      candidateFuelGaugeUnits: 1,
      fuelGaugeUnitsAfter: 1,
      fuelExpiresAtFrame: 151,
      quickenMutation: "decay-rebase"
    });
    expect(projectBloom(audit)).toEqual([
      {
        operation: "direct",
        triggerElement: "dendro",
        sourceBudget: "incoming-application",
        sourceGaugeUnitsBefore: 0.5,
        sourceGaugeUnitsSpent: 0.5,
        sourceGaugeUnitsAfter: 0,
        hydroGaugeUnitsBefore: 2,
        hydroConsumedGaugeUnits: 1,
        hydroGaugeUnitsAfter: 1,
        dendroGaugeUnitsBefore: 0,
        dendroConsumedGaugeUnits: 0,
        dendroGaugeUnitsAfter: 0,
        quickenGaugeUnitsBefore: 1,
        quickenConsumedGaugeUnits: 0,
        quickenGaugeUnitsAfter: 1,
        scheduled: true,
        coreSpawnFrame: 30,
        blockedReason: null,
        mechanicsDataStatus: "fixed-gcsim-provisional"
      }
    ]);
    expect(audit.note).toContain("零延迟任务队列");
  });

  it("keeps Spread non-consuming and before a same-hit Quicken refresh", () => {
    const engine = new AuraEngine({
      mode: "aura-v7",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    });
    const aggravate = engine.processHit({
      frame: 1,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    });
    const spreadAndQuicken = engine.processHit({
      frame: 2,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1)
    });

    expect({
      reaction: aggravate.reaction,
      reactions: aggravate.reactions,
      additive:
        aggravate.catalyzeReaction?.additive === null ||
        aggravate.catalyzeReaction?.additive === undefined
          ? null
          : {
              reaction:
                aggravate.catalyzeReaction.additive.reaction,
              consumedQuickenGaugeUnits:
                aggravate.catalyzeReaction.additive
                  .consumedQuickenGaugeUnits
            },
      quicken: aggravate.catalyzeReaction?.quicken
    }).toEqual({
      reaction: "aggravate",
      reactions: ["aggravate"],
      additive: {
        reaction: "aggravate",
        consumedQuickenGaugeUnits: 0
      },
      quicken: null
    });
    expect({
      reaction: spreadAndQuicken.reaction,
      reactions: spreadAndQuicken.reactions,
      unsupportedReactions:
        spreadAndQuicken.unsupportedReactions,
      mechanicsTruncation:
        spreadAndQuicken.mechanicsTruncation,
      additive:
        spreadAndQuicken.catalyzeReaction?.additive ===
          null ||
        spreadAndQuicken.catalyzeReaction?.additive ===
          undefined
          ? null
          : {
              reaction:
                spreadAndQuicken.catalyzeReaction.additive
                  .reaction,
              consumedQuickenGaugeUnits:
                spreadAndQuicken.catalyzeReaction.additive
                  .consumedQuickenGaugeUnits
            },
      quicken:
        spreadAndQuicken.catalyzeReaction?.quicken ===
          null ||
        spreadAndQuicken.catalyzeReaction?.quicken ===
          undefined
          ? null
          : {
              reaction:
                spreadAndQuicken.catalyzeReaction.quicken
                  .reaction,
              consumedAuraElement:
                spreadAndQuicken.catalyzeReaction.quicken
                  .consumedAuraElement,
              operation:
                spreadAndQuicken.catalyzeReaction.quicken
                  .operation,
              pendingHydroBloomFollowup:
                spreadAndQuicken.catalyzeReaction.quicken
                  .pendingHydroBloomFollowup
            }
    }).toEqual({
      reaction: "spread",
      reactions: ["spread", "quicken"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      additive: {
        reaction: "spread",
        consumedQuickenGaugeUnits: 0
      },
      quicken: {
        reaction: "quicken",
        consumedAuraElement: "electro",
        operation: "refresh",
        pendingHydroBloomFollowup: false
      }
    });
  });

  it("freezes Electro-Charged recursive Electro → Hydro Swirl ordering", () => {
    const engine = new AuraEngine({
      mode: "aura-v7",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(3)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "swirlElectro",
      reactions: ["swirlElectro", "swirlHydro"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 3,
      auraConsumed: [
        { element: "electro", gaugeUnits: 0.8 },
        { element: "hydro", gaugeUnits: 0.7 }
      ],
      auraAfter: [
        {
          element: "hydro",
          gaugeUnits: 0.1,
          expiresAtFrame: 72
        }
      ]
    });
    expect(
      audit.swirlReactions.map(
        ({
          reaction,
          sourceGaugeUnitsBefore,
          sourceGaugeUnitsSpent,
          sourceGaugeUnitsAfter,
          auraConsumedGaugeUnits,
          propagatedGaugeUnits,
          scheduled,
          nextAvailableFrame,
          selfDamageFrame,
          propagationDamageFrame,
          propagationBaseMultiplier
        }) => ({
          reaction,
          sourceGaugeUnitsBefore,
          sourceGaugeUnitsSpent,
          sourceGaugeUnitsAfter,
          auraConsumedGaugeUnits,
          propagatedGaugeUnits,
          scheduled,
          nextAvailableFrame,
          selfDamageFrame,
          propagationDamageFrame,
          propagationBaseMultiplier
        })
      )
    ).toEqual([
      {
        reaction: "swirlElectro",
        sourceGaugeUnitsBefore: 3,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 1.4,
        auraConsumedGaugeUnits: 0.8,
        propagatedGaugeUnits: 1.95,
        scheduled: true,
        nextAvailableFrame: 6,
        selfDamageFrame: 1,
        propagationDamageFrame: 5,
        propagationBaseMultiplier: 0.6
      },
      {
        reaction: "swirlHydro",
        sourceGaugeUnitsBefore: 1.4,
        sourceGaugeUnitsSpent: 1.4,
        sourceGaugeUnitsAfter: 0,
        auraConsumedGaugeUnits: 0.7,
        propagatedGaugeUnits: 2.7,
        scheduled: true,
        nextAvailableFrame: 6,
        selfDamageFrame: 1,
        propagationDamageFrame: 5,
        propagationBaseMultiplier: 0
      }
    ]);
    expect(audit.periodicReaction).toEqual({
      reaction: "electroCharged",
      generation: 1,
      operation: "stop",
      damageElement: "electro",
      baseMultiplier: 2,
      firstDamageFrame: null,
      nextTickFrame: null,
      tickIntervalFrames: 60,
      waneDelayFrames: 6,
      waneGaugeUnits: 0.4,
      coexistenceExpiresAtFrame: null
    });
  });

  it("freezes the provisional all-normal-element Swirl order and shared Anemo budget", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(8)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "swirlElectro",
      reactions: [
        "swirlElectro",
        "swirlHydro",
        "swirlPyro",
        "swirlCryo"
      ],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 8,
      auraConsumed: [
        { element: "electro", gaugeUnits: 0.8 },
        { element: "hydro", gaugeUnits: 0.8 },
        { element: "pyro", gaugeUnits: 0.8 },
        { element: "cryo", gaugeUnits: 0.8 }
      ],
      auraAfter: []
    });
    expect(
      audit.swirlReactions.map(
        ({
          reaction,
          sourceGaugeUnitsBefore,
          sourceGaugeUnitsSpent,
          sourceGaugeUnitsAfter,
          auraConsumedGaugeUnits,
          propagatedGaugeUnits,
          propagationBaseMultiplier
        }) => ({
          reaction,
          sourceGaugeUnitsBefore,
          sourceGaugeUnitsSpent,
          sourceGaugeUnitsAfter,
          auraConsumedGaugeUnits,
          propagatedGaugeUnits,
          propagationBaseMultiplier
        })
      )
    ).toEqual([
      {
        reaction: "swirlElectro",
        sourceGaugeUnitsBefore: 8,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 6.4,
        auraConsumedGaugeUnits: 0.8,
        propagatedGaugeUnits: 1.95,
        propagationBaseMultiplier: 0.6
      },
      {
        reaction: "swirlHydro",
        sourceGaugeUnitsBefore: 6.4,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 4.8,
        auraConsumedGaugeUnits: 0.8,
        propagatedGaugeUnits: 1.95,
        propagationBaseMultiplier: 0
      },
      {
        reaction: "swirlPyro",
        sourceGaugeUnitsBefore: 4.8,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 3.2,
        auraConsumedGaugeUnits: 0.8,
        propagatedGaugeUnits: 1.95,
        propagationBaseMultiplier: 0.6
      },
      {
        reaction: "swirlCryo",
        sourceGaugeUnitsBefore: 3.2,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 1.6,
        auraConsumedGaugeUnits: 0.8,
        propagatedGaugeUnits: 1.95,
        propagationBaseMultiplier: 0.6
      }
    ]);
  });

  it("freezes Geo Electro-first priority and exactly one Crystallize result", () => {
    const audit = new AuraEngine({
      mode: "aura-v7",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "geo",
      element: "geo",
      application: noIcd(1)
    });

    expect(projectCore(audit)).toEqual({
      model: "aura-engine",
      triggered: true,
      reaction: "crystallizeElectro",
      reactions: ["crystallizeElectro"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      icdAllowed: true,
      applicationGaugeUnits: 1,
      auraConsumed: [
        { element: "electro", gaugeUnits: 0.5 }
      ],
      auraAfter: [
        {
          element: "cryo",
          gaugeUnits: 0.8,
          expiresAtFrame: 570
        },
        {
          element: "electro",
          gaugeUnits: 0.3,
          expiresAtFrame: 214
        },
        {
          element: "hydro",
          gaugeUnits: 0.8,
          expiresAtFrame: 570
        },
        {
          element: "pyro",
          gaugeUnits: 0.8,
          expiresAtFrame: 570
        }
      ]
    });
    expect(audit.crystallizeReaction).toEqual({
      reaction: "crystallizeElectro",
      crystallizedElement: "electro",
      consumedAuraElement: "electro",
      sourceGaugeUnitsBefore: 1,
      sourceGaugeUnitsSpent: 1,
      sourceGaugeUnitsAfter: 0,
      auraGaugeUnitsBefore: 0.8,
      auraConsumedGaugeUnits: 0.5,
      auraGaugeUnitsAfter: 0.3,
      scheduled: true,
      blockedReason: null,
      nextAvailableFrame: 60,
      shardSpawnFrame: 23,
      earliestPickupFrame: 54,
      shardExpiresAtFrame: 923,
      shardDurationFrames: 900,
      maxActiveShards: 3
    });
    expect(audit.swirlReactions).toEqual([]);
    expect(audit.transformativeReaction).toBeNull();
  });

  it("resets the default elemental-application ICD at the exact F150 boundary", () => {
    const engine = new AuraEngine({
      mode: "aura-v7",
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });
    const pyroHit = (frame: number) =>
      engine.processHit({
        frame,
        sourceActorId: "pyro",
        element: "pyro",
        application: defaultIcd(1)
      });

    const first = pyroHit(0);
    const blocked = pyroHit(149);
    const replenished = engine.processHit({
      frame: 149,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(1)
    });
    const reset = pyroHit(150);

    expect({
      first: {
        icdAllowed: first.icdAllowed,
        reaction: first.reaction,
        reactions: first.reactions,
        auraBefore: first.auraBefore,
        auraApplied: first.auraApplied,
        auraConsumed: first.auraConsumed,
        auraAfter: first.auraAfter
      },
      blocked: {
        icdAllowed: blocked.icdAllowed,
        reaction: blocked.reaction,
        reactions: blocked.reactions,
        auraBefore: blocked.auraBefore,
        auraApplied: blocked.auraApplied,
        auraConsumed: blocked.auraConsumed,
        auraAfter: blocked.auraAfter
      },
      replenished: {
        icdAllowed: replenished.icdAllowed,
        reaction: replenished.reaction,
        reactions: replenished.reactions,
        auraBefore: replenished.auraBefore,
        auraApplied: replenished.auraApplied,
        auraConsumed: replenished.auraConsumed,
        auraAfter: replenished.auraAfter
      },
      reset: {
        icdAllowed: reset.icdAllowed,
        reaction: reset.reaction,
        reactions: reset.reactions,
        auraBefore: reset.auraBefore,
        auraApplied: reset.auraApplied,
        auraConsumed: reset.auraConsumed,
        auraAfter: reset.auraAfter
      }
    }).toEqual({
      first: {
        icdAllowed: true,
        reaction: "melt",
        reactions: ["melt"],
        auraBefore: [
          {
            element: "cryo",
            gaugeUnits: 0.8,
            expiresAtFrame: 570,
            sourceSlots: [
              {
                sourceActorId: "__initial__",
                gaugeUnits: 0.8
              }
            ]
          }
        ],
        auraApplied: [
          {
            element: "pyro",
            gaugeUnits: 1,
            sourceActorId: "pyro"
          }
        ],
        auraConsumed: [
          {
            element: "cryo",
            gaugeUnits: 0.8,
            sourceMutations: [
              {
                sourceActorId: "__initial__",
                gaugeUnitsBefore: 0.8,
                consumedGaugeUnits: 0.8,
                gaugeUnitsAfter: 0
              }
            ]
          }
        ],
        auraAfter: []
      },
      blocked: {
        icdAllowed: false,
        reaction: "none",
        reactions: [],
        auraBefore: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: []
      },
      replenished: {
        icdAllowed: true,
        reaction: "none",
        reactions: [],
        auraBefore: [],
        auraApplied: [
          {
            element: "cryo",
            gaugeUnits: 1,
            sourceActorId: "cryo"
          }
        ],
        auraConsumed: [],
        auraAfter: [
          {
            element: "cryo",
            gaugeUnits: 0.8,
            expiresAtFrame: 719,
            sourceSlots: [
              {
                sourceActorId: "cryo",
                gaugeUnits: 0.8
              }
            ]
          }
        ]
      },
      reset: {
        icdAllowed: true,
        reaction: "melt",
        reactions: ["melt"],
        auraBefore: [
          {
            element: "cryo",
            gaugeUnits: 0.798596491228,
            expiresAtFrame: 719,
            sourceSlots: [
              {
                sourceActorId: "cryo",
                gaugeUnits: 0.798596491228
              }
            ]
          }
        ],
        auraApplied: [
          {
            element: "pyro",
            gaugeUnits: 1,
            sourceActorId: "pyro"
          }
        ],
        auraConsumed: [
          {
            element: "cryo",
            gaugeUnits: 0.798596491228,
            sourceMutations: [
              {
                sourceActorId: "cryo",
                gaugeUnitsBefore: 0.798596491228,
                consumedGaugeUnits: 0.798596491228,
                gaugeUnitsAfter: 0
              }
            ]
          }
        ],
        auraAfter: []
      }
    });
  });

  it("expires an aura-v7 0.04U Aura at the exact F426 boundary", () => {
    // aura-v7 uses 420 + 150 × nominal U frames, so 0.04U is the exact
    // non-legacy F426 boundary; a normal 1U aura-v7 Aura expires at F570.
    const engine = new AuraEngine({
      mode: "aura-v7",
      initialAura: [{ element: "cryo", gaugeUnits: 0.04 }]
    });
    const beforeExpiry = engine.processHit({
      frame: 425,
      sourceActorId: "observer",
      element: "physical"
    });
    const atExpiry = engine.processHit({
      frame: 426,
      sourceActorId: "observer",
      element: "physical"
    });

    expect({
      auraBefore: beforeExpiry.auraBefore,
      auraAfter: beforeExpiry.auraAfter
    }).toEqual({
      auraBefore: [
        {
          element: "cryo",
          gaugeUnits: 0.000075117371,
          expiresAtFrame: 426,
          sourceSlots: [
            {
              sourceActorId: "__initial__",
              gaugeUnits: 0.000075117371
            }
          ]
        }
      ],
      auraAfter: [
        {
          element: "cryo",
          gaugeUnits: 0.000075117371,
          expiresAtFrame: 426,
          sourceSlots: [
            {
              sourceActorId: "__initial__",
              gaugeUnits: 0.000075117371
            }
          ]
        }
      ]
    });
    expect({
      auraBefore: atExpiry.auraBefore,
      auraAfter: atExpiry.auraAfter
    }).toEqual({
      auraBefore: [],
      auraAfter: []
    });
  });
});
