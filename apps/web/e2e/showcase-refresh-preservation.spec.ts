import {test,expect} from '@playwright/test';

test('failed showcase refresh preserves successful snapshot and selection',async({page})=>{
 let fail=false;
 await page.route('**/api/showcase/900000003',route=>route.fulfill({status:fail?429:200,contentType:'application/json',body:JSON.stringify(fail?{error:'请求过于频繁'}:{cache:'hit',fetchedAt:'2026-10-21T00:00:00Z',data:{ttl:60,playerInfo:{level:60},avatarInfoList:[{avatarId:10000075,propMap:{'4001':{type:4001,ival:'90'}},skillLevelMap:{'10751':10},fightPropMap:{'2000':20000,'2001':2000,'2002':800,'20':0.7,'22':1.2,'23':1,'28':0},equipList:[]}]}})}));
 await page.goto('/');
 await page.getByRole('button',{name:'账号展示柜',exact:true}).click();
 await page.locator('#showcaseUidInput').fill('900000003');
 await page.locator('#showcaseImportButton').click();
 await expect(page.locator('#showcaseStatus')).toContainText('导入成功');
 await page.getByRole('button',{name:'设为毕业站位占位'}).click();
 const cards=await page.locator('#showcaseCharacters').innerHTML();
 const selection=await page.locator('#graduationPlaceholder').innerHTML();
 fail=true;
 await page.locator('#showcaseImportButton').click();
 await expect(page.locator('#showcaseStatus')).toContainText('请求过于频繁');
 await expect(page.locator('#showcaseStatus')).toContainText('不是本次刷新结果');
 expect(await page.locator('#showcaseCharacters').innerHTML()).toBe(cards);
 expect(await page.locator('#graduationPlaceholder').innerHTML()).toBe(selection);
 await expect(page.locator('#showcaseImportButton')).toBeEnabled();
});
