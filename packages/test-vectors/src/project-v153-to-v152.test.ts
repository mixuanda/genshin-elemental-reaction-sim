import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import {
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  assertTrustedSimulationResultV153,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV152Schema,
  simulationResultV153Schema,
  type CallbackBusModel,
  type FreezeBrokenAttackModel,
  type SimConfig,
  type SimulationResultForV153,
  type SimulationRunManifestV153,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import {
  defineCallbackSubscriberPluginV153,
  defineDamageModifierPlugin,
} from "../../sim-core/src";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";

const NO_CRIT = {
  compatibilityMode: "legal-frame-v1",
  critMode: "noCrit",
  randomSeed: "v153-to-v152-projection",
} as const;

const LEGACY_CALLBACK_BUS = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
} as const satisfies CallbackBusModel;

const FIXED_CALLBACK_BUS = {
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
} as const satisfies CallbackBusModel;

const LEGACY_FREEZE_BROKEN = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const satisfies FreezeBrokenAttackModel;

const AUDIT_ONLY_FREEZE_BROKEN = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const satisfies FreezeBrokenAttackModel;

const DISPATCHED_FREEZE_BROKEN = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
} as const satisfies FreezeBrokenAttackModel;

type HistoricalCaseId = "inactive-v1" | "inactive-v2" | "natural-expiry" | "damage-plugin" | "flat-atk-counterexample";
interface HistoricalPair {
  caseId: HistoricalCaseId;
  sourceWireSha256: string;
  projectedWireSha256: string;
  sourceWireText: string;
  projectedWireText: string;
}
const archiveBytes = readFileSync(new URL("./fixtures/historical-projection-v153-v152-84ff5cd.json", import.meta.url));
const archive = JSON.parse(archiveBytes.toString("utf8")) as {
  fixtureVersion: string;
  source: { repository: string; commit: string; verifiedPackageFileCount: number; files: Array<{ path: string; gitBlobSha1: string }> };
  cases: HistoricalPair[];
};
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function historicalPair(caseId: HistoricalCaseId): HistoricalPair {
  const row = archive.cases.find(row => row.caseId === caseId);
  if (row === undefined) throw new Error(`Missing immutable historical projection case ${caseId}`);
  expect(sha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  expect(sha256(row.projectedWireText)).toBe(row.projectedWireSha256);
  return row;
}
function historicalSource(caseId: HistoricalCaseId): SimulationResultForV153 {
  const source = JSON.parse(historicalPair(caseId).sourceWireText) as SimulationResultForV153;
  expect(source.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(source.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultV153Schema.parse(source)).toEqual(source);
  expect(assertTrustedSimulationResultV153(source)).toBe(source);
  return source;
}
function damageModifierPlugin() {
  return defineDamageModifierPlugin(
    {
      id: "test.projectable-damage-plugin",
      version: "1.0.0",
      kind: "code",
      contentHash: "fnv1a32:da000152",
    },
    () => ({ modifyDamage() {} }),
  );
}
function expectCanonicalProjectionRejected(source: SimulationResultForV153): void {
  const before = JSON.stringify(source);
  expect(source.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
  expect(source.runManifest.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
  expect(simulationResultV153Schema.parse(source)).toEqual(source);
  expect(assertTrustedSimulationResultV153(source)).toBe(source);
  let rejected: unknown;
  try { projectSimulationResultV153ToV152(source); } catch (error) { rejected = error; }
  expect(rejected).toBeInstanceOf(Error);
  const issues = (rejected as { issues?: unknown[] }).issues;
  expect(issues).toHaveLength(2);
  expect(issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "unrecognized_keys", keys: ["flatStatBuffSemantics"], path: ["resolvedRuntimeOptions"] }),
    expect.objectContaining({ code: "unrecognized_keys", keys: ["flatStatBuffSemantics"], path: ["runManifest", "resolvedRuntimeOptions"] }),
  ]));
  expect(JSON.stringify(source)).toBe(before);
}

function runEmpty(
  callbackBusModel: CallbackBusModel,
  freezeBrokenAttackModel: FreezeBrokenAttackModel,
) {
  return simulate(
    makeConfig({ callbackBusModel, freezeBrokenAttackModel }),
    NO_CRIT,
  );
}

function makeNaturalExpiryConfig(
  callbackBusModel: CallbackBusModel,
  freezeBrokenAttackModel: FreezeBrokenAttackModel,
): SimConfig {
  const base = makeConfig({ callbackBusModel, freezeBrokenAttackModel });
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 4,
    cycleLength: 4,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      freezeResistance: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Projection frozen target",
          initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Projection Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "hydro-freeze",
          actorId: "hydro",
          name: "Hydro Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-freeze-hit",
              label: "Freeze",
              frame: 0,
              scaling: 1,
              element: "hydro",
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "hydro-freeze",
        },
      ],
    },
  };
}

function runNaturalExpiry(
  callbackBusModel: CallbackBusModel,
  freezeBrokenAttackModel: FreezeBrokenAttackModel,
) {
  return simulate(
    makeNaturalExpiryConfig(callbackBusModel, freezeBrokenAttackModel),
    NO_CRIT,
  );
}

function rebindV152CompatibilityPolicies(
  result: SimulationResultForV153,
): SimulationResultForV153 {
  const rebound = structuredClone(result);
  rebound.config.callbackBusModel = LEGACY_CALLBACK_BUS;
  rebound.config.freezeBrokenAttackModel = AUDIT_ONLY_FREEZE_BROKEN;
  const configHash = createSimulationConfigHash(rebound.config);
  const { reproducibilityKey: _reproducibilityKey, ...manifestRest } =
    rebound.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV153,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    configHash,
    callbackBusRoot: LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
    freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  };
  rebound.runManifest = {
    ...manifestIdentity,
    reproducibilityKey: createSimulationReproducibilityKey(manifestIdentity),
  };
  rebound.reproducibilityKey = rebound.runManifest.reproducibilityKey;
  return rebound;
}

describe("V1.53 to frozen V1.52 result projection", () => {
  it.each([
    ["Freeze Broken V1", LEGACY_FREEZE_BROKEN],
    ["Freeze Broken V2", AUDIT_ONLY_FREEZE_BROKEN],
  ] as const)(
    "projects inactive callback-bus V1 with %s and rebuilds exact V1.52 identity",
    (_label, freezeBrokenAttackModel) => {
      // These successful projections are original 84ff5cd wires, rather than
      // current canonical results stripped of an unrepresentable semantic flag.
      const caseId = freezeBrokenAttackModel.mode === LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE ? "inactive-v1" : "inactive-v2";
      const current = historicalSource(caseId);
      expect(current.callbackRegistrationLog).toEqual([]);
      expect(current.callbackDeliveryLog).toEqual([]);
      expect(simulationResultV153Schema.parse(current)).toEqual(current);
      expect(assertTrustedSimulationResultV153(current)).toBe(current);

      const projected = projectSimulationResultV153ToV152(current);
      expect(JSON.stringify(projected)).toBe(historicalPair(caseId).projectedWireText);
      expect(simulationResultV152Schema.parse(projected)).toEqual(projected);
      expect(assertTrustedSimulationResultV152(projected)).toBe(projected);
      expect(projected.schemaVersion).toBe(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION);
      expect(projected.engineVersion).toBe(FREEZE_BROKEN_ATTACK_ENGINE_VERSION);
      expect(projected.runManifest.version).toBe(
        FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
      );
      expect(Object.hasOwn(projected.config, "callbackBusModel")).toBe(false);
      expect(Object.hasOwn(projected.runManifest, "callbackBusRoot")).toBe(
        false,
      );
      expect(
        Object.hasOwn(projected.runManifest, "pluginCapabilities"),
      ).toBe(false);
      expect(
        Object.hasOwn(projected.runManifest, "pluginCallbackSubscriptions"),
      ).toBe(false);
      expect(Object.hasOwn(projected, "callbackRegistrationLog")).toBe(false);
      expect(Object.hasOwn(projected, "callbackDeliveryLog")).toBe(false);
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
      expect(projected.freezeBrokenAttackLog).toEqual(
        current.freezeBrokenAttackLog,
      );
    },
  );

  it("preserves a V2 audit-only Freeze Broken row under callback-bus V1", () => {
    const current = historicalSource("natural-expiry");
    expect(current.freezeBrokenAttackLog.length).toBeGreaterThan(0);
    expect(
      current.freezeBrokenAttackLog.every(
        (entry) =>
          entry.executionStatus === "reference-audit-only-not-dispatched",
      ),
    ).toBe(true);
    expect(current.callbackRegistrationLog).toEqual([]);
    expect(current.callbackDeliveryLog).toEqual([]);

    const projected = projectSimulationResultV153ToV152(current);
    expect(JSON.stringify(projected)).toBe(historicalPair("natural-expiry").projectedWireText);
    expect(assertTrustedSimulationResultV152(projected)).toBe(projected);
    expect(projected.freezeBrokenAttackLog).toEqual(
      current.freezeBrokenAttackLog,
    );
  });

  it("strips a damage-modifier capability while preserving its frozen plugin entry", () => {
    const current = historicalSource("damage-plugin");
    expect(current.runManifest.pluginCapabilities).toEqual([
      "damage-modifier",
    ]);

    const projected = projectSimulationResultV153ToV152(current);
    expect(JSON.stringify(projected)).toBe(historicalPair("damage-plugin").projectedWireText);
    expect(projected.pluginManifest).toEqual(current.pluginManifest);
    expect(projected.runManifest.plugins).toEqual(current.runManifest.plugins);
    expect(Object.hasOwn(projected.runManifest, "pluginCapabilities")).toBe(
      false,
    );
    expect(assertTrustedSimulationResultV152(projected)).toBe(projected);
  });

  it("fails closed for an otherwise inactive callback-subscriber capability", () => {
    const callbackPlugin = defineCallbackSubscriberPluginV153(
      {
        id: "test.unprojectable-callback-plugin",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:cb000153",
      },
      [],
      () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
    );
    const current = simulate(
      makeConfig({
        callbackBusModel: FIXED_CALLBACK_BUS,
        freezeBrokenAttackModel: DISPATCHED_FREEZE_BROKEN,
      }),
      { ...NO_CRIT, plugins: [callbackPlugin] },
    );
    expect(current.callbackRegistrationLog).toEqual([]);
    expect(current.callbackDeliveryLog).toEqual([]);
    expect(current.runManifest.pluginCapabilities).toEqual([
      "callback-subscriber",
    ]);
    expect(assertTrustedSimulationResultV153(current)).toBe(current);

    expect(() => projectSimulationResultV153ToV152(current)).toThrow(
      /cannot represent callback-subscriber capability/i,
    );
  });

  it("fails closed for callback-bus V2 even when no callback fires", () => {
    const current = runEmpty(FIXED_CALLBACK_BUS, DISPATCHED_FREEZE_BROKEN);
    expect(current.callbackRegistrationLog).toEqual([]);
    expect(current.callbackDeliveryLog).toEqual([]);
    expect(assertTrustedSimulationResultV153(current)).toBe(current);

    expect(() => projectSimulationResultV153ToV152(current)).toThrow(
      /requires callback bus V1/i,
    );
  });

  it("fails closed for an active V3 Freeze Broken callback delivery", () => {
    const current = runNaturalExpiry(
      FIXED_CALLBACK_BUS,
      DISPATCHED_FREEZE_BROKEN,
    );
    expect(current.callbackDeliveryLog).toHaveLength(5);
    expect(
      current.freezeBrokenAttackLog.some(
        (entry) =>
          entry.executionStatus === "callback-bus-dispatched-normalized",
      ),
    ).toBe(true);
    expect(assertTrustedSimulationResultV153(current)).toBe(current);

    expect(() => projectSimulationResultV153ToV152(current)).toThrow(
      /callback bus V1|Freeze Broken V3|callback delivery/i,
    );
  });

  it("rejects callback logs before any V1.53 proof can be stripped", () => {
    const current = runEmpty(FIXED_CALLBACK_BUS, DISPATCHED_FREEZE_BROKEN);
    const forged = rebindV152CompatibilityPolicies(current);
    expect(assertTrustedSimulationResultV153(forged)).toBe(forged);
    forged.callbackRegistrationLog = [
      {
        id: 0,
        registryRevision: 1,
        eventKind: "on-apply-attack-freeze-broken",
        subscriberKey: "forged",
        slotIndex: 0,
        operation: "subscribe",
        previousSubscriptionId: null,
        currentSubscriptionId: 0,
        sourceKind: "core",
        pluginManifestIndex: null,
        pluginId: null,
        subscriberAttemptRefs: [],
      },
    ];

    expect(() => projectSimulationResultV153ToV152(forged)).toThrow(
      /callback|registration|legacy|V1/i,
    );
  });

  it("rejects a mismatched callback-bus config/root before stripping identity", () => {
    const current = runEmpty(LEGACY_CALLBACK_BUS, AUDIT_ONLY_FREEZE_BROKEN);
    const mismatched = structuredClone(current);
    mismatched.config.callbackBusModel = FIXED_CALLBACK_BUS;

    expect(() => projectSimulationResultV153ToV152(mismatched)).toThrow(
      /callback|root|policy|configHash|manifest/i,
    );
  });

  it("rejects a forged callback-bus trust root before it can be discarded", () => {
    const current = structuredClone(
      runEmpty(LEGACY_CALLBACK_BUS, AUDIT_ONLY_FREEZE_BROKEN),
    );
    const forged = current as unknown as {
      runManifest: { callbackBusRoot: { contentHash: string } };
    };
    forged.runManifest.callbackBusRoot.contentHash = `sha256:${"0".repeat(64)}`;

    expect(() =>
      projectSimulationResultV153ToV152(
        forged as unknown as SimulationResultForV153,
      ),
    ).toThrow(/callback|root|contentHash/i);
  });

  it("does not mutate the validated V1.53 source", () => {
    const current = historicalSource("natural-expiry");
    const before = structuredClone(current);

    projectSimulationResultV153ToV152(current);
    expect(current).toEqual(before);
    expect(current.runManifest.callbackBusRoot).toEqual(
      LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
    );
  });

  it("preserves authored key order in unchanged historical nested wires", () => {
    const current = historicalSource("natural-expiry");
    const projected = projectSimulationResultV153ToV152(current);
    expect(JSON.stringify(projected)).toBe(historicalPair("natural-expiry").projectedWireText);
    const currentApplication = current.elementalApplicationIcdLog[0]!;
    const projectedApplication = projected.elementalApplicationIcdLog[0]!;

    expect(Object.keys(projectedApplication)).toEqual(
      Object.keys(currentApplication),
    );
  });
});

describe("historical projection bytes versus current canonical flat-stat semantics", () => {
  it("keeps the fixed original source, both wire hashes, numbers and identities unchanged", () => {
    expect(sha256(archiveBytes)).toBe("7866e0fca5f6d4904473b44792c2b598fdf8a0e9d1e0f729608a467f4494cfb6");
    expect(archive.fixtureVersion).toBe("historical-projection-v153-v152-84ff5cd-v1");
    expect(archive.source.repository).toBe("mixuanda/genshin-elemental-reaction-sim");
    expect(archive.source.commit).toBe("84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5");
    expect(archive.source.verifiedPackageFileCount).toBe(305);
    expect(archive.cases.map(row => row.caseId)).toEqual(["inactive-v1", "inactive-v2", "natural-expiry", "damage-plugin", "flat-atk-counterexample"]);
    for (const row of archive.cases) {
      const source = historicalSource(row.caseId);
      const before = JSON.stringify(source);
      const historicalTarget = JSON.parse(row.projectedWireText);
      expect(simulationResultV152Schema.parse(historicalTarget)).toEqual(historicalTarget);
      expect(assertTrustedSimulationResultV152(historicalTarget)).toBe(historicalTarget);
      const projected = projectSimulationResultV153ToV152(source);
      expect(JSON.stringify(projected)).toBe(row.projectedWireText);
      expect(projected.totalDamage).toBe(source.totalDamage);
      expect(projected.totalDamage).toBe(row.caseId === "natural-expiry" || row.caseId === "flat-atk-counterexample" ? 450 : 0);
      expect(projected.damageEvents).toEqual(source.damageEvents);
      expect(projected.runManifest.configHash).toBe(createSimulationConfigHash(projected.config));
      const { reproducibilityKey, ...identity } = projected.runManifest;
      expect(reproducibilityKey).toBe(createSimulationReproducibilityKey(identity));
      expect(projected.reproducibilityKey).toBe(reproducibilityKey);
      expect(JSON.stringify(source)).toBe(before);
    }
  });

  it.each(["inactive-v1", "inactive-v2", "natural-expiry", "damage-plugin"] as const)(
    "rejects rather than relabels current canonical results: %s", caseId => {
      const source = caseId === "natural-expiry"
        ? runNaturalExpiry(LEGACY_CALLBACK_BUS, AUDIT_ONLY_FREEZE_BROKEN)
        : caseId === "damage-plugin"
          ? simulate(makeConfig({ callbackBusModel: LEGACY_CALLBACK_BUS, freezeBrokenAttackModel: AUDIT_ONLY_FREEZE_BROKEN }), { ...NO_CRIT, plugins: [damageModifierPlugin()] })
          : runEmpty(LEGACY_CALLBACK_BUS, caseId === "inactive-v1" ? LEGACY_FREEZE_BROKEN : AUDIT_ONLY_FREEZE_BROKEN);
      expectCanonicalProjectionRejected(source);
    },
  );

  it("preserves the historical450 while the same flat-ATK input now honestly computes495", () => {
    const historical = historicalSource("flat-atk-counterexample");
    const current = simulate(structuredClone(historical.config), NO_CRIT);
    expect(current.config).toEqual(historical.config);
    expect(historical.totalDamage).toBe(1000 * .5 * .9);
    expect(historical.damageEvents[0]!.damageFactors?.scalingValue).toBe(1000);
    expect(current.totalDamage).toBe((1000 + 100) * .5 * .9);
    expect(current.damageEvents[0]!.damageFactors?.scalingValue).toBe(1100);
    expectCanonicalProjectionRejected(current);
    expect(JSON.parse(historicalPair("flat-atk-counterexample").projectedWireText).totalDamage).toBe(450);
  });

  it.each(["root", "manifest"] as const)("keeps frozen V152 strict against a canonical marker at %s", location => {
    const original = historicalPair("natural-expiry");
    const forged = JSON.parse(original.projectedWireText);
    const options = location === "root" ? forged.resolvedRuntimeOptions : forged.runManifest.resolvedRuntimeOptions;
    options.flatStatBuffSemantics = "canonical-v1";
    const parsed = simulationResultV152Schema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues).toContainEqual(expect.objectContaining({ code: "unrecognized_keys", keys: ["flatStatBuffSemantics"] }));
    expect(sha256(original.projectedWireText)).toBe(original.projectedWireSha256);
  });
});
