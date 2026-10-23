import {describe,expect,it} from 'vitest';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderSourceCastControls} from './calculator-source-cast-controls';

function cannon():CalculatorDocument{
  const doc=getCharacterDocuments('character:10000101',10).find(d=>d.gameContext?.skillId==='kinich-scalespiker-cannon')!;
  doc.gameContext!.constellation=1;
  doc.build={mode:'manual-final',ascension:6,source:'Explicit independent numerical case, not player equipment',stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1}};
  Object.assign(doc.gameContext!.kinichDamage!,{nightsoulBlessingActive:true,cannonPointsBeforeUse:20,a4Stacks:2,a4CreationAttack:1800});
  return doc;
}
describe('Kinich integrated schema, formula and condition controls',()=>{
  it('registers E mappings exactly once and keeps the old base charged attack',()=>{
    const docs=getCharacterDocuments('character:10000101',10);
    for(const id of ['kinich-loop-shot-single','kinich-loop-shot-pair','kinich-scalespiker-cannon'])expect(docs.filter(d=>d.gameContext?.skillId===id)).toHaveLength(1);
    expect(docs.some(d=>d.gameContext?.skillId==='kinich-charged-base')).toBe(true);
  });
  it('executes C1 and creation-time A4 through the shared calculator and strict JSON parser',()=>{
    const doc=applyCharacterConstellationScope(cannon());
    const r=calculateDocument(doc);expect(r.status).toBe('calculated');
    const nonCritical=(2000*12.37392+3.2*2*1800)*.5*.9;
    expect(r.totals!.nonCritical).toBeCloseTo(nonCritical,9);expect(r.totals!.expected).toBeCloseTo(nonCritical*(1+.5*2),9);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).totals).toEqual(r.totals);
  });
  it('links the missing actual state to a working control and rejects insufficient points',()=>{
    const doc=cannon();delete doc.gameContext!.kinichDamage!.nightsoulBlessingActive;
    const fields=collectCalculatorRequirements(applyCharacterConstellationScope(doc)).fields;
    const required=fields.find(f=>f.fieldPath==='gameContext.kinichDamage.nightsoulBlessingActive')!;
    expect(required).toBeDefined();expect(renderSourceCastControls(doc)).toContain('data-source-cast-state-field="'+required.fieldPath+'"');
    expect(calculateDocument(doc).status).toBe('blocked');doc.gameContext!.kinichDamage!.nightsoulBlessingActive=true;
    doc.gameContext!.kinichDamage!.cannonPointsBeforeUse=19;expect(calculateDocument(doc).status).toBe('blocked');
    doc.gameContext!.kinichDamage!.cannonPointsBeforeUse=20;expect(calculateDocument(doc).status).toBe('calculated');
  });
  it('keeps materialized equipment and reopen equal, then refuses a changed frozen A4 state',()=>{
    const doc=cannon();doc.build={mode:'equipment-derived',characterBaseAtk:600,weaponBaseAtk:200,atkPercent:1.5,flatAtk:0,baseHp:20000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};
    const before=calculateDocument(applyCharacterConstellationScope(doc)),converted=convertCalculatorToFinalPanel(doc);
    expect(before.status).toBe('calculated');expect(calculateDocument(converted).totals).toEqual(before.totals);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
    converted.gameContext!.kinichDamage!.a4Stacks=1;expect(calculateDocument(converted).status).toBe('blocked');
  });
});
