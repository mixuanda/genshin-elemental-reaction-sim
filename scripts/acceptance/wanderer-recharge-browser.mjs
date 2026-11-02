/** Local report/download acceptance only; never launches another simulation. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const [base = "http://127.0.0.1:4205", output = "/tmp/GIDPS-legal-recharge-evidence-20261023/browser"] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error("This acceptance command only uses an existing local preview.");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(`${base}/examples/wanderer-team-recharge.html`);
  assert.match(await page.title(), /合法充能配装对照/);
  const rows = page.locator("main > .scroll table tbody tr");
  assert.equal(await rows.count(), 6);
  const expected = ["244,413.35", "234,487.21", "225,578.95", "246,326.90", "232,255.53", "230,847.96"];
  for (let index = 0; index < expected.length; index++) assert.ok((await rows.nth(index).innerText()).includes(expected[index]));
  assert.match(await rows.nth(4).innerText(), /4 \/ 5/);
  for (const index of [2, 5]) assert.match(await rows.nth(index).innerText(), /5 \/ 5/);
  const response = await page.request.get(`${base}/examples/wanderer-team-recharge.comparison.json`);
  assert.equal(response.status(), 200);
  const comparison = await response.json();
  assert.equal(comparison.runs.length, 6);
  const downloads = [];
  for (const run of comparison.runs) {
    const url = `${base}/examples/wanderer-team-recharge.${run.variant}.${run.seed}.hits.csv`;
    const hitResponse = await page.request.get(url);
    assert.equal(hitResponse.status(), 200);
    const csv = (await hitResponse.text()).trim().split(/\r?\n/);
    assert.equal(csv.length - 1, run.hits);
    let sum = 0;
    for (const line of csv.slice(1)) {
      // Leading identity/frame and trailing damage/crit fields are numeric and
      // unquoted; ability labels in the middle may legitimately contain commas.
      const fields = line.split(","), frame = Number(fields[1]);
      assert.ok(Number.isInteger(frame) && frame >= 0 && frame < 7200);
      sum += Number(fields.at(-2));
    }
    assert.ok(Math.abs(sum - run.totalDamage) < 1e-6);
    assert.ok(Math.abs(run.actors.reduce((total, actor) => total + actor.damage, 0) - sum) < 1e-6);
    downloads.push({ variant: run.variant, seed: run.seed, rows: csv.length - 1, sum, conservesDamage: true });
  }
  for (const candidate of comparison.candidates) {
    assert.equal((await page.request.get(`${base}/examples/${candidate.equipmentAsset}`)).status(), 200);
    assert.equal((await page.request.get(`${base}/examples/${candidate.configAsset}`)).status(), 200);
  }
  await page.locator("main > details").nth(2).locator("summary").click();
  assert.equal(await page.locator("main > details").nth(2).locator("svg rect").count(), 120);
  await page.screenshot({ path: resolve(output, "recharge-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(layout.content <= layout.viewport, JSON.stringify(layout));
  for (let index = 0; index < 6; index++) {
    const dps = await rows.nth(index).locator("td").nth(3).boundingBox();
    assert.ok(dps && dps.x >= 0 && dps.x + dps.width <= 390, "DPS must be visible without horizontal scrolling on a narrow viewport");
  }
  await page.screenshot({ path: resolve(output, "recharge-390.png"), fullPage: true });
  await page.goto(`${base}/examples/wanderer-team-120-classic.html`);
  assert.match(await page.locator('[role="note"]').innerText(), /历史结果/);
  assert.equal(await page.locator('a[href="wanderer-team-recharge.html"]').count(), 1);
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, "acceptance.json"), JSON.stringify({ status: "passed", browser: await browser.version(), platform: process.platform, scope: "Local report and actual CSV downloads; no extra native simulation or real Windows execution", downloads, layout, errors }, null, 2));
  console.log(JSON.stringify({ status: "passed", actualRunDownloads: downloads.length, viewports: [1440, 390], nativeExecutions: 0 }));
} finally {
  await browser.close();
}
