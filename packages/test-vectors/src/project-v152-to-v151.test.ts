import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV151Schema,
  simulationResultV152Schema,
  type FreezeBrokenAttackModelV152,
  type FreezeBrokenAttackRootV152,
  type SimulationResultForV152,
  type SimulationRunManifestV152,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
} from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV152ToV151 } from "./project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";

const NO_CRIT = {
  compatibilityMode: "legal-frame-v1",
  critMode: "noCrit",
  randomSeed: "v152-to-v151-projection",
} as const;

const LEGACY_FREEZE_BROKEN = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const satisfies FreezeBrokenAttackModelV152;

const FIXED_FREEZE_BROKEN = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const satisfies FreezeBrokenAttackModelV152;

const LEGACY_CALLBACK_BUS = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
} as const;

const historicalBytes = readFileSync(new URL("./fixtures/historical-projection-v152-v151-84ff5cd.json", import.meta.url));
const historicalArchive = JSON.parse(historicalBytes.toString("utf8")) as {
  fixtureVersion: string;
  source: { commit: string };
  cases: Array<{ caseId: string; sourceWireSha256: string; sourceWireText: string }>;
};
const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function historicalSource(kind: "inactive" | "natural-expiry", model: FreezeBrokenAttackModelV152): SimulationResultForV152 {
  const caseId = `${kind}-${model.mode === LEGACY_FREEZE_BROKEN.mode ? "v1" : "v2"}`;
  const row = historicalArchive.cases.find(candidate => candidate.caseId === caseId);
  if (!row) throw new Error(`Missing pinned historical case ${caseId}`);
  expect(sha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  const result = JSON.parse(row.sourceWireText) as SimulationResultForV152;
  expect(result.config.freezeBrokenAttackModel).toEqual(model);
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultV152Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV152(result)).toBe(result);
  return result;
}
const runEmpty = (model: FreezeBrokenAttackModelV152) => historicalSource("inactive", model);
const runNaturalExpiry = (model: FreezeBrokenAttackModelV152) => historicalSource("natural-expiry", model);

function rebindFreezeBrokenPolicy(
  result: SimulationResultForV152,
  model: FreezeBrokenAttackModelV152,
  root: FreezeBrokenAttackRootV152,
): SimulationResultForV152 {
  const rebound = structuredClone(result);
  rebound.config.freezeBrokenAttackModel = model;
  const configHash = createSimulationConfigHash(rebound.config);
  const { reproducibilityKey: _reproducibilityKey, ...manifestRest } =
    rebound.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV152,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    configHash,
    freezeBrokenAttackRoot: root,
  };
  rebound.runManifest = {
    ...manifestIdentity,
    reproducibilityKey: createSimulationReproducibilityKey(manifestIdentity),
  };
  rebound.reproducibilityKey = rebound.runManifest.reproducibilityKey;
  return rebound;
}

describe("V1.52 to frozen V1.51 result projection", () => {
  it("pins original historical bytes rather than relabelling current canonical output", () => {
    expect(sha256(historicalBytes)).toBe("f5ce3e566dbdca217b82bdb3a2c65071f64dcb92979463a3cb7b2bd8375ce6a2");
    expect(historicalArchive.fixtureVersion).toBe("historical-projection-v152-v151-84ff5cd-v1");
    expect(historicalArchive.source.commit).toBe("84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5");
    expect(historicalArchive.cases.map(row => row.caseId)).toEqual(["inactive-v1", "inactive-v2", "natural-expiry-v1", "natural-expiry-v2"]);
    const current = simulate(makeConfig({ freezeBrokenAttackModel: LEGACY_FREEZE_BROKEN, callbackBusModel: LEGACY_CALLBACK_BUS }), NO_CRIT);
    expect(current.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
    const before = JSON.stringify(current);
    expect(() => projectSimulationResultV153ToV152(current)).toThrow(/flatStatBuffSemantics/);
    expect(JSON.stringify(current)).toBe(before);
  });
  it.each([
    ["V1", LEGACY_FREEZE_BROKEN],
    ["V2", FIXED_FREEZE_BROKEN],
  ] as const)(
    "projects an inactive %s policy and rebuilds the exact V1.51 identity",
    (_label, model) => {
      const current = runEmpty(model);
      expect(current.freezeBrokenAttackLog).toEqual([]);
      expect(simulationResultV152Schema.parse(current)).toEqual(current);
      expect(assertTrustedSimulationResultV152(current)).toBe(current);

      const projected = projectSimulationResultV152ToV151(current);
      expect(simulationResultV151Schema.parse(projected)).toEqual(projected);
      expect(projected.schemaVersion).toBe(
        BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
      );
      expect(projected.engineVersion).toBe(
        BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
      );
      expect(projected.runManifest.version).toBe(
        BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
      );
      expect(Object.hasOwn(projected.config, "freezeBrokenAttackModel")).toBe(
        false,
      );
      expect(
        Object.hasOwn(projected.runManifest, "freezeBrokenAttackRoot"),
      ).toBe(false);
      expect(Object.hasOwn(projected, "freezeBrokenAttackLog")).toBe(false);
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
      expect(projected.targetStateTimeline).toEqual(
        current.targetStateTimeline,
      );
    },
  );

  it("projects an eligible V1 depletion only when its historical log stays empty", () => {
    const current = runNaturalExpiry(LEGACY_FREEZE_BROKEN);
    expect(current.frozenStateLog.map((entry) => entry.operation)).toEqual([
      "start",
      "expire",
    ]);
    expect(current.freezeBrokenAttackLog).toEqual([]);

    const projected = projectSimulationResultV152ToV151(current);
    expect(simulationResultV151Schema.parse(projected)).toEqual(projected);
    expect(projected.frozenStateLog).toEqual(current.frozenStateLog);
  });

  it("fails closed when V2 emitted any Freeze Broken callback semantics", () => {
    const active = runNaturalExpiry(FIXED_FREEZE_BROKEN);
    expect(simulationResultV152Schema.parse(active)).toEqual(active);
    expect(assertTrustedSimulationResultV152(active)).toBe(active);
    expect(active.freezeBrokenAttackLog.length).toBeGreaterThan(0);

    expect(() => projectSimulationResultV152ToV151(active)).toThrow(
      /only when freezeBrokenAttackLog is empty|callback semantics/i,
    );
  });

  it("rejects a V1 source carrying rows before any 1.52 proof is stripped", () => {
    const activeV2 = runNaturalExpiry(FIXED_FREEZE_BROKEN);
    expect(activeV2.freezeBrokenAttackLog.length).toBeGreaterThan(0);
    const forgedV1 = rebindFreezeBrokenPolicy(
      activeV2,
      LEGACY_FREEZE_BROKEN,
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
    );

    expect(() => projectSimulationResultV152ToV151(forgedV1)).toThrow(
      /freeze broken|V1|empty|log/i,
    );
  });

  it("rejects a mismatched config/root policy before stripping identity", () => {
    const current = runEmpty(FIXED_FREEZE_BROKEN);
    const mismatched = structuredClone(current);
    mismatched.runManifest.freezeBrokenAttackRoot =
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT;

    expect(() => projectSimulationResultV152ToV151(mismatched)).toThrow(
      /freeze broken|root|policy|configHash|manifest/i,
    );
  });

  it("rejects an inactive V2 forged root before the root can be discarded", () => {
    const current = structuredClone(runEmpty(FIXED_FREEZE_BROKEN));
    const forged = current as unknown as {
      runManifest: {
        freezeBrokenAttackRoot: { contentHash: string };
      };
    };
    forged.runManifest.freezeBrokenAttackRoot.contentHash = `sha256:${"0".repeat(64)}`;

    expect(() =>
      projectSimulationResultV152ToV151(
        forged as unknown as SimulationResultForV152,
      ),
    ).toThrow(/freeze broken|root|contentHash/i);
  });

  it("does not mutate the validated V1.52 source", () => {
    const current = runEmpty(FIXED_FREEZE_BROKEN);
    const before = structuredClone(current);

    projectSimulationResultV152ToV151(current);
    expect(current).toEqual(before);
    expect(current.runManifest.freezeBrokenAttackRoot).toEqual(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    );
  });

  it("preserves authored key order in unchanged historical nested wires", () => {
    const current = runNaturalExpiry(LEGACY_FREEZE_BROKEN);
    const projected = projectSimulationResultV152ToV151(current);
    const currentApplication = current.elementalApplicationIcdLog[0]!;
    const projectedApplication = projected.elementalApplicationIcdLog[0]!;

    expect(Object.keys(projectedApplication)).toEqual(
      Object.keys(currentApplication),
    );
  });
});
