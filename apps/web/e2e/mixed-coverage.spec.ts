import { revealControl, runImportedScenario } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { parseSpecialSimulation, type CapturedSpecialSimulation, type CalculatorDocument, type CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { LunarMixedSimulationResult } from "../../../packages/sim-core/src/lunar-mixed-runtime";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function selectCharacter(page: Page, name: string): Promise<void> {
  const value = await page.locator("#calc-character option").filter({ hasText: name }).getAttribute("value");
  await (await revealControl(page.locator("#calc-character"))).selectOption(value!);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await (await revealControl(page.locator("#calc-talent-level"))).fill("10");
  await page.locator("#calc-talent-level").press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(10);
}

async function selectSkill(page: Page, name: string): Promise<void> {
  const value = await page.locator("#calc-skill option").filter({ hasText: name }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
}

async function sourceInput(page: Page, formula: "additiveBaseFormula" | "resistanceReductionFormula", key: string, hitIndex = 0) {
  const hit = (await audit(page)).document.hits[hitIndex]!;
  if (hit.kind !== "ordinary") throw new Error("Expected a source ordinary hit");
  const index = hit[formula]!.inputs.findIndex(input => input.key === key);
  expect(index).toBeGreaterThanOrEqual(0);
  return page.locator(`[data-field="hits.${hitIndex}.${formula}.inputs.${index}.value"]`);
}

function hitValue(result: CalculatorResult, id: string): number {
  const value = result.hits[0]?.trace.find(node => node.id === id)?.result?.value;
  expect(value, id).toBeDefined();
  return value!;
}

test("reviewed source resource and resistance formulas, final panels and independent equipment element windows", async ({ page }) => {
  await page.goto("/calculator");
  await selectCharacter(page, "洛恩");
  await selectSkill(page, "镂骨彻心（单次，显式争胜消耗）");
  const will = await sourceInput(page, "additiveBaseFormula", "lohenWillConsumed");
  expect(await will.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(["20", "40", "60", "80", "100"]);
  await (await revealControl(page.locator('[data-field="hits.0.additiveBaseDamage"]'))).fill("500");
  expect((await audit(page)).result.totals?.nonCritical).toBeCloseTo(1274.76, 9);
  await will.selectOption("100");
  const consumed = await audit(page);
  expect(consumed.document.gameContext?.skillId).toBe("lohen-skill-etch-resource");
  expect(consumed.result.totals?.nonCritical).toBeCloseTo(1585.8, 9);
  expect(consumed.result.verification).toBe("provisional");
  await selectSkill(page, "元素爆发（六斩，显式争胜消耗）");
  for (let i = 0; i < 6; i++) await (await sourceInput(page, "additiveBaseFormula", "lohenWillConsumed", i)).selectOption("100");
  const sixCuts = await audit(page);
  expect(sixCuts.document.gameContext?.scopeCoverage).toBe("complete-cast");
  expect(sixCuts.result.hits).toHaveLength(6);
  expect(sixCuts.result.totals?.nonCritical).toBeCloseTo(16166.304, 8);

  await selectCharacter(page, "莉奈娅");
  await selectSkill(page, "露米普通双击");
  expect((await audit(page)).result.totals?.nonCritical).toBeCloseTo(1416.96, 9);
  for (let i = 0; i < 2; i++) await (await sourceInput(page, "resistanceReductionFormula", "moonsignCount", i)).fill("2");
  const twoMoons = await audit(page);
  expect(twoMoons.document.gameContext?.scopeCoverage).toBe("selected-components");
  expect(twoMoons.result.totals?.nonCritical).toBeCloseTo(1520.64, 9);
  for (let i = 0; i < 2; i++) await (await sourceInput(page, "resistanceReductionFormula", "linneaTargetNearby", i)).selectOption("0");
  expect((await audit(page)).result.totals?.nonCritical).toBeCloseTo(1244.16, 9);
  for (let i = 0; i < 2; i++) await (await sourceInput(page, "resistanceReductionFormula", "linneaTargetNearby", i)).selectOption("1");
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const equippedLinnea = await audit(page);
  expect(equippedLinnea.document.build.mode).toBe("equipment-derived");
  expect(hitValue(equippedLinnea.result, "effectiveResistance")).toBeCloseTo(-0.2, 12);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  const finalLinnea = await audit(page);
  expect(finalLinnea.result.totals).toEqual(equippedLinnea.result.totals);
  for (const hit of finalLinnea.result.hits) {
    expect(hit.trace.find(node => node.id === "characterResistanceReduction")).toMatchObject({ status: "not-applicable", ruleId: "linnea-a1-lumi-c0-optimizer-180a0a1" });
  }
  const finalDocument = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "linnea-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(finalDocument)) });
  expect((await audit(page)).result.totals).toEqual(equippedLinnea.result.totals);

  await selectCharacter(page, "丽莎");
  await selectSkill(page, "苍雷·点按");
  await (await revealControl(page.locator('[data-equipment="weapon"]'))).selectOption("weapon:14405");
  await (await revealControl(page.locator('[data-equipment="weaponEffectsEnabled"]'))).check();
  await (await revealControl(page.locator('[data-equipment-formula="normalHitEffectActive"]'))).selectOption("true");
  await (await revealControl(page.locator('[data-equipment-formula="skillBurstHitEffectActive"]'))).selectOption("false");
  for (const slot of ["flower", "plume", "sands", "goblet"]) {
    await (await revealControl(page.locator(`[data-artifact="${slot}"] > summary`))).click();
    await (await revealControl(page.locator(`[data-artifact="${slot}"] [data-artifact-field="set"]`))).selectOption("artifact-set:15037");
  }
  await (await revealControl(page.locator('[data-equipment="setEffectsEnabled"]'))).check();
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
  const previous = await audit(page);
  await expect(page.locator('[data-equipment-elements-state="setBuffElements"]')).toHaveValue("unknown");
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  await expect(page.locator("[data-equipment-status]")).toContainText("setBuffElements");
  expect((await audit(page)).document).toEqual(previous.document);
  for (const key of ["setBuffElements", "setExtraBuffElements"]) await (await revealControl(page.locator(`[data-equipment-elements-state="${key}"]`))).selectOption("known");
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const empty = await audit(page);
  expect(empty.document.build.mode).toBe("equipment-derived");
  expect(hitValue(empty.result, "applicableDamageBonus")).toBeCloseTo(0.2, 12);
  await (await revealControl(page.locator('[data-equipment-elements="setBuffElements"] [data-equipment-element="electro"]'))).check();
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  expect(hitValue((await audit(page)).result, "applicableDamageBonus")).toBeCloseTo(0.32, 12);
  // The extra window can remain after the base window ends; known [] is not unknown.
  await (await revealControl(page.locator('[data-equipment-elements="setBuffElements"] [data-equipment-element="electro"]'))).uncheck();
  await (await revealControl(page.locator('[data-equipment-elements="setExtraBuffElements"] [data-equipment-element="electro"]'))).check();
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const tail = await audit(page);
  expect(hitValue(tail.result, "applicableDamageBonus")).toBeCloseTo(0.48, 12);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  expect((await audit(page)).result.totals).toEqual(tail.result.totals);
});

test("mixed Lunar reactions share one run, actual Geo budgets and both calculator replays", async ({ page }) => {
  const fixtureUrl = new URL("../../../docs/fixtures/lunar-mixed-reference.synthetic.json", import.meta.url);
  const expected = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-mixed-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    options: { party: { actorId: string; characterKey: string }[] };
    profile: LunarMixedSimulationResult["profile"];
    totalDamage: number; classicDamage: number; lunarChargedDamage: number; lunarCrystallizeDamage: number;
    events: unknown[]; geoBudgets: unknown[];
  };
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "lunar-mixed-reference.synthetic.json", mimeType: "application/json", buffer: await readFile(fixtureUrl) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText("合成机制验证：共享月感电与月结晶");
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  await (await revealControl(page.locator('.tab[data-tab="special"]'))).click();
  await (await revealControl(page.locator('[data-lunar-action="refresh"]'))).click();
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("[data-lunar-profile]"))).selectOption("lunar-mixed");
  for (const [index, member] of expected.options.party.entries()) await (await revealControl(page.locator(`[data-lunar-party-index="${index}"]`))).selectOption(member.characterKey);
  await (await revealControl(page.locator('[data-lunar-action="run"]'))).click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const reportWire = await downloadJson<CapturedSpecialSimulation>(page, '[data-lunar-action="export"]');
  expect(reportWire.schemaVersion).toBe("special-complete-reexecution-v1");
  expect(reportWire.request.profile).toBe("lunar-mixed");
  const report = parseSpecialSimulation(JSON.stringify(reportWire));
  expect(report).toStrictEqual(reportWire);
  if (report.result.schemaVersion !== "lunar-mixed-simulation-v1") throw new Error("Expected mixed-v1 result");
  const result = report.result;
  expect(result.schemaVersion).toBe("lunar-mixed-simulation-v1");
  expect(result.profile).toEqual(expected.profile);
  for (const key of ["totalDamage", "classicDamage", "lunarChargedDamage", "lunarCrystallizeDamage"] as const) expect(result[key]).toBeCloseTo(expected[key], 8);
  expect(result.totalDamage).toBe(result.classicDamage + result.lunarChargedDamage + result.lunarCrystallizeDamage);
  expect(result.specialDamageEvents.map(event => ({ id: event.id, branch: event.intent.branch, frame: event.frame, snapshotFrame: event.intent.snapshotFrame, damage: event.damage, contributors: event.intent.contributorIds, executionOrder: event.executionOrder }))).toEqual(expected.events);
  const geoConversions = result.conversionEvents.filter(event => event.geoResolution);
  expect(geoConversions.map(event => ({ frame: event.frame, sourceActorId: event.sourceActorId, ...event.geoResolution }))).toEqual(expected.geoBudgets);
  expect(result.baseResult.crystallizeShardLog.filter(entry => entry.operation === "spawn").map(entry => entry.element)).toEqual(["electro"]);
  expect(result.baseResult.damageEvents.some(event => event.reaction === "electroCharged")).toBe(false);
  await expect(page.getByTestId("lunar-mixed-charged-damage")).toBeVisible();
  await expect(page.getByTestId("lunar-mixed-crystallize-damage")).toBeVisible();
  const geo = geoConversions[0]!;
  await (await revealControl(page.locator(`[data-lunar-conversion="${geo.id}"] > summary`))).click();
  await expect(page.locator(`[data-lunar-geo-budget="${geo.id}"]`)).toContainText("普通雷晶片已排入队列");
  expect(JSON.parse((await page.locator(`[data-lunar-conversion="${geo.id}"] .calculator-audit pre`).textContent())!)).toEqual(geo);
  const samples = [result.specialDamageEvents.find(event => event.intent.branch === "lunar-charged-reaction")!, result.specialDamageEvents.find(event => event.intent.branch === "lunar-crystallize-reaction")!];
  for (const [index, event] of samples.entries()) {
    await (await revealControl(page.locator(`[data-lunar-event="${event.id}"] > summary`))).click();
    await expect(page.locator(`[data-lunar-execution-order="${event.id}"]`)).toContainText(`frame ${event.executionOrder.frame} · priority ${event.executionOrder.priority} · sequence ${event.executionOrder.sequence}`);
    await (await revealControl(page.locator(`[data-lunar-open-calculator="${event.id}"]`))).click();
    await expect(page).toHaveURL(/\/calculator$/);
    const replay = await audit(page);
    const hit = replay.document.hits[0]!;
    expect(hit.kind === "special" && hit.context).toEqual(event.context);
    expect(replay.result.totals?.expected).toBeCloseTo(event.damage, 8);
    expect(replay.result.verification).toBe("provisional");
    if (index === 0) await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  }
});
