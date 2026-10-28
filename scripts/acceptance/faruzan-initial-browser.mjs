import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
const [base, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(output); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
async function reveal(selector) {
  for (const details of (await page.locator(selector).locator('xpath=ancestor::details[not(@open)]').all()).reverse()) await details.locator(':scope > summary').click();
}
async function number(path, value) {
  const selector = `[data-field="${path}"]`; await reveal(selector); await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab');
}
async function state(key, value) {
  const selector = `[data-source-cast-state-field="gameContext.faruzanBurstInitial.${key}"]`;
  await reveal(selector); await page.locator(selector).selectOption(value);
}
try {
  await page.goto(`${base}/calculator`); await page.locator('#calc-character').selectOption('character:10000076');
  await expect(page.locator('#calc-skill')).toBeEnabled();
  const option = page.locator('#calc-skill option').filter({ hasText: '抟风秘道·初击' });
  await page.locator('#calc-skill').selectOption(await option.getAttribute('value'));
  await reveal('#calc-constellation'); await page.locator('#calc-constellation').selectOption('6');
  await page.locator('#calc-talent-level').fill('13'); await page.locator('#calc-talent-level').press('Tab');
  await number('build.stats.atk', 2000); await number('build.stats.critRate', .5); await number('build.stats.critDamage', 1);
  for (const key of ['baseAttack', 'includedBurstDamageBonus', 'includedA4BaseDamage', 'includedResistanceReduction']) await number(`gameContext.faruzanBurstInitial.${key}`, key === 'baseAttack' ? 1000 : 0);
  await state('c6CritDamageIncludedInPanel', '0');
  for (const key of ['freshBurstNoPriorEffects', 'insideBurstArea', 'noOtherAnemoBeforeInitial']) await state(key, '1');
  await expect.poll(async () => (await audit()).result.status).toBe('calculated');
  const before = await audit();
  assert.ok(Math.abs(before.result.totals.expected - 17311.0014) < 1e-8);
  assert.equal(before.document.gameContext.constellation, 6); assert.equal(before.document.gameContext.effectiveTalentLevel, 13);
  await state('insideBurstArea', '0');
  await expect.poll(async () => (await audit()).result.status).toBe('blocked');
  await expect(page.locator('[data-source-cast-state-field="gameContext.faruzanBurstInitial.insideBurstArea"]')).toBeVisible();
  await state('insideBurstArea', '1');
  await expect.poll(async () => (await audit()).result.status).toBe('calculated');
  const download = page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const data = await readFile(await (await download).path());
  await writeFile(resolve(output, 'faruzan-initial.json'), data, { flag: 'wx' });
  await page.locator('#calc-import').setInputFiles(resolve(output, 'faruzan-initial.json'));
  await expect(page.locator('#calc-character-status')).toContainText('已载入文件中的计算文档');
  const after = await audit();
  assert.deepEqual(after.document.gameContext, before.document.gameContext); assert.deepEqual(after.result.totals, before.result.totals);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'faruzan-c6-q-initial.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#calc-results')).toBeVisible();
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'faruzan-c6-q-initial-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(), nativeRuns: 0,
    independentFixture: true, constellation: 6, effectiveQTLevel: 13, totals: after.result.totals,
    unknownOrFalseConditionBlocks: true, correctingConditionRestoresCalculation: true,
    savedReopenedContextAndDamageUnchanged: true, desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), audit: await audit(), pageErrors: errors }, null, 2));
  throw error;
} finally { await browser.close(); }
