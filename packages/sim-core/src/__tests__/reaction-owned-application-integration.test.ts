import type {
  Element,
  SimConfig,
  SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const NO_CRIT = { critMode: "noCrit" as const };

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const },
  };
}

function makeSwirlConfig(
  swirledElement: "pyro" | "hydro" | "cryo" | "electro",
): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: `reaction-owned-swirl-${swirledElement}`,
    randomSeed: `reaction-owned-swirl-${swirledElement}`,
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
          initialAura: [{ element: swirledElement, gaugeUnits: 1 }],
        },
        {
          id: "landed",
          name: "Propagation recipient",
          position: { x: 3, y: 0 },
        },
        {
          id: "missed",
          name: "Out-of-range recipient",
          position: { x: 5.1, y: 0 },
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo",
        element: "anemo",
        stats: { ...neutralStats, em: 100 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 1,
      abilities: [
        {
          id: "swirl-skill",
          actorId: "anemo",
          name: "Swirl Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "swirl-hit",
              label: "Swirl hit",
              frame: 0,
              scaling: 1,
              element: "anemo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: noIcd(),
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "swirl-skill",
          atFrame: 0,
        },
      ],
    },
  });
}

function pyroActor(base: SimConfig, id: string) {
  return {
    ...base.characters[0]!,
    id,
    name: id,
    element: "pyro" as const,
    stats: { ...neutralStats, em: 100 },
  };
}

function pyroAbility(
  id: string,
  actorId: string,
  target: string | readonly string[],
  hitFrame = 0,
) {
  const targetIds = typeof target === "string" ? [target] : target;
  return {
    id,
    actorId,
    name: id,
    kind: "skill" as const,
    cancelFrame: 0,
    animationEndFrame: Math.max(1, hitFrame),
    cooldownFrames: 0,
    hits: targetIds.map((targetId, targetIndex) => ({
      id: targetIndex === 0 ? `${id}-hit` : `${id}-hit-${targetIndex}`,
      label: `${id} hit`,
      frame: hitFrame,
      scaling: 1,
      element: "pyro" as const,
      targeting: { targetId, outcome: "landed" as const },
      application: noIcd(),
    })),
  };
}

function makeDualOwnerBurningConfig(): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: "reaction-owned-burning-dual-owner",
    randomSeed: "reaction-owned-burning-dual-owner",
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Enemy A",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 2 }],
        },
        {
          id: "enemy-b",
          name: "Enemy B",
          position: { x: 3, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 2 }],
        },
      ],
    },
    characters: [pyroActor(base, "pyro-a"), pyroActor(base, "pyro-b")],
    rotation: [],
    reactionEngine: { mode: "aura-v4" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro-a",
      swapFrames: 1,
      abilities: [
        pyroAbility("ignite-a", "pyro-a", "enemy-0"),
        pyroAbility("ignite-b", "pyro-b", ["enemy-0", "enemy-b"]),
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro-a",
          abilityId: "ignite-a",
          atFrame: 0,
        },
        {
          type: "swap",
          characterId: "pyro-b",
          atFrame: 15,
        },
        {
          type: "skill",
          actorId: "pyro-b",
          abilityId: "ignite-b",
          atFrame: 16,
        },
      ],
    },
  });
}

function makeBurningPolicyConfig(): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: "reaction-owned-burning-target-policy",
    randomSeed: "reaction-owned-burning-target-policy",
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Damage immune",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 2 }],
        },
        {
          id: "aura-blocked",
          name: "Aura blocked",
          position: { x: 0.5, y: 0 },
        },
        {
          id: "missed",
          name: "Missed",
          position: { x: 2, y: 0 },
        },
      ],
      targetPhases: [
        {
          id: "immune-phase",
          label: "Damage immune",
          targetId: "enemy-0",
          startFrame: 15,
          endFrame: 16,
          reason: "REACTION_DAMAGE_IMMUNE",
          effects: {
            damage: "immune",
            aura: "normal",
            hitConfirm: "normal",
          },
        },
        {
          id: "aura-blocked-phase",
          label: "Aura blocked",
          targetId: "aura-blocked",
          startFrame: 15,
          endFrame: 16,
          reason: "REACTION_AURA_BLOCKED",
          effects: {
            damage: "normal",
            aura: "blocked",
            hitConfirm: "normal",
          },
        },
      ],
    },
    characters: [pyroActor(base, "pyro")],
    rotation: [],
    reactionEngine: { mode: "aura-v4" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 1,
      abilities: [pyroAbility("ignite", "pyro", "enemy-0")],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "ignite",
          atFrame: 0,
        },
      ],
    },
  });
}

function expectReciprocalApplicationLinks(result: SimulationResult): void {
  for (const application of result.elementalApplicationIcdLog) {
    const hit = result.hitResolutionLog[application.hitResolutionLogId]!;
    expect(hit.elementalApplicationIcdLogId).toBe(application.id);
    if (application.damageEventId === null) {
      expect(hit.damageEventId).toBeNull();
    } else {
      expect(
        result.damageEvents[application.damageEventId]!
          .elementalApplicationIcdLogId,
      ).toBe(application.id);
    }
    if (application.sourceKind !== "configured-direct-hit") {
      expect(hit.reactionDamageLogId).toBe(application.reactionDamageLogId);
      const parent = result.reactionDamageLog[application.reactionDamageLogId]!;
      expect(parent.hitResolutionLogIds).toContain(hit.id);
      expect(parent.elementalApplicationIcdLogIds).toContain(application.id);
    }
  }
}

function makeSingleReactionConfig({
  id,
  incomingElement,
  initialElement,
  duration = 1,
  auraMode = "aura-v4",
}: {
  id: string;
  incomingElement: Exclude<Element, "physical">;
  initialElement: "pyro" | "hydro" | "cryo" | "electro" | "dendro";
  duration?: number;
  auraMode?: "aura-v4" | "aura-v5" | "aura-v9";
}): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: id,
    randomSeed: id,
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Reaction target",
          position: { x: 0, y: 0 },
          initialAura: [{ element: initialElement, gaugeUnits: 2 }],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Driver",
        element: incomingElement,
        stats: { ...neutralStats, em: 100 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: auraMode },
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
          hits: [
            {
              id: `${id}-hit`,
              label: `${id} hit`,
              frame: 0,
              scaling: 1,
              element: incomingElement,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: noIcd(),
            },
          ],
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

describe("reaction-owned elemental application integration", () => {
  it.each([
    ["pyro", "ICDTagSwirlPyro"],
    ["hydro", "ICDTagSwirlHydro"],
    ["cryo", "ICDTagSwirlCryo"],
    ["electro", "ICDTagSwirlElectro"],
  ] as const)(
    "uses the trusted ReactionA application channel for %s Swirl",
    (element, icdTag) => {
      const result = simulate(makeSwirlConfig(element), NO_CRIT);
      const rows = result.elementalApplicationIcdLog.filter(
        (entry) => entry.sourceKind === "swirl-propagation",
      );

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.targetId)).toEqual(["landed", "missed"]);
      expect(rows[0]).toMatchObject({
        sourceKind: "swirl-propagation",
        element,
        attemptIndex: 0,
        attemptCount: 2,
        deliveryPhase: "reaction-damage-event",
        selector: {
          mode: "fixed-gcsim-reaction-owned-application-v2",
          channel: { kind: "swirl-propagation", element },
        },
        decision: {
          kind: "reaction-fixed-gcsim",
          scope: "actor-tag",
          icdTag,
          groupId: "reaction-a",
          hitIndex: 0,
          allowed: true,
        },
      });
      expect(rows[1]).toMatchObject({
        attemptIndex: 1,
        damageEventId: null,
        effectiveGaugeUnits: 0,
        decision: {
          kind: "skipped",
          reason: "miss",
          consumed: false,
        },
      });
      expectReciprocalApplicationLinks(result);
    },
  );

  it("retains Hydro Swirl as zero damage while applying its derived Gauge", () => {
    const result = simulate(makeSwirlConfig("hydro"), NO_CRIT);
    const row = result.elementalApplicationIcdLog.find(
      (entry) =>
        entry.sourceKind === "swirl-propagation" && entry.targetId === "landed",
    )!;
    const damage = result.damageEvents[row.damageEventId!]!;

    expect(row.effectiveGaugeUnits).toBeGreaterThan(0);
    expect(damage).toMatchObject({
      reaction: "swirlHydro",
      element: "hydro",
      finalDamage: 0,
      elementalApplicationIcdLogId: row.id,
    });
  });

  it("shares Burning application ICD across owners while isolating targets", () => {
    const result = simulate(makeDualOwnerBurningConfig(), NO_CRIT);
    const rows = result.elementalApplicationIcdLog.filter(
      (entry) =>
        entry.sourceKind === "burning-tick" &&
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.frame <= 31,
    );

    expect(
      rows.map((row) => ({
        frame: row.frame,
        actor: row.sourceActorId,
        target: row.targetId,
        multiplier: row.decision.applicationMultiplier,
        hitIndex:
          row.decision.kind === "reaction-fixed-gcsim"
            ? row.decision.hitIndex
            : null,
      })),
    ).toEqual([
      {
        frame: 15,
        actor: "pyro-a",
        target: "enemy-0",
        multiplier: 1,
        hitIndex: 0,
      },
      {
        frame: 30,
        actor: "pyro-b",
        target: "enemy-0",
        multiplier: 0,
        hitIndex: 1,
      },
      {
        frame: 31,
        actor: "pyro-b",
        target: "enemy-b",
        multiplier: 1,
        hitIndex: 0,
      },
    ]);
    expect(
      rows.every(
        (row) =>
          row.decision.kind === "reaction-fixed-gcsim" &&
          row.decision.scope === "trusted-target-global-burning-projection" &&
          row.decision.icdTag === "ICDTagBurningDamage" &&
          row.decision.groupId === "burning",
      ),
    ).toBe(true);
    expectReciprocalApplicationLinks(result);
  });

  it("separates damage immunity, Aura blocking, and misses without false consumption", () => {
    const result = simulate(makeBurningPolicyConfig(), NO_CRIT);
    const tick = result.reactionDamageLog.find(
      (entry) =>
        entry.scheduleKind === "burning-tick" && entry.damageFrame === 15,
    )!;
    const rows = tick.elementalApplicationIcdLogIds.map(
      (id) => result.elementalApplicationIcdLog[id]!,
    );

    expect(
      rows.map((row) => ({
        targetId: row.targetId,
        damageEventId: row.damageEventId,
        kind: row.decision.kind,
        reason: row.decision.kind === "skipped" ? row.decision.reason : null,
        consumed: row.decision.consumed,
      })),
    ).toEqual([
      {
        targetId: "enemy-0",
        damageEventId: expect.any(Number),
        kind: "reaction-fixed-gcsim",
        reason: null,
        consumed: true,
      },
      {
        targetId: "aura-blocked",
        damageEventId: expect.any(Number),
        kind: "skipped",
        reason: "target-aura-blocked",
        consumed: false,
      },
      {
        targetId: "missed",
        damageEventId: null,
        kind: "skipped",
        reason: "miss",
        consumed: false,
      },
    ]);
    const immune = result.damageEvents[rows[0]!.damageEventId!]!;
    const auraBlocked = result.damageEvents[rows[1]!.damageEventId!]!;
    expect(immune).toMatchObject({
      targetDamagePolicy: "immune",
      finalDamage: 0,
    });
    expect(auraBlocked.finalDamage).toBeGreaterThan(0);
    expectReciprocalApplicationLinks(result);
  });

  it("does not invent applications for EC, Overload, or Dendro-core damage", () => {
    const overload = simulate(
      makeSingleReactionConfig({
        id: "negative-overload",
        incomingElement: "pyro",
        initialElement: "electro",
      }),
      NO_CRIT,
    );
    const electroCharged = simulate(
      makeSingleReactionConfig({
        id: "negative-electro-charged",
        incomingElement: "electro",
        initialElement: "hydro",
      }),
      NO_CRIT,
    );
    const bloom = simulate(
      makeSingleReactionConfig({
        id: "negative-bloom-core",
        incomingElement: "dendro",
        initialElement: "hydro",
        duration: 5.6,
        auraMode: "aura-v5",
      }),
      NO_CRIT,
    );

    for (const [result, scheduleKinds] of [
      [overload, ["one-shot"]],
      [electroCharged, ["periodic-tick"]],
      [bloom, ["dendro-core-bloom"]],
    ] as const) {
      const reactionLogs = result.reactionDamageLog.filter((entry) =>
        scheduleKinds.includes(entry.scheduleKind as never),
      );
      expect(reactionLogs.length).toBeGreaterThan(0);
      expect(
        reactionLogs.every(
          (entry) => entry.elementalApplicationIcdLogIds.length === 0,
        ),
      ).toBe(true);
      for (const entry of reactionLogs) {
        for (const hitId of entry.hitResolutionLogIds) {
          expect(
            result.hitResolutionLog[hitId]!.elementalApplicationIcdLogId,
          ).toBeNull();
        }
      }
      expect(
        result.elementalApplicationIcdLog.filter(
          (entry) => entry.sourceKind !== "configured-direct-hit",
        ),
      ).toEqual([]);
    }
  });

  it("keeps configured and reaction-owned counters isolated with reciprocal IDs", () => {
    const base = makeSwirlConfig("pyro");
    base.timeline = {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 1,
      abilities: [
        {
          id: "configured-prep",
          actorId: "anemo",
          name: "Configured prep",
          kind: "skill",
          cancelFrame: 2,
          animationEndFrame: 2,
          cooldownFrames: 0,
          hits: [
            {
              id: "configured-prep-hit",
              label: "Configured prep hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                targetId: "landed",
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: {
                  mode: "fixed-gcsim-application-v1",
                  icdTag: "ICDTagSwirlPyro",
                  groupId: "default",
                },
              },
            },
            {
              id: "swirl-trigger-hit",
              label: "Swirl trigger hit",
              frame: 1,
              scaling: 1,
              element: "anemo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: noIcd(),
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "configured-prep",
          atFrame: 0,
        },
      ],
    };

    const result = simulate(base, NO_CRIT);
    const direct = result.elementalApplicationIcdLog.find(
      (entry) =>
        entry.sourceKind === "configured-direct-hit" &&
        entry.hitId === "configured-prep-hit",
    )!;
    const propagated = result.elementalApplicationIcdLog.find(
      (entry) =>
        entry.sourceKind === "swirl-propagation" && entry.targetId === "landed",
    )!;

    expect(direct.decision).toMatchObject({
      kind: "fixed-gcsim",
      icdTag: "ICDTagSwirlPyro",
      hitIndex: 0,
      allowed: true,
    });
    expect(propagated.decision).toMatchObject({
      kind: "reaction-fixed-gcsim",
      icdTag: "ICDTagSwirlPyro",
      hitIndex: 0,
      allowed: true,
    });
    expect(direct.id).not.toBe(propagated.id);
    expectReciprocalApplicationLinks(result);
  });
});
