import { describe, expect, it } from "vitest";
import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID
} from "@genshin-dps-lab/icd-profiles";
import {
  assertTrustedSimulationResultV142,
  simulationResultV142Schema,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { AuraEngine } from "../aura";
import {
  calcAmplifyingReactionMultiplier,
  calcTransformativeReactionDamage
} from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

describe("AuraEngine Swirl durability and scheduling", () => {
  it("converts fixed gcsim durability exactly for a typical 1U Anemo hit", () => {
    const audit = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(1)
    });

    expect(audit).toMatchObject({
      triggered: true,
      reaction: "swirlPyro",
      auraBefore: [
        { element: "pyro", gaugeUnits: 0.8, expiresAtFrame: 426 }
      ],
      auraApplied: [{ element: "anemo", gaugeUnits: 1 }],
      auraConsumed: [{ element: "pyro", gaugeUnits: 0.5 }],
      auraAfter: [
        { element: "pyro", gaugeUnits: 0.3, expiresAtFrame: 160 }
      ],
      swirlReactions: [
        {
          reaction: "swirlPyro",
          swirledElement: "pyro",
          consumedAuraElement: "pyro",
          sourceGaugeUnitsBefore: 1,
          sourceGaugeUnitsSpent: 1,
          sourceGaugeUnitsAfter: 0,
          auraGaugeUnitsBefore: 0.8,
          auraConsumedGaugeUnits: 0.5,
          auraGaugeUnitsAfter: 0.3,
          propagatedGaugeUnits: 2.2,
          scheduled: true,
          blockedReason: null,
          nextAvailableFrame: 6,
          selfDamageFrame: 1,
          propagationDamageFrame: 5,
          selfBaseMultiplier: 0.6,
          propagationBaseMultiplier: 0.6,
          radius: 5
        }
      ]
    });
  });

  it("uses the partial-consumption propagation branch when Aura runs out first", () => {
    const audit = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(2)
    });

    expect(audit.swirlReactions[0]).toMatchObject({
      sourceGaugeUnitsBefore: 2,
      sourceGaugeUnitsSpent: 1.6,
      sourceGaugeUnitsAfter: 0.4,
      auraConsumedGaugeUnits: 0.8,
      propagatedGaugeUnits: 1.95
    });
    expect(audit.auraAfter).toEqual([]);
  });

  it("multi-swirls Electro then Hydro from coexisting Electro-Charged Aura", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(3)
    });

    expect(audit.swirlReactions.map((entry) => entry.reaction)).toEqual([
      "swirlElectro",
      "swirlHydro"
    ]);
    expect(audit.swirlReactions[0]).toMatchObject({
      sourceGaugeUnitsBefore: 3,
      sourceGaugeUnitsSpent: 1.6,
      sourceGaugeUnitsAfter: 1.4,
      propagatedGaugeUnits: 1.95
    });
    expect(audit.swirlReactions[1]).toMatchObject({
      sourceGaugeUnitsBefore: 1.4,
      sourceGaugeUnitsSpent: 1.4,
      sourceGaugeUnitsAfter: 0,
      auraConsumedGaugeUnits: 0.7,
      propagatedGaugeUnits: 2.7,
      propagationBaseMultiplier: 0
    });
    expect(audit.periodicReaction).toMatchObject({
      reaction: "electroCharged",
      operation: "stop"
    });
    expect(audit.auraAfter).toMatchObject([
      { element: "hydro", gaugeUnits: 0.1 }
    ]);
  });

  it("consumes Aura while the element-local 6-frame queue GCD blocks attacks", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "pyro", gaugeUnits: 3 }]
    });
    const hit = (frame: number) =>
      engine.processHit({
        frame,
        sourceActorId: "anemo",
        element: "anemo",
        application: noIcd(1)
      });

    expect(hit(0).swirlReactions[0]).toMatchObject({
      scheduled: true,
      nextAvailableFrame: 6
    });
    const blocked = hit(5);
    expect(blocked.swirlReactions[0]).toMatchObject({
      scheduled: false,
      blockedReason: "REACTION_QUEUE_GCD",
      nextAvailableFrame: 6
    });
    expect(blocked.auraConsumed).toEqual([
      { element: "pyro", gaugeUnits: 0.5 }
    ]);
    expect(hit(6).swirlReactions[0]).toMatchObject({
      scheduled: true,
      nextAvailableFrame: 12
    });
  });

  it("emits Cryo Swirl while consuming Frozen durability", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });
    const audit = engine.processHit({
      frame: 1,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(1)
    });

    expect(audit.reaction).toBe("swirlCryo");
    expect(audit.swirlReactions[0]).toMatchObject({
      swirledElement: "cryo",
      consumedAuraElement: "frozen",
      auraConsumedGaugeUnits: 0.5
    });
    expect(audit.frozenReaction).toMatchObject({
      operation: "consume",
      consumedGaugeUnits: 0.5
    });
  });
});

function makeSwirlSimulationConfig(
  secondaryAura:
    | "pyro"
    | "hydro"
    | "cryo"
    | "electro"
    | null = "hydro",
  swirledAura: "pyro" | "hydro" | "cryo" = "pyro"
): SimConfig {
  const base = makeConfig();
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
          name: "扩散源目标",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: swirledAura, gaugeUnits: 1 }
          ]
        },
        {
          id: "enemy-1",
          name: "传播目标",
          position: { x: 3, y: 0 },
          ...(secondaryAura === null
            ? {}
            : {
                initialAura: [
                  { element: secondaryAura, gaugeUnits: 1 }
                ]
              })
        },
        {
          id: "enemy-2",
          name: "范围外目标",
          position: { x: 5.1, y: 0 }
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo",
        element: "anemo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 12,
      abilities: [
        {
          id: "anemo-skill",
          actorId: "anemo",
          name: "Anemo Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "anemo-hit",
              label: "风命中",
              frame: 0,
              scaling: 1,
              element: "anemo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "anemo-skill"
        }
      ]
    }
  };
}

function expectSwirlMutationRejected(
  result: SimulationResult,
  mutate: (mutation: SimulationResult) => void
): void {
  const publicWire = structuredClone(result);
  mutate(publicWire);
  expect(
    simulationResultV142Schema.safeParse(publicWire).success
  ).toBe(false);

  const trustedResult = structuredClone(result);
  mutate(trustedResult);
  expect(() =>
    assertTrustedSimulationResultV142(trustedResult)
  ).toThrow(
    /Trusted SimulationResult 1\.42 integrity validation failed/
  );
}

interface NestedSwirlAmplifyingCase {
  label: string;
  swirledAura: "pyro" | "cryo";
  secondaryAura: "hydro" | "pyro";
  swirlReaction: "swirlPyro" | "swirlCryo";
  amplifyingReaction: "reverseVaporize" | "reverseMelt";
}

const NESTED_SWIRL_AMPLIFYING_CASES: readonly NestedSwirlAmplifyingCase[] =
  [
    {
      label: "Pyro Swirl into Hydro",
      swirledAura: "pyro",
      secondaryAura: "hydro",
      swirlReaction: "swirlPyro",
      amplifyingReaction: "reverseVaporize"
    },
    {
      label: "Cryo Swirl into Pyro",
      swirledAura: "cryo",
      secondaryAura: "pyro",
      swirlReaction: "swirlCryo",
      amplifyingReaction: "reverseMelt"
    }
  ];

type NestedBuffWindow = "active-f3-f8" | "expired-f0-f3";

function makeNestedSwirlAmplifyingConfig(
  vector: NestedSwirlAmplifyingCase,
  buffWindow: NestedBuffWindow
): SimConfig {
  const config = makeSwirlSimulationConfig(
    vector.secondaryAura,
    vector.swirledAura
  );
  const source = config.characters[0]!;
  config.characters = [
    source,
    {
      ...source,
      id: "scaling-proxy",
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
      id: "credit-proxy",
      name: "Credit Proxy",
      stats: {
        ...neutralStats,
        baseAtk: 3000,
        em: 700,
        reactionBonus: 0.7
      }
    }
  ];
  const ability = config.timeline!.abilities[0]!;
  const hit = ability.hits![0]!;
  const startFrame = buffWindow === "active-f3-f8" ? 3 : 0;
  const durationFrames = buffWindow === "active-f3-f8" ? 5 : 3;
  ability.cancelFrame = 8;
  ability.animationEndFrame = 8;
  ability.buffs = [
    {
      key: `nested-em-${buffWindow}`,
      label: `Nested EM ${buffWindow}`,
      target: "self",
      stat: "em",
      value: 400,
      startFrame,
      durationFrames
    },
    {
      key: `nested-reaction-bonus-${buffWindow}`,
      label: `Nested reaction bonus ${buffWindow}`,
      target: "self",
      stat: "reactionBonus",
      value: 0.3,
      startFrame,
      durationFrames
    }
  ];
  ability.hits = [
    {
      ...hit,
      reactionBonus: 0.05,
      scalingOwnerId: "scaling-proxy",
      creditId: "credit-proxy"
    }
  ];
  return config;
}

describe("Swirl simulation integration", () => {
  it("rejects Swirl source-delivery and ReactionA projection drift at both result boundaries", () => {
    const result = simulate(makeSwirlSimulationConfig(), {
      critMode: "noCrit"
    });

    expectSwirlMutationRejected(result, (mutation) => {
      const sourceAudit =
        mutation.damageEvents[0]!.reactionAudit
          .swirlReactions[0]!;
      const propagation = mutation.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "swirl-propagation"
      );
      if (propagation?.applicationGaugeUnits === null ||
          propagation === undefined) {
        throw new Error(
          "Swirl vector must expose a propagation application."
        );
      }
      sourceAudit.propagatedGaugeUnits = 2.3;
      propagation.applicationGaugeUnits = 2.3;
    });
    expectSwirlMutationRejected(result, (mutation) => {
      const propagation = mutation.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "swirl-propagation"
      );
      if (propagation?.applicationGaugeUnits === null ||
          propagation === undefined) {
        throw new Error(
          "Swirl vector must expose a propagation application."
        );
      }
      propagation.applicationGaugeUnits += 0.1;
    });
    expectSwirlMutationRejected(result, (mutation) => {
      mutation.damageEvents[0]!.reactionAudit.swirlReactions[0]!
        .selfDamageFrame += 1;
    });
    expectSwirlMutationRejected(result, (mutation) => {
      mutation.damageEvents[0]!.reactionAudit.swirlReactions[0]!
        .scheduled = false;
    });
    expectSwirlMutationRejected(result, (mutation) => {
      const child = mutation.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "swirlPyro"
      );
      if (child === undefined) {
        throw new Error(
          "Swirl vector must expose a reaction-damage child."
        );
      }
      child.reaction = "swirlHydro";
    });
    expectSwirlMutationRejected(result, (mutation) => {
      const child = mutation.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "swirlPyro"
      );
      if (child === undefined) {
        throw new Error(
          "Swirl vector must expose a reaction-damage child."
        );
      }
      child.element = "hydro";
    });
    expectSwirlMutationRejected(result, (mutation) => {
      const child = mutation.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reactionAudit.swirlDamageGroup !== null
      );
      if (child?.reactionAudit.swirlDamageGroup === null ||
          child === undefined) {
        throw new Error(
          "Swirl vector must expose a child damage-group audit."
        );
      }
      child.reactionAudit.swirlDamageGroup.reaction =
        "swirlHydro";
    });
    expectSwirlMutationRejected(result, (mutation) => {
      const child = mutation.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reactionAudit.swirlDamageGroup !== null
      );
      if (child?.reactionAudit.swirlDamageGroup === null ||
          child === undefined) {
        throw new Error(
          "Swirl vector must expose a child damage-group audit."
        );
      }
      child.reactionAudit.swirlDamageGroup.windowStartFrame += 1;
    });
    expectSwirlMutationRejected(result, (mutation) => {
      const propagation = mutation.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "swirl-propagation" &&
          entry.damageGroupDecisions.length > 0
      );
      const decision = propagation?.damageGroupDecisions[0];
      if (decision === undefined) {
        throw new Error(
          "Swirl vector must expose a ReactionA decision."
        );
      }
      decision.damageAllowed = !decision.damageAllowed;
    });
  });

  it("queues self and source-excluding propagation hits with secondary amplification", () => {
    const result = simulate(makeSwirlSimulationConfig(), {
      critMode: "allCrit"
    });
    const direct = result.damageEvents[0]!;
    const self = result.damageEvents.find(
      (event) =>
        event.reaction === "swirlPyro" &&
        event.frame === 1
    )!;
    const propagation = result.damageEvents.find(
      (event) =>
        event.reaction === "swirlPyro" &&
        event.frame === 5
    )!;
    const base = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 0.6,
      effectiveResistance: 0.1
    });
    const amplify = calcAmplifyingReactionMultiplier({
      reaction: "reverseVaporize",
      elementalMastery: 100,
      reactionBonus: 0.2
    });

    expect(direct).toMatchObject({
      kind: "direct",
      frame: 0,
      targetId: "enemy-0",
      reaction: "swirlPyro",
      reactionAudit: {
        swirlReactions: [
          {
            propagatedGaugeUnits: 2.2,
            selfDamageFrame: 1,
            propagationDamageFrame: 5
          }
        ]
      }
    });
    expect(self).toMatchObject({
      targetId: "enemy-0",
      parentDamageEventId: direct.id,
      reactionAudit: {
        model: "reaction-damage",
        swirlDamageGroup: {
          hitIndex: 0,
          damageAllowed: true
        }
      }
    });
    expect(self.finalDamage).toBeCloseTo(base.finalDamage, 10);
    expect(propagation).toMatchObject({
      targetId: "enemy-1",
      parentDamageEventId: direct.id,
      reactionAudit: {
        model: "aura-engine",
        reaction: "reverseVaporize",
        applicationGaugeUnits: 2.2,
        swirlDamageGroup: {
          hitIndex: 0,
          damageAllowed: true
        }
      },
      damageFactors: {
        amplifyingReactionMultiplier: amplify.total
      }
    });
    expect(propagation.finalDamage).toBeCloseTo(
      base.finalDamage * amplify.total,
      10
    );
    expect(
      result.damageEvents.some(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.targetId === "enemy-2"
      )
    ).toBe(false);
    expect(result.reactionDamageLog).toMatchObject([
      {
        reaction: "swirlPyro",
        scheduleKind: "swirl-self",
        damageFrame: 1,
        excludedTargetIds: [],
        hitTargetIds: ["enemy-0"]
      },
      {
        reaction: "swirlPyro",
        scheduleKind: "swirl-propagation",
        damageFrame: 5,
        applicationGaugeUnits: 2.2,
        excludedTargetIds: ["enemy-0"],
        checkedTargetIds: ["enemy-1", "enemy-2"],
        hitTargetIds: ["enemy-1"]
      }
    ]);
    expect(
      result.auraTimeline.some(
        (point) =>
          point.damageEventId === propagation.id &&
          point.reaction === "reverseVaporize"
      )
    ).toBe(true);
  });

  it("links a propagated Overload as a child of the Swirl propagation hit", () => {
    const result = simulate(
      makeSwirlSimulationConfig("electro"),
      { critMode: "noCrit" }
    );
    const propagation = result.damageEvents.find(
      (event) =>
        event.reaction === "swirlPyro" &&
        event.frame === 5 &&
        event.targetId === "enemy-1"
    )!;
    const overload = result.damageEvents.find(
      (event) =>
        event.reaction === "overload" &&
        event.parentDamageEventId === propagation.id &&
        event.targetId === "enemy-1"
    );

    expect(propagation.reactionAudit).toMatchObject({
      reaction: "overload",
      transformativeReaction: {
        damageFrame: 6,
        scheduled: true
      }
    });
    expect(overload).toMatchObject({
      frame: 6,
      targetId: "enemy-1",
      parentDamageEventId: propagation.id
    });
  });

  it("schedules every aura-v6 transformative reaction caused by an Electro propagation", () => {
    const config = makeSwirlSimulationConfig(null);
    const targets = config.enemy.targets!;
    targets[0]!.initialAura = [
      { element: "electro", gaugeUnits: 1 }
    ];
    targets[1]!.initialAura = [
      { element: "pyro", gaugeUnits: 1 },
      { element: "cryo", gaugeUnits: 1 }
    ];
    config.reactionEngine = { mode: "aura-v6" };

    const result = simulate(config, { critMode: "noCrit" });
    const propagation = result.damageEvents.find(
      (event) =>
        event.reaction === "swirlElectro" &&
        event.frame === 5 &&
        event.targetId === "enemy-1"
    )!;
    const nested = result.damageEvents.filter(
      (event) =>
        event.parentDamageEventId === propagation.id &&
        event.frame === 6 &&
        event.targetId === "enemy-1"
    );

    expect(propagation.reactionAudit).toMatchObject({
      reaction: "overload",
      reactions: ["overload", "superconduct"],
      transformativeReactions: [
        {
          reaction: "overload",
          damageFrame: 6,
          scheduled: true
        },
        {
          reaction: "superconduct",
          damageFrame: 6,
          scheduled: true
        }
      ],
      unsupportedReactions: [],
      mechanicsTruncation: null
    });
    expect(
      nested.map(({ reaction, element, targetId }) => ({
        reaction,
        element,
        targetId
      }))
    ).toEqual([
      {
        reaction: "overload",
        element: "pyro",
        targetId: "enemy-1"
      },
      {
        reaction: "superconduct",
        element: "cryo",
        targetId: "enemy-1"
      }
    ]);
    expect(
      result.reactionDamageLog
        .filter(
          (entry) =>
            entry.triggerDamageEventId === propagation.id
        )
        .map(({ reaction, damageFrame }) => ({
          reaction,
          damageFrame
        }))
    ).toEqual([
      { reaction: "overload", damageFrame: 6 },
      { reaction: "superconduct", damageFrame: 6 }
    ]);
  });

  it("retains Hydro propagation as an auditable zero-damage application event", () => {
    const result = simulate(
      makeSwirlSimulationConfig(null, "hydro"),
      { critMode: "noCrit" }
    );
    const propagation = result.damageEvents.find(
      (event) =>
        event.reaction === "swirlHydro" &&
        event.frame === 5 &&
        event.targetId === "enemy-1"
    )!;

    expect(propagation).toMatchObject({
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0,
      reactionAudit: {
        applicationGaugeUnits: 2.2,
        auraApplied: [{ element: "hydro", gaugeUnits: 2.2 }]
      }
    });
    expect(
      propagation.reactionAudit.auraAfter?.[0]?.gaugeUnits
    ).toBeCloseTo(1.76, 10);
  });

  it("uses trigger-frame live EM and reaction bonus for an action-snapshot Swirl", () => {
    const config = makeSwirlSimulationConfig(null);
    const ability = config.timeline!.abilities[0]!;
    const hit = ability.hits![0]!;
    ability.cancelFrame = 11;
    ability.animationEndFrame = 11;
    ability.buffs = [
      {
        key: "swirl-live-em",
        label: "扩散命中帧精通",
        target: "self",
        stat: "em",
        value: 200,
        startFrame: 5,
        durationFrames: 6
      },
      {
        key: "swirl-live-reaction-bonus",
        label: "扩散命中帧反应增伤",
        target: "self",
        stat: "reactionBonus",
        value: 0.3,
        startFrame: 5,
        durationFrames: 6
      }
    ];
    ability.hits = [
      {
        ...hit,
        frame: 10,
        snapshot: "action"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const direct = result.damageEvents.find(
      (event) => event.hitId === "anemo-hit"
    );
    const self = result.damageEvents.find(
      (event) =>
        event.reaction === "swirlPyro" &&
        event.frame === 11 &&
        event.targetId === "enemy-0"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 300,
      reactionBonus: 0.5,
      baseMultiplier: 0.6,
      effectiveResistance: 0.1
    });

    expect(direct?.statsBeforeDamage).toMatchObject({
      em: 100,
      reactionBonus: 0.2
    });
    expect(self).toMatchObject({
      frame: 11,
      statsBeforeDamage: {
        em: 300,
        reactionBonus: 0.5
      },
      transformativeReactionFactors: {
        characterLevel: 90,
        elementalMastery: 300,
        reactionBonus: 0.5
      },
      damageFactors: {
        critMultiplier: 1,
        defenseMultiplier: 1
      }
    });
    expect(self?.finalDamage).toBeCloseTo(expected.finalDamage, 10);
  });

  it.each(
    NESTED_SWIRL_AMPLIFYING_CASES.flatMap((vector) =>
      (["active-f3-f8", "expired-f0-f3"] as const).map(
        (buffWindow) => ({
          ...vector,
          buffWindow
        })
      )
    )
  )(
    "$label uses trigger-frame EM and F+5 live reaction bonus with $buffWindow",
    (vector) => {
      const config = makeNestedSwirlAmplifyingConfig(
        vector,
        vector.buffWindow
      );
      const first = simulate(config, { critMode: "noCrit" });
      const repeated = simulate(config, { critMode: "noCrit" });
      const direct = first.damageEvents.find(
        (event) =>
          event.kind === "direct" &&
          event.hitId === "anemo-hit" &&
          event.targetId === "enemy-0"
      )!;
      const propagation = first.damageEvents.find(
        (event) =>
          event.reaction === vector.swirlReaction &&
          event.frame === 5 &&
          event.targetId === "enemy-1"
      )!;
      const buffActiveAtTrigger =
        vector.buffWindow === "expired-f0-f3";
      const elementalMastery = buffActiveAtTrigger ? 500 : 100;
      const transformativeReactionBonus =
        (buffActiveAtTrigger ? 0.5 : 0.2) + 0.05;
      const amplifyingReactionBonus =
        (buffActiveAtTrigger ? 0.2 : 0.5) + 0.05;
      const transformative = calcTransformativeReactionDamage({
        characterLevel: 90,
        elementalMastery,
        reactionBonus: transformativeReactionBonus,
        baseMultiplier: 0.6,
        effectiveResistance: 0.1
      });
      const amplifying = calcAmplifyingReactionMultiplier({
        reaction: vector.amplifyingReaction,
        elementalMastery,
        reactionBonus: amplifyingReactionBonus
      });

      expect(direct).toMatchObject({
        sourceActorId: "anemo",
        scalingOwnerId: "scaling-proxy",
        creditOwnerId: "credit-proxy"
      });
      expect(propagation).toMatchObject({
        sourceActorId: "anemo",
        scalingOwnerId: "anemo",
        creditOwnerId: "anemo",
        parentDamageEventId: direct.id,
        frame: 5,
        reaction: vector.swirlReaction,
        statsBeforeDamage: {
          em: elementalMastery,
          reactionBonus: buffActiveAtTrigger ? 0.5 : 0.2
        },
        reactionAudit: {
          reaction: vector.amplifyingReaction
        },
        transformativeReactionFactors: {
          elementalMastery,
          reactionBonus: transformativeReactionBonus
        },
        damageFactors: {
          amplifyingReactionMultiplier: amplifying.total
        }
      });
      expect(propagation.finalDamage).toBe(
        transformative.finalDamage * amplifying.total
      );
      expect(repeated.damageEvents).toEqual(first.damageEvents);
      expect(repeated.totalDamage).toBe(first.totalDamage);
      expect(repeated.reproducibilityKey).toBe(
        first.reproducibilityKey
      );
    }
  );

  it("applies ReactionA damage only to the first two target-local hits in 30 frames", () => {
    const base = makeConfig();
    const sourceTargets = ["enemy-0", "source-1", "source-2"];
    const config: SimConfig = {
      ...base,
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          ...sourceTargets.map((id, index) => ({
            id,
            name: id,
            position: { x: 0, y: index - 1 },
            initialAura: [
              { element: "pyro" as const, gaugeUnits: 3 }
            ]
          })),
          {
            id: "shared-target",
            name: "共同传播目标",
            position: { x: 1, y: 0 }
          }
        ]
      },
      characters: [
        {
          ...base.characters[0]!,
          id: "anemo",
          name: "Anemo",
          element: "anemo",
          level: 90,
          stats: {
            ...neutralStats,
            em: 100
          }
        }
      ],
      reactionEngine: { mode: "aura-v2" },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "anemo",
        swapFrames: 12,
        abilities: sourceTargets.map((targetId, index) => ({
          id: `swirl-${index}`,
          actorId: "anemo",
          name: `Swirl ${index}`,
          kind: "skill" as const,
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: `swirl-hit-${index}`,
              frame: 0,
              scaling: 1,
              element: "anemo" as const,
              targeting: {
                targetId,
                outcome: "landed" as const
              },
              application: noIcd(1)
            }
          ]
        })),
        commands: sourceTargets.map((_targetId, index) => ({
          type: "skill" as const,
          actorId: "anemo",
          abilityId: `swirl-${index}`,
          atFrame: index * 6
        }))
      }
    };
    const result = simulate(config, { critMode: "noCrit" });
    const sharedPropagation = result.damageEvents.filter(
      (event) =>
        event.reaction === "swirlPyro" &&
        event.targetId === "shared-target"
    );

    expect(
      sharedPropagation.map((event) => ({
        frame: event.frame,
        finalDamage: event.finalDamage,
        damageGroup: event.reactionAudit.swirlDamageGroup
      }))
    ).toMatchObject([
      {
        frame: 5,
        finalDamage: expect.any(Number),
        damageGroup: {
          hitIndex: 0,
          damageAllowed: true,
          blockedReason: null
        }
      },
      {
        frame: 11,
        finalDamage: expect.any(Number),
        damageGroup: {
          hitIndex: 1,
          damageAllowed: true,
          blockedReason: null
        }
      },
      {
        frame: 17,
        finalDamage: 0,
        damageGroup: {
          hitIndex: 2,
          damageAllowed: false,
          blockedReason: "REACTION_A_DAMAGE_ICD"
        }
      }
    ]);
    expect(sharedPropagation[0]?.finalDamage).toBeGreaterThan(0);
    expect(sharedPropagation[1]?.finalDamage).toBeGreaterThan(0);
    expect(
      sharedPropagation[2]?.reactionAudit.auraApplied
    ).toEqual([{ element: "pyro", gaugeUnits: 2.2 }]);
    expect(
      result.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "swirl-propagation" &&
          entry.damageFrame === 17
      )?.damageGroupBlockedTargetIds
    ).toContain("shared-target");
    const blockedLog = result.reactionDamageLog.find(
      (entry) =>
        entry.scheduleKind === "swirl-propagation" &&
        entry.damageFrame === 17
    );
    const blockedEvent = sharedPropagation[2];
    const sharedDecision = blockedLog?.damageGroupDecisions.find(
      (decision) => decision.targetId === "shared-target"
    );
    expect(sharedDecision).toEqual({
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      icdTag: "ICDTagSwirlPyro",
      icdGroup: "reaction-a",
      reaction: "swirlPyro",
      sourceActorId: "anemo",
      targetId: "shared-target",
      scopeKey:
        '["shared-target","anemo","ICDTagSwirlPyro"]',
      frame: 17,
      damageGroupTaskSequence: 15,
      windowGeneration: 0,
      windowStartFrame: 5,
      resetAtFrame: 34,
      resetTaskLogId: 3,
      resetTaskSequence: 9,
      hitIndex: 2,
      sequenceIndex: 2,
      sequenceMultiplier: 0,
      damageAllowed: false,
      blockedReason: "REACTION_A_DAMAGE_ICD"
    });
    expect(
      result.reactionDamageGroupResetLog.find(
        (entry) => entry.id === sharedDecision?.resetTaskLogId
      )
    ).toEqual({
      id: 3,
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
      sourceActorId: "anemo",
      targetId: "shared-target",
      scopeKey:
        '["shared-target","anemo","ICDTagSwirlPyro"]',
      reaction: "swirlPyro",
      icdTag: "ICDTagSwirlPyro",
      icdGroup: "reaction-a",
      windowGeneration: 0,
      windowStartFrame: 5,
      resetAtFrame: 34,
      taskSequence: 9,
      withinSimulation: true,
      executed: true,
      executedBeforeAttemptTaskSequence: null,
      executionFrame: 34,
      stale: false,
      invalidatedReason: null
    });
    expect(
      blockedLog?.damageGroupDecisions.map(
        (decision) => decision.targetId
      )
    ).toEqual(blockedLog?.hitTargetIds);
    expect(blockedLog?.damageEventIds).toContain(blockedEvent?.id);
    expect(
      result.damageEvents.find(
        (event) => event.id === blockedEvent?.id
      )
    ).toMatchObject({
      finalDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0
      },
      damageFactors: {
        groupMultiplier: 0
      }
    });
  });
});
