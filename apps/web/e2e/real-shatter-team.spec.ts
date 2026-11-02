import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import builds from './fixtures/real-shatter/builds.json';
import {resolveArtifactBuild} from '../../../packages/game-data/src/artifact-build';
import {resolveEquipmentBuild,type EquipmentBuildInput} from '../../../packages/game-data/src/equipment-build';
import {captureSourceHostHit,replaySourceHostHit} from '../../../packages/sim-core/src/source-host-capture';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
type NativeLog={frame:number;event:string;msg:string;logs:Record<string,unknown>};
function nativeLogs(r:SourceHostResult):NativeLog[]{if(!Array.isArray(r.logs))throw Error('Missing native logs');return r.logs as NativeLog[];}
const directory=process.env.GIDPS_SHATTER_EVIDENCE??'test-results/real-shatter';
const weaponKeys={kaeya:'skyridersword',barbara:'otherworldlystory',noelle:'whiteirongreatsword'};
const statKeys:Record<string,string>={FIGHT_PROP_HP:'hp',FIGHT_PROP_ATTACK:'atk',FIGHT_PROP_ELEMENT_MASTERY:'em',FIGHT_PROP_PHYSICAL_ADD_HURT:'phys%',FIGHT_PROP_ATTACK_PERCENT:'atk%',FIGHT_PROP_CRITICAL:'cr',FIGHT_PROP_CRITICAL_HURT:'cd',FIGHT_PROP_CHARGE_EFFICIENCY:'er'};
function inputConfig(delay: "none" | "before-swap" | "after-swap"="none"){
 let text='options iteration=1 duration=20;\n';
 for(const key of Object.keys(builds) as (keyof typeof builds)[]){
  const input=builds[key] as EquipmentBuildInput;resolveEquipmentBuild(input);
  const artifact=resolveArtifactBuild(input.artifacts!);const stats:Record<string,number>={};
  for(const term of artifact.statContributions){const name=statKeys[term.property];if(!name)throw Error(term.property);stats[name]=(stats[name]??0)+term.value;}
  text+=`${key} char lvl=90/90 cons=0 talent=1,1,1;\n${key} add weapon="${weaponKeys[key]}" refine=1 lvl=90/90;\n${key} add stats ${Object.entries(stats).map(([k,v])=>`${k}=${v}`).join(' ')};\n`;
  text+=`// Five legal +0 pieces from five distinct sets: no set bonus.\n`;
 }
 text+='target lvl=90 resist=0.1 radius=2 pos=0,2.4;\nactive kaeya;\n';
 for(let i=0;i<2;i++)text+=`kaeya skill; barbara attack;${delay==='before-swap'?' wait(1);':''} noelle swap;${delay==='after-swap'?' wait(1);':''} noelle attack; wait(360);\n`;
 return text+'wait(3600);\n';
}
for(const variant of ['baseline','one-frame-before-swap','one-frame-after-swap','cooldown'] as const)test(`real ${variant}: Kaeya Barbara Noelle freeze-to-Shatter native capture`,async({page})=>{
 test.setTimeout(120000);await mkdir(directory,{recursive:true});
 await page.goto('/source-simulation');
 await page.locator('#source-host-config').evaluate(el=>{let p=el.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details')??null;}});
 await page.locator('#source-host-variant').selectOption('classic');
 let config=inputConfig(variant==='one-frame-before-swap'?'before-swap':variant==='one-frame-after-swap'?'after-swap':'none');
 if(variant==='cooldown')config=config.split('kaeya skill;')[0]+`kaeya skill; wait(385-f()); print("CD_BEFORE=",.kaeya.skill.ready); wait(1); print("CD_AT=",.kaeya.skill.ready); if .kaeya.skill.ready {kaeya skill;} wait(3600);`;
 await writeFile(`${directory}/${variant}.gcsim`,config);
 await page.locator('#source-host-config').fill(config);await page.locator('#source-host-seed').fill('12021');await page.locator('#source-host-run').click();
 await expect(page.locator('#source-host-status')).toContainText(/本次运行完成|失败/,{timeout:90000});
 expect(await page.locator('#source-host-status').textContent(),await page.locator('[data-diagnostic-json]').textContent()??'').toContain('本次运行完成');
 await page.locator('#source-host-export').evaluate(el=>{el.closest('details')!.open=true;});
 const pending=page.waitForEvent('download');await page.locator('#source-host-export').click();
 const r=JSON.parse(await readFile((await(await pending).path())!,'utf8')) as SourceHostResult;
 await writeFile(`${directory}/${variant}.capture.json`,JSON.stringify(r));
 expect(r.observationWindow?.actualEndFrame).toBe(1200);
 if(variant==='cooldown'){
  const markers=nativeLogs(r).filter(log=>log.msg.startsWith('CD_')).map(log=>({frame:log.frame,msg:log.msg}));
  await writeFile(`${directory}/cooldown-markers.json`,JSON.stringify(markers,null,2));
  expect(markers).toEqual([{frame:385,msg:'CD_BEFORE=0'},{frame:386,msg:'CD_AT=1'}]);
  const es=r.abilityInvocations!.filter(a=>a.characterKey==='kaeya'&&a.action==='skill');
  expect(es.map(a=>a.startedFrame)).toEqual([1,386]);
  const qs=new Map(r.calculations.map(c=>[c.request.id,c.request]));
  expect(r.applications.filter(a=>qs.get(a.calculationId)?.ability==='Frostgnaw').map(a=>a.frame)).toEqual([29,414]);
 }else{
  const summary=verify(r,variant==='one-frame-after-swap'?[140,651]:[139,649]);
  await writeFile(`${directory}/${variant}.summary.json`,JSON.stringify(summary,null,2));
 }

});

function verify(r:SourceHostResult,frames:number[]){
 const requests=new Map(r.calculations.map(c=>[c.request.id,c.request]));
 const shatters=r.applications.filter(a=>requests.get(a.calculationId)?.ability==='shatter');
 expect(shatters.map(a=>a.frame)).toEqual(frames);
 const expectedShatter=1446.8535*3*(1+16*28/(28+2000))*0.9;
 const rows=[];const contribution:Record<string,number>={};let maxError=0;
 for(const app of r.applications){
  const q=requests.get(app.calculationId)!;expect(q.kind).toBe('damage');if(q.kind!=='damage')throw Error('not damage');
  expect(Number.isInteger(app.frame)).toBe(true);
  let expected=0;
  if(q.ability==='shatter'){
   expect(q.actorKey).toBe('noelle');expect(q.actorIndex).toBe(2);expect(q.input.elementalMastery).toBe(28);expect(q.input.effectiveResistance).toBe(0.1);
   expect(q.input.defenseIgnore).toBe(1);expect(app.isCrit).toBe(false);
   expected=expectedShatter;
   const parent=r.applications.find(a=>a.attackId===q.origin?.parentAttackId&&a.targetKey===app.targetKey)!;
   expect(parent).toBeDefined();expect(parent.frame).toBe(app.frame);expect(parent.id).toBeGreaterThan(app.id);
   const parentRequest=requests.get(parent.calculationId)!;expect(parentRequest.actorKey).toBe('noelle');expect(parentRequest.ability).toBe('Normal 0');
   const action=r.abilityInvocations!.find(a=>a.actionSequence===q.origin?.creationActionSequence)!;
   expect(action.characterKey).toBe('noelle');expect(app.frame-action.startedFrame).toBe(27);
  }else if(q.ability==='Freeze Broken'){
   expect(app.rawDamage).toBe(0); // Preserve the internal sentinel; never treat it as a second Shatter.
  }else{
   const mult=q.actorKey==='kaeya'?1.912:q.actorKey==='barbara'?0.3784:0.7912;
   expect(q.input.scaling).toBe(mult);expect(q.input.damageBonus).toBe(q.actorKey==='noelle'?0.087:0);expect(q.input.flatDamage).toBe(0);expect(q.input.baseDamageBonus).toBe(0);expect(q.input.amped).toBe(false);
   const attack=q.snapshot.baseAtk*(1+q.snapshot.atkPct)+q.snapshot.flatAtk;
   expect(q.input.scalingValue).toBeCloseTo(attack,10);
   expect(q.input.defenseAdjustment).toBe(0);expect(q.input.defenseIgnore).toBe(0);expect(q.input.characterLevel).toBe(90);expect(q.input.enemyLevel).toBe(90);
   expected=attack*mult*(1+q.input.damageBonus)*0.5*0.9*(app.isCrit?1+q.snapshot.critDamage:1);
  }
  const error=app.rawDamage-expected;maxError=Math.max(maxError,Math.abs(error));expect(app.rawDamage).toBeCloseTo(expected,8);
  expect(replaySourceHostHit(captureSourceHostHit(r,app.id)).difference).toBe(0);
  contribution[q.actorKey]=(contribution[q.actorKey]??0)+expected;
  rows.push({id:app.id,frame:app.frame,actor:q.actorKey,ability:q.ability,parentAttackId:q.origin?.parentAttackId??null,expected,actual:app.rawDamage,error});
 }
 expect(new Set(r.applications.map(a=>a.id)).size).toBe(r.applications.length);
 expect(new Set(r.applications.map(a=>`${a.attackId}:${a.targetKey}`)).size).toBe(r.applications.length);
 for(const frame of frames){
  const freeze=nativeLogs(r).filter(log=>log.frame<frame&&log.event==='element'&&JSON.stringify(log.logs).includes('frozen:')).at(-1);
  expect(freeze).toBeDefined();expect(freeze!.logs).toHaveProperty('applied_ele','hydro');
 }
 const total=r.applications.reduce((sum,a)=>sum+a.rawDamage,0);
 const native=r.result as {total_damage:number;dps:number};expect(native.total_damage).toBeCloseTo(total,8);
 expect(Object.values(contribution).reduce((a,b)=>a+b,0)).toBeCloseTo(total,8);
 expect(r.abilityInvocations!.every(a=>a.success)).toBe(true);
 const es=r.abilityInvocations!.filter(a=>a.characterKey==='kaeya'&&a.action==='skill');expect(es).toHaveLength(2);expect(es[1]!.startedFrame-es[0]!.startedFrame).toBeGreaterThanOrEqual(385);
 return {scope:'real C0/T1 characters; legal +0 test builds; Classic only; 20-second two-cycle acceptance, not a sustained 120-second run',seed:r.seed,frames,expectedShatter,total,contribution,maxError,rows,artifact:r.executionArtifact};
}
