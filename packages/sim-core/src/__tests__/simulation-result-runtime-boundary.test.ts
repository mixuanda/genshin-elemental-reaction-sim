import {
  durinMeltPreset,
  particleEnergyDemoPreset
} from "@genshin-dps-lab/game-data/presets";
import { assertTrustedSimulationResultV144 } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";

function expectRuntimeAliasesArePreserved(
  result: ReturnType<typeof simulate>
): void {
  expect(result.resolvedRuntimeOptions).toBe(
    result.runManifest.resolvedRuntimeOptions
  );
  expect(result.pluginManifest).toBe(result.runManifest.plugins);
  expect(result.hitEvents).toBe(result.damageEvents);
}

describe("public SimulationResult validation boundary", () => {
  it("validates the final legacy-compatible result without replacing runtime aliases", () => {
    const result = simulate(durinMeltPreset);

    expect(assertTrustedSimulationResultV144(result)).toBe(result);
    expect(result.compatibilityMode).toBe("legacy-v0.1");
    expectRuntimeAliasesArePreserved(result);
  });

  it("validates a legal-frame result after all runtime-energy prefix probes", () => {
    expect(
      particleEnergyDemoPreset.timeline?.abilities.some(
        (ability) => (ability.energyCost ?? 0) > 0
      )
    ).toBe(true);
    const result = simulate(particleEnergyDemoPreset);

    expect(assertTrustedSimulationResultV144(result)).toBe(result);
    expect(result.compatibilityMode).toBe("legal-frame-v1");
    expect(result.timelineExecution).toBeDefined();
    expectRuntimeAliasesArePreserved(result);
  });

  it("rejects forged trusted aggregates and event identities without cloning", () => {
    const result = simulate(durinMeltPreset);
    const forgedTotal = structuredClone(result);
    forgedTotal.totalDamage += 1;
    expect(() =>
      assertTrustedSimulationResultV144(forgedTotal)
    ).toThrow(/totalDamage/);

    const forgedId = structuredClone(result);
    forgedId.damageEvents[0]!.id += 1;
    forgedId.hitEvents = forgedId.damageEvents;
    expect(() =>
      assertTrustedSimulationResultV144(forgedId)
    ).toThrow(/damageEvents\.0\.id/);
  });
});
