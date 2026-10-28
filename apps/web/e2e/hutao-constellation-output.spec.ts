import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function number(page:Page,key:string,value:string){const f=page.locator(`[data-field="gameContext.hutaoDamage.${key}"]`).first();await f.fill(value);await f.blur();}
async function state(page:Page,key:string,value='1'){await page.locator(`[data-source-cast-state-field="gameContext.hutaoDamage.${key}"]`).first().selectOption(value);}
test('C3 Hu Tao imports independent E13 and C6 actual buff is explicit and capped rather than inferred from low HP',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
 await page.locator('[data-player-file]').setInputFiles(new URL('./fixtures/player-import/hutao-c3-enka-panel.json',import.meta.url).pathname);
 const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'胡桃',exact:true})});await expect(role.locator('[data-player-panel]')).toBeEnabled();await role.locator('[data-player-panel]').click();
 const o=page.locator('#calc-skill option').filter({hasText:'蝶引来生·重击'});await expect(o).toHaveCount(1);await page.locator('#calc-skill').selectOption((await o.getAttribute('value'))!);
 let r=await audit(page);expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.constellation).toBe(3);expect(r.document.gameContext.effectiveTalentLevel).toBe(10);expect(r.document.gameContext.hutaoDamage.skillTalentLevel).toBe(13);expect(r.result.status).toBe('blocked');
 await state(page,'paramitaActive');await state(page,'skillAttackIncludedInPanel','0');await state(page,'maxHpUnchangedSinceSkillCast');await number(page,'baseAttack','1000');await number(page,'hpPercentAtSnapshot','49');await state(page,'a4ThresholdStable');await state(page,'a4IncludedInDamageBonus','0');
 r=await audit(page);const noncrit=(2000+30000*.07153)*2.42565*1.33*(200/390)*.9;expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBeCloseTo(noncrit*1.5,7);
 await page.locator('#calc-constellation').selectOption('6');expect((await audit(page)).result.status).toBe('blocked');
 await state(page,'c6Active');await state(page,'c6CritRateIncludedInPanel','0');r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBeCloseTo(noncrit*2,7);
 await state(page,'c6Active','0');expect((await audit(page)).result.totals.expected).toBeCloseTo(noncrit*1.5,7);await state(page,'c6Active');
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');await page.reload();await page.locator('#calc-import').setInputFiles({name:'hutao-c6.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);
 expect(r.document.characterLevel).toBe(100);expect(r.document.gameContext.hutaoDamage.skillTalentLevel).toBe(13);expect(r.result.totals.expected).toBeCloseTo(noncrit*2,7);expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('hutao-c6-390.png'),fullPage:true});
 await writeFile(info.outputPath('hutao-c6-proof.json'),JSON.stringify({source:'Synthetic C3 Enka-shaped panel, then explicit user C6 scenario; no actual account',level:100,baseNA:10,baseE:10,bonusE:3,effectiveE:13,noncrit,c6ActiveExpected:noncrit*2,totals:r.result.totals},null,2));
});
