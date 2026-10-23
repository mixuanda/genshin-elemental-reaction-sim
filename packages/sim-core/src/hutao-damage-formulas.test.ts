import { describe, expect, it } from 'vitest';
import { calculateDocument, convertCalculatorToFinalPanel } from './calculator';
import { calculatorFormulaSchema, type CalculatorDocument } from './calculator-model';
import { evaluateFormulaExpression, expr } from './calculation-trace';
import { hutaoDamageContextSchema } from './hutao-damage-context';
import {
  createHutaoA4BonusFormula, createHutaoSkillAttackFormula, finalizeHutaoDamageContextSnapshot,
  hutaoContext, isHutaoPrimaryDocument, prepareHutaoDamageDocument, resetHutaoPanelAccounting, type HutaoCalculatorDocument,
} from './hutao-damage-formulas';
import { hutaoPrimaryMappings } from '../../game-data/src/character-mappings/hutao-primary-mappings';
import { applyHutaoDamageContext, createHutaoExampleContext } from '../../../apps/web/src/hutao-calculation-context';
import { hutaoRequirementAdapter, renderHutaoControls, updateHutaoDamageControl } from '../../../apps/web/src/calculator-hutao-controls';

function fixture(action = 'charged', normalLevel = 10): HutaoCalculatorDocument {
  const mapping = hutaoPrimaryMappings.find(row => row.skillId === `hutao-paramita-${action}-c0-c1`)!;
  return {
    schemaVersion: '1.0.0', ruleVersion: 'ordinary-trace-v1', id: `hutao-independent-${action}`, label: 'Explicit numerical Hu Tao fixture',
    gameContext: { characterId: 'character:10000046', characterName: '胡桃', abilityId: 'talent:hutao:combat1', skillId: mapping.skillId,
      skillName: mapping.skillLabel!, effectiveTalentLevel: normalLevel, constellation: 0, ascension: 6, scopeCoverage: 'single-hit',
      attributionPolicy: 'Only this selected own contact', hutaoDamage: { paramitaActive: true, skillTalentLevel: 10,
        skillAttackIncludedInPanel: false, maxHpUnchangedSinceSkillCast: true, baseAttack: 700,
        hpPercentAtSnapshot: 50, a4ThresholdStable: true, a4IncludedInDamageBonus: false } },
    scope: 'single-hit', characterLevel: 90,
    build: { mode: 'manual-final', ascension: 6, stats: { atk: 2000, hp: 30000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: 'Synthetic explicit panel, not a player account' },
    enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [{ id: mapping.id, label: mapping.hitLabel, kind: 'ordinary', element: 'pyro', attackTag: mapping.attackTag!,
      terms: [{ stat: 'atk', coefficient: 999 }], additiveBaseDamage: 0, damageBonus: 0, critEligible: true,
      reaction: 'none', reactionBonus: 0, groupMultiplier: 1, sourceRefs: [], dependencies: [] }],
    selectedHitIds: [mapping.id], dependencies: [], assumptions: [],
    dataIdentity: { datasetId: 'explicit-hutao-independent-fixture', gameVersion: '6.7', releaseStatus: 'released', evidenceStatus: 'provisional' },
  };
}

/** Temporary, explicit adapter while the root owns shared-schema registration. It removes only
 * the unregistered context after preparation; every formula, blocker and assertion stays intact.
 * Once formally wired, root can replace run(doc) with calculateDocument(doc), and conversion
 * with convertCalculatorToFinalPanel(doc). No production parser or engine is changed here. */
function compatible(document: CalculatorDocument): CalculatorDocument {
  const copy = structuredClone(document) as HutaoCalculatorDocument; delete copy.gameContext.hutaoDamage; return copy;
}
const run = (document: CalculatorDocument) => calculateDocument(compatible(prepareHutaoDamageDocument(document)));
function convert(document: CalculatorDocument): CalculatorDocument {
  const prepared = prepareHutaoDamageDocument(document), context = structuredClone(hutaoContext(prepared)!);
  const converted = convertCalculatorToFinalPanel(compatible(prepared)) as HutaoCalculatorDocument;
  converted.gameContext.hutaoDamage = context; finalizeHutaoDamageContextSnapshot(converted); return converted;
}

describe('Hu Tao C0/C1 Paramita selected primary contacts', () => {
  it.each([
    ['normal-1', .836496], ['normal-2', .860894], ['normal-3', 1.089188], ['normal-4', 1.171094],
    ['normal-5-1', .593633], ['normal-5-2', .628], ['normal-6', 1.533576], ['charged', 2.42565],
  ] as const)('uses NA10 coefficient for %s with the independent E10 conversion', (action, coefficient) => {
    const doc = fixture(action), result = run(doc);
    expect(result.status).toBe('calculated');
    expect(result.totals!.nonCritical).toBeCloseTo(3876.8 * coefficient * 1.33 * .5 * .9, 8);
    expect(result.totals!.expected).toBeCloseTo(3876.8 * coefficient * 1.33 * .5 * .9 * 1.5, 8);
    const prepared = prepareHutaoDamageDocument(doc), hit = prepared.hits[0]!; if (hit.kind !== 'ordinary') throw Error('ordinary');
    expect(hit.terms).toEqual([{ stat: 'atk', coefficient }]);
    expect(hit.attackTag).toBe(action === 'charged' ? 'charged' : 'normal'); expect(hit.element).toBe('pyro');
  });

  it('keeps C1 direct damage equal and never adds constellation talent levels a second time', () => {
    const c0 = fixture(), c1 = fixture(); c1.gameContext.constellation = 1;
    expect(run(c1).totals).toEqual(run(c0).totals);
    c1.gameContext.effectiveTalentLevel = 13; hutaoContext(c1)!.skillTalentLevel = 7;
    expect(run(c1).totals!.nonCritical).toBeCloseTo((2000 + 30000 * .05359) * 2.8428 * 1.33 * .45, 8);
    c1.gameContext.abilityId = 'talent:hutao:combat2'; expect(run(c1).status).toBe('blocked');
  });

  it('caps conversion at 400% of white ATK and adds Extra ATK after ATK%', () => {
    const doc = fixture(); hutaoContext(doc)!.baseAttack = 100;
    expect(run(doc).totals!.nonCritical).toBeCloseTo(2400 * 2.42565 * 1.33 * .45, 8);
    doc.build = { mode: 'equipment-derived', characterBaseAtk: 500, weaponBaseAtk: 200, atkPercent: 2, flatAtk: 0,
      baseHp: 30000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 200, critRate: .5, critDamage: 1 };
    expect(run(doc).totals!.nonCritical).toBeCloseTo(3976.8 * 2.42565 * 1.33 * .45, 8);
    expect(hutaoContext(prepareHutaoDamageDocument(doc))!.baseAttack).toBe(700);
    doc.build.atkPercent = 4;
    expect(run(doc).totals!.nonCritical).toBeCloseTo(5376.8 * 2.42565 * 1.33 * .45, 8);
    doc.build.weaponBaseAtk = 0;
    expect(run(doc).totals!.nonCritical).toBeCloseTo((2500 + 1876.8) * 2.42565 * 1.33 * .45, 8);
  });

  it('locks an independent full-precision charge reference and the conversion cap boundary', () => {
    expect(run(fixture()).totals!.nonCritical).toBeCloseTo(5628.15031212, 9);
    expect(run(fixture()).totals!.expected).toBeCloseTo(8442.22546818, 9);
    for (const [maximumHp, expected] of [[30000, 1876.8], [4000 / .06256, 4000], [100000, 4000]]) {
      const formula = createHutaoSkillAttackFormula({ skillTalentLevel: 10, baseAttack: 1000, maxHpUnchangedSinceSkillCast: false, skillCastMaxHp: maximumHp! });
      expect(evaluateFormulaExpression(formula.expression, Object.fromEntries(formula.inputs.map(value => [value.key, value.value])))).toBeCloseTo(expected!, 10);
    }
  });

  it('keeps the E cast maximum-HP snapshot independent of later HP and the A4 health ratio', () => {
    const doc = fixture(); Object.assign(hutaoContext(doc)!, { maxHpUnchangedSinceSkillCast: false, skillCastMaxHp: 20000 });
    expect(run(doc).totals!.nonCritical).toBeCloseTo(3251.2 * 2.42565 * 1.33 * .45, 8);
    if (doc.build.mode !== 'manual-final') throw Error('manual'); doc.build.stats.hp = 90000;
    expect(run(doc).totals!.nonCritical).toBeCloseTo(3251.2 * 2.42565 * 1.33 * .45, 8);
    hutaoContext(doc)!.hpPercentAtSnapshot = 80;
    expect(run(doc).totals!.nonCritical).toBeCloseTo(3251.2 * 2.42565 * .45, 8);
    delete hutaoContext(doc)!.skillCastMaxHp; expect(run(doc).status).toBe('blocked');
  });

  it.each([[0, 1.33], [49.999, 1.33], [50, 1.33], [50.001, 1], [100, 1]])('uses actual snapshot HP %s with the inclusive half-HP boundary', (hp, multiplier) => {
    const doc = fixture(); hutaoContext(doc)!.hpPercentAtSnapshot = hp;
    expect(run(doc).totals!.nonCritical).toBeCloseTo(3876.8 * 2.42565 * multiplier * .45, 8);
  });

  it('does not add the E conversion or A4 twice to an explicitly included final panel', () => {
    const included = fixture(); if (included.build.mode !== 'manual-final' || included.hits[0]!.kind !== 'ordinary') throw Error('manual ordinary');
    included.build.stats.atk = 3876.8; included.hits[0]!.damageBonus = .33;
    Object.assign(hutaoContext(included)!, { skillAttackIncludedInPanel: true, a4IncludedInDamageBonus: true });
    delete hutaoContext(included)!.baseAttack; delete hutaoContext(included)!.maxHpUnchangedSinceSkillCast;
    expect(run(included).totals).toEqual(run(fixture()).totals);
    hutaoContext(included)!.hpPercentAtSnapshot = 80;
    expect(run(included).totals!.nonCritical).toBeCloseTo(3876.8 * 2.42565 * .45, 8);
  });

  it('does not request half-HP answers before A4 is unlocked', () => {
    const doc = fixture(); doc.gameContext.ascension = 3; if (doc.build.mode !== 'manual-final') throw Error('manual'); doc.build.ascension = 3;
    delete hutaoContext(doc)!.hpPercentAtSnapshot; delete hutaoContext(doc)!.a4ThresholdStable;
    expect(run(doc).totals!.nonCritical).toBeCloseTo(3876.8 * 2.42565 * .45, 8);
    expect(hutaoRequirementAdapter.collect(doc)).toEqual([]);
  });

  it.each(['paramitaActive', 'skillTalentLevel', 'skillAttackIncludedInPanel', 'maxHpUnchangedSinceSkillCast', 'baseAttack', 'hpPercentAtSnapshot', 'a4ThresholdStable', 'a4IncludedInDamageBonus'] as const)('blocks missing %s and provides an actual control', key => {
    const doc = fixture(); delete hutaoContext(doc)![key]; expect(run(doc).status).toBe('blocked');
    expect(hutaoRequirementAdapter.collect(doc).some(field => field.fieldPath === `gameContext.hutaoDamage.${key}`)).toBe(true);
    expect(renderHutaoControls(doc)).toContain(`gameContext.hutaoDamage.${key}`);
  });

  it('keeps foreign same-slot formula evidence intact and refuses to overwrite it', () => {
    for (const key of ['attackAdjustment', 'damageBonusFormula'] as const) {
      const doc = fixture(), hit = doc.hits[0]!; if (hit.kind !== 'ordinary') throw Error('ordinary');
      const formula = { ruleId: 'foreign-reviewed-source', label: 'Foreign source stays reviewable', expression: expr.value(.2), inputs: [], sourceRefs: ['https://example.com/fixed-foreign-evidence'] };
      if (key === 'attackAdjustment') hit.attackAdjustment = { accounting: 'add-to-panel', formula }; else hit.damageBonusFormula = formula;
      const prepared = prepareHutaoDamageDocument(doc), resultHit = prepared.hits[0]!; if (resultHit.kind !== 'ordinary') throw Error('ordinary');
      expect(resultHit[key]).toEqual(hit[key]); expect(run(doc).status).toBe('blocked');
    }
  });

  it('preserves conversion/reopen totals, and refuses changing conditions, levels or panels afterward', () => {
    const doc = fixture(); doc.build = { mode: 'equipment-derived', characterBaseAtk: 500, weaponBaseAtk: 200, atkPercent: 2, flatAtk: 0,
      baseHp: 30000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 200, critRate: .5, critDamage: 1 };
    const before = run(doc), converted = convert(doc);
    expect(run(converted).totals).toEqual(before.totals);
    expect(run(JSON.parse(JSON.stringify(converted)) as CalculatorDocument).totals).toEqual(before.totals);
    for (const mutate of [
      (copy: CalculatorDocument) => { hutaoContext(copy)!.hpPercentAtSnapshot = 80; },
      (copy: CalculatorDocument) => { hutaoContext(copy)!.skillTalentLevel = 9; },
      (copy: CalculatorDocument) => { copy.gameContext!.effectiveTalentLevel = 9; },
      (copy: CalculatorDocument) => { copy.characterLevel = 80; },
      (copy: CalculatorDocument) => { if (copy.build.mode !== 'equipment-derived') copy.build.stats.hp = 40000; },
    ]) { const copy = structuredClone(converted); mutate(copy); expect(run(copy).status).toBe('blocked'); }
    hutaoContext(converted)!.hpPercentAtSnapshot = 80;
    expect(() => finalizeHutaoDamageContextSnapshot(converted)).toThrow('不能重新盖写');
  });

  it('rejects unaccounted historical snapshots, unsupported C2+, inactive E and invented totals', () => {
    const frozen = fixture(), hit = frozen.hits[0]!; if (hit.kind !== 'ordinary') throw Error('ordinary'); hit.effectiveCritRate = .5;
    expect(run(frozen).status).toBe('blocked');
    const higher = fixture(); higher.gameContext.constellation = 2; expect(run(higher).status).toBe('blocked');
    const inactive = fixture(); hutaoContext(inactive)!.paramitaActive = false; expect(run(inactive).status).toBe('blocked');
    const unstable = fixture(); hutaoContext(unstable)!.a4ThresholdStable = false; expect(run(unstable).status).toBe('blocked');
    const extra = fixture(); extra.hits.push({ ...extra.hits[0]!, id: 'invented-blood-blossom' }); extra.selectedHitIds.push('invented-blood-blossom'); extra.scope = 'one-cast';
    expect(run(extra).status).toBe('blocked');
  });

  it('resets only accounting with fresh gear, and preserves imported unknowns without inventing cast HP', () => {
    const doc = fixture(); resetHutaoPanelAccounting(doc, 'imported-final');
    expect(hutaoContext(doc)).toEqual({ skillTalentLevel: 10 }); expect(run(doc).status).toBe('blocked');
    resetHutaoPanelAccounting(doc, 'fresh-equipment');
    expect(hutaoContext(doc)).toEqual({ skillTalentLevel: 10, skillAttackIncludedInPanel: false, a4IncludedInDamageBonus: false });
    const example = createHutaoExampleContext(7); expect(example.skillTalentLevel).toBe(7); expect(example.maxHpUnchangedSinceSkillCast).toBeUndefined();
    expect(hutaoContext(applyHutaoDamageContext(fixture(), example))!.skillTalentLevel).toBe(7);
  });

  it('keeps real zero distinct from blank and validates all state edit domains', () => {
    const doc = fixture(); updateHutaoDamageControl(doc, 'gameContext.hutaoDamage.hpPercentAtSnapshot', '0'); expect(hutaoContext(doc)!.hpPercentAtSnapshot).toBe(0);
    updateHutaoDamageControl(doc, 'gameContext.hutaoDamage.hpPercentAtSnapshot', ''); expect(hutaoContext(doc)!.hpPercentAtSnapshot).toBeUndefined();
    expect(() => updateHutaoDamageControl(doc, 'gameContext.hutaoDamage.skillTalentLevel', '16')).toThrow();
    expect(hutaoDamageContextSchema.safeParse({ skillCastMaxHp: 0 }).success).toBe(false);
    expect(updateHutaoDamageControl(doc, 'gameContext.hutaoDamage.finalizedHitStates', '{}')).toBe(false);
  });

  it('exports valid typed formula trees and keeps existing blood-blossom/base actions out of scope', () => {
    const formula = createHutaoSkillAttackFormula({ skillTalentLevel: 10, baseAttack: 700, maxHpUnchangedSinceSkillCast: false, skillCastMaxHp: 30000 });
    expect(calculatorFormulaSchema.safeParse(formula).success).toBe(true);
    expect(evaluateFormulaExpression(formula.expression, Object.fromEntries(formula.inputs.map(value => [value.key, value.value])))).toBeCloseTo(1876.8, 10);
    expect(calculatorFormulaSchema.safeParse(createHutaoA4BonusFormula(6, 50, false)).success).toBe(true);
    for (const skillId of ['hutao-charged-base', 'observed-hutao-skill-c0']) {
      const doc = fixture(); doc.gameContext.skillId = skillId;
      expect(isHutaoPrimaryDocument(doc)).toBe(false); expect(prepareHutaoDamageDocument(doc)).toBe(doc); expect(renderHutaoControls(doc)).toBe('');
    }
  });
});
