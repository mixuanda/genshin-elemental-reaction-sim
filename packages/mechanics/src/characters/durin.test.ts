import { simulate } from "@genshin-dps-lab/sim-core";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID
} from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";
import {
  compileDurinBlackSkillAuditAbilities,
  compileDurinWhiteSkillAuditAbilities,
  createDurinBlackSkillAuditConfig,
  createDurinWhiteSkillAuditConfig,
  DURIN_ICD_PROFILES,
  durinConfirmationOfPurityBlueprint,
  durinDenialOfDarknessBlueprint
} from "./durin";
import {
  durinBlackSkillAuditDisclosure,
  durinBlackSkillAuditPreset,
  durinWhiteSkillAuditDisclosure,
  durinWhiteSkillAuditPreset
} from "./durin-audit";

const EXPECTED_REACTION_FORMULA_MODEL = {
  mode: "classic-formula-profile-v1",
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
} as const;

describe("Durin current formula identity", () => {
  it("pins both authoring configs and compact presets to the fixed profile", () => {
    expect([
      createDurinBlackSkillAuditConfig().reactionFormulaModel,
      createDurinWhiteSkillAuditConfig().reactionFormulaModel,
      durinBlackSkillAuditPreset.reactionFormulaModel,
      durinWhiteSkillAuditPreset.reactionFormulaModel
    ]).toEqual([
      EXPECTED_REACTION_FORMULA_MODEL,
      EXPECTED_REACTION_FORMULA_MODEL,
      EXPECTED_REACTION_FORMULA_MODEL,
      EXPECTED_REACTION_FORMULA_MODEL
    ]);
  });
});

describe("Durin black E partial mechanics audit vector", () => {
  it("retains evidence and unresolved-mechanics disclosure", () => {
    expect(durinDenialOfDarknessBlueprint).toMatchObject({
      verificationStatus: "provisional",
      simulationStatus: "partial",
      prerequisites: [
        "杜林处于精质转变状态",
        "普攻输入被替换为转变·黑度之否"
      ]
    });
    expect(durinDenialOfDarknessBlueprint.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "genshin-db",
          verificationStatus: "provisional"
        }),
        expect.objectContaining({
          source: "genshinsim/gcsim",
          path: "internal/characters/durin/skill.go"
        }),
        expect.objectContaining({
          source: "genshinsim/gcsim",
          path: "pkg/core/attacks/icd_groups.dm.go"
        }),
        expect.objectContaining({
          source: "genshinsim/gcsim",
          path: "pkg/core/player/character/character.go"
        })
      ])
    );
    expect(
      durinDenialOfDarknessBlueprint.unresolvedMechanics.length
    ).toBeGreaterThan(0);
    const compiledBlueprints = [
      compileDurinBlackSkillAuditAbilities().enterTransformation.blueprint,
      compileDurinBlackSkillAuditAbilities().denialOfDarkness.blueprint
    ];
    expect(durinBlackSkillAuditDisclosure.blueprintIds).toEqual(
      compiledBlueprints.map((blueprint) => blueprint.id)
    );
    expect(durinBlackSkillAuditDisclosure.unresolvedMechanics).toEqual(
      compiledBlueprints.flatMap(
        (blueprint) => blueprint.unresolvedMechanics
      )
    );
    const expectedEvidence = compiledBlueprints
      .flatMap((blueprint) => blueprint.evidence)
      .filter(
        (source, index, all) =>
          all.findIndex((candidate) => candidate.path === source.path) ===
          index
      )
      .map(({ path, url }) => ({ path, url }));
    const runtimeEvidence = durinBlackSkillAuditDisclosure.evidence.map(
      ({ path, url }) => ({ path, url })
    );
    expect(runtimeEvidence).toHaveLength(expectedEvidence.length);
    expect(runtimeEvidence).toEqual(
      expect.arrayContaining(expectedEvidence)
    );
  });

  it("compiles the audited frame, multiplier, energy, and particle mapping", () => {
    const { enterTransformation, denialOfDarkness } =
      compileDurinBlackSkillAuditAbilities();

    expect(enterTransformation.ability).toMatchObject({
      kind: "skill",
      cancelFrame: 16,
      cancelFrames: {
        normal: 16,
        charge: 16,
        skill: 15,
        burst: 4,
        dash: 14,
        jump: 14,
        swap: 13
      },
      animationEndFrame: 49,
      cooldownFrames: 720,
      timelineState: {
        grants: [
          {
            key: "durin-essential-transformation",
            durationFrames: 360
          }
        ]
      }
    });
    expect(denialOfDarkness.ability).toMatchObject({
      kind: "normal",
      cancelFrame: 41,
      cancelFrames: {
        normal: 64,
        charge: 64,
        skill: 48,
        burst: 45,
        dash: 42,
        jump: 41,
        swap: 43
      },
      animationEndFrame: 67,
      cooldownFrames: 0,
      timelineState: {
        requires: ["durin-essential-transformation"],
        consumes: ["durin-essential-transformation"],
        grants: [
          {
            key: "durin-denial-of-darkness-state",
            durationFrames: 1800
          }
        ]
      }
    });
    expect(
      denialOfDarkness.ability.hits?.map(
        ({ frame, scaling, application }) => ({
          frame,
          scaling,
          application
        })
      )
    ).toEqual([
      {
        frame: 32,
        scaling: 1.30032,
        application: {
          gaugeUnits: 1,
          icdTag: "durin-elemental-art",
          icdGroup: "durin-skill"
        }
      },
      {
        frame: 37,
        scaling: 0.9576,
        application: {
          gaugeUnits: 1,
          icdTag: "durin-elemental-art",
          icdGroup: "durin-skill"
        }
      },
      {
        frame: 42,
        scaling: 1.16352,
        application: {
          gaugeUnits: 1,
          icdTag: "durin-elemental-art",
          icdGroup: "durin-skill"
        }
      }
    ]);
    expect(denialOfDarkness.ability.energyGains).toEqual([
      {
        target: "durin",
        frame: 0,
        amount: 33,
        source: "durin-skill-state-entry",
        internalCooldown: {
          key: "durin-skill-energy-icd",
          durationFrames: 360
        }
      }
    ]);
    expect(denialOfDarkness.ability.particles).toEqual([
      {
        id: "durin-black-e-particles",
        source: "durin-black-e-first-target-hit",
        element: "pyro",
        kind: "particle",
        count: 4,
        travelFrames: 100,
        trigger: {
          kind: "hit-confirm",
          hitIds: [
            "durin-black-e-1",
            "durin-black-e-2",
            "durin-black-e-3"
          ],
          internalCooldown: {
            key: "durin-particle-icd",
            durationFrames: 18
          }
        }
      }
    ]);
    expect(DURIN_ICD_PROFILES["durin-skill"]).toEqual({
      resetFrames: 18,
      applicationSequence: [true, false, false]
    });
    expect(durinBlackSkillAuditPreset.timeline?.abilities).toEqual([
      enterTransformation.ability,
      denialOfDarkness.ability
    ]);
    expect(
      durinBlackSkillAuditPreset.reactionEngine?.icdProfiles
    ).toEqual(DURIN_ICD_PROFILES);
  });

  it("produces every hit, reaction, aura, energy, and particle event exactly", () => {
    const result = simulate(createDurinBlackSkillAuditConfig(), {
      critMode: "noCrit",
      energyMode: "zero"
    });

    expect(result.compatibilityMode).toBe("legal-frame-v1");
    expect(
      result.timelineExecution?.commandResults.map(
        ({ startFrame, cancelFrame, animationEndFrame }) => ({
          startFrame,
          cancelFrame,
          animationEndFrame
        })
      )
    ).toEqual([
      { startFrame: 0, cancelFrame: 16, animationEndFrame: 49 },
      { startFrame: 16, cancelFrame: 58, animationEndFrame: 83 },
      { startFrame: 58, cancelFrame: 59, animationEndFrame: 59 }
    ]);
    expect(result.skippedActions).toEqual([]);
    expect(result.timelineExecution?.stateLog).toEqual([
      expect.objectContaining({
        frame: 0,
        operation: "grant",
        statusKey: "durin-essential-transformation",
        expiresAtFrame: 360,
        commandIndex: 0
      }),
      expect.objectContaining({
        frame: 16,
        operation: "consume",
        statusKey: "durin-essential-transformation",
        expiresAtFrame: 360,
        commandIndex: 1
      }),
      expect.objectContaining({
        frame: 16,
        operation: "grant",
        statusKey: "durin-denial-of-darkness-state",
        expiresAtFrame: 1816,
        commandIndex: 1
      })
    ]);
    expect(result.damageEvents).toHaveLength(3);
    expect(result.damageEvents.map((event) => event.frame)).toEqual([
      48, 53, 58
    ]);
    expect(result.damageEvents.map((event) => event.scaling)).toEqual([
      1.30032, 0.9576, 1.16352
    ]);
    expect(
      result.damageEvents.map((event) => event.reactionAudit.icdAllowed)
    ).toEqual([true, false, false]);
    expect(result.damageEvents.map((event) => event.reaction)).toEqual([
      "melt",
      "none",
      "none"
    ]);
    expect(result.damageEvents.map((event) => event.finalDamage)).toEqual([
      2223.5472, 818.748, 994.8096
    ]);
    expect(result.damageEvents.map((event) => event.displayDamage)).toEqual([
      2224, 819, 995
    ]);
    expect(result.totalDamage).toBeCloseTo(4037.1048, 10);
    expect(result.damageCurve.map((point) => point.cumulativeDamage)).toEqual([
      2223.5472, 3042.2952, 4037.1048
    ]);
    expect(result.auraTimeline).toHaveLength(3);
    expect(result.auraTimeline[0]).toMatchObject({
      frame: 48,
      incomingElement: "pyro",
      icdAllowed: true,
      reaction: "melt",
      auraBefore: [expect.objectContaining({ element: "cryo" })],
      auraAfter: []
    });
    expect(result.auraTimeline.slice(1)).toEqual([
      expect.objectContaining({
        frame: 53,
        icdAllowed: false,
        reaction: "none",
        auraBefore: [],
        auraAfter: []
      }),
      expect.objectContaining({
        frame: 58,
        icdAllowed: false,
        reaction: "none",
        auraBefore: [],
        auraAfter: []
      })
    ]);
    expect(result.particleEvents).toEqual([
      expect.objectContaining({
        particleId: "durin-black-e-particles",
        particleElement: "pyro",
        particleCount: 4,
        spawnFrame: 48,
        receiveFrame: 148,
        receivedWithinSimulation: true,
        triggerLogId: 0,
        triggerHitId: "durin-black-e-1"
      })
    ]);
    expect(
      result.particleTriggerLog.map(
        ({
          frame,
          hitId,
          triggered,
          blockedReason,
          internalCooldownKey,
          internalCooldownReadyFrame
        }) => ({
          frame,
          hitId,
          triggered,
          blockedReason,
          internalCooldownKey,
          internalCooldownReadyFrame
        })
      )
    ).toEqual([
      {
        frame: 48,
        hitId: "durin-black-e-1",
        triggered: true,
        blockedReason: null,
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 66
      },
      {
        frame: 53,
        hitId: "durin-black-e-2",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 66
      },
      {
        frame: 58,
        hitId: "durin-black-e-3",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 66
      }
    ]);
    expect(result.energyLog).toEqual([
      expect.objectContaining({
        kind: "fixed",
        frame: 16,
        source: "durin-skill-state-entry",
        rawEnergy: 33,
        gainedEnergy: 33,
        energyAfter: 33,
        applied: true,
        blockedReason: null,
        internalCooldownKey: "durin-skill-energy-icd",
        internalCooldownDurationFrames: 360,
        internalCooldownReadyFrame: 376
      }),
      expect.objectContaining({
        kind: "particle",
        frame: 148,
        particleCount: 4,
        rawEnergy: 12,
        gainedEnergy: 12,
        energyAfter: 45
      })
    ]);
    expect(result.energyStats.durin).toMatchObject({
      fixedGained: 33,
      particleGained: 12,
      gained: 45,
      final: 45
    });
  });

  it("applies an audited stat bonus through the core instead of UI math", () => {
    const base = simulate(createDurinBlackSkillAuditConfig(), {
      critMode: "noCrit"
    });
    const buffed = simulate(
      createDurinBlackSkillAuditConfig({ damageBonus: 0.5 }),
      { critMode: "noCrit" }
    );

    expect(buffed.damageEvents.map((event) => event.finalDamage)).toEqual(
      base.damageEvents.map((event) => event.finalDamage * 1.5)
    );
    expect(buffed.totalDamage).toBeCloseTo(6055.6572, 10);
  });

  it("rejects black E when the transformation state was never entered", () => {
    const config = createDurinBlackSkillAuditConfig();
    if (!config.timeline) throw new Error("expected legal timeline");
    config.timeline.commands = [
      {
        type: "normal",
        actorId: "durin",
        abilityId: "durin-denial-of-darkness"
      }
    ];

    expect(() => simulate(config)).toThrow(
      /MISSING_REQUIRED_STATE.*durin-essential-transformation/
    );
  });

  it("keeps the compact browser projection equivalent to the authoring vector", () => {
    const authoring = simulate(createDurinBlackSkillAuditConfig(), {
      critMode: "noCrit"
    });
    const browser = simulate(durinBlackSkillAuditPreset, {
      critMode: "noCrit"
    });

    expect(browser.reproducibilityKey).toBe(authoring.reproducibilityKey);
    expect(browser.damageEvents).toEqual(authoring.damageEvents);
    expect(browser.energyLog).toEqual(authoring.energyLog);
    expect(browser.particleEvents).toEqual(authoring.particleEvents);
    expect(browser.particleTriggerLog).toEqual(
      authoring.particleTriggerLog
    );
    expect(browser.auraTimeline).toEqual(authoring.auraTimeline);
  });
});

describe("Durin white E partial mechanics audit vector", () => {
  it("compiles the source-audited multiplier, frames, state, energy, and particles", () => {
    const { enterTransformation, confirmationOfPurity } =
      compileDurinWhiteSkillAuditAbilities();

    expect(durinConfirmationOfPurityBlueprint).toMatchObject({
      verificationStatus: "provisional",
      simulationStatus: "partial",
      prerequisites: [
        "杜林处于精质转变状态",
        "元素战技输入被替换为转变·白化之是"
      ]
    });
    expect(confirmationOfPurity.ability).toMatchObject({
      kind: "skill",
      cancelFrame: 46,
      cancelFrames: {
        normal: 62,
        charge: 62,
        skill: 53,
        burst: 50,
        dash: 46,
        jump: 47,
        swap: 48
      },
      animationEndFrame: 83,
      cooldownFrames: 0,
      hits: [
        {
          id: "durin-white-e",
          frame: 35,
          scaling: 1.9008
        }
      ],
      energyGains: [
        {
          amount: 33,
          internalCooldown: {
            key: "durin-skill-energy-icd",
            durationFrames: 360
          }
        }
      ],
      timelineState: {
        requires: ["durin-essential-transformation"],
        consumes: ["durin-essential-transformation"],
        clears: ["durin-denial-of-darkness-state"],
        grants: [
          {
            key: "durin-confirmation-of-purity-state",
            durationFrames: 1800
          }
        ]
      }
    });
    expect(confirmationOfPurity.ability.particles).toEqual([
      {
        id: "durin-white-e-particles",
        source: "durin-white-e-first-target-hit",
        element: "pyro",
        kind: "particle",
        count: 4,
        travelFrames: 100,
        trigger: {
          kind: "hit-confirm",
          hitIds: ["durin-white-e"],
          internalCooldown: {
            key: "durin-particle-icd",
            durationFrames: 18
          }
        }
      }
    ]);
    expect(
      confirmationOfPurity.resolvedParameters.map(({ path, value }) => ({
        path,
        value
      }))
    ).toEqual([
      { path: "hits[0].scalingRef", value: 1.9008 },
      { path: "energyGains[0].amountRef", value: 33 }
    ]);
    const compiledBlueprints = [
      enterTransformation.blueprint,
      confirmationOfPurity.blueprint
    ];
    expect(durinWhiteSkillAuditDisclosure.blueprintIds).toEqual(
      compiledBlueprints.map((blueprint) => blueprint.id)
    );
    expect(durinWhiteSkillAuditDisclosure.unresolvedMechanics).toEqual(
      compiledBlueprints.flatMap(
        (blueprint) => blueprint.unresolvedMechanics
      )
    );
    const expectedEvidence = compiledBlueprints
      .flatMap((blueprint) => blueprint.evidence)
      .filter(
        (source, index, all) =>
          all.findIndex((candidate) => candidate.path === source.path) ===
          index
      )
      .map(({ path, url }) => ({ path, url }));
    expect(
      durinWhiteSkillAuditDisclosure.evidence.map(({ path, url }) => ({
        path,
        url
      }))
    ).toEqual(expect.arrayContaining(expectedEvidence));
  });

  it("simulates every white E event and audit field deterministically", () => {
    const result = simulate(createDurinWhiteSkillAuditConfig(), {
      critMode: "noCrit"
    });

    expect(
      result.timelineExecution?.commandResults.map(
        ({ commandType, startFrame, cancelFrame, animationEndFrame }) => ({
          commandType,
          startFrame,
          cancelFrame,
          animationEndFrame
        })
      )
    ).toEqual([
      {
        commandType: "skill",
        startFrame: 0,
        cancelFrame: 15,
        animationEndFrame: 49
      },
      {
        commandType: "skill",
        startFrame: 15,
        cancelFrame: 61,
        animationEndFrame: 98
      },
      {
        commandType: "dash",
        startFrame: 61,
        cancelFrame: 62,
        animationEndFrame: 62
      }
    ]);
    expect(result.damageEvents).toHaveLength(1);
    expect(result.damageEvents[0]).toMatchObject({
      frame: 50,
      hitId: "durin-white-e",
      hitLabel: "白 E",
      scaling: 1.9008,
      reaction: "none",
      displayDamage: 1625,
      reactionAudit: {
        icdAllowed: null,
        icdTag: null,
        icdGroup: null
      }
    });
    expect(result.damageEvents[0]?.finalDamage).toBeCloseTo(
      1625.184,
      10
    );
    expect(result.damageCurve).toEqual([
      expect.objectContaining({
        frame: 50,
        damageEventId: 0
      })
    ]);
    expect(result.damageCurve[0]?.cumulativeDamage).toBeCloseTo(
      1625.184,
      10
    );
    expect(result.auraTimeline[0]).toMatchObject({
      frame: 50,
      icdAllowed: null,
      reaction: "none",
      auraBefore: [expect.objectContaining({ element: "cryo" })],
      auraAfter: [expect.objectContaining({ element: "cryo" })]
    });
    expect(result.particleTriggerLog).toEqual([
      expect.objectContaining({
        frame: 50,
        hitId: "durin-white-e",
        triggered: true,
        internalCooldownKey: "durin-particle-icd",
        internalCooldownReadyFrame: 68
      })
    ]);
    expect(result.particleEvents).toEqual([
      expect.objectContaining({
        particleId: "durin-white-e-particles",
        particleCount: 4,
        spawnFrame: 50,
        receiveFrame: 150,
        triggerLogId: 0,
        triggerHitId: "durin-white-e"
      })
    ]);
    expect(result.energyStats.durin).toMatchObject({
      fixedGained: 33,
      particleGained: 12,
      final: 45
    });
    expect(result.timelineExecution?.stateLog).toEqual([
      expect.objectContaining({
        frame: 0,
        operation: "grant",
        statusKey: "durin-essential-transformation"
      }),
      expect.objectContaining({
        frame: 15,
        operation: "consume",
        statusKey: "durin-essential-transformation"
      }),
      expect.objectContaining({
        frame: 15,
        operation: "grant",
        statusKey: "durin-confirmation-of-purity-state",
        expiresAtFrame: 1815
      })
    ]);
  });

  it("rejects white E without the transformation state", () => {
    const config = createDurinWhiteSkillAuditConfig();
    if (!config.timeline) throw new Error("expected legal timeline");
    config.timeline.commands = [
      {
        type: "skill",
        actorId: "durin",
        abilityId: "durin-confirmation-of-purity"
      }
    ];

    expect(() => simulate(config)).toThrow(
      /MISSING_REQUIRED_STATE.*durin-essential-transformation/
    );
  });

  it("clears the prior black branch when a later white recast succeeds", () => {
    const config = createDurinBlackSkillAuditConfig();
    const { confirmationOfPurity } =
      compileDurinWhiteSkillAuditAbilities();
    if (!config.timeline) throw new Error("expected legal timeline");
    config.duration = 14;
    config.cycleLength = 14;
    config.timeline.abilities.push(confirmationOfPurity.ability);
    config.timeline.commands = [
      {
        type: "skill",
        actorId: "durin",
        abilityId: "durin-enter-essential-transformation"
      },
      {
        type: "normal",
        actorId: "durin",
        abilityId: "durin-denial-of-darkness"
      },
      { type: "wait", frames: 663 },
      {
        type: "skill",
        actorId: "durin",
        abilityId: "durin-enter-essential-transformation"
      },
      {
        type: "skill",
        actorId: "durin",
        abilityId: "durin-confirmation-of-purity"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    expect(result.timelineExecution?.stateLog).toContainEqual(
      expect.objectContaining({
        frame: 735,
        operation: "clear",
        statusKey: "durin-denial-of-darkness-state",
        abilityId: "durin-confirmation-of-purity"
      })
    );
    expect(result.timelineExecution?.stateLog).toContainEqual(
      expect.objectContaining({
        frame: 735,
        operation: "grant",
        statusKey: "durin-confirmation-of-purity-state"
      })
    );
  });

  it("keeps the compact white branch equivalent to the authoring vector", () => {
    const authoring = simulate(createDurinWhiteSkillAuditConfig(), {
      critMode: "noCrit"
    });
    const browser = simulate(durinWhiteSkillAuditPreset, {
      critMode: "noCrit"
    });

    expect(browser.reproducibilityKey).toBe(authoring.reproducibilityKey);
    expect(browser.timelineExecution).toEqual(authoring.timelineExecution);
    expect(browser.damageEvents).toEqual(authoring.damageEvents);
    expect(browser.energyLog).toEqual(authoring.energyLog);
    expect(browser.particleEvents).toEqual(authoring.particleEvents);
    expect(browser.particleTriggerLog).toEqual(
      authoring.particleTriggerLog
    );
    expect(browser.auraTimeline).toEqual(authoring.auraTimeline);
  });
});
