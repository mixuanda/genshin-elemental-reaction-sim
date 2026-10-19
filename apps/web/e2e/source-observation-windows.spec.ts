import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { SourceHostBatchRun } from "../src/source-host-batch";

const config = `options iteration=1 duration=6;
noelle char lvl=90/90 cons=0 talent=1,1,1 +params=[start_energy=0];
noelle add weapon="favoniusgreatsword" refine=1 lvl=90/90;
noelle add stats def=200 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active noelle;
noelle attack:20;`;

type ExportedBatch = { schemaVersion: string; observationPolicy?: { warmupFrames: number; windowFrames: number }; runs: SourceHostBatchRun[] };
type RenderedWindow = { startFrame: number; endFrame: number; damage: { mean: number }; dps: { mean: number } };

test("source-host batch reuses two native seed traces across warmup and half-window analyses", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  await page.locator("#source-host-config").fill(config);
  await page.getByText("多种子与额外充能对照", { exact: true }).click();
  await page.locator("#source-batch-seeds").fill("1,2");
  await page.locator("#source-batch-er").fill("0");
  await page.locator("#source-batch-window-mode").selectOption("warmup");
  await page.locator("#source-batch-warmup").fill("1");
  await page.locator("#source-batch-window").fill("2");
  await expect(page.locator("#source-batch-window-hint")).toContainText("至少 5 秒");
  await page.locator("#source-batch-run").click();
  await expect(page.locator("#source-batch-status")).toContainText("全部运行已记录", { timeout: 90000 });
  await expect(page.locator("[data-source-batch-summary]")).toContainText("2次实际来源运行，1组精确配置");
  const policyText = page.locator("[data-source-batch-window-policy]");
  await expect(policyText).toContainText("预热 60 帧；每窗 120 帧");
  await expect(policyText).toContainText("[61, 181)");
  await expect(policyText).toContainText("[181, 301)");
  await expect(policyText).toContainText("分母 2 秒");

  const firstDownload = page.waitForEvent("download");
  await page.locator("#source-batch-export").click();
  const measuredJson = await readFile((await (await firstDownload).path())!, "utf8");
  const measured = JSON.parse(measuredJson) as ExportedBatch;
  expect(measured.schemaVersion).toBe("source-host-batch-v2");
  expect(measured.observationPolicy).toEqual({ warmupFrames: 60, windowFrames: 120 });
  expect(measured.runs).toHaveLength(2);
  expect(measured.runs.map(run => run.result.seed)).toEqual(["1", "2"]);
  for (const run of measured.runs) {
    expect(run.addedRecharge).toBe(0);
    expect(run.result.config).toBe(config);
    expect((run.result.result as { duration: number }).duration).toBe(360);
  }
  const details = JSON.parse((await page.locator("#source-batch-result details pre").textContent())!) as Array<{ windows: RenderedWindow[] }>;
  expect(details).toHaveLength(1);
  expect(details[0]!.windows.map(window => [window.startFrame, window.endFrame])).toEqual([[61, 181], [181, 301]]);
  for (const window of details[0]!.windows) {
    const damages = measured.runs.map(run => run.result.applications
      .filter(hit => hit.frame >= window.startFrame && hit.frame < window.endFrame)
      .reduce((sum, hit) => sum + hit.appliedDamage, 0));
    const meanDamage = damages.reduce((sum, value) => sum + value, 0) / damages.length;
    expect(window.damage.mean).toBeCloseTo(meanDamage, 7);
    expect(window.dps.mean).toBeCloseTo(meanDamage / 2, 7);
  }
  await writeFile("docs/validation/source-observation-windows-20260928.result.json", measuredJson);

  let workersDuringReanalysis = 0;
  page.on("worker", () => { workersDuringReanalysis++; });
  await page.locator("#source-batch-window-mode").selectOption("halves");
  await page.locator("#source-batch-reanalyze").click();
  await expect(page.locator("#source-batch-status")).toContainText("没有再次运行模拟");
  await expect(policyText).toContainText("完整轨迹前后半窗");
  expect(workersDuringReanalysis).toBe(0);
  const secondDownload = page.waitForEvent("download");
  await page.locator("#source-batch-export").click();
  const halves = JSON.parse(await readFile((await (await secondDownload).path())!, "utf8")) as ExportedBatch;
  expect(halves.schemaVersion).toBe("source-host-batch-v1");
  expect(halves.observationPolicy).toBeUndefined();
  expect(halves.runs).toEqual(measured.runs);

  await page.locator("#source-batch-import").setInputFiles({ name: "source-host-batch-v2.json", mimeType: "application/json", buffer: Buffer.from(measuredJson) });
  await expect(page.locator("#source-batch-window-mode")).toHaveValue("warmup");
  await expect(page.locator("#source-batch-warmup")).toHaveValue("1");
  await expect(page.locator("#source-batch-window")).toHaveValue("2");
  await expect(policyText).toContainText("[61, 181)");
  await expect(policyText).toContainText("[181, 301)");
  expect(errors).toEqual([]);
});
