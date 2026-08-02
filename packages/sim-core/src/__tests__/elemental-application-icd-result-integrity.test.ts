import {
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function cloneResult(result: SimulationResult): SimulationResult {
  const cloned = structuredClone(result);
  cloned.hitEvents = cloned.damageEvents;
  return cloned;
}

function expectRejectedByPublicAndTrusted(
  result: SimulationResult,
  mutate: (forged: SimulationResult) => void,
): void {
  const publicWire = cloneResult(result);
  mutate(publicWire);
  expect(simulationResultSchema.safeParse(publicWire).success).toBe(false);

  const trusted = cloneResult(result);
  mutate(trusted);
  expect(() => assertTrustedSimulationResult(trusted)).toThrow(
    /Trusted SimulationResult 1\.53 integrity validation failed/,
  );
}

function expectRejectedByTrusted(
  result: SimulationResult,
  mutate: (forged: SimulationResult) => void,
): void {
  const trusted = cloneResult(result);
  mutate(trusted);
  expect(() => assertTrustedSimulationResult(trusted)).toThrow(
    /Trusted SimulationResult 1\.53 integrity validation failed/,
  );
}

function moveSingleRotationActionToTimeline(
  config: SimConfig,
  initialActiveCharacterId: string,
): SimConfig {
  const action = config.rotation[0];
  if (action === undefined) {
    throw new Error("test vector requires exactly one rotation action");
  }
  const hits = (action.hits ?? []).map(({ offset, ...hit }) => ({
    ...hit,
    frame: Math.round(offset * 60),
  }));

  return {
    ...config,
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId,
      swapFrames: 1,
      abilities: [
        {
          id: action.id,
          actorId: action.actorId,
          name: action.name,
          kind: "skill",
          cancelFrame: 0,
          animationEndFrame: Math.max(1, ...hits.map((hit) => hit.frame)),
          cooldownFrames: 0,
          hits,
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: action.actorId,
          abilityId: action.id,
          atFrame: 0,
        },
      ],
    },
  };
}

function applicationResultVector(): SimulationResult {
  return simulate(
    moveSingleRotationActionToTimeline(
      makeConfig({
        dataVersion: "application-icd-result-proof",
        randomSeed: "application-icd-result-proof",
        duration: 3,
        cycleLength: 3,
        enemy: {
          level: 90,
          resistance: 0.1,
          defReduction: 0,
          targets: [
            {
              id: "enemy-0",
              name: "Application target 0",
              initialAura: [{ element: "hydro", gaugeUnits: 4 }],
            },
            {
              id: "enemy-1",
              name: "Application target 1",
              initialAura: [{ element: "hydro", gaugeUnits: 4 }],
            },
          ],
        },
        reactionEngine: {
          mode: "aura-v2",
          icdProfiles: {
            custom: {
              resetFrames: 5,
              applicationSequence: [true, false],
              tailPolicy: "repeat",
            },
          },
        },
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 1,
          abilities: [],
          commands: [],
        },
        rotation: [
          {
            id: "proof:action:with:colons",
            actorId: "a",
            name: "Elemental application proof",
            at: 0,
            once: true,
            hits: [
              {
                id: "duplicate:visible:hit",
                offset: 0,
                scaling: 1,
                element: "pyro",
                targeting: {
                  mode: "fanout",
                  targets: [
                    { targetId: "enemy-0", outcome: "landed" },
                    { targetId: "enemy-1", outcome: "landed" },
                  ],
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-fixed-window",
                    groupId: "default",
                  },
                },
              },
              {
                id: "duplicate:visible:hit",
                offset: 1 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-fixed-window",
                    groupId: "nahida-skill",
                  },
                },
              },
              {
                id: "target-1-second",
                offset: 2 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-1",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-fixed-window",
                    groupId: "nahida-skill",
                  },
                },
              },
              {
                id: "switch-current-group",
                offset: 2 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-fixed-window",
                    groupId: "chasca-tap",
                  },
                },
              },
              {
                id: "before-opening-reset",
                offset: 148 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-fixed-window",
                    groupId: "nahida-skill",
                  },
                },
              },
              {
                id: "exact-opening-reset",
                offset: 149 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "shared-fixed-window",
                    groupId: "nahida-skill",
                  },
                },
              },
              {
                id: "skipped-miss",
                offset: 150 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "miss",
                  reason: "OUTSIDE_HITBOX",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "skip-stream",
                    groupId: "default",
                  },
                },
              },
              {
                id: "skipped-aura-blocked",
                offset: 151 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                  reason: "AURA_IMMUNE",
                  effects: {
                    damage: "normal",
                    aura: "blocked",
                    hitConfirm: "normal",
                  },
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "skip-stream",
                    groupId: "default",
                  },
                },
              },
              {
                id: "skip-stream-first-consumed",
                offset: 152 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "skip-stream",
                    groupId: "default",
                  },
                },
              },
              {
                id: "no-icd-bypass",
                offset: 153 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: { mode: "no-icd-v1" },
                },
              },
              {
                id: "legacy-open",
                offset: 154 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "legacy-boolean-profile-v1",
                    icdTag: "legacy-stream",
                    profileId: "custom",
                  },
                },
              },
              {
                id: "legacy-zero",
                offset: 155 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "legacy-boolean-profile-v1",
                    icdTag: "legacy-stream",
                    profileId: "custom",
                  },
                },
              },
              {
                id: "legacy-burning-open",
                offset: 156 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-1",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "legacy-boolean-profile-v1",
                    icdTag: "burning-tag-one",
                    profileId: "burning",
                  },
                },
              },
              {
                id: "legacy-burning-shared-target",
                offset: 157 / 60,
                scaling: 1,
                element: "pyro",
                targeting: {
                  targetId: "enemy-1",
                  outcome: "landed",
                },
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "legacy-boolean-profile-v1",
                    icdTag: "burning-tag-two",
                    profileId: "burning",
                  },
                },
              },
            ],
          },
        ],
      }),
      "a",
    ),
    { critMode: "noCrit" },
  );
}

function noAuraEngineResultVector(): SimulationResult {
  return simulate(
    makeConfig({
      dataVersion: "application-no-engine-proof",
      randomSeed: "application-no-engine-proof",
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "no-engine-action",
          actorId: "a",
          name: "No Aura engine application",
          at: 0,
          once: true,
          hits: [
            {
              id: "no-engine-hit",
              offset: 0,
              scaling: 1,
              element: "pyro",
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
    }),
    { critMode: "noCrit" },
  );
}

function truncatedResultVector(): SimulationResult {
  const base = makeConfig();
  return simulate(
    moveSingleRotationActionToTimeline(
      makeConfig({
        dataVersion: "application-truncated-proof",
        randomSeed: "application-truncated-proof",
        duration: 1,
        cycleLength: 1,
        characters: [
          {
            ...base.characters[0]!,
            id: "hydro-source",
            name: "Hydro source",
            element: "hydro",
          },
        ],
        enemy: {
          level: 90,
          resistance: 0.1,
          defReduction: 0,
          targets: [
            {
              id: "enemy-0",
              name: "Truncated target",
              initialAura: [
                { element: "pyro", gaugeUnits: 1 },
                { element: "electro", gaugeUnits: 1 },
              ],
            },
          ],
        },
        reactionEngine: { mode: "aura-v2" },
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "hydro-source",
          swapFrames: 1,
          abilities: [],
          commands: [],
        },
        rotation: [
          {
            id: "truncation-action",
            actorId: "hydro-source",
            name: "Application truncation proof",
            at: 0,
            once: true,
            hits: [
              {
                id: "truncation-trigger",
                offset: 0,
                scaling: 1,
                element: "hydro",
                application: {
                  gaugeUnits: 2,
                  icd: { mode: "no-icd-v1" },
                },
              },
              {
                id: "truncation-carry",
                offset: 1 / 60,
                scaling: 1,
                element: "hydro",
                application: {
                  gaugeUnits: 1,
                  icd: {
                    mode: "fixed-gcsim-application-v1",
                    icdTag: "must-not-consume",
                    groupId: "default",
                  },
                },
              },
            ],
          },
        ],
      }),
      "hydro-source",
    ),
    { critMode: "noCrit" },
  );
}

describe("elemental-application ICD result integrity", () => {
  it("accepts stable config replay, duplicate visible IDs, colon IDs, target isolation, group switches, and numeric Gauge", () => {
    const result = applicationResultVector();

    expect(simulationResultSchema.safeParse(result).success).toBe(true);
    expect(() => assertTrustedSimulationResult(result)).not.toThrow();

    expect(
      result.elementalApplicationIcdLog.map((entry) => ({
        frame: entry.frame,
        targetId: entry.targetId,
        hitId: entry.hitId,
        kind: entry.decision.kind,
        multiplier: entry.decision.applicationMultiplier,
        hitIndex:
          entry.decision.kind === "legacy-profile" ||
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.hitIndex
            : null,
        windowStartGroupId:
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.windowStartGroupId
            : null,
        resetAtFrame:
          entry.decision.kind === "legacy-profile" ||
          entry.decision.kind === "fixed-gcsim"
            ? entry.decision.resetAtFrame
            : null,
        effectiveGaugeUnits: entry.effectiveGaugeUnits,
      })),
    ).toEqual([
      {
        frame: 0,
        targetId: "enemy-0",
        hitId: "duplicate:visible:hit",
        kind: "fixed-gcsim",
        multiplier: 1,
        hitIndex: 0,
        windowStartGroupId: "default",
        resetAtFrame: 149,
        effectiveGaugeUnits: 1,
      },
      {
        frame: 0,
        targetId: "enemy-1",
        hitId: "duplicate:visible:hit",
        kind: "fixed-gcsim",
        multiplier: 1,
        hitIndex: 0,
        windowStartGroupId: "default",
        resetAtFrame: 149,
        effectiveGaugeUnits: 1,
      },
      {
        frame: 1,
        targetId: "enemy-0",
        hitId: "duplicate:visible:hit",
        kind: "fixed-gcsim",
        multiplier: 0,
        hitIndex: 1,
        windowStartGroupId: "default",
        resetAtFrame: 149,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 2,
        targetId: "enemy-1",
        hitId: "target-1-second",
        kind: "fixed-gcsim",
        multiplier: 0,
        hitIndex: 1,
        windowStartGroupId: "default",
        resetAtFrame: 149,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 2,
        targetId: "enemy-0",
        hitId: "switch-current-group",
        kind: "fixed-gcsim",
        multiplier: 0,
        hitIndex: 2,
        windowStartGroupId: "default",
        resetAtFrame: 149,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 148,
        targetId: "enemy-0",
        hitId: "before-opening-reset",
        kind: "fixed-gcsim",
        multiplier: 0,
        hitIndex: 3,
        windowStartGroupId: "default",
        resetAtFrame: 149,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 149,
        targetId: "enemy-0",
        hitId: "exact-opening-reset",
        kind: "fixed-gcsim",
        multiplier: 1.5,
        hitIndex: 0,
        windowStartGroupId: "nahida-skill",
        resetAtFrame: 208,
        effectiveGaugeUnits: 1.5,
      },
      {
        frame: 150,
        targetId: "enemy-0",
        hitId: "skipped-miss",
        kind: "skipped",
        multiplier: 0,
        hitIndex: null,
        windowStartGroupId: null,
        resetAtFrame: null,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 151,
        targetId: "enemy-0",
        hitId: "skipped-aura-blocked",
        kind: "skipped",
        multiplier: 0,
        hitIndex: null,
        windowStartGroupId: null,
        resetAtFrame: null,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 152,
        targetId: "enemy-0",
        hitId: "skip-stream-first-consumed",
        kind: "fixed-gcsim",
        multiplier: 1,
        hitIndex: 0,
        windowStartGroupId: "default",
        resetAtFrame: 301,
        effectiveGaugeUnits: 1,
      },
      {
        frame: 153,
        targetId: "enemy-0",
        hitId: "no-icd-bypass",
        kind: "no-icd",
        multiplier: 1,
        hitIndex: null,
        windowStartGroupId: null,
        resetAtFrame: null,
        effectiveGaugeUnits: 1,
      },
      {
        frame: 154,
        targetId: "enemy-0",
        hitId: "legacy-open",
        kind: "legacy-profile",
        multiplier: 1,
        hitIndex: 0,
        windowStartGroupId: null,
        resetAtFrame: 159,
        effectiveGaugeUnits: 1,
      },
      {
        frame: 155,
        targetId: "enemy-0",
        hitId: "legacy-zero",
        kind: "legacy-profile",
        multiplier: 0,
        hitIndex: 1,
        windowStartGroupId: null,
        resetAtFrame: 159,
        effectiveGaugeUnits: 0,
      },
      {
        frame: 156,
        targetId: "enemy-1",
        hitId: "legacy-burning-open",
        kind: "legacy-profile",
        multiplier: 1,
        hitIndex: 0,
        windowStartGroupId: null,
        resetAtFrame: 276,
        effectiveGaugeUnits: 1,
      },
      {
        frame: 157,
        targetId: "enemy-1",
        hitId: "legacy-burning-shared-target",
        kind: "legacy-profile",
        multiplier: 0,
        hitIndex: 1,
        windowStartGroupId: null,
        resetAtFrame: 276,
        effectiveGaugeUnits: 0,
      },
    ]);
    expect(
      result.elementalApplicationIcdLog
        .filter((entry) => entry.hitId.startsWith("legacy-burning-"))
        .map((entry) =>
          entry.decision.kind === "legacy-profile"
            ? {
                scope: entry.decision.scope,
                hitIndex: entry.decision.hitIndex,
              }
            : null,
        ),
    ).toEqual([
      { scope: "target-global-burning", hitIndex: 0 },
      { scope: "target-global-burning", hitIndex: 1 },
    ]);
  });

  it("emits every skipped target attempt without consuming state", () => {
    const result = applicationResultVector();
    const miss = result.elementalApplicationIcdLog.find(
      (entry) => entry.hitId === "skipped-miss",
    )!;
    const auraBlocked = result.elementalApplicationIcdLog.find(
      (entry) => entry.hitId === "skipped-aura-blocked",
    )!;
    expect(miss).toMatchObject({
      damageEventId: null,
      decision: {
        kind: "skipped",
        reason: "miss",
        consumed: false,
      },
    });
    expect(auraBlocked).toMatchObject({
      damageEventId: expect.any(Number),
      decision: {
        kind: "skipped",
        reason: "target-aura-blocked",
        consumed: false,
      },
    });

    const noEngine = noAuraEngineResultVector();
    expect(simulationResultSchema.safeParse(noEngine).success).toBe(true);
    expect(() => assertTrustedSimulationResult(noEngine)).not.toThrow();
    expect(noEngine.elementalApplicationIcdLog).toMatchObject([
      {
        damageEventId: expect.any(Number),
        decision: {
          kind: "skipped",
          reason: "no-aura-engine",
          consumed: false,
        },
      },
    ]);

    const truncated = truncatedResultVector();
    expect(simulationResultSchema.safeParse(truncated).success).toBe(true);
    expect(() => assertTrustedSimulationResult(truncated)).not.toThrow();
    expect(truncated.elementalApplicationIcdLog[1]).toMatchObject({
      damageEventId: expect.any(Number),
      decision: {
        kind: "skipped",
        reason: "mechanics-truncated",
        consumed: false,
      },
    });
  });

  it("rejects deletion, duplication, reordering, and stable hit-group substitution", () => {
    const result = applicationResultVector();
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.elementalApplicationIcdLog.pop();
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      forged.elementalApplicationIcdLog.push(
        structuredClone(forged.elementalApplicationIcdLog[0]!),
      );
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      const first = forged.elementalApplicationIcdLog[0]!;
      forged.elementalApplicationIcdLog[0] =
        forged.elementalApplicationIcdLog[1]!;
      forged.elementalApplicationIcdLog[1] = first;
    });
    expectRejectedByPublicAndTrusted(result, (forged) => {
      const row = forged.elementalApplicationIcdLog[0]!;
      const resolution = forged.hitResolutionLog[row.hitResolutionLogId]!;
      const event = forged.damageEvents[row.damageEventId!]!;
      const substituted = `${resolution.sourceActionId}:${resolution.cycle}:1:${resolution.frame}`;
      row.hitGroupId = substituted;
      resolution.hitGroupId = substituted;
      event.hitGroupId = substituted;
    });
  });

  it.each([
    [
      "selector",
      (result: SimulationResult) => {
        const row = result.elementalApplicationIcdLog[0]!;
        if (row.selector.mode === "fixed-gcsim-application-v1") {
          row.selector.groupId = "nahida-skill";
        }
      },
    ],
    [
      "selector tag",
      (result: SimulationResult) => {
        const row = result.elementalApplicationIcdLog[0]!;
        if (row.selector.mode === "fixed-gcsim-application-v1") {
          row.selector.icdTag = "forged-tag";
        }
      },
    ],
    [
      "decision group",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[0]!.decision;
        if (decision.kind === "fixed-gcsim") {
          decision.groupId = "nahida-skill";
        }
      },
    ],
    [
      "opening group",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[4]!.decision;
        if (decision.kind === "fixed-gcsim") {
          decision.windowStartGroupId = "chasca-tap";
        }
      },
    ],
    [
      "reset timer",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[0]!.decision;
        if (decision.kind === "fixed-gcsim") decision.resetFrames = 151;
      },
    ],
    [
      "reset boundary",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[0]!.decision;
        if (decision.kind === "fixed-gcsim") decision.resetAtFrame = 150;
      },
    ],
    [
      "window frame",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[0]!.decision;
        if (decision.kind === "fixed-gcsim") {
          decision.windowStartFrame = 1;
          decision.resetAtFrame = 150;
        }
      },
    ],
    [
      "hit index",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[2]!.decision;
        if (decision.kind === "fixed-gcsim") decision.hitIndex = 2;
      },
    ],
    [
      "sequence index",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[2]!.decision;
        if (decision.kind === "fixed-gcsim") decision.sequenceIndex = 2;
      },
    ],
    [
      "numeric multiplier",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[6]!.decision;
        if (decision.kind === "fixed-gcsim") {
          decision.applicationMultiplier = 1;
        }
      },
    ],
    [
      "nominal Gauge",
      (result: SimulationResult) => {
        result.elementalApplicationIcdLog[0]!.nominalGaugeUnits = 2;
      },
    ],
    [
      "effective Gauge",
      (result: SimulationResult) => {
        result.elementalApplicationIcdLog[6]!.effectiveGaugeUnits = 1;
      },
    ],
    [
      "damage backlink",
      (result: SimulationResult) => {
        result.elementalApplicationIcdLog[0]!.damageEventId = 1;
      },
    ],
    [
      "resolution backlink",
      (result: SimulationResult) => {
        result.elementalApplicationIcdLog[0]!.hitResolutionLogId = 1;
      },
    ],
    [
      "skip reason",
      (result: SimulationResult) => {
        const decision = result.elementalApplicationIcdLog[7]!.decision;
        if (decision.kind === "skipped") {
          decision.reason = "target-aura-blocked";
        }
      },
    ],
  ] as const)(
    "rejects %s tampering at public and trusted boundaries",
    (_label, mutate) => {
      expectRejectedByPublicAndTrusted(applicationResultVector(), mutate);
    },
  );

  it("rejects coordinated multiplier, effective Gauge, ReactionAudit, and Aura mutation forgery", () => {
    expectRejectedByPublicAndTrusted(applicationResultVector(), (forged) => {
      const row = forged.elementalApplicationIcdLog[2]!;
      const decision = row.decision;
      if (decision.kind !== "fixed-gcsim") {
        throw new Error("expected fixed decision");
      }
      decision.applicationMultiplier = 1;
      decision.allowed = true;
      row.effectiveGaugeUnits = row.nominalGaugeUnits;
      const event = forged.damageEvents[row.damageEventId!]!;
      event.reactionAudit.icdAllowed = true;
      event.reactionAudit.applicationGaugeUnits = row.nominalGaugeUnits;
      event.reactionAudit.auraApplied = [
        {
          element: "pyro",
          gaugeUnits: row.nominalGaugeUnits,
          sourceActorId: row.sourceActorId,
        },
      ];
    });
  });

  it("rejects non-finite and unsafe trusted numeric fields", () => {
    const result = applicationResultVector();
    for (const poison of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expectRejectedByTrusted(result, (forged) => {
        forged.elementalApplicationIcdLog[0]!.nominalGaugeUnits = poison;
      });
      expectRejectedByTrusted(result, (forged) => {
        forged.elementalApplicationIcdLog[0]!.effectiveGaugeUnits = poison;
      });
      expectRejectedByTrusted(result, (forged) => {
        const decision = forged.elementalApplicationIcdLog[0]!.decision;
        if (decision.kind === "fixed-gcsim") {
          decision.applicationMultiplier = poison;
        }
      });
      expectRejectedByTrusted(result, (forged) => {
        const decision = forged.elementalApplicationIcdLog[0]!.decision;
        if (decision.kind === "fixed-gcsim") {
          decision.windowStartFrame = poison;
        }
      });
    }
    expectRejectedByTrusted(result, (forged) => {
      const decision = forged.elementalApplicationIcdLog[0]!.decision;
      if (decision.kind === "fixed-gcsim") {
        decision.hitIndex = Number.MAX_SAFE_INTEGER + 1;
      }
    });
  });
});
