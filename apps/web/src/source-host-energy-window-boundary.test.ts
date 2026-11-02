import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceHostResult, SourceHostEnergyApplication } from "../../../packages/sim-core/src/source-host-wire";
import { analyzeSourceHostEnergy, summarizeSourceHostEnergyRuns } from "./source-host-energy-analysis";
import { buildSourceDamageCurve, curveSeries } from "./source-damage-curve";

const legacy = JSON.parse(readFileSync(new URL("../../../docs/validation/source-team-builder-20260927.result.json", import.meta.url), "utf8")) as SourceHostResult;
function timed() {
  const result = structuredClone(legacy);
  result.observationWindow = { policy: "duration-or-native", configuredEndFrame: 1800, actualEndFrame: 1800, endReason: "duration" };
  return result;
}

describe("energy diagnostics use the same exact damage window as timed results", () => {
  it("puts a genuine saved F90 hit in the second window without shifting its event", () => {
    const result = timed(), before = structuredClone(result);
    const analysis = analyzeSourceHostEnergy(result, 90);
    expect(analysis.windows.map(window => [window.startFrame, window.endFrame])).toEqual([[0, 90], [90, 1800]]);
    expect(analysis.windows[0]!.damage).toBe(1274.9529360527729);
    expect(analysis.windows[1]!.damage).toBe(result.applications.filter(hit => hit.frame >= 90 && hit.frame < 1800).reduce((sum, hit) => sum + hit.appliedDamage, 0));
    expect(result).toEqual(before);
  });

  it("keeps same-frame hits, includes frame zero, and excludes the retained endpoint receipt", () => {
    const result = timed();
    const template = result.applications[0]!;
    result.applications = [
      { ...template, id: 1, frame: 0, appliedDamage: 10 },
      { ...template, id: 2, frame: 899, appliedDamage: 20 },
      { ...template, id: 3, frame: 900, appliedDamage: 30 },
      { ...template, id: 4, frame: 900, appliedDamage: 5 },
      { ...template, id: 5, frame: 1799, appliedDamage: 40 },
      { ...template, id: 6, frame: 1800, appliedDamage: 999 },
    ];
    const analysis = analyzeSourceHostEnergy(result);
    expect(analysis.windows.map(window => window.damage)).toEqual([30, 75]);
    expect(analysis.windows.map(window => window.dps)).toEqual([2, 5]);
    expect(analysis.windows.reduce((sum, window) => sum + window.damage, 0)).toBe(curveSeries(buildSourceDamageCurve(result)).total);
    expect(result.applications.at(-1)!.appliedDamage).toBe(999);
  });

  it("reads pre-boundary energy from the native F to energy_status[F-1] trace", () => {
    const result = timed();
    const character = (result.result as { characters: Array<{ energy_status: number[] }> }).characters[0]!;
    character.energy_status = Array.from({ length: 1800 }, (_, index) => index / 100);
    result.startupState = { mode: "full", actors: [{ actorIndex: 0, actorKey: "xiangling", requestedEnergy: null, energy: 80, maxEnergy: 80 }] };
    const analysis = analyzeSourceHostEnergy(result);
    expect(analysis.windows[0]!.actors[0]!.startEnergy).toBe(80);
    expect(analysis.windows[0]!.actors[0]!.endEnergy).toBe(8.98);
    expect(analysis.windows[1]!.actors[0]!.startEnergy).toBe(8.98);
    expect(analysis.windows[1]!.actors[0]!.endEnergy).toBe(17.98);
  });

  it("prefers actual ordered writes over a tick sample taken before a same-frame action", () => {
    const result = timed();
    const write = (id: number, frame: number, before: number, after: number): SourceHostEnergyApplication => ({ id, calculationId: id, frame, actorIndex: 0, actorKey: "xiangling", source: "synthetic-boundary-operation", operation: "flat-change", energyBefore: before, energyAfter: after, requestedAmount: after - before, energyMax: 80 });
    result.energyApplications = [write(1, 10, 80, 30), write(2, 10, 30, 35), write(3, 11, 35, 0)];
    result.startupState = { mode: "full", actors: [{ actorIndex: 0, actorKey: "xiangling", requestedEnergy: null, energy: 80, maxEnergy: 80 }] };
    const before = structuredClone(result);
    const analysis = analyzeSourceHostEnergy(result, 11);
    expect(analysis.windows[0]!.actors[0]!.endEnergy).toBe(35);
    expect(analysis.windows[1]!.actors[0]!.startEnergy).toBe(35);
    expect(analysis.windows[1]!.actors[0]!.endEnergy).toBe(0);
    expect(analysis.windows[0]!.actors[0]!.energyBoundarySource).toBe("energy-applications");
    expect(result).toEqual(before);
  });

  it("retains known zero before the first actual write and labels a trace-only fallback as sampling", () => {
    const result = timed();
    result.energyApplications = [{ id: 1, calculationId: 1, frame: 10, actorIndex: 0, actorKey: "xiangling", source: "synthetic-zero-start", operation: "flat-change", energyBefore: 0, energyAfter: 7, requestedAmount: 7, energyMax: 80 }];
    const analysis = analyzeSourceHostEnergy(result, 5);
    expect(analysis.windows[0]!.actors[0]!.startEnergy).toBe(0);
    expect(analysis.windows[0]!.actors[0]!.endEnergy).toBe(0);
    expect(analysis.windows[1]!.actors[0]!.endEnergy).toBe(7);
    expect(analysis.windows[0]!.actors[0]!.energyBoundarySource).toBe("energy-applications");
    expect(analyzeSourceHostEnergy(timed()).windows[0]!.actors[0]!.energyBoundarySource).toBe("native-tick-samples");
  });

  it("rejects reordered or disconnected writes rather than silently sorting or accepting a broken balance", () => {
    const result = timed();
    const first: SourceHostEnergyApplication = { id: 1, calculationId: 1, frame: 10, actorIndex: 0, actorKey: "xiangling", source: "synthetic-order", operation: "flat-change", energyBefore: 80, energyAfter: 30, requestedAmount: -50, energyMax: 80 };
    const second: SourceHostEnergyApplication = { ...first, id: 2, calculationId: 2, energyBefore: 30, energyAfter: 35, requestedAmount: 5 };
    result.energyApplications = [second, first];
    expect(() => analyzeSourceHostEnergy(result)).toThrow(/顺序或连续余额/);
    result.energyApplications = [first, { ...second, energyBefore: 31 }];
    expect(() => analyzeSourceHostEnergy(result)).toThrow(/顺序或连续余额/);
  });

  it("does not mix exact-write and sampled boundaries into one batch estimate", () => {
    const exact = timed(), sampled = timed();
    exact.energyApplications = [{ id: 1, calculationId: 1, frame: 10, actorIndex: 0, actorKey: "xiangling", source: "synthetic-batch", operation: "flat-change", energyBefore: 80, energyAfter: 80, requestedAmount: 0, energyMax: 80 }];
    sampled.seed = "2";
    expect(() => summarizeSourceHostEnergyRuns([exact, sampled])).toThrow(/能量边界证据/);
  });

  it.runIf(Boolean(process.env.GIDPS_WANDERER_WINDOW_CAPTURE))("uses the actual Durin F1510 action energy at boundary1511 instead of the earlier tick sample", () => {
    const result = JSON.parse(readFileSync(process.env.GIDPS_WANDERER_WINDOW_CAPTURE!, "utf8")) as SourceHostResult;
    const analysis = analyzeSourceHostEnergy(result, 1511);
    const actorIndex = result.startupState!.actors.find(actor => actor.actorKey === "durin")!.actorIndex;
    const write = result.energyApplications!.find(event => event.actorKey === "durin" && event.frame === 1510)!;
    const native = result.result as { characters: Array<{ energy_status: number[] }> };
    expect(write.energyBefore).toBeCloseTo(48.3756, 10);
    expect(write.energyAfter).toBe(70);
    expect(native.characters[actorIndex]!.energy_status[1509]).toBeCloseTo(48.3756, 10);
    expect(analysis.windows[0]!.actors[actorIndex]!.endEnergy).toBe(70);
    expect(analysis.windows[1]!.actors[actorIndex]!.startEnergy).toBe(70);
  });

  it("places warmup and adjacent measured windows on canonical integer-frame boundaries", () => {
    const result = timed();
    const analysis = analyzeSourceHostEnergy(result, { warmupFrames: 300, windowFrames: 300 });
    expect(analysis.windows.map(window => [window.startFrame, window.endFrame])).toEqual([[300, 600], [600, 900]]);
    for (const window of analysis.windows) expect(window.damage).toBe(result.applications.filter(hit => hit.frame >= window.startFrame && hit.frame < window.endFrame).reduce((sum, hit) => sum + hit.appliedDamage, 0));
  });

  it("does not reinterpret legacy or an early-ended native trace as a verified timed window", () => {
    expect(analyzeSourceHostEnergy(legacy).windows.map(window => [window.startFrame, window.endFrame])).toEqual([[1, 901], [901, 1801]]);
    const early = timed();
    early.observationWindow = { ...early.observationWindow!, endReason: "targets-dead", actualEndFrame: 900 };
    expect(analyzeSourceHostEnergy(early).windows.map(window => [window.startFrame, window.endFrame])).toEqual([[1, 901], [901, 1801]]);
  });

  it.runIf(Boolean(process.env.GIDPS_WANDERER_WINDOW_CAPTURE))("keeps the two actual F3600 hits in the latter 60 seconds of the saved 120-second team", () => {
    const result = JSON.parse(readFileSync(process.env.GIDPS_WANDERER_WINDOW_CAPTURE!, "utf8")) as SourceHostResult;
    const analysis = analyzeSourceHostEnergy(result);
    const boundary = result.applications.filter(hit => hit.frame === 3600);
    expect(boundary.map(hit => hit.id)).toEqual([10532, 10533]);
    expect(boundary.reduce((sum, hit) => sum + hit.appliedDamage, 0)).toBe(98208.2755955916);
    expect(analysis.windows.map(window => [window.startFrame, window.endFrame])).toEqual([[0, 3600], [3600, 7200]]);
    for (const window of analysis.windows) expect(window.damage).toBe(result.applications.filter(hit => hit.frame >= window.startFrame && hit.frame < window.endFrame).reduce((sum, hit) => sum + hit.appliedDamage, 0));
    expect(analysis.windows.reduce((sum, window) => sum + window.damage, 0)).toBeCloseTo(29547632.435022313, 6);
  });
});
