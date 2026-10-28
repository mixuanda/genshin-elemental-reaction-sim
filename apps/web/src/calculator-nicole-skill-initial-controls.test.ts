import { describe, expect, it } from "vitest";
import type { NicoleSkillInitialDocument } from "../../../packages/sim-core/src/nicole-skill-initial-formulas";
import { nicoleSkillInitialRequirementAdapter, renderNicoleSkillInitialControls, updateNicoleSkillInitialControl } from "./calculator-nicole-skill-initial-controls";
const fixture = () => ({ dataIdentity: { releaseStatus: "released" }, scope: "single-hit", selectedHitIds: ["nicole-skill-hit"],
  gameContext: { characterId: "character:10000131", abilityId: "talent:nicole:combat2", skillId: "nicole-skill",
    constellation: 2, ascension: 6, nicoleSkillInitial: {} },
  build: { mode: "manual-final" }, hits: [{ kind: "ordinary", id: "nicole-skill-hit" }] } as unknown as NicoleSkillInitialDocument);
describe("Nicole initial E player controls", () => {
  it("links all unknown inputs to controls, without asking an already proved C2 range or doubling the weapon sample", () => {
    const doc = fixture(), before = JSON.stringify(doc), html = renderNicoleSkillInitialControls(doc);
    const fields = nicoleSkillInitialRequirementAdapter.collect(doc);
    expect(fields).toHaveLength(7);
    for (const row of fields) {
      const attribute = row.controlSelector.includes("input[") ? "data-field" : "data-source-cast-state-field";
      expect(html).toContain(`${attribute}="${row.fieldPath}"`); expect(row.status).toBe("input-required");
    }
    expect(fields.some(row => row.fieldPath.endsWith("targetInC2AreaAtInitial"))).toBe(false);
    expect(fields.filter(row => row.fieldPath.endsWith("skillGrantNonExtraAttack"))).toHaveLength(1);
    expect(html).toContain("妮可"); expect(html).toContain("同击减抗"); expect(JSON.stringify(doc)).toBe(before);
  });
  it("preserves actual zero and false while an unknown observation remains missing", () => {
    const doc = fixture(), prefix = "gameContext.nicoleSkillInitial.";
    updateNicoleSkillInitialControl(doc, prefix + "skillGrantNonExtraAttack", "0");
    updateNicoleSkillInitialControl(doc, prefix + "includedSkillAttack", "0");
    updateNicoleSkillInitialControl(doc, prefix + "c2AttackIncludedInPanel", "0");
    updateNicoleSkillInitialControl(doc, prefix + "noDisplacementBeforeInitial", "0");
    const reopened = JSON.parse(JSON.stringify(doc)) as NicoleSkillInitialDocument;
    expect(reopened.gameContext.nicoleSkillInitial).toMatchObject({ skillGrantNonExtraAttack: 0, grantAttackSource: "observed",
      includedSkillAttack: 0, c2AttackIncludedInPanel: false, noDisplacementBeforeInitial: false });
    const fields = nicoleSkillInitialRequirementAdapter.collect(reopened);
    expect(fields.some(row => row.fieldPath.endsWith("skillGrantNonExtraAttack"))).toBe(false);
    expect(fields).toEqual(expect.arrayContaining([expect.objectContaining({ fieldPath: prefix + "noDisplacementBeforeInitial", status: "condition-not-satisfied" })]));
    updateNicoleSkillInitialControl(reopened, prefix + "noDisplacementBeforeInitial", "unknown");
    expect(reopened.gameContext.nicoleSkillInitial!.noDisplacementBeforeInitial).toBeUndefined();
    expect(() => updateNicoleSkillInitialControl(reopened, prefix + "skillGrantNonExtraAttack", "NaN")).toThrow();
  });
  it("shows a contradictory range record as unsatisfied and refuses to present this as a complete skill", () => {
    const doc = fixture(); doc.gameContext.nicoleSkillInitial!.targetInC2AreaAtInitial = false;
    expect(nicoleSkillInitialRequirementAdapter.collect(doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: "gameContext.nicoleSkillInitial.targetInC2AreaAtInitial", status: "condition-not-satisfied" }),
    ]));
    expect(renderNicoleSkillInitialControls(doc)).toContain('data-source-cast-state-field="gameContext.nicoleSkillInitial.targetInC2AreaAtInitial"');
    doc.scope = "one-cast"; expect(nicoleSkillInitialRequirementAdapter.applies(doc)).toBe(false);
    expect(renderNicoleSkillInitialControls(doc)).toBe(""); expect(nicoleSkillInitialRequirementAdapter.collect(doc)).toEqual([]);
  });
});
