import { linneaObservedContextSchema, type LinneaForm, type LinneaObservedContext, type LinneaObservedEvent } from "./linnea-observed-context";
import { prepareObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import type { CalculatorDocument } from "./calculator-model";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

const sourceBase = "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/";
export const LINNEA_OBSERVED_SOURCE_REFS = [
  `${sourceBase}libs/gi/sheets/src/Characters/Linnea/index.tsx`,
  `${sourceBase}libs/gi/stats/Data/Characters/Linnea/skillParam.json`,
  `${sourceBase}libs/gi/dm-localization/assets/locales/en/char_Linnea_gen.json`,
  `${sourceBase}libs/gi/dm-localization/assets/locales/en/tooltips_gen.json`,
];
const specialKinds: Record<string, Contact["component"]> = {
  "linnea-lumi-heavy-overdrive-hammer-component": "hammer",
  "linnea-lumi-million-ton-crush-component": "crush",
};
const supported = new Set(["linnea-lumi-pummeler-pair", ...Object.keys(specialKinds)]);
type Contact = Extract<LinneaObservedEvent, { kind: "attack-contact" }>;
type Lumi = { id: string; form: LinneaForm; expiresFrame: number; supply: number | null };

export interface LinneaObservedRecord {
  eventId: string; kind: LinneaObservedEvent["kind"]; frame: number; order: number; effect: string;
  lumiPresent: boolean; form: LinneaForm | null; expiresFrame: number | null; supply: number | null;
  contact?: Contact;
}
export interface LinneaObservedResolution { records: LinneaObservedRecord[]; issues: string[]; complete: boolean }

/** C0 observed callbacks only. No first attack, attack interval, feed threshold, or target contact is synthesized. */
export function resolveLinneaObservedLifecycle(raw: LinneaObservedContext, throughEventId?: string): LinneaObservedResolution {
  const context = linneaObservedContextSchema.parse(raw);
  const issues: string[] = [], records: LinneaObservedRecord[] = [];
  if (!context.initialLumiAbsentKnown) issues.push("观察起点需确认没有更早的露米；未知不能当作未召唤。");
  if (!context.eventsObservedThroughSelected || !context.observedOrderConfirmed) issues.push("截至所选事件的实际回调及同帧顺序须完整确认。");
  const end = throughEventId === undefined ? context.events.length - 1 : context.events.findIndex(event => event.id === throughEventId);
  if (throughEventId !== undefined && end < 0) issues.push(`找不到绑定事件 ${throughEventId}。`);
  let lumi: Lumi | null = null;
  let previousFrame = -1, previousOrder = -1;
  const eventIds = new Set<string>(), slots = new Set<string>(), attackTargets = new Set<string>();
  const attacks = new Map<string, { component: Contact["component"]; pairId?: string; summonId: string; form: LinneaForm | null }>();
  for (const event of end < 0 ? [] : context.events.slice(0, end + 1)) {
    if (event.frame < previousFrame || event.frame === previousFrame && event.order <= previousOrder) issues.push(`${event.id}不符合实际帧与同帧顺序。`);
    previousFrame = event.frame; previousOrder = event.order;
    const slot = `${event.frame}:${event.order}`;
    if (eventIds.has(event.id) || slots.has(slot)) issues.push(`${event.id}的身份或同帧顺序重复。`);
    eventIds.add(event.id); slots.add(slot);
    let effect = "";
    if (event.kind === "skill-tap") {
      if (!event.actionReadyConfirmed) issues.push(`${event.id}缺少合法战技按键确认。`);
      if (event.observedEffect === "summon") {
        if (lumi) issues.push(`${event.id}声明新召唤，但前一露米尚未有实际过期／替换事件。`);
        if (event.observedExpiresFrame === undefined || event.observedExpiresFrame <= event.frame) issues.push(`${event.id}须给出实际召唤结束帧，不从25秒静态时长猜本次边界。`);
        else lumi = { id: event.summonId, form: "super-power", expiresFrame: event.observedExpiresFrame, supply: event.supplyAfter ?? null };
        effect = "已观察到战技召唤：超强形态；结束帧由事件声明。";
      } else {
        if (!lumi || lumi.id !== event.summonId) issues.push(`${event.id}的喂食不属于已观察的露米。`);
        if (event.supplyAfter === undefined) issues.push(`${event.id}须给出实际供给量；来源没有可自动补的数量或究极阈值。`);
        if (lumi && event.supplyAfter !== undefined) lumi.supply = event.supplyAfter;
        effect = "已观察到战技连点供给；形态变化需另有实际事件。";
      }
    } else if (event.kind === "normal-tap-feed") {
      if (!lumi || lumi.id !== event.summonId) issues.push(`${event.id}的普攻连点供给不属于已观察的露米。`);
      if (lumi) lumi.supply = event.supplyAfter;
      effect = "已观察到普攻连点供给；不从供给量推断形态转换。";
    } else if (event.kind === "burst-cast") {
      if (!event.actionReadyConfirmed || event.observedExpiresFrame <= event.frame) issues.push(`${event.id}缺少合法Q与实际重置结束帧。`);
      if (lumi && lumi.id !== event.summonId) issues.push(`${event.id}的Q重置露米身份与在场实体不一致。`);
      if (lumi) { lumi.expiresFrame = event.observedExpiresFrame; effect = "实际Q重置同一露米寿命，保持已观察形态和供给。"; }
      else { lumi = { id: event.summonId, form: "super-power", expiresFrame: event.observedExpiresFrame, supply: null }; effect = "实际Q召唤露米为超强形态；首击仍需观察。"; }
    } else if (event.kind === "form-observed") {
      if (!lumi || lumi.id !== event.summonId) issues.push(`${event.id}形态变化没有对应在场露米。`);
      if (lumi) lumi.form = event.form;
      effect = `实际观察到${event.form}形态；未推断喂食门槛。`;
    } else if (event.kind === "expire-observed" || event.kind === "depart-observed") {
      if (!lumi || lumi.id !== event.summonId) issues.push(`${event.id}离场事件没有对应露米。`);
      else lumi = null;
      effect = event.kind === "expire-observed" || event.reason === "expired"
        ? "已观察到露米到期离场；不生成后续攻击。"
        : `已观察到露米${event.reason === "cancelled" ? "取消" : "被替换"}离场；不生成后续攻击。`;
    } else {
      const attackTarget = `${event.attackId}\u0000${event.targetId}`;
      if (attackTargets.has(attackTarget)) issues.push(`${event.id}对同一目标重复使用一次实际攻击身份。`);
      attackTargets.add(attackTarget);
      const attack = attacks.get(event.attackId);
      if (attack && (attack.component !== event.component || attack.pairId !== event.pairId || attack.summonId !== event.summonId))
        issues.push(`${event.id}复用攻击身份却改变了组成、双击组或露米身份。`);
      if (!attack) attacks.set(event.attackId, { component: event.component, ...(event.pairId === undefined ? {} : { pairId: event.pairId }), summonId: event.summonId, form: lumi?.form ?? null });
      const attackForm = attack?.form ?? lumi?.form ?? null;
      if (!lumi || lumi.id !== event.summonId) issues.push(`${event.id}实际攻击没有对应的露米召唤。`);
      if (lumi && (event.frame > lumi.expiresFrame || event.frame === lumi.expiresFrame && event.activeAtExpiryBoundary === undefined))
        issues.push(`${event.id}位于结束帧或之后；结束帧同帧回调须明确是否仍有效。`);
      if (lumi && event.frame === lumi.expiresFrame && event.activeAtExpiryBoundary === false) issues.push(`${event.id}在观察到的结束帧已无效。`);
      if ((event.component === "pummeler-1" || event.component === "pummeler-2") && !event.pairId) issues.push(`${event.id}需声明普通双击共同的pairId及真实段身份。`);
      if (event.component === "hammer" && (attackForm !== "super-power" || !event.nearbyMoondrift)) issues.push(`${event.id}重锤要求超强形态和本次附近实际月笼。`);
      if (event.component === "crush" && attackForm !== "ultimate-power") issues.push(`${event.id}百万吨重压要求实际究极形态。`);
      if ((event.component === "pummeler-1" || event.component === "pummeler-2") && attackForm === "ultimate-power") issues.push(`${event.id}究极形态不能替代已选普通双击。`);
      if (event.contactConfirmed && (event.snapshotFrame === undefined || event.snapshotId === undefined))
        issues.push(`${event.id}实际命中缺少进攻面板取样帧和身份；落空机会不需要面板快照。`);
      if (event.snapshotFrame !== undefined && event.snapshotFrame > event.frame) issues.push(`${event.id}进攻面板取样晚于实际接触。`);
      effect = event.contactConfirmed ? "一次实际接触；仅所绑定的现有组成计算伤害。" : "实际攻击未接触此目标；不得计算该目标伤害。";
    }
    records.push({ eventId: event.id, kind: event.kind, frame: event.frame, order: event.order, effect,
      lumiPresent: lumi !== null, form: event.kind === "attack-contact" ? attacks.get(event.attackId)?.form ?? null : lumi?.form ?? null, expiresFrame: lumi?.expiresFrame ?? null, supply: lumi?.supply ?? null,
      ...(event.kind === "attack-contact" ? { contact: event } : {}) });
    if (event.kind === "attack-contact" && event.component === "crush" && lumi && attacks.get(event.attackId)?.form === "ultimate-power" && !records.slice(0, -1).some(record => record.contact?.attackId === event.attackId)) lumi.form = "standard-power";
  }
  return { records, issues: [...new Set(issues)], complete: issues.length === 0 };
}

export function isLinneaObservedAction(document: CalculatorDocument): boolean {
  return supported.has(document.gameContext?.skillId ?? "");
}

/** Optional binding: without a ledger the existing independent selected hit remains available. */
export function prepareLinneaObservedDocument(document: CalculatorDocument): CalculatorDocument {
  const raw = (document.gameContext as (typeof document.gameContext & { observedLinneaLifecycle?: LinneaObservedContext }) | undefined)?.observedLinneaLifecycle;
  if (!raw || !isLinneaObservedAction(document)) return document;
  const context = linneaObservedContextSchema.parse(raw), d = structuredClone(document), game = d.gameContext!;
  const skillId = game.skillId;
  if (skillId in specialKinds) {
    const eventId = context.selectedEventId ?? context.hitBindings?.[d.selectedHitIds[0] ?? ""];
    const resolution = resolveLinneaObservedLifecycle(context, eventId);
    const record = resolution.records.find(row => row.eventId === eventId), event = record?.contact;
    const issues = [...resolution.issues];
    if (!event || !record) issues.push("实际特殊组成须绑定一次已观察的露米攻击事件。");
    else {
      if (event.component !== specialKinds[skillId]) issues.push("绑定的重锤／重压事件与所选特殊组成不符。");
      if (!event.contactConfirmed) issues.push("本次特殊组成未接触所选目标。");
      if (game.constellation !== 0 || context.constellation !== 0) issues.push("此观察式绑定仅审阅C0。" );
      if (issues.length === 0) {
        const previous = game.observedSpecialComponent ?? {};
        const hitId = `${skillId}:${event.attackId}`;
        const actual = { lumiPresent: record.lumiPresent, lumiForm: record.form === "super-power" || record.form === "ultimate-power" ? record.form : undefined,
          targetWithinLumiA1Range: event.targetWithinLumiA1Range, nearbyMoondrift: event.nearbyMoondrift, moonsignLevel: event.moonsignLevel };
        game.observedSpecialComponent = { ...previous, actualComponentOccurred: true, targetId: event.targetId,
          independentEvent: { candidateId: event.attackId, frame: event.frame, snapshotFrame: event.snapshotFrame!, snapshotId: event.snapshotId!, targetId: event.targetId },
          sharedState: { ...previous.sharedState, ...actual },
          hitStates: { ...previous.hitStates, [hitId]: { ...previous.hitStates?.[hitId], ...actual } } };
        const prepared = prepareObservedSpecialComponentDocument(d);
        return addBindings(prepared, new Map([[prepared.selectedHitIds[0]!, { eventId, issues }]]));
      }
    }
    return addBindings(d, new Map(d.selectedHitIds.map(hitId => [hitId, { eventId, issues }])));
  }
  const bindings = new Map<string, { eventId?: string | undefined; issues: string[]; contact?: Contact }>();
  for (const [index, hit] of d.hits.entries()) {
    if (hit.kind !== "ordinary" || !d.selectedHitIds.includes(hit.id)) continue;
    const eventId = context.hitBindings?.[hit.id], issues: string[] = [];
    if (!eventId) { bindings.set(hit.id, { issues: [`${hit.id}尚未绑定实际普通双击段。`] }); continue; }
    const resolution = resolveLinneaObservedLifecycle(context, eventId);
    const record = resolution.records.find(row => row.eventId === eventId), event = record?.contact;
    issues.push(...resolution.issues);
    if (!event || !record) { issues.push(`${hit.id}缺少实际接触事件。`); bindings.set(hit.id, { eventId, issues }); continue; }
    if (event.component !== (index === 0 ? "pummeler-1" : "pummeler-2")) issues.push(`${hit.id}绑定的双击段次不符。`);
    if (!event.contactConfirmed) issues.push(`${hit.id}未接触所选目标。`);
    if (game.constellation !== 0 || context.constellation !== 0) issues.push("此观察式绑定仅审阅C0。" );
    bindings.set(hit.id, { eventId, issues, contact: event });
    if (hit.resistanceReductionFormula) for (const input of hit.resistanceReductionFormula.inputs) {
      if (input.key === "moonsignCount") input.value = event.moonsignLevel;
      if (input.key === "linneaLumiPresent") input.value = Number(record.lumiPresent);
      if (input.key === "linneaTargetNearby") input.value = Number(event.targetWithinLumiA1Range);
    }
  }
  if (bindings.size === 2) {
    const first = [...bindings.values()][0]!, second = [...bindings.values()][1]!;
    if (first.contact && second.contact && (first.contact.pairId !== second.contact.pairId || first.contact.attackId === second.contact.attackId)) {
      const reason = "已选两段必须属于同一实际普通双击 pairId，且攻击身份不同。";
      first.issues.push(reason); second.issues.push(reason);
    }
  }
  return addBindings(d, bindings);
}

function addBindings(document: CalculatorDocument, bindings: Map<string, { eventId?: string | undefined; issues: string[] }>): CalculatorDocument {
  document.dependencies = document.dependencies.filter(dep => !dep.id.startsWith("linnea-observed:"));
  for (const hit of document.hits) {
    const binding = bindings.get(hit.id);
    if (!binding) continue;
    const { eventId } = binding, id = `linnea-observed:${hit.id}`;
    const issues = [...new Set(binding.issues)];
    if (!eventId) issues.push("没有绑定本击实际事件。");
    document.dependencies.push({ id, status: issues.length ? "missing" : "provisional", reason: issues.join("；") || `实际事件 ${eventId} 已绑定；未来露米攻击次数和首击时点未推断。`, sourceRefs: LINNEA_OBSERVED_SOURCE_REFS });
    hit.dependencies = [...new Set([...hit.dependencies.filter(dep => !dep.startsWith("linnea-observed:")), id])];
  }
  return document;
}

export function linneaObservedTrace(document: CalculatorDocument): CalculationTraceNode[] {
  const raw = (document.gameContext as (typeof document.gameContext & { observedLinneaLifecycle?: LinneaObservedContext }) | undefined)?.observedLinneaLifecycle;
  if (!raw || !isLinneaObservedAction(document)) return [];
  const context = linneaObservedContextSchema.parse(raw), trace = new TraceBuilder(LINNEA_OBSERVED_SOURCE_REFS);
  for (const [index, hitId] of document.selectedHitIds.entries()) {
    const eventId = document.gameContext?.skillId === "linnea-lumi-pummeler-pair" ? context.hitBindings?.[hitId] : context.selectedEventId;
    if (!eventId) continue;
    const result = resolveLinneaObservedLifecycle(context, eventId), record = result.records.find(row => row.eventId === eventId);
    if (!record || result.issues.length) continue;
    trace.add(`linnea-observed:${index}:frame`, "露米实际接触帧", expr.input("frame"),
      [traceInput("frame", record.frame, "frames", "observed-linnea-event", `${eventId}；同帧顺序${record.order}`)],
      { unit: "frames", status: "assumed", explanationKey: "实际事件帧来自用户完整有序观察；未从25秒静态持续时间推算。" });
    if (record.supply !== null) trace.add(`linnea-observed:${index}:supply`, "露米实际已观察供给量", expr.input("supply"),
      [traceInput("supply", record.supply, "count", "observed-linnea-event", `${eventId}的供给状态`)],
      { unit: "count", status: "assumed", explanationKey: "供给只作事件状态；未知门槛不参与伤害公式。" });
  }
  return trace.nodes;
}
