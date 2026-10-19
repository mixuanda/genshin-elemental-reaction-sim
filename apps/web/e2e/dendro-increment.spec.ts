import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult, CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import type { LunarMixedV2SimulationResult } from "../../../packages/sim-core/src/lunar-mixed-v2-runtime";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
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

async function neferInput(page: Page, hitIndex: number, path: "damageBonusFormula" | "resistanceReductionFormula" | "elementalMasteryAdjustment.formula", key: string) {
  const hit = (await audit(page)).document.hits[hitIndex]!;
  if (hit.kind !== "ordinary") throw new Error("Expected Nefer's ordinary sourced hit");
  const formula = path === "elementalMasteryAdjustment.formula" ? hit.elementalMasteryAdjustment!.formula : hit[path]!;
  const index = formula.inputs.findIndex(input => input.key === key);
  expect(index).toBeGreaterThanOrEqual(0);
  return page.locator(`[data-field="hits.${hitIndex}.${path}.inputs.${index}.value"]`);
}

function perHitValues(result: CalculatorResult, id: string): number[] {
  return result.hits.map(hit => {
    const value = hit.trace.find(node => node.id === id)?.result?.value;
    expect(value, id).toBeDefined();
    return value!;
  });
}

test("Nefer C2 and C4 keep per-hit EM accounting and sourced resistance through final-panel JSON", async ({ page }) => {
  await page.goto("/calculator");
  const character = await page.locator("#calc-character option").filter({ hasText: "奈芙尔" }).getAttribute("value");
  await page.locator("#calc-character").selectOption(character!);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const skill = await page.locator("#calc-skill option").filter({ hasText: "元素爆发（消耗帷幕快照）" }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(skill!);
  await page.locator("#calc-constellation").selectOption("2");
  await page.locator('[data-field="build.stats.em"]').fill("100");
  for (let i = 0; i < 2; i++) {
    await page.locator(`[data-em-accounting="${i}"]`).selectOption("add-to-panel");
    await (await neferInput(page, i, "elementalMasteryAdjustment.formula", "neferFullVeilEmBuffActive")).selectOption("1");
    await (await neferInput(page, i, "elementalMasteryAdjustment.formula", "moonsignCount")).fill("2");
    await (await neferInput(page, i, "damageBonusFormula", "moonsignCount")).fill("2");
    await (await neferInput(page, i, "damageBonusFormula", "neferVeilStacks")).fill("5");
  }
  const c2 = await audit(page);
  expect(c2.document.gameContext).toMatchObject({ skillId: "nefer-burst", constellation: 2, effectiveTalentLevel: 10 });
  expect(c2.result.totals?.nonCritical).toBeCloseTo(35481.888, 7);
  expect(perHitValues(c2.result, "hitElementalMastery")).toEqual([300, 300]);
  // Restoring an already-buffed panel must not add the same 200 EM again.
  await page.locator('[data-field="build.stats.em"]').fill("300");
  for (let i = 0; i < 2; i++) await page.locator(`[data-em-accounting="${i}"]`).selectOption("already-in-final-panel");
  expect((await audit(page)).result.totals).toEqual(c2.result.totals);
  await page.locator('[data-field="build.stats.em"]').fill("100");
  for (let i = 0; i < 2; i++) await page.locator(`[data-em-accounting="${i}"]`).selectOption("add-to-panel");
  await page.locator("#calc-constellation").selectOption("4");
  for (let i = 0; i < 2; i++) await (await neferInput(page, i, "resistanceReductionFormula", "neferC4TargetDebuffActive")).selectOption("1");
  const c4 = await audit(page);
  expect(c4.result.totals?.nonCritical).toBeCloseTo(41395.536, 7);
  expect(perHitValues(c4.result, "effectiveResistance")).toEqual([-0.1, -0.1]);
  expect(c4.result.verification).toBe("provisional");
  await (await neferInput(page, 0, "elementalMasteryAdjustment.formula", "neferFullVeilEmBuffActive")).selectOption("0");
  expect(perHitValues((await audit(page)).result, "hitElementalMastery")).toEqual([100, 300]);
  await page.locator('[data-em-accounting="1"]').selectOption("already-in-final-panel");
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator("[data-equipment-apply]").click();
  const equipped = await audit(page);
  expect(equipped.document.build.mode).toBe("equipment-derived");
  expect(equipped.document.hits.map(hit => hit.kind === "ordinary" && hit.elementalMasteryAdjustment?.accounting)).toEqual(["add-to-panel", "add-to-panel"]);
  const equippedEm = perHitValues(equipped.result, "hitElementalMastery");
  expect(equippedEm[1]! - equippedEm[0]!).toBe(200);
  await page.locator("#calc-build-mode").selectOption("manual-final");
  const final = await audit(page);
  expect(final.result.totals).toEqual(equipped.result.totals);
  expect(perHitValues(final.result, "hitElementalMastery")).toEqual(equippedEm);
  for (const hit of final.result.hits) expect(hit.trace.find(node => node.id === "characterResistanceReduction")?.status).toBe("not-applicable");
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await page.locator("#calc-import").setInputFiles({ name: "nefer-c4-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.result.totals).toEqual(equipped.result.totals);
  expect(perHitValues(restored.result, "hitElementalMastery")).toEqual(equippedEm);
  expect(restored.document.hits.map(hit => hit.kind === "ordinary" && hit.elementalMasteryAdjustment?.accounting)).toEqual(["add-to-panel", "add-to-panel"]);
});

test("mixed v2 shares actual Dendro cores, Lunar damage and Moondew resources with complete hit replays", async ({ page }) => {
  const expected = JSON.parse(await readFile(new URL("../../../docs/fixtures/lunar-mixed-v2-reference.synthetic.expected.json", import.meta.url), "utf8")) as {
    sourceAbilityRequest: { actorId: string; atFrame: number; talentLevel: number; ascension: number; constellation: number };
    options: { party: { actorId: string; characterKey: string }[]; abilities: unknown[] };
    profile: LunarMixedV2SimulationResult["profile"];
    totalDamage: number; classicDamage: number; lunarChargedDamage: number; lunarCrystallizeDamage: number; lunarBloomDamage: number;
    verdantDew: LunarMixedV2SimulationResult["verdantDew"];
    resourceGainFrames: number[]; resourceConsumptionFrames: number[]; specialEvents: unknown[];
    hyperbloomEvents: unknown[]; coreSpawnFrames: number[]; quickenBloomTasks: unknown[];
  };
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "lunar-mixed-v2-reference.synthetic.json", mimeType: "application/json", buffer: await readFile(new URL("../../../docs/fixtures/lunar-mixed-v2-reference.synthetic.json", import.meta.url)) });
  await expect(page.locator("#notice")).toContainText("合成机制验证：共享三类Lunar、草核与草露");
  await waitForSimulation(page);
  const original = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator("#critModeInput").selectOption("average");
  await page.locator("[data-lunar-profile]").selectOption("lunar-mixed-v2");
  for (const [index, member] of expected.options.party.entries()) await page.locator(`[data-lunar-party-index="${index}"]`).selectOption(member.characterKey);
  await page.locator("[data-lb-source-enabled]").check();
  const request = expected.sourceAbilityRequest;
  await page.locator('[data-lb-source-field="actorId"]').selectOption(request.actorId);
  await page.locator('[data-lb-source-field="requestedFrame"]').fill(String(request.atFrame));
  await page.locator('[data-lb-source-field="talentLevel"]').fill(String(request.talentLevel));
  await page.locator('[data-lb-source-field="ascension"]').selectOption(String(request.ascension));
  await page.locator('[data-lb-source-field="constellation"]').selectOption(String(request.constellation));
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled();
  const report = await downloadJson<{ format: string; declaredAbilities: unknown[]; result: LunarMixedV2SimulationResult }>(page, '[data-lunar-action="export"]');
  expect(report.format).toBe("lunar-mixed-v2-report-v1");
  expect(report.declaredAbilities).toEqual(expected.options.abilities);
  expect(await page.evaluate(() => window.GenshinDpsLab.getConfig())).toEqual(original);
  const result = report.result;
  expect(result.schemaVersion).toBe("lunar-mixed-simulation-v2");
  expect(result.baseResult.config.reactionEngine?.mode).toBe("aura-v7");
  expect(result.profile).toEqual(expected.profile);
  for (const key of ["totalDamage", "classicDamage", "lunarChargedDamage", "lunarCrystallizeDamage", "lunarBloomDamage"] as const) expect(result[key]).toBeCloseTo(expected[key], 8);
  expect(result.totalDamage).toBe(result.classicDamage + result.lunarChargedDamage + result.lunarCrystallizeDamage + result.lunarBloomDamage);
  expect(result.specialDamageEvents.map(event => ({ id: event.id, kind: event.kind, branch: event.kind === "reaction" ? event.intent.branch : "lunar-bloom-direct", frame: event.frame, damage: event.damage, executionOrder: event.executionOrder }))).toEqual(expected.specialEvents);
  expect(result.executionLog.filter(entry => entry.type === "resource-gain").map(entry => entry.frame)).toEqual(expected.resourceGainFrames);
  expect(result.executionLog.filter(entry => entry.type === "ability-resource-consumed").map(entry => entry.frame)).toEqual(expected.resourceConsumptionFrames);
  expect(result.verdantDew).toEqual(expected.verdantDew);
  const direct = result.specialDamageEvents.filter(event => event.kind === "direct-ability");
  expect(direct).toHaveLength(3);
  expect(new Set(direct.map(event => event.resourceConsumption.sourceEventId)).size).toBe(1);
  for (const event of direct) expect(event.resourceConsumption).toMatchObject({ frame: 215, consumed: 1 });
  const hyperbloom = result.baseResult.damageEvents.filter(event => event.reaction === "hyperbloom");
  expect(hyperbloom.map(event => ({ id: event.id, frame: event.frame, damage: event.finalDamage, sourceActorId: event.sourceActorId }))).toEqual(expected.hyperbloomEvents);
  const spawns = result.baseResult.dendroCoreLog.filter(entry => entry.operation === "spawn");
  expect(spawns.map(entry => entry.frame)).toEqual(expected.coreSpawnFrames);
  expect(result.baseResult.reactionTaskLog.filter(task => task.kind === "quicken-bloom-followup").map(task => ({ id: task.id, frame: task.frame, sourceActorId: task.sourceActorId, triggerElement: task.triggerElement, status: task.status }))).toEqual(expected.quickenBloomTasks);
  await expect(page.getByTestId("lunar-mixed-bloom-damage")).toBeVisible();
  await expect(page.getByTestId("lunar-dew-rule")).toHaveText("verdant-dew-fixed-core-order-v2");
  const core = spawns[0]!;
  await page.locator(`[data-lunar-core-entry="${core.id}"] > summary`).click();
  const coreAudit = JSON.parse((await page.locator(`[data-lunar-core-entry="${core.id}"] .calculator-audit pre`).first().textContent())!);
  expect(coreAudit.coreEntry).toEqual(core);
  expect(coreAudit.originHit.id).toBe(core.originDamageEventId);
  const ordinary = hyperbloom[0]!;
  await page.getByText("同次经典命中（含普通绽放／超绽放）", { exact: true }).click();
  await page.locator(`[data-lunar-classic-event="${ordinary.id}"] > summary`).click();
  const origin = JSON.parse((await page.locator(`[data-lunar-classic-origin="${ordinary.id}"] pre`).textContent())!);
  expect(origin.event).toEqual(ordinary);
  expect(origin.reactionDamage).toEqual(result.baseResult.reactionDamageLog.filter(entry => entry.damageEventIds.includes(ordinary.id)));
  await page.locator(`[data-lunar-open-classic="${ordinary.id}"]`).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const capture = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(capture.eventId).toBe(ordinary.id);
  expect(capture.sourceResult).toEqual(result.baseResult);
  await page.locator('.product-nav a[href="/results"]').click();
  // One saved run supplies every special replay, including all three direct hits.
  for (const [index, event] of result.specialDamageEvents.entries()) {
    await page.locator(`[data-lunar-event="${event.id}"] > summary`).click();
    await expect(page.locator(`[data-lunar-execution-order="${event.id}"]`)).toContainText(`frame ${event.executionOrder.frame} · priority ${event.executionOrder.priority} · sequence ${event.executionOrder.sequence}`);
    await page.locator(`[data-lunar-open-calculator="${event.id}"]`).click();
    await expect(page).toHaveURL(/\/calculator$/);
    const replay = await audit(page);
    const hit = replay.document.hits[0]!;
    expect(hit.kind === "special" && hit.context).toEqual(event.context);
    expect(replay.result.totals?.expected).toBeCloseTo(event.damage, 8);
    expect(replay.result.verification).toBe("provisional");
    if (index < result.specialDamageEvents.length - 1) await page.locator('.product-nav a[href="/results"]').click();
  }
});

test("continuous zero-energy startup keeps all paginated actions, failures and energy receipts beyond fifty rows", async ({ page }) => {
  // Explicit synthetic variation of simulation-analysis.test.ts energyScenario.
  // Three same-element particles yield 9 energy; capacity 6 wastes 3. A second Q fails.
  const config = makeConfig({
    dataVersion: "synthetic-startup-ledger-v1",
    meta: { name: "合成启动流水分页验收（非真实角色构筑）", version: "1", verificationStatus: "user-supplied" },
    duration: 2, cycleLength: 2, rotation: [],
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [
        { id: "e", actorId: "a", name: "合成产球", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
          particles: [{ id: "three-particles", element: "pyro", count: 3, spawnFrame: 0, travelFrames: 1 }] },
        { id: "q", actorId: "a", name: "合成耗能", kind: "burst", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 6,
          hits: [{ id: "q-hit", frame: 0, scaling: 1, element: "pyro" }] },
      ],
      commands: [{ type: "skill", actorId: "a", abilityId: "e" }, { type: "burst", actorId: "a", abilityId: "q" }, { type: "burst", actorId: "a", abilityId: "q" }],
    },
  });
  config.characters[0]!.name = "合成能量角色";
  config.characters[0]!.energyMax = 6;
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "startup-ledger.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await page.locator("#analysis-warmup-energy").selectOption("zero");
  await page.locator("#analysis-warmup-cycles").fill("60");
  await page.locator("#analysis-steady-run").click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("[data-startup-ledger]")).toContainText("[0, 7200)f");
  const before = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  const startup = before.startup;
  expect(startup.status).not.toBe("blocked");
  expect(startup.startup.measurementStartTick).toBe(7200);
  expect(startup.result!.energyStats.a!.initial).toBe(0);
  expect(startup.startup.energyAtMeasurementStart).toEqual({ a: 0 });
  const actions = startup.result!.actionLog.filter(row => row.frame < 7200);
  const failures = startup.result!.skippedActions.filter(row => row.frame < 7200);
  const energy = startup.result!.energyLog.filter(row => row.frame < 7200);
  expect([actions.length, failures.length, energy.length]).toEqual([120, 60, 60]);
  expect(energy[0]).toMatchObject({ kind: "particle", particleCount: 3, baseEnergyPerParticle: 3, fieldMultiplier: 1, rawEnergy: 9, energyRecharge: 1, finalEnergy: 9, energyBefore: 0, energyAfter: 6, gainedEnergy: 6, wastedEnergy: 3 });
  expect(await page.locator("[data-startup-energy-boundary] tbody tr td").allTextContents()).toEqual(["合成能量角色", "0", "0"]);
  await page.locator('[data-startup-section="energy"] > summary').click();
  await page.locator('[data-startup-energy-index="0"] summary').click();
  await expect(page.locator('[data-startup-energy-index="0"]')).toContainText("元素微粒数量 3，同元素，前后台系数 1");
  await expect(page.locator('[data-startup-energy-index="0"]')).toContainText("充能前能量（已计种类、数量和分配）为 9；乘充能：9 × 1 = 9");
  await expect(page.locator('[data-startup-energy-index="0"]')).toContainText("clamp(0 + 9, 0, 6) = 6");
  await expect(page.locator('[data-startup-energy-index="0"]')).toContainText("实际变化 6，溢出 3");
  const format = (value: number): string => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(value);
  for (const [section, rows, indexAttribute] of [
    ["actions", actions, "action"], ["failures", failures, "failure"], ["energy", energy, "energy"],
  ] as const) {
    if (section !== "energy") await page.locator(`[data-startup-section="${section}"] > summary`).click();
    await expect(page.locator(`[data-startup-table="${section}"] tbody tr`)).toHaveCount(25);
    const pageCount = Math.ceil(rows.length / 25);
    for (let i = 1; i < pageCount; i++) await page.locator(`[data-startup-page="${section}"][data-direction="1"]`).click();
    const start = (pageCount - 1) * 25;
    await expect(page.locator(`[data-startup-page-status="${section}"]`)).toHaveText(`${start + 1}–${rows.length} / ${rows.length} 条`);
    await expect(page.locator(`[data-startup-page="${section}"][data-direction="1"]`)).toBeDisabled();
    await expect(page.locator(`[data-startup-table="${section}"] tbody tr`)).toHaveCount(rows.length - start);
    const last = page.locator(`[data-startup-${indexAttribute}-index="${rows.length - 1}"]`);
    if (section === "actions") {
      const row = actions.at(-1)!;
      expect(await last.locator("td").allTextContents()).toEqual([`${row.frame}f / ${format(row.time)}s`, "合成能量角色", row.action, `${row.cycle} / ${row.timelineCommandIndex}`, format(row.energyBefore), format(row.energyAfter)]);
    } else if (section === "failures") {
      const row = failures.at(-1)!;
      await expect(last).toContainText(`${row.frame}f`);
      await expect(last).toContainText(row.reasonCode);
      expect(await last.locator("td").nth(3).textContent()).toBe(format(row.energyBefore));
      expect(await last.locator("td").nth(4).textContent()).toBe(format(row.energyCost));
    } else {
      const row = energy.at(-1)!;
      await expect(last).toContainText(`${row.receiveFrame}f`);
      expect(await last.locator("td").nth(3).textContent()).toBe(`${format(row.energyBefore)} → ${format(row.energyAfter)}`);
      expect(await last.locator("td").nth(4).textContent()).toBe(`${format(row.gainedEnergy)} / ${format(row.wastedEnergy)}`);
    }
  }
  const after = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  expect(after.startup).toEqual(before.startup);
});
