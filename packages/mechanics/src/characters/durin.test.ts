import { simulate } from "@genshin-dps-lab/sim-core";
import { describe, expect, it } from "vitest";
import {
  compileDurinBlackSkillAuditAbilities,
  createDurinBlackSkillAuditConfig,
  DURIN_ICD_PROFILES,
  durinDenialOfDarknessBlueprint
} from "./durin";
import {
  durinBlackSkillAuditDisclosure,
  durinBlackSkillAuditPreset
} from "./durin-audit";

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
        skill: 15,
        burst: 4,
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
        skill: 48,
        burst: 45,
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
        source: "durin-skill-state-entry"
      }
    ]);
    expect(denialOfDarkness.ability.particles).toEqual([
      {
        id: "durin-black-e-particles",
        source: "durin-black-e-first-target-hit",
        element: "pyro",
        kind: "particle",
        count: 4,
        spawnFrame: 32,
        travelFrames: 100
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
      { startFrame: 16, cancelFrame: 57, animationEndFrame: 83 }
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
        receivedWithinSimulation: true
      })
    ]);
    expect(result.energyLog).toEqual([
      expect.objectContaining({
        kind: "fixed",
        frame: 16,
        source: "durin-skill-state-entry",
        rawEnergy: 33,
        gainedEnergy: 33,
        energyAfter: 33
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
    expect(browser.auraTimeline).toEqual(authoring.auraTimeline);
  });
});
