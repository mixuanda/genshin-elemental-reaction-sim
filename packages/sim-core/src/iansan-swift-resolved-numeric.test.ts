import { describe, expect, it } from "vitest";
import { evaluateIansanBurstAttackFeedback, evaluateIansanC6DamageBonus } from "./iansan-swift-resolved-numeric";

describe("Iansan numeric callbacks", () => {
  it("evaluates an actual update using independent effective Q level and42-point threshold", () => {
    const low = evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: 10, nonExtraAttackAtUpdate: 2000, nightsoulPointsAtUpdate: 41 });
    expect(low.rate).toBeCloseTo(.205, 15);
    expect(low.cap).toBe(690);
    expect(low.attackBonus).toBeCloseTo(410, 12);
    expect(evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: 10, nonExtraAttackAtUpdate: 2000, nightsoulPointsAtUpdate: 42 }))
      .toEqual({ rate: .27, cap: 690, attackBonus: 540 });
    // C5 baseQ10 already resolves to effectiveQ13. The callback must not add3.
    expect(evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: 13, nonExtraAttackAtUpdate: 10000, nightsoulPointsAtUpdate: 54 }))
      .toEqual({ rate: .27, cap: 810, attackBonus: 810 });
  });

  it("keeps zero observations valid and rejects missing/invalid refresh operands", () => {
    expect(evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: 1, nonExtraAttackAtUpdate: 10000, nightsoulPointsAtUpdate: 0 }).attackBonus).toBe(0);
    expect(evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: 1, nonExtraAttackAtUpdate: 0, nightsoulPointsAtUpdate: 54 }).attackBonus).toBe(0);
    for (const patch of [{ effectiveBurstTalentLevel: 0 }, { effectiveBurstTalentLevel: 16 }, { effectiveBurstTalentLevel: 1.5 },
      { nonExtraAttackAtUpdate: -1 }, { nonExtraAttackAtUpdate: NaN }, { nonExtraAttackAtUpdate: undefined }, { nightsoulPointsAtUpdate: 54.01 }]) {
      expect(() => evaluateIansanBurstAttackFeedback({ effectiveBurstTalentLevel: 10, nonExtraAttackAtUpdate: 2000, nightsoulPointsAtUpdate: 42, ...patch } as never)).toThrow();
    }
  });

  it("applies actual received C6 once and removes known old included contribution", () => {
    expect(evaluateIansanC6DamageBonus({ constellation: 6, active: true, includedDamageBonus: 0 })).toEqual({ actualBonus: .25, delta: .25 });
    expect(evaluateIansanC6DamageBonus({ constellation: 6, active: true, includedDamageBonus: .25 })).toEqual({ actualBonus: .25, delta: 0 });
    expect(evaluateIansanC6DamageBonus({ constellation: 6, active: false, includedDamageBonus: .25 })).toEqual({ actualBonus: 0, delta: -.25 });
    expect(evaluateIansanC6DamageBonus({ constellation: 6, active: false, includedDamageBonus: 0 })).toEqual({ actualBonus: 0, delta: 0 });
  });

  it("requires known received-state/accounting and refuses an unowned or invalid C6 claim", () => {
    for (const patch of [{ constellation: 5 }, { constellation: 7 }, { active: undefined }, { includedDamageBonus: undefined },
      { includedDamageBonus: -.01 }, { includedDamageBonus: .251 }]) {
      expect(() => evaluateIansanC6DamageBonus({ constellation: 6, active: true, includedDamageBonus: 0, ...patch } as never)).toThrow();
    }
  });
});
