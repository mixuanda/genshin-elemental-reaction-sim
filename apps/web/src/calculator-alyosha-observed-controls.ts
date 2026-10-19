import { alyoshaObservedContextSchema, isAlyoshaObservedAction, resolveAlyoshaObservedLifecycle, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { renderObservedEventRows, type ObservedRowKind } from "./calculator-observed-event-row-editor";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const seed = (document: CalculatorDocument) => ({
  character: "alyosha", casterId: document.gameContext?.characterId ?? "alyosha", constellation: 0, ascension: document.gameContext?.ascension ?? 0,
  skillTalentLevel: document.gameContext?.effectiveTalentLevel ?? 1,
  initialFrame: 0, initialOrder: 0, initialMarksKnownClear: false, initialPrecisionKnownClear: false, initialBurstKnownClear: false,
  initialActiveActorId: document.gameContext?.characterId ?? "alyosha", eventsObservedThroughCutoff: false, observedOrderConfirmed: false, noHitlag: false,
  events: [], hitBindings: {},
});
const id = (key: string, label: string, optional = false) => ({ key, label, type: "text" as const, optional });
const num = (key: string, label: string, optional = false) => ({ key, label, type: "number" as const, optional });
const bool = (key: string, label: string, optional = false) => ({ key, label, type: "boolean" as const, optional });
const ids = (key: string, label: string, optional = false) => ({ key, label, type: "ids" as const, optional });
const en = (key: string, label: string, options: readonly string[], optional = false) => ({ key, label, type: "enum" as const, options, optional });
const alyoshaKinds: ObservedRowKind[] = [
  { value: "burst-cast", label: "实际施放爆发", fields: [id("burstId", "本次爆发标识"), bool("actionReadyConfirmed", "施放前已确认爆发可用")] },
  { value: "mark-apply", label: "实际施加猎人印", fields: [id("targetId", "目标标识"), en("source", "施加来源", ["normal-fourth", "skill-press", "skill-hold"]), bool("contactConfirmed", "确认实际接触"), ids("nearbyRecipientIds", "附近获得精准的队员标识（逗号分隔；无 = 明确无人）", true), bool("markActiveAtExpiryBoundary", "到期等号处印记有效", true)] },
  { value: "field-attack", label: "猎场攻击实际接触", fields: [id("burstId", "本次爆发标识"), id("targetId", "目标标识"), bool("targetEnteredFieldConfirmed", "确认目标进入猎场"), bool("contactConfirmed", "确认实际接触"), id("attackId", "攻击标识")] },
  { value: "tugarin-attack", label: "图加林攻击与治疗", fields: [id("burstId", "本次爆发标识"), id("targetId", "目标标识"), bool("approachedTargetConfirmed", "确认接近目标"), bool("contactConfirmed", "确认实际接触"), id("attackId", "攻击标识"), ids("nearbyRecipientIds", "附近接受精准的队员标识（逗号分隔；无 = 明确无人）", true), id("healRecipientId", "实际治疗对象标识", true), bool("healResolvedConfirmed", "确认治疗已结算", true), num("alyoshaAttackAtHeal", "治疗时阿罗夏攻击力", true), bool("markActiveAtExpiryBoundary", "到期等号处印记有效", true)] },
  { value: "field-change", label: "观察到当前出战角色变化", fields: [id("activeActorId", "当前出战角色标识")] },
  { value: "precision-check", label: "观察到精准状态", fields: [id("recipientId", "队员标识"), bool("precisionActiveAtExpiryBoundary", "到期等号处精准有效", true), bool("radianceStellarConductActiveConfirmed", "确认星导辉映状态有效", true)] },
];

/** All timing and callback order remain editable observations; source text alone cannot supply a first Q attack frame. */
export function renderAlyoshaObservedControls(document: CalculatorDocument): string {
  if (!isAlyoshaObservedAction(document)) return "";
  const context = document.gameContext?.observedAlyoshaLifecycle;
  const result = context ? resolveAlyoshaObservedLifecycle(context) : undefined;
  const summary = result ? `<p class="calculator-hint">已重放 ${result.records.length} 条实际事件。${result.issues.length ? `尚需补齐：${esc(result.issues.join("；"))}` : "已记录事件顺序完整。"}</p>` : "";
  const rows = result?.records.map(row => `<tr><td>${esc(row.frame)}:${esc(row.order)}</td><td>${esc(row.kind)}</td><td>${esc(row.effect)}</td><td>${row.healing ? `${esc(row.healing.recipientId)}：${esc(row.healing.baseHealing)}` : "—"}</td></tr>`).join("") ?? "";
  return `<fieldset data-alyosha-observed-controls><legend>阿罗夏：猎人印、猎人精准及图加林实际事件</legend><p class="calculator-hint">本账本仅处理 C0。逐条记录实际帧与同帧顺序；再次施印会移除旧印，附近队员取得精准；A1 治疗按真实图加林攻击单独结算。每2秒只核对实际相邻攻击间隔，不能从14秒持续时间猜首击或总次数。</p>${summary}<table><thead><tr><th>帧:顺序</th><th>事件</th><th>状态</th><th>A1基础治疗</th></tr></thead><tbody>${rows}</tbody></table>${renderObservedEventRows({ id: "alyosha", events: context?.events ?? [], kinds: alyoshaKinds, jsonSelector: "[data-alyosha-observed-json]", hitIds: document.hits.map(hit => hit.id), hitBindings: context?.hitBindings ?? {} })}<details><summary>高级：完整事件账本 JSON</summary><label>实际事件账本 JSON<textarea data-alyosha-observed-json rows="16" spellcheck="false">${esc(JSON.stringify(context ?? seed(document), null, 2))}</textarea></details><button type="button" data-action="alyosha-observed-apply">应用实际事件账本</button><p class="calculator-hint">最终面板的攻击力应反映本击精准状态。印记到期边界、目标接近、附近接受者与治疗对象不能由静态资料推断。</p></fieldset>`;
}

export function applyAlyoshaObservedControls(document: CalculatorDocument, root: HTMLElement): void {
  const textarea = root.querySelector<HTMLTextAreaElement>("[data-alyosha-observed-json]");
  if (!textarea || !document.gameContext) throw new Error("未找到阿罗夏事件输入或角色上下文。");
  const parsed = alyoshaObservedContextSchema.parse(JSON.parse(textarea.value));
  document.gameContext.observedAlyoshaLifecycle = parsed;
}
