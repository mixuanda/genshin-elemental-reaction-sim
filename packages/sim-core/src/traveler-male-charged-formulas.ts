import { travelerMaleChargedTemplates, type TravelerMaleChargedTemplate } from "../../game-data/src/character-mappings/traveler-male-charged-mappings";
import type { TravelerMaleChargedRole } from "./traveler-male-charged-schedule";
import {
  travelerMaleChargedCastContextSchema, type TravelerMaleChargedCastContext,
  type CalculatorDocument, type CalculatorHit,
} from "./calculator-model";
import {
  compileTravelerMaleChargedSchedule, travelerMaleChargedHitQualificationIssues,
  type TravelerMaleChargedCastKind, type TravelerMaleChargedHitInstance,
} from "./traveler-male-charged-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const prefix = "traveler-male-charged:", sourceId = `${prefix}source`;
const roles = ["hit-1", "hit-2"] as const;
const templateOf = (doc: CalculatorDocument) => travelerMaleChargedTemplates.find(row => row.skillId === doc.gameContext?.skillId);
export const isTravelerMaleChargedCastAction = (doc: CalculatorDocument): boolean => templateOf(doc) !== undefined;
const roleOf = (cast: TravelerMaleChargedTemplate, hit: OrdinaryHit): TravelerMaleChargedRole | undefined =>
  hit.travelerMaleChargedEvent?.templateRole ?? roles.find(role => cast.roles[role].mappingId === hit.id);
const stateOf = (cast: TravelerMaleChargedTemplate, context: TravelerMaleChargedCastContext, hit: OrdinaryHit) => {
  const role = roleOf(cast, hit);
  return { ...context.sharedState, ...(role ? context.hitStates?.[cast.roles[role].mappingId] : undefined), ...context.hitStates?.[hit.id] };
};
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, stableValue(entry)]));
  return value;
}
const stableJson = (value: unknown): string => JSON.stringify(stableValue(value)) ?? "null";
/** Only this hit's authoritative inputs enter its identity, never future cast observations. */
function identity(doc: CalculatorDocument, context: TravelerMaleChargedCastContext, hit: OrdinaryHit): string {
  const event = hit.travelerMaleChargedEvent;
  const snapshot = event ? context.snapshots?.[event.snapshotId] : hit.finalSnapshot;
  const ascension = snapshot?.ascension ?? (doc.build.mode === "equipment-derived" ? doc.build.equipment?.ascension : doc.build.ascension) ?? doc.gameContext?.ascension;
  return stableJson({ event: event ?? `independent-single:${hit.id}`, snapshot: snapshot ?? null,
    state: stateOf(templateOf(doc)!, context, hit), effectiveTalentLevel: doc.gameContext?.effectiveTalentLevel,
    constellation: doc.gameContext?.constellation, ascension, characterLevel: snapshot?.characterLevel ?? doc.characterLevel });
}
const eventOf = (role: TravelerMaleChargedRole, targetId: string): TravelerMaleChargedHitInstance => {
  const frame = role === "hit-1" ? 9 : 20;
  return { id: role, templateRole: role, frame, snapshotFrame: frame, snapshotId: `sample:${frame}`, targetId };
};

/** Every prepare restores the fixed male coefficient; edited totals are never numerical authority. */
function canonicalHit(doc: CalculatorDocument, cast: TravelerMaleChargedTemplate, roleKey: TravelerMaleChargedRole,
  context: TravelerMaleChargedCastContext, previous?: OrdinaryHit, event?: TravelerMaleChargedHitInstance): OrdinaryHit {
  const role = cast.roles[roleKey], id = event ? `${cast.skillId}:${event.id}` : role.mappingId;
  const hit: OrdinaryHit = {
    ...(previous ? structuredClone(previous) : {}),
    id, label: `${role.label}${event ? ` · 第 ${event.frame} 帧` : " · 独立已发生命中"}`,
    kind: "ordinary", element: "physical", attackTag: "charged",
    terms: [{ stat: "atk", coefficient: role.values[doc.gameContext!.effectiveTalentLevel - 1] ?? 0 }],
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    critEligible: true, reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0,
    groupMultiplier: previous?.groupMultiplier ?? 1, dependencies: [sourceId], sourceRefs: [...cast.sourceRefs],
  };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula;
  delete hit.resistanceReductionFormula; delete hit.critRateFormula; delete hit.critDamageFormula;
  delete hit.elementalMasteryAdjustment; delete hit.attackAdjustment; delete hit.coordinatedEvent;
  delete hit.heldLifecycleEvent; delete hit.occurrence;
  if (event) {
    hit.travelerMaleChargedEvent = {
      candidateId: event.id, templateRole: roleKey, frame: event.frame,
      snapshotFrame: event.snapshotFrame, snapshotId: event.snapshotId, targetId: event.targetId,
    };
    const saved = context.snapshots?.[event.snapshotId];
    const convertedStillCurrent = previous?.finalSnapshot?.origin === "equipment-conversion"
      && context.finalizedHitEvents?.[id] === identity(doc, context, hit);
    if (saved) hit.finalSnapshot = structuredClone(saved);
    else if (!convertedStillCurrent) delete hit.finalSnapshot;
    if (previous && (previous.id !== id || stableJson(previous.travelerMaleChargedEvent) !== stableJson(hit.travelerMaleChargedEvent)
      || stableJson(previous.finalSnapshot) !== stableJson(hit.finalSnapshot))) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  } else delete hit.travelerMaleChargedEvent;
  return hit;
}

/** Shared by calculation, normal controls and JSON import, independent of future events for a single hit. */
export function prepareTravelerMaleChargedCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document);
  if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!;
  const context = travelerMaleChargedCastContextSchema.parse(game.travelerMaleChargedCast ?? {});
  game.travelerMaleChargedCast = context;
  const oldHits = result.hits, selected = new Set(result.selectedHitIds), selectedAll = oldHits.every(hit => selected.has(hit.id));
  const old = new Map(oldHits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, hit]));
  const previousRole = (role: TravelerMaleChargedRole) => [...old.values()].find(hit => !hit.travelerMaleChargedEvent && roleOf(cast, hit) === role);
  const representatives = () => roles.map(role => canonicalHit(result, cast, role, context, previousRole(role)));
  const missing: string[] = oldHits.flatMap(hit => hit.kind === "blocked" && (result.scope !== "single-hit" || selected.has(hit.id)) ? hit.reasons : []);
  if (game.characterId !== "character:10000005" || game.variantId !== cast.variantId || game.abilityId !== `talent:traveler${cast.element}:combat1`) {
    missing.push("男性重击必须绑定空的精确身份、对应元素形态与普攻能力，不能借用荧或其他形态。");
  }
  if (game.constellation !== 0) missing.push("此男性基础重击分支仅支持明确 C0；高命座转换不在本次协议内。");
  if (!Number.isInteger(game.effectiveTalentLevel) || game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15) missing.push("男性专属参数只核准有效天赋等级 1–15。");
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "固定 Optimizer 男性专属精确倍率与 gcsim 两段行为；共享女性参数不作为男性计算输入。", sourceRefs: cast.sourceRefs });

  if (result.scope === "single-hit") {
    const restored = [...old.values()].flatMap(hit => {
      const role = roleOf(cast, hit);
      if (!role) {
        if (selected.has(hit.id)) missing.push("独立命中缺少本分支已核准的男性段落身份。");
        return [];
      }
      const saved = hit.travelerMaleChargedEvent;
      const event = saved ? eventOf(role, saved.targetId) : undefined;
      if (selected.has(hit.id) && saved && (hit.id !== `${cast.skillId}:${role}` || saved.candidateId !== role
        || saved.frame !== event!.frame || saved.snapshotFrame !== event!.snapshotFrame || saved.snapshotId !== event!.snapshotId)) {
        missing.push("独立命中的来源帧数或段落已被改变，不能沿用错误事件；请恢复真实来源记录。");
      }
      return [canonicalHit(result, cast, role, context, hit, event)];
    });
    result.hits = restored.length ? restored : representatives();
  } else {
    const schedule = compileTravelerMaleChargedSchedule(cast.skillId as TravelerMaleChargedCastKind, context);
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => {
      const previous = old.get(`${cast.skillId}:${event.id}`), seed = previous ?? previousRole(event.templateRole);
      if (!previous && seed?.finalSnapshot && !context.snapshots?.[event.snapshotId]) {
        context.finalizedHitEvents ??= Object.fromEntries([...old.values()].map(hit => [hit.id, identity(result, context, hit)]));
        missing.push("完整日程新增的命中不能沿用独立单击旧快照；请重新应用构筑或恢复各时点实际快照。");
      }
      return canonicalHit(result, cast, event.templateRole, context, seed, event);
    }) : representatives();
    if (!result.hits.length) result.hits = [{
      id: `${cast.skillId}:no-contact`, label: "本次两段男性重击均未命中所选目标", kind: "non-damaging",
      reason: "两次来源机会均已明确落空，不补造一次命中。", sourceRefs: cast.sourceRefs, dependencies: [sourceId],
    }];
  }

  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [retained[0] ?? result.hits[0]!.id]
    : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const depend = (id: string, reasons: string[], targets: CalculatorHit[]) => {
    result.dependencies.push({ id, status: reasons.length ? "missing" : "provisional", reason: [...new Set(reasons)].join("；") || "本击男性来源、基础状态与实际取样明确。", sourceRefs: cast.sourceRefs });
    targets.forEach(hit => hit.dependencies.push(id));
  };
  depend(`${prefix}schedule`, missing, result.hits);
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const state = stateOf(cast, context, hit);
    const issues = travelerMaleChargedHitQualificationIssues(cast.skillId, state);
    if (hit.reaction !== "none" || hit.additiveReaction !== undefined) issues.push("本基础物理重击不能指定增幅或激化反应。");
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result, context, hit)) {
      issues.push("已转换命中的事件、实际快照、本击状态或等级改变，不能沿用旧增伤、附加基伤或抗性结算值；请重新应用构筑或导入真实历史面板。");
    }
    const event = hit.travelerMaleChargedEvent;
    if (event && result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot && !context.snapshots?.[event.snapshotId]) {
      issues.push("本击原有的实际快照已被移除或失效；请恢复该击真实快照，不能静默改用当前面板。");
    }
    if (result.scope !== "single-hit" && !hit.finalSnapshot && context.statsStableAcrossHits !== true) {
      issues.push("完整两段需要各自实际快照，或明确确认两次取样之间基础面板与装备条件稳定。");
    }
    depend(`${prefix}${hit.id}`, issues, [hit]);
  }
  const complete = result.scope === "one-cast" && result.selectedHitIds.length === result.hits.length
    && !result.dependencies.some(row => row.id.startsWith(prefix) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : complete ? "complete-cast" : "selected-components";
  game.attributionPolicy = "空在合法普攻后发动的两段C0基础物理重击；前置普攻另计。第9/20帧候选分别确认接触并取实际快照；独立已发生单击不要求未来另一段记录。";
  result.assumptions = [...result.assumptions.filter(note => !note.startsWith("男性重击：")),
    "男性重击：男性专属来源与共享女性参数分别保留；完整两段伤害尾部到第20帧，未取消动画长55帧，不据此推断完整循环DPS。"];
  return result;
}

export function resetTravelerMaleChargedPanelAccounting(document: CalculatorDocument, _mode: "fresh-equipment" | "imported-final"): void {
  if (!isTravelerMaleChargedCastAction(document)) return;
  const context = document.gameContext!.travelerMaleChargedCast ??= {};
  delete context.finalizedHitEvents;
  for (const [id, snapshot] of Object.entries(context.snapshots ?? {})) {
    if (snapshot.origin === "equipment-conversion") delete context.snapshots![id];
  }
}

export function finalizeTravelerMaleChargedPanelAccounting(document: CalculatorDocument): void {
  if (!isTravelerMaleChargedCastAction(document)) return;
  const context = document.gameContext!.travelerMaleChargedCast ??= {};
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id, identity(document, context, hit)]));
}

export function travelerMaleChargedEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.travelerMaleChargedEvent) return [];
  const event = hit.travelerMaleChargedEvent, trace = new TraceBuilder(hit.sourceRefs);
  trace.add("traveler-male-charged.damage-frame", "男性重击实际命中帧", expr.input("damageFrame"),
    [traceInput("damageFrame", event.frame, "frames", "pinned-source-schedule", `${event.candidateId}，目标${event.targetId}`)], { unit: "frames" });
  trace.add("traveler-male-charged.snapshot-frame", "男性重击逐段进攻快照", expr.input("snapshotFrame"),
    [traceInput("snapshotFrame", event.snapshotFrame, "frames", "pinned-source-snapshot-policy", event.snapshotId)], { unit: "frames" });
  return trace.nodes;
}
