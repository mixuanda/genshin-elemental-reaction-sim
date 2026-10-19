import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { SourceHostResult } from '../../../packages/sim-core/src/source-host-wire';

test('配装加入队伍、18模板生成、动作编辑与实际来源运行',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/builds');
  await expect(page.locator('#build-status')).toContainText('已载入参考配装');
  await page.locator('#build-add-team').click();
  await expect(page).toHaveURL(/\/source-simulation$/);
  const builder=page.locator('#source-team-builder');
  await expect(builder.locator('[data-member-tab]')).toHaveCount(1);
  const templates=await builder.locator('[data-template] option').evaluateAll(options=>options.map(o=>(o as HTMLOptionElement).value).filter(Boolean));
  expect(templates).toHaveLength(18);
  for(const template of templates){
    await builder.locator('[data-template]').selectOption(template);
    await builder.locator(`[data-template-load="${template}"]`).click();
    await expect(builder.locator('.source-team-builder__status')).toContainText('已载入');
    await expect(builder.locator('[data-member-tab]')).toHaveCount(4);
    await builder.locator('[data-apply-script]').click();
    await expect(builder.locator('.source-team-builder__status')).toContainText('脚本已填入');
    expect((await page.locator('#source-host-config').inputValue()).match(/ char lvl=/g)).toHaveLength(4);
  }
  await builder.locator('[data-template]').selectOption('melt-cryo-pyro');
  await builder.locator('[data-template-load="melt-cryo-pyro"]').click();
  const initial=await builder.locator('.source-team-builder__actions > li').count();
  await builder.locator('[data-action-copy="0"]').click();
  await expect(builder.locator('.source-team-builder__actions > li')).toHaveCount(initial+1);
  await builder.locator('[data-action-delete="1"]').click();
  await builder.locator('[data-apply-script]').click();
  const source=await page.locator('#source-host-config').inputValue();
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|运行停止|执行器错误/,{timeout:45000});
  await expect(page.locator('#source-host-status')).toContainText('本次运行完成');
  const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();
  const result=JSON.parse(await readFile((await (await pending).path())!,'utf8')) as SourceHostResult;
  expect(result.config).toBe(source);expect(result.applications.length).toBeGreaterThan(0);
  await writeFile('docs/validation/source-team-builder-20260927.result.json',JSON.stringify(result));
  await expect(page.locator('[data-source-team-logs]')).toContainText('冷却');
  await page.locator('#source-host-open-calculator').click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.locator('#calc-source-host-capture')).toContainText('差值 0');
  expect(errors).toEqual([]);
  console.log(JSON.stringify({templates:templates.length,memberCount:4,durationFrames:(result.result as {duration:number}).duration,hits:result.applications.length,calculations:result.calculations.length,totalDamage:result.applications.reduce((sum,row)=>sum+row.appliedDamage,0),errors}));
});
