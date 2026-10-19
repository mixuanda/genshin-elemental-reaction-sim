import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

function expectDamage(result: CalculatorResult, nonCritical: number, critRate: number, critDamage: number): void {
  expect(result.status).toBe("calculated");
  expect(result.hits).toHaveLength(1);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.critical).toBeCloseTo(nonCritical * (1 + critDamage), 9);
  expect(result.totals!.expected).toBeCloseTo(nonCritical * (1 + critRate * critDamage), 9);
  expect(result).not.toHaveProperty("dps");
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Independent weapon procs need no team and retain edited final context across refinement, ATK or HP scaling and JSON", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-proc-weapon").selectOption("halberd");
  await page.locator("#calc-proc-refinement").selectOption("1");
  await page.locator('[data-action="load-weapon-proc"]').click();
  await expect(page.locator("#calc-character-status")).toContainText("不需要角色技能或队伍");
  await expect(page.locator("#calc-character")).toHaveValue("");
  const initial = await audit(page);
  expect(initial.document.id).toBe("weapon-proc:halberd:r1");
  expect(initial.document.gameContext).toBeUndefined();
  expect(initial.document.scope).toBe("single-hit");
  expect(initial.document.dataIdentity).toMatchObject({ releaseStatus: "released", evidenceStatus: "provisional" });
  expect(initial.document.hits[0]).toMatchObject({ kind: "ordinary", element: "physical", attackTag: "proc", additiveBaseDamage: 0 });
  expectDamage(initial.result, 1000 * 1.6 * 0.5 * 0.9, 0.5, 1);
  const sourceCoefficient = page.locator('[data-field="hits.0.baseDamageFormula.inputs.0.value"]');
  await expect(sourceCoefficient).toBeDisabled();
  await expect(sourceCoefficient).toHaveValue("1.6");
  await expect(page.locator('[data-field="hits.0.terms.0.coefficient"]')).toHaveAttribute("readonly", "");

  for (const [field, value] of Object.entries({ atk: 1500, hp: 20000, critRate: 0.2, critDamage: 1.5 })) {
    await page.locator(`[data-field="build.stats.${field}"]`).fill(String(value));
  }
  await page.locator('[data-field="characterLevel"]').fill("80");
  await page.locator('[data-field="enemy.level"]').fill("100");
  await page.locator('[data-field="enemy.resistance"]').fill("0.2");
  // Explicit combined physical/general bonus, with no host normal/E/Q-only bonus.
  await page.locator('[data-field="hits.0.damageBonus"]').fill("0.35");
  const multiplier = (1 + 0.35) * ((80 + 100) / ((80 + 100) + (100 + 100))) * (1 - 0.2);
  const edited = await audit(page);
  expectDamage(edited.result, 1500 * 1.6 * multiplier, 0.2, 1.5);
  await page.locator("#calc-proc-refinement").selectOption("5");
  const refined = await audit(page);
  expectDamage(refined.result, 1500 * 3.2 * multiplier, 0.2, 1.5);
  expect(refined.document.build).toEqual(edited.document.build);
  expect(refined.document.enemy).toEqual(edited.document.enemy);
  expect(refined.document.characterLevel).toBe(80);
  expect(refined.document.hits[0]).toMatchObject({ damageBonus: 0.35, terms: [{ stat: "atk", coefficient: 3.2 }] });
  await expect(sourceCoefficient).toBeDisabled();
  await expect(sourceCoefficient).toHaveValue("3.2");
  const baseTrace = refined.result.hits[0]!.trace.find(node => node.id === "customBaseDamage")!;
  expect(baseTrace.result!.value).toBe(1500 * 3.2);
  const explanation = page.locator('#calc-results [data-detail-id="customBaseDamage"]');
  await explanation.locator(":scope > summary").click();
  await expect(explanation.locator(".trace-substitution")).toBeVisible();
  await expect(explanation.locator(".trace-substitution")).toContainText(baseTrace.substitution);
  await expect(explanation).toContainText("weaponProcCoefficient");

  await page.locator("#calc-proc-weapon").selectOption("ashgravendrinkinghorn");
  const hpProc = await audit(page);
  expect(hpProc.document.id).toBe("weapon-proc:ashgravendrinkinghorn:r5");
  expect(hpProc.document.build).toEqual(refined.document.build);
  expect(hpProc.document.enemy).toEqual(refined.document.enemy);
  expect(hpProc.document.hits[0]).toMatchObject({ element: "physical", attackTag: "proc", damageBonus: 0.35, terms: [{ stat: "hp", coefficient: 0.8 }] });
  expectDamage(hpProc.result, 20000 * 0.8 * multiplier, 0.2, 1.5);
  await page.locator('[data-field="build.stats.atk"]').fill("9999");
  expect((await audit(page)).result.totals).toEqual(hpProc.result.totals);
  await page.locator('[data-field="build.stats.hp"]').fill("25000");
  const changedHp = await audit(page);
  expectDamage(changedHp.result, 25000 * 0.8 * multiplier, 0.2, 1.5);
  await page.locator("#calc-proc-refinement").selectOption("1");
  const hornR1 = await audit(page);
  expectDamage(hornR1.result, 25000 * 0.4 * multiplier, 0.2, 1.5);
  await page.locator("#calc-proc-weapon").selectOption("sequenceofsolitude");
  const bowR1 = await audit(page);
  expect(bowR1.document.id).toBe("weapon-proc:sequenceofsolitude:r1");
  expectDamage(bowR1.result, 25000 * 0.4 * multiplier, 0.2, 1.5);
  expect(bowR1.document.build).toEqual(hornR1.document.build);
  expect(bowR1.document.enemy).toEqual(edited.document.enemy);
  await expect(sourceCoefficient).toBeDisabled();
  await expect(sourceCoefficient).toHaveValue("0.4");

  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "independent-weapon-proc.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  await expect(page.locator("#calc-proc-weapon")).toHaveValue("sequenceofsolitude");
  await expect(page.locator("#calc-proc-refinement")).toHaveValue("1");
  const restored = await audit(page);
  expect(restored.document).toEqual(saved);
  expect(restored.result.totals).toEqual(bowR1.result.totals);
  expect(restored.result.hits[0]!.trace).toEqual(bowR1.result.hits[0]!.trace);
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  console.info("Independent weapon proc browser measurements", JSON.stringify({ halberdR1Teaching: initial.result.totals,
    halberdR1Edited: edited.result.totals, halberdR5Edited: refined.result.totals, hornR5: hpProc.result.totals,
    hornR5ChangedHp: changedHp.result.totals, hornR1: hornR1.result.totals, bowR1: bowR1.result.totals, json: restored.result.totals }));
});
