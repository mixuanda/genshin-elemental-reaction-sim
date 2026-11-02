import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { createNoelleBurstNormalScenario, createNoelleSourceAbilities, validateNoelleSourceActionSequence } from "../noelle-source-action";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { createAmberSkillBurstScenario, deriveSourceBackedRotationMappings, validateSourceBackedActionSequence } from "../source-action-library";

const measured = JSON.parse(readFileSync("docs/validation/noelle-q-normal-external.measured.json", "utf8")) as {
  hits: Array<{ frame: number; damage: number; scalingAttack: number }>;
  totalDamage: number;
};

describe("Noelle source Q to normal chain", () => {
  it("matches the single external damage fixture and restores actual conversion, delayed energy and RNG context", () => {
    const config = createNoelleBurstNormalScenario();
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    expect(deriveSourceBackedRotationMappings(config)?.normalChains?.noelle).toHaveLength(4);
    const result = simulate(config, { execution: { captureHits: true, detailedTraces: true } });
    expect(result.damageEvents.map(hit => hit.frame)).toEqual(measured.hits.map(hit => hit.frame));
    result.damageEvents.forEach((hit, index) => {
      expect(hit.finalDamage).toBeCloseTo(measured.hits[index]!.damage, 12);
      expect(hit.scalingValue).toBeCloseTo(measured.hits[index]!.scalingAttack, 12);
      expect(hit.element).toBe("geo");
      const replay = replaySimulationHit(captureSimulationHit(result, hit.id));
      expect(replay.difference).toBe(0);
      expect(replay.trace.some(node => node.id === "statConversionAttack" && node.status === "assumed")).toBe(true);
    });
    expect(result.totalDamage).toBeCloseTo(measured.totalDamage, 12);
    expect(result.energyCostLog).toMatchObject([{ operation: "reserve", frame: 1, energyBefore: 60, energyAfter: 60 }, { operation: "debit", frame: 9, energyBefore: 60, energyAfter: 0 }]);
    expect(result.statConversionLog).toMatchObject([{ frame: 1, expiresAtFrame: 981, sourceValue: 66.95325, appliedValue: 26.7813 }]);
    const energy = result.normalHitEnergyLog!.filter(row => row.kind === "damage");
    expect(energy.map(row => row.frame)).toEqual([111, 146, 187, 240]);
    expect(energy.map(row => row.drawIndex)).toEqual([0, 1, 2, 3]);
    expect(result.energyStats.noelle!.final).toBe(energy.reduce((sum, row) => sum + row.gainedEnergy, 0));
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    const tampered = structuredClone(result);
    const draw = tampered.normalHitEnergyLog!.find(row => row.kind === "damage")!;
    if (draw.kind === "damage") draw.roll = 0;
    expect(simulationResultSchema.safeParse(tampered).success).toBe(false);
  });

  it("takes live DEF at cast, preserves its value after DEF buff expiry and removes ATK/Geo exactly at conversion expiry", () => {
    const { timeline: _timeline, normalHitEnergyModel: _energy, ...base } = createNoelleBurstNormalScenario();
    const q = createNoelleSourceAbilities()[0]!;
    // Synthetic probes isolate the boundary. They are not claimed as legal
    // three-frame normal inputs or a second external character fixture.
    const result = simulate({ ...base, dataVersion: "synthetic-conversion-window", meta: { ...base.meta, version: "synthetic-conversion-window" }, duration: 17, cycleLength: 18, rotation: [],
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "noelle", swapFrames: 1,
        abilities: [
          { id: "def-window", actorId: "noelle", name: "Synthetic DEF buff", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, buffs: [{ stat: "defPct", value: 1, durationFrames: 30 }] },
          { ...q, hits: [] },
          { id: "probes", actorId: "noelle", name: "Synthetic boundary probes", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
            hits: [896, 897, 898].map(frame => ({ id: `probe-${frame}`, frame, scaling: 1, element: "physical", snapshot: "hit", infusion: { statusKey: "noelle-burst", element: "geo", application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } } })) }
        ], commands: [{ type: "skill", actorId: "noelle", abilityId: "def-window", atFrame: 0 }, { type: "burst", actorId: "noelle", abilityId: "noelle-burst", atFrame: 1 }, { type: "normal", actorId: "noelle", abilityId: "probes" }]
      }
    }, { execution: { captureHits: true } });
    expect(result.statConversionLog![0]).toMatchObject({ sourceValue: 133.9065, appliedValue: 53.5626, expiresAtFrame: 981 });
    expect(result.damageEvents.map(hit => [hit.frame, hit.element])).toEqual([[980, "geo"], [981, "physical"], [982, "physical"]]);
    result.damageEvents.forEach((hit, index) => expect(hit.scalingValue).toBeCloseTo(index === 0 ? 92.8348 : 39.2722, 12));
    expect(result.damageEvents.map(hit => hit.statsBeforeDamage.defPct)).toEqual([0, 0, 0]);
    for (const hit of result.damageEvents) expect(replaySimulationHit(captureSimulationHit(result, hit.id)).difference).toBe(0);
    const tampered = structuredClone(result);
    tampered.statConversionLog![0]!.snapshot.baseDef += 1;
    expect(simulationResultSchema.safeParse(tampered).success).toBe(false);
  });
  it("executes Amber Q followed by normals under the new energy profile while preserving legacy scope", () => {
    const config = createAmberSkillBurstScenario();
    for (let index = 1; index <= 5; index++) config.timeline!.commands.push({ type: "normal", actorId: "amber", abilityId: `amber-normal-${index}` });
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    const result = simulate(config, { execution: { captureHits: true } });
    expect(result.damageEvents).toHaveLength(24);
    const rows = result.normalHitEnergyLog!.filter(row => row.kind === "damage");
    expect(rows).toHaveLength(5);
    expect(rows.every(row => row.weaponType === "bow" && row.frame > 92)).toBe(true);
    expect(result.energyStats.amber!.final).toBe(12 + rows.reduce((sum, row) => sum + row.gainedEnergy, 0));
    expect(replaySimulationHit(captureSimulationHit(result, result.damageEvents.find(row => row.hitId === "amber-normal-1-hit")!.id)).difference).toBe(0);
    const old = createAmberSkillBurstScenario("legacy-v1");
    expect(old.normalHitEnergyModel).toBeUndefined();
    old.timeline!.commands.push({ type: "normal", actorId: "amber", abilityId: "amber-normal-1" });
    expect(validateSourceBackedActionSequence(old).status).toBe("invalid");
  });

});

// Source contract absence is distinct from a declared model, including null in untrusted input.
it("rejects injected optional models without treating absent Noelle fields as invalid identities", () => {
  const config = createNoelleBurstNormalScenario();
  expect(validateNoelleSourceActionSequence(config).status).toBe("valid");
  for (const key of ["favoniusModel", "weaponProcModel", "thrillingTalesModel", "sacrificialModel", "staminaModel"] as const) {
    for (const value of [null, {}]) {
      const changed = structuredClone(config);
      Object.assign(changed, { [key]: value });
      const verdict = validateNoelleSourceActionSequence(changed);
      expect(verdict.status).toBe("invalid");
      expect(verdict.issues.join(";")).toContain(key);
    }
  }
  const missing = structuredClone(config);
  delete missing.normalHitEnergyModel;
  expect(validateNoelleSourceActionSequence(missing).status).toBe("invalid");
});
