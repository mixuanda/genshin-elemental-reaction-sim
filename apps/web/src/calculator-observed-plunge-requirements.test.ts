import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "./character-calculations";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { prepareSourceCastDocument } from "../../../packages/sim-core/src/source-cast-context";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { observedPlungeRequirementAdapter } from "./calculator-observed-plunge-requirements";
import { applyObservedPlungeSnapshotDraft, renderObservedPlungeControls, resetObservedPlungeSnapshotDraft } from "./calculator-observed-plunge-controls";

function fixture(height: "low" | "high" = "low"): CalculatorDocument {
  const document = getCharacterDocuments("character:10000100", 10)
    .find(candidate => candidate.gameContext?.skillId === `kachina-plunge-${height}-with-collision`)!;
  document.build = { mode: "manual-final", source: "Synthetic physical ATK plunge; not a UID or native capture",
    stats: { atk: 1000, hp: 10000, def: 700, em: 0, critRate: 0, critDamage: 0.5 } };
  document.characterLevel = 90;
  document.enemy = { level: 90, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 };
  return document;
}
const prepare = (document: CalculatorDocument) => prepareSourceCastDocument(document);
const report = (document: CalculatorDocument) => {
  const html = renderObservedPlungeControls(document);
  return collectCalculatorRequirements(document, { adapters: [observedPlungeRequirementAdapter],
    isControlAvailable(selector) {
      const match = /\[(data-[a-z-]+)="([^"]+)"\]/.exec(selector);
      return Boolean(match && html.includes(`${match[1]}="${match[2]}"`));
    } });
};
const known = (document: CalculatorDocument, collisionCount = 1, landingContact = true) => {
  document.gameContext!.observedPlunge = { noExternalInfusion: true, collisionCount,
    collisionContacts: Object.fromEntries(Array.from({ length: collisionCount }, (_, index) => [String(index + 1), true])),
    landingContact, statsStableAcrossHits: true };
  return prepare(document);
};

describe("observed plunge requirement links and Kachina controls", () => {
  it("links existing controls to the original blocker without guessing missing observations", () => {
    const document = prepare(fixture()), original = JSON.stringify(document);
    const fields = report(document);
    expect(fields.fields.map(field => field.fieldPath)).toEqual([
      "gameContext.observedPlunge.noExternalInfusion", "gameContext.observedPlunge.collisionCount", "gameContext.observedPlunge.landingContact",
    ]);
    expect(fields.fields.every(field => field.status === "input-required")).toBe(true);
    expect(fields.blockers).toEqual([expect.objectContaining({ dependencyId: "observed-plunge:schedule", status: "linked-controls" })]);
    expect(fields.blockers[0]!.reason).toContain("实际途中碰撞机会次数");
    expect(calculateDocument(document).status).toBe("blocked");
    expect(JSON.stringify(document)).toBe(original);
    expect(renderObservedPlungeControls(document)).toContain('data-field="gameContext.observedPlunge.collisionCount"');
  });

  it.each([
    { height: "low" as const, coefficient: 2.527025 },
    { height: "high" as const, coefficient: 3.15639 },
  ])("accepts observed zero collision opportunities and the actual $height landing", ({ height, coefficient }) => {
    const document = known(fixture(height), 0), result = calculateDocument(document);
    expect(report(document)).toEqual({ fields: [], blockers: [] });
    expect(document.hits.map(hit => hit.id)).toEqual([`${document.gameContext!.skillId}:landing`]);
    expect(result.totals!.nonCritical).toBeCloseTo(450 * coefficient, 10);
    const html = renderObservedPlungeControls(document);
    expect(html).toContain('data-optional-number value="0"');
    expect(html).not.toContain('data-source-cast-state-field="gameContext.observedPlunge.collisionContacts.1"');
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document))).totals).toEqual(result.totals);
  });

  it.each([
    { height: "low" as const, coefficient: 2.527025 },
    { height: "high" as const, coefficient: 3.15639 },
  ])("uses each actual collision contact for $height and preserves the result after reopen", ({ height, coefficient }) => {
    const input = fixture(height);
    input.gameContext!.observedPlunge = { noExternalInfusion: true, collisionCount: 3,
      collisionContacts: { "1": true, "2": false, "3": true }, landingContact: true, statsStableAcrossHits: true };
    const document = prepare(input), result = calculateDocument(document);
    expect(report(document)).toEqual({ fields: [], blockers: [] });
    expect(document.hits.map(hit => hit.id.split(":").at(-1))).toEqual(["collision-1", "collision-3", "landing"]);
    expect(result.totals!.nonCritical).toBeCloseTo(450 * (2 * 1.26378 + coefficient), 10);
    const reopened = parseCalculatorDocument(serializeCalculatorDocument(document));
    expect(reopened.gameContext!.observedPlunge!.collisionContacts!["2"]).toBe(false);
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
  });

  it("keeps unknown contact blocked, explicit misses valid and actual all-miss damage zero", () => {
    const input = fixture();
    input.gameContext!.observedPlunge = { noExternalInfusion: true, collisionCount: 2,
      collisionContacts: { "1": false }, landingContact: false };
    const unknown = prepare(input);
    expect(report(unknown).fields.map(field => field.fieldPath)).toEqual(["gameContext.observedPlunge.collisionContacts.2"]);
    expect(calculateDocument(unknown).totals).toBeUndefined();
    input.gameContext!.observedPlunge!.collisionContacts!["2"] = false;
    const missed = prepare(input), zero = calculateDocument(missed);
    expect(report(missed)).toEqual({ fields: [], blockers: [] });
    expect(missed.hits.map(hit => hit.kind)).toEqual(["non-damaging"]);
    expect(zero.status).toBe("calculated");
    // The existing contract describes known no-damage states without inventing
    // a numerical subtotal; unknown contacts remain blocked above.
    expect(zero.totals).toBeUndefined();
    expect(zero.blockers).toEqual([]);
    expect(zero.hits[0]!.status).toBe("non-damaging");
    expect(zero.hits[0]!.trace[0]!.applicabilityReason).toContain("已观察所有途中碰撞及落地均未接触此目标");
    const reopenedMiss = parseCalculatorDocument(serializeCalculatorDocument(missed));
    expect(reopenedMiss.gameContext!.observedPlunge!.collisionContacts).toEqual({ "1": false, "2": false });
    expect(reopenedMiss.gameContext!.observedPlunge!.landingContact).toBe(false);
    expect(calculateDocument(reopenedMiss).hits).toEqual(zero.hits);
    delete input.gameContext!.observedPlunge!.collisionCount;
    expect(report(prepare(input)).fields.map(field => field.fieldPath)).toEqual(["gameContext.observedPlunge.collisionCount"]);
    expect(calculateDocument(input).status).toBe("blocked");
  });

  it("distinguishes unknown from an explicitly unsatisfied physical condition", () => {
    const document = known(fixture(), 0);
    delete document.gameContext!.observedPlunge!.noExternalInfusion;
    expect(report(prepare(document)).fields).toEqual([expect.objectContaining({ status: "input-required" })]);
    document.gameContext!.observedPlunge!.noExternalInfusion = false;
    expect(report(prepare(document)).fields).toEqual([expect.objectContaining({ status: "condition-not-satisfied" })]);
    expect(calculateDocument(document).status).toBe("blocked");
    expect(document.gameContext!.observedPlunge!.noExternalInfusion).toBe(false);
  });

  it("does not request unselected future contacts after switching a prepared action to one hit", () => {
    let document = known(fixture());
    document.scope = "single-hit";
    document.selectedHitIds = [document.hits.find(hit => hit.id.endsWith(":collision-1"))!.id];
    document.gameContext!.observedPlunge = {};
    document = prepare(document);
    expect(report(document).fields.map(field => field.fieldPath)).toEqual(["gameContext.observedPlunge.noExternalInfusion"]);
    document.gameContext!.observedPlunge!.noExternalInfusion = true;
    document = prepare(document);
    expect(report(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(568.701, 10);
    expect(renderObservedPlungeControls(document)).not.toContain('data-field="gameContext.observedPlunge.collisionCount"');
  });

  it("renders Kachina historical snapshot rows and the separate target stability control", () => {
    const document = known(fixture());
    document.gameContext!.observedPlunge!.statsStableAcrossHits = false;
    const html = renderObservedPlungeControls(document), fields = report(document).fields;
    expect(html).toContain('data-observed-plunge-snapshot-row="kachina-plunge-low-with-collision:collision-1"');
    expect(html).toContain('data-observed-plunge-snapshot-row="kachina-plunge-low-with-collision:landing"');
    expect(html).toContain('data-source-cast-state-field="gameContext.observedPlunge.targetConditionsStableAcrossHits"');
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: "gameContext.observedPlunge.statsStableAcrossHits", status: "condition-not-satisfied" }),
      expect.objectContaining({ fieldPath: "gameContext.observedPlunge.targetConditionsStableAcrossHits", status: "input-required" }),
    ]));
    expect(fields.some(field => field.status === "missing-control")).toBe(false);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("uses individually supplied historical ATK snapshots without inventing stable or zero inputs", () => {
    let document = known(fixture("high"));
    document.gameContext!.observedPlunge!.statsStableAcrossHits = false;
    resetObservedPlungeSnapshotDraft(document);
    const makeRoot = (blank = false): HTMLElement => ({ querySelectorAll: () => document.hits.map((hit, index) => ({
      dataset: { observedPlungeSnapshotRow: hit.id },
      querySelectorAll: () => Object.entries({ "stats.atk": blank ? "" : String(1000 + index * 1000),
        "stats.hp": "10000", "stats.def": "700", "stats.em": "0", "stats.critRate": "0", "stats.critDamage": "0.5",
        "stats.energyRecharge": "", characterLevel: "90", ascension: "6", damageBonus: "0", additiveBaseDamage: "0", reactionBonus: "0",
        source: `Synthetic historical snapshot ${index + 1}; not a game measurement`, sourceRefs: "fixture:kachina-plunge-history",
      }).map(([key, value]) => ({ dataset: { observedPlungeSnapshotKey: key }, value })),
    })) }) as unknown as HTMLElement;
    expect(() => applyObservedPlungeSnapshotDraft(document, makeRoot(true))).toThrow(/未知不可当作零/);
    expect(document.hits.every(hit => hit.kind !== "ordinary" || hit.finalSnapshot === undefined)).toBe(true);
    applyObservedPlungeSnapshotDraft(document, makeRoot());
    document = prepare(document);
    expect(report(document).fields.map(field => field.fieldPath)).toEqual(["gameContext.observedPlunge.targetConditionsStableAcrossHits"]);
    expect(calculateDocument(document).status).toBe("blocked");
    document.gameContext!.observedPlunge!.targetConditionsStableAcrossHits = true;
    document = prepare(document);
    const result = calculateDocument(document);
    expect(report(document)).toEqual({ fields: [], blockers: [] });
    expect(result.totals!.nonCritical).toBeCloseTo(0.45 * (1000 * 1.26378 + 2000 * 3.15639), 10);
    const reopened = parseCalculatorDocument(serializeCalculatorDocument(document));
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
    reopened.build = { mode: "manual-final", source: "Unrelated current panel", stats: { atk: 9999, hp: 9999, def: 9999, em: 999, critRate: 1, critDamage: 9 } };
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
    document.gameContext!.observedPlunge!.targetConditionsStableAcrossHits = false;
    expect(calculateDocument(document).status).toBe("blocked");
    expect(report(document).fields).toEqual([expect.objectContaining({ status: "condition-not-satisfied" })]);
    resetObservedPlungeSnapshotDraft(document);
  });

  it("rejects invalid counts and leaves unrelated or unselected actions alone", () => {
    for (const count of [-1, 1.5, 65]) {
      const document = fixture(); document.gameContext!.observedPlunge = { collisionCount: count };
      expect(() => prepare(document)).toThrow();
      expect(() => observedPlungeRequirementAdapter.collect(document)).toThrow();
    }
    const unrelated = getCharacterDocuments("character:10000100", 10).find(document => document.gameContext?.skillId === "kachina-normal-1")!;
    expect(observedPlungeRequirementAdapter.applies(unrelated)).toBe(false);
    expect(observedPlungeRequirementAdapter.collect(unrelated)).toEqual([]);
    const unselected = prepare(fixture()); unselected.selectedHitIds = [];
    expect(observedPlungeRequirementAdapter.collect(unselected)).toEqual([]);
  });
});
