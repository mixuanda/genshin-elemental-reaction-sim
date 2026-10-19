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

function declaredInputs(): SimConfig {
  // The panels, zero-cost Q and incoming damage are explicit synthetic inputs.
  // The actual shield and Noblesse models are enabled only through normal team controls.
  return makeConfig({
    duration: 2, cycleLength: 2, randomSeed: "shield-noblesse-browser-v1", dataVersion: "synthetic-shield-noblesse-ui-v1",
    meta: { name: "合成条件：通用玩家盾与实际宗室窗口", version: "synthetic-shield-noblesse-ui-v1", verificationStatus: "user-supplied",
      note: "用户声明的中性面板、零能量费用Q和已结算来袭伤害；不代表真实角色技能、敌人攻击或游戏实测。" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成单目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    characters: [
      { id: "a", name: "合成持有者甲", element: "pyro", color: "#dd4444", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
      { id: "b", name: "合成队友乙", element: "hydro", color: "#4488dd", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
    ],
    reactionEngine: { mode: "aura-v3" },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "declared-q", actorId: "a", name: "显式零费用合成爆发", kind: "burst", energyCost: 0, cooldownFrames: 0, cancelFrame: 2, animationEndFrame: 2,
          hits: [{ id: "q-hit", frame: 1, scaling: 1, element: "physical", attackTag: "burst", snapshot: "hit", targeting: { targetId: "enemy-0", outcome: "landed" } }] },
        { id: "declared-normal", actorId: "b", name: "显式合成队友普攻", kind: "normal", cooldownFrames: 0, cancelFrame: 2, animationEndFrame: 2,
          hits: [{ id: "normal-hit", frame: 1, scaling: 1, element: "physical", attackTag: "normal", snapshot: "hit", targeting: { targetId: "enemy-0", outcome: "landed" } }] },
      ],
      commands: [{ type: "burst", actorId: "a", abilityId: "declared-q", atFrame: 0 },
        { type: "swap", characterId: "b", atFrame: 10 },
        { type: "normal", actorId: "b", abilityId: "declared-normal", atFrame: 20 }],
    },
  });
}

// One deterministic product flow; no artifact matrix or additional load experiment.
test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

test("Normal team controls execute a generic player shield and Noblesse, retain actual traces, and restore hit and full-run JSON", async ({ page }) => {
  const config = declaredInputs();
  await page.goto("/results");
  await page.locator("#critModeInput").selectOption("noCrit");
  await page.locator("#iterationInput").fill("1");
  await page.locator("#importInput").setInputFiles({ name: "shield-noblesse.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  const baseline = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  // Independent oracle: 1000 ATK × 1 talent × .5 DEF × 1 RES × 1 noncrit.
  expect(baseline.result.damageEvents.map(event => [event.frame, event.finalDamage])).toEqual([[1, 500], [21, 500]]);
  expect(baseline.result.totalDamage).toBe(1000);

  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page.locator("#artifact-buff-enabled")).not.toBeChecked();
  await page.locator("#artifact-buff-enabled").check();
  await page.locator('[data-artifact-buff-actor="a"]').selectOption("noblesse-4pc");
  await page.locator('[data-artifact-noblesse-delay="a"]').selectOption("0");
  await page.locator("#team-health-enabled").check();
  await page.locator("#team-health-example").click();
  await expect(page.locator("#team-health-condition-note")).toContainText("合成情景假设");
  await page.locator("#team-player-shield-enabled").check();

  await page.locator('[data-player-shield-add="grant"]').click();
  const grant = page.locator('[data-player-shield-kind="grant"]');
  await grant.locator("[data-shield-frame]").fill("0");
  await grant.locator("[data-shield-source-note]").fill("用户明确合成盾：1000原始盾量，不代表角色技能");
  await grant.locator("[data-shield-label]").fill("合成火盾1000");
  await grant.locator("[data-shield-owner]").selectOption("a");
  await grant.locator("[data-shield-type]").fill("synthetic-pyro-shield");
  await grant.locator("[data-shield-element]").selectOption("pyro");
  await grant.locator("[data-shield-target]").selectOption("actor:a");
  await grant.locator("[data-shield-flat]").fill("1000");
  await grant.locator("[data-shield-stat]").selectOption("");
  await grant.locator("[data-shield-duration]").fill("90");

  await page.locator('[data-player-shield-add="incoming-hit"]').click();
  const incoming = page.locator('[data-player-shield-kind="incoming-hit"]');
  await incoming.locator("[data-shield-frame]").fill("60");
  await incoming.locator("[data-shield-source-note]").fill("用户明确交盾前已结算3000火伤，不再套用敌人攻击公式");
  await incoming.locator("[data-shield-target]").selectOption("actor:a");
  await incoming.locator("[data-shield-element]").selectOption("pyro");
  await incoming.locator("[data-shield-incoming]").fill("3000");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const edited = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(edited.characters).toEqual(config.characters);
  expect(edited.artifactBuffModel).toEqual({ mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", effectId: "noblesse-4pc", noblesseSelfDelayFrames: 0 }] });
  expect(edited.playerShieldModel).toMatchObject({ mode: "gcsim-b4ae769-template-v1", events: [
    { kind: "grant", frame: 0, ownerId: "a", element: "pyro", target: { kind: "actor", actorId: "a" }, hp: { flat: 1000 }, durationFrames: 90 },
    { kind: "incoming-hit", frame: 60, target: { kind: "actor", actorId: "a" }, element: "pyro", incomingDamage: 3000 },
  ] });
  await page.locator('.product-nav a[href="/results"]').click();
  expect(await downloadJson<SimConfig>(page, "#exportButton")).toEqual(edited);
  await page.locator("#runButton").click();
  await waitForSimulation(page);
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.sourceConfig).toEqual(edited);
  expect(record.result.skippedActions).toEqual([]);
  expect(record.result.damageEvents.map(event => [event.sourceActorId, event.frame, event.scalingValue, event.finalDamage])).toEqual([
    ["a", 1, 1200, 600], ["b", 21, 1200, 600],
  ]);
  // Noblesse: 1000 × (1 + .2) × 1 × .5 = 600 for each recipient.
  expect(record.result.totalDamage).toBe(1200);
  expect(record.result.dps).toBe(600);
  const noblesse = record.result.artifactBuffLog!.find(row => row.event.kind === "burst" && row.actorId === "a")!;
  expect(noblesse).toMatchObject({ frame: 0, effectId: "noblesse-4pc", outcome: "applied" });
  expect(noblesse.applications.map(row => [row.receiverId, row.stat, row.value, row.startFrame, row.expiresFrame])).toEqual([
    ["a", "atkPct", 0.2, 0, 720], ["b", "atkPct", 0.2, 0, 720],
  ]);

  const shieldHit = record.result.playerShieldLog!.find(row => row.operation === "incoming-hit")!;
  // Fixed source template: equal pyro element gives 2.5 absorption, no strength bonus.
  // 1000 × 2.5 = 2500 capacity; 3000 - 2500 = 500 loss; 10000 - 500 = 9500 HP.
  expect(shieldHit).toMatchObject({ frame: 60, targetActorId: "a", activeCharacterId: "b", incomingDamage: 3000,
    incomingElement: "pyro", strengthBonus: 0, absorbedDamage: 2500, damageAfterShield: 500,
    hpResolution: { currentHpBefore: 10000, currentHpAfter: 9500, actualLoss: 500, overkill: 0 } });
  expect(shieldHit.shieldDetails).toHaveLength(1);
  expect(shieldHit.shieldDetails[0]!).toMatchObject({ hpBefore: 1000, absorptionMultiplier: 2.5, effectiveAbsorptionMultiplier: 2.5,
    capacity: 2500, hpAfter: 0, absorbedDamage: 2500, damageAfterShield: 500, broken: true });
  expect(shieldHit.callbacks.map(row => [row.kind, row.reason])).toEqual([["OnShieldBreak", "damage"]]);
  expect(record.result.playerShieldState!.shields).toEqual([]);

  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  const noblesseDetail = page.locator(`#artifactBuffAudit [data-artifact-buff-details="${noblesse.id}"]`);
  await noblesseDetail.locator(":scope > summary").click();
  await expect(noblesseDetail.locator('[data-artifact-buff-trace] tr[data-trace-node="artifact.buff.noblesse"]')).toContainText("0.2");
  const shieldDetail = page.locator(`#playerShieldAudit [data-player-shield-detail="${shieldHit.id}"]`);
  await shieldDetail.locator(":scope > summary").click();
  await expect(shieldDetail.locator('[data-player-shield-formula] tr[data-trace-node="shield.hp.currentHpAfter"]')).toContainText(/9,?500/);
  await expect(shieldDetail.locator("[data-player-shield-hp]")).toContainText(/9,?500/);
  await expect(shieldDetail.locator("[data-player-shield-callbacks]")).toContainText("OnShieldBreak");

  const hit = record.result.damageEvents[0]!;
  await page.getByRole("button", { name: "逐段伤害", exact: true }).click();
  await page.locator(`#hitTableBody tr[data-hit-id="${hit.id}"]`).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const trace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent,
  })));
  expect(trace.length).toBeGreaterThan(0);
  await page.locator("#openHitCalculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({
    id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent,
  })))).toEqual(trace);
  const captured = await downloadJson<CapturedSimulationHit>(page, '[data-action="export"]');
  expect(captured.sourceResult).toEqual(record.result);
  await page.locator("#calc-import").setInputFiles({ name: "noblesse.actual-hit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(captured)) });
  await expect(page.getByTestId("replay-difference")).toHaveText("0");

  await page.locator('.product-nav a[href="/results"]').click();
  await page.locator("#randomSeedInput").fill("discard-this-seed");
  await page.locator("#importInput").setInputFiles({ name: "shield-noblesse.complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.options.randomSeed);
  await waitForSimulation(page);
  const restored = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.result).toEqual(record.result);
  console.info("Shield and artifact buff browser measurements", JSON.stringify({
    baselineDamage: baseline.result.totalDamage, noblesseDamage: record.result.totalDamage, noblesseRecipients: noblesse.applications.length,
    shieldAbsorbed: shieldHit.absorbedDamage, shieldPassedThrough: shieldHit.damageAfterShield, playerHp: shieldHit.hpResolution!.currentHpAfter,
    replayDifference: 0, completeRecordRestored: true,
  }));
});
