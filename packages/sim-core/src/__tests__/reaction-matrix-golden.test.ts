import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  assertTrustedSimulationResult,
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
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  reactionDamageGroupDecisionAuditV150Schema,
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
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";
import historicalMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.31.golden.json";
import playerDamageMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.32.golden.json";
import targetClockMatrixGolden from "../../../test-vectors/fixtures/reaction-matrix-1.33.golden.json";
import matrixV134Golden from "../../../test-vectors/fixtures/reaction-matrix-1.34.golden.json";
import matrixV135Golden from "../../../test-vectors/fixtures/reaction-matrix-1.35.golden.json";
import { simulate, type SimulationRuntimeOptions } from "../simulator";
import { parseSimulationHit, replaySimulationHit } from "../calculator-bridge";
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
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
    },
    // Historical 1.31–1.35 semantic projections keep the immediate
    // attachment scheduler and the pre-1.52 absence of Freeze Broken audits.
    basicReactionSchedulerModel: {
      mode: "legacy-immediate-basic-reaction-scheduler-v1",
      policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
    },
    freezeBrokenAttackModel: {
      mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
      policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID
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
  "elementalApplicationIcdLogId",
  "applicationMultiplier",
  "nominalApplicationGaugeUnits",
  "effectiveApplicationGaugeUnits"
]);

/**
 * Keep the 1.42 classic-reaction semantic digest stable across the 1.48
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

type ClassicReactionDamageSemanticProjection =
  | "historical-v147"
  | "current-v153";

function targetStateTimelineForSemanticDigest(
  result: SimulationResult,
  projection: ClassicReactionDamageSemanticProjection
): SimulationResult["targetStateTimeline"] {
  if (projection !== "historical-v147") {
    return result.targetStateTimeline;
  }

  return {
    ...result.targetStateTimeline,
    points: result.targetStateTimeline.points.map((point) => ({
      ...point,
      links: point.links.filter(
        (link) =>
          link.kind !== "basic-reaction-scheduler-log"
      )
    }))
  };
}

function classicReactionDamageEventsForSemanticDigest(
  result: SimulationResult,
  projection: ClassicReactionDamageSemanticProjection
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
  const allowedReactionOwnedSwirlByDamageEventId = new Map(
    result.elementalApplicationIcdLog
      .filter(
        (entry) =>
          entry.sourceKind === "swirl-propagation" &&
          entry.damageEventId !== null &&
          entry.decision.kind === "reaction-fixed-gcsim" &&
          entry.decision.allowed
      )
      .map((entry) => [entry.damageEventId!, entry] as const)
  );
  const reactionOwnedBurningByDamageEventId = new Map(
    result.elementalApplicationIcdLog
      .filter(
        (entry) =>
          entry.sourceKind === "burning-tick" &&
          entry.damageEventId !== null
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
    const legacyPropagationNote =
      normalized.reactionAudit.note === undefined
        ? {}
        : {
            note: normalized.reactionAudit.note
              .replace("可信反应附着", "附着")
              .replace("反应伤害。", "扩散伤害。")
          };
    const reactionOwnedBurningApplication =
      reactionOwnedBurningByDamageEventId.get(event.id);
    if (
      projection === "historical-v147" &&
      reactionOwnedBurningApplication !== undefined &&
      event.kind === "transformative-reaction" &&
      event.reaction === "burning"
    ) {
      return {
        ...normalized,
        reactionAudit: {
          ...normalized.reactionAudit,
          // V1.47 exposed the fixed Burning selector through these legacy
          // fields and always reported nominal, rather than effective, Gauge.
          icdAllowed:
            reactionOwnedBurningApplication.decision.allowed,
          icdTag: "burning-application",
          icdGroup: "burning",
          applicationGaugeUnits:
            reactionOwnedBurningApplication.nominalGaugeUnits,
          ...legacyPropagationNote
        }
      };
    }
    const reactionOwnedSwirlApplication =
      allowedReactionOwnedSwirlByDamageEventId.get(event.id);
    if (
      projection === "historical-v147" &&
      reactionOwnedSwirlApplication !== undefined &&
      event.kind === "transformative-reaction" &&
      event.reaction.startsWith("swirl")
    ) {
      return {
        ...normalized,
        reactionAudit: {
          ...normalized.reactionAudit,
          // V1.47 modeled an allowed Swirl propagation as a no-ICD
          // application. Reconstruct only that reviewed, allowed branch;
          // blocked V1.48 trusted applications remain visibly different.
          icdAllowed: true,
          icdTag: event.reaction,
          icdGroup: "no-icd",
          applicationGaugeUnits:
            reactionOwnedSwirlApplication.nominalGaugeUnits,
          ...legacyPropagationNote
        }
      };
    }
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

function classicReactionHitResolutionForSemanticDigest(
  result: SimulationResult
): unknown {
  return result.hitResolutionLog.map((entry) => {
    const {
      reactionDamageLogId: _reactionDamageLogId,
      elementalApplicationIcdLogId: _applicationLogId,
      ...frozen
    } = entry;
    if (
      entry.resolutionKind !== "reaction-damage" ||
      result.config.targetTaskModel.mode !==
        "legacy-event-heap-v1"
    ) {
      return frozen;
    }
    const {
      eventPriority: _eventPriority,
      eventSequence: _eventSequence,
      intraEventSequence: _intraEventSequence,
      ...legacyReactionResolution
    } = frozen;
    // Before 1.48 legacy-event-heap reaction-damage rows omitted these
    // scheduling coordinates. Target-phase v2 already projected them, so
    // keep those values in the current classic-reaction release digest.
    return legacyReactionResolution;
  });
}

function classicReactionDamageLogForSemanticDigest(
  result: SimulationResult
): unknown {
  return result.reactionDamageLog.map((entry) => {
    const {
      hitResolutionLogIds: _hitResolutionLogIds,
      elementalApplicationIcdLogIds: _applicationLogIds,
      damageGroupDecisions,
      ...frozen
    } = entry;
    return {
      ...frozen,
      damageGroupDecisions: damageGroupDecisions.map(
        projectReactionDamageGroupDecisionToFrozenV149
      )
    };
  });
}

function projectReactionDamageGroupDecisionToFrozenV149(
  decision: SimulationResult["reactionDamageLog"][number]["damageGroupDecisions"][number]
) {
  return {
    reaction: decision.reaction,
    sourceActorId: decision.sourceActorId,
    targetId: decision.targetId,
    windowStartFrame: decision.windowStartFrame,
    hitIndex: decision.hitIndex,
    resetFrames: 30 as const,
    sequence:
      decision.icdGroup === "reaction-a"
        ? ([true, true, false] as const)
        : ([true, false] as const),
    damageAllowed: decision.damageAllowed,
    blockedReason: decision.blockedReason
  };
}

function projectPlayerDamageEventsToFrozenV149(
  result: SimulationResult
) {
  return result.playerDamageEvents.map((entry) => ({
    ...entry,
    damageFactors: {
      ...entry.damageFactors,
      damageGroupDecision:
        entry.damageFactors.damageGroupDecision === null
          ? null
          : projectReactionDamageGroupDecisionToFrozenV149(
              entry.damageFactors.damageGroupDecision
            )
    }
  }));
}

function compactResult(
  result: SimulationResult,
  applicationProjection: ClassicReactionDamageSemanticProjection =
    "historical-v147"
) {
  const timeline = result.config.timeline;
  if (timeline?.mode !== "legal-frame-v1") {
    throw new Error("Reaction matrix requires a legal timeline.");
  }
  const frozenPlayerDamageEvents =
    projectPlayerDamageEventsToFrozenV149(result);
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
      ...(applicationProjection === "current-v153"
        ? {
            basicReactionScheduler:
              result.basicReactionSchedulerLog,
            freezeBrokenAttack: result.freezeBrokenAttackLog
          }
        : {}),
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
      damageEvents: frozenPlayerDamageEvents.map((entry) => ({
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
        classicReactionDamageEventsForSemanticDigest(
          result,
          applicationProjection
        )
      ),
      hitResolutionLog: sha256(
        classicReactionHitResolutionForSemanticDigest(result)
      ),
      reactionDamageLog: sha256(
        classicReactionDamageLogForSemanticDigest(result)
      ),
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
      targetStateTimeline: sha256(
        targetStateTimelineForSemanticDigest(
          result,
          applicationProjection
        )
      ),
      auraBoundaries: sha256({
        initial: result.auraInitialStates,
        end: result.auraEndStates
      }),
      damageCurve: sha256(result.damageCurve),
      player: sha256({
        playerHitResolutionLog: result.playerHitResolutionLog,
        playerDamageEvents: frozenPlayerDamageEvents,
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

function expectLegacyBasicReactionSchedulerV1(
  result: SimulationResult
): void {
  expect(result.config.basicReactionSchedulerModel).toEqual({
    mode: "legacy-immediate-basic-reaction-scheduler-v1",
    policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
  });
  expect(result.runManifest.basicReactionSchedulerRoot).toMatchObject({
    policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
  });
  for (const entry of result.basicReactionSchedulerLog) {
    expect(entry).toMatchObject({
      kind: "swirl-attack-resolution",
      disposition: "legacy-immediate",
      pairedLogId: null
    });
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
    "basic-reaction-scheduler-log": new Set(
      result.basicReactionSchedulerLog.map((entry) => entry.id)
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
        reactionDamageGroupDecisionAuditV150Schema.parse(decision)
      ).toEqual(decision);
    }
  }

  expectContiguousIds(result.damageEvents);
  expectContiguousIds(result.hitResolutionLog);
  expectContiguousIds(result.targetMechanicsTruncationLog);
  expectContiguousIds(result.reactionDamageLog);
  expectContiguousIds(result.basicReactionSchedulerLog);
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
// This current 1.53 gate intentionally retains the provisional 1.52 semantic
// digest by selecting Freeze V2 with callback bus V1. It excludes
// version/config-manifest identity but retains scheduler-v2 attack/commit rows,
// reciprocal pairing, and deferred Aura-attachment timeline semantics. It
// covers only the classic matrix and does not claim Lunar, complete gcsim, or
// official-server parity. Historical fixture comparisons use the explicit
// V1.47 compatibility projection.
const AURA_V9_CLASSIC_MATRIX_SEMANTIC_DIGEST =
  "4ff615ccf2cff65f33837cb7a1c7bc9e2b1d2c9967061718027e0e0f638a8325";

function makeAuraV9MatrixConfig(
  scenarioId: string,
  scenario: MatrixScenario
): SimConfig {
  const currentScenario: MatrixScenario =
    scenarioId === "swirl" && scenario.targets !== undefined
      ? {
          ...scenario,
          targets: [
            ...scenario.targets,
            {
              id: "enemy-2",
              name: "Swirl deferred attachment target",
              position: { x: 2, y: 0 },
              initialAura: []
            }
          ]
        }
      : scenario;
  const config = makeMatrixConfig(scenarioId, currentScenario);
  return {
    ...config,
    meta: {
      ...config.meta,
      name: `Reaction matrix 1.53 · ${scenarioId}`,
      version: "1.53.0",
      verificationStatus: "provisional",
      note:
        `Current 1.53 aura-v9 classic-reaction compatibility gate; ` +
        `fixed gcsim ${FIXED_GCSIM_COMMIT} code cross-check; ` +
        "narrow scheduler coverage only; not official game truth, " +
        "complete gcsim parity, or Lunar-reaction coverage."
    },
    reactionEngine: {
      mode: "aura-v9"
    },
    basicReactionSchedulerModel: {
      mode: "fixed-gcsim-basic-reaction-scheduler-v2",
      policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
    },
    freezeBrokenAttackModel: {
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    },
    callbackBusModel: {
      mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
      policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID
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

// Exact, clean-pin original inputs/results; never a current-to-old projector.
// The archive pins every byte and the 130-call / 79-case source manifest.
const matrixArchiveBytes = readFileSync(new URL(
  "../../../test-vectors/src/fixtures/historical-reaction-matrix-v153-84ff5cd.json", import.meta.url,
));
const matrixByteSha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
interface HistoricalMatrixCase {
  caseId: string; sourceInputSha256: string; sourceInputText: string;
  sourceWireSha256: string; sourceWireText: string;
  observedAt: Array<{ index: number; test: string }>;
}
const matrixArchive = JSON.parse(matrixArchiveBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string; observedRunCount: number;
    originalTests: { total: number; passed: number; failed: number; pending: number } };
  cases: HistoricalMatrixCase[];
};
expect(matrixByteSha256(matrixArchiveBytes)).toBe("35fe73161655b9cb39f297855a142827fd6ba03881fcfbfe60ca91498503ee86");
type MatrixEra = "authentic historical" | "current engine";
type MatrixArgs = [config: SimConfig, options?: SimulationRuntimeOptions];
type MatrixStepCollection = "target" | "core" | "contact" | "coreTimeline" | "freezeBroken";
interface MatrixCoordinates {
  queue: readonly (readonly [number, number])[];
  missingDirect: readonly number[];
  steps: readonly (readonly [MatrixStepCollection, number, number, number])[];
}
// Closed per-input maps, not a mode-wide normalization. All 448 original queue
// allocations match full payload and order in the read-only 79-case observer.
// The current ordinary runtime additionally retains 69 real future tasks beyond
// each duration. These consume sequence numbers without changing the horizon.
// Every known queue position is listed, including unchanged prefix positions;
// unknown positions fail. V5/V6/V7 and V9 retain their own distinct mechanics.
const CURRENT_MATRIX_COORDINATES: Record<string, MatrixCoordinates> = {
  "aura-v6/reaction-matrix-1.32:melt": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:melt": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:vaporize": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:vaporize": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:overload": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:overload": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:superconduct": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:superconduct": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:electroCharged": { queue: [[0,0],[1,1],[2,3],[3,4],[4,6]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:electroCharged": { queue: [[0,0],[1,1],[2,3],[3,4],[4,6]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:freezeShatter": { queue: [[0,0],[1,1],[2,2],[3,4]], missingDirect: [0,1], steps: [["target",1,0,1],["target",2,0,1],["target",3,1,2]] },
  "aura-v7/reaction-matrix-1.32:freezeShatter": { queue: [[0,0],[1,1],[2,2],[3,4]], missingDirect: [0,1], steps: [["target",1,0,1],["target",2,0,1],["target",3,1,2]] },
  "aura-v6/reaction-matrix-1.32:swirl": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [0], steps: [["target",2,0,1]] },
  "aura-v7/reaction-matrix-1.32:swirl": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [0], steps: [["target",2,0,1]] },
  "aura-v6/reaction-matrix-1.32:crystallize": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:crystallize": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:catalyze": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0,1,2], steps: [["target",1,0,1],["target",2,0,1],["target",3,0,1]] },
  "aura-v7/reaction-matrix-1.32:catalyze": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0,1,2], steps: [["target",1,0,1],["target",2,0,1],["target",3,0,1]] },
  "aura-v6/reaction-matrix-1.32:burning": { queue: [[0,0],[1,1],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:burning": { queue: [[0,0],[1,1],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:bloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [0], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:bloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [0], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:burgeon": { queue: [[0,0],[1,1],[2,2],[3,3],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]], missingDirect: [0,1], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v7/reaction-matrix-1.32:burgeon": { queue: [[0,0],[1,1],[2,2],[3,3],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]], missingDirect: [0,1], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v6/reaction-matrix-1.32:hyperbloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,6]], missingDirect: [0,1], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v7/reaction-matrix-1.32:hyperbloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,6]], missingDirect: [0,1], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v6/reaction-matrix-1.32:cryoMultiReaction": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:cryoMultiReaction": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:electroOrdered": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:electroOrdered": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:elementalResistance": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:elementalResistance": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v6/reaction-matrix-1.32:hydroFrozenEcGuard": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:hydroFrozenEcGuard": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:melt": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:vaporize": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:overload": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:superconduct": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:electroCharged": { queue: [[0,0],[1,1],[2,3],[3,4],[4,6]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:freezeShatter": { queue: [[0,0],[1,1],[2,2],[3,4]], missingDirect: [0,1], steps: [["target",1,0,1],["target",2,0,1],["target",3,1,2]] },
  "aura-v5/reaction-matrix-1.32:swirl": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [0], steps: [["target",2,0,1]] },
  "aura-v5/reaction-matrix-1.32:crystallize": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:catalyze": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0,1,2], steps: [["target",1,0,1],["target",2,0,1],["target",3,0,1]] },
  "aura-v5/reaction-matrix-1.32:burning": { queue: [[0,0],[1,1],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:bloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [0], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v5/reaction-matrix-1.32:burgeon": { queue: [[0,0],[1,1],[2,2],[3,3],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]], missingDirect: [0,1], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v5/reaction-matrix-1.32:hyperbloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,6]], missingDirect: [0,1], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v5/reaction-matrix-1.32:cryoMultiReaction": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:reverseMelt": { queue: [[0,0],[1,1]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:swirlHydro": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:swirlCryo": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:swirlElectro": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:crystallizeHydro": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:crystallizeCryo": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v7/reaction-matrix-1.32:crystallizeElectro": { queue: [[0,0],[1,1],[2,2]], missingDirect: [0], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:melt": { queue: [[0,0],[1,1],[2,2]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:vaporize": { queue: [[0,0],[1,1],[2,2]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:overload": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:superconduct": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:electroCharged": { queue: [[0,0],[1,1],[2,2],[3,5],[4,7],[5,8],[6,9],[7,10]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:freezeShatter": { queue: [[0,0],[1,1],[2,2],[3,3],[4,6],[5,7]], missingDirect: [], steps: [["freezeBroken",0,2,3],["target",1,0,1],["target",2,0,1],["target",3,1,2]] },
  "aura-v9/reaction-matrix-1.32:swirl": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,8],[9,9],[10,10],[11,11],[12,12],[13,13],[14,14]], missingDirect: [], steps: [["target",3,0,1]] },
  "aura-v9/reaction-matrix-1.32:crystallize": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:catalyze": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,7],[6,8]], missingDirect: [], steps: [["target",1,0,1],["target",2,0,1],["target",3,0,1]] },
  "aura-v9/reaction-matrix-1.32:burning": { queue: [[0,0],[1,1],[2,2],[3,5],[4,6],[5,7],[6,8],[7,9],[8,10],[9,11],[10,12],[11,13],[12,14],[13,15],[14,16]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:bloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6]], missingDirect: [], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:burgeon": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18]], missingDirect: [], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v9/reaction-matrix-1.32:hyperbloom": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,6],[6,9],[7,10]], missingDirect: [], steps: [["core",0,1,2],["core",2,1,2],["contact",0,3,4],["coreTimeline",1,2,3],["target",1,0,1],["target",2,0,1]] },
  "aura-v9/reaction-matrix-1.32:cryoMultiReaction": { queue: [[0,0],[1,1],[2,2],[3,3],[4,6]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:electroOrdered": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:elementalResistance": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:hydroFrozenEcGuard": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [], steps: [["core",0,1,2],["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:reverseMelt": { queue: [[0,0],[1,1],[2,2]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:swirlHydro": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:swirlCryo": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:swirlElectro": { queue: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:crystallizeHydro": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:crystallizeCryo": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [], steps: [["target",1,0,1]] },
  "aura-v9/reaction-matrix-1.32:crystallizeElectro": { queue: [[0,0],[1,1],[2,2],[3,3]], missingDirect: [], steps: [["target",1,0,1]] },
};

// These six authentic old results omit direct-resolution queue coordinates.
// Their original acceptance was established by all unchanged tests on clean
// 84ff5cd, not by pretending today's stronger validator is that old contract.
// Keep today's exact refusal visible; do not backfill the archived wires.
const HISTORICAL_CORE_CONTACT_REFUSALS = new Set([
  "aura-v6/reaction-matrix-1.32:burgeon",
  "aura-v7/reaction-matrix-1.32:burgeon",
  "aura-v6/reaction-matrix-1.32:hyperbloom",
  "aura-v7/reaction-matrix-1.32:hyperbloom",
  "aura-v5/reaction-matrix-1.32:burgeon",
  "aura-v5/reaction-matrix-1.32:hyperbloom",
]);
const HISTORICAL_CORE_CONTACT_ISSUES = [
  { code: "custom", path: ["dendroCoreContactLog", 0, "hitResolutionLogIds", 0], message: "direct core contact requires complete unique targets and their ordered queue events" },
  { code: "custom", path: ["dendroCoreContactLog", 0, "eventSequence"], message: "direct core contact completion must match the last target queue event" },
  { code: "custom", path: ["dendroCoreContactLog", 0, "hitResolutionLogIds", 0], message: "core-contact hit resolution does not match its frame, source, hit identity, element, or resolution kind" },
  { code: "custom", path: ["dendroCoreContactLog", 0, "eventPriority"], message: "current core contact must use its actual direct-hit or source-owned reaction delivery phase" },
  { code: "custom", path: ["dendroCoreContactLog", 0, "triggerDamageEventIds", 0], message: "core-contact trigger does not match its damage-event provenance" },
];
function expectHistoricalCurrentBoundary(id: string, result: SimulationResult): void {
  if (!HISTORICAL_CORE_CONTACT_REFUSALS.has(id)) {
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    return;
  }
  const parsed = simulationResultSchema.safeParse(result);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error(`Historical core-contact boundary unexpectedly changed: ${id}`);
  const issues = HISTORICAL_CORE_CONTACT_ISSUES.map((issue) => ({ ...issue, message: `Dendro core references: ${issue.message}` }));
  expect(parsed.error.issues).toEqual(issues);
  let trustedMessage: string | undefined;
  try { assertTrustedSimulationResult(result); } catch (error) {
    if (!(error instanceof Error)) throw error;
    trustedMessage = error.message;
  }
  expect(trustedMessage).toBe(`Trusted SimulationResult 1.53 integrity validation failed: ${issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
}
function expectMatrixCoreReferences(era: MatrixEra, result: SimulationResult): void {
  const id = `${result.config.reactionEngine?.mode}/${result.config.randomSeed}`;
  if (era === "authentic historical" && HISTORICAL_CORE_CONTACT_REFUSALS.has(id)) {
    const parsed = dendroCoreResultReferencesSchema.safeParse(result);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error(`Historical core-contact facet unexpectedly changed: ${id}`);
    expect(parsed.error.issues).toEqual(HISTORICAL_CORE_CONTACT_ISSUES);
    return;
  }
  expect(dendroCoreResultReferencesSchema.parse(result)).toEqual(result);
}

function authenticMatrixResult(args: MatrixArgs): SimulationResult {
  const id = `${args[0].reactionEngine?.mode}/${args[0].randomSeed}`;
  if (!Object.hasOwn(CURRENT_MATRIX_COORDINATES, id)) throw new Error(`Unreviewed matrix input ${id}`);
  const rows = matrixArchive.cases.filter((row) => row.caseId === id);
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  expect(matrixByteSha256(row.sourceInputText)).toBe(row.sourceInputSha256);
  expect(matrixByteSha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  expect(JSON.stringify(args)).toBe(row.sourceInputText);
  const result = JSON.parse(row.sourceWireText) as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expectHistoricalCurrentBoundary(id, result);
  return result;
}

// Only these three identity containers are compared separately. All numerical,
// Aura, player, queue, ownership, reference and ordering fields stay in the
// complete mechanics object. Neither the current result nor its IDs are edited.
function matrixMechanics(result: SimulationResult): Omit<SimulationResult, "runManifest" | "resolvedRuntimeOptions" | "reproducibilityKey"> {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...mechanics } = result;
  return mechanics;
}

function expectCurrentMatrixContract(args: MatrixArgs, result: SimulationResult): void {
  const before = JSON.stringify(result);
  const old = authenticMatrixResult(args);
  const key = `${args[0].reactionEngine?.mode}/${args[0].randomSeed}`;
  const coordinates = CURRENT_MATRIX_COORDINATES[key];
  if (!coordinates) throw new Error(`Unreviewed matrix coordinates ${key}`);
  expect(result.resolvedRuntimeOptions).toStrictEqual({ ...old.resolvedRuntimeOptions, flatStatBuffSemantics: "canonical-v1" });
  expect(result.runManifest.resolvedRuntimeOptions).toStrictEqual(result.resolvedRuntimeOptions);
  expect(result.runManifest.reproducibilityKey).toBe(result.reproducibilityKey);
  expect(result.reproducibilityKey).not.toBe(old.reproducibilityKey);
  const { resolvedRuntimeOptions: _oldOptions, reproducibilityKey: _oldKey, ...oldManifest } = old.runManifest;
  const { resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...manifest } = result.runManifest;
  expect(manifest).toStrictEqual(oldManifest);
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);

  const queue = new Map(coordinates.queue);
  expect(queue.size).toBe(coordinates.queue.length);
  expect(new Set(queue.values()).size).toBe(queue.size);
  expect([...queue.keys()]).toEqual([...queue.keys()].sort((a, b) => a - b));
  expect([...queue.values()]).toEqual([...queue.values()].sort((a, b) => a - b));
  const nextSequence = (sequence: number): number => {
    const next = queue.get(sequence);
    if (next === undefined) throw new Error(`Unreviewed ${key} queue position ${sequence}`);
    return next;
  };
  const mapSequence = <T extends object>(row: T): T => {
    if (!("eventSequence" in row) || row.eventSequence == null) return row;
    if (typeof row.eventSequence !== "number") throw new Error("Expected a numeric matrix queue position");
    return { ...row, eventSequence: nextSequence(row.eventSequence) };
  };
  const expected = structuredClone(matrixMechanics(old));
  expected.damageEvents = expected.damageEvents.map(mapSequence);
  expected.hitEvents = expected.hitEvents.map(mapSequence);
  expected.hitResolutionLog = expected.hitResolutionLog.map(mapSequence);
  expected.auraTimeline = expected.auraTimeline.map(mapSequence);
  expected.elementalApplicationIcdLog = expected.elementalApplicationIcdLog.map(mapSequence);
  expected.burningStateLog = expected.burningStateLog.map(mapSequence);
  expected.playerHitResolutionLog = expected.playerHitResolutionLog.map(mapSequence);
  expected.playerDamageEvents = expected.playerDamageEvents.map((row) => ({
    ...mapSequence(row), damageFactors: { ...row.damageFactors,
      damageGroupDecision: row.damageFactors.damageGroupDecision === null ? null : {
        ...row.damageFactors.damageGroupDecision,
        damageGroupTaskSequence: nextSequence(row.damageFactors.damageGroupDecision.damageGroupTaskSequence),
      },
    },
  }));
  expected.playerHpTimeline.points = expected.playerHpTimeline.points.map(mapSequence);
  expected.dendroCoreLog = expected.dendroCoreLog.map(mapSequence);
  expected.dendroCoreContactLog = expected.dendroCoreContactLog.map(mapSequence);
  expected.dendroCoreTimeline.points = expected.dendroCoreTimeline.points.map(mapSequence);
  expected.targetStateTimeline.points = expected.targetStateTimeline.points.map(mapSequence);
  expected.reactionDamageLog = expected.reactionDamageLog.map((row) => ({
    ...row, damageGroupDecisions: row.damageGroupDecisions.map((decision) => ({
      ...decision, damageGroupTaskSequence: nextSequence(decision.damageGroupTaskSequence),
    })),
  }));
  expected.basicReactionSchedulerLog = expected.basicReactionSchedulerLog.map((row) => ({
    ...mapSequence(row), parentEventSequence: nextSequence(row.parentEventSequence),
  }));
  expected.targetPhaseLog = expected.targetPhaseLog.map((row) => {
    if (row.model !== "target-phase-v2") throw new Error(`Unreviewed target-phase model in ${key}`);
    return { ...row, targetTasks: row.targetTasks.map((task) => mapSequence(task)) };
  });
  expected.freezeBrokenAttackLog = expected.freezeBrokenAttackLog.map((row) => ({
    ...row, triggerEventSequence: nextSequence(row.triggerEventSequence),
  }));

  // Legacy heap rows previously omitted direct hit-resolution coordinates.
  // Backfill only the exact pinned missing IDs, from their authentic old direct
  // damage-event backlink. The receiving direct witness precedes Aura at I0.
  expect(expected.hitResolutionLog.filter((row) => row.reactionDamageLogId === null && row.eventSequence === undefined).map((row) => row.id)).toEqual(coordinates.missingDirect);
  for (const id of coordinates.missingDirect) {
    const row = expected.hitResolutionLog[id];
    if (!row || row.id !== id) throw new Error(`Missing direct resolution ${key}/${id}`);
    expect(row).not.toHaveProperty("eventPriority");
    expect(row).not.toHaveProperty("eventSequence");
    expect(row).not.toHaveProperty("intraEventSequence");
    const damage = expected.damageEvents.find((event) => event.id === row.damageEventId);
    if (!damage || damage.eventSequence === undefined) throw new Error("Missing authentic direct damage backlink");
    expect(damage).toMatchObject({ kind: "direct", eventPriority: 3, frame: row.frame, targetId: row.targetId, hitId: row.hitId });
    row.eventPriority = 3;
    row.eventSequence = damage.eventSequence;
    row.intraEventSequence = 0;
  }

  // The new direct hit-resolution witness allocates exactly one earlier local
  // step. Only these closed original hit-owned rows move; recursive children,
  // deferred attachment, scheduler phases and all other steps remain untouched.
  for (const [collection, id, from, to] of coordinates.steps) {
    const rows = collection === "target" ? expected.targetStateTimeline.points
      : collection === "core" ? expected.dendroCoreLog
      : collection === "contact" ? expected.dendroCoreContactLog
      : collection === "coreTimeline" ? expected.dendroCoreTimeline.points
      : expected.freezeBrokenAttackLog;
    const row = rows[id];
    if (!row || row.id !== id) throw new Error(`Missing exact ${key}/${collection}/${id}`);
    expect(row.intraEventSequence).toBe(from);
    expect(to).toBe(from + 1);
    if ("triggerEventType" in row) {
      expect(row).toMatchObject({ triggerEventType: "hit", triggerEventPriority: 3 });
    } else {
      expect(row).toMatchObject({ eventType: "hit", eventPriority: 3 });
      if ("cause" in row) expect(["direct-hit-application", "direct-hit-shatter"]).toContain(row.cause);
    }
    row.intraEventSequence = to;
  }
  expect(matrixMechanics(result), key).toStrictEqual(expected);
  expect(JSON.stringify(result)).toBe(before);
}

function runMatrix(era: MatrixEra, ...args: MatrixArgs): SimulationResult {
  if (era === "authentic historical") return authenticMatrixResult(args);
  const inputBefore = JSON.stringify(args);
  const result = simulate(...args);
  expect(JSON.stringify(args)).toBe(inputBefore);
  expectCurrentMatrixContract(args, result);
  if (result.config.reactionEngine?.mode === "aura-v9") expectCurrentMatrixNumbers(result);
  return result;
}

function expectCurrentMatrixNumbers(result: SimulationResult): void {
  // Independent arithmetic for this pinned, provisional classic profile (not
  // live-server truth): level90 base1446.8535, ATK1000, EM100, no CRIT/buff,
  // equal-level DEF0.5, resistance10%, reaction bonus20%. No production formula
  // helper or observed damage factor is used to construct these expectations.
  const direct = 1000 * 0.5 * 0.9;
  const amplifying = (base: number, bonus = 0.2) => base * (1 + 2.78 * 100 / 1500 + bonus);
  const transformative = (base: number, resistance = 0.1) => 1446.8535 * base * (1 + 16 * 100 / 2100 + 0.2) * (1 - resistance);
  const additive = (base: number) => (1000 + 1446.8535 * base * (1 + 5 * 100 / 1300 + 0.2)) * 0.5 * 0.9;
  const numbers: Record<string, readonly (readonly [number, ReactionType, number])[]> = {
    melt: [[0, "melt", direct * amplifying(2)]],
    vaporize: [[0, "vaporize", direct * amplifying(2)]],
    overload: [[0, "overload", direct], [1, "overload", transformative(2.75)]],
    superconduct: [[0, "superconduct", direct], [1, "superconduct", transformative(1.5)]],
    electroCharged: [[0, "electroCharged", direct], [10, "electroCharged", transformative(2)]],
    freezeShatter: [[0, "freeze", direct], [12, "none", direct], [12, "shatter", transformative(3)]],
    // At F5 the live +30% buff affects only the reverse-Vaporize multiplier;
    // the Swirl transformative payload still owns its original 20% snapshot.
    swirl: [[0, "swirlPyro", direct], [1, "swirlPyro", transformative(0.6)], [5, "swirlPyro", transformative(0.6) * amplifying(1.5, 0.5)], [5, "swirlPyro", transformative(0.6)]],
    crystallize: [[0, "crystallizePyro", direct]],
    catalyze: [[0, "quicken", direct], [12, "aggravate", additive(1.15)], [24, "spread", additive(1.25)]],
    burning: [[0, "burning", direct], [15, "burning", transformative(0.25)], [30, "burning", transformative(0.25)], [45, "burning", transformative(0.25)], [60, "burning", transformative(0.25)]],
    // F0 application → F30 core spawn → F330 expiry → F331 Bloom delivery.
    bloom: [[0, "bloom", direct], [331, "bloom", transformative(2)]],
    burgeon: [[0, "bloom", direct], [31, "burning", direct], [32, "burgeon", transformative(3)], [46, "burning", transformative(0.25)], [61, "burning", transformative(0.25)]],
    hyperbloom: [[0, "bloom", direct], [31, "quicken", direct], [91, "hyperbloom", transformative(3)]],
    cryoMultiReaction: [[0, "reverseMelt", direct * amplifying(1.5)], [1, "superconduct", transformative(1.5)]],
    electroOrdered: [[0, "overload", direct], [1, "overload", transformative(2.75)], [1, "superconduct", transformative(1.5)]],
    elementalResistance: [[0, "overload", 1000 * 0.5 * 0.8], [1, "overload", transformative(2.75, 0.3)], [1, "superconduct", transformative(1.5, 0.4)]],
    hydroFrozenEcGuard: [[0, "vaporize", direct * amplifying(2)]],
    reverseMelt: [[0, "reverseMelt", direct * amplifying(1.5)]],
    swirlHydro: [[0, "swirlHydro", direct], [1, "swirlHydro", transformative(0.6)]],
    swirlCryo: [[0, "swirlCryo", direct], [1, "swirlCryo", transformative(0.6)]],
    swirlElectro: [[0, "swirlElectro", direct], [1, "swirlElectro", transformative(0.6)]],
    crystallizeHydro: [[0, "crystallizeHydro", direct]],
    crystallizeCryo: [[0, "crystallizeCryo", direct]],
    crystallizeElectro: [[0, "crystallizeElectro", direct]],
  };
  const scenario = String(result.config.randomSeed).split(":")[1]!;
  const expected = numbers[scenario];
  if (!expected) throw new Error(`Unreviewed current matrix arithmetic ${scenario}`);
  expect(result.damageEvents.map((event) => [event.id, event.frame, event.reaction])).toEqual(expected.map(([frame, reaction], id) => [id, frame, reaction]));
  expect(result.damageEvents.map((event) => event.targetId)).toEqual(scenario === "swirl" ? ["enemy-0", "enemy-0", "enemy-1", "enemy-2"] : expected.map(() => "enemy-0"));
  result.damageEvents.forEach((event, id) => {
    expect(event.sourceActorId).toBe("matrix");
    expect(event.finalDamage).toBeCloseTo(expected[id]![2], 10);
    expect(event.displayDamage).toBe(Math.round(expected[id]![2]));
  });
  expect(result.totalDamage).toBeCloseTo(expected.reduce((sum, row) => sum + row[2], 0), 10);
  if (["bloom", "burgeon", "hyperbloom"].includes(scenario)) {
    expect(result.dendroCoreLog.find((row) => row.operation === "spawn-scheduled")).toMatchObject({ id: 0, frame: 0, originDamageEventId: 0, spawnFrame: 30, coreDurationFrames: 300 });
    expect(result.dendroCoreLog.find((row) => row.operation === "spawn")).toMatchObject({ id: 1, frame: 30, originDamageEventId: 0, spawnedAtFrame: 30, expiresAtFrame: 330 });
  }
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
      const v6Result = runMatrix("current engine", v6Config, options);
      const v7Result = runMatrix("current engine", v7Config, options);

      expect(v6Result.config.reactionEngine).toEqual({
        mode: "aura-v6"
      });
      expect(v7Result.config.reactionEngine).toEqual({
        mode: "aura-v7"
      });
      for (const result of [v6Result, v7Result]) {
        expectLegacyBasicReactionSchedulerV1(result);
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

  it.each(["authentic historical", "current engine"] as const)("%s: preserves every baseline reaction vector, projection boundary, and run identity", (era) => {
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
      const result = runMatrix(era, config, options);
      const repeated = runMatrix(era,
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
      expectLegacyBasicReactionSchedulerV1(result);
      validateResultSchemas(result);
      expect(
        playerDamageResultReferencesSchema.parse(result)
      ).toEqual(result);
      if (
        result.dendroCoreLog.length > 0 ||
        result.dendroCoreContactLog.length > 0
      ) {
        expectMatrixCoreReferences(era, result);
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
      if (era === "authentic historical" && V133_FROZEN_SCENARIO_IDS.includes(scenarioId)) {
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
        expect(
          compact.hashes,
          `frozen reaction vector ${scenarioId}`
        ).toMatchObject(
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
      if (era === "authentic historical" && V134_FROZEN_SCENARIO_IDS.includes(scenarioId)) {
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
      const result = runMatrix(era, config, options);
      const repeated = runMatrix(era,
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
    }
    // The five frozen hashes describe authentic old output, not current wire
    // coordinates. The current runner above instead checks every full result.
    if (era === "authentic historical") {
      expect(withoutVersionIdentity(actualVectors)).toEqual(
        withoutVersionIdentity(
          matrixV135Golden.vectors as Record<string, unknown>
        )
      );
    }
  });
});

describe("current aura-v9 classic reaction release gate", () => {
  it.each(["authentic historical", "current engine"] as const)("%s: covers all 16 classic reaction classes and 24 non-none labels without Lunar scope", (era) => {
    expect(REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION).toBe(
      "1.50.0"
    );
    expect(REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION).toBe(
      "1.50.0-reaction-damage-reset-boundary"
    );
    expect(CURRENT_SCHEMA_VERSION).toBe("1.53.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.53.0-callback-bus"
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
      const result = runMatrix(era, config, options);
      const repeated = runMatrix(era,
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

        expect(
          result.basicReactionSchedulerLog.find(
            (entry) =>
              entry.kind === "swirl-attack-resolution" &&
              entry.targetId === "enemy-1"
          )
        ).toMatchObject({
          reaction: "reverseVaporize",
          reactions: ["reverseVaporize"],
          disposition: "not-attached",
          pairedLogId: null
        });

        const deferredAttack =
          result.basicReactionSchedulerLog.find(
            (entry) =>
              entry.kind === "swirl-attack-resolution" &&
              entry.disposition === "deferred" &&
              entry.targetId === "enemy-2"
          );
        if (
          deferredAttack === undefined ||
          deferredAttack.kind !== "swirl-attack-resolution" ||
          deferredAttack.disposition !== "deferred"
        ) {
          throw new Error(
            "Swirl scheduler-v2 vector must defer the empty target Aura attachment."
          );
        }
        expect(deferredAttack).toMatchObject({
          frame: 5,
          reaction: "none",
          reactions: [],
          auraBefore: [],
          auraApplied: [],
          auraConsumed: [],
          auraAfter: []
        });

        const deferredAttachment =
          result.basicReactionSchedulerLog[
            deferredAttack.pairedLogId
          ];
        if (
          deferredAttachment === undefined ||
          deferredAttachment.kind !==
            "deferred-aura-attachment"
        ) {
          throw new Error(
            "Swirl scheduler-v2 vector must commit the deferred Aura attachment."
          );
        }
        expect(deferredAttachment).toMatchObject({
          frame: deferredAttack.frame,
          parentEventSequence:
            deferredAttack.parentEventSequence,
          targetId: "enemy-2",
          element: "pyro",
          reaction: "none",
          reactions: [],
          auraBefore: [],
          auraApplied: [
            expect.objectContaining({
              element: "pyro",
              sourceActorId: "matrix"
            })
          ],
          auraConsumed: [],
          pairedLogId: deferredAttack.id,
          disposition: "committed"
        });
        expect(deferredAttack.pairedLogId).toBe(
          deferredAttachment.id
        );
        expect(deferredAttachment.eventSequence).toBeGreaterThan(
          deferredAttack.parentEventSequence
        );
        expect(
          result.targetStateTimeline.points.find(
            (point) =>
              point.targetId === "enemy-2" &&
              point.cause === "reaction-aura-attachment"
          )
        ).toMatchObject({
          frame: deferredAttachment.frame,
          pointKind: "mutation",
          eventType: "reactionAuraAttachment",
          eventSequence: deferredAttachment.eventSequence,
          reaction: "none",
          reactions: [],
          primaryDamageEventId: null,
          links: [
            {
              kind: "basic-reaction-scheduler-log",
              id: deferredAttachment.id
            }
          ],
          auraBefore: deferredAttachment.auraBefore,
          auraApplied: deferredAttachment.auraApplied,
          auraConsumed: [],
          auraAfter: deferredAttachment.auraAfter
        });
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
        basicReactionSchedulerModel: {
          mode: "fixed-gcsim-basic-reaction-scheduler-v2",
          policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
        },
        freezeBrokenAttackModel: {
          mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
          policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
        },
        callbackBusModel: {
          mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
          policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID
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
        resolvedRuntimeOptions: options,
        basicReactionSchedulerRoot: {
          policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
        },
        freezeBrokenAttackRoot: {
          policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
        },
        callbackBusRoot: {
          policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID
        }
      });
      expect(result.timelineExecution?.failures).toEqual([]);
      expect(result.mechanicsStatus).toBe(
        result.freezeBrokenAttackLog.length > 0 ? "partial" : "complete"
      );
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
            compactResult(result, "current-v153")
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
    // Keep the exact original aggregate digest on authentic old output. The
    // current runner retains each complete per-profile wire plus independent
    // arithmetic; no replacement current digest can hide lost causal fields.
    if (era === "authentic historical") {
      expect(digest).toBe(AURA_V9_CLASSIC_MATRIX_SEMANTIC_DIGEST);
    }
  }, 15_000);
});

describe("authentic matrix source and current import boundaries", () => {
  it("pins all five immutable Goldens and all 79 complete original input/result cases", () => {
    expect(matrixArchive).toMatchObject({
      fixtureVersion: "historical-reaction-matrix-v153-84ff5cd-v1",
      source: { commit: "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5", observedRunCount: 130,
        originalTests: { total: 4, passed: 4, failed: 0, pending: 0 } },
    });
    expect(matrixArchive.cases.map((row) => row.caseId)).toEqual(Object.keys(CURRENT_MATRIX_COORDINATES));
    expect(matrixArchive.cases).toHaveLength(79);
    expect(new Set(matrixArchive.cases.map((row) => row.caseId)).size).toBe(79);
    expect(matrixArchive.cases.flatMap((row) => row.observedAt.map((call) => call.index)).sort((a, b) => a - b)).toEqual(Array.from({ length: 130 }, (_, id) => id));
    for (const [version, digest] of Object.entries({
      "1.31": "edb5e16d698683e6a64f3ecbf01baa30ab5df012fb0137d907cef9a91d1720cc",
      "1.32": "4089587e77765a655ccf6f776a32e1bc7e259a10ba3b532fb273274d814962e4",
      "1.33": "67a6546d8562e3d9720262a26ce5b6a9224fa9e871fabbe0c9b1d0e9e5490231",
      "1.34": "2a6a08d69f6c819959def335fc7b676f7d8f48bfce7c4700307d5e80be08497e",
      "1.35": "d21e107dd1ed53f897d5f5d1f45af4735cd99297c281f5123d71e1fbc394d8c5",
    })) {
      expect(matrixByteSha256(readFileSync(new URL(`../../../test-vectors/fixtures/reaction-matrix-${version}.golden.json`, import.meta.url)))).toBe(digest);
    }
    expect(matrixArchive.cases.filter((row) => HISTORICAL_CORE_CONTACT_REFUSALS.has(row.caseId)).map((row) => row.caseId)).toEqual([...HISTORICAL_CORE_CONTACT_REFUSALS]);
    for (const row of matrixArchive.cases) authenticMatrixResult(JSON.parse(row.sourceInputText) as MatrixArgs);
  });

  it("refuses unknown or changed archived inputs and current coordinate drift without mutating the wire", () => {
    const args = JSON.parse(matrixArchive.cases[0]!.sourceInputText) as MatrixArgs;
    const result = runMatrix("current engine", ...args);
    const forged = structuredClone(result);
    const point = forged.targetStateTimeline.points[1]!;
    expect(point).toMatchObject({ eventType: "hit", cause: "direct-hit-application", intraEventSequence: 1 });
    point.intraEventSequence = 0;
    // Legacy 1.53 accepts its historical I0 application convention. The new
    // engine's exact current oracle, not a fabricated standalone trusted-API
    // guarantee, owns rejection of this still-publicly-readable old coordinate.
    expect(simulationResultSchema.safeParse(forged).success).toBe(true);
    const before = JSON.stringify(forged);
    expect(() => expectCurrentMatrixContract(args, forged)).toThrow();
    expect(JSON.stringify(forged)).toBe(before);
    const changed = structuredClone(args);
    changed[0].characters[0]!.stats.baseAtk += 1;
    expect(() => authenticMatrixResult(changed)).toThrow();
    changed[0].randomSeed = "unreviewed-matrix-case";
    expect(() => authenticMatrixResult(changed)).toThrow("Unreviewed matrix input");
  });

  it("independently replays every current v9 damage event through the real calculator import API", () => {
    const scenarios = { ...SCENARIOS, ...SUPPLEMENTAL_CLASSIC_REACTION_SCENARIOS };
    expect(Object.keys(scenarios)).toHaveLength(24);
    let events = 0;
    for (const [scenario, definition] of Object.entries(scenarios)) {
      const config = makeAuraV9MatrixConfig(scenario, definition);
      const result = runMatrix("current engine", config, { ...OPTIONS, randomSeed: config.randomSeed });
      for (const event of result.damageEvents) {
        const capture = parseSimulationHit(JSON.stringify({ schemaVersion: "calculator-event-v1", eventId: event.id, sourceResult: result }));
        expect(capture.sourceResult).toEqual(result);
        const replay = replaySimulationHit(capture);
        expect(replay.reproducedDamage).toBeCloseTo(event.finalDamage, 10);
        expect(replay.difference).toBeCloseTo(0, 10);
        events += 1;
      }
    }
    expect(events).toBe(53);
  });

  const hostile: Array<{ name: string; scenario: keyof typeof SCENARIOS; mutate: (result: SimulationResult) => void }> = [
    { name: "duplicate damage ID", scenario: "overload", mutate: (r) => { r.damageEvents[1]!.id = 0; } },
    { name: "dangling direct resolution backlink", scenario: "overload", mutate: (r) => { r.hitResolutionLog[0]!.damageEventId = 999; } },
    { name: "dangling reaction trigger", scenario: "overload", mutate: (r) => { r.reactionDamageLog[0]!.triggerDamageEventId = 999; } },
    { name: "dangling reaction delivery", scenario: "overload", mutate: (r) => { r.reactionDamageLog[0]!.damageEventIds[0] = 999; } },
    { name: "wrong reaction group task coordinate", scenario: "overload", mutate: (r) => { r.reactionDamageLog[0]!.damageGroupDecisions[0]!.damageGroupTaskSequence = 999; } },
    { name: "duplicate target-state point ID", scenario: "overload", mutate: (r) => { r.targetStateTimeline.points[1]!.id = 0; } },
    { name: "dangling target-state link", scenario: "overload", mutate: (r) => { r.targetStateTimeline.points[1]!.links[0]!.id = 999; } },
    { name: "changed source config digest", scenario: "melt", mutate: (r) => { r.config.characters[0]!.stats.baseAtk += 1; } },
    { name: "forged result reproducibility key", scenario: "melt", mutate: (r) => { r.reproducibilityKey = "gdl-v2-fnv1a32-00000000"; } },
    { name: "strict extra wire field", scenario: "melt", mutate: (r) => { Object.assign(r, { unreviewedField: true }); } },
    { name: "Frozen resistance overflow", scenario: "freezeShatter", mutate: (r) => { r.frozenStateLog[0]!.freezeResistance = 1.01; } },
    { name: "Frozen frame/time disagreement", scenario: "freezeShatter", mutate: (r) => { r.frozenStateLog[0]!.timeSeconds += 0.01; } },
    { name: "wrong Swirl application element", scenario: "swirl", mutate: (r) => { r.damageEvents[0]!.reactionAudit.swirlReactions[0]!.swirledElement = "hydro"; } },
    { name: "broken deferred attachment reciprocal link", scenario: "swirl", mutate: (r) => {
      const row = r.basicReactionSchedulerLog.find((entry) => entry.kind === "deferred-aura-attachment");
      if (!row || row.kind !== "deferred-aura-attachment") throw new Error("Missing deferred attachment control");
      row.pairedLogId = 999;
    } },
    { name: "wrong Crystallize absorbed element", scenario: "crystallize", mutate: (r) => {
      const audit = r.damageEvents[0]!.reactionAudit.crystallizeReaction;
      if (!audit) throw new Error("Missing Crystallize control");
      audit.crystallizedElement = "hydro";
    } },
    { name: "wrong additive trigger element", scenario: "catalyze", mutate: (r) => {
      const additive = r.damageEvents[1]!.reactionAudit.catalyzeReaction?.additive;
      if (!additive) throw new Error("Missing additive control");
      additive.triggerElement = "dendro";
    } },
    { name: "dangling core origin", scenario: "bloom", mutate: (r) => { r.dendroCoreLog[0]!.originDamageEventId = 999; } },
    { name: "dangling core-contact removal", scenario: "hyperbloom", mutate: (r) => { r.dendroCoreContactLog[0]!.removalLogIds[0] = 999; } },
  ];
  for (const entry of hostile) it(`rejects ${entry.name} at public schema and actual JSON import`, () => {
    const config = makeAuraV9MatrixConfig(entry.scenario, SCENARIOS[entry.scenario]);
    const result = runMatrix("current engine", config, { ...OPTIONS, randomSeed: config.randomSeed });
    const wire = (sourceResult: SimulationResult): string => JSON.stringify({ schemaVersion: "calculator-event-v1", eventId: 0, sourceResult });
    expect(parseSimulationHit(wire(result)).sourceResult).toEqual(result);
    const forged = structuredClone(result);
    entry.mutate(forged);
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
    expect(() => parseSimulationHit(wire(forged))).toThrow();
  });
});
