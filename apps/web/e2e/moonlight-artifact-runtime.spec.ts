import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult, CapturedSpecialSimulation } from "@genshin-dps-lab/sim-core";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { LunarMixedSimulationResult } from "../../../packages/sim-core/src/lunar-mixed-runtime";

type MoonlightCapture = Omit<CapturedSpecialSimulation, "result"> & { result: LunarMixedSimulationResult };

async function downloadCapture(page: Page): Promise<MoonlightCapture> {
  const pending = page.waitForEvent("download");
  await page.locator('[data-lunar-action="export"]').click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as MoonlightCapture;
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("Moonlight 4pc callbacks flow from real ordinary and Lunar hits into a replayable special calculation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const config = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-mixed-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  // The selected four-piece sets require their static two-piece stats in the input baseline exactly once.
  config.characters.find(actor => actor.id === "e")!.stats.em += 80;
  config.characters.find(actor => actor.id === "g")!.stats.energyRecharge += 0.2;
  const record = { format: "simulation-record-v1", sourceConfig: config,
    options: { energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1", randomSeed: "moonlight-artifact-page",
      execution: { captureHits: true, detailedTraces: false } },
    iterations: 1, executionProfile: null, benchmark: null };

  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "moonlight-artifact.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator('#documentNotice')).toContainText('打开不会运行模拟');
  await page.locator('#runButton').click();
  await page.locator('[data-tab="overview"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("lunar-mixed");
  await page.locator('[data-lunar-party-index="0"]').selectOption("columbina");
  await page.locator('[data-lunar-party-index="1"]').selectOption("fischl");
  await page.locator('[data-lunar-party-index="2"]').selectOption("zibai");
  await page.locator('[data-lunar-artifact-index="1"]').selectOption("artifact-set:15041");
  await page.locator('[data-lunar-artifact-index="2"]').selectOption("artifact-set:15042");
  await expect(page.locator("[data-lunar-moonsign]")).toHaveValue("2");
  await expect(page.locator("[data-lunar-moonsign]")).toHaveAttribute("readonly", "");
  await page.locator("[data-moonlight-artifact-baseline]").check();
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const capture = await downloadCapture(page);
  expect(capture.schemaVersion).toBe("special-complete-reexecution-v1");
  expect(capture.request.profile).toBe("lunar-mixed");
  const savedConfig = capture.request.config as SimConfig;
  expect(savedConfig.characters.find(actor => actor.id === "e")!.stats.em).toBe(280);
  expect(savedConfig.characters.find(actor => actor.id === "g")!.stats.energyRecharge).toBeCloseTo(1.2);
  expect(savedConfig.moonlightArtifactModel).toEqual({ mode: "fixed-a7-moonlight-artifact-4pc-v1",
    baselineIncludesStaticTwoPiece: true, moonsignLevel: 2,
    actors: [{ actorId: "e", setId: "artifact-set:15041" }, { actorId: "g", setId: "artifact-set:15042" }] });

  const log = capture.result.moonlightArtifactLog ?? [];
  const night = log.find(entry => entry.event === "OnLunarCharged" && entry.wearerActorId === "e");
  expect(night).toBeDefined();
  expect(night!.applications).toEqual(expect.arrayContaining([
    expect.objectContaining({ receiverActorId: "e", stat: "critRate", value: 0.3, expiresAtFrame: night!.frame + 240 }),
  ]));
  const silken = log.find(entry => entry.event === "OnEnemyDamage" && entry.triggerActorId === "g");
  expect(silken).toBeDefined();
  expect(silken!.applications).toEqual(expect.arrayContaining([
    expect.objectContaining({ receiverActorId: "e", stat: "em", value: 120, expiresAtFrame: silken!.frame + 480 }),
    expect.objectContaining({ receiverActorId: "g", stat: "em", value: 120, expiresAtFrame: silken!.frame + 480 }),
  ]));
  expect(capture.result.baseResult.damageEvents.some(event => event.sourceActorId === "g" && event.frame === silken!.frame && event.element === "geo")).toBe(true);

  const benefited = capture.result.specialDamageEvents.find(event => event.intent.branch === "lunar-crystallize-reaction" &&
    event.context.contributors.some(contributor => contributor.moonlightArtifactBonus?.nightWindows.length && contributor.moonlightArtifactBonus.silkenWindows.length));
  expect(benefited).toBeDefined();
  const contributor = benefited!.context.contributors.find(row => row.moonlightArtifactBonus?.nightWindows.length && row.moonlightArtifactBonus.silkenWindows.length)!;
  expect(contributor.reactionBonus).toBe(0); // Team-window bonuses are derived separately, not duplicated as manual bonus.
  expect(capture.result.moonlightArtifactReactionReads).toEqual(expect.arrayContaining([
    expect.objectContaining({ frame: benefited!.intent.snapshotFrame, actorId: contributor.id, tag: "lunar-crystallize-reaction",
      nightBonus: 0.1, silkenBonus: 0.1, totalBonus: 0.2 }),
  ]));

  await page.goto("/results");
  await page.locator("[data-lunar-import]").setInputFiles({ name: "moonlight-artifact-complete.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(capture)) });
  await expect(page.locator("[data-lunar-status]")).toContainText("捕获记录可复现");
  const restored = await downloadCapture(page);
  expect(restored.request).toEqual(capture.request);
  expect(restored.result).toEqual(capture.result);
  await expect(page.locator('[data-lunar-artifact-index="1"]')).toHaveValue("artifact-set:15041");
  await expect(page.locator('[data-lunar-artifact-index="2"]')).toHaveValue("artifact-set:15042");
  await expect(page.locator("[data-lunar-moonsign]")).toHaveValue("2");
  await expect(page.locator("[data-lunar-moonsign]")).toHaveAttribute("data-moonsign-origin", "capture");
  await expect(page.locator("[data-moonlight-artifact-baseline]")).toBeChecked();

  await page.locator(`[data-lunar-event="${benefited!.id}"] > summary`).click();
  await page.locator(`[data-lunar-open-calculator="${benefited!.id}"]`).click();
  await expect(page).toHaveURL(/\/calculator$/);
  const calculator = JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!) as {
    document: CalculatorDocument; result: CalculatorResult;
  };
  const hit = calculator.document.hits[0]!;
  expect(hit.kind === "special" && hit.context).toEqual(benefited!.context);
  expect(calculator.result.status).toBe("calculated");
  const replayedDamage = calculator.result.totals!.expected;
  const delta = replayedDamage - benefited!.damage;
  expect(Math.abs(delta)).toBeLessThanOrEqual(1e-8);
  const stages = calculator.result.hits[0]!.trace;
  expect(stages.find(stage => stage.id.endsWith(".contributor.0.moonlightArtifact.nightBonus"))?.result?.value).toBeCloseTo(0.1);
  expect(stages.find(stage => stage.id.endsWith(".contributor.0.moonlightArtifact.silkenBonus"))?.result?.value).toBeCloseTo(0.1);
  expect(stages.find(stage => stage.id.endsWith(".contributor.0.moonlightArtifact.bonus"))?.result?.value).toBeCloseTo(0.2);
  await writeFile("docs/validation/moonlight-artifact-runtime-20260928.result.json", JSON.stringify({
    capture, independentCalculator: { eventId: benefited!.id, eventDamage: benefited!.damage, replayedDamage, delta, audit: calculator },
  }, null, 2) + "\n");
  expect(pageErrors).toEqual([]);
});
