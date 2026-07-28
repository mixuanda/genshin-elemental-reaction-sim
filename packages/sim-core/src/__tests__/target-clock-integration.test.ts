import type {
  AbilityDefinition,
  FrameHitDefinition,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { auraStateSnapshotsEqual } from "../target-state-timeline";
import { makeConfig } from "./fixtures";

type EnemyTargets = NonNullable<SimConfig["enemy"]["targets"]>;
type TargetPhases = NonNullable<SimConfig["enemy"]["targetPhases"]>;

interface BasicTargetClockConfig {
  durationFrames: number;
  targets: EnemyTargets;
  hits: FrameHitDefinition[];
  reactionEngine?: SimConfig["reactionEngine"];
  targetPhases?: TargetPhases;
  randomSeed?: string;
}

function makeTargetClockConfig({
  durationFrames,
  targets,
  hits,
  reactionEngine,
  targetPhases,
  randomSeed = "target-clock-integration-seed"
}: BasicTargetClockConfig): SimConfig {
  const base = makeConfig();
  const ability: AbilityDefinition = {
    id: "target-clock-vector",
    actorId: "a",
    name: "Target clock vector",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: Math.max(1, ...hits.map((hit) => hit.frame)),
    cooldownFrames: 0,
    hits
  };

  return {
    ...base,
    randomSeed,
    duration: durationFrames / 60,
    cycleLength: durationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets,
      ...(targetPhases === undefined ? {} : { targetPhases })
    },
    rotation: [],
    ...(reactionEngine === undefined ? {} : { reactionEngine }),
    targetClockModel: {
      mode: "target-local-hitlag-v1"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "a",
          abilityId: ability.id,
          atFrame: 0
        }
      ]
    }
  };
}

function auditByTarget(
  result: ReturnType<typeof simulate>
): Map<
  string,
  Extract<
    typeof result.targetClockAudit,
    { mode: "target-local-hitlag-v1" }
  >["targets"][number]
> {
  if (result.targetClockAudit.mode !== "target-local-hitlag-v1") {
    throw new Error("Expected an enabled target clock audit.");
  }
  return new Map(
    result.targetClockAudit.targets.map((target) => [target.targetId, target])
  );
}

function makeFrozenHitlagConfig(): SimConfig {
  return makeTargetClockConfig({
    durationFrames: 240,
    targets: [
      {
        id: "enemy-0",
        name: "Frozen target",
        freezeResistance: 0,
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      }
    ],
    reactionEngine: { mode: "aura-v2" },
    hits: [
      {
        id: "freeze-with-hitlag",
        label: "Freeze with nested-ceil Hitlag",
        frame: 0,
        scaling: 1,
        element: "hydro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        },
        application: {
          gaugeUnits: 1,
          icdTag: "freeze-with-hitlag",
          icdGroup: "no-icd"
        },
        targetHitlag: {
          haltFrames: 3.2,
          factor: 0.25
        }
      }
    ]
  });
}

function makeDendroCoreHitlagConfig(): SimConfig {
  return makeTargetClockConfig({
    durationFrames: 335,
    randomSeed: "target-clock-dendro-core-seed",
    targets: [
      {
        id: "enemy-0",
        name: "Dendro-core source",
        position: { x: 0, y: 0 },
        hitboxRadius: 0,
        initialAura: [{ element: "dendro", gaugeUnits: 0.625 }]
      }
    ],
    reactionEngine: { mode: "aura-v5" },
    hits: [
      {
        id: "bloom-with-hitlag",
        label: "Bloom with target Hitlag",
        frame: 0,
        scaling: 0,
        element: "hydro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        },
        application: {
          gaugeUnits: 1,
          icdTag: "bloom-with-hitlag",
          icdGroup: "no-icd"
        },
        targetHitlag: {
          haltFrames: 5,
          factor: 0
        }
      }
    ]
  });
}

describe("target-local-hitlag-v1 simulator integration", () => {
  it("moves Frozen expiry by H and exposes replayable clock and target-frame audits", () => {
    const result = simulate(makeFrozenHitlagConfig(), {
      critMode: "noCrit"
    });
    const expiry = result.frozenStateLog.find(
      (entry) => entry.operation === "expire"
    );
    const clockAudit = auditByTarget(result).get("enemy-0");
    const expiryPoint = result.targetStateTimeline.points.find(
      (point) => point.cause === "frozen-expiry"
    );
    const endPoint = result.targetStateTimeline.points.find(
      (point) =>
        point.targetId === "enemy-0" && point.cause === "simulation-end"
    );

    expect(result.targetHitlagLog).toMatchObject([
      {
        globalFrame: 0,
        targetFrame: 0,
        haltFrames: 3.2,
        factor: 0.25,
        roundedHaltFrames: 4,
        extensionFrames: 3,
        frozenFramesBefore: 0,
        frozenFramesAfter: 3,
        pausedGlobalFrameStart: 1,
        nextTargetAdvanceGlobalFrame: 4,
        applied: true,
        blockedReason: null
      }
    ]);
    expect(expiry).toMatchObject({
      frame: 179,
      targetFrame: 176,
      expiresAtFrame: null,
      expiresAtTargetFrame: null,
      reason: "FROZEN_DECAY_EXPIRED"
    });
    expect(clockAudit).toEqual({
      targetId: "enemy-0",
      targetName: "Frozen target",
      finalGlobalFrame: 240,
      finalTargetFrame: 237,
      frozenFramesConsumed: 3,
      frozenFramesRemaining: 0,
      hitlagApplications: 1,
      totalExtensionFrames: 3
    });
    expect(result.targetClockLog).toEqual([
      {
        id: 0,
        targetId: "enemy-0",
        targetName: "Frozen target",
        operation: "apply-hitlag",
        globalFrameBefore: 0,
        globalFrameAfter: 0,
        targetFrameBefore: 0,
        targetFrameAfter: 0,
        frozenFramesBefore: 0,
        consumedFrozenFrames: 0,
        addedFrozenFrames: 3,
        frozenFramesAfter: 3,
        targetHitlagLogId: 0,
        cause: "hit"
      },
      {
        id: 1,
        targetId: "enemy-0",
        targetName: "Frozen target",
        operation: "advance",
        globalFrameBefore: 0,
        globalFrameAfter: 240,
        targetFrameBefore: 0,
        targetFrameAfter: 237,
        frozenFramesBefore: 3,
        consumedFrozenFrames: 3,
        addedFrozenFrames: 0,
        frozenFramesAfter: 0,
        targetHitlagLogId: null,
        cause: "simulation-end"
      }
    ]);
    expect(expiryPoint).toMatchObject({
      frame: 179,
      targetFrame: 176,
      targetId: "enemy-0"
    });
    expect(endPoint).toMatchObject({
      frame: 240,
      targetFrame: 237,
      targetId: "enemy-0"
    });
    expect(
      result.targetStateTimeline.points.every(
        (point) => point.targetFrame !== undefined
      )
    ).toBe(true);
  });

  it("reprojects the Burning task chain while preserving its 15-target-frame cadence", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 150,
        targets: [
          {
            id: "enemy-0",
            name: "Burning target",
            position: { x: 0, y: 0 },
            initialAura: [{ element: "dendro", gaugeUnits: 1 }]
          }
        ],
        reactionEngine: { mode: "aura-v4" },
        hits: [
          {
            id: "burning-with-hitlag",
            label: "Burning with target Hitlag",
            frame: 0,
            scaling: 0,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "burning-with-hitlag",
              icdGroup: "no-icd"
            },
            targetHitlag: {
              haltFrames: 3,
              factor: 0
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    const tickRows = result.burningStateLog.filter(
      (entry) => entry.operation === "tick"
    );
    expect(tickRows.map((entry) => entry.frame)).toEqual([
      18, 33, 48, 63, 78, 93, 108, 123
    ]);
    expect(tickRows.map((entry) => entry.targetFrame)).toEqual([
      15, 30, 45, 60, 75, 90, 105, 120
    ]);
    expect(
      tickRows.every(
        (entry) =>
          entry.clockModel === "target-local-hitlag-v1" &&
          entry.hitlagStatus === "modeled-enemy-hitlag"
      )
    ).toBe(true);
    expect(result.burningStateLog.at(-1)).toMatchObject({
      operation: "fuel-expire",
      frame: 124,
      targetFrame: 121,
      fuelExpiresAtFrame: null,
      fuelExpiresAtTargetFrame: null,
      nextTickFrame: null,
      nextTickTargetFrame: null
    });
    expect(
      result.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "burning"
        )
        .map((event) => event.frame)
    ).toEqual([18, 33, 48, 63, 78, 93, 108, 123]);
  });

  it("reprojects Quicken expiry without changing its 600-target-frame lifetime", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 620,
        targets: [
          {
            id: "enemy-0",
            name: "Quicken target",
            initialAura: [{ element: "dendro", gaugeUnits: 1 }]
          }
        ],
        reactionEngine: { mode: "aura-v3" },
        hits: [
          {
            id: "quicken-with-hitlag",
            label: "Quicken with target Hitlag",
            frame: 0,
            scaling: 0,
            element: "electro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "quicken-with-hitlag",
              icdGroup: "no-icd"
            },
            targetHitlag: {
              haltFrames: 3,
              factor: 0
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(result.quickenStateLog).toMatchObject([
      {
        operation: "start",
        frame: 0,
        targetFrame: 0,
        expiresAtFrame: 600,
        expiresAtTargetFrame: 600
      },
      {
        operation: "expire",
        frame: 603,
        targetFrame: 600,
        expiresAtFrameBefore: 603,
        expiresAtTargetFrameBefore: 600,
        expiresAtFrame: null,
        expiresAtTargetFrame: null
      }
    ]);
    expect(
      result.targetStateTimeline.points.find(
        (point) => point.cause === "quicken-expiry"
      )
    ).toMatchObject({
      frame: 603,
      targetFrame: 600
    });
  });

  it("blocks misses, applies landed damage-immune Hitlag, and audits factor=1 as zero extension", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 60,
        targets: [
          { id: "enemy-0", name: "Miss target" },
          {
            id: "enemy-1",
            name: "Damage-immune target"
          },
          {
            id: "enemy-2",
            name: "Zero-extension target"
          }
        ],
        targetPhases: [
          {
            id: "immune-phase",
            label: "Damage only immunity",
            targetId: "enemy-1",
            startFrame: 0,
            endFrame: 60,
            reason: "TEST_DAMAGE_IMMUNITY",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          }
        ],
        hits: [
          {
            id: "miss-hit",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "miss",
              reason: "OUTSIDE_HITBOX"
            },
            targetHitlag: {
              haltFrames: 3,
              factor: 0
            }
          },
          {
            id: "immune-hit",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-1",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 3,
              factor: 0
            }
          },
          {
            id: "zero-extension-hit",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-2",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 9.5,
              factor: 1
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );
    const audits = auditByTarget(result);

    expect(
      result.targetHitlagLog.map(
        ({
          targetId,
          extensionFrames,
          applied,
          blockedReason,
          frozenFramesAfter
        }) => ({
          targetId,
          extensionFrames,
          applied,
          blockedReason,
          frozenFramesAfter
        })
      )
    ).toEqual([
      {
        targetId: "enemy-0",
        extensionFrames: 3,
        applied: false,
        blockedReason: "TARGET_MISS",
        frozenFramesAfter: 0
      },
      {
        targetId: "enemy-1",
        extensionFrames: 3,
        applied: true,
        blockedReason: null,
        frozenFramesAfter: 3
      },
      {
        targetId: "enemy-2",
        extensionFrames: 0,
        applied: false,
        blockedReason: "ZERO_EXTENSION",
        frozenFramesAfter: 0
      }
    ]);
    expect(
      result.hitResolutionLog.find((entry) => entry.hitId === "immune-hit")
    ).toMatchObject({
      landed: true,
      damageAllowed: false,
      finalDamage: 0
    });
    expect(audits.get("enemy-0")?.finalTargetFrame).toBe(60);
    expect(audits.get("enemy-1")?.finalTargetFrame).toBe(57);
    expect(audits.get("enemy-2")?.finalTargetFrame).toBe(60);
  });

  it("stacks same-target same-frame Hitlag in stable hit order", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 60,
        targets: [{ id: "enemy-0", name: "Stack target" }],
        hits: [
          {
            id: "first-stack",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 2,
              factor: 0
            }
          },
          {
            id: "second-stack",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 3,
              factor: 0
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(
      result.targetHitlagLog.map(
        ({
          hitId,
          targetFrame,
          frozenFramesBefore,
          frozenFramesAfter,
          extensionFrames
        }) => ({
          hitId,
          targetFrame,
          frozenFramesBefore,
          frozenFramesAfter,
          extensionFrames
        })
      )
    ).toEqual([
      {
        hitId: "first-stack",
        targetFrame: 0,
        frozenFramesBefore: 0,
        frozenFramesAfter: 2,
        extensionFrames: 2
      },
      {
        hitId: "second-stack",
        targetFrame: 0,
        frozenFramesBefore: 2,
        frozenFramesAfter: 5,
        extensionFrames: 3
      }
    ]);
    expect(auditByTarget(result).get("enemy-0")).toMatchObject({
      finalGlobalFrame: 60,
      finalTargetFrame: 55,
      frozenFramesConsumed: 5,
      hitlagApplications: 2,
      totalExtensionFrames: 5
    });
  });

  it("accepts same-target-frame Aura observations when Hitlag only reprojects the global expiry", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 60,
        targets: [
          {
            id: "enemy-0",
            name: "Aura projection target",
            initialAura: [{ element: "pyro", gaugeUnits: 1 }]
          }
        ],
        reactionEngine: { mode: "aura-v2" },
        hits: [
          {
            id: "projection-hitlag",
            frame: 0,
            scaling: 1,
            element: "physical",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 5,
              factor: 0
            }
          },
          {
            id: "same-target-frame-observer",
            frame: 0,
            scaling: 1,
            element: "physical",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );
    const hitPoints = result.targetStateTimeline.points.filter(
      (point) =>
        point.targetId === "enemy-0" && point.cause === "direct-hit-application"
    );

    expect(hitPoints).toHaveLength(2);
    expect(hitPoints.map((point) => point.targetFrame)).toEqual([0, 0]);
    expect(hitPoints[0]?.auraAfter).toMatchObject([
      {
        element: "pyro",
        expiresAtFrame: 426,
        expiresAtTargetFrame: 426
      }
    ]);
    expect(hitPoints[1]?.auraBefore).toMatchObject([
      {
        element: "pyro",
        expiresAtFrame: 431,
        expiresAtTargetFrame: 426
      }
    ]);
    expect(
      auraStateSnapshotsEqual(
        hitPoints[0]?.auraAfter ?? [],
        hitPoints[1]?.auraBefore ?? []
      )
    ).toBe(true);
  });

  it("accepts a simulation-end Aura projection while the target remains frozen", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 60,
        targets: [
          {
            id: "enemy-0",
            name: "Frozen-at-end Aura target",
            initialAura: [{ element: "pyro", gaugeUnits: 1 }]
          }
        ],
        reactionEngine: { mode: "aura-v2" },
        hits: [
          {
            id: "freeze-through-end",
            frame: 59,
            scaling: 1,
            element: "physical",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 5,
              factor: 0
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );
    const hitPoint = result.targetStateTimeline.points.find(
      (point) =>
        point.targetId === "enemy-0" && point.cause === "direct-hit-application"
    );
    const endPoint = result.targetStateTimeline.points.find(
      (point) =>
        point.targetId === "enemy-0" && point.cause === "simulation-end"
    );

    expect(hitPoint?.targetFrame).toBe(59);
    expect(endPoint).toMatchObject({
      frame: 60,
      targetFrame: 59,
      auraBefore: [
        {
          element: "pyro",
          expiresAtFrame: 431,
          expiresAtTargetFrame: 426
        }
      ]
    });
    expect(
      auraStateSnapshotsEqual(
        hitPoint?.auraAfter ?? [],
        endPoint?.auraBefore ?? []
      )
    ).toBe(true);
    expect(auditByTarget(result).get("enemy-0")).toMatchObject({
      finalGlobalFrame: 60,
      finalTargetFrame: 59,
      frozenFramesConsumed: 1,
      frozenFramesRemaining: 4
    });
  });

  it("keeps target clocks isolated across same-frame landed hits", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 60,
        targets: [
          { id: "enemy-0", name: "Paused target" },
          { id: "enemy-1", name: "Unpaused target" }
        ],
        hits: [
          {
            id: "pause-enemy-0",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 4,
              factor: 0
            }
          },
          {
            id: "zero-enemy-1",
            frame: 0,
            scaling: 1,
            element: "pyro",
            targeting: {
              targetId: "enemy-1",
              outcome: "landed"
            },
            targetHitlag: {
              haltFrames: 4,
              factor: 1
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );
    const audits = auditByTarget(result);

    expect(audits.get("enemy-0")).toMatchObject({
      finalGlobalFrame: 60,
      finalTargetFrame: 56,
      frozenFramesConsumed: 4,
      hitlagApplications: 1,
      totalExtensionFrames: 4
    });
    expect(audits.get("enemy-1")).toMatchObject({
      finalGlobalFrame: 60,
      finalTargetFrame: 60,
      frozenFramesConsumed: 0,
      hitlagApplications: 0,
      totalExtensionFrames: 0
    });
  });

  it("keeps Electro-Charged tick and wane cadence global while moving coexistence expiry", () => {
    const result = simulate(
      makeTargetClockConfig({
        durationFrames: 440,
        targets: [
          {
            id: "enemy-0",
            name: "Electro-Charged target",
            initialAura: [{ element: "hydro", gaugeUnits: 1 }]
          }
        ],
        targetPhases: [
          {
            id: "immune-ec-stream",
            label: "Keep Aura by making EC damage zero",
            targetId: "enemy-0",
            startFrame: 0,
            endFrame: 440,
            reason: "TEST_EC_DAMAGE_IMMUNITY",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          }
        ],
        reactionEngine: { mode: "aura-v2" },
        hits: [
          {
            id: "electro-charged-with-hitlag",
            frame: 0,
            scaling: 1,
            element: "electro",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "electro-charged-with-hitlag",
              icdGroup: "no-icd"
            },
            targetHitlag: {
              haltFrames: 3,
              factor: 0
            }
          }
        ]
      }),
      { critMode: "noCrit" }
    );
    const tickFrames = result.periodicReactionLog
      .filter((entry) => entry.operation === "tick")
      .map((entry) => entry.frame);
    const waneFrames = result.periodicReactionLog
      .filter(
        (entry) =>
          entry.operation === "wane" || entry.operation === "wane-skipped"
      )
      .map((entry) => entry.frame);
    const stop = result.periodicReactionLog.find(
      (entry) => entry.operation === "stop"
    );

    expect(tickFrames).toEqual([10, 70, 130, 190, 250, 310, 370]);
    expect(waneFrames).toEqual([16, 76, 136, 196, 256, 316, 376]);
    expect(stop).toMatchObject({
      frame: 429,
      operation: "stop",
      reason: "AURA_DECAY_EXPIRED"
    });
    expect(
      result.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
        .map((event) => event.frame)
    ).toEqual(tickFrames);
  });

  it("keeps Dendro-core spawn, expiry, and damage deadlines on the global gadget clock", () => {
    const result = simulate(makeDendroCoreHitlagConfig(), {
      critMode: "noCrit"
    });

    expect(
      result.dendroCoreLog.map(
        ({ operation, frame, clockModel, hitlagStatus }) => ({
          operation,
          frame,
          clockModel,
          hitlagStatus
        })
      )
    ).toEqual([
      {
        operation: "spawn-scheduled",
        frame: 0,
        clockModel: "global-frame-gadget-v1",
        hitlagStatus: "not-affected-by-enemy-hitlag"
      },
      {
        operation: "spawn",
        frame: 30,
        clockModel: "global-frame-gadget-v1",
        hitlagStatus: "not-affected-by-enemy-hitlag"
      },
      {
        operation: "expire",
        frame: 330,
        clockModel: "global-frame-gadget-v1",
        hitlagStatus: "not-affected-by-enemy-hitlag"
      }
    ]);
    expect(
      result.dendroCoreLog.find((entry) => entry.operation === "expire")
    ).toMatchObject({
      frame: 330,
      damageFrame: 331,
      reason: "NATURAL_EXPIRY"
    });
    expect(
      result.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" && event.reaction === "bloom"
      )
    ).toMatchObject({
      frame: 331,
      targetId: "enemy-0"
    });
    expect(auditByTarget(result).get("enemy-0")).toMatchObject({
      finalGlobalFrame: 335,
      finalTargetFrame: 330,
      frozenFramesConsumed: 5,
      totalExtensionFrames: 5
    });
  });

  it("is byte-for-byte deterministic for identical config, data, engine, seed, and runtime options", () => {
    const config = makeDendroCoreHitlagConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
