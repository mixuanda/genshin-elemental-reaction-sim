import definitions from "../../game-data/sources/idle-stance-casts/definitions.json";
import type { IdleStanceRole, IdleStanceTemplate } from "../../game-data/src/character-mappings/idle-stance-mappings";
import { idleStanceCastContextSchema, type CalculatorDocument, type CalculatorFormula, type CalculatorHit, type IdleStanceCastContext } from "./calculator-model";
import { compileIdleStanceSchedule, type IdleStanceCastKind, type IdleStanceHitInstance } from "./idle-stance-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as IdleStanceTemplate[];
const prefix = "idle-stance:", sourceId = `${prefix}source`;
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const templateOf = (document: CalculatorDocument) => templates.find(row => row.skillId === document.gameContext?.skillId);
const refsOf = (role: IdleStanceRole) => role.sourceRefs.map(path => path.startsWith("https://") ? path : sourceRoot + path);
export const isIdleStanceCastAction = (document: CalculatorDocument): boolean => templateOf(document) !== undefined;
const identity = (hit: OrdinaryHit) => hit.idleStanceEvent ? JSON.stringify(hit.idleStanceEvent) : `independent-single:${hit.id}`;
const canonicalValue = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalValue)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalValue(item)])) : value;
const finalizedIdentity = (hit: OrdinaryHit, context: IdleStanceCastContext) => JSON.stringify(canonicalValue({
  event: hit.idleStanceEvent ?? `independent-single:${hit.id}`, state: { ...context.sharedState, ...context.hitStates?.[hit.id] },
  snapshot: hit.idleStanceEvent ? context.snapshots?.[hit.idleStanceEvent.snapshotId] : undefined,
  scalingSnapshot: hit.idleStanceEvent?.scalingSnapshotId ? context.snapshots?.[hit.idleStanceEvent.scalingSnapshotId] : undefined,
}));
const roleOf = (cast: IdleStanceTemplate, hit: OrdinaryHit) => hit.idleStanceEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];

/** E's initial attack has no C6 callback; A1/C4 absorption is checked separately below. */
export function isWandererInitialSingleHit(document: CalculatorDocument, hit: CalculatorHit): boolean {
  const cast = templateOf(document);
  return document.scope === "single-hit" && cast?.sourceSlug === "wanderer"
    && hit.kind === "ordinary" && roleOf(cast, hit) === "initial";
}

const ascensionOf = (document: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ?? (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
const coefficient = (values: number[], level: number) => values.length === 1 ? values[0]! : values[level - 1] ?? values[0]!;

function canonicalHit(document: CalculatorDocument, cast: IdleStanceTemplate, roleKey: string, context: IdleStanceCastContext, previous?: OrdinaryHit, event?: IdleStanceHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey]!;
  const id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id,
    label: `${role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    kind: "ordinary", element: role.element, attackTag: role.attackTag,
    terms: role.terms.map(term => ({ stat: term.stat, coefficient: coefficient(term.values, document.gameContext!.effectiveTalentLevel), ...(term.minimumAscension === undefined ? {} : { minimumAscension: term.minimumAscension }) })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    dependencies: [sourceId], sourceRefs: refsOf(role),
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment; delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.occurrence;
  if (event) {
    hit.idleStanceEvent = { candidateId: event.id, templateRole: roleKey, frame: event.frame, snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
      ...(event.scalingSnapshotFrame === undefined ? {} : { scalingSnapshotFrame: event.scalingSnapshotFrame }),
      ...(event.scalingSnapshotId === undefined ? {} : { scalingSnapshotId: event.scalingSnapshotId }) };
    if (previous && (previous.id !== id || previous.idleStanceEvent && identity(previous) !== identity(hit))) {
      delete hit.finalSnapshot; delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
    const snapshot = context.snapshots?.[event.snapshotId];
    if (snapshot) hit.finalSnapshot = structuredClone(snapshot);
    // Event-bound explicit snapshots are owned by the context map. Removing
    // its entry must not leave the previously copied snapshot on the hit.
    // Converted snapshots retain their finalized-identity guard below.
    else if (hit.finalSnapshot?.origin !== "equipment-conversion") delete hit.finalSnapshot;
  }
  return hit;
}

const account = (rule: string, label: string, actual: number, included: number, sourceRefs: string[]): CalculatorFormula => ({
  ruleId: `idle-stance-${rule}-b4ae769`, label,
  expression: expr.sub(expr.input("idleActualShare"), expr.input("idleIncludedShare")),
  inputs: [
    { key: "idleActualShare", value: actual, unit: "ratio", meaningKey: "本次实际生效的角色自身份额", origin: "pinned-source-and-explicit-hit-state" },
    { key: "idleIncludedShare", value: included, unit: "ratio", meaningKey: "本击原输入已经包含的同一份额", origin: "explicit-accounting" },
  ], sourceRefs, requirements: { maximumConstellation: 0 },
});

/** Restores canonical coefficients before validating the declared, fully observed branch. */
export function prepareIdleStanceCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = idleStanceCastContextSchema.parse(game.idleStanceCast ?? {});
  game.idleStanceCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previousRole = (role: string) => [...old.values()].find(hit => !hit.idleStanceEvent && roleOf(cast, hit) === role);
  const representatives = () => Object.keys(cast.roles).map(role => canonicalHit(result, cast, role, context, previousRole(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(refsOf))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源的封闭后续输入与完整姿态生命周期；只生成明确接触的自身伤害。", sourceRefs: refs });
  const missing = oldHits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  const selectedHit = oldHits.find(hit => selected.has(hit.id));
  const independentWandererInitial = selected.size === 1 && selectedHit !== undefined && isWandererInitialSingleHit(result, selectedHit);
  if (game.constellation !== 0 && !independentWandererInitial) missing.push("此姿态完整分支仅支持明确C0，不能省略高命座追加伤害与状态变化。");
  if (game.effectiveTalentLevel > 15 || game.effectiveTalentLevel < 1) missing.push("有效天赋等级必须在固定来源1至15级范围。");
  if (result.scope === "single-hit") {
    result.hits = old.size ? [...old.values()].map(hit => {
      const role = roleOf(cast, hit);
      if (!role || !cast.roles[role]) {
        if (selected.has(hit.id)) missing.push(`命中 ${hit.id} 无法对应固定来源角色模板。`);
        return hit;
      }
      const saved = hit.idleStanceEvent;
      return canonicalHit(result, cast, role, context, hit, saved ? { id: saved.candidateId, templateRole: saved.templateRole as IdleStanceHitInstance["templateRole"], frame: saved.frame, snapshotFrame: saved.snapshotFrame, snapshotId: saved.snapshotId, targetId: saved.targetId,
        ...(saved.scalingSnapshotFrame === undefined ? {} : { scalingSnapshotFrame: saved.scalingSnapshotFrame }), ...(saved.scalingSnapshotId === undefined ? {} : { scalingSnapshotId: saved.scalingSnapshotId }) } : undefined);
    }) : representatives();
  } else {
    const schedule = compileIdleStanceSchedule(cast.skillId as IdleStanceCastKind, context);
    missing.push(...schedule.issues);
    if (context.statsStableAcrossHits !== true) missing.push("此完整分支需要明确各时点基础面板与装备稳定；自产减抗及另列的实际采样仍逐击处理。");
    result.hits = schedule.complete ? schedule.instances.map(event => {
      const previous = old.get(`${cast.skillId}:${event.id}`), seed = previous ?? previousRole(event.templateRole);
      if (!previous && seed?.finalSnapshot && !context.snapshots?.[event.snapshotId]) {
        context.finalizedHitEvents ??= Object.fromEntries([...old.values()].map(hit => [hit.id, finalizedIdentity(hit, context)]));
        missing.push("新生成的命中不能借用原独立单击的已转换快照；请重新应用构筑或提供本日程实际快照。");
      }
      return canonicalHit(result, cast, event.templateRole, context, seed, event);
    }) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "本次完整分支未命中所选敌人", kind: "non-damaging", reason: "所有来源攻击机会都有明确接触记录且全部落空；未补造一次伤害。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, reasons: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击固定来源与实际采样、角色自身份额明确。", sourceRefs: refs });
    for (const hit of hits) hit.dependencies.push(id);
  };
  dependency(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const issues: string[] = [], roleKey = roleOf(cast, hit), role = roleKey ? cast.roles[roleKey] : undefined;
    const state = { ...context.sharedState, ...context.hitStates?.[hit.id] }, ascension = ascensionOf(result, hit);
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== finalizedIdentity(hit, context)) issues.push("日程、目标、采样或逐击数值状态已改变；不能沿用旧命中的已结算面板或抗性。请重新应用构筑或恢复本日程实际面板。");
    if (cast.sourceSlug === "wanderer") {
      if (context.wanderer?.noAbsorption !== true || context.wanderer.panelExcludesAbsorptionBonuses !== true) issues.push("本击需要明确施放时没有元素吸收，且实际面板未包含未触发的30%攻击或20%暴击增益；这只要求已发生的起手状态。");
    }
    if (cast.sourceSlug === "zhongli") {
      if (ascension === undefined) issues.push("缺少实际突破阶段，不能确定1.9%生命的炊金馔玉附加倍率是否解锁。");
      let active = state.zhongliShieldReductionActive;
      if (result.scope !== "single-hit" && hit.idleStanceEvent) active = roleKey === "resonance" && hit.idleStanceEvent.frame <= 1296;
      if (hit.effectiveResistance === undefined) {
        if (active === undefined) issues.push("独立已发生命中需要明确本击敌人是否受玉璋护盾20%减抗，不能要求未来护盾寿命来代替该事实。");
        if (state.includedResistanceReduction === undefined) issues.push("请明确敌方抗性输入已含的玉璋护盾减抗份额；0表示明确未含。");
      }
      // A materialized final resistance bypasses this tree numerically, but the
      // actual source calculation remains available in exported final JSON.
      if (active !== undefined && state.includedResistanceReduction !== undefined) hit.resistanceReductionFormula = account("jade-shield", "玉璋护盾：本击实际减抗 − 输入已含份额", active ? .2 : 0, state.includedResistanceReduction, refs);
    }
    if (cast.sourceSlug === "yanfei" || cast.sourceSlug === "chiori") {
      if (ascension === undefined) issues.push("缺少实际突破阶段，不能确定角色自身增伤被动是否解锁。");
      let actual: number | undefined;
      let activeYanfeiSeals: number | undefined;
      if (cast.sourceSlug === "yanfei") {
        if (ascension !== undefined && ascension < 1 || context.yanfei?.priorA1Inactive === true) actual = 0;
        else if (state.yanfeiA1Seals !== undefined) activeYanfeiSeals = state.yanfeiA1Seals;
        if (actual === undefined && activeYanfeiSeals === undefined) issues.push("独立烟绯命中需要起手时实际A1丹火印份额，或明确该增益未激活。");
      } else {
        if (ascension !== undefined && ascension < 4 || result.scope !== "single-hit" && context.chiori?.priorA4Inactive === true && context.chiori.noGeoConstructs === true) actual = 0;
        else if (state.chioriA4Active !== undefined) actual = state.chioriA4Active ? .2 : 0;
        else if (roleKey === "initial" && context.chiori?.priorA4Inactive === true && context.chiori.noGeoConstructs === true) actual = 0;
        if (actual === undefined) issues.push("独立千织命中需要本击实际A4岩伤激活状态，不能要求未来人偶或构造日程。");
      }
      if (state.includedDamageBonus === undefined) issues.push("请明确本击增伤输入已含的此角色自身被动份额；0表示明确未含。");
      if (actual !== undefined && state.includedDamageBonus !== undefined) hit.damageBonusFormula = account(`${cast.sourceSlug}-own-bonus`, "本击自身被动增伤 − 输入已含份额", actual, state.includedDamageBonus, refs);
      else if (activeYanfeiSeals !== undefined && state.includedDamageBonus !== undefined) hit.damageBonusFormula = {
        ruleId: "idle-stance-yanfei-a1-seals-b4ae769", label: "烟绯A1：实际消耗印数×5% − 输入已含份额",
        expression: expr.sub(expr.mul(expr.input("idleYanfeiA1Seals"), expr.value(.05)), expr.input("idleIncludedShare")),
        inputs: [
          { key: "idleYanfeiA1Seals", value: activeYanfeiSeals, unit: "count", minimum: 0, maximum: 3, integer: true, meaningKey: "本击起手快照时仍有效的A1增伤对应消耗丹火印数", origin: "explicit-hit-state" },
          { key: "idleIncludedShare", value: state.includedDamageBonus, unit: "ratio", meaningKey: "本击增伤输入已含的烟绯A1份额", origin: "explicit-accounting" },
        ], requirements: { minimumAscension: 1, maximumConstellation: 0 }, sourceRefs: refs,
      };
    }
    if (role && (cast.sourceSlug === "nilou" || cast.sourceSlug === "alhaitham")) {
      const stat = cast.sourceSlug === "nilou" ? "hp" : "em";
      const sampleId = hit.idleStanceEvent?.scalingSnapshotId ?? "scaling:0";
      const value = (stat === "hp" ? state.scalingHp : state.scalingEm) ?? context.snapshots?.[sampleId]?.stats[stat];
      const usePanel = value === undefined && (state.scalingStatMatchesPanel === true || result.scope !== "single-hit" && context.statsStableAcrossHits === true);
      if (value === undefined && !usePanel) issues.push(`本击${stat === "hp" ? "生命" : "精通"}基数在施放第0帧采样；请提供真实起手数值/快照，或明确该数值与本击面板相同，不能用后续时点面板猜测。`);
      else {
        const key = stat === "hp" ? "idleCastHp" : "idleCastEm";
        hit.baseDamageFormula = {
          ruleId: `idle-stance-${cast.sourceSlug}-split-snapshot-b4ae769`, label: "本击天赋基础伤害：起手基数与进攻快照分别取样",
          expression: expr.add(...role.terms.map(term => expr.mul(expr.value(coefficient(term.values, game.effectiveTalentLevel)), expr.input(term.stat === stat && !usePanel ? key : term.stat)))),
          inputs: value === undefined ? [] : [{ key, value, unit: "stat", minimum: 0, meaningKey: `本次施放第0帧实际${stat === "hp" ? "生命上限" : "元素精通"}，独立于之后的攻击/暴击快照`, origin: "explicit-cast-time-snapshot" }],
          requirements: { maximumConstellation: 0 }, sourceRefs: refs,
        };
      }
    }
    dependency(`${prefix}${hit.id}`, issues, [hit]);
  }
  const selectedDependencies = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(row => selectedDependencies.has(row.id) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : result.scope === "one-cast" && result.selectedHitIds.length === result.hits.length && ready ? "complete-cast" : "selected-components";
  game.attributionPolicy = independentWandererInitial
    ? "仅流浪者已发生的E初始命中，支持C0–C6；有效E等级直接使用，不再次增加命座等级。A1/C4吸收与实际面板条件仍独立检查，不包含空居普攻、重击、风矢或C6追加攻击，也不证明完整姿态。"
    : "仅限标签声明的封闭后续输入与完整C0状态生命周期；没有输入必须显式记录，全部自主攻击逐击确认接触。独立已发生命中不依赖未来状态。";
  result.assumptions = [...result.assumptions.filter(note => !note.startsWith("姿态完整分支：")), "姿态完整分支：不续舞、不追击等限制属于本次输入条件；完整观察包含自动实体及攻击尾段，不代表任意实战轮转。来源倍率、采样时点、接触与角色自身份额均单独保存。"];
  return result;
}

export function resetIdleStancePanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isIdleStanceCastAction(document)) return;
  const context = document.gameContext!.idleStanceCast ??= {};
  delete context.finalizedHitEvents;
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") state.includedDamageBonus = 0;
    else delete state.includedDamageBonus;
    // The editable enemy input is independent of rebuilding the offensive panel.
  }
  if (mode === "fresh-equipment") (context.sharedState ??= {}).includedDamageBonus = 0;
  else if (context.sharedState) delete context.sharedState.includedDamageBonus;
}

export function finalizeIdleStancePanelAccounting(document: CalculatorDocument): void {
  if (!isIdleStanceCastAction(document)) return;
  const context = document.gameContext!.idleStanceCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, finalizedIdentity(hit, context)]));
  // Generic conversion retains these executable own-bonus trees and materializes effective resistance.
}

export function idleStanceEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.idleStanceEvent) return [];
  const event = hit.idleStanceEvent, trace = new TraceBuilder(hit.sourceRefs);
  trace.add("idle-stance.damage-frame", "本击来源排程", expr.input("damageFrame"), [traceInput("damageFrame", event.frame, "frames", "pinned-source-schedule", `${event.candidateId}，明确命中目标${event.targetId}`)], { unit: "frames" });
  trace.add("idle-stance.snapshot-frame", "本击进攻快照", expr.input("snapshotFrame"), [traceInput("snapshotFrame", event.snapshotFrame, "frames", "pinned-source-snapshot-policy", event.snapshotId)], { unit: "frames" });
  if (event.scalingSnapshotFrame !== undefined) trace.add("idle-stance.scaling-frame", "独立基数采样时点", expr.input("scalingFrame"), [traceInput("scalingFrame", event.scalingSnapshotFrame, "frames", "pinned-source-scaling-policy", event.scalingSnapshotId)], { unit: "frames" });
  return trace.nodes;
}
