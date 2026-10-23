/** Identity/artifact-input acceptance only: an explicit empty axis, not team DPS or character-mechanic coverage. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const [base, output] = process.argv.slice(2);
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(output);
await mkdir(output, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const applicationPatchSha256 = sha(execFileSync('git', ['diff', 'HEAD', '--', 'apps/web/index.html', 'apps/web/src', 'packages']));
await writeFile(resolve(output, 'runner-start.json'), JSON.stringify({ gitHead, applicationPatchSha256, startedAt: new Date().toISOString(),
  scope: 'Fixed character qualification and capture roundtrip, empty axis. Not a 120-second team calculation.' }), { flag: 'wx' });
const config = JSON.parse(await readFile(new URL('../../docs/fixtures/lunar-mixed-reference.synthetic.json', import.meta.url), 'utf8'));
const identities = [
  { id: 'wanderer', name: '流浪者', element: 'anemo', level: 100, energyMax: 60 },
  { id: 'faruzan', name: '珐露珊', element: 'anemo', level: 90, energyMax: 80 },
  { id: 'nicole', name: '妮可', element: 'pyro', level: 90, energyMax: 60 },
  { id: 'durin', name: '杜林', element: 'pyro', level: 90, energyMax: 70 },
];
const baselineActor = config.characters[0];
config.characters = identities.map(identity => ({ ...structuredClone(baselineActor), ...identity, initialEnergy: 0 }));
// The chosen Silken Moon 2pc static ER is explicitly supplied once. At zero
// Moonsign its 4pc effect must not be initialized. No character damage is modeled.
config.characters[2].stats.energyRecharge += 0.2;
config.meta = { name: '月兆身份边界验收（无攻击，非队伍DPS基准）', version: '1', verificationStatus: 'user-supplied',
  note: 'Identity-only synthetic panel: no skills, hits, real equipment or character state simulation claimed.' };
config.duration = 1; config.cycleLength = 1; config.rotation = [];
config.timeline = { ...config.timeline, initialActiveCharacterId: 'wanderer', abilities: [], commands: [] };
const record = { format: 'simulation-record-v1', sourceConfig: config,
  options: { energyMode: 'configured', critMode: 'noCrit', compatibilityMode: 'legal-frame-v1', randomSeed: 'specified-party-moonsign-zero',
    execution: { captureHits: true, detailedTraces: false } }, iterations: 1, executionProfile: null, benchmark: null };
await writeFile(resolve(output, 'identity-only-input.json'), JSON.stringify(record, null, 2), { flag: 'wx' });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
page.on('pageerror', error => errors.push(error.message));
const download = async () => {
  const pending = page.waitForEvent('download');
  await page.locator('[data-lunar-action="export"]').click();
  return readFile(await (await pending).path());
};
try {
  await page.goto(`${base}/results`);
  await page.locator('#importInput').setInputFiles(resolve(output, 'identity-only-input.json'));
  // Read-only legacy opening keeps old result tabs disabled, but an independent
  // special run must be accessible without running an ordinary simulation first.
  await expect(page.locator('.tab[data-tab="overview"]')).toBeDisabled();
  await expect(page.locator('.tab[data-tab="special"]')).toBeEnabled();
  await page.locator('.tab[data-tab="special"]').click();
  await expect(page.locator('[data-lunar-action="refresh"]')).toBeVisible();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator('[data-lunar-profile]').selectOption('lunar-mixed');
  for (const [index, identity] of identities.entries()) await page.locator(`[data-lunar-party-index="${index}"]`).selectOption(identity.id);
  await page.locator('[data-lunar-artifact-index="2"]').selectOption('artifact-set:15042');
  const level = page.locator('[data-lunar-moonsign]');
  await expect(level).toHaveValue('0'); await expect(level).toHaveAttribute('readonly', '');
  await expect(level).toHaveAttribute('data-moonsign-origin', 'party');
  await expect(page.locator('[data-lunar-moonsign-status]')).toContainText('自动确定 0 级');
  await page.locator('[data-moonlight-artifact-baseline]').check();
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-status]')).toContainText('转换资格', { timeout: 20_000 });
  await expect(page.locator('[data-lunar-action="export"]')).toBeDisabled();
  // Known zero is not permission to manufacture a lunar reaction. Separately
  // test a qualified one-grant input; an empty axis still has no actual trigger.
  const qualified = structuredClone(record);
  const enabler = { id: 'ineffa', name: '伊涅芙', element: 'electro', level: 90 };
  Object.assign(qualified.sourceConfig.characters[1], enabler);
  await page.locator('#importInput').setInputFiles({ name: 'one-grant-identity-only-input.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(qualified)) });
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-action="refresh"]').click();
  await page.locator('[data-lunar-profile]').selectOption('lunar-charged');
  for (const [index, identity] of identities.entries()) await page.locator(`[data-lunar-party-index="${index}"]`).selectOption(index === 1 ? 'ineffa' : identity.id);
  await page.locator('[data-lunar-artifact-index="2"]').selectOption('artifact-set:15042');
  await expect(page.locator('[data-lunar-moonsign]')).toHaveValue('1');
  await expect(page.locator('[data-lunar-moonsign]')).toHaveAttribute('readonly', '');
  await page.locator('[data-moonlight-artifact-baseline]').check();
  await page.locator('[data-lunar-action="run"]').click();
  await expect(page.locator('[data-lunar-action="export"]')).toBeEnabled({ timeout: 20_000 });
  const bytes = await download(), captured = JSON.parse(bytes.toString());
  assert.equal(captured.request.config.moonlightArtifactModel.moonsignLevel, 1);
  assert.equal(captured.request.config.characters.find(actor => actor.id === 'wanderer').level, 100);
  assert.deepEqual(captured.request.config.timeline.commands, []);
  assert.equal(captured.result.specialDamageEvents.length, 0, 'No qualification or zero-input probe may manufacture a damage event.');
  const path = resolve(output, 'one-grant-identity-only-capture.json');
  await writeFile(path, bytes, { flag: 'wx' });
  await page.reload();
  await page.locator('.tab[data-tab="special"]').click();
  await page.locator('[data-lunar-import]').setInputFiles(path);
  await expect(page.locator('[data-lunar-status]')).toContainText('捕获记录可复现', { timeout: 20_000 });
  await expect(page.locator('[data-lunar-moonsign]')).toHaveValue('1');
  await expect(page.locator('[data-lunar-moonsign]')).toHaveAttribute('data-moonsign-origin', 'capture');
  const reopenedBytes = await download(), reopened = JSON.parse(reopenedBytes.toString());
  assert.deepEqual(reopened.request, captured.request); assert.deepEqual(reopened.result, captured.result);
  assert.deepEqual(await readFile(path), bytes, 'Opening the saved capture must not change its original file.');
  await writeFile(resolve(output, 'one-grant-identity-only-reopened.json'), reopenedBytes, { flag: 'wx' });
  await page.locator('[data-lunar-panel]').screenshot({ path: resolve(output, 'one-grant-readonly.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.tab[data-tab="special"]')).toBeVisible();
  await expect(page.locator('[data-lunar-moonsign]')).toBeVisible();
  await page.screenshot({ path: resolve(output, 'one-grant-narrow.png') });
  assert.deepEqual(errors, []);
  const summary = { status: 'passed', gitHead, applicationPatchSha256, browser: await browser.version(),
    scope: 'Specified party qualification 0 and rejection without an enabler; separate one-grant empty-axis input roundtrip, no invented character attacks; not a new native 120-second sample.',
    identities, specifiedPartyAutomaticMoonsign: 0, noEnablerRunRejected: true, qualifiedInputAutomaticMoonsign: 1, actualSpecialDamageEvents: captured.result.specialDamageEvents.length,
    savedRequestAndCompleteResultExactlyPreserved: true, originalFileUnchanged: true, reopenedOrigin: 'capture',
    accessibleAfterReadOnlyImportWithoutOrdinarySimulation: true, desktopAndNarrowEntryVisible: true,
    captureSha256: sha(bytes), reopenedSha256: sha(reopenedBytes), errors };
  await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(summary, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(summary));
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: String(error), pageErrors: errors }, null, 2), { flag: 'wx' });
  await page.screenshot({ path: resolve(output, 'failure.png') });
  throw error;
} finally { await browser.close(); }
