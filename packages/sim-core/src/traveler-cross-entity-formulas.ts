import { travelerCrossSourceTemplates, type TravelerCrossSourceTemplate } from "../../game-data/src/character-mappings/traveler-cross-source-mappings";
import { travelerCrossEntityCastContextSchema, type TravelerCrossEntityCastContext, type CalculatorDocument, type CalculatorHit, type CalculatorFormula } from "./calculator-model";
import type { TravelerCrossEntityHitState } from "./traveler-cross-entity-context";
import { compileTravelerCrossEntitySchedule, travelerCrossEntitySourceSchedule, type TravelerCrossEntityCastKind, type TravelerCrossEntityHitInstance } from "./traveler-cross-entity-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES, TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS, TRAVELER_ANEMO_MAX_CONSTELLATION, travelerAnemoAbsorbedCoefficient } from "./traveler-cross-entity-anemo-source";

type CrossGame = NonNullable<CalculatorDocument["gameContext"]>;
type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const prefix = "traveler-cross-entity:", sourceId = `${prefix}source`;
const gameOf = (document: CalculatorDocument) => document.gameContext as CrossGame | undefined;
const templateOf = (document: CalculatorDocument) => travelerCrossSourceTemplates.find(cast => cast.skillId === document.gameContext?.skillId);
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const hitState = (context: TravelerCrossEntityCastContext, hit: OrdinaryHit): TravelerCrossEntityHitState => ({ ...context.sharedState, ...context.hitStates?.[hit.id] });
const ascensionOf = (document: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ??
  (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
export const isTravelerCrossEntityCastAction = (document: CalculatorDocument): boolean => templateOf(document) !== undefined;
/** The public constellation gate must use these exact two actions, not all Travelers. */
export const isTravelerAnemoAbsorptionAction = (document: CalculatorDocument): boolean =>
  document.gameContext?.skillId === "traveler-cross-aether-anemo-burst-c0" || document.gameContext?.skillId === "traveler-cross-lumine-anemo-burst-c0";
export { TRAVELER_ANEMO_MAX_CONSTELLATION, TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS };
const c6RuleId = `${prefix}anemo-c6-target-resistance-a7dc4bf`;
const absorbedSingleId = (cast: TravelerCrossSourceTemplate) => `${cast.skillId}:absorbed-single`;
export function travelerAnemoConstellationScope(document: CalculatorDocument, hit?: CalculatorHit):
  {allowed: boolean; reason: string; sourceRefs: string[]} | undefined {
  if (!isTravelerAnemoAbsorptionAction(document)) return undefined;
  const game = document.gameContext!, cast = templateOf(document)!;
  const identityValid = game.characterId === (cast.characterSlug === "aether" ? "character:10000005" : "character:10000007")
    && game.variantId === cast.variantId && game.abilityId === "talent:traveleranemo:combat3";
  const event = hit?.kind === "ordinary" ? hit.travelerCrossEntityEvent : undefined;
  const roleValid = !hit || hit.kind === "ordinary" && hit.attackTag === "burst" && (
    hit.element === "anemo" && (!event ? hit.id === cast.roles.tick.mappingId : event.templateRole === "tick"
      && event.absorbedElement === undefined && hit.id === `${cast.skillId}:${event.candidateId}`)
    || ["pyro", "hydro", "cryo", "electro"].includes(hit.element) && (event ? event.templateRole === "absorbed-tick"
      && event.absorbedElement === hit.element && hit.id === `${cast.skillId}:${event.candidateId}` :
      hit.id === absorbedSingleId(cast) && game.travelerCrossEntityCast?.anemo?.singleHitRole === "absorbed-tick"
      && game.travelerCrossEntityCast.anemo.absorptionElement === hit.element));
  const allowed = identityValid && roleValid && Number.isInteger(game.constellation) && game.constellation >= 0 && game.constellation <= TRAVELER_ANEMO_MAX_CONSTELLATION;
  return {allowed, reason: !identityValid ? "风Q来源动作、旅行者身份、风形态及Q天赋必须一致，不能借用其他角色或形态。" : !roleValid ?
    "本击不属于此风Q的来源风本体或明确元素的实际吸收附加，不能靠技能标签放行外来伤害。" :
    "风旅行者C0–C6本次Q直接伤害已审阅：C3只使用已含加级的有效Q等级；吸收时点、元素增伤和C6逐元素事后减抗仍逐击核对，不包含其他技能、扩散实体或团队生命周期。",
    sourceRefs: TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS};
}

function identity(document: CalculatorDocument, context: TravelerCrossEntityCastContext, hit: OrdinaryHit): string {
  const event = hit.travelerCrossEntityEvent, state = hitState(context, hit);
  return stable({ event: event ?? { independentHitId: hit.id },
    snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null,
    state: hit.element === "dendro" ? { ...state, untransformedAtHit: state.untransformedAtHit ?? event?.untransformedAtHit } :
      {c6ActiveBeforeHit: state.c6ActiveBeforeHit ?? event?.c6ActiveBeforeHit, includedC6ResistanceReduction: state.includedC6ResistanceReduction},
    talentLevel: document.gameContext?.effectiveTalentLevel,
    characterLevel: document.characterLevel,
    constellation: document.gameContext?.constellation, ascension: ascensionOf(document, hit),
    element: hit.element, anemo: hit.element === "dendro" ? null : context.anemo,
    importedElementBonus: event?.templateRole === "absorbed-tick" || hit.id.endsWith(":absorbed-single") ? document.gameContext?.importedPanelDamageBonuses?.[hit.element] : null,
    trueMoonStoryBuffInactive: context.trueMoonStoryBuffInactive });
}

/** Old C0 documents predate absorption and the level signature. They remain
 * readable if their original signature is intact and any actual historical
 * panel still has the current level. New conversions always write identity(). */
function legacyIdentity(document: CalculatorDocument, context: TravelerCrossEntityCastContext, hit: OrdinaryHit): string {
  const event = hit.travelerCrossEntityEvent, state = hitState(context, hit);
  return stable({event: event ?? {independentHitId: hit.id}, snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null,
    state: hit.element === "dendro" ? {...state, untransformedAtHit: state.untransformedAtHit ?? event?.untransformedAtHit} : null,
    talentLevel: document.gameContext?.effectiveTalentLevel, constellation: document.gameContext?.constellation,
    ascension: ascensionOf(document, hit), trueMoonStoryBuffInactive: context.trueMoonStoryBuffInactive});
}
const finalizedIdentityMatches = (document: CalculatorDocument, context: TravelerCrossEntityCastContext, hit: OrdinaryHit): boolean => {
  const saved = context.finalizedHitEvents?.[hit.id];
  return saved === identity(document, context, hit) || document.gameContext?.constellation === 0 && hit.element !== "pyro" && hit.element !== "hydro"
    && hit.element !== "cryo" && hit.element !== "electro" && saved === legacyIdentity(document, context, hit)
    && (!hit.finalSnapshot || hit.finalSnapshot.characterLevel === document.characterLevel);
};

function canonicalHit(document: CalculatorDocument, cast: TravelerCrossSourceTemplate, context: TravelerCrossEntityCastContext,
  previous?: OrdinaryHit, event?: TravelerCrossEntityHitInstance, roleOverride?: "tick" | "absorbed-tick"): OrdinaryHit {
  const role = cast.roles.tick, absorbed = (event?.templateRole ?? roleOverride) === "absorbed-tick";
  const id = event ? `${cast.skillId}:${event.id}` : absorbed ? absorbedSingleId(cast) : previous?.id ?? role.mappingId;
  const element = absorbed ? event?.absorbedElement ?? context.anemo?.absorptionElement : cast.element;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary",
    label: `${absorbed ? `风Q吸收附加 · ${element ?? "元素待明确"}` : role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    // Unknown elements are blocked below. Never turn an unknown absorbed hit
    // into a valid wind-damage calculation or copy the wind elemental bonus.
    element: element ?? "anemo", attackTag: "burst",
    terms: [{ stat: "atk", coefficient: absorbed ? travelerAnemoAbsorbedCoefficient(document.gameContext!.effectiveTalentLevel)! : role.values[document.gameContext!.effectiveTalentLevel - 1]! }],
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0,
    groupMultiplier: previous?.groupMultiplier ?? 1, critEligible: true,
    dependencies: [sourceId], sourceRefs: absorbed || cast.element === "anemo" ? [...new Set([...role.sourceRefs, ...TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS])] : role.sourceRefs,
  };
  if (cast.element === "dendro") {
    delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
    delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
    delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment;
  }
  delete hit.occurrence;
  delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.entityFollowupEvent;
  delete hit.extendedStanceEvent; delete hit.noellePlungeEvent; delete hit.mixedSourceEvent;
  delete hit.idleStanceEvent; delete hit.periodicOrdinaryEvent; delete hit.travelerMaleChargedEvent; delete hit.observedEntityEvent;
  if (event) {
    hit.travelerCrossEntityEvent = { candidateId: event.id, templateRole: event.templateRole, frame: event.frame,
      snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
      ...(event.absorbedElement === undefined ? {} : {absorbedElement: event.absorbedElement}),
      ...(event.c6ActiveBeforeHit === undefined ? {} : {c6ActiveBeforeHit: event.c6ActiveBeforeHit}),
      ...(event.untransformedAtHit === undefined ? {} : { untransformedAtHit: event.untransformedAtHit }) };
    const declaredSnapshot = context.snapshots?.[event.snapshotId];
    const retainedConversion = previous?.finalSnapshot?.origin === "equipment-conversion" &&
      finalizedIdentityMatches(document, context, hit);
    if (declaredSnapshot) hit.finalSnapshot = structuredClone(declaredSnapshot);
    else if (!retainedConversion) delete hit.finalSnapshot;
    if (stable(previous?.travelerCrossEntityEvent) !== stable(hit.travelerCrossEntityEvent) ||
        declaredSnapshot && stable(declaredSnapshot) !== stable(previous?.finalSnapshot) ||
        previous?.finalSnapshot && !hit.finalSnapshot) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  } else delete hit.travelerCrossEntityEvent;
  return hit;
}

export function prepareTravelerCrossEntityCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document); if (!cast) return document;
  const result = structuredClone(document), game = gameOf(result)!;
  const context: TravelerCrossEntityCastContext = travelerCrossEntityCastContextSchema.parse(game.travelerCrossEntityCast ?? {});
  game.travelerCrossEntityCast = context;
  const source = travelerCrossEntitySourceSchedule(cast.skillId as TravelerCrossEntityCastKind);
  const previousHits = result.hits, selected = new Set(result.selectedHitIds);
  const selectedAll = previousHits.every(hit => selected.has(hit.id));
  const old = new Map(previousHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const representative = [...old.values()].find(hit => !hit.travelerCrossEntityEvent && hit.id === cast.roles.tick.mappingId);
  const refs = source.dendro ? cast.roles.tick.sourceRefs : [...new Set([...cast.roles.tick.sourceRefs, ...TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS])];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "跨源明确裁决：两性各自Optimizer全15级倍率与目录精确一致，gcsim仅作为行为来源，原冲突向量保留；不是当前游戏实测或自动团队支持。", sourceRefs: refs });
  const missing = previousHits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  if (source.dendro && game.constellation !== 0) missing.push("此草灯来源协议仅覆盖C0，不能忽略更高命座的持续时间或减抗。");
  if (!source.dendro && game.constellation > TRAVELER_ANEMO_MAX_CONSTELLATION) missing.push("此风Q来源协议超出已审阅命座范围，不能降为低命座代算。");
  const sourceScope = travelerAnemoConstellationScope(result);
  if (sourceScope && !sourceScope.allowed) missing.push(sourceScope.reason);
  if (context.trueMoonStoryBuffInactive !== true) missing.push("请明确本击真月剧情增益关闭；本协议不会自动添加或删除剧情面板。");
  if (game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15 || !Number.isInteger(game.effectiveTalentLevel)) {
    const id = `${prefix}talent-level`;
    result.dependencies.push({ id, status: "missing", reason: "实际有效Q天赋须在独立来源1至15级内，不回退为一级或零倍率。", sourceRefs: refs });
    result.hits.forEach(hit => { hit.dependencies = [...new Set([...hit.dependencies, id])]; });
    game.scopeCoverage = "selected-components"; return result;
  }
  const representatives = () => [canonicalHit(result, cast, context, representative)];
  let independentId: string | undefined;
  if (result.scope === "single-hit") {
    const independent = context.independentEvent;
    if (independent) {
      const event: TravelerCrossEntityHitInstance = { id: independent.candidateId, templateRole: independent.templateRole,
        frame: independent.frame, snapshotFrame: independent.snapshotFrame, snapshotId: independent.snapshotId, targetId: independent.targetId,
        ...(independent.absorbedElement === undefined ? {} : {absorbedElement: independent.absorbedElement}),
        ...(independent.c6ActiveBeforeHit === undefined ? {} : {c6ActiveBeforeHit: independent.c6ActiveBeforeHit}),
        ...(independent.untransformedAtHit === undefined ? {} : { untransformedAtHit: independent.untransformedAtHit }) };
      independentId = `${cast.skillId}:${event.id}`;
      result.hits = [...old.values()].filter(hit => hit.id !== independentId);
      result.hits.push(canonicalHit(result, cast, context, old.get(independentId) ?? (event.templateRole === "tick" ? representative : undefined), event));
    } else if (!source.dendro && context.anemo?.singleHitRole !== undefined) {
      const absorbed = context.anemo.singleHitRole === "absorbed-tick", id = absorbed ? absorbedSingleId(cast) : cast.roles.tick.mappingId;
      independentId = id;
      result.hits = [canonicalHit(result, cast, context, old.get(id), undefined, context.anemo.singleHitRole)];
    } else result.hits = old.size ? [...old.values()].map(hit => {
      const saved = hit.travelerCrossEntityEvent;
      if (!saved && hit.id !== cast.roles.tick.mappingId && hit.id !== absorbedSingleId(cast)) return hit;
      return canonicalHit(result, cast, context, hit, saved ? { id: saved.candidateId, templateRole: saved.templateRole,
        frame: saved.frame, snapshotFrame: saved.snapshotFrame, snapshotId: saved.snapshotId, targetId: saved.targetId,
        ...(saved.absorbedElement === undefined ? {} : {absorbedElement: saved.absorbedElement}),
        ...(saved.c6ActiveBeforeHit === undefined ? {} : {c6ActiveBeforeHit: saved.c6ActiveBeforeHit}),
        ...(saved.untransformedAtHit === undefined ? {} : { untransformedAtHit: saved.untransformedAtHit }) } : undefined,
      hit.id === absorbedSingleId(cast) ? "absorbed-tick" : "tick");
    }) : representatives();
  } else {
    const schedule = compileTravelerCrossEntitySchedule(cast.skillId as TravelerCrossEntityCastKind, context, game.constellation);
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonicalHit(result, cast, context,
      old.get(`${cast.skillId}:${event.id}`) ?? (event.templateRole === "tick" ? representative : undefined), event)) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, kind: "non-damaging", label: "本次完整实体日程没有命中所选目标",
      reason: "每个来源候选均已明确落空，不以自动索敌或范围存在代替实际接触。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [independentId ?? retained[0] ?? result.hits[0]!.id]
    : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, issues: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击来源、实际取样和已含被动份额明确。", sourceRefs: refs });
    hits.forEach(hit => hit.dependencies = [...new Set([...hit.dependencies, id])]);
  };
  dependency(`${prefix}schedule`, [...new Set(missing)], result.hits);
  for (const genericHit of result.hits) if (genericHit.kind === "ordinary") {
    const hit = genericHit as OrdinaryHit, event = hit.travelerCrossEntityEvent, issues: string[] = [];
    const state = hitState(context, hit);
    const absorbed = event?.templateRole === "absorbed-tick" || hit.id === absorbedSingleId(cast);
    if (!event && hit.id !== cast.roles.tick.mappingId && !(!source.dendro && absorbed)) issues.push("本击不是当前来源动作的倍率模板或已保存事件。");
    if (event) {
      if (source.dendro && event.templateRole !== "tick" || !source.frames.includes(event.frame) || event.snapshotFrame !== source.snapshotFrame) issues.push("本击的伤害帧或取样帧不属于当前固定来源分支。");
      if (event.templateRole === "tick" && event.absorbedElement !== undefined) issues.push("风本体不能冒用吸收附加的元素记录。");
      if (context.targetId && event.targetId !== context.targetId) issues.push("本击目标与当前明确目标不同，不能沿用旧接触记录。");
      if (result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) issues.push(`缺少实际第${source.snapshotFrame}帧快照${event.snapshotId}；不能用命中时或其他时点面板代替。`);
      if (result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot) issues.push("本击原快照已移除或失效；请提供本击实际快照或重新应用构筑，不能静默改用当前面板。");
    }
    if (context.finalizedHitEvents && !finalizedIdentityMatches(result, context, hit)) issues.push("本击事件、历史快照、角色等级或实时被动状态已改变，旧物化属性不可沿用；请重新应用构筑或输入实际面板。");
    if (!absorbed && hit.reaction !== "none") issues.push("风／草本体不能使用蒸发或融化倍率；额外扩散等反应单独归属。");
    if (hit.additiveReaction !== undefined && (cast.element !== "dendro" || hit.additiveReaction !== "spread")) issues.push("此来源伤害只允许草本体明确采用蔓激化，不能套用其他元素激化。");
    if (!source.dendro) {
      const hitScope = travelerAnemoConstellationScope(result, hit);
      if (hitScope && !hitScope.allowed) issues.push(hitScope.reason);
      if (hit.finalSnapshot && hit.finalSnapshot.characterLevel !== result.characterLevel) issues.push("本击历史快照角色等级与当前角色等级不同，不能显示旧等级伤害却标为新等级。");
      if (hit.baseDamageFormula) issues.push("固定风Q使用来源ATK倍率，不接受基础伤害公式覆盖。");
      if (hit.groupMultiplier !== 1) issues.push("风Q已逐击声明实际命中，命中倍率必须为1，不能复制未声明实例。");
      if (absorbed) {
        const element = event?.absorbedElement ?? context.anemo?.absorptionElement;
        if (!element) issues.push("实际吸收附加需要明确火、水、冰或雷元素，未知不能当风伤或零伤害。");
        const validReactions = element === "pyro" ? ["none", "melt", "reverseVaporize"] : element === "hydro" ? ["none", "vaporize"] : element === "cryo" ? ["none", "reverseMelt"] : ["none"];
        if (!validReactions.includes(hit.reaction)) issues.push("所选增幅反应与本次实际吸收伤害元素不匹配；反应须由本击实际发生，不能套用其他元素倍率。");
        if (context.anemo?.noAbsorption !== false) issues.push("所选吸收附加须明确本次Q实际发生过吸收，不能与无吸收或未知分支混用。");
        if (event?.absorbedElement && context.anemo?.absorptionElement && event.absorbedElement !== context.anemo.absorptionElement) issues.push("本击实际吸收元素与本次Q已锁定元素不同，不能变更已发生的吸收。");
        if (element && !hit.finalSnapshot && !context.finalizedHitEvents) {
          if (result.build.mode === "equipment-derived") hit.damageBonus = 0; // Real element filters are resolved by the equipment core.
          else {
            const bonus = context.anemo?.elementDamageBonuses?.[element] ??
              (result.build.mode === "imported-final" ? game.importedPanelDamageBonuses?.[element] : undefined);
            if (bonus === undefined || bonus === null) issues.push("缺少本次Q起手时吸收元素的实际最终伤害加成；未知不能取0或沿用风元素加成。");
            else hit.damageBonus = bonus;
          }
        }
      }
      const start = context.anemo?.absorptionStartFrame;
      if (start !== undefined && !TRAVELER_ANEMO_ABSORPTION_CHECK_FRAMES.includes(start)) issues.push("首次吸收必须是39+18n（n=0至17）的真实来源检查帧。");
      if (absorbed && start !== undefined && (event ? start > event.frame : start > source.frames.at(-1)!)) issues.push("本击发生在成功吸收之前，来源不会生成这一条吸收附加伤害。");
      if (hit.resistanceReductionFormula?.ruleId === c6RuleId) delete hit.resistanceReductionFormula;
      if (game.constellation >= 6) {
        const active = event?.c6ActiveBeforeHit ?? state.c6ActiveBeforeHit;
        if (active === undefined) issues.push("请明确本击结算前所选敌人是否已存在对应元素C6减抗；本击随后挂上的减抗不能倒灌。");
        if (event?.c6ActiveBeforeHit !== undefined && state.c6ActiveBeforeHit !== undefined && event.c6ActiveBeforeHit !== state.c6ActiveBeforeHit) issues.push("本击记录的减抗时序与所填实际C6状态冲突，不能覆盖来源回调先后。");
        if (state.includedC6ResistanceReduction === undefined) issues.push("请明确敌人抗性输入已含的本命座减抗份额；明确未含填0。");
        if (hit.resistanceReductionFormula) issues.push("C6减抗公式槽已有外来公式，未定义合并规则，不能静默覆盖。");
        if (active !== undefined && state.includedC6ResistanceReduction !== undefined && !hit.resistanceReductionFormula) {
          hit.resistanceReductionFormula = {ruleId: c6RuleId, label: "风主C6：本击前已生效减抗−输入已含份额",
            expression: expr.sub(expr.mul(expr.input("activeBeforeHit"), expr.value(.2)), expr.input("includedReduction")),
            inputs: [{key: "activeBeforeHit", value: Number(active), unit: "boolean", origin: "actual-before-hit-target-state", meaningKey: "本击伤害计算之前该元素C6减抗已经存在，绝不计入本击事后回调"},
              {key: "includedReduction", value: state.includedC6ResistanceReduction, unit: "ratio", origin: "explicit-resistance-accounting", meaningKey: "当前敌人抗性输入已经扣除的本命座减抗份额"}],
            requirements: {minimumConstellation: 6, maximumConstellation: 6, attackTags: ["burst"]}, sourceRefs: TRAVELER_ANEMO_ABSORPTION_SOURCE_REFS};
        }
      } else if (state.c6ActiveBeforeHit === true || (state.includedC6ResistanceReduction ?? 0) !== 0 || event?.c6ActiveBeforeHit === true) {
        issues.push("C6以下不能沿用该旅行者本命座减抗或它的已含份额。");
      }
    }
    if (source.dendro) {
      if (result.scope === "single-hit" && (state.untransformedAtHit ?? event?.untransformedAtHit) !== true) issues.push("独立草灯命中须明确本击仍未转化；不要求未来生命周期记录。");
      const ascension = ascensionOf(result, hit);
      if (ascension === undefined) issues.push("需要实际突破阶段，以判断草旅行者A4。");
      if (state.includedA4DamageBonus === undefined) issues.push("请明确本击增伤已经包含的草旅行者A4份额；0表示明确未含。");
      if (ascension !== undefined && ascension >= 4) {
        if (state.actualEm === undefined) issues.push("草A4读取命中时的实际精通，需要与54帧进攻快照分开的实时EM。");
        if (state.actualEmIncludesLotuslight !== true) issues.push("请确认实时EM已正确包含本击当时有效的草灯A1；不从快照或固定层数推测。");
      }
      if (ascension !== undefined && state.includedA4DamageBonus !== undefined && (ascension < 4 || state.actualEm !== undefined)) {
        const inputs: CalculatorFormula["inputs"] = [{ key: "includedA4", value: state.includedA4DamageBonus, unit: "ratio", origin: "explicit-panel-accounting", meaningKey: "本击进攻快照或手动增伤中已经包含的草A4份额" }];
        if (ascension >= 4) inputs.push({ key: "impactEm", value: state.actualEm!, unit: "EM", origin: "actual-impact-state", meaningKey: "伤害结算时旅行者的实际精通，包含当时真实有效的自身A1与其他增益" });
        hit.damageBonusFormula = { ruleId: `${prefix}dendro-a4`, label: "草旅行者A4：命中时实际EM×0.001−已含份额",
          expression: expr.sub(ascension < 4 ? expr.value(0) : expr.mul(expr.input("impactEm"), expr.value(.001)), expr.input("includedA4")), inputs, sourceRefs: refs };
      }
    }
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const relevant = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(row => relevant.has(row.id) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : ready && result.selectedHitIds.length === result.hits.length ? "complete-cast" : "selected-components";
  game.attributionPolicy = source.dendro ? "C0草灯无转化的所选目标自身伤害；草54帧锁进攻面板，草A4另用命中时EM；不自动合并反应实体、队友、治疗或能量。" :
    "风主C0–C6本次Q自身直接伤害：风本体与吸收附加均0帧锁进攻面板，逐元素使用实际增伤；吸收只从实际成功检查后的机会生成。先风后同帧吸收，再各自C6命中回调；未命中不挂，20%按元素刷新不叠。有效Q等级已含C3，不再增加；不自动合并扩散等反应实体、队友、治疗或能量。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("风草跨源协议：")),
    "风草跨源协议：倍率采用两性独立Optimizer精确向量，保留gcsim冲突向量；只有行为使用固定gcsim来源，未宣称当前游戏实测。",
    "风草跨源协议：完整施放需要全日程实际接触和完整观察；独立本击不读取未来日程，草灯A4实时EM不等于54帧快照EM。"];
  if (!source.dendro) {
    const currentScopeText = new Map([
      ["C0；显式新鲜施放，true_moon_story_buff关闭；无卡肉、中断、重复施放或实体替换。", "风Q当前规则覆盖C0–C6；本击剧情增益明确关闭。完整来源日程仍要求新鲜施放、无卡肉、中断、替换，独立单击不要求未来记录。"],
      ["C0 条件；有效天赋等级显式输入，不自动增加命座等级。", "风Q当前命座范围C0–C6；有效Q等级显式输入并已含C3，不自动再次增加等级。"],
      ["风Q仅全程无元素吸收；草Q仅全程无元素转化。其他分支与历史冲突保持独立证据，不据此宣称所有旅行者动作均已解除限制。", "旧无吸收风Q模板已由当前固定规则扩展到实际吸收及C0–C6；草Q仍仅C0无转化，其他旅行者动作与历史冲突限制保留。"],
      ["全程明确无元素吸收；显式输入九次来源候选的接触记录，风息激荡进攻属性在施放第0帧取样。", "风Q按实际无吸收或首次成功吸收分支生成候选；风与吸收附加均在第0帧冻结属性，实际接触分别声明，不保证九次附加命中。"],
      ["风主A1仅作用于普攻末段风刃，A4仅由战技击杀触发治疗；本C0无吸收Q没有由两者新增的直接伤害项。", "风主A1风刃和A4战技击杀治疗不新增本次Q直接伤害；C6只按本击前已存在的对应元素减抗结算，事后回调不倒灌。"],
    ]);
    result.assumptions = result.assumptions.map(row => currentScopeText.get(row) ?? row);
    result.assumptions = [...result.assumptions.filter(row => !row.startsWith("风Q共同抗性：")),
      "风Q共同抗性：敌人抗性输入明确用于本次所选各元素，不是由敌人库推断；若风和吸收元素实际抗性不同，请按对应元素单击分别填写。"];
  }
  return result;
}

export function resetTravelerCrossEntityPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const cast = templateOf(document); if (!cast) return;
  const game = gameOf(document)!, context = game.travelerCrossEntityCast ??= {};
  delete context.finalizedHitEvents;
  for (const genericHit of document.hits) if (genericHit.kind === "ordinary") {
    const hit = genericHit as OrdinaryHit;
    if (hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
    if (cast.element === "dendro" && !hit.finalSnapshot) {
      const state = (context.hitStates ??= {})[hit.id] ??= {};
      if (mode === "fresh-equipment") state.includedA4DamageBonus = 0;
      else delete state.includedA4DamageBonus;
    }
  }
  if (cast.element === "dendro") {
    if (mode === "fresh-equipment") (context.sharedState ??= {}).includedA4DamageBonus = 0;
    else if (context.sharedState) delete context.sharedState.includedA4DamageBonus;
  }
}

export function finalizeTravelerCrossEntityPanelAccounting(document: CalculatorDocument): void {
  if (!isTravelerCrossEntityCastAction(document)) return;
  const context = gameOf(document)!.travelerCrossEntityCast ??= {};
  // The converter materializes equipment/common damage bonus, not this live
  // character AttackMod. Its includedA4 share therefore stays unchanged.
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary")
    .map(hit => [hit.id, identity(document, context, hit)]));
}

export function travelerCrossEntityEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary") return [];
  const event = (hit as OrdinaryHit).travelerCrossEntityEvent;
  if (!event) return [];
  const trace = new TraceBuilder(hit.sourceRefs);
  for (const [key, value, label] of [["frame", event.frame, "本击实际来源帧"], ["snapshotFrame", event.snapshotFrame, "来源冻结进攻面板帧"]] as const) {
    trace.add(`${prefix}${key}`, label, expr.input(key), [traceInput(key, value, "frames", "fixed-source-cross-entity", `${event.candidateId}，目标${event.targetId}，快照${event.snapshotId}`)], { unit: "frames" });
  }
  return trace.nodes;
}
