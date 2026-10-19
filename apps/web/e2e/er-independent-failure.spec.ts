import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { erIndependentFixture } from "../../../packages/sim-core/src/__tests__/er-independent-fixture";
import type { ErSearchResult } from "../../../packages/sim-core/src/simulation-analysis";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

test("ER-independent capacity failure exports its structured proof", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const config = erIndependentFixture();
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({
    name: "er-independent-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config)),
  });
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");

  await page.locator("#analysis-er-min").fill("100");
  await page.locator("#analysis-er-max").fill("200");
  await page.locator("#analysis-er-step").fill("100");
  await page.locator("#analysis-er-margin").fill("0");
  await page.locator("#analysis-er-run").click();
  await expect(page.locator("#analysis-er-output")).toContainText("充能无法解决当前失败");
  const proof = page.locator("[data-er-independent-proof]");
  await expect(proof).toBeVisible();
  await expect(proof).toContainText("第 2 条动作需要 61 能量");
  await expect(proof).toContainText("容量 60");
  await expect(proof).toContainText("1e-9");
  await expect(page.locator("#analysis-er-output details tbody tr")).toHaveCount(2);

  const report = await downloadJson<{ config: typeof config; energyRecharge: ErSearchResult }>(page, "#analysis-export");
  const exportedProof = report.energyRecharge.independentFailureProof;
  expect(report.energyRecharge.status).toBe("er-independent-failure");
  expect(exportedProof?.kind).toBe("cost-exceeds-capacity");
  if (exportedProof?.kind !== "cost-exceeds-capacity") throw new Error("Expected an energy-capacity proof");
  expect(exportedProof?.commandIndex).toBe(1);
  expect(report.config).toMatchObject({ ...config });
  expect(exportedProof.evidence.reproducibilityKey).toBe(report.energyRecharge.evaluated[0]?.reproducibilityKey);
  expect(exportedProof.evidence.failure.timelineCommandIndex).toBe(exportedProof.commandIndex);
  expect(report.energyRecharge.evaluated).toHaveLength(2);
  expect(pageErrors).toEqual([]);

  await writeFile(resolve("docs/validation/er-independent-failure-browser-20260930.result.json"), `${JSON.stringify({
    report,
    pageText: await page.locator("body").innerText(),
    pageErrors,
  }, null, 2)}\n`);
});
