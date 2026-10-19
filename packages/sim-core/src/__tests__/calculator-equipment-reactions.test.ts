import { describe, expect, it } from "vitest";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { loadWorkedExample } from "../worked-examples";
import { expr } from "../calculation-trace";

/** Protocol arithmetic fixture; this does not certify a real equipment mapping. */
function equipmentFixture() {
  const doc=loadWorkedExample("fixture-a");if(doc.build.mode!=="equipment-derived")throw Error();
  doc.build.em=0;doc.build.critRate=0;doc.build.critDamage=0;
  doc.build.equipment={characterId:"synthetic-character",weaponId:"synthetic-weapon",level:90,ascension:6,weaponLevel:90,weaponAscension:6,refinement:1,sourceVersion:"synthetic-protocol",sourceRefs:["synthetic:equipment-protocol"],derivedStats:[],secondaryContributions:[],assumptions:[],effectBlockers:[],bonusAccounting:"core-sourced-v1",
    reactionBonuses:[{id:"swirl",label:"扩散专属夹具",value:.6,reactions:["swirlPyro","swirlHydro","swirlCryo","swirlElectro"],sourceRefs:["synthetic:swirl"]},{id:"amplifying",label:"增幅专属夹具",value:.15,reactions:["melt","reverseMelt","vaporize","reverseVaporize"],sourceRefs:["synthetic:amplifying"]},{id:"additive",label:"超激化专属夹具",value:.2,reactions:["aggravate"],sourceRefs:["synthetic:additive"]}],
    resistanceReductions:[{id:"pyro-res",label:"火减抗夹具",value:.4,elements:["pyro"],active:true,conditionLabel:"火减抗窗口有效",sourceRefs:["synthetic:res-pyro"]},{id:"cryo-res",label:"冰减抗夹具",value:.4,elements:["cryo"],active:false,conditionLabel:"冰减抗窗口有效",sourceRefs:["synthetic:res-cryo"]}]};
  return doc;
}

describe("shared equipment reaction bonuses and target resistance",()=>{
  it("combines a character formula with equipment resistance and preserves explicit final precedence",()=>{
    const doc=equipmentFixture(),hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();
    hit.element="pyro";
    hit.resistanceReductionFormula={ruleId:"synthetic-character-res",label:"合成角色减抗协议",expression:expr.mul(expr.input("mode"),expr.value(.035)),inputs:[{key:"mode",value:2,unit:"count",meaningKey:"合成模式",origin:"synthetic",allowedValues:[1,2]}],sourceRefs:["synthetic:character-res"],requirements:{minimumAscension:1,elements:["pyro"]}};
    const result=calculateDocument(doc),trace=result.hits[0]!.trace;
    expect(trace.find(node=>node.id==="characterResistanceReduction")).toMatchObject({status:"applied",result:{value:.07},sourceRefs:["synthetic:character-res"]});
    expect(trace.find(node=>node.id==="effectiveResistance")?.result?.value).toBeCloseTo(-.37,12);
    const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc))),finalHit=final.hits[0]!;if(finalHit.kind!=="ordinary")throw Error();
    expect(calculateDocument(final).totals).toEqual(result.totals);
    expect(finalHit.resistanceReductionFormula).toEqual(hit.resistanceReductionFormula);
    expect(calculateDocument(final).hits[0]!.trace.find(node=>node.id==="characterResistanceReduction")).toMatchObject({status:"not-applicable",sourceRefs:["synthetic:character-res"]});
    if(doc.build.mode!=="equipment-derived")throw Error();doc.build.equipment!.ascension=0;
    expect(calculateDocument(doc).hits[0]!.trace.find(node=>node.id==="effectiveResistance")?.result?.value).toBeCloseTo(-.3,12);
    delete doc.build.equipment;
    expect(calculateDocument(doc).blockers.join()).toContain("缺少明确突破阶段");
    hit.effectiveResistance=.2;
    expect(calculateDocument(doc).hits[0]!.trace.find(node=>node.id==="effectiveResistance")?.result?.value).toBe(.2);
  });
  it("preserves audited input choices in JSON and rejects values outside the declared choices",()=>{
    const doc=equipmentFixture(),hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();
    hit.damageBonusFormula={ruleId:"synthetic-choice",label:"已审范围协议夹具",expression:expr.div(expr.input("resource"),expr.value(100)),inputs:[{key:"resource",value:20,unit:"count",meaningKey:"已审资源档",origin:"synthetic",allowedValues:[20,40,60,80,100]}],sourceRefs:["synthetic:choices"]};
    const restored=parseCalculatorDocument(serializeCalculatorDocument(doc)),restoredHit=restored.hits[0]!;if(restoredHit.kind!=="ordinary")throw Error();
    expect(restoredHit.damageBonusFormula?.inputs[0]?.allowedValues).toEqual([20,40,60,80,100]);
    hit.damageBonusFormula.inputs[0]!.value=30;
    expect(()=>parseCalculatorDocument(JSON.stringify(doc))).toThrow(/sourced numeric domain/);
  });
  it("uses reaction-specific bonuses and explicit element/active gates for transformative damage",()=>{
    const doc=equipmentFixture(),id=doc.hits[0]!.id;
    doc.hits=[{id,label:"火扩散",kind:"transformative",reaction:"swirlPyro",reactionBonus:.1,sourceRefs:[],dependencies:[]}];
    const pyro=calculateDocument(doc);
    expect(pyro.totals?.expected).toBeCloseTo(1446.8535*.6*(1+.1+.6)*1.15,10);
    expect(pyro.hits[0]!.trace.find(node=>node.id==="effectiveResistance")?.result?.value).toBeCloseTo(-.3,12);
    const transformed=doc.hits[0]!;if(transformed.kind!=="transformative")throw Error();transformed.reaction="swirlCryo";
    const cryo=calculateDocument(doc);
    expect(cryo.totals?.expected).toBeCloseTo(1446.8535*.6*(1+.1+.6)*.9,10);
    const inactive=cryo.hits[0]!.trace.find(node=>node.id==="equipmentResistanceReduction.1")!;
    expect(inactive.status).toBe("not-applicable");expect(inactive.inputs.find(input=>input.key==="resistanceReduction")?.value).toBe(.4);expect(inactive.result?.value).toBe(0);
  });
  it("routes amplification and aggravate bonuses to their reaction formulas, never ordinary DMG Bonus",()=>{
    const doc=equipmentFixture(),hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();
    hit.element="hydro";hit.reaction="vaporize";hit.damageBonus=0;hit.additiveBaseDamage=0;hit.reactionBonus=.05;
    const amplified=calculateDocument(doc);
    expect(amplified.totals?.expected).toBeCloseTo(4000*.5*.9*2*(1+.05+.15),10);
    expect(amplified.hits[0]!.trace.find(node=>node.id==="applicableDamageBonus")?.result?.value).toBe(0);
    hit.element="electro";hit.reaction="none";hit.additiveReaction="aggravate";
    const additive=calculateDocument(doc);
    expect(additive.totals?.expected).toBeCloseTo((4000+1446.8535*1.15*(1+.05+.2))*.5*.9,10);
    expect(additive.hits[0]!.trace.find(node=>node.id==="applicableReactionBonus")?.result?.value).toBe(.25);
  });
  it("preserves different per-hit final resistances and reaction bonuses in JSON without reapplying equipment",()=>{
    const doc=equipmentFixture(),first=doc.hits[0]!;if(first.kind!=="ordinary")throw Error();
    first.element="pyro";first.reaction="reverseVaporize";first.reactionBonus=.05;
    const second={...structuredClone(first),id:"second",element:"cryo" as const,reaction:"reverseMelt" as const};
    doc.hits.push(second);doc.selectedHitIds.push(second.id);doc.scope="one-cast";
    const before=calculateDocument(doc),converted=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(calculateDocument(converted).totals).toEqual(before.totals);
    const convertedFirst=converted.hits[0]!,convertedSecond=converted.hits[1]!;
    if(convertedFirst.kind!=="ordinary"||convertedSecond.kind!=="ordinary")throw Error();
    expect(convertedFirst.effectiveResistance).toBeCloseTo(-.3,12);expect(convertedSecond.effectiveResistance).toBe(.1);
    expect(convertedFirst.reactionBonus).toBe(.2);
    first.effectiveResistance=.25;
    expect(calculateDocument(doc).hits[0]!.trace.find(node=>node.id==="effectiveResistance")?.result?.value).toBe(.25);
    expect(calculateDocument(doc).hits[0]!.trace.some(node=>node.id.startsWith("equipmentResistanceReduction"))).toBe(false);
  });
});
