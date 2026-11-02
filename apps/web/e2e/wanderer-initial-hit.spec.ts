import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('C6 Wanderer initial E links actual conditions and keeps the full stance unsupported', async ({ page }) => {
  await page.goto('/calculator');
  await page.locator('#calc-character').selectOption('character:10000075');
  const action = page.locator('#calc-skill option').filter({ hasText: '羽画·E初击C0–C6' });
  await expect(action).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await action.getAttribute('value'))!);
  await page.locator('#calc-scope').selectOption('single-hit');
  await page.locator('#calc-constellation').selectOption('6');
  await page.locator('#calc-talent-level').fill('13');
  await page.locator('#calc-talent-level').blur();
  for (const [key, value] of Object.entries({
    characterLevel: '100', 'build.stats.atk': '2000', 'build.stats.critRate': '0.5',
    'build.stats.critDamage': '1', 'hits.0.damageBonus': '0',
  })) {
    await page.locator(`[data-field="${key}"]`).fill(value);
    await page.locator(`[data-field="${key}"]`).blur();
  }
  const requirements = page.locator('[data-calculator-required-field="true"]');
  await expect(requirements).toHaveCount(2);
  await expect(page.locator('#calc-results')).not.toContainText('此有限姿态分支只支持 C0');
  const audit = async () => JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect((await audit()).result.status).toBe('blocked');
  for (let i = 0; i < 2; i++) {
    const control=requirements.first().locator('select');
    await expect(control).toBeVisible();
    await control.selectOption('1');
  }
  const actual = await audit();
  const expected = 2000 * 2.023 * (200 / 390) * 0.9 * 1.5;
  expect(actual.document.gameContext).toMatchObject({ constellation: 6, effectiveTalentLevel: 13 });
  expect(actual.result.status).toBe('calculated');
  expect(actual.result.hits).toHaveLength(1);
  expect(actual.result.totals.expected).toBeCloseTo(expected, 8);
  const output = process.env.GIDPS_WANDERER_EVIDENCE ?? 'test-results/wanderer-initial';
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/browser-initial-e.json`, JSON.stringify({ fixture: 'synthetic panel; not a user account', expected, actual }, null, 2));
  await page.locator('#calc-results').screenshot({ path: `${output}/browser-initial-e.png` });
  await page.locator('#calc-scope').selectOption('one-cast');
  expect((await audit()).result.status).toBe('blocked');
  await expect(page.locator('#calc-results')).toContainText('此有限姿态分支只支持 C0');
});
