import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../../game-data/src/catalog";
import evidence from "../../../game-data/sources/charlotte-c2/manifest.json";
import { getCharacterDocuments, applyCharacterConstellationScope } from "../../../../apps/web/src/character-calculations";
import { applyCharlotteSkillContext, resetCharlottePanelAccounting } from "../collei-charlotte-formulas";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";
import { expr } from "../calculation-trace";
const ordinary=(doc:CalculatorDocument,index:number)=>doc.hits[index] as Extract<CalculatorHit,{kind:"ordinary"}>;
const hash=(data:Buffer|string)=>createHash("sha256").update(data).digest("hex");
function docFor(branch:"press"|"hold",constellation=2):CalculatorDocument {
  const id=gameDataCatalog.characters.find(row=>row.slug==="charlotte")!.id;
  const doc=getCharacterDocuments(id,1).find(row=>row.gameContext!.skillId===`charlotte-skill-${branch}-complete`)!;
  doc.gameContext!.constellation=constellation;
  doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:800,em:0,critRate:.5,critDamage:1},source:"独立手算教学最终面板"};
  return applyCharacterConstellationScope(doc);
}
const stacks=(doc:CalculatorDocument,markStacks:number)=>Object.fromEntries(doc.hits.map((hit,index)=>[hit.id,index===0||index===8?0:markStacks]));
function setup(doc:CalculatorDocument,markStacks=3):CalculatorDocument {
  return applyCharlotteSkillContext(doc,{nonFontaineTeammates:2,a4IncludedInPanel:false,markUninterrupted:true,statsStableAcrossHits:true,c2IncludedStacks:0,c2BaseAttack:500,c2HitStacks:stacks(doc,markStacks)});
}

describe("Charlotte C2-C5 independently captured hit states",()=>{
  it("pins the ATK-percent and expiry evidence, and requires the real final tick without guessing its C2 state",()=>{
    const bytes=readFileSync(evidence.localArchivePath);expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive=JSON.parse(gunzipSync(bytes).toString()) as {files:Record<string,string>};for(const [path,sha] of Object.entries(evidence.sourceSha256))expect(hash(archive.files[path]!),path).toBe(sha);
    expect(hash(readFileSync(evidence.previousArchivePath))).toBe(evidence.previousArchiveSha256);
    for(const file of evidence.optimizerSources)expect(hash(readFileSync(file.archivedPath))).toBe(file.sha256);
    const params=JSON.parse(readFileSync(evidence.optimizerSources.find(row=>row.path.endsWith("skillParam.json"))!.archivedPath,"utf8"));expect(params.constellation2).toEqual([.1,.2,.3,12]);
    expect(archive.files["pkg/core/player/character/stats.go"]).toContain("Expiry() <= *c.f");expect(archive.files["internal/characters/charlotte/cons.go"]).toContain("m[attributes.ATKP] = 0.1 * float64(c.c2Hits)");expect(archive.files["pkg/core/attributes/stats.go"]).toContain("s[BaseATK]*(1+s[ATKP]) + s[ATK]");
    let doc=setup(docFor("hold"));const expected=(1.392*1000+7*.406*1150+.406*1000)*1.1*.5*.9;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(expected,9);expect(calculateDocument(doc).totals!.expected).toBeCloseTo(expected*1.5,9);
    delete doc.gameContext!.charlotteSkill!.c2HitStacks![doc.hits[8]!.id];expect(calculateDocument(doc).status).toBe("blocked");
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[1]!.id];expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(.406*1150*1.1*.5*.9,9);
    doc.selectedHitIds=[doc.hits[8]!.id];expect(calculateDocument(doc).status).toBe("blocked");
    doc=applyCharlotteSkillContext(doc,{...doc.gameContext!.charlotteSkill!,c2HitStacks:{[doc.hits[8]!.id]:0}});expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(.406*1000*1.1*.5*.9,9);
    const inherited=setup(docFor("press",5));inherited.gameContext!.charlotteSkill!.c2HitStacks![inherited.hits[0]!.id]=3;
    expect(calculateDocument(inherited).hits[0]!.nonCritical).toBeCloseTo(.672*1150*1.1*.5*.9,9);
    inherited.gameContext!.constellation=6;expect(calculateDocument(applyCharacterConstellationScope(inherited)).status).toBe("blocked");
  });

  it("subtracts already included C2 once and preserves independent states through source gear, final conversion, JSON and imports",()=>{
    let doc=setup(docFor("hold"));const expected=calculateDocument(doc).totals!;
    if(doc.build.mode==="equipment-derived")throw Error();doc.build.stats.atk=1150;doc.gameContext!.charlotteSkill!.c2IncludedStacks=3;
    expect(calculateDocument(doc).totals).toEqual(expected);expect(calculateDocument(doc).trace.some(node=>node.id.endsWith("sourceAttackAdjustment")&&node.result?.value===-150)).toBe(true);
    doc.gameContext!.charlotteSkill!.c2BaseAttack=undefined;expect(calculateDocument(doc).blockers.join(" ")).toContain("基础攻击");
    const same=structuredClone(doc);same.scope="single-hit";same.selectedHitIds=[same.hits[1]!.id];const sameResult=calculateDocument(same);
    expect(sameResult.totals!.nonCritical).toBeCloseTo(.406*1150*1.1*.5*.9,9);expect(sameResult.trace.find(node=>node.id.endsWith("sourceAttackAdjustment"))!.inputs.some(input=>input.key==="charlotteBaseAttack")).toBe(false);
    same.selectedHitIds=[same.hits[8]!.id];expect(calculateDocument(same).blockers.join(" ")).toContain("基础攻击");
    doc.build={mode:"equipment-derived",characterBaseAtk:300,weaponBaseAtk:200,atkPercent:1,flatAtk:0,baseHp:10000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};
    resetCharlottePanelAccounting(doc,"fresh-equipment");doc.gameContext!.charlotteSkill!.c2BaseAttack=99999;
    doc=applyCharlotteSkillContext(doc,doc.gameContext!.charlotteSkill!);expect(doc.gameContext!.charlotteSkill!.c2BaseAttack).toBe(500);expect(calculateDocument(doc).totals).toEqual(expected);
    const final=convertCalculatorToFinalPanel(doc);if(final.build.mode==="equipment-derived")throw Error();expect(final.build.stats.atk).toBe(1000);expect(final.gameContext!.charlotteSkill!.c2IncludedStacks).toBe(0);expect(final.gameContext!.charlotteSkill!.c2BaseAttack).toBe(500);
    const restored=parseCalculatorDocument(serializeCalculatorDocument(final));expect(calculateDocument(restored).totals).toEqual(expected);
    ordinary(restored,1).attackAdjustment!.formula.expression=expr.value(99999);expect(calculateDocument(restored).totals).toEqual(expected);
    const actualStates=structuredClone(restored.gameContext!.charlotteSkill!.c2HitStacks);resetCharlottePanelAccounting(restored,"imported-final");expect(restored.gameContext!.charlotteSkill!.c2HitStacks).toEqual(actualStates);expect(restored.gameContext!.charlotteSkill!.c2IncludedStacks).toBeUndefined();expect(restored.gameContext!.charlotteSkill!.c2BaseAttack).toBeUndefined();expect(calculateDocument(restored).status).toBe("blocked");
  });

  it("reproduces all nine hits of the single pinned gcsim hold run, including the exact unbuffed expiry tick",()=>{
    const sample=JSON.parse(readFileSync("docs/cross-validation/charlotte-c2/hold-reference.sample.json","utf8")) as {logs:Array<{event:string;frame:number;logs:Record<string,unknown>}>};
    const source=sample.logs.filter(row=>row.event==="calc");expect(source).toHaveLength(9);expect(source.map(row=>row.frame)).toEqual([113,203,293,383,473,563,653,743,833]);
    expect(source.map(row=>row.logs.atk_per)).toEqual([0,.1,.1,.1,.1,.1,.1,.1,0]);
    let doc=docFor("hold");doc.characterLevel=1;doc.gameContext!.ascension=0;
    doc.build={mode:"manual-final",stats:{atk:47.44352,hp:902.6731,def:45.78,em:0,critRate:0,critDamage:.5,energyRecharge:1},ascension:0,source:"唯一固定gcsim样本：C2/Lv1/口袋魔导书Lv1，无命中停顿"};
    doc=applyCharlotteSkillContext(doc,{a4IncludedInPanel:false,markUninterrupted:true,statsStableAcrossHits:true,c2IncludedStacks:0,c2BaseAttack:47.44352,c2HitStacks:stacks(doc,1)});
    const result=calculateDocument(doc);for(const [index,hit] of result.hits.entries())expect(hit.nonCritical).toBeCloseTo(source[index]!.logs.damage as number,12);
    const independent=(47.44352*1.392+7*(47.44352*1.1)*.406+47.44352*.406)*(101/291)*.9;
    expect(result.totals!.nonCritical).toBeCloseTo(independent,12);expect(result.hits[8]!.nonCritical).toBeCloseTo(6.016914374597937,12);expect(result.hits[7]!.nonCritical).toBeCloseTo(6.618605812057733,12);
  });
});
