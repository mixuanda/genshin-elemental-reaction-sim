import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';

const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function choose(page:Page,label:string){
  const option=page.locator('#calc-skill option').filter({hasText:label});
  await expect(option).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
}
async function state(page:Page,key:string,value='1'){
  await page.locator(`[data-source-cast-state-field="gameContext.kazuhaBurst.${key}"]`).first().selectOption(value);
}
async function number(page:Page,key:string,value:string){
  const field=page.locator(`[data-field="gameContext.kazuhaBurst.${key}"]`).first();
  await field.fill(value);await field.blur();
}

test('retained Kazuha panel supports actual Q timing, separate absorbed bonus and faithful reopening',async({page},info)=>{
  const file=process.env.GIDPS_RETAINED_UID_RESPONSE;
  test.skip(!file,'Retained public response stays private');
  const envelope=JSON.parse(await readFile(file!,'utf8')),raw=envelope.data??envelope;
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:960});
  await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
  await page.locator('[data-player-file]').setInputFiles({name:'retained-enka.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'枫原万叶',exact:true})});
  await expect(role).toHaveCount(1);await expect(role.locator('[data-player-panel]')).toBeDisabled();
  await role.getByText('补充有效天赋等级后计算',{exact:true}).click();
  for(const key of ['auto','skill','burst'])await role.locator(`[data-player-talent-${key}]`).fill('10');
  await role.locator('[data-player-manual-panel]').click();
  await choose(page,'万叶之一刀·初斩');let result=await audit(page);
  expect(result.document.characterLevel).toBe(90);expect(result.document.gameContext.constellation).toBe(0);
  expect(result.document.gameContext.manualEffectiveTalents).toEqual({auto:10,skill:10,burst:10});
  expect(result.document.build.mode).toBe('imported-final');expect(result.document.build).not.toHaveProperty('equipment');
  expect(result.document.build.source).toContain('用户手动输入，未由展柜验证');
  const stats=result.document.build.stats,windBonus=result.document.hits[0].damageBonus;
  const multiplier=.5*.9*(1+Math.min(1,Math.max(0,stats.critRate))*stats.critDamage);
  expect(result.result.status).toBe('calculated');
  expect(result.result.totals.expected).toBeCloseTo(stats.atk*4.7232*(1+windBonus)*multiplier,7);
  await choose(page,'万叶之一刀·完整Q直接伤害');
  await page.locator('[data-source-cast-enum-field="gameContext.kazuhaBurst.absorptionElement"]').first().selectOption('none');
  await state(page,'allHitsConnected');await state(page,'statsStableAcrossSnapshots');result=await audit(page);
  const wind=stats.atk*(4.7232+5*2.16)*(1+windBonus)*multiplier;
  expect(result.result.status).toBe('calculated');expect(result.result.totals.expected).toBeCloseTo(wind,7);
  expect(result.document.hits).toHaveLength(6);

  await page.locator('[data-source-cast-enum-field="gameContext.kazuhaBurst.absorptionElement"]').first().selectOption('pyro');
  result=await audit(page);expect(result.result.status).toBe('blocked');
  await page.locator('[data-source-cast-value-field="gameContext.kazuhaBurst.absorptionStartFrame"]').first().selectOption('81');
  await state(page,'priorA4Active','0');await number(page,'includedA4DamageBonus','0');result=await audit(page);
  const pyroBonus=result.document.gameContext.kazuhaBurst.elementDamageBonuses.pyro;
  expect(pyroBonus).toBe(raw.avatarInfoList.find((entry:{avatarId:number})=>entry.avatarId===10000047).fightPropMap['40']);
  const early=wind+stats.atk*5*.648*(1+pyroBonus)*multiplier;
  expect(result.result.status).toBe('calculated');expect(result.result.totals.expected).toBeCloseTo(early,7);
  const events=result.document.gameContext.kazuhaBurst.hitEvents;
  expect(result.document.hits.map((hit:{id:string})=>events[hit.id].frame)).toEqual([82,140,140,257,257,374,374,491,491,608,608]);
  expect(result.document.hits.slice(1,3).map((hit:{id:string})=>events[hit.id].role)).toEqual(['absorbed-dot','anemo-dot']);
  expect(Object.values(events).every((event:any)=>event.ownerId==='character:10000047')).toBe(true);
  expect(result.result.hits.reduce((sum:number,hit:{expected:number})=>sum+hit.expected,0)).toBeCloseTo(early,7);

  await page.locator('[data-source-cast-value-field="gameContext.kazuhaBurst.absorptionStartFrame"]').first().selectOption('369');
  result=await audit(page);const late=wind+stats.atk*3*.648*(1+pyroBonus)*multiplier;
  expect(result.result.status).toBe('calculated');expect(result.document.hits).toHaveLength(9);
  expect(result.result.totals.expected).toBeCloseTo(late,7);
  const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();
  const saved=await readFile((await(await download).path())!,'utf8');
  await page.reload();await page.locator('#calc-import').setInputFiles({name:'kazuha.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  result=await audit(page);expect(result.result.status).toBe('calculated');expect(result.result.totals.expected).toBeCloseTo(late,7);
  await choose(page,'万叶之一刀·初斩');await choose(page,'万叶之一刀·完整Q直接伤害');
  result=await audit(page);expect(result.document.gameContext.effectiveTalentLevel).toBe(10);
  expect(result.document.gameContext.kazuhaBurst.elementDamageBonuses.pyro).toBe(pyroBonus);
  expect(result.result.totals.expected).toBeCloseTo(late,7);expect(errors).toEqual([]);
  const perHitSettings=page.locator('[data-calculator-kazuha-hit-settings]');
  await expect(perHitSettings).not.toHaveAttribute('open','');
  await expect(perHitSettings.locator('[data-hit-editor]').first()).not.toBeVisible();
  await perHitSettings.locator('summary').first().click();
  await expect(perHitSettings.locator('[data-hit-editor]').first()).toBeVisible();
  await perHitSettings.locator('summary').first().click();
  await page.screenshot({path:info.outputPath('kazuha-1440.png'),fullPage:true});
  await writeFile(info.outputPath('private-kazuha-proof.json'),JSON.stringify({source:'retained public panel; explicit effective talents 10/10/10; actual battle conditions are test assumptions; no fresh account request',wind,early,late,frames:result.document.hits.map((hit:{id:string})=>result.document.gameContext.kazuhaBurst.hitEvents[hit.id].frame)},null,2));
});
