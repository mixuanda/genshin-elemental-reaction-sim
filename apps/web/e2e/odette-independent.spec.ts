import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {CalculatorDocument,CalculatorResult} from '../../../packages/sim-core/src/calculator';
const catalog=JSON.parse(readFileSync(new URL('../../../packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json',import.meta.url),'utf8')) as {characters:Array<{id:string;slug:string}>};
test('Odette keeps direct Cryo contacts separate from her entity lifetime',async({page})=>{
 await page.goto('/calculator');
 await page.locator('#calc-character').selectOption(catalog.characters.find(c=>c.slug==='odette')!.id);
 if(await page.locator('#calc-form').isVisible())await page.locator('#calc-form').selectOption('');
 const option=page.locator('#calc-skill option').filter({hasText:'蓝鸟终章·四段普通冰伤'});
 await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 const a=JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!) as {document:CalculatorDocument;result:CalculatorResult};
 expect(a.document.gameContext?.skillId).toBe('odette-burst-direct-four-hits');
 expect(a.document.gameContext?.scopeCoverage).toBe('selected-components');expect(a.document.hits).toHaveLength(4);
 expect(a.result.totals!.nonCritical).toBeCloseTo(2000*(3*1.983168+3.064896)*.5*.9,8);
 expect(a.result.verification).toBe('provisional');
 await expect(page.locator('#calc-results')).toContainText('不含召唤或刷新的独舞重影生命周期');
});
