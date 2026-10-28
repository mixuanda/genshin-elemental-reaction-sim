import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { captureSourceHostHit, replaySourceHostHit } from '../../../packages/sim-core/src/source-host-capture';
import { captureSourceHostEnergy, replaySourceHostEnergy } from '../../../packages/sim-core/src/source-host-energy-capture';
import type { SourceHostStartupRun } from '../src/source-host-startup-analysis';

// Pinned b4 E: HP .12864 + independent ATK .208 thorn, 4 Hydro particles,
// cooldown 720+20 frames. Q costs 70, cooldown 1080, three HP hits.
// Explicit +100% ER is a controlled input, not an artifact-build claim.
const cycle = `${Array.from({length:4},()=> 'neuvillette skill;\nwait(750);').join('\n')}\nneuvillette burst;\nwait(180);`;
const config = `options iteration=1 duration=120;
neuvillette char lvl=90/90 cons=0 talent=1,1,1;
neuvillette add weapon="pocketgrimoire" refine=1 lvl=70/70;
neuvillette add stats er=1 cr=0.45;
target lvl=90 resist=0.1 radius=2 pos=0,2.4;
active neuvillette;
${cycle}\n${cycle}\nwait(7200);`;

test('Neuvillette funds two native Q casts with E particles across 120 seconds from zero and full energy', async ({page}, info) => {
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
  await writeFile(info.outputPath('neuvillette-energy-cycle.capture.json'),JSON.stringify(raw));
  expect(raw.runs).toHaveLength(4);
  const summaries=[];
  for(const run of raw.runs){
    const r=run.result;
    expect(r.observationWindow).toMatchObject({actualEndFrame:7200,configuredEndFrame:7200,endReason:'duration'});
    expect(r.startupState!.actors[0]!.energy).toBe(run.scenario==='zero'?0:70);
    const energy=r.energyApplications!;
    const consume=energy.filter(e=>e.operation==='consume');
    expect(consume).toHaveLength(2);
    let balance=run.scenario==='zero'?0:70;
    for(const e of energy){
      expect(e.energyBefore).toBeCloseTo(balance,10);
      expect(e.energyAfter).toBeGreaterThanOrEqual(0);
      expect(e.energyAfter).toBeLessThanOrEqual(70);
      if(e.operation==='consume'){
        expect(e.energyBefore).toBe(70);
        expect(e.energyAfter).toBe(0);
      }
      expect(replaySourceHostEnergy(captureSourceHostEnergy(r,e.id)).difference).toBe(0);
      balance=e.energyAfter;
    }
    expect(consume[1]!.frame-consume[0]!.frame).toBeGreaterThanOrEqual(1080);
    const records=new Map(r.calculations.map(row=>[row.request.id,row.request]));
    let skillHits=0,burstHits=0;
    for(const hit of r.applications){
      const request=records.get(hit.calculationId)!;
      if(request.kind!=='damage')throw Error('Expected direct Hydro damage');
      const input=request.input;
      expect(input.amped).toBe(false);
      expect(input.damageBonus).toBeCloseTo(.3,8);
      if(input.scaling===.208)skillHits++;
      else { expect(input.scaling).toBe(0); burstHits++; }
      const manual=(input.scalingValue*input.scaling+input.flatDamage)*.5*.9*1.3*(input.isCrit?1+input.critDamage:1);
      expect(hit.rawDamage).toBeCloseTo(manual,8);
      expect(replaySourceHostHit(captureSourceHostHit(r,hit.id)).difference).toBe(0);
    }
    expect(skillHits).toBe(8);
    expect(burstHits).toBe(14); // 8 E HP contacts + 2 initial Q + 4 Q waterfalls.
    summaries.push({seed:r.seed,scenario:run.scenario,skillHits,burstHits,consumeFrames:consume.map(e=>e.frame),energyEvents:energy.length,totalDamage:r.applications.reduce((a,h)=>a+h.rawDamage,0),finalEnergy:balance});
  }
  await writeFile(info.outputPath('neuvillette-energy-cycle.summary.json'),JSON.stringify(summaries,null,2));
  console.log('NEUVILLETTE_ENERGY_CYCLE',JSON.stringify(summaries));
});
