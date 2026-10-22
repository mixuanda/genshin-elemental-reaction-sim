import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { calculateDocument, type CalculatorDocument, type CalculatorResult, type CapturedSpecialSimulation } from "@genshin-dps-lab/sim-core";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { LunarBloomSimulationResult } from "../../../packages/sim-core/src/lunar-bloom-runtime";
import type { LunarArtifactOptions } from "../src/lunar-simulation-panel";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("Lunar artifact conditions roundtrip and the Worker capture preserves the same formula context", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("[data-calculator-example-tools] > summary").click();
  await page.locator("#calc-example-select").selectOption("special-artifact-flower-of-paradise-lost-4pc");
  await page.locator('[data-action="load-example"]').click();
  const artifact = page.locator('[data-special-artifact-kind][data-special-artifact-contributor="0"]');
  const stacks = page.locator('[data-special-artifact-field="stacks"][data-special-artifact-contributor="0"]');
  await expect(artifact).toHaveValue("flower-of-paradise-lost-4pc");
  await expect(stacks).toBeEnabled();
  const initial = await audit(page);
  await stacks.selectOption("");
  const unknown = await audit(page);
  expect(unknown.result.status).toBe("blocked");
  expect(unknown.result.totals).toBeUndefined();
  expect(unknown.result.blockers.join(" ")).toContain("层数");

  await stacks.selectOption("4");
  const edited = await audit(page);
  expect(edited.result.status).toBe("calculated");
  expect(edited.result.totals!.expected).toBeGreaterThan(initial.result.totals!.expected);
  expect(edited.result.totals).toEqual(calculateDocument(edited.document).totals);
  expect(edited.result.trace.find(node => node.id.endsWith("contributor.0.artifact.bonus"))?.result?.value).toBe(0.2);
  const saved = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await page.locator("#calc-import").setInputFiles({ name: "flower-four-stacks.calculator.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(stacks).toHaveValue("4");
  const restored = await audit(page);
  expect(restored.document.hits[0]).toEqual(edited.document.hits[0]);
  expect(restored.result.totals).toEqual(edited.result.totals);

  const config = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-bloom-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  const seed = "lunar-artifact-bonus-worker";
  const inputRecord = { format: "simulation-record-v1", sourceConfig: config, options: { energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1", randomSeed: seed, execution: { captureHits: true, detailedTraces: false } }, iterations: 1, executionProfile: null, benchmark: null };
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "lunar-artifact-worker.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(inputRecord)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(seed);
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("lunar-bloom");
  await page.locator('[data-lunar-party-index="0"]').selectOption("columbina");
  await page.locator('[data-lunar-party-index="1"]').selectOption("nahida");
  await page.locator('[data-lunar-artifact-index="0"]').selectOption("flower-of-paradise-lost-4pc");
  await page.locator("[data-lb-source-enabled]").check();
  await page.locator('[data-lb-source-field="actorId"]').selectOption("c");
  await page.locator('[data-lb-source-field="requestedFrame"]').fill("160");
  await page.locator('[data-lb-source-field="talentLevel"]').fill("10");
  await page.locator('[data-lb-source-field="ascension"]').selectOption("6");
  await page.locator('[data-lb-source-field="constellation"]').selectOption("0");
  const workerStarted = page.waitForEvent("worker", worker => worker.url().includes("lunar-simulation-worker"));
  await page.locator('[data-lunar-action="run"]').click();
  await workerStarted;
  await expect(page.locator("[data-lunar-status]")).toContainText("实际结算 3 条月绽放事件");
  const report = await downloadJson<CapturedSpecialSimulation & { ui?: { artifactOptions: LunarArtifactOptions }; result: LunarBloomSimulationResult }>(page, '[data-lunar-action="export"]');
  expect(report.ui!.artifactOptions).toEqual({ artifacts: [{ actorId: "c", kind: "flower-of-paradise-lost-4pc" }] });
  expect(report.request.artifacts).toEqual(report.ui!.artifactOptions.artifacts);
  expect(report.result.baseResult.resolvedRuntimeOptions.execution?.lunarBloom?.artifacts).toEqual(report.request.artifacts);
  const event = report.result.specialDamageEvents[0]!;
  const capturedBonus = event.context.contributors[0]?.artifactBonus;
  expect(capturedBonus).toMatchObject({ kind: "flower-of-paradise-lost-4pc", stacks: expect.any(Number) });
  await page.locator(`[data-lunar-event="${event.id}"] > summary`).click();
  await page.locator(`[data-lunar-open-calculator="${event.id}"]`).click();
  await expect(page).toHaveURL(/\/calculator$/);
  const replay = await audit(page);
  const hit = replay.document.hits[0]!;
  expect(hit.kind === "special" && hit.context).toEqual(event.context);
  expect(Math.abs(replay.result.totals!.expected - event.damage)).toBeLessThanOrEqual(1e-8);
  await expect(artifact).toBeDisabled();
  await expect(stacks).toBeDisabled();
  await expect(stacks).toHaveValue(String(capturedBonus?.kind === "flower-of-paradise-lost-4pc" ? capturedBonus.stacks : undefined));
});
