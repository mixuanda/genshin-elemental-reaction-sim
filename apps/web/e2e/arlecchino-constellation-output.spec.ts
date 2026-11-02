import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function number(page:Page,path:string,value:string){const f=page.locator(`[data-field="${path}"]`).first();await f.fill(value);await f.blur();}
test('C3 Arlecchino panel imports NA10+3 once and preserves level100 and the actual Red Death result',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
 await page.locator('[data-player-file]').setInputFiles(new URL('./fixtures/player-import/arlecchino-c3-enka-panel.json',import.meta.url).pathname);
 const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'阿蕾奇诺',exact:true})});
 await expect(role).toHaveCount(1);await expect(role.locator('[data-player-panel]')).toBeEnabled();await role.locator('[data-player-panel]').click();
 const o=page.locator('#calc-skill option').filter({hasText:'红死之宴·普攻第1段'});await expect(o).toHaveCount(1);await page.locator('#calc-skill').selectOption((await o.getAttribute('value'))!);
 let r=await audit(page);expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(3);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.document.build.mode).toBe('imported-final');expect(r.document.build).not.toHaveProperty('equipment');expect(r.result.status).toBe('blocked');
 await number(page,'gameContext.arlecchinoDamage.bondOfLifePercent','150');
 await page.locator('[data-source-cast-state-field="gameContext.arlecchinoDamage.passivePyroBonusIncluded"]').first().selectOption('1');
 r=await audit(page);expect(r.result.status).toBe('calculated');const expected=(2000*1.1378+2000*1.5*(2.884+1))*1.4*(200/390)*.9*1.5;
 expect(r.result.totals.expected).toBeCloseTo(expected,7);expect(r.document.hits).toHaveLength(1);
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'arlecchino-c3.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.totals.expected).toBeCloseTo(expected,7);expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('arlecchino-c3-390.png'),fullPage:true});
 await writeFile(info.outputPath('arlecchino-c3-proof.json'),JSON.stringify({source:'Synthetic Enka-shaped C3 final panel; no real account',level:100,baseNA:10,bonus:3,effectiveNA:13,constellation:3,expected,totals:r.result.totals},null,2));
});
