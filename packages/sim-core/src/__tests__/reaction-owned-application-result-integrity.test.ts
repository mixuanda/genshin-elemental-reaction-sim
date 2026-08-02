import {
  assertTrustedSimulationResult,
  assertTrustedSimulationResultV147,
  simulationResultSchema,
  simulationResultV147Schema,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import { beforeAll, describe, expect, it } from "vitest";

import { projectSimulationResultV148ToV147 } from "../../../test-vectors/src/project-v148-to-v147";
import { projectSimulationResultV149ToV148 } from "../../../test-vectors/src/project-v149-to-v148";
import { projectSimulationResultV150ToV149 } from "../../../test-vectors/src/project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const OPTIONS = {
  energyMode: "configured" as const,
  critMode: "noCrit" as const,
  compatibilityMode: "legal-frame-v1" as const,
};

function applicationHit(
  id: string,
  element: NonNullable<FrameHitDefinition["element"]>,
  targetId = "enemy-0",
): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    ...(element === "pyro" || element === "electro"
      ? {
          geometry: {
            kind: "circle" as const,
            coordinateSpace: "world" as const,
            origin: { x: 0, y: 0 },
            radius: 1,
          },
        }
      : {
          targeting: {
            targetId,
            outcome: "landed" as const,
          },
        }),
    application: {
      gaugeUnits: 1,
      icd: { mode: "no-icd-v1" },
    },
  };
}

function makeReactionConfig(
  id: string,
  initialElement: "pyro" | "hydro" | "electro" | "dendro",
  incomingElement: "pyro" | "electro",
  targetTaskModel: SimConfig["targetTaskModel"] = {
    mode: "target-phase-v2",
  },
): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: `v148-integrity-${id}`,
    randomSeed: `v148-integrity-${id}`,
    duration: 65 / 60,
    cycleLength: 65 / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: `${id} target`,
          position: { x: 0, y: 0 },
          initialAura: [{ element: initialElement, gaugeUnits: 4 }],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Integrity driver",
        element: incomingElement,
        stats: { ...neutralStats, baseAtk: 0, em: 100 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
    },
    targetTaskModel,
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: `${id}-ability`,
          actorId: "driver",
          name: `${id} ability`,
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [applicationHit(`${id}-hit`, incomingElement, "enemy-0")],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: `${id}-ability`,
          atFrame: 0,
        },
      ],
    },
  });
}

function makeSwirlConfig(): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: "v148-integrity-swirl",
    randomSeed: "v148-integrity-swirl",
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Swirl source",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "pyro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-1",
          name: "Swirl recipient",
          position: { x: 1, y: 0 },
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-2",
          name: "Missed Swirl recipient",
          position: { x: 5.1, y: 0 },
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo integrity driver",
        element: "anemo",
        stats: { ...neutralStats, baseAtk: 0, em: 100 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
    },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 1,
      abilities: [
        {
          id: "swirl-ability",
          actorId: "anemo",
          name: "Swirl ability",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [applicationHit("swirl-hit", "anemo")],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "swirl-ability",
          atFrame: 0,
        },
      ],
    },
  });
}

function makeMultiSwirlConfig(): SimConfig {
  const config = makeSwirlConfig();
  config.dataVersion = "v148-integrity-multi-swirl";
  config.randomSeed = "v148-integrity-multi-swirl";
  const source = config.enemy.targets?.[0];
  const ability = config.timeline?.abilities[0];
  if (source === undefined || ability === undefined) {
    throw new Error("multi-Swirl fixture requires one source and ability");
  }
  source.initialAura = [{ element: "hydro", gaugeUnits: 4 }];
  ability.hits = [
    {
      id: "electro-charged-primer",
      label: "electro-charged-primer",
      frame: 0,
      scaling: 0,
      element: "electro",
      geometry: {
        kind: "circle",
        coordinateSpace: "world",
        origin: { x: 0, y: 0 },
        radius: 0.1,
      },
      application: {
        gaugeUnits: 1,
        icd: { mode: "no-icd-v1" },
      },
    },
    {
      ...applicationHit("multi-swirl-hit", "anemo"),
      application: {
        gaugeUnits: 3,
        icd: { mode: "no-icd-v1" },
      },
    },
  ];
  return config;
}

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
    /Trusted SimulationResult 1\.51 integrity validation failed/,
  );
}

function firstReactionOwnedRow(result: SimulationResult) {
  const row = result.elementalApplicationIcdLog.find(
    (entry) => entry.sourceKind !== "configured-direct-hit",
  );
  if (row === undefined) {
    throw new Error("test vector requires a reaction-owned row");
  }
  return row;
}

function rewriteReactionParentEventSequence(
  forged: SimulationResult,
  reactionDamageLogId: number,
  eventSequence: number,
): void {
  const parent = forged.reactionDamageLog[reactionDamageLogId];
  if (parent === undefined) {
    throw new Error("test mutation requires a reaction-damage parent");
  }
  const hitResolutionIds = new Set(parent.hitResolutionLogIds);
  const damageEventIds = new Set(parent.damageEventIds);
  const applicationIds = new Set(parent.elementalApplicationIcdLogIds);

  let nextIntraEventSequence =
    Math.max(
      -1,
      ...forged.hitResolutionLog
        .filter((row) => row.eventSequence === eventSequence)
        .map((row) => row.intraEventSequence ?? -1),
      ...forged.targetStateTimeline.points
        .filter((point) => point.eventSequence === eventSequence)
        .map((point) => point.intraEventSequence ?? -1),
    ) + 1;

  for (const resolution of forged.hitResolutionLog) {
    if (!hitResolutionIds.has(resolution.id)) continue;
    resolution.eventSequence = eventSequence;
    resolution.intraEventSequence = nextIntraEventSequence++;
  }
  for (const event of forged.damageEvents) {
    if (damageEventIds.has(event.id)) {
      event.eventSequence = eventSequence;
    }
  }
  for (const row of forged.elementalApplicationIcdLog) {
    if (
      applicationIds.has(row.id) &&
      row.sourceKind !== "configured-direct-hit"
    ) {
      row.eventSequence = eventSequence;
    }
  }
  for (const point of forged.auraTimeline) {
    if (damageEventIds.has(point.damageEventId)) {
      point.eventSequence = eventSequence;
    }
  }
  for (const point of forged.targetStateTimeline.points) {
    const linkedToParent = point.links.some(
      (link) =>
        link.kind === "reaction-damage-log" && link.id === reactionDamageLogId,
    );
    if (
      !linkedToParent &&
      (point.primaryDamageEventId === null ||
        !damageEventIds.has(point.primaryDamageEventId))
    ) {
      continue;
    }
    point.eventSequence = eventSequence;
    point.intraEventSequence = nextIntraEventSequence++;
  }
}

describe("current V1.51 reaction-owned application result integrity", () => {
  let burning: SimulationResult;
  let swirl: SimulationResult;
  let swirlV1: SimulationResult;
  let overload: SimulationResult;
  let electroCharged: SimulationResult;
  let multiSwirl: SimulationResult;

  beforeAll(() => {
    const burningConfig = makeReactionConfig("burning", "dendro", "pyro", {
      mode: "target-phase-v3",
    });
    if (burningConfig.timeline?.mode !== "legal-frame-v1") {
      throw new Error("test vector requires a legal-frame timeline");
    }
    const burningAbility = burningConfig.timeline.abilities[0]!;
    burningAbility.cancelFrame = 21;
    burningAbility.animationEndFrame = 21;
    burningAbility.hits = [
      ...(burningAbility.hits ?? []),
      {
        ...applicationHit("burning-followup-hit", "pyro"),
        frame: 20,
      },
    ];
    burning = simulate(burningConfig, OPTIONS);
    swirl = simulate(makeSwirlConfig(), OPTIONS);
    const swirlV1Config = makeSwirlConfig();
    swirlV1Config.reactionOwnedElementalApplicationModel = {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
    };
    swirlV1 = simulate(swirlV1Config, OPTIONS);
    overload = simulate(
      makeReactionConfig("overload", "electro", "pyro"),
      OPTIONS,
    );
    electroCharged = simulate(
      makeReactionConfig("electro-charged", "hydro", "electro"),
      OPTIONS,
    );
    multiSwirl = simulate(makeMultiSwirlConfig(), OPTIONS);
  });

  it("accepts authentic Burning and Swirl wires at both public and trusted boundaries", () => {
    for (const result of [burning, swirl, swirlV1]) {
      expect(simulationResultSchema.safeParse(result).success).toBe(true);
      expect(assertTrustedSimulationResult(result)).toBe(result);
    }

    expect(
      burning.elementalApplicationIcdLog.some(
        (row) => row.sourceKind === "burning-tick",
      ),
    ).toBe(true);
    const firstBurning = burning.elementalApplicationIcdLog.find(
      (row) => row.sourceKind === "burning-tick",
    )!;
    const laterDirect = burning.elementalApplicationIcdLog.find(
      (row) =>
        row.sourceKind === "configured-direct-hit" &&
        row.hitId === "burning-followup-hit",
    )!;
    expect(firstBurning.id).toBeLessThan(laterDirect.id);
    expect(
      swirl.elementalApplicationIcdLog.some(
        (row) => row.sourceKind === "swirl-propagation",
      ),
    ).toBe(true);
    expect(
      swirlV1.elementalApplicationIcdLog
        .filter((row) => row.sourceKind === "swirl-propagation")
        .every(
          (row) =>
            row.selector.mode === "fixed-gcsim-reaction-owned-application-v1" &&
            row.selector.policyId ===
              GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
        ),
    ).toBe(true);
  });

  it("rejects forged v1/v2 mode, root, selector, boundary, and decision bindings", () => {
    const mutations: Array<(forged: SimulationResult) => void> = [
      (forged) => {
        (
          forged.config.reactionOwnedElementalApplicationModel as {
            mode: string;
          }
        ).mode = "fixed-gcsim-reaction-owned-application-v1";
      },
      (forged) => {
        (
          forged.runManifest.reactionOwnedElementalApplicationRoot as {
            contentHash: string;
          }
        ).contentHash = "sha256:forged";
      },
      (forged) => {
        const row = firstReactionOwnedRow(forged);
        (row.selector as { mode: string; policyId: string }).mode =
          "fixed-gcsim-reaction-owned-application-v1";
        (row.selector as { mode: string; policyId: string }).policyId =
          GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID;
      },
      (forged) => {
        const row = firstReactionOwnedRow(forged);
        if (row.decision.kind !== "reaction-fixed-gcsim") {
          throw new Error("test vector requires a fixed decision");
        }
        row.decision.resetAtFrame += 1;
      },
      (forged) => {
        const row = firstReactionOwnedRow(forged);
        if (row.decision.kind !== "reaction-fixed-gcsim") {
          throw new Error("test vector requires a fixed decision");
        }
        (row.decision as { resetSchedulePolicy: string }).resetSchedulePolicy =
          "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one";
      },
    ];

    for (const mutate of mutations) {
      expectRejectedByPublicAndTrusted(burning, mutate);
    }
  });

  it("keeps the frozen V1.47 public and trusted contracts isolated from current V1.51 replay", () => {
    const projected = projectSimulationResultV148ToV147(
      projectSimulationResultV149ToV148(
        projectSimulationResultV150ToV149(
          projectSimulationResultV151ToV150(overload),
        ),
      ),
    );

    expect(simulationResultV147Schema.parse(projected)).toEqual(projected);
    expect(assertTrustedSimulationResultV147(projected)).toBe(projected);
    expect(simulationResultV147Schema.safeParse(burning).success).toBe(false);
  });

  it("rejects deletion, duplication, and coordinated row reordering", () => {
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      forged.elementalApplicationIcdLog.splice(row.id, 1);
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = structuredClone(firstReactionOwnedRow(forged));
      forged.elementalApplicationIcdLog.push({
        ...row,
        id: forged.elementalApplicationIcdLog.length,
      });
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const rows = forged.elementalApplicationIcdLog;
      const first = rows.findIndex(
        (row) => row.sourceKind !== "configured-direct-hit",
      );
      const second = first + 1;
      const left = rows[first]!;
      const right = rows[second]!;
      rows[first] = { ...right, id: first };
      rows[second] = { ...left, id: second };
    });
  });

  it("rejects forged source, target, owner, hit, and resolution provenance", () => {
    const mutations: Array<(forged: SimulationResult) => void> = [
      (forged) => {
        firstReactionOwnedRow(forged).sourceActorId = "forged-actor";
      },
      (forged) => {
        firstReactionOwnedRow(forged).targetId = "forged-target";
      },
      (forged) => {
        firstReactionOwnedRow(forged).reactionDamageLogId += 1;
      },
      (forged) => {
        firstReactionOwnedRow(forged).hitId = "forged-hit";
      },
      (forged) => {
        firstReactionOwnedRow(forged).hitResolutionLogId += 1;
      },
    ];

    for (const mutate of mutations) {
      expectRejectedByPublicAndTrusted(burning, mutate);
    }
  });

  it("rejects broken reciprocal links across all four owning structures", () => {
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      forged.hitResolutionLog[
        row.hitResolutionLogId
      ]!.elementalApplicationIcdLogId = null;
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      forged.damageEvents[row.damageEventId!]!.elementalApplicationIcdLogId =
        null;
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      forged.reactionDamageLog[
        row.reactionDamageLogId
      ]!.elementalApplicationIcdLogIds = [];
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      for (const phase of forged.targetPhaseLog) {
        if (phase.model !== "target-phase-v3") continue;
        for (const task of phase.targetTasks) {
          for (const attempt of task.delivery?.attempts ?? []) {
            if (attempt.hitResolutionLogId === row.hitResolutionLogId) {
              attempt.elementalApplicationIcdLogId += 1;
              return;
            }
          }
        }
      }
      throw new Error("test vector requires a V3 delivery backlink");
    });
  });

  it("retains the target-phase Burning application ownership proof at both current V1.51 boundaries", () => {
    const forgeDeliveryApplicationOwner = (forged: SimulationResult): void => {
      const row = firstReactionOwnedRow(forged);
      for (const phase of forged.targetPhaseLog) {
        if (phase.model !== "target-phase-v3") continue;
        for (const task of phase.targetTasks) {
          for (const attempt of task.delivery?.attempts ?? []) {
            if (attempt.hitResolutionLogId === row.hitResolutionLogId) {
              attempt.elementalApplicationIcdLogId += 1;
              return;
            }
          }
        }
      }
      throw new Error("test vector requires a V3 delivery backlink");
    };

    const publicWire = cloneResult(burning);
    forgeDeliveryApplicationOwner(publicWire);
    const parsed = simulationResultSchema.safeParse(publicWire);
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("forged current V1.51 public wire was accepted");
    }
    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            "Burning delivery application row must match its attempt, hit, reaction, and micro-event tuple",
        }),
      ]),
    );

    const trusted = cloneResult(burning);
    forgeDeliveryApplicationOwner(trusted);
    expect(() => assertTrustedSimulationResult(trusted)).toThrow(
      /Burning delivery application row must match its attempt, hit, reaction, and micro-event tuple/,
    );
  });

  it("rejects coordinated Gauge and policy-window mutations", () => {
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      row.nominalGaugeUnits = 2;
      row.effectiveGaugeUnits = 2 * row.decision.applicationMultiplier;
      forged.reactionDamageLog[row.reactionDamageLogId]!.applicationGaugeUnits =
        2;
      if (row.damageEventId !== null) {
        forged.damageEvents[
          row.damageEventId
        ]!.reactionAudit.applicationGaugeUnits = row.effectiveGaugeUnits;
      }
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      if (row.decision.kind !== "reaction-fixed-gcsim") {
        throw new Error("test vector requires a fixed decision");
      }
      row.decision.windowStartFrame += 1;
      row.decision.resetAtFrame += 1;
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      if (row.decision.kind !== "reaction-fixed-gcsim") {
        throw new Error("test vector requires a fixed decision");
      }
      row.decision.icdTag = "ICDTagSwirlPyro";
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      if (row.decision.kind !== "reaction-fixed-gcsim") {
        throw new Error("test vector requires a fixed decision");
      }
      row.decision.groupId = "reaction-a";
    });
  });

  it("rejects deletion of a missed attempt and direct/reaction namespace tampering", () => {
    expectRejectedByPublicAndTrusted(swirl, (forged) => {
      const missed = forged.elementalApplicationIcdLog.find(
        (row) =>
          row.sourceKind === "swirl-propagation" &&
          row.decision.kind === "skipped" &&
          row.decision.reason === "miss",
      );
      if (missed === undefined) {
        throw new Error("test vector requires a missed Swirl row");
      }
      forged.elementalApplicationIcdLog.splice(missed.id, 1);
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const row = firstReactionOwnedRow(forged);
      (row as { sourceKind: string }).sourceKind = "configured-direct-hit";
    });
    expectRejectedByPublicAndTrusted(burning, (forged) => {
      const direct = forged.elementalApplicationIcdLog.find(
        (row) => row.sourceKind === "configured-direct-hit",
      );
      if (direct === undefined) {
        throw new Error("test vector requires a direct row");
      }
      (direct as { sourceKind: string }).sourceKind = "burning-tick";
    });
  });

  it("rejects a fabricated application row attached to Electro-Charged damage", () => {
    const parent = electroCharged.reactionDamageLog.find(
      (entry) => entry.scheduleKind === "periodic-tick",
    );
    expect(parent).toBeDefined();

    expectRejectedByPublicAndTrusted(electroCharged, (forged) => {
      const forgedParent = forged.reactionDamageLog[parent!.id]!;
      const resolution =
        forged.hitResolutionLog[forgedParent.hitResolutionLogIds[0]!]!;
      const template = structuredClone(firstReactionOwnedRow(burning));
      const id = forged.elementalApplicationIcdLog.length;
      const damageEventId = resolution.damageEventId;
      const fake = {
        ...template,
        id,
        reactionDamageLogId: forgedParent.id,
        hitResolutionLogId: resolution.id,
        damageEventId,
        frame: resolution.frame,
        eventPriority: resolution.eventPriority!,
        eventSequence: resolution.eventSequence!,
        attemptIndex: resolution.targetIndex,
        attemptCount: resolution.targetCount,
        sourceActorId: resolution.sourceActorId,
        targetId: resolution.targetId,
        hitId: resolution.hitId,
        hitGroupId: resolution.hitGroupId,
      };
      forged.elementalApplicationIcdLog.push(fake);
      forgedParent.elementalApplicationIcdLogIds = [id];
      resolution.elementalApplicationIcdLogId = id;
      if (damageEventId !== null) {
        forged.damageEvents[damageEventId]!.elementalApplicationIcdLogId = id;
      }
    });
  });

  it("rejects application claims on damage-only reaction schedules", () => {
    const damageOnly = overload.reactionDamageLog.find(
      (entry) => entry.scheduleKind === "one-shot",
    );
    expect(damageOnly).toBeDefined();
    expect(damageOnly!.elementalApplicationIcdLogIds).toEqual([]);
    expect(damageOnly!.applicationGaugeUnits).toBeNull();

    expectRejectedByPublicAndTrusted(overload, (forged) => {
      const entry = forged.reactionDamageLog[damageOnly!.id]!;
      entry.applicationGaugeUnits = 1;
    });
  });

  it("replays Burning and Swirl with separate policy namespaces", () => {
    const burningRows = burning.elementalApplicationIcdLog.filter(
      (row) => row.sourceKind === "burning-tick",
    );
    expect(
      burningRows.slice(0, 3).map((row) => ({
        targetId: row.targetId,
        scope:
          row.decision.kind === "reaction-fixed-gcsim"
            ? row.decision.scope
            : null,
        hitIndex:
          row.decision.kind === "reaction-fixed-gcsim"
            ? row.decision.hitIndex
            : null,
        multiplier: row.decision.applicationMultiplier,
      })),
    ).toEqual([
      {
        targetId: "enemy-0",
        scope: "trusted-target-global-burning-projection",
        hitIndex: 0,
        multiplier: 1,
      },
      {
        targetId: "enemy-0",
        scope: "trusted-target-global-burning-projection",
        hitIndex: 1,
        multiplier: 0,
      },
      {
        targetId: "enemy-0",
        scope: "trusted-target-global-burning-projection",
        hitIndex: 2,
        multiplier: 0,
      },
    ]);

    const swirlRow = swirl.elementalApplicationIcdLog.find(
      (row) => row.sourceKind === "swirl-propagation",
    );
    expect(swirlRow).toMatchObject({
      sourceKind: "swirl-propagation",
      targetId: "enemy-1",
      selector: {
        channel: {
          kind: "swirl-propagation",
          element: "pyro",
        },
      },
      decision: {
        kind: "reaction-fixed-gcsim",
        scope: "actor-tag",
        icdTag: "ICDTagSwirlPyro",
        groupId: "reaction-a",
        hitIndex: 0,
      },
    });
  });

  it("rejects duplicate queue eventSequence ownership across independent Swirl propagation parents", () => {
    const propagationParents = multiSwirl.reactionDamageLog.filter(
      (entry) =>
        entry.scheduleKind === "swirl-propagation" &&
        entry.hitResolutionLogIds.length > 0,
    );
    expect(propagationParents).toHaveLength(2);
    const first = propagationParents[0]!;
    const second = propagationParents[1]!;
    const firstResolution =
      multiSwirl.hitResolutionLog[first.hitResolutionLogIds[0]!]!;
    const secondResolution =
      multiSwirl.hitResolutionLog[second.hitResolutionLogIds[0]!]!;
    expect(first.damageFrame).toBe(second.damageFrame);
    expect(firstResolution.eventPriority).toBe(secondResolution.eventPriority);
    expect(firstResolution.eventSequence).not.toBe(
      secondResolution.eventSequence,
    );

    expectRejectedByPublicAndTrusted(multiSwirl, (forged) => {
      rewriteReactionParentEventSequence(
        forged,
        second.id,
        firstResolution.eventSequence!,
      );
    });
  });
});
