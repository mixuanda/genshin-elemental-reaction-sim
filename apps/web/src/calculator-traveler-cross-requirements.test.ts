import { describe, expect, it } from "vitest";
import {
  calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument,
  serializeCalculatorDocument, type CalculatorDocument,
} from "@genshin-dps-lab/sim-core";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { travelerCrossRequirementAdapter } from "./calculator-traveler-cross-requirements";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { renderTravelerCrossEntityControls } from "./calculator-traveler-cross-entity-controls";
import { applySourceCastControl } from "./calculator-source-cast-controls";

const STORY = "gameContext.travelerCrossEntityCast.trueMoonStoryBuffInactive";
const genders = [["character:10000005", "aether"], ["character:10000007", "lumine"]] as const;

function fixture(character = "character:10000005", gender = "aether"): CalculatorDocument {
  // The page currently defaults to Hydro; explicitly choose the resolved Anemo
  // form/action here, as root's browser acceptance must also do.
  const source = getCharacterDocuments(character, 10)
    .find(candidate => candidate.gameContext?.skillId === `traveler-cross-${gender}-anemo-burst-c0`)!;
  let document = applyCharacterConstellationScope(source);
  document.scope = "single-hit";
  document.selectedHitIds = [document.hits[0]!.id];
  return applyCharacterConstellationScope(document);
}

// Default registration is the path used by the actual calculator page.
const requirements = (document: CalculatorDocument) => collectCalculatorRequirements(document);
function answer(document: CalculatorDocument, value: "unknown" | "0" | "1"): CalculatorDocument {
  applySourceCastControl(document, { dataset: { sourceCastStateField: STORY }, value } as unknown as HTMLSelectElement);
  return applyCharacterConstellationScope(document);
}
function panel(document: CalculatorDocument): CalculatorDocument {
  document.characterLevel = 90;
  document.build = { mode: "manual-final", ascension: 6, source: "Explicit actual Q-start attack panel for this already-occurring hit",
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  for (const hit of document.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  return applyCharacterConstellationScope(document);
}

describe("Traveler Anemo resolved single-hit requirement links", () => {
  it.each(genders)("links the actual unanswered Anemo condition for %s without mutation or a future schedule", (character, gender) => {
    const document = fixture(character, gender), before = JSON.stringify(document);
    expect(document.gameContext!.variantId).toBe(`${gender}-anemo`);
    expect(calculateDocument(document).status).toBe("blocked");
    const report = requirements(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(report.fields).toEqual([expect.objectContaining({
      fieldPath: STORY, status: "input-required", dependencyIds: ["traveler-cross-entity:schedule"],
      hitIds: document.selectedHitIds,
      controlSelector: `select[data-source-cast-state-field="${STORY}"]`,
    })]);
    expect(renderTravelerCrossEntityControls(document)).toContain(`data-source-cast-state-field="${STORY}"`);
    expect(report.blockers).toEqual([expect.objectContaining({ dependencyId: "traveler-cross-entity:schedule", status: "linked-controls", fieldPaths: [STORY] })]);
    expect(document.gameContext!.travelerCrossEntityCast).toEqual({});
  });

  it.each(genders)("calculates one explicit ATK hit for %s and retains all three numbers through final-panel JSON", (character, gender) => {
    let document = answer(panel(fixture(character, gender)), "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    const selected = document.hits.find(hit => hit.id === document.selectedHitIds[0])!;
    expect(selected.kind).toBe("ordinary");
    if (selected.kind !== "ordinary") throw new Error("expected real mapped ordinary hit");
    // Pinned Optimizer 180a0a1 supplies this gender's exact T10 1.4544.
    // gcsim a7 supplies behavior; its retained conflicting .6768 is not used.
    expect(selected.terms).toEqual([{ stat: "atk", coefficient: 1.4544 }]);
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * 1.4544 * .5 * .9, 8);
    expect(result.totals!.nonCritical).toBeCloseTo(1308.96, 8);
    expect(result.totals!.critical).toBeCloseTo(2617.92, 8);
    expect(result.totals!.expected).toBeCloseTo(1963.44, 8);
    // No invented event IDs, contacts, historical values, observation endpoint,
    // absorption, caster identity, interruption or no-replacement declarations.
    expect(document.gameContext!.travelerCrossEntityCast).toEqual({ trueMoonStoryBuffInactive: true });
    document = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document))));
    expect(calculateDocument(document).totals).toEqual(result.totals);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
  });

  it.each(genders)("keeps false and unknown blocking for %s, including after saving/reopening", (character, gender) => {
    let document = answer(panel(fixture(character, gender)), "0");
    expect(requirements(document).fields[0]!.status).toBe("condition-not-satisfied");
    expect(calculateDocument(document).status).toBe("blocked");
    document = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(document.gameContext!.travelerCrossEntityCast!.trueMoonStoryBuffInactive).toBe(false);
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, "unknown");
    expect(document.gameContext!.travelerCrossEntityCast!.trueMoonStoryBuffInactive).toBeUndefined();
    expect(requirements(document).fields[0]!.status).toBe("input-required");
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("accepts one supplied source event without requiring any future contact or complete lifetime", () => {
    let document = panel(fixture());
    document.gameContext!.travelerCrossEntityCast!.independentEvent = {
      candidateId: "recorded-hit", templateRole: "tick", frame: 124, snapshotFrame: 0,
      snapshotId: "recorded-q-start", targetId: "recorded-target",
    };
    document = answer(document, "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(1308.96, 8);
    expect(document.gameContext!.travelerCrossEntityCast!.targetContacts).toBeUndefined();
    expect(document.gameContext!.travelerCrossEntityCast!.fullObservedLifetime).toBeUndefined();
  });

  it.each(["frame", "snapshotFrame"] as const)("does not hide or repair an invalid actual event %s", field => {
    let document = panel(fixture());
    document.gameContext!.travelerCrossEntityCast!.independentEvent = {
      candidateId: "bad-record", templateRole: "tick", frame: 94, snapshotFrame: 0,
      snapshotId: "recorded-q-start", targetId: "recorded-target",
    };
    document.gameContext!.travelerCrossEntityCast!.independentEvent![field] = field === "frame" ? 95 : 1;
    document = answer(document, "1");
    expect(requirements(document).fields).toEqual([]);
    expect(requirements(document).blockers.some(blocker => blocker.status === "unsupported" && blocker.reason.includes("伤害帧或取样帧"))).toBe(true);
    expect(calculateDocument(document).status).toBe("blocked");
    expect(document.gameContext!.travelerCrossEntityCast!.independentEvent![field]).toBe(field === "frame" ? 95 : 1);
  });

  it("preserves real target mismatch and rejects C6 without its actual target state", () => {
    let document = panel(fixture());
    document.gameContext!.travelerCrossEntityCast = {
      targetId: "other-target", independentEvent: { candidateId: "hit", templateRole: "tick", frame: 94, snapshotFrame: 0, snapshotId: "q-start", targetId: "actual-target" },
    };
    document = answer(document, "1");
    expect(calculateDocument(document).status).toBe("blocked");
    expect(requirements(document).blockers.some(blocker => blocker.reason.includes("目标与当前明确目标不同"))).toBe(true);
    document = fixture();
    document.gameContext!.constellation = 6;
    document = answer(document, "1");
    expect(requirements(document).fields.map(field => field.fieldPath)).toEqual([
      "gameContext.travelerCrossEntityCast.sharedState.c6ActiveBeforeHit",
      "gameContext.travelerCrossEntityCast.sharedState.includedC6ResistanceReduction",
    ]);
    expect(calculateDocument(document).status).toBe("blocked");
    expect(requirements(document).blockers.some(blocker => blocker.reason.includes("本击结算前"))).toBe(true);
  });

  it("does not claim full-lifetime, another form, or an empty selection is unlocked", () => {
    let document = answer(fixture(), "1");
    document.scope = "one-cast";
    document = applyCharacterConstellationScope(document);
    expect(travelerCrossRequirementAdapter.applies(document)).toBe(true);
    expect(requirements(document).fields.some(field => field.fieldPath === "gameContext.travelerCrossEntityCast.fullObservedLifetime")).toBe(true);
    expect(calculateDocument(document).status).toBe("blocked");
    document = fixture();
    document.gameContext!.skillId = "traveler-cross-aether-dendro-burst-c0";
    expect(travelerCrossRequirementAdapter.applies(document)).toBe(false);
    expect(travelerCrossRequirementAdapter.collect(document)).toEqual([]);
    document.gameContext!.skillId = "traveler-cross-aether-hydro-burst-c0";
    expect(travelerCrossRequirementAdapter.applies(document)).toBe(false);
    const none = fixture(); none.selectedHitIds = [];
    expect(requirements(none).fields).toEqual([]);
  });

  it("keeps an actual missing rendered control explicit", () => {
    const report = collectCalculatorRequirements(fixture(), { adapters: [travelerCrossRequirementAdapter], isControlAvailable: () => false });
    expect(report.fields[0]!.status).toBe("missing-control");
    expect(report.blockers[0]!.status).toBe("missing-control");
  });
});
