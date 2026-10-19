import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { analyzeSourceHostEnergy, summarizeSourceHostEnergyRuns, type SourceHostObservationPolicy } from "./source-host-energy-analysis";

const saved = JSON.parse(readFileSync(new URL("../../../docs/validation/source-team-builder-20260927.result.json", import.meta.url), "utf8")) as SourceHostResult;

it("uses one continuous native trace for warmup, adjacent windows, and seed-paired contrasts", () => {
  const policy: SourceHostObservationPolicy = { warmupFrames: 300, windowFrames: 300 };
  const original = analyzeSourceHostEnergy(saved, policy);
  expect(original.observationPolicy).toEqual(policy);
  expect(original.windows.map(window => [window.startFrame, window.endFrame])).toEqual([[301, 601], [601, 901]]);
  for (const window of original.windows) {
    const observed = saved.applications.filter(hit => hit.frame >= window.startFrame && hit.frame < window.endFrame);
    expect(window.damage).toBeCloseTo(observed.reduce((sum, hit) => sum + hit.appliedDamage, 0), 8);
    expect(window.dps).toBeCloseTo(window.damage / 5, 8);
  }
  const trace = (saved.result as { characters: Array<{ energy_status: number[] }> }).characters[0]!.energy_status;
  expect(original.windows[0]!.actors[0]!.startEnergy).toBe(trace[299]);
  expect(original.windows[0]!.actors[0]!.endEnergy).toBe(trace[599]);
  expect(original.windows[1]!.actors[0]!.startEnergy).toBe(trace[599]);
  expect(original.windows[1]!.actors[0]!.endEnergy).toBe(trace[899]);

  const changed = structuredClone(saved);
  changed.seed = "2";
  const firstHit = changed.applications.find(hit => hit.frame >= 301 && hit.frame < 601)!;
  const secondHit = changed.applications.find(hit => hit.frame >= 601 && hit.frame < 901)!;
  firstHit.appliedDamage += 10;
  secondHit.appliedDamage += 40;
  (changed.result as { characters: Array<{ failed_actions: unknown }> }).characters[0]!.failed_actions = [{ start: 650, end: 651, reason: "insufficient_energy" }];
  (changed.logs as unknown[]).push({ event: "action", frame: 650, char_index: 0, msg: "source-host action rejected", logs: { action: "burst", reason: "insufficient_energy" } });
  const batch = summarizeSourceHostEnergyRuns([saved, changed], policy);
  const contrast = batch.pairedContrast!;
  expect(batch.observationPolicy).toEqual(policy);
  expect(batch.seeds).toEqual(["1", "2"]);
  expect(contrast.pairedSamples.map(sample => sample.dps)).toEqual(batch.runs.map(run => run.windows[1]!.dps - run.windows[0]!.dps));
  expect(contrast.dps.mean).toBeCloseTo(contrast.pairedSamples.reduce((sum, sample) => sum + sample.dps, 0) / 2, 8);
  expect(contrast.pairedSamples[1]!.dps - contrast.pairedSamples[0]!.dps).toBeCloseTo(6, 8); // (+40 - +10) / 5 s
  expect(contrast.pairedSamples.map(sample => sample.actors[0]!.burstInsufficientEnergy)).toEqual([0, 1]);
  expect(contrast.actors[0]!.burstInsufficientEnergy?.mean).toBe(0.5);
  expect(() => analyzeSourceHostEnergy(saved, { warmupFrames: 1200, windowFrames: 301 })).toThrow(/时长不足/);
  expect(() => summarizeSourceHostEnergyRuns([saved, { ...changed, executionMode: "strict" }], policy)).toThrow(/动作模式/);
  const alteredParty = structuredClone(changed);
  (alteredParty.result as { characters: Array<{ name: string }> }).characters[0]!.name = "different";
  expect(() => summarizeSourceHostEnergyRuns([saved, alteredParty], policy)).toThrow(/队伍/);
  const truncatedTrace = structuredClone(saved);
  (truncatedTrace.result as { characters: Array<{ energy_status: number[] }> }).characters[0]!.energy_status = trace.slice(0, 400);
  expect(analyzeSourceHostEnergy(truncatedTrace, policy).windows[0]!.actors[0]!.endEnergy).toBeNull();
});
