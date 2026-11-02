import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const evidence=process.env.GIDPS_IMPORT_ENTRY_EVIDENCE_DIR;
for(const viewport of [{width:1365,height:1000},{width:390,height:844}]){
 for(const [name,route] of [['home','/'],['empty-team','/source-simulation'],['builds','/builds']] as const){
  test(`${name} has a first-screen import entry that focuses the existing public UID input (${viewport.width}px)`,async({page})=>{
   test.setTimeout(60000);
   await page.setViewportSize(viewport);
   const externalActions:string[]=[],errors:string[]=[];
   page.on('request',request=>{if(/\/api\/showcase\/|source-host\.wasm/.test(request.url()))externalActions.push(request.url());});
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(route);
   if(name==='empty-team')await expect(page.locator('[data-add-character]')).toBeVisible();
   const button=page.getByRole('button',{name:name==='builds'?'用 UID 读取公开展柜':'导入我的角色 / 配装',exact:true});
   await expect(button).toBeInViewport();
   if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:resolve(evidence,`${name}-${viewport.width}-before.png`)});}
   await button.click();
   const uid=page.locator('#build-uid');
   await expect(page).toHaveURL(/\/builds(?:#import-uid)?$/);
   await expect(uid).toBeVisible();await expect(uid).toBeInViewport();await expect(uid).toBeFocused();
   await expect(page.locator('#build-fetch')).toHaveText('读取公开展示柜');
   await expect(page.locator('[data-build-import-entry]')).toContainText('UID 只读取 Enka 公开展示柜');
   if(evidence)await page.screenshot({path:resolve(evidence,`${name}-${viewport.width}-after.png`)});
   expect(externalActions).toEqual([]);expect(errors).toEqual([]);
  });
 }
}

test('build-page shortcuts reopen the existing folded UID and file controls',async({page})=>{
 await page.goto('/builds');
 await expect(page.locator('[data-build-import-entry]')).toBeVisible();
 await page.locator('#build-uid').evaluate(input=>{input.closest('details')!.open=false;});
 await page.getByRole('button',{name:'用 UID 读取公开展柜',exact:true}).click();
 await expect(page.locator('#build-uid')).toBeVisible();await expect(page.locator('#build-uid')).toBeInViewport();await expect(page.locator('#build-uid')).toBeFocused();
 await page.locator('[data-player-file]').evaluate(input=>{input.closest('details')!.open=false;});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.getByRole('button',{name:'导入本地配装文件',exact:true}).click();
 await expect(page.locator('[data-player-file]')).toBeVisible();await expect(page.locator('[data-player-file]')).toBeInViewport();await expect(page.locator('[data-player-file]')).toBeFocused();
});

test('empty-team import entry follows member changes and file navigation reuses the existing input',async({page})=>{
 await page.goto('/source-simulation');
 const entry=page.locator('[data-build-import-shortcut]');
 await expect(page.locator('[data-add-character]')).toBeVisible();await expect(entry).toBeVisible();
 await page.locator('[data-add-character]').selectOption('kaeya');
 await expect(page.locator('[data-member-tab]')).toHaveCount(1);await expect(entry).toBeHidden();
 await page.getByText('高级：装备、天赋与角色属性',{exact:true}).click();
 await page.locator('[data-remove-member]').click();
 await expect(page.locator('[data-member-tab]')).toHaveCount(0);await expect(entry).toBeVisible();
 await page.getByRole('button',{name:'导入本地配装文件',exact:true}).click();
 await expect(page).toHaveURL(/\/builds#import-file$/);
 await expect(page.locator('[data-player-file]')).toBeVisible();await expect(page.locator('[data-player-file]')).toBeInViewport();await expect(page.locator('[data-player-file]')).toBeFocused();
 await page.goBack();
 await expect(page).toHaveURL(/\/source-simulation$/);await expect(page.locator('[data-build-import-shortcut]')).toBeVisible();
});
