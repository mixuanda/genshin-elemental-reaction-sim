import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

test("source builder retains explicit startup through preset and JSON edits and labels recorded rejected actions", async ({ page }) => {
  await page.goto("/source-simulation");
  const builder = page.locator("#source-team-builder");
  await builder.locator("[data-add-character]").selectOption("noelle");
  await builder.locator('[data-quick-action="skill"]').click();
  await builder.locator('[data-quick-action="burst"]').click();
  await builder.locator("[data-startup]").selectOption("zero");
  await builder.locator("[data-duration-preset]").selectOption("15");
  await builder.locator("[data-apply-script]").click();
  await expect(page.locator("#source-host-config")).toHaveValue(/duration=15;[\s\S]*\+params=\[start_energy=0\]/);
  await builder.locator("[data-startup]").selectOption("custom");
  await builder.locator('[data-member-field="initialEnergy"]').fill("12");
  await builder.locator('[data-member-field="initialEnergy"]').press("Tab");
  await builder.locator("[data-tier]").selectOption("developed");
  await builder.locator("[data-apply-member-tier]").click();
  await expect(builder.locator('[data-member-field="initialEnergy"]')).toHaveValue("12");
  const downloading = page.waitForEvent("download");
  await builder.locator("[data-export-draft]").click();
  const draft = await readFile((await (await downloading).path())!, "utf8");
  await builder.locator("[data-startup]").selectOption("full");
  await builder.locator("[data-import-draft]").setInputFiles({ name: "startup.json", mimeType: "application/json", buffer: Buffer.from(draft) });
  await expect(builder.locator("[data-startup]")).toHaveValue("custom");
  await builder.locator("[data-apply-script]").click();
  await expect(page.locator("#source-host-config")).toHaveValue(/\+params=\[start_energy=12\]/);

  // Reuse an actual recorded source run; this UI check does not repeat the WASM calculation.
  const batch = JSON.parse(await readFile("docs/validation/source-energy-shield-classic-20260928.result.json", "utf8"));
  await page.locator("#source-host-import").setInputFiles({ name: "source-result.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(batch.runs[0].result)) });
  await expect(page.locator("#source-host-status")).toContainText("已导入并重算来源结果");
  await expect(builder.locator("[data-source-team-logs]")).toContainText("拒绝 Q 爆发");
  await expect(builder.locator("[data-source-team-logs] table")).not.toContainText("执行 Q 爆发");
});

test("standalone artifact utility shows shared arithmetic and restores editable input", async ({ page }) => {
  await page.goto("/calculator");
  const panel = page.locator("#calc-artifact-utility");
  await expect(panel).toContainText("合成示例");
  await panel.locator("[data-artifact-utility-set]").selectOption("10013");
  await panel.locator("[data-artifact-utility-kind]").selectOption("burst-cast");
  await panel.locator('[data-artifact-utility-field="healingBonus"]').fill("0.1");
  await panel.locator('[data-artifact-utility-field="otherIncomingHealingBonus"]').fill("0.05");
  await panel.locator("[data-artifact-utility-add]").click();
  await expect(panel.locator("[data-artifact-utility-status]")).toContainText("当前生命 7700 / 10000");
  const downloading = page.waitForEvent("download");
  await panel.locator("[data-artifact-utility-export]").click();
  const text = await readFile((await (await downloading).path())!, "utf8");
  const saved = JSON.parse(text);
  expect(saved.replay.steps[0].requestedHealing).toBe(2700);
  expect(saved.replay.steps[0].trace.some((node: { id: string }) => node.id === "health.after")).toBe(true);
  await panel.locator('[data-artifact-utility-field="initialHp"]').fill("1000");
  await panel.locator('[data-artifact-utility-field="initialHp"]').press("Tab");
  await expect(panel.locator("[data-artifact-utility-status]")).toContainText("当前生命 3700 / 10000");
  await panel.locator("[data-artifact-utility-import]").setInputFiles({ name: "utility.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(panel.locator("[data-artifact-utility-status]")).toContainText("当前生命 7700 / 10000");
  await writeFile("docs/validation/artifact-utility-page-20260928.result.json", text);
});

test("observed plunge contacts expand the complete cast in ordinary calculator and survive JSON", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000129");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const id = await page.locator("#calc-skill option").filter({ hasText: "低空下落（逐次观察碰撞与落地）" }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(id!);
  await page.locator("#calc-scope").selectOption("one-cast");
  const prefix = "gameContext.observedPlunge";
  await page.locator(`[data-field="${prefix}.collisionCount"]`).fill("3");
  await page.locator(`[data-field="${prefix}.collisionCount"]`).press("Tab");
  for (const [field, value] of [["noExternalInfusion", "1"], ["landingContact", "1"], ["statsStableAcrossHits", "1"], ["collisionContacts.1", "1"], ["collisionContacts.2", "0"], ["collisionContacts.3", "1"]]) {
    await page.locator(`[data-source-cast-state-field="${prefix}.${field}"]`).selectOption(value!);
  }
  const audit = async (): Promise<{ document: CalculatorDocument; result: CalculatorResult }> => JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
  const calculated = await audit();
  expect(calculated.result.status).toBe("calculated");
  expect(calculated.document.gameContext?.scopeCoverage).toBe("complete-cast");
  expect(calculated.result.hits).toHaveLength(3);
  expect(calculated.result.totals!.expected).toBeGreaterThan(0);
  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = await readFile((await (await downloading).path())!, "utf8");
  await page.locator("#calc-import").setInputFiles({ name: "plunge.json", mimeType: "application/json", buffer: Buffer.from(saved) });
  expect((await audit()).result.totals).toEqual(calculated.result.totals);
  await writeFile("docs/validation/observed-plunge-page-20260928.result.json", JSON.stringify(calculated, null, 2));
});
