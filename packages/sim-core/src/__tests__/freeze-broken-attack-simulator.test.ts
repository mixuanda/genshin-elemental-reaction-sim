import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import type {
  AbilityDefinition,
  Element,
  SimConfig,
} from "@genshin-dps-lab/schemas";
import {
  assertTrustedSimulationResultV152,
  simulationResultV152Schema,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it, vi } from "vitest";

import { SeededRandom } from "../energy";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const V1_MODEL = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const;

const V2_MODEL = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const;

type FreezeBrokenModel = SimConfig["freezeBrokenAttackModel"];

interface TestHit {
  id: string;
  at: number;
  element: Element;
  gaugeUnits?: number;
  strikeType?: "default" | "blunt";
  poiseDamage?: number;
}

function timelineHit(
  hit: TestHit,
): NonNullable<AbilityDefinition["hits"]>[number] {
  return {
    id: `${hit.id}-hit`,
    label: hit.id,
    frame: Math.round(hit.at * 60),
    scaling: 1,
    element: hit.element,
    ...(hit.strikeType === undefined ? {} : { strikeType: hit.strikeType }),
    ...(hit.poiseDamage === undefined ? {} : { poiseDamage: hit.poiseDamage }),
    ...(hit.gaugeUnits === undefined
      ? {}
      : {
          application: {
            gaugeUnits: hit.gaugeUnits,
            icd: { mode: "no-icd-v1" },
          },
        }),
  };
}

function makeFreezeBrokenConfig({
  model = V2_MODEL,
  initialCryoGaugeUnits = 1,
  preFreezeCryoGaugeUnits,
  createFreezeGaugeUnits = 1,
  duration = 1,
  followups = [],
}: {
  model?: FreezeBrokenModel;
  initialCryoGaugeUnits?: number;
  preFreezeCryoGaugeUnits?: number;
  createFreezeGaugeUnits?: number;
  duration?: number;
  followups?: TestHit[];
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration,
    cycleLength: duration,
    freezeBrokenAttackModel: model,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Freeze Broken test target",
          initialAura: [{ element: "cryo", gaugeUnits: initialCryoGaugeUnits }],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Test actor index zero",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
    ],
    reactionEngine: { mode: "aura-v2" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 1,
      abilities: [
        {
          id: "freeze-broken-sequence",
          actorId: "tester",
          name: "Freeze Broken test sequence",
          kind: "skill",
          cancelFrame:
            Math.max(0, ...followups.map((hit) => Math.round(hit.at * 60))) + 1,
          animationEndFrame:
            Math.max(0, ...followups.map((hit) => Math.round(hit.at * 60))) + 1,
          cooldownFrames: 0,
          hits: [
            ...(preFreezeCryoGaugeUnits === undefined
              ? []
              : [
                  timelineHit({
                    id: "fortify-test-cryo",
                    at: 0,
                    element: "cryo",
                    gaugeUnits: preFreezeCryoGaugeUnits,
                  }),
                ]),
            ...(createFreezeGaugeUnits > 0
              ? [
                  timelineHit({
                    id: "create-freeze",
                    at: preFreezeCryoGaugeUnits === undefined ? 0 : 1 / 60,
                    element: "hydro",
                    gaugeUnits: createFreezeGaugeUnits,
                  }),
                ]
              : []),
            ...followups.map(timelineHit),
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: "freeze-broken-sequence",
        },
      ],
    },
  };
}

const ELIGIBLE_SCENARIOS = [
  {
    name: "natural expiry",
    config: () => makeFreezeBrokenConfig({ duration: 4 }),
    reaction: "freeze",
    operation: "expire",
    sourceFreezeDamageEventId: 0,
  },
  {
    name: "blunt poise depletion",
    config: () =>
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "poise",
            at: 0.1,
            element: "physical",
            strikeType: "blunt",
            poiseDamage: 300,
          },
        ],
      }),
    reaction: "shatter",
    operation: "poise-consume",
    sourceFreezeDamageEventId: 0,
  },
  {
    name: "Shatter depletion",
    config: () =>
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "shatter",
            at: 0.1,
            element: "physical",
            strikeType: "blunt",
          },
        ],
      }),
    reaction: "shatter",
    operation: "shatter-consume",
    sourceFreezeDamageEventId: 0,
  },
  {
    name: "Frozen Cryo Swirl depletion",
    config: () =>
      makeFreezeBrokenConfig({
        initialCryoGaugeUnits: 0.25,
        followups: [
          {
            id: "swirl-cryo",
            at: 0.1,
            element: "anemo",
            gaugeUnits: 1,
          },
        ],
      }),
    reaction: "swirlCryo",
    operation: "consume",
    sourceFreezeDamageEventId: 0,
  },
  {
    name: "Frozen Cryo Crystallize depletion at a test-only gauge boundary",
    config: () =>
      makeFreezeBrokenConfig({
        // Test-only boundary: Geo first spends Frozen durability through its
        // Shatter path; the remaining gauge is then exactly depleted by the
        // Crystallize-Cryo consumption in the same configured hit.
        preFreezeCryoGaugeUnits: 5.3125,
        createFreezeGaugeUnits: 5.3125,
        followups: [
          {
            id: "crystallize-cryo",
            at: 0.1,
            element: "geo",
            gaugeUnits: 1,
          },
        ],
      }),
    reaction: "crystallizeCryo",
    operation: "consume",
    sourceFreezeDamageEventId: 1,
  },
] as const;

function withModel(config: SimConfig, model: FreezeBrokenModel): SimConfig {
  return { ...structuredClone(config), freezeBrokenAttackModel: model };
}

function expectNoCombatOutputDelta(
  v1: ReturnType<typeof simulate>,
  v2: ReturnType<typeof simulate>,
): void {
  expect(v2.damageEvents).toEqual(v1.damageEvents);
  expect(v2.hitEvents).toEqual(v1.hitEvents);
  expect(v2.hitResolutionLog).toEqual(v1.hitResolutionLog);
  expect(v2.reactedHits).toBe(v1.reactedHits);
  expect(v2.byCharacter).toEqual(v1.byCharacter);
  expect(v2.characterSummaries).toEqual(v1.characterSummaries);
  expect(v2.targetSummaries).toEqual(v1.targetSummaries);
  expect(v2.bySkill).toEqual(v1.bySkill);
  expect(v2.perSecond).toEqual(v1.perSecond);
  expect(v2.damageCurve).toEqual(v1.damageCurve);
  expect(v2.totalDamage).toBe(v1.totalDamage);
  expect(v2.dps).toBe(v1.dps);
}

type SimulationOutput = ReturnType<typeof simulate>;

interface FullResultMutationCase {
  name: string;
  source: "v1" | "v2";
  mutate: (forged: SimulationOutput, validV2: SimulationOutput) => void;
}

function requireFreezeBrokenRow(result: SimulationOutput) {
  const row = result.freezeBrokenAttackLog[0];
  if (row === undefined) {
    throw new Error("the test fixture requires one Freeze Broken audit row");
  }
  return row;
}

function expectPublicAndTrustedResultRejected(result: SimulationOutput): void {
  expect(simulationResultV152Schema.safeParse(result).success).toBe(false);
  expect(() => assertTrustedSimulationResultV152(result)).toThrow(
    /Trusted SimulationResult 1\.52 integrity validation failed/,
  );
}

const FULL_RESULT_MUTATIONS = [
  {
    name: "missing the natural-expiry audit row",
    source: "v2",
    mutate: (forged) => {
      forged.freezeBrokenAttackLog = [];
    },
  },
  {
    name: "duplicating the natural-expiry audit row",
    source: "v2",
    mutate: (forged) => {
      forged.freezeBrokenAttackLog.push({
        ...structuredClone(requireFreezeBrokenRow(forged)),
        id: forged.freezeBrokenAttackLog.length,
      });
    },
  },
  {
    name: "referencing a missing Frozen-state source row",
    source: "v2",
    mutate: (forged) => {
      requireFreezeBrokenRow(forged).sourceFrozenStateLogId =
        forged.frozenStateLog.length + 100;
    },
  },
  {
    name: "drifting sourceFreezeDamageEventId",
    source: "v2",
    mutate: (forged) => {
      requireFreezeBrokenRow(forged).sourceFreezeDamageEventId = null;
    },
  },
  {
    name: "drifting the trigger owner tuple",
    source: "v2",
    mutate: (forged) => {
      requireFreezeBrokenRow(forged).triggerEventSequence += 1;
    },
  },
  {
    name: "moving the audit before its terminal Frozen mutation",
    source: "v2",
    mutate: (forged) => {
      const audit = requireFreezeBrokenRow(forged);
      const source = forged.frozenStateLog.find(
        (entry) => entry.id === audit.sourceFrozenStateLogId,
      );
      const owner = forged.targetStateTimeline.points.find(
        (point) =>
          source !== undefined &&
          point.frame === source.frame &&
          point.targetId === source.targetId &&
          point.links.some(
            (link) => link.kind === "frozen-state-log" && link.id === source.id,
          ),
      );
      if (owner?.intraEventSequence === null || owner === undefined) {
        throw new Error("the natural-expiry fixture requires one owner point");
      }
      audit.intraEventSequence = owner.intraEventSequence;
    },
  },
  {
    name: "making the legacy V1 audit log non-empty",
    source: "v1",
    mutate: (forged, validV2) => {
      forged.freezeBrokenAttackLog = [
        structuredClone(requireFreezeBrokenRow(validV2)),
      ];
    },
  },
  {
    name: "forging a Freeze Broken DamageEvent",
    source: "v2",
    mutate: (forged) => {
      const event = forged.damageEvents[0];
      if (event === undefined) {
        throw new Error("the test fixture requires one ordinary DamageEvent");
      }
      event.actionName = "Freeze Broken";
    },
  },
] satisfies readonly FullResultMutationCase[];

function simulateWithRandomTrace(config: SimConfig): {
  result: SimulationOutput;
  randomTrace: number[];
} {
  const randomTrace: number[] = [];
  const originalNext = SeededRandom.prototype.next;
  const nextSpy = vi
    .spyOn(SeededRandom.prototype, "next")
    .mockImplementation(function (this: SeededRandom) {
      const value = originalNext.call(this);
      randomTrace.push(value);
      return value;
    });
  try {
    return {
      result: simulate(config, {
        compatibilityMode: "legal-frame-v1",
        critMode: "average",
        randomSeed: "freeze-broken-rng-non-consumption",
      }),
      randomTrace,
    };
  } finally {
    nextSpy.mockRestore();
  }
}

describe("Freeze Broken V1.52 simulator matrix", () => {
  it.each(ELIGIBLE_SCENARIOS)(
    "emits exactly one audit-only V2 row for $name",
    ({ config, reaction, operation, sourceFreezeDamageEventId }) => {
      const base = config();
      const v1 = simulate(withModel(base, V1_MODEL), { critMode: "noCrit" });
      const v2 = simulate(withModel(base, V2_MODEL), { critMode: "noCrit" });

      expect(v1.freezeBrokenAttackLog).toEqual([]);
      expect(v1.mechanicsStatus).toBe("complete");
      expect(v2.mechanicsStatus).toBe("partial");
      expect(v2.freezeBrokenAttackLog).toHaveLength(1);
      expect(v2.freezeBrokenAttackLog[0]).toMatchObject({
        id: 0,
        reaction,
        depletionOperation: operation,
        sourceFreezeDamageEventId,
        executionStatus: "reference-audit-only-not-dispatched",
        damageEventId: null,
        hitResolutionLogId: null,
        frozenGaugeAfter: 0,
        attack: {
          actorIndex: 0,
          resolvedActorId: "tester",
          damageSource: "receiving-target",
          damageSourceTargetId: "enemy-0",
          ability: "Freeze Broken",
          durability: 0,
          multiplier: 0,
          flatDamage: 0,
          snapshotDelayFrames: -1,
          damageDelayFrames: 0,
          sourceIsSim: true,
          doNotLog: true,
        },
        syncPhase: {
          disposition: "reference-audit-only-not-dispatched",
        },
        endOfFramePhase: {
          disposition: "reference-audit-only-not-dispatched",
          damage: 0,
        },
      });
      expectNoCombatOutputDelta(v1, v2);
    },
  );

  it.each([
    {
      name: "Melt",
      followup: {
        id: "melt",
        at: 0.1,
        element: "pyro",
        gaugeUnits: 2,
      } satisfies TestHit,
      reaction: "melt",
    },
    {
      name: "Frozen Superconduct",
      followup: {
        id: "superconduct",
        at: 0.1,
        element: "electro",
        gaugeUnits: 2,
      } satisfies TestHit,
      reaction: "superconduct",
    },
  ])("excludes terminal $name consumption", ({ followup, reaction }) => {
    const result = simulate(makeFreezeBrokenConfig({ followups: [followup] }), {
      critMode: "noCrit",
    });

    expect(result.frozenStateLog).toContainEqual(
      expect.objectContaining({ reaction, operation: "consume" }),
    );
    expect(result.freezeBrokenAttackLog).toEqual([]);
    expect(result.mechanicsStatus).toBe("complete");
  });

  it("does not trigger on partial Frozen consumption", () => {
    const result = simulate(
      makeFreezeBrokenConfig({
        followups: [
          {
            id: "partial-swirl",
            at: 0.1,
            element: "anemo",
            gaugeUnits: 1,
          },
        ],
      }),
      { critMode: "noCrit" },
    );

    expect(result.frozenStateLog).toContainEqual(
      expect.objectContaining({
        reaction: "swirlCryo",
        operation: "consume",
        auraAfter: expect.arrayContaining([
          expect.objectContaining({ element: "frozen" }),
        ]),
      }),
    );
    expect(result.freezeBrokenAttackLog).toEqual([]);
    expect(result.mechanicsStatus).toBe("complete");
  });

  it("uses the actual Frozen Swirl audit when Hydro Swirl is the primary label", () => {
    const result = simulate(
      makeFreezeBrokenConfig({
        initialCryoGaugeUnits: 0.25,
        followups: [
          {
            id: "attach-hydro-beside-frozen",
            at: 0.05,
            element: "hydro",
            gaugeUnits: 1,
          },
          {
            id: "mixed-hydro-frozen-swirl",
            at: 0.1,
            element: "anemo",
            gaugeUnits: 3,
          },
        ],
      }),
      { critMode: "noCrit" },
    );
    const mixedHit = result.damageEvents.find(
      (event) => event.hitId === "mixed-hydro-frozen-swirl-hit",
    );

    expect(mixedHit?.reactionAudit).toMatchObject({
      reaction: "swirlHydro",
      reactions: expect.arrayContaining(["swirlHydro", "swirlCryo"]),
      swirlReactions: expect.arrayContaining([
        expect.objectContaining({
          reaction: "swirlCryo",
          consumedAuraElement: "frozen",
        }),
      ]),
      frozenReaction: {
        operation: "consume",
        frozenGaugeAfter: 0,
      },
    });
    expect(result.freezeBrokenAttackLog).toEqual([
      expect.objectContaining({
        reaction: "swirlCryo",
        depletionOperation: "consume",
      }),
    ]);
    expect(result.mechanicsStatus).toBe("partial");
    expect(simulationResultV152Schema.safeParse(result).success).toBe(true);

    const forgedLegacyPrimaryLabelProjection = structuredClone(result);
    forgedLegacyPrimaryLabelProjection.frozenStateLog.find(
      (entry) => entry.triggerDamageEventId === mixedHit?.id,
    )!.reaction = "freeze";
    expect(
      simulationResultV152Schema.safeParse(forgedLegacyPrimaryLabelProjection)
        .success,
    ).toBe(false);
    expect(() =>
      assertTrustedSimulationResultV152(forgedLegacyPrimaryLabelProjection),
    ).toThrow(/Frozen state reaction must equal swirlCryo; received freeze/);
  });

  it("ignores the stale first expiry and emits only the replacement Freeze expiry", () => {
    const result = simulate(
      makeFreezeBrokenConfig({
        duration: 4,
        followups: [
          { id: "consume-old-freeze", at: 0.1, element: "pyro", gaugeUnits: 2 },
          { id: "attach-new-cryo", at: 0.15, element: "cryo", gaugeUnits: 1 },
          { id: "create-new-freeze", at: 0.2, element: "hydro", gaugeUnits: 1 },
        ],
      }),
      { critMode: "noCrit" },
    );

    const expiryRows = result.frozenStateLog.filter(
      (entry) => entry.operation === "expire",
    );
    expect(expiryRows).toHaveLength(1);
    expect(result.freezeBrokenAttackLog).toEqual([
      expect.objectContaining({
        sourceFrozenStateLogId: expiryRows[0]!.id,
        reaction: "freeze",
        depletionOperation: "expire",
      }),
    ]);
  });

  it.each(ELIGIBLE_SCENARIOS)(
    "keeps V1 output empty for $name",
    ({ config }) => {
      const result = simulate(withModel(config(), V1_MODEL), {
        critMode: "noCrit",
      });
      expect(result.freezeBrokenAttackLog).toEqual([]);
    },
  );

  it.each(FULL_RESULT_MUTATIONS)(
    "rejects full-result tampering in public and trusted validation: $name",
    ({ source, mutate }) => {
      const config = makeFreezeBrokenConfig({ duration: 4 });
      const validV1 = simulate(withModel(config, V1_MODEL), {
        critMode: "noCrit",
      });
      const validV2 = simulate(withModel(config, V2_MODEL), {
        critMode: "noCrit",
      });
      const forged = structuredClone(source === "v1" ? validV1 : validV2);

      mutate(forged, validV2);

      expectPublicAndTrustedResultRejected(forged);
    },
  );

  it("does not consume seeded RNG before post-expiry ordinary output", () => {
    const config = makeFreezeBrokenConfig({
      duration: 4,
      followups: [
        {
          id: "post-expiry-rng-probe",
          at: 3.5,
          element: "physical",
        },
      ],
    });
    config.characters[0]!.stats = {
      ...config.characters[0]!.stats,
      critRate: 0.5,
      critDmg: 1,
    };
    config.timeline!.abilities[0]!.particles = [
      {
        id: "post-expiry-random-particle-probe",
        source: "post-expiry ordinary-hit RNG probe",
        element: "hydro",
        kind: "particle",
        count: { min: 1, max: 3, step: 1 },
        travelFrames: 0,
        trigger: {
          kind: "hit-confirm",
          hitIds: ["post-expiry-rng-probe-hit"],
        },
      },
    ];

    // The public crit contract is currently deterministic
    // (average/allCrit/noCrit), so the random particle count is the engine's
    // live seeded-RNG probe after the ordinary average-crit hit.
    const v1 = simulateWithRandomTrace(withModel(config, V1_MODEL));
    const v2 = simulateWithRandomTrace(withModel(config, V2_MODEL));
    const v2Audit = requireFreezeBrokenRow(v2.result);
    const v1Probe = v1.result.damageEvents.find(
      (event) => event.hitId === "post-expiry-rng-probe-hit",
    );
    const v2Probe = v2.result.damageEvents.find(
      (event) => event.hitId === "post-expiry-rng-probe-hit",
    );

    expect(v1.randomTrace.length).toBeGreaterThan(0);
    expect(v2.randomTrace).toEqual(v1.randomTrace);
    expect(v2Probe?.frame).toBeGreaterThan(v2Audit.frame);
    expect(v2Probe).toEqual(v1Probe);
    expect(v2.result.particleEvents).toEqual(v1.result.particleEvents);
    expect(v2.result.particleTriggerLog).toEqual(v1.result.particleTriggerLog);
    expect(v2.result.energyLog).toEqual(v1.result.energyLog);
    expect(v2.result.energyStats).toEqual(v1.result.energyStats);
    expectNoCombatOutputDelta(v1.result, v2.result);
  });
});
