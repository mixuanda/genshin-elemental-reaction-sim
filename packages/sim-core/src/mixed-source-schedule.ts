import { mixedSourceCastBaseSchema, type MixedSourceScheduleContext } from "./mixed-source-context";
export const MIXED_SOURCE_CAST_KINDS=["mixed-lauma-hold-skill-c0","mixed-flins-burst-c0","mixed-odette-coda-c0"] as const;
export type MixedSourceCastKind=typeof MIXED_SOURCE_CAST_KINDS[number];
export interface MixedSourceCandidate {id:string;templateRole:string;frame:number;snapshotFrame:number;snapshotId:string;targetId:string;contact?:boolean;dewConsumed?:number;laumaOwnShredActive?:boolean;odetteA1Stacks?:number}
export interface MixedSourceSchedule {candidates:MixedSourceCandidate[];instances:MixedSourceCandidate[];issues:string[];decisions:Array<{frame:number;reason:string}>;lifecycleEndFrame:number;requiredObservedThroughFrame:number}
/** Explicit observation compiler. It never manufactures a contact, resource gain, or field. */
export function compileMixedSourceSchedule(kind:MixedSourceCastKind,raw:MixedSourceScheduleContext):MixedSourceSchedule {
  const c=mixedSourceCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key])=>key!=="snapshots"))),issues:string[]=[],candidates:MixedSourceCandidate[]=[],decisions:MixedSourceSchedule["decisions"]=[];
  let end=0;
  const need=(value:unknown,message:string)=>{if(value!==true)issues.push(message);};
  for(const [key,label] of [["noHitlag","明确无卡肉"],["noInterruption","明确没有打断"],["noReplacement","明确没有替换、重施或未列出的自身动作"],["fullObservedLifetime","确认完整观察本次生命周期"]] as const)need(c[key],label);
  if(!c.casterId||!c.targetId)issues.push("需要明确施放者和本次目标身份。");
  const add=(id:string,role:string,frame:number,snapshotFrame=frame,extra:Partial<MixedSourceCandidate>={})=>{
    const contact=c.targetContacts?.[id]; if(contact===undefined)issues.push(`需要明确候选 ${id} 是否接触目标。`);
    const row={id,templateRole:role,frame,snapshotFrame,snapshotId:`snapshot-${snapshotFrame}`,targetId:c.targetId??"unknown-target",...(contact===undefined?{}:{contact}),...extra};candidates.push(row);return row;
  };
  if(kind==="mixed-lauma-hold-skill-c0"){
    const l=c.lauma;need(l?.burstInactive,"本协议需要Q全程不生效，月咏不会转为苍色祷歌。");need(l?.noOtherMoonSongRefresh,"需要明确无其他月咏刷新。");need(l?.noPriorShred,"完整日程需明确目标没有此前菈乌玛减抗。");need(l?.dewHistoryComplete,"需要确认起手至第29帧的草露变化记录完整。");
    if(l?.initialDew===undefined)issues.push("长按起手需要实际1至3枚草露。");
    if(l?.dewEvents===undefined)issues.push("需要实际草露变化列表；空列表表示明确无变化。");
    let dew=l?.initialDew??0;const seen=new Set<string>();
    for(const e of [...l?.dewEvents??[]].sort((a,b)=>a.frame-b.frame)){
      if(seen.has(e.id))issues.push(`草露事件ID重复：${e.id}`);seen.add(e.id);
      if(e.frame===29)issues.push("第29帧其他草露事件与自身消费顺序不明；请使用不重叠的实际事件记录。");
      if(e.kind==="consume"&&e.amount>dew)issues.push(`第${e.frame}帧草露消费超过实际库存。`);
      dew=e.kind==="gain"?Math.min(3,dew+e.amount):Math.max(0,dew-e.amount);
      decisions.push({frame:e.frame,reason:`${e.id} 后草露库存 ${dew}`});
    }
    const consumed=Math.min(3,dew);decisions.push({frame:29,reason:`实际消费${consumed}枚草露；非零月咏到第929帧结束。`});
    add("hold","hold",45,45,{laumaOwnShredActive:false});
    add("lunar-bloom","lunarBloom",45,45,{dewConsumed:consumed});
    for(let i=0;i<8;i++)add(`sanctuary-${i+1}`,"sanctuary",62+117*i);
    let shredUntil=-1;
    for(const row of candidates){row.laumaOwnShredActive=row.frame<=shredUntil;if(row.contact===true)shredUntil=row.frame+600;}
    end=Math.max(1200,shredUntil);decisions.push({frame:900,reason:"霜林圣域15秒结束；8次来源回调均已记录。"},{frame:end,reason:"本协议月咏、A1窗口和最后一次接触减抗全部结束。"});
  }else if(kind==="mixed-flins-burst-c0"){
    need(c.flins?.symphonyInactive,"起手雷霆交响必须未激活，才能使用普通Q序列。");
    if(c.moonsignLevel===undefined)issues.push("需要实际月兆等级决定中间段数。");
    add("initial","initial",93);const count=(c.moonsignLevel??0)>=2?4:2;
    for(let i=0;i<count;i++)add(`middle-${i+1}`,"middle",110+9*i,93);
    add("final","final",164,93);end=164;
    decisions.push({frame:93,reason:"普通Q及全部月感电段在此帧捕获进攻面板；后续命中时的固有基础提升另行读取。"});
  }else{
    const o=c.odette;need(o?.burstBuffInactive,"此终奏协议需要本击及后续星烁均无Q增益，不能猜测此前Q的等级和效果。");if(!o?.danceDoubleRemainingFrames)issues.push("重施起手必须有实际仍存活的倒影，并给出其剩余帧数。");
    if(!o?.recastWindowRemainingFrames)issues.push("重施起手必须处于实际394帧重施窗口内。");
    need(o?.specialSkillCooldownReady,"需要明确特殊E冷却就绪。");need(o?.remainsOnFieldThroughout,"此C0协议需要奥黛塔全程在场，避免未建模的59.25帧A1移交。");need(o?.radianceHistoryComplete,"需要完整记录已有星旋剩余时间、后续星旋事件与极星领域区间。");
    if(o?.priorStellarSwirlRemainingFrames===undefined||o.stellarSwirlFrames===undefined||o.polestarIntervals===undefined)issues.push("光耀记录不可留空：填写已有星旋剩余帧和两类事件列表，空列表表示无事件。");
    if(o?.a1StacksAtStart===undefined)issues.push("需要重施开始时实际自身A1层数，不能假定重新获得4层。");
    const intervals=o?.polestarIntervals??[];if(intervals.some(x=>x.endFrame<x.startFrame))issues.push("极星区间结束不能早于开始。");
    const radiance=(frame:number)=>intervals.some(x=>frame>=x.startFrame&&frame<=x.endFrame)?"SSC":(frame<=(o?.priorStellarSwirlRemainingFrames??-1)&&!!o?.priorStellarSwirlRemainingFrames)||(o?.stellarSwirlFrames??[]).some(f=>f<=frame&&frame<=f+480)?"SSw":"none";
    for(const [i,f] of [11,20,28].entries())add(`coda-${i+1}`,"coda",f);
    const remaining=o?.danceDoubleRemainingFrames??0;
    add("coda-final",radiance(62)==="SSw"?"codaSSw":"codaSSC",62,62,{odetteA1Stacks:62<=remaining?o?.a1StacksAtStart??0:0});
    let frame=114,index=0;
    while(frame<=remaining){const role=index%2===0?"plume":"wing";add(`dance-${index+1}`,role,frame);
      const light=radiance(frame);if(frame<=1262&&light!=="none")add(`dance-${index+1}-stellar`,`${role}${light}`,frame,frame,{odetteA1Stacks:o?.a1StacksAtStart??0});
      frame+=index%2===0?109:125;index++;
    }
    end=Math.max(1262,remaining);decisions.push({frame:0,reason:"取消旧倒影回调；不刷新其原有到期时间。"},{frame:62,reason:"终段触发倒影升级1200帧；无光耀时终段仍依固定源码走星导，倒影追加则不触发。"},{frame:114,reason:"从羽舞重新启动倒影，后续交替109/125帧直至原有到期。"});
  }
  const required=end+(kind==="mixed-flins-burst-c0"?0:1);
  if(c.observedThroughFrame===undefined||c.observedThroughFrame<required)issues.push(`需完整观察至第${required}帧（含已发出伤害及效果到期后的首帧）。`);
  return {candidates,instances:candidates.filter(x=>x.contact===true),issues:[...new Set(issues)],decisions,lifecycleEndFrame:end,requiredObservedThroughFrame:required};
}
