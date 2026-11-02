import type {CalculatorDocument,TighnariDamageContext} from '../../../packages/sim-core/src/calculator-model';
import type {CalculatorRequirementAdapter,CalculatorFieldRequirementDraft} from './calculator-requirements';
import {isTighnariDamageAction} from './tighnari-calculation-context';
const path=(key:string)=>`gameContext.tighnariDamage.${key}`;
const choose=(key:keyof TighnariDamageContext,label:string,value:unknown,options:[string,string][],boolean=false)=>`<label>${label}<select data-tighnari-field="${path(key)}"${boolean?' data-tighnari-boolean':''}><option value="unknown"${value===undefined?' selected':''}>请选择</option>${options.map(([v,text])=>`<option value="${v}"${String(typeof value==='boolean'?Number(value):value)===v?' selected':''}>${text}</option>`).join('')}</select></label>`;
const yesno:[string,string][]=[['0','否'],['1','是']];
const bool=(key:keyof TighnariDamageContext,label:string,c:TighnariDamageContext)=>choose(key,label,c[key],yesno,true);
export function renderTighnariControls(doc:CalculatorDocument):string{
 if(!isTighnariDamageAction(doc)||!doc.gameContext?.tighnariDamage)return '';
 const g=doc.gameContext,c=g.tighnariDamage!,w=g.skillId==='tighnari-wreath-complete-c0-c5',q=g.skillId==='tighnari-burst-complete-cast';
 const arrow=w||q,charged=doc.hits.some(h=>h.kind==='ordinary'&&h.attackTag==='charged');
 const dendro=doc.hits.some(h=>h.kind==='ordinary'&&h.element==='dendro');
 if(!arrow&&!dendro)return '';
 const multi=doc.scope==='one-cast'&&doc.selectedHitIds.length>1;
 return `<fieldset data-tighnari-controls><legend>提纳里 · 本次攻击条件</legend><div class="calculator-fields">${arrow?bool('priorA1Active',w?'射箭前，50精通被动已生效':'Q期间，50精通被动持续生效',c):''}${dendro&&g.constellation>=2?bool('c2Active','识蕴领域20%草伤增益生效（含残留）',c):''}${w&&g.constellation>=4?choose('c4Em','本次C4精通加成',c.c4Em,[['0','未生效'],['60','60精通'],['120','120精通']]):''}${multi?bool('allHitsConnected','所列箭矢全部命中同一目标',c)+bool('statsStableAcrossHits','本次箭矢期间面板与目标条件保持稳定',c):''}</div>${q&&g.constellation>=4?'<p class="calculator-hint">本次无反应Q自动计入施放获得的60精通。</p>':''}<details data-tighnari-accounting><summary>面板已含的自身加成</summary><div class="calculator-fields">${arrow?choose('a1IncludedEm','精通面板已含50精通被动',c.a1IncludedEm,[['0','未含'],['50','已含50']])+`<label>伤害加成已含A4份额（0–0.6）<input type="number" data-field="${path('includedA4Bonus')}" data-tighnari-number-field data-optional-number min="0" max="0.6" step="any" value="${c.includedA4Bonus??''}"></label>`:''}${arrow&&g.constellation>=4?choose('c4IncludedEm','精通面板已含C4份额',c.c4IncludedEm,[['0','未含'],['60','已含60'],['120','已含120']]):''}${dendro&&g.constellation>=2?choose('includedC2Bonus','草伤输入已含C2份额',c.includedC2Bonus,[['0','未含'],['0.2','已含20%']]):''}${charged&&g.constellation>=1?choose('includedC1Crit','暴击率输入已含C1重击份额',c.includedC1Crit,[['0','未含'],['0.15','已含15%']]):''}</div></details></fieldset>`;
}
export const tighnariRequirementAdapter:CalculatorRequirementAdapter={
 id:'tighnari-damage',applies:doc=>isTighnariDamageAction(doc)&&doc.gameContext?.tighnariDamage!==undefined,
 collect(doc){
  const g=doc.gameContext!,c=g.tighnariDamage!,hits=doc.hits.filter(h=>h.kind==='ordinary'&&doc.selectedHitIds.includes(h.id));const fields:CalculatorFieldRequirementDraft[]=[];
  const arrow=g.skillId==='tighnari-wreath-complete-c0-c5'||g.skillId==='tighnari-burst-complete-cast';
  const add=(key:keyof TighnariDamageContext,label:string,requiredTrue=false,numeric=false)=>{
   if(c[key]!==undefined&&(!requiredTrue||c[key]===true))return;
   fields.push({id:`tighnari:${key}`,fieldPath:path(key),controlSelector:`${numeric?'input[data-field':'select[data-tighnari-field'}="${path(key)}"]`,label,explanation:label,status:c[key]===undefined?'input-required':'condition-not-satisfied',dependencyIds:hits.map(h=>'tighnari-damage:'+h.id),hitIds:hits.map(h=>h.id)});
  };
  if(arrow&&hits.length){add('priorA1Active','50精通被动的实际状态');add('a1IncludedEm','精通面板已含的50精通');add('includedA4Bonus','伤害加成已含的A4份额',false,true);if(g.constellation>=4){add('c4IncludedEm','精通面板已含C4份额');if(g.skillId.includes('wreath'))add('c4Em','本次C4精通加成');}if(doc.scope==='one-cast'&&hits.length>1){add('allHitsConnected','所列箭矢是否全部命中',true);add('statsStableAcrossHits','箭矢期间面板与目标条件是否稳定',true);}}
  if(g.constellation>=2&&hits.some(h=>h.kind==='ordinary'&&h.element==='dendro')){add('c2Active','识蕴领域草伤是否生效');add('includedC2Bonus','草伤输入已含C2份额');}
  if(g.constellation>=1&&hits.some(h=>h.kind==='ordinary'&&h.attackTag==='charged'))add('includedC1Crit','暴击率输入已含C1份额');
  return fields;
 }
};
