import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import evidence from "../../../game-data/src/character-mappings/yanfei-charged-source-manifest.json";
import { applyCharacterConstellationScope, applyYanfeiChargedContext, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { YANFEI_A4_HIT_ID, YANFEI_MAIN_HIT_ID } from "../../../../apps/web/src/yanfei-calculation-context";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";

function get():CalculatorDocument {
  const doc=getCharacterDocuments("character:10000048",1).find(document=>document.gameContext?.skillId==="yanfei-charged-cast")!;
  if(!doc||doc.build.mode==="equipment-derived")throw Error("Registered Yanfei action required");
  doc.build.stats={atk:1000,hp:10000,def:800,em:0,critRate:.5,critDamage:1};
  return applyYanfeiChargedContext(doc,{...doc.gameContext!.yanfeiCharged!,scarletSeals:3});
}
const ordinary=(doc:CalculatorDocument,id:string)=>doc.hits.find(hit=>hit.id===id) as Extract<CalculatorHit,{kind:"ordinary"}>;

describe("one source Yanfei charged input with conditional A4",()=>{
  it("matches all archived source bytes and executes the crit gate as a cast contribution, never as actual hit damage",()=>{
    for(const entry of Object.values(evidence.sourceFiles))expect(createHash("sha256").update(readFileSync(entry.archivePath)).digest("hex")).toBe(entry.sha256);
    const doc=get(),output=calculateDocument(doc),main=output.hits[0]!,a4=output.hits[1]!;
    expect(output.status).toBe("calculated");expect(doc.gameContext!.scopeCoverage).toBe("complete-cast");
    expect(main.nonCritical).toBeCloseTo(1000*1.502332*1.15*.5*.9,10);
    expect(a4.nonCritical).toBeCloseTo(414,10);expect(a4.expected).toBeCloseTo(621,10);
    expect(a4.castContribution!.triggerProbability).toBe(.5);
    expect(output.totals!.nonCritical).toBeCloseTo(777.45681,10);
    expect(output.totals!.critical).toBeCloseTo(2382.91362,10);
    expect(output.totals!.expected).toBeCloseTo(1476.685215,10);
    const occurrence=a4.trace.find(node=>node.id==="occurrence.expected")!;
    expect(occurrence.result!.value).toBeCloseTo(310.5,10);expect(occurrence.substitution).toContain("0.5");
    doc.scope="single-hit";doc.selectedHitIds=[YANFEI_A4_HIT_ID];
    const single=calculateDocument(doc);expect(single.totals!.expected).toBeCloseTo(621,10);expect(single.hits[0]!.castContribution).toBeUndefined();
    expect(single.hits[0]!.trace.find(node=>node.id==="conditionedOccurrence")!.status).toBe("assumed");
  });
  it("separates each C2 threshold, Q level/window, old A1 replacement and both hits' reactions",()=>{
    let doc=get();doc.gameContext!.constellation=2;
    doc=applyCharacterConstellationScope(applyYanfeiChargedContext(doc,{...doc.gameContext!.yanfeiCharged!,mainEnemyHpFraction:.5,a4EnemyHpFraction:.49}));
    let result=calculateDocument(doc);expect(result.hits[0]!.effectiveCritRate).toBe(.5);expect(result.hits[1]!.effectiveCritRate).toBe(.7);
    expect(result.hits[1]!.castContribution!.expected).toBeCloseTo(351.9,10);
    for(const hit of doc.hits)if(hit.kind==="ordinary")hit.damageBonus=.1;
    doc=applyYanfeiChargedContext(doc,{...doc.gameContext!.yanfeiCharged!,priorA1BonusIncluded:.1,brilliance:{effectiveTalentLevel:1,mainActive:true,a4Active:false}});
    result=calculateDocument(doc);
    expect(result.hits[0]!.nonCritical).toBeCloseTo(1000*1.502332*(1+.15+.334)*.5*.9,10);
    expect(result.hits[1]!.nonCritical).toBeCloseTo(414,10);
    const before=result.hits[0]!.nonCritical!;
    doc=applyYanfeiChargedContext(doc,{...doc.gameContext!.yanfeiCharged!,brilliance:{...doc.gameContext!.yanfeiCharged!.brilliance,effectiveTalentLevel:10}});
    result=calculateDocument(doc);expect(result.hits[0]!.nonCritical).toBeGreaterThan(before);expect(result.hits[1]!.nonCritical).toBeCloseTo(414,10);
    expect(doc.gameContext!.effectiveTalentLevel).toBe(1);
    ordinary(doc,YANFEI_MAIN_HIT_ID).reaction="reverseVaporize";
    const vaporized=calculateDocument(doc);expect(vaporized.hits[0]!.nonCritical).toBeCloseTo(result.hits[0]!.nonCritical!*1.5,10);expect(vaporized.hits[1]!.castContribution).toEqual(result.hits[1]!.castContribution);
  });
  it("checks C6 seal limit, disabled A4, independent snapshot dependency and final JSON replay",()=>{
    let doc=get();const four={...doc.gameContext!.yanfeiCharged!,scarletSeals:4};
    expect(calculateDocument(applyYanfeiChargedContext(doc,four)).status).toBe("blocked");
    doc.gameContext!.constellation=6;doc=applyCharacterConstellationScope(applyYanfeiChargedContext(doc,four));
    expect(calculateDocument(doc).status).toBe("calculated");
    const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(calculateDocument(final).totals).toEqual(calculateDocument(doc).totals);
    const changed=applyYanfeiChargedContext(final,{...final.gameContext!.yanfeiCharged!,mainEnemyHpFraction:.49});
    expect(calculateDocument(changed).hits[0]!.effectiveCritRate).toBe(.5); // An explicit final override wins over the updated C2 source formula.
    delete ordinary(changed,YANFEI_MAIN_HIT_ID).effectiveCritRate;
    expect(calculateDocument(changed).hits[0]!.effectiveCritRate).toBe(.7);
    const unstable=applyYanfeiChargedContext(doc,{...doc.gameContext!.yanfeiCharged!,statsStableToA4:false});
    expect(calculateDocument(unstable).status).toBe("blocked");
    unstable.scope="single-hit";unstable.selectedHitIds=[YANFEI_MAIN_HIT_ID];expect(calculateDocument(unstable).status).toBe("calculated");
    doc.scope="single-hit";doc.selectedHitIds=[YANFEI_A4_HIT_ID];
    const offField=calculateDocument(applyYanfeiChargedContext(doc,{...doc.gameContext!.yanfeiCharged!,onFieldAtMainHit:false}));
    expect(offField.hits[0]!.status).toBe("non-damaging");expect(offField.totals).toBeUndefined();
    doc.gameContext!.ascension=3;
    expect(calculateDocument(applyYanfeiChargedContext(doc,doc.gameContext!.yanfeiCharged!)).hits[0]!.status).toBe("non-damaging");
    delete doc.gameContext!.ascension;
    const unknownAscension=applyYanfeiChargedContext(doc,doc.gameContext!.yanfeiCharged!);
    const unknownA4=calculateDocument(unknownAscension);
    expect(unknownA4.status).toBe("blocked");expect(unknownA4.hits[0]!.status).toBe("blocked");
    expect(unknownA4.blockers.join()).toContain("突破阶段");
    unknownAscension.selectedHitIds=[YANFEI_MAIN_HIT_ID];
    expect(calculateDocument(unknownAscension).status).toBe("blocked");
    unknownAscension.scope="one-cast";unknownAscension.selectedHitIds=[YANFEI_MAIN_HIT_ID,YANFEI_A4_HIT_ID];
    const unknownCast=calculateDocument(unknownAscension);
    expect(unknownCast.status).toBe("blocked");expect(unknownCast.totals).toBeUndefined();
  });
});
