import definitions from "../../game-data/sources/mixed-source-casts/definitions.json";
import type { MixedSourceTemplate } from "../../game-data/src/character-mappings/mixed-source-mappings";
import { mixedSourceCastContextSchema, type MixedSourceCastContext, type CalculatorDocument, type CalculatorHit, type CalculatorFormula, type CalculatorFinalStats } from "./calculator-model";
import { compileMixedSourceSchedule, type MixedSourceCastKind, type MixedSourceCandidate } from "./mixed-source-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import type { ConditionedSpecialCalculation } from "@genshin-dps-lab/reaction-formulas";

type Ordinary=Extract<CalculatorHit,{kind:"ordinary"}>;type Special=Extract<CalculatorHit,{kind:"special"}>;type Hit=Ordinary|Special;
const templates=definitions.templates as MixedSourceTemplate[],prefix="mixed-source:",sourceId=prefix+"source";
const castOf=(d:CalculatorDocument)=>templates.find(t=>t.skillId===d.gameContext?.skillId);
export const isMixedSourceCastAction=(d:CalculatorDocument)=>castOf(d)!==undefined;
const ascOf=(d:CalculatorDocument)=>(d.build.mode==="equipment-derived"?d.build.equipment?.ascension:d.build.ascension)??d.gameContext?.ascension;
const stateOf=(c:MixedSourceCastContext,h:Hit)=>({...c.sharedState,...c.hitStates?.[h.id]});
const roleOf=(t:MixedSourceTemplate,h:Hit)=>h.mixedSourceEvent?.templateRole??Object.keys(t.roles).find(k=>t.roles[k]!.mappingId===h.id);
function identity(d:CalculatorDocument,c:MixedSourceCastContext,h:Hit):string {return JSON.stringify({event:h.mixedSourceEvent??h.id,snapshot:h.mixedSourceEvent?c.snapshots?.[h.mixedSourceEvent.snapshotId]??null:null,state:stateOf(c,h),level:d.gameContext?.effectiveTalentLevel,asc:ascOf(d),moonsign:c.moonsignLevel,initializationEm:c.lauma?.initializationEm});}
const input=(key:string,value:number,meaningKey:string,unit="stat"):CalculatorFormula["inputs"][number]=>({key,value,meaningKey,unit,origin:"explicit-mixed-source-state"});
const formula=(ruleId:string,label:string,expression:CalculatorFormula["expression"],inputs:CalculatorFormula["inputs"],sourceRefs:string[]):CalculatorFormula=>({ruleId,label,expression,inputs,sourceRefs,requirements:{maximumConstellation:0}});
function canonical(d:CalculatorDocument,t:MixedSourceTemplate,c:MixedSourceCastContext,roleKey:string,previous?:Hit,event?:MixedSourceCandidate):Hit {
  const r=t.roles[roleKey]!,id=event?`${t.skillId}:${event.id}`:previous?.id??r.mappingId,level=d.gameContext!.effectiveTalentLevel;
  const common={id,label:r.label+(event?` · 第${event.frame}帧`:" · 独立实际命中"),dependencies:[sourceId],sourceRefs:r.sourceRefs};let hit:Hit;
  if(r.kind==="ordinary"){
    const old=previous?.kind==="ordinary"?structuredClone(previous):undefined;
    hit={...old,...common,kind:"ordinary",element:r.element,attackTag:r.attackTag,terms:r.terms.map(term=>({stat:term.stat,coefficient:term.values[level-1]!})),additiveBaseDamage:old?.additiveBaseDamage??0,damageBonus:old?.damageBonus??0,critEligible:true,reaction:old?.reaction??"none",reactionBonus:old?.reactionBonus??0,groupMultiplier:old?.groupMultiplier??1};
    delete hit.baseDamageFormula;delete hit.additiveBaseFormula;delete hit.damageBonusFormula;delete hit.resistanceReductionFormula;delete hit.elementalMasteryAdjustment;delete hit.critRateFormula;delete hit.critDamageFormula;delete hit.attackAdjustment;
  }else{
    const context:ConditionedSpecialCalculation={branch:r.kind,ruleVersion:r.kind.startsWith("lunar")?"kqm-lunar-luna-vi-20260922-v1":"kqm-stellar-7.0-20260922-v1",context:{mode:"conditioned",enablement:"assumed-enabled",contributorEligibility:"assumed",assumptions:t.assumptions},contributors:[{id:c.casterId??t.characterSlug,base:{kind:"direct-stat-talent",scalingStat:r.terms[0]!.stat,statValue:0,talentCoefficient:r.terms[0]!.values[level-1]!,sourceRefs:r.sourceRefs},elementalMastery:0,specialBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,critRate:0,critDamage:0,modifierSourceRefs:r.sourceRefs}],effectiveResistance:d.enemy.resistance,...(r.kind==="stellar-conduct-direct"?{polestarApplicationCount:0}:{})};
    hit={...common,kind:"special",context,...(previous?.finalSnapshot?{finalSnapshot:structuredClone(previous.finalSnapshot)}:{})};
  }
  if(event){const {id:candidateId,contact:_contact,...e}=event;hit.mixedSourceEvent={candidateId,...e};}
  else if(previous?.mixedSourceEvent)hit.mixedSourceEvent=structuredClone(previous.mixedSourceEvent);
  const snapshot=hit.mixedSourceEvent?c.snapshots?.[hit.mixedSourceEvent.snapshotId]:undefined;
  const unchanged=previous&&c.finalizedHitEvents?.[id]===identity(d,c,hit);
  if(snapshot)hit.finalSnapshot=structuredClone(snapshot);else if(!unchanged)delete hit.finalSnapshot;
  if(hit.kind==="ordinary"&&(!unchanged||snapshot&&JSON.stringify(snapshot)!==JSON.stringify(previous?.finalSnapshot))){delete hit.effectiveResistance;delete hit.effectiveCritRate;delete hit.effectiveCritDamage;}
  return hit;
}
function passives(d:CalculatorDocument,t:MixedSourceTemplate,c:MixedSourceCastContext,h:Hit):string[]{
  const issues:string[]=[],s=stateOf(c,h),a=h.finalSnapshot?.ascension??ascOf(d),e=h.mixedSourceEvent;
  if(a===undefined)issues.push("需要明确突破阶段。");
  if(a!==undefined&&(h.finalSnapshot?.characterLevel??d.characterLevel)<[1,20,40,50,60,70,80][a]!)issues.push("角色等级低于本次突破阶段的最低等级。");
  if(t.characterSlug==="lauma"){
    if(h.kind==="ordinary"){
      if(s.includedDamageBonus===undefined)issues.push("需要明确普通增伤已含菈乌玛A4份额。");
      if((a??4)>=4&&c.lauma?.initializationEm===undefined)issues.push("A4需要角色初始化时的精通，不能借用命中时精通。");
      const bonus=(a??0)>=4?expr.min(expr.mul(expr.input("initializationEM"),expr.value(.004)),expr.value(.32)):expr.value(0);
      if(s.includedDamageBonus!==undefined)h.damageBonusFormula=formula("mixed-lauma-a4","菈乌玛普通E A4减去已含份额",expr.sub(bonus,expr.input("included")),[input("initializationEM",c.lauma?.initializationEm??0,"初始化精通"),input("included",s.includedDamageBonus,"普通增伤已含A4","ratio")],h.sourceRefs);
    }else{
      if(d.scope==="single-hit"&&(s.laumaBurstBuffInactive??c.lauma?.burstInactive)!==true)issues.push("此独立月绽放需明确本击没有Q苍色祷歌增益；不要求未来轮转。");
      if(e?.dewConsumed===undefined)issues.push("独立月绽放必须保留实际草露消费数；不能从未选择的未来日程推测。");
      if(c.moonsignLevel===undefined)issues.push("需要实际月兆等级确定直接月绽放A1暴击。");
      if(s.includedLaumaA1CritRate===undefined||s.includedLaumaA1CritDamage===undefined)issues.push("需要明确特殊伤害面板已含的菈乌玛A1暴击率和暴击伤害。");
      if(c.statsStableAcrossHits!==true&&s.impactEm===undefined)issues.push("需要命中时菈乌玛的实际精通，计算固有基础提升。");
    }
    const active=d.scope==="single-hit"?s.laumaOwnShredActive??e?.laumaOwnShredActive:e?.laumaOwnShredActive;
    if(active===undefined)issues.push("需要本击目标实际菈乌玛减抗状态。");
    if(s.includedResistanceReduction===undefined)issues.push("需要明确敌人输入抗性已含的本角色减抗份额。");
    if(h.kind==="ordinary"&&active!==undefined&&s.includedResistanceReduction!==undefined)h.resistanceReductionFormula=formula("mixed-lauma-shred","实际接触刷新减抗减去输入已含份额",expr.sub(expr.value(active?t.resistanceReduction![d.gameContext!.effectiveTalentLevel-1]!:0),expr.input("includedShred")),[input("includedShred",s.includedResistanceReduction,"输入抗性已含菈乌玛减抗","ratio")],h.sourceRefs);
  }
  if(t.characterSlug==="flins"){
    if((a??4)>=4&&(s.nonExtraAtk===undefined||s.includedFlinsA4Em===undefined))issues.push("菲林斯A4需要本次快照非Extra攻击及面板已含精通份额。");
    if(h.kind==="ordinary"&&(a??0)>=4&&s.nonExtraAtk!==undefined&&s.includedFlinsA4Em!==undefined){
      const actual=Math.min(s.nonExtraAtk*.08,160);
      if(h.finalSnapshot&&s.includedFlinsA4Em!==actual)issues.push("完整历史快照必须已含实际A4精通，不能给旧快照再叠加转换。");
      h.elementalMasteryAdjustment={accounting:"add-to-panel",formula:formula("mixed-flins-a4","菲林斯A4：非Extra攻击×8%，上限160，扣除已含精通",expr.sub(expr.min(expr.mul(expr.input("nonExtraAttack"),expr.value(.08)),expr.value(160)),expr.input("includedEM")),[input("nonExtraAttack",s.nonExtraAtk,"取样时非Extra攻击"),input("includedEM",s.includedFlinsA4Em,"面板已含A4精通")],h.sourceRefs)};
    }
    if(h.kind==="special"&&h.finalSnapshot&&(a??0)>=4&&s.nonExtraAtk!==undefined&&s.includedFlinsA4Em!==Math.min(s.nonExtraAtk*.08,160))issues.push("完整历史快照必须已含菲林斯实际A4精通及其装备派生属性；不能在旧快照上重新分解装备转换。");
    if(h.kind==="special"&&c.moonsignLevel===undefined)issues.push("需要实际月兆等级确定菲林斯A1。");
  }
  if(h.kind==="special"){
    for(const key of ["otherSpecialBaseBonus","otherReactionBonus","specialAdditive","elevationMultiplier"] as const)if(s[key]===undefined)issues.push(`需要明确特殊伤害输入 ${key}；未知不能当作0或1。`);
    if(t.characterSlug!=="lauma"&&c.statsStableAcrossHits!==true&&s.impactAtk===undefined)issues.push("需要命中时角色的实际攻击，不能用更早的伤害快照代替固有基础提升。");
    if(h.context.branch==="stellar-conduct-direct"&&s.polestarApplicationCount===undefined)issues.push("星导直接伤害需要本击实际极星领域计数0至12。");
    if(t.characterSlug==="odette"&&d.scope==="single-hit"&&(s.odetteBurstBuffInactive??c.odette?.burstBuffInactive)!==true)issues.push("此独立星烁需明确本击没有Q增益；不读取未来日程。");
    if(t.characterSlug==="odette"&&(a??1)>=1&&s.odetteA1Stacks===undefined&&e?.odetteA1Stacks===undefined)issues.push("需要本击实际自身A1层数；终奏不会重新获得4层。");
  }
  return issues;
}
export function prepareMixedSourceCastDocument(document:CalculatorDocument):CalculatorDocument {
  const cast=castOf(document);if(!cast)return document;const d=structuredClone(document),g=d.gameContext!,c=mixedSourceCastContextSchema.parse(g.mixedSourceCast??{});g.mixedSourceCast=c;
  if(g.effectiveTalentLevel>15){const id=prefix+"talent-level";d.dependencies=d.dependencies.filter(x=>x.id!==id);d.dependencies.push({id,status:"missing",reason:"有效天赋必须在固定来源1至15级内，不回退为其他等级。",sourceRefs:[]});d.hits.forEach(h=>h.dependencies=[...new Set([...h.dependencies,id])]);g.scopeCoverage="selected-components";return d;}
  const prior=d.hits,selected=new Set(d.selectedHitIds),all=prior.every(h=>selected.has(h.id)),old=new Map(prior.filter((h):h is Hit=>h.kind==="ordinary"||h.kind==="special").map(h=>[h.id,h]));
  const reps=()=>Object.keys(cast.roles).filter(k=>cast.roles[k]!.kind==="ordinary").map(k=>canonical(d,cast,c,k,[...old.values()].find(h=>roleOf(cast,h)===k&&!h.mixedSourceEvent)));
  const refs=[...new Set(Object.values(cast.roles).flatMap(r=>r.sourceRefs))],missing:string[]=[];
  if(g.constellation!==0)missing.push("本完整协议仅支持C0。");if(g.effectiveTalentLevel>15)missing.push("有效天赋必须在来源1至15级内。");
  let independentId:string|undefined;
  if(d.scope==="single-hit"){
    if(c.independentEvent){
      const {candidateId:id,dewConsumed,laumaOwnShredActive,odetteA1Stacks,...metadata}=c.independentEvent;
      if(!cast.roles[metadata.templateRole]){missing.push("独立事件伤害角色不属于当前来源动作。");d.hits=reps();}
      else {const hitId=`${cast.skillId}:${id}`,h=canonical(d,cast,c,metadata.templateRole,old.get(hitId),{id,...metadata,
        ...(dewConsumed===undefined?{}:{dewConsumed}),...(laumaOwnShredActive===undefined?{}:{laumaOwnShredActive}),...(odetteA1Stacks===undefined?{}:{odetteA1Stacks})});d.hits=[...old.values()].filter(x=>x.id!==hitId);d.hits.push(h);independentId=hitId;}
    }else d.hits=old.size?[...old.values()].map(h=>{const role=roleOf(cast,h);return role?canonical(d,cast,c,role,h):h;}):reps();
  }
  else{const schedule=compileMixedSourceSchedule(cast.skillId as MixedSourceCastKind,c);missing.push(...schedule.issues);d.hits=schedule.issues.length?reps():schedule.instances.map(e=>canonical(d,cast,c,e.templateRole,old.get(`${cast.skillId}:${e.id}`),e));if(!d.hits.length)d.hits=[{id:`${cast.skillId}:no-contact`,label:"完整观察无目标命中",kind:"non-damaging",reason:"每个来源候选均明确未接触目标。",sourceRefs:refs,dependencies:[sourceId]}];}
  const retained=d.hits.filter(h=>selected.has(h.id)).map(h=>h.id);d.selectedHitIds=d.scope==="single-hit"?[independentId??retained[0]??d.hits[0]!.id]:all||!retained.length?d.hits.map(h=>h.id):retained;
  d.dependencies=d.dependencies.filter(x=>!x.id.startsWith(prefix));d.dependencies.push({id:sourceId,status:"provisional",reason:"固定原文完整混合伤害协议；特殊段使用共享来源AST，未晋升游戏实测或自动队伍支持。",sourceRefs:refs});
  const dep=(id:string,reasons:string[],hits:CalculatorHit[])=>{d.dependencies.push({id,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"本击来源、生命周期、取样与已含份额明确。",sourceRefs:refs});hits.forEach(h=>h.dependencies=[...new Set([...h.dependencies,id])]);};dep(prefix+"schedule",missing,d.hits);
  for(const h of d.hits)if(h.kind==="ordinary"||h.kind==="special"){
    const issues=passives(d,cast,c,h),e=h.mixedSourceEvent;
    if(h.kind==="special"&&!e)issues.push("来源特殊伤害必须声明本击实际事件；不能使用空面板占位值。");
    if(e){
      let valid=true;
      if(cast.characterSlug==="lauma")valid=e.snapshotFrame===e.frame&&(e.templateRole==="sanctuary"?[62,179,296,413,530,647,764,881].includes(e.frame):e.frame===45);
      if(cast.characterSlug==="flins")valid=e.snapshotFrame===93&&(e.templateRole==="initial"?e.frame===93:e.templateRole==="final"?e.frame===164:((c.moonsignLevel??0)>=2?[110,119,128,137]:[110,119]).includes(e.frame));
      if(cast.characterSlug==="odette"){
        let f=114,i=0;const frames:Array<{frame:number;plume:boolean}>=[];while(f<=1262){frames.push({frame:f,plume:i%2===0});f+=i%2===0?109:125;i++;}
        valid=e.snapshotFrame===e.frame&&(e.templateRole==="coda"?[11,20,28].includes(e.frame):e.templateRole.startsWith("coda")?e.frame===62:frames.some(x=>x.frame===e.frame&&e.templateRole.startsWith(x.plume?"plume":"wing")));
      }
      if(!valid)issues.push("已保存本击的角色、命中帧或取样帧不符合固定来源；单击可以省略未来日程，但不能改造本击来源。");
    }
    if(e&&d.scope!=="single-hit"&&c.statsStableAcrossHits!==true&&!c.snapshots?.[e.snapshotId])issues.push(`需要实际进攻快照 ${e.snapshotId}。`);
    if(e&&old.get(h.id)?.finalSnapshot&&!h.finalSnapshot&&!c.snapshots?.[e.snapshotId])issues.push("实际历史快照已删除或失效；请明确重新提供本击面板，不能静默替换为当前构筑。");
    if(c.finalizedHitEvents&&c.finalizedHitEvents[h.id]!==identity(d,c,h))issues.push("本击事件、快照或被动状态已变化，旧物化面板不能沿用；请重新应用构筑。");
    dep(prefix+h.id,issues,[h]);
  }
  const chosen=d.hits.filter(h=>d.selectedHitIds.includes(h.id));g.scopeCoverage=d.scope==="single-hit"?"single-hit":chosen.length===d.hits.length&&!chosen.some(h=>h.dependencies.some(id=>d.dependencies.find(x=>x.id===id)?.status==="missing"))?"complete-cast":"selected-components";
  g.attributionPolicy="仅合计本次来源协议真实生成的普通及直接特殊伤害；旧实体初击、外部资源产生和触发动作本体不并入本次施放。";
  d.assumptions=[...d.assumptions.filter(x=>!x.startsWith("混合来源协议：")),...cast.assumptions.map(x=>"混合来源协议："+x)];return d;
}
/** Reuse the core's existing EM-dependent equipment reconstruction without applying ordinary hit bonuses. */
export function mixedSourceSpecialPanelProxy(d:CalculatorDocument,h:Special):Ordinary|undefined {
  const t=castOf(d),c=d.gameContext?.mixedSourceCast;if(t?.characterSlug!=="flins"||!c||h.finalSnapshot||(ascOf(d)??0)<4)return undefined;
  const s=stateOf(c,h);if(s.nonExtraAtk===undefined||s.includedFlinsA4Em===undefined)return undefined;
  return {id:h.id,label:h.label,kind:"ordinary",sourceRefs:h.sourceRefs,dependencies:[],element:"electro",terms:[{stat:"atk",coefficient:1}],additiveBaseDamage:0,damageBonus:0,critEligible:true,reaction:"none",reactionBonus:0,groupMultiplier:1,
    elementalMasteryAdjustment:{accounting:"add-to-panel",formula:formula("mixed-flins-special-panel-a4","特殊段第93帧A4精通与装备属性阶段",expr.sub(expr.min(expr.mul(expr.input("nonExtraAttack"),expr.value(.08)),expr.value(160)),expr.input("includedEM")),[input("nonExtraAttack",s.nonExtraAtk,"取样时非Extra攻击"),input("includedEM",s.includedFlinsA4Em,"面板已含A4精通")],h.sourceRefs)}};
}
/** Ordinary and special paths share the actual panel; only special-specific modifiers enter the latter. */
export function resolveMixedSourceSpecialContext(d:CalculatorDocument,h:Special,panel:CalculatorFinalStats,flinsA4AlreadyResolved=false):{context:ConditionedSpecialCalculation;trace:CalculationTraceNode[];blockers?:string[]} {
  const t=castOf(d),c=d.gameContext?.mixedSourceCast;if(!t||!c)return {context:h.context,trace:[]};if(!h.mixedSourceEvent)return {context:h.context,trace:[],blockers:["来源特殊伤害缺少本击实际事件，不能使用占位面板。"]};
  const role=t.roles[h.mixedSourceEvent.templateRole]!,s=stateOf(c,h),stats=h.finalSnapshot?.stats??panel,a=h.finalSnapshot?.ascension??ascOf(d)??0,b=new TraceBuilder(h.sourceRefs),context=structuredClone(h.context),owner=context.contributors[0]!;
  const stage=(id:string,label:string,expression:CalculatorFormula["expression"],values:Record<string,number>,unit="ratio")=>b.add(`mixed-source.${id}`,label,expression,Object.entries(values).map(([key,value])=>traceInput(key,value,"stat","actual-source-panel",key)),{unit,explanationKey:label});
  let em=stats.em,talent=role.terms[0]!.values[d.gameContext!.effectiveTalentLevel-1]!,ownReaction=0,cr=stats.critRate,cd=stats.critDamage;
  const impactAtk=s.impactAtk??stats.atk,impactEm=s.impactEm??stats.em;
  const base=stage("ownBaseBonus","命中时来源固有基础提升",expr.min(expr.mul(expr.input("impactStat"),expr.value(t.characterSlug==="lauma"?.000175:.00007)),expr.value(.14)),{impactStat:t.characterSlug==="lauma"?impactEm:impactAtk});
  if(t.characterSlug==="flins"){
    if(a>=4&&!flinsA4AlreadyResolved)em=stage("a4EM","第93帧快照精通加A4实际份额减已含份额",expr.add(expr.input("panelEM"),expr.sub(expr.min(expr.mul(expr.input("nonExtraAttack"),expr.value(.08)),expr.value(160)),expr.input("includedEM"))),{panelEM:stats.em,nonExtraAttack:s.nonExtraAtk??0,includedEM:s.includedFlinsA4Em??0},"stat");
    ownReaction=a>=1&&(c.moonsignLevel??0)>=2?.2:0;
  }else if(t.characterSlug==="lauma"){
    talent=stage("dewCoefficient","实际每枚草露倍率×第29帧消费数",expr.mul(expr.input("coefficient"),expr.input("consumedDew")),{coefficient:talent,consumedDew:h.mixedSourceEvent.dewConsumed??0});
    const active=a>=1&&(c.moonsignLevel??0)>=2;cr=stage("a1CR","直接月绽放A1暴击率记账",expr.add(expr.input("panelCR"),expr.sub(expr.value(active ? .1 : 0),expr.input("included"))),{panelCR:stats.critRate,included:s.includedLaumaA1CritRate??0});cd=stage("a1CD","直接月绽放A1暴击伤害记账",expr.add(expr.input("panelCD"),expr.sub(expr.value(active ? .2 : 0),expr.input("included"))),{panelCD:stats.critDamage,included:s.includedLaumaA1CritDamage??0});
    const activeShred=d.scope==="single-hit"?s.laumaOwnShredActive??h.mixedSourceEvent.laumaOwnShredActive:h.mixedSourceEvent.laumaOwnShredActive;
    context.effectiveResistance=stage("effectiveResistance","本击减抗在此前接触回调后读取",expr.sub(expr.input("inputResistance"),expr.sub(expr.value(activeShred?t.resistanceReduction![d.gameContext!.effectiveTalentLevel-1]!:0),expr.input("included"))),{inputResistance:d.enemy.resistance,included:s.includedResistanceReduction??0});
  }else{
    if(a>=4)talent=stage("a4Talent","构造本次星烁时ATK决定A4原始倍率提升",expr.mul(expr.input("coefficient"),expr.add(expr.value(1),expr.min(expr.mul(expr.max(expr.sub(expr.input("constructionAtk"),expr.value(1000)),expr.value(0)),expr.value(.00015)),expr.value(.3)))),{coefficient:talent,constructionAtk:stats.atk});
    ownReaction=a>=1 ? .15*(s.odetteA1Stacks??h.mixedSourceEvent.odetteA1Stacks??0):0;
  }
  owner.base={kind:"direct-stat-talent",scalingStat:role.terms[0]!.stat,statValue:role.terms[0]!.stat==="em"?em:stats.atk,talentCoefficient:talent,sourceRefs:h.sourceRefs};owner.elementalMastery=em;owner.critRate=cr;owner.critDamage=cd;
  owner.specialBaseBonus=stage("baseBonusTotal","其他明确基础提升加本角色固有份额",expr.add(expr.input("other"),expr.input("own")),{other:s.otherSpecialBaseBonus??0,own:base});
  owner.reactionBonus=stage("reactionBonusTotal","其他明确特殊反应加成加本角色A1",expr.add(expr.input("other"),expr.input("own")),{other:s.otherReactionBonus??0,own:ownReaction});owner.specialAdditive=s.specialAdditive??0;owner.elevationMultiplier=s.elevationMultiplier??1;
  if(context.branch==="stellar-conduct-direct")context.polestarApplicationCount=s.polestarApplicationCount??0;
  const blockers=em<0||cd<0?["已含被动份额与实际面板冲突，产生负精通或负暴击伤害；请修正本击已含份额。"]:[];return {context,trace:b.nodes,...(blockers.length?{blockers}:{})};
}
export function resetMixedSourcePanelAccounting(d:CalculatorDocument,mode:"fresh-equipment"|"imported-final"):void {
  if(!castOf(d))return;const c=d.gameContext!.mixedSourceCast??={};delete c.finalizedHitEvents;c.hitStates??={};
  for(const h of d.hits)if((h.kind==="ordinary"||h.kind==="special")&&h.finalSnapshot&&h.finalSnapshot.origin!=="equipment-conversion")c.hitStates[h.id]=stateOf(c,h);
  const reset=(s:NonNullable<MixedSourceCastContext["sharedState"]>)=>{for(const k of ["includedDamageBonus","includedResistanceReduction","includedFlinsA4Em","includedLaumaA1CritRate","includedLaumaA1CritDamage"] as const){if(mode==="fresh-equipment")s[k]=0;else delete s[k];}};
  reset(c.sharedState??={});for(const h of d.hits)if((h.kind==="ordinary"||h.kind==="special")&&(!h.finalSnapshot||h.finalSnapshot.origin==="equipment-conversion")){reset(c.hitStates[h.id]??={});delete h.finalSnapshot;}
}
export function finalizeMixedSourcePanelAccounting(d:CalculatorDocument):void {
  const t=castOf(d);if(!t)return;const c=d.gameContext!.mixedSourceCast??={};c.hitStates??={};
  for(const h of d.hits)if((h.kind==="ordinary"||h.kind==="special")&&h.finalSnapshot?.origin==="equipment-conversion"&&t.characterSlug==="flins"){
    const s=stateOf(c,h);if((ascOf(d)??0)>=4&&s.nonExtraAtk!==undefined)(c.hitStates[h.id]??={}).includedFlinsA4Em=Math.min(s.nonExtraAtk*.08,160);
  }
  c.finalizedHitEvents=Object.fromEntries(d.hits.filter((h):h is Hit=>h.kind==="ordinary"||h.kind==="special").map(h=>[h.id,identity(d,c,h)]));
}
export function mixedSourceEventTrace(h:CalculatorHit):CalculationTraceNode[]{if((h.kind!=="ordinary"&&h.kind!=="special")||!h.mixedSourceEvent)return[];const e=h.mixedSourceEvent,b=new TraceBuilder(h.sourceRefs);for(const [key,value]of Object.entries(e))if(typeof value==="number")b.add(`mixed-source.event.${key}`,`来源事件 ${key}`,expr.input(key),[traceInput(key,value,"number","explicit-observed-source",`${e.candidateId}／目标${e.targetId}`)],{unit:"number"});return b.nodes;}
