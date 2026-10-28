import { describe, expect, it } from "vitest";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { renderIdleStanceControls } from "./calculator-idle-stance-controls";
import { collectCalculatorRequirements } from "./calculator-requirements";

function fixture() {
  const document = getCharacterDocuments("character:10000075", 13)
    .find(candidate => candidate.gameContext?.skillId === "idle-wanderer-skill-c0")!;
  document.gameContext!.constellation = 6;
  document.scope = "single-hit";
  return applyCharacterConstellationScope(document);
}

describe("Wanderer initial E condition links", () => {
  it("links the two existing typed absorption controls and resumes only after explicit answers", () => {
    let document = fixture();
    const before = JSON.stringify(document), report = collectCalculatorRequirements(document);
    expect(JSON.stringify(document)).toBe(before);
    expect(report.fields.map(field => field.fieldPath)).toEqual([
      "gameContext.idleStanceCast.wanderer.noAbsorption",
      "gameContext.idleStanceCast.wanderer.panelExcludesAbsorptionBonuses",
    ]);
    for (const field of report.fields) {
      expect(field.status).toBe("input-required");
      expect(field.controlSelector).toBe(`select[data-source-cast-state-field="${field.fieldPath}"]`);
      expect(renderIdleStanceControls(document)).toContain(`data-source-cast-state-field="${field.fieldPath}"`);
    }
    expect(report.blockers).toHaveLength(1);
    expect(report.blockers[0]).toMatchObject({ status: "linked-controls", dependencyId: `idle-stance:${document.hits[0]!.id}` });
    expect(calculateDocument(document).status).toBe("blocked");
    document.gameContext!.idleStanceCast!.wanderer = { noAbsorption: true, panelExcludesAbsorptionBonuses: true };
    document = applyCharacterConstellationScope(document);
    expect(collectCalculatorRequirements(document)).toEqual({ fields: [], blockers: [] });
    expect(calculateDocument(document).status).toBe("calculated");
    expect(document.gameContext!.constellation).toBe(6);
    expect(document.gameContext!.effectiveTalentLevel).toBe(13);
  });

  it("retains a real absorbed condition as unsupported by this branch instead of changing it", () => {
    let document = fixture();
    document.gameContext!.idleStanceCast!.wanderer = { noAbsorption: false, panelExcludesAbsorptionBonuses: true };
    document = applyCharacterConstellationScope(document);
    const report = collectCalculatorRequirements(document);
    expect(report.fields).toEqual([expect.objectContaining({ fieldPath: "gameContext.idleStanceCast.wanderer.noAbsorption", status: "condition-not-satisfied" })]);
    expect(document.gameContext!.idleStanceCast!.wanderer!.noAbsorption).toBe(false);
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("does not imply that absorption answers can unlock a C6 complete stance", () => {
    const document = fixture();
    document.scope = "one-cast";
    const report = collectCalculatorRequirements(applyCharacterConstellationScope(document));
    expect(report.fields).toEqual([]);
    expect(report.blockers.some(blocker => blocker.status === "unsupported" && blocker.reason.includes("仅支持明确C0"))).toBe(true);
  });
});
