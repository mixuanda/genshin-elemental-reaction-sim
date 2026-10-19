import {describe,expect,it} from "vitest";
import {gameDataCatalog} from "../../../game-data/src/catalog";
import {resolveEquipmentBuild} from "../../../game-data/src/equipment-build";
import {calculateDocument,convertCalculatorToFinalPanel,getCalculatorHitPendingEquipmentEffects,parseCalculatorDocument,serializeCalculatorDocument,type CalculatorHit} from "../calculator";
import {loadWorkedExample} from "../worked-examples";

describe("pending equipment clauses are selected-hit dependencies",()=>{
  it("keeps Wolf-Fang's unknown Q stacks separate from a known E, including unselected-hit final conversion and JSON",()=>{
    const character=gameDataCatalog.characters.find(entry=>entry.slug==="kaeya")!,weapon=gameDataCatalog.weapons.find(entry=>entry.slug==="wolffang")!;
    const resolution=resolveEquipmentBuild({characterId:character.id,weaponId:weapon.id,level:90,ascension:6,weaponLevel:90,weaponAscension:6,refinement:1,effectsDisabled:true,weaponEffectsEnabled:true,effectContext:{weaponSkillStacks:2}});
    expect(resolution.build.equipment.pendingHitEffects).toEqual([expect.objectContaining({kind:"critRate",attackTags:["burst"],reason:expect.stringContaining("weaponBurstStacks")})]);
    expect(resolution.build.equipment.criticalBonuses?.some(effect=>effect.attackTags?.includes("burst"))).toBe(false);
    const doc=loadWorkedExample("fixture-a"),skill=doc.hits[0]!;if(skill.kind!=="ordinary")throw Error();
    doc.build=resolution.build;skill.attackTag="skill";skill.element="cryo";
    const burst:Extract<CalculatorHit,{kind:"ordinary"}>={...structuredClone(skill),id:"burst",attackTag:"burst"};doc.hits.push(burst);
    expect(calculateDocument(doc).status).toBe("calculated");
    expect(getCalculatorHitPendingEquipmentEffects(doc.build,skill)).toEqual([]);
    const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc))),finalBurst=final.hits[1]!;if(finalBurst.kind!=="ordinary")throw Error();
    expect(calculateDocument(final).totals).toEqual(calculateDocument(doc).totals);
    expect(finalBurst.pendingEquipmentEffects?.[0]?.kind).toBe("critRate");
    expect(finalBurst.effectiveCritRate).toBeUndefined();
    final.selectedHitIds=[finalBurst.id];
    const blocked=calculateDocument(final);expect(blocked.status).toBe("blocked");expect(blocked.blockers.join()).toContain("weaponBurstStacks");expect(blocked.hits[0]!.trace[0]!.sourceRefs.length).toBeGreaterThan(0);
    doc.selectedHitIds=[burst.id];expect(()=>convertCalculatorToFinalPanel(doc)).toThrow(/weaponBurstStacks/);
    burst.attackTag="normal";expect(calculateDocument(doc).status).toBe("calculated");
    burst.attackTag="burst";burst.critEligible=false;expect(calculateDocument(doc).status).toBe("calculated");
    expect(getCalculatorHitPendingEquipmentEffects(doc.build,{kind:"transformative",id:"reaction",label:"普通剧变",reaction:"superconduct",reactionBonus:0,sourceRefs:[],dependencies:[]})).toEqual([]);
    finalBurst.effectiveCritRate=.5;expect(calculateDocument(final).status).toBe("calculated");
    finalBurst.effectiveCritDamage=-.01;expect(()=>parseCalculatorDocument(JSON.stringify(final))).toThrow();
  });
});
