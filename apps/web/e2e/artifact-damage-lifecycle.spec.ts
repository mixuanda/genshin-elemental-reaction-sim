import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import type { CapturedSimulationHit } from "@genshin-dps-lab/sim-core";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";
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

const normalFrames = [1, 31, 61, 91, 121, 361, 373, 385, 397, 409, 421];

function declaredArtifactInputs(): SimConfig {
  // These are explicit synthetic host actions and panels, not a claim about any character's skill.
  // The actual fixed-source artifact lifecycle is enabled only through the ordinary team page.
  return makeConfig({
    duration: 8, cycleLength: 8, randomSeed: "artifact-lifecycle-browser-v1",
    dataVersion: "synthetic-artifact-lifecycle-ui-v1",
    meta: { name: "合成机制验证：余响与昔时之歌的实际生命周期", version: "synthetic-artifact-lifecycle-ui-v1", verificationStatus: "user-supplied",
      note: "中性面板与普攻均为显式合成条件；治疗由使用者在队伍页填写。只验证固定来源圣遗物的实际回调与还原，不代表真实角色技能或游戏实测。" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成单目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "declared-condition", actorId: "a", name: "显式自定义条件动作", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0 },
        { id: "declared-normal", actorId: "a", name: "显式合成普通攻击", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "normal-host", frame: 0, scaling: 1, element: "physical", attackTag: "normal", snapshot: "hit",
            targeting: { targetId: "enemy-0", outcome: "landed" } }] },
      ],
      commands: [{ type: "skill", actorId: "a", abilityId: "declared-condition", atFrame: 0 },
        ...normalFrames.map(atFrame => ({ type: "normal" as const, actorId: "a", abilityId: "declared-normal", atFrame }))],
    },
  });
}

async function replayHostHit(page: Page, record: SimulationRecord, eventId: number): Promise<void> {
  await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
  await page.locator(`#hitTableBody tr[data-hit-id="${eventId}"]`).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent,
  })));
  expect(sourceTrace.some(row => row.id === "artifact.flat.0")).toBe(true);
  await page.locator("#openHitCalculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent,
  })))).toEqual(sourceTrace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.eventId).toBe(eventId);
  expect(captured.sourceResult).toEqual(record.result);
  await page.locator("#calc-import").setInputFiles({ name: "artifact-host-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await page.locator('.product-nav a[href="/results"]').click();
}

// Keep the actual browser actions; avoid serializing complete execution records into every DOM snapshot.
test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Normal team controls execute Echoes and Song lifecycles, explain actual host additions, and restore calculator and full-run JSON", async ({ page }) => {
  const config = declaredArtifactInputs();
  await page.goto("/results");
  await page.locator("#critModeInput").selectOption("noCrit");
  await page.locator("#iterationInput").fill("1");
  await page.locator("#importInput").setInputFiles({ name: "artifact-lifecycle.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page.locator("#artifact-damage-enabled")).not.toBeChecked();
  await page.locator("#artifact-damage-enabled").check();
  await page.locator('[data-artifact-damage-actor="a"]').selectOption("echoes-4pc");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const echoesConfig = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(echoesConfig.artifactDamageModel).toEqual({ mode: "gcsim-b4ae769-artifact-damage-v1", actors: [{ actorId: "a", effectId: "echoes-4pc" }] });
  expect(echoesConfig.characters).toEqual(config.characters);
  await page.locator('.product-nav a[href="/results"]').click();
  await page.locator("#runButton").click();
  await waitForSimulation(page);
  const echoes = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(echoes.sourceConfig).toEqual(echoesConfig);
  expect(echoes.result.skippedActions).toEqual([]);
  const echoesRows = echoes.result.artifactDamageLog!;
  expect(echoesRows).toHaveLength(normalFrames.length);
  expect(echoesRows.map(row => row.frame)).toEqual(normalFrames);
  const successfulEchoes = echoesRows.filter(row => row.outcome === "rite-triggered");
  // The failure threshold increases by .2, so these eleven eligible, separated callbacks include a success.
  expect(successfulEchoes.length).toBeGreaterThan(0);
  for (const row of echoesRows) {
    expect(row).toMatchObject({ kind: "enemy-hit", actorId: "a", effectId: "echoes-4pc", currentAttack: 1000, attackTag: "normal" });
    expect(row.random!.roll).toBeGreaterThanOrEqual(0);
    expect(row.random!.roll).toBeLessThan(1);
    expect(row.outcome).toBe(row.random!.roll <= row.random!.probability ? "rite-triggered" : "roll-failed");
    expect(row.flatDamage).toBe(row.outcome === "rite-triggered" ? 1000 * 0.7 : 0);
    const host = echoes.result.damageEvents.find(event => event.id === row.parentDamageEventId)!;
    expect(host.finalDamage).toBe((1000 + row.flatDamage) * 0.5);
  }
  expect(echoes.result.totalDamage).toBe(normalFrames.length * 500 + successfulEchoes.length * 350);
  expect(echoes.result.artifactDamageState!.random!.drawCount).toBe(normalFrames.length);
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  await expect(page.locator("#artifactDamageAudit [data-artifact-damage-log-id]")).toHaveCount(normalFrames.length);
  const firstEchoes = successfulEchoes[0]!;
  const echoesDetail = page.locator(`#artifactDamageAudit [data-artifact-damage-detail="${firstEchoes.id}"]`);
  await echoesDetail.locator(":scope > summary").click();
  await expect(echoesDetail.locator("[data-artifact-damage-formula]")).toContainText("700");
  await expect(echoesDetail.locator("[data-artifact-damage-formula]")).toContainText("0.7");
  await replayHostHit(page, echoes, firstEchoes.parentDamageEventId!);

  // Change only the artifact and explicit healing condition through normal product controls.
  await page.locator('.product-nav a[href="/team"]').click();
  await page.locator('[data-artifact-damage-actor="a"]').selectOption("song-of-days-past-4pc");
  await page.locator("#team-health-enabled").check();
  await page.locator("#team-health-example").click();
  await expect(page.locator("#team-health-condition-note")).toContainText("合成情景假设");
  await page.getByText("逐行动治疗、生命消耗与生命之契", { exact: true }).click();
  const action = page.locator('[data-health-action="0"]');
  await action.locator('[data-health-add="heal"]').click();
  const healing = action.locator("[data-health-change]");
  await healing.locator("[data-hp-label]").fill("用户显式15000请求治疗：满血仍记录");
  await healing.locator("[data-hp-frame]").fill("0");
  await healing.locator("[data-hp-target]").selectOption("self");
  await healing.locator("[data-hp-basis]").selectOption("fixed");
  await healing.locator("[data-hp-amount]").fill("15000");
  await healing.locator("[data-hp-healing-bonus]").fill("0");
  await healing.locator("[data-hp-incoming-bonus]").fill("0");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const songConfig = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(songConfig.artifactDamageModel).toEqual({ mode: "gcsim-b4ae769-artifact-damage-v1", actors: [{ actorId: "a", effectId: "song-of-days-past-4pc" }] });
  expect(songConfig.characters).toEqual(config.characters);
  expect(songConfig.timeline!.abilities[0]!.healthChanges).toMatchObject([{ operation: "heal", frameOffset: 0,
    amount: { basis: "fixed", value: 15000 }, healingBonus: 0, incomingHealingBonus: 0, source: { kind: "custom" } }]);
  await page.locator('.product-nav a[href="/results"]').click();
  expect(await downloadJson<SimConfig>(page, "#exportButton")).toEqual(songConfig);
  await page.locator("#runButton").click();
  await waitForSimulation(page);
  const song = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(song.sourceConfig).toEqual(songConfig);
  expect(song.result.skippedActions).toEqual([]);
  const songRows = song.result.artifactDamageLog!;
  const recordedHealing = songRows.find(row => row.outcome === "recorded-healing")!;
  const conversion = songRows.find(row => row.outcome === "waves-created")!;
  const consumed = songRows.filter(row => row.outcome === "waves-consumed");
  expect(recordedHealing).toMatchObject({ frame: 0, requestedHealing: 15000,
    stateBefore: { song: { healingPool: 0 } }, stateAfter: { song: { healingPool: 15000, yearningExpiresFrame: 360 } } });
  expect(song.result.playerHealthEvents!.find(event => event.id === recordedHealing.playerHealthEventId)).toMatchObject({
    frame: 0, operation: "heal", requestedAmount: 15000, actualChange: 0, overheal: 15000, hpBefore: 10000, hpAfter: 10000,
  });
  expect(conversion).toMatchObject({ frame: 360, parentLogId: recordedHealing.id,
    stateAfter: { song: { healingPool: 0, waveHealing: 15000, wavesExpiresFrame: 960, charges: 5 } } });
  expect(consumed.map(row => [row.frame, row.flatDamage, row.stateBefore.song.charges, row.stateAfter.song.charges])).toEqual([
    [361, 1200, 5, 4], [373, 1200, 4, 3], [385, 1200, 3, 2], [397, 1200, 2, 1], [409, 1200, 1, 0],
  ]);
  expect(songRows.find(row => row.frame === 421)).toMatchObject({ outcome: "waves-inactive", flatDamage: 0 });
  expect(song.result.damageEvents.map(event => [event.frame, event.finalDamage])).toEqual(normalFrames.map(frame => [frame, frame >= 361 && frame <= 409 ? 1100 : 500]));
  expect(song.result.totalDamage).toBe(8500);
  expect(song.result.artifactDamageState).toMatchObject({ state: { song: { waveHealing: 15000, charges: 0, wavesExpiresFrame: 0 } } });
  expect(song.result.artifactDamageState!.random).toBeUndefined();
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  await expect(page.locator("#artifactDamageAudit [data-artifact-damage-log-id]")).toHaveCount(13);
  const songDetail = page.locator(`#artifactDamageAudit [data-artifact-damage-detail="${consumed[0]!.id}"]`);
  await songDetail.locator(":scope > summary").click();
  await expect(songDetail.locator("[data-artifact-damage-formula]")).toContainText("0.08");
  await expect(songDetail.locator("[data-artifact-damage-formula]")).toContainText(/1,?200/);
  await replayHostHit(page, song, consumed[0]!.parentDamageEventId!);

  await page.locator("#randomSeedInput").fill("discard-this-seed");
  await page.locator("#importInput").setInputFiles({ name: "artifact-lifecycle.complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(song)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(song.options.randomSeed);
  await waitForSimulation(page);
  const restored = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(restored.sourceConfig).toEqual(song.sourceConfig);
  expect(restored.options).toEqual(song.options);
  expect(restored.result).toEqual(song.result);
  console.info("Artifact lifecycle browser measurements", JSON.stringify({ echoesDraws: echoesRows.length,
    echoesSuccesses: successfulEchoes.length, echoesDamage: echoes.result.totalDamage, songRequestedHealing: recordedHealing.requestedHealing,
    songConversionFrame: conversion.frame, songConsumedFrames: consumed.map(row => row.frame), songDamage: song.result.totalDamage,
    hostReplayDifference: 0, fullRunRestored: true }));
});
