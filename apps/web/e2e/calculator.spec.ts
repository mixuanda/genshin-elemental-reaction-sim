import { makeConfig, neutralStats } from "../../../packages/sim-core/src/__tests__/fixtures";
import { revealControl, runImportedScenario } from "./release-ui-helpers";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  loadWorkedExample,
  parseSimulationHit, replaySimulationHit,
  type CalculatorDocument,
  type CalculatorResult,
  type CapturedSimulationHit,
} from "@genshin-dps-lab/sim-core";

// Arithmetic assertions use the unrounded audit/export values. UI formatting is
// checked separately, with 1e-8 absolute tolerance for the mandatory fixtures.
const ABSOLUTE_TOLERANCE = 1e-8;
const closeTo = (actual: number | undefined, expected: number): void => {
  expect(actual).toBeDefined();
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(ABSOLUTE_TOLERANCE);
};

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult; ruleVersion: string }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function loadExample(page: Page, id: string): Promise<void> {
  const tools = page.locator("[data-calculator-example-tools]");
  if (!await tools.evaluate(element => (element as HTMLDetailsElement).open)) await (await revealControl(tools.locator("summary"))).click();
  await (await revealControl(page.locator("#calc-example-select"))).selectOption(id);
  await (await revealControl(page.locator('[data-action="load-example"]'))).click();
}

async function importDocument(page: Page, document: unknown): Promise<void> {
  await (await revealControl(page.locator("#calc-import"))).setInputFiles({
    name: "calculation.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
}

async function exportDocument<T = CalculatorDocument>(page: Page): Promise<T> {
  const downloadEvent = page.waitForEvent("download");
  await (await revealControl(page.locator('[data-action="export"]'))).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).not.toBeNull();
  return JSON.parse(await readFile(path!, "utf8")) as T;
}

function showcaseResponse(avatarId: number, skillLevels: Record<string, number> = {}, observedBonusLevels?: Record<string, number>, observedPhysicalBonus?: number) {
  return {
    fetchedAt: "2026-09-22T00:00:00.000Z",
    cache: "hit",
    data: {
      ttl: 60,
      playerInfo: { level: 60, worldLevel: 9 },
      avatarInfoList: [{
        avatarId,
        propMap: { "4001": { type: 4001, ival: "90" } },
        skillLevelMap: skillLevels,
        ...(observedBonusLevels === undefined ? {} : { proudSkillExtraLevelMap: observedBonusLevels }),
        fightPropMap: {
          "20": 0.7, "22": 1.2, "23": 1, "28": 0,
          ...(observedPhysicalBonus === undefined ? {} : { "30": observedPhysicalBonus }),
          "40": 0.5, "2000": 20000, "2001": 2000, "2002": 800,
        },
        // Deliberately retain a weapon in the import. Its base ATK must never
        // be added again to the already-final 2,000 ATK panel above.
        equipList: [{
          itemId: 11501,
          weapon: { level: 90, affixMap: { "111501": 0 } },
          flat: { itemType: "ITEM_WEAPON", rankLevel: 5 },
        }],
      }],
    },
  };
}

test("calculator independently renders fixture A arithmetic from its execution trace", async ({ page }) => {
  {
    await page.goto("/calculator");
    await expect(page.locator('[data-action="export"]')).toBeDisabled();
    await importDocument(page, { schemaVersion: "calculator-event-v2", eventId: 0, eventStepResult: {} });
    await expect(page.locator("#calc-message")).toContainText("导入失败");
    await expect(page.locator('[data-action="export"]')).toBeDisabled();
    await loadExample(page, "fixture-a");
    await expect(page.getByRole("heading", { name: "Skill calculator" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Skill calculator", exact: true })).toBeVisible();
    await expect(page.getByTestId("calc-expected")).toHaveText("5,340.6");
    expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
    await expect(page.locator("#simulationWorkspace")).toBeHidden();
    await expect(page.locator("#calc-results .calculator-badge.synthetic").first()).toHaveText("Synthetic example");
    await expect(page.locator("#calc-character")).toHaveValue("");
    const formalOptions = await page.locator("#calc-character option").allTextContents();
    expect(formalOptions.some(label => /教学 A|教学 B|fixture-|synthetic/.test(label))).toBe(false);
  }
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    const { result } = await audit(page);
    closeTo(result.totals?.nonCritical, 2902.5);
    closeTo(result.totals?.critical, 6385.5);
    closeTo(result.totals?.expected, 5340.6);
    const requiredSteps: Record<string, number> = {
      "build.baseAtk": 1000,
      "build.atkPercent": 0.8,
      "build.finalAtk": 2000,
      "hit-a.talentDamage": 4000,
      "hit-a.baseDamage": 4300,
      "hit-a.afterBonus": 6450,
      "hit-a.defenseMultiplier": 0.5,
      "hit-a.afterDefense": 3225,
      "hit-a.resistanceMultiplier": 0.9,
      "hit-a.afterResistance": 2902.5,
      "hit-a.afterReaction": 2902.5,
      "hit-a.nonCriticalMultiplier": 1,
      "hit-a.critical.criticalMultiplier": 2.2,
      "hit-a.critical.finalDamage": 6385.5,
      "hit-a.expected.expectedMultiplier": 1.84,
      "hit-a.expected.finalDamage": 5340.6,
      "hit-a.weightedVerification": 5340.6,
    };
    for (const [id, expected] of Object.entries(requiredSteps)) {
      closeTo(result.trace.find(node => node.id === id)?.result?.value, expected);
    }
    const table = page.locator("#calc-results .calculator-trace").first();
    await expect(table.locator("thead th")).toHaveText(["阶段", "数值", "公式"]);
    const rendered = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({
      id: row.getAttribute("data-trace-node"),
      value: row.querySelector(".trace-value")?.textContent,
      formula: row.querySelector("code")?.textContent,
      substitution: row.nextElementSibling?.querySelector(".trace-substitution code")?.textContent,
    })));
    const visibleTrace = [
      ...result.trace.filter(node => node.id.startsWith("build.") || node.id.startsWith("total.")),
      ...result.hits.flatMap(hit => hit.trace),
    ];
    expect(rendered).toEqual(visibleTrace.map(node => ({
      id: node.id,
      value: node.result?.display ?? "不适用",
      formula: node.symbolicFormula,
      substitution: node.substitution + (node.result ? ` = ${node.result.display}` : ""),
    })));
    const baseRow = page.locator('#calc-results .calculator-hit-card [data-trace-node="baseDamage"]');
    const detail = baseRow.locator("xpath=following-sibling::tr[1]");
    await (await revealControl(detail.locator(":scope > td > details > summary"))).click();
    await expect(detail.locator(".trace-substitution")).toContainText("4000 + 300");
    await expect(detail.locator(".trace-detail-content")).toContainText("固定攻击力");
    await expect(detail.locator("dl")).toContainText("flatDamage");
    await expect(page.locator("#calc-results")).toContainText("Expected damage is a probability-weighted average");
  }
});

test("editing inputs and final-panel conversion recalculate without stale values or double counting", async ({ page }) => {
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator('[data-field="build.characterBaseAtk"]'))).fill("400");
    let result = (await audit(page)).result;
    closeTo(result.trace.find(node => node.id === "build.baseAtk")?.result?.value, 1100);
    closeTo(result.trace.find(node => node.id === "build.finalAtk")?.result?.value, 2180);
    closeTo(result.totals?.expected, 5787.72);
    const table = page.locator("#calc-results .calculator-trace").first();
    await expect(table.locator('[data-trace-node="build.baseAtk"] + tr .trace-substitution')).toContainText("400 + 700");
    await expect(page.getByTestId("calc-expected")).toHaveText("5,787.72");
    await (await revealControl(page.locator('[data-field="build.characterBaseAtk"]'))).fill("");
    await expect(page.getByTestId("calc-expected")).toHaveCount(0);
    await expect(page.locator("#calc-results")).toContainText("不保留旧结果");
    await (await revealControl(page.locator('[data-field="build.characterBaseAtk"]'))).fill("300");
    result = (await audit(page)).result;
    closeTo(result.totals?.expected, 5340.6);
  }
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator("#calc-build-mode"))).selectOption("manual-final");
    await expect(page.locator('[data-field="build.stats.atk"]')).toHaveValue("2000");
    let result = (await audit(page)).result;
    closeTo(result.totals?.expected, 5340.6);
    expect(result.trace.some(node => node.id === "build.baseAtk")).toBe(false);
    closeTo(result.trace.find(node => node.id === "build.supplied.atk")?.result?.value, 2000);
    await expect(page.locator("#calc-document-controls")).toContainText("前置装备分解不可得");
    await (await revealControl(page.locator('[data-field="build.stats.atk"]'))).fill("2500");
    result = (await audit(page)).result;
    closeTo(result.totals?.expected, 6582.6);
    await (await revealControl(page.locator("#calc-build-mode"))).selectOption("equipment-derived");
    closeTo((await audit(page)).result.totals?.expected, 5340.6);
  }
});

test("editable two-hit example keeps per-hit totals and JSON roundtrip separate from the counterexample", async ({ page }) => {
  {
    await page.goto("/examples");
    await expect(page.getByRole("heading", { name: "合成教学例题", exact: true })).toBeVisible();
    await (await revealControl(page.locator('[data-example-id="fixture-b"]'))).click();
    await expect(page).toHaveURL(/\/calculator$/);
    const { result } = await audit(page);
    closeTo(result.hits[0]?.expected, 2760);
    closeTo(result.hits[1]?.expected, 1104);
    closeTo(result.totals?.expected, 3864);
    closeTo(result.counterexample?.incorrect, 4416);
    closeTo(result.counterexample?.overstatement, 552);
    await expect(page.getByTestId("calc-expected")).toHaveText("3,864");
    await expect(page.locator(".calculator-counterexample")).toContainText("不计入正式总伤害");
    await expect(page.locator(".calculator-counterexample")).toContainText("4,416");
    await expect(page.locator(".calculator-counterexample")).toContainText("552");
    await expect(page.locator("#calc-document-controls")).toContainText("已结算其他所有非暴击因素");
    const metricLabels = await page.locator("#calc-results .metric .label").allTextContents();
    expect(metricLabels.some(label => /DPS|每秒|\/ 秒/.test(label))).toBe(false);
    expect(result.trace.some(node => node.id.startsWith("counterexample."))).toBe(false);
  }
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await loadExample(page, "fixture-b");
    await (await revealControl(page.locator("#calc-scope"))).selectOption("single-hit");
    closeTo((await audit(page)).result.totals?.expected, 2760);
    await (await revealControl(page.locator('input[data-hit-id="hit-b"]'))).check();
    let result = (await audit(page)).result;
    closeTo(result.totals?.expected, 1104);
    expect(result.includedHitIds).toEqual(["hit-b"]);
    expect(result.excludedHitIds).toEqual(["hit-a"]);
    await (await revealControl(page.locator("#calc-scope"))).selectOption("one-cast");
    await (await revealControl(page.locator('[data-field="hits.1.preReactionDamage"]'))).fill("800");
    result = (await audit(page)).result;
    closeTo(result.totals?.expected, 4232);
    closeTo(result.totals?.expected, result.hits.reduce((sum, hit) => sum + hit.expected!, 0));
    await (await revealControl(page.locator('input[data-hit-id="hit-a"]'))).uncheck();
    closeTo((await audit(page)).result.totals?.expected, 1472);
  }
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await loadExample(page, "fixture-b");
    await (await revealControl(page.locator('[data-field="hits.1.preReactionDamage"]'))).fill("800");
    await (await revealControl(page.locator('input[data-hit-id="hit-a"]'))).uncheck();
    const before = await exportDocument(page);
    expect(before.scope).toBe("one-cast");
    expect(before.selectedHitIds).toEqual(["hit-b"]);
    expect(before.ruleVersion).toBe("ordinary-trace-v1");
    expect(before.dataIdentity.releaseStatus).toBe("synthetic");
    expect(before.assumptions.length).toBeGreaterThan(0);
    const beforeResult = (await audit(page)).result;
    await loadExample(page, "fixture-a");
    await importDocument(page, before);
    await expect(page.getByTestId("calc-expected")).toHaveText("1,472");
    expect(await exportDocument(page)).toEqual(before);
    expect((await audit(page)).result).toEqual(beforeResult);
    await (await revealControl(page.locator(".calculator-audit summary"))).click();
    const reportDownload = page.waitForEvent("download");
    await (await revealControl(page.locator('[data-action="export-report"]'))).click();
    const path = await (await reportDownload).path();
    const report = JSON.parse(await readFile(path!, "utf8"));
    expect(report.document).toEqual(before);
    expect(report.result).toEqual(beforeResult);
  }
});

test("formal skill selection tolerates unrelated gaps but blocks missing selected dependencies", async ({ page }) => {
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator("#calc-character"))).selectOption("character:10000123");
    await expect(page.locator("#calc-skill")).toBeEnabled();
    const blackSkill = await page.locator("#calc-skill option").filter({ hasText: "黑度之否" }).first().getAttribute("value");
    await (await revealControl(page.locator("#calc-skill"))).selectOption(blackSkill!);
    await expect(page.locator("#calc-scope")).toHaveValue("one-cast");
    await expect(page.locator("#calc-hit-selection label")).toHaveCount(3);
    expect((await audit(page)).result.status).toBe("blocked");
    await (await revealControl(page.locator('[data-source-cast-state-field="gameContext.durinSkill.statsStableAcrossHits"]'))).selectOption("1");
    await (await revealControl(page.locator("#calc-talent-level"))).fill("10");
    await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
    await expect.poll(async () => (await audit(page)).document.gameContext?.effectiveTalentLevel).toBe(10);
    const document = await exportDocument(page);
    const { result } = await audit(page);
    expect(document.label).toContain("黑度之否");
    expect(document.dependencies.find(dep => dep.id === "unrelated-team-rotation")?.status).toBe("missing");
    expect(result.status).toBe("calculated");
    expect(result.verification).toBe("provisional");
    expect(result.hits).toHaveLength(3);
    closeTo(result.totals?.expected, result.hits.reduce((sum, hit) => sum + hit.expected!, 0));
    await expect(page.locator("#calc-results")).toContainText("Provisional; not independently verified");
    await expect(page.locator('[data-field="hits.0.terms.0.coefficient"]')).toHaveAttribute("readonly", "");
    const before = document.hits[0];
    await (await revealControl(page.locator("#calc-talent-level"))).fill("9");
    await (await revealControl(page.locator("#calc-talent-level"))).press("Tab");
  await expect(page.locator("#calc-skill")).toBeEnabled();
    await expect(page.locator(".calculator-result-header")).toContainText("有效天赋等级 9");
    const after = (await exportDocument(page)).hits[0];
    expect(after?.kind === "ordinary" && before?.kind === "ordinary" && after.terms[0]!.coefficient < before.terms[0]!.coefficient).toBe(true);
  }
  {
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    const document = loadWorkedExample("fixture-a");
    document.hits[0]!.dependencies.push("missing-selected-coefficient");
    document.dependencies.push({ id: "missing-selected-coefficient", status: "missing", reason: "所选命中倍率缺少证据", sourceRefs: [] });
    await importDocument(page, document);
    await expect(page.locator("#calc-results")).toContainText("所选命中倍率缺少证据");
    await expect(page.getByTestId("calc-expected")).toHaveCount(0);
    const { result } = await audit(page);
    expect(result.status).toBe("blocked");
    expect(result.totals).toBeUndefined();
    expect(result.hits[0]?.status).toBe("blocked");
  }
});

test("public showcase imports preserve final stats while unknown identities cannot borrow talents", async ({ page }) => {
  {
    // A known identity without observed bonus-talent evidence must remain blocked.
    await page.route("**/api/showcase/900000003", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(showcaseResponse(10000123, { "11231": 10, "11232": 10, "11235": 10 })),
    }));
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator("#calc-showcase-uid"))).fill("900000003");
    await (await revealControl(page.locator('[data-action="showcase"]'))).click();
    await (await revealControl(page.locator('[data-showcase-index="0"]'))).click();
    await expect(page.locator("#calc-results")).toContainText("不能假定额外等级为0");
    await expect(page.locator("#calc-document-controls")).toBeEmpty();
  }
  {
    await page.route("**/api/showcase/900000001", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(showcaseResponse(19999999)),
    }));
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator("#calc-showcase-uid"))).fill("900000001");
    await (await revealControl(page.locator('[data-action="showcase"]'))).click();
    await expect(page.locator("#calc-showcase-status")).toContainText("使用 TTL 缓存");
    await expect(page.locator("#calc-showcase-characters")).toContainText("未匹配角色 19999999");
    await (await revealControl(page.locator('[data-showcase-index="0"]'))).click();
    await expect(page.locator("#calc-results")).toContainText("不能借用其他角色天赋");
    await expect(page.locator("#calc-results")).toContainText("已保留导入最终面板：攻击力 2,000");
    await expect(page.getByTestId("calc-expected")).toHaveCount(0);
    await expect(page.locator("#calc-document-controls")).toBeEmpty();
  }
  {
    // Known talents do not establish an omitted physical bonus for the first normal candidate.
    await page.route("**/api/showcase/900000004", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(showcaseResponse(10000123, { "11231": 10, "11232": 10, "11235": 10 }, {})),
    }));
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator("#calc-showcase-uid"))).fill("900000004");
    await (await revealControl(page.locator('[data-action="showcase"]'))).click();
    await (await revealControl(page.locator('[data-showcase-index="0"]'))).click();
    await expect(page.locator("#calc-results")).toContainText("physical 伤害加成");
    await expect(page.locator("#calc-document-controls")).toBeEmpty();
  }
  {
    await page.route("**/api/showcase/900000002", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(showcaseResponse(10000123, { "11231": 10, "11232": 10, "11235": 10 }, {}, 0)),
    }));
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await (await revealControl(page.locator("#calc-showcase-uid"))).fill("900000002");
    await (await revealControl(page.locator('[data-action="showcase"]'))).click();
    await (await revealControl(page.locator('[data-showcase-index="0"]'))).click();
    await expect(page.locator("#calc-build-mode")).toHaveValue("imported-final");
    const whiteSkill = await page.locator("#calc-skill option").filter({ hasText: "白化之是" }).first().getAttribute("value");
    await (await revealControl(page.locator("#calc-skill"))).selectOption(whiteSkill!);
    await expect(page.locator('[data-field="build.stats.atk"]')).toHaveValue("2000");
    await expect(page.locator("#calc-talent-level")).toHaveValue("10");
    const { document, result } = await audit(page);
    const downloads: string[] = [];
    page.on("download", download => downloads.push(download.suggestedFilename()));
    await (await revealControl(page.locator('[data-action="export"]'))).click();
    await expect(page.locator("#calc-message")).toContainText("本次工作区包含玩家导入资料，仅供本次计算，不能保存或导出");
    expect(downloads).toEqual([]);
    expect((await audit(page)).document).toEqual(document);
    expect(document.build.mode).toBe("imported-final");
    expect(document.hits[0]?.kind === "ordinary" && document.hits[0].terms[0]?.coefficient).toBe(1.9008);
    closeTo(result.totals?.nonCritical, 2566.08);
    closeTo(result.totals?.expected, 4721.5872);
    expect(result.trace.some(node => node.id === "build.baseAtk")).toBe(false);
    closeTo(result.trace.find(node => node.id === "build.supplied.atk")?.result?.value, 2000);
  }
});

test("a simulator hit opens in Calculator with identical trace and roundtrips its complete capture", async ({ page }) => {
  await page.goto("/results");
  await (await revealControl(page.locator("#presetSelect"))).selectOption({ label: "杜林黑 E · 部分机制审计向量" });
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await (await revealControl(page.locator("#hitTableBody tr[data-hit-id]").first())).click();
  await expect(page.locator("#openHitCalculator")).toBeEnabled();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  const sourceTrace = await page.locator("#sharedHitTrace tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await expect(page.getByTestId("replay-reproduced")).toHaveText(await page.getByTestId("replay-original").innerText());
  const destinationTrace = await page.locator("#calc-results tr[data-trace-node]").evaluateAll(rows => rows.map(row => ({ id: row.getAttribute("data-trace-node"), text: row.textContent, detail: row.nextElementSibling?.textContent })));
  expect(destinationTrace).toEqual(sourceTrace);
  // Valid replay may export even though there is no editable CalculatorDocument.
  await expect(page.locator('[data-action="export"]')).toBeEnabled();
  await (await revealControl(page.locator('[data-action="observed-composition"]'))).click();
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  await (await revealControl(page.locator("#calc-composition-close"))).click();
  await expect(page.locator('[data-action="export"]')).toBeEnabled();
  const capturedWire = await exportDocument<unknown>(page);
  const captured = parseSimulationHit(JSON.stringify(capturedWire));
  // This historical worker path uses simulate(), not the nearby-wet witnessed protocol.
    expect((capturedWire as { schemaVersion: string }).schemaVersion).toBe("calculator-event-v1");
    expect(captured.schemaVersion).toBe("calculator-event-v1");
  expect(captured.eventStepResult).toBeUndefined();
  const event = captured.sourceResult.damageEvents.find(item => item.id === captured.eventId)!;
  expect(event.enemyStateBeforeHit).toBeDefined();
  expect(event.damageFactors).toBeDefined();
  expect(captured.sourceResult.config).toBeDefined();
  expect(captured.sourceResult.resolvedRuntimeOptions).toBeDefined();
  await page.goto("/calculator");
    await loadExample(page, "fixture-a");
  await (await revealControl(page.locator('[data-action="observed-composition"]'))).click();
  await expect(page.locator(".calculator-layout")).toBeHidden();
  await importDocument(page, { schemaVersion: "calculator-event-v2", eventId: 0, eventStepResult: {} });
  await expect(page.locator("#calc-message")).toContainText("导入失败");
  await expect(page.locator("#calc-source-host-capture")).toBeVisible();
  await expect(page.locator(".calculator-layout")).toBeHidden();
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  await importDocument(page, capturedWire);
  await expect(page.locator("#calc-source-host-capture")).toBeHidden();
  await expect(page.locator(".calculator-layout")).toBeVisible();
  await expect(page.locator('[data-action="export"]')).toBeEnabled();
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  expect(await exportDocument<unknown>(page)).toStrictEqual(capturedWire);
});

test("mobile examples preserve special-reaction readiness and preview identity", async ({ page }) => {
  {
    await page.goto("/examples");
    const lunar = page.locator(".calculator-example-card").filter({ has: page.getByRole("heading", { name: "Lunar-Charged 完整游戏示例", exact: true }) });
    await expect(lunar).toContainText("缺证据，已阻塞");
    await expect(lunar.getByRole("button")).toHaveCount(0);
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    const document = loadWorkedExample("fixture-a");
    document.dataIdentity = { datasetId: "isolated-preview-test", gameVersion: "preview-test", releaseStatus: "preview", evidenceStatus: "provisional" };
    await importDocument(page, document);
    await expect(page.locator("#calc-results .calculator-badge.preview")).toHaveText("隔离预览数据");
    expect((await audit(page)).result.verification).toBe("provisional");
    expect((await exportDocument(page)).dataIdentity).toEqual(document.dataIdentity);
  }
  {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/calculator");
    await loadExample(page, "fixture-a");
    await expect(page.getByRole("heading", { name: "Skill calculator" })).toBeVisible();
    await (await revealControl(page.locator('[data-field="build.flatAtk"]'))).fill("300");
    closeTo((await audit(page)).result.totals?.expected, 5589);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await (await revealControl(page.locator('[data-action="examples"]'))).click();
    await (await revealControl(page.locator('[data-example-id="fixture-b"]'))).click();
    await expect(page.getByTestId("calc-expected")).toHaveText("3,864");
  }
});

test("a witnessed worker hit preserves V2 evidence through calculator export and rejects a forged witness", async ({ page }) => {
  const base = makeConfig();
  const config = makeConfig({
    meta: { ...base.meta, name: "Synthetic witnessed calculator direct hit", verificationStatus: "provisional" },
    duration: 1, cycleLength: 1,
    characters: [{ ...base.characters[0]!, element: "electro", stats: { ...neutralStats } }],
    enemy: { level: 90, resistance: 0.1, defReduction: 0,
      targets: [{ id: "enemy-0", name: "Dry synthetic target", position: { x: 0, y: 0 }, initialAura: [] }] },
    rotation: [], reactionEngine: { mode: "aura-v8" }, targetTaskModel: { mode: "target-phase-v2" },
    electroChargedPropagationModel: { mode: "nearby-wet-radius-v1", radius: 3, verificationStatus: "provisional" },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "direct", actorId: "a", name: "Synthetic direct hit", kind: "skill",
        cancelFrame: 11, animationEndFrame: 11, cooldownFrames: 0,
        hits: [{ id: "direct-hit", frame: 0, scaling: 1, element: "electro",
          geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 0.01 },
          application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "direct" }] },
  });
  await page.goto("/results");
  await (await revealControl(page.locator("#importInput"))).setInputFiles({
    name: "witnessed-calculator.synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(config)),
  });
  await (await revealControl(page.locator("#critModeInput"))).selectOption("noCrit");
  await runImportedScenario(page);
  await expect(page.locator("#cancelRunButton")).toBeHidden();
  await expect(page.locator("#simulationProgress")).toHaveText("");
  await expect(page.locator("#exportRunButton")).toBeEnabled();
  await (await revealControl(page.getByRole("button", { name: "逐段伤害", exact: true }))).click();
  await expect(page.locator("#hitTableBody tr[data-hit-id]")).toHaveCount(1);
  await (await revealControl(page.locator("#hitTableBody tr[data-hit-id]").first())).click();
  await expect(page.locator("#sharedHitTrace")).toContainText("差值 0");
  await (await revealControl(page.locator("#openHitCalculator"))).click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  const wire = await exportDocument<Pick<CapturedSimulationHit, "schemaVersion" | "eventId" | "eventStepResult">>(page);
  expect(wire.schemaVersion).toBe("calculator-event-v2");
  expect(wire.eventStepResult).toBeDefined();
  expect(wire).not.toHaveProperty("sourceResult");
  const parsed = parseSimulationHit(JSON.stringify(wire));
  expect(parsed.schemaVersion).toBe("calculator-event-v2");
  expect(parsed.eventStepResult).toEqual(wire.eventStepResult);
  expect(parsed.sourceResult.damageEvents).toHaveLength(1);
  const event = parsed.sourceResult.damageEvents.find(row => row.id === wire.eventId)!;
  // Independent oracle: 1000 ATK × 1 scaling × 0.5 level-defense × 0.9 resistance.
  closeTo(event.finalDamage, 450);
  const replay = replaySimulationHit(parsed);
  closeTo(replay.originalDamage, 450);
  closeTo(replay.reproducedDamage, 450);
  closeTo(replay.difference, 0);

  const forged = structuredClone(wire);
  if (!forged.eventStepResult) throw new Error("Missing real worker witness");
  expect(forged.eventStepResult.evidence.events.length).toBeGreaterThan(0);
  expect(forged.eventStepResult.evidence.events[0]!.steps.length).toBeGreaterThan(1);
  forged.eventStepResult.evidence.events[0]!.steps.splice(1, 1);
  expect(() => parseSimulationHit(JSON.stringify(forged))).toThrow();
  await page.goto("/calculator");
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  await importDocument(page, forged);
  await expect(page.locator("#calc-message")).toContainText("导入失败");
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  await expect(page.getByTestId("replay-difference")).toHaveCount(0);
  await importDocument(page, wire);
  await expect(page.getByTestId("replay-difference")).toHaveText("0");
  await expect(page.locator('[data-action="export"]')).toBeEnabled();
  expect(await exportDocument<unknown>(page)).toStrictEqual(wire);
});
