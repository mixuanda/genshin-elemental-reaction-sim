import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { captureSourceHostHit, replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import { captureSourceHostEnergy, replaySourceHostEnergy } from '../../../packages/sim-core/src/source-host-energy-capture';
import type { SourceHostStartupRun } from '../src/source-host-startup-analysis';

// Pinned b4: E particles 2/3, E cooldown 360+25 frames; Q cost 60,
// cooldown 900+48 frames, T1 multiplier .776, recursive duration 480 frames.
// Explicit +100% ER is a controlled stat input, not a verified artifact build.
const cycle = `${Array.from({length:6},()=> 'kaeya skill;\nwait(400);').join('\n')}\nkaeya burst;\nwait(600);`;
const config = `options iteration=1 duration=120;
kaeya char lvl=90/90 cons=0 talent=1,1,1;
kaeya add weapon="dullblade" refine=1 lvl=90/90;
kaeya add stats er=1 cr=0.45;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active kaeya;
${cycle}\n${cycle}\nwait(7200);`;

test('Kaeya funds two native Q casts with E particles across 120 seconds from zero and full energy', async ({page}, info) => {
  test.setTimeout(240_000);
  await page.goto('/source-simulation');
  await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
  await page.locator('#source-host-config').fill(config);
  await page.locator('#source-startup-seeds').fill('12021,12022');
  await page.locator('#source-startup-warmup').fill('0');
  await page.locator('#source-startup-window').fill('60');
  await page.locator('#source-startup-run').click();
  await expect(page.locator('#source-host-status')).toContainText('起步对照完成', {timeout:180_000});
  const pending=page.waitForEvent('download');
  await page.locator('#source-startup-export').click();
  const raw=JSON.parse(await readFile((await (await pending).path())!,'utf8')) as {runs:SourceHostStartupRun[]};
  await writeFile(info.outputPath('kaeya-energy-cycle.capture.json'),JSON.stringify(raw));
  expect(raw.runs).toHaveLength(4);
  const summaries=[];
  for(const run of raw.runs){
    const r=run.result;
    expect(r.observationWindow).toMatchObject({actualEndFrame:7200,configuredEndFrame:7200,endReason:'duration'});
    expect(r.startupState!.actors[0]!.energy).toBe(run.scenario==='zero'?0:60);
    const energy=r.energyApplications!;
    const consume=energy.filter(e=>e.operation==='consume');
    expect(consume).toHaveLength(2);
    let balance=run.scenario==='zero'?0:60;
    for(const e of energy){
      expect(e.energyBefore).toBeCloseTo(balance,10);
      expect(e.energyAfter).toBeGreaterThanOrEqual(0);
      expect(e.energyAfter).toBeLessThanOrEqual(60);
      if(e.operation==='consume'){
        expect(e.energyBefore).toBe(60);
        expect(e.energyAfter).toBe(0);
      }
      expect(replaySourceHostEnergy(captureSourceHostEnergy(r,e.id)).difference).toBe(0);
      balance=e.energyAfter;
    }
    expect(consume[1]!.frame-consume[0]!.frame).toBeGreaterThanOrEqual(948);
    const records=new Map(r.calculations.map(row=>[row.request.id,row.request]));
    let skillHits=0,burstHits=0;
    for(const hit of r.applications){
      const request=records.get(hit.calculationId)!;
      if(request.kind!=='damage')throw Error('Expected direct Cryo damage');
      const scaling=request.input.scaling;
      expect([1.912,.776]).toContain(scaling);
      if(scaling===1.912)skillHits++;else burstHits++;
      expect(request.input.amped).toBe(false);
      const manual=request.input.scalingValue*scaling*.5*.9*(request.input.isCrit?1+request.input.critDamage:1);
      expect(hit.rawDamage).toBeCloseTo(manual,8);
      expect(replaySourceHostHit(captureSourceHostHit(r,hit.id)).difference).toBe(0);
    }
    expect(skillHits).toBe(12);
    expect(burstHits).toBe(26); // 13 per native fixed-source C0 lifetime, not a game-wide guarantee.
    summaries.push({seed:r.seed,scenario:run.scenario,skillHits,burstHits,consumeFrames:consume.map(e=>e.frame),energyEvents:energy.length,totalDamage:r.applications.reduce((a,h)=>a+h.rawDamage,0),finalEnergy:balance});
  }
  await writeFile(info.outputPath('kaeya-energy-cycle.summary.json'),JSON.stringify(summaries,null,2));
  console.log('KAEYA_ENERGY_CYCLE',JSON.stringify(summaries));
});
