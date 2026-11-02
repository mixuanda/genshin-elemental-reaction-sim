import { describe, expect, it } from "vitest";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { neuvilletteProjectileRequirementAdapter } from "./calculator-projectile-requirements";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { applySourceCastControl, renderSourceCastControls } from "./calculator-source-cast-controls";

const COMPLETE = "neuvillette-skill-complete-cast-c0-arkhe-ready";
const PREFIX = "gameContext.batchProjectileCast";
const STABLE = `${PREFIX}.statsStableAcrossHits`;
const requirements = (document: CalculatorDocument, available?: (selector: string) => boolean) =>
  collectCalculatorRequirements(document, { adapters: [neuvilletteProjectileRequirementAdapter], ...(available ? { isControlAvailable: available } : {}) });
const prepare = applyCharacterConstellationScope;

function fixture(skillId = COMPLETE): CalculatorDocument {
  const document = getCharacterDocuments("character:10000087", 10).find(row => row.gameContext?.skillId === skillId)!;
  expect(document).toBeDefined();
  document.build = { mode: "manual-final", source: "Explicit requirement adapter fixture", ascension: 6,
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  return prepare(document);
}

function single(document = fixture(), index = 0): CalculatorDocument {
  document.scope = "single-hit";
  document.selectedHitIds = [document.hits[index]!.id];
  return prepare(document);
}

describe("Neuvillette existing projectile requirement controls", () => {
  it("reproduces the unlinked supported E hit, then links its existing controls without mutating input", () => {
    const document = single(), id = document.selectedHitIds[0]!;
    const dependencyId = `batch-projectile-cast:${id}`;
    const paths = [`${PREFIX}.hitStates.${id}.actualHpRatio`, `${PREFIX}.hitStates.${id}.includedHydroBonus`];
    expect(id).toBe(`${COMPLETE}-param1`);
    expect(calculateDocument(document).status).toBe("blocked");
    expect(collectCalculatorRequirements(document, { adapters: [] })).toEqual({ fields: [], blockers: [expect.objectContaining({
      dependencyId, status: "unsupported", fieldPaths: [],
    })] });

    const before = JSON.stringify(document), report = requirements(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(report.fields.map(field => field.fieldPath)).toEqual(paths);
    expect(report.blockers).toEqual([expect.objectContaining({ dependencyId, status: "linked-controls", fieldPaths: paths })]);
    expect(collectCalculatorRequirements(document)).toEqual(report);
    const controls = renderSourceCastControls(document);
    for (const field of report.fields) {
      expect(field).toMatchObject({ status: "input-required", hitIds: [id], dependencyIds: [dependencyId] });
      expect(field.controlSelector).toBe(`input[data-field="${field.fieldPath}"]`);
      expect(controls).toContain(`data-field="${field.fieldPath}"`);
    }
  });

  it("answers through the existing numeric controls and preserves explicit zero through JSON", () => {
    let document = single(fixture("neuvillette-skill"));
    const id = document.selectedHitIds[0]!;
    for (const [key, value] of [["actualHpRatio", "0.5"], ["includedHydroBonus", "0"]]) {
      applySourceCastControl(document, { dataset: { field: `${PREFIX}.hitStates.${id}.${key}` }, value } as unknown as HTMLInputElement);
    }
    document = prepare(document);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    // E10 HP coefficient, explicit 50% HP gives 12% A4 Hydro bonus.
    expect(result.totals!.nonCritical).toBeCloseTo(20000 * .231552 * 1.12 * .5 * .9, 8);
    const reopened = prepare(parseCalculatorDocument(serializeCalculatorDocument(document)));
    expect(reopened.gameContext!.batchProjectileCast!.hitStates![id]).toMatchObject({ actualHpRatio: .5, includedHydroBonus: 0 });
    expect(requirements(reopened)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
  });

  it.each([undefined, false])("does not use shared answers before stability is true (%s)", stable => {
    let document = fixture();
    document.gameContext!.batchProjectileCast = { statsStableAcrossHits: stable, sharedState: { actualHpRatio: 1, includedHydroBonus: 0 } };
    document = prepare(document);
    const report = requirements(document);
    expect(report.fields).toHaveLength(5);
    expect(report.fields[0]).toMatchObject({ fieldPath: STABLE, status: stable === undefined ? "input-required" : "condition-not-satisfied",
      dependencyIds: ["batch-projectile-cast:stable-other-context"] });
    expect(report.fields.slice(1).every(field => field.fieldPath.includes(".hitStates.") && field.hitIds.length === 1)).toBe(true);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("coalesces eligible shared omissions and honors per-hit overrides", () => {
    let document = fixture();
    document.gameContext!.batchProjectileCast = { statsStableAcrossHits: true };
    document = prepare(document);
    const report = requirements(document);
    expect(report.fields.map(field => field.fieldPath)).toEqual([`${PREFIX}.sharedState.actualHpRatio`, `${PREFIX}.sharedState.includedHydroBonus`]);
    expect(report.fields.every(field => field.hitIds.join() === document.selectedHitIds.join())).toBe(true);
    expect(report.fields.every(field => field.dependencyIds.join() === document.selectedHitIds.map(id => `batch-projectile-cast:${id}`).join())).toBe(true);

    const context = document.gameContext!.batchProjectileCast!;
    context.sharedState = { actualHpRatio: 1, includedHydroBonus: 0 };
    context.hitStates = { [document.hits[0]!.id]: { actualHpRatio: .5, includedHydroBonus: .12 } };
    document = prepare(document);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    // The first hit's explicit 12% already-included share overrides shared zero.
    expect(result.hits[0]!.nonCritical).toBeCloseTo(20000 * .231552 * .5 * .9, 8);
  });

  it("keeps a single selected hit independent of stability and unselected omissions", () => {
    let document = single(fixture(), 1);
    const id = document.selectedHitIds[0]!;
    document.gameContext!.batchProjectileCast = { statsStableAcrossHits: false,
      hitStates: { [id]: { actualHpRatio: 0, includedHydroBonus: 0 } } };
    document = prepare(document);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).status).toBe("calculated");
    expect(document.gameContext!.batchProjectileCast!.statsStableAcrossHits).toBe(false);
  });

  it("uses historical per-hit conditions and its own ascension rather than shared/current values", () => {
    let document = single();
    const hit = document.hits[0]!;
    if (hit.kind !== "ordinary" || document.build.mode !== "manual-final") throw new Error("Expected ordinary manual fixture");
    hit.finalSnapshot = { stats: { ...document.build.stats }, characterLevel: 90, ascension: 6, damageBonus: 0,
      additiveBaseDamage: 0, reactionBonus: 0, source: "Explicit historical sample", sourceRefs: ["fixture:historical-panel"] };
    document.build.ascension = 0;
    document.gameContext!.batchProjectileCast = { statsStableAcrossHits: true, sharedState: { actualHpRatio: 1, includedHydroBonus: 0 } };
    document = prepare(document);
    expect(requirements(document).fields.map(field => field.fieldPath)).toEqual([
      `${PREFIX}.hitStates.${hit.id}.actualHpRatio`, `${PREFIX}.hitStates.${hit.id}.includedHydroBonus`,
    ]);
    const historical = document.hits[0]!;
    if (historical.kind !== "ordinary") throw new Error("Expected ordinary historical fixture");
    historical.finalSnapshot!.ascension = 0;
    document = prepare(document);
    expect(requirements(document).fields.map(field => field.fieldPath)).toEqual([`${PREFIX}.hitStates.${hit.id}.includedHydroBonus`]);
  });

  it("requires no HP condition before A4 is unlocked and retains unanswered accounting", () => {
    let document = single();
    if (document.build.mode !== "manual-final") throw new Error("Expected manual fixture");
    document.build.ascension = 0;
    document = prepare(document);
    expect(requirements(document).fields.map(field => field.fieldPath)).toEqual([
      `${PREFIX}.hitStates.${document.selectedHitIds[0]}.includedHydroBonus`,
    ]);
  });

  it("coalesces unknown actual ascension and accepts an explicitly locked A4 without inventing HP", () => {
    let document = fixture();
    if (document.build.mode !== "manual-final") throw new Error("Expected manual fixture");
    delete document.build.ascension;
    delete document.gameContext!.ascension;
    document.gameContext!.batchProjectileCast = { statsStableAcrossHits: true, sharedState: { includedHydroBonus: 0 } };
    document = prepare(document);
    const before = JSON.stringify(document), report = requirements(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(report.fields.map(field => field.fieldPath)).toEqual(["build.ascension", `${PREFIX}.sharedState.actualHpRatio`]);
    expect(report.fields[0]).toMatchObject({ controlSelector: "#calc-ascension", status: "input-required",
      hitIds: document.selectedHitIds, dependencyIds: document.selectedHitIds.map(id => `batch-projectile-cast:${id}`) });
    expect(calculateDocument(document).status).toBe("blocked");

    // The existing #calc-ascension handler writes build.ascension for final panels.
    if (document.build.mode !== "manual-final") throw new Error("Expected manual fixture");
    document.build.ascension = 0;
    document = prepare(document);
    expect(requirements(document)).toEqual({ fields: [], blockers: [] });
    expect(document.gameContext!.batchProjectileCast!.sharedState!.actualHpRatio).toBeUndefined();
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("reports missing rendered controls and does not claim Q, another actor, or unsupported constellations", () => {
    const document = single(), report = requirements(document, () => false);
    expect(report.fields.every(field => field.status === "missing-control")).toBe(true);
    expect(report.blockers).toEqual([expect.objectContaining({ status: "missing-control", reason: expect.stringContaining("实际生命比例") })]);
    for (const change of [
      { skillId: "neuvillette-burst" }, { characterId: "character:10000076" }, { constellation: 1 },
    ]) {
      const other = structuredClone(document);
      Object.assign(other.gameContext!, change);
      expect(neuvilletteProjectileRequirementAdapter.collect(other)).toEqual([]);
    }
    document.selectedHitIds = [];
    expect(neuvilletteProjectileRequirementAdapter.collect(document)).toEqual([]);
  });
});
