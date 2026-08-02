import {
  type Element,
  type FrameHitDefinition,
  type InitialAuraApplication,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID } from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";

import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const OPTIONS = {
  energyMode: "configured" as const,
  critMode: "noCrit" as const,
  compatibilityMode: "legal-frame-v1" as const,
};

interface MatrixTarget {
  id: string;
  name: string;
  position: { x: number; y: number };
  initialAura: InitialAuraApplication[];
}

interface MatrixScenario {
  durationFrames: number;
  initialAura?: InitialAuraApplication[];
  targets?: MatrixTarget[];
  hits: FrameHitDefinition[];
  reactionMode?: "aura-v5" | "aura-v9";
}

function applicationHit({
  id,
  frame = 0,
  element,
  gaugeUnits = 1,
  targeting,
  geometry,
}: {
  id: string;
  frame?: number;
  element: Element;
  gaugeUnits?: number;
  targeting?: FrameHitDefinition["targeting"];
  geometry?: FrameHitDefinition["geometry"];
}): FrameHitDefinition {
  const needsCoreContactGeometry = element === "pyro" || element === "electro";
  return {
    id,
    label: id,
    frame,
    scaling: 0,
    element,
    ...(targeting === undefined ? {} : { targeting }),
    ...(geometry !== undefined
      ? { geometry }
      : needsCoreContactGeometry
        ? {
            geometry: {
              kind: "circle" as const,
              coordinateSpace: "world" as const,
              origin: { x: 0, y: 0 },
              radius: 1,
            },
          }
        : {}),
    application: {
      gaugeUnits,
      icd: { mode: "no-icd-v1" },
    },
  };
}

function makeMatrixConfig(
  scenarioId: string,
  scenario: MatrixScenario,
): SimConfig {
  const base = makeConfig({
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
    },
  });
  const durationFrames = Math.max(60, scenario.durationFrames);
  const duration = durationFrames / 60;
  const lastHitFrame = Math.max(0, ...scenario.hits.map((hit) => hit.frame));
  const targets = scenario.targets ?? [
    {
      id: "enemy-0",
      name: `${scenarioId} target`,
      position: { x: 0, y: 0 },
      initialAura: scenario.initialAura ?? [],
    },
  ];

  return {
    ...base,
    dataVersion: `reaction-owned-application-negative-matrix:${scenarioId}`,
    randomSeed: `reaction-owned-application-negative-matrix:${scenarioId}`,
    meta: {
      name: `Reaction-owned application matrix · ${scenarioId}`,
      version: "1.48.0",
      verificationStatus: "provisional",
      note: "Engine regression vector; not official live-server truth.",
    },
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: targets.map((target) => ({
        ...target,
        position: { ...target.position },
        initialAura: target.initialAura.map((entry) => ({
          ...entry,
        })),
      })),
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "matrix",
        name: "Reaction Matrix Driver",
        element: "anemo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: {
      mode: scenario.reactionMode ?? "aura-v9",
    },
    targetTaskModel:
      scenario.reactionMode === "aura-v5"
        ? { mode: "legacy-event-heap-v1" }
        : { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "matrix",
      swapFrames: 1,
      abilities: [
        {
          id: `matrix-${scenarioId}`,
          actorId: "matrix",
          name: `Matrix ${scenarioId}`,
          kind: "skill",
          cancelFrame: lastHitFrame + 1,
          animationEndFrame: lastHitFrame + 1,
          cooldownFrames: 0,
          hits: scenario.hits.map((hit) => ({ ...hit })),
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "matrix",
          abilityId: `matrix-${scenarioId}`,
          atFrame: 0,
        },
      ],
    },
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
    },
  };
}

function reactionOwnedRows(result: SimulationResult) {
  return result.elementalApplicationIcdLog.filter(
    (row) => row.sourceKind !== "configured-direct-hit",
  );
}

type ReactionOwnedApplicationRow = Exclude<
  SimulationResult["elementalApplicationIcdLog"][number],
  { sourceKind: "configured-direct-hit" }
>;

function expectReactionOwnedReciprocalLinks(
  result: SimulationResult,
  row: ReactionOwnedApplicationRow,
): void {
  expect(
    result.reactionDamageLog[row.reactionDamageLogId]
      ?.elementalApplicationIcdLogIds,
  ).toContain(row.id);
  expect(
    result.hitResolutionLog[row.hitResolutionLogId]
      ?.elementalApplicationIcdLogId,
  ).toBe(row.id);
  if (row.damageEventId !== null) {
    expect(
      result.damageEvents[row.damageEventId]?.elementalApplicationIcdLogId,
    ).toBe(row.id);
  }
}

function expectNoReactionOwnedApplication(result: SimulationResult): void {
  expect(reactionOwnedRows(result)).toEqual([]);
  expect(
    result.elementalApplicationIcdLog.every(
      (row) => row.sourceKind === "configured-direct-hit",
    ),
  ).toBe(true);

  for (const reactionDamage of result.reactionDamageLog) {
    expect(
      reactionDamage.elementalApplicationIcdLogIds,
      `${reactionDamage.scheduleKind} must not create a reaction-owned application row`,
    ).toEqual([]);
    for (const hitResolutionLogId of reactionDamage.hitResolutionLogIds) {
      expect(
        result.hitResolutionLog[hitResolutionLogId]
          ?.elementalApplicationIcdLogId,
      ).toBeNull();
    }
    for (const damageEventId of reactionDamage.damageEventIds) {
      expect(
        result.damageEvents[damageEventId]?.elementalApplicationIcdLogId,
      ).toBeNull();
    }
  }
}

describe("reaction-owned elemental application public matrix", () => {
  const oneShotCases = [
    {
      name: "Overload",
      reaction: "overload" as const,
      initialAura: [{ element: "electro" as const, gaugeUnits: 1 }],
      hit: applicationHit({
        id: "overload-pyro",
        element: "pyro",
      }),
    },
    {
      name: "Superconduct",
      reaction: "superconduct" as const,
      initialAura: [{ element: "electro" as const, gaugeUnits: 1 }],
      hit: applicationHit({
        id: "superconduct-cryo",
        element: "cryo",
      }),
    },
  ];

  it.each(oneShotCases)(
    "$name deals reaction damage without a derived application",
    ({ name, reaction, initialAura, hit }) => {
      const result = simulate(
        makeMatrixConfig(name.toLowerCase(), {
          durationFrames: 60,
          initialAura,
          hits: [hit],
        }),
        OPTIONS,
      );

      expect(
        result.reactionDamageLog.some((entry) => entry.reaction === reaction),
      ).toBe(true);
      expectNoReactionOwnedApplication(result);
    },
  );

  it("Electro-Charged tick and Wane mutate periodic state without a derived application", () => {
    const result = simulate(
      makeMatrixConfig("electro-charged-wane", {
        durationFrames: 60,
        initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        hits: [
          applicationHit({
            id: "electro-charged-electro",
            element: "electro",
          }),
        ],
      }),
      OPTIONS,
    );

    expect(
      result.reactionDamageLog.some(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.scheduleKind === "periodic-tick",
      ),
    ).toBe(true);
    expect(
      result.periodicReactionLog.some((entry) => entry.operation === "wane"),
    ).toBe(true);
    expectNoReactionOwnedApplication(result);
  });

  it("Shatter consumes Frozen and deals damage without a derived application", () => {
    const result = simulate(
      makeMatrixConfig("shatter", {
        durationFrames: 60,
        initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        hits: [
          applicationHit({
            id: "freeze-cryo",
            element: "cryo",
          }),
          {
            id: "shatter-blunt",
            label: "shatter-blunt",
            frame: 12,
            scaling: 0,
            element: "physical",
            strikeType: "blunt",
            poiseDamage: 0,
          },
        ],
      }),
      OPTIONS,
    );

    expect(
      result.reactionDamageLog.some((entry) => entry.reaction === "shatter"),
    ).toBe(true);
    expectNoReactionOwnedApplication(result);
  });

  it("Bloom core expiry deals damage without a derived application", () => {
    const result = simulate(
      makeMatrixConfig("bloom", {
        durationFrames: 360,
        initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        hits: [
          applicationHit({
            id: "bloom-hydro",
            element: "hydro",
          }),
        ],
      }),
      OPTIONS,
    );

    expect(
      result.reactionDamageLog.some(
        (entry) =>
          entry.reaction === "bloom" &&
          entry.scheduleKind === "dendro-core-bloom",
      ),
    ).toBe(true);
    expect(
      result.dendroCoreLog.some(
        (entry) => entry.operation === "expire" && entry.reaction === "bloom",
      ),
    ).toBe(true);
    expectNoReactionOwnedApplication(result);
  });

  it.each([
    {
      name: "Burgeon",
      element: "pyro" as const,
      reaction: "burgeon" as const,
      scheduleKind: "dendro-core-burgeon" as const,
    },
    {
      name: "Hyperbloom",
      element: "electro" as const,
      reaction: "hyperbloom" as const,
      scheduleKind: "dendro-core-hyperbloom" as const,
    },
  ])(
    "$name core contact deals damage without a derived application",
    ({ name, element, reaction, scheduleKind }) => {
      const result = simulate(
        makeMatrixConfig(name.toLowerCase(), {
          durationFrames: 140,
          initialAura: [{ element: "dendro", gaugeUnits: 0.625 }],
          hits: [
            applicationHit({
              id: `${reaction}-bloom-hydro`,
              element: "hydro",
            }),
            applicationHit({
              id: `${reaction}-core-contact`,
              frame: 31,
              element,
            }),
          ],
        }),
        OPTIONS,
      );

      expect(
        result.dendroCoreContactLog.some(
          (entry) =>
            entry.reaction === reaction && entry.contactedCoreIds.length > 0,
        ),
      ).toBe(true);
      expect(
        result.reactionDamageLog.some(
          (entry) =>
            entry.reaction === reaction && entry.scheduleKind === scheduleKind,
        ),
      ).toBe(true);
      expectNoReactionOwnedApplication(result);
    },
  );

  it("Quicken additive follow-ups remain direct applications only", () => {
    const result = simulate(
      makeMatrixConfig("quicken-additive-followups", {
        durationFrames: 60,
        initialAura: [{ element: "dendro", gaugeUnits: 2 }],
        hits: [
          applicationHit({
            id: "quicken-electro",
            element: "electro",
          }),
          applicationHit({
            id: "aggravate-electro",
            frame: 12,
            element: "electro",
          }),
          applicationHit({
            id: "spread-dendro",
            frame: 24,
            element: "dendro",
          }),
        ],
      }),
      OPTIONS,
    );

    expect(
      result.damageEvents.some((entry) => entry.reaction === "aggravate"),
    ).toBe(true);
    expect(
      result.damageEvents.some((entry) => entry.reaction === "spread"),
    ).toBe(true);
    expectNoReactionOwnedApplication(result);
  });

  it("same-hit Quicken-to-Bloom follow-up and its core do not create a derived application", () => {
    const result = simulate(
      makeMatrixConfig("quicken-bloom-followup", {
        durationFrames: 60,
        reactionMode: "aura-v5",
        initialAura: [
          { element: "hydro", gaugeUnits: 1 },
          { element: "electro", gaugeUnits: 1 },
        ],
        hits: [
          applicationHit({
            id: "dendro-quicken-bloom",
            element: "dendro",
            gaugeUnits: 0.8,
          }),
        ],
      }),
      OPTIONS,
    );

    expect(
      result.damageEvents[0]?.reactionAudit.bloomReactions.some(
        (entry) => entry.operation === "quicken-followup",
      ),
    ).toBe(true);
    expect(
      result.dendroCoreLog.some((entry) => entry.operation === "spawn"),
    ).toBe(true);
    expectNoReactionOwnedApplication(result);
  });

  it("Crystallize creates a shard without a derived application", () => {
    const result = simulate(
      makeMatrixConfig("crystallize", {
        durationFrames: 60,
        initialAura: [{ element: "pyro", gaugeUnits: 1 }],
        hits: [
          applicationHit({
            id: "crystallize-geo",
            element: "geo",
          }),
        ],
      }),
      OPTIONS,
    );

    expect(
      result.crystallizeShardLog.some((entry) => entry.operation === "spawn"),
    ).toBe(true);
    expectNoReactionOwnedApplication(result);
  });

  it("Burning ticks use the trusted Burning ICD binding", () => {
    const result = simulate(
      makeMatrixConfig("burning-positive-control", {
        durationFrames: 65,
        initialAura: [{ element: "dendro", gaugeUnits: 4 }],
        hits: [
          applicationHit({
            id: "burning-pyro",
            element: "pyro",
          }),
        ],
      }),
      OPTIONS,
    );
    const rows = result.elementalApplicationIcdLog.filter(
      (row) => row.sourceKind === "burning-tick",
    );

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      sourceKind: "burning-tick",
      element: "pyro",
      nominalGaugeUnits: 1,
      effectiveGaugeUnits: 1,
      selector: {
        mode: "fixed-gcsim-reaction-owned-application-v1",
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
        channel: { kind: "burning-tick" },
      },
      decision: {
        kind: "reaction-fixed-gcsim",
        groupId: "burning",
        icdTag: "ICDTagBurningDamage",
        applicationMultiplier: 1,
        allowed: true,
      },
    });
    expect(
      rows.some(
        (row) =>
          row.decision.kind === "reaction-fixed-gcsim" &&
          row.decision.groupId === "burning" &&
          row.decision.applicationMultiplier === 0 &&
          row.decision.allowed === false &&
          row.effectiveGaugeUnits === 0,
      ),
    ).toBe(true);
    expect(
      result.reactionDamageLog
        .filter((entry) => entry.scheduleKind === "burning-tick")
        .every((entry) => entry.elementalApplicationIcdLogIds.length > 0),
    ).toBe(true);
    for (const row of rows) {
      expectReactionOwnedReciprocalLinks(result, row);
    }
  });

  it("Swirl self damage has no application while AoE propagation uses reaction-a ICD", () => {
    const result = simulate(
      makeMatrixConfig("swirl-positive-control", {
        durationFrames: 60,
        targets: [
          {
            id: "enemy-0",
            name: "Swirl source target",
            position: { x: 0, y: 0 },
            initialAura: [{ element: "pyro", gaugeUnits: 1 }],
          },
          {
            id: "enemy-1",
            name: "Swirl propagation target",
            position: { x: 1, y: 0 },
            initialAura: [{ element: "hydro", gaugeUnits: 1 }],
          },
        ],
        hits: [
          applicationHit({
            id: "swirl-anemo",
            element: "anemo",
            targeting: {
              targetId: "enemy-0",
              outcome: "landed",
            },
          }),
        ],
      }),
      OPTIONS,
    );
    const selfDamage = result.reactionDamageLog.find(
      (entry) => entry.scheduleKind === "swirl-self",
    );
    const propagation = result.reactionDamageLog.find(
      (entry) => entry.scheduleKind === "swirl-propagation",
    );
    const rows = result.elementalApplicationIcdLog.filter(
      (row) => row.sourceKind === "swirl-propagation",
    );

    expect(selfDamage?.elementalApplicationIcdLogIds).toEqual([]);
    for (const hitResolutionLogId of selfDamage?.hitResolutionLogIds ?? []) {
      expect(
        result.hitResolutionLog[hitResolutionLogId]
          ?.elementalApplicationIcdLogId,
      ).toBeNull();
    }
    expect(propagation?.elementalApplicationIcdLogIds.length).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceKind: "swirl-propagation",
      targetId: "enemy-1",
      element: "pyro",
      nominalGaugeUnits: 2.2,
      effectiveGaugeUnits: 2.2,
      selector: {
        mode: "fixed-gcsim-reaction-owned-application-v1",
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
        channel: {
          kind: "swirl-propagation",
          element: "pyro",
        },
      },
      decision: {
        kind: "reaction-fixed-gcsim",
        groupId: "reaction-a",
        icdTag: "ICDTagSwirlPyro",
        applicationMultiplier: 1,
        allowed: true,
      },
    });
    expect(rows[0]?.targetId).not.toBe("enemy-0");
    expectReactionOwnedReciprocalLinks(result, rows[0]!);
  });
});
