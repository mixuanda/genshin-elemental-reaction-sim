/** Existing local preview only. Opens actual captures; launches no simulation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [base = 'http://127.0.0.1:4205', evidence = '/tmp/GIDPS-c2-crossmode-20261023'] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Use the existing local preview only.');
const out = resolve(evidence, 'browser');
await mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const oldBytes = await readFile(resolve(evidence, 'stellar-before/run.result.json'));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const status = page.locator('#source-host-status');
async function upload(bytes, name) {
  await page.locator('#source-host-import').setInputFiles({ name, mimeType: 'application/json', buffer: bytes });
}
async function download() {
  await page.locator('#source-host-export').evaluate(el => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const file = await pending;
  return readFile(await file.path());
}
try {
  await page.goto(`${base}/source-simulation`);
  await upload(oldBytes, 'actual-stellar-before.json');
  await expect(status).toContainText('已只读打开', { timeout: 30_000 });
  await expect(page.locator('[data-source-readonly-archive] [role="alert"]')).toContainText('未通过当前数值验证');
  await expect(page.locator('#source-host-reexecute')).toBeDisabled();
  assert.equal(await page.locator('#source-host-open-calculator').count(), 0);
  assert.equal(hash(await download()), hash(oldBytes));
  await page.locator('[data-source-curve] > summary').click();
  await expect(page.locator('[data-curve-event-table]')).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('[data-source-host-actor-damage]')).toHaveCount(4);
  await page.locator('[data-source-readonly-archive]').screenshot({ path: resolve(out, 'old-stellar-readonly.png') });
  const invalid = JSON.parse(oldBytes.toString()); invalid.sourceCommit = 'not-a-supported-source';
  await upload(Buffer.from(JSON.stringify(invalid)), 'invalid-source.json');
  await expect(status).toContainText('导入失败');
  await expect(page.locator('[data-source-readonly-archive]')).toBeAttached();
  assert.equal(hash(await download()), hash(oldBytes), 'Failed import must retain the original archive');
  const opened = [];
  for (const mode of ['stellar', 'classic']) {
    const bytes = await readFile(resolve(evidence, `${mode}-after/run.result.json`));
    const result = JSON.parse(bytes.toString());
    await upload(bytes, `actual-${mode}-corrected.json`);
    await expect(status).toContainText('已导入并重算', { timeout: 30_000 });
    assert.equal(await page.locator('[data-source-readonly-archive]').count(), 0);
    await expect(page.locator('#source-host-reexecute')).toBeEnabled();
    await expect(page.locator('[data-source-host-actor-damage]')).toHaveCount(4);
    const records = new Map(result.calculations.map(row => [row.request.id, row.request]));
    const index = result.applications.findIndex(hit => records.get(hit.calculationId).actorKey === 'wanderer' && records.get(hit.calculationId).attackTag === 6);
    assert.ok(index >= 0);
    await page.locator('[data-source-host-result-details] > summary').click();
    await page.locator('#source-host-hit-index').fill(String(index));
    await page.locator('[data-source-explain-hit]').click();
    await expect(page.locator('#source-host-hit')).toContainText('记账差值 0', { timeout: 30_000 });
    const exported = JSON.parse((await download()).toString());
    assert.equal(exported.sourceCommit, result.sourceCommit);
    assert.deepEqual(exported.applications, result.applications);
    assert.deepEqual(exported.executionArtifact, result.executionArtifact);
    await upload(Buffer.from(JSON.stringify(exported)), `${mode}-roundtrip.json`);
    await expect(status).toContainText('已导入并重算', { timeout: 30_000 });
    opened.push({ mode, sourceCommit: result.sourceCommit, hits: result.applications.length, firstQIndex: index, savedApplicationsUnchanged: true });
  }
  assert.deepEqual(errors, []);
  const receipt = { status: 'passed', browser: await browser.version(), platform: process.platform, nativeRuns: 0, archiveSha256: hash(oldBytes), originalExportByteIdentical: true, failedImportPreservesArchive: true, correctedModes: opened, errors };
  await writeFile(resolve(out, 'acceptance.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} finally {
  await browser.close();
}
