import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseEnkaShowcase,resolveShowcaseCatalog} from '@genshin-dps-lab/game-data';
import {getCharacterDocuments} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {calculateDocument} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';

const arlecchino=()=>resolveShowcaseCatalog(parseEnkaShowcase(JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/arlecchino-c6-enka-panel.json',import.meta.url),'utf8')),{uid:'synthetic-local-only'})).characters[0]!;
function arlecchinoFixture(active:boolean){
 const c=arlecchino(),base=getCharacterDocuments('character:10000096',13).find(d=>d.gameContext?.skillId==='arlecchino-red-death-normal-1')!;
 const d=applyImportedCalculatorPanel(base,c,'Synthetic C6 final panel; actual C6 state declared separately');
 Object.assign(d.gameContext!.arlecchinoDamage!,{bondOfLifePercent:150,passivePyroBonusIncluded:true,c6Active:active,c6CritRateIncludedPercent:0,c6CritDamageIncludedPercent:0});return d;
}
const arlecchinoNonCrit=(2000*1.1378+2000*1.5*(2.884+1))*1.4*(200/390)*.9;
describe('higher constellation public imported entrypoints',()=>{
 it('keeps C6 Arlecchino level100 and effective NA13 without assuming her actual C6 window is active',()=>{
  const d=arlecchinoFixture(false);expect(d.characterLevel).toBe(100);expect(d.gameContext!.constellation).toBe(6);expect(d.gameContext!.effectiveTalentLevel).toBe(13);
  const r=calculateDocument(d);expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(arlecchinoNonCrit*1.5,8);
 });
 it('uses only actual C6 critical differences for the same selected normal, preserved after reopen',()=>{
  const d=arlecchinoFixture(true),r=calculateDocument(d);expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(arlecchinoNonCrit,8);expect(r.totals!.expected).toBeCloseTo(arlecchinoNonCrit*(1+.6*1.7),8);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(d))).totals).toEqual(r.totals);
 });
});
