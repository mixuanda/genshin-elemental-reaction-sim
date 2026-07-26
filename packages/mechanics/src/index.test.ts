import type { DamagePluginContext } from "@genshin-dps-lab/sim-core";
import { describe, expect, it } from "vitest";
import { createDeclarativeDamagePlugin } from "./index";

function makePluginContext(
  additiveReactionFlatDamage = 5
): DamagePluginContext {
  return {
    action: { id: "action" },
    hit: { id: "hit" },
    sourceActor: { id: "source" },
    scalingOwner: { id: "scaling" },
    creditOwner: { id: "credit" },
    flatDamageComponents: {
      ordinaryFlatDamage: 10,
      additiveReactionFlatDamage
    },
    damageInput: {
      flatDamage: 10 + additiveReactionFlatDamage,
      damageBonus: 0.2,
      groupMultiplier: 2
    }
  } as unknown as DamagePluginContext;
}

describe("declarative damage plugin flat components", () => {
  it("accumulates ordinary and additive flat components independently", () => {
    const plugin = createDeclarativeDamagePlugin([
      {
        id: "first",
        when: {},
        add: {
          ordinaryFlatDamage: 3,
          additiveReactionFlatDamage: 2,
          damageBonus: 0.1
        }
      },
      {
        id: "second",
        when: {},
        add: {
          ordinaryFlatDamage: 4,
          additiveReactionFlatDamage: -1,
          damageBonus: 0.2
        },
        multiplyGroupBy: 2
      }
    ]);

    const changes = plugin.modifyDamage(makePluginContext());

    expect(changes).toMatchObject({
      ordinaryFlatDamage: 17,
      additiveReactionFlatDamage: 6,
      damageBonus: expect.closeTo(0.5, 12),
      groupMultiplier: 4
    });
  });

  it("retains the legacy total-flat addition for non-Catalyze callers", () => {
    const plugin = createDeclarativeDamagePlugin([
      {
        id: "legacy",
        when: {},
        add: { flatDamage: 7 }
      }
    ]);

    expect(plugin.modifyDamage(makePluginContext(0))).toEqual({
      flatDamage: 17
    });
  });
});
