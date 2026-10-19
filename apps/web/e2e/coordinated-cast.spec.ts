import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("one explicit coordinated schedule is editable, survives final-panel JSON, and retains an independent last hit", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000025");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const action = await page.locator("#calc-skill option").filter({ hasText: /裁雨留虹.*显式日程/ }).getAttribute("value");
  expect(action).toBeTruthy();
  await page.locator("#calc-skill").selectOption(action!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");

  // Use the real equipment UI so the later mode change executes a numerical conversion.
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:11101");
  await page.locator('[data-equipment="ascension"]').selectOption("6");
  await page.locator('[data-equipment="level"]').fill("90");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').uncheck();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  await page.locator("#calc-scope").selectOption("one-cast");
  const contextPath = "gameContext.coordinatedCast";
  await page.locator(`[data-source-cast-text-field="${contextPath}.casterId"]`).fill("owner");
  await page.locator(`[data-source-cast-text-field="${contextPath}.targetId"]`).fill("enemy");
  for (const field of ["freshCastConfirmed", "fullObservedLifetime", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits"]) {
    await page.locator(`[data-source-cast-state-field="${contextPath}.${field}"]`).selectOption("1");
  }
  await page.locator(`[data-field="${contextPath}.observedThroughFrame"]`).fill("1000");
  await page.locator(`[data-field="${contextPath}.sharedState.includedDamageBonus"]`).fill("0");
  expect((await audit(page)).result.status).toBe("blocked");

  // Enter the observed normal-animation interval through ordinary controls, not imported JSON.
  await page.locator('[data-action="source-cast-schedule-add"][data-coordinated-collection="normalStates"]').click();
  const row = page.locator('[data-coordinated-draft-row="normalStates"]').first();
  for (const [field, value] of Object.entries({ id: "normal", startFrame: "100", endFrame: "221", actorId: "driver", animationStartDelayFrames: "0" })) {
    await row.locator(`[data-coordinated-draft-key="${field}"]`).fill(value);
  }
  await row.locator('[data-coordinated-draft-key="onField"]').selectOption("true");
  await row.locator('[data-coordinated-draft-key="firstNormalInChain"]').selectOption("true");
  await expect(page.locator("[data-coordinated-draft-status]")).toContainText("尚未应用");
  await page.locator('[data-action="source-cast-schedule-apply"]').click();
  await expect(page.locator("[data-coordinated-draft-status]")).toContainText("已应用");
  const equipment = await audit(page);
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.document.gameContext).toMatchObject({ skillId: "coordinated-xingqiu-burst-c0", scopeCoverage: "complete-cast", effectiveTalentLevel: 1 });
  expect(equipment.result.status).toBe("calculated");
  expect(equipment.result.hits).toHaveLength(7);
  expect(equipment.document.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : undefined)).toEqual([120, 120, 180, 180, 180, 240, 240]);
  expect(equipment.result.hits.every(hit => hit.trace.some(node => node.id === "coordinated.damage-frame"))).toBe(true);
  expect(equipment.result.totals!.expected).toBeGreaterThan(0);
  expect(equipment.result.totals!.expected).toBeCloseTo(equipment.result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 9);

  await page.locator("#calc-build-mode").selectOption("manual-final");
  const converted = await audit(page);
  expect(converted.document.build.mode).toBe("manual-final");
  expect(converted.result.status).toBe("calculated");
  expect(converted.result.totals!.expected).toBeCloseTo(equipment.result.totals!.expected, 9);
  expect(Object.keys(converted.document.gameContext!.coordinatedCast!.finalizedHitEvents!)).toHaveLength(7);

  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "xingqiu-explicit-schedule.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext!.coordinatedCast).toEqual(converted.document.gameContext!.coordinatedCast);
  expect(restored.document.hits).toEqual(converted.document.hits);
  expect(restored.document.selectedHitIds).toEqual(converted.document.selectedHitIds);
  expect(restored.result.totals).toEqual(converted.result.totals);

  const last = restored.result.hits.at(-1)!;
  const lastId = restored.document.hits.at(-1)!.id;
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator(`[data-hit-id="${lastId}"]`).check();
  await page.locator(`[data-source-cast-state-field="${contextPath}.fullObservedLifetime"]`).selectOption("unknown");
  await page.locator('[data-coordinated-collection-known="normalStates"]').selectOption("unknown");
  await page.locator('[data-action="source-cast-schedule-apply"]').click();
  const single = await audit(page);
  expect(single.document.gameContext!.coordinatedCast!.normalStates).toBeUndefined();
  expect(single.result.status).toBe("calculated");
  expect(single.result.includedHitIds).toEqual([lastId]);
  expect(single.result.hits).toHaveLength(1);
  expect(single.result.totals!.expected).toBeCloseTo(last.expected!, 9);
});
