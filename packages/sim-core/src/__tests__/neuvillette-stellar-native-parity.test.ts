import {expect,it} from 'vitest';
import fixture from './fixtures/neuvillette-stellar-native.json';
import {gameDataCatalog} from '../../../game-data/src/catalog';
import {getCharacterDocuments} from '../../../../apps/web/src/character-calculations';
import {calculateDocument} from '../calculator';

// Compact projections of real browser runs; complete captures and hashes are in
// stellar-a4-fix-20261021. Coefficients checked against pinned a7 zz_neuvillette.dm.go.
const hpCoefficients: Record<string,number>={
 'O Tears, I Shall Repay':.12864,
 'O Tides, I Have Returned: Skill DMG':.222578,
 'O Tides, I Have Returned: Waterfall DMG':.091055,
 'Charged Attack: Equitable Judgment':.073186
};
it.each(fixture.runs)('matches Stellar native hits and independent E without duplicate A4: $name',run=>{
 expect(fixture.sourceCommit).toBe('a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd');
 expect(run.endFrame).toBe(7200);
 expect(run.hits).toHaveLength(run.kind==='energy'?22:20);
 let independentHits=0;
 for(const hit of run.hits){
  const bonus=Math.max(0,Math.min(.3,(hit.hpRatio-.3)*.6));
  expect(hit.damageBonus).toBeCloseTo(bonus,12);
  if(hit.ability in hpCoefficients){
   expect(hit.scaling).toBe(0);
   expect(hit.flatDamage).toBeCloseTo(hit.maxHp*hpCoefficients[hit.ability]!,8);
  } else {
   expect(hit.ability).toBe('Spiritbreath Thorn (neuvillette)');
   expect(hit.scaling).toBe(.208);expect(hit.flatDamage).toBe(0);
  }
  const manual=(hit.scalingValue*hit.scaling+hit.flatDamage)*.5*.9*(1+bonus)*(hit.isCrit?1+hit.critDamage:1);
  expect(hit.rawDamage).toBeCloseTo(manual,8);
  if(hit.ability!=='O Tears, I Shall Repay')continue;
  independentHits++;
  const d=getCharacterDocuments(gameDataCatalog.characters.find(c=>c.slug==='neuvillette')!.id,1).find(d=>d.gameContext?.skillId==='neuvillette-skill')!;
  if(d.build.mode==='equipment-derived'||d.hits[0]?.kind!=='ordinary')throw Error('Missing independent HP skill');
  d.build.stats.hp=hit.maxHp;d.build.stats.critRate=hit.critRate;d.build.stats.critDamage=hit.critDamage;
  d.gameContext!.batchProjectileCast={hitStates:{'neuvillette-skill-hit':{actualHpRatio:hit.hpRatio,includedHydroBonus:0}}};
  const calculated=calculateDocument(d);expect(calculated.status).toBe('calculated');
  expect(hit.isCrit?calculated.totals!.critical:calculated.totals!.nonCritical).toBeCloseTo(hit.rawDamage,8);
  d.hits[0].damageBonus=bonus;
  d.gameContext!.batchProjectileCast.hitStates!['neuvillette-skill-hit']!.includedHydroBonus=bonus;
  expect(calculateDocument(d).totals).toEqual(calculated.totals);
  delete d.gameContext!.batchProjectileCast.hitStates!['neuvillette-skill-hit']!.actualHpRatio;
  expect(calculateDocument(d).status).toBe('blocked');
 }
 expect(independentHits).toBe(run.kind==='energy'?8:2);
});
