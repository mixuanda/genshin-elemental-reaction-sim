import definitions from "../../game-data/sources/observed-zibai-resources/definitions.json";
import { observedZibaiResourceContextSchema, type ObservedZibaiResourceContext, type ObservedZibaiResourceEvent } from "./observed-zibai-resource-context";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { CalculatorDocument } from "./calculator-model";

const constants = definitions.constants, refs = definitions.sourceRefs;
const prefix = "observed-zibai-resources:", dependencyId = `${prefix}qualification`;
const steedSkillId = "zibai-finite-spirit-steed-c0";
type ResourceGame = NonNullable<CalculatorDocument["gameContext"]> & { observedZibaiResources?: ObservedZibaiResourceContext };
const gameOf = (document: CalculatorDocument) => document.gameContext as ResourceGame | undefined;
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export interface ObservedZibaiResourceState {
  frame: number; order: number; phaseActive: boolean; phaseId?: string; radiance: number;
  releasedSteeds: number; committedSteeds: number; expiresAtFrame?: number;
  normalGainReadyAtFrame?: number; lunarGainReadyAtFrame?: number; lastNaturalGainFrame?: number;
  awaitingFourthReleaseExit: boolean;
}
export interface ObservedZibaiConsumptionProof {
  eventId: string; actionId: string; frame: number; order: number; phaseId: string;
  radianceBefore: number; cost: number; radianceAfter: number; ordinal: number;
  released: boolean; sourceRefs: string[];
}
export interface ObservedZibaiResourceResolution {
  evidenceStatus: "source-assumed";
  state?: ObservedZibaiResourceState;
  consumptions: ObservedZibaiConsumptionProof[];
  steps: Array<{ eventId: string; kind: ObservedZibaiResourceEvent["kind"]; before: ObservedZibaiResourceState; after: ObservedZibaiResourceState }>;
  trace: CalculationTraceNode[]; issues: string[]; complete: boolean; completePhase: boolean;
  processedEventIds: string[]; sourceRefs: string[]; bindingIdentity: string;
}
export interface ObservedZibaiResourceOptions {
  /** Inclusive observed event cutoff. Future event content is not evaluated. */
  throughEventId?: string;
  /** A complete phase needs an observed exit; a finite attack only needs its debit prefix. */
  requireCompletePhase?: boolean;
}

/** Recorded resource events are replayed in their supplied (frame, order), never type-sorted. */
export function resolveObservedZibaiResources(raw: ObservedZibaiResourceContext,
  options: ObservedZibaiResourceOptions = {}): ObservedZibaiResourceResolution {
  const trace = new TraceBuilder(refs), issues: string[] = [], consumptions: ObservedZibaiConsumptionProof[] = [];
  const steps: ObservedZibaiResourceResolution["steps"] = [], processedEventIds: string[] = [];
  const pending = new Map<string, ObservedZibaiConsumptionProof>();
  // Slice before event validation: an independent debit does not require even
  // the shape, count or future IDs of observations after its cutoff.
  const rawEvents = raw?.events;
  const requestedIndex = options.throughEventId === undefined ? undefined : Array.isArray(rawEvents)
    ? rawEvents.findIndex(event => event?.id === options.throughEventId) : -1;
  const selectedRaw = requestedIndex === undefined ? raw : { ...raw,
    events: Array.isArray(rawEvents) ? requestedIndex < 0 ? [] : rawEvents.slice(0, requestedIndex + 1) : rawEvents };
  const parsed = observedZibaiResourceContextSchema.safeParse(selectedRaw);
  const base = { evidenceStatus: "source-assumed" as const, consumptions, steps, trace: trace.nodes, issues, complete: false, completePhase: false, processedEventIds, sourceRefs: refs, bindingIdentity: "" };
  if (!parsed.success) { issues.push(...parsed.error.issues.map(issue => `${issue.path.join(".")}：${issue.message}`)); return base; }
  const context = parsed.data;
  for (const [key, reason] of [
    ["initialStateObserved", "需要明确初态资源、姿态与已释放次数来自实际观察。"],
    ["eventsObservedThroughCutoff", "需要确认从初态到本次截点的全部资源获得、消费和状态变化都已记录，不能遗漏。"],
    ["observedOrderConfirmed", "需要确认同帧order是真实观察顺序；不能按事件类型推导排序。"],
    ["noHitlag", "本限定账本以每秒60帧换算，并要求该观察区间没有卡肉；不自行推导暂停时钟。"],
  ] as const) if (context[key] !== true) issues.push(reason);
  if (!context.casterId) issues.push("资源账本需要明确兹白本人身份。");
  if (context.constellation !== 0) issues.push("资源账本只实现C0的70点消费与四次释放，不套用C1或C6规则。");
  const initial = context.initial;
  if (!initial) { issues.push("缺少实际资源初态。"); return base; }
  if (initial.noPendingSteedConfirmed !== true) issues.push("初态须明确没有已经消费但尚未记录释放的旧灵驹动作。");
  if (initial.phaseActive && (!initial.phaseId || initial.expiresAtFrame === undefined || initial.normalGainReadyAtFrame === undefined || initial.lunarGainReadyAtFrame === undefined)) {
    issues.push("从姿态中途开始时，需要实际姿态身份、届满帧及两类获点冷却的初态；未知不能视作已就绪。");
  }
  if (initial.phaseActive && initial.releasedSteeds >= constants.maxUses) issues.push("无待处理动作的C0姿态初态不能已释放四次而仍有效。");
  if (initial.phaseActive && initial.expiresAtFrame! < initial.frame) issues.push("初态有效姿态的届满帧不能早于初态观察时刻。");
  if (initial.lastNaturalGainFrame !== undefined && initial.lastNaturalGainFrame > initial.frame) issues.push("最近自然获点不能晚于初态；它不是预测的未来首tick。");
  const events = context.events;
  if (events === undefined) { issues.push("需要显式资源事件数组；空数组也是明确输入。"); return base; }
  const cutoffIndex = options.throughEventId === undefined ? events.length - 1 : events.findIndex(event => event.id === options.throughEventId);
  if (options.throughEventId !== undefined && cutoffIndex < 0) issues.push("指定消费或观察截点不存在，不能用其他事件代替。");
  const evaluated = cutoffIndex < 0 ? [] : events.slice(0, cutoffIndex + 1);
  const bindingIdentity = stable({ casterId: context.casterId, constellation: context.constellation, initial,
    events: evaluated, initialStateObserved: context.initialStateObserved, eventsObservedThroughCutoff: context.eventsObservedThroughCutoff,
    observedOrderConfirmed: context.observedOrderConfirmed, noHitlag: context.noHitlag, throughEventId: options.throughEventId });
  const { phaseId, expiresAtFrame, normalGainReadyAtFrame, lunarGainReadyAtFrame, lastNaturalGainFrame, ...initialRequired } = initial;
  const state: ObservedZibaiResourceState = { ...initialRequired, committedSteeds: initial.releasedSteeds, awaitingFourthReleaseExit: false,
    ...(phaseId === undefined ? {} : { phaseId }), ...(expiresAtFrame === undefined ? {} : { expiresAtFrame }),
    ...(normalGainReadyAtFrame === undefined ? {} : { normalGainReadyAtFrame }), ...(lunarGainReadyAtFrame === undefined ? {} : { lunarGainReadyAtFrame }),
    ...(lastNaturalGainFrame === undefined ? {} : { lastNaturalGainFrame }) };
  const finish = (): ObservedZibaiResourceResolution => ({ ...base, state, bindingIdentity,
    complete: issues.length === 0, completePhase: issues.length === 0 && !state.phaseActive && pending.size === 0 && steps.some(step => step.kind === "exit") });
  if (issues.length) return finish();
  const compute = (id: string, label: string, expression: FormulaExpression, values: Record<string, number>, unit: string): number =>
    trace.add(`${prefix}${id}`, label, expression, Object.entries(values).map(([key, value]) => traceInput(key, value,
      key.toLowerCase().includes("frame") ? "frames" : key.toLowerCase().includes("second") ? "seconds" : unit,
      "fixed-source-and-explicit-resource-observation", `账本输入${key}`)), { unit, sourceRefs: refs });
  const interval = (key: string, seconds: number) => compute(key, "来源时间换算为本账本帧单位", expr.mul(expr.input("seconds"), expr.input("framesPerSecond")),
    { seconds, framesPerSecond: constants.framesPerSecond }, "frames");
  const durationFrames = interval("duration", constants.durationSeconds), naturalFrames = interval("natural-interval", constants.timeIntervalSeconds);
  const normalFrames = interval("normal-interval", constants.normalIntervalSeconds), lunarFrames = interval("lunar-interval", constants.lunarIntervalSeconds);
  const extensionFrames = interval("burst-extension", constants.burstExtensionSeconds);
  compute("initial-radiance", "已观察初态资源", expr.input("observedRadiance"), { observedRadiance: state.radiance }, "points");
  let naturalAnchor = initial.lastNaturalGainFrame ?? initial.frame;
  let naturalPhaseKnown = initial.lastNaturalGainFrame !== undefined;
  let normalBoundaryNeedsObservation = initial.normalGainReadyAtFrame !== undefined && initial.normalGainReadyAtFrame > initial.frame;
  let lunarBoundaryNeedsObservation = initial.lunarGainReadyAtFrame !== undefined && initial.lunarGainReadyAtFrame > initial.frame;
  const eventIds = new Set<string>(), triggerIds = new Set<string>(), phaseIds = new Set(initial.phaseId ? [initial.phaseId] : []);
  const addGain = (event: ObservedZibaiResourceEvent, amount: number) => {
    const before = state.radiance;
    state.radiance = compute(`${event.id}.radiance`, "实际获点受100点上限限制", expr.min(expr.input("cap"), expr.add(expr.input("before"), expr.input("gain"))),
      { before, gain: amount, cap: constants.cap }, "points");
    compute(`${event.id}.overflow`, "本次超过资源上限的部分", expr.sub(expr.add(expr.input("before"), expr.input("gain")), expr.input("after")),
      { before, gain: amount, after: state.radiance }, "points");
  };
  const checkCooldown = (event: Extract<ObservedZibaiResourceEvent, { kind: "normal-gain" | "lunar-gain" }>, ready: number | undefined, boundaryNeedsObservation: boolean) => {
    if (ready === undefined) issues.push(`${event.id}缺少此前真实获点冷却状态。`);
    else if (event.frame < ready) issues.push(`${event.id}发生在来源获点冷却结束前，不能提前发放资源。`);
    else if (event.frame === ready && boundaryNeedsObservation && event.cooldownBoundaryReadyConfirmed !== true) {
      issues.push(`${event.id}位于冷却边界帧，需要明确该次实际已就绪；来源文本未证明边界帧内部顺序。`);
    }
  };
  for (const event of evaluated) {
    const before = structuredClone(state);
    if (eventIds.has(event.id)) issues.push(`资源事件ID重复：${event.id}。`);
    if (event.frame < state.frame || event.frame === state.frame && event.order <= state.order) issues.push(`${event.id}未严格晚于上一条(frame,order)，不能重排真实观察。`);
    if (event.kind !== "enter" && event.kind !== "steed-release" && !state.phaseActive) issues.push(`${event.id}需要有效隙中月姿态。`);
    if (state.phaseActive && event.kind !== "exit") {
      if (event.frame > state.expiresAtFrame!) issues.push(`${event.id}晚于姿态时长上限，缺少合法延长或已经退出。`);
      if (event.frame === state.expiresAtFrame && event.phaseActiveAtBoundaryConfirmed !== true) issues.push(`${event.id}位于姿态结束边界帧，需要实际仍有效的观察，不能猜测同帧先后。`);
    }
    if (state.phaseActive && event.frame - naturalAnchor > naturalFrames) issues.push(`${event.id}之前超过一秒却未记录自然获点；账本可能遗漏事件，不补造首tick。`);
    if (issues.length) break;
    eventIds.add(event.id);
    switch (event.kind) {
      case "enter": {
        if (state.phaseActive) { issues.push("已有姿态有效时不能把E重施当作新进入并重置资源。"); break; }
        if (phaseIds.has(event.phaseId)) { issues.push("新的姿态必须使用独立身份，不能覆盖旧账本阶段。"); break; }
        if (pending.size) { issues.push("旧动作尚有未记录的释放，不能在新姿态中挪用其资源消费。"); break; }
        phaseIds.add(event.phaseId);
        state.phaseActive = true; state.phaseId = event.phaseId;
        state.radiance = compute(`${event.id}.initial-radiance`, "本次进入时已观察资源", expr.input("observedRadiance"), { observedRadiance: event.initialRadiance }, "points");
        state.releasedSteeds = 0; state.committedSteeds = 0; state.awaitingFourthReleaseExit = false;
        state.expiresAtFrame = compute(`${event.id}.expires`, "新姿态基础15秒届满帧", expr.add(expr.input("entryFrame"), expr.input("durationFrames")),
          { entryFrame: event.frame, durationFrames }, "frames");
        state.normalGainReadyAtFrame = event.normalGainReadyAtFrame; state.lunarGainReadyAtFrame = event.lunarGainReadyAtFrame;
        delete state.lastNaturalGainFrame; naturalAnchor = event.frame; naturalPhaseKnown = false;
        normalBoundaryNeedsObservation = event.normalGainReadyAtFrame > event.frame;
        lunarBoundaryNeedsObservation = event.lunarGainReadyAtFrame > event.frame;
        break;
      }
      case "natural-gain": {
        if (naturalPhaseKnown && event.frame - naturalAnchor !== naturalFrames) { issues.push("已观察首tick后，自然获点需相隔实际一秒；不能合并或补造中间获点。"); break; }
        addGain(event, constants.timeGain); state.lastNaturalGainFrame = event.frame; naturalAnchor = event.frame; naturalPhaseKnown = true;
        break;
      }
      case "normal-gain": {
        if (event.actorId !== context.casterId || event.enemyHitConfirmed !== true) issues.push("普通攻击获点必须来自兹白本人的实际敌人命中。");
        if (triggerIds.has(`normal:${event.hitId}`)) issues.push("同一个普通命中不能重复发放5点资源。");
        checkCooldown(event, state.normalGainReadyAtFrame, normalBoundaryNeedsObservation);
        if (issues.length) break;
        triggerIds.add(`normal:${event.hitId}`); addGain(event, constants.normalGain);
        state.normalGainReadyAtFrame = compute(`${event.id}.cooldown`, "普通命中获点下一冷却边界", expr.add(expr.input("eventFrame"), expr.input("intervalFrames")),
          { eventFrame: event.frame, intervalFrames: normalFrames }, "frames");
        normalBoundaryNeedsObservation = true;
        break;
      }
      case "lunar-gain": {
        if (event.nearbyPartyTriggerConfirmed !== true || event.moonsignLevel < constants.requiredMoonsign) issues.push("35点获点需要Ascendant Gleam及附近队伍成员真实触发月结晶；伤害标签本身不能代替反应事件。");
        if (triggerIds.has(`lunar:${event.reactionId}`)) issues.push("同一次月结晶反应不能重复发放35点资源。");
        checkCooldown(event, state.lunarGainReadyAtFrame, lunarBoundaryNeedsObservation);
        if (issues.length) break;
        triggerIds.add(`lunar:${event.reactionId}`); addGain(event, constants.lunarGain);
        state.lunarGainReadyAtFrame = compute(`${event.id}.cooldown`, "月结晶获点下一冷却边界", expr.add(expr.input("eventFrame"), expr.input("intervalFrames")),
          { eventFrame: event.frame, intervalFrames: lunarFrames }, "frames");
        lunarBoundaryNeedsObservation = true;
        break;
      }
      case "steed-consume": {
        if (state.radiance < constants.cost) issues.push(`${event.id}实际只有${state.radiance}点，未达到70点，不能释放灵驹或重置月结晶冷却。`);
        if (state.committedSteeds >= constants.maxUses) issues.push("C0每姿态最多四次灵驹，不能为第五次预支资源。");
        if (consumptions.some(proof => proof.actionId === event.actionId)) issues.push("同一动作身份不能重复消费70点。");
        if (issues.length) break;
        const radianceBefore = state.radiance;
        state.radiance = compute(`${event.id}.radiance`, "本次灵驹真实消费70点", expr.sub(expr.input("before"), expr.input("cost")),
          { before: state.radiance, cost: constants.cost }, "points");
        state.committedSteeds = compute(`${event.id}.ordinal`, "当前姿态已消费的灵驹次数", expr.add(expr.input("priorUses"), expr.value(1)), { priorUses: state.committedSteeds }, "count");
        const proof: ObservedZibaiConsumptionProof = { eventId: event.id, actionId: event.actionId, frame: event.frame, order: event.order,
          phaseId: state.phaseId!, radianceBefore, cost: constants.cost, radianceAfter: state.radiance, ordinal: state.committedSteeds, released: false, sourceRefs: refs };
        consumptions.push(proof); pending.set(event.id, proof);
        break;
      }
      case "steed-release": {
        const proof = pending.get(event.consumptionEventId);
        if (!proof || proof.phaseId !== state.phaseId) { issues.push("实际灵驹释放必须引用本姿态内尚未释放的有效70点消费；失败尝试不能重置冷却。"); break; }
        proof.released = true; pending.delete(proof.eventId);
        state.releasedSteeds = compute(`${event.id}.released`, "实际已释放灵驹次数", expr.add(expr.input("releasedUses"), expr.value(1)), { releasedUses: state.releasedSteeds }, "count");
        state.lunarGainReadyAtFrame = compute(`${event.id}.lunar-reset`, "真实释放重置月结晶获点冷却", expr.input("releaseFrame"), { releaseFrame: event.frame }, "frames");
        lunarBoundaryNeedsObservation = false;
        // The source proves that four releases end the mode, but not which
        // same-frame callback precedes the observed exit. Do not reorder them.
        state.awaitingFourthReleaseExit = state.phaseActive && state.releasedSteeds >= constants.maxUses;
        break;
      }
      case "burst-cast": {
        if (triggerIds.has(`burst:${event.castId}`)) { issues.push("同一次Q不能重复延长姿态。"); break; }
        triggerIds.add(`burst:${event.castId}`);
        state.expiresAtFrame = compute(`${event.id}.expires`, "姿态内实际Q延长1.7秒", expr.add(expr.input("oldExpiryFrame"), expr.input("extensionFrames")),
          { oldExpiryFrame: state.expiresAtFrame!, extensionFrames }, "frames");
        break;
      }
      case "exit": {
        if (event.reason === "four-steeds" && state.releasedSteeds !== constants.maxUses) issues.push("四次释放退出需要账本中恰好四次真实释放，消费次数不能代替释放次数。");
        if (event.reason === "duration" && event.frame !== state.expiresAtFrame) issues.push("时长退出须对应当前15秒及已记录Q延长后的届满帧；其他实际提前退出应明确单独记录。");
        if (issues.length) break;
        state.phaseActive = false; state.awaitingFourthReleaseExit = false;
        // The source does not specify whether unused points are visibly erased.
        // Preserve the observed last balance; an independent entry supplies its reading.
        break;
      }
    }
    if (issues.length) break;
    state.frame = event.frame; state.order = event.order; processedEventIds.push(event.id);
    steps.push({ eventId: event.id, kind: event.kind, before, after: structuredClone(state) });
  }
  if (options.requireCompletePhase && (state.phaseActive || !steps.some(step => step.kind === "exit"))) issues.push("完整姿态账本需要真实退出记录；有限本次攻击只需要其消费前缀。");
  if (options.requireCompletePhase && pending.size) issues.push("完整姿态仍有已消费但未记录释放的动作，不能称为闭合账本。");
  return finish();
}

/** Run before the finite-hit compiler to supply derived legality, and after it to attach this dependency. */
export function prepareObservedZibaiResourceDocument(document: CalculatorDocument): CalculatorDocument {
  const originalGame = gameOf(document);
  if (originalGame?.skillId !== steedSkillId || !originalGame.observedZibaiResources) return document;
  const result = structuredClone(document), game = gameOf(result)!, context = game.observedZibaiResources!;
  const ledger = resolveObservedZibaiResources(context, context.consumptionEventId === undefined ? {} : { throughEventId: context.consumptionEventId });
  const issues = [...ledger.issues];
  if (game.constellation !== 0) issues.push("当前伤害文档不是C0，不能用C0资源账本授权本次灵驹。");
  if (!context.consumptionEventId) issues.push("需要绑定本次有限灵驹动作的唯一70点消费事件。");
  const proof = ledger.consumptions.find(row => row.eventId === context.consumptionEventId);
  if (!proof) issues.push("账本尚未证明本次动作的70点实际消费资格。");
  const finite = game.zibaiFiniteCast ??= {};
  if (finite.casterId && finite.casterId !== context.casterId) issues.push("伤害来源角色身份与资源账本持有者不同。");
  if (!finite.casterId && context.casterId) finite.casterId = context.casterId;
  const selectedEvents = result.scope === "single-hit"
    ? finite.independentEvent ? [finite.independentEvent] : result.hits.filter(hit => result.selectedHitIds.includes(hit.id))
      .flatMap(hit => (hit.kind === "ordinary" || hit.kind === "special") && hit.zibaiFiniteEvent ? [hit.zibaiFiniteEvent] : [])
    : finite.observations ?? [];
  if (proof && selectedEvents.some(event => event.frame < proof.frame)) issues.push("所绑定的实际伤害不能早于它的70点消费，不能挪用未来资源。");
  if (context.finalizedBindingIdentity !== undefined && context.finalizedBindingIdentity !== ledger.bindingIdentity) {
    issues.push("本次资源初态、事件前缀或绑定消费已改变，旧物化面板不能沿用；请重新应用构筑或输入实际面板。");
  }
  finite.legalCastConfirmed = issues.length === 0; finite.spiritSteedRecastConfirmed = issues.length === 0;
  if (issues.length && result.scope !== "single-hit") game.scopeCoverage = "selected-components";
  result.dependencies = result.dependencies.filter(row => row.id !== dependencyId);
  result.dependencies.push({ id: dependencyId, status: issues.length ? "missing" : "provisional",
    reason: issues.join("；") || "实际观察账本已证明本次70点消费；资源文本来自固定Optimizer，首tick与同帧顺序仍为明确观察输入。", sourceRefs: refs });
  for (const hit of result.hits) hit.dependencies = [...new Set([...hit.dependencies, dependencyId])];
  result.assumptions = [...result.assumptions.filter(row => !row.startsWith("兹白资源账本：")),
    "兹白资源账本：只验证明确初态至绑定消费的实际事件前缀；不生成首tick、不把月结晶伤害标签当触发事件、不自动模拟队友或未来姿态。"];
  return result;
}

export function resetObservedZibaiResourcePanelAccounting(document: CalculatorDocument): void {
  const context = gameOf(document)?.observedZibaiResources;
  if (context) delete context.finalizedBindingIdentity;
}
export function finalizeObservedZibaiResourcePanelAccounting(document: CalculatorDocument): void {
  const game = gameOf(document), context = game?.observedZibaiResources;
  if (game?.skillId !== steedSkillId || !context?.consumptionEventId) return;
  const ledger = resolveObservedZibaiResources(context, context.consumptionEventId === undefined ? {} : { throughEventId: context.consumptionEventId });
  if (ledger.complete) context.finalizedBindingIdentity = ledger.bindingIdentity;
}
export function observedZibaiResourceEventTrace(document: CalculatorDocument): CalculationTraceNode[] {
  const game = gameOf(document), context = game?.observedZibaiResources;
  if (game?.skillId !== steedSkillId || !context?.consumptionEventId) return [];
  return resolveObservedZibaiResources(context, context.consumptionEventId === undefined ? {} : { throughEventId: context.consumptionEventId }).trace;
}
