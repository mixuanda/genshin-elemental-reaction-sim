import { expect, test } from '@playwright/test';

for (const level of [95, 100]) {
  test(`GOOD Lv.${level} remains unchanged in the equipment editor and does not calculate as Lv.90`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/builds');
    const good = {
      format: 'GOOD', version: 3, source: 'synthetic-level-preservation',
      characters: [{ key: 'KamisatoAyaka', level, ascension: 6, constellation: 0, talent: { auto: 9, skill: 9, burst: 9 } }],
      weapons: [{ key: 'CoolSteel', location: 'KamisatoAyaka', level: 90, ascension: 6, refinement: 5 }],
      artifacts: []
    };
    await page.locator('#build-import').setInputFiles({
      name: `synthetic-level-${level}.good.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good))
    });
    await page.getByRole('button', { name: '编辑这套真实配装', exact: true }).click();
    const input = page.locator('[data-equipment="level"]');
    await expect(input).toHaveValue(String(level));
    await expect(input).toHaveAttribute('max', '100');
    await expect(page.locator('#build-constellation')).toHaveValue('0');
    await expect(page.locator('#build-status')).toContainText('80–90');
    await page.locator('[data-equipment="weapon"]').selectOption('weapon:11101');
    await expect(input).toHaveValue(String(level));
    await page.locator('[data-equipment-apply]').click();
    await expect(page.locator('[data-equipment-status]')).toContainText('80–90');
    await expect(input).toHaveValue(String(level));
    expect(errors).toEqual([]);
  });
}
