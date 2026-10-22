import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { beforeAll, expect, it } from 'vitest';
import { createSourceHostFormulaResolver } from '../../sim-core/src/source-host-formula';
import { createSourceHostResult } from '../../sim-core/src/source-host-capture';
const evidence=process.env.GIDPS_EVIDENCE_DIR;
const publicPath=process.env.GIDPS_HOST_PUBLIC??new URL('../../../apps/web/public/source-host',import.meta.url).pathname;
const label=process.env.GIDPS_ATHAME_LABEL??'before';
beforeAll(async()=>{runInThisContext(readFileSync(resolve(publicPath,'wasm_exec.js'),'utf8')); const go=new (globalThis as any).Go(); const instance=await WebAssembly.instantiate(readFileSync(resolve(publicPath,'source-host.wasm')),go.importObject);void go.run(instance.instance);});
function run(name:string,{hex=true,targets=1,burst=true,refinement=1}={}){
 const config=`options iteration=1 duration=8;\ndurin char lvl=90/90 cons=0 talent=10,10,10;\ndurin add weapon="athameartis" refine=${refinement} lvl=90/90;\ndurin add stats atk%=0.1 cr=1;\n${hex?'nicole char lvl=90/90 cons=0 talent=10,10,10;\nnicole add weapon="magicguide" refine=1 lvl=90/90;\n':''}${Array.from({length:targets},()=> 'target lvl=100 resist=0.1 radius=2 pos=0,2.4;').join('\n')}\nactive durin;\ndurin ${burst?'burst':'skill;\ndurin skill'};\nwait(480);`;
 const resolver=createSourceHostFormulaResolver();const raw=JSON.parse((globalThis as any).gidpsSourceHostRun(JSON.stringify({protocol:'gidps-source-host-v1',config,seed:'20261022',initialEnergy:{mode:'full'},executionMode:'auto-wait',stopAtDuration:true}),resolver.resolve));
 if(evidence)writeFileSync(resolve(evidence,`${label}-${name}.native.json`),JSON.stringify(raw)); expect(raw.error).toBeUndefined();const r=createSourceHostResult(raw,resolver.calculations);if(evidence)writeFileSync(resolve(evidence,`${label}-${name}.result.json`),JSON.stringify(r));
 return {r,damage:r.calculations.filter(x=>x.request.kind==='damage'&&x.request.actorKey==='durin')};
}
it('R1 Hexerei Q includes exactly .35 ATK on first and subsequent hits, for both same-frame targets',()=>{
 const {r,damage}=run('hex-two-target',{targets:2});expect(r.applications.length).toBeGreaterThan(6);expect(damage.filter(x=>x.request.frame===damage[0]!.request.frame)).toHaveLength(2);
 for(const row of damage){expect(row.request.snapshot!.atkPct).toBeCloseTo(.1+.35,12);}
});
it('R1 with one Hexerei actor gets .20, no .75 multiplier and no pyro resonance',()=>{const {damage}=run('solo',{hex:false});for(const row of damage)expect(row.request.snapshot!.atkPct).toBeCloseTo(.1+.20,12);});
it('R5 has .40 times1.75 rather than reusing R1',()=>{const {damage}=run('r5',{refinement:5});for(const row of damage)expect(row.request.snapshot!.atkPct).toBeCloseTo(.1+.7,12);});
it('E alone cannot create the Q-triggered ATK buff',()=>{const {r,damage}=run('skill-only',{burst:false});expect(damage.length).toBeGreaterThan(0);expect(r.logs.some((l:any)=>l.logs?.key==='blade-of-the-daylight-hours-buff')).toBe(false);for(const row of damage)expect(row.request.snapshot!.atkPct).toBeCloseTo(.1,12);});
