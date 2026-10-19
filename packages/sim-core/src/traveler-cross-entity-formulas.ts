import { travelerCrossSourceTemplates, type TravelerCrossSourceTemplate } from "../../game-data/src/character-mappings/traveler-cross-source-mappings";
import { travelerCrossEntityCastContextSchema, type TravelerCrossEntityCastContext, type CalculatorDocument, type CalculatorHit, type CalculatorFormula } from "./calculator-model";
import type { TravelerCrossEntityHitState } from "./traveler-cross-entity-context";
import { compileTravelerCrossEntitySchedule, travelerCrossEntitySourceSchedule, type TravelerCrossEntityCastKind, type TravelerCrossEntityHitInstance } from "./traveler-cross-entity-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

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

function identity(document: CalculatorDocument, context: TravelerCrossEntityCastContext, hit: OrdinaryHit): string {
  const event = hit.travelerCrossEntityEvent, state = hitState(context, hit);
  return stable({ event: event ?? { independentHitId: hit.id },
    snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null,
    state: hit.element === "dendro" ? { ...state, untransformedAtHit: state.untransformedAtHit ?? event?.untransformedAtHit } : null,
    talentLevel: document.gameContext?.effectiveTalentLevel,
    constellation: document.gameContext?.constellation, ascension: ascensionOf(document, hit),
    trueMoonStoryBuffInactive: context.trueMoonStoryBuffInactive });
}

function canonicalHit(document: CalculatorDocument, cast: TravelerCrossSourceTemplate, context: TravelerCrossEntityCastContext,
  previous?: OrdinaryHit, event?: TravelerCrossEntityHitInstance): OrdinaryHit {
  const role = cast.roles.tick, id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary",
    label: `${role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    element: cast.element, attackTag: "burst",
    terms: [{ stat: "atk", coefficient: role.values[document.gameContext!.effectiveTalentLevel - 1]! }],
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0,
    groupMultiplier: previous?.groupMultiplier ?? 1, critEligible: true,
    dependencies: [sourceId], sourceRefs: role.sourceRefs,
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment; delete hit.occurrence;
  delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.entityFollowupEvent;
  delete hit.extendedStanceEvent; delete hit.noellePlungeEvent; delete hit.mixedSourceEvent;
  delete hit.idleStanceEvent; delete hit.periodicOrdinaryEvent; delete hit.travelerMaleChargedEvent; delete hit.observedEntityEvent;
  if (event) {
    hit.travelerCrossEntityEvent = { candidateId: event.id, templateRole: "tick", frame: event.frame,
      snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
      ...(event.untransformedAtHit === undefined ? {} : { untransformedAtHit: event.untransformedAtHit }) };
    const declaredSnapshot = context.snapshots?.[event.snapshotId];
    const retainedConversion = previous?.finalSnapshot?.origin === "equipment-conversion" &&
      context.finalizedHitEvents?.[id] === identity(document, context, hit);
    if (declaredSnapshot) hit.finalSnapshot = structuredClone(declaredSnapshot);
    else if (!retainedConversion) delete hit.finalSnapshot;
    if (stable(previous?.travelerCrossEntityEvent) !== stable(hit.travelerCrossEntityEvent) ||
        declaredSnapshot && stable(declaredSnapshot) !== stable(previous?.finalSnapshot) ||
        previous?.finalSnapshot && !hit.finalSnapshot) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  }
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
  const refs = cast.roles.tick.sourceRefs;
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "跨源明确裁决：两性各自Optimizer全15级倍率与目录精确一致，gcsim仅作为行为来源，原冲突向量保留；不是当前游戏实测或自动团队支持。", sourceRefs: refs });
  const missing = previousHits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  if (game.constellation !== 0) missing.push("此完整来源协议仅覆盖C0，不能忽略更高命座的持续时间或减抗。");
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
        ...(independent.untransformedAtHit === undefined ? {} : { untransformedAtHit: independent.untransformedAtHit }) };
      independentId = `${cast.skillId}:${event.id}`;
      result.hits = [...old.values()].filter(hit => hit.id !== independentId);
      result.hits.push(canonicalHit(result, cast, context, old.get(independentId) ?? representative, event));
    } else result.hits = old.size ? [...old.values()].map(hit => {
      const saved = hit.travelerCrossEntityEvent;
      if (!saved && hit.id !== cast.roles.tick.mappingId) return hit;
      return canonicalHit(result, cast, context, hit, saved ? { id: saved.candidateId, templateRole: saved.templateRole,
        frame: saved.frame, snapshotFrame: saved.snapshotFrame, snapshotId: saved.snapshotId, targetId: saved.targetId,
        ...(saved.untransformedAtHit === undefined ? {} : { untransformedAtHit: saved.untransformedAtHit }) } : undefined);
    }) : representatives();
  } else {
    const schedule = compileTravelerCrossEntitySchedule(cast.skillId as TravelerCrossEntityCastKind, context);
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonicalHit(result, cast, context,
      old.get(`${cast.skillId}:${event.id}`) ?? representative, event)) : representatives();
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
    if (!event && hit.id !== cast.roles.tick.mappingId) issues.push("本击不是当前来源动作的倍率模板或已保存事件。");
    if (event) {
      if (event.templateRole !== "tick" || !source.frames.includes(event.frame) || event.snapshotFrame !== source.snapshotFrame) issues.push("本击的伤害帧或取样帧不属于当前固定来源分支。");
      if (context.targetId && event.targetId !== context.targetId) issues.push("本击目标与当前明确目标不同，不能沿用旧接触记录。");
      if (result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) issues.push(`缺少实际第${source.snapshotFrame}帧快照${event.snapshotId}；不能用命中时或其他时点面板代替。`);
      if (result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot) issues.push("本击原快照已移除或失效；请提供本击实际快照或重新应用构筑，不能静默改用当前面板。");
    }
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) issues.push("本击事件、历史快照或实时被动状态已改变，旧物化属性不可沿用；请重新应用构筑或输入实际面板。");
    if (hit.reaction !== "none") issues.push("风／草本体不能使用蒸发或融化倍率；额外扩散等反应单独归属。");
    if (hit.additiveReaction !== undefined && (cast.element !== "dendro" || hit.additiveReaction !== "spread")) issues.push("此来源伤害只允许草本体明确采用蔓激化，不能套用其他元素激化。");
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
  game.attributionPolicy = "C0风Q无吸收／草灯无转化的所选目标自身伤害；所有候选均有实际接触或落空。风0帧、草54帧锁进攻面板，草A4另用命中时EM；不自动合并反应实体、队友、治疗或能量。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("风草跨源协议：")),
    "风草跨源协议：倍率采用两性独立Optimizer精确向量，保留gcsim冲突向量；只有行为使用固定gcsim来源，未宣称当前游戏实测。",
    "风草跨源协议：完整施放需要全日程实际接触和完整观察；独立本击不读取未来日程，草灯A4实时EM不等于54帧快照EM。"];
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
