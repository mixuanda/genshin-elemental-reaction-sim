import { travelerHydroResolvedTemplates, type TravelerHydroResolvedTemplate } from "../../game-data/src/character-mappings/traveler-hydro-resolved-mappings";
import { travelerHydroResolvedCastContextSchema, type TravelerHydroResolvedCastContext, type CalculatorDocument, type CalculatorHit, type CalculatorFormula } from "./calculator-model";
import type { TravelerHydroResolvedEvent } from "./traveler-hydro-resolved-context";
import { compileTravelerHydroResolvedSchedule, type TravelerHydroResolvedCastKind } from "./traveler-hydro-resolved-schedule";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const prefix = "traveler-hydro-resolved:", sourceId = `${prefix}source`;
const templateOf = (document: CalculatorDocument) => travelerHydroResolvedTemplates.find(row => row.skillId === document.gameContext?.skillId);
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const stateOf = (context: TravelerHydroResolvedCastContext, hit: OrdinaryHit) => ({ ...context.sharedState, ...context.hitStates?.[hit.id] });
const ascensionOf = (document: CalculatorDocument, hit: OrdinaryHit) => hit.finalSnapshot?.ascension ?? (document.build.mode === "equipment-derived" ? document.build.equipment?.ascension : document.build.ascension) ?? document.gameContext?.ascension;
export const isTravelerHydroResolvedCastAction = (document: CalculatorDocument): boolean => templateOf(document) !== undefined;
function identity(document: CalculatorDocument, context: TravelerHydroResolvedCastContext, hit: OrdinaryHit): string {
  const event = hit.travelerHydroResolvedEvent;
  return stable({ event: event ?? null, snapshot: event ? context.snapshots?.[event.snapshotId] ?? null : null, state: stateOf(context,hit),
    talentLevel: document.gameContext?.effectiveTalentLevel, constellation: document.gameContext?.constellation,
    ascension: ascensionOf(document,hit), storyInactive: context.trueMoonStoryBuffInactive });
}
function canonicalHit(document: CalculatorDocument, cast: TravelerHydroResolvedTemplate, context: TravelerHydroResolvedCastContext,
  roleName: TravelerHydroResolvedEvent["templateRole"], previous?: OrdinaryHit, event?: TravelerHydroResolvedEvent): OrdinaryHit {
  const role = cast.roles[roleName], id = event ? `${cast.skillId}:${event.candidateId}` : role.mappingId;
  const hit: OrdinaryHit = { ...(previous ? structuredClone(previous) : {}), id, kind: "ordinary", label: `${role.label}${event ? ` · 第${event.frame}帧（${event.candidateId}）` : " · 独立来源模板"}`,
    element: "hydro", attackTag: "skill", terms: [{ stat: "atk", coefficient: role.values[document.gameContext!.effectiveTalentLevel-1]! }],
    additiveBaseDamage: previous?.additiveBaseDamage ?? 0, damageBonus: previous?.damageBonus ?? 0,
    reaction: previous?.reaction ?? "none", reactionBonus: previous?.reactionBonus ?? 0, groupMultiplier: previous?.groupMultiplier ?? 1,
    critEligible: true, sourceRefs: role.sourceRefs, dependencies: [sourceId] };
  delete hit.baseDamageFormula; delete hit.additiveBaseFormula; delete hit.damageBonusFormula; delete hit.resistanceReductionFormula;
  delete hit.critRateFormula; delete hit.critDamageFormula; delete hit.attackAdjustment; delete hit.elementalMasteryAdjustment; delete hit.occurrence;
  delete hit.coordinatedEvent; delete hit.heldLifecycleEvent; delete hit.entityFollowupEvent; delete hit.extendedStanceEvent;
  delete hit.noellePlungeEvent; delete hit.mixedSourceEvent; delete hit.idleStanceEvent; delete hit.periodicOrdinaryEvent;
  delete hit.travelerMaleChargedEvent; delete hit.observedEntityEvent; delete hit.travelerCrossEntityEvent;
  if (event) {
    hit.travelerHydroResolvedEvent = structuredClone(event);
    const declaredSnapshot = context.snapshots?.[event.snapshotId];
    const retainedConversion = previous?.finalSnapshot?.origin === "equipment-conversion" && context.finalizedHitEvents?.[id] === identity(document,context,hit);
    if (declaredSnapshot) hit.finalSnapshot = structuredClone(declaredSnapshot);
    else if (!retainedConversion) delete hit.finalSnapshot;
    if (stable(previous?.travelerHydroResolvedEvent) !== stable(event) || declaredSnapshot && stable(declaredSnapshot) !== stable(previous?.finalSnapshot) || previous?.finalSnapshot && !hit.finalSnapshot) {
      delete hit.effectiveCritRate; delete hit.effectiveCritDamage; delete hit.effectiveResistance;
    }
  }
  return hit;
}
export function prepareTravelerHydroResolvedCastDocument(document: CalculatorDocument): CalculatorDocument {
  const cast = templateOf(document); if (!cast) return document;
  const result = structuredClone(document), game = result.gameContext!, context = travelerHydroResolvedCastContextSchema.parse(game.travelerHydroResolvedCast ?? {});
  game.travelerHydroResolvedCast = context;
  const previous = result.hits, selected = new Set(result.selectedHitIds), selectedAll = previous.every(hit => selected.has(hit.id));
  const old = new Map(previous.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id,hit]));
  const refs = cast.roles.dew.sourceRefs, missing: string[] = [];
  result.dependencies = result.dependencies.filter(row => !row.id.startsWith(prefix));
  result.dependencies.push({ id: sourceId, status: "provisional", reason: "两性全15级独立Optimizer倍率和游戏文本裁决MaxHP扣血与本次A4；实际事件顺序由完整观察给出，未伪造自动耗血日程。", sourceRefs: refs });
  if (game.constellation !== 0) missing.push("此来源协议仅覆盖C0，不自动忽略高命座护盾或治疗反馈。");
  if (context.trueMoonStoryBuffInactive !== true) missing.push("需明确本击真月剧情增益关闭，不自动覆盖输入面板。");
  if (game.effectiveTalentLevel < 1 || game.effectiveTalentLevel > 15 || !Number.isInteger(game.effectiveTalentLevel)) {
    result.dependencies.push({ id: `${prefix}talent`, status: "missing", reason: "本击实际E天赋必须在来源1至15级范围内，不补零或回退一级。", sourceRefs: refs });
    result.hits.forEach(hit => { hit.dependencies = [...new Set([...hit.dependencies,`${prefix}talent`])]; });
    game.scopeCoverage = "selected-components"; return result;
  }
  const representative = (role: TravelerHydroResolvedEvent["templateRole"]) => old.get(cast.roles[role].mappingId);
  const representatives = () => (["dew","torrent","thorn"] as const).map(role => canonicalHit(result,cast,context,role,representative(role)));
  let independentId: string | undefined;
  if (result.scope === "single-hit") {
    const independent = context.independentEvent;
    if (independent) {
      independentId = `${cast.skillId}:${independent.candidateId}`;
      result.hits = [...old.values()].filter(hit => hit.id !== independentId);
      result.hits.push(canonicalHit(result,cast,context,independent.templateRole,old.get(independentId) ?? representative(independent.templateRole),independent));
    } else result.hits = old.size ? [...old.values()].map(hit => {
      const event = hit.travelerHydroResolvedEvent;
      if (event) return canonicalHit(result,cast,context,event.templateRole,hit,event);
      const role = (["dew","torrent","thorn"] as const).find(key => cast.roles[key].mappingId === hit.id);
      return role ? canonicalHit(result,cast,context,role,hit) : hit;
    }) : representatives();
  } else {
    const schedule = compileTravelerHydroResolvedSchedule(cast.skillId as TravelerHydroResolvedCastKind,context);
    missing.push(...schedule.issues);
    result.hits = schedule.complete ? schedule.instances.map(event => canonicalHit(result,cast,context,event.templateRole,old.get(`${cast.skillId}:${event.candidateId}`) ?? representative(event.templateRole),event)) : representatives();
    if (!result.hits.length) result.hits = [{ id: `${cast.skillId}:no-contact`, kind: "non-damaging", label: "本次完整长E对所选目标全部落空", reason: "全部已发出的来源事件均明确没有命中，不生成最大命中数。", sourceRefs: refs, dependencies: [sourceId] }];
  }
  const retained = result.hits.filter(hit => selected.has(hit.id)).map(hit => hit.id);
  result.selectedHitIds = result.scope === "single-hit" ? [independentId ?? retained[0] ?? result.hits[0]!.id] : selectedAll || !retained.length ? result.hits.map(hit => hit.id) : retained;
  const dependency = (id: string, issues: string[], hits: CalculatorHit[]) => {
    result.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || "本击来源、实际生命取样与已含加算份额明确。", sourceRefs: refs });
    hits.forEach(hit => { hit.dependencies = [...new Set([...hit.dependencies,id])]; });
  };
  dependency(`${prefix}schedule`,[...new Set(missing)],result.hits);
  for (const hit of result.hits) if (hit.kind === "ordinary") {
    const event = hit.travelerHydroResolvedEvent, state = stateOf(context,hit), issues: string[] = [];
    if (!event) issues.push("请选择一个已发生的来源事件，并输入本击角色、帧与实际生命状态；数值模板不能代替实际充盈资格。");
    else {
      if (event.observedSourceEvent !== true) issues.push("请明确这是本次动作中实际发生的该来源事件；不要求之后的日程。");
      if (event.launchFrame > event.frame || event.snapshotFrame > event.frame) issues.push("本击发射或进攻取样不得晚于实际命中。");
      if (context.targetId && event.targetId !== context.targetId) issues.push("本击目标与当前明确目标不同，不能沿用旧接触记录。");
      if (result.scope !== "single-hit" && context.statsStableAcrossHits !== true && !context.snapshots?.[event.snapshotId]) issues.push(`需要${event.snapshotId}的实际历史进攻面板，或明确共同面板代表各击实际取样。`);
      if (result.scope === "single-hit" && old.get(hit.id)?.finalSnapshot && !hit.finalSnapshot) issues.push("本击历史快照已删除或失效；请重新输入实际快照／应用构筑，不能静默退回共同面板。");
      if (event.templateRole === "dew" && (event.actualMaxHp === undefined || event.actualCurrentHp === undefined)) issues.push("露滴需要实际生命资格读取点的当前生命与生命上限；不从未来治疗或共同面板猜测。");
      if (event.actualCurrentHp !== undefined && event.actualMaxHp !== undefined && event.actualCurrentHp > event.actualMaxHp) issues.push("本击生命资格观察的当前生命超过上限。");
      const ascension = ascensionOf(result,hit);
      if (event.templateRole === "torrent" && ascension === undefined) issues.push("结束激流需要实际突破阶段，以判断A4是否解锁。");
      if (event.templateRole === "torrent" && ascension !== undefined && ascension >= 4 && event.consumedHpThisCast === undefined) issues.push("A4需要此施放结束前的实际充盈扣血总和，不能用起手零值、外部扣血或上一轮值代替。");
      if (event.templateRole === "thorn" && (hit.reaction !== "none" || hit.additiveReaction !== undefined)) issues.push("本来源灵息之刺不产生元素附着反应，不能直接套用蒸发／激化伤害。");
      if (state.includedSourceFlatDamage === undefined) issues.push("请明确本击加算底值／历史快照已包含的充盈或A4份额；0表示明确未含。");
      if (state.includedSourceFlatDamage !== undefined) {
        const inputs: CalculatorFormula["inputs"] = [{ key: "included", value: state.includedSourceFlatDamage, unit: "damage", origin: "explicit-panel-accounting", meaningKey: "本击已有加算底值中已包含的充盈或A4份额" }];
        let bonus: ReturnType<typeof expr.value> | undefined;
        if (event.templateRole === "dew" && event.actualMaxHp !== undefined && event.actualCurrentHp !== undefined) {
          inputs.push({ key: "actualMaxHp", value: event.actualMaxHp, unit: "HP", origin: "observed-hp-state", meaningKey: "本露滴实际充盈资格读取点生命上限" });
          inputs.push({ key: "actualCurrentHp", value: event.actualCurrentHp, unit: "HP", origin: "observed-hp-state", meaningKey: "本露滴实际充盈资格读取点当前生命，严格高于50%才合格" });
          bonus = expr.condition("lte",expr.input("actualCurrentHp"),expr.mul(expr.input("actualMaxHp"),expr.value(.5)),expr.value(0),expr.mul(expr.input("actualMaxHp"),expr.value(cast.suffusionBonusValues[game.effectiveTalentLevel-1]!)));
        } else if (event.templateRole === "torrent" && ascension !== undefined && (ascension < 4 || event.consumedHpThisCast !== undefined)) {
          if (ascension >= 4) inputs.push({ key: "consumedHp", value: event.consumedHpThisCast!, unit: "HP", origin: "this-cast-suffusion-ledger", meaningKey: "严格属于此次结束点之前的充盈扣血总量，不含外部损血" });
          bonus = ascension < 4 ? expr.value(0) : expr.min(expr.value(5000),expr.mul(expr.input("consumedHp"),expr.value(.45)));
        } else if (event.templateRole === "thorn") bonus = expr.value(0);
        if (bonus) hit.additiveBaseFormula = { ruleId: `${prefix}${event.templateRole}-flat`, label: "水主充盈／A4：实际本击来源加算减已含份额", expression: expr.sub(bonus,expr.input("included")), inputs, sourceRefs: refs };
      }
    }
    if (context.finalizedHitEvents && context.finalizedHitEvents[hit.id] !== identity(result,context,hit)) issues.push("本击事件、生命值、快照或已含份额改变；旧物化属性不可沿用，请重新应用构筑或输入实际面板。");
    dependency(`${prefix}${hit.id}`,issues,[hit]);
  }
  const relevant = new Set(result.hits.filter(hit => result.selectedHitIds.includes(hit.id)).flatMap(hit => hit.dependencies));
  const ready = !result.dependencies.some(row => relevant.has(row.id) && row.status === "missing");
  game.scopeCoverage = result.scope === "single-hit" ? "single-hit" : ready && result.selectedHitIds.length === result.hits.length ? "complete-cast" : "selected-components";
  game.attributionPolicy = "C0水主充盈长E的实际完整自身伤害观察；生命账本按明确帧／同帧顺序重放，露滴取本击实际资格，结束激流只用本次充盈消耗。独立本击不依赖未来日程。";
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("水主充盈裁决：")),
    "水主充盈裁决：Optimizer与原始游戏文本确定4%MaxHP、逐露滴资格及本次A4；旧gcsim相冲突代码完整归档。",
    "水主充盈裁决：自动耗血时点与同帧生命读取顺序尚未独立裁决，使用显式实际观察，不宣称自动生命周期、当前游戏实测或团队支持。"];
  return result;
}
export function resetTravelerHydroResolvedPanelAccounting(document: CalculatorDocument, mode: "fresh-equipment" | "imported-final"): void {
  if (!isTravelerHydroResolvedCastAction(document)) return;
  const context = document.gameContext!.travelerHydroResolvedCast ??= {}; delete context.finalizedHitEvents;
  for (const hit of document.hits) if (hit.kind === "ordinary") {
    if (hit.finalSnapshot?.origin === "equipment-conversion") delete hit.finalSnapshot;
    if (!hit.finalSnapshot) {
      const state = (context.hitStates ??= {})[hit.id] ??= {};
      if (mode === "fresh-equipment") state.includedSourceFlatDamage = 0;
      else delete state.includedSourceFlatDamage;
    }
  }
  if (mode === "fresh-equipment") (context.sharedState ??= {}).includedSourceFlatDamage = 0;
  else if (context.sharedState) delete context.sharedState.includedSourceFlatDamage;
}
export function finalizeTravelerHydroResolvedPanelAccounting(document: CalculatorDocument): void {
  if (!isTravelerHydroResolvedCastAction(document)) return;
  const context = document.gameContext!.travelerHydroResolvedCast ??= {};
  // The converter does not fold this source additiveBaseFormula into the common panel.
  context.finalizedHitEvents = Object.fromEntries(document.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => [hit.id,identity(document,context,hit)]));
}
export function travelerHydroResolvedEventTrace(hit: CalculatorHit): CalculationTraceNode[] {
  if (hit.kind !== "ordinary" || !hit.travelerHydroResolvedEvent) return [];
  const event = hit.travelerHydroResolvedEvent, trace = new TraceBuilder(hit.sourceRefs);
  for (const [key,value,label] of [["launchFrame",event.launchFrame,"实际发射帧"],["frame",event.frame,"实际伤害交付帧"],["snapshotFrame",event.snapshotFrame,"实际进攻取样帧"],["actualCurrentHp",event.actualCurrentHp,"充盈资格读取时当前生命"],["actualMaxHp",event.actualMaxHp,"充盈资格读取时生命上限"],["consumedHpThisCast",event.consumedHpThisCast,"此次结束前累计充盈消耗"]] as const) {
    if (value === undefined) continue;
    trace.add(`${prefix}${key}`,label,expr.input(key),[traceInput(key,value,key.includes("Frame") || key === "frame" ? "frames" : "HP","explicit-observed-source-event",`${event.candidateId}；目标${event.targetId}；不由未来日程补造`)]);
  }
  return trace.nodes;
}
