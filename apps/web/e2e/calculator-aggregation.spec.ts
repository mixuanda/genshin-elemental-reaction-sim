import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

type Audit = { document: CalculatorDocument; result: CalculatorResult };
const display = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });

async function audit(page: Page): Promise<Audit> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!) as Audit;
}

async function downloadJson<T>(page: Page, selector: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8")) as T;
}

test("a sourced two-strike skill shows complete and selected composition, updates its subtotal, and restores the exported aggregation", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/calculator");
  await expect(page.locator("#simulationWorkspace")).toBeHidden();
  await page.locator("#calc-character").selectOption("character:10000025");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  const skill = await page.locator("#calc-skill option").filter({ hasText: "古华剑·画雨笼山·完整两段" }).getAttribute("value");
  expect(skill).toBeTruthy();
  await page.locator("#calc-skill").selectOption(skill!);
  await page.locator("#calc-constellation").selectOption("0");
  await page.locator("#calc-talent-level").fill("1");
  await page.locator("#calc-talent-level").press("Tab");
  await page.locator("#calc-ascension").selectOption("4");
  for (const [name, value] of Object.entries({ atk: 1000, critRate: 0.5, critDamage: 1 })) {
    await page.locator(`[data-field="build.stats.${name}"]`).fill(String(value));
  }
  await expect.poll(async () => (await audit(page)).document.gameContext?.skillId).toBe("xingqiu-skill-complete-cast");

  // The source mapping contains two distinct coefficient rows. The aggregate
  // keeps both identities visible even while single-hit scope selects one.
  await page.locator("#calc-scope").selectOption("single-hit");
  const single = await audit(page);
  expect(single.result.status).toBe("calculated");
  expect(single.document.hits).toHaveLength(2);
  expect(single.result.aggregation.version).toBe("calculator-aggregation-v1");
  expect(single.result.aggregation.scope).toBe("single-hit");
  expect(single.result.aggregation.components).toHaveLength(2);
  expect(single.result.aggregation.components.filter(row => row.selected)).toHaveLength(1);
  expect(single.result.aggregation.knownSubtotal?.expected).toBeCloseTo(single.result.totals!.expected, 9);
  const hitIds: string[] = single.document.hits.map(hit => hit.id);
  const hitLabels: string[] = single.document.hits.map(hit => hit.label);
  const cast = page.locator("[data-cast-aggregation]");
  await expect(cast).toHaveAttribute("data-aggregation-scope", "single-hit");
  await expect(cast.locator("tr[data-cast-component]")).toHaveCount(2);
  await expect(cast.getByTestId("cast-aggregation-expected")).toHaveText(display(single.result.totals!.expected));
  for (const label of hitLabels) await expect(cast).toContainText(label);

  await page.locator("#calc-scope").selectOption("one-cast");
  const complete = await audit(page);
  expect(complete.result.status).toBe("calculated");
  expect(complete.result.aggregation.scope).toBe("complete-cast");
  expect(complete.result.aggregation.components.map(row => row.id)).toEqual(hitIds);
  expect(complete.result.aggregation.components.every(row => row.selected && row.status === "calculated")).toBe(true);
  expect(complete.result.aggregation.omittedHitIds).toEqual([]);
  expect(complete.result.aggregation.knownSubtotal?.expected).toBeCloseTo(
    complete.result.aggregation.components.reduce((sum, row) => sum + row.damage!.expected, 0), 9,
  );
  expect(complete.result.totals!.expected).toBeCloseTo(complete.result.aggregation.knownSubtotal!.expected, 9);
  await expect(cast).toHaveAttribute("data-aggregation-scope", "complete-cast");
  await expect(cast.getByTestId("cast-aggregation-scope")).toHaveText("完整技能");
  await expect(cast.getByTestId("cast-aggregation-expected")).toHaveText(display(complete.result.totals!.expected));
  for (const id of hitIds) await expect(cast.locator(`tr[data-cast-component="${id}"]`)).toHaveAttribute("data-component-status", "calculated");
  await cast.locator(`[data-cast-hit-id="${hitIds[0]}"]`).click();
  const firstTrace = page.locator(`[data-detail-id="hit-card:${hitIds[0]}"]`);
  await expect(firstTrace).toHaveAttribute("open", "");
  await expect(firstTrace.locator("[data-trace-mounted]")).toHaveAttribute("data-trace-mounted", "true");

  await page.locator(`input[data-hit-id="${hitIds[1]}"]`).uncheck();
  const partial = await audit(page);
  expect(partial.result.aggregation.scope).toBe("selected-components");
  expect(partial.result.aggregation.omittedHitIds).toEqual([hitIds[1]]);
  expect(partial.result.aggregation.components.map(row => [row.id, row.status, row.selected])).toEqual([
    [hitIds[0], "calculated", true], [hitIds[1], "excluded", false],
  ]);
  expect(partial.result.totals!.expected).toBeCloseTo(partial.result.aggregation.components[0]!.damage!.expected, 9);
  await expect(cast.getByTestId("cast-aggregation-scope")).toHaveText("所选组成");
  await expect(cast.locator(`tr[data-cast-component="${hitIds[1]}"]`)).toContainText("未计入");
  await expect(cast).toContainText(`未列入组成的命中（1）`);
  await expect(cast.getByTestId("cast-aggregation-expected")).toHaveText(display(partial.result.totals!.expected));

  await page.locator(`input[data-hit-id="${hitIds[1]}"]`).check();
  expect((await audit(page)).result.aggregation.scope).toBe("complete-cast");
  await page.locator('[data-field="build.stats.atk"]').fill("1200");
  const edited = await audit(page);
  expect(edited.result.status).toBe("calculated");
  expect(edited.result.aggregation.scope).toBe("complete-cast");
  expect(edited.result.totals!.expected).toBeGreaterThan(complete.result.totals!.expected);
  expect(edited.result.aggregation.knownSubtotal?.expected).toBeCloseTo(edited.result.totals!.expected, 9);
  expect(edited.result.aggregation.components.map(row => row.damage!.expected)).not.toEqual(
    complete.result.aggregation.components.map(row => row.damage!.expected),
  );
  await expect(cast.getByTestId("cast-aggregation-expected")).toHaveText(display(edited.result.totals!.expected));

  const document = await downloadJson<CalculatorDocument>(page, '[data-action="export"]');
  expect(document.selectedHitIds).toEqual(hitIds);
  expect(document.scope).toBe("one-cast");
  await page.locator(".calculator-audit summary").click();
  const report = await downloadJson<Audit>(page, '[data-action="export-report"]');
  expect(report.document).toEqual(document);
  expect(report.result.aggregation).toEqual(edited.result.aggregation);
  expect(report.result.totals).toEqual(edited.result.totals);
  await page.locator("#calc-import").setInputFiles({
    name: "xingqiu-two-strike-aggregation.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(page.locator("#calc-character-status")).toContainText("已载入文件中的计算文档");
  const restored = await audit(page);
  expect(restored.document).toEqual(document);
  expect(restored.result.aggregation).toEqual(edited.result.aggregation);
  expect(restored.result.totals).toEqual(edited.result.totals);
  await expect(cast.getByTestId("cast-aggregation-scope")).toHaveText("完整技能");
  await expect(cast.getByTestId("cast-aggregation-expected")).toHaveText(display(edited.result.totals!.expected));
  expect(errors).toEqual([]);

  await writeFile(resolve("docs/validation/calculator-aggregation-20260928.result.json"), `${JSON.stringify({
    schemaVersion: "calculator-aggregation-validation-v1", sourceSkillId: "xingqiu-skill-complete-cast",
    hitIds, hitLabels, single: { aggregation: single.result.aggregation, totals: single.result.totals },
    complete: { aggregation: complete.result.aggregation, totals: complete.result.totals },
    partial: { aggregation: partial.result.aggregation, totals: partial.result.totals },
    edited: { aggregation: edited.result.aggregation, totals: edited.result.totals },
    document, report, restored: { aggregation: restored.result.aggregation, totals: restored.result.totals }, pageErrors: errors,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ sourceSkillId: "xingqiu-skill-complete-cast", segments: hitIds.length,
    singleExpected: single.result.totals!.expected, completeExpected: complete.result.totals!.expected,
    selectedExpected: partial.result.totals!.expected, editedExpected: edited.result.totals!.expected,
    restoredExpected: restored.result.totals!.expected, pageErrors: errors }));
});
