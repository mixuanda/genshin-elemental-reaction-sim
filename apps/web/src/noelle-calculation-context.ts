import { resolveClassifiedCharacterHits, type ClassifiedHitDataset } from "@genshin-dps-lab/game-data/classified-hits";
import { noelleBurstContextSchema, type CalculatorDocument, type NoelleBurstContext } from "../../../packages/sim-core/src/calculator-model";
import { createNoelleBurstAttackFormula, createNoelleC2ChargedBonusFormula, NOELLE_BURST_SOURCE_REFS } from "../../../packages/sim-core/src/noelle-formulas";

const prefix = "noelle-burst-context:";
const assumptionPrefix = "诺艾尔来源上下文：";
export function isNoelleContextAction(document: CalculatorDocument): boolean {
  const id = document.gameContext?.skillId ?? "";
  return /^noelle-(normal-[1-4]|charged-(cycle|finisher)|plunge-(collision|low|high)|burst-cast)$/.test(id);
}

/** Explicit history only: no current DEF sampling, buff duration guess or action-talent coupling. */
export function applyNoelleBurstContext(document: CalculatorDocument, supplied: NoelleBurstContext, source?: ClassifiedHitDataset): CalculatorDocument {
  if (!isNoelleContextAction(document)) return document;
  const context = noelleBurstContextSchema.parse(supplied);
  const result = structuredClone(document), game = result.gameContext!;
  const cast = game.skillId === "noelle-burst-cast";
  game.noelleBurst = context;
  game.variantName = cast ? "大扫除·起手两段" : context.active ? "Q 激活·岩附魔" : "Q 未激活·无附魔";
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter(assumption => !assumption.startsWith(assumptionPrefix)
    && !assumption.startsWith("C0、Q大扫除未激活")
    && !assumption.startsWith("Q的DEF转ATK、不可覆盖岩附魔")
    && !assumption.startsWith("C0；本次Q输入")
    && !assumption.includes("C6转换额外0.5及持续延长不属于此C0映射"));
  const resolved = context.active || cast ? resolveClassifiedCharacterHits(game.characterId, context.effectiveTalentLevel, source) : undefined;
  const qHits = resolved?.hits.filter(hit => hit.skillId === "noelle-burst-cast") ?? [];
  const coefficient = qHits[0]?.formulaInputs.find(input => input.key === "noelleBurstDefConversion");
  const reasons: string[] = [];
  if (cast && !context.active) reasons.push("所选动作是 Q 起手两段，不能以 Q 未激活上下文计算；请明确启用本次大扫除状态。");
  if (context.active && !coefficient) reasons.push(...(resolved?.blockers.filter(hit => hit.skillId === "noelle-burst-cast").flatMap(hit => hit.reasons) ?? []), "缺少独立有效 Q 等级对应的已核对防御转换系数。");
  if (context.active && context.accounting === "add-to-panel" && context.defenseSnapshotNonExtra === undefined) reasons.push("Q 转换尚未计入攻击面板：必须明确输入建立该转换时的历史非 Extra 防御快照，不能自动使用当前最终 DEF。");
  const dependencyId = `${prefix}${game.skillId}`;
  result.dependencies.push({ id: dependencyId, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || `仅执行固定来源的条件数值：历史非 Extra DEF 转固定 ATK${coefficient ? `；实际来源字段 ${coefficient.coefficientField} = ${coefficient.value}` : "；当前 Q 未激活，不读取转换参数"}。精确起手快照时刻和持续时间仍有源 TODO，不宣称当前实战时序已核验。`, sourceRefs: [...NOELLE_BURST_SOURCE_REFS] });
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(prefix));
    hit.dependencies.push(dependencyId);
    if (hit.kind !== "ordinary") continue;
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...NOELLE_BURST_SOURCE_REFS])];
    if (cast) {
      const source = qHits.find(candidate => candidate.id === hit.id);
      if (source) {
        hit.terms = source.terms.map(({ stat, coefficient }) => ({ stat, coefficient }));
        hit.dependencies = hit.dependencies.filter(id => !id.startsWith("talent-set:noelle.combat3."));
        for (const term of [...source.terms, ...source.formulaInputs]) {
          const id = `${prefix}${term.coefficientField}`;
          hit.dependencies.push(id);
          if (!result.dependencies.some(dependency => dependency.id === id)) result.dependencies.push({ id, status: "provisional", reason: `实际有效 Q 等级 ${context.effectiveTalentLevel} 的已核对来源字段：${term.coefficientField}；固定来源完整向量一致。`, sourceRefs: source.sourceRefs });
        }
      }
      hit.element = "geo";
    } else {
      hit.element = context.active ? "geo" : "physical";
    }
    if (context.active && coefficient) {
      hit.attackAdjustment = {
        accounting: context.accounting,
        formula: createNoelleBurstAttackFormula({ active: context.active, effectiveTalentLevel: context.effectiveTalentLevel, conversionCoefficient: coefficient.value, constellation: game.constellation, ...(context.defenseSnapshotNonExtra === undefined ? {} : { defenseSnapshotNonExtra: context.defenseSnapshotNonExtra }) }),
      };
    } else if (hit.attackAdjustment?.formula.ruleId.startsWith("noelle-burst-")) delete hit.attackAdjustment;
    if (hit.attackTag === "charged" && game.constellation >= 2) hit.damageBonusFormula = createNoelleC2ChargedBonusFormula();
    else if (hit.damageBonusFormula?.ruleId.startsWith("noelle-c2-")) delete hit.damageBonusFormula;
  }
  if (cast) game.effectiveTalentLevel = context.effectiveTalentLevel;
  result.assumptions.push(
    `${assumptionPrefix}Q ${context.active ? "激活" : "未激活"}；独立有效 Q 等级 ${context.effectiveTalentLevel}，不再增加 C5 的天赋等级。普通/重击/下落自身天赋与 Q 等级独立。`,
    `${assumptionPrefix}${context.accounting === "already-in-final-panel" ? "当前攻击力已包含适用的 Q 转换，不反推历史防御或重复追加。" : "当前构筑攻击力不含 Q 转换；本段另加历史非 Extra 防御 ×（Q 系数 + C6 系数），不再乘攻击力百分比。"}`,
    `${assumptionPrefix}仅 DEF→ATK 的输入锁为历史非 Extra 防御；其他命中属性仍使用本段当前输入。源实现排除 Extra DEF，不把当前最终 DEF 自动当作历史快照。`,
    `${assumptionPrefix}C2 只给旋转/终结重击增伤 15%；C6 转换另加 50%。C4 护盾爆炸、治疗、合法空中资格、状态续期及完整轮转不由这些命中推断。`,
    `${assumptionPrefix}Q 两段均为爆发标签；+24/+65 是可受卡肉影响的固定源任务时间，DEF 转换立即起效及 980 帧持续仍有源 TODO。本功能为来源条件数值，未验证当前版本实战时序。`,
  );
  return result;
}
