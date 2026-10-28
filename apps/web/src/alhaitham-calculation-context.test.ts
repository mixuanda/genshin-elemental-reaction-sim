import {describe,expect,it} from 'vitest';
import {getCharacterBuildPreset} from '../../../packages/game-data/src/character-build-presets';
import {resolveEquipmentBuild} from '../../../packages/game-data/src/equipment-build';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {resetAlhaithamPanelAccounting} from '../../../packages/sim-core/src/alhaitham-damage-formulas';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderSourceCastControls} from './calculator-source-cast-controls';
function fixture():CalculatorDocument {
  const d=getCharacterDocuments('character:10000078',10).find(d=>d.gameContext?.skillId==='alhaitham-projection-3-mirrors')!;
  d.build={mode:'manual-final',ascension:6,source:'Explicit independent numerical fixture, not a player build',stats:{atk:2000,hp:20000,def:800,em:300,critRate:.5,critDamage:1}};
  Object.assign(d.gameContext!.alhaithamDamage!,{projectionTriggerValid:true,masteryStableAcrossStages:true,statsAndTargetStableAcrossHits:true});
  for(const s of Object.values(d.gameContext!.alhaithamDamage!.hitStates!))s.connected=true;return d;
}
describe('Alhaitham integrated mirror projection',()=>{
  it('offers three explicit mirror scenarios and conserves their separate hit contributions',()=>{
    const docs=getCharacterDocuments('character:10000078',10).filter(d=>d.gameContext?.alhaithamDamage);expect(docs).toHaveLength(3);expect(docs.map(d=>d.hits.length)).toEqual([1,2,3]);
    const r=calculateDocument(fixture());expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(5519.4048,8);
    expect(r.totals!.expected).toBeCloseTo(8279.1072,8);expect(r.hits.reduce((n,h)=>n+h.expected!,0)).toBeCloseTo(r.totals!.expected,8);
  });
  it('keeps trigger EM300 when impact EM rises to1000 and requires all real contacts',()=>{
    const d=fixture(),c=d.gameContext!.alhaithamDamage!;c.masteryStableAcrossStages=false;c.triggerMastery=300;
    for(const s of Object.values(c.hitStates!))s.hitTimeMastery=1000;
    expect(calculateDocument(d).totals!.nonCritical).toBeCloseTo(8491.392,8);
    const id=d.hits[1]!.id;delete c.hitStates![id]!.connected;expect(calculateDocument(d).status).toBe('blocked');
    const f=collectCalculatorRequirements(d).fields.find(f=>f.fieldPath.endsWith(id+'.connected'))!;expect(f).toBeDefined();
    expect(renderSourceCastControls(d)).toContain('data-source-cast-state-field="'+f.fieldPath+'"');
    c.hitStates![id]!.connected=true;d.gameContext!.constellation=4;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('blocked');
  });
  it('preserves actual legal source equipment and public JSON conversion without adding an EM source twice',()=>{
    const d=fixture(),preset=getCharacterBuildPreset('character:10000078','starter')!;expect(preset).toBeDefined();
    d.build=resolveEquipmentBuild(structuredClone(preset.build)).build;resetAlhaithamPanelAccounting(d,'fresh-equipment');
    const r=calculateDocument(d);expect(r.status).toBe('calculated');const converted=convertCalculatorToFinalPanel(d);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(r.totals);
    converted.gameContext!.alhaithamDamage!.mirrorCount=2;expect(calculateDocument(converted).status).toBe('blocked');
  });
});
