import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { CalculatorDocument, CalculatorResult } from "@genshin-dps-lab/sim-core";

async function audit(page: Page): Promise<{ document: CalculatorDocument; result: CalculatorResult }> {
  return JSON.parse((await page.locator("#calc-results .calculator-audit pre").textContent())!);
}

async function selectSkill(page: Page, label: string): Promise<void> {
  const value = await page.locator("#calc-skill option").filter({ hasText: label }).first().getAttribute("value");
  expect(value).toBeTruthy();
  await page.locator("#calc-skill").selectOption(value!);
}

test("Kachina's observed E stays blocked until its editable full lifetime is supplied and restores through JSON", async ({ page }) => {
  await page.goto("/calculator");
  await page.locator("#calc-character").selectOption("character:10000100");
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectSkill(page, "冲天转转·实际完整寿命");
  await expect(page.locator('[data-source-cast-controls="kachina"]')).toBeVisible();
  await page.locator("#calc-scope").selectOption("one-cast");
  expect((await audit(page)).result.status).toBe("blocked");

  await page.locator('[data-action="kachina-example"]').click();
  await expect(page.locator("[data-kachina-draft-status]")).toContainText("尚未应用");
  await expect(page.locator("#calc-results")).toContainText("请应用或放弃");
  const example = JSON.parse(await page.locator("[data-kachina-events]").inputValue()) as Array<{ id: string; kind: string; frame: number }>;
  expect(example.map(event => event.kind)).toEqual(["independent-slam", "mount", "riding-slam", "points-observed", "end"]);

  const context = "gameContext.kachinaCast";
  await page.locator(`[data-source-cast-text-field="${context}.casterId"]`).fill("kachina");
  await page.locator(`[data-source-cast-text-field="${context}.targetId"]`).fill("enemy");
  await page.locator(`[data-source-cast-enum-field="${context}.startingMode"]`).selectOption("independent");
  for (const field of ["allActionsRecorded", "fullObservedLifetime", "noPhlogiston", "noReplacement", "noInterruption", "a1InactiveThroughout", "statsStableAcrossHits"]) {
    await page.locator(`[data-source-cast-state-field="${context}.${field}"]`).selectOption("1");
  }
  await page.locator(`[data-field="${context}.observedThroughFrame"]`).fill("300");
  await page.locator('[data-action="kachina-apply"]').click();
  const complete = await audit(page);
  expect(complete.document.gameContext).toMatchObject({ skillId: "kachina-skill-observed-lifecycle", scopeCoverage: "complete-cast" });
  expect(complete.result.status).toBe("calculated");
  expect(complete.result.hits.map(hit => hit.id)).toEqual([
    "kachina-skill-observed-lifecycle:example-independent-1", "kachina-skill-observed-lifecycle:example-riding-1",
  ]);
  expect(complete.result.totals!.expected).toBeGreaterThan(0);

  const changed = JSON.parse(await page.locator("[data-kachina-events]").inputValue()) as Array<Record<string, unknown>>;
  changed[0]!.targetContact = false;
  await page.locator("[data-kachina-events]").fill(JSON.stringify(changed, null, 2));
  await expect(page.locator("[data-kachina-draft-status]")).toContainText("尚未应用");
  await page.locator('[data-action="kachina-apply"]').click();
  const edited = await audit(page);
  expect(edited.result.status).toBe("calculated");
  expect(edited.document.gameContext?.scopeCoverage).toBe("complete-cast");
  expect(edited.result.hits.map(hit => hit.id)).toEqual(["kachina-skill-observed-lifecycle:example-riding-1"]);
  expect(edited.result.totals!.expected).toBeLessThan(complete.result.totals!.expected!);

  const downloading = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const saved = JSON.parse(await readFile((await (await downloading).path())!, "utf8")) as CalculatorDocument;
  await page.locator("#calc-import").setInputFiles({ name: "kachina-observed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(saved)) });
  const restored = await audit(page);
  expect(restored.document.gameContext?.kachinaCast?.events).toEqual(edited.document.gameContext?.kachinaCast?.events);
  expect(restored.result.totals).toEqual(edited.result.totals);
});

test("Alyosha exposes editable observed E and Q event contexts without generating a burst count", async ({ page }) => {
  await page.goto("/calculator");
  const characterId = await page.locator("#calc-character option").filter({ hasText: "阿罗夏" }).first().getAttribute("value");
  expect(characterId).toBeTruthy();
  await page.locator("#calc-character").selectOption(characterId!);
  await expect(page.locator("#calc-skill")).toBeEnabled();
  await selectSkill(page, "元素战技点按");
  const controls = page.locator("[data-alyosha-observed-controls]");
  await expect(controls).toBeVisible();
  await controls.locator("details").last().locator("summary").click();
  const editor = page.locator("[data-alyosha-observed-json]");
  const context = JSON.parse(await editor.inputValue()) as Record<string, unknown>;
  expect(context.events).toEqual([]);
  expect(context.hitBindings).toEqual({});
  const hitId = (await audit(page)).document.hits[0]!.id;
  context.initialMarksKnownClear = true;
  context.initialPrecisionKnownClear = true;
  context.initialBurstKnownClear = true;
  context.eventsObservedThroughCutoff = true;
  context.observedOrderConfirmed = true;
  context.noHitlag = true;
  context.events = [{ id: "observed-press", frame: 10, order: 0, kind: "mark-apply", targetId: "enemy", source: "skill-press", contactConfirmed: true, nearbyRecipientIds: [] }];
  context.hitBindings = { [hitId]: "observed-press" };
  await editor.fill(JSON.stringify(context, null, 2));
  await page.locator('[data-action="alyosha-observed-apply"]').click();
  await expect(controls).toContainText("已重放 1 条实际事件");
  const applied = await audit(page);
  expect(applied.document.gameContext?.observedAlyoshaLifecycle?.events).toHaveLength(1);
  expect(applied.document.gameContext?.observedAlyoshaLifecycle?.hitBindings?.[hitId]).toBe("observed-press");

  await selectSkill(page, "元素爆发·猎场单次");
  await expect(page.locator("[data-alyosha-observed-controls]")).toBeVisible();
  const burstSeed = JSON.parse(await page.locator("[data-alyosha-observed-json]").inputValue()) as { events: unknown[] };
  expect(burstSeed.events).toEqual([]);
  await expect(page.locator("[data-alyosha-observed-controls]")).toContainText("不能从14秒持续时间猜首击或总次数");
});
