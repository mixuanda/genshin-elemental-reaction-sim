import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseEnkaShowcase,resolveShowcaseCatalog} from '@genshin-dps-lab/game-data';
import {getCharacterDocuments} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
const source=()=>resolveShowcaseCatalog(parseEnkaShowcase(JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/arlecchino-c3-enka-panel.json',import.meta.url),'utf8')),{uid:'synthetic-local-only'})).characters[0]!;
describe('Arlecchino constellation import to actual selected damage',()=>{
 it('keeps a C3 imported NA10+3 as effective13 at level100 and applies only one C1 coefficient',()=>{
  const c=source(),na=c.resolvedSkills.find(s=>s.abilityId==='talent:arlecchino:combat1')!;expect(na).toMatchObject({baseLevel:10,bonusLevel:3,effectiveLevel:13});expect(c.constellation).toBe(3);expect(c.level).toBe(100);
  const base=getCharacterDocuments(c.catalog.characterId!,na.effectiveLevel!).find(d=>d.gameContext?.skillId==='arlecchino-red-death-normal-1')!;
  const d=applyImportedCalculatorPanel(base,c,'Synthetic C3 final panel');expect(d.gameContext!.effectiveTalentLevel).toBe(13);expect(d.gameContext!.arlecchinoDamage!.bondOfLifePercent).toBeUndefined();expect(calculateDocument(d).status).toBe('blocked');
  Object.assign(d.gameContext!.arlecchinoDamage!,{bondOfLifePercent:150,passivePyroBonusIncluded:true});
  const r=calculateDocument(d),expected=(2000*1.1378+11652)*1.4*(200/390)*.9*1.5;expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(expected,8);expect(d.characterLevel).toBe(100);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(d)))).totals).toEqual(r.totals);
 });
 it('does not treat an unknown imported +3 as known or silently use a C0 action',()=>{
  const c=source(),na=c.resolvedSkills.find(s=>s.abilityId==='talent:arlecchino:combat1')!;na.bonusLevel=null;na.effectiveLevel=null;
  const d=getCharacterDocuments('character:10000096',13).find(d=>d.gameContext?.skillId==='arlecchino-red-death-normal-1')!;expect(()=>applyImportedCalculatorPanel(d,c,'Unknown imported bonus')).toThrow('有效天赋');
 });
});
