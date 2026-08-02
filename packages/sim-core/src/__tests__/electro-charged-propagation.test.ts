import type {
  EnemyTargetProfile,
  FrameHitDefinition,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const SOURCE_ID = "enemy-0";

function electroApplication(_id: string) {
  return {
    gaugeUnits: 1,
    icd: { mode: "no-icd-v1" as const }
  };
}

function makePropagationConfig({
  targets,
  hits,
  radius = 3,
  durationFrames = 30,
  actorId = "ec-owner"
}: {
  targets: EnemyTargetProfile[];
  hits?: FrameHitDefinition[];
  radius?: number;
  durationFrames?: number;
  actorId?: string;
}): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const resolvedDurationFrames = Math.max(
    60,
    durationFrames
  );
  return makeConfig({
    duration: resolvedDurationFrames / 60,
    cycleLength: resolvedDurationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...template,
        id: actorId,
        name: "EC Owner",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          em: 120,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetTaskModel: { mode: "target-phase-v2" },
    electroChargedPropagationModel: {
      mode: "nearby-wet-radius-v1",
      radius,
      verificationStatus: "provisional"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actorId,
      swapFrames: 1,
      abilities: [
        {
          id: "start-ec",
          actorId,
          name: "Start EC",
          kind: "skill",
          cancelFrame: 11,
          animationEndFrame: 11,
          cooldownFrames: 0,
          hits:
            hits ??
            [
              {
                id: "start-ec-hit",
                label: "Start EC",
                frame: 0,
                scaling: 1,
                element: "electro",
                geometry: {
                  kind: "circle",
                  coordinateSpace: "world",
                  origin: { x: 0, y: 0 },
                  radius: 0.01
                },
                application: electroApplication(
                  "start-ec-hit"
                )
              }
            ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId,
          abilityId: "start-ec"
        }
      ]
    }
  });
}

describe("Electro-Charged nearby Wet propagation", () => {
  it("accepts a real target-local Hitlag run and replays each candidate target frame independently", () => {
    const config = makePropagationConfig({
      targets: [
        {
          id: SOURCE_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          resistance: 0.1,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-nearby",
          name: "Wet nearby",
          position: { x: 1, y: 0 },
          resistance: 0.1,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ],
      hits: [
        {
          id: "start-ec-hitlag",
          label: "Start EC with Hitlag",
          frame: 0,
          scaling: 1,
          element: "electro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 0, y: 0 },
            radius: 0.01
          },
          application: electroApplication(
            "start-ec-hitlag"
          ),
          targetHitlag: {
            haltFrames: 5,
            factor: 0.25
          }
        }
      ]
    });
    config.targetClockModel = {
      mode: "target-local-hitlag-v1"
    };

    const result = simulate(config);
    const reaction = result.reactionDamageLog.find(
      (entry) =>
        entry.electroChargedPropagation !== undefined
    );
    expect(reaction).toBeDefined();
    const candidates =
      reaction!.electroChargedPropagation!.candidates;
    expect(candidates.map((candidate) => candidate.targetId)).toEqual(
      [SOURCE_ID, "wet-nearby"]
    );

    const observationByTargetId = new Map(
      candidates.map((candidate) => [
        candidate.targetId,
        result.targetStateTimeline.points.find(
          (point) =>
            point.id ===
            candidate.auraObservationTimelinePointId
        )!
      ])
    );
    const sourceObservation =
      observationByTargetId.get(SOURCE_ID)!;
    const nearbyObservation =
      observationByTargetId.get("wet-nearby")!;
    expect(sourceObservation.frame).toBe(10);
    expect(sourceObservation.targetFrame).toBeLessThan(10);
    expect(nearbyObservation.frame).toBe(10);
    expect(nearbyObservation.targetFrame).toBe(10);

    for (const candidate of candidates.filter(
      (entry) => entry.selected
    )) {
      const observation = observationByTargetId.get(
        candidate.targetId
      )!;
      const application =
        result.targetStateTimeline.points.find(
          (point) =>
            point.primaryDamageEventId ===
              candidate.damageEventId &&
            point.cause ===
              "reaction-damage-application"
        );
      expect(application?.targetFrame).toBe(
        observation.targetFrame
      );
    }
  });

  it("matches Wane source mutations by actor identity when wire and insertion orders differ", () => {
    const config = makePropagationConfig({
      actorId: "0",
      targets: [
        {
          id: SOURCE_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-nearby",
          name: "Wet nearby",
          position: { x: 1, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ],
      hits: [
        {
          id: "hydro-overlap",
          label: "Hydro overlap",
          frame: 0,
          scaling: 1,
          element: "hydro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 0, y: 0 },
            radius: 0.01
          },
          application: electroApplication("hydro-overlap")
        },
        {
          id: "start-ec-after-overlap",
          label: "Start EC after overlap",
          frame: 1,
          scaling: 1,
          element: "electro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 0, y: 0 },
            radius: 0.01
          },
          application: electroApplication(
            "start-ec-after-overlap"
          )
        }
      ]
    });
    config.reactionEngine = { mode: "aura-v9" };

    const result = simulate(config, { critMode: "noCrit" });
    const wane = result.periodicReactionLog.find(
      (entry) =>
        entry.targetId === SOURCE_ID && entry.operation === "wane"
    );
    const hydroBefore = wane?.auraBefore.find(
      (entry) => entry.element === "hydro"
    );
    const hydroConsumed = wane?.auraConsumed.find(
      (entry) => entry.element === "hydro"
    );

    expect(wane).toBeDefined();
    expect(
      hydroBefore?.sourceSlots?.map((slot) => slot.sourceActorId)
    ).toEqual(["0", "__initial__"]);
    expect(
      hydroConsumed?.sourceMutations?.map(
        (mutation) => mutation.sourceActorId
      )
    ).toEqual(["__initial__", "0"]);
  });

  it("selects every in-range Wet hurtbox at P5 and audits every registered candidate", () => {
    const config = makePropagationConfig({
      targets: [
        {
          id: SOURCE_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          resistance: 0.1,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-boundary",
          name: "Wet boundary",
          position: { x: 3.5, y: 0 },
          hitboxRadius: 0.5,
          resistance: 0.5,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "dry-nearby",
          name: "Dry nearby",
          position: { x: 1, y: 0 },
          hitboxRadius: 0
        },
        {
          id: "wet-outside",
          name: "Wet outside",
          position: { x: 3.51, y: 0 },
          hitboxRadius: 0.5,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-unresolved",
          name: "Wet unresolved",
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-immune",
          name: "Wet immune",
          position: { x: 2, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ],
      hits: [
        {
          id: "start-source-with-unresolved-candidate",
          label: "Start source with unresolved candidate",
          frame: 0,
          scaling: 1,
          element: "electro",
          targeting: {
            targetId: SOURCE_ID,
            outcome: "landed"
          },
          application: electroApplication(
            "start-source-with-unresolved-candidate"
          )
        }
      ]
    });
    config.enemy.targetPhases = [
      {
        id: "immune-at-first-tick",
        label: "Immune at first tick",
        targetId: "wet-immune",
        startFrame: 10,
        endFrame: 11,
        reason: "TEST_EC_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const reactionLog = result.reactionDamageLog.find(
      (entry) =>
        entry.reaction === "electroCharged" &&
        entry.withinSimulation
    )!;
    const audit = reactionLog.electroChargedPropagation!;
    const tickDamage = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged" &&
        event.frame === 10
    );

    expect(reactionLog).toMatchObject({
      targetingMode: "electro-charged-nearby-wet",
      centerPosition: { x: 0, y: 0 },
      radius: 3,
      checkedTargetIds: [
        SOURCE_ID,
        "wet-boundary",
        "wet-immune"
      ],
      hitTargetIds: [
        SOURCE_ID,
        "wet-boundary",
        "wet-immune"
      ],
      unresolvedTargetIds: ["wet-unresolved"]
    });
    expect(audit).toMatchObject({
      model: "nearby-wet-radius-v1",
      verificationStatus: "provisional",
      mechanicsDataStatus: "community-provisional",
      generation: 1,
      tickIndex: 0,
      evaluationFrame: 10,
      eventPriority: 5,
      radius: 3,
      selectionMode:
        "all-in-range-registration-order-v1",
      sourcePosition: { x: 0, y: 0 }
    });
    expect(
      audit.candidates.map(
        ({
          targetId,
          targetOrder,
          selected,
          reason,
          distance,
          threshold
        }) => ({
          targetId,
          targetOrder,
          selected,
          reason,
          distance,
          threshold
        })
      )
    ).toEqual([
      {
        targetId: SOURCE_ID,
        targetOrder: 0,
        selected: true,
        reason: "SOURCE_STREAM_TARGET",
        distance: null,
        threshold: null
      },
      {
        targetId: "wet-boundary",
        targetOrder: 1,
        selected: true,
        reason: "NEARBY_WET_IN_RANGE",
        distance: 3.5,
        threshold: 3.5
      },
      {
        targetId: "dry-nearby",
        targetOrder: 2,
        selected: false,
        reason: "NO_HYDRO_AURA",
        distance: null,
        threshold: null
      },
      {
        targetId: "wet-outside",
        targetOrder: 3,
        selected: false,
        reason: "OUT_OF_RANGE",
        distance: 3.51,
        threshold: 3.5
      },
      {
        targetId: "wet-unresolved",
        targetOrder: 4,
        selected: false,
        reason: "POSITION_UNRESOLVED",
        distance: null,
        threshold: null
      },
      {
        targetId: "wet-immune",
        targetOrder: 5,
        selected: true,
        reason: "NEARBY_WET_IN_RANGE",
        distance: 2,
        threshold: 3
      }
    ]);
    expect(
      audit.candidates
        .filter((candidate) => candidate.selected)
        .every(
          (candidate) =>
            candidate.hitResolutionLogId !== null &&
            candidate.damageEventId !== null
        )
    ).toBe(true);
    expect(
      audit.candidates
        .filter((candidate) => !candidate.selected)
        .every(
          (candidate) =>
            candidate.hitResolutionLogId === null &&
            candidate.damageEventId === null
        )
    ).toBe(true);
    for (const candidate of audit.candidates) {
      const witness =
        result.targetStateTimeline.points[
          candidate.auraObservationTimelinePointId
        ];
      expect(witness).toMatchObject({
        id: candidate.auraObservationTimelinePointId,
        frame: 10,
        targetId: candidate.targetId,
        targetName: candidate.targetName,
        pointKind: "observation",
        cause:
          "electro-charged-propagation-candidate",
        eventType: "reactionDamage",
        eventPriority: 5,
        eventSequence: audit.eventSequence,
        reaction: "electroCharged",
        reactions: ["electroCharged"],
        primaryDamageEventId: null,
        links: [
          {
            kind: "reaction-damage-log",
            id: reactionLog.id
          }
        ],
        auraApplied: [],
        auraConsumed: []
      });
      expect(witness?.auraAfter).toEqual(
        witness?.auraBefore
      );
      expect(
        witness?.auraBefore.find(
          (entry) => entry.element === "hydro"
        )?.gaugeUnits ?? 0
      ).toBe(candidate.hydroGaugeUnits);
      if (candidate.selected) {
        const damageApplicationPoint =
          result.targetStateTimeline.points.find(
            (point) =>
              point.targetId === candidate.targetId &&
              point.frame === 10 &&
              point.cause ===
                "reaction-damage-application" &&
              point.links.some(
                (link) =>
                  link.kind ===
                    "reaction-damage-log" &&
                  link.id === reactionLog.id
              )
          );
        expect(damageApplicationPoint).toBeDefined();
        expect(witness!.id).toBeLessThan(
          damageApplicationPoint!.id
        );
      }
    }
    const candidateWitnessIntraEventSequences =
      audit.candidates.map(
        (candidate) =>
          result.targetStateTimeline.points[
            candidate.auraObservationTimelinePointId
          ]!.intraEventSequence!
      );
    expect(candidateWitnessIntraEventSequences).toEqual(
      [...candidateWitnessIntraEventSequences].sort(
        (left, right) => left - right
      )
    );
    expect(
      new Set(candidateWitnessIntraEventSequences).size
    ).toBe(audit.candidates.length);
    expect(tickDamage.map((event) => event.targetId)).toEqual([
      SOURCE_ID,
      "wet-boundary",
      "wet-immune"
    ]);
    expect(
      tickDamage.find(
        (event) => event.targetId === "wet-immune"
      )
    ).toMatchObject({
      targetDamagePolicy: "immune",
      finalDamage: 0
    });
    expect(
      tickDamage.find(
        (event) => event.targetId === "wet-boundary"
      )!.finalDamage
    ).toBeLessThan(
      tickDamage.find(
        (event) => event.targetId === SOURCE_ID
      )!.finalDamage
    );
    expect(
      new Set(
        tickDamage.map(
          (event) => event.parentDamageEventId
        )
      ).size
    ).toBe(1);

    const secondaryObservation =
      result.targetStateTimeline.points.find(
        (point) =>
          point.frame === 10 &&
          point.targetId === "wet-boundary" &&
          point.cause ===
            "reaction-damage-application"
      );
    expect(secondaryObservation).toMatchObject({
      pointKind: "observation",
      reaction: "electroCharged",
      reactions: ["electroCharged"]
    });
    expect(secondaryObservation?.auraAfter).toEqual(
      secondaryObservation?.auraBefore
    );
    expect(
      result.periodicReactionLog.some(
        (entry) => entry.targetId === "wet-boundary"
      )
    ).toBe(false);
  });

  it("uses Hydro applied by a same-frame P3 hit when selecting P5 propagation", () => {
    const config = makePropagationConfig({
      targets: [
        {
          id: SOURCE_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "same-frame-wet",
          name: "Same-frame Wet",
          position: { x: 1, y: 0 }
        }
      ],
      hits: [
        {
          id: "start-source-ec",
          label: "Start source EC",
          frame: 0,
          scaling: 1,
          element: "electro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 0, y: 0 },
            radius: 0.01
          },
          application: electroApplication(
            "start-source-ec"
          )
        },
        {
          id: "same-frame-hydro",
          label: "Same-frame Hydro",
          frame: 10,
          scaling: 1,
          element: "hydro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 1, y: 0 },
            radius: 0.01
          },
          application: {
            gaugeUnits: 1,
            icd: { mode: "no-icd-v1" }
          }
        }
      ]
    });

    const result = simulate(config, { critMode: "noCrit" });
    const audit =
      result.reactionDamageLog.find(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.damageFrame === 10
      )!.electroChargedPropagation!;
    expect(
      audit.candidates.find(
        (candidate) =>
          candidate.targetId === "same-frame-wet"
      )
    ).toMatchObject({
      selected: true,
      reason: "NEARBY_WET_IN_RANGE",
      hydroGaugeUnits: expect.any(Number)
    });
    expect(
      result.damageEvents.some(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "electroCharged" &&
          event.frame === 10 &&
          event.targetId === "same-frame-wet"
      )
    ).toBe(true);
  });

  it("does not emit propagation-candidate witnesses in single-target mode", () => {
    const config = makePropagationConfig({
      targets: [
        {
          id: SOURCE_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-nearby",
          name: "Wet nearby",
          position: { x: 1, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ]
    });
    config.electroChargedPropagationModel = {
      mode: "single-target-v1"
    };

    const result = simulate(config, { critMode: "noCrit" });
    expect(
      result.targetStateTimeline.points.some(
        (point) =>
          point.cause ===
          "electro-charged-propagation-candidate"
      )
    ).toBe(false);
    expect(
      result.reactionDamageLog.find(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.withinSimulation
      )
    ).toMatchObject({
      targetingMode: "single-target",
      checkedTargetIds: [SOURCE_ID],
      hitTargetIds: [SOURCE_ID],
      damageEventIds: [expect.any(Number)]
    });
  });

  it("keeps a secondary target's existing owner and cadence unchanged", () => {
    const base = makeConfig();
    const template = base.characters[0]!;
    const config = makeConfig({
      duration: 78 / 60,
      cycleLength: 78 / 60,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: SOURCE_ID,
            name: "A stream",
            position: { x: 0, y: 0 },
            initialAura: [
              { element: "hydro", gaugeUnits: 1 }
            ]
          },
          {
            id: "enemy-b",
            name: "B stream",
            position: { x: 1, y: 0 },
            initialAura: [
              { element: "hydro", gaugeUnits: 1 }
            ]
          }
        ]
      },
      characters: [
        {
          ...template,
          id: "owner-a",
          name: "Owner A",
          element: "electro",
          level: 90,
          stats: { ...neutralStats, em: 100 }
        },
        {
          ...template,
          id: "owner-b",
          name: "Owner B",
          element: "electro",
          level: 90,
          stats: { ...neutralStats, em: 300 }
        }
      ],
      rotation: [],
      reactionEngine: { mode: "aura-v8" },
      targetTaskModel: { mode: "target-phase-v2" },
      electroChargedPropagationModel: {
        mode: "nearby-wet-radius-v1",
        radius: 3,
        verificationStatus: "provisional"
      },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "owner-a",
        swapFrames: 1,
        abilities: [
          {
            id: "start-a",
            actorId: "owner-a",
            name: "Start A",
            kind: "skill",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "start-a-hit",
                label: "Start A",
                frame: 0,
                scaling: 1,
                element: "electro",
                geometry: {
                  kind: "circle",
                  coordinateSpace: "world",
                  origin: { x: 0, y: 0 },
                  radius: 0.01
                },
                application: electroApplication(
                  "start-a-hit"
                )
              }
            ]
          },
          {
            id: "start-b",
            actorId: "owner-b",
            name: "Start B",
            kind: "skill",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "start-b-hit",
                label: "Start B",
                frame: 0,
                scaling: 1,
                element: "electro",
                geometry: {
                  kind: "circle",
                  coordinateSpace: "world",
                  origin: { x: 1, y: 0 },
                  radius: 0.01
                },
                application: electroApplication(
                  "start-b-hit"
                )
              }
            ]
          }
        ],
        commands: [
          {
            type: "skill",
            actorId: "owner-a",
            abilityId: "start-a"
          },
          { type: "swap", characterId: "owner-b" },
          {
            type: "skill",
            actorId: "owner-b",
            abilityId: "start-b"
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });
    const streamBTicks = result.periodicReactionLog
      .filter(
        (entry) =>
          entry.targetId === "enemy-b" &&
          entry.operation === "tick"
      )
      .map((entry) => ({
        frame: entry.frame,
        sourceActorId: entry.sourceActorId
      }));
    expect(streamBTicks).toEqual([
      { frame: 12, sourceActorId: "owner-b" },
      { frame: 72, sourceActorId: "owner-b" }
    ]);
    expect(
      result.periodicReactionLog.filter(
        (entry) =>
          entry.targetId === "enemy-b" &&
          (entry.operation === "wane" ||
            entry.operation === "wane-skipped")
      ).map((entry) => entry.frame)
    ).toEqual([18, 78]);
  });

  it("keeps the source child when the source position is unresolved", () => {
    const config = makePropagationConfig({
      targets: [
        {
          id: SOURCE_ID,
          name: "Unresolved source",
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-nearby",
          name: "Wet nearby",
          position: { x: 1, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ],
      hits: [
        {
          id: "start-unresolved-source",
          label: "Start unresolved source",
          frame: 0,
          scaling: 1,
          element: "electro",
          targeting: {
            targetId: SOURCE_ID,
            outcome: "landed"
          },
          application: electroApplication(
            "start-unresolved-source"
          )
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    const log = result.reactionDamageLog.find(
      (entry) =>
        entry.reaction === "electroCharged" &&
        entry.withinSimulation
    )!;

    expect(log).toMatchObject({
      centerPosition: null,
      checkedTargetIds: [SOURCE_ID],
      hitTargetIds: [SOURCE_ID],
      unresolvedTargetIds: ["wet-nearby"]
    });
    expect(
      log.electroChargedPropagation?.candidates.map(
        ({ targetId, selected, reason }) => ({
          targetId,
          selected,
          reason
        })
      )
    ).toEqual([
      {
        targetId: SOURCE_ID,
        selected: true,
        reason: "SOURCE_STREAM_TARGET"
      },
      {
        targetId: "wet-nearby",
        selected: false,
        reason: "SOURCE_POSITION_UNRESOLVED"
      }
    ]);
  });

  it("orders simultaneous streams deterministically and applies ReactionB per target", () => {
    const targets: EnemyTargetProfile[] = [
      {
        id: SOURCE_ID,
        name: "First",
        position: { x: 0, y: 0 },
        initialAura: [
          { element: "hydro", gaugeUnits: 1 }
        ]
      },
      {
        id: "enemy-second",
        name: "Second",
        position: { x: 1, y: 0 },
        initialAura: [
          { element: "hydro", gaugeUnits: 1 }
        ]
      }
    ];
    const config = makePropagationConfig({
      targets,
      durationFrames: 20,
      hits: [
        {
          id: "start-first",
          label: "Start first",
          frame: 0,
          scaling: 1,
          element: "electro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 0, y: 0 },
            radius: 0.01
          },
          application: electroApplication("start-first")
        },
        {
          id: "start-second",
          label: "Start second",
          frame: 0,
          scaling: 1,
          element: "electro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 1, y: 0 },
            radius: 0.01
          },
          application: electroApplication("start-second")
        }
      ]
    });

    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });
    const batches = first.reactionDamageLog.filter(
      (entry) =>
        entry.reaction === "electroCharged" &&
        entry.withinSimulation
    );

    expect(second).toEqual(first);
    expect(
      batches.map((batch) => ({
        sourceTargetId: batch.sourceTargetId,
        candidates:
          batch.electroChargedPropagation?.candidates.map(
            (candidate) => candidate.targetId
          ),
        blocked: batch.damageGroupBlockedTargetIds
      }))
    ).toEqual([
      {
        sourceTargetId: SOURCE_ID,
        candidates: [SOURCE_ID, "enemy-second"],
        blocked: []
      },
      {
        sourceTargetId: "enemy-second",
        candidates: ["enemy-second", SOURCE_ID],
        blocked: ["enemy-second", SOURCE_ID]
      }
    ]);
    expect(
      first.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged" &&
            event.frame === 10
        )
        .map((event) => event.finalDamage > 0)
    ).toEqual([true, true, false, false]);
    expect(
      first.periodicReactionLog
        .filter(
          (entry) =>
            entry.operation === "wane" ||
            entry.operation === "wane-skipped"
        )
        .map((entry) => [
          entry.targetId,
          entry.operation,
          entry.frame
        ])
    ).toEqual([
      [SOURCE_ID, "wane", 16],
      ["enemy-second", "wane-skipped", 16]
    ]);
  });

  it(
    "keeps a 32-target fanout bounded and reproducible",
    () => {
      const targets: EnemyTargetProfile[] =
        Array.from({ length: 32 }, (_, index) => ({
          id: index === 0 ? SOURCE_ID : `enemy-${index}`,
          name: `Enemy ${index}`,
          position: { x: index, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro" as const, gaugeUnits: 1 }
          ]
        }));
      const config = makePropagationConfig({
        targets,
        radius: 100,
        durationFrames: 20
      });

      const first = simulate(config, {
        critMode: "noCrit"
      });
      const second = simulate(config, {
        critMode: "noCrit"
      });
      const batch = first.reactionDamageLog.find(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.withinSimulation
      )!;

      expect(second).toEqual(first);
      expect(
        batch.electroChargedPropagation?.candidates
      ).toHaveLength(32);
      expect(batch.damageEventIds).toHaveLength(32);
      expect(
        first.damageEvents.filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
      ).toHaveLength(32);
    },
    10_000
  );
});
