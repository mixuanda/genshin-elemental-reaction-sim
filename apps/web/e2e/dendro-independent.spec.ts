import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {CalculatorDocument,CalculatorResult} from '../../../packages/sim-core/src/calculator';
const catalog=JSON.parse(readFileSync(new URL('../../../packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json',import.meta.url),'utf8')) as {characters:Array<{id:string;slug:string}>};
for(const gender of ['aether','lumine'])test(`${gender} exposes the independent Dendro explosion and Chinese formula steps`,async({page})=>{
 await page.goto('/calculator');
 await page.locator('#calc-character').selectOption(catalog.characters.find(c=>c.slug===gender)!.id);
 await page.locator('#calc-form').selectOption(`${gender}-dendro`);
 const option=page.locator('#calc-skill option').filter({hasText:'偃草若化·火转化爆炸单次'});
 await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 await page.locator('[data-field="build.stats.em"]').fill('200');
 const read=async()=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!) as {document:CalculatorDocument;result:CalculatorResult};
 await expect.poll(async()=>(await read()).result.totals?.nonCritical).toBeCloseTo(2000*7.2144*.5*.9*1.2,8);
 const a=await read();expect(a.document.hits).toHaveLength(1);expect(a.document.gameContext?.scopeCoverage).toBe('selected-components');
 expect(a.result.hits[0]!.trace.length).toBeGreaterThan(5);
 await expect(page.locator('#calc-results')).toContainText('不能重复加入该被动');
});
