import definitions from "../../game-data/sources/finite-followup-casts/definitions.json";
import type { FiniteFollowupHitDefinition, FiniteFollowupTemplate } from "../../game-data/src/character-mappings/finite-followup-mappings";
import { finiteFollowupCastContextSchema, type CalculatorDocument, type CalculatorFormula, type CalculatorHit, type FiniteFollowupCastContext } from "./calculator-model";
import { expr } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as FiniteFollowupTemplate[];
const prefix = "finite-followup:";
const sourceRoot = `https://github.com/genshinsim/gcsim/blob/${definitions.revision}/`;
const templateOf = (doc: CalculatorDocument) => templates.find(cast => cast.skillId === doc.gameContext?.skillId);
export const isFiniteFollowupCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const ascensionOf = (doc: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
const input = (key: string, value: number, meaningKey: string, unit = "ratio"): CalculatorFormula["inputs"][number] => ({ key, value, meaningKey, unit, origin: "explicit-source-context" });
function formula(id: string, label: string, actual: number, included: number, refs: string[], unit = "ratio"): CalculatorFormula {
  return { ruleId: prefix + id, label, expression: expr.sub(expr.input("actualSourceContribution"), expr.input("includedSourceContribution")),
    inputs: [input("actualSourceContribution", actual, "固定来源在本击实际生效的份额", unit), input("includedSourceContribution", included, "当前输入已包含的同一来源份额；0表示明确未含", unit)],
    requirements: { maximumConstellation: 0 }, sourceRefs: refs };
}
function scaledBaseFormula(id: string, label: string, baseKey: string, baseValue: number, baseMeaning: string, coefficient: number, included: number, refs: string[]): CalculatorFormula {
  return { ruleId: prefix + id, label, expression: expr.sub(expr.mul(expr.input(baseKey), expr.input("sourceScalingCoefficient")), expr.input("includedSourceContribution")),
    inputs: [input(baseKey, baseValue, baseMeaning, "stat"), input("sourceScalingCoefficient", coefficient, "固定来源的本项加算基伤系数"), input("includedSourceContribution", included, "本击输入已包含的同一项加算基伤", "damage")], requirements: { maximumConstellation: 0 }, sourceRefs: refs };
}
function canonicalHit(doc: CalculatorDocument, definition: FiniteFollowupHitDefinition, context: FiniteFollowupCastContext, previous?: OrdinaryHit): OrdinaryHit {
  const level = definition.talent === "normal" ? context.normalTalentLevel : doc.gameContext!.effectiveTalentLevel;
  const refs = definition.sourceRefs.map(path => sourceRoot + path);
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id: definition.id, label: definition.label,
    kind: "ordinary", element: definition.element, attackTag: definition.attackTag,
    terms: [{ stat: definition.scalingStat, coefficient: (definition.values[(level ?? 1) - 1] ?? definition.values[0]!) * (definition.coefficientMultiplier ?? 1) },
      ...(definition.fixedTerms ?? []).map(term => ({ stat: term.scalingStat, coefficient: term.coefficient, ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }) }))],
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0,
    groupMultiplier: previous?.groupMultiplier ?? 1, sourceRefs: refs, dependencies: previous?.dependencies.filter(id => !id.startsWith(prefix)) ?? [],
  };
  // These sourced actions cannot replace their coefficients by an imported formula.
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment; delete hit.coordinatedEvent; delete hit.occurrence;
  return hit;
}

/** Each finite component is restored separately, including the independently levelled Hurricane Arrow. */
export function prepareFiniteFollowupCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = finiteFollowupCastContextSchema.parse(game.finiteFollowupCast ?? {});
  game.finiteFollowupCast = context;
  context.hitStates ??= {};
  const oldSelected = new Set(result.selectedHitIds), selectedAll = result.hits.every(hit => oldSelected.has(hit.id));
  const oldHits = new Map(result.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const originalBlockers = result.hits.filter(hit => hit.kind === "blocked").flatMap(hit => hit.reasons);
  result.hits = cast.hits.map(definition => canonicalHit(result, definition, context, oldHits.get(definition.id)));
  const retained = result.hits.filter(hit => oldSelected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  const full = result.scope === "one-cast" && result.hits.every(hit => result.selectedHitIds.includes(hit.id));
  const selectedCount = result.selectedHitIds.length;
  const faruzanQ = game.skillId === "finite-followup-faruzan-burst-fresh-c0";
  const endseer = game.skillId === "finite-followup-cyno-skill-endseer-c0";
  const detonation = game.skillId === "finite-followup-keqing-skill-detonation-c0";
  const refs = [...new Set(cast.hits.flatMap(hit => hit.sourceRefs.map(path => sourceRoot + path)))];
  const reasons: string[] = [...originalBlockers];
  if (game.constellation !== 0) reasons.push("此有限后续动作只审阅明确C0，不能忽略高命座追加伤害或额外箭。");
  if (game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) reasons.push("有效天赋等级须在固定来源1至15级内。");
  if (selectedCount > 1 && context.statsStableAcrossHits !== true) reasons.push("多击合计须明确各时点面板、装备和目标条件稳定；本模块已明确的逐击被动与反应另行计算。");
  if (full) for (const [key, message] of [
    ["completeCastConfirmed", "须确认所列全部自身伤害实际命中同一目标及完整动作分支成立；法露珊飓烈箭仅一次目标命中回调，不产生额外风涡。"],
    ["noHitlag", "固定帧日程须明确没有卡肉延长。"],
    ["noReplacement", "须明确实体与状态没有被其他E/Q替换、重置或提前消耗。"],
    ["noInterruption", "须明确所需动作和实体存续没有被中断。"],
  ] as const) if (context[key] !== true) reasons.push(message);
  const dependency = (id: string, missing: string[], hits: CalculatorHit[]) => {
    const key = prefix + id;
    result.dependencies.push({ id: key, status: missing.length ? "missing" : "provisional", reason: missing.join("；") || "本来源动作与逐击被动记账明确；每击独立通过普通伤害核心。", sourceRefs: refs });
    for (const hit of hits) hit.dependencies.push(key);
  };
  dependency("cast", reasons, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const definition = cast.hits.find(row => row.id === hit.id)!;
    const state = context.hitStates[hit.id] ??= {};
    const ascension = ascensionOf(result, hit), missing: string[] = [];
    if (definition.talent === "normal" && context.normalTalentLevel === undefined) missing.push("飓烈箭使用普通攻击天赋，缺少独立有效等级，不能拿E等级代替。");
    if (cast.characterSlug === "keqing") {
      if (context.keqingPriorQInactive !== true) missing.push("须明确此前Q的15%暴击/充能增益未激活，不能用稳定声明省略它的到期。");
      if ((full || definition.role !== "initial") && context.keqingFreshStiletto !== true) missing.push("后续伤害须来自本次全新且未提前消耗的雷楔。");
      if (full || definition.role !== "initial") {
        const first = detonation ? 37 : 35;
        if (context.keqingFollowupFrame === undefined || context.keqingFollowupFrame < first || context.keqingFollowupFrame >= 320) missing.push(`须明确后续动作在来源允许的${first}至319帧开始，雷楔320帧到期前已实际消耗。`);
      }
      const offset = definition.role === "initial" ? 25 : (context.keqingFollowupFrame ?? 0) + (detonation ? definition.role.endsWith("1") ? 21 : 24 : 16);
      hit.label += ` · ${definition.role === "initial" || context.keqingFollowupFrame !== undefined ? offset + "帧" : "后续时点待填"}`;
    }
    if (cast.characterSlug === "faruzan") {
      if (context.faruzanFreshNoPriorEffects !== true) missing.push("须明确没有前次E/Q增伤、减抗和A4冷却残留；E连段也不能期间开启Q。");
      if (ascension === undefined) missing.push("缺少实际突破阶段，不能确定蓄力时长或A4。");
      if (!faruzanQ && (full || definition.role !== "initial")) {
        if (context.faruzanHurricaneStartFrame === undefined || context.faruzanHurricaneStartFrame < 35 || context.faruzanHurricaneStartFrame > 1092) missing.push("须明确唯一满蓄飓烈箭在35至1092帧启动，消费本次疾风示现；不包含C1第二箭。");
      }
      if (state.includedDamageBonus === undefined) missing.push("缺少本击输入已含的法露珊自身Q风伤份额；明确0表示未含。");
      else {
        const actual = faruzanQ ? definitions.faruzanBurstBonusValues[game.effectiveTalentLevel - 1] : 0;
        if (actual !== undefined) hit.damageBonusFormula = formula("faruzan-q-bonus", "法露珊：本击实际Q风伤 − 已含份额", actual, state.includedDamageBonus, refs);
      }
      if (hit.effectiveResistance === undefined) {
        if (state.includedResistanceReduction === undefined) missing.push("缺少敌方输入已含的法露珊自身减抗份额；本次初击/坍陷的后置减抗尚不生效。");
        else hit.resistanceReductionFormula = formula("faruzan-post-hit-shred", "后置减抗：本击实际0 − 抗性已含份额", 0, state.includedResistanceReduction, refs);
      }
      if (state.includedAdditiveBase === undefined) missing.push("缺少本击加算基伤中已含的法露珊A4份额；须明确0或实际数值。");
      let baseAtk = context.faruzanBaseAtk;
      if (baseAtk === undefined && result.build.mode === "equipment-derived" && !hit.finalSnapshot) baseAtk = result.build.characterBaseAtk + result.build.weaponBaseAtk;
      if (faruzanQ) {
        if (context.faruzanInsideBurstArea !== true) missing.push("须确认43帧至54帧处于本次Q的增益范围，本级风伤已先于初击生效。");
        if (ascension !== undefined && ascension >= 4 && context.faruzanNoOtherAnemoBeforeInitial !== true) missing.push("须明确本次Q初击前无其他合资格风伤消耗A4，初击A4冷却可用。");
        if (ascension !== undefined && ascension >= 4 && baseAtk === undefined) missing.push("手动或历史面板缺少真实基础攻击力（角色与武器），不能由最终ATK反推A4。");
      }
      const a4Known = ascension !== undefined && (!faruzanQ || ascension < 4 || baseAtk !== undefined);
      if (a4Known && state.includedAdditiveBase !== undefined) hit.additiveBaseFormula = faruzanQ && ascension! >= 4
        ? scaledBaseFormula("faruzan-a4-base", "法露珊A4：32%基础攻击力 − 已含基伤", "faruzanBaseAtk", baseAtk!, "本次施加A4的真实角色加武器基础攻击力", .32, state.includedAdditiveBase, refs)
        : formula("faruzan-a4-base", "法露珊本击无A4：0 − 已含基伤", 0, state.includedAdditiveBase, refs, "damage");
      if (faruzanQ) hit.label += " · 54帧（43帧先获得Q风伤）";
      else if (definition.role === "initial") hit.label += " · 14帧";
      else if (context.faruzanHurricaneStartFrame !== undefined && ascension !== undefined) hit.label += ` · ${context.faruzanHurricaneStartFrame + (ascension >= 1 ? 49 : 86) + 10 + (definition.role === "collapse" ? 33 : 0)}帧`;
    }
    if (cast.characterSlug === "xinyan") {
      if (full) {
        if (ascension === undefined) missing.push("缺少突破阶段，不能确定三级盾需要命中2或3名敌人。");
        else if (context.xinyanInitialOpponentCount === undefined || context.xinyanInitialOpponentCount < (ascension >= 1 ? 2 : 3)) missing.push("初击命中人数不足或未知，不能凭空生成三级护盾与五次脉冲。");
        if (context.xinyanShieldUnbroken !== true) missing.push("须确认三级盾从28帧保留至748帧自然到期，未破裂、覆盖或提前移除。");
      }
      hit.label += ` · ${definition.role === "initial" ? 15 : 29 + 120 * Number(definition.role.split("-")[1])}帧`;
    }
    if (cast.characterSlug === "cyno") {
      const bolt = definition.role.startsWith("bolt-");
      if (context.cynoBurstActive !== true) missing.push("须明确本次E起手与28帧取样均处于启途誓使状态并保持Q的100精通；不能用普通E、Q起手或到期边界替代。");
      if (context.cynoEndseerActive !== endseer) missing.push(`本分支要求起手末途真眼明确${endseer ? "激活" : "未激活"}。`);
      if (ascension === undefined) missing.push("缺少实际突破阶段，不能确定末途真眼与A4。");
      else if (endseer && ascension < 1) missing.push("突破0不能触发末途真眼裁定或三道渡荒之雷。");
      const emIncluded = state.cynoBurstEmIncludedInPanel ?? context.cynoBurstEmIncludedInPanel;
      if (emIncluded === undefined) missing.push("须明确本击实际EM面板是否已包含Q的100点精通。");
      else {
        hit.elementalMasteryAdjustment = { formula: formula("cyno-burst-em", "启途誓使：100点精通 − 面板已含份额", 100, emIncluded ? 100 : 0, refs, "stat"), accounting: "add-to-panel" };
        if (hit.finalSnapshot && !emIncluded) missing.push("历史完整快照直接使用已保存EM，必须明确已包含Q的100点精通；不能由共同面板补差旁路它。");
      }
      if (state.includedDamageBonus === undefined) missing.push("缺少本击已含的裁定35%增伤份额；它只给末途真眼冥祭主击，不给三道渡荒之雷。");
      else hit.damageBonusFormula = formula("cyno-endseer-main", "裁定：本击主击35%或0 − 已含份额", endseer && !bolt ? .35 : 0, state.includedDamageBonus, refs);
      if (state.includedAdditiveBase === undefined) missing.push("缺少本击已含的渡荒之雷A4基伤份额；主击实际为0。");
      if (bolt && ascension !== undefined && ascension >= 4 && context.cynoCastEm === undefined) missing.push("A4渡荒之雷读取E起手时的真实EM；缺少独立起手精通，不能拿28帧面板猜测。");
      if (state.includedAdditiveBase !== undefined && ascension !== undefined && (!bolt || ascension < 4 || context.cynoCastEm !== undefined)) hit.additiveBaseFormula = bolt && ascension >= 4
        ? scaledBaseFormula("cyno-a4-bolt", "九弓的执命：2.5倍起手EM − 已含基伤", "cynoCastEm", context.cynoCastEm!, "本次E第0帧实际精通，已包含当时仍生效的Q加成", 2.5, state.includedAdditiveBase, refs)
        : formula("cyno-a4-bolt", "本击无渡荒之雷A4：0 − 已含基伤", 0, state.includedAdditiveBase, refs, "damage");
      hit.label += " · 28帧";
    }
    if (context.finalizedHitContexts && context.finalizedHitContexts[hit.id] !== hit.label) missing.push("后续动作时点已改变，本击不能沿用旧时点已转换的面板；请重新应用构筑或导入实际面板。");
    dependency(hit.id, missing, [hit]);
  }
  const selectedDependencies = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(row => selectedDependencies.has(row.id) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : full && ready ? "complete-cast" : "selected-components";
  const note = "有限后续动作归属：每击恢复固定源倍率；完整只指标签声明的E/Q自身伤害，刻晴重击触发动作的物伤不属于E。法露珊箭独立用普攻等级，赛诺A4用起手EM。未知上下文阻塞，未将稳定面板当作被动已含证明。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("有限后续动作归属：")), note, ...cast.assumptions.filter(row => !result.assumptions.includes(row))];
  return result;
}

/** Offensive-panel replacement leaves enemy accounting and genuine historical snapshots intact. */
export function resetFiniteFollowupPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const cast = templateOf(document);
  if (!cast) return;
  const context = document.gameContext!.finiteFollowupCast ??= {};
  delete context.finalizedHitContexts;
  context.hitStates ??= {};
  if (mode === "imported-final") delete context.faruzanBaseAtk;
  else if (cast.characterSlug === "faruzan" && document.build.mode === "equipment-derived") context.faruzanBaseAtk = document.build.characterBaseAtk + document.build.weaponBaseAtk;
  for (const hit of document.hits) {
    if (hit.kind !== "ordinary" || hit.finalSnapshot && hit.finalSnapshot.origin !== "equipment-conversion") continue;
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") {
      state.includedDamageBonus = 0;
      // Applying equipment preserves the editable additive-base input; its source accounting is not reset.
      if (cast.characterSlug === "cyno") state.cynoBurstEmIncludedInPanel = false;
    } else {
      delete state.includedDamageBonus;
      if (cast.characterSlug === "cyno") delete state.cynoBurstEmIncludedInPanel;
    }
  }
  if (cast.characterSlug === "cyno") {
    if (mode === "fresh-equipment") context.cynoBurstEmIncludedInPanel = false;
    else delete context.cynoBurstEmIncludedInPanel;
  }
}

/** Conversion materializes EM in captured snapshots; source damage/base deltas remain executable. */
export function finalizeFiniteFollowupPanelAccounting(document: CalculatorDocument): void {
  const cast = templateOf(document);
  if (!cast) return;
  const context = document.gameContext!.finiteFollowupCast ??= {};
  context.finalizedHitContexts = Object.fromEntries(document.hits.filter(hit => hit.kind === "ordinary").map(hit => [hit.id, hit.label]));
  if (cast.characterSlug === "faruzan" && context.faruzanBaseAtk === undefined && document.build.mode === "equipment-derived") {
    context.faruzanBaseAtk = document.build.characterBaseAtk + document.build.weaponBaseAtk;
  }
  if (cast.characterSlug !== "cyno") return;
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && hit.finalSnapshot?.origin === "equipment-conversion") {
    (context.hitStates[hit.id] ??= {}).cynoBurstEmIncludedInPanel = true;
  }
}
