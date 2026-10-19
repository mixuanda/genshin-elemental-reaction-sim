import { expect, it } from "vitest";
import { conditionedSpecialCalculationSchema } from "@genshin-dps-lab/reaction-formulas";
import { simulateLunarMixedV2Profile } from "../simulator";
import { lunarMixedV2EventToCalculatorDocument } from "../lunar-mixed-v2-runtime";
import { calculateDocument } from "../calculator";
import { calculatorDocumentSchema } from "../calculator-model";
import { calculateSpecialCalculatorHit } from "../special-calculator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "./lunar-mixed-v2.fixture";

it("samples real mixed Lunar contributors before ranking, snapshots projectile rolls, and replays actual damage independently of its expectation", () => {
  const config = mixedV2Config();
  config.characters.forEach((actor, index) => {
    actor.stats.critRate = [0.5, 0, 0.25, 1][index]!;
    actor.stats.critDmg = 2;
  });
  const originalRates = config.characters.map(actor => actor.stats.critRate);
  const options = { party: mixedV2Party, abilities: [mixedV2Declaration], randomSeed: "lunar-contributor-reference", critMode: "average" as const, execution: { criticalSampling: "seeded-random-v1" as const } };
  const result = simulateLunarMixedV2Profile(config, options);
  const repeated = simulateLunarMixedV2Profile(config, options);
  expect(repeated.specialDamageEvents).toEqual(result.specialDamageEvents);
  expect(config.characters.map(actor => actor.stats.critRate)).toEqual(originalRates);
  expect(result.specialCriticalPolicy).toMatchObject({ id: "special-contributor-critical-v1", rngAlgorithm: "fnv1a32-mulberry32-v1", matchesGcsimRandomSequence: false, comparison: "<=" });
  expect(result.baseResult.resolvedRuntimeOptions.execution?.criticalSampling).toBe("seeded-random-v1");
  expect(result.specialDamageEvents.map(event => event.frame)).toEqual([57, 105, 117, 129, 222, 230, 252]);

  const draws = result.specialDamageEvents.flatMap(event => event.context.criticalExecution!.draws).sort((a, b) => a.drawIndex - b.drawIndex);
  expect(draws.map(draw => draw.drawIndex)).toEqual(draws.map((_, index) => index));
  // Explicit boundary CR still consumes a draw; absent members do not.
  expect(draws.some(draw => draw.contributorId === "e" && !draw.critical)).toBe(true);
  expect(draws.some(draw => draw.contributorId === "g" && draw.critical)).toBe(true);
  expect(result.specialDamageEvents.every(event => event.context.criticalExecution!.draws.length === event.context.contributors.length)).toBe(true);

  const restored = JSON.parse(JSON.stringify(result));
  for (const event of result.specialDamageEvents) {
    const context = event.context;
    const audit = context.criticalExecution!;
    expect(audit.seed).toBe(options.randomSeed);
    expect(audit.rngStream).toBe("special-contributor-critical-v1");
    if (context.context.mode !== "state-resolved") throw new Error("Expected actual runtime context");
    expect(audit.frame).toBe(context.context.snapshotFrame);
    expect(context.context.ownerId).toBe(event.ownerId);
    expect(event.frame - audit.frame).toBe(context.branch === "lunar-crystallize-reaction" ? 10 : 0);

    // Independent arithmetic for this bounded fixture: RES .1; EM 100/200/300/400;
    // LC ×3, LCrys ×1.6; Moondew HP35000 × T10 .027202 × (1+.07).
    const contributions = context.contributors.map((contributor, index) => {
      const draw = audit.draws[index]!;
      expect(draw.contributorId).toBe(contributor.id);
      expect(draw.roll).toBeGreaterThanOrEqual(0);
      expect(draw.roll).toBeLessThan(1);
      expect(draw.critical).toBe(draw.roll <= contributor.critRate);
      expect(contributor.critRate).toBe(config.characters.find(actor => actor.id === contributor.id)!.stats.critRate);
      const base = contributor.base.kind === "level-base" ? contributor.base.value : 35000 * 0.027202;
      const coefficient = context.branch === "lunar-charged-reaction" ? 3 : context.branch === "lunar-crystallize-reaction" ? 1.6 : 1;
      const bonus = context.branch === "lunar-bloom-direct" ? 1.07 : 1;
      const contribution = base * coefficient * bonus * (1 + 6 * contributor.elementalMastery / (contributor.elementalMastery + 2000)) * (draw.critical ? 3 : 1) * 0.9;
      return { contributorId: contributor.id, critical: draw.critical, contribution };
    }).sort((a, b) => b.contribution - a.contribution || a.contributorId.localeCompare(b.contributorId));
    const expectedActual = contributions.reduce((sum, entry, rank) => sum + entry.contribution * (context.branch === "lunar-bloom-direct" ? 1 : [0.6, 0.3, 0.05, 0.05][rank]!), 0);
    expect(event.damage).toBeCloseTo(expectedActual, 9);
    expect(event.criticalOutcome!.rankedContributions.map(entry => entry.contributorId)).toEqual(contributions.map(entry => entry.contributorId));
    expect(event.criticalOutcome!.damage).toBe(event.damage);
    expect(event.trace.filter(node => node.id.endsWith(".decision"))).toHaveLength(context.contributors.length);
    expect(event.trace.some(node => node.id.endsWith("sampled.total") && node.symbolicFormula.length > 0 && node.substitution.length > 0)).toBe(true);

    const document = lunarMixedV2EventToCalculatorDocument(restored, event.id);
    const calculation = calculateDocument(calculatorDocumentSchema.parse(JSON.parse(JSON.stringify(document))));
    expect(calculation.hits[0]!.sampled).toEqual(event.criticalOutcome);
    const analytical = structuredClone(context);
    delete analytical.criticalExecution;
    expect(calculation.hits[0]!.expected).toBe(calculateSpecialCalculatorHit(analytical).expected);
    expect(calculation.hits[0]!.sampled!.damage).toBe(event.damage);
  }
  const ordinary = result.baseResult.damageEvents.find(event => event.kind === "direct")!;
  expect(replaySimulationHit(captureSimulationHit(restored.baseResult, ordinary.id)).reproducedDamage).toBe(ordinary.finalDamage);
  expect(result.totalDamage).toBe(result.classicDamage + result.lunarChargedDamage + result.lunarCrystallizeDamage + result.lunarBloomDamage);

  const invalid = structuredClone(result.specialDamageEvents[0]!.context);
  invalid.criticalExecution!.draws[0]!.critical = !invalid.criticalExecution!.draws[0]!.critical;
  expect(() => conditionedSpecialCalculationSchema.parse(invalid)).toThrow(/Critical outcome/);
});
