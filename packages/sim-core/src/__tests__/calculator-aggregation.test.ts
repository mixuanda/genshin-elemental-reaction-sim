import { describe, expect, it } from "vitest";
import { applyYanfeiChargedContext, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { YANFEI_A4_HIT_ID } from "../../../../apps/web/src/yanfei-calculation-context";
import { calculateDocument, type CalculatorDocument } from "../calculator";

function keqingBurst(): CalculatorDocument {
  const document = getCharacterDocuments("character:10000042", 1)
    .find(row => row.gameContext?.skillId === "keqing-burst-complete-cast");
  if (!document || document.build.mode === "equipment-derived") throw new Error("Source Keqing burst document missing");
  document.build.stats = { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 };
  return document;
}

function yanfeiCharged(): CalculatorDocument {
  const document = getCharacterDocuments("character:10000048", 1)
    .find(row => row.gameContext?.skillId === "yanfei-charged-cast");
  if (!document || document.build.mode === "equipment-derived") throw new Error("Source Yanfei cast document missing");
  document.build.stats = { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 };
  return applyYanfeiChargedContext(document,
    { ...document.gameContext!.yanfeiCharged!, scarletSeals: 3 });
}

describe("calculator result aggregation", () => {
  it("reports a complete sourced cast, explicit omissions, a blocked subtotal, and an independent single hit", () => {
    const document = keqingBurst();
    const complete = calculateDocument(document);
    const aggregate = complete.aggregation;
    expect(complete.status).toBe("calculated");
    expect(aggregate.version).toBe("calculator-aggregation-v1");
    expect(aggregate.scope).toBe("complete-cast");
    expect(aggregate.status).toBe("calculated");
    expect(aggregate.omittedHitIds).toEqual([]);
    expect(aggregate.completenessReasons).toEqual([]);
    expect(aggregate.attributionPolicy).toBe(document.gameContext!.attributionPolicy);
    expect(aggregate.components.map(component => component.id)).toEqual(document.hits.map(hit => hit.id));
    expect(aggregate.components.every(component => component.selected && component.status === "calculated")).toBe(true);
    for (const field of ["nonCritical", "critical", "expected"] as const) {
      const sum = aggregate.components.reduce((total, component) => total + component.damage![field], 0);
      expect(complete.totals![field]).toBeCloseTo(sum, 10);
      expect(aggregate.knownSubtotal![field]).toBeCloseTo(sum, 10);
    }

    const partialDocument = structuredClone(document);
    partialDocument.selectedHitIds = partialDocument.hits.slice(0, 2).map(hit => hit.id);
    const partial = calculateDocument(partialDocument);
    expect(partial.aggregation.scope).toBe("selected-components");
    expect(partial.aggregation.omittedHitIds).toEqual(document.hits.slice(2).map(hit => hit.id));
    expect(partial.aggregation.components.filter(component => component.status === "excluded")
      .map(component => component.id)).toEqual(partial.aggregation.omittedHitIds);
    expect(partial.aggregation.completenessReasons.length).toBeGreaterThan(0);

    const blockedDocument = structuredClone(document);
    const unresolved = blockedDocument.hits[1]!;
    blockedDocument.hits[1] = { id: unresolved.id, label: unresolved.label, kind: "blocked",
      sourceRefs: unresolved.sourceRefs, dependencies: unresolved.dependencies,
      reasons: ["This selected source segment has an unresolved input"] };
    const blocked = calculateDocument(blockedDocument);
    expect(blocked.status).toBe("blocked");
    expect(blocked.totals).toBeUndefined();
    expect(blocked.aggregation.status).toBe("blocked");
    expect(blocked.aggregation.omittedHitIds).toContain(unresolved.id);
    expect(blocked.aggregation.components.find(component => component.id === unresolved.id))
      .toMatchObject({ selected: true, status: "blocked" });
    expect(blocked.aggregation.components.find(component => component.id === unresolved.id)?.damage).toBeUndefined();
    const known = blocked.aggregation.components.filter(component => component.status === "calculated");
    expect(blocked.aggregation.knownSubtotal!.expected)
      .toBeCloseTo(known.reduce((sum, component) => sum + component.damage!.expected, 0), 10);

    blockedDocument.scope = "single-hit";
    blockedDocument.selectedHitIds = [blockedDocument.hits[0]!.id];
    const single = calculateDocument(blockedDocument);
    expect(single.status).toBe("calculated");
    expect(single.aggregation.scope).toBe("single-hit");
    expect(single.aggregation.components.filter(component => component.selected)).toHaveLength(1);
    expect(single.totals!.expected).toBeCloseTo(single.aggregation.knownSubtotal!.expected, 10);
  });

  it("uses Yanfei's actual cast probability contribution and excludes a disabled non-damaging follow-up", () => {
    const document = yanfeiCharged();
    const result = calculateDocument(document);
    const followUp = result.hits.find(hit => hit.id === YANFEI_A4_HIT_ID)!;
    const component = result.aggregation.components.find(row => row.id === YANFEI_A4_HIT_ID)!;
    expect(result.aggregation.scope).toBe("complete-cast");
    expect(followUp.castContribution?.triggerProbability).toBe(.5);
    expect(component.triggerProbability).toBe(.5);
    expect(component.damage?.expected).toBeCloseTo(followUp.castContribution!.expected, 10);
    expect(component.damage?.expected).not.toBeCloseTo(followUp.expected!, 10);
    expect(result.aggregation.knownSubtotal?.expected).toBeCloseTo(result.totals!.expected, 10);

    document.scope = "single-hit";
    document.selectedHitIds = [YANFEI_A4_HIT_ID];
    const disabled = calculateDocument(applyYanfeiChargedContext(document,
      { ...document.gameContext!.yanfeiCharged!, onFieldAtMainHit: false }));
    const disabledComponent = disabled.aggregation.components.find(row => row.id === YANFEI_A4_HIT_ID)!;
    expect(disabledComponent).toMatchObject({ selected: true, status: "non-damaging" });
    expect(disabledComponent.damage).toBeUndefined();
    expect(disabled.totals).toBeUndefined();
    expect(disabled.aggregation.knownSubtotal?.expected ?? 0).toBe(0);
  });
});
