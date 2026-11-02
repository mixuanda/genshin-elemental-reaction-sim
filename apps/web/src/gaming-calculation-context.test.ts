import {describe,expect,it} from 'vitest';
import {getCharacterDocuments} from './character-calculations';

describe('Gaming actual primary damage entries',()=>{
 it('offers E special plunge separately from ordinary high plunge',()=>{
  const docs=getCharacterDocuments('character:10000092',10);
  const special=docs.find(d=>d.gameContext?.skillId==='gaming-charmed-cloudstrider');
  expect(special).toBeDefined();
  expect(special!.gameContext?.abilityId).toBe('talent:gaming:combat2');
  expect(special!.hits[0]).toMatchObject({kind:'ordinary',element:'pyro',attackTag:'plunge',terms:[{stat:'atk',coefficient:4.1472}]});
 });
 it('offers Q opening damage independently of the old idle-return branch',()=>{
  const docs=getCharacterDocuments('character:10000092',10);
  expect(docs.find(d=>d.gameContext?.skillId==='gaming-burst-opening')?.hits).toHaveLength(1);
  expect(docs.find(d=>d.gameContext?.skillId==='idle-gaming-burst-c0')).toBeDefined();
 });
});
