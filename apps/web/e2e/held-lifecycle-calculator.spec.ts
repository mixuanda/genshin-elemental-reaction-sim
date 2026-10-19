import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Hydro Traveler held cast uses observed HP and contacts, preserves final JSON, and leaves an independent hit usable", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000005");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await page.locator("#calc-form").selectOption("aether-hydro");
  const action = await page.locator("#calc-skill option").filter({ hasText: "完整长按无充盈" }).getAttribute("value");
  expect(action).toBeTruthy();
  await page.locator("#calc-skill").selectOption(action!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);

  // Real equipment controls make the later final-panel step a numerical conversion.
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:11101");
  await page.locator('[data-equipment="ascension"]').selectOption("6");
  await page.locator('[data-equipment="level"]').fill("90");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').uncheck();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  await page.locator("#calc-scope").selectOption("one-cast");

  const contextPath = "gameContext.heldLifecycleCast";
  const controls = page.locator('[data-source-cast-controls="held-lifecycle"]');
  await expect(controls).toBeVisible();
  await page.locator(`[data-source-cast-text-field="${contextPath}.casterId"]`).fill("owner");
  await page.locator(`[data-source-cast-text-field="${contextPath}.targetId"]`).fill("enemy");
  for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits", "hydroHold.arkheReady", "hydroHold.noHealingOrDropletPickup"]) {
    await page.locator(`[data-source-cast-state-field="${contextPath}.${field}"]`).selectOption("1");
  }
  for (const [field, value] of Object.entries({ observedThroughFrame: "200", "hydroHold.dewdropCount": "3", "hydroHold.travelFrames": "6", "hydroHold.priorA4Bonus": "0" })) {
    await page.locator(`[data-field="${contextPath}.${field}"]`).fill(value);
  }
  expect((await audit(page)).result.status).toBe("blocked");

  // Normal HP inputs create an explicit per-projectile record, never copied from a guessed start HP.
  await page.locator('[data-action="held-lifecycle-hp-sync"]').click();
  for (let index = 0; index < 3; index++) await page.locator(`[data-held-hp-index="${index}"]`).fill("0.5");
  await expect(page.locator("[data-held-draft-status]")).toContainText("尚未应用");
  await expect(page.locator("#calc-results")).toContainText("请应用或放弃");
  await page.locator('[data-action="held-lifecycle-apply"]').click();
  await expect(page.locator("[data-held-draft-status]")).toContainText("已应用");

  // Three emitted drops are distinct from their two actual contacts.
  for (const [candidate, contact] of Object.entries({ "dewdrop-1": "1", "dewdrop-2": "0", "dewdrop-3": "1", torrent: "1", arkhe: "1" })) {
    await page.locator(`[data-source-cast-state-field="${contextPath}.targetContacts.${candidate}"]`).selectOption(contact);
  }
  const equipment = await audit(page);
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.document.gameContext).toMatchObject({ skillId: "held-aether-hydro-skill-no-suffusion-c0", scopeCoverage: "complete-cast", effectiveTalentLevel: 1 });
  expect(equipment.document.gameContext!.heldLifecycleCast!.hydroHold!.hpRatiosBeforeDewdrops).toEqual([0.5, 0.5, 0.5]);
  expect(equipment.result.status).toBe("calculated");
  expect(equipment.result.hits).toHaveLength(4);
  expect(equipment.document.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : undefined)).toEqual([61, 87, 91, 133]);
  expect(equipment.result.hits.every(hit => hit.trace.some(node => node.id === "held-lifecycle.damage-frame"))).toBe(true);
  expect(equipment.result.totals!.expected).toBeGreaterThan(0);
  expect(equipment.result.totals!.expected).toBeCloseTo(equipment.result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 9);

  await page.locator("#calc-build-mode").selectOption("manual-final");
  const converted = await audit(page);
  expect(converted.document.build.mode).toBe("manual-final");
  expect(converted.result.status).toBe("calculated");
  expect(converted.result.totals!.expected).toBeCloseTo(equipment.result.totals!.expected, 9);
  expect(Object.keys(converted.document.gameContext!.heldLifecycleCast!.finalizedHitEvents!)).toHaveLength(4);

  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "hydro-held-observed-cast.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext!.heldLifecycleCast).toEqual(converted.document.gameContext!.heldLifecycleCast);
  expect(restored.document.hits).toEqual(converted.document.hits);
  expect(restored.document.selectedHitIds).toEqual(converted.document.selectedHitIds);
  expect(restored.result.totals).toEqual(converted.result.totals);

  const arkhe = restored.result.hits.at(-1)!;
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator(`[data-hit-id="${arkhe.id}"]`).check();
  await controls.locator(":scope > details").first().locator(":scope > summary").click();
  await page.locator(`[data-source-cast-state-field="${contextPath}.fullObservedLifetime"]`).selectOption("unknown");
  // Changing a condition remounts controls; reopen the independent full-history editor.
  await controls.locator(":scope > details").first().locator(":scope > summary").click();
  await page.locator("[data-held-hp-known]").selectOption("unknown");
  await page.locator('[data-action="held-lifecycle-apply"]').click();
  const single = await audit(page);
  expect(single.document.gameContext!.heldLifecycleCast!.hydroHold!.hpRatiosBeforeDewdrops).toBeUndefined();
  expect(single.result.status).toBe("calculated");
  expect(single.result.includedHitIds).toEqual([arkhe.id]);
  expect(single.result.hits).toHaveLength(1);
  expect(single.result.totals!.expected).toBeCloseTo(arkhe.expected!, 9);
});
