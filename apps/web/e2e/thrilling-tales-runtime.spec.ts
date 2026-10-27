import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";
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

function syntheticThrillingTalesCycle() {
  return makeConfig({
    dataVersion: "synthetic-thrilling-tales-ui-v1", randomSeed: "thrilling-tales-ui",
    meta: { name: "合成讨龙实际切人领取", version: "synthetic-thrilling-tales-ui-v1", verificationStatus: "user-supplied", note: "合成合法闭合轮转，只验证讨龙切人增益；接收者基础攻击1000加固定攻击200，不代表真实角色构筑。" },
    duration: 40, cycleLength: 40,
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    characters: ["a", "b", "c"].map(id => ({ id, name: id === "c" ? "合成接收者 C" : `合成持有者 ${id.toUpperCase()}`, element: "pyro" as const, color: "#ff0000", level: 90,
      energyMax: 60, initialEnergy: 0, stats: { ...neutralStats, flatAtk: id === "c" ? 200 : 0 } })),
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
      abilities: [{ id: "c-normal", actorId: "c", name: "合成接收者物理普攻", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: "normal", frame: 0, scaling: 1, element: "physical", attackTag: "normal" }] }],
      commands: [
        { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 0 },
        { type: "swap", characterId: "a", atFrame: 20 },
        { type: "swap", characterId: "c", atFrame: 100 },
        { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 102 },
        { type: "swap", characterId: "b", atFrame: 180 },
        { type: "swap", characterId: "c", atFrame: 260 },
        { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 262 },
        { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 800 },
        { type: "swap", characterId: "b", atFrame: 1540 },
        { type: "swap", characterId: "c", atFrame: 1620 },
        { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 1622 },
        { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 2300 },
      ],
    },
  });
}

test("Team TTDS declarations apply only on real holder swap and preserve rejected grants and complete hit replay", async ({ page }) => {
  const config = syntheticThrillingTalesCycle();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("average");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "thrilling-tales.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#thrillingTalesModelEnabled")).not.toBeChecked();
  await (await revealControl(page.locator("#thrillingTalesModelEnabled"))).check();
  await (await revealControl(page.locator('[data-thrilling-tales-actor="a"]'))).check();
  await (await revealControl(page.locator('[data-thrilling-tales-refinement="a"]'))).selectOption("1");
  await (await revealControl(page.locator('[data-thrilling-tales-actor="b"]'))).check();
  await (await revealControl(page.locator('[data-thrilling-tales-refinement="b"]'))).selectOption("5");
  await expect(page.locator('[data-thrilling-tales-actor="c"]')).not.toBeChecked();
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.thrillingTalesModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", refinement: 1 }, { actorId: "b", refinement: 5 }] });
  expect(saved.characters).toEqual(config.characters);
  expect(saved.timeline).toEqual(config.timeline);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#runButton"))).click();
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig).toEqual(saved);
  const result = record.result;
  expect(result.skippedActions).toEqual([]);
  expect(result.timelineExecution!.failures).toEqual([]);
  expect(result.timelineExecution!.commandResults.filter(command => command.commandType === "swap").map(command => command.endFrame)).toEqual([21, 101, 181, 261, 1541, 1621]);
  const grants = result.thrillingTalesLog!;
  expect(grants.map(entry => [entry.ownerId, entry.recipientId, entry.frame, entry.coefficient, entry.outcome, entry.swapKind])).toEqual([
    ["a", "c", 101, 0.24, "applied", "legal-completed"],
    ["b", "c", 261, 0.48, "recipient-already-buffed", "legal-completed"],
    ["b", "c", 1621, 0.48, "applied", "legal-completed"],
  ]);
  expect(grants.map(entry => [entry.cooldownExpiresFrameBefore, entry.cooldownExpiresFrameAfter, entry.recipientExpiresFrameBefore, entry.recipientExpiresFrameAfter])).toEqual([
    [null, 1301, null, 701], [null, 1461, 701, 701], [1461, 2821, null, 2221],
  ]);
  // ATK = base 1000 × (1 + TTDS) + flat 200; L90/90 DEF=0.5 and zero resistance.
  expect(result.damageEvents.map(event => [event.frame, event.scalingValue, event.finalDamage])).toEqual([
    [0, 1200, 600], [102, 1440, 720], [262, 1440, 720], [800, 1200, 600], [1622, 1680, 840], [2300, 1200, 600],
  ]);
  expect(result.damageEvents.map(event => event.statsBeforeDamage.atkPct)).toEqual([0, 0.24, 0.24, 0, 0.48, 0]);
  expect(result.totalDamage).toBe(4080);

  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  const ledger = page.locator("#thrillingTalesAudit");
  await expect(ledger).toBeVisible();
  await expect(ledger.locator("[data-thrilling-tales-id]")).toHaveCount(3);
  const blocked = ledger.locator(`[data-thrilling-tales-detail="${grants[1]!.id}"]`);
  await (await revealControl(blocked.locator(":scope > summary"))).click();
  await expect(blocked).toContainText("不添加、不叠加，也不刷新");
  await expect(blocked).toContainText("预期系数 0.48 不替代已有增益");
  const blockedSource = JSON.parse(await blocked.locator("pre").textContent() ?? "null");
  expect(blockedSource.existingApplied).toEqual(grants[0]);
  const amplified = result.damageEvents.find(event => event.frame === 1622)!;
  const actualGrant = ledger.locator(`[data-thrilling-tales-detail="${grants[2]!.id}"]`);
  await (await revealControl(actualGrant.locator(":scope > summary"))).click();
  await (await revealControl(actualGrant.locator(`[data-thrilling-tales-hit-detail="${amplified.id}"] > summary`))).click();
  await expect(actualGrant.locator(`[data-thrilling-tales-replay="${amplified.id}"]`)).toHaveAttribute("data-thrilling-tales-snapshot-includes", "true");
  await expect(actualGrant.locator(`[data-thrilling-tales-hit-trace="${amplified.id}"]`)).toContainText("原始伤害 840 · 共享核心还原 840 · 差值 0");
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${amplified.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(sourceTrace.length).toBeGreaterThan(0);
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const restoredTrace = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(restoredTrace).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(amplified.id);
  expect(captured.sourceResult).toEqual(result);

  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "thrilling-tales-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.options.randomSeed);
  const replayed = await downloadSimulationRecord(page);
  expect(replayed.sourceConfig).toEqual(record.sourceConfig);
  expect(replayed.options).toEqual(record.options);
  expect(replayed.result).toEqual(record.result);

  // A single warmup of this same saved cycle checks the persisted runtime cooldown state.
  await (await revealControl(page.getByRole("button", { name: "总览", exact: true }))).click();
  await (await revealControl(page.locator("#analysis-warmup-energy"))).selectOption("zero");
  await (await revealControl(page.locator("#analysis-warmup-cycles"))).fill("8");
  await (await revealControl(page.locator("#analysis-steady-run"))).click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  const { startup } = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  expect(startup.status).toBe("steady-state-established");
  expect(startup.measurement).toMatchObject({ startTick: 19200, endTick: 21600, totalDamage: 4080, dps: 102 });
  expect(startup.steadyState).toMatchObject({ periodCycles: 1, status: "established-from-simulation", steadyStateDps: 102 });
  expect(startup.result!.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
  expect(startup.result!.executionAudit!.phaseCheckpoints.at(-1)!.state.icdAndTriggerHistory).toMatchObject({
    thrillingTales: { mode: "fixed-source-no-character-hitlag-v1", actors: [
      { actorId: "a", refinement: 1, remainingCooldownTicks: null },
      { actorId: "b", refinement: 5, remainingCooldownTicks: 421 },
    ], recipients: [] },
  });
});
