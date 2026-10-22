import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const evidence=process.env.GIDPS_SINGLE_SKILL_EVIDENCE;
for(const width of [1365,390]) test(`player calculator starts without a teaching result and keeps an explicit lesson separate (${width}px)`,async({page})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width,height:width===390?844:1000});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/calculator');
  await expect(page.locator('[data-calculator-start]')).toBeVisible();
  await expect(page.locator('#calc-character')).toHaveValue('');
  await expect(page.getByTestId('calc-expected')).toHaveCount(0);
  await expect(page.locator('#calc-example-select')).toBeHidden();
  await expect(page.locator('#calc-workspace')).toBeHidden();
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:resolve(evidence,`02-player-start-${width}.png`)});}
  await page.locator('[data-action="choose-character"]').first().click();
  await expect(page.locator('#calc-character')).toBeFocused();
  await page.locator('#calc-character').selectOption('character:10000015');
  const frost=page.locator('#calc-skill option').filter({hasText:'霜袭·命中'});
  await expect(frost).toHaveCount(1);await page.locator('#calc-skill').selectOption((await frost.getAttribute('value'))!);
  for(const [key,value] of Object.entries({'build.stats.atk':'1700','build.stats.critRate':'0.4','build.stats.critDamage':'1','hits.0.damageBonus':'0.616'})){
    await page.locator(`[data-field="${key}"]`).fill(value);await page.locator(`[data-field="${key}"]`).blur();
  }
  const audit=JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
  expect(audit.document.gameContext.characterId).toBe('character:10000015');
  expect(audit.document.gameContext.skillId).toBe('kaeya-skill');
  expect(audit.result.totals.expected).toBeCloseTo(1700*3.4416*1.616*.5*.9*1.4,7);
  await expect(page.locator('#calc-results .calculator-badge.synthetic')).toHaveCount(0);
  if(evidence)await page.locator('#calculatorHost').screenshot({path:resolve(evidence,`03-real-skill-${width}.png`)});
  await page.locator('[data-action="examples"]').click();
  await expect(page.getByRole('heading',{name:'合成教学例题',exact:true})).toBeVisible();
  await page.locator('[data-example-id="fixture-b"]').click();
  await expect(page.locator('[data-calculator-example-mode]')).toBeVisible();
  await expect(page.getByTestId('calc-expected')).toHaveText('3,864');
  await page.getByRole('button',{name:'切换到角色计算',exact:true}).click();
  await expect(page.locator('[data-calculator-start]')).toBeVisible();
  await expect(page.getByTestId('calc-expected')).toHaveCount(0);
  await expect(page.locator('[data-calculator-example-mode]')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('player calculator import button uses the existing equipment import path',async({page})=>{
  await page.goto('/calculator');
  await page.locator('[data-action="import-build"]').click();
  await expect(page).toHaveURL(/\/builds#import-uid$/);
  await expect(page.locator('#build-uid')).toBeVisible();
  await expect(page.locator('#build-uid')).toBeFocused();
});
