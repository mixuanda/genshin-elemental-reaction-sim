import { isNeferObservedAction, neferObservedContextSchema, resolveNeferObservedLifecycle, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { renderObservedEventRows, type ObservedRowKind } from "./calculator-observed-event-row-editor";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const seed = (document: CalculatorDocument) => ({
  character: "nefer", casterId: document.gameContext?.characterId ?? "nefer",
  constellation: document.gameContext?.constellation ?? 0, ascension: document.gameContext?.ascension ?? 0, moonsignCount: 1,
  initialFrame: 0, initialOrder: 0, initialDew: 0, initialPhantasmsUsed: 0, initialVeils: [], initialShadowDanceActive: false, initialC4Targets: {},
  eventsObservedThroughCutoff: false, observedOrderConfirmed: false, noHitlag: false,
  events: [], hitBindings: {},
});
const id = (key: string, label: string, optional = false) => ({ key, label, type: "text" as const, optional });
const bool = (key: string, label: string, optional = false) => ({ key, label, type: "boolean" as const, optional });
const num = (key: string, label: string, optional = false) => ({ key, label, type: "number" as const, optional });
const ids = (key: string, label: string, optional = false) => ({ key, label, type: "ids" as const, optional });
const neferKinds: ObservedRowKind[] = [
  { value: "skill-cast", label: "实际施放战技", fields: [id("castId", "本次战技标识"), bool("actionReadyConfirmed", "施放前已确认战技可用")] },
  { value: "rush-hit", label: "突进命中", fields: [id("castId", "战技标识"), id("targetId", "命中目标标识"), bool("contactConfirmed", "确认实际接触"), num("snapshotFrame", "实际面板取样帧"), bool("finalPanelConfirmedAtHit", "确认使用最终面板"), bool("emActiveAtExpiryBoundary", "到期等号处精通窗口有效", true), bool("c4ActiveAtExpiryBoundary", "到期等号处 C4 状态有效", true)] },
  { value: "shadow-enter", label: "观察到进入影舞", fields: [id("castId", "战技标识")] },
  { value: "shadow-exit", label: "观察到离开影舞", fields: [] },
  { value: "c2-veil-grant", label: "观察到 C2 帷幕加层", fields: [id("castId", "战技标识"), { key: "veilIds", label: "新增的两个帷幕标识（逗号分隔）", type: "ids", } as const, ids("replacedVeilIds", "被替换的帷幕标识（逗号分隔）", true)] },
  { value: "seed-absorb", label: "观察到吸收草种", fields: [id("seedId", "草种标识"), id("veilId", "新帷幕标识"), { key: "source", label: "来源", type: "enum", options: ["charged", "phantasm"] }, id("replacesVeilId", "被替换帷幕标识", true)] },
  { value: "dew-gain", label: "观察到获得草露", fields: [id("dewId", "草露事件标识")] },
  { value: "first-shade-summon", label: "观察到首次召影", fields: [id("phantasmId", "幻戏标识")] },
  { value: "c4-target-near", label: "观察到目标进入 C4 范围", fields: [id("targetId", "目标标识")] },
  { value: "c4-target-leave", label: "观察到目标离开 C4 范围", fields: [id("targetId", "目标标识")] },
];

/** The JSON editor retains the observed same-frame callback order and actual hit identity. */
export function renderNeferObservedControls(document: CalculatorDocument): string {
  if (!isNeferObservedAction(document)) return "";
  const context = document.gameContext?.observedNeferLifecycle;
  const resolved = context ? resolveNeferObservedLifecycle(context) : undefined;
  const rows = resolved?.records.map(row => `<tr><td>${esc(row.frame)}:${esc(row.order)}</td><td>${esc(row.kind)}</td><td>${esc(row.effect)}</td><td>${esc(row.veilStacks)} / ${esc(row.dew)}</td><td>${row.kind === "rush-hit" ? `${row.fullVeilEmActive ? "精通有效" : "精通无效"}；${row.c4TargetDebuffActive ? "C4有效" : "C4无效"}` : "—"}</td></tr>`).join("") ?? "";
  return `<fieldset data-nefer-observed-controls><legend>奈芙尔：普通 E 突进的实际事件与资源状态</legend><p class="calculator-hint">仅绑定普通战技突进，不把影舞幻戏的本体两段与影子三段并入 E。先记录起点真实草露、独立帷幕到期、精通窗口及影舞/C4目标状态，再按实际帧和同帧顺序记录施 E、突进命中、C2 加层、吸种、草露获取/首次召影消费和 C4 目标进出。未知资源数量与命中帧不会自动补入。</p><p class="calculator-hint">最终进攻面板及是否已含 100/200 精通仍按本击面板策略提供。恰在到期帧须填写对应边界字段；后续事件不会反向改变本击。</p>${resolved ? `<p class="calculator-hint">已重放 ${resolved.records.length} 条事件；${resolved.issues.length ? `尚需补齐：${esc(resolved.issues.join("；"))}` : "观察账本内的顺序与窗口一致。"}</p>` : ""}<table><thead><tr><th>帧:顺序</th><th>事件</th><th>状态</th><th>帷幕 / 草露</th><th>本击读取</th></tr></thead><tbody>${rows}</tbody></table>${renderObservedEventRows({ id: "nefer", events: context?.events ?? [], kinds: neferKinds, jsonSelector: "[data-nefer-observed-json]", commonFields: [ids("activeVeilIdsAtBoundary", "此事件边界仍有效的帷幕标识（逗号分隔；无 = 已观察为空）", true)], hitIds: document.hits.map(hit => hit.id), hitBindings: context?.hitBindings ?? {} })}<details><summary>高级：完整事件账本 JSON（保留导入与精确编辑）</summary><label>实际事件账本 JSON<textarea data-nefer-observed-json rows="18" spellcheck="false">${esc(JSON.stringify(context ?? seed(document), null, 2))}</textarea></label></details><button type="button" data-action="nefer-observed-apply">应用奈芙尔事件账本</button><p class="calculator-hint">此观察路径不会认证完整九秒影舞，也不替代已有五段幻戏输入。</p></fieldset>`;
}

export function applyNeferObservedControls(document: CalculatorDocument, root: HTMLElement): void {
  const textarea = root.querySelector<HTMLTextAreaElement>("[data-nefer-observed-json]");
  if (!textarea || !document.gameContext) throw new Error("未找到奈芙尔事件输入或角色上下文。");
  document.gameContext.observedNeferLifecycle = neferObservedContextSchema.parse(JSON.parse(textarea.value));
}
