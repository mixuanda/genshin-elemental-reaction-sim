import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const gameDataCatalog=JSON.parse(readFileSync(new URL('../../../packages/game-data/manifests/runtime/datasets/snapshot-953ea16b6f72ef68408176ddf81abc384d643a795d7f234517caad8351f24d34/catalog.json',import.meta.url),'utf8')) as {characters:Array<{id:string;slug:string}>};
import type {CalculatorDocument,CalculatorResult} from '../../../packages/sim-core/src/calculator';

for(const [slug,skill,label] of [
 ['fischl','fischl-skill-birdatk','奥兹·单次攻击'],
 ['chiori','chiori-skill-thrustatkscaling','羽袖一触·上挑命中'],
 ['alhaitham','alhaitham-skill-rushatk','共相·理式摹写·突进命中'],
])test(`independent ${slug} contact retains its Chinese calculator and formula steps`,async({page})=>{
 await page.goto('/calculator');
 await page.locator('#calc-character').selectOption(gameDataCatalog.characters.find(c=>c.slug===slug)!.id);
 await expect(page.locator('#calc-skill')).toBeEnabled();
 if(await page.locator('#calc-form').isVisible()) await page.locator('#calc-form').selectOption('');
 const option=page.locator('#calc-skill option').filter({hasText:label!});
 await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 const audit=JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!) as {document:CalculatorDocument;result:CalculatorResult};
 expect(audit.document.gameContext?.skillId).toBe(skill);
 expect(audit.document.gameContext?.scopeCoverage).toBe('selected-components');
 expect(audit.document.hits).toHaveLength(1);
 expect(audit.result.status).toBe('calculated');
 expect(audit.result.verification).toBe('provisional');
 expect(audit.result.hits[0]!.trace.length).toBeGreaterThan(5);
 await expect(page.locator('#calc-results')).toContainText(label!);
 await expect(page.locator('#calc-results')).toContainText('所选');
});
