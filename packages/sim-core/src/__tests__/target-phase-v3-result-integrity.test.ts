import {
  assertTrustedSimulationResult,
  assertTrustedSimulationResultV142,
  assertTrustedSimulationResultV144,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  simulationResultSchema,
  simulationResultV142Schema,
  simulationResultV144Schema,
  targetPhaseV3ResultReferencesSchema,
  type SimConfig,
  type SimulationResult,
  type TargetPhaseV3LogEntry,
  type TargetPhaseV3TargetTask
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const DIRECT_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 0
};

function makeTargetPhaseV3BurningConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "target-phase-v3-integrity",
    randomSeed: "target-phase-v3-integrity",
    meta: {
      name: "Target phase v3 integrity vector",
      version: "1.44.0",
      verificationStatus: "provisional"
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "before-owner",
          name: "Before owner",
          position: { x: 0.5, y: 0 },
          hitboxRadius: 0
        },
        {
          id: "enemy-0",
          name: "Burning owner",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "dendro", gaugeUnits: 1 }
          ]
        },
        {
          id: "outside-radius",
          name: "Outside radius",
          position: { x: 5, y: 0 },
          hitboxRadius: 0
        },
        {
          id: "unresolved-position",
          name: "Unresolved position",
          position: { x: 10, y: 0 },
          hitboxRadius: 0
        }
      ]
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
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 1,
      abilities: [
        {
          id: "start-burning",
          actorId: "pyro",
          name: "Start Burning",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "start-burning-hit",
              label: "Start Burning hit",
              frame: 0,
              scaling: 0,
              element: "pyro",
              geometry: DIRECT_GEOMETRY,
              application: {
                gaugeUnits: 1,
                icdTag: "start-burning",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "start-burning",
          atFrame: 0
        }
      ]
    }
  };
}

function makeTargetPhaseV3BurningMotionConfig(): SimConfig {
  const base = makeTargetPhaseV3BurningConfig();
  return {
    ...base,
    enemy: {
      ...base.enemy,
      targetMotions: [
        {
          id: "outside-holds-position",
          label: "Outside target holds through first callback",
          targetId: "outside-radius",
          startFrame: 1,
          endFrame: 15,
          endPosition: { x: 5, y: 0 }
        }
      ]
    }
  };
}

function makeTargetPhaseV3ReactionTaskConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "target-phase-v3-reaction-task-integrity",
    randomSeed: "target-phase-v3-reaction-task-integrity",
    meta: {
      name: "Target phase v3 reaction-task integrity vector",
      version: "1.44.0",
      verificationStatus: "provisional"
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Hydro and Electro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 },
            { element: "electro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "dendro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 0 }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "quicken-bloom-chain",
          actorId: "driver",
          name: "Quicken Bloom chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "dendro-quicken",
              label: "Dendro Quicken",
              frame: 0,
              scaling: 0,
              element: "dendro",
              geometry: {
                ...DIRECT_GEOMETRY,
                radius: 1
              },
              application: {
                gaugeUnits: 0.8,
                icdTag: "dendro-quicken",
                icdGroup: "no-icd"
              }
            },
            {
              id: "electro-followup",
              label: "Electro followup",
              frame: 0,
              scaling: 0,
              element: "electro",
              geometry: {
                ...DIRECT_GEOMETRY,
                radius: 1
              },
              application: {
                gaugeUnits: 0.8,
                icdTag: "electro-followup",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "quicken-bloom-chain",
          atFrame: 0
        }
      ]
    }
  };
}

function makeTargetPhaseV3FrozenBoundaryConfig(): SimConfig {
  const base = makeTargetPhaseV3BurningConfig();
  const owner = {
    id: "enemy-0",
    name: "Burning owner",
    position: { x: 0, y: 0 },
    hitboxRadius: 0,
    initialAura: [{ element: "dendro" as const, gaugeUnits: 4 }]
  };
  const recipient = {
    id: "frozen-recipient",
    name: "Frozen recipient",
    position: { x: 2, y: 0 },
    hitboxRadius: 0,
    initialAura: [{ element: "cryo" as const, gaugeUnits: 1 }]
  };
  return {
    ...base,
    dataVersion: "target-phase-v3-frozen-transition-integrity",
    randomSeed: "target-phase-v3-frozen-transition-integrity",
    duration: 182 / 60,
    cycleLength: 182 / 60,
    enemy: {
      ...base.enemy,
      targets: [recipient, owner],
      targetMotions: [
        {
          id: "recipient-enters-burning-radius",
          label: "Recipient enters Burning radius at F176",
          targetId: recipient.id,
          startFrame: 175,
          endFrame: 176,
          endPosition: { x: 0.5, y: 0 }
        }
      ]
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 1,
      abilities: [
        {
          id: "frozen-boundary-chain",
          actorId: "pyro",
          name: "Frozen boundary chain",
          kind: "skill",
          cancelFrame: 57,
          animationEndFrame: 57,
          cooldownFrames: 0,
          hits: [
            {
              id: "freeze-at-f0",
              label: "Freeze recipient at F0",
              frame: 0,
              scaling: 0,
              element: "hydro",
              targeting: {
                targetId: recipient.id,
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "freeze-at-f0",
                icdGroup: "no-icd"
              }
            },
            {
              id: "start-burning-at-f56",
              label: "Start Burning at F56",
              frame: 56,
              scaling: 0,
              element: "pyro",
              geometry: DIRECT_GEOMETRY,
              application: {
                gaugeUnits: 1,
                icdTag: "start-burning-at-f56",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "frozen-boundary-chain",
          atFrame: 0
        }
      ]
    }
  };
}

function v3Phases(
  result: SimulationResult
): TargetPhaseV3LogEntry[] {
  return result.targetPhaseLog.filter(
    (phase): phase is TargetPhaseV3LogEntry =>
      phase.model === "target-phase-v3"
  );
}

function deliveredTasks(
  result: SimulationResult
): Array<{
  phase: TargetPhaseV3LogEntry;
  task: TargetPhaseV3TargetTask & {
    delivery: NonNullable<TargetPhaseV3TargetTask["delivery"]>;
  };
}> {
  return v3Phases(result).flatMap((phase) =>
    phase.targetTasks
      .filter(
        (
          task
        ): task is TargetPhaseV3TargetTask & {
          delivery: NonNullable<
            TargetPhaseV3TargetTask["delivery"]
          >;
        } => task.delivery !== null
      )
      .map((task) => ({ phase, task }))
  );
}

function expectBothBoundariesToReject(
  result: SimulationResult
): void {
  expect(simulationResultSchema.safeParse(result).success).toBe(
    false
  );
  expect(() =>
    assertTrustedSimulationResult(result)
  ).toThrow(/integrity validation failed/);
}

function refreshResultIdentity(result: SimulationResult): void {
  result.runManifest.configHash =
    createSimulationConfigHash(result.config);
  const {
    reproducibilityKey: _previousReproducibilityKey,
    ...identity
  } = result.runManifest;
  const reproducibilityKey =
    createSimulationReproducibilityKey(identity);
  result.runManifest.reproducibilityKey = reproducibilityKey;
  result.reproducibilityKey = reproducibilityKey;
}

describe("target-phase-v3 result integrity", () => {
  it("accepts a complete registered-order callback delivery at both boundaries", () => {
    const result = simulate(makeTargetPhaseV3BurningConfig(), {
      critMode: "noCrit"
    });

    expect(Object.keys(result)).toHaveLength(65);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);

    const deliveries = deliveredTasks(result);
    // One-second legal-frame runs include the F60 boundary, so the
    // 15-frame Burning cadence settles at F15/F30/F45/F60.
    expect(deliveries).toHaveLength(4);
    for (const { phase, task } of deliveries) {
      expect(phase.targetId).toBe("enemy-0");
      expect(task.delivery.attempts.map((attempt) => ({
        targetId: attempt.targetId,
        outcome: attempt.outcome,
        applicationPhase: attempt.applicationPhase
      }))).toEqual([
        {
          targetId: "before-owner",
          outcome: "landed",
          applicationPhase: "after-reactable-tick"
        },
        {
          targetId: "enemy-0",
          outcome: "landed",
          applicationPhase: "before-reactable-tick"
        },
        {
          targetId: "outside-radius",
          outcome: "miss",
          applicationPhase: "before-reactable-tick"
        },
        {
          targetId: "unresolved-position",
          outcome: "miss",
          applicationPhase: "before-reactable-tick"
        }
      ]);
      const callbackHitIds = task.delivery.attempts.flatMap(
        (attempt) =>
          attempt.hitResolutionLogId === null
            ? []
            : [attempt.hitResolutionLogId]
      );
      expect(
        v3Phases(result).flatMap(
          (candidate) => candidate.hitResolutionLogIds
        )
      ).not.toEqual(expect.arrayContaining(callbackHitIds));
    }
  });

  it("replays Burning callback target policies from config phases", () => {
    const config = makeTargetPhaseV3BurningConfig();
    config.enemy.targetPhases = [
      {
        id: "immune-callback-window",
        label: "Immune callback window",
        targetId: "before-owner",
        startFrame: 15,
        endFrame: 16,
        reason: "SCRIPTED_IMMUNITY",
        effects: {
          damage: "immune",
          aura: "blocked",
          hitConfirm: "blocked"
        }
      }
    ];
    const result = simulate(config, { critMode: "noCrit" });
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);

    const delivery = deliveredTasks(result)[0]!.task.delivery;
    const attempt = delivery.attempts.find(
      (candidate) => candidate.targetId === "before-owner"
    );
    if (attempt?.outcome !== "landed") {
      throw new Error("Expected landed phase-policy callback attempt.");
    }
    const hit = result.hitResolutionLog[attempt.hitResolutionLogId]!;
    const damage = result.damageEvents[attempt.damageEventId]!;
    expect(hit).toMatchObject({
      targetEffectSource: "target-phase",
      targetPhaseId: "immune-callback-window",
      reason: "SCRIPTED_IMMUNITY",
      damageAllowed: false,
      auraAllowed: false,
      hitConfirmAllowed: false,
      mechanicsStatus: "authoritative"
    });
    expect(damage).toMatchObject({
      targetDamagePolicy: "immune",
      targetDamageMultiplier: 0,
      mechanicsStatus: "authoritative"
    });
  });

  it("rejects forged Burning callback policy and mechanics flags", () => {
    const base = simulate(makeTargetPhaseV3BurningConfig());
    const delivery = deliveredTasks(base)[0]!.task.delivery;
    const attempt = delivery.attempts.find(
      (candidate) => candidate.outcome === "landed"
    );
    if (attempt?.outcome !== "landed") {
      throw new Error("Expected landed callback attempt.");
    }

    for (const field of [
      "damageAllowed",
      "auraAllowed",
      "hitConfirmAllowed"
    ] as const) {
      const forged = structuredClone(base);
      const forgedHit =
        forged.hitResolutionLog[attempt.hitResolutionLogId]!;
      forgedHit[field] = !forgedHit[field];
      expectBothBoundariesToReject(forged);
    }

    const forgedMechanics = structuredClone(base);
    const forgedHit =
      forgedMechanics.hitResolutionLog[attempt.hitResolutionLogId]!;
    const forgedDamage =
      forgedMechanics.damageEvents[attempt.damageEventId]!;
    forgedHit.mechanicsStatus = "mechanics-truncated";
    forgedDamage.mechanicsStatus = "mechanics-truncated";
    expectBothBoundariesToReject(forgedMechanics);
  });

  it("rejects deleting the delivery while retaining its callback lifecycle", () => {
    const forged = structuredClone(
      simulate(makeTargetPhaseV3BurningConfig())
    );
    const ownerTask = v3Phases(forged)
      .flatMap((phase) => phase.targetTasks)
      .find((task) => task.delivery !== null)!;
    ownerTask.delivery = null;
    expectBothBoundariesToReject(forged);
  });

  it("rejects coordinated attempt swaps and reciprocal reference swaps", () => {
    const base = simulate(makeTargetPhaseV3BurningConfig());

    const reordered = structuredClone(base);
    const reorderedDelivery = deliveredTasks(reordered)[0]!.task.delivery;
    const first = reorderedDelivery.attempts[0]!;
    const second = reorderedDelivery.attempts[1]!;
    reorderedDelivery.attempts[0] = { ...second, order: 0 };
    reorderedDelivery.attempts[1] = { ...first, order: 1 };
    expectBothBoundariesToReject(reordered);

    const swappedRefs = structuredClone(base);
    const swappedDelivery = deliveredTasks(swappedRefs)[0]!.task.delivery;
    const landed = swappedDelivery.attempts.filter(
      (attempt) => attempt.outcome === "landed"
    );
    expect(landed).toHaveLength(2);
    const left = landed[0]!;
    const right = landed[1]!;
    const leftRefs = {
      hitResolutionLogId: left.hitResolutionLogId,
      damageEventId: left.damageEventId,
      targetStateTimelinePointId:
        left.targetStateTimelinePointId
    };
    left.hitResolutionLogId = right.hitResolutionLogId;
    left.damageEventId = right.damageEventId;
    left.targetStateTimelinePointId =
      right.targetStateTimelinePointId;
    right.hitResolutionLogId = leftRefs.hitResolutionLogId;
    right.damageEventId = leftRefs.damageEventId;
    right.targetStateTimelinePointId =
      leftRefs.targetStateTimelinePointId;
    expectBothBoundariesToReject(swappedRefs);
  });

  it("rejects wrong application phase, delivery tuple, and attempt outcome", () => {
    const base = simulate(makeTargetPhaseV3BurningConfig());

    const wrongPhase = structuredClone(base);
    const phaseAttempt = deliveredTasks(wrongPhase)[0]!.task.delivery
      .attempts[0]!;
    phaseAttempt.applicationPhase = "before-reactable-tick";
    expectBothBoundariesToReject(wrongPhase);

    const wrongTuple = structuredClone(base);
    deliveredTasks(wrongTuple)[0]!.task.delivery.eventPriority +=
      0.001;
    expectBothBoundariesToReject(wrongTuple);

    const wrongOutcome = structuredClone(base);
    const missAttempt = deliveredTasks(wrongOutcome)[0]!.task.delivery
      .attempts.find((attempt) => attempt.outcome === "miss")!;
    Object.assign(missAttempt, {
      outcome: "unresolved",
      hitResolutionLogId: null
    });
    expectBothBoundariesToReject(wrongOutcome);
  });

  it("rejects Burning deadline and config-rooted geometry drift", () => {
    const base = simulate(makeTargetPhaseV3BurningConfig());

    const wrongDeadline = structuredClone(base);
    const deadlineTask = deliveredTasks(wrongDeadline)[0]!.task;
    deadlineTask.deadlineTargetFrame -= 1;
    expectBothBoundariesToReject(wrongDeadline);

    const wrongCenter = structuredClone(base);
    const centerDelivery = deliveredTasks(wrongCenter)[0]!.task.delivery;
    wrongCenter.reactionDamageLog[
      centerDelivery.reactionDamageLogId
    ]!.centerPosition = { x: 123, y: 456 };
    expectBothBoundariesToReject(wrongCenter);

    const wrongRadius = structuredClone(base);
    const radiusDelivery = deliveredTasks(wrongRadius)[0]!.task.delivery;
    wrongRadius.reactionDamageLog[
      radiusDelivery.reactionDamageLogId
    ]!.radius = 5;
    expectBothBoundariesToReject(wrongRadius);

    const wrongGauge = structuredClone(base);
    const gaugeDelivery = deliveredTasks(wrongGauge)[0]!.task.delivery;
    wrongGauge.reactionDamageLog[
      gaugeDelivery.reactionDamageLogId
    ]!.applicationGaugeUnits = 2;
    expectBothBoundariesToReject(wrongGauge);

    const wrongHitWitness = structuredClone(base);
    const landedAttempt = deliveredTasks(wrongHitWitness)[0]!
      .task.delivery.attempts.find(
        (attempt) => attempt.outcome === "landed"
      )!;
    wrongHitWitness.hitResolutionLog[
      landedAttempt.hitResolutionLogId
    ]!.geometryDistance! += 0.25;
    expectBothBoundariesToReject(wrongHitWitness);

    const coordinatedMotion = simulate(
      makeTargetPhaseV3BurningMotionConfig()
    );
    const configuredMotion =
      coordinatedMotion.config.enemy.targetMotions?.[0];
    const projectedMotion =
      coordinatedMotion.targetMotionTimeline[0];
    if (configuredMotion === undefined || projectedMotion === undefined) {
      throw new Error(
        "Burning motion vector must expose its config and projection."
      );
    }
    configuredMotion.endPosition = { x: 0.5, y: 0 };
    projectedMotion.endPosition = { x: 0.5, y: 0 };
    refreshResultIdentity(coordinatedMotion);
    expectBothBoundariesToReject(coordinatedMotion);

    const forgedProjection = simulate(
      makeTargetPhaseV3BurningMotionConfig()
    );
    const forgedMotion = forgedProjection.targetMotionTimeline[0];
    if (forgedMotion === undefined) {
      throw new Error(
        "Burning motion vector must expose its projected timeline."
      );
    }
    forgedMotion.startPosition = { x: 99, y: 99 };
    expectBothBoundariesToReject(forgedProjection);
  });

  it("rejects recipient-phase ownership of callback-owned hits", () => {
    const forged = structuredClone(
      simulate(makeTargetPhaseV3BurningConfig())
    );
    const delivery = deliveredTasks(forged)[0]!.task.delivery;
    const landed = delivery.attempts.find(
      (attempt) => attempt.outcome === "landed"
    )!;
    const recipient = v3Phases(forged).find(
      (phase) =>
        phase.globalFrame ===
          deliveredTasks(forged)[0]!.phase.globalFrame &&
        phase.targetId === landed.targetId
    )!;
    recipient.hitResolutionLogIds = [
      ...recipient.hitResolutionLogIds,
      landed.hitResolutionLogId
    ].sort((left, right) => left - right);
    expectBothBoundariesToReject(forged);
  });

  it("rejects unexplained Aura changes at the Reactable boundary", () => {
    const base = simulate(makeTargetPhaseV3BurningConfig());
    const fakeHydro = [
      {
        element: "hydro" as const,
        gaugeUnits: 0.2,
        expiresAtFrame: 50,
        expiresAtTargetFrame: 50
      }
    ];

    const tickOnly = structuredClone(base);
    const tickOnlyPhase = v3Phases(tickOnly).find(
      (phase) =>
        phase.globalFrame === 15 &&
        phase.targetId === "outside-radius"
    )!;
    expect(tickOnlyPhase.targetTasks).toEqual([]);
    tickOnlyPhase.reactableTick.auraBefore = fakeHydro;
    tickOnlyPhase.reactableTick.auraAfter = structuredClone(fakeHydro);
    expectBothBoundariesToReject(tickOnly);

    const coordinated = structuredClone(base);
    const coordinatedPhase = v3Phases(coordinated).find(
      (phase) =>
        phase.globalFrame === 15 &&
        phase.targetId === "outside-radius"
    )!;
    coordinatedPhase.auraAfterTargetTasks = fakeHydro;
    coordinatedPhase.reactableTick.auraBefore =
      structuredClone(fakeHydro);
    coordinatedPhase.reactableTick.auraAfter =
      structuredClone(fakeHydro);
    expectBothBoundariesToReject(coordinated);

    const crossPhase = structuredClone(base);
    const crossPhaseRow = v3Phases(crossPhase).find(
      (phase) =>
        phase.globalFrame === 30 &&
        phase.targetId === "outside-radius"
    )!;
    crossPhaseRow.auraBeforeTargetTasks = fakeHydro;
    crossPhaseRow.auraAfterTargetTasks = structuredClone(fakeHydro);
    crossPhaseRow.reactableTick.auraBefore =
      structuredClone(fakeHydro);
    crossPhaseRow.reactableTick.auraAfter =
      structuredClone(fakeHydro);
    expectBothBoundariesToReject(crossPhase);
  });

  it("requires exactly one correct phase owner for every ordinary hit", () => {
    const base = simulate(makeTargetPhaseV3BurningConfig());
    const source = v3Phases(base).find(
      (phase) => phase.hitResolutionLogIds.length > 0
    )!;
    const ordinaryHitId = source.hitResolutionLogIds[0]!;
    const recipient = v3Phases(base).find(
      (phase) =>
        phase.globalFrame === source.globalFrame &&
        phase.targetId !== source.targetId
    )!;

    const missing = structuredClone(base);
    const missingSource = v3Phases(missing).find(
      (phase) => phase.id === source.id
    )!;
    missingSource.hitResolutionLogIds =
      missingSource.hitResolutionLogIds.filter(
        (id) => id !== ordinaryHitId
      );
    expectBothBoundariesToReject(missing);

    const wrongTarget = structuredClone(missing);
    const wrongRecipient = v3Phases(wrongTarget).find(
      (phase) => phase.id === recipient.id
    )!;
    wrongRecipient.hitResolutionLogIds = [
      ...wrongRecipient.hitResolutionLogIds,
      ordinaryHitId
    ].sort((left, right) => left - right);
    expectBothBoundariesToReject(wrongTarget);

    const duplicate = structuredClone(base);
    const duplicateRecipient = v3Phases(duplicate).find(
      (phase) => phase.id === recipient.id
    )!;
    duplicateRecipient.hitResolutionLogIds = [
      ...duplicateRecipient.hitResolutionLogIds,
      ordinaryHitId
    ].sort((left, right) => left - right);
    expectBothBoundariesToReject(duplicate);
  });

  it("requires exactly one target phase owner for every core reaction task", () => {
    const result = simulate(makeTargetPhaseV3ReactionTaskConfig());
    expect(result.reactionTaskLog.length).toBeGreaterThan(0);
    const owner = v3Phases(result).find(
      (phase) => phase.reactionTaskLogIds.length > 0
    )!;
    const taskId = owner.reactionTaskLogIds[0]!;
    const forged = structuredClone(result);
    const forgedOwner = v3Phases(forged).find(
      (phase) => phase.id === owner.id
    )!;
    forgedOwner.reactionTaskLogIds =
      forgedOwner.reactionTaskLogIds.filter((id) => id !== taskId);
    expectBothBoundariesToReject(forged);
  });

  it("binds typed Frozen expiry transitions to their exact lifecycle row and timeline point", () => {
    const base = simulate(makeTargetPhaseV3FrozenBoundaryConfig());
    const ownerPhase = v3Phases(base).find((phase) =>
      phase.reactableTick.transitions.some(
        (transition) => transition.kind === "frozen-expiry"
      )
    )!;
    const transitionIndex =
      ownerPhase.reactableTick.transitions.findIndex(
        (transition) => transition.kind === "frozen-expiry"
      );
    const transition = ownerPhase.reactableTick.transitions[
      transitionIndex
    ]!;
    if (transition.kind !== "frozen-expiry") {
      throw new Error("missing Frozen expiry transition");
    }
    const wrongRow = base.frozenStateLog.find(
      (row) =>
        row.targetId === ownerPhase.targetId &&
        row.id !== transition.frozenStateLogId
    )!;

    const wrongForeignKey = structuredClone(base);
    const wrongForeignKeyPhase = v3Phases(wrongForeignKey).find(
      (phase) => phase.id === ownerPhase.id
    )!;
    const wrongForeignKeyTransition =
      wrongForeignKeyPhase.reactableTick.transitions[
        transitionIndex
      ]!;
    if (wrongForeignKeyTransition.kind !== "frozen-expiry") {
      throw new Error("missing cloned Frozen expiry transition");
    }
    wrongForeignKeyTransition.frozenStateLogId = wrongRow.id;
    expectBothBoundariesToReject(wrongForeignKey);

    const deleted = structuredClone(base);
    const deletedPhase = v3Phases(deleted).find(
      (phase) => phase.id === ownerPhase.id
    )!;
    const expiryPoint = deleted.targetStateTimeline.points[
      transition.targetStateTimelinePointId
    ]!;
    deletedPhase.reactableTick.transitions.splice(
      transitionIndex,
      1
    );
    deletedPhase.reactableTick.auraAfter = structuredClone(
      expiryPoint.auraBefore
    );
    expectBothBoundariesToReject(deleted);
  });

  it("fails closed without throwing for malformed standalone facet input", () => {
    for (const value of [
      null,
      [],
      {},
      { config: {} },
      {
        config: { targetTaskModel: { mode: "target-phase-v3" } },
        enemyTargets: [],
        targetPhaseLog: [null],
        targetTaskPhaseLog: [],
        burningStateLog: [],
        reactionDamageLog: [],
        hitResolutionLog: [],
        damageEvents: [],
        targetStateTimeline: { points: [] }
      }
    ]) {
      expect(() =>
        targetPhaseV3ResultReferencesSchema.safeParse(value)
      ).not.toThrow();
      expect(
        targetPhaseV3ResultReferencesSchema.safeParse(value).success
      ).toBe(false);
    }

    const frozenIdentity = structuredClone(
      simulate(makeTargetPhaseV3BurningConfig())
    ) as unknown as {
      schemaVersion: string;
      engineVersion: string;
      config: { schemaVersion: string; engineVersion: string };
    };
    frozenIdentity.schemaVersion =
      EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION;
    frozenIdentity.engineVersion =
      EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION;
    frozenIdentity.config.schemaVersion =
      EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION;
    frozenIdentity.config.engineVersion =
      EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION;
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(frozenIdentity)
        .success
    ).toBe(false);
  });

  it("keeps the frozen 1.42 and 1.44 boundaries identity-exact", () => {
    const current = simulate(makeTargetPhaseV3BurningConfig());
    expect(simulationResultV142Schema.safeParse(current).success).toBe(
      false
    );
    expect(simulationResultV144Schema.safeParse(current).success).toBe(
      false
    );
    expect(() =>
      assertTrustedSimulationResultV142(current)
    ).toThrow(/frozen schema 1\.42\.0/);
    expect(() =>
      assertTrustedSimulationResultV144(current)
    ).toThrow(/integrity validation failed/);
  });
});
