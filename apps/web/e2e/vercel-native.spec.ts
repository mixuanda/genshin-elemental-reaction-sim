import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';
import { captureSourceHostHit, replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';

const expected = {
  classic: { commit: 'b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541', sha256: '8e159a65991824908ecfa1226ae18a18c87b1956f9458dc7257bd97b249322f6' },
  stellar: { commit: 'a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd', sha256: 'a16817836d46ca096f24cf31e70e614002d4d443eae06c64ba5fe0ee8bc62744' }
} as const;

for (const variant of ['classic', 'stellar'] as const) {
  test(`${variant} production WASM runs real actions with integral frames and replayable damage`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const config = (await readFile(new URL('./fixtures/real-shatter/rotation-120.gcsim', import.meta.url), 'utf8')).replace('duration=120', 'duration=8');
    await page.goto('/source-simulation');
    await page.locator('#source-host-config').evaluate(el => {
      let parent = el.closest('details');
      while (parent) { parent.open = true; parent = parent.parentElement?.closest('details') ?? null; }
    });
    await page.locator('#source-host-config').fill(config);
    await page.locator('#source-host-seed').fill('12021');
    await page.locator('#source-host-variant').selectOption(variant);
    await page.locator('#source-host-run').click();
    await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败/, { timeout: 150000 });
    expect(await page.locator('#source-host-status').textContent(), await page.locator('[data-diagnostic-json]').textContent() ?? '').toContain('本次运行完成');
    await page.locator('#source-host-export').evaluate(el => { el.closest('details')!.open = true; });
    const downloading = page.waitForEvent('download');
    await page.locator('#source-host-export').click();
    const result = JSON.parse(await readFile((await (await downloading).path())!, 'utf8')) as SourceHostResult;
    expect(result.sourceCommit).toBe(expected[variant].commit);
    expect(result.executionArtifact?.wasmSha256).toBe(expected[variant].sha256);
    expect(result.applications.length).toBeGreaterThan(0);
    expect(new Set(result.applications.map(hit => hit.id)).size).toBe(result.applications.length);
    expect(result.applications.every(hit => Number.isInteger(hit.frame))).toBe(true);
    const total = result.applications.reduce((sum, hit) => sum + hit.appliedDamage, 0);
    expect(Number.isFinite(total) && total > 0).toBe(true);
    expect(Number(await page.locator('[data-source-host-overview-total]').getAttribute('data-value'))).toBe(total);
    const requests = new Map(result.calculations.map(calculation => [calculation.request.id, calculation.request]));
    const representative = result.applications.filter(hit => {
      const request = requests.get(hit.calculationId);
      return request?.kind === 'damage' && (request.ability === 'Frostgnaw' || request.ability === 'Glacial Waltz' || request.ability === 'Shatter');
    }).filter((hit, index, hits) => hits.findIndex(other => requests.get(other.calculationId)?.ability === requests.get(hit.calculationId)?.ability) === index);
    expect(representative.length).toBeGreaterThan(0);
    const replays = representative.map(hit => ({ id: hit.id, ability: requests.get(hit.calculationId)!.ability, frame: hit.frame, difference: replaySourceHostHit(captureSourceHostHit(result, hit.id)).difference }));
    expect(replays.every(replay => replay.difference === 0)).toBe(true);
    if (variant === 'classic') {
      expect(result.applications.filter(hit => requests.get(hit.calculationId)?.ability === 'Glacial Waltz').map(hit => hit.frame)).toEqual([106,146,186,226,266,306,346,386,426,466]);
      expect(total).toBeCloseTo(8918.12930387573, 7);
    }
    const notice = page.locator('[data-source-host-result-overview] [data-source-model-limit="kaeya-q"]');
    await expect(notice).toContainText('几何近似');
    expect(errors).toEqual([]);
    const directory = process.env.GIDPS_VERCEL_EVIDENCE ?? testInfo.outputDir;
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/${variant}-native.json`, JSON.stringify({ variant, url: page.url(), sourceCommit: result.sourceCommit, executionArtifact: result.executionArtifact, applications: result.applications.length, total, replays, errors }, null, 2));
  });
}
