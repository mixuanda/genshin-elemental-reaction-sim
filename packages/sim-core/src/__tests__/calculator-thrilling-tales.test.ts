import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { THRILLING_TALES, thrillingTalesCoefficient } from "@genshin-dps-lab/reaction-formulas";
import evidence from "../../../game-data/sources/thrilling-tales/manifest.json";
import { gameDataCatalog } from "../../../game-data/src/catalog";
import { getCharacterDocuments, applyCharacterConstellationScope } from "../../../../apps/web/src/character-calculations";
import { applyCharlotteSkillContext } from "../collei-charlotte-formulas";
import { prepareIncomingThrillingTales, resetIncomingThrillingTalesPanelAccounting } from "../thrilling-tales-calculator";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";
import { loadWorkedExample } from "../worked-examples";
import { expr } from "../calculation-trace";
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const ordinary=(doc:CalculatorDocument,index:number)=>doc.hits[index] as Extract<CalculatorHit,{kind:"ordinary"}>;
function charlotte():CalculatorDocument {
  const id=gameDataCatalog.characters.find(row=>row.slug==="charlotte")!.id;
  let doc=getCharacterDocuments(id,1).find(row=>row.gameContext!.skillId==="charlotte-skill-hold-complete")!;
  doc.gameContext!.constellation=2;doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:800,em:0,critRate:.5,critDamage:1},source:"可编辑教学最终面板"};
  doc=applyCharacterConstellationScope(applyCharlotteSkillContext(doc,{nonFontaineTeammates:2,a4IncludedInPanel:false,c2BaseAttack:500,c2IncludedStacks:0,c2HitStacks:Object.fromEntries(doc.hits.map((hit,index)=>[hit.id,index===0||index===8?0:1])),markUninterrupted:true,statsStableAcrossHits:true}));
  doc.incomingThrillingTales={ownerId:"external-catalyst-owner",ownerLabel:"明确外部讨龙来源",refinement:5,baseAttack:500,hitStates:Object.fromEntries(doc.hits.map((hit,index)=>[hit.id,{active:index!==0&&index!==8,includedRefinement:0}]))};
  return prepareIncomingThrillingTales(doc);
}

describe("standalone incoming Thrilling Tales accounting",()=>{
  it("reuses pinned raw bytes and shares every refinement plus nominal clocks with runtime consumers",()=>{
    const sources=new Map<string,string>();
    for(const file of evidence.files){
      let raw:string;
      if("archivePath" in file){const bytes=readFileSync(file.archivePath);expect(hash(bytes)).toBe(file.archiveSha256);raw=JSON.parse(gunzipSync(bytes).toString()).files[file.archiveEntry!] as string;}
      else raw=readFileSync(file.archivedPath,"utf8");
      expect(hash(raw),file.upstreamPath).toBe(file.sha256);expect(file.reused).toBe(true);sources.set(file.upstreamPath,raw);
    }
    const code=sources.get("internal/weapons/catalyst/thrilling/thrilling.go")!;expect(code).toContain(".18 + float64(r)*0.06");expect(code).toContain("icd := 1200");expect(code).toContain('NewBaseWithHitlag("ttds", 600)');expect(code.indexOf("char.AddStatus(icdKey")).toBeLessThan(code.indexOf('active.StatModIsActive("ttds")'));
    const catalog=JSON.parse(sources.get("src/data/ChineseSimplified/weapons/thrillingtalesofdragonslayers.json")!);expect(catalog.id).toBe(14302);
    const coefficients=Array.from({length:5},(_,index)=>parseFloat(catalog[`r${index+1}`].values[0])/100);expect(coefficients).toEqual([.24,.30,.36,.42,.48]);expect(THRILLING_TALES.coefficients).toEqual(coefficients);expect(coefficients.map((_,index)=>thrillingTalesCoefficient(index+1))).toEqual(coefficients);
    expect(THRILLING_TALES.durationFrames).toBe(600);expect(THRILLING_TALES.cooldownFrames).toBe(1200);expect(sources.get("pkg/core/attributes/stats.go")).toContain("s[BaseATK]*(1+s[ATKP]) + s[ATK]");
  });

  it("composes per-hit incoming ATK with Charlotte C2 and preserves negative shares, final conversion, JSON and historical panels",()=>{
    const doc=charlotte(),expected=(1.392*1000+7*.406*1290+.406*1000)*1.1*.5*.9;
    const output=calculateDocument(doc);expect(output.totals!.nonCritical).toBeCloseTo(expected,9);expect(output.totals!.expected).toBeCloseTo(expected*1.5,9);
    const middle=doc.hits[1]!.id,last=doc.hits[8]!.id;
    expect(output.trace.find(node=>node.id===`${middle}.incomingThrillingTalesAdjustment`)!.result!.value).toBe(240);expect(output.trace.find(node=>node.id===`${middle}.sourceAttackAdjustment`)!.result!.value).toBe(50);
    const unknown=structuredClone(doc);delete unknown.incomingThrillingTales!.hitStates[last]!.active;expect(calculateDocument(unknown).status).toBe("blocked");unknown.scope="single-hit";unknown.selectedHitIds=[middle];expect(calculateDocument(unknown).totals!.nonCritical).toBeCloseTo(.406*1290*1.1*.5*.9,9);
    const negative=structuredClone(doc);negative.scope="single-hit";negative.selectedHitIds=[last];negative.incomingThrillingTales!.hitStates[last]!.includedRefinement=1;
    expect(calculateDocument(negative).totals!.nonCritical).toBeCloseTo(.406*880*1.1*.5*.9,9);
    negative.selectedHitIds=[middle];negative.incomingThrillingTales!.hitStates[middle]!.includedRefinement=1;expect(calculateDocument(negative).totals!.nonCritical).toBeCloseTo(.406*1170*1.1*.5*.9,9);
    const included=structuredClone(doc);if(included.build.mode==="equipment-derived")throw Error();included.build.stats.atk=1240;for(const state of Object.values(included.incomingThrillingTales!.hitStates))state.includedRefinement=5;
    expect(calculateDocument(included).totals).toEqual(output.totals);included.scope="single-hit";included.selectedHitIds=[middle];delete included.incomingThrillingTales!.baseAttack;
    expect(calculateDocument(included).totals!.nonCritical).toBeCloseTo(.406*1290*1.1*.5*.9,9);expect(calculateDocument(included).trace.find(node=>node.id===`${middle}.incomingThrillingTalesAdjustment`)!.inputs.some(input=>input.key==="ttdsBaseAttack")).toBe(false);
    let gear=structuredClone(doc);gear.build={mode:"equipment-derived",characterBaseAtk:300,weaponBaseAtk:200,atkPercent:1,flatAtk:0,baseHp:10000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};gear.incomingThrillingTales!.baseAttack=99999;
    gear=prepareIncomingThrillingTales(gear);expect(gear.incomingThrillingTales!.baseAttack).toBe(500);expect(gear.incomingThrillingTales!.hitStates[middle]!.baseAttack).toBeUndefined();const final=convertCalculatorToFinalPanel(gear);if(final.build.mode==="equipment-derived")throw Error();expect(final.build.stats.atk).toBe(1000);expect(calculateDocument(final).totals).toEqual(output.totals);
    const editedBase=structuredClone(final);editedBase.incomingThrillingTales!.baseAttack=600;expect(calculateDocument(editedBase).totals!.nonCritical).toBeCloseTo((1.392*1000+7*.406*1338+.406*1000)*1.1*.5*.9,9);
    const json=parseCalculatorDocument(serializeCalculatorDocument(final));ordinary(json,1).incomingThrillingTalesFormula!.expression=expr.value(99999);expect(calculateDocument(json).totals).toEqual(output.totals);
    const noContext=structuredClone(doc);delete noContext.incomingThrillingTales;const cleared=prepareIncomingThrillingTales(noContext);expect(ordinary(cleared,1).incomingThrillingTalesFormula).toBeUndefined();expect(calculateDocument(cleared).totals!.nonCritical).toBeCloseTo((1.392*1000+7*.406*1050+.406*1000)*1.1*.5*.9,9);
    const imported=structuredClone(final);resetIncomingThrillingTalesPanelAccounting(imported,"imported-final");expect(imported.incomingThrillingTales!.baseAttack).toBeUndefined();expect(imported.incomingThrillingTales!.hitStates[middle]!.baseAttack).toBeUndefined();expect(imported.incomingThrillingTales!.hitStates[middle]!.includedRefinement).toBeUndefined();expect(imported.incomingThrillingTales!.hitStates[middle]!.active).toBe(true);
    let historical=loadWorkedExample("fixture-a");const h=ordinary(historical,0);h.finalSnapshot={stats:{atk:1300,hp:10000,def:800,em:0,critRate:.5,critDamage:1},characterLevel:90,ascension:6,damageBonus:0,additiveBaseDamage:0,reactionBonus:0,source:"此前实际命中面板",sourceRefs:["explicit-history"]};
    historical.incomingThrillingTales={ownerId:"past-owner",ownerLabel:"此前真实讨龙来源",refinement:5,baseAttack:99999,hitStates:{[h.id]:{active:true,includedRefinement:1}}};expect(calculateDocument(historical).status).toBe("blocked");
    historical.incomingThrillingTales.hitStates[h.id]!.baseAttack=300;historical=prepareIncomingThrillingTales(historical);const pastState=structuredClone(historical.incomingThrillingTales!.hitStates[h.id]);expect(calculateDocument(historical).totals!.nonCritical).toBeCloseTo((1300+300*(.48-.24))*2*.5*.9,9);
    resetIncomingThrillingTalesPanelAccounting(historical,"fresh-equipment");expect(historical.incomingThrillingTales!.hitStates[h.id]).toEqual(pastState);resetIncomingThrillingTalesPanelAccounting(historical,"imported-final");expect(historical.incomingThrillingTales!.hitStates[h.id]).toEqual(pastState);expect(calculateDocument(historical).totals!.nonCritical).toBeCloseTo((1300+300*(.48-.24))*2*.5*.9,9);
  });
});
