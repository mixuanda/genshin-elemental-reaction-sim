import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSourceHostRequest } from "./source-host-formula";
import { captureSourceHostHit, replaySourceHostHit, createSourceHostEditableCalculation,
  calculateSourceHostEditableCalculation } from "./source-host-capture";
import type { SourceHostStatReadReceipt } from "./source-host-stat-provenance";
import type { SourceHostCalculationRequest, SourceHostResult } from "./source-host-wire";

const archived = JSON.parse(readFileSync(new URL("../../../docs/validation/action-opportunities-classic-xingqiu-20260929.capture.json", import.meta.url), "utf8")) as SourceHostResult;
type ReactionRequest = Extract<SourceHostCalculationRequest, { kind: "transformative-base" | "additive-base" }>;
const original = archived.calculations.find(row => row.request.kind === "transformative-base" && row.request.input.elementalMastery === 100)!.request as ReactionRequest;

// Synthetic protocol receipt using an archived EM value. Native producer
// placement is covered by the single integration run, not by this fixture.
function withRead(): ReactionRequest {
  const request = structuredClone(original);
  const values = Array.from({ length: 26 }, (_, index) => index === 8 ? request.input.elementalMastery : 0);
  const read: SourceHostStatReadReceipt = { id: "fixture-reaction-em", kind: "stat", frame: request.frame,
    actorIndex: request.actorIndex, selector: [8], nonExtra: false, base: values, steps: [], result: [...values] };
  request.statRead = read;
  return request;
}

describe("reaction EM read provenance", () => {
  it("links the one EM getter to both reaction arithmetic families and retains the legacy boundary", () => {
    for (const kind of ["transformative-base", "additive-base"] as const) {
      const request = withRead();
      request.kind = kind;
      if (kind === "additive-base") request.input.baseMultiplier = 1.15;
      const result = resolveSourceHostRequest(request);
      const node = result.trace.find(row => row.id === (kind === "transformative-base" ? "transformativeEmBonus" : "additiveEmBonus"))!;
      const reference = `sourceStats.reaction.${request.id}.fixture-reaction-em.base.8`;
      expect(node.inputs.find(input => input.key === "elementalMastery")?.origin).toMatchObject({ reference });
      expect(node.childIds).toContain(reference);
      expect(result.trace.find(row => row.id === reference)?.result?.value).toBe(100);
      expect(result.explanationGaps.some(gap => gap.includes("尚未保存该 EM"))).toBe(false);
      delete request.statRead;
      const legacy = resolveSourceHostRequest(request);
      expect(legacy.value).toBe(result.value);
      expect(legacy.explanationGaps.some(gap => gap.includes("尚未保存该 EM"))).toBe(true);
    }
  });

  it("restores the reaction receipt in a hit and permits an independent EM edit without reusing its old source", () => {
    const input = structuredClone(archived);
    const record = input.calculations.find(row => row.request.id === original.id)!;
    record.request = withRead();
    const hit = input.applications.find(application => input.calculations.some(row => row.request.id === application.calculationId
      && row.request.componentIds.includes(original.id)))!;
    const capture = captureSourceHostHit(input, hit.id);
    expect(replaySourceHostHit(JSON.parse(JSON.stringify(capture))).difference).toBe(0);
    const document = createSourceHostEditableCalculation(capture);
    const component = document.components.find(row => row.request.id === original.id)!;
    const editedRequest = component.request as ReactionRequest;
    editedRequest.input.elementalMastery = 200;
    const edited = calculateSourceHostEditableCalculation(document);
    expect(edited.value).toBeGreaterThan(edited.originalDamage);
    const emNode = edited.trace.find(node => node.id === `component.${original.id}.transformativeEmBonus`)!;
    expect(emNode.inputs.find(input => input.key === "elementalMastery")?.value).toBe(200);
    expect(emNode.inputs.find(input => input.key === "elementalMastery")?.origin).toBe("calculation-context");
    expect(editedRequest.statRead!.result[8]).toBe(100);
    const invalid = withRead();
    invalid.statRead!.actorIndex += 1;
    expect(() => resolveSourceHostRequest(invalid)).toThrow(/角色、帧或 EM getter/);
  });
});
