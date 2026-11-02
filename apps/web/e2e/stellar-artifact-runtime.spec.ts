import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSpecialSimulation, CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { StellarConductSimulationResult } from "../../../packages/sim-core/src/stellar-conduct-runtime";
import type { StellarSwirlSimulationResult } from "../../../packages/sim-core/src/stellar-swirl-runtime";

type StellarCapture<T extends StellarConductSimulationResult | StellarSwirlSimulationResult> =
  Omit<CapturedSpecialSimulation, "result"> & { result: T };

async function downloadCapture<T extends StellarConductSimulationResult | StellarSwirlSimulationResult>(page: Page): Promise<StellarCapture<T>> {
  const pending = page.waitForEvent("download");
  await page.locator('[data-lunar-action="export"]').click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as StellarCapture<T>;
}

async function importAndReplay<T extends StellarConductSimulationResult | StellarSwirlSimulationResult>(page: Page, capture: StellarCapture<T>): Promise<void> {
  await page.goto("/results");
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator("[data-lunar-import]").setInputFiles({
    name: "stellar-artifact-complete-capture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(capture)),
  });
  await expect(page.locator("[data-lunar-status]")).toContainText("捕获记录可复现");
  const replayed = await downloadCapture<T>(page);
  expect(replayed.request).toEqual(capture.request);
  expect(replayed.result).toEqual(capture.result);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("the normal page executes both fixed-a7 Stellar 4pc callbacks and replays their complete captures", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const options = {
    energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1",
    randomSeed: "stellar-artifact-page", execution: { captureHits: true, detailedTraces: false },
  };

  const conductConfig = JSON.parse(await readFile(new URL("../../../docs/fixtures/stellar-conduct-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  conductConfig.characters.find(actor => actor.id === "e")!.stats.atkPct += 0.18;
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({
    name: "stellar-artifact-conduct.record.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "simulation-record-v1", sourceConfig: conductConfig, options, iterations: 1, executionProfile: null, benchmark: null })),
  });
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("stellar-conduct");
  await page.locator('[data-lunar-party-index="0"]').selectOption("sandrone");
  await page.locator('[data-lunar-party-index="1"]').selectOption("lisa");
  await page.locator('[data-stellar-artifact-index="e"]').selectOption("artifact-set:15048");
  await page.locator("[data-stellar-artifact-baseline]").check();
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const conduct = await downloadCapture<StellarConductSimulationResult>(page);
  expect(conduct.schemaVersion).toBe("special-complete-reexecution-v1");
  expect(conduct.request.profile).toBe("stellar-conduct");
  const conductSavedConfig = conduct.request.config as SimConfig;
  expect(conductSavedConfig.characters.find(actor => actor.id === "e")!.stats.atkPct).toBeCloseTo(0.18);
  expect(conductSavedConfig.stellarArtifactModel).toEqual({
    mode: "fixed-a7-stellar-artifact-4pc-v1", baselineIncludesStaticTwoPiece: true,
    actors: [{ actorId: "e", setId: "artifact-set:15048" }],
  });
  const conductTrigger = conduct.result.stellarArtifactLog?.find(entry => entry.event === "OnStellarConduct" && entry.triggerActorId === "e");
  expect(conductTrigger).toBeDefined();
  expect(conductTrigger!.setId).toBe("artifact-set:15048");
  expect(conductTrigger!.applications).toEqual(expect.arrayContaining([
    expect.objectContaining({ receiverActorId: "e", stat: "atkPct", value: 0.12, expiresAtFrame: conductTrigger!.frame + 720 }),
    expect.objectContaining({ receiverActorId: "c", stat: "reactionBonus", value: 0.5, expiresAtFrame: conductTrigger!.frame + 720 }),
    expect.objectContaining({ receiverActorId: "e", stat: "reactionBonus", value: 0.5, expiresAtFrame: conductTrigger!.frame + 720 }),
  ]));
  await writeFile("docs/validation/stellar-artifact-conduct-20260928.result.json", JSON.stringify(conduct, null, 2) + "\n");
  await importAndReplay(page, conduct);
  await expect(page.locator('[data-stellar-artifact-index="e"]')).toHaveValue("artifact-set:15048");
  await expect(page.locator("[data-stellar-artifact-baseline]")).toBeChecked();

  const swirlConfig = JSON.parse(await readFile(new URL("../../../docs/fixtures/stellar-swirl-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  swirlConfig.characters.find(actor => actor.id === "a")!.stats.atkPct += 0.18;
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({
    name: "stellar-artifact-swirl.record.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "simulation-record-v1", sourceConfig: swirlConfig, options, iterations: 1, executionProfile: null, benchmark: null })),
  });
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("stellar-swirl");
  await page.locator('[data-lunar-party-index="0"]').selectOption("sandrone");
  await page.locator('[data-lunar-party-index="1"]').selectOption("sucrose");
  await page.locator('[data-stellar-artifact-index="a"]').selectOption("artifact-set:15047");
  await page.locator("[data-stellar-artifact-baseline]").check();
  await page.locator("[data-stellar-artifact-guide-conflict]").check();
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const swirl = await downloadCapture<StellarSwirlSimulationResult>(page);
  expect(swirl.schemaVersion).toBe("special-complete-reexecution-v1");
  expect(swirl.request.profile).toBe("stellar-swirl");
  const swirlSavedConfig = swirl.request.config as SimConfig;
  expect(swirlSavedConfig.characters.find(actor => actor.id === "a")!.stats.atkPct).toBeCloseTo(0.18);
  expect(swirlSavedConfig.stellarArtifactModel).toEqual({
    mode: "fixed-a7-stellar-artifact-4pc-v1", baselineIncludesStaticTwoPiece: true,
    allowGuideSourceConflict: true, actors: [{ actorId: "a", setId: "artifact-set:15047" }],
  });
  const swirlTrigger = swirl.result.stellarArtifactLog?.find(entry => entry.event === "OnStellarSwirl" && entry.triggerActorId === "a");
  expect(swirlTrigger).toBeDefined();
  expect(swirlTrigger!.setId).toBe("artifact-set:15047");
  expect(swirlTrigger!.applications).toEqual(expect.arrayContaining([
    expect.objectContaining({ receiverActorId: "a", stat: "critRate", value: 0.16, expiresAtFrame: swirlTrigger!.frame + 600 }),
    expect.objectContaining({ receiverActorId: "a", stat: "reactionBonus", value: 0.4, expiresAtFrame: swirlTrigger!.frame + 600 }),
  ]));
  expect(swirl.result.stellarArtifactReactionReads).toEqual(expect.arrayContaining([
    expect.objectContaining({ actorId: "a", tag: "reaction-stellar-swirl", scarletBonus: 0.4, totalBonus: 0.4 }),
  ]));
  const benefited = swirl.result.specialDamageEvents.find(event =>
    event.context.contributors.some(contributor => contributor.id === "a" && contributor.reactionBonus === 0.4));
  expect(benefited).toBeDefined();
  await writeFile("docs/validation/stellar-artifact-swirl-20260928.result.json", JSON.stringify(swirl, null, 2) + "\n");
  await importAndReplay(page, swirl);
  await expect(page.locator('[data-stellar-artifact-index="a"]')).toHaveValue("artifact-set:15047");
  await expect(page.locator("[data-stellar-artifact-baseline]")).toBeChecked();
  await expect(page.locator("[data-stellar-artifact-guide-conflict]")).toBeChecked();
  await page.locator(`[data-lunar-event="${benefited!.id}"] > summary`).click();
  await page.locator(`[data-lunar-open-calculator="${benefited!.id}"]`).click();
  await expect(page).toHaveURL(/\/calculator$/);
  const audit = JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!) as {
    document: CalculatorDocument; result: CalculatorResult;
  };
  const hit = audit.document.hits[0]!;
  expect(hit.kind === "special" && hit.context).toEqual(benefited!.context);
  expect(audit.result.status).toBe("calculated");
  expect(audit.result.totals!.expected).toBeCloseTo(benefited!.damage, 8);
  expect(pageErrors).toEqual([]);
});
