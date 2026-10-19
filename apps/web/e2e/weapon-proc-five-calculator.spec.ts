import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

function expectDamage(result: CalculatorResult, attack: number, coefficient: number, critRate: number, critDamage: number): void {
  // The explicit teaching panel uses L90/90 DEF 0.5, physical RES 0.1 and zero damage bonus.
  const nonCritical = attack * coefficient * 0.5 * 0.9;
  expect(result.status).toBe("calculated");
  expect(result.hits).toHaveLength(1);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.critical).toBeCloseTo(nonCritical * (1 + critDamage), 9);
  expect(result.totals!.expected).toBeCloseTo(nonCritical * (1 + critRate * critDamage), 9);
  expect(result).not.toHaveProperty("dps");
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Five new standalone procs expose source conditions and regenerate formulas after panel, refinement and saved context edits", async ({ page }) => {
  await page.goto("/calculator");
  const weapon = page.locator("#calc-proc-weapon");
  for (const [id, label] of Object.entries({ filletblade: "吃虎鱼刀", prototypearchaic: "试作古华", snowtombedstarsilver: "雪葬的星银", dragonspinespear: "龙脊长枪", frostbearer: "忍冬之果" })) {
    await expect(weapon.locator(`option[value="${id}"]`)).toContainText(label);
  }
  await weapon.selectOption("frostbearer");
  await page.locator("#calc-proc-refinement").selectOption("1");
  await page.locator('[data-action="load-weapon-proc"]').click();
  await expect(page.locator("#calc-character-status")).toContainText("不需要角色技能或队伍");
  await expect(page.locator("#calc-character")).toHaveValue("");
  await expect(page.locator("#calc-proc-trigger-aura-control")).toBeVisible();
  await expect(page.locator("#calc-proc-trigger-aura")).toHaveValue("");
  const unknown = await audit(page);
  expect(unknown.document.gameContext).toBeUndefined();
  expect(unknown.document.scope).toBe("single-hit");
  expect(unknown.result.status).toBe("blocked");
  expect(unknown.result.totals).toBeUndefined();
  await expect(page.locator("#calc-results")).toContainText("未知不能默认无冰");

  await page.locator("#calc-proc-trigger-aura").selectOption("0");
  const ordinaryR1 = await audit(page);
  expectDamage(ordinaryR1.result, 1000, 0.8, 0.5, 1);
  const sourceCoefficient = page.locator('[data-field="hits.0.baseDamageFormula.inputs.0.value"]');
  await expect(sourceCoefficient).toBeDisabled();
  await expect(sourceCoefficient).toHaveValue("0.8");
  await expect(page.locator('[data-field="hits.0.terms.0.coefficient"]')).toHaveAttribute("readonly", "");
  await page.locator("#calc-proc-trigger-aura").selectOption("1");
  const cryoR1 = await audit(page);
  expectDamage(cryoR1.result, 1000, 2, 0.5, 1);
  expect(cryoR1.document.weaponProc).toEqual({ weaponId: "frostbearer", refinement: 1, triggeringTargetCryoOrFrozen: true });
  const selection = cryoR1.result.hits[0]!.trace.find(node => node.id === "weaponProcCoefficient")!;
  expect(selection.result!.value).toBe(2);
  expect(selection.inputs.find(input => input.key === "triggeringTargetCryoOrFrozen")).toMatchObject({ value: 1, origin: "explicit-trigger-context" });
  const detail = page.locator('#calc-results [data-detail-id="weaponProcCoefficient"]');
  await detail.locator(":scope > summary").click();
  await expect(detail.locator(".trace-substitution")).toContainText(selection.substitution);
  await expect(detail).toContainText("原触发目标");

  for (const [field, value] of Object.entries({ atk: 1500, critRate: 0.25, critDamage: 1.2 })) {
    await page.locator(`[data-field="build.stats.${field}"]`).fill(String(value));
  }
  const edited = await audit(page);
  expectDamage(edited.result, 1500, 2, 0.25, 1.2);
  await page.locator("#calc-proc-refinement").selectOption("5");
  const cryoR5 = await audit(page);
  expectDamage(cryoR5.result, 1500, 3.6, 0.25, 1.2);
  expect(cryoR5.document.build).toEqual(edited.document.build);
  expect(cryoR5.document.enemy).toEqual(edited.document.enemy);
  await expect(page.locator("#calc-proc-trigger-aura")).toHaveValue("1");
  await expect(sourceCoefficient).toHaveValue("3.6");
  await expect(sourceCoefficient).toBeDisabled();

  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "frost-proc-complete.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  await expect(weapon).toHaveValue("frostbearer");
  await expect(page.locator("#calc-proc-refinement")).toHaveValue("5");
  await expect(page.locator("#calc-proc-trigger-aura")).toHaveValue("1");
  const restored = await audit(page);
  expect(restored.document).toEqual(saved);
  expect(restored.result).toEqual(cryoR5.result);

  // Keep the saved high-coefficient AST intact while changing only the explicit source context.
  const changedContext = structuredClone(saved);
  changedContext.weaponProc!.triggeringTargetCryoOrFrozen = false;
  await page.locator("#calc-import").setInputFiles({ name: "frost-proc-edited-context.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(changedContext)) });
  await expect(page.locator("#calc-proc-trigger-aura")).toHaveValue("0");
  const ordinaryR5 = await audit(page);
  expectDamage(ordinaryR5.result, 1500, 1.4, 0.25, 1.2);
  expect(ordinaryR5.document.build).toEqual(saved.build);
  expect(ordinaryR5.result.hits[0]!.trace.find(node => node.id === "weaponProcCoefficient")!.result!.value).toBe(1.4);
  await expect(sourceCoefficient).toHaveValue("1.4");
  await page.locator("#calc-proc-trigger-aura").selectOption("");
  const unknownAgain = await audit(page);
  expect(unknownAgain.result.status).toBe("blocked");
  expect(unknownAgain.result.totals).toBeUndefined();

  await weapon.selectOption("filletblade");
  await expect(page.locator("#calc-proc-trigger-aura-control")).toBeHidden();
  const fillet = await audit(page);
  expect(fillet.document.build).toEqual(saved.build);
  expect(fillet.document.enemy).toEqual(saved.enemy);
  expect(fillet.document.weaponProc).toEqual({ weaponId: "filletblade", refinement: 5 });
  expectDamage(fillet.result, 1500, 4, 0.25, 1.2);
  expect(fillet.document.assumptions.join("\n")).toContain("来源概率50%");
  expect(fillet.document.assumptions.join("\n")).toContain("不把触发概率乘进已发生的一击");
  await expect(sourceCoefficient).toHaveValue("4");
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  console.info("Five standalone proc browser measurements", JSON.stringify({ frostR1Ordinary: ordinaryR1.result.totals,
    frostR1Cryo: cryoR1.result.totals, frostR5CryoEdited: cryoR5.result.totals, frostR5OrdinaryRestoredContext: ordinaryR5.result.totals,
    unknown: unknownAgain.result.status, filletR5: fillet.result.totals }));
});
