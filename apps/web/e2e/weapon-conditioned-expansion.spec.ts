import { revealControl } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function selectSkill(page: Page, name: string | RegExp): Promise<void> {
  const value = await page.locator("#calc-skill option").filter({ hasText: name }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
}

async function chooseWeapon(page: Page, weapon: string): Promise<void> {
  await (await revealControl(page.locator('[data-equipment="weapon"]'))).selectOption(weapon);
  await (await revealControl(page.locator('[data-equipment="ascension"]'))).selectOption("0");
  await (await revealControl(page.locator('[data-equipment="level"]'))).fill("1");
  await (await revealControl(page.locator('[data-equipment="weaponAscension"]'))).selectOption("0");
  await (await revealControl(page.locator('[data-equipment="weaponLevel"]'))).fill("1");
  await (await revealControl(page.locator('[data-equipment="weaponEffectsEnabled"]'))).check();
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
}

const formula = (page: Page, key: string) => page.locator(`[data-equipment-formula="${key}"]`);
const apply = (page: Page) => page.locator("[data-equipment-apply]").click();
const traceValue = (result: CalculatorResult, id: string) => result.trace.find(node => node.id === id)?.result?.value;

test("new weapon conditions use normal calculator controls, preserve hit scope, and round-trip final panels once", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000015");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectSkill(page, /普通攻击第 1 段|基础普通攻击 N1/);
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await chooseWeapon(page, "weapon:11430");
  await expect(formula(page, "weaponEffectActive")).toHaveValue("");
  await expect(formula(page, "weaponStacks")).toHaveValue("");
  await apply(page);
  expect((await audit(page)).result.status).toBe("blocked");
  await expect(page.locator("#calc-results")).toContainText("weaponEffectActive");
  await selectSkill(page, "霜袭·命中");
  expect((await audit(page)).result.status).toBe("calculated"); // Unknown normal-only window cannot block E.
  await selectSkill(page, /普通攻击第 1 段|基础普通攻击 N1/);
  expect((await audit(page)).result.status).toBe("blocked");

  await formula(page, "weaponEffectActive").selectOption("true");
  await formula(page, "weaponStacks").fill("1");
  await formula(page, "offField").selectOption("false");
  await apply(page);
  await (await revealControl(page.locator('[data-field="enemy.level"]'))).fill("1");
  await (await revealControl(page.locator('[data-field="enemy.resistance"]'))).fill("0.1");
  const normal = await audit(page);
  expect(normal.result.status).toBe("calculated");
  expect(normal.document.build.mode).toBe("equipment-derived");
  if (normal.document.build.mode !== "equipment-derived") throw Error("Expected sourced weapon build");
  const build = normal.document.build;
  const attack = (build.characterBaseAtk + build.weaponBaseAtk) * (1 + build.atkPercent) + build.flatAtk;
  // Fixed Kaeya N1 T1 = 0.5375 ATK; fixed Sturdy Bone R1 adds 0.16 final ATK to the base.
  const nonCrit = attack * (.5375 + .16) * .5 * .9;
  const expected = nonCrit * (1 + build.critRate * build.critDamage);
  expect(normal.result.hits[0]!.nonCritical).toBeCloseTo(nonCrit, 9);
  expect(normal.result.hits[0]!.expected).toBeCloseTo(expected, 9);
  const addition = normal.result.hits[0]!.trace.find(node => node.id === "equipmentBaseAddition.0")!;
  expect(addition.result?.value).toBeCloseTo(attack * .16, 9);
  await expect(page.locator('[data-trace-node="equipmentBaseAddition.0"] + tr .trace-substitution')).toContainText(addition.substitution);

  await formula(page, "weaponStacks").fill("0");
  await apply(page);
  expect((await audit(page)).result.hits[0]!.nonCritical).toBeCloseTo(attack * .5375 * .5 * .9, 9);
  await formula(page, "weaponStacks").fill("1");
  await formula(page, "offField").selectOption("true");
  await apply(page);
  expect((await audit(page)).result.hits[0]!.nonCritical).toBeCloseTo(attack * .5375 * .5 * .9, 9);
  await formula(page, "offField").selectOption("false");
  await apply(page);
  expect((await audit(page)).result.totals).toEqual(normal.result.totals);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  expect((await audit(page)).result.totals).toEqual(normal.result.totals);
  const pendingDownload = page.waitForEvent("download");
  await (await revealControl(page.locator('[data-action="export"]'))).click();
  const saved = JSON.parse(await readFile((await (await pendingDownload).path())!, "utf8")) as CalculatorDocument;
  expect(saved.build.mode).toBe("manual-final");
  const savedHit = saved.hits[0]!;
  expect(savedHit.kind === "ordinary" && savedHit.finalizedEquipmentEffects?.some(effect => effect.sourceRefs.some(ref => ref.includes("SturdyBone")))).toBe(true);
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "sturdy-bone-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  expect((await audit(page)).result.totals).toEqual(normal.result.totals);
  await apply(page);
  expect((await audit(page)).result.totals).toEqual(normal.result.totals);

  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000034");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await (await revealControl(page.locator("#calc-form"))).selectOption("noelle-burst-inactive");
  await selectSkill(page, "基础普攻第 1 下");
  await (await revealControl(page.locator("#calc-noelle-burst-active"))).selectOption("0");
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await chooseWeapon(page, "weapon:12435");
  await expect(formula(page, "weaponStacks").locator("..")).toContainText("主乐章");
  await expect(formula(page, "secondaryWeaponStacks").locator("..")).toContainText("复调");
  await formula(page, "weaponStacks").fill("1");
  await formula(page, "secondaryWeaponStacks").fill("2");
  await apply(page);
  await (await revealControl(page.locator('[data-field="enemy.level"]'))).fill("1");
  await (await revealControl(page.locator('[data-field="enemy.resistance"]'))).fill("0.1");
  const mixed = await audit(page);
  expect(mixed.result.status).toBe("calculated");
  if (mixed.document.build.mode !== "equipment-derived") throw Error("Expected sourced melody build");
  const melody = mixed.document.build;
  expect(melody.equipment?.effectContext).toMatchObject({ weaponStacks: 1, secondaryWeaponStacks: 2 });
  const melodyAttack = (melody.characterBaseAtk + melody.weaponBaseAtk) * (1 + melody.atkPercent + .18) + melody.flatAtk;
  expect(traceValue(mixed.result, "build.finalAtk")).toBeCloseTo(melodyAttack, 9);
  expect(traceValue(mixed.result, "build.applied.weapon:12435:r1:em")).toBe(melody.em + 120);
  // Fixed Noelle base N1 T1 = 0.7912 ATK; the EM movement cannot become ordinary damage bonus.
  expect(mixed.result.hits[0]!.nonCritical).toBeCloseTo(melodyAttack * .7912 * .5 * .9, 9);
  await formula(page, "weaponStacks").fill("2");
  await formula(page, "secondaryWeaponStacks").fill("2");
  await apply(page);
  const twoEm = await audit(page);
  expect(traceValue(twoEm.result, "build.applied.weapon:12435:r1:em")).toBe(melody.em + 240);
  const plainAttack = (melody.characterBaseAtk + melody.weaponBaseAtk) * (1 + melody.atkPercent) + melody.flatAtk;
  expect(twoEm.result.hits[0]!.nonCritical).toBeCloseTo(plainAttack * .7912 * .5 * .9, 9);
  await expect(page.locator("#calc-results")).toContainText("星烁乐章增伤未接入");
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
});
