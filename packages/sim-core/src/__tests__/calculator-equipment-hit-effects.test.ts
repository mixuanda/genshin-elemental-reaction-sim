import {describe,expect,it} from "vitest";
import {calculateDocument,convertCalculatorToFinalPanel,parseCalculatorDocument,restoreCalculatorHitEquipmentInputs,serializeCalculatorDocument,type CalculatorHit} from "../calculator";
import {expr} from "../calculation-trace";
import {loadWorkedExample} from "../worked-examples";

describe("ordinary equipment base additions and hit-specific critical stats",()=>{
  it("executes applicable final hit stats, clamps combined CR, and preserves sourced per-hit final contexts without duplicate additions",()=>{
    const doc=loadWorkedExample("fixture-a"),normal=doc.hits[0]!;if(doc.build.mode!=="equipment-derived"||normal.kind!=="ordinary")throw Error();
    doc.build.em=100;doc.build.critRate=.9;doc.build.critDamage=1;
    const rule=(id:string,expression:ReturnType<typeof expr.value>,attackTags:Array<"normal"|"charged"|"skill"|"burst">)=>({id,label:`合成协议 ${id}`,expression,inputs:[],sourceRefs:[`synthetic:${id}`],attackTags,inputPolicy:"final-panel" as const});
    doc.build.equipment={characterId:"synthetic",weaponId:"synthetic",level:90,ascension:6,weaponLevel:90,weaponAscension:6,refinement:1,sourceVersion:"synthetic-hit-effects",sourceRefs:["synthetic:hit-effects"],derivedStats:[],secondaryContributions:[],assumptions:[],effectBlockers:[],weaponType:"catalyst",bonusAccounting:"core-sourced-v1",additiveBaseBonuses:[
      rule("def-add",expr.mul(expr.input("def"),expr.value(.4)),["normal","charged"]),
      rule("hp-add",expr.mul(expr.input("hp"),expr.value(.01)),["normal"]),
      rule("em-add",expr.mul(expr.input("em"),expr.value(1.2)),["normal","skill"]),
      {...rule("wrong-weapon",expr.value(999),["normal"]),weaponTypes:["bow"]}
    ],criticalBonuses:[{...rule("normal-cr",expr.value(.2),["normal"]),target:"critRate"},{...rule("burst-cr",expr.value(.12),["burst"]),target:"critRate"},{...rule("skill-cd",expr.value(.4),["skill"]),target:"critDamage"}]};
    normal.element="pyro";normal.attackTag="normal";normal.reaction="reverseVaporize";normal.damageBonus=0;normal.additiveBaseDamage=37;
    normal.elementalMasteryAdjustment={accounting:"add-to-panel",formula:{ruleId:"synthetic-em",label:"本段显式额外精通",expression:expr.value(200),inputs:[],sourceRefs:["synthetic:em"]}};
    const skill={...structuredClone(normal),id:"skill",attackTag:"skill" as const,reaction:"none" as const},burst={...structuredClone(normal),id:"burst",attackTag:"burst" as const,reaction:"none" as const};
    doc.hits.push(skill,burst);doc.selectedHitIds.push(skill.id,burst.id);doc.scope="one-cast";
    const calculated=calculateDocument(doc),amp=1.5*(1+2.78*300/(1400+300));
    expect(calculated.status).toBe("calculated");
    expect(calculated.hits[0]!.nonCritical).toBeCloseTo((4000+37+280+100+360)*.5*.9*amp,8);
    expect(calculated.hits[0]!.expected).toBeCloseTo((4000+37+280+100+360)*.5*.9*2*amp,8);
    expect(calculated.hits[1]!.expected).toBeCloseTo((4000+37+360)*.5*.9*(1+.9*1.4),8);
    expect(calculated.hits[2]!.expected).toBeCloseTo((4000+37)*.5*.9*2,8);
    expect(calculated.hits[0]!.trace.find(node=>node.id==="applicableCritRate")?.result?.value).toBe(1.1);
    expect(calculated.hits[0]!.trace.find(node=>node.id==="critRate")?.result?.value).toBe(1);
    const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(calculateDocument(final).totals).toEqual(calculated.totals);
    for(const hit of final.hits){if(hit.kind!=="ordinary")throw Error();expect(restoreCalculatorHitEquipmentInputs(hit).additiveBaseDamage).toBe(37);expect(hit.finalizedEquipmentEffects?.every(effect=>effect.sourceRefs[0]?.startsWith("synthetic:"))).toBe(true);}
    expect(calculateDocument(final).hits[0]!.trace.find(node=>node.id==="finalizedEquipmentEffect.2")).toMatchObject({status:"not-applicable",result:{value:360},sourceRefs:["synthetic:em-add"]});
    const finalNormal=final.hits[0]!;if(finalNormal.kind!=="ordinary")throw Error();
    finalNormal.additiveBaseDamage+=11;
    expect(restoreCalculatorHitEquipmentInputs(finalNormal).additiveBaseDamage).toBe(48);
    finalNormal.finalizedEquipmentEffects![0]!.amount+=1;
    expect(()=>parseCalculatorDocument(JSON.stringify(final))).toThrow(/saved expression/);

    normal.critEligible=false;
    const noCrit=calculateDocument(doc).hits[0]!;
    expect(noCrit.expected).toBe(noCrit.nonCritical);
    expect(noCrit.trace.find(node=>node.id==="equipmentCriticalBonus.0")?.status).toBe("not-applicable");
    const transformative:CalculatorHit={kind:"transformative",id:normal.id,label:"非普通分支协议",reaction:"overload",reactionBonus:0,sourceRefs:[],dependencies:[]};
    doc.hits=[transformative];doc.scope="single-hit";doc.selectedHitIds=[transformative.id];
    expect(calculateDocument(doc).hits[0]!.trace.find(node=>node.id==="ordinaryEquipmentEffectsExcluded")?.status).toBe("not-applicable");
  });
});
