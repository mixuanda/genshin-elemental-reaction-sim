import { describe, expect, it } from "vitest";
import { simulationResultSchema, simulationRunManifestV153Schema } from "./index";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";

const result = () => simulate(makeConfig(), { compatibilityMode: "legal-frame-v1", critMode: "noCrit" });

describe("strict wire structure before semantic identity checks", () => {
  it("reports the unknown manifest field without hashing its stripped partial value", () => {
    const manifest = { ...result().runManifest, unexpectedIdentityPolicy: "untrusted" };
    manifest.reproducibilityKey = "gdl-v2-fnv1a32-00000000";
    const before = JSON.stringify(manifest);
    const parsed = simulationRunManifestV153Schema.safeParse(manifest);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Unknown manifest identity policy was accepted");
    expect(parsed.error.issues).toHaveLength(1);
    expect(parsed.error.issues[0]).toMatchObject({ code: "unrecognized_keys", keys: ["unexpectedIdentityPolicy"], path: [] });
    expect(JSON.stringify(manifest)).toBe(before);
  });

  it("rejects unknown nested runtime fields at both real result boundaries", () => {
    const value = result();
    Object.assign(value.resolvedRuntimeOptions, { unexpectedIdentityPolicy: "untrusted" });
    Object.assign(value.runManifest.resolvedRuntimeOptions, { unexpectedIdentityPolicy: "untrusted" });
    value.runManifest.reproducibilityKey = "gdl-v2-fnv1a32-00000000";
    value.reproducibilityKey = value.runManifest.reproducibilityKey;
    const before = JSON.stringify(value);
    const parsed = simulationResultSchema.safeParse(value);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Unknown result identity policy was accepted");
    expect(parsed.error.issues).toHaveLength(2);
    expect(parsed.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unrecognized_keys", path: ["resolvedRuntimeOptions"] }),
      expect.objectContaining({ code: "unrecognized_keys", path: ["runManifest", "resolvedRuntimeOptions"] })
    ]));
    expect(JSON.stringify(value)).toBe(before);
  });

  it("still validates identity hashes when the wire structure is valid", () => {
    const value = result();
    const before = structuredClone(value);
    expect(simulationResultSchema.parse(value)).toStrictEqual(before);
    value.runManifest.reproducibilityKey = "gdl-v2-fnv1a32-00000000";
    value.reproducibilityKey = value.runManifest.reproducibilityKey;
    const parsed = simulationResultSchema.safeParse(value);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Forged manifest hash was accepted");
    expect(parsed.error.issues).toContainEqual(expect.objectContaining({
      code: "custom", path: ["runManifest", "reproducibilityKey"],
      message: "does not match the versioned run-manifest identity"
    }));
  });
});
