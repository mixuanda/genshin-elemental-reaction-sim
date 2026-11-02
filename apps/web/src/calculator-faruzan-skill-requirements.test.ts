import { describe, expect, it } from "vitest";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { FARUZAN_HURRICANE_ACTION, faruzanSkillRequirementAdapter } from "./calculator-faruzan-skill-requirements";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { renderSourceCastControls, applySourceCastControl } from "./calculator-source-cast-controls";

const prefix = "gameContext.finiteFollowupCast";
const prepare = applyCharacterConstellationScope;
function fixture(): CalculatorDocument {
  const doc = getCharacterDocuments("character:10000076", 1).find(row => row.gameContext?.skillId === FARUZAN_HURRICANE_ACTION)!;
  doc.build = { mode: "manual-final", source: "explicit synthetic condition fixture", ascension: 6,
    stats: { atk: 1000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  return prepare(doc);
}
function answer(doc: CalculatorDocument): CalculatorDocument {
  const context = doc.gameContext!.finiteFollowupCast!;
  Object.assign(context, { normalTalentLevel: 2, faruzanFreshNoPriorEffects: true, faruzanHurricaneStartFrame: 35,
    statsStableAcrossHits: true, completeCastConfirmed: true, noHitlag: true, noReplacement: true, noInterruption: true });
  for (const hit of doc.hits) context.hitStates![hit.id] = { includedDamageBonus: 0, includedAdditiveBase: 0, includedResistanceReduction: 0 };
  return prepare(doc);
}
describe("Faruzan C0 Hurricane in-place requirements", () => {
  it("reproduces unlinked conditions and links every required existing control without mutating state", () => {
    const doc = fixture(), before = JSON.stringify(doc);
    expect(calculateDocument(doc).status).toBe("blocked");
    expect(collectCalculatorRequirements(doc, { adapters: [] }).blockers.every(row => row.status === "unsupported")).toBe(true);
    const report = collectCalculatorRequirements(doc);
    expect(JSON.stringify(doc)).toBe(before);
    expect(report.fields.every(field => field.adapterId === faruzanSkillRequirementAdapter.id)).toBe(true);
    expect(report.fields).toHaveLength(17);
    expect(report.blockers.every(row => row.status === "linked-controls")).toBe(true);
    const html = renderSourceCastControls(doc);
    for (const field of report.fields) expect(html).toContain(field.controlSelector.slice(field.controlSelector.indexOf("[") + 1, -1));
  });
  it("uses E1 and independent normal2, preserves zeros and 14/94/127-frame labels through save/reopen", () => {
    const doc = answer(fixture()), result = calculateDocument(doc);
    expect(collectCalculatorRequirements(doc)).toEqual({ fields: [], blockers: [] });
    expect(result.status).toBe("calculated");
    expect(result.hits.map(hit => hit.nonCritical)).toEqual([1.488, 1.333, 1.08].map(coefficient => coefficient * 1000 * .5 * .9));
    expect(result.totals!.nonCritical).toBeCloseTo((1.488 + 1.333 + 1.08) * 1000 * .5 * .9, 8);
    expect(doc.hits.map(hit => hit.label)).toEqual([expect.stringContaining("14帧"), expect.stringContaining("94帧"), expect.stringContaining("127帧")]);
    const reopened = prepare(parseCalculatorDocument(serializeCalculatorDocument(doc)));
    expect(calculateDocument(reopened).totals).toEqual(result.totals);
    expect(reopened.gameContext!.finiteFollowupCast!.normalTalentLevel).toBe(2);
    expect(reopened.gameContext!.finiteFollowupCast!.hitStates).toEqual(doc.gameContext!.finiteFollowupCast!.hitStates);
  });
  it("keeps the initial hit independent of a future arrow's level, frame and full-cast answers", () => {
    let doc = answer(fixture()); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
    const context = doc.gameContext!.finiteFollowupCast!;
    delete context.normalTalentLevel; delete context.faruzanHurricaneStartFrame;
    for (const key of ["statsStableAcrossHits", "completeCastConfirmed", "noHitlag", "noReplacement", "noInterruption"] as const) context[key] = false;
    for (const hit of doc.hits.slice(1)) delete context.hitStates![hit.id];
    doc = prepare(doc);
    expect(collectCalculatorRequirements(doc)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(1.488 * 1000 * .5 * .9, 8);
  });
  it("rejects false freshness and out-of-window frames, and never treats blank accounting as zero", () => {
    let doc = answer(fixture());
    doc.gameContext!.finiteFollowupCast!.faruzanFreshNoPriorEffects = false;
    doc.gameContext!.finiteFollowupCast!.faruzanHurricaneStartFrame = 34;
    const fieldPath = `${prefix}.hitStates.${doc.hits[1]!.id}.includedAdditiveBase`;
    applySourceCastControl(doc, { dataset: { field: fieldPath }, value: "" } as unknown as HTMLInputElement);
    doc = prepare(doc);
    const report = collectCalculatorRequirements(doc);
    expect(report.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: `${prefix}.faruzanFreshNoPriorEffects`, status: "condition-not-satisfied" }),
      expect.objectContaining({ fieldPath: `${prefix}.faruzanHurricaneStartFrame`, status: "condition-not-satisfied" }),
      expect.objectContaining({ fieldPath, status: "input-required" }),
    ]));
    expect(calculateDocument(doc).status).toBe("blocked");
    expect(calculateDocument(doc).totals).toBeUndefined();
  });
  it("respects final resistance overrides and does not claim C1 or unrelated Q coverage", () => {
    let doc = answer(fixture());
    const hit = doc.hits[0]!; if (hit.kind !== "ordinary") throw new Error("ordinary hit required");
    hit.effectiveResistance = .1; delete doc.gameContext!.finiteFollowupCast!.hitStates![hit.id]!.includedResistanceReduction;
    doc = prepare(doc);
    expect(collectCalculatorRequirements(doc)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(doc).status).toBe("calculated");
    doc.gameContext!.constellation = 1;
    expect(faruzanSkillRequirementAdapter.collect(doc)).toEqual([]);
    expect(calculateDocument(prepare(doc)).status).toBe("blocked");
    doc.gameContext!.skillId = "finite-followup-faruzan-burst-fresh-c0";
    expect(faruzanSkillRequirementAdapter.applies(doc)).toBe(false);
  });
});
