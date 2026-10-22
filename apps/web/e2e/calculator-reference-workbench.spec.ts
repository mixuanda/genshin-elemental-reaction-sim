import {test, expect, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const report = async (page: Page) => JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
const evidence = process.env.GIDPS_SINGLE_SKILL_EVIDENCE;

for (const width of [1440, 390]) test(`player workbench keeps inputs and real skill damage accessible (${width}px)`, async ({page}) => {
  await page.setViewportSize({width, height: width === 390 ? 844 : 1000});
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/calculator');
  const navigation = page.getByRole('navigation', {name: '计算器区域'});
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', {name: '角色与招式', exact: true}).click();
  await expect(page.locator('#calc-character')).toBeFocused();
  await page.locator('#calc-character').selectOption('character:10000015');
  const frost = page.locator('#calc-skill option').filter({hasText: '霜袭·命中'});
  await expect(frost).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await frost.getAttribute('value'))!);

  await expect(page.locator('[data-calculator-equipment-editor]')).not.toHaveAttribute('open', '');
  await expect(page.locator('#calc-showcase-uid')).toBeHidden();
  await expect(page.locator('[data-calculator-hit-advanced] input').first()).toBeHidden();
  await expect(page.locator('#calc-results .calculator-trace').first()).toBeHidden();
  await expect(page.locator('#calc-results .calculator-aggregation-components table')).toBeHidden();
  expect(await page.locator('[data-build-controls]').evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('[data-calculator-equipment-editor]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

  await navigation.getByRole('button', {name: '配装与面板', exact: true}).click();
  await expect(page.getByRole('button', {name: '选择武器与圣遗物', exact: true})).toBeInViewport();
  for (const [field, value] of Object.entries({'build.stats.atk': '1700', 'build.stats.critRate': '0.4', 'build.stats.critDamage': '1', 'hits.0.damageBonus': '0.616'})) {
    await page.locator(`[data-field="${field}"]`).fill(value);
    await page.locator(`[data-field="${field}"]`).blur();
  }
  const expected = 1700 * 3.4416 * 1.616 * .5 * .9 * 1.4;
  const before = await report(page);
  expect(before.result.status).toBe('calculated');
  expect(before.result.totals.expected).toBeCloseTo(expected, 7);

  await navigation.getByRole('button', {name: '伤害结果', exact: true}).click();
  await expect(page.locator('.calculator-result-header')).toBeFocused();
  for (const id of ['calc-noncritical', 'calc-critical', 'calc-expected']) await expect(page.getByTestId(id)).toBeInViewport();
  const navBox = await navigation.boundingBox();
  expect(navBox!.y).toBeGreaterThanOrEqual(0);
  expect(navBox!.y).toBeLessThan(12);
  if (evidence) {
    await mkdir(evidence, {recursive: true});
    await page.screenshot({path: resolve(evidence, `gidps-result-after-${width}.png`)});
  }

  const components = page.locator('#calc-results .calculator-aggregation-components');
  await components.locator(':scope > summary').click();
  await expect(components.locator('[data-cast-component]')).toHaveCount(before.result.aggregation.components.length);
  await components.locator('[data-action="cast-open-hit"]').first().click();
  await expect(page.locator('.calculator-method-details')).toHaveAttribute('open', '');
  await expect(page.locator('#calc-results .calculator-hit-card .calculator-trace').first()).toBeVisible();
  expect(await report(page)).toEqual(before);
  await page.locator('.calculator-method-details > summary').click();

  await navigation.getByRole('button', {name: '配装与面板', exact: true}).click();
  await page.getByRole('button', {name: '选择武器与圣遗物', exact: true}).click();
  await expect(page.locator('[data-equipment="weapon"]')).toBeVisible();
  await expect(page.locator('[data-equipment="level"]')).toBeFocused();
  expect(await report(page)).toEqual(before);
  await page.locator('[data-calculator-equipment-editor] > summary').click();
  if (evidence) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({path: resolve(evidence, `gidps-workbench-after-${width}.png`), fullPage: true});
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('condition navigation focuses the existing required field while formulas stay folded', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/calculator');
  await page.locator('#calc-character').selectOption('character:10000075');
  const action = page.locator('#calc-skill option').filter({hasText: '羽画·E初击C0–C6'});
  await expect(action).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await action.getAttribute('value'))!);
  await page.locator('#calc-constellation').selectOption('6');
  await page.getByRole('navigation', {name: '计算器区域'}).getByRole('button', {name: '战斗条件', exact: true}).click();
  const conditions = page.locator('[data-calculator-inline-conditions]');
  const absorption = conditions.locator('select[data-source-cast-state-field$=".noAbsorption"]');
  await expect(absorption).toBeVisible();
  await expect(conditions.locator('input, select').first()).toBeFocused();
  await expect(page.locator('.calculator-method-details')).not.toHaveAttribute('open', '');
  await absorption.selectOption('0');
  expect((await report(page)).result.status).toBe('blocked');
  await absorption.selectOption('1');
  await conditions.locator('select[data-source-cast-state-field$=".panelExcludesAbsorptionBonuses"]').selectOption('1');
  expect((await report(page)).result.status).toBe('calculated');
  await expect(absorption).toBeVisible();
  if (evidence) await conditions.screenshot({path: resolve(evidence, 'gidps-required-condition-after-390.png')});
});
