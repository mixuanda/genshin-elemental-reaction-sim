import { describe,it,expect } from "vitest";
import { resolveEquipmentBuild } from "../../../game-data/src/equipment-build";
import type { ArtifactPieceInput } from "../../../game-data/src/artifact-build";
import { calculateDocument,resolveCalculatorStats,convertCalculatorToFinalPanel,parseCalculatorDocument,serializeCalculatorDocument } from "../calculator";
import { loadWorkedExample } from "../worked-examples";
import { GAME_WORKED_EXAMPLE_INPUTS,GAME_WORKED_EXAMPLE_EXPECTATIONS } from "../game-worked-example-inputs";

function exampleArtifacts(setId='artifact-set:15001'):ArtifactPieceInput[] {
  return (['flower','plume','sands','goblet'] as const).map(slot=>({slot,setId,rarity:5,level:0,mainStat:slot==='flower'?'hp':slot==='plume'?'atk':slot==='sands'?'hp_':'cryo_dmg_',initialSubstats:3,substats:[{stat:'critRate_',rolls:[3]},{stat:'critDMG_',rolls:[3]},{stat:'atk_',rolls:[3]}]}));
}
function equippedExample() {
  const artifacts=exampleArtifacts();
  const equipment=resolveEquipmentBuild({characterId:'character:10000002',weaponId:'weapon:11101',level:1,ascension:0,weaponLevel:1,weaponAscension:0,refinement:1,effectsDisabled:true,setEffectsEnabled:true,artifacts});
  const doc=loadWorkedExample('fixture-a');doc.characterLevel=1;doc.enemy.level=1;doc.build=equipment.build;
  const hit=doc.hits[0]!;if(hit.kind!=='ordinary')throw Error();hit.element='cryo';hit.attackTag='normal';hit.damageBonus=0;hit.additiveBaseDamage=0;
  return doc;
}

describe('equipment and explicit resource formulas in the shared calculator',()=>{
 it('executes source stat sums and applies a four-piece bonus only to its allowed attack',()=>{
   const doc=equippedExample();const normal=calculateDocument(doc);const hit=doc.hits[0]!;if(hit.kind!=='ordinary')throw Error();hit.attackTag='skill';const skill=calculateDocument(doc);
   expect(normal.trace.find(node=>node.id==='build.source.FIGHT_PROP_ATTACK_PERCENT')?.result?.value).toBeCloseTo(.18+4*.0583,12);
   expect(normal.hits[0]?.trace.find(node=>node.id==='applicableDamageBonus')?.result?.value).toBeCloseTo(.35+.07,12);
   expect(skill.hits[0]?.trace.find(node=>node.id==='applicableDamageBonus')?.result?.value).toBeCloseTo(.07,12);
   expect(skill.hits[0]?.trace.some(node=>node.status==='not-applicable'&&node.applicabilityReason?.includes('normal'))).toBe(true);
   expect(normal.totals!.expected/skill.totals!.expected).toBeCloseTo(1.42/1.07,12);
 });
 it('preserves artifact/effect context and matches an equivalent imported final panel without doublecount',()=>{
   const doc=equippedExample();const restored=parseCalculatorDocument(serializeCalculatorDocument(doc));expect(restored).toEqual(doc);
   const derived=calculateDocument(restored);restored.build={mode:'imported-final',source:'explicit final panel for the same single-hit comparison',stats:resolveCalculatorStats(restored.build)};
   const hit=restored.hits[0]!;if(hit.kind!=='ordinary')throw Error();hit.damageBonus=.35+.07;
   expect(calculateDocument(restored).totals).toEqual(derived.totals);
 });
 it('preserves the old serialized equipment bonus convention during migration',()=>{
   const doc=equippedExample();const current=calculateDocument(doc);if(doc.build.mode!=='equipment-derived'||!doc.build.equipment)throw Error();delete doc.build.equipment.bonusAccounting;
   const hit=doc.hits[0]!;if(hit.kind!=='ordinary')throw Error();hit.damageBonus=.07;
   const restored=calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc)));expect(restored.totals).toEqual(current.totals);expect(restored.warnings.join()).toContain('旧版装备文档兼容模式');
 });
 it('executes editable resources, teammate ownership, caps and conditions from a typed expression',()=>{
   const doc=loadWorkedExample('resource-expression');const hit=doc.hits[0]!;if(hit.kind!=='ordinary'||!hit.baseDamageFormula)throw Error();
   const base=()=>calculateDocument(doc).hits[0]!.trace.find(node=>node.id==='customBaseDamage')!;
   expect(base().result?.value).toBe(3200);expect(base().inputs.find(i=>i.key==='teammateAtk')?.context?.ownerId).toBe('synthetic-teammate');
   hit.baseDamageFormula.inputs.find(i=>i.key==='stacks')!.value=5;expect(base().result?.value).toBe(3300);
   hit.baseDamageFormula.inputs.find(i=>i.key==='resource')!.value=0;expect(calculateDocument(doc).totals?.expected).toBe(0);
 });
 it('matches independent Decimal calculations for the two source-backed game examples',()=>{
   for(const doc of GAME_WORKED_EXAMPLE_INPUTS){const result=calculateDocument(doc);const expected=GAME_WORKED_EXAMPLE_EXPECTATIONS[doc.id as keyof typeof GAME_WORKED_EXAMPLE_EXPECTATIONS];
     expect(result.verification).toBe('provisional');for(const mode of ['nonCritical','critical','expected'] as const)expect(result.totals![mode]).toBeCloseTo(expected[mode],11);
   }
 });
 it('executes Homa HP before its two ATK conversions and preserves locked passive context in final panels',()=>{
   const equipment=resolveEquipmentBuild({characterId:'character:10000023',weaponId:'weapon:13501',level:1,ascension:0,weaponLevel:1,weaponAscension:0,refinement:1,effectsDisabled:true,weaponEffectsEnabled:true,effectContext:{hpFraction:.4}});
   const doc=loadWorkedExample('fixture-a');doc.build=equipment.build;doc.characterLevel=1;
   const hit=doc.hits[0]!;if(hit.kind!=='ordinary')throw Error();hit.terms.push({stat:'hp',coefficient:.33,minimumAscension:4});
   const panel=resolveCalculatorStats(doc.build),calculation=calculateDocument(doc);
   expect(panel.hp).toBeCloseTo(equipment.build.baseHp*1.2,10);
   expect(panel.atk).toBeCloseTo(equipment.build.characterBaseAtk+equipment.build.weaponBaseAtk+panel.hp*.018,10);
   expect(calculation.trace.find(node=>node.id==='build.preConversion.hp')?.result?.value).toBe(panel.hp);
   expect(calculation.hits[0]?.trace.find(node=>node.id==='scaling.1')?.status).toBe('not-applicable');
   const final=parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
   expect(final.build.mode!=='equipment-derived'&&final.build.ascension).toBe(0);
   expect(calculateDocument(final).totals).toEqual(calculation.totals);
 });
 it('keeps Xiphos converted ER out of Emblem while retaining it in the final panel and JSON',()=>{
   const doc=equippedExample(),artifacts=exampleArtifacts('artifact-set:15020');
   const context={timedEffectActive:true,timedSnapshotEm:1000};
   const equipment=resolveEquipmentBuild({characterId:'character:10000015',weaponId:'weapon:11418',level:1,ascension:0,weaponLevel:1,weaponAscension:0,refinement:1,effectsDisabled:true,weaponEffectsEnabled:true,setEffectsEnabled:true,effectContext:context,artifacts});
   doc.build=equipment.build;const hit=doc.hits[0]!;if(hit.kind!=='ordinary')throw Error();hit.attackTag='burst';
   const restored=parseCalculatorDocument(serializeCalculatorDocument(doc));expect(restored).toEqual(doc);
   const output=calculateDocument(restored),panel=resolveCalculatorStats(restored.build);
   expect(panel.energyRecharge).toBeCloseTo(1.56,12);
   expect(output.trace.find(node=>node.id==='build.preConversion.erRatio')?.result?.value).toBeCloseTo(1.2,12);
   expect(output.hits[0]?.trace.find(node=>node.id==='applicableDamageBonus')?.result?.value).toBeCloseTo(.3+.07,12);
   expect(calculateDocument(convertCalculatorToFinalPanel(restored,'imported-final')).totals).toEqual(output.totals);
   hit.attackTag='skill';expect(calculateDocument(doc).hits[0]?.trace.find(node=>node.id==='applicableDamageBonus')?.result?.value).toBeCloseTo(.07,12);
 });
});
