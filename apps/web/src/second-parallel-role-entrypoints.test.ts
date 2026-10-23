import {describe,expect,it} from 'vitest';
import {getCharacterDocuments} from './character-calculations';

describe('player primary outputs for the second parallel role batch',()=>{
  it('offers Hu Tao Pyro charged damage during Paramita Papilio, separately from the base charged attack',()=>{
    const documents=getCharacterDocuments('character:10000046',10);
    const enhanced=documents.filter(document=>/彼岸蝶舞|蝶引来生/.test(document.gameContext?.skillName??'')
      && document.hits.some(hit=>hit.kind==='ordinary'&&hit.attackTag==='charged'&&hit.element==='pyro'));
    expect(enhanced).toHaveLength(1);
    expect(documents.some(document=>document.gameContext?.skillId==='hutao-charged-base')).toBe(true);
  });
  it('offers Alhaitham mirror projection damage for one, two and three mirrors',()=>{
    const documents=getCharacterDocuments('character:10000078',10);
    const projections=documents.filter(document=>/投射/.test(document.gameContext?.skillName??'')
      && document.hits.some(hit=>hit.kind==='ordinary'&&hit.element==='dendro'&&hit.attackTag==='skill'));
    expect(projections).toHaveLength(3);
    expect(new Set(projections.map(document=>document.gameContext?.skillId)).size).toBe(3);
  });
  it('offers Arlecchino Mask of the Red Death normal damage with real Pyro hits',()=>{
    const documents=getCharacterDocuments('character:10000096',10);
    const normals=documents.filter(document=>/红死之宴/.test(document.gameContext?.skillName??'')
      && document.hits.some(hit=>hit.kind==='ordinary'&&hit.attackTag==='normal'&&hit.element==='pyro'));
    expect(normals.length).toBeGreaterThanOrEqual(6);
    expect(normals.every(document=>document.hits.every(hit=>hit.kind==='ordinary'&&hit.groupMultiplier===1))).toBe(true);
  });
});
