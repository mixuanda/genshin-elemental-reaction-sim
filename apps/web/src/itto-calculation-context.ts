import { gameDataCatalog } from "@genshin-dps-lab/game-data/catalog";
import type { ClassifiedHitDataset } from "@genshin-dps-lab/game-data/classified-hits";
import evidence from "../../../packages/game-data/src/character-mappings/itto-kesagiri-source-manifest.json";
import { ittoChargedContextSchema, type CalculatorDocument, type IttoChargedContext } from "../../../packages/sim-core/src/calculator-model";
import { createIttoA4AdditiveFormula, createIttoBurstAttackFormula, createIttoC6CritDamageFormula, ITTO_KESAGIRI_SOURCE_REFS } from "../../../packages/sim-core/src/itto-formulas";

const prefix = "itto-kesagiri-context:";
const assumptionPrefix = "一斗逆袈裟来源上下文：";
export function isIttoKesagiriAction(document: CalculatorDocument): boolean {
  return ["aratakiitto-kesagiri-combo", "aratakiitto-kesagiri-finisher"].includes(document.gameContext?.skillId ?? "");
}

/** Exactly one chosen ChargeAttack. Resource history, C6 draws and Q durations are supplied, not simulated. */
export function applyIttoChargedContext(document: CalculatorDocument, supplied: IttoChargedContext, source?: ClassifiedHitDataset): CalculatorDocument {
  if (!isIttoKesagiriAction(document)) return document;
  const catalog = source === undefined ? gameDataCatalog : source.catalog;
  const context = ittoChargedContextSchema.parse(supplied);
  const result = structuredClone(document), game = result.gameContext!, constellation = game.constellation;
  game.ittoCharged = context;
  game.variantName = context.burst.active ? "荒泷逆袈裟 · Q 岩附魔" : "荒泷逆袈裟 · Q 未激活";
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter(assumption => !assumption.startsWith(assumptionPrefix));
  const reasons: string[] = [];
  const finisher = game.skillId === "aratakiitto-kesagiri-finisher";
  if (context.c6PreserveStack && constellation < 6) reasons.push("C6 以下不能声明本次 C6 不耗层判定成功。");
  if (finisher && (context.superstrengthStacks !== 1 || context.c6PreserveStack)) reasons.push("所选终结斩要求本次动作前恰好 1 层怪力、且本次不处于 C6 保层判定；不能用连斩条件计算终结斩。");
  if (!finisher && context.superstrengthStacks === 1 && !context.c6PreserveStack) reasons.push("只有 1 层且未发生 C6 保层时，固定来源选择终结斩，不能作为连斩。");
  if (context.c4BuffActive && constellation < 4) reasons.push("当前命座未解锁自身 C4，不能声明自身 C4 攻防增益生效。");
  if (context.c4BuffActive && result.build.mode === "equipment-derived") reasons.push("一斗 C4 当前有效，但本构筑尚未执行其 20% ATK/DEF 属性增益；请提供已恢复该增益的手动或导入最终面板，不能把未含 C4 的装备推导结果当作完整面板。");
  const ascension = (result.build.mode === "equipment-derived" ? result.build.equipment?.ascension : result.build.ascension) ?? game.ascension;
  if (ascension !== undefined && ascension >= 4 && context.actionDefenseSnapshotTotal === undefined && !context.actionDefenseStable) reasons.push("A4 已解锁：缺少本次重击动作起手完整 DEF 快照，且未声明 DEF 从起手至命中保持面板值；不能拿 Q 的非 Extra 旧快照替代。");

  const qSource = evidence.coefficients.defconv;
  const qValues = catalog.talentSets.find(talentSet => talentSet.id === "talent-set:aratakiitto")?.abilities.find(ability => ability.key === qSource.abilityKey)?.parameters[qSource.parameterKey];
  const qMatches = qValues !== undefined && qSource.values.every((value, index) => qValues[index] === value);
  const qCoefficient = qMatches ? qValues?.[context.burst.effectiveTalentLevel - 1] : undefined;
  if (context.burst.active && qCoefficient === undefined) reasons.push("独立有效 Q 等级的 DEF 转 ATK 参数缺失或与固定来源完整向量不符，不能猜测转换倍率。");
  if (context.burst.active && context.burst.accounting === "add-to-panel" && context.burst.defenseSnapshotNonExtra === undefined) reasons.push("Q 转换尚未计入：缺少建立该 Q 转换时的历史非 Extra DEF；当前完整 DEF 与 A4 动作快照不能替代它。");
  const dependencyId = `${prefix}${game.skillId}`;
  result.dependencies.push({ id: dependencyId, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "所选单次连斩/终结分支的怪力与 C6 判定已明确；只执行固定来源条件数值，不重建整个重击持有、随机资源或 Q 状态时间线。", sourceRefs: [...ITTO_KESAGIRI_SOURCE_REFS] });
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    hit.dependencies.push(dependencyId);
    if (hit.kind !== "ordinary") continue;
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...ITTO_KESAGIRI_SOURCE_REFS])];
    hit.element = context.burst.active ? "geo" : "physical";
    hit.additiveBaseFormula = createIttoA4AdditiveFormula({ actionDefenseStable: context.actionDefenseStable, ...(context.actionDefenseSnapshotTotal === undefined ? {} : { actionDefenseSnapshotTotal: context.actionDefenseSnapshotTotal }) });
    if (context.burst.active && qCoefficient !== undefined) {
      hit.attackAdjustment = {
        accounting: context.burst.accounting,
        formula: createIttoBurstAttackFormula({ conversionCoefficient: qCoefficient, effectiveTalentLevel: context.burst.effectiveTalentLevel, ...(context.burst.defenseSnapshotNonExtra === undefined ? {} : { defenseSnapshotNonExtra: context.burst.defenseSnapshotNonExtra }) }),
      };
    } else if (hit.attackAdjustment?.formula.ruleId.startsWith("itto-burst-")) delete hit.attackAdjustment;
    if (constellation === 6) hit.critDamageFormula = createIttoC6CritDamageFormula();
    else if (hit.critDamageFormula?.ruleId.startsWith("itto-c6-")) delete hit.critDamageFormula;
  }
  result.assumptions.push(
    `${assumptionPrefix}本动作只产生一个${finisher ? "终结斩" : "连斩"}伤害实例。左右连斩共用倍率，不等于一次输入必定两次命中；本结果不是完整持有重击连段。动作前怪力 ${context.superstrengthStacks} 层，本次 C6 保层判定${context.c6PreserveStack ? "成功" : "未生效"}。`,
    `${assumptionPrefix}A4 起手 TotalDef(false) 包含 Extra DEF；${context.actionDefenseSnapshotTotal !== undefined ? `使用独立快照 ${context.actionDefenseSnapshotTotal}` : context.actionDefenseStable ? "明确假定起手至命中 DEF 等于所填当前面板" : "未声明稳定面板；A4 解锁后必须提供独立快照"}。这笔 35% DEF 属于附加伤害基数，不是 ATK 或伤害加成。`,
    `${assumptionPrefix}Q ${context.burst.active ? "有效、伤害转为岩元素" : "未激活、所选本体为物理伤害"}；有效 Q 天赋 ${context.burst.effectiveTalentLevel} 与重击天赋独立，C5 不再次加 3。Q 转换${context.burst.accounting === "add-to-panel" ? "尚未计入 ATK，另用历史非 Extra DEF 快照追加" : "已含于 ATK 面板，不反推或重加历史转换"}。`,
    `${assumptionPrefix}C4 ${context.c4BuffActive ? "当前有效：手动/导入 ATK 与 DEF 必须已含该 20% 攻防提升；历史 Q 快照是否受它影响也由所给旧数值明确包含" : "当前未生效，不自动给予 20% 攻防"}。C6 只给本段重击暴伤加 70%；若已提供本段最终暴伤则不再加，不耗层 50% 概率不作为伤害倍率。`,
    `${assumptionPrefix}固定源假定重击起手 snapshot，命中时点尚未随攻速修正；Q 起效时点、795 帧持续及 C1/C2 延时仍有 TODO/实现假设。这里不模拟攻速、完整连段数、阿丑产层、能量或随机判定。`,
  );
  return result;
}
