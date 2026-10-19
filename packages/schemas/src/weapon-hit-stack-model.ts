import { z } from "zod";
export const WEAPON_HIT_STACK_PROFILE_ID="gcsim-b4ae769-weapon-hit-stacks-v1" as const;
const root="https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
export const WEAPON_HIT_STACK_IDS=["weapon:11404","weapon:12404","weapon:13408","weapon:14404","weapon:15404","weapon:11504","weapon:12504","weapon:13504","weapon:14504","weapon:11406","weapon:12407","weapon:13505","weapon:11407"] as const;
export type WeaponHitStackId=typeof WEAPON_HIT_STACK_IDS[number];
export type WeaponHitStackFamily="royal"|"golden-majesty"|"rancour"|"whiteblind"|"primordial"|"iron-sting";
export interface WeaponHitStackRule { family:WeaponHitStackFamily; name:string; sourceRef:string; onFieldOnly:boolean; nonzeroDamageOnly:boolean; normalChargedOnly:boolean; elementalOnly:boolean; cap:number; cooldownFrames:number; durationFrames:number|null; }
const rules:Record<WeaponHitStackFamily,WeaponHitStackRule>={
 royal:{family:"royal",name:"宗室专注",sourceRef:root+"internal/weapons/common/royal.go",onFieldOnly:false,nonzeroDamageOnly:true,normalChargedOnly:false,elementalOnly:false,cap:5,cooldownFrames:18,durationFrames:null},
 "golden-majesty":{family:"golden-majesty",name:"金璋皇极",sourceRef:root+"internal/weapons/common/goldenmajesty.go",onFieldOnly:true,nonzeroDamageOnly:false,normalChargedOnly:false,elementalOnly:false,cap:5,cooldownFrames:18,durationFrames:480},
 rancour:{family:"rancour",name:"试作斩岩碎石",sourceRef:root+"internal/weapons/sword/prototype/prototype.go",onFieldOnly:true,nonzeroDamageOnly:false,normalChargedOnly:true,elementalOnly:false,cap:4,cooldownFrames:18,durationFrames:360},
 whiteblind:{family:"whiteblind",name:"白影剑注能之锋",sourceRef:root+"internal/weapons/claymore/whiteblind/whiteblind.go",onFieldOnly:true,nonzeroDamageOnly:false,normalChargedOnly:true,elementalOnly:false,cap:4,cooldownFrames:30,durationFrames:360},
 primordial:{family:"primordial",name:"和璞鸢昭理的鸢之枪",sourceRef:root+"internal/weapons/spear/primordial/primordial.go",onFieldOnly:true,nonzeroDamageOnly:false,normalChargedOnly:false,elementalOnly:false,cap:7,cooldownFrames:18,durationFrames:360},
 "iron-sting":{family:"iron-sting",name:"铁蜂刺注能之刺",sourceRef:root+"internal/weapons/sword/ironsting/ironsting.go",onFieldOnly:true,nonzeroDamageOnly:false,normalChargedOnly:false,elementalOnly:true,cap:2,cooldownFrames:60,durationFrames:360},
};
const familyById:Record<WeaponHitStackId,WeaponHitStackFamily>={"weapon:11404":"royal","weapon:12404":"royal","weapon:13408":"royal","weapon:14404":"royal","weapon:15404":"royal","weapon:11504":"golden-majesty","weapon:12504":"golden-majesty","weapon:13504":"golden-majesty","weapon:14504":"golden-majesty","weapon:11406":"rancour","weapon:12407":"whiteblind","weapon:13505":"primordial","weapon:11407":"iron-sting"};
export const getWeaponHitStackRule=(id:WeaponHitStackId):WeaponHitStackRule=>rules[familyById[id]];
const text=z.string().trim().min(1),frame=z.number().int().nonnegative();
export const weaponHitStackActorSchema=z.strictObject({actorId:text,weaponId:z.enum(WEAPON_HIT_STACK_IDS),refinement:z.number().int().min(1).max(5)});
export const weaponHitStackModelSchema=z.strictObject({mode:z.literal("fixed-source-no-character-hitlag-v1"),baselineUnbuffed:z.literal(true),actors:z.array(weaponHitStackActorSchema).min(1).max(4)}).superRefine((m,ctx)=>{if(new Set(m.actors.map(a=>a.actorId)).size!==m.actors.length)ctx.addIssue({code:"custom",message:"每名角色只能选择一把真实武器，不能并用两个叠层被动。"});});
export type WeaponHitStackActor=z.infer<typeof weaponHitStackActorSchema>;export type WeaponHitStackModel=z.infer<typeof weaponHitStackModelSchema>;
export const weaponHitStackStateSchema=z.strictObject({stacks:z.number().int().min(0).max(7),effectExpiresFrame:frame.nullable(),cooldownExpiresFrame:frame.nullable()});
export type WeaponHitStackState=z.infer<typeof weaponHitStackStateSchema>;
export const weaponHitStackCapturedStateSchema=z.strictObject({profileId:z.literal(WEAPON_HIT_STACK_PROFILE_ID),actors:z.array(weaponHitStackActorSchema.extend({state:weaponHitStackStateSchema})).max(4)});
export type WeaponHitStackCapturedState=z.infer<typeof weaponHitStackCapturedStateSchema>;
/** The host reports an actual resolved enemy callback. Royal requires a real boolean critical outcome. */
export type WeaponHitStackEvent=
 |{kind:"enemy-damage";frame:number;sourceActorId:string;activeCharacterId:string|null;parentDamageEventId:number;targetId:string;attackTag:string;element:string;damage:number;critical:boolean|null}
 |{kind:"stats-sample";frame:number;actorId:string;shielded:boolean};
export interface WeaponHitStackValues {atkPct:number;defPct:number;critRate:number;dmgBonus:number;}
export type WeaponHitStackOutcome="stack-gained"|"cap-refreshed"|"critical-reset"|"cooldown-blocked"|"off-field"|"wrong-owner"|"zero-damage"|"ineligible-tag"|"physical-damage"|"actual-critical-required"|"stats-read"|"expired-on-read";
export interface WeaponHitStackDecision {sourceProfileId:typeof WEAPON_HIT_STACK_PROFILE_ID;sourceRef:string;actor:WeaponHitStackActor;event:WeaponHitStackEvent;outcome:WeaponHitStackOutcome;stateBefore:WeaponHitStackState;stateAfter:WeaponHitStackState;values:WeaponHitStackValues|null;}
export const WEAPON_HIT_STACK_SOURCE={profileId:WEAPON_HIT_STACK_PROFILE_ID,revision:"b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",evidence:"fixed-source-assumed",sourceRefs:[...new Set(Object.values(rules).map(r=>r.sourceRef)),root+"pkg/core/player/character/mods.go",root+"pkg/core/player/character/stats.go",root+"pkg/modifier/modifier.go"],assumptions:[
 "仅执行13把武器的命中叠层条款；角色本体基础面板、常驻副属性以及金璋皇极护盾强效由独立构筑/护盾条款承担，不再加一次。",
 "共享宿主的普通真实敌方伤害回调可与月曜/星辉共用；独立特殊伤害的持有者及贡献者须有另行认证的交付与完整Stats读取，不能借普通回调冒充。不会把期望暴击当成宗室的实际暴击反馈。",
 "来源Status与StatMod存在性在到期帧含等号，实际Stats读取在到期帧删除已到期属性modifier；只读审计不改变状态。",
 "固定60帧/秒且无角色卡肉；后续真实命中读取新属性，已有进攻快照不追溯改写。",
 "金璋皇极的双倍ATK读取当时真实护盾庇护；不从曾经生成过护盾或盾值输入猜测。",
]} as const;

const valuesSchema=z.strictObject({atkPct:z.number().finite(),defPct:z.number().finite(),critRate:z.number().finite(),dmgBonus:z.number().finite()});
export const weaponHitStackEventSchema=z.discriminatedUnion("kind",[
 z.strictObject({kind:z.literal("enemy-damage"),frame,sourceActorId:text,activeCharacterId:text.nullable(),parentDamageEventId:frame,targetId:text,attackTag:text,element:text,damage:z.number().finite(),critical:z.boolean().nullable()}),
 z.strictObject({kind:z.literal("stats-sample"),frame,actorId:text,shielded:z.boolean()})
]);
export const weaponHitStackLogEntrySchema=z.strictObject({
 id:frame,sourceProfileId:z.literal(WEAPON_HIT_STACK_PROFILE_ID),sourceRef:text,actor:weaponHitStackActorSchema,event:weaponHitStackEventSchema,
 outcome:z.enum(["stack-gained","cap-refreshed","critical-reset","cooldown-blocked","off-field","wrong-owner","zero-damage","ineligible-tag","physical-damage","actual-critical-required","stats-read","expired-on-read"]),
 stateBefore:weaponHitStackStateSchema,stateAfter:weaponHitStackStateSchema,values:valuesSchema.nullable(),trace:z.array(z.unknown()),
 frame,timeSeconds:z.number().finite().nonnegative(),eventPriority:z.number().finite(),eventSequence:frame,intraEventSequence:frame,
}).superRefine((row,context)=>{if(row.frame!==row.event.frame)context.addIssue({code:"custom",path:["frame"],message:"weapon callback and execution queue frame must agree"});});
export type WeaponHitStackLogEntry=z.infer<typeof weaponHitStackLogEntrySchema>;
export function weaponHitStackWeaponType(id:WeaponHitStackId):"sword"|"claymore"|"polearm"|"catalyst"|"bow" {return ({"1":"sword","2":"claymore","3":"polearm","4":"catalyst","5":"bow"} as const)[id.slice(8,9) as "1"|"2"|"3"|"4"|"5"];}
