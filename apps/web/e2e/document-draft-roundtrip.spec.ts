import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { test, expect, type Download, type Page } from '@playwright/test';
import type { SimConfig } from '@genshin-dps-lab/schemas';

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

async function savedCopy(page: Page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('gidps:document:'));
    return keys.map(key => ({ key, text: localStorage.getItem(key)! }));
  });
}

test('JSON edit survives runtime control change, export, reopen and real Noelle calculation', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const original = await readFile(new URL('../../../docs/fixtures/noelle-q-normal-reference.json', import.meta.url), 'utf8');
  const edited = JSON.parse(original) as SimConfig;
  edited.meta.name = '诺艾尔 · 文档编辑往返';
  edited.duration = 12;
  // The fixed Noelle source contract intentionally freezes the character build.
  // Enemy scalar resistance is an allowed, real numerical input in this case.
  edited.enemy.resistance = 0.2;

  await page.goto('/results');
  await page.locator('#importInput').setInputFiles({ name: 'noelle-original.json', mimeType: 'application/json', buffer: Buffer.from(original) });
  await expect(page.locator('#documentNotice')).toContainText('打开不会运行模拟');
  expect(await savedCopy(page)).toEqual([]);
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  await page.locator('#jsonEditor').fill(JSON.stringify(edited, null, 2));
  await expect(page.locator('#documentNotice')).toContainText('自动保存');
  const beforeControl = await savedCopy(page);
  expect(JSON.parse(beforeControl[0]!.text).config.duration).toBe(12);

  await page.locator('#energyModeInput').selectOption('full');
  await page.locator('#critModeInput').selectOption('noCrit');
  const afterControl = await savedCopy(page);
  await testInfo.attach('draft-before-after-controls.json', {
    body: JSON.stringify({ beforeControl, afterControl }), contentType: 'application/json'
  });
  expect(afterControl).toHaveLength(1);
  const saved = JSON.parse(afterControl[0]!.text);
  expect(saved.config.duration).toBe(12);
  expect(saved.config.enemy.resistance).toBe(0.2);
  expect(saved.config.meta.name).toBe(edited.meta.name);
  expect(saved.controls.energyMode).toBe('full');
  expect(saved.controls.critMode).toBe('noCrit');
  expect(saved.original.text).toBe(original);
  expect(saved.verification).toBe('not-recomputed');
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();

  // A later basic control edit must also reach the JSON and exported copy.
  await page.locator('#durationInput').fill('18');
  await page.locator('#durationInput').blur();
  const merged = JSON.parse((await savedCopy(page))[0]!.text);
  expect(merged.config.duration).toBe(18);
  expect(JSON.parse(await page.locator('#jsonEditor').inputValue()).duration).toBe(18);
  expect(merged.config.enemy.resistance).toBe(0.2);

  const originalDownload = page.waitForEvent('download');
  await page.locator('#downloadOriginalDocument').click();
  expect(await downloadText(await originalDownload)).toBe(original);
  const editedDownload = page.waitForEvent('download');
  await page.locator('#exportButton').click();
  const exported = await downloadText(await editedDownload);
  expect(JSON.parse(exported)).toEqual(merged);
  await page.locator('#importInput').setInputFiles({ name: 'noelle-edited.gidps.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await expect(page.locator('#documentNotice')).toContainText('尚未重新模拟');
  expect(await page.evaluate(() => window.GenshinDpsLab.getConfig().duration)).toBe(18);
  expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  await page.locator('#runButton').click();
  await expect.poll(() => page.evaluate(() => window.GenshinDpsLab.getLastResult()?.damageEvents.length), { timeout: 30000 }).toBe(6);
  const result = await page.evaluate(() => window.GenshinDpsLab.getLastResult()!);
  // Independent arithmetic: C0/T1 Noelle, no artifacts/buffs/crit, all six hits
  // inside the existing Q conversion. Fixed source and assumptions are in the fixture.
  const attack = 39.2722 + 66.95325 * 0.4;
  const defense = 101 / (101 + 190);
  const expected = [0.672, 0.928, 0.7912, 0.73358, 0.86258, 1.13434].map(scaling => attack * scaling * defense * 0.8);
  expect(result.damageEvents.map(hit => hit.frame)).toEqual([25, 66, 111, 146, 187, 240]);
  for (const [i, hit] of result.damageEvents.entries()) expect(hit.finalDamage).toBeCloseTo(expected[i]!, 9);
  const total = expected.reduce((sum, damage) => sum + damage, 0);
  expect(result.totalDamage).toBeCloseTo(total, 9);
  expect(result.dps).toBeCloseTo(total / 18, 9);
  expect(result.config.meta.name).toBe(edited.meta.name);
  expect(errors).toEqual([]);
  await testInfo.attach('noelle-roundtrip-result.json', {
    body: JSON.stringify({ exported: JSON.parse(exported), expected, total, result }), contentType: 'application/json'
  });
});

test('run consumes the valid JSON draft without requiring an intermediate control change', async ({ page }) => {
  const original = await readFile(new URL('../../../docs/fixtures/noelle-q-normal-reference.json', import.meta.url), 'utf8');
  const edited = JSON.parse(original) as SimConfig;
  edited.duration = 12;
  edited.randomSeed = 'edited-document-direct-run';
  edited.enemy.resistance = 0.2;
  await page.goto('/results');
  await page.locator('#importInput').setInputFiles({ name: 'noelle.json', mimeType: 'application/json', buffer: Buffer.from(original) });
  await expect(page.locator('#documentNotice')).toContainText('打开不会运行模拟');
  await page.locator('#jsonEditor').fill(JSON.stringify(edited));
  await page.locator('#runButton').click();
  await expect.poll(() => page.evaluate(() => window.GenshinDpsLab.getLastResult()?.config.duration), { timeout: 30000 }).toBe(12);
  const result = await page.evaluate(() => window.GenshinDpsLab.getLastResult()!);
  expect(result.config.enemy.resistance).toBe(0.2);
  expect(result.resolvedRuntimeOptions.randomSeed).toBe(edited.randomSeed);
  expect(result.damageEvents[0]!.finalDamage).toBeCloseTo((39.2722 + 66.95325 * 0.4) * 0.672 * 101 / 291 * 0.8, 9);
});

test('incomplete or missing-input drafts block both run buttons and cannot overwrite the valid copy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const original = await readFile(new URL('../../../docs/fixtures/noelle-q-normal-reference.json', import.meta.url), 'utf8');
  await page.goto('/results');
  await page.locator('#importInput').setInputFiles({ name: 'noelle.json', mimeType: 'application/json', buffer: Buffer.from(original) });
  await expect(page.locator('#documentNotice')).toContainText('打开不会运行模拟');
  await page.locator('#jsonEditor').fill(original);
  const validCopy = await savedCopy(page);
  const missingSeed = JSON.parse(original);
  delete missingSeed.randomSeed;
  const downloads: Download[] = [];
  page.on('download', download => downloads.push(download));

  for (const invalid of ['{unfinished', JSON.stringify(missingSeed)]) {
    await page.locator('#jsonEditor').fill(invalid);
    await expect(page.locator('#documentNotice')).toContainText('编辑内容保留');
    await page.locator('#energyModeInput').selectOption('zero');
    await page.locator('#energyModeInput').dispatchEvent('change');
    await expect(page.locator('#documentNotice')).toContainText('未替换已保存副本或原件');
    await page.locator('#runButton').click();
    await expect(page.locator('#jsonError')).toBeVisible();
    await page.locator('#applyJsonButton').click();
    await expect(page.locator('#jsonError')).toBeVisible();
    await page.locator('#exportButton').click();
    await expect(page.locator('#documentNotice')).toContainText('副本导出失败');
    expect(await page.locator('#jsonEditor').inputValue()).toBe(invalid);
    expect(await savedCopy(page)).toEqual(validCopy);
    expect(await page.evaluate(() => window.GenshinDpsLab.getLastResult())).toBeNull();
  }
  expect(downloads).toHaveLength(0);
  expect(errors).toEqual([]);

  // A rejected conversion must leave the user's text repairable.
  const repaired = JSON.parse(original) as SimConfig;
  repaired.duration = 20;
  await page.locator('#jsonEditor').fill(JSON.stringify(repaired));
  await expect(page.locator('#documentNotice')).toContainText('自动保存');
  const saved = JSON.parse((await savedCopy(page))[0]!.text);
  expect(saved.config.duration).toBe(20);
  expect(saved.original.text).toBe(original);
});
