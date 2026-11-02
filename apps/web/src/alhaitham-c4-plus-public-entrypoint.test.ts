import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseEnkaShowcase,resolveShowcaseCatalog} from '@genshin-dps-lab/game-data';
import {getCharacterDocuments} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {calculateDocument} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';

function alhaithamFixture(constellation:4|6){
 const c=resolveShowcaseCatalog(parseEnkaShowcase(JSON.parse(readFileSync(new URL(`../e2e/fixtures/player-import/alhaitham-c${constellation}-enka-panel.json`,import.meta.url),'utf8')),{uid:'synthetic-local-only'})).characters[0]!;
 const d=applyImportedCalculatorPanel(getCharacterDocuments('character:10000078',13).find(d=>d.gameContext?.skillId==='alhaitham-projection-3-mirrors')!,c,`Synthetic C${constellation} panel; actual burst-generation and overflow states supplied separately`);
 Object.assign(d.gameContext!.alhaithamDamage!,{projectionTriggerValid:true,masteryStableAcrossStages:true,statsAndTargetStableAcrossHits:true,c2SnapshotStacks:2,c2SnapshotIncludedStacks:0,c2OtherSnapshotStatsFinal:true,c4SnapshotStacks:3,...(constellation===6?{c6SnapshotActive:true}:{})});
 for(const state of Object.values(d.gameContext!.alhaithamDamage!.hitStates!))Object.assign(state,{connected:true,includedProjectionBase:0,includedA4Bonus:0,includedC4Bonus:0,...(constellation===6?{c6CritRateIncluded:false,c6CritDamageIncluded:false}:{})});
 return d;
}
const alhaithamBase=(2000*1.428+400*2.856)*1.7*(200/390)*.9;
describe('Alhaitham upper constellation public entrypoints',()=>{
 it('uses actual C4 burst-generated mirror bonus in selected projections without applying the teammate mastery to self',()=>{
  const d=alhaithamFixture(4);expect(d.characterLevel).toBe(100);expect(d.gameContext!.constellation).toBe(4);expect(d.gameContext!.effectiveTalentLevel).toBe(13);
  const r=calculateDocument(d);expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(3*alhaithamBase,8);expect(r.totals!.expected).toBeCloseTo(3*alhaithamBase*1.5,8);
 });
 it('uses actual C6 overflow critical state once and keeps effective E13 and every selected contact after reopen',()=>{
  const d=alhaithamFixture(6),r=calculateDocument(d);expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(3*alhaithamBase*(1+.6*1.7),8);
  expect(r.hits.reduce((sum,hit)=>sum+hit.expected!,0)).toBeCloseTo(r.totals!.expected!,8);const reopened=parseCalculatorDocument(serializeCalculatorDocument(d));expect(reopened.gameContext!.effectiveTalentLevel).toBe(13);expect(calculateDocument(reopened).totals).toEqual(r.totals);
 });
});
