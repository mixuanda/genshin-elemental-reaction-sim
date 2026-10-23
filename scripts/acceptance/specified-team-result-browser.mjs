/** Real saved four-character result → visible files → frame curve → save/reopen.
 * This acceptance never calls a source-host worker or reruns the simulation. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const [base, input, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(input && output);
await mkdir(output, { recursive: true });
const bytes = await readFile(input), result = JSON.parse(bytes.toString());
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(bytes), 'e6ccae8bec3bfe8483eed2e32cc8387ed8eeb4e688162fdd5d6d6826f4c46af3');
assert.equal(result.executionArtifact.wasmSha256, '3e5fc685e2743552b4be8f14533f75794092d88b7236166e0ac38103bed5a53e');
assert.equal(result.observationWindow.actualEndFrame, 7200);
assert.equal(result.applications.length, 610);
for (const declared of [
  'wanderer char lvl=100/100 cons=6 talent=10,10,10;',
  'faruzan char lvl=90/90 cons=6 talent=10,10,10;',
  'nicole char lvl=90/90 cons=2 talent=10,10,10;',
  'durin char lvl=90/90 cons=2 talent=10,10,10;',
]) assert.ok(result.config.includes(declared), declared);
const requests = new Map(result.calculations.map(row => [row.request.id, row.request]));
const actors = new Map(), projections = new Map();
const total = result.applications.reduce((sum, row) => sum + row.appliedDamage, 0);
for (const hit of result.applications) {
  assert.ok(Number.isInteger(hit.frame) && hit.frame >= 0 && hit.frame < 7200);
  const request = requests.get(hit.calculationId);
  assert.ok(request?.actorKey);
  actors.set(request.actorKey, (actors.get(request.actorKey) ?? 0) + hit.appliedDamage);
  if (['Arcane Projection', 'Arcane Projection: Unity'].includes(request.ability)) {
    const label = request.ability === 'Arcane Projection' ? '协同投影（妮可Q）' : '命座投影（妮可C1）';
    projections.set(label, (projections.get(label) ?? 0) + hit.appliedDamage);
  }
}
assert.deepEqual([...actors.keys()].sort(), ['durin', 'faruzan', 'nicole', 'wanderer']);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} != ${expected}`);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function open(path) {
  await expect(page.locator('[data-source-result-files]')).toBeVisible();
  await expect(page.locator('#source-host-import').locator('..')).toBeVisible();
  await expect(page.locator('#source-host-export')).toBeVisible();
  await expect(page.locator('#source-host-cancel')).toBeVisible();
  // Large real results exceed Playwright's in-memory buffer transport limit.
  // Use its file transport, matching the user's normal file-picker flow.
  await page.locator('#source-host-import').setInputFiles(path);
  await expect(page.locator('#source-host-status')).toContainText('已导入并重算', { timeout: 120_000 });
  close(Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value')), total);
  await expect(page.locator('[data-source-host-overview-duration]')).toHaveText('120 秒');
  await expect(page.locator('[data-source-host-actor-damage]')).toHaveCount(4);
  await expect(page.locator('#source-host-export')).toBeEnabled();
  // This exact reviewed program may restore its equipment cards; arbitrary scripts must not be guessed.
  await expect(page.locator('[data-wanderer-run]')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('[data-member-tab]')).toHaveCount(4);
  await expect(page.locator('[data-member-field="level"]')).toHaveValue('100');
}
try {
  await page.goto(`${base}/source-simulation`);
  await open(input);
  await page.locator('[data-source-curve] > summary').click();
  await expect(page.locator('[data-curve-end]')).toHaveValue('7200');
  for (const [key, damage] of actors) {
    close(Number(await page.locator(`[data-curve-table="actor"] [data-group="${key}"]`).getAttribute('data-damage')), damage);
  }
  for (const [label, damage] of projections) {
    await page.locator('[data-curve-filter="source"]').selectOption(label);
    close(Number(await page.locator(`[data-curve-table="source"] [data-group="${label}"]`).getAttribute('data-damage')), damage);
  }
  await page.locator('[data-curve-filter="source"]').selectOption('');
  await page.locator('[data-curve-mode]').selectOption('events');
  await page.locator('[data-curve-events] > summary').click();
  await expect(page.locator('[data-curve-event-page]')).toContainText('610 笔');
  const frames = await page.locator('[data-event-frame]').evaluateAll(rows => rows.map(row => Number(row.dataset.eventFrame)));
  assert.ok(frames.length && frames.every(frame => Number.isInteger(frame) && frame < 7200));
  await page.locator('[data-curve-mode]').selectOption('cumulative');
  await page.locator('[data-source-host-result-overview]').screenshot({ path: resolve(output, 'specified-team-overview.png') });
  await page.locator('[data-source-curve]').screenshot({ path: resolve(output, 'specified-team-frame-curve.png') });
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const exported = await readFile(await (await pending).path()), reopened = JSON.parse(exported.toString());
  for (const key of ['config', 'seed', 'sourceCommit', 'executionArtifact', 'applications', 'energyApplications', 'observationWindow', 'startupState']) {
    assert.deepEqual(reopened[key], result[key], key);
  }
  await writeFile(resolve(output, 'saved-result.json'), exported, { flag: 'wx' });
  await page.reload();
  await open(resolve(output, 'saved-result.json'));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-source-host-overview-total]')).toBeVisible();
  await page.locator('[data-source-host-result-overview]').screenshot({ path: resolve(output, 'specified-team-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(),
    nativeRuns: 0, savedInput: input, savedInputSha256: sha(bytes), exportedSha256: sha(exported),
    wasmSha256: result.executionArtifact.wasmSha256, frames: 7200, actualHits: result.applications.length,
    total, dps: total / 120, byActor: Object.fromEntries(actors), projections: Object.fromEntries(projections),
    resultFilesVisibleWithoutOpeningAdvanced: true, originalFileUnchanged: sha(await readFile(input)) === sha(bytes),
    savedApplicationsEnergyAndConfigurationUnchanged: true, frameCurveAndSteps: true,
    desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} finally { await browser.close(); }
