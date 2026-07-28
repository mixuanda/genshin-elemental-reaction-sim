import {
  type AuraReactionEngineConfig,
  type Element,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

interface BurningHit {
  id: string;
  frame: number;
  element: Element;
  gaugeUnits?: number;
}

function makeBurningRefreshConfig(
  mode: AuraReactionEngineConfig["mode"],
  initialAura: NonNullable<
    NonNullable<SimConfig["enemy"]["targets"]>[number]["initialAura"]
  >,
  hits: BurningHit[]
): SimConfig {
  const base = makeConfig();
  const animationEndFrame =
    Math.max(...hits.map((hit) => hit.frame)) + 1;

  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Burning refresh target",
          position: { x: 0, y: 0 },
          initialAura
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Burning refresh tester",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 12,
      abilities: [
        {
          id: "burning-refresh-sequence",
          actorId: "tester",
          name: "Burning refresh sequence",
          kind: "skill",
          cancelFrame: animationEndFrame,
          animationEndFrame,
          cooldownFrames: 0,
          hits: hits.map((hit) => ({
            id: hit.id,
            label: hit.id,
            frame: hit.frame,
            scaling: 1,
            element: hit.element,
            geometry: {
              kind: "circle" as const,
              coordinateSpace: "world" as const,
              origin: { x: 0, y: 0 },
              radius: 0.1
            },
            application: {
              gaugeUnits: hit.gaugeUnits ?? 1,
              icdTag: hit.id,
              icdGroup: "no-icd" as const
            }
          }))
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: "burning-refresh-sequence",
          atFrame: 0
        }
      ]
    }
  };
}

function directHits(result: ReturnType<typeof simulate>) {
  return result.damageEvents.filter(
    (event) => event.kind === "direct"
  );
}

describe("aura-v7 Burning refresh projection", () => {
  it("counts only the Burning start as a reacted hit while retaining Dendro-fuel and Pyro-snapshot refresh audits", () => {
    const hits: BurningHit[] = [
      { id: "burning-start", frame: 0, element: "pyro" },
      {
        id: "dendro-fuel-refresh",
        frame: 1,
        element: "dendro",
        gaugeUnits: 0.5
      },
      {
        id: "pyro-snapshot-refresh",
        frame: 2,
        element: "pyro"
      }
    ];
    const v7 = simulate(
      makeBurningRefreshConfig(
        "aura-v7",
        [{ element: "dendro", gaugeUnits: 2 }],
        hits
      ),
      { critMode: "allCrit" }
    );
    const v7Direct = directHits(v7);

    expect(v7.reactedHits).toBe(1);
    expect(
      v7Direct.map((event) => ({
        reaction: event.reaction,
        reactions: event.reactionAudit.reactions,
        burningOperation:
          event.reactionAudit.burningReaction?.operation ?? null,
        burningTriggered:
          event.reactionAudit.burningReaction
            ?.reactionTriggered ?? null
      }))
    ).toEqual([
      {
        reaction: "burning",
        reactions: ["burning"],
        burningOperation: "start",
        burningTriggered: true
      },
      {
        reaction: "none",
        reactions: [],
        burningOperation: "refresh-fuel",
        burningTriggered: false
      },
      {
        reaction: "none",
        reactions: [],
        burningOperation: "refresh-snapshot",
        burningTriggered: false
      }
    ]);

    const v6 = simulate(
      makeBurningRefreshConfig(
        "aura-v6",
        [{ element: "dendro", gaugeUnits: 2 }],
        hits
      ),
      { critMode: "allCrit" }
    );
    const v6Direct = directHits(v6);

    // aura-v6 is the frozen compatibility projection: both refresh forms
    // remain exposed as top-level Burning reactions and therefore reactedHits.
    expect(v6.reactedHits).toBe(3);
    expect(
      v6Direct.map((event) => ({
        reaction: event.reaction,
        reactions: event.reactionAudit.reactions,
        burningOperation:
          event.reactionAudit.burningReaction?.operation ?? null
      }))
    ).toEqual([
      {
        reaction: "burning",
        reactions: ["burning"],
        burningOperation: "start"
      },
      {
        reaction: "burning",
        reactions: ["burning"],
        burningOperation: "refresh-fuel"
      },
      {
        reaction: "burning",
        reactions: ["burning"],
        burningOperation: "refresh-snapshot"
      }
    ]);
  });

  it("lists only Spread for a same-hit Spread plus Burning-fuel refresh while preserving the refresh audit", () => {
    const config = makeBurningRefreshConfig(
      "aura-v7",
      [{ element: "electro", gaugeUnits: 1 }],
      [
        { id: "quicken-start", frame: 0, element: "dendro" },
        { id: "burning-start", frame: 1, element: "pyro" },
        {
          id: "spread-and-fuel-refresh",
          frame: 2,
          element: "dendro",
          gaugeUnits: 0.5
        }
      ]
    );
    const result = simulate(config, { critMode: "allCrit" });
    const spread = directHits(result)[2]!;

    expect(result.reactedHits).toBe(3);
    expect(spread.reaction).toBe("spread");
    expect(spread.reactionAudit.reactions).toEqual(["spread"]);
    expect(spread.reactionAudit.catalyzeReaction?.additive).toMatchObject({
      reaction: "spread"
    });
    expect(spread.reactionAudit.burningReaction).toMatchObject({
      operation: "refresh-fuel",
      reactionTriggered: false,
      fuelOperation: "overwrite"
    });
  });
});
