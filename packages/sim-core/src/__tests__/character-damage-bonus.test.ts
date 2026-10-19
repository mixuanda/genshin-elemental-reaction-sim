import { describe, expect, it } from "vitest";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { createDendroTravelerA4BonusFormula } from "../character-formula-rules";
import { loadWorkedExample } from "../worked-examples";

function example(attackTag:"skill"|"burst") {
  const doc=loadWorkedExample("fixture-a");
  doc.build={mode:"manual-final",ascension:4,source:"explicit core fixture panel",stats:{atk:2000,hp:12000,def:800,em:200,critRate:0,critDamage:0}};
  const hit=doc.hits[0]!;
  if(hit.kind!=="ordinary")throw Error("Ordinary fixture required");
  hit.element="dendro";hit.attackTag=attackTag;hit.additiveBaseDamage=0;hit.damageBonus=.2;
  hit.damageBonusFormula=createDendroTravelerA4BonusFormula(attackTag);
  return doc;
}

describe("source Dendro Traveler A4 ordinary damage bonus",()=>{
  it.each(["skill","burst"] as const)("reads current EM for %s and adds the sourced bonus once",attackTag=>{
    const doc=example(attackTag),coefficient=attackTag==="skill"?.0015:.001;
    const first=calculateDocument(doc);
    const node=first.hits[0]!.trace.find(entry=>entry.id==="customDamageBonus")!;
    expect(node.result?.value).toBe(200*coefficient);
    expect(node.inputs.find(input=>input.key==="em")?.value).toBe(200);
    expect(node.sourceRefs[0]).toContain("/traveler/common/dendro/asc.go");
    expect(first.totals?.expected).toBeCloseTo(4000*(1+.2+200*coefficient)*.5*.9,10);
    if(doc.build.mode!=="manual-final")throw Error();
    doc.build.stats.em=400;
    expect(calculateDocument(doc).totals?.expected).toBeCloseTo(4000*(1+.2+400*coefficient)*.5*.9,10);
  });
  it("gates by actual ascension and preserves the formula through final-panel JSON without flattening it",()=>{
    const doc=example("skill");if(doc.build.mode!=="manual-final")throw Error();
    doc.build.ascension=3;
    const locked=calculateDocument(doc);
    expect(locked.totals?.expected).toBeCloseTo(2160,10);
    expect(locked.hits[0]!.trace.find(entry=>entry.id==="customDamageBonus")?.status).toBe("not-applicable");
    delete doc.build.ascension;
    expect(calculateDocument(doc).blockers.join()).toContain("缺少明确突破阶段");
    doc.build.ascension=4;
    const restored=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc,"imported-final")));
    expect(restored.hits[0]).toEqual({...doc.hits[0],effectiveResistance:doc.enemy.resistance});
    expect(calculateDocument(restored).totals).toEqual(calculateDocument(doc).totals);
  });
});
