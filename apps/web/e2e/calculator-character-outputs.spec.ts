import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const audit=async(page:import('@playwright/test').Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
const formatted=(value:number)=>value.toLocaleString('zh-CN',{maximumFractionDigits:1});
const openGroup=async(overview:import('@playwright/test').Locator,id:string)=>{
  const group=overview.locator(`[data-character-output-group="${id}"]`);
  if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();
};

for(const width of [1365,390])test(`character output buttons use real actions and current formula results (${width}px)`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:1050});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/calculator');
  const overview=page.locator('#calc-character-outputs');await expect(overview).toBeHidden();
  await page.locator('#calc-character').selectOption('character:10000015');
  await expect(overview.locator('[data-character-output-group="normal"] button')).toHaveCount(5);
  const skill=overview.locator('[data-character-output-group="skill"] button');await expect(skill).toHaveCount(1);
  await openGroup(overview,'skill');
  await skill.click();
  let report=await audit(page);expect(report.result.status).toBe('calculated');
  const selected=overview.locator('li').filter({has:page.locator('button[aria-current="true"]')}).first();
  await expect(selected).toContainText(`期望伤害${formatted(report.result.totals.expected)}`);
  await expect(page.locator('#calc-skill')).toHaveValue((await skill.getAttribute('data-character-output-index'))!);
  // Unvisited actions remain unknown; the selected E result is not copied to A/Q.
  await expect(overview.locator('[data-character-output-group="normal"] [data-character-output-pending]')).toHaveCount(5);
  await expect(overview.locator('[data-character-output-group="burst"] [data-character-output-pending]')).toHaveCount(2);
  const previous=report.result.totals.expected;
  await page.locator('input[data-field="build.stats.atk"]').fill('2468');
  await page.locator('input[data-field="build.stats.atk"]').blur();
  report=await audit(page);expect(report.result.status).toBe('calculated');expect(report.result.totals.expected).not.toBe(previous);
  await expect(selected).toContainText(`期望伤害${formatted(report.result.totals.expected)}`);
  await openGroup(overview,'normal');await overview.locator('[data-character-output-group="normal"] button').first().click();
  report=await audit(page);expect(report.document.build.stats.atk).toBe(2468);
  await expect(overview.locator('[data-character-output-group="normal"] button[aria-current="true"]')).toHaveCount(1);
  await expect(overview.locator('[data-character-output-group="skill"] [data-character-output-pending]')).toHaveCount(1);
  if(process.env.GIDPS_SINGLE_SKILL_EVIDENCE){await mkdir(process.env.GIDPS_SINGLE_SKILL_EVIDENCE,{recursive:true});await overview.screenshot({path:resolve(process.env.GIDPS_SINGLE_SKILL_EVIDENCE,`05-character-outputs-${width}.png`)});}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Wanderer does not get invented normal or Q actions and Noelle keeps explicit Q state',async({page})=>{
  await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000075');
  const overview=page.locator('#calc-character-outputs');
  await expect(overview.locator('button[data-character-output-index]')).toHaveCount(1);
  for(const group of ['normal','burst']){
    await expect(overview.locator(`[data-character-output-group="${group}"]`)).toContainText('当前来源尚无可选动作定义');
    await expect(overview.locator(`[data-character-output-group="${group}"] button`)).toHaveCount(0);
  }
  await page.locator('#calc-character').selectOption('character:10000034');
  await openGroup(overview,'burst');
  await overview.locator('[data-character-output-group="burst"] button').first().click();
  let report=await audit(page);expect(report.document.gameContext.noelleBurst.active).toBe(true);
  await expect(overview.locator('button[aria-current="true"]').locator('..')).toContainText('Q 状态：已激活');
  await openGroup(overview,'normal');await overview.locator('[data-character-output-group="normal"] button').first().click();
  report=await audit(page);
  expect(report.document.gameContext.noelleBurst.active).toBe(true);
  await expect(page.locator('#calc-form')).toHaveValue(report.document.gameContext.variantId??'');
  await expect(overview.locator('[data-character-output-group="normal"] button[aria-current="true"]').locator('..')).toContainText('Q 状态：已激活');
});
