import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

function syntheticBoundaryWeaponCycle() {
  const application = (icdTag: string) => ({ gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1" as const, icdTag, profileId: "cycle" } });
  return makeConfig({
    dataVersion: "synthetic-weapon-proc-checkpoint-ui-v1", randomSeed: "weapon-proc-checkpoint-ui",
    meta: { name: "合成跨周期武器追击检查点", version: "synthetic-weapon-proc-checkpoint-ui-v1", verificationStatus: "user-supplied", note: "原生 v9 水火与合法三角色闭合轮转，专用于验证实际追击冷却、跨边界快照与完整检查点；不是实际角色构筑。" },
    duration: 16, cycleLength: 16,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "合成中心", position: { x: 0, y: 0 }, hitboxRadius: 0 },
      { id: "edge", name: "合成边缘", position: { x: 3, y: 0 }, hitboxRadius: 0, resistance: 0.5 },
    ] },
    characters: ["a", "b", "c"].map(id => ({ id, name: `合成持有者 ${id}`, element: "pyro" as const, color: "#ff0000", level: 90,
      energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } })),
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [
      { actorId: "a", weaponId: "halberd", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "b", weaponId: "ashgravendrinkinghorn", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "c", weaponId: "sequenceofsolitude", refinement: 1, physicalDamageBonus: 0 },
    ] },
    reactionEngine: { mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
      abilities: [
        { id: "host-a", actorId: "a", name: "明确合成水宿主", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "hit-a", frame: 0, scaling: 0, element: "hydro", attackTag: "normal", application: application("hydro"),
            geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 } }] },
        { id: "host-b", actorId: "b", name: "明确合成火宿主", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "hit-b", frame: 0, scaling: 0, element: "pyro", attackTag: "normal", application: application("pyro"),
            geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 } }] },
        { id: "host-c", actorId: "c", name: "明确合成物理宿主", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          buffs: [{ key: "trigger-hp", target: "self", stat: "hpPct", value: 1, durationFrames: 1, startFrame: 0 }],
          hits: [{ id: "hit-c", frame: 0, scaling: 0, element: "physical", attackTag: "normal" }] },
      ],
      commands: [
        { type: "swap", characterId: "a", atFrame: 0 }, { type: "skill", actorId: "a", abilityId: "host-a", atFrame: 955 },
        { type: "swap", characterId: "b", atFrame: 956 }, { type: "skill", actorId: "b", abilityId: "host-b", atFrame: 957 },
        { type: "swap", characterId: "c", atFrame: 958 }, { type: "skill", actorId: "c", abilityId: "host-c", atFrame: 959 },
      ],
    },
  });
}

type CheckpointState = {
  buffsAndDebuffs: { buffs: unknown[] };
  icdAndTriggerHistory: { weaponProcs: { mode: string; actors: Array<{ actorId: string; remainingCooldownTicks: number | null }> } };
  pendingEvents: { inFlight: Array<{ type: string; remainingTicks: number; priority: number; payload: {
    targetIndex: number; action: { id: string }; snapshots: Record<string, { hpPct: number }>;
    weaponProcContext: { triggerAgeTicks: number; triggerBuffStatuses: Array<{ startAgeTicks: number; endRemainingTicks: number }> };
  } }> };
};

async function runWarmup(page: Page): Promise<SimulationStartupResult> {
  await (await revealControl(page.locator("#analysis-warmup-energy"))).selectOption("zero");
  await (await revealControl(page.locator("#analysis-warmup-cycles"))).fill("8");
  await (await revealControl(page.locator("#analysis-steady-run"))).click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  const report = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  return report.startup;
}

test("Weapon proc warmup preserves real inclusive cooldown and cross-boundary snapshots through saved input replay", async ({ page }) => {
  const config = syntheticBoundaryWeaponCycle();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "weapon-proc-boundary.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig).toEqual(config);
  expect(record.result.config.reactionEngine?.mode).toBe("aura-v9");
  expect(record.result.config.targetTaskModel.mode).toBe("target-phase-v2");
  const originalBoundaryHits = record.result.damageEvents.filter(event => event.frame === 960 && event.weaponProcLogId !== undefined);
  expect(originalBoundaryHits.map(event => [event.targetId, event.finalDamage])).toEqual([["enemy-0", 4000], ["edge", 2000]]);
  expect(originalBoundaryHits.every(event => event.statsBeforeDamage.hpPct === 1)).toBe(true);

  const startup = await runWarmup(page);
  await expect(page.locator("#analysis-startup-output")).toContainText("[7680, 8640)f");
  await expect(page.locator("#analysis-startup-output")).toContainText("稳态窗口 DPS 612.5");
  expect(startup.status).toBe("steady-state-established");
  expect(startup.startup).toMatchObject({ warmupTicks: 7680, measurementStartTick: 7680, measurementEndTick: 8640, simulationTicks: 9600 });
  expect(startup.measurement).toMatchObject({ startTick: 7680, endTick: 8640, totalDamage: 9800, dps: 612.5 });
  expect(startup.steadyState).toMatchObject({ periodCycles: 1, status: "established-from-simulation", steadyStateDps: 612.5 });
  const result = startup.result!;
  expect(result.config.weaponProcModel).toEqual(config.weaponProcModel);
  expect(result.config.reactionEngine).toEqual(config.reactionEngine);
  expect(result.config.targetTaskModel).toEqual(config.targetTaskModel);
  expect(result.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
  const points = result.executionAudit!.phaseCheckpoints;
  expect(points.map(point => point.tick)).toEqual([3840, 4800, 5760, 6720, 7680]);
  for (const point of points) {
    expect(point.state).toEqual(points[0]!.state);
    const state = point.state as unknown as CheckpointState;
    expect(state.icdAndTriggerHistory.weaponProcs.mode).toBe("fixed-source-no-character-hitlag-v1");
    expect(state.icdAndTriggerHistory.weaponProcs.actors.map(actor => [actor.actorId, actor.remainingCooldownTicks])).toEqual([["a", 595], ["b", 897], ["c", 899]]);
    expect(state.buffsAndDebuffs.buffs).toEqual([]);
    const pending = state.pendingEvents.inFlight.filter(event => event.type === "hit");
    expect(pending.map(event => [event.remainingTicks, event.priority, event.payload.targetIndex])).toEqual([[0, 3, 0], [0, 3, 1]]);
    for (const event of pending) {
      expect(event.payload).toMatchObject({ action: { id: "weapon-proc:c:sequenceofsolitude" }, snapshots: { c: { hpPct: 1 } },
        weaponProcContext: { triggerAgeTicks: 1, triggerBuffStatuses: [{ startAgeTicks: 1, endRemainingTicks: 0 }] } });
    }
  }
  const includedIds = new Set(startup.measurement!.includedDamageEventIds);
  const incoming = result.damageEvents.filter(event => event.frame === 7680 && event.weaponProcLogId !== undefined);
  const outgoing = result.damageEvents.filter(event => event.frame === 8640 && event.weaponProcLogId !== undefined);
  expect(incoming.map(event => event.finalDamage)).toEqual([4000, 2000]);
  expect(outgoing.map(event => event.finalDamage)).toEqual([4000, 2000]);
  expect(incoming.every(event => includedIds.has(event.id))).toBe(true);
  expect(outgoing.every(event => !includedIds.has(event.id))).toBe(true);
  // Independent hand sum for the half-open window: previous-cycle Sequence + current Halberd and Horn.
  expect(startup.measurement!.totalDamage).toBe((20000 * 0.4 * 0.5 * 1.5) + (1000 * 1.6 * 0.5) + (10000 * 0.4 * 0.5 * 1.5));
  const carryInDecision = result.weaponProcLog!.find(entry => entry.weaponId === "sequenceofsolitude" && entry.frame === 7679 && entry.outcome === "triggered")!;
  const carryIn = page.locator(`[data-measurement-weapon-proc-ledger] [data-weapon-proc-id="${carryInDecision.id}"]`);
  await expect(carryIn).toHaveAttribute("data-weapon-proc-decision-in-window", "false");
  await expect(carryIn.locator("[data-weapon-proc-carry-in]")).toContainText("窗口前已触发，区间内交付");

  // Restore the actual saved input record, then rerun the same analysis; no checkpoint/result is supplied as an input.
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "weapon-proc-boundary-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.options.randomSeed);
  const reloaded = await downloadSimulationRecord(page);
  expect(reloaded.sourceConfig).toEqual(record.sourceConfig);
  expect(reloaded.options).toEqual(record.options);
  expect(reloaded.result).toEqual(record.result);
  expect(await runWarmup(page)).toEqual(startup);

  // The ordinary hit table's actual terminal-frame Sequence retains its expired HP buff's trigger snapshot.
  const hit = originalBoundaryHits[1]!;
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${hit.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(sourceTrace.length).toBeGreaterThan(0);
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const restoredTrace = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(restoredTrace).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(hit.id);
  expect(captured.sourceResult).toEqual(record.result);
});
