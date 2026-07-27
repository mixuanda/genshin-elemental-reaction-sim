import {
  playerDamageResultReferencesSchema,
  type AbilityDefinition,
  type CharacterProfile,
  type Element,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const ZERO_RESISTANCES = {
  pyro: 0,
  cryo: 0,
  hydro: 0,
  electro: 0,
  anemo: 0,
  geo: 0,
  dendro: 0,
  physical: 0
} as const;

function character(
  template: CharacterProfile,
  id: string,
  element: Element,
  level = 90
): CharacterProfile {
  return {
    ...template,
    id,
    name: id,
    element,
    level,
    stats: {
      ...neutralStats,
      baseAtk: 0,
      baseHp: 10_000,
      em: 0
    }
  };
}

function withPlayerDamage(
  config: SimConfig,
  {
    position = { x: 0, y: 0 },
    hitboxRadius = 0.5,
    initialHpRatio = 1
  }: {
    position?: { x: number; y: number };
    hitboxRadius?: number;
    initialHpRatio?: number;
  } = {}
): SimConfig {
  return {
    ...config,
    playerDamageModel: {
      mode: "reaction-self-v1",
      position,
      hitboxRadius,
      shieldMode: "crystallize-v1",
      zeroHpPolicy: "clamp-and-continue",
      characters: config.characters.map((entry) => ({
        actorId: entry.id,
        initialHpRatio,
        resistances: { ...ZERO_RESISTANCES }
      }))
    }
  };
}

function noIcd(id: string) {
  return {
    gaugeUnits: 1,
    icdTag: id,
    icdGroup: "no-icd" as const
  };
}

function makeBurningScenario({
  playerPosition = { x: 0, y: 0 },
  initialHpRatio = 1,
  includeSwap = false
}: {
  playerPosition?: { x: number; y: number };
  initialHpRatio?: number;
  includeSwap?: boolean;
} = {}): SimConfig {
  const base = makeConfig();
  const pyro = character(
    base.characters[0]!,
    "pyro",
    "pyro"
  );
  const reserve = character(
    base.characters[0]!,
    "reserve",
    "hydro"
  );
  const pyroAbility: AbilityDefinition = {
    id: "pyro-start-burning",
    actorId: pyro.id,
    name: "start Burning",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "pyro-hit",
        label: "Pyro application",
        frame: 0,
        scaling: 0,
        element: "pyro",
        geometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: { x: 0, y: 0 },
          radius: 1
        },
        application: noIcd("pyro-start-burning")
      }
    ]
  };
  const reserveAbility: AbilityDefinition = {
    id: "reserve-action",
    actorId: reserve.id,
    name: "reserve action",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: []
  };
  const config: SimConfig = {
    ...base,
    duration: 1.1,
    cycleLength: 1.1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Burning source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "dendro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: includeSwap ? [pyro, reserve] : [pyro],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: pyro.id,
      swapFrames: 1,
      abilities: includeSwap
        ? [pyroAbility, reserveAbility]
        : [pyroAbility],
      commands: [
        {
          type: "skill",
          actorId: pyro.id,
          abilityId: pyroAbility.id,
          atFrame: 0
        },
        ...(includeSwap
          ? [
              {
                type: "swap" as const,
                characterId: reserve.id,
                atFrame: 2
              },
              {
                type: "skill" as const,
                actorId: reserve.id,
                abilityId: reserveAbility.id,
                atFrame: 3
              }
            ]
          : [])
      ]
    }
  };
  return withPlayerDamage(config, {
    position: playerPosition,
    initialHpRatio
  });
}

function makeThreeBloomScenario(): SimConfig {
  const base = makeConfig();
  const hydro = character(
    base.characters[0]!,
    "hydro",
    "hydro"
  );
  const ability: AbilityDefinition = {
    id: "three-blooms",
    actorId: hydro.id,
    name: "three Blooms",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: Array.from({ length: 3 }, (_, index) => ({
      id: `hydro-${index}`,
      label: `Hydro ${index}`,
      frame: 0,
      scaling: 0,
      element: "hydro" as const,
      targeting: {
        targetId: "enemy-0",
        outcome: "landed" as const
      },
      application: noIcd(`hydro-${index}`)
    }))
  };
  return withPlayerDamage(
    {
      ...base,
      duration: 6,
      cycleLength: 6,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "Bloom source",
            position: { x: 0, y: 0 },
            hitboxRadius: 0,
            initialAura: [
              { element: "dendro", gaugeUnits: 1.875 }
            ]
          }
        ]
      },
      characters: [hydro],
      rotation: [],
      reactionEngine: { mode: "aura-v5" },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: hydro.id,
        swapFrames: 1,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: hydro.id,
            abilityId: ability.id,
            atFrame: 0
          }
        ]
      }
    },
    { hitboxRadius: 10 }
  );
}

function makeShieldedBurningScenario(
  geoLevel: 1 | 90
): SimConfig {
  const base = makeConfig();
  const geo = character(
    base.characters[0]!,
    "geo",
    "geo",
    geoLevel
  );
  const dendro = character(
    base.characters[0]!,
    "dendro",
    "dendro"
  );
  const geoAbility: AbilityDefinition = {
    id: "geo-crystallize",
    actorId: geo.id,
    name: "create shard",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "geo-hit",
        label: "Geo application",
        frame: 0,
        scaling: 0,
        element: "geo",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        },
        application: noIcd("geo-crystallize")
      }
    ]
  };
  const dendroAbility: AbilityDefinition = {
    id: "dendro-burning",
    actorId: dendro.id,
    name: "start shielded Burning",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      {
        id: "dendro-hit",
        label: "Dendro application",
        frame: 0,
        scaling: 0,
        element: "dendro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed"
        },
        application: noIcd("dendro-burning")
      }
    ]
  };
  return withPlayerDamage({
    ...base,
    duration: 2,
    cycleLength: 2,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "shield reaction target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "pyro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [geo, dendro],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: geo.id,
      swapFrames: 1,
      abilities: [geoAbility, dendroAbility],
      commands: [
        {
          type: "skill",
          actorId: geo.id,
          abilityId: geoAbility.id,
          atFrame: 0
        },
        {
          type: "pickUpCrystallize",
          element: "pyro",
          atFrame: 54
        },
        {
          type: "swap",
          characterId: dendro.id,
          atFrame: 55
        },
        {
          type: "skill",
          actorId: dendro.id,
          abilityId: dendroAbility.id,
          atFrame: 56
        }
      ]
    }
  });
}

function validatePlayerResult(
  result: ReturnType<typeof simulate>
): void {
  expect(() =>
    playerDamageResultReferencesSchema.parse(result)
  ).not.toThrow();
}

describe("player reaction self-damage integration", () => {
  it("records inclusive circular hits and explicit out-of-range misses", () => {
    const hit = simulate(makeBurningScenario(), {
      critMode: "noCrit"
    });
    const miss = simulate(
      makeBurningScenario({
        playerPosition: { x: 10, y: 0 }
      }),
      { critMode: "noCrit" }
    );

    expect(hit.playerHitResolutionLog[0]).toMatchObject({
      reaction: "burning",
      outcome: "landed",
      blockedReason: null,
      targetActorId: "pyro"
    });
    expect(hit.playerDamageEvents[0]?.finalDamage).toBeGreaterThan(
      0
    );
    expect(
      hit.damageEvents.find(
        (event) =>
          event.reactionAudit.burningReaction !== null
      )?.reactionAudit.burningReaction?.selfDamageStatus
    ).toBe("modeled-player-reaction-damage");
    expect(miss.playerHitResolutionLog[0]).toMatchObject({
      reaction: "burning",
      outcome: "miss",
      blockedReason: "OUT_OF_RANGE",
      playerDamageEventId: null
    });
    expect(miss.playerDamageEvents).toEqual([]);
    validatePlayerResult(hit);
    validatePlayerResult(miss);
  });

  it("applies an independent player-avatar ReactionA sequence of true, true, false", () => {
    const result = simulate(makeThreeBloomScenario(), {
      critMode: "noCrit"
    });
    const bloomEvents = result.playerDamageEvents.filter(
      (entry) => entry.reaction === "bloom"
    );

    expect(bloomEvents).toHaveLength(3);
    expect(
      result.damageEvents
        .flatMap(
          (event) => event.reactionAudit.bloomReactions
        )
        .every(
          (audit) =>
            audit.selfDamageStatus ===
            "modeled-player-reaction-damage"
        )
    ).toBe(true);
    expect(
      bloomEvents.map(
        (entry) => entry.damageFactors.damageGroupMultiplier
      )
    ).toEqual([1, 1, 0]);
    expect(
      bloomEvents.map(
        (entry) =>
          entry.damageFactors.damageGroupDecision?.targetId
      )
    ).toEqual([
      "player-avatar",
      "player-avatar",
      "player-avatar"
    ]);
    expect(bloomEvents[2]).toMatchObject({
      finalDamage: 0,
      damageFactors: {
        sourcePreResistanceDamage: expect.any(Number),
        damageGroupDecision: {
          hitIndex: 2,
          damageAllowed: false,
          blockedReason: "REACTION_A_DAMAGE_ICD"
        }
      }
    });
    validatePlayerResult(result);
  });

  it("charges the character active on the reaction-damage frame", () => {
    const result = simulate(
      makeBurningScenario({ includeSwap: true }),
      { critMode: "noCrit" }
    );

    expect(result.playerDamageEvents[0]).toMatchObject({
      frame: 15,
      sourceActorId: "pyro",
      targetActorId: "reserve"
    });
    expect(
      result.playerHpSummaries.find(
        (entry) => entry.actorId === "pyro"
      )?.totalHpDamage
    ).toBe(0);
    expect(
      result.playerHpSummaries.find(
        (entry) => entry.actorId === "reserve"
      )?.totalHpDamage
    ).toBeGreaterThan(0);
    validatePlayerResult(result);
  });

  it.each([
    { level: 90 as const, operation: "absorb" as const },
    { level: 1 as const, operation: "break" as const }
  ])(
    "records Crystallize $operation before HP at Geo level $level",
    ({ level, operation }) => {
      const result = simulate(
        makeShieldedBurningScenario(level),
        { critMode: "noCrit" }
      );
      const damage = result.playerDamageEvents[0]!;
      const shieldMutation = result.crystallizeShieldLog.find(
        (entry) => entry.operation === operation
      );

      expect(shieldMutation).toMatchObject({
        operation,
        playerDamageEventId: damage.id,
        incomingElement: "pyro",
        baseHpBeforeAbsorption: expect.any(Number),
        absorbedDamage: expect.any(Number)
      });
      expect(
        damage.shieldResolution.absorbedDamage +
          damage.shieldResolution.damageAfterShield
      ).toBeCloseTo(damage.damageFactors.finalDamage, 10);
      if (operation === "absorb") {
        expect(damage.finalDamage).toBe(0);
        expect(
          damage.shieldResolution.baseHpAfter
        ).toBeGreaterThan(0);
      } else {
        expect(damage.finalDamage).toBeGreaterThan(0);
        expect(
          damage.shieldResolution.baseHpAfter
        ).toBe(0);
      }
      validatePlayerResult(result);
    }
  );

  it("clamps HP at zero and continues processing later reaction hits", () => {
    const result = simulate(
      makeBurningScenario({ initialHpRatio: 0.01 }),
      { critMode: "noCrit" }
    );

    expect(result.playerDamageEvents.length).toBeGreaterThanOrEqual(
      2
    );
    expect(result.playerDamageEvents[0]).toMatchObject({
      hpResolution: {
        currentHpBefore: 100,
        currentHpAfter: 0,
        actualLoss: 100
      },
      finalDamage: 100
    });
    expect(result.playerDamageEvents[1]).toMatchObject({
      hpResolution: {
        currentHpBefore: 0,
        currentHpAfter: 0,
        actualLoss: 0,
        overkill: expect.any(Number)
      },
      finalDamage: 0
    });
    expect(result.playerHpSummaries[0]).toMatchObject({
      finalHp: 0,
      zeroHpReached: true,
      hitCount: result.playerDamageEvents.length
    });
    validatePlayerResult(result);
  });

  it("keeps enemy damage values and ordering unchanged when player damage is disabled", () => {
    const enabledOutOfRange = simulate(
      makeBurningScenario({
        playerPosition: { x: 10, y: 0 }
      }),
      { critMode: "noCrit" }
    );
    const disabledConfig = {
      ...makeBurningScenario({
        playerPosition: { x: 10, y: 0 }
      }),
      playerDamageModel: { mode: "disabled" as const }
    };
    const disabled = simulate(disabledConfig, {
      critMode: "noCrit"
    });

    const compactEnemyDamage = (
      result: ReturnType<typeof simulate>
    ) =>
      result.damageEvents.map((event) => ({
        id: event.id,
        kind: event.kind,
        parentDamageEventId: event.parentDamageEventId,
        frame: event.frame,
        targetId: event.targetId,
        reaction: event.reaction,
        potentialDamage: event.potentialDamage,
        finalDamage: event.finalDamage,
        displayDamage: event.displayDamage,
        damageComposition: event.damageComposition
      }));
    expect(compactEnemyDamage(disabled)).toEqual(
      compactEnemyDamage(enabledOutOfRange)
    );
    expect(disabled.totalDamage).toBe(
      enabledOutOfRange.totalDamage
    );
    expect(disabled.playerSelfDamageStatus).toBe(
      "unsupported-player-damage-model"
    );
    expect(
      disabled.damageEvents.find(
        (event) =>
          event.reactionAudit.burningReaction !== null
      )?.reactionAudit.burningReaction?.selfDamageStatus
    ).toBe("unsupported-player-damage-model");
    expect(disabled.playerHitResolutionLog).toEqual([]);
    expect(disabled.playerDamageEvents).toEqual([]);
    expect(disabled.playerHpTimeline.points).toEqual([]);
    expect(disabled.playerHpSummaries).toEqual([]);
    expect(disabled.totalPlayerDamageTaken).toBe(0);
    validatePlayerResult(disabled);
  });
});
