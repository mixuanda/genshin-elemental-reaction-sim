import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  assertTrustedSimulationResultV144,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV144Schema,
  simulationResultSchema,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

interface HistoricalCase {
  caseId: string;
  expectedAcceptance: boolean;
  wireSha256: string;
  wireText: string;
}
const bytes = readFileSync(new URL("./fixtures/reaction-formula-v144-84ff5cd.json", import.meta.url));
const archive = JSON.parse(bytes.toString("utf8")) as {
  fixtureVersion: string;
  source: { repository: string; commit: string; files: Array<{ path: string; gitBlobSha1: string; sha256: string }> };
  cases: HistoricalCase[];
};
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

describe("immutable V144 reaction-formula boundary counterexamples", () => {
  it("keeps exact historical bytes and their immutable source identity separate from current results", () => {
    expect(hash(bytes)).toBe("6dee5dd4000a4bfe77d811fa44bcd56710c0dbc295a0b110d086f6614c625033");
    expect(archive.fixtureVersion).toBe("reaction-formula-v144-84ff5cd-v1");
    expect(archive.source.repository).toBe("mixuanda/genshin-elemental-reaction-sim");
    expect(archive.source.commit).toBe("84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5");
    expect(archive.source.files.find(file => file.path.endsWith("/reaction-formula-integrity.test.ts"))?.gitBlobSha1).toBe("4307ce4406b49173e6b6a3b3f158b8bfdaa12cf3");
    expect(archive.cases.map(row => row.caseId)).toEqual([
      "valid-melt", "forged-superconduct-level-base", "forged-melt-reaction-base",
      "forged-aggravate-level-base", "forged-spread-base-multiplier",
    ]);
    for (const row of archive.cases) expect(hash(row.wireText)).toBe(row.wireSha256);
  });

  it.each(archive.cases)("preserves the original V144 acceptance limitation: $caseId", row => {
    const wire = JSON.parse(row.wireText);
    const before = structuredClone(wire);
    expect(wire.schemaVersion).toBe(BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION);
    expect(wire.engineVersion).toBe(BURNING_CALLBACK_DELIVERY_ENGINE_VERSION);
    expect(wire.totalDamage).toBe(0); // Damage immunity hides changed potential damage in the old proof.
    expect(wire.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
    expect(wire.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
    expect(wire.runManifest.configHash).toBe(createSimulationConfigHash(wire.config));
    const { reproducibilityKey, ...identity } = wire.runManifest;
    expect(reproducibilityKey).toBe(createSimulationReproducibilityKey(identity));
    expect(wire.reproducibilityKey).toBe(reproducibilityKey);

    if (row.caseId === "valid-melt") {
      expect(wire.damageEvents[0].damageFactors.reactionBase).toBe(2);
      expect(wire.damageEvents[0].potentialDamage).toBeCloseTo(1246.8, 10);
    } else if (row.caseId === "forged-superconduct-level-base") {
      expect(wire.damageEvents.find((event: any) => event.kind === "transformative-reaction").transformativeReactionFactors.levelBaseDamage).toBe(1446.8535 * 10);
    } else if (row.caseId === "forged-melt-reaction-base") {
      expect(wire.damageEvents[0].damageFactors.reactionBase).toBe(20);
    } else if (row.caseId === "forged-aggravate-level-base") {
      expect(wire.damageEvents.find((event: any) => event.reaction === "aggravate").additiveReactionFactors.levelBaseDamage).toBe(1446.8535 * 10);
    } else {
      expect(wire.damageEvents.find((event: any) => event.reaction === "spread").additiveReactionFactors.baseMultiplier).toBe(1.25 * 10);
    }

    if (row.expectedAcceptance) {
      const parsed = simulationResultV144Schema.parse(wire);
      expect(assertTrustedSimulationResultV144(parsed as unknown as SimulationResult)).toBe(parsed);
    } else {
      // This numerical restriction already existed in the frozen V144 proof.
      expect(simulationResultV144Schema.safeParse(wire).success).toBe(false);
    }
    expect(simulationResultSchema.safeParse(wire).success).toBe(false);
    expect(wire).toEqual(before);
    expect(hash(row.wireText)).toBe(row.wireSha256);
  });

  it.each(["root", "manifest"] as const)("does not silently admit a current flat-stat extension into the frozen %s wire", path => {
    const original = archive.cases[0]!;
    const wire = JSON.parse(original.wireText);
    const options = path === "root" ? wire.resolvedRuntimeOptions : wire.runManifest.resolvedRuntimeOptions;
    options.flatStatBuffSemantics = "canonical-v1";
    const result = simulationResultV144Schema.safeParse(wire);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ code: "unrecognized_keys", keys: ["flatStatBuffSemantics"] }));
    expect(hash(original.wireText)).toBe(original.wireSha256);
  });
});
