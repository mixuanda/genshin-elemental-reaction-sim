import type { SourceHitMapping } from "./types";
import manifest from "../../sources/complete-followup-skills/manifest.json";
import optimizer from "../../sources/complete-followup-skills/manifest-go.json";

export const completeFollowupSkillSourceEvidence={...manifest,optimizer};
const coefficient=(id:string)=>manifest.coefficients.find(row=>row.id===id)!;
const commonAssumptions=[
  "C0；有效天赋等级显式提供。本动作仅合计本次完整施放列出的自身伤害；每次命中独立进入同一伤害核心。",
  "所有列出伤害均实际命中同一目标；目标防御、抗性及命中适用的最终属性、增伤、装备条件在其相关时点保持明确稳定，逐击反应仍独立输入。",
];
const commonExclusions=[
  "完整仅限所述条件下的自身伤害实例，不认证附着/ICD、动作取消、能量、粒子、治疗、敌人碰撞/目标选择或整队 DPS。",
  "当前仅 C0；更高命座不得直接借用该分支。来源与活动目录一致不代表已核验当前游戏实测。",
];
function mapping(input:{slug:string;table:string;skillId:string;skillLabel:string;hitLabel:string;count?:number;stat?:"atk"|"hp";assumptions:string[];exclusions?:string[]}):SourceHitMapping {
  const row=coefficient(`${input.slug}-${input.table}`),burst=row.abilityKey==="combat3";
  const elements={dori:"electro",baizhu:"dendro",nilou:"hydro",ganyu:"cryo"} as const;
  return {id:`${input.skillId}-${input.table}`,characterSlug:input.slug,talentSetId:`talent-set:${input.slug}`,abilityKey:burst?"combat3":"combat2",parameterKey:row.parameterKey,
    skillId:input.skillId,skillLabel:input.skillLabel,hitLabel:input.hitLabel,element:elements[input.slug as keyof typeof elements],scalingStat:input.stat??"atk",attackTag:burst?"burst":"skill",instanceCount:input.count??1,sourceCoefficientValues:row.values,coefficientTolerance:0,
    sourceRepository:"genshinsim/gcsim",sourceCommit:manifest.revision,sourcePaths:Object.keys(manifest.sourceSha256).filter(path=>path.includes(`/characters/${input.slug}/`)||path==="internal/template/character/character.go"||path==="pkg/enemy/damage.go"),
    completeAction:true,assumptions:[...commonAssumptions,...input.assumptions],exclusions:[...commonExclusions,...(input.exclusions??[])]};
}
const dori={slug:"dori",skillId:"dori-skill-complete-cast-c0",skillLabel:"镇灵之灯·完整初弹与两枚售后弹（C0）",assumptions:["初弹命中后回调只生成一次两枚售后弹；C0 的 afterCount=2，初弹和售后弹都命中同一目标。","初弹在 E 起手快照；售后弹在初弹命中回调时另取快照。输入明确假定两个时点进攻面板及相关装备条件一致；A4 回能可改变实战装备条件，本条件输入不得忽略其实际变化。"],exclusions:["A1 仅减 E 冷却，A4 仅回能；不把回能或 C6 普攻附魔伪装为本次 E 伤害。C1+ 增加第三枚售后弹，当前 C0 分支不包含它。"]};
const nilou={slug:"nilou",skillId:"nilou-burst-complete-cast-c0",skillLabel:"浮莲舞步·完整初击与永世流沔（C0）",stat:"hp" as const,assumptions:["初击实际命中并给同一存活敌人留下永世流沔；121 帧后延迟伤害正常结算，期间目标没有移除。","初击基础生命在施放时读取、进攻快照在初击时读取；永世流沔重新读取生命和面板。明确假定这些相关时点最大生命及伤害条件保持一致，不将初击快照强行复制为真实动态行为。"],exclusions:["A1/A4 丰穰之核属于反应实体，不并入两段水伤；命座2水减抗、命座4 Q增伤和命座6生命转双暴尚不属于此C0条件动作。"]};
const ganyu={slug:"ganyu",skillId:"ganyu-skill-complete-cast-c0",skillLabel:"山泽麟迹·完整释放与冰莲爆炸（C0）",assumptions:["释放和冰莲终止爆炸两次都命中同一稳定目标；未重放/置换该冰莲。固定源排程13与373帧，两段共同使用 E 起手同一快照。","起手时如实际处于甘雨 Q 场内并获得 A4 20% 冰伤，必须已在实际适用增伤中包含；若没有此状态就不填写该20%。后续场状态变化不会重采样 E 起手快照。"],exclusions:["A1 霜华矢条件暴击只作用于蓄力箭，不加入 E。当前仅 C0，目标已有 C1 减抗/C4递增易伤等高命座分支未由本映射处理。"]};

const baizhu={slug:"baizhu",skillId:"baizhu-skill-complete-cast-c0",skillLabel:"游丝徵灵·完整三击（C0·明确起手生命）",assumptions:["游丝徵灵连续三次命中同一存活目标；范围内未丢失目标、没有提前返回。三击均复制起手同一 Snapshot。","突破1 A1 按 E 起手在场角色生命比例>=50%时增加25%草伤，低于50%为治疗加成；起手实际比例与已含记账需要显式恢复，不能以当前HP或满血代替。"],exclusions:["治疗不计入伤害；A4 为Q护盾治疗赋予的反应加成，独立填写命中实际反应加成，不自动给普通E加成。C2额外灵体与C6护盾/灵气伤害属于尚未接入的高命座分支。"]};

export const completeFollowupSkillMappings:SourceHitMapping[]=[
  mapping({...dori,table:"skill",hitLabel:"断除烦恼炮·初弹"}),
  mapping({...dori,table:"skillAfter",hitLabel:"售后服务弹",count:2}),
  mapping({...nilou,table:"burst",hitLabel:"浮莲舞步·初始水伤"}),
  mapping({...nilou,table:"burstAeon",hitLabel:"永世流沔·延迟水伤"}),
  mapping({...ganyu,table:"lotus",hitLabel:"冰莲伤害（释放／爆炸）",count:2}),
  mapping({...baizhu,table:"skillDamage",hitLabel:"游丝徵灵",count:3}),
];
/** Individual hits remain selectable inside the complete cast; remove duplicate partial menus. */
export const replacedCompleteFollowupPartialMappingIds=new Set(["dori-skill-hit","dori-skill-skillafter-hit","nilou-burst-burst-hit","nilou-burst-burstaeon-hit","ganyu-skill-lotus-hit","baizhu-skill-skilldamage-hit"]);
