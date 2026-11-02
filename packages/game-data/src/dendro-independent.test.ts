import {expect,it} from 'vitest';
import {gameDataCatalog} from './catalog';
import {releasedRuntimeWorkspace} from './runtime-workspace';
import {getCharacterDocuments} from '../../../apps/web/src/character-calculations';
import {calculateDocument,parseCalculatorDocument,serializeCalculatorDocument} from '../../sim-core/src/calculator';

for(const gender of ['aether','lumine'])it(`${gender} retains one Dendro explosion with actual EM and no invented lamp lifetime`,()=>{
 const id=gameDataCatalog.characters.find(c=>c.slug===gender)!.id;
 for(const [level,coefficient] of [[1,4.008],[10,7.2144],[15,9.519]]){
  const docs=getCharacterDocuments(id,level);
  const d=docs.find(d=>d.gameContext?.skillId===`${gender}-dendro-burst-pyro-transformed-explosion`)!;
  expect(d.gameContext?.scopeCoverage).toBe('selected-components');expect(d.hits).toHaveLength(1);
  expect(d.hits[0]).toMatchObject({kind:'ordinary',element:'dendro',attackTag:'burst',terms:[{stat:'atk',coefficient}]});
  if(d.build.mode==='equipment-derived')throw Error('Expected editable actual panel');
  d.build.stats.em=200;
  expect(calculateDocument(d).totals!.nonCritical).toBeCloseTo(2000*coefficient!*.5*.9*1.2,9);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(d))).totals).toEqual(calculateDocument(d).totals);
  d.gameContext!.ascension=3;
  expect(calculateDocument(d).totals!.nonCritical).toBeCloseTo(2000*coefficient!*.5*.9,9);
  delete d.gameContext!.ascension;expect(calculateDocument(d).status).toBe('blocked');
  expect(calculateDocument(docs.find(d=>d.gameContext?.skillId===`held-${gender}-dendro-burst-pyro-c0`)!).status).toBe('blocked');
 }
 const workspace=structuredClone(releasedRuntimeWorkspace);
 workspace.catalog.talentSets.find(t=>t.id==='talent-set:travelerdendro')!.abilities.find(a=>a.key==='combat3')!.parameters.param2![0]!+=.001;
 const docs=getCharacterDocuments(id,1,workspace);
 const blocked=calculateDocument(docs.find(d=>d.gameContext?.skillId===`${gender}-dendro-burst-pyro-transformed-explosion`)!);
 expect(blocked.status).toBe('blocked');expect(blocked.totals).toBeUndefined();
 expect(calculateDocument(docs.find(d=>d.gameContext?.skillId===`${gender}-dendro-skill`)!).status).toBe('calculated');
});
