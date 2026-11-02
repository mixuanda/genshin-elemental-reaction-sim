import { describe, expect, it } from "vitest";
import { FARUZAN_BURST_INITIAL_HIT_ID as ID, FARUZAN_BURST_INITIAL_SKILL_ID as SKILL,
  type FaruzanBurstInitialDocument } from "../../../packages/sim-core/src/faruzan-burst-initial-formulas";
import { faruzanBurstInitialRequirementAdapter, renderFaruzanBurstInitialControls, updateFaruzanBurstInitialControl } from "./calculator-faruzan-burst-initial-controls";
const fixture = () => ({ dataIdentity: { releaseStatus: "released" }, scope: "single-hit", selectedHitIds: [ID],
  gameContext: { characterId: "character:10000076", abilityId: "talent:faruzan:combat3", skillId: SKILL,
    constellation: 6, ascension: 6, faruzanBurstInitial: {} },
  build: { mode: "manual-final" }, hits: [{ kind: "ordinary", id: ID }] } as unknown as FaruzanBurstInitialDocument);
describe("Faruzan initial Q player controls", () => {
  it("links every requested field to a real control and derives C6 activity instead of asking it", () => {
    const doc = fixture(), before = JSON.stringify(doc), html = renderFaruzanBurstInitialControls(doc);
    const fields = faruzanBurstInitialRequirementAdapter.collect(doc);
    expect(fields).toHaveLength(8);
    for (const field of fields) {
      const attribute = field.controlSelector.includes("input[") ? "data-field" : "data-source-cast-state-field";
      expect(html).toContain(`${attribute}="${field.fieldPath}"`);
      expect(field.status).toBe("input-required");
    }
    expect(fields.some(field => field.fieldPath.endsWith("c6Active"))).toBe(false);
    expect(html).toContain("珐露珊"); expect(html).toContain("40%风伤暴伤"); expect(JSON.stringify(doc)).toBe(before);
  });
  it("retains unknown, explicit false and legal zero through handler and JSON reopen", () => {
    const doc = fixture(), prefix = "gameContext.faruzanBurstInitial.";
    expect(updateFaruzanBurstInitialControl(doc, prefix + "includedA4BaseDamage", "0")).toBe(true);
    updateFaruzanBurstInitialControl(doc, prefix + "insideBurstArea", "0");
    updateFaruzanBurstInitialControl(doc, prefix + "c6CritDamageIncludedInPanel", "0");
    const saved = JSON.parse(JSON.stringify(doc)) as FaruzanBurstInitialDocument;
    expect(saved.gameContext.faruzanBurstInitial).toMatchObject({ includedA4BaseDamage: 0, insideBurstArea: false, c6CritDamageIncludedInPanel: false });
    expect(faruzanBurstInitialRequirementAdapter.collect(saved)).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: prefix + "insideBurstArea", status: "condition-not-satisfied" }),
    ]));
    expect(faruzanBurstInitialRequirementAdapter.collect(saved).some(field => field.fieldPath.endsWith("includedA4BaseDamage"))).toBe(false);
    updateFaruzanBurstInitialControl(saved, prefix + "insideBurstArea", "unknown");
    expect(saved.gameContext.faruzanBurstInitial!.insideBurstArea).toBeUndefined();
    expect(() => updateFaruzanBurstInitialControl(saved, prefix + "baseAttack", "-1")).toThrow();
    expect(() => updateFaruzanBurstInitialControl(saved, prefix + "insideBurstArea", "yes")).toThrow();
  });
  it("does not expose this adapter as a way to unlock a complete C6 Q", () => {
    const doc = fixture(); doc.scope = "one-cast";
    expect(faruzanBurstInitialRequirementAdapter.applies(doc)).toBe(false);
    expect(faruzanBurstInitialRequirementAdapter.collect(doc)).toEqual([]);
    expect(renderFaruzanBurstInitialControls(doc)).toBe("");
  });
});
