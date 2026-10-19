import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { DataDiscoveryReview } from "../../../packages/game-data/src/update-status";

test("imports a pipeline failure receipt read-only and clears stale output on invalid import", async ({ page }) => {
  const path = "docs/validation/update-discovery-fixture-20260929.review.json";
  const raw = await readFile(path, "utf8"), receipt = JSON.parse(raw) as DataDiscoveryReview;
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/updates");
  await page.locator("[data-update-review-import]").setInputFiles({ name: "review-receipt.json", mimeType: "application/json", buffer: Buffer.from(raw) });
  const view = page.locator("[data-imported-update-review]");
  await expect(page.locator("[data-update-review-status]")).toContainText(receipt.generatedAt);
  await expect(view).toContainText(`账本共 ${receipt.failureHistory.count} 条`);
  for (const entry of receipt.failureHistory.recent) await expect(view).toContainText(entry.error);
  if (receipt.candidateReview?.error) await expect(view).toContainText(receipt.candidateReview.error);
  await expect(view).toContainText("当前计算数据保持不变");
  await page.locator("[data-update-review-import]").setInputFiles({ name: "invalid-review.json", mimeType: "application/json", buffer: Buffer.from('{"schemaVersion":"wrong"}') });
  await expect(page.locator("[data-update-review-status]")).toContainText("回执无法读取");
  await expect(view).toBeEmpty();
  expect(pageErrors).toEqual([]);
  await writeFile("docs/validation/update-review-browser-20260929.result.json", JSON.stringify({
    fixture: path, generatedAt: receipt.generatedAt, failureCount: receipt.failureHistory.count,
    candidateStatus: receipt.candidateReview?.status, importDisplayed: true, invalidImportClearedOutput: true,
    pageErrors, remoteWorkflowExecuted: false,
  }, null, 2) + "\n");
});
