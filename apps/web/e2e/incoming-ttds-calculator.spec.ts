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

test("Incoming TTDS keeps support ownership and per-hit final-panel differences alongside Charlotte C2 without a team", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000088");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const actionValue = await page.locator("#calc-skill option").filter({ hasText: "点按初击＋4次速照标记" }).getAttribute("value");
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
  await (await revealControl(page.locator("#calc-charlotte-c2-base-atk"))).fill("500");
  await (await revealControl(page.locator("#calc-charlotte-c2-included"))).fill("0");
  const hitIds = (await audit(page)).document.hits.map(hit => hit.id);
  expect(hitIds).toHaveLength(5);
  for (const hitId of hitIds) await (await revealControl(page.locator(`[data-charlotte-c2-hit="${hitId}"]`))).fill("1");
  const recipient = await audit(page);
  expect(recipient.result.status).toBe("calculated");

  await (await revealControl(page.locator("#calc-ttds-enabled"))).check();
  await (await revealControl(page.locator("#calc-ttds-owner-id"))).fill("support-lisa");
  await (await revealControl(page.locator("#calc-ttds-owner-label"))).fill("丽莎·讨龙持有者");
  await (await revealControl(page.locator("#calc-ttds-refinement"))).selectOption("5");
  await expect(page.locator("#calc-ttds-base-atk")).toHaveValue("");
  expect((await audit(page)).result.status).toBe("blocked");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator(`[data-hit-id="${hitIds[3]}"]`))).check();
  await (await revealControl(page.locator(`[data-ttds-active="${hitIds[3]}"]`))).selectOption("1");
  await (await revealControl(page.locator(`[data-ttds-included="${hitIds[3]}"]`))).fill("5");
  const multiplier = 1.1 * 0.5 * 0.9;
  const sameIncluded = await audit(page);
  expectDamage(sameIncluded.result, 1, (1000 + 500 * 0.1) * 0.392 * multiplier);
  expect(sameIncluded.document.incomingThrillingTales!.baseAttack).toBeUndefined();
  expect(sameIncluded.result.hits[0]!.trace.find(node => node.id === "incomingThrillingTalesAdjustment")!.result!.value).toBe(0);
  await expect(page.locator(`[data-ttds-active="${hitIds[1]}"]`)).toHaveValue("unknown");

  await (await revealControl(page.locator(`[data-hit-id="${hitIds[0]}"]`))).check();
  await (await revealControl(page.locator(`[data-ttds-active="${hitIds[0]}"]`))).selectOption("1");
  await (await revealControl(page.locator(`[data-ttds-included="${hitIds[0]}"]`))).fill("0");
  expect((await audit(page)).result.status).toBe("blocked");
  await (await revealControl(page.locator("#calc-ttds-base-atk"))).fill("500");
  const buffedInitial = await audit(page);
  expectDamage(buffedInitial.result, 1, (1000 + 500 * 0.1 + 500 * 0.48) * 0.672 * multiplier);
  expect(buffedInitial.result.hits[0]!.trace.find(node => node.id === "sourceAttackAdjustment")!.result!.value).toBe(50);
  expect(buffedInitial.result.hits[0]!.trace.find(node => node.id === "incomingThrillingTalesAdjustment")!.result!.value).toBe(240);
  expect(buffedInitial.result.hits[0]!.trace.find(node => node.id === "afterIncomingThrillingTales")!.result!.value).toBe(1240);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");

  const states = [{ active: true, included: 0 }, { active: false, included: 1 }, { active: true, included: 1 },
    { active: true, included: 5 }, { active: false, included: 0 }];
  for (const [index, hitId] of hitIds.entries()) {
    await (await revealControl(page.locator(`[data-ttds-active="${hitId}"]`))).selectOption(states[index]!.active ? "1" : "0");
    await (await revealControl(page.locator(`[data-ttds-included="${hitId}"]`))).fill(String(states[index]!.included));
  }
  const complete = await audit(page);
  const attacks = [1000 + 50 + 240, 1000 + 50 - 120, 1000 + 50 + 120, 1000 + 50, 1000 + 50];
  const nonCritical = (0.672 * attacks[0]! + 0.392 * attacks.slice(1).reduce((sum, attack) => sum + attack, 0)) * multiplier;
  expectDamage(complete.result, 5, nonCritical);
  expect(complete.result.includedHitIds).toEqual(hitIds);
  expect(complete.result.hits.map(hit => hit.trace.find(node => node.id === "incomingThrillingTalesAdjustment")!.result!.value)).toEqual([240, -120, 120, 0, 0]);
  expect(complete.result.hits.map(hit => hit.trace.find(node => node.id === "sourceAttackAdjustment")!.result!.value)).toEqual([50, 50, 50, 50, 50]);
  expect(complete.result.hits.map(hit => hit.trace.find(node => node.id === "hitAttack")!.result!.value)).toEqual(attacks);
  expect(complete.document.build).toEqual(recipient.document.build);
  expect(complete.document.gameContext!.charlotteSkill).toEqual(recipient.document.gameContext!.charlotteSkill);
  expect(complete.document.incomingThrillingTales).toMatchObject({ ownerId: "support-lisa", ownerLabel: "丽莎·讨龙持有者", refinement: 5, baseAttack: 500 });
  expect(complete.document.gameContext!.characterId).toBe("character:10000088");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator(`[data-hit-id="${hitIds[1]}"]`))).check();
  const expiredOldR1 = await audit(page);
  expectDamage(expiredOldR1.result, 1, (1000 + 50 - 500 * 0.24) * 0.392 * multiplier);
  const deduction = expiredOldR1.result.hits[0]!.trace.find(node => node.id === "incomingThrillingTalesAdjustment")!;
  const explanation = page.locator('#calc-results [data-detail-id="incomingThrillingTalesAdjustment"]');
  await (await revealControl(explanation.locator(":scope > summary"))).click();
  await expect(explanation.locator(".trace-substitution")).toBeVisible();
  await expect(explanation.locator(".trace-substitution")).toContainText(deduction.substitution);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");

  const downloading = page.waitForEvent("download");
  await (await revealControl(page.locator('[data-action="export"]'))).click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "incoming-ttds-per-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  await expect(page.locator("#calc-ttds-owner-id")).toHaveValue("support-lisa");
  await expect(page.locator("#calc-ttds-refinement")).toHaveValue("5");
  const restored = await audit(page);
  expect(restored.document.incomingThrillingTales).toEqual(saved.incomingThrillingTales);
  expect(restored.document.build).toEqual(recipient.document.build);
  expect(restored.result.totals).toEqual(complete.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(complete.result.hits.map(hit => hit.trace));
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  console.info("Incoming TTDS browser measurements", JSON.stringify({ sameIncludedWithoutBase: sameIncluded.result.totals,
    buffedInitial: buffedInitial.result.totals, complete: complete.result.totals, expiredOldR1: expiredOldR1.result.totals,
    json: restored.result.totals }));
});
