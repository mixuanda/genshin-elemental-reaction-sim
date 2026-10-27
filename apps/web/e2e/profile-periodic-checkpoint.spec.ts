import { revealControl, runImportedScenario, downloadSimulationRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import type { ExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
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

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Execution profiles use the actual energy baseline and retain imported 1.0.0 structural semantics", async ({ page }) => {
  const seed = "kuki-profile-energy-reference";
  await page.goto("/rotation");
  await (await revealControl(page.locator("#rotation-source-kuki-skill-burst > summary"))).click();
  await (await revealControl(page.locator("#rotation-load-source-kuki-skill-burst"))).click();
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await (await revealControl(page.locator('[data-actor="0"][data-key="initialEnergy"]'))).fill("0");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill(seed);
  await (await revealControl(page.locator("#critModeInput"))).selectOption("noCrit");
  await (await revealControl(page.locator("#energyModeInput"))).selectOption("configured");
  await (await revealControl(page.locator("#iterationInput"))).fill("1");
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await (await revealControl(page.locator("#rotation-swap-actor"))).selectOption("amber");
  await (await revealControl(page.locator("#rotation-add-swap"))).click();
  await (await revealControl(page.locator('[data-request="4"]'))).fill("565");
  await (await revealControl(page.locator('[data-request="4"]'))).press("Tab");
  await (await revealControl(page.locator("#execution-profile"))).selectOption("practical-assumed-input");
  await (await revealControl(page.locator("#execution-preview"))).click();
  await expect(page.locator("[data-execution-baseline]")).toContainText(seed);
  await expect(page.locator("[data-execution-baseline]")).toContainText("configured");
  await expect(page.locator("[data-execution-baseline]")).toContainText("noCrit");
  await expect(page.locator("[data-execution-command]")).toHaveCount(5);
  expect(await page.locator("[data-execution-command] td:nth-child(4)").allTextContents()).toEqual(["3", "63", "318", "584", "591"]);
  await expect(page.locator('[data-execution-command="3"] td').nth(2)).toHaveText("未施放：INSUFFICIENT_ENERGY");
  await expect(page.locator('[data-execution-command="4"] td').nth(4)).toHaveText("6");
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator('[data-rotation-command="3"]')).toContainText("未施放：能量");
  await expect(page.locator('[data-rotation-command="3"] td').nth(2)).toHaveText("584");
  await expect(page.locator('[data-rotation-command="4"] td').nth(2)).toHaveText("591");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.executionProfile).toMatchObject({ id: "practical-assumed-input", version: "1.1.0", baselineMode: "runtime-energy-v1" });
  expect(record.sourceConfig.timeline!.commands.map(command => command.type === "wait" ? null : command.atFrame)).toEqual([1, 51, 300, 564, 565]);
  expect(record.result.config.timeline!.commands.map(command => command.type === "wait" ? null : command.atFrame)).toEqual([3, 63, 318, 584, 591]);
  expect(record.result.config.timeline!.abilities).toEqual(record.sourceConfig.timeline!.abilities);
  const baseline = record.executionBaseline!;
  expect(baseline.policy).toBe("fixed-reference-v1");
  expect(baseline.options).toEqual(record.options);
  expect(baseline.options).toMatchObject({ randomSeed: seed, critMode: "noCrit", energyMode: "configured" });
  expect(record.batchSummary.seed).toBe(seed);
  expect(baseline.changes.map(change => [change.originalStartTick, change.requestedTick, change.addedDelayFrames])).toEqual([[1, 3, 2], [51, 63, 10], [300, 318, 6], [564, 584, 2], [565, 591, 6]]);
  expect(baseline.changes[3]).toMatchObject({ baselineStatus: "rejected", baselineFailureCode: "INSUFFICIENT_ENERGY", reason: "ability-input" });
  expect(baseline.changes[4]).toMatchObject({ baselineStatus: "executed", reason: "swap-input" });
  expect(record.result.timelineExecution!.commandResults[3]).toMatchObject({ status: "rejected", startFrame: 584, failureCode: "INSUFFICIENT_ENERGY" });
  expect(record.result.timelineExecution!.commandResults[4]).toMatchObject({ status: "executed", startFrame: 591, endFrame: 592 });

  // A two-command compatibility input: E has naturally ended by swap@100.
  // Historical 1.0.0 still adds its adjacent-ability cancellation delay (10 total, not 6).
  const legacyProfile: ExecutionProfile = {
    id: "practical-assumed-input", version: "1.0.0", label: "旧版实用输入兼容样例", referenceFps: 60,
    inputDelayFrames: 2, swapDelayFrames: 6, cancellationDelayFrames: 4, evidence: "explicit-assumption",
    assumptions: ["旧版结构基线：相邻能力后的切人额外计4帧，不重解释为实际动画判断。"],
  };
  // Edited inputs are not a replay of the old saved result/witness.
  const legacyRecord = { format: "simulation-record-v1", sourceConfig: structuredClone(record.sourceConfig),
    options: structuredClone(record.options), iterations: record.iterations,
    executionProfile: legacyProfile, benchmark: record.benchmark };
  legacyRecord.executionProfile = legacyProfile;
  legacyRecord.sourceConfig.timeline!.commands = [legacyRecord.sourceConfig.timeline!.commands[0]!, { type: "swap", characterId: "amber", atFrame: 100 }];
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "legacy-1.0.0-profile-compatibility-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(legacyRecord)) });
  await runImportedScenario(page);
  await expect(page.locator("#randomSeedInput")).toHaveValue(seed);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await expect(page.locator("#execution-profile")).toHaveValue("stored-profile");
  await expect(page.locator('#execution-profile option:checked')).toContainText("1.0.0");
  await (await revealControl(page.locator("#execution-preview"))).click();
  await expect(page.locator("[data-execution-baseline]")).toContainText("旧版结构基线");
  await expect(page.locator('[data-execution-command="1"] td').nth(3)).toHaveText("112");
  await expect(page.locator('[data-execution-command="1"] td').nth(4)).toHaveText("10");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const restoredLegacy = await downloadSimulationRecord(page);
  expect(restoredLegacy.executionProfile).toEqual(legacyProfile);
  expect(restoredLegacy.executionProfile).not.toHaveProperty("baselineMode");
  expect(restoredLegacy).not.toHaveProperty("executionBaseline");
  expect(restoredLegacy.sourceConfig.timeline!.commands).toEqual(legacyRecord.sourceConfig.timeline!.commands);
  expect(restoredLegacy.result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual([3, 112]);
  expect(restoredLegacy.options).toEqual(record.options);
  console.info("Execution profile browser measurements", JSON.stringify({ version: record.executionProfile!.version,
    referenceSeed: baseline.options.randomSeed, requests: baseline.changes.map(change => change.requestedTick),
    failedQFrame: record.result.skippedActions[0]!.frame, postFailureSwapDelay: baseline.changes[4]!.addedDelayFrames,
    legacyVersion: restoredLegacy.executionProfile!.version, legacyRequests: restoredLegacy.result.timelineExecution!.commandResults.map(command => command.startFrame) }));
});

function periodicCheckpointFixture(): SimConfig {
  const refs = ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/skill.go"];
  const config = makeConfig({
    dataVersion: "synthetic-periodic-checkpoint-ui-v1", randomSeed: "deterministic-periodic-checkpoint-ui-v1",
    meta: { name: "合成机制验证：周期实体代次与锁定条件检查点", version: "synthetic-periodic-checkpoint-ui-v1", verificationStatus: "provisional", note: "明确合成帧数与面板，仅验证确定性实体和状态检查点，不代表真实角色。" },
    duration: 2, cycleLength: 2, rotation: [],
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
      characters: [{ actorId: "a", initialHpRatio: 1, resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "ring", actorId: "a", name: "合成确定性周期实体", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        actionPhase: "after-frame-tasks-v1",
        conditionalHitGroups: [{ id: "condition", kind: "owner-hp-at-action-v1", comparison: "lte", thresholdRatio: 1, hitIds: ["branch"], sourceRefs: refs }],
        hits: [{ id: "branch", frame: 20, scaling: 0.1, element: "physical", snapshot: "action" },
          { id: "tick-hit", frame: 0, scaling: 1, element: "physical", snapshot: "hit", flatSources: [{ stat: "em", multiplier: 1 }] }],
        periodicEntities: [{ kind: "periodic-active-heal-v1", id: "ring", label: "明确合成数据", spawnFrame: 0, durationFrames: 400,
          firstTickDelayFrames: 60, intervalFrames: 180, hitDelayFrames: 230, hitIds: ["tick-hit"],
          healing: { ownerHpCoefficient: 0, flat: 1, ownerEmCoefficient: 0, healingBonus: 0, incomingHealingBonus: 0 }, sourceRefs: refs }],
      }], commands: [{ type: "skill", actorId: "a", abilityId: "ring", atFrame: 0 }] },
  });
  config.characters[0]!.stats.em = 200;
  return config;
}

test("Deterministic periodic entities and accepted action conditions survive real startup Worker checkpoints and export", async ({ page }) => {
  const config = periodicCheckpointFixture();
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "periodic-condition-checkpoint.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.tab[data-tab="overview"]'))).click();
  await expect(page.locator("#overviewPanel")).toBeVisible();
  await (await revealControl(page.locator("#analysis-warmup-cycles"))).fill("9");
  await (await revealControl(page.locator("#analysis-warmup-energy"))).selectOption("configured");
  await (await revealControl(page.locator("#analysis-steady-run"))).click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  const report = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  const startup = report.startup, result = startup.result!;
  expect(startup.status).toBe("steady-state-established");
  expect(startup.startup).toMatchObject({ warmupTicks: 1080, measurementStartTick: 1080, measurementEndTick: 1200, simulationTicks: 1730 });
  expect(startup.steadyState).toMatchObject({ status: "established-from-simulation", periodCycles: 1 });
  expect(result.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
  expect(result.config.timeline!.abilities).toEqual(config.timeline!.abilities);
  const included = result.damageEvents.filter(event => startup.measurement!.includedDamageEventIds.includes(event.id));
  // One 0.1×ATK branch and one delayed (ATK + EM) hit, with equal levels and zero resistance.
  expect(included.map(event => [event.frame, event.finalDamage])).toEqual([[1100, 1000 * 0.1 * 0.5], [1130, (1000 + 200) * 0.5]]);
  expect(startup.measurement!.totalDamage).toBe(650);
  expect(startup.steadyState!.steadyStateDps).toBe(325);
  const checkpoint = result.executionAudit!.phaseCheckpoints.find(point => point.tick === 1080)!;
  const state = checkpoint.state as unknown as {
    entities: { periodicEntities: Array<{ relativeGeneration: number; live: boolean; spawnAgeTicks: number }> };
    pendingEvents: { inFlight: Array<{ type: string; remainingTicks: number; payload: {
      instance?: number; tickIndex?: number; willExecute?: boolean; periodicFlatSnapshots?: { a: { em: number } };
      periodicEntityContext?: { instance: number; tickIndex: number; snapshotAgeTicks: number };
    } }>; futureInputCycle: Array<{ priority: number }> };
    activeCharacterAndActionPhase: { lockedConditions: Array<{ selected: boolean; inputPriority: number; ownerCurrentHp: number }> };
  };
  expect(state.entities.periodicEntities.map(entity => [entity.relativeGeneration, entity.live, entity.spawnAgeTicks])).toEqual([[-1, false, 240], [0, true, 120]]);
  expect(state.pendingEvents.inFlight.map(event => [event.type, event.remainingTicks])).toEqual([["periodicEntityTick", 0], ["hit", 50], ["periodicEntityTick", 120], ["hit", 170]]);
  expect(state.pendingEvents.inFlight[0]!.payload).toEqual({ instance: 0, tickIndex: 1, willExecute: false });
  expect(state.pendingEvents.inFlight[2]!.payload).toEqual({ instance: 1, tickIndex: 1, willExecute: true });
  expect(state.pendingEvents.inFlight[1]!.payload.periodicFlatSnapshots!.a.em).toBe(200);
  expect(state.pendingEvents.inFlight[1]!.payload.periodicEntityContext).toEqual({ instance: 0, tickIndex: 0, snapshotAgeTicks: 180 });
  expect(state.pendingEvents.futureInputCycle[0]!.priority).toBe(8);
  expect(state.activeCharacterAndActionPhase.lockedConditions.map(condition => [condition.selected, condition.inputPriority, condition.ownerCurrentHp])).toEqual([[true, 8, 10000], [true, 8, 10000]]);
  expect(result.periodicEntityLog!.some(event => event.operation === "cancelled-tick")).toBe(true);
  expect(result.damageEvents.some(event => event.frame > 1200)).toBe(true);
  const ledger = page.locator("#analysis-startup-output [data-periodic-entity-ledger]");
  await expect(ledger.locator('[data-periodic-operation="replace"]').first()).toBeVisible();
  const cancelled = ledger.locator('[data-periodic-operation="cancelled-tick"]').first();
  await expect(cancelled).toBeVisible();
  await (await revealControl(cancelled.locator("details > summary"))).click();
  const displayed = JSON.parse((await cancelled.locator("pre").textContent())!);
  expect(displayed.entity).toEqual(result.periodicEntityLog!.find(event => event.id === displayed.entity.id));
  expect(displayed.entity.operation).toBe("cancelled-tick");
  const conditions = page.locator("#analysis-startup-output [data-action-condition-ledger]");
  await expect(conditions.locator("tr[data-action-condition-id]")).toHaveCount(9);
  await expect(conditions.locator('[data-action-condition-selected="true"]')).toHaveCount(9);
  console.info("Periodic checkpoint browser measurements", JSON.stringify({ simulationTicks: startup.startup.simulationTicks,
    measurement: [startup.startup.measurementStartTick, startup.startup.measurementEndTick], damage: startup.measurement!.totalDamage,
    dps: startup.steadyState!.steadyStateDps, periodCycles: startup.steadyState!.periodCycles,
    relativeGenerations: state.entities.periodicEntities.map(entity => entity.relativeGeneration),
    pending: state.pendingEvents.inFlight.map(event => [event.type, event.remainingTicks]), lockedConditions: state.activeCharacterAndActionPhase.lockedConditions.length }));
});
