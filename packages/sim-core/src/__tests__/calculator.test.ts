import { describe,it,expect } from "vitest";
import { calculateDocument,resolveCalculatorStats,parseCalculatorDocument,serializeCalculatorDocument, type CalculatorDocument } from "../calculator";
import { loadWorkedExample,WORKED_EXAMPLES } from "../worked-examples";
import { calcDamage,calcTransformativeReactionDamage,calcAdditiveReactionDamage, type DamageCalculationInput } from "../formulas";
import {calculateDamageTrace,calculateTransformativeDamageTrace,executeAdditiveDamage} from "../calculator-formula";
import {evaluateFormulaExpression,formatFormulaExpression} from "../calculation-trace";
import {calculatorTraceText} from "../calculator-text";
const tolerance=1e-9;
const close=(actual:number|undefined,expected:number)=>expect(Math.abs(actual!-expected)).toBeLessThanOrEqual(tolerance);
const exampleA=()=>loadWorkedExample("fixture-a");
const value=(result:ReturnType<typeof calculateDocument>,id:string)=>result.trace.find(n=>n.id===id)?.result?.value;
describe("calculator correctness fixtures (not legacy-reproduction golden values)",()=>{
 it("fixture A executes every required intermediate and three output modes",()=>{
   const result=calculateDocument(exampleA());
   for(const [id,expected] of Object.entries({"build.baseAtk":1000,"build.finalAtk":2000,"hit-a.talentDamage":4000,"hit-a.baseDamage":4300,"hit-a.afterBonus":6450,"hit-a.defenseMultiplier":.5,"hit-a.afterDefense":3225,"hit-a.resistanceMultiplier":.9,"hit-a.afterResistance":2902.5,"hit-a.afterReaction":2902.5,"hit-a.finalDamage":2902.5,"hit-a.critical.criticalMultiplier":2.2,"hit-a.critical.finalDamage":6385.5,"hit-a.expected.expectedMultiplier":1.84,"hit-a.expected.finalDamage":5340.6,"hit-a.weightedVerification":5340.6}))close(value(result,id),expected);
   expect(result.totals).toBeDefined();close(result.totals!.expected,5340.6);expect(result.verification).toBe("synthetic");
 });
 it("fixture B evaluates each hit and keeps the incorrect shortcut out of totals",()=>{
   const result=calculateDocument(loadWorkedExample("fixture-b"));
   close(result.hits[0]?.expected,2760);close(result.hits[1]?.expected,1104);close(result.totals?.expected,3864);
   close(result.counterexample?.incorrect,4416);close(result.counterexample?.overstatement,552);
   expect(result.trace.some(n=>n.id.startsWith("counterexample"))).toBe(false);expect(result).not.toHaveProperty("dps");
 });
 it("editing fixture inputs recomputes every dependency and preserves previous immutable result",()=>{
   const doc=exampleA();const before=calculateDocument(doc);if(doc.build.mode!=="equipment-derived")throw Error();doc.build.flatAtk=400;
   const after=calculateDocument(doc);close(value(after,"build.finalAtk"),2200);close(value(after,"hit-a.talentDamage"),4400);expect(after.totals?.expected).toBeGreaterThan(before.totals!.expected);
   close(value(before,"build.finalAtk"),2000);expect(after.trace.find(n=>n.id==="build.finalAtk")?.substitution).toContain("400");
 });
 it("all displayed substitutions and results are generated from executed expressions",()=>{
   for(const example of WORKED_EXAMPLES.filter(e=>e.document))for(const node of calculateDocument(example.document!).trace){
     if(!node.result)continue;const inputs=Object.fromEntries(node.inputs.map(i=>[i.key,i.value]));
     expect(node.result.value).toBe(evaluateFormulaExpression(node.expression,inputs));expect(node.symbolicFormula).toBe(formatFormulaExpression(node.expression));expect(node.substitution).toBe(formatFormulaExpression(node.expression,inputs));
     expect(node.inputs.every(i=>i.unit&&i.origin&&i.meaningKey)).toBe(true);
   }
 });
 it("each recorded dependency resolves to a node in the exported trace",()=>{
   const result=calculateDocument(exampleA());const ids=new Set(result.trace.map(n=>n.id));
   for(const node of result.trace)for(const id of node.childIds)expect(ids.has(id)).toBe(true);
 });
 it("manual and imported final stats do not receive equipment bonuses twice",()=>{
   const derived=exampleA();const stats=resolveCalculatorStats(derived.build);const original=calculateDocument(derived);
   for(const mode of ["manual-final","imported-final"] as const){const doc=exampleA();doc.build={mode,stats,source:"test public showcase / supplied final panel"};const result=calculateDocument(doc);expect(result.totals).toEqual(original.totals);expect(result.trace.some(n=>n.id==="build.baseAtk")).toBe(false);expect(result.warnings.join()).toContain("不重复");}
 });
 it("rejects extra equipment fields attached to a final panel",()=>{
   const doc=exampleA();doc.build={mode:"imported-final",stats:resolveCalculatorStats(doc.build),source:"mock",weaponBaseAtk:700} as never;
   expect(()=>calculateDocument(doc)).toThrow();
 });
 it("selected hit remains available while unrelated rotation is missing, without trusting dataset-name claims",()=>{
   const doc=exampleA();doc.dataIdentity={datasetId:"test-known-coefficient",gameVersion:"test",releaseStatus:"released",evidenceStatus:"verified"};
   doc.dependencies=[{id:"selected.coefficient",status:"verified",reason:"test coefficient",sourceRefs:["test"]},{id:"rotation",status:"missing",reason:"timing unavailable",sourceRefs:[]}];doc.hits[0]!.dependencies=["selected.coefficient"];
   expect(calculateDocument(doc).verification).toBe("provisional");
   const result=calculateDocument(doc,{trustedVerifiedDatasetIds:["test-known-coefficient"]});expect(result.status).toBe("calculated");expect(result.verification).toBe("provisional");
   doc.hits[0]!.dependencies.push("rotation");const blocked=calculateDocument(doc);expect(blocked.status).toBe("blocked");expect(blocked.totals).toBeUndefined();expect(blocked.blockers.join()).toContain("timing unavailable");
 });
 it("missing dependency records and missing coefficients never become zero",()=>{
   const doc=exampleA();doc.hits[0]!.dependencies=["unknown.coefficient"];expect(calculateDocument(doc).status).toBe("blocked");
   const invalid=exampleA();delete (invalid.hits[0] as unknown as {terms?:unknown}).terms;expect(()=>calculateDocument(invalid)).toThrow();
 });
 it("aggregates exactly the selected instances and prevents duplicate inclusions",()=>{
   const doc=loadWorkedExample("fixture-b");doc.selectedHitIds=["hit-b"];const result=calculateDocument(doc);close(result.totals?.expected,1104);expect(result.excludedHitIds).toEqual(["hit-a"]);
   doc.selectedHitIds=["hit-b","hit-b"];expect(()=>calculateDocument(doc)).toThrow(/unique/);
 });
 it("conditioned amplification requires compatible damage element",()=>{
   const doc=loadWorkedExample("amplification");const hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();hit.element="physical";
   const result=calculateDocument(doc);expect(result.status).toBe("blocked");expect(result.blockers.join()).toContain("pyro");
 });
 it("non-damaging events do not fabricate a numerical damage result",()=>{
   const result=calculateDocument(loadWorkedExample("non-damaging"));expect(result.hits[0]?.status).toBe("non-damaging");expect(result.hits[0]?.expected).toBeUndefined();expect(result.totals).toBeUndefined();
 });
 it("ineligible critical and excluded ordinary modifiers have explicit explanations",()=>{
   const doc=exampleA();const hit=doc.hits[0]!;if(hit.kind!=="ordinary")throw Error();hit.critEligible=false;hit.excludedModifiers=[{label:"火元素加成",reason:"这是物理伤害"}];
   const result=calculateDocument(doc);expect(result.totals?.critical).toBe(result.totals?.nonCritical);expect(result.totals?.expected).toBe(result.totals?.nonCritical);expect(result.trace.some(n=>n.applicabilityReason?.includes("物理伤害"))).toBe(true);
 });
 it("transformative damage excludes DEF, normal bonus and crit despite changed inputs",()=>{
   const doc=loadWorkedExample("transformative");const before=calculateDocument(doc);doc.enemy.level=999;doc.enemy.defenseIgnore=1;if(doc.build.mode!=="equipment-derived")throw Error();doc.build.critDamage=10;doc.build.critRate=1;doc.build.flatAtk=99999;
   const after=calculateDocument(doc);expect(after.totals).toEqual(before.totals);expect(after.totals?.critical).toBe(after.totals?.nonCritical);expect(after.trace.some(n=>n.id.endsWith("transformativeExclusions"))).toBe(true);
 });
 it.each(["hp-scaling","def-scaling","mixed-scaling","amplification","additive","transformative"])("provides an editable complete example for %s",id=>{
   const doc=loadWorkedExample(id);expect(calculateDocument(doc).totals?.expected).toBeGreaterThan(0);expect(doc.dataIdentity.releaseStatus).toBe("synthetic");
 });
 it("keeps unknown Lunar/Stellar game examples blocked, not fake coefficients",()=>{
   for(const entry of WORKED_EXAMPLES.filter(e=>e.category==="blocked")){expect(entry.document).toBeUndefined();expect(entry.blockedReasons.length).toBeGreaterThan(0);expect(()=>loadWorkedExample(entry.id)).toThrow();}
 });
 it("roundtrips strict scope inputs assumptions version identity and outputs",()=>{
   const doc=loadWorkedExample("fixture-b");const restored=parseCalculatorDocument(serializeCalculatorDocument(doc));expect(restored).toEqual(doc);expect(calculateDocument(restored)).toEqual(calculateDocument(doc));
   for(const patch of [{ruleVersion:"unknown"},{schemaVersion:"2.0.0"},{hiddenMultiplier:2}])expect(()=>parseCalculatorDocument(JSON.stringify({...doc,...patch}))).toThrow();
 });
 it("prevents synthetic and preview identity from becoming verified released calculations",()=>{
   const doc=exampleA();doc.dataIdentity.evidenceStatus="verified";expect(()=>calculateDocument(doc)).toThrow(/Synthetic/);
   doc.dataIdentity={datasetId:"preview",gameVersion:"future",releaseStatus:"preview",evidenceStatus:"verified"};expect(calculateDocument(doc).verification).toBe("provisional");
 });
 it("legacy DEF compatibility below source-confirmed cap cannot be verified",()=>{
   const doc=exampleA();doc.dataIdentity={datasetId:"test",gameVersion:"test",releaseStatus:"released",evidenceStatus:"verified"};doc.enemy.defenseAdjustment=-1;const result=calculateDocument(doc);expect(result.verification).toBe("provisional");expect(result.warnings.join()).toContain("-90%");
 });
 it("UI explanation keys resolve to Chinese text rather than opaque formula keys",()=>{
   for(const node of calculateDocument(exampleA()).trace){expect(calculatorTraceText(node.titleKey)).not.toMatch(/^stage\./);expect(calculatorTraceText(node.explanationKey)).not.toMatch(/^explain\./);}
 });
});
describe("simulator and calculator share executed formula graphs",()=>{
 const input:DamageCalculationInput={scaling:2.53,scalingStat:"atk",scalingValue:2133.817,flatDamage:316.824,damageBonus:.714,characterLevel:90,enemyLevel:103,defenseReduction:-.25,defenseIgnore:.11,effectiveResistance:-.2,critRate:.73,critDamage:1.64,critMode:"average",reaction:"reverseVaporize",elementalMastery:187,reactionBonus:.15,groupMultiplier:.7};
 it.each(["noCrit","allCrit","average"] as const)("matches ordinary %s bit-for-bit",critMode=>{const context={...input,critMode};const traced=calculateDamageTrace(context);expect(calcDamage(context)).toEqual({finalDamage:traced.finalDamage,factors:traced.factors});});
 it("matches transformative and additive shared arithmetic exactly",()=>{
   const t={characterLevel:90,elementalMastery:187,reactionBonus:.15,baseMultiplier:2.75,effectiveResistance:.1};const {trace,...traced}=calculateTransformativeDamageTrace(t);expect(calcTransformativeReactionDamage(t)).toEqual(traced);expect(trace.length).toBeGreaterThan(2);
   const a={reaction:"aggravate" as const,characterLevel:90,elementalMastery:187,reactionBonus:.15};const {trace:at,...ar}=executeAdditiveDamage(a,true);expect(calcAdditiveReactionDamage(a)).toEqual(ar);expect(at.length).toBeGreaterThan(0);
 });
});
