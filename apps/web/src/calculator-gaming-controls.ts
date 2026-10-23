import type {CalculatorDocument} from '../../../packages/sim-core/src/calculator-model';
import {isGamingDamageAction} from '../../../packages/sim-core/src/gaming-damage-formulas';
import type {CalculatorRequirementAdapter,CalculatorFieldRequirementDraft} from './calculator-requirements';
const path=(key:string)=>`gameContext.gamingDamage.${key}`;
const state=(key:string,label:string,value:boolean|undefined)=>`<label>${label}<select data-source-cast-state-field="${path(key)}"><option value="unknown"${value===undefined?' selected':''}>请选择</option><option value="0"${value===false?' selected':''}>未包含／未生效</option><option value="1"${value===true?' selected':''}>已包含／生效</option></select></label>`;
const number=(key:string,label:string,value:number|undefined,max?:number,readonly=false)=>`<label>${label}<input type="number" data-field="${path(key)}" data-source-cast-number-field data-optional-number min="0"${max===undefined?'':` max="${max}"`} step="any" value="${value??''}" placeholder="请填写实际值"${readonly?' readonly aria-readonly="true"':''}></label>`;
export function renderGamingControls(doc:CalculatorDocument):string{
 if(!isGamingDamageAction(doc))return '';
 const g=doc.gameContext!,c=g.gamingDamage??{},special=g.skillId==='gaming-charmed-cloudstrider',asc=(doc.build.mode==='equipment-derived'?doc.build.equipment?.ascension:doc.build.ascension)??g.ascension;
 const a4=special&&(asc===undefined||asc>=4),c2=g.constellation>=2,c6=special&&g.constellation===6;
 const c2Diff=Boolean(c2&&c.c2Active)!==Boolean(c.c2Included);
 return `<fieldset data-source-cast-controls="gaming"><legend>嘉明 · 这一击的条件</legend><div class="calculator-fields">${a4?number('hpPercent','命中时生命（%）',c.hpPercent,100):''}${c2?state('c2Active','溢出治疗后的5秒攻击增益仍生效',c.c2Active):''}</div>
 <details${[c2&&c.c2Included===undefined,a4&&c.a4Included===undefined,c6&&(c.c6CritRateIncluded===undefined||c.c6CritDamageIncluded===undefined)].some(Boolean)?' open':''}><summary>面板已含增益（避免重复计算）</summary><div class="calculator-fields">${c2||c.c2Included?state('c2Included','攻击力已含C2的20%加成',c.c2Included):''}${c2Diff?number('baseAttack','基础攻击力（角色＋武器白值）',c.baseAttack,undefined,doc.build.mode==='equipment-derived'):''}${a4?state('a4Included','本击增伤已含半血20%加成',c.a4Included):''}${c6?state('c6CritRateIncluded','暴击率已含C6的20%',c.c6CritRateIncluded)+state('c6CritDamageIncluded','暴伤已含C6的40%',c.c6CritDamageIncluded):''}</div></details>
 <p class="calculator-hint">${special?'这一下使用E天赋；满50%生命即有增伤，先命中、下一帧才扣血。C6双暴自动按命座加入。':'这里只计算猊兽初次冲击，不把后续E下落算进Q。'}</p></fieldset>`;
}
export const gamingRequirementAdapter:CalculatorRequirementAdapter={
 id:'gaming-damage-conditions',applies:isGamingDamageAction,
 collect(doc){
  const g=doc.gameContext!,c=g.gamingDamage??{},special=g.skillId==='gaming-charmed-cloudstrider',asc=(doc.build.mode==='equipment-derived'?doc.build.equipment?.ascension:doc.build.ascension)??g.ascension;
  const fields:CalculatorFieldRequirementDraft[]=[];
  const add=(key:string,label:string,explanation:string,numeric=false)=>fields.push({id:`gaming:${key}`,fieldPath:path(key),controlSelector:numeric?`input[data-field="${path(key)}"]`:`select[data-source-cast-state-field="${path(key)}"]`,label,explanation,status:'input-required',dependencyIds:doc.selectedHitIds.map(id=>'gaming-damage:'+id),hitIds:doc.selectedHitIds});
  if(special&&(asc===undefined||asc>=4)&&c.hpPercent===undefined)add('hpPercent','命中时生命（%）','请填这一击命中时的生命百分比，不能用下一帧扣血后的生命代替。',true);
  if(g.constellation>=2&&c.c2Active===undefined)add('c2Active','溢出治疗攻击增益','溢出治疗后5秒的C2攻击加成此刻是否仍生效。');
  if(g.constellation>=2&&c.c2Included===undefined)add('c2Included','攻击力是否已含C2','确认输入攻击力是否已包含C2，避免重复加入。');
  if((Number(g.constellation>=2&&c.c2Active===true)-Number(c.c2Included===true))&&c.baseAttack===undefined&&doc.build.mode!=='equipment-derived')add('baseAttack','角色＋武器基础攻击力','C2按白值的20%计算，不能按最终攻击力的20%计算。',true);
  if(special&&(asc===undefined||asc>=4)&&c.a4Included===undefined)add('a4Included','增伤是否已含半血加成','确认增伤输入是否已含20%半血加成。');
  if(special&&g.constellation===6){if(c.c6CritRateIncluded===undefined)add('c6CritRateIncluded','暴击率是否已含C6','确认暴击率输入是否已含20%专属暴击。');if(c.c6CritDamageIncluded===undefined)add('c6CritDamageIncluded','暴伤是否已含C6','确认暴伤输入是否已含40%专属暴伤。');}
  return fields;
 }
};
