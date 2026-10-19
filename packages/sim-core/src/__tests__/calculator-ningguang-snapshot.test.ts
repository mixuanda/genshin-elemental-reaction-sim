import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../../../game-data/src/catalog";
import { ningguangScreenMappings, ningguangScreenSourceEvidence } from "../../../game-data/src/character-mappings/ningguang-screen-mappings";
import { sourceClassifiedMappings } from "../../../game-data/src/classified-hits";
import { applyCharacterConstellationScope, applyNingguangBurstContext, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";

const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const ordinary=(doc:CalculatorDocument,index:number)=>doc.hits[index] as Extract<CalculatorHit,{kind:"ordinary"}>;
function example():CalculatorDocument {
  const doc=getCharacterDocuments("character:10000027",1).find(row=>row.gameContext?.skillId==="ningguang-burst-with-screen")!;
  if(doc.build.mode==="equipment-derived")throw Error("Expected editable final panel");
  doc.build.stats={atk:2000,hp:10000,def:800,em:0,critRate:.5,critDamage:1};
  return applyNingguangBurstContext(doc,{...doc.gameContext!.ningguangBurst!,screenSnapshot:{stats:{atk:1000,hp:12000,def:700,em:120,critRate:.2,critDamage:.5,energyRecharge:1.4},characterLevel:90,ascension:6,damageBonus:.3,additiveBaseDamage:0,reactionBonus:0,source:"可编辑教学条件：E 与 Q 两个时点不同的最终面板，不是游戏实测",sourceRefs:doc.hits[6]!.sourceRefs}});
}

describe("Ningguang complete screen burst with independent historical offense",()=>{
  it("checks retained source bytes, fifteen Q coefficients and the actual six plus six snapshot ownership",()=>{
    const evidence=ningguangScreenSourceEvidence,bytes=readFileSync(evidence.localArchivePath);
    expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive=JSON.parse(gunzipSync(bytes).toString()) as {revision:string;files:Record<string,string>};
    expect(archive.revision).toBe(evidence.revision);
    for(const [path,digest] of Object.entries(evidence.sourceSha256))expect(hash(archive.files[path]!)).toBe(digest);
    const values=archive.files["internal/characters/ningguang/zz_ningguang.dm.go"]!.match(/\bburst = \[\]float64\{([^}]+)\}/)![1]!.trim().split(",").map(value=>value.trim()).filter(Boolean).map(Number);
    const active=findTalentSetById("talent-set:ningguang")!.abilities.find(ability=>ability.key==="combat3")!.parameters.param1;
    expect(values).toHaveLength(15);expect(values).toEqual(active);expect(values).toEqual(evidence.coefficients[0]!.values);
    expect(ningguangScreenMappings).toHaveLength(2);
    for(const mapping of ningguangScreenMappings)expect(sourceClassifiedMappings.filter(row=>row.id===mapping.id)).toHaveLength(1);
    const burst=archive.files["internal/characters/ningguang/burst.go"]!,skill=archive.files["internal/characters/ningguang/skill.go"]!;
    expect(burst).toContain("jade = 6");expect(burst).toContain("screen = 6");
    expect(burst).toContain("c.Core.QueueAttack(ai, ap, 0,");
    expect(burst).toContain("c.Core.QueueAttackWithSnap(ai, c.skillSnapshot");
    expect(skill).toContain("c.skillSnapshot = c.Snapshot(&ai)");
    expect(burst).toContain("TODO: figure out jade screen hitmarks");
    expect(example().hits).toHaveLength(12);
    expect(example().gameContext!.scopeCoverage).toBe("complete-cast");
  });

  it("sums independently calculated Q and E groups, preserves selected single hits and separately accounts A4",()=>{
    let doc=example();let result=calculateDocument(doc);
    // T1 .8696, equal level defense .5, 10% resistance .9. Historical E has its own ATK/bonus/crit.
    expect(result.status).toBe("calculated");
    expect(result.hits[0]!.nonCritical).toBeCloseTo(782.64,10);expect(result.hits[0]!.expected).toBeCloseTo(1173.96,10);
    expect(result.hits[6]!.nonCritical).toBeCloseTo(508.716,10);expect(result.hits[6]!.expected).toBeCloseTo(559.5876,10);
    expect(result.totals!.nonCritical).toBeCloseTo(7748.136,9);expect(result.totals!.expected).toBeCloseTo(10401.2856,9);
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[6]!.id];
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(559.5876,10);
    doc=applyNingguangBurstContext(doc,{...doc.gameContext!.ningguangBurst!,screenA4Active:true});
    result=calculateDocument(doc);
    expect(result.totals!.expected).toBeCloseTo(1000*.8696*1.42*.5*.9*1.1,10);
    expect(result.hits[0]!.trace.find(node=>node.id==="customDamageBonus")!.result!.value).toBe(.12);
    const included=structuredClone(doc.gameContext!.ningguangBurst!);included.screenSnapshot!.damageBonus=.42;included.screenA4IncludedInBonus=true;
    expect(calculateDocument(applyNingguangBurstContext(doc,included)).totals!.expected).toBeCloseTo(result.totals!.expected,10);
    const missing=structuredClone(doc.gameContext!.ningguangBurst!);delete missing.screenSnapshot;
    doc=applyNingguangBurstContext(doc,missing);
    expect(calculateDocument(doc).status).toBe("blocked");
    doc.selectedHitIds=[doc.hits[0]!.id];
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(1173.96,10);
    doc=example();doc.gameContext!.constellation=6;
    expect(calculateDocument(applyCharacterConstellationScope(doc)).totals!.expected).toBeCloseTo(10401.2856,9);
    expect(doc.hits).toHaveLength(12); // C6 star jades belong to a later charged attack.
  });

  it("round-trips the complete snapshot and excludes unused current gear from historical hits and final conversion",()=>{
    let doc=example();
    doc.build={mode:"equipment-derived",characterBaseAtk:1000,weaponBaseAtk:1000,atkPercent:0,flatAtk:0,baseHp:10000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:500,critRate:.5,critDamage:1,
      equipment:{characterId:"character:10000027",weaponId:"conditioned-current-gear",level:90,ascension:6,weaponLevel:90,weaponAscension:6,refinement:1,sourceVersion:"explicit-condition-fixture",sourceRefs:["conditioned-current-gear"],derivedStats:[],secondaryContributions:[],assumptions:[],effectBlockers:[],weaponType:"catalyst",bonusAccounting:"core-sourced-v1",hitBonuses:[{id:"current-geo",value:.5,sourceRef:"conditioned-current-gear",label:"当前构筑条件增伤",elements:["geo"]}]}};
    const output=calculateDocument(doc);
    expect(output.hits[0]!.expected).toBeCloseTo(1173.96*1.5,10);
    expect(output.hits[6]!.expected).toBeCloseTo(559.5876,10);
    expect(output.hits[6]!.trace.some(node=>node.id==="equipmentBonus.0")).toBe(false);
    const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(ordinary(final,6).finalSnapshot).toEqual(ordinary(doc,6).finalSnapshot);
    expect(calculateDocument(final).totals).toEqual(output.totals);
    expect(calculateDocument(applyNingguangBurstContext(final,final.gameContext!.ningguangBurst!)).totals).toEqual(output.totals);
    expect(final.gameContext!.ningguangBurst).toEqual(doc.gameContext!.ningguangBurst);
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[6]!.id];
    if(doc.build.mode!=="equipment-derived")throw Error();
    doc.build.equipment!.pendingHitEffects=[{id:"unknown-current-gear",label:"当前装备缺失状态",reason:"没有当前条件",sourceRefs:["conditioned-current-gear"],kind:"additive-base"}];
    // A selected historical screen gem does not read an unresolved current gear branch.
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(559.5876,10);
    expect(calculateDocument(convertCalculatorToFinalPanel(doc)).totals!.expected).toBeCloseTo(559.5876,10);
    // Even an inconsistent current derived panel is not evaluated for a historical-only selection.
    doc.build.equipment!.derivedStats=[{id:"characterBaseAtk",label:"unused stale current base",base:99,curve:1,promotion:0,sourceRef:"conditioned-current-gear"}];
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(559.5876,10);
    doc.selectedHitIds=[doc.hits[0]!.id];doc.build.equipment!.derivedStats=[];
    expect(calculateDocument(doc).status).toBe("blocked");
  });
});
