import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=process.env.GIDPS_VV_EVIDENCE_DIR??'test-results/vv-evidence';
for(const group of ['control','vv'])test(`legal four-team ${group} zero/full 120-second capture`,async({page})=>{
 test.setTimeout(300_000);await mkdir(directory,{recursive:true});
 const config=await readFile(new URL(`./fixtures/four-team-vv/${group}.gcsim`,import.meta.url),'utf8');
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');
 await page.locator('#source-host-config').fill(config);
 await page.locator('#source-startup-seeds').fill('12021,12022');
 await page.locator('#source-startup-warmup').fill('0');await page.locator('#source-startup-window').fill('60');
 await page.locator('#source-startup-run').click();
 await expect(page.locator('#source-host-status')).not.toHaveText('',{timeout:5000});
 await expect(page.locator('#source-host-status')).toContainText(/起步对照完成|失败/,{timeout:240_000});
 const diagnostic=await page.locator('[data-diagnostic-json]').textContent();
 if(diagnostic)await writeFile(resolve(directory,`${group}.diagnostic.json`),diagnostic);
 expect(await page.locator('#source-host-status').textContent(),diagnostic??'').toContain('起步对照完成');
 const pending=page.waitForEvent('download');await page.locator('#source-startup-export').click();
 const raw=JSON.parse(await readFile((await(await pending).path())!,'utf8'));
 await writeFile(resolve(directory,`${group}.capture.json`),JSON.stringify(raw));
 expect(raw.runs).toHaveLength(4);
 for(const run of raw.runs){
  expect(run.result.observationWindow.actualEndFrame).toBe(7200);
  for(const a of run.result.startupState.actors)expect(a.energy).toBe(run.scenario==='zero'?0:a.maxEnergy);
  expect(run.result.applications.at(-1).frame).toBeGreaterThan(6900);
 }
});

test('on-field Sucrose Q refreshes VV before it expires',async({page})=>{
 test.setTimeout(120_000);await mkdir(directory,{recursive:true});
 const base=await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8');
 const config=base.split('while 1 {')[0]!.replace('duration=120','duration=30')+`bennett skill;
sucrose skill;
sucrose burst;
wait(480);
bennett skill;
wait(600);
bennett skill;
wait(3600);`;
 await writeFile(resolve(directory,'refresh.gcsim'),config);
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');
 await page.locator('#source-host-config').fill(config);await page.locator('#source-host-seed').fill('12021');
 await page.locator('#source-host-run').click();
 await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败/,{timeout:90_000});
 expect(await page.locator('#source-host-status').textContent()).toContain('本次运行完成');
 await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});
 const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();
 const r=JSON.parse(await readFile((await(await pending).path())!,'utf8'));
 await writeFile(resolve(directory,'refresh.capture.json'),JSON.stringify(r));
 expect(r.observationWindow.actualEndFrame).toBe(1800);
 const procFrames=[...new Set(r.logs.filter((x:any)=>x.msg.startsWith('vv 4pc proc:')).map((x:any)=>x.frame))] as number[];
 expect(procFrames.length).toBeGreaterThan(1);
 expect(procFrames[1]!-procFrames[0]!).toBeLessThan(600);
 const skills=r.calculations.filter((c:any)=>c.request.kind==='damage'&&c.request.ability==='Passion Overload (Press)');
 expect(skills.map((c:any)=>Number(c.request.input.effectiveResistance.toFixed(3)))).toEqual([.1,-.3,.1]);
});

for(const [waitFrames,hitFrame,resistance] of [[397,1081,-.3],[398,1082,.1],[399,1083,.1]] as const)
 test(`VV actual expiry boundary at frame ${hitFrame}`,async({page})=>{
  test.setTimeout(120_000);await mkdir(directory,{recursive:true});
  const base=await readFile(new URL('./fixtures/four-team-vv/vv.gcsim',import.meta.url),'utf8');
  const config=base.split('while 1 {')[0]!.replace('duration=120','duration=30')+`bennett skill; sucrose skill; sucrose burst; wait(480); bennett skill; wait(${waitFrames}); bennett skill; wait(3600);`;
  await page.goto('/source-simulation');
  await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
  await page.locator('#source-host-variant').selectOption('classic');await page.locator('#source-host-config').fill(config);await page.locator('#source-host-seed').fill('12021');
  await page.locator('#source-host-run').click();
  await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败/,{timeout:90_000});
  expect(await page.locator('#source-host-status').textContent()).toContain('本次运行完成');
  await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});
  const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();
  const r=JSON.parse(await readFile((await(await pending).path())!,'utf8'));
  await writeFile(resolve(directory,`boundary-${hitFrame}.capture.json`),JSON.stringify(r));
  const hits=r.calculations.filter((c:any)=>c.request.kind==='damage'&&c.request.ability==='Passion Overload (Press)');
  expect(hits).toHaveLength(3);expect(hits[2].request.frame).toBe(hitFrame);
  expect(hits[2].request.input.effectiveResistance).toBeCloseTo(resistance,12);
  const expiry=r.logs.filter((x:any)=>x.frame<hitFrame&&x.event==='status'&&x.logs.key==='vvpyro').at(-1);
  expect(expiry.logs.expiry).toBe(1082);
 });
