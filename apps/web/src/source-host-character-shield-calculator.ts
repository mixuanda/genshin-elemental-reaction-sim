import {
  calculateSourceHostCharacterShieldEditable, createSourceHostCharacterShieldEditable,
  replaySourceHostCharacterShield, sourceHostCharacterShieldCaptureSchema, sourceHostCharacterShieldEditableSchema,
  type SourceHostCharacterShieldCapture, type SourceHostCharacterShieldEditable,
} from "../../../packages/sim-core/src/source-host-character-shield-capture";
import { sourceHostCharacterShieldRuleDescriptor } from "../../../packages/sim-core/src/source-host-character-shield-formula";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson } from "./source-host-calculator";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });

/** Explore one observed shield HP assignment. Native shield lifecycle remains historical. */
export function renderSourceHostCharacterShieldCalculator(root: HTMLElement,
  input: SourceHostCharacterShieldCapture | SourceHostCharacterShieldEditable): void {
  let current = input.schemaVersion === "source-host-character-shield-calculator-v1"
    ? sourceHostCharacterShieldEditableSchema.parse(input) : createSourceHostCharacterShieldEditable(input);
  const replay = replaySourceHostCharacterShield(current.originalCapture);
  const { request } = current.originalCapture.calculation;
  const descriptor = sourceHostCharacterShieldRuleDescriptor(current.input.ruleId);
  const unit = descriptor.resultUnit ?? "HP";
  const fields = Object.entries(descriptor.inputs).map(([key, parameter]) => {
    const value = current.input.state[key];
    const label = `${esc(parameter.label)}（${esc(parameter.unit)}）`;
    if (parameter.choices?.length) return `<label>${label}<select required data-source-host-character-shield-input="${esc(key)}">${parameter.choices.map(choice =>
      `<option value="${choice.value}"${choice.value === value ? " selected" : ""}>${esc(choice.label)} · ${choice.value}</option>`).join("")}</select></label>`;
    return `<label>${label}<input type="number" required step="${parameter.integer ? "1" : "any"}"${parameter.minimum === undefined ? "" : ` min="${parameter.minimum}"`}${parameter.maximum === undefined ? "" : ` max="${parameter.maximum}"`} data-source-host-character-shield-input="${esc(key)}" value="${value}"></label>`;
  }).join("");
  root.innerHTML = `<article class="card" data-source-host-character-shield-calculator><h2>来源角色护盾公式 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>第 ${request.frame} 帧 · ${esc(request.actorKey)} · ${esc(descriptor.title)} · 来源持有者索引 ${current.input.sourceHolderIndex}。执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
    <p>来源${unit === "HP" ? "写入" : "前置计算"} ${num(replay.originalValue)} ${esc(unit)}；相同输入共享公式重放 ${num(replay.reproducedValue)} ${esc(unit)}。来源规则身份：<code>${esc(current.input.ruleId)}</code>。来源数值仍待游戏规则核实。</p>
    <p>可编辑下方本次计算点的原始数值叶。规则、角色身份与历史回执固定；编辑仅重算这一步${esc(unit)}算式，不重放护盾创建、刷新、替换、到期、受击消耗或后续轮转。</p>
    <div class="calculator-fields">${fields || "<p>此规则没有可编辑的数值状态叶；仍可查看原始共享算式。</p>"}</div>
    <div class="editor-actions"><button type="button" data-source-host-character-shield-reset>恢复捕获值</button><button type="button" data-source-host-character-shield-export>导出独立护盾计算 JSON</button><label class="file-button">导入独立护盾计算 JSON<input type="file" accept="application/json,.json" data-source-host-character-shield-import></label></div>
    <div data-source-host-character-shield-result role="status"></div>
    <details><summary>原始来源算式、输入定义与计算回执</summary>${renderTraceHtml(replay.trace)}<pre>${esc(JSON.stringify({ request, sourceFile: descriptor.sourceFile, inputs: descriptor.inputs, dependencies: current.originalCapture.dependencies, supportingCalculations: current.originalCapture.supportingCalculations }, null, 2))}</pre></details>
  </article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-character-shield-result]")!;
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-source-host-character-shield-input]")]
        .some(field => !field.value.trim() || !field.checkValidity()))
        throw new Error("请填写有效的护盾公式输入；留空不能当作零。");
      const edited = calculateSourceHostCharacterShieldEditable(current);
      output.innerHTML = `<h3>编辑后${unit === "HP" ? "护盾 HP" : "前置计算值"}：${num(edited.editedValue)} ${esc(unit)}</h3><p>原捕获值 ${num(edited.originalValue)}；算式差值 ${num(edited.difference)} ${esc(unit)}。此结果仅对应一次数值计算。</p><p>来源护盾生命周期和后续伤害状态均未重新执行。</p><ul>${edited.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${renderTraceHtml(edited.trace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  const changeInput = (field: HTMLInputElement | HTMLSelectElement): void => {
    const key = field.dataset.sourceHostCharacterShieldInput;
    if (!key || !(key in current.input.state)) return;
    current.input = { ...current.input, state: { ...current.input.state, [key]: Number(field.value) } };
    calculate();
  };
  root.oninput = event => changeInput(event.target as HTMLInputElement | HTMLSelectElement);
  root.onchange = event => {
    const field = event.target as HTMLSelectElement;
    if (field.matches("select[data-source-host-character-shield-input]")) changeInput(field);
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-character-shield-reset]")) {
      current = createSourceHostCharacterShieldEditable(current.originalCapture);
      renderSourceHostCharacterShieldCalculator(root, current);
      return;
    }
    if (target.closest("[data-source-host-character-shield-export]")) {
      try { calculateSourceHostCharacterShieldEditable(current); downloadSourceHostJson(current, "source-host-character-shield-calculation.json"); }
      catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    }
  };
  root.querySelector<HTMLInputElement>("[data-source-host-character-shield-import]")!.onchange = async event => {
    const field = event.currentTarget as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const version = (value as { schemaVersion?: string }).schemaVersion;
      const restored = version === "source-host-character-shield-calculator-v1"
        ? sourceHostCharacterShieldEditableSchema.parse(value)
        : version === "source-host-character-shield-v1"
          ? createSourceHostCharacterShieldEditable(sourceHostCharacterShieldCaptureSchema.parse(value))
          : (() => { throw new Error("文件不是来源角色护盾捕获或独立护盾计算 JSON。"); })();
      renderSourceHostCharacterShieldCalculator(root, restored);
    } catch (error) { output.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`; }
    field.value = "";
  };
  calculate();
}
