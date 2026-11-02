import { beforeAll, describe, expect, it } from "vitest";
import { simulationResultSchema, type SimulationResult } from "@genshin-dps-lab/schemas";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

// Keep every boundary active when a config's predecessor parses are reused.
describe("calculator bridge validation after single-pass config parsing", () => {
  let result: SimulationResult;
  beforeAll(() => {
    result = simulate(makeConfig({
      duration: 1,
      rotation: [{ id: "synthetic", actorId: "a", name: "Synthetic", at: 0,
        hits: [{ id: "first", offset: 0, scaling: 1 }, { id: "second", offset: 0.5, scaling: 1 }] }]
    }));
    expect(result.damageEvents).toHaveLength(2);
  });

  const mutations: Array<[string, (wire: SimulationResult) => void]> = [
    ["duplicate event IDs", wire => { wire.damageEvents[1]!.id = wire.damageEvents[0]!.id; }],
    ["dangling target references", wire => { wire.damageEvents[0]!.targetId = "missing-target"; }],
    ["reordered event rows", wire => { wire.damageEvents = [...wire.damageEvents].reverse(); wire.hitEvents = [...wire.hitEvents].reverse(); }],
    ["altered event sequences", wire => { wire.damageEvents[0]!.eventSequence += 1000; }],
    ["altered config hashes", wire => { wire.runManifest.configHash = "fnv1a32:00000000"; }],
    ["unknown result fields", wire => { Object.assign(wire, { trusted: true }); }],
    ["valid config edits without matching provenance", wire => { wire.config.characters[0]!.stats.baseAtk += 1; }]
  ];

  for (const [label, mutate] of mutations) {
    it(`still rejects ${label} at public and capture boundaries`, () => {
      const wire = structuredClone(result);
      mutate(wire);
      expect(simulationResultSchema.safeParse(wire).success).toBe(false);
      expect(() => captureSimulationHit(wire, 0)).toThrow();
    });
  }

  it("does not retain trust in a mutable result after a successful round trip", () => {
    const captured = captureSimulationHit(result, 0);
    expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captured))).reproducedDamage).toBe(result.damageEvents[0]!.finalDamage);
    captured.sourceResult.config.characters[0]!.initialEnergy = 61;
    expect(() => replaySimulationHit(captured)).toThrow();
    expect(() => serializeSimulationHit(captured)).toThrow();
    expect(() => parseSimulationHit(JSON.stringify(captured))).toThrow();
    // The public parser's output is a clone, not a globally trusted raw object.
    expect(result.config.characters[0]!.initialEnergy).toBe(0);
  });
});
