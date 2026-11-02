import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

async function resultText(page: Page): Promise<string> {
  const pending = page.waitForEvent("download"); await page.locator("[data-single-result-export]").click();
  return readFile((await (await pending).path())!, "utf8");
}
async function openPanel(page: Page) {
  await page.goto("/calculator"); await page.locator("#calc-character").selectOption("character:10000087");
  await page.locator('[data-neuvillette-native-outputs] [data-source-action="burst"]').click();
  await expect(page.locator("[data-single-run]")).toBeEnabled();
}
async function workerCount(page: Page) {
  return page.evaluate(() => (window as typeof window & { archiveWorkerStarts: number }).archiveWorkerStarts);
}
async function importText(page: Page, text: string) {
  await page.locator("[data-single-import]").setInputFiles({ name: "saved-single-result.json", mimeType: "application/json", buffer: Buffer.from(text) });
}

test("native result restores exact input and original bytes without a Worker; zero-energy save never borrows old Q", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    const state = window as typeof window & { archiveWorkerStarts: number }; state.archiveWorkerStarts = 0;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); state.archiveWorkerStarts++; }
    };
  });
  await openPanel(page);
  await page.locator('[data-single-advanced="run"] > summary').click();
  await page.locator("[data-single-duration]").fill("2.2"); await page.locator("[data-single-seed]").fill("11");
  await page.locator("[data-single-startup]").selectOption("full");
  await page.locator("[data-single-run]").click();
  await expect(page.locator("[data-single-status]")).toContainText("运行完成", { timeout: 45000 });
  const fresh = JSON.parse(await resultText(page));
  expect(fresh.result.applications).toHaveLength(1);
  const original = JSON.stringify({ ...fresh, sourceNote: "synthetic reference provenance; preserve this annotation" }, null, 4) + "\n";
  await writeFile(testInfo.outputPath("original-positive.native.json"), original);

  await openPanel(page); const beforeImport = await workerCount(page);
  await importText(page, original);
  await expect(page.locator("[data-single-status]")).toContainText("已打开保存的单动作结果");
  expect(await workerCount(page)).toBe(beforeImport);
  await expect(page.locator("[data-single-action]")).toHaveValue("burst");
  await expect(page.locator("[data-single-startup]")).toHaveValue("full");
  await expect(page.locator("[data-single-seed]")).toHaveValue("11");
  await expect(page.locator("[data-single-duration]")).toHaveValue("2.2");
  await expect(page.locator("[data-single-known-subtotal]")).toContainText("24409.6621312273");
  expect(await resultText(page)).toBe(original);

  const mismatch = JSON.parse(original); mismatch.input.startup = "zero";
  await importText(page, JSON.stringify(mismatch));
  await expect(page.locator("[data-single-status]")).toContainText("导入失败");
  expect(await workerCount(page)).toBe(beforeImport);
  expect(await resultText(page)).toBe(original);
  await expect(page.locator("[data-single-startup]")).toHaveValue("full");

  await page.locator("[data-single-startup]").selectOption("zero");
  await expect(page.locator("[data-single-result-stale]")).toBeVisible();
  expect(await resultText(page)).toBe(original); // edits never overwrite the archived original
  await page.locator("[data-single-run]").click();
  await expect(page.locator("[data-single-status]")).toContainText("运行完成", { timeout: 45000 });
  const zeroText = await resultText(page), zero = JSON.parse(zeroText);
  expect(zero.input.startup).toBe("zero"); expect(zero.result.applications).toEqual([]);
  await writeFile(testInfo.outputPath("zero-after-explicit-run.native.json"), zeroText);
  await openPanel(page); const beforeZeroImport = await workerCount(page);
  await importText(page, zeroText);
  await expect(page.locator("[data-single-status]")).toContainText("已打开保存的单动作结果");
  expect(await workerCount(page)).toBe(beforeZeroImport);
  await expect(page.locator("[data-single-startup]")).toHaveValue("zero");
  await expect(page.locator("[data-single-known-subtotal]")).toHaveCount(0);
  await expect(page.locator('[data-source-single-result] [role="alert"]')).toContainText("无法选择唯一已接受动作");
  expect(await resultText(page)).toBe(zeroText);
  await page.screenshot({ path: testInfo.outputPath("zero-result-reopened.png"), fullPage: true });
  await writeFile(testInfo.outputPath("reopen-summary.json"), JSON.stringify({
    positiveApplications: fresh.result.applications.length, positiveFrame: fresh.result.applications[0].frame,
    positiveSubtotal: fresh.result.applications[0].rawDamage, positiveExactBytes: true,
    rejectedStartupMismatch: true, failedImportPreservedPrevious: true, editorChangesKeptOriginalExport: true,
    zeroApplications: zero.result.applications.length, zeroExactBytes: true,
    positiveImportWorkerDelta: 0, zeroImportWorkerDelta: 0, zeroCreatedOnlyAfterExplicitRun: true,
  }, null, 2));
});
