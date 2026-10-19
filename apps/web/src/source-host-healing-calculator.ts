import {
  calculateSourceHostHealingEditable, createSourceHostHealingEditable,
  replaySourceHostHealing, sourceHostHealingCaptureSchema, sourceHostHealingEditableSchema,
  type SourceHostHealingCapture, type SourceHostHealingEditable,
} from "../../../packages/sim-core/src/source-host-healing-capture";
import type { SourceHostHealingInput } from "../../../packages/sim-core/src/source-host-healing-formula";
import { sourceHostHealingSourceRuleDescriptor } from "../../../packages/sim-core/src/source-host-healing-source-formula";
import type { CalculationTraceNode } from "../../../packages/sim-core/src/calculation-trace";
import { renderTraceHtml } from "./calculator-trace-view";
import { downloadSourceHostJson } from "./source-host-calculator";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const numberField = (stage: string, key: string, label: string, value: number, readonly = false): string =>
  `<label>${label}<input type="number" step="any" required data-source-host-healing-stage="${stage}" data-source-host-healing-field="${key}" value="${value}"${readonly ? " readonly" : ""}></label>`;
const linkedSourceNote = (links: Record<string, number> | undefined): string => links && Object.keys(links).length
  ? `其中 ${Object.entries(links).map(([key, id]) => `${esc(key)} ← #${id}`).join("；")}，须编辑上游实际状态叶。` : "";
const sourceValue = (trace: readonly CalculationTraceNode[], id: number, ruleId: string): number | undefined =>
  trace.find(node => node.id === `healingEdit.source.${id}.${ruleId}`)?.result?.value;

/** Edit captured scalar stages of one source healing event without changing its strategy or source state. */
export function renderSourceHostHealingCalculator(root: HTMLElement, input: SourceHostHealingCapture | SourceHostHealingEditable): void {
  let current = input.schemaVersion === "source-host-healing-calculator-v1"
    ? sourceHostHealingEditableSchema.parse(input) : createSourceHostHealingEditable(input);
  const replay = replaySourceHostHealing(current.originalCapture);
  const app = current.originalCapture.application;
  const capturedStages = [...current.originalCapture.components, current.originalCapture.calculation];
  const sourceRows = current.originalCapture.sources ?? [];
  const baseSourceId = current.originalCapture.components[0]?.request.componentIds[0];
  const bonusSourceId = current.originalCapture.components[1]?.request.componentIds[0];
  const sourceFields = sourceRows.map(row => {
    if (row.request.input.operation !== "source") return "";
    const sourceInput = row.request.input;
    const descriptor = sourceHostHealingSourceRuleDescriptor(sourceInput.ruleId);
    const edited = current.sourceInputs?.find(candidate => candidate.id === row.request.id);
    const fields = Object.entries(descriptor.inputs).map(([key, parameter]) => {
      const value = edited?.input.state[key] ?? sourceInput.state[key];
      const linked = row.request.valueSources?.[key];
      const label = `${esc(parameter.label)}（${esc(parameter.unit)}）${linked === undefined ? "" : ` · 由上游 #${linked} 联动`}`;
      if (parameter.choices?.length && linked === undefined)
        return `<label>${label}<select required data-source-host-healing-source-id="${row.request.id}" data-source-host-healing-source-key="${esc(key)}">${parameter.choices.map(choice => `<option value="${choice.value}"${choice.value === value ? " selected" : ""}>${esc(choice.label)} · ${choice.value}</option>`).join("")}</select></label>`;
      return `<label>${label}<input type="number" step="${parameter.integer ? "1" : "any"}" required${parameter.minimum === undefined ? "" : ` min="${parameter.minimum}"`}${parameter.maximum === undefined ? "" : ` max="${parameter.maximum}"`} data-source-host-healing-source-id="${row.request.id}" data-source-host-healing-source-key="${esc(key)}" value="${value}"${linked === undefined ? "" : " readonly"}></label>`;
    }).join("");
    return `<fieldset data-source-host-healing-source="${row.request.id}"><legend>${esc(descriptor.title)} · #${row.request.id}</legend><p>来源原值 ${num(row.value)} ${esc(descriptor.resultUnit)}；规则 <code>${esc(sourceInput.ruleId)}</code>；来源持有者 #${sourceInput.sourceHolderIndex}。${linkedSourceNote(row.request.valueSources)}</p><div class="calculator-fields">${fields || "<p>本条来源没有可编辑状态叶。</p>"}</div><p data-source-host-healing-source-output="${row.request.id}"></p></fieldset>`;
  }).join("");
  const base = current.baseInput;
  const bonus = current.bonusInput;
  const receive = current.receiveInput;
  const conversion = current.conversionInput;
  const delegation = capturedStages.find(row => row.request.input.operation === "receive-delegation");
  const overheal = current.overhealInput;
  const baseFields = base.operation === "base" ? base.healType === "absolute"
    ? numberField("base", "sourceAmount", baseSourceId === undefined ? "来源绝对治疗量" : "来源绝对治疗量（原回执；由上方源公式联动）", base.sourceAmount, baseSourceId !== undefined)
    : base.healType === "percent"
      ? numberField("base", "sourceAmount", baseSourceId === undefined ? "来源治疗比例" : "来源治疗比例（原回执；由上方源公式联动）", base.sourceAmount, baseSourceId !== undefined) + numberField("base", "maxHpForBase", "基础量读取时生命上限", base.maxHpForBase)
      : `<p>来源治疗类型 ${base.originalHealType} 未识别；此分支基础量为 0，不读取生命上限。</p>${numberField("base", "sourceAmount", "未识别的来源值（只读）", base.sourceAmount, true)}`
    : "";
  const bonusFields = bonus.operation === "bonus"
    ? numberField("bonus", "healBonus", "来源 HealBonus() 返回值", bonus.healBonus) + numberField("bonus", "infoBonus", bonusSourceId === undefined ? "本次 HealInfo.Bonus" : "本次 HealInfo.Bonus（原回执；由上方源公式联动）", bonus.infoBonus, bonusSourceId !== undefined) : "";
  const receiveFields = receive?.operation === "receive"
    ? (delegation?.request.input.operation === "receive-delegation"
      ? `<p>${delegation.request.input.branch === "arlecchino-own-burst" ? "阿蕾奇诺自身 Balemoon Rising 治疗" : delegation.request.input.branch === "clorinde-outside-skill" ? "克洛琳德技能状态外治疗" : "克洛琳德自身 Impale the Night 治疗"}：来源委托模板接收治疗。</p>` : "")
      + numberField("receive", "finalAmount", "原始治疗量（由基础量与加成自动传入）", receive.finalAmount, true) + numberField("receive", "debtAtReceive", "治疗接收时再次读取的生命之契债务", receive.debtAtReceive)
    : receive?.operation === "receive-override"
      ? `<p>${receive.branch === "arlecchino-rejected" ? "阿蕾奇诺：本次治疗未满足自身 Balemoon Rising 门，来源返回 0。" : "克洛琳德：技能状态中本次非命名自疗转入生命之契，来源返回 0。"}</p>`
        + numberField("receive", "finalAmount", "原始治疗量（自动传入）", receive.finalAmount, true)
        + (conversion?.operation === "receive-conversion"
          ? numberField("conversion", "ascension", "克洛琳德突破等级（转换系数：四阶前 0.8，四阶起 1）", conversion.ascension)
            + numberField("conversion", "finalAmount", "转生命之契前治疗量（自动传入）", conversion.finalAmount, true)
          : "")
    : `<p>没有对应来源治疗接收阶段的数值记录；独立计算器保留来源角色策略。改变上游治疗量时若无法推断策略返回值，会明确阻塞联动。</p>`;
  const overhealFields = overheal.operation === "overheal"
    ? numberField("overheal", "previousHp", "Heal 前保存的 HP", overheal.previousHp)
      + numberField("overheal", "receivedAmount", "实际收到治疗（由前置阶段传入）", overheal.receivedAmount, true)
      + numberField("overheal", "maxHpForOverheal", "接收治疗后另行读取的生命上限", overheal.maxHpForOverheal)
    : "";
  root.innerHTML = `<article class="card" data-source-host-healing-calculator><h2>来源治疗事件 · 独立计算</h2><p>${esc(current.label)}</p>
    <p>第 ${app.frame} 帧 · 治疗者 ${esc(app.actorKey)} · ${esc(app.source)} · 目标索引 ${app.targetIndex}。执行器 SHA-256：<code>${esc(current.originalCapture.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p>
    <p>来源原始治疗 ${num(replay.originalAmount)}；完整共享公式重放 ${num(replay.reproducedAmount)}；生命之契抵扣后 ${num(replay.originalReceived)}；过量治疗 ${num(replay.originalOverheal)}。治疗公式按捕获的调用阶段重算；HP、债务更新、角色策略与事件仍由固定来源执行器处理。</p>
    <p>来源记录 HP/债务：HP ${num(app.previousHp)} → ${num(app.currentHp)}；先前债务日志 ${num(app.previousHpDebt)}；当前债务 ${num(app.currentHpDebt)}。治疗接收阶段的债务读取可能来自另一次状态读取，保持独立记录。</p>
    ${sourceRows.length ? `<section data-source-host-healing-sources><h3>本次 HealInfo.Src／Bonus 来源公式（${sourceRows.length} 条）</h3><p>按原生生产顺序编辑实际状态叶；相互依赖的数值从上游公式自动传递。字段下方原回执保持不变，编辑结果只重算这一次治疗链。</p>${sourceFields}</section>` : `<p class="calculator-hint" data-source-host-healing-source-gap>此捕获没有 HealInfo 源金额公式；旧记录仍可按已保存的基础量与加成阶段重放。</p>`}
    <fieldset><legend>基础治疗</legend>${baseFields}</fieldset><fieldset><legend>治疗加成</legend>${bonusFields}</fieldset>
    <fieldset><legend>接收与生命之契</legend>${receiveFields}</fieldset><fieldset><legend>过量治疗与上限</legend>${overhealFields}</fieldset>
    <div class="editor-actions"><button type="button" data-source-host-healing-reset>恢复捕获值</button><button type="button" data-source-host-healing-export>导出独立治疗计算 JSON</button><label class="file-button">导入独立治疗计算 JSON<input type="file" accept="application/json,.json" data-source-host-healing-import></label></div>
    <div data-source-host-healing-result role="status"></div><details><summary>原始来源治疗算式、阶段回执与变量代入</summary>${renderTraceHtml(replay.trace)}<pre>${esc(JSON.stringify({ application: app, sources: sourceRows.map(row => row.request), stages: capturedStages.map(row => row.request), supportingCalculations: current.originalCapture.supportingCalculations }, null, 2))}</pre></details>
  </article>`;
  const output = root.querySelector<HTMLElement>("[data-source-host-healing-result]")!;
  const calculate = (): void => {
    try {
      if ([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-source-host-healing-field], [data-source-host-healing-source-key]")].some(field => !field.value.trim() || !field.checkValidity())) throw new Error("请填写有效治疗公式输入；留空不能当作零。");
      const result = calculateSourceHostHealingEditable(current);
      for (const source of sourceRows) {
        if (source.request.input.operation !== "source") continue;
        const target = root.querySelector<HTMLElement>(`[data-source-host-healing-source-output="${source.request.id}"]`);
        const descriptor = sourceHostHealingSourceRuleDescriptor(source.request.input.ruleId);
        const value = sourceValue(result.trace, source.request.id, source.request.input.ruleId);
        if (target) target.textContent = value === undefined ? "本次源数值未能重算。" : `来源原值 ${num(source.value)} → 编辑后 ${num(value)} ${descriptor.resultUnit}；差值 ${num(value - source.value)}。`;
      }
      const linkedAmount = root.querySelector<HTMLInputElement>("[data-source-host-healing-stage='receive'][data-source-host-healing-field='finalAmount']");
      if (linkedAmount) linkedAmount.value = String(result.editedAmount);
      const linkedConversion = root.querySelector<HTMLInputElement>("[data-source-host-healing-stage='conversion'][data-source-host-healing-field='finalAmount']");
      if (linkedConversion) linkedConversion.value = String(result.editedAmount);
      if (result.status === "blocked") {
        output.innerHTML = `<h3>治疗联动受阻</h3><p>${esc(result.reason)}</p><p>原始治疗 ${num(result.originalAmount)}；本次独立基础与加成公式值 ${num(result.editedAmount)}。没有推断未捕获的角色策略返回值。</p>${renderTraceHtml(result.trace)}<ul>${result.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>`;
        return;
      }
      const linkedReceived = root.querySelector<HTMLInputElement>("[data-source-host-healing-stage='overheal'][data-source-host-healing-field='receivedAmount']");
      if (linkedReceived) linkedReceived.value = String(result.editedReceived);
      output.innerHTML = `<h3>编辑后过量治疗：${num(result.editedOverheal)}</h3><p>原始治疗 ${num(result.originalAmount)} → ${num(result.editedAmount)}；接收治疗 ${num(result.originalReceived)} → ${num(result.editedReceived)}；过量治疗差值 ${num(result.difference)}。这只重算保存的数值阶段。</p>${result.editedConverted === undefined ? "" : `<p>克洛琳德治疗转生命之契 ${num(result.originalConverted ?? 0)} → ${num(result.editedConverted)}；仅重算数值，未再次写入角色状态。</p>`}<p>HP/生命之契策略及治疗事件不随数值编辑重新执行。</p><ul>${result.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul>${renderTraceHtml(result.trace)}`;
    } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.oninput = event => {
    const field = event.target as HTMLInputElement;
    const sourceId = field.dataset.sourceHostHealingSourceId;
    const sourceKey = field.dataset.sourceHostHealingSourceKey;
    if (sourceId !== undefined && sourceKey !== undefined) {
      if (field.readOnly) return;
      const source = current.sourceInputs?.find(candidate => candidate.id === Number(sourceId));
      if (!source || !(sourceKey in source.input.state)) return;
      source.input = { ...source.input, state: { ...source.input.state, [sourceKey]: Number(field.value) } };
      calculate(); return;
    }
    const stage = field.dataset.sourceHostHealingStage;
    const key = field.dataset.sourceHostHealingField;
    if (!stage || !key || field.readOnly) return;
    const value = Number(field.value);
    if (stage === "base" && current.baseInput.operation === "base" && key in current.baseInput) current.baseInput = { ...current.baseInput, [key]: value } as typeof current.baseInput;
    if (stage === "bonus" && current.bonusInput.operation === "bonus" && key in current.bonusInput) current.bonusInput = { ...current.bonusInput, [key]: value } as typeof current.bonusInput;
    if (stage === "receive" && current.receiveInput?.operation === "receive" && key === "debtAtReceive") current.receiveInput = { ...current.receiveInput, debtAtReceive: value };
    if (stage === "conversion" && current.conversionInput?.operation === "receive-conversion" && key === "ascension")
      current.conversionInput = { ...current.conversionInput, ascension: value };
    if (stage === "overheal" && current.overhealInput.operation === "overheal" && key !== "receivedAmount" && key in current.overhealInput) current.overhealInput = { ...current.overhealInput, [key]: value } as typeof current.overhealInput;
    calculate();
  };
  root.onchange = event => {
    const field = event.target as HTMLSelectElement;
    if (!field.matches("select[data-source-host-healing-source-key]")) return;
    const source = current.sourceInputs?.find(candidate => candidate.id === Number(field.dataset.sourceHostHealingSourceId));
    const key = field.dataset.sourceHostHealingSourceKey;
    if (!source || !key || !(key in source.input.state)) return;
    source.input = { ...source.input, state: { ...source.input.state, [key]: Number(field.value) } };
    calculate();
  };
  root.onclick = event => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-source-host-healing-reset]")) {
      current = createSourceHostHealingEditable(current.originalCapture);
      renderSourceHostHealingCalculator(root, current); return;
    }
    if (target.closest("[data-source-host-healing-export]")) {
      try { calculateSourceHostHealingEditable(current); downloadSourceHostJson(current, "source-host-healing-calculation.json"); }
      catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    }
  };
  root.querySelector<HTMLInputElement>("[data-source-host-healing-import]")!.onchange = async event => {
    const field = event.currentTarget as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const version = (value as { schemaVersion?: string }).schemaVersion;
      const restored = version === "source-host-healing-calculator-v1"
        ? sourceHostHealingEditableSchema.parse(value)
        : version === "source-host-healing-v1" ? createSourceHostHealingEditable(sourceHostHealingCaptureSchema.parse(value))
          : (() => { throw new Error("文件不是来源治疗捕获或独立治疗计算 JSON。"); })();
      renderSourceHostHealingCalculator(root, restored);
    } catch (error) { output.textContent = `导入失败：${error instanceof Error ? error.message : String(error)}`; }
    field.value = "";
  };
  calculate();
}
