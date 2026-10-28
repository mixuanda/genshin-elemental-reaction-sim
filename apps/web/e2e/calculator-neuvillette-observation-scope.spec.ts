import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { sourceActionReceipts } from "../../../packages/sim-core/src/source-host-action-origin";
import { captureSourceHostActionCollection, calculateSourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import type { SourceSingleSkillDraft } from "../src/source-single-skill";

async function exported(page: Page) {
  const pending = page.waitForEvent("download"); await page.locator("[data-single-result-export]").click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as { input: SourceSingleSkillDraft; result: SourceHostResult };
}

test("Neuvillette Q partial window stays a subtotal; a zero-energy rerun cannot borrow the previous Q", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/calculator"); await page.locator("#calc-character").selectOption("character:10000087");
  await page.locator('[data-neuvillette-native-outputs] [data-source-action="burst"]').click();
  const panel = page.locator("[data-source-single-skill]");
  await expect(panel.locator("[data-single-action]")).toHaveValue("burst");
  await panel.locator("[data-single-startup]").selectOption("full");
  await panel.locator('[data-single-advanced="run"] > summary').click();
  await panel.locator("[data-single-duration]").fill("2.2"); await panel.locator("[data-single-seed]").fill("11");
  await panel.locator("[data-single-run]").click();
  await expect(panel.locator("[data-single-status]")).toContainText("运行完成", { timeout: 45000 });
  const partial = await exported(page);
  await writeFile(testInfo.outputPath("q-partial-window.native.json"), JSON.stringify(partial));
  expect(partial.input.startup).toBe("full"); expect(partial.result.applications).toHaveLength(1);
  expect(partial.result.applications[0]!.frame).toBe(101);
  const actions = sourceActionReceipts(partial.result.logs).filter(row => row.action === "burst" && row.acceptedFrame !== undefined);
  expect(actions).toHaveLength(1);
  const collection = captureSourceHostActionCollection(partial.result, actions[0]!.sequence, "creation");
  const calculation = calculateSourceHostActionCollection(collection);
  expect(calculation.completeCast).toBe(false); expect(calculation.knownSubtotal).toBeCloseTo(24409.6621312273, 8);
  expect(calculation.knownSubtotal!).toBeLessThan(44381.23236005475);
  await expect(panel.locator("[data-single-finite-cast-total]")).toHaveCount(0);
  const help = panel.locator("[data-neuvillette-formula-help]"); await expect(help).not.toHaveAttribute("open");
  await help.locator(":scope > summary").click();
  await expect(help).toContainText("不用后续命中时的生命上限替换");
  await expect(help).toContainText("不是随机均值、完整施放伤害或循环DPS");
  await page.screenshot({ path: testInfo.outputPath("q-partial-formula.png"), fullPage: true });

  await panel.locator("[data-single-startup]").selectOption("zero");
  await expect(panel.locator("[data-single-result-stale]")).toBeVisible();
  await panel.locator("[data-single-run]").click();
  await expect(panel.locator("[data-single-status]")).toContainText("运行完成", { timeout: 45000 });
  const zero = await exported(page);
  await writeFile(testInfo.outputPath("q-zero-energy.native.json"), JSON.stringify(zero));
  expect(zero.input.startup).toBe("zero"); expect(zero.result.applications).toEqual([]);
  expect(sourceActionReceipts(zero.result.logs).filter(row => row.action === "burst" && row.acceptedFrame !== undefined)).toEqual([]);
  expect(zero.result.energyApplications).toBeDefined();
  if (!zero.result.energyApplications) throw new Error("Missing native energy observation; absence is not evidence of no consumption");
  expect(zero.result.energyApplications.filter(event => event.operation === "consume")).toEqual([]);
  await expect(panel.locator("[data-single-finite-cast-total]")).toHaveCount(0);
  await expect(panel.locator("[data-single-known-subtotal]")).toHaveCount(0);
  await expect(panel.locator('[data-source-single-result] [role="alert"]')).toContainText("无法选择唯一已接受动作");
  await writeFile(testInfo.outputPath("observation-scope-summary.json"), JSON.stringify({
    partial: { input: partial.input, appliedFrames: partial.result.applications.map(hit => hit.frame), knownSubtotal: calculation.knownSubtotal, completeCast: calculation.completeCast },
    zero: { input: zero.input, applications: zero.result.applications.length, acceptedBursts: 0, energyConsumptions: 0 },
    wasm: partial.result.executionArtifact,
  }, null, 2));
  expect(errors).toEqual([]);
});
