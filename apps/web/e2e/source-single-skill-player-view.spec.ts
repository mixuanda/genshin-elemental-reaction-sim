import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const evidence=process.env.GIDPS_SINGLE_UI_EVIDENCE;
async function openPanel(page:Page){
 await page.goto('/calculator');await page.locator('[data-action="source-single-skill"]').first().click();
 const panel=page.locator('[data-source-single-skill]');
 await panel.locator('[data-single-character] option[value="kaeya"]').waitFor({state:'attached'});
 await panel.locator('[data-single-character]').selectOption('kaeya');
 await panel.locator('[data-single-action]').selectOption('skill');return panel;
}
async function download(page:Page,button:Locator){
 const pending=page.waitForEvent('download');await button.click();
 return JSON.parse(await readFile((await(await pending).path())!,'utf8'));
}

test('source single-skill view hides technical fields while preserving editable player inputs and exact exported values',async({page})=>{
 const panel=await openPanel(page);
 for(const selector of ['[data-single-character]','[data-single-tier]','[data-single-action]','[data-single-weapon]','[data-single-target="level"]','[data-single-target="resistance"]','[data-single-startup]'])await expect(panel.locator(selector)).toBeVisible();
 for(const selector of ['[data-single-source]','[data-target-geometry="radius"]','[data-single-seed]'])await expect(panel.locator(selector)).toBeHidden();
 const original=await download(page,panel.locator('[data-single-export-input]'));
 for(const summary of ['[data-single-source-details] > summary','[data-single-advanced="target"] > summary','[data-single-advanced="run"] > summary'])await panel.locator(summary).click();
 await expect(panel.locator('[data-single-source-details]')).toContainText('不表示完整施放，也不显示 DPS');
 await expect(panel.locator('[data-target-geometry="radius"]')).toBeVisible();
 await expect(panel.locator('[data-single-seed]')).toBeVisible();
 for(const summary of ['[data-single-source-details] > summary','[data-single-advanced="target"] > summary','[data-single-advanced="run"] > summary'])await panel.locator(summary).click();
 expect(await download(page,panel.locator('[data-single-export-input]'))).toEqual(original);
 if(evidence){await mkdir(evidence,{recursive:true});await panel.screenshot({path:resolve(evidence,'single-skill-player-after.png')});}
 await panel.locator('[data-single-advanced="run"] > summary').click();
 await panel.locator('[data-single-action]').selectOption('burst');
 await expect(panel.locator('[data-single-advanced="run"]')).toHaveAttribute('open','');
});

test('missing target geometry and required drop choices reveal the existing controls with local errors and focus',async({page})=>{
 const requests:string[]=[];page.on('request',request=>{if(request.url().includes('source-host.wasm'))requests.push(request.url());});
 const panel=await openPanel(page),advanced=panel.locator('[data-single-advanced="target"]');
 await advanced.locator(':scope > summary').click();
 const radius=panel.locator('[data-single-first-target] [data-target-geometry="radius"]');const initial=await radius.inputValue();
 await radius.fill('');await advanced.locator(':scope > summary').click();await panel.locator('[data-single-run]').click();
 await expect(radius).toBeVisible();await expect(radius).toBeFocused();await expect(radius).toHaveAttribute('aria-invalid','true');
 await expect(panel.locator('[data-single-input-error]')).toBeVisible();await expect(panel.locator('[data-single-status]')).toContainText('目标半径');
 if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:resolve(evidence,'single-skill-missing-target-after.png')});}
 await radius.fill(initial);await expect(panel.locator('[data-single-input-error]')).toHaveCount(0);
 const profile=panel.locator('[data-single-first-target] [data-source-target-profile-controls]');
 await profile.locator(':scope > summary').click();
 await profile.locator('[data-target-profile="hp"]').fill('10000');
 await profile.locator('[data-target-profile="particleThreshold"]').fill('100');await profile.locator('[data-target-profile="particleCount"]').fill('1');
 await profile.locator(':scope > summary').click();await advanced.locator(':scope > summary').click();
 await panel.locator('[data-single-run]').click();
 const element=profile.locator('[data-target-profile="particleElement"]');
 await expect(element).toBeVisible();await expect(element).toBeFocused();await expect(panel.locator('[data-single-input-error]')).toBeVisible();
 await expect(panel.locator('[data-single-status]')).toContainText('自定义目标掉球须完整填写');
 await element.selectOption('none');
 const repaired=await download(page,panel.locator('[data-single-export-input]'));
 expect(repaired.target.particleDrops).toEqual({threshold:100,count:1,element:'none'});
 expect(requests).toEqual([]);
});

test('one real action keeps results and missing-evidence states visible while folded target records preserve the stored result',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const panel=await openPanel(page);await panel.locator('[data-single-advanced="run"] > summary').click();
 await panel.locator('[data-single-duration]').fill('2');await panel.locator('[data-single-seed]').fill('11');
 await panel.locator('[data-single-advanced="run"] > summary').click();
 const input=await download(page,panel.locator('[data-single-export-input]'));
 await panel.locator('[data-single-run]').click();await expect(panel.locator('[data-single-status]')).toContainText('运行完成',{timeout:45000});
 await expect(panel.locator('[data-single-known-subtotal]')).toBeVisible();await expect(panel.locator('[data-single-finite-cast]')).toBeVisible();
 await expect(panel.locator('[data-single-result-context]')).not.toHaveAttribute('open');
 await expect(panel.locator('[data-single-target-summary]')).toBeHidden();
 const original=await download(page,panel.locator('[data-single-result-export]'));expect(original.input).toEqual(input);expect(original.result.applications.length).toBeGreaterThan(0);
 await panel.locator('[data-single-result-context] > summary').click();await expect(panel.locator('[data-single-target-summary]')).toBeVisible();
 await panel.locator('[data-single-result-context] > summary').click();
 expect(await download(page,panel.locator('[data-single-result-export]'))).toEqual(original);
 if(evidence){await panel.locator('[data-source-single-result]').screenshot({path:resolve(evidence,'single-skill-result-after.png')});}
 await panel.locator('[data-single-target="level"]').fill('99');
 await expect(panel.locator('[data-single-result-stale]')).toBeVisible();expect(await download(page,panel.locator('[data-single-result-export]'))).toEqual(original);
 expect(errors).toEqual([]);
});
