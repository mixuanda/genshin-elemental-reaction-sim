import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const gameDataCatalog=JSON.parse(readFileSync(new URL('../../../packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json',import.meta.url),'utf8')) as {characters:Array<{id:string;slug:string}>};
import type {CalculatorDocument,CalculatorResult} from '../../../packages/sim-core/src/calculator';

test('Neuvillette independent HP hit requires actual A4 inputs and retains formula steps',async({page})=>{
 await page.goto('/calculator');
 await page.locator('#calc-character').selectOption(gameDataCatalog.characters.find(c=>c.slug==='neuvillette')!.id);
 if(await page.locator('#calc-form').isVisible())await page.locator('#calc-form').selectOption('');
 const option=page.locator('#calc-skill option').filter({hasText:'泪水啊，我必偿还·初击'});
 await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 await page.locator('#calc-talent-level').fill('1');
 await page.locator('#calc-talent-level').blur();
 const audit=async()=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!) as {document:CalculatorDocument;result:CalculatorResult};
 await expect.poll(async()=>{const d=(await audit()).document;return d.hits[0]?.kind==='ordinary'?d.hits[0].terms?.[0]?.coefficient:undefined;}).toBe(.12864);
 expect((await audit()).result.status).toBe('blocked');
 await page.getByText('逐击实际状态与覆盖',{exact:true}).click();
 await page.locator('[data-field="gameContext.batchProjectileCast.hitStates.neuvillette-skill-hit.actualHpRatio"]').fill('0.5');
 await page.locator('[data-field="gameContext.batchProjectileCast.hitStates.neuvillette-skill-hit.includedHydroBonus"]').fill('0');
 const result=await audit();
 expect(result.document.gameContext?.skillId).toBe('neuvillette-skill');
 expect(result.document.hits).toHaveLength(1);
 expect(result.result.status).toBe('calculated');
 expect(result.result.totals!.nonCritical).toBeCloseTo(20000*.12864*.5*.9*1.12,8);
 expect(result.result.hits[0]!.trace.length).toBeGreaterThan(5);
 await expect(page.locator('#calc-results')).toContainText('所选');
});
