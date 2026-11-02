import { describe, expect, it } from "vitest";
import { getCharacterDocuments, applyCharacterConstellationScope } from "./character-calculations";
import { parseCalculatorDocument, serializeCalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import { resetSourceCastPanelAccounting } from "../../../packages/sim-core/src/source-cast-context";
import { renderSourceCastControls } from "./calculator-source-cast-controls";
import { collectCalculatorRequirements } from "./calculator-requirements";

const fresh = () => {
  const doc = getCharacterDocuments("character:10000076", 13).find(row => row.gameContext?.skillId === "finite-followup-faruzan-burst-fresh-c0")!;
  expect(doc.gameContext?.faruzanBurstInitial).toBeDefined();
  doc.gameContext!.constellation = 6;
  doc.build = { mode: "manual-final", stats: { atk: 2000, hp: 10000, def: 700, em: 0, critRate: .5, critDamage: 1 }, source: "explicit independent arithmetic fixture" };
  resetSourceCastPanelAccounting(doc, "fresh-equipment");
  Object.assign(doc.gameContext!.faruzanBurstInitial!, { freshBurstNoPriorEffects: true, insideBurstArea: true, noOtherAnemoBeforeInitial: true, baseAttack: 1000 });
  return applyCharacterConstellationScope(doc);
};

describe("public Faruzan C6 Q initial calculator route", () => {
  it("uses the registered schema, constellation gate and shared formula through save/reopen", () => {
    const doc = fresh(), reopened = parseCalculatorDocument(serializeCalculatorDocument(doc));
    expect(reopened.gameContext?.faruzanBurstInitial).toEqual(doc.gameContext?.faruzanBurstInitial);
    expect(reopened.gameContext?.finiteFollowupCast).toBeUndefined();
    const result = calculateDocument(reopened);
    expect(result.status, result.blockers.join("\n")).toBe("calculated");
    // Q13=8.024, A4=320, Q bonus=.3825, same-level DEF=.5, RES=.9, C6 CD=1+.4.
    expect(result.totals?.nonCritical).toBeCloseTo(10182.942, 8);
    expect(result.totals?.critical).toBeCloseTo(24439.0608, 8);
    expect(result.totals?.expected).toBeCloseTo(17311.0014, 8);
    expect(reopened.gameContext!.effectiveTalentLevel).toBe(13);
  });
  it("links missing conditions to real controls and does not silently migrate a context-free save", () => {
    const doc = fresh(); delete doc.gameContext!.faruzanBurstInitial!.insideBurstArea;
    const fields = collectCalculatorRequirements(doc).fields;
    expect(fields).toEqual(expect.arrayContaining([expect.objectContaining({ fieldPath: "gameContext.faruzanBurstInitial.insideBurstArea", adapterId: "faruzan-burst-initial-conditions", status: "input-required" })]));
    expect(renderSourceCastControls(doc)).toContain('data-source-cast-state-field="gameContext.faruzanBurstInitial.insideBurstArea"');
    expect(calculateDocument(doc).status).toBe("blocked");
    delete doc.gameContext!.faruzanBurstInitial;
    const saved = serializeCalculatorDocument(doc), reopened = parseCalculatorDocument(saved);
    expect(reopened.gameContext!.faruzanBurstInitial).toBeUndefined();
    expect(calculateDocument(reopened).status).toBe("blocked");
    expect(serializeCalculatorDocument(reopened)).toBe(saved);
  });
});
