import { revealControl } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function selectCompleteAction(page: Page, characterId: string, label: string, skillId: string): Promise<void> {
  await (await revealControl(page.locator("#calc-character"))).selectOption(characterId);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext!.effectiveTalentLevel).toBe(1);
  await (await revealControl(page.locator("#calc-constellation"))).selectOption("0");
  await (await revealControl(page.locator("#calc-ascension"))).selectOption("6");
  for (const [field, value] of Object.entries({ atk: 1000, hp: 10000, em: 0, critRate: 0.5, critDamage: 1 })) {
    await (await revealControl(page.locator(`[data-field="build.stats.${field}"]`))).fill(String(value));
  }
  await (await revealControl(page.locator('[data-field="characterLevel"]'))).fill("90");
  await (await revealControl(page.locator('[data-field="enemy.level"]'))).fill("90");
  await (await revealControl(page.locator('[data-field="enemy.resistance"]'))).fill("0.1");
  const selected = await audit(page);
  expect(selected.document.gameContext).toMatchObject({ skillId, constellation: 0, scopeCoverage: "complete-cast" });
  expect(selected.document.scope).toBe("one-cast");
}

function expectCompleteSum(document: CalculatorDocument, result: CalculatorResult, count: number, nonCritical: number): void {
  expect(result.status).toBe("calculated");
  expect(document.hits).toHaveLength(count);
  expect(document.selectedHitIds).toHaveLength(count);
  expect(result.includedHitIds).toEqual(document.selectedHitIds);
  expect(result.hits).toHaveLength(count);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
  expect(result.totals!.nonCritical).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.nonCritical!, 0), 10);
  expect(result.totals!.expected).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 10);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Four sourced complete casts work independently and Baizhu retains one explicit cast-HP snapshot through single hits, final panels and JSON", async ({ page }) => {
  await page.goto("/calculator");
  const measured: Record<string, number> = {};
  const cases = [
    { character: "character:10000068", label: "完整初弹与两枚售后弹", skill: "dori-skill-complete-cast-c0", count: 3, nonCritical: 1000 * (1.4728 + 2 * 0.3156) * 0.5 * 0.9 },
    { character: "character:10000070", label: "完整初击与永世流沔", skill: "nilou-burst-complete-cast-c0", count: 2, nonCritical: 10000 * (0.18432 + 0.22528) * 0.5 * 0.9 },
    { character: "character:10000037", label: "完整释放与冰莲爆炸", skill: "ganyu-skill-complete-cast-c0", count: 2, nonCritical: 1000 * 2 * 1.32 * 0.5 * 0.9 },
  ];
  for (const entry of cases) {
    await selectCompleteAction(page, entry.character, entry.label, entry.skill);
    const selected = await audit(page);
    expectCompleteSum(selected.document, selected.result, entry.count, entry.nonCritical);
    measured[entry.skill] = selected.result.totals!.nonCritical;
  }

  await selectCompleteAction(page, "character:10000082", "完整三击", "baizhu-skill-complete-cast-c0");
  const hp = page.locator("#calc-baizhu-cast-hp");
  await expect(hp).toHaveValue("");
  expect((await audit(page)).result.status).toBe("blocked");
  await hp.fill("0.5");
  const threshold = await audit(page);
  const baseThreeHits = 3 * 1000 * 0.792 * 0.5 * 0.9;
  expectCompleteSum(threshold.document, threshold.result, 3, baseThreeHits * 1.25);
  expect(threshold.document.gameContext!.baizhuSkill).toEqual({ activeHpRatioAtCast: 0.5, a1IncludedInPanel: false });
  expect(threshold.result.hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual([0.25, 0.25, 0.25]);
  measured["baizhu-high-hp"] = threshold.result.totals!.nonCritical;
  await hp.fill("0.49");
  const low = await audit(page);
  expectCompleteSum(low.document, low.result, 3, baseThreeHits);
  expect(low.result.hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual([0, 0, 0]);
  measured["baizhu-low-hp"] = low.result.totals!.nonCritical;
  await hp.fill("");
  expect((await audit(page)).result.status).toBe("blocked");
  await hp.fill("0.5");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  const lastHitId = threshold.document.hits[2]!.id;
  await (await revealControl(page.locator(`[data-hit-id="${lastHitId}"]`))).check();
  const single = await audit(page);
  expect(single.result.status).toBe("calculated");
  expect(single.result.includedHitIds).toEqual([lastHitId]);
  expect(single.result.totals!.nonCritical).toBeCloseTo(1000 * 0.792 * 1.25 * 0.5 * 0.9, 9);
  const bonusTrace = single.result.hits[0]!.trace.find(node => node.id === "customDamageBonus")!;
  const explanation = page.locator('#calc-results [data-detail-id="customDamageBonus"]');
  await (await revealControl(explanation.locator(":scope > summary"))).click();
  await expect(explanation.locator(".trace-substitution")).toBeVisible();
  await expect(explanation.locator(".trace-substitution")).toContainText(bonusTrace.substitution);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  expect((await audit(page)).result.totals).toEqual(threshold.result.totals);

  // Explicit final bonus already contains A1: the shared formula must add zero to every hit.
  for (let index = 0; index < 3; index += 1) await (await revealControl(page.locator(`[data-field="hits.${index}.damageBonus"]`))).fill("0.25");
  await (await revealControl(page.locator("#calc-baizhu-a1-included"))).selectOption("1");
  const included = await audit(page);
  expect(included.result.totals).toEqual(threshold.result.totals);
  expect(included.result.hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual([0, 0, 0]);

  // Replace those explicit manual bonuses before deriving a fresh equipment panel.
  for (let index = 0; index < 3; index += 1) await (await revealControl(page.locator(`[data-field="hits.${index}.damageBonus"]`))).fill("0");
  await (await revealControl(page.locator("#calc-baizhu-a1-included"))).selectOption("0");
  await (await revealControl(page.locator('[data-equipment="weapon"]'))).selectOption("weapon:14301");
  await (await revealControl(page.locator('[data-equipment="weaponEffectsEnabled"]'))).uncheck();
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const equipment = await audit(page);
  expect(equipment.document.build.mode).toBe("equipment-derived");
  expect(equipment.result.status).toBe("calculated");
  expect(equipment.document.gameContext!.baizhuSkill).toEqual({ activeHpRatioAtCast: 0.5, a1IncludedInPanel: false });
  expect(equipment.result.hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual([0.25, 0.25, 0.25]);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  const final = await audit(page);
  expect(final.document.build.mode).toBe("manual-final");
  expect(final.document.gameContext!.baizhuSkill).toEqual(equipment.document.gameContext!.baizhuSkill);
  expect(final.result.totals).toEqual(equipment.result.totals);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "baizhu-complete-cast-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(final.document.gameContext);
  expect(restored.document.selectedHitIds).toEqual(final.document.selectedHitIds);
  expect(restored.result.totals).toEqual(final.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(final.result.hits.map(hit => hit.trace));
  console.info("Complete-cast coverage browser measurements", JSON.stringify({ nonCritical: measured,
    baizhuSingleNonCritical: single.result.totals!.nonCritical, includedPanelNonCritical: included.result.totals!.nonCritical,
    finalPanelNonCritical: final.result.totals!.nonCritical, jsonNonCritical: restored.result.totals!.nonCritical }));
});
