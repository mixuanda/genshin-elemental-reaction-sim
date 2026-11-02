import {expect,test,type TestInfo} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {captureSourceHostHit,replaySourceHostHit} from '../../../packages/sim-core/src/source-host-capture';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';

// Real C0/T1 characters, R1 level-90 weapons. Deliberately no artifact stats:
// this is an engine correctness benchmark, not a recommended account build.
const config=readFileSync(new URL('./fixtures/four-team-120-second.gcsim',import.meta.url),'utf8');
async function saveEvidence(info:TestInfo,name:string,text:string){
 const path=process.env.GIDPS_EVIDENCE_DIR ? resolve(process.env.GIDPS_EVIDENCE_DIR,name) : info.outputPath(name);
 await mkdir(dirname(path),{recursive:true});await writeFile(path,text);
}

test('real four-character native 120-second sustained loop',async({page},info)=>{
 test.setTimeout(300_000);
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');
 await page.locator('#source-host-config').fill(config);
 await page.locator('#source-host-seed').fill('12021');
 await page.locator('#source-host-run').click();
 await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败/,{timeout:120_000});
 const diagnostic=await page.locator('[data-diagnostic-json]').textContent();
 if(diagnostic) await saveEvidence(info,'diagnostic.json',diagnostic);
 expect(await page.locator('#source-host-status').textContent(),diagnostic??'').toContain('本次运行完成');
 await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});
 const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();
 const r=JSON.parse(await readFile((await(await pending).path())!,'utf8')) as SourceHostResult;
 await saveEvidence(info,'probe.capture.json',JSON.stringify(r));
 expect(r.observationWindow).toMatchObject({actualEndFrame:7200,configuredEndFrame:7200,endReason:'duration'});
 const requests=new Map(r.calculations.map(row=>[row.request.id,row.request]));
 const counts:Record<string,number>={};const failures=[];
 for(const app of r.applications){
  const q=requests.get(app.calculationId)!;counts[q.actorKey]=(counts[q.actorKey]??0)+1;
  try {expect(replaySourceHostHit(captureSourceHostHit(r,app.id)).difference).toBe(0);}catch(e){failures.push({id:app.id,actor:q.actorKey,kind:q.kind,error:String(e)});}
 }
 const summary={seed:r.seed,window:r.observationWindow,counts,consumes:r.energyApplications?.filter(e=>e.operation==='consume'),failures,totalDamage:r.applications.reduce((a,h)=>a+h.rawDamage,0),artifact:r.executionArtifact};
 await saveEvidence(info,'probe.summary.json',JSON.stringify(summary,null,2));
 console.log('FOUR_TEAM_120',JSON.stringify({...summary,consumes:summary.consumes?.length,failures:failures.length}));
 expect(failures).toEqual([]);
 expect(Object.keys(counts).sort()).toEqual(['bennett','kaeya','sucrose','xiangling']);
});


test('four-team zero/full energy and two seeded sustained runs',async({page},info)=>{
 test.setTimeout(360_000);
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');
 await page.locator('#source-host-config').fill(config);
 await page.locator('#source-startup-seeds').fill('12021,12022');
 await page.locator('#source-startup-warmup').fill('0');
 await page.locator('#source-startup-window').fill('60');
 await page.locator('#source-startup-run').click();
 await expect(page.locator('#source-host-status')).toContainText(/起步对照完成|失败/,{timeout:300_000});
 expect(await page.locator('#source-host-status').textContent(),await page.locator('[data-diagnostic-json]').textContent()??'').toContain('起步对照完成');
 const pending=page.waitForEvent('download');await page.locator('#source-startup-export').click();
 const raw=JSON.parse(await readFile((await(await pending).path())!,'utf8'));
 await saveEvidence(info,'startup.capture.json',JSON.stringify(raw));
 expect(raw.runs).toHaveLength(4);
 for(const run of raw.runs){
  expect(run.result.observationWindow.actualEndFrame).toBe(7200);
  expect(run.result.startupState.actors).toHaveLength(4);
  for(const a of run.result.startupState.actors)expect(a.energy).toBe(run.scenario==='zero'?0:a.maxEnergy);
  expect(run.result.applications.at(-1).frame).toBeGreaterThan(6900);
 }
});
