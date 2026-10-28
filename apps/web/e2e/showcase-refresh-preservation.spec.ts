import {test,expect} from '@playwright/test';

test('failed showcase refresh preserves successful snapshot and selection',async({page})=>{
 let fail=false;
 await page.route('**/api/showcase/900000003',route=>route.fulfill({status:fail?429:200,contentType:'application/json',body:JSON.stringify(fail?{error:'请求过于频繁'}:{cache:'hit',fetchedAt:'2026-10-21T00:00:00Z',data:{ttl:60,playerInfo:{level:60},avatarInfoList:[{avatarId:10000075,propMap:{'4001':{type:4001,val:'90',ival:'90'}},skillLevelMap:{'10751':10},fightPropMap:{'2000':20000,'2001':2000,'2002':800,'20':0.7,'22':1.2,'23':1,'28':0},equipList:[]}]}})}));
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

test('imported calculator blocks missing fields, retains explicit zero and never re-adds equipment',async({page})=>{
 const avatar={avatarId:10000123,propMap:{'4001':{type:4001,val:'90',ival:'90'}},skillLevelMap:{'11231':10,'11232':10,'11235':10},fightPropMap:{'20':0,'22':1.2,'23':1,'28':0,'40':0,'2000':20000,'2001':2000,'2002':800},equipList:[]};
 let missing=true;
 await page.route('**/api/showcase/900000002',route=>{
  const data: Record<string,unknown>=structuredClone(avatar);
  if(missing){delete data.propMap;const props=data.fightPropMap as Record<string,number>;delete props['2001'];delete props['40'];}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{playerInfo:{},avatarInfoList:[data]},cache:'miss',fetchedAt:'2026-10-21T00:00:00Z'})});
 });
 await page.goto('/calculator');
 await page.locator('#calc-showcase-uid').fill('900000002');
 await page.locator('[data-action="showcase"]').click();
 await page.locator('[data-showcase-index="0"]').click();
 await expect(page.locator('#calc-results')).toContainText('导入缺少');
 await expect(page.locator('#calc-results')).toContainText('角色等级');
 await expect(page.locator('#calc-results')).toContainText('攻击力');
 await expect(page.getByTestId('calc-expected')).toHaveCount(0);
 missing=false;
 await page.locator('[data-action="showcase"]').click();
 await page.locator('[data-showcase-index="0"]').click();
 const white=await page.locator('#calc-skill option').filter({hasText:'白化之是'}).first().getAttribute('value');
 await page.locator('#calc-skill').selectOption(white!);
 await expect(page.getByTestId('calc-expected')).toBeVisible();
 const audit=JSON.parse((await page.locator('#calc-results .calculator-audit pre').textContent())!);
 expect(audit.document.build.stats.critRate).toBe(0);
 expect(audit.document.build.stats.em).toBe(0);
 expect(audit.result.totals.expected).toBeCloseTo(audit.result.totals.nonCritical,8);
 expect(audit.result.trace.some((n:{id:string})=>n.id==='build.baseAtk')).toBe(false);
 expect(audit.document.hits[0].damageBonus).toBe(0);
});
