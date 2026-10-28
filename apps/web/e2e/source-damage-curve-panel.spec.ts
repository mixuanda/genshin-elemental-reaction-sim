import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';

// Bundle only this component in memory: no simulation, shared dist writes, or private fixture.
let panelScript:string,styles:string;
test.beforeAll(async()=>{
 const bundled=await build({configFile:false,publicDir:false,logLevel:'silent',build:{write:false,emptyOutDir:false,lib:{entry:fileURLToPath(new URL('../src/source-damage-curve-panel.ts',import.meta.url)),name:'SourceDamageCurvePanel',formats:['iife']}}});
 const output=Array.isArray(bundled)?bundled[0]:bundled;
 if(!output||!('output' in output))throw Error('Expected an in-memory component bundle');
 const chunk=output.output.find(file=>file.type==='chunk');
 if(!chunk)throw Error('Missing component script');
 panelScript=chunk.code;
 styles=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
});

const fixture=()=>({
 observationWindow:{endReason:'duration',actualEndFrame:7200,configuredEndFrame:7200},
 targetScene:{targets:[{}]},
 applications:[
  {id:1,calculationId:1,frame:1,appliedDamage:10},
  {id:2,calculationId:2,frame:59,appliedDamage:20},
  {id:3,calculationId:3,frame:59,appliedDamage:30},
  {id:4,calculationId:4,frame:119,appliedDamage:40},
  {id:5,calculationId:5,frame:7199,appliedDamage:50},
  {id:6,calculationId:5,frame:7200,appliedDamage:999}
 ],
 calculations:[
  {request:{id:1,kind:'damage',actorKey:'kaeya',ability:'normal',element:'physical',attackTagName:'AttackTagNormal',damageCategory:'ordinary',rawAttack:{Catalyzed:false},input:{amped:false}}},
  {request:{id:2,kind:'damage',actorKey:'kaeya',ability:'skill',element:'cryo',attackTagName:'AttackTagElementalArt',damageCategory:'ordinary',rawAttack:{Catalyzed:false},input:{amped:false}}},
  {request:{id:3,kind:'damage',actorKey:'xiangling',ability:'burst',element:'pyro',attackTagName:'AttackTagElementalBurst',damageCategory:'ordinary',rawAttack:{Catalyzed:false},input:{amped:true,amplifyingReaction:'melt'}}},
  {request:{id:5,kind:'damage',actorKey:'sucrose',ability:'swirl',element:'anemo',attackTagName:'AttackTagSwirlPyro',damageCategory:'transformative',rawAttack:{},input:{amped:false}}}
 ],
 abilityInvocations:[{id:1,success:true,action:'skill',startedFrame:1,characterKey:'kaeya'},{id:2,success:true,action:'burst',startedFrame:59,characterKey:'xiangling'}],
 logs:[
  {event:'status',msg:'stat mod added',frame:1,char_index:0,logs:{key:'bennett-field',expiry:90}},
  {event:'status',msg:'enemy mod added',frame:2,char_index:-1,logs:{key:'vvcryo'}}
 ]
}) as unknown as SourceHostResult;

async function renderPanel(page:Page,result:SourceHostResult=fixture(),names:Record<string,string>={}){
 await page.setViewportSize({width:1280,height:1100});
 await page.setContent('<!doctype html><html lang="zh-CN"><head><title>伤害曲线面板</title></head><body><main id="curve"></main></body></html>');
 await page.addStyleTag({content:styles});
 await page.addScriptTag({content:panelScript});
 await page.evaluate(({result,names})=>{
  const panel=(window as unknown as {SourceDamageCurvePanel:{renderSourceDamageCurve:(root:HTMLElement,result:SourceHostResult,actorName?:(key:string)=>string|undefined)=>void}}).SourceDamageCurvePanel;
  panel.renderSourceDamageCurve(document.querySelector<HTMLElement>('#curve')!,result,key=>names[key]);
 },{result,names});
}

async function tableSums(page:Page){
 return page.locator('[data-curve-table]').evaluateAll(tables=>tables.map(table=>Array.from(table.querySelectorAll<HTMLElement>('tbody tr')).reduce((sum,row)=>sum+Number(row.dataset.damage),0)));
}

test('default view exposes the curve and attribution while provenance opens by keyboard without changing data',async({page})=>{
 await renderPanel(page);
 const details=page.locator('[data-curve-methodology]'),summary=details.locator('summary');
 await expect(page.locator('[data-curve-guidance]')).toHaveText('单次模拟 · 默认1秒汇总。切换曲线或筛选角色，悬浮查看伤害，下方查看角色贡献。');
 await expect(details).not.toHaveAttribute('open');
 await expect(details.locator('p').first()).toBeHidden();
 await expect(page.locator('[data-curve-svg]')).toBeInViewport();
 await expect(page.getByRole('heading',{name:'角色贡献',exact:true})).toBeInViewport();
 await expect(page.locator('[data-curve-table]')).toHaveCount(4);
 expect(await tableSums(page)).toEqual([150,150,150,150]);
 const before=await page.locator('[data-curve-graph]').innerHTML();
 await summary.focus();await page.keyboard.press('Enter');
 await expect(details).toHaveAttribute('open','');
 await expect(details.locator('p').first()).toBeVisible();
 for(const explanation of ['按60 FPS模拟','每笔事件的原始帧号','不代表游戏显示帧率或服务端精度','截止帧不计入','空档为零','持续伤害按实际 tick','现有批量摘要未保存每秒时序','不是多次模拟平均曲线','标记保留全队原事件','已保存旧快照','四个表是同一份伤害的不同切面，不能相加','不再另加“反应伤害”','保留后台伤害','缺归属显示 unknown','绝不按站场角色猜','其他增益未完整标注','1 条缺少目标/期限/前序状态的区间日志未绘制'])await expect(details).toContainText(explanation);
 expect(await page.locator('[data-curve-graph]').innerHTML()).toBe(before);
 expect(await tableSums(page)).toEqual([150,150,150,150]);
 await page.keyboard.press('Enter');
 await expect(details).not.toHaveAttribute('open');
 await expect(details.locator('p').first()).toBeHidden();
});

test('mode, filtering and frame controls preserve original events and four contribution totals',async({page})=>{
 await renderPanel(page);
 await expect(page.locator('[data-curve-mode]')).toHaveValue('damage');
 await expect(page.locator('[data-curve-mode] option')).toHaveText(['1秒汇总','逐击伤害（帧）','逐击累计阶梯']);
 await page.locator('[data-curve-events] > summary').click();
 await expect(page.locator('[data-curve-event-table] tbody tr')).toHaveCount(5);
 const rows=()=>page.locator('[data-curve-event-table] tbody tr').evaluateAll(events=>events.map(event=>({id:Number((event as HTMLElement).dataset.eventId),frame:Number((event as HTMLElement).dataset.eventFrame)})));
 expect(await rows()).toEqual([{id:1,frame:1},{id:2,frame:59},{id:3,frame:59},{id:4,frame:119},{id:5,frame:7199}]);
 await expect(page.locator('[data-curve-table="actor"] [data-group="unknown"]')).toContainText('未分类 / unknown');
 await page.locator('[data-curve-mode]').selectOption('events');
 await expect(page.locator('[data-curve-event-point]')).toHaveCount(5);
 await page.locator('[data-curve-start]').fill('0');await page.locator('[data-curve-end]').fill('60');await page.locator('[data-curve-zoom]').click();
 expect(await rows()).toEqual([{id:1,frame:1},{id:2,frame:59},{id:3,frame:59}]);
 await expect(page.locator('[data-curve-event-point]')).toHaveCount(3);
 expect(await tableSums(page)).toEqual([150,150,150,150]);
 await page.locator('[data-curve-mode]').selectOption('cumulative');
 const points=(await page.locator('[data-curve-step]').getAttribute('points'))!.split(' ').map(pair=>pair.split(',').map(Number));
 for(let i=1;i<points.length;i++)expect(points[i]![0]===points[i-1]![0]||points[i]![1]===points[i-1]![1]).toBe(true);
 await page.locator('[data-curve-filter="actor"]').selectOption('xiangling');
 expect(await rows()).toEqual([{id:3,frame:59}]);
 expect(await tableSums(page)).toEqual([30,30,30,30]);
 await expect(page.locator('[data-curve-total]')).toContainText('筛选后 30（1 击），累计终值 30');
 await page.locator('[data-curve-methodology] > summary').click();
 expect(await rows()).toEqual([{id:3,frame:59}]);
 expect(await tableSums(page)).toEqual([30,30,30,30]);
 await page.locator('[data-curve-filter="actor"]').selectOption('');
 expect(await tableSums(page)).toEqual([150,150,150,150]);
});

test('the actual 619-hit team exposes both Nicole projection sources without changing the damage owner',async({page},testInfo)=>{
 const recorded=JSON.parse(await readFile(new URL('../src/wanderer-team-state-619.fixture.json',import.meta.url),'utf8')) as {result:SourceHostResult};
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await renderPanel(page,recorded.result,{wanderer:'流浪者',faruzan:'珐露珊',nicole:'妮可',durin:'杜林'});
 await expect(page.locator('[data-curve-total]')).toContainText('29,547,632.44（619 击）');
 for(const sum of await tableSums(page))expect(sum).toBeCloseTo(29547632.435022313,6);
 await expect(page.locator('[data-curve-table="source"] [data-group="协同投影（妮可Q）"]')).toContainText('1,081,874.84');
 await expect(page.locator('[data-curve-table="source"] [data-group="命座投影（妮可C1）"]')).toContainText('2,807,310.52');
 await expect(page.locator('[data-curve-table="source"] [data-group="unknown"]')).toHaveCount(0);
 await page.locator('[data-curve-filter="source"]').selectOption('协同投影（妮可Q）');
 await expect(page.locator('[data-curve-total]')).toContainText('1,081,874.84（23 击）');
 await page.locator('[data-curve-events] > summary').click();
 await expect(page.locator('[data-curve-event-table] tbody tr')).toHaveCount(23);
 await page.locator('[data-curve-filter="actor"]').selectOption('wanderer');
 await expect(page.locator('[data-curve-total]')).toContainText('562,584.14（11 击）');
 await expect(page.locator('[data-curve-event-table] tbody tr td:nth-child(3)')).toHaveText(Array(11).fill('流浪者'));
 await page.locator('[data-curve-filter="actor"]').selectOption('');
 await page.locator('[data-curve-filter="source"]').selectOption('');
 await page.locator('[data-curve-start]').fill('480');await page.locator('[data-curve-end]').fill('489');await page.locator('[data-curve-zoom]').click();
 await expect(page.locator('[data-event-frame="488"] td:nth-child(4)')).toContainText(['协同投影（妮可Q）','命座投影（妮可C1）']);
 await page.screenshot({path:testInfo.outputPath('wanderer-projection-sources-1280.png')});
 await page.setViewportSize({width:390,height:844});
 const layout=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,children:Array.from(document.querySelector('#curve')!.children).map(element=>({tag:element.tagName,attributes:Array.from(element.attributes).map(a=>a.name),width:element.getBoundingClientRect().width,right:element.getBoundingClientRect().right,text:element.textContent?.slice(0,80)}))}));
 expect(layout.content,JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
 await page.screenshot({path:testInfo.outputPath('wanderer-projection-sources-390.png')});
 expect(errors).toEqual([]);
});
