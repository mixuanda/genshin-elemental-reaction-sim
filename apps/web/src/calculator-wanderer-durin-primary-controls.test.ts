import { describe, expect, it } from "vitest";
import { renderWandererPrimaryControls, wandererPrimaryRequirementAdapter } from "./calculator-wanderer-primary-controls";
import { renderDurinBurstControls, durinBurstRequirementAdapter } from "./calculator-durin-burst-controls";
import { wandererEntryFixture, durinEntryFixture } from "../../../packages/sim-core/src/wanderer-durin-entry-test-support";
import { prepareWandererPrimaryDocument } from "../../../packages/sim-core/src/wanderer-primary-formulas";
import { prepareDurinBurstDocument } from "../../../packages/sim-core/src/durin-burst-formulas";

describe("player-facing Wanderer/Durin actual-hit condition links", () => {
  it("links missing independent E/absorption/accounting fields to existing generic event paths without claiming no absorption", () => {
    const doc = wandererEntryFixture(); doc.gameContext.wandererPrimary = {};
    const html = renderWandererPrimaryControls(doc), before = JSON.stringify(doc), fields = wandererPrimaryRequirementAdapter.collect(doc);
    expect(JSON.stringify(doc)).toBe(before);
    expect(fields.map(f => f.fieldPath)).toEqual(["skillTalentLevel", "absorptionBonuses", "pyroAttackIncludedPercent", "cryoCritRateIncludedPercent"].map(k => "gameContext.wandererPrimary." + k));
    for (const field of fields) expect(html).toContain(field.controlSelector.match(/\[([^\]]+)\]/)![1]!);
    expect(html).toContain("均未生效（水／雷增益仍可存在）"); expect(html).not.toContain("没有吸收");
    expect(prepareWandererPrimaryDocument(doc).dependencies.some(dep => dep.status === "missing")).toBe(true);
  });
  it("keeps false C6/complete-Q conditions linked and offers actual Q controls without requiring a full future schedule", () => {
    const extra = wandererEntryFixture("wanderer-windfavored-c6-normal-1"); extra.gameContext.wandererPrimary!.c6ParentQualified = false;
    expect(wandererPrimaryRequirementAdapter.collect(extra)).toContainEqual(expect.objectContaining({fieldPath: "gameContext.wandererPrimary.c6ParentQualified", status: "condition-not-satisfied"}));
    const q = wandererEntryFixture("wanderer-kyougen-five-hits"); delete q.gameContext.wandererPrimary!.burstC2ConsumedPointsUpTo50; q.gameContext.wandererPrimary!.burstAllHitsConnected = false;
    expect(wandererPrimaryRequirementAdapter.collect(q)).toContainEqual(expect.objectContaining({fieldPath: "gameContext.wandererPrimary.burstC2ConsumedPointsUpTo50"}));
    expect(wandererPrimaryRequirementAdapter.collect(q)).toContainEqual(expect.objectContaining({fieldPath: "gameContext.wandererPrimary.burstAllHitsConnected", status: "condition-not-satisfied"}));
    expect(renderWandererPrimaryControls(q)).toContain("五击均已实际命中同一目标");
    expect(renderWandererPrimaryControls(q)).not.toContain("followupActions");
  });
  it("links actual Durin tick/C2 requirements, derives A4 without a user multiplier and supports filled answers", () => {
    const doc = durinEntryFixture(); doc.gameContext.durinBurst = {};
    const html = renderDurinBurstControls(doc), fields = durinBurstRequirementAdapter.collect(doc);
    expect(fields).toHaveLength(3);
    for (const field of fields) expect(html).toContain(field.controlSelector.match(/\[([^\]]+)\]/)![1]!);
    expect(html).toContain("不是Q初始三击或20次总和"); expect(html).not.toContain("伤害倍率<input");
    doc.gameContext.durinBurst = {tickIndex: 11, c2PyroBonusActive: false, c2PyroBonusIncluded: false};
    expect(durinBurstRequirementAdapter.collect(doc)).toEqual([]);
    expect(prepareDurinBurstDocument(doc).dependencies.filter(dep => dep.status === "missing")).toEqual([]);
  });
});
