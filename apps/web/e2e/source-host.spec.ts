import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";

test("runs source lifecycle formula families through the Worker and restores an editable independent hit", async ({ page }) => {
  test.setTimeout(60000);
  const config = `# Explicit hypothetical source builds, one shared mechanism acceptance.
options iteration=1 duration=24;
lisa char lvl=90/90 cons=0 talent=1,1,1;
lisa add weapon="magicguide" refine=1 lvl=90/90;
lisa add stats atk=200 em=100 cr=0.2 cd=0.4;
collei char lvl=90/90 cons=0 talent=1,1,1;
collei add weapon="favoniuswarbow" refine=1 lvl=90/90;
collei add stats atk=200 em=100 cr=0.2 cd=0.4;
barbara char lvl=90/90 cons=0 talent=1,1,1;
barbara add weapon="magicguide" refine=1 lvl=90/90;
barbara add stats atk=200 em=100 cr=0.2 cd=0.4;
xiangling char lvl=90/90 cons=0 talent=1,1,1;
xiangling add weapon="favoniuslance" refine=1 lvl=90/90;
xiangling add stats atk=200 em=100 cr=0.2 cd=0.4;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active lisa;
lisa attack:3;
collei skill;
lisa attack:4;
barbara attack:4;
xiangling skill;
barbara attack:5;
wait(600);`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/source-simulation");
  await page.locator("#source-host-config").evaluate(area => {
    let details = area.closest("details");
    while (details) { details.open = true; details = details.parentElement?.closest("details") ?? null; }
  });
  await page.locator("#source-host-config").fill(config);
  await page.locator("#source-host-seed").fill("12345");
  await page.locator("#source-host-run").click();
  await expect(page.locator("#source-host-status")).toContainText(/本次运行完成|运行停止|执行器错误/, { timeout: 45000 });
  await expect(page.locator("#source-host-status")).toContainText("本次运行完成");
  const overview = page.locator("[data-source-host-result-overview]");
  await expect(overview).toBeVisible();
  await expect(overview).toContainText("模拟时长");
  await expect(overview).toContainText("来源总伤害");
  await expect(overview).toContainText("本次 DPS");
  const download = page.waitForEvent("download");
  await page.locator("#source-host-export").click();
  const result = JSON.parse(await readFile((await (await download).path())!, "utf8")) as SourceHostResult;
  expect(Number(await overview.locator("[data-source-host-overview-total]").getAttribute("data-value")))
    .toBeCloseTo(result.applications.reduce((sum, row) => sum + row.appliedDamage, 0), 6);
  expect(await overview.locator("[data-source-host-actor-damage]").count()).toBeGreaterThan(0);
  const kinds = [...new Set(result.calculations.map(row => row.request.kind))];
  expect(kinds).toEqual(expect.arrayContaining(["damage", "transformative-base", "additive-base"]));
  expect(result.calculations.some(row => row.request.kind === "damage" && row.request.input.amped)).toBe(true);
  await page.locator("#source-host-open-calculator").click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator("#calc-source-host-capture")).toBeVisible();
  const value = page.locator('[data-source-host-input="scaling"]');
  await value.fill(String(Number(await value.inputValue()) * 2));
  await expect(page.locator("[data-source-host-calculation-result] h3")).toContainText("编辑后");
  const editableDownload = page.waitForEvent("download");
  await page.locator("[data-source-host-export]").click();
  const editable = await readFile((await (await editableDownload).path())!, "utf8");
  const before = await page.locator("[data-source-host-calculation-result] h3").textContent();
  await page.locator("#calc-source-host-close").click();
  await page.locator("#calc-import").setInputFiles({ name: "source-host-calculation.json", mimeType: "application/json", buffer: Buffer.from(editable) });
  await expect(page.locator("[data-source-host-calculation-result] h3")).toHaveText(before!);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ durationFrames: (result.result as { duration: number }).duration, hits: result.applications.length, calculations: result.calculations.length, kinds,
    ampedHits: result.calculations.filter(row => row.request.kind === "damage" && row.request.input.amped).length,
    totalDamage: result.applications.reduce((sum, row) => sum + row.appliedDamage, 0), restoredEditable: before, errors }));
});
