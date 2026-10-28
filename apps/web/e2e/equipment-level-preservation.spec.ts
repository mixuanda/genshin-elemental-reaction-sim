import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { CalculatorDocument, CalculatorResult } from '@genshin-dps-lab/sim-core';

for (const level of [95, 100]) {
  test(`GOOD Lv.${level} survives import, equipment editing, saved-build reload and single-skill calculation`, async ({ page }) => {
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
    await expect(input).toHaveAttribute('max', String(level));
    await expect(page.locator('[data-equipment="characterLevelCap"]')).toHaveValue(String(level));
    await expect(page.locator('#build-constellation')).toHaveValue('0');
    await expect(page.locator('#build-status')).toContainText('已载入真实配装');
    await expect(page.locator('#build-panel-summary')).toContainText(level === 95 ? '13314.66' : '13772.11');
    await page.locator('[data-equipment="weapon"]').selectOption('weapon:11101');
    await expect(input).toHaveValue(String(level));
    await expect(page.locator('[data-equipment="characterLevelCap"]')).toHaveValue(String(level));
    await expect(page.locator('[data-equipment="weaponLevel"]')).toHaveAttribute('max', '70');
    await page.locator('[data-equipment="effectsDisabled"]').check();
    await page.locator('[data-equipment-apply]').click();
    await expect(page.locator('[data-equipment-status]')).toContainText('已应用');
    await expect(input).toHaveValue(String(level));
    await page.locator('#build-save').click();
    await expect(page.locator('#build-status')).toContainText('已保存');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gidps:editable-builds:v1')!));
    expect(saved[0].input.level).toBe(level);
    expect(saved[0].input.characterLevelCap).toBe(level);
    await page.reload();
    await page.locator('#build-load').click();
    await expect(page.locator('#build-status')).toContainText('已载入配装');
    await expect(page.locator('[data-equipment="level"]')).toHaveValue(String(level));
    await expect(page.locator('[data-equipment="characterLevelCap"]')).toHaveValue(String(level));
    await page.locator('#build-open-calculator').click();
    await expect(page).toHaveURL(/\/calculator$/);
    await expect(page.locator('#calc-results .calculator-audit pre')).toBeAttached();
    const audit = JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!) as { document: CalculatorDocument; result: CalculatorResult };
    expect(audit.document.characterLevel).toBe(level);
    expect(audit.document.build.mode).toBe('equipment-derived');
    if (audit.document.build.mode !== 'equipment-derived') throw new Error('equipment-derived route');
    expect(audit.document.build.equipment?.characterLevelCap).toBe(level);
    expect(audit.document.build.characterBaseAtk).toBeCloseTo(level === 95 ? 380.5005244 : 418.9759614, 8);
    expect(audit.result.totals?.expected).toBeGreaterThan(0);
    const pending = page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    const exported = JSON.parse(await readFile((await (await pending).path())!, 'utf8')) as CalculatorDocument;
    expect(exported.characterLevel).toBe(level);
    expect(exported.build).toEqual(audit.document.build);
    expect(errors).toEqual([]);
  });
}
