/** Actual player-facing action selection and round trips, with explicit arithmetic panels. No native run. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
const [base, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(output); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], cases = []; page.on('pageerror', error => errors.push(error.message));
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
async function reveal(selector) { for (const row of (await page.locator(selector).locator('xpath=ancestor::details[not(@open)]').all()).reverse()) await row.locator(':scope > summary').click(); }
async function number(path, value) { const selector = `[data-field="${path}"]`; await reveal(selector); await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); }
async function state(group, key, value) { const selector = `[data-source-cast-state-field="gameContext.${group}.${key}"]`; await reveal(selector); await page.locator(selector).selectOption(value); }
async function action(text) { const option = page.locator('#calc-skill option').filter({ hasText: text }); assert.equal(await option.count(), 1); await page.locator('#calc-skill').selectOption(await option.getAttribute('value')); }
async function absorption() { const selector = '[data-source-cast-enum-field="gameContext.wandererPrimary.absorptionBonuses"]'; await reveal(selector); await page.locator(selector).selectOption('neither'); }
async function panel() { await number('build.stats.atk', 2000); await number('build.stats.critRate', .5); await number('build.stats.critDamage', 1); }
async function calculated(name, expected) {
  await expect.poll(async () => (await audit()).result.status).toBe('calculated');
  const value = await audit(); assert.ok(Math.abs(value.result.totals.expected - expected) < 1e-8);
  cases.push({ name, characterLevel: value.document.characterLevel, constellation: value.document.gameContext.constellation,
    talent: value.document.gameContext.effectiveTalentLevel, totals: value.result.totals, hits: value.result.hits.length }); return value;
}
async function roundtrip(name) {
  const before = await audit(), pending = page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const bytes = await readFile(await (await pending).path()), path = resolve(output, `${name}.json`); await writeFile(path, bytes, { flag: 'wx' });
  await page.locator('#calc-import').setInputFiles(path); await expect(page.locator('#calc-character-status')).toContainText('已载入文件中的计算文档');
  const after = await audit(); assert.deepEqual(after.document.gameContext, before.document.gameContext); assert.deepEqual(after.result.totals, before.result.totals);
}
try {
  await page.goto(`${base}/calculator`); await page.locator('#calc-character').selectOption('character:10000075'); await expect(page.locator('#calc-skill')).toBeEnabled();
  await action('空居·不生断第1段'); await reveal('#calc-constellation'); await page.locator('#calc-constellation').selectOption('6');
  await number('characterLevel', 100); await panel(); await absorption();
  await expect.poll(async () => (await audit()).result.status).toBe('blocked');
  await expect(page.locator('[data-field="gameContext.wandererPrimary.skillTalentLevel"]')).toBeVisible();
  await number('gameContext.wandererPrimary.skillTalentLevel', 13);
  await calculated('Wanderer Windfavored N1', 3035.9102088461538462);
  await action('第1段的C6追加'); await absorption();
  await expect(page.locator('[data-field="gameContext.wandererPrimary.skillTalentLevel"]')).toHaveValue('13');
  await state('wandererPrimary', 'c6ParentQualified', '1');
  await calculated('Wanderer independent C6 N1', 1214.3640835384615385);
  await roundtrip('wanderer-c6-extra');
  await action('狂言·式乐五番'); await page.locator('#calc-talent-level').fill('13'); await page.locator('#calc-talent-level').press('Tab');
  await absorption(); await state('wandererPrimary', 'burstWindfavoredAtCast', '1');
  await number('gameContext.wandererPrimary.burstC2ConsumedPointsUpTo50', 50);
  await state('wandererPrimary', 'burstConditionsStable', '1'); await state('wandererPrimary', 'burstAllHitsConnected', '1');
  await calculated('Wanderer Q five contacts / capped C2', 64966.153846153844);
  await roundtrip('wanderer-q-five');
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'wanderer-q-five.png') });
  await page.locator('#calc-character').selectOption('character:10000123'); await expect(page.locator('#calc-skill')).toBeEnabled();
  await action('白焰之龙·后台追击'); await page.locator('#calc-talent-level').fill('10'); await page.locator('#calc-talent-level').press('Tab');
  await reveal('#calc-constellation'); await page.locator('#calc-constellation').selectOption('2'); await panel();
  await number('gameContext.durinBurst.tickIndex', 10); await state('durinBurst', 'c2PyroBonusActive', '1');
  await calculated('Durin white Q tick 10 / A4', 5519.4048);
  await number('gameContext.durinBurst.tickIndex', 11); await calculated('Durin white Q tick 11 / no A4', 3449.628);
  await roundtrip('durin-white-q-tick');
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'durin-white-q-tick.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator('#calc-results')).toBeVisible();
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'durin-white-q-narrow.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(), nativeRuns: 0, independentPanelsNotPlayerBuild: true,
    cases, knownETalentPreservedAcrossOwnActions: true, missingEBlocksAndCorrectionRestores: true, savedReopenedContextAndDamageUnchanged: true,
    desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), audit: await audit(), cases, pageErrors: errors }, null, 2)); throw error;
} finally { await browser.close(); }
