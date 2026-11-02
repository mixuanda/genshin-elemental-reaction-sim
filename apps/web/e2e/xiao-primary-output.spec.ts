import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const audit=async(page:Page)=>JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
const choose=async(page:Page,text:string)=>{
 const option=page.locator('#calc-skill option').filter({hasText:text});await expect(option).toHaveCount(1);
 await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
};
const number=async(page:Page,key:string,value:string)=>{
 const input=page.locator(`[data-field="gameContext.xiaoDamage.${key}"]`);await expect(input).toBeVisible();await input.fill(value);await input.blur();
};
for(const width of [1440,390])test(`Xiao actual Q outputs, E stacks and saved state at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:960});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/calculator');await page.locator('#calc-character').selectOption('character:10000026');
 await page.locator('#calc-constellation').selectOption('1');
 await choose(page,'靖妖傩舞·高空下落');let r=await audit(page);expect(r.result.status).toBe('blocked');
 await number(page,'burstTalentLevel','10');await number(page,'burstElapsedSeconds','0');r=await audit(page);
 expect(r.result.status).toBe('calculated');expect(r.document.gameContext.skillId).toBe('xiao-q-high-plunge');
 const d=r.document,stats=d.build.stats;const defense=(d.characterLevel+100)/((d.characterLevel+100)+(d.enemy.level+100));
 const independent=stats.atk*4.040179*(1+.952+.05)*defense*.9;
 expect(r.result.totals.nonCritical).toBeCloseTo(independent,8);
 await number(page,'burstElapsedSeconds','3');r=await audit(page);
 expect(r.result.totals.nonCritical).toBeCloseTo(stats.atk*4.040179*(1+.952+.10)*defense*.9,8);
 const expected=r.result.totals.expected;
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const file=await (await download).path();
 const exported=JSON.parse(await readFile(file!,'utf8'));
 await page.reload();await page.locator('#calc-import').setInputFiles({name:'xiao.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 r=await audit(page);expect(r.result.status).toBe('calculated');expect(r.result.totals.expected).toBe(expected);expect(r.document.gameContext.xiaoDamage.burstElapsedSeconds).toBe(3);
 await choose(page,'风轮两立·单次E');r=await audit(page);expect(r.result.status).toBe('calculated');const e0=r.result.totals.nonCritical;
 await number(page,'skillA4Stacks','1');r=await audit(page);expect(r.result.totals.nonCritical).toBeCloseTo(e0*1.15,8);
 await page.locator('[data-source-cast-state-field="gameContext.xiaoDamage.burstActive"]').selectOption('1');await number(page,'burstElapsedSeconds','6');r=await audit(page);
 expect(r.result.status).toBe('calculated');expect(r.result.totals.nonCritical).toBeCloseTo(e0*1.30,8);
 await choose(page,'靖妖傩舞（开启状态，无直接伤害）');r=await audit(page);expect(r.result.hits[0].status).toBe('non-damaging');
 const selected=page.locator('[data-character-output-index][aria-current="true"]');await expect(selected).toContainText('不直接造成伤害');expect(await selected.locator('.character-output-metrics').count()).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await choose(page,'靖妖傩舞·高空下落');await page.screenshot({path:info.outputPath(`xiao-${width}.png`),fullPage:true});
});
