import { revealControl } from "./release-ui-helpers";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

function expectDamage(result: CalculatorResult, attack: number, coefficient: number): void {
  // One actual proc: L90/90 DEF 0.5, physical RES 0.1, CR 0.5, CD 1, zero damage bonus.
  const nonCritical = attack * coefficient * 0.5 * 0.9;
  expect(result.status).toBe("calculated");
  expect(result.hits).toHaveLength(1);
  expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
  expect(result.totals!.critical).toBeCloseTo(nonCritical * 2, 9);
  expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
  expect(result).not.toHaveProperty("dps");
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Stateful weapon procs remain independent single hits with editable panels, source conflict notes and complete formula explanations", async ({ page }) => {
  await page.goto("/calculator");
  const weapon = page.locator("#calc-proc-weapon");
  // Exact supported independent-proc identity set, not an inferred dynamic count.
  expect(await weapon.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual([
    "halberd", "ashgravendrinkinghorn", "sequenceofsolitude", "filletblade", "prototypearchaic", "snowtombedstarsilver", "dragonspinespear", "frostbearer", "flute", "debateclub", "crescentpike", "endoftheline", "messenger", "swordofnarzissenkreuz", "eyeofperception", "theviridescenthunt",
  ]);
  for (const [id, label] of Object.entries({ flute: "笛剑", debateclub: "以理服人", crescentpike: "流月针", endoftheline: "竭泽" })) {
    await expect(weapon.locator(`option[value="${id}"]`)).toContainText(label);
  }
  await (await revealControl(weapon)).selectOption("flute");
  await (await revealControl(page.locator("#calc-proc-refinement"))).selectOption("1");
  await (await revealControl(page.locator('[data-action="load-weapon-proc"]'))).click();
  await expect(page.locator("#calc-character-status")).toContainText("不需要角色技能或队伍");
  await expect(page.locator("#calc-character")).toHaveValue("");
  await expect(page.locator("#calc-proc-trigger-aura-control")).toBeHidden();
  const r1 = await audit(page);
  expect(r1.document.gameContext).toBeUndefined();
  expect(r1.document.scope).toBe("single-hit");
  expect(r1.document.weaponProc).toEqual({ weaponId: "flute", refinement: 1 });
  expectDamage(r1.result, 1000, 1);
  const assumptions = page.locator("#calc-results .calculator-status li");
  const sourceConflict = assumptions.filter({ hasText: "来源冲突：固定 Optimizer TheFlute sheet" });
  await expect(sourceConflict).toBeVisible();
  await expect(sourceConflict).toContainText("R1–R4");
  await expect(sourceConflict).toContainText("100%／125%／150%／175%／200%");
  await expect(assumptions.filter({ hasText: "收集音符门限不是独立追击伤害冷却" })).toBeVisible();
  const coefficient = page.locator('[data-field="hits.0.baseDamageFormula.inputs.0.value"]');
  await expect(coefficient).toBeDisabled();
  await expect(coefficient).toHaveValue("1");

  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("1500");
  const edited = await audit(page);
  expectDamage(edited.result, 1500, 1);
  await (await revealControl(page.locator("#calc-proc-refinement"))).selectOption("5");
  const r5 = await audit(page);
  expectDamage(r5.result, 1500, 2);
  expect(r5.document.build).toEqual(edited.document.build);
  expect(r5.document.enemy).toEqual(edited.document.enemy);
  await expect(coefficient).toHaveValue("2");
  await expect(coefficient).toBeDisabled();
  await expect(page.locator('[data-field="hits.0.terms.0.coefficient"]')).toHaveAttribute("readonly", "");
  await expect(sourceConflict).toBeVisible();
  const selected = r5.result.hits[0]!.trace.find(node => node.id === "weaponProcCoefficient")!;
  expect(selected.result!.value).toBe(2);
  const base = r5.result.hits[0]!.trace.find(node => node.id === "customBaseDamage")!;
  expect(base.expression).toEqual({ kind: "multiply", terms: [{ kind: "variable", key: "atk" }, { kind: "variable", key: "weaponProcCoefficient" }] });
  expect(base.childIds).toContain("weaponProcCoefficient");
  expect(base.inputs).toEqual(expect.arrayContaining([expect.objectContaining({ key: "atk", value: 1500 }), expect.objectContaining({ key: "weaponProcCoefficient", value: 2 })]));
  expect(base.result!.value).toBe(3000);
  const detail = page.locator('#calc-results [data-detail-id="customBaseDamage"]');
  await (await revealControl(detail.locator(":scope > summary"))).click();
  await expect(detail.locator(".trace-detail-content > p").first()).not.toHaveText("");
  await expect(detail.locator("code").first()).toHaveText(base.symbolicFormula);
  await expect(detail.locator(".trace-substitution")).toContainText(base.substitution);
  await expect(detail.locator("dl")).toContainText("atk");
  await expect(detail.locator("dl")).toContainText("weaponProcCoefficient");
  await expect(detail.locator("dl")).toContainText("数值：1500");
  await expect(detail).toContainText("完整精度 3000");

  await (await revealControl(weapon)).selectOption("crescentpike");
  const crescent = await audit(page);
  expect(crescent.document.weaponProc).toEqual({ weaponId: "crescentpike", refinement: 5 });
  expect(crescent.document.build).toEqual(r5.document.build);
  expect(crescent.document.enemy).toEqual(r5.document.enemy);
  expectDamage(crescent.result, 1500, 0.4);
  const windowNote = assumptions.filter({ hasText: "来源无独立追击伤害冷却" });
  await expect(windowNote).toBeVisible();
  await expect(windowNote).toContainText("300帧增益");
  await expect(windowNote).toContainText("不以冷却0计算频率或期望值");
  await expect(windowNote).toContainText("不要求填写拾球记录");
  await expect(coefficient).toHaveValue("0.4");
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  console.info("Stateful standalone proc browser measurements", JSON.stringify({ fluteR1: r1.result.totals,
    fluteR1Edited: edited.result.totals, fluteR5Edited: r5.result.totals, crescentR5OneHit: crescent.result.totals }));
});
