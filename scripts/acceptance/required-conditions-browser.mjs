/** Exercises the existing calculator UI. No team/native simulation. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [base = 'http://127.0.0.1:4205', output = '/tmp/GIDPS-applicable-failures-20261023/browser'] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Use an existing local preview.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
const state = path => page.locator(`select[data-source-cast-state-field="${path}"]`);
async function choose(character, label) {
  await page.goto(`${base}/calculator`);
  await page.locator('#calc-character').selectOption(character);
  await expect(page.locator('#calc-skill')).toBeEnabled();
  const option = page.locator('#calc-skill option').filter({ hasText: label });
  await expect(option).toHaveCount(1);
  await page.locator('#calc-skill').selectOption(await option.getAttribute('value'));
}
async function requireInline(selector) {
  const control = page.locator(selector);
  await expect(control).toBeVisible();
  assert.equal(await control.evaluate(el => Boolean(el.closest('[data-calculator-inline-conditions]'))), true);
  return control;
}
async function roundtrip() {
  const before = await audit();
  const pending = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const bytes = await readFile(await (await pending).path());
  await page.reload();
  await page.locator('#calc-import').setInputFiles({ name: 'required-conditions.json', mimeType: 'application/json', buffer: bytes });
  await expect.poll(async () => (await audit()).document.id).toBe(before.document.id);
  const after = await audit();
  assert.deepEqual(after.result.totals, before.result.totals);
  assert.deepEqual(after.document.gameContext, before.document.gameContext);
  return after;
}
try {
  await choose('character:10000003', '起终两次边界');
  assert.equal((await audit()).result.status, 'blocked');
  const jean = 'gameContext.batchFiniteCast';
  for (const key of ['completeCastConfirmed', 'statsStableAcrossHits']) {
    const control = await requireInline(`select[data-source-cast-state-field="${jean}.${key}"]`);
    await control.selectOption('1');
  }
  await expect(page.getByTestId('calc-expected')).toBeVisible();
  const q = await audit();
  assert.equal(q.result.hits.length, 3);
  // Pinned b4 T10 source coefficients, independent of document totals.
  assert.ok(Math.abs(q.result.totals.nonCritical - 2000 * (7.6464 + 1.4112 + 1.4112) * .5 * .9) < 1e-8);
  assert.ok(Math.abs(q.result.hits.reduce((sum, hit) => sum + hit.nonCritical, 0) - q.result.totals.nonCritical) < 1e-8);
  await state(`${jean}.statsStableAcrossHits`).selectOption('0');
  assert.equal((await audit()).result.status, 'blocked');
  await state(`${jean}.statsStableAcrossHits`).selectOption('1');
  assert.deepEqual((await roundtrip()).result.totals, q.result.totals);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'jean-conditions.png') });
  results.push({ action: 'Jean C0 complete Q', totals: q.result.totals, unknownBlocked: true, falseStableBlocked: true, savedConditionsAndTotalsUnchanged: true });

  await choose('character:10000100', '低空下落（一次碰撞及着地）');
  const plunge = 'gameContext.observedPlunge';
  assert.equal((await audit()).result.status, 'blocked');
  await (await requireInline(`select[data-source-cast-state-field="${plunge}.noExternalInfusion"]`)).selectOption('1');
  const count = await requireInline(`input[data-field="${plunge}.collisionCount"]`);
  // Actual sequential typing must retain its caret; invalid edits must stay
  // correctable without displaying/exporting stale damage.
  await count.click(); await page.keyboard.type('12'); await count.press('Tab');
  await expect(count).toHaveValue('12');
  await expect(page.locator(`select[data-source-cast-state-field^="${plunge}.collisionContacts."]`)).toHaveCount(12);
  await count.fill('1.5'); await count.press('Tab');
  await expect(count).toHaveValue('1.5');
  await expect(page.locator('[data-plunge-count-draft]')).toContainText('整数');
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  await count.fill(''); await count.press('Tab');
  assert.equal((await audit()).document.gameContext.observedPlunge.collisionCount, undefined);
  assert.equal((await audit()).result.status, 'blocked');
  await count.fill('1'); await count.press('Tab');
  await (await requireInline(`select[data-source-cast-state-field="${plunge}.collisionContacts.1"]`)).selectOption('1');
  await (await requireInline(`select[data-source-cast-state-field="${plunge}.landingContact"]`)).selectOption('1');
  await (await requireInline(`select[data-source-cast-state-field="${plunge}.statsStableAcrossHits"]`)).selectOption('1');
  await expect(page.getByTestId('calc-expected')).toBeVisible();
  const full = await audit();
  // Fixed source T10 ATK coefficients; controlled default panel ATK=2000.
  assert.ok(Math.abs(full.result.totals.nonCritical - 2000 * (1.26378 + 2.527025) * .5 * .9) < 1e-8);
  await count.fill('2');
  await expect(page.getByTestId('calc-expected')).toBeHidden();
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  await count.press('Tab');
  assert.equal((await audit()).result.status, 'blocked'); // New second contact is unknown.
  await count.fill('1'); await count.press('Tab');
  assert.deepEqual((await audit()).result.totals, full.result.totals);
  assert.deepEqual((await roundtrip()).result.totals, full.result.totals);
  await page.locator('#calc-scope').selectOption('single-hit');
  const selected = await audit();
  assert.equal(selected.result.status, 'calculated');
  assert.equal(selected.document.selectedHitIds.length, 1);
  assert.ok(selected.document.hits.every(hit => !hit.dependencies.includes('observed-plunge:schedule')));
  assert.ok(Math.abs(selected.result.totals.nonCritical - 2000 * 1.26378 * .5 * .9) < 1e-8);
  assert.deepEqual((await roundtrip()).result.totals, selected.result.totals);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'kachina-single-hit.png') });
  results.push({ action: 'Kachina physical low plunge and selected collision', full: full.result.totals, single: selected.result.totals, oldScheduleDependencyRemoved: true, draftHidesPreviousResult: true, savedConditionsAndTotalsUnchanged: true });
  assert.deepEqual(errors, []);
  const receipt = { status: 'passed', browser: await browser.version(), platform: process.platform, nativeRuns: 0, sourceInputs: 'Controlled existing default panels and explicit contact declarations; not player measurements', results, errors };
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: String(error), errors, completed: results }, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
}
