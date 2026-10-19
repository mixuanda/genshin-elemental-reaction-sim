import { gameDataCatalog } from "@genshin-dps-lab/game-data/catalog";
import type { ClassifiedHitDataset } from "@genshin-dps-lab/game-data/classified-hits";
import { keqingBurstContextSchema, xingqiuSkillContextSchema, type CalculatorDocument, type KeqingBurstContextInput, type XingqiuSkillContext } from "../../../packages/sim-core/src/calculator-model";
import { createKeqingA4CritRateFormula, createKeqingC4AttackFormula, createKeqingC6DamageBonusFormula, createXingqiuA4DamageBonusFormula, createXingqiuC2ResistanceFormula, createXingqiuC4SkillBaseFormula, KEQING_BURST_SOURCE_REFS, XINGQIU_SKILL_SOURCE_REFS } from "../../../packages/sim-core/src/keqing-xingqiu-formulas";
import evidence from "../../../packages/game-data/src/character-mappings/keqing-xingqiu-source-manifest.json";
import { expr } from "../../../packages/sim-core/src/calculation-trace";

export const isKeqingBurstAction = (document: CalculatorDocument): boolean => document.gameContext?.skillId === "keqing-burst-complete-cast";
export const isXingqiuSkillAction = (document: CalculatorDocument): boolean => document.gameContext?.skillId === "xingqiu-skill-complete-cast";
const ascensionOf = (document: CalculatorDocument) => (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
export const KEQING_A4_ER_MODIFIER_ID = "keqing-q-a4-non-conversion-energy-recharge";

/** Fresh source equipment excludes these character states; imported totals do not disclose them. */
export function resetKeqingPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const context = document.gameContext?.keqingBurst;
  if (!context) return;
  context.hitStates ??= {};
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates[hit.id] ??= {};
    delete state.baseAttack;
    if (mode === "fresh-equipment") { state.c4IncludedInPanel = false; state.c6IncludedStacks = 0; }
    else { delete state.c4IncludedInPanel; delete state.c6IncludedStacks; }
  }
}

export function applyKeqingBurstContext(document: CalculatorDocument, supplied: KeqingBurstContextInput): CalculatorDocument {
  if (!isKeqingBurstAction(document)) return document;
  const context = keqingBurstContextSchema.parse(supplied), result = structuredClone(document), game = result.gameContext!;
  const prefix = "keqing-burst-context:", assumptionPrefix = "刻晴 Q 来源上下文：";
  game.keqingBurst = context;
  result.dependencies = result.dependencies.filter((dependency) => !dependency.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter((assumption) => !assumption.startsWith(assumptionPrefix));
  const ascension = ascensionOf(result), commonReasons: string[] = [];
  if (result.build.mode === "equipment-derived" && result.build.equipment) {
    const equipment = result.build.equipment;
    equipment.statModifiers = (equipment.statModifiers ?? []).filter((modifier) => modifier.id !== KEQING_A4_ER_MODIFIER_ID);
    if (ascension !== undefined && ascension >= 4) equipment.statModifiers.push({
      id: KEQING_A4_ER_MODIFIER_ID, label: "刻晴 Q 起手 A4：非转换充能 +15%", target: "energyRechargeBonus", phase: "pre-panel",
      expression: expr.input("keqingA4EnergyRecharge"), inputs: [{ key: "keqingA4EnergyRecharge", value: .15, unit: "ratio", meaningKey: "input.keqingA4EnergyRecharge", origin: "source-rule" }], sourceRefs: KEQING_BURST_SOURCE_REFS,
    });
  }
  if (ascension === undefined) commonReasons.push("必须明确突破阶段，才能确定 Q 起手 A4 的 15% 暴击率是否解锁。");
  if (ascension !== undefined && ascension < 4 && context.a4IncludedInPanel) commonReasons.push("A4 尚未解锁，不能声明面板已包含其 15% 暴击率。");
  if (!context.statsStableAcrossHits && result.scope === "one-cast" && result.selectedHitIds.length > 1) commonReasons.push("尚未声明基础面板及 C4/C6 以外的装备、目标状态稳定；不能将一个基础面板当作多次不同快照。单选一击可使用其实际面板。");
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter((dependency) => !dependency.startsWith(prefix));
    if (hit.kind !== "ordinary") continue;
    const state = context.hitStates[hit.id] ??= {}, reasons = [...commonReasons];
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...KEQING_BURST_SOURCE_REFS])];
    if (ascension !== undefined) hit.critRateFormula = createKeqingA4CritRateFormula(ascension, context.a4IncludedInPanel);
    if (hit.attackAdjustment?.formula.ruleId.startsWith("keqing-c4-")) delete hit.attackAdjustment;
    if (hit.damageBonusFormula?.ruleId.startsWith("keqing-c6-")) delete hit.damageBonusFormula;
    if (game.constellation >= 4) {
      if (result.build.mode === "equipment-derived") state.baseAttack = result.build.characterBaseAtk + result.build.weaponBaseAtk;
      if (state.c4Active === undefined || state.c4IncludedInPanel === undefined) reasons.push("本击 C4 的 25% ATK 有效状态或共享面板已含份额未知；必须逐击明确，不能从反应选择或最终 ATK 推断。");
      else if (state.c4Active !== state.c4IncludedInPanel && state.baseAttack === undefined) reasons.push("本击 C4 需要补加或移除 25% ATK，但缺少该面板的基础攻击（角色基础 + 武器基础）；不能从最终攻击力反推。");
      else hit.attackAdjustment = { accounting: "add-to-panel", formula: createKeqingC4AttackFormula({active: state.c4Active, included: state.c4IncludedInPanel, ...(state.baseAttack === undefined ? {} : {baseAttack: state.baseAttack}), ...(result.build.mode === "equipment-derived" ? {characterBaseAttack: result.build.characterBaseAtk, weaponBaseAttack: result.build.weaponBaseAtk} : {})}) };
    }
    if (game.constellation >= 6) {
      if (state.c6NormalActive === undefined || state.c6ChargedActive === undefined || state.c6SkillActive === undefined || state.c6IncludedStacks === undefined) reasons.push("本击 C6 的普攻/重击/初次战技类别有效状态或已填增伤中含有的层数未知；本次 Q 类由来源起手刷新，其余三类不能猜测。");
      else hit.damageBonusFormula = createKeqingC6DamageBonusFormula({normal: state.c6NormalActive, charged: state.c6ChargedActive, skill: state.c6SkillActive, includedStacks: state.c6IncludedStacks});
    }
    const id = `${prefix}${hit.id}`;
    hit.dependencies.push(id);
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击 A4、C4 攻击差值及 C6 类别增伤按其独立显式状态执行；不推断反应历史和状态寿命。", sourceRefs: KEQING_BURST_SOURCE_REFS });
  }
  result.assumptions.push(
    `${assumptionPrefix}完整为初击 + 八次连续斩击 + 尾击；固定源实际快照帧为 56、82、93、104、115、126、137、148、159、197。多击仅共用明确稳定的基础面板和其他未建模装备/目标状态，C4 与 C6 按每击单独输入，可以在中途变化。`,
    `${assumptionPrefix}已填共享暴击面板${context.a4IncludedInPanel ? "包含" : "不包含"} A4，公式只补未含份额；逐击显式最终暴击率覆盖来源公式，始终原样优先。该记账开关仅指暴击率。`,
    `${assumptionPrefix}A4 同时增加 15% 充能：来源装备模式将其作为固定非转换属性加入共享面板核心，绝缘等读取非转换充能的效果随之更新。装备充能输入不得重复填写该 15%；手动/导入最终面板使用已包含 A4 的实际最终充能。`,
    `${assumptionPrefix}C4 每击攻击差值 = 基础攻击 ×25%×（本击状态有效 − 共享输入面板已含）。来源装备使用角色与武器基础攻击之和；手动/导入需明确历史基础攻击，份额相等时差值为零而不需要反推。差值直接加入本击 ATK，不再乘攻击百分比；未知状态仅阻塞相关命中。`,
    `${assumptionPrefix}C6 四类为普攻、重击、初次 E、Q，各 6% 雷伤并按类别独立覆盖刷新。本 Q 起手同步刷新 burst 类 480 帧，十击在 56–197 帧内，因此本 Q 类始终计一次，不将先前 Q 再叠一次。其余三类必须逐击给出实际状态；减去本击已填增伤中包含的 0–4 类份额，允许补加或移除。`,
    `${assumptionPrefix}C0–C6 的所选 Q 本体条件伤害：C1 属于 E 重放，C2 属于普攻/重击产球；有效 Q 等级已包含 C3。C4 的反应触发先后、C6 其他类别失效、卡肉延长及反应资格不由本次条件输入自动模拟；不把所选反应直接当成该击快照前已有 C4。`,
  );
  return result;
}

export function applyXingqiuSkillContext(document: CalculatorDocument, supplied: XingqiuSkillContext, source?: ClassifiedHitDataset): CalculatorDocument {
  if (!isXingqiuSkillAction(document)) return document;
  const catalog = source === undefined ? gameDataCatalog : source.catalog;
  const context = xingqiuSkillContextSchema.parse(supplied), result = structuredClone(document), game = result.gameContext!;
  const prefix = "xingqiu-skill-context:", assumptionPrefix = "行秋 E 来源上下文：";
  game.xingqiuSkill = context;
  result.dependencies = result.dependencies.filter((dependency) => !dependency.id.startsWith(prefix));
  result.assumptions = result.assumptions.filter((assumption) => !assumption.startsWith(assumptionPrefix));
  const ascension = ascensionOf(result), reasons: string[] = [];
  if (ascension === undefined) reasons.push("必须明确突破阶段，才能确定永久 A4 的 20% 水伤是否解锁。");
  if (ascension !== undefined && ascension < 4 && context.a4IncludedInPanel) reasons.push("A4 尚未解锁，不能声明已填增伤包含其 20% 水伤。");
  if (!context.statsStableAcrossHits) reasons.push("E 两段在各自命中任务取快照；尚未提供两套独立面板，且未声明共享面板、装备及目标状态稳定。");
  if (game.constellation < 2 && (context.c2ShredActive || context.c2ShredIncludedInResistance)) reasons.push("C2 尚未解锁，不能声明目标已有本角色 C2 水减抗或敌人抗性已包含它。");
  const coefficients = evidence.coefficients.filter((row) => row.characterSlug === "xingqiu");
  const parameters = catalog.talentSets.find((talentSet) => talentSet.id === "talent-set:xingqiu")?.abilities.find((ability) => ability.key === "combat2")?.parameters;
  const resolved = coefficients.map((row) => {
    const values = parameters?.[row.parameterKey];
    return values?.length === row.values.length && values.every((value, index) => value === row.values[index]) ? values[game.effectiveTalentLevel - 1] : undefined;
  });
  if (resolved.some((value) => value === undefined)) reasons.push("行秋 E 完整 T1–15 向量与固定来源不符或所选等级缺失，不能补造倍率。");
  const id = `${prefix}conditions`;
  result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "E 两段采用来源倍率、A4 记账、C4 起手 Q 状态与显式既有 C2 减抗；不推断其时间线。", sourceRefs: XINGQIU_SKILL_SOURCE_REFS });
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter((dependency) => !dependency.startsWith(prefix)); hit.dependencies.push(id);
    if (hit.kind !== "ordinary") continue;
    hit.sourceRefs = [...new Set([...hit.sourceRefs, ...XINGQIU_SKILL_SOURCE_REFS])];
    const index = hit.id === "xingqiu-skill-complete-cast-first" ? 0 : 1;
    if (resolved[index] !== undefined) hit.baseDamageFormula = createXingqiuC4SkillBaseFormula(resolved[index]!, game.constellation, context.burstActiveAtCast);
    if (ascension !== undefined) hit.damageBonusFormula = createXingqiuA4DamageBonusFormula(ascension, context.a4IncludedInPanel);
    hit.resistanceReductionFormula = createXingqiuC2ResistanceFormula(context.c2ShredActive, context.c2ShredIncludedInResistance);
  }
  result.assumptions.push(
    `${assumptionPrefix}E 两段均实际命中同一目标；固定源在 12/31 帧各自快照，当前明确假定面板、装备与目标状态保持稳定，逐击蒸发等反应仍独立输入。`,
    `${assumptionPrefix}突破 4 解锁永久 20% 水伤；已填每段增伤${context.a4IncludedInPanel ? "包含" : "不包含"}该份额，来源公式只补一次。装备推导本身不自动包含角色战斗被动，重新应用全新装备时应切为未含；真实导入最终水伤通常已经包含 A4，必须按实际面板记账。`,
    `${assumptionPrefix}C4+ 在 E 起手构造两段攻击信息时读取 Q ${context.burstActiveAtCast ? "有效" : "无效"}；有效时每段天赋倍率 ×1.5，先形成 ATK 缩放基数，不把 50% 放进增伤区，也不放大独立附加基础伤害。`,
    `${assumptionPrefix}C2 仅由 Q 剑雨命中施加，E 本身不产生它；此目标已有状态${context.c2ShredActive ? "有效" : "无效"}，敌人抗性输入${context.c2ShredIncludedInResistance ? "已经含有" : "尚未含有"} 15% 水减抗。来源只补差额，逐击最终抗性覆盖始终优先；不推断剑雨是否打到目标或四秒有效期。`,
    `${assumptionPrefix}C0–C6 的本次 E 自身两段：C1 改雨帘剑数量，C2/C6 改 Q 时长/波次/回能，C3/C5 由显式有效天赋等级处理。其余 Q 剑雨、治疗、挂水与能量不归属于本动作总伤。`,
  );
  return result;
}
