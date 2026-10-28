import type { CalculatorAggregation } from "../../../packages/sim-core/src/calculator-model";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const number = (value: number): string => value.toLocaleString("en-US", { maximumFractionDigits: 6 });
const percentage = (value: number): string => number(value * 100) + "%";

const scopeLabels: Record<CalculatorAggregation["scope"], string> = {
  "complete-cast": "Complete cast",
  "single-hit": "Single hit",
  "selected-components": "Selected components",
  "declared-hit-set": "Declared hit set",
};
const statusLabels: Record<string, string> = {
  calculated: "Calculated",
  blocked: "Blocked",
  "non-damaging": "Non-damaging",
  excluded: "Excluded",
};
const kindLabels: Record<string, string> = {
  ordinary: "Ordinary damage",
  resolved: "Resolved damage",
  transformative: "Transformative reaction",
  special: "Special damage",
  "non-damaging": "Non-damaging",
  blocked: "Unresolved component",
};

function sourceLinks(refs: string[]): string {
  const urls = refs.filter(ref => {
    try { const parsed = new URL(ref); return parsed.protocol === "http:" || parsed.protocol === "https:"; }
    catch { return false; }
  });
  if (!urls.length) return '<span class="calculator-hint">No web source available.</span>';
  return '<ul class="calculator-source-list">' + urls.map(ref =>
    '<li><a href="' + esc(ref) + '" target="_blank" rel="noreferrer">' + esc(ref) + '</a></li>'
  ).join("") + '</ul>';
}

function renderRow(component: CalculatorAggregation["components"][number]): string {
  const hasDamage = component.status === "calculated" && component.damage !== undefined;
  const amountCells = hasDamage
    ? '<td>' + number(component.damage!.nonCritical) + '</td><td>' + number(component.damage!.critical) + '</td><td>' + number(component.damage!.expected) + '</td>'
    : '<td colspan="3" class="calculator-aggregation-unavailable">Damage unavailable</td>';
  const action = component.selected && component.status === "calculated"
    ? '<button type="button" class="calculator-aggregation-component" data-action="cast-open-hit" data-cast-hit-id="' + esc(component.id) + '">' + esc(component.label) + '</button>'
    : '<span>' + esc(component.label) + '</span>';
  const probability = component.triggerProbability === undefined ? "" : " · Trigger probability " + percentage(component.triggerProbability);
  const blockers = component.blockers.length
    ? '<details><summary>Missing requirements（' + component.blockers.length + '）</summary><ul>' + component.blockers.map(reason => '<li>' + esc(reason) + '</li>').join("") + '</ul></details>'
    : "";
  return '<tr data-cast-component="' + esc(component.id) + '" data-component-status="' + esc(component.status) + '">' +
    '<td>' + action + '<small>' + esc(kindLabels[component.kind] ?? component.kind) + ' · ' + (component.selected ? "Selected" : "Not selected") + '</small>' +
      '<details><summary>Identity & sources</summary><code>' + esc(component.id) + '</code>' +
      '<details><summary>Sources（' + component.sourceRefs.length + '）</summary>' + sourceLinks(component.sourceRefs) + '</details></details></td>' +
    '<td><span class="calculator-badge ' + (component.status === "blocked" ? "provisional" : "") + '">' + esc(statusLabels[component.status] ?? component.status) + '</span>' +
      (blockers ? '<div class="calculator-aggregation-row-detail">' + blockers + '</div>' : '') + probability + '</td>' + amountCells + '</tr>';
}

/** Render a compact aggregate; only the first 20 component rows are emitted initially. */
export function renderCalculatorAggregation(aggregation: CalculatorAggregation, visibleCount = 20, options: { nonCriticalComparisonOnly?: boolean; playerView?: boolean } = {}): string {
  const components = aggregation.components;
  const shown = Math.max(1, Math.min(components.length, Math.floor(visibleCount)));
  const damageCount = components.filter(item => item.status === "calculated" && item.damage !== undefined).length;
  const nonDamagingCount = components.filter(item => item.status === "non-damaging").length;
  const blockedCount = components.filter(item => item.status === "blocked").length;
  const excludedCount = components.filter(item => item.status === "excluded" || !item.selected).length;
  const subtotal = aggregation.knownSubtotal;
  const partial = aggregation.status === "blocked" || aggregation.scope === "selected-components";
  const scopeLabel = scopeLabels[aggregation.scope] + (partial ? " · subtotal" : "");
  const selectedDamageCount = components.filter(item => item.selected && item.status === "calculated" && item.damage !== undefined).length;
  const selectedBlockedCount = components.filter(item => item.selected && item.status === "blocked").length;
  const summarySentence = `${partial ? "Subtotal" : "Damage"} for ${selectedDamageCount} calculated component${selectedDamageCount === 1 ? "" : "s"}${selectedBlockedCount ? `; ${selectedBlockedCount} ${selectedBlockedCount === 1 ? "requires" : "require"} inputs or support` : ""}.`;
  const calculated = aggregation.status === "calculated";
  const singleHit = aggregation.scope === "single-hit";
  const nonCriticalLabel = options.nonCriticalComparisonOnly ? "Non-critical comparison only" : partial ? "Non-critical subtotal" : singleHit ? "Non-critical damage" : "Non-critical total";
  const criticalLabel = partial ? "Critical subtotal" : singleHit ? "Critical damage" : "Critical total";
  const expectedLabel = partial ? "Expected subtotal" : singleHit ? "Expected damage" : "Expected total";
  const subtotalMarkup = subtotal === undefined ? "" :
    '<div class="calculator-aggregation-subtotal">' +
    '<div class="calculator-summary"><div class="metric player-expected-metric"><div class="label">' + expectedLabel + '</div><div class="value" data-testid="cast-aggregation-expected"><span' + (calculated ? ' data-testid="calc-expected"' : '') + '>' + number(subtotal.expected) + '</span></div></div>' +
    '<div class="metric"><div class="label">' + nonCriticalLabel + '</div><div class="value" data-testid="cast-aggregation-noncritical"><span' + (calculated ? ' data-testid="calc-noncritical"' : '') + '>' + number(subtotal.nonCritical) + '</span></div></div>' +
    '<div class="metric"><div class="label">' + criticalLabel + '</div><div class="value" data-testid="cast-aggregation-critical"><span' + (calculated ? ' data-testid="calc-critical"' : '') + '>' + number(subtotal.critical) + '</span></div></div></div></div>';
  const completeness = aggregation.completenessReasons.length
    ? '<details class="calculator-aggregation-reasons"><summary>Coverage & missing inputs（' + aggregation.completenessReasons.length + '）</summary><ul>' + aggregation.completenessReasons.map(reason => '<li>' + esc(reason) + '</li>').join("") + '</ul></details>'
    : "";
  const omitted = aggregation.omittedHitIds.length
    ? '<details class="calculator-aggregation-omitted"><summary>Omitted hits（' + aggregation.omittedHitIds.length + '）</summary><ul>' + aggregation.omittedHitIds.map(id => '<li><code>' + esc(id) + '</code></li>').join("") + '</ul></details>'
    : "";
  const more = components.length > shown
    ? '<button type="button" data-cast-load-more data-next-count="' + Math.min(shown + 20, components.length) + '">Show 20 more (remaining: ' + (components.length - shown) + ')</button>'
    : "";
  const counts = '<div class="calculator-aggregation-counts" aria-label="Component counts"><span>With damage: ' + damageCount + '</span><span>Non-damaging ' + nonDamagingCount + '</span><span>Blocked ' + blockedCount + '</span><span>Unselected / excluded: ' + excludedCount + '</span><span>Omitted: ' + aggregation.omittedHitIds.length + '</span></div>';
  return '<section class="calculator-aggregation" data-cast-aggregation data-aggregation-scope="' + esc(aggregation.scope) + '" data-aggregation-status="' + esc(aggregation.status) + '">' +
    '<header><h3>Damage summary</h3><span class="calculator-badge" data-testid="cast-aggregation-scope">' + esc(scopeLabel) + '</span><span class="calculator-badge ' + (aggregation.status === "blocked" ? "provisional" : "") + '">' + esc(statusLabels[aggregation.status]) + '</span></header>' +
    (options.playerView ? '' : '<p class="calculator-hint">Attribution: ' + esc(aggregation.attributionPolicy) + '</p>') + '<p class="calculator-hint" data-player-damage-coverage>' + summarySentence + '</p>' +
    (options.playerView ? '' : counts) +
    subtotalMarkup + completeness +
    '<details class="calculator-aggregation-components"' + (options.playerView ? '' : ' open') + '><summary>Component details（' + components.length + '）</summary>' + (options.playerView ? '<p class="calculator-hint">Attribution: ' + esc(aggregation.attributionPolicy) + '</p>' + counts : '') + '<div class="table-wrap"><table><thead><tr><th>Component</th><th>Status</th><th>Non-critical</th><th>Critical</th><th>Expected</th></tr></thead><tbody>' +
    components.slice(0, shown).map(renderRow).join("") + '</tbody></table></div>' + more + omitted + '</details></section>';
}

/** Mount a paged view; cast-open-hit buttons bubble for the calculator's existing delegated handler. */
export function mountCalculatorAggregation(root: HTMLElement, aggregation: CalculatorAggregation, options: { nonCriticalComparisonOnly?: boolean; playerView?: boolean } = {}): void {
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
