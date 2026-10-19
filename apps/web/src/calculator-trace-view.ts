import { calculatorTraceText, executeFormulaExpressionDetailed, type CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import "./calculator.css";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const number = (value: number | undefined): string => value === undefined ? "不适用" : value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const statuses: Record<string, string> = { applied: "已应用", "not-applicable": "不适用", assumed: "条件假定", blocked: "数据阻塞" };
const units: Record<string, string> = { ratio: "倍率 / 比例", damage: "伤害", stat: "面板数值", level: "等级", index: "下标" };
function sourceLinks(refs: readonly string[]): string {
  return `<ul class="calculator-source-list">${[...new Set(refs)].map(ref => `<li>${/^https?:\/\//.test(ref) ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>` : `<code>${esc(ref)}</code>`}</li>`).join("")}</ul>`;
}

/** Report sidecar, reconstructed from the same saved AST and complete inputs. */
export function calculatorTraceExecutionDetails(trace: readonly CalculationTraceNode[]) {
  return trace.filter(node => node.result !== undefined).map(node => ({ nodeId: node.id,
    ...executeFormulaExpressionDetailed(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value]))),
  }));
}

function renderIntermediateSteps(node: CalculationTraceNode, steps: ReturnType<typeof executeFormulaExpressionDetailed>["steps"]): string {
  if (steps.length < 2) return "";
  return `<details class="trace-execution-steps" data-trace-execution="${esc(node.id)}"><summary>逐步运算与中间值（${steps.length} 步）</summary><p>按实际计算顺序展示；变量定义见下方。条件只计算选中的分支，数值保留完整精度。</p><ol>${steps.map(step => {
    const branch = step.condition;
    return `<li><code>${esc(step.symbolicFormula)}</code><br><code>${esc(step.substitution)} = ${esc(step.result)}</code>${branch ? `<p>条件比较：${esc(branch.left)} ${branch.operator === "lt" ? "&lt;" : branch.operator === "lte" ? "≤" : "="} ${esc(branch.right)}，${branch.matched ? "成立" : "不成立"}；执行${branch.selectedBranch === "whenTrue" ? "成立" : "否则"}分支。</p>` : ""}</li>`;
  }).join("")}</ol></details>`;
}

function finalLookupRow(values: unknown, indices: readonly number[]): number[] | undefined {
  if (!Array.isArray(values) || !indices.length) return undefined;
  let selected: unknown = values;
  for (const index of indices.slice(0, -1)) {
    if (!Array.isArray(selected) || !Number.isInteger(index) || index < 0 || index >= selected.length) return undefined;
    selected = selected[index];
  }
  return Array.isArray(selected) && selected.every(value => typeof value === "number" && Number.isFinite(value))
    ? selected as number[] : undefined;
}

function renderLookupDetails(node: CalculationTraceNode, steps: ReturnType<typeof executeFormulaExpressionDetailed>["steps"]): string {
  if (node.expression.kind !== "lookup") return "";
  const lookup = steps.find(step => step.kind === "lookup" && step.path === "$" && step.lookup)?.lookup;
  if (!lookup) return "";
  const selectedIndex = lookup.indices.at(-1);
  const row = finalLookupRow(node.expression.values, lookup.indices);
  const selectedRow = row && selectedIndex !== undefined && selectedIndex >= 0 && selectedIndex < row.length
    ? `<details class="trace-lookup-row"><summary>查看本次查值的末层数值行（${row.length} 项）</summary><div class="table-wrap"><table><thead><tr><th>0 基下标</th><th>表值</th></tr></thead><tbody>${row.map((value, index) => `<tr${index === selectedIndex ? ' data-trace-lookup-selected="' + index + '"' : ""}><td>${index === selectedIndex ? `<mark>${index}（本次选中）</mark>` : index}</td><td>${index === selectedIndex ? `<strong>${number(value)}</strong>` : number(value)}</td></tr>`).join("")}</tbody></table></div></details>`
    : "";
  return `<section data-trace-lookup="${esc(node.id)}"><p>本次实际查值下标（各层均为 0 基）：${lookup.indices.map((index, position) => `${position + 1} 层 ${index}`).join(" → ")}；选中表值：<strong>${number(lookup.selectedValue)}</strong>。</p>${selectedRow}</section>`;
}

/** Shared renderer: arithmetic, substitutions and display values are all supplied by the core. */
export function renderTraceHtml(trace: readonly CalculationTraceNode[]): string {
  if (!trace.length) return "";
  const rows = trace.map(node => {
    const value = node.result;
    const inputs = node.inputs;
    const warnings = node.warnings;
    const execution = value === undefined ? undefined : executeFormulaExpressionDetailed(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value])));
    const title = calculatorTraceText(String(node.titleKey ?? node.ruleId ?? ""));
    const explanation = calculatorTraceText(String(node.explanationKey ?? ""));
    const formula = String(node.symbolicFormula ?? "");
    return `<tr data-trace-node="${esc(node.id)}"><td>${esc(title)}</td><td class="trace-value">${esc(value?.display ?? (value?.value === undefined ? "不适用" : number(value.value)))}</td><td><code>${esc(formula)}</code></td></tr>` +
      `<tr class="trace-detail"><td colspan="3"><details data-detail-id="${esc(node.id)}"><summary>展开：${esc(title)}的计算与解释</summary><div class="trace-detail-content">` +
      `<span class="calculator-badge">${esc(statuses[String(node.status)] ?? node.status)}</span><p>${esc(explanation)}</p>` +
      `<p><strong>符号公式</strong><br><code>${esc(formula)}</code></p>` +
      `<p class="trace-substitution"><strong>实际代入与中间结果</strong><br><code>${esc(node.substitution)}${value ? ` = ${esc(value.display ?? number(value.value))}` : ""}</code></p>` +
      (execution ? renderLookupDetails(node, execution.steps) + renderIntermediateSteps(node, execution.steps) : "") +
      (inputs.length ? `<dl>${inputs.map(input => `<dt>${esc(input.key)}</dt><dd>${esc(calculatorTraceText(input.meaningKey))}<br>数值：${esc(input.value)} ${esc(units[input.unit] ?? input.unit)}；来源：${esc(typeof input.origin === "string" ? input.origin : `${input.origin.kind}${input.origin.reference ? ` · ${input.origin.reference}` : ""}`)}${input.context ? `<br>上下文：${esc(JSON.stringify(input.context))}` : ""}</dd>`).join("")}</dl>` : "") +
      (node.applicabilityReason ? `<p>适用条件：${esc(node.applicabilityReason)}</p>` : "") +
      (warnings.length ? `<p class="calculator-error">${warnings.map(esc).join("；")}</p>` : "") +
      (node.sourceRefs.length ? `<details class="trace-sources"><summary>本步骤来源</summary>${sourceLinks(node.sourceRefs)}</details>` : "") +
      `<p class="calculator-hint">计算规则 ${esc(node.ruleId)} · 完整精度 ${value?.value === undefined ? "无数值结果" : esc(String(value.value))}；后续步骤读取完整精度，页面格式化不会改变计算。</p>` +
      `</div></details></td></tr>`;
  }).join("");
  return `<div class="calculator-trace table-wrap"><table><thead><tr><th>阶段</th><th>数值</th><th>公式</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
