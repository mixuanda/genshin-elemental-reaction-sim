/** Real calculator controls and JSON roundtrips; no account or native runs. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [base = 'http://127.0.0.1:4205', output = '/tmp/GIDPS-traveler-iansan-20261023/browser'] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Use an existing local preview.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
const state = path => `select[data-source-cast-state-field="${path}"]`;
const number = path => `input[data-field="${path}"]`;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
async function inline(selector) {
  const control = page.locator(selector);
  await expect(control).toBeVisible();
  assert.equal(await control.evaluate(node => Boolean(node.closest('[data-calculator-inline-conditions]'))), true);
  return control;
}
async function choose(characterId, name, form) {
  await page.goto(`${base}/calculator`);
  await page.locator('#calc-character').selectOption(characterId);
  await expect(page.locator('#calc-skill')).toBeEnabled();
  if (form) await page.locator('#calc-form').selectOption(form);
  const option = page.locator('#calc-skill option').filter({ hasText: name });
  await expect(option).toHaveCount(1);
  await page.locator('#calc-skill').selectOption(await option.getAttribute('value'));
  await page.locator('#calc-scope').selectOption('single-hit');
  assert.equal((await audit()).result.status, 'blocked');
}
async function roundtrip() {
  const before = await audit(), pending = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const bytes = await readFile(await (await pending).path());
  await page.reload();
  await page.locator('#calc-import').setInputFiles({ name: 'resolved-single-hit.json', mimeType: 'application/json', buffer: bytes });
  await expect.poll(async () => (await audit()).document.id).toBe(before.document.id);
  const after = await audit();
  assert.equal(after.document.label, before.document.label);
  assert.deepEqual(after.document.gameContext, before.document.gameContext);
  assert.deepEqual(after.result.totals, before.result.totals);
  return after;
}
try {
  await choose('character:10000110', '雷霆飞缒·单次完整重击');
  const swift = 'gameContext.iansanSwiftResolvedCast.sharedState';
  for (const [key, value] of [['swiftQualifiedAtCast', '1'], ['burstInactiveAtSnapshot', '1'], ['a1ActiveAtSnapshot', '0']]) {
    await (await inline(state(`${swift}.${key}`))).selectOption(value);
  }
  const included = await inline(number(`${swift}.includedA1Attack`));
  await included.fill('0');
  await expect(page.getByTestId('calc-expected')).toBeVisible();
  const initial = await audit();
  // Fixed Optimizer normal-talent T10 vector; never use the E talent index.
  close(initial.result.totals.nonCritical, 2000 * 1.6643 * .5 * .9);
  await page.locator(state(`${swift}.burstInactiveAtSnapshot`)).selectOption('0');
  assert.equal((await audit()).result.status, 'blocked');
  assert.equal((await audit()).result.totals, undefined);
  await page.locator(state(`${swift}.burstInactiveAtSnapshot`)).selectOption('1');
  await included.fill('');
  assert.equal((await audit()).result.status, 'blocked');
  await included.click(); await page.keyboard.type('120.5');
  await expect(included).toHaveValue('120.5');
  close((await audit()).result.totals.nonCritical, (2000 - 120.5) * 1.6643 * .5 * .9);
  await included.fill('0');
  await page.locator(state(`${swift}.a1ActiveAtSnapshot`)).selectOption('1');
  assert.equal((await audit()).result.status, 'blocked');
  const baseAttack = await inline(number(`${swift}.baseAttack`));
  await baseAttack.click(); await page.keyboard.type('1000');
  await expect(baseAttack).toHaveValue('1000');
  const priorBuff = await audit();
  close(priorBuff.result.totals.nonCritical, (2000 + .2 * 1000) * 1.6643 * .5 * .9);
  assert.deepEqual((await roundtrip()).result.totals, priorBuff.result.totals);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'iansan-single-hit.png') });
  results.push({ action: 'Iansan C0 Swift T10', initial: initial.result.totals, priorBuff: priorBuff.result.totals,
    actualZeroAccepted: true, unknownAccountingBlocked: true, missingBurstRefreshEvidenceBlocked: true, multiDigitInputsPreserved: true, savedAndReopened: true });

  for (const [characterId, gender] of [['character:10000005', 'aether'], ['character:10000007', 'lumine']]) {
    await choose(characterId, '风息激荡 · 风伤与元素吸收', `${gender}-anemo`);
    const story = await inline(state('gameContext.travelerCrossEntityCast.trueMoonStoryBuffInactive'));
    await story.selectOption('0');
    assert.equal((await audit()).result.status, 'blocked');
    await story.selectOption('1');
    await expect(page.getByTestId('calc-expected')).toBeVisible();
    const hit = await audit();
    assert.equal(hit.document.scope, 'single-hit');
    await expect(page.locator('.calculator-result-header')).toContainText('单次命中');
    await expect(page.locator('.calculator-result-header')).not.toContainText('完整施放');
    close(hit.result.totals.nonCritical, 2000 * 1.4544 * .5 * .9);
    assert.equal(await page.locator('[data-calculator-inline-conditions] input').count(), 0);
    assert.deepEqual((await roundtrip()).result.totals, hit.result.totals);
    results.push({ action: `${gender} C0 anemo burst single hit`, totals: hit.result.totals,
      unknownAndFalseBlocked: true, noFutureScheduleOrSnapshotRequired: true, savedAndReopened: true });
  }
  assert.deepEqual(errors, []);
  const receipt = { status: 'passed', browser: await browser.version(), platform: process.platform,
    nativeRuns: 0, controlledPanels: true, results, errors };
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: String(error), completed: results, errors }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
