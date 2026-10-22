import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

let script:string,css:string;
test.beforeAll(async()=>{
 const built=await build({configFile:false,publicDir:false,logLevel:'silent',build:{write:false,emptyOutDir:false,lib:{entry:fileURLToPath(new URL('../src/source-team-builder.ts',import.meta.url)),name:'SourceTeamReplay',formats:['iife']}}});
 const output=Array.isArray(built)?built[0]:built;
 if(!output||!('output' in output))throw Error('Expected an in-memory component bundle');
 const chunk=output.output.find(file=>file.type==='chunk');
 if(!chunk)throw Error('Missing replay component script');
 script=chunk.code;
 css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 css+=output.output.flatMap(file=>file.type==='asset'&&file.fileName.endsWith('.css')?[String(file.source)]:[]).join('\n');
});

async function renderReplay(page:Page){
 await page.goto('/');
 await page.getByRole('heading',{name:'开始计算',exact:true}).waitFor();
 await page.evaluate(()=>document.body.innerHTML='<main id="replay"></main>');
 await page.addStyleTag({content:css});await page.addScriptTag({content:script});
 await page.evaluate(()=>{
  const global=window as any;
  global.__runCalls=0;
  global.__replay=global.SourceTeamReplay.renderSourceTeamBuilder(document.querySelector('#replay'),{onApplyScript:()=>global.__runCalls++,onRunScript:()=>global.__runCalls++});
 });
 await expect(page.locator('[data-add-character]')).toBeVisible();
 await page.evaluate(()=>{
  const global=window as any;
  const logs=[
   {event:'character',frame:0,char_index:0,logs:{char_base:{key:'kaeya'}}},
   ...Array.from({length:210},(_,frame)=>({event:'cooldown',frame,char_index:0,msg:'skill cooldown forcefully reduced',logs:{type:'skill'}})),
   {event:'hitlag',frame:300,ended:360,char_index:0,msg:'skill started',logs:{AnimationLength:90}},
   {event:'action',frame:300,char_index:0,msg:'executed skill',logs:{action:'skill'}},
   {event:'hitlag',frame:600,char_index:0,msg:'attack started',logs:{}},
   {event:'hitlag',frame:7190,ended:7200,char_index:0,msg:'burst started',logs:{}},
   {event:'hitlag',frame:25.5,ended:40,char_index:0,msg:'skill started',logs:{}}
  ];
  global.__originalLogs=JSON.stringify(logs);global.__logs=logs;
  global.__replay.renderExecutionLogs(logs,[],7200);
 });
}

async function seek(page:Page,frame:number){
 await page.locator('[data-sim-time-cursor]').fill(String(frame));
 await page.locator('[data-sim-time-cursor]').dispatchEvent('input');
}

test('replay keeps the full observation axis and highlights only recorded integer-frame animation intervals',async({page})=>{
 await renderReplay(page);
 const timeline=page.locator('[data-source-timeline]');
 await expect(timeline.locator('.source-team-builder__timeline-axis')).toContainText('7200 帧');
 await expect(timeline.locator('[data-timeline-start]')).toHaveCount(4);
 await expect(timeline.locator('[data-timeline-start="25.5"]')).toHaveCount(0);
 const animation=timeline.locator('[data-timeline-kind="animation"][data-timeline-start="300"]');
 await seek(page,299);await expect(animation).toHaveAttribute('data-playback-state','future');
 await seek(page,300);await expect(animation).toHaveAttribute('data-playback-state','active');
 await seek(page,359);await expect(animation).toHaveAttribute('data-playback-state','active');
 await seek(page,360);await expect(animation).toHaveAttribute('data-playback-state','past');
 await seek(page,601);await expect(timeline.locator('[data-timeline-start="600"]')).toHaveAttribute('data-playback-state','past');
 await seek(page,3600);await expect(timeline).toHaveAttribute('data-playback-frame','3600');
 expect(await timeline.evaluate(element=>(element as HTMLElement).style.getPropertyValue('--playback-position'))).toBe('50%');
 await seek(page,7195);await expect(timeline.locator('[data-timeline-start="7190"]')).toHaveAttribute('data-playback-state','active');
 await seek(page,7200);await expect(timeline.locator('[data-timeline-start="7190"]')).toHaveAttribute('data-playback-state','past');
});

test('all five playback rates move the same stored timeline without starting simulation or changing its events',async({page})=>{
 await renderReplay(page);
 await page.clock.install({time:0});await page.clock.pauseAt(1000);
 for(const speed of [1,2,4,8,16]){
  await page.locator('[data-playback-speed]').selectOption(String(speed));await seek(page,0);
  await page.locator('[data-playback-toggle]').click();await page.clock.runFor(1000);
  const frame=Number(await page.locator('[data-sim-time-cursor]').inputValue());
  expect(frame).toBeGreaterThanOrEqual(59*speed);expect(frame).toBeLessThanOrEqual(60*speed);
  await expect(page.locator('[data-source-timeline]')).toHaveAttribute('data-playback-frame',String(frame));
  await page.locator('[data-playback-end]').click();
  await expect(page.locator('[data-sim-time-cursor]')).toHaveValue('7200');
  await expect(page.locator('[data-playback-toggle]')).toHaveText('播放回放');
 }
 expect(await page.evaluate(()=>(window as any).__runCalls)).toBe(0);
 expect(await page.evaluate(()=>JSON.stringify((window as any).__logs)===(window as any).__originalLogs)).toBe(true);
});

test('player view keeps actions and replay visible while technical records and missing-data explanations remain expandable',async({page})=>{
 await renderReplay(page);
 await expect(page.locator('[data-runtime-details]')).not.toHaveAttribute('open');
 await expect(page.locator('[data-runtime-effects]')).toBeHidden();
 await expect(page.locator('[data-source-record-details]')).not.toHaveAttribute('open');
 await expect(page.locator('.source-team-builder__table-wrap')).toBeHidden();
 await expect(page.locator('[data-source-timeline]')).toBeVisible();
 await expect(page.locator('[data-playback-toggle]')).toBeVisible();
 await expect(page.locator('[data-source-timeline]')).toContainText('凯亚 · 动画 E 技能');
 await page.locator('[data-runtime-details] > summary').click();
 await expect(page.locator('[data-runtime-effects]')).toBeVisible();
 await expect(page.locator('[data-runtime-effects]')).toContainText('状态剩余未知');
 await page.locator('[data-source-record-details] > summary').click();
 await expect(page.locator('.source-team-builder__table-wrap')).toBeVisible();
 await expect(page.locator('[data-source-record-details]')).toContainText('没有动作实例与输入窗口回执');
 await expect(page.locator('[data-source-record-details]')).toContainText('不能直接加上起始帧来预测实际结束');
 await page.locator('[data-add-character]').selectOption('kaeya');
 await page.locator('[data-quick-action="skill"]').click();
 await expect(page.locator('[data-current-action-row]')).toHaveCount(1);
 await expect(page.locator('[data-current-action-row]')).toBeHidden();
 await expect(page.locator('.source-team-builder__action [data-runtime-action-summary]')).toBeHidden();
 await expect(page.locator('[data-run-direct]')).toBeEnabled();
 await page.locator('[data-team-section="action-check"] > summary').click();
 await expect(page.locator('[data-current-action-row]')).toBeVisible();
 await page.locator('[data-action-params-details] > summary').click();
 await expect(page.locator('.source-team-builder__action [data-runtime-action-summary]')).toBeVisible();
});

test('mobile replay keeps complete actor, action and frame labels within the available width',async({page})=>{
 await page.setViewportSize({width:390,height:844});await renderReplay(page);
 await page.locator('#replay').evaluate(root=>root.style.width='282px');
 const labels=await page.locator('[data-timeline-start] > span').evaluateAll(elements=>elements.map(element=>({text:element.textContent,clipped:element.scrollWidth>element.clientWidth})));
 expect(labels.length).toBe(4);expect(labels.every(label=>!label.clipped)).toBe(true);
 expect(labels.some(label=>label.text?.includes('7190–7200 帧'))).toBe(true);
});
