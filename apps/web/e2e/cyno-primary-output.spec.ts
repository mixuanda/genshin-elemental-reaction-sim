import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';

const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
async function choose(page:Page,text:string){
  const option=page.locator('#calc-skill option').filter({hasText:text});
  await expect(option).toHaveCount(1);
  await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
}
async function qConditions(page:Page){
  for(const [key,value] of [['burstActive','1'],['burstEmIncludedInPanel','0']] as const){
    await page.locator(`[data-source-cast-state-field="gameContext.cynoDamage.${key}"]`).first().selectOption(value);
  }
}
test('retained Cyno Q normal and charged damage use effective Q talent and reopen unchanged',async({page},info)=>{
  const file=process.env.GIDPS_RETAINED_UID_RESPONSE;test.skip(!file,'Retained public response remains outside the repository');
  const envelope=JSON.parse(await readFile(file!,'utf8')),raw=envelope.data??envelope;
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/calculator');await page.locator('[data-action="import-build"]').click();
  await page.locator('[data-player-file]').setInputFiles({name:'retained-enka.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  const role=page.locator('[data-player-builds] section').filter({has:page.getByRole('heading',{name:'赛诺',exact:true})});
  await expect(role).toHaveCount(1);await expect(role.locator('[data-player-panel]')).toBeDisabled();
  await role.getByText('补充有效天赋等级后计算',{exact:true}).click();
  for(const key of ['auto','skill','burst'])await role.locator(`[data-player-talent-${key}]`).fill('1');
  await role.locator('[data-player-manual-panel]').click();
  await choose(page,'启途誓使·普攻第一段');await qConditions(page);
  let r=await audit(page);
  expect(r.document.characterLevel).toBe(60);expect(r.document.gameContext.constellation).toBe(0);
  expect(r.document.gameContext.effectiveTalentLevel).toBe(1);expect(r.document.gameContext.ascension).toBe(3);
  expect(r.document.gameContext.abilityId).toBe('talent:cyno:combat3');expect(r.result.status).toBe('calculated');
  expect(r.document.gameContext.manualEffectiveTalents).toEqual({auto:1,skill:1,burst:1});expect(r.document.gameContext.cynoDamage.includedA4Base).toBe(0);
  expect(r.document.build.source).toContain('用户手动输入，未由展柜验证');
  const s=r.document.build.stats,bonus=r.document.hits[0].damageBonus;
  const normal=s.atk*.782832*(1+bonus)*(160/350)*.9*(1+Math.min(1,s.critRate)*s.critDamage);
  expect(r.result.totals.expected).toBeCloseTo(normal,7);
  expect(r.document.build.mode).toBe('imported-final');expect(r.document.build).not.toHaveProperty('equipment');
  await choose(page,'启途誓使·重击');await qConditions(page);r=await audit(page);expect(r.result.status).toBe('calculated');
  const charged=s.atk*1.0105*(1+r.document.hits[0].damageBonus)*(160/350)*.9*(1+Math.min(1,s.critRate)*s.critDamage);
  expect(r.result.totals.expected).toBeCloseTo(charged,7);
  const expected=r.result.totals.expected,downloading=page.waitForEvent('download');await page.locator('[data-action="export"]').click();
  const saved=await readFile((await(await downloading).path())!,'utf8');
  await page.reload();await page.locator('#calc-import').setInputFiles({name:'cyno.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBe(expected);expect(r.document.characterLevel).toBe(60);
  await page.setViewportSize({width:390,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('cyno-390.png'),fullPage:true});
  await writeFile(info.outputPath('private-cyno-proof.json'),JSON.stringify({source:'previously retained public panel; effective talents explicitly entered, not source evidence; Q active, Q100EM not in input panel, ascension3 excludes A4',level:60,constellation:0,manualEffectiveTalents:{auto:1,skill:1,burst:1},normal,charged,reopenedExpected:expected},null,2));
});
