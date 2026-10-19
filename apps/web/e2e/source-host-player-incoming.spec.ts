import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

test("captures a real player hit and scalar receipts, then restores and edits its independent formula", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  await page.locator('[data-source-host-example="incoming"]').click();
  await page.locator("#source-host-seed").fill("20260927");
  await page.locator("#source-host-run").click();
  await expect(page.locator("#source-host-status")).toContainText("本次运行完成", { timeout: 45000 });
  await expect(page.locator("[data-source-host-incoming-ledger]")).toContainText("护盾吸收");

  const download = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const resultText = await readFile((await (await download).path())!, "utf8");
  const result = JSON.parse(resultText) as SourceHostResult;
  expect(result.playerApplications?.length).toBeGreaterThan(0);
  const incoming = result.playerApplications![0]!;
  const formula = result.calculations.find(row => row.request.id === incoming.calculationId);
  expect(formula?.request.kind).toBe("player-incoming");
  expect(incoming.rawDamage).toBe(formula?.value);
  expect(incoming.rawDamage - incoming.damageAfterShield).toBe(incoming.shieldAbsorbed);
  expect(result.calculations.some(row => {
    const provenance = (row.request as typeof row.request & { scalarProvenance?: { reads?: unknown[] } }).scalarProvenance;
    return (provenance?.reads?.length ?? 0) > 0;
  })).toBe(true);

  await page.locator("#source-host-import").setInputFiles({ name: "source-host-result.json", mimeType: "application/json", buffer: Buffer.from(resultText) });
  await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
  await expect(page.locator("#source-host-incoming-hit")).toContainText(`护盾前 ${incoming.rawDamage}`);
  await page.locator("#source-host-open-incoming-calculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator("[data-source-host-incoming-result] h3")).toContainText("捕获时");
  const scaling = page.locator('[data-source-host-incoming-input="flatDamage"]');
  await scaling.fill(String(Number(await scaling.inputValue()) + 100));
  await expect(page.locator("[data-source-host-incoming-result] h3")).toContainText("编辑后");
  const before = await page.locator("[data-source-host-incoming-result] h3").textContent();
  const editableDownload = page.waitForEvent("download");
  await page.locator("[data-source-host-incoming-export]").click();
  const editableText = await readFile((await (await editableDownload).path())!, "utf8");
  const editable = JSON.parse(editableText) as { originalCapture: { application: typeof incoming } };
  expect(editable.originalCapture.application).toEqual(incoming);
  await page.locator("#calc-source-host-close").click();
  await page.locator("#calc-import").setInputFiles({ name: "source-host-player-incoming-calculation.json", mimeType: "application/json", buffer: Buffer.from(editableText) });
  await expect(page.locator("[data-source-host-incoming-result] h3")).toHaveText(before!);
  expect(errors).toEqual([]);
  await writeFile("docs/validation/source-host-player-incoming-20260927.result.json", resultText);
  console.log(JSON.stringify({ incoming, calculations: result.calculations.length, hits: result.applications.length, scalarReads: result.calculations.reduce((sum, row) => sum + (row.request.scalarProvenance?.reads.length ?? 0), 0), edited: before, errors }));
});
