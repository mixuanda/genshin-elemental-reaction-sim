/** Real local UI interaction, controlled panel, no player account/login. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [base = 'http://127.0.0.1:4205', output = '/tmp/GIDPS-iansan-team-20261023/browser'] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Use the existing local preview.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const root = 'gameContext.iansanSwiftResolvedCast', state = `${root}.sharedState`;
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
async function control(selector) {
  const node = page.locator(selector);
  await expect(node).toHaveCount(1);
  await node.evaluate(item => { for (let p = item.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true; });
  await expect(node).toBeVisible();
  return node;
}
async function flag(path, value) { await (await control(`select[data-source-cast-state-field="${path}"]`)).selectOption(value ? '1' : '0'); }
async function amount(path, value) {
  const node = await control(`input[data-field="${path}"]`);
  await node.fill(String(value)); await node.blur();
}
try {
  await page.goto(`${base}/calculator`);
  await page.locator('#calc-character').selectOption('character:10000110');
  const skill = page.locator('#calc-skill option').filter({ hasText: '雷霆飞缒 · 雷元素重击' });
  await expect(skill).toHaveCount(1);
  await page.locator('#calc-skill').selectOption(await skill.getAttribute('value'));
  await page.locator('#calc-scope').selectOption('single-hit');
  await page.locator('#calc-constellation').selectOption('6');
  await flag(`${state}.swiftQualifiedAtCast`, true);
  await flag(`${state}.a1ActiveAtSnapshot`, true);
  await amount(`${state}.baseAttack`, 1000);
  await amount(`${state}.includedA1Attack`, 0);
  await flag(`${state}.burstInactiveAtSnapshot`, false);
  await flag(`${state}.ownerOnFieldAtSnapshot`, true);
  await amount(`${root}.burstTalentLevel`, 10);
  await amount(`${state}.burstUpdateNonExtraAttack`, 2000);
  await amount(`${state}.burstUpdateNightsoulPoints`, 42);
  await amount(`${state}.includedBurstAttack`, 0);
  assert.equal((await audit()).result.status, 'blocked'); // C6 received state remains unknown.
  await flag(`${state}.c6DamageBonusActiveAtHit`, true);
  assert.equal((await audit()).result.status, 'blocked'); // Included amount also must be known.
  await amount(`${state}.includedC6DamageBonus`, 0);
  let result = await audit();
  const expected = (2000 + 200 + 540) * 1.6643 * 1.25 * .5 * .9;
  assert.equal(result.result.status, 'calculated');
  close(result.result.totals.nonCritical, expected);
  await expect(page.locator('.calculator-result-header')).toContainText('C6 · 有效普攻 Lv.10');
  await flag(`${state}.c6DamageBonusActiveAtHit`, false);
  close((await audit()).result.totals.nonCritical, expected / 1.25);
  await flag(`${state}.c6DamageBonusActiveAtHit`, true);
  // An already-included bonus must not be granted a second time.
  await amount('hits.0.damageBonus', .25);
  await amount(`${state}.includedC6DamageBonus`, .25);
  close((await audit()).result.totals.nonCritical, expected);
  result = await audit();
  const download = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const bytes = await readFile(await (await download).path());
  await writeFile(resolve(output, 'iansan-c6.json'), bytes, { flag: 'wx' });
  await page.reload();
  await page.locator('#calc-import').setInputFiles({ name: 'iansan-c6.json', mimeType: 'application/json', buffer: bytes });
  await expect.poll(async () => (await audit()).document.id).toBe(result.document.id);
  const reopened = await audit();
  assert.deepEqual(reopened.result.totals, result.result.totals);
  assert.deepEqual(reopened.document.gameContext, result.document.gameContext);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'iansan-c6-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('calc-expected')).toBeVisible();
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'iansan-c6-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ viewport: [1440, 390],
    status: 'passed', actualNonCrit: reopened.result.totals.nonCritical, expectedNonCrit: expected,
    c6UnknownBlocked: true, includedUnknownBlocked: true, inactiveDropsOnlyC6: true,
    alreadyIncludedNotDuplicated: true, exportedAndReopened: true, errors,
    scope: 'Linux Chromium local UI with a controlled panel; not native team or Windows verification' }, null, 2), { flag: 'wx' });
} finally { await browser.close(); }
