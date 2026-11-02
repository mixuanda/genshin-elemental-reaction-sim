import {expect,it} from 'vitest';
import fixture from './fixtures/neuvillette-a4-native-e.json';
import {gameDataCatalog} from '../../../game-data/src/catalog';
import {getCharacterDocuments} from '../../../../apps/web/src/character-calculations';
import {calculateDocument} from '../calculator';

it.each(fixture.cases)('matches native E at actual HP ratio $actualHpRatio frame $frame without double A4',row=>{
 const d=getCharacterDocuments(gameDataCatalog.characters.find(c=>c.slug==='neuvillette')!.id,1).find(d=>d.gameContext?.skillId==='neuvillette-skill')!;
 if(d.build.mode==='equipment-derived'||d.hits[0]?.kind!=='ordinary')throw Error('Expected independent HP entry');
 d.build.stats.hp=row.maxHp;d.build.stats.critRate=row.critRate;d.build.stats.critDamage=row.critDamage;
 d.gameContext!.batchProjectileCast={hitStates:{'neuvillette-skill-hit':{actualHpRatio:row.actualHpRatio,includedHydroBonus:0}}};
 const result=calculateDocument(d);expect(result.status).toBe('calculated');
 expect(row.damageBonus).toBeCloseTo(Math.max(0,Math.min(.3,(row.actualHpRatio-.3)*.6)),12);
 expect(row.isCrit?result.totals!.critical:result.totals!.nonCritical).toBeCloseTo(row.rawDamage,8);
 d.hits[0].damageBonus=row.damageBonus;
 d.gameContext!.batchProjectileCast.hitStates!['neuvillette-skill-hit']!.includedHydroBonus=row.damageBonus;
 expect(calculateDocument(d).totals).toEqual(result.totals);
});
