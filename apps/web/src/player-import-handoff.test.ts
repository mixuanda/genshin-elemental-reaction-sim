import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importPlayerInput } from '../../../packages/player-import/src/index';
import { preparePlayerEquipment } from './player-import-handoff';
const input=readFileSync(new URL('../../../packages/player-import/fixtures/synthetic-good.json',import.meta.url),'utf8');
function imported(){const result=importPlayerInput(input,{fixture:true});if(!result.ok)throw Error(result.message);return result.snapshot;}
it('passes legal equipment, base talents, C0 and provenance without adding panel stats',()=>{
 const s=imported(),b=s.builds[0]!;const before=preparePlayerEquipment(b,s.source);
 expect(before.metadata.baseTalentLevels).toEqual({auto:10,skill:10,burst:10});expect(before.metadata.constellation).toBe(0);
 expect(before.metadata.label).toContain('合成测试数据');
 b.panel.stats.push({key:{state:'known',value:'atk',path:'test',unit:'identity',note:''},amount:{state:'known',value:999999,path:'test',unit:'flat',note:''}});
 expect(preparePlayerEquipment(b,s.source)).toEqual(before);
});
it('blocks unknown progression, effective-only talents and illegal constellation',()=>{
 for(const mutate of [(b:any)=>{b.level.value=null;b.level.state='missing'},(b:any)=>{b.talents.skill.base.value=null;b.talents.skill.base.state='missing';b.talents.skill.effective.value=13},(b:any)=>{b.constellation.value=7}]){
 const s=imported();mutate(s.builds[0]);expect(()=>preparePlayerEquipment(s.builds[0]!,s.source)).toThrow();
 }
});
it('existing equipment validator rejects mismatched character/weapon types',()=>{
 const s=imported();s.builds[0]!.identity.value={id:'character:10000034',name:'诺艾尔'};
 expect(()=>preparePlayerEquipment(s.builds[0]!,s.source)).toThrow();
});
