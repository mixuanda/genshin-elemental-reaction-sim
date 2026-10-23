import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function number(page:Page,key:string,value:string){const f=page.locator(`[data-field="gameContext.alhaithamDamage.${key}"]`).first();await f.fill(value);await f.blur();}
async function state(page:Page,key:string,value='1'){await page.locator(`[data-source-cast-state-field="gameContext.alhaithamDamage.${key}"]`).first().selectOption(value);}
test('C3 Alhaitham imports E10+3 and applies explicit C2 snapshot stacks once at level100',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
 await page.locator('[data-player-file]').setInputFiles(new URL('./fixtures/player-import/alhaitham-c3-enka-panel.json',import.meta.url).pathname);
 const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'艾尔海森',exact:true})});await expect(role.locator('[data-player-panel]')).toBeEnabled();await role.locator('[data-player-panel]').click();
 const o=page.locator('#calc-skill option').filter({hasText:'琢光镜·3镜投射'});await expect(o).toHaveCount(1);await page.locator('#calc-skill').selectOption((await o.getAttribute('value'))!);
 let r=await audit(page);expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(3);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.status).toBe('blocked');
 await state(page,'projectionTriggerValid');await state(page,'masteryStableAcrossStages');await state(page,'statsAndTargetStableAcrossHits');
 for(const hit of r.document.hits){await state(page,`hitStates.${hit.id}.connected`);await number(page,`hitStates.${hit.id}.includedA4Bonus`,'0');}
 await number(page,'c2SnapshotStacks','2');await number(page,'c2SnapshotIncludedStacks','0');
 r=await audit(page);expect(r.result.status).toBe('blocked');
 await state(page,'c2OtherSnapshotStatsFinal');r=await audit(page);expect(r.result.status).toBe('calculated');
 const expected=3*(2000*1.428+400*2.856)*1.4*(200/390)*.9*1.5;expect(r.result.totals.expected).toBeCloseTo(expected,7);
 expect(r.result.hits.reduce((n:number,h:{expected:number})=>n+h.expected,0)).toBeCloseTo(expected,7);
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');await page.reload();await page.locator('#calc-import').setInputFiles({name:'alhaitham-c3.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.effectiveTalentLevel).toBe(13);expect(r.result.totals.expected).toBeCloseTo(expected,7);expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('alhaitham-c3-390.png'),fullPage:true});
 await writeFile(info.outputPath('alhaitham-c3-proof.json'),JSON.stringify({source:'Synthetic C3 Enka-shaped panel; C2 snapshot two stacks, panel includes zero, other actual snapshot stats explicitly confirmed; not live account data or mirror lifecycle',level:100,baseE:10,bonus:3,effectiveE:13,baseEM:300,actualC2Stacks:2,actualEM:400,expected,totals:r.result.totals},null,2));
});

test('blocked EM-sensitive gear can open an unconfirmed actual-panel draft without manufacturing a conversion',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');
 await page.locator('#calc-import').setInputFiles(new URL('./fixtures/player-import/alhaitham-c2-unsupported-equipment.json',import.meta.url).pathname);
 let r=await audit(page);expect(r.document.build.mode).toBe('equipment-derived');expect(r.result.status).toBe('blocked');
 await page.locator('#calc-build-mode').selectOption('manual-final');
 await expect(page.locator('#calc-build-mode')).toHaveValue('manual-final');r=await audit(page);expect(r.result.status).toBe('blocked');
 expect(r.document.build.source).toContain('未确认');expect(r.document.gameContext.alhaithamDamage.c2OtherSnapshotStatsFinal).toBe(false);
 await state(page,'c2OtherSnapshotStatsFinal','unknown');expect((await audit(page)).result.status).toBe('blocked');
 const pendingDownload=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const pending=await readFile((await(await pendingDownload).path())!,'utf8');
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'alhaitham-unconfirmed-draft.json',mimeType:'application/json',buffer:Buffer.from(pending)});
 expect((await audit(page)).result.status).toBe('blocked');
 const fill=async(path:string,value:string)=>{const f=page.locator(`[data-field="${path}"]`).first();await f.fill(value);await f.blur();};
 await fill('build.stats.atk','2000');await fill('build.stats.em','300');await fill('build.stats.critRate','.5');await fill('build.stats.critDamage','1');
 expect((await audit(page)).result.status).toBe('blocked');
 await state(page,'c2OtherSnapshotStatsFinal');r=await audit(page);expect(r.result.status).toBe('calculated');
 const expected=3*(2000*1.2096+300*2.4192)*1.5*.5*.9*1.5;expect(r.result.totals.expected).toBeCloseTo(expected,7);
 expect(r.document.build).not.toHaveProperty('equipment');expect(r.document.gameContext.alhaithamDamage.finalizedHitStates).toBeUndefined();expect(errors).toEqual([]);
 const finalDownload=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await finalDownload).path())!,'utf8');
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'alhaitham-confirmed-manual.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBeCloseTo(expected,7);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('alhaitham-confirmed-manual.png'),fullPage:true});
 await writeFile(info.outputPath('alhaitham-manual-draft-proof.json'),JSON.stringify({source:'Synthetic UI-only EM-sensitive gear; actual manually entered ATK2000/EM300/CR.5/CD1, triggerEM300/impactEM500; no auto conversion result',expected,totals:r.result.totals},null,2));
});
