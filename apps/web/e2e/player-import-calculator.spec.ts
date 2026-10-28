import {test,expect,type Page} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseGoodBuilds} from '../../../packages/game-data/src/build-import';
const evidence=process.env.GIDPS_IMPORT_EVIDENCE??'test-results/player-import';
const fixture=new URL('./fixtures/player-import/kaeya-good.json',import.meta.url);
async function frost(page:Page){
 await expect(page.locator('#calc-skill')).toBeEnabled();
 const option=page.locator('#calc-skill option').filter({hasText:'霜袭·命中'});
 await page.locator('#calc-skill').selectOption((await option.getAttribute('value'))!);
 await page.locator('#calc-results .calculator-audit').evaluate(el => { if (el instanceof HTMLDetailsElement) el.open=true; });
 await expect(page.locator('#calc-results .calculator-audit pre')).toBeVisible();
 return JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
}
test('GOOD preview to real Kaeya E equals existing editable equipment route; C3 once',async({page})=>{
 test.setTimeout(90000);await mkdir(evidence,{recursive:true});
 const raw=JSON.parse(await readFile(fixture,'utf8'));
 await page.goto('/builds');await page.locator('[data-player-fixture]').check();
 await page.locator('[data-player-file]').setInputFiles({name:'synthetic-kaeya.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
 await expect(page.locator('[data-player-calculate]')).toBeEnabled();
 await expect(page.locator('[data-player-source]')).toContainText('合成测试数据');
 await page.locator('[data-player-import]').screenshot({path:`${evidence}/preview.png`});
 await page.locator('[data-player-calculate]').click();await expect(page).toHaveURL(/\/calculator$/);
 const imported=await frost(page);
 expect(imported.result.status).toBe('calculated');expect(imported.document.gameContext.effectiveTalentLevel).toBe(13);
 expect(imported.document.gameContext.constellation).toBe(3);expect(imported.document.build.mode).toBe('equipment-derived');
 expect(imported.result.totals.expected).toBeGreaterThan(0);
 expect(imported.document.assumptions.join(' ')).toContain('合成测试数据');
 expect(imported.document.assumptions.join(' ')).not.toContain('C0；只使用列出的伤害表达式。');
 await page.locator('#calc-results').screenshot({path:`${evidence}/calculation.png`});
 const legacy=parseGoodBuilds(raw).builds[0]!;expect(legacy.equipmentInput).not.toBeNull();
 await page.goto('/builds');
 await page.locator('#build-import').setInputFiles({name:'same-manual-equipment.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:'editable-build-v1',name:'同配置编辑器对照',input:legacy.equipmentInput,metadata:{constellation:3,baseTalentLevels:{auto:10,skill:10,burst:10}}}))});
 await expect(page.locator('#build-character')).toHaveValue('character:10000015');
 await page.locator('#build-open-calculator').click();await expect(page).toHaveURL(/\/calculator$/);
 const manual=await frost(page);expect(imported.result.totals).toEqual(manual.result.totals);
 expect(imported.result.hits.map((h:any)=>({nonCritical:h.nonCritical,critical:h.critical,expected:h.expected}))).toEqual(manual.result.hits.map((h:any)=>({nonCritical:h.nonCritical,critical:h.critical,expected:h.expected})));
 await writeFile(`${evidence}/comparison.json`,JSON.stringify({fixture:'synthetic Kaeya C3 +0 artifacts; not an account',imported,manual},null,2));
});
test('missing data and failed parsing preserve prior complete preview; Enka/text never silently default',async({page})=>{
 await page.goto('/builds');await page.locator('[data-player-fixture]').check();
 const raw=JSON.parse(await readFile(fixture,'utf8'));
 await page.locator('[data-player-input]').fill(JSON.stringify(raw));await page.locator('[data-player-preview]').click();await expect(page.locator('[data-player-calculate]')).toBeEnabled();
 delete raw.characters[0].level;
 await page.locator('[data-player-input]').fill(JSON.stringify(raw));await page.locator('[data-player-preview]').click();await expect(page.locator('[data-player-calculate]')).toBeDisabled();
 await page.locator('[data-player-restore]').click();await expect(page.locator('[data-player-calculate]')).toBeEnabled();
 await page.locator('[data-player-input]').fill('{broken');await page.locator('[data-player-preview]').click();await expect(page.locator('[data-player-status]')).toContainText('未应用');await expect(page.locator('[data-player-calculate]')).toBeEnabled();
 for(const name of ['synthetic-enka.json','synthetic-hutao-multi.txt']){
  await page.locator('[data-player-input]').fill(await readFile(new URL(`../../../packages/player-import/fixtures/${name}`,import.meta.url),'utf8'));
  await page.locator('[data-player-preview]').click();await expect(page.locator('[data-player-source]')).toContainText(name.endsWith('.txt')?'hutao-text':'enka-json');
  if(name.endsWith('.txt'))await expect(page.locator('[data-player-builds]')).toContainText('暂不可计算');
 }
});

test('Enka panel without equipment computes Kaeya E13 using unchanged final stats',async({page})=>{
 await page.goto('/builds');await page.locator('[data-player-fixture]').check();
 await page.locator('[data-player-file]').setInputFiles(new URL('./fixtures/player-import/kaeya-enka-panel.json',import.meta.url).pathname);
 await expect(page.locator('[data-player-calculate]')).toBeDisabled();
 await expect(page.locator('[data-player-panel]')).toBeEnabled();
 await page.locator('[data-player-panel]').click();
 const actual=await frost(page);
 expect(actual.document.build.mode).toBe('imported-final');expect(actual.document.build.stats.atk).toBe(1700);
 expect(actual.document.gameContext.constellation).toBe(3);expect(actual.document.gameContext.effectiveTalentLevel).toBe(13);
 expect(actual.document.assumptions.join(' ')).toContain('条件增益');expect(actual.result.status).toBe('calculated');
 // Lv90 vs Lv90, 10% resistance, E13 multiplier 4.063: shared formula independently hand-checked.
 const expected=1700*4.063*1.616*0.5*0.9*(1+0.4*1);
 expect(actual.result.totals.expected).toBeCloseTo(expected,6);
 await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/enka-panel.json`,JSON.stringify({expected,actual},null,2));
 await page.locator('#calc-results').screenshot({path:`${evidence}/enka-panel.png`});
});
