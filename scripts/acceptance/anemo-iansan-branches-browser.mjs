/** Visible calculator actions, actual shared-core results and saved JSON.
 * Controlled panels, no account access or native/team simulation. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [base = 'http://127.0.0.1:4205', output = '/tmp/GIDPS-anemo-iansan-20261023/browser'] = process.argv.slice(2);
const only = process.argv[4];
if (only && !['iansan', 'anemo', 'charged', 'saved-display'].includes(only)) throw Error('Unknown case.');
const selected = name => !only || only === name;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Use the existing local preview.');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const audit = async () => JSON.parse(await page.locator('#calc-results .calculator-audit pre').textContent());
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const state = path => `select[data-source-cast-state-field="${path}"]`;
const number = path => `input[data-field="${path}"]`;
const choice = path => `select[data-source-cast-enum-field="${path}"]`;
const text = path => `input[data-source-cast-text-field="${path}"]`;
async function visible(selector) {
  const control = page.locator(selector);
  await expect(control).toHaveCount(1);
  // Expand native details as a user can; never inject a calculation document.
  await control.evaluate(node => { for (let parent = node.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true; });
  await expect(control).toBeVisible();
  return control;
}
async function setState(path, value) { await (await visible(state(path))).selectOption(value ? '1' : '0'); }
async function setNumber(path, value) { const control = await visible(number(path)); await control.fill(String(value)); await control.blur(); }
async function choose(character, name, form) {
  await page.goto(`${base}/calculator`);
  await page.locator('#calc-character').selectOption(character);
  await expect(page.locator('#calc-skill')).toBeEnabled();
  if (form) await page.locator('#calc-form').selectOption(form);
  const option = page.locator('#calc-skill option').filter({ hasText: name });
  await expect(option).toHaveCount(1);
  await page.locator('#calc-skill').selectOption(await option.getAttribute('value'));
}
async function roundtrip(name) {
  const before = await audit(), pending = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const bytes = await readFile(await (await pending).path());
  await page.reload();
  await page.locator('#calc-import').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: bytes });
  await expect.poll(async () => (await audit()).document.id).toBe(before.document.id);
  const after = await audit();
  assert.deepEqual(after.document.gameContext, before.document.gameContext);
  assert.deepEqual(after.result.totals, before.result.totals);
  assert.equal(after.document.label, before.document.label);
  await writeFile(resolve(output, `${name}.json`), bytes);
  return after;
}
try {
  let a;
  if (selected('saved-display') && only === 'saved-display') {
    const evidenceRoot = process.argv[5] ?? resolve(output, '..');
    for (const [name, file, expected, count, excluded] of [
      ['iansan-active-q', 'browser/iansan-active-q.json', 1902.2949, 1, 0],
      ['aether-c6-absorbed-q', 'anemo-browser-final/aether-c6-absorbed-q.json', 19753.2, 18, 0],
      ['aether-c6-physical-charged', 'charged-browser/aether-c6-physical-charged.json', 994.5, 1, 1],
    ]) {
      if (process.argv[6] && name !== process.argv[6]) continue;
      await page.goto(`${base}/calculator`);
      await page.locator('#calc-import').setInputFiles(resolve(evidenceRoot, file));
      await expect(page.getByTestId('calc-expected')).toBeVisible();
      a = await audit();
      assert.equal(a.result.status, 'calculated');
      close(a.result.totals.nonCritical, expected);
      const details = page.locator('details.calculator-hit-selection-details');
      await expect(details.locator('summary')).toHaveText(`命中范围：计入 ${count} 段 · 排除 ${excluded} 段`);
      assert.equal(await details.getAttribute('open'), null);
      await details.locator('summary').click();
      await expect(details.locator('p')).toBeVisible();
      await details.locator('summary').click();
      await page.locator('#calc-results').screenshot({ path: resolve(output, `${name}.png`) });
      results.push({ action: `${name} saved calculation display`, totals: a.result.totals, count, excluded,
        hitListCollapsedByDefault: true, detailsCanBeOpened: true });
    }
  }
  if (selected('iansan')) {
  await choose('character:10000110', '雷霆飞缒 · 雷元素重击');
  await page.locator('#calc-scope').selectOption('single-hit');
  const swift = 'gameContext.iansanSwiftResolvedCast', sw = `${swift}.sharedState`;
  await setState(`${sw}.swiftQualifiedAtCast`, true);
  await setState(`${sw}.a1ActiveAtSnapshot`, false);
  await setNumber(`${sw}.includedA1Attack`, 0);
  await setState(`${sw}.burstInactiveAtSnapshot`, false);
  await setState(`${sw}.ownerOnFieldAtSnapshot`, true);
  await setNumber(`${sw}.burstUpdateNonExtraAttack`, 2000);
  await setNumber(`${sw}.burstUpdateNightsoulPoints`, 42);
  await setNumber(`${sw}.includedBurstAttack`, 0);
  assert.equal((await audit()).result.status, 'blocked'); // No borrowed normal-talent level.
  await setNumber(`${swift}.burstTalentLevel`, 10);
  a = await audit();
  assert.equal(a.result.status, 'calculated');
  close(a.result.totals.nonCritical, (2000 + 540) * 1.6643 * .5 * .9);
  await setNumber(`${sw}.burstUpdateNightsoulPoints`, 41);
  close((await audit()).result.totals.nonCritical, (2000 + 410) * 1.6643 * .5 * .9);
  await setNumber(`${sw}.burstUpdateNightsoulPoints`, 42);
  await setNumber(`${swift}.burstTalentLevel`, 1);
  a = await audit();
  assert.equal(a.document.gameContext.effectiveTalentLevel, 10);
  close(a.result.totals.nonCritical, (2000 + 330) * 1.6643 * .5 * .9);
  await setNumber(`${swift}.burstTalentLevel`, 10);
  a = await roundtrip('iansan-active-q');
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'iansan-active-q.png') });
  results.push({ action: 'Iansan C0 Swift normal T10 + independent Q10 feedback', totals: a.result.totals,
    unknownQBlocked: true, points41And42: [1804.93335, 1902.2949], q1WithNormalT10: 1745.01855, savedAndReopened: true });
  }

  if (selected('anemo')) {
  await choose('character:10000005', '风息激荡 · 风伤与元素吸收', 'aether-anemo');
  await page.locator('#calc-constellation').selectOption('6');
  await page.locator('#calc-scope').selectOption('one-cast');
  const cross = 'gameContext.travelerCrossEntityCast';
  for (const key of ['trueMoonStoryBuffInactive', 'freshCastConfirmed', 'noHitlag', 'noInterruption', 'noReplacement', 'fullObservedLifetime', 'statsStableAcrossHits']) await setState(`${cross}.${key}`, true);
  for (const [key, value] of [['casterId', 'controlled-aether'], ['targetId', 'controlled-target']]) await (await visible(text(`${cross}.${key}`))).fill(value);
  await setState(`${cross}.anemo.noAbsorption`, false);
  await (await visible(choice(`${cross}.anemo.absorptionElement`))).selectOption('pyro');
  await setNumber(`${cross}.anemo.absorptionStartFrame`, 39);
  await setNumber(`${cross}.anemo.elementDamageBonuses.pyro`, .5);
  await setState(`${cross}.anemo.c6InitiallyInactive`, true);
  await setNumber(`${cross}.sharedState.includedC6ResistanceReduction`, 0);
  await setNumber(`${cross}.observedThroughFrame`, 336);
  for (let i = 1; i <= 9; i++) {
    await setState(`${cross}.targetContacts.tick-${i}`, true);
    await setState(`${cross}.targetContacts.absorb-${i}`, true);
  }
  a = await audit();
  assert.equal(a.result.status, 'calculated');
  assert.equal(a.result.hits.length, 18);
  close(a.result.hits[0].nonCritical, 1308.96);
  close(a.result.hits[1].nonCritical, 602.64);
  close(a.result.hits[2].nonCritical, 1527.12);
  close(a.result.hits[3].nonCritical, 703.08);
  close(a.result.totals.nonCritical, 1308.96 + 602.64 + 8 * (1527.12 + 703.08));
  close(a.result.hits.reduce((sum, hit) => sum + hit.nonCritical, 0), a.result.totals.nonCritical);
  await expect(page.locator('.calculator-result-header')).toContainText('火元素吸收 · C6');
  await expect(page.locator('.calculator-result-header')).not.toContainText('无吸收完整');
  const full = a.result.totals;
  await setNumber(`${cross}.observedThroughFrame`, 335);
  assert.equal((await audit()).result.status, 'blocked');
  await setNumber(`${cross}.observedThroughFrame`, 336);
  await setState(`${cross}.targetContacts.absorb-1`, false);
  a = await audit();
  assert.equal(a.result.status, 'calculated');
  close(a.result.hits.find(hit => hit.id.endsWith(':absorb-2')).nonCritical, 602.64);
  close(a.result.totals.nonCritical, full.nonCritical - 602.64 - (703.08 - 602.64));
  await setState(`${cross}.targetContacts.absorb-1`, true);
  await setNumber(`${cross}.anemo.absorptionStartFrame`, 94);
  assert.equal((await audit()).result.status, 'blocked');
  await setNumber(`${cross}.anemo.absorptionStartFrame`, 39);
  a = await roundtrip('aether-c6-absorbed-q');
  await page.locator('#calc-results').screenshot({ path: resolve(output, 'aether-c6-absorbed-q.png') });
  results.push({ action: 'Aether C6 Q T10, 39f Pyro absorption, independent elemental bonuses', totals: a.result.totals,
    hits: a.result.hits.length, noSelfDebuffOnFirstPair: true, missedFirstAbsorbDoesNotDebuff: true,
    nonCheckFrame94Blocked: true, maleLifecycleRequires336Frames: true, conservation: true, savedAndReopened: true });
  }

  if (selected('charged')) {
  await choose('character:10000005', '风元素空·完整基础物理重击', 'aether-anemo');
  await page.locator('#calc-constellation').selectOption('6');
  await page.locator('#calc-scope').selectOption('single-hit');
  const male = 'gameContext.travelerMaleChargedCast.sharedState';
  await setState(`${male}.externalInfusionActive`, false);
  await setState(`${male}.trueMoonStoryBuffEnabled`, false);
  a = await audit();
  assert.equal(a.result.status, 'calculated');
  close(a.result.totals.nonCritical, 2000 * 1.105 * .5 * .9);
  await setState(`${male}.externalInfusionActive`, true);
  assert.equal((await audit()).result.status, 'blocked');
  await setState(`${male}.externalInfusionActive`, false);
  a = await roundtrip('aether-c6-physical-charged');
  results.push({ action: 'Aether Anemo C6 physical charged first hit, normal T10', totals: a.result.totals,
    actualInfusionStillBlocked: true, savedAndReopened: true });
  }
  assert.deepEqual(errors, []);
  const receipt = { status: 'passed', browser: await browser.version(), platform: process.platform,
    controlledPanels: true, nativeOrTeamRuns: 0, results, errors };
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} catch (error) {
  try { await writeFile(resolve(output, 'last-calculation.json'), JSON.stringify(await audit(), null, 2) + '\n'); } catch {}
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: String(error), completed: results, errors }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
