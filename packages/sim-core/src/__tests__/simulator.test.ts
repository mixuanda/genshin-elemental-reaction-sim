import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

describe("deterministic event simulation", () => {
  it("applies a same-time buff before a hit", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "same-frame",
          actorId: "a",
          name: "同帧",
          at: 0,
          buffs: [
            {
              key: "bonus",
              target: "self",
              stat: "dmgBonus",
              value: 1,
              duration: 1,
              offset: 0
            }
          ],
          hits: [
            {
              id: "hit",
              offset: 0,
              scaling: 1,
              element: "pyro",
              snapshot: "hit"
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    expect(result.damageEvents[0]?.damageFactors.damageBonusMultiplier).toBe(2);
  });

  it("expires a buff exactly on its end boundary", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "boundary",
          actorId: "a",
          name: "边界",
          at: 0,
          buffs: [
            {
              key: "bonus",
              target: "self",
              stat: "dmgBonus",
              value: 1,
              duration: 1,
              offset: 0
            }
          ],
          hits: [
            {
              id: "hit",
              offset: 1,
              scaling: 1,
              element: "pyro",
              snapshot: "hit"
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    expect(result.damageEvents[0]?.damageFactors.damageBonusMultiplier).toBe(1);
    expect(result.damageEvents[0]?.activeStatuses).toEqual([]);
  });

  it("distinguishes action snapshots from hit-time stats", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "snapshot",
          actorId: "a",
          name: "快照",
          at: 0,
          buffs: [
            {
              key: "bonus",
              target: "self",
              stat: "dmgBonus",
              value: 1,
              duration: 2,
              offset: 0
            }
          ],
          hits: [
            {
              id: "snapshot-hit",
              label: "快照",
              offset: 1,
              scaling: 1,
              element: "pyro",
              snapshot: "action"
            },
            {
              id: "dynamic-hit",
              label: "动态",
              offset: 1,
              scaling: 1,
              element: "pyro",
              snapshot: "hit"
            }
          ]
        }
      ]
    });
    const result = simulate(config, { critMode: "noCrit" });
    expect(
      result.damageEvents.find((event) => event.hitId === "snapshot-hit")
        ?.damageFactors.damageBonusMultiplier
    ).toBe(1);
    expect(
      result.damageEvents.find((event) => event.hitId === "dynamic-hit")
        ?.damageFactors.damageBonusMultiplier
    ).toBe(2);
  });

  it("accepts energy exactly equal to the action cost", () => {
    const base = makeConfig();
    const config = makeConfig({
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 60
        }
      ],
      rotation: [
        {
          id: "burst",
          actorId: "a",
          name: "爆发",
          at: 0,
          energyCost: 60,
          hits: [
            {
              offset: 0,
              scaling: 1,
              element: "pyro"
            }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.skippedActions).toHaveLength(0);
    expect(result.damageEvents).toHaveLength(1);
    expect(result.energyStats.a?.spent).toBe(60);
    expect(result.energyStats.a?.final).toBe(0);
  });

  it("cancels the whole action when energy is insufficient", () => {
    const base = makeConfig();
    const config = makeConfig({
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 59
        }
      ],
      rotation: [
        {
          id: "burst",
          actorId: "a",
          name: "爆发",
          at: 0,
          energyCost: 60,
          buffs: [
            {
              stat: "dmgBonus",
              value: 1,
              duration: 10
            }
          ],
          energyGains: [{ amount: 60 }],
          hits: [
            {
              offset: 0,
              scaling: 1,
              element: "pyro"
            }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.skippedActions).toHaveLength(1);
    expect(result.skippedActions[0]?.reasonCode).toBe(
      "INSUFFICIENT_ENERGY"
    );
    expect(result.damageEvents).toHaveLength(0);
    expect(result.energyStats.a?.gained).toBe(0);
  });

  it("preserves insertion order for equal-time equal-priority hits", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "ordered",
          actorId: "a",
          name: "排序",
          at: 0,
          hits: [
            { id: "first", offset: 1, scaling: 1, element: "pyro" },
            { id: "second", offset: 1, scaling: 1, element: "pyro" }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.damageEvents.map((event) => event.hitId)).toEqual([
      "first",
      "second"
    ]);
  });

  it("keeps raw damage while exposing an integer display and honest aura audit", () => {
    const config = makeConfig({
      rotation: [
        {
          id: "audit",
          actorId: "a",
          name: "审计",
          at: 0,
          hits: [
            {
              id: "manual-melt",
              offset: 0,
              scaling: 1.2345,
              element: "pyro",
              reaction: "melt"
            }
          ]
        }
      ]
    });
    const event = simulate(config).damageEvents[0]!;
    expect(event.displayDamage).toBe(Math.round(event.finalDamage));
    expect(Number.isInteger(event.displayDamage)).toBe(true);
    expect(event.reactionAudit).toMatchObject({
      model: "manual-override",
      triggered: true,
      reaction: "melt",
      icdAllowed: null,
      auraBefore: null,
      auraAfter: null
    });
  });

  it("truncates hits after the configured duration", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "cutoff",
          actorId: "a",
          name: "截断",
          at: 0,
          hits: [
            { id: "inside", offset: 1, scaling: 1, element: "pyro" },
            { id: "outside", offset: 1.001, scaling: 1, element: "pyro" }
          ]
        }
      ]
    });
    const result = simulate(config);
    expect(result.damageEvents.map((event) => event.hitId)).toEqual(["inside"]);
  });

  it("is reproducible for the same config, versions, and seed", () => {
    const config = makeConfig();
    const first = simulate(config);
    const second = simulate(config);
    expect(second).toEqual(first);
    expect(first.reproducibilityKey).toMatch(/^gdl-[0-9a-f]{8}$/);
  });
});
