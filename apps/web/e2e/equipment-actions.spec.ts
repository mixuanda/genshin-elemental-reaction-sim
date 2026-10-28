import { parseSimulationHit } from "@genshin-dps-lab/sim-core";
import { revealControl, downloadSimulationRecord } from "./release-ui-helpers";
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
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function selectSkill(page: Page, name: string | RegExp): Promise<void> {
  const value = await page.locator("#calc-skill option").filter({ hasText: name }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
}

async function applyWeapon(page: Page, weaponId: string): Promise<void> {
  await (await revealControl(page.locator('[data-equipment="weapon"]'))).selectOption(weaponId);
  await (await revealControl(page.locator('[data-equipment="weaponEffectsEnabled"]'))).check();
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
}

function hitValue(result: CalculatorResult, id: string): number {
  const value = result.hits[0]?.trace.find(node => node.id === id)?.result?.value;
  expect(value, id).toBeDefined();
  return value!;
}

const normalOne = /普通攻击第 1 段|基础普通攻击 N1/;

test("sourced equipment base additions and tag crit survive action changes, final JSON and re-equipping once", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000081");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectSkill(page, normalOne);
  await applyWeapon(page, "weapon:12510");
  await (await revealControl(page.locator('[data-field="hits.0.additiveBaseDamage"]'))).fill("7.25");
  const normal = await audit(page);
  expect(normal.document.gameContext?.skillId).toBe("kaveh-normal-1");
  expect(normal.document.build.mode).toBe("equipment-derived");
  if (normal.document.build.mode !== "equipment-derived") throw new Error("Expected a sourced Redhorn build");
  expect(normal.document.build.flatAtk).toBe(0);
  const defense = normal.result.trace.find(node => node.id === "build.finalDef")?.result?.value;
  expect(defense).toBeDefined();
  const redhornAddition = defense! * 0.4; // Fixed R1 source: ordinary normal/charged base addition, not ATK.
  expect(hitValue(normal.result, "equipmentBaseAddition.0")).toBeCloseTo(redhornAddition, 9);
  expect(hitValue(normal.result, "equipmentAndManualBaseAddition")).toBeCloseTo(7.25 + redhornAddition, 9);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  const final = await audit(page);
  expect(final.result.totals).toEqual(normal.result.totals);
  const finalHit = final.document.hits[0]!;
  expect(finalHit.kind === "ordinary" && finalHit.finalizedEquipmentBaseInput).toBe(7.25);
  expect(final.result.hits[0]!.trace.find(node => node.id === "finalizedEquipmentEffect.0")?.status).toBe("not-applicable");
  await selectSkill(page, "画则巧施·草伤命中");
  const shield = await audit(page);
  expect(shield.document.gameContext?.skillId).toBe("kaveh-skill");
  expect(hitValue(shield.result, "equipmentAndManualBaseAddition")).toBe(0);
  expect(shield.document.hits[0]!.kind === "ordinary" && shield.document.hits[0]!.additiveBaseDamage).toBe(0);
  await selectSkill(page, normalOne);
  expect((await audit(page)).result.totals).toEqual(normal.result.totals);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "kaveh-redhorn-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  expect((await audit(page)).result.totals).toEqual(normal.result.totals);
  await applyWeapon(page, "weapon:12510");
  const fresh = await audit(page);
  expect(fresh.document.hits[0]!.kind === "ordinary" && fresh.document.hits[0]!.additiveBaseDamage).toBe(7.25);
  expect(hitValue(fresh.result, "equipmentBaseAddition.0")).toBeCloseTo(redhornAddition, 9);
  expect(fresh.result.totals).toEqual(normal.result.totals);

  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000015");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectSkill(page, "霜袭·命中");
  await applyWeapon(page, "weapon:11413");
  const frostgnaw = await audit(page);
  expect(hitValue(frostgnaw.result, "equipmentCriticalBonus.0")).toBe(0.06);
  expect(hitValue(frostgnaw.result, "applicableCritRate")).toBeCloseTo(0.11, 12);
  expect(hitValue(frostgnaw.result, "applicableDamageBonus")).toBe(0.16);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  expect((await audit(page)).result.totals).toEqual(frostgnaw.result.totals);
  await selectSkill(page, normalOne);
  const sword = await audit(page);
  expect(hitValue(sword.result, "applicableCritRate")).toBe(0.05);
  expect(hitValue(sword.result, "applicableDamageBonus")).toBe(0);
  await selectSkill(page, "霜袭·命中");
  expect((await audit(page)).result.totals).toEqual(frostgnaw.result.totals);
});

test("Amber sourced E and Q execute their delayed energy, summon lifecycle and reproducible hits from Rotation", async ({ page }) => {
  const reference = JSON.parse(await readFile(new URL("../../../docs/cross-validation/action-library/amber-skill-burst-contract.json", import.meta.url), "utf8")) as {
    id: string;
    timing: { skillInputFrame: number; burstInputFrame: number; summonSpawnFrame: number; summonExpiryFrame: number; summonHitFrame: number; skillParticleReceiveFrame: number; burstDebitFrame: number };
    externalValidation: { damageEvents: { frame: number; damage: number }[]; totalDamage: number };
  };
  await page.goto("/rotation");
  await (await revealControl(page.locator("#rotation-source-skill-burst > summary"))).click();
  await (await revealControl(page.locator("#rotation-load-source-skill-burst"))).click();
  await expect(page.locator("#rotation-source-scope")).toContainText("自然到期");
  await expect(page.locator("#rotation-add-wait")).toBeEnabled();
  await expect(page.locator("#rotation-add-dash")).toBeDisabled();
  await expect(page.locator("#rotation-list li")).toHaveCount(2);
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 2 条指令");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig.dataVersion).toBe("source-action-library:amber-expiry-eq-normal-energy-c0-t1-b4ae769-v2");
  expect(record.executionProfile).toBeNull();
  const result = record.result;
  expect(result.skippedActions).toHaveLength(0);
  expect(result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual([reference.timing.skillInputFrame, reference.timing.burstInputFrame]);
  expect(result.damageEvents.map(event => event.frame)).toEqual(reference.externalValidation.damageEvents.map(event => event.frame));
  expect(result.damageEvents.map(event => event.finalDamage)).toEqual(reference.externalValidation.damageEvents.map(event => event.damage));
  expect(result.totalDamage).toBe(reference.externalValidation.totalDamage);
  expect(result.damageEvents).toHaveLength(19);
  expect(result.energyCostLog?.map(entry => [entry.operation, entry.frame, entry.energyBefore, entry.energyAfter, entry.reservedBefore, entry.reservedAfter])).toEqual([
    ["reserve", reference.timing.burstInputFrame, 40, 40, 0, 40], ["debit", reference.timing.burstDebitFrame, 40, 0, 40, 0],
  ]);
  expect(result.summonLog?.map(entry => [entry.operation, entry.frame, entry.snapshotFrame, entry.attackFrame])).toEqual([
    ["spawn", reference.timing.summonSpawnFrame, reference.timing.summonSpawnFrame, reference.timing.summonHitFrame],
    ["expire", reference.timing.summonExpiryFrame, reference.timing.summonSpawnFrame, reference.timing.summonHitFrame],
  ]);
  const particles = result.energyLog.filter(entry => entry.kind === "particle");
  expect(particles).toHaveLength(1);
  const particle = particles[0]!;
  expect(particle).toMatchObject({ spawnFrame: reference.timing.summonHitFrame, receiveFrame: reference.timing.skillParticleReceiveFrame, particleCount: 4, particleElement: "pyro", gainedEnergy: 12, energyBefore: 0, energyAfter: 12 });
  expect(result.energyStats.amber).toMatchObject({ initial: 40, spent: 40, particleGained: 12, final: 12 });
  const bunny = result.damageEvents.at(-1)!;
  expect(bunny.statsBeforeDamage).toEqual(result.summonLog![0]!.snapshot);
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator("#energyAuditCard")).toBeVisible();
  await expect(page.locator(`[data-energy-log-id="${particle.id}"]`)).toContainText(String(reference.timing.skillParticleReceiveFrame));
  const actionState = page.locator("#actionStateAudit");
  await expect(actionState).toBeVisible();
  await expect(actionState.locator("[data-action-cost-index]")).toHaveCount(2);
  await expect(actionState.locator("[data-action-summon-index]")).toHaveCount(2);
  for (const [index, cost] of result.energyCostLog!.entries()) {
    const row = actionState.locator(`[data-action-cost-index="${index}"][data-action-cost-operation="${cost.operation}"]`);
    await expect(row.locator("td").first()).toContainText(`${cost.frame}f`);
    await (await revealControl(row.locator("summary"))).click();
    expect(JSON.parse((await row.locator("pre").textContent())!)).toEqual({ cost, action: result.actionLog[cost.actionLogIndex] });
  }
  for (const [index, summon] of result.summonLog!.entries()) {
    const row = actionState.locator(`[data-action-summon-index="${index}"][data-action-summon-operation="${summon.operation}"]`);
    await expect(row.locator("td").first()).toContainText(`${summon.frame}f`);
    await (await revealControl(row.locator("summary"))).click();
    expect(JSON.parse((await row.locator("pre").textContent())!)).toEqual(summon);
  }
  // Replay one actual Q hit and the spawn-snapshotted bunny hit from this saved run.
  for (const [index, event] of [result.damageEvents[0]!, bunny].entries()) {
    await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
    await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${event.id}"]`))).click();
    await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
    await (await revealControl(page.locator("#openHitCalculator"))).click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.getByTestId("replay-difference")).toHaveText("0");
    const captureWire = await downloadJson<unknown>(page, '[data-action="export"]');
    const capture = parseSimulationHit(JSON.stringify(captureWire));
    // This historical worker path uses simulate(), not the nearby-wet witnessed protocol.
    expect((captureWire as { schemaVersion: string }).schemaVersion).toBe("calculator-event-v1");
    expect(capture.schemaVersion).toBe("calculator-event-v1");
    expect(capture.eventStepResult).toBeUndefined();
    expect(capture.eventId).toBe(event.id);
    expect(capture.sourceResult).toEqual(result);
    if (index === 0) await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  }
});
