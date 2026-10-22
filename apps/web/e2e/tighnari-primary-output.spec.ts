import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
const selectSkill=async(page:Page,text:string)=>{
 const option=page.locator('#calc-skill option').filter({hasText:text});await expect(option).toHaveCount(1);await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
};
for(const width of [1440,390])test(`Tighnari primary arrows calculate, edit and reopen at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:960});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000069');await selectSkill(page,'花筥箭与4枚');
 let r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.hits).toHaveLength(5);
 expect(r.result.totals.expected).toBeCloseTo(2000*(1.5696+4*.6948)*1.03*.5*.9*(1+.7*1.2),8);
 await expect(page.locator('[data-tighnari-field="gameContext.tighnariDamage.priorA1Active"]')).toBeVisible();
 await page.locator('[data-tighnari-field="gameContext.tighnariDamage.priorA1Active"]').selectOption('1');r=await audit(page);
 const first=r.result.hits[0].trace.find((n:{id:string})=>n.id==='hitElementalMastery');expect(first.result.value).toBe(50);
 await selectSkill(page,'造生缠藤箭（6枚');r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.hits).toHaveLength(12);
 const before=r.result.totals.expected;
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const exported=JSON.parse(await readFile((await (await download).path())!,'utf8'));
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'tighnari.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBe(before);expect(r.document.gameContext.tighnariDamage.priorA1Active).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath(`tighnari-${width}.png`),fullPage:true});
});

test('retained real showcase Tighnari keeps Q1+3 and computes after actual state answers',async({page},info)=>{
 const file=process.env.GIDPS_RETAINED_UID_RESPONSE;test.skip(!file,'Private retained public response is not checked into the repository');
 const envelope=JSON.parse(await readFile(file!,'utf8'));const raw=envelope.data??envelope;
 const idx=raw.avatarInfoList.findIndex((c:{avatarId:number})=>c.avatarId===10000069);expect(idx).toBeGreaterThanOrEqual(0);
 await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();await expect(page).toHaveURL(/\/builds/);
 await page.locator('[data-player-file]').setInputFiles({name:'retained-enka.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
 const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'提纳里',exact:true})});await expect(role).toHaveCount(1);await expect(role.locator('[data-player-panel]')).toBeEnabled();await role.locator('[data-player-panel]').click();
 await selectSkill(page,'花筥箭与4枚');let r=await audit(page);expect(r.result.status).toBe('blocked');expect(r.document.characterLevel).toBe(70);expect(r.document.gameContext.constellation).toBe(4);expect(r.document.gameContext.effectiveTalentLevel).toBe(4);
 const answers={priorA1Active:'0',c2Active:'0',c4Em:'0',a1IncludedEm:'0',c4IncludedEm:'0',includedC2Bonus:'0',includedC1Crit:'0',allHitsConnected:'1',statsStableAcrossHits:'1'};
 for(const [key,value] of Object.entries(answers)){
  const input=page.locator(`[data-tighnari-field="gameContext.tighnariDamage.${key}"]`);await expect(input).toBeVisible();await input.selectOption(value);
 }
 const a4=page.locator('[data-field="gameContext.tighnariDamage.includedA4Bonus"]');await expect(a4).toBeVisible();await a4.fill('0');await a4.blur();
 r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.document.build.mode).toBe('imported-final');expect(r.document.build).not.toHaveProperty('equipment');
 const stats=r.document.build.stats;const bonus=r.document.hits[0].damageBonus;
 const expected=stats.atk*(1.09+4*.4825)*(1+bonus+Math.min((stats.em+50)*.0006,.6))*(170/360)*.9*(1+Math.min(1,stats.critRate+.15)*stats.critDamage);
 expect(r.result.totals.expected).toBeCloseTo(expected,7);
 await selectSkill(page,'造生缠藤箭（6枚');
 for(const [key,value] of Object.entries(answers)){
  if(key==='c4Em'||key==='includedC1Crit')continue;
  const field=page.locator(`[data-tighnari-field="gameContext.tighnariDamage.${key}"]`);if(await field.count()&&await field.inputValue()==='unknown')await field.selectOption(value);
 }
 const qA4=page.locator('[data-field="gameContext.tighnariDamage.includedA4Bonus"]');if(await qA4.inputValue()===''){await qA4.fill('0');await qA4.blur();}
 r=await audit(page);expect(r.document.gameContext.effectiveTalentLevel).toBe(4);expect(r.result.status).toBe('calculated');
 const expectedQ=stats.atk*6*(.69525+.84975)*(1+bonus+Math.min((stats.em+60)*.0006,.6))*(170/360)*.9*(1+Math.min(1,stats.critRate)*stats.critDamage);
 expect(r.result.totals.expected).toBeCloseTo(expectedQ,7);
 await writeFile(info.outputPath('private-uid-tighnari-proof.json'),JSON.stringify({source:'retained real public response, no new account/network request',state:'Explicit no prior A1/no C2/no prior C4; all arrows connected and stable; no reactions',characterLevel:70,constellation:4,effectiveTalents:{auto:4,burst:4},chargedExpected:expected,burstExpected:expectedQ,actual:r.result.totals.expected},null,2));
 await page.screenshot({path:info.outputPath('private-uid-tighnari.png'),fullPage:true});
});
