import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { simulate } from "../../sim-core/src/simulator";
import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";

const PREVIEW_FLAG = "PREVIEW_BURNING_RESET_BOUNDARY_V149_GOLDEN";
const UPDATE_FLAG = "UPDATE_BURNING_RESET_BOUNDARY_V149_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "3e89c431c3b277fd1dc52881f7ea048b39060e0c16c5230af9c1a73b624e0e10";
const FIXTURE_URL = new URL(
  "../fixtures/burning-reset-boundary-1.49.golden.json",
  import.meta.url,
);

type PolicyVariant = "v1" | "v2";
type ElementalApplicationRow =
  SimulationResult["elementalApplicationIcdLog"][number];
type BurningApplicationRow = Extract<
  ElementalApplicationRow,
  { sourceKind: "burning-tick" }
>;

function isBurningApplicationRow(
  row: ElementalApplicationRow,
): row is BurningApplicationRow {
  return row.sourceKind === "burning-tick";
}

const OWNER_POSITIONS = {
  "owner-a": { x: 0.9, y: 0 },
  "owner-b": { x: -0.45, y: 0.7794228634059948 },
  "owner-c": { x: -0.45, y: -0.7794228634059948 },
} as const;

function noIcd(gaugeUnits: number) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const },
  };
}

/**
 * A/B/C are three real target-owned Burning streams. Their 0.2U Dendro
 * starts create only one tick each: F15, F134, and F135. Every owner is 0.9m
 * from the shared recipient while owners are >1m apart, so no owner can
 * accidentally start or refresh a sibling stream through the 1m Burning AoE.
 */
function makeBoundaryConfig(policy: PolicyVariant): SimConfig {
  const base = makeConfig();
  const starts = [
    { ownerId: "owner-a", frame: 0 },
    { ownerId: "owner-b", frame: 119 },
    { ownerId: "owner-c", frame: 120 },
  ] as const;
  const reactionOwnedElementalApplicationModel =
    policy === "v1"
      ? {
          mode: "fixed-gcsim-reaction-owned-application-v1" as const,
          policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
        }
      : {
          mode: "fixed-gcsim-reaction-owned-application-v2" as const,
          policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
        };

  return {
    ...base,
    dataVersion: "synthetic-burning-reset-boundary-1.49",
    randomSeed: "synthetic-burning-reset-boundary-1.49",
    meta: {
      name: "Burning reset boundary v1/v2 comparison",
      version: "1.49.0",
      verificationStatus: "provisional",
    },
    duration: 140 / 60,
    cycleLength: 140 / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Shared Burning recipient",
          position: { x: 0, y: 0 },
        },
        ...Object.entries(OWNER_POSITIONS).map(([id, position]) => ({
          id,
          name: id,
          position,
          initialAura: [{ element: "pyro" as const, gaugeUnits: 4 }],
        })),
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "dendro-driver",
        name: "Dendro driver",
        element: "dendro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
    reactionOwnedElementalApplicationModel,
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "dendro-driver",
      swapFrames: 1,
      abilities: starts.map(({ ownerId }) => ({
        id: `start-${ownerId}`,
        actorId: "dendro-driver",
        name: `Start ${ownerId} Burning`,
        kind: "skill" as const,
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: `start-${ownerId}-hit`,
            label: `Start ${ownerId} hit`,
            frame: 0,
            scaling: 0,
            element: "dendro" as const,
            targeting: {
              targetId: ownerId,
              outcome: "landed" as const,
            },
            application: noIcd(0.2),
          },
        ],
      })),
      commands: starts.map(({ ownerId, frame }) => ({
        type: "skill" as const,
        actorId: "dendro-driver",
        abilityId: `start-${ownerId}`,
        atFrame: frame,
      })),
    },
  };
}

function findDeliveryAttempt(
  result: SimulationResult,
  reactionDamageLogId: number,
  targetId: string,
) {
  for (const phase of result.targetPhaseLog) {
    if (phase.model !== "target-phase-v3") continue;
    for (const task of phase.targetTasks) {
      if (
        task.kind !== "burning-tick" ||
        task.delivery?.reactionDamageLogId !== reactionDamageLogId
      ) {
        continue;
      }
      const attempt = task.delivery.attempts.find(
        (candidate) => candidate.targetId === targetId,
      );
      if (attempt !== undefined) {
        return {
          phaseFrame: phase.globalFrame,
          ownerTargetId: phase.targetId,
          tickIndex: task.tickIndex,
          deliveryEventPriority: task.delivery.eventPriority,
          deliveryEventSequence: task.delivery.eventSequence,
          attempt,
        };
      }
    }
  }
  throw new Error(
    `Missing Burning delivery ${reactionDamageLogId} attempt for ${targetId}.`,
  );
}

function reactionOwnedApplicationProjection(result: SimulationResult) {
  return result.elementalApplicationIcdLog
    .filter(isBurningApplicationRow)
    .map((row) => {
      const reaction = result.reactionDamageLog[row.reactionDamageLogId]!;
      const hit = result.hitResolutionLog[row.hitResolutionLogId]!;
      const damage =
        row.damageEventId === null
          ? null
          : result.damageEvents[row.damageEventId]!;
      const delivery = findDeliveryAttempt(
        result,
        row.reactionDamageLogId,
        row.targetId,
      );
      return {
        id: row.id,
        sourceKind: row.sourceKind,
        frame: row.frame,
        sourceActorId: row.sourceActorId,
        sourceTargetId: reaction.sourceTargetId,
        targetId: row.targetId,
        reactionDamageLogId: row.reactionDamageLogId,
        hitResolutionLogId: row.hitResolutionLogId,
        damageEventId: row.damageEventId,
        eventPriority: row.eventPriority,
        eventSequence: row.eventSequence,
        attemptIndex: row.attemptIndex,
        attemptCount: row.attemptCount,
        deliveryPhase: row.deliveryPhase,
        selector: row.selector,
        nominalGaugeUnits: row.nominalGaugeUnits,
        effectiveGaugeUnits: row.effectiveGaugeUnits,
        decision: row.decision,
        backlinks: {
          reactionDamageEventIds: reaction.damageEventIds,
          reactionHitResolutionLogIds: reaction.hitResolutionLogIds,
          reactionElementalApplicationIcdLogIds:
            reaction.elementalApplicationIcdLogIds,
          hitOutcome: hit.outcome,
          hitDamageEventId: hit.damageEventId,
          hitReactionDamageLogId: hit.reactionDamageLogId,
          hitElementalApplicationIcdLogId: hit.elementalApplicationIcdLogId,
          damageTargetResolutionId: damage?.targetResolutionId ?? null,
          damageElementalApplicationIcdLogId:
            damage?.elementalApplicationIcdLogId ?? null,
          targetPhase: delivery,
        },
      };
    });
}

function reactionDamageProjection(result: SimulationResult) {
  return result.reactionDamageLog
    .filter((row) => row.scheduleKind === "burning-tick")
    .map((row) => ({
      id: row.id,
      sourceActorId: row.sourceActorId,
      sourceTargetId: row.sourceTargetId,
      triggerFrame: row.triggerFrame,
      damageFrame: row.damageFrame,
      checkedTargetIds: row.checkedTargetIds,
      hitTargetIds: row.hitTargetIds,
      unresolvedTargetIds: row.unresolvedTargetIds,
      damageEventIds: row.damageEventIds,
      hitResolutionLogIds: row.hitResolutionLogIds,
      elementalApplicationIcdLogIds: row.elementalApplicationIcdLogIds,
    }));
}

function scenarioFixture(result: SimulationResult) {
  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      randomSeed: result.randomSeed,
      selectedModel: result.config.reactionOwnedElementalApplicationModel,
      manifestPolicyRoot:
        result.runManifest.reactionOwnedElementalApplicationRoot,
    },
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      hitResolutionCount: result.hitResolutionLog.length,
      reactionDamageCount: result.reactionDamageLog.length,
      elementalApplicationCount: result.elementalApplicationIcdLog.length,
    },
    reactionOwnedApplications: reactionOwnedApplicationProjection(result),
    reactionDamage: reactionDamageProjection(result),
    canonicalSha256: {
      damageEvents: canonicalSha256(result.damageEvents),
      hitResolutionLog: canonicalSha256(result.hitResolutionLog),
      reactionDamageLog: canonicalSha256(result.reactionDamageLog),
      elementalApplicationIcdLog: canonicalSha256(
        result.elementalApplicationIcdLog,
      ),
      targetStateTimeline: canonicalSha256(result.targetStateTimeline),
      targetPhaseLog: canonicalSha256(result.targetPhaseLog),
    },
  };
}

function runScenarios() {
  return {
    v1Compatibility: simulate(makeBoundaryConfig("v1"), {
      critMode: "noCrit",
      randomSeed: "synthetic-burning-reset-boundary-1.49",
    }),
    v2Corrected: simulate(makeBoundaryConfig("v2"), {
      critMode: "noCrit",
      randomSeed: "synthetic-burning-reset-boundary-1.49",
    }),
  };
}

function makeFixture(results: ReturnType<typeof runScenarios>) {
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Candidate 1.49 Burning reset-boundary Golden comparing frozen v1 reset-before-attempt compatibility with provisional v2 attempt-before-core-reset behavior.",
    provenance: {
      source:
        "Synthetic reachable engine vector bound to genshinsim/gcsim b4ae769 Burning, enemy-task, core-task, attack, and target-ICD source paths",
      capturedAt: "2026-08-02",
      verificationStatus: "provisional" as const,
      note: "This candidate audits one channel-specific same-frame ordering boundary. The v2 policy is a source-derived provisional simulator interpretation, not official server truth or complete gcsim parity. It does not verify arbitrary Aura/ICD, character data, particles, action frames, or every reaction mechanic.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    geometry: {
      burningRadius: 1,
      recipientPosition: { x: 0, y: 0 },
      ownerPositions: OWNER_POSITIONS,
      ownerPairwiseDistanceGreaterThanRadius: true,
    },
    expectedBoundary: {
      firstApplication: {
        sourceTargetId: "owner-a",
        frame: 15,
        resetAtFrame: 134,
      },
      exactBoundaryAttempt: {
        sourceTargetId: "owner-b",
        frame: 134,
      },
      firstPostBoundaryAttempt: {
        sourceTargetId: "owner-c",
        frame: 135,
      },
      v1CompatibilityAllowed: [true, true, false],
      v2CorrectedAllowed: [true, false, true],
    },
    policyRoots: {
      v1: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
      v2: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT,
    },
    scenarios: {
      v1Compatibility: scenarioFixture(results.v1Compatibility),
      v2Corrected: scenarioFixture(results.v2Corrected),
    },
  };
}

function expectCurrentTrusted(result: SimulationResult): void {
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
}

function expectReciprocalBacklinks(result: SimulationResult): void {
  const rows = result.elementalApplicationIcdLog.filter(
    isBurningApplicationRow,
  );
  expect(rows).toHaveLength(12);
  for (const row of rows) {
    const reaction = result.reactionDamageLog[row.reactionDamageLogId]!;
    const hit = result.hitResolutionLog[row.hitResolutionLogId]!;
    const delivery = findDeliveryAttempt(
      result,
      row.reactionDamageLogId,
      row.targetId,
    );
    expect(reaction.elementalApplicationIcdLogIds).toContain(row.id);
    expect(reaction.hitResolutionLogIds).toContain(row.hitResolutionLogId);
    expect(hit.reactionDamageLogId).toBe(row.reactionDamageLogId);
    expect(hit.elementalApplicationIcdLogId).toBe(row.id);
    expect(delivery.attempt.elementalApplicationIcdLogId).toBe(row.id);
    expect(delivery.attempt.hitResolutionLogId).toBe(row.hitResolutionLogId);
    if (row.damageEventId === null) {
      expect(hit.damageEventId).toBeNull();
      expect(delivery.attempt.outcome).toBe("miss");
      expect(delivery.attempt.damageEventId).toBeNull();
    } else {
      const damage = result.damageEvents[row.damageEventId]!;
      expect(hit.damageEventId).toBe(row.damageEventId);
      expect(damage.targetResolutionId).toBe(row.hitResolutionLogId);
      expect(damage.elementalApplicationIcdLogId).toBe(row.id);
      expect(reaction.damageEventIds).toContain(row.damageEventId);
      expect(delivery.attempt.outcome).toBe("landed");
      expect(delivery.attempt.damageEventId).toBe(row.damageEventId);
    }
  }
}

function expectBoundarySemantics(
  result: SimulationResult,
  policy: PolicyVariant,
): void {
  const expectedRoot =
    policy === "v1"
      ? GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT
      : GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT;
  expect(result.runManifest.reactionOwnedElementalApplicationRoot).toEqual(
    expectedRoot,
  );

  const positions = Object.values(OWNER_POSITIONS);
  for (const position of positions) {
    expect(Math.hypot(position.x, position.y)).toBeLessThanOrEqual(1);
  }
  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      expect(
        Math.hypot(
          positions[left]!.x - positions[right]!.x,
          positions[left]!.y - positions[right]!.y,
        ),
      ).toBeGreaterThan(1);
    }
  }

  const deliveries = result.reactionDamageLog.filter(
    (row) => row.scheduleKind === "burning-tick",
  );
  expect(deliveries.map((row) => row.damageFrame)).toEqual([15, 134, 135]);
  expect(deliveries.map((row) => row.sourceTargetId)).toEqual([
    "owner-a",
    "owner-b",
    "owner-c",
  ]);

  const rows = result.elementalApplicationIcdLog
    .filter(
      (row): row is BurningApplicationRow =>
        isBurningApplicationRow(row) && row.targetId === "enemy-0",
    )
    .map((row) => ({
      row,
      sourceTargetId:
        result.reactionDamageLog[row.reactionDamageLogId]!.sourceTargetId,
    }));
  expect(rows.map(({ row }) => row.frame)).toEqual([15, 134, 135]);
  expect(rows.map(({ sourceTargetId }) => sourceTargetId)).toEqual([
    "owner-a",
    "owner-b",
    "owner-c",
  ]);
  expect(
    rows.map(({ row }) =>
      row.decision.kind === "reaction-fixed-gcsim"
        ? row.decision.allowed
        : null,
    ),
  ).toEqual(policy === "v1" ? [true, true, false] : [true, false, true]);
  expect(
    rows.map(({ row }) =>
      row.decision.kind === "reaction-fixed-gcsim"
        ? row.decision.hitIndex
        : null,
    ),
  ).toEqual(policy === "v1" ? [0, 0, 1] : [0, 1, 0]);
  expect(
    rows.map(({ row }) =>
      row.decision.kind === "reaction-fixed-gcsim"
        ? row.decision.resetAtFrame
        : null,
    ),
  ).toEqual(policy === "v1" ? [134, 253, 253] : [134, 134, 254]);
  expect(rows.map(({ row }) => row.effectiveGaugeUnits)).toEqual(
    policy === "v1" ? [1, 1, 0] : [1, 0, 1],
  );
  expect(
    rows.map(({ row }) =>
      row.decision.kind === "reaction-fixed-gcsim"
        ? row.decision.policyId
        : null,
    ),
  ).toEqual(
    Array(3).fill(
      policy === "v1"
        ? GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
        : GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
    ),
  );
  expect(
    rows.map(({ row }) =>
      row.decision.kind === "reaction-fixed-gcsim"
        ? row.decision.resetSchedulePolicy
        : null,
    ),
  ).toEqual(
    Array(3).fill(
      policy === "v1"
        ? "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
        : "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one",
    ),
  );
  expect(rows.map(({ row }) => row.selector.mode)).toEqual(
    Array(3).fill(
      policy === "v1"
        ? "fixed-gcsim-reaction-owned-application-v1"
        : "fixed-gcsim-reaction-owned-application-v2",
    ),
  );
  for (const { row } of rows) {
    expect(row.damageEventId).not.toBeNull();
    expect(
      result.damageEvents[row.damageEventId!]!.finalDamage,
    ).toBeGreaterThan(0);
  }
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("Burning reset boundary 1.49 Golden review gate", () => {
  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V149-BURNING-RESET-BOUNDARY-GOLDEN-REVIEW",
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(REVIEWED_FIXTURE_SHA256);
  });
});

describe("Burning reset boundary 1.49 Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the reviewed v1/v2 Burning reset-boundary comparison vector",
    () => {
      const results = runScenarios();
      const repeated = runScenarios();
      expect(repeated).toEqual(results);

      for (const result of Object.values(results)) {
        expectCurrentTrusted(result);
        expectReciprocalBacklinks(result);
      }
      expectBoundarySemantics(results.v1Compatibility, "v1");
      expectBoundarySemantics(results.v2Corrected, "v2");

      const generated = makeFixture(results);
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "burning-reset-boundary-1.49.golden.json",
          v1PolicyContentHash: candidate.policyRoots.v1.contentHash,
          v2PolicyContentHash: candidate.policyRoots.v2.contentHash,
          v1ConfigHash:
            candidate.scenarios.v1Compatibility.identity.configHash,
          v2ConfigHash: candidate.scenarios.v2Corrected.identity.configHash,
          v1ReproducibilityKey:
            candidate.scenarios.v1Compatibility.identity.reproducibilityKey,
          v2ReproducibilityKey:
            candidate.scenarios.v2Corrected.identity.reproducibilityKey,
          v1RecipientAllowed:
            candidate.scenarios.v1Compatibility.reactionOwnedApplications
              .filter((row) => row.targetId === "enemy-0")
              .map((row) =>
                row.decision.kind === "reaction-fixed-gcsim"
                  ? row.decision.allowed
                  : null,
              ),
          v2RecipientAllowed:
            candidate.scenarios.v2Corrected.reactionOwnedApplications
              .filter((row) => row.targetId === "enemy-0")
              .map((row) =>
                row.decision.kind === "reaction-fixed-gcsim"
                  ? row.decision.allowed
                  : null,
              ),
          v1ApplicationLogCanonicalSha256:
            candidate.scenarios.v1Compatibility.canonicalSha256
              .elementalApplicationIcdLog,
          v2ApplicationLogCanonicalSha256:
            candidate.scenarios.v2Corrected.canonicalSha256
              .elementalApplicationIcdLog,
        }),
      });
      expect(frozen).toEqual(generated);
    },
  );
});
