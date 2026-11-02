import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { StellarSwirlSimulationResult } from "../../../packages/sim-core/src/stellar-swirl-runtime";

test("Stellar Worker consumes an actual jump, lands a declared plunge and exports its ordinary damage", async ({ page }) => {
  const config = JSON.parse(await readFile(new URL("../../../docs/fixtures/stellar-swirl-reference.synthetic.json", import.meta.url), "utf8")) as SimConfig;
  config.timeline!.legalityMode = "wait";
  config.timeline!.commands = config.timeline!.commands.filter(command => command.type !== "skill" || (command.atFrame ?? 0) <= 7);
  config.timeline!.abilities.push({ id: "p", actorId: "c", name: "合成显式物理下落", kind: "plunge",
    cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
    timelineState: { requires: ["airborne"], consumes: ["airborne"] },
    hits: [{ id: "p", frame: 0, scaling: 2, element: "physical", attackTag: "plunge" }] });
  config.timeline!.commands.push({ type: "swap", characterId: "c", atFrame: 180 },
    { type: "jump", actorId: "c", frames: 9, atFrame: 187 },
    { type: "plunge", actorId: "c", abilityId: "p", atFrame: 196 });
  const record = { format: "simulation-record-v1", sourceConfig: config, options: {
    energyMode: "configured", critMode: "average", compatibilityMode: "legal-frame-v1", randomSeed: "stellar-high-jump-page",
    execution: { captureHits: true } }, iterations: 1, executionProfile: null, benchmark: null };
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "stellar-high-jump.record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue("stellar-high-jump-page");
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("[data-lunar-profile]").selectOption("stellar-swirl");
  await page.locator('[data-lunar-party-index="0"]').selectOption("sandrone");
  await page.locator('[data-lunar-party-index="1"]').selectOption("sucrose");
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  await expect(page.locator("[data-stellar-swirl-result-warning]")).toContainText("guide-profile-source-conflict");
  await expect(page.locator("[data-stellar-high-jump-event]")).toHaveCount(2);
  await expect(page.locator("[data-stellar-high-jump-event]").first()).toContainText("已消费资格并腾空");
  await expect(page.locator("[data-stellar-high-jump-event]").last()).toContainText("已结束腾空");
  await expect(page.locator("[data-stellar-swirl-airborne]")).toHaveText("否");
  const pending = page.waitForEvent("download");
  await page.locator('[data-lunar-action="export"]').click();
  const report = JSON.parse(await readFile((await (await pending).path())!, "utf8")) as { result: StellarSwirlSimulationResult };
  const result = report.result;
  expect(result.highJump).toEqual({ available: false, expiresAt: null, consumptionImplemented: true, airborne: null });
  expect(result.executionLog.filter(row => row.type.startsWith("high-jump-")).map(row => [row.frame, row.details.actorId, row.details.allowed])).toEqual([[187, "c", true], [196, "c", true]]);
  const plunge = result.baseResult.damageEvents.filter(row => row.hitId === "p");
  expect(plunge).toHaveLength(1);
  expect(plunge[0]!.frame).toBe(196);
  expect(result.totalDamage).toBe(result.classicDamage + result.stellarSwirlDamage);
  await page.getByText("同次运行的经典直接命中", { exact: true }).click();
  await page.locator(`[data-lunar-classic-event="${plunge[0]!.id}"] > summary`).click();
  await page.locator(`[data-lunar-open-classic="${plunge[0]!.id}"]`).click();
  await expect(page).toHaveURL(/\/calculator$/);
  const audit = JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!) as { event: { finalDamage: number } };
  expect(audit.event.finalDamage).toBe(plunge[0]!.finalDamage);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await expect(page.getByTestId("replay-reproduced")).toHaveText(plunge[0]!.finalDamage.toLocaleString("zh-CN", { maximumFractionDigits: 6 }));
});
