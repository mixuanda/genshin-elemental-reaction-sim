import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertSourceHostReexecutionArtifact, sourceHostReexecutionRequest, verifySourceHostReexecution,
} from "../source-host-reexecution";
import type { SourceHostResult } from "../source-host-wire";
import { sourceHostInitialEnergyIdentity } from "../source-host-wire";
import { captureSourceHostHit, createSourceHostResult, replaySourceHostHit } from "../source-host-capture";

const classic = JSON.parse(readFileSync(new URL("../../../../docs/validation/source-execution-profile-20260928.result.json", import.meta.url), "utf8")) as SourceHostResult;
const stellar = JSON.parse(readFileSync(new URL("../../../../docs/validation/source-host-stellar-20260927.result.json", import.meta.url), "utf8")) as SourceHostResult;

describe("complete source-host re-execution contract", () => {
  it("derives the saved run, selects the exact host, and rejects absent or mismatched executor bytes", () => {
    expect(sourceHostReexecutionRequest(classic)).toEqual({ protocol: classic.protocol, config: classic.config,
      seed: classic.seed, hostVariant: "classic", executionMode: "auto-wait" });
    expect(sourceHostReexecutionRequest(stellar).hostVariant).toBe("stellar");
    expect(() => sourceHostReexecutionRequest({ ...classic, formulaVersion: "old-formula" })).toThrow();
    expect(() => createSourceHostResult({ ...classic, formulaVersion: "old-formula" })).toThrow();
    expect(() => sourceHostReexecutionRequest({ ...classic, executionArtifact: undefined })).toThrow(/未保存 WASM/);
    expect(() => assertSourceHostReexecutionArtifact(classic, classic.executionArtifact)).not.toThrow();
    expect(() => assertSourceHostReexecutionArtifact(classic, { ...classic.executionArtifact, wasmSha256: "0".repeat(64) })).toThrow(/不匹配/);
  });

  it("checks complete numeric and mechanism output, retaining event order and simulated duration", () => {
    const same = structuredClone(classic);
    same.result = Object.fromEntries(Object.entries(same.result as Record<string, unknown>).reverse());
    const receipt = verifySourceHostReexecution(classic, same);
    expect(receipt.checkedFields).toEqual(["calculations", "applications", "playerApplications", "energyApplications", "healingApplications", "result", "logs", "capabilities"]);
    expect(receipt.counts.calculations).toBe(classic.calculations.length);
    const formulaDrift = structuredClone(classic);
    formulaDrift.calculations[0]!.value += 1;
    expect(() => verifySourceHostReexecution(classic, formulaDrift)).toThrow(/calculations\[0\]\.value/);
    const timingDrift = structuredClone(classic);
    (timingDrift.result as { duration: number }).duration += 1;
    expect(() => verifySourceHostReexecution(classic, timingDrift)).toThrow(/result\.duration/);
    const orderDrift = structuredClone(classic);
    const logs = orderDrift.logs as unknown[];
    [logs[0], logs[1]] = [logs[1], logs[0]];
    expect(() => verifySourceHostReexecution(classic, orderDrift)).toThrow(/logs\[0\]/);
    const capabilityDrift = structuredClone(classic);
    Object.assign(capabilityDrift.capabilities, { testMarker: "drift" });
    expect(() => verifySourceHostReexecution(classic, capabilityDrift)).toThrow(/capabilities\.testMarker/);
  });

  it("preserves an explicit initial-energy run in full reexecution and a standalone hit", () => {
    const saved = structuredClone(classic);
    saved.initialEnergy = { mode: "custom", byActor: { zhongli: 40, amber: 0 } };
    saved.startupState = { mode: "custom", actors: [
      { actorIndex: 0, actorKey: "amber", requestedEnergy: 0, energy: 0, maxEnergy: 40 },
      { actorIndex: 1, actorKey: "zhongli", requestedEnergy: 40, energy: 40, maxEnergy: 40 },
    ] };
    expect(sourceHostInitialEnergyIdentity(saved.initialEnergy)).toBe(sourceHostInitialEnergyIdentity({ mode: "custom", byActor: { amber: 0, zhongli: 40 } }));
    expect(sourceHostInitialEnergyIdentity()).not.toBe(sourceHostInitialEnergyIdentity({ mode: "full" }));
    expect(sourceHostReexecutionRequest(saved).initialEnergy).toEqual(saved.initialEnergy);
    const same = structuredClone(saved);
    same.initialEnergy = { mode: "custom", byActor: { amber: 0, zhongli: 40 } };
    expect(() => verifySourceHostReexecution(saved, same)).not.toThrow();
    const captured = captureSourceHostHit(saved, saved.applications[0]!.id);
    expect(replaySourceHostHit(captured).captured.startupState).toEqual(saved.startupState);
    expect(captured.initialEnergy).toEqual(saved.initialEnergy);
    const changedRequest = structuredClone(same);
    changedRequest.initialEnergy = { mode: "custom", byActor: { amber: 1, zhongli: 40 } };
    changedRequest.startupState!.actors[0]!.requestedEnergy = 1;
    expect(() => verifySourceHostReexecution(saved, changedRequest)).toThrow(/initialEnergy\.byActor\.amber/);
    const changedStartup = structuredClone(same);
    changedStartup.startupState!.actors[1]!.energy = 39;
    expect(() => verifySourceHostReexecution(saved, changedStartup)).toThrow(/startupState\.actors\[1\]\.energy/);
    const partial = structuredClone(saved);
    delete partial.startupState;
    expect(() => sourceHostReexecutionRequest(partial)).toThrow(/开局状态回执不完整/);
  });
});
