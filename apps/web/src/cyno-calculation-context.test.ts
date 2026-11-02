import {describe,expect,it} from 'vitest';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderSourceCastControls} from './calculator-source-cast-controls';

function fixture(charged=false):CalculatorDocument{
  const d=getCharacterDocuments('character:10000071',10).find(d=>d.gameContext?.skillId===(charged?'cyno-q-charged-c0':'cyno-q-normal-1-c0'))!;
  d.build={mode:'manual-final',ascension:6,source:'Explicit Q10 numerical case',stats:{atk:2000,hp:20000,def:800,em:300,critRate:.5,critDamage:1}};
  d.gameContext!.cynoDamage!.emStableFromActionStart=true;return d;
}
describe('Cyno integrated Q normal/charged calculation',()=>{
  it('uses Q10 rather than normal talent and excludes A4 from charged damage',()=>{
    const n=calculateDocument(fixture()),c=calculateDocument(fixture(true));
    expect(n.status).toBe('calculated');expect(c.status).toBe('calculated');
    expect(n.totals!.nonCritical).toBeCloseTo((2000*1.547459+1.5*400)*.5*.9,9);
    expect(c.totals!.nonCritical).toBeCloseTo(2000*1.9975*.5*.9,9);
    expect(getCharacterDocuments('character:10000071',10).some(d=>d.gameContext?.skillId==='finite-followup-cyno-skill-endseer-c0'&&d.hits.length===4)).toBe(true);
  });
  it('reads explicit action-start EM independently and links unknown Q state to its control',()=>{
    const d=fixture();Object.assign(d.gameContext!.cynoDamage!,{emStableFromActionStart:false,actionStartEm:100});
    expect(calculateDocument(d).totals!.nonCritical).toBeCloseTo((2000*1.547459+150)*.5*.9,9);
    delete d.gameContext!.cynoDamage!.burstActive;const fields=collectCalculatorRequirements(d).fields;
    const q=fields.find(f=>f.fieldPath==='gameContext.cynoDamage.burstActive')!;expect(q).toBeDefined();
    expect(renderSourceCastControls(d)).toContain('data-source-cast-state-field="'+q.fieldPath+'"');expect(calculateDocument(d).status).toBe('blocked');
    d.gameContext!.cynoDamage!.burstActive=true;expect(calculateDocument(d).status).toBe('calculated');
  });
  it('preserves strict JSON and equipment conversion without adding Q100 or A4 twice',()=>{
    const d=fixture();d.build={mode:'equipment-derived',characterBaseAtk:600,weaponBaseAtk:200,atkPercent:1.5,flatAtk:0,baseHp:20000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:300,critRate:.5,critDamage:1};
    const before=calculateDocument(d),converted=convertCalculatorToFinalPanel(d);expect(before.status).toBe('calculated');
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
    converted.gameContext!.cynoDamage!.burstEmIncludedInPanel=true;expect(calculateDocument(converted).status).toBe('blocked');
  });
  it('keeps higher constellations outside the explicitly implemented C0 entry',()=>{
    const d=fixture();d.gameContext!.constellation=1;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('blocked');
  });
});
