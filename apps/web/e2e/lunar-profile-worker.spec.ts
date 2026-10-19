import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { CalculatorDocument, CalculatorResult, CapturedSpecialSimulation } from "@genshin-dps-lab/sim-core";
import type { ExecutionProfile } from "../../../packages/sim-core/src/execution-profiles";
import type { LunarBloomSimulationResult } from "../../../packages/sim-core/src/lunar-bloom-runtime";
import type { LunarExecutionBaselineAudit } from "../src/lunar-simulation-panel";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("lunar Worker applies the original runtime profile once and preserves an appended source cleanse", async ({ page }) => {
  const config = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-bloom-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  // Explicit baseline variant: automatic reactions are enabled only in the panel copy.
  delete config.reactionEngine;
  const profile: ExecutionProfile = { id: "lunar-worker-small-delay", version: "1.1.0", baselineMode: "runtime-energy-v1", label: "月绽放线程验证：每次输入1帧", referenceFps: 60,
    inputDelayFrames: 1, swapDelayFrames: 1, cancellationDelayFrames: 0, evidence: "explicit-assumption", assumptions: ["明确的合成1帧输入延迟；不是现实操作分布。"] };
  const seed = "lunar-worker-original-options-reference";
  const runtimeOptions = { energyMode: "configured", critMode: "noCrit", compatibilityMode: "legacy-v0.1", randomSeed: seed, execution: { captureHits: true, detailedTraces: false } };
  const inputRecord = { format: "simulation-record-v1", sourceConfig: config, options: runtimeOptions, executionProfile: profile, iterations: 1, benchmark: null };
  const workers: string[] = [];
  page.on("worker", worker => workers.push(worker.url()));
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "lunar-profile-worker-input.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(inputRecord)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(seed);
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  const ordinaryBeforeRefresh = await page.evaluate(() => window.GenshinDpsLab.getLastResult()!.reproducibilityKey);
  const workersBeforeRefresh = workers.length;
  await page.locator('[data-lunar-action="refresh"]').click();
  await expect(page.locator("[data-lunar-config]")).toContainText(config.meta.name);
  await expect(page.locator("[data-lunar-status]")).toContainText("尚未运行");
  expect(workers).toHaveLength(workersBeforeRefresh);
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult()!.reproducibilityKey)).toBe(ordinaryBeforeRefresh);
  const original = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(original.reactionEngine).toBeUndefined();

  await page.locator("[data-lunar-profile]").selectOption("lunar-bloom");
  await page.locator('[data-lunar-party-index="0"]').selectOption("columbina");
  await page.locator('[data-lunar-party-index="1"]').selectOption("nahida");
  await page.locator("[data-lunar-aura-v3]").check();
  await page.locator("[data-lb-source-enabled]").check();
  await page.locator('[data-lb-source-field="actorId"]').selectOption("c");
  await page.locator('[data-lb-source-field="requestedFrame"]').fill("160");
  await page.locator('[data-lb-source-field="talentLevel"]').fill("10");
  await page.locator('[data-lb-source-field="ascension"]').selectOption("6");
  await page.locator('[data-lb-source-field="constellation"]').selectOption("0");
  const workersBeforeRun = workers.length;
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator("[data-lunar-status]")).toContainText("实际结算 3 条月绽放事件");
  expect(workers.slice(workersBeforeRun)).toHaveLength(1);
  expect(workers.at(-1)).toContain("lunar-simulation-worker");
  await expect(page.locator("[data-lunar-execution-baseline]")).toContainText("runtime-energy-v1");
  const report = await downloadJson<CapturedSpecialSimulation & { result: LunarBloomSimulationResult; ui?: { executionBaseline?: LunarExecutionBaselineAudit } }>(page, '[data-lunar-action="export"]');
  const baseline = report.ui!.executionBaseline!;
  expect(baseline.profile).toEqual(profile);
  expect(baseline.sourceConfig).toEqual(original);
  expect(baseline.sourceConfig.reactionEngine).toBeUndefined();
  expect(baseline.sourceConfig.timeline!.commands).toHaveLength(4);
  expect(baseline.options).toEqual(runtimeOptions);
  expect(baseline.audit.baselineRuntimeOptions).toMatchObject({ randomSeed: seed, energyMode: "configured", critMode: "noCrit" });
  expect(baseline.audit.changes.map(row => [row.originalStartTick, row.requestedTick, row.addedDelayFrames])).toEqual([[0, 1, 1], [5, 7, 1], [6, 9, 1], [153, 157, 1]]);
  expect(report.request.profile).toBe("lunar-bloom");
  expect(report.request.options.randomSeed).toBe(seed);
  expect(report.result.baseResult.config.reactionEngine?.mode).toBe("aura-v5");
  expect(report.result.baseResult.config.timeline!.commands.map(row => row.type === "wait" ? null : row.atFrame)).toEqual([1, 7, 9, 157, 160]);
  expect(report.result.baseResult.timelineExecution!.commandResults.map(row => row.startFrame)).toEqual([1, 7, 9, 157, 160]);
  expect(report.result.baseResult.randomSeed).toBe(seed);
  expect(report.result.baseResult.resolvedRuntimeOptions.compatibilityMode).toBe("legal-frame-v1");
  expect(report.result.specialDamageEvents.map(row => row.frame)).toEqual([222, 230, 252]);
  expect(await page.evaluate(() => window.GenshinDpsLab.getConfig())).toEqual(original);
  const replayDifferences: number[] = [];
  for (const [index, event] of report.result.specialDamageEvents.entries()) {
    await page.locator(`[data-lunar-event="${event.id}"] > summary`).click();
    await page.locator(`[data-lunar-open-calculator="${event.id}"]`).click();
    await expect(page).toHaveURL(/\/calculator$/);
    const replay = JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!) as { document: CalculatorDocument; result: CalculatorResult };
    const hit = replay.document.hits[0]!;
    expect(hit.kind === "special" && hit.context).toEqual(event.context);
    expect(replay.result.totals?.expected).toBeCloseTo(event.damage, 10);
    replayDifferences.push(replay.result.totals!.expected - event.damage);
    if (index < report.result.specialDamageEvents.length - 1) await page.locator('.product-nav a[href="/results"]').click();
  }
  const measurement = { profile: baseline.profile, baselineOptions: baseline.options, originalReactionMode: baseline.sourceConfig.reactionEngine?.mode ?? "disabled", specialReactionMode: report.result.baseResult.config.reactionEngine?.mode,
    originalCommandCount: baseline.sourceConfig.timeline!.commands.length, delayedRequests: baseline.audit.changes.map(row => row.requestedTick), appendedCleanseRequest: 160,
    actualRequests: report.result.baseResult.timelineExecution!.commandResults.map(row => row.startFrame), specialFrames: report.result.specialDamageEvents.map(row => row.frame), replayDifferences,
    refreshSpawnedWorkers: workersBeforeRun - workersBeforeRefresh, runWorkerCount: 1, seed: report.result.baseResult.randomSeed };
  await writeFile("docs/validation/lunar-profile-worker-measurement.json", JSON.stringify(measurement, null, 2) + "\n");
});
