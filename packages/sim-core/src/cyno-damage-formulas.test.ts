import { describe, expect, it } from 'vitest';
import { calculatorFormulaSchema, type CalculatorDocument, type CalculatorFormula } from './calculator-model';
import { evaluateFormulaExpression } from './calculation-trace';
import { calcDamage, type DamageCalculationInput } from './formulas';
import { cynoDamageContextSchema } from './cyno-damage-context';
import {
  createCynoA4AdditiveFormula, createCynoBurstEmAdjustment, cynoContext, finalizeCynoDamageContextSnapshot,
  isCynoDamageDocument, prepareCynoDamageDocument, resetCynoPanelAccounting, type CynoCalculatorDocument,
} from './cyno-damage-formulas';
import { cynoDamageMappings } from '../../game-data/src/character-mappings/cyno-damage-mappings';
import { applyCynoDamageContext, createCynoExampleContext } from '../../../apps/web/src/cyno-calculation-context';
import { cynoRequirementAdapter, renderCynoControls, updateCynoDamageControl } from '../../../apps/web/src/calculator-cyno-controls';

function fixture(action = 'normal-1', talent = 10): CynoCalculatorDocument {
  const mapping = cynoDamageMappings.find(row => row.skillId === `cyno-q-${action}-c0`)!;
  return {
    schemaVersion: '1.0.0', ruleVersion: 'ordinary-trace-v1', id: 'cyno-isolated-fixture', label: 'Explicit independent Cyno fixture',
    gameContext: { characterId: 'character:10000071', characterName: '赛诺', abilityId: 'talent:cyno:combat3',
      skillId: mapping.skillId, skillName: mapping.skillLabel!, effectiveTalentLevel: talent, constellation: 0, ascension: 6,
      scopeCoverage: 'single-hit', attributionPolicy: 'One declared own contact',
      cynoDamage: { ...createCynoExampleContext(), emStableFromActionStart: true } },
    scope: 'single-hit', characterLevel: 90,
    build: { mode: 'manual-final', ascension: 6, source: 'Explicit numerical fixture, not a player build',
      stats: { atk: 2000, hp: 20000, def: 800, em: 300, critRate: .5, critDamage: 1 } },
    enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ id: mapping.id, label: mapping.hitLabel, kind: 'ordinary', attackTag: mapping.attackTag!, element: 'electro',
      terms: [{ stat: 'atk', coefficient: 999 }], additiveBaseDamage: 0, damageBonus: 0, critEligible: true,
      reaction: 'none', reactionBonus: 0, groupMultiplier: 1, dependencies: [], sourceRefs: [] }],
    selectedHitIds: [mapping.id], assumptions: [], dependencies: [],
    dataIdentity: { datasetId: 'cyno-independent-fixture', gameVersion: '6.7', releaseStatus: 'released', evidenceStatus: 'provisional' },
  };
}
const evaluate = (formula: CalculatorFormula, em: number) => {
  expect(calculatorFormulaSchema.safeParse(formula).success).toBe(true);
  return evaluateFormulaExpression(formula.expression, { em, ...Object.fromEntries(formula.inputs.map(row => [row.key, row.value])) });
};
const missing = (document: CalculatorDocument) => prepareCynoDamageDocument(document).dependencies.filter(row => row.status === 'missing');

/** These exercise formula trees and preparation without pretending the shared schema is wired yet. */
describe('Cyno C0 Q selected-contact formulas in isolation', () => {
  it.each([
    ['normal-1', 1.547459, 1662.7131], ['normal-2', 1.630198, 1737.1782],
    ['normal-3', 2.068339, 2131.5051], ['normal-4-1', 1.021861, 1189.6749],
    ['normal-4-2', 1.021861, 1189.6749], ['normal-5', 2.586465, 2597.8185],
    ['charged', 1.9975, 1797.75],
  ] as const)('uses Q10 once for %s and computes an independently expected result', (action, coefficient, expected) => {
    const prepared = prepareCynoDamageDocument(fixture(action)), hit = prepared.hits[0]!;
    expect(missing(prepared)).toEqual([]); if (hit.kind !== 'ordinary') throw Error('ordinary');
    expect(hit.terms).toEqual([{ stat: 'atk', coefficient }]);
    const em = 300 + evaluate(hit.elementalMasteryAdjustment!.formula, 300);
    const a4 = evaluate(hit.additiveBaseFormula!, em); expect(a4).toBe(action === 'charged' ? 0 : 600);
    const input: DamageCalculationInput = { scaling: coefficient, scalingStat: 'atk', scalingValue: 2000, flatDamage: a4,
      damageBonus: 0, characterLevel: 90, enemyLevel: 90, effectiveResistance: .1, critRate: .5, critDamage: 1,
      critMode: 'noCrit', reaction: 'none', elementalMastery: em, defenseReduction: 0, defenseIgnore: 0, reactionBonus: 0, groupMultiplier: 1 };
    expect(calcDamage(input).finalDamage).toBeCloseTo(expected, 9);
    expect(calcDamage({ ...input, critMode: 'average' }).finalDamage).toBeCloseTo(expected * 1.5, 9);
    expect(hit.damageBonusFormula).toBeUndefined(); // Endseer does not supply 35% to these attacks.
  });

  it('keeps the seven mappings on Q parameters, including two separate N4 vectors', () => {
    expect(cynoDamageMappings.map(row => row.parameterKey)).toEqual(['param1', 'param2', 'param3', 'param4', 'param5', 'param6', 'param7']);
    expect(cynoDamageMappings.every(row => row.abilityKey === 'combat3' && !row.completeAction)).toBe(true);
    expect(cynoDamageMappings[3]!.sourceCoefficientValues).toEqual(cynoDamageMappings[4]!.sourceCoefficientValues);
    const doc = fixture('normal-1', 13), hit = prepareCynoDamageDocument(doc).hits[0]!;
    if (hit.kind !== 'ordinary') throw Error('ordinary'); expect(hit.terms[0]!.coefficient).toBe(1.875156);
    doc.gameContext.abilityId = 'talent:cyno:combat1'; expect(missing(doc).map(row => row.reason).join()).toContain('独立Q天赋');
  });

  it('adds Q mastery once, including an imported panel that already contains it', () => {
    expect(evaluate(createCynoBurstEmAdjustment(false), 300)).toBe(100);
    expect(evaluate(createCynoBurstEmAdjustment(true), 400)).toBe(0);
    const stable = createCynoA4AdditiveFormula({ unlocked: true, emStableFromActionStart: true, includedA4Base: 0 });
    expect(evaluate(stable, 300 + evaluate(createCynoBurstEmAdjustment(false), 300))).toBe(600);
    expect(evaluate(stable, 400 + evaluate(createCynoBurstEmAdjustment(true), 400))).toBe(600);
    expect(evaluate(createCynoA4AdditiveFormula({ unlocked: true, emStableFromActionStart: true, includedA4Base: 600 }), 400)).toBe(0);
  });

  it('uses action-start EM for A4 when the hit snapshot changes, preserving a real zero', () => {
    const doc = fixture(); Object.assign(cynoContext(doc)!, { emStableFromActionStart: false, actionStartEm: 200 });
    const hit = prepareCynoDamageDocument(doc).hits[0]!; if (hit.kind !== 'ordinary') throw Error('ordinary');
    expect(evaluate(hit.additiveBaseFormula!, 900)).toBe(300);
    cynoContext(doc)!.actionStartEm = 0;
    const zero = prepareCynoDamageDocument(doc).hits[0]!; if (zero.kind !== 'ordinary') throw Error('ordinary');
    expect(evaluate(zero.additiveBaseFormula!, 900)).toBe(0); expect(missing(doc)).toEqual([]);
    delete cynoContext(doc)!.actionStartEm; expect(missing(doc).map(row => row.reason).join()).toContain('实际总精通');
  });

  it('keeps A4 off before ascension4 and on charged attacks without demanding a normal EM sample', () => {
    const locked = fixture(); locked.gameContext.ascension = 3;
    if (locked.build.mode !== 'manual-final') throw Error('manual'); locked.build.ascension = 3;
    delete cynoContext(locked)!.emStableFromActionStart;
    const low = prepareCynoDamageDocument(locked).hits[0]!; if (low.kind !== 'ordinary') throw Error('ordinary');
    expect(evaluate(low.additiveBaseFormula!, 400)).toBe(0); expect(missing(locked)).toEqual([]);
    const charged = fixture('charged'); delete cynoContext(charged)!.emStableFromActionStart;
    const ca = prepareCynoDamageDocument(charged).hits[0]!; if (ca.kind !== 'ordinary') throw Error('ordinary');
    expect(evaluate(ca.additiveBaseFormula!, 400)).toBe(0); expect(missing(charged)).toEqual([]);
  });

  it.each(['burstActive', 'burstEmIncludedInPanel', 'emStableFromActionStart', 'includedA4Base'] as const)('retains unknown %s and links it to a real control', key => {
    const doc = fixture(); if (key === 'includedA4Base' && doc.hits[0]!.kind === 'ordinary') doc.hits[0]!.additiveBaseDamage = 100;
    delete cynoContext(doc)![key]; expect(missing(doc).length).toBeGreaterThan(0);
    expect(cynoRequirementAdapter.collect(doc).some(row => row.fieldPath === `gameContext.cynoDamage.${key}`)).toBe(true);
    expect(renderCynoControls(doc)).toContain(`gameContext.cynoDamage.${key}`);
  });

  it('defaults teaching examples to unknown EM stability and resets imported accounting explicitly', () => {
    expect(createCynoExampleContext().emStableFromActionStart).toBeUndefined();
    const doc = fixture(); resetCynoPanelAccounting(doc, 'imported-final');
    expect(cynoContext(doc)).toEqual({ includedA4Base: 0 }); expect(missing(doc).length).toBeGreaterThan(0);
    resetCynoPanelAccounting(doc, 'fresh-equipment');
    expect(cynoContext(doc)).toEqual({ burstEmIncludedInPanel: false, includedA4Base: 0 });
    Object.assign(cynoContext(doc)!, { burstActive: true, emStableFromActionStart: true }); expect(missing(doc)).toEqual([]);
  });

  it('proves zero included A4 from empty additive input without asking a player for a technical zero', () => {
    const doc = fixture(); delete cynoContext(doc)!.includedA4Base;
    expect(cynoContext(prepareCynoDamageDocument(doc))!.includedA4Base).toBe(0);
    expect(renderCynoControls(doc)).not.toContain('data-field="gameContext.cynoDamage.includedA4Base"');
    expect(cynoRequirementAdapter.collect(doc)).toEqual([]);
    const hit = doc.hits[0]!; if (hit.kind !== 'ordinary') throw Error('ordinary'); hit.additiveBaseDamage = 100;
    expect(missing(doc).map(row => row.reason).join()).toContain('已含多少赛诺A4');
  });

  it('makes preparation idempotent, preserves unrelated blockers, and refuses stale finalized state', () => {
    const doc = fixture(); doc.dependencies.push({ id: 'actual-unresolved-effect', status: 'missing', reason: 'Unresolved source effect', sourceRefs: [] });
    doc.hits[0]!.dependencies.push('actual-unresolved-effect');
    const prepared = prepareCynoDamageDocument(doc); expect(prepareCynoDamageDocument(prepared)).toEqual(prepared);
    expect(missing(prepared).map(row => row.id)).toContain('actual-unresolved-effect');
    const materialized = prepareCynoDamageDocument(fixture()); finalizeCynoDamageContextSnapshot(materialized);
    expect(missing(materialized)).toEqual([]); cynoContext(materialized)!.burstEmIncludedInPanel = true;
    expect(missing(materialized).map(row => row.reason).join()).toContain('旧快照');
  });

  it('rejects unaccounted historical snapshots and changed Q talent levels', () => {
    const doc = fixture(); const hit = doc.hits[0]!; if (hit.kind !== 'ordinary') throw Error('ordinary'); hit.effectiveCritRate = .5;
    expect(missing(doc).map(row => row.reason).join()).toContain('旧快照');
    delete hit.effectiveCritRate; finalizeCynoDamageContextSnapshot(doc); doc.gameContext.effectiveTalentLevel = 9;
    expect(missing(doc).map(row => row.reason).join()).toContain('旧快照');
  });

  it('refuses higher constellations, invented multi-hit totals, and inactive-Q claims', () => {
    const higher = fixture(); higher.gameContext.constellation = 2; expect(missing(higher).map(row => row.reason).join()).toContain('仅审阅C0');
    const grouped = fixture(); grouped.hits.push({ ...grouped.hits[0]!, id: 'invented-next-hit' }); grouped.selectedHitIds.push('invented-next-hit'); grouped.scope = 'one-cast';
    expect(missing(grouped).map(row => row.reason).join()).toContain('一次命中');
    const inactive = fixture(); cynoContext(inactive)!.burstActive = false;
    expect(missing(inactive).map(row => row.reason).join()).toContain('未处于启途誓使');
  });

  it('does not rewrite the existing finite-followup E branch', () => {
    const doc = fixture(); doc.gameContext.skillId = 'finite-followup-cyno-skill-endseer-c0';
    expect(isCynoDamageDocument(doc)).toBe(false); expect(prepareCynoDamageDocument(doc)).toBe(doc);
    expect(renderCynoControls(doc)).toBe(''); resetCynoPanelAccounting(doc, 'imported-final');
    expect(cynoContext(doc)!.burstActive).toBe(true);
  });

  it('validates input edits, distinguishes zero from blank, and never silently clears a frozen identity', () => {
    const doc = fixture(); finalizeCynoDamageContextSnapshot(doc);
    expect(updateCynoDamageControl(doc, 'gameContext.cynoDamage.includedA4Base', '0')).toBe(true);
    expect(cynoContext(doc)!.includedA4Base).toBe(0);
    updateCynoDamageControl(doc, 'gameContext.cynoDamage.actionStartEm', '0'); expect(cynoContext(doc)!.actionStartEm).toBe(0);
    updateCynoDamageControl(doc, 'gameContext.cynoDamage.actionStartEm', ''); expect(cynoContext(doc)!.actionStartEm).toBeUndefined();
    expect(cynoContext(doc)!.finalizedHitStates).toBeDefined();
    expect(() => updateCynoDamageControl(doc, 'gameContext.cynoDamage.actionStartEm', '-1')).toThrow();
    expect(cynoDamageContextSchema.safeParse({ actionStartEm: Number.NaN }).success).toBe(false);
    expect(updateCynoDamageControl(doc, 'gameContext.cynoDamage.finalizedHitStates', '{}')).toBe(false);
    const supplied = { burstActive: true, burstEmIncludedInPanel: true, includedA4Base: 0, emStableFromActionStart: true };
    expect(cynoContext(applyCynoDamageContext(fixture(), supplied))).toEqual(supplied);
  });
});
