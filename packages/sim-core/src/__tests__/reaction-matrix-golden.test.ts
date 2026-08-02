import { createHash } from "node:crypto";
import {
  bloomReactionAuditSchema,
  burningReactionAuditSchema,
  burningStateLogEntrySchema,
  canonicalStringify,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  dendroCoreResultReferencesSchema,
  electroChargedCleanupResultReferencesSchema,
  parseSimulationRunManifestForConfig,
  quickenReactionAuditSchema,
  quickenStateLogEntrySchema,
  reactionDamageGroupAuditSchema,
  reactionDeliveryResultReferencesSchema,
  playerDamageResultReferencesSchema,
  simConfigSchema,
  simulationResultSchema,
  simulationRunManifestSchema,
  targetPhaseV2ResultReferencesSchema,
  targetStateTimelineSchema,
  type Element,
  type EnemyElementalResistances,
  type FrameBuffDefinition,
  type FrameHitDefinition,
  type InitialAuraApplication,
  type ReactionType,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import historicalMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.31.golden.json";
import playerDamageMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.32.golden.json";
import targetClockMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.33.golden.json";
import matrixV134Golden from "../../../test-vectors/fixtures/reaction-matrix-1.34.golden.json";
import matrixV135Golden from "../../../test-vectors/fixtures/reaction-matrix-1.35.golden.json";
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
  reactionMode?: "aura-v5" | "aura-v6" | "aura-v7";
  enemyResistances?: EnemyElementalResistances;
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
      icd: { mode: "no-icd-v1" }
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
  },
  electroOrdered: {
    durationFrames: 10,
    initialAura: [
      { element: "pyro", gaugeUnits: 1 },
      { element: "cryo", gaugeUnits: 1 }
    ],
    hits: [
      applicationHit({
        id: "electro-ordered-multi-reaction",
        element: "electro",
        gaugeUnits: 2
      })
    ],
    reactionMode: "aura-v6"
  },
  elementalResistance: {
    durationFrames: 10,
    initialAura: [
      { element: "pyro", gaugeUnits: 1 },
      { element: "cryo", gaugeUnits: 1 }
    ],
    hits: [
      applicationHit({
        id: "elemental-resistance-ordered-reaction",
        element: "electro",
        gaugeUnits: 2
      })
    ],
    reactionMode: "aura-v6",
    enemyResistances: {
      pyro: 0.3,
      cryo: 0.4,
      hydro: 0.1,
      electro: 0.2,
      anemo: 0.1,
      geo: 0.1,
      dendro: 0.1,
      physical: 0.1
    }
  },
  hydroFrozenEcGuard: {
    durationFrames: 31,
    initialAura: [
      { element: "pyro", gaugeUnits: 1 },
      { element: "cryo", gaugeUnits: 1 },
      { element: "dendro", gaugeUnits: 1 },
      { element: "electro", gaugeUnits: 1 }
    ],
    hits: [
      applicationHit({
        id: "hydro-frozen-ec-guard",
        element: "hydro",
        gaugeUnits: 3
      })
    ],
    reactionMode: "aura-v6"
  }
} as const satisfies Record<string, MatrixScenario>;

type ScenarioId = keyof typeof SCENARIOS;

function makeMatrixConfig(
  scenarioId: string,
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
      name: `Reaction matrix 1.35 · ${scenarioId}`,
      version: "1.35.0",
      verificationStatus: "provisional",
      note: `Fixed gcsim ${FIXED_GCSIM_COMMIT} code cross-check; not official game truth.`
    },
    dataVersion: DATA_VERSION,
    // Keep the frozen 1.32 random stream so 1.33 only changes the
    // versioned clock envelope, not deterministic core positions.
    randomSeed: `reaction-matrix-1.32:${scenarioId}`,
    duration,
    cycleLength: Math.max(1, duration),
    enemy: {
      level: 90,
      resistance: 0.1,
      ...(scenario.enemyResistances === undefined
        ? {}
        : {
            resistances: {
              ...scenario.enemyResistances
            }
          }),
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
    reactionEngine: {
      mode: scenario.reactionMode ?? "aura-v5"
    },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
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

const V147_APPLICATION_WIRE_ONLY_KEYS = new Set([
  "applicationIcdDecision",
  "applicationIcdLogId",
  "applicationMultiplier",
  "nominalApplicationGaugeUnits",
  "effectiveApplicationGaugeUnits"
]);

/**
 * Keep the 1.42 classic-reaction semantic digest stable across the 1.47
 * application-ICD wire bump. The old digest intentionally proves reaction,
 * Aura, damage, and task behavior; it must not rotate merely because a
 * no-ICD selector moved from legacy tag/group fields into a top-level audit
 * log.
 */
function stripV147ApplicationWireOnlyFields(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !V147_APPLICATION_WIRE_ONLY_KEYS.has(key)
    )
  );
}

function classicReactionDamageEventsForSemanticDigest(
  result: SimulationResult
): unknown {
  const noIcdApplicationByDamageEventId = new Map(
    result.elementalApplicationIcdLog
      .filter(
        (entry) =>
          entry.damageEventId !== null &&
          entry.decision.kind === "no-icd"
      )
      .map((entry) => [entry.damageEventId!, entry] as const)
  );

  return result.damageEvents.map((event) => {
    // Restrict normalization to the two application-audit wire locations.
    // Recursive stripping would erase the numeric multiplier inside a real
    // mechanics decision and would weaken this semantic digest.
    const normalized = {
      ...stripV147ApplicationWireOnlyFields(
        event as unknown as Record<string, unknown>
      ),
      reactionAudit: stripV147ApplicationWireOnlyFields(
        event.reactionAudit as unknown as Record<string, unknown>
      )
    } as unknown as SimulationResult["damageEvents"][number];
    const application = noIcdApplicationByDamageEventId.get(
      event.id
    );
    if (application === undefined || event.kind !== "direct") {
      return normalized;
    }

    return {
      ...normalized,
      reactionAudit: {
        ...normalized.reactionAudit,
        // Exact legacy projection authored by applicationHit(). These fields
        // were identifiers for a bypass, not mechanics inputs.
        icdAllowed: true,
        icdTag: `matrix-${event.hitId}`,
        icdGroup: "no-icd",
        applicationGaugeUnits: application.nominalGaugeUnits
      }
    };
  });
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
      targetClockModel: result.config.targetClockModel,
      reactionDeliveryModel:
        result.config.reactionDeliveryModel,
      ...(result.config.enemy.resistances === undefined
        ? {}
        : {
            enemyResistances: result.config.enemy.resistances
          }),
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
    targetClock: {
      audit: result.targetClockAudit,
      clockLog: result.targetClockLog,
      hitlagLog: result.targetHitlagLog
    },
    totalDamage: result.totalDamage,
    dps: result.dps,
    reactedHits: result.reactedHits,
    mechanicsStatus: result.mechanicsStatus,
    events: result.damageEvents.map(compactEvent),
    ...(result.config.enemy.resistances === undefined
      ? {}
      : {
          resistanceAudit: result.damageEvents.map((event) => ({
            damageEventId: event.id,
            element: event.element,
            baseResistance:
              event.enemyStateBeforeHit.baseResistance,
            resistanceShred:
              event.enemyStateBeforeHit.resistanceShred,
            effectiveResistance:
              event.enemyStateBeforeHit.effectiveResistance,
            resistanceMultiplier:
              event.damageFactors.resistanceMultiplier
          }))
        }),
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
      damageEvents: sha256(
        classicReactionDamageEventsForSemanticDigest(result)
      ),
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
    "reaction-task-log": new Set(
      result.reactionTaskLog.map((entry) => entry.id)
    ),
    "target-phase-log": new Set(
      result.targetPhaseLog.map((entry) => entry.id)
    ),
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
    reactionDeliveryResultReferencesSchema.parse(result)
  ).toEqual(result);
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
  "reverseMelt",
  "vaporize",
  "reverseVaporize",
  "overload",
  "superconduct",
  "electroCharged",
  "freeze",
  "shatter",
  "swirlPyro",
  "swirlHydro",
  "swirlCryo",
  "swirlElectro",
  "crystallizePyro",
  "crystallizeHydro",
  "crystallizeCryo",
  "crystallizeElectro",
  "quicken",
  "aggravate",
  "spread",
  "burning",
  "bloom",
  "burgeon",
  "hyperbloom"
] as const satisfies readonly ReactionType[];

const SUPPLEMENTAL_CLASSIC_REACTION_SCENARIOS = {
  reverseMelt: {
    durationFrames: 10,
    initialAura: [{ element: "pyro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "reverse-melt-cryo",
        element: "cryo",
        gaugeUnits: 1
      })
    ]
  },
  swirlHydro: {
    durationFrames: 10,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "swirl-hydro-anemo",
        element: "anemo",
        gaugeUnits: 1
      })
    ]
  },
  swirlCryo: {
    durationFrames: 10,
    initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "swirl-cryo-anemo",
        element: "anemo",
        gaugeUnits: 1
      })
    ]
  },
  swirlElectro: {
    durationFrames: 10,
    initialAura: [{ element: "electro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "swirl-electro-anemo",
        element: "anemo",
        gaugeUnits: 1
      })
    ]
  },
  crystallizeHydro: {
    durationFrames: 10,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "crystallize-hydro-geo",
        element: "geo",
        gaugeUnits: 1
      })
    ]
  },
  crystallizeCryo: {
    durationFrames: 10,
    initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "crystallize-cryo-geo",
        element: "geo",
        gaugeUnits: 1
      })
    ]
  },
  crystallizeElectro: {
    durationFrames: 10,
    initialAura: [{ element: "electro", gaugeUnits: 1 }],
    hits: [
      applicationHit({
        id: "crystallize-electro-geo",
        element: "geo",
        gaugeUnits: 1
      })
    ]
  }
} as const satisfies Record<string, MatrixScenario>;

const CLASSIC_REACTION_CLASS_COUNT = 16;
// This digest intentionally excludes version/config-manifest identity so the
// classic reaction semantics remain comparable across wire-version bumps.
const AURA_V9_CLASSIC_MATRIX_SEMANTIC_DIGEST =
  "54810c5ca0c1b8a92c5f0fa6412dbc0544e4741ce931c70b68a71cb02cb79d7f";

function makeAuraV9MatrixConfig(
  scenarioId: string,
  scenario: MatrixScenario
): SimConfig {
  const config = makeMatrixConfig(scenarioId, scenario);
  return {
    ...config,
    meta: {
      ...config.meta,
      name: `Reaction matrix 1.42 · ${scenarioId}`,
      version: "1.42.0",
      verificationStatus: "provisional",
      note:
        `Exact 1.42 aura-v9 classic-reaction release gate; ` +
        `fixed gcsim ${FIXED_GCSIM_COMMIT} code cross-check; ` +
        "not official game truth and does not cover Lunar reactions."
    },
    reactionEngine: {
      mode: "aura-v9"
    },
    electroChargedPropagationModel: {
      mode: "single-target-v1"
    },
    targetTaskModel: {
      mode: "target-phase-v2"
    }
  };
}

const EXPECTED_V7_BURNING_PROJECTION_DAMAGE_EVENT_IDS: Partial<
  Record<ScenarioId, readonly number[]>
> = {
  burning: [1],
  burgeon: [3]
};

const V133_FROZEN_SCENARIO_IDS = Object.keys(
  targetClockMatrixGolden.vectors
);
const V134_FROZEN_SCENARIO_IDS = Object.keys(
  matrixV134Golden.vectors
);
const SEMANTIC_HASH_FIELDS = [
  "damageEvents",
  "hitResolutionLog",
  "reactionDamageLog",
  "stateLogs",
  "targetStateTimeline",
  "auraBoundaries",
  "damageCurve",
  "player"
] as const;

function withoutVersionIdentity(
  vectors: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(vectors).map(([scenarioId, value]) => {
      const vector = value as {
        runManifest: unknown;
        hashes: Record<string, unknown>;
        [key: string]: unknown;
      };
      const {
        runManifest: _runManifest,
        hashes,
        config,
        ...semanticVector
      } = vector;
      const {
        reactionDeliveryModel: _reactionDeliveryModel,
        ...historicalConfig
      } = config as Record<string, unknown>;
      const {
        config: _configHash,
        runManifest: _runManifestHash,
        ...semanticHashes
      } = hashes;
      return [
        scenarioId,
        {
          ...semanticVector,
          config: historicalConfig,
          hashes: semanticHashes
        }
      ];
    })
  );
}

function withoutSingleVersionIdentity(
  vector: ReturnType<typeof compactResult>
) {
  const {
    runManifest: _runManifest,
    hashes,
    config,
    ...semanticVector
  } = vector;
  const {
    reactionDeliveryModel: _reactionDeliveryModel,
    ...historicalConfig
  } = config;
  const {
    config: _configHash,
    runManifest: _runManifestHash,
    ...semanticHashes
  } = hashes;
  return {
    ...semanticVector,
    config: historicalConfig,
    hashes: semanticHashes
  };
}

function collectObservedReactions(
  result: SimulationResult,
  observedReactions: Set<ReactionType>
): void {
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
}

function normalizeBurningPeriodicDamageEvents(
  result: SimulationResult
): SimulationResult["damageEvents"] {
  return result.damageEvents.map((event) =>
    event.kind === "transformative-reaction" &&
    event.reaction === "burning"
      ? {
          ...event,
          reactionAudit: {
            ...event.reactionAudit,
            reaction: "none",
            triggered: false,
            reactions: []
          }
        }
      : event
  );
}

function normalizeBurningPeriodicTargetTimeline(
  result: SimulationResult
): SimulationResult["targetStateTimeline"] {
  const periodicBurningDamageEventIds = new Set(
    result.damageEvents
      .filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "burning"
      )
      .map((event) => event.id)
  );
  return {
    ...result.targetStateTimeline,
    points: result.targetStateTimeline.points.map((point) =>
      point.cause === "reaction-damage-application" &&
      point.primaryDamageEventId !== null &&
      periodicBurningDamageEventIds.has(point.primaryDamageEventId)
        ? {
            ...point,
            reaction: "none" as const,
            reactions: []
          }
        : point
    )
  };
}

function withoutBurningProjectionIdentity(
  result: SimulationResult
) {
  const compact = withoutSingleVersionIdentity(
    compactResult(result)
  );
  const {
    damageEvents: _damageEventsHash,
    targetStateTimeline: _targetStateTimelineHash,
    ...stableHashes
  } = compact.hashes;
  return {
    ...compact,
    events: compact.events.map((event) =>
      event.kind === "transformative-reaction" &&
      event.reaction === "burning"
        ? {
            ...event,
            orderedReactions: []
          }
        : event
    ),
    hashes: stableHashes
  };
}

describe("1.35 provisional reaction-matrix Golden", () => {
  it("retains the frozen 1.31 fixture as an enemy-side semantic baseline", () => {
    expect(historicalMatrixGolden.config).toMatchObject({
      schemaVersion: "1.31.0",
      engineVersion: "1.31.0-dendro-cores",
      dataVersion: "reaction-matrix-fixed-gcsim-cross-check-1"
    });
    expect(Object.keys(historicalMatrixGolden.vectors)).toHaveLength(
      14
    );
    expect(playerDamageMatrixGolden.config).toMatchObject({
      schemaVersion: "1.32.0",
      engineVersion: "1.32.0-player-reaction-damage",
      dataVersion: "reaction-matrix-fixed-gcsim-cross-check-2"
    });
    expect(
      Object.keys(playerDamageMatrixGolden.vectors)
    ).toHaveLength(14);
    expect(targetClockMatrixGolden.config).toMatchObject({
      schemaVersion: "1.33.0",
      engineVersion: "1.33.0-target-local-hitlag",
      targetClockModel: "disabled"
    });
    expect(
      Object.keys(targetClockMatrixGolden.vectors)
    ).toHaveLength(14);
    expect(matrixV134Golden.config).toMatchObject({
      schemaVersion: "1.34.0",
      engineVersion: "1.34.0-general-reaction-order",
      baselineReactionEngineMode: "aura-v5",
      orderedElectroReactionEngineMode: "aura-v6",
      targetClockModel: "disabled"
    });
    expect(Object.keys(matrixV134Golden.vectors)).toHaveLength(15);
    expect(matrixV135Golden.config).toMatchObject({
      schemaVersion: "1.35.0",
      engineVersion: "1.35.0-elemental-enemy-resistance",
      baselineReactionEngineMode: "aura-v5",
      orderedElectroReactionEngineMode: "aura-v6",
      elementalResistanceReactionEngineMode: "aura-v6",
      hydroFrozenEcGuardReactionEngineMode: "aura-v6",
      targetClockModel: "disabled"
    });
    expect(Object.keys(matrixV135Golden.vectors)).toHaveLength(17);
  });

  it("keeps all 17 frozen classic vectors at aura-v6 parity in aura-v7 except the explicit Burning projection fix", () => {
    expect(Object.keys(SCENARIOS)).toEqual(
      Object.keys(matrixV135Golden.vectors)
    );

    for (const [scenarioId, scenario] of Object.entries(
      SCENARIOS
    ) as [ScenarioId, MatrixScenario][]) {
      const v6Config = makeMatrixConfig(scenarioId, scenario);
      v6Config.reactionEngine = { mode: "aura-v6" };
      const v7Config = makeMatrixConfig(scenarioId, scenario);
      v7Config.reactionEngine = { mode: "aura-v7" };
      const options = {
        ...OPTIONS,
        randomSeed: v6Config.randomSeed
      };
      const v6Result = simulate(v6Config, options);
      const v7Result = simulate(v7Config, options);

      expect(v6Result.config.reactionEngine).toEqual({
        mode: "aura-v6"
      });
      expect(v7Result.config.reactionEngine).toEqual({
        mode: "aura-v7"
      });
      for (const result of [v6Result, v7Result]) {
        expect(result.runManifest).toMatchObject({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          engineVersion: CURRENT_ENGINE_VERSION,
          dataVersion: DATA_VERSION,
          resolvedRuntimeOptions: options
        });
        expect(result.mechanicsStatus).toBe("complete");
        expect(result.targetMechanicsTruncationLog).toEqual([]);
        expect(result.config.reactionDeliveryModel).toEqual({
          mode: "deferred-event-heap-v1"
        });
        validateResultSchemas(result);
      }
      expect(v7Result.runManifest.configHash).not.toBe(
        v6Result.runManifest.configHash
      );
      expect(v7Result.reproducibilityKey).not.toBe(
        v6Result.reproducibilityKey
      );
      const expectedBurningProjectionDamageEventIds =
        EXPECTED_V7_BURNING_PROJECTION_DAMAGE_EVENT_IDS[
          scenarioId
        ];
      if (expectedBurningProjectionDamageEventIds !== undefined) {
        const damageEventProjectionDeltas =
          v6Result.damageEvents
            .map((event, index) => ({
              id: event.id,
              frame: event.frame,
              kind: event.kind,
              reaction: event.reaction,
              v6AuditReaction: event.reactionAudit.reaction,
              v7AuditReaction:
                v7Result.damageEvents[index]?.reactionAudit
                  .reaction,
              v6Triggered: event.reactionAudit.triggered,
              v7Triggered:
                v7Result.damageEvents[index]?.reactionAudit
                  .triggered,
              v6Reactions: event.reactionAudit.reactions,
              v7Reactions:
                v7Result.damageEvents[index]?.reactionAudit
                  .reactions
            }))
            .filter(
              ({
                v6AuditReaction,
                v7AuditReaction,
                v6Triggered,
                v7Triggered,
                v6Reactions,
                v7Reactions
              }) =>
                v6AuditReaction !== v7AuditReaction ||
                v6Triggered !== v7Triggered ||
                canonicalStringify(v6Reactions) !==
                canonicalStringify(v7Reactions)
            );
        expect(
          damageEventProjectionDeltas.map(({ id }) => id)
        ).toEqual(expectedBurningProjectionDamageEventIds);
        for (const delta of damageEventProjectionDeltas) {
          expect(delta).toMatchObject({
            kind: "transformative-reaction",
            reaction: "burning",
            v6AuditReaction: "burning",
            v7AuditReaction: "none",
            v6Triggered: true,
            v7Triggered: false,
            v6Reactions: ["burning"],
            v7Reactions: []
          });
        }
        const targetTimelineProjectionDeltas =
          v6Result.targetStateTimeline.points
            .map((point, index) => ({
              id: point.id,
              frame: point.frame,
              cause: point.cause,
              primaryDamageEventId: point.primaryDamageEventId,
              v6Reaction: point.reaction,
              v6Reactions: point.reactions,
              v7Reaction:
                v7Result.targetStateTimeline.points[index]
                  ?.reaction,
              v7Reactions:
                v7Result.targetStateTimeline.points[index]
                  ?.reactions
            }))
            .filter(
              ({
                v6Reaction,
                v6Reactions,
                v7Reaction,
                v7Reactions
              }) =>
                v6Reaction !== v7Reaction ||
                canonicalStringify(v6Reactions) !==
                  canonicalStringify(v7Reactions)
            );
        expect(
          targetTimelineProjectionDeltas.map(
            ({ primaryDamageEventId }) => primaryDamageEventId
          )
        ).toEqual(expectedBurningProjectionDamageEventIds);
        for (const delta of targetTimelineProjectionDeltas) {
          expect(delta).toMatchObject({
            frame: v6Result.damageEvents[
              delta.primaryDamageEventId ?? -1
            ]?.frame,
            cause: "reaction-damage-application",
            v6Reaction: "burning",
            v6Reactions: ["burning"],
            v7Reaction: "none",
            v7Reactions: []
          });
        }
        expect(v7Result.reactedHits).toBe(v6Result.reactedHits);
        expect(
          normalizeBurningPeriodicDamageEvents(v7Result)
        ).toEqual(normalizeBurningPeriodicDamageEvents(v6Result));
        expect(
          normalizeBurningPeriodicTargetTimeline(v7Result)
        ).toEqual(
          normalizeBurningPeriodicTargetTimeline(v6Result)
        );
        expect(
          withoutBurningProjectionIdentity(v7Result)
        ).toEqual(withoutBurningProjectionIdentity(v6Result));
      } else {
        expect(
          withoutSingleVersionIdentity(compactResult(v7Result))
        ).toEqual(
          withoutSingleVersionIdentity(compactResult(v6Result))
        );
      }
    }
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

      expect(result.runManifest).toMatchObject({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        dataVersion: DATA_VERSION,
        resolvedRuntimeOptions: options,
        configHash: expect.stringMatching(
          /^fnv1a32:[0-9a-f]{8}$/
        ),
        reproducibilityKey: expect.stringMatching(
          /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
        )
      });
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
      if (scenarioId === "electroOrdered") {
        const directEvent = result.damageEvents.find(
          (event) => event.kind === "direct"
        );
        expect(result.config.reactionEngine).toEqual({
          mode: "aura-v6"
        });
        expect(directEvent?.reactionAudit).toMatchObject({
          reaction: "overload",
          reactions: ["overload", "superconduct"],
          unsupportedReactions: [],
          mechanicsTruncation: null
        });
        expect(
          directEvent?.reactionAudit.transformativeReactions?.map(
            ({
              reaction,
              damageElement,
              damageFrame,
              scheduled
            }) => ({
              reaction,
              damageElement,
              damageFrame,
              scheduled
            })
          )
        ).toEqual([
          {
            reaction: "overload",
            damageElement: "pyro",
            damageFrame: 1,
            scheduled: true
          },
          {
            reaction: "superconduct",
            damageElement: "cryo",
            damageFrame: 1,
            scheduled: true
          }
        ]);
        expect(
          result.reactionDamageLog.map(
            ({ reaction, triggerFrame, damageFrame }) => ({
              reaction,
              triggerFrame,
              damageFrame
            })
          )
        ).toEqual([
          {
            reaction: "overload",
            triggerFrame: 0,
            damageFrame: 1
          },
          {
            reaction: "superconduct",
            triggerFrame: 0,
            damageFrame: 1
          }
        ]);
        expect(
          result.damageEvents
            .filter(
              (event) =>
                event.kind === "transformative-reaction"
            )
            .map(({ reaction, frame }) => ({
              reaction,
              frame
            }))
        ).toEqual([
          { reaction: "overload", frame: 1 },
          { reaction: "superconduct", frame: 1 }
        ]);
        expect(result.mechanicsStatus).toBe("complete");
        expect(result.targetMechanicsTruncationLog).toEqual([]);
      }
      if (scenarioId === "elementalResistance") {
        expect(result.enemyTargets).toEqual([
          expect.objectContaining({
            id: "enemy-0",
            resistance: 0.1,
            resistances: scenario.enemyResistances
          })
        ]);
        expect(
          result.damageEvents.map((event) => ({
            id: event.id,
            element: event.element,
            reaction: event.reaction,
            baseResistance:
              event.enemyStateBeforeHit.baseResistance,
            effectiveResistance:
              event.enemyStateBeforeHit.effectiveResistance,
            resistanceMultiplier:
              event.damageFactors.resistanceMultiplier,
            finalDamage: event.finalDamage,
            displayDamage: event.displayDamage
          }))
        ).toEqual([
          {
            id: 0,
            element: "electro",
            reaction: "overload",
            baseResistance: 0.2,
            effectiveResistance: 0.2,
            resistanceMultiplier: 0.8,
            finalDamage: 400,
            displayDamage: 400
          },
          {
            id: 1,
            element: "pyro",
            reaction: "overload",
            baseResistance: 0.3,
            effectiveResistance: 0.3,
            resistanceMultiplier: 0.7,
            finalDamage: 5464.283385,
            displayDamage: 5464
          },
          {
            id: 2,
            element: "cryo",
            reaction: "superconduct",
            baseResistance: 0.4,
            effectiveResistance: 0.4,
            resistanceMultiplier: 0.6,
            finalDamage: 2554.7298942857137,
            displayDamage: 2555
          }
        ]);
        expect(result.totalDamage).toBe(8419.013279285713);
      }
      if (scenarioId === "hydroFrozenEcGuard") {
        const directEvent = result.damageEvents.find(
          (event) => event.kind === "direct"
        );
        expect(directEvent?.reactionAudit).toMatchObject({
          reaction: "vaporize",
          reactions: ["vaporize", "freeze", "bloom"],
          periodicReaction: null,
          unsupportedReactions: [],
          mechanicsTruncation: null
        });
        expect(
          result.damageEvents.map(
            ({ frame, kind, reaction, finalDamage }) => ({
              frame,
              kind,
              reaction,
              finalDamage
            })
          )
        ).toEqual([
          {
            frame: 0,
            kind: "direct",
            reaction: "vaporize",
            finalDamage: 1246.8
          }
        ]);
        expect(
          result.damageEvents.filter(
            (event) =>
              event.frame === 10 ||
              event.reaction === "electroCharged"
          )
        ).toEqual([]);
        expect(
          result.reactionDamageLog.filter(
            (entry) => entry.reaction === "electroCharged"
          )
        ).toEqual([]);
        expect(
          result.periodicReactionLog.filter(
            (entry) => entry.reaction === "electroCharged"
          )
        ).toEqual([]);
        expect(
          result.dendroCoreLog
            .filter(
              (entry) =>
                entry.operation === "spawn-scheduled" ||
                entry.operation === "spawn"
            )
            .map((entry) => ({
              operation: entry.operation,
              frame: entry.frame,
              spawnFrame:
                entry.operation === "spawn-scheduled"
                  ? entry.spawnFrame
                  : entry.spawnedAtFrame
            }))
        ).toEqual([
          {
            operation: "spawn-scheduled",
            frame: 0,
            spawnFrame: 30
          },
          {
            operation: "spawn",
            frame: 30,
            spawnFrame: 30
          }
        ]);
        expect(result.totalDamage).toBe(1246.8);
      }
      if (scenarioId === "freezeShatter") {
        const parent = result.damageEvents.find(
          (event) =>
            event.kind === "direct" &&
            event.hitId === "shatter-blunt"
        );
        const child = result.damageEvents.find(
          (event) => event.reaction === "shatter"
        );
        expect(result.config.reactionDeliveryModel).toEqual({
          mode: "deferred-event-heap-v1"
        });
        expect(parent).toBeDefined();
        expect(child).toMatchObject({
          parentDamageEventId: parent?.id
        });
        expect(parent!.id).toBeLessThan(child!.id);
      }

      collectObservedReactions(result, observedReactions);
      const compact = compactResult(result);
      expect(result.config.targetClockModel).toEqual({
        mode: "disabled"
      });
      expect(result.config.targetTaskModel).toEqual({
        mode: "legacy-event-heap-v1"
      });
      expect(result.config.reactionDeliveryModel).toEqual({
        mode: "deferred-event-heap-v1"
      });
      expect(result.targetClockAudit).toEqual({
        version: "1.0.0",
        mode: "disabled",
        hitlagStatus: "unsupported-enemy-hitlag",
        targets: []
      });
      expect(result.targetClockLog).toEqual([]);
      expect(result.targetHitlagLog).toEqual([]);
      expect(result.targetTaskPhaseLog).toEqual([]);
      if (V133_FROZEN_SCENARIO_IDS.includes(scenarioId)) {
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
        expect(compact).toMatchObject(
          historicalEnemySemantics
        );
        const playerDamageVector = (
          playerDamageMatrixGolden.vectors as Record<
            string,
            Record<string, unknown>
          >
        )[scenarioId]!;
        const {
          runManifest: _playerDamageRunManifest,
          hashes: playerDamageHashes,
          ...playerDamageSemantics
        } = playerDamageVector;
        expect(compact).toMatchObject(playerDamageSemantics);
        const {
          config: _playerDamageConfigHash,
          runManifest: _playerDamageRunManifestHash,
          ...playerDamageSemanticHashes
        } = playerDamageHashes as Record<string, string>;
        expect(compact.hashes).toMatchObject(
          playerDamageSemanticHashes
        );

        const targetClockVector = (
          targetClockMatrixGolden.vectors as unknown as Record<
            string,
            { hashes: Record<string, string> }
          >
        )[scenarioId]!;
        expect(compact.targetClock).toEqual({
          audit: {
            version: "1.0.0",
            mode: "disabled",
            hitlagStatus: "unsupported-enemy-hitlag",
            targets: []
          },
          clockLog: [],
          hitlagLog: []
        });
        for (const field of SEMANTIC_HASH_FIELDS) {
          expect(compact.hashes[field]).toBe(
            targetClockVector.hashes[field]
          );
        }
      }
      if (V134_FROZEN_SCENARIO_IDS.includes(scenarioId)) {
        const v134Vector = (
          matrixV134Golden.vectors as unknown as Record<
            string,
            { hashes: Record<string, string> }
          >
        )[scenarioId]!;
        for (const field of SEMANTIC_HASH_FIELDS) {
          expect(compact.hashes[field]).toBe(
            v134Vector.hashes[field]
          );
        }
      }
      actualVectors[scenarioId] = compact;
    }

    for (const [reaction, scenario] of Object.entries(
      SUPPLEMENTAL_CLASSIC_REACTION_SCENARIOS
    )) {
      const config = makeMatrixConfig(reaction, scenario);
      config.reactionEngine = { mode: "aura-v7" };
      const options = {
        ...OPTIONS,
        randomSeed: config.randomSeed
      };
      const result = simulate(config, options);
      const repeated = simulate(
        makeMatrixConfig(reaction, {
          ...scenario,
          reactionMode: "aura-v7"
        }),
        options
      );

      expect(result.mechanicsStatus).toBe("complete");
      expect(result.targetMechanicsTruncationLog).toEqual([]);
      expect(result.timelineExecution?.failures).toEqual([]);
      expect(repeated).toEqual(result);
      validateResultSchemas(result);
      collectObservedReactions(result, observedReactions);
      expect(
        result.damageEvents.some(
          (event) =>
            event.reaction === reaction ||
            event.reactionAudit.reactions.includes(
              reaction as ReactionType
            )
        )
      ).toBe(true);
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
    expect(withoutVersionIdentity(actualVectors)).toEqual(
      withoutVersionIdentity(
        matrixV135Golden.vectors as Record<string, unknown>
      )
    );
  });
});

describe("current aura-v9 classic reaction release gate", () => {
  it("covers all 16 classic reaction classes and 24 non-none labels without Lunar scope", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe("1.47.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.47.0-elemental-application-icd-root"
    );
    expect(REQUIRED_REACTIONS).toHaveLength(24);

    const scenarios = [
      ...Object.entries(SCENARIOS),
      ...Object.entries(SUPPLEMENTAL_CLASSIC_REACTION_SCENARIOS)
    ] as [string, MatrixScenario][];
    expect(scenarios).toHaveLength(24);

    const observedReactions = new Set<ReactionType>();
    const scenarioSentinels: Array<{
      scenarioId: string;
      reactions: ReactionType[];
      totalDamage: number;
      damageEventCount: number;
      semanticDigest: string;
    }> = [];

    for (const [scenarioId, scenario] of scenarios) {
      const config = makeAuraV9MatrixConfig(
        scenarioId,
        scenario
      );
      const options = {
        ...OPTIONS,
        randomSeed: config.randomSeed
      };
      const result = simulate(config, options);
      const repeated = simulate(
        makeAuraV9MatrixConfig(scenarioId, scenario),
        options
      );

      expect(
        simulationResultSchema.parse(result)
      ).toEqual(result);
      expect(
        simulationResultSchema.parse(repeated)
      ).toEqual(repeated);
      if (scenarioId === "freezeShatter") {
        const forged = structuredClone(result);
        const frozen = forged.frozenStateLog[0];
        if (frozen === undefined) {
          throw new Error(
            "Freeze/Shatter vector must expose frozen-state audit rows."
          );
        }
        frozen.freezeResistance = 1.01;
        expect(
          simulationResultSchema.safeParse(forged).success
        ).toBe(false);
        const forgedTime = structuredClone(result);
        forgedTime.frozenStateLog[0]!.timeSeconds += 0.01;
        expect(
          simulationResultSchema.safeParse(forgedTime).success
        ).toBe(false);
      }
      if (scenarioId === "swirl") {
        const forged = structuredClone(result);
        const swirl = forged.damageEvents
          .flatMap(
            (event) => event.reactionAudit.swirlReactions
          )
          .at(0);
        if (swirl === undefined) {
          throw new Error(
            "Swirl vector must expose a Swirl audit."
          );
        }
        swirl.swirledElement =
          swirl.swirledElement === "pyro" ? "hydro" : "pyro";
        expect(
          simulationResultSchema.safeParse(forged).success
        ).toBe(false);
      }
      if (scenarioId === "crystallize") {
        const forged = structuredClone(result);
        const crystallize = forged.damageEvents
          .map(
            (event) =>
              event.reactionAudit.crystallizeReaction
          )
          .find((audit) => audit !== null);
        if (crystallize === undefined || crystallize === null) {
          throw new Error(
            "Crystallize vector must expose a Crystallize audit."
          );
        }
        crystallize.crystallizedElement =
          crystallize.crystallizedElement === "pyro"
            ? "hydro"
            : "pyro";
        expect(
          simulationResultSchema.safeParse(forged).success
        ).toBe(false);
      }
      if (scenarioId === "catalyze") {
        const forged = structuredClone(result);
        const additive = forged.damageEvents
          .map(
            (event) =>
              event.reactionAudit.catalyzeReaction?.additive
          )
          .find((audit) => audit !== null && audit !== undefined);
        if (additive === undefined || additive === null) {
          throw new Error(
            "Catalyze vector must expose an additive audit."
          );
        }
        additive.triggerElement =
          additive.triggerElement === "electro"
            ? "dendro"
            : "electro";
        expect(
          simulationResultSchema.safeParse(forged).success
        ).toBe(false);
      }
      expect(result).toEqual(repeated);
      expect(result.config).toMatchObject({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        reactionEngine: {
          mode: "aura-v9"
        },
        electroChargedPropagationModel: {
          mode: "single-target-v1"
        },
        targetTaskModel: {
          mode: "target-phase-v2"
        },
        timeline: {
          mode: "legal-frame-v1",
          fps: 60
        }
      });
      expect(result.runManifest).toMatchObject({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        dataVersion: DATA_VERSION,
        resolvedRuntimeOptions: options
      });
      expect(result.timelineExecution?.failures).toEqual([]);
      expect(result.mechanicsStatus).toBe("complete");
      expect(result.targetMechanicsTruncationLog).toEqual([]);

      validateResultSchemas(result);
      expect(
        targetPhaseV2ResultReferencesSchema.parse(result)
      ).toEqual(result);
      expect(
        reactionDeliveryResultReferencesSchema.parse(result)
      ).toEqual(result);
      if (scenarioId === "electroCharged") {
        expect(
          electroChargedCleanupResultReferencesSchema.parse(result)
        ).toEqual(result);
      }
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

      const scenarioReactions = new Set<ReactionType>();
      collectObservedReactions(result, scenarioReactions);
      for (const reaction of scenarioReactions) {
        observedReactions.add(reaction);
      }
      const reactions = [...scenarioReactions].sort();
      scenarioSentinels.push({
        scenarioId,
        reactions,
        totalDamage: result.totalDamage,
        damageEventCount: result.damageEvents.length,
        semanticDigest: sha256({
          compactResult: withoutSingleVersionIdentity(
            compactResult(result)
          ),
          targetTaskPhaseLog: result.targetTaskPhaseLog,
          targetPhaseLog: result.targetPhaseLog,
          reactionTaskLog: result.reactionTaskLog
        })
      });
    }

    const observedLabels = [...observedReactions].sort();
    expect(observedLabels).toHaveLength(24);
    expect(observedLabels).toEqual([...REQUIRED_REACTIONS].sort());
    expect(
      observedLabels.some((reaction) =>
        reaction.toLowerCase().includes("lunar")
      )
    ).toBe(false);

    const canonicalSentinel = {
      scope: "classic-reactions-only-no-lunar",
      reactionClassCount: CLASSIC_REACTION_CLASS_COUNT,
      nonNoneReactionLabelCount: REQUIRED_REACTIONS.length,
      scenarioCount: scenarios.length,
      observedLabels,
      scenarios: scenarioSentinels
    };
    const digest = sha256(canonicalSentinel);
    if (process.env.PRINT_AURA_V9_REACTION_MATRIX === "1") {
      console.log(`aura-v9 classic reaction digest: ${digest}`);
    }
    expect(digest).toBe(
      AURA_V9_CLASSIC_MATRIX_SEMANTIC_DIGEST
    );
  });
});
