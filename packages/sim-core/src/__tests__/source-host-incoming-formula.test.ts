import { describe, expect, it } from "vitest";
import { resolveSourceHostPlayerIncomingRequest, type SourceHostPlayerIncomingInput } from "../source-host-incoming-formula";

const sample: SourceHostPlayerIncomingInput = {
  scalingStat: "atk", scalingValue: 100, scaling: 2, flatDamage: 10, damageBonus: 0.2,
  playerDefense: 1000, defenseIgnore: 0.25, playerResistance: 0, attackerLevel: 90,
  critRate: 0.4, critDamage: 0.5, isCrit: false, critRoll: 0.8, hitWeakPoint: false,
  elementalMastery: 0, amped: false, amplifyingMultiplier: 1, reactionBonus: 0,
  groupMultiplier: 0.8,
};

describe("pinned source player incoming formula", () => {
  it("returns the pre-shield amount using the player's DEF denominator", () => {
    const result = resolveSourceHostPlayerIncomingRequest({ input: sample });
    expect(result.value).toBeCloseTo(252 * (950 / 1700) * 0.8, 12);
    expect(result.trace.at(-1)?.result?.value).toBe(result.value);
  });

  it("preserves weakpoint RNG short circuit, amp order, and pinned RES equality branch", () => {
    const result = resolveSourceHostPlayerIncomingRequest({ input: {
      ...sample, scalingValue: 100, scaling: 1, flatDamage: 0, damageBonus: 0,
      playerDefense: 0, defenseIgnore: 0, playerResistance: 0.75,
      hitWeakPoint: true, isCrit: true, critRoll: null,
      amped: true, amplifyingMultiplier: 1.5, reactionBonus: 0.2,
      groupMultiplier: 0.5,
    } });
    expect(result.value).toBeCloseTo(84.375, 12);
    expect(result.trace.find(node => node.id === "incomingResistanceMultiplier")?.result?.value).toBe(0.625);
  });

  it("rejects a claimed crit outcome that disagrees with the source draw", () => {
    expect(() => resolveSourceHostPlayerIncomingRequest({ input: { ...sample, isCrit: true } })).toThrow(/暴击/);
  });
});
