import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import {
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV150Schema,
  simulationResultV151Schema,
  type BasicReactionSchedulerModel,
  type SimulationResultForV151,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
} from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV151ToV150 } from "./project-v151-to-v150";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";
import { withV152CompatibilityPolicies } from "./v152-compatibility-config";

const NO_CRIT = {
  compatibilityMode: "legal-frame-v1",
  critMode: "noCrit",
  randomSeed: "v151-to-v150-projection",
} as const;

const LEGACY_SCHEDULER = {
  mode: "legacy-immediate-basic-reaction-scheduler-v1",
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} as const satisfies BasicReactionSchedulerModel;

const DEFERRED_SCHEDULER = {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2",
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
} as const satisfies BasicReactionSchedulerModel;

const historicalBytes = readFileSync(new URL("./fixtures/historical-projection-v151-v150-84ff5cd.json", import.meta.url));
const archive = JSON.parse(historicalBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string };
  cases: Array<{ caseId: string; sourceWireSha256: string; sourceWireText: string }>;
};
const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function historicalSource(kind: "inactive" | "single-swirl", model: BasicReactionSchedulerModel): SimulationResultForV151 {
  const caseId = `${kind}-${model.mode === LEGACY_SCHEDULER.mode ? "v1" : "v2"}`;
  const row = archive.cases.find(candidate => candidate.caseId === caseId);
  if (!row) throw new Error(`Missing pinned historical case ${caseId}`);
  expect(sha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  const result = JSON.parse(row.sourceWireText) as SimulationResultForV151;
  expect(result.config.basicReactionSchedulerModel).toEqual(model);
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultV151Schema.parse(result)).toEqual(result);
  return result;
}
const runEmpty = (model: BasicReactionSchedulerModel) => historicalSource("inactive", model);
const runSingleSwirl = (model: BasicReactionSchedulerModel) => historicalSource("single-swirl", model);

describe("V1.51 to frozen V1.50 result projection", () => {
  it("pins historical inputs and keeps current canonical semantics outside the frozen wire", () => {
    expect(sha256(historicalBytes)).toBe("9f99c7bc63131e5ee1fb37522d6356c92c62178fd8d9c0888d720579a5cd0d3d");
    expect(archive.fixtureVersion).toBe("historical-projection-v151-v150-84ff5cd-v1");
    expect(archive.source.commit).toBe("84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5");
    expect(archive.cases.map(row => row.caseId)).toEqual(["inactive-v1", "inactive-v2", "single-swirl-v1", "single-swirl-v2"]);
    const current = simulate(withV152CompatibilityPolicies(makeConfig({ basicReactionSchedulerModel: LEGACY_SCHEDULER })), NO_CRIT);
    expect(current.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
    const before = JSON.stringify(current);
    expect(() => projectSimulationResultV153ToV152(current)).toThrow(/flatStatBuffSemantics/);
    expect(JSON.stringify(current)).toBe(before);
  });
  it.each([
    ["V1", LEGACY_SCHEDULER],
    ["V2", DEFERRED_SCHEDULER],
  ] as const)(
    "projects an inactive %s scheduler and rebuilds the exact V1.50 identity",
    (_label, model) => {
      const current = runEmpty(model);
      expect(current.basicReactionSchedulerLog).toEqual([]);

      const projected = projectSimulationResultV151ToV150(current);
      expect(simulationResultV150Schema.parse(projected)).toEqual(projected);
      expect(projected.schemaVersion).toBe(
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
      );
      expect(projected.engineVersion).toBe(
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
      );
      expect(projected.runManifest.version).toBe(
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
      );
      expect(
        Object.hasOwn(projected.config, "basicReactionSchedulerModel"),
      ).toBe(false);
      expect(
        Object.hasOwn(projected.runManifest, "basicReactionSchedulerRoot"),
      ).toBe(false);
      expect(Object.hasOwn(projected, "basicReactionSchedulerLog")).toBe(false);
      expect(projected.runManifest.configHash).toBe(
        createSimulationConfigHash(projected.config),
      );
      const { reproducibilityKey: _reproducibilityKey, ...manifestIdentity } =
        projected.runManifest;
      expect(projected.reproducibilityKey).toBe(
        createSimulationReproducibilityKey(manifestIdentity),
      );
      expect(projected.totalDamage).toBe(current.totalDamage);
      expect(projected.damageEvents).toEqual(current.damageEvents);
    },
  );

  it("discards V1 legacy-immediate rows and their reciprocal timeline links", () => {
    const current = runSingleSwirl(LEGACY_SCHEDULER);
    expect(current.basicReactionSchedulerLog.length).toBeGreaterThan(0);
    expect(
      current.basicReactionSchedulerLog.every(
        (entry) =>
          entry.kind === "swirl-attack-resolution" &&
          entry.disposition === "legacy-immediate" &&
          entry.pairedLogId === null,
      ),
    ).toBe(true);
    expect(
      current.targetStateTimeline.points.some((point) =>
        point.links.some(
          (link) => link.kind === "basic-reaction-scheduler-log",
        ),
      ),
    ).toBe(true);

    const projected = projectSimulationResultV151ToV150(current);
    expect(simulationResultV150Schema.parse(projected)).toEqual(projected);
    expect(Object.hasOwn(projected, "basicReactionSchedulerLog")).toBe(false);
    expect(
      projected.targetStateTimeline.points.some((point) =>
        point.links.some(
          (link) =>
            (link as { kind: string }).kind === "basic-reaction-scheduler-log",
        ),
      ),
    ).toBe(false);

    const incompatibleV1Row = {
      ...current,
      basicReactionSchedulerLog: [
        {
          ...current.basicReactionSchedulerLog[0]!,
          disposition: "deferred",
          pairedLogId: 1,
        },
      ],
    } as SimulationResultForV151;
    expect(() => projectSimulationResultV151ToV150(incompatibleV1Row)).toThrow(
      /scheduler|legacy-immediate|disposition/i,
    );
  });

  it("fails closed whenever V2 produced scheduler rows", () => {
    const active = runSingleSwirl(DEFERRED_SCHEDULER);
    expect(active.basicReactionSchedulerLog.length).toBeGreaterThan(0);
    expect(() => projectSimulationResultV151ToV150(active)).toThrow(
      /only when basicReactionSchedulerLog is empty/,
    );
  });

  it.each([
    [
      "event",
      (current: SimulationResultForV151) => ({
        ...current,
        targetStateTimeline: {
          ...current.targetStateTimeline,
          points: current.targetStateTimeline.points.map((point, index) =>
            index === 0
              ? { ...point, eventType: "reactionAuraAttachment" as const }
              : point,
          ),
        },
      }),
      /eventType|reactionAuraAttachment|boundary points/i,
    ],
    [
      "cause",
      (current: SimulationResultForV151) => ({
        ...current,
        targetStateTimeline: {
          ...current.targetStateTimeline,
          points: current.targetStateTimeline.points.map((point, index) =>
            index === 0
              ? { ...point, cause: "reaction-aura-attachment" as const }
              : point,
          ),
        },
      }),
      /cause|reaction-aura-attachment|simulation-start/i,
    ],
    [
      "link",
      (current: SimulationResultForV151) => ({
        ...current,
        targetStateTimeline: {
          ...current.targetStateTimeline,
          points: current.targetStateTimeline.points.map((point, index) =>
            index === 0
              ? {
                  ...point,
                  links: [
                    ...point.links,
                    { kind: "basic-reaction-scheduler-log" as const, id: 0 },
                  ],
                }
              : point,
          ),
        },
      }),
      /basic-reaction-scheduler-log|links/i,
    ],
  ] as const)("rejects a V2 1.51-only timeline %s", (_label, mutate, error) => {
    const current = runEmpty(DEFERRED_SCHEDULER);
    expect(current.targetStateTimeline.points.length).toBeGreaterThan(0);
    expect(() => projectSimulationResultV151ToV150(mutate(current))).toThrow(
      error,
    );
  });

  it("rejects a config/root scheduler policy mismatch before stripping identity", () => {
    const current = runEmpty(DEFERRED_SCHEDULER);
    const mismatched = {
      ...current,
      config: {
        ...current.config,
        basicReactionSchedulerModel: LEGACY_SCHEDULER,
      },
    };
    expect(() => projectSimulationResultV151ToV150(mismatched)).toThrow(
      /scheduler|configHash|not bound/i,
    );
  });

  it("rejects an inactive V1 orphan scheduler timeline link before stripping it", () => {
    const current = structuredClone(runEmpty(LEGACY_SCHEDULER));
    const point = current.targetStateTimeline.points[0];
    expect(point).toBeDefined();
    point!.links.push({
      kind: "basic-reaction-scheduler-log",
      id: 999,
    });

    expect(() => projectSimulationResultV151ToV150(current)).toThrow(
      /scheduler|timeline|link/i,
    );
  });

  it("rejects an inactive V2 forged scheduler-root hash before stripping it", () => {
    const current = structuredClone(runEmpty(DEFERRED_SCHEDULER));
    const forged = current as unknown as {
      runManifest: {
        basicReactionSchedulerRoot: { contentHash: string };
      };
    };
    forged.runManifest.basicReactionSchedulerRoot.contentHash = `sha256:${"0".repeat(64)}`;

    expect(() =>
      projectSimulationResultV151ToV150(
        forged as unknown as SimulationResultForV151,
      ),
    ).toThrow(/scheduler|root|contentHash/i);
  });
});
