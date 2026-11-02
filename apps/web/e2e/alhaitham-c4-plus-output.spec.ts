import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function number(page:Page,path:string,value:string){const f=page.locator(`[data-field="${path}"]`).first();await f.fill(value);await f.blur();}
async function state(page:Page,key:string,value='1'){await page.locator(`[data-source-cast-state-field="gameContext.alhaithamDamage.${key}"]`).first().selectOption(value);}
const path=(key:string)=>`gameContext.alhaithamDamage.${key}`;
test('C4/C6 projection import preserves actual stages, critical accounting and level100 when reopened',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
 await page.locator('[data-player-file]').setInputFiles(new URL('./fixtures/player-import/alhaitham-c4-enka-panel.json',import.meta.url).pathname);
 const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'艾尔海森',exact:true})});await expect(role.locator('[data-player-panel]')).toBeEnabled();await role.locator('[data-player-panel]').click();
 const option=page.locator('#calc-skill option').filter({hasText:'琢光镜·3镜投射'});await expect(option).toHaveCount(1);await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 let r=await audit(page);expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(4);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.status).toBe('blocked');
 await state(page,'projectionTriggerValid');await state(page,'masteryStableAcrossStages');await state(page,'statsAndTargetStableAcrossHits');
 for(const hit of r.document.hits){await state(page,`hitStates.${hit.id}.connected`);await number(page,path(`hitStates.${hit.id}.includedA4Bonus`),'0');}
 await number(page,path('c2SnapshotStacks'),'2');await number(page,path('c2SnapshotIncludedStacks'),'0');await state(page,'c2OtherSnapshotStatsFinal');expect((await audit(page)).result.status).toBe('blocked');
 await number(page,path('c4SnapshotStacks'),'3');
 for(const hit of r.document.hits)await number(page,path(`hitStates.${hit.id}.includedC4Bonus`),'0');
 r=await audit(page);expect(r.result.status).toBe('calculated');const nonCrit=3*(2000*1.428+400*2.856)*1.7*(200/390)*.9;expect(r.result.totals.expected).toBeCloseTo(nonCrit*1.5,7);
 await page.locator('#calc-constellation').selectOption('6');r=await audit(page);expect(r.result.status).toBe('blocked');expect(r.document.gameContext.effectiveTalentLevel).toBe(13);
 await state(page,'c6SnapshotActive');
 for(const hit of r.document.hits){await state(page,`hitStates.${hit.id}.c6CritRateIncluded`,'0');await state(page,`hitStates.${hit.id}.c6CritDamageIncluded`,'0');}
 r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.nonCritical).toBeCloseTo(nonCrit,7);expect(r.result.totals.expected).toBeCloseTo(nonCrit*(1+.6*1.7),7);
 await number(page,'build.stats.critRate','.6');await number(page,'build.stats.critDamage','1.7');
 for(const hit of r.document.hits){await state(page,`hitStates.${hit.id}.c6CritRateIncluded`);await state(page,`hitStates.${hit.id}.c6CritDamageIncluded`);}
 r=await audit(page);expect(r.result.totals.expected).toBeCloseTo(nonCrit*(1+.6*1.7),7);
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');await page.reload();await page.locator('#calc-import').setInputFiles({name:'alhaitham-c6.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(6);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.totals.expected).toBeCloseTo(nonCrit*(1+.6*1.7),7);expect(r.result.hits.reduce((n:number,h:{expected:number})=>n+h.expected,0)).toBeCloseTo(r.result.totals.expected,7);expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('alhaitham-c6-390.png'),fullPage:true});
 await writeFile(info.outputPath('alhaitham-c6-proof.json'),JSON.stringify({fixture:'Synthetic C4 Enka panel, then explicit C6 state selection; no live account or lifecycle',actualC2Stacks:2,actualC4SnapshotStacks:3,c6SnapshotActive:true,nonCrit,expected:nonCrit*(1+.6*1.7),totals:r.result.totals},null,2));
});
