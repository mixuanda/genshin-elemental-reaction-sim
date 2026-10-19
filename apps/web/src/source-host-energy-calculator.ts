import {
  calculateSourceHostEnergyEditable, createSourceHostEnergyEditable,
  replaySourceHostEnergy, sourceHostEnergyEditableSchema, sourceHostEnergyCaptureSchema,
  type SourceHostEnergyCapture, type SourceHostEnergyEditable,
} from "../../../packages/sim-core/src/source-host-energy-capture";
import type { SourceHostEnergyInput } from "../../../packages/sim-core/src/source-host-energy-formula";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson } from "./source-host-calculator";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const operationLabels: Record<SourceHostEnergyInput["operation"], string> = {
  "flat-change": "直接能量变化", consume: "能量消耗", "particle-amount": "粒子金额", "particle-apply": "粒子入账",
};
const elementLabels: Record<string, string> = {
  "": "无元素", pyro: "火", hydro: "水", electro: "雷", cryo: "冰", anemo: "风", geo: "岩", dendro: "草", physical: "物理",
};
const artifactRules = {
  exile: { label: "流放者", amount: 2 }, scholar: { label: "学士", amount: 3 },
  scroll: { label: "烬城勇者绘卷", amount: 6 }, reminiscence: { label: "追忆之注连", amount: -15 },
} as const;

/** Edit one captured numeric energy operation without replaying its Go event history. */
export function renderSourceHostEnergyCalculator(root: HTMLElement, input: SourceHostEnergyCapture | SourceHostEnergyEditable): void {
  let current = input.schemaVersion === "source-host-energy-calculator-v1"
    ? sourceHostEnergyEditableSchema.parse(input) : createSourceHostEnergyEditable(input);
  const original = replaySourceHostEnergy(current.originalCapture);
  const application = current.originalCapture.application;
  const request = current.originalCapture.calculation.request;
  const editable = current.input;
  const particle = current.particleInput;
  const artifact = editable.operation === "flat-change" && editable.artifactRule ? artifactRules[editable.artifactRule] : undefined;
  const energyFields = editable.operation === "particle-amount" ? "" : `
    <label>操作前能量<input type="number" step="any" required data-source-host-energy-input="energyBefore" value="${editable.energyBefore}"></label>
    <label>能量上限<input type="number" step="any" required data-source-host-energy-input="energyMax" value="${editable.energyMax}"></label>
    ${artifact ? `<label>来源固定条款<input type="text" readonly value="${artifact.label} · ${artifact.amount} 能量"></label><p class="calculator-hint">该条款的金额来自来源固定公式，只读；仅编辑操作前能量与能量上限。</p>` : `<label>操作金额<input type="number" step="any" required data-source-host-energy-input="amount" value="${editable.amount}"></label>`}`;
  const particleFields = editable.operation === "particle-apply" && particle?.operation === "particle-amount" ? `
    <fieldset data-source-host-energy-particle-inputs><legend>实际粒子分配输入</legend>
      <p class="calculator-hint">元素分支沿用捕获值，只编辑本角色本次粒子分配读取的充能效率、粒子数、前后台与队伍人数。终端入账金额随这些输入重算；原生粒子生成与接收者仍保持历史回执。</p>
      <p>粒子元素：${esc(elementLabels[particle.particleElement] ?? (particle.particleElement || "来源原始值"))}；受能角色元素：${esc(elementLabels[particle.actorElement] ?? (particle.actorElement || "来源原始值"))}</p>
      <div class="calculator-fields">
        <label>本次读取的元素充能效率<input type="number" step="any" required data-source-host-energy-particle-input="energyRecharge" value="${particle.energyRecharge}"></label>
        <label>粒子数量<input type="number" step="any" required data-source-host-energy-particle-input="particleCount" value="${particle.particleCount}"></label>
        <label>角色位置<select required data-source-host-energy-particle-input="isActive"><option value="true" ${particle.isActive ? "selected" : ""}>前台</option><option value="false" ${!particle.isActive ? "selected" : ""}>后台</option></select></label>
        <label>队伍人数<input type="number" step="1" required data-source-host-energy-particle-input="partyCount" value="${particle.partyCount}"></label>
      </div>
    </fieldset>` : "";
  root.innerHTML = `<article class="card" data-source-host-energy-calculator>
    <h2>来源能量事件 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>第 ${application.frame} 帧 · ${esc(application.actorKey)} · ${esc(application.source)} · ${operationLabels[application.operation]}。执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
    <p>原生能量 ${num(application.energyBefore)} → ${num(application.energyAfter)}；重放 ${num(original.reproducedEnergy)}；请求量 ${num(application.requestedAmount)}；实际变化 ${num(original.actualChange)}；溢出 ${num(original.overflow)}。编辑只重算已捕获的数值操作，不重演冷却、粒子生成、接收者选择或历史触发。</p>
    <p>操作类型：${operationLabels[editable.operation]}；前置金额计算：${application.amountCalculationId ?? "无"}。</p>
    ${energyFields}${particleFields}
    <div class="editor-actions"><button type="button" data-source-host-energy-reset>恢复捕获值</button><button type="button" data-source-host-energy-export>导出独立能量计算 JSON</button><label class="file-button">导入独立能量计算 JSON<input type="file" accept="application/json,.json" data-source-host-energy-import></label></div>
    <div data-source-host-energy-result role="status"></div>
    <details><summary>原始能量事件公式、变量与代入</summary>${renderTraceHtml(original.trace)}<pre>${esc(JSON.stringify({ application, request, components: current.originalCapture.components.map(row => row.request) }, null, 2))}</pre></details>
  </article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-energy-result]")!;
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-source-host-energy-input], [data-source-host-energy-particle-input]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请填写有效能量输入；留空不能当作零。");
      const result = calculateSourceHostEnergyEditable(current);
      output.innerHTML = `<h3>编辑后能量：${num(result.value)}</h3><p>原捕获结果 ${num(result.originalEnergy)}；变化 ${num(result.difference)}。请求量 ${num(result.requestedAmount)}；本次实际变化 ${num(result.actualChange)}；溢出 ${num(result.overflow)}。</p><p>此为已捕获操作的独立数值实验，未重新执行队伍、冷却、触发、生成粒子或真实属性读取。</p><ul>${result.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${renderTraceHtml(result.trace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.oninput = event => {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    const energyKey = field.dataset.sourceHostEnergyInput as "energyBefore" | "energyMax" | "amount" | undefined;
    if (energyKey && current.input.operation !== "particle-amount") {
      const value = Number(field.value);
      current.input = { ...current.input, [energyKey]: value } as typeof current.input;
      calculate(); return;
    }
    const particleKey = field.dataset.sourceHostEnergyParticleInput;
    if (particleKey && current.particleInput?.operation === "particle-amount") {
      const value: string | number | boolean = particleKey === "isActive" ? field.value === "true" : Number(field.value);
      current.particleInput = { ...current.particleInput, [particleKey]: value } as typeof current.particleInput;
      calculate();
    }
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-energy-reset]")) {
      current = createSourceHostEnergyEditable(current.originalCapture);
      renderSourceHostEnergyCalculator(root, current);
      return;
    }
    if (target.closest("[data-source-host-energy-export]")) {
      try {
        calculateSourceHostEnergyEditable(current);
        downloadSourceHostJson(current, "source-host-energy-calculation.json");
      } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    }
  };
  root.querySelector<HTMLInputElement>("[data-source-host-energy-import]")!.onchange = async event => {
    const field = event.currentTarget as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const version = (value as { schemaVersion?: string }).schemaVersion;
      const restored = version === "source-host-energy-calculator-v1"
        ? sourceHostEnergyEditableSchema.parse(value)
        : version === "source-host-energy-v1" ? createSourceHostEnergyEditable(sourceHostEnergyCaptureSchema.parse(value))
          : (() => { throw new Error("文件不是来源能量捕获或独立能量计算 JSON。"); })();
      renderSourceHostEnergyCalculator(root, restored);
    } catch (error) { output.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`; }
    field.value = "";
  };
  calculate();
}
