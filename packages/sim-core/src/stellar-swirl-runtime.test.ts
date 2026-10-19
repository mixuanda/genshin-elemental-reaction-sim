import {describe,expect,it} from "vitest";
import type {ResolvedEnemyTargetProfile} from "@genshin-dps-lab/schemas";
import {AuraEngine} from "./aura";
import {makeConfig,neutralStats} from "./__tests__/fixtures";
import {calculateStellarSwirlIntent} from "./stellar-swirl-calculation";
import {StellarSwirlRuntime,stellarSwirlEventToCalculatorDocument,type StellarSwirlRuntimeOptions} from "./stellar-swirl-runtime";
import type {SpecialDamageIntent} from "./special-reaction-state";
import {calculateSpecialCalculatorHit} from "./special-calculator";
import {calculateDocument,parseCalculatorDocument,serializeCalculatorDocument} from "./calculator";
import {simulate} from "./simulator";

const target:ResolvedEnemyTargetProfile={id:"target",name:"Target",level:90,resistance:.1,defReduction:0,freezeResistance:0,initialAura:[],position:null,hitboxRadius:1};
const options:StellarSwirlRuntimeOptions={profileId:"stellar-swirl-guide-reference-v1",party:[{actorId:"a",characterKey:"sandrone"},{actorId:"c",characterKey:"kaeya"}]};
const proof={ordinaryReactionReplacementApplied:true,deliveryOperationsApplied:true} as const;
const intent:SpecialDamageIntent={id:1,branch:"stellar-swirl-anemo-reaction",snapshotFrame:10,deliveryFrame:13,targetId:"target",ownerId:"a",contributorIds:["a","c"],contributorPolicy:"trigger-aura",sourceEventId:"host-replacement-10",sourceRefs:["test:host-contract"],evidence:"guide-profile-source-conflict",element:"anemo",onDelivery:[],blockedMechanics:[]};
const snapshots=[{actorId:"a",level:90,elementalMastery:0,critRate:.5,critDamage:1},{actorId:"c",level:80,elementalMastery:0,critRate:0,critDamage:0}];

function harness() {
  const base=makeConfig(),config=makeConfig({duration:4,cycleLength:4,reactionEngine:{mode:"aura-v3"},characters:[{...base.characters[0]!,id:"a",element:"anemo"},{...base.characters[0]!,id:"c",element:"cryo"}],rotation:[],timeline:{mode:"legal-frame-v1",fps:60,legalityMode:"strict",initialActiveCharacterId:"a",swapFrames:1,abilities:[],commands:[]}});
  const aura=new AuraEngine({mode:"aura-v3"});
  aura.processHit({frame:0,sourceActorId:"c",element:"cryo",application:{gaugeUnits:1,icd:{mode:"no-icd-v1"}}});
  let deliveries=0;
  const run=new StellarSwirlRuntime({config,options,target,critMode:"average",snapshot:(_actor,frame)=>({...neutralStats,em:frame===10?0:600}),resistance:(element,frame)=>element==="anemo"&&frame>=13?.2:-.2,auraAt:frame=>aura.getAuraStateAt(frame),beforeWake:()=>{},applyCryo:delivered=>{
    deliveries++;
    const audit=aura.processHit({frame:delivered.deliveryFrame,sourceActorId:delivered.ownerId,element:"cryo",application:{gaugeUnits:1,icd:{mode:"no-icd-v1"}}});
    return {frame:delivered.deliveryFrame,ownerId:delivered.ownerId,targetId:delivered.targetId,applied:true,element:"cryo",gaugeUnits:1,auraBefore:audit.auraBefore??[],auraAfter:audit.auraAfter??[]};
  }});
  const application=(frame:number)=>{
    // The host drains pending special deliveries before reading the next main-event aura.
    run.advanceThrough(frame);
    return {frame,sourceActorId:"a",sourceEventId:`host-replacement-${frame}`,attackId:`attack-${frame}`,targetId:"target",element:"anemo" as const,gaugeUnits:1,actualIcdAllowed:true,auraBefore:aura.getAuraStateAt(frame),converted:true,ordinaryReactionReplacementApplied:true};
  };
  return {run,config,application,deliveries:()=>deliveries};
}

describe("Stellar Swirl adapter contract (main-engine replacement is separately required)",()=>{
  it("executes the three guide coefficients with independent contributor critical expectation and replay",()=>{
    for(const [branch,coefficient] of [["stellar-swirl-anemo-reaction",.75],["stellar-swirl-vortex-1",2],["stellar-swirl-vortex-2",3]] as const){
      const initial=branch==="stellar-swirl-anemo-reaction";
      const current={...intent,branch,deliveryFrame:initial?13:10,element:initial?"anemo" as const:"cryo" as const};
      const result=calculateStellarSwirlIntent(current,snapshots,.1,"average",proof);
      expect(result.damage).toBeCloseTo((1446.8535*1.5*.6+1077.4437*.3)*coefficient*.9,9);
      expect(calculateSpecialCalculatorHit(JSON.parse(JSON.stringify(result.context))).expected).toBe(result.damage);
      expect(result.context.context.assumptions.join()).toContain("guide-profile-source-conflict");
    }
  });
  it("requires completed host operations and rejects source-conflict erasure or incomplete owners",()=>{
    expect(()=>calculateStellarSwirlIntent(intent,snapshots,.1,"average",{...proof,deliveryOperationsApplied:false} as never)).toThrow(/completed delivery/);
    expect(()=>calculateStellarSwirlIntent({...intent,evidence:"fixed-source-provisional"},snapshots,.1,"average",proof)).toThrow(/conflict/);
    expect(()=>calculateStellarSwirlIntent(intent,snapshots.slice(0,1),.1,"average",proof)).toThrow(/exactly/);
  });
  it("snapshots before delayed Anemo delivery, upgrades on three triggers and executes one owned Cryo delivery at six",()=>{
    const {run,config,application,deliveries}=harness();
    run.application(application(10));run.advanceThrough(13);
    expect(run.damageEvents[0]!.context.contributors.every(contributor=>contributor.elementalMastery===0)).toBe(true);
    expect(run.damageEvents[0]!.damage).toBeCloseTo(1446.8535*.75*(.6+.3)*.8,9);
    for(const frame of [20,30,40,50,60])run.application(application(frame));
    const explosion=run.damageEvents.find(event=>event.intent.branch==="stellar-swirl-vortex-2")!;
    expect(explosion.frame).toBe(60);expect(deliveries()).toBe(1);
    expect(explosion.cryoDelivery).toMatchObject({frame:60,ownerId:"a",applied:true,element:"cryo",gaugeUnits:1});
    expect(explosion.auraAfter.some(entry=>entry.element==="cryo"&&entry.sourceSlots?.some(slot=>slot.sourceActorId==="a"&&slot.gaugeUnits>0))).toBe(true);
    expect(run.highJump).toEqual({available:true,expiresAt:360,consumptionImplemented:true,airborne:null});
    const result=run.result(simulate(config));
    const doc=parseCalculatorDocument(serializeCalculatorDocument(stellarSwirlEventToCalculatorDocument(result,explosion.id)));
    expect(calculateDocument(doc).totals?.expected).toBe(explosion.damage);
    expect(result.totalDamage).toBe(result.classicDamage+result.stellarSwirlDamage);
  });
  it("blocks missing ordinary replacement and unresolved Frozen overlap before creating damage",()=>{
    const missing=harness();expect(()=>missing.run.application({...missing.application(10),ordinaryReactionReplacementApplied:false})).toThrow(/尚未.*替换/);
    expect(missing.run.damageEvents).toEqual([]);
    const frozen=harness();expect(()=>frozen.run.application({...frozen.application(10),auraBefore:[{element:"frozen",gaugeUnits:.5,expiresAtFrame:100}]})).toThrow(/冻结贡献者/);
    expect(frozen.run.damageEvents).toEqual([]);
  });
});
