import { revealControl, runImportedScenario } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { HealthChangeDefinition } from "@genshin-dps-lab/schemas";
import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { makeConfig } from "../../../packages/sim-core/src/__tests__/fixtures";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}
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

test.use({ trace: { mode: "retain-on-failure", snapshots: false } });

async function selectKukiAction(page: Page, label: string, skillId: string): Promise<void> {
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(value!);
  expect((await audit(page)).document.gameContext!.skillId).toBe(skillId);
}

test("Kuki full E and Q variants retain conditioned EM and HP context without requiring a team", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000065");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectKukiAction(page, "完整初击＋8环击", "kuki-skill-c0-complete-cast");
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext!.effectiveTalentLevel).toBe(1);
  await (await revealControl(page.locator("#calc-ascension"))).selectOption("4");
  for (const [field, value] of Object.entries({ atk: 1000, hp: 20000, em: 200, critRate: 0.5, critDamage: 1 })) {
    await (await revealControl(page.locator(`[data-field="build.stats.${field}"]`))).fill(String(value));
  }
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.statsStableAcrossHits"]'))).selectOption("1");
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.ringUninterrupted"]'))).selectOption("1");
  const e0 = await audit(page);
  expect(e0.result.status).toBe("calculated");
  expect(e0.result.hits).toHaveLength(9);
  // T1 source: .75712 ATK initial, eight .2524 ATK rings; A4 adds 25% EM to each actual hit.
  const e0NonCrit = (1000 * (0.75712 + 8 * 0.2524) + 9 * 0.25 * 200) * 0.5 * 0.9;
  expect(e0.result.totals!.nonCritical).toBeCloseTo(e0NonCrit, 9);
  expect(e0.result.totals!.expected).toBeCloseTo(e0NonCrit * 1.5, 9);
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.ringUninterrupted"]'))).selectOption("unknown");
  expect((await audit(page)).result.status).toBe("blocked");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator('[data-hit-id="kuki-skill-c0-complete-cast-initial"]'))).check();
  const initial = await audit(page);
  expect(initial.result.status).toBe("calculated");
  expect(initial.result.totals!.expected).toBeCloseTo((1000 * 0.75712 + 200 * 0.25) * 0.5 * 0.9 * 1.5, 9);
  await expect(page.locator('#calc-results [data-trace-node="customBaseDamage"]')).toContainText("807.12");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.ringUninterrupted"]'))).selectOption("1");
  await (await revealControl(page.locator("#calc-constellation"))).selectOption("2");
  await selectKukiAction(page, "完整初击＋10环击", "kuki-skill-c2-complete-cast");
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.statsStableAcrossHits"]'))).selectOption("1");
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.ringUninterrupted"]'))).selectOption("1");
  const e2 = await audit(page);
  expect(e2.result.status).toBe("calculated");
  expect(e2.result.hits).toHaveLength(11);
  expect(e2.result.totals!.expected).toBeCloseTo((1000 * (0.75712 + 10 * 0.2524) + 11 * 0.25 * 200) * 0.5 * 0.9 * 1.5, 9);

  await selectKukiAction(page, "施放HP≤50%·完整12击", "kuki-burst-low-hp-complete-cast");
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.statsStableAcrossHits"]'))).selectOption("1");
  const ratio = page.locator('[data-field="gameContext.kukiDamage.burstHpRatioAtCast"]');
  await ratio.fill("0.5");
  const low = await audit(page);
  expect(low.result.status).toBe("calculated");
  expect(low.result.hits).toHaveLength(12);
  // The full action adds twelve single-hit coefficients, rather than using a separately rounded display total.
  const qHitNonCrit = 20000 * 0.036048 * 0.5 * 0.9;
  expect(low.result.totals!.nonCritical).toBeCloseTo(12 * qHitNonCrit, 9);
  expect(low.result.totals!.expected).toBeCloseTo(12 * qHitNonCrit * 1.5, 9);
  await ratio.fill("0.5001");
  expect((await audit(page)).result.status).toBe("blocked");
  await ratio.fill("");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator('[data-hit-id="kuki-burst-low-hp-complete-cast-tick-instance-1"]'))).check();
  expect((await audit(page)).result.totals!.expected).toBeCloseTo(qHitNonCrit * 1.5, 9);
  await (await revealControl(page.locator('[data-hit-id="kuki-burst-low-hp-complete-cast-tick-instance-8"]'))).check();
  expect((await audit(page)).result.status).toBe("blocked");
  await ratio.fill("0.5");
  expect((await audit(page)).result.totals!.expected).toBeCloseTo(qHitNonCrit * 1.5, 9);
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  const beforeExport = await audit(page);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "kuki-low-hp-complete-q.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(beforeExport.document.gameContext);
  expect(restored.result.totals).toEqual(low.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(beforeExport.result.hits.map(hit => hit.trace));
  await selectKukiAction(page, "施放HP＞50%·完整7击", "kuki-burst-high-hp-complete-cast");
  await (await revealControl(page.locator('[data-kuki-state-field="gameContext.kukiDamage.statsStableAcrossHits"]'))).selectOption("1");
  await ratio.fill("0.5001");
  const high = await audit(page);
  expect(high.result.status).toBe("calculated");
  expect(high.result.hits).toHaveLength(7);
  expect(high.result.totals!.expected).toBeCloseTo(7 * qHitNonCrit * 1.5, 9);
});

function delayedHealthFixture() {
  const source = { kind: "custom" as const, note: "合成延迟任务，明确生命量及帧；不代表角色技能或全队机制。" };
  const changes: HealthChangeDefinition[] = [
    { id: "consume", label: "边界固定消耗", frameOffset: 359, target: { kind: "self" }, source,
      operation: "consume", amount: { basis: "fixed", value: 1000 }, minimumHpRatio: 0.2 },
    { id: "heal", label: "下一帧固定治疗", frameOffset: 360, target: { kind: "self" }, source,
      operation: "heal", amount: { basis: "fixed", value: 1000 }, healingBonus: 0, incomingHealingBonus: 0 },
  ];
  return makeConfig({
    dataVersion: "synthetic-delayed-health-phase-ui-v1",
    meta: { name: "合成机制验证：跨周期生命任务与边界", version: "synthetic-delayed-health-phase-ui-v1", verificationStatus: "provisional", note: source.note },
    duration: 2, cycleLength: 2,
    enemy: { level: 110, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "静止合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5,
      shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: [{ actorId: "a", initialHpRatio: 0.5,
        resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "health", actorId: "a", name: "跨周期生命动作", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        healthChanges: changes, hits: [{ id: "hit", frame: 0, scaling: 1, element: "physical" }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "health", atFrame: 1 }] },
  });
}

test("Health startup Worker preserves due boundary tasks and extends the real tail before certifying periodic state", async ({ page }) => {
  const config = delayedHealthFixture();
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "delayed-health-phase.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator("#analysis-warmup-cycles"))).fill("9");
  await (await revealControl(page.locator("#analysis-warmup-energy"))).selectOption("configured");
  await (await revealControl(page.locator("#analysis-steady-run"))).click();
  await expect(page.locator("#analysis-steady-run")).toBeEnabled();
  await expect(page.locator("#analysis-startup-output")).toContainText("已从完整模拟检查点建立稳态");
  const report = await downloadJson<{ startup: SimulationStartupResult }>(page, "#analysis-export");
  const startup = report.startup, result = startup.result!;
  expect(startup.status).toBe("steady-state-established");
  expect(startup.startup).toMatchObject({ warmupTicks: 1080, measurementStartTick: 1080, measurementEndTick: 1200, simulationTicks: 1440 });
  expect(startup.steadyState).toMatchObject({ status: "established-from-simulation", periodCycles: 1 });
  expect(result.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
  expect(result.config.timeline!.abilities[0]!.healthChanges).toEqual(config.timeline!.abilities[0]!.healthChanges);
  // One ordinary hit in this two-second window: 1000 × 1 × (190 / 400) × .9 = 427.5.
  expect(startup.measurement!.totalDamage).toBeCloseTo(427.5, 9);
  expect(startup.steadyState!.steadyStateDps).toBeCloseTo(213.75, 9);
  const checkpoint = result.executionAudit!.phaseCheckpoints.find(point => point.tick === 1080)!;
  expect(checkpoint.state.resourcesAndHp).toMatchObject({ hp: [{ actorId: "a", maxHp: 10000, currentHp: 5000 }] });
  const queue = checkpoint.state.pendingEvents as { inFlight: Array<{ type: string; remainingTicks: number; payload: { actionAgeTicks: number; change: HealthChangeDefinition } }> };
  const health = queue.inFlight.filter(event => event.type === "healthChange");
  expect(health.map(event => [event.remainingTicks, event.payload.actionAgeTicks, event.payload.change.operation])).toEqual([
    [0, 359, "consume"], [1, 359, "heal"], [120, 239, "consume"], [121, 239, "heal"], [240, 119, "consume"], [241, 119, "heal"],
  ]);
  expect(result.playerHealthEvents!.filter(event => event.frame === 1080 || event.frame === 1081).map(event => [event.frame, event.hpBefore, event.hpAfter])).toEqual([[1080, 5000, 4000], [1081, 4000, 5000]]);
  expect(result.playerHealthEvents!.some(event => event.frame > 1200)).toBe(true);
  const ledger = page.locator("#analysis-startup-output [data-player-health-ledger]");
  await expect(ledger.locator('[data-player-health-summary="a"] td').nth(3)).toHaveText("5,000");
  await expect(ledger.locator("[data-player-health-event]")).toHaveCount(12);
  const frames = await ledger.locator("[data-player-health-event] td:first-child").allTextContents();
  expect(frames.every(value => Number(value.split("f")[0]) < 1080)).toBe(true);
  const lastHeal = ledger.locator('[data-player-health-operation="heal"]').last();
  await (await revealControl(lastHeal.locator("details > summary"))).click();
  await expect(lastHeal.locator('[data-trace-node="health.after"]')).toContainText("5,000");
});
