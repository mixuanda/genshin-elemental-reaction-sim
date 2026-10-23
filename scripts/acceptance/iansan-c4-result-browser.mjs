/** Reopen a saved real native result. Never starts a new simulation. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const [base, input, output] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? '') || !input || !output) {
  throw Error('Provide the existing local preview, actual saved result and a new evidence directory.');
}
await mkdir(output, { recursive: true });
const bytes = await readFile(input), result = JSON.parse(bytes.toString());
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(result.executionArtifact.wasmSha256, '237dd6b0c2ef45988a93f15fe1d2b7226c9a2b3ff8d1228b7a331fac9db1873c');
assert.equal(result.observationWindow.actualEndFrame, 7200);
const expected = result.applications.reduce((sum, row) => sum + row.appliedDamage, 0);
const requests = new Map(result.calculations.map(row => [row.request.id, row.request]));
const actors = new Map();
for (const hit of result.applications) {
  const key = requests.get(hit.calculationId)?.actorKey ?? 'unknown';
  actors.set(key, (actors.get(key) ?? 0) + hit.appliedDamage);
}
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let exported;
async function open(buffer, name) {
  await page.locator('#source-host-import').setInputFiles({ name, mimeType: 'application/json', buffer });
  await expect(page.locator('#source-host-status')).toContainText('已导入并重算', { timeout: 60_000 });
  assert.ok(Math.abs(Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value')) - expected) < 1e-8);
  await expect(page.locator('[data-source-host-overview-duration]')).toHaveText('120 秒');
  await expect(page.locator('[data-source-host-actor-damage]')).toHaveCount(actors.size);
}
try {
  await page.goto(`${base}/source-simulation`);
  await open(bytes, 'actual-iansan-120.json');
  await page.locator('[data-source-curve] > summary').click();
  await expect(page.locator('[data-curve-mode]')).toBeVisible();
  await expect(page.locator('[data-curve-end]')).toHaveValue('7200');
  for (const [key, value] of actors) {
    const row = page.locator(`[data-curve-table="actor"] [data-group="${key}"]`);
    assert.ok(Math.abs(Number(await row.getAttribute('data-damage')) - value) < 1e-8);
  }
  await page.locator('[data-curve-mode]').selectOption('events');
  await page.locator('[data-curve-events] > summary').click();
  await expect(page.locator('[data-curve-event-page]')).toContainText(`${result.applications.length} 笔`);
  const shown = await page.locator('[data-event-frame]').evaluateAll(rows => rows.map(row => Number(row.dataset.eventFrame)));
  assert.ok(shown.length > 0 && shown.every(frame => Number.isInteger(frame) && frame >= 0 && frame < 7200));
  await page.locator('[data-curve-mode]').selectOption('cumulative');
  await expect(page.locator('[data-curve-total]')).toContainText('累计终值');
  await page.locator('[data-source-host-result-overview]').screenshot({ path: resolve(output, 'iansan-120-overview.png') });
  await page.locator('[data-source-curve]').screenshot({ path: resolve(output, 'iansan-120-curve.png') });
  await page.locator('[data-source-host-result-details] > summary').click();
  const index = result.applications.findIndex(hit => requests.get(hit.calculationId)?.ability === 'Swift Stormflight');
  assert.ok(index >= 0);
  await page.locator('#source-host-hit-index').fill(String(index));
  await expect(page.locator('#source-host-hit')).toContainText('记账差值 0', { timeout: 30_000 });
  await page.locator('#source-host-export').evaluate(el => {
    for (let p = el.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
  });
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  exported = await readFile(await (await pending).path());
  const parsed = JSON.parse(exported.toString());
  assert.deepEqual(parsed.applications, result.applications);
  assert.deepEqual(parsed.executionArtifact, result.executionArtifact);
  assert.deepEqual(parsed.energyApplications, result.energyApplications);
  await writeFile(resolve(output, 'reopened.result.json'), exported, { flag: 'wx' });
  await page.reload();
  await open(exported, 'actual-iansan-120-reopened.json');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-source-host-overview-total]')).toBeVisible();
  await page.locator('[data-source-host-result-overview]').screenshot({ path: resolve(output, 'iansan-120-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(),
    platform: process.platform, nativeRuns: 0, savedInput: input, savedInputSha256: sha(bytes),
    exportedSha256: sha(exported), wasmSha256: result.executionArtifact.wasmSha256, frames: 7200,
    actualHits: result.applications.length, total: expected, byActor: Object.fromEntries(actors),
    frameCurve: true, cumulativeSteps: true, standaloneExplanation: true,
    applicationsAndEnergyUnchanged: true, desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} finally { await browser.close(); }
