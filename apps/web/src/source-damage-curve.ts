import type {SourceHostResult,SourceHostDamageRequest} from '../../../packages/sim-core/src/source-host-wire';
import {sourceHostFixedDamageWindow} from '../../../packages/sim-core/src/source-host-observation-window';
import {classifyWandererTeamProjection} from './wanderer-team-state-attribution';
export const SOURCE_CURVE_FPS = 60; // Fixed gcsim time unit, not the game display/server frame rate.
export type DamageDimension='actor'|'source'|'element'|'reaction';
export interface CurveHit {id:number;calculationId:number;frame:number;damage:number;actor:string;source:string;element:string;reaction:string;ability:string;provider?:string;mechanism?:string;parentAttackId?:number}
export interface CurveBuff {key:string;actorIndex:number;startFrame:number;endFrame:number;logIndices:number[];label:string}
export interface CurveModel {endFrame:number;hits:CurveHit[];markers:Array<{id:number;frame:number;actor:string;action:string}>;buffs:CurveBuff[];unclassifiedBuffLogs:number}
const tags:Record<string,string>={AttackTagNormal:'普攻',AttackTagExtra:'重击',AttackTagPlunge:'下落',AttackTagElementalArt:'E',AttackTagElementalArtHold:'E',AttackTagElementalBurst:'Q'};
const elements:Record<string,string>={pyro:'火',hydro:'水',cryo:'冰',electro:'雷',anemo:'风',geo:'岩',dendro:'草',physical:'物理'};
const reactions:Record<string,string>={melt:'融化（整次增幅命中）',vaporize:'蒸发（整次增幅命中）',aggravate:'超激化',spread:'蔓激化'};
export function fixedDamageWindow(r:SourceHostResult){
 return sourceHostFixedDamageWindow(r);
}
export function buildSourceDamageCurve(r:SourceHostResult):CurveModel {
 const window=fixedDamageWindow(r);if(!window)throw Error('曲线暂要求完整定时观察窗及逐击帧记录；提前结束或缺记录时不补造时间轴。');
 const rows=new Map(r.calculations.map(c=>[c.request.id,c.request]));
 const damageByAttack=new Map<number,SourceHostDamageRequest[]>();
 for(const app of window.applications){const q=rows.get(app.calculationId);if(q?.kind!=='damage'||q.attackId!==app.attackId||q.frame!==app.frame)continue;
  const parents=damageByAttack.get(q.attackId)??[];parents.push(q);damageByAttack.set(q.attackId,parents);
 }
 const hits=window.applications.map(a=>{
  const q=rows.get(a.calculationId);let reaction='unknown';
  if(q?.kind==='damage'){
   const raw=q.rawAttack as Record<string,unknown>|undefined;
   if(q.input.amped)reaction=reactions[q.input.amplifyingReaction]??'unknown';
   else if(q.damageCategory==='transformative')reaction=q.attackTagName.startsWith('AttackTagSwirl')?'扩散':({AttackTagOverloadDamage:'超载',AttackTagSuperconductDamage:'超导',AttackTagECDamage:'感电',AttackTagBurningDamage:'燃烧',AttackTagBloom:'绽放',AttackTagHyperbloom:'超绽放',AttackTagBurgeon:'烈绽放',AttackTagShatter:'碎冰'} as Record<string,string>)[q.attackTagName]??'unknown';
   else if(raw?.Catalyzed===true)reaction=typeof raw.CatalyzedType==='string'?(reactions[raw.CatalyzedType]??'unknown'):'unknown';
   else if(raw?.Catalyzed===false)reaction='无反应';
  }
  // Only the emitting calculation identifies an owner. Never infer the active character or parent owner.
  const projection=q?.kind==='damage'?classifyWandererTeamProjection(r.sourceCommit,q,damageByAttack.get(q.origin?.parentAttackId??-1)??[],a):undefined;
  return {id:a.id,calculationId:a.calculationId,frame:a.frame,damage:a.appliedDamage,actor:q?.actorKey||'unknown',source:q?tags[q.attackTagName]??(q.kind==='damage'&&q.damageCategory==='transformative'?'其他（剧变）':'unknown'):'unknown',element:q?elements[q.element]??'unknown':'unknown',reaction,ability:q?.ability??'unknown',...(projection??{})};
 });
 const markers=(r.abilityInvocations??[]).filter(a=>a.success&&['skill','burst'].includes(a.action)&&a.startedFrame>=0&&a.startedFrame<window.endFrame).map(a=>({id:a.id,frame:a.startedFrame,actor:a.characterKey,action:a.action==='skill'?'E':'Q'}));
 const buffs:CurveBuff[]=[],active=new Map<string,CurveBuff>(),lifecycleEnds=new Map<string,number>();let unclassifiedBuffLogs=0;
 const logs=Array.isArray(r.logs)?r.logs:[];
 logs.forEach((raw,index)=>{
  const x=raw as {event?:string;frame?:number;ended?:number;char_index?:number;msg?:string;logs?:Record<string,unknown>};const data=x.logs;
  if(x.event!=='status'||!data||typeof data.key!=='string'||typeof x.frame!=='number'||x.frame>=window.endFrame)return;
  const key=data.key,actorIndex=x.char_index??-1;
  const known=key==='bennett-field'||/^vv(pyro|cryo|hydro|electro)$/.test(key);
  if(!known)return;
  // Enemy status rows have no target identity. Only a one-target scene can be shown without merging targets.
  if(key.startsWith('vv')&&r.targetScene?.targets.length!==1){unclassifiedBuffLogs++;return;}
  const id=`${key}/${actorIndex}`,previous=active.get(id),expiry=data.expiry;
  if(x.msg==='mod extended'){
   if(previous&&x.frame<previous.endFrame&&typeof expiry==='number'&&Number.isFinite(expiry)){previous.endFrame=Math.min(expiry,window.endFrame,lifecycleEnds.get(id)??Infinity);previous.logIndices.push(index);}else unclassifiedBuffLogs++;
   return;
  }
  if(!['stat mod added','stat mod refreshed','enemy mod added','enemy mod refreshed'].includes(x.msg??''))return;
  if(typeof expiry!=='number'||!Number.isFinite(expiry)||expiry<0){unclassifiedBuffLogs++;return;}
  // Native LogAdd keeps the original event through refreshes; Delete/Extend
  // update that event's ended frame. It bounds the entire modifier lifecycle.
  if(x.msg?.endsWith('mod added'))lifecycleEnds.set(id,typeof x.ended==='number'&&x.ended>=x.frame?x.ended:Infinity);
  if(previous)previous.endFrame=Math.min(previous.endFrame,x.frame);
  const b={key,actorIndex,startFrame:Math.max(0,x.frame),endFrame:Math.min(expiry,window.endFrame,lifecycleEnds.get(id)??Infinity),logIndices:[index],label:key==='bennett-field'?`班尼特攻击加成 · 受益角色索引 ${actorIndex}`:`翠绿之影 ${elements[key.slice(2)]??key}减抗 · 唯一目标`};
  buffs.push(b);active.set(id,b);
 });
 return {endFrame:window.endFrame,hits,markers,buffs:buffs.filter(b=>b.endFrame>b.startFrame),unclassifiedBuffLogs};
}
export function curveSeries(model:CurveModel,filters:Partial<Record<DamageDimension,string>>={}){
 const selected=model.hits.filter(h=>(Object.entries(filters) as Array<[DamageDimension,string]>).every(([key,value])=>!value||h[key]===value));
 const count=Math.ceil(model.endFrame/60),bins=Array.from({length:count},()=>0);let total=0;
 for(const h of selected){if(!Number.isFinite(h.damage))throw Error('伤害记录不是有限数值。');bins[Math.floor(h.frame/60)]!+=h.damage;total+=h.damage;}
 let cumulative=0;const points=bins.map((damage,i)=>{cumulative+=damage;return {startSeconds:i,endSeconds:Math.min(i+1,model.endFrame/60),damage,cumulative};});
 // Canonical window total retains original event accumulation order; avoid regrouping roundoff at the endpoint.
 if(points.length)points[points.length-1]!.cumulative=total;
 const breakdown=(dimension:DamageDimension)=>{const groups=new Map<string,{key:string;damage:number;hits:number}>();for(const h of selected){const k=h[dimension],g=groups.get(k)??{key:k,damage:0,hits:0};g.damage+=h.damage;g.hits++;groups.set(k,g);}return [...groups.values()].sort((a,b)=>b.damage-a.damage).map(g=>({...g,share:total===0?0:g.damage/total}));};
 const events = selected.map((hit,index)=>({hit,index})).sort((a,b)=>a.hit.frame-b.hit.frame||a.index-b.index).map(({hit})=>hit);
 return {total,events,selectedHits:selected.length,points,breakdown:{actor:breakdown('actor'),source:breakdown('source'),element:breakdown('element'),reaction:breakdown('reaction')}};
}

/** Event-driven staircase: two points at a hit frame, no interpolation across idle time. */
export function cumulativeFrameSteps(events: readonly CurveHit[],startFrame:number,endFrame:number){
 let value=events.filter(h=>h.frame<startFrame).reduce((sum,h)=>sum+h.damage,0);
 const points=[{frame:startFrame,value}];
 for(const h of events){if(h.frame<startFrame||h.frame>=endFrame)continue;points.push({frame:h.frame,value});value+=h.damage;points.push({frame:h.frame,value});}
 points.push({frame:endFrame,value});return points;
}
