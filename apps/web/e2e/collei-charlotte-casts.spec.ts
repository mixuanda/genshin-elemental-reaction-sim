import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function selectAction(page: Page, characterId: string, label: string, skillId: string): Promise<void> {
  await page.locator("#calc-character").selectOption(characterId);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(value!);
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext!.effectiveTalentLevel).toBe(1);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-ascension").selectOption("6");
  for (const [field, value] of Object.entries({ atk: 1000, hp: 10000, def: 800, em: 0, critRate: 0.5, critDamage: 1 })) {
    await page.locator(`[data-field="build.stats.${field}"]`).fill(String(value));
  }
  await page.locator('[data-field="characterLevel"]').fill("90");
  await page.locator('[data-field="enemy.level"]').fill("90");
  await page.locator('[data-field="enemy.resistance"]').fill("0.1");
  expect((await audit(page)).document.gameContext).toMatchObject({ skillId, constellation: 0, scopeCoverage: "complete-cast" });
}

function expectSum(document: CalculatorDocument, result: CalculatorResult, count: number, nonCritical: number, expected: number): void {
  expect(result.status).toBe("calculated");
  expect(document.selectedHitIds).toHaveLength(count);
  expect(result.includedHitIds).toEqual(document.selectedHitIds);
  expect(result.hits).toHaveLength(count);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.expected).toBeCloseTo(expected, 9);
  expect(result.totals!.nonCritical).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.nonCritical!, 0), 10);
  expect(result.totals!.expected).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 10);
}

async function restoreExport(page: Page): Promise<Awaited<ReturnType<typeof audit>>> {
  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const document = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "conditioned-complete-cast.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(document.gameContext);
  expect(restored.document.selectedHitIds).toEqual(document.selectedHitIds);
  return restored;
}

async function enterReturnSnapshot(page: Page): Promise<void> {
  const snapshot = { "stats.atk": 2000, "stats.hp": 11000, "stats.def": 750, "stats.em": 50,
    "stats.critRate": 0.2, "stats.critDamage": 0.5, "stats.energyRecharge": 1.2, characterLevel: 90,
    ascension: 6, damageBonus: 0.3, additiveBaseDamage: 0, reactionBonus: 0 };
  for (const [field, value] of Object.entries(snapshot)) await page.locator(`[data-collei-snapshot="${field}"]`).fill(String(value));
  await page.locator("#calc-collei-snapshot-source").fill("教学条件：实际回收时刻面板，独立于E释放面板");
  await page.locator("#calc-collei-snapshot-apply").click();
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Collei complete two and four sprouts retain actual return snapshots independently of ring hits and JSON", async ({ page }) => {
  await page.goto("/calculator");
  await selectAction(page, "character:10000067", "完整往返＋2次新叶", "collei-skill-sprout-complete");
  const unresolved = await audit(page);
  expect(unresolved.result.status).toBe("blocked");
  expect(unresolved.document.gameContext!.colleiSkill?.sproutSnapshot).toBeUndefined();
  const ringId = unresolved.document.hits[0]!.id;
  const sproutId = unresolved.document.hits[2]!.id;
  const ring = 1000 * 1.512 * 0.5 * 0.9;
  const sprout = 2000 * 0.4 * 1.3 * 0.5 * 0.9;
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator(`[data-hit-id="${ringId}"]`).check();
  let current = await audit(page);
  expectSum(current.document, current.result, 1, ring, ring * 1.5);
  await page.locator(`[data-hit-id="${sproutId}"]`).check();
  expect((await audit(page)).result.status).toBe("blocked");
  await enterReturnSnapshot(page);
  current = await audit(page);
  expectSum(current.document, current.result, 1, sprout, sprout * 1.1);
  await page.locator("#calc-scope").selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");
  await page.locator("#calc-collei-reaction-before-return").selectOption("1");
  await page.locator("#calc-collei-sprout-uninterrupted").selectOption("1");
  const two = await audit(page);
  expectSum(two.document, two.result, 4, 2 * ring + 2 * sprout, 2 * ring * 1.5 + 2 * sprout * 1.1);
  expect(two.document.hits.slice(0, 2).map(hit => hit.kind === "ordinary" ? hit.finalSnapshot : undefined)).toEqual([undefined, undefined]);
  expect(two.document.hits.slice(2).map(hit => hit.kind === "ordinary" ? hit.finalSnapshot : undefined)).toEqual(Array(2).fill(two.document.gameContext!.colleiSkill!.sproutSnapshot));
  await page.locator('[data-field="build.stats.atk"]').fill("1500");
  const changedRelease = await audit(page);
  expectSum(changedRelease.document, changedRelease.result, 4, 3 * ring + 2 * sprout, 3 * ring * 1.5 + 2 * sprout * 1.1);
  expect(changedRelease.result.hits.slice(2).map(hit => hit.expected)).toEqual(two.result.hits.slice(2).map(hit => hit.expected));

  await selectAction(page, "character:10000067", "完整往返＋4次新叶", "collei-skill-extended-sprout-complete");
  await page.locator("#calc-constellation").selectOption("2");
  await enterReturnSnapshot(page);
  await page.locator("#calc-collei-sprout-uninterrupted").selectOption("1");
  await page.locator("#calc-collei-reaction-before-return").selectOption("unknown");
  await page.locator("#calc-collei-reaction-during-sprout").selectOption("unknown");
  expect((await audit(page)).result.status).toBe("blocked");
  await page.locator("#calc-collei-reaction-during-sprout").selectOption("1");
  const four = await audit(page);
  expectSum(four.document, four.result, 6, 2 * ring + 4 * sprout, 2 * ring * 1.5 + 4 * sprout * 1.1);
  expect(four.document.gameContext!.colleiSkill!.reactionBeforeReturn).toBeUndefined();
  const restored = await restoreExport(page);
  expect(restored.result.totals).toEqual(four.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(four.result.hits.map(hit => hit.trace));
  await page.locator("#calc-collei-snapshot-clear").click();
  const cleared = await audit(page);
  expect(cleared.result.status).toBe("blocked");
  expect(cleared.document.gameContext!.colleiSkill!.sproutSnapshot).toBeUndefined();
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator(`[data-hit-id="${cleared.document.hits[0]!.id}"]`).check();
  const independentRing = await audit(page);
  expectSum(independentRing.document, independentRing.result, 1, ring, ring * 1.5);
  console.info("Collei conditioned browser measurements", JSON.stringify({ two: two.result.totals, changedRelease: changedRelease.result.totals,
    four: four.result.totals, json: restored.result.totals, ringWithoutReturnSnapshot: independentRing.result.totals }));
});

test("Charlotte complete press and hold use explicit A4 roster scope and preserve included final bonus through JSON", async ({ page }) => {
  await page.goto("/calculator");
  await selectAction(page, "character:10000088", "点按初击＋4次速照标记", "charlotte-skill-press-complete");
  const count = page.locator("#calc-charlotte-non-fontaine");
  await expect(count).toHaveValue("");
  expect((await audit(page)).result.status).toBe("blocked");
  await page.locator("#calc-charlotte-mark-uninterrupted").selectOption("1");
  await page.locator("#calc-charlotte-stats-stable-across-hits").selectOption("1");
  await count.fill("2");
  const pressBase = 1000 * (0.672 + 4 * 0.392) * 0.5 * 0.9;
  const press = await audit(page);
  expectSum(press.document, press.result, 5, pressBase * 1.1, pressBase * 1.1 * 1.5);
  await count.fill("3");
  const threeTeammates = await audit(page);
  expectSum(threeTeammates.document, threeTeammates.result, 5, pressBase * 1.15, pressBase * 1.15 * 1.5);
  await count.fill("");
  await page.locator("#calc-scope").selectOption("single-hit");
  expect((await audit(page)).result.status).toBe("blocked");
  await count.fill("2");
  await page.locator("#calc-charlotte-mark-uninterrupted").selectOption("unknown");
  await page.locator("#calc-charlotte-stats-stable-across-hits").selectOption("unknown");
  const single = await audit(page);
  expectSum(single.document, single.result, 1, 1000 * 0.672 * 1.1 * 0.5 * 0.9, 1000 * 0.672 * 1.1 * 0.5 * 0.9 * 1.5);
  const bonusTrace = single.result.hits[0]!.trace.find(node => node.id === "customDamageBonus")!;
  const explanation = page.locator('#calc-results [data-detail-id="customDamageBonus"]');
  await explanation.locator(":scope > summary").click();
  await expect(explanation.locator(".trace-substitution")).toBeVisible();
  await expect(explanation.locator(".trace-substitution")).toContainText(bonusTrace.substitution);
  expect(bonusTrace.result!.value).toBeCloseTo(0.1, 12);
  await page.locator("#calc-scope").selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");
  await page.locator("#calc-charlotte-mark-uninterrupted").selectOption("1");
  await page.locator("#calc-charlotte-stats-stable-across-hits").selectOption("1");
  await page.locator("#calc-constellation").selectOption("2");
  expect((await audit(page)).result.status).toBe("blocked");

  await selectAction(page, "character:10000088", "长按初击＋8次聚焦标记", "charlotte-skill-hold-complete");
  await page.locator("#calc-charlotte-non-fontaine").fill("2");
  await page.locator("#calc-charlotte-mark-uninterrupted").selectOption("1");
  await page.locator("#calc-charlotte-stats-stable-across-hits").selectOption("1");
  const holdBase = 1000 * (1.392 + 8 * 0.406) * 0.5 * 0.9;
  const hold = await audit(page);
  expectSum(hold.document, hold.result, 9, holdBase * 1.1, holdBase * 1.1 * 1.5);
  for (let index = 0; index < 9; index += 1) await page.locator(`[data-field="hits.${index}.damageBonus"]`).fill("0.1");
  await page.locator("#calc-charlotte-a4-included").selectOption("1");
  const included = await audit(page);
  expect(included.document.build.mode).toBe("manual-final");
  expect(included.result.totals).toEqual(hold.result.totals);
  expect(included.result.hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual(Array(9).fill(0));
  const restored = await restoreExport(page);
  expect(restored.result.totals).toEqual(included.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(included.result.hits.map(hit => hit.trace));
  console.info("Charlotte conditioned browser measurements", JSON.stringify({ press: press.result.totals, threeTeammates: threeTeammates.result.totals,
    single: single.result.totals, hold: hold.result.totals, included: included.result.totals, json: restored.result.totals }));
});
