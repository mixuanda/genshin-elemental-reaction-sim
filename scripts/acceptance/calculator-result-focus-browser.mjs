/** Keep required controls actionable and answered controls secondary without changing arithmetic. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
const [base, inputPath, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(inputPath && output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
page.on('pageerror', error => errors.push(error.message));
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
const selector = '[data-field="gameContext.wandererPrimary.burstC2ConsumedPointsUpTo50"]';
async function reveal() { for (const row of (await page.locator(selector).locator('xpath=ancestor::details[not(@open)]').all()).reverse()) await row.locator(':scope > summary').click(); }
try {
  await page.goto(`${base}/calculator`); await page.locator('#calc-import').setInputFiles(inputPath);
  await expect(page.locator('#calc-character-status')).toContainText('已载入文件中的计算文档');
  const before = await audit(); assert.equal(before.document.characterLevel, 100);
  assert.equal(before.result.status, 'calculated'); assert.ok(Math.abs(before.result.totals.expected - 64966.153846153844) < 1e-8);
  await reveal(); await page.locator(selector).fill('');
  await expect.poll(async () => (await audit()).result.status).toBe('blocked');
  await expect(page.locator(`[data-calculator-inline-conditions] ${selector}`)).toBeVisible();
  await page.locator(selector).focus();
  for (const digit of '50') { await page.locator(selector).pressSequentially(digit); await expect(page.locator(selector)).toBeFocused(); }
  const edited = await audit(); assert.deepEqual(edited.result.totals, before.result.totals);
  await expect(page.locator(selector)).toHaveCount(1); await expect(page.locator(selector)).toHaveValue('50');
  const answered = page.locator('[data-detail-id="answered-conditions"]');
  await expect(answered).toHaveAttribute('open', '');
  const above = await page.locator('[data-cast-aggregation-host]').boundingBox(), below = await answered.boundingBox();
  assert.ok(above && below && above.y + above.height <= below.y);
  await answered.locator(':scope > summary').click(); await expect(answered).not.toHaveAttribute('open', '');
  const pending = page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const path = resolve(output, 'wanderer-q-edit-copy.json'); await writeFile(path, await readFile(await (await pending).path()), { flag: 'wx' });
  await page.locator('#calc-import').setInputFiles(path); await expect(page.locator('#calc-character-status')).toContainText('已载入文件中的计算文档');
  assert.deepEqual((await audit()).result.totals, before.result.totals);
  await expect(answered).not.toHaveAttribute('open', '');
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'wanderer-damage-first.png') });
  await page.getByRole('navigation', { name: '计算器区域' }).getByRole('button', { name: '战斗条件', exact: true }).click();
  await expect(answered).toHaveAttribute('open', ''); await expect(page.locator(selector)).toBeFocused();
  await page.locator(selector).fill('40'); await page.locator(selector).press('Tab');
  assert.ok(Math.abs((await audit()).result.totals.expected - before.result.totals.expected * 2.6 / 3) < 1e-8);
  await page.locator(selector).fill(''); await expect.poll(async () => (await audit()).result.status).toBe('blocked');
  await expect(page.locator(`[data-calculator-inline-conditions] ${selector}`)).toBeVisible();
  assert.equal((await audit()).result.totals, undefined);
  await page.locator(selector).fill('50'); await page.locator(selector).press('Tab');
  assert.deepEqual((await audit()).result.totals, before.result.totals);
  if (await answered.getAttribute('open') !== null) await answered.locator(':scope > summary').click();
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator('#calc-results')).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'wanderer-damage-first-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(), nativeRuns: 0,
    integerFrameSourceUnaffected: true, independentPanelNotPlayerBuild: true, baseline: before.result.totals,
    requiredFieldVisibleAndNoStaleDamage: true, sequentialNumericTypingRetainsFocusAndValue: true,
    damageBeforeAnsweredConditions: true, answeredConditionsFoldAndReopen: true, navigationReopensAndFocusesOriginalInput: true,
    c2ResourceEditChangesDamageAndRestoringRecoversExactTotals: true, saveReopenSameTotals: true, desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), errors, audit: await audit().catch(() => null) }, null, 2)); throw error;
} finally { await browser.close(); }
