import {
  calculateSourceHostDrainEditable, createSourceHostDrainEditable, replaySourceHostDrain,
  sourceHostDrainCaptureSchema, sourceHostDrainEditableSchema,
  type SourceHostDrainCapture, type SourceHostDrainEditable,
} from "../../../packages/sim-core/src/source-host-drain-capture";
import { sourceHostDrainSourceRuleDescriptor } from "../../../packages/sim-core/src/source-host-drain-source-formula";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson } from "./source-host-calculator";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });

/** Edit one observed Drain's source amount, then recalculate its ratio on the captured HP state. */
export function renderSourceHostDrainCalculator(root: HTMLElement,
  input: SourceHostDrainCapture | SourceHostDrainEditable): void {
  let current = input.schemaVersion === "source-host-drain-calculator-v1"
    ? sourceHostDrainEditableSchema.parse(input) : createSourceHostDrainEditable(input);
  const replay = replaySourceHostDrain(current.originalCapture);
  const app = current.originalCapture.application;
  const sources = current.originalCapture.sources.filter(row => row.request.kind === "character-drain");
  const fields = sources.map(source => {
    if (source.request.kind !== "character-drain") return "";
    const request = source.request;
    const descriptor = sourceHostDrainSourceRuleDescriptor(request.input.ruleId);
    const edited = current.sourceInputs.find(row => row.id === request.id);
    const linked = new Set([
      ...(descriptor.statLeaves ?? (descriptor.statLeaf ? [descriptor.statLeaf] : [])).map(leaf => leaf.stateKey),
      ...Object.keys(descriptor.valueSources ?? {}),
    ]);
    const inputs = Object.entries(descriptor.inputs).map(([key, parameter]) => {
      const value = edited?.state[key] ?? request.input.state[key];
      const lock = linked.has(key);
      const label = `${esc(parameter.label)}（${esc(parameter.unit)}）${lock ? " · 由捕获的上游读取或公式固定" : ""}`;
      if (parameter.choices?.length && !lock)
        return `<label>${label}<select required data-source-host-drain-source-id="${request.id}" data-source-host-drain-source-key="${esc(key)}">${parameter.choices.map(choice => `<option value="${choice.value}"${choice.value === value ? " selected" : ""}>${esc(choice.label)} · ${choice.value}</option>`).join("")}</select></label>`;
      return `<label>${label}<input type="number" required step="${parameter.integer ? "1" : "any"}"${parameter.minimum === undefined ? "" : ` min="${parameter.minimum}"`}${parameter.maximum === undefined ? "" : ` max="${parameter.maximum}"`} data-source-host-drain-source-id="${request.id}" data-source-host-drain-source-key="${esc(key)}" value="${value}"${lock ? " readonly" : ""}></label>`;
    }).join("");
    return `<fieldset data-source-host-drain-source="${request.id}"><legend>${esc(descriptor.title)} · #${request.id}</legend><p>原生来源金额 ${num(source.value)} ${esc(descriptor.resultUnit)}；规则 <code>${esc(request.input.ruleId)}</code>；来源持有者 #${request.input.sourceHolderIndex}。${descriptor.outputSlot && descriptor.outputSlot !== "drain-amount" ? `此规则写入${esc(descriptor.outputSlot)}中间状态；其下游仍按真实因果链计算。` : ""}</p><div class="calculator-fields">${inputs || "<p>本条来源没有可编辑状态叶。</p>"}</div><p data-source-host-drain-source-output="${request.id}"></p></fieldset>`;
  }).join("");
  root.innerHTML = `<article class="card" data-source-host-drain-calculator><h2>来源扣血应用 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>第 ${app.frame} 帧 · ${esc(app.actorKey)} · ${esc(app.ability)}。执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
    <p>原生请求扣除 ${num(replay.originalAmount)} HP；扣除前 ${num(app.hpBefore)} / ${num(app.maxHp)} HP；本次原生写回比例 ${num(replay.originalRatio)}，相同输入公式重放 ${num(replay.reproducedRatio)}。零值事件也可能代表真实来源回调，不等于实际 HP 损失。</p>
    <p>下方只编辑本次来源公式允许的状态叶。原生角色门槛、上限、生命状态、事件和后续轮转不会重跑；生命比例使用捕获时真实的扣除前 HP 与生命上限。</p>
    <section data-source-host-drain-sources><h3>本次扣血的前置来源公式（${sources.length} 条）</h3>${fields || "<p>此应用没有可编辑的共享来源金额公式，只保留历史生命写回算术。</p>"}</section>
    <div class="editor-actions"><button type="button" data-source-host-drain-reset>恢复捕获值</button><button type="button" data-source-host-drain-export>导出独立扣血计算 JSON</button><label class="file-button">导入独立扣血计算 JSON<input type="file" accept="application/json,.json" data-source-host-drain-import></label></div>
    <div data-source-host-drain-result role="status"></div>
    <details><summary>原始来源链、输入定义与生命比例算式</summary>${replay.sourceCalculations.map(row => renderTraceHtml(row.trace)).join("")}${renderTraceHtml(replay.calculation.trace)}<pre>${esc(JSON.stringify({ application: app, sources: current.originalCapture.sources.map(row => row.request), calculation: current.originalCapture.calculation.request, supportingCalculations: current.originalCapture.supportingCalculations }, null, 2))}</pre></details>
  </article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-drain-result]")!;
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-source-host-drain-source-key]")]
        .some(field => !field.value.trim() || !field.checkValidity()))
        throw new Error("请填写有效的扣血来源公式输入；留空不能当作零。");
      const result = calculateSourceHostDrainEditable(current);
      for (const source of sources) {
        const updated = result.sourceCalculations.find(row => row.request.id === source.request.id);
        const target = root.querySelector<HTMLElement>(`[data-source-host-drain-source-output="${source.request.id}"]`);
        if (target && updated) target.textContent = `来源原值 ${num(source.value)} → 编辑后 ${num(updated.value)}；差值 ${num(updated.value - source.value)}。`;
      }
      output.innerHTML = `<h3>编辑后扣血请求 ${num(result.editedAmount)} HP；生命比例 ${num(result.editedRatio)}</h3><p>原请求 ${num(result.originalAmount)} → ${num(result.editedAmount)} HP；原比例 ${num(result.originalRatio)} → ${num(result.editedRatio)}；比例差值 ${num(result.difference)}。${result.edited ? "已编辑上游数值。" : "当前使用捕获时的原始输入。"}</p><p>此计算没有写回角色生命，也没有重新执行原生扣血门槛或后续状态。</p><ul>${result.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${result.sourceCalculations.map(row => renderTraceHtml(row.trace)).join("")}${renderTraceHtml(result.calculation.trace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  const change = (field: HTMLInputElement | HTMLSelectElement): void => {
    const id = Number(field.dataset.sourceHostDrainSourceId);
    const key = field.dataset.sourceHostDrainSourceKey;
    if (!key || !Number.isInteger(id) || (field instanceof HTMLInputElement && field.readOnly)) return;
    const source = current.sourceInputs.find(row => row.id === id);
    if (!source || !(key in source.state)) return;
    current.sourceInputs = current.sourceInputs.map(row => row.id === id
      ? { ...row, state: { ...row.state, [key]: Number(field.value) } } : row);
    calculate();
  };
  root.oninput = event => change(event.target as HTMLInputElement | HTMLSelectElement);
  root.onchange = event => {
    const field = event.target as HTMLSelectElement;
    if (field.matches("select[data-source-host-drain-source-key]")) change(field);
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-drain-reset]")) {
      current = createSourceHostDrainEditable(current.originalCapture);
      renderSourceHostDrainCalculator(root, current); return;
    }
    if (target.closest("[data-source-host-drain-export]")) {
      try { calculateSourceHostDrainEditable(current); downloadSourceHostJson(current, "source-host-drain-calculation.json"); }
      catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    }
  };
  root.querySelector<HTMLInputElement>("[data-source-host-drain-import]")!.onchange = async event => {
    const field = event.currentTarget as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const version = (value as { schemaVersion?: string }).schemaVersion;
      const restored = version === "source-host-drain-calculator-v1"
        ? sourceHostDrainEditableSchema.parse(value)
        : version === "source-host-drain-v1"
          ? createSourceHostDrainEditable(sourceHostDrainCaptureSchema.parse(value))
          : (() => { throw new Error("文件不是来源扣血捕获或独立扣血计算 JSON。"); })();
      renderSourceHostDrainCalculator(root, restored);
    } catch (error) { output.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`; }
    field.value = "";
  };
  calculate();
}
