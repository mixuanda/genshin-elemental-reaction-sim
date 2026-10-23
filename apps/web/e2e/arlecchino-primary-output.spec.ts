import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function choose(page:Page,label:string){const o=page.locator('#calc-skill option').filter({hasText:label});await expect(o).toHaveCount(1);await page.locator('#calc-skill').selectOption((await o.getAttribute('value'))!);}
async function bond(page:Page,value:string){const field=page.locator('[data-field="gameContext.arlecchinoDamage.bondOfLifePercent"]').first();await field.fill(value);await field.blur();}
test('Arlecchino selects actual Red Death normals, rejects low bond and reopens the exact hit',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000096');
 await choose(page,'红死之宴·普攻第1段');expect((await audit(page)).result.status).toBe('blocked');
 await bond(page,'150');let r=await audit(page);expect(r.result.status).toBe('calculated');
 const s=r.document.build.stats,expected=(s.atk*.938961+s.atk*1.5*2.38)*1.4*.5*.9*(1+s.critRate*s.critDamage);expect(r.result.totals.expected).toBeCloseTo(expected,7);
 await bond(page,'29.999');expect((await audit(page)).result.status).toBe('blocked');await bond(page,'150');
 await choose(page,'红死之宴·普攻第4段第1击');await bond(page,'150');const first=await audit(page);
 await choose(page,'红死之宴·普攻第4段第2击');expect((await audit(page)).result.status).toBe('blocked');await bond(page,'138.75');const second=await audit(page);
 expect(second.result.status).toBe('calculated');expect(second.result.totals.expected).toBeLessThan(first.result.totals.expected);
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'arlecchino.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.result.totals).toEqual(second.result.totals);expect(r.document.gameContext.arlecchinoDamage.bondOfLifePercent).toBe(138.75);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('arlecchino-390.png'),fullPage:true});await writeFile(info.outputPath('arlecchino-proof.json'),JSON.stringify({source:'Explicit editable test conditions; separate actual pre-hit bond, not a simulated consumption cycle',expected,first:first.result.totals,second:second.result.totals},null,2));
});
