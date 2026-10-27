import { revealControl, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
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
async function loadKukiSource(page: Page, constellation: "0" | "2"): Promise<void> {
  const source = page.locator("#rotation-source-kuki-skill");
  if (await source.getAttribute("open") === null) await (await revealControl(source.locator(":scope > summary"))).click();
  await (await revealControl(page.locator("#rotation-kuki-constellation"))).selectOption(constellation);
  await (await revealControl(page.locator("#rotation-load-source-kuki-skill"))).click();
  await expect(page.locator("#rotation-list li")).toHaveCount(3);
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 3 条指令");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Kuki sourced E heals the actual active actor with owner HP conditions, retains particle rolls and replays a real ring hit", async ({ page }) => {
  const external = JSON.parse(await readFile(new URL("../../../docs/cross-validation/action-library/kuki-external-comparison.json", import.meta.url), "utf8")) as {
    status: string; sampleTotalDamage: number;
    damage: Array<{ actualFrame: number; actual: number }>;
    healing: Array<{ actualFrame: number; actualReceiver: number; actualBase: number; actualOutgoingMultiplier: number; actualRawHealing: number; actualHPAfter: number }>;
  };
  await page.goto("/rotation");
  await loadKukiSource(page, "0");
  const record = await downloadSimulationRecord(page);
  const result = record.result;
  expect(record.sourceConfig.dataVersion).toBe("source-kuki:kuki-ring-c0-a6-t1-b4ae769-v1");
  expect(record.sourceConfig.meta.verificationStatus).toBe("provisional");
  expect(record.executionProfile).toBeNull();
  expect(result.skippedActions).toHaveLength(0);
  expect(result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual([1, 51, 300]);
  expect(external.status).toBe("passed-single-external-source-scenario");
  expect(result.damageEvents.map(event => event.frame)).toEqual(external.damage.map(event => event.actualFrame));
  const sourceAtk = 212.397192 + 23.245;
  const sourceHp = 12288.654441100001 * 1.24;
  const initialDamage = (sourceAtk * 0.75712 + 200 * 0.25) * 0.5 * 0.9;
  const ringDamage = (sourceAtk * 0.2524 + 200 * 0.25) * 0.5 * 0.9;
  expect(result.damageEvents).toHaveLength(9);
  for (const [index, event] of result.damageEvents.entries()) {
    expect(event.finalDamage).toBeCloseTo(index === 0 ? initialDamage : ringDamage, 10);
    expect(event.finalDamage).toBeCloseTo(external.damage[index]!.actual, 10);
  }
  expect(result.totalDamage).toBeCloseTo(external.sampleTotalDamage, 10);
  const cost = result.playerHealthEvents!.find(event => event.operation === "consume")!;
  expect(cost.frame).toBe(1);
  expect(cost.hpBefore).toBeCloseTo(sourceHp * 0.5, 9);
  expect(cost.actualChange).toBeCloseTo(sourceHp * 0.5 * 0.3, 9);
  expect(cost.hpAfter).toBeCloseTo(sourceHp * 0.35, 9);
  expect(result.totalPlayerDamageTaken).toBe(0);
  const entities = result.periodicEntityLog!;
  expect(entities[0]).toMatchObject({ operation: "spawn", frame: 24, expiresAtFrame: 744, generation: 0 });
  expect(entities.at(-1)).toMatchObject({ operation: "expire", frame: 744, generation: 0 });
  const ticks = entities.filter(event => event.operation === "tick");
  expect(ticks).toHaveLength(8);
  const heals = result.playerHealthEvents!.filter(event => event.operation === "heal");
  expect(heals.map(event => event.frame)).toEqual([114, 204, 294, 384, 474, 564, 654, 744]);
  expect(heals.map(event => event.targetActorId)).toEqual(["amber", "amber", "amber", "kuki", "kuki", "kuki", "kuki", "kuki"]);
  expect(heals.map(event => event.bonusMultiplier)).toEqual([1.15, 1.15, 1.15, 1.15, 1.15, 1.15, 1, 1]);
  const baseHealing = sourceHp * 0.03 + 288.8908 + 200 * 0.75;
  for (const [index, heal] of heals.entries()) {
    expect(heal.id).toBe(ticks[index]!.healthEventId);
    expect(heal.baseAmount).toBeCloseTo(baseHealing, 9);
    expect(heal.requestedAmount).toBeCloseTo(baseHealing * (index < 6 ? 1.15 : 1), 9);
    expect(heal.hpAfter).toBeCloseTo(external.healing[index]!.actualHPAfter, 9);
    expect(ticks[index]!.healing!.ownerCurrentHp <= sourceHp * 0.5).toBe(index < 6);
  }
  // The second tick heals a full-health Amber but still reads Kuki's low HP for A1.
  expect(heals[1]!.actualChange).toBe(0);
  expect(heals[1]!.overheal).toBeCloseTo(baseHealing * 1.15, 9);
  expect(result.playerHpSummaries.find(actor => actor.actorId === "kuki")!.finalHp).toBeCloseTo(sourceHp * 0.35 + 3 * baseHealing * 1.15 + 2 * baseHealing, 9);
  const draws = result.particleTriggerLog;
  expect(draws).toHaveLength(8);
  expect(draws.map(event => event.drawIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  for (const draw of draws) {
    expect(draw.rngStream).toBe("particle-trigger-v1");
    expect(draw.probability).toBe(0.45);
    expect(draw.internalCooldownReadyFrame).toBe(draw.frame + 12);
    expect(draw.triggered).toBe(draw.roll! < 0.45);
    expect(draw.blockedReason).toBe(draw.triggered ? null : "PROBABILITY_FAILED");
  }
  expect(result.particleEvents.map(event => event.spawnFrame)).toEqual(draws.filter(draw => draw.triggered).map(draw => draw.frame));
  expect(result.particleEvents.every(event => event.particleElement === "electro" && event.particleCount === 1 && event.receiveFrame === event.spawnFrame + 100)).toBe(true);
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  const ledger = page.locator("#actionStateAudit [data-periodic-entity-ledger]");
  await expect(ledger.locator('[data-periodic-operation="tick"]')).toHaveCount(8);
  await expect(ledger.locator('[data-periodic-operation="expire"]')).toHaveAttribute("data-periodic-frame", "744");
  const firstTick = ledger.locator('[data-periodic-operation="tick"]').first();
  await (await revealControl(firstTick.locator(`[data-periodic-health-id="${heals[0]!.id}"] > summary`))).click();
  expect(JSON.parse((await firstTick.locator("pre").textContent())!)).toEqual({ entity: ticks[0], health: heals[0] });
  await expect(firstTick.locator('[data-periodic-health-trace] [data-trace-node="periodic.low-hp"]')).toContainText("0.15");
  await expect(firstTick.locator('[data-periodic-health-trace] [data-trace-node="health.bonus"]')).toContainText("1.15");
  for (const failure of draws.filter(draw => !draw.triggered)) {
    const failedChance = page.locator(`[data-particle-trigger-outcome="PROBABILITY_FAILED"][data-particle-trigger-frame="${failure.frame}"]`);
    await expect(failedChance).toBeVisible();
    await expect(failedChance).toContainText("未通过产球概率");
    await expect(failedChance).toContainText("45%");
    await expect(failedChance).toContainText(String(failure.roll));
  }

  const ring = result.damageEvents[1]!;
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${ring.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })))).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(ring.id);
  expect(captured.sourceResult).toEqual(result);
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "kuki-real-ring-capture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "kuki-periodic-full-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.batchSummary.seed);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.result.periodicEntityLog).toEqual(entities);
  expect(restored.result.playerHealthEvents).toEqual(result.playerHealthEvents);
  expect(restored.result.particleTriggerLog).toEqual(draws);
  expect(restored.result.energyLog).toEqual(result.energyLog);
  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await loadKukiSource(page, "2");
  const c2 = await downloadSimulationRecord(page);
  expect(c2.sourceConfig.dataVersion).toBe("source-kuki:kuki-ring-c2-a6-t1-b4ae769-v1");
  expect(c2.result.periodicEntityLog!.filter(event => event.operation === "tick")).toHaveLength(10);
  expect(c2.result.playerHealthEvents!.filter(event => event.operation === "heal")).toHaveLength(10);
  expect(c2.result.periodicEntityLog!.at(-1)).toMatchObject({ operation: "expire", frame: 924 });
  expect(c2.result.damageEvents).toHaveLength(11);
  expect(c2.result.damageEvents.at(-1)!.frame).toBe(926);
  expect(c2.result.totalDamage).toBeCloseTo(initialDamage + 10 * ringDamage, 10);
  console.info("Kuki runtime browser measurements", JSON.stringify({ c0Damage: result.totalDamage, c0Hits: result.damageEvents.length,
    c0Heals: heals.length, c0KukiFinalHp: result.playerHpSummaries.find(actor => actor.actorId === "kuki")!.finalHp,
    localParticleFailures: draws.filter(draw => !draw.triggered).length, localParticleSpawnFrames: result.particleEvents.map(event => event.spawnFrame),
    replayDifference: 0, c2Damage: c2.result.totalDamage, c2Heals: c2.result.playerHealthEvents!.filter(event => event.operation === "heal").length }));
});
