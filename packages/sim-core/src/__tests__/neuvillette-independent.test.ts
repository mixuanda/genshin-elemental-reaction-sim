import {expect,it} from 'vitest';
import {gameDataCatalog} from '../../../game-data/src/catalog';
import {getCharacterDocuments} from '../../../../apps/web/src/character-calculations';
import {calculateDocument,parseCalculatorDocument,serializeCalculatorDocument,convertCalculatorToFinalPanel} from '../calculator';

const get=()=>getCharacterDocuments(gameDataCatalog.characters.find(c=>c.slug==='neuvillette')!.id,1).find(d=>d.gameContext?.skillId==='neuvillette-skill')!;
it('keeps the independent HP contact blocked until its actual A4 state is explicit',()=>{
 const d=get();expect(d.hits).toHaveLength(1);expect(d.gameContext?.scopeCoverage).toBe('selected-components');
 expect(d.hits[0]).toMatchObject({kind:'ordinary',terms:[{stat:'hp',coefficient:.12864}]});
 expect(calculateDocument(d).status).toBe('blocked');
 d.gameContext!.batchProjectileCast={hitStates:{'neuvillette-skill-hit':{actualHpRatio:.5}}};
 expect(calculateDocument(d).status).toBe('blocked');
 d.gameContext!.batchProjectileCast.hitStates!['neuvillette-skill-hit']={includedHydroBonus:0};
 expect(calculateDocument(d).status).toBe('blocked');
 d.gameContext!.ascension=3;
 expect(calculateDocument(d).status).toBe('calculated'); // Locked A4 needs no fictitious HP ratio.
});
it.each([[.3,0],[.5,.12],[.8,.3],[1,.3]])('replays HP ratio %s without counting A4 twice', (ratio,bonus)=>{
 const d=get();d.gameContext!.batchProjectileCast={hitStates:{'neuvillette-skill-hit':{actualHpRatio:ratio,includedHydroBonus:0}}};
 const result=calculateDocument(d);expect(result.status).toBe('calculated');
 expect(result.totals!.nonCritical).toBeCloseTo(20000*.12864*.5*.9*(1+bonus!),8);
 if(d.build.mode==='equipment-derived'||d.hits[0]!.kind!=='ordinary')throw Error();
 d.build.stats.atk=99999;expect(calculateDocument(d).totals).toEqual(result.totals);
 d.hits[0]!.damageBonus=bonus!;d.gameContext!.batchProjectileCast.hitStates!['neuvillette-skill-hit']!.includedHydroBonus=bonus!;
 expect(calculateDocument(d).totals).toEqual(result.totals);
 expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(d))).totals).toEqual(result.totals);
 expect(calculateDocument(convertCalculatorToFinalPanel(d)).totals).toEqual(result.totals);
});
