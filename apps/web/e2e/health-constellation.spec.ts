import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult, CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import type { SimulationRecord } from "../src/simulation-record";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}
async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}
function keqingState(page: Page, hitId: string, field: string): Locator {
  return page.locator(`[data-keqing-state-field="gameContext.keqingBurst.hitStates.${hitId}.${field}"]`);
}
function keqingNumber(page: Page, hitId: string, field: string): Locator {
  return page.locator(`[data-field="gameContext.keqingBurst.hitStates.${hitId}.${field}"]`);
}
async function openHitContext(page: Page, hitId: string): Promise<void> {
  const context = page.locator(`[data-keqing-hit-context="${hitId}"]`);
  if (await context.getAttribute("open") === null) await (await revealControl(context.locator(":scope > summary"))).click();
}
async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

// Keep browser actions/errors, but avoid repeatedly serializing the complete multi-hit audit into trace DOM snapshots.
test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Keqing C6 per-hit controls update explicit and unknown state for an independent hit and complete Q", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000042");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const value = await page.locator("#calc-skill option").filter({ hasText: "天街巡游·完整十击" }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  await (await revealControl(page.locator("#calc-ascension"))).selectOption("4");
  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("1000");
  await (await revealControl(page.locator('[data-field="build.stats.critRate"]'))).fill("0.5");
  await (await revealControl(page.locator('[data-field="build.stats.critDamage"]'))).fill("1");
  await (await revealControl(page.locator("#calc-constellation"))).selectOption("6");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  const firstId = "keqing-burst-complete-cast-initial";
  await (await revealControl(page.locator(`[data-hit-id="${firstId}"]`))).check();
  await openHitContext(page, firstId);
  expect((await audit(page)).result.status).toBe("blocked");
  for (const [field, selected] of Object.entries({ c4Active: "1", c4IncludedInPanel: "0", c6NormalActive: "1", c6ChargedActive: "0", c6SkillActive: "0" })) {
    await keqingState(page, firstId, field).selectOption(selected);
  }
  await keqingNumber(page, firstId, "baseAttack").fill("500");
  await keqingNumber(page, firstId, "c6IncludedStacks").fill("0");
  const single = await audit(page);
  expect(single.result.status).toBe("calculated");
  expect(single.result.hits).toHaveLength(1);
  expect(single.document.gameContext!.keqingBurst!.hitStates[firstId]).toEqual({ c4Active: true, c4IncludedInPanel: false, c6NormalActive: true, c6ChargedActive: false, c6SkillActive: false, baseAttack: 500, c6IncludedStacks: 0 });
  // T1 initial .88; C4 adds 500 × .25 to the final ATK; C6 has this Q plus one normal category.
  const firstNonCrit = (1000 + 500 * 0.25) * 0.88 * (1 + 2 * 0.06) * 0.5 * 0.9;
  expect(single.result.totals!.nonCritical).toBeCloseTo(firstNonCrit, 9);
  expect(single.result.totals!.expected).toBeCloseTo(firstNonCrit * 1.65, 9);
  const attackNode = single.result.hits[0]!.trace.find(node => node.id === "sourceAttackAdjustment")!;
  expect(attackNode.result!.value).toBe(125);
  expect(attackNode.substitution).toContain("500");
  await expect(page.locator('#calc-results [data-trace-node="sourceAttackAdjustment"]')).toContainText("125");
  await keqingNumber(page, firstId, "baseAttack").fill("800");
  expect((await audit(page)).result.totals!.nonCritical).toBeCloseTo((1000 + 800 * 0.25) * 0.88 * 1.12 * 0.5 * 0.9, 9);
  await keqingNumber(page, firstId, "baseAttack").fill("");
  expect((await audit(page)).result.status).toBe("blocked");
  expect((await audit(page)).document.gameContext!.keqingBurst!.hitStates[firstId]!.baseAttack).toBeUndefined();
  await keqingNumber(page, firstId, "baseAttack").fill("500");
  await keqingState(page, firstId, "c6NormalActive").selectOption("unknown");
  expect((await audit(page)).result.status).toBe("blocked");
  expect((await audit(page)).document.gameContext!.keqingBurst!.hitStates[firstId]!.c6NormalActive).toBeUndefined();
  await keqingState(page, firstId, "c6NormalActive").selectOption("1");
  expect((await audit(page)).result.totals).toEqual(single.result.totals);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  const incomplete = await audit(page);
  expect(incomplete.result.status).toBe("blocked");
  expect(incomplete.result.hits.filter(hit => hit.status === "blocked")).toHaveLength(9);
  for (const hit of incomplete.document.hits.slice(1)) {
    await openHitContext(page, hit.id);
    for (const field of ["c4Active", "c4IncludedInPanel", "c6NormalActive", "c6ChargedActive", "c6SkillActive"]) await keqingState(page, hit.id, field).selectOption("0");
    await keqingNumber(page, hit.id, "c6IncludedStacks").fill("0");
  }
  const full = await audit(page);
  expect(full.result.status).toBe("calculated");
  expect(full.result.hits).toHaveLength(10);
  const totalNonCrit = firstNonCrit + 1000 * (8 * 0.24 + 1.888) * 1.06 * 0.5 * 0.9;
  expect(full.result.totals!.nonCritical).toBeCloseTo(totalNonCrit, 9);
  expect(full.result.totals!.expected).toBeCloseTo(totalNonCrit * 1.65, 9);
  const finalId = full.document.hits[9]!.id;
  await keqingState(page, finalId, "c6NormalActive").selectOption("unknown");
  const oneMissing = await audit(page);
  expect(oneMissing.result.status).toBe("blocked");
  expect(oneMissing.result.hits.filter(hit => hit.status === "blocked").map(hit => hit.id)).toEqual([finalId]);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  expect((await audit(page)).result.totals).toEqual(single.result.totals);
  const beforeExport = await audit(page);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "keqing-c6-per-hit-context.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(beforeExport.document.gameContext);
  expect(restored.result.hits[0]!.trace).toEqual(beforeExport.result.hits[0]!.trace);
  expect(restored.result.totals).toEqual(single.result.totals);
});

function syntheticHealth() {
  return makeConfig({
    dataVersion: "synthetic-health-editor-ui-v1",
    meta: { name: "合成机制验证：队伍生命条件编辑", version: "synthetic-health-editor-ui-v1", verificationStatus: "provisional", note: "合成面板与空白动作；治疗和生命消耗由使用者在队伍页明确填写，不代表真实角色倍率。" },
    duration: 1, cycleLength: 1,
    enemy: { level: 90, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "health", actorId: "a", name: "合成生命动作", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0 }],
      commands: [{ type: "skill", actorId: "a", abilityId: "health", atFrame: 0 }] },
  });
}

test("Team health editor runs declared consumption and healing on the shared HP ledger and restores the source inputs", async ({ page }) => {
  const config = syntheticHealth();
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "health-editor.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#team-health-enabled")).not.toBeChecked();
  await (await revealControl(page.locator("#team-health-enabled"))).check();
  await (await revealControl(page.locator("#team-health-example"))).click();
  await expect(page.locator("#team-health-condition-note")).toContainText("合成情景假设");
  await (await revealControl(page.locator('[data-health-actor="a"] > summary'))).click();
  await (await revealControl(page.locator('[data-health-actor="a"] [data-health-initial]'))).fill("0.5");
  await page.getByText("逐行动治疗与生命消耗", { exact: true }).click();
  const action = page.locator('[data-health-action="0"]');
  await (await revealControl(action.locator('[data-health-add="consume"]'))).click();
  const first = action.locator("[data-health-change]").nth(0);
  await (await revealControl(first.locator("[data-hp-label]"))).fill("消耗20%最大生命");
  await (await revealControl(first.locator("[data-hp-frame]"))).fill("0");
  await (await revealControl(first.locator("[data-hp-basis]"))).selectOption("target-max-hp");
  await (await revealControl(first.locator("[data-hp-amount]"))).fill("0.2");
  await (await revealControl(first.locator("[data-hp-minimum]"))).fill("0");
  await (await revealControl(action.locator('[data-health-add="heal"]'))).click();
  const second = action.locator("[data-health-change]").nth(1);
  await (await revealControl(second.locator("[data-hp-label]"))).fill("带明确加成的1000基础治疗");
  await (await revealControl(second.locator("[data-hp-frame]"))).fill("1");
  await (await revealControl(second.locator("[data-hp-amount]"))).fill("1000");
  await (await revealControl(second.locator("[data-hp-healing-bonus]"))).fill("0.2");
  await (await revealControl(second.locator("[data-hp-incoming-bonus]"))).fill("0.1");
  await (await revealControl(action.locator('[data-health-add="consume"]'))).click();
  const third = action.locator("[data-health-change]").nth(2);
  await (await revealControl(third.locator("[data-hp-label]"))).fill("消耗90%当前生命且保留25%下限");
  await (await revealControl(third.locator("[data-hp-frame]"))).fill("2");
  await (await revealControl(third.locator("[data-hp-basis]"))).selectOption("target-current-hp");
  await (await revealControl(third.locator("[data-hp-amount]"))).fill("0.9");
  await (await revealControl(third.locator("[data-hp-minimum]"))).fill("0.25");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.playerDamageModel).toMatchObject({ mode: "reaction-self-v1", characters: [{ actorId: "a", initialHpRatio: 0.5 }], position: { x: 0, y: 0 }, hitboxRadius: 1 });
  expect(saved.timeline!.abilities[0]!.healthChanges).toMatchObject([
    { operation: "consume", frameOffset: 0, amount: { basis: "target-max-hp", value: 0.2 }, minimumHpRatio: 0, source: { kind: "custom" } },
    { operation: "heal", frameOffset: 1, amount: { basis: "fixed", value: 1000 }, healingBonus: 0.2, incomingHealingBonus: 0.1, source: { kind: "custom" } },
    { operation: "consume", frameOffset: 2, amount: { basis: "target-current-hp", value: 0.9 }, minimumHpRatio: 0.25, source: { kind: "custom" } },
  ]);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.getByRole("button", { name: "运行模拟", exact: true }))).click();
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig).toEqual(saved);
  const events = record.result.playerHealthEvents!;
  expect(events.map(event => [event.frame, event.operation, event.hpBefore, event.hpAfter, event.actualChange])).toEqual([
    [0, "consume", 5000, 3000, 2000], [1, "heal", 3000, 4300, 1300], [2, "consume", 4300, 2500, 1800],
  ]);
  // Healing uses additive source/recipient bonuses; the last requested 3870 is capped by the 2500-HP floor.
  expect(events[1]!.requestedAmount).toBe(1000 * (1 + 0.2 + 0.1));
  expect(events[2]!.requestedAmount).toBe(4300 * 0.9);
  expect(events[2]!.minimumHp).toBe(10000 * 0.25);
  expect(record.result.playerHpSummaries[0]).toMatchObject({ initialHp: 5000, finalHp: 2500, totalHealing: 1300, totalHpConsumed: 3800, totalOverheal: 0, totalHpDamage: 0 });
  expect(record.result.playerHpTimeline.points.map(point => point.operation)).toEqual(["initial", "consume", "heal", "consume", "simulation-end"]);
  const bonus = (events[1]!.trace as CalculationTraceNode[]).find(node => node.id === "health.bonus")!;
  expect(bonus.result!.value).toBe(1.3);
  expect(bonus.substitution).toContain("0.2");
  expect(bonus.substitution).toContain("0.1");
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator("#actionStateAudit [data-player-health-event]")).toHaveCount(3);
  await expect(page.locator('#actionStateAudit [data-player-health-summary="a"] td').nth(3)).toHaveText("2,500");
  const healRow = page.locator('#actionStateAudit [data-player-health-event="1"]');
  await (await revealControl(healRow.locator('[data-player-health-detail="1"] > summary'))).click();
  await expect(healRow.locator('[data-trace-node="health.bonus"]')).toContainText("1.3");
  await expect(healRow.locator('[data-trace-node="health.after"]')).toContainText("4,300");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "health-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(saved);
  expect(restored.result.playerHealthEvents).toEqual(events);
  expect(restored.result.playerHpSummaries).toEqual(record.result.playerHpSummaries);
  expect(restored.result.playerHpTimeline).toEqual(record.result.playerHpTimeline);
});
