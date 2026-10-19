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
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

async function selectAction(page: Page, character: string, label: string, skillId: string): Promise<void> {
  await page.locator("#calc-character").selectOption(character);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).getAttribute("value");
  await page.locator("#calc-skill").selectOption(value!);
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(1);
  expect((await audit(page)).document.gameContext?.skillId).toBe(skillId);
  await page.locator("#calc-ascension").selectOption("4");
  await page.locator('[data-field="build.stats.atk"]').fill("1000");
  await page.locator('[data-field="build.stats.critRate"]').fill("0.5");
  await page.locator('[data-field="build.stats.critDamage"]').fill("1");
}

async function expectCalculatorRoundTrip(page: Page, name: string): Promise<void> {
  const before = await audit(page);
  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  await page.locator("#calc-import").setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document.gameContext).toEqual(before.document.gameContext);
  expect(restored.document.selectedHitIds).toEqual(before.document.selectedHitIds);
  expect(restored.result.totals).toEqual(before.result.totals);
  expect(restored.result.hits.map(hit => hit.trace)).toEqual(before.result.hits.map(hit => hit.trace));
}

test("Keqing Q and Xingqiu E retain sourced passive accounting, single-hit access and complete context in JSON", async ({ page }) => {
  await page.goto("/calculator");
  await selectAction(page, "character:10000042", "天街巡游·完整十击", "keqing-burst-complete-cast");
  const keqing = await audit(page);
  expect(keqing.result.status).toBe("calculated");
  expect(keqing.result.hits).toHaveLength(10);
  expect(keqing.document.gameContext?.scopeCoverage).toBe("complete-cast");
  // Fixed source T1: .88 initial + 8 × .24 slashes + 1.888 final; A4 grants 15% CR before the first hit.
  const keqingNonCrit = 1000 * (0.88 + 8 * 0.24 + 1.888) * 0.5 * 0.9;
  expect(keqing.result.totals!.nonCritical).toBeCloseTo(keqingNonCrit, 9);
  expect(keqing.result.totals!.expected).toBeCloseTo(keqingNonCrit * (1 + 0.65), 9);
  expect(keqing.result.hits.every(hit => hit.effectiveCritRate === 0.65)).toBe(true);
  await page.locator("#calc-results .calculator-hit-card").first().locator(":scope > summary").click();
  await expect(page.locator('#calc-results [data-trace-node="characterCritRate"]').first()).toContainText("0.15");
  await page.locator("#calc-keqing-a4-included").selectOption("1");
  await page.locator('[data-field="build.stats.critRate"]').fill("0.65");
  expect((await audit(page)).result.totals).toEqual(keqing.result.totals);
  await page.locator("#calc-scope").selectOption("single-hit");
  await page.locator('[data-hit-id="keqing-burst-complete-cast-final"]').check();
  const finalHit = await audit(page);
  expect(finalHit.result.hits).toHaveLength(1);
  expect(finalHit.result.totals!.nonCritical).toBeCloseTo(1000 * 1.888 * 0.5 * 0.9, 9);
  expect(finalHit.result.totals!.expected).toBeCloseTo(1000 * 1.888 * 0.5 * 0.9 * 1.65, 9);
  await expectCalculatorRoundTrip(page, "keqing-q-final-hit.json");

  await selectAction(page, "character:10000025", "古华剑·画雨笼山·完整两段", "xingqiu-skill-complete-cast");
  await page.locator("#calc-constellation").selectOption("4");
  await page.locator("#calc-xingqiu-burst-active").selectOption("1");
  const duringQ = await audit(page);
  expect(duringQ.result.hits).toHaveLength(2);
  // Fixed T1 E values 1.68 + 1.912. C4 Q-at-cast multiplies the base by 1.5; A4 adds 20% Hydro bonus.
  const xingqiuBase = 1000 * (1.68 + 1.912) * 1.5 * 1.2 * 0.5;
  expect(duringQ.result.totals!.nonCritical).toBeCloseTo(xingqiuBase * 0.9, 9);
  expect(duringQ.result.totals!.expected).toBeCloseTo(xingqiuBase * 0.9 * 1.5, 9);
  await page.locator("#calc-xingqiu-c2-active").selectOption("1");
  const c2 = await audit(page);
  // The existing C2 shred makes 10% - 15% = -5% RES; the negative-resistance branch is 1 - (-.05)/2.
  expect(c2.result.totals!.nonCritical).toBeCloseTo(xingqiuBase * 1.025, 9);
  expect(c2.result.totals!.expected).toBeCloseTo(xingqiuBase * 1.025 * 1.5, 9);
  await page.locator('[data-field="hits.0.damageBonus"]').fill("0.2");
  await page.locator('[data-field="hits.1.damageBonus"]').fill("0.2");
  await page.locator("#calc-xingqiu-a4-included").selectOption("1");
  await page.locator('[data-field="enemy.resistance"]').fill("-0.05");
  await page.locator("#calc-xingqiu-c2-included-resistance").selectOption("1");
  const accounted = await audit(page);
  expect(accounted.result.totals!.nonCritical).toBeCloseTo(c2.result.totals!.nonCritical, 9);
  expect(accounted.result.totals!.expected).toBeCloseTo(c2.result.totals!.expected, 9);
  expect(accounted.document.gameContext?.xingqiuSkill).toMatchObject({ a4IncludedInPanel: true, burstActiveAtCast: true, c2ShredActive: true, c2ShredIncludedInResistance: true });
  await expectCalculatorRoundTrip(page, "xingqiu-e-complete-cast.json");
});

function syntheticFavonius() {
  return makeConfig({
    dataVersion: "synthetic-favonius-feedback-ui-v1", randomSeed: "favonius-browser-feedback",
    meta: { name: "合成机制验证：西风暴击产球与耗能反馈", version: "synthetic-favonius-feedback-ui-v1", verificationStatus: "provisional", note: "合成面板和合法动作；显式西风武器、精炼与收球延迟，只验证来源规则的执行及事件血缘。" },
    duration: 6.3, cycleLength: 6.3,
    characters: [
      { id: "a", name: "西风持有者 A", element: "geo", color: "#aa8800", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
      { id: "b", name: "后台角色 B", element: "cryo", color: "#44aabb", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats } },
    ],
    timeline: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "opening", actorId: "a", name: "合成不暴击与暴击三击", kind: "skill", cancelFrame: 3, animationEndFrame: 3, cooldownFrames: 0,
          hits: [0, 1, 2].map(frame => ({ id: `opening-${frame}`, frame, scaling: 1, element: "physical" as const, critRate: frame === 0 ? 0 : 1 })) },
        { id: "spend", actorId: "a", name: "合成耗能动作", kind: "burst", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, energyCost: 6 },
        { id: "ready", actorId: "a", name: "合成冷却到期暴击", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "ready-hit", frame: 0, scaling: 1, element: "physical", critRate: 1 }] },
      ],
      commands: [
        { type: "skill", actorId: "a", abilityId: "opening", atFrame: 0 },
        { type: "burst", actorId: "a", abilityId: "spend", atFrame: 5 },
        { type: "burst", actorId: "a", abilityId: "spend", atFrame: 12 },
        { type: "skill", actorId: "a", abilityId: "ready", atFrame: 361 },
      ],
    },
  });
}

async function waitForSimulation(page: Page): Promise<void> {
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
}

test("Explicit Favonius weapon uses actual critical outcomes, exact cooldown and particle energy feedback through worker and record restore", async ({ page }) => {
  const config = syntheticFavonius();
  await page.goto("/results");
  await page.locator("#importInput").setInputFiles({ name: "favonius-feedback.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.locator("#notice")).toContainText(config.meta.name);
  await waitForSimulation(page);
  await page.locator('.product-nav a[href="/team"]').click();
  await expect(page.locator("#favoniusModelEnabled")).not.toBeChecked();
  await page.locator("#favoniusModelEnabled").check();
  await page.locator('[data-favonius-weapon="a"]').selectOption("favoniussword");
  await page.locator('[data-favonius-refinement="a"]').selectOption("5");
  await page.locator('[data-favonius-delay="a"]').fill("10");
  await expect(page.locator('[data-favonius-weapon="b"]')).toHaveValue("disabled");
  await page.locator("#team-apply").click();
  await expect(page.locator("#team-status")).toContainText("保存");
  const saved = await page.evaluate(() => window.GenshinDpsLab.getConfig());
  expect(saved.favoniusModel).toEqual({ mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponId: "favoniussword", refinement: 5, particleDelayFrames: 10 }] });
  expect(saved.timeline).toEqual(config.timeline);
  expect(saved.characters).toEqual(config.characters);
  await page.locator('.product-nav a[href="/results"]').click();
  await page.locator("#critModeInput").selectOption("seeded-random-v1");
  await page.locator("#energyModeInput").selectOption("zero");
  await page.locator("#iterationInput").fill("1");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await waitForSimulation(page);
  const record = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(record.sourceConfig.favoniusModel).toEqual(saved.favoniusModel);
  expect(record.batchSummary.favoniusPolicy).toEqual({ sourceProfileId: "gcsim-favonius-reference-v1", rngStream: "favonius-v1", rngAlgorithm: "fnv1a32-mulberry32-v1", matchesGcsimRandomSequence: false, cooldownClock: "global-frame-assumes-no-character-hitlag" });
  expect(record.options.execution?.criticalSampling).toBe("seeded-random-v1");
  expect(record.result.executionAudit!.hits.map(hit => hit.critical.outcome)).toEqual(["noncritical", "critical", "critical", "critical"]);
  // One noncrit + three actual crits, with 1000 ATK, 1× talent, 190/400 DEF, 10% RES, 50% CD.
  expect(record.result.totalDamage).toBeCloseTo(1000 * (1 + 3 * 1.5) * (190 / 400) * 0.9, 9);
  const decisions = record.result.favoniusLog!;
  expect(decisions.map(entry => [entry.frame, entry.outcome])).toEqual([[0, "noncritical"], [1, "triggered"], [2, "cooldown-blocked"], [361, "triggered"]]);
  const triggers = decisions.filter(entry => entry.outcome === "triggered");
  expect(decisions.map(entry => entry.drawIndex)).toEqual([null, 0, null, 1]);
  expect(triggers.map(entry => [entry.readyFrameBefore, entry.readyFrameAfter])).toEqual([[0, 361], [361, 721]]);
  expect(triggers.every(entry => entry.sourceProfileId === "gcsim-favonius-reference-v1" && entry.rngStream === "favonius-v1" && entry.probability === 1 && entry.cooldownFrames === 360)).toBe(true);
  expect(record.result.particleEvents).toHaveLength(2);
  for (const [index, trigger] of triggers.entries()) {
    const particle = record.result.particleEvents.find(event => event.id === trigger.particleEventId)!;
    const damage = record.result.damageEvents.find(event => event.id === trigger.damageEventId)!;
    expect(damage.frame).toBe([1, 361][index]);
    expect(particle).toMatchObject({ sourceActorId: "a", sourceActionId: damage.actionId, particleElement: "neutral", particleCount: 3, spawnFrame: damage.frame, receiveFrame: damage.frame + 10, receivedWithinSimulation: true });
    const energy = record.result.energyLog.filter(entry => entry.sourceActionId === damage.actionId && entry.frame === particle.receiveFrame);
    expect(energy.map(entry => [entry.receiverId, entry.rawEnergy, entry.finalEnergy, entry.gainedEnergy])).toEqual([["a", 6, 6, 6], ["b", 4.8, 4.8, 4.8]]);
  }
  expect(record.result.skippedActions.map(action => action.frame)).toEqual([5]);
  expect(record.result.actionLog.filter(action => action.sourceAbilityId === "spend").map(action => [action.frame, action.energyBefore, action.energyAfter])).toEqual([[12, 6, 0]]);
  expect(record.result.energyStats.a).toMatchObject({ gained: 12, spent: 6, final: 6 });
  expect(record.result.energyStats.b).toMatchObject({ gained: 9.6, spent: 0, final: 9.6 });
  await page.getByRole("button", { name: "时间轴", exact: true }).click();
  await expect(page.locator("#actionStateAudit [data-action-favonius-index]")).toHaveCount(4);
  const firstTrigger = page.locator('#actionStateAudit [data-action-favonius-index="1"]');
  await firstTrigger.locator("summary").click();
  const displayed = JSON.parse((await firstTrigger.locator("pre").textContent())!);
  expect(displayed.trigger).toEqual(triggers[0]);
  expect(displayed.particle).toEqual(record.result.particleEvents[0]);
  expect(displayed.energy).toEqual(record.result.energyLog.filter(entry => entry.receiveFrame === 11));
  await page.locator("#randomSeedInput").fill("discard-this-seed");
  await page.locator("#importInput").setInputFiles({ name: "favonius-complete-record.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator("#randomSeedInput")).toHaveValue(record.batchSummary.seed);
  await waitForSimulation(page);
  const restored = await downloadJson<SimulationRecord>(page, "#exportRunButton");
  expect(restored.sourceConfig).toEqual(record.sourceConfig);
  expect(restored.options).toEqual(record.options);
  expect(restored.result.favoniusLog).toEqual(decisions);
  expect(restored.result.particleEvents).toEqual(record.result.particleEvents);
  expect(restored.result.energyLog).toEqual(record.result.energyLog);
  expect(restored.result.energyStats).toEqual(record.result.energyStats);
});
