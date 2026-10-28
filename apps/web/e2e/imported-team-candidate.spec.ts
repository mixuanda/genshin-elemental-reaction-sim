import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function exportedDraft(page: Page) {
  const button = page.locator('[data-export-draft]');
  await button.evaluate(element => {
    for (let p = element.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
  });
  const pending = page.waitForEvent('download');
  await button.click();
  const downloaded = await pending;
  return JSON.parse(await readFile((await downloaded.path())!, 'utf8'));
}

test('a four-person imported candidate preserves equipment, talents and actions', async ({ page }) => {
  const base = JSON.parse(await readFile(new URL('./fixtures/player-import/kaeya-good.json', import.meta.url), 'utf8'));
  const keys = ['Kaeya', 'KaedeharaKazuha', 'Xingqiu', 'Bennett'];
  const good = {
    format: 'GOOD', version: 3, source: 'Synthetic four-sword handoff; not a player account',
    characters: keys.map(key => ({ ...base.characters[0], key })),
    weapons: keys.map(location => ({ ...base.weapons[0], location })),
    artifacts: keys.flatMap(location => base.artifacts.map((a: object) => ({ ...a, location }))),
  };
  await page.goto('/builds');
  await page.locator('#build-import').setInputFiles({ name: 'synthetic-four.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
  await expect(page.locator('[data-roster-check]')).toHaveCount(4);
  for (const input of await page.locator('[data-roster-check]').all()) { await expect(input).toBeEnabled(); await input.check(); }
  await page.locator('[data-roster-mode]').selectOption('replace');
  await page.locator('[data-roster-submit]').click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  await expect(page.locator('[data-member-tab]')).toHaveCount(4);
  await page.locator('[data-member-tab="0"]').click();
  await page.locator('[data-quick-action="skill"]').click();
  const before = await exportedDraft(page);
  expect(before.members).toHaveLength(4);
  expect(before.actions).toHaveLength(1);
  await page.locator('.product-nav a[href="/team-candidates"]').click();
  const candidate = page.locator('[data-current-team-candidate]');
  await expect(candidate).toContainText('枫原万叶');
  await expect(candidate).toContainText('行秋');
  await candidate.locator('[data-current-team-continue]').click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  expect(await exportedDraft(page)).toEqual(before);
});
