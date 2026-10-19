import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { CalculatorDocument } from '@genshin-dps-lab/sim-core';

test('全角色配装入口、两档编辑、独立技能与本地真实词条导入', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/builds');
  await expect(page.locator('#build-count')).toContainText('124');
  await expect(page.locator('#build-character option')).toHaveCount(124);
  await page.locator('#build-character').selectOption('character:10000021');
  await page.locator('#build-tier').selectOption('developed');
  await expect(page.locator('#build-status')).toContainText('已载入参考配装');
  await page.locator('#build-save').click();
  await expect(page.locator('#build-status')).toContainText('已保存');
  await page.locator('#build-open-calculator').click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator('#calc-character')).toHaveValue('character:10000021');
  const pending=page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const document=JSON.parse(await readFile((await (await pending).path())!,'utf8')) as CalculatorDocument;
  expect(document.build.mode).toBe('equipment-derived');
  if(document.build.mode!=='equipment-derived')throw new Error('build mode');
  expect(document.build.equipment?.artifacts).toHaveLength(5);
  expect(document.gameContext?.constellation).toBe(0);
  expect(document.gameContext?.effectiveTalentLevel).toBe(9);
  await page.locator('.product-nav a[href="/builds"]').click();
  await page.locator('#build-load').click();
  await expect(page.locator('#build-status')).toContainText('已载入配装');
  const good={format:'GOOD',version:1,source:'local-editable-build-test',characters:[{key:'Amber',level:90,constellation:0,ascension:6,talent:{auto:9,skill:10,burst:10}}],weapons:[{key:'FavoniusWarbow',level:90,ascension:6,refinement:1,location:'Amber',lock:false}],artifacts:[
    {setKey:'GladiatorsFinale',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',location:'Amber',lock:false,substats:[{key:'critRate_',value:7},{key:'critDMG_',value:14},{key:'atk_',value:10.5},{key:'enerRech_',value:5.8}]},
    {setKey:'GladiatorsFinale',slotKey:'plume',rarity:5,level:20,mainStatKey:'atk',location:'Amber',lock:false,substats:[{key:'critRate_',value:7},{key:'critDMG_',value:14},{key:'atk_',value:10.5},{key:'enerRech_',value:5.8}]},
    {setKey:'GladiatorsFinale',slotKey:'sands',rarity:5,level:20,mainStatKey:'atk_',location:'Amber',lock:false,substats:[{key:'critRate_',value:7},{key:'critDMG_',value:14},{key:'atk',value:19},{key:'enerRech_',value:5.8}]},
    {setKey:'GladiatorsFinale',slotKey:'goblet',rarity:5,level:20,mainStatKey:'pyro_dmg_',location:'Amber',lock:false,substats:[{key:'critRate_',value:7},{key:'critDMG_',value:14},{key:'atk_',value:10.5},{key:'enerRech_',value:5.8}]},
    {setKey:'GladiatorsFinale',slotKey:'circlet',rarity:5,level:20,mainStatKey:'critRate_',location:'Amber',lock:false,substats:[{key:'atk_',value:10.5},{key:'critDMG_',value:14},{key:'atk',value:19},{key:'enerRech_',value:5.8}]},
  ]};
  await page.locator('#build-import').setInputFiles({name:'account.good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(good))});
  await page.getByRole('button',{name:'编辑这套真实配装'}).click();
  await expect(page.locator('#build-status')).toContainText('已载入真实配装');
  await page.locator('#build-open-calculator').click();
  await expect(page).toHaveURL(/\/calculator$/);
  const importedPending=page.waitForEvent('download'); await page.locator('[data-action="export"]').click();
  const imported=JSON.parse(await readFile((await (await importedPending).path())!,'utf8')) as CalculatorDocument;
  expect(imported.build.mode).toBe('equipment-derived');
  if(imported.build.mode!=='equipment-derived')throw new Error('import build mode');
  expect(imported.build.equipment?.artifacts?.every(piece=>piece.observed !== undefined)).toBe(true);
  expect(imported.build.critRate).toBeCloseTo(0.05+0.311+0.07*4,5);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({identities:124,presetArtifactCount:document.build.equipment?.artifacts?.length,importedArtifacts:imported.build.equipment?.artifacts?.length,importedCritRate:imported.build.critRate,importedWeapon:imported.build.equipment?.weaponId,errors}));
});
