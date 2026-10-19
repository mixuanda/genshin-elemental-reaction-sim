import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "../catalog";
import { sourceClassifiedMappings } from "../classified-hits";
import { colleiCharlotteSkillMappings, colleiCharlotteSkillSourceEvidence, replacedColleiCharlottePartialMappingIds } from "./collei-charlotte-skill-mappings";
import { getCharacterDocuments, applyCharacterConstellationScope } from "../../../../apps/web/src/character-calculations";
import { applyColleiSkillContext, applyCharlotteSkillContext, resetCharlottePanelAccounting } from "../../../sim-core/src/collei-charlotte-formulas";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit, type CalculatorFinalSnapshot } from "../../../sim-core/src/calculator";
import { expr } from "../../../sim-core/src/calculation-trace";
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const ordinary=(doc:CalculatorDocument,index:number)=>doc.hits[index] as Extract<CalculatorHit,{kind:"ordinary"}>;
function get(slug:"collei"|"charlotte",skillId:string):CalculatorDocument {
  const id=gameDataCatalog.characters.find(row=>row.slug===slug)!.id;
  const doc=getCharacterDocuments(id,1).find(row=>row.gameContext!.skillId===skillId)!;
  if(doc.build.mode==="equipment-derived")throw Error();
  doc.build.stats={atk:1000,hp:10000,def:800,em:0,critRate:.5,critDamage:1};return doc;
}
const returned:CalculatorFinalSnapshot={stats:{atk:2000,hp:11000,def:750,em:50,critRate:.2,critDamage:.5,energyRecharge:1.2},characterLevel:90,ascension:6,damageBonus:.3,additiveBaseDamage:0,reactionBonus:0,source:"教学条件：实际回收时刻快照，独立于E释放面板",sourceRefs:["conditioned-return-snapshot"]};
describe("complete Collei and Charlotte skill scopes",()=>{
  it("pins both implementations, all seventy-five talent values, actual source tick boundaries and nonduplicated catalog mappings",()=>{
    const evidence=colleiCharlotteSkillSourceEvidence,bytes=readFileSync(evidence.localArchivePath);expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive=JSON.parse(gunzipSync(bytes).toString()) as {revision:string;files:Record<string,string>};expect(archive.revision).toBe(evidence.revision);
    for(const [path,sha] of Object.entries(evidence.sourceSha256))expect(hash(archive.files[path]!),path).toBe(sha);
    for(const file of evidence.optimizer.files){const bytes=readFileSync(file.archivedPath);expect(hash(bytes)).toBe(file.sha256);expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")).toBe(file.gitBlobSha);expect(file.matchesPinnedTree).toBe(true);}
    for(const row of evidence.coefficients){
      const code=archive.files[`internal/characters/${row.characterSlug}/zz_${row.characterSlug}.dm.go`]!;
      const values=code.match(new RegExp(`\\b${row.sourceTable} = \\[\\]float64\\{([^}]+)\\}`))![1]!.split(",").map(x=>x.trim()).filter(Boolean).map(Number);
      expect(values).toHaveLength(15);expect(row.values).toEqual(values);expect(findTalentSetById(`talent-set:${row.characterSlug}`)!.abilities.find(ability=>ability.key==="combat2")!.parameters[row.parameterKey]).toEqual(values);
      const character=row.characterSlug==="collei"?"Collei":"Charlotte",params=JSON.parse(readFileSync(`packages/game-data/sources/collei-charlotte-skills/raw/optimizer/libs/gi/stats/Data/Characters/${character}/skillParam.json`,"utf8"));expect(params.skill[row.optimizerIndex]).toEqual(values);
    }
    expect(colleiCharlotteSkillMappings).toHaveLength(9);expect(colleiCharlotteSkillMappings.reduce((sum,row)=>sum+(row.instanceCount??1),0)).toBe(26);
    for(const mapping of colleiCharlotteSkillMappings)expect(sourceClassifiedMappings.filter(row=>row.id===mapping.id)).toHaveLength(1);
    expect(sourceClassifiedMappings.some(row=>replacedColleiCharlottePartialMappingIds.has(row.id))).toBe(false);
    const collei=archive.files["internal/characters/collei/asc.go"]!,skill=archive.files["internal/characters/collei/skill.go"]!;
    expect(collei).toContain("sproutHitmark    = 86");expect(collei).toContain("sproutTickPeriod = 89");expect(skill).toContain("duration := 180");expect(skill).toContain("duration += 180");expect(skill).toContain("snap := c.Snapshot(&ai)");
    expect([86,175,264,353].filter(frame=>frame<180)).toHaveLength(2);expect([86,175,264,353].filter(frame=>frame<360)).toHaveLength(4);
    const charlotte=archive.files["internal/characters/charlotte/skill.go"]!;expect(charlotte).toContain("360+0.8*60");expect(charlotte).toContain("720+0.9*60");expect(charlotte).toContain("1.5*60");
    const colleiParams=JSON.parse(readFileSync("packages/game-data/sources/collei-charlotte-skills/raw/optimizer/libs/gi/stats/Data/Characters/Collei/skillParam.json","utf8"));expect(colleiParams.passive1[1][0]).toBe(.4);expect(colleiParams.constellation2).toEqual([3,.4,3]);
    const charlotteParams=JSON.parse(readFileSync("packages/game-data/sources/collei-charlotte-skills/raw/optimizer/libs/gi/stats/Data/Characters/Charlotte/skillParam.json","utf8"));expect(charlotteParams.passive2[1][0]).toBe(.05);
  });

  it("keeps Collei's release and return snapshots independent and blocks contradictory no-sprout full casts",()=>{
    let doc=get("collei","collei-skill-no-sprout-complete");expect(calculateDocument(doc).status).toBe("blocked");
    doc=applyColleiSkillContext(doc,{reactionBeforeReturn:false});expect(calculateDocument(doc).totals!.expected).toBeCloseTo(2041.2,9);
    ordinary(doc,0).additiveReaction="spread";expect(calculateDocument(doc).blockers.join(" ")).toContain("Spread");
    doc=get("collei","collei-skill-sprout-complete");doc=applyColleiSkillContext(doc,{reactionBeforeReturn:true,sproutUninterrupted:true});expect(calculateDocument(doc).status).toBe("blocked");
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[0]!.id];expect(calculateDocument(doc).totals!.expected).toBeCloseTo(1020.6,9);
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc=applyColleiSkillContext(doc,{...doc.gameContext!.colleiSkill!,sproutSnapshot:returned});
    let output=calculateDocument(doc);expect(output.totals!.nonCritical).toBeCloseTo(2296.8,9);expect(output.totals!.expected).toBeCloseTo(3070.8,9);expect(output.hits[2]!.expected).toBeCloseTo(514.8,9);
    const json=parseCalculatorDocument(serializeCalculatorDocument(doc));expect(calculateDocument(json).totals).toEqual(output.totals);
    doc.build={mode:"equipment-derived",characterBaseAtk:500,weaponBaseAtk:500,atkPercent:0,flatAtk:0,baseHp:10000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};
    output=calculateDocument(doc);const final=convertCalculatorToFinalPanel(doc);expect(calculateDocument(final).totals).toEqual(output.totals);expect(ordinary(final,2).finalSnapshot).toEqual(returned);
    ordinary(final,2).finalSnapshot!.stats.atk=9999;expect(calculateDocument(final).totals).toEqual(output.totals); // canonical context restores the actual return snapshot
    let spread=structuredClone(doc);spread.scope="single-hit";spread.selectedHitIds=[spread.hits[2]!.id];ordinary(spread,2).additiveReaction="spread";
    expect(calculateDocument(spread).blockers.join(" ")).toContain("命中时");
    spread=applyColleiSkillContext(spread,{...spread.gameContext!.colleiSkill!,reactionStatsMatchSnapshots:true});
    expect(calculateDocument(spread).totals!.expected).toBeCloseTo((800+1446.8535*1.25*(1+5*50/(1200+50)))*1.3*.5*.9*1.1,9);
  });

  it("implements C2 guaranteed sprout and one extension, while preserving low-ascension and C6 scope boundaries",()=>{
    let doc=get("collei","collei-skill-extended-sprout-complete");doc.gameContext!.constellation=2;
    doc=applyCharacterConstellationScope(applyColleiSkillContext(doc,{reactionDuringSprout:true,sproutUninterrupted:true,sproutSnapshot:returned}));
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(4100.4,9); // known extension does not depend on an unused earlier reaction flag
    doc=applyColleiSkillContext(doc,{...doc.gameContext!.colleiSkill!,reactionBeforeReturn:false,reactionDuringSprout:false});expect(calculateDocument(doc).status).toBe("blocked");
    doc=get("collei","collei-skill-sprout-complete");doc.gameContext!.constellation=2;doc=applyCharacterConstellationScope(applyColleiSkillContext(doc,{reactionBeforeReturn:false,reactionDuringSprout:false,sproutUninterrupted:true,sproutSnapshot:returned}));
    expect(calculateDocument(doc).totals!.expected).toBeCloseTo(3070.8,9);
    ordinary(doc,2).additiveReaction="spread";expect(calculateDocument(doc).blockers.join(" ")).toContain("Spread");
    doc.gameContext!.constellation=6;expect(calculateDocument(applyCharacterConstellationScope(doc)).status).toBe("blocked");
    doc=get("collei","collei-skill-no-sprout-complete");doc.gameContext!.ascension=0;expect(calculateDocument(doc).totals!.expected).toBeCloseTo(2041.2,9);
  });

  it("executes Charlotte's four/eight marks and real A4 roster count with missing-input and final-panel accounting",()=>{
    for(const [branch,base] of [["press",1008],["hold",2088]] as const){
      let doc=get("charlotte",`charlotte-skill-${branch}-complete`);expect(calculateDocument(doc).status).toBe("blocked");
      doc=applyCharlotteSkillContext(doc,{nonFontaineTeammates:2,a4IncludedInPanel:false,markUninterrupted:true,statsStableAcrossHits:true});let output=calculateDocument(doc);
      expect(output.hits).toHaveLength(branch==="press"?5:9);expect(output.totals!.nonCritical).toBeCloseTo(base*1.1,9);expect(output.totals!.expected).toBeCloseTo(base*1.1*1.5,9);
      ordinary(doc,0).damageBonusFormula!.expression=expr.value(99);expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).totals).toEqual(output.totals);
      for(const hit of doc.hits)if(hit.kind==="ordinary")hit.damageBonus=.1;
      doc=applyCharlotteSkillContext(doc,{...doc.gameContext!.charlotteSkill!,a4IncludedInPanel:true});expect(calculateDocument(doc).totals).toEqual(output.totals);
      resetCharlottePanelAccounting(doc,"fresh-equipment");expect(doc.gameContext!.charlotteSkill!.a4IncludedInPanel).toBe(false);
      for(const hit of doc.hits)if(hit.kind==="ordinary")hit.damageBonus=0;
      doc.build={mode:"equipment-derived",characterBaseAtk:500,weaponBaseAtk:500,atkPercent:0,flatAtk:0,baseHp:10000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};
      const final=convertCalculatorToFinalPanel(doc);expect(calculateDocument(final).totals).toEqual(output.totals);
      doc.gameContext!.constellation=2;expect(calculateDocument(applyCharacterConstellationScope(doc)).status).toBe("blocked");
    }
    const doc=get("charlotte","charlotte-skill-press-complete");doc.gameContext!.ascension=3;doc.scope="single-hit";doc.selectedHitIds=[doc.hits[0]!.id];
    resetCharlottePanelAccounting(doc,"imported-final");expect(doc.gameContext!.charlotteSkill!.a4IncludedInPanel).toBe(false);expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(302.4,9);
    doc.gameContext!.ascension=4;resetCharlottePanelAccounting(doc,"imported-final");expect(doc.gameContext!.charlotteSkill!.a4IncludedInPanel).toBe(true);
    delete doc.gameContext!.ascension;resetCharlottePanelAccounting(doc,"imported-final");expect(doc.gameContext!.charlotteSkill!.a4IncludedInPanel).toBe(true);expect(calculateDocument(doc).blockers.join(" ")).toContain("突破");
  });
});
