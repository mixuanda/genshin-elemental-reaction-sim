import {describe,expect,it} from 'vitest';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {calculateDocument} from '../../../packages/sim-core/src/calculator';
import type {CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
function panel(d:CalculatorDocument){d.build={mode:'manual-final',ascension:6,source:'Explicit constellation acceptance fixture, not player data',stats:{atk:2000,hp:30000,def:800,em:300,critRate:.5,critDamage:1}};return d;}
describe('actual selected damage survives supported constellation imports',()=>{
 it('calculates Hu Tao C3 NA10 with independently supplied effective E13',()=>{
  const d=panel(getCharacterDocuments('character:10000046',10).find(d=>d.gameContext?.skillId==='hutao-paramita-charged-c0-c1')!);d.gameContext!.constellation=3;
  Object.assign(d.gameContext!.hutaoDamage!,{skillTalentLevel:13,maxHpUnchangedSinceSkillCast:true,baseAttack:1000,hpPercentAtSnapshot:49,a4ThresholdStable:true});
  const r=calculateDocument(applyCharacterConstellationScope(d));expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(6018.8166474975,8);
 });
 it('adds Arlecchino C1 one coefficient point to masque without doubling it',()=>{
  const d=panel(getCharacterDocuments('character:10000096',10).find(d=>d.gameContext?.skillId==='arlecchino-red-death-normal-1')!);d.gameContext!.constellation=1;d.gameContext!.arlecchinoDamage!.bondOfLifePercent=150;
  const r=calculateDocument(applyCharacterConstellationScope(d));expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(7571.29086,8);
 });
 it('keeps Alhaitham C1 selected projection damage independent of the following cooldown callback',()=>{
  const d=panel(getCharacterDocuments('character:10000078',10).find(d=>d.gameContext?.skillId==='alhaitham-projection-1-mirror')!);d.gameContext!.constellation=1;
  Object.assign(d.gameContext!.alhaithamDamage!,{projectionTriggerValid:true,masteryStableAcrossStages:true});d.gameContext!.alhaithamDamage!.hitStates![d.hits[0]!.id]!.connected=true;
  const r=calculateDocument(applyCharacterConstellationScope(d));expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(1839.8016,8);
 });
});
