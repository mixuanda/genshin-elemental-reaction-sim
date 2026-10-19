import { ningguangBurstContextSchema, type CalculatorDocument, type CalculatorFormula, type NingguangBurstContext } from "../../../packages/sim-core/src/calculator-model";
import { expr } from "../../../packages/sim-core/src/calculation-trace";
import evidence from "../../../packages/game-data/src/character-mappings/ningguang-screen-source-manifest.json";

export const NINGGUANG_BURST_SOURCE_REFS = Object.keys(evidence.sourceSha256).filter(path => path.endsWith(".go")).map(path => `https://github.com/genshinsim/gcsim/blob/${evidence.revision}/${path}`);
export const isNingguangScreenBurstAction = (document: CalculatorDocument): boolean => document.gameContext?.skillId === "ningguang-burst-with-screen";
const a4Formula = (active:boolean,included:boolean):CalculatorFormula => ({
  ruleId:"ningguang-a4-snapshot-accounting-b4ae769",label:"对应快照中穿屏 A4 的 12% 岩伤记账",
  expression:expr.mul(expr.value(.12),expr.sub(expr.input("ningguangA4Active"),expr.input("ningguangA4Included"))),
  inputs:[{key:"ningguangA4Active",value:Number(active),unit:"boolean",meaningKey:"对应快照中 A4 是否有效",origin:"conditioned-user-input"},{key:"ningguangA4Included",value:Number(included),unit:"boolean",meaningKey:"所填增伤是否已含 A4",origin:"conditioned-user-input"}],sourceRefs:NINGGUANG_BURST_SOURCE_REFS,
  requirements:{elements:["geo"],attackTags:["burst"]}
});
/** Each group keeps its own offensive snapshot; only the shared hit-time target is read live. */
export function applyNingguangBurstContext(document:CalculatorDocument,supplied:NingguangBurstContext):CalculatorDocument {
  if(!isNingguangScreenBurstAction(document))return document;
  const context=ningguangBurstContextSchema.parse(supplied),result=structuredClone(document),game=result.gameContext!;
  const prefix="ningguang-screen-context:",assumptionPrefix="凝光有屏 Q 来源上下文：";
  game.ningguangBurst=context;
  result.dependencies=result.dependencies.filter(dependency=>!dependency.id.startsWith(prefix));
  result.assumptions=result.assumptions.filter(assumption=>!assumption.startsWith(assumptionPrefix));
  const currentAscension=(result.build.mode==="equipment-derived"?result.build.equipment?.ascension:result.build.ascension)??game.ascension;
  for(const hit of result.hits){
    hit.dependencies=hit.dependencies.filter(dependency=>!dependency.startsWith(prefix));
    if(hit.kind!=="ordinary")continue;
    const screen=hit.id.startsWith("ningguang-burst-with-screen-screen-"),active=screen?context.screenA4Active:context.currentA4Active,included=screen?context.screenA4IncludedInBonus:context.currentA4IncludedInBonus;
    const ascension=screen?context.screenSnapshot?.ascension:currentAscension,reasons:string[]=[];
    if(screen){
      if(!context.screenAvailable)reasons.push("此动作是有屏十二枚分支：Q 起手必须存在可销毁的璇玑屏；无屏请选独立的无屏六枚动作。");
      if(!context.screenSnapshot)reasons.push("缺少此前 E 命中帧保存的完整进攻快照；六枚屏宝石不能用当前 Q 面板替代。");
      if(context.screenSnapshot)hit.finalSnapshot=structuredClone(context.screenSnapshot);else delete hit.finalSnapshot;
    }
    if((active||included)&&(ascension===undefined||ascension<4))reasons.push("声明对应快照有 A4 时，必须提供该快照突破阶段且至少为 4。");
    if(included&&!active)reasons.push("已包含 A4 与 A4 未生效相互冲突；请恢复该快照实际增伤及 A4 状态。");
    hit.damageBonusFormula=a4Formula(active,included);
    hit.sourceRefs=[...new Set([...hit.sourceRefs,...NINGGUANG_BURST_SOURCE_REFS])];
    const id=`${prefix}${screen?"historical-screen":"current-body"}`;
    hit.dependencies.push(id);
    if(!result.dependencies.some(dependency=>dependency.id===id))result.dependencies.push({id,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||`${screen?"六枚屏宝石读取此前 E 保存的完整历史进攻快照":"六枚本体读取 Q 起手面板"}，A4 只补尚未计入的 12% 岩伤；当前目标条件独立输入。`,sourceRefs:NINGGUANG_BURST_SOURCE_REFS});
  }
  result.assumptions.push(
    `${assumptionPrefix}本体六枚使用 Q 起手快照；屏宝石六枚以 Q 有效天赋系数读取此前 E 命中帧（固定源 17 帧）保存的面板。屏快照必须明确填写 ATK/HP/DEF/EM/暴击、等级、突破、实际适用增伤及基数附加，不猜测过去的装备。`,
    `${assumptionPrefix}历史快照不重新应用当前武器、圣遗物、属性转换、条件暴击或装备反应加成。目标防御/抗性按命中时状态输入；逐击最终抗性仍可明确覆写。A4 两组分别记账，不把本次穿屏自动追溯到过去 E。`,
    `${assumptionPrefix}C0–C6 的这十二枚自身伤害：C1 改普攻范围，C2 重置 E 冷却，C4 增角色抗性，C6 生成七枚星璇供后续重击；均不在本次 Q 自动新增伤害。C3/C5 由明确有效天赋处理，本次屏宝石使用 Q 系数，绝不用 E 倍率。`,
    `${assumptionPrefix}明确以十二枚全部命中同一稳定目标为条件；来源对屏宝石 hitmarks 和穿屏事件仍有 TODO，不认证精确时序、碰撞/散射命中率、合法轮转或游戏实测。`
  );
  return result;
}
