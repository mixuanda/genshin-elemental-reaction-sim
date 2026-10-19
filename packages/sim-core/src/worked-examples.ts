import { OBSERVED_RESOURCE_WORKED_EXAMPLES } from "./observed-resource-worked-examples";
import { expr } from "./calculation-trace";
import { GAME_WORKED_EXAMPLE_INPUTS } from "./game-worked-example-inputs";
import { SPECIAL_TEACHING_CONTEXTS } from "./special-calculator";
import type { CalculatorDocument } from "./calculator-model";
import { DAMAGE_FORMULA_SOURCES } from "./calculator-formula";
import { LUNAR_ARTIFACT_BONUS_RULES, type LunarArtifactBonus, type SpecialBranch } from "@genshin-dps-lab/reaction-formulas";
export interface WorkedExample { id:string; title:string; category:"synthetic"|"source-backed-game"|"verified-game"|"blocked"; family:string; description:string; blockedReasons:string[]; document?:CalculatorDocument }
const fixtureA:CalculatorDocument={schemaVersion:"1.0.0",ruleVersion:"ordinary-trace-v1",id:"fixture-a",label:"教学 A：普通攻击力缩放",scope:"single-hit",characterLevel:90,build:{mode:"equipment-derived",characterBaseAtk:300,weaponBaseAtk:700,atkPercent:.8,flatAtk:200,baseHp:10000,hpPercent:0,flatHp:0,baseDef:700,defPercent:0,flatDef:0,em:0,critRate:.7,critDamage:1.2},enemy:{level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0},hits:[{id:"hit-a",label:"普通攻击力伤害",kind:"ordinary",element:"physical",terms:[{stat:"atk",coefficient:2}],additiveBaseDamage:300,damageBonus:.5,critEligible:true,reaction:"none",reactionBonus:0,groupMultiplier:1,sourceRefs:DAMAGE_FORMULA_SOURCES,dependencies:[]}],selectedHitIds:["hit-a"],assumptions:["合成教学数字，不对应任何实际角色或装备。","独立暴击，无暴击触发效果或状态反馈。"],dependencies:[],dataIdentity:{datasetId:"synthetic-teaching-v1",gameVersion:"not-a-game-build",releaseStatus:"synthetic",evidenceStatus:"synthetic"}};
const clone=(doc:CalculatorDocument)=>structuredClone(doc);
const fixtureB=clone(fixtureA); fixtureB.id="fixture-b";fixtureB.label="教学 B：逐段反应覆盖";fixtureB.scope="one-cast";fixtureB.counterexample="shared-amplification-shortcut";
fixtureB.hits=[{id:"hit-a",label:"第 A 段：有条件增幅",kind:"resolved",preReactionDamage:1000,amplificationMultiplier:1.5,critEligible:true,entryPoint:"已结算其他所有非暴击因素，尚未结算反应和暴击。",sourceRefs:DAMAGE_FORMULA_SOURCES,dependencies:[]},{id:"hit-b",label:"第 B 段：不增幅",kind:"resolved",preReactionDamage:600,amplificationMultiplier:1,critEligible:true,entryPoint:"已结算其他所有非暴击因素，尚未结算反应和暴击。",sourceRefs:DAMAGE_FORMULA_SOURCES,dependencies:[]}];fixtureB.selectedHitIds=["hit-a","hit-b"];
fixtureB.assumptions.push("仅为教学而预先指定第一段反应、第二段不反应；不证明真实角色的附着、ICD 或 Aura 覆盖。");
const variants:Array<[string,string,string,(d:CalculatorDocument)=>void]>=[
["hp-scaling","生命缩放","hp",d=>{const h=d.hits[0]!;if(h.kind==="ordinary"){h.terms=[{stat:"hp",coefficient:.2}];h.additiveBaseDamage=0;}}],
["def-scaling","防御缩放","def",d=>{const h=d.hits[0]!;if(h.kind==="ordinary"){h.terms=[{stat:"def",coefficient:2}];h.additiveBaseDamage=0;}}],
["mixed-scaling","多属性混合缩放","mixed",d=>{const h=d.hits[0]!;if(h.kind==="ordinary"){h.terms=[{stat:"atk",coefficient:1.5},{stat:"hp",coefficient:.1}];}}],
["amplification","有条件反向蒸发","amplification",d=>{const h=d.hits[0]!;if(h.kind==="ordinary"){h.element="pyro";h.reaction="reverseVaporize";}d.assumptions.push("假设这一个火元素伤害满足蒸发条件；不证明实战覆盖。");}],
["additive","有条件超激化","additive",d=>{const h=d.hits[0]!;if(h.kind==="ordinary"){h.element="electro";h.additiveReaction="aggravate";}if(d.build.mode==="equipment-derived")d.build.em=100;d.assumptions.push("假设命中处于激化状态的目标；精确等级值取固定来源表。");}],
["transformative","普通超载伤害","transformative",d=>{d.hits=[{id:"hit-a",label:"超载反应伤害",kind:"transformative",reaction:"overload",reactionBonus:.2,sourceRefs:DAMAGE_FORMULA_SOURCES,dependencies:[]}];if(d.build.mode==="equipment-derived")d.build.em=100;}],
["resource-expression","资源、队友贡献与上限","typed-expression",d=>{const h=d.hits[0]!;if(h.kind==="ordinary"){h.terms=[];h.additiveBaseDamage=0;h.baseDamageFormula={ruleId:"synthetic-resource-cap-v1",label:"资源至少为1时：攻击力 + 10%生命 + 最多3层 × 队友攻击力 × 10%",expression:expr.condition("lt",expr.input("resource"),expr.value(1),expr.value(0),expr.add(expr.input("atk"),expr.mul(expr.input("hp"),expr.value(.1)),expr.mul(expr.min(expr.input("stacks"),expr.value(3)),expr.input("teammateAtk"),expr.value(.1)))),inputs:[{key:"resource",value:1,unit:"count",meaningKey:"input.resource",origin:"conditioned-input"},{key:"stacks",value:2,unit:"count",meaningKey:"input.stacks",origin:"conditioned-input"},{key:"teammateAtk",value:1000,unit:"stat",meaningKey:"input.teammateAtk",origin:"conditioned-input",ownerId:"synthetic-teammate"}],sourceRefs:["synthetic:teaching-formula-not-character-data"]};}d.assumptions.push("此资源、层数、生命转换与队友贡献公式专供教学，不代表任何真实角色机制。");}],
["non-damaging","冻结状态事件","non-damaging",d=>{d.hits=[{id:"hit-a",label:"建立冻结状态",kind:"non-damaging",reason:"冻结本身建立状态，不产生直接伤害。此教学条目不计算冻结持续时间、碎冰或结晶护盾吸收量。",sourceRefs:DAMAGE_FORMULA_SOURCES,dependencies:[]}];}]
];
const lunarArtifactExamples: Array<{ bonus: LunarArtifactBonus; branch: SpecialBranch; explanation: string }> = [
  { bonus: { kind: "thundering-fury-4pc" }, branch: "lunar-charged-reaction", explanation: "如雷只提升装备者的月感电贡献；每位参与者分别结算后再排序。" },
  { bonus: { kind: "flower-of-paradise-lost-4pc", stacks: 2 }, branch: "lunar-bloom-direct", explanation: "乐园两层：10% × (1 + 25% × 2) = 15%直接月绽放反应加成。可改层数，未知时阻塞。" },
  { bonus: { kind: "aubade-4pc", offField: true, moonsignLevel: 2 }, branch: "lunar-crystallize-reaction", explanation: "晓歌满辉后台：20% + 40% = 60%奖励，仍先进入本参与者贡献，再暴击和排名。" },
];
export const WORKED_EXAMPLES:WorkedExample[]=[
...OBSERVED_RESOURCE_WORKED_EXAMPLES,
{id:"fixture-a",title:fixtureA.label,category:"synthetic",family:"atk",description:"完整展示 2,000 攻击力到 5,340.60 期望伤害的执行步骤；附加基础伤害与固定攻击力分开。",blockedReasons:[],document:fixtureA},
{id:"fixture-b",title:fixtureB.label,category:"synthetic",family:"multihit",description:"逐段覆盖得到 3,864；错误统一增幅得到 4,416，高估 552。可修改每段输入。",blockedReasons:[],document:fixtureB},
...GAME_WORKED_EXAMPLE_INPUTS.map(document=>({id:document.id,title:document.label,category:"source-backed-game" as const,family:"ordinary-real-character",description:"真实凯亚 C0、角色与无锋剑均1级：精确数值按固定来源交叉核对，并用独立 Decimal 手算验证。来源仍为暂定，未声称当前版本游戏实测。",blockedReasons:[],document:clone(document)})),
...variants.map(([id,title,family,change])=>{const document=clone(fixtureA);document.id=id;document.label=`合成教学：${title}`;change(document);return {id,title:document.label,category:"synthetic" as const,family,description:"合成参数用于展示已实现公式，不代表真实角色配装；通过同一个计算器执行并可编辑。",blockedReasons:[],document};}),
...Object.entries(SPECIAL_TEACHING_CONTEXTS).map(([branch,context])=>{const document=clone(fixtureA);document.id=`special-${branch}`;document.label=`合成条件公式：${branch}`;document.hits=[{id:"hit-a",label:branch,kind:"special",context:structuredClone(context),sourceRefs:["https://keqingmains.com/misc/lunar-reactions/","https://keqingmains.com/misc/stellar-reaction-guide/"],dependencies:[]}];document.assumptions.push(...context.context.assumptions);return {id:document.id,title:document.label,category:"synthetic" as const,family:branch,description:"来源固定的条件特殊公式；所有角色面板、等级基数、参与者与领域计数均为可编辑教学输入。并非完整游戏或队伍模拟。",blockedReasons:[],document};}),
...lunarArtifactExamples.map(({bonus,branch,explanation})=>{
  const document=clone(fixtureA), context=structuredClone(SPECIAL_TEACHING_CONTEXTS[branch]);
  context.contributors[0]!.artifactBonus=bonus;
  document.id=`special-artifact-${bonus.kind}`;document.label=`合成条件示例：${LUNAR_ARTIFACT_BONUS_RULES[bonus.kind].name}·月曜`;
  document.hits=[{id:"hit-a",label:document.label,kind:"special",context,sourceRefs:[LUNAR_ARTIFACT_BONUS_RULES[bonus.kind].source],dependencies:[]}];
  document.assumptions.push(...context.context.assumptions,explanation,"此处只执行所选套装的月曜反应奖励；最终面板需已计入两件套和其他面板来源，手动反应奖励不含本条款。");
  return {id:document.id,title:document.label,category:"synthetic" as const,family:"lunar-artifact",description:explanation,blockedReasons:[],document};
}),
...["Lunar-Charged","Lunar-Bloom","Lunar-Crystallize","Stellar-Conduct","Stellar-Swirl"].map(family=>({id:`blocked-${family.toLowerCase()}`,title:`${family} 完整游戏示例`,category:"blocked" as const,family,description:"未以普通反应改名代替特殊机制。",blockedReasons:["缺少与所选角色/配装/版本匹配的完整已验证游戏实例。","贡献者、状态、触发与直接伤害区分、暴击和排序规则须分别验证；独立条件公式不等于完整游戏实例。"]}))
];
export function loadWorkedExample(id:string):CalculatorDocument {const example=WORKED_EXAMPLES.find(e=>e.id===id);if(!example?.document)throw new Error(example?.blockedReasons.join("；")??`Unknown worked example: ${id}`);return clone(example.document);}
