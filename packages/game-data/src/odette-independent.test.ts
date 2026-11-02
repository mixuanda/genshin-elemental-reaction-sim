import {expect,it} from 'vitest';
import {gameDataCatalog} from './catalog';
import {releasedRuntimeWorkspace} from './runtime-workspace';
import {getCharacterDocuments} from '../../../apps/web/src/character-calculations';
import {calculateDocument,parseCalculatorDocument,serializeCalculatorDocument} from '../../sim-core/src/calculator';

it('retains only Odette C0 four ordinary Cryo contacts, independent of the entity lifetime',()=>{
 const id=gameDataCatalog.characters.find(c=>c.slug==='odette')!.id;
 for(const [level,slash,final] of [[1,1.10176,1.70272],[10,1.983168,3.064896],[15,2.61668,4.04396]]){
  const docs=getCharacterDocuments(id,level);const d=docs.find(d=>d.gameContext?.skillId==='odette-burst-direct-four-hits')!;
  expect(d.hits).toHaveLength(4);expect(d.gameContext?.scopeCoverage).toBe('selected-components');
  expect(d.hits.map(h=>h.kind==='ordinary'?h.terms[0]!.coefficient:undefined)).toEqual([slash,slash,slash,final]);
  expect(d.hits.every(h=>h.kind==='ordinary'&&h.element==='cryo'&&h.attackTag==='burst'&&h.sourceRefs.some(s=>s.includes('/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/')))).toBe(true);
  expect(calculateDocument(d).totals!.nonCritical).toBeCloseTo(2000*(3*slash!+final!)*.5*.9,9);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(d))).totals).toEqual(calculateDocument(d).totals);
  expect(calculateDocument(docs.find(d=>d.gameContext?.skillId==='entity-followup-odette-burst-c0')!).status).toBe('blocked');
 }
 const w=structuredClone(releasedRuntimeWorkspace);w.catalog.talentSets.find(t=>t.id==='talent-set:odette')!.abilities.find(a=>a.key==='combat3')!.parameters.param1![0]!+=.001;
 const result=calculateDocument(getCharacterDocuments(id,1,w).find(d=>d.gameContext?.skillId==='odette-burst-direct-four-hits')!);
 expect(result.status).toBe('blocked');expect(result.totals).toBeUndefined();
});
