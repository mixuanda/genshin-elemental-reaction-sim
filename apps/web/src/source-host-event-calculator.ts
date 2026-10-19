import {
  calculateSourceHostEventCollection,
  sourceHostEventCollectionSchema,
  type SourceHostEventCollection,
  type SourceHostEventCollectionRow,
} from "../../../packages/sim-core/src/source-host-event-collection";
import type { SourceHostEditableCalculation } from "../../../packages/sim-core/src/source-host-capture";
import { getSourceHostEventComponentRule } from "../../../packages/sim-core/src/source-host-event-rules";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson, renderSourceHostCalculator } from "./source-host-calculator";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const amount = (value: number): string => Number.isFinite(value) ? value.toLocaleString() : "未知";

function rowState(row: SourceHostEventCollectionRow): string {
  return ({ calculated: "已计算命中", excluded: "未计入小计", missed: "已观察落空（0）", unresolved: "未决", pending: "待结算" } as const)[row.status];
}

/** Renders one audited global event-listener call as an independent editable calculator. */
export function renderSourceHostEventCalculator(root: HTMLElement, raw: SourceHostEventCollection): void {
  let document = sourceHostEventCollectionSchema.parse(raw);
  let selected = Math.max(0, document.hits.findIndex(hit => hit.included));
  let editorInvalid = false;
  const descriptor = getSourceHostEventComponentRule(document.componentId);
  const eventCall = document.nativeEvidence.eventListenerCalls?.find(row => row.id === document.selection.listenerCallId);

  root.innerHTML = `<article class="card" data-source-event-collection>
    <h2>来源事件组件 · 已观察攻击</h2>
    <p>${esc(descriptor.intro)}</p>
    <p><strong>${esc(descriptor.label)}</strong> · 监听调用 #${document.selection.listenerCallId}${eventCall ? ` · ${esc(eventCall.eventType)} · 第 ${eventCall.startedFrame} 帧` : " · 调用时序未记录"}</p>
    <section data-source-event-summary role="status" aria-live="polite"></section>
    <fieldset data-source-event-hit-list><legend>逐击纳入事件组件小计</legend></fieldset>
    <label data-source-event-hit-selector-label>编辑此事件命中的单段公式<select data-source-event-hit-select></select></label>
    <div data-source-event-editor></div>
    <div class="editor-actions"><button type="button" data-source-event-export>导出事件组件 JSON</button></div>
  </article>`;

  const list = root.querySelector<HTMLElement>("[data-source-event-hit-list]")!;
  const selectorLabel = root.querySelector<HTMLElement>("[data-source-event-hit-selector-label]")!;
  const select = root.querySelector<HTMLSelectElement>("[data-source-event-hit-select]")!;
  const editor = root.querySelector<HTMLElement>("[data-source-event-editor]")!;
  const summary = root.querySelector<HTMLElement>("[data-source-event-summary]")!;

  const activeHitValid = (): boolean => ![...editor.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")]
    .some(field => (field.required || field.dataset.sourceHostInput !== undefined || field.dataset.sourceHostComponentField !== undefined ||
      field.dataset.sourceHostPolestar !== undefined || field.dataset.sourceHostArtifactState !== undefined ||
      field.dataset.sourceHostArtifactStateKey !== undefined || field.dataset.sourceHostArtifactAdditiveState !== undefined) &&
      (!field.value.trim() || !field.checkValidity()));

  const renderHits = (): void => {
    selectorLabel.hidden = document.hits.length === 0;
    editor.hidden = document.hits.length === 0;
    if (!document.hits.length) {
      list.innerHTML = `<legend>逐击纳入事件组件小计</legend><p>这次监听调用没有已计算命中；实际攻击是否已结束仍看下方事件回执。</p>`;
      select.innerHTML = "";
      return;
    }
    list.innerHTML = `<legend>逐击纳入事件组件小计</legend>${document.hits.map((hit, index) => {
      const capture = hit.calculation.originalCapture;
      const request = capture.calculation.request;
      return `<label><input type="checkbox" data-source-event-included="${index}" ${hit.included ? "checked" : ""}>命中 #${capture.application.id} · ${esc(request.actorKey)} / ${esc(request.ability)} · 第 ${capture.application.frame} 帧 · 目标 ${capture.application.targetKey}</label>`;
    }).join("")}`;
    select.innerHTML = document.hits.map((hit, index) => {
      const capture = hit.calculation.originalCapture;
      return `<option value="${index}" ${index === selected ? "selected" : ""}>命中 #${capture.application.id} · ${esc(hit.calculation.label)}</option>`;
    }).join("");
  };

  const drawSummary = (): void => {
    if (editorInvalid) {
      summary.innerHTML = `<p role="alert">当前命中输入有空白或无效值。请先修正，再查看事件小计、切换命中或导出；不会显示旧的总额。</p>`;
      return;
    }
    try {
      const result = calculateSourceHostEventCollection(document);
      const includedIds = new Set(document.hits.filter(hit => hit.included).map(hit => hit.calculation.originalCapture.application.id));
      const rows = result.rows.map(row => `<tr data-source-event-row${row.applicationId === undefined ? "" : ` data-source-event-application="${row.applicationId}"`}>
        <td>${row.applicationId === undefined ? "—" : `#${row.applicationId}`}</td>
        <td>${row.attackId === undefined ? "—" : row.attackId}</td>
        <td>${row.dispatchId === undefined ? "—" : row.dispatchId}</td>
        <td>${row.targetKey === undefined ? "—" : row.targetKey}</td>
        <td>${esc(rowState(row))}</td>
        <td>${row.status === "pending" || row.status === "unresolved" || row.status === "excluded" || row.value === undefined ? "—" : amount(row.value)}</td>
        <td>${row.applicationId === undefined ? "—" : includedIds.has(row.applicationId) ? "纳入" : "排除"}</td>
        <td>${esc(row.reason)}${row.trace.length ? renderTraceHtml(row.trace) : ""}</td></tr>`).join("");
      const knownTotal = result.knownSubtotal === undefined
        ? "目前没有可报告的已知事件攻击小计；未知或待处理不按零伤害处理。"
        : `纳入的事件攻击已知小计：<strong data-source-event-total>${amount(result.total)}</strong>。`;
      const deliveryLabel = result.analysis.deliveryClosed ? "本次事件攻击已结算" : "本次事件攻击尚未结算完毕";
      summary.innerHTML = `<section data-source-event-delivery="${result.analysis.deliveryClosed ? "closed" : "pending"}">
        <h3>${deliveryLabel}</h3>
        <p>${knownTotal}</p>
        ${result.analysis.attackCount > 0 || result.analysis.producerCount > 0 ? `<p>事件实际排入攻击 ${result.analysis.attackCount} 次；相关延迟任务已完成 ${result.analysis.completedProducerCount} / 登记 ${result.analysis.producerCount}，仍待处理 ${result.analysis.pendingProducerCount}。任务完成不代替目标应用闭合。</p>` : ""}
        ${result.analysis.scopeNotes.map(note => `<p>${esc(note)}</p>`).join("")}
        ${result.analysis.reasons.length ? `<ul data-source-event-reasons>${result.analysis.reasons.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>` : ""}
        ${result.rows.length ? `<details><summary>事件攻击与目标结算记录（${result.rows.length} 项）</summary><div class="table-wrap"><table><thead><tr><th>应用</th><th>攻击</th><th>派发</th><th>目标</th><th>状态</th><th>数值</th><th>选择</th><th>说明与公式</th></tr></thead><tbody>${rows}</tbody></table></div></details>` : `<p>没有应用行；事件攻击交付状态仍由原生监听与派发回执判定。</p>`}
        ${result.trace.length ? `<details><summary>汇总公式与逐击求和</summary>${renderTraceHtml(result.trace)}</details>` : ""}
      </section>`;
    } catch (error) {
      summary.innerHTML = `<p role="alert">当前事件集合不能计算：${esc(error instanceof Error ? error.message : error)}</p>`;
    }
  };

  const renderEditor = (): void => {
    if (!document.hits.length) {
      editorInvalid = false;
      editor.innerHTML = "";
      drawSummary();
      return;
    }
    editorInvalid = false;
    renderSourceHostCalculator(editor, document.hits[selected]!.calculation, (calculation: SourceHostEditableCalculation | null) => {
      if (calculation) document.hits[selected]!.calculation = calculation;
      editorInvalid = calculation === null;
      drawSummary();
    });
    const perHitExport = editor.querySelector<HTMLButtonElement>("[data-source-host-export]");
    if (perHitExport) perHitExport.hidden = true;
    drawSummary();
  };

  editor.addEventListener("input", () => {
    if (!activeHitValid()) editorInvalid = true;
    else {
      try { calculateSourceHostEventCollection(document); editorInvalid = false; }
      catch { editorInvalid = true; }
    }
    drawSummary();
  });
  list.addEventListener("change", event => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-source-event-included]");
    if (!input) return;
    document.hits[Number(input.dataset.sourceEventIncluded)]!.included = input.checked;
    drawSummary();
  });
  select.addEventListener("change", () => {
    if (!document.hits.length) return;
    if (editorInvalid || !activeHitValid()) {
      editorInvalid = true;
      select.value = String(selected);
      drawSummary();
      return;
    }
    const next = Number(select.value);
    if (!Number.isInteger(next) || !document.hits[next]) return;
    selected = next;
    renderEditor();
  });
  root.querySelector<HTMLButtonElement>("[data-source-event-export]")!.onclick = () => {
    if (document.hits.length && (editorInvalid || !activeHitValid())) editorInvalid = true;
    if (editorInvalid) { drawSummary(); return; }
    try {
      calculateSourceHostEventCollection(document);
      downloadSourceHostJson(sourceHostEventCollectionSchema.parse(document), "source-host-event-collection.json");
    } catch (error) {
      summary.innerHTML = `<p role="alert">无法导出：${esc(error instanceof Error ? error.message : error)}</p>`;
    }
  };

  renderHits();
  renderEditor();
}
