/** Small schema-specific event row editor shared by the observed lifecycle controls. */
export type ObservedRowField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "enum" | "ids" | "json";
  optional?: boolean;
  options?: readonly string[];
  placeholder?: string;
};

export type ObservedRowKind = { value: string; label: string; fields: readonly ObservedRowField[] };
export type ObservedRowsEditorOptions = {
  id: string;
  events: unknown[];
  kinds: readonly ObservedRowKind[];
  jsonSelector: string;
  emptyMessage?: string;
  includeOrder?: boolean;
  commonFields?: readonly ObservedRowField[];
  hitIds?: readonly string[];
  hitBindings?: Record<string, string>;
  selectedEventId?: string;
  selectedEventLabel?: string;
  selectedEventKind?: string;
  selectedEventComponent?: string;
};
type Config = Omit<ObservedRowsEditorOptions, "events">;

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const registrations = new Map<string, Config>();
const enumLabels: Record<string, string> = {
  "skill-cast": "实际施放战技", "rush-hit": "突进命中", "shadow-enter": "进入影舞", "shadow-exit": "离开影舞", "c2-veil-grant": "C2 帷幕加层", "seed-absorb": "吸收草种", "dew-gain": "获得草露", "first-shade-summon": "首次召影", "c4-target-near": "目标进入 C4 范围", "c4-target-leave": "目标离开 C4 范围",
  "charged": "重击", "phantasm": "幻戏", "summon": "召唤露米", "feed": "供给露米", "standard-power": "标准之力", "super-power": "超凡之力", "ultimate-power": "终极之力", "expired": "持续结束", "cancelled": "取消", "replaced": "被替换", "pummeler-1": "双击第一段", "pummeler-2": "双击第二段", "hammer": "重锤", "crush": "百万吨重压", "sweep": "横扫", "beam": "光束", "overdrive": "超载", "prism-1": "棱镜第一段", "prism-2": "棱镜第二段", "ray": "射线", "inactive": "未启动", "decoding": "解析中", "none": "无", "stellar-conduct": "星导·协奏", "stellar-swirl": "星导·迴旋", "normal-fourth": "普通攻击第四段", "skill-press": "点按战技", "skill-hold": "长按战技",
};

function eventObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}
function valueOf(event: Record<string, unknown>, field: ObservedRowField): string {
  const value = event[field.key];
  if (value === undefined || value === null) return "";
  if (field.type === "ids" && Array.isArray(value)) return value.length ? value.join(", ") : "无";
  if (field.type === "json") return JSON.stringify(value, null, 2);
  return String(value);
}
function fieldHtml(index: number, field: ObservedRowField, value: string): string {
  const key = esc(field.key), suffix = field.optional ? "（选填）" : "（必填）";
  const attr = `data-observed-row-field="${key}"`;
  if (field.type === "enum") return `<label>${esc(field.label)}${suffix}<select ${attr}><option value="">请选择；未知时留空</option>${(field.options ?? []).map(option => `<option value="${esc(option)}"${option === value ? " selected" : ""}>${esc(enumLabels[option] ?? option)}</option>`).join("")}</select></label>`;
  if (field.type === "boolean") return `<label>${esc(field.label)}${suffix}<select ${attr}><option value="">请选择真实观察</option><option value="true"${value === "true" ? " selected" : ""}>是</option><option value="false"${value === "false" ? " selected" : ""}>否</option></select></label>`;
  if (field.type === "json") return `<label>${esc(field.label)}${suffix}<textarea ${attr} rows="2" spellcheck="false" placeholder="${esc(field.placeholder ?? "留空表示未提供")}">${esc(value)}</textarea></label>`;
  const type = field.type === "number" ? "number" : "text";
  const limits = field.type === "number" ? ' min="0" step="any" inputmode="decimal"' : "";
  const placeholder = field.type === "ids" ? "标识用逗号分隔；无 = 已观察为空" : field.placeholder ?? "未知时留空";
  return `<label>${esc(field.label)}${suffix}<input type="${type}"${limits} ${attr} value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
}
function renderRows(events: unknown[], config: Config): string {
  if (!events.length) return `<p class="calculator-hint">${esc(config.emptyMessage ?? "尚无事件记录")}</p>`;
  return events.map((raw, index) => {
    const event = eventObject(raw);
    const kind = config.kinds.find(row => row.value === event.kind);
    const fields: ObservedRowField[] = [
      { key: "id", label: "事件标识", type: "text" },
      { key: "frame", label: "实际发生帧", type: "number" },
      ...(config.includeOrder === false ? [] : [{ key: "order", label: "同帧观察顺序", type: "number" as const }]),
      ...(config.commonFields ?? []),
      ...(kind?.fields ?? []),
    ];
    return `<fieldset data-observed-event-row="${index}"><legend>事件 ${index + 1}</legend><label>事件类型<select data-observed-kind><option value=""${!kind ? " selected" : ""}>请选择事件类型</option>${config.kinds.map(row => `<option value="${esc(row.value)}"${row.value === kind?.value ? " selected" : ""}>${esc(row.label)}</option>`).join("")}</select></label><div class="calculator-fields">${fields.map(field => fieldHtml(index, field, valueOf(event, field))).join("")}</div><button type="button" data-observed-row-move="up" data-observed-row-index="${index}"${index === 0 ? " disabled" : ""}>在账本中前移</button><button type="button" data-observed-row-move="down" data-observed-row-index="${index}"${index === events.length - 1 ? " disabled" : ""}>在账本中后移</button><button type="button" data-observed-row-remove="${index}">删除此事件</button></fieldset>`;
  }).join("");
}
function parseTextarea(root: HTMLElement, config: Config, editor: HTMLElement): Record<string, unknown> | undefined {
  const textarea = root.querySelector<HTMLTextAreaElement>(config.jsonSelector);
  if (!textarea) return undefined;
  try {
    const parsed: unknown = JSON.parse(textarea.value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON 顶层必须是对象");
    return parsed as Record<string, unknown>;
  } catch (error) {
    editor.querySelector<HTMLElement>("[data-observed-row-status]")!.textContent = `请先修正高级 JSON：${error instanceof Error ? error.message : String(error)}`;
    return undefined;
  }
}
function readRows(editor: HTMLElement, config: Config): Record<string, unknown>[] {
  return Array.from(editor.querySelectorAll<HTMLElement>("[data-observed-event-row]")).map(row => {
    const kindValue = row.querySelector<HTMLSelectElement>("[data-observed-kind]")?.value ?? "";
    const kind = config.kinds.find(item => item.value === kindValue);
    const event: Record<string, unknown> = { kind: kindValue };
    for (const key of ["id", "frame", ...(config.includeOrder === false ? [] : ["order"])]) {
      const input = row.querySelector<HTMLInputElement>(`[data-observed-row-field="${key}"]`);
      if (!input) continue;
      event[key] = key === "id" ? input.value : input.value === "" ? "" : Number(input.value);
    }
    for (const field of [...(config.commonFields ?? []), ...(kind?.fields ?? [])]) {
      const input = row.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-observed-row-field="${field.key}"]`);
      if (!input || input.value === "") continue;
      if (field.type === "number") event[field.key] = Number(input.value);
      else if (field.type === "boolean") event[field.key] = input.value === "true";
      else if (field.type === "ids") event[field.key] = input.value.trim() === "无" || input.value.trim() === "[]" ? [] : input.value.split(",").map(value => value.trim()).filter(Boolean);
      else if (field.type === "json") {
        try { event[field.key] = JSON.parse(input.value); } catch { event[field.key] = input.value; }
      } else event[field.key] = input.value;
    }
    return event;
  });
}
function syncRows(root: HTMLElement, editor: HTMLElement, config: Config): void {
  const json = root.querySelector<HTMLTextAreaElement>(config.jsonSelector);
  const base = parseTextarea(root, config, editor);
  if (!json || !base) return;
  base.events = readRows(editor, config);
  if (config.hitIds) {
    const bindings: Record<string, string> = {};
    for (const id of config.hitIds) {
      const value = editor.querySelector<HTMLSelectElement>(`[data-observed-hit-binding="${CSS.escape(id)}"]`)?.value;
      if (value) bindings[id] = value;
    }
    base.hitBindings = bindings;
    config.hitBindings = bindings;
  }
  if (config.selectedEventLabel) {
    const selected = editor.querySelector<HTMLSelectElement>("[data-observed-selected-event]")?.value ?? "";
    if (selected) base.selectedEventId = selected;
    else delete base.selectedEventId;
    config.selectedEventId = selected;
  }
  json.value = JSON.stringify(base, null, 2);
  if (config.hitIds) {
    const bindingRoot = editor.querySelector<HTMLElement>("[data-observed-event-bindings]");
    if (bindingRoot) bindingRoot.innerHTML = bindingHtml(base.events as unknown[], config);
  }
  const selectedRoot = editor.querySelector<HTMLElement>("[data-observed-selected-event-root]");
  if (selectedRoot) selectedRoot.innerHTML = selectedEventHtml(base.events as unknown[], config);
  json.dispatchEvent(new Event("input", { bubbles: true }));
  editor.querySelector<HTMLElement>("[data-observed-row-status]")!.textContent = "事件行已同步到 JSON；点击应用后才用于计算与导出。";
}
function bindingHtml(events: unknown[], config: Config): string {
  if (!config.hitIds?.length) return "";
  const validEvents = events.map(eventObject).filter(row => typeof row.id === "string" && row.id.length > 0);
  return `<details><summary>把页面命中绑定到实际事件（选填）</summary><p class="calculator-hint">请按实际观察选择对应事件；留空表示不绑定。</p>${config.hitIds.map(id => `<label>命中 ${esc(id)}<select data-observed-hit-binding="${esc(id)}"><option value="">不绑定</option>${validEvents.map(row => `<option value="${esc(row.id)}"${config.hitBindings?.[id] === row.id ? " selected" : ""}>${esc(row.id)} · ${esc(row.kind)} · 帧 ${esc(row.frame)}</option>`).join("")}</select></label>`).join("")}</details>`;
}
function selectedEventHtml(events: unknown[], config: Config): string {
  if (!config.selectedEventLabel) return "";
  const candidates = events.map(eventObject).filter(row => row.kind === (config.selectedEventKind ?? "attack-contact") && (!config.selectedEventComponent || row.component === config.selectedEventComponent) && typeof row.id === "string" && row.id.length > 0);
  return `<label>${esc(config.selectedEventLabel)}<select data-observed-selected-event><option value="">请选择实际观察事件；未知时留空</option>${candidates.map(row => `<option value="${esc(row.id)}"${config.selectedEventId === row.id ? " selected" : ""}>${esc(row.id)} · ${esc(row.component)} · 帧 ${esc(row.frame)}</option>`).join("")}</select></label>`;
}

export function bindObservedEventRows(root: HTMLElement): void {
  if (root.dataset.observedRowsBound === "true") return;
  root.dataset.observedRowsBound = "true";
  root.addEventListener("input", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("[data-observed-row-field]")) return;
    const editor = target.closest<HTMLElement>("[data-observed-event-editor]");
    const config = editor && registrations.get(editor.dataset.observedEventEditor ?? "");
    if (editor && config) syncRows(root, editor, config);
  });
  root.addEventListener("change", event => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const editor = target.closest<HTMLElement>("[data-observed-event-editor]");
    const config = editor && registrations.get(editor.dataset.observedEventEditor ?? "");
    if (!editor || !config) return;
    if (target.matches("[data-observed-kind]")) {
      const base = parseTextarea(root, config, editor);
      if (!base) return;
      const rows = readRows(editor, config);
      const row = target.closest<HTMLElement>("[data-observed-event-row]");
      const index = Number(row?.dataset.observedEventRow);
      rows[index] = { ...rows[index], kind: target.value };
      base.events = rows;
      const json = root.querySelector<HTMLTextAreaElement>(config.jsonSelector);
      if (json) json.value = JSON.stringify(base, null, 2);
      const container = editor.querySelector<HTMLElement>("[data-observed-event-rows]");
      if (container) container.innerHTML = renderRows(rows, config);
      json?.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (target.matches("[data-observed-hit-binding]") || target.matches("[data-observed-selected-event]") || target.matches("[data-observed-row-field]")) syncRows(root, editor, config);
  });
  root.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const editor = target.closest<HTMLElement>("[data-observed-event-editor]");
    const config = editor && registrations.get(editor.dataset.observedEventEditor ?? "");
    if (!editor || !config) return;
    if (target.matches("[data-observed-json-import]")) {
      const base = parseTextarea(root, config, editor);
      if (!base || !Array.isArray(base.events)) return;
      const container = editor.querySelector<HTMLElement>("[data-observed-event-rows]");
      if (container) container.innerHTML = renderRows(base.events, config);
      if (config.hitIds) {
        config.hitBindings = base.hitBindings && typeof base.hitBindings === "object" ? base.hitBindings as Record<string, string> : {};
        const bindings = editor.querySelector<HTMLElement>("[data-observed-event-bindings]");
        if (bindings) bindings.innerHTML = bindingHtml(base.events, config);
      }
      if (config.selectedEventLabel) {
        config.selectedEventId = typeof base.selectedEventId === "string" ? base.selectedEventId : "";
        const selectedRoot = editor.querySelector<HTMLElement>("[data-observed-selected-event-root]");
        if (selectedRoot) selectedRoot.innerHTML = selectedEventHtml(base.events, config);
      }
      editor.querySelector<HTMLElement>("[data-observed-row-status]")!.textContent = "已从高级 JSON 更新事件行；点击应用后才用于计算与导出。";
      return;
    }
    if (!target.matches("[data-observed-row-add], [data-observed-row-remove], [data-observed-row-move]")) return;
    const base = parseTextarea(root, config, editor);
    if (!base) return;
    const rows = Array.isArray(base.events) ? [...base.events] : [];
    if (target.matches("[data-observed-row-add]")) rows.push({ id: "", frame: "", ...(config.includeOrder === false ? {} : { order: "" }), kind: "" });
    else if (target.matches("[data-observed-row-remove]")) rows.splice(Number(target.getAttribute("data-observed-row-remove")), 1);
    else {
      const index = Number(target.getAttribute("data-observed-row-index"));
      const destination = index + (target.getAttribute("data-observed-row-move") === "up" ? -1 : 1);
      if (destination < 0 || destination >= rows.length) return;
      [rows[index], rows[destination]] = [rows[destination], rows[index]];
    }
    base.events = rows;
    const json = root.querySelector<HTMLTextAreaElement>(config.jsonSelector);
    if (json) json.value = JSON.stringify(base, null, 2);
    const container = editor.querySelector<HTMLElement>("[data-observed-event-rows]");
    if (container) container.innerHTML = renderRows(rows, config);
    const bindings = editor.querySelector<HTMLElement>("[data-observed-event-bindings]");
    if (bindings) bindings.innerHTML = bindingHtml(rows, config);
    const selectedRoot = editor.querySelector<HTMLElement>("[data-observed-selected-event-root]");
    if (selectedRoot) selectedRoot.innerHTML = selectedEventHtml(rows, config);
    json?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Rebuild the visible rows from the retained JSON draft after a calculator redraw. */
export function refreshObservedEventRows(root: HTMLElement): void {
  for (const [id, config] of registrations) {
    const editor = root.querySelector<HTMLElement>(`[data-observed-event-editor="${id}"]`);
    if (!editor) continue;
    const json = root.querySelector<HTMLTextAreaElement>(config.jsonSelector);
    if (!json) continue;
    try {
      const parsed: unknown = JSON.parse(json.value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray((parsed as Record<string, unknown>).events)) continue;
      const value = parsed as Record<string, unknown>;
      const container = editor.querySelector<HTMLElement>("[data-observed-event-rows]");
      if (container) container.innerHTML = renderRows(value.events as unknown[], config);
      if (config.hitIds) {
        const bindings = value.hitBindings && typeof value.hitBindings === "object" ? value.hitBindings as Record<string, string> : {};
        config.hitBindings = bindings;
        const bindingRoot = editor.querySelector<HTMLElement>("[data-observed-event-bindings]");
        if (bindingRoot) bindingRoot.innerHTML = bindingHtml(value.events as unknown[], config);
      }
      if (config.selectedEventLabel) {
        config.selectedEventId = typeof value.selectedEventId === "string" ? value.selectedEventId : "";
        const selectedRoot = editor.querySelector<HTMLElement>("[data-observed-selected-event-root]");
        if (selectedRoot) selectedRoot.innerHTML = selectedEventHtml(value.events as unknown[], config);
      }
    } catch {
      // Leave invalid advanced JSON untouched and keep the last visible rows for correction.
    }
  }
}

export function renderObservedEventRows(options: ObservedRowsEditorOptions): string {
  const { events, ...config } = options;
  registrations.set(options.id, config);
  return `<div data-observed-event-editor="${esc(options.id)}"><p class="calculator-hint">逐条记录实际事件。帧与同帧顺序必须来自观察；未知的必填值请留空，原有校验会阻止计算。</p><div data-observed-event-rows>${renderRows(events, config)}</div><button type="button" data-observed-row-add>添加事件</button><button type="button" data-observed-json-import>从高级 JSON 更新事件行</button><div data-observed-event-bindings>${bindingHtml(events, config)}</div><div data-observed-selected-event-root>${selectedEventHtml(events, config)}</div><p data-observed-row-status role="status" class="calculator-hint">事件行与下方 JSON 同步；点击应用后才用于计算与导出。</p></div>`;
}
