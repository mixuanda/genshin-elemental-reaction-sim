import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SOURCE_HOST_STELLAR_COMMIT, type SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

test("runs Stellar source receipts and restores an edited standalone contributor", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  await page.locator('[data-source-host-example="stellar"]').click();
  await page.locator("#source-host-variant").selectOption("stellar");
  await page.locator("#source-host-seed").fill("20260927");
  await expect(page.locator("[data-source-inventory-count]")).toContainText("420");
  await page.locator("#source-host-run").click();
  await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 60000 });
  await expect(page.locator("#source-host-status")).toContainText("本次运行完成");

  const download = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const resultText = await readFile((await (await download).path())!, "utf8");
  const result = JSON.parse(resultText) as SourceHostResult;
  expect(result.sourceCommit).toBe(SOURCE_HOST_STELLAR_COMMIT);
  expect(result.executionArtifact?.wasmSha256).toMatch(/^[a-f0-9]{64}$/);
  const kinds = result.calculations.map(row => row.request.kind);
  for (const kind of ["stellar-contributor", "stellar-ranked", "stellar-delivery", "stellar-direct"]) {
    expect(kinds, `missing actual ${kind} receipt`).toContain(kind);
  }
  await writeFile(resolve("docs/validation/source-host-stellar-20260927.result.json"), `${JSON.stringify(result, null, 2)}\n`);

  await page.locator("#source-host-import").setInputFiles({
    name: "source-host-stellar-result.json", mimeType: "application/json", buffer: Buffer.from(resultText),
  });
  await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
  const byId = new Map(result.calculations.map(row => [row.request.id, row]));
  const hitIndex = result.applications.findIndex(row => byId.get(row.calculationId)?.request.kind === "stellar-delivery");
  expect(hitIndex).toBeGreaterThanOrEqual(0);
  await page.locator("#source-host-hit-index").fill(String(hitIndex));
  await expect(page.locator("#source-host-hit")).toContainText("差值 0");
  await expect(page.locator("#source-host-hit")).toContainText("交付时目标抗性倍率");
  await page.locator("#source-host-open-calculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  const resultHeading = page.locator("[data-source-host-calculation-result] h3");
  await expect(resultHeading).toContainText("捕获时");
  const numericValue = (heading: string | null): number => {
    const match = heading?.match(/公式伤害：([^\s]+)/);
    if (!match) throw new Error(`Standalone calculator has no numeric damage: ${heading}`);
    const value = Number(match[1]);
    if (!Number.isFinite(value)) throw new Error(`Standalone calculator produced invalid damage: ${heading}`);
    return value;
  };
  const originalValue = numericValue(await resultHeading.textContent());
  const em = page.locator('[data-source-host-component-field="elementalMastery"]').first();
  await expect(em).toBeVisible();
  await em.fill(String(Number(await em.inputValue()) + 100));
  await expect(resultHeading).toContainText("编辑后");
  const editedHeading = await resultHeading.textContent();
  const editedValue = numericValue(editedHeading);
  expect(editedValue).not.toBe(originalValue);

  const editedDownload = page.waitForEvent("download");
  await page.locator("[data-source-host-export]").click();
  const editedText = await readFile((await (await editedDownload).path())!, "utf8");
  const edited = JSON.parse(editedText) as { originalCapture: { application: { id: number } }; components: Array<{ request: { kind: string } }> };
  expect(edited.originalCapture.application.id).toBe(result.applications[hitIndex]!.id);
  expect(edited.components.some(row => row.request.kind === "stellar-contributor")).toBe(true);
  await page.locator("#calc-source-host-close").click();
  await page.locator("#calc-import").setInputFiles({
    name: "source-host-stellar-calculation.json", mimeType: "application/json", buffer: Buffer.from(editedText),
  });
  await expect(resultHeading).toHaveText(editedHeading!);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({
    sourceCommit: result.sourceCommit, calculations: result.calculations.length,
    applications: result.applications.length,
    stellarContributors: kinds.filter(kind => kind === "stellar-contributor").length,
    stellarRanked: kinds.filter(kind => kind === "stellar-ranked").length,
    stellarDeliveries: kinds.filter(kind => kind === "stellar-delivery").length,
    stellarDirect: kinds.filter(kind => kind === "stellar-direct").length,
    hitIndex, originalValue, editedValue, wasmSha256: result.executionArtifact?.wasmSha256, errors,
  }));
});
