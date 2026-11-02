import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

async function openParents(page: Page, selector: string) {
  await expect(async () => {
    await page.locator(selector).evaluate(element => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
    });
    await expect(page.locator(selector)).toBeVisible({ timeout: 400 });
  }).toPass({ timeout: 4000 });
}
async function exportDraft(page: Page) {
  await openParents(page, '[data-export-draft]');
  const pending = page.waitForEvent('download');
  await page.locator('[data-export-draft]').click();
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

test('GOOD 95/100 -> team edit -> saved reopen -> native 120 seconds preserves actual character levels', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const good = {
    format: 'GOOD', version: 3, source: 'synthetic level handoff; not a player account',
    characters: [
      { key: 'KamisatoAyaka', level: 95, ascension: 6, constellation: 0, talent: { auto: 9, skill: 9, burst: 9 } },
      { key: 'Kaeya', level: 100, ascension: 6, constellation: 0, talent: { auto: 9, skill: 9, burst: 9 } },
    ],
    weapons: ['KamisatoAyaka', 'Kaeya'].map(location => ({ key: 'CoolSteel', location, level: 90, ascension: 6, refinement: 5 })), artifacts: [],
  };
  await page.goto('/builds');
  await page.locator('#build-import').setInputFiles({ name: 'synthetic-95-100.good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
  await expect(page.locator('[data-roster-check]')).toHaveCount(2);
  for (const input of await page.locator('[data-roster-check]').all()) { await expect(input).toBeEnabled(); await input.check(); }
  await page.locator('[data-roster-mode]').selectOption('replace');
  await expect(page.locator('[data-roster-submit]')).toBeEnabled();
  await page.locator('[data-roster-submit]').click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  console.log('handoff 95/100 received');
  await page.locator('[data-member-tab="0"]').click();
  await openParents(page, '[data-member-field="level"]');
  await expect(page.locator('[data-member-field="level"]')).toHaveValue('95');
  await expect(page.locator('[data-member-field="levelCap"]')).toHaveValue('95');
  await expect(page.locator('[data-member-field="level"]')).toHaveAttribute('max', '95');
  await expect(page.locator('[data-weapon-field="level"]')).toHaveAttribute('max', '90');
  await page.locator('[data-quick-action="skill"]').click();
  await page.locator('[data-member-tab="1"]').click();
  await expect(page.locator('[data-member-field="level"]')).toHaveValue('100');
  await expect(page.locator('[data-member-field="levelCap"]')).toHaveValue('100');
  await page.locator('[data-quick-action="skill"]').click();
  await page.locator('[data-quick-action="attack"]').click();
  await page.locator('[data-action-kind="2"]').selectOption('wait');
  await page.locator('[data-action-frames-field="2"]').fill('1200');
  await page.locator('[data-action-frames-field="2"]').press('Tab');
  await openParents(page, '[data-duration-preset]');
  await page.locator('[data-duration-preset]').selectOption('120');
  await page.locator('[data-startup]').selectOption('zero');
  await openParents(page, '[data-rotation-loop]');
  await page.locator('[data-rotation-loop]').selectOption('continuous');
  await openParents(page, '[data-preset-name]');
  await page.locator('[data-preset-name]').fill('95/100 等级保真');
  await page.locator('[data-preset-name]').press('Tab');
  await page.locator('[data-preset-save-new]').click();
  const savedId = await page.locator('[data-team-preset]').inputValue();
  const saved = await exportDraft(page);
  expect(saved.members.map((member: { level: number; levelCap: number }) => [member.level, member.levelCap])).toEqual([[95,95],[100,100]]);
  console.log('preset saved', saved.members.map((member: {level: number}) => member.level));
  await page.reload();
  await openParents(page, '[data-team-preset]');
  await page.locator('[data-team-preset]').selectOption(savedId);
  await page.locator('[data-preset-load]').click();
  expect(await exportDraft(page)).toEqual(saved);
  await page.locator('[data-run-direct]').click();
  console.log('native 120 second run requested');
  await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败|执行器错误/, { timeout: 70_000 });
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成');
  await openParents(page, '#source-host-export');
  const pending = page.waitForEvent('download');
  await page.locator('#source-host-export').click();
  const result = JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as SourceHostResult;
  await writeFile(info.outputPath('level-team-120.capture.json'), JSON.stringify(result));
  expect(result.observationWindow?.configuredEndFrame).toBe(7200);
  expect(result.observationWindow?.actualEndFrame).toBe(7200);
  const damage = result.calculations.map(row => row.request).filter(row => row.kind === 'damage');
  for (const [actorKey, level] of [['kamisatoayaka', 95], ['kaeya', 100]] as const) {
    const hits = damage.filter(row => row.actorKey === actorKey);
    expect(hits.length).toBeGreaterThanOrEqual(5);
    for (const hit of hits) if (hit.kind === 'damage') expect(hit.input.characterLevel).toBe(level);
    expect(result.energyApplications?.find(row => row.actorKey === actorKey)?.energyBefore).toBe(0);
  }
  expect(result.applications.length).toBe(damage.length);
  expect(errors).toEqual([]);
});
