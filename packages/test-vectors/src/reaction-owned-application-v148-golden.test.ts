import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  assertTrustedSimulationResultV148,
  simulationResultV148Schema,
  type SimConfig,
  type SimulationResultForV148
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { simulate } from "../../sim-core/src/simulator";
import {
  makeConfig,
  neutralStats
} from "../../sim-core/src/__tests__/fixtures";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden
} from "./reviewed-golden";
import { projectSimulationResultV148ToV147 } from "./project-v148-to-v147";
import { projectSimulationResultV149ToV148 } from "./project-v149-to-v148";

const PREVIEW_FLAG =
  "PREVIEW_REACTION_OWNED_APPLICATION_V148_GOLDEN";
const UPDATE_FLAG =
  "UPDATE_REACTION_OWNED_APPLICATION_V148_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "704c5db38dda87802aa000d664812b63673ea9498981ed21f26a21eac5c620bd";
const FIXTURE_URL = new URL(
  "../fixtures/reaction-owned-application-1.48.golden.json",
  import.meta.url
);

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

function makeBurningApplicationConfig(): SimConfig {
  const base = makeConfig();
  const durationFrames = 162;
  return {
    ...base,
    dataVersion: "synthetic-reaction-owned-burning-1.48",
    randomSeed: "synthetic-reaction-owned-burning-1.48",
    meta: {
      name: "Reaction-owned Burning application vector",
      version: "1.48.0",
      verificationStatus: "provisional"
    },
    duration: durationFrames / 60,
    cycleLength: durationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "early-recipient",
          name: "Early recipient",
          position: { x: 0.8, y: 0 }
        },
        {
          id: "enemy-0",
          name: "Burning owner",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 4 }]
        },
        {
          id: "late-recipient",
          name: "Late recipient",
          position: { x: -0.8, y: 0 }
        },
        {
          id: "far-recipient",
          name: "Far recipient",
          position: { x: 3, y: 0 }
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro-driver",
        name: "Pyro driver",
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
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
    },
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro-driver",
      swapFrames: 1,
      abilities: [
        {
          id: "start-burning",
          actorId: "pyro-driver",
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
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 0.1
              },
              application: noIcd(1)
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro-driver",
          abilityId: "start-burning",
          atFrame: 0
        }
      ]
    }
  };
}

function makeSwirlApplicationConfig(): SimConfig {
  const base = makeConfig();
  const sourceTargets = [
    "enemy-0",
    "swirl-source-1",
    "swirl-source-2",
    "swirl-source-3"
  ] as const;
  const commandFrames = [0, 6, 12, 36] as const;
  return {
    ...base,
    dataVersion: "synthetic-reaction-owned-swirl-1.48",
    randomSeed: "synthetic-reaction-owned-swirl-1.48",
    meta: {
      name: "Reaction-owned Swirl application vector",
      version: "1.48.0",
      verificationStatus: "provisional"
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        ...sourceTargets.map((id, index) => ({
          id,
          name: id,
          position: { x: 0, y: index - 1 },
          initialAura: [
            { element: "pyro" as const, gaugeUnits: 4 }
          ]
        })),
        {
          id: "shared-target",
          name: "Shared propagation target",
          position: { x: 1, y: 0 }
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo-driver",
        name: "Anemo driver",
        element: "anemo",
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
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
    },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo-driver",
      swapFrames: 1,
      abilities: sourceTargets.map((targetId, index) => ({
        id: `swirl-${index}`,
        actorId: "anemo-driver",
        name: `Swirl ${index}`,
        kind: "skill" as const,
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: `swirl-hit-${index}`,
            label: `Swirl hit ${index}`,
            frame: 0,
            scaling: 0,
            element: "anemo" as const,
            targeting: {
              targetId,
              outcome: "landed" as const
            },
            application: noIcd(1)
          }
        ]
      })),
      commands: sourceTargets.map((_targetId, index) => ({
        type: "skill" as const,
        actorId: "anemo-driver",
        abilityId: `swirl-${index}`,
        atFrame: commandFrames[index]!
      }))
    }
  };
}

function reactionApplicationProjection(
  result: SimulationResultForV148
) {
  return result.elementalApplicationIcdLog
    .filter((entry) => entry.sourceKind !== "configured-direct-hit")
    .map((entry) => {
      const decision =
        entry.decision.kind === "skipped"
          ? entry.decision
          : {
              kind: entry.decision.kind,
              evaluated: entry.decision.evaluated,
              consumed: entry.decision.consumed,
              applicationMultiplier:
                entry.decision.applicationMultiplier,
              allowed: entry.decision.allowed,
              policyId: entry.decision.policyId,
              profileId: entry.decision.profileId,
              resetFrames: entry.decision.resetFrames,
              windowStartFrame: entry.decision.windowStartFrame,
              resetAtFrame: entry.decision.resetAtFrame,
              hitIndex: entry.decision.hitIndex,
              sequenceIndex: entry.decision.sequenceIndex,
              tailPolicy: entry.decision.tailPolicy,
              resetSchedulePolicy:
                entry.decision.resetSchedulePolicy,
              scope: entry.decision.scope,
              icdTag: entry.decision.icdTag,
              groupId: entry.decision.groupId,
              windowStartGroupId:
                entry.decision.windowStartGroupId
            };
      return {
        ...entry,
        decision,
        hitOutcome:
          result.hitResolutionLog[entry.hitResolutionLogId]
            ?.outcome ?? null,
        linkedDamage:
          entry.damageEventId === null
            ? null
            : {
                id: entry.damageEventId,
                reaction:
                  result.damageEvents[entry.damageEventId]
                    ?.reaction ?? null,
                finalDamage:
                  result.damageEvents[entry.damageEventId]
                    ?.finalDamage ?? null,
                reciprocalApplicationLogId:
                  result.damageEvents[entry.damageEventId]
                    ?.elementalApplicationIcdLogId ?? null
              },
        hitReciprocalApplicationLogId:
          result.hitResolutionLog[entry.hitResolutionLogId]
            ?.elementalApplicationIcdLogId ?? null
      };
    });
}

function reactionDamageProjection(result: SimulationResultForV148) {
  return result.reactionDamageLog.map((entry) => ({
    id: entry.id,
    reaction: entry.reaction,
    sourceActorId: entry.sourceActorId,
    sourceTargetId: entry.sourceTargetId,
    damageFrame: entry.damageFrame,
    scheduled: entry.scheduled,
    withinSimulation: entry.withinSimulation,
    scheduleKind: entry.scheduleKind,
    applicationGaugeUnits: entry.applicationGaugeUnits,
    excludedTargetIds: entry.excludedTargetIds,
    checkedTargetIds: entry.checkedTargetIds,
    hitTargetIds: entry.hitTargetIds,
    unresolvedTargetIds: entry.unresolvedTargetIds,
    damageGroupBlockedTargetIds:
      entry.damageGroupBlockedTargetIds,
    damageEventIds: entry.damageEventIds,
    hitResolutionLogIds: entry.hitResolutionLogIds,
    elementalApplicationIcdLogIds:
      entry.elementalApplicationIcdLogIds
  }));
}

function burningDeliveryProjection(result: SimulationResultForV148) {
  return result.targetPhaseLog.flatMap((phase) =>
    phase.model !== "target-phase-v3"
      ? []
      : phase.targetTasks.flatMap((task) =>
          task.kind !== "burning-tick" || task.delivery === null
            ? []
            : [
                {
                  frame: phase.globalFrame,
                  ownerTargetId: phase.targetId,
                  tickIndex: task.tickIndex,
                  reactionDamageLogId:
                    task.delivery.reactionDamageLogId,
                  attempts: task.delivery.attempts
                }
              ]
        )
  );
}

function scenarioFixture(result: SimulationResultForV148) {
  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      randomSeed: result.randomSeed
    },
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      hitResolutionCount: result.hitResolutionLog.length,
      reactionDamageCount: result.reactionDamageLog.length,
      elementalApplicationCount:
        result.elementalApplicationIcdLog.length
    },
    reactionOwnedApplications:
      reactionApplicationProjection(result),
    reactionDamage: reactionDamageProjection(result),
    burningDeliveries: burningDeliveryProjection(result),
    canonicalSha256: {
      damageEvents: canonicalSha256(result.damageEvents),
      hitResolutionLog: canonicalSha256(result.hitResolutionLog),
      reactionDamageLog: canonicalSha256(result.reactionDamageLog),
      elementalApplicationIcdLog: canonicalSha256(
        result.elementalApplicationIcdLog
      ),
      targetStateTimeline: canonicalSha256(
        result.targetStateTimeline
      ),
      targetPhaseLog: canonicalSha256(result.targetPhaseLog)
    }
  };
}

function runScenarios() {
  return {
    burning: projectSimulationResultV149ToV148(
      simulate(makeBurningApplicationConfig(), {
        critMode: "noCrit",
        randomSeed: "synthetic-reaction-owned-burning-1.48"
      })
    ),
    swirl: projectSimulationResultV149ToV148(
      simulate(makeSwirlApplicationConfig(), {
        critMode: "noCrit",
        randomSeed: "synthetic-reaction-owned-swirl-1.48"
      })
    )
  };
}

function makeFixture(results: ReturnType<typeof runScenarios>) {
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Reviewed 1.48 trusted reaction-owned elemental-application vector for Burning ticks and Pyro Swirl AoE propagation.",
    provenance: {
      source:
        "Synthetic engine vector bound to genshinsim/gcsim b4ae769 Burning, Swirl, enemy attack, and target ICD source paths",
      capturedAt: "2026-08-02",
      verificationStatus: "provisional" as const,
      note:
        "This fixture validates deterministic simulator ownership, ICD state, Aura delivery, ordering, and reciprocal audit links only. It is not official server truth or complete gcsim parity, and it does not verify character data, particles, action frames, arbitrary Aura/ICD behavior, or every reaction mechanic.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const
    },
    policyRoot: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
    scenarios: {
      burning: scenarioFixture(results.burning),
      swirl: scenarioFixture(results.swirl)
    }
  };
}

function expectV148Trusted(result: SimulationResultForV148): void {
  expect(simulationResultV148Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV148(result)).toBe(result);
}

function expectBurningSemantics(result: SimulationResultForV148): void {
  const rows = result.elementalApplicationIcdLog.filter(
    (entry) => entry.sourceKind === "burning-tick"
  );
  const ownerRows = rows.filter(
    (entry) => entry.targetId === "enemy-0"
  );
  expect(ownerRows.map((entry) => entry.frame)).toEqual([
    15, 30, 45, 60, 75, 90, 105, 120, 150
  ]);
  expect(
    ownerRows.map((entry) => entry.decision.applicationMultiplier)
  ).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1]);
  expect(
    ownerRows.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.hitIndex
        : null
    )
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  expect(
    ownerRows.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.resetAtFrame
        : null
    )
  ).toEqual([134, 134, 134, 134, 134, 134, 134, 134, 269]);
  expect(
    ownerRows.every(
      (entry) =>
        entry.nominalGaugeUnits === 1 &&
        entry.selector.channel.kind === "burning-tick" &&
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.icdTag === "ICDTagBurningDamage" &&
        entry.decision.groupId === "burning" &&
        entry.decision.scope ===
          "trusted-target-global-burning-projection"
    )
  ).toBe(true);

  const farRows = rows.filter(
    (entry) => entry.targetId === "far-recipient"
  );
  expect(farRows).toHaveLength(ownerRows.length);
  expect(
    farRows.every(
      (entry) =>
        entry.damageEventId === null &&
        entry.decision.kind === "skipped" &&
        entry.decision.reason === "miss"
    )
  ).toBe(true);

  const deliveries = burningDeliveryProjection(result);
  expect(deliveries.some((entry) => entry.frame === 135)).toBe(false);
  expect(deliveries.map((entry) => entry.frame)).toEqual([
    15, 30, 45, 60, 75, 90, 105, 120, 150
  ]);
  for (const delivery of deliveries) {
    const early = delivery.attempts.find(
      (attempt) => attempt.targetId === "early-recipient"
    );
    const owner = delivery.attempts.find(
      (attempt) => attempt.targetId === "enemy-0"
    );
    const late = delivery.attempts.find(
      (attempt) => attempt.targetId === "late-recipient"
    );
    expect(early?.applicationPhase).toBe("after-reactable-tick");
    expect(owner?.applicationPhase).toBe("before-reactable-tick");
    expect(late?.applicationPhase).toBe("before-reactable-tick");
  }
}

function expectSwirlSemantics(result: SimulationResultForV148): void {
  const rows = result.elementalApplicationIcdLog.filter(
    (entry) => entry.sourceKind === "swirl-propagation"
  );
  const shared = rows.filter(
    (entry) => entry.targetId === "shared-target"
  );
  expect(shared.map((entry) => entry.frame)).toEqual([5, 11, 17, 41]);
  expect(
    shared.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.hitIndex
        : null
    )
  ).toEqual([0, 1, 2, 0]);
  expect(
    shared.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.resetAtFrame
        : null
    )
  ).toEqual([34, 34, 34, 70]);
  expect(
    shared.every(
      (entry) =>
        entry.nominalGaugeUnits === 2.2 &&
        entry.effectiveGaugeUnits === 2.2 &&
        entry.selector.channel.kind === "swirl-propagation" &&
        entry.selector.channel.element === "pyro" &&
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.allowed &&
        entry.decision.icdTag === "ICDTagSwirlPyro" &&
        entry.decision.groupId === "reaction-a" &&
        entry.decision.scope === "actor-tag"
    )
  ).toBe(true);

  const linkedDamage = shared.map((entry) =>
    entry.damageEventId === null
      ? null
      : result.damageEvents[entry.damageEventId]!.finalDamage
  );
  expect(linkedDamage[0]).toBeGreaterThan(0);
  expect(linkedDamage[1]).toBeGreaterThan(0);
  expect(linkedDamage[2]).toBe(0);
  expect(linkedDamage[3]).toBeGreaterThan(0);

  const selfLogs = result.reactionDamageLog.filter(
    (entry) => entry.scheduleKind === "swirl-self"
  );
  expect(selfLogs).toHaveLength(4);
  expect(
    selfLogs.every(
      (entry) => entry.elementalApplicationIcdLogIds.length === 0
    )
  ).toBe(true);
  for (const log of result.reactionDamageLog.filter(
    (entry) => entry.scheduleKind === "swirl-propagation"
  )) {
    expect(log.excludedTargetIds).toEqual([log.sourceTargetId]);
    expect(
      log.elementalApplicationIcdLogIds.every(
        (id) =>
          result.elementalApplicationIcdLog[id]?.targetId !==
          log.sourceTargetId
      )
    ).toBe(true);
  }
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("reaction-owned application 1.48 Golden review gate", () => {
  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V148-REACTION-APPLICATION-GOLDEN-REVIEW"
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(
      REVIEWED_FIXTURE_SHA256
    );
  });
});

describe("reaction-owned application 1.48 Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the reviewed Burning and Swirl reaction-owned application vector",
    () => {
      const results = runScenarios();
      const repeated = runScenarios();
      expect(repeated).toEqual(results);
      expectV148Trusted(results.burning);
      expectV148Trusted(results.swirl);
      expectBurningSemantics(results.burning);
      expectSwirlSemantics(results.swirl);
      expect(() =>
        projectSimulationResultV148ToV147(results.burning)
      ).toThrow(
        /without reaction-owned elemental-application rows; trusted reaction sources \(burning-tick\) have no faithful V1\.47 wire projection/
      );
      expect(() =>
        projectSimulationResultV148ToV147(results.swirl)
      ).toThrow(
        /without reaction-owned elemental-application rows; trusted reaction sources \(swirl-propagation\) have no faithful V1\.47 wire projection/
      );

      const generated = makeFixture(results);
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "reaction-owned-application-1.48.golden.json",
          policyContentHash: candidate.policyRoot.contentHash,
          burningApplicationRows:
            candidate.scenarios.burning.reactionOwnedApplications
              .length,
          swirlApplicationRows:
            candidate.scenarios.swirl.reactionOwnedApplications.length,
          burningApplicationLogCanonicalSha256:
            candidate.scenarios.burning.canonicalSha256
              .elementalApplicationIcdLog,
          swirlApplicationLogCanonicalSha256:
            candidate.scenarios.swirl.canonicalSha256
              .elementalApplicationIcdLog
        })
      });
      expect(frozen).toEqual(generated);
    }
  );
});
