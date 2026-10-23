import { describe, expect, it } from "vitest";
import type { CalculatorDocument, CalculatorFormula } from "./calculator-model";
import { executeOrdinaryDamage } from "./calculator-formula";
import { evaluateFormulaExpression, expr } from "./calculation-trace";
import { faruzanBurstInitialContextSchema } from "./faruzan-burst-initial-context";
import { FARUZAN_BURST_INITIAL_HIT_ID as ID, FARUZAN_BURST_INITIAL_SKILL_ID as SKILL,
  evaluateFaruzanBurstInitial, finalizeFaruzanBurstInitialPanelAccounting, initializeFaruzanBurstInitialDocument,
  isFaruzanBurstInitialHit, prepareFaruzanBurstInitialDocument, resetFaruzanBurstInitialPanelAccounting,
  type FaruzanBurstInitialDocument } from "./faruzan-burst-initial-formulas";

// Explicit module-unit fixture: public model/router registration belongs to
// integration. This file does not bypass a shared parser or claim UI wiring.
const fixture = (): FaruzanBurstInitialDocument => ({ dataIdentity: { releaseStatus: "released" },
  id: "fixture:faruzan-q", label: "Synthetic fresh Q, not a UID or native capture", characterLevel: 90, scope: "single-hit",
  build: { mode: "manual-final", stats: { atk: 2000, hp: 10000, def: 700, em: 0, critRate: .5, critDamage: 1 }, source: "unit fixture" },
  enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
  gameContext: { characterId: "character:10000076", abilityId: "talent:faruzan:combat3", skillId: SKILL,
    effectiveTalentLevel: 13, constellation: 6, ascension: 6,
    faruzanBurstInitial: { freshBurstNoPriorEffects: true, insideBurstArea: true, noOtherAnemoBeforeInitial: true,
      baseAttack: 1000, includedBurstDamageBonus: 0, includedA4BaseDamage: 0, includedResistanceReduction: 0, c6CritDamageIncludedInPanel: false } },
  hits: [{ id: ID, label: "Q initial", kind: "ordinary", element: "anemo", attackTag: "burst", terms: [{ stat: "atk", coefficient: 8.024 }],
    additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: [], dependencies: [] }],
  selectedHitIds: [ID], dependencies: [], assumptions: [] } as unknown as FaruzanBurstInitialDocument);
const amount = (f: CalculatorFormula | undefined) => f ? evaluateFormulaExpression(f.expression, Object.fromEntries(f.inputs.map(x => [x.key, x.value]))) : 0;
const blocked = (doc: CalculatorDocument) => doc.dependencies.some(x => x.id.startsWith("faruzan-burst-initial:") && x.status === "missing");

describe("Faruzan fresh Q initial C0–C6", () => {
  it("uses effective Q13 once, A4 white attack and C6 CD in the actual damage graph", () => {
    const doc = prepareFaruzanBurstInitialDocument(fixture()), h = doc.hits[0]!;
    expect(blocked(doc)).toBe(false); if (h.kind !== "ordinary") throw new Error("ordinary");
    expect(h.terms).toEqual([{ stat: "atk", coefficient: 8.024 }]);
    expect(amount(h.damageBonusFormula)).toBe(.3825); expect(amount(h.additiveBaseFormula)).toBe(320);
    expect(amount(h.resistanceReductionFormula)).toBe(0); expect(amount(h.critDamageFormula)).toBe(.4);
    const result = executeOrdinaryDamage({ scalingStat: "atk", scaling: h.terms[0]!.coefficient, scalingValue: 2000, flatDamage: amount(h.additiveBaseFormula),
      damageBonus: amount(h.damageBonusFormula), characterLevel: 90, enemyLevel: 90, defenseReduction: 0, defenseIgnore: 0,
      effectiveResistance: .1, critMode: "average", critRate: .5, critDamage: 1 + amount(h.critDamageFormula), reaction: "none",
      elementalMastery: 0, reactionBonus: 0, groupMultiplier: 1 }, false);
    // Independent: (2000*8.024+320)*1.3825*.5*.9*1.7
    expect(result.finalDamage).toBeCloseTo(17311.0014, 8);
  });
  it("subtracts already included shares without turning C6 CD into damage bonus", () => {
    const doc = fixture(), ctx = doc.gameContext.faruzanBurstInitial!;
    Object.assign(ctx, { includedBurstDamageBonus: .3825, includedA4BaseDamage: 320, c6CritDamageIncludedInPanel: true });
    const p = prepareFaruzanBurstInitialDocument(doc), h = p.hits[0]!;
    expect(blocked(p)).toBe(false); if (h.kind !== "ordinary") throw new Error("ordinary");
    expect([h.damageBonusFormula, h.additiveBaseFormula, h.critDamageFormula].map(amount)).toEqual([0, 0, 0]);
  });
  it("keeps unlocked C0–C5 initial multipliers and valid zero white attack distinct from unknown", () => {
    for (const constellation of [0, 1, 2, 3, 4, 5]) {
      expect(evaluateFaruzanBurstInitial({ effectiveBurstTalentLevel: 13, constellation, ascension: 6, baseAttack: 0 }))
        .toEqual({ coefficient: 8.024, anemoDamageBonus: .3825, additiveBaseDamage: 0, critDamageBonus: 0 });
    }
    expect(() => evaluateFaruzanBurstInitial({ effectiveBurstTalentLevel: 13, constellation: 6, ascension: 6 })).toThrow(/真实角色加武器/);
    expect(() => evaluateFaruzanBurstInitial({ effectiveBurstTalentLevel: 16, constellation: 6, ascension: 6, baseAttack: 1000 })).toThrow(/1–15/);
    expect(evaluateFaruzanBurstInitial({ effectiveBurstTalentLevel: 10, constellation: 6, ascension: 3 }).additiveBaseDamage).toBe(0);
  });
  it("refuses unknown or false qualifications and preserves foreign same-slot formulas", () => {
    for (const value of [undefined, false]) {
      const doc = fixture();
      if (value === undefined) delete doc.gameContext.faruzanBurstInitial!.insideBurstArea;
      else doc.gameContext.faruzanBurstInitial!.insideBurstArea = value;
      expect(blocked(prepareFaruzanBurstInitialDocument(doc))).toBe(true);
    }
    const doc = fixture(), foreign = { ruleId: "fixture:foreign-anemo", label: "external", expression: expr.value(.2), inputs: [], sourceRefs: ["fixture:external"] };
    if (doc.hits[0]!.kind !== "ordinary") throw new Error("ordinary"); doc.hits[0]!.damageBonusFormula = foreign;
    const result = prepareFaruzanBurstInitialDocument(doc);
    expect(blocked(result)).toBe(true); expect(result.hits[0]!.kind === "ordinary" && result.hits[0]!.damageBonusFormula).toEqual(foreign);
    expect(doc.hits[0]!.damageBonusFormula).toEqual(foreign);
  });
  it("does not migrate a context-free old save or open other hits through its constellation helper", () => {
    const old = fixture(); delete old.gameContext.faruzanBurstInitial;
    expect(prepareFaruzanBurstInitialDocument(old)).toBe(old);
    expect((initializeFaruzanBurstInitialDocument(old) as FaruzanBurstInitialDocument).gameContext.faruzanBurstInitial).toEqual({});
    const doc = fixture(); expect(isFaruzanBurstInitialHit(doc, doc.hits[0]!)).toBe(true);
    doc.gameContext.abilityId = "talent:faruzan:combat2"; expect(isFaruzanBurstInitialHit(doc, doc.hits[0]!)).toBe(false);
    doc.gameContext.abilityId = "talent:faruzan:combat3"; doc.scope = "one-cast";
    expect(blocked(prepareFaruzanBurstInitialDocument(doc))).toBe(true);
  });
  it("keeps explicit false/zero after JSON reopen and rejects changed conversion identities", () => {
    const doc = fixture(); if (doc.hits[0]!.kind !== "ordinary") throw new Error("ordinary");
    doc.hits[0]!.finalSnapshot = { origin: "equipment-conversion", stats: { atk: 2000, hp: 10000, def: 700, em: 0, critRate: .5, critDamage: 1.4 },
      characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "actual conversion fixture", sourceRefs: ["fixture:snapshot"] };
    finalizeFaruzanBurstInitialPanelAccounting(doc);
    const reopened = JSON.parse(JSON.stringify(doc)) as FaruzanBurstInitialDocument;
    reopened.gameContext.faruzanBurstInitial = faruzanBurstInitialContextSchema.parse(reopened.gameContext.faruzanBurstInitial);
    expect(reopened.gameContext.faruzanBurstInitial.c6CritDamageIncludedInPanel).toBe(false);
    expect(reopened.gameContext.faruzanBurstInitial.includedA4BaseDamage).toBe(0);
    expect(blocked(prepareFaruzanBurstInitialDocument(reopened))).toBe(false);
    reopened.gameContext.effectiveTalentLevel = 10;
    expect(blocked(prepareFaruzanBurstInitialDocument(reopened))).toBe(true);
    expect(() => finalizeFaruzanBurstInitialPanelAccounting(reopened)).toThrow(/不能重写/);
    resetFaruzanBurstInitialPanelAccounting(reopened, "imported-final");
    expect(reopened.gameContext.faruzanBurstInitial.c6CritDamageIncludedInPanel).toBeUndefined();
    expect(reopened.gameContext.faruzanBurstInitial.includedA4BaseDamage).toBeUndefined();
  });
});
