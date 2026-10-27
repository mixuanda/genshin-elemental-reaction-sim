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

function syntheticTwoChargeSkill() {
  return makeConfig({
    dataVersion: "synthetic-sacrificial-serial-ui-v1", randomSeed: "sacrificial-consumer-reference",
    meta: { name: "合成祭礼两次充能与第三次战技", version: "synthetic-sacrificial-serial-ui-v1", verificationStatus: "user-supplied",
      note: "明确的两充能合成技能与面板，只验证固定祭礼来源、真实串行恢复和粒子事件；不代表实际角色构筑或游戏实测。" },
    duration: 11, cycleLength: 11, rotation: [],
    enemy: { level: 90, resistance: 0.1, defReduction: 0 },
    characters: [{ id: "a", name: "合成祭礼持有者 A", element: "pyro", color: "#dd5500", level: 90,
      energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } }],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "e", actorId: "a", name: "明确合成两充能战技", kind: "skill", cancelFrame: 1, animationEndFrame: 1,
        cooldownFrames: 600, maxCharges: 2,
        hits: [{ id: "e-hit", frame: 6, scaling: 1, element: "physical", attackTag: "skill" }],
        particles: [{ element: "pyro", count: 1, spawnFrame: 6, travelFrames: 2 }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "e", atFrame: 1 }, { type: "skill", actorId: "a", abilityId: "e", atFrame: 2 }] },
  });
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Sacrificial normal controls reset one serial charge, execute a third skill, and preserve actual hit replay without claiming steady state", async ({ page }) => {
  const config = syntheticTwoChargeSkill();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("noCrit");
  await (await revealControl(page.locator("#energyModeInput"))).selectOption("zero");
  await (await revealControl(page.locator("#iterationInput"))).fill("1");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "sacrificial-two-charge.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#sacrificialModelEnabled")).not.toBeChecked();
  await (await revealControl(page.locator("#sacrificialModelEnabled"))).check();
  await (await revealControl(page.locator('[data-sacrificial-weapon="a"]'))).selectOption("sacrificialsword");
  await (await revealControl(page.locator('[data-sacrificial-refinement="a"]'))).selectOption("5");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  const equipped = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(equipped.sacrificialModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "sacrificialsword", refinement: 5 }] });
  expect(equipped.characters).toEqual(config.characters);

  await (await revealControl(page.locator('.product-nav a[href="/rotation"]'))).click();
  // Later warmup cycles may wait for real serial recovery; the first cycle must still execute at 1/2/10.
  await (await revealControl(page.locator("#rotation-mode"))).selectOption("wait");
  await (await revealControl(page.locator('[data-ability-cooldown-start="e"]'))).fill("0");
  await (await revealControl(page.locator('[data-ability-cooldown-start="e"]'))).press("Tab");
  await (await revealControl(page.locator("#rotation-action"))).selectOption("e");
  await (await revealControl(page.locator("#rotation-add"))).click();
  await (await revealControl(page.locator('[data-request="2"]'))).fill("10");
  await (await revealControl(page.locator('[data-request="2"]'))).press("Tab");
  await (await revealControl(page.locator("#rotation-compile"))).click();
  await expect(page.locator("#rotation-timeline")).toContainText("已编译 3 条指令");
  const thirdPreview = page.locator('[data-rotation-command="2"]');
  await expect(thirdPreview.locator("td").nth(2)).toHaveText("10");
  await expect(thirdPreview.locator("td").nth(3)).toHaveText("执行");
  await (await revealControl(page.locator("#rotation-save"))).click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  const result = record.result;
  expect(record.sourceConfig.sacrificialModel).toEqual(equipped.sacrificialModel);
  expect(record.sourceConfig.timeline!.abilities[0]!.cooldownStartFrame).toBe(0);
  expect(record.options.randomSeed).toBe(config.randomSeed);
  expect(result.timelineExecution!.commandResults.map(command => command.startFrame)).toEqual([1, 2, 10]);
  expect(result.timelineExecution!.failures).toEqual([]);
  expect(result.skippedActions).toEqual([]);
  expect(result.damageEvents.map(event => [event.frame, event.finalDamage])).toEqual([[7, 450], [8, 450], [16, 450]]);
  expect(result.totalDamage).toBe(3 * 1000 * 0.5 * 0.9);
  const attempts = result.sacrificialLog!;
  expect(attempts.map(entry => [entry.frame, entry.outcome])).toEqual([[7, "triggered"], [8, "cooldown-blocked"], [16, "cooldown-blocked"]]);
  const trigger = attempts[0]!;
  expect(trigger).toMatchObject({ actorId: "a", weaponId: "sacrificialsword", refinement: 5, probability: 0.8,
    rngStream: "sacrificial-v1", drawIndex: 0, drawCountBefore: 0, drawCountAfter: 1, skillCooldownBefore: 594,
    cooldownExpiresFrameBefore: null, cooldownExpiresFrameAfter: 967 });
  expect(trigger.roll).toBeCloseTo(0.6284964594524354, 15);
  expect(attempts.slice(1).map(entry => [entry.roll, entry.drawIndex, entry.drawCountBefore, entry.drawCountAfter])).toEqual([[null, null, 1, 1], [null, null, 1, 1]]);
  const reset = result.skillCooldownLog!.find(entry => entry.id === trigger.skillCooldownLogId)!;
  expect(reset).toMatchObject({ operation: "reset", frame: 7, sacrificialLogId: trigger.id,
    stateBefore: { maxCharges: 2, availableCharges: 0, workerStartedFrame: 1 },
    stateAfter: { maxCharges: 2, availableCharges: 1, workerStartedFrame: 7 } });
  expect(reset.stateBefore.queue).toHaveLength(2);
  expect(reset.stateAfter.queue).toHaveLength(1);
  expect(reset.stateAfter.queue[0]).toEqual(reset.stateBefore.queue[1]);
  const thirdStart = result.skillCooldownLog!.find(entry => entry.operation === "start" && entry.timelineCommandIndex === 2)!;
  expect(thirdStart).toMatchObject({ frame: 10, stateBefore: { availableCharges: 1 }, stateAfter: { availableCharges: 0 } });
  expect(thirdStart.stateAfter.queue).toHaveLength(2);
  expect(result.skillCooldownLog!.filter(entry => entry.operation === "stale-worker").map(entry => entry.frame)).toEqual([601]);
  expect(result.skillCooldownLog!.filter(entry => entry.operation === "recover").map(entry => entry.frame)).toEqual([607]);
  expect(result.particleEvents.map(event => [event.spawnFrame, event.receiveFrame, event.particleCount])).toEqual([[7, 9, 1], [8, 10, 1], [16, 18, 1]]);
  expect(result.energyLog.map(entry => [entry.frame, entry.gainedEnergy])).toEqual([[9, 3], [10, 3], [18, 3]]);
  expect(result.energyStats.a).toMatchObject({ gained: 9, spent: 0, final: 9 });
  for (const particle of result.particleEvents) expect(result.actionLog.some(action => action.actionId === particle.sourceActionId)).toBe(true);

  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  const ledger = page.locator("#sacrificialAudit");
  await expect(ledger).toBeVisible();
  await expect(ledger.locator("[data-sacrificial-id]")).toHaveCount(3);
  await expect(ledger.locator('[data-skill-cooldown-operation="reset"]')).toContainText("队列 2 → 1 项");
  const triggerDetails = ledger.locator(`[data-sacrificial-detail="${trigger.id}"]`);
  await (await revealControl(triggerDetails.locator(":scope > summary"))).click();
  const resetDisplay = triggerDetails.locator(`[data-sacrificial-reset="${reset.id}"]`);
  await expect(resetDisplay.locator("[data-skill-cooldown-before] ol > li")).toHaveCount(2);
  await expect(resetDisplay.locator("[data-skill-cooldown-after] ol > li")).toHaveCount(1);
  expect(JSON.parse((await resetDisplay.locator("pre").textContent())!)).toEqual(reset);
  const followingSkill = triggerDetails.locator("[data-sacrificial-next-action]");
  await expect(followingSkill).toContainText("10f");
  await expect(followingSkill).toContainText("生成 16f");
  await expect(followingSkill).toContainText("接收帧 18f");
  await expect(followingSkill).toContainText("实际获得 3");

  const thirdHit = result.damageEvents[2]!;
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${thirdHit.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })))).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(thirdHit.id);
  expect(captured.sourceResult.sacrificialLog).toEqual(attempts);
  expect(captured.sourceResult.skillCooldownLog).toEqual(result.skillCooldownLog);
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "sacrificial-third-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "sacrificial-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(config.randomSeed!);
  const restored = await downloadSimulationRecord(page);
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.result.sacrificialLog).toEqual(attempts);
  expect(restored.result.skillCooldownLog).toEqual(result.skillCooldownLog);
  expect(restored.result.particleEvents).toEqual(result.particleEvents);
  expect(restored.result.energyLog).toEqual(result.energyLog);

  await (await revealControl(page.getByRole("button", { name: "总览", exact: true }))).click();
  await (await revealControl(page.locator("#analysis-warmup-energy"))).selectOption("zero");
  await (await revealControl(page.locator("#analysis-warmup-cycles"))).fill("1");
  await (await revealControl(page.locator("#analysis-steady-run"))).click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-startup-output")).toContainText("随机状态已捕获不等于分布收敛");
  await expect(page.locator("#analysis-startup-output")).not.toContainText("已从完整模拟检查点建立稳态");
  const { startup } = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  expect(startup.status).not.toBe("steady-state-established");
  expect(startup.result!.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
  const checkpoint = startup.result!.executionAudit!.phaseCheckpoints[0]!;
  expect(checkpoint.state.icdAndTriggerHistory).toMatchObject({ randomExecution: {
    version: "named-rng-state-v1", streams: { sacrificial: { drawCount: startup.result!.sacrificialLog!
      .filter(row => row.frame < checkpoint.tick && row.drawIndex !== null).length } },
  } });
  expect(startup.steadyState!.status).toBe("not-established");
  expect(startup.steadyState!.reasons.join(" ")).toContain("随机状态已捕获不等于分布收敛");
  console.info("Sacrificial runtime browser measurements", JSON.stringify({ starts: result.timelineExecution!.commandResults.map(command => command.startFrame),
    totalDamage: result.totalDamage, resetFrame: reset.frame, queueBefore: reset.stateBefore.queue.length, queueAfter: reset.stateAfter.queue.length,
    thirdCastQueue: thirdStart.stateAfter.queue.length, finalEnergy: result.energyStats.a!.final, roll: trigger.roll,
    replayDifference: 0, startupStatus: startup.status, checkpointComplete: startup.result!.executionAudit!.checkpointCoverage.complete }));
});
