import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function choose(page:Page,text:string){const o=page.locator('#calc-skill option').filter({hasText:text});await expect(o).toHaveCount(1);await page.locator('#calc-skill').selectOption((await o.getAttribute('value'))!);}
async function state(page:Page,key:string,value='1'){await page.locator(`[data-source-cast-state-field="gameContext.kinichDamage.${key}"]`).first().selectOption(value);}
async function number(page:Page,key:string,value:string){const input=page.locator(`[data-field="gameContext.kinichDamage.${key}"]`).first();await input.fill(value);await input.blur();}
test('retained Kinich C1 actual E talent, legal cannon and contribution survive reopen',async({page},info)=>{
  const file=process.env.GIDPS_RETAINED_UID_RESPONSE;test.skip(!file,'Retained public response stays private');const env=JSON.parse(await readFile(file!,'utf8')),raw=env.data??env;
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:960});
  await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();await page.locator('[data-player-file]').setInputFiles({name:'retained-enka.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'基尼奇',exact:true})});await expect(role).toHaveCount(1);await expect(role.locator('[data-player-panel]')).toBeDisabled();
  await role.getByText('补充有效天赋等级后计算',{exact:true}).click();
  for(const [key,value] of [['auto','1'],['skill','10'],['burst','10']] as const)await role.locator(`[data-player-talent-${key}]`).fill(value);
  await role.locator('[data-player-manual-panel]').click();
  await choose(page,'环绕射击·一击');await state(page,'nightsoulBlessingActive');let r=await audit(page);
  expect(r.document.characterLevel).toBe(90);expect(r.document.gameContext.constellation).toBe(1);expect(r.document.gameContext.effectiveTalentLevel).toBe(10);expect(r.document.gameContext.abilityId).toBe('talent:kinich:combat2');expect(r.result.status).toBe('calculated');
  expect(r.document.gameContext.manualEffectiveTalents).toEqual({auto:1,skill:10,burst:10});expect(r.document.build.source).toContain('用户手动输入，未由展柜验证');
  const s=r.document.build.stats,bonus=r.document.hits[0].damageBonus,loop=s.atk*1.03104*(1+bonus)*.5*.9*(1+Math.min(1,s.critRate)*s.critDamage);
  expect(r.result.totals.expected).toBeCloseTo(loop,7);expect(r.document.build.mode).toBe('imported-final');expect(r.document.build).not.toHaveProperty('equipment');
  await choose(page,'环绕射击·同次输入双击');for(const key of ['nightsoulBlessingActive','bothLoopHitsConnected','statsStableAcrossHits'])await state(page,key);
  r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBeCloseTo(loop*2,7);
  await choose(page,'迴猎贯鳞炮·一击');await state(page,'nightsoulBlessingActive');await number(page,'cannonPointsBeforeUse','19');await number(page,'a4Stacks','0');await state(page,'c1CritDamageIncluded','0');
  r=await audit(page);expect(r.result.status).toBe('blocked');await number(page,'cannonPointsBeforeUse','20');r=await audit(page);expect(r.result.status).toBe('calculated');
  const cannon=s.atk*12.37392*(1+r.document.hits[0].damageBonus)*.5*.9*(1+Math.min(1,s.critRate)*(s.critDamage+1));expect(r.result.totals.expected).toBeCloseTo(cannon,7);
  // Explicit test condition: one valid A4 stack with creation-time ATK supplied by the tester.
  await number(page,'a4Stacks','1');const creation=page.locator('[data-field="gameContext.kinichDamage.a4CreationAttack"]').first();await expect(creation).toBeVisible();await creation.fill('1000');await creation.blur();r=await audit(page);expect(r.result.status).toBe('calculated');
  const withA4=(s.atk*12.37392+3200)*(1+r.document.hits[0].damageBonus)*.5*.9*(1+Math.min(1,s.critRate)*(s.critDamage+1));expect(r.result.totals.expected).toBeCloseTo(withA4,7);
  const expected=r.result.totals.expected,download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const saved=await readFile((await(await download).path())!,'utf8');
  await page.reload();await page.locator('#calc-import').setInputFiles({name:'kinich.json',mimeType:'application/json',buffer:Buffer.from(saved)});r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBe(expected);
  await choose(page,'重击（基础状态）');r=await audit(page);expect(r.document.gameContext.effectiveTalentLevel).toBe(1);
  await choose(page,'迴猎贯鳞炮·一击');r=await audit(page);expect(r.document.gameContext.effectiveTalentLevel).toBe(10);expect(r.result.totals.expected).toBe(expected);
  expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('kinich-1440.png'),fullPage:true});
  await writeFile(info.outputPath('private-kinich-proof.json'),JSON.stringify({source:'retained public panel; effective talents explicitly entered, not imported evidence; explicit E state; no fresh network request',level:90,constellation:1,manualEffectiveTalents:{auto:1,skill:10,burst:10},loop,pair:loop*2,cannon,withA4,explicitA4CreationAttack:1000},null,2));
});
