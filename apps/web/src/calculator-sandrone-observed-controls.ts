import { sandroneObservedLifecycleSchema, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { renderObservedEventRows, type ObservedRowKind } from "./calculator-observed-event-row-editor";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const num = (key: string, label: string, optional = false) => ({ key, label, type: "number" as const, optional });
const id = (key: string, label: string, optional = false) => ({ key, label, type: "text" as const, optional });
const bool = (key: string, label: string, optional = false) => ({ key, label, type: "boolean" as const, optional });
const en = (key: string, label: string, options: readonly string[], optional = false) => ({ key, label, type: "enum" as const, options, optional });
const sandroneKinds: ObservedRowKind[] = [
  { value: "window-start", label: "观察到窗口开始", fields: [] },
  { value: "window-end", label: "观察到窗口结束", fields: [] },
  { value: "window-cancel", label: "观察到窗口取消", fields: [] },
  { value: "observe-heat", label: "观察到热量", fields: [num("heat", "实际热量（0–100）")] },
  { value: "observe-mode", label: "观察到模式", fields: [en("mode", "实际模式", ["inactive", "decoding", "overdrive"])] },
  { value: "observe-radiance", label: "观察到辉映", fields: [en("radiance", "实际辉映状态", ["none", "stellar-conduct", "stellar-swirl"])] },
  { value: "hit", label: "攻击实际接触", fields: [en("hitKind", "攻击类型", ["sweep", "beam", "overdrive", "prism-1", "prism-2", "ray"]), id("targetId", "目标标识"), num("snapshotFrame", "攻击面板取样帧", true), id("snapshotId", "攻击面板取样标识", true), bool("contact", "确认实际接触")] },
];

/** An optional ordered observation ledger. The source provides thresholds, not hit cadence. */
export function renderSandroneObservedControls(document: CalculatorDocument): string {
  if (!document.gameContext?.skillId.startsWith("sandrone-")) return "";
  const context = document.gameContext.sandroneObservedLifecycle ?? { events: [] };
  const hitIds = document.hits.map((hit) => hit.id).join("、");
  const rows = context.events.map((event) => `<tr><td>${event.frame}</td><td>${esc(event.id)}</td><td>${esc(event.kind === "hit" ? event.hitKind : event.kind)}</td><td>${esc(event.heat ?? "—")}</td><td>${esc(event.mode ?? "—")}</td><td>${esc(event.radiance ?? "—")}</td></tr>`).join("");
  return `<fieldset data-sandrone-observed-controls><legend>桑多涅 · 实际热量、解析与辉映观察</legend><p class="calculator-hint">按实际发生顺序填写事件；同一帧按列表顺序处理。热量、模式与辉映都必须来自观察。攻击必须填写类型、目标和实际接触；确认接触时还需填写真实面板取样帧与标识。</p>${renderObservedEventRows({ id: "sandrone", events: context.events, kinds: sandroneKinds, jsonSelector: "[data-sandrone-observed-json]", includeOrder: false, hitIds: document.hits.map(hit => hit.id), hitBindings: context.hitBindings ?? {} })}<details><summary>高级：完整观察记录 JSON</summary><label>有序观察记录 JSON<textarea data-sandrone-observed-json rows="15" spellcheck="false">${esc(JSON.stringify(context, null, 2))}</textarea></details><button type="button" data-action="sandrone-observed-apply">应用观察记录</button><div class="calculator-full"><table><caption>当前已应用的观察顺序</caption><thead><tr><th>帧</th><th>事件 ID</th><th>类别</th><th>热量</th><th>模式</th><th>辉映</th></tr></thead><tbody>${rows || '<tr><td colspan="6">尚无观察事件</td></tr>'}</tbody></table></div><p class="calculator-hint">只有明确记录的热量达到100时进入超载，低于50时退出；不会生成热量变化率、射击间隔、命中次数或完整重击周期。完整观察状态由你明确填写；不会自动认证。</p></fieldset>`;
}

export function applySandroneObservedControls(document: CalculatorDocument, root: HTMLElement): void {
  const field = root.querySelector<HTMLTextAreaElement>("[data-sandrone-observed-json]");
  if (!field || !document.gameContext) return;
  let raw: unknown;
  try { raw = JSON.parse(field.value); } catch (error) { throw new Error(`桑多涅观察记录 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`); }
  const parsed = sandroneObservedLifecycleSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`桑多涅观察记录字段不完整：${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("；")}`);
  document.gameContext.sandroneObservedLifecycle = parsed.data;
}
