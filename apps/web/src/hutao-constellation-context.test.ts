import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseEnkaShowcase,resolveShowcaseCatalog} from '@genshin-dps-lab/game-data';
import {getCharacterDocuments,applyCharacterConstellationScope} from './character-calculations';
import {applyImportedCalculatorPanel} from './calculator-import';
import {calculateDocument,convertCalculatorToFinalPanel} from '../../../packages/sim-core/src/calculator';
import {parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
const source=()=>resolveShowcaseCatalog(parseEnkaShowcase(JSON.parse(readFileSync(new URL('../e2e/fixtures/player-import/hutao-c3-enka-panel.json',import.meta.url),'utf8')),{uid:'synthetic-local-only'})).characters[0]!;
describe('Hu Tao C3/C6 actual imported primary hit',()=>{
 it('preserves imported level100, independent NA10 and E10+3 without borrowing or adding levels',()=>{
  const c=source();expect(c.resolvedSkills.find(s=>s.abilityId==='talent:hutao:combat2')).toMatchObject({baseLevel:10,bonusLevel:3,effectiveLevel:13});
  const base=getCharacterDocuments('character:10000046',10).find(d=>d.gameContext?.skillId==='hutao-paramita-charged-c0-c1')!;
  const d=applyImportedCalculatorPanel(base,c,'Synthetic imported C3 panel');expect(d.characterLevel).toBe(100);expect(d.gameContext!.constellation).toBe(3);expect(d.gameContext!.effectiveTalentLevel).toBe(10);expect(d.gameContext!.hutaoDamage!.skillTalentLevel).toBe(13);expect(calculateDocument(d).status).toBe('blocked');
  Object.assign(d.gameContext!.hutaoDamage!,{paramitaActive:true,skillAttackIncludedInPanel:false,maxHpUnchangedSinceSkillCast:true,baseAttack:1000,hpPercentAtSnapshot:49,a4ThresholdStable:true,a4IncludedInDamageBonus:false});
  const noncrit=(2000+30000*.07153)*2.42565*1.33*(200/390)*.9;
  expect(calculateDocument(d).totals!.expected).toBeCloseTo(noncrit*1.5,8);
  d.gameContext!.constellation=6;expect(calculateDocument(applyCharacterConstellationScope(d)).status).toBe('blocked');
  Object.assign(d.gameContext!.hutaoDamage!,{c6Active:true,c6CritRateIncludedInPanel:false});const r=calculateDocument(applyCharacterConstellationScope(d));expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(noncrit*2,8);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(d)))).totals).toEqual(r.totals);
 });
});
