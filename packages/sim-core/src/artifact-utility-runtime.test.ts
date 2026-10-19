import { describe, expect, it } from "vitest";
import { replayArtifactUtility, type ArtifactUtilityScenario } from "./artifact-utility-runtime";

const base = (setId: ArtifactUtilityScenario["setId"], pieces: number, events: ArtifactUtilityScenario["events"]): ArtifactUtilityScenario =>
  ({ incomingDamageMode: "unshielded-hp-only", setId, pieces, maxHp: 10000, initialHp: 5000, events });

describe("released artifact utility event replay", () => {
  it("uses only observed Tiny Miracle resistance windows and never derives activation from a hit", () => {
    const events: ArtifactUtilityScenario["events"] = [
      { kind: "elemental-hit", frame: 0, element: "pyro", damageBeforeResistance: 1000, baseResistance: 0 },
      { kind: "tiny-resistance-observed", frame: 1, element: "pyro", expiresFrame: 600, cooldownExpiresFrame: 600 },
      { kind: "elemental-hit", frame: 1, element: "pyro", damageBeforeResistance: 1000, baseResistance: 0 },
      { kind: "elemental-hit", frame: 2, element: "hydro", damageBeforeResistance: 1000, baseResistance: 0 },
      { kind: "elemental-hit", frame: 600, element: "pyro", damageBeforeResistance: 1000, baseResistance: 0 },
    ];
    const result = replayArtifactUtility(base(10004, 4, events));
    expect(result.steps.filter(step => step.incomingDamage !== undefined).map(step => step.resistance)).toEqual([0.2, 0.5, 0.2, 0.2]);
    expect(result.steps.filter(step => step.incomingDamage !== undefined).map(step => step.incomingDamage)).toEqual([800, 500, 800, 800]);
    expect(result.steps.at(-1)?.tinyMiracleExpiresFrame).toBe(600);
    expect(result.steps[0]?.trace.find(node => node.id === "artifact.utility.hpAfter")?.result?.value).toBe(4200);
    expect(() => replayArtifactUtility({ ...base(10004, 4, events), incomingDamageMode: "shielded" as "unshielded-hp-only" })).toThrow("无护盾");
  });

  it("uses shared health arithmetic for Traveling Doctor incoming healing and actual burst self-heal", () => {
    const result = replayArtifactUtility(base(10013, 4, [
      { kind: "incoming-heal", frame: 10, baseHealing: 1000, healingBonus: 0.1, otherIncomingHealingBonus: 0.05 },
      { kind: "burst-cast", frame: 20, healingBonus: 0.1, otherIncomingHealingBonus: 0.05 },
    ]));
    expect(result.steps[0]?.requestedHealing).toBe(1350);
    expect(result.steps[1]?.requestedHealing).toBe(2700);
    expect(result.finalHp).toBe(9050);
    expect(result.steps[1]?.trace.map(node => node.id)).toContain("health.after");
  });

  it("keeps exploration healing tied to explicit chest ticks and Mora pickups", () => {
    const chest = replayArtifactUtility(base(10010, 4, [
      { kind: "chest-open", frame: 0 },
      { kind: "chest-heal-tick", frame: 60, fractionOfMaxHp: 0.1 },
      { kind: "chest-heal-tick", frame: 299, fractionOfMaxHp: 0.2 },
    ]));
    expect(chest.finalHp).toBe(8000);
    expect(() => replayArtifactUtility(base(10010, 4, [
      { kind: "chest-open", frame: 0 }, { kind: "chest-heal-tick", frame: 301, fractionOfMaxHp: 0.1 },
    ]))).toThrow();
    expect(replayArtifactUtility(base(10011, 4, [{ kind: "mora-pickup", frame: 0 }])).finalHp).toBe(5300);
  });

  it("leaves one-piece Prayer status timing blocked without independent executable evidence", () => {
    const result = replayArtifactUtility(base(15009, 1, [{ kind: "elemental-status", frame: 20, element: "pyro", baseDurationFrames: 120 }]));
    expect(result.steps[0]?.statusDurationFrames).toBeUndefined();
    expect(result.steps[0]?.notes.join(" ")).toContain("保持阻塞");
  });
});
