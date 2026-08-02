import { describe, expect, it } from "vitest";
import type {
  AuraStateEntry,
  PersistentAuraElement
} from "@genshin-dps-lab/schemas";
import { AuraEngine } from "../aura";

const noIcd = {
  gaugeUnits: 1,
  icd: {
    mode: "no-icd-v1" as const
  }
};

function snapshotWithInitialAura(
  elements: readonly PersistentAuraElement[]
): AuraStateEntry[] {
  return new AuraEngine({
    mode: "aura-v7",
    initialAura: elements.map((element) => ({
      element,
      gaugeUnits: 1
    }))
  }).getAuraStateAt(0);
}

function snapshotWithHydroOwners(
  sourceActorIds: readonly string[]
): AuraStateEntry[] {
  const engine = new AuraEngine({ mode: "aura-v7" });
  for (const sourceActorId of sourceActorIds) {
    engine.processHit({
      frame: 0,
      sourceActorId,
      element: "hydro",
      application: noIcd
    });
  }
  return engine.getAuraStateAt(0);
}

describe("AuraEngine canonical code-unit ordering", () => {
  it("orders Aura elements identically for forward and reverse input", () => {
    const elements = [
      "pyro",
      "hydro",
      "electro",
      "dendro",
      "cryo"
    ] as const;
    const forward = snapshotWithInitialAura(elements);
    const reverse = snapshotWithInitialAura([...elements].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.map((entry) => entry.element)).toEqual([
      "cryo",
      "dendro",
      "electro",
      "hydro",
      "pyro"
    ]);
  });

  it("orders mixed-case and non-ASCII source owners by UTF-16 code units", () => {
    const owners = ["ä", "ı", "i", "I"] as const;
    const forward = snapshotWithHydroOwners(owners);
    const reverse = snapshotWithHydroOwners([...owners].reverse());

    expect(reverse).toEqual(forward);
    expect(forward).toMatchInlineSnapshot(`
      [
        {
          "element": "hydro",
          "expiresAtFrame": 570,
          "gaugeUnits": 0.8,
          "sourceSlots": [
            {
              "gaugeUnits": 0.8,
              "sourceActorId": "I",
            },
            {
              "gaugeUnits": 0.8,
              "sourceActorId": "i",
            },
            {
              "gaugeUnits": 0.8,
              "sourceActorId": "ä",
            },
            {
              "gaugeUnits": 0.8,
              "sourceActorId": "ı",
            },
          ],
        },
      ]
    `);
  });
});
