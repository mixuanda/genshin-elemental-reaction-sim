import {describe,expect,it} from 'vitest';
import {getCharacterDocuments} from './character-calculations';

describe('showcase roles expose their actual main damage actions',()=>{
  it('Kazuha offers Q opening, Anemo tick and conditional complete Q separately',()=>{
    const docs=getCharacterDocuments('character:10000047',10);
    for(const id of ['kazuha-burst-slash','kazuha-burst-anemo-dot','kazuha-burst-complete']) {
      const doc=docs.find(d=>d.gameContext?.skillId===id);
      expect(doc,`missing ${id}`).toBeDefined();
      expect(doc!.gameContext?.abilityId).toBe('talent:kaedeharakazuha:combat3');
      expect(doc!.hits.some(h=>h.kind==='ordinary'&&h.attackTag==='burst')).toBe(true);
    }
  });
  it('Cyno offers six Q normal instances and a separate Q charged attack using Q talent',()=>{
    const docs=getCharacterDocuments('character:10000071',10).filter(d=>d.gameContext?.abilityId==='talent:cyno:combat3');
    const normal=docs.flatMap(d=>d.hits.filter(h=>h.kind==='ordinary'&&h.attackTag==='normal'));
    expect(normal).toHaveLength(6);
    expect(new Set(normal.map(h=>h.id)).size).toBe(6);
    expect(docs.flatMap(d=>d.hits.filter(h=>h.kind==='ordinary'&&h.attackTag==='charged'))).toHaveLength(1);
    expect(normal.every(h=>h.kind==='ordinary'&&h.element==='electro')).toBe(true);
  });
  it('Kinich offers E loop shots and Scalespiker damage independently of base charged attacks',()=>{
    const docs=getCharacterDocuments('character:10000101',10).filter(d=>d.gameContext?.abilityId==='talent:kinich:combat2');
    expect(docs.length).toBeGreaterThanOrEqual(3);
    expect(docs.some(d=>d.hits.length===2&&d.hits.every(h=>h.kind==='ordinary'&&h.attackTag==='skill'&&h.element==='dendro'))).toBe(true);
    expect(docs.some(d=>d.hits.length===1&&d.hits[0]?.kind==='ordinary'&&d.hits[0].terms.some(t=>t.stat==='atk'&&t.coefficient>10))).toBe(true);
  });
});
