import { describe, expect, it } from "vitest";
import { defineDamageModifierPlugin, simulate } from "../../sim-core/src";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";
import { simulationResultV153Schema, simulationResultV152ValueSchema, simulationResultV153ValueSchema, simulationExecutionAuditSchema } from "./result-schema";
import { currentResolvedSimulationRuntimeOptionsSchema, resolvedSimulationRuntimeOptionsSchema, simulationExecutionOptionsSchema, simulationRunManifestV153Schema, lunarChargedExecutionOptionsSchema, lunarCrystallizeExecutionOptionsSchema, stellarConductExecutionOptionsSchema, lunarBloomExecutionOptionsSchema } from "./schema";
import { createSimulationReproducibilityKey } from "./reproducibility";
import type { SimulationExecutionOptions } from "./types";

function config(includeIneligible = true) {
  return makeConfig({
    duration: 1, cycleLength: 2,
    rotation: [{ id: "skill", actorId: "a", name: "Skill", at: 0, hits: [
      { id: "hit", offset: 0, scaling: 2, critRate: 0.4 },
      { id: "cannot-crit", offset: 0.1, scaling: 1, ...(includeIneligible ? { critEligible: false } : {}) }
    ] }]
  });
}

describe("opt-in current execution audit boundary", () => {
  it.each(["stellarConduct", "lunarBloom"] as const)("binds %s as a current-only configuration contract", (field) => {
    const party = [{ actorId: "a", characterKey: "profile-test-character" }];
    const execution: SimulationExecutionOptions = field === "stellarConduct"
      ? { stellarConduct: { profileId: "stellar-conduct-reference-v1", party } }
      : { lunarBloom: { profileId: "lunar-bloom-reference-v1", party } };
    const schema = field === "stellarConduct" ? stellarConductExecutionOptionsSchema : lunarBloomExecutionOptionsSchema;
    const option = execution[field]!;
    expect(schema.shape.party).toBe(lunarChargedExecutionOptionsSchema.shape.party);
    expect(simulationExecutionOptionsSchema.safeParse(execution).success).toBe(true);
    expect(schema.safeParse({ ...option, profileId: "unverified-live-profile" }).success).toBe(false);
    expect(schema.safeParse({ ...option, party: [] }).success).toBe(false);
    expect(schema.safeParse({ ...option, party: [party[0], party[0]] }).success).toBe(false);
    const plain = simulate(config(false));
    const { reproducibilityKey: _key, ...identity } = plain.runManifest;
    const extended = { ...identity, resolvedRuntimeOptions: { ...identity.resolvedRuntimeOptions, execution } };
    const key = createSimulationReproducibilityKey(extended);
    expect(key).not.toBe(plain.reproducibilityKey);
    expect(resolvedSimulationRuntimeOptionsSchema.safeParse(extended.resolvedRuntimeOptions).success).toBe(false);
    expect(simulationRunManifestV153Schema.safeParse({ ...extended, reproducibilityKey: key }).success).toBe(true);
    option.party[0]!.characterKey = "different-profile-character";
    expect(createSimulationReproducibilityKey(extended)).not.toBe(key);
    expect(simulationRunManifestV153Schema.safeParse({ ...extended, reproducibilityKey: key }).success).toBe(false);
  });

  it("binds the lunar-crystallize profile through the shared party contract and current manifest only", () => {
    const option = { profileId: "lunar-crystallize-reference-v1" as const, party: [{ actorId: "a", characterKey: "zibai" }] };
    expect(lunarCrystallizeExecutionOptionsSchema.shape.party).toBe(lunarChargedExecutionOptionsSchema.shape.party);
    expect(simulationExecutionOptionsSchema.safeParse({ lunarCrystallize: option }).success).toBe(true);
    expect(lunarCrystallizeExecutionOptionsSchema.safeParse({ ...option, profileId: "lunar-charged-reference-v1" }).success).toBe(false);
    expect(lunarCrystallizeExecutionOptionsSchema.safeParse({ ...option, party: [] }).success).toBe(false);
    expect(lunarCrystallizeExecutionOptionsSchema.safeParse({ ...option, party: [option.party[0], option.party[0]] }).success).toBe(false);
    const plain = simulate(config(false));
    const { reproducibilityKey: _plainKey, ...identity } = plain.runManifest;
    const extended = { ...identity, resolvedRuntimeOptions: { ...identity.resolvedRuntimeOptions, execution: { lunarCrystallize: option } } };
    const key = createSimulationReproducibilityKey(extended);
    expect(key).not.toBe(plain.reproducibilityKey);
    expect(resolvedSimulationRuntimeOptionsSchema.safeParse(extended.resolvedRuntimeOptions).success).toBe(false);
    expect(simulationRunManifestV153Schema.safeParse({ ...extended, reproducibilityKey: key }).success).toBe(true);
    extended.resolvedRuntimeOptions.execution.lunarCrystallize.party[0]!.characterKey = "columbina";
    expect(createSimulationReproducibilityKey(extended)).not.toBe(key);
    expect(simulationRunManifestV153Schema.safeParse({ ...extended, reproducibilityKey: key }).success).toBe(false);
  });

  it("validates the explicit lunar-charged profile and one to four unique party actors", () => {
    const option = { profileId: "lunar-charged-reference-v1", party: [{ actorId: "a", characterKey: "ineffa" }] };
    expect(lunarChargedExecutionOptionsSchema.safeParse(option).success).toBe(true);
    expect(simulationExecutionOptionsSchema.safeParse({ lunarCharged: option }).success).toBe(true);
    for (const invalid of [
      { ...option, profileId: "invented-live-profile" },
      { ...option, party: [] },
      { ...option, party: Array.from({ length: 5 }, (_, index) => ({ actorId: `actor-${index}`, characterKey: "ineffa" })) },
      { ...option, party: [option.party[0], { actorId: "a", characterKey: "flins" }] },
      { ...option, party: [{ actorId: "a", characterKey: " " }] },
      { ...option, party: [{ actorId: "", characterKey: "ineffa" }] },
      { ...option, invented: true }
    ]) expect(lunarChargedExecutionOptionsSchema.safeParse(invalid).success).toBe(false);
  });

  it("binds the lunar profile and ordered party into current identity without changing absent defaults", () => {
    const result = simulate(config(false));
    const { reproducibilityKey: _key, ...plainIdentity } = result.runManifest;
    const withLunar = {
      ...plainIdentity,
      resolvedRuntimeOptions: {
        ...plainIdentity.resolvedRuntimeOptions,
        execution: { lunarCharged: { profileId: "lunar-charged-reference-v1" as const, party: [{ actorId: "a", characterKey: "ineffa" }] } }
      }
    };
    const lunarKey = createSimulationReproducibilityKey(withLunar);
    expect(lunarKey).not.toBe(result.reproducibilityKey);
    expect(createSimulationReproducibilityKey(plainIdentity)).toBe(result.reproducibilityKey);
    const manifest = { ...withLunar, reproducibilityKey: lunarKey };
    expect(simulationRunManifestV153Schema.safeParse(manifest).success).toBe(true);
    expect(resolvedSimulationRuntimeOptionsSchema.safeParse(manifest.resolvedRuntimeOptions).success).toBe(false);
    const changedParty = structuredClone(manifest);
    changedParty.resolvedRuntimeOptions.execution.lunarCharged.party[0]!.characterKey = "flins";
    expect(simulationRunManifestV153Schema.safeParse(changedParty).success).toBe(false);
    const { reproducibilityKey: _changedKey, ...changedIdentity } = changedParty;
    expect(createSimulationReproducibilityKey(changedIdentity)).not.toBe(lunarKey);
    const ordered = structuredClone(withLunar);
    ordered.resolvedRuntimeOptions.execution.lunarCharged.party.push({ actorId: "b", characterKey: "flins" });
    const orderedKey = createSimulationReproducibilityKey(ordered);
    ordered.resolvedRuntimeOptions.execution.lunarCharged.party.reverse();
    expect(createSimulationReproducibilityKey(ordered)).not.toBe(orderedKey);
  });

  it("preserves absent defaults and keeps execution out of frozen schemas", () => {
    const result = simulate(config(false));
    expect(result.executionAudit).toBeUndefined();
    expect(result.resolvedRuntimeOptions).not.toHaveProperty("execution");
    expect(simulationResultV152ValueSchema.shape).not.toHaveProperty("executionAudit");
    expect(simulationResultV153ValueSchema.shape.executionAudit.isOptional()).toBe(true);
    const extended = { ...result.resolvedRuntimeOptions, execution: { captureHits: true } };
    expect(currentResolvedSimulationRuntimeOptionsSchema.safeParse(extended).success).toBe(true);
    expect(resolvedSimulationRuntimeOptionsSchema.safeParse(extended).success).toBe(false);
    expect(simulationResultV153Schema.safeParse(result).success).toBe(true);
  });

  it("binds selected execution options into the current run identity", () => {
    const plain = simulate(config());
    const captured = simulate(config(), { execution: { captureHits: true, detailedTraces: true } });
    expect(captured.reproducibilityKey).not.toBe(plain.reproducibilityKey);
    expect(captured.totalDamage).toBe(plain.totalDamage);
    expect(captured.executionAudit?.hits).toHaveLength(2);
    expect(captured.executionAudit?.hits.every(hit => Array.isArray(hit.trace))).toBe(true);
    expect(simulationRunManifestV153Schema.safeParse(captured.runManifest).success).toBe(true);
    const tampered = structuredClone(captured.runManifest);
    tampered.resolvedRuntimeOptions.execution!.detailedTraces = false;
    expect(simulationRunManifestV153Schema.safeParse(tampered).success).toBe(false);
    const { reproducibilityKey: _key, ...identity } = captured.runManifest;
    expect(createSimulationReproducibilityKey(identity)).toBe(captured.reproducibilityKey);
    expect(simulationResultV153Schema.safeParse(captured).success).toBe(true);
  });

  it("replays exact seeded draws and rejects altered roll, order, outcome, and input", () => {
    const result = simulate(config(), { randomSeed: "执行审计-seed", execution: { criticalSampling: "seeded-random-v1" } });
    expect(result.executionAudit?.criticalSampling?.drawCount).toBe(1);
    expect(result.executionAudit?.hits[1]?.critical).toEqual({ mode: "configured", eligible: false, outcome: "ineligible", roll: null, drawIndex: null });
    expect(simulationResultV153Schema.safeParse(result).success).toBe(true);
    for (const mutate of [
      (copy: typeof result) => { copy.executionAudit!.hits[0]!.critical.roll = 0.25; },
      (copy: typeof result) => { copy.executionAudit!.hits[0]!.critical.drawIndex = 1; },
      (copy: typeof result) => { copy.executionAudit!.hits[0]!.critical.outcome = "expected"; },
      (copy: typeof result) => { copy.executionAudit!.criticalSampling!.drawCount = 2; },
      (copy: typeof result) => { copy.executionAudit!.hits[1]!.eventId = 0; },
      (copy: typeof result) => { const hit = copy.executionAudit!.hits[0]!; if (hit.inputKind === "ordinary") hit.input.scalingValue += 1; }
    ]) {
      const copy = structuredClone(result);
      mutate(copy);
      expect(simulationResultV153Schema.safeParse(copy).success).toBe(false);
    }
  });

  it("verifies post-plugin levels, defenses and critical mode from captured input", () => {
    const plugin = defineDamageModifierPlugin({ id: "audit-test", version: "1", kind: "code", contentHash: "fnv1a32:12345678" }, () => ({
      modifyDamage: () => ({ characterLevel: 75, enemyLevel: 125, effectiveResistance: -0.2, defenseReduction: -0.4, critMode: "allCrit", elementalMastery: 123 })
    }));
    const result = simulate(config(), { plugins: [plugin], execution: { captureHits: true, criticalSampling: "seeded-random-v1" } });
    expect(result.executionAudit?.criticalSampling?.drawCount).toBe(0);
    expect(simulationResultV153Schema.safeParse(result).success).toBe(true);
    const copy = structuredClone(result);
    const hit = copy.executionAudit!.hits[0]!;
    if (hit.inputKind === "ordinary") hit.input.enemyLevel += 1;
    expect(simulationResultV153Schema.safeParse(copy).success).toBe(false);
  });

  it("rejects missing capture and false claims of checkpoint completeness", () => {
    const result = simulate(config(), { execution: { captureHits: true } });
    const missing = structuredClone(result);
    delete missing.executionAudit;
    expect(simulationResultV153Schema.safeParse(missing).success).toBe(false);
    const copy = structuredClone(result);
    copy.executionAudit!.checkpointCoverage = { complete: true, missingDimensions: ["energy"], reasons: [] };
    expect(simulationResultV153Schema.safeParse(copy).success).toBe(false);
  });

  it("requires explicit finite inputs, strict keys and ordered checkpoint requests", () => {
    expect(simulationExecutionOptionsSchema.safeParse({ checkpointFrames: [10, 10] }).success).toBe(false);
    expect(simulationExecutionOptionsSchema.safeParse({ checkpointFrames: [20, 10] }).success).toBe(false);
    expect(simulationExecutionOptionsSchema.safeParse({ checkpointFrames: [-1] }).success).toBe(false);
    const audit = simulate(config(), { execution: { captureHits: true } }).executionAudit!;
    const invalid = structuredClone(audit);
    const first = invalid.hits[0]!;
    if (first.inputKind === "ordinary") first.input.scalingValue = Number.NaN;
    expect(simulationExecutionAuditSchema.safeParse(invalid).success).toBe(false);
    expect(simulationExecutionAuditSchema.safeParse({ ...audit, invented: true }).success).toBe(false);
  });
});
