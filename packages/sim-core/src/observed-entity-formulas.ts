import definitions from "../../game-data/sources/observed-entity-casts/definitions.json";
import type { ObservedEntityRole, ObservedEntityTemplate } from "../../game-data/src/character-mappings/observed-entity-mappings";
import { observedEntityCastContextSchema, type CalculatorDocument, type CalculatorFormula, type CalculatorHit, type ObservedEntityCastContext } from "./calculator-model";
import { compileObservedEntitySchedule, type ObservedEntityCastKind, type ObservedEntityHitInstance } from "./observed-entity-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as ObservedEntityTemplate[];
const prefix = "observed-entity:", sourceId = `${prefix}source`;
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const templateOf = (doc: CalculatorDocument) => templates.find(row => row.skillId === doc.gameContext?.skillId);
const refsOf = (role: ObservedEntityRole) => role.sourceRefs.map(path => path.startsWith("https://") ? path : sourceRoot + path);
export const isObservedEntityCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const roleOf = (cast: ObservedEntityTemplate, hit: OrdinaryHit) => hit.observedEntityEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];
const ascensionOf = (doc: CalculatorDocument, hit?: OrdinaryHit) => hit?.finalSnapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;

function stateOf(context: ObservedEntityCastContext, hit: OrdinaryHit) {
  const state = { ...context.sharedState, ...context.hitStates?.[hit.id] }, event = hit.observedEntityEvent;
  if (event?.scalingFrame !== undefined && context.furina?.maxHPByScalingFrame?.[String(event.scalingFrame)] !== undefined) state.actualMaxHPAtScaling = context.furina.maxHPByScalingFrame[String(event.scalingFrame)];
  if (event?.furinaPartyMembersAboveHalf !== undefined) state.furinaPartyMembersAboveHalf = event.furinaPartyMembersAboveHalf;
  if (event?.a4RefreshFrame !== undefined && context.furina?.a4MaxHPByRefreshFrame?.[String(event.a4RefreshFrame)] !== undefined) state.furinaA4MaxHPAtLastRefresh = context.furina.a4MaxHPByRefreshFrame[String(event.a4RefreshFrame)];
  if (event?.paramitaActiveAtSnapshot !== undefined) state.paramitaActiveAtSnapshot = event.paramitaActiveAtSnapshot;
  return state;
}

/** Numerical snapshots and source observations are both part of a materialized hit's identity. */
function identity(doc: CalculatorDocument, context: ObservedEntityCastContext, hit: OrdinaryHit): string {
  const event = hit.observedEntityEvent;
  return JSON.stringify({ event: event ?? `independent-single:${hit.id}`, snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : hit.finalSnapshot ?? null,
    state: stateOf(context, hit), effectiveTalentLevel: doc.gameContext?.effectiveTalentLevel, skillTalentLevel: context.skillTalentLevel,
    constellation: doc.gameContext?.constellation, ascension: ascensionOf(doc, hit), statsStableAcrossHits: context.statsStableAcrossHits,
    ...(doc.gameContext?.skillId === "observed-hutao-skill-c0" && stateOf(context, hit).paramitaActiveAtSnapshot === true ? {
      hutaoSkillStart: context.hutao === undefined ? null : { maxHP: context.hutao.skillStartMaxHP, baseATK: context.hutao.skillStartBaseATK } } : {}) });
}

function canonicalHit(doc: CalculatorDocument, cast: ObservedEntityTemplate, roleKey: string, context: ObservedEntityCastContext, previous?: OrdinaryHit, event?: ObservedEntityHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey]!, id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const talent = role.abilityKey === cast.abilityKey ? doc.gameContext!.effectiveTalentLevel : context.skillTalentLevel;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary",
    label: `${role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    element: role.element, attackTag: role.attackTag,
    terms: role.terms.filter(term => !(cast.characterSlug === "layla" && roleKey === "star" && term.stat === "hp" && term.minimumAscension === 4)).map(term => ({
      // A missing level leaves the sourced template coefficient visible, but its dependency blocks execution.
      stat: term.stat, coefficient: term.values.length === 1 ? term.values[0]! : term.values[(talent ?? 1) - 1] ?? term.values[0]!,
      ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }),
    })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    dependencies: [sourceId], sourceRefs: refsOf(role),
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment; delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.occurrence;
  if (event) {
    const { id: candidateId, ...metadata } = event;
    hit.observedEntityEvent = { candidateId, ...metadata };
    // A context snapshot is authoritative even when the event id and frame are unchanged.
    const snapshot = context.snapshots?.[event.snapshotId];
    const convertedStillCurrent = previous?.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitEvents?.[id] === identity(doc, context, hit);
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
    else if (!convertedStillCurrent) delete hit.finalSnapshot;
    if (!previous?.observedEntityEvent || JSON.stringify(previous.observedEntityEvent) !== JSON.stringify(hit.observedEntityEvent) || snapshot && JSON.stringify(snapshot) !== JSON.stringify(previous.finalSnapshot)) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  }
  return hit;
}

const formula = (ruleId: string, label: string, expression: FormulaExpression, inputs: CalculatorFormula["inputs"], refs: string[]): CalculatorFormula => ({
  ruleId, label, expression, inputs, sourceRefs: refs, requirements: { maximumConstellation: 0 },
});
const input = (key: string, value: number, meaningKey: string, unit = "stat"): CalculatorFormula["inputs"][number] => ({ key, value, minimum: 0, unit, meaningKey, origin: "explicit-observed-character-state" });

/** Passive inputs are actual launch/impact values, not inferred from another offensive snapshot. */
function applyPassive(doc: CalculatorDocument, cast: ObservedEntityTemplate, roleKey: string, context: ObservedEntityCastContext, hit: OrdinaryHit): string[] {
  const role = cast.roles[roleKey]!, state = stateOf(context, hit), ascension = ascensionOf(doc, hit), issues: string[] = [], refs = refsOf(role);
  const needsAscension = cast.characterSlug === "layla" && roleKey === "star" || cast.characterSlug === "furina" && roleKey !== "initial" || cast.characterSlug === "emilie" || cast.characterSlug === "hutao";
  if (needsAscension && ascension === undefined) issues.push("本击缺少实际突破阶段，不能确定对应A1/A4是否解锁。");
  if (role.fixedOnly && role.terms.some(term => term.minimumAscension !== undefined && (ascension === undefined || ascension < term.minimumAscension))) issues.push("所选独立被动伤害尚未明确解锁；不能把不存在的命中按0伤害计入完整动作。");

  if (cast.characterSlug === "hutao") {
    if (state.paramitaActiveAtSnapshot === undefined) issues.push("缺少本次血梅香真实取样时彼岸蝶舞是否仍有效；独立已发生命中无需未来重击列表，但不能猜本击状态。");
    if (state.includedAttackBonus === undefined) issues.push("缺少本击攻击面板已经包含的彼岸蝶舞固定攻击数值；0才表示明确未含。");
    if (state.includedDamageBonus === undefined) issues.push("缺少本击增伤中已经包含的胡桃A4份额；0才表示明确未含。");
    if (ascension !== undefined && ascension >= 4 && state.actualHPRatioAtSnapshot === undefined) issues.push("胡桃A4需要本击快照时的实际生命比例，不能用E起手扣血后的值代替全部后续取样。");
    const maxHP = context.hutao?.skillStartMaxHP, baseATK = context.hutao?.skillStartBaseATK;
    if (state.paramitaActiveAtSnapshot === true && (maxHP === undefined || baseATK === undefined)) issues.push("本击仍含E转换：需要这次E起手实际最大生命与基础攻击，不可用命中时面板反推。");
    if (state.paramitaActiveAtSnapshot !== undefined && state.includedAttackBonus !== undefined &&
        (!state.paramitaActiveAtSnapshot || maxHP !== undefined && baseATK !== undefined)) {
      const coefficient = hit.terms[0]!.coefficient;
      const sourceRatios = (definitions as unknown as { contactMarkerParameters: { hutaoAttackRatio: { values: number[] } } }).contactMarkerParameters.hutaoAttackRatio.values;
      const ratio = sourceRatios[doc.gameContext!.effectiveTalentLevel - 1];
      if (ratio === undefined) issues.push("E有效等级没有对应的固定来源生命转攻击倍率。");
      else {
        const inputs = [input("hutaoBlossomCoefficient", coefficient, "对应有效E等级的血梅香攻击倍率", "ratio"),
          input("hutaoIncludedAttack", state.includedAttackBonus, "本击实际攻击面板已含的彼岸蝶舞攻击数值")];
        let bonus: FormulaExpression = expr.value(0);
        if (state.paramitaActiveAtSnapshot) {
          inputs.push(input("hutaoCastMaxHP", maxHP!, "本次E起手最大生命"), input("hutaoCastBaseATK", baseATK!, "本次E起手基础攻击"),
            input("hutaoHpToAttackRatio", ratio, "对应有效E等级的生命转攻击系数", "ratio"));
          bonus = expr.min(expr.mul(expr.input("hutaoCastMaxHP"), expr.input("hutaoHpToAttackRatio")), expr.mul(expr.value(4), expr.input("hutaoCastBaseATK")));
        }
        hit.baseDamageFormula = formula("observed-hutao-blossom-attack-accounting-b4ae769", "血梅香基数：[本击攻击＋仍有效时min(E起手HP×转换率,4×起手基础ATK)－面板已含份额]×血梅香倍率",
          expr.mul(expr.sub(expr.add(expr.input("atk"), bonus), expr.input("hutaoIncludedAttack")), expr.input("hutaoBlossomCoefficient")), inputs, refs);
      }
    }
    if (ascension !== undefined && state.includedDamageBonus !== undefined && (ascension < 4 || state.actualHPRatioAtSnapshot !== undefined)) {
      const inputs = [input("hutaoIncludedA4", state.includedDamageBonus, "本击增伤中已含的胡桃A4份额", "ratio")];
      let bonus: FormulaExpression = expr.value(0);
      if (ascension >= 4) { inputs.push(input("hutaoSnapshotHpRatio", state.actualHPRatioAtSnapshot!, "本击快照时实际生命比例", "ratio"));
        bonus = expr.condition("lte", expr.input("hutaoSnapshotHpRatio"), expr.value(.5), expr.value(.33), expr.value(0)); }
      hit.damageBonusFormula = formula("observed-hutao-a4-accounting-b4ae769", "胡桃A4：突破4且本击生命≤50%时33%火伤，减去增伤输入已含份额",
        expr.sub(bonus, expr.input("hutaoIncludedA4")), inputs, refs);
    }
  }

  if (cast.characterSlug === "furina") {
    const hp = state.actualMaxHPAtScaling, pet = roleKey !== "initial", count = state.furinaPartyMembersAboveHalf;
    if (hp === undefined) issues.push("缺少伤害基数构造时的实际生命上限：初击读取施放第0帧，沙龙成员读取发射帧；不能用后续命中快照生命替代。");
    if (pet && count === undefined) issues.push("缺少本次发射前生命严格高于50%的实际队伍人数；前台处于Q动画者仍计数，未知不能当0。");
    const coefficient = hit.terms[0]?.coefficient;
    if (hp !== undefined && (!pet || count !== undefined) && coefficient !== undefined) {
      const inputs = [input("observedFurinaScalingMaxHP", hp, "初击施放时／宠物发射时实际最大生命"), input("observedFurinaCoefficient", coefficient, "该伤害角色对应有效E等级的固定来源生命倍率", "ratio")];
      if (pet) inputs.push({ ...input("observedFurinaPartyAboveHalf", count!, "发射前实际生命严格大于一半的队伍成员数；Q动画仍计入", "count"), maximum: 4, integer: true });
      hit.baseDamageFormula = formula("observed-furina-launch-hp-b4ae769", pet ? "芙宁娜沙龙基数：发射时HP×倍率×(1+0.1×合资格人数)" : "芙宁娜荒性初击：施放第0帧HP×倍率", expr.mul(expr.input("observedFurinaScalingMaxHP"), expr.input("observedFurinaCoefficient"), pet ? expr.add(expr.value(1), expr.mul(expr.value(.1), expr.input("observedFurinaPartyAboveHalf"))) : expr.value(1)), inputs, refs);
    }
    if (pet) {
      if (state.includedDamageBonus === undefined) issues.push("缺少本击输入增伤已包含的芙宁娜A4份额，0才表示明确未含。");
      if (ascension !== undefined && ascension >= 4 && state.furinaA4MaxHPAtLastRefresh === undefined) issues.push("缺少命中前最近一次30帧A4刷新实际生命上限；不能将发射或命中HP直接代替刷新HP。");
      if (ascension !== undefined && state.includedDamageBonus !== undefined && (ascension < 4 || state.furinaA4MaxHPAtLastRefresh !== undefined)) {
        const inputs = [input("observedIncludedDamageBonus", state.includedDamageBonus, "本击增伤中已经包含的芙宁娜A4比例", "ratio")];
        let actual: FormulaExpression = expr.value(0);
        if (ascension >= 4) {
          inputs.push(input("observedFurinaA4RefreshMaxHP", state.furinaA4MaxHPAtLastRefresh!, "本击命中前最后一次A4刷新时的实际生命上限"));
          actual = expr.min(expr.mul(expr.input("observedFurinaA4RefreshMaxHP"), expr.value(.000007)), expr.value(.28));
        }
        hit.damageBonusFormula = formula("observed-furina-a4-accounting-b4ae769", "芙宁娜A4：突破4时min(最近刷新HP×0.000007,0.28)，减去本击已含份额", expr.sub(actual, expr.input("observedIncludedDamageBonus")), inputs, refs);
      }
    }
  }
  if (cast.characterSlug === "layla" && roleKey === "star") {
    if (state.includedAdditiveBaseDamage === undefined) issues.push("缺少本击附加基伤已含的莱依拉A4数值，不能重复加入1.5%生命上限。");
    if (ascension !== undefined && ascension >= 4 && state.actualMaxHPAtScaling === undefined) issues.push("莱依拉A4需要本枚飞星发射时的实际生命上限，不能从不同取样时点的面板补填。");
    if (ascension !== undefined && state.includedAdditiveBaseDamage !== undefined && (ascension < 4 || state.actualMaxHPAtScaling !== undefined)) {
      const inputs = [input("observedLaylaIncludedBase", state.includedAdditiveBaseDamage, "本击附加基伤已包含的莱依拉A4数值", "damage")];
      let actual: FormulaExpression = expr.value(0);
      if (ascension >= 4) { inputs.push(input("observedLaylaLaunchMaxHP", state.actualMaxHPAtScaling!, "本枚飞星发射时实际生命上限")); actual = expr.mul(expr.input("observedLaylaLaunchMaxHP"), expr.value(.015)); }
      hit.additiveBaseFormula = formula("observed-layla-star-a4-accounting-b4ae769", "莱依拉A4：突破4时发射HP×0.015，减去本击附加基伤已含份额", expr.sub(actual, expr.input("observedLaylaIncludedBase")), inputs, refs);
    }
  }
  if (cast.characterSlug === "emilie") {
    if (state.includedDamageBonus === undefined) issues.push("缺少本击增伤已包含的艾梅莉埃A4比例，0才表示明确未含。");
    if (ascension !== undefined && ascension >= 4 && state.targetBurningAtHit === undefined) issues.push("缺少本次命中目标是否实际处于燃烧的状态，附近存在燃烧不能代替本目标燃烧。");
    if (ascension !== undefined && ascension >= 4 && state.targetBurningAtHit === true && state.actualAtkAtHit === undefined) issues.push("艾梅莉埃A4读取命中时当前实际总攻击，不能用实体进攻快照ATK替代。");
    if (ascension !== undefined && state.includedDamageBonus !== undefined && (ascension < 4 || state.targetBurningAtHit === false || state.targetBurningAtHit === true && state.actualAtkAtHit !== undefined)) {
      const inputs = [input("observedIncludedDamageBonus", state.includedDamageBonus, "本击输入增伤已含的艾梅莉埃A4比例", "ratio")];
      let actual: FormulaExpression = expr.value(0);
      if (ascension >= 4) {
        inputs.push({ ...input("observedEmilieTargetBurning", Number(state.targetBurningAtHit), "本次命中目标实际是否燃烧", "boolean"), allowedValues: [0, 1] });
        if (state.targetBurningAtHit) {
          inputs.push(input("observedEmilieImpactATK", state.actualAtkAtHit!, "本次命中时角色当前实际总攻击"));
          actual = expr.mul(expr.input("observedEmilieTargetBurning"), expr.min(expr.mul(expr.input("observedEmilieImpactATK"), expr.value(.00015)), expr.value(.36)));
        }
      }
      hit.damageBonusFormula = formula("observed-emilie-a4-accounting-b4ae769", "艾梅莉埃A4：突破4且本目标燃烧时min(命中时ATK×0.00015,0.36)，减去已含份额", expr.sub(actual, expr.input("observedIncludedDamageBonus")), inputs, refs);
    }
  }
  return issues;
}

/** Compile the complete observed lifetime, or retain an independent occurred hit without future dependencies. */
export function prepareObservedEntityCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!, context = observedEntityCastContextSchema.parse(game.observedEntityCast ?? {});
  game.observedEntityCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previousRole = (role: string) => [...old.values()].find(hit => !hit.observedEntityEvent && roleOf(cast, hit) === role);
  const representatives = () => Object.keys(cast.roles).map(role => canonicalHit(result, cast, role, context, previousRole(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(refsOf))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源显式实体观察协议；完整动作按实际排程、目标及接触展开，来源一致不等于游戏内实测。", sourceRefs: refs });
  const missing = oldHits.filter((hit): hit is Extract<CalculatorHit, { kind: "blocked" }> => hit.kind === "blocked" && selected.has(hit.id)).flatMap(hit => hit.reasons);
  if (game.constellation !== 0) missing.push("此实体完整施放仅支持明确C0，未把高命座额外实体或状态变化算作已完成。");
  if (game.effectiveTalentLevel > 15) missing.push("有效天赋等级超出固定来源1至15级；不能沿用第1级或外推倍率。");
  if (result.scope === "single-hit") {
    result.hits = old.size ? [...old.values()].map(hit => {
      const role = roleOf(cast, hit);
      if (!role || !cast.roles[role]) return hit;
      const saved = hit.observedEntityEvent;
      if (!saved) return canonicalHit(result, cast, role, context, hit);
      const { candidateId: id, ...metadata } = saved;
      return canonicalHit(result, cast, role, context, hit, { id, ...metadata, templateRole: metadata.templateRole as ObservedEntityHitInstance["templateRole"] });
    }) : representatives();
  } else {
    const schedule = compileObservedEntitySchedule(cast.skillId as ObservedEntityCastKind, context, { ascension: ascensionOf(result) });
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonicalHit(result, cast, event.templateRole, context, old.get(`${cast.skillId}:${event.id}`) ?? previousRole(event.templateRole), event)) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "本次完整实体施放未命中所选目标", kind: "non-damaging", reason: "来源日程中所有接触或落空均有明确记录，所选目标没有实际命中；不补造伤害。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, reasons: string[], targets: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击来源、实际取样及被动已含份额明确。", sourceRefs: refs });
    targets.forEach(hit => hit.dependencies.push(id));
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const issues: string[] = [], roleKey = roleOf(cast, hit), event = hit.observedEntityEvent;
    if (!roleKey || !cast.roles[roleKey]) { dependency(`${prefix}${hit.id}`, ["命中缺少本实体来源中的有效伤害角色，不能借用其他系数。"], [hit]); continue; }
    const role = cast.roles[roleKey]!;
    if (role.abilityKey !== cast.abilityKey && role.terms.some(term => term.values.length > 1) && context.skillTalentLevel === undefined) issues.push("本次Q包含独立E等级缩放的伤害角色，必须明确有效E天赋等级，不能套用Q等级。");
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) issues.push("已转换命中的排程、来源观察、实际输入或快照发生变化；旧时点装备增伤、附加基伤和抗性不能沿用，请重新应用构筑或导入实际面板。");
    if (event && result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) issues.push(`本击缺少实际进攻快照${event.snapshotId}；没有声明共同面板稳定，不能借用另一命中或被删除的旧快照。`);
    if (event && result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot && !context.snapshots?.[event.snapshotId]) issues.push("本击先前使用的实际快照已移除或失效；请明确恢复该击快照，不能静默改用当前面板。");
    if (roleKey === "arkhe" && (hit.reaction !== "none" || hit.additiveReaction !== undefined)) issues.push("固定来源灵息之刺附着量为0，不能指定增幅或激化反应。");
    issues.push(...applyPassive(result, cast, roleKey, context, hit));
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const selectedHits = result.hits.filter(hit => result.selectedHitIds.includes(hit.id));
  const complete = result.scope === "one-cast" && selectedHits.length === result.hits.length && !selectedHits.some(hit => hit.dependencies.some(id => result.dependencies.find(row => row.id === id)?.status === "missing"));
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : complete ? "complete-cast" : "selected-components";
  game.attributionPolicy = cast.characterSlug === "hutao"
    ? "本次E仅归属血梅香伤害；已观察的本E重击仅施加／刷新标记，其本体仍属普攻；离开本E后的其他重击不归属此标记。独立已发生命中不要求未来重击列表。"
    : cast.characterSlug === "kaeya" || cast.characterSlug === "aloy"
      ? "明确选定固定源码简化日程下的C0自身伤害；已明确所有接触／落空与尾段，仅称该参考协议条件完整，不声称游戏中任意碰撞轨迹或真实散落物寿命完整。"
      : "明确观察到的C0实体完整寿命及已发出尾段，仅合计本次自身伤害；独立已发生命中不依赖未来排程，不自动推测随机、附着、移动或队伍轮转。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("实体观察协议：")),
    "实体观察协议：每次执行重新读取实际日程与权威快照；未声明共同面板稳定时逐击恢复各自实际快照。改变或删除记录不会保留旧物化属性。",
    "实体观察协议：芙宁娜伤害基数用施放/发射时HP，宠物增幅数在发射前读取，A4使用命中前最后刷新HP；莱依拉A4使用飞星发射HP；艾梅莉埃A4使用本目标命中时燃烧与当前ATK。被动只补已含份额以外的差额。",
    ...cast.assumptions.map(row => `实体观察协议：${row}`)];
  return result;
}

export function resetObservedEntityPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isObservedEntityCastAction(document)) return;
  const context = document.gameContext!.observedEntityCast ??= {};
  delete context.finalizedHitEvents;
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") { state.includedDamageBonus = 0; state.includedAdditiveBaseDamage = 0; }
    else { delete state.includedDamageBonus; delete state.includedAdditiveBaseDamage; }
    if (document.gameContext?.skillId === "observed-hutao-skill-c0") {
      if (mode === "fresh-equipment") state.includedAttackBonus = 0;
      else delete state.includedAttackBonus;
    }
    if (hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
  }
  const shared = context.sharedState ??= {};
  if (mode === "fresh-equipment") { shared.includedDamageBonus = 0; shared.includedAdditiveBaseDamage = 0; }
  else { delete shared.includedDamageBonus; delete shared.includedAdditiveBaseDamage; }
  if (document.gameContext?.skillId === "observed-hutao-skill-c0") {
    if (mode === "fresh-equipment") shared.includedAttackBonus = 0;
    else delete shared.includedAttackBonus;
  }
}

/** Own base/damage formulas stay executable; conversion only materializes equipment contributions. */
export function finalizeObservedEntityPanelAccounting(document: CalculatorDocument): void {
  if (!isObservedEntityCastAction(document)) return;
  const context = document.gameContext!.observedEntityCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(document, context, hit)]));
}

export function observedEntityEventTrace(hit: CalculatorHit, document?: CalculatorDocument): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.observedEntityEvent) return [];
  const event = hit.observedEntityEvent, trace = new TraceBuilder(hit.sourceRefs);
  for (const [key, value, label, meaning] of [
    ["damageFrame", event.frame, "本击实际来源排程", `${event.candidateId}，明确目标${event.targetId}`],
    ["snapshotFrame", event.snapshotFrame, "本击进攻快照取样", event.snapshotId],
    ["launchFrame", event.launchFrame, "本击发射时点", "已观察且通过来源协议的发射时点"],
    ["scalingFrame", event.scalingFrame, "本击生命基数取样", event.scalingId ?? "独立实际生命缩放时点"],
    ["triggerFrame", event.triggerFrame, "本击来源触发时点", event.triggerId ?? "独立实体触发"],
    ["a4RefreshFrame", event.a4RefreshFrame, "芙宁娜本击采用的A4刷新时点", "命中前最近一次30帧刷新，不以发射HP替代"],
  ] as const) if (value !== undefined) trace.add(`observed-entity.${key}`, label, expr.input(key), [traceInput(key, value, "frames", "pinned-source-observed-schedule", meaning)], { unit: "frames" });
  if (event.furinaPartyMembersAboveHalf !== undefined) trace.add("observed-entity.party-above-half", "芙宁娜发射前合资格队伍人数", expr.input("partyAboveHalf"), [traceInput("partyAboveHalf", event.furinaPartyMembersAboveHalf, "count", "actual-party-hp-observation", "生命严格高于一半；前台Q动画角色仍计数但不扣血")], { unit: "count" });
  if (event.paramitaActiveAtSnapshot !== undefined) trace.add("observed-entity.paramita-snapshot", "血梅香取样时彼岸蝶舞是否有效", expr.input("paramitaActive"),
    [traceInput("paramitaActive", Number(event.paramitaActiveAtSnapshot), "boolean", "pinned-source-observed-schedule", "由本E状态、重击延长／结束、实际切人和取样时点决定")], { unit: "boolean" });
  const hp = document?.scope === "one-cast" && document.gameContext?.skillId === "observed-hutao-skill-c0"
    ? document.gameContext.observedEntityCast?.hutao?.skillStartCurrentHP : undefined;
  if (hp !== undefined) {
    const inputs = [traceInput("skillStartCurrentHP", hp, "hp", "explicit-cast-observation", "本次E起手实际当前生命，不用后续快照HP回填")];
    trace.add("observed-entity.hutao-hp-drain", "胡桃E扣除起手当前生命的30%", expr.mul(expr.input("skillStartCurrentHP"), expr.value(.3)), inputs, { unit: "hp" });
    trace.add("observed-entity.hutao-hp-after", "仅E扣血后的生命", expr.mul(expr.input("skillStartCurrentHP"), expr.value(.7)), inputs,
      { unit: "hp", childIds: ["observed-entity.hutao-hp-drain"], applicabilityReason: "只记录起手扣血；后续A4仍使用每击实际生命比例。" });
  }
  return trace.nodes;
}
