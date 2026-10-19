import {
  batchPeriodicCastContextSchema,
  type BatchPeriodicCastContext,
  type CalculatorDocument,
  type CalculatorFormula,
  type CalculatorHit,
} from "./calculator-model";
import { expr } from "./calculation-trace";

const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const dependencyPrefix = "batch-periodic-context:";
const formulaPrefix = "batch-periodic-formula:";
const assumptionPrefix = "完整持续动作来源上下文：";
const actions: Record<string, { character: string; files: string[]; explanation: string }> = {
  "rosaria-burst-six-hits-complete-c0": {
    character: "rosaria", files: ["burst.go", "asc.go", "cons.go", "rosaria.go"],
    explanation: "罗莎莉亚 Q 为两次初击和四次持续伤害；初击与冰枪落地取样时点不同。E 的 A1 暴击率必须反映在各次实际取样面板中；Q 的 A4 不给罗莎莉亚本人暴击率。",
  },
  "qiqi-skill-ten-hits-complete-c0": {
    character: "qiqi", files: ["skill.go", "asc.go", "cons.go", "qiqi.go"],
    explanation: "七七 E 仅在明确启示未激活时，以一次初击和九次持续命中组成完整自身伤害；固定 Optimizer 另有启示协同伤害，本分支不认证该机制，也不据此判定其 released 或 preview 状态。基础单选初击或持续命中的普通倍率不依赖未选协同伤害。治疗与护符不计为额外伤害；固定源码明确将持续伤害帧数视作近似，本结果不认证精确时序。",
  },
  "kaeya-burst-front-thirteen-hits-complete-c0": {
    character: "kaeya", files: ["burst.go", "skill.go", "cons.go", "kaeya.go"],
    explanation: "凯亚 Q 按固定源码的正面接触模型合计十三击；并非游戏中移动、碰撞条件下可达到的十四或十五击最大值。A1 治疗和 A4 产球不增加本次 Q 自身伤害。",
  },
  "kokomi-skill-seven-ticks-no-burst-complete-c0": {
    character: "kokomi", files: ["skill.go", "burst.go", "asc.go", "cons.go", "kokomi.go"],
    explanation: "心海 E 在释放时保存进攻快照，基础七次伤害对应 24、150、270、390、510、630、750 帧。本分支全程没有 Q 增幅、Q 刷新或新 E 替换；A4 不增加 E 伤害。固有天赋减一百个百分点暴击率，不等于强制永不暴击。",
  },
  "venti-burst-twenty-anemo-no-absorption-complete-c0": {
    character: "venti", files: ["burst.go", "asc.go", "cons.go", "venti.go"],
    explanation: "温迪 Q 仅在明确魔导相关被动未激活、且没有元素吸收的条件下，以二十次风伤组成完整自身伤害；不省略已激活魔导被动的 Q 倍率或全伤效果，不把它们伪装成普通增伤。本分支不把吸收伤害或独立扩散伤害遗漏后仍称作同一总额，A4 回能不算伤害。",
  },
  "shenhe-burst-thirteen-hits-fresh-complete-c0": {
    character: "shenhe", files: ["burst.go", "skill.go", "cons.go", "shenhe.go", "zz_shenhe.dm.go"],
    explanation: "申鹤全新 Q 的十二次持续伤害在第 47 帧、本次 A1 生效前保存快照；第 78 帧初击可包含 A1 的 15% 冰伤。无旧 Q、无 E 冰翎或 A4，施法者至初击留圈且目标全程留圈；十三击均使用本级 Q 减抗。",
  },
  "escoffier-skill-twenty-three-hits-arkhe-complete-c0": {
    character: "escoffier", files: ["skill.go", "asc.go", "cons.go", "escoffier.go"],
    explanation: "爱可菲 E 合计初击、一次可用芒性伤害和二十一次冷冻芭菲；各弹重新取样，初击结算后才施加 A4。芒性附着量为零，不允许增幅或激化反应；固定源码的芒荒处理与芒性快照时点仍标 TODO，不据此宣称这些机制已验证。A1 只提供 Q 后治疗。",
  },
};

function sourceRefs(character: string, files: string[]): string[] {
  return [
    ...files.map(file => `${sourceRoot}/internal/characters/${character}/${file}`),
    `${sourceRoot}/pkg/core/attack.go`, `${sourceRoot}/pkg/enemy/attack.go`,
    ...(character === "venti" ? ["https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Venti/index.tsx"] : []),
    ...(character === "qiqi" ? ["https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Qiqi/index.tsx"] : []),
  ];
}

export const BATCH_PERIODIC_CAST_SOURCE_REFS = [...new Set(Object.values(actions).flatMap(action => sourceRefs(action.character, action.files)))];
export const isBatchPeriodicCastAction = (document: CalculatorDocument): boolean => !!actions[document.gameContext?.skillId ?? ""];
const ascensionOf = (document: CalculatorDocument) =>
  (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;

function contextInput(key: string, value: number, meaningKey: string, unit = "ratio"): CalculatorFormula["inputs"][number] {
  return { key, value, unit, meaningKey, origin: "derived-character-context" };
}
function booleanInput(key: string, value: boolean, meaningKey: string): CalculatorFormula["inputs"][number] {
  return { ...contextInput(key, Number(value), meaningKey, "boolean"), allowedValues: [0, 1] };
}

function clearOwnedFormulas(hit: OrdinaryHit): void {
  const fields = ["baseDamageFormula", "additiveBaseFormula", "damageBonusFormula", "resistanceReductionFormula", "critRateFormula", "critDamageFormula", "incomingThrillingTalesFormula"] as const;
  for (const field of fields) if (hit[field]?.ruleId.startsWith(formulaPrefix)) delete hit[field];
  if (hit.attackAdjustment?.formula.ruleId.startsWith(formulaPrefix)) delete hit.attackAdjustment;
  if (hit.elementalMasteryAdjustment?.formula.ruleId.startsWith(formulaPrefix)) delete hit.elementalMasteryAdjustment;
}

function kokomiCriticalFormula(included: boolean, refs: string[]): CalculatorFormula {
  return {
    ruleId: `${formulaPrefix}kokomi-passive-critical-rate`, label: "心海庙算无遗：−100% 暴击率，减去共同输入已含份额",
    expression: expr.mul(expr.value(-1), expr.sub(expr.value(1), expr.input("kokomiPassiveIncludedInPanel"))),
    inputs: [booleanInput("kokomiPassiveIncludedInPanel", included, "共同最终暴击率已包含固有天赋的减一百个百分点")],
    requirements: { maximumConstellation: 0, elements: ["hydro"], attackTags: ["skill"] }, sourceRefs: refs,
  };
}

function shenheA1Formula(initial: boolean, ascension: number, included: boolean, refs: string[]): CalculatorFormula {
  return {
    ruleId: `${formulaPrefix}shenhe-a1-hit-accounting`, label: "申鹤 A1：本击实际冰伤 − 共同输入已含冰伤",
    expression: expr.mul(expr.value(.15), expr.sub(expr.mul(expr.input("shenheA1Unlocked"), expr.input("shenheA1InActualSnapshot")), expr.input("shenheA1IncludedInPanel"))),
    inputs: [
      booleanInput("shenheA1Unlocked", ascension >= 1, "突破至少为一，已解锁 A1"),
      booleanInput("shenheA1InActualSnapshot", initial, "全新 Q 只有初击的快照包含本次 A1；持续伤害快照在其生效前"),
      booleanInput("shenheA1IncludedInPanel", included, "共同输入增伤中已含 A1 的 15% 冰伤"),
    ], requirements: { maximumConstellation: 0, elements: ["cryo"], attackTags: ["burst"] }, sourceRefs: refs,
  };
}

const shenheReductions = [.06, .07, .08, .09, .1, .11, .12, .13, .14, .15, .15, .15, .15, .15, .15];
function shenheResistanceFormula(talentLevel: number, included: boolean, refs: string[]): CalculatorFormula {
  return {
    ruleId: `${formulaPrefix}shenhe-q-resistance-accounting`, label: "申鹤 Q：本级冰抗降低 ×（1 − 已含份额）",
    expression: expr.mul(expr.input("shenheQResistanceReduction"), expr.sub(expr.value(1), expr.input("shenheQReductionIncludedInResistance"))),
    inputs: [
      { ...contextInput("shenheQResistanceReduction", shenheReductions[talentLevel - 1]!, `有效 Q 等级 ${talentLevel} 的冰抗降低`), origin: "source-table" },
      booleanInput("shenheQReductionIncludedInResistance", included, "输入敌人抗性已减去本级申鹤 Q 冰抗降低"),
    ], requirements: { maximumConstellation: 0, elements: ["cryo"], attackTags: ["burst"] }, sourceRefs: refs,
  };
}

function escoffierResistanceFormula(members: number, actual: boolean, included: boolean, refs: string[]): CalculatorFormula {
  return {
    ruleId: `${formulaPrefix}escoffier-a4-resistance-accounting`, label: "爱可菲 A4：实际冰水人数对应减抗 ×（本击实际生效 − 输入已含）",
    expression: expr.mul(
      expr.condition("equal", expr.input("escoffierCryoHydroMembers"), expr.value(4), expr.value(.55), expr.mul(expr.value(.05), expr.input("escoffierCryoHydroMembers"))),
      expr.sub(expr.input("escoffierA4Actual"), expr.input("escoffierA4IncludedInResistance")),
    ),
    inputs: [
      { ...contextInput("escoffierCryoHydroMembers", members, "实际队伍中包括爱可菲本人在内的冰或水角色人数", "count"), minimum: 1, maximum: 4, integer: true },
      booleanInput("escoffierA4Actual", actual, "本击结算前 A4 是否实际生效；后续伤害依赖初击已命中并刷新"),
      booleanInput("escoffierA4IncludedInResistance", included, "共同输入敌人抗性已减去实际人数对应的爱可菲 A4"),
    ], requirements: { minimumAscension: 4, maximumConstellation: 0, elements: ["cryo"], attackTags: ["skill"] }, sourceRefs: refs,
  };
}

/** These are conditioned cast totals, not an aura, collision, or buff timeline simulation. */
export function applyBatchPeriodicCastContext(document: CalculatorDocument, supplied: BatchPeriodicCastContext): CalculatorDocument {
  const action = actions[document.gameContext?.skillId ?? ""];
  if (!action) return document;
  const context = batchPeriodicCastContextSchema.parse(supplied), result = structuredClone(document), game = result.gameContext!;
  game.batchPeriodicCast = context;
  const refs = sourceRefs(action.character, action.files), ascension = ascensionOf(result);
  const fullCast = result.scope === "one-cast" && result.hits.every(hit => result.selectedHitIds.includes(hit.id));
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith(dependencyPrefix));
  result.assumptions = result.assumptions.filter(assumption => !assumption.startsWith(assumptionPrefix));
  for (const hit of result.hits) {
    hit.dependencies = hit.dependencies.filter(id => !id.startsWith(dependencyPrefix));
    if (hit.kind === "ordinary") clearOwnedFormulas(hit);
  }
  const addDependency = (suffix: string, reasons: string[], explanation: string, hits: CalculatorHit[]) => {
    const id = `${dependencyPrefix}${suffix}`;
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || explanation, sourceRefs: refs });
    for (const hit of hits) hit.dependencies.push(id);
  };
  addDependency("c0", game.constellation === 0 ? [] : ["此完整动作只审阅 C0；其他命座可能改变次数、面板、额外伤害或减抗，不能沿用本分支。"], "已明确 C0，采用该命座下来源列出的自身伤害。", result.hits);
  if (action.character === "venti") addDependency("venti-hexerei", context.ventiHexereiInactive === true ? [] : ["需要明确温迪魔导相关被动未激活；此前已存在的 Q 倍率或全伤效果不能因本次没有元素吸收而省略。"], "已明确魔导相关被动未激活，使用此分支的普通 Q 伤害倍率。", result.hits);
  if (fullCast) {
    const reasons: string[] = [];
    if (context.completeCastConfirmed !== true) reasons.push("完整合计需要明确所列次数全部命中同一存活目标，技能未被替换或中断，且没有额外延长产生新命中。");
    if (context.statsStableAcrossHits !== true) reasons.push("需要确认各次实际取样/命中时的面板、装备效果和目标条件稳定，除本模块明确逐击处理的 A1 或 A4 差异外不发生变化。");
    if (action.character === "qiqi" && context.qiqiRevelationInactive !== true) reasons.push("需要明确本次七七 E 的启示未激活；否则基础十击不能覆盖可能存在的启示协同伤害。");
    if (action.character === "kaeya" && context.kaeyaFrontContactModelConfirmed !== true) reasons.push("需要明确采用固定源码的十三次正面接触模型；本分支不是游戏中十四或十五击最大命中模型。");
    if (action.character === "venti" && context.ventiNoAbsorption !== true) reasons.push("需要明确本次 Q 全程没有元素吸收，否则二十次风伤不足以构成完整自身伤害。");
    if (action.character === "escoffier" && context.escoffierArkheAvailable !== true) reasons.push("二十三击完整分支需要明确芒性伤害在本次施放时可用，不能把未知或冷却中当作可用。");
    addDependency("complete-cast", reasons, "完整次数、实际取样稳定性和所选来源分支已明确；未运行自动时间线。", result.hits);
  }
  const reactingHits = result.hits.filter(hit => hit.kind === "ordinary" && (hit.reaction !== "none" || hit.additiveReaction !== undefined));
  if (reactingHits.length) addDependency("reaction-stats", context.statsStableAcrossHits === true ? [] : ["反应使用实际命中时的 EM 和反应增益；需要确认它们与所填进攻面板一致且在相关命中间稳定，不能自动沿用旧快照中的反应属性。"], "已确认反应发生时的 EM、反应增益与所用面板一致；反应资格由逐击输入提供，不自动推演附着或 ICD。", reactingHits);

  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    if (action.character === "kokomi") {
      const reasons: string[] = [];
      if (context.kokomiNoBurstOrRefresh !== true) reasons.push("本分支需要明确没有 Q 仪来羽衣增幅、Q 刷新或新 E 替换；不能默认不存在 Q 的生命值加算。");
      if (context.kokomiPassiveIncludedInPanel === undefined) reasons.push("需要明确所填暴击率是否已包含心海固有天赋的 −100% 暴击率，不能猜测已含份额。");
      else hit.critRateFormula = kokomiCriticalFormula(context.kokomiPassiveIncludedInPanel, refs);
      if ((hit.finalSnapshot !== undefined || hit.effectiveCritRate !== undefined) && context.kokomiPassiveIncludedInPanel !== true) reasons.push("本击的历史快照或逐击最终暴击率会被直接使用，必须明确其已包含心海固有天赋的 −100% 暴击率；不能让尚未计入的修正被最终值旁路，也不从数值反推已含状态。");
      addDependency(`kokomi:${hit.id}`, reasons, "心海无 Q 分支及固有天赋暴击率记账已明确；仍按修正后的正常暴击率计算。", [hit]);
    }
    if (action.character === "shenhe") {
      const reasons: string[] = [], initial = hit.id === "batch-periodic-shenhe-burst-initial";
      if (ascension === undefined) reasons.push("需要明确申鹤突破阶段，才能确定本次初击的 A1 冰伤。");
      if (context.shenheFreshBurstNoSkillEffects !== true) reasons.push("需要明确没有旧 Q 的 A1、E 冰翎或 E 点按 A4，并且自身至初击留圈、目标全程留圈；不能省略其逐击差异。");
      if (context.shenheA1IncludedInPanel === undefined) reasons.push("需要明确共同输入增伤是否已含 A1 的 15% 冰伤，持续伤害快照不能误用本次初击的 A1。");
      if (ascension === 0 && context.shenheA1IncludedInPanel === true) reasons.push("突破零未解锁 A1，不能声明共同输入包含其 15% 冰伤。");
      if (ascension !== undefined && context.shenheA1IncludedInPanel !== undefined) hit.damageBonusFormula = shenheA1Formula(initial, ascension, context.shenheA1IncludedInPanel, refs);
      if (hit.effectiveResistance === undefined) {
        if (context.shenheQReductionIncludedInResistance === undefined) reasons.push("需要明确输入敌人抗性是否已计入本级申鹤 Q 减抗；未知记账不能当作未含。");
        if (shenheReductions[game.effectiveTalentLevel - 1] === undefined) reasons.push("缺少该有效 Q 等级对应的固定来源减抗参数。");
        else if (context.shenheQReductionIncludedInResistance !== undefined) hit.resistanceReductionFormula = shenheResistanceFormula(game.effectiveTalentLevel, context.shenheQReductionIncludedInResistance, refs);
      }
      addDependency(`shenhe:${hit.id}`, reasons, "本击的 A1 实际快照与共同输入已含份额分别恢复；目标抗性使用明确最终值或本级 Q 减抗补差。", [hit]);
    }
    if (action.character === "escoffier") {
      const reasons: string[] = [], initial = hit.id === "batch-periodic-escoffier-skill-initial", arkhe = hit.id === "batch-periodic-escoffier-skill-arkhe";
      if (ascension === undefined) reasons.push("需要明确爱可菲突破阶段，才能确定 A4 减抗是否解锁。");
      if (arkhe) {
        if (context.escoffierArkheAvailable !== true) reasons.push("需要明确本次芒性伤害不在冷却且确实可用。");
        if (hit.reaction !== "none" || hit.additiveReaction !== undefined || hit.explicitReactionBase !== undefined) reasons.push("芒性命中在固定源码中的附着量为零，不触发增幅或激化；当前反应输入与该命中矛盾，不能静默删除反应。");
      }
      if (hit.effectiveResistance === undefined && ascension !== undefined && ascension >= 4) {
        if (context.escoffierCryoHydroMembers === undefined) reasons.push("缺少实际冰水角色人数（含爱可菲本人，1–4），不能猜测 A4 的 5%/10%/15%/55% 减抗。");
        if (initial && context.escoffierA4InitiallyActive === undefined) reasons.push("需要明确初击结算前是否已有 A4；本次初击回调的减抗不能追溯作用于初击。");
        if (!initial && context.escoffierInitialHitConnected !== true) reasons.push("本后续命中分支要求初击已命中目标并启动 A4，后续间隔持续刷新；初击未中或未知不能使用该状态。");
        if (context.escoffierA4IncludedInResistance === undefined) reasons.push("需要明确共同输入抗性是否已包含当前人数对应的 A4 减抗。");
        const actual = initial ? context.escoffierA4InitiallyActive : context.escoffierInitialHitConnected;
        if (context.escoffierCryoHydroMembers !== undefined && actual !== undefined && context.escoffierA4IncludedInResistance !== undefined) hit.resistanceReductionFormula = escoffierResistanceFormula(context.escoffierCryoHydroMembers, actual, context.escoffierA4IncludedInResistance, refs);
      } else if (ascension !== undefined && hit.effectiveResistance === undefined && context.escoffierA4IncludedInResistance === true) reasons.push("突破四尚未解锁 A4，输入抗性不能声明已含其减抗。");
      addDependency(`escoffier:${hit.id}`, reasons, "本击 A4 的实际状态与输入抗性记账已明确；初击不会得到自身伤害回调之后才施加的减抗。", [hit]);
    }
  }
  result.assumptions.push(
    `${assumptionPrefix}${action.explanation}`,
    `${assumptionPrefix}完整动作要求明确全部命中与稳定的实际面板、装备命中效果及目标状态；单选已发生的一击不依赖未选后续命中的存在。固定次数是声明条件下的伤害合计，不是自动 rotation、附着、碰撞、产球或治疗模拟。`,
    `${assumptionPrefix}增幅或激化使用实际命中时的 EM 与反应增益；确认稳定时才与本次所填进攻面板合并计算。逐击 effectiveResistance 是已结算完整抗性，存在时不再执行或要求减抗已含份额记账；修改被动条件不会自动重算该最终值，需要同时恢复该击实际最终抗性。`,
  );
  return result;
}

/** Only the offensive panel changes; enemy resistance and its included debuffs remain as supplied. */
export function resetBatchPeriodicPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isBatchPeriodicCastAction(document)) return;
  const context: BatchPeriodicCastContext = document.gameContext!.batchPeriodicCast ?? {};
  context.kokomiPassiveIncludedInPanel = mode === "imported-final";
  if (mode === "fresh-equipment") {
    context.shenheA1IncludedInPanel = false;
  } else {
    delete context.shenheA1IncludedInPanel;
  }
  document.gameContext!.batchPeriodicCast = context;
}

/** Restore canonical character formulas on every core execution, including JSON input. */
export function prepareBatchPeriodicCastDocument(document: CalculatorDocument): CalculatorDocument {
  return isBatchPeriodicCastAction(document) ? applyBatchPeriodicCastContext(document, document.gameContext?.batchPeriodicCast ?? {}) : document;
}

/** Only after every affected hit's actual critical stat has been materialized. */
export function finalizeBatchPeriodicPanelAccounting(document: CalculatorDocument): void {
  if (actions[document.gameContext?.skillId ?? ""]?.character !== "kokomi") return;
  const hits = document.hits.filter(hit => hit.kind === "ordinary");
  if (hits.length && hits.every(hit => hit.finalSnapshot !== undefined || hit.effectiveCritRate !== undefined)) {
    (document.gameContext!.batchPeriodicCast ??= {}).kokomiPassiveIncludedInPanel = true;
  }
}
