import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { addSourceHostRechargeContribution, analyzeSourceHostEnergy, summarizeSourceHostEnergyRuns } from "./source-host-energy-analysis";

const saved = JSON.parse(readFileSync(new URL("../../../docs/validation/source-team-builder-20260927.result.json", import.meta.url), "utf8")) as SourceHostResult;

describe("source-host continuous energy analysis", () => {
  it("uses the saved native trace across adjacent windows without resetting energy", () => {
    const analysis = analyzeSourceHostEnergy(saved);
    expect(analysis.durationFrames).toBe(1800);
    expect(analysis.windows.map(window => [window.startFrame, window.endFrame])).toEqual([[1, 901], [901, 1801]]);
    expect(analysis.windows[0]!.actors.map((actor, index) => actor.endEnergy === analysis.windows[1]!.actors[index]!.startEnergy)).toEqual([true, true, true, true]);
    expect(analysis.windows.flatMap(window => window.actors).reduce((sum, actor) => sum + actor.spent, 0)).toBeCloseTo(260, 8);
    expect(analysis.windows.flatMap(window => window.actors).reduce((sum, actor) => sum + actor.burstAccepted, 0)).toBe(4);
    expect(analysis.energyEvents.some(event => event.kind === "particle" && event.wasted > 0)).toBe(true);
    expect(analysis.perAttemptFailuresComplete).toBe(true);
  });

  it("counts each source rejection and does not turn a legacy failure interval into one attempt", () => {
    const withFailure = structuredClone(saved);
    const native = withFailure.result as { characters: Array<{ failed_actions: unknown }> };
    native.characters[0]!.failed_actions = [{ start: 500, end: 510, reason: "insufficient_energy" }];
    const old = analyzeSourceHostEnergy(withFailure);
    expect(old.windows[0]!.actors[0]!.burstRejected).toBeNull();
    expect(old.perAttemptFailuresComplete).toBe(false);
    (withFailure.logs as Array<unknown>).push(
      { event: "action", frame: 500, char_index: 0, msg: "source-host action rejected", logs: { action: "burst", reason: "insufficient_energy" } },
      { event: "action", frame: 501, char_index: 0, msg: "source-host action rejected", logs: { action: "burst", reason: "insufficient_energy" } },
    );
    const current = analyzeSourceHostEnergy(withFailure);
    expect(current.windows[0]!.actors[0]!.burstRejected).toBe(2);
    expect(current.windows[0]!.actors[0]!.burstInsufficientEnergy).toBe(2);
  });

  it("keeps sample seeds and script identity separate", () => {
    const second = { ...saved, seed: "2" };
    const batch = summarizeSourceHostEnergyRuns([saved, second]);
    expect(batch.seeds).toEqual(["1", "2"]);
    expect(batch.windows[0]!.dps.count).toBe(2);
    expect(() => summarizeSourceHostEnergyRuns([saved, { ...second, config: second.config + "\n" }])).toThrow(/脚本/);
    expect(addSourceHostRechargeContribution(saved.config, "xiangling", 0.2)).toContain("xiangling add stats er=0.2;");
    expect(() => addSourceHostRechargeContribution("xiangling char lvl=90/90\n cons=0 talent=1,1,1;", "xiangling", 0.2)).toThrow(/单行完整角色声明/);
  });
});
