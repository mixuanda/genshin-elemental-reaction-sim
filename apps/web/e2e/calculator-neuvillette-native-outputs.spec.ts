import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { sourceActionReceipts } from "../../../packages/sim-core/src/source-host-action-origin";
import { captureSourceHostActionCollection, calculateSourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import { replaySourceHostHit } from "../../../packages/sim-core/src/source-host-capture";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import type { SourceSingleSkillDraft } from "../src/source-single-skill";

async function download(page: Page, selector: string) {
  const pending = page.waitForEvent("download"); await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8"));
}
test("Neuvillette main output buttons retain his real native charge/Q, energy and independent equipment", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/calculator"); await page.locator("#calc-character").selectOption("character:10000087");
  const outputs = page.locator("[data-neuvillette-native-outputs]");
  await expect(outputs).toContainText("参考构筑");
  await outputs.locator('[data-source-action="charge"]').click();
  const panel = page.locator("[data-source-single-skill]");
  await expect(panel.locator("[data-single-character]")).toHaveValue("neuvillette");
  await expect(panel.locator("[data-single-action]")).toHaveValue("charge");
  await expect(panel.locator('[data-single-param="short"]')).toBeVisible();
  await expect(panel).toContainText("衡平推裁命中次数上限");
  await expect(panel.locator("[data-single-status]")).toContainText("参考构筑");
  await panel.locator("[data-single-startup]").selectOption("zero");
  await panel.locator('[data-single-param="short"]').fill("0");
  await panel.locator('[data-single-advanced="run"] > summary').click();
  await panel.locator("[data-single-duration]").fill("12"); await panel.locator("[data-single-seed]").fill("11");
  const chargeInput = await download(page, "[data-single-export-input]") as SourceSingleSkillDraft;
  expect(chargeInput.member.characterKey).toBe("neuvillette"); expect(chargeInput.startup).toBe("zero");
  expect(chargeInput.action).toEqual({ kind: "charge", params: { short: 0 } });
  expect(chargeInput.member).not.toHaveProperty("stats"); // final panels are not reinterpreted as equipment
  await panel.locator("[data-single-run]").click();
  await expect(panel.locator("[data-single-status]")).toContainText("运行完成", { timeout: 60000 });
  const charge = await download(page, "[data-single-result-export]") as { input: SourceSingleSkillDraft; result: SourceHostResult };
  await writeFile(testInfo.outputPath("neuvillette-charge-native.json"), JSON.stringify(charge));
  expect(charge.input).toEqual(chargeInput);
  const accepted = sourceActionReceipts(charge.result.logs).filter(row => row.acceptedFrame !== undefined && row.action === "charge");
  expect(accepted).toHaveLength(1); expect(accepted[0]!.characterKey).toBe("neuvillette");
  const chargeCollection = captureSourceHostActionCollection(charge.result, accepted[0]!.sequence, "creation");
  const chargeAnalysis = calculateSourceHostActionCollection(chargeCollection);
  expect(chargeCollection.hits).toHaveLength(8); expect(chargeAnalysis.completeCast).toBe(false);
  for (const hit of chargeCollection.hits) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
  await expect(panel.locator("[data-source-single-result]")).toContainText("完整技能固有伤害尚未证明");
  await page.screenshot({ path: testInfo.outputPath("neuvillette-charge.png"), fullPage: true });

  await page.locator("#calc-source-single-skill-close").click();
  await outputs.locator('[data-source-action="burst"]').click();
  await expect(panel.locator("[data-single-character]")).toHaveValue("neuvillette");
  await expect(panel.locator("[data-single-action]")).toHaveValue("burst");
  let burstInput = await download(page, "[data-single-export-input]") as SourceSingleSkillDraft;
  expect(burstInput.startup).toBe("zero"); expect(burstInput.member).toEqual(chargeInput.member);
  expect(burstInput.action).toEqual({ kind: "burst" });
  expect(burstInput.seed).toBe(chargeInput.seed); expect(burstInput.target).toEqual(chargeInput.target);
  // An explicit one-cast full-energy scenario; choosing Q itself granted none.
  await panel.locator("[data-single-startup]").selectOption("full");
  burstInput = await download(page, "[data-single-export-input]") as SourceSingleSkillDraft;
  await panel.locator("[data-single-run]").click();
  await expect(panel.locator("[data-single-status]")).toContainText("运行完成", { timeout: 60000 });
  const burst = await download(page, "[data-single-result-export]") as { input: SourceSingleSkillDraft; result: SourceHostResult };
  await writeFile(testInfo.outputPath("neuvillette-burst-native.json"), JSON.stringify(burst));
  expect(burst.input).toEqual(burstInput);
  const bursts = sourceActionReceipts(burst.result.logs).filter(row => row.acceptedFrame !== undefined && row.action === "burst");
  expect(bursts).toHaveLength(1);
  const burstCollection = captureSourceHostActionCollection(burst.result, bursts[0]!.sequence, "creation");
  const burstAnalysis = calculateSourceHostActionCollection(burstCollection);
  expect(burstCollection.hits.length).toBeGreaterThan(0); expect(burstAnalysis.completeCast).toBe(false);
  for (const hit of burstCollection.hits) expect(replaySourceHostHit(hit.calculation.originalCapture).difference).toBe(0);
  await writeFile(testInfo.outputPath("neuvillette-analyses.json"), JSON.stringify({ charge: chargeAnalysis, burst: burstAnalysis }, null, 2));
  await page.screenshot({ path: testInfo.outputPath("neuvillette-q.png"), fullPage: true });
  expect(errors).toEqual([]);
});
