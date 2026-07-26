import { describe, expect, it } from "vitest";
import { durinMeltPreset } from "@genshin-dps-lab/game-data";
import golden from "../../../test-vectors/fixtures/legacy-default-120s.golden.json";
import { simulate } from "../simulator";

function expectRelativeClose(
  actual: number,
  expected: number,
  tolerance = 1e-8
): void {
  const denominator = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected) / denominator).toBeLessThanOrEqual(
    tolerance
  );
}

describe("Vanilla v0.1 golden compatibility", () => {
  it("matches the full default 120-second baseline", () => {
    const result = simulate(durinMeltPreset, {
      energyMode: "configured",
      critMode: "average",
      compatibilityMode: "legacy-v0.1",
      randomSeed: golden.options.randomSeed
    });

    expectRelativeClose(result.totalDamage, golden.totalDamage);
    expectRelativeClose(result.dps, golden.dps);
    expect(result.damageEvents).toHaveLength(golden.hitCount);
    expect(result.damageCurve).toHaveLength(golden.hitCount);
    expect(result.damageCurve.at(-1)?.cumulativeDamage).toBeCloseTo(
      result.totalDamage,
      8
    );
    expect(result.reactedHits).toBe(golden.reactedHits);
    expect(result.skippedActions).toHaveLength(golden.skippedActionCount);

    for (const [characterId, expectedDamage] of Object.entries(
      golden.byCharacter
    )) {
      expectRelativeClose(
        result.byCharacter[characterId] ?? 0,
        expectedDamage
      );
    }

    expect(result.bySkill).toHaveLength(golden.bySkill.length);
    golden.bySkill.forEach((expectedSkill, index) => {
      const actualSkill = result.bySkill[index];
      expect(actualSkill?.creditId).toBe(expectedSkill.creditId);
      expect(actualSkill?.actionName).toBe(expectedSkill.actionName);
      expect(actualSkill?.hits).toBe(expectedSkill.hits);
      expectRelativeClose(
        actualSkill?.damage ?? 0,
        expectedSkill.damage
      );
    });

    expect(
      result.skippedActions.map(
        ({ time, actorId, action, reason, cycle }) => ({
          time,
          actorId,
          action,
          reason,
          cycle
        })
      )
    ).toEqual(golden.skippedActions);
  });
});
