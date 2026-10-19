import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { captureSourceHostHit, replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

async function download(page: Page, selector: string): Promise<unknown> {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function execute(page: Page, seed: string): Promise<SourceHostResult> {
  await page.locator('#source-host-seed').fill(seed);
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成', { timeout: 60_000 });
  await expect(page.locator('[data-source-host-randomness]')).toContainText('go-math-rand-rngSource-v1');
  return await download(page, '#source-host-export') as SourceHostResult;
}

test('native RNG receipt preserves uint64 semantics, catches stream aliases and travels with calculator context', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [], runs: Array<Record<string, unknown>> = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const source = (await readFile('packages/source-host/phase-example.gcsl', 'utf8')).replace('duration=16', 'duration=8').replace('  phase("rotation");\n', '');
  let aliasApplicationsEqual = false, importedEqual = false, calculatorMetadataEqual = false;
  try {
    await page.goto('/source-simulation');
    await page.locator('#source-host-config').fill(source);
    await page.locator('#source-host-phase-enabled').uncheck();
    await page.locator('#source-host-variant').selectOption('classic');
    const first = await execute(page, '1');
    const alias = await execute(page, '2147483648');
    for (const result of [first, alias]) {
      expect(result.randomness).toMatchObject({ effectiveSeed: '1', goVersion: 'go1.25.0', criticalTriggeredEffects: 'native-sampled' });
      expect(result.applications.length).toBeGreaterThan(0);
      runs.push({ lane: 'classic', seed: result.seed, randomness: result.randomness, executionArtifact: result.executionArtifact,
        applications: result.applications.length });
    }
    expect(alias.applications).toEqual(first.applications);
    expect(alias.energyApplications).toEqual(first.energyApplications);
    aliasApplicationsEqual = true;
    await page.getByText('多种子与额外充能对照', { exact: true }).click();
    await page.locator('#source-batch-seeds').fill('1,2147483648');
    await page.locator('#source-batch-run').click();
    await expect(page.locator('#source-batch-status')).toContainText('同一来源随机流');
    await page.locator('#source-startup-seeds').fill('0,89482311');
    await page.locator('#source-startup-run').click();
    await expect(page.locator('#source-startup-status')).toContainText('同一来源随机流');
    await page.locator('#source-host-variant').selectOption('stellar');
    const high = await execute(page, '18446744073709551615');
    expect(high.randomness).toMatchObject({ signedSeed: '-1', effectiveSeed: '2147483646', goVersion: 'go1.27.1' });
    runs.push({ lane: 'stellar', seed: high.seed, randomness: high.randomness, executionArtifact: high.executionArtifact,
      applications: high.applications.length });
    await page.locator('#source-host-import').setInputFiles({ name: 'rng-result.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(high)) });
    await expect(page.locator('#source-host-status')).toContainText('已导入');
    expect((await download(page, '#source-host-export') as SourceHostResult).randomness).toEqual(high.randomness);
    importedEqual = true;
    const capture = captureSourceHostHit(high, high.applications[0]!.id);
    expect(replaySourceHostHit(capture).difference).toBe(0);
    expect(capture.randomness).toEqual(high.randomness);
    await page.locator('#source-host-open-calculator').click();
    const calculation = await download(page, '[data-source-host-export]') as { originalCapture: { randomness: unknown } };
    expect(calculation.originalCapture.randomness).toEqual(high.randomness);
    calculatorMetadataEqual = true;
    expect(pageErrors).toEqual([]);
  } finally {
    await writeFile('docs/validation/source-rng-policy-browser-20260928.result.json', JSON.stringify({ runs, aliasApplicationsEqual, importedEqual, calculatorMetadataEqual, pageErrors }, null, 2) + '\n');
  }
});
