import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV151Schema,
  simulationResultV152Schema,
  type SimConfigV151,
  type SimulationResultForV151,
  type SimulationResultForV152,
  type SimulationRunManifestV151,
} from "@genshin-dps-lab/schemas";

/**
 * Projects a current 1.52 result onto the exact frozen 1.51 public wire.
 *
 * The source must first pass both 1.52 boundaries because projection removes
 * the Freeze Broken proof that binds the selected policy to its emitted audit.
 * V1 is representable only as its historical empty-log behavior. V2 is
 * representable only when no Freeze Broken row was emitted; a non-empty V2
 * log carries 1.52-only callback semantics and therefore fails closed.
 */
export function projectSimulationResultV152ToV151(
  result: SimulationResultForV152,
): SimulationResultForV151 {
  simulationResultV152Schema.parse(result);
  assertTrustedSimulationResultV152(result);

  const selectedModel = result.config.freezeBrokenAttackModel;
  const selectedRoot = result.runManifest.freezeBrokenAttackRoot;
  if (selectedRoot.policyId !== selectedModel.policyId) {
    throw new Error(
      "V1.52 Freeze Broken attack root policy does not match the policy " +
        "selected by config.",
    );
  }

  if (
    selectedModel.mode === "legacy-no-freeze-broken-attack-callback" &&
    result.freezeBrokenAttackLog.length !== 0
  ) {
    throw new Error(
      "V1.52 to V1.51 compatibility projection requires Freeze Broken " +
        "V1 to retain its historical empty log; received " +
        `${result.freezeBrokenAttackLog.length} row(s).`,
    );
  }
  if (
    selectedModel.mode === "fixed-gcsim-freeze-broken-attack-normalized-v2" &&
    result.freezeBrokenAttackLog.length !== 0
  ) {
    throw new Error(
      "V1.52 to V1.51 compatibility projection supports Freeze Broken " +
        "V2 only when freezeBrokenAttackLog is empty; callback semantics " +
        `produced ${result.freezeBrokenAttackLog.length} row(s).`,
    );
  }

  const { freezeBrokenAttackModel: _freezeBrokenAttackModel, ...configRest } =
    result.config;
  const config: SimConfigV151 = {
    ...configRest,
    schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
    engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  };
  const configHash = createSimulationConfigHash(config);

  const {
    freezeBrokenAttackRoot: _freezeBrokenAttackRoot,
    reproducibilityKey: _currentReproducibilityKey,
    ...manifestRest
  } = result.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV151,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    version: BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
    schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
    engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
    configHash,
  };
  const runManifest: SimulationRunManifestV151 = {
    ...manifestIdentity,
    reproducibilityKey: createSimulationReproducibilityKey(manifestIdentity),
  };

  const { freezeBrokenAttackLog: _freezeBrokenAttackLog, ...resultRest } =
    result;
  const projected = {
    ...resultRest,
    schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
    engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
    config,
    runManifest,
    reproducibilityKey: runManifest.reproducibilityKey,
  } as SimulationResultForV151;

  // The byte-frozen 1.51 schema is the final authority for every nested wire
  // and for the complete absence of 1.52-only identity and audit fields. The
  // parsed clone is intentionally discarded: returning it would reorder old
  // nested object keys and change byte-frozen Golden serialization despite
  // preserving all values.
  simulationResultV151Schema.parse(projected);
  return projected;
}
