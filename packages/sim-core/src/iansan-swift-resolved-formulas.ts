import { iansanSwiftResolvedTemplates, type IansanSwiftResolvedTemplate } from "../../game-data/src/character-mappings/iansan-swift-resolved-mappings";
import {
  iansanSwiftResolvedCastContextSchema, type IansanSwiftResolvedCastContext,
  type CalculatorDocument, type CalculatorHit, type CalculatorFormula,
} from "./calculator-model";
import type { IansanSwiftResolvedHitState } from "./iansan-swift-resolved-context";
import { compileIansanSwiftResolvedSchedule, type IansanSwiftResolvedCastKind, type IansanSwiftResolvedHitInstance } from "./iansan-swift-resolved-schedule";
import { expr, evaluateFormulaExpression, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const prefix = "iansan-swift-resolved:", sourceId = `${prefix}source`;
const templateOf = (doc: CalculatorDocument) => iansanSwiftResolvedTemplates.find(cast => cast.skillId === doc.gameContext?.skillId);
export const isIansanSwiftResolvedCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const stateOf = (cast: IansanSwiftResolvedTemplate, context: IansanSwiftResolvedCastContext, hit: OrdinaryHit): IansanSwiftResolvedHitState =>
  ({ ...context.sharedState, ...context.hitStates?.[cast.roles.swift.mappingId], ...context.hitStates?.[hit.id] });
const ascensionOf = (doc: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ??
  (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;

/** Future E/NS lifetimes and future buff users never enter an independent hit's identity. */
function identity(doc: CalculatorDocument, context: IansanSwiftResolvedCastContext, hit: OrdinaryHit): string {
  const event = hit.iansanSwiftResolvedEvent, state = stateOf(templateOf(doc)!, context, hit);
  return stable({ event: event ?? { independentHitId: hit.id },
    snapshot: context.snapshots?.[event?.snapshotId ?? "snapshot-25"] ?? null,
    state: { ...state, swiftQualifiedAtCast: state.swiftQualifiedAtCast ?? event?.swiftQualifiedAtCast },
    talentLevel: doc.gameContext?.effectiveTalentLevel, constellation: doc.gameContext?.constellation,
    ascension: ascensionOf(doc, hit), characterLevel: hit.finalSnapshot?.characterLevel ?? doc.characterLevel });
}

function canonicalHit(doc: CalculatorDocument, cast: IansanSwiftResolvedTemplate, context: IansanSwiftResolvedCastContext,
  previous?: OrdinaryHit, event?: IansanSwiftResolvedHitInstance): OrdinaryHit {
  const role = cast.roles.swift, id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary",
    label: `${role.label}${event ? " · 第25帧" : " · 独立已发生命中"}`,
    element: "electro", attackTag: "charged",
    terms: [{ stat: "atk", coefficient: role.values[doc.gameContext!.effectiveTalentLevel - 1]! }],
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
  delete hit.idleStanceEvent; delete hit.periodicOrdinaryEvent; delete hit.travelerMaleChargedEvent;
  delete hit.observedEntityEvent; delete hit.travelerCrossEntityEvent; delete hit.travelerCryoStateEvent; delete hit.zibaiFiniteEvent;
  if (event) hit.iansanSwiftResolvedEvent = { candidateId: event.id, templateRole: "swift", frame: event.frame,
    snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
    ...(event.swiftQualifiedAtCast === undefined ? {} : { swiftQualifiedAtCast: event.swiftQualifiedAtCast }) };
  else delete hit.iansanSwiftResolvedEvent;
  const declaredSnapshot = context.snapshots?.[event?.snapshotId ?? "snapshot-25"];
  const retainedConversion = previous?.finalSnapshot?.origin === "equipment-conversion" &&
    context.finalizedHitEvents?.[id] === identity(doc, context, hit);
  if (declaredSnapshot) hit.finalSnapshot = structuredClone(declaredSnapshot);
  else if (!retainedConversion) delete hit.finalSnapshot;
  if (stable(previous?.iansanSwiftResolvedEvent) !== stable(hit.iansanSwiftResolvedEvent) ||
      declaredSnapshot && stable(declaredSnapshot) !== stable(previous?.finalSnapshot) ||
      previous?.finalSnapshot && !hit.finalSnapshot) {
    delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
  }
  return hit;
}

/** Prior A1 is ATK%, hence 0.2 × actual base ATK; the current hit's callback is later. */
function prepareA1(doc: CalculatorDocument, hit: OrdinaryHit, state: IansanSwiftResolvedHitState, issues: string[]): void {
  const ascension = ascensionOf(doc, hit);
  if (ascension === undefined) { issues.push("需要实际突破阶段，以判断伊安珊A1是否已解锁。"); return; }
  if (ascension < 1 && state.a1ActiveAtSnapshot === true) issues.push("未解锁A1时不能声明其攻击增益有效。");
  if (ascension >= 1 && state.a1ActiveAtSnapshot === undefined) issues.push("请明确25帧快照时先前A1是否有效；本击新授予的A1不增幅自身。");
  if (hit.finalSnapshot) {
    if (hit.finalSnapshot.origin !== "equipment-conversion" && state.snapshotIncludesActualA1 !== true) {
      issues.push("历史最终快照须明确已包含25帧实际先前A1；不能在冻结后的ATK上再次添加。");
    }
    return;
  }
  if (state.includedA1Attack === undefined) { issues.push("请明确输入ATK中已含的自身A1攻击力数值；0表示明确未含。"); return; }
  const active = ascension >= 1 && state.a1ActiveAtSnapshot === true;
  const inputs: CalculatorFormula["inputs"] = [{ key: "includedA1Attack", value: state.includedA1Attack,
    unit: "ATK", origin: "explicit-panel-accounting", meaningKey: "本击输入攻击力已经包含的伊安珊A1固定ATK份额" }];
  let base: FormulaExpression | undefined;
  if (active) {
    if (doc.build.mode === "equipment-derived") {
      base = expr.add(expr.input("characterBaseAtk"), expr.input("weaponBaseAtk"));
      inputs.push({ key: "characterBaseAtk", value: doc.build.characterBaseAtk, unit: "ATK", origin: "equipment-base-stat", meaningKey: "角色基础攻击力" },
        { key: "weaponBaseAtk", value: doc.build.weaponBaseAtk, unit: "ATK", origin: "equipment-base-stat", meaningKey: "武器基础攻击力" });
    } else if (state.baseAttack !== undefined) {
      base = expr.input("actualBaseAttack");
      inputs.push({ key: "actualBaseAttack", value: state.baseAttack, unit: "ATK", origin: "explicit-actual-state", meaningKey: "该25帧快照角色与武器基础攻击力之和，不能从最终ATK反推" });
    } else issues.push("先前A1有效时需要实际基础攻击力；最终ATK不能替代白字基础攻击。");
  }
  if (!active || base) hit.attackAdjustment = { accounting: "add-to-panel", formula: {
    ruleId: `${prefix}prior-a1`, label: "伊安珊先前A1：实际20%基础攻击−输入已含ATK",
    expression: expr.sub(active ? expr.mul(expr.value(.2), base!) : expr.value(0), expr.input("includedA1Attack")),
    inputs, sourceRefs: hit.sourceRefs,
  } };
}

export function prepareIansanSwiftResolvedCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document); if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context: IansanSwiftResolvedCastContext = iansanSwiftResolvedCastContextSchema.parse(game.iansanSwiftResolvedCast ?? {});
  game.iansanSwiftResolvedCast = context;
  const previousHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = previousHits.every(hit => selected.has(hit.id));
  const old = new Map(previousHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const representative = old.get(cast.roles.swift.mappingId), refs = cast.roles.swift.sourceRefs;
  const missing = previousHits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "普通攻击等级绑定由固定Optimizer实际求值链独立裁决；15级倍率与目录精确相等。gcsim只提供动作行为，原E索引冲突完整保留，未宣称当前游戏实测。", sourceRefs: refs });
  if (game.characterId !== "character:10000110" || game.abilityId !== "talent:iansan:combat1") missing.push("本协议仅属于伊安珊普通攻击天赋下的雷霆飞缒，不能套用E或其他角色天赋等级。");
  if (game.constellation !== 0) missing.push("本限定协议仅覆盖C0，不能忽略更高命座的伤害或攻击力修改。");
  if (!Number.isInteger(game.effectiveTalentLevel) || game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) {
    const id = `${prefix}talent-level`;
    result.dependencies.push({ id, status: "missing", reason: "需要1至15级的实际普通攻击天赋等级，不能回退为E等级或一级。", sourceRefs: refs });
    result.hits.forEach(hit => { hit.dependencies = [...new Set([...hit.dependencies, id])]; });
    game.scopeCoverage = "selected-components"; return result;
  }
  let independentId: string | undefined;
  if (result.scope === "single-hit") {
    const independent = context.independentEvent;
    if (independent) {
      const event: IansanSwiftResolvedHitInstance = { id: independent.candidateId, templateRole: independent.templateRole,
        frame: independent.frame, snapshotFrame: independent.snapshotFrame, snapshotId: independent.snapshotId,
        targetId: independent.targetId, ...(independent.swiftQualifiedAtCast === undefined ? {} : { swiftQualifiedAtCast: independent.swiftQualifiedAtCast }) };
      independentId = `${cast.skillId}:${event.id}`;
      result.hits = [...old.values()].filter(hit => hit.id !== independentId);
      result.hits.push(canonicalHit(result, cast, context, old.get(independentId) ?? representative, event));
    } else result.hits = old.size ? [...old.values()].map(hit => {
      const saved = hit.iansanSwiftResolvedEvent;
      if (!saved && hit.id !== cast.roles.swift.mappingId) return hit;
      return canonicalHit(result, cast, context, hit, saved ? { id: saved.candidateId, templateRole: saved.templateRole,
        frame: saved.frame, snapshotFrame: saved.snapshotFrame, snapshotId: saved.snapshotId, targetId: saved.targetId,
        ...(saved.swiftQualifiedAtCast === undefined ? {} : { swiftQualifiedAtCast: saved.swiftQualifiedAtCast }) } : undefined);
    }) : [canonicalHit(result, cast, context)];
  } else {
    const schedule = compileIansanSwiftResolvedSchedule(cast.skillId as IansanSwiftResolvedCastKind, context);
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonicalHit(result, cast, context,
      old.get(`${cast.skillId}:${event.id}`) ?? representative, event)) : [canonicalHit(result, cast, context, representative)];
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, kind: "non-damaging", label: "本次雷霆飞缒明确未命中所选目标",
      reason: "唯一来源候选已经明确落空，不以自动索敌或攻击范围代替接触。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [independentId ?? retained[0] ?? result.hits[0]!.id]
    : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, issues: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击普通攻击等级、实际资格和25帧先前被动记账明确。", sourceRefs: refs });
    hits.forEach(hit => { hit.dependencies = [...new Set([...hit.dependencies, id])]; });
  };
  dependency(`${prefix}schedule`, [...new Set(missing)], result.hits);
  for (const hit of result.hits) if (hit.kind === "ordinary") {
    const event = hit.iansanSwiftResolvedEvent, state = stateOf(cast, context, hit), issues: string[] = [];
    if (!event && hit.id !== cast.roles.swift.mappingId) issues.push("本击不是当前Swift来源模板或已保存事件。");
    if (event && (event.candidateId !== "swift" || event.templateRole !== "swift" || event.frame !== 25 || event.snapshotFrame !== 25 || event.snapshotId !== "snapshot-25")) {
      issues.push("本击必须是本次起手后25帧的Swift，并在同一25帧取样。");
    }
    if (event && context.targetId && event.targetId !== context.targetId) issues.push("本击实际目标与当前明确目标不同，旧接触记录不可沿用。");
    if ((state.swiftQualifiedAtCast ?? event?.swiftQualifiedAtCast) !== true) issues.push("请明确本击起手时已经满足Swift分支资格；独立命中不要求未来夜魂或E生命周期。");
    if (state.burstInactiveAtSnapshot !== true) issues.push("本限定分支须明确25帧时伊安珊Q攻击力反馈状态未生效。");
    if (result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.["snapshot-25"]) issues.push("需要实际25帧进攻快照，或明确当前输入面板就是该时点稳定面板。");
    const prior = old.get(hit.id) ?? representative;
    if (prior?.finalSnapshot && !hit.finalSnapshot) issues.push("本击原历史或转换快照已移除／失效，请重新应用构筑或提供实际快照，不能静默改用当前面板。");
    if ((context.finalizedHitEvents || hit.finalSnapshot?.origin === "equipment-conversion") &&
        context.finalizedHitEvents?.[hit.id] !== identity(result, context, hit)) issues.push("本击事件、等级、快照或A1状态已改变，或缺少转换身份；旧物化属性不可沿用，请重新应用构筑或输入实际面板。");
    if (hit.reaction !== "none") issues.push("雷元素Swift本体不能套用蒸发或融化倍率；额外反应需独立归属。");
    if (hit.additiveReaction !== undefined && hit.additiveReaction !== "aggravate") issues.push("雷元素Swift只允许明确的超激化附加，不能采用蔓激化。");
    prepareA1(result, hit, state, issues);
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const relevant = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(row => relevant.has(row.id) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : ready && result.selectedHitIds.length === result.hits.length ? "complete-cast" : "selected-components";
  game.attributionPolicy = "C0一次实际雷霆飞缒自身伤害；普通攻击天赋等级，起手资格明确，25帧取样及命中，先前A1独立记账且Q反馈关闭；不自动合并此前E、普攻、之后A1受益动作、治疗或夜魂生命周期。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("伊安珊Swift协议：")),
    "伊安珊Swift协议：固定Optimizer的auto[4]通过autoIndex读取普通攻击等级，全部15级精确匹配目录；保留gcsim使用E等级的原始冲突，不要求两天赋同级。",
    "伊安珊Swift协议：当前命中回调在伤害后授予A1，20%ATK只适用25帧已有的实际A1；独立本击不读取未来日程，完整动作不等于完整E或夜魂轮转。"];
  return result;
}

export function resetIansanSwiftResolvedPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  const cast = templateOf(document); if (!cast) return;
  const context = document.gameContext!.iansanSwiftResolvedCast ??= {};
  delete context.finalizedHitEvents;
  for (const [id, snapshot] of Object.entries(context.snapshots ?? {})) if (snapshot.origin === "equipment-conversion") delete context.snapshots![id];
  for (const hit of document.hits) if (hit.kind === "ordinary") {
    const declared = context.snapshots?.[hit.iansanSwiftResolvedEvent?.snapshotId ?? "snapshot-25"];
    if (hit.finalSnapshot?.origin === "equipment-conversion" || !declared) delete hit.finalSnapshot;
  }
  // Include template-key overrides as well as expanded event IDs, so an old
  // template's amount cannot reappear after re-expansion or final-panel import.
  for (const state of [context.sharedState ??= {}, ...Object.values(context.hitStates ?? {})]) {
    if (mode === "fresh-equipment") state.includedA1Attack = 0;
    else delete state.includedA1Attack;
  }
}

export function finalizeIansanSwiftResolvedPanelAccounting(document: CalculatorDocument): void {
  if (!isIansanSwiftResolvedCastAction(document)) return;
  const context = document.gameContext!.iansanSwiftResolvedCast ??= {};
  // The common final panel does not contain per-hit attack adjustments. Preserve
  // the known base ATK before equipment fields disappear, using the same AST as
  // the source formula. Actual converted snapshots already contain the change.
  if (document.build.mode === "equipment-derived") {
    const baseAttack = evaluateFormulaExpression(expr.add(expr.input("characterBaseAtk"), expr.input("weaponBaseAtk")),
      { characterBaseAtk: document.build.characterBaseAtk, weaponBaseAtk: document.build.weaponBaseAtk });
    for (const hit of document.hits) if (hit.kind === "ordinary" && !hit.finalSnapshot) {
      ((context.hitStates ??= {})[hit.id] ??= {}).baseAttack = baseAttack;
    }
  }
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary")
    .map(hit => [hit.id, identity(document, context, hit)]));
}

export function iansanSwiftResolvedEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.iansanSwiftResolvedEvent) return [];
  const event = hit.iansanSwiftResolvedEvent, trace = new TraceBuilder(hit.sourceRefs);
  for (const [key, value, label] of [["frame", event.frame, "Swift实际伤害帧"], ["snapshotFrame", event.snapshotFrame, "Swift实际进攻取样帧"]] as const) {
    trace.add(`${prefix}${key}`, label, expr.input(key), [traceInput(key, value, "frames", "fixed-iansan-action-source", `本次Swift；目标${event.targetId}；快照${event.snapshotId}`)], { unit: "frames" });
  }
  trace.add(`${prefix}a1-order`, "本次新A1在伤害后授予", expr.value(0), [], { unit: "ATK", status: "not-applicable",
    applicabilityReason: "25帧先取样并结算Swift，之后才运行敌人命中A1回调；本次新授予的20%ATK不能增幅自身，先前A1按实际取样另行记账。" });
  return trace.nodes;
}
