import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Klee observed waves use explicit random outcomes and contacts, survive final JSON, and keep single hits independent", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000029");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const action = await page.locator("#calc-skill option").filter({ hasText: "完整观察波次" }).getAttribute("value");
  expect(action).toBeTruthy();
  await page.locator("#calc-skill").selectOption(action!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:14101");
  await page.locator('[data-equipment="ascension"]').selectOption("6");
  await page.locator('[data-equipment="level"]').fill("90");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').uncheck();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  await page.locator("#calc-scope").selectOption("one-cast");

  const context = "gameContext.observedEntityCast";
  await page.locator(`[data-source-cast-text-field="${context}.casterId"]`).fill("klee-owner");
  await page.locator(`[data-source-cast-text-field="${context}.targetId"]`).fill("observed-enemy");
  for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits", "klee.onFieldUntilEndConfirmed"]) {
    await page.locator(`[data-source-cast-state-field="${context}.${field}"]`).selectOption("1");
  }
  await page.locator(`[data-field="${context}.observedThroughFrame"]`).fill("800");
  expect((await audit(page)).result.status).toBe("blocked");

  // An editable observed outcome, not the maximum or mean number of source projectiles.
  for (let index = 0; index < 6; index++) {
    await page.locator('[data-action="observed-entity-row-add"][data-observed-collection="klee.waves"]').click();
    const row = page.locator(`[data-observed-row="klee.waves"][data-observed-row-index="${index}"]`);
    await row.locator('[data-observed-row-field="extraAt12"]').selectOption(index === 0 ? "true" : "false");
    await row.locator('[data-observed-row-field="extraAt24"]').selectOption("false");
  }
  await expect(page.locator("[data-observed-draft-status]")).toContainText("尚未应用");
  await expect(page.locator("#calc-results")).toContainText("请应用或放弃");
  await page.locator('[data-action="observed-entity-apply"]').click();
  await expect(page.locator("[data-observed-draft-status]")).toContainText("已应用");

  const contacts = page.locator(`[data-source-cast-state-field^="${context}.targetContacts."]`);
  await expect(contacts).toHaveCount(19);
  const contactPaths = await contacts.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-source-cast-state-field")!));
  for (const field of contactPaths) await page.locator(`[data-source-cast-state-field="${field}"]`).selectOption(field.endsWith("wave-2-1") ? "0" : "1");
  const equipment = await audit(page);
  expect(equipment.document.gameContext).toMatchObject({ skillId: "observed-klee-burst-c0", scopeCoverage: "complete-cast", effectiveTalentLevel: 1 });
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.result.status).toBe("calculated");
  expect(equipment.result.hits).toHaveLength(18);
  expect(equipment.result.hits.every(hit => hit.trace.some(node => node.id === "observed-entity.damageFrame"))).toBe(true);
  expect(equipment.document.hits.map(hit => hit.kind === "ordinary" ? hit.observedEntityEvent?.frame : undefined)).toEqual([186, 198, 198, 210, 306, 318, 401, 413, 425, 503, 515, 527, 610, 622, 634, 718, 730, 742]);
  expect(equipment.result.totals!.expected).toBeGreaterThan(0);
  expect(equipment.result.totals!.expected).toBeCloseTo(equipment.result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 9);

  await page.locator("#calc-build-mode").selectOption("manual-final");
  const converted = await audit(page);
  expect(converted.document.build.mode).toBe("manual-final");
  expect(converted.result.status).toBe("calculated");
  expect(converted.result.totals!.expected).toBeCloseTo(equipment.result.totals!.expected, 9);
  expect(Object.keys(converted.document.gameContext!.observedEntityCast!.finalizedHitEvents!)).toHaveLength(18);
  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "klee-observed-entities.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext!.observedEntityCast).toEqual(converted.document.gameContext!.observedEntityCast);
  expect(restored.document.hits).toEqual(converted.document.hits);
  expect(restored.document.selectedHitIds).toEqual(converted.document.selectedHitIds);
  expect(restored.result.totals).toEqual(converted.result.totals);

  const last = restored.result.hits.at(-1)!;
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator(`[data-hit-id="${last.id}"]`).check();
  const lifetime = page.locator('[data-source-cast-controls="observed-entity"] > details').first();
  await lifetime.locator(":scope > summary").click();
  await page.locator(`[data-source-cast-state-field="${context}.fullObservedLifetime"]`).selectOption("unknown");
  await lifetime.locator(":scope > summary").click();
  await page.locator('[data-observed-provided="klee.waves"]').selectOption("unknown");
  await page.locator('[data-action="observed-entity-apply"]').click();
  const single = await audit(page);
  expect(single.document.gameContext!.observedEntityCast!.klee!.waves).toBeUndefined();
  expect(single.result.status).toBe("calculated");
  expect(single.result.includedHitIds).toEqual([last.id]);
  expect(single.result.hits).toHaveLength(1);
  expect(single.result.totals!.expected).toBeCloseTo(last.expected!, 9);
});
