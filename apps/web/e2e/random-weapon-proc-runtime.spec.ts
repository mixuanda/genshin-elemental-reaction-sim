import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
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

function sameFrameCryoInputs() {
  // Same explicit counterexample as the schema audit, with the weapon enabled through normal team controls.
  return makeConfig({
    dataVersion: "synthetic-random-weapon-callback-ui-v1", randomSeed: "schema-random-weapon",
    meta: { name: "合成霜葬实际回调与范围倍率", version: "synthetic-random-weapon-callback-ui-v1", verificationStatus: "user-supplied",
      note: "合成面板与同帧动作，只验证固定来源的武器回调、随机抽样及命中还原，不代表真实角色配装或游戏实测。" },
    duration: 1, cycleLength: 1,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "原目标：同帧火清冰", position: { x: 0, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "cryo", gaugeUnits: 1 }] },
      { id: "nearby", name: "邻近目标：仍有冰", position: { x: 1, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "cryo", gaugeUnits: 1 }] },
    ] },
    reactionEngine: { mode: "aura-v3" },
    rotation: [],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "combined", actorId: "a", name: "同帧来源反例：先普攻后火附着", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [
          { id: "normal-hit", frame: 0, scaling: 1, element: "physical", targeting: { targetId: "enemy-0", outcome: "landed" } },
          { id: "consume-hit", frame: 0, scaling: 0, element: "pyro", attackTag: "skill", targeting: { targetId: "enemy-0", outcome: "landed" },
            application: { gaugeUnits: 2, icd: { mode: "no-icd-v1" } } },
        ] }], commands: [{ type: "normal", actorId: "a", abilityId: "combined", atFrame: 0 }] },
  });
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Random weapon normal controls use actual deferred Cryo state for the whole AoE and preserve replay, checkpoint limits, and two-seed provenance", async ({ page }) => {
  const config = sameFrameCryoInputs();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("noCrit");
  await (await revealControl(page.locator("#iterationInput"))).fill("1");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "random-weapon-callback.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#weaponProcModelEnabled")).not.toBeChecked();
  await (await revealControl(page.locator("#weaponProcModelEnabled"))).check();
  const weapon = page.locator('[data-weapon-proc-weapon="a"]');
  const available = await weapon.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect(available).toEqual(expect.arrayContaining(["filletblade", "prototypearchaic", "snowtombedstarsilver", "dragonspinespear", "frostbearer"]));
  await weapon.selectOption("frostbearer");
  await (await revealControl(page.locator('[data-weapon-proc-refinement="a"]'))).selectOption("5");
  await (await revealControl(page.locator('[data-weapon-proc-physical-bonus="a"]'))).fill("0");
  await expect(page.locator('[data-weapon-proc-definition="a"]')).toContainText("1.4");
  await expect(page.locator('[data-weapon-proc-aura-definition]')).toContainText("原触发目标");
  await (await revealControl(page.locator("#weaponProcModelControls > details > summary").filter({ hasText: "逐命中攻击标签声明" }))).click();
  await (await revealControl(page.locator('[data-weapon-proc-tag][data-proc-action-index="0"][data-proc-hit-index="0"]'))).selectOption("normal");
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.weaponProcModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "frostbearer", refinement: 5, physicalDamageBonus: 0 }] });
  expect(saved.characters).toEqual(config.characters);
  expect(saved.timeline!.abilities[0]!.hits![0]!.attackTag).toBe("normal");
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#runButton"))).click();
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig).toEqual(saved);
  const result = record.result;
  const triggers = result.weaponProcLog!.filter(entry => entry.outcome === "triggered");
  expect(triggers).toHaveLength(1);
  const trigger = triggers[0]!;
  expect(trigger).toMatchObject({ weaponId: "frostbearer", refinement: 5, sourceProfileId: "gcsim-random-weapon-proc-v1",
    frame: 0, damageFrame: 1, coefficient: 1.4, triggerAura: { cryo: false, frozen: false },
    random: { probability: 1, successComparison: "<", drawIndex: 0, drawCountBefore: 0, drawCountAfter: 1, rngStream: "independent-weapon-proc-v1" } });
  expect(trigger.random!.roll).toBeGreaterThanOrEqual(0);
  expect(trigger.random!.roll).toBeLessThan(1);
  const parent = result.damageEvents.find(event => event.id === trigger.parentDamageEventId)!;
  const fire = result.damageEvents.find(event => event.hitId === "consume-hit")!;
  expect(parent.reactionAudit.auraAfter!.some(aura => aura.element === "cryo")).toBe(true);
  expect(fire.frame).toBe(parent.frame);
  expect(fire.eventSequence).toBeGreaterThan(parent.eventSequence);
  expect(trigger.eventSequence).toBeGreaterThan(fire.eventSequence);
  expect(fire.reactionAudit.auraAfter!.some(aura => aura.element === "cryo")).toBe(false);
  const children = result.damageEvents.filter(event => event.weaponProcLogId === trigger.id);
  // R5 base 140% ATK is chosen once at the callback; L90/L90 DEF=0.5 and physical RES=0.
  const childDamage = 1000 * 1.4 * 0.5;
  expect(children.map(event => [event.targetId, event.frame, event.finalDamage])).toEqual([["enemy-0", 1, childDamage], ["nearby", 1, childDamage]]);
  const nearby = children.find(event => event.targetId === "nearby")!;
  expect(nearby.reactionAudit.auraBefore!.some(aura => aura.element === "cryo")).toBe(true);
  expect(result.totalDamage).toBe(1000 * 0.5 + 2 * childDamage);

  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-detail="${trigger.id}"] > summary`))).click();
  const auraLedger = page.locator(`#weaponProcAudit [data-weapon-proc-aura="${trigger.id}"]`);
  await expect(auraLedger).toContainText("冰附着 Cryo 无");
  await expect(auraLedger).toContainText("实际选中倍率 1.4");
  await expect(auraLedger).toContainText("范围内其他目标不会分别重选倍率");
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-random="${trigger.id}"]`)).toContainText(String(trigger.random!.roll));
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-hit-detail="${nearby.id}"] > summary`))).click();
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-replay="${nearby.id}"]`)).toContainText("差值 0");
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${nearby.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(sourceTrace.length).toBeGreaterThan(0);
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })))).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(nearby.id);
  expect(captured.sourceResult).toEqual(result);
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "random-weapon-nearby-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");

  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "random-weapon-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.options.randomSeed);
  const replayed = await downloadSimulationRecord(page);
  expect(replayed.sourceConfig).toEqual(record.sourceConfig);
  expect(replayed.options).toEqual(record.options);
  expect(replayed.result).toEqual(result);

  await (await revealControl(page.getByRole("button", { name: "总览", exact: true }))).click();
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
    version: "named-rng-state-v1", streams: { weaponProc: { drawCount: startup.result!.weaponProcLog!
      .filter(row => row.frame < checkpoint.tick && row.random?.drawIndex !== null && row.random?.drawIndex !== undefined).length } },
  } });
  expect(startup.steadyState!.status).toBe("not-established");
  expect(startup.steadyState!.reasons.join(" ")).toContain("随机状态已捕获不等于分布收敛");

  // Two short runs only: validate the real batch metadata, not statistical convergence or gcsim RNG parity.
  await (await revealControl(page.locator("#iterationInput"))).fill("2");
  await (await revealControl(page.locator("#runButton"))).click();
  await waitForSimulation(page);
  const batch = await downloadSimulationRecord(page);
  expect(batch.iterations).toBe(2);
  expect(batch.batchSummary).toMatchObject({ iterations: 2, seed: config.randomSeed,
    rngPolicy: "seeded-particles-and-declared-independent-streams-v1",
    weaponProcPolicy: { id: "gcsim-random-weapon-proc-v1", rngStream: "independent-weapon-proc-v1",
      rngAlgorithm: "fnv1a32-mulberry32-v1", matchesGcsimRandomSequence: false },
    meanDamage: 1900, meanConfidenceInterval: null });
  expect(batch.result.resolvedRuntimeOptions.randomSeed).toBe(`${config.randomSeed}:iteration:0`);
  expect(batch.batchSummary.warnings.join(" ")).toContain("不认证随机稳态");
  console.info("Random weapon proc browser measurements", JSON.stringify({ totalDamage: result.totalDamage, childDamage,
    triggerFrame: trigger.frame, deliveryFrame: trigger.damageFrame, callbackSequence: trigger.eventSequence, fireSequence: fire.eventSequence,
    coefficient: trigger.coefficient, triggerAura: trigger.triggerAura, random: trigger.random, replayDifference: 0,
    startupStatus: startup.status, checkpointComplete: startup.result!.executionAudit!.checkpointCoverage.complete,
    batchIterations: batch.iterations, batchRngPolicy: batch.batchSummary.rngPolicy, batchWeaponPolicy: batch.batchSummary.weaponProcPolicy }));
});
