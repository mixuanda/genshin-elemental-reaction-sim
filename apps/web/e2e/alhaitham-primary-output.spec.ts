import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function state(page:Page,key:string,value='1'){await page.locator(`[data-source-cast-state-field="gameContext.alhaithamDamage.${key}"]`).first().selectOption(value);}
async function number(page:Page,key:string,value:string){const f=page.locator(`[data-field="gameContext.alhaithamDamage.${key}"]`).first();await f.fill(value);await f.blur();}
test('Alhaitham calculates one three-mirror projection with separate trigger and impact mastery',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000078');
 const o=page.locator('#calc-skill option').filter({hasText:'琢光镜·3镜投射'});await expect(o).toHaveCount(1);await page.locator('#calc-skill').selectOption((await o.getAttribute('value'))!);
 let r=await audit(page);expect(r.result.status).toBe('blocked');expect(r.document.gameContext.alhaithamDamage.mirrorCount).toBe(3);
 await state(page,'projectionTriggerValid');await state(page,'masteryStableAcrossStages');await state(page,'statsAndTargetStableAcrossHits');
 for(const hit of r.document.hits)await state(page,`hitStates.${hit.id}.connected`);
 r=await audit(page);expect(r.result.status).toBe('calculated');const s=r.document.build.stats;
 const stable=3*(s.atk*1.2096+s.em*2.4192)*(1+Math.min(s.em*.001,1))*.5*.9*(1+s.critRate*s.critDamage);expect(r.result.totals.expected).toBeCloseTo(stable,7);
 await state(page,'masteryStableAcrossStages','0');await number(page,'triggerMastery','300');
 for(const hit of r.document.hits)await number(page,`hitStates.${hit.id}.hitTimeMastery`,'1000');
 r=await audit(page);expect(r.result.status).toBe('calculated');const varying=3*(s.atk*1.2096+300*2.4192)*2*.5*.9*(1+s.critRate*s.critDamage);
 expect(r.result.totals.expected).toBeCloseTo(varying,7);expect(r.result.hits.reduce((n:number,h:{expected:number})=>n+h.expected,0)).toBeCloseTo(varying,7);
 const perHit=page.locator('[data-calculator-primary-hit-settings]');await expect(perHit).not.toHaveAttribute('open','');await expect(perHit.locator('[data-hit-editor]').first()).not.toBeVisible();
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'alhaitham.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBeCloseTo(varying,7);expect(r.document.gameContext.alhaithamDamage.triggerMastery).toBe(300);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('alhaitham-390.png'),fullPage:true});await writeFile(info.outputPath('alhaitham-proof.json'),JSON.stringify({source:'Explicit actual-hit conditions on editable fixture; not a simulated mirror lifecycle',stable,varying,totals:r.result.totals},null,2));
});
