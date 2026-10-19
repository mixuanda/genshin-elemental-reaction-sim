import type { CalculatorDocument, CalculatorHit } from "./calculator-model";
import { sandroneObservedLifecycleSchema, type SandroneObservedEvent, type SandroneObservedLifecycle } from "./sandrone-observed-context";
import { prepareObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

type Mode = "inactive" | "decoding" | "overdrive";
type Radiance = "none" | "stellar-conduct" | "stellar-swirl";
type State = { heat?: number | undefined; mode?: Mode | undefined; radiance?: Radiance | undefined };
export type SandroneObservedHit = { event: SandroneObservedEvent; state: State; sourceSkillId?: string; sourceHitId?: string; specialComponentId?: string; issues: string[] };
export type SandroneObservedReduction = { states: Array<{ eventId: string; frame: number; state: State }>; hits: SandroneObservedHit[]; issues: string[]; observedWindowComplete: boolean; completeChargedCycleCertified: false };

export const SANDRONE_OBSERVED_SOURCE_REFS = [
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/sheets/src/Characters/Sandrone/index.tsx",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/dm-localization/assets/locales/en/char_Sandrone_gen.json",
  "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/libs/gi/stats/Data/Characters/Sandrone/skillParam.json",
];

const specialId = (kind: "beam" | "prism-2" | "ray", radiance: Exclude<Radiance, "none">): string => {
  const part = { beam: "charged-beam", "prism-2": "skill-prism", ray: "burst-ray" }[kind];
  return `sandrone-${part}-${radiance}-component`;
};

function resolveHit(event: SandroneObservedEvent, state: State): SandroneObservedHit {
  const result: SandroneObservedHit = { event, state: { ...state }, issues: [] };
  if (event.contact !== true) result.issues.push("所选事件没有确认命中目标；不能把一次落空计入伤害。");
  switch (event.hitKind) {
    case "sweep":
      if (state.mode !== "decoding") result.issues.push("扫射需要本击实际处于解析模式。");
      // The pinned sheet gates condensed beams on Radiance, while sweepDmg
      // remains an unconditional ordinary Cryo charged component.
      result.sourceSkillId = "sandrone-charged-sweepdmg-component";
      result.sourceHitId = `${result.sourceSkillId}-hit-1`;
      break;
    case "beam":
      if (state.mode !== "decoding") result.issues.push("凝聚光束需要本击实际处于解析模式。");
      if (state.radiance === undefined) result.issues.push("光束需要本击实际辉映；不能从相邻事件推断。");
      else if (state.radiance === "none") {
        result.sourceSkillId = "sandrone-charged-beamdmg-component";
        result.sourceHitId = `${result.sourceSkillId}-hit-1`;
      } else result.specialComponentId = specialId("beam", state.radiance);
      break;
    case "overdrive":
      if (state.mode !== "overdrive") result.issues.push("超载射击需要本击实际处于超载模式。");
      // Likewise overdriveDmg is not replaced by the beam's Stellar branch.
      result.sourceSkillId = "sandrone-charged-overdrivedmg-component";
      result.sourceHitId = `${result.sourceSkillId}-hit-1`;
      break;
    case "prism-1":
      if (state.radiance !== "none") result.issues.push("当前普通第一棱镜弹来源映射只审阅无辉映状态；此观察需独立来源映射。");
      result.sourceSkillId = "sandrone-skill-no-radiance";
      result.sourceHitId = "sandrone-skill-no-radiance-hit-1-instance-1";
      break;
    case "prism-2":
      if (state.radiance === undefined) result.issues.push("第二棱镜弹需要本击实际辉映。");
      else if (state.radiance === "none") {
        result.sourceSkillId = "sandrone-skill-no-radiance";
        result.sourceHitId = "sandrone-skill-no-radiance-hit-1-instance-2";
      } else result.specialComponentId = specialId("prism-2", state.radiance);
      break;
    case "ray":
      if (state.radiance === undefined) result.issues.push("射线需要本击实际辉映。");
      else if (state.radiance === "none") {
        result.sourceSkillId = "sandrone-burst-no-radiance";
        result.sourceHitId = "sandrone-burst-no-radiance-hit-2";
      } else result.specialComponentId = specialId("ray", state.radiance);
      break;
    default:
      result.issues.push("未知命中组成；不能从时间顺序生成伤害。");
  }
  return result;
}

/** Events are supplied in observed order, including a deliberate order for equal frames. */
export function reduceSandroneObservedLifecycle(input: SandroneObservedLifecycle, throughEventId?: string): SandroneObservedReduction {
  const context = sandroneObservedLifecycleSchema.parse(input);
  const state: State = { heat: context.initialHeat, mode: context.initialMode, radiance: context.initialRadiance };
  const states: SandroneObservedReduction["states"] = [], hits: SandroneObservedHit[] = [], issues: string[] = [];
  if (state.mode === "decoding" && state.heat === 100) issues.push("起始解析模式与已知100热量进入超载冲突。");
  if (state.mode === "overdrive" && state.heat !== undefined && state.heat < 50) issues.push("起始超载模式与已知低于50退出冲突。");
  const seen = new Set<string>();
  let previousFrame = -1, reached = throughEventId === undefined;
  for (const event of context.events) {
    if (seen.has(event.id)) issues.push(`观察事件 ${event.id} 重复。`);
    seen.add(event.id);
    if (event.frame < previousFrame) issues.push(`事件 ${event.id} 早于前一条；数组顺序须为实际观察顺序。`);
    previousFrame = event.frame;
    if (event.kind === "observe-heat" || event.kind === "hit" && event.heat !== undefined) {
      state.heat = event.heat;
      if (state.mode === "decoding" && state.heat === 100) state.mode = "overdrive";
      else if (state.mode === "overdrive" && state.heat !== undefined && state.heat < 50) state.mode = "inactive";
    }
    if (event.kind === "observe-mode") {
      if (state.mode === "overdrive" && event.mode === "decoding" && (state.heat === undefined || state.heat >= 50))
        issues.push(`事件 ${event.id} 在超载未证实低于50退出前切回解析，与来源冲突。`);
      state.mode = event.mode;
      if (state.mode === "decoding" && state.heat === 100) issues.push(`事件 ${event.id} 的解析模式与已知100热量进入超载冲突。`);
      if (state.mode === "overdrive" && state.heat !== undefined && state.heat < 50) issues.push(`事件 ${event.id} 的超载模式与已知低于50退出冲突。`);
    }
    if (event.kind === "observe-radiance") state.radiance = event.radiance;
    states.push({ eventId: event.id, frame: event.frame, state: { ...state } });
    if (event.kind === "hit") hits.push(resolveHit(event, state));
    if (event.id === throughEventId) { reached = true; break; }
  }
  if (!reached) issues.push(`未找到绑定的观察事件 ${throughEventId}。`);
  return { states, hits, issues, observedWindowComplete: context.completeObservation === true && !issues.length && hits.every((hit) => !hit.issues.length) && reached, completeChargedCycleCertified: false };
}

/** Returns only the selected hit's prefix replay, so future observations cannot alter it. */
export function bindSandroneObservedHit(context: SandroneObservedLifecycle, eventId: string): SandroneObservedHit {
  const reduction = reduceSandroneObservedLifecycle(context, eventId);
  const hit = reduction.hits.find((row) => row.event.id === eventId);
  if (!hit) throw new Error(`没有已观察的桑多涅命中事件 ${eventId}。`);
  return { ...hit, issues: [...reduction.issues, ...hit.issues] };
}

/** Optional ledger validation; unbound independent hits retain their existing calculator entry. */
export function prepareSandroneObservedLifecycleDocument(document: CalculatorDocument): CalculatorDocument {
  const raw = document.gameContext?.sandroneObservedLifecycle;
  if (!raw || !document.gameContext || !document.gameContext.skillId.startsWith("sandrone-")) return document;
  let result = structuredClone(document);
  const context = sandroneObservedLifecycleSchema.parse(raw);
  result.gameContext!.sandroneObservedLifecycle = context;
  const bindings = result.hits.flatMap((hit) => context.hitBindings?.[hit.id] ? [{ hit, eventId: context.hitBindings[hit.id]! }] : []);
  if (!bindings.length) return result;
  const reports = bindings.map(({ hit, eventId }) => {
    let bound: SandroneObservedHit;
    try { bound = bindSandroneObservedHit(context, eventId); }
    catch { return { hitId: hit.id, eventId, issues: [`未找到绑定的实际命中事件 ${eventId}。`] }; }
    const issues = [...bound.issues];
    if (bound.sourceSkillId && bound.sourceSkillId !== result.gameContext!.skillId) issues.push("观察命中与当前普通来源动作不一致。");
    if (bound.sourceHitId && bound.sourceHitId !== hit.id) issues.push("观察命中与当前普通来源分段不一致。");
    if (bound.specialComponentId && bound.specialComponentId !== result.gameContext!.skillId) issues.push("观察命中与当前星导／星旋特殊组成不一致。");
    if (hit.kind === "special" && bound.specialComponentId === result.gameContext!.skillId && !issues.length) {
      const special = result.gameContext!.observedSpecialComponent ??= {};
      special.actualComponentOccurred = true;
      special.independentEvent = {
        candidateId: bound.event.id, frame: bound.event.frame, snapshotFrame: bound.event.snapshotFrame!,
        snapshotId: bound.event.snapshotId!, targetId: bound.event.targetId!,
      };
      special.sharedState ??= {};
      const generatedId = `${result.gameContext!.skillId}:${bound.event.id}`;
      special.hitStates ??= {};
      const state = special.hitStates[generatedId] ??= structuredClone(special.hitStates[hit.id] ?? {});
      state.actualRadiance = bound.state.radiance === "none" ? undefined : bound.state.radiance;
      if (bound.event.hitKind === "beam") state.decodingMode = bound.state.mode === "decoding";
      if (bound.event.hitKind === "prism-2" && bound.state.heat !== undefined) state.decodingPowerAtSkill = bound.state.heat;
    }
    return { hitId: hit.id, eventId, issues };
  });
  if (result.gameContext?.observedSpecialComponent) result = prepareObservedSpecialComponentDocument(result);
  const activeContext = result.gameContext!.sandroneObservedLifecycle!;
  for (const report of reports) if (!report.issues.length && result.hits.length === 1 && result.hits[0]!.kind === "special") {
    const newId = result.hits[0]!.id;
    if (newId !== report.hitId) {
      delete activeContext.hitBindings?.[report.hitId];
      (activeContext.hitBindings ??= {})[newId] = report.eventId;
      report.hitId = newId;
    }
  }
  const prefix = "sandrone-observed:";
  result.dependencies = result.dependencies.filter((dependency) => !dependency.id.startsWith(prefix));
  for (const report of reports) {
    const hit = result.hits.find((row) => row.id === report.hitId) ?? result.hits[0];
    const id = `${prefix}${report.hitId}`;
    result.dependencies.push({ id, status: report.issues.length ? "missing" : "provisional", reason: report.issues.join("；") || "本击的观察顺序、实际接触、模式和辉映已绑定。", sourceRefs: SANDRONE_OBSERVED_SOURCE_REFS });
    if (hit) hit.dependencies = [...new Set([...hit.dependencies.filter((value) => !value.startsWith(prefix)), id])];
  }
  if (result.scope !== "single-hit" && (reports.some((report) => report.issues.length) ||
    result.selectedHitIds.some((id) => activeContext.hitBindings?.[id] === undefined)))
    result.gameContext!.scopeCoverage = "selected-components";
  return result;
}

/** Document-level provenance for the selected ledger-bound hit. */
export function sandroneObservedTrace(document: CalculatorDocument): CalculationTraceNode[] {
  const context = document.gameContext?.sandroneObservedLifecycle;
  if (!context) return [];
  const builder = new TraceBuilder(SANDRONE_OBSERVED_SOURCE_REFS);
  for (const hit of document.hits.filter((row) => document.selectedHitIds.includes(row.id))) {
    const eventId = context.hitBindings?.[hit.id];
    if (!eventId) continue;
    let bound: SandroneObservedHit;
    try { bound = bindSandroneObservedHit(context, eventId); } catch { continue; }
    if (bound.issues.length) continue;
    const reason = `${bound.event.hitKind}；模式 ${bound.state.mode ?? "未知"}；辉映 ${bound.state.radiance ?? "未知"}；只回放至事件 ${eventId}`;
    builder.add(`sandrone-observed.${eventId}.frame`, "桑多涅本击实际时点", expr.input("frame"), [traceInput("frame", bound.event.frame, "frames", "observed-event", eventId)], { unit: "frames", applicabilityReason: reason });
    if (bound.state.heat !== undefined) builder.add(`sandrone-observed.${eventId}.heat`, "桑多涅本击实际热量", expr.input("heat"), [traceInput("heat", bound.state.heat, "count", "observed-event", eventId)], { unit: "count", applicabilityReason: reason });
  }
  return builder.nodes;
}
