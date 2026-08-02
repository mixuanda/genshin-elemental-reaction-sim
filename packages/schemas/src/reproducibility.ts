import {
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  SIMULATION_RUN_MANIFEST_VERSION,
  type SimulationRunManifest,
  type SimulationRunManifestV142,
  type SimulationRunManifestV144,
  type SimulationRunManifestV145,
  type SimulationRunManifestV146,
  type SimulationRunManifestV147,
  type SimulationRunManifestV148,
  type SimulationRunManifestV149,
  type SimulationRunManifestV150,
  type SimulationRunManifestV151,
  type SimulationRunManifestV152,
  type SimulationRunManifestV153
} from "./types";

type CurrentSimulationRunIdentity = Omit<
  SimulationRunManifestV153,
  "reproducibilityKey"
>;
type FrozenV152SimulationRunIdentity = Omit<
  SimulationRunManifestV152,
  "reproducibilityKey"
>;
type FrozenSimulationRunIdentity =
  | Omit<SimulationRunManifestV142, "reproducibilityKey">
  | Omit<SimulationRunManifestV144, "reproducibilityKey">
  | Omit<SimulationRunManifestV145, "reproducibilityKey">
  | Omit<SimulationRunManifestV146, "reproducibilityKey">
  | Omit<SimulationRunManifestV147, "reproducibilityKey">
  | Omit<SimulationRunManifestV148, "reproducibilityKey">
  | Omit<SimulationRunManifestV149, "reproducibilityKey">
  | Omit<SimulationRunManifestV150, "reproducibilityKey">
  | Omit<SimulationRunManifestV151, "reproducibilityKey">
  | Omit<SimulationRunManifestV152, "reproducibilityKey">;
type VersionedSimulationRunIdentity =
  | FrozenSimulationRunIdentity
  | CurrentSimulationRunIdentity;

function canonicalize(
  value: unknown,
  ancestors: Set<object>
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        "Reproducibility identity cannot encode non-finite numbers."
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError(
        "Reproducibility identity cannot encode cyclic arrays."
      );
    }
    ancestors.add(value);
    const encoded = value.map((entry) => {
      if (entry === undefined) {
        throw new TypeError(
          "Reproducibility identity cannot encode undefined array entries."
        );
      }
      return canonicalize(entry, ancestors);
    });
    ancestors.delete(value);
    return `[${encoded.join(",")}]`;
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) {
      throw new TypeError(
        "Reproducibility identity cannot encode cyclic objects."
      );
    }
    ancestors.add(value);
    const record = value as Record<string, unknown>;
    const encoded = Object.keys(record)
      .sort()
      .flatMap((key) =>
        record[key] === undefined
          ? []
          : [
              `${JSON.stringify(key)}:${canonicalize(
                record[key],
                ancestors
              )}`
            ]
      );
    ancestors.delete(value);
    return `{${encoded.join(",")}}`;
  }
  throw new TypeError(
    `Reproducibility identity cannot encode ${typeof value} values.`
  );
}

/**
 * Stable JSON-compatible encoding with sorted object keys.
 *
 * Array order remains semantic. Undefined object properties are omitted,
 * matching JSON object behavior; undefined array entries are rejected.
 */
export function canonicalStringify(value: unknown): string {
  return canonicalize(value, new Set());
}

/**
 * FNV-1a over UTF-8 bytes. This is a compact drift detector, not a
 * cryptographic integrity primitive.
 */
export function fnv1a32Hex(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createVersionedContentHash(
  value: unknown
): string {
  return `fnv1a32:${fnv1a32Hex(canonicalStringify(value))}`;
}

export function createSimulationConfigHash(
  config: unknown
): string {
  // Current configs carry all mechanics models, so the canonical full-config
  // encoding binds every selected fixed profile without parallel hash paths.
  return createVersionedContentHash(config);
}

export function createSimulationReproducibilityKey(
  identity: VersionedSimulationRunIdentity
): string {
  // The current identity includes all eight mechanics roots and each exact
  // policy selection. Frozen identities remain accepted verbatim.
  return `gdl-v2-fnv1a32-${fnv1a32Hex(
    canonicalStringify(identity)
  )}`;
}

export function createSimulationRunManifest(
  input: Omit<
    CurrentSimulationRunIdentity,
    "version" | "identityAlgorithm"
  >
): SimulationRunManifest;
export function createSimulationRunManifest(
  input: Omit<
    FrozenV152SimulationRunIdentity,
    "version" | "identityAlgorithm"
  >
): SimulationRunManifestV152;
export function createSimulationRunManifest(
  input:
    | Omit<
        CurrentSimulationRunIdentity,
        "version" | "identityAlgorithm"
      >
    | Omit<
        FrozenV152SimulationRunIdentity,
        "version" | "identityAlgorithm"
      >
): SimulationRunManifest | SimulationRunManifestV152 {
  const version =
    input.schemaVersion === FREEZE_BROKEN_ATTACK_SCHEMA_VERSION
      ? FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION
      : SIMULATION_RUN_MANIFEST_VERSION;
  const identity = {
    ...input,
    version,
    identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM
  } as CurrentSimulationRunIdentity | FrozenV152SimulationRunIdentity;
  return {
    ...identity,
    reproducibilityKey:
      createSimulationReproducibilityKey(identity)
  } as SimulationRunManifest | SimulationRunManifestV152;
}
