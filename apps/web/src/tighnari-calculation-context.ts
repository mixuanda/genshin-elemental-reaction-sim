import {tighnariDamageContextSchema,type CalculatorDocument,type TighnariDamageContext} from '../../../packages/sim-core/src/calculator-model';
import {createTighnariC1Crit,createTighnariDamageBonus,createTighnariEmAdjustment,TIGHNARI_DAMAGE_SOURCE_REFS} from '../../../packages/sim-core/src/tighnari-formulas';
export const isTighnariDamageAction=(doc:CalculatorDocument)=>doc.gameContext?.abilityId.startsWith('talent:tighnari:')===true;
const prefix='tighnari-damage:';
export function resetTighnariPanelAccounting(doc:CalculatorDocument,mode:'fresh-equipment'|'imported-final'):void{
 const c=doc.gameContext?.tighnariDamage;if(!c)return;
 if(mode==='fresh-equipment')Object.assign(c,{a1IncludedEm:0,c4IncludedEm:0,includedA4Bonus:0,includedC2Bonus:0,includedC1Crit:0});
 else for(const key of ['a1IncludedEm','c4IncludedEm','includedA4Bonus','includedC2Bonus','includedC1Crit','priorA1Active','c2Active','c4Em','allHitsConnected','statsStableAcrossHits'] as const)delete c[key];
}
/** An explicitly selected own-hit branch, never inferred combat history. */
export function applyTighnariDamageContext(document:CalculatorDocument,supplied:TighnariDamageContext):CalculatorDocument{
 if(!isTighnariDamageAction(document))return document;
 const doc=structuredClone(document),game=doc.gameContext!,c=tighnariDamageContextSchema.parse(supplied);game.tighnariDamage=c;
 const asc=(doc.build.mode==='equipment-derived'?doc.build.equipment?.ascension:doc.build.ascension)??game.ascension;
 const wreath=game.skillId==='tighnari-wreath-complete-c0-c5',burst=game.skillId==='tighnari-burst-complete-cast';
 const {hitStateIdentities:previousIdentities,...stateWithoutIdentities}=c;
 c.hitStateIdentities={...previousIdentities};
 const selected=doc.hits.filter(h=>h.kind==='ordinary'&&doc.selectedHitIds.includes(h.id));
 const multi=doc.scope==='one-cast'&&selected.length>1;
 doc.dependencies=doc.dependencies.filter(d=>!d.id.startsWith(prefix));
 doc.assumptions=doc.assumptions.filter(s=>!s.startsWith('提纳里伤害条件：'));
 for(const hit of doc.hits){
  hit.dependencies=hit.dependencies.filter(id=>!id.startsWith(prefix));if(hit.kind!=='ordinary')continue;
  const issues:string[]=[];
  const identity=JSON.stringify({state:stateWithoutIdentities,constellation:game.constellation,ascension:asc,talent:game.effectiveTalentLevel,id:hit.id});
  if(hit.finalSnapshot||hit.effectiveCritRate!==undefined||hit.effectiveCritDamage!==undefined){if(previousIdentities?.[hit.id]!==identity)issues.push('此箭状态已改变，不能沿用旧的已结算快照；请重新应用配装。');}
  else c.hitStateIdentities[hit.id]=identity;
  const charged=hit.attackTag==='charged',dendro=hit.element==='dendro';
  // Discard this module's previous outputs before rebuilding from actual state.
  if(hit.damageBonusFormula?.ruleId.startsWith('tighnari-'))delete hit.damageBonusFormula;
  if(hit.critRateFormula?.ruleId.startsWith('tighnari-'))delete hit.critRateFormula;
  if(hit.elementalMasteryAdjustment?.formula.ruleId.startsWith('tighnari-'))delete hit.elementalMasteryAdjustment;
  if((wreath||burst)&&asc===undefined)issues.push('请填写实际突破阶段，以确定50精通与精通转增伤被动是否解锁。');
  if(wreath&&game.constellation>=6)issues.push('本动作只列花筥箭＋4枚藏蕴花矢；C6额外箭尚未纳入，请使用原生动作执行查看C6。');
  if(multi&&(wreath||burst)){
   if(c.allHitsConnected!==true)issues.push('请选择这些箭是否全部命中同一目标；否则改选实际命中的单箭。');
   if(c.statsStableAcrossHits!==true)issues.push('请选择本次箭矢期间面板与目标条件是否稳定；不稳定时请独立计算一箭。');
  }
  if(dendro&&game.constellation>=2&&c.c2Active===undefined)issues.push('请选择识蕴领域的20%草伤增益是否生效（含6秒残留）。');
  if(dendro&&game.constellation>=2&&c.includedC2Bonus===undefined)issues.push('请确认当前草伤输入是否已包含C2的20%。');
  const c2=dendro&&game.constellation>=2&&c.c2Active===true?.2:0;
  let liveExtra=0;
  if(wreath||burst){
   const a1Unlocked=asc!==undefined&&asc>=1,a4Unlocked=asc!==undefined&&asc>=4;
   if(a1Unlocked&&c.priorA1Active===undefined)issues.push(wreath?'请选择发射前50精通被动是否已在生效。':'请选择本次Q期间50精通被动是否持续生效。');
   if(a1Unlocked&&c.a1IncludedEm===undefined)issues.push('请确认当前精通面板是否已含50精通被动。');
   if(c.c4IncludedEm===undefined&&game.constellation>=4)issues.push('请确认当前精通面板已含多少C4精通。');
   if(c.includedA4Bonus===undefined&&a4Unlocked)issues.push('请确认当前伤害加成已含的A4份额；普通装备面板为0。');
   const before=a1Unlocked&&c.priorA1Active===true?50:0;
   const a1= a1Unlocked ? (wreath&&hit.id.includes('cluster')?50:before):0;
   let c4=0;
   if(game.constellation>=4){
    if(burst)c4=60; // OnBurst grants 60 before every declared Q snapshot.
    else if(c.c4Em===undefined)issues.push('请选择本次重击的C4精通加成：无、60或120。');
    else c4=c.c4Em;
   }
   // The stated no-reaction Q branch cannot invent the first 60→120 transition.
   if(burst&&game.constellation>=4&&selected.some(h=>h.kind==='ordinary'&&(h.additiveReaction!==undefined||h.reaction!=='none')))
    issues.push('C4的Q触发反应会改变后续精通；当前完整Q仅支持无反应分支，不能用统一精通计算蔓激化箭组。');
   liveExtra=wreath&&a1Unlocked?50-a1:0;
   hit.elementalMasteryAdjustment={accounting:'add-to-panel',formula:createTighnariEmAdjustment(a1+c4,(c.a1IncludedEm??0)+(c.c4IncludedEm??0))};
   hit.damageBonusFormula=createTighnariDamageBonus(liveExtra,c2,(c.includedA4Bonus??0)+(c.includedC2Bonus??0),a4Unlocked);
   // EM used by Spread remains this arrow's snapshot; A4 separately reads live EM.

  }else if(dendro&&(game.constellation>=2||(c.includedC2Bonus??0)!==0)){
   hit.damageBonusFormula=createTighnariDamageBonus(0,c2,c.includedC2Bonus??0,false);
  }
  if(charged){
   if(game.constellation>=1&&c.includedC1Crit===undefined)issues.push('请确认当前暴击率是否已含C1的15%重击暴击率。');
   hit.critRateFormula=createTighnariC1Crit(c.includedC1Crit??0,game.constellation>=1);
  }
  const id=prefix+hit.id;hit.dependencies.push(id);
  doc.dependencies.push({id,status:issues.length?'missing':'provisional',reason:issues.join('；')||'本击按固定来源与所选精通、C2/C4状态计算；未推定反应次数或完整轮转。',sourceRefs:TIGHNARI_DAMAGE_SOURCE_REFS});
 }
 doc.assumptions.push('提纳里伤害条件：花筥箭首箭发射时快照，50精通在发射后1帧生效；默认飞行10帧，藏蕴花矢在首箭命中时快照后再飞35帧。首箭蔓激化用发射时精通，A4用命中时精通；本分支不含0帧飞行、被动中途到期或C6。',
 '提纳里伤害条件：Q为6枚初级＋6枚次级；C4无反应分支在施放后获得60精通。C3/C5已含在有效等级；选择C4反应箭组时仍阻断，没有伪造60→120触发次序。普通物理普攻不受C1重击暴击或C2草伤影响。');
 return doc;
}
