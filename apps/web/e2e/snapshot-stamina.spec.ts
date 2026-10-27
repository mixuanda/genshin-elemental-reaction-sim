import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { SimulationRecord } from "../src/simulation-record";
import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await (await revealControl(page.locator(selector))).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function calculatorRoundTrip(page: Page, filename: string): Promise<void> {
  const before = await audit(page);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: filename, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(before.document.gameContext);
  expect(restored.document.selectedHitIds).toEqual(before.document.selectedHitIds);
  expect(restored.document.hits).toEqual(before.document.hits);
  expect(restored.result.totals).toEqual(before.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(before.result.hits.map(hit => hit.trace));
}

// The complete audit JSON is ~2.5 MB. Disable trace DOM snapshots for this file:
// their multi-second serialization is separate from the measured ~80 ms production update.
// Playwright scopes trace settings to a worker; operation/error tracing, assertions and
// the default 30-second test budget remain unchanged for both flows.
test.use({ trace: { mode: "retain-on-failure", snapshots: false } });
test("Ningguang twelve-gem Q keeps the previous E snapshot independent and round-trips full and selected hits", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000027");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const value = await page.locator("#calc-skill option").filter({ hasText: "有璇玑屏" }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  await (await revealControl(page.locator("#calc-ascension"))).selectOption("4");
  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("2000");
  await (await revealControl(page.locator('[data-field="build.stats.critRate"]'))).fill("0.5");
  await (await revealControl(page.locator('[data-field="build.stats.critDamage"]'))).fill("1");
  await (await revealControl(page.locator("#calc-ningguang-current-a4-active"))).selectOption("0");
  await (await revealControl(page.locator("#calc-ningguang-screen-a4-active"))).selectOption("0");
  const missing = await audit(page);
  expect(missing.document.gameContext?.skillId).toBe("ningguang-burst-with-screen");
  expect(missing.result.status).toBe("blocked");
  expect(missing.result.hits.filter(hit => hit.status === "blocked")).toHaveLength(6);
  expect(missing.result.totals).toBeUndefined();
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator('[data-hit-id="ningguang-burst-with-screen-body-instance-1"]'))).check();
  const body = await audit(page);
  expect(body.result.status).toBe("calculated");
  // T1 Q coefficient .8696. Current Q: 2000 ATK, 50% CR, 100% CD; L90/90 and 10% RES.
  const bodyNonCrit = 2000 * 0.8696 * 0.5 * 0.9;
  expect(body.result.totals!.nonCritical).toBeCloseTo(bodyNonCrit, 9);
  expect(body.result.totals!.expected).toBeCloseTo(bodyNonCrit * 1.5, 9);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  const historical = {
    "stats.atk": 1000, "stats.hp": 10000, "stats.def": 700, "stats.em": 0,
    "stats.critRate": 0.2, "stats.critDamage": 0.5,
    characterLevel: 90, ascension: 4, damageBonus: 0.3, additiveBaseDamage: 0, reactionBonus: 0,
  };
  for (const [path, number] of Object.entries(historical)) {
    await (await revealControl(page.locator(`[data-ningguang-snapshot="${path}"]`))).fill(String(number));
  }
  await (await revealControl(page.locator("#calc-ningguang-snapshot-source"))).fill("浏览器合成历史面板：仅验证两组快照，不是角色实测");
  await (await revealControl(page.locator("#calc-ningguang-snapshot-apply"))).click();
  const complete = await audit(page);
  expect(complete.result.status).toBe("calculated");
  expect(complete.result.hits).toHaveLength(12);
  const screenNonCrit = 1000 * 0.8696 * 1.3 * 0.5 * 0.9;
  expect(complete.result.totals!.nonCritical).toBeCloseTo(6 * (bodyNonCrit + screenNonCrit), 9);
  expect(complete.result.totals!.expected).toBeCloseTo(6 * (bodyNonCrit * 1.5 + screenNonCrit * 1.1), 9);
  expect(complete.result.hits.slice(6).every(hit => hit.effectiveCritRate === 0.2)).toBe(true);
  const screenCard = page.locator('[data-detail-id="hit-card:ningguang-burst-with-screen-screen-instance-1"]');
  const screenTrace = screenCard.locator("[data-hit-trace-index]");
  await expect(screenCard).not.toHaveAttribute("open", "");
  await expect(screenTrace).toBeEmpty();
  // All numerical traces already exist in audit JSON; keyboard opening only mounts their presentation.
  await screenCard.locator(":scope > summary").focus();
  await (await revealControl(screenCard.locator(":scope > summary"))).press("Enter");
  await expect(screenCard).toHaveAttribute("open", "");
  await expect(screenTrace).toHaveAttribute("data-trace-mounted", "true");
  const rendered = await screenTrace.locator("tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute("data-trace-node"),
    value: row.querySelector(".trace-value")?.textContent,
    formula: row.querySelector("code")?.textContent,
    substitution: row.nextElementSibling?.querySelector(".trace-substitution code")?.textContent,
  })));
  expect(rendered).toEqual(complete.result.hits[6]!.trace.map(node => ({
    id: node.id, value: node.result?.display ?? "不适用", formula: node.symbolicFormula,
    substitution: node.substitution + (node.result ? ` = ${node.result.display}` : ""),
  })));
  await expect(screenTrace.locator('[data-trace-node="snapshot.atk"]')).toContainText("1,000");
  await (await revealControl(screenCard.locator(":scope > summary"))).press("Enter");
  await expect(screenCard).not.toHaveAttribute("open", "");
  await (await revealControl(screenCard.locator(":scope > summary"))).press("Enter");
  await expect(screenCard).toHaveAttribute("open", "");
  await expect(screenTrace.locator(".calculator-trace")).toHaveCount(1);
  await expect(screenTrace.locator("tr[data-trace-node]")).toHaveCount(complete.result.hits[6]!.trace.length);
  const bonusStep = screenCard.locator('[data-detail-id="customDamageBonus"]');
  await (await revealControl(bonusStep.locator(":scope > summary"))).click();
  await expect(bonusStep).toHaveAttribute("open", "");

  // A4 belongs to its own saved snapshot. It must not add 12% to the current Q's six gems.
  await (await revealControl(page.locator("#calc-ningguang-screen-a4-active"))).selectOption("1");
  const oldA4 = await audit(page);
  const screenA4NonCrit = 1000 * 0.8696 * 1.42 * 0.5 * 0.9;
  expect(oldA4.result.hits[0]!.nonCritical).toBeCloseTo(bodyNonCrit, 9);
  expect(oldA4.result.hits[6]!.nonCritical).toBeCloseTo(screenA4NonCrit, 9);
  expect(oldA4.result.totals!.expected).toBeCloseTo(6 * (bodyNonCrit * 1.5 + screenA4NonCrit * 1.1), 9);
  await expect(screenCard).toHaveAttribute("open", "");
  await expect(bonusStep).toHaveAttribute("open", "");
  const updatedBonus = oldA4.result.hits[6]!.trace.find(node => node.id === "customDamageBonus")!;
  expect(updatedBonus.result!.value).toBe(0.12);
  await expect(screenTrace.locator('[data-trace-node="customDamageBonus"] .trace-value')).toHaveText(updatedBonus.result!.display!);
  await expect(bonusStep.locator(".trace-substitution code")).toHaveText(`${updatedBonus.substitution} = ${updatedBonus.result!.display}`);
  await (await revealControl(page.locator('[data-ningguang-snapshot="damageBonus"]'))).fill("0.42");
  await (await revealControl(page.locator("#calc-ningguang-snapshot-apply"))).click();
  await (await revealControl(page.locator("#calc-ningguang-screen-a4-included"))).selectOption("1");
  const accounted = await audit(page);
  for (const branch of ["nonCritical", "critical", "expected"] as const) {
    expect(accounted.result.totals![branch]).toBeCloseTo(oldA4.result.totals![branch], 9);
  }
  await calculatorRoundTrip(page, "ningguang-two-snapshot-complete.json");

  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator('[data-hit-id="ningguang-burst-with-screen-screen-instance-1"]'))).check();
  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("9999");
  const selected = await audit(page);
  expect(selected.result.hits).toHaveLength(1);
  expect(selected.result.totals!.nonCritical).toBeCloseTo(screenA4NonCrit, 9);
  expect(selected.result.totals!.expected).toBeCloseTo(screenA4NonCrit * 1.1, 9);
  await calculatorRoundTrip(page, "ningguang-history-selected-gem.json");
  await (await revealControl(page.locator("#calc-ningguang-snapshot-clear"))).click();
  const cleared = await audit(page);
  expect(cleared.result.status).toBe("blocked");
  expect(cleared.result.totals).toBeUndefined();
});

function syntheticStamina() {
  return makeConfig({
    dataVersion: "synthetic-shared-stamina-ui-v1", randomSeed: "shared-stamina-browser",
    meta: { name: "合成机制验证：共享体力、延迟扣除与等待恢复", version: "synthetic-shared-stamina-ui-v1", verificationStatus: "provisional", note: "合成动作与面板；在 UI 明确填写体力成本，只验证固定来源的共享资源语义。" },
    duration: 3, cycleLength: 3,
    characters: [
      { id: "a", name: "先行动 A", element: "geo", color: "#aa8800", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
      { id: "b", name: "后行动 B", element: "cryo", color: "#44aabb", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
    ],
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "a-charge", actorId: "a", name: "合成 A 重击", kind: "charge", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
          hits: [{ id: "a-hit", frame: 1, scaling: 1, element: "physical" }] },
        { id: "b-charge", actorId: "b", name: "合成 B 重击", kind: "charge", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
          hits: [{ id: "b-hit", frame: 1, scaling: 1, element: "physical" }] },
      ],
      commands: [
        { type: "charge", actorId: "a", abilityId: "a-charge", atFrame: 0 },
        { type: "swap", characterId: "b", atFrame: 8 },
        { type: "charge", actorId: "b", abilityId: "b-charge", atFrame: 10 },
      ],
    },
  });
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

test("Shared stamina rejects an unfunded second actor or waits to the exact recovery frame and preserves delayed debits in records", async ({ page }) => {
  const config = syntheticStamina();
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "shared-stamina.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#team-stamina-enabled")).not.toBeChecked();
  await (await revealControl(page.locator("#team-stamina-enabled"))).check();
  await (await revealControl(page.locator("#team-stamina-initial"))).fill("10");
  for (const [index, delay] of [6, 3].entries()) {
    const cost = page.locator(`[data-stamina-kind="ability"][data-stamina-index="${index}"]`);
    await (await revealControl(cost.locator("[data-stamina-amount]"))).fill("10");
    await (await revealControl(cost.locator("[data-stamina-consume-frame]"))).fill(String(delay));
    await expect(cost.locator("[data-stamina-zero-use]")).not.toBeChecked();
  }
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.staminaModel).toEqual({ mode: "shared-stamina-v1", profileId: "gcsim-b4ae769-stamina-v1", initialStamina: 10 });
  expect(saved.timeline!.abilities.map(ability => [ability.staminaCost!.amount, ability.staminaCost!.consumeFrame])).toEqual([[10, 6], [10, 3]]);
  expect(saved.timeline!.commands).toEqual(config.timeline!.commands);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("#iterationInput"))).fill("1");
  await (await revealControl(page.getByRole("button", { name: "运行模拟", exact: true }))).click();
  await waitForSimulation(page);
  const strict = await downloadSimulationRecord(page);
  expect(strict.result.timelineExecution!.commandResults[2]).toMatchObject({ requestedFrame: 10, startFrame: null, status: "rejected", failureCode: "INSUFFICIENT_STAMINA" });
  expect(strict.result.damageEvents.map(event => event.frame)).toEqual([1]);
  expect(strict.result.stamina!.logs.filter(row => row.operation === "spend").map(row => [row.frame, row.actorId, row.before, row.after])).toEqual([[6, "a", 10, 0]]);
  // Last use F6; recovery starts F97 and runs through F180: 84 × 25/60 = 35.
  expect(strict.result.stamina!.finalStamina).toBeCloseTo(35, 9);

  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  await (await revealControl(page.locator("#rotation-mode"))).selectOption("wait");
  await (await revealControl(page.locator("#execution-profile"))).selectOption("unchanged");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await waitForSimulation(page);
  const waited = await downloadSimulationRecord(page);
  expect(waited.sourceConfig.timeline!.legalityMode).toBe("wait");
  // At F119 only 23 ticks have restored 9.5833; F120 is the first affordable input with 10.
  expect(waited.result.timelineExecution!.commandResults[2]).toMatchObject({ requestedFrame: 10, startFrame: 120, status: "waited", waitedFrames: 110 });
  expect(waited.result.timelineExecution!.adjustments).toContainEqual(expect.objectContaining({ code: "INSUFFICIENT_STAMINA", requestedFrame: 10, executedFrame: 120, waitedFrames: 110 }));
  expect(waited.result.damageEvents.map(event => event.frame)).toEqual([1, 121]);
  expect(waited.result.totalDamage).toBeCloseTo(2 * 1000 * (190 / 400) * 0.9, 9);
  const spends = waited.result.stamina!.logs.filter(row => row.operation === "spend");
  // B checks the shared pool at input, then pays after three further player recovery ticks.
  expect(spends.map(row => [row.frame, row.actorId, row.before, row.after])).toEqual([[6, "a", 10, 0], [123, "b", 11.25, 1.25]]);
  expect(waited.result.stamina!.finalStamina).toBeCloseTo(1.25, 9);
  expect(waited.result.stamina!.logs.find(row => row.operation === "recover")!.startFrame).toBe(97);
  expect(spends[1]!.substitution).toContain("11.25");
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator("#actionStateAudit [data-stamina-summary]")).toContainText("1.25");
  const displayedDebit = page.locator(`#actionStateAudit [data-action-stamina-index="${spends[1]!.sequence}"]`);
  await (await revealControl(displayedDebit.locator("summary"))).click();
  expect(JSON.parse((await displayedDebit.locator("pre").textContent())!)).toEqual(spends[1]);
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "shared-stamina-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(waited.wire)) });
  await expectReadonlyRecord(page, waited);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(waited.sourceConfig);
  expect(restored.options).toEqual(waited.options);
  expect(restored.result.timelineExecution).toEqual(waited.result.timelineExecution);
  expect(restored.result.stamina).toEqual(waited.result.stamina);
  expect(restored.result.damageEvents).toEqual(waited.result.damageEvents);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#team-stamina-enabled")).toBeChecked();
  await (await revealControl(page.locator("#team-stamina-enabled"))).uncheck();
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const disabled = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(disabled.staminaModel).toBeUndefined();
  expect(disabled.rotation.every(action => action.staminaCost === undefined)).toBe(true);
  expect(disabled.timeline!.abilities.every(ability => ability.staminaCost === undefined)).toBe(true);
  expect(disabled.timeline!.commands).toEqual(config.timeline!.commands);
});
