import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SeededRandomState } from "../../../packages/sim-core/src/energy";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadRecord(page: Page): Promise<SimulationRecord> {
  const pending = page.waitForEvent("download");
  await page.locator("#exportRunButton").click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as SimulationRecord;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

test("Random checkpoint overview shows actual boundary draw counts and restores the same JSON run", async ({ page }) => {
  const config = makeConfig({
    duration: 6, cycleLength: 2, randomSeed: "random-checkpoint-ui",
    meta: { name: "合成普通暴击检查点", version: "1", verificationStatus: "user-supplied" },
    rotation: [],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "ordinary", actorId: "a", name: "明确合成两次命中", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [15, 60].map(frame => ({ frame, scaling: 1, element: "physical" as const })) }],
      commands: [0, 120, 240].map(atFrame => ({ type: "normal" as const, actorId: "a", abilityId: "ordinary", atFrame })) },
  });
  config.characters[0]!.stats.critRate = 0.5;
  await page.goto("/results");
  await page.locator("#critModeInput").selectOption("seeded-random-v1");
  await page.locator("#checkpointInput").check();
  await page.locator("#iterationInput").fill("1");
  await page.locator("#importInput").setInputFiles({ name: "random-checkpoint.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  const record = await downloadRecord(page);
  expect(record.options.execution).toMatchObject({ criticalSampling: "seeded-random-v1", checkpointFrames: [0, 120, 240, 360] });
  const checkpoints = record.result.executionAudit!.phaseCheckpoints;
  expect(checkpoints.map(point => point.tick)).toEqual([0, 120, 240]);
  for (const point of checkpoints) {
    const captured = (point.state.icdAndTriggerHistory as { randomExecution: { version: string; streams: { critical: SeededRandomState } } }).randomExecution;
    expect(captured.version).toBe("named-rng-state-v1");
    expect(captured.streams.critical.drawCount).toBe(record.result.damageEvents.filter(hit => hit.frame < point.tick).length);
  }
  // The final requested frame lacks a future input cycle; captured earlier boundaries remain usable for inspection.
  expect(record.result.executionAudit!.checkpointCoverage.complete).toBe(false);
  expect(record.result.executionAudit!.checkpointCoverage.reasons.join(" ")).toContain("不足一个完整输入周期");

  await page.getByRole("button", { name: "总览", exact: true }).click();
  const overview = page.locator("#analysis-random-checkpoints");
  const boundary = overview.locator("[data-random-checkpoint-select]");
  const count = overview.locator('[data-random-stream="critical"] [data-random-draw-count]');
  await expect(overview).toContainText("状态捕获不等于随机稳态证明");
  await expect(boundary.locator("option")).toHaveText(["0 帧", "120 帧", "240 帧"]);
  await expect(count).toHaveText("0");
  await boundary.selectOption("1");
  await expect(overview.locator("caption")).toHaveText("120 帧事件执行前");
  await expect(count).toHaveText("2");
  await boundary.selectOption("2");
  await expect(count).toHaveText("4");
  await expect(page.locator("#analysis-steady-output")).toContainText("未建立稳态");

  await page.locator("#randomSeedInput").fill("discard-this-seed");
  await page.locator("#importInput").setInputFiles({ name: "random-checkpoint-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(config.randomSeed!);
  await waitForSimulation(page);
  const restored = await downloadRecord(page);
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.result.executionAudit).toEqual(record.result.executionAudit);
  await page.getByRole("button", { name: "总览", exact: true }).click();
  await boundary.selectOption("2");
  await expect(overview.locator("caption")).toHaveText("240 帧事件执行前");
  await expect(count).toHaveText("4");
});
