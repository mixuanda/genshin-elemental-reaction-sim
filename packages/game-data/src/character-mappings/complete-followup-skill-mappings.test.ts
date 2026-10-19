import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "../catalog";
import { sourceClassifiedMappings } from "../classified-hits";
import { completeFollowupSkillMappings, completeFollowupSkillSourceEvidence, replacedCompleteFollowupPartialMappingIds } from "./complete-followup-skill-mappings";
import { getCharacterDocuments, applyBaizhuSkillContext, applyCharacterConstellationScope } from "../../../../apps/web/src/character-calculations";
import { resetBaizhuPanelAccounting } from "../../../sim-core/src/baizhu-formulas";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../../../sim-core/src/calculator";
import { expr } from "../../../sim-core/src/calculation-trace";
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
function get(slug:string):CalculatorDocument {
  const character=gameDataCatalog.characters.find(row=>row.slug===slug)!;
  const id=completeFollowupSkillMappings.find(row=>row.characterSlug===slug)!.skillId;
  const doc=getCharacterDocuments(character.id,1).find(row=>row.gameContext?.skillId===id)!;
  if(doc.build.mode==="equipment-derived")throw Error("Expected manual example");
  doc.build.stats={atk:1000,hp:10000,def:800,em:0,critRate:.5,critDamage:1};
  return doc;
}
const ordinary=(doc:CalculatorDocument,index:number)=>doc.hits[index] as Extract<CalculatorHit,{kind:"ordinary"}>;
describe("complete source-backed followup E/Q casts",()=>{
  it("pins the gcsim and Optimizer source files, all ninety talent values and nonduplicated complete catalog actions",()=>{
    const evidence=completeFollowupSkillSourceEvidence,bytes=readFileSync(evidence.localArchivePath);
    expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive=JSON.parse(gunzipSync(bytes).toString()) as {revision:string;files:Record<string,string>};
    expect(archive.revision).toBe(evidence.revision);
    for(const [path,sha] of Object.entries(evidence.sourceSha256))expect(hash(archive.files[path]!),path).toBe(sha);
    for(const file of evidence.optimizer.files){
      const bytes=readFileSync(file.archivedPath);expect(hash(bytes),file.path).toBe(file.sha256);
      expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")).toBe(file.gitBlobSha);
      expect(file.matchesPinnedTree).toBe(true);
    }
    for(const row of evidence.coefficients){
      const code=archive.files[`internal/characters/${row.characterSlug}/zz_${row.characterSlug}.dm.go`]!;
      const values=code.match(new RegExp(`\\b${row.sourceTable} = \\[\\]float64\\{([^}]+)\\}`))![1]!.split(",").map(x=>x.trim()).filter(Boolean).map(Number);
      expect(values).toHaveLength(15);expect(row.values).toEqual(values);
      expect(findTalentSetById(`talent-set:${row.characterSlug}`)!.abilities.find(ability=>ability.key===row.abilityKey)!.parameters[row.parameterKey]).toEqual(values);
      const go=JSON.parse(readFileSync(`packages/game-data/sources/complete-followup-skills/raw/optimizer/libs/gi/stats/Data/Characters/${row.optimizerCharacter}/skillParam.json`,"utf8"));
      expect(go[row.abilityKey==="combat2"?"skill":"burst"][row.optimizerIndex]).toEqual(values);
    }
    expect(completeFollowupSkillMappings).toHaveLength(6);
    expect(completeFollowupSkillMappings.reduce((sum,row)=>sum+(row.instanceCount??1),0)).toBe(10);
    for(const mapping of completeFollowupSkillMappings)expect(sourceClassifiedMappings.filter(row=>row.id===mapping.id)).toHaveLength(1);
    expect(sourceClassifiedMappings.some(row=>replacedCompleteFollowupPartialMappingIds.has(row.id))).toBe(false);
    expect(archive.files["internal/characters/dori/dori.go"]).toContain("c.afterCount = 2");
    expect(archive.files["internal/characters/dori/skill.go"]).toContain("for i := 0; i < c.afterCount; i++");
    expect(archive.files["internal/characters/baizhu/skill.go"]).toContain("if count == 3");
    expect(archive.files["internal/characters/baizhu/skill.go"]).toContain("atk := *c.skillAtk");
    expect(archive.files["internal/characters/baizhu/asc.go"]).toMatch(/if c.Base.Ascension < 1/);
    expect(archive.files["internal/characters/baizhu/asc.go"]).toContain("active.CurrentHPRatio() >= 0.5");
    const goBaizhu=JSON.parse(readFileSync("packages/game-data/sources/complete-followup-skills/raw/optimizer/libs/gi/stats/Data/Characters/Baizhu/skillParam.json","utf8"));
    expect(goBaizhu.passive1[0][0]).toBe(.5);expect(goBaizhu.passive1[2][0]).toBe(.25);
    expect(archive.files["internal/characters/ganyu/skill.go"]).toContain("QueueAttackWithSnap(ai, snap, ap, 13");
    expect(archive.files["internal/characters/ganyu/skill.go"]).toContain("QueueAttackWithSnap(ai, snap, ap, 373");
    expect(archive.files["internal/characters/nilou/burst.go"]).toContain("burstAeonHitmark = 121");
  });

  it("executes each full cast using independent hand sums and keeps per-hit reaction and single-hit entrypoints",()=>{
    for(const [slug,count,nonCritical] of [["dori",3,946.8],["ganyu",2,1188],["nilou",2,1843.2]] as const){
      const doc=get(slug),result=calculateDocument(doc);
      expect(doc.gameContext!.scopeCoverage).toBe("complete-cast");expect(result.status,slug).toBe("calculated");
      expect(result.hits).toHaveLength(count);expect(result.totals!.nonCritical).toBeCloseTo(nonCritical,10);expect(result.totals!.expected).toBeCloseTo(nonCritical*1.5,10);
      const restored=parseCalculatorDocument(serializeCalculatorDocument(doc));expect(calculateDocument(restored).totals).toEqual(result.totals);
    }
    const nilou=get("nilou");ordinary(nilou,0).reaction="vaporize";
    let result=calculateDocument(nilou);
    expect(result.hits[0]!.nonCritical).toBeCloseTo(10000*.18432*.5*.9*2,10);
    expect(result.hits[1]!.nonCritical).toBeCloseTo(10000*.22528*.5*.9,10);
    expect(result.totals!.expected).toBeCloseTo(4008.96,10);
    nilou.scope="single-hit";nilou.selectedHitIds=[nilou.hits[1]!.id];
    result=calculateDocument(nilou);expect(result.totals!.expected).toBeCloseTo(1520.64,10);
    nilou.gameContext!.constellation=2;
    expect(calculateDocument(applyCharacterConstellationScope(nilou)).status).toBe("blocked");
  });

  it("requires Baizhu's real shared cast HP, applies the inclusive A1 threshold and preserves accounting through core JSON and gear conversion",()=>{
    let doc=get("baizhu");
    expect(doc.gameContext!.baizhuSkill!.activeHpRatioAtCast).toBeUndefined();
    expect(calculateDocument(doc).status).toBe("blocked");
    doc.gameContext!.ascension=0;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(1069.2,10);
    doc.gameContext!.ascension=1;
    expect(calculateDocument(doc).status).toBe("blocked");
    doc=applyBaizhuSkillContext(doc,{activeHpRatioAtCast:.499,a1IncludedInPanel:false});
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(1069.2,10);
    doc=applyBaizhuSkillContext(doc,{activeHpRatioAtCast:.5,a1IncludedInPanel:false});
    const before=calculateDocument(doc);expect(before.totals!.nonCritical).toBeCloseTo(1336.5,10);expect(before.totals!.expected).toBeCloseTo(2004.75,10);
    // Modify a serialized hit's formula: execution restores one cast-time condition to all three hits.
    ordinary(doc,1).damageBonusFormula!.expression=expr.value(99);
    const restored=parseCalculatorDocument(serializeCalculatorDocument(doc));
    expect(calculateDocument(restored).totals).toEqual(before.totals);
    for(const hit of restored.hits)if(hit.kind==="ordinary")hit.damageBonus=.25;
    doc=applyBaizhuSkillContext(restored,{activeHpRatioAtCast:.5,a1IncludedInPanel:true});
    expect(calculateDocument(doc).totals).toEqual(before.totals);
    resetBaizhuPanelAccounting(doc,"fresh-equipment");
    expect(doc.gameContext!.baizhuSkill).toEqual({activeHpRatioAtCast:.5,a1IncludedInPanel:false});
    for(const hit of doc.hits)if(hit.kind==="ordinary")hit.damageBonus=0;
    doc.build={mode:"equipment-derived",characterBaseAtk:500,weaponBaseAtk:500,atkPercent:0,flatAtk:0,baseHp:10000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};
    const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect(calculateDocument(final).totals).toEqual(before.totals);
    expect(final.gameContext!.baizhuSkill).toEqual(doc.gameContext!.baizhuSkill);
    const imported=get("baizhu");resetBaizhuPanelAccounting(imported,"imported-final");
    expect(calculateDocument(imported).status).toBe("blocked");
    const unknown=structuredClone(final);delete unknown.gameContext!.baizhuSkill!.activeHpRatioAtCast;
    expect(calculateDocument(unknown).status).toBe("blocked");
  });
});
