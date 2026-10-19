import { neferObservedContextSchema, type NeferObservedContext, type NeferObservedEvent } from "./nefer-observed-context";
import { neferOrdinarySourceEvidence } from "../../game-data/src/character-mappings/nefer-ordinary-source";
import type { CalculatorDocument, CalculatorHit } from "./calculator-model";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

const base = "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/";
export const NEFER_OBSERVED_SOURCE_REFS = [
  `${base}libs/gi/sheets/src/Characters/Nefer/index.tsx#L83-L111`,
  `${base}libs/gi/sheets/src/Characters/Nefer/index.tsx#L144-L206`,
  `${base}libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json`,
  `${base}libs/gi/dm-localization/assets/locales/en/tooltips_gen.json#L218-L247`,
];
const constants = neferOrdinarySourceEvidence.sourceConstants;
const frames = (seconds: number): number => seconds * 60;
const before = (a: { frame: number; order: number }, b: { frame: number; order: number }): boolean =>
  a.frame < b.frame || a.frame === b.frame && a.order < b.order;
type Veil = { expiresAt: number };
type C4Target = { status: "near" } | { status: "residual"; expiresAt: number };

export interface NeferObservedRecord {
  eventId: string;
  kind: NeferObservedEvent["kind"];
  frame: number;
  order: number;
  targetId?: string;
  effect: string;
  dew: number;
  veilStacks: number;
  phantasmsUsed: number;
  shadowDanceActive: boolean;
  fullVeilEmActive?: boolean | undefined;
  emWindowExpiresAt?: number | undefined;
  c4TargetDebuffActive?: boolean | undefined;
  c4ResidualExpiresAt?: number | undefined;
  contactConfirmed?: boolean;
}
export interface NeferObservedResolution {
  records: NeferObservedRecord[];
  issues: string[];
  complete: boolean;
  dew: number;
  phantasmsUsed: number;
  veils: Record<string, Veil>;
  emWindowExpiresAt?: number | undefined;
  shadowDanceActive: boolean;
  c4Targets: Record<string, C4Target>;
}

/** Replays only observed callbacks through the requested hit; it schedules no E impact or Dew gain. */
export function resolveNeferObservedLifecycle(raw: NeferObservedContext, throughEventId?: string): NeferObservedResolution {
  const c = neferObservedContextSchema.parse(raw);
  const issues: string[] = [], records: NeferObservedRecord[] = [];
  const veils = new Map(c.initialVeils.map(row => [row.id, { expiresAt: row.expiresAt }]));
  const c4Targets = new Map<string, C4Target>(Object.entries(c.initialC4Targets));
  const casts = new Set<string>(), c2Grants = new Set<string>(), seeds = new Set<string>(), dewIds = new Set<string>(), phantasmIds = new Set<string>();
  const usedVeilIds = new Set(c.initialVeils.map(row => row.id));
  const seenEvents = new Set<string>(), seenSlots = new Set<string>();
  const events = [...c.events].sort((a, b) => a.frame - b.frame || a.order - b.order);
  const end = throughEventId === undefined ? events.length - 1 : events.findIndex(event => event.id === throughEventId);
  if (throughEventId !== undefined && end < 0) issues.push(`找不到绑定事件${throughEventId}。`);
  if (!c.eventsObservedThroughCutoff || !c.observedOrderConfirmed || !c.noHitlag) issues.push("须确认截至绑定事件的回调完整、同帧顺序和60帧每秒无停帧；来源没有本次命中帧。 ");
  if (new Set(c.initialVeils.map(row => row.id)).size !== c.initialVeils.length) issues.push("初始帷幕身份重复。");
  const maximum = c.constellation >= 2 ? constants.veilMaxStacksC2Plus : constants.veilMaxStacksC0C1;
  if (veils.size > maximum) issues.push("初始帷幕超过本命座上限。");
  if (c.constellation < 4 && c4Targets.size) issues.push("C4以下不能带入减草抗目标状态。");
  if (!c.initialShadowDanceActive && c.initialPhantasmsUsed) issues.push("初态没有影舞时，本轮已用幻戏次数必须为零。");
  if (!c.initialShadowDanceActive && [...c4Targets.values()].some(target => target.status === "near")) issues.push("初态未在影舞时，C4目标不能仍标记为附近生效。");
  if (c.initialEmWindowExpiresAt !== undefined && c.ascension < 1) issues.push("未解锁A1却存在初始满帷幕精通窗口。");
  if (c.initialEmWindowExpiresAt !== undefined && c.initialEmWindowExpiresAt < c.initialFrame) issues.push("初始精通窗口已在观察起点之前结束。");
  if (c.initialVeils.some(veil => veil.expiresAt <= c.initialFrame)) issues.push("初始帷幕须在观察起点仍有效。");
  let dew = c.initialDew, emWindowExpiresAt = c.initialEmWindowExpiresAt, shadowDanceActive = c.initialShadowDanceActive;
  let phantasmsUsed = c.initialPhantasmsUsed;
  const eligible = c.ascension >= 1 && c.moonsignCount >= 2;
  const veilDuration = frames(c.constellation >= 2 ? constants.veilDurationSecondsC2Plus : constants.veilDurationSecondsC0C1);
  const emDuration = frames(constants.fullVeilElementalMasteryDurationSeconds);
  const c4Residual = frames(constants.c4ResistanceRemovalDelaySeconds);

  function gainVeil(id: string, replacedId: string | undefined, event: NeferObservedEvent): void {
    if (usedVeilIds.has(id)) { issues.push(`${event.id}重复使用帷幕身份${id}。`); return; }
    if (veils.size >= maximum) {
      if (!replacedId || !veils.has(replacedId)) { issues.push(`${event.id}已满层，须明确实际被刷新的独立帷幕身份。`); return; }
      veils.delete(replacedId);
    } else if (replacedId) { issues.push(`${event.id}未满层却声称刷新既有帷幕。`); return; }
    usedVeilIds.add(id);
    veils.set(id, { expiresAt: event.frame + veilDuration });
    if (veils.size === maximum && eligible) emWindowExpiresAt = event.frame + emDuration;
  }
  for (const event of end < 0 ? [] : events.slice(0, end + 1)) {
    const slot = `${event.frame}:${event.order}`;
    if (!before({ frame: c.initialFrame, order: c.initialOrder }, event)) issues.push(`${event.id}不晚于已观察初态。`);
    if (seenEvents.has(event.id) || seenSlots.has(slot)) issues.push(`${event.id}的身份或同帧顺序重复。`);
    seenEvents.add(event.id); seenSlots.add(slot);
    const boundary = [...veils].filter(([, veil]) => veil.expiresAt === event.frame).map(([id]) => id);
    if (boundary.length && event.activeVeilIdsAtBoundary === undefined) issues.push(`${event.id}恰在独立帷幕到期帧，须明确仍有效的帷幕身份。`);
    if (event.activeVeilIdsAtBoundary?.some(id => !boundary.includes(id))) issues.push(`${event.id}的到期帷幕身份与当前窗口不符。`);
    for (const [id, veil] of veils) if (event.frame > veil.expiresAt || event.frame === veil.expiresAt && !event.activeVeilIdsAtBoundary?.includes(id)) veils.delete(id);
    for (const [id, target] of c4Targets) if (target.status === "residual" && event.frame > target.expiresAt) c4Targets.delete(id);
    let effect = "", fullVeilEmActive: boolean | undefined, c4TargetDebuffActive: boolean | undefined;
    let c4ResidualExpiresAt: number | undefined;
    if (event.kind === "skill-cast") {
      if (!event.actionReadyConfirmed || casts.has(event.castId)) issues.push(`${event.id}需要实际合法且唯一的E施放身份。`);
      else casts.add(event.castId);
      effect = "实际E施放已记录；C2加层、突进命中及进入影舞依各自回调顺序处理。";
    } else if (event.kind === "rush-hit") {
      if (!casts.has(event.castId)) issues.push(`${event.id}未绑定已记录的E施放。`);
      if (event.snapshotFrame > event.frame) issues.push(`${event.id}进攻面板取样晚于突进命中。`);
      if (!event.finalPanelConfirmedAtHit) issues.push(`${event.id}须确认所选面板与精通计入策略属于该实际命中。`);
      if (emWindowExpiresAt !== undefined && eligible) {
        if (event.frame === emWindowExpiresAt && event.emActiveAtExpiryBoundary === undefined) issues.push(`${event.id}恰在8秒精通到期帧，须确认本回调是否生效。`);
        fullVeilEmActive = event.frame < emWindowExpiresAt || event.frame === emWindowExpiresAt && event.emActiveAtExpiryBoundary === true;
      } else fullVeilEmActive = false;
      const target = c4Targets.get(event.targetId);
      if (c.constellation >= 4 && target?.status === "residual") {
        c4ResidualExpiresAt = target.expiresAt;
        if (event.frame === target.expiresAt && event.c4ActiveAtExpiryBoundary === undefined) issues.push(`${event.id}恰在C4残留到期帧，须确认目标减抗是否仍生效。`);
        c4TargetDebuffActive = event.frame < target.expiresAt || event.frame === target.expiresAt && event.c4ActiveAtExpiryBoundary === true;
      } else c4TargetDebuffActive = c.constellation >= 4 && target?.status === "near";
      effect = event.contactConfirmed ? "本次普通E突进实际接触；读取此刻独立精通窗口与该目标C4状态。" : "本次普通E突进未接触所选目标。";
    } else if (event.kind === "shadow-enter") {
      if (!casts.has(event.castId)) issues.push(`${event.id}进入影舞缺少实际E施放身份。`);
      if (shadowDanceActive) issues.push(`${event.id}前一轮影舞尚未观察退出，不能暗自重置幻戏次数。`);
      else if (casts.has(event.castId)) { shadowDanceActive = true; phantasmsUsed = 0; }
      effect = "实际进入新一轮影舞；本轮幻戏次数归零，不反推与同次突进命中的先后。";
    } else if (event.kind === "shadow-exit") {
      if (!shadowDanceActive) issues.push(`${event.id}退出影舞前未观察到有效影舞状态。`);
      shadowDanceActive = false;
      for (const [id, target] of c4Targets) if (target.status === "near") c4Targets.set(id, { status: "residual", expiresAt: event.frame + c4Residual });
      effect = "实际退出影舞；已确认附近目标的C4减抗进入4.5秒尾效。";
    } else if (event.kind === "c2-veil-grant") {
      const valid = c.constellation >= 2 && eligible && casts.has(event.castId) && !c2Grants.has(event.castId) && event.veilIds[0] !== event.veilIds[1];
      if (c.constellation < 2 || !eligible || !casts.has(event.castId)) issues.push(`${event.id}不符合C2施E加两层条件。`);
      if (c2Grants.has(event.castId)) issues.push(`${event.id}同一次E不能重复取得C2的两层帷幕。`);
      if (event.veilIds[0] === event.veilIds[1]) issues.push(`${event.id}两层帷幕身份不能相同。`);
      if (valid) {
        c2Grants.add(event.castId);
        for (const [index, id] of event.veilIds.entries()) gainVeil(id, event.replacedVeilIds?.[index], event);
      }
      if ((event.replacedVeilIds?.length ?? 0) > 2) issues.push(`${event.id}刷新目标数超过本次两层。`);
      effect = "C2施E加两层的实际回调；相对突进首击的先后由本事件次序决定。";
    } else if (event.kind === "seed-absorb") {
      if (!eligible) issues.push(`${event.id}尚不满足月兆≥2且已解锁A1的吸种加层条件。`);
      if (seeds.has(event.seedId)) issues.push(`${event.id}同一颗种子重复吸收。`);
      if (eligible && !seeds.has(event.seedId)) {
        seeds.add(event.seedId);
        gainVeil(event.veilId, event.replacesVeilId, event);
      }
      effect = `一次实际${event.source === "charged" ? "普通重击" : "幻戏"}吸种，增加或刷新一层独立帷幕。`;
    } else if (event.kind === "dew-gain") {
      if (dewIds.has(event.dewId) || dew >= 3) issues.push(`${event.id}露滴身份重复或已达3枚上限。`);
      else { dewIds.add(event.dewId); dew += 1; }
      effect = "实际获得一枚草露；2.5秒触发节奏没有从反应时间猜出。";
    } else if (event.kind === "first-shade-summon") {
      if (!shadowDanceActive || phantasmIds.has(event.phantasmId) || phantasmsUsed >= 3 || dew < 1) issues.push(`${event.id}首次召影需实际影舞、未用过的幻戏、本轮次数少于3和至少一枚草露。`);
      else { phantasmIds.add(event.phantasmId); phantasmsUsed += 1; dew -= 1; }
      effect = "本次幻戏首次召影消费一枚草露；不按后三次影子命中重复消费。";
    } else if (event.kind === "c4-target-near") {
      if (c.constellation < 4 || !shadowDanceActive) issues.push(`${event.id}C4目标减抗须处于实际影舞且目标已观察为附近。`);
      else c4Targets.set(event.targetId, { status: "near" });
      effect = "实际目标在影舞附近，C4草抗减少20%。";
    } else {
      const target = c4Targets.get(event.targetId);
      if (!target || target.status !== "near") issues.push(`${event.id}目标离开范围前须实际处于C4附近状态。`);
      else c4Targets.set(event.targetId, { status: "residual", expiresAt: event.frame + c4Residual });
      effect = "实际目标离开附近范围，C4草抗减少进入4.5秒尾效。";
    }
    records.push({ eventId: event.id, kind: event.kind, frame: event.frame, order: event.order,
      ...("targetId" in event ? { targetId: event.targetId } : {}), effect, dew, veilStacks: veils.size, shadowDanceActive,
      phantasmsUsed, ...(event.kind === "rush-hit" ? { contactConfirmed: event.contactConfirmed, fullVeilEmActive, emWindowExpiresAt, c4TargetDebuffActive, c4ResidualExpiresAt } : {}) });
  }
  return { records, issues: [...new Set(issues)], complete: issues.length === 0, dew, phantasmsUsed,
    veils: Object.fromEntries(veils), emWindowExpiresAt, shadowDanceActive, c4Targets: Object.fromEntries(c4Targets) };
}

export function isNeferObservedAction(document: CalculatorDocument): boolean {
  return document.gameContext?.skillId === "nefer-skill-rush";
}

/** Binds the existing ordinary E formula to one observed rush callback and its state. */
export function prepareNeferObservedDocument(document: CalculatorDocument): CalculatorDocument {
  const raw = document.gameContext?.observedNeferLifecycle;
  if (!raw || !isNeferObservedAction(document)) return document;
  const c = neferObservedContextSchema.parse(raw), result = structuredClone(document), game = result.gameContext!;
  result.dependencies = result.dependencies.filter(dependency => !dependency.id.startsWith("nefer-observed:"));
  for (const hit of result.hits) {
    if (hit.kind !== "ordinary") continue;
    const dependencyId = `nefer-observed:${hit.id}`, eventId = c.hitBindings?.[hit.id];
    const resolved = resolveNeferObservedLifecycle(c, eventId), record = resolved.records.find(row => row.eventId === eventId);
    const event = c.events.find(row => row.id === eventId), issues = [...resolved.issues];
    if (!eventId || !event || !record) issues.push("本击须绑定一次已记录的实际E突进命中。 ");
    if (event?.kind !== "rush-hit" || !record || record.kind !== "rush-hit") issues.push("绑定事件不是普通E突进命中；幻戏替代重击须使用独立五段动作。 ");
    if (record?.contactConfirmed === false) issues.push("所选E突进未接触该目标，不能当作已命中单击计算。 ");
    if (game.characterId !== c.casterId || game.constellation !== c.constellation || game.ascension !== c.ascension) issues.push("角色、命座或突破阶段与实际观察账本不一致。 ");
    if (hit.element !== "dendro" || hit.attackTag !== "skill") issues.push("本命中不是普通草元素E突进组成。 ");
    const em = hit.elementalMasteryAdjustment?.formula, resistance = hit.resistanceReductionFormula;
    const setInput = (formula: typeof em, key: string, value: number): boolean => {
      const input = formula?.inputs.find(row => row.key === key);
      if (!input) return false;
      input.value = value; input.origin = "observed-nefer-lifecycle";
      return true;
    };
    if (record?.kind === "rush-hit") {
      if (!setInput(em, "moonsignCount", c.moonsignCount) || !setInput(em, "neferFullVeilEmBuffActive", Number(record.fullVeilEmActive))) issues.push("普通E缺少可绑定的满帷幕精通来源公式。 ");
      if (c.constellation >= 4 && !setInput(resistance, "neferC4TargetDebuffActive", Number(record.c4TargetDebuffActive))) issues.push("普通E缺少可绑定的C4目标减抗来源公式。 ");
    }
    result.dependencies.push({ id: dependencyId, status: issues.length ? "missing" : "provisional",
      reason: issues.join("；") || `实际E事件${eventId}的回调顺序、8秒精通窗口及目标C4状态已绑定；输入面板和精通计入策略由本击明确提供。`,
      sourceRefs: NEFER_OBSERVED_SOURCE_REFS });
    hit.dependencies = [...new Set([...hit.dependencies.filter(id => !id.startsWith("nefer-observed:")), dependencyId])];
  }
  return result;
}

/** Separate audit stages; the E damage AST and Phantasm five-hit AST are unchanged. */
export function neferObservedTrace(document: CalculatorDocument): CalculationTraceNode[] {
  const raw = document.gameContext?.observedNeferLifecycle;
  if (!raw || !isNeferObservedAction(document)) return [];
  const c = neferObservedContextSchema.parse(raw), b = new TraceBuilder(NEFER_OBSERVED_SOURCE_REFS);
  for (const hitId of document.selectedHitIds) {
    const eventId = c.hitBindings?.[hitId]; if (!eventId) continue;
    const resolved = resolveNeferObservedLifecycle(c, eventId), record = resolved.records.find(row => row.eventId === eventId);
    if (!record || record.kind !== "rush-hit" || resolved.issues.length) continue;
    const at = (key: string, value: number, unit: string, meaning: string): void => {
      b.add(`nefer-observed:${hitId}:${key}`, meaning, expr.input(key), [traceInput(key, value, unit, "observed-nefer-event", `${eventId}；第${record.frame}帧同帧顺序${record.order}`)], { unit, status: "assumed" });
    };
    at("frame", record.frame, "frames", "E突进实际命中帧");
    at("veilStacks", record.veilStacks, "count", "本击之前按独立到期读取的帷幕层数（E不乘此层数）");
    at("dew", record.dew, "count", "本击实际草露库存（E不自动消费）");
    at("emActive", Number(record.fullVeilEmActive), "boolean", "本击独立8秒满帷幕精通窗口");
    if (c.constellation >= 4) at("c4Active", Number(record.c4TargetDebuffActive), "boolean", "本目标C4减草抗窗口");
  }
  return b.nodes;
}
