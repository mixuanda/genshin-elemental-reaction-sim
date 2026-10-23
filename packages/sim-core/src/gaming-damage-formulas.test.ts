import {describe,expect,it} from 'vitest';
import {getCharacterDocuments,applyCharacterConstellationScope} from '../../../apps/web/src/character-calculations';
import {renderGamingControls,gamingRequirementAdapter} from '../../../apps/web/src/calculator-gaming-controls';
import {calculateDocument,convertCalculatorToFinalPanel} from './calculator';
import {parseCalculatorDocument,serializeCalculatorDocument,type CalculatorDocument} from './calculator-model';
import {resetSourceCastPanelAccounting} from './source-cast-context';

function fixture(cons=0,skill='gaming-charmed-cloudstrider',talent=10):CalculatorDocument{
 const d=getCharacterDocuments('character:10000092',talent).find(d=>d.gameContext?.skillId===skill)!;
 if(!d)throw Error('Missing real Gaming action '+skill);
 d.build={mode:'manual-final',ascension:6,source:'Explicit numerical fixture, not a player build',stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1}};
 d.gameContext!.constellation=cons;Object.assign(d.gameContext!.gamingDamage!,{hpPercent:50,c2Active:false});return d;
}
const result=(d:CalculatorDocument)=>calculateDocument(applyCharacterConstellationScope(d));
describe('Gaming selected real hit formulas',()=>{
 it.each([[0,1],[49.999,1],[50,1.2],[100,1.2]])('uses hit-time HP %s percent before following-frame drain', (hp,bonus)=>{
  const d=fixture();d.gameContext!.gamingDamage!.hpPercent=hp;
  const r=result(d);expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(2000*4.1472*bonus*.5*.9,9);
 });
 it.each([0,1,2,3,4,5,6])('calculates C%i special plunge without adding talent levels twice',cons=>{
  const r=result(fixture(cons));expect(r.status).toBe('calculated');
  expect(r.totals!.nonCritical).toBeCloseTo(2000*4.1472*1.2*.5*.9,9);
  expect(r.totals!.expected).toBeCloseTo(2000*4.1472*1.2*.5*.9*(1+(cons===6?.7:.5)*(cons===6?1.4:1)),9);
 });
 it('uses effective E13 once and ordinary probability clamping at C6',()=>{
  const d=fixture(6,'gaming-charmed-cloudstrider',13);if(d.build.mode!=='manual-final')throw Error();d.build.stats.critRate=.95;
  const r=result(d);expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(2000*4.896*1.2*.5*.9*2.4,9);
 });
 it('does not put special-plunge A4 or C6 crit on Q opening',()=>{
  const d=fixture(6,'gaming-burst-opening');delete d.gameContext!.gamingDamage!.hpPercent;delete d.gameContext!.gamingDamage!.a4Included;
  const r=result(d);expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(2000*6.6672*.5*.9,9);expect(r.totals!.expected).toBeCloseTo(2000*6.6672*.5*.9*1.5,9);
 });
 it('keeps locked A4 off before ascension4',()=>{
  const d=fixture();d.gameContext!.ascension=3;if(d.build.mode!=='manual-final')throw Error();d.build.ascension=3;delete d.gameContext!.gamingDamage!.hpPercent;
  expect(result(d).totals!.nonCritical).toBeCloseTo(2000*4.1472*.5*.9,9);
 });
 it('requires real base ATK for C2 and applies 20% of white values rather than final ATK',()=>{
  const d=fixture(6);d.gameContext!.gamingDamage!.c2Active=true;
  expect(result(d).status).toBe('blocked');expect(renderGamingControls(d)).toContain('基础攻击力');
  d.gameContext!.gamingDamage!.baseAttack=800;const r=result(d);expect(r.status).toBe('calculated');expect(r.totals!.nonCritical).toBeCloseTo(2160*4.1472*1.2*.5*.9,9);
 });
 it('derives C2 base attack from actual equipment input and responds to its changes',()=>{
  const d=fixture(6);d.gameContext!.gamingDamage!.c2Active=true;
  d.build={mode:'equipment-derived',characterBaseAtk:600,weaponBaseAtk:200,atkPercent:1.5,flatAtk:0,baseHp:20000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};
  expect(result(d).totals!.nonCritical).toBeCloseTo(2160*4.1472*1.2*.5*.9,9);
  d.build.weaponBaseAtk=400;expect(result(d).totals!.nonCritical).toBeCloseTo(2700*4.1472*1.2*.5*.9,9);
 });
 it('never adds C2, A4 or C6 a second time to an explicitly included panel',()=>{
  const a=fixture(6),b=fixture(6);Object.assign(a.gameContext!.gamingDamage!,{c2Active:true,baseAttack:800});
  if(b.build.mode!=='manual-final'||b.hits[0]!.kind!=='ordinary')throw Error();b.build.stats.atk=2160;b.build.stats.critRate=.7;b.build.stats.critDamage=1.4;b.hits[0]!.damageBonus=.2;
  Object.assign(b.gameContext!.gamingDamage!,{c2Active:true,c2Included:true,a4Included:true,c6CritRateIncluded:true,c6CritDamageIncluded:true});
  expect(result(a).totals).toEqual(result(b).totals);
 });
 it('can remove an explicitly included stale C2 share without guessing its base',()=>{
  const d=fixture(6);if(d.build.mode!=='manual-final')throw Error();d.build.stats.atk=2160;Object.assign(d.gameContext!.gamingDamage!,{c2Included:true,baseAttack:800});
  expect(result(d).totals).toEqual(result(fixture(6)).totals);
 });
 it('clears unknown imported shares, exposes concrete fields and preserves genuine zero HP',()=>{
  const d=fixture(6);resetSourceCastPanelAccounting(d,'imported-final');
  expect(result(d).status).toBe('blocked');const fields=gamingRequirementAdapter.collect(d).map(f=>f.fieldPath);
  expect(fields).toContain('gameContext.gamingDamage.hpPercent');expect(fields).toContain('gameContext.gamingDamage.c6CritRateIncluded');
  resetSourceCastPanelAccounting(d,'fresh-equipment');Object.assign(d.gameContext!.gamingDamage!,{hpPercent:0,c2Active:false});expect(result(d).status).toBe('calculated');
 });
 it('keeps equipment conversion/reopen exact and refuses changing frozen hit conditions',()=>{
  const d=fixture(6);d.build={mode:'equipment-derived',characterBaseAtk:600,weaponBaseAtk:200,atkPercent:1.5,flatAtk:0,baseHp:20000,hpPercent:0,flatHp:0,baseDef:800,defPercent:0,flatDef:0,em:0,critRate:.5,critDamage:1};Object.assign(d.gameContext!.gamingDamage!,{c2Active:true});
  const before=result(d),converted=convertCalculatorToFinalPanel(applyCharacterConstellationScope(d));expect(before.status).toBe('calculated');
  expect(result(converted).totals).toEqual(before.totals);expect(result(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
  converted.gameContext!.gamingDamage!.hpPercent=49;expect(result(converted).status).toBe('blocked');
 });
 it('refuses invented extra hits and a locked C2 claim',()=>{
  const d=fixture();d.hits.push({...d.hits[0]!,id:'invented-collision'});d.selectedHitIds.push('invented-collision');d.scope='one-cast';expect(result(d).status).toBe('blocked');
  const c0=fixture();c0.gameContext!.gamingDamage!.c2Active=true;expect(result(c0).status).toBe('blocked');
 });
});
