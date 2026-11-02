import { describe, expect, it } from 'vitest';
import { getCharacterDocuments } from './character-calculations';

describe('Tighnari real primary damage actions',()=>{
 it('offers a real Wreath Arrow and four Clusterbloom arrows',()=>{
  const doc=getCharacterDocuments('character:10000069',4).find(d=>d.gameContext?.skillId==='tighnari-wreath-complete-c0-c5');
  expect(doc,'Missing actual level-two aimed attack, not an E-enhanced normal').toBeDefined();
  expect(doc!.hits).toHaveLength(5);
 });
 it('offers Q as six primary and six secondary arrows',()=>{
  const doc=getCharacterDocuments('character:10000069',4).find(d=>d.gameContext?.skillId==='tighnari-burst-complete-cast');
  expect(doc,'Missing actual six-plus-six burst').toBeDefined();
  expect(doc!.hits).toHaveLength(12);
 });
});

import {calculateDocument,convertCalculatorToFinalPanel,parseCalculatorDocument,serializeCalculatorDocument} from '../../../packages/sim-core/src/calculator';
import type {CalculatorDocument,TighnariDamageContext} from '../../../packages/sim-core/src/calculator-model';
import {applyCharacterConstellationScope} from './character-calculations';
import {resetTighnariPanelAccounting} from './tighnari-calculation-context';
import {collectCalculatorRequirements} from './calculator-requirements';
import {renderTighnariControls} from './calculator-tighnari-controls';
const fixture=(skill='tighnari-wreath-complete-c0-c5',cons=0):CalculatorDocument=>{
 const d=getCharacterDocuments('character:10000069',4).find(x=>x.gameContext?.skillId===skill)!;
 d.gameContext!.constellation=cons;d.gameContext!.ascension=5;d.characterLevel=70;
 d.build={mode:'manual-final',source:'Explicit independent arithmetic panel; not a player build',stats:{atk:1000,hp:10000,def:800,em:100,critRate:.5,critDamage:1}};
 return d;
};
const state=(d:CalculatorDocument)=>d.gameContext!.tighnariDamage!;
const apply=applyCharacterConstellationScope;
const hitDamage=(d:CalculatorDocument)=>calculateDocument(apply(d));
const defense=170/360,resistance=.9;
const em=(r:ReturnType<typeof calculateDocument>,index:number)=>r.hits[index]!.trace.find(n=>n.id==='hitElementalMastery')!.result!.value;

describe('Tighnari independent snapshot and live damage calculation',()=>{
 it('uses separate first-arrow and Clusterbloom EM, sums real CA components and retains C1 clamp',()=>{
  const d=fixture();let r=hitDamage(d);expect(r.status).toBe('calculated');
  const noncrit=1000*(1.09+4*.4825)*1.09*defense*resistance;
  expect(r.totals!.nonCritical).toBeCloseTo(noncrit,10);expect(r.totals!.expected).toBeCloseTo(noncrit*1.5,10);
  expect(em(r,0)).toBe(100);for(let i=1;i<5;i++)expect(em(r,i)).toBe(150);
  d.gameContext!.constellation=1;r=hitDamage(d);expect(r.totals!.expected).toBeCloseTo(noncrit*1.65,10);
  if(d.build.mode!=='equipment-derived')d.build.stats.critRate=.9;
  expect(hitDamage(d).totals!.expected).toBeCloseTo(noncrit*2,10);
 });
 it('handles real C4 charged state and already-included contributions without double counting',()=>{
  const d=fixture(undefined,4);Object.assign(state(d),{c2Active:true,c4Em:60});const r=hitDamage(d);
  const noncrit=1000*(1.09+4*.4825)*(1+.2+.0006*210)*defense*resistance;
  expect(r.status).toBe('calculated');expect(r.totals!.expected).toBeCloseTo(noncrit*1.65,10);expect(em(r,0)).toBe(160);expect(em(r,1)).toBe(210);
  const final=structuredClone(d);if(final.build.mode!=='equipment-derived'){final.build.stats.em=210;final.build.stats.critRate=.65;}
  Object.assign(state(final),{a1IncludedEm:50,c4IncludedEm:60,includedC2Bonus:.2,includedA4Bonus:.126,includedC1Crit:.15});
  for(const h of final.hits)if(h.kind==='ordinary')h.damageBonus=.326;
  expect(hitDamage(final).totals!.expected).toBeCloseTo(r.totals!.expected!,10);
 });
 it('calculates six-plus-six C4 no-reaction Q using Q4 once, including its own 60 EM grant',()=>{
  const d=fixture('tighnari-burst-complete-cast',4);state(d).c2Active=false;const r=hitDamage(d);
  expect(r.status).toBe('calculated');expect(r.hits).toHaveLength(12);expect(r.totals!.expected).toBeCloseTo(6*(.69525+.84975)*1000*(1+.0006*160)*defense*resistance*1.5,10);
  for(let i=0;i<12;i++)expect(em(r,i)).toBe(160);
  expect(d.gameContext!.effectiveTalentLevel).toBe(4); // Actual user's Q1+3 is already effective Q4.
 });
 it('caps A4 at 60%, disables it before A4 unlock and keeps ordinary physical normals independent',()=>{
  const d=fixture();if(d.build.mode!=='equipment-derived')d.build.stats.em=2000;
  expect(hitDamage(d).totals!.nonCritical).toBeCloseTo(1000*(1.09+4*.4825)*1.6*defense*resistance,10);
  d.gameContext!.ascension=3;
  expect(hitDamage(d).totals!.nonCritical).toBeCloseTo(1000*(1.09+4*.4825)*defense*resistance,10);
  const n=fixture('tighnari-normal-1',4);const before=hitDamage(n);expect(before.status).toBe('calculated');
  Object.assign(state(n),{c2Active:true,c4Em:120,priorA1Active:true});expect(hitDamage(n).totals).toEqual(before.totals);
 });
 it('blocks unsupported C6 CA and C4 Q reaction-driven EM changes rather than dropping damage',()=>{
  const d=fixture(undefined,6);Object.assign(state(d),{c2Active:false,c4Em:0});let r=hitDamage(d);
  expect(r.status).toBe('blocked');expect(r.totals).toBeUndefined();expect(r.blockers.join()).toContain('C6');
  const q=fixture('tighnari-burst-complete-cast',4);state(q).c2Active=false;if(q.hits[0]!.kind==='ordinary')q.hits[0]!.additiveReaction='spread';
  r=hitDamage(q);expect(r.status).toBe('blocked');expect(r.blockers.join()).toContain('精通');
 });
 it('keeps missing imported accounting unknown, links its real controls and resumes after explicit answers',()=>{
  let d=fixture(undefined,4);resetTighnariPanelAccounting(d,'imported-final');d=apply(d);expect(calculateDocument(d).status).toBe('blocked');
  const fields=collectCalculatorRequirements(d).fields;const html=renderTighnariControls(d);
  for(const f of fields){expect(html).toContain(f.fieldPath);expect(f.controlSelector).toContain(f.fieldPath);}
  Object.assign(state(d),{priorA1Active:false,allHitsConnected:true,statsStableAcrossHits:true,c2Active:false,c4Em:0,a1IncludedEm:0,c4IncludedEm:0,includedA4Bonus:0,includedC2Bonus:0,includedC1Crit:0});
  d=apply(d);expect(calculateDocument(d).status).toBe('calculated');expect(collectCalculatorRequirements(d).fields).toEqual([]);
  const reopened=parseCalculatorDocument(serializeCalculatorDocument(d));expect(calculateDocument(reopened).totals).toEqual(calculateDocument(d).totals);
 });
 it('does not call an incomplete arrow set a full cast, while retaining independent single-arrow calculation',()=>{
  const d=fixture();state(d).allHitsConnected=false;expect(hitDamage(d).status).toBe('blocked');
  d.scope='single-hit';d.selectedHitIds=[d.hits[0]!.id];expect(hitDamage(d).status).toBe('calculated');
 });
});

it('preserves converted CA results and rejects changed C1/C4 state with captured critical values',()=>{
 let d=fixture(undefined,4);Object.assign(state(d),{c2Active:false,c4Em:60});d=apply(d);
 const before=calculateDocument(d).totals!;
 const converted=convertCalculatorToFinalPanel(d);expect(calculateDocument(apply(converted)).totals!.expected).toBeCloseTo(before.expected,10);
 converted.gameContext!.constellation=0;
 const changed=calculateDocument(apply(converted));expect(changed.status).toBe('blocked');expect(changed.blockers.join()).toContain('快照');
});
