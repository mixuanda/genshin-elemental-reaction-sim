import { revealControl, runImportedScenario, downloadSimulationRecord, expectReadonlyRecord } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
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

function syntheticWeaponProcInputs() {
  const actors = [
    { id: "halberd-owner", name: "合成钺矛持有者", hp: 10000, bonus: 0.1 },
    { id: "horn-owner", name: "合成苍纹角杯持有者", hp: 20000, bonus: 0.2 },
    { id: "bow-owner", name: "合成冷寂迸音持有者", hp: 10000, bonus: 0 },
  ];
  return makeConfig({
    dataVersion: "synthetic-independent-weapon-proc-ui-v1", randomSeed: "independent-weapon-proc-ui",
    meta: { name: "合成三武器独立追击验收", version: "synthetic-independent-weapon-proc-ui-v1", verificationStatus: "user-supplied", note: "仅验证明确装备声明的独立追击；角色、面板与动作均为合成输入，不代表真实角色配装。" },
    duration: 2, cycleLength: 2,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "中心目标", position: { x: 0, y: 0 }, hitboxRadius: 0 },
      { id: "edge", name: "三单位边缘", position: { x: 3, y: 0 }, hitboxRadius: 0, resistance: 0.5 },
      { id: "outside", name: "四单位范围外", position: { x: 4, y: 0 }, hitboxRadius: 0 },
    ] },
    characters: actors.map(actor => ({ id: actor.id, name: actor.name, element: "geo" as const, color: "#aa8800", level: 90,
      energyMax: 60, initialEnergy: 0, stats: { ...neutralStats, baseHp: actor.hp, dmgBonus: actor.bonus } })),
    rotation: actors.map((actor, index) => ({ id: `host-${index}`, actorId: actor.id, name: `合成物理宿主 ${index + 1}`, at: index / 2,
      hits: [{ id: `host-hit-${index}`, offset: 0, scaling: 1, element: "physical" as const, critRate: 1, critDmg: 4, dmgBonus: 2, defIgnore: 0.8 }] })),
  });
}

test("Team weapon proc declarations create independent single-target and HP-area hits with complete replay and record restore", async ({ page }) => {
  const config = syntheticWeaponProcInputs();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("seeded-random-v1");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "independent-weapon-procs.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#weaponProcModelEnabled")).not.toBeChecked();
  await (await revealControl(page.locator("#weaponProcModelEnabled"))).check();
  const declarations = [
    { actorId: "halberd-owner", weaponId: "halberd", refinement: 1, physicalDamageBonus: 0.5 },
    { actorId: "horn-owner", weaponId: "ashgravendrinkinghorn", refinement: 1, physicalDamageBonus: 0.5 },
    { actorId: "bow-owner", weaponId: "sequenceofsolitude", refinement: 5, physicalDamageBonus: 0 },
  ] as const;
  for (const declaration of declarations) {
    await (await revealControl(page.locator(`[data-weapon-proc-weapon="${declaration.actorId}"]`))).selectOption(declaration.weaponId);
    await (await revealControl(page.locator(`[data-weapon-proc-refinement="${declaration.actorId}"]`))).selectOption(String(declaration.refinement));
    await (await revealControl(page.locator(`[data-weapon-proc-physical-bonus="${declaration.actorId}"]`))).fill(String(declaration.physicalDamageBonus));
  }
  await (await revealControl(page.locator("#weaponProcModelControls > details > summary").filter({ hasText: "逐命中攻击标签声明" }))).click();
  for (let index = 0; index < declarations.length; index++) {
    await (await revealControl(page.locator(`[data-weapon-proc-tag][data-proc-action-index="${index}"][data-proc-hit-index="0"]`))).selectOption("normal");
  }
  await (await revealControl(page.locator("#team-apply"))).click();
  await expect(page.locator("#team-status")).toHaveText("队伍配置已应用；请到模拟结果运行。");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.weaponProcModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", actors: declarations });
  expect(saved.characters).toEqual(config.characters);
  expect(saved.rotation.map(action => action.hits?.map(hit => hit.attackTag))).toEqual([["normal"], ["normal"], ["normal"]]);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#runButton"))).click();
  await waitForSimulation(page);
  const record = await downloadSimulationRecord(page);
  expect(record.sourceConfig).toEqual(saved);
  expect(record.options.execution?.criticalSampling).toBe("seeded-random-v1");
  const result = record.result;
  const allDecisions = result.weaponProcLog!;
  expect(allDecisions).toHaveLength(8);
  const decisions = allDecisions.filter(entry => entry.outcome === "triggered");
  expect(decisions).toHaveLength(3);
  expect(decisions.map(entry => [entry.actorId, entry.weaponId, entry.frame, entry.damageFrame, entry.outcome])).toEqual([
    ["halberd-owner", "halberd", 0, 1, "triggered"],
    ["horn-owner", "ashgravendrinkinghorn", 30, 31, "triggered"],
    ["bow-owner", "sequenceofsolitude", 60, 61, "triggered"],
  ]);
  // Independent damage still enters the real callback bus; its tag/cooldown prevents recursive children.
  const rejectedCallbacks = allDecisions.filter(entry => entry.outcome !== "triggered");
  expect(rejectedCallbacks.map(entry => [entry.actorId, entry.frame, entry.attackTag, entry.outcome])).toEqual([
    ["halberd-owner", 1, "proc", "wrong-attack-tag"],
    ["horn-owner", 31, "proc", "cooldown-blocked"], ["horn-owner", 31, "proc", "cooldown-blocked"],
    ["bow-owner", 61, "proc", "cooldown-blocked"], ["bow-owner", 61, "proc", "cooldown-blocked"],
  ]);
  expect(rejectedCallbacks.flatMap(entry => entry.damageEventIds)).toEqual([]);
  const children = result.damageEvents.filter(event => event.weaponProcLogId !== undefined);
  // Source R1/R5 multipliers, independent final panels and L90/90 DEF=0.5; edge physical RES=0.5.
  expect(children.map(event => [event.actorId, event.targetId, event.finalDamage])).toEqual([
    ["halberd-owner", "enemy-0", 1000 * 1.6 * 1.6 * 0.5],
    ["horn-owner", "enemy-0", 20000 * 0.4 * 1.7 * 0.5],
    ["horn-owner", "edge", 20000 * 0.4 * 1.7 * 0.5 * 0.5],
    ["bow-owner", "enemy-0", 10000 * 0.8 * 0.5],
    ["bow-owner", "edge", 10000 * 0.8 * 0.5 * 0.5],
  ]);
  for (const decision of decisions) {
    const parent = result.damageEvents.find(event => event.id === decision.parentDamageEventId)!;
    expect(decision.attackTag).toBe("normal");
    expect(parent.weaponProcLogId).toBeUndefined();
    expect(parent.critRate).toBe(1);
    expect(parent.critDmg).toBe(0.5 + 4); // Host-specific additive crit damage is on top of its panel.
    expect(result.executionAudit!.hits.find(hit => hit.eventId === parent.id)!.critical.outcome).toBe("critical");
    const expectedTargets = decision.weaponId === "halberd" ? ["enemy-0"] : ["enemy-0", "edge"];
    expect(decision.radius).toBe(decision.weaponId === "halberd" ? null : 3);
    expect(decision.damageEventIds.map(id => result.damageEvents.find(event => event.id === id)!.targetId)).toEqual(expectedTargets);
    for (const eventId of decision.damageEventIds) {
      const child = result.damageEvents.find(event => event.id === eventId)!;
      expect(child).toMatchObject({ kind: "direct", element: "physical", weaponProcLogId: decision.id, parentDamageEventId: parent.id,
        frame: parent.frame + 1, critRate: 0, critDmg: 0.5, defIgnore: 0 });
      expect(child.statsBeforeDamage).toEqual(decision.triggerSnapshot);
      expect(result.executionAudit!.hits.find(hit => hit.eventId === child.id)!.critical.outcome).toBe("noncritical");
    }
    if (decision.weaponId !== "halberd") {
      expect(decision.hitResolutionIds).toHaveLength(3);
      const outside = decision.hitResolutionIds.map(id => result.hitResolutionLog.find(resolution => resolution.id === id)!).find(resolution => resolution.targetId === "outside")!;
      expect(outside).toMatchObject({ landed: false, damageEventId: null });
    }
  }
  expect(children.map(event => [event.scalingStat, event.scalingValue, event.dmgBonus])).toEqual([
    ["atk", 1000, 0.6], ["hp", 20000, 0.7], ["hp", 20000, 0.7], ["hp", 10000, 0], ["hp", 10000, 0],
  ]);

  await (await revealControl(page.getByRole("button", { name: "时间轴", exact: true }))).click();
  await expect(page.locator("#weaponProcAudit [data-weapon-proc-id]")).toHaveCount(8);
  const horn = decisions[1]!;
  const edgeHit = children.find(event => event.actorId === "horn-owner" && event.targetId === "edge")!;
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-detail="${horn.id}"] > summary`))).click();
  await (await revealControl(page.locator(`#weaponProcAudit [data-weapon-proc-hit-detail="${edgeHit.id}"] > summary`))).click();
  await expect(page.locator(`#weaponProcAudit [data-weapon-proc-replay="${edgeHit.id}"]`)).toContainText("差值 0");
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator(`#hitTableBody tr[data-hit-id="${edgeHit.id}"]`))).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(sourceTrace.length).toBeGreaterThan(0);
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const restoredTrace = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(restoredTrace).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(edgeHit.id);
  expect(captured.sourceResult).toEqual(result);

  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#randomSeedInput"))).fill("discard-this-seed");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "independent-weapon-proc-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record.wire)) });
  await expectReadonlyRecord(page, record);
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.options.randomSeed);
  const replayed = await downloadSimulationRecord(page);
  expect(replayed.sourceConfig).toEqual(record.sourceConfig);
  expect(replayed.options).toEqual(record.options);
  expect(replayed.result).toEqual(record.result);

  await (await revealControl(page.locator('.product-nav a[href="/team"]'))).click();
  await expect(page.locator("#weaponProcModelEnabled")).toBeChecked();
  await (await revealControl(page.locator("#weaponProcModelEnabled"))).uncheck();
  await (await revealControl(page.locator("#team-apply"))).click();
  const disabled = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  const { weaponProcModel: _removed, ...withoutProcModel } = record.sourceConfig;
  expect(disabled).toEqual(withoutProcModel);
  await (await revealControl(page.locator('.product-nav a[href="/results"]'))).click();
  await (await revealControl(page.locator("#runButton"))).click();
  await waitForSimulation(page);
  const legacyShape = await downloadSimulationRecord(page);
  expect(legacyShape.sourceConfig.weaponProcModel).toBeUndefined();
  expect(legacyShape.result.weaponProcLog).toBeUndefined();
  expect(legacyShape.result.damageEvents).toHaveLength(3);
  expect(legacyShape.result.damageEvents.every(event => event.weaponProcLogId === undefined)).toBe(true);
});
