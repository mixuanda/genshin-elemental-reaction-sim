import { expect, it } from "vitest";
import type { Element } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { evaluatePhaseAlignedSteadyState, repeatLegalTimelineForDuration } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

it("captures actual ordinary reaction lifecycles, queued attacks, target debuffs and repeating mechanical state", () => {
  const scenarios: Array<{ elements: Element[]; aura?: string; reaction?: string }> = [
    { elements: ["hydro", "cryo"], aura: "frozen" },
    { elements: ["dendro", "electro"], aura: "quicken" },
    { elements: ["pyro", "electro"], reaction: "overload" },
    { elements: ["cryo", "electro"], reaction: "superconduct" },
    { elements: ["pyro", "anemo"], reaction: "swirlPyro" },
    { elements: ["hydro", "cryo", "physical"], reaction: "shatter" },
  ];
  const measurements: unknown[] = [];
  for (const scenario of scenarios) {
    const config = makeConfig({ duration: 20, cycleLength: 20,
      meta: { name: "通用反应检查点合成场景", version: "nonperiodic-state-v1", verificationStatus: "user-supplied" },
      enemy: { level: 90, resistance: 0, defReduction: 0,
        targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
      reactionEngine: { mode: "aura-v9" }, targetTaskModel: { mode: "target-phase-v2" },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
        abilities: scenario.elements.map((element, index) => ({ id: `input-${index}`, actorId: "a", name: `合成${element}`, kind: "skill",
          cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: `hit-${index}`, frame: 0, scaling: 1, element,
            ...(element === "physical" ? {} : { application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" as const } } }),
            ...(element === "physical" ? { strikeType: "blunt" as const, poiseDamage: 1 } : {}),
            geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 } }] })),
        commands: scenario.elements.map((_, index) => ({ type: "skill", actorId: "a", abilityId: `input-${index}`, atFrame: index })),
      },
    });
    const result = simulate(repeatLegalTimelineForDuration(config, 140), { execution: { checkpointFrames: [2, 4, 1200, 2400, 3600, 4800, 6000] } });
    const audit = result.executionAudit!;
    expect.soft(audit.checkpointCoverage.complete, `${scenario.elements}: ${audit.checkpointCoverage.reasons.join("; ")}`).toBe(true);
    if (!audit.checkpointCoverage.complete) continue;
    const early = audit.phaseCheckpoints[0]!.state as Record<string, any>;
    if (scenario.aura) {
      expect.soft(early.auras.targets[0].auras.some((entry: { element: string }) => entry.element === scenario.aura)).toBe(true);
      expect.soft(early.pendingEvents.inFlight.some((entry: { type: string }) => entry.type === `${scenario.aura}Expiry`)).toBe(true);
    }
    if (scenario.reaction) expect.soft(result.damageEvents.some(event => event.reaction === scenario.reaction)).toBe(true);
    if (scenario.reaction === "superconduct") {
      const after = audit.phaseCheckpoints[1]!.state as Record<string, any>;
      expect.soft(after.buffsAndDebuffs.reactionTargetDebuffs).toMatchObject([{ element: "physical", resShred: .4 }]);
    }
    const steady = evaluatePhaseAlignedSteadyState({ checkpoints: audit.phaseCheckpoints.filter(point => point.tick >= 1200),
      cycleTicks: 1200, deterministic: true, checkpointProducer: audit.version, maximumPeriodCycles: 1 });
    expect.soft(steady.status, `${scenario.elements}: ${steady.reasons.join("; ")}`).toBe("established-for-supplied-checkpoints");
    measurements.push({ elements: scenario.elements, checkpoints: audit.phaseCheckpoints.length, periodCycles: steady.periodCycles, dps: steady.steadyStateDps });
  }
  console.log("Nonperiodic reaction checkpoint measurements", JSON.stringify(measurements));
});
