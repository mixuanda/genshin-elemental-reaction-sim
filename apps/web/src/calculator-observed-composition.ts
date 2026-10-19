import {
  calculateObservedSkillComposition, parseObservedSkillComposition, serializeObservedSkillComposition,
  type ObservedSkillCompositionDocument, type ObservedSkillCompositionResult,
} from "../../../packages/sim-core/src/observed-skill-composition";
import { parseCalculatorDocument, type CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { createObservedSkillCompositionExamples } from "./calculator-observed-composition-examples";
import { mountCalculatorAggregation } from "./calculator-aggregation-view";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const amount = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
type Options = {
  onEditComponent(document: CalculatorDocument, save: (document: CalculatorDocument) => ObservedSkillCompositionDocument): void;
  onDocumentChange(document: ObservedSkillCompositionDocument): void;
};

/** One public calculation view; every contact uses the existing independent hit editor and core. */
export function mountObservedSkillComposition(root: HTMLElement, initial: ObservedSkillCompositionDocument | undefined, options: Options): void {
  let document = initial ? structuredClone(initial) : undefined;
  let result: ObservedSkillCompositionResult | undefined;
  let dirty = false;
  const message = (text: string): void => { root.querySelector<HTMLElement>("[data-composition-message]")!.textContent = text; };
  const changed = (): void => { if (document) options.onDocumentChange(structuredClone(document)); };
  const edit = (id: string): void => {
    if (dirty) { message("请先应用或放弃尚未应用的事件文档。"); return; }
    const row = result?.components.find(component => component.id === id);
    if (!document || !row?.document) return;
    const eventId = row.eventId;
    options.onEditComponent(structuredClone(row.document), child => {
      const component = document!.components.find(item => item.eventId === eventId);
      if (!component) throw new Error("此事件还没有已保存的命中输入。");
      component.document = structuredClone(child);
      changed();
      return structuredClone(document!);
    });
  };
  function renderResult(): void {
    const host = root.querySelector<HTMLElement>("[data-composition-result]")!;
    if (dirty) { result = undefined; host.innerHTML = '<p class="calculator-status blocked">事件文档尚未应用；旧结果不再显示。请应用后计算或导出。</p>'; return; }
    if (!document) { result = undefined; host.innerHTML = '<p class="calculator-hint">载入教学示例或导入实际观察文档。每段面板、反应条件与目标状态分别计算，不需要队伍配置。</p>'; return; }
    try {
      result = calculateObservedSkillComposition(document);
      const coverage = { "complete-cast": "条件性完整施放", "complete-observed-window": "完整已观察区间", partial: "尚未闭合的组成" }[result.coverage];
      const windowTotal = result.coverage === "complete-observed-window" && result.totals
        ? `<section class="calculator-status"><h3>完整已观察区间合计</h3><p>非暴击 ${amount(result.totals.nonCritical)} · 暴击 ${amount(result.totals.critical)} · 期望 <strong data-composition-window-total>${amount(result.totals.expected)}</strong></p><p>这些数值覆盖所声明的完整观察区间；不认证它等于一次按住重击或一次纯技能施放。</p></section>` : "";
      host.innerHTML = `<h3>${esc(document.label)}</h3><p><span class="calculator-badge provisional" data-composition-coverage="${result.coverage}">${coverage}</span> · 用户观察条件／固定来源公式，非游戏内验证</p><p class="calculator-hint">目标：${esc(document.targetId)}。每段保留独立面板、反应与取样身份。这里报告伤害，不使用隐含时长计算 DPS。</p>${windowTotal}<div data-composition-aggregation></div>` +
        (result.blockers.length ? `<div class="calculator-status blocked"><strong>尚缺条件</strong><ul>${result.blockers.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul></div>` : "") +
        `<ul class="calculator-hint">${[...document.assumptions, ...result.warnings].map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>` +
        `<section data-composition-sum-trace><h3>逐段求和与落空记录</h3>${renderTraceHtml(result.trace.filter(node => !node.id.startsWith("component.")))}</section>` +
        result.components.map((row, index) => `<details data-composition-component="${esc(row.id)}"><summary>${esc(row.label)} · ${row.status === "calculated" ? "已计算" : row.status === "non-damaging" ? "落空／非伤害" : "待补输入"}</summary><p>实际事件：${esc(row.eventId)}</p>${row.blockers.length ? `<p class="calculator-error">${row.blockers.map(esc).join("；")}</p>` : ""}${row.document ? `<button type="button" data-composition-edit="${esc(row.id)}">在独立计算器编辑本段</button>` : row.status === "blocked" ? `<label class="file-button">为此事件导入单击计算 JSON<input type="file" data-composition-attach="${esc(row.eventId)}" accept="application/json,.json"></label>` : '<p>已明确未命中所选目标，贡献为零；不需要伪造一份伤害面板。</p>'}<div data-composition-child-trace="${index}"></div></details>`).join("") +
        `<details class="calculator-audit" data-composition-audit><summary>完整组成、逐段上下文与执行轨迹</summary><pre>${esc(JSON.stringify({ document, result }, null, 2))}</pre></details>`;
      const aggregation = { ...result.aggregation };
      // The window total above has a different scope from a complete skill cast.
      if (result.coverage === "complete-observed-window") delete aggregation.knownSubtotal;
      mountCalculatorAggregation(host.querySelector<HTMLElement>("[data-composition-aggregation]")!, aggregation);
    } catch (error) {
      result = undefined;
      host.innerHTML = `<p class="calculator-error">${esc(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }
  function render(): void {
    root.innerHTML = `<header><h2>完整施放与实际观察区间</h2><p>统一查看一次召唤或一个实际观察区间的普通、特殊伤害和落空。每段可打开原独立计算器，编辑后返回重新汇总。</p></header><div class="calculator-toolbar"><button type="button" data-composition-example="0">露米混合伤害教学示例</button><button type="button" data-composition-example="1">Fagio 观察区间教学示例</button><label class="file-button">导入完整组成 JSON<input type="file" data-composition-import accept="application/json,.json"></label>${document ? '<button type="button" data-composition-export>导出完整组成 JSON</button>' : ""}</div><p data-composition-message role="status"></p>`;
    if (document) {
      const events = document.context.events;
      const eventOptions = (value: string | undefined): string => '<option value="">尚未记录</option>' + events.map(event => `<option value="${esc(event.id)}"${event.id === value ? " selected" : ""}>${esc(event.id)} · ${event.frame} 帧 · ${esc(event.kind)}</option>`).join("");
      root.insertAdjacentHTML("beforeend", `<fieldset><legend>本次归属与观察边界</legend><p class="calculator-hint">${document.profile === "linnea-lumi" ? "露米须有实际召唤和离场记录。Q 刷新后的同一实体输出会单列为有干预的观察区间，不能冒充纯一次 E。" : "Fagio 的资料没有给出足够的按住重击边界。这里汇总明确记录的观察区间，不推断首末击、频率或次数。"}</p><div class="calculator-fields"><label>起点事件<select data-composition-origin>${eventOptions(document.originEventId)}</select></label><label>终点事件<select data-composition-end>${eventOptions(document.endEventId)}</select></label></div><label><input type="checkbox" data-composition-all${document.allOpportunitiesRecorded ? " checked" : ""}>已记录本目标的全部伤害机会，包括落空</label><label><input type="checkbox" data-composition-closed${document.damageWindowClosed ? " checked" : ""}>已实际观察到伤害窗口结束，不再有属于本次的后续交付</label><details><summary>编辑完整事件、命中输入与未分类组成</summary><p class="calculator-hint">下方保留所有子段的完整计算文档。未分类伤害须写入 unmappedOpportunities，不能删除后声称完整。</p><textarea data-composition-json rows="18" spellcheck="false">${esc(serializeObservedSkillComposition(document))}</textarea><button type="button" data-composition-apply>应用完整文档</button><button type="button" data-composition-reset>放弃未应用编辑</button></details></fieldset>`);
    }
    root.insertAdjacentHTML("beforeend", '<section data-composition-result aria-live="polite"></section>');
    renderResult();
  }
  root.addEventListener("input", event => {
    if (!(event.target instanceof HTMLTextAreaElement) || !event.target.matches("[data-composition-json]")) return;
    dirty = true;
    root.querySelector<HTMLButtonElement>("[data-composition-export]")!.disabled = true;
    renderResult();
  });
  root.addEventListener("change", async event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    try {
      if (input instanceof HTMLInputElement && input.type === "file") {
        const file = input.files?.[0]; if (!file) return;
        const text = await file.text();
        if (input.hasAttribute("data-composition-import")) document = parseObservedSkillComposition(text);
        else if (input.dataset.compositionAttach && document) {
          const child = parseCalculatorDocument(text), eventId = input.dataset.compositionAttach;
          const previous = document.components.find(row => row.eventId === eventId);
          if (previous) previous.document = child;
          else document.components.push({ id: `component:${eventId}`, eventId, document: child });
        } else return;
        dirty = false; changed(); render(); return;
      }
      if (!document) return;
      if (dirty) { message("请先应用或放弃完整文档草稿，再修改观察边界。"); return; }
      if (input.hasAttribute("data-composition-origin")) {
        if (!input.value) { input.value = document.originEventId; message("请选择已记录的实际起点事件。"); return; }
        document.originEventId = input.value;
      }
      else if (input.hasAttribute("data-composition-end")) { if (input.value) document.endEventId = input.value; else delete document.endEventId; }
      else if (input instanceof HTMLInputElement && input.hasAttribute("data-composition-all")) document.allOpportunitiesRecorded = input.checked;
      else if (input instanceof HTMLInputElement && input.hasAttribute("data-composition-closed")) document.damageWindowClosed = input.checked;
      else return;
      changed(); render();
    } catch (error) { message(error instanceof Error ? error.message : String(error)); }
  });
  root.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!target) return;
    try {
      if (target.dataset.action === "cast-open-hit") { event.stopPropagation(); edit(target.dataset.castHitId!); }
      else if (target.dataset.compositionEdit) edit(target.dataset.compositionEdit);
      else if (target.dataset.compositionExample !== undefined) {
        document = createObservedSkillCompositionExamples()[Number(target.dataset.compositionExample)];
        dirty = false; changed(); render();
      } else if (target.hasAttribute("data-composition-reset")) { dirty = false; render(); }
      else if (target.hasAttribute("data-composition-apply")) {
        document = parseObservedSkillComposition(root.querySelector<HTMLTextAreaElement>("[data-composition-json]")!.value);
        dirty = false; changed(); render();
      } else if (target.hasAttribute("data-composition-export") && document && !dirty) {
        const blob = new Blob([serializeObservedSkillComposition(document)], { type: "application/json" });
        const url = URL.createObjectURL(blob), anchor = window.document.createElement("a");
        anchor.href = url; anchor.download = `${document.id}.composition.json`; anchor.click(); URL.revokeObjectURL(url);
      }
    } catch (error) { message(error instanceof Error ? error.message : String(error)); }
  });
  root.addEventListener("toggle", event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.dataset.compositionComponent || !result) return;
    const trace = details.querySelector<HTMLElement>("[data-composition-child-trace]");
    if (trace && !trace.hasChildNodes()) trace.innerHTML = renderTraceHtml(result.components[Number(trace.dataset.compositionChildTrace)]?.result?.trace ?? result.components[Number(trace.dataset.compositionChildTrace)]?.trace ?? []);
  }, true);
  render();
}
