import {describe,expect,it} from 'vitest';
import {getCharacterBuildPreset} from '../../../packages/game-data/src/character-build-presets';
import {resolveEquipmentBuild} from '../../../packages/game-data/src/equipment-build';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {resetArlecchinoPanelAccounting} from '../../../packages/sim-core/src/arlecchino-damage-formulas';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderSourceCastControls} from './calculator-source-cast-controls';
function fixture():CalculatorDocument {
  const d=getCharacterDocuments('character:10000096',10).find(d=>d.gameContext?.skillId==='arlecchino-red-death-normal-1')!;
  d.build={mode:'manual-final',ascension:6,source:'Explicit independent numerical fixture, not a player build',stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1}};
  d.gameContext!.arlecchinoDamage!.bondOfLifePercent=150;return d;
}
describe('Arlecchino integrated Red Death output',()=>{
  it('exposes seven distinct real normal hits with independently verified three-column damage',()=>{
    const docs=getCharacterDocuments('character:10000096',10);expect(docs.filter(d=>d.gameContext?.arlecchinoDamage)).toHaveLength(7);
    expect(docs.some(d=>d.gameContext?.skillId==='arlecchino-burst-burst')).toBe(true);
    const r=calculateDocument(fixture());expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(5681.29086,8);
    expect(r.totals!.expected).toBeCloseTo(8521.93629,8);expect(r.totals!.critical).toBeCloseTo(11362.58172,8);
  });
  it('requires actual pre-hit bond, preserves a valid 30% boundary and rejects C1',()=>{
    const d=fixture();delete d.gameContext!.arlecchinoDamage!.bondOfLifePercent;
    const field=collectCalculatorRequirements(d).fields.find(f=>f.fieldPath==='gameContext.arlecchinoDamage.bondOfLifePercent')!;
    expect(field).toBeDefined();expect(renderSourceCastControls(d)).toContain('data-field="'+field.fieldPath+'"');expect(calculateDocument(d).status).toBe('blocked');
    d.gameContext!.arlecchinoDamage!.bondOfLifePercent=30;expect(calculateDocument(d).status).toBe('calculated');
    d.gameContext!.arlecchinoDamage!.bondOfLifePercent=29.999;expect(calculateDocument(d).status).toBe('blocked');
    d.gameContext!.arlecchinoDamage!.bondOfLifePercent=150;d.gameContext!.constellation=1;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('blocked');
  });
  it('deduces fresh-equipment accounting and preserves legal equipment conversion and strict JSON',()=>{
    const d=fixture(),preset=getCharacterBuildPreset('character:10000096','starter')!;expect(preset).toBeDefined();
    d.build=resolveEquipmentBuild(structuredClone(preset.build)).build;resetArlecchinoPanelAccounting(d,'fresh-equipment');
    expect(collectCalculatorRequirements(d).fields.some(f=>f.fieldPath.endsWith('passivePyroBonusIncluded'))).toBe(false);
    const before=calculateDocument(d);expect(before.status).toBe('calculated');const converted=convertCalculatorToFinalPanel(d);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
    converted.gameContext!.arlecchinoDamage!.bondOfLifePercent=100;expect(calculateDocument(converted).status).toBe('blocked');
  });
});
