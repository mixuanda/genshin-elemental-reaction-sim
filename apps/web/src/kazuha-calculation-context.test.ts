import {describe,expect,it} from 'vitest';
import {getCharacterBuildPreset} from '../../../packages/game-data/src/character-build-presets';
import {resolveEquipmentBuild} from '../../../packages/game-data/src/equipment-build';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {prepareKazuhaBurstDocument} from '../../../packages/sim-core/src/kazuha-burst-formulas';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderSourceCastControls} from './calculator-source-cast-controls';

function fixture(absorbed=false):CalculatorDocument{
  const d=getCharacterDocuments('character:10000047',10).find(d=>d.gameContext?.skillId==='kazuha-burst-complete')!;
  d.build={mode:'manual-final',ascension:6,source:'Explicit Q10 fixed-source numerical case',stats:{atk:2000,hp:20000,def:800,em:9999,critRate:.5,critDamage:1}};
  for(const h of d.hits)if(h.kind==='ordinary')h.damageBonus=.466;
  Object.assign(d.gameContext!.kazuhaBurst!,{allHitsConnected:true,statsStableAcrossSnapshots:true,...(absorbed?{absorptionElement:'pyro',absorptionStartFrame:81,priorA4Active:true,priorSwirlNonExtraEm:800,includedA4DamageBonus:0,elementDamageBonuses:{pyro:.2}}:{absorptionElement:'none'})});
  return prepareKazuhaBurstDocument(d);
}
describe('Kazuha integrated direct Q output',()=>{
  it('preserves no-absorption Q and independently computed absorbed totals',()=>{
    const wind=calculateDocument(fixture()),early=calculateDocument(fixture(true));
    expect(wind.status).toBe('calculated');expect(wind.totals!.nonCritical).toBeCloseTo(20481.31008,9);
    expect(early.status).toBe('calculated');expect(early.totals!.nonCritical).toBeCloseTo(24913.63008,9);
    const late=fixture(true);late.gameContext!.kazuhaBurst!.absorptionStartFrame=369;
    expect(calculateDocument(late).totals!.nonCritical).toBeCloseTo(23140.70208,9);
    if(late.build.mode!=='manual-final')throw Error();late.build.stats.em=50000;
    expect(calculateDocument(late).totals!.nonCritical).toBeCloseTo(23140.70208,9);
  });
  it('keeps integer frame order, true owner and strict JSON without duplicating same-frame hits',()=>{
    const d=fixture(true),events=d.gameContext!.kazuhaBurst!.hitEvents!;
    expect(d.hits.map(h=>events[h.id]!.frame)).toEqual([82,140,140,257,257,374,374,491,491,608,608]);
    expect(d.hits.slice(1,3).map(h=>events[h.id]!.role)).toEqual(['absorbed-dot','anemo-dot']);
    expect(Object.values(events).every(e=>e.ownerId==='character:10000047')).toBe(true);
    const r=calculateDocument(d);expect(r.totals!.expected).toBeCloseTo(r.hits.reduce((n,h)=>n+h.expected!,0),9);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(d))).totals).toEqual(r.totals);
  });
  it('links unknown real absorption to the displayed control and blocks C2',()=>{
    const d=fixture();delete d.gameContext!.kazuhaBurst!.absorptionElement;
    const field=collectCalculatorRequirements(prepareKazuhaBurstDocument(d)).fields.find(f=>f.fieldPath==='gameContext.kazuhaBurst.absorptionElement')!;
    expect(field).toBeDefined();expect(renderSourceCastControls(d)).toContain('data-source-cast-enum-field="'+field.fieldPath+'"');
    expect(calculateDocument(d).status).toBe('blocked');d.gameContext!.kazuhaBurst!.absorptionElement='none';
    d.gameContext!.constellation=2;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('blocked');
  });
  it('captures legal plain equipment even with no EM adjustment, then preserves and protects snapshots',()=>{
    const d=fixture(true),preset=getCharacterBuildPreset('character:10000047','starter')!;
    d.build=resolveEquipmentBuild(structuredClone(preset.build)).build;
    for(const h of d.hits)if(h.kind==='ordinary')h.damageBonus=0;
    expect(d.hits.some(h=>h.kind==='ordinary'&&h.elementalMasteryAdjustment)).toBe(false);
    const before=calculateDocument(d);expect(before.status).toBe('calculated');
    const converted=convertCalculatorToFinalPanel(d);
    expect(converted.hits.every(h=>h.kind==='ordinary'&&h.finalSnapshot?.origin==='equipment-conversion')).toBe(true);
    expect(calculateDocument(converted).totals).toEqual(before.totals);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
    const changed=structuredClone(converted);changed.gameContext!.kazuhaBurst!.absorptionStartFrame=369;
    expect(calculateDocument(changed).status).toBe('blocked');
  });
});
