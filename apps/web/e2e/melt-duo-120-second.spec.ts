import {expect,test} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {captureSourceHostHit,replaySourceHostHit} from '../../../packages/sim-core/src/source-host-capture';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';

// Two real C0/T1 actors, no Q buff, artifact proc, manual aura or injected energy.
const config=`options iteration=1 duration=120;
bennett char lvl=90/90 cons=0 talent=1,1,1;
bennett add weapon="dullblade" refine=1 lvl=90/90;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=90/90;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active bennett;
${Array.from({length:10},()=> 'bennett skill;\nkaeya skill;\nwait(540);').join('\n')}
wait(7200);`;

test('native Bennett and Kaeya produce real reverse Melt contacts over 120 seconds',async({page},info)=>{
 test.setTimeout(120_000);
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-config').fill(config);
 await page.locator('#source-host-seed').fill('12023');
 await page.locator('#source-host-run').click();
 await expect(page.locator('#source-host-status')).toContainText('本次运行完成',{timeout:90_000});
 await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});
 const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();
 const r=JSON.parse(await readFile((await(await pending).path())!,'utf8')) as SourceHostResult;
 await writeFile(info.outputPath('melt-duo.capture.json'),JSON.stringify(r));
 expect(r.observationWindow).toMatchObject({actualEndFrame:7200,configuredEndFrame:7200,endReason:'duration'});
 expect(r.verification).toBe('provisional');
 const requests=new Map(r.calculations.map(row=>[row.request.id,row.request]));
 const counts={bennett:0,kaeya:0,melt:0};
 for(const app of r.applications){
  const q=requests.get(app.calculationId)!;if(q.kind!=='damage')throw Error('Expected direct skill damage');
  expect(['bennett','kaeya']).toContain(q.actorKey);
  const cryo=q.actorKey==='kaeya';counts[cryo?'kaeya':'bennett']++;
  expect(q.input.scaling).toBe(cryo?1.912:1.376);
  expect(q.input.amped).toBe(cryo);
  if(cryo){counts.melt++;expect(q.input.amplifyingMultiplier).toBe(1.5);}
  expect(q.input.damageBonus).toBe(0);
  const multiplier=cryo?1.5*(1+2.78*q.input.elementalMastery/(1400+q.input.elementalMastery)+q.input.reactionBonus):1;
  const manual=q.input.scalingValue*q.input.scaling*.5*.9*multiplier*(q.input.isCrit?1+q.input.critDamage:1);
  expect(app.rawDamage).toBeCloseTo(manual,8);
  expect(replaySourceHostHit(captureSourceHostHit(r,app.id)).difference).toBe(0);
 }
 expect(counts).toEqual({bennett:10,kaeya:10,melt:10});
 await page.locator('#source-host-hit-index').fill('19');
 await page.locator('#source-host-open-calculator').click();
 await expect(page.locator('#calc-source-host-editor [data-source-base-panel]')).toBeVisible();
 const summary={seed:r.seed,window:r.observationWindow,counts,totalDamage:r.applications.reduce((sum,h)=>sum+h.rawDamage,0),artifact:r.executionArtifact,scope:'C0 T1 E-only reverse-Melt duo; no Q buffs or sustained full-team energy rotation'};
 await writeFile(info.outputPath('melt-duo.summary.json'),JSON.stringify(summary,null,2));
 console.log('MELT_DUO_120',JSON.stringify(summary));
});
