import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const evidence=process.env.GIDPS_SINGLE_SKILL_EVIDENCE;
const audit=async(page:import('@playwright/test').Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);

for(const width of [1365,390])test(`Wanderer conditions are actual in-place inputs and false remains unsupported (${width}px)`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:1000});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/calculator');
  await page.locator('#calc-character').selectOption('character:10000075');
  const action=page.locator('#calc-skill option').filter({hasText:'羽画·E初击C0–C6'});
  await expect(action).toHaveCount(1);await page.locator('#calc-skill').selectOption((await action.getAttribute('value'))!);
  await page.locator('#calc-scope').selectOption('single-hit');await page.locator('#calc-constellation').selectOption('6');
  const panel=page.locator('[data-calculator-inline-conditions]');
  const noAbsorption='select[data-source-cast-state-field="gameContext.idleStanceCast.wanderer.noAbsorption"]';
  const accounting='select[data-source-cast-state-field="gameContext.idleStanceCast.wanderer.panelExcludesAbsorptionBonuses"]';
  await expect(panel.locator(noAbsorption)).toBeVisible();await expect(panel.locator(accounting)).toBeVisible();
  await expect(page.locator(noAbsorption)).toHaveCount(1);await expect(page.locator(accounting)).toHaveCount(1);
  await panel.locator(noAbsorption).selectOption('0');await panel.locator(accounting).selectOption('1');
  let report=await audit(page);
  expect(report.document.gameContext.idleStanceCast.wanderer.noAbsorption).toBe(false);
  expect(report.result.status).toBe('blocked');expect(report.result.totals).toBeUndefined();
  await panel.locator(noAbsorption).selectOption('1');report=await audit(page);
  expect(report.result.status).toBe('calculated');expect(report.document.gameContext.constellation).toBe(6);
  await expect(panel.locator(noAbsorption)).toBeVisible();await expect(panel.locator(accounting)).toBeVisible();
  await expect(page.locator('[data-calculator-required-field="true"]')).toHaveCount(0);
  if(evidence){await mkdir(evidence,{recursive:true});await panel.screenshot({path:resolve(evidence,`04-inline-conditions-${width}.png`)});}
  await panel.locator(noAbsorption).selectOption('0');expect((await audit(page)).result.status).toBe('blocked');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('a numeric condition stays editable through each keystroke without duplicated controls or lost values',async({page})=>{
  await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000042');
  const burst=page.locator('#calc-skill option').filter({hasText:'天街巡游·完整十击'});
  await expect(burst).toHaveCount(1);await page.locator('#calc-skill').selectOption((await burst.getAttribute('value'))!);
  await page.locator('#calc-scope').selectOption('single-hit');await page.locator('#calc-constellation').selectOption('4');
  const panel=page.locator('[data-calculator-inline-conditions]');
  await panel.locator('select[data-keqing-state-field$=".c4Active"]').selectOption('1');
  await panel.locator('select[data-keqing-state-field$=".c4IncludedInPanel"]').selectOption('0');
  const input=panel.locator('input[data-field$=".baseAttack"]');await expect(input).toBeVisible();await input.focus();
  for(const digit of '1700'){await input.pressSequentially(digit);await expect(input).toBeFocused();}
  await expect(input).toHaveValue('1700');
  const exactField=await input.getAttribute('data-field');
  await expect(page.locator(`input[data-field="${exactField}"]`)).toHaveCount(1);
  const report=await audit(page);const id=report.document.selectedHitIds[0];
  expect(report.document.gameContext.keqingBurst.hitStates[id].baseAttack).toBe(1700);
  expect(report.document.gameContext.keqingBurst.hitStates[id].c4Active).toBe(true);
  expect(report.document.gameContext.keqingBurst.hitStates[id].c4IncludedInPanel).toBe(false);
  expect(report.result.status).toBe('calculated');
  await page.locator('#calc-character').selectOption('character:10000015');
  await expect(page.locator('[data-calculator-inline-conditions]')).toHaveCount(0);
  await expect(page.locator('input[data-field$=".baseAttack"]')).toHaveCount(0);
});
