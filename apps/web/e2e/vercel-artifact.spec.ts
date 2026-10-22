import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('prepared production files support direct routes, worker calculation and public UID errors', async ({ page, request }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/calculator', '/results', '/source-simulation']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  }
  const missing = await request.get('/assets/does-not-exist.js');
  expect(missing.status()).toBe(404);
  const badUid = await request.get('/api/showcase/not-a-uid');
  expect(badUid.status()).toBe(400);
  expect((await badUid.json()).error).toContain('UID');
  expect((await request.post('/api/showcase/123456789')).status()).toBe(405);
  expect((await request.get('/api/unknown')).status()).toBe(404);
  const manifest = await request.get('/source-host/manifest.json');
  expect(manifest.headers()['cache-control']).toBe('no-store');
  expect((await request.get('/source-host/source-files.json')).status()).toBe(200);

  await page.goto('/results');
  await expect(page.locator('footer')).toContainText('第三方许可 / 对应源码');
  const original = await readFile(new URL('../../../docs/fixtures/noelle-q-normal-reference.json', import.meta.url), 'utf8');
  await page.locator('#importInput').setInputFiles({ name: 'noelle-reference.json', mimeType: 'application/json', buffer: Buffer.from(original) });
  await expect(page.locator('#documentNotice')).toContainText('打开不会运行模拟');
  await page.locator('#runButton').click();
  await expect.poll(() => page.evaluate(() => window.GenshinDpsLab.getLastResult()?.damageEvents.length), { timeout: 30000 }).toBe(6);
  const result = await page.evaluate(() => window.GenshinDpsLab.getLastResult()!);
  expect(result.totalDamage).toBeCloseTo(105.67709476067012, 9);
  expect(result.damageEvents.map(hit => hit.frame)).toEqual([25, 66, 111, 146, 187, 240]);
  const legal = await request.get('/legal/');
  expect(legal.status()).toBe(200);
  expect(await legal.text()).toContain('AGPL-3.0-or-later');
  expect(errors).toEqual([]);
});
