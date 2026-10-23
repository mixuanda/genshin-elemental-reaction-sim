import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { DamageWindow, ErSearchResult, SimulationStartupResult, SteadyStateEvaluation } from "../../../packages/sim-core/src/simulation-analysis";
import type { SimulationRecord } from "../src/simulation-record";
import type { LunarChargedSimulationResult } from "../../../packages/sim-core/src/lunar-charged-runtime";
import type { LunarCrystallizeSimulationResult } from "../../../packages/sim-core/src/lunar-crystallize-runtime";

const continuationBase = process.env.GIDPS_E2E_BASE_URL;
if (continuationBase) test.use({ baseURL: continuationBase });

async function calculatorAudit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

async function selectBlackSkillPreset(page: Page): Promise<void> {
  await page.goto("/results");
  await page.locator("#presetSelect").selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  await waitForSimulation(page);
}

async function selectFrostgnaw(page: Page): Promise<void> {
  const value = await page.locator("#calc-skill option").evaluateAll(options => {
    const option = options.find(item => item.textContent?.includes("霜袭"));
    return (option as HTMLOptionElement | undefined)?.value;
  });
  expect(value).toBeDefined();
  await page.locator("#calc-skill").selectOption(value!);
}

test("Kaeya equipment and talent edits preserve current inputs and source-backed examples remain distinct", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000015");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectFrostgnaw(page);
  await page.locator('[data-equipment="weapon"]').selectOption("weapon:11101");
  await page.locator('[data-equipment="ascension"]').selectOption("0");
  await page.locator('[data-equipment="level"]').fill("1");
  await page.locator('[data-equipment="weaponAscension"]').selectOption("0");
  await page.locator('[data-equipment="weaponLevel"]').fill("1");
  for (const slot of ["flower", "plume"]) {
    await page.locator(`[data-artifact="${slot}"] > summary`).click();
    await page.locator(`[data-artifact="${slot}"] [data-artifact-field="set"]`).selectOption("artifact-set:15001");
  }
  await page.locator('[data-equipment="setEffectsEnabled"]').check();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  await expect(page.locator("[data-equipment-status]")).toContainText("2 件圣遗物");
  let { document, result } = await calculatorAudit(page);
  expect(document.build.mode).toBe("equipment-derived");
  if (document.build.mode !== "equipment-derived") throw new Error("Expected sourced equipment build");
  expect(document.build.equipment?.secondaryContributions).toEqual(expect.arrayContaining([
    expect.objectContaining({ property: "FIGHT_PROP_HP", value: 717 }),
    expect.objectContaining({ property: "FIGHT_PROP_ATTACK", value: 47 }),
    expect.objectContaining({ property: "FIGHT_PROP_ATTACK_PERCENT", value: 0.18 }),
  ]));
  expect(document.build.equipment?.bonusAccounting).toBe("core-sourced-v1");
  expect(result.status).toBe("calculated");
  expect(result.verification).toBe("provisional");
  await page.locator('[data-field="enemy.level"]').fill("80");
  await page.locator('[data-field="hits.0.damageBonus"]').fill("0.25");
  const before = (await calculatorAudit(page)).document;
  await page.locator("#calc-talent-level").fill("9");
  await page.locator("#calc-talent-level").press("Tab");
  await expect(page.getByTestId("calc-game-identity")).toContainText("有效天赋 Lv.9");
  ({ document, result } = await calculatorAudit(page));
  expect(document.build).toEqual(before.build);
  expect(document.enemy).toEqual(before.enemy);
  expect(document.gameContext?.skillName).toContain("霜袭");
  expect(document.hits[0]?.kind === "ordinary" && document.hits[0].damageBonus).toBe(0.25);
  expect(result.totals?.expected).toBeGreaterThan(0);
  await page.locator("#calc-skill").selectOption({ index: 0 });
  await selectFrostgnaw(page);
  const restoredAction = (await calculatorAudit(page)).document;
  expect(restoredAction.build).toEqual(document.build);
  expect(restoredAction.enemy).toEqual(document.enemy);
  expect(restoredAction.hits[0]?.kind === "ordinary" && restoredAction.hits[0].damageBonus).toBe(0.25);

  await page.locator('[data-action="examples"]').click();
  await expect(page.getByRole("heading", { name: "真实角色 · 来源交叉核对实例", exact: true })).toBeVisible();
  await page.locator('[data-example-id="game-kaeya-frostgnaw-lv1"]').click();
  ({ document, result } = await calculatorAudit(page));
  expect(document.id).toBe("game-kaeya-frostgnaw-lv1");
  expect(document.dataIdentity.releaseStatus).not.toBe("synthetic");
  expect(result.verification).toBe("provisional");
  expect(result.totals?.nonCritical).toBeCloseTo(36.08810136, 8);
  expect(result.totals?.expected).toBeCloseTo(36.990303894, 8);
  await expect(page.getByTestId("calc-game-identity")).toContainText("无锋剑");
  await page.locator('[data-field="enemy.resistance"]').fill("0.2");
  await expect(page.locator(".calculator-result-header")).toContainText("来源实例的编辑副本");
  expect((await calculatorAudit(page)).result.totals?.expected).toBeCloseTo(32.880270128, 8);
});

test("seeded critical hits replay exactly and simulation-record import restores seed, options and execution profile", async ({ page }) => {
  await selectBlackSkillPreset(page);
  await page.locator('.product-nav a[href="/rotation"]').click();
  await page.locator("#execution-profile").selectOption("practical-assumed-input");
  await page.locator("#execution-preview").click();
  await expect(page.locator("#execution-output tbody tr")).toHaveCount(3);
  await page.locator("#rotation-save").click();
  await waitForSimulation(page);
  await page.locator("#critModeInput").selectOption("seeded-random-v1");
  await page.locator("#resInput").fill("13.123456");
  await page.locator("#randomSeedInput").fill("continuation-critical-20260923");
  await page.locator("#iterationInput").fill("2");
  await page.locator("#checkpointInput").check();
  await page.locator("#detailedTraceInput").check();
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await waitForSimulation(page);
  await expect(page.locator("#batchSummary")).toContainText("逐击随机暴击");
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.format).toBe("simulation-record-v1");
  expect(record.iterations).toBe(2);
  expect(record.options.randomSeed).toBe("continuation-critical-20260923");
  expect(record.sourceConfig.enemy.resistance).toBe(0.13123456);
  expect(record.options.execution).toMatchObject({ criticalSampling: "seeded-random-v1", captureHits: true, detailedTraces: true });
  expect(record.executionProfile?.id).toBe("practical-assumed-input");
  expect(record.result.executionAudit?.criticalSampling?.drawCount).toBe(3);
  for (const captured of record.result.executionAudit!.hits) {
    expect(captured.critical.mode).toBe("seeded-random-v1");
    expect(captured.critical.roll).not.toBeNull();
    expect(captured.critical.outcome).toMatch(/^(critical|noncritical)$/);
  }
  expect(record.sourceConfig.timeline?.commands).not.toEqual(record.result.config.timeline?.commands);
  await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
  await page.locator("#hitTableBody tr[data-hit-id]").first().click();
  await expect(page.locator("#openHitCalculator")).toBeEnabled();
  await page.locator("#openHitCalculator").click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await expect(page.locator('#calc-results [data-trace-node="criticalSample"]')).toBeVisible();
  await page.locator('.product-nav a[href="/results"]').click();
  await page.locator("#critModeInput").selectOption("noCrit");
  await page.locator("#randomSeedInput").fill("discard-this-seed");
  await page.locator("#importInput").setInputFiles({ name: "saved-random-run.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue("continuation-critical-20260923");
  await waitForSimulation(page);
  await expect(page.locator("#critModeInput")).toHaveValue("seeded-random-v1");
  await expect(page.locator("#iterationInput")).toHaveValue("2");
  const restored = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.executionProfile).toEqual(record.executionProfile);
  expect(restored.result.damageEvents).toEqual(record.result.damageEvents);
  expect(restored.result.executionAudit).toEqual(record.result.executionAudit);
  const { elapsedMilliseconds: _originalElapsed, ...originalSummary } = record.batchSummary;
  const { elapsedMilliseconds: _restoredElapsed, ...restoredSummary } = restored.batchSummary;
  expect(restoredSummary).toEqual(originalSummary);
});

test("enemy resistances, execution delays and window-energy-steady analyses retain explicit scenario boundaries", async ({ page }) => {
  await selectBlackSkillPreset(page);
  const original = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  await page.locator('.product-nav a[href="/team"]').click();
  await page.locator('[data-resistance-mode="-1"]').selectOption("elements");
  const resistances = { pyro: 0.12, hydro: 0.23, electro: 0.34, cryo: -0.1, anemo: 0.15, geo: 0.26, dendro: 0.37, physical: 0.48 };
  for (const [element, value] of Object.entries(resistances)) {
    await page.locator(`[data-target-path="resistances.${element}"]`).fill(String(value));
  }
  await page.locator("[data-save-targets]").click();
  await expect(page.locator("[data-target-status]")).toContainText("敌人配置已验证并保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved).toEqual({ ...original, enemy: { ...original.enemy, resistances } });
  await page.locator('.product-nav a[href="/rotation"]').click();
  await page.locator("#execution-profile").selectOption("custom-input");
  await page.locator("#execution-input-delay").fill("3");
  await page.locator("#execution-swap-delay").fill("5");
  await page.locator("#execution-cancel-delay").fill("7");
  await page.locator("#execution-preview").click();
  await expect(page.locator("#execution-output tbody tr")).toHaveCount(3);
  await page.locator("#rotation-save").click();
  await waitForSimulation(page);
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.executionProfile).toMatchObject({ id: "custom-input", inputDelayFrames: 3, swapDelayFrames: 5, cancellationDelayFrames: 7 });
  expect(record.sourceConfig.enemy).toEqual(saved.enemy);
  expect(record.result.config.timeline?.abilities).toEqual(record.sourceConfig.timeline?.abilities);
  expect(record.result.timelineExecution?.commandResults[0]?.startFrame).toBe(3);
  const lastFrame = Math.max(...record.result.damageEvents.map(event => event.frame));
  await page.locator("#analysis-end").fill(String(lastFrame));
  await expect(page.locator("#analysis-window-output")).toContainText(`[0, ${lastFrame})f`);
  await expect(page.locator("#analysis-steady-output")).toContainText("未建立稳态");
  await page.locator("#analysis-er-max").fill("110");
  await page.locator("#analysis-er-run").click();
  await expect(page.locator("#analysis-er-output")).toContainText("该角色没有待执行的耗能动作");
  await expect(page.locator("#analysis-er-run")).toBeEnabled();
  await page.locator("#analysis-warmup-cycles").fill("1");
  await page.locator("#analysis-steady-run").click();
  await expect(page.locator("#analysis-startup-output")).toContainText("当前情景不能执行此次预热");
  await expect(page.locator("#analysis-startup-output")).toContainText("ABILITY_ON_COOLDOWN");
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  const report = await downloadJson<{ window: DamageWindow; steady: SteadyStateEvaluation; energyRecharge: ErSearchResult; startup: SimulationStartupResult }>(page, "#analysis-export");
  const included = record.result.damageEvents.filter(event => event.frame < lastFrame);
  const damage = included.reduce((sum, event) => sum + event.finalDamage, 0);
  expect(report.window.includedDamageEventIds).toEqual(included.map(event => event.id));
  expect(report.window.totalDamage).toBeCloseTo(damage, 8);
  expect(report.window.dps).toBeCloseTo(damage / (lastFrame / 60), 8);
  expect(report.window.policy).toBe("half-open-[startTick,endTick)");
  expect(report.energyRecharge.status).toBe("blocked");
  expect(report.energyRecharge.minimumFeasibleEr).toBeNull();
  expect(report.steady.status).toBe("not-established");
  // This 3-second audit vector cannot legally repeat a 12-second-cooldown E.
  expect(report.startup.status).toBe("blocked");
  expect(report.startup.reasons.join(" ")).toContain("ABILITY_ON_COOLDOWN");
  expect(report.startup.startup.startupActionCount).toBe(0);
  expect(report.startup.measurement).toBeNull();

  // One existing synthetic integration fixture exercises real application/state
  // execution; its mapped identities do not turn its synthetic stats into builds.
  const lunarFixture = await readFile(new URL("../../../docs/fixtures/lunar-charged-reference.synthetic.json", import.meta.url));
  const lunarExpected = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-charged-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    classicDamage: number; lunarChargedDamage: number; totalDamage: number; eventFrames: number[];
  };
  await page.locator("#importInput").setInputFiles({ name: "lunar-charged-reference.synthetic.json", mimeType: "application/json", buffer: lunarFixture });
  await expect(page.locator("#notice")).toContainText("合成机制验证：月感电");
  await waitForSimulation(page);
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await expect(page.locator("[data-lunar-config]")).toContainText("合成机制验证：月感电");
  await page.locator("#critModeInput").selectOption("average");
  await page.locator('[data-lunar-party-index="0"]').selectOption("barbara");
  await page.locator('[data-lunar-party-index="1"]').selectOption("flins");
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator("[data-lunar-status]")).toContainText("实际结算 2 条月感电事件");
  const lunar = await downloadJson<{ result: LunarChargedSimulationResult }>(page, '[data-lunar-action="export"]');
  expect(lunar.result.classicDamage).toBeCloseTo(lunarExpected.classicDamage, 8);
  expect(lunar.result.lunarChargedDamage).toBeCloseTo(lunarExpected.lunarChargedDamage, 8);
  expect(lunar.result.totalDamage).toBeCloseTo(lunarExpected.totalDamage, 8);
  expect(lunar.result.specialDamageEvents.map(event => event.frame)).toEqual(lunarExpected.eventFrames);
  await expect(page.getByTestId("lunar-total-damage")).toHaveText("14,038.988254");
  await page.locator("#lunarSimulationHost").screenshot({ path: "docs/validation/screenshots/lunar-charged-result.png" });
  const lunarEvent = lunar.result.specialDamageEvents[0]!;
  await page.locator(`[data-lunar-event="${lunarEvent.id}"] > summary`).click();
  await page.locator(`[data-lunar-open-calculator="${lunarEvent.id}"]`).click();
  await expect(page).toHaveURL(/\/calculator$/);
  let capturedLunar = await calculatorAudit(page);
  const capturedHit = capturedLunar.document.hits[0]!;
  expect(capturedHit.kind === "special" && capturedHit.context.context.mode).toBe("state-resolved");
  expect(capturedLunar.result.totals?.expected).toBeCloseTo(lunarEvent.damage, 8);
  const lunarResistance = page.locator('[data-field="hits.0.context.effectiveResistance"]');
  await expect(lunarResistance).toHaveAttribute("readonly", "");
  await page.locator('[data-action="copy-special-context"]').click();
  await expect(lunarResistance).not.toHaveAttribute("readonly", "");
  await lunarResistance.fill("0.2");
  capturedLunar = await calculatorAudit(page);
  const editedHit = capturedLunar.document.hits[0]!;
  expect(editedHit.kind === "special" && editedHit.context.context.mode).toBe("conditioned");
  expect(capturedLunar.result.totals?.expected).toBeLessThan(lunarEvent.damage);
  await expect(page.locator(".calculator-result-header")).toContainText("条件化编辑副本");

  await page.locator('.product-nav a[href="/results"]').click();
  const crystalFixture = await readFile(new URL("../../../docs/fixtures/lunar-crystallize-reference.synthetic.json", import.meta.url));
  const crystalExpected = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-crystallize-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    classicDamage: number; lunarCrystallizeDamage: number; totalDamage: number; snapshotFrames: number[]; eventFrames: number[];
  };
  await page.locator("#importInput").setInputFiles({ name: "lunar-crystallize-reference.synthetic.json", mimeType: "application/json", buffer: crystalFixture });
  await expect(page.locator("#notice")).toContainText("合成机制验证：月结晶");
  await waitForSimulation(page);
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await expect(page.locator("[data-lunar-config]")).toContainText("合成机制验证：月结晶");
  await page.locator("#critModeInput").selectOption("average");
  await page.locator("[data-lunar-profile]").selectOption("lunar-crystallize");
  await page.locator('[data-lunar-party-index="0"]').selectOption("barbara");
  await page.locator('[data-lunar-party-index="1"]').selectOption("zibai");
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator("[data-lunar-status]")).toContainText("实际结算 3 条月结晶事件");
  const crystal = await downloadJson<{ result: LunarCrystallizeSimulationResult }>(page, '[data-lunar-action="export"]');
  expect(crystal.result.classicDamage).toBeCloseTo(crystalExpected.classicDamage, 8);
  expect(crystal.result.lunarCrystallizeDamage).toBeCloseTo(crystalExpected.lunarCrystallizeDamage, 8);
  expect(crystal.result.totalDamage).toBeCloseTo(crystalExpected.totalDamage, 8);
  expect(crystal.result.specialDamageEvents.map(event => event.intent.snapshotFrame)).toEqual(crystalExpected.snapshotFrames);
  expect(crystal.result.specialDamageEvents.map(event => event.frame)).toEqual(crystalExpected.eventFrames);
  const crystalEvent = crystal.result.specialDamageEvents[0]!;
  await page.locator(`[data-lunar-event="${crystalEvent.id}"] > summary`).click();
  await expect(page.locator(`[data-lunar-event-detail="${crystalEvent.id}"]`)).toContainText("第 31 帧读取面板，第 41 帧交付弹体");
  await page.locator(`[data-lunar-open-calculator="${crystalEvent.id}"]`).click();
  await expect(page).toHaveURL(/\/calculator$/);
  const crystalReplay = await calculatorAudit(page);
  const crystalHit = crystalReplay.document.hits[0]!;
  expect(crystalHit.kind === "special" && crystalHit.context).toEqual(crystalEvent.context);
  expect(crystalReplay.result.totals?.expected).toBeCloseTo(crystalEvent.damage, 8);
});
