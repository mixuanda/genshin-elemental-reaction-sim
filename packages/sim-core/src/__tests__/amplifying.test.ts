import type {
  Element,
  ReactionType,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

interface AmplifyingCase {
  label: string;
  sourceElement: Extract<Element, "pyro" | "hydro" | "cryo">;
  auraElement: Extract<Element, "pyro" | "hydro" | "cryo">;
  reaction: Extract<
    ReactionType,
    "melt" | "reverseMelt" | "vaporize" | "reverseVaporize"
  >;
  reactionBase: 1.5 | 2;
}

const AMPLIFYING_CASES: readonly AmplifyingCase[] = [
  {
    label: "Pyro onto Cryo",
    sourceElement: "pyro",
    auraElement: "cryo",
    reaction: "melt",
    reactionBase: 2
  },
  {
    label: "Cryo onto Pyro",
    sourceElement: "cryo",
    auraElement: "pyro",
    reaction: "reverseMelt",
    reactionBase: 1.5
  },
  {
    label: "Hydro onto Pyro",
    sourceElement: "hydro",
    auraElement: "pyro",
    reaction: "vaporize",
    reactionBase: 2
  },
  {
    label: "Pyro onto Hydro",
    sourceElement: "pyro",
    auraElement: "hydro",
    reaction: "reverseVaporize",
    reactionBase: 1.5
  }
];

function makeAmplifyingConfig(
  vector: AmplifyingCase,
  proxyOwners = false
): SimConfig {
  const base = makeConfig();
  const source = {
    ...base.characters[0]!,
    id: "source",
    name: "Reaction Source",
    element: vector.sourceElement,
    level: 90,
    stats: {
      ...neutralStats,
      baseAtk: 1000,
      em: 100,
      reactionBonus: 0.1
    }
  };
  return {
    ...base,
    duration: 1.2,
    cycleLength: 2,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0
    },
    characters: proxyOwners
      ? [
          source,
          {
            ...source,
            id: "proxy",
            name: "Scaling Proxy",
            stats: {
              ...neutralStats,
              baseAtk: 2000,
              em: 900,
              reactionBonus: 0.9
            }
          },
          {
            ...source,
            id: "credit",
            name: "Credit Owner",
            stats: {
              ...neutralStats,
              baseAtk: 3000,
              em: 700,
              reactionBonus: 0.7
            }
          }
        ]
      : [source],
    reactionEngine: {
      mode: "aura-v1",
      initialAura: [
        {
          element: vector.auraElement,
          gaugeUnits: 1
        }
      ]
    },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "source",
      swapFrames: 12,
      abilities: [
        {
          id: "setup",
          actorId: "source",
          name: "Snapshot Boundary Setup",
          kind: "skill",
          cancelFrame: 0,
          animationEndFrame: 0,
          cooldownFrames: 0,
          buffs: [
            {
              key: "snapshot-em",
              target: "source",
              stat: "em",
              value: 200,
              startFrame: 0,
              durationFrames: 24
            },
            {
              key: "hit-time-reaction-bonus",
              target: "source",
              stat: "reactionBonus",
              value: 0.4,
              startFrame: 30,
              durationFrames: 60
            }
          ]
        },
        {
          id: "amplifying-action",
          actorId: "source",
          name: vector.label,
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "amplifying-hit",
              label: vector.label,
              frame: 54,
              scaling: 1,
              element: vector.sourceElement,
              application: {
                gaugeUnits: 1,
                icd: {
                  mode: "no-icd-v1"
                }
              },
              snapshot: "action",
              reactionBonus: 0.05,
              ...(proxyOwners
                ? {
                    scalingOwnerId: "proxy",
                    creditId: "credit"
                  }
                : {})
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "source",
          abilityId: "setup"
        },
        { type: "wait", frames: 6 },
        {
          type: "skill",
          actorId: "source",
          abilityId: "amplifying-action"
        }
      ]
    }
  };
}

function expectedAmplifyingFactors(reactionBase: 1.5 | 2) {
  const elementalMastery = 300;
  const elementalMasteryBonus =
    (2.78 * elementalMastery) / (1400 + elementalMastery);
  const reactionBonus = 0.55;
  return {
    elementalMastery,
    elementalMasteryBonus,
    reactionBonus,
    total:
      reactionBase *
      (1 + elementalMasteryBonus + reactionBonus)
  };
}

describe("Melt and Vaporize snapshot ownership", () => {
  it.each(AMPLIFYING_CASES)(
    "$label uses source action-snapshot EM and source hit-time reaction bonus",
    (vector) => {
      const first = simulate(makeAmplifyingConfig(vector), {
        critMode: "noCrit"
      });
      const repeated = simulate(makeAmplifyingConfig(vector), {
        critMode: "noCrit"
      });
      const event = first.damageEvents[0]!;
      const expected = expectedAmplifyingFactors(vector.reactionBase);

      expect(event).toMatchObject({
        sourceActorId: "source",
        scalingOwnerId: "source",
        creditOwnerId: "source",
        reaction: vector.reaction,
        snapshot: "action",
        em: expected.elementalMastery,
        damageFactors: {
          reactionBase: vector.reactionBase,
          elementalMasteryBonus: expected.elementalMasteryBonus,
          reactionBonus: expected.reactionBonus,
          amplifyingReactionMultiplier: expected.total
        }
      });
      expect(event.finalDamage).toBe(
        1000 * 1 * 0.5 * 0.9 * 1 * expected.total * 1
      );
      expect(repeated.damageEvents).toEqual(first.damageEvents);
      expect(repeated.totalDamage).toBe(first.totalDamage);
      expect(repeated.reproducibilityKey).toBe(
        first.reproducibilityKey
      );
    }
  );

  it("keeps scaling and credit proxies out of the reaction panel", () => {
    const vector = AMPLIFYING_CASES[0]!;
    const first = simulate(makeAmplifyingConfig(vector, true), {
      critMode: "noCrit"
    });
    const repeated = simulate(makeAmplifyingConfig(vector, true), {
      critMode: "noCrit"
    });
    const event = first.damageEvents[0]!;
    const expected = expectedAmplifyingFactors(vector.reactionBase);

    expect(event).toMatchObject({
      sourceActorId: "source",
      scalingOwnerId: "proxy",
      creditOwnerId: "credit",
      statsBeforeDamage: {
        baseAtk: 2000,
        em: 900,
        reactionBonus: 0.9
      },
      scalingValue: 2000,
      em: expected.elementalMastery,
      damageFactors: {
        scalingValue: 2000,
        elementalMasteryBonus: expected.elementalMasteryBonus,
        reactionBonus: expected.reactionBonus,
        amplifyingReactionMultiplier: expected.total
      }
    });
    expect(event.finalDamage).toBe(
      2000 * 1 * 0.5 * 0.9 * 1 * expected.total * 1
    );
    expect(
      first.characterSummaries.find(
        (summary) => summary.characterId === "credit"
      )?.damage
    ).toBe(event.finalDamage);
    expect(repeated.damageEvents).toEqual(first.damageEvents);
    expect(repeated.reproducibilityKey).toBe(
      first.reproducibilityKey
    );
  });
});
