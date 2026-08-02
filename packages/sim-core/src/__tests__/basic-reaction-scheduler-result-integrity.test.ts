import {
  assertTrustedSimulationResult,
  assertTrustedSimulationResultV150,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import { beforeAll, describe, expect, it } from "vitest";

import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "../../../test-vectors/src/project-v153-to-v152";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const OPTIONS = {
  energyMode: "configured" as const,
  critMode: "noCrit" as const,
  compatibilityMode: "legal-frame-v1" as const,
};

function anemoApplicationHit(): FrameHitDefinition {
  return {
    id: "scheduler-swirl-hit",
    label: "scheduler-swirl-hit",
    frame: 0,
    scaling: 0,
    element: "anemo",
    targeting: { targetId: "source", outcome: "landed" },
    application: {
      gaugeUnits: 1,
      icd: { mode: "no-icd-v1" },
    },
  };
}

function makeSchedulerConfig(mode: "v1" | "v2" = "v2"): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: `scheduler-integrity-${mode}`,
    randomSeed: `scheduler-integrity-${mode}`,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Compatibility target",
          position: { x: 100, y: 0 },
        },
        {
          id: "source",
          name: "Swirl source",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "pyro", gaugeUnits: 1 }],
        },
        {
          id: "recipient-a",
          name: "Swirl recipient A",
          position: { x: 1, y: 0 },
        },
        {
          id: "recipient-b",
          name: "Swirl recipient B",
          position: { x: 2, y: 0 },
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo scheduler driver",
        element: "anemo",
        stats: { ...neutralStats, baseAtk: 0, em: 100 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetTaskModel: { mode: "target-phase-v2" },
    basicReactionSchedulerModel:
      mode === "v2"
        ? {
            mode: "fixed-gcsim-basic-reaction-scheduler-v2",
            policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
          }
        : {
            mode: "legacy-immediate-basic-reaction-scheduler-v1",
            policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
          },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 1,
      abilities: [
        {
          id: "scheduler-swirl",
          actorId: "anemo",
          name: "Scheduler Swirl",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [anemoApplicationHit()],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "scheduler-swirl",
          atFrame: 0,
        },
      ],
    },
  });
}

function clone(result: SimulationResult): SimulationResult {
  return structuredClone(result);
}

function deferredDamageEvent(result: SimulationResult) {
  const attack = result.basicReactionSchedulerLog.find(
    (row) =>
      row.kind === "swirl-attack-resolution" && row.disposition === "deferred",
  );
  if (attack === undefined) throw new Error("missing deferred attack fixture");
  const resolution = result.hitResolutionLog[attack.hitResolutionLogId];
  if (resolution === undefined || resolution.damageEventId === null) {
    throw new Error("deferred attack is missing its damage event");
  }
  const event = result.damageEvents[resolution.damageEventId];
  if (event === undefined) throw new Error("missing deferred damage event");
  return event;
}

describe("basic-reaction scheduler trusted result integrity", () => {
  let v2: SimulationResult;
  let v1: SimulationResult;

  beforeAll(() => {
    v2 = simulate(makeSchedulerConfig("v2"), OPTIONS);
    v1 = simulate(makeSchedulerConfig("v1"), OPTIONS);
  });

  it("accepts authentic V1/V2 scheduler wires without cloning", () => {
    expect(assertTrustedSimulationResult(v2)).toBe(v2);
    expect(assertTrustedSimulationResult(v1)).toBe(v1);
    expect(
      v1.basicReactionSchedulerLog.every(
        (row) =>
          row.kind === "swirl-attack-resolution" &&
          row.disposition === "legacy-immediate",
      ),
    ).toBe(true);
    expect(
      v2.basicReactionSchedulerLog.filter(
        (row) => row.kind === "deferred-aura-attachment",
      ),
    ).toHaveLength(2);
  });

  it("rejects deletion of the complete V1 immediate scheduler projection", () => {
    const deleted = clone(v1);
    deleted.basicReactionSchedulerLog = [];
    for (const point of deleted.targetStateTimeline.points) {
      point.links = point.links.filter(
        (link) => link.kind !== "basic-reaction-scheduler-log"
      );
    }
    expect(() => assertTrustedSimulationResult(deleted)).toThrow(
      /exactly one attack row|scheduler/i
    );
  });

  it("rejects forged commit sequence, reciprocal pair, and reaction claims", () => {
    const shifted = clone(v2);
    const shiftedCommit = shifted.basicReactionSchedulerLog.find(
      (row) => row.kind === "deferred-aura-attachment",
    );
    if (shiftedCommit === undefined) throw new Error("missing commit fixture");
    shiftedCommit.eventSequence += 1000;
    expect(() => assertTrustedSimulationResult(shifted)).toThrow(
      /scheduler|eventSequence/,
    );

    const swapped = clone(v2);
    const attacks = swapped.basicReactionSchedulerLog.filter(
      (row) =>
        row.kind === "swirl-attack-resolution" &&
        row.disposition === "deferred",
    );
    const commits = swapped.basicReactionSchedulerLog.filter(
      (row) => row.kind === "deferred-aura-attachment",
    );
    if (
      attacks.length !== 2 ||
      commits.length !== 2 ||
      attacks[0] === undefined ||
      attacks[1] === undefined ||
      commits[0] === undefined ||
      commits[1] === undefined
    ) {
      throw new Error("two scheduler pairs are required");
    }
    attacks[0].pairedLogId = commits[1].id;
    attacks[1].pairedLogId = commits[0].id;
    commits[0].pairedLogId = attacks[1].id;
    commits[1].pairedLogId = attacks[0].id;
    expect(() => assertTrustedSimulationResult(swapped)).toThrow(
      /pair|scheduler|commit\/attack/i,
    );

    const forgedReaction = clone(v2);
    const forgedAttack = forgedReaction.basicReactionSchedulerLog.find(
      (row) => row.kind === "swirl-attack-resolution",
    );
    if (forgedAttack === undefined) throw new Error("missing attack fixture");
    forgedAttack.reaction = "overload";
    expect(() => assertTrustedSimulationResult(forgedReaction)).toThrow(
      /reaction|scheduler/,
    );
  });

  it("rejects missing and duplicated deferred commits", () => {
    const missing = clone(v2);
    const commitIndex = missing.basicReactionSchedulerLog.findIndex(
      (row) => row.kind === "deferred-aura-attachment",
    );
    if (commitIndex < 0) throw new Error("missing commit fixture");
    missing.basicReactionSchedulerLog.splice(commitIndex, 1);
    expect(() => assertTrustedSimulationResult(missing)).toThrow(
      /scheduler|pair|contiguous/,
    );

    const duplicated = clone(v2);
    const commit = duplicated.basicReactionSchedulerLog.find(
      (row) => row.kind === "deferred-aura-attachment",
    );
    if (commit === undefined) throw new Error("missing commit fixture");
    duplicated.basicReactionSchedulerLog.push({
      ...structuredClone(commit),
      id: duplicated.basicReactionSchedulerLog.length,
    });
    expect(() => assertTrustedSimulationResult(duplicated)).toThrow(
      /scheduler|backlink|pair/,
    );
  });

  it("replays the full deferred Aura-token predicate from the damage audit", () => {
    const mutations: Array<
      [string, (event: ReturnType<typeof deferredDamageEvent>) => void]
    > = [
      [
        "model",
        (event) => void (event.reactionAudit.model = "manual-override"),
      ],
      [
        "unsupported branch",
        (event) =>
          void event.reactionAudit.unsupportedReactions.push(
            "legacy-multi-reaction-order",
          ),
      ],
      [
        "application Gauge",
        (event) => void (event.reactionAudit.applicationGaugeUnits = 0),
      ],
      [
        "Aura consumption",
        (event) =>
          void event.reactionAudit.auraConsumed?.push({
            element: "pyro",
            gaugeUnits: 0.1,
          }),
      ],
    ];

    for (const [label, mutate] of mutations) {
      const forged = clone(v2);
      mutate(deferredDamageEvent(forged));
      expect(() => assertTrustedSimulationResult(forged), label).toThrow(
        /disposition|deferred|scheduler/,
      );
    }
  });

  it("rejects coherent-looking selector/root drift", () => {
    const forged = clone(v2);
    forged.config.basicReactionSchedulerModel = {
      mode: "legacy-immediate-basic-reaction-scheduler-v1",
      policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
    };
    expect(() => assertTrustedSimulationResult(forged)).toThrow(
      /scheduler|configHash/,
    );

    const forgedRoot = clone(v2);
    forgedRoot.runManifest.basicReactionSchedulerRoot =
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT;
    expect(() => assertTrustedSimulationResult(forgedRoot)).toThrow(
      /scheduler|root|reproducibility/,
    );
  });

  it("keeps the frozen V1.50 trusted boundary free of V1.51 log and timeline fields", () => {
    const projected = projectSimulationResultV151ToV150(
      projectSimulationResultV152ToV151(
        projectSimulationResultV153ToV152(
          simulate(makeConfig(), {
            energyMode: "configured",
            critMode: "noCrit"
          })
        ),
      ),
    );
    expect(assertTrustedSimulationResultV150(projected)).toBe(projected);

    const widenedLog = structuredClone(projected) as typeof projected & {
      basicReactionSchedulerLog: [];
    };
    widenedLog.basicReactionSchedulerLog = [];
    expect(() => assertTrustedSimulationResultV150(widenedLog)).toThrow(
      /frozen 1\.50|scheduler/,
    );

    const widenedTimeline = structuredClone(projected);
    const point = widenedTimeline.targetStateTimeline.points[0];
    if (point === undefined) throw new Error("missing timeline fixture");
    (point as unknown as Record<string, unknown>).cause =
      "reaction-aura-attachment";
    (point as unknown as Record<string, unknown>).eventType =
      "reactionAuraAttachment";
    (point.links as unknown as Array<{ kind: string; id: number }>).push({
      kind: "basic-reaction-scheduler-log",
      id: 0,
    });
    expect(() => assertTrustedSimulationResultV150(widenedTimeline)).toThrow(
      /frozen 1\.50|scheduler/,
    );
  });
});
