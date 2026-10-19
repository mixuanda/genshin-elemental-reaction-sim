import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { normalizeOrdinaryReactionCheckpoint } from "../../../packages/sim-core/src/ordinary-aura-checkpoint";
import type { normalizeTargetPhaseV2Checkpoint } from "../../../packages/sim-core/src/target-phase-checkpoint";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

function syntheticTargetPhaseAuraCycle() {
  const application = (icdTag: string) => ({ gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1" as const, icdTag, profileId: "cycle" } });
  return makeConfig({
    dataVersion: "synthetic-ordinary-aura-target-phase-checkpoint-ui-v1",
    randomSeed: "ordinary-aura-target-phase-checkpoint-ui",
    meta: { name: "合成原生 v9 水火目标阶段检查点", version: "synthetic-ordinary-aura-target-phase-checkpoint-ui-v1", verificationStatus: "provisional", note: "原生 aura-v9、target-phase-v2 与关闭目标时钟的合成合法水火周期；不代表真实角色轮转或其它反应完整状态。" },
    duration: 2, cycleLength: 2,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    reactionEngine: { mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "hydro", actorId: "a", name: "合成水附着", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "hydro", frame: 0, scaling: 1, element: "hydro", application: application("hydro") }] },
        { id: "pyro", actorId: "a", name: "合成蒸发", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "pyro", frame: 0, scaling: 1, element: "pyro", application: application("pyro"),
            geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 },
            directDamageGroup: { icdTag: "damage", icdGroup: "pole-extra-attack" } }] },
      ],
      commands: [{ type: "skill", actorId: "a", abilityId: "hydro", atFrame: 0 }, { type: "skill", actorId: "a", abilityId: "pyro", atFrame: 108 }],
    },
  });
}

type NormalizedReactionState = ReturnType<typeof normalizeOrdinaryReactionCheckpoint>;
type CheckpointState = {
  auras: { targets: NonNullable<NormalizedReactionState["aura"]> };
  icdAndTriggerHistory: { directDamageGroups: NonNullable<NormalizedReactionState["damageGroups"]> };
  pendingEvents: { targetPhase: ReturnType<typeof normalizeTargetPhaseV2Checkpoint> };
};

test("Native aura-v9 target-phase-v2 warmup exports actual phase checkpoints and preserves amplified hit replay", async ({ page }) => {
  const config = syntheticTargetPhaseAuraCycle();
  await page.goto("/results");
  await page.locator("#critModeInput").selectOption("average");
  await page.locator("#importInput").setInputFiles({ name: "ordinary-aura-target-phase-cycle.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.sourceConfig).toEqual(config);
  expect(record.result.config.reactionEngine?.mode).toBe("aura-v9");
  expect(record.result.config.targetTaskModel.mode).toBe("target-phase-v2");
  expect(record.result.config.targetClockModel.mode).toBe("disabled");
  expect(record.result.targetPhaseLog.some(row => row.globalFrame === 108 && row.model === "target-phase-v2")).toBe(true);
  expect(record.result.damageEvents.map(event => [event.frame, event.finalDamage])).toEqual([[0, 500], [108, 750]]);

  await page.locator("#analysis-warmup-energy").selectOption("zero");
  await page.locator("#analysis-warmup-cycles").fill("8");
  await page.locator("#analysis-steady-run").click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-steady-cancel")).toBeHidden();
  await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  await expect(page.locator("#analysis-startup-output")).toContainText("[960, 1080)f");
  await expect(page.locator("#analysis-startup-output")).toContainText("稳态窗口 DPS 625");
  const analysis = await downloadJson<{ config: SimulationRecord["sourceConfig"]; startup: SimulationStartupResult }>(page, "#analysis-export");
  expect(analysis.config).toEqual(config);
  const startup = analysis.startup;
  expect(startup.status).toBe("steady-state-established");
  expect(startup.startup).toMatchObject({ warmupTicks: 960, observationTicks: 120, measurementStartTick: 960, measurementEndTick: 1080, simulationTicks: 1200, startupActionCount: 16 });
  // ATK1000, L90/90 DEF=0.5, zero RES: Hydro500 + reverse-Vaporize Pyro750 per two-second cycle.
  expect(startup.measurement).toMatchObject({ totalDamage: 1250, dps: 625, startTick: 960, endTick: 1080 });
  expect(startup.steadyState).toMatchObject({ status: "established-from-simulation", periodCycles: 1, steadyStateDps: 625 });
  const result = startup.result!;
  expect(result.config.reactionEngine).toEqual(config.reactionEngine);
  expect(result.config.targetTaskModel).toEqual(config.targetTaskModel);
  expect(result.config.targetClockModel).toEqual(config.targetClockModel);
  expect(result.resolvedRuntimeOptions.execution?.criticalSampling).toBeUndefined();
  expect(result.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
  const checkpoints = result.executionAudit!.phaseCheckpoints;
  expect(checkpoints.map(checkpoint => checkpoint.tick)).toEqual([480, 600, 720, 840, 960]);
  const rawGauge = 0.8 - 108 * (0.8 / 570) - 0.5;
  for (const checkpoint of checkpoints) {
    expect(checkpoint.state).toEqual(checkpoints[0]!.state);
    const state = checkpoint.state as unknown as CheckpointState;
    const target = state.auras.targets[0]!;
    expect(target).toMatchObject({ targetId: "enemy-0", version: "ordinary-aura-state-v1", mode: "aura-v9", reactableTickModel: "cached-boundary-v2", reactableLifecycleBoundaries: [], materializedAgeTicks: 12 });
    expect(target.auras).toHaveLength(1);
    expect(target.auras[0]!.element).toBe("hydro");
    expect(target.auras[0]!.gaugeUnits).toBeCloseTo(rawGauge, 12);
    expect(target.auras[0]!.decayPerFrame).toBeCloseTo(0.8 / 570, 12);
    expect(target.auras[0]!.sourceSlots).toHaveLength(1);
    expect(target.auras[0]!.sourceSlots![0]!.sourceActorId).toBe("a");
    expect(target.auras[0]!.sourceSlots![0]!.gaugeUnits).toBeCloseTo(rawGauge, 12);
    expect(target.applicationIcd.legacyWindows).toMatchObject([{ icdTag: "pyro", nextHitIndex: 1, resetRemainingTicks: 48, windowAgeTicks: 12 }]);
    expect(state.icdAndTriggerHistory.directDamageGroups[0]!.windows).toMatchObject([{ nextHitIndex: 1, resetRemainingTicks: 17, windowAgeTicks: 12 }]);
    // The real target-phase state has no future decay work at this event-before boundary.
    // Non-empty pending work and FIFO distinctions are exercised by the focused core case.
    expect(state.pendingEvents.targetPhase).toEqual({ model: "target-phase-v2", scheduledDecay: [], completedDecay: [], phases: [] });
  }
  expect(result.damageEvents.filter(hit => hit.element === "pyro").every(hit => hit.reaction === "reverseVaporize")).toBe(true);
  expect(result.skippedActions).toEqual([]);

  // The visible hit table remains the original actual run; startup is a separate complete exported trajectory.
  const pyro = record.result.damageEvents.find(event => event.element === "pyro")!;
  expect(pyro.reaction).toBe("reverseVaporize");
  await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
  await page.locator(`#hitTableBody tr[data-hit-id="${pyro.id}"]`).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(sourceTrace.length).toBeGreaterThan(0);
  await page.locator("#openHitCalculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const restoredTrace = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(restoredTrace).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(pyro.id);
  expect(captured.sourceResult).toEqual(record.result);
});
