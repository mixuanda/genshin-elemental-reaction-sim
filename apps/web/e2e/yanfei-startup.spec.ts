import { revealControl, runImportedScenario } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";
import type { StochasticDistribution, StochasticStartupResult } from "../../../packages/sim-core/src/stochastic-startup";
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

test("Yanfei charged cast conditions A4 on main critical probability and preserves independent hit context in JSON", async ({ page }) => {
  await page.goto("/calculator");
  await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000048");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const charged = await page.locator("#calc-skill option").filter({ hasText: "火漆制印·一次重击" }).getAttribute("value");
  await (await revealControl(page.locator("#calc-skill"))).selectOption(charged!);
  await (await revealControl(page.locator("#calc-talent-level"))).fill("1");
  await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("1000");
  await (await revealControl(page.locator('[data-field="build.stats.critRate"]'))).fill("0.5");
  await (await revealControl(page.locator('[data-field="build.stats.critDamage"]'))).fill("1");
  await (await revealControl(page.locator('[data-field="gameContext.yanfeiCharged.scarletSeals"]'))).fill("3");
  const initial = await audit(page);
  expect(initial.document.gameContext).toMatchObject({ skillId: "yanfei-charged-cast", effectiveTalentLevel: 1, scopeCoverage: "complete-cast" });
  expect(initial.result.status).toBe("calculated");
  expect(initial.result.hits).toHaveLength(2);
  // Pinned T1 three-seal coefficient 1.502332; A1 = 3 × 5%; L90/90 DEF = 1/2; RES = 0.9.
  const mainNonCrit = 1000 * 1.502332 * 1.15 * 0.5 * 0.9;
  const a4NonCrit = 1000 * 0.8 * 1.15 * 0.5 * 0.9;
  expect(initial.result.totals!.nonCritical).toBeCloseTo(mainNonCrit, 9);
  expect(initial.result.totals!.critical).toBeCloseTo(2 * (mainNonCrit + a4NonCrit), 9);
  expect(initial.result.totals!.expected).toBeCloseTo(mainNonCrit * 1.5 + 0.5 * a4NonCrit * 1.5, 9);
  expect(initial.result.hits[1]!.expected).toBeCloseTo(621, 9);
  expect(initial.result.hits[1]!.castContribution).toMatchObject({ nonCritical: 0, triggerProbability: 0.5 });
  expect(initial.result.hits[1]!.castContribution!.expected).toBeCloseTo(310.5, 9);
  const occurrence = initial.result.hits[1]!.trace.find(node => node.id === "occurrence.expected")!;
  expect(occurrence.result!.value).toBeCloseTo(310.5, 9);
  expect(occurrence.substitution).toContain("0.5");
  await (await revealControl(page.locator('#calc-results [data-detail-id="hit-card:yanfei-charged-cast-a4"] > summary'))).click();
  await expect(page.locator('#calc-results [data-trace-node="occurrence.expected"]')).toContainText("310.5");
  await (await revealControl(page.locator('[data-field="build.stats.critRate"]'))).fill("0.25");
  const quarter = await audit(page);
  expect(quarter.result.totals!.nonCritical).toBeCloseTo(mainNonCrit, 9);
  expect(quarter.result.totals!.expected).toBeCloseTo(mainNonCrit * 1.25 + 0.25 * a4NonCrit * 1.25, 9);
  expect(quarter.result.hits[1]!.castContribution!.triggerProbability).toBe(0.25);

  await (await revealControl(page.locator('[data-field="build.stats.critRate"]'))).fill("0.5");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
  await (await revealControl(page.locator('[data-hit-id="yanfei-charged-cast-a4"]'))).check();
  const actualA4 = await audit(page);
  expect(actualA4.result.totals!.expected).toBeCloseTo(621, 9);
  expect(actualA4.result.hits[0]!.castContribution).toBeUndefined();
  expect(actualA4.result.hits[0]!.trace.find(node => node.id === "conditionedOccurrence")!.status).toBe("assumed");
  await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
  await (await revealControl(page.locator("#calc-constellation"))).selectOption("2");
  await (await revealControl(page.locator('[data-field="gameContext.yanfeiCharged.mainEnemyHpFraction"]'))).fill("0.5");
  await (await revealControl(page.locator('[data-field="gameContext.yanfeiCharged.a4EnemyHpFraction"]'))).fill("0.49");
  const c2 = await audit(page);
  expect(c2.result.hits.map(hit => hit.effectiveCritRate)).toEqual([0.5, 0.7]);
  expect(c2.result.hits[1]!.castContribution!.expected).toBeCloseTo(351.9, 9);

  // Both manual bonus inputs already contain an old 10% A1. The new 15% replaces it.
  await (await revealControl(page.locator('[data-field="hits.0.damageBonus"]'))).fill("0.1");
  await (await revealControl(page.locator('[data-field="hits.1.damageBonus"]'))).fill("0.1");
  await (await revealControl(page.locator('[data-field="gameContext.yanfeiCharged.priorA1BonusIncluded"]'))).fill("0.1");
  expect((await audit(page)).result.totals).toEqual(c2.result.totals);
  await (await revealControl(page.locator('[data-field="gameContext.yanfeiCharged.brilliance.effectiveTalentLevel"]'))).fill("1");
  await (await revealControl(page.locator("#calc-yanfei-brilliance-main"))).selectOption("1");
  await (await revealControl(page.locator("#calc-yanfei-brilliance-a4"))).selectOption("0");
  const q1 = await audit(page);
  expect(q1.result.hits[0]!.nonCritical).toBeCloseTo(1000 * 1.502332 * (1.15 + 0.334) * 0.5 * 0.9, 9);
  expect(q1.result.hits[1]!.nonCritical).toBeCloseTo(414, 9);
  await (await revealControl(page.locator('[data-field="gameContext.yanfeiCharged.brilliance.effectiveTalentLevel"]'))).fill("10");
  const q10 = await audit(page);
  expect(q10.document.gameContext!.effectiveTalentLevel).toBe(1);
  expect(q10.result.hits[0]!.nonCritical).toBeCloseTo(1000 * 1.502332 * (1.15 + 0.544) * 0.5 * 0.9, 9);
  expect(q10.result.hits[1]!.nonCritical).toBeCloseTo(414, 9);
  expect(q10.result.hits[1]!.castContribution!.expected).toBeCloseTo(351.9, 9);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({ name: "yanfei-ca-conditional-a4.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(q10.document.gameContext);
  expect(restored.result.totals).toEqual(q10.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(q10.result.hits.map(hit => hit.trace));
});

function syntheticStartup() {
  const config = makeConfig({
    dataVersion: "synthetic-stochastic-startup-ui-v1", randomSeed: "small-paired-fixture",
    meta: { name: "合成机制验证：有限预热起步诊断", version: "synthetic-stochastic-startup-ui-v1", verificationStatus: "provisional", note: "合成固定产球和耗能动作；只验证有限窗口统计，不代表真实角色或数学稳态。" },
    duration: 4, cycleLength: 2, rotation: [],
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [
        { id: "synthetic-e", actorId: "a", name: "合成固定产球", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
          particles: [{ id: "one", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }] },
        { id: "synthetic-q", actorId: "a", name: "合成耗能", kind: "burst", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 6,
          hits: [{ id: "q-hit", frame: 0, scaling: 1, element: "pyro" }] },
      ],
      commands: [{ type: "skill", actorId: "a", abilityId: "synthetic-e" }, { type: "burst", actorId: "a", abilityId: "synthetic-q" }],
    },
  });
  config.characters[0]!.energyMax = 6;
  config.characters[0]!.stats.critRate = 0.5;
  config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "无耗能请求的后台角色" });
  return config;
}

function expectTwoSampleDistribution(distribution: StochasticDistribution, values: number[]): void {
  expect(values).toHaveLength(2);
  const [a, b] = values as [number, number];
  const mean = (a + b) / 2;
  // For two observations, s = |a-b|/sqrt(2); SE = |a-b|/2. df=1 critical t is 12.706.
  const halfWidth = 12.706 * Math.abs(a - b) / 2;
  expect(distribution.count).toBe(2);
  expect(distribution.mean).toBeCloseTo(mean, 9);
  expect(distribution.sampleStandardDeviation!).toBeCloseTo(Math.abs(a - b) / Math.sqrt(2), 9);
  expect(distribution.meanConfidenceInterval).toMatchObject({ method: "student-t-95-approximation", degreesOfFreedom: 1, criticalValue: 12.706 });
  expect(distribution.meanConfidenceInterval!.low).toBeCloseTo(mean - halfWidth, 9);
  expect(distribution.meanConfidenceInterval!.high).toBeCloseTo(mean + halfWidth, 9);
  expect(distribution.spreadPercentiles.p05).toBeCloseTo(Math.min(a, b) + Math.abs(a - b) * 0.05, 9);
  expect(distribution.spreadPercentiles.p50).toBeCloseTo(mean, 9);
  expect(distribution.spreadPercentiles.p95).toBeCloseTo(Math.min(a, b) + Math.abs(a - b) * 0.95, 9);
}

test("Finite stochastic startup runs four continuous trajectories and exports paired samples and boundary energy", async ({ page }) => {
  const config = syntheticStartup();
  await page.goto("/results");
  await (await revealControl(page.locator("#critModeInput"))).selectOption("seeded-random-v1");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({ name: "stochastic-startup.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await runImportedScenario(page);
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await (await revealControl(page.locator('.tab[data-tab="overview"]'))).click();
  await expect(page.locator("#overviewPanel")).toBeVisible();
  await (await revealControl(page.locator("#analysis-stochastic-samples"))).fill("2");
  await (await revealControl(page.locator("#analysis-stochastic-cycles"))).fill("1");
  await (await revealControl(page.locator("#analysis-stochastic-run"))).click();
  await expect(page.locator("#analysis-stochastic-run")).toBeEnabled();
  await expect(page.locator("#analysis-stochastic-cancel")).toBeHidden();
  await expect(page.locator("#analysis-stochastic-output")).toContainText("诊断已完成");
  await expect(page.locator("#analysis-stochastic-output")).toContainText("共 4 次");
  await expect(page.locator("#analysis-stochastic-output [data-stochastic-cell]")).toHaveCount(4);
  await expect(page.locator("#analysis-stochastic-output [data-stochastic-contrast]")).toHaveCount(4);
  const report = await downloadJson<{ stochasticStartup: StochasticStartupResult }>(page, "#analysis-export");
  const result = report.stochasticStartup;
  expect(result.status).toBe("completed-diagnostic");
  expect(result.config).toEqual(config);
  expect(result.policy).toEqual({ sampleCount: 2, warmupCycles: 1, cycleTicks: 120, observationTicks: 240, warmupTicks: 120, simulationTicks: 480, windowPolicy: "half-open-[startTick,endTick)", boundaryEnergyPolicy: "before-all-events-at-boundary" });
  expect(result.randomness.criticalPolicy).toBe("seeded-random-v1");
  expect(result.runs).toHaveLength(4);
  expect(result.randomness.seeds).toEqual(["small-paired-fixture:stochastic-startup-v1:0", "small-paired-fixture:stochastic-startup-v1:1"]);
  expect(result.representativeResult.damageEvents.map(event => event.frame)).toEqual([122, 362]);
  expect(result.representativeResult.skippedActions.map(action => action.frame)).toEqual([2, 242]);
  // One accepted Q per four-second window: 1000 ATK × 1 × (190/400 DEF) × 0.9 RES, optionally ×1.5 crit.
  for (const run of result.runs) {
    expect(run.windows).toHaveLength(2);
    expect(run.runManifest.resolvedRuntimeOptions.randomSeed).toBe(run.seed);
    expect(run.runManifest.resolvedRuntimeOptions.energyMode).toBe(run.initialEnergy);
    const boundaryEnergy = run.initialEnergy === "zero" ? [3, 0] : [0, 3];
    for (const [index, window] of run.windows.entries()) {
      expect(window.startTick).toBe((index + 1) * 120);
      expect(window.endTick).toBe((index + 3) * 120);
      expect(window.actors.a).toEqual({ startEnergy: boundaryEnergy[index], endEnergy: boundaryEnergy[index], energyCostAttempts: 2, energyCostFailures: 1, insufficientEnergyFailures: 1, energyCostFailureRate: 0.5 });
      expect(window.actors.b!.energyCostFailureRate).toBeNull();
      expect([427.5, 641.25]).toContain(window.damage);
      expect(window.dps).toBe(window.damage / 4);
    }
  }
  expect(result.cells.map(cell => cell.id)).toEqual(["zero-w", "zero-2w", "full-w", "full-2w"]);
  for (const cell of result.cells) {
    const samples = result.runs.flatMap(run => run.windows.filter(window => window.cellId === cell.id));
    expectTwoSampleDistribution(cell.metrics.damage, samples.map(sample => sample.damage));
    expect(cell.metrics.actors.b!.energyCostFailureRate).toBeNull();
  }
  expect(result.contrasts.map(contrast => contrast.id)).toEqual(["zero-2w-minus-w", "full-2w-minus-w", "w-full-minus-zero", "2w-full-minus-zero"]);
  for (const contrast of result.contrasts) {
    const differences = result.randomness.seeds.map(seed => {
      const windows = result.runs.filter(run => run.seed === seed).flatMap(run => run.windows);
      const left = windows.find(window => window.cellId === contrast.minuend)!;
      const right = windows.find(window => window.cellId === contrast.subtrahend)!;
      return left.damage - right.damage;
    });
    expect(contrast.pairedSamples.map(sample => sample.damage)).toEqual(differences);
    expectTwoSampleDistribution(contrast.metrics.damage, differences);
    expect(contrast.metrics.actors.b!.energyCostFailureRate).toBeNull();
  }
  expect(result.limitations.join(" ")).toContain("不证明完整状态分布收敛或数学稳态");
});
