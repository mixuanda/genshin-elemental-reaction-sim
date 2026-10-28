import { revealControl, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculationTraceNode, CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationRecord } from "../src/simulation-record";

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

async function saveRotation(page: Page): Promise<void> {
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 4 条指令");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Kuki Q reads HP after same-frame healing, locks 7 or 12 hits at accepted input and preserves its real condition in calculator replay", async ({ page }) => {
  const external = JSON.parse(await readFile(new URL("../../../docs/cross-validation/action-library/kuki-eq-same-frame.comparison.json", import.meta.url), "utf8")) as {
    status: string; hits: Array<{ frame: number; kind: "skill" | "burst"; damage: number }>;
    sameFrame564: { hpBeforeHeal: number; hpAfterHeal: number };
    totals: { totalDamage: number; burstDamage: number };
  };
  const burstId = "kuki-burst-gyoei-narukami";
  const groupId = "kuki-burst-low-hp";
  const sourceHp = 12288.654441100001 * 1.24;
  const sourceAtk = 212.397192 + 23.245;
  const baseHeal = sourceHp * 0.03 + 288.8908 + 200 * 0.75;
  const hpBeforeThirdOwnerHeal = sourceHp * 0.35 + 2 * baseHeal * 1.15;
  const hpAfterThirdOwnerHeal = hpBeforeThirdOwnerHeal + baseHeal * 1.15;
  const burstDamagePerHit = sourceHp * 0.036048 * 0.5 * 0.9;
  const skillDamage = (sourceAtk * (0.75712 + 8 * 0.2524) + 9 * 200 * 0.25) * 0.5 * 0.9;

  await page.goto("/rotation");
  await (await revealControl(page.locator("#rotation-source-kuki-skill-burst > summary"))).click();
  await (await revealControl(page.locator("#rotation-kuki-burst-constellation"))).selectOption("0");
  await (await revealControl(page.locator("#rotation-load-source-kuki-skill-burst"))).click();
  await expect(page.locator("#rotation-list li")).toHaveCount(4);
  await expect(page.locator('[data-request="3"]')).toHaveValue("564");
  await saveRotation(page);
  const short = await downloadSimulationRecord(page);
  expect(short.sourceConfig.dataVersion).toBe("source-kuki-eq:kuki-eq-c0-a6-t1-b4ae769-v1");
  expect(short.sourceConfig.meta.verificationStatus).toBe("provisional");
  expect(short.executionProfile).toBeNull();
  expect(short.options.energyMode).toBe("configured");
  const burstDefinition = short.sourceConfig.timeline!.abilities.find(action => action.id === burstId)!;
  expect(burstDefinition).toMatchObject({ actionPhase: "after-frame-tasks-v1", energyCost: 60, energyCostFrame: 4 });
  expect(short.result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual([1, 51, 300, 564]);
  expect(short.result.skippedActions).toHaveLength(0);
  expect(external.status).toBe("passed-one-controlled-same-frame-source-scenario");
  expect(short.result.damageEvents.map(event => event.frame)).toEqual(external.hits.map(hit => hit.frame));
  for (const [index, hit] of short.result.damageEvents.entries()) expect(hit.finalDamage).toBeCloseTo(external.hits[index]!.damage, 10);
  expect(short.result.actionConditionLog).toHaveLength(1);
  const shortCondition = short.result.actionConditionLog![0]!;
  const healingAt564 = short.result.playerHealthEvents!.find(event => event.operation === "heal" && event.frame === 564)!;
  expect(shortCondition).toMatchObject({ actorId: "kuki", groupId, frame: 564, eventPriority: 8, thresholdRatio: 0.5, selected: false });
  expect(healingAt564.eventPriority).toBeLessThan(shortCondition.eventPriority);
  expect(healingAt564.hpBefore).toBeCloseTo(hpBeforeThirdOwnerHeal, 9);
  expect(healingAt564.hpAfter).toBeCloseTo(hpAfterThirdOwnerHeal, 9);
  expect(healingAt564.hpBefore).toBeCloseTo(external.sameFrame564.hpBeforeHeal, 9);
  expect(healingAt564.hpAfter).toBeCloseTo(external.sameFrame564.hpAfterHeal, 9);
  expect(shortCondition.ownerCurrentHp).toBe(healingAt564.hpAfter);
  expect(shortCondition.ownerMaxHp).toBeCloseTo(sourceHp, 9);
  expect(shortCondition.ownerCurrentHp).toBeGreaterThan(sourceHp * 0.5);
  expect(short.result.actionLog[shortCondition.actionLogIndex]!.sourceAbilityId).toBe(burstId);
  const shortHits = short.result.damageEvents.filter(event => event.actionId === shortCondition.actionId);
  expect(shortHits.map(event => event.frame)).toEqual(Array.from({ length: 7 }, (_, index) => 614 + 17 * index));
  for (const hit of shortHits) expect(hit.finalDamage).toBeCloseTo(burstDamagePerHit, 10);
  expect(short.result.totalDamage).toBeCloseTo(skillDamage + 7 * burstDamagePerHit, 9);
  expect(short.result.totalDamage).toBeCloseTo(external.totals.totalDamage, 9);
  expect(shortHits.reduce((sum, hit) => sum + hit.finalDamage, 0)).toBeCloseTo(external.totals.burstDamage, 9);
  expect(short.result.energyCostLog!.map(entry => [entry.operation, entry.frame, entry.energyBefore, entry.energyAfter])).toEqual([["reserve", 564, 60, 60], ["debit", 568, 60, 0]]);
  const shortTrace = shortCondition.trace as CalculationTraceNode[];
  expect(shortTrace.map(node => node.result!.value)).toEqual([sourceHp * 0.5, 0]);
  expect(shortTrace[1]!.inputs.find(input => input.key === "ownerCurrentHp")!.value).toBe(healingAt564.hpAfter);
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  const ledger = page.locator("#actionStateAudit [data-action-condition-ledger]");
  await expect(ledger.locator("tr[data-action-condition-id]")).toHaveCount(1);
  const shortDetail = ledger.locator(`[data-action-condition-detail="${shortCondition.id}"]`);
  await (await revealControl(shortDetail.locator(":scope > summary"))).click();
  await expect(shortDetail.locator(`[data-action-condition-trace] [data-trace-node="action-condition.${groupId}.selected"]`)).toBeVisible();
  const shortFormula = shortDetail.locator(`[data-detail-id="action-condition.${groupId}.selected"]`);
  await (await revealControl(shortFormula.locator(":scope > summary"))).click();
  await expect(shortFormula.locator(".trace-substitution")).toBeVisible();
  await expect(shortFormula.locator(".trace-substitution")).toContainText(shortTrace[1]!.substitution);
  expect(JSON.parse((await shortDetail.locator("pre").textContent())!)).toEqual(shortCondition);

  // One normal request-frame edit moves Q before the heal; later healing must not shorten this accepted cast.
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await (await revealControl(page.locator('[data-request="3"]'))).fill("563");
  await (await revealControl(page.locator('[data-request="3"]'))).press("Tab");
  await saveRotation(page);
  const long = await downloadSimulationRecord(page);
  expect(long.sourceConfig.timeline!.commands[3]).toMatchObject({ atFrame: 563 });
  const longCondition = long.result.actionConditionLog![0]!;
  expect(longCondition).toMatchObject({ actorId: "kuki", groupId, frame: 563, eventPriority: 8, selected: true });
  expect(longCondition.ownerCurrentHp).toBeCloseTo(hpBeforeThirdOwnerHeal, 9);
  expect(longCondition.ownerCurrentHp).toBeLessThan(sourceHp * 0.5);
  expect(long.result.playerHealthEvents!.find(event => event.operation === "heal" && event.frame === 564)!.hpAfter).toBeCloseTo(hpAfterThirdOwnerHeal, 9);
  const longHits = long.result.damageEvents.filter(event => event.actionId === longCondition.actionId);
  expect(longHits.map(event => event.frame)).toEqual(Array.from({ length: 12 }, (_, index) => 613 + 17 * index));
  for (const hit of longHits) expect(hit.finalDamage).toBeCloseTo(burstDamagePerHit, 10);
  expect(long.result.totalDamage).toBeCloseTo(skillDamage + 12 * burstDamagePerHit, 9);
  expect(long.result.energyCostLog!.map(entry => [entry.operation, entry.frame])).toEqual([["reserve", 563], ["debit", 567]]);
  const longTrace = longCondition.trace as CalculationTraceNode[];
  expect(longTrace.map(node => node.result!.value)).toEqual([sourceHp * 0.5, 1]);

  const conditionalHit = longHits.at(-1)!;
  expect(longCondition.hitIds).toContain(conditionalHit.hitId);
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${conditionalHit.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(sourceTrace.slice(0, 2).map(node => node.id)).toEqual(longTrace.map(node => node.id));
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })))).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(conditionalHit.id);
  expect(captured.sourceResult).toEqual(long.result);
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "kuki-long-burst-conditional-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const restoredFormula = page.locator(`#calc-results [data-detail-id="action-condition.${groupId}.selected"]`);
  await (await revealControl(restoredFormula.locator(":scope > summary"))).click();
  await expect(restoredFormula.locator(".trace-substitution")).toBeVisible();
  await expect(restoredFormula.locator(".trace-substitution")).toContainText(longTrace[1]!.substitution);

  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "kuki-hp-conditioned-burst-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(long.wire)) });
  await expectReadonlyRecord(page, long);
  await expect(page.locator("#randomSeedInput")).toHaveValue(long.batchSummary.seed);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(long.sourceConfig);
  expect(restored.result.actionConditionLog).toEqual(long.result.actionConditionLog);
  expect(restored.result.playerHealthEvents).toEqual(long.result.playerHealthEvents);
  expect(restored.result.damageEvents).toEqual(long.result.damageEvents);
  expect(restored.result.energyCostLog).toEqual(long.result.energyCostLog);

  // Edit the real source initial energy. A rejected burst must not create a condition choice or future Q damage.
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await (await revealControl(page.locator('[data-actor="0"][data-key="initialEnergy"]'))).fill("0");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.getByRole("button", { name: "运行模拟", exact: true }))).click();
  await waitForSimulation(page);
  const failed = await downloadSimulationRecord(page);
  expect(failed.sourceConfig.characters[0]!.initialEnergy).toBe(0);
  expect(failed.options.energyMode).toBe("configured");
  expect(failed.result.skippedActions).toHaveLength(1);
  expect(failed.result.skippedActions[0]).toMatchObject({ frame: 563, sourceAbilityId: burstId, reasonCode: "INSUFFICIENT_ENERGY", energyCost: 60 });
  expect(failed.result.skippedActions[0]!.energyBefore).toBeLessThan(60);
  expect(failed.result.actionConditionLog).toEqual([]);
  expect(failed.result.actionLog.some(action => action.sourceAbilityId === burstId)).toBe(false);
  expect(failed.result.energyCostLog).toEqual([]);
  expect(failed.result.damageEvents).toHaveLength(9);
  expect(failed.result.totalDamage).toBeCloseTo(skillDamage, 9);
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator("#actionStateAudit [data-action-condition-id]")).toHaveCount(0);
  console.info("Kuki burst runtime browser measurements", JSON.stringify({
    shortQFrame: shortCondition.frame, shortQOwnerHp: shortCondition.ownerCurrentHp, shortQHits: shortHits.length, shortTotalDamage: short.result.totalDamage,
    longQFrame: longCondition.frame, longQOwnerHp: longCondition.ownerCurrentHp, longQHits: longHits.length, longTotalDamage: long.result.totalDamage,
    burstDamagePerHit: longHits[0]!.finalDamage, replayDifference: 0,
    failedQEnergy: failed.result.skippedActions[0]!.energyBefore, failedTotalDamage: failed.result.totalDamage,
  }));
});

test("Kuki rejected Q releases the next swap in the ordinary rotation preview and actual worker execution", async ({ page }) => {
  await page.goto("/rotation");
  await (await revealControl(page.locator("#rotation-source-kuki-skill-burst > summary"))).click();
  await (await revealControl(page.locator("#rotation-kuki-burst-constellation"))).selectOption("0");
  await (await revealControl(page.locator("#rotation-load-source-kuki-skill-burst"))).click();
  await expect(page.locator("#rotation-list li")).toHaveCount(4);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await (await revealControl(page.locator('[data-actor="0"][data-key="initialEnergy"]'))).fill("0");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await expect(page.locator('[data-request="3"]')).toHaveValue("564");
  await (await revealControl(page.locator("#rotation-swap-actor"))).selectOption("amber");
  await (await revealControl(page.locator("#rotation-add-swap"))).click();
  await expect(page.locator("#rotation-list li")).toHaveCount(5);
  await (await revealControl(page.locator('[data-request="4"]'))).fill("565");
  await (await revealControl(page.locator('[data-request="4"]'))).press("Tab");
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 5 条指令");
  const rejectedPreview = page.locator('[data-rotation-command="3"]');
  await expect(rejectedPreview.locator("td").nth(3)).toHaveText("未施放：能量 9 / 60");
  await expect(rejectedPreview.locator("td").nth(4)).toHaveText("—");
  const swapPreview = page.locator('[data-rotation-command="4"]');
  await expect(swapPreview.locator("td").nth(1)).toHaveText("565");
  await expect(swapPreview.locator("td").nth(2)).toHaveText("565");
  await expect(swapPreview.locator("td").nth(3)).toHaveText("执行");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig.characters[0]!.initialEnergy).toBe(0);
  expect(record.sourceConfig.timeline!.commands[4]).toEqual({ type: "swap", characterId: "amber", atFrame: 565 });
  expect(record.result.skippedActions).toHaveLength(1);
  expect(record.result.skippedActions[0]).toMatchObject({ sourceAbilityId: "kuki-burst-gyoei-narukami", frame: 564, energyBefore: 9, energyCost: 60, reasonCode: "INSUFFICIENT_ENERGY" });
  const execution = record.result.timelineExecution!;
  expect(execution.commandResults[3]).toMatchObject({ status: "rejected", failureCode: "INSUFFICIENT_ENERGY", startFrame: 564, cancelFrame: null });
  expect(execution.commandResults[4]).toMatchObject({ status: "executed", startFrame: 565, endFrame: 566 });
  expect(execution.finalActiveCharacterId).toBe("amber");
  expect(record.result.playerHealthEvents!.filter(event => event.operation === "heal" && event.frame > 566).map(event => [event.frame, event.targetActorId])).toEqual([[654, "amber"], [744, "amber"]]);
  expect(record.result.actionConditionLog).toEqual([]);
  expect(record.result.energyCostLog).toEqual([]);
  expect(record.result.damageEvents.some(event => event.hitId.startsWith("kuki-burst-gyoei-narukami"))).toBe(false);
  console.info("Kuki source execution browser measurements", JSON.stringify({
    rejectedQFrame: record.result.skippedActions[0]!.frame,
    rejectedQEnergy: record.result.skippedActions[0]!.energyBefore,
    swapStartFrame: execution.commandResults[4]!.startFrame,
    swapEndFrame: execution.commandResults[4]!.endFrame,
    finalActiveActor: execution.finalActiveCharacterId,
    followingHealReceivers: record.result.playerHealthEvents!.filter(event => event.operation === "heal" && event.frame > 566).map(event => [event.frame, event.targetActorId]),
  }));
});
