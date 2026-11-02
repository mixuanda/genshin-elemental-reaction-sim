import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

const audit = async (page: Page) => JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
async function openAnsweredConditions(page: Page) {
  const panel = page.locator("[data-calculator-inline-conditions]");
  if (await panel.locator(":scope > summary").count() && await panel.getAttribute("open") === null)
    await panel.locator(":scope > summary").click();
}
async function choose(page: Page, characterId: string, name: string) {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption(characterId);
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").blur();
  const option = page.locator("#calc-skill option").filter({ hasText: name });
  await expect(option).toHaveCount(1);
  await page.locator("#calc-skill").selectOption((await option.getAttribute("value"))!);
}
async function roundtrip(page: Page, path: string) {
  const before = await audit(page), pending = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const json = await readFile((await (await pending).path())!, "utf8");
  await writeFile(path, json);
  await page.reload();
  await page.locator("#calc-import").setInputFiles(path);
  await expect(page.locator("#calc-results .calculator-audit pre")).toBeAttached();
  const after = await audit(page);
  expect(after.document).toEqual(before.document);
  expect(after.result).toEqual(before.result);
  expect(await readFile(path, "utf8")).toBe(json);
  return after;
}

test("Kuki Q asks for cast HP in place, rejects the wrong branch and preserves a calculated twelve-hit file", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await choose(page, "character:10000065", "完整12击");
  const panel = page.locator("[data-calculator-inline-conditions]"), hp = panel.locator('[data-field="gameContext.kukiDamage.burstHpRatioAtCast"]');
  await expect(hp).toBeVisible();
  expect((await audit(page)).result.status).toBe("blocked");
  await hp.fill("0.5"); await hp.blur();
  let data = await audit(page);
  expect(data.result.status).toBe("calculated");
  expect(data.result.totals.nonCritical).toBeCloseTo(12 * .036048 * 20000 * .5 * .9, 8);
  await openAnsweredConditions(page);
  await hp.fill("0.500001"); await hp.blur();
  data = await audit(page);
  expect(data.result.status).toBe("blocked"); expect(data.result.totals).toBeUndefined();
  await expect(panel.locator("#calc-skill")).toBeVisible();
  await hp.fill("0.5"); await hp.blur();
  expect((await audit(page)).result.status).toBe("calculated");
  await page.screenshot({ path: testInfo.outputPath("kuki-explicit-hp.png"), fullPage: true });
  data = await roundtrip(page, testInfo.outputPath("kuki-q.calculator.json"));
  expect(data.document.gameContext.kukiDamage.burstHpRatioAtCast).toBe(.5);
  expect(data.result.hits).toHaveLength(12);
  expect(errors).toEqual([]);
});

test("Charlotte E exposes team count, then only the selected C2 hit; zero and unknown remain distinct on narrow screens", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await choose(page, "character:10000088", "点按初击＋4次速照标记");
  let panel = page.locator("[data-calculator-inline-conditions]");
  const count = panel.locator("#calc-charlotte-non-fontaine");
  await expect(count).toBeVisible();
  await count.fill("0"); await count.blur();
  await panel.locator("#calc-charlotte-mark-uninterrupted").selectOption("1");
  await panel.locator("#calc-charlotte-stats-stable-across-hits").selectOption("1");
  let data = await audit(page);
  expect(data.result.status).toBe("calculated");
  expect(data.result.totals.nonCritical).toBeCloseTo((.672 + 4 * .392) * 2000 * .5 * .9, 8);
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator("#calc-constellation").selectOption("2");
  panel = page.locator("[data-calculator-inline-conditions]");
  const actual = panel.locator('input[data-charlotte-c2-hit]');
  await expect(actual).toHaveCount(1); await expect(actual).toBeVisible();
  await panel.locator("#calc-charlotte-c2-included").fill("0");
  await panel.locator("#calc-charlotte-c2-included").blur();
  await actual.fill("0"); await actual.blur();
  data = await audit(page);
  expect(data.result.status).toBe("calculated");
  expect(data.result.totals.nonCritical).toBeCloseTo(.672 * 2000 * .5 * .9, 8);
  await openAnsweredConditions(page);
  await actual.fill(""); await actual.blur();
  data = await audit(page);
  expect(data.result.status).toBe("blocked"); expect(data.result.totals).toBeUndefined();
  await actual.fill("0"); await actual.blur();
  await page.screenshot({ path: testInfo.outputPath("charlotte-selected-c2.png"), fullPage: true });
  await roundtrip(page, testInfo.outputPath("charlotte-e.calculator.json"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("Neuvillette C0 E asks for this hit's HP and A4 share without requiring a whole future cast", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000087");
  const option = page.locator("#calc-skill option").filter({ hasText: "泪水啊，我必偿还·初击" });
  await expect(option).toHaveCount(1);
  await page.locator("#calc-skill").selectOption((await option.getAttribute("value"))!);
  const panel = page.locator("[data-calculator-inline-conditions]");
  const hp = panel.locator('[data-field$=".actualHpRatio"]');
  const included = panel.locator('[data-field$=".includedHydroBonus"]');
  await expect(hp).toBeVisible(); await expect(included).toBeVisible();
  expect((await audit(page)).result.status).toBe("blocked");
  await hp.fill("0.5"); await hp.blur();
  await included.fill("0"); await included.blur();
  let data = await audit(page);
  const expected = 20000 * .231552 * 1.12 * .5 * .9;
  expect(data.result.status).toBe("calculated");
  expect(data.result.totals.nonCritical).toBeCloseTo(expected, 8);
  expect(data.document.scope).toBe("single-hit");
  // The same 12% A4 is now included in the explicit input bonus. Its accounting
  // declaration removes the duplicated share, preserving the original damage.
  await page.locator('[data-field="hits.0.damageBonus"]').fill("0.12");
  await page.locator('[data-field="hits.0.damageBonus"]').blur();
  await openAnsweredConditions(page);
  await included.fill("0.12"); await included.blur();
  data = await audit(page);
  expect(data.result.totals.nonCritical).toBeCloseTo(expected, 8);
  await openAnsweredConditions(page);
  await hp.fill(""); await hp.blur();
  expect((await audit(page)).result.status).toBe("blocked");
  await hp.fill("0.5"); await hp.blur();
  await page.screenshot({ path: testInfo.outputPath("neuvillette-e-a4.png"), fullPage: true });
  data = await roundtrip(page, testInfo.outputPath("neuvillette-e.calculator.json"));
  expect(data.result.totals.nonCritical).toBeCloseTo(expected, 8);
  expect(errors).toEqual([]);
});
