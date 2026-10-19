import type { CalculatorAggregation } from "../../../packages/sim-core/src/calculator-model";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const number = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const percentage = (value: number): string => number(value * 100) + "%";

const scopeLabels: Record<CalculatorAggregation["scope"], string> = {
  "complete-cast": "完整技能",
  "single-hit": "单击",
  "selected-components": "所选组成",
  "declared-hit-set": "教学定义集合",
};
const statusLabels: Record<string, string> = {
  calculated: "已计算",
  blocked: "被阻塞",
  "non-damaging": "非伤害状态",
  excluded: "未计入",
};
const kindLabels: Record<string, string> = {
  ordinary: "普通伤害",
  resolved: "已解析伤害",
  transformative: "剧变反应",
  special: "特殊伤害",
  "non-damaging": "非伤害状态",
  blocked: "未解析组成",
};

function sourceLinks(refs: string[]): string {
  const urls = refs.filter(ref => {
    try { const parsed = new URL(ref); return parsed.protocol === "http:" || parsed.protocol === "https:"; }
    catch { return false; }
  });
  if (!urls.length) return '<span class="calculator-hint">没有可打开的网页来源。</span>';
  return '<ul class="calculator-source-list">' + urls.map(ref =>
    '<li><a href="' + esc(ref) + '" target="_blank" rel="noreferrer">' + esc(ref) + '</a></li>'
  ).join("") + '</ul>';
}

function renderRow(component: CalculatorAggregation["components"][number]): string {
  const hasDamage = component.status === "calculated" && component.damage !== undefined;
  const amountCells = hasDamage
    ? '<td>' + number(component.damage!.nonCritical) + '</td><td>' + number(component.damage!.critical) + '</td><td>' + number(component.damage!.expected) + '</td>'
    : '<td colspan="3" class="calculator-aggregation-unavailable">未提供伤害值</td>';
  const action = component.selected && component.status === "calculated"
    ? '<button type="button" class="calculator-aggregation-component" data-action="cast-open-hit" data-cast-hit-id="' + esc(component.id) + '">' + esc(component.label) + '</button>'
    : '<span>' + esc(component.label) + '</span>';
  const probability = component.triggerProbability === undefined ? "" : " · 触发概率 " + percentage(component.triggerProbability);
  const blockers = component.blockers.length
    ? '<details><summary>阻塞原因（' + component.blockers.length + '）</summary><ul>' + component.blockers.map(reason => '<li>' + esc(reason) + '</li>').join("") + '</ul></details>'
    : "";
  return '<tr data-cast-component="' + esc(component.id) + '" data-component-status="' + esc(component.status) + '">' +
    '<td>' + action + '<small>' + esc(kindLabels[component.kind] ?? component.kind) + ' · ' + (component.selected ? "已选择" : "未选择") + '</small>' +
      '<details><summary>标识与来源</summary><code>' + esc(component.id) + '</code>' +
      '<details><summary>来源（' + component.sourceRefs.length + '）</summary>' + sourceLinks(component.sourceRefs) + '</details></details></td>' +
    '<td><span class="calculator-badge ' + (component.status === "blocked" ? "provisional" : "") + '">' + esc(statusLabels[component.status] ?? component.status) + '</span>' +
      (blockers ? '<div class="calculator-aggregation-row-detail">' + blockers + '</div>' : '') + probability + '</td>' + amountCells + '</tr>';
}

/** Render a compact aggregate; only the first 20 component rows are emitted initially. */
export function renderCalculatorAggregation(aggregation: CalculatorAggregation, visibleCount = 20, options: { nonCriticalComparisonOnly?: boolean } = {}): string {
  const components = aggregation.components;
  const shown = Math.max(1, Math.min(components.length, Math.floor(visibleCount)));
  const damageCount = components.filter(item => item.status === "calculated" && item.damage !== undefined).length;
  const nonDamagingCount = components.filter(item => item.status === "non-damaging").length;
  const blockedCount = components.filter(item => item.status === "blocked").length;
  const excludedCount = components.filter(item => item.status === "excluded" || !item.selected).length;
  const subtotal = aggregation.knownSubtotal;
  const subtotalTitle = aggregation.status === "calculated" && aggregation.scope === "complete-cast" ? "完整技能伤害合计"
    : aggregation.status === "calculated" && aggregation.scope === "single-hit" ? "本击伤害"
    : aggregation.status === "calculated" && aggregation.scope === "declared-hit-set" ? "已声明命中集合合计"
    : "已知小计";
  const subtotalHint = aggregation.status === "blocked" || aggregation.scope === "selected-components"
    ? "这只是当前已知组成的小计，不代表完整总伤。被阻塞、缺失或未选的组成不会以 0 代替。"
    : aggregation.scope === "single-hit" ? "本击数值只覆盖这一击，不代表完整技能或整次施放伤害。"
    : aggregation.scope === "declared-hit-set" ? "此合计只覆盖当前明确声明的命中集合，不推断未声明的角色技能组成。"
    : "当前完整技能范围内的所有已定义组成均已计算。";
  const calculated = aggregation.status === "calculated";
  const singleHit = aggregation.scope === "single-hit";
  const nonCriticalLabel = options.nonCriticalComparisonOnly ? "非暴击教学对照" : singleHit ? "非暴击伤害" : "非暴击合计";
  const criticalLabel = singleHit ? "暴击伤害" : "暴击合计";
  const expectedLabel = singleHit ? "期望伤害" : "期望合计";
  const subtotalMarkup = subtotal === undefined ? "" :
    '<div class="calculator-aggregation-subtotal"><h4>' + subtotalTitle + '</h4><p class="calculator-hint">' + subtotalHint + '</p>' +
    '<div class="calculator-summary"><div class="metric"><div class="label">' + nonCriticalLabel + '</div><div class="value" data-testid="cast-aggregation-noncritical"><span' + (calculated ? ' data-testid="calc-noncritical"' : '') + '>' + number(subtotal.nonCritical) + '</span></div></div>' +
    '<div class="metric"><div class="label">' + criticalLabel + '</div><div class="value" data-testid="cast-aggregation-critical"><span' + (calculated ? ' data-testid="calc-critical"' : '') + '>' + number(subtotal.critical) + '</span></div></div>' +
    '<div class="metric"><div class="label">' + expectedLabel + '</div><div class="value" data-testid="cast-aggregation-expected"><span' + (calculated ? ' data-testid="calc-expected"' : '') + '>' + number(subtotal.expected) + '</span></div></div></div></div>';
  const completeness = aggregation.completenessReasons.length
    ? '<details class="calculator-aggregation-reasons" open><summary>完整性与缺失说明（' + aggregation.completenessReasons.length + '）</summary><ul>' + aggregation.completenessReasons.map(reason => '<li>' + esc(reason) + '</li>').join("") + '</ul></details>'
    : "";
  const omitted = aggregation.omittedHitIds.length
    ? '<details class="calculator-aggregation-omitted"><summary>未列入组成的命中（' + aggregation.omittedHitIds.length + '）</summary><ul>' + aggregation.omittedHitIds.map(id => '<li><code>' + esc(id) + '</code></li>').join("") + '</ul></details>'
    : "";
  const blocked = aggregation.status === "blocked"
    ? '<div class="calculator-status blocked" role="status"><strong>当前结果受阻</strong><p>当前不会把缺少或被阻塞的组成当作零伤害；下方只呈现明确提供的已知小计。</p></div>'
    : "";
  const more = components.length > shown
    ? '<button type="button" data-cast-load-more data-next-count="' + Math.min(shown + 20, components.length) + '">再显示 20 项（剩余 ' + (components.length - shown) + ' 项）</button>'
    : "";
  return '<section class="calculator-aggregation" data-cast-aggregation data-aggregation-scope="' + esc(aggregation.scope) + '" data-aggregation-status="' + esc(aggregation.status) + '">' +
    '<header><h3>技能伤害组成</h3><span class="calculator-badge" data-testid="cast-aggregation-scope">' + esc(scopeLabels[aggregation.scope]) + '</span><span class="calculator-badge ' + (aggregation.status === "blocked" ? "provisional" : "") + '">' + esc(statusLabels[aggregation.status]) + '</span></header>' +
    '<p class="calculator-hint">归属政策：' + esc(aggregation.attributionPolicy) + '</p>' + blocked +
    '<div class="calculator-aggregation-counts" aria-label="组成统计"><span>有伤害值 ' + damageCount + '</span><span>非伤害状态 ' + nonDamagingCount + '</span><span>被阻塞 ' + blockedCount + '</span><span>未选／排除 ' + excludedCount + '</span><span>未列入 ' + aggregation.omittedHitIds.length + '</span></div>' +
    subtotalMarkup + completeness +
    '<details class="calculator-aggregation-components" open><summary>组成明细（' + components.length + '）</summary><div class="table-wrap"><table><thead><tr><th>组成</th><th>状态</th><th>非暴击</th><th>暴击</th><th>期望</th></tr></thead><tbody>' +
    components.slice(0, shown).map(renderRow).join("") + '</tbody></table></div>' + more + omitted + '</details></section>';
}

/** Mount a paged view; cast-open-hit buttons bubble for the calculator's existing delegated handler. */
export function mountCalculatorAggregation(root: HTMLElement, aggregation: CalculatorAggregation, options: { nonCriticalComparisonOnly?: boolean } = {}): void {
  let visibleCount = 20;
  const render = (): void => { root.innerHTML = renderCalculatorAggregation(aggregation, visibleCount, options); };
  root.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const more = target.closest<HTMLButtonElement>("[data-cast-load-more]");
    if (!more) return;
    visibleCount = Math.min(aggregation.components.length, Math.max(visibleCount + 20, Number(more.dataset.nextCount) || 0));
    render();
  });
  render();
}
