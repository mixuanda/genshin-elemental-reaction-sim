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
async function reveal(selector) { for (const row of (await page.locator(selector).locator('xpath=ancestor::details[not(@open)]').all()).reverse()) await row.locator(':scope > summary').click(); }
async function number(path, value) { const selector = `[data-field="${path}"]`; await reveal(selector); await page.locator(selector).fill(String(value)); await page.locator(selector).press('Tab'); }
async function state(key, value) { const selector = `[data-source-cast-state-field="gameContext.nicoleSkillInitial.${key}"]`; await reveal(selector); await page.locator(selector).selectOption(value); }
try {
  await page.goto(`${base}/calculator`); await page.locator('#calc-character').selectOption('character:10000131'); await expect(page.locator('#calc-skill')).toBeEnabled();
  const option = page.locator('#calc-skill option').filter({ hasText: '启示·无始之光·初击' });
  await page.locator('#calc-skill').selectOption(await option.getAttribute('value')); await reveal('#calc-constellation'); await page.locator('#calc-constellation').selectOption('2');
  await number('build.stats.atk', 2000); await number('build.stats.critRate', .5); await number('build.stats.critDamage', 1);
  await number('gameContext.nicoleSkillInitial.skillGrantNonExtraAttack', 2000);
  for (const key of ['includedSkillAttack', 'includedC2ResistanceReduction']) await number(`gameContext.nicoleSkillInitial.${key}`, 0);
  for (const key of ['c2AttackIncludedInPanel', 'a1AttackIncludedInPanel']) await state(key, '0');
  for (const key of ['noOtherEventsBeforeInitial', 'noDisplacementBeforeInitial']) await state(key, '1');
  await expect.poll(async () => (await audit()).result.status).toBe('calculated'); const before = await audit();
  assert.ok(Math.abs(before.result.totals.expected - 5222.178) < 1e-8);
  assert.equal(before.document.gameContext.nicoleSkillInitial.grantAttackSource, 'observed');
  assert.equal(await page.locator('[data-source-cast-state-field="gameContext.nicoleSkillInitial.targetInC2AreaAtInitial"]').count(), 0);
  await state('noDisplacementBeforeInitial', '0'); await expect.poll(async () => (await audit()).result.status).toBe('blocked');
  await state('noDisplacementBeforeInitial', '1'); await expect.poll(async () => (await audit()).result.status).toBe('calculated');
  const pending = page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const bytes = await readFile(await (await pending).path()), path = resolve(output, 'nicole-initial.json'); await writeFile(path, bytes, { flag: 'wx' });
  await page.locator('#calc-import').setInputFiles(path); await expect(page.locator('#calc-character-status')).toContainText('已载入文件中的计算文档');
  const after = await audit(); assert.deepEqual(after.document.gameContext, before.document.gameContext); assert.deepEqual(after.result.totals, before.result.totals);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'nicole-c2-e-initial.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator('#calc-results')).toBeVisible();
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'nicole-c2-e-initial-narrow.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reveal('#calc-equipment-controls');
  await page.locator('[data-equipment="weapon"]').selectOption('weapon:14523');
  await page.locator('[data-equipment="weaponEffectsEnabled"]').check();
  await page.locator('[data-equipment="effectsDisabled"]').check();
  await page.locator('[data-equipment="setEffectsEnabled"]').uncheck();
  assert.equal(await page.locator('[data-equipment-formula="weaponEffectActive"]').inputValue(), '');
  await state('noOtherEventsBeforeInitial', 'unknown');
  await page.locator('[data-equipment-apply]').click();
  await expect(page.locator('[data-equipment-status]')).toContainText('请先确认');
  assert.equal((await audit()).document.build.mode, 'manual-final');
  await state('noOtherEventsBeforeInitial', '1');
  await page.locator('[data-equipment-apply]').click();
  await expect(page.locator('[data-equipment-status]')).toContainText('已应用');
  await expect.poll(async () => (await audit()).result.status).toBe('calculated');
  const gear = await audit(), build = gear.document.build;
  assert.equal(build.mode, 'equipment-derived'); assert.equal(build.equipment.weaponId, 'weapon:14523');
  assert.equal(build.equipment.refinement, 1); assert.equal(build.equipment.artifacts.length, 0);
  // This deliberately bare source build is only an input-path test, not a graduation preset.
  const sample = (build.characterBaseAtk + build.weaponBaseAtk) * (1 + build.atkPercent + .12) + build.flatAtk;
  assert.ok(Math.abs(gear.document.gameContext.nicoleSkillInitial.skillGrantNonExtraAttack - sample) < 1e-8);
  assert.equal(gear.document.gameContext.nicoleSkillInitial.grantAttackSource, 'equipment-current');
  assert.equal(await page.locator('[data-equipment-formula="weaponEffectActive"]').inputValue(), 'true');
  assert.equal(await page.locator('[data-equipment-formula="offField"]').inputValue(), 'false');
  assert.ok(Math.abs(Number(await page.locator('[data-equipment-formula="catalystSnapshotAtk"]').inputValue()) - sample) < 1e-8);
  const expected = (sample + Math.min(sample * .15, 600) + 300) * 2.4912 * .5 * 1.075
    * (1 + Math.min(sample * .0001, .26)) * (1 + Math.min(1, Math.max(0, build.critRate)) * build.critDamage);
  assert.ok(Math.abs(gear.result.totals.expected - expected) < 1e-8);
  const gearDownload = page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const gearPath = resolve(output, 'nicole-signature-equipment.json');
  await writeFile(gearPath, await readFile(await (await gearDownload).path()), { flag: 'wx' });
  await page.locator('#calc-import').setInputFiles(gearPath); await expect(page.locator('#calc-character-status')).toContainText('已载入文件中的计算文档');
  const gearReopened = await audit(); assert.deepEqual(gearReopened.result.totals, gear.result.totals);
  assert.deepEqual(gearReopened.document.build, gear.document.build);
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'nicole-r1-auto-sample.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify({ status: 'passed', browser: await browser.version(), nativeRuns: 0,
    independentPanelNotPlayerBuild: true, constellation: 2, effectiveELevel: 10, totals: after.result.totals,
    sameHitC2RangeAutomaticallyDerived: true, manualSampleOriginRecorded: true,
    signatureEquipment: { firstSample: sample, independentExpected: expected, actualTotals: gear.result.totals,
      unknownTimingRejectedBeforeApply: true, freshSourceSampleNotOldManualSample: true, automaticConditionsShown: true,
      savedReopenedBuildAndDamageUnchanged: true, bareEquipmentNotGraduationPreset: true },
    unsatisfiedConditionBlocksAndCorrectionRestores: true, savedReopenedContextAndDamageUnchanged: true, desktopAndNarrow: true, errors }, null, 2) + '\n', { flag: 'wx' });
} catch (error) { await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), audit: await audit(), errors }, null, 2)); throw error; }
finally { await browser.close(); }
