import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";
import type { SimulationRecord } from "../src/simulation-record";

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

function editableParty(): SimConfig {
  return makeConfig({
    duration: 8, cycleLength: 8, randomSeed: "composable-source-ui-v1",
    dataVersion: "synthetic-composable-source-ui-v1",
    meta: { name: "可编辑面板组合来源 Q", version: "synthetic-composable-source-ui-v1", verificationStatus: "user-supplied",
      note: "两位用户角色的中性合成面板；单个静止、始终在范围内且初始未附着的目标。来源身份和能力通过队伍页明确绑定，不是游戏实测构筑。" },
    enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: [{ id: "enemy-0", name: "明确合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    characters: [
      { id: "z", name: "用户面板 Z", element: "geo", color: "#a88946", level: 90, energyMax: 40, initialEnergy: 7,
        stats: { ...neutralStats, baseAtk: 1200, baseHp: 20000, critRate: 0.1, critDmg: 1 } },
      { id: "k", name: "用户面板 K", element: "electro", color: "#9868ba", level: 90, energyMax: 40, initialEnergy: 11,
        stats: { ...neutralStats, critRate: 0.1, critDmg: 1 } },
    ],
  });
}

async function addBinding(page: Page, actorId: string, slug: string, sourceLabel: string,
  abilityId: string, talent: number, ascension: number): Promise<void> {
  const host = page.locator(`[data-source-action-actor="${actorId}"]`);
  // Slugs and visible labels are the explicit identities in source-ability-registry.ts, not inferred from actor names.
  await host.locator("[data-source-character]").selectOption(slug);
  await host.locator("[data-source-action]").selectOption(`${slug}-q`);
  await expect(host.locator("[data-source-action-description]")).toContainText(sourceLabel);
  await host.locator("[data-source-talent]").fill(String(talent));
  await host.locator("[data-source-ascension]").fill(String(ascension));
  await host.locator("[data-source-constellation]").selectOption("0");
  await host.locator("[data-source-ability-id]").fill(abilityId);
  await host.locator("[data-source-add]").click();
  await expect(page.locator(`[data-source-binding="${abilityId}"]`)).toContainText(sourceLabel);
}

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("editable party binds two sourced bursts, executes real energy and swaps, and restores the same sourced hit and full JSON", async ({ page }) => {
  const original = editableParty();
  await page.goto("/results");
  await page.locator("#critModeInput").selectOption("average");
  await page.locator("#energyModeInput").selectOption("configured");
  await page.locator("#iterationInput").fill("1");
  await page.locator("#importInput").setInputFiles({ name: "editable-source-party.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(original)) });
  await expect(page.locator("#notice")).toContainText(original.meta.name);
  await waitForSimulation(page);
  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.locator("#team-source-action-controls")).toBeVisible();
  expect((await page.evaluate(() => window.GenshinDpsLab.getConfig())).timeline).toBeUndefined();
  await page.locator("#source-timeline-active").selectOption("z");
  await page.locator("#source-timeline-swap").fill("1");
  await page.locator("#source-timeline-create").click();
  await expect(page.locator("#source-action-status")).toContainText("空时间线草稿");
  await page.locator("#source-adopt-rules").click();
  await addBinding(page, "z", "zhongli", "钟离 · 天星", "z-q", 1, 3);
  await addBinding(page, "k", "keqing", "刻晴 · 天街巡游", "k-q", 2, 4);
  // Edit an existing binding through the same ordinary form, enabling Zhongli's A4 explicitly.
  await page.locator('[data-source-edit="z-q"]').click();
  const z = page.locator('[data-source-action-actor="z"]');
  await z.locator("[data-source-talent]").fill("2");
  await z.locator("[data-source-ascension]").fill("4");
  await z.locator("[data-source-add]").click();
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("来源能力已保存");
  const bound = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(bound.characters).toEqual(original.characters);
  expect(bound.timeline).toMatchObject({ mode: "legal-frame-v1", initialActiveCharacterId: "z", swapFrames: 1, commands: [] });
  expect(bound.timeline!.abilities).toHaveLength(2);
  expect(bound.sourceAbilityBindings).toHaveLength(2);
  expect(bound.sourceAbilityBindings).toEqual(expect.arrayContaining([
    { actorId: "k", sourceActionId: "keqing-q", abilityId: "k-q", talentLevel: 2, ascension: 4, constellation: 0, registryVersion: "gcsim-b4ae769-composable-abilities-v1" },
    { actorId: "z", sourceActionId: "zhongli-q", abilityId: "z-q", talentLevel: 2, ascension: 4, constellation: 0, registryVersion: "gcsim-b4ae769-composable-abilities-v1" },
  ]));
  expect(bound.reactionEngine).toMatchObject({ mode: "aura-v3", debugAllowReactionOverride: false });
  expect(bound.targetClockModel).toEqual({ mode: "disabled" });
  expect(bound.elementalApplicationIcdModel.mode).toBe("fixed-gcsim-elemental-application-v1");
  expect(bound.directDamageGroupModel.mode).toBe("fixed-gcsim-direct-damage-group-v1");
  await expect(page.locator('[data-actor="0"][data-key="initialEnergy"]')).toHaveValue("7");
  await expect(page.locator('[data-actor="1"][data-key="initialEnergy"]')).toHaveValue("11");
  for (const index of [0, 1]) {
    await expect(page.locator(`[data-actor="${index}"][data-key="energyMax"]`)).toHaveValue("40");
    await page.locator(`[data-actor="${index}"][data-key="initialEnergy"]`).fill("40");
  }
  await page.locator('[data-actor="1"][data-stat="baseAtk"]').fill("1100");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const ready = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(ready.sourceAbilityBindings).toEqual(bound.sourceAbilityBindings);
  expect(ready.characters).toEqual([
    { ...original.characters[0]!, initialEnergy: 40 },
    { ...original.characters[1]!, initialEnergy: 40, stats: { ...original.characters[1]!.stats, baseAtk: 1100 } },
  ]);

  await page.locator('.product-nav a[href="/rotation"]').click();
  await expect(page).toHaveURL(/\/rotation$/);
  await page.locator("#rotation-dsl").fill("at 0f action z-q\nat 150f swap k\nat 160f action k-q");
  await page.locator("#rotation-parse").click();
  await expect(page.locator("#rotation-status")).toContainText("DSL 已展开");
  await expect(page.locator("#rotation-list li")).toHaveCount(3);
  await page.locator("#rotation-save").click();
  await expect(page).toHaveURL(/\/results$/);
  await waitForSimulation(page);
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.options).toMatchObject({ critMode: "average", energyMode: "configured" });
  expect(record.sourceConfig.characters).toEqual(ready.characters);
  expect(record.sourceConfig.sourceAbilityBindings).toEqual(bound.sourceAbilityBindings);
  expect(record.sourceConfig.timeline!.commands).toEqual([
    { type: "burst", actorId: "z", abilityId: "z-q", atFrame: 0 },
    { type: "swap", characterId: "k", atFrame: 150 },
    { type: "burst", actorId: "k", abilityId: "k-q", atFrame: 160 },
  ]);
  expect(record.result.skippedActions).toEqual([]);
  expect(record.result.timelineExecution!.failures).toEqual([]);
  expect(record.result.timelineExecution!.adjustments).toEqual([]);
  expect(record.result.timelineExecution!.finalActiveCharacterId).toBe("k");
  expect(record.result.timelineExecution!.commandResults[1]).toMatchObject({ commandType: "swap", requestedFrame: 150, startFrame: 150, endFrame: 151, status: "executed" });
  expect(record.result.energyCostLog!.map(row => [row.operation, row.frame, row.energyCost, row.energyBefore, row.energyAfter, row.reservedBefore, row.reservedAfter])).toEqual([
    ["reserve", 0, 40, 40, 40, 0, 40], ["debit", 7, 40, 40, 0, 40, 0],
    ["reserve", 160, 40, 40, 40, 0, 40], ["debit", 215, 40, 40, 0, 40, 0],
  ]);
  expect(record.result.energyStats.z).toMatchObject({ initial: 40, spent: 40, final: 0 });
  expect(record.result.energyStats.k).toMatchObject({ initial: 40, spent: 40, final: 0 });
  const meteor = record.result.damageEvents.find(event => event.hitId === "z-q-meteor")!;
  const slashes = record.result.damageEvents.filter(event => event.sourceAbilityId === "k-q");
  expect(record.result.damageEvents).toHaveLength(11);
  expect(meteor).toMatchObject({ frame: 101, scaling: 4.4444, scalingValue: 1200, flat: 6600, critRate: 0.1 });
  expect(meteor.finalDamage).toBeCloseTo((1200 * 4.4444 + 20000 * 0.33) * 0.5 * 1.1, 9);
  expect(meteor.flatDetails[0]).toMatchObject({ ownerId: "z", stat: "hp", multiplier: 0.33, sourceValue: 20000, amount: 6600 });
  expect(record.result.sourceSnapshotLog!.find(row => row.id === meteor.flatDetails[0]!.sourceSnapshotLogId)).toMatchObject({ ownerId: "z", relativeFrame: 0, frame: 0, status: "sampled", eventPriority: 12.5, stats: { baseHp: 20000 } });
  expect(slashes.map(event => event.frame)).toEqual([216, 242, 253, 264, 275, 286, 297, 308, 319, 357]);
  for (const event of slashes) {
    const coefficient = event.hitId === "k-q-initial" ? 0.946 : event.hitId === "k-q-final" ? 2.0296 : 0.258;
    expect(event.critRate).toBe(0.25);
    expect(event.statsBeforeDamage.energyRecharge).toBe(1.15);
    expect(event.finalDamage).toBeCloseTo(1100 * coefficient * 0.5 * 1.25, 9);
  }
  expect(record.result.totalDamage).toBeCloseTo(10028.029, 9);
  expect(record.result.dps).toBeCloseTo(1253.503625, 9);
  expect(await downloadJson<SimConfig>(page, "#exportButton")).toEqual(record.sourceConfig);

  await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
  await page.locator(`#hitTableBody tr[data-hit-id="${meteor.id}"]`).click();
  await expect(page.locator("#hitDetail")).toContainText("z-q");
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  await page.locator("#openHitCalculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })))).toEqual(sourceTrace);
  const capture = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(capture.eventId).toBe(meteor.id);
  expect(capture.sourceResult).toEqual(record.result);
  await page.locator("#calc-import").setInputFiles({ name: "source-meteor-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(capture)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");

  await page.locator('.product-nav a[href="/results"]').click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("button", { name: "总览", exact: true }).click();
  await page.locator("#randomSeedInput").fill("discard-this-seed");
  await page.locator("#importInput").setInputFiles({ name: "composable-source-complete-run.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.options.randomSeed);
  await waitForSimulation(page);
  const restored = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.result).toEqual(record.result);
  console.info("Composable source browser measurements", JSON.stringify({ initialEnergyPreserved: [7, 11], burstCosts: [40, 40],
    meteorDamage: meteor.finalDamage, meteorFlatHpContribution: meteor.flat, keqingHitCount: slashes.length,
    totalDamage: record.result.totalDamage, dps: record.result.dps, replayDifference: 0, completeRecordRestored: true }));
});
