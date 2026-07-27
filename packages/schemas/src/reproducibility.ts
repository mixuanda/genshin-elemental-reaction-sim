import {
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  SIMULATION_RUN_MANIFEST_VERSION,
  type SimulationRunManifest
} from "./types";

type SimulationRunIdentity = Omit<
  SimulationRunManifest,
  "reproducibilityKey"
>;

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
  return createVersionedContentHash(config);
}

export function createSimulationReproducibilityKey(
  identity: SimulationRunIdentity
): string {
  return `gdl-v2-fnv1a32-${fnv1a32Hex(
    canonicalStringify(identity)
  )}`;
}

export function createSimulationRunManifest(
  input: Omit<
    SimulationRunIdentity,
    "version" | "identityAlgorithm"
  >
): SimulationRunManifest {
  const identity: SimulationRunIdentity = {
    version: SIMULATION_RUN_MANIFEST_VERSION,
    identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM,
    ...input
  };
  return {
    ...identity,
    reproducibilityKey:
      createSimulationReproducibilityKey(identity)
  };
}
