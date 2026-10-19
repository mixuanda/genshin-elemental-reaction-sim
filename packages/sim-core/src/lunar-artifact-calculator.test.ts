import { describe, expect, it } from "vitest";
import { calculateSpecialCalculatorHit, createSpecialTeachingContext } from "./special-calculator";
import { calculatorTraceText } from "./calculator-text";
import { calculateDocument } from "./calculator";
import { calculatorDocumentSchema } from "./calculator-model";
import { getCalculatorHitSourceContract, getCalculatorHitTrustDependencies } from "./calculator-trust";
import { loadWorkedExample } from "./worked-examples";

describe("Lunar artifact clauses in the shared calculator", () => {
  it("adds owner-only reward before ranking, with visible numerical substitutions", () => {
    const context = createSpecialTeachingContext("lunar-charged-reaction");
    context.effectiveResistance = 0;
    context.contributors.forEach((c, index) => {
      c.elementalMastery = 0; c.critRate = 0;
      if (c.base.kind === "level-base") c.base.value = index === 0 ? 100 : 115;
    });
    expect(calculateSpecialCalculatorHit(context).nonCritical).toBe(297);
    context.contributors[0]!.artifactBonus = { kind: "thundering-fury-4pc" };
    const result = calculateSpecialCalculatorHit(context);
    // 300 × 1.2 outranks 345: 360 × .6 + 345 × .3 = 319.5.
    expect(result.nonCritical).toBe(319.5);
    const reward = result.trace.find(node => node.id.endsWith("contributor.0.artifact.bonus"))!;
    expect(reward.result!.value).toBe(.2);
    expect(reward.substitution).toContain("0.2");
    expect(reward.sourceRefs[0]).toContain("thunderingfury.go");
    for (const node of result.trace.filter(node => node.id.includes(".artifact.") || node.id.endsWith(".reactionBonus"))) {
      expect(calculatorTraceText(node.explanationKey)).not.toMatch(/\.explain$/);
      for (const input of node.inputs) expect(calculatorTraceText(input.meaningKey)).not.toBe(input.meaningKey);
    }
  });

  it("requires relevant conditions and does not invent values for an inactive or unrelated clause", () => {
    const context = createSpecialTeachingContext("lunar-bloom-direct"), c = context.contributors[0]!;
    context.effectiveResistance = 0; c.elementalMastery = 0; c.critRate = 0;
    if (c.base.kind === "direct-stat-talent") { c.base.statValue = 100; c.base.talentCoefficient = 1; }
    c.artifactBonus = { kind: "flower-of-paradise-lost-4pc" };
    expect(calculateSpecialCalculatorHit(context).status).toBe("blocked");
    c.artifactBonus.stacks = 2; c.reactionBonus = .05;
    expect(calculateSpecialCalculatorHit(context).nonCritical).toBeCloseTo(120, 12);
    c.reactionBonus = 0; c.artifactBonus = { kind: "aubade-4pc", offField: true };
    expect(calculateSpecialCalculatorHit(context).status).toBe("blocked");
    c.artifactBonus.moonsignLevel = 2;
    expect(calculateSpecialCalculatorHit(context).nonCritical).toBe(160);
    c.artifactBonus = { kind: "aubade-4pc", offField: false, returnGraceActive: false };
    expect(calculateSpecialCalculatorHit(context).nonCritical).toBe(100);
    context.branch = "lunar-charged-direct";
    c.artifactBonus = { kind: "flower-of-paradise-lost-4pc" };
    expect(calculateSpecialCalculatorHit(context).nonCritical).toBe(300);
  });

  it("editable examples roundtrip through the same core and bind the sourced rule separately from its conditions", () => {
    for (const kind of ["thundering-fury-4pc", "flower-of-paradise-lost-4pc", "aubade-4pc"] as const) {
      const doc = loadWorkedExample(`special-artifact-${kind}`);
      const restored = calculatorDocumentSchema.parse(JSON.parse(JSON.stringify(doc)));
      expect(calculateDocument(restored)).toEqual(calculateDocument(doc));
      expect(getCalculatorHitTrustDependencies(doc, "hit-a")).toContain(`rule:lunar-artifact-b4ae769:${kind}`);
    }
    const doc = loadWorkedExample("special-artifact-flower-of-paradise-lost-4pc"), hit = doc.hits[0]!;
    if (hit.kind !== "special") throw new Error("Expected special example");
    const contract = getCalculatorHitSourceContract(doc, "hit-a"), initial = calculateDocument(doc).totals!.expected;
    hit.context.contributors[0]!.artifactBonus = { kind: "flower-of-paradise-lost-4pc", stacks: 4 };
    expect(calculateDocument(doc).totals!.expected).toBeGreaterThan(initial);
    expect(getCalculatorHitSourceContract(doc, "hit-a")).toBe(contract);
    delete hit.context.contributors[0]!.artifactBonus;
    expect(getCalculatorHitSourceContract(doc, "hit-a")).not.toBe(contract);
  });
});
