import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { analyzeSourceHostEnergy, summarizeSourceHostEnergyRuns, type SourceHostObservationPolicy } from "./source-host-energy-analysis";
import { createSourceHostStartupJobs, summarizeSourceHostStartupRuns, type SourceHostStartupJob, type SourceHostStartupRun } from "./source-host-startup-analysis";

// This is an analysis-contract fixture derived from a saved real native result.
// Altered damage and startup receipts below are synthetic; they are not claims
// that a new Go execution produced these outcomes.
const saved = JSON.parse(readFileSync(new URL("../../../docs/validation/source-team-builder-20260927.result.json", import.meta.url), "utf8")) as SourceHostResult;

it("pairs exact seed/startup cells and propagates missing burst-attempt evidence without treating windows as samples", () => {
  const party = (saved.result as { characters: Array<{ name: string; energy_status: number[]; failed_actions?: Array<{ start: number; end: number; reason: string }> }> }).characters;
  const custom = Object.fromEntries(party.map(actor => [actor.name, 10]));
  const jobs = createSourceHostStartupJobs({ protocol: "gidps-source-host-v1", config: saved.config, seed: "ignored", hostVariant: "classic" }, "11,12", custom);
  expect(jobs).toHaveLength(6);
  expect(jobs.map(job => [job.scenario, job.request.seed])).toEqual([
    ["zero", "11"], ["full", "11"], ["custom", "11"], ["zero", "12"], ["full", "12"], ["custom", "12"],
  ]);
  expect(new Set(jobs.map(job => job.request.config))).toEqual(new Set([saved.config]));
  expect(() => createSourceHostStartupJobs(jobs[0]!.request, "1,01")).toThrow(/不重复/);

  const policy: SourceHostObservationPolicy = { warmupFrames: 300, windowFrames: 300 };
  const syntheticRun = (job: SourceHostStartupJob): SourceHostStartupRun => {
    const result = structuredClone(saved);
    const initial = job.request.initialEnergy!;
    result.seed = job.request.seed;
    result.initialEnergy = initial;
    result.startupState = { mode: initial.mode, actors: party.map((actor, actorIndex) => {
      const maxEnergy = actor.energy_status[0]!;
      return { actorIndex, actorKey: actor.name,
        requestedEnergy: initial.mode === "zero" ? 0 : initial.mode === "custom" ? initial.byActor[actor.name]! : null,
        energy: initial.mode === "zero" ? 0 : initial.mode === "custom" ? Math.min(10, maxEnergy) : maxEnergy,
        maxEnergy };
    }) };
    if (job.scenario === "full") {
      const first = result.applications.find(hit => hit.frame >= 301 && hit.frame < 601)!;
      const second = result.applications.find(hit => hit.frame >= 601 && hit.frame < 901)!;
      const increment = job.request.seed === "11" ? 10 : 20;
      first.appliedDamage += increment;
      second.appliedDamage += increment + 20;
      if (job.request.seed === "12") {
        // Deliberately no matching per-attempt log: an old merged interval
        // cannot be converted into a count of failed Q attempts.
        (result.result as { characters: typeof party }).characters[0]!.failed_actions = [{ start: 650, end: 651, reason: "insufficient_energy" }];
      }
    }
    return { ...job, result, elapsedMs: 0 };
  };
  const runs = jobs.map(syntheticRun);
  const summary = summarizeSourceHostStartupRuns(runs, policy);
  expect(summary.schemaVersion).toBe("source-host-startup-v1");
  expect(summary.seeds).toEqual(["11", "12"]);
  expect(summary.scenarios.map(row => row.scenario)).toEqual(["zero", "full", "custom"]);
  expect(summary.pairedContrasts).toHaveLength(4);
  const first = summary.pairedContrasts.find(row => row.id === "full-minus-zero" && row.windowIndex === 0)!;
  expect([first.startFrame, first.endFrame]).toEqual([301, 601]);
  first.pairedSamples.forEach((sample, index) => expect(sample.dps).toBeCloseTo([2, 4][index]!, 8));
  expect(first.dps.count).toBe(2);
  expect(first.dps.mean).toBeCloseTo(3, 8);
  const second = summary.pairedContrasts.find(row => row.id === "full-minus-zero" && row.windowIndex === 1)!;
  second.pairedSamples.forEach((sample, index) => expect(sample.dps).toBeCloseTo([6, 8][index]!, 8));
  expect(second.pairedSamples[1]!.actors[0]!.burstInsufficientEnergy).toBeNull();
  expect(second.actors[0]!.burstInsufficientEnergy).toBeNull();
  expect(summary.pairedContrasts.find(row => row.id === "custom-minus-zero" && row.windowIndex === 0)!.dps.mean).toBeCloseTo(0, 8);

  const zero = runs.find(run => run.scenario === "zero")!.result;
  const full = runs.find(run => run.scenario === "full" && run.request.seed === "12")!.result;
  const startupPolicy: SourceHostObservationPolicy = { warmupFrames: 0, windowFrames: 300 };
  expect(analyzeSourceHostEnergy(zero, startupPolicy).windows[0]!.actors[0]!.startEnergy).toBe(0);
  expect(analyzeSourceHostEnergy(full, startupPolicy).windows[0]!.actors[0]!.startEnergy).toBe(full.startupState!.actors[0]!.energy);
  expect((zero.result as { characters: typeof party }).characters[0]!.energy_status[0]).not.toBe(0); // historical trace fallback differs
  expect(() => summarizeSourceHostEnergyRuns([zero, full], policy)).toThrow(/初能覆盖/);
  const wrongReceipt = structuredClone(runs);
  wrongReceipt[1]!.result.startupState!.actors[0]!.requestedEnergy = 1;
  expect(() => summarizeSourceHostStartupRuns(wrongReceipt, policy)).toThrow(/请求能量/);
});
