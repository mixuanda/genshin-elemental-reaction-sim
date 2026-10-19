import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { weaponProcDefinitions, getWeaponProcDefinition } from "@genshin-dps-lab/reaction-formulas";
import { weaponProcSourceEvidence } from "../../../game-data/src/weapon-proc-definitions";
import { gameDataCatalog } from "../../../game-data/src/catalog";
import { createWeaponProcCalculatorDocument, getWeaponProcDocumentSelection } from "../weapon-proc-calculator";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { evaluateFormulaExpression, formatFormulaExpression } from "../calculation-trace";
const hash=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const independentCoefficients = {halberd:[1.6,2,2.4,2.8,3.2],ashgravendrinkinghorn:[.4,.5,.6,.7,.8],sequenceofsolitude:[.4,.5,.6,.7,.8]};

// This archived source bundle contains the original three weapons only.
const legacyWeaponProcDefinitions = weaponProcDefinitions.filter((definition): definition is (typeof weaponProcDefinitions)[number] & {weaponId: keyof typeof independentCoefficients} => definition.weaponId in independentCoefficients);

describe("independent sourced weapon proc calculator",()=>{
  it("archives pinned raw sources and matches every R1-R5 value across gcsim, catalog and production Optimizer sheets",()=>{
    const evidence=weaponProcSourceEvidence,bytes=readFileSync(evidence.localArchivePath);expect(hash(bytes)).toBe(evidence.localArchiveSha256);
    const archive=JSON.parse(gunzipSync(bytes).toString()) as {gcsimRevision:string;catalogRevision:string;files:Record<string,string>};
    expect(archive.gcsimRevision).toBe(evidence.gcsimRevision);expect(archive.catalogRevision).toBe(evidence.catalogRevision);
    for(const [path,sha] of Object.entries(evidence.sourceSha256))expect(hash(archive.files[path]!),path).toBe(sha);
    for(const file of evidence.optimizer.files){const raw=readFileSync(file.archivedPath);expect(hash(raw)).toBe(file.sha256);expect(createHash("sha1").update(`blob ${raw.length}\0`).update(raw).digest("hex")).toBe(file.gitBlobSha);expect(file.matchesPinnedTree).toBe(true);}
    for(const definition of legacyWeaponProcDefinitions){
      const record=evidence.weapons.find(row=>row.itemId===Number(definition.catalogWeaponId.split(":")[1]))!,go=archive.files[`gcsim/${record.sourcePath}`]!;
      const parts=go.match(/(?:dmg|hp) := ([\d.]+) \+ float64\(r\)\*([\d.]+)/)!;
      const sourceCoefficients=Array.from({length:5},(_,index)=>(Math.round(Number(parts[1])*100)+Math.round(Number(parts[2])*100)*(index+1))/100);
      expect(definition.coefficients).toEqual(sourceCoefficients);expect(record.coefficients).toEqual(sourceCoefficients);
      const rawCatalog=JSON.parse(archive.files[`genshin-db/${record.catalogPath}`]!) as Record<string,{values:string[]}>;
      const rawValues=Array.from({length:5},(_,index)=>parseFloat(rawCatalog[`r${index+1}`]!.values[0]!)/100);
      expect(definition.coefficients).toEqual(rawValues);
      expect(gameDataCatalog.weapons.find(row=>row.itemId===Number(definition.catalogWeaponId.split(":")[1]))!.refinements.map(row=>parseFloat(row.values[0]!)/100)).toEqual(sourceCoefficients);
      const optimizer=evidence.optimizer.sourceReview.weaponFindings.find(row=>row.weaponId===Number(definition.catalogWeaponId.split(":")[1]))!;
      expect(optimizer.coefficientByRefinement).toEqual(sourceCoefficients);expect(optimizer.scalingStat).toBe(definition.scalingStat);expect(optimizer.element).toBe("physical");
      const sheet=readFileSync(`packages/game-data/sources/weapon-procs/raw/optimizer/${optimizer.productionDefinition}`,"utf8");expect(sheet).toContain("customDmgNode");
      expect(go).toContain("attributes.Physical");expect(go).toContain("0, 1)");expect(getWeaponProcDefinition(definition.weaponId)).toBe(definition);
    }
  });

  it("executes each independent ATK/HP hit through editable final panels, immutable source coefficients, full trace and JSON",()=>{
    for(const definition of legacyWeaponProcDefinitions)for(let refinement=1;refinement<=5;refinement++){
      const doc=createWeaponProcCalculatorDocument({weaponId:definition.weaponId,refinement,characterLevel:80,build:{mode:"manual-final",stats:{atk:1200,hp:18000,def:700,em:99,critRate:.25,critDamage:1.2,energyRecharge:1.1},source:"可编辑教学面板；不是游戏实测"},enemy:{level:90,resistance:.2,defenseAdjustment:0,defenseIgnore:0},damageBonus:.35});
      const coefficient=independentCoefficients[definition.weaponId][refinement-1]!;
      const base=(definition.weaponId==="halberd"?1200:18000)*coefficient;
      const nonCritical=base*1.35*(180/370)*.8;
      const result=calculateDocument(doc);expect(result.hits).toHaveLength(1);expect(result.totals!.nonCritical).toBeCloseTo(nonCritical,9);expect(result.totals!.critical).toBeCloseTo(nonCritical*2.2,9);expect(result.totals!.expected).toBeCloseTo(nonCritical*1.3,9);
      const hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();expect(hit.element).toBe("physical");expect(hit.attackTag).toBe("proc");expect(hit.additiveBaseDamage).toBe(0);expect(hit.baseDamageFormula!.inputs[0]!.origin).toBe("source-table");expect(hit.baseDamageFormula!.inputs[0]!.allowedValues).toEqual([coefficient]);
      expect(getWeaponProcDocumentSelection(doc)).toEqual({weaponId:definition.weaponId,refinement});expect(doc.gameContext).toBeUndefined();expect(result).not.toHaveProperty("dps");
      for(const node of result.trace){if(!node.result)continue;const bindings=Object.fromEntries(node.inputs.map(input=>[input.key,input.value]));expect(node.result.value).toBe(evaluateFormulaExpression(node.expression,bindings));expect(node.substitution).toBe(formatFormulaExpression(node.expression,bindings));expect(node.symbolicFormula).toBeTruthy();expect(node.explanationKey).toBeTruthy();expect(node.inputs.every(input=>input.meaningKey&&input.unit&&input.origin)).toBe(true);}
      const restored=parseCalculatorDocument(serializeCalculatorDocument(doc));expect(calculateDocument(restored).totals).toEqual(result.totals);
      if(restored.build.mode==="equipment-derived")throw Error();restored.build.stats[definition.scalingStat]*=2;expect(calculateDocument(restored).totals!.expected).toBeCloseTo(nonCritical*1.3*2,9);
      const altered=structuredClone(doc);const alteredHit=altered.hits[0]!;if(alteredHit.kind!=="ordinary")throw Error();alteredHit.baseDamageFormula!.inputs[0]!.value=999;expect(()=>parseCalculatorDocument(JSON.stringify(altered))).toThrow(/numeric domain/);
    }
  });
});
