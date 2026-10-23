import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { analyzeSourceHostEnergy } from "./source-host-energy-analysis";
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
