import {initializeArlecchinoDamageDocument} from './arlecchino-calculation-context';
import {isArlecchinoDamageAction,ARLECCHINO_DAMAGE_SOURCE_REFS} from '../../../packages/sim-core/src/arlecchino-damage-formulas';
import {applyHutaoDamageContext,createHutaoExampleContext} from './hutao-calculation-context';
import {isHutaoPrimaryDocument,HUTAO_DAMAGE_SOURCE_REFS} from '../../../packages/sim-core/src/hutao-damage-formulas';
import {extendKinichDocuments} from './kinich-calculation-context';
import {initializeKazuhaBurstDocument} from './kazuha-calculation-context';
import {isKazuhaBurstAction} from '../../../packages/sim-core/src/kazuha-burst-formulas';
import {KAZUHA_BURST_SOURCE_REFS} from '../../../packages/sim-core/src/kazuha-burst-source-values';
import {applyCynoDamageContext,createCynoExampleContext} from './cyno-calculation-context';
import {isCynoDamageDocument,CYNO_DAMAGE_SOURCE_REFS} from '../../../packages/sim-core/src/cyno-damage-formulas';
import {isKinichDamageAction,KINICH_DAMAGE_SOURCE_REFS} from '../../../packages/sim-core/src/kinich-damage-formulas';
import {isGamingDamageAction,prepareGamingDamageDocument,GAMING_DAMAGE_SOURCE_REFS} from '../../../packages/sim-core/src/gaming-damage-formulas';
import {extendXiaoDocuments} from "./xiao-calculation-context";
import {isXiaoDamageAction,XIAO_DAMAGE_SOURCE_REFS} from "../../../packages/sim-core/src/xiao-damage-formulas";
import {applyTighnariDamageContext,isTighnariDamageAction} from './tighnari-calculation-context';
import { optimizerSpecialComponents } from "../../../packages/game-data/src/character-mappings/optimizer-special-components";
import { createObservedSpecialComponentDocument } from "../../../packages/sim-core/src/observed-special-component-formulas";
import { prepareSourceCastDocument } from "../../../packages/sim-core/src/source-cast-context";
import { isWandererInitialSingleHit } from "../../../packages/sim-core/src/idle-stance-formulas";
import { isDurinSkillAction } from "../../../packages/sim-core/src/durin-skill-formulas";
import { resolveClassifiedCharacterHits } from "@genshin-dps-lab/game-data/classified-hits";
import { releasedRuntimeWorkspace, type RuntimeWorkspace } from "@genshin-dps-lab/game-data";
import { stampCalculatorWorkspaceEvidence } from "./calculator-workspace-trust";
import { CALCULATOR_RULE_VERSION, CALCULATOR_SCHEMA_VERSION, type CalculatorDocument, type CalculatorFormula, type CalculatorHit } from "../../../packages/sim-core/src/calculator-model";
import { createClorindeA1Formula, createDendroTravelerA4BonusFormula } from "../../../packages/sim-core/src/character-formula-rules";
import { createAlyoshaA4BonusFormula, createAmberA1CritRateFormula, createLinneaA1ResistanceReductionFormula, createLohenWillFormula, createNeferBurstVeilBonusFormula, createNeferC4ResistanceReductionFormula, createNeferFullVeilEmFormula } from "./character-source-formulas";

import { applyNoelleBurstContext, isNoelleContextAction } from "./noelle-calculation-context";
import { NOELLE_BURST_SOURCE_REFS } from "../../../packages/sim-core/src/noelle-formulas";
export { applyNoelleBurstContext } from "./noelle-calculation-context";
import { applyIttoChargedContext, isIttoKesagiriAction } from "./itto-calculation-context";
import { ITTO_KESAGIRI_SOURCE_REFS } from "../../../packages/sim-core/src/itto-formulas";
export { applyIttoChargedContext } from "./itto-calculation-context";

import { applyYanfeiChargedContext, isYanfeiChargedAction } from "./yanfei-calculation-context";
import { YANFEI_CHARGED_SOURCE_REFS } from "../../../packages/sim-core/src/yanfei-formulas";
export { applyYanfeiChargedContext } from "./yanfei-calculation-context";
import { applyKeqingBurstContext, applyXingqiuSkillContext, isKeqingBurstAction, isXingqiuSkillAction, KEQING_A4_ER_MODIFIER_ID } from "./keqing-xingqiu-calculation-context";
import { KEQING_BURST_SOURCE_REFS, XINGQIU_SKILL_SOURCE_REFS } from "../../../packages/sim-core/src/keqing-xingqiu-formulas";
export { applyKeqingBurstContext, applyXingqiuSkillContext, resetKeqingPanelAccounting } from "./keqing-xingqiu-calculation-context";

import { applyNingguangBurstContext, isNingguangScreenBurstAction, NINGGUANG_BURST_SOURCE_REFS } from "./ningguang-calculation-context";
export { applyNingguangBurstContext } from "./ningguang-calculation-context";

import { applyKukiDamageContext, isKukiDamageAction } from "./kuki-calculation-context";
import { KUKI_DAMAGE_SOURCE_REFS } from "../../../packages/sim-core/src/kuki-formulas";
export { applyKukiDamageContext, resetKukiPanelAccounting } from "./kuki-calculation-context";

import { applyBaizhuSkillContext, isBaizhuSkillAction } from "./baizhu-calculation-context";
export { applyBaizhuSkillContext } from "./baizhu-calculation-context";

import { applyColleiSkillContext, applyCharlotteSkillContext, isColleiSkillAction, isCharlotteSkillAction, COLLEI_SKILL_SOURCE_REFS, CHARLOTTE_SKILL_SOURCE_REFS } from "./collei-charlotte-calculation-context";
export { applyColleiSkillContext, applyCharlotteSkillContext } from "./collei-charlotte-calculation-context";

const additiveFormulaFactories = { "clorinde-a1": () => createClorindeA1Formula(0), "lohen-will-consumed": createLohenWillFormula } as const;
const elementalMasteryFormulaFactories = { "nefer-full-veil-em": () => createNeferFullVeilEmFormula(0) } as const;
const resistanceReductionFormulaFactories = { "linnea-a1-lumi": createLinneaA1ResistanceReductionFormula } as const;
const critRateFormulaFactories = { "amber-a1-burst": createAmberA1CritRateFormula } as const;
const damageBonusFormulaFactories = {
  "dendro-traveler-a4-skill": () => createDendroTravelerA4BonusFormula("skill"),
  "dendro-traveler-a4-burst": () => createDendroTravelerA4BonusFormula("burst"),
  "nefer-burst-veils": createNeferBurstVeilBonusFormula,
  "alyosha-a4-er": createAlyoshaA4BonusFormula
} as const;

const constellationDependencyPrefix = "constellation-scope:";
const constellationAssumptionPrefix = "所选命中命座范围：";
const kaeyaConstellationSources = ["cons.go", "burst.go", "kaeya.go"].map((file) =>
  `https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kaeya/${file}`);
const neferConstellationSources = [
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx#L195-L199",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Nefer/index.tsx#L221-L300",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/tooltips_gen.json#L239-L247"
];

function preserveConditionInputs(next: CalculatorFormula, previous?: CalculatorFormula): CalculatorFormula {
  for (const input of next.inputs) if (input.origin === "conditioned-user-input") {
    const oldInput = previous?.inputs.find((entry) => entry.key === input.key);
    if (oldInput) input.value = oldInput.value;
  }
  return next;
}

/** Refresh sourced C ranges without clamping or inventing resource/debuff states. */
function prepareNeferOrdinaryContext(hit: Extract<CalculatorHit, { kind: "ordinary" }>, constellation: number): void {
  const previousAdjustment = hit.elementalMasteryAdjustment;
  hit.elementalMasteryAdjustment = {
    formula: preserveConditionInputs(createNeferFullVeilEmFormula(constellation), previousAdjustment?.formula),
    accounting: previousAdjustment?.accounting ?? "already-in-final-panel"
  };
  if (hit.damageBonusFormula?.ruleId.startsWith("nefer-burst-veils-")) {
    const formula = hit.damageBonusFormula;
    formula.ruleId = `nefer-burst-veils-${constellation >= 2 ? "c2-c6" : "c0-c1"}-optimizer-180a0a1`;
    formula.requirements = { minimumAscension: 1, ...(constellation >= 2 ? { minimumConstellation: 2, maximumConstellation: 6 } : { maximumConstellation: 1 }), elements: ["dendro"], attackTags: ["burst"] };
    const stacks = formula.inputs.find((input) => input.key === "neferVeilStacks");
    if (stacks) stacks.maximum = constellation >= 2 ? 5 : 3;
  }
  if (constellation >= 4) {
    hit.resistanceReductionFormula = preserveConditionInputs(createNeferC4ResistanceReductionFormula(), hit.resistanceReductionFormula);
  } else if (hit.resistanceReductionFormula?.ruleId === "nefer-c4-target-dendro-resistance-optimizer-180a0a1") {
    delete hit.resistanceReductionFormula;
  }
}

/** Re-evaluate only this hit's reviewed constellation scope after an import/action change. */
export function applyCharacterConstellationScope(document: CalculatorDocument, workspace: RuntimeWorkspace = releasedRuntimeWorkspace): CalculatorDocument {
  const context = document.gameContext;
  if (!context) return document;
  const result = structuredClone(document);
  if (!isKeqingBurstAction(result) && result.build.mode === "equipment-derived" && result.build.equipment) {
    result.build.equipment.statModifiers = result.build.equipment.statModifiers?.filter((modifier) => modifier.id !== KEQING_A4_ER_MODIFIER_ID);
  }
  result.dependencies = result.dependencies.filter((dependency) => !dependency.id.startsWith(constellationDependencyPrefix));
  result.assumptions = result.assumptions.filter((assumption) => !assumption.startsWith(constellationAssumptionPrefix)
    && assumption !== "C0 条件；有效天赋等级显式输入，不自动增加命座等级。");
  result.assumptions.push(`${constellationAssumptionPrefix}实际 C${context.constellation}；有效天赋等级显式输入，命座范围按每个命中独立检查，不自动再次增加天赋等级。`);
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter((dependency) => !dependency.startsWith(constellationDependencyPrefix));
    if (hit.kind !== "ordinary") continue;
    const id = `${constellationDependencyPrefix}${hit.id}`;
    let allowed = context.constellation === 0;
    let reason = allowed
      ? "该命中的来源映射已审阅 C0 条件；其他依赖仍分别检查。"
      : `本命中尚未审阅 C${context.constellation} 对系数、条件暴击或额外伤害的影响；仅该命中的命座依赖缺失，不能用 C0 静默替代。`;
    let sourceRefs = hit.sourceRefs;
    const kaeyaSkill = context.skillId === "kaeya-skill" && hit.attackTag === "skill";
    const kaeyaTick = context.skillId === "kaeya-burst-burst" && hit.attackTag === "burst" && context.scopeCoverage === "selected-components";
    if(isTighnariDamageAction(result)) {
      allowed = context.skillId !== "tighnari-wreath-complete-c0-c5" || context.constellation <= 5;
      reason = "提纳里：C1只给重击暴击，C2草伤、C4精通按实际状态恢复；C3/C5由有效等级一次处理。C6花筥额外箭未混入C0–C5总数。";
    } else if (context.abilityId.startsWith("talent:kaeya:") && (kaeyaSkill || kaeyaTick)) {
      allowed = true;
      sourceRefs = [...sourceRefs, ...kaeyaConstellationSources];
      reason = "固定来源 C1 仅影响普攻/重击条件暴击；C2/C6 改变爆发持续时间或冰棱数量，C4 为护盾。所选 E 或单个 Q tick 的伤害系数保持不变；C3/C5 已由显式有效天赋等级处理。此项不验证整个爆发总次数。";
    } else if (context.abilityId.startsWith("talent:kaeya:") && context.constellation > 0 && (hit.attackTag === "normal" || hit.attackTag === "charged")) {
      sourceRefs = [...sourceRefs, ...kaeyaConstellationSources];
      reason = "凯亚 C1+ 普攻/重击对冰附着或冻结目标有 15% 条件暴击率；当前命中未提供该目标状态及条件暴击来源，不能静默忽略。凯亚 E 与所选 Q 单 tick 不依赖此条件。";
    } else if (context.skillId === "clorinde-burst-burstdamage" && hit.attackTag === "burst") {
      allowed = context.constellation <= 1;
      sourceRefs = [...sourceRefs, "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/clorinde/cons.go"];
      reason = allowed
        ? "克洛琳德所选 Q 的基础倍率与 A1 公式已审阅 C0/C1；C1 追击为战技状态普攻相关，不归属于本次 Q。A1 层数与突破门仍独立检查。"
        : "克洛琳德 C2+ 改变 A1 系数和上限，C4/C6 还引入生命之契增伤或状态暴击条件；本命中仅提供 C0/C1 公式，需相应命座公式后才能计算。";
    } else if(isArlecchinoDamageAction(result)) {
      allowed=context.constellation===0;sourceRefs=[...sourceRefs,...ARLECCHINO_DAMAGE_SOURCE_REFS];
      reason=allowed?"阿蕾奇诺C0红死之宴所选一击：独立普攻倍率、扣契前生命之契附伤及固有火伤记账分别核对；不代算耗契或整轮。":"红死之宴此入口只审阅C0，不能省略更高命座的附伤或条件暴击。";
    } else if(isHutaoPrimaryDocument(result)) {
      allowed=context.constellation<=1;sourceRefs=[...sourceRefs,...HUTAO_DAMAGE_SOURCE_REFS];
      reason=allowed?"胡桃C0/C1彼岸蝶舞所选火普攻或重击：独立普攻/E天赋、施放E最大生命和400%白值上限、本击半血火伤分别核对；不含血梅香或整轮。":"此彼岸蝶舞单击入口只审阅C0/C1，不能省略更高命座状态。";
    } else if(isKazuhaBurstAction(result)) {
      allowed=context.constellation<=1;sourceRefs=[...sourceRefs,...KAZUHA_BURST_SOURCE_REFS];
      reason=allowed?"万叶C0/C1所选Q直接伤害：元素转化时点、逐元素增伤和81f前A4单独检查；C1不增加Q直接命中，不含扩散实体。":"万叶Q此入口尚未接入C2以上的精通与命座快照，不以低命座代算。";
    } else if(isCynoDamageDocument(result)) {
      allowed=context.constellation===0;sourceRefs=[...sourceRefs,...CYNO_DAMAGE_SOURCE_REFS];
      reason=allowed?"赛诺C0启途誓使所选普攻或重击使用Q有效天赋，Q精通及A4动作起手取样独立核对；末途真眼E和完整循环不在此入口。":"启途誓使此单击入口只审阅C0，尚未接入高命座，不能按C0代算。";
    } else if(isKinichDamageAction(result)) {
      allowed=context.constellation<=1;sourceRefs=[...sourceRefs,...KINICH_DAMAGE_SOURCE_REFS];
      reason=allowed?"基尼奇C0/C1所选E命中：环绕射击/贯鳞炮使用独立E天赋，夜魂值、心得、创建时攻击力与C1已含份额分别检查；不代算Q或完整循环。":"基尼奇此入口尚未实现C2以上的首炮增伤、减抗及高命座机制，不能用C0/C1代算。";
    } else if(isGamingDamageAction(result)) {
      allowed=true;sourceRefs=[...sourceRefs,...GAMING_DAMAGE_SOURCE_REFS];
      reason="嘉明所选自身一击：C2实际攻击增益、A4命中生命、C6专属双暴独立核对；有效E/Q等级已含C3/C5，不生成治疗/回能/循环。";
    } else if(isXiaoDamageAction(result)) {
      allowed=true;sourceRefs=[...sourceRefs,...XIAO_DAMAGE_SOURCE_REFS];
      reason="魈实际单击：C1/C2/C4及C6后续E资格不改本击；C3/C5由有效E/独立有效Q等级处理。Q状态、A1时间、E前A4层数与已含份额仍单独确认，不生成整轮。";
    } else if (isDurinSkillAction(result)) {
      allowed = context.constellation <= 2;
      reason = allowed ? "杜林白E/黑E自身命中已核对C0–C2：C1不追加自身E，C2的50%火伤仍按实际快照和已含份额检查；不自动提供Q后台、队友伤害或A1反应状态。" : "杜林E当前仅审阅C0–C2，不以低命座代算更高命座。";
    } else if (isWandererInitialSingleHit(result, hit)) {
      allowed = true;
      reason = "流浪者所选E初击已审阅C0–C6：初击不挂接C6普攻追加回调，C1攻速/风矢、C2爆发增伤不改变本击；C3提升Q、C5提升E，已由显式有效天赋处理。A1/C4吸收可先于第2帧快照改变攻击/暴击，本击仍须通过吸收与面板条件检查；此项不开放完整姿态或空居普攻。";
    } else if (isKukiDamageAction(result)) {
      allowed = context.kukiDamage !== undefined;
      sourceRefs = [...sourceRefs, ...KUKI_DAMAGE_SOURCE_REFS];
      reason = allowed ? "久岐忍 E/Q 本次自身伤害 C0–C6：C2环次数、施放HP分支、A4与C6精通差值按命中独立检查；C4外部攻击追加印记不属于本动作。" : "缺少久岐忍E/Q的明确分支与实际面板上下文。";
    } else if (isColleiSkillAction(result)) {
      allowed=context.constellation<=5||result.scope==="single-hit";sourceRefs=[...sourceRefs,...COLLEI_SKILL_SOURCE_REFS];
      reason=allowed?"柯莱C0–5按明确触发选择无新叶/2tick/4tick完整分支，释放与回收快照分别恢复；C6可单选已定义组成，不能当完整E。":"C6新增200%ATK伤害尚未纳入，当前分支不构成完整E。";
    } else if (isCharlotteSkillAction(result)) {
      allowed=context.constellation<=5;sourceRefs=[...sourceRefs,...CHARLOTTE_SKILL_SOURCE_REFS];
      reason=allowed?"夏洛蒂C0–5完整标记按明确A4队友地区、逐击C2实际层数与面板已含份额、未中断和其余条件稳定计算；C5有效E等级显式提供。":"C6还会因外部普攻/重击命中标记目标而新增伤害，当前不把该分支当作完整E。";
    } else if (isNingguangScreenBurstAction(result)) {
      allowed=context.ningguangBurst!==undefined;
      sourceRefs=[...sourceRefs,...NINGGUANG_BURST_SOURCE_REFS];
      reason=allowed?"凝光有屏 Q 已审阅 C0–C6 的本次十二枚自身伤害；本体 Q 快照、屏宝石此前 E 快照及各自 A4 独立检查。C6 星璇属于后续重击，不在本次 Q 增加伤害；有效天赋等级已包含 C3。":"缺少本体与历史屏快照及独立 A4 上下文。";
    } else if (isKeqingBurstAction(result)) {
      allowed = context.keqingBurst !== undefined;
      sourceRefs = [...sourceRefs, ...KEQING_BURST_SOURCE_REFS];
      reason = allowed ? "刻晴完整 Q C0–C6：A4 起手、C4 基础攻击25%逐击差值、C6四类各6%与已含份额独立检查；未知仅阻塞相关命中，C3已包含于有效天赋。" : "缺少刻晴 Q 的 A4 及逐击命座上下文，不能假定状态。";
    } else if (isXingqiuSkillAction(result)) {
      allowed = context.xingqiuSkill !== undefined;
      sourceRefs = [...sourceRefs, ...XINGQIU_SKILL_SOURCE_REFS];
      reason = allowed ? "行秋完整 E 已审阅 C0–C6：永久 A4、C4 起手 Q 生效倍率与目标既有 C2 减抗显式记账；其他命座不新增本次 E 自身伤害，C5 已包含于有效天赋。" : "缺少行秋 E 的突破被动记账、起手 Q、既有 C2 与快照条件。";
    } else if (isYanfeiChargedAction(result)) {
      allowed=context.yanfeiCharged!==undefined;
      sourceRefs=[...sourceRefs,...YANFEI_CHARGED_SOURCE_REFS];
      reason=allowed?"烟绯单次重击 C0–C6 已逐段处理：C2 主击/A4 各自目标生命条件、C6 四印上限，A1 替换旧加成、Q 独立有效等级与状态、A4 暴击触发一次独立暴击追击；未推断轮转、产印或快照时间线。":"缺少烟绯印数、逐段 Q/目标生命、在场及 A4 快照条件。";
    } else if (isIttoKesagiriAction(result)) {
      allowed = context.ittoCharged !== undefined;
      sourceRefs = [...sourceRefs, ...ITTO_KESAGIRI_SOURCE_REFS];
      reason = allowed ? "一斗所选单次荒泷逆袈裟已审阅 C0–C6：C1/C2不改变本击数值，C4攻防必须恢复明确生效面板，C6重击暴伤+70%与实际保层分支独立。Q转换、A4动作DEF快照和怪力条件分别检查，不把整段随机长度当作已知。" : "缺少荒泷逆袈裟的怪力、Q、C4和快照明确上下文，不能套用未声明的分支。";
    } else if (isNoelleContextAction(result)) {
      allowed = context.noelleBurst !== undefined;
      sourceRefs = [...sourceRefs, ...NOELLE_BURST_SOURCE_REFS];
      reason = !allowed ? "所选诺艾尔动作缺少明确 Q 状态与攻击转换记账上下文，不能从当前面板猜测。" : "所选诺艾尔动作已审阅 C0–C6：C2 仅重击15%增伤，C6仅Q防御转换另加50%；普通/重击/下落受明确Q状态岩附魔。C3/C5由独立有效天赋输入处理，C4护盾爆炸不属于本输入。历史非Extra防御、转换是否已含及Q状态仍独立检查。";
    } else if (context.abilityId.startsWith("talent:nefer:") && hit.element === "dendro"
      && ((context.skillId === "nefer-skill-rush" && hit.attackTag === "skill")
        || (context.skillId === "nefer-burst" && hit.attackTag === "burst"))) {
      allowed = true;
      prepareNeferOrdinaryContext(hit, context.constellation);
      sourceRefs = [...sourceRefs, ...neferConstellationSources];
      reason = "所选普通 E 突进/Q 两段已按 C0–C6 独立核对：C1/C6特殊增量仅属于幻戏/月绽放，不新增到本动作；C2后Q采用0–5消耗域且独立8秒精通状态为200替代100，C4需该目标实际减抗状态；C3/C5由显式有效天赋等级处理。本次E触发资源/影舞与命中的先后不自动推断。";
    }
    hit.dependencies.push(id);
    result.dependencies.push({ id, status: allowed ? "provisional" : "missing", reason, sourceRefs });
  }
  if(isTighnariDamageAction(result))return applyTighnariDamageContext(result,result.gameContext?.tighnariDamage??{});
  if(isKukiDamageAction(result)&&result.gameContext?.kukiDamage)return applyKukiDamageContext(result,result.gameContext.kukiDamage);
  if(isColleiSkillAction(result))return applyColleiSkillContext(result,result.gameContext?.colleiSkill??{});
  if(isCharlotteSkillAction(result))return applyCharlotteSkillContext(result,result.gameContext?.charlotteSkill??{a4IncludedInPanel:false});
  if(isBaizhuSkillAction(result))return applyBaizhuSkillContext(result,result.gameContext?.baizhuSkill??{a1IncludedInPanel:false});
  if(isNingguangScreenBurstAction(result)&&result.gameContext?.ningguangBurst)return applyNingguangBurstContext(result,result.gameContext.ningguangBurst);
  if(isKeqingBurstAction(result)&&result.gameContext?.keqingBurst)return applyKeqingBurstContext(result,result.gameContext.keqingBurst);
  if(isXingqiuSkillAction(result)&&result.gameContext?.xingqiuSkill)return applyXingqiuSkillContext(result,result.gameContext.xingqiuSkill,workspace);
  if(isYanfeiChargedAction(result)&&result.gameContext?.yanfeiCharged)return applyYanfeiChargedContext(result,result.gameContext.yanfeiCharged);
  if(isIttoKesagiriAction(result) && result.gameContext?.ittoCharged)return applyIttoChargedContext(result,result.gameContext.ittoCharged,workspace);
  return isNoelleContextAction(result) && result.gameContext?.noelleBurst ? applyNoelleBurstContext(result, result.gameContext.noelleBurst,workspace) : prepareSourceCastDocument(result);
}

/** Source-reviewed fields only; a missing field blocks its action, not its character. */
export function getCharacterDocuments(characterId: string, talentLevel = 10, workspace: RuntimeWorkspace = releasedRuntimeWorkspace): CalculatorDocument[] {
  const { hits, blockers } = resolveClassifiedCharacterHits(characterId, talentLevel, workspace);
  const documents = [...new Set([...hits, ...blockers].map((hit) => hit.skillId))].map((skillId) => {
    const group = hits.filter((hit) => hit.skillId === skillId);
    const missing = blockers.filter((hit) => hit.skillId === skillId);
    const first = group[0] ?? missing[0]!;
    const completeAction = missing.length === 0 && group.every((hit) => hit.completeAction);
    const assumptions = [...new Set(group.flatMap((hit) => hit.requiredAssumptions))];
    const exclusions = [...new Set(group.flatMap((hit) => hit.unrelatedBlockers))];
    const numericalDependencies = [...new Map(group.flatMap((hit) => [...hit.terms, ...hit.formulaInputs].map((term) => [term.coefficientField, {
      id: term.coefficientField, status: "provisional" as const,
      reason: `固定来源完整天赋向量与当前字段一致；数值证据：${hit.numericEvidenceStatus}。同一原始提取链的比对不等于独立机制验证：${term.coefficientField}`,
      sourceRefs: hit.sourceRefs
    }] as const))).values()];
    const documentHits: CalculatorDocument["hits"] = [
      ...group.map((hit) => ({
        id: hit.id, label: hit.label, kind: "ordinary" as const, element: hit.element, attackTag: hit.attackTag,
        sourceRefs: hit.sourceRefs, dependencies: [...hit.terms.map((term) => term.coefficientField), ...hit.formulaInputs.map((input) => input.coefficientField), "conditioned-action"],
        terms: hit.terms.map(({ stat, coefficient, minimumAscension }) => ({ stat, coefficient, ...(minimumAscension !== undefined ? { minimumAscension } : {}) })),
        additiveBaseDamage: 0, damageBonus: 0, critEligible: true,
        ...(hit.additiveFormulaId ? { additiveBaseFormula: additiveFormulaFactories[hit.additiveFormulaId](hit) } : {}),
        ...(hit.damageBonusFormulaId ? { damageBonusFormula: damageBonusFormulaFactories[hit.damageBonusFormulaId](hit) } : {}),
        ...(hit.resistanceReductionFormulaId ? { resistanceReductionFormula: resistanceReductionFormulaFactories[hit.resistanceReductionFormulaId]() } : {}),
        ...(hit.critRateFormulaId ? { critRateFormula: critRateFormulaFactories[hit.critRateFormulaId]() } : {}),
        ...(hit.elementalMasteryAdjustmentFormulaId ? { elementalMasteryAdjustment: { formula: elementalMasteryFormulaFactories[hit.elementalMasteryAdjustmentFormulaId](), accounting: "already-in-final-panel" as const } } : {}),
        reaction: "none" as const, reactionBonus: 0, groupMultiplier: 1
      })),
      ...missing.map((hit) => ({ id: hit.id, label: hit.label, kind: "blocked" as const, reasons: hit.reasons, dependencies: [`missing:${hit.id}`], sourceRefs: hit.sourceRefs }))
    ];
    const document: CalculatorDocument = {
      schemaVersion: CALCULATOR_SCHEMA_VERSION, ruleVersion: CALCULATOR_RULE_VERSION,
      id: `${characterId}:${skillId}:talent-${talentLevel}`,
      label: `${first.characterName} · ${first.skillName} · 有效天赋等级 ${talentLevel}${completeAction ? "" : " · 所选组成"}`,
      gameContext: {
        variantId: first.variantId, variantName: first.variantName,
        characterId, characterName: first.characterName, abilityId: first.abilityId, skillId, skillName: first.skillName,
        effectiveTalentLevel: talentLevel, constellation: 0, ascension: 6,
        scopeCoverage: completeAction ? "complete-cast" : "selected-components",
        attributionPolicy: completeAction ? "仅所述条件下本次输入/分支产生的列出自身伤害实例；不含其他动作、队友或反应生成实体。" : "仅列出的自身伤害组成；持续实体 tick、后续触发与其他动作未全部纳入，不能当作完整施放总伤。"
      },
      scope: documentHits.length === 1 ? "single-hit" : "one-cast", characterLevel: 90,
      build: { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: 0.7, critDamage: 1.2, ...(group.some((hit) => hit.damageBonusFormulaId === "alyosha-a4-er") ? { energyRecharge: 1 } : {}) }, source: "用户可编辑示例最终面板；不是真实角色装备配置，不推断基础面板或装备分解。若含元素充能效率，1 表示教学输入 100%，实际角色必须恢复自己的数值。" },
      enemy: { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 },
      hits: documentHits, selectedHitIds: documentHits.map((hit) => hit.id),
      assumptions: [...assumptions, "C0 条件；有效天赋等级显式输入，不自动增加命座等级。", "默认面板为教学输入；若已启用相关伤害被动或状态，必须提供命中实际适用面板与增伤，结果保持条件计算。", ...exclusions],
      dependencies: [
        ...numericalDependencies,
        ...missing.map((hit) => ({ id: `missing:${hit.id}`, status: "missing" as const, reason: hit.reasons.join("；"), sourceRefs: hit.sourceRefs })),
        { id: "conditioned-action", status: "provisional", reason: "来源分类只建立所选命中表达式；命中时状态、反应和额外加成仍按显式条件输入，不证明完整实战时序。", sourceRefs: first.sourceRefs },
        { id: "unrelated-team-rotation", status: "missing", reason: "完整角色/队伍轮转、所有被动命座及额外触发尚未由本映射验证。此项不属于所选条件命中的依赖。", sourceRefs: [] }
      ],
      dataIdentity: { datasetId: workspace.metadata.snapshotId, gameVersion: workspace.metadata.gameVersion, releaseStatus: workspace.channel === "preview" ? "preview" : workspace.metadata.releaseStatus, evidenceStatus: "provisional" }
    };
    if(isArlecchinoDamageAction(document))return initializeArlecchinoDamageDocument(document);
    if(isHutaoPrimaryDocument(document))return applyHutaoDamageContext(document,createHutaoExampleContext());
    if(isKazuhaBurstAction(document))return initializeKazuhaBurstDocument(document);
    if(isCynoDamageDocument(document))return applyCynoDamageContext(document,createCynoExampleContext());
    if(isGamingDamageAction(document)){document.gameContext!.gamingDamage={c2Included:false,a4Included:false,c6CritRateIncluded:false,c6CritDamageIncluded:false};return prepareGamingDamageDocument(document);}
    if(isTighnariDamageAction(document))return applyTighnariDamageContext(document,{priorA1Active:false,a1IncludedEm:0,c4IncludedEm:0,includedA4Bonus:0,includedC2Bonus:0,includedC1Crit:0,allHitsConnected:true,statsStableAcrossHits:true});
    if(isKukiDamageAction(document)){
      if(skillId === "kuki-skill-c2-complete-cast") document.gameContext!.constellation = 2;
      return applyKukiDamageContext(document,{ringUninterrupted:true,statsStableAcrossHits:true});
    }
    if(isColleiSkillAction(document))return applyColleiSkillContext(document,{});
    if(isCharlotteSkillAction(document))return applyCharlotteSkillContext(document,{a4IncludedInPanel:false});
    if(isBaizhuSkillAction(document))return applyBaizhuSkillContext(document,{a1IncludedInPanel:false});
    if(isNingguangScreenBurstAction(document))return applyNingguangBurstContext(document,{screenAvailable:true,currentA4Active:false,currentA4IncludedInBonus:false,screenA4Active:false,screenA4IncludedInBonus:false});
    if(isKeqingBurstAction(document))return applyKeqingBurstContext(document,{a4IncludedInPanel:false,statsStableAcrossHits:true});
    if(isXingqiuSkillAction(document))return applyXingqiuSkillContext(document,{a4IncludedInPanel:false,burstActiveAtCast:false,statsStableAcrossHits:true,c2ShredActive:false,c2ShredIncludedInResistance:false},workspace);
    if(isYanfeiChargedAction(document))return applyYanfeiChargedContext(document,{scarletSeals:0,onFieldAtMainHit:true,statsStableToA4:true,brilliance:{effectiveTalentLevel:talentLevel,mainActive:false,a4Active:false},mainEnemyHpFraction:1,a4EnemyHpFraction:1,priorA1BonusIncluded:0,includedBrillianceBonus:0});
    if(isIttoKesagiriAction(document))return applyIttoChargedContext(document, {
      superstrengthStacks: skillId === "aratakiitto-kesagiri-finisher" ? 1 : 2, c6PreserveStack: false,
      burst: { active: false, effectiveTalentLevel: talentLevel, accounting: "already-in-final-panel" },
      c4BuffActive: false, actionDefenseStable: true
    },workspace);
    return isNoelleContextAction(document) ? applyNoelleBurstContext(document, {
      active: skillId === "noelle-burst-cast", effectiveTalentLevel: talentLevel,
      accounting: "already-in-final-panel"
    },workspace) : document;
  }).map(document => stampCalculatorWorkspaceEvidence(document, workspace));
  if(workspace.channel!=="preview") {
    const base=documents[0];
    if(base) for(const component of optimizerSpecialComponents.filter(row=>base.gameContext?.abilityId.split(":")[1]===row.characterSlug)) {
      documents.push(stampCalculatorWorkspaceEvidence(createObservedSpecialComponentDocument(base,component.id),workspace));
    }
  }
  return extendKinichDocuments(extendXiaoDocuments(documents,workspace),workspace);
}
