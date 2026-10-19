import definitions from "../../game-data/sources/held-lifecycle-casts/definitions.json";
import type { HeldLifecycleRole, HeldLifecycleTemplate } from "../../game-data/src/character-mappings/held-lifecycle-mappings";
import { heldLifecycleCastContextSchema, type CalculatorDocument, type CalculatorHit, type HeldLifecycleCastContext } from "./calculator-model";
import { compileHeldLifecycleSchedule, type HeldLifecycleCastKind, type HeldLifecycleHitInstance } from "./held-lifecycle-schedule";
import { prepareHeldLifecycleHitPassive } from "./held-lifecycle-passives";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const templates = definitions.templates as HeldLifecycleTemplate[];
const prefix = "held-lifecycle:", sourceId = `${prefix}source`;
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";
const templateOf = (doc: CalculatorDocument) => templates.find(row => row.skillId === doc.gameContext?.skillId);
const refsOf = (role: HeldLifecycleRole) => role.sourceRefs.map(path => path.startsWith("https://") ? path : sourceRoot + path);
export const isHeldLifecycleCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const identity = (hit: OrdinaryHit) => hit.heldLifecycleEvent ? JSON.stringify(hit.heldLifecycleEvent) : `independent-single:${hit.id}`;
const roleOf = (cast: HeldLifecycleTemplate, hit: OrdinaryHit) => hit.heldLifecycleEvent?.templateRole ?? Object.entries(cast.roles).find(([, role]) => role.mappingId === hit.id)?.[0];
const ascensionOf = (doc: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;

function canonicalHit(doc: CalculatorDocument, cast: HeldLifecycleTemplate, roleKey: string, context: HeldLifecycleCastContext, previous?: OrdinaryHit, event?: HeldLifecycleHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey]!;
  const id = event ? `${cast.skillId}:${event.id}` : previous?.id ?? role.mappingId;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}), id,
    label: `${role.label}${event ? ` · 第${event.frame}帧（${event.id}）` : " · 独立已发生命中"}`,
    kind: "ordinary", element: role.element, attackTag: role.attackTag,
    terms: role.terms.map(term => ({ stat: term.stat, coefficient: term.values[doc.gameContext!.effectiveTalentLevel - 1] ?? term.values[0]! })),
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    dependencies: [sourceId], sourceRefs: refsOf(role),
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment; delete hit.coordinatedEvent; delete hit.occurrence;
  if (event) {
    hit.heldLifecycleEvent = { candidateId: event.id, templateRole: roleKey, frame: event.frame, snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
      ...(event.triggerId === undefined ? {} : { triggerId: event.triggerId }), ...(event.triggerFrame === undefined ? {} : { triggerFrame: event.triggerFrame }) };
    if (previous && (previous.id !== id || previous.heldLifecycleEvent && identity(previous) !== identity(hit))) {
      delete hit.finalSnapshot; delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
      // Keep additive-base restoration records until the fresh-equipment reset.
    }
    if (context.snapshots?.[event.snapshotId]) hit.finalSnapshot = structuredClone(context.snapshots[event.snapshotId]!);
  }
  return hit;
}

/** Actual contact masks expand source opportunities; an unknown/missed hit is never fabricated. */
export function prepareHeldLifecycleCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = heldLifecycleCastContextSchema.parse(game.heldLifecycleCast ?? {});
  game.heldLifecycleCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previousRole = (role: string) => [...old.values()].find(hit => !hit.heldLifecycleEvent && roleOf(cast, hit) === role);
  const representatives = () => Object.keys(cast.roles).map(role => canonicalHit(result, cast, role, context, previousRole(role)));
  const refs = [...new Set(Object.values(cast.roles).flatMap(refsOf))];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定来源持按与实体生命周期协议；按明确接触记录生成独立命中，不推断最大伤害次数。", sourceRefs: refs });
  const missing = oldHits.filter(hit => hit.kind === "blocked").flatMap(hit => hit.reasons);
  if (game.constellation !== 0) missing.push("此完整生命周期只支持明确C0；高命座的寿命、伤害和资源变化未并入本分支。");
  if (game.effectiveTalentLevel > 15) missing.push("有效天赋等级超出固定来源1至15级。");
  if (result.scope === "single-hit") {
    result.hits = old.size ? [...old.values()].map(hit => {
      const role = roleOf(cast, hit);
      if (!role || !cast.roles[role]) return hit;
      const saved = hit.heldLifecycleEvent;
      return canonicalHit(result, cast, role, context, hit, saved ? { id: saved.candidateId, templateRole: saved.templateRole as HeldLifecycleHitInstance["templateRole"], frame: saved.frame, snapshotFrame: saved.snapshotFrame, snapshotId: saved.snapshotId, targetId: saved.targetId, triggerId: saved.triggerId, triggerFrame: saved.triggerFrame } : undefined);
    }) : representatives();
  } else {
    const schedule = compileHeldLifecycleSchedule(cast.skillId as HeldLifecycleCastKind, context);
    missing.push(...schedule.issues);
    if (context.statsStableAcrossHits !== true) missing.push("完整生命周期须明确各取样时点基础面板、装备及反应属性稳定；另列的逐击被动采用独立实际输入。");
    result.hits = schedule.complete ? schedule.instances.map(event => {
      const previous = old.get(`${cast.skillId}:${event.id}`), seed = previous ?? previousRole(event.templateRole);
      if (!previous && seed?.finalSnapshot && !context.snapshots?.[event.snapshotId]) {
        context.finalizedHitEvents ??= Object.fromEntries([...old.values()].map(hit => [hit.id, identity(hit)]));
        missing.push("新生成的命中不能借用原独立单击快照；请重新应用构筑或恢复本日程实际快照。");
      }
      return canonicalHit(result, cast, event.templateRole, context, seed, event);
    }) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, label: "本次完整生命周期未命中所选目标", kind: "non-damaging", reason: "所有来源机会均有明确接触记录，全部落空；不补造一次伤害。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dep = (id: string, reasons: string[], targets: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: reasons.join("；") || "本击来源、实际命中及被动份额明确。", sourceRefs: refs });
    targets.forEach(hit => hit.dependencies.push(id));
  };
  dep(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const issues: string[] = [], role = roleOf(cast, hit), state = { ...context.sharedState, ...context.hitStates?.[hit.id] };
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(hit)) issues.push("已转换的日程发生变化；本击不能沿用旧时点已结算增伤、附加基伤或抗性，请重新应用构筑或导入真实面板。");
    if (cast.skillId.includes("-hydro-skill-") && result.scope === "single-hit") {
      if (role === "dewdrop") {
        const index = Number(hit.heldLifecycleEvent?.candidateId.replace("dewdrop-", "")) - 1;
        const hp = state.hydroHpFractionBeforeHit ?? context.hydroHold?.hpRatiosBeforeDewdrops?.[index];
        if (hp === undefined || hp > .5) issues.push("独立无充盈露滴需要明确本击取样前生命比例不高于50%；不能把未知充盈附伤省略。");
      }
      if (role === "torrent" && state.hydroTorrentSuffusionBonus !== 0 && !(context.hydroHold?.priorA4Bonus === 0 && context.hydroHold.noHealingOrDropletPickup === true && context.hydroHold.hpRatiosBeforeDewdrops?.length && context.hydroHold.hpRatiosBeforeDewdrops.every(value => value <= .5))) issues.push("独立无充盈激流需要明确本击充盈附伤为0，或保留完整的无充盈历史。");
    }
    if (role === "arkhe" && (hit.reaction !== "none" || hit.additiveReaction !== undefined)) issues.push("固定来源灵息之刺附着量为0，此条件分支不能指定增幅或激化反应。");
    if (cast.skillId === "held-noelle-charged-c0" && (context.noelle?.burstInactive !== true || context.noelle.shieldInactive !== true)) issues.push("基础物理重击需要明确没有大扫除或护心铠状态；选择单击也不能省略此资格。");
    const passive = prepareHeldLifecycleHitPassive({ skillId: cast.skillId, ascension: ascensionOf(result, hit), context, hit });
    issues.push(...passive.issues);
    if (passive.formula) hit.damageBonusFormula = passive.formula;
    dep(`${prefix}${hit.id}`, issues, [hit]);
  }
  const complete = result.scope === "one-cast" && result.selectedHitIds.length === result.hits.length && !result.dependencies.some(row => row.id.startsWith(prefix) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : complete ? "complete-cast" : "selected-components";
  game.attributionPolicy = "明确持按、资源与实际接触记录下的一次C0施放；全寿命已发出的尾段逐击计算。独立已发生命中不依赖未来日程，不自动执行队伍、附着或空间模拟。";
  result.assumptions = [...result.assumptions.filter(note => !note.startsWith("持按生命周期：")), "持按生命周期：接触机会由固定来源排程，实际命中与落空逐项明确；未知不会成为零或最大次数。各击保留来源、快照、独立反应与自身被动记账。"];
  return result;
}

export function resetHeldLifecyclePanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isHeldLifecycleCastAction(document)) return;
  const context = document.gameContext!.heldLifecycleCast ??= {};
  delete context.finalizedHitEvents;
  context.hitStates ??= {};
  for (const hit of document.hits) if (hit.kind === "ordinary" && (!hit.finalSnapshot || hit.finalSnapshot.origin === "equipment-conversion")) {
    const state = context.hitStates[hit.id] ??= {};
    if (mode === "fresh-equipment") state.includedDamageBonus = 0;
    else delete state.includedDamageBonus;
  }
  if (mode === "fresh-equipment") (context.sharedState ??= {}).includedDamageBonus = 0;
  else if (context.sharedState) delete context.sharedState.includedDamageBonus;
}

export function finalizeHeldLifecyclePanelAccounting(document: CalculatorDocument): void {
  if (!isHeldLifecycleCastAction(document)) return;
  const context = document.gameContext!.heldLifecycleCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(hit)]));
  // Own passive formula is not materialized by the generic damage-bonus resolver.
}

export function heldLifecycleEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.heldLifecycleEvent) return [];
  const event = hit.heldLifecycleEvent, trace = new TraceBuilder(hit.sourceRefs);
  trace.add("held-lifecycle.damage-frame", "本击来源排程", expr.input("damageFrame"), [traceInput("damageFrame", event.frame, "frames", "pinned-source-schedule", `${event.candidateId}，明确命中目标${event.targetId}`)], { unit: "frames" });
  trace.add("held-lifecycle.snapshot-frame", "本击进攻快照", expr.input("snapshotFrame"), [traceInput("snapshotFrame", event.snapshotFrame, "frames", "pinned-source-snapshot-policy", event.snapshotId)], { unit: "frames" });
  return trace.nodes;
}
