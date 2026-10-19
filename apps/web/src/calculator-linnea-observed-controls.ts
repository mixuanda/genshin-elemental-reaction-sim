import { isLinneaObservedAction, linneaObservedContextSchema, resolveLinneaObservedLifecycle, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { renderObservedEventRows, type ObservedRowKind } from "./calculator-observed-event-row-editor";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
  ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const seed = () => ({
  character: "linnea", constellation: 0, initialLumiAbsentKnown: false,
  eventsObservedThroughSelected: false, observedOrderConfirmed: false, events: [], hitBindings: {},
});
const id = (key: string, label: string, optional = false) => ({ key, label, type: "text" as const, optional });
const num = (key: string, label: string, optional = false) => ({ key, label, type: "number" as const, optional });
const bool = (key: string, label: string, optional = false) => ({ key, label, type: "boolean" as const, optional });
const en = (key: string, label: string, options: readonly string[], optional = false) => ({ key, label, type: "enum" as const, options, optional });
const linneaKinds: ObservedRowKind[] = [
  { value: "skill-tap", label: "实际点按战技", fields: [id("summonId", "露米本次标识"), en("observedEffect", "实际效果", ["summon", "feed"]), num("observedExpiresFrame", "观察到的结束帧", true), num("supplyAfter", "之后观察到的供给数", true), bool("actionReadyConfirmed", "动作前已确认战技可用")] },
  { value: "normal-tap-feed", label: "普通攻击实际供给", fields: [id("summonId", "露米标识"), num("supplyAfter", "之后观察到的供给数"), bool("contactConfirmed", "确认实际接触")] },
  { value: "burst-cast", label: "实际施放爆发", fields: [id("summonId", "露米标识"), num("observedExpiresFrame", "观察到的结束帧"), bool("actionReadyConfirmed", "施放前已确认爆发可用")] },
  { value: "form-observed", label: "观察到形态转换", fields: [id("summonId", "露米标识"), en("form", "实际形态", ["standard-power", "super-power", "ultimate-power"])] },
  { value: "expire-observed", label: "观察到持续时间结束", fields: [id("summonId", "露米标识")] },
  { value: "depart-observed", label: "观察到离场", fields: [id("summonId", "露米标识"), en("reason", "离场原因", ["expired", "cancelled", "replaced"])] },
  { value: "attack-contact", label: "露米攻击实际接触", fields: [id("summonId", "露米标识"), id("attackId", "攻击标识"), en("component", "攻击组成", ["pummeler-1", "pummeler-2", "hammer", "crush"]), id("pairId", "双击配对标识", true), id("targetId", "目标标识"), bool("contactConfirmed", "确认实际接触"), bool("targetWithinLumiA1Range", "目标在 A1 范围内"), bool("nearbyMoondrift", "附近存在 Moondrift"), num("moonsignLevel", "实际月兆等级"), num("snapshotFrame", "实际面板取样帧", true), id("snapshotId", "实际面板取样标识", true), bool("activeAtExpiryBoundary", "露米到期等号处仍有效", true)] },
];

/** Event JSON is an editable observed ledger; skill duration never generates attacks. */
export function renderLinneaObservedControls(document: CalculatorDocument): string {
  if (!isLinneaObservedAction(document)) return "";
  const context = document.gameContext?.observedLinneaLifecycle;
  const result = context ? resolveLinneaObservedLifecycle(context) : undefined;
  const rows = result?.records.map(record => `<tr><td>${record.frame}:${record.order}</td><td>${esc(record.kind)}</td><td>${esc(record.form ?? "不在场")}；供给 ${esc(record.supply ?? "未知")}</td><td>${esc(record.effect)}</td></tr>`).join("") ?? "";
  const skillId = document.gameContext?.skillId;
  const selectedComponent = skillId === "linnea-lumi-heavy-overdrive-hammer-component" ? "hammer" : skillId === "linnea-lumi-million-ton-crush-component" ? "crush" : undefined;
  return `<fieldset data-linnea-observed-controls><legend>莉奈娅 · 露米实际生命周期与单次接触</legend>
    <p class="calculator-hint">此账本只绑定已观察的一组普通双击，或一次重锤／百万吨重压。已有独立单击不依赖账本。请完整记录从露米不存在的观察起点到所选接触的实际帧、同帧顺序、战技／爆发、供给、形态、结束和目标接触；未知供给阈值与25秒持续时间不生成攻击帧或次数。</p>
    ${result ? `<p class="calculator-hint">已重放 ${result.records.length} 条事件；${result.issues.length ? `待补：${esc(result.issues.join("；"))}` : "当前账本事件顺序已确认。"}</p>` : ""}
    <table><thead><tr><th>帧:顺序</th><th>观察事件</th><th>露米状态</th><th>结算范围</th></tr></thead><tbody>${rows}</tbody></table>
    ${renderObservedEventRows({ id: "linnea", events: context?.events ?? [], kinds: linneaKinds, jsonSelector: "[data-linnea-observed-json]", hitIds: selectedComponent ? [] : document.hits.map(hit => hit.id), hitBindings: context?.hitBindings ?? {}, ...(selectedComponent ? { selectedEventLabel: `为${selectedComponent === "hammer" ? "重锤" : "百万吨重压"}选择实际露米接触事件`, selectedEventComponent: selectedComponent, ...(context?.selectedEventId ? { selectedEventId: context.selectedEventId } : {}) } : {}) })}
    <details><summary>高级：完整事件账本 JSON</summary><label>露米完整有序事件账本 JSON<textarea data-linnea-observed-json rows="17" spellcheck="false">${esc(JSON.stringify(context ?? seed(), null, 2))}</textarea></label></details>
    <button type="button" data-action="linnea-observed-apply">应用露米实际事件账本</button>
    <p class="calculator-hint">skill-tap 标注本次是 summon 或 feed；burst-cast 在露米已在场时只重置实际结束帧，形态不变；form-observed 记录确实见到的转换；expire-observed 记录离场。attack-contact 必须有唯一 attackId、组成类型、实际接触、目标范围、月兆及面板取样身份。普通两段分别绑定 hitBindings；特殊重锤／重压用 selectedEventId。结束帧同帧攻击须明确 activeAtExpiryBoundary。C1以上仍在本账本范围外。</p>
  </fieldset>`;
}

export function applyLinneaObservedControls(document: CalculatorDocument, root: HTMLElement): void {
  const textarea = root.querySelector<HTMLTextAreaElement>("[data-linnea-observed-json]");
  if (!textarea || !document.gameContext) throw new Error("未找到露米观察账本或角色上下文。");
  document.gameContext.observedLinneaLifecycle = linneaObservedContextSchema.parse(JSON.parse(textarea.value));
}
