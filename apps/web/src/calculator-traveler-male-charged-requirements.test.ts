import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "./character-calculations";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { travelerMaleChargedRequirementAdapter } from "./calculator-traveler-male-charged-requirements";
import { renderMaleTravelerChargedControls } from "./calculator-traveler-male-charged-controls";
import { applySourceCastControl } from "./calculator-source-cast-controls";
import { calculateDocument, convertCalculatorToFinalPanel } from "../../../packages/sim-core/src/calculator";
import { prepareSourceCastDocument } from "../../../packages/sim-core/src/source-cast-context";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";

const SKILL = "male-charged-aether-anemo-c0", BASE = "gameContext.travelerMaleChargedCast";
const source = getCharacterDocuments("character:10000005", 10).find(row => row.gameContext?.skillId === SKILL)!;
function fixture(): CalculatorDocument {
  const document = structuredClone(source);
  document.scope = "single-hit";
  document.selectedHitIds = [document.hits[0]!.id];
  document.gameContext!.constellation = 6;
  document.gameContext!.travelerMaleChargedCast = {};
  document.characterLevel = 90;
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  document.build = { mode: "manual-final", ascension: 6, source: "Declared synthetic actual physical charged panel",
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  return document;
}
function report(document: CalculatorDocument) {
  const html = renderMaleTravelerChargedControls(document);
  // Explicit injection keeps this dedicated unit independent of root's shared
  // registry edit. Root separately verifies the actual default registry/page.
  return collectCalculatorRequirements(document, { adapters: [travelerMaleChargedRequirementAdapter], isControlAvailable(selector) {
    const match = /\[(data-[a-z-]+)="([^"]+)"\]/.exec(selector);
    return Boolean(match && html.includes(`${match[1]}="${match[2]}"`));
  } });
}
function answer(document: CalculatorDocument, field: string, value: "unknown" | "0" | "1"): void {
  applySourceCastControl(document, { dataset: { sourceCastStateField: `${BASE}.${field}` }, value } as unknown as HTMLSelectElement);
}
function full(): CalculatorDocument {
  const document = fixture(); document.scope = "one-cast";
  document.selectedHitIds = document.hits.map(hit => hit.id);
  document.gameContext!.travelerMaleChargedCast = {
    casterId: "aether", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true,
    observedThroughFrame: 20, statsStableAcrossHits: true,
    precedingNormalAttackConfirmed: true, normalCounterBeforeCast: 1,
    actionReadyConfirmed: true, initialStamina: 20, staminaCostMultiplier: 1,
    targetContacts: { "hit-1": true, "hit-2": true },
    sharedState: { externalInfusionActive: false, trueMoonStoryBuffEnabled: false },
  };
  return document;
}

describe("Aether Anemo male charged requirement links", () => {
  it("links only this occurred hit's two unknown qualifications to existing controls without inventing a future action", () => {
    const document = prepareSourceCastDocument(fixture()), before = JSON.stringify(document);
    const result = report(document);
    expect(result.fields.map(row => row.fieldPath)).toEqual([`${BASE}.sharedState.externalInfusionActive`, `${BASE}.sharedState.trueMoonStoryBuffEnabled`]);
    expect(result.fields.every(row => row.status === "input-required")).toBe(true);
    expect(result.blockers).toEqual([expect.objectContaining({ dependencyId: `traveler-male-charged:${document.selectedHitIds[0]}`, status: "linked-controls" })]);
    expect(JSON.stringify(document)).toBe(before);
    expect(document.gameContext!.travelerMaleChargedCast).toEqual({});
    expect(calculateDocument(document).status).toBe("blocked");
    const contextless = fixture(); delete contextless.gameContext!.travelerMaleChargedCast;
    expect(renderMaleTravelerChargedControls(contextless)).toContain(`data-source-cast-state-field="${BASE}.sharedState.externalInfusionActive"`);
    expect(contextless.gameContext).not.toHaveProperty("travelerMaleChargedCast");
  });

  it("accepts both explicit no answers at C6 and preserves the actual first hit through final-panel JSON", () => {
    const document = fixture();
    answer(document, "sharedState.externalInfusionActive", "0");
    answer(document, "sharedState.trueMoonStoryBuffEnabled", "0");
    const prepared = prepareSourceCastDocument(document), result = calculateDocument(prepared);
    expect(report(prepared)).toEqual({ fields: [], blockers: [] });
    expect(prepared.gameContext!.travelerMaleChargedCast).toEqual({ sharedState: { externalInfusionActive: false, trueMoonStoryBuffEnabled: false } });
    expect(result.totals!.nonCritical).toBeCloseTo(994.5, 10);
    expect(result.totals!.critical).toBeCloseTo(1989, 10);
    expect(result.totals!.expected).toBeCloseTo(1491.75, 10);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(prepared)));
    expect(calculateDocument(restored).totals).toEqual(result.totals);
    expect(report(restored)).toEqual({ fields: [], blockers: [] });
    expect(renderMaleTravelerChargedControls(restored)).toContain("基础物理重击支持C0–C6");
  });

  it("keeps unknown and explicitly active infusion/story states distinct and blocked after reopening", () => {
    for (const field of ["externalInfusionActive", "trueMoonStoryBuffEnabled"]) {
      const document = fixture();
      answer(document, "sharedState.externalInfusionActive", "0");
      answer(document, "sharedState.trueMoonStoryBuffEnabled", "0");
      answer(document, `sharedState.${field}`, "1");
      const active = prepareSourceCastDocument(parseCalculatorDocument(serializeCalculatorDocument(document)));
      expect(report(active).fields).toEqual([expect.objectContaining({ fieldPath: `${BASE}.sharedState.${field}`, status: "condition-not-satisfied" })]);
      expect(calculateDocument(active).totals).toBeUndefined();
      answer(document, `sharedState.${field}`, "unknown");
      const unknown = prepareSourceCastDocument(parseCalculatorDocument(serializeCalculatorDocument(document)));
      expect(report(unknown).fields).toEqual([expect.objectContaining({ fieldPath: `${BASE}.sharedState.${field}`, status: "input-required" })]);
      expect(unknown.gameContext!.travelerMaleChargedCast!.sharedState).not.toHaveProperty(field);
      expect(calculateDocument(unknown).status).toBe("blocked");
    }
  });

  it("links actual full-cast legal zeros and missing contact without replacing them with satisfied defaults", () => {
    const document = full(), context = document.gameContext!.travelerMaleChargedCast!;
    context.normalCounterBeforeCast = 0; context.initialStamina = 0;
    delete context.targetContacts!["hit-2"];
    const prepared = prepareSourceCastDocument(document);
    const fields = report(prepared).fields;
    expect(fields.map(row => [row.fieldPath, row.status])).toEqual([
      [`${BASE}.normalCounterBeforeCast`, "condition-not-satisfied"],
      [`${BASE}.initialStamina`, "condition-not-satisfied"],
      [`${BASE}.targetContacts.hit-2`, "input-required"],
    ]);
    expect(renderMaleTravelerChargedControls(prepared)).toContain('data-optional-number value="0"');
    expect(calculateDocument(prepared).status).toBe("blocked");
    expect(context.initialStamina).toBe(0);
    context.normalCounterBeforeCast = 1; context.initialStamina = 20; context.targetContacts!["hit-2"] = false;
    const knownMiss = prepareSourceCastDocument(document);
    expect(report(knownMiss)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(knownMiss).totals!.nonCritical).toBeCloseTo(994.5, 10);
  });

  it("links every absent full-cast condition to an existing control and does not ask full history for a single hit", () => {
    const document = fixture(); document.scope = "one-cast"; document.selectedHitIds = document.hits.map(hit => hit.id);
    const prepared = prepareSourceCastDocument(document), fields = report(prepared).fields;
    expect(fields.map(row => row.fieldPath)).toEqual(expect.arrayContaining([
      `${BASE}.casterId`, `${BASE}.targetId`, `${BASE}.precedingNormalAttackConfirmed`, `${BASE}.actionReadyConfirmed`,
      `${BASE}.freshCastConfirmed`, `${BASE}.noHitlag`, `${BASE}.noInterruption`, `${BASE}.noReplacement`,
      `${BASE}.fullObservedLifetime`, `${BASE}.normalCounterBeforeCast`, `${BASE}.initialStamina`, `${BASE}.staminaCostMultiplier`,
      `${BASE}.observedThroughFrame`, `${BASE}.targetContacts.hit-1`, `${BASE}.targetContacts.hit-2`, `${BASE}.statsStableAcrossHits`,
    ]));
    expect(fields.some(row => row.status === "missing-control")).toBe(false);
    expect(fields).toHaveLength(18);
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[0]!.id];
    expect(report(prepareSourceCastDocument(document)).fields).toHaveLength(2);
  });

  it("keeps saved template precedence editable after event IDs replace the original rows", () => {
    const document = full(), context = document.gameContext!.travelerMaleChargedCast!;
    context.sharedState!.externalInfusionActive = true;
    context.hitStates = { [`${SKILL}-hit-1`]: { externalInfusionActive: false }, [`${SKILL}-hit-2`]: { externalInfusionActive: false } };
    const prepared = prepareSourceCastDocument(document);
    expect(prepared.hits.map(hit => hit.id)).toEqual([`${SKILL}:hit-1`, `${SKILL}:hit-2`]);
    expect(report(prepared)).toEqual({ fields: [], blockers: [] });
    expect(renderMaleTravelerChargedControls(prepared)).toContain(`data-source-cast-state-field="${BASE}.hitStates.${SKILL}-hit-1.externalInfusionActive"`);
    prepared.gameContext!.travelerMaleChargedCast!.hitStates![`${SKILL}-hit-1`]!.externalInfusionActive = true;
    expect(report(prepared).fields).toEqual([expect.objectContaining({ fieldPath: `${BASE}.hitStates.${SKILL}-hit-1.externalInfusionActive`, status: "condition-not-satisfied" })]);
    expect(calculateDocument(prepared).status).toBe("blocked");
  });

  it("does not lend the adapter to an unsupported high-constellation form or different talent", () => {
    const document = fixture(); document.gameContext!.abilityId = "talent:traveleranemo:combat2";
    expect(travelerMaleChargedRequirementAdapter.applies(document)).toBe(false);
    expect(travelerMaleChargedRequirementAdapter.collect(document)).toEqual([]);
    document.gameContext!.abilityId = "talent:travelergeo:combat1";
    document.gameContext!.skillId = "male-charged-aether-geo-c0"; document.gameContext!.variantId = "aether-geo";
    expect(travelerMaleChargedRequirementAdapter.applies(document)).toBe(false);
  });
});
