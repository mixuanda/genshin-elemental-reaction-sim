/** Public fixed equipment and adaptive program wiring; Worker is intercepted, never executed. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
const [base, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(output);
await mkdir(output, { recursive: true });
const expected = JSON.parse(await readFile(new URL('../../apps/web/src/wanderer-public-scenario.er150.request.fixture.json', import.meta.url)));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.__scenarioRequests = []; window.__scenarioWorkers = [];
  window.Worker = class {
    constructor(url) { this.url = String(url); this.terminated = false; window.__scenarioWorkers.push(this); }
    postMessage(request) { window.__scenarioRequests.push(structuredClone(request)); }
    terminate() { this.terminated = true; }
  };
});
const draft = () => page.evaluate(async () => {
  // Reuse the actual Vite module instance, including its current HMR version.
  const url = performance.getEntriesByType('resource').map(row => row.name).filter(name => /\/src\/source-host-panel\.ts(?:\?|$)/.test(name)).at(-1);
  if (!url) throw new Error('The visible team panel module was not loaded.');
  return (await import(url)).getCurrentSourceTeamDraft();
});
try {
  await page.goto(`${base}/source-simulation`);
  await expect(page.locator('[data-wanderer-load]')).toBeVisible();
  await expect(page.locator('[data-wanderer-run]')).toBeDisabled();
  await page.locator('[data-wanderer-load]').click();
  await expect(page.locator('[data-wanderer-run]')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('[data-member-tab]')).toHaveCount(4);
  const loaded = await draft();
  assert.deepEqual(loaded.members.map(row => [row.characterKey, row.level, row.constellation, row.weapon.refinement]),
    [['wanderer', 100, 6, 5], ['faruzan', 90, 6, 5], ['nicole', 90, 2, 1], ['durin', 90, 2, 1]]);
  assert.deepEqual(loaded.actions, []); assert.equal(loaded.startup, 'full');
  assert.deepEqual(await page.evaluate(() => window.__scenarioRequests), []);
  await page.locator('[data-wanderer-run]').click();
  await expect.poll(() => page.evaluate(() => window.__scenarioRequests.length)).toBe(1);
  assert.deepEqual(await page.evaluate(() => window.__scenarioRequests[0]), expected);
  await expect(page.locator('#source-host-cancel')).toBeEnabled();
  await page.locator('#source-host-cancel').click();
  assert.ok(await page.evaluate(() => window.__scenarioWorkers.every(worker => worker.terminated)));
  await page.locator('[data-team-section="equipment"] > summary').click();
  await page.locator('[data-member-field="level"]').fill('95');
  await page.locator('[data-member-field="level"]').dispatchEvent('change');
  await expect(page.locator('[data-wanderer-run]')).toBeDisabled();
  assert.equal((await draft()).members[0].level, 95);
  await expect(page.locator('[data-wanderer-status]')).toContainText('已改动');
  // Failed preset refresh preserves the edited draft; there is no fallback equipment or run.
  await page.route('**/examples/wanderer-team-recharge.er150.gcsl', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.locator('[data-wanderer-load]').click();
  await expect(page.locator('[data-wanderer-status]')).toContainText('未载入');
  assert.equal((await draft()).members[0].level, 95);
  await page.unroute('**/examples/wanderer-team-recharge.er150.gcsl');
  await page.locator('[data-wanderer-load]').click();
  await expect(page.locator('[data-wanderer-run]')).toBeEnabled();
  assert.equal((await draft()).members[0].level, 100);
  await page.locator('[data-wanderer-scenario]').screenshot({ path: resolve(output, 'specified-team-entry.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-wanderer-run]')).toBeVisible();
  await page.locator('[data-wanderer-scenario]').screenshot({ path: resolve(output, 'specified-team-entry-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(),
    nativeRuns: 0, worker: 'intercepted request only; no simulated result supplied', actualWorkerRequests: 1,
    exactOriginalRequest: true, allFourEquipmentCards: true, level100Preserved: true,
    editingUnbindsOriginalProgram: true, failurePreservesEdits: true, cancellationTerminatesWorker: true,
    desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} finally { await browser.close(); }
