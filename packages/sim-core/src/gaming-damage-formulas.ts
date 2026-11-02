import type {CalculatorDocument,CalculatorFormula,CalculatorHit} from './calculator-model';
import {gamingDamageContextSchema,type GamingDamageContext} from './gaming-damage-context';
import {gamingDamageMappings} from '../../game-data/src/character-mappings/gaming-damage-mappings';
import {expr} from './calculation-trace';
export const GAMING_DAMAGE_SOURCE_REFS=['gaming.go','skill.go','plunge.go','burst.go','asc.go','cons.go','zz_gaming.dm.go'].map(file=>`https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/gaming/${file}`);
const prefix='gaming-damage:';
export const isGamingDamageAction=(doc:CalculatorDocument)=>doc.dataIdentity.releaseStatus!=='preview'&&doc.gameContext?.characterId==='character:10000092'&&gamingDamageMappings.some(m=>m.skillId===doc.gameContext?.skillId);
const fixed=(key:string,label:string,value:number):CalculatorFormula=>({ruleId:`gaming-damage-${key}-b4ae769`,label,expression:expr.value(value),inputs:[],sourceRefs:GAMING_DAMAGE_SOURCE_REFS});
const identity=(doc:CalculatorDocument,hit:CalculatorHit,c:GamingDamageContext)=>{
 const {finalizedHitStates:_,...state}=c;
 return JSON.stringify([doc.gameContext?.skillId,doc.gameContext?.constellation,doc.gameContext?.effectiveTalentLevel,doc.gameContext?.ascension,doc.build.mode==='equipment-derived'?doc.build.equipment?.ascension:doc.build.ascension,hit.id,state]);
};

/** Selected own contact only: its HP is before the following-frame drain. */
export function prepareGamingDamageDocument(document:CalculatorDocument):CalculatorDocument{
 if(!isGamingDamageAction(document))return document;
 const doc=structuredClone(document),g=doc.gameContext!,c=gamingDamageContextSchema.parse(g.gamingDamage??{});g.gamingDamage=c;
 const m=gamingDamageMappings.find(m=>m.skillId===g.skillId)!;
 const special=m.attackTag==='plunge',asc=(doc.build.mode==='equipment-derived'?doc.build.equipment?.ascension:doc.build.ascension)??g.ascension;
 if(doc.build.mode==='equipment-derived')c.baseAttack=doc.build.characterBaseAtk+doc.build.weaponBaseAtk;
 const c2=g.constellation>=2&&c.c2Active===true,c6=g.constellation===6;
 doc.dependencies=doc.dependencies.filter(d=>!d.id.startsWith(prefix));
 for(const hit of doc.hits){
  hit.dependencies=hit.dependencies.filter(id=>!id.startsWith(prefix));
  if(hit.kind!=='ordinary')continue;
  const issues:string[]=[];
  if(doc.hits.length!==1||hit.id!==m.id||doc.selectedHitIds.some(id=>id!==m.id))issues.push('此入口只计算所选自身一击，不能追加普通下落、碰撞或后续猊兽。');
  const coefficient=m.sourceCoefficientValues?.[g.effectiveTalentLevel-1];
  if(coefficient===undefined)issues.push('缺少本级固定来源倍率；有效天赋必须为1–15级。');
  else hit.terms=[{stat:'atk',coefficient}];
  hit.element='pyro';hit.attackTag=m.attackTag;
  for(const key of ['damageBonusFormula','critRateFormula','critDamageFormula'] as const)if(hit[key]?.ruleId.startsWith('gaming-damage-'))delete hit[key];
  if(hit.attackAdjustment?.formula.ruleId.startsWith('gaming-damage-'))delete hit.attackAdjustment;
  if(special&&asc===undefined)issues.push('请填写突破阶段，确定踏云献瑞的半血增伤是否解锁。');
  if(special&&asc!==undefined&&asc>=4&&c.hpPercent===undefined)issues.push('请填写这一击命中时的生命百分比；它先命中，下一帧才扣血。');
  if(g.constellation>=2&&c.c2Active===undefined)issues.push('请选择溢出治疗后的5秒攻击增益是否仍在生效。');
  if(g.constellation<2&&c.c2Active===true)issues.push('当前命座尚未解锁C2溢出治疗攻击增益。');
  if((g.constellation>=2||c.c2Included)&&c.c2Included===undefined)issues.push('请确认输入攻击力是否已包含C2增益。');
  const c2Difference=Number(c2)-Number(c.c2Included===true);
  if(c2Difference&&c.baseAttack===undefined)issues.push('请补基础攻击力（角色白值＋武器白值），才能补加或移除C2的20%。');
  if(special&&asc!==undefined&&asc>=4&&c.a4Included===undefined)issues.push('请确认本击增伤输入是否已包含半血20%增伤。');
  if(special&&c6&&(c.c6CritRateIncluded===undefined||c.c6CritDamageIncluded===undefined))issues.push('请确认输入双暴是否已包含C6专属20%暴击率与40%暴伤。');
  const saved=c.finalizedHitStates?.[hit.id];
  if((saved!==undefined&&saved!==identity(doc,hit,c))||(hit.finalSnapshot&&(hit.finalSnapshot.origin!=='equipment-conversion'||saved===undefined)))issues.push('此击状态与已转换的历史面板不一致；请重新应用配装，不能改写旧快照。');
  if(!issues.length){
   if(c2Difference)hit.attackAdjustment={accounting:'add-to-panel',formula:fixed('c2-atk','溢出治疗C2：实际20%基础攻击 − 面板已含份额',.2*c.baseAttack!*c2Difference)};
   if(special){
    hit.damageBonusFormula=fixed('a4','踏云献瑞：命中时生命≥50%的20%增伤 − 已含份额',.2*(Number(asc!==undefined&&asc>=4&&c.hpPercent!>=50)-Number(c.a4Included===true)));
    hit.critRateFormula=fixed('c6-cr','踏云献瑞C6：20%暴击率 − 已含份额',.2*(Number(c6)-Number(c.c6CritRateIncluded===true)));
    hit.critDamageFormula=fixed('c6-cd','踏云献瑞C6：40%暴伤 − 已含份额',.4*(Number(c6)-Number(c.c6CritDamageIncluded===true)));
   }
  }
  const id=prefix+hit.id;hit.dependencies.push(id);
  doc.dependencies.push({id,status:issues.length?'missing':'provisional',reason:issues.join('；')||'实际单次命中；C2、A4、C6按真实输入补差，不额外生成生命/能量/冷却事件。',sourceRefs:GAMING_DAMAGE_SOURCE_REFS});
 }
 g.scopeCoverage='single-hit';g.attributionPolicy=special?'E天赋倍率的火元素下落，不使用普攻下落倍率；命中前生命决定A4，C6双暴仅属于此攻击。':'Q猊兽初次冲击；不叠加特殊下落的A4和C6，也不推演后续治疗、返回或重置。';
 return doc;
}
export function resetGamingPanelAccounting(doc:CalculatorDocument,mode:'fresh-equipment'|'imported-final'):void{
 if(!isGamingDamageAction(doc))return;
 const c=doc.gameContext!.gamingDamage??={};delete c.finalizedHitStates;
 for(const key of ['c2Included','a4Included','c6CritRateIncluded','c6CritDamageIncluded'] as const){if(mode==='fresh-equipment')c[key]=false;else delete c[key];}
 if(mode==='imported-final'){delete c.hpPercent;delete c.c2Active;delete c.baseAttack;}
}
export function finalizeGamingPanelAccounting(doc:CalculatorDocument):void{
 if(!isGamingDamageAction(doc))return;
 const c=doc.gameContext!.gamingDamage??={};c.finalizedHitStates=Object.fromEntries(doc.hits.filter(h=>h.kind==='ordinary').map(h=>[h.id,identity(doc,h,c)]));
}
