import {expect,it} from 'vitest';
import {gameDataCatalog} from './catalog';
import {releasedRuntimeWorkspace} from './runtime-workspace';
import {getCharacterDocuments} from '../../../apps/web/src/character-calculations';
import {calculateDocument} from '../../sim-core/src/calculator';

it.each([
  ['fischl','fischl-skill-birdatk','coordinated-fischl-skill-c0',['atk']],
  ['chiori','chiori-skill-thrustatkscaling','idle-chiori-skill-c0',['atk','def']],
  ['alhaitham','alhaitham-skill-rushatk','idle-alhaitham-skill-c0',['atk','em']],
] as const)('retains %s single contact without implying its full lifecycle', (slug,skill,fullSkill,stats)=>{
  const id=gameDataCatalog.characters.find(c=>c.slug===slug)!.id;
  for(const level of [1,10,15]){
    const docs=getCharacterDocuments(id,level);
    const doc=docs.find(d=>d.gameContext?.skillId===skill)!;
    expect(doc.hits).toHaveLength(1);
    expect(doc.gameContext?.scopeCoverage).toBe('selected-components');
    const hit=doc.hits[0]!;
    if(hit.kind!=='ordinary'||doc.build.mode==='equipment-derived')throw Error('Expected independent ordinary contact');
    expect(hit.terms.map(t=>t.stat)).toEqual(stats);
    const panel=doc.build.stats;
    const manual=hit.terms.reduce((sum,t)=>sum+t.coefficient*panel[t.stat],0)*.5*.9;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(manual,8);
    expect(calculateDocument(docs.find(d=>d.gameContext?.skillId===fullSkill)!).status).toBe('blocked');
  }
  // A drift in this workspace's actual source field must not silently use archived coefficients.
  const workspace=structuredClone(releasedRuntimeWorkspace);
  const set=workspace.catalog.talentSets.find(t=>t.id===`talent-set:${slug}`)!;
  const ability=set.abilities.find(a=>a.key==='combat2')!;
  ability.parameters[slug==='chiori'?'param5':'param1']![0]!+=.001;
  const blocked=getCharacterDocuments(id,1,workspace).find(d=>d.gameContext?.skillId===skill)!;
  expect(calculateDocument(blocked).status).toBe('blocked');
  expect(calculateDocument(blocked).totals).toBeUndefined();
});
