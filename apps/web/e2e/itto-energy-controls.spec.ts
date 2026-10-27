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

function hitValue(result: CalculatorResult, id: string): number {
  const value = result.hits[0]?.trace.find(node => node.id === id)?.result?.value;
  expect(value, id).toBeDefined();
  return value!;
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

async function selectIttoAction(page: Page, label: string, skillId: string): Promise<void> {
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
  expect((await audit(page)).document.gameContext?.skillId).toBe(skillId);
}

test("Itto sourced Kesagiri keeps independent Q and A4 snapshots and scoped C6 through final JSON and equipment", async ({ page }) => {
  const source = JSON.parse(await readFile(new URL("../../../packages/game-data/src/character-mappings/itto-kesagiri-source-manifest.json", import.meta.url), "utf8")) as { coefficients: { defconv: { values: number[] } } };
  const conversion = 800 * source.coefficients.defconv.values[9]!;
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000057");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectIttoAction(page, "荒泷逆袈裟·单次连斩", "aratakiitto-kesagiri-combo");
  await expect(page.locator("[data-itto-controls]")).toBeVisible();
  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("1000");
  await (await revealControl(page.locator('[data-field="build.stats.def"]'))).fill("2500");
  await (await revealControl(page.locator('[data-field="gameContext.ittoCharged.actionDefenseSnapshotTotal"]'))).fill("1500");
  await (await revealControl(page.locator("#calc-itto-defense-stable"))).selectOption("0");
  await (await revealControl(page.locator('[data-field="gameContext.ittoCharged.burst.defenseSnapshotNonExtra"]'))).fill("800");
  await (await revealControl(page.locator('[data-field="gameContext.ittoCharged.burst.effectiveTalentLevel"]'))).fill("10");
  await (await revealControl(page.locator("#calc-itto-burst-active"))).selectOption("1");
  await (await revealControl(page.locator("#calc-itto-burst-accounting"))).selectOption("add-to-panel");
  const c0 = await audit(page);
  expect(c0.result.status).toBe("calculated");
  expect(c0.document.gameContext?.ittoCharged).toMatchObject({ superstrengthStacks: 2, c6PreserveStack: false, c4BuffActive: false, actionDefenseSnapshotTotal: 1500, actionDefenseStable: false });
  expect(c0.document.hits).toHaveLength(1);
  expect(c0.document.hits[0]!.kind === "ordinary" && c0.document.hits[0]!.element).toBe("geo");
  expect(hitValue(c0.result, "sourceAttackAdjustment")).toBe(conversion);
  expect(hitValue(c0.result, "hitAttack")).toBe(1000 + conversion);
  expect(hitValue(c0.result, "customAdditiveBase")).toBe(525); // A4 reads the separate action's total DEF, including Extra.
  await (await revealControl(page.locator('[data-field="build.stats.def"]'))).fill("9999");
  expect((await audit(page)).result.totals).toEqual(c0.result.totals);
  await (await revealControl(page.locator("#calc-constellation"))).selectOption("6");
  const c6 = await audit(page);
  expect(hitValue(c6.result, "characterCritDamage")).toBe(0.7);
  expect(hitValue(c6.result, "applicableCritDamage")).toBeCloseTo(1.9, 12);
  expect(c6.result.totals?.nonCritical).toBe(c0.result.totals?.nonCritical);
  await (await revealControl(page.locator('[data-field="hits.0.effectiveCritDamage"]'))).fill("1.9");
  const override = await audit(page);
  expect(override.result.totals).toEqual(c6.result.totals);
  expect(override.result.hits[0]!.trace.find(node => node.id === "characterCritDamage")?.status).toBe("not-applicable");
  await (await revealControl(page.locator('[data-field="hits.0.effectiveCritDamage"]'))).fill("");
  await selectIttoAction(page, "荒泷逆袈裟·单次终结", "aratakiitto-kesagiri-finisher");
  const finisher = await audit(page);
  expect(finisher.result.status).toBe("calculated");
  expect(finisher.document.gameContext?.ittoCharged).toMatchObject({ superstrengthStacks: 1, c6PreserveStack: false, actionDefenseSnapshotTotal: 1500, burst: { active: true, effectiveTalentLevel: 10, defenseSnapshotNonExtra: 800, accounting: "add-to-panel" } });
  expect(finisher.document.hits).toHaveLength(1);
  expect(hitValue(finisher.result, "sourceAttackAdjustment")).toBe(conversion);
  expect(hitValue(finisher.result, "customAdditiveBase")).toBe(525);
  expect(hitValue(finisher.result, "characterCritDamage")).toBe(0.7);
  await (await revealControl(page.locator('[data-equipment="weapon"]'))).selectOption("weapon:12510");
  await (await revealControl(page.locator('[data-equipment="weaponEffectsEnabled"]'))).check();
  await (await revealControl(page.locator('[data-equipment="effectsDisabled"]'))).check();
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const equipped = await audit(page);
  const baseAttack = equipped.result.trace.find(node => node.id === "build.finalAtk")?.result?.value;
  expect(baseAttack).toBeDefined();
  expect(hitValue(equipped.result, "hitAttack")).toBe(baseAttack! + conversion);
  expect(hitValue(equipped.result, "customAdditiveBase")).toBe(525);
  expect(hitValue(equipped.result, "characterCritDamage")).toBe(0.7);
  await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
  const final = await audit(page);
  expect(final.result.totals).toEqual(equipped.result.totals);
  expect(final.document.build.mode !== "equipment-derived" && final.document.build.stats.atk).toBe(baseAttack);
  expect(final.document.gameContext?.ittoCharged?.burst.accounting).toBe("add-to-panel");
  expect(final.result.hits[0]!.trace.find(node => node.id === "characterCritDamage")?.status).toBe("not-applicable");
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "itto-kesagiri-final.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  expect((await audit(page)).result.totals).toEqual(equipped.result.totals);
  await (await revealControl(page.locator("[data-equipment-apply]"))).click();
  const reapplied = await audit(page);
  expect(reapplied.document.build.mode).toBe("equipment-derived");
  expect(reapplied.result.totals).toEqual(equipped.result.totals);
  expect(hitValue(reapplied.result, "hitAttack")).toBe(baseAttack! + conversion);
  expect(hitValue(reapplied.result, "customAdditiveBase")).toBe(525);
  expect(hitValue(reapplied.result, "characterCritDamage")).toBe(0.7);
});

function syntheticEnergyControls() {
  return makeConfig({
    dataVersion: "synthetic-normal-energy-controls-v1", randomSeed: "ui-normal-energy-controls-v1",
    meta: { name: "合成机制验证：普通回能控件", version: "synthetic-normal-energy-controls-v1", verificationStatus: "provisional", note: "纯合成面板和动作，只验证显式回能控件与同一来源随机流；不代表真实角色技能。" },
    duration: 2.5, cycleLength: 2.5,
    characters: [
      { id: "a", name: "合成 A", element: "geo", color: "#aa8800", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
      { id: "b", name: "合成 B", element: "cryo", color: "#44aabb", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
    ],
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "synthetic-normal", actorId: "a", name: "合成普攻两击", kind: "normal", cancelFrame: 21, animationEndFrame: 21, cooldownFrames: 0,
          hits: [0, 20].map((frame, index) => ({ id: `normal-${index}`, frame, scaling: 1, element: "physical" as const })) },
        { id: "synthetic-extra", actorId: "b", name: "合成 Extra 两击", kind: "charge", cancelFrame: 21, animationEndFrame: 21, cooldownFrames: 0,
          hits: [0, 20].map((frame, index) => ({ id: `extra-${index}`, frame, scaling: 1, element: "physical" as const })) },
      ],
      commands: [
        { type: "normal", actorId: "a", abilityId: "synthetic-normal", atFrame: 1 },
        { type: "swap", characterId: "b", atFrame: 80 },
        { type: "charge", actorId: "b", abilityId: "synthetic-extra", atFrame: 93 },
      ],
    },
  });
}

test("Team explicit normal-energy weapons and per-hit tags run through the worker and survive record import", async ({ page }) => {
  const config = syntheticEnergyControls();
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "normal-energy-controls.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#team-normal-energy-enabled")).not.toBeChecked();
  for (const actorId of ["a", "b"]) {
    const weapon = page.locator(`[data-normal-energy-weapon="${actorId}"]`);
    await expect(weapon).toHaveValue("");
    expect(await weapon.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
      .toEqual(["", "sword", "claymore", "polearm", "bow", "catalyst"]);
  }
  await (await revealControl(page.locator("#team-normal-energy-enabled"))).check();
  await (await revealControl(page.locator('[data-normal-energy-weapon="a"]'))).selectOption("claymore");
  await (await revealControl(page.locator('[data-normal-energy-weapon="b"]'))).selectOption("sword");
  await (await revealControl(page.locator("#team-normal-energy-hits > summary"))).click();
  for (let i = 0; i < 2; i++) {
    await (await revealControl(page.locator(`[data-normal-energy-tag][data-energy-action-index="0"][data-energy-hit-index="${i}"]`))).selectOption("normal");
    await (await revealControl(page.locator(`[data-normal-energy-tag][data-energy-action-index="1"][data-energy-hit-index="${i}"]`))).selectOption("extra");
  }
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.normalHitEnergyModel).toEqual({ mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponType: "claymore" }, { actorId: "b", weaponType: "sword" }] });
  expect(saved.timeline!.abilities.map(ability => ability.hits?.map(hit => hit.normalHitEnergyTag))).toEqual([["normal", "normal"], ["extra", "extra"]]);
  expect(saved.characters).toEqual(config.characters);
  expect(saved.timeline!.commands).toEqual(config.timeline!.commands);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("#energyModeInput"))).selectOption("zero");
  await (await revealControl(page.locator("#iterationInput"))).fill("2");
  await (await revealControl(page.getByRole("button", { name: "运行模拟", exact: true }))).click();
  await waitForSimulation(page);
  await expect(page.locator("#batchSummary")).toContainText("seeded-particles-and-normal-energy-mulberry32-v1");
  const record = await downloadSimulationRecord(page);
  expect(record.iterations).toBe(2);
  expect(record.batchSummary.rngPolicy).toBe("seeded-particles-and-normal-energy-mulberry32-v1");
  expect(record.batchSummary.normalHitEnergyPolicy).toEqual({ sourceProfileId: "gcsim-normal-hit-energy-reference-v1", rngStream: "normal-hit-energy-v1", rngAlgorithm: "fnv1a32-mulberry32-v1", matchesGcsimRandomSequence: false });
  expect(record.batchSummary.criticalPolicy).toBe("average");
  const energy = record.result.normalHitEnergyLog!;
  const attempts = energy.filter(entry => entry.kind === "damage");
  expect(attempts.map(entry => [entry.actorId, entry.attackTag, entry.weaponType, entry.baselineProbability])).toEqual([
    ["a", "normal", "claymore", 0], ["a", "normal", "claymore", 0],
    ["b", "extra", "sword", 0.1], ["b", "extra", "sword", 0.1],
  ]);
  expect(energy.filter(entry => entry.kind === "swap")).toHaveLength(1);
  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator("#actionStateAudit [data-action-normal-energy-index]")).toHaveCount(energy.length);
  const first = page.locator('#actionStateAudit [data-action-normal-energy-index="0"]');
  await (await revealControl(first.locator("summary"))).click();
  expect(JSON.parse((await first.locator("pre").textContent())!)).toEqual(energy[0]);
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "normal-energy-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.batchSummary.seed);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.result.normalHitEnergyLog).toEqual(energy);
  expect(restored.result.energyStats).toEqual(record.result.energyStats);
  const { elapsedMilliseconds: _firstElapsed, ...summary } = record.batchSummary;
  const { elapsedMilliseconds: _secondElapsed, ...restoredSummary } = restored.batchSummary;
  expect(restoredSummary).toEqual(summary);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#team-normal-energy-enabled")).toBeChecked();
  await (await revealControl(page.locator("#team-normal-energy-enabled"))).uncheck();
  await (await revealControl(page.locator("#team-apply"))).click();
  const disabled = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(disabled.normalHitEnergyModel).toBeUndefined();
  expect(disabled.timeline).toEqual(record.sourceConfig.timeline);
});
