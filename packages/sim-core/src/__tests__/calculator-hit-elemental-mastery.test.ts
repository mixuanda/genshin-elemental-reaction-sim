import {describe,expect,it} from "vitest";
import {calculateDocument,convertCalculatorToFinalPanel,parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from "../calculator";
import {expr} from "../calculation-trace";
import {loadWorkedExample} from "../worked-examples";

describe("per-hit sourced elemental mastery accounting",()=>{
  it("shares the adjusted EM across scaling and reactions, preserves independent hit state and avoids final-panel double counting",()=>{
    const doc=loadWorkedExample("fixture-a"),hit=doc.hits[0]!;
    if(doc.build.mode!=="equipment-derived"||hit.kind!=="ordinary")throw Error();
    doc.build.em=100;doc.gameContext={characterId:"synthetic",characterName:"合成合同",abilityId:"contract",skillId:"contract",skillName:"精通状态合同",effectiveTalentLevel:1,ascension:6,constellation:2,scopeCoverage:"selected-components",attributionPolicy:"只验证共享协议，不声明真实角色可触发本反应。"};
    hit.element="dendro";hit.terms=[{stat:"em",coefficient:2}];hit.damageBonus=0;hit.additiveBaseDamage=0;hit.critEligible=false;hit.additiveReaction="spread";
    hit.elementalMasteryAdjustment={accounting:"add-to-panel",formula:{ruleId:"synthetic-hit-em",label:"显式持续状态",expression:expr.mul(expr.input("buffActive"),expr.value(200)),inputs:[{key:"buffActive",value:1,unit:"boolean",meaningKey:"当前命中时状态仍有效",origin:"synthetic",allowedValues:[0,1]}],sourceRefs:["synthetic:hit-em"],requirements:{minimumAscension:1,minimumConstellation:2,maximumConstellation:6}}};
    const second=structuredClone(hit);second.id="inactive";second.elementalMasteryAdjustment!.formula.inputs[0]!.value=0;
    doc.hits.push(second);doc.selectedHitIds.push(second.id);doc.scope="one-cast";
    const result=calculateDocument(doc),expected=(em:number)=>(em*2+1446.8535*1.25*(1+5*em/(1200+em)))*.5*.9;
    expect(result.hits[0]!.expected).toBeCloseTo(expected(300),8);
    expect(result.hits[1]!.expected).toBeCloseTo(expected(100),8);
    expect(result.hits[0]!.trace.find(node=>node.id==="hitElementalMastery")?.result?.value).toBe(300);
    const converted=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(calculateDocument(converted).totals).toEqual(result.totals);
    expect(converted.build.mode!=="equipment-derived"&&converted.build.stats.em).toBe(100);
    const included:CalculatorDocument=structuredClone(converted),includedHit=included.hits[0]!;
    if(included.build.mode==="equipment-derived"||includedHit.kind!=="ordinary")throw Error();
    included.scope="single-hit";included.selectedHitIds=[includedHit.id];included.build.stats.em=300;includedHit.elementalMasteryAdjustment!.accounting="already-in-final-panel";
    const replay=calculateDocument(included);
    expect(replay.hits[0]!.expected).toBe(result.hits[0]!.expected);
    expect(replay.hits[0]!.trace.find(node=>node.id==="hitElementalMastery")).toMatchObject({status:"not-applicable",result:{value:300},sourceRefs:["synthetic:hit-em"]});
    included.gameContext!.constellation=0;
    expect(calculateDocument(included).blockers.join()).toContain("不低于 C2");
  });
});
