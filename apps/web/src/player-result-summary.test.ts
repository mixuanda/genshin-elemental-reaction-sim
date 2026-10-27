import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CalculatorAggregation } from '../../../packages/sim-core/src/calculator-model';
import { renderCalculatorAggregation } from './calculator-aggregation-view';
import { renderSkillTimingNotice } from './player-result-summary';

const fixture = (overrides: Partial<CalculatorAggregation> = {}): CalculatorAggregation => ({
  version: 'calculator-aggregation-v1', scope: 'complete-cast', status: 'calculated',
  attributionPolicy: 'Synthetic fixture, selected actor only',
  components: [{ id: 'hit', label: 'Synthetic hit', selected: true, kind: 'ordinary', status: 'calculated', sourceRefs: [], blockers: [], damage: { expected: 150, nonCritical: 100, critical: 200 } }],
  knownSubtotal: { expected: 150, nonCritical: 100, critical: 200 }, omittedHitIds: [], completenessReasons: [], ...overrides,
});
const render = (input: CalculatorAggregation) => renderCalculatorAggregation(input, 20, { playerView: true });

describe('player-first skill summary', () => {
  it('leads with actual expected damage and keeps component details collapsed', () => {
    const html = render(fixture());
    expect(html.indexOf('cast-aggregation-expected')).toBeLessThan(html.indexOf('cast-aggregation-noncritical'));
    expect(html).toContain('data-testid="calc-expected">150</span>');
    expect(html).toContain('<details class="calculator-aggregation-components">');
    expect(html).toContain('Complete cast');
  });
  it('labels partial results as subtotals rather than complete damage', () => {
    const html = render(fixture({ status: 'blocked', scope: 'selected-components', completenessReasons: ['Synthetic missing condition'] }));
    expect(html).toContain('Selected components · subtotal');
    expect(html).toContain('Subtotal for 1 calculated component.');
    expect(html).not.toContain('Result incomplete');
    expect(html).toContain('Synthetic missing condition');
    expect(html).not.toContain('data-testid="calc-expected"');
  });
  it('counts selected components and retains exact support reasons once in coverage details', () => {
    const base = fixture();
    const html = render(fixture({ status: 'blocked', scope: 'selected-components', components: [
      ...base.components,
      { ...base.components[0]!, id: 'unselected', selected: false },
      { id: 'needs-input', label: 'Pending action', selected: true, kind: 'blocked', status: 'blocked', sourceRefs: [], blockers: ['Needs supported action data'] },
    ], completenessReasons: ['Exact scope limitation'] }));
    expect(html).toContain('Subtotal for 1 calculated component; 1 requires inputs or support.');
    expect(html).toContain('Expected subtotal');
    expect(html).not.toContain('Expected total');
    expect(html.match(/data-player-damage-coverage/g)).toHaveLength(1);
    expect(html.match(/Exact scope limitation/g)).toHaveLength(1);
    expect(html).toContain('Needs supported action data');
  });
  it('does not manufacture zero damage when a result is unavailable', () => {
    const input = fixture({ status: 'blocked', components: [{ id: 'missing', label: 'Unknown', selected: true, kind: 'blocked', status: 'blocked', sourceRefs: [], blockers: ['Missing input'] }] });
    delete input.knownSubtotal;
    const html = render(input);
    expect(html).toContain('Damage unavailable');
    expect(html).not.toContain('cast-aggregation-expected');
  });
  it('keeps single-hit and declared-set scope distinct from full cast', () => {
    expect(render(fixture({ scope: 'single-hit' }))).toContain('Single hit');
    expect(render(fixture({ scope: 'declared-hit-set' }))).toContain('Declared hit set');
  });
  it('escapes component labels and blockers', () => {
    const html = render(fixture({ components: [{ id: 'x', label: '<script>bad</script>', selected: true, kind: 'blocked', status: 'blocked', sourceRefs: [], blockers: ['<img src=x>'] }] }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x&gt;');
  });
  it('explicitly withholds DPS and curves without a timed record', () => {
    expect(renderSkillTimingNotice()).toContain('data-dps-status="unavailable"');
    expect(renderSkillTimingNotice()).toContain('data-curve-status="unavailable"');
    expect(renderSkillTimingNotice()).toContain('data-skill-timing-unavailable');
    expect(renderSkillTimingNotice()).toContain('run a timed team simulation');
    expect(renderSkillTimingNotice()).toContain('href="/source-simulation"');
  });
  it('sets only the UI talent default to 9 and discloses manual reference stats', () => {
    const ui = readFileSync(new URL('./calculator-ui.ts', import.meta.url), 'utf8');
    expect(ui).toMatch(/id="calc-talent-level"[^>]+value="9"/);
    expect(ui).toContain('data-manual-build-notice');
    expect(ui).toContain('Edit these reference stats and the target scenario to match your build.');
    const coreAdapter = readFileSync(new URL('./character-calculations.ts', import.meta.url), 'utf8');
    expect(coreAdapter).toContain('talentLevel = 10');
    expect(coreAdapter).toContain('characterLevel: 90');
  });
});
