import { createHash } from "node:crypto";
import {
  bloomReactionAuditSchema,
  burningReactionAuditSchema,
  burningStateLogEntrySchema,
  canonicalStringify,
  dendroCoreResultReferencesSchema,
  parseSimulationRunManifestForConfig,
  quickenReactionAuditSchema,
  quickenStateLogEntrySchema,
  reactionDamageGroupAuditSchema,
  playerDamageResultReferencesSchema,
  simConfigSchema,
  simulationRunManifestSchema,
  targetStateTimelineSchema,
  type Element,
  type FrameBuffDefinition,
  type FrameHitDefinition,
  type InitialAuraApplication,
  type ReactionType,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import historicalMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.31.golden.json";
import matrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.32.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const FIXED_GCSIM_COMMIT =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const DATA_VERSION =
  "reaction-matrix-fixed-gcsim-cross-check-2";
const OPTIONS = {
  energyMode: "configured" as const,
  critMode: "noCrit" as const,
  compatibilityMode: "legal-frame-v1" as const
};

interface MatrixTarget {
  id: string;
  name: string;
  position: { x: number; y: number };
  initialAura: InitialAuraApplication[];
}

interface MatrixScenario {
  durationFrames: number;
  initialAura?: InitialAuraApplication[];
  targets?: MatrixTarget[];
  hits: FrameHitDefinition[];
  buffs?: FrameBuffDefinition[];
}

function applicationHit({
  id,
  frame = 0,
  element,
  gaugeUnits,
  scaling = 1
}: {
  id: string;
  frame?: number;
  element: Element;
  gaugeUnits: number;
  scaling?: number;
}): FrameHitDefinition {
  const needsExplicitGeometry =
    element === "pyro" || element === "electro";
  return {
    id,
    label: id,
    frame,
    scaling,
    element,
    ...(needsExplicitGeometry
      ? {
          geometry: {
            kind: "circle" as const,
            coordinateSpace: "world" as const,
            origin: { x: 0, y: 0 },
            radius: 1
          }
        }
      : {}),
    application: {
      gaugeUnits,
      icdTag: `matrix-${id}`,
      icdGroup: "no-icd"
    }
  };
}

const SCENARIOS = {
  melt: {
    durationFrames: 10,
    initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "melt-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ]
  },
  vaporize: {
    durationFrames: 10,
    initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "vaporize-hydro",
        element: "hydro",
        gaugeUnits: 1
      })
    ]
  },
  overload: {
    durationFrames: 10,
    initialAura: [{ element: "electro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "overload-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ]
  },
  superconduct: {
    durationFrames: 10,
    initialAura: [{ element: "electro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "superconduct-cryo",
        element: "cryo",
        gaugeUnits: 1
      })
    ]
  },
  electroCharged: {
    durationFrames: 30,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "electro-charged-electro",
        element: "electro",
        gaugeUnits: 1
      })
    ]
  },
  freezeShatter: {
    durationFrames: 40,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "freeze-cryo",
        element: "cryo",
        gaugeUnits: 1
      }),
      {
        id: "shatter-blunt",
        label: "shatter-blunt",
        frame: 12,
        scaling: 1,
        element: "physical",
        strikeType: "blunt",
        poiseDamage: 0
      }
    ]
  },
  swirl: {
    durationFrames: 10,
    targets: [
      {
        id: "enemy-0",
        name: "Swirl source target",
        position: { x: 0, y: 0 },
        initialAura: [{ element: "pyro", gaugeUnits: 1 }]
      },
      {
        id: "enemy-1",
        name: "Swirl propagation target",
        position: { x: 1, y: 0 },
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      }
    ],
    hits: [
      {
        ...applicationHit({
          id: "swirl-anemo",
          element: "anemo",
          gaugeUnits: 1
        }),
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        }
      }
    ],
    buffs: [
      {
        key: "swirl-live-reaction-bonus",
        label: "F+5 live reaction bonus",
        target: "self",
        stat: "reactionBonus",
        value: 0.3,
        startFrame: 3,
        durationFrames: 5
      }
    ]
  },
  crystallize: {
    durationFrames: 40,
    initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "crystallize-geo",
        element: "geo",
        gaugeUnits: 1
      })
    ]
  },
  catalyze: {
    durationFrames: 50,
    initialAura: [{ element: "dendro", gaugeUnits: 2 }],
    hits: [
      applicationHit({
        id: "quicken-electro",
        element: "electro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "aggravate-electro",
        frame: 12,
        element: "electro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "spread-dendro",
        frame: 24,
        element: "dendro",
        gaugeUnits: 1
      })
    ]
  },
  burning: {
    durationFrames: 50,
    initialAura: [{ element: "dendro", gaugeUnits: 2 }],
    hits: [
      applicationHit({
        id: "burning-pyro",
        element: "pyro",
        gaugeUnits: 1
      })
    ]
  },
  bloom: {
    durationFrames: 360,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "bloom-hydro",
        element: "hydro",
        gaugeUnits: 1
      })
    ]
  },
  burgeon: {
    durationFrames: 120,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "burgeon-bloom-hydro",
        element: "hydro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "burgeon-pyro-contact",
        frame: 31,
        element: "pyro",
        gaugeUnits: 1
      })
    ]
  },
  hyperbloom: {
    durationFrames: 140,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "hyperbloom-bloom-hydro",
        element: "hydro",
        gaugeUnits: 1
      }),
      applicationHit({
        id: "hyperbloom-electro-contact",
        frame: 31,
        element: "electro",
        gaugeUnits: 1
      })
    ]
  },
  cryoMultiReaction: {
    durationFrames: 10,
    initialAura: [
      { element: "electro", gaugeUnits: 1 },
      { element: "pyro", gaugeUnits: 1 },
      { element: "hydro", gaugeUnits: 1 }
    ],
    hits: [
      applicationHit({
        id: "cryo-multi-reaction",
        element: "cryo",
        gaugeUnits: 2
      })
    ]
  }
} as const satisfies Record<string, MatrixScenario>;

type ScenarioId = keyof typeof SCENARIOS;

function makeMatrixConfig(
  scenarioId: ScenarioId,
  scenario: MatrixScenario
): SimConfig {
  const base = makeConfig();
  const durationFrames = Math.max(60, scenario.durationFrames);
  const duration = durationFrames / 60;
  const lastHitFrame = Math.max(
    ...scenario.hits.map((hit) => hit.frame)
  );
  const actionEndFrame = Math.max(
    lastHitFrame + 1,
    ...(scenario.buffs ?? []).map(
      (buff) => (buff.startFrame ?? 0) + buff.durationFrames
    )
  );
  const targets =
    scenario.targets ??
    [
      {
        id: "enemy-0",
        name: `Matrix target · ${scenarioId}`,
        position: { x: 0, y: 0 },
        initialAura: scenario.initialAura ?? []
      }
    ];
  return {
    ...base,
    meta: {
      name: `Reaction matrix 1.32 · ${scenarioId}`,
      version: "1.32.0",
      verificationStatus: "provisional",
      note: `Fixed gcsim ${FIXED_GCSIM_COMMIT} code cross-check; not official game truth.`
    },
    dataVersion: DATA_VERSION,
    randomSeed: `reaction-matrix-1.32:${scenarioId}`,
    duration,
    cycleLength: Math.max(1, duration),
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: targets.map((target) => ({
        ...target,
        position: { ...target.position },
        initialAura: target.initialAura.map((entry) => ({
          ...entry
        }))
      }))
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "matrix",
        name: "Reaction Matrix Driver",
        element: "anemo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    playerDamageModel: {
      mode: "reaction-self-v1",
      position: { x: 0, y: 0 },
      hitboxRadius: 0.5,
      shieldMode: "crystallize-v1",
      zeroHpPolicy: "clamp-and-continue",
      characters: [
        {
          actorId: "matrix",
          initialHpRatio: 1,
          resistances: {
            pyro: 0.1,
            cryo: 0.1,
            hydro: 0.1,
            electro: 0.1,
            anemo: 0.1,
            geo: 0.1,
            dendro: 0.1,
            physical: 0.1
          }
        }
      ]
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "matrix",
      swapFrames: 1,
      abilities: [
        {
          id: `matrix-${scenarioId}`,
          actorId: "matrix",
          name: `Matrix ${scenarioId}`,
          kind: "skill",
          cancelFrame: actionEndFrame,
          animationEndFrame: actionEndFrame,
          cooldownFrames: 0,
          hits: scenario.hits.map((hit) => ({ ...hit })),
          ...(scenario.buffs === undefined
            ? {}
            : {
                buffs: scenario.buffs.map((buff) => ({
                  ...buff
                }))
              })
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "matrix",
          abilityId: `matrix-${scenarioId}`,
          atFrame: 0
        }
      ]
    }
  };
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function compactHitConfig(hit: FrameHitDefinition) {
  return {
    id: hit.id,
    frame: hit.frame,
    element: hit.element,
    scaling: hit.scaling,
    gaugeUnits: hit.application?.gaugeUnits ?? null,
    strikeType: hit.strikeType ?? "default",
    poiseDamage: hit.poiseDamage ?? 0,
    geometry: hit.geometry?.kind ?? null
  };
}

function compactEvent(event: SimulationResult["damageEvents"][number]) {
  return {
    id: event.id,
    frame: event.frame,
    kind: event.kind,
    element: event.element,
    reaction: event.reaction,
    orderedReactions: event.reactionAudit.reactions,
    targetId: event.targetId,
    parentDamageEventId: event.parentDamageEventId,
    finalDamage: event.finalDamage,
    displayDamage: event.displayDamage,
    composition: event.damageComposition,
    burningSelfDamageStatus:
      event.reactionAudit.burningReaction?.selfDamageStatus ??
      null,
    bloomSelfDamageStatuses:
      event.reactionAudit.bloomReactions.map(
        (reaction) => reaction.selfDamageStatus
      )
  };
}

function compactResult(result: SimulationResult) {
  const timeline = result.config.timeline;
  if (timeline?.mode !== "legal-frame-v1") {
    throw new Error("Reaction matrix requires a legal timeline.");
  }
  return {
    config: {
      durationFrames: Math.round(result.config.duration * 60),
      playerDamageModel: result.config.playerDamageModel,
      targets: (result.config.enemy.targets ?? []).map((target) => ({
        id: target.id,
        position: target.position,
        initialAura: target.initialAura ?? []
      })),
      hits:
        timeline.abilities[0]?.hits?.map(compactHitConfig) ?? [],
      buffs:
        timeline.abilities[0]?.buffs?.map((buff) => ({
          key: buff.key,
          stat: buff.stat,
          value: buff.value,
          startFrame: buff.startFrame ?? 0,
          durationFrames: buff.durationFrames
        })) ?? []
    },
    runManifest: result.runManifest,
    totalDamage: result.totalDamage,
    dps: result.dps,
    reactedHits: result.reactedHits,
    mechanicsStatus: result.mechanicsStatus,
    events: result.damageEvents.map(compactEvent),
    logs: {
      reactionDamage: result.reactionDamageLog.map((entry) => ({
        id: entry.id,
        reaction: entry.reaction,
        triggerFrame: entry.triggerFrame,
        damageFrame: entry.damageFrame,
        scheduleKind: entry.scheduleKind,
        selectionRadius: entry.selectionRadius,
        selectedTargetId: entry.selectedTargetId,
        resolutionReason: entry.resolutionReason,
        hitTargetIds: entry.hitTargetIds,
        damageEventIds: entry.damageEventIds,
        damageGroupAllowed: entry.damageGroupDecisions
          .filter(
            (decision) => decision.targetId !== "player-avatar"
          )
          .map((decision) => decision.damageAllowed),
        playerHitResolutionLogIds:
          entry.playerHitResolutionLogIds,
        playerDamageEventIds: entry.playerDamageEventIds,
        playerDamageGroupDecisions:
          entry.damageGroupDecisions
            .filter(
              (decision) => decision.targetId === "player-avatar"
            )
            .map((decision) => ({
              targetId: decision.targetId,
              sourceActorId: decision.sourceActorId,
              reaction: decision.reaction,
              hitIndex: decision.hitIndex,
              damageAllowed: decision.damageAllowed,
              blockedReason: decision.blockedReason
            }))
      })),
      periodic: result.periodicReactionLog.map((entry) => ({
        id: entry.id,
        operation: entry.operation,
        frame: entry.frame,
        reaction: entry.reaction
      })),
      frozen: result.frozenStateLog.map((entry) => ({
        id: entry.id,
        operation: entry.operation,
        frame: entry.frame
      })),
      quicken: result.quickenStateLog.map((entry) => ({
        id: entry.id,
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation
      })),
      burning: result.burningStateLog.map((entry) => ({
        id: entry.id,
        operation: entry.operation,
        frame: entry.frame,
        tickIndex: entry.tickIndex,
        selfDamageStatus: entry.selfDamageStatus,
        playerHitResolutionLogId:
          entry.playerHitResolutionLogId,
        playerDamageEventId: entry.playerDamageEventId
      })),
      dendroCores: result.dendroCoreLog.map((entry) => ({
        id: entry.id,
        coreId: entry.coreId,
        operation: entry.operation,
        frame: entry.frame,
        reaction:
          entry.operation === "spawn-scheduled" ||
          entry.operation === "spawn"
            ? null
            : entry.reaction,
        selfDamageStatus: entry.selfDamageStatus,
        playerHitResolutionLogId:
          "playerHitResolutionLogId" in entry
            ? entry.playerHitResolutionLogId
            : null,
        playerDamageEventId:
          "playerDamageEventId" in entry
            ? entry.playerDamageEventId
            : null
      })),
      coreContacts: result.dendroCoreContactLog.map((entry) => ({
        id: entry.id,
        frame: entry.frame,
        eventType: entry.eventType,
        reaction: entry.reaction,
        contactedCoreIds: entry.contactedCoreIds
      })),
      crystallizeShards: result.crystallizeShardLog.map(
        (entry) => ({
          id: entry.id,
          operation: entry.operation,
          frame: entry.frame,
          element: entry.element
        })
      )
    },
    player: {
      status: result.playerSelfDamageStatus,
      totalDamageTaken: result.totalPlayerDamageTaken,
      totalReactionSelfDamageTaken:
        result.totalReactionSelfDamageTaken,
      hitResolutions: result.playerHitResolutionLog.map(
        (entry) => ({
          id: entry.id,
          frame: entry.frame,
          reaction: entry.reaction,
          sourceActorId: entry.sourceActorId,
          sourceTargetId: entry.sourceTargetId,
          targetActorId: entry.targetActorId,
          reactionDamageLogId: entry.reactionDamageLogId,
          burningStateLogId: entry.burningStateLogId,
          dendroCoreRemovalLogId:
            entry.dendroCoreRemovalLogId,
          damageCenter: entry.damageCenter,
          damageRadius: entry.damageRadius,
          playerCenter: entry.playerCenter,
          playerRadius: entry.playerRadius,
          distance: entry.distance,
          combinedRadius: entry.combinedRadius,
          outcome: entry.outcome,
          blockedReason: entry.blockedReason,
          playerDamageEventId: entry.playerDamageEventId
        })
      ),
      damageEvents: result.playerDamageEvents.map((entry) => ({
        id: entry.id,
        frame: entry.frame,
        reaction: entry.reaction,
        element: entry.element,
        sourceActorId: entry.sourceActorId,
        sourceTargetId: entry.sourceTargetId,
        targetActorId: entry.targetActorId,
        reactionDamageLogId: entry.reactionDamageLogId,
        playerHitResolutionLogId:
          entry.playerHitResolutionLogId,
        burningStateLogId: entry.burningStateLogId,
        dendroCoreRemovalLogId:
          entry.dendroCoreRemovalLogId,
        damageFactors: entry.damageFactors,
        shieldResolution: entry.shieldResolution,
        hpResolution: entry.hpResolution,
        finalDamage: entry.finalDamage,
        displayDamage: entry.displayDamage
      })),
      hpTimeline: result.playerHpTimeline,
      hpSummaries: result.playerHpSummaries
    },
    hashes: {
      config: sha256(result.config),
      runManifest: sha256(result.runManifest),
      damageEvents: sha256(result.damageEvents),
      hitResolutionLog: sha256(result.hitResolutionLog),
      reactionDamageLog: sha256(result.reactionDamageLog),
      stateLogs: sha256({
        periodicReactionLog: result.periodicReactionLog,
        frozenStateLog: result.frozenStateLog,
        quickenStateLog: result.quickenStateLog,
        burningStateLog: result.burningStateLog,
        dendroCoreLog: result.dendroCoreLog,
        dendroCoreContactLog: result.dendroCoreContactLog,
        dendroCoreTimeline: result.dendroCoreTimeline,
        crystallizeShardLog: result.crystallizeShardLog,
        crystallizeShieldLog: result.crystallizeShieldLog,
        crystallizeShieldTimeline:
          result.crystallizeShieldTimeline,
        reactionStatusLog: result.reactionStatusLog
      }),
      targetStateTimeline: sha256(result.targetStateTimeline),
      auraBoundaries: sha256({
        initial: result.auraInitialStates,
        end: result.auraEndStates
      }),
      damageCurve: sha256(result.damageCurve),
      player: sha256({
        playerHitResolutionLog: result.playerHitResolutionLog,
        playerDamageEvents: result.playerDamageEvents,
        playerHpTimeline: result.playerHpTimeline,
        playerHpSummaries: result.playerHpSummaries,
        playerSelfDamageStatus: result.playerSelfDamageStatus,
        totalPlayerDamageTaken: result.totalPlayerDamageTaken,
        totalReactionSelfDamageTaken:
          result.totalReactionSelfDamageTaken
      })
    }
  };
}

function expectContiguousIds(
  entries: readonly { id: number }[]
): void {
  expect(entries.map((entry) => entry.id)).toEqual(
    Array.from({ length: entries.length }, (_, index) => index)
  );
}

function expectKnownNullableId(
  ids: ReadonlySet<number>,
  id: number | null
): void {
  if (id !== null) {
    expect(ids.has(id)).toBe(true);
  }
}

function validateCrossLinks(result: SimulationResult): void {
  const damageEventIds = new Set(
    result.damageEvents.map((event) => event.id)
  );
  const hitResolutionIds = new Set(
    result.hitResolutionLog.map((entry) => entry.id)
  );
  const reactionDamageLogIds = new Set(
    result.reactionDamageLog.map((entry) => entry.id)
  );
  const reactionStatusLogIds = new Set(
    result.reactionStatusLog.map((entry) => entry.id)
  );
  const periodicReactionLogIds = new Set(
    result.periodicReactionLog.map((entry) => entry.id)
  );
  const frozenStateLogIds = new Set(
    result.frozenStateLog.map((entry) => entry.id)
  );
  const quickenStateLogIds = new Set(
    result.quickenStateLog.map((entry) => entry.id)
  );
  const burningStateLogIds = new Set(
    result.burningStateLog.map((entry) => entry.id)
  );
  const dendroCoreLogIds = new Set(
    result.dendroCoreLog.map((entry) => entry.id)
  );
  const dendroCoreIds = new Set(
    result.dendroCoreLog.map((entry) => entry.coreId)
  );
  const crystallizeShardIds = new Set(
    result.crystallizeShardLog.flatMap((entry) =>
      entry.shardId === null ? [] : [entry.shardId]
    )
  );
  const crystallizeShieldLogIds = new Set(
    result.crystallizeShieldLog.map((entry) => entry.id)
  );
  const hitResolutionById = new Map(
    result.hitResolutionLog.map((entry) => [entry.id, entry])
  );
  for (const event of result.damageEvents) {
    if (event.parentDamageEventId !== null) {
      expect(damageEventIds.has(event.parentDamageEventId)).toBe(
        true
      );
    }
    const resolution = hitResolutionById.get(
      event.targetResolutionId
    );
    expect(resolution).toMatchObject({
      id: event.targetResolutionId,
      frame: event.frame,
      hitId: event.hitId,
      targetId: event.targetId,
      landed: true
    });
  }
  for (const log of result.reactionDamageLog) {
    expectKnownNullableId(
      damageEventIds,
      log.triggerDamageEventId
    );
    expectKnownNullableId(dendroCoreLogIds, log.sourceCoreLogId);
    if (log.sourceCoreId !== null) {
      expect(dendroCoreIds.has(log.sourceCoreId)).toBe(true);
    }
    for (const damageEventId of log.damageEventIds) {
      expect(damageEventIds.has(damageEventId)).toBe(true);
      expect(
        result.damageEvents.find(
          (event) => event.id === damageEventId
        )
      ).toMatchObject({
        frame: log.damageFrame,
        reaction: log.reaction
      });
    }
    for (const reactionStatusLogId of log.reactionStatusLogIds) {
      expect(reactionStatusLogIds.has(reactionStatusLogId)).toBe(
        true
      );
    }
  }
  for (const entry of result.reactionStatusLog) {
    expect(
      damageEventIds.has(entry.reactionDamageEventId)
    ).toBe(true);
  }
  for (const entry of result.periodicReactionLog) {
    expectKnownNullableId(
      damageEventIds,
      entry.triggerDamageEventId
    );
    expectKnownNullableId(
      reactionDamageLogIds,
      entry.reactionDamageLogId
    );
    expectKnownNullableId(damageEventIds, entry.damageEventId);
  }
  for (const entry of result.frozenStateLog) {
    expectKnownNullableId(
      damageEventIds,
      entry.triggerDamageEventId
    );
  }
  for (const entry of result.quickenStateLog) {
    expectKnownNullableId(
      damageEventIds,
      entry.triggerDamageEventId
    );
  }
  for (const entry of result.burningStateLog) {
    expectKnownNullableId(
      damageEventIds,
      entry.triggerDamageEventId
    );
    expectKnownNullableId(
      reactionDamageLogIds,
      entry.reactionDamageLogId
    );
    for (const damageEventId of entry.damageEventIds) {
      expect(damageEventIds.has(damageEventId)).toBe(true);
    }
  }
  for (const entry of result.dendroCoreLog) {
    expect(damageEventIds.has(entry.originDamageEventId)).toBe(
      true
    );
  }
  for (const entry of result.dendroCoreContactLog) {
    expectKnownNullableId(
      reactionDamageLogIds,
      entry.triggerReactionDamageLogId
    );
    for (const id of entry.hitResolutionLogIds) {
      expect(hitResolutionIds.has(id)).toBe(true);
    }
    for (const id of entry.triggerDamageEventIds) {
      expect(damageEventIds.has(id)).toBe(true);
    }
    for (const id of entry.checkedCoreIds) {
      expect(dendroCoreIds.has(id)).toBe(true);
    }
    for (const id of entry.contactedCoreIds) {
      expect(dendroCoreIds.has(id)).toBe(true);
    }
    for (const id of entry.removalLogIds) {
      expect(dendroCoreLogIds.has(id)).toBe(true);
    }
    for (const id of entry.reactionDamageLogIds) {
      expect(reactionDamageLogIds.has(id)).toBe(true);
    }
  }
  for (const point of result.dendroCoreTimeline.points) {
    expect(dendroCoreLogIds.has(point.dendroCoreLogId)).toBe(
      true
    );
    expect(dendroCoreIds.has(point.coreId)).toBe(true);
  }
  for (const entry of result.crystallizeShardLog) {
    expectKnownNullableId(
      damageEventIds,
      entry.triggerDamageEventId
    );
    expectKnownNullableId(
      crystallizeShieldLogIds,
      entry.shieldLogId
    );
  }
  for (const entry of result.crystallizeShieldLog) {
    expect(crystallizeShardIds.has(entry.shardId)).toBe(true);
  }
  for (const point of result.crystallizeShieldTimeline) {
    if (point.shieldId !== null) {
      expect(
        result.crystallizeShieldLog.some(
          (entry) => entry.shieldId === point.shieldId
        )
      ).toBe(true);
    }
  }
  for (const point of result.damageCurve) {
    expect(damageEventIds.has(point.damageEventId)).toBe(true);
  }
  for (const point of result.auraTimeline) {
    expect(damageEventIds.has(point.damageEventId)).toBe(true);
  }

  const linkTargets = {
    "damage-event": damageEventIds,
    "reaction-damage-log": reactionDamageLogIds,
    "periodic-reaction-log": periodicReactionLogIds,
    "frozen-state-log": frozenStateLogIds,
    "quicken-state-log": quickenStateLogIds,
    "burning-state-log": burningStateLogIds,
    "target-mechanics-truncation-log": new Set(
      result.targetMechanicsTruncationLog.map(
        (entry) => entry.id
      )
    )
  } satisfies Record<
    SimulationResult["targetStateTimeline"]["points"][number]["links"][number]["kind"],
    Set<number>
  >;
  for (const point of result.targetStateTimeline.points) {
    for (const link of point.links) {
      expect(linkTargets[link.kind].has(link.id)).toBe(true);
    }
  }
}

function validateResultSchemas(result: SimulationResult): void {
  expect(simConfigSchema.parse(result.config)).toEqual(result.config);
  expect(
    simulationRunManifestSchema.parse(result.runManifest)
  ).toEqual(result.runManifest);
  expect(
    parseSimulationRunManifestForConfig(
      result.runManifest,
      result.config
    )
  ).toEqual(result.runManifest);
  expect(result.resolvedRuntimeOptions).toEqual(
    result.runManifest.resolvedRuntimeOptions
  );
  expect(result.pluginManifest).toEqual(result.runManifest.plugins);
  expect(result.reproducibilityKey).toBe(
    result.runManifest.reproducibilityKey
  );
  expect(
    targetStateTimelineSchema.parse(result.targetStateTimeline)
  ).toEqual(result.targetStateTimeline);

  const summedDamage = result.damageEvents.reduce(
    (total, event) => total + event.finalDamage,
    0
  );
  expect(result.hitEvents).toEqual(result.damageEvents);
  expect(result.totalDamage).toBe(summedDamage);
  expect(result.dps).toBe(
    result.totalDamage / result.config.duration
  );
  expect(result.damageCurve).toHaveLength(
    result.damageEvents.length
  );
  const finalCurvePoint = result.damageCurve.at(-1);
  expect(finalCurvePoint?.cumulativeDamage).toBe(
    result.totalDamage
  );
  expect(
    result.auraInitialStates.map((state) => state.targetId)
  ).toEqual(result.enemyTargets.map((target) => target.id));
  expect(
    result.auraEndStates.map((state) => state.targetId)
  ).toEqual(result.enemyTargets.map((target) => target.id));
  expect(
    result.auraInitialStates.every((state) => state.frame === 0)
  ).toBe(true);
  expect(
    result.auraEndStates.every(
      (state) =>
        state.frame === Math.round(result.config.duration * 60)
    )
  ).toBe(true);
  expect(result.targetMechanicsTruncationLog).toEqual([]);

  for (const event of result.damageEvents) {
    const composition = event.damageComposition;
    expect(
      composition.direct +
        composition.additiveReaction +
        composition.transformativeReaction
    ).toBeCloseTo(event.finalDamage, 10);
    expect(event.displayDamage).toBe(Math.round(event.finalDamage));
    expect(event.mechanicsStatus).toBe("authoritative");
    expect(event.reactionAudit.unsupportedReactions).toEqual([]);
    expect(event.reactionAudit.mechanicsTruncation).toBeNull();
    const burningAudit = event.reactionAudit.burningReaction;
    if (burningAudit !== null) {
      expect(
        burningReactionAuditSchema.parse(burningAudit)
      ).toEqual(burningAudit);
    }
    const quickenAudit =
      event.reactionAudit.catalyzeReaction?.quicken;
    if (quickenAudit !== null && quickenAudit !== undefined) {
      expect(
        quickenReactionAuditSchema.parse(quickenAudit)
      ).toEqual(quickenAudit);
    }
    for (const bloomAudit of event.reactionAudit.bloomReactions) {
      expect(bloomReactionAuditSchema.parse(bloomAudit)).toEqual(
        bloomAudit
      );
    }
  }
  for (const entry of result.quickenStateLog) {
    expect(quickenStateLogEntrySchema.parse(entry)).toEqual(entry);
  }
  for (const entry of result.burningStateLog) {
    expect(burningStateLogEntrySchema.parse(entry)).toEqual(entry);
  }
  for (const entry of result.reactionDamageLog) {
    for (const decision of entry.damageGroupDecisions) {
      expect(
        reactionDamageGroupAuditSchema.parse(decision)
      ).toEqual(decision);
    }
  }

  expectContiguousIds(result.damageEvents);
  expectContiguousIds(result.hitResolutionLog);
  expectContiguousIds(result.targetMechanicsTruncationLog);
  expectContiguousIds(result.reactionDamageLog);
  expectContiguousIds(result.reactionStatusLog);
  expectContiguousIds(result.periodicReactionLog);
  expectContiguousIds(result.frozenStateLog);
  expectContiguousIds(result.quickenStateLog);
  expectContiguousIds(result.burningStateLog);
  expectContiguousIds(result.dendroCoreLog);
  expectContiguousIds(result.dendroCoreContactLog);
  expectContiguousIds(result.dendroCoreTimeline.points);
  expectContiguousIds(result.crystallizeShardLog);
  expectContiguousIds(result.crystallizeShieldLog);
  expectContiguousIds(result.crystallizeShieldTimeline);
  expectContiguousIds(result.playerHitResolutionLog);
  expectContiguousIds(result.playerDamageEvents);
  expectContiguousIds(result.playerHpTimeline.points);
  expectContiguousIds(result.particleEvents);
  expectContiguousIds(result.particleTriggerLog);
  expectContiguousIds(result.targetStateTimeline.points);
  validateCrossLinks(result);
}

const REQUIRED_REACTIONS = [
  "melt",
  "vaporize",
  "reverseVaporize",
  "overload",
  "superconduct",
  "electroCharged",
  "freeze",
  "shatter",
  "swirlPyro",
  "crystallizePyro",
  "quicken",
  "aggravate",
  "spread",
  "burning",
  "bloom",
  "burgeon",
  "hyperbloom"
] as const satisfies readonly ReactionType[];

describe("1.32 provisional reaction-matrix Golden", () => {
  it("retains the frozen 1.31 fixture as an enemy-side semantic baseline", () => {
    expect(historicalMatrixGolden.config).toMatchObject({
      schemaVersion: "1.31.0",
      engineVersion: "1.31.0-dendro-cores",
      dataVersion: "reaction-matrix-fixed-gcsim-cross-check-1"
    });
    expect(Object.keys(historicalMatrixGolden.vectors)).toHaveLength(
      14
    );
  });

  it("freezes every baseline reaction vector, strict projection, and run identity", () => {
    const actualVectors: Record<string, unknown> = {};
    const observedReactions = new Set<ReactionType>();

    for (const [scenarioId, scenario] of Object.entries(
      SCENARIOS
    ) as [ScenarioId, MatrixScenario][]) {
      const config = makeMatrixConfig(scenarioId, scenario);
      const options = {
        ...OPTIONS,
        randomSeed: config.randomSeed
      };
      const result = simulate(config, options);
      const repeated = simulate(
        makeMatrixConfig(scenarioId, scenario),
        options
      );

      expect(result.timelineExecution?.failures).toEqual([]);
      expect(result.mechanicsStatus).toBe("complete");
      validateResultSchemas(result);
      expect(
        playerDamageResultReferencesSchema.parse(result)
      ).toEqual(result);
      if (
        result.dendroCoreLog.length > 0 ||
        result.dendroCoreContactLog.length > 0
      ) {
        expect(
          dendroCoreResultReferencesSchema.parse(result)
        ).toEqual(result);
      }
      expect(repeated).toEqual(result);
      expect(result.playerHpTimeline.points).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "initial",
            actorId: "matrix",
            frame: 0,
            hpAfter: 10_000
          }),
          expect.objectContaining({
            operation: "simulation-end",
            actorId: "matrix",
            frame: Math.round(result.config.duration * 60)
          })
        ])
      );
      if (scenarioId === "swirl") {
        const propagation = result.damageEvents.find(
          (event) =>
            event.frame === 5 &&
            event.targetId === "enemy-1" &&
            event.reaction === "swirlPyro"
        );
        expect(propagation).toMatchObject({
          reactionAudit: {
            reaction: "reverseVaporize"
          },
          statsBeforeDamage: {
            em: 100,
            reactionBonus: 0.2
          },
          transformativeReactionFactors: {
            elementalMastery: 100,
            reactionBonus: 0.2
          }
        });
        expect(
          propagation?.damageFactors
            .amplifyingReactionMultiplier
        ).toBeCloseTo(2.528, 10);
      }

      for (const event of result.damageEvents) {
        if (event.reaction !== "none") {
          observedReactions.add(event.reaction);
        }
        for (const reaction of event.reactionAudit.reactions) {
          if (reaction !== "none") {
            observedReactions.add(reaction);
          }
        }
      }
      const compact = compactResult(result);
      const historicalVector = (
        historicalMatrixGolden.vectors as Record<
          string,
          Record<string, unknown>
        >
      )[scenarioId]!;
      const {
        runManifest: _historicalRunManifest,
        hashes: _historicalHashes,
        ...historicalEnemySemantics
      } = historicalVector;
      expect(compact).toMatchObject(historicalEnemySemantics);
      actualVectors[scenarioId] = compact;
    }

    expect([...REQUIRED_REACTIONS].filter(
      (reaction) => !observedReactions.has(reaction)
    )).toEqual([]);
    for (const reaction of [
      "burning",
      "bloom",
      "burgeon",
      "hyperbloom"
    ] as const) {
      const vector = actualVectors[reaction] as ReturnType<
        typeof compactResult
      >;
      expect(
        vector.player.hitResolutions.some(
          (entry) =>
            entry.reaction === reaction &&
            entry.outcome === "landed"
        )
      ).toBe(true);
      expect(
        vector.player.damageEvents.some(
          (entry) => entry.reaction === reaction
        )
      ).toBe(true);
      expect(vector.player.totalDamageTaken).toBeGreaterThan(0);
    }
    const burningVector = actualVectors.burning as ReturnType<
      typeof compactResult
    >;
    expect(
      burningVector.events
        .map((event) => event.burningSelfDamageStatus)
        .filter((status) => status !== null)
    ).toEqual([
      "modeled-player-reaction-damage",
      "modeled-player-reaction-damage"
    ]);
    const bloomVector = actualVectors.bloom as ReturnType<
      typeof compactResult
    >;
    expect(
      bloomVector.events.flatMap(
        (event) => event.bloomSelfDamageStatuses
      )
    ).toEqual(["modeled-player-reaction-damage"]);
    const hyperbloomVector =
      actualVectors.hyperbloom as ReturnType<
        typeof compactResult
      >;
    expect(
      hyperbloomVector.logs.reactionDamage[0]
    ).toMatchObject({
      selectionRadius: 15,
      selectedTargetId: "enemy-0",
      resolutionReason: null
    });

    if (
      process.env.PRINT_REACTION_MATRIX_GOLDEN === "1"
    ) {
      console.log(JSON.stringify(actualVectors, null, 2));
      return;
    }
    expect(actualVectors).toEqual(
      matrixGolden.vectors as Record<string, unknown>
    );
  });
});
