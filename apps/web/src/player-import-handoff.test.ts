import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importPlayerInput, applyPreview } from '../../../packages/player-import/src/index';
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

import { preparePlayerPanel } from './player-import-handoff';
import { parseEnkaShowcase, resolveShowcaseCatalog } from '../../../packages/game-data/src/showcase';
const panelRaw=readFileSync(new URL('../e2e/fixtures/player-import/kaeya-enka-panel.json',import.meta.url),'utf8');
function panel(raw=panelRaw){const r=importPlayerInput(raw,{fixture:true});if(!r.ok)throw Error(r.message);return {s:r.snapshot,b:r.snapshot.builds[0]!};}
it('panel route accepts missing equipment and zero EM, preserves C3 effective E13 without additions',()=>{
 const {s,b}=panel();expect(b.completeness.state).toBe('partial');
 const p=preparePlayerPanel(panelRaw,b,s.source);
 expect(p.character.stats.attack).toBe(1700);expect(p.character.stats.elementalMastery).toBe(0);
 expect(p.character.resolvedSkills.find(s=>s.skillId==='10074')?.effectiveLevel).toBe(13);
 expect(p.character.weapon).toBeNull();expect(p.source).toContain('战斗条件未还原');
});
it('panel blocks missing properties, unknown skills, duplicate identity and inconsistent levels',()=>{
 for(const mutate of [(j:any)=>delete j.avatarInfoList[0].fightPropMap['28'],(j:any)=>j.avatarInfoList[0].skillLevelMap={'999999':10},(j:any)=>j.avatarInfoList.push(j.avatarInfoList[0]),(j:any)=>j.avatarInfoList[0].propMap['4001'].val='',(j:any)=>delete j.avatarInfoList[0].proudSkillExtraLevelMap]){
 const j=JSON.parse(panelRaw);mutate(j);const raw=JSON.stringify(j);const {s,b}=panel(raw);expect(()=>preparePlayerPanel(raw,b,s.source)).toThrow();
 }
});
it('panel preserves previous complete data on a failed refresh',()=>{
 const {s}=panel();const r=applyPreview(s,{ok:false,code:'unavailable',message:'HTTP 429'});expect(r.current).toBe(s);expect(r.applied).toBe(false);
});

it('honors authoritative val and documented absent Enka C0; malformed lists remain blocked',()=>{
 const j=JSON.parse(panelRaw);delete j.avatarInfoList[0].propMap['4001'].ival;delete j.avatarInfoList[0].talentIdList;j.avatarInfoList[0].proudSkillExtraLevelMap={};
 const raw=JSON.stringify(j),{s,b}=panel(raw);expect(preparePlayerPanel(raw,b,s.source).character.constellation).toBe(0);
 for(const value of [null,'bad',{},[1,1]]){j.avatarInfoList[0].talentIdList=value;const text=JSON.stringify(j);const {s,b}=panel(text);expect(()=>preparePlayerPanel(text,b,s.source)).toThrow();}
});

it('UID and preview resolve the same authoritative level without altering the raw source',()=>{
 const j=JSON.parse(panelRaw);j.avatarInfoList[0].propMap['4001']={val:'90',ival:'1'};
 const raw=JSON.stringify(j),{s,b}=panel(raw),before=JSON.stringify(b);
 const uid=resolveShowcaseCatalog(parseEnkaShowcase(j,{uid:'900000003'})).characters[0]!;
 const preview=preparePlayerPanel(raw,b,s.source).character;
 expect(uid).toEqual(preview);expect(uid.level).toBe(90);
 expect(uid.resolvedSkills.find(s=>s.skillId==='10074')?.effectiveLevel).toBe(13);
 expect(JSON.stringify(b)).toBe(before);expect(j.avatarInfoList[0].propMap['4001'].ival).toBe('1');
});

it('blocks ival-only panel levels instead of restoring them through the bridge',()=>{
 const j=JSON.parse(panelRaw);delete j.avatarInfoList[0].propMap['4001'].val;
 const raw=JSON.stringify(j),{s,b}=panel(raw);
 expect(b.level).toMatchObject({state:'missing',value:null});
 expect(()=>preparePlayerPanel(raw,b,s.source)).toThrow('角色等级未知');
});
