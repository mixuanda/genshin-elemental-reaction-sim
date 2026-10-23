import { describe, expect, it } from "vitest";
import {
  calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument,
  serializeCalculatorDocument, type CalculatorDocument,
} from "@genshin-dps-lab/sim-core";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { jeanRequirementAdapter } from "./calculator-jean-requirements";
import { collectCalculatorRequirements, type CalculatorRequirementOptions } from "./calculator-requirements";
import { applySourceCastControl, renderSourceCastControls } from "./calculator-source-cast-controls";

const SKILL_ID = "jean-burst-two-boundaries-complete-c0";
const COMPLETE = "gameContext.batchFiniteCast.completeCastConfirmed";
const STABLE = "gameContext.batchFiniteCast.statsStableAcrossHits";

function fixture(talentLevel = 10): CalculatorDocument {
  const document = getCharacterDocuments("character:10000003", talentLevel)
    .find(candidate => candidate.gameContext?.skillId === SKILL_ID)!;
  // Same preparation used by calculator-ui when selecting a real action.
  return applyCharacterConstellationScope(document);
}

// Exercise default registration, as used by the calculator page.
const requirements = (document: CalculatorDocument, options: CalculatorRequirementOptions = {}) =>
  collectCalculatorRequirements(document, options);

function answer(document: CalculatorDocument, path: string, value: "unknown" | "0" | "1"): CalculatorDocument {
  applySourceCastControl(document, {
    dataset: { sourceCastStateField: path }, value,
  } as unknown as HTMLSelectElement);
  return applyCharacterConstellationScope(document);
}

function explicitPanel(document: CalculatorDocument): CalculatorDocument {
  document.characterLevel = 90;
  document.build = { mode: "manual-final", source: "Explicit Jean test panel; no inferred hit confirmation", ascension: 6,
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  for (const hit of document.hits) if (hit.kind === "ordinary") {
    hit.damageBonus = .2;
    hit.reaction = "none";
  }
  return applyCharacterConstellationScope(document);
}

describe("Jean existing finite Q requirement links", () => {
  it("links the actual default three-hit blockers to the two existing controls without mutating input", () => {
    const document = fixture();
    expect(document.scope).toBe("one-cast");
    expect(document.hits).toHaveLength(3);
    expect(document.selectedHitIds).toEqual(document.hits.map(hit => hit.id));
    expect(document.gameContext!.batchFiniteCast!.completeCastConfirmed).toBeUndefined();
    expect(document.gameContext!.batchFiniteCast!.statsStableAcrossHits).toBeUndefined();
    expect(calculateDocument(document).status).toBe("blocked");
    const before = JSON.stringify(document), report = requirements(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(report.fields.map(field => field.fieldPath)).toEqual([COMPLETE, STABLE]);
    const controls = renderSourceCastControls(document);
    for (const field of report.fields) {
      expect(field).toMatchObject({ adapterId: "jean-burst-conditions", status: "input-required", hitIds: document.selectedHitIds });
      expect(field.controlSelector).toBe(`select[data-source-cast-state-field="${field.fieldPath}"]`);
      expect(controls).toContain(`data-source-cast-state-field="${field.fieldPath}"`);
      expect(field.dependencyIds).toEqual(document.selectedHitIds.map(id => `batch-finite-context:${id}`));
    }
    expect(report.blockers).toHaveLength(3);
    expect(report.blockers.every(blocker => blocker.status === "linked-controls" && blocker.fieldPaths.join() === [COMPLETE, STABLE].join())).toBe(true);
  });

  it.each([COMPLETE, STABLE])("preserves explicit false and clears only the corresponding missing condition: %s", path => {
    let document = answer(fixture(), path, "0");
    expect(requirements(document).fields.find(field => field.fieldPath === path)?.status).toBe("condition-not-satisfied");
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, path, "1");
    expect(requirements(document).fields.map(field => field.fieldPath)).toEqual([path === COMPLETE ? STABLE : COMPLETE]);
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, path, "unknown");
    expect(requirements(document).fields.find(field => field.fieldPath === path)?.status).toBe("input-required");
  });

  it("calculates the explicit source branch with independent three-column values and preserves it through final-panel JSON", () => {
    let document = explicitPanel(fixture());
    document = answer(answer(document, COMPLETE, "1"), STABLE, "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    const ordinary = document.hits.filter(hit => hit.kind === "ordinary");
    expect(ordinary.map(hit => hit.terms[0]!.coefficient)).toEqual([7.6464, 1.4112, 1.4112]);
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    // Fixed b4 Q10: 2000*(7.6464+1.4112+1.4112)*1.2*.5*.9.
    expect(result.totals!.nonCritical).toBeCloseTo(11306.304, 8);
    expect(result.totals!.critical).toBeCloseTo(22612.608, 8);
    expect(result.totals!.expected).toBeCloseTo(16959.456, 8);
    expect(result.hits.map(hit => hit.nonCritical)).toEqual([
      expect.closeTo(8258.112, 8), expect.closeTo(1524.096, 8), expect.closeTo(1524.096, 8),
    ]);
    const reopened = applyCharacterConstellationScope(parseCalculatorDocument(
      serializeCalculatorDocument(convertCalculatorToFinalPanel(document)),
    ));
    expect(reopened.selectedHitIds).toEqual(document.selectedHitIds);
    expect(reopened.gameContext!.batchFiniteCast).toEqual(document.gameContext!.batchFiniteCast);
    expect(requirements(reopened)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
  });

  it.each([0, 1, 2])("single selected hit %i does not require future hits or a stable multi-hit panel", index => {
    let document = explicitPanel(fixture());
    document.scope = "single-hit";
    document.selectedHitIds = [document.hits[index]!.id];
    document = answer(answer(document, COMPLETE, "0"), STABLE, "0");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(index === 0 ? 8258.112 : 1524.096, 8);
    expect(document.gameContext!.batchFiniteCast).toMatchObject({ completeCastConfirmed: false, statsStableAcrossHits: false });
  });

  it("a partial multi-hit selection requires stability, but does not pretend to confirm the full three-hit branch", () => {
    let document = explicitPanel(fixture());
    document.selectedHitIds = document.hits.slice(0, 2).map(hit => hit.id);
    document = answer(document, COMPLETE, "0");
    expect(requirements(document).fields.map(field => field.fieldPath)).toEqual([STABLE]);
    document = answer(document, STABLE, "1");
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(9782.208, 8);
    expect(document.gameContext!.batchFiniteCast!.completeCastConfirmed).toBe(false);
  });

  it("round-trips false/unknown and restores missing legacy context as unanswered", () => {
    let document = answer(fixture(), COMPLETE, "0");
    document = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(document.gameContext!.batchFiniteCast!.completeCastConfirmed).toBe(false);
    expect(document.gameContext!.batchFiniteCast!.statsStableAcrossHits).toBeUndefined();
    expect(calculateDocument(document).status).toBe("blocked");
    delete document.gameContext!.batchFiniteCast;
    document = applyCharacterConstellationScope(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(requirements(document).fields.map(field => field.status)).toEqual(["input-required", "input-required"]);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("does not describe the C0 controls as a way to unlock an unsupported constellation", () => {
    let document = fixture();
    document.gameContext!.constellation = 1;
    document = answer(answer(document, COMPLETE, "1"), STABLE, "1");
    expect(requirements(document).fields).toEqual([]);
    expect(requirements(document).blockers.some(blocker => blocker.status === "unsupported" && blocker.reason.includes("C0"))).toBe(true);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("reports a missing rendered control and retains the original reason", () => {
    const document = fixture();
    const report = requirements(document, { isControlAvailable: () => false });
    expect(report.fields.every(field => field.status === "missing-control")).toBe(true);
    expect(report.blockers.every(blocker => blocker.status === "missing-control" && blocker.reason.includes("全部自身伤害实际命中"))).toBe(true);
  });

  it("does not collect for another action or an empty selection", () => {
    const document = fixture();
    document.gameContext!.skillId = "jean-skill";
    expect(jeanRequirementAdapter.applies(document)).toBe(false);
    expect(jeanRequirementAdapter.collect(document)).toEqual([]);
    const none = fixture();
    none.selectedHitIds = [];
    expect(requirements(none).fields).toEqual([]);
  });
});
