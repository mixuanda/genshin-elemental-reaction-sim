import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function number(page:Page,path:string,value:string){const f=page.locator(`[data-field="${path}"]`).first();await f.fill(value);await f.blur();}
async function active(page:Page,value:string){await page.locator('[data-source-cast-state-field="gameContext.arlecchinoDamage.c6Active"]').first().selectOption(value);}
const c6=(key:string)=>`gameContext.arlecchinoDamage.${key}`;
test('C6 imported normal requires actual critical state, accounts included shares once and reopens at level100',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
 await page.locator('[data-player-file]').setInputFiles(new URL('./fixtures/player-import/arlecchino-c6-enka-panel.json',import.meta.url).pathname);
 const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'阿蕾奇诺',exact:true})});await expect(role.locator('[data-player-panel]')).toBeEnabled();await role.locator('[data-player-panel]').click();
 const option=page.locator('#calc-skill option').filter({hasText:'红死之宴·普攻第1段'});await expect(option).toHaveCount(1);await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 let r=await audit(page);expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(6);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.status).toBe('blocked');
 await number(page,c6('bondOfLifePercent'),'150');await page.locator(`[data-source-cast-state-field="${c6('passivePyroBonusIncluded')}"]`).first().selectOption('1');expect((await audit(page)).result.status).toBe('blocked');
 await active(page,'0');await number(page,c6('c6CritRateIncludedPercent'),'0');expect((await audit(page)).result.status).toBe('blocked');await number(page,c6('c6CritDamageIncludedPercent'),'0');
 r=await audit(page);expect(r.result.status).toBe('calculated');const nonCrit=(2000*1.1378+2000*1.5*(2.884+1))*1.4*(200/390)*.9;
 expect(r.result.totals.expected).toBeCloseTo(nonCrit*1.5,7);await active(page,'1');r=await audit(page);expect(r.result.totals.nonCritical).toBeCloseTo(nonCrit,7);expect(r.result.totals.expected).toBeCloseTo(nonCrit*(1+.6*1.7),7);
 await number(page,'build.stats.critRate','.6');await number(page,'build.stats.critDamage','1.7');await number(page,c6('c6CritRateIncludedPercent'),'10');await number(page,c6('c6CritDamageIncludedPercent'),'70');r=await audit(page);expect(r.result.totals.expected).toBeCloseTo(nonCrit*(1+.6*1.7),7);expect(r.document.hits).toHaveLength(1);
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');await page.reload();await page.locator('#calc-import').setInputFiles({name:'arlecchino-c6.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(6);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.totals.expected).toBeCloseTo(nonCrit*(1+.6*1.7),7);expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('arlecchino-c6-390.png'),fullPage:true});
 await writeFile(info.outputPath('arlecchino-c6-proof.json'),JSON.stringify({fixture:'Synthetic Enka C6 panel, no live account; selected normal only, actual C6 state explicitly entered, no Q lifecycle',level:100,effectiveNA:13,nonCrit,expected:nonCrit*(1+.6*1.7),totals:r.result.totals},null,2));
});
