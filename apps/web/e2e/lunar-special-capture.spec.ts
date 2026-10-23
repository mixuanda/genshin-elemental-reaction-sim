import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSpecialSimulation } from "@genshin-dps-lab/sim-core";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { LunarBloomSimulationResult } from "../../../packages/sim-core/src/lunar-bloom-runtime";
import type { StellarConductSimulationResult } from "../../../packages/sim-core/src/stellar-conduct-runtime";

type UiCapture<T extends CapturedSpecialSimulation["result"]> = CapturedSpecialSimulation & {
  result: T;
  ui?: { explicitConfigurationChanges: string[] };
};

async function downloadCaptureJson(page: Page): Promise<string> {
  const pending = page.waitForEvent("download");
  await page.locator('[data-lunar-action="export"]').click();
  const download = await pending;
  return readFile((await download.path())!, "utf8");
}

async function downloadCapture<T extends CapturedSpecialSimulation["result"]>(page: Page): Promise<UiCapture<T>> {
  return JSON.parse(await downloadCaptureJson(page)) as UiCapture<T>;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("special result capture roundtrips through the normal page and rejects a changed complete result", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const config = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-bloom-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  const options = { energyMode: "configured", critMode: "noCrit", compatibilityMode: "legacy-v0.1", randomSeed: "special-capture-page-roundtrip", execution: { captureHits: true, detailedTraces: false } };
  const inputRecord = { format: "simulation-record-v1", sourceConfig: config, options, iterations: 1, executionProfile: null, benchmark: null };
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "special-capture-input.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(inputRecord)) });
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("lunar-bloom");
  await page.locator('[data-lunar-party-index="0"]').selectOption("columbina");
  await page.locator('[data-lunar-party-index="1"]').selectOption("nahida");
  await page.locator("[data-lb-source-enabled]").check();
  await page.locator('[data-lb-source-field="actorId"]').selectOption("c");
  await page.locator('[data-lb-source-field="requestedFrame"]').fill("160");
  await page.locator('[data-lb-source-field="talentLevel"]').fill("10");
  await page.locator('[data-lb-source-field="ascension"]').selectOption("6");
  await page.locator('[data-lb-source-field="constellation"]').selectOption("0");
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator("[data-lunar-status]")).toContainText("实际结算 3 条月绽放事件");

  const capture = await downloadCapture<LunarBloomSimulationResult>(page);
  // New test evidence belongs to this run; never overwrite the historical capture.
  await writeFile(testInfo.outputPath("lunar-bloom-complete-capture.result.json"), JSON.stringify(capture, null, 2) + "\n");
  expect(capture.schemaVersion).toBe("special-complete-reexecution-v1");
  expect(capture.request.profile).toBe("lunar-bloom");
  expect(capture.request.config).toBeDefined();
  expect(capture.request.options.randomSeed).toBe(options.randomSeed);
  expect(capture.request.party).toEqual([{ actorId: "c", characterKey: "columbina" }, { actorId: "d", characterKey: "nahida" }]);
  expect(capture.request.abilities).toHaveLength(1);
  expect(capture.result.specialDamageEvents).toHaveLength(3);
  expect(capture.ui?.explicitConfigurationChanges.length).toBeGreaterThan(0);

  const expectedTotal = await page.locator('[data-testid="lunar-total-damage"]').textContent();
  const expectedEventIds = await page.locator("[data-lunar-event]").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.lunarEvent));
  const savedJson = JSON.stringify(capture, null, 2) + "\n";
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator("[data-lunar-import]").setInputFiles({ name: "complete-special-capture.json", mimeType: "application/json", buffer: Buffer.from(savedJson) });
  await expect(page.locator("[data-lunar-status]")).toContainText("捕获记录可复现");
  await expect(page.locator("[data-lunar-profile]")).toHaveValue("lunar-bloom");
  await expect(page.locator('[data-testid="lunar-total-damage"]')).toHaveText(expectedTotal!);
  expect(await page.locator("[data-lunar-event]").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.lunarEvent))).toEqual(expectedEventIds);
  expect(await downloadCaptureJson(page), "Read-only re-export must preserve identity provenance, configuration changes and original JSON.").toBe(savedJson);

  const changed = JSON.parse(JSON.stringify(capture)) as UiCapture<LunarBloomSimulationResult>;
  changed.result.specialDamageEvents[0]!.damage += 1;
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator("[data-lunar-import]").setInputFiles({ name: "changed-special-result.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(changed)) });
  await expect(page.locator("[data-lunar-status]")).toContainText("未通过完整重放");
  await expect(page.locator('[data-testid="lunar-total-damage"]')).toHaveText(expectedTotal!);
  expect(await downloadCaptureJson(page), "A rejected import must retain the last valid capture, including its original annotations.").toBe(savedJson);

  const firstEventId = expectedEventIds[0]!;
  await page.locator('[data-lunar-event="' + firstEventId + '"] > summary').click();
  await expect(page.locator('[data-lunar-open-calculator="' + firstEventId + '"]')).toBeVisible();
  await page.locator('[data-lunar-open-calculator="' + firstEventId + '"]').click();
  await expect(page).toHaveURL(/\/calculator$/);

  const stellarConfig = JSON.parse(await readFile(new URL("../../../docs/fixtures/stellar-conduct-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  const stellarRecord = { format: "simulation-record-v1", sourceConfig: stellarConfig,
    options: { energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1", randomSeed: "stellar-special-capture", execution: { captureHits: true, detailedTraces: false } },
    iterations: 1, executionProfile: null, benchmark: null };
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "stellar-conduct.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(stellarRecord)) });
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("stellar-conduct");
  await page.locator('[data-lunar-party-index="0"]').selectOption("sandrone");
  await page.locator('[data-lunar-party-index="1"]').selectOption("lisa");
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const stellarCapture = await downloadCapture<StellarConductSimulationResult>(page);
  await writeFile(testInfo.outputPath("stellar-conduct-complete-capture.result.json"), JSON.stringify(stellarCapture, null, 2) + "\n");
  expect(stellarCapture.request.profile).toBe("stellar-conduct");
  expect(stellarCapture.result.fieldInfluences.length).toBeGreaterThan(0);
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator("[data-lunar-import]").setInputFiles({ name: "stellar-conduct-capture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(stellarCapture)) });
  await expect(page.locator("[data-lunar-status]")).toContainText("捕获记录可复现");
  await expect(page.locator("[data-lunar-profile]")).toHaveValue("stellar-conduct");
  const ordinaryField = page.locator("[data-stellar-field]").first();
  await ordinaryField.locator("> summary").click();
  await ordinaryField.locator("[data-lunar-open-classic]").first().click();
  await expect(page).toHaveURL(/\/calculator$/);
  expect(pageErrors).toEqual([]);
});
