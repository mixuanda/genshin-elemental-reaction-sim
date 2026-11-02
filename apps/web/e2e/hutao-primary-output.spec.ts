import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function number(page:Page,path:string,value:string){const field=page.locator(`[data-field="${path}"]`).first();await field.fill(value);await field.blur();}
async function state(page:Page,key:string,value='1'){await page.locator(`[data-source-cast-state-field="gameContext.hutaoDamage.${key}"]`).first().selectOption(value);}
test('Hu Tao selects real E charged damage, fills conditions and reopens without changing the result',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');
  await page.locator('#calc-character').selectOption('character:10000046');
  const option=page.locator('#calc-skill option').filter({hasText:'蝶引来生·重击'});await expect(option).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
  let r=await audit(page);expect(r.result.status).toBe('blocked');
  await number(page,'gameContext.hutaoDamage.skillTalentLevel','10');
  await number(page,'gameContext.hutaoDamage.hpPercentAtSnapshot','49');await state(page,'a4ThresholdStable');
  await state(page,'maxHpUnchangedSinceSkillCast');await number(page,'gameContext.hutaoDamage.baseAttack','1000');
  r=await audit(page);expect(r.result.status).toBe('calculated');
  const s=r.document.build.stats,expected=(s.atk+Math.min(s.hp*.06256,4000))*2.42565*1.33*.5*.9*(1+s.critRate*s.critDamage);
  expect(r.result.totals.expected).toBeCloseTo(expected,7);
  await expect(page.locator('#calc-results')).toContainText('非暴击');await expect(page.locator('#calc-results')).toContainText('期望');await expect(page.locator('#calc-results')).toContainText('暴击');
  const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');
  await page.reload();await page.locator('#calc-import').setInputFiles({name:'hutao.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBeCloseTo(expected,7);
  await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('hutao-390.png'),fullPage:true});
  await writeFile(info.outputPath('hutao-proof.json'),JSON.stringify({source:'Explicit editable example panel; no account or real rotation claim',expected,result:r.result.totals,conditions:r.document.gameContext.hutaoDamage},null,2));
});
