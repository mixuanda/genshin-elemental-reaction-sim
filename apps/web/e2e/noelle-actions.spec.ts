import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult, CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationRecord } from "../src/simulation-record";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function selectAction(page: Page, form: string, label: string, skillId: string): Promise<void> {
  await page.locator("#calc-form").selectOption(form);
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(value!);
  expect((await audit(page)).document.gameContext?.skillId).toBe(skillId);
}

function perHitValues(result: CalculatorResult, id: string): number[] {
  return result.hits.map(hit => {
    const value = hit.trace.find(node => node.id === id)?.result?.value;
    expect(value, id).toBeDefined();
    return value!;
  });
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

test("Noelle sourced actions preserve historical Q conversion, C2 and C6 through final JSON and fresh equipment", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000034");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectAction(page, "", "护心铠·施放命中", "noelle-skill-shielddmg");
  expect((await audit(page)).result.status).toBe("calculated");
  await selectAction(page, "noelle-burst-inactive", "基础普攻第 1 下", "noelle-normal-1");
  await page.locator('[data-field="build.stats.atk"]').fill("1000");
  await page.locator('[data-field="build.stats.def"]').fill("1500");
  const inactive = await audit(page);
  expect(inactive.document.hits[0]!.kind === "ordinary" && inactive.document.hits[0]!.element).toBe("physical");
  const normalCoefficient = inactive.document.hits[0]!.kind === "ordinary" && inactive.document.hits[0]!.terms[0]!.coefficient;
  await page.locator('[data-field="gameContext.noelleBurst.defenseSnapshotNonExtra"]').fill("800");
  await page.locator('[data-field="gameContext.noelleBurst.effectiveTalentLevel"]').fill("1");
  await page.locator("#calc-noelle-burst-active").selectOption("1");
  await page.locator("#calc-noelle-burst-accounting").selectOption("add-to-panel");
  const q1 = await audit(page);
  expect(perHitValues(q1.result, "sourceAttackAdjustment")).toEqual([320]); // Historical 800 DEF × Q1 source coefficient 0.4.
  expect(perHitValues(q1.result, "hitAttack")).toEqual([1320]);
  expect(q1.document.hits[0]!.kind === "ordinary" && q1.document.hits[0]!.element).toBe("geo");
  await page.locator('[data-field="gameContext.noelleBurst.effectiveTalentLevel"]').fill("10");
  const q10 = await audit(page);
  expect(perHitValues(q10.result, "sourceAttackAdjustment")).toEqual([576]); // Q10 source coefficient 0.72.
  expect(q10.document.gameContext?.effectiveTalentLevel).toBe(inactive.document.gameContext?.effectiveTalentLevel);
  expect(q10.document.hits[0]!.kind === "ordinary" && q10.document.hits[0]!.terms[0]!.coefficient).toBe(normalCoefficient);
  await page.locator('[data-field="build.stats.def"]').fill("9999");
  expect((await audit(page)).result.totals).toEqual(q10.result.totals); // Current DEF never replaces the historical non-Extra snapshot.
  await page.locator("#calc-constellation").selectOption("6");
  const c6 = await audit(page);
  expect(perHitValues(c6.result, "sourceAttackAdjustment")).toEqual([976]);
  expect(perHitValues(c6.result, "hitAttack")).toEqual([1976]);
  await page.locator('[data-field="build.stats.atk"]').fill("1976");
  await page.locator("#calc-noelle-burst-accounting").selectOption("already-in-final-panel");
  await page.locator('[data-field="gameContext.noelleBurst.defenseSnapshotNonExtra"]').fill("");
  const included = await audit(page);
  expect(included.result.totals).toEqual(c6.result.totals);
  expect(included.result.hits[0]!.trace.find(node => node.id === "sourceAttackAdjustment")?.status).toBe("not-applicable");
  await page.locator('[data-field="gameContext.noelleBurst.defenseSnapshotNonExtra"]').fill("800");
  await page.locator('[data-field="build.stats.atk"]').fill("1000");
  await page.locator("#calc-noelle-burst-accounting").selectOption("add-to-panel");
  await selectAction(page, "noelle-burst-inactive", "重击·终结命中", "noelle-charged-finisher");
  const charged = await audit(page);
  expect(charged.document.gameContext?.scopeCoverage).toBe("selected-components");
  expect(charged.document.hits[0]!.kind === "ordinary" && charged.document.hits[0]!.attackTag).toBe("charged");
  expect(perHitValues(charged.result, "customDamageBonus")).toEqual([0.15]);
  await selectAction(page, "noelle-burst-cast", "大扫除·起手两段", "noelle-burst-cast");
  const cast = await audit(page);
  expect(cast.document.gameContext).toMatchObject({ effectiveTalentLevel: 10, scopeCoverage: "complete-cast" });
  expect(cast.document.hits.map(hit => hit.kind === "ordinary" && hit.attackTag)).toEqual(["burst", "burst"]);
  expect(cast.document.hits.map(hit => hit.kind === "ordinary" && hit.damageBonusFormula)).toEqual([undefined, undefined]);
  expect(perHitValues(cast.result, "sourceAttackAdjustment")).toEqual([976, 976]);
  expect(perHitValues(cast.result, "hitAttack")).toEqual([1976, 1976]);
  await selectAction(page, "noelle-burst-inactive", "基础普攻第 1 下", "noelle-normal-1");
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:12510");
  await page.locator('[data-equipment="weaponEffectsEnabled"]').check();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  const equipped = await audit(page);
  expect(equipped.document.gameContext?.noelleBurst).toMatchObject({ active: true, effectiveTalentLevel: 10, defenseSnapshotNonExtra: 800, accounting: "add-to-panel" });
  expect(perHitValues(equipped.result, "sourceAttackAdjustment")).toEqual([976]);
  const baseAttack = equipped.result.trace.find(node => node.id === "build.finalAtk")?.result?.value;
  expect(baseAttack).toBeDefined();
  expect(perHitValues(equipped.result, "hitAttack")).toEqual([baseAttack! + 976]);
  await page.locator("#calc-build-mode").selectOption("manual-final");
  const final = await audit(page);
  expect(final.document.build.mode !== "equipment-derived" && final.document.build.stats.atk).toBe(baseAttack);
  expect(final.document.gameContext?.noelleBurst?.accounting).toBe("add-to-panel");
  expect(final.result.totals).toEqual(equipped.result.totals);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await page.locator("#calc-import").setInputFiles({ name: "noelle-q-active-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  expect((await audit(page)).result.totals).toEqual(equipped.result.totals);
  await page.locator("[data-equipment-apply]").click();
  const reapplied = await audit(page);
  expect(reapplied.document.build.mode).toBe("equipment-derived");
  expect(reapplied.result.totals).toEqual(equipped.result.totals);
  expect(perHitValues(reapplied.result, "hitAttack")).toEqual([baseAttack! + 976]);
});

test("Noelle sourced Q to N rotation records actual conversion, delayed energy and complete hit replays", async ({ page }) => {
  const external = JSON.parse(await readFile(new URL("../../../docs/validation/noelle-q-normal-external.measured.json", import.meta.url), "utf8")) as {
    evidenceStatus: string;
    actions: { frame: number; action: string }[];
    hits: { frame: number; damage: number; scalingAttack: number; element: string }[];
    totalDamage: number;
    defenseSnapshot: { frame: number; logs: { "atk added": number; mult: number; "total def": number } };
    burstBuff: { logs: { expiry: number; key: string } };
    energyEvents: { frame: number; logs: { pre_drain?: number; post_drain?: number; max_energy: number } }[];
  };
  await page.goto("/rotation");
  await page.locator("#rotation-source-noelle-burst-normal > summary").click();
  await page.locator("#rotation-load-source-noelle-burst-normal").click();
  await expect(page.locator("[data-noelle-active-assumptions]")).toBeVisible();
  await expect(page.locator("[data-noelle-active-assumptions]")).toContainText("TODO");
  await expect(page.locator("#rotation-list li")).toHaveCount(5);
  await page.locator("#rotation-compile").click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 5 条指令");
  await page.locator("#rotation-save").click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.sourceConfig.dataVersion).toBe("source-noelle:burst-normal-c0-t1-b4ae769-v1");
  expect(record.sourceConfig.meta.verificationStatus).toBe("provisional");
  expect(external.evidenceStatus).toBe("fixed-source-assumed");
  expect(record.executionProfile).toBeNull();
  const result = record.result;
  expect(result.skippedActions).toHaveLength(0);
  expect(result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual(external.actions.map(action => action.frame));
  expect(result.damageEvents).toHaveLength(6);
  for (const [index, event] of result.damageEvents.entries()) {
    const expected = external.hits[index]!;
    expect(event.frame).toBe(expected.frame);
    expect(event.element).toBe(expected.element);
    expect(event.scalingValue).toBe(expected.scalingAttack);
    expect(event.finalDamage).toBe(expected.damage);
  }
  // Compare the measured aggregate, not a separately resummed sample; the core owner confirmed exact equality.
  expect(result.totalDamage).toBe(external.totalDamage);
  const debit = external.energyEvents.find(entry => entry.logs.pre_drain !== undefined)!;
  expect(result.energyCostLog?.map(entry => [entry.operation, entry.frame, entry.energyBefore, entry.energyAfter, entry.reservedBefore, entry.reservedAfter])).toEqual([
    ["reserve", external.actions[0]!.frame, debit.logs.pre_drain, debit.logs.pre_drain, 0, debit.logs.max_energy],
    ["debit", debit.frame, debit.logs.pre_drain, debit.logs.post_drain, debit.logs.max_energy, 0],
  ]);
  expect(result.statConversionLog).toHaveLength(1);
  const conversion = result.statConversionLog![0]!;
  expect(conversion).toMatchObject({ frame: external.defenseSnapshot.frame, sourceValue: external.defenseSnapshot.logs["total def"], appliedValue: external.defenseSnapshot.logs["atk added"], expiresAtFrame: external.burstBuff.logs.expiry, key: external.burstBuff.logs.key });
  expect(result.normalHitEnergyLog?.map(entry => entry.frame)).toEqual(external.hits.slice(2).map(hit => hit.frame));
  for (const entry of result.normalHitEnergyLog!) expect(entry.rngStream).toBe("normal-hit-energy-v1");
  // The independent random-energy stream is inspected from this run, not equated to gcsim's sample draw sequence.
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  const debitRow = page.locator('#actionStateAudit [data-action-cost-operation="debit"]');
  await expect(debitRow).toContainText(`${debit.frame}f`);
  await debitRow.locator("summary").click();
  expect(JSON.parse((await debitRow.locator("pre").textContent())!).cost).toEqual(result.energyCostLog![1]);
  const conversionRow = page.locator('#actionStateAudit [data-action-conversion-index="0"]');
  await conversionRow.locator("summary", { hasText: "查看实际快照转换公式" }).click();
  const conversionAudit = JSON.parse((await conversionRow.locator("pre").textContent())!);
  expect(conversionAudit.conversion).toEqual(conversion);
  expect(conversionAudit.action).toEqual(result.actionLog[conversion.actionLogIndex]);
  expect(conversionAudit.definition.coefficient).toBe(external.defenseSnapshot.logs.mult);
  await expect(conversionRow.locator('[data-trace-node="statConversionDefense"]')).toContainText(String(external.defenseSnapshot.logs["total def"]));
  await expect(conversionRow.locator('[data-trace-node="statConversionAttack"]')).toContainText(String(external.defenseSnapshot.logs["atk added"]));
  await expect(page.locator("#actionStateAudit [data-action-normal-energy-index]")).toHaveCount(4);
  const normalEnergyRow = page.locator('#actionStateAudit [data-action-normal-energy-index="0"]');
  await normalEnergyRow.locator("summary").click();
  expect(JSON.parse((await normalEnergyRow.locator("pre").textContent())!)).toEqual(result.normalHitEnergyLog![0]);
  // Both a Q hit and an actually infused normal keep the same conversion history on restore.
  for (const [index, event] of [result.damageEvents[0]!, result.damageEvents[2]!].entries()) {
    await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
    await page.locator(`#hitTableBody tr[data-hit-id="${event.id}"]`).click();
    await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
    const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
    expect(sourceTrace.some(node => node.id === "statConversionDefense")).toBe(true);
    expect(sourceTrace.some(node => node.id === "statConversionAttack")).toBe(true);
    await page.locator("#openHitCalculator").click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.getByTestId("replay-difference")).toHaveText("0");
    const restoredTrace = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
    expect(restoredTrace).toEqual(sourceTrace);
    const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
    expect(captured.eventId).toBe(event.id);
    expect(captured.sourceResult).toEqual(result);
    if (index === 0) await page.locator('.product-nav a[href="/results"]').click();
  }
});
