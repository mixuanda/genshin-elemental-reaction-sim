/** Paired, instrumented actual UI performance run; no replacement request/result. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
const [base, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(output);
await mkdir(output, { recursive: true });
const sha = data => createHash('sha256').update(data).digest('hex');
const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const appDiff = execFileSync('git', ['diff', 'HEAD', '--', 'apps/web/src', 'packages', 'apps/web/public'], { encoding: 'utf8' });
const applicationPatchSha256 = sha(appDiff); // Explicit instrumentation/optimization state, never called a clean-HEAD run.
const startedAt = new Date().toISOString();
await writeFile(resolve(output, 'runner-start.json'), JSON.stringify({ startedAt, pid: process.pid, gitHead, applicationPatchSha256, base, nativeRunLimit: 1 }, null, 2), { flag: 'wx' });
const expected = JSON.parse(await readFile(new URL('../../apps/web/src/wanderer-public-scenario.er150.request.fixture.json', import.meta.url)));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.__nativeRequests = []; window.__nativeReceipts = []; window.__nativeFailures = [];
  window.__performanceTiming = null; window.__userClickAt = null;
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-wanderer-run]')) window.__userClickAt = performance.timeOrigin + performance.now();
  }, true);
  document.addEventListener('source-host-timing', event => {
    const resultRenderedAt = performance.timeOrigin + performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const paintedAt = performance.timeOrigin + performance.now();
      window.__performanceTiming = { ...event.detail, userClickAt: window.__userClickAt, resultRenderedAt, paintedAt,
        clickToRenderMs: resultRenderedAt - window.__userClickAt, clickToPaintMs: paintedAt - window.__userClickAt };
    }));
  });
  const NativeWorker = window.Worker;
  // An observer around the browser's real Worker, not a fake executor.
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      const url = new URL(args[0], location.href);
      if (url.pathname.includes('source-host-worker')) url.searchParams.set('gidps-profile', '1');
      super(url, ...args.slice(1));
      this.addEventListener('message', event => {
        const data = event.data;
        if (data?.type === 'result') window.__nativeReceipts.push({ type: data.type, elapsedMs: data.elapsedMs,
          timing: data.timing, receivedAt: performance.timeOrigin + performance.now(),
          seed: data.result.seed, actualHits: data.result.applications.length, artifact: data.result.executionArtifact });
        else if (data?.type === 'error') window.__nativeFailures.push({ message: data.message, diagnostic: data.diagnostic });
      });
    }
    postMessage(request, ...args) { window.__nativeRequests.push(structuredClone(request)); return super.postMessage(request, ...args); }
  };
});
let clickedAt;
try {
  await page.goto(`${base}/source-simulation`);
  await page.locator('[data-wanderer-load]').click();
  await expect(page.locator('[data-wanderer-run]')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('[data-member-tab]')).toHaveCount(4);
  await expect(page.locator('[data-member-field="level"]')).toHaveValue('100');
  clickedAt = Date.now();
  await page.locator('[data-wanderer-run]').click();
  await expect(page.locator('[data-source-host-overview-total]')).toBeVisible({ timeout: 150_000 });
  const clickToResultMs = Date.now() - clickedAt;
  await page.waitForFunction(() => window.__performanceTiming !== null);
  const browserTiming = await page.evaluate(() => window.__performanceTiming);
  await writeFile(resolve(output, 'timings.json'), JSON.stringify({ gitHead, applicationPatchSha256, browserTiming, clickToResultWallMs: clickToResultMs }, null, 2), { flag: 'wx' });
  const capture = await page.evaluate(() => ({ requests: window.__nativeRequests, receipts: window.__nativeReceipts, failures: window.__nativeFailures }));
  assert.equal(capture.requests.length, 1); assert.deepEqual(capture.requests[0], expected);
  assert.equal(capture.receipts.length, 1); assert.deepEqual(capture.failures, []);
  assert.equal(capture.receipts[0].actualHits, 610);
  await writeFile(resolve(output, 'worker-receipt.json'), JSON.stringify({ gitHead, clickToResultMs, ...capture }, null, 2), { flag: 'wx' });
  const pending = page.waitForEvent('download'); await page.locator('#source-host-export').click();
  const bytes = await readFile(await (await pending).path()), result = JSON.parse(bytes.toString());
  await writeFile(resolve(output, 'run.result.json'), bytes, { flag: 'wx' });
  await writeFile(resolve(output, 'run.request.json'), JSON.stringify(capture.requests[0], null, 2) + '\n', { flag: 'wx' });
  assert.equal(result.seed, '20261022'); assert.equal(result.observationWindow.actualEndFrame, 7200);
  assert.equal(result.executionArtifact.wasmSha256, '3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e');
  const queries = new Map(result.calculations.map(row => [row.request.id, row.request])), actors = {}, abilities = {};
  for (const hit of result.applications) {
    assert.ok(Number.isInteger(hit.frame) && hit.frame >= 0 && hit.frame < 7200);
    const query = queries.get(hit.calculationId); assert.ok(query);
    actors[query.actorKey] = (actors[query.actorKey] ?? 0) + hit.appliedDamage;
    const key = `${query.actorKey}|${query.ability}`; abilities[key] = (abilities[key] ?? 0) + hit.appliedDamage;
  }
  const total = result.applications.reduce((sum, hit) => sum + hit.appliedDamage, 0);
  assert.ok(Math.abs(Object.values(actors).reduce((sum, damage) => sum + damage, 0) - total) < 1e-6);
  assert.equal(total, 27069474.337322712);
  assert.equal(Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value')), total);
  await page.locator('[data-source-curve] > summary').click(); await page.locator('[data-curve-mode]').selectOption('events');
  await page.locator('[data-curve-events] > summary').click();
  await expect(page.locator('[data-curve-event-page]')).toContainText('610 笔');
  for (const [actor, damage] of Object.entries(actors)) assert.equal(Number(await page.locator(`[data-curve-table="actor"] [data-group="${actor}"]`).getAttribute('data-damage')), damage);
  await page.locator('[data-source-host-result-overview]').screenshot({ path: resolve(output, 'actual-team-result.png') });
  await page.locator('[data-source-curve]').screenshot({ path: resolve(output, 'actual-team-frame-curve.png') });
  // Reopen the NEW exported file; it must not launch a second Worker.
  await page.locator('#source-host-import').setInputFiles(resolve(output, 'run.result.json'));
  await expect(page.locator('#source-host-status')).toContainText('已导入并重算', { timeout: 120_000 });
  assert.equal(Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value')), total);
  assert.equal(await page.evaluate(() => window.__nativeRequests.length), 1);
  const again = page.waitForEvent('download'); await page.locator('#source-host-export').click();
  const reopenedBytes = await readFile(await (await again).path()), reopened = JSON.parse(reopenedBytes.toString());
  for (const key of ['config', 'seed', 'sourceCommit', 'executionArtifact', 'applications', 'energyApplications', 'abilityInvocations', 'observationWindow']) assert.deepEqual(reopened[key], result[key], key);
  await writeFile(resolve(output, 'run.reopened.json'), reopenedBytes, { flag: 'wx' });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', gitHead, startedAt, endedAt: new Date().toISOString(),
    actualNativeRuns: 1, applicationPatchSha256, browserTiming, worker: 'real WebAssembly and shared TS callbacks, pass-through observer only', browser: await browser.version(),
    seed: result.seed, sampleKind: 'one random seeded trial, not an estimate of the population mean', frames: 7200,
    hits: result.applications.length, total, dps: total / 120, byActor: actors, byActorAbility: abilities,
    wasmSha256: result.executionArtifact.wasmSha256, resultSha256: sha(bytes), reopenedSha256: sha(reopenedBytes),
    clickToResultMs, workerReceipt: capture.receipts[0], configSha256: sha(result.config),
    publicPresetClickToRealResult: true, savedNewResultReopenedWithoutAnotherNativeRun: true, frameAndActorCurveConserved: true,
    errors }, null, 2) + '\n', { flag: 'wx' });
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ gitHead, clickedAt, error: String(error), errors,
    status: await page.locator('#source-host-status').textContent().catch(() => null),
    worker: await page.evaluate(() => ({ requests: window.__nativeRequests, receipts: window.__nativeReceipts, failures: window.__nativeFailures })).catch(() => null) }, null, 2));
  throw error;
} finally { await browser.close(); }
