import { revealControl } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

function expectDamage(result: CalculatorResult, count: number, nonCritical: number): void {
  expect(result.status).toBe("calculated");
  expect(result.hits).toHaveLength(count);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
  expect(result.totals!.nonCritical).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.nonCritical!, 0), 10);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Charlotte C2 uses each selected hit's explicit ATK state and preserves full-cast accounting and traces in JSON", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000088");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const actionValue = await page.locator("#calc-skill option").filter({ hasText: "长按初击＋8次聚焦标记" }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(actionValue!);
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext!.effectiveTalentLevel).toBe(1);
  await (await revealControl(page.locator("#calc-constellation"))).selectOption("2");
  await (await revealControl(page.locator("#calc-ascension"))).selectOption("6");
  for (const [field, value] of Object.entries({ atk: 1000, hp: 10000, def: 800, em: 0, critRate: 0.5, critDamage: 1 })) {
    await (await revealControl(page.locator(`[data-field="build.stats.${field}"]`))).fill(String(value));
  }
  await (await revealControl(page.locator('[data-field="characterLevel"]'))).fill("90");
  await (await revealControl(page.locator('[data-field="enemy.level"]'))).fill("90");
  await (await revealControl(page.locator('[data-field="enemy.resistance"]'))).fill("0.1");
  await (await revealControl(page.locator("#calc-charlotte-non-fontaine"))).fill("2");
  await (await revealControl(page.locator("#calc-charlotte-a4-included"))).selectOption("0");
  await (await revealControl(page.locator("#calc-charlotte-mark-uninterrupted"))).selectOption("1");
  await (await revealControl(page.locator("#calc-charlotte-stats-stable-across-hits"))).selectOption("1");
  const initial = await audit(page);
  expect(initial.document.gameContext).toMatchObject({ skillId: "charlotte-skill-hold-complete", constellation: 2 });
  expect(initial.document.hits).toHaveLength(9);
  expect(initial.result.status).toBe("blocked");
  await expect(page.locator("#calc-charlotte-c2-included")).toHaveValue("");
  await expect(page.locator("#calc-charlotte-c2-base-atk")).toHaveValue("");
  const hitIds = initial.document.hits.map(hit => hit.id);
  const firstMark = hitIds[1]!;
  const lastMark = hitIds[8]!;
  await (await revealControl(page.locator("#calc-charlotte-c2-base-atk"))).fill("500");
  await (await revealControl(page.locator("#calc-charlotte-c2-included"))).fill("0");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator(`[data-hit-id="${firstMark}"]`))).check();
  expect((await audit(page)).result.status).toBe("blocked");
  await (await revealControl(page.locator(`[data-charlotte-c2-hit="${firstMark}"]`))).fill("1");
  const singleBuffed = await audit(page);
  const multiplier = 1.1 * 0.5 * 0.9;
  const buffedAttack = 1000 + 500 * 0.1;
  expectDamage(singleBuffed.result, 1, buffedAttack * 0.406 * multiplier);
  expect(singleBuffed.document.gameContext!.charlotteSkill!.c2HitStacks?.[lastMark]).toBeUndefined();
  expect(singleBuffed.result.includedHitIds).toEqual([firstMark]);
  const adjustment = singleBuffed.result.hits[0]!.trace.find(node => node.id === "sourceAttackAdjustment")!;
  expect(adjustment.result!.value).toBe(50);
  const explanation = page.locator('#calc-results [data-detail-id="sourceAttackAdjustment"]');
  await (await revealControl(explanation.locator(":scope > summary"))).click();
  await expect(explanation.locator(".trace-substitution")).toBeVisible();
  await expect(explanation.locator(".trace-substitution")).toContainText(adjustment.substitution);
  await expect(explanation).toContainText("charlotteBaseAttack");
  await (await revealControl(page.locator(`[data-hit-id="${lastMark}"]`))).check();
  expect((await audit(page)).result.status).toBe("blocked");
  await (await revealControl(page.locator(`[data-charlotte-c2-hit="${lastMark}"]`))).fill("0");
  const singleExpired = await audit(page);
  expectDamage(singleExpired.result, 1, 1000 * 0.406 * multiplier);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");

  // Same state sequence as the archived hold observation; these panel values are explicit teaching inputs.
  const actualStacks = hitIds.map((_id, index) => index === 0 || index === 8 ? 0 : 1);
  for (const [index, hitId] of hitIds.entries()) {
    await (await revealControl(page.locator(`[data-charlotte-c2-hit="${hitId}"]`))).fill(String(actualStacks[index]));
  }
  const complete = await audit(page);
  const fullNonCritical = (1.392 * 1000 + 7 * 0.406 * buffedAttack + 0.406 * 1000) * multiplier;
  expectDamage(complete.result, 9, fullNonCritical);
  expect(complete.result.includedHitIds).toEqual(hitIds);
  expect(complete.result.hits.map(hit => hit.trace.find(node => node.id === "sourceAttackAdjustment")!.result!.value)).toEqual(actualStacks.map(stacks => stacks * 50));
  expect(complete.result.hits.map(hit => hit.trace.find(node => node.id === "hitAttack")!.result!.value)).toEqual(actualStacks.map(stacks => 1000 + stacks * 50));

  // The common final ATK can already contain one stack; unbuffed first/last hits must subtract it once.
  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("1050");
  await (await revealControl(page.locator("#calc-charlotte-c2-included"))).fill("1");
  const included = await audit(page);
  expect(included.result.totals).toEqual(complete.result.totals);
  expect(included.result.hits.map(hit => hit.trace.find(node => node.id === "sourceAttackAdjustment")!.result!.value)).toEqual(actualStacks.map(stacks => (stacks - 1) * 50));
  const downloading = page.waitForEvent("download");
  await (await revealControl(page.locator('[data-action="export"]'))).click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "charlotte-c2-per-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  await expect(page.locator("#calc-charlotte-c2-included")).toHaveValue("1");
  await expect(page.locator("#calc-charlotte-c2-base-atk")).toHaveValue("500");
  const restored = await audit(page);
  expect(restored.document.gameContext!.charlotteSkill).toEqual(included.document.gameContext!.charlotteSkill);
  expect(restored.document.selectedHitIds).toEqual(hitIds);
  expect(restored.result.totals).toEqual(included.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(included.result.hits.map(hit => hit.trace));
  console.info("Charlotte C2 per-hit browser measurements", JSON.stringify({ firstMark: singleBuffed.result.totals,
    finalMark: singleExpired.result.totals, complete: complete.result.totals, includedPanel: included.result.totals,
    json: restored.result.totals, includedAttackDeltas: included.result.hits.map(hit => hit.trace.find(node => node.id === "sourceAttackAdjustment")!.result!.value) }));
});
