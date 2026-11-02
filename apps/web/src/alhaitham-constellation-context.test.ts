import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseEnkaShowcase,resolveShowcaseCatalog} from '@genshin-dps-lab/game-data';
import {getCharacterDocuments} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
const source=()=>resolveShowcaseCatalog(parseEnkaShowcase(JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/alhaitham-c3-enka-panel.json',import.meta.url),'utf8')),{uid:'synthetic-local-only'})).characters[0]!;
function fixture(){const c=source(),d=applyImportedCalculatorPanel(getCharacterDocuments('character:10000078',13).find(d=>d.gameContext?.skillId==='alhaitham-projection-3-mirrors')!,c,'Synthetic C3 final panel');Object.assign(d.gameContext!.alhaithamDamage!,{projectionTriggerValid:true,masteryStableAcrossStages:true,statsAndTargetStableAcrossHits:true,c2SnapshotStacks:2,c2SnapshotIncludedStacks:0});for(const s of Object.values(d.gameContext!.alhaithamDamage!.hitStates!))Object.assign(s,{connected:true,includedProjectionBase:0,includedA4Bonus:0});return d;}
describe('Alhaitham C3 import and C2 actual snapshot accounting',()=>{
 it('uses imported effective E13 once and refuses to assume non-combat ATK after adding C2 mastery',()=>{
  const c=source();expect(c.resolvedSkills.find(s=>s.abilityId==='talent:alhaitham:combat2')).toMatchObject({baseLevel:10,bonusLevel:3,effectiveLevel:13});
  const d=fixture();expect(d.characterLevel).toBe(100);expect(d.gameContext!.constellation).toBe(3);expect(d.gameContext!.effectiveTalentLevel).toBe(13);expect(calculateDocument(d).status).toBe('blocked');
  d.gameContext!.alhaithamDamage!.c2OtherSnapshotStatsFinal=true;
  const expected=3*(2000*1.428+400*2.856)*1.4*(200/390)*.9*1.5,r=calculateDocument(d);expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(expected,8);
  expect(r.hits.reduce((n,h)=>n+h.expected!,0)).toBeCloseTo(expected,8);expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(d)))).totals).toEqual(r.totals);
 });
 it('clears prior actual C2 states on another import and retains the original source untouched',()=>{
  const c=source(),original=JSON.stringify(c),d=fixture();d.gameContext!.alhaithamDamage!.c2OtherSnapshotStatsFinal=true;expect(calculateDocument(d).status).toBe('calculated');
  const imported=applyImportedCalculatorPanel(d,c,'Fresh synthetic source');expect(imported.gameContext!.alhaithamDamage!.c2SnapshotStacks).toBeUndefined();expect(imported.gameContext!.alhaithamDamage!.c2SnapshotIncludedStacks).toBeUndefined();expect(imported.gameContext!.alhaithamDamage!.c2OtherSnapshotStatsFinal).toBeUndefined();expect(calculateDocument(imported).status).toBe('blocked');expect(JSON.stringify(c)).toBe(original);
 });
 it('blocks explicitly non-actual manual snapshot stats even when C2 delta is zero',()=>{
  const d=fixture();if(d.build.mode!=='imported-final')throw Error('fixture mode');d.build={...d.build,mode:'manual-final'};
  Object.assign(d.gameContext!.alhaithamDamage!,{c2SnapshotIncludedStacks:2,c2OtherSnapshotStatsFinal:false});
  expect(calculateDocument(d).status).toBe('blocked');
 });

});
