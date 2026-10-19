import { baizhuSkillContextSchema, type BaizhuSkillContext, type CalculatorDocument, type CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";
export const BAIZHU_SKILL_SOURCE_REFS=[
  "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/baizhu/skill.go",
  "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/baizhu/asc.go",
  "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/baizhu/cons.go",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Baizhu/index.tsx",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Baizhu/skillParam.json",
];
/** The E chain shares the initial snapshot; this is the active character's HP at E cast. */
export function createBaizhuA1SkillBonusFormula(activeHpRatioAtCast:number,a1IncludedInPanel:boolean):CalculatorFormula {
  return {
    ruleId:"baizhu-a1-cast-hp-accounting-b4ae769",label:"白术 A1：E 起手在场角色生命不少于50%时的25%草伤，减去已含份额",
    expression:expr.mul(expr.value(.25),expr.sub(expr.condition("lt",expr.input("baizhuActiveHpRatioAtCast"),expr.value(.5),expr.value(0),expr.value(1)),expr.input("baizhuA1IncludedInPanel"))),
    inputs:[{key:"baizhuActiveHpRatioAtCast",value:activeHpRatioAtCast,minimum:0,maximum:1,unit:"ratio",meaningKey:"E 起手在场角色当前生命／最大生命",origin:"derived-character-context"},{key:"baizhuA1IncludedInPanel",value:Number(a1IncludedInPanel),allowedValues:[0,1],unit:"boolean",meaningKey:"所填逐击适用增伤已包含白术A1的25%草伤",origin:"derived-character-context"}],
    requirements:{minimumAscension:1,maximumConstellation:0,elements:["dendro"],attackTags:["skill"]},sourceRefs:BAIZHU_SKILL_SOURCE_REFS,
  };
}

export const isBaizhuSkillAction=(document:CalculatorDocument):boolean=>document.gameContext?.skillId==="baizhu-skill-complete-cast-c0";

/** A single E cast stores A1 in one initial snapshot for all three chain hits. */
export function applyBaizhuSkillContext(document:CalculatorDocument,supplied:BaizhuSkillContext):CalculatorDocument {
  if(!isBaizhuSkillAction(document))return document;
  const context=baizhuSkillContextSchema.parse(supplied),result=structuredClone(document),game=result.gameContext!;
  game.baizhuSkill=context;
  const prefix="baizhu-skill-context:",assumptionPrefix="白术完整 E 来源上下文：";
  result.dependencies=result.dependencies.filter(dependency=>!dependency.id.startsWith(prefix));
  result.assumptions=result.assumptions.filter(assumption=>!assumption.startsWith(assumptionPrefix));
  const ascension=(result.build.mode==="equipment-derived"?result.build.equipment?.ascension:result.build.ascension)??game.ascension,reasons:string[]=[];
  if(ascension===undefined)reasons.push("必须明确突破阶段，才能确定 E 起手 A1 25% 草伤是否解锁。");
  if((ascension===undefined||ascension>=1)&&context.activeHpRatioAtCast===undefined)reasons.push("缺少 E 起手在场角色的实际生命比例；不能默认满血，也不能默认 A1 不生效。");
  if(context.a1IncludedInPanel&&(ascension===0||(context.activeHpRatioAtCast!==undefined&&context.activeHpRatioAtCast<.5)))reasons.push("该 E 起手 A1 草伤未生效，不能声明已填增伤包含其25%草伤。");
  if(game.constellation!==0)reasons.push("本次完整 E 仅审阅 C0；C2/C6 会产生额外实体或伤害，不能把 C0 三击作为该命座完整伤害。");
  const id=`${prefix}initial-snapshot`;
  result.dependencies.push({id,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"三击复用同一 E 起手快照；A1 依据起手在场角色的明确生命比例和已含增伤记账。",sourceRefs:BAIZHU_SKILL_SOURCE_REFS});
  for(const hit of result.hits){
    hit.dependencies=hit.dependencies.filter(dependency=>!dependency.startsWith(prefix));hit.dependencies.push(id);
    if(hit.kind!=="ordinary")continue;
    hit.sourceRefs=[...new Set([...hit.sourceRefs,...BAIZHU_SKILL_SOURCE_REFS])];
    if(context.activeHpRatioAtCast!==undefined)hit.damageBonusFormula=createBaizhuA1SkillBonusFormula(context.activeHpRatioAtCast,context.a1IncludedInPanel);
    else delete hit.damageBonusFormula; // The required dependency above blocks unlocked A1; no placeholder HP is evaluated.
  }
  result.assumptions.push(`${assumptionPrefix}三次游丝徵灵的进攻面板由起手同一 Snapshot 保存，A1 读取该时点在场角色生命比例；后续生命变化不重新取样。0.5 恰好达到草伤门槛。`,` ${assumptionPrefix}起手生命比例是实际条件输入，不预填满血；突破0未解锁A1时不依赖此值。已含开关只对应逐击伤害加成中的25%草伤，不改变攻击面板。`.trim(),`${assumptionPrefix}三击均实际命中同一存活目标、没有断链；C0的A4只影响独立反应加成，不自动并入普通E伤害。逐击反应需要自己的实际适用反应加成。`);
  return result;
}

/** A new panel changes only whether A1 is already represented; no current HP is substituted for the cast input. */
export function resetBaizhuPanelAccounting(document:CalculatorDocument,mode:"fresh-equipment"|"imported-final"):void {
  if(!isBaizhuSkillAction(document))return;
  document.gameContext!.baizhuSkill={...document.gameContext!.baizhuSkill,a1IncludedInPanel:mode==="imported-final"};
}
/** Canonicalize before core execution as well as UI refresh; JSON cannot give the three hits conflicting A1 formulas. */
export function prepareBaizhuSkillDocument(document:CalculatorDocument):CalculatorDocument {
  return isBaizhuSkillAction(document)?applyBaizhuSkillContext(document,document.gameContext?.baizhuSkill??{a1IncludedInPanel:false}):document;
}
