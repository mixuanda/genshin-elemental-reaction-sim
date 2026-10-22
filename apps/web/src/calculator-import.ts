import {resetTighnariPanelAccounting} from './tighnari-calculation-context';
import { resetSourceCastPanelAccounting } from "../../../packages/sim-core/src/source-cast-context";
import type { CatalogResolvedShowcaseCharacter } from "@genshin-dps-lab/schemas";
import type { CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { restoreCalculatorHitEquipmentInputs, prepareIncomingThrillingTales, resetIncomingThrillingTalesPanelAccounting } from "@genshin-dps-lab/sim-core";
import { resetCharlottePanelAccounting } from "./collei-charlotte-calculation-context";
import { resetBaizhuPanelAccounting } from "./baizhu-calculation-context";
import { applyCharacterConstellationScope, resetKeqingPanelAccounting, resetKukiPanelAccounting } from "./character-calculations";
import { hasKnownImportedTalent, requireImportedTalentLevel } from "./imported-talents";

export function requireImportedNumber(value: number | null | undefined, field: string): number {
  if (value === null || value === undefined || !Number.isFinite(value)) throw new Error(`导入缺少 ${field}；请补齐原始数据或重新导入，不能以 0 / 默认等级代替。`);
  return value;
}

/** Final showcase stats are already aggregated. No equipment contribution is added here. */
export function applyImportedCalculatorPanel(
  document: CalculatorDocument,
  character: CatalogResolvedShowcaseCharacter,
  source: string,
  talentPolicy: "imported-effective" | "manual-effective" = "imported-effective"
): CalculatorDocument {
  const doc = structuredClone(document);
  const context = doc.gameContext;
  if (!context || character.catalog.characterId !== context.characterId) throw new Error("导入角色身份与当前真实命中定义不一致，不能借用其他角色天赋。");
  if (!Number.isInteger(character.constellation) || character.constellation < 0 || character.constellation > 6) throw new Error("导入命座缺失或非法；不会假定为 C0。");
  if (character.ascension !== undefined && character.ascension !== null && (!Number.isInteger(character.ascension) || character.ascension < 0 || character.ascension > 6)) throw new Error("导入突破阶段非法；不会依据等级猜测。");
  if (talentPolicy === "imported-effective") {
    if (requireImportedTalentLevel(character, context.abilityId) !== context.effectiveTalentLevel) throw new Error("当前动作未匹配导入的有效天赋等级；不会再次加算命座天赋等级或使用默认值。");
  }
  const required: Array<[string, number | null | undefined]> = [
    ["角色等级", character.level], ["攻击力（2001）", character.stats.attack],
    ["生命值（2000）", character.stats.maxHp], ["防御力（2002）", character.stats.defense],
    ["元素精通（28）", character.stats.elementalMastery], ["暴击率（20）", character.stats.critRate],
    ["暴击伤害（22）", character.stats.critDamage],
    ...doc.hits.filter(h => h.kind === "ordinary").map(h => [`${h.element} 伤害加成`, character.stats.damageBonuses[h.element]] as [string, number | null | undefined]),
  ];
  const missing = [...new Set(required.filter(([, value]) => value === null || value === undefined || !Number.isFinite(value)).map(([name]) => name))];
  if (missing.length) throw new Error(`导入缺少：${missing.join("、")}。原始未知状态已保留；请补齐数据后重新导入，不以 0 或等级 1 代替。`);
  doc.characterLevel = requireImportedNumber(character.level, "角色等级 propMap[4001] / 展柜等级");
  context.constellation = character.constellation;
  if (character.ascension === undefined || character.ascension === null) delete context.ascension;
  else context.ascension = character.ascension;
  doc.build = {
    mode: "imported-final", source,
    ...(character.ascension === undefined || character.ascension === null ? {} : { ascension: character.ascension }),
    stats: { atk: requireImportedNumber(character.stats.attack, "attack"), hp: requireImportedNumber(character.stats.maxHp, "maxHp"), def: requireImportedNumber(character.stats.defense, "defense"), em: requireImportedNumber(character.stats.elementalMastery, "elementalMastery"), critRate: requireImportedNumber(character.stats.critRate, "critRate"), critDamage: requireImportedNumber(character.stats.critDamage, "critDamage"), ...(character.stats.energyRecharge === null ? {} : { energyRecharge: character.stats.energyRecharge }) },
  };
  if (context.xiaoDamage && talentPolicy === "imported-effective") {
    const burst = character.resolvedSkills.find(skill => skill.abilityId === "talent:xiao:combat3");
    if (burst && hasKnownImportedTalent(burst)) context.xiaoDamage.burstTalentLevel = burst.effectiveLevel;
    else delete context.xiaoDamage.burstTalentLevel;
  }
  if (context.noelleBurst) {
    context.noelleBurst.accounting = "already-in-final-panel";
    const burst = character.resolvedSkills.find(skill => skill.abilityId === "talent:noelle:combat3");
    if (talentPolicy === "imported-effective") {
      if (burst && hasKnownImportedTalent(burst)) context.noelleBurst.effectiveTalentLevel = burst.effectiveLevel;
      else if (context.noelleBurst.active) requireImportedTalentLevel(character, "talent:noelle:combat3");
    }
  }
  if (context.ittoCharged) {
    context.ittoCharged.burst.accounting = "already-in-final-panel";
    const burst = character.resolvedSkills.find(skill => skill.abilityId === "talent:aratakiitto:combat3");
    if (talentPolicy === "imported-effective") {
      if (burst && hasKnownImportedTalent(burst)) context.ittoCharged.burst.effectiveTalentLevel = burst.effectiveLevel;
      else if (context.ittoCharged.burst.active) requireImportedTalentLevel(character, "talent:aratakiitto:combat3");
    }
  }
  if (context.yanfeiCharged) {
    context.yanfeiCharged.priorA1BonusIncluded = 0;
    context.yanfeiCharged.includedBrillianceBonus = 0;
    const burst = character.resolvedSkills.find(skill => skill.abilityId === "talent:yanfei:combat3");
    if (talentPolicy === "imported-effective") {
      if (burst && hasKnownImportedTalent(burst)) context.yanfeiCharged.brilliance.effectiveTalentLevel = burst.effectiveLevel;
      else if (context.yanfeiCharged.brilliance.mainActive || context.yanfeiCharged.brilliance.a4Active) requireImportedTalentLevel(character, "talent:yanfei:combat3");
    }
  }
  if (context.ningguangBurst) context.ningguangBurst.currentA4IncludedInBonus = context.ningguangBurst.currentA4Active;
  if (context.keqingBurst) context.keqingBurst.a4IncludedInPanel = true;
  resetKeqingPanelAccounting(doc, "imported-final");
  resetKukiPanelAccounting(doc, "imported-final");
  resetTighnariPanelAccounting(doc, "imported-final");
  resetBaizhuPanelAccounting(doc, "imported-final");
  resetCharlottePanelAccounting(doc, "imported-final");
  resetSourceCastPanelAccounting(doc, "imported-final");
  resetIncomingThrillingTalesPanelAccounting(doc, "imported-final");
  if (context.xingqiuSkill) context.xingqiuSkill.a4IncludedInPanel = character.ascension !== undefined && character.ascension !== null && character.ascension >= 4;
  doc.hits = doc.hits.map(original => {
    if (original.kind !== "ordinary") return original;
    const hit = restoreCalculatorHitEquipmentInputs(original);
    hit.damageBonus = requireImportedNumber(character.stats.damageBonuses[hit.element], `${hit.element} 伤害加成`);
    if (hit.elementalMasteryAdjustment) hit.elementalMasteryAdjustment.accounting = "already-in-final-panel";
    if (hit.attackAdjustment) hit.attackAdjustment.accounting = "already-in-final-panel";
    return hit;
  });
  doc.assumptions = [
    "公开展柜不是战斗状态快照：条件增益、附着与历史快照不能自动还原。本次仅计算明确给定条件；未提供条件不代表已验证实战。",
    ...doc.assumptions.filter(assumption => assumption !== "C0 条件；有效天赋等级显式输入，不自动增加命座等级。"),
    `使用公开展示柜的 C${character.constellation} 和最终面板，装备词条不再次加算。命座和突破相关公式按每个所选命中的依赖判断。`,
    "来源精通状态可保留为明确条件审计，但展示柜最终精通已是入口数值；重新导入时设为已计入面板，不继承旧草稿的额外加算策略。",
    "旧配装已固化的命中基数附加和限定暴击不会随新展示柜面板继续使用；新面板之外的条件条款须重新明确提供。",
    ...(context.noelleBurst ? ["诺艾尔 Q 条件作为明确的命中假设保留；导入攻击力视为已含适用转换，不从当前防御补造旧快照。若公开面板实际未含 Q，请明确改为追加并提供历史非 Extra 防御。"] : []),
    ...(context.ittoCharged ? ["一斗乱神之怪力、Q及C4条件作为明确命中假设保留；导入攻击力视为已含适用Q转换，不从当前防御补造历史快照。若面板未含Q，请选择追加并填写建立Q转换时的非Extra防御。突破四另用明确的重击起手总防御或用户声明的稳定面板；C6限定重击暴伤不属于普通展示柜暴伤面板。"] : []),
    ...(context.yanfeiCharged ? ["烟绯印数、灼灼及目标生命是保留的明确命中假设，不能从展示柜推断；新导入默认未含旧A1或灼灼。若展示柜增伤确实已包含其中效果，请明确填写已含量以避免重复加入。Q有效等级独立映射，A4仍需声明两次快照间共享面板稳定。"] : []),
    ...(doc.incomingThrillingTales ? ["外部讨龙来源和逐击实际生效是保留的用户条件；新展示柜不能证明当前面板已含精炼份额或当前白值，已清除当前面板旧记账与白值；既有历史快照及其逐击已含份额/白值仍独立保留。"] : []),
    ...(context.colleiSkill ? ["展示柜只替换E释放面板，既有回收时新叶快照保持独立，不由新导入补造。反应时实际精通与面板一致的条件仍需用户按命中上下文确认。"] : []),
    ...(context.charlotteSkill ? ["展示柜不能推断实际地区队友或标记持续条件。已解锁A4默认包含在导入最终冰伤中，未含时须明确更正；未知队友人数仍需填写。C2面板已含层数和基础攻击需另行确认，不沿用旧配装；逐击实际层数仍是用户明确条件。"] : []),
    ...(context.ningguangBurst ? ["展示柜只替换当前Q面板；已提供的E历史快照保持独立且不由这次导入补造。当前A4若声明有效，导入增伤默认已含，可明确更正；历史A4记账不变。"] : []),
    ...(context.kukiDamage ? ["久岐忍的环持续、Q起手生命与C6状态是明确计算条件；展示柜不能证明临时精通是否已含，新导入将C6记账清为未知。可明确恢复本击实际最终精通后计算，不从现有面板反推触发历史。"] : []),
    ...(context.keqingBurst ? ["刻晴Q的A4暴击与充能视为已含在导入最终面板中；这是一项明确计算假设，不由展示柜证明当时Q状态。若暴击率未含A4，请修改记账；最终充能须另明确恢复适用A4后的值。"] : []),
    ...(context.xingqiuSkill ? ["行秋已解锁的永久A4水伤视为包含在导入最终增伤内；Q起手状态和目标已有C2减抗仍为明确输入，不从展示柜推断。"] : []),
    talentPolicy === "imported-effective" ? "本动作使用导入映射的有效天赋等级；该值已包含导入提供的额外等级，不再次加算命座等级。" : "当前面板来自展示柜；有效天赋等级已由用户明确改为手动来源选择。",
    character.ascension === undefined || character.ascension === null ? "展示柜没有可用的角色突破属性值；突破阶段保持未知，只阻塞依赖它的命中。" : `角色突破 ${character.ascension} 来自展示柜 propMap[1002].val，不从等级或最终面板推断。`,
  ];
  doc.dataIdentity.evidenceStatus = "provisional";
  return prepareIncomingThrillingTales(applyCharacterConstellationScope(doc));
}
