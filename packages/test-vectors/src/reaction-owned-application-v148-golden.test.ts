import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimulationResult,
  assertTrustedSimulationResultV148,
  simulationResultV148Schema,
  type SimConfig,
  type SimulationResultForV148,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { simulate } from "../../sim-core/src/simulator";
import { parseEventStepResult, simulateEventStepResult } from "../../sim-core/src/event-step-result";
import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";
import { projectSimulationResultV148ToV147 } from "./project-v148-to-v147";
import { projectSimulationResultV149ToV148 } from "./project-v149-to-v148";
import { projectSimulationResultV150ToV149 } from "./project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "./project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "./project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";
import { withV152CompatibilityPolicies } from "./v152-compatibility-config";

const PREVIEW_FLAG = "PREVIEW_REACTION_OWNED_APPLICATION_V148_GOLDEN";
const UPDATE_FLAG = "UPDATE_REACTION_OWNED_APPLICATION_V148_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "704c5db38dda87802aa000d664812b63673ea9498981ed21f26a21eac5c620bd";
const FIXTURE_URL = new URL(
  "../fixtures/reaction-owned-application-1.48.golden.json",
  import.meta.url,
);

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const },
  };
}

function makeBurningApplicationConfig(): SimConfig {
  const base = withV152CompatibilityPolicies(
    makeConfig({
      basicReactionSchedulerModel: {
        mode: "legacy-immediate-basic-reaction-scheduler-v1",
        policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
      },
    }),
  );
  const durationFrames = 162;
  return {
    ...base,
    dataVersion: "synthetic-reaction-owned-burning-1.48",
    randomSeed: "synthetic-reaction-owned-burning-1.48",
    meta: {
      name: "Reaction-owned Burning application vector",
      version: "1.48.0",
      verificationStatus: "provisional",
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
          position: { x: 0.8, y: 0 },
        },
        {
          id: "enemy-0",
          name: "Burning owner",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 4 }],
        },
        {
          id: "late-recipient",
          name: "Late recipient",
          position: { x: -0.8, y: 0 },
        },
        {
          id: "far-recipient",
          name: "Far recipient",
          position: { x: 3, y: 0 },
        },
      ],
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
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
    },
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
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
                radius: 0.1,
              },
              application: noIcd(1),
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro-driver",
          abilityId: "start-burning",
          atFrame: 0,
        },
      ],
    },
  };
}

function makeSwirlApplicationConfig(): SimConfig {
  const base = withV152CompatibilityPolicies(
    makeConfig({
      basicReactionSchedulerModel: {
        mode: "legacy-immediate-basic-reaction-scheduler-v1",
        policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
      },
    }),
  );
  const sourceTargets = [
    "enemy-0",
    "swirl-source-1",
    "swirl-source-2",
    "swirl-source-3",
  ] as const;
  const commandFrames = [0, 6, 12, 36] as const;
  return {
    ...base,
    dataVersion: "synthetic-reaction-owned-swirl-1.48",
    randomSeed: "synthetic-reaction-owned-swirl-1.48",
    meta: {
      name: "Reaction-owned Swirl application vector",
      version: "1.48.0",
      verificationStatus: "provisional",
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
          initialAura: [{ element: "pyro" as const, gaugeUnits: 4 }],
        })),
        {
          id: "shared-target",
          name: "Shared propagation target",
          position: { x: 1, y: 0 },
        },
      ],
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
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
    },
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
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
              outcome: "landed" as const,
            },
            application: noIcd(1),
          },
        ],
      })),
      commands: sourceTargets.map((_targetId, index) => ({
        type: "skill" as const,
        actorId: "anemo-driver",
        abilityId: `swirl-${index}`,
        atFrame: commandFrames[index]!,
      })),
    },
  };
}

function reactionApplicationProjection(result: SimulationResultForV148) {
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
              applicationMultiplier: entry.decision.applicationMultiplier,
              allowed: entry.decision.allowed,
              policyId: entry.decision.policyId,
              profileId: entry.decision.profileId,
              resetFrames: entry.decision.resetFrames,
              windowStartFrame: entry.decision.windowStartFrame,
              resetAtFrame: entry.decision.resetAtFrame,
              hitIndex: entry.decision.hitIndex,
              sequenceIndex: entry.decision.sequenceIndex,
              tailPolicy: entry.decision.tailPolicy,
              resetSchedulePolicy: entry.decision.resetSchedulePolicy,
              scope: entry.decision.scope,
              icdTag: entry.decision.icdTag,
              groupId: entry.decision.groupId,
              windowStartGroupId: entry.decision.windowStartGroupId,
            };
      return {
        ...entry,
        decision,
        hitOutcome:
          result.hitResolutionLog[entry.hitResolutionLogId]?.outcome ?? null,
        linkedDamage:
          entry.damageEventId === null
            ? null
            : {
                id: entry.damageEventId,
                reaction:
                  result.damageEvents[entry.damageEventId]?.reaction ?? null,
                finalDamage:
                  result.damageEvents[entry.damageEventId]?.finalDamage ?? null,
                reciprocalApplicationLogId:
                  result.damageEvents[entry.damageEventId]
                    ?.elementalApplicationIcdLogId ?? null,
              },
        hitReciprocalApplicationLogId:
          result.hitResolutionLog[entry.hitResolutionLogId]
            ?.elementalApplicationIcdLogId ?? null,
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
    damageGroupBlockedTargetIds: entry.damageGroupBlockedTargetIds,
    damageEventIds: entry.damageEventIds,
    hitResolutionLogIds: entry.hitResolutionLogIds,
    elementalApplicationIcdLogIds: entry.elementalApplicationIcdLogIds,
  }));
}

function burningDeliveryProjection(result: SimulationResultForV148 | SimulationResult) {
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
                  reactionDamageLogId: task.delivery.reactionDamageLogId,
                  attempts: task.delivery.attempts,
                },
              ],
        ),
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
      randomSeed: result.randomSeed,
    },
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      hitResolutionCount: result.hitResolutionLog.length,
      reactionDamageCount: result.reactionDamageLog.length,
      elementalApplicationCount: result.elementalApplicationIcdLog.length,
    },
    reactionOwnedApplications: reactionApplicationProjection(result),
    reactionDamage: reactionDamageProjection(result),
    burningDeliveries: burningDeliveryProjection(result),
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

type OwnedCase = "burning" | "swirl";
const HISTORICAL_URL = new URL("./fixtures/historical-reaction-owned-application-v153-84ff5cd.json", import.meta.url);
function readHistoricalOwned(): Record<OwnedCase, SimulationResult> {
  const bytes = readFileSync(HISTORICAL_URL);
  expect(byteSha256(bytes)).toBe("f533e25c7c6c8aedc67c36b212c966e9f8a9736ea33f7e8185b5a99f8fc157d7");
  const archive = JSON.parse(bytes.toString("utf8")) as { fixtureVersion: string; source: { commit: string; tree: string }; cases: Array<{caseId: OwnedCase; sourceWireText: string; sourceWireSha256: string}> };
  expect(archive).toMatchObject({fixtureVersion:"historical-reaction-owned-application-v153-84ff5cd-v1",source:{commit:"84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5",tree:"72bd69a8c54a3e115685c7ee52f5862064c70f55"}});
  expect(archive.cases.map(row=>row.caseId)).toEqual(["burning","swirl"]);
  expect(archive.cases.map(row=>row.sourceWireSha256)).toEqual(["7b45cd656034b605f004c065ae075cf577ae9f0a20cc4665438219efab82d6ec","74572c25cc35f6e4fec46f841e7432f1014f7f1661a966c37934f6c775bb1367"]);
  const result = {} as Record<OwnedCase,SimulationResult>;
  for(const row of archive.cases){expect(byteSha256(Buffer.from(row.sourceWireText))).toBe(row.sourceWireSha256);result[row.caseId]=JSON.parse(row.sourceWireText) as SimulationResult;expect(result[row.caseId].resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");expect(result[row.caseId].runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");}
  return result;
}
function runCurrentOwned(): Record<OwnedCase,SimulationResult> {
  return {burning:simulate(makeBurningApplicationConfig(),{critMode:"noCrit",randomSeed:"synthetic-reaction-owned-burning-1.48"}),swirl:simulate(makeSwirlApplicationConfig(),{critMode:"noCrit",randomSeed:"synthetic-reaction-owned-swirl-1.48"})};
}
function historicalProjection(result: SimulationResult): SimulationResultForV148 {
  return projectSimulationResultV149ToV148(projectSimulationResultV150ToV149(projectSimulationResultV151ToV150(projectSimulationResultV152ToV151(projectSimulationResultV153ToV152(result)))));
}
function runScenarios() {
  const original=readHistoricalOwned();
  return {burning:historicalProjection(original.burning),swirl:historicalProjection(original.swirl)};
}
/** Expected-only migration of thirteen source-proven identity/allocation fields.
 * Never transform actual output, delete fields or rename any queue/reference ID. */
function expectedCurrentOwned(): Record<OwnedCase,SimulationResult> {
  const result=readHistoricalOwned();
  for(const [key,reproducibilityKey,points] of [["burning","gdl-v2-fnv1a32-d7f07422",[4]],["swirl","gdl-v2-fnv1a32-bf7e6e5a",[5,11,17,23]]] as const){
    const r=result[key];r.resolvedRuntimeOptions.flatStatBuffSemantics="canonical-v1";r.runManifest.resolvedRuntimeOptions.flatStatBuffSemantics="canonical-v1";r.reproducibilityKey=reproducibilityKey;r.runManifest.reproducibilityKey=reproducibilityKey;
    for(const index of points){const point=r.targetStateTimeline.points[index]!;expect(point).toMatchObject({cause:"direct-hit-application",intraEventSequence:0});point.intraEventSequence=1;}
  }
  return result;
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
      note: "This fixture validates deterministic simulator ownership, ICD state, Aura delivery, ordering, and reciprocal audit links only. It is not official server truth or complete gcsim parity, and it does not verify character data, particles, action frames, arbitrary Aura/ICD behavior, or every reaction mechanic.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    policyRoot: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
    scenarios: {
      burning: scenarioFixture(results.burning),
      swirl: scenarioFixture(results.swirl),
    },
  };
}

function expectV148Trusted(result: SimulationResultForV148): void {
  expect(simulationResultV148Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV148(result)).toBe(result);
}

function expectBurningSemantics(result: SimulationResultForV148 | SimulationResult): void {
  const rows = result.elementalApplicationIcdLog.filter(
    (entry) => entry.sourceKind === "burning-tick",
  );
  const ownerRows = rows.filter((entry) => entry.targetId === "enemy-0");
  expect(ownerRows.map((entry) => entry.frame)).toEqual([
    15, 30, 45, 60, 75, 90, 105, 120, 150,
  ]);
  expect(
    ownerRows.map((entry) => entry.decision.applicationMultiplier),
  ).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1]);
  expect(
    ownerRows.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.hitIndex
        : null,
    ),
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  expect(
    ownerRows.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.resetAtFrame
        : null,
    ),
  ).toEqual([134, 134, 134, 134, 134, 134, 134, 134, 269]);
  expect(
    ownerRows.every(
      (entry) =>
        entry.nominalGaugeUnits === 1 &&
        entry.selector.mode === "fixed-gcsim-reaction-owned-application-v1" &&
        entry.selector.channel.kind === "burning-tick" &&
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.icdTag === "ICDTagBurningDamage" &&
        entry.decision.groupId === "burning" &&
        entry.decision.scope === "trusted-target-global-burning-projection",
    ),
  ).toBe(true);

  const farRows = rows.filter((entry) => entry.targetId === "far-recipient");
  expect(farRows).toHaveLength(ownerRows.length);
  expect(
    farRows.every(
      (entry) =>
        entry.damageEventId === null &&
        entry.decision.kind === "skipped" &&
        entry.decision.reason === "miss",
    ),
  ).toBe(true);

  const deliveries = burningDeliveryProjection(result);
  expect(deliveries.some((entry) => entry.frame === 135)).toBe(false);
  expect(deliveries.map((entry) => entry.frame)).toEqual([
    15, 30, 45, 60, 75, 90, 105, 120, 150,
  ]);
  for (const delivery of deliveries) {
    const early = delivery.attempts.find(
      (attempt) => attempt.targetId === "early-recipient",
    );
    const owner = delivery.attempts.find(
      (attempt) => attempt.targetId === "enemy-0",
    );
    const late = delivery.attempts.find(
      (attempt) => attempt.targetId === "late-recipient",
    );
    expect(early?.applicationPhase).toBe("after-reactable-tick");
    expect(owner?.applicationPhase).toBe("before-reactable-tick");
    expect(late?.applicationPhase).toBe("before-reactable-tick");
  }
}

function expectSwirlSemantics(result: SimulationResultForV148 | SimulationResult): void {
  const rows = result.elementalApplicationIcdLog.filter(
    (entry) => entry.sourceKind === "swirl-propagation",
  );
  const shared = rows.filter((entry) => entry.targetId === "shared-target");
  expect(shared.map((entry) => entry.frame)).toEqual([5, 11, 17, 41]);
  expect(
    shared.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.hitIndex
        : null,
    ),
  ).toEqual([0, 1, 2, 0]);
  expect(
    shared.map((entry) =>
      entry.decision.kind === "reaction-fixed-gcsim"
        ? entry.decision.resetAtFrame
        : null,
    ),
  ).toEqual([34, 34, 34, 70]);
  expect(
    shared.every(
      (entry) =>
        entry.nominalGaugeUnits === 2.2 &&
        entry.effectiveGaugeUnits === 2.2 &&
        entry.selector.mode === "fixed-gcsim-reaction-owned-application-v1" &&
        entry.selector.channel.kind === "swirl-propagation" &&
        entry.selector.channel.element === "pyro" &&
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.allowed &&
        entry.decision.icdTag === "ICDTagSwirlPyro" &&
        entry.decision.groupId === "reaction-a" &&
        entry.decision.scope === "actor-tag",
    ),
  ).toBe(true);

  const linkedDamage = shared.map((entry) =>
    entry.damageEventId === null
      ? null
      : result.damageEvents[entry.damageEventId]!.finalDamage,
  );
  expect(linkedDamage[0]).toBeGreaterThan(0);
  expect(linkedDamage[1]).toBeGreaterThan(0);
  expect(linkedDamage[2]).toBe(0);
  expect(linkedDamage[3]).toBeGreaterThan(0);

  const selfLogs = result.reactionDamageLog.filter(
    (entry) => entry.scheduleKind === "swirl-self",
  );
  expect(selfLogs).toHaveLength(4);
  expect(
    selfLogs.every((entry) => entry.elementalApplicationIcdLogIds.length === 0),
  ).toBe(true);
  for (const log of result.reactionDamageLog.filter(
    (entry) => entry.scheduleKind === "swirl-propagation",
  )) {
    expect(log.excludedTargetIds).toEqual([log.sourceTargetId]);
    expect(
      log.elementalApplicationIcdLogIds.every(
        (id) =>
          result.elementalApplicationIcdLog[id]?.targetId !==
          log.sourceTargetId,
      ),
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
        "PENDING-V148-REACTION-APPLICATION-GOLDEN-REVIEW",
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(REVIEWED_FIXTURE_SHA256);
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
      expect(() => projectSimulationResultV148ToV147(results.burning)).toThrow(
        /without reaction-owned elemental-application rows; trusted reaction sources \(burning-tick\) have no faithful V1\.47 wire projection/,
      );
      expect(() => projectSimulationResultV148ToV147(results.swirl)).toThrow(
        /without reaction-owned elemental-application rows; trusted reaction sources \(swirl-propagation\) have no faithful V1\.47 wire projection/,
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
            candidate.scenarios.burning.reactionOwnedApplications.length,
          swirlApplicationRows:
            candidate.scenarios.swirl.reactionOwnedApplications.length,
          burningApplicationLogCanonicalSha256:
            candidate.scenarios.burning.canonicalSha256
              .elementalApplicationIcdLog,
          swirlApplicationLogCanonicalSha256:
            candidate.scenarios.swirl.canonicalSha256
              .elementalApplicationIcdLog,
        }),
      });
      expect(frozen).toEqual(generated);
    },
  );
});

describe("current reaction-owned Burning and Swirl contracts",()=>{
  it("preserves complete current wires and independent target-owned numerical/causal outcomes",()=>{
    const results=runCurrentOwned();expect(runCurrentOwned()).toStrictEqual(results);expect(results).toStrictEqual(expectedCurrentOwned());
    for(const r of Object.values(results)){expect(simulationResultSchema.parse(r)).toEqual(r);expect(assertTrustedSimulationResult(r)).toBe(r);}
    expectBurningSemantics(results.burning);expectSwirlSemantics(results.swirl);
    // Fixed level90 curve, actual EM100/bonus.2/resistance.1; Burning .25 and Swirl .6.
    const factor=1446.8535*(1+16*100/2100+.2)*.9,burningTick=.25*factor,swirlHit=.6*factor;
    expect(results.burning.damageEvents).toHaveLength(28);expect(results.swirl.damageEvents).toHaveLength(24);
    results.burning.damageEvents.forEach((row,index)=>expect(row.finalDamage).toBeCloseTo(index===0?0:burningTick,10));expect(results.burning.totalDamage).toBeCloseTo(27*burningTick,9);
    const swirlZero=[0,6,12,13,14,15,16,17,18];results.swirl.damageEvents.forEach((row,index)=>expect(row.finalDamage).toBeCloseTo(swirlZero.includes(index)?0:swirlHit,10));expect(results.swirl.totalDamage).toBeCloseTo(15*swirlHit,9);
    expect(results.swirl.damageEvents.map(row=>row.frame)).toEqual([0,1,5,5,5,5,6,7,11,11,11,11,12,13,17,17,17,17,36,37,41,41,41,41]);
    // Target-owned Burning's late frame135 slot is absent; three actual nearby recipients per retained tick.
    expect(results.burning.damageEvents.slice(1).map(row=>row.frame)).toEqual([15,30,45,60,75,90,105,120,150].flatMap(frame=>[frame,frame,frame]));
    expect(results.burning.damageEvents.slice(1).map(row=>row.targetId)).toEqual(Array.from({length:9},()=>["early-recipient","enemy-0","late-recipient"]).flat());
    const coordinates={burning:[[4,1,0,2,0]],swirl:[[5,0,0,4,0],[11,6,6,22,6],[17,12,12,40,12],[23,18,36,58,18]]} as const;
    for(const key of ["burning","swirl"] as const)for(const [pointId,hitId,frame,sequence,damageId] of coordinates[key]){
      expect(results[key].targetStateTimeline.points[pointId]).toMatchObject({cause:"direct-hit-application",frame,eventPriority:3,eventSequence:sequence,intraEventSequence:1,primaryDamageEventId:damageId});
      expect(results[key].hitResolutionLog[hitId]).toMatchObject({frame,eventPriority:3,eventSequence:sequence,intraEventSequence:0,damageEventId:damageId});
    }
  });
  it("refuses current canonical projection without mutating it while genuine history reproduces the frozen Golden",()=>{
    const current=runCurrentOwned(),before=structuredClone(current);for(const r of Object.values(current))expect(()=>historicalProjection(r)).toThrow(/flatStatBuffSemantics/);expect(current).toStrictEqual(before);
    expect(makeFixture(runScenarios())).toStrictEqual(JSON.parse(readFileSync(FIXTURE_URL,"utf8")));
  });
  it.each(["burning","swirl"] as const)("%s keeps direct substep chronology in the current oracle and real1.54 witness",key=>{
    const current=runCurrentOwned()[key],pointId=key==="burning"?4:5,forged=structuredClone(current);forged.targetStateTimeline.points[pointId]!.intraEventSequence=0;
    // Legacy1.53 does not attest this allocation index;1.54 carries actual witnesses.
    expect(simulationResultSchema.parse(forged)).toEqual(forged);expect(()=>expect(forged).toStrictEqual(expectedCurrentOwned()[key])).toThrow();
    const captured=simulateEventStepResult(key==="burning"?makeBurningApplicationConfig():makeSwirlApplicationConfig(),{critMode:"noCrit",randomSeed:`synthetic-reaction-owned-${key}-1.48`});
    const before=structuredClone(captured.wire),parsed=parseEventStepResult(JSON.parse(JSON.stringify(captured.wire)));expect(parsed.result.damageEvents).toStrictEqual(current.damageEvents);expect(parsed.result.targetStateTimeline).toStrictEqual(current.targetStateTimeline);
    const bad=structuredClone(captured.wire);bad.result.targetStateTimeline.points[pointId]!.intraEventSequence=0;expect(()=>parseEventStepResult(JSON.parse(JSON.stringify(bad)))).toThrow();expect(captured.wire).toStrictEqual(before);
  });
  for(const key of ["burning","swirl"] as const)it.each(["application-hit","hit-application","damage-hit","application-damage"] as const)(`${key}: public parser rejects forged %s`,mutation=>{
    const original=runCurrentOwned()[key];expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(original)))).toEqual(original);
    const forged=structuredClone(original);const row=forged.elementalApplicationIcdLog.find(entry=>entry.sourceKind===(key==="burning"?"burning-tick":"swirl-propagation")&&entry.damageEventId!==null)!;
    if(mutation==="application-hit")row.hitResolutionLogId=0;
    if(mutation==="hit-application")forged.hitResolutionLog[row.hitResolutionLogId]!.elementalApplicationIcdLogId=0;
    if(mutation==="damage-hit")forged.damageEvents[row.damageEventId!]!.targetResolutionId=0;
    if(mutation==="application-damage")row.damageEventId=0;
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(forged))).success).toBe(false);expect(()=>expect(forged).toStrictEqual(expectedCurrentOwned()[key])).toThrow();expect(simulationResultSchema.parse(original)).toEqual(original);
  });
});
