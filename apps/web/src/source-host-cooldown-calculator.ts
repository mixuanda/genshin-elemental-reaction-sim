import {
  calculateSourceHostCooldownEditable, createSourceHostCooldownEditable,
  replaySourceHostCooldown, sourceHostCooldownCaptureSchema, sourceHostCooldownEditableSchema,
  type SourceHostCooldownCapture, type SourceHostCooldownEditable,
} from "../../../packages/sim-core/src/source-host-cooldown-capture";
import type { SourceHostCooldownInput } from "../../../packages/sim-core/src/source-host-cooldown-formula";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson } from "./source-host-calculator";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const opLabels: Record<SourceHostCooldownInput["operation"], string> = { duration: "写入冷却时长", remaining: "读取剩余冷却", reduce: "缩短队首冷却",
  source: "冷却返还来源", route: "角色冷却转发", "special-reduce": "四风独立到期帧" };
const fieldsByOperation = {
  duration: { originalDuration: "来源输入持续帧数", cooldownFactor: "来源读取冷却倍率" },
  remaining: { workerStartedAt: "冷却计时起始帧", headDuration: "队首冷却帧数", currentFrame: "本次读取帧" },
  reduce: { remaining: "队首剩余冷却帧数", reduction: "本次传入缩短帧数" },
  source: {},
  route: { reduction: "本次转发缩短帧数" },
  "special-reduce": { expiry: "四风原到期帧", reduction: "本次返还帧数", currentFrame: "本次执行帧" },
} as const;

/** Recompute one captured numeric cooldown step; native queue behavior stays historical. */
export function renderSourceHostCooldownCalculator(root: HTMLElement, input: SourceHostCooldownCapture | SourceHostCooldownEditable): void {
  let current = input.schemaVersion === "source-host-cooldown-calculator-v1"
    ? sourceHostCooldownEditableSchema.parse(input) : createSourceHostCooldownEditable(input);
  const replay = replaySourceHostCooldown(current.originalCapture);
  const { request } = replay;
  const originalInput = replay.request.input;
  const visibleFields = Object.entries(fieldsByOperation[originalInput.operation]);
  const fields = visibleFields.map(([key, label]) => `<label>${label}<input type="number" step="${key === "cooldownFactor" ? "any" : "1"}" required data-source-host-cooldown-input="${key}" value="${current.input[key as keyof typeof current.input]}"></label>`).join("");
  root.innerHTML = `<article class="card" data-source-host-cooldown-calculator><h2>来源冷却操作 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>第 ${request.frame} 帧 · ${esc(request.actorKey)} · ${esc(request.ability)} · 动作 ${esc(originalInput.action)}（类型 ${originalInput.actionType}）· ${opLabels[originalInput.operation]}。执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
    <p>捕获值 ${replay.originalValue} 帧；相同输入重放 ${replay.reproducedValue} 帧。下方只编辑本次共享算式输入，不改变冷却队列和动作安排、角色覆写或版本分支，也不重跑完整轮转。</p>
    <div class="calculator-fields">${fields}</div>
    <div class="editor-actions"><button type="button" data-source-host-cooldown-reset>恢复捕获值</button><button type="button" data-source-host-cooldown-export>导出独立冷却计算 JSON</button><label class="file-button">导入独立冷却计算 JSON<input type="file" accept="application/json,.json" data-source-host-cooldown-import></label></div>
    <div data-source-host-cooldown-result role="status"></div>
    <details><summary>冷却算式、来源变量与原始请求</summary>${renderTraceHtml(replay.trace)}<pre>${esc(JSON.stringify(request, null, 2))}</pre></details>
  </article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-cooldown-result]")!;
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement>("[data-source-host-cooldown-input]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请填写有效的冷却公式输入；留空不能当作零。");
      const result = calculateSourceHostCooldownEditable(current);
      output.innerHTML = `<h3>编辑后冷却帧数：${result.value}</h3><p>原捕获值 ${result.originalValue}；差值 ${result.difference} 帧。此结果仅为单个冷却数值步骤。</p><p>角色覆写、冷却队列和动作安排与版本特有提前返回逻辑保持来源回执，不因编辑数字而改变。</p><ul>${result.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${renderTraceHtml(result.trace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.oninput = event => {
    const field = event.target as HTMLInputElement;
    const key = field.dataset.sourceHostCooldownInput;
    if (!key || !(key in current.input) || key === "operation" || key === "action" || key === "actionType") return;
    current.input = { ...current.input, [key]: Number(field.value) } as typeof current.input;
    calculate();
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-cooldown-reset]")) {
      current = createSourceHostCooldownEditable(current.originalCapture);
      renderSourceHostCooldownCalculator(root, current);
      return;
    }
    if (target.closest("[data-source-host-cooldown-export]")) {
      try { calculateSourceHostCooldownEditable(current); downloadSourceHostJson(current, "source-host-cooldown-calculation.json"); }
      catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    }
  };
  root.querySelector<HTMLInputElement>("[data-source-host-cooldown-import]")!.onchange = async event => {
    const field = event.currentTarget as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const version = (value as { schemaVersion?: string }).schemaVersion;
      const restored = version === "source-host-cooldown-calculator-v1"
        ? sourceHostCooldownEditableSchema.parse(value)
        : version === "source-host-cooldown-v1" ? createSourceHostCooldownEditable(sourceHostCooldownCaptureSchema.parse(value))
          : (() => { throw new Error("文件不是来源冷却捕获或独立冷却计算 JSON。"); })();
      renderSourceHostCooldownCalculator(root, restored);
    } catch (error) { output.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`; }
    field.value = "";
  };
  calculate();
}
