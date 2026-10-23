import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseEnkaShowcase,resolveShowcaseCatalog} from '@genshin-dps-lab/game-data';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderSourceCastControls} from './calculator-source-cast-controls';

function fixture():CalculatorDocument {
  const d=getCharacterDocuments('character:10000046',10).find(d=>d.gameContext?.skillId==='hutao-paramita-charged-c0-c1')!;
  d.build={mode:'manual-final',ascension:6,source:'Explicit independent numerical fixture, not a player build',stats:{atk:2000,hp:30000,def:800,em:0,critRate:.5,critDamage:1}};
  Object.assign(d.gameContext!.hutaoDamage!,{skillTalentLevel:10,maxHpUnchangedSinceSkillCast:true,baseAttack:1000,hpPercentAtSnapshot:49,a4ThresholdStable:true});return d;
}
describe('Hu Tao integrated primary outputs',()=>{
  it('registers eight real E-state contacts without replacing the existing charged or Blood Blossom entries',()=>{
    const docs=getCharacterDocuments('character:10000046',10);
    expect(docs.filter(d=>d.gameContext?.hutaoDamage)).toHaveLength(8);
    expect(docs.some(d=>d.gameContext?.skillId==='hutao-charged-base')).toBe(true);
    expect(docs.some(d=>d.gameContext?.skillId==='observed-hutao-skill-c0')).toBe(true);
    const result=calculateDocument(fixture());expect(result.status).toBe('calculated');
    expect(result.totals!.nonCritical).toBeCloseTo(5628.15031212,9);expect(result.totals!.expected).toBeCloseTo(8442.22546818,9);
  });
  it('links unknown independent E and actual HP to usable controls and refuses unsupported C2',()=>{
    const d=fixture();delete d.gameContext!.hutaoDamage!.skillTalentLevel;
    const field=collectCalculatorRequirements(d).fields.find(f=>f.fieldPath==='gameContext.hutaoDamage.skillTalentLevel')!;
    expect(field).toBeDefined();expect(renderSourceCastControls(d)).toContain('data-field="'+field.fieldPath+'"');
    expect(calculateDocument(d).status).toBe('blocked');d.gameContext!.hutaoDamage!.skillTalentLevel=10;
    d.gameContext!.constellation=1;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('calculated');
    d.gameContext!.constellation=2;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('blocked');
  });
  it('binds imported E7 independently from NA10 without inventing battle state, and preserves missing E',()=>{
    const raw=JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/kaeya-enka-panel.json',import.meta.url),'utf8'));
    const c=resolveShowcaseCatalog(parseEnkaShowcase(raw,{uid:'synthetic-local-only'})).characters[0]!;
    c.catalog.characterId='character:10000046';c.constellation=1;c.stats.damageBonuses.pyro=0;
    const base=c.resolvedSkills[0]!;
    c.resolvedSkills=[{...base,abilityId:'talent:hutao:combat1',matchStatus:'matched',baseLevel:10,bonusLevel:0,effectiveLevel:10},{...base,abilityId:'talent:hutao:combat2',matchStatus:'matched',baseLevel:7,bonusLevel:0,effectiveLevel:7}];
    const imported=applyImportedCalculatorPanel(fixture(),c,'Synthetic import contract');
    expect(imported.gameContext!.effectiveTalentLevel).toBe(10);expect(imported.gameContext!.hutaoDamage!.skillTalentLevel).toBe(7);
    expect(imported.gameContext!.hutaoDamage!.hpPercentAtSnapshot).toBeUndefined();expect(calculateDocument(imported).status).toBe('blocked');
    c.resolvedSkills.pop();expect(applyImportedCalculatorPanel(fixture(),c,'Missing independent E').gameContext!.hutaoDamage!.skillTalentLevel).toBeUndefined();
  });
  it('uses the real JSON and conversion path and refuses to silently rewrite historical HP',()=>{
    const d=fixture(),before=calculateDocument(d),converted=convertCalculatorToFinalPanel(d);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
    converted.gameContext!.hutaoDamage!.hpPercentAtSnapshot=80;expect(calculateDocument(converted).status).toBe('blocked');
  });
});
